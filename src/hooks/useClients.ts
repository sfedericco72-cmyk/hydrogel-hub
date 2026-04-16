import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Client = Tables<"clients">;
export type PointOfSale = Tables<"points_of_sale">;
export type DeviceAssignment = Tables<"device_assignments">;

// ── Clients ──────────────────────────────────────────────
// RLS now filters by tenant automatically

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

export function useAssignDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<"device_assignments">) => {
      const { data, error } = await supabase.from("device_assignments").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["device-assignments"] });
      qc.invalidateQueries({ queryKey: ["unassigned-devices"] });
    },
  });
}

export function useUnassignDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("device_assignments")
        .update({ unassigned_at: new Date().toISOString() })
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["device-assignments"] });
      qc.invalidateQueries({ queryKey: ["unassigned-devices"] });
    },
  });
}

export function useUnassignedDevices() {
  return useQuery({
    queryKey: ["unassigned-devices"],
    queryFn: async () => {
      // Get devices that have no active assignment
      // RLS already filters by tenant
      const { data: assigned, error: aErr } = await supabase
        .from("device_assignments")
        .select("device_id")
        .is("unassigned_at", null);
      if (aErr) throw aErr;

      const assignedIds = (assigned || []).map((a) => a.device_id);

      const { data, error } = await supabase
        .from("devices")
        .select("id, fixno, customer_name, branch_name, status")
        .order("fixno");
      if (error) throw error;

      return (data || []).filter((d) => !assignedIds.includes(d.id));
    },
  });
}
