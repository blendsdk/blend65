/**
 * The terminal build-summary renderer — the Ch 11 §6 table.
 *
 * Geometry is the RD-11 §4.7 template transcribed verbatim (normative per
 * R43/AR-82, fixed by preflight PF-003): numbers right-align within the
 * template's field widths and wider values extend rightward. Every line always
 * prints (AR-102) — data sources that are not yet online stage as zeros and
 * `($0000–$0000)` placeholders (AR-Q16), so later slices change values only,
 * never geometry. Uncolored by design: the summary is a table, not a
 * diagnostic (§4.7 signature has no color option).
 *
 * Covers RD-11 R43–R49 · AC-18 · AR-Q6/Q11/Q15/Q16, AR-102, PF-003.
 */

import type { ResourceReport, SegmentRange } from "./resource-report.js";

/**
 * Formats an integer with hand-rolled thousands grouping (`1247 → "1,247"`).
 * Deliberately not `toLocaleString` — output must be locale-independent (H5
 * determinism, AR-Q11).
 */
function group(value: number): string {
  const digits = String(value);
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    const fromEnd = digits.length - i;
    out += digits[i];
    if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) {
      out += ",";
    }
  }
  return out;
}

/** `Math.round(used / budget × 100)`; a zero budget renders `0%` (AR-Q11). */
function pct(used: number, budget: number): number {
  return budget === 0 ? 0 : Math.round((used / budget) * 100);
}

/** One inclusive address as 4-digit uppercase hex (`$0801`); wider extends. */
function hex(address: number): string {
  return `$${address.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * A range as `($HHHH–$HHHH)` (U+2013 en dash); undefined ranges render the
 * `($0000–$0000)` placeholder (AR-Q16).
 */
function range(segment: SegmentRange | undefined): string {
  const start = segment?.start ?? 0;
  const end = segment?.end ?? 0;
  return `(${hex(start)}–${hex(end)})`;
}

/** Sums the sizes of ZP allocations in the given categories. */
function zpSum(report: ResourceReport, ...categories: string[]): number {
  let total = 0;
  for (const allocation of report.zpAllocations ?? []) {
    if (categories.includes(allocation.category)) {
      total += allocation.size;
    }
  }
  return total;
}

/**
 * Renders the resource report as the Ch 11 §6 terminal build summary (AC-18).
 *
 * @param report The assembled report (see `buildResourceReport`).
 * @returns The uncolored table text with a trailing newline (pure — never
 *   prints). `peepholeStats` is deliberately not rendered — Ch 11 §6 has no
 *   optimization line (AR-Q11); it appears only in the JSON mirror.
 */
export function renderReportTerminal(report: ResourceReport): string {
  const sfa = report.sfa;
  const stack = report.stackAnalysis;

  // RAM variables = module vars only; the frame region is its own line (R41).
  const ramVariables = sfa.ramUsed - sfa.frameRegionBytes;

  // AR-Q6: arg-block bytes fold into Compiler temps — no layout line of their own.
  const zpUser = zpSum(report, "user");
  const zpTemps = zpSum(report, "temp", "arg-block");
  const zpPointers = zpSum(report, "pointer");
  const zpIrqTemps = zpSum(report, "irq-temp");

  const lines = [
    "=== Blend65 Build Summary ===",
    `Platform: ${report.platformName}`,
    `Target: ${report.targetName}`,
    "",
    `Code segment:${group(report.codeSize ?? 0).padStart(9)} bytes ${range(report.codeRange)}`,
    `Data segment:${group(report.dataSize ?? 0).padStart(9)} bytes ${range(report.dataRange)}` +
      "  [const arrays, strings, embed data]",
    `RAM variables:${group(ramVariables).padStart(8)} bytes ${range(report.ramRange)}`,
    `SFA frames:${group(sfa.frameRegionBytes).padStart(11)} bytes ${range(report.framesRange)}` +
      `  [peak: ${group(sfa.frameRegionPeak)} bytes simultaneous]`,
    "",
    "Zero page:",
    `  User variables:${group(zpUser).padStart(4)} bytes`,
    `  Compiler temps:${group(zpTemps).padStart(4)} bytes`,
    `  Struct pointers:${group(zpPointers).padStart(3)} bytes`,
    `  IRQ temps:${group(zpIrqTemps).padStart(9)} bytes`,
    `  Total:${group(sfa.zpUsed).padStart(13)} / ${group(sfa.zpBudget)} bytes ` +
      `(${pct(sfa.zpUsed, sfa.zpBudget)}%)`,
    "",
    "Hardware stack:",
    `  Max call depth:${group(stack?.maxMainDepth ?? 0).padStart(4)} levels ` +
      `(${group(stack?.maxMainStackBytes ?? 0)} bytes)`,
    `  IRQ overhead:${group(stack?.irqOverhead ?? 0).padStart(6)} bytes`,
    `  Total peak:${group(sfa.stackWorstCase).padStart(8)} / ${group(sfa.stackBudget)} bytes ` +
      `(${pct(sfa.stackWorstCase, sfa.stackBudget)}%)`,
    "",
    `Startup routine:${group(report.startupSize ?? 0).padStart(5)} bytes, ` +
      `${group(report.startupCycles ?? 0)} cycles`,
    "",
    `Total binary:${group(report.binarySize ?? 0).padStart(9)} bytes`,
  ];

  return `${lines.join("\n")}\n`;
}
