import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CUTABC_BASE = "http://www.cutabc.cn:8091/cut_app/app";

interface CutABCDevice {
  fixno: string;
  branna: string;
  statena2: string;
  useqty: number;
  balaqty: number;
  latestOnlineTime: string;
  fixip: string;
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

  const text = await res.text();
  console.log("Login response status:", res.status, "body preview:", text.substring(0, 200));
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`CutABC login returned non-JSON (status ${res.status}): ${text.substring(0, 300)}`);
  }
  if (!data.sessionId) {
    throw new Error(`CutABC login failed: ${JSON.stringify(data)}`);
  }
  return data.sessionId;
}

async function fetchDevices(sessionId: string): Promise<CutABCDevice[]> {
  const res = await fetch(`${CUTABC_BASE}/reportSetting/getMastinfo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: `JSESSIONID=${sessionId}`,
    },
    body: new URLSearchParams({
      itemno: "fixlstqry",
      page: "1",
      rows: "500",
    }),
  });

  const data = await res.json();
  return data.rows || [];
}

function isActiveInLast30Days(device: CutABCDevice): boolean {
  if (!device.latestOnlineTime) return false;
  const lastOnline = new Date(device.latestOnlineTime);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return lastOnline >= thirtyDaysAgo;
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
    const allDevices = await fetchDevices(sessionId);
    console.log(`Fetched ${allDevices.length} total devices`);

    // 3. Filter: only devices active in last 30 days
    const activeDevices = allDevices.filter(isActiveInLast30Days);
    console.log(`${activeDevices.length} devices active in last 30 days`);

    // 4. Upsert to database
    const upsertData = activeDevices.map((d) => ({
      fixno: d.fixno,
      branch_name: d.branna || null,
      customer_name: d.branna || null,
      status: d.statena2 || "unknown",
      total_cuts: d.useqty || 0,
      remaining_cuts: d.balaqty || 0,
      latest_online_time: d.latestOnlineTime || null,
      ip_address: d.fixip || null,
      raw_data: d,
      last_synced_at: new Date().toISOString(),
    }));

    if (upsertData.length > 0) {
      const { error } = await supabase
        .from("devices")
        .upsert(upsertData, { onConflict: "fixno" });

      if (error) {
        throw new Error(`Upsert failed: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_fetched: allDevices.length,
        active_synced: activeDevices.length,
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
