import type { SemanticBlock, SemanticOperation, SemanticPlace } from "../semantic/operations.js";
import type { UnaryOperation } from "../semantic/operations.js";
import type { SemanticType, StructFieldType } from "../frontend/semantic-types.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { StoragePlacement, StorageInventory } from "../storage/storage-types.js";
import { declaredStorageIds } from "../storage/selection.js";
import { canUseFixedCounterIndex } from "./lower-aggregate.js";
import type {
  ByteComplementFacts,
  ByteComplementRuntime,
  ByteComplementProof,
  ByteWindowAddress,
} from "./byte-value-availability.js";
import {
  machineInstruction,
  modeForValue,
  operandForValue,
  type LoweredValue,
} from "./lower-control.js";
import type { FixedCounterRuntime, MachineInstruction } from "./machine-types.js";
import {
  loweringFailure,
  appendLoadA,
  isSignedType,
  loweredPlace,
  requestStorage,
  storeA,
  type FunctionLoweringState,
  typeBytes,
} from "./lower-state.js";

/**
 * Identify only code-free selected unary/operand operations before register planning.
 * Provisional staging is consulted exactly as by the ordinary load owner.
 * @param facts Already validated source replacements.
 * @param placement Genuine current provisional homes, if already allocated.
 * @param blocks Actual source blocks emitted in this execution context.
 * @param logicalStorage Original declarations when physical homes are unavailable.
 * @returns Code-free operations and addressable values, not a new register allocation.
 */
export function byteComplementNoCode(
  facts: ByteComplementFacts,
  placement: StoragePlacement | undefined,
  blocks: readonly SemanticBlock[],
  logicalStorage?: StorageInventory,
) {
  const active = new Set(blocks.flatMap((block) => block.operations));
  const labels = new Set(blocks.map((block) => block.id));
  const homes = new Set(declaredStorageIds({ placement, logicalStorage }));
  const noCode = new Set<SemanticOperation>();
  const addressValues = new Set<string>();
  for (const [operation, recipe] of facts.replacements) {
    if (
      !active.has(operation) ||
      !active.has(recipe.first) ||
      (recipe.preheader !== null && !labels.has(recipe.preheader))
    )
      continue;
    if (
      !homes.has(`${bindingIdentityKey(facts.function.id)}:argument-stage:${recipe.input.result}`)
    )
      noCode.add(recipe.input);
    if (recipe.defer) {
      noCode.add(operation);
      addressValues.add(operation.result);
    }
  }
  return { noCode, addressValues };
}

/** Whether a held counter read is the exact index of its next proved raw absolute read. */
function ordinalRawIndexUse(value: string, state: FunctionLoweringState): boolean {
  const uses = state.fixedLoops?.consumers.get(value);
  const target = uses?.length === 1 ? uses[0] : undefined;
  return (
    target?.kind === "binary" &&
    target.operator === "+" &&
    state.ordinalRawReads?.get(target.result)?.index === value
  );
}

/** A transferred counter may stay in A only through this exact code-free conversion/use chain. */
function immediateCounterUse(
  operation: Extract<SemanticOperation, { readonly kind: "load" }>,
  state: FunctionLoweringState,
  index: number,
): boolean {
  const runtime = state.fixedLoops;
  const block = runtime?.current?.source;
  if (runtime === undefined || block?.operations[index] !== operation) return false;
  let value = operation.result;
  let bytes = 2;
  for (const next of block.operations.slice(index + 1)) {
    if (
      !state.singleUseValues.has(value) ||
      runtime.stageIds.has(`${bindingIdentityKey(state.owner)}:argument-stage:${value}`)
    )
      return false;
    if (next.kind === "constant") continue;
    if (
      next.kind === "convert" &&
      next.operand === value &&
      ["truncate", "identity", "reinterpret"].includes(next.conversion)
    ) {
      value = next.result;
      bytes = typeBytes(next.type);
      continue;
    }
    if (next.kind === "store" && next.value === value)
      return (
        next.place.path.length === 0 ||
        (bytes === 1 &&
          next.place.path.some(
            (part) =>
              part.kind === "index" && runtime.indexViews.get(part.value)?.consumer === next,
          ))
      );
    if (next.kind === "memory-write" && next.value === value)
      return bytes === 1 && state.values.get(next.address)?.kind === "constant";
    if (
      next.kind === "binary" &&
      ["<<", ">>"].includes(next.operator) &&
      next.right === value &&
      typeBytes(next.type) === 1
    ) {
      const left = state.values.get(next.left);
      return left?.kind === "constant" || left?.kind === "storage" || left?.kind === "label";
    }
    return false;
  }
  return false;
}

