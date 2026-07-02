/**
 * RD-09 whole-program ACME serializer — `serializeToAcme`
 * (`plans/rd-09-acme-emitter/03-01-serializer.md`, R3–R17; AR-94 1A+2A, AR-95 A).
 *
 * Orchestrates the existing per-stream {@link printInstr} into the single
 * canonical `.asm` text for an entire {@link InstrProgram}: the `!to` output-file
 * directive hoisted to the top, the symbol-definition header, the remaining
 * platform preamble (origin / BASIC stub / startup shim), then the code streams,
 * then the const-data streams. This is the **single canonical serializer**
 * (D4/AR-60/AR-63): `--emit-asm` writes this text and stops, and a full build
 * writes the same text and feeds it to ACME, so the two can never drift.
 *
 * Per D4/AR-60 there is exactly one per-entry rendering path — `printInstr`. This
 * module never re-implements instruction/label/directive rendering; it only adds
 * the whole-program structure (the `!to` hoist, the symbol header, the
 * section-separator comments) on top of `printInstr`.
 *
 * **AR-94 mapping.** Symbol definitions come verbatim from
 * `allocationPlan.symbolDefinitions`, in array order, under one
 * `; --- symbol definitions ---` header (1A). Segment order is preamble → `code`
 * streams → `data` (const) streams; `zp`-segment streams carry no emittable body
 * (already realized as header symbol defs) and are skipped, and no `bss`/`!fill`
 * region is emitted (2A).
 *
 * Pure and deterministic (R5): identical input → byte-identical, newline-
 * terminated output. Lives in `@blend65/codegen` (R15/AR-20: never imported by
 * the frontend/language-server).
 */

import { hex16, printInstr } from "./print-instr.js";
import type { InstrProgram } from "./instr-program.js";
import type { StreamEntry } from "./stream.js";

/** Header comment introducing the symbol-definition block (AR-94/1A). */
const SYMBOL_HEADER = "; --- symbol definitions ---";

/**
 * Is this entry the `!to` output-file directive? It is hoisted to the very first
 * line of the `.asm` (R14) and therefore excluded from the preamble remainder.
 *
 * @param entry The preamble stream entry to test.
 * @returns `true` when the entry is an `outputFile` directive.
 */
function isOutputFileDirective(entry: StreamEntry): boolean {
  return entry.type === "directive" && entry.directive.kind === "outputFile";
}

/**
 * Render a run of preamble entries as one indented/column-0 block via the single
 * canonical per-entry serializer. A synthetic `code` stream is used purely as the
 * `printInstr` carrier — `printInstr` ignores `symbol`/`segment` and renders only
 * the entries.
 *
 * @param entries The preamble entries to render (may be empty).
 * @returns The rendered text, or `null` when there is nothing to render.
 */
function renderPreambleBlock(entries: readonly StreamEntry[]): string | null {
  if (entries.length === 0) {
    return null;
  }
  return printInstr({ symbol: "_pre", segment: "code", entries });
}

/**
 * Serialize an {@link InstrProgram} to ACME assembler source text — the single
 * canonical serializer (R3/R4, AR-60/D4/AR-95). `--emit-asm` writes this text and
 * stops; a full build writes the same text and feeds it to ACME, so the two can
 * never drift.
 *
 * Pure and deterministic (R5): identical input → byte-identical output (newline-
 * terminated). Reuses {@link printInstr} for all per-entry rendering. Symbol defs
 * and segment order follow AR-94 (1A verbatim `symbolDefinitions`; 2A
 * `code → data`, `zp` skipped, no `bss`).
 *
 * RD-17 (PF-016): an optional pre-composed `runtimeSection` (from
 * `runtime/embed.js`) is appended verbatim as the final discrete section. The
 * serializer stays pure — it never reads files itself — and with no option the
 * output is byte-identical to the pre-RD-17 shape (R16, AC-11).
 *
 * @param program The InstrProgram from codegen/peephole (RD-07/08).
 * @param opts Optional additions: `runtimeSection` — the embedded runtime
 *   routines section text (header + module bodies), appended last.
 * @returns The complete `.asm` file content (newline-terminated).
 */
export function serializeToAcme(
  program: InstrProgram,
  opts?: { readonly runtimeSection?: string },
): string {
  const lines: string[] = [];

  // 1. `!to` output-file directive — hoisted to the very top from the preamble.
  for (const entry of program.preamble) {
    if (isOutputFileDirective(entry)) {
      lines.push(printInstr({ symbol: "_pre", segment: "code", entries: [entry] }));
    }
  }

  // 2. Symbol-definition header + verbatim entries (AR-94/1A). The header is
  //    always emitted, even when there are no symbols, for a stable shape (ST-S3).
  lines.push(SYMBOL_HEADER);
  for (const sym of program.allocationPlan.symbolDefinitions) {
    lines.push(`${sym.name} = ${hex16(sym.value)}`);
  }

  // 3. Remaining preamble (origin, BASIC stub, startup shim) — everything except `!to`.
  const preambleRest = program.preamble.filter((e) => !isOutputFileDirective(e));
  const restText = renderPreambleBlock(preambleRest);
  if (restText !== null) {
    lines.push(restText);
  }

  // 4. Code-segment streams, each under a `; --- function: <symbol> ---` comment.
  for (const stream of program.streams) {
    if (stream.segment === "code") {
      lines.push(`; --- function: ${stream.symbol} ---`);
      lines.push(printInstr(stream));
    }
  }

  // 5. Const-data streams, each under a `; --- const data: <symbol> ---` comment.
  //    `zp`-segment streams carry no emittable body and are skipped (AR-94/2A).
  for (const stream of program.streams) {
    if (stream.segment === "data") {
      lines.push(`; --- const data: ${stream.symbol} ---`);
      lines.push(printInstr(stream));
    }
  }

  // 6. Embedded runtime routines (RD-17, PF-016) — the final discrete section.
  //    Absent option → byte-identical pre-RD-17 output (R16/AC-11).
  if (opts?.runtimeSection !== undefined && opts.runtimeSection.length > 0) {
    lines.push(opts.runtimeSection);
  }

  return lines.join("\n") + "\n";
}
