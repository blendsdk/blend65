import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticFunction, SemanticOperation } from "../semantic/operations.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { CpuFacts } from "../target/nmos6510.js";
import { selectedStoragePlace } from "../storage/selection.js";
import {
  deriveBooleanExitFacts,
  machineInstruction,
  validBooleanExitFacts,
  type LoweredValue,
} from "./lower-control.js";
import { byteContinuationQuery, BYTE_WINDOW_CHANGED } from "./lower-control.js";
import { prepareAggregateCallResult } from "./lower-aggregate-return.js";
import type { MachineFunction, MachineInstruction, MachineOperand } from "./machine-types.js";
import type { FunctionStorageSelection } from "../storage/selection.js";
import {
  loweringFailure,
  appendLoadA,
  bindingLabel,
  isSignedType,
  loweredPlace,
  retainMachineValue,
  storeA,
  type FunctionLoweringState,
  typeBytes,
  functionValueUses,
} from "./lower-state.js";

/**
 * Bind generated occurrence labels after the existing execution-context rewrite.
 * @param fn Actual specialized machine function, including its rewritten blocks.
 * @param sourceId Unchanged pre-specialization machine function identity.
 * @param requestId Existing context-specific storage identity rewrite.
 * @returns Context-bound provenance, or the original function when unselected.
 * @throws {LoweringFailure} If the context rewrite lost a selected occurrence.
 */
export function bindFixedLoopContext(
  fn: MachineFunction,
  sourceId: string,
  requestId: (id: string) => string = (id) => id,
): MachineFunction {
  if (
    fn.fixedLoopProofs === undefined &&
    fn.fixedCounterProofs === undefined &&
    fn.nativeStoreProofs === undefined &&
    fn.observerBlocks === undefined
  )
    return fn;
  if (!fn.id.startsWith(sourceId))
    throw loweringFailure("Fixed-loop context has no source function identity", null);
  const suffix = fn.id.slice(sourceId.length);
  const labels = new Set(fn.blocks.map((block) => block.label));
  const proofs = fn.fixedLoopProofs?.map((proof) =>
    Object.freeze({
      ...proof,
      context: fn.id,
      occurrences: Object.freeze(
        proof.occurrences.map((occurrence) =>
          Object.freeze({
            ...occurrence,
            blocks: Object.freeze(
              occurrence.blocks.map((label) => {
                const selected = `${label}${suffix}`;
                if (!labels.has(selected))
                  throw loweringFailure(
                    "Fixed-loop occurrence was lost during context selection",
                    proof.loop.comparison.span,
                  );
                return selected;
              }),
            ),
          }),
        ),
      ),
    }),
  );
  const counters = fn.fixedCounterProofs?.map((proof) =>
    Object.freeze({
      ...proof,
      context: fn.id,
      originalRequestId: requestId(proof.originalRequestId),
      requestId: proof.requestId === null ? null : requestId(proof.requestId),
      reads: Object.freeze(
        proof.reads.map((read) =>
          Object.freeze({
            ...read,
            stagingRequestId:
              read.stagingRequestId === null ? null : requestId(read.stagingRequestId),
          }),
        ),
      ),
    }),
  );
  const stores = fn.nativeStoreProofs?.map((proof) => {
    const block = `${proof.block}${suffix}`;
    if (!labels.has(block))
      throw loweringFailure(
        "Native store window was lost during context selection",
        proof.consumer.span,
      );
    return Object.freeze({
      ...proof,
      context: fn.id,
      block,
      captureRequestId: requestId(proof.captureRequestId),
      variableRequestId: requestId(proof.variableRequestId),
      removed: Object.freeze(
        proof.removed.map((instruction) =>
          Object.freeze({
            ...instruction,
            operand:
              instruction.operand?.kind === "storage"
                ? Object.freeze({
                    ...instruction.operand,
                    requestId: requestId(instruction.operand.requestId),
                  })
                : instruction.operand,
          }),
        ),
      ),
    });
  });
  return Object.freeze({
    ...fn,
    ...(fn.observerBlocks === undefined
      ? {}
      : {
          observerBlocks: Object.freeze(
            fn.observerBlocks.map(([source, blocks]) =>
              Object.freeze([
                source,
                Object.freeze(
                  blocks.map((label) => {
                    const selected = `${label}${suffix}`;
                    if (!labels.has(selected))
                      throw loweringFailure(
                        "Source observer block was lost during context selection",
                        fn.sourceFunction?.span ?? null,
                      );
                    return selected;
                  }),
                ),
              ] as const),
            ),
          ),
        }),
    ...(proofs === undefined ? {} : { fixedLoopProofs: Object.freeze(proofs) }),
    ...(counters === undefined ? {} : { fixedCounterProofs: Object.freeze(counters) }),
    ...(stores === undefined ? {} : { nativeStoreProofs: Object.freeze(stores) }),
  });
}

