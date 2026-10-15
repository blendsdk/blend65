import type {
  MemoryWriteOperation,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
} from "../semantic/operations.js";
import { canReceiveByteArgumentInA } from "./lower-call.js";
import type { MachineBlock } from "./machine-types.js";
import { typeBytes } from "./lower-state.js";

/**
 * Keep an already-zero A for a Boolean function's two constant return arms.
 * Every direct predecessor must reach the zero arm only after a fresh A/N/Z
 * producer tests Z=1. No aliases, unconditional entry, stale flags or other
 * instruction between the producer and branch qualify. The caller excludes
 * startup returns and non-Boolean ABIs before this storage-free selection.
 * The one arm then falls through to the shared RTS; existing layout orders it.
 */
export function selectZeroReturn(blocks: readonly MachineBlock[]): readonly MachineBlock[] {
  const returns = blocks.filter((block) => block.terminator.kind === "return");
  if (returns.length !== 2) return blocks;
  /** Identify only a single effect-free immediate load and an ordinary return. */
  const constantArm = (block: MachineBlock, value: number): boolean => {
    const instruction = block.instructions[0];
    return (
      block.instructions.length === 1 &&
      instruction?.opcode === "lda" &&
      instruction.mode === "immediate" &&
      instruction.operand?.kind === "immediate" &&
      instruction.operand.value === value &&
      instruction.memory.length === 0
    );
  };
  const zero = returns.find((block) => constantArm(block, 0));
  const one = returns.find((block) => constantArm(block, 1));
  if (zero === undefined || one === undefined || blocks[0]?.label === zero.label) return blocks;
  if (new Set(blocks.map(({ label }) => label)).size !== blocks.length) return blocks;
  let incoming = 0;
  for (const block of blocks) {
    // Labels used as instruction operands are not declared direct CFG entries.
    if (
      block.instructions.some(
        ({ operand }) => operand?.kind === "label" && operand.label === zero.label,
      )
    )
      return blocks;
    const edge = block.terminator;
    if (edge.kind === "jump" || edge.kind === "fallthrough") {
      if (edge.target === zero.label) return blocks;
      continue;
    }
    if (edge.kind === "long-branch") {
      if (edge.jump.target === zero.label || edge.fallthrough === zero.label) return blocks;
      continue;
    }
    if (edge.kind !== "branch") continue;
    const taken = edge.target === zero.label;
    const untaken = edge.fallthrough === zero.label;
    if (!taken && !untaken) continue;
    if (taken === untaken || (taken ? edge.opcode !== "beq" : edge.opcode !== "bne")) return blocks;
    const producer = block.instructions.at(-1);
    if (
      producer === undefined ||
      !["lda", "and", "ora", "eor"].includes(producer.opcode) ||
      !producer.defines.registers.includes("a") ||
      !producer.defines.flags.includes("n") ||
      !producer.defines.flags.includes("z")
    )
      return blocks;
    incoming += 1;
  }
  if (incoming === 0) return blocks;
  return Object.freeze(
    blocks.map((block) =>
      block === zero
        ? Object.freeze({ ...block, instructions: Object.freeze([]) })
        : block === one
          ? Object.freeze({
              ...block,
              terminator: Object.freeze({ kind: "fallthrough" as const, target: zero.label }),
            })
          : block,
    ),
  );
}

/**
 * Select adjacent byte loads, complement/bitwise results, captured hardware samples and BCD
 * values that can stay in registers until their only consumer.
 *
 * Constants and conversions of constants emit no machine instructions, so they do not
 * interrupt register ownership. Every other operation ends the forwarding window.
 */
