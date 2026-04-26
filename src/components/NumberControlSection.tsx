import { useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, Upload, Download, FileSearch, Loader2 } from "lucide-react";
import { useMonthlyCutsForControl } from "@/hooks/useMonthlyCutsForControl";
import {
  parseCutabcCsv,
  compareCuts,
  exportComparisonCsv,
  type CutabcCsvRow,
  type ComparisonSummary,
  type RowStatus,
} from "@/lib/cutsControl";
import { toast } from "sonner";

const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function buildPeriods(count = 13): string[] {
  const periods: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(d.toISOString().substring(0, 7));
  }
  return periods;
}

function formatPeriod(p: string): string {
  const [y, m] = p.split("-");
  return `${monthNames[parseInt(m, 10) - 1]} ${y}`;
}

function defaultPeriod(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().substring(0, 7);
}

export function NumberControlSection() {
  const [period, setPeriod] = useState<string>(defaultPeriod());
  const [csvRows, setCsvRows] = useState<CutabcCsvRow[] | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(2);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: systemRows = [], isLoading: loadingSystem } = useMonthlyCutsForControl(period);

  const summary: ComparisonSummary | null = useMemo(() => {
    if (!csvRows) return null;
    return compareCuts(csvRows, systemRows, { tolerance });
  }, [csvRows, systemRows, tolerance]);

  function handleFile(file: File) {
    setParsing(true);
    setParseError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const result = parseCutabcCsv(text);
        if (result.errors.length > 0 && result.rows.length === 0) {
          setParseError(result.errors.join(" "));
          setCsvRows(null);
          setCsvFileName(null);
          toast.error(result.errors[0]);
        } else {
          setCsvRows(result.rows);
          setCsvFileName(file.name);
          toast.success(`${result.rows.length} equipos leídos del archivo`);
        }
      } catch (e: any) {
        setParseError("No se pudo leer el archivo: " + (e.message ?? e));
        toast.error("Error al leer el archivo");
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setParseError("No se pudo leer el archivo.");
      setParsing(false);
    };
    reader.readAsText(file, "utf-8");
  }

  function handleExport() {
    if (!summary) return;
    const csv = exportComparisonCsv(summary, period);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `control-cortes-${period}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleClear() {
    setCsvRows(null);
    setCsvFileName(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const periods = buildPeriods(13);

  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <FileSearch className="h-4 w-4" /> Control de cortes
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Subí el export mensual de CutABC (totales por equipo) para verificar que los números del sistema coincidan con la fuente original.
        Nada se guarda en la base — es una herramienta de auditoría.
      </p>

      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Período</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {periods.map((p) => (
              <option key={p} value={p}>{formatPeriod(p)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tolerancia (± cortes)</label>
          <input
            type="number"
            min={0}
            max={50}
            value={tolerance}
            onChange={(e) => setTolerance(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-end">
          <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {parsing ? "Leyendo..." : "Subir CSV"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        </div>
      </div>

      {csvFileName && (
        <div className="mb-3 flex items-center justify-between rounded border bg-secondary/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Archivo cargado: <span className="font-medium text-foreground">{csvFileName}</span>
            {csvRows && <> · {csvRows.length} equipos</>}
          </span>
          <button
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground"
          >
            Quitar
          </button>
        </div>
      )}

      {parseError && (
        <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {parseError}
        </div>
      )}

      {!csvRows && !parseError && (
        <p className="rounded border border-dashed bg-secondary/20 px-3 py-6 text-center text-xs text-muted-foreground">
          Subí un CSV exportado de CutABC con columnas <code>Device NO</code>, <code>Device Name</code>, <code>Customer Name</code>, <code>Usage Count</code>.
        </p>
      )}

      {csvRows && summary && (
        <ComparisonResult
          summary={summary}
          periodLabel={formatPeriod(period)}
          loadingSystem={loadingSystem}
          onExport={handleExport}
        />
      )}
    </div>
  );
}

function ComparisonResult({
  summary,
  periodLabel,
  loadingSystem,
  onExport,
}: {
  summary: ComparisonSummary;
  periodLabel: string;
  loadingSystem: boolean;
  onExport: () => void;
}) {
  return (
    <div>
      {/* Resumen */}
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <SummaryCard
          label={`Real (CutABC) ${periodLabel}`}
          value={summary.totalCsv.toLocaleString()}
          tone="neutral"
        />
        <SummaryCard
          label="Sistema"
          value={summary.totalSystem.toLocaleString()}
          subtitle={loadingSystem ? "Cargando..." : undefined}
          tone="neutral"
        />
        <SummaryCard
          label="Diferencia"
          value={`${summary.diff > 0 ? "+" : ""}${summary.diff.toLocaleString()}`}
          tone={Math.abs(summary.diff) > 50 ? "bad" : Math.abs(summary.diff) > 5 ? "warn" : "good"}
        />
        <SummaryCard
          label="Exactitud"
          value={`${summary.accuracy.toFixed(1)}%`}
          tone={summary.accuracy >= 98 ? "good" : summary.accuracy >= 90 ? "warn" : "bad"}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <Tag tone="good" icon={<CheckCircle2 className="h-3 w-3" />}>{summary.okCount} OK</Tag>
        <Tag tone="warn" icon={<AlertTriangle className="h-3 w-3" />}>{summary.minorCount} desvío menor</Tag>
        <Tag tone="bad" icon={<AlertCircle className="h-3 w-3" />}>{summary.spikeCount} spike</Tag>
        <Tag tone="muted" icon={<HelpCircle className="h-3 w-3" />}>{summary.missingInSystem} falta en sistema</Tag>
        <Tag tone="muted" icon={<HelpCircle className="h-3 w-3" />}>{summary.missingInCsv} falta en CutABC</Tag>
        <button
          onClick={onExport}
          className="ml-auto inline-flex items-center gap-1.5 rounded bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-accent"
        >
          <Download className="h-3 w-3" /> Exportar comparativa
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Equipo</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 text-right font-medium">CutABC</th>
              <th className="px-3 py-2 text-right font-medium">Sistema</th>
              <th className="px-3 py-2 text-right font-medium">Diferencia</th>
              <th className="px-3 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((r) => (
              <tr key={r.fixno} className="border-t border-border/50 hover:bg-secondary/30">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.displayName}</div>
                  <div className="text-[10px] text-muted-foreground">{r.fixno}</div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.customerName ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.csvCount === null ? <span className="text-muted-foreground">—</span> : r.csvCount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.systemCount === null ? <span className="text-muted-foreground">—</span> : r.systemCount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.diff === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className={r.diff === 0 ? "text-muted-foreground" : r.diff > 0 ? "text-amber-400" : "text-red-400"}>
                      {r.diff > 0 ? "+" : ""}{r.diff.toLocaleString()}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, subtitle, tone }: { label: string; value: string; subtitle?: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  const ring =
    tone === "good" ? "border-emerald-500/30 bg-emerald-500/5" :
    tone === "warn" ? "border-amber-500/30 bg-amber-500/5" :
    tone === "bad" ? "border-red-500/30 bg-red-500/5" :
    "border-border bg-secondary/30";
  const fg =
    tone === "good" ? "text-emerald-400" :
    tone === "warn" ? "text-amber-400" :
    tone === "bad" ? "text-red-400" :
    "text-foreground";
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${ring}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${fg}`}>{value}</div>
      {subtitle && <div className="text-[10px] text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

function Tag({ tone, icon, children }: { tone: "good" | "warn" | "bad" | "muted"; icon: React.ReactNode; children: React.ReactNode }) {
  const cls =
    tone === "good" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
    tone === "warn" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
    tone === "bad" ? "bg-red-500/10 text-red-400 border-red-500/30" :
    "bg-secondary text-muted-foreground border-border";
  return <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${cls}`}>{icon}{children}</span>;
}

function StatusBadge({ status }: { status: RowStatus }) {
  switch (status) {
    case "ok":
      return <Tag tone="good" icon={<CheckCircle2 className="h-3 w-3" />}>OK</Tag>;
    case "minor":
      return <Tag tone="warn" icon={<AlertTriangle className="h-3 w-3" />}>Desvío menor</Tag>;
    case "spike":
      return <Tag tone="bad" icon={<AlertCircle className="h-3 w-3" />}>Spike</Tag>;
    case "missing_in_system":
      return <Tag tone="muted" icon={<HelpCircle className="h-3 w-3" />}>No está en sistema</Tag>;
    case "missing_in_csv":
      return <Tag tone="muted" icon={<HelpCircle className="h-3 w-3" />}>No está en CutABC</Tag>;
  }
}