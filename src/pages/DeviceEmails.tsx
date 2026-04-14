import { useState } from "react";
import { useDevices } from "@/hooks/useDevices";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mail, Save, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function DeviceEmails() {
  const navigate = useNavigate();
  const { data: devices = [], isLoading, refetch } = useDevices();
  const [editedEmails, setEditedEmails] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const nonStockDevices = devices.filter(
    (d) => d.branch_name && d.branch_name !== d.fixno
  );

  const getEmail = (deviceId: string) => {
    if (editedEmails[deviceId] !== undefined) return editedEmails[deviceId];
    const device = devices.find((d) => d.id === deviceId);
    return (device as any)?.alert_email ?? "";
  };

  async function handleSave(deviceId: string) {
    const email = getEmail(deviceId).trim();
    setSaving((p) => ({ ...p, [deviceId]: true }));
    try {
      const { error } = await supabase
        .from("devices")
        .update({ alert_email: email || null } as any)
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
  const grouped = nonStockDevices.reduce<Record<string, typeof nonStockDevices>>(
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

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate("/")}
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
            bajo y desconexión. También se enviará copia oculta a{" "}
            <span className="font-mono text-xs text-foreground">
              santiago.federico@bitec.cl
            </span>
          </p>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">
            Cargando dispositivos...
          </div>
        ) : sortedGroups.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No hay dispositivos activos
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
                      editedEmails[device.id] !==
                        ((device as any).alert_email ?? "");
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
                            disabled={
                              !isDirty || saving[device.id]
                            }
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
