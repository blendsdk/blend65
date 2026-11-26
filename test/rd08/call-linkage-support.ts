/**
 * Read how emitted routines are linked to each other: the calls they make,
 * every way control leaves them, and the final address control lands on.
 *
 * A call in tail position may become a jump, or vanish when the callee is
 * placed directly after its caller. A forwarding routine can then hold no
 * instructions of its own, its entry sharing an address with what follows it.
 * This reader accepts such an empty routine, resolves every exit to a final
 * address instead of a label spelling, and reports what is placed next, so
 * that falling into another routine is as visible as jumping to it.
 */
import { expect } from "vitest";
import { cost, decodeLine, labelAddresses, readMnemonics } from "./emitted-routine-support.js";
import type { Artifacts, Decoded, Instruction } from "./emitted-routine-support.js";
import { evaluate } from "./word-update-support.js";
import type { RoutineView } from "./word-update-support.js";

/** One emitted routine with its resolved entry and the address placed after it. */
export interface LinkedRoutine extends RoutineView {
  /** Source function name inside the `Game` module, or the emitted name of a handler route. */
  readonly name: string;
  /** Final address of the routine's entry. */
  readonly entry: number;
  /**
   * Final address of the first thing placed after the routine, or nothing when
   * that is not a label or origin directive whose address the text states.
   */
  readonly following: number | undefined;
  /** Emitted line that decided `following`, kept for failure messages. */
  readonly followingText: string;
}

/** The ways control can leave a routine. */
export type ExitKind = "return" | "indirect" | "transfer" | "fallthrough";

/** One way control leaves a routine, resolved to a final address where one exists. */
export interface Exit {
  readonly kind: ExitKind;
  /** Position of the leaving instruction; a fall-through sits one past the last instruction. */
  readonly position: number;
  /** Final destination; absent for returns, indirect jumps and an unresolved fall-through. */
  readonly address: number | undefined;
  /** Whether the exit is a branch, so control may also stay inside the routine. */
  readonly conditional: boolean;
  /** Emitted text responsible for the exit. */
  readonly text: string;
}

/** How one routine region is announced and how its own labels are spelled. */
interface RegionNaming {
  /** Name reported for the routine. */
  readonly name: string;
  /** Exact section marker line that opens the region. */
  readonly marker: string;
  /** Prefix shared by every label the routine owns. */
  readonly stem: string;
}

/** Emitted section markers that bound the region a routine can occupy. */
const sectionMarker = /^\s*;\s*(?:routine|bss|data|segment|startup)\b/gmu;

/** Section markers of routines specialized for an interrupt installation route. */
const interruptMarker = /^\s*;\s*routine\s+"(interrupt_[^"]*)"/gmu;

/** Assembler directive that states the address of whatever follows it. */
const originDirective = /^\*\s*=\s*\$([0-9a-f]+)/iu;

/** Instructions that read a memory operand, including read-modify-write forms. */
const memoryReaders = new Set([...readMnemonics, "inc", "dec", "asl", "lsr", "rol", "ror"]);

/** Strip a trailing comment and surrounding space from one emitted line. */
function code(line: string): string {
  return line.replace(/;.*$/u, "").trim();
}

/** Label defined by a line written as `name:`, with or without an instruction after it. */
function colonLabel(line: string): string | undefined {
  const match = /^([A-Za-z_][\w.]*):(?:\s|$)/u.exec(code(line));
  return match === null ? undefined : match[1]!;
}

/** Label a line defines, also accepting a known label written alone on its line. */
function definedLabel(line: string, labels: Map<string, number>): string | undefined {
  const text = code(line);
  return colonLabel(text) ?? (labels.has(text) ? text : undefined);
}

/**
 * Address of the first thing placed in a run of emitted lines.
 *
 * Blank and comment lines, including the next routine's section marker, are
 * skipped. A label or origin directive states an address. Anything else, such
 * as an instruction or a data directive, leaves the address unknown, and it is
 * reported that way rather than guessed.
 */
function placedNext(
  lines: readonly string[],
  labels: Map<string, number>,
): { address: number | undefined; text: string } {
  for (const line of lines) {
    const text = code(line);
    if (text.length === 0) continue;
    const origin = originDirective.exec(text);
    if (origin !== null) return { address: Number.parseInt(origin[1]!, 16), text: line };
    const label = definedLabel(text, labels);
    return { address: label === undefined ? undefined : labels.get(label), text: line };
  }
  return { address: undefined, text: "<end of assembly>" };
}

/**
 * Decode one routine region, even when it holds no instructions.
 *
 * The region starts at its section marker and ends at the next section marker
 * or the first label the routine does not own. The entry is the first label in
 * that region. A region without its own label falls back to the lowest label
 * the routine owns.
 */
