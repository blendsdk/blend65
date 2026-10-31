import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { semanticTypesEqual } from "../frontend/semantic-type-relations.js";
import { bindingLabel } from "../machine/lower-control.js";
import { memberWrites } from "../machine/lower-aggregate-members.js";
import type {
  MachineBlock,
  MachineFunction,
  MachineInstruction,
  MachineOperand,
} from "../machine/machine-types.js";
import { operationValueUses } from "../semantic/lower-control.js";
import type { SemanticBlock, SemanticFunction, SemanticOperation } from "../semantic/operations.js";
import type { StorageRequest, StorageHome, StorageRange } from "../storage/storage-types.js";
import type { SourceSpan } from "../project/types.js";
import { findNamedObjectBacking } from "./size-observer-backing.js";
import type { Backing, ObjectRoot } from "./size-observer-backing.js";
import { failure } from "./size-observer-raw-layout.js";
import type { ResidualFailure } from "./size-observer-raw-layout.js";
import type { FinalObserverInput } from "./size-observers.js";

/** Source discharges only: this result grants no machine-footprint or tuple acceptance. */
export type CaptureValidation =
  | ResidualFailure
  | {
      /** Every admitted capture and its consumers have closed. */
      readonly kind: "complete";
      /** Exact source capture operations, not their original objects' identities. */
      readonly operations: ReadonlySet<SemanticOperation>;
    };

/** A byte-copy interval in one symbolic function, before deterministic binding. */
interface CopyWindow {
  /** First setup/load instruction, ordered by actual block and instruction indices. */
  readonly begin: readonly [number, number];
  /** First instruction after the complete copy. */
  readonly end: readonly [number, number];
  /** Exact instructions belonging to this independently checked copy template. */
  readonly instructions: ReadonlySet<MachineInstruction>;
}

/** Complete inclusive extents must not alias during snapshot creation or consumption. */
function separate(left: StorageRange, right: StorageRange): boolean {
  return left.end < right.start || right.end < left.start;
}

/** Source order is checked only after the surrounding graph is proved linear modulo copy loops. */
function before(left: readonly [number, number], right: readonly [number, number]): boolean {
  return left[0] < right[0] || (left[0] === right[0] && left[1] <= right[1]);
}

/** Compare only the admitted symbolic address forms; a low/high address is not a data byte. */
function operandEquals(actual: MachineOperand | null, expected: MachineOperand | null): boolean {
  if (actual === null || expected === null) return actual === expected;
  if (actual.kind !== expected.kind) return false;
  if (actual.kind === "immediate" && expected.kind === "immediate")
    return actual.value === expected.value;
  if (actual.kind === "storage" && expected.kind === "storage")
    return (
      actual.requestId === expected.requestId &&
      (actual.offset ?? 0) === (expected.offset ?? 0) &&
      actual.addressByte === expected.addressByte
    );
  if (actual.kind === "label" && expected.kind === "label")
    return (
      actual.label === expected.label &&
      (actual.offset ?? 0) === (expected.offset ?? 0) &&
      actual.addressByte === expected.addressByte &&
      actual.transform === undefined
    );
  return (
    actual.kind === "indirect-y" &&
    expected.kind === "indirect-y" &&
    actual.requestId === expected.requestId &&
    (actual.offset ?? 0) === (expected.offset ?? 0)
  );
}

/** Check instructions against a CPU-independent shape, not optional memory-effect annotations. */
function instructionIs(
  instruction: MachineInstruction | undefined,
  opcode: string,
  mode: string,
  operand: MachineOperand | null = null,
): boolean {
  return (
    instruction !== undefined &&
    instruction.opcode === opcode &&
    instruction.mode === mode &&
    operandEquals(instruction.operand, operand)
  );
}

/** Construct the actual named object's symbolic base from its already resolved backing. */
function baseOperand(
  root: ObjectRoot,
  backing: Backing,
): Extract<MachineOperand, { readonly kind: "storage" | "label" }> {
  return backing.request === null
    ? { kind: "label", label: bindingLabel("global", root.binding), offset: 0 }
    : { kind: "storage", requestId: backing.request.id, offset: 0 };
}

