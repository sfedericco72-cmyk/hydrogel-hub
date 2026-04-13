export type EquipmentStatus = "operativo" | "mantenimiento" | "fuera_de_servicio";
export type ConnectivityStatus = "online" | "offline";
export type SoftwareStatus = "actualizado" | "pendiente" | "desactualizado";

export interface BranchNote {
  id: string;
  date: string;
  author: string;
  content: string;
  type: "consulta" | "visita" | "incidencia" | "general";
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  equipmentStatus: EquipmentStatus;
  softwareVersion: string;
  softwareStatus: SoftwareStatus;
  totalCuts: number;
  cutsToday: number;
  connectivity: ConnectivityStatus;
  lastConnection: string;
  lastVisit: string;
  lastDataUpdate: string;
  notes: BranchNote[];
  contactName: string;
  contactPhone: string;
}
