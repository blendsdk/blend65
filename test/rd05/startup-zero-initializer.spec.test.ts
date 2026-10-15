import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryBytes,
  libraryEntry,
  libraryStartup,
  sourceLibraryProfiles,
} from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";

const CIA2_DDRA = 0xdd02;
const SYS_STATUS_LOAD = 0xe136;
const SYS_RETURN = 0xe147;
const BASIC_READY = 0xa483;
const CALLER_STATUS = 0xad;
const paths = ["display-independent", "full-fallback"] as const;
const objects = [
  { name: "scalar zero", declaration: "let zero: byte = 0;", values: [0], condition: "zero != 0" },
  {
    name: "zero-leading fixed array",
    declaration: "let zero: byte[4] = [0, $31, $82, $e5];",
    values: [0, 0x31, 0x82, 0xe5],
    condition: "zero[0] != 0 || zero[1] != $31 || zero[2] != $82 || zero[3] != $e5",
  },
] as const;

function sourceFor(object: (typeof objects)[number], path: (typeof paths)[number]): string {
  return `module Game;
${object.declaration}
function main(): void {
  while (${object.condition}) {}
  ${path === "full-fallback" ? "let observed: byte = peek($D020);" : ""}
}
`;
}

function storedAddress(artifacts: LibraryArtifacts, source: string, width: number): number {
  const symbols = profileRecords(artifacts.debug.symbols);
  const matching = symbols.filter(
    (symbol) => symbol.kind === "global" && symbol.scope === "src/game.blend",
  );
  expect(matching).toHaveLength(1);
  const symbol = matching[0]!;
  expect(symbol.byteWidth).toBe(width);
  expect(typeof symbol.name).toBe("string");
  expect(symbol.qualifiedName).toBe(`global::${String(symbol.name)}`);
  const origin = profileRecord(symbol.origin);
  expect(origin.kind).toBe("source");
  const span = profileRecord(origin.span);
  const sources = profileRecords(artifacts.debug.sources);
  expect(typeof span.sourceIndex).toBe("number");
  expect(Number.isInteger(span.sourceIndex)).toBe(true);
  const sourceIndex = span.sourceIndex as number;
  expect(sources[sourceIndex]?.path).toBe("src/game.blend");
  expect(typeof span.startByte).toBe("number");
  expect(typeof span.endByte).toBe("number");
  const startByte = span.startByte as number;
  const endByte = span.endByte as number;
  expect(startByte).toBeGreaterThanOrEqual(0);
  expect(endByte).toBeGreaterThan(startByte);
  expect(endByte).toBeLessThanOrEqual(Buffer.byteLength(source));
  expect(Buffer.from(source).subarray(startByte, endByte).toString()).toContain("zero");
  expect(Array.isArray(symbol.locationIndexes)).toBe(true);
  const indexes = symbol.locationIndexes as unknown[];
  expect(indexes).toHaveLength(1);
  expect(Number.isInteger(indexes[0])).toBe(true);
  const locations = profileRecords(artifacts.debug.locations);
  const location = locations[indexes[0] as number]!;
  expect(location.symbolIndex).toBe(symbols.indexOf(symbol));
  const availability = profileRecord(location.availability);
  expect(availability.kind).toBe("available");
  const pieces = profileRecords(availability.pieces);
  expect(pieces).toHaveLength(1);
  const piece = pieces[0]!;
  expect(piece).toMatchObject({ kind: "memory", valueOffset: 0, byteLength: width });
  const machine = profileRecord(piece.machine);
  expect(machine.addressSpaceIndex).toBe(0);
  expect(typeof machine.start).toBe("number");
  expect(typeof machine.end).toBe("number");
  const address = machine.start as number;
  expect(Number.isInteger(address)).toBe(true);
  expect((machine.end as number) - address).toBe(width);
  const intervals = profileRecords(artifacts.memory.intervals).filter(
    (interval) => interval.id === `global.${String(symbol.name)}`,
  );
  expect(intervals).toHaveLength(1);
  expect(intervals[0]).toMatchObject({ start: address, end: address + width, size: width });
  return address;
}

async function withNativeStartup(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
  inspect: (
    artifacts: LibraryArtifacts,
    monitor: ViceMonitor,
    stopAt: (address: number) => Promise<void>,
  ) => Promise<void>,
): Promise<void> {
  await withProfileProject(source, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected a legal initialization program");
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
    expectLibraryAccounting(artifacts);
    const runtime = await startVice(
      join(built.generation.directory, built.generation.primaryArtifact),
      100_000_000,
      profile,
      false,
      false,
    );
    if ("kind" in runtime) throw new Error(`VICE observation is Unknown: ${runtime.reason}`);
    console.info("startup-zero-native-identity", profile, JSON.stringify(runtime.identity));
    const monitor = runtime.monitor;
    const stopAt = async (address: number): Promise<void> => {
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
      await stopAt(SYS_STATUS_LOAD);
      expect([...(await monitor.readMemory(SYS_STATUS_LOAD, SYS_STATUS_LOAD + 3))]).toEqual([
        0xad, 0x0f, 0x03, 0x48,
      ]);
      expect([...(await monitor.readMemory(SYS_RETURN, SYS_RETURN))]).toEqual([0x08]);
      await monitor.writeMemory(0x030f, Uint8Array.of(CALLER_STATUS));
      await stopAt(libraryStartup(artifacts, "startup.entry"));
      expect((await monitor.readCpuRegisters()).p & 0xcf).toBe(CALLER_STATUS & 0xcf);
      await monitor.writeIo(CIA2_DDRA, Uint8Array.of(0xa7));
      expect([...(await monitor.readIo(CIA2_DDRA, CIA2_DDRA))]).toEqual([0xa7]);
      await inspect(artifacts, monitor, stopAt);
    } finally {
      await stopVice(runtime);
    }
  });
}

