import { createHash } from "node:crypto";
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
import { libraryEntry, sourceLibraryProfiles } from "./source-library-fixture.js";

type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;
const EMPTY = "module Game; function main(): void {}";
const PURE = `module Game;
let result: byte = calculate(7);
function add(value: byte): byte { return value + 3; }
function calculate(value: byte): byte { return add(value); }
function main(): void { result = calculate(result); }`;
const STACK = `module Game;
function nested(): void { asm_php(); asm_sei(); asm_plp(); }
function main(): void { asm_php(); nested(); asm_plp(); }`;
const BORROWED = `module Game;
zeropage { workspace: byte[128]; }
function main(): void {
  asm_php(); asm_sei();
  ${Array.from({ length: 128 }, (_, index) => `workspace[${index}] = ${index + 32};`).join("\n")}
  asm_plp();
}`;
// BASIC retains conversion vectors, program/variable bounds and CHRGET code across SYS.
const LIVE_BASIC_RANGES = [
  [0x03, 0x06],
  [0x2b, 0x34],
  [0x37, 0x38],
  [0x73, 0x8a],
] as const;

function interval(artifacts: Artifacts, id: string) {
  const matches = profileRecords(artifacts.memory.intervals).filter((entry) => entry.id === id);
  expect(matches, id).toHaveLength(1);
  const value = matches[0]!;
  const { start, end, size } = value;
  if (typeof start !== "number" || typeof end !== "number" || typeof size !== "number")
    throw new TypeError("Startup intervals require complete numeric extents");
  expect(end - start).toBe(size);
  expect(size).toBeGreaterThan(0);
  return { start, end, size, owner: profileRecord(value.owner) };
}

// Documented NMOS addressing widths distinguish immediate data from memory operands.
const opcodes = (text: string) => new Set(text.split(" ").map((byte) => Number.parseInt(byte, 16)));
const single = opcodes(
  "08 0a 18 28 2a 38 40 48 4a 58 60 68 6a 78 88 8a 98 9a a8 aa b8 ba c8 ca d8 e8 ea f8",
);
const immediate = opcodes("09 29 49 69 a0 a2 a9 c0 c9 e0 e9");
const relative = opcodes("10 30 50 70 90 b0 d0 f0");
const zeroPage = opcodes(
  "05 06 15 16 24 25 26 35 36 45 46 55 56 65 66 75 76 84 85 86 94 95 96 a4 a5 a6 b4 b5 b6 c4 c5 c6 d5 d6 e4 e5 e6 f5 f6",
);
const indirect = opcodes("01 11 21 31 41 51 61 71 81 91 a1 b1 c1 d1 e1 f1");
const absolute = opcodes(
  "0d 0e 1d 1e 2c 2d 2e 3d 3e 4d 4e 5d 5e 6d 6e 7d 7e 8c 8d 8e 99 9d ac ad ae b9 bc bd be cc cd ce d9 dd de ec ed ee f9 fd fe",
);
const indexedAbsolute = opcodes("1d 1e 3d 3e 5d 5e 7d 7e 99 9d b9 bc bd be d9 dd de f9 fd fe");
const stores = opcodes("84 85 86 94 95 96 8c 8d 8e 99 9d 81 91");

function instructions(artifacts: Artifacts, id: string) {
  const range = interval(artifacts, id);
  const offset = 2 + range.start - artifacts.prg.readUInt16LE(0);
  expect(offset).toBeGreaterThanOrEqual(2);
  expect(offset + range.size).toBeLessThanOrEqual(artifacts.prg.length);
  const bytes = artifacts.prg.subarray(offset, offset + range.size);
  const result: { opcode: number; operand: number; indexed: boolean }[] = [];
  for (let index = 0; index < bytes.length; ) {
    const opcode = bytes[index]!;
    const wide = absolute.has(opcode) || [0x20, 0x4c, 0x6c].includes(opcode);
    const width = single.has(opcode)
      ? 1
      : wide
        ? 3
        : immediate.has(opcode) ||
            relative.has(opcode) ||
            zeroPage.has(opcode) ||
            indirect.has(opcode)
          ? 2
          : 0;
    expect(width, `Documented startup opcode at ${range.start + index}`).toBeGreaterThan(0);
    expect(index + width).toBeLessThanOrEqual(bytes.length);
    const operand =
      width === 3 ? bytes[index + 1]! | (bytes[index + 2]! << 8) : (bytes[index + 1] ?? 0);
    result.push({ opcode, operand, indexed: indexedAbsolute.has(opcode) });
    index += width;
  }
  return result;
}

