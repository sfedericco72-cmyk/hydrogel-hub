import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CUTABC_BASE = "http://www.cutabc.cn:8091/cut_app/app";

// Los cortes hechos con el equipo offline llegan a CutABC con la fecha de
// reconexión, así que no hace falta una ventana larga. 2 días cubren hoy +
// ayer y dan colchón si el cron diario falla una vez.
const SYNC_WINDOW_DAYS = 2;
const TENANT_TIMEOUT_MS = 120_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

function cutabcDate(d: Date): string {
  // CutABC expects "YYYY-MM-DD" based on existing usage of billdate strings.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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
  const pageSize = 500;

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
    const total = parseInt(data.reccnt) || allDevices.length;
    console.log(`  devices page ${pageIndex}: ${allDevices.length}/${total}`);
    if (allDevices.length >= total) break;
    pageIndex++;
  }

  return allDevices;
}

async function fetchAllTransactions(
  sessionId: string,
  tenantLabel: string,
  brannas: string[],
): Promise<Record<string, unknown>[]> {
  const pageSize = 500;

  // Only fetch the last SYNC_WINDOW_DAYS days. Older history is loaded via backfill-cuts-history.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - SYNC_WINDOW_DAYS);
  const billdateBeg = cutabcDate(since);

  // CutABC partitions data internally by `branna`. Without a branna filter, the
  // API returns only aggregate/distribution rows and hides per-device "Consume"
  // transactions. We iterate by branna (auto-discovered from the device list)
  // and merge results, deduping by (fixno, billno).
  const targets = brannas.length > 0 ? brannas : [""];
  console.log(
    `[${tenantLabel}] Tx window: from ${billdateBeg} (last ${SYNC_WINDOW_DAYS}d), brannas: [${targets.join(", ")}]`,
  );

  const seen = new Set<string>();
  const allTx: Record<string, unknown>[] = [];

  for (const branna of targets) {
    let pageIndex = 1;
    let brannaCount = 0;
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
            { billdate_beg: billdateBeg },
            { billdate_end: "" },
            { branna: branna },
            { fixno: "" },
          ]),
          pageindex: String(pageIndex),
          pagesize: String(pageSize),
        }),
      });

      const data = await res.json();
      if (data.success !== "1" || !data.listTask) break;

      const items = data.listTask as Record<string, unknown>[];
      for (const tx of items) {
        const key = `${tx.fixno ?? ""}|${tx.billno ?? ""}`;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        allTx.push(tx);
      }
      brannaCount += items.length;

      const total = parseInt(data.reccnt) || brannaCount;
      console.log(`[${tenantLabel}] Tx [${branna || "*"}] page ${pageIndex}: ${brannaCount}/${total}`);
      if (brannaCount >= total) break;
      pageIndex++;
    }
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

  // Auto-discover the brannas this user can see in CutABC. Used only as an
  // internal sync mechanism — not exposed to CutMonitor users.
  const brannas = Array.from(
    new Set(allDevices.map((d) => (d.branna || "").trim()).filter((b) => b.length > 0)),
  );
  console.log(`[${tenantId}] Detected ${brannas.length} branna(s): [${brannas.join(", ")}]`);

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
        .upsert(chunk, { onConflict: "fixno,tenant_id" });
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
  // Use the most recent known `total_cuts > 0` (within the 90-day daily
  // window) as the previous baseline. Falling back to "yesterday only"
  // breaks when migrated rows or missed syncs leave `total_cuts = 0`,
  // which would make today's daily_cuts = full historical accumulator.
  const { data: prevData } = await supabase
    .from("device_cuts_daily")
    .select("fixno, total_cuts, cut_date")
    .eq("tenant_id", tenantId)
    .in("fixno", fixnos)
    .gt("total_cuts", 0)
    .lt("cut_date", today)
    .order("cut_date", { ascending: false });

  const prevTotalMap = new Map<string, number>();
  (prevData ?? []).forEach((r: any) => {
    if (!prevTotalMap.has(r.fixno)) prevTotalMap.set(r.fixno, r.total_cuts);
  });

  const historyData = allDevices.map((d) => {
    const currentTotal = parseInt(d.useqty) || 0;
    const prevTotal = prevTotalMap.get(d.fixno);
    // If we have no prior baseline (brand-new device), default daily_cuts to 0
    // to avoid recording the full historical accumulator as "today's cuts".
    const dailyCuts =
      prevTotal !== undefined ? Math.max(0, currentTotal - prevTotal) : 0;
    return {
      fixno: d.fixno,
      cut_date: today,
      total_cuts: currentTotal,
      daily_cuts: dailyCuts,
      tenant_id: tenantId,
    };
  });

  // SANITY CAP: a single hidrogel cutter realistically does at most ~150 cuts/day.
  // If we ever compute a daily_cuts beyond SANITY_DAILY_CAP it almost certainly
  // means the previous baseline was wrong (e.g. backfill rows with total_cuts=0
  // hiding a real prior total). Force the value to 0 and log so we can audit.
  const SANITY_DAILY_CAP = 200;
  const safeHistoryData = historyData.map((r) => {
    if (r.daily_cuts > SANITY_DAILY_CAP) {
      console.warn(
        `[${tenantId}] SPIKE GUARD ${r.fixno} ${r.cut_date}: daily_cuts=${r.daily_cuts} > cap ${SANITY_DAILY_CAP} → forcing to 0`,
      );
      return { ...r, daily_cuts: 0 };
    }
    return r;
  });

  if (safeHistoryData.length > 0) {
    for (let i = 0; i < safeHistoryData.length; i += 50) {
      const chunk = safeHistoryData.slice(i, i + 50);
      const { error } = await supabase
        .from("device_cuts_daily")
        .upsert(chunk, { onConflict: "fixno,cut_date,tenant_id" });
      if (error) console.error(`[${tenantId}] History upsert error: ${error.message}`);
    }
  }
  console.log(`[${tenantId}] Saved ${safeHistoryData.length} daily snapshots for ${today}`);

  // Increment monthly aggregate for the current month with today's daily_cuts.
  // We re-fetch the canonical monthly total from device_cuts_daily (current
  // month-to-date) instead of doing a += because the same day may sync
  // multiple times — using a sum from daily is idempotent.
  const yearMonth = today.substring(0, 7);
  const monthStart = `${yearMonth}-01`;
  const { data: mtdData } = await supabase
    .from("device_cuts_daily")
    .select("fixno, daily_cuts")
    .eq("tenant_id", tenantId)
    .gte("cut_date", monthStart)
    .gt("daily_cuts", 0);

  const mtdMap = new Map<string, number>();
  (mtdData ?? []).forEach((r: any) => {
    mtdMap.set(r.fixno, (mtdMap.get(r.fixno) ?? 0) + (r.daily_cuts ?? 0));
  });

  const monthlyRows = Array.from(mtdMap.entries()).map(([fixno, total_cuts]) => ({
    tenant_id: tenantId,
    fixno,
    year_month: yearMonth,
    total_cuts,
  }));

  // SANITY CAP: a single month's total cannot exceed the device's all-time
  // accumulator (useqty). If it does, the daily series for this month is
  // corrupted — cap to the device total so downstream views stay sane.
  const totalByFixno = new Map<string, number>(
    allDevices.map((d) => [d.fixno, parseInt(d.useqty) || 0]),
  );
  const safeMonthlyRows = monthlyRows.map((r) => {
    const cap = totalByFixno.get(r.fixno);
    if (cap !== undefined && r.total_cuts > cap) {
      console.error(
        `[${tenantId}] MONTHLY ANOMALY ${r.fixno} ${r.year_month}: ${r.total_cuts} > device total ${cap} → capping`,
      );
      return { ...r, total_cuts: cap };
    }
    return r;
  });

  if (safeMonthlyRows.length > 0) {
    for (let i = 0; i < safeMonthlyRows.length; i += 100) {
      const chunk = safeMonthlyRows.slice(i, i + 100);
      const { error } = await supabase
        .from("device_cuts_monthly")
        .upsert(chunk, { onConflict: "tenant_id,fixno,year_month" });
      if (error) console.error(`[${tenantId}] Monthly upsert error: ${error.message}`);
    }
    console.log(`[${tenantId}] Updated ${safeMonthlyRows.length} monthly aggregates for ${yearMonth}`);
  }

  // Sync transactions
  console.log(`[${tenantId}] Fetching transactions...`);
  const allTransactions = await fetchAllTransactions(sessionId, tenantId, brannas);
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
    summary: (t.summary as string) || null,
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
        .upsert(chunk, { onConflict: "fixno,bill_no,tenant_id" });
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

    // Process tenants in parallel with a per-tenant timeout so one slow/failing
    // tenant does not block the rest.
    const settled = await Promise.allSettled(
      tenantSettings.map((ts) =>
        withTimeout(
          syncTenant(supabase, ts as TenantCredentials),
          TENANT_TIMEOUT_MS,
          `tenant ${ts.tenant_id}`,
        ),
      ),
    );

    const results = settled.map((r, i) => {
      const tenantId = (tenantSettings[i] as TenantCredentials).tenant_id;
      if (r.status === "fulfilled") {
        return { ...r.value, status: "ok" as const };
      }
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.error(`Error syncing tenant ${tenantId}: ${msg}`);
      return { tenant_id: tenantId, status: "error" as const, error: msg };
    });

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
