// app/(dashboard)/customer-po/bulk-upload/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/lib/branch-context";
import { useSession } from "next-auth/react";
import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────
type Channel = "WHATSAPP" | "PHONE" | "WALK_IN" | "SALES_VISIT";
const VALID_CHANNELS: Channel[] = ["WHATSAPP", "PHONE", "WALK_IN", "SALES_VISIT"];
const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp", PHONE: "Telepon", WALK_IN: "Walk-in", SALES_VISIT: "Sales Visit",
};

interface CustomerOption { id: string; code: string; name: string; }

interface RowData {
  _rowIndex: number;
  customerCode: string;   // user fills this; we resolve to ID
  kg12Qty: string;
  kg50Qty: string;
  channel: string;
  notes: string;
  // resolved
  _customerId: string | null;
  _customerName: string | null;
  _errors: string[];
  _valid: boolean;
  _status: "idle" | "submitting" | "success" | "error";
  _serverError?: string;
}

// ── Validation ─────────────────────────────────────────────────────────────
function validateRow(row: RowData): string[] {
  const errors: string[] = [];
  if (!row.customerCode || row.customerCode.trim().length === 0)
    errors.push("Kode pelanggan wajib diisi");
  else if (!row._customerId)
    errors.push(`Kode pelanggan "${row.customerCode}" tidak ditemukan di sistem`);
  if (!row.kg12Qty && !row.kg50Qty)
    errors.push("Minimal salah satu qty (12kg atau 50kg) harus diisi");
  if (row.kg12Qty && isNaN(Number(row.kg12Qty)))
    errors.push("Qty 12kg harus angka");
  if (row.kg50Qty && isNaN(Number(row.kg50Qty)))
    errors.push("Qty 50kg harus angka");
  if (row.channel && !VALID_CHANNELS.includes(row.channel as Channel))
    errors.push(`Channel tidak valid. Pilihan: ${VALID_CHANNELS.join(", ")}`);
  return errors;
}

// ── Template ───────────────────────────────────────────────────────────────
function downloadTemplate() {
  const headers = ["customerCode", "kg12Qty", "kg50Qty", "channel", "notes"];
  const example = ["SBY-AGN-0001", "50", "10", "WHATSAPP", "Catatan opsional"];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "CustomerPO");
  XLSX.writeFile(wb, "template_bulk_customer_po.xlsx");
}

