import { Device, getDeviceState, getDaysOfStock, hasLowStock, DEVICE_STATE_LABELS, type DeviceState, useMonthlyCutsMap, getConnectionLevel } from "@/hooks/useDevices";
import { titleCase } from "@/lib/utils";
import { CutsTrafficLights, ConnectionTrafficLight } from "./TrafficLights";
import { Scissors, ChevronRight, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "./StatusBadge";

const stateStatusMap: Record<DeviceState, "online" | "offline" | "warning"> = {
  stock: "warning",
  active: "online",
  inactive: "warning",
  disconnected: "offline",
};

export function DeviceCard({ device, lastCutDates, avgDailyCuts, monthlyCutsMap }: {
  device: Device;
  lastCutDates?: Map<string, string>;
  avgDailyCuts?: Map<string, number>;
  monthlyCutsMap?: Map<string, Map<string, number>>;
}) {
  const navigate = useNavigate();
  const deviceState = getDeviceState(device, lastCutDates);
  const lowStock = hasLowStock(device, avgDailyCuts);
  const daysOfStock = getDaysOfStock(device, avgDailyCuts);
  const deviceMonthlyCuts = monthlyCutsMap?.get(device.fixno);

  return (
    <div
      onClick={() => navigate(`/sucursal/${device.id}`)}
      className="group cursor-pointer rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-accent/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{titleCase(device.branch_name) || device.fixno}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {titleCase(device.customer_name) || "Sin cliente"}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      {/* Traffic lights row */}
      <div className="mt-3 flex items-start gap-6 border-t border-border pt-3">
        <CutsTrafficLights monthlyCuts={deviceMonthlyCuts} />
        <ConnectionTrafficLight latestOnlineTime={device.latest_online_time} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
        <StatusBadge
          status={stateStatusMap[deviceState]}
          label={DEVICE_STATE_LABELS[deviceState]}
          pulse={deviceState === "active"}
        />
        {daysOfStock !== null && (
          <StatusBadge
            status={lowStock ? "warning" : "online"}
            label={`~${Math.round(daysOfStock)}d stock`}
          />
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Scissors className="h-3.5 w-3.5" />
          <span className="font-mono font-medium text-foreground">{(device.total_cuts ?? 0).toLocaleString("es-AR")}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          <span className="font-mono font-medium text-foreground">{device.remaining_cuts ?? 0}</span>
          <span>rest.</span>
        </div>
      </div>
    </div>
  );
}
