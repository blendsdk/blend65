import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  profileSpan,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";
import { cia2FixedCycles, cia2FunctionVariants, cia2Instructions } from "./cia2-output-fixture.js";
import { libraryEntry, libraryStartup, sourceLibraryProfiles } from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";

const fixtures = [
  {
    name: "ordinary global struct",
    inputDeclaration: "let inputPair: Pair;",
    parameterDeclaration: "value: const Pair",
    source: `module Game;
struct Pair { first: byte; second: byte; }
let inputPair: Pair;
let result: byte;
function readSecond(value: const Pair): byte { return value.second; }
function main(): void {
  inputPair.first = 7;
  inputPair.second = 9;
  result = readSecond(inputPair);
}
`,
  },
  {
    name: "ordinary global fixed array",
    inputDeclaration: "let inputArray: byte[2];",
    parameterDeclaration: "value: const byte[2]",
    source: `module Game;
let inputArray: byte[2];
let result: byte;
function readSecond(value: const byte[2]): byte { return value[1]; }
function main(): void {
  inputArray[0] = 7;
  inputArray[1] = 9;
  result = readSecond(inputArray);
}
`,
  },
] as const;

function sourceAddress(
  artifacts: LibraryArtifacts,
  source: string,
  declaration: string,
  kind: "global" | "parameter",
  scope: string,
  width: number,
): number {
  const wanted = profileSpan(source, declaration);
  const sources = profileRecords(artifacts.debug.sources);
  const sourceIndex = sources.findIndex((entry) => entry.path === "src/game.blend");
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const symbols = profileRecords(artifacts.debug.symbols);
  const matching = symbols.filter((symbol) => {
    if (symbol.kind !== kind || symbol.scope !== scope) return false;
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") return false;
    const span = profileRecord(origin.span);
    return (
      span.sourceIndex === sourceIndex &&
      typeof span.startByte === "number" &&
      typeof span.endByte === "number" &&
      span.startByte <= wanted.start &&
      span.endByte >= wanted.end
    );
  });
  expect(matching, declaration).toHaveLength(1);
  const symbol = matching[0]!;
  expect(symbol.byteWidth).toBe(width);
  expect(Array.isArray(symbol.locationIndexes)).toBe(true);
  const indexes = symbol.locationIndexes as unknown[];
  expect(indexes).toHaveLength(1);
  expect(Number.isInteger(indexes[0])).toBe(true);
  const location = profileRecords(artifacts.debug.locations)[indexes[0] as number]!;
  expect(location.symbolIndex).toBe(symbols.indexOf(symbol));
  const availability = profileRecord(location.availability);
  expect(availability.kind).toBe("available");
  const pieces = profileRecords(availability.pieces);
  expect(pieces).toHaveLength(1);
  expect(pieces[0]).toMatchObject({ kind: "memory", valueOffset: 0, byteLength: width });
  const machine = profileRecord(pieces[0]!.machine);
  expect(machine.addressSpaceIndex).toBe(0);
  expect(typeof machine.start).toBe("number");
  expect(typeof machine.end).toBe("number");
  const start = machine.start as number;
  expect(Number.isInteger(start)).toBe(true);
  expect((machine.end as number) - start).toBe(width);
  if (kind === "global") {
    expect(typeof symbol.name).toBe("string");
    expect(symbol.qualifiedName).toBe(`global::${String(symbol.name)}`);
    const intervals = profileRecords(artifacts.memory.intervals).filter(
      (interval) => interval.id === `global.${String(symbol.name)}`,
    );
    expect(intervals).toHaveLength(1);
    expect(intervals[0]).toMatchObject({ start, end: start + width, size: width });
  }
  return start;
}

function locations(artifacts: LibraryArtifacts, fixture: (typeof fixtures)[number]) {
  return {
    input: sourceAddress(
      artifacts,
      fixture.source,
      fixture.inputDeclaration,
      "global",
      "src/game.blend",
      2,
    ),
    result: sourceAddress(
      artifacts,
      fixture.source,
      "let result: byte;",
      "global",
      "src/game.blend",
      1,
    ),
    parameter: sourceAddress(
      artifacts,
      fixture.source,
      fixture.parameterDeclaration,
      "parameter",
      "src/game.blend::Game.readSecond",
      2,
    ),
  };
}

function callInstruction(artifacts: LibraryArtifacts) {
  const bodies = cia2FunctionVariants(artifacts, "main");
  expect(bodies).toHaveLength(1);
  const body = bodies[0]!;
  const calls = cia2Instructions(body.bytes).filter((instruction) => instruction.opcode === 0x20);
  expect(calls).toHaveLength(1);
  expect(calls[0]!.operand).toBe(libraryEntry(artifacts, "src/game.blend::Game.readSecond"));
  return { body, callAddress: body.start + calls[0]!.offset };
}

