/**
 * CPU instruction validation.
 *
 * Answers one question for every `Instr`: *is this opcode legal in this
 * addressing mode on the active CPU?* A violation means codegen produced an
 * instruction the target CPU cannot execute — a **compiler bug**, never a user
 * error. It is therefore reported as an `E90001` internal compiler error
 * through the {@link DiagnosticBag}; the validator never throws.
 *
 * This module makes "no undefined behavior" and "NMOS never emits 65C02-only
 * modes" tested properties rather than promises deferred to later work.
 */

import { IceCode } from "@blend65/core";
import type { DiagnosticBag } from "@blend65/core";
import type { Opcode } from "./opcode.js";
import type { AddressingMode } from "./addressing-mode.js";
import type { CpuVariant, InstrStream } from "./stream.js";
import { cpuTableFor } from "./cpu-table.js";

/**
 * Returns whether `opcode` is legal in `mode` on `cpuVariant`.
 *
 * Pure, total predicate: an opcode absent from the variant's table (e.g. a
 * 65C02-only opcode on NMOS) yields `false` rather than throwing. Used by the
 * validator and, later, by the IL→Instr translator and peephole optimizer to
 * check a candidate instruction before emitting it.
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
 * legality table.
 *
 * Each illegal opcode+mode pair is recorded as an `E90001` ICE whose message
 * names the offending opcode, mode, and variant, carrying the instruction's
 * `sourceSpan` when present. Labels and directives have no opcode and are
 * skipped. The validator is total and never throws — all failure surfaces as
 * a recorded diagnostic the build can inspect.
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
