import Papa from "papaparse";

export interface CutabcCsvRow {
  fixno: string;
  deviceName: string;
  customerName: string;
  usageCount: number;
}

export interface SystemRow {
  fixno: string;
  branchName: string | null;
  totalCuts: number;
}

export type RowStatus = "ok" | "minor" | "spike" | "missing_in_system" | "missing_in_csv";

export interface ComparisonRow {
  fixno: string;
  displayName: string;
  customerName: string | null;
  csvCount: number | null;
  systemCount: number | null;
  diff: number | null; // system - csv
  absDiff: number;
  status: RowStatus;
}

export interface ComparisonSummary {
  totalCsv: number;
  totalSystem: number;
  diff: number;
  accuracy: number; // 0-100
  okCount: number;
  minorCount: number;
  spikeCount: number;
  missingInSystem: number;
  missingInCsv: number;
  rows: ComparisonRow[];
}

export interface ParseResult {
  rows: CutabcCsvRow[];
  errors: string[];
}

/**
 * Parses a CutABC monthly export CSV.
 * Expected columns: "Device NO", "Device Name", "Customer Name", "Usage Count", "Remark".
 * Tolerant to BOM, quotes, extra whitespace.
 */
export function parseCutabcCsv(text: string): ParseResult {
  // Strip UTF-8 BOM if present
  const cleaned = text.replace(/^\uFEFF/, "");

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const errors: string[] = [];
  const rows: CutabcCsvRow[] = [];

  if (!result.meta.fields || result.meta.fields.length === 0) {
    return { rows: [], errors: ["El archivo está vacío o no es un CSV válido."] };
  }

  const fields = result.meta.fields.map((f) => f.toLowerCase());
  const hasDeviceNo = fields.some((f) => f === "device no" || f === "device_no" || f === "fixno");
  const hasUsage = fields.some((f) => f === "usage count" || f === "usage_count" || f === "total" || f === "total_cuts");

  if (!hasDeviceNo || !hasUsage) {
    return {
      rows: [],
      errors: [
        `El archivo no parece un export de CutABC. Esperaba columnas "Device NO" y "Usage Count". Encontradas: ${result.meta.fields.join(", ")}`,
      ],
    };
  }

  const findKey = (row: Record<string, string>, candidates: string[]): string | undefined => {
    for (const key of Object.keys(row)) {
      if (candidates.includes(key.trim().toLowerCase())) return key;
    }
    return undefined;
  };

  for (const raw of result.data) {
    const fixnoKey = findKey(raw, ["device no", "device_no", "fixno"]);
    const usageKey = findKey(raw, ["usage count", "usage_count", "total", "total_cuts"]);
    const nameKey = findKey(raw, ["device name", "device_name"]);
    const customerKey = findKey(raw, ["customer name", "customer_name"]);
    if (!fixnoKey || !usageKey) continue;

    const fixno = (raw[fixnoKey] ?? "").toString().trim();
    const usageRaw = (raw[usageKey] ?? "").toString().trim();
    if (!fixno) continue;
    const usageCount = parseInt(usageRaw.replace(/[^\d-]/g, ""), 10);
    if (Number.isNaN(usageCount)) continue;

    rows.push({
      fixno,
      deviceName: nameKey ? (raw[nameKey] ?? "").toString().trim() : "",
      customerName: customerKey ? (raw[customerKey] ?? "").toString().trim() : "",
      usageCount,
    });
  }

  if (rows.length === 0) {
    errors.push("No se encontraron filas con datos válidos.");
  }

  return { rows, errors };
}

export interface CompareOptions {
  /** Tolerancia ± para considerar un equipo OK. Default: 2 */
  tolerance?: number;
  /** Diferencia absoluta a partir de la cual se marca como spike. Default: 100 */
  spikeThreshold?: number;
}

/**
 * Cruza el CSV (fuente de verdad) contra los totales del sistema para un mes.
 */
