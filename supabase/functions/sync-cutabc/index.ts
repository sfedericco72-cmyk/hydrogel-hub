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

async function loginCutABC(): Promise<string> {
  const companyNo = Deno.env.get("CUTABC_COMPANY_NUMBER")!;
  const username = Deno.env.get("CUTABC_USERNAME")!;
  const password = Deno.env.get("CUTABC_PASSWORD")!;

  const res = await fetch(`${CUTABC_BASE}/Register/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      companyNo,
      userName: username,
      userPwd: password,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Login to CutABC
    console.log("Logging in to CutABC...");
    const sessionId = await loginCutABC();
    console.log("Login successful");

    // 2. Fetch all devices
    console.log("Fetching devices...");
    const allDevices = await fetchAllDevices(sessionId);
    console.log(`Fetched ${allDevices.length} total devices`);

    // 3. Sync ALL devices (no filter)
    const activeDevices = allDevices;
    console.log(`Syncing all ${activeDevices.length} devices`);

    // 4. Upsert to database
    const upsertData = activeDevices.map((d) => ({
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
    }));

    if (upsertData.length > 0) {
      // Batch upsert in chunks of 50
      for (let i = 0; i < upsertData.length; i += 50) {
        const chunk = upsertData.slice(i, i + 50);
        const { error } = await supabase
          .from("devices")
          .upsert(chunk, { onConflict: "fixno" });

        if (error) {
          throw new Error(`Upsert failed at chunk ${i}: ${error.message}`);
        }
      }
    }

    // 5. Save daily snapshot to cuts history with daily_cuts calculation
    // Use Chile time (UTC-3 in summer / UTC-4 in winter, approximate UTC-3)
    const now = new Date();
    const chileOffset = -3; // approximate CLT/CLST
    const chileNow = new Date(now.getTime() + chileOffset * 3600000);
    const today = chileNow.toISOString().split("T")[0];

    // Get yesterday's date for daily_cuts calculation
    const yesterday = new Date(chileNow);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Fetch yesterday's snapshots to calculate daily difference
    const fixnos = activeDevices.map((d) => d.fixno);
    const { data: yesterdayData } = await supabase
      .from("device_cuts_history")
      .select("fixno, total_cuts")
      .eq("cut_date", yesterdayStr)
      .in("fixno", fixnos);

    const yesterdayMap = new Map<string, number>();
    if (yesterdayData) {
      yesterdayData.forEach((r) => yesterdayMap.set(r.fixno, r.total_cuts));
    }

    const historyData = activeDevices.map((d) => {
      const currentTotal = parseInt(d.useqty) || 0;
      const prevTotal = yesterdayMap.get(d.fixno);
      const dailyCuts = prevTotal !== undefined ? Math.max(0, currentTotal - prevTotal) : 0;
      return {
        fixno: d.fixno,
        cut_date: today,
        total_cuts: currentTotal,
        daily_cuts: dailyCuts,
      };
    });

    if (historyData.length > 0) {
      for (let i = 0; i < historyData.length; i += 50) {
        const chunk = historyData.slice(i, i + 50);
        const { error } = await supabase
          .from("device_cuts_history")
          .upsert(chunk, { onConflict: "fixno,cut_date" });

        if (error) {
          console.error(`History upsert error at chunk ${i}: ${error.message}`);
        }
      }
    }
    console.log(`Saved ${historyData.length} daily snapshots for ${today} (with daily_cuts)`);

    return new Response(
      JSON.stringify({
        success: true,
        total_fetched: allDevices.length,
        active_synced: activeDevices.length,
        history_saved: historyData.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
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
