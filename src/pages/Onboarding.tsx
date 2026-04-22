import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Key, CheckCircle2, ArrowRight, ArrowLeft, Loader2, AlertCircle, Info, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STEPS = [
  { icon: Building2, label: "Empresa" },
  { icon: Palette, label: "Marca" },
  { icon: Key, label: "Credenciales CutABC" },
  { icon: CheckCircle2, label: "Validar conexión" },
];

const TIMEZONES = [
  { value: "America/Santiago", label: "Santiago de Chile (GMT-3/-4)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (GMT-3)" },
  { value: "America/Lima", label: "Lima (GMT-5)" },
  { value: "America/Bogota", label: "Bogotá (GMT-5)" },
  { value: "America/Mexico_City", label: "Ciudad de México (GMT-6)" },
  { value: "America/Sao_Paulo", label: "São Paulo (GMT-3)" },
  { value: "America/Montevideo", label: "Montevideo (GMT-3)" },
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
    logo_url: "",
    brand_name: "",
    store_url: "",
    store_button_label: "Comprar insumos",
    support_email: "",
    timezone: "America/Santiago",
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
          _logo_url: form.logo_url || null,
          _brand_name: form.brand_name || form.company_name,
          _store_url: form.store_url || null,
          _store_button_label: form.store_button_label || null,
          _support_email: form.support_email || null,
          _timezone: form.timezone || "America/Santiago",
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
    ? true // marca: todo opcional
    : step === 2
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
                <p className="text-sm text-primary font-medium mb-1">¡Bienvenido a CutMonitor! 👋</p>
                <h2 className="text-xl font-bold">Datos de tu empresa</h2>
                <p className="mt-1 text-sm text-muted-foreground">Vamos a configurar tu cuenta en 3 pasos rápidos. Empecemos con la información básica.</p>
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

          {/* Step 1: Marca y comunicación */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">Marca y comunicación</h2>
                <p className="mt-1 text-sm text-muted-foreground">Personalizá los emails que reciben tus clientes finales. Todo es opcional — podés editarlo después.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">URL del logo</label>
                  <input
                    type="url"
                    value={form.logo_url}
                    onChange={e => handleChange("logo_url", e.target.value)}
                    placeholder="https://miempresa.com/logo.png"
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {form.logo_url && (
                    <div className="mt-2 rounded-lg border bg-white p-3 flex items-center justify-center">
                      <img src={form.logo_url} alt="Logo preview" className="h-10 max-w-[200px] object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">Si lo dejás vacío no se muestra logo en los emails.</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Nombre de marca para emails</label>
                  <input
                    type="text"
                    value={form.brand_name}
                    onChange={e => handleChange("brand_name", e.target.value)}
                    placeholder={form.company_name || "Mi Empresa"}
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Aparece como remitente y firma. Por defecto se usa el nombre de la empresa.</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">URL de tu tienda online</label>
                  <input
                    type="url"
                    value={form.store_url}
                    onChange={e => handleChange("store_url", e.target.value)}
                    placeholder="https://miempresa.com/tienda"
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Aparece como botón "Comprar" en alertas de stock bajo. Si lo dejás vacío, el botón no se muestra.</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Texto del botón</label>
                  <input
                    type="text"
                    value={form.store_button_label}
                    onChange={e => handleChange("store_button_label", e.target.value)}
                    placeholder="Comprar insumos"
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Email de soporte para tus clientes</label>
                  <input
                    type="email"
                    value={form.support_email}
                    onChange={e => handleChange("support_email", e.target.value)}
                    placeholder="soporte@miempresa.com"
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Aparece en el pie de los emails. Si lo dejás vacío, se sugiere "contacte a su ejecutivo comercial".</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Zona horaria</label>
                  <select
                    value={form.timezone}
                    onChange={e => handleChange("timezone", e.target.value)}
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {TIMEZONES.map(tz => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">Las alertas se disparan en esta hora local.</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: CutABC Credentials */}
          {step === 2 && (
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

          {/* Step 3: Validate */}
          {step === 3 && (
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
                          onClick={() => setStep(2)}
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

            {step < 3 ? (
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
