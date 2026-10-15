import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { profileRecord, profileRecords, profileSpan } from "./profile-fixture.js";
import {
  libraryEntry,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";

const fixtures = [
  {
    name: "ordinary global struct",
    input: "let inputPair: Pair;",
    parameter: "value: const Pair",
    source: `module Game;
struct Pair { first: byte; second: byte; }
let inputPair: Pair;
let result: byte;
function readSecond(value: const Pair): byte { return value.second; }
function main(): void {
  inputPair.first = 7;
  inputPair.second = 9;
  result = readSecond(inputPair);
}`,
  },
  {
    name: "ordinary global fixed array",
    input: "let inputArray: byte[2];",
    parameter: "value: const byte[2]",
    source: `module Game;
let inputArray: byte[2];
let result: byte;
function readSecond(value: const byte[2]): byte { return value[1]; }
function main(): void {
  inputArray[0] = 7;
  inputArray[1] = 9;
  result = readSecond(inputArray);
}`,
  },
];

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new Error("Missing integer evidence");
  return value;
}

function sourceAddress(
  artifacts: LibraryArtifacts,
  source: string,
  declaration: string,
  width: number,
  kind = "global",
) {
  const wanted = profileSpan(source, declaration);
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    (row) => row.path === "src/game.blend",
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const symbols = profileRecords(artifacts.debug.symbols);
  const matches = symbols.flatMap((symbol, index) => {
    if (
      symbol.kind !== kind ||
      symbol.scope !== (kind === "global" ? "src/game.blend" : "src/game.blend::Game.readSecond")
    )
      return [];
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") return [];
    const span = profileRecord(origin.span);
    return span.sourceIndex === sourceIndex &&
      integer(span.startByte) <= wanted.start &&
      integer(span.endByte) >= wanted.end
      ? [{ symbol, index }]
      : [];
  });
  expect(matches, declaration).toHaveLength(1);
  const { symbol, index } = matches[0]!;
  expect(symbol.byteWidth).toBe(width);
  expect(symbol.locationIndexes).toBeInstanceOf(Array);
  const indexes = symbol.locationIndexes as unknown[];
  expect(indexes).toHaveLength(1);
  const location = profileRecords(artifacts.debug.locations)[integer(indexes[0])]!;
  expect(location.symbolIndex).toBe(index);
  const available = profileRecord(location.availability);
  expect(available.kind).toBe("available");
  const pieces = profileRecords(available.pieces);
  expect(pieces).toHaveLength(1);
  const piece = pieces[0]!;
  expect(piece).toMatchObject({ kind: "memory", valueOffset: 0, byteLength: width });
  const machine = profileRecord(piece.machine);
  expect(machine.addressSpaceIndex).toBe(0);
  const address = integer(machine.start);
  expect(integer(machine.end)).toBe(address + width);
  if (kind === "global") {
    expect(symbol.qualifiedName).toBe(`global::${String(symbol.name)}`);
    const intervals = profileRecords(artifacts.memory.intervals).filter(
      (row) => row.id === `global.${String(symbol.name)}`,
    );
    expect(intervals).toHaveLength(1);
    expect(intervals[0]).toMatchObject({ start: address, end: address + width, size: width });
  }
  return address;
}

