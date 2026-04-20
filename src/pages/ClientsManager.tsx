import { useState, useMemo, useEffect } from "react";
import { Building2, Plus, Pencil, Trash2, MapPin, ChevronDown, ChevronRight, Cpu, ArrowLeft, Unplug, Upload, History, Calendar, Search, BellOff, Bell, Users, UserX, Pause, AlertTriangle } from "lucide-react";
import { PdVAlertSettings } from "@/components/PdVAlertSettings";
import { GlobalAlertsPauseDialog } from "@/components/GlobalAlertsPauseDialog";
import { UnassignedDevicesSection } from "@/components/UnassignedDevicesSection";
import { UnassignDialog } from "@/components/UnassignDialog";
import { ExportClientsButton } from "@/components/ExportClientsButton";
import { AlertsStatusBadge } from "@/components/AlertsStatusBadge";
import { useTenantSettings } from "@/hooks/useTenantSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
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
  useClientAssignmentCounts,
  useAllPdvAlertSummaries,
  type PdvAlertSummary,
} from "@/hooks/useClients";
import { useUserTenantId } from "@/hooks/useUserTenantId";
import { ImportClientsDialog } from "@/components/ImportClientsDialog";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { useAssignmentCuts } from "@/hooks/useAssignmentCuts";

export type AlertFilter = "all" | "on" | "no_email" | "off";


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
  editClient?: { id: string; code: string | null; name: string; contact_name: string | null; contact_phone: string | null; contact_email: string | null; address: string | null; latitude: number | null; longitude: number | null } | null;
}) {
  const [code, setCode] = useState(editClient?.code || "");
  const [name, setName] = useState(editClient?.name || "");
  const [contactName, setContactName] = useState(editClient?.contact_name || "");
  const [contactPhone, setContactPhone] = useState(editClient?.contact_phone || "");
  const [contactEmail, setContactEmail] = useState(editClient?.contact_email || "");
  const [address, setAddress] = useState(editClient?.address || "");
  const [lat, setLat] = useState<number | null>(editClient?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(editClient?.longitude ?? null);
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
      const addrTrimmed = address.trim();
      let finalLat = lat;
      let finalLng = lng;
      if (!finalLat && !finalLng) {
        const coordMatch = addrTrimmed.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
        if (coordMatch) {
          finalLat = parseFloat(coordMatch[1]);
          finalLng = parseFloat(coordMatch[2]);
        }
      }

      if (isEdit) {
        await update.mutateAsync({
          id: editClient.id,
          code: code.trim() || null,
          name: trimmed,
          contact_name: contactName.trim() || null,
          contact_phone: contactPhone.trim() || null,
          contact_email: contactEmail.trim() || null,
          address: addrTrimmed || null,
          latitude: finalLat ?? editClient.latitude,
          longitude: finalLng ?? editClient.longitude,
        });
        toast.success("Cliente actualizado");
      } else {
        await create.mutateAsync({
          tenant_id: tenantId,
          code: code.trim() || null,
          name: trimmed,
          contact_name: contactName.trim() || null,
          contact_phone: contactPhone.trim() || null,
          contact_email: contactEmail.trim() || null,
          address: addrTrimmed || null,
          latitude: finalLat,
          longitude: finalLng,
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
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Código</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej: CLI-001" maxLength={30} />
            </div>
            <div className="col-span-2">
              <Label>Nombre *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del cliente" maxLength={100} />
            </div>
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
          <div>
            <Label>Domicilio</Label>
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              onSelect={(result) => {
                setAddress(result.address);
                setLat(result.latitude);
                setLng(result.longitude);
              }}
            />
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
  tenantId,
  editPdV,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  tenantId: string;
  editPdV?: { id: string; name: string; address: string | null; city: string | null } | null;
}) {
  const [name, setName] = useState(editPdV?.name || "");
  const [address, setAddress] = useState(editPdV?.address || "");

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
        await update.mutateAsync({ id: editPdV.id, name: trimmed, address: address.trim() || null });
        toast.success("Punto de venta actualizado");
      } else {
        await create.mutateAsync({ client_id: clientId, tenant_id: tenantId, name: trimmed, address: address.trim() || null });
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
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              onSelect={(result) => {
                setAddress(result.address);
              }}
            />
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
  preselectedDeviceId,
}: {
  open: boolean;
  onClose: () => void;
  pointOfSaleId: string;
  tenantId: string;
  preselectedDeviceId?: string;
}) {
  const [selectedDeviceId, setSelectedDeviceId] = useState(preselectedDeviceId || "");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [assignDate, setAssignDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { data: unassigned = [] } = useUnassignedDevices();
  const assign = useAssignDevice();

  useEffect(() => {
    if (preselectedDeviceId) setSelectedDeviceId(preselectedDeviceId);
  }, [preselectedDeviceId]);

  const filtered = unassigned.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.fixno?.toLowerCase().includes(q) ||
      d.customer_name?.toLowerCase().includes(q) ||
      d.branch_name?.toLowerCase().includes(q)
    );
  });

  const handleAssign = async () => {
    if (!selectedDeviceId) {
      toast.error("Selecciona un equipo");
      return;
    }
    try {
      const assignedAt = new Date(assignDate + "T00:00:00").toISOString();
      await assign.mutateAsync({
        device_id: selectedDeviceId,
        point_of_sale_id: pointOfSaleId,
        tenant_id: tenantId,
        assigned_at: assignedAt,
        assignment_reason: reason.trim() || null,
      });
      toast.success("Equipo asignado");
      setSelectedDeviceId("");
      setSearch("");
      setReason("");
      setAssignDate(new Date().toISOString().slice(0, 10));
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
        <div className="space-y-3">
          {unassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay equipos disponibles para asignar.</p>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedDeviceId(""); }}
                  placeholder="Buscar por ID o nombre del equipo..."
                  className="pl-9"
                  autoFocus
                />
              </div>
              <div className="max-h-60 overflow-y-auto rounded-md border border-border">
                {filtered.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground text-center">Sin resultados</p>
                ) : (
                  filtered.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent ${selectedDeviceId === d.id ? "bg-accent text-accent-foreground" : ""}`}
                      onClick={() => setSelectedDeviceId(d.id)}
                    >
                      <Cpu className="w-3.5 h-3.5 shrink-0 text-primary" />
                      <span className="font-mono">{d.fixno}</span>
                      <span className="text-muted-foreground truncate">— {d.branch_name || d.customer_name || "Sin nombre"}</span>
                    </button>
                  ))
                )}
              </div>
              <div>
                <Label>Fecha de inicio de asignación</Label>
                <Input
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
                <p className="text-xs text-muted-foreground mt-1">Los cortes desde esta fecha se contabilizarán para este PdV</p>
              </div>
              <div>
                <Label>Motivo (opcional)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: nuevo equipo, reemplazo, traslado..."
                  rows={2}
                  maxLength={500}
                />
              </div>
            </>
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

// ── Assignment Row with Cuts ─────────────────────────────

function AssignmentRow({
  assignment,
  onUnassign,
  highlight,
}: {
  assignment: any;
  onUnassign: () => void;
  highlight?: boolean;
}) {
  const fixno = assignment.devices?.fixno;
  const { data: cuts } = useAssignmentCuts(fixno, assignment.assigned_at, assignment.unassigned_at);

  return (
    <div className={`flex items-center justify-between rounded px-3 py-2 ${highlight ? "bg-primary/15 ring-1 ring-primary/40" : "bg-muted/50"}`}>
      <div className="flex items-center gap-2">
        <Cpu className="w-3.5 h-3.5 text-primary" />
        <span className="text-sm font-mono">{fixno}</span>
        <span className="text-xs text-muted-foreground">{assignment.devices?.customer_name || ""}</span>
      </div>
      <div className="flex items-center gap-2">
        {cuts != null && (
          <span className="text-xs text-muted-foreground font-mono">{cuts.toLocaleString()} cortes</span>
        )}
        <span className="text-xs text-muted-foreground">
          {new Date(assignment.assigned_at).toLocaleDateString("es-CL")}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive"
          onClick={onUnassign}
        >
          <Unplug className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── PdV Row with Assignments ────────────────────────────

function PdVRow({
  pdv,
  tenantId,
  onEdit,
  onDelete,
  forceExpanded,
  searchQuery,
  globallyPaused,
}: {
  pdv: { id: string; name: string; address: string | null; city: string | null; alerts_enabled?: boolean; alert_email?: string | null };
  tenantId: string;
  onEdit: () => void;
  onDelete: () => void;
  forceExpanded?: boolean;
  searchQuery?: string;
  globallyPaused?: boolean;
}) {
  const [expandedState, setExpanded] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<any>(null);
  const expanded = forceExpanded || expandedState;
  const { data: assignments = [] } = useDeviceAssignments(expanded ? pdv.id : undefined);
  const { data: history = [] } = useDeviceAssignmentHistory(expanded && showHistory ? pdv.id : undefined);
  const unassign = useUnassignDevice();

  const q = searchQuery?.toLowerCase().trim() || "";

  return (
    <div className="border border-border rounded-lg bg-secondary/30">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => !forceExpanded && setExpanded(!expanded)}>
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{pdv.name}</span>
            {pdv.city && <span className="text-xs text-muted-foreground">{pdv.city}</span>}
            <AlertsStatusBadge
              mode="individual"
              alertsEnabled={pdv.alerts_enabled ?? true}
              alertEmail={pdv.alert_email ?? null}
              globallyPaused={globallyPaused}
            />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {pdv.address && <p className="text-xs text-muted-foreground">{pdv.address}</p>}

          <PdVAlertSettings
            pdv={pdv as any}
            fixnos={assignments.map((a: any) => a.devices?.fixno).filter(Boolean)}
          />

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
              {assignments.map((a: any) => {
                const matches = !!q && (
                  a.devices?.fixno?.toLowerCase().includes(q) ||
                  a.devices?.customer_name?.toLowerCase().includes(q)
                );
                return (
                  <AssignmentRow
                    key={a.id}
                    assignment={a}
                    highlight={matches}
                    onUnassign={() => setUnassignTarget(a)}
                  />
                );
              })}
            </div>
          )}

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
                <div key={a.id} className="bg-muted/20 rounded px-3 py-2 opacity-80">
                  <div className="flex items-center justify-between">
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
                  {(a.assignment_reason || a.unassignment_reason) && (
                    <div className="mt-1 pl-5 space-y-0.5">
                      {a.assignment_reason && (
                        <p className="text-xs text-muted-foreground"><span className="text-foreground/70">Asignación:</span> {a.assignment_reason}</p>
                      )}
                      {a.unassignment_reason && (
                        <p className="text-xs text-muted-foreground"><span className="text-foreground/70">Desasignación:</span> {a.unassignment_reason}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {showHistory && history.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Sin historial previo</p>
          )}

          <AssignDeviceDialog open={assignOpen} onClose={() => setAssignOpen(false)} pointOfSaleId={pdv.id} tenantId={tenantId} />
          <UnassignDialog
            open={!!unassignTarget}
            onClose={() => setUnassignTarget(null)}
            fixno={unassignTarget?.devices?.fixno}
            pdvName={pdv.name}
            isPending={unassign.isPending}
            onConfirm={async (reason) => {
              try {
                await unassign.mutateAsync({ assignmentId: unassignTarget.id, reason });
                toast.success("Equipo desasignado");
                setUnassignTarget(null);
              } catch (e: any) {
                toast.error(e.message || "Error al desasignar");
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Client Card ─────────────────────────────────────────

function ClientCard({
  client,
  tenantId,
  forceExpanded,
  searchQuery,
  matchedPdvIds,
}: {
  client: any;
  tenantId: string;
  forceExpanded?: boolean;
  searchQuery?: string;
  matchedPdvIds?: Set<string>;
}) {
  const [expandedState, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pdvDialogOpen, setPdvDialogOpen] = useState(false);
  const [editPdV, setEditPdV] = useState<any>(null);
  const deleteClient = useDeleteClient();
  const deletePdV = useDeletePointOfSale();
  const expanded = forceExpanded || expandedState;
  const { data: pdvs = [] } = usePointsOfSale(expanded ? client.id : undefined);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => !forceExpanded && setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <Building2 className="w-5 h-5 text-primary" />
            <div className="flex items-center gap-2">
              {client.code && <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{client.code}</span>}
              <CardTitle className="text-base">{client.name}</CardTitle>
            </div>
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
        {(client.contact_name || client.contact_email || client.address) && (
          <div className="pl-12 space-y-0.5">
            {(client.contact_name || client.contact_email) && (
              <p className="text-xs text-muted-foreground">
                {[client.contact_name, client.contact_email, client.contact_phone].filter(Boolean).join(" · ")}
              </p>
            )}
            {client.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {client.address}
              </p>
            )}
          </div>
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
                  forceExpanded={matchedPdvIds?.has(pdv.id)}
                  searchQuery={searchQuery}
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
              tenantId={tenantId}
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

// ── Group Section ───────────────────────────────────────

function ClientGroup({
  title,
  icon: Icon,
  clients,
  tenantId,
  defaultOpen,
  searchQuery,
  matchedPdvByClient,
  forceExpandClients,
}: {
  title: string;
  icon: any;
  clients: any[];
  tenantId: string;
  defaultOpen: boolean;
  searchQuery: string;
  matchedPdvByClient: Map<string, Set<string>>;
  forceExpandClients: Set<string>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (clients.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Icon className="w-4 h-4" />
        <span className="uppercase tracking-wide">{title}</span>
        <Badge variant="secondary" className="ml-1 text-xs">{clients.length}</Badge>
      </button>
      {open && (
        <div className="space-y-3 pl-1">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              tenantId={tenantId}
              forceExpanded={forceExpandClients.has(client.id)}
              searchQuery={searchQuery}
              matchedPdvIds={matchedPdvByClient.get(client.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────

export default function ClientsManager() {
  const navigate = useNavigate();
  const { data: tenantId } = useUserTenantId();
  const { data: clients = [], isLoading } = useClients();
  const { data: settings } = useTenantSettings();
  const { data: assignmentCounts } = useClientAssignmentCounts();
  const { data: unassignedDevices = [] } = useUnassignedDevices();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [assignFromUnassigned, setAssignFromUnassigned] = useState<{ deviceId: string } | null>(null);
  const [pickPdvOpen, setPickPdvOpen] = useState(false);

  const isPaused = settings?.alerts_paused_until
    ? new Date(settings.alerts_paused_until).getTime() > Date.now()
    : false;

  // Search-driven expansion data: which PdV / clients to auto-expand
  const [searchMatches, setSearchMatches] = useState<{
    matchedPdvByClient: Map<string, Set<string>>;
    forceExpandClients: Set<string>;
  }>({ matchedPdvByClient: new Map(), forceExpandClients: new Set() });

  // When user searches, fetch PdV+devices to find matches across hierarchy
  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      setSearchMatches({ matchedPdvByClient: new Map(), forceExpandClients: new Set() });
      return;
    }
    let cancelled = false;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const [posRes, assignRes] = await Promise.all([
        supabase.from("points_of_sale").select("id, client_id, name, address"),
        supabase
          .from("device_assignments")
          .select("point_of_sale_id, devices(fixno, customer_name, branch_name)")
          .is("unassigned_at", null),
      ]);
      if (cancelled) return;
      const pos = posRes.data || [];
      const assigns = assignRes.data || [];

      const matchedPdv = new Set<string>();
      pos.forEach((p: any) => {
        if (
          p.name?.toLowerCase().includes(q) ||
          p.address?.toLowerCase().includes(q)
        ) {
          matchedPdv.add(p.id);
        }
      });
      assigns.forEach((a: any) => {
        const d = a.devices;
        if (
          d?.fixno?.toLowerCase().includes(q) ||
          d?.customer_name?.toLowerCase().includes(q) ||
          d?.branch_name?.toLowerCase().includes(q)
        ) {
          matchedPdv.add(a.point_of_sale_id);
        }
      });

      const matchedPdvByClient = new Map<string, Set<string>>();
      const forceExpandClients = new Set<string>();
      pos.forEach((p: any) => {
        if (matchedPdv.has(p.id)) {
          if (!matchedPdvByClient.has(p.client_id)) matchedPdvByClient.set(p.client_id, new Set());
          matchedPdvByClient.get(p.client_id)!.add(p.id);
          forceExpandClients.add(p.client_id);
        }
      });

      // Also expand clients whose own name/code/contact matches
      clients.forEach((c) => {
        if (
          c.name?.toLowerCase().includes(q) ||
          c.code?.toLowerCase().includes(q) ||
          c.contact_name?.toLowerCase().includes(q) ||
          c.contact_email?.toLowerCase().includes(q)
        ) {
          forceExpandClients.add(c.id);
        }
      });

      setSearchMatches({ matchedPdvByClient, forceExpandClients });
    })();
    return () => { cancelled = true; };
  }, [searchQuery, clients]);

  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter((c) => {
      const directHit =
        c.name?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q) ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.contact_email?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q);
      const childHit = searchMatches.forceExpandClients.has(c.id);
      return directHit || childHit;
    });
  }, [clients, searchQuery, searchMatches]);

  const { withDevices, withoutDevices } = useMemo(() => {
    const counts = assignmentCounts || new Map();
    const withDevices: any[] = [];
    const withoutDevices: any[] = [];
    filteredClients.forEach((c) => {
      if ((counts.get(c.id) ?? 0) > 0) withDevices.push(c);
      else withoutDevices.push(c);
    });
    return { withDevices, withoutDevices };
  }, [filteredClients, assignmentCounts]);

  // Handle "Asignar" from UnassignedDevicesSection: open PdV picker
  const handleAssignFromUnassigned = (deviceId: string) => {
    setAssignFromUnassigned({ deviceId });
    setPickPdvOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
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
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={isPaused ? "secondary" : "outline"}
              onClick={() => setPauseOpen(true)}
              className={isPaused ? "border-yellow-600/40 text-yellow-400" : ""}
              title={isPaused ? `Pausadas hasta ${new Date(settings!.alerts_paused_until!).toLocaleDateString("es-CL")}` : "Pausar alertas globalmente"}
            >
              {isPaused ? <BellOff className="w-4 h-4 mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
              {isPaused ? "Alertas pausadas" : "Pausa alertas"}
            </Button>
            <ExportClientsButton />
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" /> Importar
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nuevo Cliente
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {/* Global search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar cliente, punto de venta o equipo (fixno, sucursal)..."
            className="pl-9 h-10"
          />
        </div>

        {/* Unassigned devices section */}
        {tenantId && (
          <UnassignedDevicesSection
            searchQuery={searchQuery}
            onAssign={handleAssignFromUnassigned}
            defaultExpanded={unassignedDevices.length > 0 && unassignedDevices.length <= 5}
          />
        )}

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
        ) : filteredClients.length === 0 ? (
          <p className="text-sm text-muted-foreground italic px-2">Sin resultados para “{searchQuery}”</p>
        ) : (
          <>
            <ClientGroup
              title="Con equipos asignados"
              icon={Users}
              clients={withDevices}
              tenantId={tenantId!}
              defaultOpen={true}
              searchQuery={searchQuery}
              matchedPdvByClient={searchMatches.matchedPdvByClient}
              forceExpandClients={searchMatches.forceExpandClients}
            />
            <ClientGroup
              title="Sin equipos asignados"
              icon={UserX}
              clients={withoutDevices}
              tenantId={tenantId!}
              defaultOpen={!!searchQuery}
              searchQuery={searchQuery}
              matchedPdvByClient={searchMatches.matchedPdvByClient}
              forceExpandClients={searchMatches.forceExpandClients}
            />
          </>
        )}
      </main>

      {createOpen && tenantId && (
        <ClientDialog open={createOpen} onClose={() => setCreateOpen(false)} tenantId={tenantId} />
      )}
      {importOpen && tenantId && (
        <ImportClientsDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          tenantId={tenantId}
          existingNames={clients.map((c) => c.name)}
        />
      )}
      {pauseOpen && (
        <GlobalAlertsPauseDialog open={pauseOpen} onClose={() => setPauseOpen(false)} />
      )}
      {pickPdvOpen && tenantId && assignFromUnassigned && (
        <PickPdvDialog
          deviceId={assignFromUnassigned.deviceId}
          tenantId={tenantId}
          onClose={() => { setPickPdvOpen(false); setAssignFromUnassigned(null); }}
        />
      )}
    </div>
  );
}

// ── Pick PdV Dialog (for unassigned-section "Asignar" button) ──

function PickPdvDialog({
  deviceId,
  tenantId,
  onClose,
}: {
  deviceId: string;
  tenantId: string;
  onClose: () => void;
}) {
  const { data: clients = [] } = useClients();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedPdvId, setSelectedPdvId] = useState("");
  const [showAssign, setShowAssign] = useState(false);
  const { data: pdvs = [] } = usePointsOfSale(selectedClientId || undefined);

  if (showAssign && selectedPdvId) {
    return (
      <AssignDeviceDialog
        open={true}
        onClose={onClose}
        pointOfSaleId={selectedPdvId}
        tenantId={tenantId}
        preselectedDeviceId={deviceId}
      />
    );
  }

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Elegir Punto de Venta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Cliente</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedClientId}
              onChange={(e) => { setSelectedClientId(e.target.value); setSelectedPdvId(""); }}
            >
              <option value="">Seleccionar cliente...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {selectedClientId && (
            <div>
              <Label>Punto de Venta</Label>
              {pdvs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic mt-1">Este cliente no tiene PdV. Creá uno primero.</p>
              ) : (
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedPdvId}
                  onChange={(e) => setSelectedPdvId(e.target.value)}
                >
                  <option value="">Seleccionar PdV...</option>
                  {pdvs.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => setShowAssign(true)} disabled={!selectedPdvId}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
