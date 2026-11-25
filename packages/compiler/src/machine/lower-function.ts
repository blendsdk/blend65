import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { selectAnonymousComparisonValues } from "./sprite-publication-proof.js";
import { selectAnonymousByteWriteValues } from "./byte-write-forwarding.js";
import { selectForwardedWordAssignments } from "./word-assignment-forwarding.js";
import { lowerWordUnitStep, wordUnitStepHome } from "./lower-word-unit-step.js";
import { valueDefinitions } from "../semantic/aggregate-place-proof.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { InterruptExecutionContext } from "../semantic/interrupt-contexts.js";
import { nmiLocalElisionKey, nmiStackPlan } from "../semantic/nmi-register-locals.js";
import type {
  SemanticBlock,
  SemanticOperation,
  SemanticPlace,
  SemanticTerminator,
} from "../semantic/operations.js";
import type { StorageRequest } from "../storage/storage-types.js";
import {
  bindingLabel,
  lowerTerminator,
  machineCost,
  machineInstruction,
  machineState,
} from "./lower-control.js";
import { selectHeldByteEntryLoads } from "./held-byte.js";
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
import { lowerMaskedComparison } from "./lower-mask-branch.js";
import { appendMergeCopies } from "./lower-merge-copies.js";
import { appendImmediateByteBitwise, appendScalarPrefix } from "./lower-scalar.js";
import {
  canOmitComparisonCaptureReload,
  canOmitRepeatedSourceLoad,
  hasNoAsynchronousInterleaving,
} from "./byte-capture-observers.js";
import {
  selectRegisterForwarding,
  selectZeroReturn,
  selectByteWindows,
} from "./lower-register-forwarding.js";
import { calleeNeverReturns } from "./call-returning-facts.js";
import { lowerIndirectCall, lowerInterruptSink } from "./lower-indirect.js";
import { potentialValueInputs } from "../semantic/value-lifetimes.js";
import { constantValue } from "../semantic/raw-write-kills.js";
import { vicFieldAcceptsModuleStorage, vicFieldTransformOf } from "../target/vic-fetch.js";
import type { VicFieldAddressRefusal } from "./vic-fields.js";
import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import { lowerVariableShift } from "./lower-variable-shift.js";
import { selectGuardedShiftCount } from "./lower-guarded-shift.js";
import { hasByteReturnArms, selectTerminalByteLeaves } from "./lower-terminal-byte.js";
import { selectSwitchDispatch } from "./switch-dispatch.js";
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

/** One layout-resolved block-index label and its static byte offset. */
interface BlockIndexLabel {
  readonly label: string;
  readonly offset: number;
}

/**
 * Record on one `txs` how many stack bytes the frame unwind it performs releases.
 *
 * Raising the stack pointer by a computed amount is the cheap way to drop a run of dead bytes, but
 * it tells a reader of the instruction stream alone nothing about what the stack now holds. The
 * count is known here and nowhere else afterwards, so it travels with the instruction instead of
 * being inferred later from the arithmetic that produced the new pointer.
 *
 * The figure is the depth this unwind was selected for, measured from the base the matching `tsx`
 * captured — which is the same base the emitted arithmetic adds to, so a pop taken in between is
 * accounted for by both in the same way.
 *
 * @param instruction The emitted `txs`.
 * @param bytes Exact number of released bytes, relative to the captured base.
 * @returns The same instruction carrying its released-byte count.
 * @example releasingStack(instruction("txs"), 9)
 */
function releasingStack(instruction: MachineInstruction, bytes: number): MachineInstruction {
  return Object.freeze({ ...instruction, releasesStackBytes: bytes });
}

/** Static field/constant-index offset of one addressed place. */
function staticPlaceOffset(
  place: SemanticPlace,
  definitions: ReadonlyMap<string, SemanticOperation>,
): number | null {
  let type = place.rootType;
  let offset = 0;
  for (const step of place.path) {
    if (step.kind === "field") {
      if (type?.kind !== "struct") return null;
      const field = type.fields.find(({ name }) => name === step.name);
      if (field === undefined) return null;
      offset += field.offset;
      type = field.type;
      continue;
    }
    if (type?.kind !== "array") return null;
    const index = constantValue(definitions.get(step.value!), definitions);
    if (index === null || index < 0 || index >= type.length) return null;
    offset += semanticTypeSize(type.element) * index;
    type = type.element;
  }
  return offset;
}

