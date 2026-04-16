import { useState, useEffect } from "react";
import { Bell, BellOff, Save, History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  pdv: {
    id: string;
    name: string;
    alert_email?: string | null;
    alerts_enabled?: boolean;
  };
  /** fixnos of devices currently assigned to this PdV — used to fetch alert history */
  fixnos: string[];
}

const TEMPLATE_LABELS: Record<string, string> = {
  "stock-bajo": "Stock bajo",
  "dispositivo-desconectado": "Desconectado",
  "email-no-configurado": "Sin email configurado",
};

const STATUS_COLORS: Record<string, string> = {
  sent: "text-green-400",
  pending: "text-yellow-400",
  dlq: "text-red-400",
  failed: "text-red-400",
};

export function PdVAlertSettings({ pdv, fixnos }: Props) {
  const qc = useQueryClient();
  const [email, setEmail] = useState(pdv.alert_email ?? "");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const enabled = pdv.alerts_enabled !== false;

  useEffect(() => {
    setEmail(pdv.alert_email ?? "");
  }, [pdv.alert_email]);

  const dirty = email.trim() !== (pdv.alert_email ?? "");

  async function saveEmail() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("points_of_sale")
        .update({ alert_email: email.trim() || null })
        .eq("id", pdv.id);
      if (error) throw error;
      toast.success("Email guardado");
      qc.invalidateQueries({ queryKey: ["points-of-sale"] });
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAlerts(next: boolean) {
    try {
      const { error } = await supabase
        .from("points_of_sale")
        .update({ alerts_enabled: next })
        .eq("id", pdv.id);
      if (error) throw error;
      toast.success(next ? "Alertas activadas" : "Alertas desactivadas");
      qc.invalidateQueries({ queryKey: ["points-of-sale"] });
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Alertas por email
        </span>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs ${enabled ? "text-green-400" : "text-muted-foreground"}`}>
            {enabled ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
            {enabled ? "On" : "Off"}
          </span>
          <Switch checked={enabled} onCheckedChange={toggleAlerts} />
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Email destinatario</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@ejemplo.com"
            className="h-8 text-sm"
            disabled={!enabled}
          />
        </div>
        <Button
          size="sm"
          onClick={saveEmail}
          disabled={!dirty || saving}
          className="h-8"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        </Button>
      </div>

      <button
        onClick={() => setShowHistory((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <History className="h-3 w-3" />
        {showHistory ? "Ocultar historial" : "Ver historial de alertas"}
      </button>

      {showHistory && <AlertHistory fixnos={fixnos} />}
    </div>
  );
}

function AlertHistory({ fixnos }: { fixnos: string[] }) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["pdv-alert-history", fixnos.join(",")],
    enabled: fixnos.length > 0,
    queryFn: async () => {
      // Fetch logs whose message_id contains any of these fixnos
      const orFilter = fixnos.map((fx) => `message_id.like.%${fx}%`).join(",");
      const { data, error } = await supabase
        .from("email_send_log")
        .select("id, template_name, recipient_email, status, created_at, message_id")
        .or(orFilter)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const seen = new Set<string>();
      return (data || []).filter((row) => {
        if (!row.message_id || seen.has(row.message_id)) return false;
        seen.add(row.message_id);
        return true;
      });
    },
    staleTime: 30_000,
  });

  if (fixnos.length === 0) {
    return <p className="text-xs italic text-muted-foreground">Sin equipos asignados</p>;
  }

  if (isLoading) return <p className="text-xs text-muted-foreground">Cargando...</p>;
  if (!logs?.length) return <p className="text-xs italic text-muted-foreground">Sin alertas enviadas</p>;

  return (
    <div className="mt-1 space-y-1 border-t border-border/60 pt-2">
      {logs.map((log) => (
        <div key={log.id} className="flex items-center gap-2 text-xs">
          <span className="shrink-0 text-muted-foreground">
            {new Date(log.created_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
          </span>
          <span className="truncate">{TEMPLATE_LABELS[log.template_name] || log.template_name}</span>
          <span className={`shrink-0 font-medium ${STATUS_COLORS[log.status] || "text-muted-foreground"}`}>
            {log.status}
          </span>
          <span className="truncate text-muted-foreground">{log.recipient_email}</span>
        </div>
      ))}
    </div>
  );
}
