import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { validFixedLoopFacts } from "../semantic/aggregate-place-proof.js";
import { potentialValueInputs } from "../semantic/value-lifetimes.js";
import { asynchronousWritersPossible } from "../machine/fixed-loop-selection.js";
import { failure } from "./size-observer-raw-layout.js";
import { view, side, physical, siteKey } from "./size-observer-selected-loop-layout.js";
import { continuations } from "./size-observer-selected-loop-continuations.js";
import { registerCounterSnapshot, registerCounterIndex } from "./size-observer-register-counter.js";
import type { Side } from "./size-observer-selected-loop-layout.js";
import type { FixedCounterProof, MachineInstruction } from "../machine/machine-types.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import type { StorageRequest, StorageRange } from "../storage/storage-types.js";
import type { ResidualFailure } from "./size-observer-raw-layout.js";
import type { FinalObserverInput } from "./size-observers.js";
/** Discharged source loops, not permission to exempt instructions or accept a tuple. */
export type SelectedLoopValidation = ResidualFailure | ReadonlySet<FixedLoopFacts>;

/** Only ordinary scalar effects can establish non-observation of the removed private bytes. */
const SCALAR_OPERATIONS = new Set([
  "constant",
  "convert",
  "load",
  "store",
  "unary",
  "binary",
  "call",
]);

/** Match semantic constants or exact private-byte operands; immediates never count as memory reads. */
function instruction(
  current: Side,
  role: number,
  index: number,
  opcode: string,
  operand: number | readonly [string, number] | null,
): boolean {
  const item = current.symbols[role]!.instructions[index];
  if (item?.opcode !== opcode) return false;
  if (operand === null) return item.mode === "implied" && item.operand === null;
  if (typeof operand === "number")
    return (
      item.mode === "immediate" &&
      item.operand?.kind === "immediate" &&
      item.operand.value === operand
    );
  return (
    item.operand?.kind === "storage" &&
    item.operand.requestId === operand[0] &&
    (item.operand.offset ?? 0) === operand[1] &&
    item.operand.addressByte === undefined
  );
}

/** Complete templates establish k=0, equal unsigned tests and one non-overflowing increment. */
function controls(current: Side, loop: FixedLoopFacts, selected: boolean): string | null {
  const c = current.counter;
  if (c === null) return null;
  const update = current.symbols[3]!.instructions;
  const capture = selected ? null : update[3]?.operand;
  if (!selected && capture?.kind !== "storage") return null;
  const t = capture?.kind === "storage" ? capture.requestId : "";
  const entry: readonly (readonly [string, number | readonly [string, number] | null])[] = selected
    ? [
        ["lda", 0],
        ["sta", [c, 0]],
      ]
    : [
        ["lda", 0],
        ["sta", [c, 0]],
        ["lda", 0],
        ["sta", [c, 1]],
      ];
  const test: typeof entry = selected
    ? [
        ["lda", [c, 0]],
        ["cmp", loop.bound],
      ]
    : [
        ["lda", [c, 0]],
        ["cmp", loop.bound],
        ["lda", [c, 1]],
        ["sbc", 0],
      ];
  const step: typeof entry = selected
    ? [["inc", [c, 0]]]
    : [
        ["lda", [c, 0]],
        ["clc", null],
        ["adc", 1],
        ["sta", [t, 0]],
        ["lda", [c, 1]],
        ["adc", 0],
        ["sta", [t, 1]],
        ["lda", [t, 0]],
        ["sta", [c, 0]],
        ["lda", [t, 1]],
        ["sta", [c, 1]],
      ];
  for (const [role, template, source] of [
    [0, entry, loop.initialization.span],
    [1, test, loop.comparison.span],
    [3, step, null],
  ] as const)
    if (
      current.symbols[role]!.instructions.length !== template.length ||
      template.some(
        ([opcode, operand], index) =>
          !instruction(current, role, index, opcode, operand) ||
          current.symbols[role]!.instructions[index]!.source !==
            (source ?? (selected || index >= 7 ? loop.updateStore.span : loop.increment.span)),
      )
    )
      return null;
  if (!selected) {
    const request = current.requests.get(t),
      uses = current.references.get(t) ?? [];
    if (
      t === c ||
      request?.storageClass !== "temporary" ||
      request.bytes !== 2 ||
      uses.length !== 4 ||
      uses.some(
        (use, index) =>
          use.memory ||
          use.offset !== [0, 1, 0, 1][index] ||
          use.site !== siteKey(current.source.id, current.symbols[3]!.label, [3, 6, 7, 9][index]!),
      )
    )
      return null;
  }
  return t;
}