/**
 * Recognize a direct call whose first and only parameter consumes the current A.
 * Its declared byte home is written before any result-address setup or JSR.
 * Reuse the closed source signature rather than assuming every scalar is a byte;
 * aggregate, wider, interrupt-entry and unknown callees keep stable arguments.
 * The adjacency owner must separately prove the value's sole use and live A.
 * @param operation The next source call, with arguments already evaluated in order.
 * @param argument The sole byte value still held in A.
 * @param functions Closed source declarations used by the existing marshaller.
 * @returns Whether the unchanged parameter marshaller can consume A immediately.
 */
export function canReceiveByteArgumentInA(
  operation: Extract<SemanticOperation, { readonly kind: "call" }>,
  argument: string,
  functions: readonly SemanticFunction[],
): boolean {
  if (operation.arguments.length !== 1 || operation.arguments[0] !== argument) return false;
  const callee = functions.find(
    ({ id }) => bindingIdentityKey(id) === bindingIdentityKey(operation.callee),
  );
  const parameter = callee?.parameters[0];
  return (
    callee?.entryKind !== "interrupt" &&
    callee?.parameters.length === 1 &&
    parameter !== undefined &&
    parameter.outerUnsized !== true &&
    (parameter.type.kind === "scalar" || parameter.type.kind === "enum") &&
    typeBytes(parameter.type) === 1
  );
}

/** Copy an aggregate argument's address into its two-byte by-reference parameter home. */
function marshalAggregateAddress(
  instructions: MachineInstruction[],
  argument: LoweredValue,
  destination: LoweredValue,
  state: FunctionLoweringState,
  operation: Extract<SemanticOperation, { readonly kind: "call" }>,
): void {
  if (
    argument.kind === "storage" &&
    (argument.requestId.includes(":parameter:") ||
      argument.requestId.includes(":aggregate-address:"))
  ) {
    for (let offset = 0; offset < 2; offset += 1) {
      appendLoadA(instructions, argument, offset, state, operation.span);
      instructions.push(storeA(destination, offset, state, operation.span));
    }
    return;
  }
  if (argument.kind !== "storage" && argument.kind !== "label") {
    throw loweringFailure("Aggregate call argument has no materialized address", operation.span);
  }
  for (const addressByte of ["low", "high"] as const) {
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "lda",
        "immediate",
        argument.kind === "storage"
          ? Object.freeze({
              kind: "storage" as const,
              requestId: argument.requestId,
              offset: 0,
              addressByte,
            })
          : Object.freeze({
              kind: "label" as const,
              label: argument.label,
              offset: 0,
              addressByte,
            }),
        [],
        operation.span,
      ),
    );
    instructions.push(storeA(destination, addressByte === "low" ? 0 : 1, state, operation.span));
  }
}

/** Select the agreed fixed result before generic preparation can request its hidden pointer. */
function fixedCallResult(
  operation: Extract<SemanticOperation, { readonly kind: "call" }>,
  selection: FunctionStorageSelection | undefined,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } | null {
  if (
    selection?.result == null ||
    operation.result === null ||
    (operation.type.kind !== "array" && operation.type.kind !== "struct")
  )
    return null;
  if (!selection.result.calls.some((call) => call.operation === operation))
    throw loweringFailure("Fixed result has no matching source call", operation.span);
  const place = selectedStoragePlace(selection.result.origin.place, selection);
  const result = loweredPlace(place, operation.type.size, false, state);
  if (operation.aggregateDestination?.kind === "caller")
    state.directCallerResults.add(operation.result);
  else
    state.aggregatePlaces.set(
      operation.result,
      operation.aggregateDestination?.kind === "place"
        ? operation.aggregateDestination.place
        : place,
    );
  return { instructions: Object.freeze([]), result };
}

