// app/(dashboard)/customers/bulk-upload/page.tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/lib/branch-context";
import { useSession } from "next-auth/react";
import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────
type CustomerType = "RETAIL" | "AGEN" | "INDUSTRI";

interface RowData {
  _rowIndex: number;       // original Excel row number (for display)
  name: string;
  customerType: CustomerType | string;
  phone: string;
  email: string;
  address: string;
  npwp: string;
  creditLimitKg12: string;
  creditLimitKg50: string;
  // validation
  _errors: string[];
  _valid: boolean;
  _status: "idle" | "submitting" | "success" | "error";
  _serverError?: string;
}

const VALID_TYPES: CustomerType[] = ["RETAIL", "AGEN", "INDUSTRI"];

const TYPE_LABELS: Record<string, string> = {
  RETAIL: "Retail",
  AGEN: "Agen",
  INDUSTRI: "Industri",
};

// ── Validation ─────────────────────────────────────────────────────────────
function validateRow(row: RowData): string[] {
  const errors: string[] = [];
  if (!row.name || row.name.trim().length < 2)
    errors.push("Nama minimal 2 karakter");
  if (!VALID_TYPES.includes(row.customerType as CustomerType))
    errors.push(`Tipe harus: RETAIL, AGEN, atau INDUSTRI (dapat: "${row.customerType}")`);
  if (row.email && row.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim()))
    errors.push("Format email tidak valid");
  if (row.phone && row.phone.trim().length > 30)
    errors.push("Telepon max 30 karakter");
  if (row.creditLimitKg12 && isNaN(Number(row.creditLimitKg12)))
    errors.push("Credit Limit 12kg harus angka");
  if (row.creditLimitKg50 && isNaN(Number(row.creditLimitKg50)))
    errors.push("Credit Limit 50kg harus angka");
  return errors;
}

// ── Template download ───────────────────────────────────────────────────────
function downloadTemplate() {
  const headers = [
    "name",
    "customerType",
    "phone",
    "email",
    "address",
    "npwp",
    "creditLimitKg12",
    "creditLimitKg50",
  ];
  const example = [
    "PT Maju Jaya",
    "AGEN",
    "08123456789",
    "majujaya@email.com",
    "Jl. Raya No. 1, Surabaya",
    "12.345.678.9-012.000",
    "0",
    "0",
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);

  // Column widths
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 20) }));

  // Header style hint via comments
  ws["A1"].c = [{ a: "System", t: "Wajib diisi, min 2 karakter" }];
  ws["B1"].c = [{ a: "System", t: "Wajib: RETAIL | AGEN | INDUSTRI (huruf kapital)" }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pelanggan");
  XLSX.writeFile(wb, "template_bulk_pelanggan.xlsx");
}

