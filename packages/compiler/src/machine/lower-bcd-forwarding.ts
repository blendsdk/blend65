import type { MemoryWriteOperation, SemanticBlock } from "../semantic/operations.js";

/**
 * Select adjacent BCD values that can stay in A/AX until their only consumer.
 *
 * Constants and conversions of constants emit no machine instructions, so they do not
 * interrupt register ownership. Every other operation ends the forwarding window.
 */
export function selectBcdForwarding(
  blocks: readonly SemanticBlock[],
  singleUseValues: ReadonlySet<string>,
): {
  readonly forwardedRegisterValues: ReadonlySet<string>;
  readonly directBcdWrites: ReadonlyMap<string, MemoryWriteOperation>;
} {
  const constantValues = new Set<string>();
  for (const block of blocks) {
    for (const operation of block.operations) {
      if (operation.kind === "constant") constantValues.add(operation.result);
      else if (operation.kind === "convert" && constantValues.has(operation.operand)) {
        constantValues.add(operation.result);
      }
    }
  }
  const hasNoMachineInstruction = (operation: SemanticBlock["operations"][number]): boolean =>
    operation.kind === "constant" ||
    (operation.kind === "convert" && constantValues.has(operation.result));
  const forwardedRegisterValues = new Set<string>();
  const directBcdWrites = new Map<string, MemoryWriteOperation>();
  for (const block of blocks) {
    for (let index = 0; index < block.operations.length; index += 1) {
      const producer = block.operations[index]!;
      if (
        (producer.kind !== "memory-read" && producer.kind !== "bcd") ||
        !singleUseValues.has(producer.result)
      ) {
        continue;
      }
      let consumerIndex = index + 1;
      while (
        block.operations[consumerIndex] !== undefined &&
        hasNoMachineInstruction(block.operations[consumerIndex]!)
      ) {
        consumerIndex += 1;
      }
      const consumer = block.operations[consumerIndex];
      let precedingIndex = index - 1;
      while (
        block.operations[precedingIndex] !== undefined &&
        hasNoMachineInstruction(block.operations[precedingIndex]!)
      ) {
        precedingIndex -= 1;
      }
      const preceding = block.operations[precedingIndex];
      if (
        producer.kind === "bcd" &&
        producer.width === 2 &&
        singleUseValues.has(producer.left) &&
        constantValues.has(producer.right) &&
        preceding?.kind === "memory-read" &&
        preceding.width === 2 &&
        preceding.result === producer.left &&
        consumer?.kind === "memory-write" &&
        consumer.width === 2 &&
        consumer.value === producer.result &&
        constantValues.has(consumer.address)
      ) {
        directBcdWrites.set(producer.result, consumer);
        forwardedRegisterValues.add(producer.left);
      } else if (
        producer.kind === "memory-read" &&
        producer.width === 1 &&
        consumer?.kind === "bcd" &&
        consumer.left === producer.result &&
        constantValues.has(consumer.right)
      ) {
        forwardedRegisterValues.add(producer.result);
      } else if (
        producer.kind === "memory-read" &&
        producer.width === 1 &&
        consumer?.kind === "bcd" &&
        consumer.operator === "add" &&
        consumer.right === producer.result &&
        (constantValues.has(consumer.left) ||
          (preceding?.kind === "memory-read" && preceding.result === consumer.left))
      ) {
        forwardedRegisterValues.add(producer.result);
      } else if (
        producer.kind === "bcd" &&
        producer.width === 1 &&
        consumer?.kind === "memory-write" &&
        consumer.value === producer.result &&
        constantValues.has(consumer.address)
      ) {
        forwardedRegisterValues.add(producer.result);
      }
    }
  }
  return { forwardedRegisterValues, directBcdWrites };
}
