import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      })
      .catch(() => setStatus("error"));
  }, [token]);

  async function handleUnsubscribe() {
    if (!token) return;
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (data?.success) {
        setStatus("success");
      } else if (data?.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
        {status === "loading" && (
          <p className="text-muted-foreground">Verificando...</p>
        )}

        {status === "valid" && (
          <>
            <h1 className="mb-3 text-xl font-bold">Cancelar suscripción</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              ¿Desea dejar de recibir alertas por email? Puede volver a activarlas contactando a su ejecutivo comercial.
            </p>
            <button
              onClick={handleUnsubscribe}
              disabled={processing}
              className="rounded-lg bg-destructive px-6 py-2.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              {processing ? "Procesando..." : "Confirmar cancelación"}
            </button>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="mb-3 text-xl font-bold">Suscripción cancelada</h1>
            <p className="text-sm text-muted-foreground">
              No recibirá más alertas por email. Si desea reactivarlas, contacte a su ejecutivo comercial.
            </p>
          </>
        )}

        {status === "already" && (
          <>
            <h1 className="mb-3 text-xl font-bold">Ya cancelado</h1>
            <p className="text-sm text-muted-foreground">
              Esta suscripción ya fue cancelada anteriormente.
            </p>
          </>
        )}

        {status === "invalid" && (
          <>
            <h1 className="mb-3 text-xl font-bold">Enlace inválido</h1>
            <p className="text-sm text-muted-foreground">
              El enlace de cancelación no es válido o ha expirado.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="mb-3 text-xl font-bold">Error</h1>
            <p className="text-sm text-muted-foreground">
              Ocurrió un error al procesar la solicitud. Intente nuevamente más tarde.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
