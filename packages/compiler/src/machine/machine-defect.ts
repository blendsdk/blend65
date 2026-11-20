import type { SourceSpan } from "../project/types.js";

/**
 * Evidence placeholder for a refusal that cannot name the function or block it came from.
 *
 * Reporting a refusal matters more than naming its origin, so a check without an origin still
 * produces a defect. Formatters leave this out of the message instead of printing it.
 */
export const UNKNOWN_MACHINE_SITE = "unknown";

/** The part of an instruction a defect reports about. */
export interface MachineDefectInstruction {
  /** Lowercase mnemonic of the failing instruction. */
  readonly opcode: string;
  /** Source that selected it, when one exists. */
  readonly source: SourceSpan | null;
}

/** The part of a block a defect reports about: its label and its instructions in order. */
export interface MachineDefectBlock {
  /** Stable link label of the generated block. */
  readonly label: string;
  /** Instructions in execution order; the first carrying a span locates the whole block. */
  readonly instructions: readonly MachineDefectInstruction[];
}

/** One failing check, before it is turned into shared defect evidence. */
export interface MachineDefectSite {
  /** Failed check, phrased for whoever wrote the source. */
  readonly reason: string;
  /** Owning function's link identity. */
  readonly functionId: string;
  /** Block label the check belongs to. */
  readonly label: string;
  /** The block itself, when the program provided a body for that label. */
  readonly block?: MachineDefectBlock;
  /** The failing instruction, absent when a terminator or the block structure is at fault. */
  readonly instruction?: MachineDefectInstruction;
}

/**
 * First check a bound machine program fails, with the source construct it belongs to.
 *
 * A refusal at this stage reports a limitation of the compiler rather than a mistake in the
 * program, and the target has no debugger to inspect afterwards. So the machine layer records
 * which check failed and where the failing instruction came from, and a service turns that into
 * a diagnostic an author can act on. The reason and the span carry the message; the remaining
 * fields are generated-code evidence for a bug report and never belong in the primary sentence,
 * because a generated label means nothing to whoever wrote the source.
 */
export interface MachineProgramDefect {
  /** Human-readable failed check, phrased without internal labels. */
  readonly reason: string;
  /** Source that selected the failing instruction, when one exists. */
  readonly source: SourceSpan | null;
  /** Owning function's link identity. */
  readonly functionId: string;
  /** Block label; bug-report evidence, never part of the primary message. */
  readonly blockLabel: string;
  /** Failing opcode, or null when the terminator or block structure is at fault. */
  readonly opcode: string | null;
}

/**
 * Build defect evidence for one failing check, resolving the closest honest span.
 *
 * Span order is the failing instruction's own source, then the first instruction in its block
 * that carries one. Generated code need not carry a span at all, and a null span is reported as
 * such: naming the stage is better than pointing at an unrelated line.
 *
 * The inputs are described structurally rather than by the machine program types, so this stays
 * a leaf module that every layer carrying a defect can depend on.
 *
 * @param site The failing check, its owning function and whatever block or instruction is known.
 * @returns Immutable evidence for a service to format.
 * @example machineProgramDefect({ reason: "…", functionId: "fn.main", label: "fn.main.entry" })
 */
export function machineProgramDefect(site: MachineDefectSite): MachineProgramDefect {
  const blockSpan =
    site.block?.instructions.find((instruction) => instruction.source !== null)?.source ?? null;
  return Object.freeze({
    reason: site.reason,
    source: site.instruction?.source ?? blockSpan,
    functionId: site.functionId,
    blockLabel: site.label,
    opcode: site.instruction?.opcode ?? null,
  });
}
