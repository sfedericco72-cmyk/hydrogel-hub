const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CUTABC_BASE = "http://www.cutabc.cn:8091/cut_app/app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const itemno = url.searchParams.get("itemno") || "fixbalaqty";
    
    // Login
    const loginRes = await fetch(`${CUTABC_BASE}/Register/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        companyNo: Deno.env.get("CUTABC_COMPANY_NUMBER")!,
        userName: Deno.env.get("CUTABC_USERNAME")!,
        userPwd: Deno.env.get("CUTABC_PASSWORD")!,
      }),
    });
    const sid = (await loginRes.json()).data.sessionId;

    const billdate_beg = url.searchParams.get("from") || "";
    const billdate_end = url.searchParams.get("to") || "";
    const fixno = url.searchParams.get("fixno") || "";
    const dataArr = [
      { billdate_beg },
      { billdate_end },
      { branna: "" },
      { fixno },
    ];

    const res = await fetch(`${CUTABC_BASE}/reportSetting/getMastinfo`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", sessionId: sid },
      body: new URLSearchParams({ itemno, data: JSON.stringify(dataArr), pageindex: "1", pagesize: "5" }),
    });
    const data = await res.json();

    return new Response(JSON.stringify({
      itemno,
      success: data.success,
      reccnt: data.reccnt,
      keys: Object.keys(data),
      firstRecordKeys: data.listTask?.[0] ? Object.keys(data.listTask[0]) : null,
      firstRecord: data.listTask?.[0] || null,
      raw: !data.listTask ? JSON.stringify(data).substring(0, 1000) : undefined,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
