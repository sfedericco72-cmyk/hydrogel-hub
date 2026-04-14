import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EquipmentSale {
  id: string;
  customer_name: string;
  branch_name: string | null;
  period: string;
  units_sold: number;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useEquipmentSales(customerName?: string) {
  return useQuery({
    queryKey: ["equipment-sales", customerName],
    queryFn: async () => {
      let q = supabase
        .from("equipment_sales")
        .select("*")
        .order("period", { ascending: false });

      if (customerName && customerName !== "all") {
        q = q.eq("customer_name", customerName);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EquipmentSale[];
    },
  });
}

export function useUpsertEquipmentSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sale: {
      customer_name: string;
      branch_name?: string | null;
      period: string;
      units_sold: number;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("equipment_sales")
        .upsert(
          {
            customer_name: sale.customer_name,
            branch_name: sale.branch_name || null,
            period: sale.period,
            units_sold: sale.units_sold,
            notes: sale.notes || null,
            source: "manual",
          },
          { onConflict: "customer_name,period,branch_name" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipment-sales"] });
    },
  });
}

export function useDeleteEquipmentSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("equipment_sales")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipment-sales"] });
    },
  });
}
