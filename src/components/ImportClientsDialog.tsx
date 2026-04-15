import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";

interface ParsedClient {
  name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  duplicate?: boolean;
}

const COLUMN_MAP: Record<string, keyof ParsedClient> = {
  nombre: "name",
  cliente: "name",
  name: "name",
  razón_social: "name",
  razon_social: "name",
  contacto: "contact_name",
  contact_name: "contact_name",
  nombre_contacto: "contact_name",
  teléfono: "contact_phone",
  telefono: "contact_phone",
  phone: "contact_phone",
  fono: "contact_phone",
  email: "contact_email",
  correo: "contact_email",
  mail: "contact_email",
  contact_email: "contact_email",
};

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function parseRows(sheet: XLSX.WorkSheet): ParsedClient[] {
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  if (!json.length) return [];

  // Map headers
  const sampleKeys = Object.keys(json[0]);
  const mapping: Record<string, keyof ParsedClient> = {};
  for (const key of sampleKeys) {
    const norm = normalizeHeader(key);
    if (COLUMN_MAP[norm]) mapping[key] = COLUMN_MAP[norm];
  }

  if (!Object.values(mapping).includes("name")) {
    // Fallback: use first column as name
    mapping[sampleKeys[0]] = "name";
  }

  return json
    .map((row) => {
      const client: ParsedClient = { name: "", contact_name: "", contact_phone: "", contact_email: "" };
      for (const [key, field] of Object.entries(mapping)) {
        const val = String(row[key] ?? "").trim();
        if (val) (client as any)[field] = val;
      }
      return client;
    })
    .filter((c) => c.name.length > 0);
}

export function ImportClientsDialog({
  open,
  onClose,
  tenantId,
  existingNames,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  existingNames: string[];
}) {
  const [parsed, setParsed] = useState<ParsedClient[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const qc = useQueryClient();

  const existingSet = new Set(existingNames.map((n) => n.toLowerCase()));

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target!.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = parseRows(sheet);
          // Mark duplicates
          rows.forEach((r) => {
            r.duplicate = existingSet.has(r.name.toLowerCase());
          });
          setParsed(rows);
          if (rows.length === 0) toast.error("No se encontraron filas válidas");
        } catch {
          toast.error("Error al leer el archivo");
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [existingSet]
  );

  const newClients = parsed.filter((c) => !c.duplicate);

  const handleImport = async () => {
    if (!newClients.length) return;
    setImporting(true);
    try {
      const inserts = newClients.map((c) => ({
        tenant_id: tenantId,
        name: c.name,
        contact_name: c.contact_name || null,
        contact_phone: c.contact_phone || null,
        contact_email: c.contact_email || null,
      }));
      const { error } = await supabase.from("clients").insert(inserts);
      if (error) throw error;
      toast.success(`${newClients.length} clientes importados`);
      qc.invalidateQueries({ queryKey: ["clients"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Importar Clientes
          </DialogTitle>
        </DialogHeader>

        {parsed.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Subí un archivo CSV o Excel (.xlsx) con tus clientes. Las columnas se mapean automáticamente.
            </p>
            <p className="text-xs text-muted-foreground">
              Columnas reconocidas: <span className="font-mono">nombre/cliente/razón_social, contacto, teléfono/fono, email/correo</span>
            </p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Click para seleccionar archivo</span>
              <span className="text-xs text-muted-foreground mt-1">CSV, XLS, XLSX</span>
              <input type="file" className="hidden" accept=".csv,.xls,.xlsx" onChange={handleFile} />
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{fileName}</span> — {parsed.length} filas,{" "}
                <span className="text-green-400">{newClients.length} nuevos</span>
                {parsed.length - newClients.length > 0 && (
                  <span className="text-yellow-400 ml-1">({parsed.length - newClients.length} duplicados)</span>
                )}
              </p>
              <Button variant="ghost" size="sm" onClick={() => { setParsed([]); setFileName(""); }}>
                Cambiar archivo
              </Button>
            </div>

            <ScrollArea className="h-[300px] border border-border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((c, i) => (
                    <TableRow key={i} className={c.duplicate ? "opacity-40" : ""}>
                      <TableCell>
                        {c.duplicate ? (
                          <AlertCircle className="w-4 h-4 text-yellow-400" title="Ya existe" />
                        ) : (
                          <Check className="w-4 h-4 text-green-400" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm">{c.contact_name}</TableCell>
                      <TableCell className="text-sm">{c.contact_phone}</TableCell>
                      <TableCell className="text-sm">{c.contact_email}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {parsed.length > 0 && (
            <Button onClick={handleImport} disabled={importing || newClients.length === 0}>
              {importing ? "Importando..." : `Importar ${newClients.length} clientes`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
