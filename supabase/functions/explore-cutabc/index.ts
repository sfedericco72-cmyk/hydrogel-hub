import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const companyNo = Deno.env.get("CUTABC_COMPANY_NUMBER")!;
    const username = Deno.env.get("CUTABC_USERNAME")!;
    const password = Deno.env.get("CUTABC_PASSWORD")!;

    // Login
    const loginRes = await fetch(`${CUTABC_BASE}/Register/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ companyNo, userName: username, userPwd: password }),
    });
    const loginData = await loginRes.json();
    const sessionId = loginData.data.sessionId;

    const results: Record<string, unknown> = {};
    
    // Try multiple itemno values to discover endpoints
    const itemNos = ["fixbalaqty", "fixuseqty", "fixuselog"];
    
    for (const itemno of itemNos) {
      try {
        const res = await fetch(`${CUTABC_BASE}/reportSetting/getMastinfo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            sessionId,
          },
          body: new URLSearchParams({
            itemno,
            data: "[]",
            pageindex: "1",
            pagesize: "3",
          }),
        });
        const data = await res.json();
        results[itemno] = {
          success: data.success,
          reccnt: data.reccnt,
          keys: Object.keys(data),
          firstRecordKeys: data.listTask?.[0] ? Object.keys(data.listTask[0]) : null,
          firstRecord: data.listTask?.[0] || null,
          rawPreview: !data.listTask ? JSON.stringify(data).substring(0, 500) : undefined,
        };
      } catch (e) {
        results[itemno] = { error: e.message };
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
