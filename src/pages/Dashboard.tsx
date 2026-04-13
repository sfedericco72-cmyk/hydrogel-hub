import { StatCard } from "@/components/StatCard";
import { DeviceCard } from "@/components/DeviceCard";
import { Building2, Scissors, Wifi, AlertTriangle, Search, RefreshCw, Users, Crown } from "lucide-react";
import { useState } from "react";
import { useDevices, isOnline, hasAlert } from "@/hooks/useDevices";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const KMG_CLIENT = "CH/KMG ANALYTICS SPA";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "alerts" | "own" | "clients">("all");
  const [syncing, setSyncing] = useState(false);
  const { data: devices = [], isLoading, refetch } = useDevices();

  const onlineCount = devices.filter(isOnline).length;
  const alertCount = devices.filter(hasAlert).length;
  const ownDevices = devices.filter(d => d.customer_name === KMG_CLIENT);
  const clientDevices = devices.filter(d => d.customer_name && d.customer_name !== KMG_CLIENT);

  const filtered = devices
    .filter(d => {
      if (filter === "alerts") return hasAlert(d);
      if (filter === "own") return d.customer_name === KMG_CLIENT;
      if (filter === "clients") return d.customer_name && d.customer_name !== KMG_CLIENT;
      return true;
    })
    .filter(d =>
      (d.branch_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.customer_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.fixno ?? "").toLowerCase().includes(search.toLowerCase())
    );

  // Group filtered devices by customer
  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, d) => {
    const key = d.customer_name || "Sin cliente";
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  // Sort: KMG first, then alphabetically
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    if (a === KMG_CLIENT) return -1;
    if (b === KMG_CLIENT) return 1;
    return a.localeCompare(b);
  });

  async function handleSync() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-cutabc", {
        method: "POST",
      });
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
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Panel de Control
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Seguimiento de máquinas de corte de hidrogel
            </p>
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

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              Todos ({devices.length})
            </button>
            <button
              onClick={() => setFilter("own")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === "own" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              <Crown className="h-3.5 w-3.5" />
              Propios ({ownDevices.length})
            </button>
            <button
              onClick={() => setFilter("clients")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === "clients" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Clientes ({clientDevices.length})
            </button>
            <button
              onClick={() => setFilter("alerts")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === "alerts" ? "bg-status-offline text-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              Con alertas ({alertCount})
            </button>
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
            {sortedGroups.map(([clientName, clientDevices]) => (
              <div key={clientName}>
                <div className="mb-3 flex items-center gap-2">
                  {clientName === KMG_CLIENT ? (
                    <Crown className="h-4 w-4 text-primary" />
                  ) : (
                    <Users className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {clientName === KMG_CLIENT ? "Propios (KMG Analytics)" : clientName}
                  </h2>
                  <span className="text-xs text-muted-foreground">({clientDevices.length})</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {clientDevices.map(device => (
                    <DeviceCard key={device.id} device={device} />
                  ))}
                </div>
              </div>
            ))}
            {sortedGroups.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                No se encontraron dispositivos
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