describe("module zero initialization before ordinary main", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const path of paths) {
      for (const object of objects) {
        it(`${profile}: ${path} initializes ${object.name} and returns through SYS to READY`, async () => {
          const source = sourceFor(object, path);
          await withNativeStartup(source, profile, async (artifacts, monitor, stopAt) => {
            const address = storedAddress(artifacts, source, object.values.length);
            const caller = await monitor.readCpuRegisters();
            const ports = [...(await monitor.readMemory(0, 1))];
            await monitor.writeMemory(address, new Uint8Array(object.values.length).fill(0x6d));
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));
            const actual = [
              ...(await monitor.readMemory(address, address + object.values.length - 1)),
            ];
            console.info(
              "startup-zero-main-values",
              profile,
              path,
              object.name,
              JSON.stringify(actual),
            );
            expect
              .soft(
                actual,
                "Every explicit initializer must store its exact source value before main",
              )
              .toEqual([...object.values]);
            expect((await monitor.readCpuRegisters()).p & 0x08).toBe(0);
            expect([...(await monitor.readMemory(0, 1))]).toEqual([
              ports[0]! | 7,
              (ports[1]! & 0xf8) | 6,
            ]);
            await stopAt(SYS_RETURN);
            const returned = await monitor.readCpuRegisters();
            expect(returned.sp).toBe((caller.sp + 2) & 0xff);
            expect(returned.p & 0xcf).toBe(caller.p & 0xcf);
            expect([...(await monitor.readMemory(0, 1))]).toEqual(ports);
            expect([...(await monitor.readIo(CIA2_DDRA, CIA2_DDRA))]).toEqual([0xa7]);
            await stopAt(BASIC_READY);
          });
        }, 60_000);
      }
    }
  }
});

describe("executed constant-zero initialization instructions", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const path of paths) {
      it(`${profile}: ${path} executes the scalar store with an established zero`, async () => {
        const source = sourceFor(objects[0], path);
        await withNativeStartup(source, profile, async (artifacts, monitor, stopAt) => {
          const address = storedAddress(artifacts, source, 1);
          const start = libraryStartup(artifacts, "startup.entry");
          const main = libraryEntry(artifacts, "src/game.blend::Game.main");
          const bytes = libraryBytes(artifacts, start, main - start);
          // The store must consume an established zero, including a zero legally shared from earlier code.
          // Official NMOS fixed-address stores charge two/three bytes and three/four cycles.
          const forms = [
            { absolute: 0x8d, zeroPage: 0x85, register: "a" },
            { absolute: 0x8e, zeroPage: 0x86, register: "x" },
            { absolute: 0x8c, zeroPage: 0x84, register: "y" },
          ] as const;
          const candidates = forms.flatMap((form) => {
            const expected =
              address < 0x100
                ? [form.zeroPage, address]
                : [form.absolute, address & 0xff, address >> 8];
            return bytes.flatMap((_, offset) =>
              expected.every((byte, index) => bytes[offset + index] === byte)
                ? [
                    {
                      address: start + offset,
                      register: form.register,
                      bytes: expected.length,
                      cycles: address < 0x100 ? 3 : 4,
                    },
                  ]
                : [],
            );
          });
          expect(
            candidates,
            "A fixed scalar zero needs an established zero value before its implicit store",
          ).toHaveLength(1);
          const candidate = candidates[0]!;
          expect(libraryBytes(artifacts, candidate.address, candidate.bytes)).toEqual(
            address < 0x100
              ? [forms.find((form) => form.register === candidate.register)!.zeroPage, address]
              : [
                  forms.find((form) => form.register === candidate.register)!.absolute,
                  address & 0xff,
                  address >> 8,
                ],
          );
          console.info(
            "startup-zero-local-store-cost",
            profile,
            path,
            JSON.stringify({
              bytes: candidate.bytes,
              nominalCycles: candidate.cycles,
              sharedZeroAllowed: true,
            }),
          );
          await monitor.writeMemory(address, Uint8Array.of(0x6d));
          await stopAt(candidate.address);
          expect((await monitor.readCpuRegisters())[candidate.register]).toBe(0);
          expect([...(await monitor.readMemory(address, address))]).toEqual([0x6d]);
          await stopAt(main);
          expect([...(await monitor.readMemory(address, address))]).toEqual([0]);
        });
      }, 60_000);
    }
  }
});
