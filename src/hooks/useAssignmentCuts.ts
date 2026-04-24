import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Computes total cuts for a device assignment period by combining:
 *  - device_cuts_monthly for full months covered by the assignment
 *  - device_cuts_daily   for the partial start month and partial end month
 *
 * This avoids both double-counting and missing data when an assignment spans
 * the boundary between the daily-detail window (last ~90 days) and the
 * monthly-only history.
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
      const endDate = (unassignedAt ?? new Date().toISOString()).slice(0, 10);
      const startMonth = startDate.slice(0, 7); // YYYY-MM
      const endMonth = endDate.slice(0, 7);
      const startsAtMonthStart = startDate.endsWith("-01");
      const endsAtMonthEnd = (() => {
        const [y, m] = endDate.split("-").map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        return parseInt(endDate.slice(8, 10), 10) === lastDay;
      })();

      // 1) Full months strictly between (start, end), exclusive of partial
      //    start and partial end months when they don't cover the full month.
      const fullMonthFrom = startsAtMonthStart ? startMonth : nextMonth(startMonth);
      const fullMonthTo = endsAtMonthEnd ? endMonth : prevMonth(endMonth);

      let monthlyTotal = 0;
      if (fullMonthFrom <= fullMonthTo) {
        const { data: monthly, error: mErr } = await supabase
          .from("device_cuts_monthly")
          .select("total_cuts")
          .eq("fixno", fixno!)
          .gte("year_month", fullMonthFrom)
          .lte("year_month", fullMonthTo);
        if (mErr) throw mErr;
        monthlyTotal = (monthly ?? []).reduce((s, r) => s + (r.total_cuts ?? 0), 0);
      }

      // 2) Partial start month: from startDate through end of startMonth (or endDate, whichever is earlier)
      let dailyTotal = 0;
      const dailyRanges: Array<{ from: string; to: string }> = [];
      if (!startsAtMonthStart) {
        const startMonthEnd = lastDayOfMonth(startMonth);
        dailyRanges.push({ from: startDate, to: startMonth === endMonth ? endDate : startMonthEnd });
      }
      // 3) Partial end month (only if different from start month and not fully covered)
      if (startMonth !== endMonth && !endsAtMonthEnd) {
        dailyRanges.push({ from: `${endMonth}-01`, to: endDate });
      }

      for (const r of dailyRanges) {
        const { data: daily, error: dErr } = await supabase
          .from("device_cuts_daily")
          .select("daily_cuts")
          .eq("fixno", fixno!)
          .gte("cut_date", r.from)
          .lte("cut_date", r.to);
        if (dErr) throw dErr;
        dailyTotal += (daily ?? []).reduce((s, x) => s + (x.daily_cuts ?? 0), 0);
      }

      return monthlyTotal + dailyTotal;
    },
  });
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1); // m is 1-based; new Date uses 0-based, so this is +1 month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}
