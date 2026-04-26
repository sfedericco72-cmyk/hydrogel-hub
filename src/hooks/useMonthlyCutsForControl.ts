import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenantId } from "@/hooks/useUserTenantId";
import type { SystemRow } from "@/lib/cutsControl";

/**
 * Trae los totales mensuales por equipo (device_cuts_monthly) para un período
 * dado y enriquece con branch_name desde devices para mejor display.
 * RLS ya filtra por tenant_id.
 */
export function useMonthlyCutsForControl(period: string | null) {
  const { data: tenantId } = useUserTenantId();

  return useQuery({
    queryKey: ["monthly-cuts-control", tenantId, period],
    enabled: !!tenantId && !!period,
    queryFn: async (): Promise<SystemRow[]> => {
      if (!period) return [];

      const { data: monthly, error } = await supabase
        .from("device_cuts_monthly")
        .select("fixno, total_cuts")
        .eq("year_month", period);
      if (error) throw error;

      const fixnos = (monthly ?? []).map((m) => m.fixno);
      let nameMap = new Map<string, string | null>();
      if (fixnos.length > 0) {
        const { data: devs, error: devErr } = await supabase
          .from("devices")
          .select("fixno, branch_name")
          .in("fixno", fixnos);
        if (devErr) throw devErr;
        nameMap = new Map((devs ?? []).map((d) => [d.fixno, d.branch_name ?? null]));
      }

      return (monthly ?? []).map((m) => ({
        fixno: m.fixno,
        totalCuts: m.total_cuts ?? 0,
        branchName: nameMap.get(m.fixno) ?? null,
      }));
    },
    staleTime: 30 * 1000,
  });
}