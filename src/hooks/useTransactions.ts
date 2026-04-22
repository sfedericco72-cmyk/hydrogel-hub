import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DeviceTransaction {
  id: string;
  fixno: string;
  bill_no: string;
  bill_date: string | null;
  transaction_type: string | null;
  quantity: number;
  balance_after: number | null;
  customer_name: string | null;
  branch_name: string | null;
  creator: string | null;
  remark: string | null;
  summary: string | null;
  audit_date: string | null;
  created_at: string;
}

export function useDeviceTransactions(fixno: string | undefined) {
  return useQuery({
    queryKey: ["device-transactions", fixno],
    queryFn: async () => {
      if (!fixno) return [];
      const { data, error } = await supabase
        .from("device_transactions")
        .select("*")
        .eq("fixno", fixno)
        .order("audit_date", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return (data ?? []) as DeviceTransaction[];
    },
    enabled: !!fixno,
  });
}
