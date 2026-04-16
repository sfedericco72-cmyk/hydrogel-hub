import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEVICE_CONDITION_LABELS, type DeviceCondition } from "@/hooks/useClients";

export function ExportClientsButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const [clientsRes, posRes, assignmentsRes, devicesRes] = await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("points_of_sale").select("*, clients(name, code)").order("name"),
        supabase
          .from("device_assignments")
          .select("*, devices(fixno, branch_name, customer_name, status, total_cuts, remaining_cuts, condition, condition_notes, latest_online_time), points_of_sale(name, clients(name, code))")
          .is("unassigned_at", null),
        supabase.from("devices").select("*"),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (posRes.error) throw posRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (devicesRes.error) throw devicesRes.error;

      const clients = clientsRes.data || [];
      const pos = posRes.data || [];
      const assignments = assignmentsRes.data || [];
      const devices = devicesRes.data || [];

      // Counts per client
      const posPerClient = new Map<string, number>();
      pos.forEach((p: any) => posPerClient.set(p.client_id, (posPerClient.get(p.client_id) ?? 0) + 1));
      const devicesPerClient = new Map<string, number>();
      assignments.forEach((a: any) => {
        const cid = a.points_of_sale?.clients?.name;
        if (!cid) return;
      });
      const devicesPerClientById = new Map<string, number>();
      assignments.forEach((a: any) => {
        const posRow = pos.find((p: any) => p.id === a.point_of_sale_id);
        if (posRow) {
          devicesPerClientById.set(posRow.client_id, (devicesPerClientById.get(posRow.client_id) ?? 0) + 1);
        }
      });

      // Counts per PdV
      const devicesPerPdv = new Map<string, number>();
      assignments.forEach((a: any) => {
        devicesPerPdv.set(a.point_of_sale_id, (devicesPerPdv.get(a.point_of_sale_id) ?? 0) + 1);
      });

      // Map active assignment per device
      const deviceAssignment = new Map<string, any>();
      assignments.forEach((a: any) => deviceAssignment.set(a.device_id, a));

      // Sheet 1: Clientes
      const clientsSheet = clients.map((c: any) => ({
        Código: c.code || "",
        Nombre: c.name,
        Contacto: c.contact_name || "",
        Email: c.contact_email || "",
        Teléfono: c.contact_phone || "",
        Dirección: c.address || "",
        "PdV": posPerClient.get(c.id) || 0,
        "Equipos asignados": devicesPerClientById.get(c.id) || 0,
      }));

      // Sheet 2: PdV
      const posSheet = pos.map((p: any) => ({
        Cliente: p.clients?.name || "",
        "Código cliente": p.clients?.code || "",
        Nombre: p.name,
        Dirección: p.address || "",
        Ciudad: p.city || "",
        "Email alertas": p.alert_email || "",
        "Alertas activas": p.alerts_enabled ? "Sí" : "No",
        "Equipos asignados": devicesPerPdv.get(p.id) || 0,
      }));

      // Sheet 3: Equipos
      const devicesSheet = devices.map((d: any) => {
        const assignment = deviceAssignment.get(d.id);
        const posRow = assignment ? pos.find((p: any) => p.id === assignment.point_of_sale_id) : null;
        const conditionLabel = d.condition
          ? DEVICE_CONDITION_LABELS[d.condition as DeviceCondition] || d.condition
          : "";
        return {
          Fixno: d.fixno,
          Cliente: posRow?.clients?.name || "",
          PdV: posRow?.name || "",
          Estado: assignment ? "Asignado" : "Sin asignar",
          Condición: conditionLabel,
          Notas: d.condition_notes || "",
          Status: d.status || "",
          "Cortes totales": d.total_cuts || 0,
          "Cortes restantes": d.remaining_cuts || 0,
          "Última conexión": d.latest_online_time
            ? new Date(d.latest_online_time).toLocaleString("es-CL")
            : "",
          "Fecha asignación": assignment
            ? new Date(assignment.assigned_at).toLocaleDateString("es-CL")
            : "",
          "Motivo asignación": assignment?.assignment_reason || "",
        };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientsSheet), "Clientes");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(posSheet), "Puntos de Venta");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(devicesSheet), "Equipos");

      const fileName = `clientes-equipos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Archivo descargado");
    } catch (e: any) {
      toast.error(e.message || "Error al exportar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
      Exportar
    </Button>
  );
}
