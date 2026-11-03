import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticBlock, SemanticOperation, SemanticPlace } from "../semantic/operations.js";
import {
  literalResolver,
  ordinalBoundResolver,
  placeUses,
  rawMayObserve,
  valueDefinitions,
} from "../semantic/aggregate-place-proof.js";
import { guardedOrdinalBounds } from "../semantic/guarded-place-proof.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import { selectedStoragePlace } from "../storage/selection.js";
import { canUseFixedCounterIndex } from "./lower-aggregate.js";
import {
  machineCost,
  machineInstruction,
  machineState,
  type LoweredValue,
} from "./lower-control.js";
import type {
  MachineBlock,
  MachineInstruction,
  MachineLoweringInput,
  MachineTerminator,
  FixedCounterRuntime,
} from "./machine-types.js";
import {
  loadA,
  loweringFailure,
  typeBytes,
  isSignedType,
  isReturnedLocalPlace,
  type FunctionLoweringState,
} from "./lower-state.js";

/**
 * Prove the two fixed register policies jointly, never by lexical alternation alone.
 * Unknown calls/helpers and generic index setup conservatively keep the affected
 * nest ordinary. Separate source nests remain independent deterministic choices.
 * @param state Source-admitted candidates and the ordinary target lowering context.
 * @param ordinalBounds Existing complete-count bounds used by actual shift emission.
 * @returns Only register assignments whose complete source nest has supported clobbers.
 */
