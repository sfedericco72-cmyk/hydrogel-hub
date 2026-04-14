import { useState, useMemo } from "react";
import { useDevices, useLastCutDates, getDeviceState, type DeviceState } from "@/hooks/useDevices";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mail, Save, Check, Activity, WifiOff, Users, ChevronDown, ChevronRight, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useQuery } from "@tanstack/react-query";

type ClientFilter = "all" | string;
type StateFilter = "all" | DeviceState;

export default function DeviceEmails() {
  const navigate = useNavigate();
  const { data: devices = [], isLoading, refetch } = useDevices();
  const { data: lastCutDates } = useLastCutDates();
  const [editedEmails, setEditedEmails] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [stateFilter, setStateFilter] = useState<StateFilter>("active");
  const [clientFilter, setClientFilter] = useState<ClientFilter>("all");
  const [clientsExpanded, setClientsExpanded] = useState(false);
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  const nonStockDevices = devices.filter(
    (d) => d.branch_name && d.branch_name !== d.fixno
  );

  const scopedDevices = useMemo(() => {
    if (clientFilter === "all") return nonStockDevices;
    return nonStockDevices.filter((d) => (d.customer_name || "Sin cliente") === clientFilter);
  }, [nonStockDevices, clientFilter]);

  const filtered = useMemo(() => {
    if (stateFilter === "all") return scopedDevices;
    return scopedDevices.filter((d) => getDeviceState(d, lastCutDates) === stateFilter);
  }, [scopedDevices, stateFilter, lastCutDates]);

  const stateCounts = useMemo(() => {
    const counts: Record<DeviceState, number> = { stock: 0, active: 0, disconnected: 0 };
    scopedDevices.forEach((d) => { counts[getDeviceState(d, lastCutDates)]++; });
    return counts;
  }, [scopedDevices, lastCutDates]);

  const clients = useMemo(() => {
    const map = new Map<string, number>();
    nonStockDevices.forEach((d) => {
      const name = d.customer_name || "Sin cliente";
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [nonStockDevices]);

  const getEmail = (deviceId: string) => {
    if (editedEmails[deviceId] !== undefined) return editedEmails[deviceId];
    const device = devices.find((d) => d.id === deviceId);
    return device?.alert_email ?? "";
  };

  async function handleSave(deviceId: string) {
    const email = getEmail(deviceId).trim();
    setSaving((p) => ({ ...p, [deviceId]: true }));
    try {
      const { error } = await supabase
        .from("devices")
        .update({ alert_email: email || null })
        .eq("id", deviceId);
      if (error) throw error;
      setSaved((p) => ({ ...p, [deviceId]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [deviceId]: false })), 2000);
      setEditedEmails((p) => {
        const next = { ...p };
        delete next[deviceId];
        return next;
      });
      refetch();
    } catch (e: any) {
      toast.error("Error al guardar: " + e.message);
    } finally {
      setSaving((p) => ({ ...p, [deviceId]: false }));
    }
  }

  async function handleToggleAlerts(deviceId: string, enabled: boolean) {
    try {
      const updateData: Record<string, any> = { alerts_enabled: enabled };
      // When re-enabling, reset the 2-week window
      if (enabled) {
        updateData.first_alert_sent_at = null;
      }
      const { error } = await supabase
        .from("devices")
        .update(updateData)
        .eq("id", deviceId);
      if (error) throw error;
      toast.success(enabled ? "Alertas activadas" : "Alertas desactivadas");
      refetch();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  }

  const grouped = filtered.reduce<Record<string, typeof filtered>>(
    (acc, d) => {
      const key = d.customer_name || "Sin cliente";
      if (!acc[key]) acc[key] = [];
      acc[key].push(d);
      return acc;
    },
    {}
  );
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  function toggleStateFilter(state: StateFilter) {
    setStateFilter((prev) => (prev === state ? "all" : state));
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              Emails de alerta
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Configurá el email y activá/desactivá alertas por equipo. Las alertas se envían 1 vez por semana durante 2 semanas.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <FilterBtn active={stateFilter === "all"} onClick={() => setStateFilter("all")}>
              Todos ({scopedDevices.length})
            </FilterBtn>
            <FilterBtn active={stateFilter === "active"} onClick={() => toggleStateFilter("active")}>
              <Activity className="mr-1 inline h-3.5 w-3.5" />
              Activos ({stateCounts.active})
            </FilterBtn>
            <FilterBtn active={stateFilter === "disconnected"} onClick={() => toggleStateFilter("disconnected")} warning>
              <WifiOff className="mr-1 inline h-3.5 w-3.5" />
              Desconectados ({stateCounts.disconnected})
            </FilterBtn>
          </div>

          {/* Client tree */}
          <div>
            <button
              onClick={() => setClientsExpanded((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {clientsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <Users className="h-3.5 w-3.5" />
              Clientes ({clients.length})
            </button>

            {clientsExpanded && (
              <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2">
                <button
                  onClick={() => setClientFilter("all")}
                  className={`flex items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                    clientFilter === "all"
                      ? "bg-primary/20 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span>Todos los clientes</span>
                </button>
                {clients.map(([name, count]) => (
                  <button
                    key={name}
                    onClick={() => setClientFilter(name)}
                    className={`flex items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                      clientFilter === name
                        ? "bg-primary/20 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span className="truncate">{name}</span>
                    <span className="ml-2 shrink-0 text-xs opacity-70">{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">
            Cargando dispositivos...
          </div>
        ) : sortedGroups.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No hay dispositivos con este filtro
          </div>
        ) : (
          <div className="space-y-6">
            {sortedGroups.map(([clientName, clientDevices]) => (
              <div key={clientName}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {clientName}
                </h2>
                <div className="space-y-2">
                  {clientDevices.map((device) => {
                    const email = getEmail(device.id);
                    const isDirty =
                      editedEmails[device.id] !== undefined &&
                      editedEmails[device.id] !== (device.alert_email ?? "");
                    const alertsEnabled = (device as any).alerts_enabled !== false;
                    const isExpanded = expandedDevice === device.id;

                    return (
                      <div
                        key={device.id}
                        className="rounded-lg border border-border bg-card"
                      >
                        <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {device.branch_name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {device.fixno}
                            </p>
                          </div>

                          {/* Alerts toggle */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs ${alertsEnabled ? "text-green-400" : "text-muted-foreground"}`}>
                              {alertsEnabled ? "Alertas on" : "Alertas off"}
                            </span>
                            <Switch
                              checked={alertsEnabled}
                              onCheckedChange={(checked) => handleToggleAlerts(device.id, checked)}
                            />
                          </div>

                          <div className="flex flex-1 items-center gap-2">
                            <input
                              type="email"
                              placeholder="email@ejemplo.com"
                              value={email}
                              onChange={(e) =>
                                setEditedEmails((p) => ({
                                  ...p,
                                  [device.id]: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-input bg-secondary px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <button
                              onClick={() => handleSave(device.id)}
                              disabled={!isDirty || saving[device.id]}
                              className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                            >
                              {saved[device.id] ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => setExpandedDevice(isExpanded ? null : device.id)}
                              className="flex shrink-0 items-center rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                              title="Ver historial de alertas"
                            >
                              <History className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Email history */}
                        {isExpanded && (
                          <DeviceEmailHistory fixno={device.fixno} alertEmail={device.alert_email} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceEmailHistory({ fixno, alertEmail }: { fixno: string; alertEmail: string | null }) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["email-history", fixno],
    queryFn: async () => {
      // Search by idempotency key pattern which contains the fixno
      const { data, error } = await supabase
        .from("email_send_log")
        .select("id, template_name, recipient_email, status, created_at, message_id")
        .or(`message_id.like.%${fixno}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      // Deduplicate by message_id, keep latest
      const seen = new Set<string>();
      return (data || []).filter((row) => {
        if (!row.message_id || seen.has(row.message_id)) return false;
        seen.add(row.message_id);
        return true;
      });
    },
    staleTime: 30_000,
  });

  const templateLabels: Record<string, string> = {
    "stock-bajo": "Stock bajo",
    "dispositivo-desconectado": "Desconectado",
    "email-no-configurado": "Sin email configurado",
  };

  const statusColors: Record<string, string> = {
    sent: "text-green-400",
    pending: "text-yellow-400",
    dlq: "text-red-400",
    failed: "text-red-400",
  };

  return (
    <div className="border-t border-border px-3 pb-3 pt-2">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Últimas alertas enviadas</p>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando...</p>
      ) : !logs?.length ? (
        <p className="text-xs text-muted-foreground">No hay alertas enviadas para este equipo</p>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center gap-3 text-xs">
              <span className="shrink-0 text-muted-foreground">
                {new Date(log.created_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
              <span className="truncate">{templateLabels[log.template_name] || log.template_name}</span>
              <span className={`shrink-0 font-medium ${statusColors[log.status] || "text-muted-foreground"}`}>
                {log.status}
              </span>
              <span className="truncate text-muted-foreground">{log.recipient_email}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBtn({ active, onClick, children, warning }: {
  active: boolean; onClick: () => void; children: React.ReactNode; warning?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? warning ? "bg-yellow-600/80 text-foreground"
            : "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}