/**
 * Construct a proved parent-plus-one value without a redundant word arithmetic home.
 * Both registers are already assigned jointly; all child definitions remain explicit
 * so final emitted-code validation can distinguish them from accidental clobbers.
 * @param counter Child's exact pure initialization recipe.
 * @param state Existing parent register or source word home.
 * @returns The selected sequence, or null for an ordinary evaluated initializer.
 */
export function lowerParentCounterInitialization(
  counter: FixedCounterRuntime,
  state: FunctionLoweringState,
): readonly MachineInstruction[] | null {
  const { register, parentInitialization, loop } = counter;
  if (register === null || parentInitialization === null) return null;
  const parent = state.fixedLoops?.counters.get(bindingIdentityKey(parentInitialization.root));
  const source =
    parent !== undefined && parent.register !== null
      ? Object.freeze({
          kind: "register" as const,
          registers: parent.register,
          bytes: 1 as const,
          signed: false,
        })
      : (parent?.home ?? loweredPlace(parentInitialization, 2, false, state));
  const cpu = state.input.profile.cpu;
  const span = loop.initialization.span;
  const instructions: MachineInstruction[] =
    source.kind === "register"
      ? [
          machineInstruction(
            cpu,
            source.registers === "x" ? "txa" : "tya",
            "implied",
            null,
            [],
            span,
          ),
          machineInstruction(cpu, register === "x" ? "tax" : "tay", "implied", null, [], span),
        ]
      : [
          machineInstruction(
            cpu,
            register === "x" ? "ldx" : "ldy",
            modeForValue(source),
            operandForValue(source),
            [],
            span,
          ),
        ];
  instructions.push(
    machineInstruction(cpu, register === "x" ? "inx" : "iny", "implied", null, [], span),
  );
  for (const instruction of instructions)
    if (instruction.defines.registers.includes(register)) counter.ownWrites.add(instruction);
  return Object.freeze(instructions);
}

/**
 * Reconstruct a source word from a byte home or a proved held counter.
 * Native indices retain truthful X/Y values; other uses transfer to A only in a
 * proved immediate window, or snapshot through existing finite SFA requests.
 * @param operation Original whole-counter read.
 * @param state Selected counter and ordinary staging context.
 * @param index Position in the unchanged source occurrence.
 * @returns Selected instructions, or null for an ordinary source read.
 */
