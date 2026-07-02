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
import type { PlatformPlugin, PreambleOptions } from "@blend65/core/platform";

import type { ILProgram } from "../il/cfg.js";
import type { CpuVariant, InstrStream, StreamEntry } from "./stream.js";
import { instrByteSize } from "./print-instr.js";
import { validateStream } from "./validate.js";
import { translateFunction } from "./translate.js";
import type { TranslateOptions } from "./translate.js";

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
 * RD-17 (PF-016): the optional `opts` carries the target's ZP arg-block size
 * (+ platform id) enabling the runtime-call E10044 check; bare callers omit it
 * and the check is skipped. `assembleProgram` threads it from `plugin.profile`.
 *
 * @param ilProgram The IL program (RD-06) — carries its own `AllocationPlan` (D2).
 * @param cpuVariant The CPU target primitive selecting the RD-07a validation table.
 * @param bag Diagnostic sink: cost warnings (R60) + ICEs (R61).
 * @param opts Optional target options for the runtime-call ZP check (RD-17).
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
    // Skip functions with no IL (error tolerance / never-lowered, R59).
    const hasBody = fn.blocks.length > 0;
    if (!hasBody) {
      continue;
    }
    const stream = translateFunction(fn, plan, cpuVariant, bag, opts);
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
 * Assemble a complete, platform-prefixed program: run {@link generateInstr} for the
 * plugin's CPU variant, then populate the preamble from the plugin's `emitPreamble`
 * hook (RD-07c D2; R46/R47/R55). `generateInstr` is **unchanged** — this wrapper is
 * the additive seam RD-07b documented, so the existing RD-08/RD-09 consumers of
 * `generateInstr` are untouched.
 *
 * The wrapper derives the CPU variant from `plugin.profile.cpu` (the canonical
 * {@link CpuVariant} shared by the validation tables and the platform profiles) and
 * the {@link PreambleOptions} from the IL program (see {@link derivePreambleOptions},
 * D3). It does not alter the function streams or the allocation plan — only the
 * preamble is added.
 *
 * @param ilProgram The (optimized) IL program (RD-06) — carries its `AllocationPlan`.
 * @param plugin The active platform plugin (RD-10) — supplies the CPU variant + preamble.
 * @param bag Diagnostic sink (cost warnings + ICEs from translation).
 * @returns A frozen {@link InstrProgram} with a populated `preamble`.
 */
export function assembleProgram(
  ilProgram: ILProgram,
  plugin: PlatformPlugin,
  bag: DiagnosticBag,
): InstrProgram {
  // Reuse the unchanged back end for the function streams + validation (D2).
  // RD-17 (PF-016): thread the profile's ZP arg-block size + platform id so
  // runtime calls are checked against the real target (E10044, R35).
  const program = generateInstr(ilProgram, plugin.profile.cpu, bag, {
    zpArgBlockSize: plugin.profile.zpArgBlockSize,
    platformId: plugin.profile.platformId,
  });
  // Derive the shim/data options (D3) and ask the plugin for the preamble (RD-10).
  const options = derivePreambleOptions(ilProgram);
  const preamble = plugin.emitPreamble(options);
  return Object.freeze({
    preamble: Object.freeze([...preamble]),
    streams: program.streams,
    allocationPlan: program.allocationPlan,
  });
}

/**
 * Derive {@link PreambleOptions} from the IL program (RD-07c D3, the Half-A rule).
 *
 * SEAM (Half B): real `main`-termination + block-layout analysis is deferred — it
 * needs the multi-block CFG that RD-06 does not yet lower. The Half-A rule below is
 * correct for every program the live single-block lowering can currently produce:
 *   - `shimVariant` = `"terminating"` — the entry function's single block ends in
 *     `ret`, so the platform's terminating shim (restore + return) is always safe.
 *   - `needsBssZero` = `false` — the live `AllocationPlan` does not yet expose a
 *     distinct mutable/BSS region to key off, and the gate program has none.
 *   - `needsDataInit` = whether the program carries const/initialised data to copy.
 * When CFG lowering lands, the fall-through optimization (D8) and true termination
 * analysis replace this rule.
 *
 * @param ilProgram The IL program to derive options from.
 * @returns The preamble generation options for this slice.
 */
function derivePreambleOptions(ilProgram: ILProgram): PreambleOptions {
  return {
    projectName: "main", // FR-3: the RD-15 driver overrides this; no live driver yet.
    shimVariant: "terminating", // FR-4: Half-A rule (single-block entry ends in ret).
    needsBssZero: false, // FR-5: no distinct BSS region in the live plan/gate.
    needsDataInit: ilProgram.constData.length > 0, // FR-5: copy const data when present.
  };
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