export function selectFixedCounterRegisters(
  state: FunctionLoweringState,
  ordinalBounds: ReadonlyMap<SemanticOperation, ReadonlyMap<string, bigint>>,
): ReadonlyMap<FixedLoopFacts, "x" | "y"> {
  const runtime = state.fixedLoops;
  const result = new Map<FixedLoopFacts, "x" | "y">();
  if (
    runtime === undefined ||
    runtime.policy === undefined ||
    runtime.policy === "low-byte" ||
    runtime.policy === "original"
  )
    return result;
  const facts = runtime.counterFacts;
  const fn = facts[0]?.function;
  if (fn === undefined) return result;
  const definitions = valueDefinitions(fn.blocks);
  const literal = literalResolver(definitions);
  const roots = new Map<string, FixedLoopFacts>();
  for (const loop of facts) {
    roots.set(bindingIdentityKey(loop.counter), loop);
    if (loop.depth !== null)
      result.set(
        loop,
        (loop.depth + (runtime.policy.includes("y-first") ? 1 : 0)) % 2 === 0 ? "x" : "y",
      );
  }
  const control = new Set(
    facts.flatMap((loop) => [
      ...loop.header.operations,
      ...loop.update.operations,
      loop.initialization,
    ]),
  );
  const failed = new Set<FixedLoopFacts>();
  const outermost = (loop: FixedLoopFacts): FixedLoopFacts =>
    facts.reduce(
      (outer, candidate) => (candidate.members.has(outer.header.id) ? candidate : outer),
      loop,
    );
  for (const loop of facts) {
    const register = result.get(loop);
    let safe = register !== undefined;
    if (register === undefined) {
      failed.add(outermost(loop));
      continue;
    }
    if (
      facts.some(
        (child) =>
          child !== loop && loop.members.has(child.header.id) && result.get(child) === register,
      )
    )
      safe = false;
    if (
      loop.exits.some((exit) => exit.kind === "return") &&
      ((register === "x" && typeBytes(fn.result) === 2) ||
        fn.result.kind === "array" ||
        fn.result.kind === "struct")
    )
      safe = false;
    const operations = [
      ...loop.preheader.operations.slice(
        loop.preheader.operations.indexOf(loop.initialization) + 1,
      ),
      ...fn.blocks
        .filter((block) => loop.members.has(block.id))
        .flatMap((block) => block.operations),
    ];
    for (const operation of operations) {
      if (!safe) break;
      if (control.has(operation)) continue;
      if (
        [
          "call",
          "indirect-call",
          "platform",
          "aggregate",
          "place-address",
          "bcd",
          "merge",
        ].includes(operation.kind)
      ) {
        safe = false;
        break;
      }
      if (operation.kind === "memory-read" || operation.kind === "memory-write") {
        if (
          (operation.kind === "memory-read" && operation.width === 2) ||
          (register === "y" && literal(operation.address) === undefined) ||
          (register === "x" &&
            operation.kind === "memory-read" &&
            state.subtractRightInX.has(operation.result))
        )
          safe = false;
      } else if (operation.kind === "unary") {
        if (register === "x" && operation.operator === "!") safe = false;
      } else if (operation.kind === "binary") {
        const count = definitions.get(operation.right);
        const byteCount = count !== undefined && "type" in count && typeBytes(count.type) === 1;
        const maximum = ordinalBounds.get(operation)?.get(operation.right);
        const boundedCount = maximum !== undefined && maximum >= 0n && maximum < 8n;
        if (
          ["*", "/", "%"].includes(operation.operator) ||
          (["<<", ">>"].includes(operation.operator) &&
            literal(operation.right) === undefined &&
            (register === "x" ||
              typeBytes(operation.type) === 2 ||
              (!byteCount && !boundedCount))) ||
          (register === "y" &&
            (state.wordAddLeftHighInY.has(operation.result) ||
              state.wordSubtractLeftHighInY.has(operation.result)))
        )
          safe = false;
      } else if (
        ![
          "constant",
          "convert",
          "load",
          "store",
          "cpu-control",
          "function-address",
          "array-count",
        ].includes(operation.kind)
      )
        safe = false;
      if (register !== "y" || !safe) continue;
      for (const { place } of placeUses(operation)) {
        if (place.path.length === 0) continue;
        const resolved = selectedStoragePlace(place, state.sourceFacts?.storage);
        const parameter = fn.parameters.find(
          (value) => bindingIdentityKey(value.id) === bindingIdentityKey(resolved.root),
        );
        if (
          parameter?.type.kind === "array" ||
          parameter?.type.kind === "struct" ||
          (isReturnedLocalPlace(place, state) && resolved === place)
        ) {
          safe = false;
          break;
        }
        for (const part of place.path) {
          if (part.kind !== "index" || literal(part.value) !== undefined) continue;
          // Only the exact single-use source load receives a native register
          // view. A cast or staged/multiuse value still needs ordinary Y setup.
          const definition = definitions.get(part.value);
          const indexLoop =
            definition?.kind === "load" && definition.place.path.length === 0
              ? roots.get(bindingIdentityKey(definition.place.root))
              : undefined;
          const consumers = runtime.consumers.get(part.value);
          if (
            indexLoop === undefined ||
            !result.has(indexLoop) ||
            !state.singleUseValues.has(part.value) ||
            runtime.stageIds.has(
              `${bindingIdentityKey(state.owner)}:argument-stage:${part.value}`,
            ) ||
            consumers?.length !== 1 ||
            consumers[0] !== operation ||
            !(operation.kind === "load" || operation.kind === "store") ||
            !canUseFixedCounterIndex(
              place,
              operation.type,
              part.value,
              indexLoop.valueBounds.get(part.value),
              state,
              operation.span,
            )
          ) {
            safe = false;
            break;
          }
        }
      }
    }
    if (!safe) failed.add(outermost(loop));
  }
  for (const loop of facts) if (failed.has(outermost(loop))) result.delete(loop);
  return result;
}

/**
 * Identify the pure parent-plus-one initialization that a register can construct directly.
 * Both removed results must have this one use, and no intervening effect or argument
 * stage may observe them. Other initializers retain their ordinary evaluated value.
 * @param counter Selected child counter with unchanged source identities.
 * @param state Existing single-use, stage and counter-operation facts.
 * @returns The same counter, or its exact parent-read construction recipe.
 */
