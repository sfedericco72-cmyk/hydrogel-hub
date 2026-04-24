import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Settings, Building2, Bell, TrendingUp, Wifi, Database, Loader2, CheckCircle2, AlertCircle, Clock, Send, Calendar, Palette } from "lucide-react";
import { useTenantSettings, useUpdateTenantSettings } from "@/hooks/useTenantSettings";
import { useBackfillStatus, useRunBackfill } from "@/hooks/useBackfillHistory";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TIMEZONES = [
  { value: "America/Santiago", label: "Santiago de Chile (GMT-3/-4)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (GMT-3)" },
  { value: "America/Lima", label: "Lima (GMT-5)" },
  { value: "America/Bogota", label: "Bogotá (GMT-5)" },
  { value: "America/Mexico_City", label: "Ciudad de México (GMT-6)" },
  { value: "America/Sao_Paulo", label: "São Paulo (GMT-3)" },
  { value: "America/Montevideo", label: "Montevideo (GMT-3)" },
];

export default function Setup() {
  const navigate = useNavigate();
  const { data: settings, isLoading } = useTenantSettings();
  const updateSettings = useUpdateTenantSettings();

  const [form, setForm] = useState({
    company_name: "",
    bcc_email: "",
    logo_url: "",
    store_url: "",
    store_button_label: "",
    support_email: "",
    timezone: "America/Santiago",
    attach_rate_green: 80,
    attach_rate_yellow: 50,
    low_stock_days: 7,
    disconnect_months: 3,
    connection_green_days: 7,
    connection_yellow_days: 14,
    alert_cooldown_days: 7,
    alert_max_window_days: 14,
    alerts_check_hour: 9,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name,
        bcc_email: settings.bcc_email ?? "",
        logo_url: settings.logo_url ?? "",
        store_url: settings.store_url ?? "",
        store_button_label: settings.store_button_label ?? "",
        support_email: settings.support_email ?? "",
        timezone: settings.timezone ?? "America/Santiago",
        attach_rate_green: settings.attach_rate_green,
        attach_rate_yellow: settings.attach_rate_yellow,
        low_stock_days: settings.low_stock_days,
        disconnect_months: settings.disconnect_months,
        connection_green_days: settings.connection_green_days,
        connection_yellow_days: settings.connection_yellow_days,
        alert_cooldown_days: settings.alert_cooldown_days,
        alert_max_window_days: settings.alert_max_window_days,
        alerts_check_hour: settings.alerts_check_hour ?? 9,
      });
    }
  }, [settings]);

  function handleChange(field: string, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    try {
      await updateSettings.mutateAsync({
        company_name: form.company_name,
        bcc_email: form.bcc_email || null,
        logo_url: form.logo_url || null,
        store_url: form.store_url || null,
        store_button_label: form.store_button_label || null,
        support_email: form.support_email || null,
        timezone: form.timezone || "America/Santiago",
        attach_rate_green: form.attach_rate_green,
        attach_rate_yellow: form.attach_rate_yellow,
        low_stock_days: form.low_stock_days,
        disconnect_months: form.disconnect_months,
        connection_green_days: form.connection_green_days,
        connection_yellow_days: form.connection_yellow_days,
        alert_cooldown_days: form.alert_cooldown_days,
        alert_max_window_days: form.alert_max_window_days,
        alerts_check_hour: form.alerts_check_hour,
      });
      toast.success("Configuración guardada");
    } catch (e: any) {
      toast.error("Error al guardar: " + e.message);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-3xl py-12 text-center text-muted-foreground">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Settings className="h-6 w-6" />
                Configuración
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Parámetros generales de la aplicación</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateSettings.isPending ? "Guardando..." : "Guardar"}
          </button>
        </div>

        <div className="space-y-6">
          {/* Empresa */}
          <Section icon={<Building2 className="h-4 w-4" />} title="Empresa">
            <Field label="Nombre de empresa" value={form.company_name} onChange={v => handleChange("company_name", v)} />
            <Field label="Email BCC para alertas" value={form.bcc_email} onChange={v => handleChange("bcc_email", v)} placeholder="nombre@empresa.com" />
          </Section>

          {/* Marca y comunicación */}
          <Section icon={<Palette className="h-4 w-4" />} title="Marca y comunicación">
            <p className="text-xs text-muted-foreground mb-3">Personalizá los emails que reciben tus clientes finales.</p>
            <Field label="URL del logo" value={form.logo_url} onChange={v => handleChange("logo_url", v)} placeholder="https://miempresa.com/logo.png" />
            {form.logo_url && (
              <div className="mb-3 rounded-lg border bg-white p-3 flex items-center justify-center">
                <img src={form.logo_url} alt="Logo" className="h-10 max-w-[200px] object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
            <Field label="URL de tu tienda online (botón Comprar)" value={form.store_url} onChange={v => handleChange("store_url", v)} placeholder="https://miempresa.com/tienda" />
            <Field label="Texto del botón Comprar" value={form.store_button_label} onChange={v => handleChange("store_button_label", v)} placeholder="Comprar insumos" />
            <Field label="Email de soporte para tus clientes" value={form.support_email} onChange={v => handleChange("support_email", v)} placeholder="soporte@miempresa.com" />
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium">Zona horaria</label>
              <select
                value={form.timezone}
                onChange={e => handleChange("timezone", e.target.value)}
                className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">Las alertas se disparan en esta hora local.</p>
            </div>
          </Section>

          {/* Attach Rate */}
          <Section icon={<TrendingUp className="h-4 w-4" />} title="Attach Rate">
            <p className="text-xs text-muted-foreground mb-3">Umbrales para los colores del indicador de attach rate (láminas cortadas / equipos vendidos)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label="Verde ≥ (%)" value={form.attach_rate_green} onChange={v => handleChange("attach_rate_green", v)} min={0} max={100} color="text-emerald-400" />
              <NumberField label="Amarillo ≥ (%)" value={form.attach_rate_yellow} onChange={v => handleChange("attach_rate_yellow", v)} min={0} max={100} color="text-amber-400" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Rojo: menor a {form.attach_rate_yellow}%</p>
          </Section>

          {/* Stock */}
          <Section icon={<Bell className="h-4 w-4" />} title="Alertas de Stock">
            <NumberField label="Días mínimos de stock para alertar" value={form.low_stock_days} onChange={v => handleChange("low_stock_days", v)} min={1} max={90} />
          </Section>

          {/* Conexión */}
          <Section icon={<Wifi className="h-4 w-4" />} title="Conexión y Desconexión">
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label="Meses sin cortes = desconectado" value={form.disconnect_months} onChange={v => handleChange("disconnect_months", v)} min={1} max={12} />
              <NumberField label="Semáforo verde ≤ (días)" value={form.connection_green_days} onChange={v => handleChange("connection_green_days", v)} min={1} max={90} color="text-emerald-400" />
              <NumberField label="Semáforo amarillo ≤ (días)" value={form.connection_yellow_days} onChange={v => handleChange("connection_yellow_days", v)} min={1} max={90} color="text-amber-400" />
            </div>
          </Section>

          {/* Alertas */}
          <Section icon={<Bell className="h-4 w-4" />} title="Alertas por Email">
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label="Cooldown entre alertas (días)" value={form.alert_cooldown_days} onChange={v => handleChange("alert_cooldown_days", v)} min={1} max={30} />
              <NumberField label="Ventana máxima de alertas (días)" value={form.alert_max_window_days} onChange={v => handleChange("alert_max_window_days", v)} min={1} max={60} />
            </div>
          </Section>

          {/* Horario y disparo de alertas */}
          <AlertScheduleSection
            currentHour={form.alerts_check_hour}
            onChangeHour={v => handleChange("alerts_check_hour", v)}
          />

          {/* Backfill */}
          <BackfillSection />

        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, color }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; color?: string }) {
  return (
    <div>
      <label className={`mb-1 block text-sm font-medium ${color ?? ""}`}>{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseInt(e.target.value) || 0)}
        min={min}
        max={max}
        className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function AlertScheduleSection({ currentHour, onChangeHour }: { currentHour: number; onChangeHour: (v: number) => void }) {
  const [triggering, setTriggering] = useState(false);

  async function handleTrigger() {
    setTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-alerts", {
        body: { force: true },
      });
      if (error) throw error;
      const totals = data?.by_template ?? {};
      const total = data?.alerts_sent ?? 0;
      if (total === 0) {
        toast.success("Disparado: no había alertas pendientes para enviar");
      } else {
        const parts: string[] = [];
        if (totals["stock-bajo"]) parts.push(`${totals["stock-bajo"]} stock bajo`);
        if (totals["dispositivo-desconectado"]) parts.push(`${totals["dispositivo-desconectado"]} desconectado`);
        if (totals["email-no-configurado"]) parts.push(`${totals["email-no-configurado"]} sin email`);
        toast.success(`${total} alerta${total !== 1 ? "s" : ""} encolada${total !== 1 ? "s" : ""}: ${parts.join(", ")}`);
      }
    } catch (e: any) {
      toast.error("Error al disparar alertas: " + (e.message || e));
    } finally {
      setTriggering(false);
    }
  }

  return (
    <Section icon={<Calendar className="h-4 w-4" />} title="Horario y Disparo de Alertas">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Hora del día (zona horaria Chile)</label>
          <select
            value={currentHour}
            onChange={e => onChangeHour(parseInt(e.target.value, 10))}
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {Array.from({ length: 24 }).map((_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            El sistema evalúa alertas cada hora; solo se procesan los tenants cuya hora configurada coincide con la hora actual de Chile (America/Santiago).
            Recordá guardar los cambios.
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-2 text-sm font-medium">Disparo manual</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Forzá la evaluación de alertas ahora mismo, ignorando el horario configurado.
            Respeta cooldown, pausa global, y configuración por PdV.
          </p>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {triggering ? "Disparando..." : "Disparar alertas ahora"}
          </button>
        </div>
      </div>
    </Section>
  );
}

function BackfillSection() {
  const { data: records = [], isLoading } = useBackfillStatus();
  const runBackfill = useRunBackfill();
  const [loadingPeriod, setLoadingPeriod] = useState<string | null>(null);

  // Last 13 months including the current one. The current month can be
  // backfilled too — the API just returns up to today.
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().substring(0, 7));
  }

  const statusMap = new Map(records.map(r => [r.period, r]));

  // A period stuck in "loading" for >5 min is almost certainly a dead run
  // (Edge Function timed out). Treat it as retryable so the user is not blocked.
  function isStaleLoading(record: { status?: string; started_at?: string | null } | undefined) {
    if (!record || record.status !== "loading" || !record.started_at) return false;
    const ageMs = Date.now() - new Date(record.started_at).getTime();
    return ageMs > 5 * 60 * 1000;
  }

  async function handleBackfill(period: string) {
    setLoadingPeriod(period);
    try {
      await runBackfill.mutateAsync(period);
      toast.info(`${formatPeriod(period)}: descarga iniciada. Esto puede tardar unos minutos.`);
    } catch (e: any) {
      toast.error(`Error ${formatPeriod(period)}: ${e.message}`);
    } finally {
      setLoadingPeriod(null);
    }
  }

  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  function formatPeriod(p: string) {
    const [y, m] = p.split("-");
    return `${monthNames[parseInt(m) - 1]} ${y}`;
  }

  return (
    <Section icon={<Database className="h-4 w-4" />} title="Carga histórica de cortes">
      <p className="text-xs text-muted-foreground mb-4">
        Descarga las transacciones de CutABC mes a mes para reconstruir el historial de cortes diarios.
        La API permite máximo 30 días por consulta.
      </p>
      {isLoading ? (
        <div className="h-20 animate-pulse rounded bg-muted" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {months.map(period => {
            const record = statusMap.get(period);
            const rawStatus = record?.status;
            const stale = isStaleLoading(record);
            // Normalize stale "loading" rows to a retryable state
            const status = stale ? "stale" : rawStatus;
            const isInvoking = loadingPeriod === period;
            // Either we just clicked, or the DB shows it is still running.
            const isCurrentlyLoading = isInvoking || status === "loading" || status === "pending";

            return (
              <div
                key={period}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
                  status === "done" ? "border-emerald-500/30 bg-emerald-500/5" :
                  status === "error" ? "border-red-500/30 bg-red-500/5" :
                  status === "stale" ? "border-orange-500/30 bg-orange-500/5" :
                  status === "loading" || isCurrentlyLoading ? "border-amber-500/30 bg-amber-500/5" :
                  "border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  {status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : status === "error" ? (
                    <AlertCircle className="h-4 w-4 text-red-400" />
                  ) : status === "stale" ? (
                    <AlertCircle className="h-4 w-4 text-orange-400" />
                  ) : isCurrentlyLoading ? (
                    <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">{formatPeriod(period)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {status === "done" && record && (
                    <span className="text-xs text-muted-foreground">{record.records_loaded} reg.</span>
                  )}
                  {status === "error" && (
                    <span className="text-xs text-red-400" title={record?.error_message || ""}>Error</span>
                  )}
                  {status === "stale" && (
                    <span className="text-xs text-orange-400" title="La carga anterior se interrumpió. Volvé a intentar.">Interrumpida</span>
                  )}
                  <button
                    onClick={() => handleBackfill(period)}
                    disabled={isCurrentlyLoading || loadingPeriod !== null}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      status === "done"
                        ? "bg-secondary text-muted-foreground hover:bg-accent"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    } disabled:opacity-50`}
                  >
                    {isCurrentlyLoading ? "Cargando..." : status === "done" ? "Recargar" : status === "stale" ? "Reintentar" : "Cargar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
