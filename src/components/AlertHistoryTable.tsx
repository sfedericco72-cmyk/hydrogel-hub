import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Mail, Wifi, MailWarning, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertHistoryEntry } from "@/hooks/useAlertHistory";

interface Props {
  entries: AlertHistoryEntry[];
  isLoading?: boolean;
  showClient?: boolean; // If true, shows the Client column (used in global view)
  pageSize?: number;
  emptyMessage?: string;
}

const TEMPLATE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  "stock-bajo": { label: "Stock bajo", icon: AlertTriangle, color: "text-amber-400" },
  "dispositivo-desconectado": { label: "Desconectado", icon: Wifi, color: "text-red-400" },
  "email-no-configurado": { label: "Sin email config.", icon: MailWarning, color: "text-orange-400" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: any; className: string }> = {
  sent: { label: "Enviado", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  pending: { label: "Pendiente", icon: Clock, className: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  failed: { label: "Falló", icon: XCircle, className: "bg-red-500/10 text-red-400 border-red-500/30" },
  dlq: { label: "Falló (reintentos)", icon: XCircle, className: "bg-red-500/10 text-red-400 border-red-500/30" },
  bounced: { label: "Rebotó", icon: XCircle, className: "bg-red-500/10 text-red-400 border-red-500/30" },
  complained: { label: "Reportado spam", icon: AlertTriangle, className: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  suppressed: { label: "Bloqueado", icon: XCircle, className: "bg-muted text-muted-foreground border-border" },
};

export function AlertHistoryTable({ entries, isLoading, showClient = true, pageSize = 50, emptyMessage }: Props) {
  const [page, setPage] = useState(0);

  const paged = useMemo(() => {
    const start = page * pageSize;
    return entries.slice(start, start + pageSize);
  }, [entries, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));

  if (isLoading) {
    return <div className="h-32 animate-pulse rounded-lg bg-muted" />;
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage ?? "Sin alertas enviadas en este período."}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Fecha</th>
              <th className="px-3 py-2 text-left font-medium">Tipo</th>
              {showClient && <th className="px-3 py-2 text-left font-medium">Cliente</th>}
              <th className="px-3 py-2 text-left font-medium">PdV</th>
              <th className="px-3 py-2 text-left font-medium">Equipo</th>
              <th className="px-3 py-2 text-left font-medium">Destinatario</th>
              <th className="px-3 py-2 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((entry) => {
              const tpl = TEMPLATE_LABELS[entry.template_name] ?? { label: entry.template_name, icon: Mail, color: "text-muted-foreground" };
              const TplIcon = tpl.icon;
              const status = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.sent;
              const StatusIcon = status.icon;
              const isFailed = ["failed", "dlq", "bounced", "complained", "suppressed"].includes(entry.status);
              return (
                <tr key={entry.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString("es-CL", {
                      day: "2-digit", month: "2-digit", year: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <TplIcon className={cn("h-3.5 w-3.5", tpl.color)} />
                      <span className="text-xs">{tpl.label}</span>
                    </div>
                  </td>
                  {showClient && (
                    <td className="px-3 py-2 text-xs">{entry.client_name ?? <span className="text-muted-foreground italic">—</span>}</td>
                  )}
                  <td className="px-3 py-2 text-xs">{entry.pdv_name ?? <span className="text-muted-foreground italic">—</span>}</td>
                  <td className="px-3 py-2 text-xs font-mono">{entry.fixno ?? <span className="text-muted-foreground italic font-sans">—</span>}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[180px] truncate" title={entry.recipient_email}>
                    {entry.recipient_email}
                  </td>
                  <td className="px-3 py-2">
                    <div className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs", status.className)}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </div>
                    {isFailed && entry.error_message && (
                      <div className="mt-0.5 max-w-[200px] truncate text-[10px] text-red-400/80" title={entry.error_message}>
                        {entry.error_message}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{entries.length} alertas · página {page + 1} de {totalPages}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded border border-border px-2 py-1 hover:bg-accent disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded border border-border px-2 py-1 hover:bg-accent disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
