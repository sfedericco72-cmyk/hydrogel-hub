import { useEffect, useState } from "react";
import { Sparkles, X, Mail, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_PREFIX = "welcome-banner-dismissed-";
const CONTACT_EMAIL = "cutmonitor@bitec.cl";

interface WelcomeBannerProps {
  forceOpen?: boolean;
  onDismiss?: () => void;
}

export default function WelcomeBanner({ forceOpen, onDismiss }: WelcomeBannerProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const uid = user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        setDismissed(false);
        return;
      }
      const flag = localStorage.getItem(`${STORAGE_PREFIX}${uid}`);
      setDismissed(flag === "1");
    });
  }, []);

  const isOpen = forceOpen || !dismissed;
  if (!isOpen) return null;

  const handleDismiss = () => {
    if (userId) {
      localStorage.setItem(`${STORAGE_PREFIX}${userId}`, "1");
    }
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-semibold">Bienvenido a CutMonitor</h2>
            <Badge variant="secondary" className="bg-amber-500/15 text-amber-500 border-amber-500/30">
              BETA
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoreo en tiempo real de máquinas de corte de hidrogel conectadas a{" "}
            <span className="text-foreground font-medium">CutABC (cutabc.cn)</span>.
          </p>
        </div>
      </div>

      <ul className="space-y-1.5 text-sm text-muted-foreground mb-4 ml-1">
        <li className="flex gap-2"><span className="text-primary">•</span> Estado de conexión y stock de cada equipo, sincronizado automáticamente.</li>
        <li className="flex gap-2"><span className="text-primary">•</span> Alertas por email cuando un dispositivo se desconecta o baja el stock.</li>
        <li className="flex gap-2"><span className="text-primary">•</span> Attach rate: comparación entre equipos vendidos y consumibles consumidos.</li>
        <li className="flex gap-2"><span className="text-primary">•</span> Gestión de clientes, sucursales y asignación de dispositivos.</li>
      </ul>

      <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs sm:text-sm space-y-2 mb-4">
        <div className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Versión beta.</span>{" "}
            Pueden haber cambios o ajustes mientras seguimos mejorando la plataforma.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Mail className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Acceso por invitación.</span>{" "}
            Para autorizar nuevos usuarios, escribí a{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Solicitud%20de%20acceso%20a%20CutMonitor`}
              className="text-primary hover:underline font-medium"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            indicando empresa y email.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleDismiss} size="sm">
          Entendido
        </Button>
      </div>
    </Card>
  );
}
