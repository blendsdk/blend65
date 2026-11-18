import { createHash } from "node:crypto";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { cia2ModelIdentity } from "../rd05/cia2-vice-fixture.js";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "../rd05/profile-fixture.js";

/** One cooperative runtime identity is enough for the sequential behavior cases. */
const PROFILE = "c64-pal-prg-kernal-6581" as const;
/** The placed byte observed by mainline after the handler runs. */
const GLOBAL_ADDRESS = 0xc000;
/** Timer A is bit 0 of the CIA2 interrupt control register. */
const TIMER_A_SOURCE_BIT = 0x01;
/** The stock KERNAL NMI vector is restored before returning to BASIC. */
const STOCK_NMI_VECTOR = [0x47, 0xfe] as const;

type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/**
 * Build a one-shot Timer A witness whose handler publishes one Boolean flag.
 * The timer constants and the read service are imported by name so the program
 * only uses the documented platform surface.
 */
function program(handlerBody: string): string {
  return `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
import { readAndClearPendingSources } from c64.cia2;
import { sourceAll, sourceTimerA, timerLoad, timerOneShot, timerStart } from c64.cia1;
import { writeTimerALatch, configureTimerA, enableInterruptSources,
    disableInterruptSources } from c64.cia2;
place(at: $C000) let finished: boolean = false;
interrupt function handler(): void {
${handlerBody}
}
function main(): void {
    setNMIExclusive(&handler);
    disableInterruptSources(sourceAll);
    readAndClearPendingSources();
    configureTimerA(timerOneShot);
    writeTimerALatch($00FF);
    enableInterruptSources(sourceTimerA);
    configureTimerA(timerLoad | timerOneShot | timerStart);
    while (!finished) { asm_nop(); }
    restoreNMI();
}`;
}

/** Require a nonnegative integer in public evidence instead of trusting metadata. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new TypeError("Expected a nonnegative integer in generated evidence");
  return value;
}

/** Decode the public label map only to locate checkpoints, never to derive behavior. */
function addresses(text: string): Map<string, number> {
  return new Map(
    [...text.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
      match[1]!,
      Number.parseInt(match[2]!, 16),
    ]),
  );
}

/** Find one public startup symbol by its documented logical name. */
function startupAddress(labels: ReadonlyMap<string, number>, name: string): number {
  const matches = [...labels].filter(([label]) =>
    label.endsWith(`_${Buffer.from(name).toString("hex")}`),
  );
  expect(matches, name).toHaveLength(1);
  return matches[0]![1];
}

/** Resolve one source function's single published entry address. */
function functionEntry(
  artifacts: Artifacts,
  labels: ReadonlyMap<string, number>,
  name: string,
): number {
  const fn = profileRecords(artifacts.debug.functions).find(
    (entry) => entry.qualifiedName === `src/game.blend::Game.${name}`,
  );
  if (fn === undefined) throw new Error(`Missing source function ${name}`);
  const variants = profileRecords(fn.entryVariants);
  expect(variants).toHaveLength(1);
  const label = variants[0]!.label;
  if (typeof label !== "string") throw new TypeError(`Missing entry label for ${name}`);
  const address = labels.get(label);
  if (address === undefined) throw new Error(`Missing assembled address for ${name}`);
  return address;
}

/** Resolve one source function's complete code interval for the stacked-return check. */
function functionRange(artifacts: Artifacts, name: string) {
  const qualifiedName = `src/game.blend::Game.${name}`;
  const rows = profileRecords(artifacts.memory.intervals).filter((interval) => {
    const owner = profileRecord(interval.owner);
    return interval.kind === "code" && owner.kind === "function" && owner.id === qualifiedName;
  });
  expect(rows).toHaveLength(1);
  return { start: integer(rows[0]!.start), end: integer(rows[0]!.end) };
}

/** Find the first emitted address of one source operation in a named function. */
function operationStart(artifacts: Artifacts, source: string, proof: string, name: string): number {
  const proofIndex = source.indexOf(proof);
  expect(proofIndex).toBeGreaterThanOrEqual(0);
  const position = Buffer.byteLength(source.slice(0, proofIndex));
  const proofBytes = Buffer.byteLength(proof);
  const sources = profileRecords(artifacts.debug.sources);
  const sourceIndex = sources.findIndex((entry) => entry.path === "src/game.blend");
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const functions = profileRecords(artifacts.debug.functions);
  const fn = functions.find((entry) => entry.qualifiedName === `src/game.blend::Game.${name}`);
  if (fn === undefined) throw new Error(`Missing source function ${name}`);
  const ranges = profileRecords(artifacts.debug.ranges);
  let best: { width: number; start: number } | undefined;
  for (const rangeIndex of (fn.rangeIndexes as unknown[]).map(integer)) {
    const origin = profileRecord(ranges[rangeIndex]!.origin);
    if (origin.kind !== "source") continue;
    const span = profileRecord(origin.span);
    if (span.sourceIndex !== sourceIndex) continue;
    const start = integer(span.startByte);
    const end = integer(span.endByte);
    if (start > position || position + proofBytes > end) continue;
    const machine = profileRecord(ranges[rangeIndex]!.machine);
    const candidate = { width: end - start, start: integer(machine.start) };
    if (
      best === undefined ||
      candidate.width < best.width ||
      (candidate.width === best.width && candidate.start < best.start)
    )
      best = candidate;
  }
  if (best === undefined) throw new Error(`Missing emitted source operation ${proof}`);
  return best.start;
}

