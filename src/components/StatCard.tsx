import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  variant?: "default" | "primary" | "success" | "warning" | "danger";
}

const variantStyles = {
  default: "border-border",
  primary: "border-primary/30",
  success: "border-status-online/30",
  warning: "border-status-warning/30",
  danger: "border-status-offline/30",
};

const iconVariants = {
  default: "text-muted-foreground",
  primary: "text-primary",
  success: "text-status-online",
  warning: "text-status-warning",
  danger: "text-status-offline",
};

export function StatCard({ title, value, icon: Icon, subtitle, variant = "default" }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-5 transition-colors", variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn("rounded-lg bg-secondary p-2.5", iconVariants[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
