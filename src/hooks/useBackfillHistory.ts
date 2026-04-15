import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BackfillRecord {
  id: string;
  period: string;
  status: string;
  records_loaded: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export function useBackfillStatus() {
  return useQuery({
    queryKey: ["backfill-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cuts_history_backfill")
        .select("*")
        .order("period", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BackfillRecord[];
    },
  });
}

export function useRunBackfill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (period: string) => {
      const { data, error } = await supabase.functions.invoke("backfill-cuts-history", {
        body: { period },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backfill-status"] });
      qc.invalidateQueries({ queryKey: ["cuts-history"] });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["backfill-status"] });
    },
  });
}
