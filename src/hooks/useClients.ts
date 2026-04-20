import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Client = Tables<"clients">;
export type PointOfSale = Tables<"points_of_sale">;
export type DeviceAssignment = Tables<"device_assignments">;

export type DeviceCondition =
  | "nuevo"
  | "usado"
  | "roto"
  | "en_reparacion"
  | "reparado"
  | "fuera_de_servicio";

export const DEVICE_CONDITION_LABELS: Record<DeviceCondition, string> = {
  nuevo: "Nuevo",
  usado: "Usado",
  roto: "Roto",
  en_reparacion: "En reparación",
  reparado: "Reparado",
  fuera_de_servicio: "Fuera de servicio",
};

export const DEVICE_CONDITION_VALUES: DeviceCondition[] = [
  "nuevo",
  "usado",
  "roto",
  "en_reparacion",
  "reparado",
  "fuera_de_servicio",
];

// ── Clients ──────────────────────────────────────────────

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Client[];
    },
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<"clients">) => {
      const { data, error } = await supabase.from("clients").insert(input).select().single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"clients"> & { id: string }) => {
      const { data, error } = await supabase.from("clients").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

// ── Points of Sale ───────────────────────────────────────

export function usePointsOfSale(clientId?: string) {
  return useQuery({
    queryKey: ["points-of-sale", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("points_of_sale")
        .select("*")
        .eq("client_id", clientId!)
        .order("name");
      if (error) throw error;
      return data as PointOfSale[];
    },
  });
}

export function useAllPointsOfSale() {
  return useQuery({
    queryKey: ["points-of-sale-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("points_of_sale")
        .select("*, clients(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePointOfSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<"points_of_sale">) => {
      const { data, error } = await supabase.from("points_of_sale").insert(input).select().single();
      if (error) throw error;
      return data as PointOfSale;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["points-of-sale"] }),
  });
}

export function useUpdatePointOfSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"points_of_sale"> & { id: string }) => {
      const { data, error } = await supabase.from("points_of_sale").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as PointOfSale;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["points-of-sale"] }),
  });
}

export function useDeletePointOfSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("points_of_sale").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["points-of-sale"] }),
  });
}

// ── Device Assignments ───────────────────────────────────

export function useDeviceAssignments(pointOfSaleId?: string) {
  return useQuery({
    queryKey: ["device-assignments", pointOfSaleId],
    enabled: !!pointOfSaleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_assignments")
        .select("*, devices(fixno, customer_name, status, remaining_cuts, latest_online_time)")
        .eq("point_of_sale_id", pointOfSaleId!)
        .is("unassigned_at", null)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useDeviceAssignmentHistory(pointOfSaleId?: string) {
  return useQuery({
    queryKey: ["device-assignment-history", pointOfSaleId],
    enabled: !!pointOfSaleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_assignments")
        .select("*, devices(fixno, customer_name)")
        .eq("point_of_sale_id", pointOfSaleId!)
        .not("unassigned_at", "is", null)
        .order("unassigned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Per-client aggregate of PdV alert configuration health */
export interface PdvAlertSummary {
  total: number;
  on_with_email: number;
  on_no_email: number;
  off: number;
}

export function useAllPdvAlertSummaries() {
  return useQuery({
    queryKey: ["pdv-alert-summaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("points_of_sale")
        .select("id, client_id, alerts_enabled, alert_email");
      if (error) throw error;
      const byClient = new Map<string, PdvAlertSummary>();
      const byPdv = new Map<string, { alerts_enabled: boolean; alert_email: string | null }>();
      (data || []).forEach((p: any) => {
        byPdv.set(p.id, { alerts_enabled: !!p.alerts_enabled, alert_email: p.alert_email });
        const cur = byClient.get(p.client_id) ?? { total: 0, on_with_email: 0, on_no_email: 0, off: 0 };
        cur.total += 1;
        if (p.alerts_enabled) {
          if (p.alert_email && p.alert_email.trim()) cur.on_with_email += 1;
          else cur.on_no_email += 1;
        } else {
          cur.off += 1;
        }
        byClient.set(p.client_id, cur);
      });
      return { byClient, byPdv };
    },
  });
}

/** Active assignment counts per client_id (for "with/without devices" grouping) */
export function useClientAssignmentCounts() {
  return useQuery({
    queryKey: ["client-assignment-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_assignments")
        .select("point_of_sale_id, points_of_sale(client_id)")
        .is("unassigned_at", null);
      if (error) throw error;
      const counts = new Map<string, number>();
      (data || []).forEach((row: any) => {
        const cid = row.points_of_sale?.client_id;
        if (cid) counts.set(cid, (counts.get(cid) ?? 0) + 1);
      });
      return counts;
    },
  });
}

export function useAssignDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<"device_assignments"> & { assignment_reason?: string | null }) => {
      const { data, error } = await supabase.from("device_assignments").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["device-assignments"] });
      qc.invalidateQueries({ queryKey: ["unassigned-devices"] });
      qc.invalidateQueries({ queryKey: ["client-assignment-counts"] });
    },
  });
}

export function useUnassignDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, reason }: { assignmentId: string; reason?: string | null }) => {
      const { error } = await supabase
        .from("device_assignments")
        .update({ unassigned_at: new Date().toISOString(), unassignment_reason: reason || null })
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["device-assignments"] });
      qc.invalidateQueries({ queryKey: ["device-assignment-history"] });
      qc.invalidateQueries({ queryKey: ["unassigned-devices"] });
      qc.invalidateQueries({ queryKey: ["client-assignment-counts"] });
    },
  });
}

export function useUnassignedDevices() {
  return useQuery({
    queryKey: ["unassigned-devices"],
    queryFn: async () => {
      const { data: assigned, error: aErr } = await supabase
        .from("device_assignments")
        .select("device_id")
        .is("unassigned_at", null);
      if (aErr) throw aErr;

      const assignedIds = (assigned || []).map((a) => a.device_id);

      const { data, error } = await supabase
        .from("devices")
        .select("id, fixno, customer_name, branch_name, status, latest_online_time, remaining_cuts, condition, condition_notes")
        .order("fixno");
      if (error) throw error;

      return (data || []).filter((d) => !assignedIds.includes(d.id));
    },
  });
}

export function useUpdateDeviceCondition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      deviceId,
      condition,
      notes,
    }: {
      deviceId: string;
      condition: DeviceCondition | null;
      notes?: string | null;
    }) => {
      const updates: any = { condition };
      if (notes !== undefined) updates.condition_notes = notes;
      const { error } = await supabase.from("devices").update(updates).eq("id", deviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unassigned-devices"] });
      qc.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}
