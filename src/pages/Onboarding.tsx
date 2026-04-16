import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Key, CheckCircle2, ArrowRight, ArrowLeft, Loader2, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STEPS = [
  { icon: Building2, label: "Empresa" },
  { icon: Key, label: "Credenciales CutABC" },
  { icon: CheckCircle2, label: "Validar conexión" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string; deviceCount?: number } | null>(null);

  const [form, setForm] = useState({
    company_name: "",
    bcc_email: "",
    cutabc_company_no: "",
    cutabc_username: "",
    cutabc_password: "",
  });

  function handleChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field.startsWith("cutabc_")) setValidationResult(null);
  }

  async function handleValidate() {
    setValidating(true);
    setValidationResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("validate-cutabc-credentials", {
        body: {
          companyNo: form.cutabc_company_no,
          username: form.cutabc_username,
          password: form.cutabc_password,
        },
      });

      if (error) throw error;
      setValidationResult(data);
    } catch (e: any) {
      setValidationResult({ valid: false, error: e.message });
    } finally {
      setValidating(false);
    }
  }

  async function handleFinish() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profile?.tenant_id) {
        // Existing tenant — just update settings
        const { error } = await supabase
          .from("tenant_settings")
          .update({
            company_name: form.company_name,
            bcc_email: form.bcc_email || null,
            cutabc_company_no: form.cutabc_company_no,
            cutabc_username: form.cutabc_username,
            cutabc_password: form.cutabc_password,
          })
          .eq("tenant_id", profile.tenant_id);
        if (error) throw error;
      } else {
        // New user — create tenant + settings + role atomically
        const { error } = await supabase.rpc("setup_new_tenant", {
          _company_name: form.company_name,
          _bcc_email: form.bcc_email || null,
          _cutabc_company_no: form.cutabc_company_no,
          _cutabc_username: form.cutabc_username,
          _cutabc_password: form.cutabc_password,
        });
        if (error) throw error;
      }

      toast.success("¡Configuración completa! Sincronizando dispositivos...");
      supabase.functions.invoke("sync-cutabc").catch(() => {});

      // Small delay to let ProtectedRoute re-check fresh data
      await new Promise(r => setTimeout(r, 500));
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error("Error al guardar: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  const canGoNext = step === 0
    ? form.company_name.trim().length > 0
    : step === 1
    ? form.cutabc_company_no.trim().length > 0 && form.cutabc_username.trim().length > 0 && form.cutabc_password.trim().length > 0
    : validationResult?.valid === true;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Stepper */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <div className={`h-px w-8 ${isDone ? "bg-primary" : "bg-border"}`} />}
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" :
                  isDone ? "bg-primary/20 text-primary" :
                  "bg-muted text-muted-foreground"
                }`}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-lg">
          {/* Step 0: Company */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">Datos de tu empresa</h2>
                <p className="mt-1 text-sm text-muted-foreground">Información básica para personalizar tu panel</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Nombre de empresa *</label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={e => handleChange("company_name", e.target.value)}
                    placeholder="Mi Empresa S.A."
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Email para copias de alertas (BCC)</label>
                  <input
                    type="email"
                    value={form.bcc_email}
                    onChange={e => handleChange("bcc_email", e.target.value)}
                    placeholder="alertas@empresa.com"
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Opcional. Recibirá copia de todas las alertas enviadas.</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: CutABC Credentials */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">Credenciales CutABC</h2>
                <p className="mt-1 text-sm text-muted-foreground">Conectá tu cuenta de CutABC para sincronizar dispositivos</p>
              </div>

              {/* Instructions callout */}
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-blue-300 mb-2">⚠️ Importante: Creá un usuario de solo lectura</p>
                    <p className="text-muted-foreground mb-2">
                      Por seguridad, recomendamos crear un usuario dedicado en CutABC con permisos de <strong className="text-foreground">solo consulta</strong>:
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                      <li>Ingresá a <strong className="text-foreground">www.cutabc.cn</strong> con tu cuenta administrador</li>
                      <li>Andá a <strong className="text-foreground">Sistema → Gestión de usuarios</strong></li>
                      <li>Creá un nuevo usuario (ej: <code className="rounded bg-muted px-1 text-foreground">monitor</code>)</li>
                      <li>Asigná <strong className="text-foreground">solo permisos de consulta</strong> (reportes, listado de máquinas)</li>
                      <li>Usá esas credenciales acá abajo</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Número de empresa (Company No) *</label>
                  <input
                    type="text"
                    value={form.cutabc_company_no}
                    onChange={e => handleChange("cutabc_company_no", e.target.value)}
                    placeholder="Ej: 12345"
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Usuario *</label>
                  <input
                    type="text"
                    value={form.cutabc_username}
                    onChange={e => handleChange("cutabc_username", e.target.value)}
                    placeholder="monitor"
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Contraseña *</label>
                  <input
                    type="password"
                    value={form.cutabc_password}
                    onChange={e => handleChange("cutabc_password", e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Validate */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">Validar conexión</h2>
                <p className="mt-1 text-sm text-muted-foreground">Probemos que las credenciales funcionan correctamente</p>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-1">
                <p><span className="text-muted-foreground">Empresa:</span> <strong>{form.company_name}</strong></p>
                <p><span className="text-muted-foreground">Company No:</span> <strong>{form.cutabc_company_no}</strong></p>
                <p><span className="text-muted-foreground">Usuario CutABC:</span> <strong>{form.cutabc_username}</strong></p>
              </div>

              {!validationResult && !validating && (
                <button
                  onClick={handleValidate}
                  className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Probar conexión
                </button>
              )}

              {validating && (
                <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Conectando a CutABC...</span>
                </div>
              )}

              {validationResult && !validating && (
                <div className={`rounded-lg border p-4 ${
                  validationResult.valid
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-red-500/30 bg-red-500/5"
                }`}>
                  {validationResult.valid ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-emerald-300">¡Conexión exitosa!</p>
                        {validationResult.deviceCount !== undefined && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Se encontraron <strong className="text-foreground">{validationResult.deviceCount}</strong> dispositivos en tu cuenta.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-300">Error de conexión</p>
                        <p className="text-sm text-muted-foreground mt-1">{validationResult.error}</p>
                        <button
                          onClick={() => setStep(1)}
                          className="mt-2 text-sm text-primary hover:underline"
                        >
                          ← Revisar credenciales
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:invisible transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Atrás
            </button>

            {step < 2 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canGoNext}
                className="flex items-center gap-1 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Siguiente <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={!canGoNext || saving}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Finalizar</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