/** Deliver a fixed owner's real destination when the next callee keeps generic result ABI. */
function genericCallResult(
  operation: Extract<SemanticOperation, { readonly kind: "call" }>,
  state: FunctionLoweringState,
) {
  if (
    operation.result === null ||
    (operation.type.kind !== "array" && operation.type.kind !== "struct")
  )
    throw loweringFailure(
      "Generic aggregate call result has no aggregate source value",
      operation.span,
    );
  const fixedOwner = state.sourceFacts?.storage?.result;
  const bridge = operation.aggregateDestination?.kind === "caller" && fixedOwner != null;
  const destination = bridge
    ? {
        kind: "place" as const,
        place: selectedStoragePlace(fixedOwner.origin.place, state.sourceFacts?.storage),
      }
    : operation.aggregateDestination;
  const prepared = prepareAggregateCallResult(
    operation.result,
    operation.callee,
    operation.type,
    destination,
    state,
    operation.span,
  );
  if (bridge) state.directCallerResults.add(operation.result);
  return prepared;
}

/** Marshal one direct call and retain its scalar or caller-owned aggregate result. */
export function lowerDirectCall(
  operation: Extract<SemanticOperation, { readonly kind: "call" }>,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  const callee = state.input.program.semantic.functions.find(
    ({ id }) => bindingIdentityKey(id) === bindingIdentityKey(operation.callee),
  );
  if (callee === undefined || callee.parameters.length !== operation.arguments.length) {
    throw loweringFailure("Direct call has no matching semantic parameter list", operation.span);
  }
  const instructions: MachineInstruction[] = [];
  const selected = state.input.sourceFacts?.functions.get(callee)?.storage;
  for (let index = 0; index < operation.arguments.length; index += 1) {
    const argument = state.values.get(operation.arguments[index]!);
    const parameter = callee.parameters[index]!;
    if (argument === undefined || argument.kind === "condition") {
      throw loweringFailure("Direct-call argument was not retained", operation.span);
    }
    // The shared fixed entry consumes the same already evaluated whole object.
    // No home is requested or written for an address encoded by that entry.
    const fixedParameter = selected?.parameters.get(bindingIdentityKey(parameter.id));
    if (fixedParameter !== undefined) {
      if (!fixedParameter.calls.some((call) => call.operation === operation))
        throw loweringFailure("Fixed parameter has no matching source call", operation.span);
      continue;
    }
    const destination = loweredPlace(
      Object.freeze({ root: parameter.id, path: Object.freeze([]), rootType: parameter.type }),
      parameter.type.kind === "array" || parameter.type.kind === "struct"
        ? 2
        : typeBytes(parameter.type),
      isSignedType(parameter.type),
      state,
    );
    if (destination.kind !== "storage") {
      throw loweringFailure("Callee parameter has no certified static home", operation.span);
    }
    if (parameter.type.kind === "array" || parameter.type.kind === "struct") {
      marshalAggregateAddress(instructions, argument, destination, state, operation);
      if (parameter.outerUnsized) {
        const count = operation.argumentArrayCounts?.[index];
        if (count === undefined || count === null) {
          throw loweringFailure(
            "Borrowed array argument has no outer element count",
            operation.span,
          );
        }
        const countValue: LoweredValue =
          count.kind === "fixed"
            ? Object.freeze({ kind: "constant", value: count.count, bytes: 2 })
            : Object.freeze({
                kind: "storage",
                requestId: `${bindingIdentityKey(state.owner)}:parameter:${bindingIdentityKey(count.binding)}`,
                offset: 2,
                bytes: 2,
              });
        for (let offset = 0; offset < 2; offset += 1) {
          appendLoadA(instructions, countValue, offset, state, operation.span);
          instructions.push(storeA(destination, offset + 2, state, operation.span));
        }
      }
    } else {
      for (let offset = 0; offset < typeBytes(parameter.type); offset += 1) {
        appendLoadA(instructions, argument, offset, state, operation.span);
        instructions.push(storeA(destination, offset, state, operation.span));
      }
    }
  }
  const aggregateResult =
    operation.result !== null &&
    (operation.type.kind === "array" || operation.type.kind === "struct")
      ? (fixedCallResult(operation, selected, state) ?? genericCallResult(operation, state))
      : null;
  if (aggregateResult !== null) instructions.push(...aggregateResult.instructions);
  const label = bindingLabel("fn", operation.callee);
  instructions.push(
    machineInstruction(
      state.input.profile.cpu,
      "jsr",
      "absolute",
      Object.freeze({ kind: "label", label }),
      [],
      operation.span,
    ),
  );
  if (operation.result !== null) {
    if (aggregateResult !== null) {
      state.values.set(operation.result, aggregateResult.result);
      return Object.freeze(instructions);
    }
    const retained = retainMachineValue(
      operation.result,
      Object.freeze({
        kind: "register",
        registers: typeBytes(operation.type) === 1 ? "a" : "ax",
        bytes: typeBytes(operation.type) === 1 ? 1 : 2,
        signed: isSignedType(operation.type),
      }),
      instructions,
      operation.type,
      operation.span,
      state,
    );
    state.values.set(operation.result, retained.value);
    return retained.instructions;
  }
  return Object.freeze(instructions);
}

