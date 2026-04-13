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