describe("fixed global whole-aggregate call argument", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const fixture of fixtures) {
      it(`${profile}: ${fixture.name} marshals directly within the complete main expert budget`, async () => {
        const artifacts = await buildProfileSource(fixture.source, profile);
        const addresses = locations(artifacts, fixture);
        const { body } = callInstruction(artifacts);
        const instructions = cia2Instructions(body.bytes);
        expect(instructions.at(-1)).toMatchObject({
          opcode: 0x4c,
          operand: libraryStartup(artifacts, "startup.restore"),
        });
        // Official NMOS fixed-address stores cost two/three bytes and three/four nominal cycles.
        // An expert loads each source constant once, writes both fields, and marshals the label's
        // low/high address directly into the existing two-byte parameter home before the sole JSR.
        // Keep seven in X and nine in A; Y can hold each remaining distinct address-byte constant.
        // Equal address bytes and bytes equal to an already established source value share their load.
        const store = (address: number) =>
          address < 0x100 ? { bytes: 2, cycles: 3 } : { bytes: 3, cycles: 4 };
        const stores = [
          addresses.input,
          addresses.input + 1,
          addresses.parameter,
          addresses.parameter + 1,
        ].map(store);
        const addressValues = new Set([addresses.input & 0xff, addresses.input >> 8]);
        addressValues.delete(7);
        addressValues.delete(9);
        const immediateLoadCount = 2 + addressValues.size;
        const expert = {
          bytes:
            2 * immediateLoadCount +
            stores.reduce((sum, term) => sum + term.bytes, 0) +
            3 +
            store(addresses.result).bytes +
            3,
          cycles:
            2 * immediateLoadCount +
            stores.reduce((sum, term) => sum + term.cycles, 0) +
            6 +
            store(addresses.result).cycles +
            3,
        };
        const actual = { bytes: body.bytes.length, cycles: cia2FixedCycles(body.bytes) };
        const callee = cia2FunctionVariants(artifacts, "readSecond");
        expect(callee).toHaveLength(1);
        const intervals = profileRecords(artifacts.memory.intervals);
        const startup = intervals.filter(
          (interval) =>
            interval.id === "code.startup.entry" || interval.id === "code.startup.restore",
        );
        expect(startup).toHaveLength(2);
        console.info(
          "fixed-global-main-cost",
          profile,
          fixture.name,
          JSON.stringify({
            addresses,
            actual,
            expert,
            calleeBytes: callee[0]!.bytes.length,
            startupBytes: startup.reduce((sum, interval) => sum + Number(interval.size), 0),
            wholeArtifactBytes: artifacts.prg.length - 2,
          }),
        );
        expect
          .soft(
            actual.bytes,
            "A fixed whole-object address needs no intermediate staging or aggregate copy",
          )
          .toBeLessThanOrEqual(expert.bytes);
        expect
          .soft(
            actual.cycles,
            "The complete caller costs no more than direct constant-address marshalling",
          )
          .toBeLessThanOrEqual(expert.cycles);
      });

      it(`${profile}: ${fixture.name} borrows the original object, receives nine, and returns normally`, async () => {
        await withProfileProject(fixture.source, profile, async (project) => {
          const built = await buildProject({ project, optimization: "none" });
          expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
          if (built.kind !== "success") throw new Error("Expected legal fixed-global source");
          const artifacts = await readProfileArtifacts(built);
          const addresses = locations(artifacts, fixture);
          const { callAddress } = callInstruction(artifacts);
          const runtime = await startVice(
            join(built.generation.directory, built.generation.primaryArtifact),
            100_000_000,
            profile,
            false,
            false,
          );
          if ("kind" in runtime) throw new Error(`VICE observation is Unknown: ${runtime.reason}`);
          console.info(
            "fixed-global-native-identity",
            profile,
            fixture.name,
            JSON.stringify(runtime.identity),
          );
          const monitor: ViceMonitor = runtime.monitor;
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
            await stopAt(0xe136);
            expect([...(await monitor.readMemory(0xe136, 0xe139))]).toEqual([
              0xad, 0x0f, 0x03, 0x48,
            ]);
            expect([...(await monitor.readMemory(0xe147, 0xe147))]).toEqual([0x08]);
            await monitor.writeMemory(0x030f, Uint8Array.of(0xad));
            await stopAt(libraryStartup(artifacts, "startup.entry"));
            const caller = await monitor.readCpuRegisters();
            const ports = [...(await monitor.readMemory(0, 1))];
            await monitor.writeIo(0xdd02, Uint8Array.of(0xa7));
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));
            const main = await monitor.readCpuRegisters();
            expect(main.p & 8).toBe(0);
            await monitor.writeMemory(addresses.input, Uint8Array.of(0x55, 0xaa));
            await monitor.writeMemory(addresses.result, Uint8Array.of(0x6d));
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.readSecond"));
            expect((await monitor.readCpuRegisters()).sp).toBe((main.sp - 2) & 0xff);
            expect([...(await monitor.readMemory(addresses.input, addresses.input + 1))]).toEqual([
              7, 9,
            ]);
            const pointer = await monitor.readMemory(addresses.parameter, addresses.parameter + 1);
            expect(
              pointer[0]! | (pointer[1]! << 8),
              "Const borrow aliases the original source object, not a copy",
            ).toBe(addresses.input);
            await stopAt(callAddress + 3);
            const returned = await monitor.readCpuRegisters();
            expect(returned.a).toBe(9);
            expect(returned.sp).toBe(main.sp);
            expect([...(await monitor.readMemory(addresses.input, addresses.input + 1))]).toEqual([
              7, 9,
            ]);
            await stopAt(libraryStartup(artifacts, "startup.restore"));
            expect([...(await monitor.readMemory(addresses.result, addresses.result))]).toEqual([
              9,
            ]);
            expect([...(await monitor.readMemory(addresses.input, addresses.input + 1))]).toEqual([
              7, 9,
            ]);
            await stopAt(0xe147);
            const final = await monitor.readCpuRegisters();
            expect(final.sp).toBe((caller.sp + 2) & 0xff);
            expect(final.p & 0xcf).toBe(caller.p & 0xcf);
            expect([...(await monitor.readMemory(0, 1))]).toEqual(ports);
            expect([...(await monitor.readIo(0xdd02, 0xdd02))]).toEqual([0xa7]);
            await stopAt(0xa483);
          } finally {
            await stopVice(runtime);
          }
        });
      }, 60_000);
    }
  }
});
