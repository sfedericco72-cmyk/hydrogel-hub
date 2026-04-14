import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Device = Tables<"devices">;

export function useDevices() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .order("total_cuts", { ascending: false });

      if (error) throw error;
      return data as Device[];
    },
  });
}

export function useDevice(id: string | undefined) {
  return useQuery({
    queryKey: ["devices", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Device;
    },
    enabled: !!id,
  });
}

/** Map of fixno → last date with cuts > 0 */
export function useLastCutDates() {
  return useQuery({
    queryKey: ["last-cut-dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_cuts_history")
        .select("fixno, cut_date")
        .gt("daily_cuts", 0)
        .order("cut_date", { ascending: false });

      if (error) throw error;

      const map = new Map<string, string>();
      data?.forEach((r) => {
        if (!map.has(r.fixno)) map.set(r.fixno, r.cut_date);
      });
      return map;
    },
  });
}

/** Map of fixno → average daily cuts (last 30 days with cuts > 0) */
export function useAvgDailyCuts() {
  return useQuery({
    queryKey: ["avg-daily-cuts"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("device_cuts_history")
        .select("fixno, daily_cuts")
        .gt("daily_cuts", 0)
        .gte("cut_date", dateStr);

      if (error) throw error;

      const sums = new Map<string, { total: number; days: number }>();
      data?.forEach((r) => {
        const entry = sums.get(r.fixno) || { total: 0, days: 0 };
        entry.total += r.daily_cuts!;
        entry.days += 1;
        sums.set(r.fixno, entry);
      });

      const avgMap = new Map<string, number>();
      sums.forEach((v, k) => avgMap.set(k, v.total / v.days));
      return avgMap;
    },
  });
}

const LOW_STOCK_DAYS = 7;

/** Calculate estimated days of stock remaining */
export function getDaysOfStock(
  device: Device,
  avgDailyCuts: Map<string, number> | undefined
): number | null {
  if (!avgDailyCuts) return null;
  const avg = avgDailyCuts.get(device.fixno);
  if (!avg || avg <= 0) return null;
  return (device.remaining_cuts ?? 0) / avg;
}

/** Check if device has low stock (< 7 days of estimated usage) */
export function hasLowStock(
  device: Device,
  avgDailyCuts: Map<string, number> | undefined
): boolean {
  const days = getDaysOfStock(device, avgDailyCuts);
  if (days === null) return (device.remaining_cuts ?? 0) <= 10; // fallback if no history
  return days < LOW_STOCK_DAYS;
}

export type DeviceState = "stock" | "active" | "disconnected" | "inactive";

/** Check if device is "en stock" (no name or name equals fixno) */
export function isStock(device: Device): boolean {
  return !device.branch_name || device.branch_name === device.fixno;
}

/**
 * 4-state classification:
 * - stock: no branch_name or branch_name === fixno
 * - active: had cuts in last 2 months
 * - disconnected: no cuts in 2 months AND not online in last 7 days
 * - inactive: no cuts in 2 months BUT was online in last 7 days
 */
export function getDeviceState(
  device: Device,
  lastCutDates: Map<string, string> | undefined
): DeviceState {
  if (isStock(device)) return "stock";

  const hasCutsRecently = (() => {
    if (!lastCutDates) return true;
    const lastCut = lastCutDates.get(device.fixno);
    if (!lastCut) return false;
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    return new Date(lastCut) >= twoMonthsAgo;
  })();

  if (hasCutsRecently) return "active";

  // No cuts in 2 months — check connectivity
  const wasOnlineRecently = (() => {
    if (!device.latest_online_time) return false;
    const lastOnline = new Date(device.latest_online_time);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return lastOnline >= sevenDaysAgo;
  })();

  return wasOnlineRecently ? "inactive" : "disconnected";
}

export const DEVICE_STATE_LABELS: Record<DeviceState, string> = {
  stock: "En stock",
  active: "Activo",
  disconnected: "Desconectado",
  inactive: "Inactivo",
};

export function isOnline(device: Device): boolean {
  if (!device.latest_online_time) return false;
  const lastOnline = new Date(device.latest_online_time);
  const tenMinutesAgo = new Date();
  tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 60);
  return lastOnline >= tenMinutesAgo;
}

export function hasAlert(
  device: Device,
  avgDailyCuts?: Map<string, number>
): boolean {
  return (
    device.status !== "enabled" ||
    hasLowStock(device, avgDailyCuts)
  );
}
