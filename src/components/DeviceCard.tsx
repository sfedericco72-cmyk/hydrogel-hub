import { Device, isOnline, hasAlert } from "@/hooks/useDevices";
import { StatusBadge } from "./StatusBadge";
import { Scissors, Wifi, WifiOff, ChevronRight, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("es-AR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
  });
}

export function DeviceCard({ device }: { device: Device }) {
  const navigate = useNavigate();
  const online = isOnline(device);
  const lowCuts = (device.remaining_cuts ?? 0) <= 10;

  return (
    <div
      onClick={() => navigate(`/sucursal/${device.id}`)}
      className="group cursor-pointer rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-accent/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{device.branch_name || device.fixno}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {device.customer_name || "Sin cliente"}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatusBadge
          status={device.status === "enabled" ? "online" : "offline"}
          label={device.status === "enabled" ? "Activo" : "Inactivo"}
          pulse={device.status === "enabled"}
        />
        <StatusBadge
          status={online ? "online" : "offline"}
          label={online ? "Online" : "Offline"}
          pulse={online}
        />
        {lowCuts && (
          <StatusBadge status="warning" label="Cortes bajos" />
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Scissors className="h-3.5 w-3.5" />
          <span className="font-mono font-medium text-foreground">{(device.total_cuts ?? 0).toLocaleString("es-AR")}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          <span className="font-mono font-medium text-foreground">{device.remaining_cuts ?? 0}</span>
          <span>rest.</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {online ? <Wifi className="h-3.5 w-3.5 text-status-online" /> : <WifiOff className="h-3.5 w-3.5 text-status-offline" />}
          <span className="truncate">{formatDate(device.latest_online_time)}</span>
        </div>
      </div>
    </div>
  );
}
