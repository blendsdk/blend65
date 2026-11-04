import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import {
  validFixedLoopFacts,
  rawAccessFootprint,
  literalResolver,
  ordinalBoundResolver,
  valueDefinitions,
} from "../semantic/aggregate-place-proof.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import type { LoadOperation, SemanticFunction } from "../semantic/operations.js";
import { C64_STARTUP_STATE_ID } from "../layout/startup.js";
import {
  byteContinuationQuery,
  BYTE_WINDOW_CHANGED as STATE,
  machineSuccessors,
  typeBytes,
} from "../machine/lower-control.js";
import { instructionAccessEnvelope, operandAddress } from "../machine/nmos6510-access.js";
import { nmosInstructionForm, nmosInstructionState } from "../target/nmos6510.js";
import type { MachineFunction, MachineInstruction } from "../machine/machine-types.js";
import type { StorageRequest, StorageRange } from "../storage/storage-types.js";
import { body, side, request } from "./size-observer-complement-field-layout.js";
import type { Body, Item } from "./size-observer-complement-field-layout.js";
import { bitSafe, stateSafe } from "./size-observer-complement-field-state.js";
import { matchLowByteOccurrences } from "./size-observer-low-byte-occurrences.js";
import type { LowByteFunctionChanges } from "./size-observer-low-byte-occurrences.js";
import { checkLayout, failure } from "./size-observer-raw-layout.js";
import type { RawSite, ResidualFailure } from "./size-observer-raw-layout.js";
import type { FinalObserverInput } from "./size-observers.js";

/** Joint source induction and actual counter changes for one immutable input invocation. */
export type LowByteComposition = {
  /** Only loops whose counter premises close together. */ readonly loops: ReadonlySet<FixedLoopFacts>;
  /** Remaining code/field correspondence still has mandatory consumers. */ readonly functions: ReadonlyMap<
    SemanticFunction,
    LowByteFunctionChanges
  >;
};
/** Prepared counter data uses the occurrence owner's single shared contract. */
type Counter = NonNullable<ReturnType<LowByteFunctionChanges["counters"]["get"]>>;
/** Complete range intersection, including one-byte accesses. */
const overlaps = (a: StorageRange, b: StorageRange) => a.start <= b.end && b.start <= a.end;
/** Stable source-position identity, not machine block placement. */
const position = (block: string, operation: number) => JSON.stringify([block, operation]);

/** Require conservative full-function occupancy, retaining actual source calls. */
function occupied(declared: StorageRequest, fn: SemanticFunction): boolean {
  const live = new Set(declared.lifetime.liveAt.map((at) => position(at.block, at.operation)));
  const calls = fn.blocks.flatMap((block) =>
    block.operations.filter((op) => op.kind === "call").map((op) => op.span),
  );
  return (
    declared.owner === fn.id &&
    declared.lifetime.function === fn.id &&
    declared.activationRoot === undefined &&
    (declared.domain === undefined || declared.domain === "main") &&
    !declared.persistent &&
    !declared.pageSafeIndirect &&
    calls.length === declared.lifetime.callsCrossed.length &&
    calls.every((span) => declared.lifetime.callsCrossed.includes(span)) &&
    fn.blocks.every((block) =>
      Array.from({ length: block.operations.length + 1 }, (_, index) =>
        live.has(position(block.id, index)),
      ).every(Boolean),
    )
  );
}

/** Decode the real instruction position without trusting a reported width. */
function pcOf(input: FinalObserverInput, item: Item): number | null {
  let pc = item.block.origin;
  if (pc === undefined || !Number.isSafeInteger(pc)) return null;
  for (const instruction of item.block.instructions.slice(0, item.index)) {
    const form = nmosInstructionForm(
      input.checked.profile.cpu,
      instruction.opcode,
      instruction.mode,
    );
    if (form === null) return null;
    pc += form.bytes;
  }
  return pc;
}

