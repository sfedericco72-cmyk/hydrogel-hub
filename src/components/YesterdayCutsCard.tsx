import { Scissors } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  assignedYesterday: number | undefined;
  unassignedYesterday: number | undefined;
  avg7d: number | undefined;
  isLoading: boolean;
}

function fmt(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("es-CL");
}

export function YesterdayCutsCard({
  assignedYesterday,
  unassignedYesterday,
  avg7d,
  isLoading,
}: Props) {
  return (
    <div className="flex min-w-[180px] flex-col rounded-lg border border-border bg-card px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Scissors className="h-3 w-3" />
        Cortes ayer
      </div>

      {isLoading ? (
        <div className="mt-1 h-8 w-20 animate-pulse rounded bg-muted" />
      ) : (
        <div className="mt-0.5 text-3xl font-bold leading-tight text-primary">
          {fmt(assignedYesterday)}
        </div>
      )}

      {!isLoading && unassignedYesterday !== undefined && unassignedYesterday > 0 && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mt-0.5 inline-flex w-fit cursor-help items-center gap-1 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">+{fmt(unassignedYesterday)}</span>
                <span>sin asignar</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px] text-xs">
              Cortes de equipos detectados por la API que aún no tienen un punto de venta asignado.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {!isLoading && avg7d !== undefined && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          prom. 7d: <span className="font-medium text-foreground">{fmt(avg7d)}</span>
        </div>
      )}
    </div>
  );
}