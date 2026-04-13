// app/(dashboard)/employees/bulk-upload/page.tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/lib/branch-context";
import { useSession } from "next-auth/react";
import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────
type RoleType =
  | "DRIVER" | "KENEK" | "WAREHOUSE" | "ADMIN"
  | "FINANCE" | "SALES" | "BRANCH_MANAGER" | "MECHANIC" | "OTHER";

const VALID_ROLES: RoleType[] = [
  "DRIVER", "KENEK", "WAREHOUSE", "ADMIN",
  "FINANCE", "SALES", "BRANCH_MANAGER", "MECHANIC", "OTHER",
];

const ROLE_LABELS: Record<string, string> = {
  DRIVER: "Driver", KENEK: "Kenek", WAREHOUSE: "Gudang",
  ADMIN: "Admin", FINANCE: "Finance", SALES: "Sales",
  BRANCH_MANAGER: "Kepala Cabang", MECHANIC: "Mekanik", OTHER: "Lainnya",
};

interface RowData {
  _rowIndex: number;
  fullName: string;
  displayName: string;
  rolesRaw: string;        // comma-separated string from Excel
  joinDate: string;
  notes: string;
  // derived
  _roles: RoleType[];
  _errors: string[];
  _valid: boolean;
  _status: "idle" | "submitting" | "success" | "error";
  _serverError?: string;
}