/** No general scalar evaluator is needed when only the same counter's low byte is substituted. */
function bodyPair(before: Side, after: Side): boolean {
  const original = before.symbols[2]!.instructions,
    selected = after.symbols[2]!.instructions;
  if (original.length !== selected.length || selected.length === 0) return false;
  return original.every((left, index) => {
    const right = selected[index]!;
    const normalize = (item: MachineInstruction, id: string | null) => {
      const operand = item.operand;
      return operand?.kind === "storage" &&
        operand.requestId === id &&
        (operand.offset ?? 0) === 0 &&
        operand.addressByte === undefined
        ? { ...operand, requestId: "counter", offset: 0 }
        : operand;
    };
    return (
      left.opcode === right.opcode &&
      left.mode === right.mode &&
      left.source === right.source &&
      JSON.stringify(normalize(left, before.counter)) ===
        JSON.stringify(normalize(right, after.counter)) &&
      left.memory.length === 0 &&
      right.memory.length === 0 &&
      JSON.stringify(left.observerOrigins) === JSON.stringify(right.observerOrigins)
    );
  });
}

/** Require complete function occupancy; narrower lifetimes are outside this first proof. */
function occupied(request: StorageRequest, loop: FixedLoopFacts): boolean {
  const positions = new Set(
    request.lifetime.liveAt.map(({ block, operation }) => JSON.stringify([block, operation])),
  );
  return (
    request.owner === loop.function.id &&
    request.lifetime.function === loop.function.id &&
    (request.domain === undefined || request.domain === "main") &&
    request.activationRoot === undefined &&
    request.persistent !== true &&
    request.pageSafeIndirect !== true &&
    request.lifetime.callsCrossed.length === 0 &&
    loop.function.blocks.every((block) =>
      Array.from({ length: block.operations.length + 1 }, (_, index) =>
        positions.has(JSON.stringify([block.id, index])),
      ).every(Boolean),
    )
  );
}

/** Inventory differences include late arithmetic scratch, not just predeclared selected omissions. */
function demands(
  before: Side,
  after: Side,
  loop: FixedLoopFacts,
  scratch: string,
  selectedRequest = after.counter,
  pointer: string | null = null,
): boolean {
  if (before.counter === null || (selectedRequest === null && pointer === null)) return false;
  const a = [...before.requests.values()].filter(({ owner }) => owner === loop.function.id);
  const b = [...after.requests.values()].filter(({ owner }) => owner === loop.function.id);
  const source = before.requests.get(before.counter),
    selected = selectedRequest === null ? undefined : after.requests.get(selectedRequest);
  if (
    pointer === null
      ? selected?.storageClass !== "temporary" ||
        selected.bytes !== 1 ||
        selected.binding !== null ||
        selectedRequest === null ||
        before.requests.has(selectedRequest) ||
        !occupied(selected, loop)
      : selectedRequest !== null ||
        a.length !== 3 ||
        b.length !== 0 ||
        pointer === before.counter ||
        pointer === scratch ||
        after.requests.has(pointer)
  )
    return false;
  if (
    source?.binding !== loop.counter ||
    source.storageClass !== "local" ||
    source.bytes !== 2 ||
    after.requests.has(before.counter) ||
    after.requests.has(scratch) ||
    !occupied(source, loop)
  )
    return false;
  if (
    a
      .filter(({ id }) => !after.requests.has(id))
      .some(({ id }) => id !== before.counter && id !== scratch && id !== pointer) ||
    b.filter(({ id }) => !before.requests.has(id)).some(({ id }) => id !== selectedRequest)
  )
    return false;
  for (const current of [before, after]) {
    const requests = current === before ? a : b;
    const ranges: StorageRange[] = [];
    for (const request of requests) {
      const home = current.homes.get(request.id);
      if (
        !occupied(request, loop) ||
        request.storageClass === "argument-stage" ||
        home === undefined ||
        home.bytes !== request.bytes ||
        !Number.isSafeInteger(home.bytes) ||
        home.bytes <= 0
      )
        return false;
      const range = { start: home.address, end: home.address + home.bytes - 1 };
      if (ranges.some((other) => range.start <= other.end && range.end >= other.start))
        return false;
      ranges.push(range);
      if (
        (current.references.get(request.id) ?? []).some(
          (use) =>
            use.memory ||
            !current.blocks.some((block) =>
              block.instructions.some(
                (_item, index) => use.site === siteKey(current.actual.id, block.label, index),
              ),
            ),
        )
      )
        return false;
      const peer = (current === before ? after : before).requests.get(request.id);
      if (
        peer !== undefined &&
        (peer.owner !== request.owner ||
          peer.binding !== request.binding ||
          peer.bytes !== request.bytes ||
          peer.value !== request.value ||
          peer.storageClass !== request.storageClass ||
          JSON.stringify(peer.type) !== JSON.stringify(request.type))
      )
        return false;
    }
  }
  return true;
}