// ── Parse Excel ────────────────────────────────────────────────────────────
function parseExcel(file: File): Promise<Omit<RowData, "_customerId" | "_customerName">[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (raw.length < 2) { resolve([]); return; }

        const headers = (raw[0] as string[]).map((h) => String(h).trim().toLowerCase());
        const col = (names: string[]) => {
          for (const n of names) { const i = headers.indexOf(n); if (i !== -1) return i; }
          return -1;
        };
        const COL = {
          customerCode: col(["customercode", "customer_code", "kode_pelanggan", "kode pelanggan", "code"]),
          kg12Qty: col(["kg12qty", "kg12_qty", "qty_12kg", "12kg", "qty12"]),
          kg50Qty: col(["kg50qty", "kg50_qty", "qty_50kg", "50kg", "qty50"]),
          channel: col(["channel", "saluran"]),
          notes: col(["notes", "catatan", "note"]),
        };

        const get = (r: any[], c: number) => c >= 0 ? String(r[c] ?? "").trim() : "";

        const rows: Omit<RowData, "_customerId" | "_customerName">[] = [];
        for (let i = 1; i < raw.length; i++) {
          const r = raw[i] as any[];
          if (r.every((c) => c === "" || c == null)) continue;
          const row = {
            _rowIndex: i + 1,
            customerCode: get(r, COL.customerCode),
            kg12Qty: get(r, COL.kg12Qty) || "0",
            kg50Qty: get(r, COL.kg50Qty) || "0",
            channel: get(r, COL.channel).toUpperCase(),
            notes: get(r, COL.notes),
            _errors: [] as string[],
            _valid: false,
            _status: "idle" as const,
          };
          rows.push(row);
        }
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── Component ───────────────────────────────────────────────────────────────
export default function CustomerPoBulkUploadPage() {
  const { data: session } = useSession();
  const { activeBranchId } = useBranch();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [rows, setRows] = useState<RowData[]>([]);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<{
    success: number; failed: number; ignored: number;
    errors: { row: number; code: string; reason: string }[];
  } | null>(null);

  // Customer lookup cache: code → {id, name}
  const [customerCache, setCustomerCache] = useState<Record<string, CustomerOption>>({});
  const [lookingUp, setLookingUp] = useState(false);

  const branchId =
    session?.user?.role === "SUPER_ADMIN"
      ? activeBranchId
      : session?.user?.branchId ?? null;

  // ── Fetch all customers for this branch (for lookup) ──────────────────
  const fetchCustomers = useCallback(async () => {
    if (!branchId) return;
    try {
      const res = await fetch(`/api/customers?branchId=${branchId}&page=1`);
      if (!res.ok) return;
      // Fetch all pages to build full cache
      const first = await res.json();
      const allCustomers: CustomerOption[] = first.data ?? [];
      const totalPages = first.meta?.totalPages ?? 1;
      for (let p = 2; p <= totalPages; p++) {
        const r2 = await fetch(`/api/customers?branchId=${branchId}&page=${p}`);
        if (r2.ok) { const d = await r2.json(); allCustomers.push(...(d.data ?? [])); }
      }
      const cache: Record<string, CustomerOption> = {};
      for (const c of allCustomers) cache[c.code.toUpperCase()] = c;
      setCustomerCache(cache);
    } catch { /* silent */ }
  }, [branchId]);

  useEffect(() => { if (branchId) fetchCustomers(); }, [branchId, fetchCustomers]);

  // ── Resolve customer codes → IDs ────────────────────────────────────────
  const resolveRows = useCallback(
    (rawRows: Omit<RowData, "_customerId" | "_customerName">[]): RowData[] => {
      return rawRows.map((row) => {
        const key = row.customerCode.trim().toUpperCase();
        const customer = customerCache[key] ?? null;
        const full: RowData = {
          ...row,
          _customerId: customer?.id ?? null,
          _customerName: customer?.name ?? null,
        };
        full._errors = validateRow(full);
        full._valid = full._errors.length === 0;
        return full;
      });
    },
    [customerCache]
  );

  // Re-resolve when cache loads
  useEffect(() => {
    if (step === "preview" && rows.length > 0) {
      setRows((prev) => resolveRows(prev.map((r) => ({
        ...r, _customerId: null, _customerName: null,
      }))));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerCache]);

  // ── File handling ──────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) { alert("Harap upload file Excel (.xlsx / .xls)"); return; }
    setParsing(true);
    setLookingUp(true);
    try {
      const parsed = await parseExcel(file);
      if (parsed.length === 0) { alert("File kosong."); return; }
      const resolved = resolveRows(parsed);
      setRows(resolved); setResult(null); setStep("preview");
    } catch { alert("Gagal membaca file."); }
    finally { setParsing(false); setLookingUp(false); }
  }, [resolveRows]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = "";
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  };

  // ── Row editing ────────────────────────────────────────────────────────
  const updateRow = (index: number, field: keyof RowData, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value };
      // Re-resolve customer if code changed
      if (field === "customerCode") {
        const key = value.trim().toUpperCase();
        const customer = customerCache[key] ?? null;
        updated._customerId = customer?.id ?? null;
        updated._customerName = customer?.name ?? null;
      }
      updated._errors = validateRow(updated);
      updated._valid = updated._errors.length === 0;
      next[index] = updated;
      return next;
    });
  };

  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!branchId) { alert("Pilih cabang terlebih dahulu."); return; }
    const validRows = rows.filter((r) => r._valid && r._status !== "success");
    if (validRows.length === 0) { alert("Tidak ada baris valid."); return; }

    setSubmitting(true);
    setRows((prev) =>
      prev.map((r) => r._valid && r._status !== "success" ? { ...r, _status: "submitting" } : r)
    );

    let successCount = 0;
    const failedErrors: { row: number; code: string; reason: string }[] = [];

    for (const row of validRows) {
      try {
        const res = await fetch("/api/customer-po", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId,
            customerId: row._customerId,
            kg12Qty: parseInt(row.kg12Qty) || 0,
            kg50Qty: parseInt(row.kg50Qty) || 0,
            channel: row.channel || null,
            notes: row.notes || null,
          }),
        });
        if (res.ok) {
          successCount++;
          setRows((prev) =>
            prev.map((r) => r._rowIndex === row._rowIndex ? { ...r, _status: "success" } : r)
          );
        } else {
          const data = await res.json().catch(() => ({}));
          const reason = data.error ?? `HTTP ${res.status}`;
          failedErrors.push({ row: row._rowIndex, code: row.customerCode, reason });
          setRows((prev) =>
            prev.map((r) =>
              r._rowIndex === row._rowIndex ? { ...r, _status: "error", _serverError: reason } : r
            )
          );
        }
      } catch {
        failedErrors.push({ row: row._rowIndex, code: row.customerCode, reason: "Network error" });
        setRows((prev) =>
          prev.map((r) =>
            r._rowIndex === row._rowIndex ? { ...r, _status: "error", _serverError: "Network error" } : r
          )
        );
      }
    }

    setResult({
      success: successCount, failed: failedErrors.length,
      ignored: rows.filter((r) => !r._valid).length, errors: failedErrors,
    });
    setSubmitting(false);
  };

  const validCount = rows.filter((r) => r._valid).length;
  const invalidCount = rows.filter((r) => !r._valid).length;
  const successCount = rows.filter((r) => r._status === "success").length;

  // ── Upload step ────────────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Bulk Upload Customer PO</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Upload file Excel untuk membuat banyak CPO sekaligus
            </p>
          </div>
          <button onClick={() => router.back()} className="btn-gho">← Kembali</button>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 340px" }}>
          <div className="card">
            <h2 className="font-semibold text-[var(--text-primary)] mb-1">Upload File Excel</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Format: <code className="text-xs bg-[var(--surface-raised)] px-1 py-0.5 rounded">.xlsx</code>{" "}
              atau <code className="text-xs bg-[var(--surface-raised)] px-1 py-0.5 rounded">.xls</code>
            </p>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragging ? "border-[var(--accent)] bg-[var(--accent)]/5"
                  : "border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-raised)]"
              }`}
            >
              {parsing ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-[var(--text-muted)]">
                    {lookingUp ? "Mencocokkan kode pelanggan…" : "Membaca file…"}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    className="text-[var(--text-muted)]">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      Klik untuk pilih file atau drag &amp; drop
                    </p>
                    <p className="text-sm text-[var(--text-muted)] mt-1">Excel .xlsx / .xls</p>
                  </div>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} />
          </div>

          <div className="flex flex-col gap-4">
            <div className="card">
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">1. Download Template</h3>
              <p className="text-sm text-[var(--text-muted)] mb-3">
                Gunakan kode pelanggan yang sudah ada di sistem.
              </p>
              <button onClick={downloadTemplate} className="btn-pri w-full">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Template Excel
              </button>
            </div>

            <div className="card">
              <h3 className="font-semibold text-[var(--text-primary)] mb-3">2. Isi Kolom Berikut</h3>
              <div className="flex flex-col gap-2">
                {[
                  { col: "customerCode", req: true, desc: "Kode pelanggan (contoh: SBY-AGN-0001)" },
                  { col: "kg12Qty", req: false, desc: "Jumlah tabung 12kg" },
                  { col: "kg50Qty", req: false, desc: "Jumlah tabung 50kg (salah satu qty wajib)" },
                  { col: "channel", req: false, desc: "WHATSAPP / PHONE / WALK_IN / SALES_VISIT" },
                  { col: "notes", req: false, desc: "Catatan tambahan" },
                ].map((item) => (
                  <div key={item.col} className="flex items-start gap-2">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${
                      item.req
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-[var(--surface-raised)] text-[var(--text-muted)]"
                    }`}>
                      {item.req ? "wajib" : "opsional"}
                    </span>
                    <div>
                      <code className="text-xs font-mono text-[var(--text-primary)]">{item.col}</code>
                      <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)]">
                  ⚠️ Gunakan <strong>kode pelanggan</strong> yang terdaftar di sistem, bukan nama pelanggan.
                  Kode yang tidak ditemukan akan ditandai invalid.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Preview step ───────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Preview Customer PO</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Periksa dan koreksi data sebelum disimpan
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setStep("upload"); setRows([]); setResult(null); }}
            className="btn-gho" disabled={submitting}>← Upload Ulang</button>
          <button onClick={handleSubmit} className="btn-pri"
            disabled={submitting || validCount === 0 || successCount === validCount}>
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Menyimpan…</>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Simpan {validCount} CPO Valid
              </>
            )}
          </button>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div className={`card mb-4 border-l-4 ${result.failed === 0 ? "border-l-green-500" : "border-l-yellow-500"}`}>
          <div className="flex items-start gap-4">
            <div className="flex gap-6 flex-1">
              <div>
                <p className="text-2xl font-bold text-green-600">{result.success}</p>
                <p className="text-xs text-[var(--text-muted)]">CPO berhasil dibuat</p>
              </div>
              {result.failed > 0 && (
                <div>
                  <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                  <p className="text-xs text-[var(--text-muted)]">Gagal (server)</p>
                </div>
              )}
              {result.ignored > 0 && (
                <div>
                  <p className="text-2xl font-bold text-[var(--text-muted)]">{result.ignored}</p>
                  <p className="text-xs text-[var(--text-muted)]">Dilewati (invalid)</p>
                </div>
              )}
            </div>
            {result.success > 0 && (
              <button onClick={() => router.push("/customer-po")} className="btn-pri shrink-0">
                Lihat Semua CPO →
              </button>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Error dari server:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">
                  Baris {e.row} ({e.code}): {e.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-muted)]">
              <strong className="text-[var(--text-primary)]">{rows.length}</strong> total baris
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-sm text-[var(--text-muted)]">
              <strong className="text-green-600">{validCount}</strong> valid
            </span>
          </div>
          {invalidCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-sm text-[var(--text-muted)]">
                <strong className="text-red-600">{invalidCount}</strong> invalid (akan dilewati)
              </span>
            </div>
          )}
          {successCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-sm text-[var(--text-muted)]">
                <strong className="text-blue-600">{successCount}</strong> tersimpan
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        <div className="table-wrap overflow-x-auto">
          <table className="data-table" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th>Status</th>
                <th>Kode Pelanggan <span className="text-red-500">*</span></th>
                <th>Pelanggan Ditemukan</th>
                <th>Qty 12kg</th>
                <th>Qty 50kg</th>
                <th>Channel</th>
                <th>Catatan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isInvalid = !row._valid;
                const isDone = row._status === "success";
                const hasError = row._status === "error";
                const rowCls = isDone
                  ? "opacity-60 bg-green-50 dark:bg-green-900/10"
                  : isInvalid ? "bg-red-50 dark:bg-red-900/10"
                  : hasError ? "bg-yellow-50 dark:bg-yellow-900/10" : "";

                return (
                  <tr key={row._rowIndex} className={rowCls}>
                    <td className="text-center text-xs text-[var(--text-muted)]">{row._rowIndex}</td>
                    <td>
                      {row._status === "success" ? <span className="badge-success">✓ Tersimpan</span>
                        : row._status === "submitting" ? <span className="badge-neutral">…</span>
                        : row._status === "error" ? <span className="badge-error" title={row._serverError}>✗ Gagal</span>
                        : isInvalid ? <span className="badge-error" title={row._errors.join("; ")}>✗ Invalid</span>
                        : <span className="badge-success">✓ Valid</span>}
                    </td>

                    {/* customerCode */}
                    <td>
                      <input type="text"
                        className={`form-input text-xs py-1 font-mono w-full ${
                          row.customerCode && !row._customerId ? "border-red-400" : ""
                        }`}
                        value={row.customerCode}
                        disabled={isDone || submitting}
                        placeholder="SBY-AGN-0001"
                        onChange={(e) => updateRow(i, "customerCode", e.target.value)}
                      />
                    </td>

                    {/* resolved customer name */}
                    <td>
                      {row._customerId ? (
                        <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                          ✓ {row._customerName}
                        </span>
                      ) : row.customerCode ? (
                        <span className="text-xs text-red-600">Tidak ditemukan</span>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">—</span>
                      )}
                    </td>

                    {/* kg12Qty */}
                    <td>
                      <input type="number" min="0"
                        className={`form-input text-xs py-1 w-20 ${isNaN(Number(row.kg12Qty)) ? "border-red-400" : ""}`}
                        value={row.kg12Qty} disabled={isDone || submitting}
                        onChange={(e) => updateRow(i, "kg12Qty", e.target.value)} />
                    </td>

                    {/* kg50Qty */}
                    <td>
                      <input type="number" min="0"
                        className={`form-input text-xs py-1 w-20 ${isNaN(Number(row.kg50Qty)) ? "border-red-400" : ""}`}
                        value={row.kg50Qty} disabled={isDone || submitting}
                        onChange={(e) => updateRow(i, "kg50Qty", e.target.value)} />
                    </td>

                    {/* channel */}
                    <td>
                      <select
                        className={`form-select text-xs py-1 ${row.channel && !VALID_CHANNELS.includes(row.channel as Channel) ? "border-red-400" : ""}`}
                        value={row.channel} disabled={isDone || submitting}
                        onChange={(e) => updateRow(i, "channel", e.target.value)}>
                        <option value="">—</option>
                        {VALID_CHANNELS.map((c) => (
                          <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                        ))}
                      </select>
                    </td>

                    {/* notes */}
                    <td style={{ minWidth: 160 }}>
                      <input type="text" className="form-input text-xs py-1 w-full"
                        value={row.notes} disabled={isDone || submitting} placeholder="Catatan"
                        onChange={(e) => updateRow(i, "notes", e.target.value)} />
                    </td>

                    {/* Remove */}
                    <td>
                      {!isDone && (
                        <button onClick={() => removeRow(i)} disabled={submitting}
                          className="btn-icon text-red-500 hover:text-red-700" title="Hapus baris">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.some((r) => !r._valid) && (
          <div className="px-4 py-3 border-t border-[var(--border)] bg-red-50 dark:bg-red-900/10">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
              Detail error (baris invalid akan dilewati):
            </p>
            {rows.filter((r) => !r._valid).map((r) => (
              <p key={r._rowIndex} className="text-xs text-red-600">
                Baris {r._rowIndex}: {r._errors.join(" · ")}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}