export function lowerFixedCounterRead(
  operation: SemanticOperation,
  state: FunctionLoweringState,
  index: number,
): readonly MachineInstruction[] | null {
  if (operation.kind !== "load" || operation.place.path.length !== 0) return null;
  const runtime = state.fixedLoops;
  const counter = runtime?.counters.get(bindingIdentityKey(operation.place.root));
  if (runtime === undefined || counter === undefined) return null;
  state.loadOrigins.set(operation.result, bindingIdentityKey(operation.place.root));
  const stageId = `${bindingIdentityKey(state.owner)}:argument-stage:${operation.result}`;
  const staged = runtime.stageIds.has(stageId);
  counter.reads.set(operation.result, staged ? stageId : null);
  const instructions: MachineInstruction[] = [];
  let low: LoweredValue;
  if (counter.register !== null) {
    const consumers = runtime.consumers.get(operation.result);
    const target = consumers?.length === 1 ? consumers[0] : undefined;
    if (
      !staged &&
      state.singleUseValues.has(operation.result) &&
      (target?.kind === "load" || target?.kind === "store") &&
      canUseFixedCounterIndex(
        target.place,
        target.type,
        operation.result,
        counter.loop.valueBounds.get(operation.result),
        state,
        target.span,
      )
    ) {
      low = Object.freeze({
        kind: "register",
        registers: counter.register,
        bytes: 1,
        signed: false,
      });
      runtime.indexViews.set(operation.result, { counter, consumer: target });
      if (target.kind === "store" && state.singleUseValues.has(target.value)) {
        // The native index needs no setup or bounds code. Its immediately
        // preceding byte producer can therefore feed STA directly from A.
        const operations = runtime.current?.source.operations ?? [];
        let previous = operations.indexOf(target) - 1;
        while (operations[previous]?.kind === "constant") previous -= 1;
        const producer = operations[previous];
        if (
          previous > index &&
          producer !== undefined &&
          ((producer.kind === "memory-read" && producer.width === 1) ||
            ((producer.kind === "load" ||
              producer.kind === "unary" ||
              producer.kind === "binary") &&
              typeBytes(producer.type) === 1)) &&
          producer.result === target.value
        )
          state.forwardedRegisterValues.add(target.value);
      }
    } else if (!staged && counter.register === "x" && ordinalRawIndexUse(operation.result, state)) {
      // The native absolute-X read consumes this exact ordinal from X; no
      // snapshot or transfer is needed and the counter stays live.
      state.forwardedRegisterValues.add(operation.result);
      low = Object.freeze({ kind: "register", registers: "x", bytes: 1, signed: false });
    } else if (!staged && immediateCounterUse(operation, state, index)) {
      state.forwardedRegisterValues.add(operation.result);
      let current = operation.result;
      for (const next of runtime.current?.source.operations.slice(index + 1) ?? []) {
        if (next.kind === "constant") continue;
        if (next.kind !== "convert" || next.operand !== current) break;
        current = next.result;
        state.forwardedRegisterValues.add(current);
      }
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          counter.register === "x" ? "txa" : "tya",
          "implied",
          null,
          [],
          operation.span,
        ),
      );
      low = Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false });
    } else {
      const uses = runtime.consumers.get(operation.result);
      // Only these extractions copy the snapshot into A before their result
      // survives. Every unproved derived view keeps its backing for the function.
      const precise =
        runtime.current?.source.operations[index] === operation &&
        uses !== undefined &&
        uses.length > 0 &&
        uses.every(
          (use) =>
            use?.kind === "unary" &&
            (use.operator === "lo" || use.operator === "hi") &&
            use.operand === operation.result,
        );
      const requestId = staged
        ? stageId
        : requestStorage(
            state,
            `retained-value:${operation.result}`,
            "temporary",
            1,
            "ram",
            operation.span,
            "Snapshot of a held source counter",
            Object.freeze({ kind: "scalar", name: "byte" }),
            operation.result,
            precise ? "source" : "function",
          ).id;
      low = Object.freeze({ kind: "storage", requestId, bytes: 1, signed: false });
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          counter.register === "x" ? "stx" : "sty",
          "storage",
          { kind: "storage", requestId },
          [],
          operation.span,
        ),
      );
    }
  } else {
    if (counter.home === null)
      throw loweringFailure("Fixed counter has neither a home nor a held register", operation.span);
    low = counter.home;
  }
  const value: LoweredValue = Object.freeze({
    kind: "zero-extended",
    low,
    bytes: 2,
    signed: false,
  });
  if (!staged) {
    state.values.set(operation.result, value);
    return Object.freeze(instructions);
  }
  const stage: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: stageId,
    bytes: 2,
    signed: false,
  });
  if (counter.register === null) {
    appendLoadA(instructions, value, 0, state, operation.span);
    instructions.push(storeA(stage, 0, state, operation.span));
  }
  appendLoadA(instructions, value, 1, state, operation.span);
  instructions.push(storeA(stage, 1, state, operation.span));
  state.values.set(operation.result, stage);
  return Object.freeze(instructions);
}

/**
 * Retain a pure packed scalar field as its existing symbolic byte view.
 * Only selected fixed roots can reach this path; runtime pointers keep ordinary loads.
 * @param place Source whole-root/field path whose type was checked before selection.
 * @param state Current source/fixed-object representation and provisional homes.
 * @returns A one-byte data view, or null when pointer/index formation is still required.
 */
export function byteSourceView(
  place: SemanticPlace,
  state: FunctionLoweringState,
): Extract<LoweredValue, { readonly kind: "storage" | "label" }> | null {
  const rootType = place.rootType;
  let offset = 0;
  if (rootType === undefined) return null;
  let type: SemanticType = rootType;
  for (const part of place.path) {
    if (part.kind !== "field" || type.kind !== "struct") return null;
    const field: StructFieldType | undefined = type.fields.find(
      (value) => value.name === part.name,
    );
    if (field === undefined) return null;
    offset += field.offset;
    type = field.type;
  }
  if (type.kind !== "scalar" || type.name !== "byte") return null;
  const root = loweredPlace(place, typeBytes(rootType), false, state);
  if (
    (root.kind !== "storage" && root.kind !== "label") ||
    (root.kind === "storage" && root.requestId.includes(":parameter:"))
  )
    return null;
  return Object.freeze({ ...root, bytes: 1, offset: (root.offset ?? 0) + offset, signed: false });
}

/**
 * Declare every selected complement cache and schedule its entry prefix before binding.
 * @param facts Valid source replacements for this exact function/profile.
 * @param state Fresh execution-context state before its blocks are emitted.
 * @param blocks Actual emitted source blocks, not an unfiltered callable body.
 * @param free Code-free classification already used by register planning.
 * @returns Machine values, predeclared prefixes and pending observer obligations.
 */
