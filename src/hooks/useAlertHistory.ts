import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenantId } from "./useUserTenantId";

export interface AlertHistoryEntry {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  metadata: any;
  created_at: string;
  // Resolved fields
  pdv_id?: string | null;
  pdv_name?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  fixno?: string | null;
}

const ALERT_TEMPLATES = ["stock-bajo", "dispositivo-desconectado", "email-no-configurado"];

/**
 * Returns deduplicated alert history (latest status per message_id) for the
 * current tenant's points of sale (matched by recipient email = pdv.alert_email
 * OR bcc_email), enriched with client/pdv/fixno when resolvable.
 *
 * For BCC-only emails (alert sent only to bcc) we still display them under
 * the matching PdV when fixno can be parsed from message_id.
 */
export function useAlertHistory(daysBack = 60) {
  const { data: tenantId } = useUserTenantId();

  return useQuery({
    queryKey: ["alert-history", tenantId, daysBack],
    enabled: !!tenantId,
    queryFn: async () => {
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

      // Load tenant PdV/clients to resolve recipient → PdV
      const [posRes, clientsRes, devAssignRes, settingsRes] = await Promise.all([
        supabase.from("points_of_sale").select("id, name, alert_email, client_id").eq("tenant_id", tenantId!),
        supabase.from("clients").select("id, name").eq("tenant_id", tenantId!),
        supabase
          .from("device_assignments")
          .select("point_of_sale_id, devices(fixno)")
          .eq("tenant_id", tenantId!)
          .is("unassigned_at", null),
        supabase.from("tenant_settings").select("bcc_email").eq("tenant_id", tenantId!).single(),
      ]);

      const pos = posRes.data || [];
      const clients = clientsRes.data || [];
      const assigns = devAssignRes.data || [];
      const bccEmail = settingsRes.data?.bcc_email?.toLowerCase() || null;

      const clientById = new Map(clients.map(c => [c.id, c]));
      // PdV lookup by alert_email (normalized)
      const pdvByEmail = new Map<string, typeof pos[number]>();
      pos.forEach(p => {
        if (p.alert_email) pdvByEmail.set(p.alert_email.toLowerCase().trim(), p);
      });
      // Lookup PdV by fixno (via active assignment)
      const pdvIdByFixno = new Map<string, string>();
      // Reverse lookup: PdV → list of active fixnos (used to infer fixno
      // for legacy alerts where metadata is null and message_id is a UUID).
      const fixnosByPdv = new Map<string, string[]>();
      assigns.forEach((a: any) => {
        const fx = a.devices?.fixno;
        if (fx && a.point_of_sale_id) {
          pdvIdByFixno.set(fx, a.point_of_sale_id);
          const arr = fixnosByPdv.get(a.point_of_sale_id) ?? [];
          arr.push(fx);
          fixnosByPdv.set(a.point_of_sale_id, arr);
        }
      });
      const pdvById = new Map(pos.map(p => [p.id, p]));

      // Possible recipient emails for this tenant
      const tenantEmails = new Set<string>();
      pos.forEach(p => {
        if (p.alert_email) tenantEmails.add(p.alert_email.toLowerCase().trim());
      });
      if (bccEmail) tenantEmails.add(bccEmail);

      // Fetch logs filtered by template + recipient
      const { data: logs, error } = await supabase
        .from("email_send_log")
        .select("id, message_id, template_name, recipient_email, status, error_message, metadata, created_at")
        .in("template_name", ALERT_TEMPLATES)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;

      // Dedupe by message_id (keep latest status — first because ordered DESC)
      const seenMsg = new Set<string>();
      const unique: typeof logs = [];
      for (const row of logs || []) {
        const key = row.message_id || row.id;
        if (seenMsg.has(key)) continue;
        seenMsg.add(key);
        unique.push(row);
      }

      // Enrich — prefer metadata enriched at send time (new alerts),
      // fall back to email/message_id heuristics for legacy rows.
      const enriched: AlertHistoryEntry[] = unique.map(row => {
        const md = (row.metadata ?? {}) as Record<string, any>;

        // 1. fixno
        let fixno: string | null = typeof md.fixno === 'string' ? md.fixno : null;
        if (!fixno && row.message_id) {
          const m = row.message_id.match(/^(?:stock-bajo|dispositivo-desconectado)(?:-bcc)?-(.+?)-\d{4}-\d{2}-\d{2}$/)
            || row.message_id.match(/^no-email-(?:stock|desconectado)-(.+?)-\d{4}-\d{2}-\d{2}$/);
          if (m) fixno = m[1];
        }

        // 2. pdv_id — metadata first, then resolve via recipient email, then via fixno
        let pdvId: string | null = typeof md.pdv_id === 'string' ? md.pdv_id : null;
        if (!pdvId) {
          const recipientLower = row.recipient_email.toLowerCase().trim();
          if (recipientLower !== bccEmail) {
            pdvId = pdvByEmail.get(recipientLower)?.id || null;
          }
        }
        if (!pdvId && fixno) {
          pdvId = pdvIdByFixno.get(fixno) || null;
        }

        // 3. Last-resort fixno: if we resolved a PdV but still have no fixno,
        // and that PdV has exactly ONE active device assigned, assume it.
        // Covers legacy alerts (pre-metadata) where the PdV is identified
        // via recipient_email but the message_id is a UUID.
        if (!fixno && pdvId) {
          const fxList = fixnosByPdv.get(pdvId) ?? [];
          if (fxList.length === 1) fixno = fxList[0];
        }

        const pdv = pdvId ? pdvById.get(pdvId) : null;
        const client = pdv ? clientById.get(pdv.client_id) : null;

        return {
          ...row,
          fixno,
          pdv_id: pdvId,
          pdv_name: pdv?.name || null,
          client_id: client?.id || null,
          client_name: client?.name || null,
        };
      });

      return enriched;
    },
    staleTime: 30_000,
  });
}
