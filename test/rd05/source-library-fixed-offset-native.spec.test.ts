import { describe, expect, it } from "vitest";
import { profileRecord, profileRecords } from "./profile-fixture.js";
import {
  libraryEntry,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";

const CASES = sourceLibraryProfiles.flatMap((profile, index) =>
  (index === 0 ? [1, 257] : [257]).map((offset) => ({ profile, offset })),
);

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new TypeError("Expected integral public evidence");
  return value;
}

function library(offset: number): string {
  const fields =
    offset === 0 ? "value: byte; padding: byte;" : `padding: byte[${offset}]; value: byte;`;
  return `module Library;
export struct Record { ${fields} }
export function read(root: Record): byte { return root.value; }
export function forward(root: Record): byte { return read(root); }
export function alias(left: Record, right: Record): byte {
  left.value = 91;
  return read(right);
}`;
}

const GAME = `module Game;
import { Record, read, forward, alias } from Library;
let object: Record;
let first: byte = 0;
let second: byte = 0;
let aliased: byte = 0;
let injectedFirst: byte = 0;
let injectedSecond: byte = 0;
let injectedThird: byte = 0;
function ready(): void { asm_nop(); }
function afterFirst(): void { asm_nop(); }
function afterSecond(): void { asm_nop(); }
function afterThird(): void { asm_nop(); }
function main(): void {
  asm_sei();
  object.value = 41;
  first = read(object);
  object.value = 73;
  second = forward(object);
  aliased = alias(object, object);
  ready();
  injectedFirst = read(object);
  afterFirst();
  injectedSecond = read(object);
  afterSecond();
  injectedThird = read(object);
  afterThird();
  asm_cli();
}`;

/** Resolve the two physical borrowed-address bytes from parameter declaration provenance. */
function parameterHome(artifacts: LibraryArtifacts, source: string): number {
  const start = Buffer.byteLength(source.slice(0, source.indexOf("root: Record")));
  const end = start + Buffer.byteLength("root: Record");
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    ({ path }) => path === "src/library.blend",
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const symbols = profileRecords(artifacts.debug.symbols);
  const matches = symbols.filter((symbol) => {
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") return false;
    const span = profileRecord(origin.span);
    return (
      span.sourceIndex === sourceIndex &&
      integer(span.startByte) >= start &&
      integer(span.endByte) <= end
    );
  });
  const locations = profileRecords(artifacts.debug.locations);
  const homes = matches.flatMap((symbol) => {
    const indexes = symbol.locationIndexes;
    if (!Array.isArray(indexes))
      throw new TypeError("Borrowed parameter requires public locations");
    return indexes.flatMap((index) => {
      const location = locations[integer(index)]!;
      expect(location.symbolIndex).toBe(symbols.indexOf(symbol));
      const availability = profileRecord(location.availability);
      if (availability.kind !== "available") return [];
      return profileRecords(availability.pieces)
        .filter((piece) => piece.kind === "memory")
        .map((piece) => {
          expect(piece.byteLength).toBe(2);
          expect(piece.valueOffset).toBe(0);
          const machine = profileRecord(piece.machine);
          expect(integer(machine.end) - integer(machine.start)).toBe(2);
          return integer(machine.start);
        });
    });
  });
  expect(homes, "Original two-byte borrowed parameter home").toHaveLength(1);
  return homes[0]!;
}

