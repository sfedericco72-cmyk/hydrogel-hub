import { createClient } from 'npm:@supabase/supabase-js@2'

const BCC_EMAIL = 'santiago.federico@bitec.cl'
const LOW_STOCK_DAYS_THRESHOLD = 7
const LOW_STOCK_FALLBACK_CUTS = 10
const DISCONNECTED_DAYS_THRESHOLD = 5

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 })
  }

  // Simple auth: check for service role or a shared secret
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  // Accept anon key or service role key
  if (token !== anonKey && token !== supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Load all non-stock devices with alert_email
  const { data: devices, error: devErr } = await supabase
    .from('devices')
    .select('id, fixno, branch_name, customer_name, remaining_cuts, latest_online_time, alert_email, status')

  if (devErr || !devices) {
    console.error('Failed to load devices', devErr)
    return new Response(JSON.stringify({ error: 'Failed to load devices' }), { status: 500 })
  }

  const now = Date.now()
  let alertsSent = 0

  for (const device of devices) {
    // Skip stock devices
    if (!device.branch_name || device.branch_name === device.fixno) continue
    // Flag for missing email — we'll check alerts and notify Santiago if needed
    const hasAlertEmail = !!device.alert_email

    // --- Calculate avg daily cuts ---
    const { data: history } = await supabase
      .from('device_cuts_history')
      .select('daily_cuts')
      .eq('fixno', device.fixno)
      .order('cut_date', { ascending: false })
      .limit(30)

    const dailyCuts = (history || [])
      .map(h => h.daily_cuts ?? 0)
      .filter(c => c > 0)

    const avgDailyCuts = dailyCuts.length > 0
      ? dailyCuts.reduce((a, b) => a + b, 0) / dailyCuts.length
      : 0

    const remaining = device.remaining_cuts ?? 0

    // --- Check LOW STOCK ---
    let isLowStock = false
    let estimatedDays: number | undefined

    if (avgDailyCuts > 0) {
      estimatedDays = Math.floor(remaining / avgDailyCuts)
      isLowStock = estimatedDays < LOW_STOCK_DAYS_THRESHOLD
    } else {
      isLowStock = remaining <= LOW_STOCK_FALLBACK_CUTS
    }

    if (isLowStock) {
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()

      if (!hasAlertEmail) {
        // No email configured — notify Santiago
        const { data: recentAlert } = await supabase
          .from('email_send_log')
          .select('id')
          .eq('template_name', 'email-no-configurado')
          .eq('recipient_email', BCC_EMAIL)
          .gte('created_at', oneDayAgo)
          .ilike('message_id', `%${device.fixno}%stock%`)
          .limit(1)

        if (!recentAlert?.length) {
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'email-no-configurado',
              recipientEmail: BCC_EMAIL,
              idempotencyKey: `no-email-stock-${device.fixno}-${new Date().toISOString().slice(0, 10)}`,
              templateData: {
                branchName: device.branch_name,
                fixno: device.fixno,
                customerName: device.customer_name,
                alertType: 'stock bajo',
              },
            },
          })
          alertsSent++
        }
      } else {
        const { data: recentAlert } = await supabase
          .from('email_send_log')
          .select('id')
          .eq('template_name', 'stock-bajo')
          .eq('recipient_email', device.alert_email)
          .gte('created_at', oneDayAgo)
          .limit(1)

        if (!recentAlert?.length) {
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'stock-bajo',
              recipientEmail: device.alert_email,
              idempotencyKey: `stock-bajo-${device.fixno}-${new Date().toISOString().slice(0, 10)}`,
              templateData: {
                branchName: device.branch_name,
                fixno: device.fixno,
                remainingCuts: remaining,
                estimatedDays,
              },
            },
          })
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'stock-bajo',
              recipientEmail: BCC_EMAIL,
              idempotencyKey: `stock-bajo-bcc-${device.fixno}-${new Date().toISOString().slice(0, 10)}`,
              templateData: {
                branchName: device.branch_name,
                fixno: device.fixno,
                remainingCuts: remaining,
                estimatedDays,
              },
            },
          })
          alertsSent++
        }
      }
    }

    // --- Check DISCONNECTED ---
    const onlineTime = device.latest_online_time
      ? new Date(device.latest_online_time).getTime()
      : 0

    const daysSinceOnline = onlineTime > 0
      ? Math.floor((now - onlineTime) / (1000 * 60 * 60 * 24))
      : 999

    if (daysSinceOnline >= DISCONNECTED_DAYS_THRESHOLD) {
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()

      if (!hasAlertEmail) {
        const { data: recentAlert } = await supabase
          .from('email_send_log')
          .select('id')
          .eq('template_name', 'email-no-configurado')
          .eq('recipient_email', BCC_EMAIL)
          .gte('created_at', oneDayAgo)
          .ilike('message_id', `%${device.fixno}%desconectado%`)
          .limit(1)

        if (!recentAlert?.length) {
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'email-no-configurado',
              recipientEmail: BCC_EMAIL,
              idempotencyKey: `no-email-desconectado-${device.fixno}-${new Date().toISOString().slice(0, 10)}`,
              templateData: {
                branchName: device.branch_name,
                fixno: device.fixno,
                customerName: device.customer_name,
                alertType: 'equipo desconectado',
              },
            },
          })
          alertsSent++
        }
      } else {
        const { data: recentAlert } = await supabase
          .from('email_send_log')
          .select('id')
          .eq('template_name', 'dispositivo-desconectado')
          .eq('recipient_email', device.alert_email)
          .gte('created_at', oneDayAgo)
          .limit(1)

        if (!recentAlert?.length) {
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'dispositivo-desconectado',
              recipientEmail: device.alert_email,
              idempotencyKey: `desconectado-${device.fixno}-${new Date().toISOString().slice(0, 10)}`,
              templateData: {
                branchName: device.branch_name,
                fixno: device.fixno,
                daysSinceOnline,
              },
            },
          })
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'dispositivo-desconectado',
              recipientEmail: BCC_EMAIL,
              idempotencyKey: `desconectado-bcc-${device.fixno}-${new Date().toISOString().slice(0, 10)}`,
              templateData: {
                branchName: device.branch_name,
                fixno: device.fixno,
                daysSinceOnline,
              },
            },
          })
          alertsSent++
        }
      }
    }
  }

  return new Response(JSON.stringify({ success: true, alerts_sent: alertsSent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
