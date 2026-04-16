import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TenantSettings {
  id: string;
  tenant_name: string;
  company_name: string;
  logo_url: string | null;
  bcc_email: string | null;
  attach_rate_green: number;
  attach_rate_yellow: number;
  low_stock_days: number;
  disconnect_months: number;
  connection_green_days: number;
  connection_yellow_days: number;
  alert_cooldown_days: number;
  alert_max_window_days: number;
  created_at: string;
  updated_at: string;
}

export function useTenantSettings() {
  return useQuery({
    queryKey: ["tenant-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("*")
        .eq("tenant_name", "bitec")
        .single();

      if (error) throw error;
      return data as TenantSettings;
    },
  });
}

export function useUpdateTenantSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Omit<TenantSettings, "id" | "tenant_name" | "created_at" | "updated_at">>) => {
      const { data, error } = await supabase
        .from("tenant_settings")
        .update(updates)
        .eq("tenant_name", "bitec")
        .select()
        .single();

      if (error) throw error;
      return data as TenantSettings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-settings"] });
    },
  });
}