describe("ordinary owned aggregate borrows preserve the caller and object", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const fixture of fixtures) {
      test(`${profile}: ${fixture.name} returns through SYS and READY`, async () => {
        await withLibraryBuild(
          fixture.source,
          "module Library;",
          profile,
          async (artifacts, built) => {
            const input = sourceAddress(artifacts, fixture.source, fixture.input, 2);
            const result = sourceAddress(artifacts, fixture.source, "let result: byte;", 1);
            // A const aggregate parameter's published two bytes are its ABI pointer slot.
            const parameter = sourceAddress(
              artifacts,
              fixture.source,
              fixture.parameter,
              2,
              "parameter",
            );
            const runtime = await startVice(
              join(built.generation.directory, built.generation.primaryArtifact),
              100_000_000,
              profile,
              false,
              false,
            );
            if ("kind" in runtime)
              throw new Error(`Native observation is Unknown: ${runtime.reason}`);
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
              // Stock SYS loads SPREG only at E136; inject the caller's status before that load.
              await stopAt(0xe136);
              expect([...(await monitor.readMemory(0xe136, 0xe139))]).toEqual([
                0xad, 0x0f, 0x03, 0x48,
              ]);
              await monitor.writeMemory(0x030f, new Uint8Array([0xad]));
              await stopAt(libraryStartup(artifacts, "startup.entry"));
              const caller = await monitor.readCpuRegisters();
              const ports = [...(await monitor.readMemory(0, 1))];
              await monitor.writeIo(0xdd02, new Uint8Array([0xa7]));
              const basic = await monitor.readMemory(3, 0x8f);
              const borrowed = new Set<number>();
              for (const row of profileRecords(artifacts.memory.intervals)) {
                if (row.resourceClass !== "zeroPage") continue;
                const start = integer(row.start);
                const end = integer(row.end);
                expect(start).toBeGreaterThanOrEqual(2);
                expect(end).toBeLessThanOrEqual(0x90);
                for (let address = Math.max(3, start); address < end; address += 1)
                  borrowed.add(address);
              }
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));
              const main = await monitor.readCpuRegisters();
              expect(main.p & 8).toBe(0);
              expect(main.p & 4).toBe(caller.p & 4);
              expect([...(await monitor.readMemory(0, 1))]).toEqual([
                ports[0]! | 7,
                (ports[1]! & 0xf8) | 6,
              ]);
              expect([...(await monitor.readIo(0xdd02, 0xdd02))]).toEqual([0xa4]);
              // Host poison makes the two normal source writes and result store observable.
              await monitor.writeMemory(input, new Uint8Array([0x55, 0xaa]));
              await monitor.writeMemory(result, new Uint8Array([0x6d]));
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.readSecond"));
              expect((await monitor.readCpuRegisters()).sp).toBe((main.sp - 2) & 0xff);
              expect([...(await monitor.readMemory(input, input + 1))]).toEqual([7, 9]);
              const pointer = await monitor.readMemory(parameter, parameter + 1);
              expect(pointer[0]! + 256 * pointer[1]!).toBe(input);
              await stopAt(libraryStartup(artifacts, "startup.restore"));
              expect((await monitor.readCpuRegisters()).sp).toBe(main.sp);
              expect([...(await monitor.readMemory(result, result))]).toEqual([9]);
              expect([...(await monitor.readMemory(input, input + 1))]).toEqual([7, 9]);
              await stopAt(0xe147);
              expect([...(await monitor.readMemory(0xe147, 0xe147))]).toEqual([0x08]);
              const returned = await monitor.readCpuRegisters();
              expect(returned.sp).toBe((caller.sp + 2) & 0xff);
              expect(returned.p & 0xcf).toBe(caller.p & 0xcf);
              expect([...(await monitor.readMemory(0, 1))]).toEqual(ports);
              expect([...(await monitor.readIo(0xdd02, 0xdd02))]).toEqual([0xa7]);
              const restored = await monitor.readMemory(3, 0x8f);
              for (const address of borrowed)
                expect(restored[address - 3], `BASIC byte $${address.toString(16)}`).toBe(
                  basic[address - 3],
                );
              await stopAt(0xa483);
              console.info(
                JSON.stringify({
                  profile,
                  case: fixture.name,
                  input,
                  result,
                  parameter,
                  borrowed: [...borrowed],
                  value: 9,
                  object: [7, 9],
                  vice: runtime.identity,
                  status: "VICE-verified / hardware-unverified",
                }),
              );
            } finally {
              await stopVice(runtime);
            }
          },
        );
      }, 90_000);
    }
  }
});
