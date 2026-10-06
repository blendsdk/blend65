import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  profileSpan,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const TARGETS = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];

/** Retain an unentered IRQ body while using normal finite function values. */
function sourceFor(mode: "terminal" | "returning" | "mixed" | "conditional") {
  const left = mode === "returning" ? "poke($c013, 3);" : "while (true) {}";
  const right =
    mode === "terminal"
      ? "while (true) {}"
      : mode === "conditional"
        ? "while (peek($c015) != 0) {} poke($c013, 7);"
        : "poke($c013, 7);";
  const suffix =
    mode === "terminal" ? "setNMI(&C); restoreNMI(); poke($c014, 11);" : "poke($c014, 11);";
  return `module Game;
import { setNMI, restoreNMI, setIRQ, restoreIRQ } from c64.system;
interrupt function B(): void {}
interrupt function C(): void {}
function left(): void { ${left} }
function right(): void { ${right} }
function H(): void {
  poke($c011, 5);
  let target: fn(): void = peek($c012) != 0 ? &left : &right;
  target();
  ${suffix}
}
interrupt function Q(): void { H(); }
export function main(): void {
  setNMI(&B);
  asm_php(); asm_sei(); asm_nop();
  setIRQ(&Q);
  pokew($c010, word(&Q));
  restoreIRQ(); asm_plp(); restoreNMI();
}
`;
}

type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;
type Instruction = { address: number; opcode: number; operand: number; size: number };

/** Read documented numeric fields without inventing defaults for missing evidence. */
function numeric(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new TypeError("Expected an integer evidence field");
  return value;
}

// Official NMOS opcode widths establish instruction boundaries independently of output text.
const ONE_BYTE =
  "00 08 0a 18 28 2a 38 40 48 4a 58 60 68 6a 78 88 8a 98 9a a8 aa b8 ba c8 ca d8 e8 ea f8";
const THREE_BYTE =
  "0d 0e 19 1d 1e 20 2c 2d 2e 39 3d 3e 4c 4d 4e 59 5d 5e 6c 6d 6e 79 7d 7e 8c 8d 8e 99 9d ac ad ae b9 bc bd be cc cd ce d9 dd de ec ed ee f9 fd fe";
const TWO_BYTE =
  "01 05 06 09 10 11 15 16 21 24 25 26 29 30 31 35 36 41 45 46 49 50 51 55 56 61 65 66 69 70 71 75 76 81 84 85 86 90 91 94 95 96 a0 a1 a2 a4 a5 a6 a9 b0 b1 b4 b5 b6 c0 c1 c4 c5 c6 c9 d0 d1 d5 d6 e0 e1 e4 e5 e6 e9 f0 f1 f5 f6";
const WIDTHS = new Map<number, number>();
for (const [width, opcodes] of [
  [1, ONE_BYTE],
  [2, TWO_BYTE],
  [3, THREE_BYTE],
] as const)
  for (const opcode of opcodes.split(" ")) WIDTHS.set(parseInt(opcode, 16), width);

