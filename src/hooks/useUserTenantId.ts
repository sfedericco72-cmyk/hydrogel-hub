import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the current user's tenant_id from their profile.
 * This is the single source of truth for tenant scoping in the frontend.
 */
export function useUserTenantId() {
  return useQuery({
    queryKey: ["user-tenant-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data?.tenant_id as string | null;
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}
