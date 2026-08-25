import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenantId } from "./useUserTenantId";

const ALERT_TEMPLATES = ["stock-bajo", "dispositivo-desconectado", "email-no-configurado"];

export interface AlertCheckRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  forced: boolean;
  tenants_processed: number;
  tenants_skipped: any;
  alerts_sent: any;
  error_message: string | null;
}

export interface MutedDeviceRow {
  device_id: string;
  fixno: string;
  branch_name: string | null;
  muted_until: string;
  reason: string | null;
  pdv_name: string | null;
  client_name: string | null;
}

export interface PdvIssueRow {
  id: string;
  name: string;
  client_name: string | null;
  alert_email: string | null;
  alerts_enabled: boolean;
}

/** Latest run of the automatic alert check (global, all tenants). */
export function useLastAlertCheckRun() {
  return useQuery({
    queryKey: ["alert-check-run-last"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_check_runs")
        .select("id, started_at, finished_at, status, forced, tenants_processed, tenants_skipped, alerts_sent, error_message")
        .order("started_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as AlertCheckRun | null;
    },
    refetchInterval: 60_000,
  });
}

/** Alerts effectively sent in the last N days (tenant-scoped via RLS on the log). */
export function useAlertsSentCount(days = 7) {
  return useQuery({
    queryKey: ["alerts-sent-count", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("email_send_log")
        .select("id", { count: "exact", head: true })
        .in("template_name", ALERT_TEMPLATES)
        .gte("created_at", since);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
}

/** Devices currently muted by the system (temporary mute with an end date). */
export function useMutedDevices() {
  const { data: tenantId } = useUserTenantId();

  return useQuery({
    queryKey: ["muted-devices", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data: devices, error } = await supabase
        .from("devices")
        .select("id, fixno, branch_name, alerts_muted_until, alerts_mute_reason")
        .eq("tenant_id", tenantId!)
        .gt("alerts_muted_until", nowIso)
        .order("alerts_muted_until", { ascending: true });
      if (error) throw error;
      if (!devices?.length) return [] as MutedDeviceRow[];

      const { data: assigns } = await supabase
        .from("device_assignments")
        .select("device_id, points_of_sale(name, clients(name))")
        .eq("tenant_id", tenantId!)
        .is("unassigned_at", null)
        .in("device_id", devices.map((d) => d.id));

      const pdvByDevice = new Map<string, { pdv: string | null; client: string | null }>();
      (assigns || []).forEach((a: any) => {
        pdvByDevice.set(a.device_id, {
          pdv: a.points_of_sale?.name ?? null,
          client: a.points_of_sale?.clients?.name ?? null,
        });
      });

      return devices.map((d) => ({
        device_id: d.id,
        fixno: d.fixno,
        branch_name: d.branch_name,
        muted_until: d.alerts_muted_until as string,
        reason: d.alerts_mute_reason,
        pdv_name: pdvByDevice.get(d.id)?.pdv ?? null,
        client_name: pdvByDevice.get(d.id)?.client ?? null,
      })) as MutedDeviceRow[];
    },
  });
}

/** PdV with alerts switched off manually, or without a recipient email. */
export function usePdvAlertIssues() {
  const { data: tenantId } = useUserTenantId();

  return useQuery({
    queryKey: ["pdv-alert-issues", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("points_of_sale")
        .select("id, name, alert_email, alerts_enabled, clients(name)")
        .eq("tenant_id", tenantId!)
        .order("name");
      if (error) throw error;

      const rows = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        client_name: p.clients?.name ?? null,
        alert_email: p.alert_email,
        alerts_enabled: p.alerts_enabled,
      })) as PdvIssueRow[];

      return {
        disabled: rows.filter((r) => !r.alerts_enabled),
        noEmail: rows.filter((r) => r.alerts_enabled && !r.alert_email),
      };
    },
  });
}

export function useUnmuteDevices() {
  const qc = useQueryClient();
  const { data: tenantId } = useUserTenantId();

  return useMutation({
    mutationFn: async (deviceIds: string[] | "all") => {
      let q = supabase
        .from("devices")
        .update({ alerts_muted_until: null, alerts_mute_reason: null, first_alert_sent_at: null })
        .eq("tenant_id", tenantId!);
      if (deviceIds !== "all") q = q.in("id", deviceIds);
      else q = q.not("alerts_muted_until", "is", null);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["muted-devices"] });
      qc.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

export function useEnablePdvAlerts() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (pdvId: string) => {
      const { error } = await supabase
        .from("points_of_sale")
        .update({ alerts_enabled: true })
        .eq("id", pdvId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pdv-alert-issues"] });
      qc.invalidateQueries({ queryKey: ["points-of-sale"] });
    },
  });
}
