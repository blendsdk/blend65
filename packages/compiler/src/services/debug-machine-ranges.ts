import type { CompleteC64Layout } from "../artifacts/acme-validate.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticFunction } from "../semantic/operations.js";

/** Return whether two retained source spans identify the same source bytes. */
export function sameSpan(left: SourceSpan | null, right: SourceSpan): boolean {
  return (
    left !== null &&
    left.sourceId === right.sourceId &&
    left.start === right.start &&
    left.end === right.end
  );
}

/** Return the exact emitted byte count of one final machine terminator. */
function terminatorBytes(
  terminator: CompleteC64Layout["program"]["functions"][number]["blocks"][number]["terminator"],
): number {
  if (terminator.kind === "branch") return 2;
  if (terminator.kind === "long-branch") return 5;
  if (terminator.kind === "jump") return 3;
  if (terminator.kind === "return") return terminator.cost?.bytes ?? 1;
  return 0;
}

/** Map final instruction bytes back to their retained semantic CFG positions. */
export function machineFunctionSegments(
  machine: CompleteC64Layout["program"]["functions"][number],
  semantic: Pick<SemanticFunction, "blocks" | "source">,
): readonly {
  readonly start: number;
  readonly end: number;
  readonly block: string;
  readonly operation: number | null;
  readonly source: SourceSpan;
}[] {
  const segments: {
    readonly start: number;
    readonly end: number;
    readonly block: string;
    readonly operation: number | null;
    readonly source: SourceSpan;
  }[] = [];
  for (const block of machine.blocks) {
    if (block.origin === undefined) throw new Error("Final machine block has no origin");
    const sourceBlock = semantic.blocks.find(
      ({ id }) =>
        block.label === id ||
        block.label.startsWith(`${id}.main.`) ||
        block.label.startsWith(`${id}.irq`) ||
        block.label.startsWith(`${id}.nmi`) ||
        block.label.startsWith(`${id}.interrupt.`) ||
        block.label.startsWith(`${id}.fn.`) ||
        block.label.startsWith(`${id}.wait.`) ||
        block.label.startsWith(`${id}.shift.`) ||
        block.label.startsWith(`${id}.multiply.`) ||
        block.label.startsWith(`${id}.divide.`) ||
        block.label.startsWith(`${id}.copy.`) ||
        block.label.startsWith(`${id}.move.`) ||
        block.label.startsWith(`${id}.fill.`) ||
        block.label.startsWith(`${id}.indirect.`) ||
        block.label.startsWith(`${id}.bounds.`),
    );
    if (sourceBlock === undefined) throw new Error("Final machine block has no semantic CFG owner");
    let address = block.origin;
    for (const instruction of block.instructions) {
      const operation = sourceBlock.operations.findIndex((candidate) =>
        sameSpan(instruction.source, candidate.span),
      );
      segments.push(
        Object.freeze({
          start: address,
          end: address + instruction.cost.bytes,
          block: sourceBlock.id,
          operation: operation < 0 ? null : operation,
          source: instruction.source ?? semantic.source,
        }),
      );
      address += instruction.cost.bytes;
    }
    const bytes = terminatorBytes(block.terminator);
    if (bytes > 0) {
      segments.push(
        Object.freeze({
          start: address,
          end: address + bytes,
          block: sourceBlock.id,
          operation: sourceBlock.operations.length,
          source: semantic.source,
        }),
      );
    }
  }
  return Object.freeze(segments);
}
