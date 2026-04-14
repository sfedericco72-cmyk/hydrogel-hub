import { useParams, useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import {
  ArrowLeft, Scissors, Wifi, WifiOff,
  Phone, User, Clock, HardDrive, Package, Globe, BarChart3, RefreshCw
} from "lucide-react";
import { useDevice, isOnline } from "@/hooks/useDevices";
import { useCutsHistory } from "@/hooks/useCutsHistory";
import { useDeviceTransactions } from "@/hooks/useTransactions";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useMemo } from "react";

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("es-AR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

type TimeResolution = "weekly" | "monthly" | "annual";

function getWeekLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
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
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

interface ChartPoint {
  key: string;
  label: string;
  totalCuts: number;
}

function aggregateHistory(
  history: { cut_date: string; daily_cuts: number | null }[],
  resolution: TimeResolution
): ChartPoint[] {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const map = new Map<string, ChartPoint>();

  for (const record of history) {
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

export default function BranchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: device, isLoading } = useDevice(id);
  const { data: history = [] } = useCutsHistory(device?.fixno);
  const { data: transactions = [] } = useDeviceTransactions(device?.fixno);
  const [resolution, setResolution] = useState<TimeResolution>("monthly");

  const chartData = useMemo(() => aggregateHistory(history, resolution), [history, resolution]);

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

  const online = isOnline(device);
  const lowCuts = (device.remaining_cuts ?? 0) <= 10;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate("/")}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{device.branch_name || device.fixno}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {device.customer_name || "Sin cliente"} · <span className="font-mono text-xs">{device.fixno}</span>
          </p>
        </div>

        {/* Status Grid */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <HardDrive className="h-4 w-4" />
              Estado
            </div>
            <StatusBadge
              status={device.status === "enabled" ? "online" : "offline"}
              label={device.status === "enabled" ? "Activo" : "Inactivo"}
              pulse={device.status === "enabled"}
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              {online ? <Wifi className="h-4 w-4 text-status-online" /> : <WifiOff className="h-4 w-4 text-status-offline" />}
              Conectividad
            </div>
            <StatusBadge
              status={online ? "online" : "offline"}
              label={online ? "Online" : "Offline"}
              pulse={online}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Última conexión: {formatDateTime(device.latest_online_time)}
            </p>
          </div>

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
            <p className="mt-2 text-xl font-bold font-mono">{(device.total_cuts ?? 0).toLocaleString("es-AR")}</p>
            <p className="text-xs text-muted-foreground">Cortes totales</p>
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
                    <th className="pb-2 pr-4 text-right">Saldo</th>
                    <th className="pb-2 pr-4">Nº Factura</th>
                    <th className="pb-2">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {tx.bill_date
                          ? new Date(tx.bill_date).toLocaleDateString("es-CL", {
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
                      <td className="py-2 pr-4 text-right font-mono font-semibold text-green-400">
                        +{tx.quantity.toLocaleString("es-AR")}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-muted-foreground">
                        {tx.balance_after?.toLocaleString("es-AR") ?? "—"}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                        {tx.bill_no}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground truncate max-w-[120px]">
                        {tx.remark || "—"}
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
