import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
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
  const qc = useQueryClient();
  const prevLoadingRef = useRef<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["backfill-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cuts_history_backfill")
        .select("*")
        .order("period", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BackfillRecord[];
    },
    // Poll while at least one period is still loading so the UI updates
    // automatically when the background backfill finishes.
    refetchInterval: (query) => {
      const rows = (query.state.data as BackfillRecord[] | undefined) ?? [];
      return rows.some((r) => r.status === "loading" || r.status === "pending") ? 3000 : false;
    },
    refetchIntervalInBackground: true,
  });

  // When a period transitions from loading/pending → done, invalidate every
  // dashboard query that depends on device_cuts_history so the cards refresh
  // with the newly backfilled data (otherwise the dashboard keeps showing
  // stale "0 cortes" while the detail view shows the real numbers).
  useEffect(() => {
    const rows = query.data ?? [];
    const currentLoading = new Set(
      rows.filter((r) => r.status === "loading" || r.status === "pending").map((r) => r.period),
    );
    let anyFinished = false;
    prevLoadingRef.current.forEach((period) => {
      if (!currentLoading.has(period)) {
        const row = rows.find((r) => r.period === period);
        if (row?.status === "done") anyFinished = true;
      }
    });
    if (anyFinished) {
      qc.invalidateQueries({ queryKey: ["cuts-history"] });
      qc.invalidateQueries({ queryKey: ["last-cut-dates"] });
      qc.invalidateQueries({ queryKey: ["avg-daily-cuts"] });
      qc.invalidateQueries({ queryKey: ["monthly-cuts-map"] });
      qc.invalidateQueries({ queryKey: ["assignment-cuts"] });
      qc.invalidateQueries({ queryKey: ["equipment-sales"] });
    }
    prevLoadingRef.current = currentLoading;
  }, [query.data, qc]);

  return query;
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
      // The function returns 202 immediately; the real work runs in the
      // background. The polling in useBackfillStatus will pick up completion.
      qc.invalidateQueries({ queryKey: ["backfill-status"] });
      qc.invalidateQueries({ queryKey: ["cuts-history"] });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["backfill-status"] });
    },
  });
}