function expectNoDisplayTraffic(artifacts: Artifacts) {
  for (const id of ["code.startup.entry", "code.startup.restore"]) {
    expect(interval(artifacts, id).owner).toEqual({ kind: "platform", id: "startup" });
    for (const instruction of instructions(artifacts, id)) {
      expect(indirect.has(instruction.opcode), "No unresolved startup data dereference").toBe(
        false,
      );
      if (!absolute.has(instruction.opcode) && instruction.opcode !== 0x6c) continue;
      const last = instruction.operand + (instruction.indexed ? 255 : 0);
      for (const [start, end] of [
        [0x0400, 0x07ff],
        [0xd000, 0xd3ff],
        [0xd800, 0xdbff],
      ])
        expect(instruction.operand > end! || last < start!, `Startup display access ${id}`).toBe(
          true,
        );
    }
  }
}

function expectRequiredPorts(artifacts: Artifacts) {
  const entry = instructions(artifacts, "code.startup.entry");
  const restore = instructions(artifacts, "code.startup.restore");
  const accesses = (list: typeof entry, address: number, write: boolean) =>
    list
      .map((instruction, index) => ({ ...instruction, index }))
      .filter(
        (instruction) =>
          (absolute.has(instruction.opcode) || zeroPage.has(instruction.opcode)) &&
          instruction.operand === address &&
          stores.has(instruction.opcode) === write,
      );
  for (const address of [0, 1, 0xdd02]) {
    expect(accesses(entry, address, false), `Capture ${address}`).toHaveLength(1);
    expect(accesses(entry, address, true), `Establish ${address}`).toHaveLength(1);
    expect(accesses(restore, address, true), `Restore ${address}`).toHaveLength(1);
    expect(accesses(entry, address, false)[0]!.index).toBeLessThan(
      accesses(entry, address, true)[0]!.index,
    );
  }
  expect(accesses(entry, 1, true)[0]!.index).toBeLessThan(accesses(entry, 0, true)[0]!.index);
  expect(accesses(restore, 1, true)[0]!.index).toBeLessThan(accesses(restore, 0, true)[0]!.index);
  for (const list of [entry, restore])
    expect(
      list.filter(
        (instruction) =>
          absolute.has(instruction.opcode) &&
          instruction.operand >= 0xdd00 &&
          instruction.operand <= 0xddff &&
          (instruction.operand & 15) === 0,
      ),
      "CIA2 PRA is untouched",
    ).toEqual([]);
  expect(
    entry.some(({ opcode }) => opcode === 0xd8),
    "Binary body entry",
  ).toBe(true);
  expect(restore.at(-1)?.opcode, "Cooperative return").toBe(0x60);
}

