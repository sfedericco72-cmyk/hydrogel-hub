import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CUTABC_BASE = "http://www.cutabc.cn:8091/cut_app/app";

async function loginCutABC(): Promise<string> {
  const res = await fetch(`${CUTABC_BASE}/Register/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      companyNo: Deno.env.get("CUTABC_COMPANY_NUMBER")!,
      userName: Deno.env.get("CUTABC_USERNAME")!,
      userPwd: Deno.env.get("CUTABC_PASSWORD")!,
    }),
  });
  const data = await res.json();
  if (data.code != 0 || !data.data?.sessionId) {
    throw new Error(`CutABC login failed: ${JSON.stringify(data)}`);
  }
  return data.data.sessionId;
}

async function fetchTransactionsForPeriod(
  sessionId: string,
  from: string,
  to: string
): Promise<Record<string, unknown>[]> {
  // First request to get total count
  const firstRes = await fetch(`${CUTABC_BASE}/reportSetting/getMastinfo`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", sessionId },
    body: new URLSearchParams({
      itemno: "fixbalaqty",
      data: JSON.stringify([{ billdate_beg: from }, { billdate_end: to }, { branna: "" }, { fixno: "" }]),
      pageindex: "1",
      pagesize: "1000",
    }),
  });
  const firstData = await firstRes.json();
  if (firstData.success !== "1" || !firstData.listTask) return [];

  const total = parseInt(firstData.reccnt);
  const all: Record<string, unknown>[] = [...firstData.listTask];
  console.log(`Page 1: fetched ${all.length}/${total}`);

  if (all.length >= total) return all;

  // Fetch remaining pages in parallel
  const pageSize = 1000;
  const remainingPages = Math.ceil((total - pageSize) / pageSize);
  const promises = [];
  for (let i = 0; i < remainingPages; i++) {
    const pageIndex = i + 2;
    promises.push(
      fetch(`${CUTABC_BASE}/reportSetting/getMastinfo`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", sessionId },
        body: new URLSearchParams({
          itemno: "fixbalaqty",
          data: JSON.stringify([{ billdate_beg: from }, { billdate_end: to }, { branna: "" }, { fixno: "" }]),
          pageindex: String(pageIndex),
          pagesize: String(pageSize),
        }),
      }).then(r => r.json()).then(d => {
        if (d.success === "1" && d.listTask) {
          console.log(`Page ${pageIndex}: fetched ${d.listTask.length}`);
          return d.listTask as Record<string, unknown>[];
        }
        return [];
      })
    );
  }

  const results = await Promise.all(promises);
  for (const r of results) all.push(...r);

  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { period } = await req.json();
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return new Response(
        JSON.stringify({ error: "period must be YYYY-MM format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Mark as loading
    await supabase
      .from("cuts_history_backfill")
      .upsert(
        { period, status: "loading", started_at: new Date().toISOString(), error_message: null, records_loaded: 0 },
        { onConflict: "period" }
      );

    // Calculate date range — split into two halves to avoid timeout
    const [year, month] = period.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const midDay = 15;
    
    const ranges = [
      { from: `${period}-01`, to: `${period}-${String(midDay).padStart(2, "0")}` },
      { from: `${period}-${String(midDay + 1).padStart(2, "0")}`, to: `${period}-${String(lastDay).padStart(2, "0")}` },
    ];

    console.log(`Backfilling ${period} in 2 halves`);

    // Login & fetch both halves
    const sessionId = await loginCutABC();
    const allTransactions: Record<string, unknown>[] = [];
    for (const range of ranges) {
      console.log(`Fetching ${range.from} to ${range.to}...`);
      const txs = await fetchTransactionsForPeriod(sessionId, range.from, range.to);
      allTransactions.push(...txs);
    }
    const transactions = allTransactions;
    console.log(`Fetched ${transactions.length} total transactions for ${period}`);

    // Group by fixno + date → count "Consume" cuts
    const dailyMap = new Map<string, { fixno: string; date: string; cuts: number }>();

    for (const tx of transactions) {
      const kind = ((tx.balakindna2 as string) || "").trim();
      if (kind !== "Consume") continue;

      const fixno = tx.fixno as string;
      const billdate = tx.billdate as string;
      if (!fixno || !billdate) continue;

      const date = billdate.substring(0, 10); // YYYY-MM-DD
      const key = `${fixno}|${date}`;
      const qty = parseInt(tx.busiqty2 as string) || 1;

      const existing = dailyMap.get(key);
      if (existing) {
        existing.cuts += qty;
      } else {
        dailyMap.set(key, { fixno, date, cuts: qty });
      }
    }

    console.log(`Aggregated into ${dailyMap.size} daily records`);

    // We need total_cuts for each record. Get current device totals and work backwards.
    // Since we don't have historical totals, we'll set total_cuts = 0 and daily_cuts = aggregated cuts.
    // The daily_cuts is what matters for attach rate calculations.
    const historyData = Array.from(dailyMap.values()).map((d) => ({
      fixno: d.fixno,
      cut_date: d.date,
      total_cuts: 0, // historical total unknown, daily_cuts is what matters
      daily_cuts: d.cuts,
    }));

    // Upsert in chunks
    let inserted = 0;
    for (let i = 0; i < historyData.length; i += 50) {
      const chunk = historyData.slice(i, i + 50);
      const { error } = await supabase
        .from("device_cuts_history")
        .upsert(chunk, { onConflict: "fixno,cut_date" });

      if (error) {
        console.error(`Upsert error at chunk ${i}: ${error.message}`);
        throw new Error(`Upsert failed: ${error.message}`);
      }
      inserted += chunk.length;
    }

    // Mark as done
    await supabase
      .from("cuts_history_backfill")
      .update({
        status: "done",
        records_loaded: inserted,
        completed_at: new Date().toISOString(),
      })
      .eq("period", period);

    console.log(`Backfill complete: ${inserted} records for ${period}`);

    return new Response(
      JSON.stringify({ success: true, period, records: inserted, transactions: transactions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Backfill error:", error);

    // Try to mark as error
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { period } = await req.clone().json().catch(() => ({ period: null }));
      if (period) {
        await supabase
          .from("cuts_history_backfill")
          .update({ status: "error", error_message: error.message })
          .eq("period", period);
      }
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