/** Authenticate every real call and reject address-taking/interior entries into selected code. */
function entries(
  input: FinalObserverInput,
  view: Body["view"],
  selected: ReadonlySet<BindingId>,
): boolean {
  const program = view.shared.layout.program,
    all = [program.startup, ...program.functions];
  const sources = input.checked.program.semantic.functions;
  const protectedCode = new Map<MachineFunction, Set<number>>();
  for (const fn of program.functions.filter(
    (fn) => fn.sourceFunction !== undefined && selected.has(fn.sourceFunction),
  )) {
    const bytes = new Set<number>();
    for (const block of fn.blocks) {
      let pc = block.origin;
      if (pc === undefined) return false;
      for (const instruction of block.instructions) {
        const form = nmosInstructionForm(
          input.checked.profile.cpu,
          instruction.opcode,
          instruction.mode,
        );
        if (form === null) return false;
        for (let byte = 0; byte < form.bytes; byte += 1) bytes.add(pc++);
      }
      const kind = block.terminator.kind;
      const length =
        kind === "return"
          ? 1
          : kind === "jump"
            ? 3
            : kind === "branch"
              ? 2
              : kind === "long-branch"
                ? 5
                : 0;
      for (let byte = 0; byte < length; byte += 1) bytes.add(pc++);
    }
    protectedCode.set(fn, bytes);
  }
  for (const fn of all) {
    const source = sources.find((source) => source.id === fn.sourceFunction);
    const expected =
      source?.blocks.flatMap((block) => block.operations.filter((op) => op.kind === "call")) ?? [];
    const seen = new Set<unknown>();
    for (const block of fn.blocks) {
      for (const target of machineSuccessors(block)) {
        const address = view.labels.get(target);
        for (const [owner, bytes] of protectedCode)
          if (
            owner !== fn &&
            address !== undefined &&
            bytes.has(address) &&
            // A compact startup prologue may reach main through a later
            // initialization block, not only block zero. The startup constructor
            // owns that shape; this check only rejects entries from other functions.
            !(
              fn === program.startup &&
              owner.sourceFunction === input.checked.program.semantic.main &&
              target === owner.id
            )
          )
            return false;
      }
      for (const [index, instruction] of block.instructions.entries()) {
        const operand = instruction.operand;
        const target =
          operand?.kind === "label"
            ? program.functions.find((fn) => fn.id === operand.label)
            : undefined;
        const call = expected.find((call) => call.span === instruction.source);
        if (instruction.opcode === "jsr") {
          if (
            call === undefined ||
            seen.has(call) ||
            target?.sourceFunction !== call.callee ||
            instruction.mode !== "absolute" ||
            operand?.kind !== "label" ||
            (operand.offset ?? 0) !== 0 ||
            operand.addressByte !== undefined ||
            operand.transform !== undefined
          )
            return false;
          seen.add(call);
        }
        const pc =
          block.origin! +
          block.instructions.slice(0, index).reduce((sum, item) => sum + item.cost.bytes, 0);
        const address = operandAddress({
          cpu: input.checked.profile.cpu,
          instruction,
          pc,
          labels: view.labels,
        });
        const symbol =
          operand?.kind === "label"
            ? (view.labels.get(operand.label) ?? NaN) + (operand.offset ?? 0)
            : NaN;
        for (const [owner, bytes] of protectedCode)
          if ((address !== null && bytes.has(address)) || bytes.has(symbol)) {
            if (!(instruction.opcode === "jsr" && target === owner && call !== undefined))
              return false;
          }
      }
    }
    if (expected.length !== seen.size) return false;
  }
  return true;
}

/**
 * Compact looped startup keeps the caller's P on the stack and only the platform
 * roots in the state interval. The capture and restore loops are exact, so the
 * low-byte composition may treat the state interval and held P as immutable.
 */