export function prepareParentCounterInitialization(
  counter: FixedCounterRuntime,
  state: FunctionLoweringState,
): FixedCounterRuntime {
  const runtime = state.fixedLoops;
  const { loop } = counter;
  if (
    runtime === undefined ||
    counter.register === null ||
    loop.initial.kind !== "parent-next" ||
    loop.preheader.operations.at(-1) !== loop.initialization
  )
    return counter;
  const parent = loop.initial.parent;
  const expression = loop.preheader.operations.find(
    (operation) => operation.kind === "binary" && operation.result === loop.initialization.value,
  );
  const read =
    expression?.kind === "binary"
      ? loop.preheader.operations.find(
          (operation) =>
            operation.kind === "load" &&
            operation.place.path.length === 0 &&
            bindingIdentityKey(operation.place.root) === bindingIdentityKey(parent) &&
            (expression.left === operation.result || expression.right === operation.result),
        )
      : undefined;
  if (
    read?.kind !== "load" ||
    expression?.kind !== "binary" ||
    !state.singleUseValues.has(read.result) ||
    !state.singleUseValues.has(expression.result) ||
    runtime.stageIds.has(`${bindingIdentityKey(state.owner)}:argument-stage:${read.result}`) ||
    !loop.preheader.operations
      .slice(loop.preheader.operations.indexOf(read), -1)
      .every(
        (operation) =>
          operation === read || operation === expression || operation.kind === "constant",
      )
  )
    return counter;
  const selected = { ...counter, parentInitialization: read.place };
  runtime.counterOperations.set(read, selected);
  runtime.counterOperations.set(expression, selected);
  return selected;
}

/** Normalize one folded runtime ordinal at its actual intermediate width and signedness. */
function normalizedOrdinal(value: bigint, bytes: number, signed: boolean): number {
  const modulus = 1n << BigInt(bytes * 8);
  const low = ((value % modulus) + modulus) % modulus;
  return Number(signed && low >= modulus >> 1n ? low - modulus : low);
}

/** Reinterpret stored constant bits before signed operations such as arithmetic right shift. */
function ordinalOperand(value: Extract<LoweredValue, { readonly kind: "constant" }>): bigint {
  return BigInt(normalizedOrdinal(BigInt(value.value), value.bytes, value.signed ?? false));
}

/**
 * Fold only a pure ordinal operation already admitted by an expanded loop occurrence.
 * This is not a general constant pass: callers retain source dependency, width,
 * effects and iteration proof. Unsupported arithmetic stays on ordinary lowering.
 * @param operation Original runtime operation, including its intermediate width.
 * @param values Values known at this exact source occurrence, not from a prior iteration.
 * @returns A correctly wrapped constant, or null when the supported proof is absent.
 */
export function foldFixedLoopOrdinal(
  operation: SemanticOperation,
  values: ReadonlyMap<string, LoweredValue>,
): LoweredValue | null {
  let value: bigint | undefined;
  if (operation.kind === "unary") {
    const operand = values.get(operation.operand);
    if (operand?.kind !== "constant") return null;
    if (operation.operator === "~") value = ~ordinalOperand(operand);
    else if (operation.operator === "+") value = ordinalOperand(operand);
    else if (operation.operator === "-") value = -ordinalOperand(operand);
  } else if (operation.kind === "binary") {
    const left = values.get(operation.left);
    const right = values.get(operation.right);
    if (left?.kind !== "constant" || right?.kind !== "constant") return null;
    const a = ordinalOperand(left);
    const b = ordinalOperand(right);
    if (operation.operator === "&") value = a & b;
    else if (operation.operator === "|") value = a | b;
    else if (operation.operator === "^") value = a ^ b;
    else if (operation.operator === "+") value = a + b;
    else if (operation.operator === "-") value = a - b;
    else if ((operation.operator === "<<" || operation.operator === ">>") && b >= 0n) {
      const width = BigInt(operation.integer?.width ?? typeBytes(operation.type) * 8);
      const count = b > width ? width : b;
      value = operation.operator === "<<" ? a << count : a >> count;
    }
  }
  if (
    value === undefined ||
    !("result" in operation) ||
    operation.result === null ||
    (operation.type.kind !== "scalar" && operation.type.kind !== "enum")
  )
    return null;
  const bytes = typeBytes(operation.type);
  const signed = isSignedType(operation.type);
  return Object.freeze({
    kind: "constant",
    value: normalizedOrdinal(value, bytes, signed),
    bytes,
    signed,
  });
}

/**
 * Hand existing unsigned maxima to indexed accesses and byte shifts at the actual use.
 * Source values and their homes keep their declared widths. Shared/address-exposed
 * bindings never acquire reload facts, and unknown writes/calls discard such facts.
 * Already captured immutable values retain their meaning. No recurrence is inferred.
 */
