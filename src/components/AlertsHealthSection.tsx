import { Activity, BellOff, MailWarning, CheckCircle2, AlertTriangle, Loader2, BellRing } from "lucide-react";
import { toast } from "sonner";
import {
  useLastAlertCheckRun,
  useAlertsSentCount,
  useMutedDevices,
  usePdvAlertIssues,
  useUnmuteDevices,
  useEnablePdvAlerts,
} from "@/hooks/useAlertsHealth";

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export function AlertsHealthSection() {
  const { data: lastRun, isLoading: runLoading } = useLastAlertCheckRun();
  const { data: sentCount = 0 } = useAlertsSentCount(7);
  const { data: muted = [] } = useMutedDevices();
  const { data: pdvIssues } = usePdvAlertIssues();
  const unmute = useUnmuteDevices();
  const enablePdv = useEnablePdvAlerts();

  const staleHours = lastRun
    ? (Date.now() - new Date(lastRun.started_at).getTime()) / 3_600_000
    : null;
  const isStale = staleHours === null || staleHours > 26;
  const isError = lastRun?.status === "error";
  const healthy = !isStale && !isError;

  async function handleUnmute(ids: string[] | "all", label: string) {
    try {
      await unmute.mutateAsync(ids);
      toast.success(`${label} reactivado${ids === "all" || ids.length > 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Activity className="h-4 w-4" /> Estado de alertas
      </h2>

      {/* Health banner */}
      <div
        className={`mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border p-3 text-sm ${
          healthy ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"
        }`}
      >
        {runLoading ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando estado...
          </span>
        ) : (
          <>
            <span className={`flex items-center gap-2 font-medium ${healthy ? "text-emerald-400" : "text-destructive"}`}>
              {healthy ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {healthy
                ? "Revisión automática al día"
                : isError
                  ? "La última revisión falló"
                  : "Hace más de 26 horas que no corre la revisión"}
            </span>
            <span className="text-muted-foreground">
              Última corrida: {formatDateTime(lastRun?.started_at)}
              {lastRun?.finished_at ? ` · terminó ${formatDateTime(lastRun.finished_at)}` : lastRun ? " · en curso" : ""}
            </span>
            <span className="text-muted-foreground">
              {sentCount} alerta{sentCount !== 1 ? "s" : ""} en los últimos 7 días
            </span>
          </>
        )}
      </div>

      {lastRun?.error_message && (
        <p className="mb-4 rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {lastRun.error_message}
        </p>
      )}

      {/* Muted devices */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <BellOff className="h-4 w-4 text-amber-400" />
            Equipos silenciados ({muted.length})
          </h3>
          {muted.length > 0 && (
            <button
              onClick={() => handleUnmute("all", "Equipos")}
              disabled={unmute.isPending}
              className="rounded-md border border-input px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              Reactivar todos
            </button>
          )}
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          El sistema silencia un equipo cuando pasó la ventana máxima de alertas sin que se resuelva. Vuelve solo al vencer el silenciado.
        </p>
        {muted.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">Ningún equipo silenciado.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Cliente / PdV</th>
                  <th className="px-2 py-1.5 text-left font-medium">Equipo</th>
                  <th className="px-2 py-1.5 text-left font-medium">Motivo</th>
                  <th className="px-2 py-1.5 text-left font-medium">Vuelve</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {muted.map((m) => (
                  <tr key={m.device_id} className="border-t">
                    <td className="px-2 py-1.5">
                      {m.client_name ?? "—"}
                      <span className="block text-muted-foreground">{m.pdv_name ?? "Sin PdV"}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      {m.branch_name ?? "—"}
                      <span className="block font-mono text-[10px] text-muted-foreground">{m.fixno}</span>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{m.reason ?? "—"}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{formatDate(m.muted_until)}</td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        onClick={() => handleUnmute([m.device_id], "Equipo")}
                        disabled={unmute.isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-0.5 font-medium transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        <BellRing className="h-3 w-3" /> Reactivar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PdV issues */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
            <BellOff className="h-4 w-4 text-muted-foreground" />
            PdV con alertas apagadas ({pdvIssues?.disabled.length ?? 0})
          </h3>
          {!pdvIssues?.disabled.length ? (
            <p className="text-xs italic text-muted-foreground">Ninguno.</p>
          ) : (
            <ul className="space-y-1">
              {pdvIssues.disabled.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">
                    {p.name}
                    <span className="block text-muted-foreground">{p.client_name ?? "—"}</span>
                  </span>
                  <button
                    onClick={async () => {
                      try {
                        await enablePdv.mutateAsync(p.id);
                        toast.success("Alertas activadas");
                      } catch (e: any) {
                        toast.error("Error: " + e.message);
                      }
                    }}
                    disabled={enablePdv.isPending}
                    className="shrink-0 rounded-md border border-input px-2 py-0.5 font-medium transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    Activar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
            <MailWarning className="h-4 w-4 text-amber-400" />
            PdV sin email configurado ({pdvIssues?.noEmail.length ?? 0})
          </h3>
          {!pdvIssues?.noEmail.length ? (
            <p className="text-xs italic text-muted-foreground">Ninguno.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {pdvIssues.noEmail.map((p) => (
                <li key={p.id} className="truncate">
                  {p.name}
                  <span className="block text-muted-foreground">{p.client_name ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
