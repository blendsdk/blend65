/**
 * The `InstrProgram` container + `generateInstr` entry point — the top of the
 * back end.
 *
 * `generateInstr` is the single public function the peephole optimizer and the
 * ACME emitter consume: it drives per-function translation, validates each
 * emitted stream against the target CPU table (`validateStream`), and
 * assembles a frozen {@link InstrProgram}. The `AllocationPlan` is read from the IL
 * program itself (`ilProgram.allocationPlan`) — no separate plan argument — and
 * the `cpuVariant` primitive selects the validation table; no `PlatformProfile`
 * is fabricated. The platform `preamble` (origin/`!to`/symbol defs) is **empty**
 * at this stage and filled in by {@link assembleProgram}.
 *
 * Lives in `@blend65/codegen` (never imported by the frontend/
 * language-server).
 */

import type { DiagnosticBag } from "@blend65/core";
import type { AllocationPlan } from "@blend65/core";
import type { PlatformPlugin, PreambleOptions } from "@blend65/core/platform";

import type { ILProgram } from "../il/cfg.js";
import type { CpuVariant, InstrStream, StreamEntry } from "./stream.js";
import { instrByteSize } from "./print-instr.js";
import { validateStream } from "./validate.js";
import { translateFunction } from "./translate.js";
import type { TranslateOptions } from "./translate.js";

/**
 * The assembled instruction program — the back end's output.
 *
 * `preamble` is present but **empty** at this stage (the platform plugin that
 * fills origin/`!to`/symbol-definition directives runs separately, in
 * {@link assembleProgram}). `streams` holds one {@link InstrStream} per translated
 * function in deterministic order, and `allocationPlan` is carried through
 * from the IL program for the emitter's symbol definitions.
 */
export interface InstrProgram {
  /** Platform plugin preamble (origin/`!to`/symbol defs) — EMPTY until {@link assembleProgram} populates it. */
  readonly preamble: readonly StreamEntry[];
  /** One stream per translated function (live set), in deterministic order. */
  readonly streams: readonly InstrStream[];
  /** The SFA plan carried from the IL program for the emitter. */
  readonly allocationPlan: AllocationPlan;
}

/**
 * Translate the (optimized) IL program into a validated {@link InstrProgram}.
 *
 * Per function: a function with no blocks/instructions (skipped during
 * lowering) yields no stream; otherwise it is translated with a fresh register
 * binder, the emitted stream is validated against the CPU table (an illegal
 * opcode+mode is an `E90001` codegen bug), and pushed onto `streams`. Stream
 * order follows `ilProgram.functions` (deterministic). The returned program is
 * frozen.
 *
 * The optional `opts` carries the target's ZP arg-block size (+ platform id)
 * enabling the runtime-call E10044 check; bare callers omit it and the check
 * is skipped. `assembleProgram` threads it from `plugin.profile`.
 *
 * @param ilProgram The IL program — carries its own `AllocationPlan`.
 * @param cpuVariant The CPU target primitive selecting the validation table.
 * @param bag Diagnostic sink: cost warnings + ICEs.
 * @param opts Optional target options for the runtime-call ZP check.
 * @returns The frozen {@link InstrProgram}.
 */
