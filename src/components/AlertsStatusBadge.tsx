import { Bell, BellOff, Pause, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface PdvAlertSummary {
  total: number;
  on_with_email: number;
  on_no_email: number;
  off: number;
}

interface AggregateProps {
  mode: "aggregate";
  summary: PdvAlertSummary;
  globallyPaused?: boolean;
  className?: string;
}

interface IndividualProps {
  mode: "individual";
  alertsEnabled: boolean;
  alertEmail: string | null | undefined;
  globallyPaused?: boolean;
  className?: string;
}

type Props = AggregateProps | IndividualProps;

export function AlertsStatusBadge(props: Props) {
  if (props.mode === "aggregate") {
    return <AggregateBadge {...props} />;
  }
  return <IndividualBadge {...props} />;
}

function AggregateBadge({ summary, globallyPaused, className }: AggregateProps) {
  const { total, on_with_email, on_no_email, off } = summary;
  if (total === 0) return null;

  const allOn = on_with_email === total;
  const noneOn = on_with_email === 0 && on_no_email === 0;
  const hasBroken = on_no_email > 0;

  let tone: "green" | "amber" | "gray" = "gray";
  if (allOn) tone = "green";
  else if (!noneOn) tone = "amber";

  const toneCls =
    tone === "green"
      ? "bg-status-online/15 text-status-online border-status-online/30"
      : tone === "amber"
      ? "bg-status-warning/15 text-status-warning border-status-warning/30"
      : "bg-muted text-muted-foreground border-border";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
            toneCls,
            className,
          )}
        >
          {globallyPaused ? (
            <Pause className="h-3 w-3" />
          ) : noneOn ? (
            <BellOff className="h-3 w-3" />
          ) : (
            <Bell className="h-3 w-3" />
          )}
          <span>
            {on_with_email}/{total}
          </span>
          {hasBroken && (
            <AlertTriangle className="h-3 w-3 text-destructive" aria-label="PdV con alertas activas pero sin email" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="space-y-0.5">
          <div>
            <strong>{on_with_email}</strong> con alertas activas
          </div>
          {on_no_email > 0 && (
            <div className="text-destructive">
              <strong>{on_no_email}</strong> sin email configurado
            </div>
          )}
          {off > 0 && (
            <div>
              <strong>{off}</strong> desactivadas
            </div>
          )}
          {globallyPaused && <div className="text-status-info">Pausadas globalmente</div>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function IndividualBadge({ alertsEnabled, alertEmail, globallyPaused, className }: IndividualProps) {
  const hasEmail = !!alertEmail?.trim();

  let tone: "green" | "amber" | "gray" | "blue" = "gray";
  let Icon = BellOff;
  let label = "Alertas desactivadas";

  if (globallyPaused) {
    tone = "blue";
    Icon = Pause;
    label = "Pausadas globalmente";
  } else if (alertsEnabled && hasEmail) {
    tone = "green";
    Icon = Bell;
    label = `Alertas → ${alertEmail}`;
  } else if (alertsEnabled && !hasEmail) {
    tone = "amber";
    Icon = Bell;
    label = "Alertas activas SIN email — no llegan";
  }

  const toneCls =
    tone === "green"
      ? "text-status-online"
      : tone === "amber"
      ? "text-status-warning"
      : tone === "blue"
      ? "text-status-info"
      : "text-muted-foreground";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center gap-1.5", toneCls, className)}>
          <Icon className="h-3.5 w-3.5" />
          {hasEmail && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">{alertEmail}</span>
          )}
          {alertsEnabled && !hasEmail && (
            <span className="text-[11px] font-medium">Sin email</span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