function readRoutine(artifacts: Artifacts, naming: RegionNaming): LinkedRoutine {
  const { name, marker, stem } = naming;
  const labels = labelAddresses(artifacts.labels);
  const start = artifacts.assembly.indexOf(marker);
  expect(start, `public assembly contains ${marker}`).toBeGreaterThanOrEqual(0);
  if (start < 0) throw new Error(`Missing emitted routine: ${marker}`);

  const rest = artifacts.assembly.slice(start);
  const nextSection = [...rest.matchAll(sectionMarker)]
    .map((match) => match.index)
    .find((index) => index > 0);
  const section = rest.slice(0, nextSection).split("\n");
  const foreign = section.findIndex((line) => {
    const label = colonLabel(line);
    return label !== undefined && !label.startsWith(stem);
  });
  const lines = foreign < 0 ? section : section.slice(0, foreign);

  const decoded: Decoded[] = [];
  let placed: number | undefined;
  for (const [lineIndex, line] of lines.entries()) {
    const origin = originDirective.exec(code(line));
    if (origin !== null) {
      placed = Number.parseInt(origin[1]!, 16);
      continue;
    }
    const instruction = decodeLine(line, labels);
    if (instruction === undefined) continue;
    decoded.push({ lineIndex, instruction, address: placed });
    placed = undefined;
  }

  const named = lines
    .map((line) => definedLabel(line, labels))
    .find((label) => label !== undefined);
  const owned = [...labels]
    .filter(([label]) => label.startsWith(stem))
    .map(([, address]) => address);
  const entry =
    (named === undefined ? undefined : labels.get(named)) ??
    (owned.length === 0 ? undefined : Math.min(...owned));
  expect(entry, `entry address of ${name}:\n${lines.join("\n")}`).toBeDefined();
  if (entry === undefined) throw new Error(`Missing the entry of ${name}`);

  const next = placedNext(rest.split("\n").slice(lines.length), labels);
  return {
    name,
    lines,
    decoded,
    labels,
    stem,
    entry,
    following: next.address,
    followingText: next.text,
  };
}

/**
 * Decode one source function's emitted routine, even when it holds no instructions.
 *
 * @example
 *   const touch = linkedRoutine(artifacts, "touch");
 */
export function linkedRoutine(artifacts: Artifacts, name: string): LinkedRoutine {
  return readRoutine(artifacts, {
    name,
    marker: `; routine "Game.${name}"`,
    stem: `b65_Game_${name}_`,
  });
}

/**
 * Decode the program's one interrupt handler routine.
 *
 * A handler is not emitted under its source name. Each installation route
 * gets its own specialized routine, named after the handler's source location
 * and that route, with labels spelled after that routine name. The witness
 * installs exactly one handler through exactly one route, so exactly one such
 * routine must exist; any other count fails rather than picking one.
 *
 * @example
 *   const handler = interruptRoutine(artifacts);
 */
export function interruptRoutine(artifacts: Artifacts): LinkedRoutine {
  const names = [
    ...new Set([...artifacts.assembly.matchAll(interruptMarker)].map((match) => match[1]!)),
  ];
  expect(names, "exactly one emitted interrupt handler routine").toHaveLength(1);
  const name = names[0];
  if (name === undefined) throw new Error("Missing the emitted interrupt handler routine");
  return readRoutine(artifacts, { name, marker: `; routine "${name}"`, stem: `b65_${name}` });
}

/** Whether a branch or jump target names a place inside the routine itself. */
function isInternal(routine: RoutineView, target: string): boolean {
  if (/^[+-]+$/u.test(target)) return true;
  return routine.lines.some((line) => {
    const text = code(line);
    return text === target || text.startsWith(`${target}:`);
  });
}

/** Final address of a transfer leaving the routine, or nothing when it stays inside. */
function externalDestination(routine: RoutineView, instruction: Instruction): number | undefined {
  const target = instruction.target;
  if (target === undefined) throw new Error(`Transfer without a target: ${instruction.text}`);
  if (isInternal(routine, target)) return undefined;
  const address = decodeLine(`jmp ${target}`, routine.labels)?.address;
  if (address === undefined) throw new Error(`Unresolved transfer target: ${instruction.text}`);
  return address;
}

/**
 * Every way control leaves a routine.
 *
 * A return, an indirect jump and a jump or branch to a place outside the
 * routine each count as an exit. So does reaching the end without an
 * unconditional transfer: control then falls into whatever is placed next.
 * Calls are not exits because they come back.
 */
