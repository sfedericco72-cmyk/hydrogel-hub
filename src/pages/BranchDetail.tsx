import { useParams, useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { CutsTrafficLights, ConnectionTrafficLight } from "@/components/TrafficLights";
import {
  ArrowLeft, Scissors,
  Phone, User, Clock, HardDrive, Package, Globe, BarChart3, RefreshCw, Bell, BellOff
} from "lucide-react";
import { useDevice, useLastCutDates, useMonthlyCutsMap, getActivityState, isDeviceDisconnected, getDisconnectionDays, ACTIVITY_LABELS } from "@/hooks/useDevices";
import { useCutsHistory, useMonthlyCuts } from "@/hooks/useCutsHistory";
import { useDeviceTransactions } from "@/hooks/useTransactions";
import { useAlertHistory } from "@/hooks/useAlertHistory";
import { useUnmuteDevices } from "@/hooks/useAlertsHealth";
import { AlertHistoryTable } from "@/components/AlertHistoryTable";
import { titleCase } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("es-AR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

type TimeResolution = "weekly" | "monthly" | "annual";

function getISOWeekNumber(d: Date): [number, number] {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return [date.getUTCFullYear(), weekNo];
}

function getWeekLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const [, weekNum] = getISOWeekNumber(d);
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `S${weekNum} ${months[d.getMonth()]}`;
}

function getMonthLabel(monthStr: string) {
  const [year, month] = monthStr.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[parseInt(month) - 1]} ${year}`;
}

function getWeekKey(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const [year, weekNum] = getISOWeekNumber(d);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

interface ChartPoint {
  key: string;
  label: string;
  totalCuts: number;
}

function aggregateHistory(
  history: { cut_date: string; daily_cuts: number | null }[],
  resolution: TimeResolution,
  startDate?: string | null
): ChartPoint[] {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const map = new Map<string, ChartPoint>();

  for (const record of history) {
    // Filter by assignment start date
    if (startDate && record.cut_date < startDate) continue;

    const recordDate = new Date(record.cut_date + "T00:00:00");
    let key: string;
    let label: string;

    if (resolution === "weekly") {
      // Only show last 3 months
      if (recordDate < threeMonthsAgo) continue;
      key = getWeekKey(record.cut_date);
      label = getWeekLabel(record.cut_date);
    } else if (resolution === "monthly") {
      key = record.cut_date.substring(0, 7);
      label = getMonthLabel(key);
    } else {
      key = record.cut_date.substring(0, 4);
      label = key;
    }

    if (!map.has(key)) {
      map.set(key, { key, label, totalCuts: 0 });
    }
    map.get(key)!.totalCuts += record.daily_cuts ?? 0;
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function aggregateMonthly(
  monthly: { year_month: string; total_cuts: number }[],
  resolution: TimeResolution,
  startDate?: string | null,
): ChartPoint[] {
  const startMonth = startDate ? startDate.slice(0, 7) : null;
  const map = new Map<string, ChartPoint>();
  for (const r of monthly) {
    if (startMonth && r.year_month < startMonth) continue;
    let key: string;
    let label: string;
    if (resolution === "annual") {
      key = r.year_month.slice(0, 4);
      label = key;
    } else {
      key = r.year_month;
      label = getMonthLabel(r.year_month);
    }
    if (!map.has(key)) map.set(key, { key, label, totalCuts: 0 });
    map.get(key)!.totalCuts += r.total_cuts ?? 0;
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export default function BranchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: device, isLoading } = useDevice(id);
  const unmute = useUnmuteDevices();
  const { data: history = [] } = useCutsHistory(device?.fixno);
  const { data: monthlyHistory = [] } = useMonthlyCuts(device?.fixno);
  const { data: transactions = [] } = useDeviceTransactions(device?.fixno);
  const { data: alertHistory = [], isLoading: alertsLoading } = useAlertHistory(60);
  // Resolve current PdV id for this device so we can also surface legacy
  // alerts whose fixno couldn't be resolved (metadata was null and the PdV
  // had multiple devices, so useAlertHistory left fixno = null).
  const { data: currentPdvId } = useQuery({
    queryKey: ["device-current-pdv", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_assignments")
        .select("point_of_sale_id")
        .eq("device_id", id!)
        .is("unassigned_at", null)
        .maybeSingle();
      if (error) throw error;
      return data?.point_of_sale_id ?? null;
    },
  });
  const deviceAlerts = useMemo(() => {
    if (!device?.fixno) return [];
    return alertHistory.filter(
      (h) =>
        h.fixno === device.fixno ||
        (!h.fixno && currentPdvId != null && h.pdv_id === currentPdvId),
    );
  }, [alertHistory, device?.fixno, currentPdvId]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const { data: lastCutDates } = useLastCutDates();
  const { data: monthlyCutsMap } = useMonthlyCutsMap();
  const [resolution, setResolution] = useState<TimeResolution>("monthly");

  // Get assignment start date for this device
  const { data: assignmentStartDate } = useQuery({
    queryKey: ["device-assignment-start", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_assignments")
        .select("assigned_at")
        .eq("device_id", id!)
        .is("unassigned_at", null)
        .order("assigned_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.assigned_at?.slice(0, 10) ?? null;
    },
  });

  // Filter history by assignment date for charts
  const filteredHistory = useMemo(() => {
    if (!assignmentStartDate) return history;
    return history.filter(r => r.cut_date >= assignmentStartDate);
  }, [history, assignmentStartDate]);

  // For weekly resolution use daily data (covers last 90 days, fine for last 3 months).
  // For monthly/annual use the pre-aggregated monthly table (full history).
  const chartData = useMemo(() => {
    if (resolution === "weekly") {
      return aggregateHistory(history, "weekly", assignmentStartDate);
    }
    return aggregateMonthly(monthlyHistory, resolution, assignmentStartDate);
  }, [history, monthlyHistory, resolution, assignmentStartDate]);

  // Cortes totales since assignment: combine monthly (full months) + daily
  // (partial start month + daily window). Simpler approximation: sum monthly
  // from assignment start month onward + the partial start of the assignment
  // month from daily, minus the days before assignment in that month.
  const totalCutsSinceAssignment = useMemo(() => {
    if (!assignmentStartDate) {
      return monthlyHistory.reduce((s, r) => s + (r.total_cuts ?? 0), 0);
    }
    const startMonth = assignmentStartDate.slice(0, 7);
    // Sum all months at-or-after the start month
    const monthlySum = monthlyHistory
      .filter(r => r.year_month > startMonth)
      .reduce((s, r) => s + (r.total_cuts ?? 0), 0);
    // For the start month, use daily data filtered by assignment date
    const startMonthDailySum = filteredHistory
      .filter(r => r.cut_date.slice(0, 7) === startMonth)
      .reduce((s, r) => s + (r.daily_cuts ?? 0), 0);
    return monthlySum + startMonthDailySum;
  }, [monthlyHistory, filteredHistory, assignmentStartDate]);

  // Filter monthlyCutsMap for traffic lights
  const filteredMonthlyCuts = useMemo(() => {
    if (!device?.fixno || !monthlyCutsMap) return undefined;
    const deviceMap = monthlyCutsMap.get(device.fixno);
    if (!deviceMap || !assignmentStartDate) return deviceMap;
    const startMonth = assignmentStartDate.slice(0, 7);
    const filtered = new Map<string, number>();
    deviceMap.forEach((cuts, month) => {
      if (month >= startMonth) filtered.set(month, cuts);
    });
    return filtered;
  }, [device?.fixno, monthlyCutsMap, assignmentStartDate]);
  const resolutionLabels: Record<TimeResolution, string> = {
    weekly: "Semanal (últ. 3 meses)",
    monthly: "Mensual",
    annual: "Anual",
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Dispositivo no encontrado</p>
      </div>
    );
  }

  const lowCuts = (device.remaining_cuts ?? 0) <= 10;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{titleCase(device.branch_name) || device.fixno}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {titleCase(device.customer_name) || "Sin cliente"} · <span className="font-mono text-xs">{device.fixno}</span>
          </p>
        </div>

        {device.alerts_muted_until && new Date(device.alerts_muted_until) > new Date() && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <BellOff className="h-4 w-4 shrink-0 text-amber-400" />
            <div className="flex-1">
              <p className="font-medium text-amber-400">Alertas silenciadas para este equipo</p>
              <p className="text-xs text-muted-foreground">
                {device.alerts_mute_reason ?? "Silenciado por el sistema"} · vuelve el{" "}
                {new Date(device.alerts_muted_until).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  await unmute.mutateAsync([device.id]);
                  toast.success("Alertas reactivadas para este equipo");
                } catch (e: any) {
                  toast.error("Error: " + e.message);
                }
              }}
              disabled={unmute.isPending}
              className="rounded-md border border-input px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              Reactivar ahora
            </button>
          </div>
        )}


        {/* Status Grid */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Estado */}
          {(() => {
            const activity = device ? getActivityState(device, lastCutDates) : "inactive";
            const disconnected = device ? isDeviceDisconnected(device) : false;
            const disconnDays = device ? getDisconnectionDays(device) : null;
            return (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <HardDrive className="h-4 w-4" />
                  Estado
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge
                    status={activity === "active" ? "online" : "warning"}
                    label={ACTIVITY_LABELS[activity]}
                    pulse={activity === "active"}
                  />
                  {disconnected && (
                    <StatusBadge
                      status="offline"
                      label={`Desconectado${disconnDays !== null ? ` ${disconnDays}d` : ""}`}
                    />
                  )}
                </div>
              </div>
            );
          })()}

          {/* Cortes - Semáforo 3 meses */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Scissors className="h-4 w-4" />
              Ventas
            </div>
            <CutsTrafficLights monthlyCuts={filteredMonthlyCuts} />
          </div>

          {/* Conexión - Semáforo */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              Conexión
            </div>
            <ConnectionTrafficLight latestOnlineTime={device.latest_online_time} />
            <p className="mt-2 text-xs text-muted-foreground">
              Última: {formatDateTime(device.latest_online_time)}
            </p>
          </div>

          {/* Stock */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              Cortes restantes
            </div>
            <StatusBadge
              status={lowCuts ? "warning" : "online"}
              label={`${device.remaining_cuts ?? 0} restantes`}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <Scissors className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-2 text-xl font-bold font-mono">{totalCutsSinceAssignment.toLocaleString("es-AR")}</p>
            <p className="text-xs text-muted-foreground">
              Cortes totales{assignmentStartDate ? ` (desde ${new Date(assignmentStartDate + "T00:00:00").toLocaleDateString("es-CL")})` : ""}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <Package className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-xl font-bold font-mono">{device.remaining_cuts ?? 0}</p>
            <p className="text-xs text-muted-foreground">Cortes restantes</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <Globe className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold font-mono">{device.ip_address || "—"}</p>
            <p className="text-xs text-muted-foreground">IP</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <Clock className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-xs font-semibold">{formatDateTime(device.last_synced_at)}</p>
            <p className="text-xs text-muted-foreground">Últ. sincronización</p>
          </div>
        </div>

        {/* Monthly Cuts Chart */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Análisis de cortes</h2>
            </div>
            <div className="flex gap-1 rounded-lg bg-secondary p-0.5">
              {(Object.entries(resolutionLabels) as [TimeResolution, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setResolution(key)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    resolution === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  angle={resolution === "weekly" ? -45 : 0}
                  textAnchor={resolution === "weekly" ? "end" : "middle"}
                  height={resolution === "weekly" ? 60 : 30}
                />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number) => [value.toLocaleString("es-AR"), "Cortes"]}
                />
                <Bar dataKey="totalCuts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              Sin datos históricos aún. Se generarán con cada sincronización.
            </div>
          )}
        </div>

        {/* Alert History */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <button
            type="button"
            onClick={() => setAlertsOpen((v) => !v)}
            className="flex w-full items-center gap-2 text-left"
          >
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Historial de alertas
            </h2>
            <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              {deviceAlerts.length} {deviceAlerts.length === 1 ? "alerta" : "alertas"} (60d)
              <span className="text-muted-foreground/60">{alertsOpen ? "▾" : "▸"}</span>
            </span>
          </button>
          {alertsOpen && (
            <div className="mt-4">
              <AlertHistoryTable
                entries={deviceAlerts}
                isLoading={alertsLoading}
                showClient={false}
                showFixno={false}
                pageSize={20}
                emptyMessage="Este equipo no tiene alertas enviadas en los últimos 60 días."
              />
            </div>
          )}
        </div>

        {/* Transactions / Reloads History */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Historial de recargas
            </h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {transactions.length} transacciones
            </span>
          </div>
          {transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">Fecha</th>
                    <th className="pb-2 pr-4">Tipo</th>
                    <th className="pb-2 pr-4 text-right">Cantidad</th>
                    
                    <th className="pb-2 pr-4">Nº Factura</th>
                    <th className="pb-2">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {tx.audit_date
                          ? new Date(tx.audit_date).toLocaleDateString("es-CL", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            tx.transaction_type === "Distribution"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {tx.transaction_type === "Distribution" ? "Recarga" : tx.transaction_type || "—"}
                        </span>
                      </td>
                      <td className={`py-2 pr-4 text-right font-mono font-semibold ${tx.quantity >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {tx.quantity >= 0 ? "+" : ""}{tx.quantity.toLocaleString("es-AR")}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                        {tx.bill_no}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground truncate max-w-[120px]">
                        {tx.summary || tx.remark || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-[100px] items-center justify-center text-sm text-muted-foreground">
              Sin transacciones registradas. Se sincronizarán automáticamente.
            </div>
          )}
        </div>

        {/* Contact */}
        {(device.contact_name || device.contact_phone) && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contacto</h2>
            <div className="flex flex-wrap gap-4">
              {device.contact_name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {device.contact_name}
                </div>
              )}
              {device.contact_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {device.contact_phone}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
