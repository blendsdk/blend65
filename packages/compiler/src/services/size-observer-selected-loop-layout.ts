import { C64_STARTUP_STATE_ID } from "../layout/startup.js";
import { machineInstruction, bindingLabel } from "../machine/lower-control.js";
import { instructionAccessEnvelope } from "../machine/nmos6510-access.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import type { StorageRange } from "../storage/storage-types.js";
import type { FinalObserverInput } from "./size-observers.js";
import type { registerCounterIndex } from "./size-observer-register-counter.js";

/** Only the exact store factor supplies pointer and source-index facts; it allocates nothing. */
type IndexAccess = NonNullable<ReturnType<typeof registerCounterIndex>>;

/** Inclusive CPU-visible RAM; the stack, ports, ROM and devices are not private storage. */
function ram(range: StorageRange): boolean {
  return (
    Number.isSafeInteger(range.start) &&
    Number.isSafeInteger(range.end) &&
    range.start <= range.end &&
    ((range.start >= 2 && range.end <= 255) || (range.start >= 512 && range.end <= 0xcfff))
  );
}

/**
 * Distinguish occurrences even when immutable instruction objects are reused.
 * @param fn Actual owning function identity.
 * @param block Actual owning block label.
 * @param index Instruction ordinal within that block.
 * @returns An unambiguous function/block/index coordinate.
 * @example siteKey(fn.id, block.label, 0)
 */
export const siteKey = (fn: string, block: string, index: number) =>
  JSON.stringify([fn, block, index]);

/**
 * Index one actual construction; never infer reference addresses from its candidate.
 * @param shared Actual successful shared closure and final layout.
 * @param lowered Symbolic producer belonging to that closure.
 * @returns Layout-local labels, declared homes and exhaustive symbolic use coordinates.
 * @example const before = view(reference.shared, reference.checked.lowered);
 */
export function view(
  shared: FinalObserverInput["candidate"]["shared"],
  lowered: FinalObserverInput["candidate"]["lowered"],
) {
  const program = shared.layout.program;
  const labels = new Map(shared.layout.intervals.map(({ id, start }) => [id, start]));
  const references = new Map<string, { site: string; offset: number; memory: boolean }[]>();
  for (const fn of [program.startup, ...program.functions]) {
    labels.set(fn.id, fn.origin ?? fn.blocks[0]?.origin ?? -1);
    for (const block of fn.blocks) labels.set(block.label, block.origin ?? -1);
  }
  for (const fn of [lowered.program.startup, ...lowered.program.functions])
    for (const block of fn.blocks)
      for (const [index, instruction] of block.instructions.entries()) {
        const addresses = [
          instruction.operand,
          ...instruction.memory.map(({ address }) => address),
        ];
        for (const [which, address] of addresses.entries())
          if (address?.kind === "storage" || address?.kind === "indirect-y") {
            const uses = references.get(address.requestId) ?? [];
            uses.push({
              site: siteKey(fn.id, block.label, index),
              offset: address.offset ?? 0,
              memory: which !== 0,
            });
            references.set(address.requestId, uses);
          }
      }
  return {
    shared,
    lowered,
    program,
    labels,
    references,
    requests: new Map(
      shared.certificate.inventory.requests.map((request) => [request.id, request]),
    ),
    homes: new Map(shared.certificate.certificate.homes.map((home) => [home.requestId, home])),
  };
}
/** Layout-local indexes retain their construction's exact inventory and producer. */
export type View = ReturnType<typeof view>;

/**
 * Resolve only a five-role bijection, rejecting split, shared or aliased topology.
 * @param current Independently closed layout indexes.
 * @param loop Exact checked source loop.
 * @param counter This construction's memory-counter request, or null for a held register.
 * @param firstTestElided Whether the proved positive register loop enters its body directly.
 * @returns Actual/symbolic role correspondence, or null for unsupported topology.
 * @example const original = side(before, loop, proof.originalRequestId);
 */
