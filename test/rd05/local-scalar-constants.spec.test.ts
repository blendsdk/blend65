import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;

/** Require reconciled, nonempty physical intervals before using their addresses. */
function intervals(artifacts: Artifacts) {
  expect(artifacts.memory.acmeReconciled).toBe(true);
  return profileRecords(artifacts.memory.intervals).map((interval) => {
    const { start, end } = interval;
    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end <= start ||
      end > 0x10000
    )
      throw new Error("Expected a nonempty half-open byte address interval");
    expect(interval.size).toBe(end - start);
    return { ...interval, start, end };
  });
}

/** Scalar constants cannot acquire a local home or expression scratch allocation. */
function expectNoFunctionStorage(artifacts: Artifacts) {
  expect(
    intervals(artifacts).filter((interval) =>
      ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)),
    ),
  ).toEqual([]);
}

/** Slice the complete routine from real PRG bytes using its published source owner. */
function functionBytes(artifacts: Artifacts, qualifiedName: string) {
  const code = intervals(artifacts).filter((interval) => {
    if (interval.kind !== "code") return false;
    const owner = profileRecord(interval.owner);
    return owner.kind === "function" && owner.id === qualifiedName;
  });
  expect(code).toHaveLength(1);
  const interval = code[0];
  if (interval === undefined) throw new Error("Missing complete routine interval");
  expect(artifacts.prg.length).toBeGreaterThanOrEqual(2);
  const loadAddress = artifacts.prg.readUInt16LE(0);
  const start = 2 + interval.start - loadAddress;
  const end = 2 + interval.end - loadAddress;
  expect(start).toBeGreaterThanOrEqual(2);
  expect(end).toBeLessThanOrEqual(artifacts.prg.length);
  return [...artifacts.prg.subarray(start, end)];
}

/** Each immediate load and absolute store is five bytes/six cycles; RTS adds one/six. */
function immediateWrites(writes: readonly (readonly [number, number])[]) {
  return [
    ...writes.flatMap(([address, value]) => [0xa9, value, 0x8d, address & 0xff, address >>> 8]),
    0x60,
  ];
}

