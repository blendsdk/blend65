import type { MemoryWriteOperation, SemanticBlock } from "../semantic/operations.js";
import { typeBytes } from "./lower-state.js";

/**
 * Select adjacent byte loads, collision/joystick samples and BCD values that can stay in registers
 * until their only consumer.
 *
 * Constants and conversions of constants emit no machine instructions, so they do not
 * interrupt register ownership. Every other operation ends the forwarding window.
 */
export function selectRegisterForwarding(
  blocks: readonly SemanticBlock[],
  singleUseValues: ReadonlySet<string>,
): {
  /** Values whose sole adjacent consumer can use their still-live registers. */
  readonly forwardedRegisterValues: ReadonlySet<string>;
  /** Word decimal results constructed directly in their final fixed-address destination. */
  readonly directBcdWrites: ReadonlyMap<string, MemoryWriteOperation>;
  /** Second byte operands read into X to preserve the first operand in A. */
  readonly subtractRightInX: ReadonlySet<string>;
  /** First word-add operands whose high byte survives the second read in Y. */
  readonly wordAddLeftHighInY: ReadonlySet<string>;
  /** First word-subtract operands whose high byte survives the second read in Y. */
  readonly wordSubtractLeftHighInY: ReadonlySet<string>;
  /** Second word-subtract operands needing one low-byte staging home. */
  readonly wordSubtractRightLowStaged: ReadonlySet<string>;
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
  // Constant expressions carry identities but emit nothing, so they do not break adjacency.
  const nextMachineOperation = (
    block: SemanticBlock,
    index: number,
  ): SemanticBlock["operations"][number] | undefined => {
    let next = index + 1;
    while (
      block.operations[next] !== undefined &&
      hasNoMachineInstruction(block.operations[next]!)
    ) {
      next += 1;
    }
    return block.operations[next];
  };
  const forwardedRegisterValues = new Set<string>();
  const directBcdWrites = new Map<string, MemoryWriteOperation>();
  const subtractRightInX = new Set<string>();
  const wordAddLeftHighInY = new Set<string>();
  const wordSubtractLeftHighInY = new Set<string>();
  const wordSubtractRightLowStaged = new Set<string>();
  for (const block of blocks) {
    for (let index = 0; index < block.operations.length; index += 1) {
      const producer = block.operations[index]!;
      if (
        (producer.kind !== "load" &&
          producer.kind !== "memory-read" &&
          producer.kind !== "bcd" &&
          (producer.kind !== "platform" ||
            (producer.capability !== "c64.input.readJoystick1" &&
              producer.capability !== "c64.input.readJoystick2" &&
              producer.capability !== "c64.vic.readAndClearSpriteSpriteCollisions" &&
              producer.capability !== "c64.vic.readAndClearSpriteBackgroundCollisions"))) ||
        producer.result === null ||
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
      const following = nextMachineOperation(block, consumerIndex);
      let precedingIndex = index - 1;
      while (
        block.operations[precedingIndex] !== undefined &&
        hasNoMachineInstruction(block.operations[precedingIndex]!)
      ) {
        precedingIndex -= 1;
      }
      const preceding = block.operations[precedingIndex];
      if (
        ((producer.kind === "load" && typeBytes(producer.type) === 1) ||
          (producer.kind === "memory-read" && producer.width === 1) ||
          (producer.kind === "platform" && typeBytes(producer.type) === 1)) &&
        consumer?.kind === "memory-write" &&
        consumer.width === 1 &&
        consumer.value === producer.result &&
        constantValues.has(consumer.address)
      ) {
        // A fixed store consumes A without changing it. Dynamic destinations need pointer
        // setup, so they retain the existing stable-value path. This removes only the
        // temporary store/reload, never the ordered source read or destination write.
        forwardedRegisterValues.add(producer.result);
      }
      if (
        producer.kind === "memory-read" &&
        producer.width === 1 &&
        singleUseValues.has(producer.result) &&
        constantValues.has(producer.address) &&
        consumer?.kind === "memory-read" &&
        consumer.width === 1 &&
        singleUseValues.has(consumer.result) &&
        constantValues.has(consumer.address)
      ) {
        let arithmeticIndex = consumerIndex + 1;
        while (
          block.operations[arithmeticIndex] !== undefined &&
          hasNoMachineInstruction(block.operations[arithmeticIndex]!)
        ) {
          arithmeticIndex += 1;
        }
        const arithmetic = block.operations[arithmeticIndex];
        if (
          arithmetic?.kind === "bcd" &&
          arithmetic.width === 1 &&
          arithmetic.operator === "sub" &&
          arithmetic.left === producer.result &&
          arithmetic.right === consumer.result
        ) {
          // The first volatile byte stays in A while the later byte is staged from X.
          // Neither source may be read again after its ordered bus access.
          subtractRightInX.add(consumer.result);
          forwardedRegisterValues.add(producer.result);
          forwardedRegisterValues.add(consumer.result);
        }
      }
      if (
        producer.kind === "memory-read" &&
        producer.width === 2 &&
        singleUseValues.has(producer.result) &&
        constantValues.has(producer.address) &&
        consumer?.kind === "memory-read" &&
        consumer.width === 2 &&
        singleUseValues.has(consumer.result) &&
        constantValues.has(consumer.address)
      ) {
        let arithmeticIndex = consumerIndex + 1;
        while (
          block.operations[arithmeticIndex] !== undefined &&
          hasNoMachineInstruction(block.operations[arithmeticIndex]!)
        ) {
          arithmeticIndex += 1;
        }
        const arithmetic = block.operations[arithmeticIndex];
        const write = nextMachineOperation(block, arithmeticIndex);
        if (
          arithmetic?.kind === "bcd" &&
          arithmetic.width === 2 &&
          arithmetic.left === producer.result &&
          arithmetic.right === consumer.result &&
          singleUseValues.has(arithmetic.result) &&
          write?.kind === "memory-write" &&
          write.width === 2 &&
          write.value === arithmetic.result &&
          constantValues.has(write.address)
        ) {
          if (arithmetic.operator === "add") {
            // Stage the first low byte; Y retains its high byte across the next read.
            wordAddLeftHighInY.add(producer.result);
          } else {
            // A/Y retain the first word; the later low byte uses one reusable home.
            wordSubtractLeftHighInY.add(producer.result);
            wordSubtractRightLowStaged.add(consumer.result);
          }
        }
      }
      if (
        producer.kind === "bcd" &&
        producer.width === 2 &&
        singleUseValues.has(producer.result) &&
        ((singleUseValues.has(producer.left) && constantValues.has(producer.right)) ||
          (producer.operator === "add" &&
            singleUseValues.has(producer.right) &&
            forwardedRegisterValues.has(producer.right)) ||
          (producer.operator === "sub" &&
            wordSubtractLeftHighInY.has(producer.left) &&
            wordSubtractRightLowStaged.has(producer.right))) &&
        preceding?.kind === "memory-read" &&
        preceding.width === 2 &&
        (preceding.result === producer.left || preceding.result === producer.right) &&
        consumer?.kind === "memory-write" &&
        consumer.width === 2 &&
        consumer.value === producer.result &&
        constantValues.has(consumer.address)
      ) {
        directBcdWrites.set(producer.result, consumer);
        if (preceding.result === producer.left) forwardedRegisterValues.add(producer.left);
      } else if (
        producer.kind === "memory-read" &&
        producer.width === 2 &&
        consumer?.kind === "bcd" &&
        consumer.width === 2 &&
        consumer.operator === "add" &&
        consumer.right === producer.result &&
        preceding?.kind === "memory-read" &&
        preceding.width === 2 &&
        preceding.result === consumer.left &&
        singleUseValues.has(consumer.result) &&
        following?.kind === "memory-write" &&
        following.width === 2 &&
        following.value === consumer.result &&
        constantValues.has(following.address)
      ) {
        forwardedRegisterValues.add(producer.result);
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
  return {
    forwardedRegisterValues,
    directBcdWrites,
    subtractRightInX,
    wordAddLeftHighInY,
    wordSubtractLeftHighInY,
    wordSubtractRightLowStaged,
  };
}