/** Read a CPU stack frame with page-one wrapping, without changing the emulated CPU. */
async function stackBytes(monitor: ViceMonitor, sp: number, count: number): Promise<number[]> {
  return Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const address = 0x0100 | ((sp + index + 1) & 0xff);
      return (await monitor.readMemory(address, address))[0]!;
    }),
  );
}

/** Associate monitor tracepoint identities with their exact non-consuming observation labels. */
function takeTrace(monitor: ViceMonitor, events: ReadonlyMap<number, string>): string[] {
  return monitor.takeCheckpointHits().flatMap((id) => {
    const event = events.get(id);
    return event === undefined ? [] : [event];
  });
}

/** CPU snapshots and top-first stack bytes belong to one observed IRQ activation. */
type Cpu = Awaited<ReturnType<ViceMonitor["readCpuRegisters"]>>;
/** Save origins and call sites prevent equal-valued stack bytes from proving the wrong activation. */
// prettier-ignore
type Irq = { entry: Cpu; frame: number[]; cells: number[]; sites: number[]; calls: number[]; cursor: number };
/** A stopped instruction has not necessarily executed when a new interrupt arrives. */
type Pending = { pc: number; after: Irq; returned?: Cpu };
/**
 * Each hex token is one pinned stock instruction; its byte length advances the PC.
 * Commit predicted stack changes only against live evidence. Leave device trace hits untouched.
 */
