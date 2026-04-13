import { mockBranches } from "@/data/mockBranches";
import { StatCard } from "@/components/StatCard";
import { BranchCard } from "@/components/BranchCard";
import { Building2, Scissors, Wifi, AlertTriangle, Search } from "lucide-react";
import { useState } from "react";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "alerts">("all");

  const totalCutsToday = mockBranches.reduce((sum, b) => sum + b.cutsToday, 0);
  const onlineCount = mockBranches.filter(b => b.connectivity === "online").length;
  const alertCount = mockBranches.filter(
    b => b.equipmentStatus !== "operativo" || b.softwareStatus === "desactualizado" || b.connectivity === "offline"
  ).length;

  const filtered = mockBranches
    .filter(b => {
      if (filter === "alerts") {
        return b.equipmentStatus !== "operativo" || b.softwareStatus === "desactualizado" || b.connectivity === "offline";
      }
      return true;
    })
    .filter(b =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.city.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Panel de Control
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seguimiento de máquinas de corte de hidrogel
          </p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatCard title="Sucursales" value={mockBranches.length} icon={Building2} variant="primary" />
          <StatCard title="Cortes hoy" value={totalCutsToday} icon={Scissors} variant="success" subtitle="Total todas las sucursales" />
          <StatCard title="Online" value={`${onlineCount}/${mockBranches.length}`} icon={Wifi} variant="success" />
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
              Todas ({mockBranches.length})
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
              placeholder="Buscar sucursal..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-secondary py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-64"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(branch => (
            <BranchCard key={branch.id} branch={branch} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No se encontraron sucursales
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
