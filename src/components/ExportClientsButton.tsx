import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEVICE_CONDITION_LABELS, type DeviceCondition } from "@/hooks/useClients";

type Row = {
  Cliente: string;
  "Código cliente": string;
  "Contacto cliente": string;
  "Email cliente": string;
  "Teléfono cliente": string;
  "Dirección cliente": string;
  PdV: string;
  "Dirección PdV": string;
  "Ciudad PdV": string;
  "Email alertas PdV": string;
  "Alertas activas PdV": string;
  Fixno: string;
  "Estado equipo": string;
  Condición: string;
  "Notas condición": string;
  Status: string;
  "Cortes totales": number | string;
  "Cortes restantes": number | string;
  "Última conexión": string;
  "Fecha asignación": string;
  "Motivo asignación": string;
};

const emptyRow = (): Partial<Row> => ({
  Cliente: "",
  "Código cliente": "",
  "Contacto cliente": "",
  "Email cliente": "",
  "Teléfono cliente": "",
  "Dirección cliente": "",
  PdV: "",
  "Dirección PdV": "",
  "Ciudad PdV": "",
  "Email alertas PdV": "",
  "Alertas activas PdV": "",
  Fixno: "",
  "Estado equipo": "",
  Condición: "",
  "Notas condición": "",
  Status: "",
  "Cortes totales": "",
  "Cortes restantes": "",
  "Última conexión": "",
  "Fecha asignación": "",
  "Motivo asignación": "",
});

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-CL") : "");
const fmtDateOnly = (d: string | null) => (d ? new Date(d).toLocaleDateString("es-CL") : "");

export function ExportClientsButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const [clientsRes, posRes, assignmentsRes, devicesRes] = await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("points_of_sale").select("*").order("name"),
        supabase
          .from("device_assignments")
          .select("*, devices(fixno, branch_name, status, total_cuts, remaining_cuts, condition, condition_notes, latest_online_time)")
          .is("unassigned_at", null),
        supabase.from("devices").select("*").order("fixno"),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (posRes.error) throw posRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (devicesRes.error) throw devicesRes.error;

      const clients = clientsRes.data || [];
      const pos = posRes.data || [];
      const assignments = assignmentsRes.data || [];
      const devices = devicesRes.data || [];

      // Indexes
      const posByClient = new Map<string, any[]>();
      pos.forEach((p: any) => {
        if (!posByClient.has(p.client_id)) posByClient.set(p.client_id, []);
        posByClient.get(p.client_id)!.push(p);
      });

      const assignmentsByPos = new Map<string, any[]>();
      assignments.forEach((a: any) => {
        if (!assignmentsByPos.has(a.point_of_sale_id)) assignmentsByPos.set(a.point_of_sale_id, []);
        assignmentsByPos.get(a.point_of_sale_id)!.push(a);
      });

      const assignedDeviceIds = new Set(assignments.map((a: any) => a.device_id));

      const conditionLabel = (c: string | null | undefined) =>
        c ? DEVICE_CONDITION_LABELS[c as DeviceCondition] || c : "";

      const rows: Partial<Row>[] = [];

      // ── Clientes con/sin equipos (jerárquico) ─────────────
      for (const c of clients) {
        const clientCols = {
          Cliente: c.name,
          "Código cliente": c.code || "",
          "Contacto cliente": c.contact_name || "",
          "Email cliente": c.contact_email || "",
          "Teléfono cliente": c.contact_phone || "",
          "Dirección cliente": c.address || "",
        };

        const clientPos = posByClient.get(c.id) || [];
        if (clientPos.length === 0) {
          // Cliente sin PdV
          rows.push({ ...emptyRow(), ...clientCols });
          continue;
        }

        for (const p of clientPos) {
          const posCols = {
            ...clientCols,
            PdV: p.name,
            "Dirección PdV": p.address || "",
            "Ciudad PdV": p.city || "",
            "Email alertas PdV": p.alert_email || "",
            "Alertas activas PdV": p.alerts_enabled ? "Sí" : "No",
          };

          const posAssignments = assignmentsByPos.get(p.id) || [];
          if (posAssignments.length === 0) {
            // PdV sin equipos
            rows.push({ ...emptyRow(), ...posCols });
            continue;
          }

          for (const a of posAssignments) {
            const d = a.devices;
            if (!d) continue;
            rows.push({
              ...emptyRow(),
              ...posCols,
              Fixno: d.fixno,
              "Estado equipo": "Asignado",
              Condición: conditionLabel(d.condition),
              "Notas condición": d.condition_notes || "",
              Status: d.status || "",
              "Cortes totales": d.total_cuts ?? 0,
              "Cortes restantes": d.remaining_cuts ?? 0,
              "Última conexión": fmtDate(d.latest_online_time),
              "Fecha asignación": fmtDateOnly(a.assigned_at),
              "Motivo asignación": a.assignment_reason || "",
            });
          }
        }
      }

      // ── Build XLSX (Hoja 1: jerárquico) ───────────────────
      const ws = XLSX.utils.json_to_sheet(rows, {
        header: [
          "Cliente",
          "Código cliente",
          "Contacto cliente",
          "Email cliente",
          "Teléfono cliente",
          "Dirección cliente",
          "PdV",
          "Dirección PdV",
          "Ciudad PdV",
          "Email alertas PdV",
          "Alertas activas PdV",
          "Fixno",
          "Estado equipo",
          "Condición",
          "Notas condición",
          "Status",
          "Cortes totales",
          "Cortes restantes",
          "Última conexión",
          "Fecha asignación",
          "Motivo asignación",
        ],
      });

      ws["!cols"] = [
        { wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 24 }, { wch: 14 }, { wch: 30 },
        { wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 24 }, { wch: 10 },
        { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 10 },
        { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 24 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clientes y Equipos");

      // ── Hoja 2: Equipos sin asignar ───────────────────────
      const unassignedDevices = devices.filter((d: any) => !assignedDeviceIds.has(d.id));
      const unassignedRows = unassignedDevices.map((d: any) => ({
        Fixno: d.fixno,
        Condición: conditionLabel(d.condition),
        "Notas condición": d.condition_notes || "",
        Status: d.status || "",
        "Cortes totales": d.total_cuts ?? 0,
        "Cortes restantes": d.remaining_cuts ?? 0,
        "Última conexión": fmtDate(d.latest_online_time),
        "Nombre equipo (CutABC)": d.branch_name || "",
        "Dirección origen": d.address || "",
        "Ciudad origen": d.city || "",
      }));

      const ws2 = XLSX.utils.json_to_sheet(
        unassignedRows.length > 0
          ? unassignedRows
          : [{ Fixno: "(no hay equipos sin asignar)" }],
        {
          header: [
            "Fixno",
            "Condición",
            "Notas condición",
            "Status",
            "Cortes totales",
            "Cortes restantes",
            "Última conexión",
            "Nombre equipo (CutABC)",
            "Dirección origen",
            "Ciudad origen",
          ],
        }
      );
      ws2["!cols"] = [
        { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 10 },
        { wch: 12 }, { wch: 14 }, { wch: 18 },
        { wch: 26 }, { wch: 28 }, { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, "Equipos sin asignar");

      const fileName = `clientes-equipos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`Archivo descargado (${unassignedDevices.length} equipos sin asignar)`);
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
