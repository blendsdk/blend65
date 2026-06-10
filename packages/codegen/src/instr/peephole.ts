/**
 * RD-08 peephole optimizer — passthrough v1
 * (`plans/rd-08-peephole-optimizer/03-01-peephole-passthrough.md`).
 *
 * The peephole optimizer is the second/final optimization stage of the Blend65
 * back end. It sits between codegen (`generateInstr`/`assembleProgram`, RD-07) and
 * the ACME emitter (RD-09): it consumes an {@link InstrProgram} and returns an
 * {@link InstrProgram}. In v1 it is a deliberate **thin passthrough** — it validates
 * the program's structure (R6/PF-006) and returns it unchanged.
 *
 * This module establishes the public entry point ({@link optimizeInstr}) and the
 * rule *type contract* ({@link PeepholeRule}) so future optimization rules can be
 * added without architectural change, but it applies **zero** rules. The
 * sliding-window scanner, the fixed-point iteration limit + its ICE, and the rule
 * catalog are deferred to the rules milestone (PF-005/PF-009) to avoid shipping
 * unreachable code (`code.md` Rule 4 — No Dead Code).
 *
 * The public signature threads the bare {@link CpuVariant} primitive (PF-003),
 * mirroring `generateInstr(ilProgram, cpuVariant, bag)` and `validateStream(stream,
 * cpuVariant, bag)` exactly — no `PlatformProfile` is fabricated.
 *
 * Lives in `@blend65/codegen` (R15/AR-20: never imported by the frontend/
 * language-server).
 */

import type { DiagnosticBag } from "@blend65/core";
import { IceCode } from "@blend65/core";
import type { CpuVariant, StreamEntry } from "./stream.js";
import { isInstr, isLabel, isDirective } from "./stream.js";
import type { InstrProgram } from "./instr-program.js";

/**
 * A convenience alias for an Instr-type {@link StreamEntry} — the only entry kind a
 * future peephole rule is allowed to rewrite (labels/directives pass through
 * verbatim, AC-08/AC-09).
 */
export type InstrEntry = Extract<StreamEntry, { type: "instr" }>;

/**
 * A single peephole optimization rule — the forward contract (RD §4.1, R8). **No
 * rules ship in v1**; this interface exists so rules can be layered in later without
 * changing the stage's architecture.
 *
 * A rule examines `windowSize` consecutive instruction entries and, when `match()`
 * returns true, produces a `replace()` sequence of length ≤ `windowSize` (the hard
 * size invariant, RD R10). Rules are pure functions of their window (RD R9).
 */
export interface PeepholeRule {
  /** Human-readable rule name for diagnostics/reporting (RD R8). */
  readonly name: string;
  /** Number of consecutive Instr entries this rule examines (RD R8). */
  readonly windowSize: number;
  /** Priority (lower = higher priority; applied first) (RD R12). */
  readonly priority: number;
  /** CPU variants this rule is valid for (RD R13). */
  readonly cpuCompat: readonly CpuVariant[];
  /** Test whether the window matches this rule's pattern. */
  match(window: readonly InstrEntry[]): boolean;
  /** Produce the replacement sequence (length ≤ `windowSize`). Called only after `match()`. */
  replace(window: readonly InstrEntry[]): InstrEntry[];
}

/**
 * Optimizer configuration — the `--optimize` / `--no-optimize` surface (RD R26/R27).
 */
export interface PeepholeOptions {
  /** Whether optimization is enabled. Default: enabled (omitted ⇒ enabled). */
  readonly enabled?: boolean;
}

/**
 * The v1 rule set — intentionally **empty** (RD §4.4, PF-001). The peephole stage is
 * a passthrough until concrete rules land at the rules milestone. Exported as part
 * of the stage's forward surface (and asserted by spec test ST-6).
 */
export const V1_RULES: readonly PeepholeRule[] = [];

/**
 * Assert that an {@link InstrProgram} is structurally well-formed (RD R6, PF-006).
 *
 * Checks (NOT opcode legality — that is `validateStream`'s job, already run inside
 * `generateInstr`, RD R22):
 *  1. `program.streams` is a present, non-null array.
 *  2. Every {@link StreamEntry} is a valid discriminated union — exactly one of
 *     `isInstr`/`isLabel`/`isDirective` holds.
 *  3. No `null`/`undefined` entries appear in any stream's `entries`.
 *
 * Any violation is reported as an ICE (`E90001`, {@link IceCode.Unexpected}) on the
 * diagnostic bag — never a user-band (`E10xxx`/`W10xxx`) diagnostic (RD R30). The
 * function returns normally (it does not throw) so the caller's pipeline stays
 * deterministic.
 *
 * @param program The program to validate.
 * @param bag Diagnostic sink for structural-violation ICEs.
 */
export function validateProgramStructure(program: InstrProgram, bag: DiagnosticBag): void {
  // Predicate 1: streams must be a present, non-null array.
  if (!Array.isArray(program.streams)) {
    bag.addICE(IceCode.Unexpected, null, "peephole: program.streams is not an array");
    return;
  }

  for (const stream of program.streams) {
    for (const entry of stream.entries) {
      // Predicate 3: no null/undefined entries (guarded first for a clear message).
      if (entry == null) {
        bag.addICE(
          IceCode.Unexpected,
          null,
          `peephole: null StreamEntry in stream '${stream.symbol}'`,
        );
        continue;
      }
      // Predicate 2: exactly one guard must hold for a valid discriminated union.
      const matched =
        (isInstr(entry) ? 1 : 0) + (isLabel(entry) ? 1 : 0) + (isDirective(entry) ? 1 : 0);
      if (matched !== 1) {
        bag.addICE(
          IceCode.Unexpected,
          null,
          `peephole: malformed StreamEntry in stream '${stream.symbol}'`,
        );
      }
    }
  }
}

/**
 * Apply peephole optimization to an {@link InstrProgram}. **v1 = thin passthrough**
 * (no rules; PF-001/PF-005/PF-009).
 *
 * The second parameter is the bare {@link CpuVariant} primitive (PF-003), mirroring
 * `generateInstr`/`validateStream` — a driver holding a platform plugin passes
 * `plugin.profile.cpu`. v1 validates structure (R6) and returns the input program
 * unchanged: `preamble`, `streams`, and `allocationPlan` all pass through verbatim
 * (PF-004, RD R25). When `options.enabled === false` the optimizer is a guaranteed
 * passthrough that skips even validation and returns the input reference (RD R27).
 *
 * @param program The {@link InstrProgram} from `generateInstr()` (RD-07).
 * @param _cpuVariant The target CPU primitive. Reserved for `cpuCompat` rule
 *   filtering once rules exist (RD R13); unused in v1.
 * @param bag Diagnostic sink for structural-violation ICEs (`E90001`).
 * @param options Optimizer configuration; omitted ⇒ enabled.
 * @returns The (unchanged in v1) {@link InstrProgram}.
 */
export function optimizeInstr(
  program: InstrProgram,
  _cpuVariant: CpuVariant,
  bag: DiagnosticBag,
  options?: PeepholeOptions,
): InstrProgram {
  // --no-optimize surface: guaranteed passthrough, skip even validation (RD R27).
  if (options?.enabled === false) {
    return program;
  }
  // v1: validate structure, then return verbatim. No scanner, no rules (PF-005/009).
  validateProgramStructure(program, bag);
  return program;
}