/** Conditional post-call selection, retaining every removed access and changed machine interval. */
export interface BooleanCallProof {
  /** Callee certificate consumed, or a fresh fallback value test inserted instead. */
  readonly kind: "certified" | "retest";
  /** Actual source caller; only ordinary mainline contexts participate. */
  readonly function: BindingId;
  /** Exact source direct call, never a function display-name match. */
  readonly call: Extract<SemanticOperation, { readonly kind: "call" }>;
  /** Actual selected callee label after execution-context specialization. */
  readonly callee: string;
  /** Original and selected block identity containing the final condition branch. */
  readonly block: string;
  /** Reference suffix, including capture writes/reloads or explicit flag retests. */
  readonly removed: readonly MachineInstruction[];
  /** Explicit fallback test when an already branch-only call lacked proved returned flags. */
  readonly added: readonly MachineInstruction[];
  /** Physical/reference-home, transient A/P/X and asynchronous checks are still required. */
  readonly pendingObservers: true;
}

/** Match one exact ordinary private-byte operand, not an indexed, volatile or raw address. */
function sameCapturedByte(left: MachineOperand | null, right: MachineOperand | null): boolean {
  return (
    left?.kind === "storage" &&
    right?.kind === "storage" &&
    left.addressByte === undefined &&
    right.addressByte === undefined &&
    left.requestId === right.requestId &&
    (left.offset ?? 0) === (right.offset ?? 0)
  );
}

/**
 * Consume selected callee flags only at exact branch-only source calls.
 * All bodies and context labels must already exist. No public ABI is strengthened,
 * and removed capture homes remain in the inventory until observer/storage closure.
 * @param functions Fully selected machine bodies, before resource binding and final layout.
 * @param owners Actual mainline ordinary source owners, recorded by the lowering loop.
 * @param cpu Selected CPU forms for a required fallback test, not a public ABI assumption.
 * @returns Unchanged bodies or conditional selections with fresh all-exit callee checks.
 */