export function exits(routine: LinkedRoutine): Exit[] {
  const result: Exit[] = [];
  routine.decoded.forEach(({ instruction }, position) => {
    const { mnemonic, text } = instruction;
    if (mnemonic === "rts" || mnemonic === "rti") {
      result.push({ kind: "return", position, address: undefined, conditional: false, text });
      return;
    }
    if (mnemonic !== "jmp" && instruction.mode !== "relative") return;
    if (instruction.mode === "other") {
      result.push({ kind: "indirect", position, address: undefined, conditional: false, text });
      return;
    }
    const address = externalDestination(routine, instruction);
    if (address === undefined) return;
    result.push({ kind: "transfer", position, address, conditional: mnemonic !== "jmp", text });
  });
  const last = routine.decoded.at(-1)?.instruction;
  if (last === undefined || !["jmp", "rts", "rti"].includes(last.mnemonic))
    result.push({
      kind: "fallthrough",
      position: routine.decoded.length,
      address: routine.following,
      conditional: false,
      text: `falls into: ${routine.followingText}`,
    });
  return result;
}

/** Calls the routine makes, optionally only those reaching one final address. */
export function calls(routine: RoutineView, address?: number): Decoded[] {
  return routine.decoded.filter(
    ({ instruction }) =>
      instruction.mnemonic === "jsr" && (address === undefined || instruction.address === address),
  );
}

/** Text of every call that is immediately followed by the routine's own return. */
export function callReturnPairs(routine: RoutineView): string[] {
  return routine.decoded.flatMap(({ instruction }, position) =>
    instruction.mnemonic === "jsr" && routine.decoded[position + 1]?.instruction.mnemonic === "rts"
      ? [instruction.text]
      : [],
  );
}

/** Encoded bytes the routine spends on leaving: returns and outgoing transfers. */
export function exitBytes(routine: LinkedRoutine): number {
  return exits(routine).reduce(
    (total, exit) =>
      exit.kind === "fallthrough"
        ? total
        : total + cost(routine.decoded[exit.position]!.instruction).bytes,
    0,
  );
}

/** Final address of a label in the routine's own build, required to exist. */
export function labelAddress(routine: RoutineView, label: string): number {
  const address = routine.labels.get(label);
  expect(address, `final address of ${label}`).toBeDefined();
  if (address === undefined) throw new Error(`Missing label ${label}`);
  return address;
}

/**
 * Require a routine whose only call is in tail position to leave through its callee.
 *
 * No call and no return remains. Every exit lands on one destination: the
 * callee, either by an unconditional transfer or by falling into it. A transfer
 * to the very next address is not emitted, because falling through does the
 * same thing for nothing. The exits together cost at most one jump.
 *
 * @returns The single destination every exit reaches.
 * @example
 *   expectLeavesThrough(touch, child.entry);
 */
export function expectLeavesThrough(caller: LinkedRoutine, callee: number | undefined): number {
  const shown = caller.lines.join("\n");
  expect(
    calls(caller).map(({ instruction }) => instruction.text),
    `no call remains in ${caller.name}:\n${shown}`,
  ).toEqual([]);
  const leaving = exits(caller);
  expect(
    leaving
      .filter((exit) => exit.kind === "return" || exit.kind === "indirect")
      .map((exit) => exit.text),
    `${caller.name} does not return by itself:\n${shown}`,
  ).toEqual([]);
  const destinations = [...new Set(leaving.map((exit) => exit.address))];
  expect(
    destinations,
    `${caller.name} leaves through exactly one destination:\n${shown}`,
  ).toHaveLength(1);
  const destination = destinations[0];
  expect(destination, `resolved destination of ${caller.name}:\n${shown}`).toBeDefined();
  if (destination === undefined) throw new Error(`Unresolved destination of ${caller.name}`);
  if (callee !== undefined)
    expect(destination, `${caller.name} leaves through its callee`).toBe(callee);
  const final = leaving.find(
    (exit) =>
      exit.kind === "transfer" && !exit.conditional && exit.position === caller.decoded.length - 1,
  );
  if (final !== undefined)
    expect(final.address, `a transfer to the next address is omitted:\n${shown}`).not.toBe(
      caller.following,
    );
  expect(
    exitBytes(caller),
    `${caller.name} spends at most one jump on leaving:\n${shown}`,
  ).toBeLessThanOrEqual(3);
  return destination;
}

/**
 * Require control entering `start` to reach the restoration without returning.
 *
 * The program entry has no caller to return to; its continuation is the
 * startup restoration. Every exit of `start` must therefore land on the
 * restoration or on the entry of one of `routines`, which is held to the same
 * rule in turn. Calls made along the way come back and are not followed.
 *
 * @returns Names of every routine control continues through, `start` included.
 */
