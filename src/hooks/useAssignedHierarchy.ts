import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Device } from "./useDevices";

export interface AssignedDevice {
  assignmentId: string;
  assignedAt: string;
  device: Device;
}

export interface HierarchyPOS {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  devices: AssignedDevice[];
}

export interface HierarchyClient {
  id: string;
  name: string;
  pointsOfSale: HierarchyPOS[];
  /** Total devices across all PdV */
  deviceCount: number;
}

/**
 * Fetches the full Client → PdV → Device hierarchy for the dashboard.
 * Only includes devices with active assignments (unassigned_at IS NULL).
 * Returns an empty array if there are no assignments.
 */
export function useAssignedHierarchy() {
  return useQuery({
    queryKey: ["assigned-hierarchy"],
    queryFn: async () => {
      // 1. Fetch all active assignments with device + PdV + client info
      const { data: assignments, error: aErr } = await supabase
        .from("device_assignments")
        .select(`
          id,
          assigned_at,
          device_id,
          point_of_sale_id,
          devices(*),
          points_of_sale(
            id, name, address, city,
            client_id,
            clients(id, name)
          )
        `)
        .is("unassigned_at", null);

      if (aErr) throw aErr;
      if (!assignments?.length) return [] as HierarchyClient[];

      // 2. Build hierarchy
      const clientMap = new Map<string, HierarchyClient>();

      for (const a of assignments) {
        const pos = a.points_of_sale as any;
        const client = pos?.clients as any;
        const device = a.devices as unknown as Device;

        if (!pos || !client || !device) continue;

        // RLS handles tenant filtering

        if (!clientMap.has(client.id)) {
          clientMap.set(client.id, {
            id: client.id,
            name: client.name,
            pointsOfSale: [],
            deviceCount: 0,
          });
        }

        const hClient = clientMap.get(client.id)!;
        let hPos = hClient.pointsOfSale.find((p) => p.id === pos.id);
        if (!hPos) {
          hPos = {
            id: pos.id,
            name: pos.name,
            address: pos.address,
            city: pos.city,
            devices: [],
          };
          hClient.pointsOfSale.push(hPos);
        }

        hPos.devices.push({
          assignmentId: a.id,
          assignedAt: a.assigned_at,
          device,
        });
        hClient.deviceCount++;
      }

      // 3. Sort everything
      const result = Array.from(clientMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      result.forEach((c) => {
        c.pointsOfSale.sort((a, b) => a.name.localeCompare(b.name));
        c.pointsOfSale.forEach((p) =>
          p.devices.sort((a, b) =>
            (a.device.fixno ?? "").localeCompare(b.device.fixno ?? "")
          )
        );
      });

      return result;
    },
  });
}

/** Flat list of all assigned devices from the hierarchy */
export function flatDevicesFromHierarchy(hierarchy: HierarchyClient[]): Device[] {
  return hierarchy.flatMap((c) =>
    c.pointsOfSale.flatMap((p) => p.devices.map((d) => d.device))
  );
}

/** Map of fixno → assignment start date (YYYY-MM-DD) */
export function assignmentStartDates(hierarchy: HierarchyClient[]): Map<string, string> {
  const map = new Map<string, string>();
  hierarchy.forEach((c) =>
    c.pointsOfSale.forEach((p) =>
      p.devices.forEach((ad) => {
        const startDate = ad.assignedAt.slice(0, 10);
        const existing = map.get(ad.device.fixno);
        // Keep the earliest assignment date if somehow duplicated
        if (!existing || startDate < existing) {
          map.set(ad.device.fixno, startDate);
        }
      })
    )
  );
  return map;
}
