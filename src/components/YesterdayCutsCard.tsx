import { useState } from "react";
import { Scissors } from "lucide-react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { PickPdvDialog } from "@/pages/ClientsManager";
import { useUserTenantId } from "@/hooks/useUserTenantId";
import type { UnassignedYesterdayDevice } from "@/hooks/useYesterdayCuts";

interface Props {
  assignedYesterday: number | undefined;
  unassignedYesterday: number | undefined;
  unassignedDevices?: UnassignedYesterdayDevice[];
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
  unassignedDevices = [],
  avg7d,
  isLoading,
}: Props) {
  const { data: tenantId } = useUserTenantId();
  const [open, setOpen] = useState(false);
  const [assignId, setAssignId] = useState<string | null>(null);

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
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="mt-0.5 inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              <span className="font-semibold text-foreground">+{fmt(unassignedYesterday)}</span>
              <span>sin asignar</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[360px] p-0">
            <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
              Equipos sin punto de venta que cortaron ayer
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {unassignedDevices.map((d) => (
                <div key={d.fixno} className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs text-foreground">{d.fixno}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {[d.customer_name, d.branch_name].filter(Boolean).join(" · ") || "Sin datos"}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{fmt(d.cuts)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={!d.id || !tenantId}
                    onClick={() => { setAssignId(d.id); setOpen(false); }}
                  >
                    Asignar
                  </Button>
                </div>
              ))}
            </div>
            <div className="border-t border-border px-3 py-2 text-right">
              <Link to="/clientes" className="text-xs text-primary hover:underline">
                Ver todos los sin asignar
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {!isLoading && avg7d !== undefined && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          prom. 7d: <span className="font-medium text-foreground">{fmt(avg7d)}</span>
        </div>
      )}

      {assignId && tenantId && (
        <PickPdvDialog deviceId={assignId} tenantId={tenantId} onClose={() => setAssignId(null)} />
      )}
    </div>
  );
}
