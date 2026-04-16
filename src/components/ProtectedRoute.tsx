import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [emailAllowed, setEmailAllowed] = useState<boolean | undefined>(undefined);
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

  // Whitelist gate: every authenticated session must have an allowed email
  useEffect(() => {
    if (!session) {
      setEmailAllowed(undefined);
      return;
    }

    const userEmail = session.user.email;
    if (!userEmail) {
      // No email on the session → block
      supabase.auth.signOut().finally(() => {
        window.location.replace("/auth?denied=1");
      });
      return;
    }

    let cancelled = false;
    setEmailAllowed(undefined);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-email-allowed", {
          body: { email: userEmail, markUsed: true },
        });
        if (cancelled) return;
        if (error) {
          console.error("check-email-allowed error:", error);
          // Fail closed: block if we can't validate
          setEmailAllowed(false);
          await supabase.auth.signOut();
          window.location.replace("/auth?denied=1");
          return;
        }
        const allowed = !!(data as any)?.allowed;
        setEmailAllowed(allowed);
        if (!allowed) {
          await supabase.auth.signOut();
          window.location.replace("/auth?denied=1");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("check-email-allowed exception:", err);
        setEmailAllowed(false);
        await supabase.auth.signOut();
        window.location.replace("/auth?denied=1");
      }
    })();

    return () => { cancelled = true; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session || emailAllowed !== true) {
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
  }, [session, emailAllowed, location.pathname]);

  // Still loading
  if (
    session === undefined ||
    (session && emailAllowed === undefined) ||
    (session && emailAllowed === true && onboardingDone === undefined)
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // Email not in whitelist → already signed out + redirected, just render loader
  if (emailAllowed === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
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