/**
 * How many 64-byte blocks one run-time-selected element spans.
 *
 * The refusal for a run-time index advises selecting with the block number
 * instead of the address, and that advice is only correct scaled by the
 * element's own width: a 128-byte element advances two blocks per index step.
 * Returns null where the step is not a whole number of blocks, so the advice
 * stays general rather than naming a wrong expression.
 */
function selectedElementBlocks(
  place: SemanticPlace,
  definitions: ReadonlyMap<string, SemanticOperation>,
): number | null {
  let type = place.rootType;
  let found: number | null = null;
  for (const step of place.path) {
    if (step.kind === "field") {
      if (type?.kind !== "struct") return null;
      const field = type.fields.find(({ name }) => name === step.name);
      if (field === undefined) return null;
      type = field.type;
      continue;
    }
    if (type?.kind !== "array") return null;
    const stride = semanticTypeSize(type.element);
    if (constantValue(definitions.get(step.value!), definitions) === null) {
      // Two run-time steps have no single stride to advise with.
      if (found !== null) return null;
      if (stride % 64 !== 0) return null;
      found = stride / 64;
    }
    type = type.element;
  }
  return found;
}

/**
 * Find the addresses and block numbers layout can resolve into immediates.
 *
 * Two shapes qualify. A binary block index whose only consumer is a `lo` folds
 * its symbolic address and its `/64` or `>>6` result, so neither stages a
 * pointer nor shifts at run time. A VIC field capability folds the address it
 * was handed, because the field it computes is one immediate byte and the only
 * thing missing is the final address.
 */