/** Exact fallthroughs cannot hide an extra call, branch, instruction or copy bypass. */
function falls(block: MachineBlock | undefined, next: MachineBlock | undefined): boolean {
  return (
    block !== undefined &&
    next !== undefined &&
    block.terminator.kind === "fallthrough" &&
    block.terminator.target === next.label
  );
}

/** The count loop must visit each byte once, including the final iteration and correct exit. */
function branches(
  block: MachineBlock | undefined,
  opcode: string,
  target: MachineBlock | undefined,
  next: MachineBlock | undefined,
): boolean {
  return (
    block !== undefined &&
    target !== undefined &&
    next !== undefined &&
    block.terminator.kind === "branch" &&
    block.terminator.opcode === opcode &&
    block.terminator.target === target.label &&
    block.terminator.fallthrough === next.label
  );
}

/**
 * Recognize only existing sub-page direct/unrolled and counted memmove templates.
 * Request identities come from the capture association and actual named backing. Source spans
 * locate candidate instruction groups only; every address, byte and graph edge is checked.
 */
function copyWindow(
  fn: MachineFunction,
  source: SourceSpan,
  from: Extract<MachineOperand, { readonly kind: "storage" | "label" }>,
  to: Extract<MachineOperand, { readonly kind: "storage" | "label" }>,
  bytes: number,
  directional: boolean,
  requests: ReadonlyMap<string, StorageRequest>,
  homes: ReadonlyMap<string, StorageHome>,
): CopyWindow | null {
  const matches: CopyWindow[] = [];
  const blocks = fn.blocks;
  const immediate = (value: number): MachineOperand => ({ kind: "immediate", value });
  const storage = (requestId: string, offset: number): MachineOperand => ({
    kind: "storage",
    requestId,
    offset,
  });
  for (const [rank, block] of blocks.entries())
    for (let index = 0; index < block.instructions.length; index += 1) {
      const firstInstruction = block.instructions[index];
      if (
        firstInstruction?.source !== source ||
        firstInstruction.opcode !== "lda" ||
        !operandEquals(firstInstruction.operand, bytes < 8 ? from : { ...from, addressByte: "low" })
      )
        continue;
      const sequence = block.instructions.slice(index);
      if (bytes < 8) {
        const copy = sequence.slice(0, bytes * 2);
        if (
          copy.length === bytes * 2 &&
          copy.every((instruction, ordinal) => {
            const load = ordinal % 2 === 0;
            const base = load ? from : to;
            return (
              instruction.source === source &&
              instructionIs(
                instruction,
                load ? "lda" : "sta",
                base.kind === "label" ? "absolute" : "storage",
                { ...base, offset: Math.floor(ordinal / 2) },
              )
            );
          })
        )
          matches.push({
            begin: [rank, index],
            end: [rank, index + copy.length],
            instructions: new Set(copy),
          });
        continue;
      }
      const first = sequence[1]?.operand,
        second = sequence[5]?.operand;
      if (
        first?.kind !== "storage" ||
        second?.kind !== "storage" ||
        first.requestId === second.requestId
      )
        continue;
      if (
        ![first.requestId, second.requestId].every((id) => {
          const request = requests.get(id),
            home = homes.get(id);
          return (
            request?.storageClass === "pointer" &&
            request.bytes === 2 &&
            home?.bytes === 2 &&
            home.region === "zero-page"
          );
        })
      )
        continue;
      const fromId = first.requestId,
        toId = second.requestId;
      const setup = sequence.slice(0, 8);
      if (
        setup.length !== 8 ||
        !setup.every((instruction, ordinal) => {
          const sourcePointer = ordinal < 4,
            low = ordinal % 4 < 2;
          return (
            instruction.source === source &&
            (ordinal % 2 === 0
              ? instructionIs(instruction, "lda", "immediate", {
                  ...(sourcePointer ? from : to),
                  addressByte: low ? "low" : "high",
                })
              : instructionIs(
                  instruction,
                  "sta",
                  "storage",
                  storage(sourcePointer ? fromId : toId, low ? 0 : 1),
                ))
          );
        })
      )
        continue;
      const forward = blocks[rank + (directional ? 4 : 1)];
      const start = blocks[rank + (directional ? 5 : 2)];
      const loop = blocks[rank + (directional ? 6 : 3)];
      const doneRank = rank + (directional ? 9 : 4),
        done = blocks[doneRank];
      if (
        forward === undefined ||
        start === undefined ||
        loop === undefined ||
        done === undefined ||
        forward.instructions.length !== 0 ||
        !falls(forward, start) ||
        start.instructions.length !== 1 ||
        !instructionIs(start.instructions[0], "ldy", "immediate", immediate(0)) ||
        !falls(start, loop)
      )
        continue;
      const loopMatches = (block: MachineBlock, backwards: boolean) =>
        block.instructions.length === 4 &&
        instructionIs(block.instructions[0], "lda", "indirect-indexed-y", {
          kind: "indirect-y",
          requestId: fromId,
          offset: 0,
        }) &&
        instructionIs(block.instructions[1], "sta", "indirect-indexed-y", {
          kind: "indirect-y",
          requestId: toId,
          offset: 0,
        }) &&
        instructionIs(block.instructions[2], backwards ? "dey" : "iny", "implied") &&
        instructionIs(
          block.instructions[3],
          "cpy",
          "immediate",
          immediate(backwards ? 255 : bytes),
        ) &&
        branches(block, "bne", block, done);
      if (!loopMatches(loop, false)) continue;
      if (!directional) {
        if (sequence.length !== 8 || !falls(block, forward)) continue;
      } else {
        const high = blocks[rank + 1],
          low = blocks[rank + 2],
          order = blocks[rank + 3];
        const backward = blocks[rank + 7],
          reverse = blocks[rank + 8];
        if (
          high === undefined ||
          low === undefined ||
          order === undefined ||
          backward === undefined ||
          reverse === undefined ||
          sequence.length !== 10 ||
          !instructionIs(sequence[8], "lda", "storage", storage(toId, 1)) ||
          !instructionIs(sequence[9], "cmp", "storage", storage(fromId, 1)) ||
          !branches(block, "bcc", forward, high) ||
          high.instructions.length !== 0 ||
          !branches(high, "bne", backward, low) ||
          low.instructions.length !== 2 ||
          !instructionIs(low.instructions[0], "lda", "storage", storage(toId, 0)) ||
          !instructionIs(low.instructions[1], "cmp", "storage", storage(fromId, 0)) ||
          !branches(low, "beq", done, order) ||
          order.instructions.length !== 0 ||
          !branches(order, "bcc", forward, backward) ||
          backward.instructions.length !== 1 ||
          !instructionIs(backward.instructions[0], "ldy", "immediate", immediate(bytes - 1)) ||
          !falls(backward, reverse) ||
          !loopMatches(reverse, true)
        )
          continue;
      }
      const instructions = new Set(sequence);
      for (let inner = rank + 1; inner < doneRank; inner += 1)
        for (const instruction of blocks[inner]!.instructions) instructions.add(instruction);
      if ([...instructions].some((instruction) => instruction.source !== source)) continue;
      matches.push({ begin: [rank, index], end: [doneRank, 0], instructions });
    }
  return matches.length === 1 ? matches[0]! : null;
}

