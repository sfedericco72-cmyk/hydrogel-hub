import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  fixno?: string;
  pdvName?: string;
  isPending?: boolean;
}

export function UnassignDialog({ open, onClose, onConfirm, fixno, pdvName, isPending }: Props) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason.trim());
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desasignar equipo</DialogTitle>
          <DialogDescription>
            {fixno && <>Equipo <span className="font-mono font-semibold">{fixno}</span></>}
            {pdvName && <> de <span className="font-semibold">{pdvName}</span></>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Motivo (opcional)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: equipo roto, cambio de cliente, devolución..."
            rows={3}
            maxLength={500}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            Desasignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