function blockIndexFoldValues(
  blocks: readonly SemanticBlock[],
  program: {
    readonly semantic: {
      readonly globals: readonly {
        readonly id: BindingId;
        readonly zeropage?: boolean;
        readonly placement?: { readonly at: number | null } | null;
      }[];
    };
  },
): {
  readonly binaries: ReadonlyMap<string, BlockIndexLabel>;
  readonly addresses: ReadonlyMap<string, BlockIndexLabel>;
  readonly fieldRefusals: ReadonlyMap<string, VicFieldAddressRefusal>;
  readonly fieldElementBlocks: ReadonlyMap<string, number>;
} {
  const definitions = new Map<string, SemanticOperation>();
  for (const block of blocks)
    for (const operation of block.operations) {
      const result = "result" in operation ? operation.result : null;
      if (result !== null && result !== undefined) definitions.set(result, operation);
    }
  const uses = new Map<string, number>();
  const count = (value: string): void => {
    uses.set(value, (uses.get(value) ?? 0) + 1);
  };
  for (const block of blocks) {
    for (const operation of block.operations)
      for (const value of potentialValueInputs(operation)) count(value);
    if (block.terminator.kind === "branch") count(block.terminator.condition);
    else if (block.terminator.kind === "return" && block.terminator.value !== null)
      count(block.terminator.value);
  }
  const binaries = new Map<string, BlockIndexLabel>();
  const addresses = new Map<string, BlockIndexLabel>();
  const fieldRefusals = new Map<string, VicFieldAddressRefusal>();
  const fieldElementBlocks = new Map<string, number>();
  for (const block of blocks) {
    for (const operation of block.operations) {
      if (operation.kind !== "unary" || operation.operator !== "lo") continue;
      const binary = definitions.get(operation.operand);
      if (binary?.kind !== "binary") continue;
      const right = constantValue(definitions.get(binary.right), definitions);
      if (binary.operator === "/" ? right !== 64 : binary.operator === ">>" ? right !== 6 : true)
        continue;
      let address = definitions.get(binary.left);
      while (address?.kind === "convert") address = definitions.get(address.operand);
      if (address?.kind !== "place-address" || address.place.asset !== undefined) continue;
      const rootKey = bindingIdentityKey(address.place.root);
      const global = program.semantic.globals.find(
        (candidate) => bindingIdentityKey(candidate.id) === rootKey,
      );
      if (global === undefined) continue;
      // Explicit placement and zero-page storage keep their exact contract. Only
      // the automatic placement strengthened by the block-index pass can fold.
      if (global.zeropage === true) continue;
      if (global.placement?.at !== null && global.placement?.at !== undefined) continue;
      if ((uses.get(binary.result) ?? 0) !== 1) continue;
      if ((uses.get(address.result) ?? 0) !== 1) continue;
      const offset = staticPlaceOffset(address.place, definitions);
      if (offset === null || offset % 64 !== 0) continue;
      const label = bindingLabel("global", address.place.root);
      binaries.set(binary.result, { label, offset });
      addresses.set(address.result, { label, offset });
    }
  }
  // A VIC field capability asks the compiler for the field value, so its address
  // stays symbolic for the same reason the arithmetic above does — but on the
  // opposite contract. The arithmetic form preserves exactly what the author
  // wrote, which is why an explicit address or a zero-page home is excluded from
  // it; the capability form promises the field is checked at whatever address the
  // object ends up with, so every module object folds and layout answers for it.
  for (const block of blocks) {
    for (const operation of block.operations) {
      if (operation.kind !== "platform") continue;
      const field = vicFieldTransformOf(operation.capability);
      if (field === null) continue;
      const argument = operation.arguments[0];
      if (argument === undefined) continue;
      let address = definitions.get(argument);
      while (address?.kind === "convert") address = definitions.get(address.operand);
      if (address?.kind !== "place-address") continue;
      // Each way of declining to fold is recorded against the argument, because
      // only here is the cause still known. Lowering sees a staged pointer and
      // cannot tell a run-time index from a field this storage cannot serve, and
      // a refusal that cannot name its cause names nothing the author can change.
      // Every decline is recorded before the loop moves on, including the ones
      // that are not this capability's business, so no shape falls through to a
      // sentence written for a different cause.
      const decline = (refusal: VicFieldAddressRefusal): void => {
        fieldRefusals.set(argument, refusal);
      };
      // An asset's own address is kept symbolic elsewhere and folds; a position
      // inside one arrives here, and the field resolves an object's base rather
      // than an offset into it.
      if (address.place.asset !== undefined) {
        if (address.place.path.length > 0) decline("asset-element");
        continue;
      }
      const rootKey = bindingIdentityKey(address.place.root);
      const global = program.semantic.globals.find(
        (candidate) => bindingIdentityKey(candidate.id) === rootKey,
      );
      // A local or a parameter is refused earlier, for the lifetime of the
      // address rather than for the field, so nothing is recorded for it here.
      if (global === undefined) continue;
      if (!vicFieldAcceptsModuleStorage(field)) {
        decline("module-storage");
        continue;
      }
      // A zero-page home is chosen by an allocator that knows nothing of video
      // alignment, so folding would resolve the field against an address the
      // author never wrote and refuse it for a reason they cannot act on.
      if (global.zeropage === true) {
        decline("zero-page");
        continue;
      }
      const offset = staticPlaceOffset(address.place, definitions);
      // A misaligned offset still folds. Layout then names the alignment the
      // field needs, which is what the author can act on; refusing here could
      // only repeat that the address is unusable without saying why.
      if (offset === null) {
        decline("runtime-index");
        const blocks = selectedElementBlocks(address.place, definitions);
        if (blocks !== null) fieldElementBlocks.set(argument, blocks);
        continue;
      }
      // The same address serving another purpose must keep its runtime form;
      // only an address this capability alone consumes can become an immediate.
      // No source shape reaches this: each `&object` mints its own value, and an
      // address kept in a variable arrives as a load. It stays because folding
      // an address another use still needs at run time is a wrong artifact
      // rather than a refusal, and it records no cause of its own precisely
      // because no author can be told about a branch no author can reach.
      if ((uses.get(address.result) ?? 0) !== 1) continue;
      addresses.set(address.result, { label: bindingLabel("global", address.place.root), offset });
    }
  }
  return { binaries, addresses, fieldRefusals, fieldElementBlocks };
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
  // The inventory accumulates retained keys across every handler. A machine
  // context must use only the keys whose places occur in its own body; a
  // function-local plan cannot be derived from another handler's keys.
  const functionBindingKeys = new Set<string>();
  for (const block of blocks)
    for (const operation of block.operations) {
      if (
        operation.kind === "load" ||
        operation.kind === "store" ||
        operation.kind === "place-address"
      )
        functionBindingKeys.add(bindingIdentityKey(operation.place.root));
    }
  const retainedKeys =
    interruptDepth.domain === "nmi" && input.stackRetainedLocalKeys !== undefined
      ? new Set([...input.stackRetainedLocalKeys].filter((key) => functionBindingKeys.has(key)))
      : undefined;
  const {
    forwardedRegisterValues,
    zeroFlagValues,
    booleanValues,
    booleanShiftValues,
    booleanBranchValues,
    booleanMaskTests,
    byteOrdinalAdditions,
    ordinalRawReads,
    ordinalRawWrites,
    directBcdWrites,
    staticRawAddresses,
    forwardedPlaceLoads,
    forwardedStoreLoads,
    forwardedAggregateLoads,
    repeatedFixedPlaceLoads,
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
    input.zeroExtensionValues,
    retainedKeys,
    materializedValues,
    input.program.semantic.globals,
  );
  // The retention proof admitted the shape; this second derivation fixes the
  // same dominance order so every load's slot offset is path-independent. A
  // missing plan is an invariant failure, never a silent depth-zero fallback.
  const stackPlan =
    retainedKeys === undefined || retainedKeys.size === 0
      ? null
      : nmiStackPlan(sourceFunction?.entry ?? blocks[0]!.id, blocks, retainedKeys);
  if (retainedKeys !== undefined && retainedKeys.size > 0 && stackPlan === null)
    throw loweringFailure("Retained NMI bindings have no static stack plan", owner.span);
  const blockIndexFolds = blockIndexFoldValues(blocks, input.program);
  const heldByteValues =
    interruptDepth.domain === "main" ? selectHeldByteEntryLoads(blocks).values : new Set<string>();
  const returnAdjacentValues = new Set<string>();
  for (const block of blocks) {
    if (block.terminator.kind !== "return" || block.terminator.value === null) continue;
    const value = block.terminator.value;
    const definition = block.operations.findIndex(
      (operation) => "result" in operation && operation.result === value,
    );
    if (definition === block.operations.length - 1) returnAdjacentValues.add(value);
  }
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
    returnAdjacentValues,
    heldByteValues,
    blockIndexFolds: blockIndexFolds.binaries,
    blockIndexAddresses: blockIndexFolds.addresses,
    vicFieldRefusals: blockIndexFolds.fieldRefusals,
    vicFieldElementBlocks: blockIndexFolds.fieldElementBlocks,
    forwardedRegisterValues: new Set([
      ...forwardedRegisterValues,
      ...selectAnonymousComparisonValues(
        input,
        sourceFunction,
        blocks,
        singleUseValues,
        materializedValues,
      ),
      // Named rather than passed bare: two adjacent positional booleans would let a transposition
      // read as correct while silently admitting the wrong shape.
      ...selectAnonymousByteWriteValues(
        input,
        sourceFunction,
        blocks,
        singleUseValues,
        /* includeNamedArithmeticStores */ true,
        /* includeHighByteExtractions */ true,
      ),
    ]),
    zeroFlagValues: new Set(zeroFlagValues),
    booleanValues: new Set(booleanValues),
    booleanShiftValues: new Map(booleanShiftValues),
    booleanBranchValues,
    booleanMaskTests,
    elidedLocalBindings: input.elidedLocalBindings ?? new Set<string>(),
    zeroExtensionValues: input.zeroExtensionValues ?? new Set<string>(),
    stackRetainedBindings: input.stackRetainedBindings ?? new Set<string>(),
    stackConsumedValues: input.stackConsumedValues ?? new Set<string>(),
    stackDepth: 0,
    stackSlots:
      stackPlan === null
        ? new Map<string, number>()
        : new Map(
            [...stackPlan.slots].map(([key, slot]) => [
              nmiLocalElisionKey(interruptDepth.domain, interruptDepth.activationRoot, key),
              slot,
            ]),
          ),
    stackXValid: false,
    stackXDepth: 0,
    stackXBulkDepth: null,
    forwardedWordAssignments: selectForwardedWordAssignments(
      input,
      sourceFunction,
      blocks,
      singleUseValues,
      // Loop counters of this body, taken from the checked source facts rather than from the
      // selection runtime: the runtime only exposes them once a narrowing policy is chosen, and
      // the exclusion has to hold in every pass, including the ones that choose nothing.
      new Set((sourceFacts?.loops ?? []).map((loop) => bindingIdentityKey(loop.counter))),
    ),
    forwardedWordResults: new Set<string>(),
    byteOrdinalAdditions,
    ...(input.observerEvidence === true && input.optimizationFacts !== undefined
      ? { ordinalRawReads, ordinalRawWrites }
      : {}),
    directBcdWrites,
    staticRawAddresses,
    forwardedPlaceLoads,
    forwardedStoreLoads,
    forwardedAggregateLoads,
    // The shape fact is settled from the operations; the two admissions it still
    // needs are settled once here rather than at every element load: the
    // omission belongs to the optimized candidate, and nothing asynchronous may
    // run between the two reads.
    repeatedFixedPlaceLoads:
      sourceFunction !== undefined &&
      input.optimizationFacts !== undefined &&
      hasNoAsynchronousInterleaving(input, sourceFunction)
        ? repeatedFixedPlaceLoads
        : new Map<string, string>(),
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
  // Read once for the whole function: the unit-step selection needs the addend's definition, and
  // a constant may be produced in a different block from the arithmetic that consumes it.
  const unitStepDefinitions = valueDefinitions(blocks);
  const semanticExitLabels = new Map<string, string>();
  const aggregateAddressCacheAtExit = new Map<string, AggregateAddressCache | null>();
  const boundsStopLabel = `${blocks[0]?.id ?? id}.bounds.stop`;
  let boundsStopSource: SourceSpan | null = null;
  let indirectCallIndex = 0;
  for (const block of fixedLoops.blocks) {
    enterFixedLoopBlock(block, state);
    // A join must agree on the live push count, and X never survives a block
    // boundary as a usable stack-pointer copy. Both facts are reset here.
    state.stackXValid = false;
    state.stackXBulkDepth = null;
    if (stackPlan !== null) {
      const depth = stackPlan.depths.get(state.currentSemanticBlockId);
      if (depth === undefined)
        throw loweringFailure(
          "Retained NMI block is absent from the static stack plan",
          state.owner.span,
        );
      state.stackDepth = depth;
    }
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
    let unitStepIndex = 0;
    let aggregateCopyIndex = 0;
    let aggregateFillIndex = 0;
    let aggregateBuildIndex = 0;
    let aggregateCaptureIndex = 0;
    let terminalCallIndex = 0;
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
        state.materializedValues.has(operation.result) &&
        (state.booleanMaskTests.has(operation.left) || state.booleanMaskTests.has(operation.right))
      ) {
        const maskedId = state.booleanMaskTests.has(operation.left)
          ? operation.left
          : operation.right;
        const test = state.booleanMaskTests.get(maskedId)!;
        const maskedValue = state.values.get(maskedId);
        // A constant local can fold the masked value below a selected test.
        // Withdraw the forwarding claim and let the ordinary constant
        // comparison materialize the value; never hand a constant to the
        // register/branch lowerer.
        if (maskedValue !== undefined && maskedValue.kind === "constant") {
          state.forwardedRegisterValues.delete(operation.result);
        } else {
          const split = lowerMaskedComparison(
            operation,
            test,
            maskedValue,
            state,
            currentLabel,
            currentInstructions,
            booleanBranchIndex,
          );
          if (split.instructions !== undefined) {
            currentInstructions.push(...split.instructions);
          } else {
            loweredBlocks.push(...split.blocks);
            currentLabel = split.continuation;
            currentInstructions = [];
          }
          state.values.set(
            operation.result,
            Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
          );
          state.forwardedRegisterValues.add(operation.result);
          booleanBranchIndex += 1;
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
        const stackLoad = masked?.kind === "stack";
        const inA =
          (masked?.kind === "register" && masked.registers === "a" && masked.bytes === 1) ||
          (masked?.kind === "zero-extended" &&
            masked.low.kind === "register" &&
            masked.low.registers === "a" &&
            masked.low.bytes === 1) ||
          stackLoad;
        if (inA) {
          if (stackLoad) appendLoadA(currentInstructions, masked, 0, state, operation.span);
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
      const unitStep =
        operation.kind === "binary"
          ? wordUnitStepHome(operation, state, block, operationIndex, unitStepDefinitions)
          : undefined;
      if (operation.kind === "binary" && unitStep !== undefined) {
        // The arithmetic result is this very home, so the store that follows finds it already
        // written and elides itself through the agreement below.
        state.values.set(operation.result, unitStep.home.value);
        // Either form needs a real branch to skip the high byte, which only a terminator can
        // carry, so this operation closes the block being filled and resumes after it. The
        // descending form also hands back the low-byte step both paths must run, which seeds the
        // continuation rather than becoming a block of its own.
        const split = lowerWordUnitStep(
          state,
          unitStep,
          currentLabel,
          currentInstructions,
          unitStepIndex,
          operation.span,
        );
        loweredBlocks.push(...split.blocks);
        currentLabel = split.continuation;
        currentInstructions = [...split.pending];
        state.forwardedWordResults.add(operation.result);
        unitStepIndex += 1;
        continue;
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
              // Named rather than passed bare: two adjacent decisions that both
              // end in dropping the leading load would read as correct transposed.
              /* comparisonCaptureUnobserved */ operation.kind === "binary" &&
                ["==", "!=", "<", "<=", ">", ">="].includes(operation.operator) &&
                canOmitComparisonCaptureReload(input, sourceFunction, currentInstructions),
              /* repeatedSourceLoadOmitted */ canOmitRepeatedSourceLoad(
                input,
                sourceFunction,
                currentInstructions,
                selected,
              ),
            );
          if (selected.length > 0) {
            // A local composition can append real code without growing the list.
            // Record its source site directly so IRQ boundary analysis retains it.
            instructionSites?.add(operation);
            constructionLiteral = null;
          }
        }
        // A callee that cannot return never resumes this function, so the block being filled
        // owns no exit of its own and everything after the call is unreachable. Closing it here
        // is what keeps the generated control flow honest: an exit execution can never take
        // would otherwise claim a producer for the processor state the next instruction reads.
        // The unreachable code itself stays where the author wrote it, because unreachable code
        // is legal source and removing it belongs to optimization rather than to this proof.
        if (operation.kind === "call" && calleeNeverReturns(operation.callee, state)) {
          loweredBlocks.push(
            Object.freeze({
              label: currentLabel,
              instructions: Object.freeze([...currentInstructions]),
              terminator: Object.freeze({ kind: "unreachable" as const }),
            }),
          );
          currentLabel = `${block.id}.call.${terminalCallIndex}.continue`;
          currentInstructions = [];
          terminalCallIndex += 1;
          constructionLiteral = null;
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
    if (block.terminator.kind === "return" && state.stackDepth > 0) {
      state.stackXValid = false;
      const source = state.owner.span;
      if (state.stackXBulkDepth !== null && state.stackDepth >= 6) {
        // X still holds the SP from the last TSX and every remaining slot is
        // dead. Six bytes/ten cycles replace six or more PLA bytes.
        const bulk = state.stackXBulkDepth;
        const instruction = (opcode: string) =>
          machineInstruction(input.profile.cpu, opcode, "implied", null, [], source);
        currentInstructions.push(
          instruction("txa"),
          instruction("clc"),
          machineInstruction(
            input.profile.cpu,
            "adc",
            "immediate",
            Object.freeze({ kind: "immediate", value: bulk }),
            [],
            source,
          ),
          instruction("tax"),
          releasingStack(instruction("txs"), bulk),
        );
        state.stackDepth = 0;
      } else if (state.stackDepth >= 7) {
        // No cached X base (for example a call clobbered it). Re-read the
        // current SP and raise it by the remaining depth; 7 bytes/12 cycles.
        const remaining = state.stackDepth;
        const instruction = (opcode: string) =>
          machineInstruction(input.profile.cpu, opcode, "implied", null, [], source);
        currentInstructions.push(
          instruction("tsx"),
          instruction("txa"),
          instruction("clc"),
          machineInstruction(
            input.profile.cpu,
            "adc",
            "immediate",
            Object.freeze({ kind: "immediate", value: remaining }),
            [],
            source,
          ),
          instruction("tax"),
          releasingStack(instruction("txs"), remaining),
        );
        state.stackDepth = 0;
      } else {
        for (let pop = 0; pop < state.stackDepth; pop += 1)
          currentInstructions.push(
            machineInstruction(input.profile.cpu, "pla", "implied", null, [], source),
          );
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
  // A runtime switch test chain is shaped before terminal/byte selection so no
  // downstream pass has to rediscover the shared selector or equality scratch.
  const dispatch = selectSwitchDispatch(loweredBlocks, input.profile.cpu);
  if (dispatch.removedRequestIds.size > 0) {
    for (let index = state.requests.length - 1; index >= 0; index -= 1) {
      if (dispatch.removedRequestIds.has(state.requests[index]!.id))
        state.requests.splice(index, 1);
    }
  }
  let selectedBlocks = selectTerminalByteLeaves(
    Object.freeze([...dispatch.blocks, ...state.helperBlocks]),
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
      ...(stackPlan !== null
        ? { stackBytes: stackPlan.total }
        : state.stackDepth === 0
          ? {}
          : { stackBytes: state.stackDepth }),
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
