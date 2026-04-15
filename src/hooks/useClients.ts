import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Client = Tables<"clients">;
export type PointOfSale = Tables<"points_of_sale">;
export type DeviceAssignment = Tables<"device_assignments">;

// ── Clients ──────────────────────────────────────────────

export function useClients(tenantId?: string) {
  return useQuery({
    queryKey: ["clients", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("tenant_id", tenantId!)
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

export function useAllPointsOfSale(tenantId?: string) {
  return useQuery({
    queryKey: ["points-of-sale-all", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      // Get all PdVs for clients belonging to this tenant
      const { data: clients, error: cErr } = await supabase
        .from("clients")
        .select("id")
        .eq("tenant_id", tenantId!);
      if (cErr) throw cErr;
      if (!clients?.length) return [];
      const clientIds = clients.map((c) => c.id);
      const { data, error } = await supabase
        .from("points_of_sale")
        .select("*, clients(name)")
        .in("client_id", clientIds)
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

export function useUnassignedDevices(tenantId?: string) {
  return useQuery({
    queryKey: ["unassigned-devices", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      // Get devices that have no active assignment
      const { data: assigned, error: aErr } = await supabase
        .from("device_assignments")
        .select("device_id")
        .is("unassigned_at", null);
      if (aErr) throw aErr;

      const assignedIds = (assigned || []).map((a) => a.device_id);

      let query = supabase
        .from("devices")
        .select("id, fixno, customer_name, branch_name, status")
        .eq("tenant_id", tenantId!);

      if (assignedIds.length > 0) {
        // Filter out assigned devices — supabase doesn't have NOT IN, use workaround
        const { data, error } = await query.order("fixno");
        if (error) throw error;
        return (data || []).filter((d) => !assignedIds.includes(d.id));
      }

      const { data, error } = await query.order("fixno");
      if (error) throw error;
      return data || [];
    },
  });
}

// ── Tenant helper ────────────────────────────────────────

export function useDefaultTenant() {
  return useQuery({
    queryKey: ["default-tenant"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", "bitec")
        .single();
      if (error) throw error;
      return data;
    },
  });
}