/** Source identity and exhaustive consumers rule out unseen word, address or staged observations. */
function eligible(input: FinalObserverInput, proof: FixedCounterProof): boolean {
  const loop = proof.loop,
    fn = loop.function;
  const facts = input.candidate.lowered.program.storageSelection?.sourceFacts;
  const roles = [loop.preheader, loop.header, loop.body, loop.update, loop.exit];
  const memory = proof.representation === "low-byte";
  const index = proof.indexUses?.[0];
  if (
    !validFixedLoopFacts(loop) ||
    loop.program !== input.checked.program ||
    facts?.program !== loop.program ||
    !facts.functions.get(fn)?.loops.includes(loop) ||
    (memory
      ? facts.loopPolicy !== "low-byte" ||
        proof.requestId === null ||
        proof.firstTestElided !== false
      : !["x-first", "y-first", "flat-eight-x-first", "flat-eight-y-first", "mixed"].includes(
          facts.loopPolicy ?? "",
        ) ||
        proof.requestId !== null ||
        proof.firstTestElided !== true ||
        proof.reads.length !== 1) ||
    (proof.indexUses?.length !== 0 && (memory || proof.indexUses?.length !== 1)) ||
    loop.depth !== 0 ||
    loop.parent !== null ||
    loop.parameter ||
    loop.initial.kind !== "constant" ||
    loop.initial.value !== 0 ||
    loop.bound < 1 ||
    loop.bound > 8 ||
    fn.result.kind !== "scalar" ||
    fn.result.name !== "void" ||
    fn.entry !== loop.preheader.id ||
    fn.blocks.length !== 5 ||
    new Set(roles).size !== 5 ||
    fn.blocks.some((block) => !roles.includes(block)) ||
    loop.exit.operations.length !== 0 ||
    loop.exit.terminator.kind !== "return" ||
    loop.exit.terminator.value !== null ||
    loop.outsideAccesses.length !== 0 ||
    loop.members.size !== 2 ||
    !loop.members.has(loop.body.id) ||
    !loop.members.has(loop.update.id) ||
    loop.exits.some(
      (exit) => exit.kind !== "update" || exit.from !== loop.body || exit.target !== loop.update.id,
    )
  )
    return false;
  const operations = fn.blocks.flatMap((block) => block.operations);
  const bodyLoads: string[] = [];
  let headerLoads = 0,
    updateLoads = 0;
  for (const block of fn.blocks)
    for (const operation of block.operations) {
      if (operation.kind === "call") return false;
      if (
        (operation.kind !== "load" && operation.kind !== "store") ||
        operation.place.root !== loop.counter
      )
        continue;
      if (operation.place.path.length !== 0) return false;
      if (operation.kind === "store") {
        if (operation !== loop.initialization && operation !== loop.updateStore) return false;
      } else {
        const consumers = operations.filter((use) =>
          potentialValueInputs(use).includes(operation.result),
        );
        if (
          fn.blocks.some(
            ({ terminator }) =>
              (terminator.kind === "branch" && terminator.condition === operation.result) ||
              (terminator.kind === "return" && terminator.value === operation.result),
          )
        )
          return false;
        const use = consumers[0];
        if (block === loop.header || block === loop.update) {
          const expected = block === loop.header ? loop.comparison : loop.increment;
          if (consumers.length !== 1 || use !== expected || expected.left !== operation.result)
            return false;
          if (block === loop.header) headerLoads += 1;
          else updateLoads += 1;
          continue;
        }
        if (
          block !== loop.body ||
          operation.type.kind !== "scalar" ||
          operation.type.name !== "word" ||
          consumers.length !== 1 ||
          (index === undefined
            ? use?.kind !== "convert" ||
              use.conversion !== "truncate" ||
              use.type.kind !== "scalar" ||
              use.type.name !== "byte" ||
              use.operand !== operation.result
            : index.value !== operation.result || index.consumer !== use || use?.kind !== "store")
        )
          return false;
        bodyLoads.push(operation.result);
      }
    }
  return (
    headerLoads === 1 &&
    updateLoads === 1 &&
    proof.reads.length === bodyLoads.length &&
    new Set(proof.reads.map(({ value }) => value)).size === bodyLoads.length &&
    proof.reads.every(
      ({ value, stagingRequestId }) => stagingRequestId === null && bodyLoads.includes(value),
    )
  );
}

