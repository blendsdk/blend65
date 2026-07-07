/**
 * The typed {@link ResourceReport} — the build-resource aggregate rendered by
 * the Ch 11 §6 build summary and its JSON mirror.
 *
 * Each field group has exactly one owner: the frozen SFA
 * {@link AllocationPlan} (embedded verbatim), pre-extracted ACME artifact
 * numbers, the platform profile's budget, and the plugin's startup figures.
 * Budget values arrive as plain numbers so this module stays decoupled from
 * `platform/`.
 */

import type { SfaResourceData, StackAnalysis, ZpAllocation } from "../sfa/index.js";

/**
 * Inclusive byte addresses (not half-open), matching the display form
 * (`$0801–$0CE0`).
 */
export interface SegmentRange {
  /** First byte address of the segment (inclusive). */
  readonly start: number;
  /** Last byte address of the segment (inclusive). */
  readonly end: number;
}

/**
 * Core-resident mirror of the peephole (optimizer) statistics (core cannot
 * import codegen). Populated by the optimizer's consumers.
 */
export interface PeepholeStats {
  /** Total number of peephole rule applications. */
  readonly totalApplications: number;
  /** Per-rule application counts, keyed by rule name. */
  readonly ruleHits: ReadonlyMap<string, number>;
  /** Total bytes saved by the applied rules. */
  readonly bytesSaved: number;
  /** Total cycles saved by the applied rules. */
  readonly cyclesSaved: number;
}

/**
 * The build-resource aggregate.
 *
 * Optional fields are absent until their producing stage comes online: the
 * ACME-owned sizes/ranges arrive once the ACME pipeline wires them up, the
 * plugin-owned startup figures with the platform plugin work, and
 * `peepholeStats` with the optimizer. Renderers stage absent values as
 * zeros/placeholders — the layout never changes, only the numbers.
 */
export interface ResourceReport {
  // --- Build identity (kept in the type, not renderer options, for JSON parity) ---
  /** Platform name (e.g. `"c64"`). */
  readonly platformName: string;
  /** Output target name (e.g. `"game.prg"`). */
  readonly targetName: string;

  // --- SFA-owned (pre-ACME) — embedded verbatim, not copied ---
  /** The plan's aggregate resource data, embedded by reference. */
  readonly sfa: SfaResourceData;
  /** ZP breakdown. Undefined → category lines render zeros. */
  readonly zpAllocations?: readonly ZpAllocation[];
  /** Stack breakdown. Undefined → depth/overhead lines render zeros. */
  readonly stackAnalysis?: StackAnalysis;

  // --- ACME-owned (post-ACME; all undefined until the ACME pipeline wires them up) ---
  /** Code segment size in bytes. */
  readonly codeSize?: number;
  /** Data segment size in bytes. */
  readonly dataSize?: number;
  /** Total output binary size in bytes. */
  readonly binarySize?: number;
  /** Code segment address range. */
  readonly codeRange?: SegmentRange;
  /** Data segment address range. */
  readonly dataRange?: SegmentRange;
  /** RAM (module variables) address range. */
  readonly ramRange?: SegmentRange;
  /** SFA frame-region address range. */
  readonly framesRange?: SegmentRange;

  // --- Profile-owned ---
  /** `profile.maxBinarySize` — the platform's binary budget in bytes. */
  readonly binaryBudget: number;

  // --- Plugin-owned ---
  /** Startup routine size in bytes. */
  readonly startupSize?: number;
  /** Startup routine cost in cycles. */
  readonly startupCycles?: number;

  // --- Peephole (optimizer) ---
  /** Optimizer statistics; rendered only in the JSON mirror. */
  readonly peepholeStats?: PeepholeStats;
}