export function side(
  current: View,
  loop: FixedLoopFacts,
  counter: string | null,
  firstTestElided = false,
) {
  if ((counter === null) !== firstTestElided) return null;
  const owner = loop.function.id;
  const symbolic = current.lowered.program.functions.filter((fn) => fn.sourceFunction === owner);
  const physical = current.program.functions.filter((fn) => fn.sourceFunction === owner);
  if (symbolic.length !== 1 || physical.length !== 1) return null;
  const source = symbolic[0]!,
    actual = physical[0]!;
  const roles = [loop.preheader, loop.header, loop.body, loop.update, loop.exit];
  const mapping = new Map(actual.observerBlocks);
  if (
    mapping.size !== 5 ||
    actual.observerBlocks?.length !== 5 ||
    source.id !== actual.id ||
    [source, actual].some(
      (fn) =>
        fn.blocks.length !== 5 ||
        fn.observerBodies !== undefined ||
        fn.executionContext?.domain !== "main" ||
        fn.executionContext.activationRoot !== undefined ||
        fn.blocks.some((block) => block.observerBodies !== undefined),
    )
  )
    return null;
  const blocks = roles.map((role) => {
    const names = mapping.get(role);
    return names?.length === 1
      ? actual.blocks.find((block) => block.label === names[0])
      : undefined;
  });
  if (blocks.some((block) => block === undefined)) return null;
  const ordered = blocks.filter((block) => block !== undefined);
  const originals = ordered.map((block) =>
    source.blocks.find(({ label }) => label === block.label),
  );
  if (
    new Set(ordered).size !== 5 ||
    originals.some((block) => block === undefined) ||
    actual.blocks[0] !== ordered[0] ||
    ordered.some((block) => block.origin === undefined)
  )
    return null;
  const symbols = originals.filter((block) => block !== undefined);
  const sourceMap = new Map(source.observerBlocks);
  if (
    sourceMap.size !== 5 ||
    roles.some(
      (role, index) =>
        sourceMap.get(role)?.length !== 1 || sourceMap.get(role)?.[0] !== ordered[index]!.label,
    )
  )
    return null;
  const jump = (index: number, target: number) => {
    const block = ordered[index]!,
      original = symbols[index]!.terminator,
      edge = block.terminator;
    return (
      (original.kind === "jump" || original.kind === "fallthrough") &&
      original.target === ordered[target]!.label &&
      (edge.kind === "jump" || edge.kind === "fallthrough") &&
      edge.target === ordered[target]!.label &&
      (edge.kind !== "fallthrough" ||
        block.origin! + block.instructions.reduce((n, item) => n + item.cost.bytes, 0) ===
          ordered[target]!.origin)
    );
  };
  const test = ordered[1]!.terminator,
    originalTest = symbols[1]!.terminator;
  if (
    !jump(0, firstTestElided ? 2 : 1) ||
    !jump(2, 3) ||
    !jump(3, 1) ||
    ordered[4]!.instructions.length !== 0 ||
    ordered[4]!.terminator.kind !== "return" ||
    symbols[4]!.terminator.kind !== "return" ||
    [test, originalTest].some(
      (edge) =>
        edge.kind !== "branch" ||
        edge.opcode !== "bcc" ||
        edge.target !== ordered[2]!.label ||
        edge.fallthrough !== ordered[4]!.label ||
        edge.uses.flags.length !== 1 ||
        edge.uses.flags[0] !== "c",
    ) ||
    test.kind !== "branch" ||
    test.cost.bytes !== 2 ||
    ordered[1]!.origin! +
      ordered[1]!.instructions.reduce((n, item) => n + item.cost.bytes, 0) +
      2 !==
      ordered[4]!.origin ||
    current.labels.get(actual.id) !== ordered[0]!.origin ||
    ordered[2]!.origin! - ordered[4]!.origin! < -128 ||
    ordered[2]!.origin! - ordered[4]!.origin! > 127
  )
    return null;
  return { ...current, source, actual, blocks: ordered, symbols, counter };
}
/** A supported owner's five actual roles and independently bound symbolic instructions. */
export type Side = NonNullable<ReturnType<typeof side>>;