/**
 * Scalar tuples retain their original source boundary. The provisional index
 * branch must separately close every added typed permission in its store factor.
 */
function synchronous(input: FinalObserverInput, indexed = false): boolean {
  const program = input.checked.program;
  if (asynchronousWritersPossible(program)) return false;
  const reached = new Set(program.reachableFunctions.map(bindingIdentityKey));
  for (const body of [
    ...program.semantic.functions.filter(({ id }) => reached.has(bindingIdentityKey(id))),
    ...program.semantic.globals,
  ])
    for (const block of body.blocks)
      for (const operation of block.operations)
        if (
          (!SCALAR_OPERATIONS.has(operation.kind) &&
            !(indexed && operation.kind === "aggregate")) ||
          (!indexed &&
            (operation.kind === "load" || operation.kind === "store") &&
            (operation.place.path.length !== 0 ||
              (operation.type.kind !== "scalar" && operation.type.kind !== "enum")))
        )
          return false;
  return input.candidate.lowered.program.functions.every((fn) =>
    [
      fn.nativeStoreProofs,
      fn.fixedLoopProofs,
      fn.byteAvailabilityProofs,
      fn.byteComplementProofs,
      fn.booleanCallProofs,
    ].every((proofs) => (proofs?.length ?? 0) === 0),
  );
}

/**
 * Discharge only closed five-block private counters after producer authentication.
 * This proof neither authenticates arbitrary tuples nor covers raw accesses. It
 * returns source-loop identities only; the caller still runs every atomic source,
 * storage, startup, byte-window and both-layout physical-footprint check.
 * @param input Original checked source and actual reference/selected constructions.
 * @returns Exact discharged loops, or a conservative rejection of the whole tuple.
 * @example const discharged = validateSelectedLoops(input);
 */
export function validateSelectedLoops(input: FinalObserverInput): SelectedLoopValidation {
  const functions = input.candidate.lowered.program.functions.filter(
    (fn) => (fn.fixedCounterProofs?.length ?? 0) > 0,
  );
  const proved = new Set<FixedLoopFacts>();
  if (functions.length === 0) return proved;
  const reject = (reason: string) => failure("rejected", reason);
  const indexed =
    functions.length === 1 && functions[0]?.fixedCounterProofs?.[0]?.indexUses?.length === 1;
  if (input.reference.kind !== "feasible" || !synchronous(input, indexed))
    return reject("Selected loops need synchronous scalar source and both actual layouts");
  const beforeView = view(input.reference.shared, input.reference.checked.lowered),
    afterView = view(input.candidate.shared, input.candidate.lowered);
  for (const fn of functions) {
    const proof = fn.fixedCounterProofs?.[0];
    if (
      fn.fixedCounterProofs?.length !== 1 ||
      proof === undefined ||
      fn.sourceFunction !== proof.loop.function.id ||
      proof.context !== fn.id ||
      !eligible(input, proof) ||
      proved.has(proof.loop)
    )
      return reject("Selected loop source, read or context premises are unresolved");
    const before = side(beforeView, proof.loop, proof.originalRequestId),
      after = side(afterView, proof.loop, proof.requestId, proof.representation !== "low-byte");
    if (before === null || after === null)
      return reject("Selected loop needs exactly five unshared actual source blocks");
    const scratch = controls(before, proof.loop, false);
    const memory = proof.representation === "low-byte";
    const index = indexed ? registerCounterIndex(input, proof, before, after) : null;
    const snapshot =
      index !== null
        ? null
        : memory
          ? after.counter
          : registerCounterSnapshot(proof, before, after);
    if (scratch === null || (memory && controls(after, proof.loop, true) === null))
      return reject("Selected loop control templates or complete scratch references disagree");
    if (
      (snapshot === null && index === null) ||
      (memory && !bodyPair(before, after)) ||
      !demands(before, after, proof.loop, scratch, snapshot, index?.pointer ?? null)
    )
      return reject("Selected loop body, storage or lifetime correspondence is unresolved");
    if (
      !physical(input, before, scratch, index ?? undefined) ||
      !physical(input, after, null, index ?? undefined)
    )
      return reject("Selected loop binding or actual physical interference is unresolved");
    if (
      !continuations(
        input,
        before,
        after,
        proof.representation,
        index !== null,
        index?.hoisted === true,
      )
    )
      return reject("Selected loop state, caller or startup continuation is unresolved");
    proved.add(proof.loop);
  }
  return proved;
}
