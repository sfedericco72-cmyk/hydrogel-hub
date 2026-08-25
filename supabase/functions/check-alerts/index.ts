import { createClient } from 'npm:@supabase/supabase-js@2'

// Defaults — overridden per tenant from tenant_settings
const DEFAULT_LOW_STOCK_DAYS = 7
const LOW_STOCK_FALLBACK_CUTS = 10
const DEFAULT_DISCONNECTED_DAYS = 5
const DEFAULT_COOLDOWN_DAYS = 7
const DEFAULT_MAX_WINDOW_DAYS = 14
const DEFAULT_MUTE_DAYS = 30
const DEFAULT_CHECK_HOUR = 9 // 9 AM tenant local time

// Default tenant timezone — overridden per tenant from tenant_settings.timezone
const DEFAULT_TENANT_TZ = 'America/Santiago'

// A run that started less than this long ago is considered still in progress
const RUN_LOCK_MINUTES = 10

function getTenantHour(tz: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  })
  return parseInt(fmt.format(new Date()), 10)
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Detect manual trigger (force run regardless of hour)
  let force = false
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      force = body?.force === true
    } catch {
      // no body
    }
  }

  // Single-flight lock: bail out if another run is still in progress
  const lockSince = new Date(Date.now() - RUN_LOCK_MINUTES * 60 * 1000).toISOString()
  const { data: inFlight } = await supabase
    .from('alert_check_runs')
    .select('id, started_at')
    .eq('status', 'running')
    .gte('started_at', lockSince)
    .limit(1)

  if (inFlight?.length) {
    return new Response(JSON.stringify({
      accepted: false,
      reason: 'another run in progress',
      run_id: inFlight[0].id,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const { data: run, error: runErr } = await supabase
    .from('alert_check_runs')
    .insert({ status: 'running', forced: force })
    .select('id')
    .single()

  if (runErr || !run) {
    console.error('Failed to create run row', runErr)
    return new Response(JSON.stringify({ error: 'Failed to create run row' }), { status: 500 })
  }

  // Process in background: the caller (pg_cron via pg_net) has a short timeout
  // and must not wait for a full sweep of every tenant/device.
  const work = processAllTenants(supabase, force, run.id)
  // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(work)
  } else {
    work.catch((e) => console.error('background run failed', e))
  }

  return new Response(JSON.stringify({
    accepted: true,
    run_id: run.id,
    forced: force,
  }), { status: 202, headers: { 'Content-Type': 'application/json' } })
})

async function processAllTenants(supabase: any, force: boolean, runId: string) {
  const totals = {
    'stock-bajo': 0,
    'dispositivo-desconectado': 0,
    'email-no-configurado': 0,
  }
  const tenantsProcessed: string[] = []
  const tenantsSkipped: { tenant_id: string; reason: string }[] = []
  const nowMs = Date.now()

  try {
    const { data: allSettings, error: tsErr } = await supabase
      .from('tenant_settings')
      .select('tenant_id, bcc_email, low_stock_days, alert_cooldown_days, alert_max_window_days, alert_mute_days, alerts_paused_until, alerts_check_hour, brand_name, logo_url, store_url, store_button_label, support_email, timezone, company_name')
      .not('tenant_id', 'is', null)

    if (tsErr) throw new Error('Failed to load tenant settings: ' + tsErr.message)

    for (const settings of (allSettings || [])) {
      const tenantId = settings.tenant_id
      const tenantCheckHour = settings.alerts_check_hour ?? DEFAULT_CHECK_HOUR
      const tenantTz = settings.timezone || DEFAULT_TENANT_TZ
      const currentTenantHour = getTenantHour(tenantTz)

      // Skip tenants whose configured hour doesn't match current hour (unless forced)
      if (!force && tenantCheckHour !== currentTenantHour) {
        tenantsSkipped.push({ tenant_id: tenantId, reason: `wrong hour (configured: ${tenantCheckHour}, current: ${currentTenantHour} ${tenantTz})` })
        continue
      }

      const BCC_EMAIL = settings.bcc_email || null
      const LOW_STOCK_DAYS_THRESHOLD = settings.low_stock_days ?? DEFAULT_LOW_STOCK_DAYS
      const ALERT_COOLDOWN_DAYS = settings.alert_cooldown_days ?? DEFAULT_COOLDOWN_DAYS
      const ALERT_MAX_WINDOW_DAYS = settings.alert_max_window_days ?? DEFAULT_MAX_WINDOW_DAYS
      const ALERT_MUTE_DAYS = settings.alert_mute_days ?? DEFAULT_MUTE_DAYS

      // Branding del tenant inyectado en cada email.
      // OJO: tenantName es solo para el alt del logo / contexto interno —
      // el "From" del email es siempre "CutMonitor", no el tenant.
      const brandingProps = {
        tenantName: settings.company_name || null,
        logoUrl: settings.logo_url || null,
        storeUrl: settings.store_url || null,
        storeButtonLabel: settings.store_button_label || null,
        supportEmail: settings.support_email || null,
      }

      // Respect global pause
      if (settings.alerts_paused_until) {
        const pausedUntil = new Date(settings.alerts_paused_until).getTime()
        if (pausedUntil > nowMs) {
          console.log(`[${tenantId}] Alerts paused until ${settings.alerts_paused_until} — skipping`)
          tenantsSkipped.push({ tenant_id: tenantId, reason: 'paused' })
          continue
        }
      }

      tenantsProcessed.push(tenantId)

      const { data: devices, error: devErr } = await supabase
        .from('devices')
        .select('id, fixno, branch_name, customer_name, remaining_cuts, latest_online_time, status, first_alert_sent_at, alerts_muted_until, alerts_mute_reason')
        .eq('tenant_id', tenantId)

      if (devErr || !devices) {
        console.error(`[${tenantId}] Failed to load devices`, devErr)
        continue
      }

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

        if (!pdv) {
          console.log(`[${tenantId}] Device ${device.fixno} has no PdV — skipping alerts`)
          continue
        }

        // Manual switch always wins
        if (pdv.alerts_enabled === false) continue

        // Per-device temporary mute
        if (device.alerts_muted_until) {
          const mutedUntil = new Date(device.alerts_muted_until).getTime()
          if (mutedUntil > nowMs) continue
          // Mute expired → clear it and restart the alert window
          await supabase
            .from('devices')
            .update({ alerts_muted_until: null, alerts_mute_reason: null, first_alert_sent_at: null })
            .eq('id', device.id)
          device.alerts_muted_until = null
          device.first_alert_sent_at = null
        }

        const recipientEmail = pdv.alert_email
        const hasAlertEmail = !!recipientEmail

        // Max window reached → mute THIS device temporarily (not the whole PdV)
        if (device.first_alert_sent_at) {
          const firstAlertTime = new Date(device.first_alert_sent_at).getTime()
          const daysSinceFirst = (nowMs - firstAlertTime) / (1000 * 60 * 60 * 24)
          if (daysSinceFirst > ALERT_MAX_WINDOW_DAYS) {
            const until = new Date(nowMs + ALERT_MUTE_DAYS * 24 * 60 * 60 * 1000).toISOString()
            await supabase
              .from('devices')
              .update({
                alerts_muted_until: until,
                alerts_mute_reason: `Ventana máxima de ${ALERT_MAX_WINDOW_DAYS} días alcanzada sin resolución`,
              })
              .eq('id', device.id)
            continue
          }
        }

        const { data: history } = await supabase
          .from('device_cuts_daily')
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
          const counted = await trySendAlert(supabase, device, pdv, recipientEmail, 'stock-bajo', hasAlertEmail, nowMs, ALERT_COOLDOWN_DAYS, BCC_EMAIL, {
            branchName: device.branch_name,
            fixno: device.fixno,
            remainingCuts: remaining,
            estimatedDays,
            customerName: device.customer_name,
            ...brandingProps,
          }, tenantId)
          if (counted.sent) {
            if (counted.template === 'email-no-configurado') totals['email-no-configurado']++
            else totals['stock-bajo']++
          }
        }

        const onlineTime = device.latest_online_time
          ? new Date(device.latest_online_time).getTime()
          : 0

        const daysSinceOnline = onlineTime > 0
          ? Math.floor((nowMs - onlineTime) / (1000 * 60 * 60 * 24))
          : 999

        if (daysSinceOnline >= DEFAULT_DISCONNECTED_DAYS) {
          const counted = await trySendAlert(supabase, device, pdv, recipientEmail, 'dispositivo-desconectado', hasAlertEmail, nowMs, ALERT_COOLDOWN_DAYS, BCC_EMAIL, {
            branchName: device.branch_name,
            fixno: device.fixno,
            daysSinceOnline,
            customerName: device.customer_name,
            ...brandingProps,
          }, tenantId)
          if (counted.sent) {
            if (counted.template === 'email-no-configurado') totals['email-no-configurado']++
            else totals['dispositivo-desconectado']++
          }
        }
      }
    }

    await supabase
      .from('alert_check_runs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        tenants_processed: tenantsProcessed.length,
        tenants_skipped: tenantsSkipped,
        alerts_sent: totals,
      })
      .eq('id', runId)
  } catch (e) {
    console.error('Alert check run failed', e)
    await supabase
      .from('alert_check_runs')
      .update({
        status: 'error',
        finished_at: new Date().toISOString(),
        tenants_processed: tenantsProcessed.length,
        tenants_skipped: tenantsSkipped,
        alerts_sent: totals,
        error_message: (e as Error)?.message ?? String(e),
      })
      .eq('id', runId)
  }
}

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
  tenantId: string,
): Promise<{ sent: boolean; template: string }> {
  const cooldownAgo = new Date(now - cooldownDays * 24 * 60 * 60 * 1000).toISOString()
  const today = new Date().toISOString().slice(0, 10)

  // Shared metadata so the history view can resolve client/PdV/equipo without
  // depending on recipient_email matching (critical for email-no-configurado
  // which is sent only to the BCC monitoring address).
  const baseMetadata = {
    tenant_id: tenantId,
    pdv_id: pdv.id,
    fixno: device.fixno,
    alert_type: templateName,
  }

  if (!hasAlertEmail) {
    if (!bccEmail) return { sent: false, template: templateName }

    const { data: recent } = await supabase
      .from('email_send_log')
      .select('id')
      .eq('template_name', 'email-no-configurado')
      .eq('recipient_email', bccEmail)
      .like('message_id', `no-email-${templateName === 'stock-bajo' ? 'stock' : 'desconectado'}-${device.fixno}%`)
      .gte('created_at', cooldownAgo)
      .limit(1)

    if (recent?.length) return { sent: false, template: templateName }

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
          tenantName: templateData.tenantName,
          logoUrl: templateData.logoUrl,
        },
        metadata: { ...baseMetadata, alert_type: 'email-no-configurado' },
      },
    })

    if (!device.first_alert_sent_at) {
      await supabase.from('devices').update({ first_alert_sent_at: new Date().toISOString() }).eq('id', device.id)
    }

    return { sent: true, template: 'email-no-configurado' }
  }

  const { data: recentAlert } = await supabase
    .from('email_send_log')
    .select('id')
    .eq('template_name', templateName)
    .eq('recipient_email', recipientEmail)
    .gte('created_at', cooldownAgo)
    .limit(1)

  if (recentAlert?.length) return { sent: false, template: templateName }

  // Primary send to PdV — logged with enriched metadata
  await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName,
      recipientEmail,
      idempotencyKey: `${templateName}-${device.fixno}-${today}`,
      templateData,
      metadata: baseMetadata,
    },
  })

  // BCC copy — sent for monitoring but NOT logged (one alert = one history row)
  if (bccEmail) {
    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName,
        recipientEmail: bccEmail,
        idempotencyKey: `${templateName}-bcc-${device.fixno}-${today}`,
        templateData,
        metadata: baseMetadata,
        skipLog: true,
      },
    })
  }

  if (!device.first_alert_sent_at) {
    await supabase.from('devices').update({ first_alert_sent_at: new Date().toISOString() }).eq('id', device.id)
  }

  return { sent: true, template: templateName }
}