export function ordinalBoundsForFunction(
  blocks: readonly SemanticBlock[],
  input: MachineLoweringInput,
  selectedLoops: readonly FixedLoopFacts[] = [],
  sourceLoops: readonly FixedLoopFacts[] = [],
): ReadonlyMap<SemanticOperation, ReadonlyMap<string, bigint>> {
  const hasIndexedAccess = blocks.some((block) =>
    block.operations.some((operation) =>
      placeUses(operation).some(({ place }) => place.path.some(({ kind }) => kind === "index")),
    ),
  );
  /**
   * A single-byte raw access may be a proved `constant + ordinal` address.
   * Its use-site bound must be derived here so the address can stay native
   * instead of being computed into a temporary word.
   */
  const hasRawAddress = blocks.some((block) =>
    block.operations.some(
      (operation) =>
        (operation.kind === "memory-read" || operation.kind === "memory-write") &&
        operation.width === 1,
    ),
  );
  /** Wider-result shifts retain their existing full-count selection. */
  const isByteShift = (
    operation: SemanticOperation,
  ): operation is Extract<SemanticOperation, { kind: "binary" }> =>
    operation.kind === "binary" &&
    (operation.operator === "<<" || operation.operator === ">>") &&
    typeBytes(operation.type) === 1;
  if (
    !hasIndexedAccess &&
    !hasRawAddress &&
    !blocks.some(({ operations }) => operations.some(isByteShift))
  )
    return new Map();
  const definitions = valueDefinitions(blocks);
  const literal = literalResolver(definitions);
  // Constant counts use fixed-shift selection. Do not invoke a guarded walk
  // solely because a function contains a compile-time shift expression.
  if (
    !hasIndexedAccess &&
    !hasRawAddress &&
    !blocks.some(({ operations }) =>
      operations.some(
        (operation) => isByteShift(operation) && literal(operation.right) === undefined,
      ),
    )
  )
    return new Map();
  const bound = ordinalBoundResolver(definitions, literal);
  const unstableRoots = new Set(
    input.program.semantic.globals.map(({ id }) => bindingIdentityKey(id)),
  );
  for (const block of blocks)
    for (const operation of block.operations)
      if (operation.kind === "place-address")
        unstableRoots.add(bindingIdentityKey(operation.place.root));
  const windows = [...input.profile.storage.ram, ...input.profile.storage.zeroPage];
  const guarded = guardedOrdinalBounds(
    blocks[0]!.id,
    blocks,
    definitions,
    unstableRoots,
    literal,
    bound,
    (operation) =>
      operation.kind === "call" ||
      operation.kind === "indirect-call" ||
      operation.kind === "platform" ||
      (operation.kind === "store" && operation.place.path.length > 0) ||
      (operation.kind === "aggregate" &&
        operation.destination?.kind === "place" &&
        operation.destination.place.path.length > 0) ||
      (operation.kind === "memory-write" &&
        rawMayObserve(literal(operation.address), operation.width, windows)),
  );
  const result = new Map<SemanticOperation, ReadonlyMap<string, bigint>>();
  const loopBounds = new Map<string, bigint>();
  for (const loop of selectedLoops)
    for (const [value, maximum] of loop.valueBounds) {
      const previous = loopBounds.get(value);
      if (previous === undefined || maximum < previous) loopBounds.set(value, maximum);
    }
  /** Source-level loop maxima remain valid when a layout keeps the word counter. */
  const sourceBounds = new Map<string, bigint>();
  for (const loop of sourceLoops)
    for (const [value, maximum] of loop.valueBounds) {
      const previous = sourceBounds.get(value);
      if (previous === undefined || maximum < previous) sourceBounds.set(value, maximum);
    }
  /**
   * Both answers bound this exact value at its use. A general byte maximum from
   * a loop must not hide a tighter mask or dominating guard. Without loop facts,
   * keep the existing use-site-before-ordinary choice and its invalidation rules.
   */
  const maximumAt = (operation: SemanticOperation, value: string): bigint | undefined => {
    const local = guarded.get(operation)?.get(value) ?? bound(value);
    const loop = loopBounds.get(value);
    if (local === undefined) return loop;
    if (loop === undefined) return local;
    return local < loop ? local : loop;
  };
  for (const block of blocks)
    for (const operation of block.operations) {
      const ordinals = new Map<string, bigint>();
      if (isByteShift(operation)) {
        const maximum = maximumAt(operation, operation.right);
        if (maximum !== undefined) ordinals.set(operation.right, maximum);
      }
      for (const { place } of placeUses(operation))
        for (const component of place.path)
          if (component.kind === "index") {
            const maximum = maximumAt(operation, component.value);
            if (maximum !== undefined) ordinals.set(component.value, maximum);
          }
      // A raw address keeps its byte ordinal's use-site bound, so the address
      // form can be selected only for a proved unsigned index below 256.
      if (
        (operation.kind === "memory-read" || operation.kind === "memory-write") &&
        operation.width === 1
      ) {
        const address = definitions.get(operation.address);
        if (
          address?.kind === "binary" &&
          address.operator === "+" &&
          address.integer?.width === 16 &&
          address.integer.signed === false
        )
          for (const ordinal of [address.right, address.left]) {
            const maximum = maximumAt(operation, ordinal) ?? sourceBounds.get(ordinal);
            if (maximum !== undefined) {
              ordinals.set(ordinal, maximum);
              break;
            }
          }
      }
      if (ordinals.size > 0) result.set(operation, ordinals);
    }
  return result;
}

