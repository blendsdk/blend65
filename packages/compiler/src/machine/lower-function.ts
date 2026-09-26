import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type {
  SemanticBlock,
  SemanticOperation,
  SemanticTerminator,
} from "../semantic/operations.js";
import type { StorageRequest } from "../storage/storage-types.js";
import { lowerTerminator, machineCost, machineInstruction, machineState } from "./lower-control.js";
import { prepareAggregateInduction } from "./lower-induction.js";
import { lowerOperation } from "./lower-operation.js";
import { selectRegisterForwarding } from "./lower-register-forwarding.js";
import { lowerIndirectCall, lowerInterruptSink } from "./lower-indirect.js";
import { lowerVariableShift } from "./lower-variable-shift.js";
import { lowerCheckedDivision } from "./lower-checked-division.js";
import { lowerBoundsGuards } from "./lower-bounds.js";
import { lowerAggregateReturn, lowerAggregateReturnLoop } from "./lower-aggregate-return.js";
import {
  hasLargeAggregateMember,
  lowerLargeAggregateBuild,
  lowerLargeCapturedAggregatePlace,
} from "./lower-aggregate-build.js";
import { lowerAggregatePlaceCopyLoop } from "./lower-aggregate-copy.js";
import { canUseByteFillLoop, lowerAggregateByteFillLoop } from "./lower-aggregate-fill.js";
import type {
  MachineBlock,
  MachineDataObject,
  MachineFunction,
  MachineInstruction,
  MachineLoweringInput,
} from "./machine-types.js";
import {
  loweringFailure,
  typeBytes,
  type AggregateAddressCache,
  type FunctionLoweringState,
  appendLoadA,
  storeA,
} from "./lower-state.js";

/** Return each distinct successor for the local control-flow facts. */
function semanticSuccessors(terminator: SemanticTerminator): readonly string[] {
  if (terminator.kind === "jump") return Object.freeze([terminator.target]);
  if (terminator.kind !== "branch") return Object.freeze([]);
  return terminator.whenTrue === terminator.whenFalse
    ? Object.freeze([terminator.whenTrue])
    : Object.freeze([terminator.whenTrue, terminator.whenFalse]);
}