function compactSavedState(input: FinalObserverInput, view: Body["view"]) {
  const program = view.shared.layout.program;
  const policy = program.c64Startup?.startupPolicy;
  if (
    program.c64Startup?.displayIndependent !== true ||
    policy !== "compact-looped" ||
    program.c64Startup.initializerLabels.length !== 0
  )
    return null;
  const block = (label: string) => program.startup.blocks.find((entry) => entry.label === label);
  const entry = block("startup.entry");
  const capture = block("startup.capture");
  const mainEntry = block("startup.entry.main");
  const restore = block("startup.restore");
  const restoreBorrow = block("startup.restore.borrow");
  const restoreTail = block("startup.restore.tail");
  if (
    entry === undefined ||
    capture === undefined ||
    mainEntry === undefined ||
    restore === undefined ||
    restoreBorrow === undefined ||
    restoreTail === undefined ||
    restoreTail.terminator.kind !== "return" ||
    mainEntry.terminator.kind !== "fallthrough"
  )
    return null;
  const state = view.shared.layout.intervals.find((range) => range.id === C64_STARTUP_STATE_ID);
  if (state === undefined || state.end - state.start < 4) return null;
  const stateSlot = (
    instruction: (typeof entry.instructions)[number] | undefined,
    opcode: string,
    offset: number,
  ) =>
    instruction?.opcode === opcode &&
    instruction.mode === "absolute" &&
    instruction.operand?.kind === "label" &&
    instruction.operand.label === C64_STARTUP_STATE_ID &&
    (instruction.operand.offset ?? 0) === offset &&
    instruction.operand.addressByte === undefined &&
    instruction.operand.transform === undefined;
  const indexedSlot = (
    instruction: (typeof entry.instructions)[number] | undefined,
    opcode: string,
    address: number | typeof C64_STARTUP_STATE_ID,
    offset = 0,
  ) =>
    instruction?.opcode === opcode &&
    instruction.mode === "absolute-x" &&
    (typeof address === "number"
      ? instruction.operand?.kind === "absolute" && instruction.operand.value === address
      : instruction.operand?.kind === "label" &&
        instruction.operand.label === address &&
        (instruction.operand.offset ?? 0) === offset);
  // Entry: mask IRQs, clear decimal mode, capture the three platform roots, then
  // seed the capture loop with the highest borrowed byte.
  if (
    entry.instructions[0]?.opcode !== "php" ||
    entry.instructions[1]?.opcode !== "sei" ||
    entry.instructions[2]?.opcode !== "cld" ||
    !stateSlot(entry.instructions[4], "stx", 0) ||
    !stateSlot(entry.instructions[6], "sta", 1) ||
    !entry.instructions.some((instruction) => stateSlot(instruction, "sta", 2)) ||
    entry.terminator.kind !== "fallthrough" ||
    entry.terminator.target !== "startup.capture"
  )
    return null;
  const captureTail = capture.instructions.slice(-4);
  if (
    !indexedSlot(captureTail[0], "lda", 0x0003) ||
    !indexedSlot(captureTail[1], "sta", C64_STARTUP_STATE_ID, 3) ||
    captureTail[2]?.opcode !== "dex" ||
    capture.terminator.kind !== "branch" ||
    capture.terminator.opcode !== "bpl" ||
    capture.terminator.target !== "startup.capture"
  )
    return null;
  const mainTail = mainEntry.instructions.slice(-6);
  if (
    mainTail.map(({ opcode }) => opcode).join(",") !== "tsx,inx,lda,pha,plp,cld" ||
    !indexedSlot(mainTail[2], "lda", 0x0100)
  )
    return null;
  const restoreTailInstructions = restoreTail.instructions.slice(-6);
  if (
    restore.instructions[0]?.opcode !== "sei" ||
    restore.terminator.kind !== "fallthrough" ||
    restore.terminator.target !== "startup.restore.borrow" ||
    !indexedSlot(restoreBorrow.instructions[0], "lda", C64_STARTUP_STATE_ID, 3) ||
    !indexedSlot(restoreBorrow.instructions[1], "sta", 0x0003) ||
    restoreBorrow.instructions[2]?.opcode !== "dex" ||
    restoreBorrow.terminator.kind !== "branch" ||
    restoreBorrow.terminator.opcode !== "bpl" ||
    restoreBorrow.terminator.target !== "startup.restore.borrow" ||
    restoreTailInstructions.map(({ opcode }) => opcode).join(",") !== "tsx,inx,lda,txs,pha,plp" ||
    !indexedSlot(restoreTailInstructions[2], "lda", 0x0100)
  )
    return null;
  const writesState = (instruction: MachineInstruction) =>
    instruction.memory.some(
      (effect) =>
        effect.kind === "write" &&
        effect.address.kind === "symbolic" &&
        effect.address.label === C64_STARTUP_STATE_ID,
    );
  const captures = new Set([...entry.instructions, ...capture.instructions].filter(writesState));
  for (const fn of [program.startup, ...program.functions])
    for (const block of fn.blocks)
      for (const instruction of block.instructions)
        if (writesState(instruction) && !captures.has(instruction)) return null;
  let quietY = true;
  for (const fn of [program.startup, ...program.functions])
    for (const block of fn.blocks) {
      let definedY = false;
      const trap =
        block.instructions.length === 1 &&
        block.instructions[0]?.opcode === "sei" &&
        block.terminator.kind === "jump" &&
        block.terminator.target === block.label;
      for (const item of block.instructions) {
        const decoded = nmosInstructionState(input.checked.profile.cpu, item.opcode, item.mode);
        if (decoded === null) return null;
        if (fn !== program.startup && decoded.usesRegisters.includes("y") && !definedY)
          quietY = false;
        definedY ||= decoded.definesRegisters.includes("y");
        if (fn === program.startup) {
          if (["brk", "rti"].includes(item.opcode)) return null;
          continue;
        }
        if (
          !trap &&
          item.opcode !== "jsr" &&
          (decoded.definesFlags.some((flag) => flag === "d" || flag === "i") ||
            decoded.usesRegisters.includes("s") ||
            decoded.definesRegisters.includes("s"))
        )
          return null;
        if (["php", "plp", "pha", "pla", "brk", "rti"].includes(item.opcode)) return null;
      }
    }
  return {
    quietY,
    range: { start: state.start, end: state.end },
    captures,
  };
}