describe("Display-independent cooperative startup", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const [name, source] of [
      ["empty main", EMPTY],
      ["pure helpers and initializer", PURE],
      ["balanced source status saves", STACK],
    ]) {
      it(`${profile}: omits display ownership for ${name}`, async () => {
        const artifacts = await buildProfileSource(source!, profile);
        expectNoDisplayTraffic(artifacts);
        expectRequiredPorts(artifacts);
        const control = await buildProfileSource(
          source!.replace("function main(): void {", "function main(): void { poke($D020, 3);"),
          profile,
        );
        const startupSize = (value: Artifacts) =>
          interval(value, "code.startup.entry").size + interval(value, "code.startup.restore").size;
        expect(startupSize(artifacts)).toBeLessThan(startupSize(control));
        expect(interval(artifacts, "platform.startup-state").owner).toEqual({
          kind: "compiler",
          id: "platform.startup-state",
        });
        expect(interval(artifacts, "platform.startup-state").size).toBeLessThan(
          interval(control, "platform.startup-state").size,
        );
        expect(profileRecord(artifacts.costs.totals).programBytes).toBe(artifacts.prg.length - 2);
      }, 30_000);
    }

    for (const status of [0x20, 0x2d]) {
      it(`${profile}: restores caller status ${status} and ${status === 0x20 ? "executes a subsequent BASIC integer assignment" : "preserves incoming I and D"}`, async () => {
        await withProfileProject(BORROWED, profile, async (project) => {
          const built = await buildProject({ project, optimization: "none" });
          expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
          if (built.kind !== "success") throw new Error("Expected legal ordinary zero-page source");
          const artifacts = await readProfileArtifacts(built);
          const workspaces = profileRecords(artifacts.memory.intervals).filter(
            (entry) =>
              entry.kind === "bss" &&
              entry.size === 128 &&
              typeof entry.start === "number" &&
              typeof entry.end === "number" &&
              entry.start >= 2 &&
              entry.end <= 0x90,
          );
          expect(workspaces, "The declared workspace has one actual zero-page extent").toHaveLength(
            1,
          );
          if (typeof workspaces[0]!.id !== "string")
            throw new TypeError("Missing workspace identity");
          const workspace = interval(artifacts, workspaces[0]!.id);
          const liveAddresses = LIVE_BASIC_RANGES.flatMap(([start, end]) =>
            Array.from({ length: end - start + 1 }, (_, index) => start + index),
          ).filter((address) => address >= workspace.start && address < workspace.end);
          expect(
            liveAddresses.length,
            "This source actually borrows live BASIC cells",
          ).toBeGreaterThan(0);
          const runtime = await startVice(
            join(built.generation.directory, built.generation.primaryArtifact),
            100_000_000,
            profile,
            false,
            false,
          );
          if ("kind" in runtime) throw new Error(`Native return is Unknown: ${runtime.reason}`);
          console.info("startup-native-evidence", {
            profile,
            status,
            sourceSha256: createHash("sha256").update(BORROWED).digest("hex"),
            prgSha256: createHash("sha256").update(artifacts.prg).digest("hex"),
            identity: runtime.identity,
          });
          const monitor = runtime.monitor;
          const stopAt = async (address: number) => {
            const checkpoint = await monitor.setExecuteCheckpoint(address);
            try {
              const stopped = monitor.waitForStop(20_000);
              await monitor.resume();
              expect(await stopped).toBe(address);
            } finally {
              await monitor.deleteCheckpoint(checkpoint);
            }
          };
          try {
            // Stock SYS loads its saved status before entering the program.
            await stopAt(0xe136);
            expect([...(await monitor.readMemory(0xe136, 0xe139))]).toEqual([
              0xad, 0x0f, 0x03, 0x48,
            ]);
            await monitor.writeMemory(0x030f, Uint8Array.of(status));
            await monitor.writeIo(0xdd02, Uint8Array.of(0xa7));
            await stopAt(interval(artifacts, "code.startup.entry").start);
            const caller = await monitor.readCpuRegisters();
            expect(caller.p & 0xcf).toBe(status & 0xcf);
            const ports = [...(await monitor.readMemory(0, 1))];
            const ddra = [...(await monitor.readIo(0xdd02, 0xdd02))];
            const borrowedBefore = [];
            for (const address of liveAddresses)
              borrowedBefore.push((await monitor.readMemory(address, address))[0]!);
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));
            expect([...(await monitor.readMemory(0, 1))]).toEqual([
              ports[0]! | 7,
              (ports[1]! & 0xf8) | 6,
            ]);
            expect([...(await monitor.readIo(0xdd02, 0xdd02))]).toEqual([ddra[0]! & 0xfc]);
            expect((await monitor.readCpuRegisters()).p & 8).toBe(0);
            // SYS's first return instruction has not yet changed caller flags or stack.
            await stopAt(0xe147);
            expect([...(await monitor.readMemory(0xe147, 0xe147))]).toEqual([0x08]);
            const returned = await monitor.readCpuRegisters();
            expect(returned.p & 0xcf).toBe(caller.p & 0xcf);
            expect(returned.sp).toBe((caller.sp + 2) & 255);
            expect([...(await monitor.readMemory(0, 1))]).toEqual(ports);
            expect([...(await monitor.readIo(0xdd02, 0xdd02))]).toEqual(ddra);
            const borrowedAfter = [];
            for (const address of liveAddresses)
              borrowedAfter.push((await monitor.readMemory(address, address))[0]!);
            expect(
              borrowedAfter,
              "Restore each live BASIC cell actually borrowed by source",
            ).toEqual(borrowedBefore);
            if ((status & 8) === 0) {
              await stopAt(0xa483);
              // The stock keyboard queue feeds the ordinary BASIC line editor.
              await monitor.writeMemory(0x0277, Uint8Array.of(0x41, 0x25, 0x3d, 0x31, 0x0d));
              await monitor.writeMemory(0x00c6, Uint8Array.of(5));
              await stopAt(0xa9d5);
              expect([...(await monitor.readMemory(0xa9ce, 0xa9d5))]).toEqual([
                0x91, 0x49, 0xc8, 0xa5, 0x65, 0x91, 0x49, 0x60,
              ]);
              const pointer = await monitor.readMemory(0x49, 0x4a);
              const address = pointer[0]! | (pointer[1]! << 8);
              expect([...(await monitor.readMemory(address, address + 1))]).toEqual([0, 1]);
              await stopAt(0xa483);
            }
          } finally {
            await stopVice(runtime);
          }
        });
      }, 180_000);
    }
  }
});
