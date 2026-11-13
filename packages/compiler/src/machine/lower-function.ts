import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { InterruptExecutionContext } from "../semantic/interrupt-contexts.js";
import type {
  SemanticBlock,
  SemanticOperation,
  SemanticTerminator,
} from "../semantic/operations.js";
import type { StorageRequest } from "../storage/storage-types.js";
import { lowerTerminator, machineCost, machineInstruction, machineState } from "./lower-control.js";
import {
  prepareFixedLoops,
  enterFixedLoopBlock,
  selectFixedLoopOperation,
  finishFixedLoopBlock,
  finishFixedLoops,
  prepareFixedCounterStorage,
  lowerFixedCounterOperation,
} from "./fixed-loop-selection.js";
import { prepareAggregateInduction } from "./lower-induction.js";
import { byteComplementNoCode } from "./byte-value-availability.js";
import { prepareByteComplements } from "./lower-unary.js";
import { lowerOperation } from "./lower-operation.js";
import { lowerBooleanBranch } from "./lower-boolean-branch.js";
import { appendMergeCopies } from "./lower-merge-copies.js";
import { appendImmediateByteBitwise, appendScalarPrefix } from "./lower-scalar.js";
import { canOmitComparisonCaptureReload } from "./byte-capture-observers.js";
import {
  selectRegisterForwarding,
  selectZeroReturn,
  selectByteWindows,
} from "./lower-register-forwarding.js";
import { lowerIndirectCall, lowerInterruptSink } from "./lower-indirect.js";
import { lowerVariableShift } from "./lower-variable-shift.js";
import { selectGuardedShiftCount } from "./lower-guarded-shift.js";
import { hasByteReturnArms, selectTerminalByteLeaves } from "./lower-terminal-byte.js";
import { lowerCheckedDivision } from "./lower-checked-division.js";
import { lowerBoundsGuards, ordinalBoundsForFunction } from "./lower-bounds.js";
import { lowerAggregateReturn, lowerAggregateReturnLoop } from "./lower-aggregate-return.js";
import {
  hasLargeAggregateMember,
  lowerLargeAggregateBuild,
  lowerLargeCapturedAggregatePlace,
} from "./lower-aggregate-build.js";
import { lowerAggregatePlaceCopyLoop } from "./lower-aggregate-copy.js";
import { appendConstantConstruction } from "./lower-aggregate-members.js";
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
  functionValueUses,
} from "./lower-state.js";

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
  interruptDepth: InterruptExecutionContext = { domain: "main", irq: 0, nmi: 0 },
  instructionSites?: Set<SemanticOperation | SemanticTerminator>,
): MachineFunction {
  const fixedLoops = prepareFixedLoops(blocks, input, owner, interruptDepth.domain);
  const { blockIndexes, predecessors, positions } = fixedLoops;
  const { materializedValues, singleUseValues, retainedAggregateResults, addressValues } =
    functionValueUses(blocks);
  const sourceFunction = input.program.semantic.functions.find(
    (candidate) => bindingIdentityKey(candidate.id) === bindingIdentityKey(owner),
  );
  const sourceFacts =
    sourceFunction === undefined ? undefined : input.sourceFacts?.functions.get(sourceFunction);
  const complements =
    input.sourceFacts?.nonLoopBundle === "closed" &&
    interruptDepth.domain === "main" &&
    sourceFunction?.entryKind !== "interrupt"
      ? sourceFacts?.complements
      : undefined;
  const complementFree =
    complements === undefined
      ? undefined
      : byteComplementNoCode(complements, input.placement, blocks, input.logicalStorage);
  const loopFacts =
    input.optimizationFacts === undefined
      ? []
      : (sourceFacts?.loops ??
        (sourceFunction === undefined
          ? []
          : (input.optimizationFacts.functions.get(sourceFunction)?.loops ?? [])));
  /**
   * Metadata-only construction keeps the prior conservative bounds query while
   * still collecting authentic observer annotations for the final proof.
   */
  const boundsInput =
    input.metadataOnly === true ? Object.freeze({ ...input, observerEvidence: false }) : input;
  const ordinalBounds = ordinalBoundsForFunction(
    blocks,
    boundsInput,
    fixedLoops.counterFacts,
    loopFacts,
  );
  const {
    forwardedRegisterValues,
    zeroFlagValues,
    booleanValues,
    booleanShiftValues,
    booleanBranchValues,
    byteOrdinalAdditions,
    ordinalRawReads,
    ordinalRawWrites,
    directBcdWrites,
    staticRawAddresses,
    subtractRightInX,
    wordAddLeftHighInY,
    wordSubtractLeftHighInY,
    wordSubtractRightLowStaged,
  } = selectRegisterForwarding(
    blocks,
    singleUseValues,
    ordinalBounds,
    input.program.semantic.functions,
    complementFree?.noCode,
    complementFree?.addressValues,
  );
  const state: FunctionLoweringState = {
    owner,
    fixedLoops,
    ...(sourceFacts === undefined ? {} : { sourceFacts }),
    interruptDepth,
    values: new Map(),
    ...(input.observerEvidence &&
    interruptDepth.domain === "main" &&
    interruptDepth.activationRoot === undefined
      ? { aggregateCaptures: [] }
      : {}),
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
    forwardedRegisterValues: new Set(forwardedRegisterValues),
    zeroFlagValues: new Set(zeroFlagValues),
    booleanValues: new Set(booleanValues),
    booleanShiftValues: new Map(booleanShiftValues),
    booleanBranchValues,
    elidedLocalBindings: input.elidedLocalBindings ?? new Set<string>(),
    byteOrdinalAdditions,
    ...(input.observerEvidence === true && input.optimizationFacts !== undefined
      ? { ordinalRawReads, ordinalRawWrites }
      : {}),
    directBcdWrites,
    staticRawAddresses,
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
  const sourceResult = sourceFunction?.result;
  state.aggregateInduction = prepareAggregateInduction(blocks, state);
  prepareFixedCounterStorage(state, ordinalBounds);
  if (complements !== undefined && complementFree !== undefined)
    state.byteComplements = prepareByteComplements(complements, state, blocks, complementFree);
  const loweredBlocks: MachineBlock[] = [];
  const semanticExitLabels = new Map<string, string>();
  const aggregateAddressCacheAtExit = new Map<string, AggregateAddressCache | null>();
  const boundsStopLabel = `${blocks[0]?.id ?? id}.bounds.stop`;
  let boundsStopSource: SourceSpan | null = null;
  let indirectCallIndex = 0;
  for (const block of fixedLoops.blocks) {
    enterFixedLoopBlock(block, state);
    const occurrenceStart = loweredBlocks.length;
    const byteReturnArms = !returnsToStartup && hasByteReturnArms(block, blocks, blockIndexes);
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
    let constructionLiteral: number | null = null;
    let waitIndex = 0;
    let variableShiftIndex = 0;
    let checkedDivisionIndex = 0;
    let checkedBoundsIndex = 0;
    let booleanBranchIndex = 0;
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
    for (let operationIndex = 0; operationIndex < block.operations.length; operationIndex += 1) {
      const operation = block.operations[operationIndex]!;
      const currentBounds = ordinalBounds.get(operation);
      if (currentBounds === undefined) delete state.ordinalBounds;
      else state.ordinalBounds = currentBounds;
      const constantConstruction =
        operation.kind === "aggregate" &&
        operation.destination?.kind === "place" &&
        operation.destination.freshConstant === true;
      if (operation.kind !== "constant" && operation.kind !== "convert" && !constantConstruction) {
        constructionLiteral = null;
      }
      recordInstructionSite();
      precedingSite = operation;
      precedingInstructions = currentInstructions.length;
      precedingBlocks = loweredBlocks.length;
      if (selectFixedLoopOperation(operation, state)) continue;
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
        constructionLiteral = null;
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
        const home = state.values.get(operation.result);
        if (constantConstruction && built.blocks.length === 0 && home?.kind === "storage") {
          constructionLiteral = appendConstantConstruction(
            currentInstructions,
            built.continuationInstructions.slice(currentInstructions.length),
            constructionLiteral,
            home.requestId,
          );
        } else {
          currentInstructions = [...built.continuationInstructions];
          constructionLiteral = null;
        }
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
      if (
        operation.kind === "binary" &&
        (operation.operator === "==" || operation.operator === "!=") &&
        (state.booleanBranchValues.has(operation.left) ||
          state.booleanBranchValues.has(operation.right)) &&
        state.materializedValues.has(operation.result)
      ) {
        const maskedId = state.booleanBranchValues.has(operation.left)
          ? operation.left
          : operation.right;
        const masked = state.values.get(maskedId);
        const inA =
          (masked?.kind === "register" && masked.registers === "a" && masked.bytes === 1) ||
          (masked?.kind === "zero-extended" &&
            masked.low.kind === "register" &&
            masked.low.registers === "a" &&
            masked.low.bytes === 1);
        if (inA) {
          const split = lowerBooleanBranch(
            operation,
            state,
            currentLabel,
            currentInstructions,
            booleanBranchIndex,
          );
          loweredBlocks.push(...split.blocks);
          currentLabel = split.continuation;
          currentInstructions = [];
          state.values.set(
            operation.result,
            Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
          );
          state.forwardedRegisterValues.add(operation.result);
          booleanBranchIndex += 1;
          continue;
        }
        // A selected masked value may have folded to a constant (for example a
        // single-use constant local). Withdraw the premature forwarding claim
        // and let the ordinary comparison fold materialize the constant.
        state.forwardedRegisterValues.delete(operation.result);
      }
      if (operation.kind !== "platform" || operation.capability !== "c64.video.waitNextFrame") {
        const selected =
          lowerFixedCounterOperation(operation, state, operationIndex) ??
          lowerOperation(operation, state, undefined, block, byteReturnArms, operationIndex);
        const home =
          "result" in operation && operation.result !== null
            ? state.values.get(operation.result)
            : undefined;
        if (constantConstruction && home?.kind === "storage") {
          constructionLiteral = appendConstantConstruction(
            currentInstructions,
            selected,
            constructionLiteral,
            home.requestId,
          );
        } else {
          if (
            operation.kind === "binary" &&
            ["^", "|"].includes(operation.operator) &&
            typeBytes(operation.type) === 1
          )
            appendImmediateByteBitwise(currentInstructions, selected, input.profile.cpu);
          else
            appendScalarPrefix(
              currentInstructions,
              selected,
              operation,
              operation.kind === "binary" &&
                ["==", "!=", "<", "<=", ">", ">="].includes(operation.operator) &&
                canOmitComparisonCaptureReload(input, sourceFunction, currentInstructions),
            );
          if (selected.length > 0) {
            // A local composition can append real code without growing the list.
            // Record its source site directly so IRQ boundary analysis retains it.
            instructionSites?.add(operation);
            constructionLiteral = null;
          }
        }
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
    precedingSite = fixedLoops.current?.source.terminator ?? block.terminator;
    precedingInstructions = currentInstructions.length;
    precedingBlocks = loweredBlocks.length;
    if (state.aggregateInduction?.preheader === block.id) {
      currentInstructions.push(...state.aggregateInduction.initialization);
      state.aggregateAddressCache = state.aggregateInduction.cache;
    }
    currentInstructions.push(...(state.byteComplements?.prefixes.get(block.id) ?? []));
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
    finishFixedLoopBlock(loweredBlocks, occurrenceStart, state);
    semanticExitLabels.set(block.id, currentLabel);
    aggregateAddressCacheAtExit.set(block.id, state.aggregateAddressCache);
  }
  appendMergeCopies(state, loweredBlocks, semanticExitLabels);
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
  let selectedBlocks = selectTerminalByteLeaves(
    Object.freeze([...loweredBlocks, ...state.helperBlocks]),
    state,
    returnsToStartup,
    sourceFunction,
  );
  // Select the complete EOR/reload replacement before zero-return shaping.
  // An EOR-based omitted LDA #0 is not a valid return contract for preserved A.
  const byteSelection =
    sourceFunction !== undefined &&
    sourceFunction.entryKind !== "interrupt" &&
    input.sourceFacts?.nonLoopBundle === "closed"
      ? selectByteWindows(
          { id, blocks: selectedBlocks },
          sourceFunction.id,
          input.profile.cpu,
          interruptDepth.domain,
          state,
        )
      : null;
  if (byteSelection !== null) selectedBlocks = byteSelection.blocks;
  return finishFixedLoops(
    Object.freeze({
      id,
      sourceFunction: owner,
      ...(state.aggregateCaptures?.length
        ? { observerCaptures: Object.freeze(state.aggregateCaptures) }
        : {}),
      ...(input.sourceFacts?.nonLoopBundle === undefined &&
      input.sourceFacts?.loopPolicy === undefined &&
      !input.observerEvidence
        ? {}
        : { executionContext: Object.freeze({ ...interruptDepth }) }),
      blocks: selectGuardedShiftCount(
        !returnsToStartup && sourceResult?.kind === "scalar" && sourceResult.name === "boolean"
          ? selectZeroReturn(selectedBlocks)
          : selectedBlocks,
        state,
        returnsToStartup,
        sourceFunction,
      ),
      ...(sourceName === undefined ? {} : { sourceName }),
      ...(byteSelection?.byteAvailabilityProofs === undefined
        ? {}
        : { byteAvailabilityProofs: byteSelection.byteAvailabilityProofs }),
      ...(byteSelection?.nativeStoreProofs === undefined
        ? {}
        : { nativeStoreProofs: byteSelection.nativeStoreProofs }),
      ...(state.byteComplements?.proofs.length
        ? { byteComplementProofs: state.byteComplements.proofs }
        : {}),
    }),
    fixedLoops,
  );
}