/** Lower one ordered block list into one machine function. */
export function lowerFunction(
  id: string,
  owner: BindingId,
  blocks: readonly SemanticBlock[],
  input: MachineLoweringInput,
  requests: StorageRequest[],
  generatedData: Map<string, MachineDataObject>,
  helperUses: {
    readonly id: string;
    readonly caller: BindingId;
    readonly requestIds: readonly string[];
    readonly source: SourceSpan;
  }[],
  warnings: ProjectDiagnostic[],
  returnsToStartup: boolean,
  interruptDepth: Readonly<{ irq: number; nmi: number }> = { irq: 0, nmi: 0 },
  instructionSites?: Set<SemanticOperation | SemanticTerminator>,
): MachineFunction {
  const blockIndexes = new Map(blocks.map((block, index) => [block.id, index] as const));
  const predecessors = new Map(blocks.map((block) => [block.id, [] as string[]] as const));
  for (const block of blocks) {
    for (const successor of semanticSuccessors(block.terminator)) {
      const incoming = predecessors.get(successor);
      if (incoming !== undefined) incoming.push(block.id);
    }
  }
  const positions = Object.freeze(
    blocks.flatMap((block) =>
      Array.from({ length: block.operations.length + 1 }, (_, operation) =>
        Object.freeze({ block: block.id, operation }),
      ),
    ),
  );
  const materializedValues = new Set<string>();
  const valueUseCounts = new Map<string, number>();
  const aggregateDestinations = new Map(
    blocks.flatMap((block) =>
      block.operations.flatMap((operation) =>
        operation.kind === "aggregate"
          ? [
              [
                operation.result,
                operation.destination?.kind === "place" ? operation.destination.place : null,
              ] as const,
            ]
          : [],
      ),
    ),
  );
  const retainedAggregateResults = new Set<string>();
  const recordUse = (
    value: string,
    consumer: (typeof blocks)[number]["operations"][number] | null,
  ): void => {
    materializedValues.add(value);
    valueUseCounts.set(value, (valueUseCounts.get(value) ?? 0) + 1);
    if (!aggregateDestinations.has(value)) return;
    const destination = aggregateDestinations.get(value);
    if (
      consumer?.kind === "store" &&
      destination !== null &&
      destination !== undefined &&
      (consumer.place === destination ||
        (consumer.place.path.length === 0 &&
          destination.path.length === 0 &&
          bindingIdentityKey(consumer.place.root) === bindingIdentityKey(destination.root)))
    ) {
      return;
    }
    retainedAggregateResults.add(value);
  };
  const addressValues = new Set<string>();
  for (const block of blocks) {
    for (const operation of block.operations) {
      if (
        operation.kind === "load" ||
        operation.kind === "store" ||
        operation.kind === "place-address"
      ) {
        for (const component of operation.place.path) {
          if (component.kind === "index") {
            addressValues.add(component.value);
            recordUse(component.value, operation);
          }
        }
      }
      if (operation.kind === "store") recordUse(operation.value, operation);
      else if (operation.kind === "convert") recordUse(operation.operand, operation);
      else if (operation.kind === "unary") recordUse(operation.operand, operation);
      else if (operation.kind === "binary" || operation.kind === "bcd") {
        recordUse(operation.left, operation);
        recordUse(operation.right, operation);
      } else if (operation.kind === "call" || operation.kind === "platform") {
        for (const argument of operation.arguments) recordUse(argument, operation);
      } else if (operation.kind === "indirect-call") {
        recordUse(operation.target, operation);
        for (const argument of operation.arguments) recordUse(argument, operation);
      } else if (operation.kind === "memory-read") recordUse(operation.address, operation);
      else if (operation.kind === "memory-write") {
        recordUse(operation.address, operation);
        recordUse(operation.value, operation);
      } else if (operation.kind === "aggregate") {
        for (const element of operation.elements) recordUse(element.value, operation);
        if (operation.fill !== null) recordUse(operation.fill, operation);
      } else if (operation.kind === "merge") {
        for (const incoming of operation.incoming) recordUse(incoming.value, operation);
      }
    }
    if (block.terminator.kind === "return" && block.terminator.value !== null) {
      recordUse(block.terminator.value, null);
    }
  }
  const singleUseValues = new Set(
    [...valueUseCounts].filter(([, uses]) => uses === 1).map(([value]) => value),
  );
  const {
    forwardedRegisterValues,
    directBcdWrites,
    subtractRightInX,
    wordAddLeftHighInY,
    wordSubtractLeftHighInY,
    wordSubtractRightLowStaged,
  } = selectRegisterForwarding(blocks, singleUseValues);
  const state: FunctionLoweringState = {
    owner,
    interruptDepth,
    values: new Map(),
    aggregatePlaces: new Map(),
    directCallerResults: new Set(),
    requests,
    input,
    allPositions: positions,
    branchConditions: new Set(
      blocks.flatMap(({ terminator }) =>
        terminator.kind === "branch" ? [terminator.condition] : [],
      ),
    ),
    materializedValues,
    forwardedRegisterValues,
    directBcdWrites,
    subtractRightInX,
    wordAddLeftHighInY,
    wordSubtractLeftHighInY,
    wordSubtractRightLowStaged,
    singleUseValues,
    retainedAggregateResults,
    addressValues,
    callSpans: Object.freeze(
      blocks.flatMap((block) =>
        block.operations.flatMap((operation) =>
          operation.kind === "call" || operation.kind === "indirect-call" ? [operation.span] : [],
        ),
      ),
    ),
    mergeCopies: [],
    generatedData,
    helperBlocks: [],
    multiplyHelpers: new Map(),
    divideHelpers: new Map(),
    loadOrigins: new Map(),
    divisionReuse: null,
    helperUses: [],
    warnings: [],
    currentSemanticBlockId: blocks[0]?.id ?? "entry",
    aggregateAddressCache: null,
    aggregateInduction: null,
  };
  const sourceResult = input.program.semantic.functions.find(
    (candidate) => bindingIdentityKey(candidate.id) === bindingIdentityKey(owner),
  )?.result;
  state.aggregateInduction = prepareAggregateInduction(blocks, state);
  const loweredBlocks: MachineBlock[] = [];
  const semanticExitLabels = new Map<string, string>();
  const aggregateAddressCacheAtExit = new Map<string, AggregateAddressCache | null>();
  const boundsStopLabel = `${blocks[0]?.id ?? id}.bounds.stop`;
  let boundsStopSource: SourceSpan | null = null;
  let indirectCallIndex = 0;
  for (const block of blocks) {
    state.currentSemanticBlockId = block.id;
    state.divisionReuse = null;
    const incoming = predecessors.get(block.id) ?? [];
    const blockIndex = blockIndexes.get(block.id)!;
    const incomingCaches =
      incoming.length > 0 &&
      incoming.every((predecessor) => {
        const predecessorIndex = blockIndexes.get(predecessor);
        return (
          predecessorIndex !== undefined &&
          predecessorIndex < blockIndex &&
          aggregateAddressCacheAtExit.has(predecessor)
        );
      })
        ? incoming.map((predecessor) => aggregateAddressCacheAtExit.get(predecessor) ?? null)
        : [];
    const firstIncomingCache = incomingCaches[0] ?? null;
    state.aggregateAddressCache =
      firstIncomingCache !== null &&
      incomingCaches.every((cache) => cache !== null && cache.key === firstIncomingCache.key)
        ? firstIncomingCache
        : null;
    if (state.aggregateInduction?.header === block.id) {
      state.aggregateAddressCache = state.aggregateInduction.cache;
    }
    let currentLabel = block.id;
    let currentInstructions: MachineInstruction[] = [];
    let waitIndex = 0;
    let variableShiftIndex = 0;
    let checkedDivisionIndex = 0;
    let checkedBoundsIndex = 0;
    let aggregateCopyIndex = 0;
    let aggregateFillIndex = 0;
    let aggregateBuildIndex = 0;
    let aggregateCaptureIndex = 0;
    let precedingSite: SemanticOperation | SemanticTerminator | null = null;
    let precedingInstructions = 0;
    let precedingBlocks = 0;
    /**
     * Record actual emission, including operations which split the current block.
     * Inspect the preceding site so every existing early continuation is covered.
     */
    const recordInstructionSite = (): void => {
      if (
        precedingSite !== null &&
        (currentInstructions.length !== precedingInstructions ||
          loweredBlocks.length !== precedingBlocks)
      ) {
        instructionSites?.add(precedingSite);
      }
    };
    for (const operation of block.operations) {
      recordInstructionSite();
      precedingSite = operation;
      precedingInstructions = currentInstructions.length;
      precedingBlocks = loweredBlocks.length;
      if (
        input.boundsCheck === true &&
        (operation.kind === "load" ||
          operation.kind === "store" ||
          operation.kind === "place-address") &&
        operation.place.path.some((component) => component.kind === "index")
      ) {
        const checked = lowerBoundsGuards(
          operation.place,
          state,
          currentLabel,
          currentInstructions,
          checkedBoundsIndex,
          boundsStopLabel,
          operation.span,
        );
        if (checked !== null) {
          loweredBlocks.push(...checked.blocks);
          currentLabel = checked.continuation;
          currentInstructions = [];
          boundsStopSource ??= operation.span;
          checkedBoundsIndex += 1;
        }
      }
      const divisor = operation.kind === "binary" ? state.values.get(operation.right) : undefined;
      if (
        input.divisionZeroCheck === true &&
        operation.kind === "binary" &&
        (operation.operator === "/" || operation.operator === "%") &&
        (divisor?.kind !== "constant" || divisor.value === 0)
      ) {
        state.divisionReuse = null;
        const lowered = lowerCheckedDivision(
          operation,
          state,
          currentLabel,
          currentInstructions,
          checkedDivisionIndex,
        );
        loweredBlocks.push(...lowered.blocks);
        currentLabel = lowered.continuation;
        currentInstructions = [];
        checkedDivisionIndex += 1;
        continue;
      }
      if (
        operation.kind === "binary" &&
        (operation.operator === "<<" || operation.operator === ">>") &&
        state.values.get(operation.right)?.kind !== "constant"
      ) {
        state.divisionReuse = null;
        const lowered = lowerVariableShift(
          operation,
          state,
          currentLabel,
          currentInstructions,
          variableShiftIndex,
        );
        loweredBlocks.push(...lowered.blocks);
        currentLabel = lowered.continuation;
        currentInstructions = [...lowered.continuationInstructions];
        variableShiftIndex += 1;
        continue;
      }
      if (operation.kind === "aggregate" && canUseByteFillLoop(operation, state)) {
        const filled = lowerAggregateByteFillLoop(
          operation,
          state,
          currentLabel,
          currentInstructions,
          aggregateFillIndex,
        );
        loweredBlocks.push(...filled.blocks);
        currentLabel = filled.continuation;
        currentInstructions = [...filled.continuationInstructions];
        aggregateFillIndex += 1;
        continue;
      }
      if (
        operation.kind === "store" &&
        (operation.type.kind === "array" || operation.type.kind === "struct") &&
        operation.type.size >= 8
      ) {
        const source = state.aggregatePlaces.get(operation.value);
        if (source !== undefined) {
          state.divisionReuse = null;
          state.aggregateAddressCache = null;
          const copied = lowerAggregatePlaceCopyLoop(
            operation,
            source,
            state,
            currentLabel,
            currentInstructions,
            aggregateCopyIndex,
          );
          if (copied !== null) {
            loweredBlocks.push(...copied.blocks);
            currentLabel = copied.continuation;
            currentInstructions = [...copied.continuationInstructions];
            aggregateCopyIndex += 1;
            continue;
          }
        }
      }
      if (
        operation.kind === "place-address" &&
        operation.captureValue === true &&
        typeBytes(operation.type) >= 8
      ) {
        const captured = lowerLargeCapturedAggregatePlace(
          operation,
          state,
          currentLabel,
          currentInstructions,
          aggregateCaptureIndex,
        );
        loweredBlocks.push(...captured.blocks);
        currentLabel = captured.continuation;
        currentInstructions = [];
        aggregateCaptureIndex += 1;
        continue;
      }
      if (operation.kind === "aggregate" && hasLargeAggregateMember(operation)) {
        const built = lowerLargeAggregateBuild(
          operation,
          state,
          currentLabel,
          currentInstructions,
          aggregateBuildIndex,
        );
        loweredBlocks.push(...built.blocks);
        currentLabel = built.continuation;
        currentInstructions = [...built.continuationInstructions];
        aggregateBuildIndex += 1;
        continue;
      }
      if (operation.kind === "indirect-call") {
        const targets = input.program.indirectTargets?.get(operation) ?? [];
        const dispatched = lowerIndirectCall(
          operation,
          targets,
          state,
          currentLabel,
          currentInstructions,
          indirectCallIndex,
        );
        loweredBlocks.push(...dispatched.blocks);
        currentLabel = dispatched.continuation;
        currentInstructions = [...dispatched.continuationInstructions];
        indirectCallIndex += 1;
        continue;
      }
      if (operation.kind === "platform") {
        const routes = (input.program.interruptRoutes ?? []).filter(
          ({ installation }) => installation === operation,
        );
        if (routes.length > 1) {
          const dispatched = lowerInterruptSink(
            operation,
            routes,
            state,
            currentLabel,
            currentInstructions,
            indirectCallIndex,
          );
          loweredBlocks.push(...dispatched.blocks);
          currentLabel = dispatched.continuation;
          currentInstructions = [];
          indirectCallIndex += 1;
          continue;
        }
      }
      if (operation.kind !== "platform" || operation.capability !== "c64.video.waitNextFrame") {
        currentInstructions.push(...lowerOperation(operation, state));
        continue;
      }

      const waitInstructions = lowerOperation(operation, state);
      if (waitInstructions.length !== 4) {
        throw loweringFailure(
          "Frame wait did not produce its two raster-line comparisons",
          operation.span,
        );
      }
      const highLabel =
        currentInstructions.length === 0 ? currentLabel : `${block.id}.wait.${waitIndex}.high`;
      const lowLabel = `${block.id}.wait.${waitIndex}.low`;
      const continuationLabel = `${block.id}.wait.${waitIndex}.continue`;
      if (currentInstructions.length > 0) {
        loweredBlocks.push(
          Object.freeze({
            label: currentLabel,
            instructions: Object.freeze(currentInstructions),
            terminator: Object.freeze({ kind: "fallthrough", target: highLabel }),
          }),
        );
      }
      loweredBlocks.push(
        Object.freeze({
          label: highLabel,
          instructions: Object.freeze([waitInstructions[0]!, waitInstructions[1]!]),
          terminator: Object.freeze({
            kind: "branch",
            opcode: "beq",
            target: highLabel,
            fallthrough: lowLabel,
            uses: machineState([], ["z"]),
            cost: machineCost(input.profile.cpu, "beq", "relative"),
          }),
        }),
        Object.freeze({
          label: lowLabel,
          instructions: Object.freeze([waitInstructions[2]!, waitInstructions[3]!]),
          terminator: Object.freeze({
            kind: "branch",
            opcode: "bne",
            target: lowLabel,
            fallthrough: continuationLabel,
            uses: machineState([], ["z"]),
            cost: machineCost(input.profile.cpu, "bne", "relative"),
          }),
        }),
      );
      currentLabel = continuationLabel;
      currentInstructions = [];
      waitIndex += 1;
    }
    recordInstructionSite();
    precedingSite = block.terminator;
    precedingInstructions = currentInstructions.length;
    precedingBlocks = loweredBlocks.length;
    if (state.aggregateInduction?.preheader === block.id) {
      currentInstructions.push(...state.aggregateInduction.initialization);
      state.aggregateAddressCache = state.aggregateInduction.cache;
    }
    if (block.terminator.kind === "return" && block.terminator.value !== null) {
      if (sourceResult?.kind === "array" || sourceResult?.kind === "struct") {
        const loop =
          sourceResult.size >= 8
            ? lowerAggregateReturnLoop(
                block.terminator.value,
                sourceResult,
                state,
                owner.span,
                currentLabel,
                currentInstructions,
                aggregateCopyIndex,
              )
            : null;
        if (loop === null) {
          currentInstructions.push(
            ...lowerAggregateReturn(block.terminator.value, sourceResult, state, owner.span),
          );
        } else {
          loweredBlocks.push(...loop.blocks);
          currentLabel = loop.continuation;
          currentInstructions = [];
        }
      } else {
        const returned = state.values.get(block.terminator.value);
        if (returned === undefined || returned.kind === "condition") {
          throw loweringFailure("Return value was not retained", state.owner.span);
        }
        if (returned.kind === "register") {
          if (
            (returned.bytes === 1 && returned.registers !== "a") ||
            (returned.bytes === 2 && returned.registers !== "ax")
          ) {
            throw loweringFailure(
              "Return register shape does not match its width",
              state.owner.span,
            );
          }
        } else if (returned.bytes === 2) {
          appendLoadA(currentInstructions, returned, 1, state, state.owner.span);
          currentInstructions.push(
            machineInstruction(input.profile.cpu, "tax", "implied", null, [], state.owner.span),
          );
          appendLoadA(currentInstructions, returned, 0, state, state.owner.span);
        } else {
          appendLoadA(currentInstructions, returned, 0, state, state.owner.span);
        }
      }
    }
    if (block.terminator.kind === "branch") {
      const condition = state.values.get(block.terminator.condition);
      if (condition === undefined) {
        throw loweringFailure("Branch condition was not retained", state.owner.span);
      }
      if (condition.kind !== "condition") {
        appendLoadA(currentInstructions, condition, 0, state, state.owner.span);
      }
    }
    recordInstructionSite();
    loweredBlocks.push(
      Object.freeze({
        label: currentLabel,
        instructions: Object.freeze(currentInstructions),
        terminator: lowerTerminator(
          block.terminator,
          state.values,
          input.profile.cpu,
          returnsToStartup,
        ),
      }),
    );
    semanticExitLabels.set(block.id, currentLabel);
    aggregateAddressCacheAtExit.set(block.id, state.aggregateAddressCache);
  }
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
  if (boundsStopSource !== null) {
    loweredBlocks.push(
      Object.freeze({
        label: boundsStopLabel,
        instructions: Object.freeze([
          machineInstruction(input.profile.cpu, "sei", "implied", null, [], boundsStopSource),
        ]),
        terminator: Object.freeze({
          kind: "jump" as const,
          opcode: "jmp" as const,
          target: boundsStopLabel,
          cost: machineCost(input.profile.cpu, "jmp", "absolute"),
        }),
      }),
    );
  }
  helperUses.push(...state.helperUses.map((use) => Object.freeze({ ...use, caller: owner })));
  warnings.push(...state.warnings);
  const sourceName = input.bindingNames?.get(bindingIdentityKey(owner));
  return Object.freeze({
    id,
    blocks: Object.freeze([...loweredBlocks, ...state.helperBlocks]),
    ...(sourceName === undefined ? {} : { sourceName }),
  });
}
