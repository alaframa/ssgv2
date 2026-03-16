// lib/document-numbers.ts
// Central document number generator — reads format from .env
// All format strings support these tokens:
//   {BRANCH}  = branch code (SBY / YOG)
//   {YYYY}    = 4-digit year
//   {YY}      = 2-digit year
//   {MM}      = 2-digit month
//   {NNNN}    = 4-digit zero-padded sequence
//   {NNN}     = 3-digit zero-padded sequence
//
// Examples (set in .env):
//   FORMAT_GR=GR-{BRANCH}-{YYYY}{MM}-{NNNN}   → GR-SBY-202603-0042
//   FORMAT_CPO=CPO-{BRANCH}-{YYYY}{MM}-{NNNN}  → CPO-SBY-202603-0001
//   FORMAT_DO={MM}-{NNN}                        → 03-001
//   FORMAT_SPO=PO-{YYYY}-{MM}-{NNNN}           → PO-2026-03-0018
//   FORMAT_CLAIM=CLM-{BRANCH}-{NNNN}           → CLM-SBY-0001
//   FORMAT_RETURN=RET-{BRANCH}-{YYYY}{MM}-{NNN} → RET-SBY-202603-001
//   FORMAT_WRITEOFF=WO-{BRANCH}-{YYYY}{MM}-{NNN}→ WO-SBY-202603-001

import { prisma } from "@/lib/prisma";

// ── Default formats (used if .env var is missing) ────────────────────────────
const DEFAULTS = {
  FORMAT_GR:       "GR-{BRANCH}-{YYYY}{MM}-{NNNN}",
  FORMAT_CPO:      "CPO-{BRANCH}-{YYYY}{MM}-{NNNN}",
  FORMAT_DO:       "{MM}-{NNN}",
  FORMAT_SPO:      "PO-{YYYY}-{MM}-{NNNN}",
  FORMAT_CLAIM:    "CLM-{BRANCH}-{NNNN}",
  FORMAT_RETURN:   "RET-{BRANCH}-{YYYY}{MM}-{NNN}",
  FORMAT_WRITEOFF: "WO-{BRANCH}-{YYYY}{MM}-{NNN}",
} as const;

type FormatKey = keyof typeof DEFAULTS;

function getFormat(key: FormatKey): string {
  return process.env[key] ?? DEFAULTS[key];
}

// ── Token replacement ────────────────────────────────────────────────────────
function applyTokens(
  template: string,
  opts: {
    branch?: string;
    year?: number;
    month?: number;
    seq?: number;
    seqWidth?: number;
  }
): string {
  const { branch = "", year = new Date().getFullYear(), month = new Date().getMonth() + 1, seq = 1, seqWidth = 4 } = opts;
  const yyyy = String(year);
  const yy   = yyyy.slice(2);
  const mm   = String(month).padStart(2, "0");
  const nnnWidth = seqWidth === 3 ? 3 : 4;
  const seqStr   = String(seq).padStart(nnnWidth, "0");

  return template
    .replace(/{BRANCH}/g, branch.toUpperCase())
    .replace(/{YYYY}/g,   yyyy)
    .replace(/{YY}/g,     yy)
    .replace(/{MM}/g,     mm)
    .replace(/{NNNN}/g,   seqStr)
    .replace(/{NNN}/g,    String(seq).padStart(3, "0"));
}

// ── Sequence prefix — the part BEFORE the sequence digits ────────────────────
// Used to find the last-used number with a "startsWith" query.
function getPrefix(
  template: string,
  opts: { branch?: string; year?: number; month?: number }
): string {
  // Replace seq tokens with placeholder then split
  const withPlaceholder = template
    .replace(/{NNNN}/g, "§")
    .replace(/{NNN}/g,  "§");
  const prefix = withPlaceholder.split("§")[0];
  return applyTokens(prefix, { ...opts, seq: 0 });
}

