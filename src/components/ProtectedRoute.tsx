import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [onboardingDone, setOnboardingDone] = useState<boolean | undefined>(undefined);
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setOnboardingDone(undefined);
      return;
    }

    // Always re-check when path changes
    setOnboardingDone(undefined);

    let cancelled = false;

    async function check() {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", session!.user.id)
          .single();

        if (cancelled) return;

        if (!profile?.tenant_id) {
          setOnboardingDone(false);
          return;
        }

        const { data: settings } = await supabase
          .from("tenant_settings")
          .select("cutabc_company_no, cutabc_username, cutabc_password")
          .eq("tenant_id", profile.tenant_id)
          .single();

        if (cancelled) return;

        const done = !!(settings?.cutabc_company_no && settings?.cutabc_username && settings?.cutabc_password);
        setOnboardingDone(done);
      } catch {
        if (!cancelled) setOnboardingDone(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [session, location.pathname]);

  // Still loading
  if (session === undefined || (session && onboardingDone === undefined)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  const isOnboardingPage = location.pathname === "/onboarding";

  // Onboarding complete but user is on /onboarding → send to dashboard
  if (onboardingDone && isOnboardingPage) {
    return <Navigate to="/" replace />;
  }

  // Onboarding NOT complete and NOT on /onboarding → send to onboarding
  if (!onboardingDone && !isOnboardingPage) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
