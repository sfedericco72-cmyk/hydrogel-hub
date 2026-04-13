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
  tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 60); // consider online if seen in last hour
  return lastOnline >= tenMinutesAgo;
}

export function hasAlert(device: Device): boolean {
  return (
    device.status !== "enabled" ||
    !isOnline(device) ||
    (device.remaining_cuts ?? 0) <= 10
  );
}
