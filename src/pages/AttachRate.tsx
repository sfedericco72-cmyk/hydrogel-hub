import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, TrendingUp, Smartphone, Scissors, ChevronDown } from "lucide-react";
import { useDevices, useMonthlyCutsMap } from "@/hooks/useDevices";
import { useEquipmentSales, useUpsertEquipmentSale, useDeleteEquipmentSale } from "@/hooks/useEquipmentSales";
import { toast } from "sonner";

function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().substring(0, 7));
  }
  return months;
}

function formatMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${names[parseInt(m) - 1]} ${y.slice(2)}`;
}

export default function AttachRate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialClient = searchParams.get("client") || "all";

  const [selectedClient, setSelectedClient] = useState(initialClient);
  const [showForm, setShowForm] = useState(false);

  const { data: devices = [] } = useDevices();
  const { data: monthlyCutsMap } = useMonthlyCutsMap(12);
  const { data: sales = [], isLoading: salesLoading } = useEquipmentSales(selectedClient);
  const upsertSale = useUpsertEquipmentSale();
  const deleteSale = useDeleteEquipmentSale();

  const months = useMemo(() => getLastNMonths(12), []);

  const clients = useMemo(() => {
    const set = new Set<string>();
    devices.forEach(d => { if (d.customer_name) set.add(d.customer_name); });
    return Array.from(set).sort();
  }, [devices]);

  // Map: month → total láminas cortadas (filtered by client)
  const cutsPerMonth = useMemo(() => {
    const map = new Map<string, number>();
    if (!monthlyCutsMap) return map;

    const clientDeviceFixnos = new Set(
      selectedClient === "all"
        ? devices.map(d => d.fixno)
        : devices.filter(d => d.customer_name === selectedClient).map(d => d.fixno)
    );

    monthlyCutsMap.forEach((deviceMonths, fixno) => {
      if (!clientDeviceFixnos.has(fixno)) return;
      deviceMonths.forEach((cuts, month) => {
        map.set(month, (map.get(month) ?? 0) + cuts);
      });
    });

    return map;
  }, [monthlyCutsMap, devices, selectedClient]);

  // Map: month → units sold
  const salesPerMonth = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach(s => {
      map.set(s.period, (map.get(s.period) ?? 0) + s.units_sold);
    });
    return map;
  }, [sales]);

  // Build attach rate table data
  const tableData = useMemo(() => {
    return months.map(month => {
      const cuts = cutsPerMonth.get(month) ?? 0;
      const sold = salesPerMonth.get(month) ?? 0;
      const rate = sold > 0 ? (cuts / sold) * 100 : null;
      return { month, cuts, sold, rate };
    });
  }, [months, cutsPerMonth, salesPerMonth]);

  // Summary stats
  const summary = useMemo(() => {
    const totalCuts = tableData.reduce((s, r) => s + r.cuts, 0);
    const totalSold = tableData.reduce((s, r) => s + r.sold, 0);
    const avgRate = totalSold > 0 ? (totalCuts / totalSold) * 100 : null;
    const lastThree = tableData.slice(-3);
    const l3Cuts = lastThree.reduce((s, r) => s + r.cuts, 0);
    const l3Sold = lastThree.reduce((s, r) => s + r.sold, 0);
    const trendRate = l3Sold > 0 ? (l3Cuts / l3Sold) * 100 : null;
    return { totalCuts, totalSold, avgRate, trendRate };
  }, [tableData]);

  // Max bar height reference
  const maxCuts = Math.max(...tableData.map(d => d.cuts), 1);
  const maxSold = Math.max(...tableData.map(d => d.sold), 1);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="rounded-lg p-2 hover:bg-accent transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Attach Rate</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Láminas cortadas vs. equipos vendidos
            </p>
          </div>
        </div>

        {/* Client selector */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="appearance-none rounded-lg border border-input bg-secondary py-2 pl-3 pr-8 text-sm font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todos los clientes</option>
              {clients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <button
            onClick={() => setShowForm(prev => !prev)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Cargar ventas
          </button>
        </div>

        {/* Entry form */}
        {showForm && (
          <SalesForm
            clients={clients}
            defaultClient={selectedClient !== "all" ? selectedClient : ""}
            onSubmit={async (data) => {
              try {
                await upsertSale.mutateAsync(data);
                toast.success(`Ventas guardadas: ${data.units_sold} equipos en ${formatMonth(data.period)}`);
              } catch (e: any) {
                toast.error("Error: " + e.message);
              }
            }}
            loading={upsertSale.isPending}
          />
        )}

        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard
            icon={<Scissors className="h-5 w-5 text-primary" />}
            label="Total láminas"
            value={summary.totalCuts.toLocaleString("es-AR")}
          />
          <SummaryCard
            icon={<Smartphone className="h-5 w-5 text-emerald-400" />}
            label="Equipos vendidos"
            value={summary.totalSold.toLocaleString("es-AR")}
          />
          <SummaryCard
            icon={<TrendingUp className="h-5 w-5 text-amber-400" />}
            label="Attach rate (12m)"
            value={summary.avgRate !== null ? `${summary.avgRate.toFixed(1)}%` : "—"}
          />
          <SummaryCard
            icon={<TrendingUp className="h-5 w-5 text-primary" />}
            label="Tendencia (3m)"
            value={summary.trendRate !== null ? `${summary.trendRate.toFixed(1)}%` : "—"}
          />
        </div>

        {/* Chart */}
        <div className="mb-8 rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Evolución mensual
          </h3>
          <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: 200 }}>
            {tableData.map(d => {
              const cutsH = (d.cuts / maxCuts) * 160;
              const soldH = (d.sold / maxSold) * 160;
              return (
                <div key={d.month} className="flex flex-col items-center gap-1 flex-1 min-w-[48px]">
                  <div className="flex items-end gap-0.5" style={{ height: 170 }}>
                    <div
                      className="w-3 rounded-t bg-primary/80 transition-all"
                      style={{ height: cutsH }}
                      title={`Láminas: ${d.cuts.toLocaleString("es-AR")}`}
                    />
                    <div
                      className="w-3 rounded-t bg-emerald-500/70 transition-all"
                      style={{ height: soldH }}
                      title={`Equipos: ${d.sold.toLocaleString("es-AR")}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formatMonth(d.month)}</span>
                  {d.rate !== null && (
                    <span className={`text-[10px] font-semibold tabular-nums ${
                      d.rate >= 80 ? "text-emerald-400" : d.rate >= 50 ? "text-amber-400" : "text-red-400"
                    }`}>
                      {d.rate.toFixed(0)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/80" /> Láminas</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/70" /> Equipos</span>
          </div>
        </div>

        {/* Data table */}
        <div className="rounded-lg border bg-card p-5 overflow-x-auto">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Detalle mensual
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">Mes</th>
                <th className="pb-2 px-2 text-right text-xs font-medium text-muted-foreground">Láminas</th>
                <th className="pb-2 px-2 text-right text-xs font-medium text-muted-foreground">Equipos</th>
                <th className="pb-2 px-2 text-right text-xs font-medium text-muted-foreground">Attach Rate</th>
              </tr>
            </thead>
            <tbody>
              {[...tableData].reverse().map(d => (
                <tr key={d.month} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-4 font-medium">{formatMonth(d.month)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{d.cuts.toLocaleString("es-AR")}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {d.sold > 0 ? d.sold.toLocaleString("es-AR") : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {d.rate !== null ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                        d.rate >= 80 ? "bg-emerald-500/20 text-emerald-400"
                        : d.rate >= 50 ? "bg-amber-500/20 text-amber-400"
                        : "bg-red-500/20 text-red-400"
                      }`}>
                        {d.rate.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sales entries list */}
        {sales.length > 0 && (
          <div className="mt-6 rounded-lg border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Registros cargados
            </h3>
            <div className="space-y-2">
              {sales.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground">{formatMonth(s.period)}</span>
                    <span className="text-sm font-medium">{s.customer_name}</span>
                    {s.branch_name && <span className="text-xs text-muted-foreground">· {s.branch_name}</span>}
                    <span className="text-sm tabular-nums font-semibold text-emerald-400">{s.units_sold}</span>
                    <span className="text-xs text-muted-foreground">equipos</span>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await deleteSale.mutateAsync(s.id);
                        toast.success("Registro eliminado");
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function SalesForm({
  clients,
  defaultClient,
  onSubmit,
  loading,
}: {
  clients: string[];
  defaultClient: string;
  onSubmit: (data: { customer_name: string; period: string; units_sold: number; branch_name?: string; notes?: string }) => void;
  loading: boolean;
}) {
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [client, setClient] = useState(defaultClient);
  const [period, setPeriod] = useState(defaultPeriod);
  const [units, setUnits] = useState("");
  const [branch, setBranch] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="mb-6 rounded-lg border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Cargar ventas de equipos
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Cliente *</label>
          <select
            value={client}
            onChange={e => setClient(e.target.value)}
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Seleccionar...</option>
            {clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Período *</label>
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Equipos vendidos *</label>
          <input
            type="number"
            min="0"
            value={units}
            onChange={e => setUnits(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Sucursal (opcional)</label>
          <input
            type="text"
            value={branch}
            onChange={e => setBranch(e.target.value)}
            placeholder="Todas"
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-xs text-muted-foreground">Notas (opcional)</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ej: dato extraído del reporte semanal"
          className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <button
        disabled={!client || !period || !units || loading}
        onClick={() => {
          onSubmit({
            customer_name: client,
            period,
            units_sold: parseInt(units),
            branch_name: branch || undefined,
            notes: notes || undefined,
          });
          setUnits("");
          setNotes("");
        }}
        className="mt-3 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}
