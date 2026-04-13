import { StatCard } from "@/components/StatCard";
import { DeviceCard } from "@/components/DeviceCard";
import { Building2, Scissors, Wifi, AlertTriangle, Search, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useDevices, isOnline, hasAlert } from "@/hooks/useDevices";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "alerts">("all");
  const [syncing, setSyncing] = useState(false);
  const { data: devices = [], isLoading, refetch } = useDevices();

  const totalCutsToday = devices.reduce((sum, d) => sum + (d.cuts_today ?? 0), 0);
  const onlineCount = devices.filter(isOnline).length;
  const alertCount = devices.filter(hasAlert).length;

  const filtered = devices
    .filter(d => {
      if (filter === "alerts") return hasAlert(d);
      return true;
    })
    .filter(d =>
      (d.branch_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.customer_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.fixno ?? "").toLowerCase().includes(search.toLowerCase())
    );

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
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              Todos ({devices.length})
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(device => (
              <DeviceCard key={device.id} device={device} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                No se encontraron dispositivos
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