export function compareCuts(
  csvRows: CutabcCsvRow[],
  systemRows: SystemRow[],
  options: CompareOptions = {},
): ComparisonSummary {
  const tolerance = options.tolerance ?? 2;
  const spikeThreshold = options.spikeThreshold ?? 100;

  const csvMap = new Map<string, CutabcCsvRow>();
  for (const r of csvRows) csvMap.set(r.fixno, r);

  const sysMap = new Map<string, SystemRow>();
  for (const r of systemRows) sysMap.set(r.fixno, r);

  const allFixnos = new Set<string>([...csvMap.keys(), ...sysMap.keys()]);
  const rows: ComparisonRow[] = [];

  let totalCsv = 0;
  let totalSystem = 0;
  let okCount = 0;
  let minorCount = 0;
  let spikeCount = 0;
  let missingInSystem = 0;
  let missingInCsv = 0;

  for (const fixno of allFixnos) {
    const csv = csvMap.get(fixno);
    const sys = sysMap.get(fixno);

    const csvCount = csv ? csv.usageCount : null;
    const systemCount = sys ? sys.totalCuts : null;
    if (csvCount !== null) totalCsv += csvCount;
    if (systemCount !== null) totalSystem += systemCount;

    let status: RowStatus;
    let diff: number | null;
    let absDiff: number;

    if (csv && sys) {
      diff = systemCount! - csvCount!;
      absDiff = Math.abs(diff);
      if (absDiff >= spikeThreshold) {
        status = "spike";
        spikeCount++;
      } else if (absDiff <= tolerance) {
        status = "ok";
        okCount++;
      } else {
        status = "minor";
        minorCount++;
      }
    } else if (csv && !sys) {
      status = "missing_in_system";
      diff = null;
      absDiff = csv.usageCount;
      missingInSystem++;
    } else {
      status = "missing_in_csv";
      diff = null;
      absDiff = sys!.totalCuts;
      missingInCsv++;
    }

    rows.push({
      fixno,
      displayName: sys?.branchName?.trim() || csv?.deviceName?.trim() || fixno,
      customerName: csv?.customerName ?? null,
      csvCount,
      systemCount,
      diff,
      absDiff,
      status,
    });
  }

  // Ordenar: spikes primero, luego mayor desvío, luego faltantes, luego OK al final
  const statusRank: Record<RowStatus, number> = {
    spike: 0,
    minor: 1,
    missing_in_system: 2,
    missing_in_csv: 3,
    ok: 4,
  };
  rows.sort((a, b) => {
    const r = statusRank[a.status] - statusRank[b.status];
    if (r !== 0) return r;
    return b.absDiff - a.absDiff;
  });

  const accuracy = totalCsv === 0 ? 100 : Math.max(0, 100 - (Math.abs(totalSystem - totalCsv) / totalCsv) * 100);

  return {
    totalCsv,
    totalSystem,
    diff: totalSystem - totalCsv,
    accuracy,
    okCount,
    minorCount,
    spikeCount,
    missingInSystem,
    missingInCsv,
    rows,
  };
}

export function exportComparisonCsv(summary: ComparisonSummary, period: string): string {
  const header = ["fixno", "equipo", "cliente", "csv_real", "sistema", "diferencia", "estado"];
  const lines = [header.join(",")];
  for (const r of summary.rows) {
    const cells = [
      r.fixno,
      escapeCsv(r.displayName),
      escapeCsv(r.customerName ?? ""),
      r.csvCount ?? "",
      r.systemCount ?? "",
      r.diff ?? "",
      r.status,
    ];
    lines.push(cells.join(","));
  }
  lines.push("");
  lines.push(`# Periodo: ${period}`);
  lines.push(`# Total CSV: ${summary.totalCsv}`);
  lines.push(`# Total Sistema: ${summary.totalSystem}`);
  lines.push(`# Exactitud: ${summary.accuracy.toFixed(2)}%`);
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}