export function prepareByteComplements(
  facts: ByteComplementFacts,
  state: FunctionLoweringState,
  blocks: readonly SemanticBlock[],
  free: Pick<ByteComplementRuntime, "noCode" | "addressValues">,
): ByteComplementRuntime {
  const active = new Set(blocks.flatMap((block) => block.operations));
  const labels = new Set(blocks.map((block) => block.id));
  const values = new Map<UnaryOperation, LoweredValue>();
  const eager = new Set<UnaryOperation>();
  const caches = new Map<UnaryOperation, Extract<LoweredValue, { readonly kind: "storage" }>>();
  const prefixes = new Map<string, readonly MachineInstruction[]>();
  const proofs: ByteComplementProof[] = [];
  for (const [operation, recipe] of facts.replacements) {
    if (
      !active.has(operation) ||
      !active.has(recipe.first) ||
      (recipe.preheader !== null && !labels.has(recipe.preheader))
    )
      continue;
    const place =
      recipe.load.place.rootType === undefined && recipe.load.place.path.length === 0
        ? { ...recipe.load.place, rootType: recipe.load.type }
        : recipe.load.place;
    const source = byteSourceView(place, state);
    if (source === null)
      throw loweringFailure("Complement source has no selected direct byte view", operation.span);
    let cache = recipe.kind === "cache" ? caches.get(recipe.first) : undefined;
    if (recipe.kind === "cache" && cache === undefined) {
      if (recipe.preheader === null)
        throw loweringFailure("Complement cache has no entry prefix", operation.span);
      const request = requestStorage(
        state,
        `byte-complement:${recipe.first.result}`,
        "temporary",
        1,
        "zero-page-preferred",
        recipe.first.span,
        "Shared complement of one source-stable ordinary byte",
        operation.type,
      );
      cache = Object.freeze({ kind: "storage", requestId: request.id, bytes: 1, signed: false });
      caches.set(recipe.first, cache);
      const setup: MachineInstruction[] = [];
      appendLoadA(setup, source, 0, state, recipe.first.span);
      setup.push(
        machineInstruction(
          state.input.profile.cpu,
          "eor",
          "immediate",
          { kind: "immediate", value: 255 },
          [],
          recipe.first.span,
        ),
        storeA(cache, 0, state, recipe.first.span),
      );
      prefixes.set(
        recipe.preheader,
        Object.freeze([...(prefixes.get(recipe.preheader) ?? []), ...setup]),
      );
    }
    values.set(operation, cache ?? source);
    if (!recipe.defer) eager.add(operation);
    const address: ByteWindowAddress =
      source.kind === "storage"
        ? { kind: "home", id: source.requestId, offset: source.offset ?? 0 }
        : { kind: "symbol", id: source.label, offset: source.offset ?? 0 };
    proofs.push(
      Object.freeze({
        function: facts.function.id,
        ...(state.input.observerEvidence
          ? { selection: Object.freeze([operation, recipe] as const) }
          : {}),
        domain: "main",
        kind: recipe.kind,
        producer: recipe.first.span,
        consumer: operation.span,
        binding: recipe.binding,
        source: address,
        cacheRequestId: cache?.requestId ?? null,
        preservedLeft: recipe.preservedLeft,
        rangeCounters: Object.freeze([
          ...new Set([
            ...(state.sourceFacts?.objects.rangeObservers ?? []).map((loop) => loop.counter),
            ...(recipe.admittingCounter === null ? [] : [recipe.admittingCounter]),
          ]),
        ]),
        pendingObservers: true,
      }),
    );
  }
  return {
    values,
    eager,
    noCode: free.noCode,
    addressValues: free.addressValues,
    prefixes,
    proofs: Object.freeze(proofs),
  };
}

/**
 * Lower one scalar unary operation without a runtime helper. Only the actual
 * owning block can prove a final branch-only result; absent context is conservative.
 * The owner's byte-return-arm proof can permit a one-byte index-register test.
 */
