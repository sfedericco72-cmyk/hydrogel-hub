import { cn } from "@/lib/utils";

type StatusType = "online" | "warning" | "offline" | "info";

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  pulse?: boolean;
  className?: string;
}

const statusStyles: Record<StatusType, string> = {
  online: "bg-status-online/15 text-status-online border-status-online/30",
  warning: "bg-status-warning/15 text-status-warning border-status-warning/30",
  offline: "bg-status-offline/15 text-status-offline border-status-offline/30",
  info: "bg-status-info/15 text-status-info border-status-info/30",
};

const dotStyles: Record<StatusType, string> = {
  online: "bg-status-online",
  warning: "bg-status-warning",
  offline: "bg-status-offline",
  info: "bg-status-info",
};

export function StatusBadge({ status, label, pulse, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status],
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          dotStyles[status],
          pulse && "animate-pulse-dot"
        )}
      />
      {label}
    </span>
  );
}
