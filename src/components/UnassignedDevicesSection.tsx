import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Cpu, Search, Plus, StickyNote, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  useUnassignedDevices,
  useUpdateDeviceCondition,
  DEVICE_CONDITION_LABELS,
  DEVICE_CONDITION_VALUES,
  type DeviceCondition,
} from "@/hooks/useClients";
import { isOnline } from "@/hooks/useDevices";

const conditionStyle: Record<DeviceCondition, string> = {
  nuevo: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  usado: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  roto: "bg-destructive/20 text-destructive border-destructive/40",
  en_reparacion: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  reparado: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  fuera_de_servicio: "bg-muted text-muted-foreground border-border",
};

interface Props {
  searchQuery?: string;
  onAssign: (deviceId: string) => void;
  defaultExpanded?: boolean;
}

function ConditionBadge({ device }: { device: any }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(device.condition_notes || "");
  const update = useUpdateDeviceCondition();
  const condition = device.condition as DeviceCondition | null;

  const handleSetCondition = async (value: string) => {
    try {
      await update.mutateAsync({
        deviceId: device.id,
        condition: value === "_none" ? null : (value as DeviceCondition),
      });
      toast.success("Estado actualizado");
    } catch (e: any) {
      toast.error(e.message || "Error");
    }
  };

  const saveNotes = async () => {
    try {
      await update.mutateAsync({
        deviceId: device.id,
        condition,
        notes: notes.trim() || null,
      });
      toast.success("Nota guardada");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Error");
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select value={condition || "_none"} onValueChange={handleSetCondition}>
        <SelectTrigger
          className={`h-6 px-2 py-0 text-xs w-auto min-w-[110px] gap-1 border ${
            condition ? conditionStyle[condition] : "bg-muted/30 text-muted-foreground border-dashed"
          }`}
        >
          <SelectValue placeholder="Sin estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">Sin estado</SelectItem>
          {DEVICE_CONDITION_VALUES.map((v) => (
            <SelectItem key={v} value={v}>{DEVICE_CONDITION_LABELS[v]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-6 w-6 ${device.condition_notes ? "text-amber-400" : "text-muted-foreground"}`}
            title={device.condition_notes || "Agregar nota"}
          >
            <StickyNote className="w-3.5 h-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-2">
            <Label className="text-xs">Notas del equipo</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones..."
              rows={4}
              maxLength={500}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={saveNotes}>Guardar</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function UnassignedDevicesSection({ searchQuery = "", onAssign, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [localSearch, setLocalSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState<string>("_all");
  const { data: devices = [], isLoading } = useUnassignedDevices();

  const effectiveSearch = (searchQuery || localSearch).toLowerCase().trim();

  const filtered = useMemo(() => {
    return devices.filter((d: any) => {
      if (conditionFilter !== "_all") {
        if (conditionFilter === "_none" && d.condition) return false;
        if (conditionFilter !== "_none" && d.condition !== conditionFilter) return false;
      }
      if (!effectiveSearch) return true;
      return (
        d.fixno?.toLowerCase().includes(effectiveSearch) ||
        d.branch_name?.toLowerCase().includes(effectiveSearch) ||
        d.customer_name?.toLowerCase().includes(effectiveSearch)
      );
    });
  }, [devices, effectiveSearch, conditionFilter]);

  // Auto-expand if global search matches something here
  const shouldShow = expanded || (searchQuery && filtered.length > 0);

  return (
    <div className="border border-border rounded-lg bg-card/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          {shouldShow ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <Cpu className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Equipos sin asignar</span>
          <Badge variant="secondary" className="text-xs">{devices.length}</Badge>
        </div>
      </button>

      {shouldShow && (
        <div className="px-4 pb-4 space-y-3">
          {!searchQuery && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Buscar equipo..."
                  className="pl-9 h-9"
                />
              </div>
              <Select value={conditionFilter} onValueChange={setConditionFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos los estados</SelectItem>
                  <SelectItem value="_none">Sin estado</SelectItem>
                  {DEVICE_CONDITION_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>{DEVICE_CONDITION_LABELS[v]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isLoading ? (
            <p className="text-xs text-muted-foreground">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              {devices.length === 0 ? "Todos los equipos están asignados." : "Sin resultados con esos filtros."}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {filtered.map((d: any) => {
                const online = isOnline(d);
                return (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 bg-muted/40 rounded px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {online ? (
                        <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <WifiOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-mono shrink-0">{d.fixno}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {d.branch_name || d.customer_name || "Sin nombre"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ConditionBadge device={d} />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => onAssign(d.id)}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Asignar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