/** One dynamic ordinal and the extent of the array selected at that path step. */
interface BoundsIndex {
  readonly value: string;
  readonly extent: number;
  /** Four-byte borrowed parameter home, whose final word is the runtime extent. */
  readonly countHome?: string;
}

/** Walk the declared type so each nested subscript is checked against its own extent. */
function dynamicIndices(
  place: SemanticPlace,
  state: FunctionLoweringState,
  source: SourceSpan,
): BoundsIndex[] {
  if (place.rootType === undefined) {
    throw loweringFailure("Indexed place has no declared root type for bounds checking", source);
  }
  let current = place.rootType;
  const indices: BoundsIndex[] = [];
  const parameter = state.input.program.semantic.functions
    .find(({ id }) => bindingIdentityKey(id) === bindingIdentityKey(state.owner))
    ?.parameters.find(({ id }) => bindingIdentityKey(id) === bindingIdentityKey(place.root));
  const countHome = parameter?.outerUnsized
    ? `${bindingIdentityKey(state.owner)}:parameter:${bindingIdentityKey(place.root)}`
    : null;
  let outer = true;
  for (const component of place.path) {
    if (component.kind === "field") {
      if (current.kind !== "struct") throw loweringFailure("Field has no packed struct", source);
      const field = current.fields.find(({ name }) => name === component.name);
      if (field === undefined) throw loweringFailure("Packed field is missing", source);
      current = field.type;
      continue;
    }
    if (current.kind !== "array") throw loweringFailure("Index has no fixed array", source);
    const value = state.values.get(component.value);
    if (value === undefined || value.kind === "condition" || value.kind === "register") {
      throw loweringFailure("Array ordinal was not retained before the bounds check", source);
    }
    if (outer && countHome !== null) {
      indices.push({ value: component.value, extent: current.length, countHome });
    } else if (value.kind !== "constant" && !state.fixedLoops?.indexViews.has(component.value)) {
      indices.push({ value: component.value, extent: current.length });
    }
    outer = false;
    current = current.element;
  }
  return indices;
}