// prettier-ignore
async function continuationObserver(
  monitor: ViceMonitor, artifacts: Artifacts, main: { start: number; end: number },
  handler: number, rti: number, mainSp: number,
  checkpoint: (pc: number) => Promise<number>,
  remove: (id: number) => Promise<void>, resume: () => Promise<number>,
) {
  const deadline = Date.now() + 90_000;
  const ports = await monitor.readMemory(0, 1);
  expect(ports[0]! & 7).toBe(7);
  expect(ports[1]! & 7).toBe(6);
  const rom = new Map<number, number[]>();
  const regions: readonly [number, string][] = [
    [0xff48, "48 8a 48 98 48 ba bd0401 2910 f003 6c1603 6c1403"],
    [0xea1c, "a4d3 91d1 8a 91f3 60 a5d1 85f3 a5d2 2903 09d8 85f4 60"],
    [0xea31, "20eaff a5cc d029 c6cd d025 a914 85cd a4d3 46cf ae8702 b1d1 b011 e6cf 85ce 2024ea b1f3 8d8702 ae8602 a5ce 4980 201cea a501 2910 f00a a000 84c0 a501 0920 d008 a5c0 d006 a501 291f 8501 2087ea ad0ddc 68 a8 68 aa 68 40"],
    [0xea87, "a900 8d8d02 a040 84cb 8d00dc ae01dc e0ff f061 a8 a981 85f5 a9eb 85f6 a9fe 8d00dc a208 48 ad01dc cd01dc d0f8 4a b016 48 b1f5 c905 b00c c903 f008 0d8d02 8d8d02 1002 84cb 68 c8 c041 b00b ca d0df 38 68 2a 8d00dc d0cc 68 6c8f02"],
    [0xeae0, "a4cb b1f5 aa c4c5 f007 a010 8c8c02 d036 297f 2c8a02 3016 7049 c97f f029 c914 f00c c920 f008 c91d f004 c911 d035 ac8c02 f005 ce8c02 d02b ce8b02 d026 a004 8c8b02 a4c6 88 101c a4cb 84c5 ac8d02 8c8e02 e0ff f00e 8a a6c6 ec8902 b006 9d7702 e8 86c6 a97f 8d00dc 60"],
    [0xeb48, "ad8d02 c903 d015 cd8e02 f0ee ad9102 301d ad18d0 4902 8d18d0 4c76eb 0a c908 9002 a906 aa bd79eb 85f5 bd7aeb 85f6 4ce0ea"],
    [0xf69b, "a200 e6a2 d006 e6a1 d002 e6a0 38 a5a2 e901 a5a1 e91a a5a0 e94f 9006 86a0 86a1 86a2 ad01dc cd01dc d0f8 aa 3013 a2bd 8e00dc ae01dc ec01dc d0f8 8d00dc e8 d002 8591 60"],
    [0xffea, "4c9bf6"], [0xfe43, "78 6c1803"],
  ];
  for (const [start, text] of regions) {
    let pc = start;
    const bytes: number[] = [];
    for (const token of text.split(" ")) {
      if (!/^(?:[0-9a-f]{2}){1,3}$/.test(token)) throw new Error("Invalid fixed ROM token");
      const instruction = Array.from(token.matchAll(/../g), (part) => parseInt(part[0], 16));
      if (rom.has(pc)) throw new Error("Overlapping fixed ROM instructions");
      rom.set(pc, instruction);
      bytes.push(...instruction);
      pc += instruction.length;
    }
    expect(Array.from(await monitor.readMemory(start, pc - 1)), "Pinned stock ROM").toEqual(bytes);
  }
  expect(Array.from(await monitor.readMemory(0xfffa, 0xfffb))).toEqual([0x43, 0xfe]);
  expect(Array.from(await monitor.readMemory(0xfffe, 0xffff))).toEqual([0x48, 0xff]);
  // These sizes validate this adapter's narrow source forms, not arbitrary code.
  const sizes = new Map<number, number>();
  for (const [width, text] of [
    [1, "08 18 28 38 48 58 60 68 78 8a 98 a8 aa ca e8 ea"],
    [2, "05 09 24 25 29 45 49 69 84 85 86 90 a0 a2 a4 a5 a6 a9 b0 c0 c5 c9 d0 e0 e9 f0"],
    [3, "0d 20 2c 2d 4c 4d 8c 8d 8e ac ad ae b9 bd cd"],
  ] as const) for (const token of text.split(" ")) sizes.set(parseInt(token, 16), width);
  const spaces = profileRecords(artifacts.debug.addressSpaces);
  const cpuSpaces = spaces.flatMap((space, index) =>
    space.id === "cpu16" && space.kind === "cpu" && space.sizeBytes === 65536 &&
    Array.isArray(space.banks) ? [index] : []);
  expect(cpuSpaces, "Unsupported continuation adapter: CPU address space").toHaveLength(1);
  const functions = profileRecords(artifacts.debug.functions);
  expect(functions.filter((fn) => fn.qualifiedName === "src/game.blend::Game.main")).toHaveLength(1);
  const functionIndex = functions.findIndex((fn) => fn.qualifiedName === "src/game.blend::Game.main");
  const fn = functions[functionIndex], ranges = artifacts.debug.ranges;
  if (fn === undefined || !Array.isArray(fn.rangeIndexes) || !Array.isArray(ranges))
    throw new Error("Unsupported continuation adapter: missing main instruction ranges");
  expect(profileRecords(fn.entryVariants)).toHaveLength(1);
  expect(artifacts.prg.length).toBeGreaterThanOrEqual(2);
  expect(main.end).toBeGreaterThan(main.start);
  expect(main.end).toBeLessThanOrEqual(65536);
  const indexes = fn.rangeIndexes.map(integer);
  expect(new Set(indexes).size).toBe(indexes.length);
  const instructions = indexes.map((index) => {
    expect(index).toBeLessThan(ranges.length);
    const range = profileRecord(ranges[index]);
    const owner = profileRecord(range.owner);
    expect([owner.kind, owner.functionIndex]).toEqual(["function", functionIndex]);
    const machine = profileRecord(range.machine);
    expect(machine.addressSpaceIndex).toBe(cpuSpaces[0]);
    return { start: integer(machine.start), end: integer(machine.end) };
  }).sort((a, b) => a.start - b.start);
  const origin = artifacts.prg.readUInt16LE(0);
  const mainStarts = new Set<number>();
  let covered = main.start;
  for (const instruction of instructions) {
    const offset = instruction.start - origin + 2;
    expect(instruction.start, "Unsupported continuation adapter: main coverage").toBe(covered);
    expect(offset).toBeGreaterThanOrEqual(2);
    expect(offset + instruction.end - instruction.start).toBeLessThanOrEqual(artifacts.prg.length);
    expect(sizes.get(artifacts.prg[offset]!), "Unsupported continuation adapter: instruction width")
      .toBe(instruction.end - instruction.start);
    mainStarts.add(instruction.start);
    covered = instruction.end;
  }
  expect(covered).toBe(main.end);
  expect(Array.from(await monitor.readMemory(main.start, main.end - 1))).toEqual(
    Array.from(artifacts.prg.subarray(main.start - origin + 2, main.end - origin + 2)));
  const calls = new Map([[0xea31, 0xffea], [0xea4f, 0xea24], [0xea5e, 0xea1c], [0xea7b, 0xea87]]);
  const returns = new Map([[0xf6dc, 0xea31], [0xea30, 0xea4f], [0xea23, 0xea5e], [0xeb47, 0xea7b]]);
  const pops = new Map([[0xea81, 0xff4c], [0xea83, 0xff4a], [0xea85, 0xff48],
    [0xeacb, 0xeab6], [0xead5, 0xeaaa], [0xeadc, 0xeaaa]]);
  const pushes = new Set([0xff48, 0xff4a, 0xff4c, 0xeaaa, 0xeab6]);
  const branches = new Map<number, number>([
    [0xff53,0xff58],[0xea36,0xea61],[0xea3a,0xea61],[0xea49,0xea5c],[0xea65,0xea71],[0xea6f,0xea79],
    [0xea73,0xea7b],[0xea98,0xeafb],[0xeab1,0xeaab],[0xeab4,0xeacc],[0xeabb,0xeac9],[0xeabf,0xeac9],
    [0xeac7,0xeacb],[0xeacf,0xeadc],[0xead2,0xeab3],[0xeada,0xeaa8],[0xeae7,0xeaf0],[0xeaee,0xeb26],
    [0xeaf5,0xeb0d],[0xeaf7,0xeb42],[0xeafb,0xeb26],[0xeaff,0xeb0d],[0xeb03,0xeb0d],[0xeb07,0xeb0d],
    [0xeb0b,0xeb42],[0xeb10,0xeb17],[0xeb15,0xeb42],[0xeb1a,0xeb42],[0xeb24,0xeb42],[0xeb32,0xeb42],
    [0xeb3a,0xeb42],[0xeb4d,0xeb64],[0xeb52,0xeb42],[0xeb57,0xeb76],[0xeb67,0xeb6b],[0xf69f,0xf6a7],
    [0xf6a3,0xf6a7],[0xf6b4,0xf6bc],[0xf6c2,0xf6bc],[0xf6c5,0xf6da],[0xf6d2,0xf6cc],[0xf6d8,0xf6dc],
  ]);
  const jumps = new Map([[0xff58,0xea31],[0xeadd,0xeb48],[0xeb61,0xeb76],[0xeb76,0xeae0],[0xffea,0xf69b]]);
  const stops = new Set([...pushes, ...pops.keys(), ...calls.keys(), ...returns.keys(),
    ...calls.values(), ...Array.from(calls.keys(), (pc) => pc + 3), 0xff58, 0xeadd, 0xf69b, 0xea86]);
  const edges = new Map<number, number[]>();
  for (const [pc, bytes] of rom) {
    if (pc === 0xff55 || pc === 0xfe43 || pc === 0xfe44) continue;
    const branch = branches.get(pc);
    if ([0x10,0x30,0x50,0x70,0x90,0xb0,0xd0,0xf0].includes(bytes[0]!)) {
      expect(branch).toBe(pc + 2 + (bytes[1]! < 128 ? bytes[1]! : bytes[1]! - 256));
    }
    if (bytes[0] === 0x48) expect(pushes.has(pc)).toBe(true);
    if (bytes[0] === 0x68) expect(pops.has(pc)).toBe(true);
    if (bytes[0] === 0x20) expect(calls.get(pc)).toBe(bytes[1]! | (bytes[2]! << 8));
    if (bytes[0] === 0x4c) expect(jumps.get(pc)).toBe(bytes[1]! | (bytes[2]! << 8));
    if (bytes[0] === 0x60) expect(returns.has(pc)).toBe(true);
    if (bytes[0] === 0x40) expect(pc).toBe(0xea86);
    const next = branch === undefined ? [calls.get(pc) ?? jumps.get(pc) ?? pc + bytes.length]
      : pc === 0xff53 ? [branch] : [branch, pc + 2];
    edges.set(pc, returns.has(pc) || pc === 0xea86 ? [] : next);
    for (const target of edges.get(pc)!) expect(rom.has(target) && target !== 0xff55).toBe(true);
  }
  /** Search only the fixed attested graph, stopping before every observable event. */
  const reaches = (start: number, target: number): boolean => {
    const todo = [start], seen = new Set<number>();
    while (todo.length) {
      const pc = todo.pop()!;
      if (pc === target) return true;
      if (seen.has(pc) || stops.has(pc)) continue;
      seen.add(pc);
      todo.push(...(edges.get(pc) ?? []));
    }
    return false;
  };
  /** Keep executed returns pending until their actual continuation checkpoint is observed. */
  const owned = new Map<number, number>(), completed = new Map<number, Cpu[]>();
  let active: Irq | undefined, pending: Pending | undefined, candidate: Irq | undefined;
  let nmi: { cpu: Cpu; frame: number[]; pc: number; phase: "route" | "body" | "return" } | undefined;
  let activations = 0, addedStops = 0, nmis = 0;
  /** Compare architectural flags only; stacked bytes are checked separately in full. */
  const sameCpu = (actual: Cpu, expected: Cpu, status = true) => {
    expect([actual.a,actual.x,actual.y,actual.sp]).toEqual([expected.a,expected.x,expected.y,expected.sp]);
    if (status) expect(actual.p & 0xcf).toBe(expected.p & 0xcf);
  };
  /** Retain checkpoint ownership so teardown cannot remove another observer's stops. */
  const arm = async (pc: number) => { if (!owned.has(pc)) owned.set(pc, await checkpoint(pc)); };
  /** Hardware frames and all live links are compared at their exact wrapped positions. */
  const matches = async (irq: Irq, cpu: Cpu) => cpu.sp === ((irq.entry.sp + 3 - irq.cells.length) & 255) &&
    (await stackBytes(monitor, cpu.sp, irq.cells.length)).every((byte, index) => byte === irq.cells[index]);
  /** Resolve the stopped instruction against the state immediately before a new interrupt. */
  const settle = async (pc: number, cpu: Cpu) => {
    if (!active) { expect(pending).toBeUndefined(); return; }
    if (pending) {
      if (pc === pending.pc && await matches(active, cpu)) active.cursor = pc;
      else if (pending.returned) {
        expect(pc).toBe(pending.after.cursor);
        sameCpu(cpu, pending.returned);
        completed.set(pc, [...(completed.get(pc) ?? []), pending.returned]);
        active = undefined;
      } else {
        active = pending.after;
        expect(await matches(active, cpu)).toBe(true);
      }
      pending = undefined;
    }
    if (active) {
      expect(reaches(active.cursor, pc), "Observed stock IRQ continuation").toBe(true);
      expect(await matches(active, cpu)).toBe(true);
      active.cursor = pc;
    }
  };
  /** Capture one IRQ entry; a candidate interrupted before its first stop needs later confirmation. */
  const irqEntry = (cpu: Cpu, frame: number[]): Irq => {
    expect(mainStarts.has(frame[1]! | (frame[2]! << 8))).toBe(true);
    expect(frame[0]! & 0x14).toBe(0);
    expect(cpu.p & 0xcf).toBe((frame[0]! | 4) & 0xcf);
    return { entry: cpu, frame, cells: [...frame], sites: [-1,-1,-1], calls: [], cursor: 0xff48 };
  };
  for (const pc of [...stops, 0xff48, 0xfe43]) await arm(pc);
  return {
    /** The handler's frame must name the continuation captured before its wrapper ran. */
    acceptedPc: () => {
      if (!nmi || nmi.phase !== "body") throw new Error("Missing observed NMI entry");
      return nmi.pc;
    },
    /** Process bounded route stops without consuming the device-observation buffer. */
    next: async (expected: number): Promise<number> => {
      for (;;) {
        expect(deadline - Date.now(), "Observer deadline before a 20-second wait").toBeGreaterThanOrEqual(20_000);
        const pc = await resume(), cpu = await monitor.readCpuRegisters();
        expect(pc === expected || pc === 0xfe43 || stops.has(pc) || completed.has(pc) || nmi?.pc === pc || (pending?.returned && pending.after.cursor === pc)).toBeTruthy();
        if (pc !== expected) expect(++addedStops, "Bounded observer stops").toBeLessThanOrEqual(64);
        if (pc === 0xfe43) {
          expect(++nmis).toBe(1);
          expect((await monitor.readMemory(1, 1))[0]! & 7).toBe(6);
          expect(Array.from(await monitor.readMemory(0xfffa, 0xfffb))).toEqual([0x43,0xfe]);
          expect(Array.from(await monitor.readMemory(0xfffe, 0xffff))).toEqual([0x48,0xff]);
          const frame = await stackBytes(monitor, cpu.sp, 3), savedPc = frame[1]! | (frame[2]! << 8);
          expect(frame[0]! & 0x10).toBe(0);
          expect(cpu.p & 0xcf).toBe((frame[0]! | 4) & 0xcf);
          expect(Array.from(await monitor.readMemory(0x0318, 0x0319))).toEqual([handler & 255, handler >> 8]);
          const prior = { ...cpu, sp: (cpu.sp + 3) & 255, p: frame[0]! };
          // Preempting the first PHA does not create a second IRQ activation on return.
          if (savedPc === 0xff48 && active?.cursor === 0xff48 && pending?.pc === 0xff48 && await matches(active, prior)) {
            sameCpu(prior, active.entry); await settle(savedPc, prior);
          } else if (savedPc === 0xff48) {
            const outer = await stackBytes(monitor, prior.sp, 3);
            if (active) await settle(outer[1]! | (outer[2]! << 8), { ...prior, sp: (prior.sp + 3) & 255, p: outer[0]! });
            candidate = irqEntry(prior, outer);
            expect((prior.sp + 3) & 255).toBe(mainSp);
            expect(active).toBeUndefined();
          } else {
            await settle(savedPc, prior);
            if (!active) expect(mainStarts.has(savedPc)).toBe(true);
          }
          nmi = { cpu, frame, pc: savedPc, phase: "route" };
          await arm(savedPc);
          continue;
        }
        if (nmi && pc === handler) {
          expect(nmi.phase).toBe("route");
          sameCpu(cpu, nmi.cpu);
          expect(await stackBytes(monitor, cpu.sp, 3)).toEqual(nmi.frame);
          nmi.phase = "body";
        } else if (nmi && pc === rti) {
          expect(nmi.phase).toBe("body");
          expect(Array.from(await monitor.readMemory(pc, pc))).toEqual([0x40]);
          sameCpu(cpu, nmi.cpu, false);
          expect(await stackBytes(monitor, cpu.sp, 3)).toEqual(nmi.frame);
          nmi.phase = "return";
        } else {
          if (nmi) {
            expect(nmi.phase).toBe("return");
            const restored = { ...nmi.cpu, sp: (nmi.cpu.sp + 3) & 255, p: nmi.frame[0]! };
            // An IRQ may arrive before the return checkpoint; require the actual continuation later.
            if (pc === 0xff48 && pc !== nmi.pc) {
              const irqFrame = await stackBytes(monitor, cpu.sp, 3);
              expect(irqFrame[1]! | (irqFrame[2]! << 8)).toBe(nmi.pc);
              sameCpu({ ...cpu, sp: (cpu.sp + 3) & 255, p: irqFrame[0]! }, restored);
              completed.set(nmi.pc, [...(completed.get(nmi.pc) ?? []), restored]);
            } else { expect(pc).toBe(nmi.pc); sameCpu(cpu, restored); }
            nmi = undefined;
          }
          if (pc === 0xff48 && active?.cursor === 0xff48 && pending === undefined) await settle(pc, cpu);
          else if (pc === 0xff48) {
            expect((await monitor.readMemory(1, 1))[0]! & 7).toBe(6);
            expect(Array.from(await monitor.readMemory(0xfffe, 0xffff))).toEqual([0x48,0xff]);
            const frame = await stackBytes(monitor, cpu.sp, 3);
            if (active) await settle(frame[1]! | (frame[2]! << 8), { ...cpu, sp: (cpu.sp + 3) & 255, p: frame[0]! });
            expect(active).toBeUndefined();
            if (candidate) { sameCpu(cpu, candidate.entry); expect(frame).toEqual(candidate.frame); }
            active = irqEntry(cpu, frame);
            candidate = undefined;
            expect(++activations).toBeLessThanOrEqual(4);
          } else await settle(pc, cpu);
          for (const returned of completed.get(pc) ?? []) sameCpu(cpu, returned);
          completed.delete(pc);
          if (stops.has(pc)) expect(active).toBeDefined();
          if (active) {
            const after: Irq = { ...active, cells: [...active.cells], sites: [...active.sites], calls: [...active.calls] };
            const bytes = rom.get(pc);
            if (!bytes || !stops.has(pc)) {
              expect(pc === active.cursor && rom.has(pc)).toBe(true);
            } else {
              after.cursor = (edges.get(pc) ?? [])[0] ?? pc;
              if (pushes.has(pc)) { after.cells.unshift(cpu.a); after.sites.unshift(pc); }
              if (pops.has(pc)) { expect(after.sites.shift()).toBe(pops.get(pc)); after.cells.shift(); }
              if (calls.has(pc)) {
                after.cells.unshift((pc + 2) & 255, (pc + 2) >> 8);
                after.sites.unshift(pc, pc); after.calls.push(pc);
              }
              if (returns.has(pc)) {
                const site = after.calls.pop();
                if (site === undefined) throw new Error("Missing observed JSR activation");
                expect(site).toBe(returns.get(pc));
                expect(after.cells.splice(0, 2)).toEqual([((site + 2) & 255), (site + 2) >> 8]);
                expect(after.sites.splice(0, 2)).toEqual([site, site]);
                after.cursor = site + 3;
              }
              if (pc === 0xff58) expect(Array.from(await monitor.readMemory(0x0314, 0x0315))).toEqual([0x31, 0xea]);
              if (pc === 0xeadd) expect(Array.from(await monitor.readMemory(0x028f, 0x0290))).toEqual([0x48, 0xeb]);
              pending = { pc, after };
              if (pc === 0xea86) {
                expect(Array.from(await monitor.readMemory(pc, pc))).toEqual([0x40]);
                expect(active.calls).toEqual([]);
                expect(active.cells).toEqual(active.frame);
                sameCpu(cpu, active.entry, false);
                after.cursor = active.frame[1]! | (active.frame[2]! << 8);
                after.cells = []; after.sites = [];
                pending.returned = { ...active.entry, sp: (active.entry.sp + 3) & 255, p: active.frame[0]! };
                await arm(after.cursor);
              }
            }
          }
        }
        if (!stops.has(pc) && pc !== 0xfe43 && !completed.has(pc) && nmi?.pc !== pc) {
          const id = owned.get(pc);
          if (id !== undefined) { await remove(id); owned.delete(pc); }
        }
        if (pc === expected) return pc;
      }
    },
    /** Release only this observer's checkpoints after both return proofs complete. */
    close: async () => {
      expect(nmis).toBe(1);
      expect([active, pending, candidate, nmi]).toEqual([undefined, undefined, undefined, undefined]);
      expect(completed.size).toBe(0);
      for (const id of owned.values()) await remove(id);
      owned.clear();
    },
  };
}

