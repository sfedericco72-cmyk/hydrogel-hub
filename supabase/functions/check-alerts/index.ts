import { createClient } from 'npm:@supabase/supabase-js@2'

// Defaults — overridden per tenant from tenant_settings
const DEFAULT_LOW_STOCK_DAYS = 7
const LOW_STOCK_FALLBACK_CUTS = 10
const DEFAULT_DISCONNECTED_DAYS = 5
const DEFAULT_COOLDOWN_DAYS = 7
const DEFAULT_MAX_WINDOW_DAYS = 14

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Load all tenant settings
  const { data: allSettings, error: tsErr } = await supabase
    .from('tenant_settings')
    .select('tenant_id, bcc_email, low_stock_days, alert_cooldown_days, alert_max_window_days, alerts_paused_until')
    .not('tenant_id', 'is', null)

  if (tsErr) {
    console.error('Failed to load tenant settings', tsErr)
    return new Response(JSON.stringify({ error: 'Failed to load tenant settings' }), { status: 500 })
  }

  let totalAlerts = 0
  const nowMs = Date.now()

  for (const settings of (allSettings || [])) {
    const tenantId = settings.tenant_id
    const BCC_EMAIL = settings.bcc_email || null
    const LOW_STOCK_DAYS_THRESHOLD = settings.low_stock_days ?? DEFAULT_LOW_STOCK_DAYS
    const ALERT_COOLDOWN_DAYS = settings.alert_cooldown_days ?? DEFAULT_COOLDOWN_DAYS
    const ALERT_MAX_WINDOW_DAYS = settings.alert_max_window_days ?? DEFAULT_MAX_WINDOW_DAYS

    // Respect global pause
    if (settings.alerts_paused_until) {
      const pausedUntil = new Date(settings.alerts_paused_until).getTime()
      if (pausedUntil > nowMs) {
        console.log(`[${tenantId}] Alerts paused until ${settings.alerts_paused_until} — skipping`)
        continue
      }
    }

    const { data: devices, error: devErr } = await supabase
      .from('devices')
      .select('id, fixno, branch_name, customer_name, remaining_cuts, latest_online_time, status, first_alert_sent_at')
      .eq('tenant_id', tenantId)

    if (devErr || !devices) {
      console.error(`[${tenantId}] Failed to load devices`, devErr)
      continue
    }

    // Load active assignments for this tenant → map device_id → PdV info
    const { data: assignments } = await supabase
      .from('device_assignments')
      .select('device_id, points_of_sale(id, name, alert_email, alerts_enabled)')
      .eq('tenant_id', tenantId)
      .is('unassigned_at', null)

    const pdvByDevice = new Map<string, { id: string; name: string; alert_email: string | null; alerts_enabled: boolean }>()
    for (const a of (assignments || [])) {
      const pos = (a as any).points_of_sale
      if (pos) pdvByDevice.set(a.device_id, pos)
    }

    for (const device of devices) {
      if (!device.branch_name || device.branch_name === device.fixno) continue

      const pdv = pdvByDevice.get(device.id)

      // No PdV assignment → skip entirely (decision: "No manda alerta al cliente")
      if (!pdv) {
        console.log(`[${tenantId}] Device ${device.fixno} has no PdV — skipping alerts`)
        continue
      }

      // PdV-level alerts disabled
      if (pdv.alerts_enabled === false) continue

      const recipientEmail = pdv.alert_email
      const hasAlertEmail = !!recipientEmail

      if (device.first_alert_sent_at) {
        const firstAlertTime = new Date(device.first_alert_sent_at).getTime()
        const daysSinceFirst = (nowMs - firstAlertTime) / (1000 * 60 * 60 * 24)
        if (daysSinceFirst > ALERT_MAX_WINDOW_DAYS) {
          // Disable PdV alerts after max window
          await supabase.from('points_of_sale').update({ alerts_enabled: false }).eq('id', pdv.id)
          continue
        }
      }

      const { data: history } = await supabase
        .from('device_cuts_history')
        .select('daily_cuts')
        .eq('fixno', device.fixno)
        .order('cut_date', { ascending: false })
        .limit(30)

      const dailyCuts = (history || [])
        .map((h: any) => h.daily_cuts ?? 0)
        .filter((c: number) => c > 0)

      const avgDailyCuts = dailyCuts.length > 0
        ? dailyCuts.reduce((a: number, b: number) => a + b, 0) / dailyCuts.length
        : 0

      const remaining = device.remaining_cuts ?? 0

      let isLowStock = false
      let estimatedDays: number | undefined

      if (avgDailyCuts > 0) {
        estimatedDays = Math.floor(remaining / avgDailyCuts)
        isLowStock = estimatedDays < LOW_STOCK_DAYS_THRESHOLD
      } else {
        isLowStock = remaining <= LOW_STOCK_FALLBACK_CUTS
      }

      if (isLowStock) {
        const sent = await trySendAlert(supabase, device, pdv, recipientEmail, 'stock-bajo', hasAlertEmail, nowMs, ALERT_COOLDOWN_DAYS, BCC_EMAIL, {
          branchName: device.branch_name,
          fixno: device.fixno,
          remainingCuts: remaining,
          estimatedDays,
          customerName: device.customer_name,
        })
        if (sent) totalAlerts++
      }

      const onlineTime = device.latest_online_time
        ? new Date(device.latest_online_time).getTime()
        : 0

      const daysSinceOnline = onlineTime > 0
        ? Math.floor((nowMs - onlineTime) / (1000 * 60 * 60 * 24))
        : 999

      if (daysSinceOnline >= DEFAULT_DISCONNECTED_DAYS) {
        const sent = await trySendAlert(supabase, device, pdv, recipientEmail, 'dispositivo-desconectado', hasAlertEmail, nowMs, ALERT_COOLDOWN_DAYS, BCC_EMAIL, {
          branchName: device.branch_name,
          fixno: device.fixno,
          daysSinceOnline,
          customerName: device.customer_name,
        })
        if (sent) totalAlerts++
      }
    }
  }

  return new Response(JSON.stringify({ success: true, alerts_sent: totalAlerts }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

async function trySendAlert(
  supabase: any,
  device: any,
  pdv: { id: string; name: string },
  recipientEmail: string | null,
  templateName: string,
  hasAlertEmail: boolean,
  now: number,
  cooldownDays: number,
  bccEmail: string | null,
  templateData: Record<string, any>,
): Promise<boolean> {
  const cooldownAgo = new Date(now - cooldownDays * 24 * 60 * 60 * 1000).toISOString()
  const today = new Date().toISOString().slice(0, 10)

  if (!hasAlertEmail) {
    if (!bccEmail) return false

    const { data: recent } = await supabase
      .from('email_send_log')
      .select('id')
      .eq('template_name', 'email-no-configurado')
      .eq('recipient_email', bccEmail)
      .like('message_id', `no-email-${templateName === 'stock-bajo' ? 'stock' : 'desconectado'}-${device.fixno}%`)
      .gte('created_at', cooldownAgo)
      .limit(1)

    if (recent?.length) return false

    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'email-no-configurado',
        recipientEmail: bccEmail,
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
    const { data: recentAlert } = await supabase
      .from('email_send_log')
      .select('id')
      .eq('template_name', templateName)
      .eq('recipient_email', recipientEmail)
      .gte('created_at', cooldownAgo)
      .limit(1)

    if (recentAlert?.length) return false

    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName,
        recipientEmail,
        idempotencyKey: `${templateName}-${device.fixno}-${today}`,
        templateData,
      },
    })

    if (bccEmail) {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName,
          recipientEmail: bccEmail,
          idempotencyKey: `${templateName}-bcc-${device.fixno}-${today}`,
          templateData,
        },
      })
    }
  }

  if (!device.first_alert_sent_at) {
    await supabase.from('devices').update({ first_alert_sent_at: new Date().toISOString() }).eq('id', device.id)
  }

  return true
}
