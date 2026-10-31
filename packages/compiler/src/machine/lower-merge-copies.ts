import type { MachineBlock } from "./machine-types.js";
import { appendLoadA, loweringFailure, storeA } from "./lower-state.js";
import type { FunctionLoweringState } from "./lower-state.js";

/**
 * Materialize each control-flow merge on its original predecessor edge, before terminal layout.
 * @param state Existing incoming values and requested merge destinations.
 * @param loweredBlocks Blocks updated in place, preserving every existing instruction and jump.
 * @param semanticExitLabels Actual final machine label of each source predecessor.
 * @throws {Error} If an incoming value or edge-specific jump is unavailable.
 * @example appendMergeCopies(state, loweredBlocks, semanticExitLabels);
 */
export function appendMergeCopies(
  state: FunctionLoweringState,
  loweredBlocks: MachineBlock[],
  semanticExitLabels: ReadonlyMap<string, string>,
): void {
  for (const copy of state.mergeCopies) {
    const incoming = state.values.get(copy.incoming);
    const exitLabel = semanticExitLabels.get(copy.predecessor);
    if (incoming === undefined || incoming.kind === "condition" || exitLabel === undefined) {
      throw loweringFailure("Merge predecessor has no materialized incoming value", copy.source);
    }
    const blockIndex = loweredBlocks.findIndex(({ label }) => label === exitLabel);
    const block = loweredBlocks[blockIndex];
    if (block === undefined || block.terminator.kind !== "jump") {
      throw loweringFailure("Merge predecessor is not an edge-specific jump", copy.source);
    }
    const instructions = [...block.instructions];
    for (let offset = 0; offset < copy.bytes; offset += 1) {
      appendLoadA(instructions, incoming, offset, state, copy.source);
      instructions.push(storeA(copy.destination, offset, state, copy.source));
    }
    loweredBlocks[blockIndex] = Object.freeze({
      ...block,
      instructions: Object.freeze(instructions),
    });
  }
}
