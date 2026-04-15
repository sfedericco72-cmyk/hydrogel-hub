import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Settings, Building2, Bell, TrendingUp, Wifi, Database, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useTenantSettings, useUpdateTenantSettings } from "@/hooks/useTenantSettings";
import { useBackfillStatus, useRunBackfill } from "@/hooks/useBackfillHistory";
import { toast } from "sonner";

export default function Setup() {
  const navigate = useNavigate();
  const { data: settings, isLoading } = useTenantSettings();
  const updateSettings = useUpdateTenantSettings();

  const [form, setForm] = useState({
    company_name: "",
    bcc_email: "",
    attach_rate_green: 80,
    attach_rate_yellow: 50,
    low_stock_days: 7,
    disconnect_months: 3,
    connection_green_days: 7,
    connection_yellow_days: 14,
    alert_cooldown_days: 7,
    alert_max_window_days: 14,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name,
        bcc_email: settings.bcc_email ?? "",
        attach_rate_green: settings.attach_rate_green,
        attach_rate_yellow: settings.attach_rate_yellow,
        low_stock_days: settings.low_stock_days,
        disconnect_months: settings.disconnect_months,
        connection_green_days: settings.connection_green_days,
        connection_yellow_days: settings.connection_yellow_days,
        alert_cooldown_days: settings.alert_cooldown_days,
        alert_max_window_days: settings.alert_max_window_days,
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
        attach_rate_green: form.attach_rate_green,
        attach_rate_yellow: form.attach_rate_yellow,
        low_stock_days: form.low_stock_days,
        disconnect_months: form.disconnect_months,
        connection_green_days: form.connection_green_days,
        connection_yellow_days: form.connection_yellow_days,
        alert_cooldown_days: form.alert_cooldown_days,
        alert_max_window_days: form.alert_max_window_days,
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

function BackfillSection() {
  const { data: records = [], isLoading } = useBackfillStatus();
  const runBackfill = useRunBackfill();
  const [loadingPeriod, setLoadingPeriod] = useState<string | null>(null);

  // Generate last 12 months
  const months: string[] = [];
  const now = new Date();
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().substring(0, 7));
  }

  const statusMap = new Map(records.map(r => [r.period, r]));

  async function handleBackfill(period: string) {
    setLoadingPeriod(period);
    try {
      const result = await runBackfill.mutateAsync(period);
      toast.success(`${period}: ${result.records} registros cargados desde ${result.transactions} transacciones`);
    } catch (e: any) {
      toast.error(`Error ${period}: ${e.message}`);
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
            const status = record?.status;
            const isCurrentlyLoading = loadingPeriod === period;

            return (
              <div
                key={period}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
                  status === "done" ? "border-emerald-500/30 bg-emerald-500/5" :
                  status === "error" ? "border-red-500/30 bg-red-500/5" :
                  status === "loading" || isCurrentlyLoading ? "border-amber-500/30 bg-amber-500/5" :
                  "border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  {status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : status === "error" ? (
                    <AlertCircle className="h-4 w-4 text-red-400" />
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
                  <button
                    onClick={() => handleBackfill(period)}
                    disabled={isCurrentlyLoading || loadingPeriod !== null}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      status === "done"
                        ? "bg-secondary text-muted-foreground hover:bg-accent"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    } disabled:opacity-50`}
                  >
                    {isCurrentlyLoading ? "Cargando..." : status === "done" ? "Recargar" : "Cargar"}
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
