import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CUTABC_BASE = "http://www.cutabc.cn:8091/cut_app/app";

interface TenantCredentials {
  cutabc_company_no: string;
  cutabc_username: string;
  cutabc_password: string;
}

async function loginCutABC(creds: TenantCredentials): Promise<string> {
  const res = await fetch(`${CUTABC_BASE}/Register/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      companyNo: creds.cutabc_company_no,
      userName: creds.cutabc_username,
      userPwd: creds.cutabc_password,
    }),
  });
  const data = await res.json();
  if (data.code != 0 || !data.data?.sessionId) {
    throw new Error(`CutABC login failed: ${JSON.stringify(data)}`);
  }
  return data.data.sessionId;
}

async function fetchPage(
  sessionId: string,
  from: string,
  to: string,
  page: number,
  pageSize: number,
): Promise<{ items: Record<string, unknown>[]; reccnt: number }> {
  const res = await fetch(`${CUTABC_BASE}/reportSetting/getMastinfo`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", sessionId },
    body: new URLSearchParams({
      itemno: "fixbalaqty",
      data: JSON.stringify([{ billdate_beg: from }, { billdate_end: to }, { branna: "" }, { fixno: "" }]),
      pageindex: String(page),
      pagesize: String(pageSize),
    }),
  });
  const d = await res.json();
  const items = (d.success === "1" && d.listTask) ? d.listTask as Record<string, unknown>[] : [];
  const reccnt = parseInt(d.reccnt) || 0;
  return { items, reccnt };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Identify the calling user (and therefore the tenant) from the JWT.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userData.user.id;

    // Resolve tenant + CutABC credentials from tenant_settings
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();
    if (profileErr || !profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "User has no tenant assigned. Complete onboarding first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const tenantId = profile.tenant_id as string;

    const { data: settings, error: settingsErr } = await supabase
      .from("tenant_settings")
      .select("cutabc_company_no, cutabc_username, cutabc_password")
      .eq("tenant_id", tenantId)
      .single();
    if (settingsErr || !settings?.cutabc_company_no || !settings?.cutabc_username || !settings?.cutabc_password) {
      return new Response(
        JSON.stringify({ error: "CutABC credentials not configured for this tenant." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const creds: TenantCredentials = {
      cutabc_company_no: settings.cutabc_company_no as string,
      cutabc_username: settings.cutabc_username as string,
      cutabc_password: settings.cutabc_password as string,
    };

    const { period } = await req.json();
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return new Response(
        JSON.stringify({ error: "period must be YYYY-MM format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as loading
    await supabase
      .from("cuts_history_backfill")
      .upsert(
        { period, tenant_id: tenantId, status: "loading", started_at: new Date().toISOString(), error_message: null, records_loaded: 0 },
        { onConflict: "period,tenant_id" }
      );

    // Run the heavy work in the background so the client never waits for the full
    // CutABC pagination. The frontend polls cuts_history_backfill for status.
    // @ts-ignore - EdgeRuntime is provided by Supabase Edge Functions runtime.
    EdgeRuntime.waitUntil(
      runBackfill(supabase, creds, tenantId, period).catch(async (err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[${tenantId}] Backfill ${period} failed:`, errMsg);
        await supabase
          .from("cuts_history_backfill")
          .update({ status: "error", error_message: errMsg, completed_at: new Date().toISOString() })
          .eq("period", period)
          .eq("tenant_id", tenantId);
      }),
    );

    return new Response(
      JSON.stringify({ success: true, period, tenant_id: tenantId, status: "loading" }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Backfill error:", errMsg);
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const body = await req.clone().json().catch(() => ({}));
      // Try to scope the error update to the tenant if we can recover it from the JWT
      const authHeader = req.headers.get("Authorization");
      let tenantId: string | null = null;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const userClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
          );
          const { data: u } = await userClient.auth.getUser();
          const uid = u?.user?.id;
          if (uid) {
            const { data: p } = await supabase.from("profiles").select("tenant_id").eq("id", uid).single();
            tenantId = (p?.tenant_id as string | null) ?? null;
          }
        } catch (_) { /* ignore */ }
      }
      if (body.period && tenantId) {
        await supabase
          .from("cuts_history_backfill")
          .update({ status: "error", error_message: errMsg })
          .eq("period", body.period)
          .eq("tenant_id", tenantId);
      }
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
