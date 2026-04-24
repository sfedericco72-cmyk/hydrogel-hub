import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CutHistoryRecord {
  id: string;
  fixno: string;
  cut_date: string;
  total_cuts: number;
  daily_cuts: number | null;
  created_at: string;
}

/**
 * Daily cuts history for a single device (last 90 days only — beyond that the
 * data lives in `device_cuts_monthly`). Used by the BranchDetail weekly view.
 */
export function useCutsHistory(fixno: string | undefined) {
  return useQuery({
    queryKey: ["cuts-history", fixno],
    queryFn: async () => {
      if (!fixno) return [];
      const { data, error } = await supabase
        .from("device_cuts_daily")
        .select("id, fixno, cut_date, total_cuts, daily_cuts, created_at")
        .eq("fixno", fixno)
        .order("cut_date", { ascending: true });

      if (error) throw error;
      return (data ?? []) as CutHistoryRecord[];
    },
    enabled: !!fixno,
  });
}

/**
 * Monthly aggregated cuts for a single device (full history, no caducity).
 * Used by the BranchDetail monthly/annual views.
 */
export interface MonthlyCutsRecord {
  year_month: string; // 'YYYY-MM'
  total_cuts: number;
}

export function useMonthlyCuts(fixno: string | undefined) {
  return useQuery({
    queryKey: ["monthly-cuts", fixno],
    queryFn: async () => {
      if (!fixno) return [];
      const { data, error } = await supabase
        .from("device_cuts_monthly")
        .select("year_month, total_cuts")
        .eq("fixno", fixno)
        .order("year_month", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MonthlyCutsRecord[];
    },
    enabled: !!fixno,
  });
}

export function useMonthlyStats(fixno: string | undefined) {
  const { data: history = [], ...rest } = useCutsHistory(fixno);

  const monthlyData = history.reduce<Record<string, { month: string; totalCuts: number; days: number }>>((acc, record) => {
    const month = record.cut_date.substring(0, 7); // YYYY-MM
    if (!acc[month]) {
      acc[month] = { month, totalCuts: 0, days: 0 };
    }
    acc[month].totalCuts += record.daily_cuts ?? 0;
    acc[month].days += 1;
    return acc;
  }, {});

  return {
    ...rest,
    data: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
    rawHistory: history,
  };
}
