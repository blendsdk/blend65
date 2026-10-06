import { describe, expect, it } from "vitest";
import { buildProject, checkProject } from "@blend65/compiler";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const PROFILES = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];

/** One decoded instruction, with its actual linked operand bytes. */
interface Instruction {
  readonly address: number;
  readonly opcode: number;
  readonly operand: number;
  readonly bytes: readonly number[];
}

/** A public source-associated entry and the final machine ranges it owns. */
interface Entry {
  readonly address: number;
  readonly ranges: readonly { start: number; end: number }[];
  /** Only main may hand normal completion to this independently owned platform range. */
  readonly restore?: { start: number; end: number };
}

/** Fail on missing public numeric evidence rather than coercing it. */
function number(value: unknown): number {
  expect(typeof value).toBe("number");
  if (typeof value !== "number") throw new TypeError("Missing numeric evidence");
  return value;
}

/** Resolve native ACME labels without depending on compiler-generated symbol names. */
function labels(text: string): Map<string, number> {
  return new Map(
    [...text.matchAll(/^\s*(\S+)\s*=\s*\$([\da-f]+)\b/gim)].map((match) => [
      match[1]!,
      Number.parseInt(match[2]!, 16),
    ]),
  );
}

/** Corroborate the exact native restore identity and its generated platform-owned range. */
function restoreRange(debug: Record<string, unknown>, symbols: Map<string, number>) {
  // The native label's identity suffix is injective; its readable hint is not authoritative.
  const suffix = `_${Buffer.from("startup.restore", "utf8").toString("hex")}`;
  const matches = [...symbols].filter(([label]) => label.endsWith(suffix));
  expect(matches).toHaveLength(1);
  const start = number(matches[0]?.[1]);
  const ranges = profileRecords(debug.ranges).filter(
    (range) => profileRecord(range.machine).start === start,
  );
  expect(ranges).toHaveLength(1);
  const range = ranges[0]!;
  expect(profileRecord(range.owner)).toMatchObject({ kind: "platform", name: "startup" });
  expect(profileRecord(range.origin)).toMatchObject({ kind: "generated", cause: "startup" });
  const machine = profileRecord(range.machine);
  const cpu = profileRecords(debug.addressSpaces).findIndex(
    (space) => space.id === "cpu16" && space.kind === "cpu",
  );
  expect(cpu).toBeGreaterThanOrEqual(0);
  expect(machine.addressSpaceIndex).toBe(cpu);
  const end = number(machine.end);
  expect(end).toBeGreaterThan(start);
  return { start, end };
}

