import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type {
  MachineBlock,
  MachineFunction,
  MachineInstruction,
} from "../machine/machine-types.js";
import type { StorageRange } from "../storage/storage-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import { fixedLoopValueBounds } from "../semantic/fixed-loop-facts.js";
import { instructionAccessEnvelope } from "../machine/nmos6510-access.js";
import { machineSuccessors as targets, semanticSuccessors } from "../machine/lower-control.js";
import {
  literalResolver,
  ordinalBoundResolver,
  rawAccessFootprint,
  valueDefinitions,
  validFixedLoopFacts,
  placeUses,
  placeMayEscapeRoot,
} from "../semantic/aggregate-place-proof.js";
import type { SemanticOperation, SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import { admittedRawRam, byteRanges, checkLayout, failure } from "./size-observer-raw-layout.js";
import type {
  RawOperation,
  RawSite,
  ResidualEffectsResult,
  ResidualFailure,
} from "./size-observer-raw-layout.js";
import type { FinalObserverInput } from "./size-observers.js";
import { validateNamedBorrows } from "./size-observer-borrows.js";
import type { BorrowValidation } from "./size-observer-borrows.js";
import { validateSelectedLoops } from "./size-observer-selected-loops.js";
import { validateComposedLowByte } from "./size-observer-low-byte-composition.js";
import { validateOriginalCallSites } from "./size-observer-original-call-sites.js";
import { originalCallGuardBounds } from "./size-observer-original-call-guards.js";
import { isOriginalByteShiftCycle } from "./size-observer-original-shifts.js";
import { isOriginalSharedByteReturn } from "./size-observer-original-returns.js";

export type { ResidualEffectsResult } from "./size-observer-raw-layout.js";

/** Profiles qualified for this normal-RAM/startup proof; other targets retain generic fallback. */
const RAW_RAM_PROFILES = new Set([
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
]);

/** Source-only operations whose effects can be closed without a call or opaque state model. */
const INDUCTION_OPERATIONS = new Set([
  "constant",
  "convert",
  "load",
  "store",
  "unary",
  "binary",
  "aggregate",
  "array-count",
  "memory-read",
  "memory-write",
]);

/** Check an unchanged word counter and each source block's actual emitted continuation. */
function loopRepresentation(
  input: FinalObserverInput,
  loop: FixedLoopFacts,
  shared: FinalObserverInput["candidate"]["shared"],
): ResidualFailure | null {
  const functions = shared.layout.program.functions.filter(
    (fn) => fn.sourceFunction === loop.function.id,
  );
  if (
    functions.length !== 1 ||
    functions[0]!.executionContext?.domain !== "main" ||
    functions[0]!.executionContext?.activationRoot !== undefined
  )
    return failure(
      "rejected",
      "Original induction requires one actual main construction",
      loop.comparison.span,
    );
  const fn = functions[0]!;
  const requests = shared.certificate.inventory.requests.filter(
    (request) =>
      request.binding !== null &&
      bindingIdentityKey(request.binding) === bindingIdentityKey(loop.counter) &&
      bindingIdentityKey(request.owner) === bindingIdentityKey(loop.function.id) &&
      (request.domain === undefined || request.domain === "main") &&
      request.activationRoot === undefined,
  );
  const home =
    requests.length === 1
      ? shared.certificate.certificate.homes.find((home) => home.requestId === requests[0]!.id)
      : undefined;
  if (home === undefined || home.bytes !== 2)
    return failure(
      "rejected",
      "Original induction has no actual two-byte counter home",
      loop.comparison.span,
    );
  const sourceBlocks = fn.observerBlocks;
  if (sourceBlocks === undefined)
    return failure(
      "rejected",
      "Original induction lacks actual source-block associations",
      loop.comparison.span,
    );
  const mapping = new Map(sourceBlocks);
  const actual = new Map(fn.blocks.map((block) => [block.label, block]));
  const seen = new Set<string>();
  if (mapping.size !== sourceBlocks.length || mapping.size !== loop.function.blocks.length)
    return failure(
      "error",
      "Original source-block membership is inconsistent",
      loop.comparison.span,
    );
  const callFailure = validateOriginalCallSites(input, loop, shared, fn);
  if (callFailure !== null) return callFailure;
  const first = (source: SemanticBlock) => mapping.get(source)?.[0];
  const aliasTargets = new Map<string, string>();
  /** Final layout may retain multiple labels at one PC, but only empty fallthroughs cost nothing. */
  const canonicalTarget = (entry: string): string | ResidualFailure => {
    const visited = new Set<string>();
    let label = entry;
    while (true) {
      const block = actual.get(label);
      if (
        visited.has(label) ||
        block === undefined ||
        block.origin === undefined ||
        !Number.isSafeInteger(block.origin) ||
        block.origin < 0 ||
        block.origin > 0xffff
      )
        return failure(
          "error",
          "Final continuation has a cycle, missing label or invalid origin",
          loop.comparison.span,
          label,
        );
      visited.add(label);
      const cached = aliasTargets.get(label);
      if (
        cached !== undefined ||
        block.instructions.length !== 0 ||
        block.terminator.kind !== "fallthrough"
      ) {
        const target = cached ?? label;
        for (const alias of visited) aliasTargets.set(alias, target);
        return target;
      }
      const next = actual.get(block.terminator.target);
      if (next === undefined || next.origin !== block.origin)
        return failure(
          "error",
          "Empty final fallthrough has inconsistent physical origins",
          loop.comparison.span,
          label,
        );
      label = next.label;
    }
  };
  const sourceById = new Map(loop.function.blocks.map((block) => [block.id, block]));
  /**
   * Existing jump threading may bypass empty source arms while retaining their
   * labels for evidence. Permit only an instruction-free unconditional chain;
   * each retained block's own source successor is still checked separately.
   */
  const allowedTargets = (id: string): ReadonlySet<string> | null => {
    const labels = new Set<string>();
    const visited = new Set<string>();
    let source = sourceById.get(id);
    while (source !== undefined) {
      if (visited.has(source.id)) return null;
      visited.add(source.id);
      const label = first(source);
      if (label === undefined) return null;
      labels.add(label);
      const emitted = actual.get(label);
      if (
        source.operations.length !== 0 ||
        source.terminator.kind !== "jump" ||
        mapping.get(source)?.length !== 1 ||
        emitted === undefined ||
        emitted.instructions.length !== 0 ||
        (emitted.terminator.kind !== "jump" && emitted.terminator.kind !== "fallthrough")
      )
        return labels;
      source = sourceById.get(source.terminator.target);
    }
    return null;
  };
  /**
   * A returned-local aggregate construction may emit a generated byte-move
   * self-loop. Its instructions carry the aggregate operation's source span and
   * the borrow/returned-local proof owns its destination, extent and complete
   * initialization, so it is not an unproved source-control cycle.
   */
  const aggregateSpans = new Set(
    loop.function.blocks
      .flatMap((candidate) => candidate.operations)
      .filter(
        (operation): operation is Extract<SemanticOperation, { kind: "aggregate" }> =>
          operation.kind === "aggregate",
      )
      .map(
        (operation) => `${operation.span.sourceId}\0${operation.span.start}\0${operation.span.end}`,
      ),
  );
  const constructionBlock = (block: MachineBlock): boolean =>
    block.instructions.length > 0 &&
    block.instructions.every(
      (instruction) =>
        instruction.source !== null &&
        aggregateSpans.has(
          `${instruction.source.sourceId}\0${instruction.source.start}\0${instruction.source.end}`,
        ),
    );
  const writes = new Map<SemanticOperation, number[]>();
  const labels = new Map(shared.layout.intervals.map(({ id, start }) => [id, start]));
  for (const source of loop.function.blocks) {
    const selected = mapping.get(source);
    if (selected === undefined || selected.length === 0)
      return failure(
        "rejected",
        "Original source block has no emitted continuation",
        loop.comparison.span,
      );
    const ranks = new Map(selected.map((label, index) => [label, index]));
    const edge = source.terminator;
    const expected =
      edge.kind === "branch"
        ? [edge.whenTrue, edge.whenFalse]
        : edge.kind === "jump"
          ? [edge.target]
          : [];
    const exits: ReadonlySet<string>[] = [];
    for (const id of expected) {
      const sourceTargets = allowedTargets(id);
      if (sourceTargets === null)
        return failure(
          "rejected",
          "Original source has an unresolved empty continuation",
          loop.comparison.span,
        );
      const labels = new Set<string>();
      for (const label of sourceTargets) {
        const target = canonicalTarget(label);
        if (typeof target !== "string") return target;
        labels.add(target);
      }
      exits.push(labels);
    }
    const reached = new Set<string>([selected[0]!]);
    const delivered = new Set<ReadonlySet<string>>();
    for (const [rank, label] of selected.entries()) {
      const block = actual.get(label);
      const canonical =
        block?.terminator.kind === "fallthrough" && actual.has(block.terminator.target)
          ? canonicalTarget(label)
          : label;
      if (typeof canonical !== "string") return canonical;
      if (
        block === undefined ||
        seen.has(label) ||
        (!reached.has(label) && !reached.has(canonical))
      )
        return failure(
          "error",
          "Original emitted block is missing, duplicated or disconnected",
          loop.comparison.span,
        );
      seen.add(label);
      reached.add(canonical);
      for (const target of targets(block)) {
        const destination = actual.get(target);
        const endpoint =
          destination === undefined ||
          (destination.terminator.kind === "fallthrough" &&
            !actual.has(destination.terminator.target))
            ? target
            : canonicalTarget(target);
        if (typeof endpoint !== "string") return endpoint;
        const next = ranks.get(endpoint);
        if (next !== undefined) {
          if (
            next <= (ranks.get(canonical) ?? rank) &&
            canonical === label &&
            !constructionBlock(block) &&
            !isOriginalByteShiftCycle(source, block, selected, actual, canonicalTarget)
          )
            return failure(
              "rejected",
              "Original source block has an unproved internal cycle",
              loop.comparison.span,
            );
          reached.add(endpoint);
        } else {
          const matches = exits.filter((labels) => labels.has(endpoint));
          if (matches.length > 0) {
            for (const labels of matches) delivered.add(labels);
            continue;
          }
          const trap = actual.get(target);
          const stop =
            input.checked.snapshot.manifest.boundsCheck &&
            trap?.instructions.length === 1 &&
            trap.instructions[0]!.opcode === "sei" &&
            trap.terminator.kind === "jump" &&
            trap.terminator.target === trap.label;
          const returned =
            edge.kind === "return" &&
            shared.layout.program.startup.blocks.some((entry) => entry.label === target);
          const sharedReturn = isOriginalSharedByteReturn(
            source,
            loop.function.result,
            block,
            endpoint,
            actual,
            canonicalTarget,
          );
          if (!stop && !returned && !sharedReturn)
            return failure(
              "error",
              "Original emitted control leaves its source continuation",
              loop.comparison.span,
            );
        }
      }
      let pc = block.origin!;
      for (const instruction of block.instructions) {
        if (instruction.opcode === "jsr") {
          // Correspondence is closed for every caller block; physical gates still run.
          pc += instruction.cost.bytes;
          continue;
        }
        const sourceAccess = instruction.observerOrigins?.some(
          (origin) => origin.kind === "raw" || origin.kind === "typed",
        );
        /**
         * A returned-local aggregate construction writes its already-proved
         * destination bytes through the hidden destination pointer. Those
         * stores share the aggregate operation's span and contain no arbitrary
         * machine access; the borrow/returned-local proof owns their backing,
         * extent and complete initialization.
         */
        const aggregateConstruction =
          instruction.source !== null &&
          loop.function.blocks.some((candidate) =>
            candidate.operations.some(
              (operation) =>
                operation.kind === "aggregate" &&
                operation.span.sourceId === instruction.source!.sourceId &&
                operation.span.start === instruction.source!.start &&
                operation.span.end === instruction.source!.end,
            ),
          );
        // Implied/stack-only instructions carry no ordinary memory operand; the
        // stack-evidence proofs own their effects.
        const stackOnly = instruction.operand === null && instruction.memory.length === 0;
        if (!sourceAccess && !aggregateConstruction && !stackOnly) {
          const accesses = instructionAccessEnvelope({
            cpu: input.checked.profile.cpu,
            instruction,
            pc,
            labels,
          });
          if (accesses === null)
            return failure(
              "rejected",
              "Counter preservation has an unproved machine access",
              instruction.source,
            );
          for (const access of accesses)
            if (access.kind === "write" && access.role === "data") {
              for (const range of access.ranges)
                if (range.start < home.address + 2 && range.end >= home.address) {
                  const store =
                    source === loop.preheader
                      ? loop.initialization
                      : source === loop.update
                        ? loop.updateStore
                        : null;
                  if (
                    store === null ||
                    instruction.source !== store.span ||
                    range.start !== range.end ||
                    range.start < home.address ||
                    range.end >= home.address + 2
                  )
                    return failure(
                      "rejected",
                      "An intervening machine write can change the Original counter",
                      instruction.source,
                      home.requestId,
                    );
                  const bytes = writes.get(store) ?? [];
                  bytes.push(range.start);
                  writes.set(store, bytes);
                }
            }
        }
        pc += instruction.cost.bytes;
      }
    }
    if (exits.length !== delivered.size || exits.some((labels) => !delivered.has(labels)))
      return failure("error", "Original source successors are not preserved", loop.comparison.span);
  }
  for (const store of [loop.initialization, loop.updateStore]) {
    const bytes = writes.get(store);
    if (bytes?.length !== 2 || bytes[0] !== home.address || bytes[1] !== home.address + 1)
      return failure(
        "rejected",
        "Original counter initialization or unit update is not completely materialized",
        store.span,
      );
  }
  return null;
}

/**
 * A prefix may return before initialization, but cannot enter the induction cycle
 * without executing its initializer. Stop at that barrier instead of treating
 * lexical nesting or a non-entry preheader as proof of dominance.
 * Parent links describe initializer dependencies, not constant lexical nesting.
 */
function initialized(loop: FixedLoopFacts, loops: ReadonlySet<FixedLoopFacts>): boolean {
  const parents = new Set<FixedLoopFacts>([loop]);
  for (let child = loop; child.initial.kind === "parent-next"; ) {
    const parent = child.parent;
    if (
      parent === null ||
      parents.has(parent) ||
      !loops.has(parent) ||
      parent.function !== loop.function ||
      parent.bodyDomain === null ||
      !parent.members.has(child.preheader.id) ||
      child.initial.parent !== parent.counter ||
      child.initial.domain.minimum !== parent.bodyDomain.minimum + 1 ||
      child.initial.domain.maximum !== parent.bodyDomain.maximum + 1 ||
      child.initial.domain.maximum > 0xffff
    )
      return false;
    parents.add(parent);
    child = parent;
  }
  const blocks = new Map(loop.function.blocks.map((block) => [block.id, block]));
  const reached = new Set<string>();
  const pending = [loop.function.entry];
  while (pending.length !== 0) {
    const id = pending.pop()!;
    if (id === loop.preheader.id || reached.has(id)) continue;
    if (id === loop.header.id || loop.members.has(id)) return false;
    const block = blocks.get(id);
    if (block === undefined) return false;
    reached.add(id);
    const edge = block.terminator;
    if (edge.kind === "jump") pending.push(edge.target);
    else if (edge.kind === "branch") pending.push(edge.whenTrue, edge.whenFalse);
  }
  return true;
}

/**
 * Prove every retained word base and step before publishing a function's bounds.
 * Bounds are provisional hypotheses here: contained typed effects preserve distinct source
 * objects under the authenticated storage closure, and the raw checker must still exclude
 * every possible numeric access from both actual artifact unions before they can escape.
 */
function originalInduction(
  input: FinalObserverInput,
  loops: ReadonlySet<FixedLoopFacts>,
  borrows: Extract<BorrowValidation, { readonly kind: "complete" }>,
  originalCallGuards: Map<SemanticOperation, ReadonlyMap<string, bigint>>,
): ResidualFailure | null {
  if (loops.size === 0) return null;
  const facts = input.candidate.lowered.program.storageSelection?.sourceFacts;
  if (facts?.program !== input.checked.program)
    return failure("error", "Conditional induction belongs to another source");
  if (
    input.reference.kind !== "feasible" ||
    (facts.loopPolicy !== "original" &&
      (input.checked.program.returnedLocalDestinations?.length ?? 0) === 0)
  )
    return failure("rejected", "Conditional induction needs actual Original homes in both layouts");
  const counters = new Set<string>();
  // Authenticate the whole dependency group before any sibling maximum is used.
  for (const loop of loops) {
    if (
      !validFixedLoopFacts(loop) ||
      loop.program !== input.checked.program ||
      !facts.functions.get(loop.function)?.loops.includes(loop)
    )
      return failure("error", "A conditional induction premise is stale", loop.comparison.span);
  }
  for (const loop of loops) {
    // By-value arguments need no borrowed target. Aggregate entry is usable
    // only after its named backing and every forwarding call have closed.
    if (
      counters.has(bindingIdentityKey(loop.counter)) ||
      loop.parameter ||
      loop.function.parameters.some(
        ({ id, type }) =>
          type.kind !== "scalar" &&
          type.kind !== "enum" &&
          !borrows.parameters.has(bindingIdentityKey(id)),
      ) ||
      (loop.initial.kind === "constant" && loop.initial.value >= loop.bound) ||
      loop.bodyDomain === null ||
      !initialized(loop, loops)
    )
      return failure(
        "rejected",
        "Induction shape needs a stronger base or step proof",
        loop.comparison.span,
      );
    counters.add(bindingIdentityKey(loop.counter));
  }
  const provisional = fixedLoopValueBounds(input.checked.program, [...loops]).owners;
  for (const loop of loops) {
    // The sealed source graph identifies each continue, break and return edge.
    // Only paths that continue the loop must perform the unique unit update;
    // abrupt exits retain their source destination. Both emitted graphs below
    // must preserve every successor, including branches within the loop body.
    const before = loopRepresentation(input, loop, input.reference.shared);
    if (before !== null) return before;
    const after = loopRepresentation(input, loop, input.candidate.shared);
    if (after !== null) return after;
    const definitions = valueDefinitions(loop.function.blocks);
    const ordinary = ordinalBoundResolver(definitions, literalResolver(definitions));
    const bound = (value: string) => provisional.get(loop.function)?.get(value) ?? ordinary(value);
    // Guard facts belong to a use, not a counter certificate or a raw address.
    const guarded = originalCallGuardBounds(input, loop);
    for (const block of loop.function.blocks)
      for (const operation of block.operations) {
        if (
          !INDUCTION_OPERATIONS.has(operation.kind) &&
          !borrows.operations.has(operation) &&
          !(
            (operation.kind === "call" ||
              operation.kind === "platform" ||
              operation.kind === "cpu-control" ||
              operation.kind === "function-address") &&
            !loop.members.has(block.id) &&
            block !== loop.header &&
            (operation.kind !== "call" ||
              operation.type.kind === "scalar" ||
              operation.type.kind === "enum")
          )
        )
          return failure("rejected", "Opaque induction effects remain unproved", operation.span);
        for (const use of placeUses(operation)) {
          if (
            placeMayEscapeRoot(use, (value) => guarded.get(operation)?.get(value) ?? bound(value))
          )
            return failure(
              "rejected",
              "An induction access can escape its source object",
              operation.span,
            );
          if (
            bindingIdentityKey(use.place.root) === bindingIdentityKey(loop.counter) &&
            operation.kind !== "load" &&
            operation !== loop.initialization &&
            operation !== loop.updateStore
          )
            return failure(
              "rejected",
              "An intervening source operation can change the Original counter",
              operation.span,
            );
        }
      }
    for (const [operation, maxima] of guarded) originalCallGuards.set(operation, maxima);
  }
  return null;
}

/**
 * Prove one canonical byte loop's control is identical in both actual layouts.
 * The loop is not a word FixedLoopFact: its counter is a private byte and the
 * raw MMIO sites stay inside the body. Only the counter/condition/update spans
 * and the loop terminators are compared; the raw template proof separately
 * authenticates every device access. Returns null when no such loop is present.
 */
function unchangedByteLoopAdmission(
  input: FinalObserverInput,
  body: SemanticFunction,
): "admitted" | string | null {
  const definitions = valueDefinitions(body.blocks);
  const literal = literalResolver(definitions);
  const successors = new Map(
    body.blocks.map((block) => [block.id, semanticSuccessors(block.terminator)] as const),
  );
  const key = (binding: BindingId) => bindingIdentityKey(binding);
  const instructionKey = (instruction: MachineInstruction) =>
    JSON.stringify([instruction.opcode, instruction.mode, instruction.operand]);
  const sameSource = (
    left: { readonly sourceId: string; readonly start: number; readonly end: number } | null,
    right: { readonly sourceId: string; readonly start: number; readonly end: number },
  ) =>
    left !== null &&
    left.sourceId === right.sourceId &&
    left.start === right.start &&
    left.end === right.end;
  const labels = (fn: MachineFunction, block: SemanticBlock) =>
    fn.observerBlocks?.find(([source]) => source.id === block.id)?.[1] ?? [];
  const matches: {
    readonly preheader: SemanticBlock;
    readonly header: SemanticBlock;
    readonly body: SemanticBlock;
    readonly update: SemanticBlock;
    readonly initialization: Extract<SemanticOperation, { readonly kind: "store" }>;
    readonly comparison: Extract<SemanticOperation, { readonly kind: "binary" }>;
    readonly updateStore: Extract<SemanticOperation, { readonly kind: "store" }>;
    readonly increment: Extract<SemanticOperation, { readonly kind: "binary" }>;
  }[] = [];
  for (const header of body.blocks) {
    const terminator = header.terminator;
    if (terminator.kind !== "branch") continue;
    const comparison = definitions.get(terminator.condition);
    if (comparison?.kind !== "binary" || comparison.operator !== "<") continue;
    const counterLoad = definitions.get(comparison.left);
    const bound = literal(comparison.right);
    if (
      counterLoad?.kind !== "load" ||
      counterLoad.place.path.length !== 0 ||
      counterLoad.type.kind !== "scalar" ||
      counterLoad.type.name !== "byte" ||
      bound === undefined ||
      bound <= 0n
    )
      continue;
    const counter = counterLoad.place.root;
    const bodyBlock = body.blocks.find((block) => block.id === terminator.whenTrue);
    const exit = body.blocks.find((block) => block.id === terminator.whenFalse);
    if (bodyBlock === undefined || exit === undefined) continue;
    const bodySuccessors = successors.get(bodyBlock.id) ?? [];
    if (bodySuccessors.length !== 1) continue;
    const update = body.blocks.find((block) => block.id === bodySuccessors[0]);
    const updateSuccessors = update === undefined ? [] : (successors.get(update.id) ?? []);
    if (update === undefined || updateSuccessors.length !== 1 || updateSuccessors[0] !== header.id)
      continue;
    const headerPredecessors = body.blocks.filter(
      (block) => block !== update && (successors.get(block.id) ?? []).includes(header.id),
    );
    if (headerPredecessors.length !== 1) continue;
    const preheader = headerPredecessors[0]!;
    const initialization = preheader.operations.find(
      (operation): operation is Extract<SemanticOperation, { readonly kind: "store" }> =>
        operation.kind === "store" &&
        operation.place.path.length === 0 &&
        key(operation.place.root) === key(counter),
    );
    if (initialization === undefined || literal(initialization.value) !== 0n) continue;
    const updateStore = update.operations.find(
      (operation): operation is Extract<SemanticOperation, { readonly kind: "store" }> =>
        operation.kind === "store" &&
        operation.place.path.length === 0 &&
        key(operation.place.root) === key(counter),
    );
    if (updateStore === undefined) continue;
    const increment = definitions.get(updateStore.value);
    if (increment?.kind !== "binary" || increment.operator !== "+") continue;
    const counterWrites = [header, bodyBlock, update].flatMap((block) =>
      block.operations.filter(
        (operation) =>
          operation.kind === "store" &&
          operation.place.path.length === 0 &&
          key(operation.place.root) === key(counter),
      ),
    );
    if (counterWrites.length !== 1 || counterWrites[0] !== updateStore) continue;
    const self = (operation: SemanticOperation | undefined) =>
      operation?.kind === "load" &&
      operation.place.path.length === 0 &&
      key(operation.place.root) === key(counter);
    if (
      !(
        (self(definitions.get(increment.left)) && literal(increment.right) === 1n) ||
        (self(definitions.get(increment.right)) && literal(increment.left) === 1n)
      )
    )
      continue;
    if (
      !bodyBlock.operations.some(
        (operation) => operation.kind === "memory-read" || operation.kind === "memory-write",
      ) &&
      !update.operations.some(
        (operation) => operation.kind === "memory-read" || operation.kind === "memory-write",
      )
    )
      continue;
    const bodyPredecessors = body.blocks.filter((block) =>
      (successors.get(block.id) ?? []).includes(bodyBlock.id),
    );
    const updatePredecessors = body.blocks.filter((block) =>
      (successors.get(block.id) ?? []).includes(update.id),
    );
    if (
      bodyPredecessors.length !== 1 ||
      bodyPredecessors[0] !== header ||
      updatePredecessors.length !== 1 ||
      updatePredecessors[0] !== bodyBlock
    )
      continue;
    matches.push({
      preheader,
      header,
      body: bodyBlock,
      update,
      initialization,
      comparison,
      updateStore,
      increment,
    });
  }
  if (matches.length !== 1) return null;
  const match = matches[0]!;
  if (input.reference.kind !== "feasible") return null;
  const findBody = (functions: readonly MachineFunction[]) =>
    functions.find(
      (fn) => fn.sourceFunction !== undefined && key(fn.sourceFunction) === key(body.id),
    );
  const referenceSymbolic = findBody(input.reference.checked.lowered.program.functions);
  const candidateSymbolic = findBody(input.candidate.lowered.program.functions);
  const referenceLayout = findBody(input.reference.shared.layout.program.functions);
  const candidateLayout = findBody(input.candidate.shared.layout.program.functions);
  if (
    referenceSymbolic === undefined ||
    candidateSymbolic === undefined ||
    referenceLayout === undefined ||
    candidateLayout === undefined
  )
    return null;
  const sourceByLabel = (fn: MachineFunction) => {
    const sources = new Map<string, string>();
    for (const [source, labels] of fn.observerBlocks ?? [])
      for (const label of labels) sources.set(label, source.id);
    return sources;
  };
  const referenceSources = sourceByLabel(referenceLayout),
    candidateSources = sourceByLabel(candidateLayout);
  const machineTerminator = (block: MachineBlock, sources: ReadonlyMap<string, string>) => {
    const terminator = block.terminator;
    const target = (label: string) => sources.get(label) ?? label;
    if (terminator.kind === "branch")
      return JSON.stringify([
        "branch",
        terminator.opcode,
        target(terminator.target),
        target(terminator.fallthrough),
      ]);
    if (terminator.kind === "long-branch")
      return JSON.stringify([
        "long-branch",
        terminator.opcode,
        target(terminator.fallthrough),
        target(terminator.jump.target),
      ]);
    if (terminator.kind === "jump" || terminator.kind === "fallthrough")
      return JSON.stringify([terminator.kind, target(terminator.target)]);
    return JSON.stringify([terminator.kind]);
  };
  const instructionShape = (instruction: MachineInstruction) =>
    JSON.stringify([instruction.opcode, instruction.mode, instruction.operand?.kind]);
  for (const block of [match.preheader, match.header, match.body, match.update]) {
    const referenceLabels = labels(referenceLayout, block),
      candidateLabels = labels(candidateLayout, block);
    if (referenceLabels.length !== 1 || candidateLabels.length !== 1)
      return "Byte-loop source block has no unique actual correspondence";
    const referenceBlock = referenceLayout.blocks.find(
      (entry) => entry.label === referenceLabels[0],
    );
    const candidateBlock = candidateLayout.blocks.find(
      (entry) => entry.label === candidateLabels[0],
    );
    if (referenceBlock === undefined || candidateBlock === undefined)
      return "Byte-loop source block has no actual machine block";
    if (
      machineTerminator(referenceBlock, referenceSources) !==
      machineTerminator(candidateBlock, candidateSources)
    )
      return "Byte-loop control differs between final actual layouts";
    const fullBlock = block === match.header || block === match.update;
    if (!fullBlock && block !== match.preheader) continue;
    const initWindow = (machine: MachineBlock) => {
      const matched = machine.instructions.flatMap((instruction, index) =>
        sameSource(instruction.source, match.initialization.span) ? [index] : [],
      );
      return matched.length === 0
        ? []
        : machine.instructions.slice(matched[0], matched.at(-1)! + 1);
    };
    const before = fullBlock
      ? referenceBlock.instructions.map(instructionShape)
      : initWindow(referenceBlock).map(instructionShape);
    const after = fullBlock
      ? candidateBlock.instructions.map(instructionShape)
      : initWindow(candidateBlock).map(instructionShape);
    if (before.length === 0 || JSON.stringify(before) !== JSON.stringify(after))
      return "Byte-loop control instructions differ between final actual layouts";
    const referenceSymbolicLabels = labels(referenceSymbolic, block),
      candidateSymbolicLabels = labels(candidateSymbolic, block);
    if (referenceSymbolicLabels.length !== 1 || candidateSymbolicLabels.length !== 1)
      return "Byte-loop source block has no unique symbolic correspondence";
    const referenceSymbolicBlock = referenceSymbolic.blocks.find(
      (entry) => entry.label === referenceSymbolicLabels[0],
    );
    const candidateSymbolicBlock = candidateSymbolic.blocks.find(
      (entry) => entry.label === candidateSymbolicLabels[0],
    );
    if (referenceSymbolicBlock === undefined || candidateSymbolicBlock === undefined)
      return "Byte-loop source block has no symbolic machine block";
    const beforeSymbolic = fullBlock
      ? referenceSymbolicBlock.instructions.map(instructionKey)
      : initWindow(referenceSymbolicBlock).map(instructionKey);
    const afterSymbolic = fullBlock
      ? candidateSymbolicBlock.instructions.map(instructionKey)
      : initWindow(candidateSymbolicBlock).map(instructionKey);
    if (
      beforeSymbolic.length === 0 ||
      JSON.stringify(beforeSymbolic) !== JSON.stringify(afterSymbolic)
    )
      return "Byte-loop symbolic control differs between actual layouts";
  }
  return "admitted";
}

/**
 * Discharge fixed or source-bounded, template-checked ordinary-RAM accesses in both layouts.
 * A successful result covers these raw members and the specifically discharged Original
 * induction premises. The caller must still validate all remaining typed, state and interrupt
 * obligations. Conditional bounds never escape before both actual layouts pass the raw checks.
 * Other raw/platform classes remain whole-tuple rejections until their stronger proof closes.
 * @param input Authenticated original source and actual reference/candidate closure.
 * @returns Tuple-scoped checked raw members, unsupported evidence, or an internal inconsistency.
 * @example const effects = validateResidualEffects(input);
 */
export function validateResidualEffects(input: FinalObserverInput): ResidualEffectsResult {
  const program = input.checked.program;
  const reached = new Set(program.reachableFunctions.map(bindingIdentityKey));
  const bodies = [
    ...program.semantic.functions.filter(({ id }) => reached.has(bindingIdentityKey(id))),
    ...program.semantic.globals.filter(({ entry }) => entry !== null),
  ];
  const raw = bodies.flatMap((body) =>
    body.blocks.flatMap((block) =>
      block.operations
        .filter(
          (operation): operation is RawOperation =>
            operation.kind === "memory-read" || operation.kind === "memory-write",
        )
        .map((operation) => ({ body, block, operation })),
    ),
  );
  const covered = new Set<MachineInstruction>();
  const borrows = validateNamedBorrows(input);
  if (borrows.kind !== "complete") return borrows;
  const operations = new Set(borrows.operations);
  const facts = input.candidate.lowered.program.storageSelection?.sourceFacts;
  const loops = new Set(
    [...(facts?.functions.values() ?? [])].flatMap((packet) => packet.objects.rangeObservers),
  );
  const composition = validateComposedLowByte(input);
  if (composition !== null && "kind" in composition) return composition;
  const selected = composition?.loops ?? validateSelectedLoops(input);
  if ("kind" in selected) return selected;
  const remaining =
    selected.size === 0 ? loops : new Set([...loops].filter((loop) => !selected.has(loop)));
  const originalCallGuards = new Map<SemanticOperation, ReadonlyMap<string, bigint>>();
  const originalAccessGuards = new Map<SemanticOperation, ReadonlyMap<string, bigint>>();
  for (const [owner, changes] of composition?.functions ?? [])
    for (const [operation, values] of changes.callGuards) {
      if (
        changes.source !== owner ||
        !owner.blocks.some((block) => block.operations.includes(operation)) ||
        originalCallGuards.has(operation) ||
        values.size === 0 ||
        [...values.values()].some((maximum) => maximum < 0n)
      )
        return failure("rejected", "Composed read guards have conflicting or foreign ownership");
      originalCallGuards.set(operation, values);
    }
  for (const [owner, changes] of composition?.functions ?? [])
    for (const [operation, values] of changes.accessGuards) {
      if (
        changes.source !== owner ||
        !owner.blocks.some((block) => block.operations.includes(operation)) ||
        originalAccessGuards.has(operation) ||
        values.size === 0 ||
        [...values.values()].some((maximum) => maximum < 0n)
      )
        return failure(
          "rejected",
          "Composed runtime access guards have conflicting or foreign ownership",
        );
      originalAccessGuards.set(operation, values);
    }
  const induction = originalInduction(input, remaining, borrows, originalCallGuards);
  if (induction !== null) return induction;
  for (const loop of selected) loops.add(loop);
  const bounds = new Map<BindingId, ReadonlyMap<string, bigint>>(
    [...fixedLoopValueBounds(program, [...loops]).owners].map(([fn, values]) => [fn.id, values]),
  );
  const admittedByteLoops = new Set<BindingId>();
  /**
   * A canonical byte loop can own raw MMIO without a word FixedLoopFact.
   * Admit it only in the object-only canonical scope and only after the same
   * counter/condition/update spans and loop terminators are identical in both
   * final layouts. This publishes no synthetic counter range; the raw template
   * proof below still authenticates every device access.
   */
  if (facts?.objectOnly === true)
    for (const body of bodies) {
      const fn = program.semantic.functions.find((candidate) => candidate === body);
      if (fn === undefined || bounds.has(fn.id)) continue;
      const rawOwner = fn.blocks.some((block) =>
        block.operations.some(
          (operation) => operation.kind === "memory-read" || operation.kind === "memory-write",
        ),
      );
      if (!rawOwner || (fn.blocks.length === 1 && fn.blocks[0]?.terminator.kind === "return"))
        continue;
      const admission = unchangedByteLoopAdmission(input, fn);
      if (admission === "admitted") {
        admittedByteLoops.add(fn.id);
        continue;
      }
      if (typeof admission === "string") return failure("rejected", admission, fn.source);
    }
  if (raw.length === 0)
    return Object.freeze({
      kind: "complete",
      operations,
      instructions: covered,
      loops,
      bounds,
      originalCallGuards,
      originalAccessGuards,
      ...(composition === null ? {} : { lowByteComposition: composition }),
    });
  if (!RAW_RAM_PROFILES.has(input.checked.profile.id))
    return failure("rejected", "Raw RAM visibility is not qualified for this target profile");
  if (input.reference.kind !== "feasible")
    return failure(
      "rejected",
      "Raw observation of unavailable original homes still needs an envelope proof",
    );
  // Every reachable body contributes its raw envelope, so an ordinary direct
  // caller cannot hide a callee's observations. Existing final storage closure
  // covers argument/result lifetimes, and the atomic consumer checks internal
  // call targets. Calls inside induction remain excluded by its separate proof.
  // Only raw-owning bodies need this control-shape premise. Typed callees still
  // pass the separate whole-source containment and borrow checks.
  /**
   * Vector-only platform controls change the CPU's interrupt entry, not data
   * visibility. Interrupt handlers are already covered by the asynchronous
   * borrow proof above, and their own raw operations join `sites` below. Other
   * platform capabilities, indirect calls and unbounded raw control flow stay
   * rejected.
   */
  const vectorCapabilities = new Set([
    "c64.system.restoreIRQ",
    "c64.system.restoreNMI",
    "c64.system.setIRQ",
    "c64.system.setIRQExclusive",
    "c64.system.setNMI",
    "c64.system.setNMIExclusive",
  ]);
  const asyncHandlers = new Set(
    [
      ...(program.interruptRoutes ?? []).map((route) => route.handler),
      ...program.roots.flatMap((root) => (root.kind === "interrupt" ? [root.function] : [])),
    ].map(bindingIdentityKey),
  );
  const asyncProved = program.roots.every(
    (root) => root.kind !== "callable" || asyncHandlers.has(bindingIdentityKey(root.function)),
  );
  if (
    !asyncProved ||
    bodies.some(
      (body) =>
        (!bounds.has(body.id) &&
          !admittedByteLoops.has(body.id) &&
          body.blocks.some((block) =>
            block.operations.some(
              (operation) => operation.kind === "memory-read" || operation.kind === "memory-write",
            ),
          ) &&
          (body.blocks.length !== 1 || body.blocks[0]?.terminator.kind !== "return")) ||
        body.blocks.some((block) =>
          block.operations.some(
            (operation) =>
              operation.kind === "indirect-call" ||
              (operation.kind === "platform" && !vectorCapabilities.has(operation.capability)),
          ),
        ),
    )
  )
    return failure(
      "rejected",
      "Raw indirect calls, control flow, platform or asynchronous observations remain unproved",
    );
  const sites: RawSite[] = [];
  const queries = new Map(
    bodies.map((body) => {
      const definitions = valueDefinitions(body.blocks);
      const literal = literalResolver(definitions);
      const ordinary = ordinalBoundResolver(definitions, literal);
      return [
        body,
        {
          definitions,
          literal,
          bound: (value: string) => bounds.get(body.id)?.get(value) ?? ordinary(value),
        },
      ] as const;
    }),
  );
  /**
   * Known C64 device registers share the same exact byte-site discipline as
   * ordinary RAM: the raw template proof still requires one attributed machine
   * access per source access, no read-modify-write, and identical sequences in
   * both layouts. The windows come from the selected machine facts.
   */
  const machine = input.checked.profile.machine;
  const deviceWindows = Object.freeze([
    Object.freeze({ start: machine.spritePositionBase, end: machine.spriteColorBase + 7 }),
    Object.freeze({ start: machine.cia1Base, end: machine.cia1Base + 15 }),
    Object.freeze({ start: machine.cia2Base, end: machine.cia2Base + 15 }),
  ]);
  const admittedRaw = (range: StorageRange): boolean =>
    admittedRawRam(range) ||
    deviceWindows.some((window) => range.start >= window.start && range.end <= window.end);
  for (const { body, block, operation } of raw) {
    const query = queries.get(body)!;
    const base = rawAccessFootprint(
      { ...operation, width: 1 },
      query.definitions,
      query.literal,
      query.bound,
    );
    if (base === null)
      return failure("rejected", "Raw address has no proved ordinary-RAM envelope", operation.span);
    const site = { operation, owner: body.id, ranges: base, block };
    for (let byte = 0; byte < operation.width; byte += 1) {
      if (
        byteRanges(site, byte).some(
          (range) =>
            !admittedRaw(range) ||
            (operation.kind === "memory-write" &&
              range.start < input.checked.profile.machine.spritePointerBase + 8 &&
              range.end >= input.checked.profile.machine.spritePointerBase),
        )
      )
        return failure(
          "rejected",
          "Raw access needs a device, bank, stack or hardware-publication proof",
          operation.span,
        );
    }
    sites.push(site);
    operations.add(operation);
  }
  /**
   * Vector-only platform controls, CPU flag/stack controls and callback
   * addresses have no ordinary data footprint; the raw/async proofs above own
   * their effects. Publish them as covered source operations so the typed
   * footprint observer need not treat them as opaque.
   */
  // Only raw-owning bodies cross the raw template proof; a conditional-status
  // callee with no raw site keeps its separate rejection.
  const rawOwners = new Set(sites.map((site) => bindingIdentityKey(site.owner)));
  for (const body of bodies) {
    if (!rawOwners.has(bindingIdentityKey(body.id))) continue;
    for (const block of body.blocks)
      for (const operation of block.operations) {
        if (
          (operation.kind === "platform" && vectorCapabilities.has(operation.capability)) ||
          operation.kind === "cpu-control" ||
          operation.kind === "function-address"
        )
          operations.add(operation);
      }
  }
  const after = checkLayout(
    input,
    input.candidate.shared,
    input.candidate.lowered.program,
    sites,
    covered,
  );
  if (after !== null) return after;
  const before = checkLayout(
    input,
    input.reference.shared,
    input.reference.checked.lowered.program,
    sites,
    covered,
  );
  return (
    before ??
    Object.freeze({
      kind: "complete",
      operations,
      instructions: covered,
      loops,
      bounds,
      originalCallGuards,
      originalAccessGuards,
      ...(composition === null ? {} : { lowByteComposition: composition }),
    })
  );
}