/** Collapse only the checked copy loops; every remaining edge must execute in source order. */
function linearCopies(
  fn: MachineFunction,
  copies: readonly CopyWindow[],
  startup: ReadonlySet<string>,
): boolean {
  const loops = new Map<number, number>();
  for (const copy of copies)
    if (copy.begin[0] !== copy.end[0]) {
      if (loops.has(copy.begin[0])) return false;
      loops.set(copy.begin[0], copy.end[0]);
    }
  let index = 0;
  while (index < fn.blocks.length) {
    const next = loops.get(index);
    if (next !== undefined) {
      if (next <= index) return false;
      index = next;
      continue;
    }
    const block = fn.blocks[index]!;
    if (index === fn.blocks.length - 1)
      return (
        block.terminator.kind === "return" ||
        (block.terminator.kind === "jump" && startup.has(block.terminator.target))
      );
    if (!falls(block, fn.blocks[index + 1])) return false;
    index += 1;
  }
  return false;
}

/** Test one source point or an inclusive interval; differing addresses do not replace occupancy. */
function live(
  request: StorageRequest,
  fn: SemanticFunction,
  block: SemanticBlock,
  index: number,
  end = index,
): boolean {
  return (
    bindingIdentityKey(request.lifetime.function) === bindingIdentityKey(fn.id) &&
    request.lifetime.liveAt.some(
      (position) =>
        position.block === block.id && position.operation >= index && position.operation <= end,
    )
  );
}

