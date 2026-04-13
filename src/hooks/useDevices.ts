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

/** Device is "active" if it had cuts within the last 2 months */
export function isDeviceActive(fixno: string, lastCutDates: Map<string, string> | undefined): boolean {
  if (!lastCutDates) return true; // default to active while loading
  const lastCut = lastCutDates.get(fixno);
  if (!lastCut) return false;
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  return new Date(lastCut) >= twoMonthsAgo;
}

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