/**
 * Build, run and observe one handler case through a genuine CIA2 Timer A NMI.
 * A missing or unidentifiable emulator runtime fails the case instead of skipping it.
 * @param source Complete program under test.
 * @param expectedGlobal Value the handler must publish to the placed flag.
 */
async function qualify(source: string, expectedGlobal: number): Promise<void> {
  await withProfileProject(source, PROFILE, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory.acmeReconciled).toBe(true);
    const artifactSha256 = createHash("sha256").update(artifacts.prg).digest("hex");
    const labels = addresses(artifacts.labels);
    const handlerAddress = functionEntry(artifacts, labels, "handler");
    const mainRange = functionRange(artifacts, "main");
    const handlerRange = functionRange(artifacts, "handler");
    const restoreAddress = operationStart(artifacts, source, "restoreNMI()", "main");

    const started = await startVice(
      join(built.generation.directory, built.generation.primaryArtifact),
      80_000_000,
      PROFILE,
    );
    if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
    const { monitor } = started;
    const checkpoints = new Set<number>();
    try {
      expect(started.identity.executableSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(started.identity.roms).toHaveLength(3);
      await cia2ModelIdentity(monitor, PROFILE);

      const resume = async () => {
        const stopped = monitor.waitForStop(20_000);
        await monitor.resume();
        return stopped;
      };
      const checkpoint = async (address: number) => {
        const id = await monitor.setExecuteCheckpoint(address);
        checkpoints.add(id);
        return id;
      };
      const remove = async (id: number) => {
        await monitor.deleteCheckpoint(id);
        checkpoints.delete(id);
      };

      // Enter through the stock BASIC SYS startup and record the caller's return address.
      const atStartup = await checkpoint(startupAddress(labels, "startup.entry"));
      expect(await resume()).toBe(startupAddress(labels, "startup.entry"));
      const caller = await monitor.readCpuRegisters();
      const returnBytes = await stackBytes(monitor, caller.sp, 2);
      const callerReturn = ((returnBytes[0]! | (returnBytes[1]! << 8)) + 1) & 0xffff;
      // The pinned SYS extension pushes $E146; RTS resumes at its PHP in KERNAL ROM.
      expect(callerReturn).toBe(0xe147);
      const entryPorts = Array.from(await monitor.readMemory(0, 1));
      await remove(atStartup);

      const atMain = await checkpoint(mainRange.start);
      const atHandler = await checkpoint(handlerAddress);
      expect(await resume()).toBe(mainRange.start);
      await remove(atMain);
      const observer = await continuationObserver(
        monitor,
        artifacts,
        mainRange,
        handlerAddress,
        handlerRange.end - 1,
        (await monitor.readCpuRegisters()).sp,
        checkpoint,
        remove,
        resume,
      );

      // Observe the handler device effects without stopping inside the handler.
      const trace = new Map<number, string>();
      trace.set(await monitor.setAccessTracepoint(0xdd0d, "load"), "load:ICR");
      trace.set(await monitor.setAccessTracepoint(GLOBAL_ADDRESS, "store"), "store:GLOBAL");
      monitor.takeCheckpointHits();

      // Genuine hardware acceptance of the source-programmed timer underflow.
      expect(await observer.next(handlerAddress)).toBe(handlerAddress);
      const accepted = await monitor.readCpuRegisters();
      const frame = await stackBytes(monitor, accepted.sp, 3);
      expect(frame[0]! & 0x10).toBe(0);
      // Acceptance sets I in the running CPU; the pushed frame preserves the prior state.
      expect(accepted.p & 0x04).toBe(0x04);
      const resumedPc = frame[1]! | (frame[2]! << 8);
      expect(resumedPc).toBe(observer.acceptedPc());
      // The installed route is the handler under test, not a helper or stale vector.
      expect(Array.from(await monitor.readMemory(0x0318, 0x0319))).toEqual([
        handlerAddress & 0xff,
        handlerAddress >> 8,
      ]);
      expect((await monitor.readIo(0xdd0d, 0xdd0d))[0]! & TIMER_A_SOURCE_BIT).toBe(
        TIMER_A_SOURCE_BIT,
      );
      monitor.takeCheckpointHits();

      // One consuming read and one global store, then the wrapper restores the caller frame.
      const atRti = await checkpoint(handlerRange.end - 1);
      expect(await observer.next(handlerRange.end - 1)).toBe(handlerRange.end - 1);
      expect(takeTrace(monitor, trace)).toEqual(["load:ICR", "store:GLOBAL"]);
      const observedGlobal = (await monitor.readMemory(GLOBAL_ADDRESS, GLOBAL_ADDRESS))[0]!;
      expect(observedGlobal).toBe(expectedGlobal);
      const beforeRti = await monitor.readCpuRegisters();
      expect([beforeRti.a, beforeRti.x, beforeRti.y, beforeRti.sp]).toEqual([
        accepted.a,
        accepted.x,
        accepted.y,
        accepted.sp,
      ]);
      await remove(atRti);
      await remove(atHandler);

      // Mainline leaves the loop because it observed the stored value.
      const atRestore = await checkpoint(restoreAddress);
      monitor.takeCheckpointHits();
      expect(await observer.next(restoreAddress)).toBe(restoreAddress);
      expect((await monitor.readMemory(GLOBAL_ADDRESS, GLOBAL_ADDRESS))[0]!).toBe(expectedGlobal);
      expect(takeTrace(monitor, trace)).toEqual([]);
      await remove(atRestore);
      await observer.close();

      // The final release restores the stock route and returns to the BASIC caller.
      await checkpoint(callerReturn);
      expect(await resume()).toBe(callerReturn);
      const returned = await monitor.readCpuRegisters();
      expect(returned.sp).toBe((caller.sp + 2) & 0xff);
      expect(returned.p & 0x0c).toBe(caller.p & 0x0c);
      expect(Array.from(await monitor.readMemory(0x0318, 0x0319))).toEqual(STOCK_NMI_VECTOR);
      const controls = await monitor.readIo(0xdd0e, 0xdd0f);
      expect(controls[0]! & 1).toBe(0);
      expect(controls[1]! & 1).toBe(0);
      expect((await monitor.readIo(0xdd0d, 0xdd0d))[0]! & 0x9f).toBe(0);
      expect((await monitor.readMemory(GLOBAL_ADDRESS, GLOBAL_ADDRESS))[0]!).toBe(expectedGlobal);
      expect(Array.from(await monitor.readMemory(0, 1))).toEqual(entryPorts);

      console.info(
        "Materialized NMI Boolean mask runtime evidence",
        JSON.stringify({
          profile: PROFILE,
          artifactSha256,
          identity: started.identity,
          mainRange,
          handlerRange,
          handlerAddress,
          restoreAddress,
          callerReturn,
          observedGlobal,
        }),
      );
    } finally {
      for (const id of checkpoints) await monitor.deleteCheckpoint(id);
      await stopVice({ child: started.child, monitor });
    }
  });
}

/** Timer A sets control bit zero; the mask-three `!= 0` form publishes a true flag. */
const TIMER_A_MASK_THREE = program("    finished = ((readAndClearPendingSources() & 3) != 0);");

/** Timer A sets control bit zero; the serial bit is clear, so the mask-eight inverse is true. */
const TIMER_A_MASK_EIGHT_INVERSE = program(
  "    finished = ((readAndClearPendingSources() & 8) == 0);",
);

describe.sequential("materialized NMI Boolean masks at runtime", () => {
  it("should publish the mask-three Boolean through a genuine Timer A NMI and return", async () => {
    await qualify(TIMER_A_MASK_THREE, 1);
  }, 120_000);

  it("should publish the inverse mask-eight Boolean through a genuine Timer A NMI and return", async () => {
    await qualify(TIMER_A_MASK_EIGHT_INVERSE, 1);
  }, 120_000);
});