// ── Validation ─────────────────────────────────────────────────────────────
function parseRoles(raw: string): { valid: RoleType[]; invalid: string[] } {
  const parts = raw.split(/[,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
  const valid: RoleType[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    if (VALID_ROLES.includes(p as RoleType)) valid.push(p as RoleType);
    else invalid.push(p);
  }
  return { valid, invalid };
}

function validateRow(row: RowData): string[] {
  const errors: string[] = [];
  if (!row.fullName || row.fullName.trim().length < 2)
    errors.push("Nama lengkap minimal 2 karakter");
  if (!row.displayName || row.displayName.trim().length < 1)
    errors.push("Display name wajib diisi");
  const { valid, invalid } = parseRoles(row.rolesRaw);
  if (valid.length === 0)
    errors.push(`Role wajib diisi. Nilai valid: ${VALID_ROLES.join(", ")}`);
  if (invalid.length > 0)
    errors.push(`Role tidak dikenal: ${invalid.join(", ")}`);
  if (row.joinDate && isNaN(Date.parse(row.joinDate)))
    errors.push("Format tanggal masuk tidak valid (gunakan YYYY-MM-DD)");
  return errors;
}

// ── Template ───────────────────────────────────────────────────────────────
function downloadTemplate() {
  const headers = ["fullName", "displayName", "roles", "joinDate", "notes"];
  const example = ["Budi Santoso", "BUDI", "DRIVER,KENEK", "2024-01-15", "Catatan opsional"];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = headers.map(() => ({ wch: 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Karyawan");
  XLSX.writeFile(wb, "template_bulk_karyawan.xlsx");
}

// ── Parse Excel ────────────────────────────────────────────────────────────
function parseExcel(file: File): Promise<RowData[]> {
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
          fullName: col(["fullname", "nama_lengkap", "full_name", "nama lengkap"]),
          displayName: col(["displayname", "display_name", "display name", "nama panggilan"]),
          roles: col(["roles", "role", "jabatan"]),
          joinDate: col(["joindate", "join_date", "tanggal_masuk", "tgl masuk"]),
          notes: col(["notes", "catatan", "note"]),
        };

        const get = (r: any[], c: number) => c >= 0 ? String(r[c] ?? "").trim() : "";

        const rows: RowData[] = [];
        for (let i = 1; i < raw.length; i++) {
          const r = raw[i] as any[];
          if (r.every((c) => c === "" || c == null)) continue;
          const row: RowData = {
            _rowIndex: i + 1,
            fullName: get(r, COL.fullName),
            displayName: get(r, COL.displayName),
            rolesRaw: get(r, COL.roles),
            joinDate: get(r, COL.joinDate),
            notes: get(r, COL.notes),
            _roles: [],
            _errors: [],
            _valid: false,
            _status: "idle",
          };
          row._errors = validateRow(row);
          row._roles = parseRoles(row.rolesRaw).valid;
          row._valid = row._errors.length === 0;
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
export default function EmployeesBulkUploadPage() {
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
    errors: { row: number; name: string; reason: string }[];
  } | null>(null);

  const branchId =
    session?.user?.role === "SUPER_ADMIN"
      ? activeBranchId
      : session?.user?.branchId ?? null;

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) { alert("Harap upload file Excel (.xlsx / .xls)"); return; }
    setParsing(true);
    try {
      const parsed = await parseExcel(file);
      if (parsed.length === 0) { alert("File kosong atau tidak ada data."); return; }
      setRows(parsed); setResult(null); setStep("preview");
    } catch { alert("Gagal membaca file."); }
    finally { setParsing(false); }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = "";
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  };

  const revalidateRow = (row: RowData): RowData => {
    const errors = validateRow(row);
    const roles = parseRoles(row.rolesRaw).valid;
    return { ...row, _errors: errors, _roles: roles, _valid: errors.length === 0 };
  };

  const updateRow = (index: number, field: keyof RowData, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = revalidateRow({ ...next[index], [field]: value });
      return next;
    });
  };

  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!branchId) { alert("Pilih cabang terlebih dahulu."); return; }
    const validRows = rows.filter((r) => r._valid && r._status !== "success");
    if (validRows.length === 0) { alert("Tidak ada baris valid."); return; }

    setSubmitting(true);
    setRows((prev) =>
      prev.map((r) => r._valid && r._status !== "success" ? { ...r, _status: "submitting" } : r)
    );

    let successCount = 0;
    const failedErrors: { row: number; name: string; reason: string }[] = [];

    for (const row of validRows) {
      try {
        const res = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId,
            fullName: row.fullName.trim(),
            displayName: row.displayName.trim(),
            roles: row._roles,
            joinDate: row.joinDate || null,
            notes: row.notes || null,
            isActive: true,
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
          failedErrors.push({ row: row._rowIndex, name: row.fullName, reason });
          setRows((prev) =>
            prev.map((r) =>
              r._rowIndex === row._rowIndex ? { ...r, _status: "error", _serverError: reason } : r
            )
          );
        }
      } catch {
        failedErrors.push({ row: row._rowIndex, name: row.fullName, reason: "Gagal terhubung ke server" });
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
            <h1 className="page-title">Bulk Upload Karyawan</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Upload file Excel untuk menambah banyak karyawan sekaligus
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
                  <p className="text-sm text-[var(--text-muted)]">Membaca file…</p>
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
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls"
              className="hidden" onChange={onFileChange} />
          </div>

          <div className="flex flex-col gap-4">
            <div className="card">
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">1. Download Template</h3>
              <p className="text-sm text-[var(--text-muted)] mb-3">
                Gunakan template ini agar kolom sesuai sistem.
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
                  { col: "fullName", req: true, desc: "Nama lengkap karyawan" },
                  { col: "displayName", req: true, desc: "Nama panggilan / singkatan" },
                  { col: "roles", req: true, desc: "DRIVER, KENEK, WAREHOUSE, ADMIN, FINANCE, SALES, BRANCH_MANAGER, MECHANIC, OTHER — pisah koma jika lebih dari satu" },
                  { col: "joinDate", req: false, desc: "Tanggal masuk, format YYYY-MM-DD" },
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
          <h1 className="page-title">Preview Data Karyawan</h1>
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
                Simpan {validCount} Baris Valid
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
              <button onClick={() => router.push("/employees")} className="btn-pri shrink-0">
                Lihat Semua Karyawan →
              </button>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Error dari server:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">
                  Baris {e.row} ({e.name}): {e.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-6">
          {[
            { label: `${rows.length} total baris`, color: "bg-[var(--text-muted)]" },
            { label: `${validCount} valid`, color: "bg-green-500" },
            ...(invalidCount > 0 ? [{ label: `${invalidCount} invalid (akan dilewati)`, color: "bg-red-500" }] : []),
            ...(successCount > 0 ? [{ label: `${successCount} tersimpan`, color: "bg-blue-500" }] : []),
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
              <span className="text-sm text-[var(--text-muted)]"
                dangerouslySetInnerHTML={{ __html: s.label.replace(/^\d+/, (n) => `<strong class="text-[var(--text-primary)]">${n}</strong>`) }} />
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        <div className="table-wrap overflow-x-auto">
          <table className="data-table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th>Status</th>
                <th>Nama Lengkap <span className="text-red-500">*</span></th>
                <th>Display Name <span className="text-red-500">*</span></th>
                <th>Role(s) <span className="text-red-500">*</span></th>
                <th>Tgl Masuk</th>
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

                    {/* fullName */}
                    <td>
                      <input type="text"
                        className={`form-input text-xs py-1 w-full ${!row.fullName || row.fullName.trim().length < 2 ? "border-red-400" : ""}`}
                        value={row.fullName} disabled={isDone || submitting} placeholder="Nama lengkap"
                        onChange={(e) => updateRow(i, "fullName", e.target.value)} />
                    </td>

                    {/* displayName */}
                    <td>
                      <input type="text"
                        className={`form-input text-xs py-1 w-full ${!row.displayName ? "border-red-400" : ""}`}
                        value={row.displayName} disabled={isDone || submitting} placeholder="NAMA"
                        onChange={(e) => updateRow(i, "displayName", e.target.value)} />
                    </td>

                    {/* roles — multi-select chips */}
                    <td style={{ minWidth: 200 }}>
                      <div className="flex flex-col gap-1">
                        <input type="text"
                          className={`form-input text-xs py-1 w-full ${row._errors.some(e => e.includes("Role")) ? "border-red-400" : ""}`}
                          value={row.rolesRaw} disabled={isDone || submitting}
                          placeholder="DRIVER,SALES"
                          onChange={(e) => updateRow(i, "rolesRaw", e.target.value)} />
                        {row._roles.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {row._roles.map((r) => (
                              <span key={r} className="text-[10px] bg-[var(--surface-raised)] text-[var(--text-muted)] px-1.5 py-0.5 rounded">
                                {ROLE_LABELS[r]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* joinDate */}
                    <td>
                      <input type="date"
                        className={`form-input text-xs py-1 w-full ${row.joinDate && isNaN(Date.parse(row.joinDate)) ? "border-red-400" : ""}`}
                        value={row.joinDate} disabled={isDone || submitting}
                        onChange={(e) => updateRow(i, "joinDate", e.target.value)} />
                    </td>

                    {/* notes */}
                    <td>
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