export function selectRegisterForwarding(
  blocks: readonly SemanticBlock[],
  singleUseValues: ReadonlySet<string>,
  ordinalBounds: ReadonlyMap<SemanticOperation, ReadonlyMap<string, bigint>> = new Map(),
  functions: readonly SemanticFunction[] = [],
): {
  /** Values whose sole adjacent consumer can use their still-live registers. */
  readonly forwardedRegisterValues: ReadonlySet<string>;
  /** Nonwrapping additions consumed only by their next stride-one indexed access. */
  readonly byteOrdinalAdditions: ReadonlySet<string>;
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
  const literals = new Map<string, bigint>();
  const zeroValues = new Set<string>();
  const byteMasks = new Set<string>();
  const fixedReadsOutsideZeroPage = new Set<string>();
  for (const block of blocks) {
    for (const operation of block.operations) {
      if (operation.kind === "constant") {
        constantValues.add(operation.result);
        if (typeof operation.value === "bigint") literals.set(operation.result, operation.value);
        if (operation.value === 0n) zeroValues.add(operation.result);
        if (typeof operation.value === "bigint" && operation.value >= 0n && operation.value <= 255n)
          byteMasks.add(operation.result);
        if (typeof operation.value === "bigint" && (operation.value & 0xffffn) > 255n)
          fixedReadsOutsideZeroPage.add(operation.result);
      } else if (operation.kind === "convert" && constantValues.has(operation.operand)) {
        constantValues.add(operation.result);
        const literal = literals.get(operation.operand);
        if (literal !== undefined) literals.set(operation.result, literal);
      }
    }
  }
  const hasNoMachineInstruction = (operation: SemanticBlock["operations"][number]): boolean =>
    operation.kind === "constant" ||
    (operation.kind === "convert" && constantValues.has(operation.result));
  // Constant expressions carry identities but emit nothing, so they do not break adjacency.
  const nextMachineOperationIndex = (block: SemanticBlock, index: number): number => {
    let next = index + 1;
    while (
      block.operations[next] !== undefined &&
      hasNoMachineInstruction(block.operations[next]!)
    ) {
      next += 1;
    }
    return next;
  };
  const nextMachineOperation = (
    block: SemanticBlock,
    index: number,
  ): SemanticBlock["operations"][number] | undefined =>
    block.operations[nextMachineOperationIndex(block, index)];
  const forwardedRegisterValues = new Set<string>();
  const byteOrdinalAdditions = new Set<string>();
  const directBcdWrites = new Map<string, MemoryWriteOperation>();
  const subtractRightInX = new Set<string>();
  const wordAddLeftHighInY = new Set<string>();
  const wordSubtractLeftHighInY = new Set<string>();
  const wordSubtractRightLowStaged = new Set<string>();
  for (const block of blocks) {
    for (let index = 0; index < block.operations.length; index += 1) {
      const producer = block.operations[index]!;
      if (
        producer.kind === "binary" &&
        (producer.operator === "<<" || producer.operator === ">>") &&
        typeBytes(producer.type) === 1 &&
        singleUseValues.has(producer.result)
      ) {
        const consumerIndex = nextMachineOperationIndex(block, index);
        let consumer: SemanticOperation | undefined = block.operations[consumerIndex];
        let delivered = producer.result;
        const count = literals.get(producer.right);
        const fixedCount = count !== undefined && count > 0n && count < 8n;
        // A sole-use byte cast emits nothing; only fixed stores avoid clobbering A.
        if (
          fixedCount &&
          consumer?.kind === "convert" &&
          consumer.operand === producer.result &&
          typeBytes(consumer.type) === 1 &&
          singleUseValues.has(consumer.result) &&
          (consumer.conversion === "identity" || consumer.conversion === "reinterpret")
        ) {
          delivered = consumer.result;
          consumer = nextMachineOperation(block, consumerIndex);
        }
        if (
          (consumer === undefined &&
            block.terminator.kind === "return" &&
            block.terminator.value === producer.result) ||
          (count === 1n &&
            consumer?.kind === "binary" &&
            consumer.operator === "|" &&
            consumer.left === delivered &&
            typeBytes(consumer.type) === 1 &&
            literals.get(consumer.right) === 1n) ||
          (fixedCount &&
            ((consumer?.kind === "memory-write" &&
              consumer.width === 1 &&
              consumer.value === delivered &&
              constantValues.has(consumer.address)) ||
              (consumer?.kind === "store" &&
                typeBytes(consumer.type) === 1 &&
                consumer.value === delivered &&
                consumer.place.path.length === 0)))
        ) {
          forwardedRegisterValues.add(producer.result);
          forwardedRegisterValues.add(delivered);
        }
      }
      if (
        producer.kind === "binary" &&
        producer.operator === "+" &&
        producer.type.kind === "scalar" &&
        producer.type.name === "word" &&
        singleUseValues.has(producer.result)
      ) {
        const consumer = nextMachineOperation(block, index);
        const addend = literals.get(producer.right);
        if (
          (consumer?.kind === "load" || consumer?.kind === "store") &&
          typeBytes(consumer.type) === 1 &&
          consumer.place.path.length === 1
        ) {
          const [component] = consumer.place.path;
          const maximum = ordinalBounds.get(consumer)?.get(producer.result);
          if (
            component?.kind === "index" &&
            component.value === producer.result &&
            addend !== undefined &&
            addend >= 0n &&
            addend <= 255n &&
            maximum !== undefined &&
            maximum >= 0n &&
            maximum < 256n
          ) {
            // This fact belongs to this exact immutable result/access pair.
            // No guard, read, write or call can intervene in the adjacency window.
            byteOrdinalAdditions.add(producer.result);
            forwardedRegisterValues.add(producer.result);
          }
        }
      }
      const byteBitwise =
        producer.kind === "binary" &&
        ["&", "|", "^"].includes(producer.operator) &&
        typeBytes(producer.type) === 1;
      const byteComplement =
        producer.kind === "unary" && producer.operator === "~" && typeBytes(producer.type) === 1;
      if (
        ((producer.kind === "load" && typeBytes(producer.type) === 1) ||
          (producer.kind === "memory-read" && producer.width === 1) ||
          byteBitwise ||
          byteComplement) &&
        "result" in producer &&
        producer.result !== null &&
        singleUseValues.has(producer.result)
      ) {
        const consumerIndex = nextMachineOperationIndex(block, index);
        let consumer = nextMachineOperation(block, index);
        let delivered = producer.result;
        // A sole same-width OR1 cast keeps A; only its fixed store/return qualifies.
        if (
          producer.kind === "binary" &&
          producer.operator === "|" &&
          literals.get(producer.right) === 1n &&
          consumer?.kind === "convert" &&
          consumer.operand === producer.result &&
          typeBytes(consumer.type) === 1 &&
          singleUseValues.has(consumer.result) &&
          (consumer.conversion === "identity" || consumer.conversion === "reinterpret")
        ) {
          delivered = consumer.result;
          consumer = nextMachineOperation(block, consumerIndex);
        }
        if (
          (!byteComplement &&
            consumer?.kind === "unary" &&
            consumer.operator === "~" &&
            typeBytes(consumer.type) === 1 &&
            consumer.operand === producer.result) ||
          (consumer?.kind === "binary" &&
            ["&", "|", "^"].includes(consumer.operator) &&
            typeBytes(consumer.type) === 1 &&
            consumer.left === producer.result &&
            constantValues.has(consumer.right)) ||
          ((byteBitwise || byteComplement) &&
            ((consumer?.kind === "memory-write" &&
              consumer.width === 1 &&
              consumer.value === delivered &&
              constantValues.has(consumer.address)) ||
              (consumer?.kind === "store" &&
                typeBytes(consumer.type) === 1 &&
                consumer.value === delivered &&
                consumer.place.path.length === 0) ||
              (consumer === undefined &&
                block.terminator.kind === "return" &&
                block.terminator.value === delivered)))
        ) {
          // These consumers need only the current byte in A. They perform no address
          // setup or additional operand load before using it. Other operations, wider
          // values and additional uses retain their existing stable homes; forwarding
          // A here does not grant a comparison ownership of the producer's flags.
          forwardedRegisterValues.add(producer.result);
          forwardedRegisterValues.add(delivered);
        }
      }
      if (
        ((producer.kind === "memory-read" &&
          producer.width === 1 &&
          constantValues.has(producer.address)) ||
          (producer.kind === "load" && typeBytes(producer.type) === 1) ||
          (producer.kind === "binary" &&
            typeBytes(producer.type) === 1 &&
            ["&", "|", "^"].includes(producer.operator))) &&
        singleUseValues.has(producer.result)
      ) {
        const consumer = nextMachineOperation(block, index);
        if (
          consumer?.kind === "binary" &&
          ["==", "!="].includes(consumer.operator) &&
          consumer.left === producer.result &&
          zeroValues.has(consumer.right) &&
          nextMachineOperation(block, block.operations.indexOf(consumer)) === undefined &&
          block.terminator.kind === "branch" &&
          block.terminator.condition === consumer.result
        ) {
          // This consumer needs both A and the producer's freshly established Z.
          // A-only forwarding to a store does not grant this flag ownership.
          forwardedRegisterValues.add(producer.result);
        }
      }
      if (
        producer.kind === "binary" &&
        producer.operator === "&" &&
        (typeBytes(producer.type) === 2 ||
          (producer.type.kind === "scalar" && producer.type.name === "byte")) &&
        singleUseValues.has(producer.result) &&
        (byteMasks.has(producer.left) || byteMasks.has(producer.right))
      ) {
        const consumerIndex = nextMachineOperationIndex(block, index);
        const consumer = block.operations[consumerIndex];
        /** Only the sole stride-one selection can consume this still-live ordinal. */
        const selectsOrdinal = (operation: typeof consumer): boolean => {
          if (operation?.kind !== "load" && operation?.kind !== "store") return false;
          const [component] = operation.place.path;
          return (
            typeBytes(operation.type) === 1 &&
            operation.place.path.length === 1 &&
            component?.kind === "index" &&
            component.value === producer.result
          );
        };
        /** Match the exact consumer/count pair whose complete count fits the byte loop. */
        const selectsBoundedShift = (
          operation: SemanticOperation | undefined,
          count: string,
        ): boolean => {
          const maximum =
            operation === undefined ? undefined : ordinalBounds.get(operation)?.get(count);
          return (
            operation?.kind === "binary" &&
            (operation.operator === "<<" || operation.operator === ">>") &&
            typeBytes(operation.type) === 1 &&
            operation.right === count &&
            maximum !== undefined &&
            maximum >= 0n &&
            maximum < 8n
          );
        };
        const selectsConvertedShift =
          producer.type.kind === "scalar" &&
          producer.type.name === "word" &&
          consumer?.kind === "convert" &&
          consumer.conversion === "truncate" &&
          consumer.operand === producer.result &&
          consumer.type.kind === "scalar" &&
          consumer.type.name === "byte" &&
          singleUseValues.has(consumer.result) &&
          selectsBoundedShift(nextMachineOperation(block, consumerIndex), consumer.result);
        if (
          selectsOrdinal(consumer) ||
          selectsBoundedShift(consumer, producer.result) ||
          selectsConvertedShift
        ) {
          // The mask leaves its low byte in A. The sole adjacent shift takes
          // that byte into X before loading its left operand; no count home
          // or separate register-availability model is needed. A single unsigned
          // word-to-byte truncation of this byte mask also preserves A exactly;
          // its sole bounded shift must be the next emitted consumer.
          forwardedRegisterValues.add(producer.result);
        } else if (
          consumer?.kind === "memory-read" &&
          consumer.width === 1 &&
          fixedReadsOutsideZeroPage.has(consumer.address) &&
          singleUseValues.has(consumer.result)
        ) {
          const store = nextMachineOperation(block, block.operations.indexOf(consumer));
          if (store?.kind === "store" && store.value === consumer.result && selectsOrdinal(store)) {
            // Its one fixed read can follow private pointer setup at the store,
            // after the retention owner proves that setup cannot touch its address.
            forwardedRegisterValues.add(producer.result);
            forwardedRegisterValues.add(consumer.result);
          }
        }
      }
      if (
        (producer.kind !== "load" &&
          producer.kind !== "memory-read" &&
          producer.kind !== "bcd" &&
          (producer.kind !== "call" || typeBytes(producer.type) !== 1) &&
          (producer.kind !== "platform" ||
            (producer.capability !== "c64.input.readJoystick1" &&
              producer.capability !== "c64.input.readJoystick2" &&
              producer.capability !== "c64.cia2.readAndClearPendingSources" &&
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
      let byteCall: SemanticOperation | undefined = consumer;
      let byteArgument = producer.result;
      if (
        typeBytes(producer.type) === 1 &&
        byteCall?.kind === "convert" &&
        byteCall.operand === producer.result &&
        typeBytes(byteCall.type) === 1 &&
        singleUseValues.has(byteCall.result) &&
        (byteCall.conversion === "identity" || byteCall.conversion === "reinterpret")
      ) {
        byteArgument = byteCall.result;
        byteCall = following;
      }
      if (
        typeBytes(producer.type) === 1 &&
        byteCall?.kind === "call" &&
        canReceiveByteArgumentInA(byteCall, byteArgument, functions)
      ) {
        // The existing one-byte parameter store consumes A before any call setup.
        // No new register ABI or callee-preservation assumption is made.
        forwardedRegisterValues.add(producer.result);
        forwardedRegisterValues.add(byteArgument);
      }
      let precedingIndex = index - 1;
      while (
        block.operations[precedingIndex] !== undefined &&
        hasNoMachineInstruction(block.operations[precedingIndex]!)
      ) {
        precedingIndex -= 1;
      }
      const preceding = block.operations[precedingIndex];
      if (
        producer.kind === "call" &&
        producer.type.kind === "scalar" &&
        producer.type.name === "boolean" &&
        consumer?.kind === "unary" &&
        consumer.operator === "!" &&
        consumer.operand === producer.result &&
        consumer.type.kind === "scalar" &&
        consumer.type.name === "boolean" &&
        block.operations.at(-1) === consumer &&
        block.terminator.kind === "branch" &&
        block.terminator.condition === consumer.result
      ) {
        // The sole adjacent Boolean negation can test returned A directly.
        // This grants value availability only, never ownership of callee flags.
        forwardedRegisterValues.add(producer.result);
      }
      if (
        (producer.kind === "load" || (producer.kind === "memory-read" && producer.width === 1)) &&
        typeBytes(producer.type) === 1 &&
        consumer === undefined &&
        block.terminator.kind === "return" &&
        block.terminator.value === producer.result
      )
        forwardedRegisterValues.add(producer.result);
      if (
        ((producer.kind === "load" && typeBytes(producer.type) === 1) ||
          (producer.kind === "memory-read" && producer.width === 1) ||
          (producer.kind === "call" && typeBytes(producer.type) === 1) ||
          (producer.kind === "platform" && typeBytes(producer.type) === 1)) &&
        ((consumer?.kind === "memory-write" &&
          consumer.width === 1 &&
          consumer.value === producer.result &&
          constantValues.has(consumer.address)) ||
          (consumer?.kind === "store" &&
            typeBytes(consumer.type) === 1 &&
            consumer.value === producer.result &&
            consumer.place.path.length === 0))
      ) {
        // A fixed store consumes A without changing it. An unselected scalar place has
        // a direct home too: its store needs no pointer or index setup. Dynamic and
        // selected destinations retain the stable-value path. This removes only the
        // temporary store/reload, never the source read/call or destination write.
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
          arithmetic?.kind === "binary" &&
          ["&", "|", "^"].includes(arithmetic.operator) &&
          typeBytes(arithmetic.type) === 1 &&
          arithmetic.left === producer.result &&
          arithmetic.right === consumer.result
        ) {
          // The second fixed read becomes the ALU operand at the same bus-access
          // position. It does not overwrite the first sample still owned by A.
          forwardedRegisterValues.add(producer.result);
          forwardedRegisterValues.add(consumer.result);
        }
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
    byteOrdinalAdditions,
    directBcdWrites,
    subtractRightInX,
    wordAddLeftHighInY,
    wordSubtractLeftHighInY,
    wordSubtractRightLowStaged,
  };
}
