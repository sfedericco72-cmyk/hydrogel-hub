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

/**
 * Map of fixno → Map<"YYYY-MM", totalCuts>
 * Fetches last 3 months of cuts data for all devices.
 */
export function useMonthlyCutsMap(months = 6) {
  return useQuery({
    queryKey: ["monthly-cuts-map", months],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      startDate.setDate(1);
      const dateStr = startDate.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("device_cuts_history")
        .select("fixno, cut_date, daily_cuts")
        .gt("daily_cuts", 0)
        .gte("cut_date", dateStr);

      if (error) throw error;

      // fixno → Map<"YYYY-MM", totalCuts>
      const result = new Map<string, Map<string, number>>();
      data?.forEach((r) => {
        const month = r.cut_date.substring(0, 7);
        if (!result.has(r.fixno)) result.set(r.fixno, new Map());
        const deviceMap = result.get(r.fixno)!;
        deviceMap.set(month, (deviceMap.get(month) ?? 0) + (r.daily_cuts ?? 0));
      });
      return result;
    },
  });
}

export const LOW_STOCK_DAYS = 7;

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

/** Check if device has low stock */
export function hasLowStock(
  device: Device,
  avgDailyCuts: Map<string, number> | undefined,
  lowStockDays = LOW_STOCK_DAYS
): boolean {
  const days = getDaysOfStock(device, avgDailyCuts);
  if (days === null) return (device.remaining_cuts ?? 0) <= 10;
  return days < lowStockDays;
}

/** Check if device is "en stock" (no name or name equals fixno) */
export function isStock(device: Device): boolean {
  return !device.branch_name || device.branch_name === device.fixno;
}

export type ActivityState = "active" | "inactive";
export type DeviceState = ActivityState | "disconnected"; // for filter compat

/** Activity based on cuts only */
export function getActivityState(
  device: Device,
  lastCutDates: Map<string, string> | undefined,
  disconnectMonths = 3
): ActivityState {
  const hasCutsRecently = (() => {
    if (!lastCutDates) return true;
    const lastCut = lastCutDates.get(device.fixno);
    if (!lastCut) return false;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - disconnectMonths);
    return new Date(lastCut) >= cutoff;
  })();
  return hasCutsRecently ? "active" : "inactive";
}

/** Internet connection: >7 days = disconnected */
export function isDeviceDisconnected(device: Device, thresholdDays = 7): boolean {
  if (!device.latest_online_time) return true;
  const last = new Date(device.latest_online_time);
  const now = new Date();
  return (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24) > thresholdDays;
}

/** Get disconnection days for display */
export function getDisconnectionDays(device: Device): number | null {
  if (!device.latest_online_time) return null;
  const last = new Date(device.latest_online_time);
  const now = new Date();
  return Math.round((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}

// Legacy compat — maps to activity state
export function getDeviceState(
  device: Device,
  lastCutDates: Map<string, string> | undefined,
  disconnectMonths = 3
): DeviceState {
  return getActivityState(device, lastCutDates, disconnectMonths);
}

export const ACTIVITY_LABELS: Record<ActivityState, string> = {
  active: "Activo",
  inactive: "Inactivo",
};

export const DEVICE_STATE_LABELS = ACTIVITY_LABELS;

/**
 * Connection level based on latest_online_time:
 * - green: last 7 days
 * - yellow: last 14 days
 * - red: more than 14 days or never
 */
export type ConnectionLevel = "green" | "yellow" | "red";

export function getConnectionLevel(device: Device, greenDays = 7, yellowDays = 14): ConnectionLevel {
  if (!device.latest_online_time) return "red";
  const last = new Date(device.latest_online_time);
  const now = new Date();
  const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= greenDays) return "green";
  if (diffDays <= yellowDays) return "yellow";
  return "red";
}

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
