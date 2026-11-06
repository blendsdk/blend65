import { buildProject, checkProject } from "@blend65/compiler";
import type { BuildSuccess } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
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
  libraryGlobalAddress,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryVice,
} from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";

/** The observed copy is made after both calls, so the second borrow must see the update. */
const BORROW_SOURCE = `module Game;
struct Packet { values: byte[4]; tag: byte; }
let observed: Packet;
function make(): Packet {
    let result: Packet = { values: [9,18,27,36], tag: 5 };
    result.values[1] = peek($D020) & 15;
    result.values[2] = result.values[2] + 1;
    return result;
}
function consume(source: const Packet): byte {
    poke($D021, source.values[2]);
    return source.values[0] + source.values[1] + source.tag;
}
function main(): void {
    let sentinel: byte = peek($C100);
    let received: Packet = make();
    poke($C000, consume(received));
    received.values[1] = received.values[1] + 1;
    poke($C001, consume(received));
    poke($C002, sentinel);
    observed = received;
}
`;

/** An ordinary completed return has no borrower or raw address that could require a pointer. */
const DIRECT_SOURCE = `module Game;
struct Packet { values: byte[4]; tag: byte; }
let observed: Packet;
function make(): Packet {
    let result: Packet = { values: [9,18,27,36], tag: 5 };
    result.values[1] = peek($D020) & 15;
    result.values[2] = result.values[2] + 1;
    return result;
}
function main(): void {
    let received: Packet = make();
    observed = received;
    poke($C000, received.values[1]);
}
`;

/** Distinct origins and runtime columns require the ordinary borrowed-parameter ABI. */
const MIXED_SOURCE = `module Game;
struct Packet { values: byte[4]; tag: byte; }
function make(): Packet {
    let result: Packet = { values: [11,22,33,44], tag: 1 };
    return result;
}
function read(source: const Packet, column: byte): byte {
    return source.values[column & 3] + source.tag;
}
function main(): void {
    let first: Packet = make();
    let other: Packet = { values: [51,62,73,84], tag: 2 };
    let column: byte = peek($C100);
    poke($C000, read(first, column));
    poke($C001, read(other, column));
    first.values[2] = 97;
    poke($C002, read(first, 2));
    poke($C003, read(other, 2));
}
`;

/** Live results must survive later calls, including two results staged for one outer call. */
const NESTED_SOURCE = `module Game;
struct Packet { values: byte[3]; }
let sequence: byte[4] = [0,0,0,0];
let step: byte = 0;
function make(seed: byte): Packet {
    sequence[step & 3] = seed;
    step = step + 1;
    poke($D020, seed);
    let result: Packet = { values: [seed, seed + 1, seed + 2] };
    return result;
}
function combine(left: const Packet, right: const Packet): byte {
    return left.values[0] + right.values[2];
}
function main(): void {
    let first: Packet = make(3);
    let second: Packet = make(11);
    poke($C000, first.values[0]);
    poke($C001, first.values[1]);
    poke($C002, first.values[2]);
    poke($C003, second.values[0]);
    poke($C004, second.values[1]);
    poke($C005, second.values[2]);
    poke($C006, combine(make(21), make(37)));
}
`;

/** A non-retaining raw borrow observes the local before its last update and return. */
const RAW_SOURCE = `module Game;
struct Packet { values: byte[4]; tag: byte; }
let observed: Packet;
function readAddress(address: word): byte { return peek(address); }
function make(): Packet {
    let result: Packet = { values: [7,13,19,25], tag: 3 };
    result.values[1] = readAddress(&result.values[0]);
    result.values[0] = 41;
    return result;
}
function main(): void {
    let received: Packet = make();
    observed = received;
    poke($C000, received.values[0]);
    poke($C001, received.values[1]);
}
`;

