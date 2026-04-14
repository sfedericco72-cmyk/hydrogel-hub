import { useMemo } from "react";
import type { Device } from "@/hooks/useDevices";
import { getConnectionLevel, isStock } from "@/hooks/useDevices";

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
        monthlyCutsMap.forEach((deviceMonths, _fixno) => {
          const cuts = deviceMonths.get(month) ?? 0;
          if (cuts > 0) {
            totalCuts += cuts;
            devicesWithCuts++;
          }
        });
      }

      // For current month: count devices connected (green level = last 7 days)
      // For past months: use devicesWithCuts as proxy
      let connected = devicesWithCuts;
      let disconnected = activeDevices.length - devicesWithCuts;

      if (month === currentMonth) {
        connected = activeDevices.filter(d => getConnectionLevel(d) === "green").length;
        disconnected = activeDevices.length - connected;
      }

      return { month, totalCuts, devicesWithCuts, connected, disconnected };
    });
  }, [months, monthlyCutsMap, activeDevices, currentMonth]);

  if (!monthlyCutsMap) {
    return (
      <div className="rounded-lg border bg-card p-5">
        <div className="h-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-5 overflow-x-auto">
      <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Resumen últimos 6 meses
      </h3>
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
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-1.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">Cortes</td>
            {data.map((d) => (
              <td key={d.month} className="py-1.5 px-2 text-center font-semibold tabular-nums">
                {d.totalCuts.toLocaleString("es-AR")}
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">Equipos con cortes</td>
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
          <tr>
            <td className="py-1.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
              {`Conectados`}
              <span className="ml-1 text-[10px] opacity-60">(7d)</span>
            </td>
            {data.map((d) => (
              <td key={d.month} className="py-1.5 px-2 text-center">
                <span className="text-xs font-medium text-status-online">{d.connected}</span>
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">Desconectados</td>
            {data.map((d) => (
              <td key={d.month} className="py-1.5 px-2 text-center">
                <span className={`text-xs font-medium ${d.disconnected > 0 ? "text-status-offline" : "text-muted-foreground"}`}>
                  {d.disconnected}
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-muted-foreground opacity-60">
        * Meses anteriores: "conectados" = equipos con cortes. Mes actual: conexión real (últimos 7 días).
      </p>
    </div>
  );
}
