import { MonthlyTimeline } from "@/components/MonthlyTimeline";
import { DeviceCard } from "@/components/DeviceCard";
import { Building2, Search, RefreshCw, ChevronDown, ChevronRight, Clock, Activity, WifiOff, Package, Mail, TrendingUp, Settings, MapPin, AlertTriangle } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLastCutDates, useAvgDailyCuts, useMonthlyCutsMap, getActivityState, isDeviceDisconnected, type ActivityState } from "@/hooks/useDevices";
import { useAssignedHierarchy, flatDevicesFromHierarchy, assignmentStartDates, type HierarchyClient } from "@/hooks/useAssignedHierarchy";
import { useDefaultTenant } from "@/hooks/useClients";
import { titleCase } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ClientFilter = "all" | string;
type StateFilter = "all" | "active" | "inactive" | "disconnected";

function formatSyncDate(dateStr: string | null) {
  if (!dateStr) return "Nunca";
  return new Date(dateStr).toLocaleString("es-CL", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [clientFilter, setClientFilter] = useState<ClientFilter>(() => searchParams.get("client") || "all");
  const [stateFilter, setStateFilter] = useState<StateFilter>(() => (searchParams.get("state") as StateFilter) || "all");
  const [syncing, setSyncing] = useState(false);
  const [clientsExpanded, setClientsExpanded] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (clientFilter !== "all") params.set("client", clientFilter);
    if (stateFilter !== "all") params.set("state", stateFilter);
    setSearchParams(params, { replace: true });
  }, [search, clientFilter, stateFilter, setSearchParams]);

  const { data: tenant } = useDefaultTenant();
  const { data: hierarchy = [], isLoading } = useAssignedHierarchy(tenant?.id);
  const allDevices = useMemo(() => flatDevicesFromHierarchy(hierarchy), [hierarchy]);
  const startDates = useMemo(() => assignmentStartDates(hierarchy), [hierarchy]);

  const { data: rawLastCutDates } = useLastCutDates();
  const { data: rawAvgDailyCuts } = useAvgDailyCuts();
  const { data: rawMonthlyCutsMap } = useMonthlyCutsMap();

  // Filter cuts data to only include records from the assignment start date
  const lastCutDates = useMemo(() => {
    if (!rawLastCutDates) return undefined;
    const filtered = new Map<string, string>();
    rawLastCutDates.forEach((date, fixno) => {
      const start = startDates.get(fixno);
      if (start && date >= start) filtered.set(fixno, date);
      else if (!start) { /* not assigned, skip */ }
    });
    return filtered;
  }, [rawLastCutDates, startDates]);

  const avgDailyCuts = useMemo(() => {
    // avgDailyCuts already only considers last 30 days, but we still need to
    // exclude devices that aren't assigned
    if (!rawAvgDailyCuts) return undefined;
    const filtered = new Map<string, number>();
    rawAvgDailyCuts.forEach((avg, fixno) => {
      if (startDates.has(fixno)) filtered.set(fixno, avg);
    });
    return filtered;
  }, [rawAvgDailyCuts, startDates]);

  const monthlyCutsMap = useMemo(() => {
    if (!rawMonthlyCutsMap) return undefined;
    const filtered = new Map<string, Map<string, number>>();
    rawMonthlyCutsMap.forEach((monthMap, fixno) => {
      const start = startDates.get(fixno);
      if (!start) return;
      const startMonth = start.slice(0, 7); // YYYY-MM
      const filteredMonths = new Map<string, number>();
      monthMap.forEach((cuts, month) => {
        if (month >= startMonth) filteredMonths.set(month, cuts);
      });
      if (filteredMonths.size > 0) filtered.set(fixno, filteredMonths);
    });
    return filtered;
  }, [rawMonthlyCutsMap, startDates]);

  const lastSyncDate = useMemo(() => {
    if (allDevices.length === 0) return null;
    return allDevices.reduce((latest, d) =>
      !latest || d.last_synced_at > latest ? d.last_synced_at : latest,
      "" as string
    );
  }, [allDevices]);

  // Filter hierarchy by client
  const scopedHierarchy = useMemo(() => {
    if (clientFilter === "all") return hierarchy;
    return hierarchy.filter(c => c.name === clientFilter);
  }, [hierarchy, clientFilter]);

  const scopedDevices = useMemo(() => flatDevicesFromHierarchy(scopedHierarchy), [scopedHierarchy]);

  const stateCounts = useMemo(() => {
    const counts = { active: 0, inactive: 0, disconnected: 0 };
    scopedDevices.forEach(d => {
      counts[getActivityState(d, lastCutDates)]++;
      if (isDeviceDisconnected(d)) counts.disconnected++;
    });
    return counts;
  }, [scopedDevices, lastCutDates]);

  // Apply search + state filters to hierarchy
  const filteredHierarchy = useMemo(() => {
    return scopedHierarchy.map(client => {
      const filteredPOS = client.pointsOfSale.map(pos => {
        const filteredDevices = pos.devices.filter(ad => {
          const d = ad.device;
          if (stateFilter === "disconnected" && !isDeviceDisconnected(d)) return false;
          if (stateFilter === "active" && getActivityState(d, lastCutDates) !== "active") return false;
          if (stateFilter === "inactive" && getActivityState(d, lastCutDates) !== "inactive") return false;
          const q = search.toLowerCase();
          if (q && !(
            (d.branch_name ?? "").toLowerCase().includes(q) ||
            (d.customer_name ?? "").toLowerCase().includes(q) ||
            (d.fixno ?? "").toLowerCase().includes(q) ||
            pos.name.toLowerCase().includes(q) ||
            client.name.toLowerCase().includes(q)
          )) return false;
          return true;
        });
        return { ...pos, devices: filteredDevices };
      }).filter(pos => pos.devices.length > 0);
      return { ...client, pointsOfSale: filteredPOS, deviceCount: filteredPOS.reduce((s, p) => s + p.devices.length, 0) };
    }).filter(c => c.pointsOfSale.length > 0);
  }, [scopedHierarchy, stateFilter, search, lastCutDates]);

  async function handleSync() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-cutabc", { method: "POST" });
      if (error) throw error;
      toast.success(`Sincronización completa: ${data.active_synced} dispositivos actualizados`);
    } catch (e: any) {
      toast.error("Error al sincronizar: " + e.message);
    } finally {
      setSyncing(false);
    }
  }

  function toggleStateFilter(state: DeviceState) {
    setStateFilter(prev => prev === state ? "all" : state);
  }

  const isEmpty = hierarchy.length === 0 && !isLoading;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <DashboardHeader
          lastSyncDate={lastSyncDate}
          syncing={syncing}
          onSync={handleSync}
          clientFilter={clientFilter}
          navigate={navigate}
        />

        {isEmpty ? (
          <EmptyState navigate={navigate} />
        ) : (
          <>
            {/* Timeline */}
            <div className="mb-8">
              <MonthlyTimeline devices={allDevices} monthlyCutsMap={monthlyCutsMap} />
            </div>

            {/* Filters */}
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
                  <FilterBtn active={stateFilter === "inactive"} onClick={() => toggleStateFilter("inactive")} warning>
                    Inactivos ({stateCounts.inactive})
                  </FilterBtn>
                </div>

                {/* Client tree */}
                <ClientTree
                  hierarchy={hierarchy}
                  clientFilter={clientFilter}
                  setClientFilter={setClientFilter}
                  clientsExpanded={clientsExpanded}
                  setClientsExpanded={setClientsExpanded}
                  allDeviceCount={allDevices.length}
                />
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

            {/* Device list — hierarchical */}
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">Cargando dispositivos...</div>
            ) : (
              <div className="space-y-8">
                {filteredHierarchy.map(client => (
                  <div key={client.id}>
                    <div className="mb-3 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        {client.name}
                      </h2>
                      <span className="text-xs text-muted-foreground">({client.deviceCount})</span>
                    </div>

                    <div className="ml-2 space-y-4 border-l border-border pl-4">
                      {client.pointsOfSale.map(pos => (
                        <div key={pos.id}>
                          <div className="mb-2 flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            <h3 className="text-sm font-medium text-foreground">{pos.name}</h3>
                            {pos.city && (
                              <span className="text-xs text-muted-foreground">· {pos.city}</span>
                            )}
                            <span className="text-xs text-muted-foreground">({pos.devices.length})</span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {pos.devices.map(ad => (
                              <DeviceCard
                                key={ad.device.id}
                                device={ad.device}
                                lastCutDates={lastCutDates}
                                avgDailyCuts={avgDailyCuts}
                                monthlyCutsMap={monthlyCutsMap}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {filteredHierarchy.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">No se encontraron dispositivos</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────── */

function DashboardHeader({ lastSyncDate, syncing, onSync, clientFilter, navigate }: {
  lastSyncDate: string | null;
  syncing: boolean;
  onSync: () => void;
  clientFilter: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
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
        <button onClick={onSync} disabled={syncing}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </button>
        <button onClick={() => navigate(`/attach-rate${clientFilter !== "all" ? `?client=${encodeURIComponent(clientFilter)}` : ""}`)}
          className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent">
          <TrendingUp className="h-4 w-4" /> Attach Rate
        </button>
        <button onClick={() => navigate("/emails")}
          className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent">
          <Mail className="h-4 w-4" /> Emails
        </button>
        <button onClick={() => navigate("/clientes")}
          className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent">
          <Building2 className="h-4 w-4" /> Clientes
        </button>
        <button onClick={() => navigate("/setup")}
          className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-card py-20">
      <AlertTriangle className="h-10 w-10 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Sin equipos asignados</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Para ver el panel de control, primero creá puntos de venta dentro de tus clientes y asigná equipos desde la sección Clientes.
      </p>
      <button
        onClick={() => navigate("/clientes")}
        className="mt-2 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Building2 className="h-4 w-4" />
        Ir a Clientes
      </button>
    </div>
  );
}

function ClientTree({ hierarchy, clientFilter, setClientFilter, clientsExpanded, setClientsExpanded, allDeviceCount }: {
  hierarchy: HierarchyClient[];
  clientFilter: string;
  setClientFilter: (f: string) => void;
  clientsExpanded: boolean;
  setClientsExpanded: (v: boolean | ((p: boolean) => boolean)) => void;
  allDeviceCount: number;
}) {
  return (
    <div className="mt-1">
      <button
        onClick={() => setClientsExpanded(prev => !prev)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {clientsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Building2 className="h-3.5 w-3.5" />
        Clientes ({hierarchy.length})
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
            <span className="ml-2 shrink-0 text-xs opacity-70">{allDeviceCount}</span>
          </button>
          {hierarchy.map(c => (
            <button
              key={c.id}
              onClick={() => setClientFilter(c.name)}
              className={`flex items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                clientFilter === c.name
                  ? "bg-primary/20 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <span className="truncate">{c.name}</span>
              <span className="ml-2 shrink-0 text-xs opacity-70">{c.deviceCount}</span>
            </button>
          ))}
        </div>
      )}
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
