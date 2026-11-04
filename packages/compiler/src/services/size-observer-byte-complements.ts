import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { validByteComplementFacts } from "../machine/byte-value-availability.js";
import {
  byteContinuationQuery,
  bindingLabel,
  BYTE_WINDOW_CHANGED,
  machineSuccessors,
} from "../machine/lower-control.js";
import { instructionAccessEnvelope, operandAddress } from "../machine/nmos6510-access.js";
import { createGlobalByteStabilityQuery } from "../semantic/aggregate-place-proof.js";
import { failure } from "./size-observer-raw-layout.js";
import { validateFieldComplements } from "./size-observer-complement-fields.js";
import type {
  MachineBlock,
  MachineFunction,
  MachineInstruction,
  MachineFunctionSourceFacts,
} from "../machine/machine-types.js";
import type { SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import type { StorageRange } from "../storage/storage-types.js";
import type { ResidualEffectsResult, ResidualFailure } from "./size-observer-raw-layout.js";
import type { FinalObserverInput } from "./size-observers.js";

/** Complete actual placement; no missing reference is replaced with an empty image. */
type Shared = FinalObserverInput["candidate"]["shared"];
/** Successful source-only checks remain separate from final machine closure. */
type Effects = Extract<ResidualEffectsResult, { readonly kind: "complete" }>;

/** Reused instruction objects still execute separately at each block/index occurrence. */
const point = (block: MachineBlock, index: number) => JSON.stringify([block.label, index]);

/** Only ordinary CPU-visible bytes can support removed or newly introduced private accesses. */
function ram(address: number): boolean {
  return (
    Number.isSafeInteger(address) &&
    ((address >= 2 && address <= 0xff) || (address >= 0x200 && address <= 0xcfff))
  );
}

/** Compare the set/clear flag destinations, including inverse-branch-over-JMP repair. */
function edge(block: MachineBlock): string {
  const term = block.terminator;
  if (term.kind === "branch" || term.kind === "long-branch") {
    const target = term.kind === "branch" ? term.target : term.jump.target;
    const branchOnSet = ["beq", "bcs", "bmi", "bvs"].includes(term.opcode);
    const jumpOnSet = term.kind === "branch" ? branchOnSet : !branchOnSet;
    return JSON.stringify([
      term.uses.flags,
      jumpOnSet ? target : term.fallthrough,
      jumpOnSet ? term.fallthrough : target,
    ]);
  }
  return JSON.stringify(
    term.kind === "jump" || term.kind === "fallthrough" ? ["go", term.target] : [term.kind],
  );
}

/** Index one independently closed layout and reject redirected, missing or bypassed ownership. */
function image(shared: Shared, symbolic: MachineFunction, source: SemanticFunction) {
  const program = shared.layout.program;
  const body = program.functions.find((fn) => fn.id === symbolic.id);
  if (
    body === undefined ||
    body.sourceFunction !== source.id ||
    body.executionContext?.domain !== "main" ||
    body.executionContext.activationRoot !== undefined ||
    body.observerBodies !== undefined ||
    body.blocks.some((block) => block.observerBodies !== undefined || block.origin === undefined)
  )
    return null;
  const blocks = new Map(body.blocks.map((block) => [block.label, block]));
  const labels = new Map(shared.layout.intervals.map(({ id, start }) => [id, start]));
  for (const fn of [program.startup, ...program.functions]) {
    labels.set(fn.id, fn.origin ?? fn.blocks[0]?.origin ?? -1);
    for (const block of fn.blocks) labels.set(block.label, block.origin ?? -1);
  }
  const homes = new Map(shared.certificate.certificate.homes.map((home) => [home.requestId, home]));
  const requests = new Map(
    shared.certificate.inventory.requests.map((request) => [request.id, request]),
  );
  const mapping = new Map(symbolic.observerBlocks);
  if (
    mapping.size !== source.blocks.length ||
    body.blocks.length !== symbolic.blocks.length ||
    symbolic.sourceFunction !== source.id ||
    symbolic.observerBodies !== undefined ||
    symbolic.executionContext?.domain !== "main" ||
    symbolic.executionContext.activationRoot !== undefined
  )
    return null;
  const incoming = new Map<string, number>();
  for (const block of body.blocks)
    for (const target of machineSuccessors(block))
      incoming.set(target, (incoming.get(target) ?? 0) + 1);
  const initial = mapping.get(source.blocks.find((block) => block.id === source.entry)!)?.[0];
  if (initial === undefined || initial !== body.blocks[0]?.label || incoming.has(initial))
    return null;
  for (const fn of [program.startup, ...program.functions])
    for (const block of fn.blocks)
      for (const instruction of block.instructions) {
        const operand = instruction.operand;
        if (
          operand?.kind === "label" &&
          (operand.label === body.id || blocks.has(operand.label)) &&
          !(
            fn !== body &&
            instruction.opcode === "jsr" &&
            instruction.mode === "absolute" &&
            operand.label === body.id &&
            (operand.offset ?? 0) === 0 &&
            operand.addressByte === undefined
          )
        )
          return null;
      }
  return { shared, body, blocks, labels, homes, requests, mapping, incoming };
}

/** Indexed view whose code and resources belong to the supplied independent construction. */
type Image = NonNullable<ReturnType<typeof image>>;

/** Resolve an existing resident data identity and its complete extent, never a name-derived symbol. */
function data(view: Image, binding: SemanticFunction["id"]) {
  const objects = view.shared.layout.program.data.filter(
    (object) => object.id === bindingLabel("global", binding),
  );
  const object = objects[0];
  const interval = view.shared.layout.intervals.find(({ id }) => id === object?.id);
  return objects.length === 1 &&
    object !== undefined &&
    interval !== undefined &&
    interval.kind === object.kind &&
    interval.end - interval.start + 1 === object.bytes.length &&
    ram(interval.start) &&
    ram(interval.end)
    ? { object, interval }
    : null;
}

/** Validate whole-function occupancy explicitly; this subset never assumes a capture lifetime. */
function privateByte(view: Image, id: string, source: SemanticFunction) {
  const request = view.requests.get(id),
    home = view.homes.get(id);
  if (
    request === undefined ||
    home === undefined ||
    request.owner !== source.id ||
    request.bytes !== 1 ||
    home.bytes !== 1 ||
    request.storageClass !== "temporary" ||
    request.activationRoot !== undefined ||
    (request.domain !== undefined && request.domain !== "main") ||
    !ram(home.address) ||
    view.shared.layout.intervals.some(
      (range) => range.kind !== "sfa" && range.start <= home.address && range.end >= home.address,
    ) ||
    request.lifetime.function !== source.id
  )
    return null;
  const live = new Set(
    request.lifetime.liveAt.map(({ block, operation }) => `${block}\0${operation}`),
  );
  for (const block of source.blocks)
    for (let operation = 0; operation <= block.operations.length; operation += 1)
      if (!live.has(`${block.id}\0${operation}`)) return null;
  for (const other of view.requests.values()) {
    if (other.id === id || other.owner !== source.id || other.bytes === 0) continue;
    const placed = view.homes.get(other.id);
    if (
      placed === undefined ||
      (home.address >= placed.address && home.address < placed.address + placed.bytes)
    )
      return null;
  }
  return home;
}

/** Check final binding against actual symbolic operands; optional memory annotations are not authority. */
function bound(view: Image, symbolic: MachineInstruction, actual: MachineInstruction): boolean {
  let operand = symbolic.operand,
    mode = symbolic.mode;
  if (operand?.kind === "storage" || operand?.kind === "indirect-y") {
    const home = view.homes.get(operand.requestId);
    if (home === undefined || (operand.kind === "storage" && operand.addressByte !== undefined))
      return false;
    operand = { kind: "absolute", value: home.address + (operand.offset ?? 0) };
    if (mode === "storage") mode = home.region === "zero-page" ? "zero-page" : "absolute";
  }
  return (
    symbolic.opcode === actual.opcode &&
    mode === actual.mode &&
    JSON.stringify(operand) === JSON.stringify(actual.operand)
  );
}

/** Bind every instruction, block and successor before any selective template comparison. */
function actualBody(view: Image, symbolic: MachineFunction): boolean {
  return symbolic.blocks.every((block) => {
    const actual = view.blocks.get(block.label);
    return (
      actual !== undefined &&
      edge(actual) === edge(block) &&
      actual.instructions.length === block.instructions.length &&
      block.instructions.every((instruction, index) =>
        bound(view, instruction, actual.instructions[index]!),
      )
    );
  });
}

/** Follow only single-entry emitted bounds chains, with the other arm being the actual terminal stop. */
function sequence(view: Image, source: SemanticBlock) {
  const labels = view.mapping.get(source);
  if (labels === undefined || labels.length === 0 || new Set(labels).size !== labels.length)
    return null;
  const result: { block: MachineBlock; index: number; instruction: MachineInstruction }[] = [];
  for (const [index, label] of labels.entries()) {
    const block = view.blocks.get(label);
    if (block === undefined || view.incoming.get(label) !== 1) return null;
    if (index + 1 < labels.length) {
      const targets = machineSuccessors(block);
      if (!targets.includes(labels[index + 1]!)) return null;
      for (const target of targets.filter((target) => target !== labels[index + 1])) {
        const stop = view.blocks.get(target);
        if (
          stop?.instructions.length !== 1 ||
          stop.instructions[0]?.opcode !== "sei" ||
          stop.terminator.kind !== "jump" ||
          stop.terminator.target !== stop.label
        )
          return null;
      }
    }
    result.push(...block.instructions.map((instruction, index) => ({ block, index, instruction })));
  }
  return result;
}

/** Ordinary reference code and selected code must differ only by the listed exact cache template. */
function same(left: MachineInstruction, right: MachineInstruction): boolean {
  return (
    JSON.stringify([left.opcode, left.mode, left.operand]) ===
    JSON.stringify([right.opcode, right.mode, right.operand])
  );
}

/** Source shape keeps every changed computation attached to one exact immediate typed store. */
function sourceSites(packet: MachineFunctionSourceFacts, effects: Effects) {
  const proofs = packet.complements;
  const loop = packet.loops[0];
  if (
    proofs === undefined ||
    loop === undefined ||
    packet.loops.length !== 1 ||
    !effects.loops.has(loop) ||
    loop.preheader.id !== packet.function.entry ||
    loop.tripDomain.minimum <= 0 ||
    loop.parent !== null ||
    packet.function.parameters.length !== 0 ||
    packet.function.blocks.some(
      (block) => ![loop.preheader, loop.header, loop.body, loop.update, loop.exit].includes(block),
    )
  )
    return null;
  const sites = [];
  const operations = loop.body.operations;
  for (let index = 0; index < operations.length; index += 4) {
    const ordinal = operations[index],
      load = operations[index + 1],
      unary = operations[index + 2],
      store = operations[index + 3];
    if (
      ordinal?.kind !== "load" ||
      ordinal.place.root !== loop.counter ||
      ordinal.place.path.length !== 0 ||
      load?.kind !== "load" ||
      load.place.path.length !== 0 ||
      unary?.kind !== "unary" ||
      store?.kind !== "store" ||
      store.value !== unary.result ||
      store.type.kind !== "scalar" ||
      store.type.name !== "byte" ||
      store.place.path.length !== 1 ||
      store.place.path[0]?.kind !== "index" ||
      store.place.path[0].value !== ordinal.result
    )
      return null;
    const recipe = proofs.replacements.get(unary);
    if (
      recipe?.kind !== "cache" ||
      recipe.load !== load ||
      recipe.input !== load ||
      unary.operand !== load.result ||
      !recipe.defer ||
      recipe.preservedLeft !== null ||
      recipe.preheader !== loop.preheader.id ||
      recipe.admittingCounter !== loop.counter
    )
      return null;
    sites.push({ unary, recipe, store, loop });
  }
  return sites.length >= 2 && sites.length === proofs.replacements.size ? sites : null;
}

/** Prove all actual source/cache/capture writes, including pointer and indexed target envelopes. */
function writes(
  input: FinalObserverInput,
  view: Image,
  watched: ReadonlyMap<number, ReadonlySet<string>>,
  stores: ReadonlyMap<string, StorageRange>,
): boolean {
  for (const block of view.body.blocks) {
    let pc = block.origin!;
    for (const [index, instruction] of block.instructions.entries()) {
      const occurrence = point(block, index);
      const target = stores.get(occurrence);
      const accesses = instructionAccessEnvelope({
        cpu: input.checked.profile.cpu,
        instruction,
        pc,
        labels: view.labels,
        ...(target === undefined ? {} : { index: { start: 0, end: 0 }, pointees: [target] }),
      });
      if (
        accesses === null ||
        accesses.some(
          (access) =>
            access.kind === "write" &&
            access.ranges.some(({ start, end }) =>
              [...watched].some(
                ([address, allowed]) =>
                  start <= address && end >= address && !allowed.has(occurrence),
              ),
            ),
        )
      )
        return false;
      pc += instruction.cost.bytes;
    }
  }
  return true;
}

/** One narrow cache group; exact structural correspondence is not a general machine interpreter. */
function group(
  input: FinalObserverInput,
  effects: Effects,
  selected: MachineFunction,
  packet: MachineFunctionSourceFacts,
): string | null {
  const complements = packet.complements;
  if (
    complements === undefined ||
    !validByteComplementFacts(complements, packet, input.checked.profile.id)
  )
    return "Complement source selection is stale";
  const sites = sourceSites(packet, effects),
    proofs = selected.byteComplementProofs ?? [];
  if (
    sites === null ||
    proofs.length !== sites.length ||
    new Set(proofs.map((proof) => proof.selection?.[0])).size !== sites.length ||
    [
      selected.byteAvailabilityProofs,
      selected.booleanCallProofs,
      selected.nativeStoreProofs,
      selected.fixedCounterProofs,
      selected.fixedLoopProofs,
    ].some((values) => (values?.length ?? 0) > 0)
  )
    return "Complement class needs a stronger source or mixed-window proof";
  const first = sites[0]!,
    cacheId = proofs[0]?.cacheRequestId;
  const stable = createGlobalByteStabilityQuery(
    packet.function,
    packet.objects,
    input.checked.profile,
  );
  if (
    cacheId == null ||
    !stable(first.recipe.binding) ||
    sites.some(
      ({ recipe }) =>
        recipe.first !== first.recipe.first || recipe.binding !== first.recipe.binding,
    ) ||
    proofs.some(
      (proof) =>
        proof.function !== packet.function.id ||
        proof.domain !== "main" ||
        proof.kind !== "cache" ||
        proof.cacheRequestId !== cacheId ||
        proof.preservedLeft !== null ||
        !sites.some(
          ({ unary, recipe }) => proof.selection?.[0] === unary && proof.selection[1] === recipe,
        ),
    )
  )
    return "Complement cache group or source identity is unresolved";
  if (input.reference.kind !== "feasible")
    return "Complement cache needs both actual constructions";
  const reference = input.reference.checked.lowered.program.functions.filter(
    (fn) => fn.sourceFunction === packet.function.id,
  );
  if (reference.length !== 1) return "Complement reference ownership is unresolved";
  const before = image(input.reference.shared, reference[0]!, packet.function),
    after = image(input.candidate.shared, selected, packet.function);
  if (
    before === null ||
    after === null ||
    !actualBody(before, reference[0]!) ||
    !actualBody(after, selected)
  )
    return "Complement final code or entry binding disagrees";
  const sourceBefore = data(before, first.recipe.binding),
    sourceAfter = data(after, first.recipe.binding);
  const cache = privateByte(after, cacheId, packet.function);
  if (
    sourceBefore?.object.bytes.length !== 1 ||
    sourceAfter?.object.bytes.length !== 1 ||
    cache === null ||
    proofs.some(
      (proof) =>
        proof.source.kind !== "symbol" ||
        proof.source.id !== sourceAfter.object.id ||
        proof.source.offset !== 0,
    )
  )
    return "Complement source or cache backing is incomplete";
  const preheader = after.mapping.get(first.loop.preheader);
  const entry = preheader?.length === 1 ? after.blocks.get(preheader[0]!) : undefined;
  const setup = entry?.instructions.slice(-3);
  /** Architectural reads/stores resolve actual operands rather than trusting effect annotations. */
  const read = (
    view: Image,
    instruction: MachineInstruction | undefined,
    opcode: string,
    address: number,
  ) =>
    instruction?.opcode === opcode &&
    ["absolute", "zero-page"].includes(instruction.mode) &&
    operandAddress({ cpu: input.checked.profile.cpu, instruction, pc: 0, labels: view.labels }) ===
      address;
  /** The only moved value computation is the exact eight-bit one's complement. */
  const invert = (instruction: MachineInstruction | undefined) =>
    instruction?.opcode === "eor" &&
    instruction.mode === "immediate" &&
    instruction.operand?.kind === "immediate" &&
    instruction.operand.value === 255;
  if (
    entry?.label !== after.body.blocks[0]?.label ||
    setup === undefined ||
    !read(after, setup[0], "lda", sourceAfter.interval.start) ||
    !invert(setup[1]) ||
    !read(after, setup[2], "sta", cache.address)
  )
    return "Complement cache initialization is unresolved";
  const beforeBody = sequence(before, first.loop.body),
    afterBody = sequence(after, first.loop.body);
  if (beforeBody === null || afterBody === null)
    return "Complement use chain has an alternate entry or control path";
  const omitted = new Set<string>(),
    substitutions = new Map<string, string>();
  const watchedBefore = new Map([[sourceBefore.interval.start, new Set<string>()]]);
  const watchedAfter = new Map([[sourceAfter.interval.start, new Set<string>()]]);
  watchedAfter.set(cache.address, new Set([point(entry, entry.instructions.length - 1)]));
  const targetsBefore = new Map<string, StorageRange>(),
    targetsAfter = new Map<string, StorageRange>();
  const sourcePrefix = byteContinuationQuery(before.blocks),
    selectedPrefix = byteContinuationQuery(after.blocks);
  const changed = BYTE_WINDOW_CHANGED.a | BYTE_WINDOW_CHANGED.n | BYTE_WINDOW_CHANGED.z;
  if (!selectedPrefix(entry.label, entry.instructions.length, changed))
    return "Complement initialization exposes changed accumulator or flags";
  let start = 0;
  // Exact store-operation anchors delimit each source computation. The final
  // remainder comparison forbids unexplained changes between these anchors.
  for (const site of sites) {
    const anchor = (items: NonNullable<typeof beforeBody>) =>
      items.filter(({ instruction }) =>
        instruction.observerOrigins?.some(
          (origin) =>
            origin.kind === "typed" &&
            origin.operation === site.store &&
            origin.position === 0 &&
            origin.length === 1 &&
            origin.byte === 0,
        ),
      );
    const oldStore = anchor(beforeBody),
      newStore = anchor(afterBody);
    if (oldStore.length !== 1 || newStore.length !== 1)
      return "Complement store association is missing or ambiguous";
    const end = beforeBody.indexOf(oldStore[0]!);
    const triple = beforeBody.slice(start, start + 3),
      reload = beforeBody[end - 1];
    const useIndex = afterBody.indexOf(newStore[0]!),
      use = afterBody[useIndex - 1];
    const symbolicBlock = reference[0]!.blocks.find((block) => block.label === reload?.block.label);
    const operand =
      reload === undefined ? undefined : symbolicBlock?.instructions[reload.index]?.operand;
    const captured =
      operand?.kind === "storage" && (operand.offset ?? 0) === 0
        ? privateByte(before, operand.requestId, packet.function)
        : null;
    const destinationBefore = data(before, site.store.place.root),
      destinationAfter = data(after, site.store.place.root);
    if (
      captured === null ||
      reload === undefined ||
      use === undefined ||
      end <= start + 3 ||
      triple.length !== 3 ||
      triple.some((item) => item.block !== triple[0]!.block) ||
      !read(before, triple[0]?.instruction, "lda", sourceBefore.interval.start) ||
      !invert(triple[1]?.instruction) ||
      !read(before, triple[2]?.instruction, "sta", captured.address) ||
      !read(before, reload.instruction, "lda", captured.address) ||
      !read(after, use.instruction, "lda", cache.address) ||
      destinationBefore === null ||
      destinationAfter === null ||
      site.store.place.rootType?.kind !== "array" ||
      site.store.place.rootType.element.kind !== "scalar" ||
      site.store.place.rootType.element.name !== "byte" ||
      destinationBefore.object.bytes.length !== site.store.place.rootType.length ||
      destinationAfter.object.bytes.length !== destinationBefore.object.bytes.length
    )
      return "Complement reference capture or selected delivery disagrees";
    if (!sourcePrefix(triple[2]!.block.label, triple[2]!.index + 1, changed))
      return "Complement removed computation exposes accumulator or flags";
    const next = afterBody[start - omitted.size];
    if (next === undefined || !selectedPrefix(next.block.label, next.index, changed))
      return "Complement selected continuation exposes accumulator or flags";
    for (const item of triple) omitted.add(point(item.block, item.index));
    substitutions.set(point(reload.block, reload.index), point(use.block, use.index));
    watchedBefore.set(captured.address, new Set([point(triple[2]!.block, triple[2]!.index)]));
    targetsBefore.set(point(oldStore[0]!.block, oldStore[0]!.index), destinationBefore.interval);
    targetsAfter.set(point(newStore[0]!.block, newStore[0]!.index), destinationAfter.interval);
    start = end + 1;
  }
  if (
    start !== beforeBody.length ||
    !writes(input, before, watchedBefore, targetsBefore) ||
    !writes(input, after, watchedAfter, targetsAfter)
  )
    return "Complement source or private backing has an intervening write";
  const oldByLabel = new Map(reference[0]!.blocks.map((block) => [block.label, block]));
  const newActual = new Map(selected.blocks.map((block) => [block.label, block]));
  for (const [sourceBlock, labels] of before.mapping)
    if (JSON.stringify(labels) !== JSON.stringify(after.mapping.get(sourceBlock)))
      return "Complement source-block mappings disagree";
  for (const block of before.body.blocks) {
    const other = after.blocks.get(block.label),
      symbolic = oldByLabel.get(block.label),
      selectedBlock = newActual.get(block.label);
    if (
      other === undefined ||
      symbolic === undefined ||
      selectedBlock === undefined ||
      edge(block) !== edge(other)
    )
      return "Complement unchanged control or setup disagrees";
    const oldInstructions = block.instructions.flatMap((_, index) =>
      omitted.has(point(block, index))
        ? []
        : [{ key: point(block, index), code: symbolic.instructions[index]! }],
    );
    const newInstructions = other.instructions.flatMap((_, index) =>
      block.label === entry.label && index >= other.instructions.length - 3
        ? []
        : [{ key: point(other, index), code: selectedBlock.instructions[index]! }],
    );
    if (
      oldInstructions.length !== newInstructions.length ||
      oldInstructions.some((item, index) => {
        const next = newInstructions[index]!;
        return substitutions.has(item.key)
          ? substitutions.get(item.key) !== next.key
          : !same(item.code, next.code);
      })
    )
      return "Complement unchanged instruction or cache use disagrees";
  }
  return null;
}

/**
 * Validate one stable-byte cache group against both actual constructions after atomic authentication.
 * This returns no physical-footprint coverage and never accepts a whole candidate by itself.
 * @param input Original source and independently closed reference/candidate representations.
 * @param effects Discharged source/loop obligations and any exact composed field changes.
 * @returns A failed bounded proof, or null when no supported cache obligation remains.
 * @example const invalid = validateByteComplementObservers(input, effects);
 */
export function validateByteComplementObservers(
  input: FinalObserverInput,
  effects: Effects,
): ResidualFailure | null {
  const selected = input.candidate.lowered.program.functions.filter(
    (fn) => (fn.byteComplementProofs?.length ?? 0) > 0,
  );
  if (selected.length === 0) return null;
  const facts = input.candidate.lowered.program.storageSelection?.sourceFacts;
  if (
    input.reference.kind !== "feasible" ||
    facts?.program !== input.checked.program ||
    (facts.loopPolicy !== "original" &&
      facts.loopPolicy !== "low-byte" &&
      facts.loopPolicy !== "mixed") ||
    input.checked.program.roots.some(
      (root) =>
        root.kind === "callable" &&
        !new Set(
          [
            ...(input.checked.program.interruptRoutes ?? []).map((route) => route.handler),
            ...input.checked.program.roots.flatMap((entry) =>
              entry.kind === "interrupt" ? [entry.function] : [],
            ),
          ].map(bindingIdentityKey),
        ).has(bindingIdentityKey(root.function)),
    )
  )
    return failure("rejected", "Complement cache needs both synchronous Original constructions");
  for (const fn of selected) {
    const packet = [...facts.functions.values()].find(
      (packet) => packet.function.id === fn.sourceFunction,
    );
    if (packet === undefined)
      return failure("rejected", "Complement source ownership is unresolved");
    const kinds = new Set(fn.byteComplementProofs!.map((proof) => proof.kind));
    if (kinds.size !== 1 || (!kinds.has("cache") && !kinds.has("original")))
      return failure("rejected", "Mixed or unknown complement classes remain unproved");
    // Low-byte loops may reuse the field matcher, never the cache-only proof.
    const composition = effects.lowByteComposition;
    if (
      (facts.loopPolicy === "low-byte" || facts.loopPolicy === "mixed") &&
      (!kinds.has("original") ||
        composition === undefined ||
        !composition.functions.has(packet.function) ||
        composition.loops.size !== effects.loops.size ||
        [...effects.loops].some((loop) => !composition.loops.has(loop)))
    )
      return failure("rejected", "Composed LowByte fields need the complete actual group");
    if (kinds.has("cache") && effects.operations.size !== 0)
      return failure("rejected", "Complement cache needs both synchronous Original constructions");
    const reason = kinds.has("original")
      ? validateFieldComplements(input, effects, fn, packet)
      : group(input, effects, fn, packet);
    if (reason !== null) return failure("rejected", reason, packet.function.source);
  }
  return null;
}