/** Actual target binding must agree before its source association or CPU effects are used. */
function bound(
  input: FinalObserverInput,
  current: Side,
  role: number,
  ordinal: number,
  index?: IndexAccess,
): boolean {
  const source = current.symbols[role]!.instructions[ordinal],
    actual = current.blocks[role]!.instructions[ordinal];
  if (
    source === undefined ||
    actual === undefined ||
    source.memory.length !== 0 ||
    actual.memory.length !== 0 ||
    source.opcode !== actual.opcode ||
    source.source !== actual.source ||
    source.sourceIteration !== undefined ||
    actual.sourceIteration !== undefined
  )
    return false;
  let expected = source.operand,
    mode = source.mode;
  if (expected?.kind === "storage" || expected?.kind === "indirect-y") {
    const home = current.homes.get(expected.requestId),
      request = current.requests.get(expected.requestId);
    const offset = expected.offset ?? 0;
    if (
      home === undefined ||
      request === undefined ||
      home.bytes !== request.bytes ||
      (expected.kind === "storage" && expected.addressByte !== undefined) ||
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset >= home.bytes ||
      request.owner !== current.actual.sourceFunction ||
      (expected.kind === "indirect-y"
        ? index?.pointer !== expected.requestId ||
          offset !== 0 ||
          home.bytes !== 2 ||
          home.region !== "zero-page" ||
          home.address >= 255 ||
          mode !== "indirect-indexed-y"
        : mode !== "storage" && mode !== "absolute")
    )
      return false;
    expected = { kind: "absolute", value: home.address + offset };
    if (mode !== "indirect-indexed-y")
      mode = home.region === "zero-page" ? "zero-page" : "absolute";
  } else if (expected?.kind === "label") {
    const label = expected.label;
    const object = current.program.data.find(({ id }) => id === label);
    const interval = current.shared.layout.intervals.find(({ id }) => id === label);
    const offset = expected.offset ?? 0;
    if (
      object === undefined ||
      interval === undefined ||
      interval.kind !== object.kind ||
      interval.end - interval.start + 1 !== object.bytes.length ||
      !ram(interval) ||
      !["global", "bss", "immutable"].includes(object.kind) ||
      object.id === C64_STARTUP_STATE_ID ||
      (expected.addressByte !== undefined &&
        !(
          index !== undefined &&
          label === bindingLabel("global", index.root) &&
          offset === 0 &&
          mode === "immediate"
        )) ||
      expected.transform !== undefined ||
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset >= object.bytes.length ||
      (!["absolute", "zero-page"].includes(mode) &&
        !(
          index !== undefined &&
          label === bindingLabel("global", index.root) &&
          (expected.addressByte !== undefined
            ? mode === "immediate"
            : role === 2 &&
              source.opcode === "sta" &&
              offset === index.offset &&
              ["absolute-x", "absolute-y"].includes(mode))
        ))
    )
      return false;
  } else if (expected !== null && expected.kind !== "immediate") return false;
  if (mode !== actual.mode || JSON.stringify(expected) !== JSON.stringify(actual.operand))
    return false;
  const cpu = machineInstruction(
    input.checked.profile.cpu,
    actual.opcode,
    actual.mode,
    actual.operand,
    [],
    actual.source,
  );
  return (
    JSON.stringify([actual.uses, actual.defines, actual.cost]) ===
    JSON.stringify([cpu.uses, cpu.defines, cpu.cost])
  );
}

/**
 * Decode all real accesses, including typed operations and both INC writes.
 * @param input Actual selected processor and original source context.
 * @param current One independently resolved owner and layout.
 * @param scratch Actual reference update temporary, absent on the selected side.
 * @param index Exact store facts; reference pointer and Y displacement stay separate.
 * @returns Whether binding and every affected physical access are proved.
 * @example const valid = physical(input, before, scratch);
 */
