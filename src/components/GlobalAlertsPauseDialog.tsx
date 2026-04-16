import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { useTenantSettings, useUpdateTenantSettings } from "@/hooks/useTenantSettings";

export function GlobalAlertsPauseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: settings } = useTenantSettings();
  const update = useUpdateTenantSettings();
  const pausedUntil = settings?.alerts_paused_until ?? null;
  const isPaused = pausedUntil ? new Date(pausedUntil).getTime() > Date.now() : false;

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [date, setDate] = useState<string>(
    pausedUntil ? new Date(pausedUntil).toISOString().slice(0, 10) : tomorrow
  );

  async function pause() {
    try {
      await update.mutateAsync({ alerts_paused_until: new Date(date + "T23:59:59").toISOString() });
      toast.success(`Alertas pausadas hasta ${new Date(date).toLocaleDateString("es-CL")}`);
      onClose();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  }

  async function resume() {
    try {
      await update.mutateAsync({ alerts_paused_until: null });
      toast.success("Alertas reactivadas");
      onClose();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPaused ? <BellOff className="h-5 w-5 text-yellow-400" /> : <Bell className="h-5 w-5 text-primary" />}
            Pausa global de alertas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {isPaused ? (
            <p className="text-sm text-muted-foreground">
              Las alertas están pausadas hasta el{" "}
              <span className="font-medium text-foreground">
                {new Date(pausedUntil!).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })}
              </span>
              . Ningún PdV recibirá emails durante este período.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pausá temporalmente todas las alertas (todos los PdV). Útil para feriados, mantenimientos o
              vacaciones. Se reactivan automáticamente al pasar la fecha.
            </p>
          )}

          <div>
            <Label className="text-xs">Pausar hasta (inclusive)</Label>
            <Input
              type="date"
              value={date}
              min={tomorrow}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isPaused && (
            <Button variant="outline" onClick={resume} disabled={update.isPending}>
              Reactivar ahora
            </Button>
          )}
          <Button onClick={pause} disabled={update.isPending}>
            {isPaused ? "Actualizar fecha" : "Pausar alertas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
