import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | undefined>(undefined);
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

  // Check if tenant needs onboarding (no CutABC credentials)
  useEffect(() => {
    if (!session) {
      setNeedsOnboarding(undefined);
      return;
    }

    async function checkOnboarding() {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", session!.user.id)
          .single();

        if (!profile?.tenant_id) {
          setNeedsOnboarding(true);
          return;
        }

        const { data: settings } = await supabase
          .from("tenant_settings")
          .select("cutabc_company_no, cutabc_username, cutabc_password")
          .eq("tenant_id", profile.tenant_id)
          .single();

        const hasCreds = !!(settings?.cutabc_company_no && settings?.cutabc_username && settings?.cutabc_password);
        setNeedsOnboarding(!hasCreds);
      } catch {
        setNeedsOnboarding(false);
      }
    }

    checkOnboarding();
  }, [session]);

  if (session === undefined || (session && needsOnboarding === undefined)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect to onboarding if needed (but not if already on /onboarding)
  if (needsOnboarding && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