describe("native opaque borrowed fixed field offsets", () => {
  for (const { profile, offset } of CASES)
    it(`${profile}: offset ${offset} preserves carry, wrap, final read order and borrowed aliases`, async () => {
      const source = library(offset);
      await withLibraryBuild(GAME, source, profile, async (artifacts, built) => {
        const root = parameterHome(artifacts, source);
        const global = (name: string) =>
          libraryGlobalAddress(artifacts, GAME, name, 1, "src/game.blend");
        const object = libraryGlobalAddress(
          artifacts,
          GAME,
          "object",
          offset === 0 ? 2 : offset + 1,
          "src/game.blend",
        );
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.ready"));
          expect([...(await monitor.readMemory(global("first"), global("first")))]).toEqual([41]);
          expect([...(await monitor.readMemory(global("second"), global("second")))]).toEqual([73]);
          expect([...(await monitor.readMemory(global("aliased"), global("aliased")))]).toEqual([
            91,
          ]);
          expect([...(await monitor.readMemory(object + offset, object + offset))]).toEqual([91]);

          const cases = [
            { base: 0x40ff, result: "injectedFirst", marker: "afterFirst", value: 0x61 },
            {
              base: offset === 257 ? 0xfffe : 0x40f8,
              result: "injectedSecond",
              marker: "afterSecond",
              value: 0xa7,
            },
            {
              base: (0xdd0d - offset) & 0xffff,
              result: "injectedThird",
              marker: "afterThird",
              value: 0,
            },
          ];
          for (const entry of cases) {
            await stopAt(libraryEntry(artifacts, "src/library.blend::Library.read"));
            const before = await monitor.readCpuRegisters();
            expect(before.p & 0x0c).toBe(0x04);
            const effective = (entry.base + offset) & 0xffff;
            const io = effective === 0xdd0d;
            const saved = io
              ? await monitor.readIo(0xdd0e, 0xdd0f)
              : await monitor.readMemory(effective, effective);
            // Hold CIA2 timer flags stable while the read consumes its ICR state.
            // No external FLAG, serial or TOD stimulus is supplied by this observation.
            if (io)
              await monitor.writeIo(0xdd0e, new Uint8Array([saved[0]! & 0xfe, saved[1]! & 0xfe]));
            else await monitor.writeMemory(effective, new Uint8Array([entry.value]));
            const expected = io ? (await monitor.readIo(effective, effective))[0]! : entry.value;

            // Inject only the existing borrowed-address home at the callee boundary.
            // This tests generic CPU/MMIO lowering, not source-level RAM provenance.
            await monitor.writeMemory(root, new Uint8Array([entry.base & 0xff, entry.base >>> 8]));
            const traces = new Map<number, string>();
            const trace = async (address: number, operation: "load" | "store", label: string) => {
              traces.set(await monitor.setAccessTracepoint(address, operation), label);
            };
            await trace(root, "load", "root.low");
            await trace(root + 1, "load", "root.high");
            await trace(root, "store", "root.low.write");
            await trace(root + 1, "store", "root.high.write");
            await trace(effective, "load", "final.read");
            await trace(effective, "store", "source.write");
            const intermediate = new Set([
              entry.base,
              (entry.base & 0xff00) | (effective & 0xff),
              (entry.base + (offset & 0xff)) & 0xffff,
            ]);
            for (const address of intermediate)
              if (address !== effective && address !== root && address !== root + 1)
                await trace(address, "load", `intermediate.${address}`);
            monitor.takeCheckpointHits();
            try {
              await stopAt(libraryEntry(artifacts, `src/game.blend::Game.${entry.marker}`));
              const events = monitor
                .takeCheckpointHits()
                .flatMap((id) => (traces.has(id) ? [traces.get(id)!] : []));
              expect(
                events,
                "Read original address once, then exactly one final field byte",
              ).toEqual(["root.low", "root.high", "final.read"]);
              expect([
                ...(await monitor.readMemory(global(entry.result), global(entry.result))),
              ]).toEqual([expected]);
              expect([...(await monitor.readMemory(root, root + 1))]).toEqual([
                entry.base & 0xff,
                entry.base >>> 8,
              ]);
              const after = await monitor.readCpuRegisters();
              expect(after.p & 0x0c, "Address addition preserves I and D").toBe(before.p & 0x0c);
              expect(after.sp, "Reader return balances the hardware stack").toBe(before.sp);
              const actual = io
                ? await monitor.readIo(effective, effective)
                : await monitor.readMemory(effective, effective);
              if (io)
                expect(actual[0]! & 0x1f, "The one CIA2 ICR read consumes its pending flags").toBe(
                  0,
                );
              else
                expect([...actual], "The borrowed RAM source is never written").toEqual([expected]);
            } finally {
              for (const id of traces.keys()) await monitor.deleteCheckpoint(id);
              if (io) await monitor.writeIo(0xdd0e, saved);
              else await monitor.writeMemory(effective, saved);
            }
          }
        });
      });
    }, 180_000);
});