/** Build only through the public services, with the canonical operation-selection mode. */
async function withCanonicalBuild(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
  inspect: (built: BuildSuccess, artifacts: LibraryArtifacts) => Promise<void>,
) {
  await withProfileProject(source, profile, async (project) => {
    const options = {
      project,
      optimization: "none" as const,
      boundsCheck: false,
      divisionZeroCheck: false,
    };
    const checked = await checkProject(options);
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    const built = await buildProject(options);
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected legal fixed-object source");
    const artifacts = await readProfileArtifacts(built);
    expectLibraryAccounting(artifacts);
    expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
    expect(profileRecord(profileRecord(artifacts.build.semanticInputs).options)).toMatchObject({
      optimization: "none",
      boundsCheck: false,
      divisionZeroCheck: false,
    });
    await inspect(built, artifacts);
  });
}

/** Resolve real instruction ranges and require exactly one body for an ordinary source callee. */
function functionRanges(artifacts: LibraryArtifacts, name: string) {
  const matches = profileRecords(artifacts.debug.functions).filter(
    (entry) => entry.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(matches, name).toHaveLength(1);
  const fn = matches[0]!;
  expect(profileRecords(fn.entryVariants), name).toHaveLength(1);
  if (!Array.isArray(fn.rangeIndexes) || fn.rangeIndexes.length === 0)
    throw new Error("Expected complete source-function ranges");
  const all = profileRecords(artifacts.debug.ranges);
  const ranges = fn.rangeIndexes.map((index: unknown) => {
    if (typeof index !== "number" || !Number.isInteger(index) || all[index] === undefined)
      throw new Error("Function range does not resolve");
    return all[index]!;
  });
  ranges.sort(
    (a, b) => Number(profileRecord(a.machine).start) - Number(profileRecord(b.machine).start),
  );
  return { fn, ranges };
}

/** These byte-only callees need neither a two-byte ABI pointer nor an indirect memory access. */
function expectFixedBacking(artifacts: LibraryArtifacts, name: string, aggregateWidth?: number) {
  const owned = profileRecords(artifacts.memory.intervals).filter((interval) => {
    const owner = profileRecord(interval.owner);
    return owner.kind === "function" && owner.id === `src/game.blend::Game.${name}`;
  });
  const storage = owned.filter((interval) => ["sfa", "zeroPage"].includes(String(interval.kind)));
  expect(
    storage.filter((interval) => interval.size === 2),
    `${name}: runtime pointer`,
  ).toEqual([]);
  if (aggregateWidth !== undefined) {
    expect(storage.filter((interval) => interval.size === aggregateWidth)).toEqual([]);
    expect(storage.filter((interval) => interval.size === aggregateWidth - 1)).toEqual([]);
  }
  const { ranges } = functionRanges(artifacts, name);
  // Inspect instruction boundaries from public debug ranges, not operand bytes or label names.
  for (const range of ranges) {
    const machine = profileRecord(range.machine);
    const opcode = libraryBytes(artifacts, Number(machine.start), 1)[0]!;
    expect([0x81, 0x91, 0xa1, 0xb1], `${name}: indirect load/store`).not.toContain(opcode);
  }
}

/** The destination remains a declared caller-owned object, not an uncharged numeric address. */
function expectDeclaredCallerBacking(artifacts: LibraryArtifacts) {
  const locals = profileRecords(artifacts.debug.symbols)
    .map((symbol, index) => ({ symbol, index }))
    .filter(
      ({ symbol }) =>
        symbol.kind === "local" &&
        symbol.scope === "src/game.blend::Game.main" &&
        symbol.byteWidth === 5 &&
        profileRecord(symbol.origin).kind === "source",
    );
  expect(locals).toHaveLength(1);
  const pieces = profileRecords(artifacts.debug.locations)
    .filter((location) => location.symbolIndex === locals[0]!.index)
    .flatMap((location) => {
      const availability = profileRecord(location.availability);
      return availability.kind === "available" ? profileRecords(availability.pieces) : [];
    })
    .filter(
      (piece) => piece.kind === "memory" && piece.valueOffset === 0 && piece.byteLength === 5,
    );
  expect(pieces.length).toBeGreaterThan(0);
  const intervals = profileRecords(artifacts.memory.intervals);
  for (const piece of pieces) {
    const machine = profileRecord(piece.machine);
    expect(Number(machine.end) - Number(machine.start)).toBe(5);
    expect(
      intervals.some((interval) => {
        const owner = profileRecord(interval.owner);
        return (
          owner.kind === "function" &&
          owner.id === "src/game.blend::Game.main" &&
          interval.kind === "sfa" &&
          interval.resourceClass === "general" &&
          Number(interval.start) <= Number(machine.start) &&
          Number(interval.end) >= Number(machine.end)
        );
      }),
    ).toBe(true);
  }
}

/** The completed local's return has no address materialization or declaration-owned copy suffix. */
function expectBareReturn(artifacts: LibraryArtifacts, source: string) {
  const { fn, ranges } = functionRanges(artifacts, "make");
  const declaration = profileRecord(fn.declaration);
  const position = source.indexOf("return result;");
  expect(position).toBeGreaterThanOrEqual(0);
  const start = Buffer.byteLength(source.slice(0, position));
  const end = start + Buffer.byteLength("return result;");
  const declarationOrigin = (range: Record<string, unknown>) => {
    const origin = profileRecord(range.origin);
    if (origin.kind !== "source") return false;
    const span = profileRecord(origin.span);
    return (
      span.sourceIndex === declaration.sourceIndex &&
      span.startByte === declaration.startByte &&
      span.endByte === declaration.endByte
    );
  };
  expect(
    ranges.filter((range) => {
      const origin = profileRecord(range.origin);
      if (origin.kind !== "source") return false;
      const span = profileRecord(origin.span);
      return (
        span.sourceIndex === declaration.sourceIndex &&
        Number(span.startByte) >= start &&
        Number(span.endByte) <= end
      );
    }),
  ).toEqual([]);
  const last = ranges.at(-1)!;
  expect(declarationOrigin(last)).toBe(true);
  let first = ranges.length - 1;
  while (
    first > 0 &&
    declarationOrigin(ranges[first - 1]!) &&
    profileRecord(ranges[first - 1]!.machine).end === profileRecord(ranges[first]!.machine).start
  )
    first -= 1;
  expect(
    ranges.slice(first).flatMap((range) => {
      const machine = profileRecord(range.machine);
      return libraryBytes(
        artifacts,
        Number(machine.start),
        Number(machine.end) - Number(machine.start),
      );
    }),
  ).toEqual([0x60]);
}

/** Two native callers vary live registers, decimal/interrupt flags, stack depth and ROM banking. */
const INCOMING = [
  { a: 0x53, x: 0x96, y: 0x2d, p: 0x25, sp: 0xe8, bank: 0x37, border: 3, sentinel: 0xa6 },
  { a: 0xc7, x: 0x18, y: 0xb2, p: 0xe8, sp: 0xc8, bank: 0x36, border: 12, sentinel: 0x59 },
] as const;

/**
 * Enter the real startup through JSR and stop at its actual native return address.
 * The temporary entry jump is restored before any generated instruction runs.
 * This avoids inventing a register-write API or relying on BASIC's incidental registers.
 */
async function nativeObservation(
  built: BuildSuccess,
  artifacts: LibraryArtifacts,
  profile: (typeof sourceLibraryProfiles)[number],
  incoming: (typeof INCOMING)[number],
  expectedMemory: readonly { readonly address: number; readonly bytes: readonly number[] }[],
  expectedEvents: readonly string[],
  expectedBackground = 6,
) {
  await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
    const entry = libraryStartup(artifacts, "startup.entry");
    const wrapper = 0xc800;
    const original = libraryBytes(artifacts, entry, 3);
    const caller = Uint8Array.of(
      0xa2,
      incoming.sp,
      0x9a,
      0xa9,
      incoming.p,
      0x48,
      0xa9,
      incoming.a,
      0xa2,
      incoming.x,
      0xa0,
      incoming.y,
      0x28,
      0x20,
      entry & 255,
      entry >> 8,
      0xea,
    );
    expect(Number(profileRecord(artifacts.build.package).endAddress)).toBeLessThan(wrapper);
    await monitor.writeMemory(wrapper, caller);
    await monitor.writeMemory(entry, Uint8Array.of(0x4c, wrapper & 255, wrapper >> 8));
    await stopAt(wrapper);
    await monitor.writeMemory(entry, Uint8Array.from(original));
    await monitor.writeMemory(0, Uint8Array.of(0x2f, incoming.bank));
    await monitor.writeMemory(0xc100, Uint8Array.of(incoming.sentinel));
    await stopAt(entry);
    const before = await monitor.readCpuRegisters();
    expect([before.a, before.x, before.y, before.sp, before.p & 0xcf]).toEqual([
      incoming.a,
      incoming.x,
      incoming.y,
      incoming.sp - 2,
      incoming.p & 0xcf,
    ]);
    const bank = await monitor.readMemory(0, 1);
    await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));
    // Startup owns display initialization; supply source inputs only after it finishes.
    await monitor.writeIo(0xd020, Uint8Array.of(incoming.border));
    await monitor.writeIo(0xd021, Uint8Array.of(6));
    const vic = await monitor.readIo(0xd016, 0xd018);
    const cia1Directions = await monitor.readIo(0xdc02, 0xdc03);
    // Separate startup-constructor tests own CIA2 direction and VIC-bank restoration.
    const events = new Map<number, string>();
    for (const [address, name] of [
      [0xd020, "border"],
      [0xd021, "background"],
    ] as const)
      for (const operation of ["load", "store"] as const)
        events.set(await monitor.setAccessTracepoint(address, operation), `${operation}:${name}`);
    monitor.takeCheckpointHits();
    try {
      await stopAt(libraryStartup(artifacts, "startup.restore"));
      expect(
        monitor.takeCheckpointHits().flatMap((id) => (events.has(id) ? [events.get(id)!] : [])),
      ).toEqual(expectedEvents);
      for (const { address, bytes } of expectedMemory)
        expect([...(await monitor.readMemory(address, address + bytes.length - 1))]).toEqual(bytes);
      expect((await monitor.readIo(0xd021, 0xd021))[0]! & 15).toBe(expectedBackground);
      await stopAt(wrapper + 16);
      const after = await monitor.readCpuRegisters();
      expect([after.a, after.x, after.y, after.sp, after.p & 0xcf]).toEqual([
        before.a,
        before.x,
        before.y,
        incoming.sp,
        before.p & 0xcf,
      ]);
      expect(await monitor.readMemory(0, 1)).toEqual(bank);
      expect(await monitor.readIo(0xd016, 0xd018)).toEqual(vic);
      expect(await monitor.readIo(0xdc02, 0xdc03)).toEqual(cia1Directions);
    } finally {
      for (const checkpoint of events.keys()) await monitor.deleteCheckpoint(checkpoint);
    }
  });
}

