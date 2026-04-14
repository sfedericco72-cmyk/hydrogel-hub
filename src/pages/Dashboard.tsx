import { StatCard } from "@/components/StatCard";
import { MonthlyTimeline } from "@/components/MonthlyTimeline";
import { DeviceCard } from "@/components/DeviceCard";
import { Building2, Search, RefreshCw, Users, ChevronDown, ChevronRight, Clock, Activity, WifiOff, Package, Mail, TrendingUp, Settings } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDevices, hasAlert, useLastCutDates, useAvgDailyCuts, useMonthlyCutsMap, getDeviceState, type DeviceState } from "@/hooks/useDevices";
import { titleCase } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ClientFilter = "all" | string;
type StateFilter = "all" | DeviceState;

function formatSyncDate(dateStr: string | null) {
  if (!dateStr) return "Nunca";
  return new Date(dateStr).toLocaleString("es-CL", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [clientFilter, setClientFilter] = useState<ClientFilter>(() => searchParams.get("client") || "all");
  const [stateFilter, setStateFilter] = useState<StateFilter>(() => (searchParams.get("state") as StateFilter) || "all");
  const [syncing, setSyncing] = useState(false);
  const [clientsExpanded, setClientsExpanded] = useState(true);

  // Sync state to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (clientFilter !== "all") params.set("client", clientFilter);
    if (stateFilter !== "all") params.set("state", stateFilter);
    setSearchParams(params, { replace: true });
    setSearchParams(params, { replace: true });
  }, [search, clientFilter, stateFilter, setSearchParams]);
  const { data: devices = [], isLoading, refetch } = useDevices();
  const { data: lastCutDates } = useLastCutDates();
  const { data: avgDailyCuts } = useAvgDailyCuts();
  const { data: monthlyCutsMap } = useMonthlyCutsMap();

  const lastSyncDate = useMemo(() => {
    if (devices.length === 0) return null;
    return devices.reduce((latest, d) =>
      !latest || d.last_synced_at > latest ? d.last_synced_at : latest,
      "" as string
    );
  }, [devices]);

  const scopedDevices = useMemo(() => {
    if (clientFilter === "all") return devices;
    return devices.filter(d => titleCase(d.customer_name) === clientFilter);
  }, [devices, clientFilter]);

  const stateCounts = useMemo(() => {
    const counts: Record<DeviceState, number> = { stock: 0, active: 0, disconnected: 0 };
    scopedDevices.forEach(d => { counts[getDeviceState(d, lastCutDates)]++; });
    return counts;
  }, [scopedDevices, lastCutDates]);
  

  const clients = useMemo(() => {
    const map = new Map<string, number>();
    devices.forEach(d => {
      const name = titleCase(d.customer_name) || "Sin cliente";
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [devices]);

  const filtered = scopedDevices
    .filter(d => {
      if (stateFilter !== "all" && getDeviceState(d, lastCutDates) !== stateFilter) return false;
      return true;
    })
    .filter(d =>
      (d.branch_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.customer_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.fixno ?? "").toLowerCase().includes(search.toLowerCase())
    );

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, d) => {
    const key = titleCase(d.customer_name) || "Sin cliente";
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  async function handleSync() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-cutabc", { method: "POST" });
      if (error) throw error;
      toast.success(`Sincronización completa: ${data.active_synced} dispositivos actualizados`);
      refetch();
    } catch (e: any) {
      toast.error("Error al sincronizar: " + e.message);
    } finally {
      setSyncing(false);
    }
  }

  function toggleStateFilter(state: DeviceState) {
    setStateFilter(prev => prev === state ? "all" : state);
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Panel de Control</h1>
            <p className="mt-1 text-sm text-muted-foreground">Seguimiento de máquinas de corte de hidrogel</p>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Última sincronización: {formatSyncDate(lastSyncDate)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </button>
            <button
              onClick={() => navigate(`/attach-rate${clientFilter !== "all" ? `?client=${encodeURIComponent(clientFilter)}` : ""}`)}
              className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
            >
              <TrendingUp className="h-4 w-4" />
              Attach Rate
            </button>
            <button
              onClick={() => navigate("/emails")}
              className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
            >
              <Mail className="h-4 w-4" />
              Emails
            </button>
            <button
              onClick={() => navigate("/setup")}
              className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mb-8">
          <MonthlyTimeline devices={devices} monthlyCutsMap={monthlyCutsMap} />
        </div>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap gap-2">
              <FilterBtn active={stateFilter === "all"} onClick={() => setStateFilter("all")}>
                Todos ({scopedDevices.length})
              </FilterBtn>
              <FilterBtn active={stateFilter === "active"} onClick={() => toggleStateFilter("active")}>
                <Activity className="mr-1 inline h-3.5 w-3.5" />
                Activos ({stateCounts.active})
              </FilterBtn>
              <FilterBtn active={stateFilter === "disconnected"} onClick={() => toggleStateFilter("disconnected")} warning>
                <WifiOff className="mr-1 inline h-3.5 w-3.5" />
                Desconectados ({stateCounts.disconnected})
              </FilterBtn>
              <FilterBtn active={stateFilter === "stock"} onClick={() => toggleStateFilter("stock")}>
                <Package className="mr-1 inline h-3.5 w-3.5" />
                En stock ({stateCounts.stock})
              </FilterBtn>
            </div>

            {/* Client tree */}
            <div className="mt-1">
              <button
                onClick={() => setClientsExpanded(prev => !prev)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {clientsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <Users className="h-3.5 w-3.5" />
                Clientes ({clients.length})
              </button>

              {clientsExpanded && (
                <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2">
                  <button
                    onClick={() => setClientFilter("all")}
                    className={`flex items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                      clientFilter === "all"
                        ? "bg-primary/20 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span>Todos los clientes</span>
                    <span className="ml-2 shrink-0 text-xs opacity-70">{devices.length}</span>
                  </button>
                  {clients.map(([name, count]) => (
                    <button
                      key={name}
                      onClick={() => setClientFilter(name)}
                      className={`flex items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                        clientFilter === name
                          ? "bg-primary/20 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <span className="truncate">{name}</span>
                      <span className="ml-2 shrink-0 text-xs opacity-70">{count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar dispositivo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-secondary py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-64"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Cargando dispositivos...</div>
        ) : (
          <div className="space-y-6">
            {sortedGroups.map(([clientName, clientDevs]) => (
              <div key={clientName}>
                <div className="mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{clientName}</h2>
                  <span className="text-xs text-muted-foreground">({clientDevs.length})</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {clientDevs.map(device => (
                    <DeviceCard key={device.id} device={device} lastCutDates={lastCutDates} avgDailyCuts={avgDailyCuts} monthlyCutsMap={monthlyCutsMap} />
                  ))}
                </div>
              </div>
            ))}
            {sortedGroups.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">No se encontraron dispositivos</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, children, danger, warning }: {
  active: boolean; onClick: () => void; children: React.ReactNode; danger?: boolean; warning?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? danger ? "bg-status-offline text-foreground"
            : warning ? "bg-yellow-600/80 text-foreground"
            : "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}
