import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CUTABC_BASE = "http://www.cutabc.cn:8091/cut_app/app";

interface CutABCDevice {
  fixno: string;
  fixna: string;
  branna: string;
  statena2: string;
  useqty: string;
  balaqty: string;
  latestOnlineTime: string;
  ipAddr: string;
  userName: string;
  userMobile: string;
  userEmail: string;
  useTime: string;
  createdt: string;
  remark: string;
  [key: string]: unknown;
}

interface TenantCredentials {
  tenant_id: string;
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

async function fetchAllDevices(sessionId: string): Promise<CutABCDevice[]> {
  const allDevices: CutABCDevice[] = [];
  let pageIndex = 1;
  const pageSize = 100;

  while (true) {
    const res = await fetch(`${CUTABC_BASE}/reportSetting/getMastinfo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        sessionId: sessionId,
      },
      body: new URLSearchParams({
        itemno: "fixlstqry",
        data: "[]",
        pageindex: String(pageIndex),
        pagesize: String(pageSize),
      }),
    });

    const data = await res.json();
    if (data.success !== "1" || !data.listTask) break;

    allDevices.push(...data.listTask);
    if (allDevices.length >= parseInt(data.reccnt)) break;
    pageIndex++;
  }

  return allDevices;
}

async function fetchAllTransactions(sessionId: string): Promise<Record<string, unknown>[]> {
  const allTx: Record<string, unknown>[] = [];
  let pageIndex = 1;
  const pageSize = 100;

  while (true) {
    const res = await fetch(`${CUTABC_BASE}/reportSetting/getMastinfo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        sessionId: sessionId,
      },
      body: new URLSearchParams({
        itemno: "custbalaqry",
        data: JSON.stringify([
          { billdate_beg: "" },
          { billdate_end: "" },
          { branna: "" },
          { fixno: "" },
        ]),
        pageindex: String(pageIndex),
        pagesize: String(pageSize),
      }),
    });

    const data = await res.json();
    if (data.success !== "1" || !data.listTask) break;

    allTx.push(...data.listTask);
    if (allTx.length >= parseInt(data.reccnt)) break;
    pageIndex++;
  }

  return allTx;
}