/** Associate entries through the public function inventory and independently check ownership. */
function entries(
  debug: Record<string, unknown>,
  symbols: Map<string, number>,
  name: string,
): Entry[] {
  const functions = profileRecords(debug.functions);
  const functionIndex = functions.findIndex(
    (fn) => fn.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(functionIndex, `Source function ${name} must remain materialized`).toBeGreaterThanOrEqual(
    0,
  );
  const fn = functions[functionIndex];
  if (fn === undefined) throw new Error(`Missing source function ${name}`);
  const ranges = profileRecords(debug.ranges);
  const restore = name === "main" ? restoreRange(debug, symbols) : undefined;
  const result = profileRecords(fn.entryVariants).map((variant) => {
    expect(typeof variant.label).toBe("string");
    const address = symbols.get(String(variant.label));
    expect(address, `Entry label for ${name} must be assembled`).toBeDefined();
    expect(Array.isArray(variant.rangeIndexes)).toBe(true);
    const indexes = variant.rangeIndexes;
    if (!Array.isArray(indexes)) throw new Error("Missing entry ranges");
    const machineRanges = indexes.map((index: unknown) => {
      const range = ranges[number(index)];
      if (range === undefined) throw new Error("Missing machine range");
      expect(profileRecord(range.owner)).toMatchObject({ kind: "function", functionIndex });
      const machine = profileRecord(range.machine);
      return { start: number(machine.start), end: number(machine.end) };
    });
    expect(machineRanges.length).toBeGreaterThan(0);
    return { address: number(address), ranges: machineRanges, restore };
  });
  expect(result.length).toBeGreaterThan(0);
  return result;
}

/** Decode only documented operations needed by this straight-line source witness. */
function instructions(prg: Buffer, entry: Entry): Instruction[] {
  const load = prg.readUInt16LE(0);
  const one = new Set([
    0x08, 0x28, 0x40, 0x48, 0x60, 0x68, 0x78, 0x8a, 0x98, 0x9a, 0xaa, 0xa8, 0xd8, 0xea,
  ]);
  const two = new Set([0x09, 0x29, 0x84, 0x85, 0x86, 0xa0, 0xa2, 0xa4, 0xa5, 0xa6, 0xa9]);
  const three = new Set([0x20, 0x4c, 0x6c, 0x8c, 0x8d, 0x8e, 0xac, 0xad, 0xae]);
  const result: Instruction[] = [];
  let address = entry.address;
  const visited = new Set<number>();
  while (!visited.has(address)) {
    visited.add(address);
    const range = entry.ranges.find((range) => range.start <= address && address < range.end);
    expect(range).toBeDefined();
    const offset = address - load + 2;
    expect(offset).toBeGreaterThanOrEqual(2);
    expect(offset).toBeLessThan(prg.length);
    const opcode = prg[offset]!;
    const size = one.has(opcode) ? 1 : two.has(opcode) ? 2 : three.has(opcode) ? 3 : 0;
    expect(
      size,
      `Unexpected opcode $${opcode.toString(16)} at $${address.toString(16)}`,
    ).toBeGreaterThan(0);
    if (size === 0) throw new Error("Unsupported instruction in source witness");
    expect(address + size).toBeLessThanOrEqual(range!.end);
    const bytes = [...prg.subarray(offset, offset + size)];
    expect(bytes.length).toBe(size);
    result.push({
      address,
      opcode,
      operand: size === 3 ? bytes[1]! | (bytes[2]! << 8) : (bytes[1] ?? 0),
      bytes,
    });
    if ([0x40, 0x60, 0x6c].includes(opcode)) {
      expect(entry.restore, "Main must exit through its proved platform restore").toBeUndefined();
      return result;
    }
    if (
      opcode === 0x4c &&
      entry.restore !== undefined &&
      result.at(-1)!.operand === entry.restore.start
    ) {
      expect(address + size).toBe(Math.max(...entry.ranges.map((range) => range.end)));
      expect(
        entry.ranges.some(
          (range) => range.start <= entry.restore!.start && entry.restore!.start < range.end,
        ),
      ).toBe(false);
      const platform = instructions(prg, { address: entry.restore.start, ranges: [entry.restore] });
      // Restoration must decode the entire platform block, not merely reach any RTS byte.
      expect(platform.flatMap((instruction) => instruction.bytes)).toHaveLength(
        entry.restore.end - entry.restore.start,
      );
      expect(platform.slice(-2).map((instruction) => instruction.opcode)).toEqual([0x28, 0x60]);
      expect(platform.at(-1)!.address + 1).toBe(entry.restore.end);
      return result;
    }
    // An explicit placement adapter may jump to the complete entry within its owned ranges.
    address = opcode === 0x4c ? result.at(-1)!.operand : address + size;
  }
  throw new Error("Entry never reaches its declared terminal");
}

/** Follow register values through capture/publication, without simulating external execution. */
function stores(code: readonly Instruction[]) {
  const registers = new Map<string, string>();
  const loads = new Map<number, string>([
    [0xad, "A"],
    [0xa5, "A"],
    [0xae, "X"],
    [0xa6, "X"],
    [0xac, "Y"],
    [0xa4, "Y"],
  ]);
  const immediates = new Map<number, string>([
    [0xa9, "A"],
    [0xa2, "X"],
    [0xa0, "Y"],
  ]);
  const writes = new Map<number, string>([
    [0x8d, "A"],
    [0x85, "A"],
    [0x8e, "X"],
    [0x86, "X"],
    [0x8c, "Y"],
    [0x84, "Y"],
  ]);
  const result: { address: number; value: string | undefined; index: number }[] = [];
  for (const [index, instruction] of code.entries()) {
    const load = loads.get(instruction.opcode);
    const immediate = immediates.get(instruction.opcode);
    const write = writes.get(instruction.opcode);
    if (load !== undefined) registers.set(load, `memory:${instruction.operand}`);
    if (immediate !== undefined) registers.set(immediate, `value:${instruction.operand}`);
    if (write !== undefined)
      result.push({ address: instruction.operand, value: registers.get(write), index });
    if (instruction.opcode === 0x20) registers.clear();
    if (instruction.opcode === 0x68) registers.delete("A");
  }
  return result;
}

/** Require a single genuine terminal and return its linked saved-vector address. */
function link(code: readonly Instruction[]): number {
  expect(code.at(-1)?.opcode).toBe(0x6c);
  const address = code.at(-1)!.operand;
  expect(address & 0xff).toBeLessThanOrEqual(0xfe);
  return address;
}

/** Check coherent capture and high-byte-only publication/removal from the same two-byte word. */
function installation(code: readonly Instruction[], saved: number, installed: number) {
  expect(installed & 0xff).toBe(0x47);
  const effects = stores(code);
  expect(effects.filter((effect) => effect.address === 0x0318)).toEqual([]);
  const captures = effects.filter(
    (effect) => effect.address === saved || effect.address === saved + 1,
  );
  expect(
    captures
      .map(({ address, value }) => ({ address, value }))
      .sort((a, b) => a.address - b.address),
  ).toEqual([
    { address: saved, value: "memory:792" },
    { address: saved + 1, value: "memory:793" },
  ]);
  const publications = effects.filter((effect) => effect.address === 0x0319);
  expect(publications.map((effect) => effect.value)).toEqual([
    `value:${installed >> 8}`,
    `memory:${saved + 1}`,
  ]);
  expect(captures.at(-1)!.index).toBeLessThan(publications[0]!.index);
  expect(
    code.filter(
      (instruction) =>
        [0xad, 0xae, 0xac].includes(instruction.opcode) && instruction.operand === 0x0318,
    ),
  ).toHaveLength(1);
  expect(
    code.filter(
      (instruction) =>
        [0xad, 0xae, 0xac].includes(instruction.opcode) && instruction.operand === 0x0319,
    ),
  ).toHaveLength(1);
}

describe("source-retained raw handler installer output", () => {
  for (const target of PROFILES) {
    for (const body of ["", "poke($c012, $5a);"]) {
      it(`should retain the complete raw-only installer and ${body === "" ? "empty" : "store"} NMI entry on ${target}`, async () => {
        // Erasing Q's handler proof retains Q, its ordinary helper, and the helper's selected C entry.
        const source = `module Game;
import {setNMI,restoreNMI,setIRQ,restoreIRQ} from c64.system;
interrupt function B():void {}
interrupt function C():void {${body}}
function H():void {setNMI(&C);restoreNMI();}
interrupt function Q():void {H();}
function main():void {
  setNMI(&B);asm_php();asm_sei();asm_nop();setIRQ(&Q);
  pokew($c000,word(&Q));restoreIRQ();asm_plp();restoreNMI();
}`;
        await withProfileProject(source, target, async (project) => {
          const checked = await checkProject({ project });
          expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
          const built = await buildProject({ project, optimization: "none" });
          expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
          if (built.kind !== "success") throw new Error("Expected a complete public build");
          const artifacts = await readProfileArtifacts(built);
          expect(artifacts.debug.profileId).toBe(target);
          expect(artifacts.debug.optimization).toBe("none");
          expect(
            profileRecords(artifacts.debug.sources).some((item) => item.path === "src/game.blend"),
          ).toBe(true);
          const symbols = labels(artifacts.labels);
          const sourceEntries = (name: string) => entries(artifacts.debug, symbols, name);
          const decode = (entry: Entry) => instructions(artifacts.prg, entry);
          const rawEntries = sourceEntries("Q").filter(
            (entry) => decode(entry).at(-1)?.opcode === 0x40,
          );
          expect(rawEntries).toHaveLength(1);
          const raw = rawEntries[0]!;
          const rawCode = decode(raw);
          const calls = rawCode.filter((instruction) => instruction.opcode === 0x20);
          expect(calls).toHaveLength(1);
          const helpers = sourceEntries("H").filter((entry) => entry.address === calls[0]!.operand);
          expect(helpers).toHaveLength(1);
          const helper = helpers[0]!;
          const helperCode = decode(helper);
          expect(helperCode.at(-1)?.opcode).toBe(0x60);
          const normalization = rawCode.findIndex((instruction) => instruction.opcode === 0xd8);
          expect(normalization).toBeGreaterThanOrEqual(0);
          expect(normalization).toBeLessThan(rawCode.indexOf(calls[0]!));
          expect(rawCode.some((instruction) => [0x08, 0x28].includes(instruction.opcode))).toBe(
            false,
          );
          const selected = sourceEntries("C").filter(
            (entry) => decode(entry).at(-1)?.opcode === 0x6c,
          );
          expect(selected).toHaveLength(1);
          const c = selected[0]!;
          const cCode = decode(c);
          const saved = link(cCode);
          const bEntries = sourceEntries("B").filter(
            (entry) => decode(entry).at(-1)?.opcode === 0x6c,
          );
          expect(bEntries).toHaveLength(1);
          const b = bEntries[0]!;
          const outerSaved = link(decode(b));
          expect(
            [saved, saved + 1].some(
              (address) => address === outerSaved || address === outerSaved + 1,
            ),
          ).toBe(false);
          installation(helperCode, saved, c.address);
          const mainEntries = sourceEntries("main");
          expect(mainEntries).toHaveLength(1);
          const mainCode = decode(mainEntries[0]!);
          installation(mainCode, outerSaved, b.address);
          expect(
            mainCode.some(
              (instruction) =>
                instruction.opcode === 0x20 && instruction.operand === helper.address,
            ),
          ).toBe(false);
          const pointer = stores(mainCode).filter(
            (effect) => effect.address === 0xc000 || effect.address === 0xc001,
          );
          expect(pointer.map(({ address, value }) => ({ address, value }))).toEqual([
            { address: 0xc000, value: `value:${raw.address & 0xff}` },
            { address: 0xc001, value: `value:${raw.address >> 8}` },
          ]);
          // With no body effects, JMP preserves A/X/Y/P/D without redundant save or normalization bytes.
          const complete = cCode
            .filter((instruction) => instruction.opcode !== 0x4c)
            .flatMap((instruction) => instruction.bytes);
          const tail = [0x6c, saved & 0xff, saved >> 8];
          expect(complete).toEqual(
            body === ""
              ? tail
              : [0x08, 0x48, 0xd8, 0xa9, 0x5a, 0x8d, 0x12, 0xc0, 0x68, 0x28, ...tail],
          );
          // The store changes A and N/Z; restore A before PLP so the chained predecessor gets entry flags.
          expect(
            stores(cCode)
              .filter((effect) => effect.address === 0xc012)
              .map((effect) => effect.value),
          ).toEqual(body === "" ? [] : ["value:90"]);
          expect(cCode.some((instruction) => instruction.operand === 0xdd0d)).toBe(false);
        });
      });
    }
  }
});
