import { useState } from "react";
import { Building2, Plus, Pencil, Trash2, MapPin, ChevronDown, ChevronRight, Cpu, ArrowLeft, X, Unplug, Upload, History, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  useDefaultTenant,
  useClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  usePointsOfSale,
  useCreatePointOfSale,
  useUpdatePointOfSale,
  useDeletePointOfSale,
  useDeviceAssignments,
  useDeviceAssignmentHistory,
  useAssignDevice,
  useUnassignDevice,
  useUnassignedDevices,
} from "@/hooks/useClients";
import { ImportClientsDialog } from "@/components/ImportClientsDialog";

// ── Client Form Dialog ──────────────────────────────────

function ClientDialog({
  open,
  onClose,
  tenantId,
  editClient,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  editClient?: { id: string; name: string; contact_name: string | null; contact_phone: string | null; contact_email: string | null } | null;
}) {
  const [name, setName] = useState(editClient?.name || "");
  const [contactName, setContactName] = useState(editClient?.contact_name || "");
  const [contactPhone, setContactPhone] = useState(editClient?.contact_phone || "");
  const [contactEmail, setContactEmail] = useState(editClient?.contact_email || "");
  const create = useCreateClient();
  const update = useUpdateClient();
  const isEdit = !!editClient;

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }
    try {
      if (isEdit) {
        await update.mutateAsync({
          id: editClient.id,
          name: trimmed,
          contact_name: contactName.trim() || null,
          contact_phone: contactPhone.trim() || null,
          contact_email: contactEmail.trim() || null,
        });
        toast.success("Cliente actualizado");
      } else {
        await create.mutateAsync({
          tenant_id: tenantId,
          name: trimmed,
          contact_name: contactName.trim() || null,
          contact_phone: contactPhone.trim() || null,
          contact_email: contactEmail.trim() || null,
        });
        toast.success("Cliente creado");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar cliente");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del cliente" maxLength={100} />
          </div>
          <div>
            <Label>Contacto</Label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nombre de contacto" maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Teléfono</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+56 9..." maxLength={20} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="email@..." maxLength={255} type="email" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {isEdit ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── PdV Form Dialog ─────────────────────────────────────

function PdVDialog({
  open,
  onClose,
  clientId,
  editPdV,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  editPdV?: { id: string; name: string; address: string | null; city: string | null } | null;
}) {
  const [name, setName] = useState(editPdV?.name || "");
  const [address, setAddress] = useState(editPdV?.address || "");
  const [city, setCity] = useState(editPdV?.city || "");
  const create = useCreatePointOfSale();
  const update = useUpdatePointOfSale();
  const isEdit = !!editPdV;

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("El nombre del punto de venta es obligatorio");
      return;
    }
    try {
      if (isEdit) {
        await update.mutateAsync({ id: editPdV.id, name: trimmed, address: address.trim() || null, city: city.trim() || null });
        toast.success("Punto de venta actualizado");
      } else {
        await create.mutateAsync({ client_id: clientId, name: trimmed, address: address.trim() || null, city: city.trim() || null });
        toast.success("Punto de venta creado");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar punto de venta");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Punto de Venta" : "Nuevo Punto de Venta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del PdV" maxLength={100} />
          </div>
          <div>
            <Label>Dirección</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección" maxLength={200} />
          </div>
          <div>
            <Label>Ciudad</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ciudad" maxLength={100} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {isEdit ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Assign Device Dialog ────────────────────────────────

function AssignDeviceDialog({
  open,
  onClose,
  pointOfSaleId,
  tenantId,
}: {
  open: boolean;
  onClose: () => void;
  pointOfSaleId: string;
  tenantId: string;
}) {
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const { data: unassigned = [] } = useUnassignedDevices(tenantId);
  const assign = useAssignDevice();

  const handleAssign = async () => {
    if (!selectedDeviceId) {
      toast.error("Selecciona un equipo");
      return;
    }
    try {
      await assign.mutateAsync({ device_id: selectedDeviceId, point_of_sale_id: pointOfSaleId });
      toast.success("Equipo asignado");
      setSelectedDeviceId("");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Error al asignar equipo");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar Equipo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {unassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay equipos disponibles para asignar.</p>
          ) : (
            <div>
              <Label>Equipo disponible</Label>
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar equipo..." />
                </SelectTrigger>
                <SelectContent>
                  {unassigned.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.fixno} — {d.customer_name || d.branch_name || "Sin nombre"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleAssign} disabled={assign.isPending || !selectedDeviceId}>
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── PdV Row with Assignments ────────────────────────────

function PdVRow({
  pdv,
  tenantId,
  onEdit,
  onDelete,
}: {
  pdv: { id: string; name: string; address: string | null; city: string | null };
  tenantId: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { data: assignments = [] } = useDeviceAssignments(expanded ? pdv.id : undefined);
  const { data: history = [] } = useDeviceAssignmentHistory(expanded && showHistory ? pdv.id : undefined);
  const unassign = useUnassignDevice();

  return (
    <div className="border border-border rounded-lg bg-secondary/30">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <MapPin className="w-4 h-4 text-primary" />
          <div>
            <span className="font-medium text-sm">{pdv.name}</span>
            {pdv.city && <span className="text-xs text-muted-foreground ml-2">{pdv.city}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {pdv.address && <p className="text-xs text-muted-foreground">{pdv.address}</p>}

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Equipos asignados</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAssignOpen(true)}>
              <Plus className="w-3 h-3 mr-1" /> Asignar
            </Button>
          </div>

          {assignments.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sin equipos asignados</p>
          ) : (
            <div className="space-y-1">
              {assignments.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm font-mono">{a.devices?.fixno}</span>
                    <span className="text-xs text-muted-foreground">{a.devices?.customer_name || ""}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => {
                      if (confirm("¿Desasignar este equipo del punto de venta?")) {
                        unassign.mutate(a.id);
                      }
                    }}
                  >
                    <Unplug className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* History toggle */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <History className="w-3 h-3" />
            {showHistory ? "Ocultar historial" : "Ver historial de asignaciones"}
          </button>

          {showHistory && history.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Historial</span>
              {history.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between bg-muted/20 rounded px-3 py-2 opacity-60">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-mono">{a.devices?.fixno}</span>
                    <span className="text-xs text-muted-foreground">{a.devices?.customer_name || ""}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {new Date(a.assigned_at).toLocaleDateString("es-CL")} — {new Date(a.unassigned_at).toLocaleDateString("es-CL")}
                  </div>
                </div>
              ))}
            </div>
          )}
          {showHistory && history.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Sin historial previo</p>
          )}

          <AssignDeviceDialog open={assignOpen} onClose={() => setAssignOpen(false)} pointOfSaleId={pdv.id} tenantId={tenantId} />
        </div>
      )}
    </div>
  );
}

// ── Client Card ─────────────────────────────────────────

function ClientCard({ client, tenantId }: { client: any; tenantId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pdvDialogOpen, setPdvDialogOpen] = useState(false);
  const [editPdV, setEditPdV] = useState<any>(null);
  const deleteClient = useDeleteClient();
  const deletePdV = useDeletePointOfSale();
  const { data: pdvs = [] } = usePointsOfSale(expanded ? client.id : undefined);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <Building2 className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">{client.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => {
                if (confirm(`¿Eliminar cliente "${client.name}" y todos sus puntos de venta?`)) {
                  deleteClient.mutate(client.id);
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {(client.contact_name || client.contact_email) && (
          <p className="text-xs text-muted-foreground pl-12">
            {[client.contact_name, client.contact_email, client.contact_phone].filter(Boolean).join(" · ")}
          </p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Puntos de Venta</span>
            <Button variant="outline" size="sm" className="h-8" onClick={() => { setEditPdV(null); setPdvDialogOpen(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Agregar PdV
            </Button>
          </div>

          {pdvs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No hay puntos de venta</p>
          ) : (
            <div className="space-y-2">
              {pdvs.map((pdv) => (
                <PdVRow
                  key={pdv.id}
                  pdv={pdv}
                  tenantId={tenantId}
                  onEdit={() => { setEditPdV(pdv); setPdvDialogOpen(true); }}
                  onDelete={() => {
                    if (confirm(`¿Eliminar punto de venta "${pdv.name}"?`)) {
                      deletePdV.mutate(pdv.id);
                    }
                  }}
                />
              ))}
            </div>
          )}

          {pdvDialogOpen && (
            <PdVDialog
              open={pdvDialogOpen}
              onClose={() => { setPdvDialogOpen(false); setEditPdV(null); }}
              clientId={client.id}
              editPdV={editPdV}
            />
          )}
        </CardContent>
      )}

      {editOpen && (
        <ClientDialog open={editOpen} onClose={() => setEditOpen(false)} tenantId={tenantId} editClient={client} />
      )}
    </Card>
  );
}

// ── Main Page ───────────────────────────────────────────

export default function ClientsManager() {
  const navigate = useNavigate();
  const { data: tenant } = useDefaultTenant();
  const { data: clients = [], isLoading } = useClients(tenant?.id);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" /> Clientes y Puntos de Venta
              </h1>
              <p className="text-sm text-muted-foreground">Gestiona la estructura Cliente → Punto de Venta → Equipos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" /> Importar
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nuevo Cliente
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : clients.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Sin clientes</h2>
              <p className="text-sm text-muted-foreground mb-4">Creá tu primer cliente o importalos desde un archivo CSV/Excel.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" /> Importar
                </Button>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Crear primer cliente
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          clients.map((client) => (
            <ClientCard key={client.id} client={client} tenantId={tenant!.id} />
          ))
        )}
      </main>

      {createOpen && tenant && (
        <ClientDialog open={createOpen} onClose={() => setCreateOpen(false)} tenantId={tenant.id} />
      )}
      {importOpen && tenant && (
        <ImportClientsDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          tenantId={tenant.id}
          existingNames={clients.map((c) => c.name)}
        />
      )}
    </div>
  );
}