export function lowerUnary(
  operation: Extract<SemanticOperation, { readonly kind: "unary" }>,
  state: FunctionLoweringState,
  block?: SemanticBlock,
  byteReturnArms = false,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  const operand = state.values.get(operation.operand);
  if (operand === undefined || operand.kind === "condition") {
    throw loweringFailure("Unary operand was not lowered to a value", operation.span);
  }
  const width = typeBytes(operation.type);
  const selected =
    operation.operator === "~" && width === 1
      ? state.byteComplements?.values.get(operation)
      : undefined;
  if (selected !== undefined) {
    if (!state.byteComplements?.eager.has(operation))
      return { instructions: Object.freeze([]), result: selected };
    const instructions: MachineInstruction[] = [];
    appendLoadA(instructions, selected, 0, state, operation.span);
    return {
      instructions: Object.freeze(instructions),
      result: Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
    };
  }
  if (operation.operator === "+") {
    return Object.freeze({ instructions: Object.freeze([]), result: operand });
  }
  if (operation.operator === "lo" || operation.operator === "hi") {
    const offset = operation.operator === "lo" ? 0 : 1;
    if (offset >= operand.bytes) {
      throw loweringFailure("Byte extraction exceeds its operand width", operation.span);
    }
    const instructions: MachineInstruction[] = [];
    appendLoadA(instructions, operand, offset, state, operation.span);
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
    });
  }
  if (operation.operator === "!") {
    const instructions: MachineInstruction[] = [];
    appendLoadA(instructions, operand, 0, state, operation.span);
    for (let offset = 1; offset < operand.bytes; offset += 1) {
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "ora",
          modeForValue(operand, offset),
          operandForValue(operand, offset),
          [],
          operation.span,
        ),
      );
    }
    if (
      state.branchConditions.has(operation.result) &&
      !state.materializedValues.has(operation.result) &&
      block?.operations.at(-1) === operation &&
      block.terminator.kind === "branch" &&
      block.terminator.condition === operation.result
    ) {
      // Only this immediate branch consumes the negation. A fresh load/OR owns
      // Z; a returned or otherwise live A needs an explicit test of its value.
      if (instructions.length === 0) {
        // These terminal byte-return arms cannot observe X or outgoing carry.
        // NMI code retains CMP: a new X clobber could enlarge its entry saves.
        const disposableX = byteReturnArms && state.interruptDepth.domain !== "nmi";
        instructions.push(
          machineInstruction(
            state.input.profile.cpu,
            disposableX ? "tax" : "cmp",
            disposableX ? "implied" : "immediate",
            disposableX ? null : Object.freeze({ kind: "immediate", value: 0 }),
            [],
            operation.span,
          ),
        );
      }
      return Object.freeze({
        instructions: Object.freeze(instructions),
        result: Object.freeze({ kind: "condition", whenTrue: "beq", usesFlag: "z" }),
      });
    }
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "cmp",
        "immediate",
        Object.freeze({ kind: "immediate", value: 1 }),
        [],
        operation.span,
      ),
      machineInstruction(
        state.input.profile.cpu,
        "lda",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0 }),
        [],
        operation.span,
      ),
      machineInstruction(
        state.input.profile.cpu,
        "adc",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0 }),
        [],
        operation.span,
      ),
      machineInstruction(
        state.input.profile.cpu,
        "eor",
        "immediate",
        Object.freeze({ kind: "immediate", value: 1 }),
        [],
        operation.span,
      ),
    );
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
    });
  }
  if (operation.operator !== "-" && operation.operator !== "~") {
    throw loweringFailure(`Unary operator '${operation.operator}' is not admitted`, operation.span);
  }

  const resultRequest =
    width === 1
      ? null
      : requestStorage(
          state,
          `unary:${operation.result}`,
          "temporary",
          width,
          "ram",
          operation.span,
          "Multi-byte unary result",
          operation.type,
        );
  const result: LoweredValue =
    resultRequest === null
      ? Object.freeze({
          kind: "register",
          registers: "a",
          bytes: 1,
          signed: isSignedType(operation.type),
        })
      : Object.freeze({
          kind: "storage",
          requestId: resultRequest.id,
          bytes: width,
          signed: isSignedType(operation.type),
        });
  const instructions: MachineInstruction[] = [];
  for (let offset = 0; offset < width; offset += 1) {
    appendLoadA(instructions, operand, offset, state, operation.span);
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "eor",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0xff }),
        [],
        operation.span,
      ),
    );
    if (operation.operator === "-") {
      if (offset === 0) {
        instructions.push(
          machineInstruction(state.input.profile.cpu, "clc", "implied", null, [], operation.span),
        );
      }
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "adc",
          "immediate",
          Object.freeze({ kind: "immediate", value: offset === 0 ? 1 : 0 }),
          [],
          operation.span,
        ),
      );
    }
    if (result.kind === "storage") instructions.push(storeA(result, offset, state, operation.span));
  }
  return Object.freeze({ instructions: Object.freeze(instructions), result });
}
