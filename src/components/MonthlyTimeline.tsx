import { useMemo } from "react";
import type { Device } from "@/hooks/useDevices";
import { getConnectionLevel, isStock, isDeviceDisconnected } from "@/hooks/useDevices";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Wifi, WifiOff } from "lucide-react";

interface Props {
  devices: Device[];
  monthlyCutsMap: Map<string, Map<string, number>> | undefined;
}

function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().substring(0, 7));
  }
  return months;
}

function formatMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

export function MonthlyTimeline({ devices, monthlyCutsMap }: Props) {
  const months = useMemo(() => getLastNMonths(6), []);
  const currentMonth = months[months.length - 1];

  // Non-stock devices only
  const activeDevices = useMemo(() => devices.filter(d => !isStock(d)), [devices]);

  const data = useMemo(() => {
    return months.map((month) => {
      let totalCuts = 0;
      let devicesWithCuts = 0;

      if (monthlyCutsMap) {
        monthlyCutsMap.forEach((deviceMonths) => {
          const cuts = deviceMonths.get(month) ?? 0;
          if (cuts > 0) {
            totalCuts += cuts;
            devicesWithCuts++;
          }
        });
      }

      return { month, totalCuts, devicesWithCuts };
    });
  }, [months, monthlyCutsMap]);

  // Current connectivity (independent of monthly cuts)
  const connectivity = useMemo(() => {
    const online = activeDevices.filter(d => getConnectionLevel(d) === "green").length;
    const offline = activeDevices.filter(d => isDeviceDisconnected(d)).length;
    return { online, offline, total: activeDevices.length };
  }, [activeDevices]);

  if (!monthlyCutsMap) {
    return (
      <div className="rounded-lg border bg-card p-5">
        <div className="h-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-lg border bg-card p-5 overflow-x-auto">
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Producción últimos 6 meses
          </h3>

          {/* Connectivity snapshot — independent of monthly cuts */}
          <div className="flex items-center gap-3 text-xs">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-help">
                  <Wifi className="h-3.5 w-3.5 text-status-online" />
                  <span className="font-medium text-status-online tabular-nums">{connectivity.online}</span>
                  <span className="text-muted-foreground">online</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">Equipos con señal en los últimos 7 días. Mide conexión a internet, no producción.</p>
              </TooltipContent>
            </Tooltip>
            <span className="text-muted-foreground/40">·</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-help">
                  <WifiOff className="h-3.5 w-3.5 text-status-offline" />
                  <span className="font-medium text-status-offline tabular-nums">{connectivity.offline}</span>
                  <span className="text-muted-foreground">desconectados</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">Equipos sin señal hace más de 7 días.</p>
              </TooltipContent>
            </Tooltip>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground">{connectivity.total} totales</span>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground" />
              {data.map((d) => (
                <th
                  key={d.month}
                  className={`pb-2 px-2 text-center text-xs font-medium ${
                    d.month === currentMonth ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {formatMonth(d.month)}
                  {d.month === currentMonth && (
                    <div className="text-[9px] font-normal opacity-70 normal-case">en curso</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 cursor-help">
                      Cortes
                      <Info className="h-3 w-3 opacity-50" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">Suma total de cortes realizados por todos los equipos en ese mes.</p>
                  </TooltipContent>
                </Tooltip>
              </td>
              {data.map((d) => (
                <td key={d.month} className="py-1.5 px-2 text-center font-semibold tabular-nums">
                  {d.totalCuts.toLocaleString("es-AR")}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-1.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 cursor-help">
                      Equipos con cortes
                      <Info className="h-3 w-3 opacity-50" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">Cantidad de equipos distintos que registraron al menos 1 corte ese mes.</p>
                  </TooltipContent>
                </Tooltip>
              </td>
              {data.map((d) => (
                <td key={d.month} className="py-1.5 px-2 text-center">
                  <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    d.devicesWithCuts > 0 ? "bg-status-online/20 text-status-online" : "bg-status-offline/20 text-status-offline"
                  }`}>
                    {d.devicesWithCuts}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-[10px] text-muted-foreground opacity-70">
          La conexión a internet (online/desconectados) y la producción de cortes son dimensiones independientes: un equipo puede estar online sin haber cortado este mes, o haber cortado en meses pasados y estar offline ahora.
        </p>
      </div>
    </TooltipProvider>
  );
}
