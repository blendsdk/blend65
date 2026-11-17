import { buildProject } from "@blend65/compiler";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  readProfileArtifacts,
} from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
const counterSource = `module Game;
function main():void {
  let counter:byte=0;
  while(true){poke($D005,counter+21);counter+=1;}
}`;

/** Reject malformed evidence rather than allowing missing values to look like zero costs. */
function natural(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("Expected a nonnegative integer in public build evidence");
  return value;
}

/** Public CPU intervals have exclusive ends; device projections are not executable bytes. */
function codeIntervals(memory: Record<string, unknown>) {
  const intervals = profileRecords(memory.intervals).filter(
    (item) => item.addressSpaceId === "cpu16" && item.kind === "code",
  );
  expect(intervals.length).toBeGreaterThan(0);
  return intervals.map((item) => {
    const start = natural(item.start);
    const end = natural(item.end);
    expect(end).toBeGreaterThan(start);
    expect(end).toBeLessThanOrEqual(65536);
    expect(natural(item.size)).toBe(end - start);
    return { start, end };
  });
}

/** Search only CPU code, never coincidental instruction-shaped bytes in embedded assets. */
function codeBytes(prg: Buffer, memory: Record<string, unknown>) {
  expect(prg.length).toBeGreaterThan(2);
  const loadAddress = prg.readUInt16LE(0);
  return codeIntervals(memory).map(({ start, end }) => {
    const first = start - loadAddress + 2;
    const last = end - loadAddress + 2;
    expect(first).toBeGreaterThanOrEqual(2);
    expect(last).toBeLessThanOrEqual(prg.length);
    return prg.subarray(first, last);
  });
}

/** Retain every instruction so an intervening operation cannot disappear from the adjacency check. */
function instructions(assembly: string): string[] {
  return assembly
    .split(/\r?\n/u)
    .map((line) => line.split(";", 1)[0]?.trim() ?? "")
    .filter((line) => /^[a-z]{3}(?:\s|$)/u.test(line))
    .map((line) => line.replace(/\s+/gu, " "));
}

/** Check the arithmetic core independently in assembly text and assembled CPU bytes. */
function expectDirectWrite(
  assembly: string,
  prg: Buffer,
  memory: Record<string, unknown>,
  constant: number,
  address: number,
  count: number,
) {
  const hex = (value: number, width: number) => value.toString(16).padStart(width, "0");
  const lines = instructions(assembly);
  const writes = lines.flatMap((line, index) =>
    line === `sta $${hex(address, 4)}` ? [index] : [],
  );
  expect(writes).toHaveLength(count);
  for (const index of writes) {
    expect(lines.slice(index - 2, index)).toEqual(["clc", `adc #$${hex(constant, 2)}`]);
    expect(lines[index - 3]).toMatch(/^lda \$[0-9a-f]{4}$/u);
  }
  const core = Buffer.from([0x18, 0x69, constant, 0x8d, address & 255, address >>> 8]);
  const occurrences = codeBytes(prg, memory).reduce((total, bytes) => {
    let found = 0;
    for (let offset = 0; offset <= bytes.length - core.length; offset += 1)
      if (bytes.subarray(offset, offset + core.length).equals(core)) found += 1;
    return total + found;
  }, 0);
  expect(occurrences).toBe(count);
}