// ── Generic sequence finder ───────────────────────────────────────────────────
async function nextSeq(
  table: "inboundReceiving" | "customerPo" | "deliveryOrder" | "supplierPo" | "gasbackClaim" | "emptyReturn" | "cylinderWriteoff",
  field: string,
  prefix: string
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record = await (prisma as any)[table].findFirst({
    where: { [field]: { startsWith: prefix } },
    orderBy: { [field]: "desc" },
    select: { [field]: true },
  });
  if (!record) return 1;
  const val: string = record[field];
  // Extract trailing digits
  const match = val.match(/(\d+)$/);
  if (!match) return 1;
  return parseInt(match[1], 10) + 1;
}

// ── Public generators ─────────────────────────────────────────────────────────

export async function generateGrNumber(branchCode: string, date = new Date()): Promise<string> {
  const fmt    = getFormat("FORMAT_GR");
  const opts   = { branch: branchCode, year: date.getFullYear(), month: date.getMonth() + 1 };
  const prefix = getPrefix(fmt, opts);
  const seq    = await nextSeq("inboundReceiving", "grNumber", prefix);
  return applyTokens(fmt, { ...opts, seq, seqWidth: fmt.includes("{NNN}") ? 3 : 4 });
}

export async function generateCpoNumber(branchCode: string, date = new Date()): Promise<string> {
  const fmt    = getFormat("FORMAT_CPO");
  const opts   = { branch: branchCode, year: date.getFullYear(), month: date.getMonth() + 1 };
  const prefix = getPrefix(fmt, opts);
  const seq    = await nextSeq("customerPo", "poNumber", prefix);
  return applyTokens(fmt, { ...opts, seq, seqWidth: fmt.includes("{NNN}") ? 3 : 4 });
}

export async function generateDoNumber(branchCode: string, date = new Date()): Promise<string> {
  const fmt    = getFormat("FORMAT_DO");
  const opts   = { branch: branchCode, year: date.getFullYear(), month: date.getMonth() + 1 };
  const prefix = getPrefix(fmt, opts);
  const seq    = await nextSeq("deliveryOrder", "doNumber", prefix);
  return applyTokens(fmt, { ...opts, seq, seqWidth: fmt.includes("{NNN}") ? 3 : 4 });
}

export async function generateSpoNumber(branchCode: string, date = new Date()): Promise<string> {
  const fmt    = getFormat("FORMAT_SPO");
  const opts   = { branch: branchCode, year: date.getFullYear(), month: date.getMonth() + 1 };
  const prefix = getPrefix(fmt, opts);
  const seq    = await nextSeq("supplierPo", "poNumber", prefix);
  return applyTokens(fmt, { ...opts, seq, seqWidth: fmt.includes("{NNN}") ? 3 : 4 });
}

export async function generateClaimNumber(branchCode: string): Promise<string> {
  const fmt    = getFormat("FORMAT_CLAIM");
  const opts   = { branch: branchCode };
  const prefix = getPrefix(fmt, opts);
  const seq    = await nextSeq("gasbackClaim", "claimNumber", prefix);
  return applyTokens(fmt, { ...opts, seq, seqWidth: fmt.includes("{NNN}") ? 3 : 4 });
}

export async function generateReturnNumber(branchCode: string, date = new Date()): Promise<string> {
  const fmt    = getFormat("FORMAT_RETURN");
  const opts   = { branch: branchCode, year: date.getFullYear(), month: date.getMonth() + 1 };
  const prefix = getPrefix(fmt, opts);
  const seq    = await nextSeq("emptyReturn", "returnNumber", prefix);
  return applyTokens(fmt, { ...opts, seq, seqWidth: fmt.includes("{NNN}") ? 3 : 4 });
}

export async function generateWriteoffNumber(branchCode: string, date = new Date()): Promise<string> {
  const fmt    = getFormat("FORMAT_WRITEOFF");
  const opts   = { branch: branchCode, year: date.getFullYear(), month: date.getMonth() + 1 };
  const prefix = getPrefix(fmt, opts);
  const seq    = await nextSeq("cylinderWriteoff", "writeoffNumber", prefix);
  return applyTokens(fmt, { ...opts, seq, seqWidth: fmt.includes("{NNN}") ? 3 : 4 });
}