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
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { companyNo, username, password } = body;

    if (!companyNo || !username || !password) {
      return new Response(
        JSON.stringify({ valid: false, error: "Faltan campos requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try login to CutABC
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
      return new Response(
        JSON.stringify({
          valid: false,
          error: data.msg || "Credenciales inválidas o empresa incorrecta",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count devices to give feedback
    let deviceCount = 0;
    try {
      const devRes = await fetch(`${CUTABC_BASE}/reportSetting/getMastinfo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          sessionId: data.data.sessionId,
        },
        body: new URLSearchParams({
          itemno: "fixlstqry",
          data: "[]",
          pageindex: "1",
          pagesize: "1",
        }),
      });
      const devData = await devRes.json();
      deviceCount = parseInt(devData.reccnt) || 0;
    } catch {
      // Non-critical
    }

    return new Response(
      JSON.stringify({ valid: true, deviceCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