/** Split one selected dynamic access into inline comparisons and a normal hot-path continuation. */
export function lowerBoundsGuards(
  place: SemanticPlace,
  state: FunctionLoweringState,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
  stopLabel: string,
  source: SourceSpan,
): { readonly blocks: readonly MachineBlock[]; readonly continuation: string } | null {
  const indices = dynamicIndices(place, state, source);
  if (indices.length === 0) return null;
  const cpu = state.input.profile.cpu;
  const blocks: MachineBlock[] = [];
  let label = entryLabel;
  let instructions = [...prefix];
  const nextLabel = (index: number, part: string) =>
    `${entryLabel}.bounds.${ordinal}.${index}.${part}`;
  const branch = (
    opcode: "bcs" | "bcc" | "bne" | "bmi",
    target: string,
    fallthrough: string,
  ): MachineTerminator =>
    Object.freeze({
      kind: "branch" as const,
      opcode,
      target,
      fallthrough,
      uses: machineState([], [opcode === "bmi" ? "n" : opcode === "bne" ? "z" : "c"]),
      cost: machineCost(cpu, opcode, "relative"),
    });
  const emit = (terminator: MachineTerminator, next: string): void => {
    blocks.push(Object.freeze({ label, instructions: Object.freeze(instructions), terminator }));
    label = next;
    instructions = [];
  };
  const immediate = (value: number) => Object.freeze({ kind: "immediate" as const, value });
  const load = (value: string, offset: number): void => {
    const retained = state.values.get(value);
    if (retained === undefined) throw loweringFailure("Array ordinal is missing", source);
    instructions.push(loadA(retained, offset, state, source));
  };

  for (const [index, selected] of indices.entries()) {
    const value = state.values.get(selected.value);
    if (value === undefined || value.kind === "condition" || value.kind === "register") {
      throw loweringFailure("Array ordinal was not retained before the bounds check", source);
    }
    const pass = nextLabel(index, "pass");
    const extent = selected.extent;
    if (selected.countHome !== undefined) {
      const count: LoweredValue = Object.freeze({
        kind: "storage",
        requestId: selected.countHome,
        offset: 2,
        bytes: 2,
      });
      if (value.signed) {
        load(selected.value, value.bytes - 1);
        const nonnegative = nextLabel(index, "nonnegative");
        emit(branch("bmi", stopLabel, nonnegative), nonnegative);
      }
      if (value.bytes === 1) {
        instructions.push(loadA(count, 1, state, source));
        const compareLow = nextLabel(index, "low");
        emit(branch("bne", pass, compareLow), compareLow);
      } else if (value.bytes === 2) {
        load(selected.value, 1);
        instructions.push(
          machineInstruction(
            cpu,
            "cmp",
            "storage",
            Object.freeze({ kind: "storage", requestId: selected.countHome, offset: 3 }),
            [],
            source,
          ),
        );
        const compareHigh = nextLabel(index, "high");
        emit(branch("bcc", pass, compareHigh), compareHigh);
        const compareLow = nextLabel(index, "low");
        emit(branch("bne", stopLabel, compareLow), compareLow);
      } else {
        throw loweringFailure("Array ordinal exceeds word width", source);
      }
      load(selected.value, 0);
      instructions.push(
        machineInstruction(
          cpu,
          "cmp",
          "storage",
          Object.freeze({ kind: "storage", requestId: selected.countHome, offset: 2 }),
          [],
          source,
        ),
      );
      emit(branch("bcs", stopLabel, pass), pass);
      continue;
    }
    if (extent === 0) {
      emit(
        Object.freeze({
          kind: "jump",
          opcode: "jmp",
          target: stopLabel,
          cost: machineCost(cpu, "jmp", "absolute"),
        }),
        pass,
      );
      continue;
    }
    if (value.bytes === 1) {
      if ((!value.signed && extent >= 256) || (value.signed && extent >= 128)) {
        if (value.signed) {
          load(selected.value, 0);
          emit(branch("bmi", stopLabel, pass), pass);
        }
        continue;
      }
      load(selected.value, 0);
      instructions.push(machineInstruction(cpu, "cmp", "immediate", immediate(extent), [], source));
      emit(branch("bcs", stopLabel, pass), pass);
      continue;
    }
    if (value.bytes !== 2) throw loweringFailure("Array ordinal exceeds word width", source);
    if (value.signed && extent >= 32768) {
      load(selected.value, 1);
      emit(branch("bmi", stopLabel, pass), pass);
      continue;
    }
    const high = extent >> 8;
    const low = extent & 0xff;
    load(selected.value, 1);
    if (high === 0) {
      const lowLabel = nextLabel(index, "low");
      emit(branch("bne", stopLabel, lowLabel), lowLabel);
    } else if (low === 0) {
      instructions.push(machineInstruction(cpu, "cmp", "immediate", immediate(high), [], source));
      emit(branch("bcs", stopLabel, pass), pass);
      continue;
    } else {
      const above = nextLabel(index, "above");
      const lowLabel = nextLabel(index, "low");
      instructions.push(machineInstruction(cpu, "cmp", "immediate", immediate(high), [], source));
      emit(branch("bcc", pass, above), above);
      emit(branch("bne", stopLabel, lowLabel), lowLabel);
    }
    load(selected.value, 0);
    instructions.push(machineInstruction(cpu, "cmp", "immediate", immediate(low), [], source));
    emit(branch("bcs", stopLabel, pass), pass);
  }
  if (blocks.length === 0) return null;
  return Object.freeze({ blocks: Object.freeze(blocks), continuation: label });
}
