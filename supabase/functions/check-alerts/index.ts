import { createClient } from 'npm:@supabase/supabase-js@2'

// Defaults — overridden by tenant_settings if available
let BCC_EMAIL = 'santiago.federico@bitec.cl'
let LOW_STOCK_DAYS_THRESHOLD = 7
const LOW_STOCK_FALLBACK_CUTS = 10
let DISCONNECTED_DAYS_THRESHOLD = 5
let ALERT_COOLDOWN_DAYS = 7
let ALERT_MAX_WINDOW_DAYS = 14

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 })
  }

  // Auth: accept anon key or service_role key from either env var name
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  const validKeys = [
    Deno.env.get('SUPABASE_ANON_KEY'),
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),
    supabaseServiceKey,
  ].filter(Boolean)
  if (!token || !validKeys.includes(token)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Load configurable thresholds from tenant_settings
  const { data: tenantSettings } = await supabase
    .from('tenant_settings')
    .select('bcc_email, low_stock_days, alert_cooldown_days, alert_max_window_days')
    .eq('tenant_name', 'default')
    .single()

  if (tenantSettings) {
    if (tenantSettings.bcc_email) BCC_EMAIL = tenantSettings.bcc_email
    LOW_STOCK_DAYS_THRESHOLD = tenantSettings.low_stock_days ?? LOW_STOCK_DAYS_THRESHOLD
    ALERT_COOLDOWN_DAYS = tenantSettings.alert_cooldown_days ?? ALERT_COOLDOWN_DAYS
    ALERT_MAX_WINDOW_DAYS = tenantSettings.alert_max_window_days ?? ALERT_MAX_WINDOW_DAYS
  }

  const { data: devices, error: devErr } = await supabase
    .from('devices')
    .select('id, fixno, branch_name, customer_name, remaining_cuts, latest_online_time, alert_email, status, alerts_enabled, first_alert_sent_at')

  if (devErr || !devices) {
    console.error('Failed to load devices', devErr)
    return new Response(JSON.stringify({ error: 'Failed to load devices' }), { status: 500 })
  }

  const now = Date.now()
  let alertsSent = 0

  for (const device of devices) {
    // Skip stock devices
    if (!device.branch_name || device.branch_name === device.fixno) continue
    // Skip devices with alerts disabled
    if (device.alerts_enabled === false) continue

    const hasAlertEmail = !!device.alert_email

    // --- Check if within the 2-week alert window ---
    if (device.first_alert_sent_at) {
      const firstAlertTime = new Date(device.first_alert_sent_at).getTime()
      const daysSinceFirst = (now - firstAlertTime) / (1000 * 60 * 60 * 24)
      if (daysSinceFirst > ALERT_MAX_WINDOW_DAYS) {
        // Window expired — auto-disable alerts for this device
        await supabase.from('devices').update({ alerts_enabled: false }).eq('id', device.id)
        continue
      }
    }

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
      const sent = await trySendAlert(supabase, device, 'stock-bajo', hasAlertEmail, now, {
        branchName: device.branch_name,
        fixno: device.fixno,
        remainingCuts: remaining,
        estimatedDays,
        customerName: device.customer_name,
      })
      if (sent) alertsSent++
    }

    // --- Check DISCONNECTED ---
    const onlineTime = device.latest_online_time
      ? new Date(device.latest_online_time).getTime()
      : 0

    const daysSinceOnline = onlineTime > 0
      ? Math.floor((now - onlineTime) / (1000 * 60 * 60 * 24))
      : 999

    if (daysSinceOnline >= DISCONNECTED_DAYS_THRESHOLD) {
      const sent = await trySendAlert(supabase, device, 'dispositivo-desconectado', hasAlertEmail, now, {
        branchName: device.branch_name,
        fixno: device.fixno,
        daysSinceOnline,
        customerName: device.customer_name,
      })
      if (sent) alertsSent++
    }
  }

  return new Response(JSON.stringify({ success: true, alerts_sent: alertsSent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

async function trySendAlert(
  supabase: any,
  device: any,
  templateName: string,
  hasAlertEmail: boolean,
  now: number,
  templateData: Record<string, any>,
): Promise<boolean> {
  const cooldownAgo = new Date(now - ALERT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const today = new Date().toISOString().slice(0, 10)

  if (!hasAlertEmail) {
    // No email configured — notify Santiago (weekly dedup)
    const { data: recent } = await supabase
      .from('email_send_log')
      .select('id')
      .eq('template_name', 'email-no-configurado')
      .eq('recipient_email', BCC_EMAIL)
      .like('message_id', `no-email-${templateName === 'stock-bajo' ? 'stock' : 'desconectado'}-${device.fixno}%`)
      .gte('created_at', cooldownAgo)
      .limit(1)

    if (recent?.length) return false

    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'email-no-configurado',
        recipientEmail: BCC_EMAIL,
        idempotencyKey: `no-email-${templateName === 'stock-bajo' ? 'stock' : 'desconectado'}-${device.fixno}-${today}`,
        templateData: {
          branchName: templateData.branchName,
          fixno: device.fixno,
          customerName: device.customer_name,
          alertType: templateName === 'stock-bajo' ? 'stock bajo' : 'equipo desconectado',
        },
      },
    })
  } else {
    // Check weekly dedup
    const { data: recentAlert } = await supabase
      .from('email_send_log')
      .select('id')
      .eq('template_name', templateName)
      .eq('recipient_email', device.alert_email)
      .gte('created_at', cooldownAgo)
      .limit(1)

    if (recentAlert?.length) return false

    // Send to device email + BCC
    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName,
        recipientEmail: device.alert_email,
        idempotencyKey: `${templateName}-${device.fixno}-${today}`,
        templateData,
      },
    })
    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName,
        recipientEmail: BCC_EMAIL,
        idempotencyKey: `${templateName}-bcc-${device.fixno}-${today}`,
        templateData,
      },
    })
  }

  // Mark first alert timestamp if not set
  if (!device.first_alert_sent_at) {
    await supabase.from('devices').update({ first_alert_sent_at: new Date().toISOString() }).eq('id', device.id)
  }

  return true
}