/** Early status/register captures are immutable until their exact terminal restoration. */
function savedState(input: FinalObserverInput, view: Body["view"]) {
  const program = view.shared.layout.program;
  if (program.c64Startup?.displayIndependent === true) return compactSavedState(input, view);
  const entry = program.startup.blocks[0];
  const restore = program.startup.blocks.find((block) => block.label === "startup.restore");
  if (
    entry === undefined ||
    restore === undefined ||
    restore.terminator.kind !== "return" ||
    program.startup.blocks.length !== 2 ||
    program.c64Startup?.displayIndependent !== false ||
    program.c64Startup.initializerLabels.length !== 0
  )
    return null;
  const state = view.shared.layout.intervals.find((range) => range.id === C64_STARTUP_STATE_ID);
  if (state === undefined || state.end - state.start < 4) return null;
  const slot = (
    instruction: (typeof entry.instructions)[number] | undefined,
    opcode: string,
    offset: number,
  ) =>
    instruction?.opcode === opcode &&
    instruction.operand?.kind === "label" &&
    instruction.operand.label === C64_STARTUP_STATE_ID &&
    (instruction.operand.offset ?? 0) === offset &&
    instruction.operand.addressByte === undefined &&
    instruction.operand.transform === undefined;
  if (
    !slot(entry.instructions[0], "sta", 0) ||
    !slot(entry.instructions[1], "stx", 1) ||
    !slot(entry.instructions[2], "sty", 2) ||
    entry.instructions[3]?.opcode !== "php" ||
    entry.instructions[4]?.opcode !== "pla" ||
    !slot(entry.instructions[5], "sta", 3) ||
    entry.instructions[6]?.opcode !== "tsx" ||
    !slot(entry.instructions[7], "stx", 4) ||
    entry.instructions[8]?.opcode !== "cld"
  )
    return null;
  const tail = restore.instructions.slice(-8);
  if (
    !slot(tail[0], "ldx", 4) ||
    tail[1]?.opcode !== "txs" ||
    !slot(tail[2], "lda", 3) ||
    tail[3]?.opcode !== "pha" ||
    !slot(tail[4], "lda", 0) ||
    !slot(tail[5], "ldx", 1) ||
    !slot(tail[6], "ldy", 2) ||
    tail[7]?.opcode !== "plp"
  )
    return null;
  let quietY = true;
  for (const fn of [program.startup, ...program.functions])
    for (const block of fn.blocks) {
      let definedY = false;
      const trap =
        block.instructions.length === 1 &&
        block.instructions[0]?.opcode === "sei" &&
        block.terminator.kind === "jump" &&
        block.terminator.target === block.label;
      for (const [index, item] of block.instructions.entries()) {
        const decoded = nmosInstructionState(input.checked.profile.cpu, item.opcode, item.mode);
        if (decoded === null) return null;
        if (fn !== program.startup && decoded.usesRegisters.includes("y") && !definedY)
          quietY = false;
        definedY ||= decoded.definesRegisters.includes("y");
        if (
          decoded.usesFlags.includes("v") &&
          !(block === entry && index === 3 && item.opcode === "php")
        )
          return null;
        if (
          fn === program.startup &&
          ((item.opcode === "php" && !(block === entry && index === 3)) ||
            (item.opcode === "pla" && !(block === entry && index === 4)) ||
            (item.opcode === "pha" && !(block === restore && item === tail[3])) ||
            (item.opcode === "plp" && !(block === restore && item === tail[7])) ||
            ["brk", "rti"].includes(item.opcode))
        )
          return null;
        if (
          fn !== program.startup &&
          !trap &&
          item.opcode !== "jsr" &&
          (decoded.definesFlags.some((flag) => flag === "d" || flag === "i") ||
            decoded.usesRegisters.includes("s") ||
            decoded.definesRegisters.includes("s"))
        )
          return null;
        if (
          ["php", "plp", "pha", "pla", "brk", "rti"].includes(item.opcode) &&
          fn !== program.startup
        )
          return null;
      }
    }
  return {
    quietY,
    range: { start: state.start, end: state.start + 4 },
    captures: new Set(entry.instructions.filter((_, index) => [0, 1, 2, 5, 7].includes(index))),
  };
}

/**
 * Prove a first-test-elided counter is a bottom-tested backedge header: the loop
 * must run at least once, the preheader enters the body, the header is reachable
 * only from the update, and its `bcc` still selects body or exit.
 */
function bottomTested(elided: boolean | undefined, loop: FixedLoopFacts, after: Body): boolean {
  const entry = after.blocks.get(loop.preheader.id),
    header = after.blocks.get(loop.header.id),
    update = after.blocks.get(loop.update.id),
    exit = after.blocks.get(loop.exit.id);
  /** A forward edge may be emitted as a fallthrough once the layout proves adjacency. */
  const forward = (block: typeof entry, target: string): boolean =>
    block !== undefined &&
    (block.terminator.kind === "jump" || block.terminator.kind === "fallthrough") &&
    block.terminator.target === target;
  /** Resolve empty jump aliases to the block that actually owns the target. */
  const resolve = (label: string): string => {
    let current = label;
    const seen = new Set<string>();
    while (!seen.has(current)) {
      seen.add(current);
      const block = after.blocks.get(current);
      if (
        block === undefined ||
        block.instructions.length !== 0 ||
        (block.terminator.kind !== "jump" && block.terminator.kind !== "fallthrough")
      )
        break;
      current = block.terminator.target;
    }
    return current;
  };
  /** Either the canonical carry test or the bottom-tested equality test. */
  const testEdge = (block: typeof header) => {
    const edge = block?.terminator;
    if (edge?.kind !== "branch") return undefined;
    const uses =
      edge.opcode === "bcc"
        ? edge.uses.flags.length === 1 && edge.uses.flags[0] === "c"
        : edge.opcode === "bne" &&
          edge.uses.flags.length === 1 &&
          edge.uses.flags[0] === "z" &&
          edge.uses.registers.length === 0;
    return uses && edge.fallthrough === resolve(loop.exit.id) ? edge : undefined;
  };
  /** The body region must reach the update without passing through the header. */
  const bodyReachesUpdate = (() => {
    const pending = [loop.body.id];
    const seen = new Set<string>();
    while (pending.length > 0) {
      const label = pending.pop()!;
      if (label === loop.update.id) return true;
      if (label === loop.header.id || seen.has(label)) continue;
      seen.add(label);
      const block = after.blocks.get(label);
      if (block !== undefined) pending.push(...machineSuccessors(block));
    }
    return false;
  })();
  const checks = {
    elided: elided === true,
    minimum:
      loop.initial.kind === "constant"
        ? loop.initial.value < loop.bound
        : loop.initial.domain.maximum < loop.bound,
    entry: forward(entry, loop.body.id),
    header: testEdge(header)?.target === loop.body.id,
    body: bodyReachesUpdate,
    update: forward(update, loop.header.id),
    predecessors:
      exit !== undefined &&
      after.actual.blocks
        .filter((block) => machineSuccessors(block).includes(loop.header.id))
        .every((block) => block.label === loop.update.id),
  };
  return (
    checks.elided &&
    checks.minimum &&
    checks.entry &&
    checks.header &&
    checks.body &&
    checks.update &&
    checks.predecessors
  );
}