export function expectContinuation(
  start: LinkedRoutine,
  restoration: number,
  routines: readonly LinkedRoutine[],
): Set<string> {
  const visited = new Set<string>();
  const pending: LinkedRoutine[] = [start];
  while (pending.length > 0) {
    const routine = pending.pop()!;
    if (visited.has(routine.name)) continue;
    visited.add(routine.name);
    const shown = routine.lines.join("\n");
    for (const exit of exits(routine)) {
      expect(
        exit.kind === "return" || exit.kind === "indirect",
        `${routine.name} leaves by ${exit.text} instead of continuing to the restoration:\n${shown}`,
      ).toBe(false);
      const address = exit.address;
      expect(
        address,
        `resolved continuation of ${routine.name} after ${exit.text}:\n${shown}`,
      ).toBeDefined();
      if (address === undefined || address === restoration) continue;
      const next =
        routines.find((candidate) => candidate.entry === address && !visited.has(candidate.name)) ??
        routines.find((candidate) => candidate.entry === address);
      expect(
        next?.name,
        `${routine.name} continues at $${address.toString(16)}, which is neither the restoration nor a permitted routine:\n${shown}`,
      ).toBeDefined();
      if (next !== undefined) pending.push(next);
    }
  }
  return visited;
}

/**
 * Label of the startup restoration, read from the reference build's entry function.
 *
 * Unoptimized lowering ends the entry function with an unconditional jump to
 * the restoration. That label is then looked up in an optimized build of the
 * same program, whose entry function may no longer name it.
 */
export function restorationLabel(reference: Artifacts): string {
  const main = linkedRoutine(reference, "main");
  const shown = main.lines.join("\n");
  const final = exits(main).find((exit) => exit.position === main.decoded.length - 1);
  expect(final?.kind, `reference main ends with a jump to the restoration:\n${shown}`).toBe(
    "transfer",
  );
  expect(final?.conditional, `reference main's final transfer is unconditional:\n${shown}`).toBe(
    false,
  );
  const target = main.decoded.at(-1)?.instruction.target;
  expect(target, `named restoration target:\n${shown}`).toBeDefined();
  if (target === undefined) throw new Error("Missing the restoration label");
  return target;
}

/** Bytes that capture A and X at a return; firmware ROM that no program writes. */
const registerProbes = {
  a: { address: 0xfff0, text: "sta $fff0" },
  x: { address: 0xfff1, text: "stx $fff1" },
} as const;

/** A register a return can carry a result in. */
export type ResultRegister = keyof typeof registerProbes;

/**
 * Evaluate a leaf routine and read the registers it returns its result in.
 *
 * The bounded evaluator reports memory, not registers, so every return is
 * preceded by stores of the requested registers to unused addresses. Those
 * stores are removed from the reported writes. A register the routine leaves
 * unknown at a return fails the evaluation rather than reading as zero.
 */
export function returnedRegisters(
  view: RoutineView,
  initial: ReadonlyMap<number, number>,
  registers: readonly ResultRegister[],
): {
  registers: Partial<Record<ResultRegister, number>>;
  writes: { address: number; value: number }[];
} {
  const probes = registers.map((register) => {
    const instruction = decodeLine(registerProbes[register].text, view.labels);
    if (instruction === undefined) throw new Error(`Undecodable probe for ${register}`);
    return instruction;
  });
  const decoded: Decoded[] = [];
  for (const entry of view.decoded) {
    if (entry.instruction.mnemonic !== "rts" || probes.length === 0) {
      decoded.push(entry);
      continue;
    }
    probes.forEach((instruction, index) =>
      decoded.push({
        lineIndex: entry.lineIndex,
        instruction,
        address: index === 0 ? entry.address : undefined,
      }),
    );
    decoded.push({ ...entry, address: undefined });
  }
  const evaluation = evaluate({ ...view, decoded }, initial);
  const probeAddresses = new Set(registers.map((register) => registerProbes[register].address));
  const result: Partial<Record<ResultRegister, number>> = {};
  for (const register of registers) {
    const captured = evaluation.writes
      .filter((write) => write.address === registerProbes[register].address)
      .at(-1);
    expect(captured, `${register.toUpperCase()} at the routine's return`).toBeDefined();
    if (captured !== undefined) result[register] = captured.value;
  }
  return {
    registers: result,
    writes: evaluation.writes
      .filter((write) => !probeAddresses.has(write.address))
      .map(({ address, value }) => ({ address, value })),
  };
}

/**
 * Direct stores the routine never reads back.
 *
 * Suits straight-line leaves whose result leaves in registers: a byte stored
 * and never read again is not observable through that return. A later read of
 * the same address, including a read-modify-write, counts as reading it back.
 */
export function unreadStores(view: RoutineView): Instruction[] {
  const instructions = view.decoded.map((entry) => entry.instruction);
  const direct = (instruction: Instruction) =>
    instruction.mode === "absolute" || instruction.mode === "zeroPage";
  return instructions.filter(
    (instruction, position) =>
      ["sta", "stx", "sty"].includes(instruction.mnemonic) &&
      direct(instruction) &&
      !instructions
        .slice(position + 1)
        .some(
          (later) =>
            memoryReaders.has(later.mnemonic) &&
            direct(later) &&
            later.address === instruction.address,
        ),
  );
}
