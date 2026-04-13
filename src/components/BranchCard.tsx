import { Branch } from "@/types/branch";
import { StatusBadge } from "./StatusBadge";
import { Scissors, Wifi, WifiOff, MapPin, Calendar, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

function getEquipmentBadge(status: Branch["equipmentStatus"]) {
  switch (status) {
    case "operativo": return { status: "online" as const, label: "Operativo" };
    case "mantenimiento": return { status: "warning" as const, label: "Mantenimiento" };
    case "fuera_de_servicio": return { status: "offline" as const, label: "Fuera de servicio" };
  }
}

function getSoftwareBadge(status: Branch["softwareStatus"]) {
  switch (status) {
    case "actualizado": return { status: "online" as const, label: "SW Actualizado" };
    case "pendiente": return { status: "warning" as const, label: "SW Pendiente" };
    case "desactualizado": return { status: "offline" as const, label: "SW Desactualizado" };
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function BranchCard({ branch }: { branch: Branch }) {
  const navigate = useNavigate();
  const eq = getEquipmentBadge(branch.equipmentStatus);
  const sw = getSoftwareBadge(branch.softwareStatus);
  const pendingNotes = branch.notes.filter(n => n.type === "consulta" || n.type === "incidencia").length;

  return (
    <div
      onClick={() => navigate(`/sucursal/${branch.id}`)}
      className="group cursor-pointer rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-accent/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{branch.name}</h3>
            {pendingNotes > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-status-warning/20 px-1.5 text-[10px] font-bold text-status-warning">
                {pendingNotes}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{branch.address}, {branch.city}</span>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatusBadge status={eq.status} label={eq.label} pulse={branch.equipmentStatus === "operativo"} />
        <StatusBadge status={sw.status} label={sw.label} />
        <StatusBadge
          status={branch.connectivity === "online" ? "online" : "offline"}
          label={branch.connectivity === "online" ? "Online" : "Offline"}
          pulse={branch.connectivity === "online"}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Scissors className="h-3.5 w-3.5" />
          <span className="font-mono font-medium text-foreground">{branch.cutsToday}</span>
          <span>hoy</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {branch.connectivity === "online" ? <Wifi className="h-3.5 w-3.5 text-status-online" /> : <WifiOff className="h-3.5 w-3.5 text-status-offline" />}
          <span className="truncate">{formatDate(branch.lastConnection)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span className="truncate">{formatDate(branch.lastVisit)}</span>
        </div>
      </div>
    </div>
  );
}
