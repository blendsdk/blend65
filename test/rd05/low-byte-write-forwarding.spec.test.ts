import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  readProfileArtifacts,
} from "./profile-fixture.js";

const PROFILES = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
const SOURCE = `module Game; function main():void {
  let value:word=$12A5;
  while(true){value=value+257;poke($D005,lo(value));}
}`;
type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;

/** Reject missing report fields instead of turning absent evidence into a zero cost. */
function numberField(record: Record<string, unknown>, name: string): number {
  const value = record[name];
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    throw new Error(`Missing or noninteger report field: ${name}`);
  return value;
}

/** CPU projections are aliases, not additional resident objects or executable bytes. */
function cpuIntervals(artifacts: Artifacts) {
  const intervals = profileRecords(artifacts.memory.intervals).filter(
    (interval) => interval.addressSpaceId === "cpu16",
  );
  expect(intervals.length).toBeGreaterThan(0);
  for (const interval of intervals) {
    expect(numberField(interval, "end") - numberField(interval, "start")).toBe(
      numberField(interval, "size"),
    );
    expect(numberField(interval, "size")).toBeGreaterThanOrEqual(0);
  }
  return intervals;
}

/** Read only declared CPU code ranges, never assets that happen to resemble opcodes. */
function codeSegments(artifacts: Artifacts) {
  const origin = artifacts.prg.readUInt16LE(0);
  const intervals = cpuIntervals(artifacts).filter((interval) => interval.kind === "code");
  expect(intervals.length).toBeGreaterThan(0);
  return intervals
    .map((interval) => {
      const start = numberField(interval, "start");
      const end = numberField(interval, "end");
      expect(start).toBeGreaterThanOrEqual(origin);
      expect(end - origin + 2).toBeLessThanOrEqual(artifacts.prg.length);
      return { start, bytes: artifacts.prg.subarray(start - origin + 2, end - origin + 2) };
    })
    .sort((left, right) => left.start - right.start);
}

/** Preserve instruction adjacency while ignoring assembler labels, directives and comments. */
function instructions(assembly: string) {
  return assembly.split(/\r?\n/).flatMap((line) => {
    const text = line.split(";")[0]?.trim() ?? "";
    const match = /^(?:[^\s:]+:\s*)?([a-z]{3})(?:\s+(.+))?$/i.exec(text);
    return match?.[1]
      ? [
          {
            opcode: match[1].toLowerCase(),
            operand: (match[2] ?? "").replace(/\s+/g, "").toLowerCase(),
          },
        ]
      : [];
  });
}

/** Accept ordinary assembler numeric spellings without depending on display formatting. */
function numericOperand(operand: string): number | undefined {
  if (/^\$[0-9a-f]+$/i.test(operand)) return Number.parseInt(operand.slice(1), 16);
  if (/^0x[0-9a-f]+$/i.test(operand)) return Number.parseInt(operand.slice(2), 16);
  if (/^\d+$/.test(operand)) return Number(operand);
  return undefined;
}