describe("public anonymous byte-write output", () => {
  it.each(profiles)(
    "should directly write a runtime byte sum in canonical none for %s",
    async (profile) => {
      const artifacts = await buildProfileSource(counterSource, profile, "none");
      expectDirectWrite(artifacts.assembly, artifacts.prg, artifacts.memory, 21, 0xd005, 1);
    },
    120_000,
  );

  it.each([1, 255])(
    "should preserve explicit carry establishment for addition by %s",
    async (constant) => {
      const artifacts = await buildProfileSource(
        counterSource.replace("counter+21", `counter+${constant}`),
        profiles[0],
        "none",
      );
      expectDirectWrite(artifacts.assembly, artifacts.prg, artifacts.memory, constant, 0xd005, 1);
    },
    120_000,
  );

  const fallbacks = [
    [
      "returning source",
      "module Game; function main():void{let counter:byte=peek($D012);poke($D005,counter+21);}",
    ],
    [
      "signed source",
      "module Game; function main():void{let counter:sbyte=0;while(true){poke($D005,byte(counter+21));counter+=1;}}",
    ],
    [
      "word source",
      "module Game; function main():void{let counter:word=0;while(true){poke($D005,lo(counter+21));counter+=1;}}",
    ],
    ["subtraction", counterSource.replace("counter+21", "counter-21")],
    ["zero right operand", counterSource.replace("counter+21", "counter+0")],
    ["runtime right operand", counterSource.replace("counter+21", "counter+peek($D012)")],
    [
      "dynamic address",
      counterSource.replace("poke($D005,counter+21)", "poke(word(counter)+$D000,counter+21)"),
    ],
    [
      "named source store",
      counterSource.replace("poke($D005,counter+21);", "counter=counter+21;poke($D005,counter);"),
    ],
    [
      "helper",
      "module Game; function sample():byte{return peek($D012);} function main():void{let counter:byte=0;while(true){counter=sample();poke($D005,counter+21);counter+=1;}}",
    ],
    [
      "initializer",
      "module Game; let seed:byte=peek($D012); function main():void{let counter:byte=seed;while(true){poke($D005,counter+21);counter+=1;}}",
    ],
    [
      "IRQ",
      "module Game; import {setIRQ} from c64.system; interrupt function observe():void{poke($D020,1);} function main():void{let counter:byte=0;setIRQ(&observe);while(true){poke($D005,counter+21);counter+=1;}}",
    ],
    [
      "raw home observer",
      counterSource.replace("counter+=1;", "poke($D007,peek($2455));counter+=1;"),
    ],
    [
      "address escape",
      "module Game; function main():void{let counter:byte=0;let address:word=word(&counter);while(true){poke($D005,counter+21);poke($D007,peek(address));counter+=1;}}",
    ],
    ["CIA routing write", counterSource.replace("counter+=1;", "poke($DD00,0);counter+=1;")],
    ["firmware workspace write", counterSource.replace("counter+=1;", "poke($00D1,0);counter+=1;")],
  ] as const;
  it.each(fallbacks)(
    "should continue accepting ordinary %s without a source workaround",
    async (_name, text) => {
      const artifacts = await buildProfileSource(text, profiles[0], "none");
      expect(artifacts.prg.length).toBeGreaterThan(2);
      if (_name !== "dynamic address")
        expect(
          instructions(artifacts.assembly).filter((line) => line === "sta $d005").length,
        ).toBeGreaterThan(0);
    },
    120_000,
  );

  it("should reduce complete real-boing code while preserving poll, startup, assets and resource bounds", async () => {
    const root = await mkdtemp(join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "byte-write-boing-"));
    try {
      const example = fileURLToPath(new URL("../../examples/boing-ball/", import.meta.url));
      await mkdir(join(root, "src"));
      await mkdir(join(root, "assets"));
      await copyFile(join(example, "src/main.blend"), join(root, "src/main.blend"));
      await copyFile(join(example, "assets/ball.bin"), join(root, "assets/ball.bin"));
      await copyFile(join(example, "blend65.json"), join(root, "blend65.json"));
      const result = await buildProject({
        project: join(root, "blend65.json"),
        target: profiles[0],
        optimization: "none",
      });
      expect(result.kind).toBe("success");
      if (result.kind !== "success") throw new Error("Real boing build failed");
      const artifacts = await readProfileArtifacts(result);
      expectDirectWrite(artifacts.assembly, artifacts.prg, artifacts.memory, 21, 0xd005, 2);
      expectDirectWrite(artifacts.assembly, artifacts.prg, artifacts.memory, 21, 0xd007, 2);
      const entries = profileRecords(artifacts.costs.entries).filter(
        (entry) => entry.accounting === "program",
      );
      expect(entries.length).toBeGreaterThan(0);
      const sum = (component: string) =>
        entries
          .filter((entry) => entry.component === component)
          .reduce((total, entry) => total + natural(entry.bytes), 0);
      expect(sum("code")).toBeLessThan(1309);
      expect(sum("asset")).toBe(1024);
      expect(sum("startup")).toBe(12);
      expect(sum("helper")).toBe(0);
      const totals = profileRecord(artifacts.costs.totals);
      expect(natural(totals.programBytes)).toBe(7167);
      expect(artifacts.prg.length - 2).toBe(7167);
      expect(entries.reduce((total, entry) => total + natural(entry.bytes), 0)).toBe(7167);
      expect(sum("code") + sum("asset") + sum("startup") + sum("padding") + sum("helper")).toBe(
        7167,
      );
      const cpu = profileRecords(artifacts.memory.intervals).filter(
        (interval) => interval.addressSpaceId === "cpu16",
      );
      for (const [id, size] of [
        ["code.startup.entry", 326],
        ["platform.startup-state", 49],
      ] as const) {
        const matches = cpu.filter((interval) => interval.id === id);
        expect(matches).toHaveLength(1);
        const interval = matches[0];
        if (!interval) throw new Error(`Missing interval ${id}`);
        expect(natural(interval.end) - natural(interval.start)).toBe(size);
        expect(natural(interval.size)).toBe(size);
      }
      const resources = profileRecords(totals.resources);
      for (const [id, limit] of [
        ["zeroPage", 0],
        ["scratch", 0],
        ["residentRam", 7271],
      ] as const) {
        const resource = resources.filter((item) => item.id === id);
        expect(resource).toHaveLength(1);
        expect(natural(resource[0]?.value)).toBeLessThanOrEqual(limit);
      }
      const poll = instructions(artifacts.assembly).join("\n");
      expect(poll).toMatch(/lda \$d012\neor #\$fb\nbne [^\n]+/u);
      // LDA absolute, EOR immediate and the short branch retain seven bytes and nine taken cycles.
      expect(
        codeBytes(artifacts.prg, artifacts.memory).some((bytes) => {
          for (let offset = 0; offset + 7 <= bytes.length; offset += 1) {
            if (
              bytes
                .subarray(offset, offset + 6)
                .equals(Buffer.from([0xad, 0x12, 0xd0, 0x49, 0xfb, 0xd0]))
            )
              return true;
          }
          return false;
        }),
      ).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 120_000);
});