/**
 * Close the composed memory-counter class without widening the legacy five-role proof.
 * Source range values and machine changes remain distinct from atomic acceptance.
 * @param input One checked source and actual reference/selected construction pair.
 * @returns Null outside this class, a failed obligation, or jointly closed loop premises.
 * @example const composition = validateComposedLowByte(input);
 */
export function validateComposedLowByte(
  input: FinalObserverInput,
): LowByteComposition | ResidualFailure | null {
  const facts = input.candidate.lowered.program.storageSelection?.sourceFacts;
  if (
    (facts?.loopPolicy !== "low-byte" && facts?.loopPolicy !== "mixed") ||
    facts.nonLoopBundle !== "closed"
  )
    return null;
  const packets = [...facts.functions.values()].filter((packet) =>
    input.checked.program.reachableFunctions.includes(packet.function.id),
  );
  if (
    !packets.some(
      (packet) =>
        (packet.storage?.parameters.size ?? 0) > 0 &&
        packet.loops.some((loop) => loop.parent !== null),
    )
  )
    return null;
  const reject = (reason: string) => failure("rejected", reason);
  const program = input.checked.program;
  const sources = program.semantic.functions.filter((source) =>
    program.reachableFunctions.includes(source.id),
  );
  const aggregateProgram = (program.returnedLocalDestinations?.length ?? 0) > 0;
  const returnedLocals = new Set(
    (program.returnedLocalDestinations ?? []).map(
      ({ function: owner, local }) => `${bindingIdentityKey(owner)}\0${bindingIdentityKey(local)}`,
    ),
  );
  const aggregateReturn = (source: SemanticFunction): boolean =>
    (program.returnedLocalDestinations ?? []).some(
      (destination) => bindingIdentityKey(destination.function) === bindingIdentityKey(source.id),
    );
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
  if (
    input.reference.kind !== "feasible" ||
    facts.program !== program ||
    (!aggregateProgram && (program.interruptRoutes?.length ?? 0) > 0) ||
    program.roots.some(
      (root) =>
        root.kind === "callable" &&
        (!aggregateProgram || !asyncHandlers.has(bindingIdentityKey(root.function))),
    ) ||
    sources.some(
      (fn) =>
        (!aggregateProgram || !aggregateReturn(fn)) &&
        fn.blocks.some((block) =>
          block.operations.some(
            (op) =>
              op.kind === "indirect-call" ||
              (op.kind === "platform" && !vectorCapabilities.has(op.capability)) ||
              (op.kind === "place-address" &&
                (op.place.path.length !== 0 ||
                  !["array", "struct"].includes(op.type.kind) ||
                  (op.captureValue === true &&
                    !returnedLocals.has(
                      `${bindingIdentityKey(fn.id)}\0${bindingIdentityKey(op.place.root)}`,
                    )))),
          ),
        ),
    )
  )
    return reject("Composed counters require a synchronous closed source");
  const selected = input.candidate.lowered.program.functions.filter(
    (fn) =>
      fn.sourceFunction !== undefined &&
      fn.executionContext?.domain === "main" &&
      fn.executionContext.activationRoot === undefined,
  );
  const loops = new Set<FixedLoopFacts>(),
    functions = new Map<SemanticFunction, LowByteFunctionChanges>();
  const beforeView = side(
    input.reference.shared,
    input.reference.checked.lowered.program.functions,
  );
  const afterView = side(input.candidate.shared, input.candidate.lowered.program.functions);
  const owners = new Set<BindingId>(),
    pairs = new Map<SemanticFunction, readonly [Body, Body]>();
  for (const fn of selected) {
    const packet = packets.find((packet) => packet.function.id === fn.sourceFunction),
      source = packet?.function;
    if (
      packet === undefined ||
      source === undefined ||
      !program.semantic.functions.includes(source) ||
      owners.has(source.id)
    )
      return reject("Composed counter source owner is unresolved");
    if (typeBytes(source.result) > 1 && !aggregateReturn(source))
      return reject("Composed counter source owner is unresolved");
    const before = body(beforeView, source.id, source),
      after = body(afterView, source.id, source);
    if (before === null || after === null)
      return reject("Composed counter actual binding is unresolved");
    owners.add(source.id);
    pairs.set(source, [before, after]);
    const counters = new Map<BindingId, Counter>();
    for (const proof of fn.fixedCounterProofs ?? []) {
      const loop = proof.loop;
      const register =
        proof.representation === "x" || proof.representation === "y" ? proof.representation : null;
      if (
        !validFixedLoopFacts(loop) ||
        loop.program !== program ||
        loop.function !== source ||
        !packet.loops.includes(loop) ||
        loops.has(loop) ||
        proof.context !== fn.id ||
        (register === null
          ? proof.representation !== "low-byte" || proof.requestId === null
          : proof.requestId !== null) ||
        (proof.firstTestElided !== false && !bottomTested(proof.firstTestElided, loop, after)) ||
        proof.pendingObservers !== true ||
        ((proof.indexUses?.length ?? 0) !== 0 &&
          (register === null || proof.indexUses?.length !== 1)) ||
        loop.parameter ||
        loop.bound < 1 ||
        loop.bound > 8 ||
        loop.outsideAccesses.length !== 0 ||
        loop.initial.domain.minimum < 0 ||
        loop.initial.domain.maximum > loop.bound ||
        (loop.initial.kind === "constant" && loop.initial.value !== 0) ||
        source.blocks.some(
          (block) =>
            loop.members.has(block.id) && block.operations.some((op) => op.kind === "call"),
        )
      )
        return reject("Composed counter source/control premises disagree");
      const original = request(beforeView, proof.originalRequestId, 2, source.id),
        current = register === null ? request(afterView, proof.requestId!, 1, source.id) : null;
      if (
        original?.declared.storageClass !== "local" ||
        original.declared.binding !== loop.counter ||
        (register === null &&
          (current?.declared.storageClass !== "temporary" ||
            current.declared.binding !== null ||
            !occupied(current.declared, source))) ||
        afterView.requests.has(proof.originalRequestId) ||
        !occupied(original.declared, source)
      )
        return reject("Composed counter declarations or occupancy disagree");
      // A child loop's parent-derived initialization reads the parent counter
      // directly from its held register; that read belongs to the child's
      // control-premise proof, not to this loop's ordinary body reads.
      const parentInitialized = new Set(
        packet.loops
          .filter((child) => {
            const childProof = fn.fixedCounterProofs?.find((proof) => proof.loop === child);
            return (
              child !== loop &&
              child.initial.kind === "parent-next" &&
              child.initial.parent !== null &&
              bindingIdentityKey(child.initial.parent) === bindingIdentityKey(loop.counter) &&
              (childProof?.representation === "x" || childProof?.representation === "y")
            );
          })
          .flatMap((child) =>
            source.blocks.flatMap((block) =>
              block.operations.filter(
                (op) =>
                  op.kind === "load" &&
                  op.place.root === loop.counter &&
                  op.span.start >= child.initialization.span.start &&
                  op.span.end <= child.initialization.span.end,
              ),
            ),
          ),
      );
      const loads = new Set(
        source.blocks.flatMap((block) =>
          block.operations.filter(
            (op): op is LoadOperation =>
              op.kind === "load" &&
              op.place.root === loop.counter &&
              block !== loop.header &&
              block !== loop.update &&
              !parentInitialized.has(op),
          ),
        ),
      );
      if (
        proof.reads.length !== loads.size ||
        new Set(proof.reads.map((read) => read.value)).size !== loads.size ||
        proof.reads.some(
          (read) =>
            read.stagingRequestId !== null ||
            ![...loads].some((load) => load.result === read.value),
        ) ||
        [...loads].some((load) => load.place.path.length !== 0)
      )
        return reject("Composed source counter reads are not exhaustive");
      const labels = (pair: Body, sourceBlock: typeof loop.header) =>
        pair.symbolic.observerBlocks?.find(([block]) => block === sourceBlock)?.[1];
      for (const pair of [before, after]) {
        const header = labels(pair, loop.header),
          entry = labels(pair, loop.preheader),
          update = labels(pair, loop.update),
          start = labels(pair, loop.body),
          exit = labels(pair, loop.exit);
        const machineHeader = pair.symbolic.blocks.find((block) => block.label === header?.[0]);
        if (
          header?.length !== 1 ||
          entry?.length !== 1 ||
          update?.length !== 1 ||
          start?.[0] === undefined ||
          exit?.[0] === undefined ||
          !(
            machineHeader?.terminator.kind === "branch" &&
            machineHeader.terminator.target === start[0] &&
            machineHeader.terminator.fallthrough === exit[0] &&
            ((machineHeader.terminator.opcode === "bcc" &&
              JSON.stringify(machineHeader.terminator.uses) ===
                JSON.stringify({ registers: [], flags: ["c"] })) ||
              (machineHeader.terminator.opcode === "bne" &&
                pair === after &&
                proof.firstTestElided === true &&
                bottomTested(proof.firstTestElided, loop, after) &&
                JSON.stringify(machineHeader.terminator.uses) ===
                  JSON.stringify({ registers: [], flags: ["z"] })))
          )
        )
          return reject("Composed loop source control edges disagree");
        // A bottom-tested selected loop enters the body directly; its preheader
        // no longer reaches the comparison on the first pass. The update still
        // transfers to the header, and the reference keeps the canonical entry.
        const bottom =
          pair === after &&
          proof.firstTestElided === true &&
          bottomTested(proof.firstTestElided, loop, after);
        for (const [name, target] of [
          [entry[0]!, bottom ? start[0]! : header[0]!],
          [update[0]!, header[0]!],
        ] as const) {
          const terminal = pair.symbolic.blocks.find((block) => block.label === name)?.terminator;
          if (
            (terminal?.kind !== "jump" && terminal?.kind !== "fallthrough") ||
            terminal.target !== target
          )
            return reject("Composed loop initialization/update transfer disagrees");
        }
      }
      counters.set(loop.counter, { proof, original, selected: current, register, loads });
      loops.add(loop);
    }
    const changes = matchLowByteOccurrences(input, packet, before, after, counters);
    if (typeof changes === "string") return reject(changes);
    functions.set(source, changes);
  }
  const required = new Set(
    [...functions.keys()].flatMap((source) => {
      const packet = packets.find(
        (candidate) => bindingIdentityKey(candidate.function.id) === bindingIdentityKey(source.id),
      );
      return packet === undefined ? [] : [...packet.loops];
    }),
  );
  if (
    loops.size === 0 ||
    loops.size !== required.size ||
    [...required].some((loop) => !loops.has(loop))
  )
    return reject("Composed induction group is partial");
  for (const view of [beforeView, afterView])
    if (!entries(input, view, owners))
      return reject("Composed counter has an unrecorded code entry");
  const protectedRanges: StorageRange[] = [];
  for (const [source, changes] of functions) {
    for (const counter of changes.counters.values()) {
      protectedRanges.push({
        start: counter.original.home.address,
        end: counter.original.home.address + 1,
      });
      if (counter.selected !== null)
        protectedRanges.push({
          start: counter.selected.home.address,
          end: counter.selected.home.address,
        });
    }
    for (const demand of changes.removedDemands) {
      if (
        beforeView.requests.get(demand.id) !== demand ||
        afterView.requests.has(demand.id) ||
        demand.activationRoot !== undefined ||
        (demand.domain !== undefined && demand.domain !== "main") ||
        !beforeView.homes.has(demand.id)
      )
        return reject("Composed removed demand is not the exact original declaration");
    }
    for (const delegated of changes.delegated) {
      const route = packets.find((packet) => packet.function === delegated.route);
      const owner = input.candidate.lowered.program.functions.find(
        (fn) => fn.sourceFunction === delegated.route.id,
      );
      if (
        route === undefined ||
        (owner?.byteComplementProofs?.length ?? 0) === 0 ||
        !(
          route.function === source ||
          [...(route.storage?.parameters.values() ?? [])].some((parameter) =>
            parameter.calls.some((call) => call.owner === source.id),
          )
        )
      )
        return reject("Composed field consumer route is missing");
    }
  }
  const sites: RawSite[] = [];
  for (const source of sources) {
    const definitions = valueDefinitions(source.blocks),
      literal = literalResolver(definitions),
      ordinary = ordinalBoundResolver(definitions, literal);
    const values = new Map<string, bigint>();
    for (const loop of loops)
      if (loop.function === source)
        for (const [value, maximum] of loop.valueBounds) {
          const old = values.get(value);
          if (old === undefined || maximum < old) values.set(value, maximum);
        }
    for (const block of source.blocks)
      for (const operation of block.operations)
        if (operation.kind === "memory-read" || operation.kind === "memory-write") {
          if (operation.width !== 1)
            return reject("Composed raw word accesses retain their separate proof");
          const ranges = rawAccessFootprint(
            operation,
            definitions,
            literal,
            (value) => values.get(value) ?? ordinary(value),
          );
          if (
            ranges === null ||
            ranges.some(
              (range) =>
                overlaps(range, { start: 0x100, end: 0x1ff }) ||
                protectedRanges.some((counter) => overlaps(counter, range)),
            )
          )
            return reject("Composed raw access can observe or change counter/stack state");
          sites.push({ operation, owner: source.id, block, ranges });
        }
  }
  const fallbackStatus = Object.freeze({
    quietY: true,
    range: Object.freeze({ start: 0xffff, end: 0xffff }),
    captures: new Set<MachineInstruction>(),
  });
  for (const [index, view] of [beforeView, afterView].entries()) {
    const status = savedState(input, view) ?? fallbackStatus;
    if (sites.some((site) => site.ranges.some((range) => overlaps(range, status.range))))
      return reject("Composed saved status/root restoration is not closed");
    for (const [source, changes] of functions)
      for (const cut of changes.continuations) {
        const current = pairs.get(source)![index]!,
          actual = index === 0 ? cut.before : cut.after;
        const item = current.items.find((item) => item.key === actual.last.key);
        if (
          item === undefined ||
          item.block !== actual.last.block ||
          item.source !== actual.last.source ||
          item.instruction !== actual.last.instruction ||
          actual.start !== item.index + 1 ||
          !source.blocks.some((block) => block.operations.includes(cut.source))
        )
          return reject("Composed state cut is not an actual source occurrence");
        // Quiet Y requires a terminal cut: every successor/callee defines Y before
        // reading it, and the checked root restores its pre-execution saved value.
        const shared = (cut.changed & STATE.y) !== 0 && stateSafe(current, item);
        const quietY = status.quietY && actual.start === item.block.instructions.length;
        const mask =
          cut.changed & ~STATE.v & (shared ? ~(STATE.y | STATE.c) : quietY ? ~STATE.y : -1);
        // Y/C/V may be dead across proved calls; A/N/Z still need the direct window.
        const direct = mask & ~(STATE.y | STATE.c | STATE.v);
        const directSafe =
          direct === 0 ||
          byteContinuationQuery(current.blocks)(item.block.label, actual.start, direct);
        const sharedSafe = [STATE.y, STATE.c, STATE.v].every(
          (bit) => (mask & bit) === 0 || bitSafe(current, item.block.label, actual.start, bit),
        );
        if (!directSafe || !sharedSafe)
          return reject("Composed ordinary continuation state remains observable");
      }
    const checkedRaw = new Set<MachineInstruction>();
    const checked = checkLayout(
      input,
      view.shared,
      index === 0 ? input.reference.checked.lowered.program : input.candidate.lowered.program,
      sites,
      checkedRaw,
    );
    if (checked !== null) return checked;
    const composedKeys = new Set(
      [...functions.keys()].map((source) => bindingIdentityKey(source.id)),
    );
    const allBodies = sources
      .filter((source) => composedKeys.has(bindingIdentityKey(source.id)))
      .map((source) => ({
        source,
        current: body(view, source.id, source),
      }));
    const startup = view.shared.layout.program.startup;
    for (const block of startup.blocks)
      for (const [at, instruction] of block.instructions.entries()) {
        if (status.captures.has(instruction)) continue;
        const pc =
          block.origin! +
          block.instructions.slice(0, at).reduce((sum, item) => sum + item.cost.bytes, 0);
        const envelope = instructionAccessEnvelope({
          cpu: input.checked.profile.cpu,
          instruction,
          pc,
          labels: view.labels,
        });
        if (
          envelope?.some(
            (bus) =>
              bus.kind === "write" && bus.ranges.some((range) => overlaps(range, status.range)),
          )
        )
          return reject("Composed startup overwrites an early saved value");
      }
    for (const { source, current } of allBodies) {
      if (current === null) return reject("Composed reachable function binding is unresolved");
      const changes = functions.get(source);
      const aggregateSpans = new Set(
        source.blocks
          .flatMap((block) => block.operations)
          .filter((operation) => operation.kind === "aggregate")
          .map(
            (operation) =>
              `${operation.span.sourceId}\0${operation.span.start}\0${operation.span.end}`,
          ),
      );
      for (const item of current.items) {
        if (item.instruction.opcode === "jsr") continue;
        if (
          (item.source.source !== null &&
            aggregateSpans.has(
              `${item.source.source.sourceId}\0${item.source.source.start}\0${item.source.source.end}`,
            )) ||
          // Inside an aggregate-return function the status protocol owns the
          // stack-only php/sei/plp sequence; ordinary functions still reject a
          // source processor-state observation.
          (aggregateReturn(source) &&
            item.instruction.operand === null &&
            item.instruction.memory.length === 0)
        )
          continue;
        const access = (index === 0 ? changes?.accessesBefore : changes?.accessesAfter)?.find(
          (access) => access.item.key === item.key,
        );
        const pc = pcOf(input, item);
        if (pc === null) return reject("Composed instruction position is unresolved");
        const raw = item.source.observerOrigins?.find(
          (origin) =>
            origin.kind === "raw" && origin.recipe === "raw-indirect" && origin.byte !== null,
        );
        const site =
          raw?.kind === "raw" ? sites.find((site) => site.operation === raw.operation) : undefined;
        const rawIndex =
          raw?.kind === "raw" && raw.byte !== null ? { start: raw.byte, end: raw.byte } : undefined;
        const envelope = instructionAccessEnvelope({
          cpu: input.checked.profile.cpu,
          instruction: item.instruction,
          pc,
          labels: view.labels,
          ...(access?.index === undefined
            ? rawIndex === undefined
              ? {}
              : { index: rawIndex }
            : { index: access.index }),
          ...(access?.pointees === undefined
            ? site === undefined
              ? {}
              : { pointees: site.ranges }
            : { pointees: access.pointees }),
        });
        const typedSourceAccess = item.source.observerOrigins?.some(
          (origin) => origin.kind === "typed",
        );
        if (
          (envelope === null && !(typedSourceAccess === true && access === undefined)) ||
          (envelope !== null &&
            access !== undefined &&
            (access.item.instruction !== item.instruction ||
              JSON.stringify(envelope) !== JSON.stringify(access.envelope)))
        ) {
          return reject("Composed access envelope is incomplete");
        }
        if (envelope === null) continue;
        for (const bus of envelope.filter((access) => access.kind === "write"))
          for (const range of bus.ranges) {
            if (overlaps(range, status.range))
              return reject("Composed code can overwrite saved status/registers");
            for (const counter of changes?.counters.values() ?? []) {
              const home = index === 0 ? counter.original.home : counter.selected?.home;
              if (
                home === undefined ||
                !overlaps(range, { start: home.address, end: home.address + home.bytes - 1 })
              )
                continue;
              const selectedId =
                index === 0 ? counter.original.declared.id : counter.selected?.declared.id;
              const operand = item.source.operand;
              if (
                selectedId === undefined ||
                bus.role !== "data" ||
                operand?.kind !== "storage" ||
                operand.requestId !== selectedId ||
                ![
                  counter.proof.loop.initialization.span,
                  counter.proof.loop.updateStore.span,
                ].includes(item.source.source!) ||
                changes === undefined ||
                !(index === 0
                  ? changes.removed.has(item.key) || changes.replacements.has(item.key)
                  : [...changes.replacements.values()].includes(item.key))
              )
                return reject("Composed counter has an independent physical writer");
            }
          }
      }
    }
  }
  return { loops, functions };
}