export function selectBooleanCallFlags(
  functions: readonly MachineFunction[],
  owners: ReadonlyMap<string, SemanticFunction>,
  cpu: CpuFacts,
): readonly MachineFunction[] {
  const byId = new Map(functions.map((fn) => [fn.id, fn]));
  const facts = new Map(
    functions.flatMap((fn) => {
      const source = owners.get(fn.id);
      if (source?.result.kind !== "scalar" || source.result.name !== "boolean") return [];
      const proof = deriveBooleanExitFacts(fn);
      return proof === null ? [] : [[fn.id, proof] as const];
    }),
  );
  const selected = functions.map((fn) => {
    const source = owners.get(fn.id);
    if (source === undefined) return fn;
    const uses = functionValueUses(source.blocks);
    const branches = source.blocks.flatMap((block) =>
      block.terminator.kind === "branch" ? [block.terminator.condition] : [],
    );
    const candidates = source.blocks.flatMap((block) => {
      if (block.terminator.kind !== "branch") return [];
      const condition = block.terminator.condition;
      const last = block.operations.at(-1);
      const negated =
        last?.kind === "unary" &&
        last.operator === "!" &&
        last.result === block.terminator.condition &&
        !uses.materializedValues.has(last.result);
      const call = negated ? block.operations.at(-2) : last;
      if (
        call?.kind !== "call" ||
        call.result === null ||
        call.type.kind !== "scalar" ||
        call.type.name !== "boolean" ||
        (negated
          ? last?.kind !== "unary" ||
            last.operand !== call.result ||
            !uses.singleUseValues.has(call.result) ||
            branches.includes(call.result)
          : call.result !== block.terminator.condition ||
            uses.materializedValues.has(call.result)) ||
        branches.filter((value) => value === condition).length !== 1
      )
        return [];
      return [{ call, negated }];
    });
    const safePrefix = byteContinuationQuery(
      new Map(fn.blocks.map((block) => [block.label, block])),
    );
    const proofs: BooleanCallProof[] = [];
    const blocks = fn.blocks.map((block) => {
      const edge = block.terminator;
      if (
        edge.kind !== "branch" ||
        !["beq", "bne"].includes(edge.opcode) ||
        !edge.uses.flags.includes("z")
      )
        return block;
      // Only the final call can own flags at this branch. Argument setup stays untouched.
      const callIndex = block.instructions.findLastIndex(
        (instruction) => instruction.opcode === "jsr",
      );
      const instruction = block.instructions[callIndex];
      if (
        instruction?.operand?.kind !== "label" ||
        instruction.operand.addressByte !== undefined ||
        (instruction.operand.offset ?? 0) !== 0 ||
        instruction.source === null
      )
        return block;
      const callee = byId.get(instruction.operand.label);
      const proof = facts.get(instruction.operand.label);
      const calleeSource = callee === undefined ? undefined : owners.get(callee.id);
      if (
        callee === undefined ||
        calleeSource?.result.kind !== "scalar" ||
        calleeSource.result.name !== "boolean"
      )
        return block;
      const candidate = candidates.find(
        ({ call }) =>
          call.span.sourceId === instruction.source?.sourceId &&
          call.span.start === instruction.source.start &&
          call.span.end === instruction.source.end &&
          bindingIdentityKey(call.callee) === bindingIdentityKey(calleeSource.id),
      );
      if (candidate === undefined || edge.opcode !== (candidate.negated ? "beq" : "bne"))
        return block;
      const suffix = block.instructions.slice(callIndex + 1);
      if (suffix.some((item) => item.memory.some((effect) => effect.volatile))) return block;
      const certified = proof !== undefined && validBooleanExitFacts(proof, callee);
      if (!certified && (suffix.length !== 0 || candidate.negated)) return block;
      // A retest must not leak a changed carry into either continuation. Prefer the
      // canonical CMP #0 test when C is dead on both edges; otherwise AND #$FF sets
      // N/Z from the same returned A and leaves C and V untouched.
      const carrySafe = (target: string) => safePrefix(target, 0, BYTE_WINDOW_CHANGED.c);
      const retestPreservesCarry = !carrySafe(edge.target) || !carrySafe(edge.fallthrough);
      const added = certified
        ? []
        : retestPreservesCarry
          ? [
              machineInstruction(
                cpu,
                "and",
                "immediate",
                { kind: "immediate", value: 0xff },
                [],
                candidate.call.span,
              ),
            ]
          : [
              machineInstruction(
                cpu,
                "cmp",
                "immediate",
                { kind: "immediate", value: 0 },
                [],
                candidate.call.span,
              ),
            ];
      const captured =
        suffix.length === 2 &&
        suffix[0]?.opcode === "sta" &&
        suffix[1]?.opcode === "lda" &&
        sameCapturedByte(suffix[0].operand, suffix[1].operand) &&
        !candidate.negated;
      const test = suffix.length === 1 ? suffix[0] : undefined;
      const changed =
        test?.opcode === "tax"
          ? BYTE_WINDOW_CHANGED.x
          : test?.opcode === "cmp" &&
              test.mode === "immediate" &&
              test.operand?.kind === "immediate" &&
              test.operand.value === 0
            ? BYTE_WINDOW_CHANGED.c
            : null;
      if (
        suffix.length !== 0 &&
        !captured &&
        (changed === null ||
          !candidate.negated ||
          !safePrefix(edge.target, 0, changed) ||
          !safePrefix(edge.fallthrough, 0, changed))
      )
        return block;
      proofs.push(
        Object.freeze({
          kind: certified ? "certified" : "retest",
          function: source.id,
          call: candidate.call,
          callee: callee.id,
          block: block.label,
          removed: Object.freeze(suffix),
          added: Object.freeze(added),
          pendingObservers: true,
        }),
      );
      return Object.freeze({
        ...block,
        instructions: Object.freeze([...block.instructions.slice(0, callIndex + 1), ...added]),
      });
    });
    return proofs.length === 0
      ? fn
      : Object.freeze({
          ...fn,
          blocks: Object.freeze(blocks),
          booleanCallProofs: Object.freeze([...(fn.booleanCallProofs ?? []), ...proofs]),
        });
  });
  // Recheck actual final callees after all local selections, independent of source order.
  const finalById = new Map(selected.map((fn) => [fn.id, fn]));
  const required = new Set(
    selected.flatMap((fn) =>
      (fn.booleanCallProofs ?? [])
        .filter((proof) => proof.kind === "certified")
        .map((proof) => proof.callee),
    ),
  );
  for (const id of required) {
    const fn = finalById.get(id);
    if (fn === undefined || deriveBooleanExitFacts(fn) === null)
      throw loweringFailure("Selected Boolean callee lost its all-exit flag proof", null);
  }
  return Object.freeze(selected);
}