export function physical(
  input: FinalObserverInput,
  current: Side,
  scratch: string | null,
  index?: IndexAccess,
): boolean {
  const target =
    index === undefined
      ? undefined
      : current.shared.layout.intervals.find(({ id }) => id === bindingLabel("global", index.root));
  if (
    index !== undefined &&
    (target === undefined ||
      !ram(target) ||
      !Number.isSafeInteger(index.offset) ||
      !Number.isSafeInteger(index.maximum) ||
      index.offset < 0 ||
      index.offset > 255 ||
      index.maximum < 0 ||
      index.maximum > 7 ||
      target.start + index.offset + index.maximum > target.end)
  )
    return false;
  // Calls balance S through the existing ABI; other ordinary instructions may
  // not establish an unproved stack or decimal/interrupt-state boundary.
  for (const fn of current.program.functions)
    for (const block of fn.blocks) {
      for (const item of block.instructions) {
        if (item.opcode === "jsr") continue;
        const cpu = machineInstruction(
          input.checked.profile.cpu,
          item.opcode,
          item.mode,
          item.operand,
          item.memory,
          item.source,
        );
        if (
          item.uses.registers.includes("s") ||
          item.defines.registers.includes("s") ||
          item.defines.flags.some((flag) => flag === "d" || flag === "i") ||
          JSON.stringify([item.uses, item.defines]) !== JSON.stringify([cpu.uses, cpu.defines])
        )
          return false;
      }
      const edge = block.terminator;
      if (edge.kind === "branch" || edge.kind === "long-branch") {
        const cpu = machineInstruction(input.checked.profile.cpu, edge.opcode, "relative", null);
        if (JSON.stringify(edge.uses) !== JSON.stringify(cpu.uses)) return false;
      }
    }
  const owned = [...current.requests.values()].filter(
    ({ owner }) => owner === current.actual.sourceFunction,
  );
  const homes = owned.flatMap((request) => {
    const home = current.homes.get(request.id);
    return home === undefined
      ? []
      : [{ request, home, start: home.address, end: home.address + home.bytes - 1 }];
  });
  if (
    homes.length !== owned.length ||
    homes.some(
      ({ request, home, start, end }) =>
        home.bytes !== request.bytes ||
        !Number.isSafeInteger(home.bytes) ||
        home.bytes <= 0 ||
        !ram({ start, end }) ||
        current.shared.layout.intervals.some(
          (interval) =>
            interval.kind !== "sfa" &&
            interval.start <= interval.end &&
            start <= interval.end &&
            end >= interval.start,
        ),
    )
  )
    return false;
  for (const [role, block] of current.blocks.entries()) {
    if (current.symbols[role]!.instructions.length !== block.instructions.length) return false;
    let pc = block.origin!;
    for (const [ordinal, item] of block.instructions.entries()) {
      if (
        !bound(input, current, role, ordinal, index) ||
        item.uses.registers.includes("s") ||
        item.defines.registers.includes("s") ||
        item.defines.flags.some((flag) => flag === "d" || flag === "i")
      )
        return false;
      const store =
        index !== undefined &&
        target !== undefined &&
        role === 2 &&
        ordinal + 1 === block.instructions.length;
      const accesses = instructionAccessEnvelope({
        cpu: input.checked.profile.cpu,
        instruction: item,
        pc,
        labels: current.labels,
        ...(store
          ? item.mode === "indirect-indexed-y"
            ? {
                index: { start: index.offset, end: index.offset },
                pointees: [{ start: target.start, end: target.start + index.maximum }],
              }
            : { index: { start: 0, end: index.maximum } }
          : {}),
      });
      if (
        accesses === null ||
        accesses.some((access) => access.ranges.some((range) => !ram(range)))
      )
        return false;
      for (const access of accesses) {
        if (access.role === "fetch") continue;
        for (const { request, home } of homes) {
          const id = request.id;
          for (const range of access.ranges) {
            if (range.start >= home.address + home.bytes || range.end < home.address) continue;
            const operand = current.symbols[role]!.instructions[ordinal]!.operand;
            if (
              store &&
              id === index.pointer &&
              access.role === "pointer" &&
              operand?.kind === "indirect-y" &&
              operand.requestId === id &&
              range.start === range.end &&
              range.start >= home.address &&
              range.end < home.address + 2
            )
              continue;
            if (
              operand?.kind !== "storage" ||
              operand.requestId !== id ||
              range.start !== range.end ||
              operand.addressByte !== undefined ||
              range.start !== home.address + (operand.offset ?? 0) ||
              (id === current.counter && access.kind === "write" && role !== 0 && role !== 3) ||
              (id === scratch && role !== 3)
            )
              return false;
          }
        }
      }
      pc += item.cost.bytes;
    }
  }
  return true;
}
