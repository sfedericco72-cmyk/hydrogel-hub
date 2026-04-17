import { Device, getActivityState, isDeviceDisconnected, getDisconnectionDays, getDaysOfStock, hasLowStock, ACTIVITY_LABELS } from "@/hooks/useDevices";
import { titleCase } from "@/lib/utils";
import { getLastNMonths, shortMonthLabel, sumLast6Months } from "@/lib/cuts";
import { ConnectionTrafficLight } from "./TrafficLights";
import { Scissors, ChevronRight, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "./StatusBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function formatNumber(n: number): string {
  return n.toLocaleString("es-AR");
}

export function DeviceCard({ device, lastCutDates, avgDailyCuts, monthlyCutsMap }: {
  device: Device;
  lastCutDates?: Map<string, string>;
  avgDailyCuts?: Map<string, number>;
  monthlyCutsMap?: Map<string, Map<string, number>>;
}) {
  const navigate = useNavigate();
  const activity = getActivityState(device, lastCutDates);
  const disconnected = isDeviceDisconnected(device);
  const disconnDays = getDisconnectionDays(device);
  const lowStock = hasLowStock(device, avgDailyCuts);
  const daysOfStock = getDaysOfStock(device, avgDailyCuts);
  const deviceMonthlyCuts = monthlyCutsMap?.get(device.fixno);
  const avgDaily = avgDailyCuts?.get(device.fixno);

  const months = getLastNMonths(6);
  const currentMonthKey = months[months.length - 1];
  const cutsSinceAssignment = sumLast6Months(deviceMonthlyCuts);
  const remaining = device.remaining_cuts ?? 0;

  return (
    <TooltipProvider delayDuration={200}>
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

        {/* 6-month timeline + connection */}
        <div className="mt-3 flex items-start justify-between gap-3 border-t border-border pt-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Cortes · últimos 6 meses</p>
            <div className="grid grid-cols-6 gap-1">
              {months.map((m) => {
                const cuts = deviceMonthlyCuts?.get(m) ?? 0;
                const hasActivity = cuts > 0;
                const isCurrent = m === currentMonthKey;
                return (
                  <Tooltip key={m}>
                    <TooltipTrigger asChild>
                      <div
                        className={`flex flex-col items-center gap-0.5 rounded px-0.5 py-1 ${
                          isCurrent ? "bg-primary/10 ring-1 ring-primary/30" : ""
                        }`}
                      >
                        <span className="text-[9px] uppercase leading-none text-muted-foreground">{shortMonthLabel(m)}</span>
                        <div
                          className={`h-2 w-2 rounded-full shadow-sm ${
                            hasActivity ? "bg-green-500 shadow-green-500/40" : "bg-red-500/70 shadow-red-500/30"
                          }`}
                        />
                        <span className="font-mono text-[10px] leading-none tabular-nums text-foreground">
                          {cuts > 0 ? formatNumber(cuts) : "—"}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        {shortMonthLabel(m)} {m.slice(0, 4)}: <strong>{formatNumber(cuts)}</strong> cortes
                        {isCurrent && " (en curso)"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
          <div className="shrink-0">
            <ConnectionTrafficLight latestOnlineTime={device.latest_online_time} />
          </div>
        </div>

        {/* Status badges */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <StatusBadge
                  status={activity === "active" ? "online" : "warning"}
                  label={ACTIVITY_LABELS[activity]}
                  pulse={activity === "active"}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">
                <strong>Activo:</strong> registró al menos 1 corte en los últimos 3 meses.<br />
                <strong>Inactivo:</strong> 0 cortes en ese período.<br />
                Mide producción, no conexión a internet.
              </p>
            </TooltipContent>
          </Tooltip>

          {disconnected && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <StatusBadge
                    status="offline"
                    label={`Desconectado${disconnDays !== null ? ` ${disconnDays}d` : ""}`}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">
                  Sin señal a internet hace {disconnDays ?? "?"} días. No implica que no haya cortado: los cortes se registran cuando el equipo vuelve a conectarse.
                </p>
              </TooltipContent>
            </Tooltip>
          )}

          {daysOfStock !== null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <StatusBadge
                    status={lowStock ? "warning" : "online"}
                    label={`~${Math.round(daysOfStock)}d stock`}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">
                  Estimación: <strong>{remaining} láminas</strong> ÷ <strong>{avgDaily ? avgDaily.toFixed(1) : "?"} cortes/día</strong> (promedio últimos 30 días con cortes).
                  {lowStock && remaining <= 10 && !avgDaily ? " Marcado como bajo: ≤10 láminas sin historial." : ""}
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Cuts since assignment + stock unified */}
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Scissors className="h-3.5 w-3.5" />
                <span className="font-mono font-medium text-foreground">{formatNumber(cutsSinceAssignment)}</span>
                <span>cortes</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">
                Suma de cortes de los últimos 6 meses desde que el equipo está asignado a este punto de venta.<br />
                Histórico CutABC: <strong>{formatNumber(device.total_cuts ?? 0)}</strong>
              </p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                <span className="font-mono font-medium text-foreground">{remaining}</span>
                <span>láminas</span>
                {daysOfStock !== null && (
                  <span className={lowStock ? "text-status-warning" : "text-muted-foreground"}>
                    · ~{Math.round(daysOfStock)}d
                  </span>
                )}
                {daysOfStock === null && remaining > 0 && (
                  <span className="text-muted-foreground/70">· s/est</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">
                {remaining} láminas restantes
                {daysOfStock !== null && avgDaily
                  ? `. Estimación de ~${Math.round(daysOfStock)} días según promedio de ${avgDaily.toFixed(1)} cortes/día.`
                  : ". Sin historial suficiente para estimar días de stock."}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
