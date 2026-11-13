import type { CompleteC64Layout } from "../artifacts/acme-validate.js";
import type { SourceSpan } from "../project/types.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { placeUses } from "../semantic/aggregate-place-proof.js";
import type { SemanticFunction, SemanticGlobal } from "../semantic/operations.js";
import type { StorageRequest } from "../storage/storage-types.js";
import { machineSuccessors } from "../machine/lower-control.js";
import type { MachineFunction } from "../machine/machine-types.js";

/** Return whether two retained source spans identify the same source bytes. */
export function sameSpan(left: SourceSpan | null, right: SourceSpan): boolean {
  return (
    left !== null &&
    left.sourceId === right.sourceId &&
    left.start === right.start &&
    left.end === right.end
  );
}

/**
 * An unused byte parameter still arrives in its ABI home, but has no source read
 * instruction. Its declaration-only lifetime needs a real entry anchor. The
 * consumer must separately prove that PC cannot be revisited before reporting
 * the ABI home as available. Used or longer lifetimes retain their normal proof.
 * @param request Actual allocated parameter request, not a reconstructed debug symbol.
 * @param semantic Original source owner, including every possible parameter reference.
 * @returns Whether only the implicit function-entry definition needs a machine anchor.
 */
export function unusedByteParameterAtEntry(
  request: StorageRequest,
  semantic: SemanticFunction | SemanticGlobal,
): boolean {
  if (
    request.storageClass !== "parameter" ||
    request.binding === null ||
    request.bytes !== 1 ||
    request.type?.kind !== "scalar" ||
    request.type.name !== "byte" ||
    !("parameters" in semantic) ||
    request.lifetime.definition.block !== semantic.entry ||
    request.lifetime.definition.operation !== 0 ||
    request.lifetime.liveAt.length !== 1 ||
    request.lifetime.liveAt[0]?.block !== semantic.entry ||
    request.lifetime.liveAt[0]?.operation !== 0
  )
    return false;
  const binding = bindingIdentityKey(request.binding);
  return (
    semantic.parameters.some((parameter) => bindingIdentityKey(parameter.id) === binding) &&
    semantic.blocks.every((block) =>
      block.operations.every((operation) =>
        placeUses(operation).every((use) => bindingIdentityKey(use.place.root) !== binding),
      ),
    )
  );
}

/**
 * Prove that a PC-only entry location cannot be reached again in this invocation.
 * Empty entry aliases do not execute an edge, but any later branch back to that
 * physical address can observe a reused home. Unknown/raw transfers stay unproved.
 * @param machine Actual placed function, including zero-byte aliases and repaired edges.
 * @returns True only when no emitted internal edge can revisit the entry instruction.
 */
export function singleVisitMachineEntry(machine: MachineFunction): boolean {
  if (machine.origin === undefined) return false;
  const blocks = new Map(machine.blocks.map((block) => [block.label, block]));
  for (const block of machine.blocks) {
    if (
      block.origin === undefined ||
      block.instructions.some(({ opcode }) =>
        ["jmp", "bcc", "bcs", "beq", "bne", "bmi", "bpl", "bvc", "bvs"].includes(opcode),
      )
    )
      return false;
    for (const target of machineSuccessors(block)) {
      const destination = blocks.get(target);
      if (destination?.origin === undefined) return false;
      if (
        destination.origin === machine.origin &&
        !(
          block.origin === machine.origin &&
          block.instructions.length === 0 &&
          block.terminator.kind === "fallthrough"
        )
      )
        return false;
    }
  }
  return true;
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
        block.label.startsWith(`${id}.boolean.`) ||
        block.label.startsWith(`${id}.copy.`) ||
        block.label.startsWith(`${id}.move.`) ||
        block.label.startsWith(`${id}.fill.`) ||
        // A switch dispatch test split into its low/high byte comparisons.
        block.label.startsWith(`${id}.switch.`) ||
        block.label.startsWith(`${id}.indirect.`) ||
        // A layout bridge belongs to the same source edge, not a new source operation.
        block.label.startsWith(`${id}.fallthrough.`) ||
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
