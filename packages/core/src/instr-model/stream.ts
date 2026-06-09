/**
 * Instruction-stream records — RD-07 §4.3, R2/R5–R7 (+ D2/D9).
 *
 * Defines the inline ACME `AcmeDirective` union (R6), the `StreamEntry`
 * discriminated union (instr | label | directive, R5/R6), and the per-function
 * `InstrStream` container (R7), plus trivial constructors and type guards.
 *
 * `StreamEntry.instr` uses the field names `opcode`/`mode` per spec §4.3 (D9).
 * Pure data + trivial constructors/guards — validation lives in `validate.ts`,
 * serialization in `print-instr.ts` (both in `@blend65/codegen`).
 *
 * Relocated to `@blend65/core` (`instr-model/`) by RD-10 D7/D8 so the platform
 * plugin interface (`PlatformPlugin`, in core) can reference `StreamEntry` /
 * `AcmeDirective` without a core→codegen dependency; `@blend65/codegen`
 * re-exports it unchanged. `CpuVariant` now lives in `./cpu-variant.ts` and is
 * re-exported here for import-path compatibility.
 */

import type { SourceSpan } from "../diagnostics/index.js";
import type { Opcode } from "./opcode.js";
import type { AddressingMode } from "./addressing-mode.js";
import type { InstrOperand } from "./operand.js";

// Re-export the canonical CpuVariant (D2) so the historical `./stream.js`
// import path — used by codegen's cpu-table/validate/translate/instr-program —
// keeps resolving `CpuVariant` from here unchanged.
export type { CpuVariant } from "./cpu-variant.js";

/**
 * An ACME assembler directive that appears inline in a stream (R6).
 *
 * These model the ACME pseudo-ops Blend65 emits: origin (`* =`), symbol
 * definitions, raw `!byte`/`!word` data, `!text` strings, `!fill` runs, and the
 * `!to` output-file directive. They are pure data; the serializer renders each
 * to its ACME syntax (03-03).
 */
export type AcmeDirective =
  | { readonly kind: "origin"; readonly address: number } // * = $0801
  | { readonly kind: "symbolDef"; readonly name: string; readonly value: number } // sym = $XXXX
  | { readonly kind: "byte"; readonly values: readonly number[] } // !byte $01, $02
  | { readonly kind: "word"; readonly values: readonly number[] } // !word $0801
  | { readonly kind: "text"; readonly text: string; readonly encoding?: string } // !text "hi"
  | { readonly kind: "fill"; readonly count: number; readonly value: number } // !fill 256, $00
  | { readonly kind: "outputFile"; readonly name: string; readonly format: string }; // !to "out.prg", cbm

/**
 * One entry in an instruction stream — a real instruction, an inline label, or
 * an inline directive (R5/R6).
 *
 * The `instr` variant uses `opcode`/`mode` field names per spec §4.3 (D9) and
 * carries an optional `sourceSpan` (model surface; span *propagation* from IL is
 * RD-07b's job, R50/R51).
 */
export type StreamEntry =
  | {
      readonly type: "instr";
      readonly opcode: Opcode;
      readonly mode: AddressingMode;
      readonly operand: InstrOperand;
      readonly sourceSpan?: SourceSpan; // model surface; propagation is RD-07b (R50/R51)
    }
  | { readonly type: "label"; readonly name: string }
  | { readonly type: "directive"; readonly directive: AcmeDirective };

/**
 * A per-function (or per-data-block) instruction stream (R7).
 *
 * `symbol` is the function or data label; `segment` classifies where the stream
 * is placed (code / initialised data / zero page); `entries` are the ordered
 * instructions, labels, and directives.
 */
export interface InstrStream {
  readonly symbol: string; // function or data label
  readonly segment: "code" | "data" | "zp";
  readonly entries: readonly StreamEntry[];
}

/**
 * Construct an `instr` stream entry (R2/§4.3, D9).
 *
 * `sourceSpan` is attached **only** when supplied, so two otherwise-identical
 * instructions compare equal under `toEqual` and serialize identically
 * (mirroring the `offset` discipline in `operand.ts`).
 *
 * @param opcode The 6502 mnemonic.
 * @param mode The addressing mode.
 * @param operand The symbolic operand.
 * @param sourceSpan Optional originating source span (RD-07b propagates these).
 * @returns An `instr` {@link StreamEntry}.
 */
export function instr(
  opcode: Opcode,
  mode: AddressingMode,
  operand: InstrOperand,
  sourceSpan?: SourceSpan,
): StreamEntry {
  return sourceSpan === undefined
    ? { type: "instr", opcode, mode, operand }
    : { type: "instr", opcode, mode, operand, sourceSpan };
}

/**
 * Construct a `label` stream entry (R5).
 *
 * @param name The label name (rendered at column 0 as `name:`).
 * @returns A `label` {@link StreamEntry}.
 */
export function label(name: string): StreamEntry {
  return { type: "label", name };
}

/**
 * Construct a `directive` stream entry (R6).
 *
 * @param d The ACME directive to wrap.
 * @returns A `directive` {@link StreamEntry}.
 */
export function directive(d: AcmeDirective): StreamEntry {
  return { type: "directive", directive: d };
}

/**
 * Type guard: is this entry an instruction? (R5)
 *
 * @param e The stream entry to classify.
 * @returns `true` and narrows to the `instr` variant when matched.
 */
export function isInstr(
  e: StreamEntry,
): e is Extract<StreamEntry, { type: "instr" }> {
  return e.type === "instr";
}

/**
 * Type guard: is this entry a label? (R5)
 *
 * @param e The stream entry to classify.
 * @returns `true` and narrows to the `label` variant when matched.
 */
export function isLabel(
  e: StreamEntry,
): e is Extract<StreamEntry, { type: "label" }> {
  return e.type === "label";
}

/**
 * Type guard: is this entry a directive? (R6)
 *
 * @param e The stream entry to classify.
 * @returns `true` and narrows to the `directive` variant when matched.
 */
export function isDirective(
  e: StreamEntry,
): e is Extract<StreamEntry, { type: "directive" }> {
  return e.type === "directive";
}