async function syncTenant(
  supabase: ReturnType<typeof createClient>,
  creds: TenantCredentials
) {
  const tenantId = creds.tenant_id;
  console.log(`[${tenantId}] Logging in to CutABC...`);
  const sessionId = await loginCutABC(creds);
  console.log(`[${tenantId}] Login successful`);

  // Fetch all devices
  console.log(`[${tenantId}] Fetching devices...`);
  const allDevices = await fetchAllDevices(sessionId);
  console.log(`[${tenantId}] Fetched ${allDevices.length} devices`);

  // Upsert devices
  const upsertData = allDevices.map((d) => ({
    fixno: d.fixno,
    branch_name: d.fixna || null,
    customer_name: d.branna || null,
    status: d.statena2 || "unknown",
    total_cuts: parseInt(d.useqty) || 0,
    remaining_cuts: parseInt(d.balaqty) || 0,
    ip_address: d.ipAddr || null,
    latest_online_time: d.latestOnlineTime
      ? new Date(d.latestOnlineTime.replace(" ", "T")).toISOString()
      : null,
    contact_name: d.userName || null,
    contact_phone: d.userMobile || null,
    raw_data: d,
    last_synced_at: new Date().toISOString(),
    tenant_id: tenantId,
  }));

  if (upsertData.length > 0) {
    for (let i = 0; i < upsertData.length; i += 50) {
      const chunk = upsertData.slice(i, i + 50);
      const { error } = await supabase
        .from("devices")
        .upsert(chunk, { onConflict: "fixno" });
      if (error) throw new Error(`Upsert failed at chunk ${i}: ${error.message}`);
    }
  }

  // Daily snapshot with daily_cuts calculation
  const now = new Date();
  const chileOffset = -3;
  const chileNow = new Date(now.getTime() + chileOffset * 3600000);
  const today = chileNow.toISOString().split("T")[0];

  const yesterday = new Date(chileNow);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const fixnos = allDevices.map((d) => d.fixno);
  const { data: yesterdayData } = await supabase
    .from("device_cuts_history")
    .select("fixno, total_cuts")
    .eq("cut_date", yesterdayStr)
    .in("fixno", fixnos);

  const yesterdayMap = new Map<string, number>();
  if (yesterdayData) {
    yesterdayData.forEach((r: any) => yesterdayMap.set(r.fixno, r.total_cuts));
  }

  const historyData = allDevices.map((d) => {
    const currentTotal = parseInt(d.useqty) || 0;
    const prevTotal = yesterdayMap.get(d.fixno);
    const dailyCuts = prevTotal !== undefined ? Math.max(0, currentTotal - prevTotal) : 0;
    return {
      fixno: d.fixno,
      cut_date: today,
      total_cuts: currentTotal,
      daily_cuts: dailyCuts,
      tenant_id: tenantId,
    };
  });

  if (historyData.length > 0) {
    for (let i = 0; i < historyData.length; i += 50) {
      const chunk = historyData.slice(i, i + 50);
      const { error } = await supabase
        .from("device_cuts_history")
        .upsert(chunk, { onConflict: "fixno,cut_date" });
      if (error) console.error(`[${tenantId}] History upsert error: ${error.message}`);
    }
  }
  console.log(`[${tenantId}] Saved ${historyData.length} daily snapshots for ${today}`);

  // Sync transactions
  console.log(`[${tenantId}] Fetching transactions...`);
  const allTransactions = await fetchAllTransactions(sessionId);
  console.log(`[${tenantId}] Fetched ${allTransactions.length} transactions`);

  const txData = allTransactions.map((t: Record<string, unknown>) => ({
    fixno: t.fixno as string,
    bill_no: t.billno as string,
    bill_date: t.billdate ? new Date((t.billdate as string).replace(" ", "T")).toISOString() : null,
    transaction_type: ((t.balakindna2 as string) || "").trim() || null,
    quantity: parseInt(t.busiqty2 as string) || 0,
    balance_after: parseInt(t.balaqty as string) || null,
    customer_name: (t.branna as string) || null,
    branch_name: (t.fixna as string) || null,
    creator: (t.creater as string) || null,
    remark: (t.remark as string) || null,
    audit_date: t.auditdt ? new Date((t.auditdt as string).replace(" ", "T")).toISOString() : null,
    raw_data: t,
    tenant_id: tenantId,
  }));

  let txSynced = 0;
  if (txData.length > 0) {
    for (let i = 0; i < txData.length; i += 50) {
      const chunk = txData.slice(i, i + 50);
      const { error } = await supabase
        .from("device_transactions")
        .upsert(chunk, { onConflict: "fixno,bill_no" });
      if (error) {
        console.error(`[${tenantId}] Transaction upsert error: ${error.message}`);
      } else {
        txSynced += chunk.length;
      }
    }
  }
  console.log(`[${tenantId}] Synced ${txSynced} transactions`);

  return {
    tenant_id: tenantId,
    devices_synced: allDevices.length,
    history_saved: historyData.length,
    transactions_synced: txSynced,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all tenants with CutABC credentials configured
    const { data: tenantSettings, error: tsErr } = await supabase
      .from("tenant_settings")
      .select("tenant_id, cutabc_company_no, cutabc_username, cutabc_password")
      .not("cutabc_company_no", "is", null)
      .not("cutabc_username", "is", null)
      .not("cutabc_password", "is", null);

    if (tsErr) throw tsErr;

    if (!tenantSettings || tenantSettings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No tenants with CutABC credentials configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`Found ${tenantSettings.length} tenant(s) to sync`);

    const results = [];
    for (const ts of tenantSettings) {
      try {
        const result = await syncTenant(supabase, ts as TenantCredentials);
        results.push(result);
      } catch (error: any) {
        console.error(`Error syncing tenant ${ts.tenant_id}: ${error.message}`);
        results.push({ tenant_id: ts.tenant_id, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenants_synced: results.length,
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