// ── Parse Excel ─────────────────────────────────────────────────────────────
function parseExcel(file: File): Promise<RowData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        if (rows.length < 2) {
          resolve([]);
          return;
        }

        // First row = headers (case-insensitive map)
        const headers: string[] = (rows[0] as string[]).map((h) =>
          String(h).trim().toLowerCase()
        );

        const colIndex = (names: string[]) => {
          for (const n of names) {
            const i = headers.indexOf(n.toLowerCase());
            if (i !== -1) return i;
          }
          return -1;
        };

        const COL = {
          name: colIndex(["name", "nama"]),
          customerType: colIndex(["customertype", "customer_type", "tipe", "type"]),
          phone: colIndex(["phone", "telepon", "hp", "no_hp"]),
          email: colIndex(["email"]),
          address: colIndex(["address", "alamat"]),
          npwp: colIndex(["npwp"]),
          creditLimitKg12: colIndex(["creditlimitkg12", "credit_limit_kg12", "limit12"]),
          creditLimitKg50: colIndex(["creditlimitkg50", "credit_limit_kg50", "limit50"]),
        };

        const parsed: RowData[] = [];
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i] as any[];
          // Skip fully empty rows
          if (r.every((c) => c === "" || c === null || c === undefined)) continue;

          const get = (col: number) => (col >= 0 ? String(r[col] ?? "").trim() : "");

          const row: RowData = {
            _rowIndex: i + 1, // Excel row number (1-based, +1 for header)
            name: get(COL.name),
            customerType: get(COL.customerType).toUpperCase(),
            phone: get(COL.phone),
            email: get(COL.email),
            address: get(COL.address),
            npwp: get(COL.npwp),
            creditLimitKg12: get(COL.creditLimitKg12) || "0",
            creditLimitKg50: get(COL.creditLimitKg50) || "0",
            _errors: [],
            _valid: false,
            _status: "idle",
          };

          row._errors = validateRow(row);
          row._valid = row._errors.length === 0;
          parsed.push(row);
        }

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── Component ───────────────────────────────────────────────────────────────
export default function CustomersBulkUploadPage() {
  const { data: session } = useSession();
  const { activeBranchId } = useBranch();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [rows, setRows] = useState<RowData[]>([]);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Toast / result state
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    ignored: number;
    errors: { row: number; name: string; reason: string }[];
  } | null>(null);

  // ── Branch ID to use ───────────────────────────────────────────────────
  const branchId =
    session?.user?.role === "SUPER_ADMIN"
      ? activeBranchId
      : session?.user?.branchId ?? null;

  // ── File handling ──────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert("Harap upload file Excel (.xlsx atau .xls)");
      return;
    }
    setParsing(true);
    try {
      const parsed = await parseExcel(file);
      if (parsed.length === 0) {
        alert("File kosong atau tidak ada data di bawah header.");
        return;
      }
      setRows(parsed);
      setResult(null);
      setStep("preview");
    } catch {
      alert("Gagal membaca file. Pastikan format Excel valid.");
    } finally {
      setParsing(false);
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Row editing ────────────────────────────────────────────────────────
  const updateRow = (index: number, field: keyof RowData, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: field === "customerType" ? value.toUpperCase() : value };
      row._errors = validateRow(row);
      row._valid = row._errors.length === 0;
      next[index] = row;
      return next;
    });
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!branchId) {
      alert("Pilih cabang terlebih dahulu.");
      return;
    }

    const validRows = rows.filter((r) => r._valid && r._status !== "success");
    const ignoredRows = rows.filter((r) => !r._valid);

    if (validRows.length === 0) {
      alert("Tidak ada baris valid untuk disubmit.");
      return;
    }

    setSubmitting(true);

    // Mark all valid as submitting
    setRows((prev) =>
      prev.map((r) =>
        r._valid && r._status !== "success" ? { ...r, _status: "submitting" } : r
      )
    );

    let successCount = 0;
    const failedErrors: { row: number; name: string; reason: string }[] = [];

    for (const row of validRows) {
      try {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId,
            name: row.name.trim(),
            customerType: row.customerType,
            phone: row.phone || null,
            email: row.email || null,
            address: row.address || null,
            npwp: row.npwp || null,
            creditLimitKg12: parseInt(row.creditLimitKg12) || 0,
            creditLimitKg50: parseInt(row.creditLimitKg50) || 0,
            isActive: true,
          }),
        });

        if (res.ok) {
          successCount++;
          setRows((prev) =>
            prev.map((r) =>
              r._rowIndex === row._rowIndex ? { ...r, _status: "success" } : r
            )
          );
        } else {
          const data = await res.json().catch(() => ({}));
          const reason = data.error ?? `HTTP ${res.status}`;
          failedErrors.push({ row: row._rowIndex, name: row.name, reason });
          setRows((prev) =>
            prev.map((r) =>
              r._rowIndex === row._rowIndex
                ? { ...r, _status: "error", _serverError: reason }
                : r
            )
          );
        }
      } catch {
        const reason = "Gagal terhubung ke server";
        failedErrors.push({ row: row._rowIndex, name: row.name, reason });
        setRows((prev) =>
          prev.map((r) =>
            r._rowIndex === row._rowIndex
              ? { ...r, _status: "error", _serverError: reason }
              : r
          )
        );
      }
    }

    setResult({
      success: successCount,
      failed: failedErrors.length,
      ignored: ignoredRows.length,
      errors: failedErrors,
    });

    setSubmitting(false);
  };

  // ── Derived counts ─────────────────────────────────────────────────────
  const validCount = rows.filter((r) => r._valid).length;
  const invalidCount = rows.filter((r) => !r._valid).length;
  const successCount = rows.filter((r) => r._status === "success").length;

  // ── Render: Upload step ────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Bulk Upload Pelanggan</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Upload file Excel untuk menambah banyak pelanggan sekaligus
            </p>
          </div>
          <button onClick={() => router.back()} className="btn-gho">
            ← Kembali
          </button>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 340px" }}>
          {/* Drop zone */}
          <div className="card">
            <h2 className="font-semibold text-[var(--text-primary)] mb-1">Upload File Excel</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Format yang diterima: <code className="text-xs bg-[var(--surface-raised)] px-1 py-0.5 rounded">.xlsx</code>{" "}
              atau <code className="text-xs bg-[var(--surface-raised)] px-1 py-0.5 rounded">.xls</code>
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-[var(--accent)] bg-[var(--accent)]/5"
                  : "border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-raised)]"
              }`}
            >
              {parsing ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-[var(--text-muted)]">Membaca file…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                    strokeLinejoin="round" className="text-[var(--text-muted)]">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      Klik untuk pilih file atau drag &amp; drop di sini
                    </p>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                      Excel .xlsx / .xls — max 5MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onFileChange}
            />
          </div>

          {/* Instructions + template */}
          <div className="flex flex-col gap-4">
            {/* Download template */}
            <div className="card">
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">
                1. Download Template
              </h3>
              <p className="text-sm text-[var(--text-muted)] mb-3">
                Gunakan template ini agar kolom sesuai dengan format yang dibutuhkan sistem.
              </p>
              <button onClick={downloadTemplate} className="btn-pri w-full">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Template Excel
              </button>
            </div>

            {/* Column guide */}
            <div className="card">
              <h3 className="font-semibold text-[var(--text-primary)] mb-3">
                2. Isi Kolom Berikut
              </h3>
              <div className="flex flex-col gap-2">
                {[
                  { col: "name", req: true, desc: "Nama pelanggan (min 2 karakter)" },
                  { col: "customerType", req: true, desc: "RETAIL / AGEN / INDUSTRI" },
                  { col: "phone", req: false, desc: "No. telepon (max 30 karakter)" },
                  { col: "email", req: false, desc: "Email valid" },
                  { col: "address", req: false, desc: "Alamat lengkap" },
                  { col: "npwp", req: false, desc: "Nomor NPWP" },
                  { col: "creditLimitKg12", req: false, desc: "Credit limit tabung 12kg (angka)" },
                  { col: "creditLimitKg50", req: false, desc: "Credit limit tabung 50kg (angka)" },
                ].map((item) => (
                  <div key={item.col} className="flex items-start gap-2">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${
                        item.req
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-[var(--surface-raised)] text-[var(--text-muted)]"
                      }`}
                    >
                      {item.req ? "wajib" : "opsional"}
                    </span>
                    <div>
                      <code className="text-xs font-mono text-[var(--text-primary)]">{item.col}</code>
                      <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Preview step ───────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Preview Data Pelanggan</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Periksa dan koreksi data sebelum disimpan
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setStep("upload"); setRows([]); setResult(null); }}
            className="btn-gho"
            disabled={submitting}
          >
            ← Upload Ulang
          </button>
          <button
            onClick={handleSubmit}
            className="btn-pri"
            disabled={submitting || validCount === 0 || successCount === validCount}
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Menyimpan…
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Simpan {validCount} Baris Valid
              </>
            )}
          </button>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div className={`card mb-4 border-l-4 ${
          result.failed === 0 ? "border-l-green-500" : "border-l-yellow-500"
        }`}>
          <div className="flex items-start gap-4">
            <div className="flex gap-6 flex-1">
              <div>
                <p className="text-2xl font-bold text-green-600">{result.success}</p>
                <p className="text-xs text-[var(--text-muted)]">Berhasil disimpan</p>
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
              <button onClick={() => router.push("/customers")} className="btn-pri shrink-0">
                Lihat Semua Pelanggan →
              </button>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">
                Error dari server:
              </p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">
                  Baris {e.row} ({e.name}): {e.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats bar */}
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

      {/* Editable preview table */}
      <div className="card p-0">
        <div className="table-wrap overflow-x-auto">
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th>Status</th>
                <th>Nama <span className="text-red-500">*</span></th>
                <th>Tipe <span className="text-red-500">*</span></th>
                <th>Telepon</th>
                <th>Email</th>
                <th>Alamat</th>
                <th>NPWP</th>
                <th>Limit 12kg</th>
                <th>Limit 50kg</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isInvalid = !row._valid;
                const isDone = row._status === "success";
                const hasError = row._status === "error";

                return (
                  <tr
                    key={row._rowIndex}
                    className={
                      isDone
                        ? "opacity-60 bg-green-50 dark:bg-green-900/10"
                        : isInvalid
                        ? "bg-red-50 dark:bg-red-900/10"
                        : hasError
                        ? "bg-yellow-50 dark:bg-yellow-900/10"
                        : ""
                    }
                  >
                    {/* Row number */}
                    <td className="text-center text-xs text-[var(--text-muted)]">
                      {row._rowIndex}
                    </td>

                    {/* Status */}
                    <td>
                      {row._status === "success" ? (
                        <span className="badge-success">✓ Tersimpan</span>
                      ) : row._status === "submitting" ? (
                        <span className="badge-neutral">…</span>
                      ) : row._status === "error" ? (
                        <span className="badge-error" title={row._serverError}>
                          ✗ Gagal
                        </span>
                      ) : isInvalid ? (
                        <span className="badge-error" title={row._errors.join("; ")}>
                          ✗ Invalid
                        </span>
                      ) : (
                        <span className="badge-success">✓ Valid</span>
                      )}
                    </td>

                    {/* Editable fields */}
                    <EditCell
                      value={row.name}
                      invalid={!row.name || row.name.trim().length < 2}
                      disabled={isDone || submitting}
                      onChange={(v) => updateRow(i, "name", v)}
                      placeholder="Nama pelanggan"
                    />

                    {/* customerType — select */}
                    <td>
                      <select
                        className={`form-select text-xs py-1 ${
                          !VALID_TYPES.includes(row.customerType as CustomerType)
                            ? "border-red-400"
                            : ""
                        }`}
                        value={row.customerType}
                        disabled={isDone || submitting}
                        onChange={(e) => updateRow(i, "customerType", e.target.value)}
                      >
                        <option value="">Pilih tipe</option>
                        {VALID_TYPES.map((t) => (
                          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </td>

                    <EditCell value={row.phone} disabled={isDone || submitting}
                      onChange={(v) => updateRow(i, "phone", v)} placeholder="08xx" />
                    <EditCell value={row.email} disabled={isDone || submitting}
                      onChange={(v) => updateRow(i, "email", v)} placeholder="email@contoh.com"
                      invalid={!!row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)} />
                    <EditCell value={row.address} disabled={isDone || submitting}
                      onChange={(v) => updateRow(i, "address", v)} placeholder="Alamat" wide />
                    <EditCell value={row.npwp} disabled={isDone || submitting}
                      onChange={(v) => updateRow(i, "npwp", v)} placeholder="NPWP" />
                    <EditCell value={row.creditLimitKg12} disabled={isDone || submitting}
                      onChange={(v) => updateRow(i, "creditLimitKg12", v)} placeholder="0"
                      invalid={isNaN(Number(row.creditLimitKg12))} type="number" />
                    <EditCell value={row.creditLimitKg50} disabled={isDone || submitting}
                      onChange={(v) => updateRow(i, "creditLimitKg50", v)} placeholder="0"
                      invalid={isNaN(Number(row.creditLimitKg50))} type="number" />

                    {/* Remove */}
                    <td>
                      {!isDone && (
                        <button
                          onClick={() => removeRow(i)}
                          disabled={submitting}
                          className="btn-icon text-red-500 hover:text-red-700"
                          title="Hapus baris ini"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                            strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
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

        {/* Validation errors summary (for invalid rows) */}
        {rows.some((r) => !r._valid) && (
          <div className="px-4 py-3 border-t border-[var(--border)] bg-red-50 dark:bg-red-900/10">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
              Detail error (baris invalid akan dilewati saat submit):
            </p>
            {rows
              .filter((r) => !r._valid)
              .map((r) => (
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

// ── EditCell subcomponent ──────────────────────────────────────────────────
function EditCell({
  value,
  onChange,
  disabled,
  placeholder,
  invalid,
  wide,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  invalid?: boolean;
  wide?: boolean;
  type?: string;
}) {
  return (
    <td style={wide ? { minWidth: 180 } : {}}>
      <input
        type={type}
        className={`form-input text-xs py-1 w-full ${invalid ? "border-red-400" : ""}`}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </td>
  );
}