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

async function fetchAllPages(
  sessionId: string,
  from: string,
  to: string
): Promise<{ transactions: Record<string, unknown>[]; expected: number }> {
  const pageSize = 1000;

  // First page to get reccnt
  const firstRes = await fetch(`${CUTABC_BASE}/reportSetting/getMastinfo`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", sessionId },
    body: new URLSearchParams({
      itemno: "fixbalaqty",
      data: JSON.stringify([{ billdate_beg: from }, { billdate_end: to }, { branna: "" }, { fixno: "" }]),
      pageindex: "1",
      pagesize: String(pageSize),
    }),
  });
  const firstData = await firstRes.json();
  if (firstData.success !== "1" || !firstData.listTask) return { transactions: [], expected: 0 };

  const expected = parseInt(firstData.reccnt);
  const all: Record<string, unknown>[] = [...firstData.listTask];
  console.log(`  [${from}→${to}] Page 1: ${all.length}/${expected}`);

  if (all.length >= expected) return { transactions: all, expected };

  // Remaining pages in parallel
  const totalPages = Math.ceil(expected / pageSize);
  const promises = [];
  for (let p = 2; p <= totalPages; p++) {
    promises.push(
      fetch(`${CUTABC_BASE}/reportSetting/getMastinfo`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", sessionId },
        body: new URLSearchParams({
          itemno: "fixbalaqty",
          data: JSON.stringify([{ billdate_beg: from }, { billdate_end: to }, { branna: "" }, { fixno: "" }]),
          pageindex: String(p),
          pagesize: String(pageSize),
        }),
      }).then(r => r.json()).then(d => {
        const items = (d.success === "1" && d.listTask) ? d.listTask as Record<string, unknown>[] : [];
        console.log(`  [${from}→${to}] Page ${p}: ${items.length}`);
        return items;
      })
    );
  }

  const results = await Promise.all(promises);
  for (const r of results) all.push(...r);

  return { transactions: all, expected };
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

    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub as string;

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

    // Full month range
    const [year, month] = period.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const from = `${period}-01`;
    const to = `${period}-${String(lastDay).padStart(2, "0")}`;

    // Split into two halves (API can be slow with large date ranges)
    const mid = 15;
    const ranges = [
      { from, to: `${period}-${String(mid).padStart(2, "0")}` },
      { from: `${period}-${String(mid + 1).padStart(2, "0")}`, to },
    ];

    console.log(`[${tenantId}] Backfilling ${period}: ${from} → ${to} (${lastDay} days, 2 halves)`);

    const sessionId = await loginCutABC(creds);

    // Fetch both halves
    let totalExpected = 0;
    const allTransactions: Record<string, unknown>[] = [];
    for (const range of ranges) {
      const result = await fetchAllPages(sessionId, range.from, range.to);
      allTransactions.push(...result.transactions);
      totalExpected += result.expected;
    }

    console.log(`Fetched ${allTransactions.length} transactions (expected ${totalExpected})`);

    // Deduplicate by billno
    const seen = new Set<string>();
    const uniqueTransactions: Record<string, unknown>[] = [];
    let dupes = 0;
    for (const tx of allTransactions) {
      const billno = tx.billno as string;
      if (!billno || seen.has(billno)) {
        dupes++;
        continue;
      }
      seen.add(billno);
      uniqueTransactions.push(tx);
    }
    if (dupes > 0) console.log(`Removed ${dupes} duplicates by billno`);

    // Separate Consume vs other types
    let consumeCount = 0;
    let otherCount = 0;
    const dailyMap = new Map<string, { fixno: string; date: string; cuts: number }>();

    for (const tx of uniqueTransactions) {
      const kind = ((tx.balakindna2 as string) || "").trim();
      if (kind !== "Consume") {
        otherCount++;
        continue;
      }
      consumeCount++;

      const fixno = tx.fixno as string;
      const billdate = tx.billdate as string;
      if (!fixno || !billdate) continue;

      const date = billdate.substring(0, 10);
      const key = `${fixno}|${date}`;
      const qty = parseInt(tx.busiqty2 as string) || 1;

      const existing = dailyMap.get(key);
      if (existing) {
        existing.cuts += qty;
      } else {
        dailyMap.set(key, { fixno, date, cuts: qty });
      }
    }

    console.log(`Consume: ${consumeCount}, Other: ${otherCount}, Daily records: ${dailyMap.size}`);

    const historyData = Array.from(dailyMap.values()).map((d) => ({
      fixno: d.fixno,
      cut_date: d.date,
      total_cuts: 0,
      daily_cuts: d.cuts,
      tenant_id: tenantId,
    }));

    // Upsert in chunks
    let inserted = 0;
    for (let i = 0; i < historyData.length; i += 50) {
      const chunk = historyData.slice(i, i + 50);
      const { error } = await supabase
        .from("device_cuts_history")
        .upsert(chunk, { onConflict: "fixno,cut_date,tenant_id" });
      if (error) throw new Error(`Upsert failed: ${error.message}`);
      inserted += chunk.length;
    }

    // Mark as done
    await supabase
      .from("cuts_history_backfill")
      .update({
        status: "done",
        records_loaded: inserted,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("period", period)
      .eq("tenant_id", tenantId);

    const summary = {
      success: true,
      period,
      tenant_id: tenantId,
      total_transactions: uniqueTransactions.length,
      expected_transactions: totalExpected,
      consume_transactions: consumeCount,
      other_transactions: otherCount,
      duplicates_removed: dupes,
      daily_records: inserted,
      complete: uniqueTransactions.length >= totalExpected,
    };
    console.log(`[${tenantId}] Backfill complete:`, JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Backfill error:", error);
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
          const { data: claimsData } = await userClient.auth.getClaims(
            authHeader.replace("Bearer ", "")
          );
          const uid = claimsData?.claims?.sub as string | undefined;
          if (uid) {
            const { data: p } = await supabase.from("profiles").select("tenant_id").eq("id", uid).single();
            tenantId = (p?.tenant_id as string | null) ?? null;
          }
        } catch (_) { /* ignore */ }
      }
      if (body.period && tenantId) {
        await supabase
          .from("cuts_history_backfill")
          .update({ status: "error", error_message: error.message })
          .eq("period", body.period)
          .eq("tenant_id", tenantId);
      }
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
