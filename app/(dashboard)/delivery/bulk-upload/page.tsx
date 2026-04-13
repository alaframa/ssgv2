// app/(dashboard)/delivery/bulk-upload/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/lib/branch-context";
import { useSession } from "next-auth/react";
import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────
interface CpoOption {
  id: string;
  poNumber: string;
  status: string;
  kg12Qty: number;
  kg50Qty: number;
  kg12Released: number; // already released to DOs
  kg50Released: number;
  customerName: string;
  customerCode: string;
}

interface EmployeeOption {
  id: string;
  displayName: string;
}

interface RowData {
  _rowIndex: number;
  cpoNumber: string;
  doDate: string;
  kg12Released: string;
  kg50Released: string;
  driverName: string;   // display name string — resolved to ID
  vehicleNo: string;
  supplierPoRef: string;
  notes: string;
  // resolved
  _cpoId: string | null;
  _cpoStatus: string | null;
  _cpoCustomer: string | null;
  _cpoRemaining12: number | null;
  _cpoRemaining50: number | null;
  _driverId: string | null;
  // validation
  _errors: string[];
  _valid: boolean;
  _status: "idle" | "submitting" | "success" | "error";
  _serverError?: string;
}

// ── Validation ─────────────────────────────────────────────────────────────
function validateRow(row: RowData): string[] {
  const errors: string[] = [];

  if (!row.cpoNumber || row.cpoNumber.trim().length === 0) {
    errors.push("Nomor CPO wajib diisi");
  } else if (!row._cpoId) {
    errors.push(`CPO "${row.cpoNumber}" tidak ditemukan di sistem`);
  } else if (row._cpoStatus !== "CONFIRMED") {
    errors.push(
      `CPO harus berstatus CONFIRMED (saat ini: ${row._cpoStatus ?? "—"})`
    );
  }

  if (!row.doDate) {
    errors.push("Tanggal DO wajib diisi");
  } else if (isNaN(Date.parse(row.doDate))) {
    errors.push("Format tanggal tidak valid (gunakan YYYY-MM-DD)");
  }

  const qty12 = parseInt(row.kg12Released) || 0;
  const qty50 = parseInt(row.kg50Released) || 0;

  if (row.kg12Released && isNaN(Number(row.kg12Released)))
    errors.push("Qty 12kg harus angka");
  if (row.kg50Released && isNaN(Number(row.kg50Released)))
    errors.push("Qty 50kg harus angka");
  if (qty12 === 0 && qty50 === 0)
    errors.push("Minimal salah satu qty (12kg atau 50kg) harus lebih dari 0");

  // Check remaining CPO qty — only if CPO resolved
  if (row._cpoId && row._cpoStatus === "CONFIRMED") {
    if (row._cpoRemaining12 !== null && qty12 > row._cpoRemaining12)
      errors.push(
        `Qty 12kg (${qty12}) melebihi sisa CPO (${row._cpoRemaining12})`
      );
    if (row._cpoRemaining50 !== null && qty50 > row._cpoRemaining50)
      errors.push(
        `Qty 50kg (${qty50}) melebihi sisa CPO (${row._cpoRemaining50})`
      );
  }

  return errors;
}

