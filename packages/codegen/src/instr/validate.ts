/**
 * CPU instruction validation — RD-07 §4.8, R14–R16/R61 (+ D6).
 *
 * Answers one question for every `Instr`: *is this opcode legal in this
 * addressing mode on the active CPU?* A violation means codegen produced an
 * instruction the target CPU cannot execute — a **compiler bug**, never a user
 * error (R15). It is therefore reported as an `E90001` internal compiler error
 * (D6) through the {@link DiagnosticBag}; the validator never throws (H5).
 *
 * This module makes "no undefined behavior" and "NMOS never emits 65C02-only
 * modes" (R16) *tested properties* of 07a rather than promises deferred to 07b.
 */

import { IceCode } from "@blend65/core";
import type { DiagnosticBag } from "@blend65/core";
import type { Opcode } from "./opcode.js";
import type { AddressingMode } from "./addressing-mode.js";
import type { CpuVariant, InstrStream } from "./stream.js";
import { cpuTableFor } from "./cpu-table.js";

/**
 * Returns whether `opcode` is legal in `mode` on `cpuVariant` (§4.8).
 *
 * Pure, total predicate: an opcode absent from the variant's table (e.g. a
 * 65C02-only opcode on NMOS) yields `false` rather than throwing. Used by the
 * validator and, later, by RD-07b/RD-08 to check a candidate instruction before
 * emitting it.
 *
 * @param opcode The mnemonic to check.
 * @param mode The addressing mode to check.
 * @param cpuVariant The target CPU variant.
 * @returns `true` if the (opcode, mode) pair is legal on the variant.
 */
export function isLegalMode(
  opcode: Opcode,
  mode: AddressingMode,
  cpuVariant: CpuVariant,
): boolean {
  const legal = cpuTableFor(cpuVariant).get(opcode);
  return legal !== undefined && legal.has(mode);
}

/**
 * Validates every instruction entry in `stream` against the active CPU's
 * legality table (R14–R16).
 *
 * Each illegal opcode+mode pair is recorded as an `E90001` ICE (D6) whose
 * message names the offending opcode, mode, and variant (R61), carrying the
 * instruction's `sourceSpan` when present (R50). Labels and directives have no
 * opcode and are skipped (R5/R6). The validator is total and never throws — all
 * failure surfaces as a recorded diagnostic the build can inspect (H5).
 *
 * @param stream The instruction stream to validate.
 * @param cpuVariant The target CPU variant.
 * @param bag The diagnostic bag that accumulates any ICEs.
 */
export function validateStream(
  stream: InstrStream,
  cpuVariant: CpuVariant,
  bag: DiagnosticBag,
): void {
  for (const entry of stream.entries) {
    // Only instruction entries carry an opcode/mode to validate.
    if (entry.type !== "instr") {
      continue;
    }
    if (!isLegalMode(entry.opcode, entry.mode, cpuVariant)) {
      bag.addICE(
        IceCode.Unexpected,
        entry.sourceSpan ?? null,
        `illegal opcode+mode for ${cpuVariant}: ${entry.opcode} ${entry.mode}`,
      );
    }
  }
}
