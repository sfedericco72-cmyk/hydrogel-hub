import { useParams, useNavigate } from "react-router-dom";
import { mockBranches } from "@/data/mockBranches";
import { StatusBadge } from "@/components/StatusBadge";
import {
  ArrowLeft, Scissors, Wifi, WifiOff, Calendar, Monitor,
  Phone, User, MapPin, Clock, MessageSquare, AlertCircle,
  Eye, FileText, HardDrive
} from "lucide-react";

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("es-AR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

const noteTypeIcons = {
  consulta: MessageSquare,
  visita: Eye,
  incidencia: AlertCircle,
  general: FileText,
};

const noteTypeLabels = {
  consulta: "Consulta",
  visita: "Visita",
  incidencia: "Incidencia",
  general: "General",
};

const noteTypeColors = {
  consulta: "info" as const,
  visita: "online" as const,
  incidencia: "warning" as const,
  general: "info" as const,
};

export default function BranchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const branch = mockBranches.find(b => b.id === id);

  if (!branch) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Sucursal no encontrada</p>
      </div>
    );
  }

  const eqStatus = branch.equipmentStatus === "operativo" ? "online" : branch.equipmentStatus === "mantenimiento" ? "warning" : "offline";
  const eqLabel = branch.equipmentStatus === "operativo" ? "Operativo" : branch.equipmentStatus === "mantenimiento" ? "En mantenimiento" : "Fuera de servicio";
  const swStatus = branch.softwareStatus === "actualizado" ? "online" : branch.softwareStatus === "pendiente" ? "warning" : "offline";
  const swLabel = branch.softwareStatus === "actualizado" ? "Actualizado" : branch.softwareStatus === "pendiente" ? "Pendiente" : "Desactualizado";

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <button
          onClick={() => navigate("/")}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{branch.name}</h1>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {branch.address}, {branch.city}
          </div>
        </div>

        {/* Status Grid */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Equipment */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <HardDrive className="h-4 w-4" />
              Estado del Equipo
            </div>
            <StatusBadge status={eqStatus} label={eqLabel} pulse={branch.equipmentStatus === "operativo"} />
          </div>

          {/* Software */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Monitor className="h-4 w-4" />
              Software v{branch.softwareVersion}
            </div>
            <StatusBadge status={swStatus} label={swLabel} />
          </div>

          {/* Connectivity */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              {branch.connectivity === "online" ? <Wifi className="h-4 w-4 text-status-online" /> : <WifiOff className="h-4 w-4 text-status-offline" />}
              Conectividad
            </div>
            <StatusBadge
              status={branch.connectivity === "online" ? "online" : "offline"}
              label={branch.connectivity === "online" ? "Online" : "Offline"}
              pulse={branch.connectivity === "online"}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Última conexión: {formatDateTime(branch.lastConnection)}
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <Scissors className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-2 text-xl font-bold font-mono">{branch.cutsToday}</p>
            <p className="text-xs text-muted-foreground">Cortes hoy</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <Scissors className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-xl font-bold font-mono">{branch.totalCuts.toLocaleString("es-AR")}</p>
            <p className="text-xs text-muted-foreground">Cortes totales</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <Calendar className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">{formatDate(branch.lastVisit)}</p>
            <p className="text-xs text-muted-foreground">Última visita</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <Clock className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">{formatDate(branch.lastDataUpdate)}</p>
            <p className="text-xs text-muted-foreground">Últ. actualización</p>
          </div>
        </div>

        {/* Contact */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contacto</h2>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              {branch.contactName}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {branch.contactPhone}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Notas y Consultas ({branch.notes.length})
          </h2>
          {branch.notes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin notas registradas</p>
          ) : (
            <div className="space-y-3">
              {branch.notes.map(note => {
                const Icon = noteTypeIcons[note.type];
                return (
                  <div key={note.id} className="rounded-md border border-border bg-secondary/50 p-3">
                    <div className="mb-1.5 flex items-center gap-2">
                      <StatusBadge status={noteTypeColors[note.type]} label={noteTypeLabels[note.type]} />
                      <span className="text-xs text-muted-foreground">{formatDate(note.date)}</span>
                      <span className="text-xs text-muted-foreground">— {note.author}</span>
                    </div>
                    <p className="text-sm">{note.content}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