// ── Template ───────────────────────────────────────────────────────────────
function downloadTemplate() {
  const headers = [
    "cpoNumber",
    "doDate",
    "kg12Released",
    "kg50Released",
    "driverName",
    "vehicleNo",
    "supplierPoRef",
    "notes",
  ];
  const example = [
    "CPO-SBY-202506-0001",
    "2025-06-15",
    "50",
    "10",
    "BUDI",
    "B 1234 XYZ",
    "",
    "Catatan opsional",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = [
    { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 28 },
  ];
  // Add header notes
  ws["A1"].c = [{ a: "System", t: "Nomor CPO yang sudah CONFIRMED" }];
  ws["B1"].c = [{ a: "System", t: "Format: YYYY-MM-DD" }];
  ws["E1"].c = [{ a: "System", t: "Display name driver (opsional)" }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DeliveryOrders");
  XLSX.writeFile(wb, "template_bulk_delivery_order.xlsx");
}

// ── Parse Excel (raw only, no resolution yet) ──────────────────────────────
function parseExcel(
  file: File
): Promise<Omit<RowData, "_cpoId" | "_cpoStatus" | "_cpoCustomer" | "_cpoRemaining12" | "_cpoRemaining50" | "_driverId">[]> {
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
          cpoNumber: col(["cponumber", "cpo_number", "no_cpo", "no. cpo", "po_number", "ponumber"]),
          doDate: col(["dodate", "do_date", "tanggal_do", "tgl do", "tanggal"]),
          kg12Released: col(["kg12released", "kg12_released", "qty_12kg", "12kg", "qty12"]),
          kg50Released: col(["kg50released", "kg50_released", "qty_50kg", "50kg", "qty50"]),
          driverName: col(["drivername", "driver_name", "driver", "nama_driver"]),
          vehicleNo: col(["vehicleno", "vehicle_no", "no_kendaraan", "plat", "vehicle"]),
          supplierPoRef: col(["supplierporef", "supplier_po_ref", "ref_spo", "spo_ref"]),
          notes: col(["notes", "catatan", "note", "keterangan"]),
        };

        const get = (r: any[], c: number) => c >= 0 ? String(r[c] ?? "").trim() : "";

        const rows: any[] = [];
        for (let i = 1; i < raw.length; i++) {
          const r = raw[i] as any[];
          if (r.every((c) => c === "" || c == null)) continue;

          // Handle Excel date serial numbers for doDate
          let doDate = get(r, COL.doDate);
          if (doDate && !isNaN(Number(doDate))) {
            // Excel serial date → JS date
            const excelDate = new Date(Math.round((Number(doDate) - 25569) * 86400 * 1000));
            doDate = excelDate.toISOString().split("T")[0];
          }

          rows.push({
            _rowIndex: i + 1,
            cpoNumber: get(r, COL.cpoNumber),
            doDate,
            kg12Released: get(r, COL.kg12Released) || "0",
            kg50Released: get(r, COL.kg50Released) || "0",
            driverName: get(r, COL.driverName),
            vehicleNo: get(r, COL.vehicleNo),
            supplierPoRef: get(r, COL.supplierPoRef),
            notes: get(r, COL.notes),
            _errors: [],
            _valid: false,
            _status: "idle" as const,
          });
        }
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── Component ───────────────────────────────────────────────────────────────
export default function DeliveryBulkUploadPage() {
  const { data: session } = useSession();
  const { activeBranchId } = useBranch();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [rows, setRows] = useState<RowData[]>([]);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Lookup caches
  const [cpoCache, setCpoCache] = useState<Record<string, CpoOption>>({});
  const [driverCache, setDriverCache] = useState<Record<string, EmployeeOption>>({});
  const [cacheLoading, setCacheLoading] = useState(false);

  const [result, setResult] = useState<{
    success: number; failed: number; ignored: number;
    errors: { row: number; cpo: string; reason: string }[];
  } | null>(null);

  const branchId =
    session?.user?.role === "SUPER_ADMIN"
      ? activeBranchId
      : session?.user?.branchId ?? null;

  // ── Fetch CPOs (CONFIRMED only) and Employees (drivers) ──────────────
  const fetchCaches = useCallback(async () => {
    if (!branchId) return;
    setCacheLoading(true);
    try {
      // Fetch ALL confirmed CPOs for this branch (paginated)
      const allCpos: CpoOption[] = [];
      let cpoPage = 1;
      while (true) {
        const res = await fetch(
          `/api/customer-po?branchId=${branchId}&status=CONFIRMED&page=${cpoPage}&limit=100`
        );
        if (!res.ok) break;
        const data = await res.json();
        const records = data.records ?? [];
        for (const c of records) {
          // Calculate already-released qty from existing DOs on this CPO
          // We'll get this from a separate call per CPO lazily, or approximate from the record
          // The CPO record from the list endpoint doesn't include released — we'll fetch DO totals separately
          allCpos.push({
            id: c.id,
            poNumber: c.poNumber,
            status: c.status,
            kg12Qty: c.kg12Qty,
            kg50Qty: c.kg50Qty,
            kg12Released: 0, // will be enriched below
            kg50Released: 0,
            customerName: c.customer?.name ?? "",
            customerCode: c.customer?.code ?? "",
          });
        }
        if (cpoPage >= data.pages) break;
        cpoPage++;
      }

      // Fetch released totals for each CPO via delivery-orders
      // Batch: fetch DOs grouped by CPO — we use the existing GET with customerPoId filter
      // To avoid N+1, fetch all DOs for this branch and aggregate client-side
      const doRes = await fetch(
        `/api/delivery-orders?branchId=${branchId}&limit=1000&page=1`
      );
      if (doRes.ok) {
        const doData = await doRes.json();
        const doRecords: any[] = doData.records ?? [];
        const released: Record<string, { kg12: number; kg50: number }> = {};
        for (const d of doRecords) {
          if (d.status === "CANCELLED") continue;
          if (!released[d.customerPoId]) released[d.customerPoId] = { kg12: 0, kg50: 0 };
          released[d.customerPoId].kg12 += d.kg12Released;
          released[d.customerPoId].kg50 += d.kg50Released;
        }
        for (const cpo of allCpos) {
          cpo.kg12Released = released[cpo.id]?.kg12 ?? 0;
          cpo.kg50Released = released[cpo.id]?.kg50 ?? 0;
        }
      }

      const cCache: Record<string, CpoOption> = {};
      for (const c of allCpos) cCache[c.poNumber.toUpperCase()] = c;
      setCpoCache(cCache);

      // Fetch employees (drivers)
      const empRes = await fetch(
        `/api/employees?branchId=${branchId}&role=DRIVER&page=1`
      );
      const dCache: Record<string, EmployeeOption> = {};
      if (empRes.ok) {
        const empData = await empRes.json();
        for (const e of empData.employees ?? []) {
          dCache[e.displayName.toUpperCase()] = { id: e.id, displayName: e.displayName };
        }
      }
      setDriverCache(dCache);
    } finally {
      setCacheLoading(false);
    }
  }, [branchId]);

  useEffect(() => { if (branchId) fetchCaches(); }, [branchId, fetchCaches]);

  // ── Resolve a raw row against the caches ──────────────────────────────
  const resolveRow = useCallback(
    (raw: Omit<RowData, "_cpoId" | "_cpoStatus" | "_cpoCustomer" | "_cpoRemaining12" | "_cpoRemaining50" | "_driverId">): RowData => {
      const cpoKey = raw.cpoNumber.trim().toUpperCase();
      const cpo = cpoCache[cpoKey] ?? null;

      const driverKey = raw.driverName.trim().toUpperCase();
      const driver = driverCache[driverKey] ?? null;

      const row: RowData = {
        ...raw,
        _cpoId: cpo?.id ?? null,
        _cpoStatus: cpo?.status ?? null,
        _cpoCustomer: cpo ? `${cpo.customerName} (${cpo.customerCode})` : null,
        _cpoRemaining12: cpo ? cpo.kg12Qty - cpo.kg12Released : null,
        _cpoRemaining50: cpo ? cpo.kg50Qty - cpo.kg50Released : null,
        _driverId: driver?.id ?? null,
      };
      row._errors = validateRow(row);
      row._valid = row._errors.length === 0;
      return row;
    },
    [cpoCache, driverCache]
  );

  // Re-resolve when caches load
  useEffect(() => {
    if (step === "preview" && rows.length > 0) {
      setRows((prev) =>
        prev.map((r) =>
          resolveRow({
            _rowIndex: r._rowIndex,
            cpoNumber: r.cpoNumber,
            doDate: r.doDate,
            kg12Released: r.kg12Released,
            kg50Released: r.kg50Released,
            driverName: r.driverName,
            vehicleNo: r.vehicleNo,
            supplierPoRef: r.supplierPoRef,
            notes: r.notes,
            _errors: [],
            _valid: false,
            _status: r._status,
            _serverError: r._serverError,
          })
        )
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpoCache, driverCache]);

  // ── File handling ──────────────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        alert("Harap upload file Excel (.xlsx / .xls)");
        return;
      }
      setParsing(true);
      try {
        const parsed = await parseExcel(file);
        if (parsed.length === 0) { alert("File kosong."); return; }
        const resolved = parsed.map(resolveRow);
        setRows(resolved);
        setResult(null);
        setStep("preview");
      } catch {
        alert("Gagal membaca file.");
      } finally {
        setParsing(false);
      }
    },
    [resolveRow]
  );

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
      const updated = resolveRow({
        ...next[index],
        [field]: value,
        // Reset status fields so resolveRow can re-run cleanly
        _errors: [],
        _valid: false,
      });
      // Preserve submit status for already-done rows
      updated._status = next[index]._status === "success" ? "success" : "idle";
      updated._serverError = undefined;
      next[index] = updated;
      return next;
    });
  };

  const removeRow = (index: number) =>
    setRows((prev) => prev.filter((_, i) => i !== index));

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!branchId) { alert("Pilih cabang terlebih dahulu."); return; }

    const validRows = rows.filter((r) => r._valid && r._status !== "success");
    if (validRows.length === 0) { alert("Tidak ada baris valid."); return; }

    setSubmitting(true);
    setRows((prev) =>
      prev.map((r) =>
        r._valid && r._status !== "success" ? { ...r, _status: "submitting" } : r
      )
    );

    let successCount = 0;
    const failedErrors: { row: number; cpo: string; reason: string }[] = [];

    for (const row of validRows) {
      try {
        const res = await fetch("/api/delivery-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId,
            customerPoId: row._cpoId,
            doDate: row.doDate,
            kg12Released: parseInt(row.kg12Released) || 0,
            kg50Released: parseInt(row.kg50Released) || 0,
            driverId: row._driverId ?? null,
            vehicleNo: row.vehicleNo || null,
            supplierPoRef: row.supplierPoRef || null,
            notes: row.notes || null,
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
          failedErrors.push({ row: row._rowIndex, cpo: row.cpoNumber, reason });
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
        failedErrors.push({ row: row._rowIndex, cpo: row.cpoNumber, reason });
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
      ignored: rows.filter((r) => !r._valid).length,
      errors: failedErrors,
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
            <h1 className="page-title">Bulk Upload Delivery Order</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Upload file Excel untuk membuat banyak DO sekaligus
            </p>
          </div>
          <button onClick={() => router.back()} className="btn-gho">← Kembali</button>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 340px" }}>
          <div className="card">
            <h2 className="font-semibold text-[var(--text-primary)] mb-1">Upload File Excel</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Format:{" "}
              <code className="text-xs bg-[var(--surface-raised)] px-1 py-0.5 rounded">.xlsx</code>{" "}
              atau{" "}
              <code className="text-xs bg-[var(--surface-raised)] px-1 py-0.5 rounded">.xls</code>
            </p>

            {cacheLoading && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[var(--surface-raised)] rounded-lg">
                <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin shrink-0" />
                <p className="text-xs text-[var(--text-muted)]">
                  Memuat data CPO dan driver dari cabang…
                </p>
              </div>
            )}

            <div
              onClick={() => !cacheLoading && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (!cacheLoading) setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                cacheLoading
                  ? "border-[var(--border)] opacity-50 cursor-not-allowed"
                  : isDragging
                  ? "border-[var(--accent)] bg-[var(--accent)]/5 cursor-pointer"
                  : "border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-raised)] cursor-pointer"
              }`}
            >
              {parsing ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-[var(--text-muted)]">Membaca dan memvalidasi file…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                    strokeLinejoin="round" className="text-[var(--text-muted)]">
                    <rect x="1" y="3" width="15" height="13" rx="2" />
                    <path d="M16 8l5 5-5 5" />
                    <path d="M21 13H9" />
                  </svg>
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      Klik untuk pilih file atau drag &amp; drop
                    </p>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                      {cacheLoading
                        ? "Tunggu data CPO selesai dimuat…"
                        : "Excel .xlsx / .xls — Nomor CPO akan divalidasi otomatis"}
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

          <div className="flex flex-col gap-4">
            <div className="card">
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">
                1. Download Template
              </h3>
              <p className="text-sm text-[var(--text-muted)] mb-3">
                Gunakan nomor CPO yang sudah <strong>CONFIRMED</strong>.
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

            <div className="card">
              <h3 className="font-semibold text-[var(--text-primary)] mb-3">
                2. Isi Kolom Berikut
              </h3>
              <div className="flex flex-col gap-2">
                {[
                  { col: "cpoNumber", req: true, desc: "Nomor CPO yang sudah CONFIRMED (contoh: CPO-SBY-202506-0001)" },
                  { col: "doDate", req: true, desc: "Tanggal DO, format YYYY-MM-DD" },
                  { col: "kg12Released", req: false, desc: "Jumlah tabung 12kg yang dirilis" },
                  { col: "kg50Released", req: false, desc: "Jumlah tabung 50kg (salah satu wajib > 0)" },
                  { col: "driverName", req: false, desc: "Display name driver (harus terdaftar sebagai karyawan)" },
                  { col: "vehicleNo", req: false, desc: "Nomor plat kendaraan" },
                  { col: "supplierPoRef", req: false, desc: "Referensi SPO (opsional)" },
                  { col: "notes", req: false, desc: "Catatan tambahan" },
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
                      <code className="text-xs font-mono text-[var(--text-primary)]">
                        {item.col}
                      </code>
                      <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Qty tidak boleh melebihi sisa alokasi CPO. Server juga akan mengecek
                  kuota tabung aktif pelanggan.
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
          <h1 className="page-title">Preview Delivery Orders</h1>
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
                Simpan {validCount} DO Valid
              </>
            )}
          </button>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div
          className={`card mb-4 border-l-4 ${
            result.failed === 0 ? "border-l-green-500" : "border-l-yellow-500"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="flex gap-6 flex-1">
              <div>
                <p className="text-2xl font-bold text-green-600">{result.success}</p>
                <p className="text-xs text-[var(--text-muted)]">DO berhasil dibuat</p>
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
              <button
                onClick={() => router.push("/delivery")}
                className="btn-pri shrink-0"
              >
                Lihat Semua DO →
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
                  Baris {e.row} ({e.cpo}): {e.reason}
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
          <table className="data-table" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th>Status</th>
                <th>No. CPO <span className="text-red-500">*</span></th>
                <th>Pelanggan / CPO Info</th>
                <th>Tgl DO <span className="text-red-500">*</span></th>
                <th>Qty 12kg</th>
                <th>Qty 50kg</th>
                <th>Driver</th>
                <th>No. Kendaraan</th>
                <th>Ref SPO</th>
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
                  : isInvalid
                  ? "bg-red-50 dark:bg-red-900/10"
                  : hasError
                  ? "bg-yellow-50 dark:bg-yellow-900/10"
                  : "";

                return (
                  <tr key={row._rowIndex} className={rowCls}>
                    <td className="text-center text-xs text-[var(--text-muted)]">
                      {row._rowIndex}
                    </td>

                    {/* Status badge */}
                    <td>
                      {row._status === "success" ? (
                        <span className="badge-success">✓ Tersimpan</span>
                      ) : row._status === "submitting" ? (
                        <span className="badge-neutral">…</span>
                      ) : row._status === "error" ? (
                        <span className="badge-error" title={row._serverError}>✗ Gagal</span>
                      ) : isInvalid ? (
                        <span className="badge-error" title={row._errors.join("; ")}>✗ Invalid</span>
                      ) : (
                        <span className="badge-success">✓ Valid</span>
                      )}
                    </td>

                    {/* CPO number — editable */}
                    <td style={{ minWidth: 200 }}>
                      <input
                        type="text"
                        className={`form-input text-xs py-1 font-mono w-full ${
                          row.cpoNumber && !row._cpoId ? "border-red-400" : ""
                        }`}
                        value={row.cpoNumber}
                        disabled={isDone || submitting}
                        placeholder="CPO-SBY-YYYYMM-NNNN"
                        onChange={(e) => updateRow(i, "cpoNumber", e.target.value)}
                      />
                    </td>

                    {/* CPO resolved info */}
                    <td style={{ minWidth: 180 }}>
                      {row._cpoId ? (
                        <div>
                          <p className="text-xs font-medium text-green-700 dark:text-green-400">
                            ✓ {row._cpoCustomer}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)]">
                            Sisa: 12kg={row._cpoRemaining12} · 50kg={row._cpoRemaining50}
                          </p>
                          {row._cpoStatus !== "CONFIRMED" && (
                            <p className="text-[10px] text-red-600 font-semibold">
                              Status: {row._cpoStatus}
                            </p>
                          )}
                        </div>
                      ) : row.cpoNumber ? (
                        <span className="text-xs text-red-600">Tidak ditemukan</span>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">—</span>
                      )}
                    </td>

                    {/* doDate */}
                    <td>
                      <input
                        type="date"
                        className={`form-input text-xs py-1 w-36 ${
                          !row.doDate || isNaN(Date.parse(row.doDate)) ? "border-red-400" : ""
                        }`}
                        value={row.doDate}
                        disabled={isDone || submitting}
                        onChange={(e) => updateRow(i, "doDate", e.target.value)}
                      />
                    </td>

                    {/* kg12Released */}
                    <td>
                      <input
                        type="number"
                        min="0"
                        className={`form-input text-xs py-1 w-20 ${
                          row._cpoRemaining12 !== null &&
                          (parseInt(row.kg12Released) || 0) > row._cpoRemaining12
                            ? "border-red-400"
                            : ""
                        }`}
                        value={row.kg12Released}
                        disabled={isDone || submitting}
                        onChange={(e) => updateRow(i, "kg12Released", e.target.value)}
                      />
                    </td>

                    {/* kg50Released */}
                    <td>
                      <input
                        type="number"
                        min="0"
                        className={`form-input text-xs py-1 w-20 ${
                          row._cpoRemaining50 !== null &&
                          (parseInt(row.kg50Released) || 0) > row._cpoRemaining50
                            ? "border-red-400"
                            : ""
                        }`}
                        value={row.kg50Released}
                        disabled={isDone || submitting}
                        onChange={(e) => updateRow(i, "kg50Released", e.target.value)}
                      />
                    </td>

                    {/* driver — text input, shows resolved name */}
                    <td style={{ minWidth: 130 }}>
                      <input
                        type="text"
                        className={`form-input text-xs py-1 w-full ${
                          row.driverName && !row._driverId
                            ? "border-yellow-400"  // warning not error — driver is optional
                            : ""
                        }`}
                        value={row.driverName}
                        disabled={isDone || submitting}
                        placeholder="Display name"
                        title={
                          row.driverName && !row._driverId
                            ? "Nama driver tidak ditemukan di sistem — akan dikirim tanpa driverId"
                            : ""
                        }
                        onChange={(e) => updateRow(i, "driverName", e.target.value)}
                      />
                      {row._driverId && (
                        <p className="text-[10px] text-green-600 mt-0.5">✓ Ditemukan</p>
                      )}
                    </td>

                    {/* vehicleNo */}
                    <td>
                      <input
                        type="text"
                        className="form-input text-xs py-1 w-28"
                        value={row.vehicleNo}
                        disabled={isDone || submitting}
                        placeholder="B 1234 XY"
                        onChange={(e) => updateRow(i, "vehicleNo", e.target.value)}
                      />
                    </td>

                    {/* supplierPoRef */}
                    <td>
                      <input
                        type="text"
                        className="form-input text-xs py-1 w-28"
                        value={row.supplierPoRef}
                        disabled={isDone || submitting}
                        placeholder="Ref SPO"
                        onChange={(e) => updateRow(i, "supplierPoRef", e.target.value)}
                      />
                    </td>

                    {/* notes */}
                    <td style={{ minWidth: 160 }}>
                      <input
                        type="text"
                        className="form-input text-xs py-1 w-full"
                        value={row.notes}
                        disabled={isDone || submitting}
                        placeholder="Catatan"
                        onChange={(e) => updateRow(i, "notes", e.target.value)}
                      />
                    </td>

                    {/* Remove */}
                    <td>
                      {!isDone && (
                        <button
                          onClick={() => removeRow(i)}
                          disabled={submitting}
                          className="btn-icon text-red-500 hover:text-red-700"
                          title="Hapus baris"
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

        {/* Error summary */}
        {rows.some((r) => !r._valid) && (
          <div className="px-4 py-3 border-t border-[var(--border)] bg-red-50 dark:bg-red-900/10">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
              Detail error (baris invalid akan dilewati saat submit):
            </p>
            {rows
              .filter((r) => !r._valid)
              .map((r) => (
                <p key={r._rowIndex} className="text-xs text-red-600">
                  Baris {r._rowIndex} ({r.cpoNumber || "—"}): {r._errors.join(" · ")}
                </p>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}