/** Decode only a variant's owned ranges; gaps and loaded padding are not executable work. */
function variantInstructions(artifacts: Artifacts, name: string): Instruction[][] {
  const functions = profileRecords(artifacts.debug.functions);
  const functionIndex = functions.findIndex(
    (fn) => fn.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(functionIndex, `Emitted source function ${name}`).toBeGreaterThanOrEqual(0);
  const variants = profileRecords(functions[functionIndex]!.entryVariants);
  expect(variants.length).toBeGreaterThan(0);
  const ranges = profileRecords(artifacts.debug.ranges);
  const contexts = profileRecords(artifacts.debug.contexts);
  const load = artifacts.prg.readUInt16LE(0);
  return variants.map((variant, entryVariantIndex) => {
    if (!Array.isArray(variant.rangeIndexes)) throw new TypeError("Missing variant ranges");
    const owned = variant.rangeIndexes
      .map((index) => ranges[numeric(index)]!)
      .filter((range) => {
        const owner = profileRecord(range.owner);
        return owner.kind === "function" && owner.functionIndex === functionIndex;
      });
    expect(owned.length).toBeGreaterThan(0);
    const instructions = new Map<number, Instruction>();
    for (const range of owned) {
      const context = contexts[numeric(range.contextIndex)]!;
      expect(context).toMatchObject({ kind: "entry", functionIndex, entryVariantIndex });
      const machine = profileRecord(range.machine);
      const end = numeric(machine.end);
      for (let address = numeric(machine.start); address < end; ) {
        const offset = address - load + 2;
        expect(offset).toBeGreaterThanOrEqual(2);
        const opcode = artifacts.prg[offset]!;
        const size = WIDTHS.get(opcode);
        if (size === undefined) throw new Error(`Unofficial NMOS opcode at ${address}`);
        expect(address + size).toBeLessThanOrEqual(end);
        expect(offset + size).toBeLessThanOrEqual(artifacts.prg.length);
        const operand =
          size === 3 ? artifacts.prg.readUInt16LE(offset + 1) : artifacts.prg[offset + 1]!;
        instructions.set(address, { address, opcode, operand, size });
        address += size;
      }
    }
    return [...instructions.values()].sort((a, b) => a.address - b.address);
  });
}

/** Match the direct call to an independently named source target's emitted body. */
function callsTo(instructions: Instruction[], targets: Instruction[][]): Instruction[] {
  const entries = new Set(targets.map((body) => body[0]!.address));
  return instructions.filter(
    (instruction) => instruction.opcode === 0x20 && entries.has(instruction.operand),
  );
}

/** Prove a local ordinary-call thunk through both retained canonical pointer bytes. */
function thunkCall(
  instructions: Instruction[],
  left: Instruction[][],
  right: Instruction[][],
): Instruction {
  const calls = instructions.filter((instruction) => instruction.opcode === 0x20);
  expect(calls).toHaveLength(1);
  const call = calls[0]!;
  const thunk = instructions.find((instruction) => instruction.address === call.operand);
  expect(thunk).toMatchObject({ opcode: 0x6c, size: 3 });
  const pointer = thunk!.operand;
  expect(pointer & 0xff).not.toBe(0xff);
  const bytes = new Map<number, Set<number>>();
  const copies: [number, number][] = [];
  const entries = [left, right].map((bodies) => new Set(bodies.map((body) => body[0]!.address)));
  const staged = new Set<number>();
  for (let index = 1; index < instructions.length; index += 1) {
    const load = instructions[index - 1]!;
    const store = instructions[index]!;
    if (![0x85, 0x8d].includes(store.opcode) || load.address + load.size !== store.address)
      continue;
    if (load.opcode === 0xa9) {
      const values = bytes.get(store.operand) ?? new Set<number>();
      values.add(load.operand);
      bytes.set(store.operand, values);
    } else if ([0xa5, 0xad].includes(load.opcode)) copies.push([load.operand, store.operand]);
    const highLoad = instructions[index + 1];
    const highStore = instructions[index + 2];
    if (
      load.opcode === 0xa9 &&
      highLoad?.opcode === 0xa9 &&
      highStore?.opcode === store.opcode &&
      highStore.operand === store.operand + 1
    ) {
      const address = load.operand | (highLoad.operand << 8);
      if (entries.some((set) => set.has(address))) staged.add(address);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [from, to] of copies) {
      const values = bytes.get(to) ?? new Set<number>();
      for (const value of bytes.get(from) ?? []) {
        if (!values.has(value)) {
          values.add(value);
          changed = true;
        }
      }
      bytes.set(to, values);
    }
  }
  expect(staged.size).toBe(2);
  for (const sourceEntries of entries)
    expect([...staged].some((address) => sourceEntries.has(address))).toBe(true);
  expect(bytes.get(pointer)).toEqual(new Set([...staged].map((address) => address & 0xff)));
  expect(bytes.get(pointer + 1)).toEqual(new Set([...staged].map((address) => address >>> 8)));
  return call;
}

/** Require the observable constant write and its register value at the source callback. */
function requireWrite(instructions: Instruction[], address: number, value: number) {
  const stores = instructions.filter(
    (instruction) =>
      [0x8d, 0x8e, 0x8c].includes(instruction.opcode) && instruction.operand === address,
  );
  expect(stores).toHaveLength(1);
  const store = stores[0]!;
  const load = instructions.find(
    (instruction) => instruction.address + instruction.size === store.address,
  );
  expect(load).toMatchObject({
    opcode: store.opcode === 0x8d ? 0xa9 : store.opcode === 0x8e ? 0xa2 : 0xa0,
    operand: value,
  });
}

/** A nonreturning ordinary call still spends three bytes/six cycles and pushes two return bytes. */
function requireTerminalArm(instructions: Instruction[], call: Instruction) {
  expect(call.size).toBe(3);
  const successor = instructions.find((instruction) => instruction.address === call.address + 3);
  if (successor !== undefined)
    expect(
      [0x4c, 0x6c, 0x60],
      `No continuation after terminal JSR at ${call.address}`,
    ).not.toContain(successor.opcode);
}

/** Correlate effects to the exact source operation instead of scanning neighboring code. */
function sourceInstructions(artifacts: Artifacts, source: string, proof: string) {
  const span = profileSpan(source, proof);
  const sources = profileRecords(artifacts.debug.sources);
  const sourceIndex = sources.findIndex((entry) => entry.path === span.sourceId);
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  return profileRecords(artifacts.debug.ranges).filter((range) => {
    const origin = profileRecord(range.origin);
    const candidate = origin.kind === "source" ? origin.span : origin.sourceSpan;
    if (candidate === undefined) return false;
    const actual = profileRecord(candidate);
    return (
      actual.sourceIndex === sourceIndex &&
      numeric(actual.startByte) >= span.start &&
      numeric(actual.endByte) <= span.end
    );
  });
}

/** Count complete payload and zero fill separately from executable instruction bytes. */
function requireLoadedAccounting(artifacts: Artifacts) {
  const intervals = profileRecords(artifacts.memory.intervals);
  const load = artifacts.prg.readUInt16LE(0);
  const loadEnd = load + artifacts.prg.length - 2;
  const loaded = new Set<number>();
  for (const interval of intervals) {
    const start = numeric(interval.start);
    const end = numeric(interval.end);
    const clippedStart = Math.max(load, start);
    const clippedEnd = Math.min(loadEnd, end);
    if (start >= loadEnd) expect(Math.max(0, clippedEnd - clippedStart)).toBe(0);
    for (let address = clippedStart; address < clippedEnd; address += 1) loaded.add(address);
  }
  expect(loaded.size).toBe(artifacts.prg.length - 2);
  expect(profileRecord(artifacts.costs.totals).programBytes).toBe(loaded.size);
  for (const interval of intervals.filter((entry) => entry.kind === "padding")) {
    const start = numeric(interval.start);
    const end = numeric(interval.end);
    expect(numeric(interval.paddingBytes)).toBe(end - start);
    if (end <= load || start >= loadEnd) continue;
    expect(
      [
        ...artifacts.prg.subarray(
          Math.max(load, start) - load + 2,
          Math.min(loadEnd, end) - load + 2,
        ),
      ].every((byte) => byte === 0),
    ).toBe(true);
  }
}

describe.each(TARGETS)("Finite callback continuation output on %s", (target) => {
  for (const mode of ["terminal", "returning", "mixed", "conditional"] as const) {
    const intent = {
      terminal: "should end both nonreturning arms after ordinary calls and omit their dead suffix",
      returning: "should retain ordinary returning calls and the reachable volatile suffix",
      mixed: "should end only the terminal arm while preserving the returning arm and suffix",
      conditional: "should preserve a dynamically returning arm and its reachable suffix",
    }[mode];
    it(
      intent,
      async () => {
        const source = sourceFor(mode);
        const artifacts = await withProfileProject(source, target, async (project) => {
          const checked = await checkProject({ project });
          expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
          const built = await buildProject({ project, optimization: "none" });
          expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
          if (built.kind !== "success") throw new Error("Expected real ACME publication");
          return readProfileArtifacts(built);
        });
        const left = variantInstructions(artifacts, "left");
        const right = variantInstructions(artifacts, "right");
        if (mode === "returning") for (const body of left) requireWrite(body, 0xc013, 3);
        if (mode !== "terminal") for (const body of right) requireWrite(body, 0xc013, 7);
        for (const instructions of variantInstructions(artifacts, "H")) {
          const leftCalls = callsTo(instructions, left);
          const rightCalls = callsTo(instructions, right);
          if (mode === "returning" && leftCalls.length === 0 && rightCalls.length === 0) {
            const call = thunkCall(instructions, left, right);
            leftCalls.push(call);
            rightCalls.push(call);
          }
          expect(leftCalls.length).toBe(1);
          expect(rightCalls.length).toBe(1);
          if (mode !== "returning") requireTerminalArm(instructions, leftCalls[0]!);
          if (mode === "terminal") requireTerminalArm(instructions, rightCalls[0]!);
          const prefix = instructions.filter(
            (instruction) =>
              [0x8d, 0x8e, 0x8c].includes(instruction.opcode) && instruction.operand === 0xc011,
          );
          const suffix = instructions.filter(
            (instruction) =>
              [0x8d, 0x8e, 0x8c].includes(instruction.opcode) && instruction.operand === 0xc014,
          );
          expect(prefix).toHaveLength(1);
          requireWrite(instructions, 0xc011, 5);
          expect(prefix[0]!.address).toBeLessThan(leftCalls[0]!.address);
          expect(prefix[0]!.address).toBeLessThan(rightCalls[0]!.address);
          expect(suffix).toHaveLength(mode === "terminal" ? 0 : 1);
          if (mode !== "terminal") requireWrite(instructions, 0xc014, 11);
          if (mode === "terminal")
            expect(instructions.some((instruction) => instruction.opcode === 0x60)).toBe(false);
          else expect(instructions.some((instruction) => instruction.opcode === 0x60)).toBe(true);
        }
        // Source effects disappear only when every finite alternative is nonreturning.
        expect(sourceInstructions(artifacts, source, "poke($c014, 11);").length > 0).toBe(
          mode !== "terminal",
        );
        if (mode === "terminal") {
          expect(sourceInstructions(artifacts, source, "setNMI(&C);")).toHaveLength(0);
          expect(sourceInstructions(artifacts, source, "restoreNMI();")).toHaveLength(0);
        }
        requireLoadedAccounting(artifacts);
      },
      30_000,
    );
  }
});
