/** Returns the last N months as YYYY-MM strings, oldest first. */
export function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

/** Sum of cuts in the last 6 months for a single device's monthly map. */
export function sumLast6Months(deviceMonthlyCuts: Map<string, number> | undefined): number {
  if (!deviceMonthlyCuts) return 0;
  const months = getLastNMonths(6);
  let total = 0;
  for (const m of months) total += deviceMonthlyCuts.get(m) ?? 0;
  return total;
}

const MONTH_LABELS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function shortMonthLabel(yyyymm: string): string {
  const [, m] = yyyymm.split("-");
  return MONTH_LABELS_ES[parseInt(m, 10) - 1] ?? yyyymm;
}
