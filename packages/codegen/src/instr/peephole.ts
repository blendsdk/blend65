/**
 * The peephole optimizer — passthrough v1.
 *
 * The peephole optimizer is the second/final optimization stage of the Blend65
 * back end. It sits between codegen (`generateInstr`/`assembleProgram`) and
 * the ACME emitter: it consumes an {@link InstrProgram} and returns an
 * {@link InstrProgram}. In v1 it is a deliberate **thin passthrough** — it validates
 * the program's structure and returns it unchanged.
 *
 * This module establishes the public entry point ({@link optimizeInstr}) and the
 * rule *type contract* ({@link PeepholeRule}) so future optimization rules can be
 * added without architectural change, but it applies **zero** rules. The
 * sliding-window scanner, the fixed-point iteration limit + its ICE, and the rule
 * catalog are deferred to a later milestone to avoid shipping unreachable code
 * (`code.md` Rule 4 — No Dead Code).
 *
 * The public signature threads the bare {@link CpuVariant} primitive, mirroring
 * `generateInstr(ilProgram, cpuVariant, bag)` and `validateStream(stream,
 * cpuVariant, bag)` exactly — no `PlatformProfile` is fabricated.
 *
 * Lives in `@blend65/codegen` (never imported by the frontend/
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
 * verbatim).
 */
export type InstrEntry = Extract<StreamEntry, { type: "instr" }>;

/**
 * A single peephole optimization rule — the forward contract. **No
 * rules ship in v1**; this interface exists so rules can be layered in later without
 * changing the stage's architecture.
 *
 * A rule examines `windowSize` consecutive instruction entries and, when `match()`
 * returns true, produces a `replace()` sequence of length ≤ `windowSize` (the hard
 * size invariant). Rules are pure functions of their window.
 */
export interface PeepholeRule {
  /** Human-readable rule name for diagnostics/reporting. */
  readonly name: string;
  /** Number of consecutive Instr entries this rule examines. */
  readonly windowSize: number;
  /** Priority (lower = higher priority; applied first). */
  readonly priority: number;
  /** CPU variants this rule is valid for. */
  readonly cpuCompat: readonly CpuVariant[];
  /** Test whether the window matches this rule's pattern. */
  match(window: readonly InstrEntry[]): boolean;
  /** Produce the replacement sequence (length ≤ `windowSize`). Called only after `match()`. */
  replace(window: readonly InstrEntry[]): InstrEntry[];
}

/**
 * Optimizer configuration — the `--optimize` / `--no-optimize` surface.
 */
export interface PeepholeOptions {
  /** Whether optimization is enabled. Default: enabled (omitted ⇒ enabled). */
  readonly enabled?: boolean;
}

/**
 * The v1 rule set — intentionally **empty**. The peephole stage is
 * a passthrough until concrete rules land at a later milestone. Exported as
 * part of the stage's forward surface.
 */
export const V1_RULES: readonly PeepholeRule[] = [];

/**
 * Assert that an {@link InstrProgram} is structurally well-formed.
 *
 * Checks (NOT opcode legality — that is `validateStream`'s job, already run inside
 * `generateInstr`):
 *  1. `program.streams` is a present, non-null array.
 *  2. Every {@link StreamEntry} is a valid discriminated union — exactly one of
 *     `isInstr`/`isLabel`/`isDirective` holds.
 *  3. No `null`/`undefined` entries appear in any stream's `entries`.
 *
 * Any violation is reported as an ICE (`E90001`, {@link IceCode.Unexpected}) on the
 * diagnostic bag — never a user-band (`E10xxx`/`W10xxx`) diagnostic. The
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
 * (no rules).
 *
 * The second parameter is the bare {@link CpuVariant} primitive, mirroring
 * `generateInstr`/`validateStream` — a driver holding a platform plugin passes
 * `plugin.profile.cpu`. v1 validates structure and returns the input program
 * unchanged: `preamble`, `streams`, and `allocationPlan` all pass through
 * verbatim. When `options.enabled === false` the optimizer is a guaranteed
 * passthrough that skips even validation and returns the input reference.
 *
 * @param program The {@link InstrProgram} from `generateInstr()`.
 * @param _cpuVariant The target CPU primitive. Reserved for `cpuCompat` rule
 *   filtering once rules exist; unused in v1.
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
  // --no-optimize surface: guaranteed passthrough, skip even validation.
  if (options?.enabled === false) {
    return program;
  }
  // v1: validate structure, then return verbatim. No scanner, no rules yet.
  validateProgramStructure(program, bag);
  return program;
}