describe.sequential.each(profiles)("local scalar constants on %s", (profile) => {
  // Every scalar use substitutes its value, including signed bits and little-endian words.
  it("should inline used integer and enum constants without declaration traffic or homes", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
       enum Choice { FIRST = 72, SECOND }
       function sample(): void {
         const ADDRESS: word = $c000;
         const OCTET: byte = $96;
         const SIGNED_OCTET: sbyte = -37;
         const PAIR: word = $1234;
         const SIGNED_PAIR: sword = -4660;
         const SELECTED: Choice = Choice.SECOND;
         poke(ADDRESS, OCTET);
         poke($c001, byte(SIGNED_OCTET));
         pokew($c002, PAIR);
         pokew($c004, word(SIGNED_PAIR));
         poke($c006, SELECTED);
         poke($c007, OCTET);
       }
       function main(): void { sample(); }`,
      profile,
    );
    expectNoFunctionStorage(artifacts);
    expect(functionBytes(artifacts, "src/game.blend::Game.sample")).toEqual(
      immediateWrites([
        [0xc000, 0x96],
        [0xc001, 0xdb],
        [0xc002, 0x34],
        [0xc003, 0x12],
        [0xc004, 0xcc],
        [0xc005, 0xed],
        [0xc006, 73],
        [0xc007, 0x96],
      ]),
    );
  });

  // Declaring constants, including boolean aliases, never requires runtime initialization.
  it("should emit only a return for unused scalar declarations and compile-time boolean aliases", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
       enum Choice { FIRST = 72, SECOND }
       function sample(): void {
         const OCTET: byte = 150;
         const SIGNED_OCTET: sbyte = -37;
         const PAIR: word = $1234;
         const SIGNED_PAIR: sword = -4660;
         const ENABLED: boolean = true;
         const COPY: boolean = ENABLED;
         const DISABLED: boolean = false;
         const SELECTED: Choice = Choice.SECOND;
       }
       function main(): void { sample(); }`,
      profile,
    );
    expectNoFunctionStorage(artifacts);
    expect(functionBytes(artifacts, "src/game.blend::Game.sample")).toEqual([0x60]);
  });

  // A child initializer sees the outer binding; leaving each block restores that binding.
  it("should substitute the nearest constant and restore outer constants after nested blocks", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
       function sample(): void {
         const VALUE: byte = 9;
         poke($c000, VALUE);
         {
           const VALUE: byte = VALUE + 1;
           poke($c001, VALUE);
           {
             const VALUE: byte = 71;
             poke($c002, VALUE);
           }
           poke($c003, VALUE);
         }
         poke($c004, VALUE);
       }
       function main(): void { sample(); }`,
      profile,
    );
    expectNoFunctionStorage(artifacts);
    expect(functionBytes(artifacts, "src/game.blend::Game.sample")).toEqual(
      immediateWrites([
        [0xc000, 9],
        [0xc001, 10],
        [0xc002, 71],
        [0xc003, 10],
        [0xc004, 9],
      ]),
    );
  });

  // Addressable mutable initialization must keep storage and ordered volatile source effects.
  it("should preserve addressable mutable storage and initialization read/write order", async () => {
    await withProfileProject(
      `module Game;
       function sample(): void {
         let value: byte = peek($c010);
         poke($c020, peek(word(&value)));
         value = peek($c011);
         poke($c021, peek(word(&value)));
       }
       function main(): void { sample(); }`,
      profile,
      async (project) => {
        const built = await buildProject({ project, optimization: "none" });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const artifacts = await readProfileArtifacts(built);
        const storage = intervals(artifacts).filter((interval) =>
          ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)),
        );
        expect(
          storage.reduce((total, interval) => total + interval.end - interval.start, 0),
        ).toBeGreaterThan(0);

        const bytes = Buffer.from(functionBytes(artifacts, "src/game.blend::Game.sample"));
        let previous = -3;
        for (const access of [
          [0xad, 0x10, 0xc0],
          [0x8d, 0x20, 0xc0],
          [0xad, 0x11, 0xc0],
          [0x8d, 0x21, 0xc0],
        ]) {
          // Compare actual absolute-access bytes without fixing intervening home traffic.
          const instruction = Buffer.from(access);
          const position = bytes.indexOf(instruction);
          expect(position).toBeGreaterThanOrEqual(previous + instruction.length);
          expect(bytes.indexOf(instruction, position + instruction.length)).toBe(-1);
          previous = position;
        }
        expect(bytes.at(-1)).toBe(0x60);

        const sample = intervals(artifacts).find((interval) => {
          if (interval.kind !== "code") return false;
          const owner = profileRecord(interval.owner);
          return owner.kind === "function" && owner.id === "src/game.blend::Game.sample";
        });
        if (sample === undefined) throw new Error("Missing measured routine entry");
        const suffix = Buffer.from("startup.restore").toString("hex");
        const restoreLabels = [
          ...artifacts.labels.matchAll(
            new RegExp(`\\bb65_[A-Za-z0-9_]+_${suffix}\\s*=\\s*\\$([0-9a-fA-F]+)\\b`, "gu"),
          ),
        ];
        expect(restoreLabels).toHaveLength(1);
        const restore = Number.parseInt(restoreLabels[0]![1]!, 16);
        expect(restore).toBeGreaterThanOrEqual(0);
        expect(restore).toBeLessThan(0x10000);

        const vice = await startVice(
          join(built.generation.directory, built.generation.primaryArtifact),
          100_000_000,
          profile,
        );
        if ("kind" in vice) throw new Error(vice.reason);
        const checkpoints: number[] = [];
        try {
          const entryCheckpoint = await vice.monitor.setExecuteCheckpoint(sample.start);
          checkpoints.push(entryCheckpoint);
          const entryStop = vice.monitor.waitForStop(30_000);
          await vice.monitor.resume();
          expect(await entryStop).toBe(sample.start);
          await vice.monitor.writeMemory(0xc010, new Uint8Array([0x13, 0xe3]));
          await vice.monitor.deleteCheckpoint(entryCheckpoint);
          checkpoints.pop();
          checkpoints.push(await vice.monitor.setExecuteCheckpoint(restore));
          const returnStop = vice.monitor.waitForStop(30_000);
          await vice.monitor.resume();
          expect(await returnStop).toBe(restore);
          expect([...(await vice.monitor.readMemory(0xc020, 0xc021))]).toEqual([0x13, 0xe3]);
        } finally {
          try {
            for (const checkpoint of checkpoints) await vice.monitor.deleteCheckpoint(checkpoint);
          } finally {
            await stopVice(vice);
          }
        }
      },
    );
  }, 90_000);
});
