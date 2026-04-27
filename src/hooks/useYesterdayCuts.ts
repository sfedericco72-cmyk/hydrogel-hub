import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSettings } from "./useTenantSettings";
import { useUserTenantId } from "./useUserTenantId";

/**
 * Returns yesterday's cut totals (in tenant's timezone) split by whether
 * each device is currently assigned to a point of sale. Also returns the
 * 7-day average (excluding today) for context.
 *
 * The number is intentionally GLOBAL — it does NOT respect the dashboard's
 * client filter — because it's meant as a top-level operational signal.
 */

const PAGE_SIZE = 1000;
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (let i = 0; i < 50; i++) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const chunk = data ?? [];
    all.push(...chunk);
    if (chunk.length < PAGE_SIZE) return all;
    from += PAGE_SIZE;
  }
  return all;
}

/** Returns YYYY-MM-DD for `date` rendered in the given IANA timezone. */
function ymdInTz(date: Date, timeZone: string): string {
  // en-CA gives ISO-like YYYY-MM-DD reliably.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export interface YesterdayCutsResult {
  yesterdayDate: string; // YYYY-MM-DD in tenant TZ
  assignedYesterday: number;
  unassignedYesterday: number;
  avg7d: number;
}

export function useYesterdayCuts() {
  const { data: tenantId } = useUserTenantId();
  const { data: settings } = useTenantSettings();
  const tz = settings?.timezone ?? "America/Santiago";

  return useQuery<YesterdayCutsResult>({
    queryKey: ["yesterday-cuts", tenantId, tz],
    enabled: !!tenantId,
    queryFn: async () => {
      const today = ymdInTz(new Date(), tz);
      const yesterday = addDays(today, -1);
      const sevenAgo = addDays(today, -7); // last 7 full days: yesterday-6 .. yesterday

      // Fetch daily cuts for the last 7 full days.
      const rows = await fetchAll<{ fixno: string; cut_date: string; daily_cuts: number | null }>(
        (from, to) =>
          supabase
            .from("device_cuts_daily")
            .select("fixno, cut_date, daily_cuts")
            .gte("cut_date", sevenAgo)
            .lte("cut_date", yesterday)
            .range(from, to),
      );

      // Active assignments (= currently assigned fixnos).
      const assignmentRows = await fetchAll<{ device_id: string }>((from, to) =>
        supabase
          .from("device_assignments")
          .select("device_id")
          .is("unassigned_at", null)
          .range(from, to),
      );
      const deviceIds = Array.from(new Set(assignmentRows.map((r) => r.device_id)));

      const assignedFixnos = new Set<string>();
      if (deviceIds.length > 0) {
        // Resolve device_id -> fixno via devices table (tenant-scoped via RLS).
        const devs = await fetchAll<{ id: string; fixno: string }>((from, to) =>
          supabase
            .from("devices")
            .select("id, fixno")
            .in("id", deviceIds)
            .range(from, to),
        );
        devs.forEach((d) => assignedFixnos.add(d.fixno));
      }

      let assignedYesterday = 0;
      let unassignedYesterday = 0;
      let assigned7dTotal = 0;

      for (const r of rows) {
        const cuts = r.daily_cuts ?? 0;
        if (cuts <= 0) continue;
        const isAssigned = assignedFixnos.has(r.fixno);
        if (r.cut_date === yesterday) {
          if (isAssigned) assignedYesterday += cuts;
          else unassignedYesterday += cuts;
        }
        if (isAssigned) assigned7dTotal += cuts;
      }

      const avg7d = Math.round(assigned7dTotal / 7);

      return {
        yesterdayDate: yesterday,
        assignedYesterday,
        unassignedYesterday,
        avg7d,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}