export function generateInstr(
  ilProgram: ILProgram,
  cpuVariant: CpuVariant,
  bag: DiagnosticBag,
  opts?: TranslateOptions,
): InstrProgram {
  const plan = ilProgram.allocationPlan;
  const streams: InstrStream[] = [];

  for (const fn of ilProgram.functions) {
    // Skip functions with no IL (error tolerance / never-lowered).
    const hasBody = fn.blocks.length > 0;
    if (!hasBody) {
      continue;
    }
    const stream = translateFunction(fn, plan, cpuVariant, bag, opts);
    // Post-translation validation: every emitted opcode+mode must be CPU-legal
    // for the variant; an illegal pair is an E90001 codegen bug.
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
 * Assemble a complete, platform-prefixed program: run {@link generateInstr} for the
 * plugin's CPU variant, then populate the preamble from the plugin's `emitPreamble`
 * hook. `generateInstr` is **unchanged** — this wrapper is an additive seam, so
 * the existing consumers of `generateInstr` are untouched.
 *
 * The wrapper derives the CPU variant from `plugin.profile.cpu` (the canonical
 * {@link CpuVariant} shared by the validation tables and the platform profiles) and
 * the {@link PreambleOptions} from the IL program (see {@link derivePreambleOptions}).
 * It does not alter the function streams or the allocation plan — only the
 * preamble is added.
 *
 * @param ilProgram The (optimized) IL program — carries its `AllocationPlan`.
 * @param plugin The active platform plugin — supplies the CPU variant + preamble.
 * @param bag Diagnostic sink (cost warnings + ICEs from translation).
 * @param overrides The driver seam: the effective `projectName`
 *   (`--out-name` → the `!to` directive) and `shimVariant` (`--startup`), each
 *   merged over {@link derivePreambleOptions} only when defined. Omitting it (or
 *   leaving a field undefined) keeps the Half-A defaults, so existing
 *   consumers of the 3-arg form are untouched (additive).
 * @returns A frozen {@link InstrProgram} with a populated `preamble`.
 */
export function assembleProgram(
  ilProgram: ILProgram,
  plugin: PlatformPlugin,
  bag: DiagnosticBag,
  overrides?: Partial<Pick<PreambleOptions, "projectName" | "shimVariant">>,
): InstrProgram {
  // Reuse the unchanged back end for the function streams + validation.
  // Thread the profile's ZP arg-block size + platform id so runtime calls
  // are checked against the real target (E10044).
  const program = generateInstr(ilProgram, plugin.profile.cpu, bag, {
    zpArgBlockSize: plugin.profile.zpArgBlockSize,
    platformId: plugin.profile.platformId,
  });
  // Derive the shim/data options, then apply the driver overrides for
  // any field the driver set, and ask the plugin for the preamble.
  const options: PreambleOptions = {
    ...derivePreambleOptions(ilProgram),
    ...(overrides?.projectName !== undefined ? { projectName: overrides.projectName } : {}),
    ...(overrides?.shimVariant !== undefined ? { shimVariant: overrides.shimVariant } : {}),
  };
  const preamble = plugin.emitPreamble(options);
  return Object.freeze({
    preamble: Object.freeze([...preamble]),
    streams: program.streams,
    allocationPlan: program.allocationPlan,
  });
}

/**
 * Derive {@link PreambleOptions} from the IL program (the Half-A rule).
 *
 * SEAM (Half B): real `main`-termination + block-layout analysis is deferred — it
 * needs the multi-block CFG that IL lowering does not yet produce. The Half-A
 * rule below is correct for every program the live single-block lowering can
 * currently produce:
 *   - `shimVariant` = `"terminating"` — the entry function's single block ends in
 *     `ret`, so the platform's terminating shim (restore + return) is always safe.
 *   - `needsBssZero` = `false` — the live `AllocationPlan` does not yet expose a
 *     distinct mutable/BSS region to key off, and the gate program has none.
 *   - `needsDataInit` = whether the program carries const/initialised data to copy.
 * When CFG lowering lands, a fall-through optimization and true termination
 * analysis replace this rule.
 *
 * @param ilProgram The IL program to derive options from.
 * @returns The preamble generation options for this slice.
 */
function derivePreambleOptions(ilProgram: ILProgram): PreambleOptions {
  return {
    projectName: "main", // the driver overrides this; no live driver yet.
    shimVariant: "terminating", // Half-A rule (single-block entry ends in ret).
    needsBssZero: false, // no distinct BSS region in the live plan/gate.
    needsDataInit: ilProgram.constData.length > 0, // copy const data when present.
  };
}

/**
 * The assembled ROM byte size of a program: the sum of {@link instrByteSize} over
 * every entry of every stream (plus the preamble, empty here). Feeds the
 * `ResourceReport` pre-ACME budget check.
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