describe.sequential("canonical fixed objects on cooperative NMOS6510 profiles", () => {
  for (const profile of sourceLibraryProfiles) {
    it(`constructs and updates one caller object without runtime result delivery on ${profile}`, async () => {
      await withCanonicalBuild(DIRECT_SOURCE, profile, async (built, artifacts) => {
        const observed = libraryGlobalAddress(
          artifacts,
          DIRECT_SOURCE,
          "let observed: Packet;",
          5,
          "src/game.blend",
        );
        for (const incoming of INCOMING)
          await nativeObservation(
            built,
            artifacts,
            profile,
            incoming,
            [
              { address: observed, bytes: [9, incoming.border, 28, 36, 5] },
              { address: 0xc000, bytes: [incoming.border] },
            ],
            ["load:border"],
          );
        expectFixedBacking(artifacts, "make", 5);
        expectDeclaredCallerBacking(artifacts);
        expectBareReturn(artifacts, DIRECT_SOURCE);
      });
    }, 180_000);

    it(`borrows the same object without another pointer and restores both native callers on ${profile}`, async () => {
      await withCanonicalBuild(BORROW_SOURCE, profile, async (built, artifacts) => {
        const observed = libraryGlobalAddress(
          artifacts,
          BORROW_SOURCE,
          "let observed: Packet;",
          5,
          "src/game.blend",
        );
        for (const incoming of INCOMING)
          await nativeObservation(
            built,
            artifacts,
            profile,
            incoming,
            [
              { address: observed, bytes: [9, incoming.border + 1, 28, 36, 5] },
              {
                address: 0xc000,
                bytes: [14 + incoming.border, 15 + incoming.border, incoming.sentinel],
              },
            ],
            ["load:border", "store:background", "store:background"],
            28 & 15,
          );
        expectFixedBacking(artifacts, "make", 5);
        expectFixedBacking(artifacts, "consume");
        expectDeclaredCallerBacking(artifacts);
        expectBareReturn(artifacts, BORROW_SOURCE);
      });
    }, 180_000);

    it(`uses the generic borrower for two distinct objects on ${profile}`, async () => {
      await withCanonicalBuild(MIXED_SOURCE, profile, async (built, artifacts) => {
        for (const incoming of INCOMING) {
          const column = incoming.sentinel & 3;
          await nativeObservation(
            built,
            artifacts,
            profile,
            incoming,
            [
              {
                address: 0xc000,
                bytes: [[11, 22, 33, 44][column]! + 1, [51, 62, 73, 84][column]! + 2, 98, 75],
              },
            ],
            [],
          );
        }
        functionRanges(artifacts, "read");
        const pointers = profileRecords(artifacts.memory.intervals).filter((interval) => {
          const owner = profileRecord(interval.owner);
          return (
            owner.kind === "function" &&
            owner.id === "src/game.blend::Game.read" &&
            ["sfa", "zeroPage"].includes(String(interval.kind)) &&
            interval.size === 2
          );
        });
        expect(pointers.length, "generic borrower retains its address parameter").toBeGreaterThan(
          0,
        );
      });
    }, 180_000);

    it(`keeps two destinations and nested argument staging independent on ${profile}`, async () => {
      await withCanonicalBuild(NESTED_SOURCE, profile, async (built, artifacts) => {
        const sequence = libraryGlobalAddress(
          artifacts,
          NESTED_SOURCE,
          "let sequence: byte[4] = [0,0,0,0];",
          4,
          "src/game.blend",
        );
        await nativeObservation(
          built,
          artifacts,
          profile,
          INCOMING[0],
          [
            { address: 0xc000, bytes: [3, 4, 5, 11, 12, 13, 60] },
            { address: sequence, bytes: [3, 11, 21, 37] },
          ],
          ["store:border", "store:border", "store:border", "store:border"],
        );
        functionRanges(artifacts, "make");
        functionRanges(artifacts, "combine");
      });
    }, 180_000);

    it(`preserves a legal raw observation before completing the return on ${profile}`, async () => {
      await withCanonicalBuild(RAW_SOURCE, profile, async (built, artifacts) => {
        const observed = libraryGlobalAddress(
          artifacts,
          RAW_SOURCE,
          "let observed: Packet;",
          5,
          "src/game.blend",
        );
        await nativeObservation(
          built,
          artifacts,
          profile,
          INCOMING[0],
          [
            { address: observed, bytes: [41, 7, 19, 25, 3] },
            { address: 0xc000, bytes: [41, 7] },
          ],
          [],
        );
      });
    }, 180_000);
  }
});