/**
 * Close evaluated member snapshots without treating them as aliases of their mutated sources.
 * The initial class is one whole-object capture in a straight-line body, consumed by a named
 * aggregate's first member. Other source forms retain ordinary tuple fallback. Actual copy
 * templates, source order, full extents and call interference must close on both layouts.
 * @param input Original checked source and authenticated final reference/candidate constructions.
 * @returns Source capture discharges only, or a precise unsupported/inconsistent proof result.
 * @example const captures = validateCapturedAggregates(input);
 */
export function validateCapturedAggregates(input: FinalObserverInput): CaptureValidation {
  const operations = new Set<SemanticOperation>();
  const reached = new Set(input.checked.program.reachableFunctions.map(bindingIdentityKey));
  const functions = input.checked.program.semantic.functions.filter((fn) =>
    reached.has(bindingIdentityKey(fn.id)),
  );
  const sites = functions.flatMap((fn) =>
    fn.blocks.flatMap((block) =>
      block.operations.flatMap((operation, index) =>
        operation.kind === "place-address" && operation.captureValue === true
          ? [{ fn, block, operation, index }]
          : [],
      ),
    ),
  );
  if (sites.length === 0) return { kind: "complete", operations };
  if (
    input.reference.kind !== "feasible" ||
    input.candidate.lowered.program.storageSelection?.sourceFacts?.program !==
      input.checked.program ||
    (input.checked.program.interruptRoutes?.length ?? 0) > 0 ||
    input.checked.program.roots.some(({ kind }) => kind === "callable")
  )
    return failure("rejected", "Captured members need both actual synchronous constructions");
  const globals = new Set(
    input.checked.program.semantic.globals.map(({ id }) => bindingIdentityKey(id)),
  );
  const sides = [
    { lowered: input.reference.checked.lowered, shared: input.reference.shared },
    input.candidate,
  ];
  /** Each actual layout owns one lazy index; reference addresses never enter the candidate cache. */
  const indexes = sides.map(({ shared }) => {
    const create = () => ({
      requests: new Map(
        shared.certificate.inventory.requests.map((request) => [request.id, request]),
      ),
      homes: new Map(shared.certificate.certificate.homes.map((home) => [home.requestId, home])),
      conflicts: new Set(
        shared.certificate.certificate.interference.map((edge) =>
          [edge.left, edge.right].sort().join("\0"),
        ),
      ),
    });
    let cached: ReturnType<typeof create> | undefined;
    return () => (cached ??= create());
  });
  for (const site of sites) {
    const { fn, block, operation, index } = site;
    /** Keep every failure attached to this exact capture unless a later call is responsible. */
    const reject = (reason: string, source = operation.span, objectId: string | null = null) =>
      failure("rejected", reason, source, objectId);
    const type = operation.type;
    if (
      (type.kind !== "array" && type.kind !== "struct") ||
      type.size <= 0 ||
      type.size >= 256 ||
      fn.blocks.length !== 1 ||
      fn.entry !== block.id ||
      block.terminator.kind !== "return" ||
      sites.filter((other) => other.fn === fn).length !== 1 ||
      operation.place.path.length !== 0 ||
      operation.place.asset !== undefined ||
      operation.place.rootType === undefined ||
      !semanticTypesEqual(operation.place.rootType, type) ||
      fn.parameters.some(
        ({ id }) => bindingIdentityKey(id) === bindingIdentityKey(operation.place.root),
      )
    )
      return reject("Capture shape needs a stronger source or copy proof");
    const sourceRoot: ObjectRoot = {
      binding: operation.place.root,
      owner: globals.has(bindingIdentityKey(operation.place.root)) ? null : fn.id,
      type,
    };
    const pending = new Set([operation.result]);
    const consumers: {
      readonly operation: Extract<SemanticOperation, { readonly kind: "aggregate" }>;
      readonly index: number;
      readonly root: ObjectRoot;
    }[] = [];
    for (const value of pending) {
      let uses = 0;
      if (block.terminator.value === value)
        return reject("Captured values cannot leave the proved construction");
      for (const [consumerIndex, consumer] of block.operations.entries())
        if (operationValueUses(consumer).includes(value)) {
          uses += 1;
          if (
            consumer.kind === "convert" &&
            consumer.conversion === "identity" &&
            semanticTypesEqual(consumer.type, type) &&
            consumerIndex > index &&
            !pending.has(consumer.result)
          ) {
            pending.add(consumer.result);
            continue;
          }
          const destination = consumer.kind === "aggregate" ? consumer.destination : undefined;
          if (
            consumer.kind !== "aggregate" ||
            destination?.kind !== "place" ||
            destination.place.path.length !== 0 ||
            destination.place.asset !== undefined ||
            (consumer.type.kind !== "array" && consumer.type.kind !== "struct") ||
            globals.has(bindingIdentityKey(destination.place.root)) ||
            fn.parameters.some(
              ({ id }) => bindingIdentityKey(id) === bindingIdentityKey(destination.place.root),
            ) ||
            consumerIndex <= index
          )
            return reject(
              "Captured value has an unproved construction or publication consumer",
              consumer.span,
            );
          const members = memberWrites(consumer).filter((member) => member.valueId === value);
          if (members.length !== 1 || members[0]!.start !== 0 || members[0]!.bytes !== type.size)
            return reject("Captured member extent or displacement is unproved", consumer.span);
          consumers.push({
            operation: consumer,
            index: consumerIndex,
            root: { binding: destination.place.root, owner: fn.id, type: consumer.type },
          });
        }
      if (uses === 0) return reject("Captured value has no complete construction consumer");
    }
    if (consumers.length !== 1)
      return reject("Multiple captured deliveries need a stronger ordering proof");
    const consumer = consumers[0]!;
    const between = block.operations.slice(index + 1, consumer.index);
    if (
      between.some(
        (op) =>
          op.kind !== "constant" &&
          op.kind !== "call" &&
          !(op.kind === "convert" && op.conversion === "identity"),
      )
    )
      return reject("Intervening capture effects need a stronger ordering proof");
    for (const [side, { lowered, shared }] of sides.entries()) {
      /** Keep duplicate bodies visible so both source and call queries enforce exact cardinality. */
      const mainBodies = (owner: typeof fn.id) =>
        lowered.program.functions.filter(
          (body) =>
            body.sourceFunction !== undefined &&
            bindingIdentityKey(body.sourceFunction) === bindingIdentityKey(owner) &&
            body.executionContext?.domain === "main" &&
            body.executionContext.activationRoot === undefined,
        );
      const machine = mainBodies(fn.id);
      const body = machine.length === 1 ? machine[0] : undefined;
      const records = body?.observerCaptures;
      if (body === undefined || records?.length !== 1 || records[0]!.operation !== operation)
        return reject("Capture has no exact actual producer association");
      const mapped = body.observerBlocks;
      if (
        mapped?.length !== 1 ||
        mapped[0]![0] !== block ||
        mapped[0]![1].length !== body.blocks.length ||
        !body.blocks.every((part, ordinal) => mapped[0]![1][ordinal] === part.label)
      )
        return reject("Capture source block has an unresolved emitted graph");
      if (
        shared.certificate.inventory.program.returnedLocalDestinations?.some(
          (result) =>
            bindingIdentityKey(result.local) === bindingIdentityKey(sourceRoot.binding) ||
            bindingIdentityKey(result.local) === bindingIdentityKey(consumer.root.binding),
        )
      )
        return reject("Redirected capture backing needs its own result proof");
      const { requests, homes, conflicts } = indexes[side]!();
      const request = requests.get(records[0]!.requestId),
        home = request === undefined ? undefined : homes.get(request.id);
      if (
        request === undefined ||
        request.storageClass !== "temporary" ||
        request.binding !== null ||
        bindingIdentityKey(request.owner) !== bindingIdentityKey(fn.id) ||
        bindingIdentityKey(request.lifetime.function) !== bindingIdentityKey(fn.id) ||
        (request.domain !== undefined && request.domain !== "main") ||
        request.activationRoot !== undefined ||
        request.type === null ||
        !semanticTypesEqual(request.type, type) ||
        request.bytes !== type.size ||
        home?.bytes !== type.size
      )
        return reject("Capture has no actual complete temporary backing");
      const range = { start: home.address, end: home.address + home.bytes - 1 };
      const source = findNamedObjectBacking(sourceRoot, shared, homes),
        destination = findNamedObjectBacking(consumer.root, shared, homes);
      if (
        source === null ||
        destination?.request == null ||
        !separate(source.range, range) ||
        !separate(destination.range, range) ||
        (source.request !== null && !live(source.request, fn, block, index)) ||
        !live(destination.request, fn, block, consumer.index)
      )
        return reject("Capture source or destination backing is incomplete or overlapping");
      const snapshot = { kind: "storage" as const, requestId: request.id, offset: 0 };
      const capture = copyWindow(
        body,
        operation.span,
        baseOperand(sourceRoot, source),
        snapshot,
        type.size,
        false,
        requests,
        homes,
      );
      const delivery = copyWindow(
        body,
        consumer.operation.span,
        snapshot,
        baseOperand(consumer.root, destination),
        type.size,
        type.size >= 8,
        requests,
        homes,
      );
      const copies = capture === null || delivery === null ? [] : [capture, delivery];
      if (
        capture === null ||
        delivery === null ||
        !before(capture.end, delivery.begin) ||
        !linearCopies(
          body,
          copies,
          new Set(lowered.program.startup.blocks.map(({ label }) => label)),
        )
      )
        return reject("Complete capture or member delivery template/order is unproved");
      const allowed = new Set(copies.flatMap((copy) => [...copy.instructions]));
      if (
        body.blocks.some((part) =>
          part.instructions.some(
            (instruction) =>
              instruction.operand !== null &&
              "requestId" in instruction.operand &&
              instruction.operand.requestId === request.id &&
              !allowed.has(instruction),
          ),
        )
      )
        return reject("Capture backing has an extra unchecked machine use");
      const owners = new Set<string>();
      for (const call of between)
        if (call.kind === "call") {
          if (
            !request.lifetime.callsCrossed.some(
              (span) =>
                span.sourceId === call.span.sourceId &&
                span.start === call.span.start &&
                span.end === call.span.end,
            )
          )
            return reject("Capture lifetime does not cross a complete call", call.span);
          const callee = mainBodies(call.callee);
          const calls = body.blocks.flatMap((part, rank) =>
            part.instructions.flatMap((instruction, ordinal) =>
              instruction.source === call.span &&
              instructionIs(instruction, "jsr", "absolute", {
                kind: "label",
                label: callee[0]?.id ?? "",
              })
                ? [[rank, ordinal] as const]
                : [],
            ),
          );
          if (
            callee.length !== 1 ||
            calls.length !== 1 ||
            !before(capture.end, calls[0]!) ||
            !before(calls[0]!, delivery.begin)
          )
            return reject("A later source call is not between the complete copies", call.span);
          owners.add(bindingIdentityKey(call.callee));
        }
      for (let changed = true; changed; ) {
        changed = false;
        for (const edge of input.checked.program.callGraph)
          if (owners.has(bindingIdentityKey(edge.function)))
            for (const callee of edge.callees) {
              const key = bindingIdentityKey(callee);
              if (!owners.has(key)) {
                owners.add(key);
                changed = true;
              }
            }
      }
      const helpers = new Set(
        shared.certificate.certificate.helperCalls
          .filter((call) => owners.has(bindingIdentityKey(call.caller)))
          .flatMap((call) => call.helperRequestIds),
      );
      const occupied = new Set(
        request.lifetime.liveAt.map((position) => `${position.block}\0${position.operation}`),
      );
      for (let position = index; position <= consumer.index; position += 1)
        if (!occupied.has(`${block.id}\0${position}`))
          return reject("Capture occupancy ends before its complete consumption");
      for (const other of requests.values()) {
        if (
          other.id === request.id ||
          !(
            live(other, fn, block, index, consumer.index) ||
            owners.has(bindingIdentityKey(other.owner)) ||
            helpers.has(other.id)
          )
        )
          continue;
        const actual = homes.get(other.id);
        if (
          actual === undefined ||
          !separate(range, { start: actual.address, end: actual.address + actual.bytes - 1 }) ||
          !conflicts.has([request.id, other.id].sort().join("\0"))
        )
          return reject(
            "Capture lacks complete live-storage separation or conflict proof",
            operation.span,
            other.id,
          );
      }
    }
    operations.add(operation);
  }
  return Object.freeze({ kind: "complete", operations });
}
