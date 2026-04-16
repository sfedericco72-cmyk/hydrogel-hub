import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Computes total daily_cuts for a device assignment period
 * by querying device_cuts_history between assigned_at and unassigned_at.
 */
export function useAssignmentCuts(
  fixno: string | undefined,
  assignedAt: string | undefined,
  unassignedAt: string | null | undefined
) {
  return useQuery({
    queryKey: ["assignment-cuts", fixno, assignedAt, unassignedAt],
    enabled: !!fixno && !!assignedAt,
    queryFn: async () => {
      const startDate = assignedAt!.slice(0, 10);
      let query = supabase
        .from("device_cuts_history")
        .select("daily_cuts")
        .eq("fixno", fixno!)
        .gte("cut_date", startDate);

      if (unassignedAt) {
        query = query.lte("cut_date", unassignedAt.slice(0, 10));
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).reduce((sum, r) => sum + (r.daily_cuts ?? 0), 0);
    },
  });
}
