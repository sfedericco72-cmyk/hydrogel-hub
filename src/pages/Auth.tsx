import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CONTACT_EMAIL = "cutmonitor@bitec.cl";

async function checkEmailAllowed(email: string, markUsed = false): Promise<{ allowed: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("check-email-allowed", {
      body: { email, markUsed },
    });
    if (error) {
      console.error("check-email-allowed invoke error:", error);
      return { allowed: false, error: "lookup_failed" };
    }
    return data as { allowed: boolean; error?: string };
  } catch (err) {
    console.error("check-email-allowed exception:", err);
    return { allowed: false, error: "lookup_failed" };
  }
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  // Show "denied" message when redirected from a blocked OAuth login
  useEffect(() => {
    if (searchParams.get("denied") === "1") {
      toast({
        title: "Acceso no autorizado",
        description: `Tu email no está habilitado para registrarse. Solicitá acceso escribiendo a ${CONTACT_EMAIL}.`,
        variant: "destructive",
        duration: 10000,
      });
      // Clear flag from URL
      const next = new URLSearchParams(searchParams);
      next.delete("denied");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        // Whitelist check BEFORE creating the account
        const check = await checkEmailAllowed(email);
        if (!check.allowed) {
          toast({
            title: "Email no autorizado",
            description: `Tu email no está habilitado para registrarse en CutMonitor. Solicitá acceso escribiendo a ${CONTACT_EMAIL} indicando tu empresa y email.`,
            variant: "destructive",
            duration: 10000,
          });
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        // Mark the email as used (best-effort, no need to await UX)
        checkEmailAllowed(email, true).catch(() => {});

        toast({
          title: "¡Cuenta creada!",
          description: `Te enviamos un email a ${email} para confirmar tu cuenta. Una vez confirmado, podrás iniciar sesión y configurar tu empresa.`,
          duration: 8000,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast({
          title: "Error",
          description: result.error.message,
          variant: "destructive",
        });
      }
      if (result.redirected) return;
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Ingresa tu email primero", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: "Correo enviado",
        description: "Revisa tu bandeja para restablecer tu contraseña.",
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8 gap-6">
      <div className="w-full max-w-md space-y-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">CutMonitor</h1>
          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
            BETA
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Monitoreo en tiempo real de máquinas de corte de hidrogel conectadas a CutABC.
        </p>
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 justify-center">
          <Mail className="h-3.5 w-3.5" />
          Acceso por invitación · Solicitá autorización a{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Solicitud%20de%20acceso%20a%20CutMonitor`}
            className="text-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isLogin ? "Iniciar sesión" : "Crear cuenta"}
          </CardTitle>
          <CardDescription>
            {isLogin ? "Ingresá tus credenciales para continuar" : "Completá los datos para registrarte"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continuar con Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">o</span>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre"
                  required={!isLogin}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@empresa.com"
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-9"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Cargando..." : isLogin ? "Iniciar sesión" : "Crear cuenta"}
            </Button>
          </form>

          {isLogin && (
            <button
              onClick={handleForgotPassword}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}

          <div className="text-center text-sm">
            <span className="text-muted-foreground">
              {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
            </span>
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? "Regístrate" : "Inicia sesión"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