/** Independently require direct named loads in assembly and direct LDA/STA CPU bytes. */
function requireDirectWrites(
  artifacts: Artifacts,
  targets: readonly number[],
  expectedCount: number,
) {
  const assembly = instructions(artifacts.assembly);
  const assemblyWrites = assembly.flatMap((instruction, index) =>
    instruction.opcode === "sta" && targets.includes(numericOperand(instruction.operand) ?? -1)
      ? [index]
      : [],
  );
  expect(assemblyWrites).toHaveLength(expectedCount);
  const expectedOrder = Array.from(
    { length: expectedCount },
    (_unused, index) => targets[index % targets.length],
  );
  expect(assemblyWrites.map((index) => numericOperand(assembly[index]?.operand ?? ""))).toEqual(
    expectedOrder,
  );
  for (const index of assemblyWrites) {
    const load = assembly[index - 1];
    if (!load) throw new Error("Fixed write has no preceding instruction");
    expect(load.opcode).toBe("lda");
    expect(load.operand).not.toMatch(/^#/);
    expect(
      assembly.some(
        (instruction) => instruction.opcode === "sta" && instruction.operand === load.operand,
      ),
    ).toBe(true);
    expect(assembly[index - 2]).not.toEqual({ opcode: "sta", operand: load.operand });
  }
  const segments = codeSegments(artifacts);
  const homes: number[] = [];
  const writes: number[] = [];
  for (const { bytes } of segments) {
    for (let index = 0; index + 2 < bytes.length; index++) {
      if (bytes[index] !== 0x8d || !targets.includes(bytes.readUInt16LE(index + 1))) continue;
      let home: number;
      let loadStart: number;
      if (index >= 3 && bytes[index - 3] === 0xad) {
        home = bytes.readUInt16LE(index - 2);
        loadStart = index - 3;
      } else if (index >= 2 && bytes[index - 2] === 0xa5) {
        home = bytes[index - 1] ?? -1;
        loadStart = index - 2;
      } else throw new Error("Actual fixed write is not immediately preceded by a direct LDA");
      const residentWord = cpuIntervals(artifacts).some(
        (interval) =>
          interval.kind === "sfa" &&
          numberField(interval, "start") <= home &&
          numberField(interval, "end") > home + 1,
      );
      expect(residentWord).toBe(true);
      expect(
        loadStart >= 3 &&
          bytes[loadStart - 3] === 0x8d &&
          bytes.readUInt16LE(loadStart - 2) === home,
      ).toBe(false);
      expect(loadStart >= 2 && bytes[loadStart - 2] === 0x85 && bytes[loadStart - 1] === home).toBe(
        false,
      );
      for (const address of [home, home + 1]) {
        expect(
          segments.some(({ bytes: code }) => {
            for (let cursor = 0; cursor + 2 < code.length; cursor++)
              if (code[cursor] === 0x8d && code.readUInt16LE(cursor + 1) === address) return true;
            return false;
          }),
        ).toBe(true);
      }
      homes.push(home);
      writes.push(bytes.readUInt16LE(index + 1));
    }
  }
  expect(homes).toHaveLength(expectedCount);
  expect(writes).toEqual(expectedOrder);
  return new Set(homes);
}

/** Count fixed byte sequences only inside CPU code, with no asset-data matches. */
function countCodeSequence(artifacts: Artifacts, sequence: readonly number[]): number {
  let count = 0;
  for (const { bytes } of codeSegments(artifacts))
    for (let index = 0; index + sequence.length <= bytes.length; index++)
      if (sequence.every((value, offset) => bytes[index + offset] === value)) count++;
  return count;
}

/** Build a private copy so qualification cannot create output in the example tree. */
async function buildBoing(target: string): Promise<Artifacts> {
  const root = await mkdtemp(join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "low-byte-boing-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "assets"));
    await copyFile(
      new URL("../../examples/boing-ball/src/main.blend", import.meta.url),
      join(root, "src/main.blend"),
    );
    await copyFile(
      new URL("../../examples/boing-ball/assets/ball.bin", import.meta.url),
      join(root, "assets/ball.bin"),
    );
    const project = join(root, "blend65.json");
    await copyFile(new URL("../../examples/boing-ball/blend65.json", import.meta.url), project);
    const manifest = profileRecord(JSON.parse(await readFile(project, "utf8")));
    await writeFile(project, JSON.stringify({ ...manifest, target, optimization: "none" }));
    const built = await buildProject({ project });
    if (built.kind !== "success") throw new Error("Unchanged Boing source did not build");
    return await readProfileArtifacts(built);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Select an exact report identity; duplicate and missing records are both failures. */
function unique(records: readonly Record<string, unknown>[], id: string) {
  const matches = records.filter((record) => record.id === id);
  expect(matches, id).toHaveLength(1);
  const match = matches[0];
  if (!match) throw new Error(`Missing report identity: ${id}`);
  return match;
}

describe("low-byte fixed writes through public builds", () => {
  it.each(PROFILES)("emits a named-low LDA immediately followed by STA on %s", async (target) => {
    const artifacts = await buildProfileSource(SOURCE, target, "none");
    expect(requireDirectWrites(artifacts, [0xd005], 1).size).toBe(1);
  });

  it.each(PROFILES)("retains complete Boing behavior and resource bounds on %s", async (target) => {
    const artifacts = await buildBoing(target);
    const homes = requireDirectWrites(artifacts, [0xd000, 0xd002, 0xd004, 0xd006], 8);
    expect(homes.size).toBe(2);
    expect(countCodeSequence(artifacts, [0xad, 0x12, 0xd0, 0x49, 0xfb, 0xd0, 0xf9])).toBe(1);
    const assembly = instructions(artifacts.assembly);
    expect(
      assembly.filter(
        (instruction, index) =>
          instruction.opcode === "lda" &&
          numericOperand(instruction.operand) === 0xd012 &&
          assembly[index + 1]?.opcode === "eor" &&
          numericOperand(assembly[index + 1]?.operand.replace(/^#/, "") ?? "") === 251 &&
          assembly[index + 2]?.opcode === "bne",
      ),
    ).toHaveLength(1);

    // High-byte branch values still need their own captures; low-byte forwarding cannot absorb them.
    let highCaptures = 0;
    for (const { bytes } of codeSegments(artifacts)) {
      for (let index = 0; index + 8 < bytes.length; index++) {
        if (
          bytes[index] === 0xad &&
          homes.has(bytes.readUInt16LE(index + 1) - 1) &&
          bytes[index + 3] === 0x8d &&
          bytes[index + 6] === 0xad &&
          bytes.readUInt16LE(index + 4) === bytes.readUInt16LE(index + 7)
        )
          highCaptures++;
      }
    }
    expect(highCaptures).toBe(4);
    const intervals = cpuIntervals(artifacts);
    expect(numberField(unique(intervals, "code.startup.entry"), "size")).toBe(326);
    expect(numberField(unique(intervals, "platform.startup-state"), "size")).toBe(49);
    const sfa = intervals.filter((interval) => interval.kind === "sfa");
    expect(sfa.length).toBeGreaterThan(0);
    expect(
      sfa.reduce((total, interval) => total + numberField(interval, "size"), 0),
    ).toBeLessThanOrEqual(37);

    const entries = profileRecords(artifacts.costs.entries).filter(
      (entry) => entry.accounting === "program",
    );
    expect(entries.length).toBeGreaterThan(0);
    const componentBytes = (component: string) => {
      const matches = entries.filter((entry) => entry.component === component);
      expect(matches.length, component).toBeGreaterThan(0);
      return matches.reduce((total, entry) => total + numberField(entry, "bytes"), 0);
    };
    expect(componentBytes("code")).toBeLessThan(1241);
    expect(componentBytes("asset")).toBe(1024);
    expect(componentBytes("startup")).toBe(12);
    expect(entries.reduce((total, entry) => total + numberField(entry, "bytes"), 0)).toBe(7167);
    const totals = profileRecord(artifacts.costs.totals);
    expect(numberField(totals, "programBytes")).toBe(7167);
    expect(artifacts.prg.length - 2).toBe(7167);
    const resources = profileRecords(totals.resources);
    expect(numberField(unique(resources, "zeroPage"), "value")).toBe(0);
    expect(numberField(unique(resources, "scratch"), "value")).toBe(0);
    expect(numberField(unique(resources, "residentRam"), "value")).toBeLessThanOrEqual(7253);
  });

  it.each([
    [
      "helper",
      `module Game; function sample():byte{return peek($D012);} function main():void{let value:word=$12A5;while(true){poke($D005,lo(value));value=word(sample());}}`,
    ],
    [
      "initializer",
      `module Game; let seed:byte=peek($D012); function main():void{let value:word=word(seed);while(true){poke($D005,lo(value));value+=257;}}`,
    ],
    [
      "IRQ",
      `module Game; import {setIRQ} from c64.system; interrupt function observe():void{poke($D020,1);} function main():void{let value:word=$12A5;setIRQ(&observe);while(true){poke($D005,lo(value));value+=257;}}`,
    ],
    [
      "address escape",
      `module Game; function main():void{let value:word=$12A5;let address:word=word(&value);while(true){poke($D005,lo(value));poke($D007,peek(address));value+=257;}}`,
    ],
    [
      "raw private-window access",
      SOURCE.replace("poke($D005,lo(value));", "poke($D005,lo(value));poke($D007,peek($2455));"),
    ],
    [
      "CIA routing",
      SOURCE.replace("poke($D005,lo(value));", "poke($D005,lo(value));poke($DD00,0);"),
    ],
    [
      "firmware workspace",
      SOURCE.replace("poke($D005,lo(value));", "poke($D005,lo(value));poke($00D1,0);"),
    ],
    [
      "returning main",
      `module Game; function main():void{let value:word=$12A5;poke($D005,lo(value));return;}`,
    ],
  ])("continues to build valid unsupported %s source", async (_name, source) => {
    const artifacts = await buildProfileSource(source, PROFILES[0], "none");
    expect(artifacts.prg.length).toBeGreaterThan(2);
  });
});
