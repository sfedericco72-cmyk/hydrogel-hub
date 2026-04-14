import { useState, useMemo } from "react";
import { useDevices, useLastCutDates, getDeviceState, DEVICE_STATE_LABELS, type DeviceState } from "@/hooks/useDevices";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mail, Save, Check, Activity, WifiOff, Package, Users, ChevronDown, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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

  const nonStockDevices = devices.filter(
    (d) => d.branch_name && d.branch_name !== d.fixno
  );

  // Apply filters
  // Scope by client first (same as Dashboard)
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

  // Group by customer
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
            Configurá el email de cada dispositivo para recibir alertas de stock
            bajo y desconexión.
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
                    return (
                      <div
                        key={device.id}
                        className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {device.branch_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {device.fixno}
                          </p>
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
                        </div>
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
