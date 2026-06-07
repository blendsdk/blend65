/**
 * RD-07b `InstrProgram` container + `generateInstr` entry point — the top of the
 * back end (`plans/rd-07b-il-to-instr/03-03-instr-program-and-generate.md`,
 * R55–R61; D2/D7).
 *
 * `generateInstr` is the single public function RD-08 (peephole) and RD-09
 * (emitter) consume: it drives per-function translation (03-01), validates each
 * emitted stream against the target CPU table (RD-07a `validateStream`, R61), and
 * assembles a frozen {@link InstrProgram}. The `AllocationPlan` is read from the IL
 * program itself (`ilProgram.allocationPlan`, D2) — no separate plan argument — and
 * the `cpuVariant` primitive selects the validation table (D2); no `PlatformProfile`
 * is fabricated. The platform `preamble` (origin/`!to`/symbol defs) is **empty** in
 * this slice and filled by RD-07c + RD-10.
 *
 * Lives in `@blend65/codegen` (R15/AR-20: never imported by the frontend/
 * language-server).
 */

import type { DiagnosticBag } from "@blend65/core";
import type { AllocationPlan } from "@blend65/core";

import type { ILProgram } from "../il/cfg.js";
import type { CpuVariant, InstrStream, StreamEntry } from "./stream.js";
import { instrByteSize } from "./print-instr.js";
import { validateStream } from "./validate.js";
import { translateFunction } from "./translate.js";

/**
 * The assembled instruction program — the back end's output (R55–R57).
 *
 * `preamble` is present but **empty** in the 07b slice (the platform plugin that
 * fills origin/`!to`/symbol-definition directives is RD-07c + RD-10). `streams`
 * holds one {@link InstrStream} per translated function in deterministic order, and
 * `allocationPlan` is carried through from the IL program for the emitter's symbol
 * definitions (R57).
 */
export interface InstrProgram {
  /** Platform plugin preamble (origin/`!to`/symbol defs) — EMPTY in 07b (RD-07c). */
  readonly preamble: readonly StreamEntry[];
  /** One stream per translated function (live set), in deterministic order. */
  readonly streams: readonly InstrStream[];
  /** The SFA plan carried from the IL program (RD-05) for the emitter (R57). */
  readonly allocationPlan: AllocationPlan;
}

/**
 * Translate the (optimized) IL program into a validated {@link InstrProgram}
 * (R55, R59, R61; D2).
 *
 * Per function: a function with no blocks/instructions (skipped during lowering,
 * R59) yields no stream; otherwise it is translated (03-01) with a fresh register
 * binder, the emitted stream is validated against the CPU table (R61 — an illegal
 * opcode+mode is an `E90001` codegen bug), and pushed onto `streams`. Stream order
 * follows `ilProgram.functions` (deterministic, R17/AC-06). The returned program is
 * frozen.
 *
 * @param ilProgram The IL program (RD-06) — carries its own `AllocationPlan` (D2).
 * @param cpuVariant The CPU target primitive selecting the RD-07a validation table.
 * @param bag Diagnostic sink: cost warnings (R60) + ICEs (R61).
 * @returns The frozen {@link InstrProgram}.
 */
export function generateInstr(
  ilProgram: ILProgram,
  cpuVariant: CpuVariant,
  bag: DiagnosticBag,
): InstrProgram {
  const plan = ilProgram.allocationPlan;
  const streams: InstrStream[] = [];

  for (const fn of ilProgram.functions) {
    // Skip functions with no IL (error tolerance / never-lowered, R59).
    const hasBody = fn.blocks.length > 0;
    if (!hasBody) {
      continue;
    }
    const stream = translateFunction(fn, plan, cpuVariant, bag);
    // Post-translation validation: every emitted opcode+mode must be CPU-legal
    // for the variant; an illegal pair is an E90001 codegen bug (R61/FR-22).
    validateStream(stream, cpuVariant, bag);
    streams.push(stream);
  }

  return Object.freeze({
    preamble: Object.freeze([]),
    streams: Object.freeze(streams),
    allocationPlan: plan,
  });
}

/**
 * The assembled ROM byte size of a program: the sum of {@link instrByteSize} over
 * every entry of every stream (plus the preamble, empty here). Feeds the RD-11
 * `ResourceReport` pre-ACME (R58; Ch 11 §6).
 *
 * @param program The instruction program to size.
 * @returns The total number of bytes the program's instructions assemble to.
 */
export function programByteSize(program: InstrProgram): number {
  let total = 0;
  for (const entry of program.preamble) {
    total += instrByteSize(entry);
  }
  for (const stream of program.streams) {
    for (const entry of stream.entries) {
      total += instrByteSize(entry);
    }
  }
  return total;
}
