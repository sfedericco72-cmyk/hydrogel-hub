import { StatCard } from "@/components/StatCard";
import { DeviceCard } from "@/components/DeviceCard";
import { Building2, Scissors, Wifi, AlertTriangle, Search, RefreshCw, Users, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { useDevices, isOnline, hasAlert } from "@/hooks/useDevices";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ClientFilter = "all" | string; // "all" or specific client name

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<ClientFilter>("all");
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [clientsExpanded, setClientsExpanded] = useState(true);
  const { data: devices = [], isLoading, refetch } = useDevices();

  const onlineCount = devices.filter(isOnline).length;
  const alertCount = devices.filter(hasAlert).length;

  // Dynamic client list from data
  const clients = useMemo(() => {
    const map = new Map<string, number>();
    devices.forEach(d => {
      const name = d.customer_name || "Sin cliente";
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [devices]);

  const isSpecificClient = clientFilter !== "all";

  // Compute alert count scoped to current client filter
  const scopedDevices = isSpecificClient
    ? devices.filter(d => (d.customer_name || "Sin cliente") === clientFilter)
    : devices;
  const scopedAlertCount = scopedDevices.filter(hasAlert).length;

  const filtered = devices
    .filter(d => {
      if (isSpecificClient && (d.customer_name || "Sin cliente") !== clientFilter) return false;
      if (alertsOnly && !hasAlert(d)) return false;
      return true;
    })
    .filter(d =>
      (d.branch_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.customer_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.fixno ?? "").toLowerCase().includes(search.toLowerCase())
    );

  // Group by customer
  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, d) => {
    const key = d.customer_name || "Sin cliente";
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

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Panel de Control</h1>
            <p className="mt-1 text-sm text-muted-foreground">Seguimiento de máquinas de corte de hidrogel</p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </button>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatCard title="Dispositivos" value={devices.length} icon={Building2} variant="primary" />
          <StatCard title="Cortes totales" value={devices.reduce((s, d) => s + (d.total_cuts ?? 0), 0).toLocaleString("es-AR")} icon={Scissors} variant="success" subtitle="Todos los dispositivos" />
          <StatCard title="Online" value={`${onlineCount}/${devices.length}`} icon={Wifi} variant="success" />
          <StatCard title="Alertas" value={alertCount} icon={AlertTriangle} variant={alertCount > 0 ? "danger" : "default"} />
        </div>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1">
            {/* Top-level filters */}
            <div className="flex flex-wrap gap-2">
              <FilterBtn active={clientFilter === "all" && !alertsOnly} onClick={() => { setClientFilter("all"); setAlertsOnly(false); }}>
                Todos ({devices.length})
              </FilterBtn>
              <FilterBtn active={alertsOnly} onClick={() => setAlertsOnly(prev => !prev)} danger>
                Alertas ({scopedAlertCount})
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
                  {clients.map(([name, count]) => (
                    <button
                      key={name}
                      onClick={() => setClientFilter(clientFilter === name ? "all" : name)}
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
                    <DeviceCard key={device.id} device={device} />
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

function FilterBtn({ active, onClick, children, danger }: {
  active: boolean; onClick: () => void; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? danger ? "bg-status-offline text-foreground" : "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}
