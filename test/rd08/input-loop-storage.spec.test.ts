import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "../rd05/profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryFunctionBytes,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryVice,
} from "../rd05/source-library-fixture.js";
import type { LibraryArtifacts } from "../rd05/source-library-fixture.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";

const modes = ["none", "size"] as const;
const declarations = `module Game;
place(at: $3400) let answers: byte[80] = [; 0];
`;

/** Narrow public byte counts and addresses before using them in arithmetic. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new TypeError("Expected a nonnegative safe integer");
  return value;
}

/** Reject missing or dangling public indexes instead of accepting absent evidence. */
function index(value: unknown, records: readonly unknown[]): number {
  expect(typeof value === "number" && Number.isSafeInteger(value) && value >= 0).toBe(true);
  if (typeof value !== "number") throw new TypeError("Expected a public integer index");
  expect(value).toBeLessThan(records.length);
  return value;
}

/** Count actual memory bytes once, even when successive source values share a home. */
function memoryBytes(
  artifacts: LibraryArtifacts,
  symbolIndex: number,
  visited = new Set<number>(),
): Set<number> {
  if (visited.has(symbolIndex)) throw new Error("Cyclic value rematerialization");
  const symbols = profileRecords(artifacts.debug.symbols);
  index(symbolIndex, symbols);
  const bytes = new Set<number>();
  for (const location of profileRecords(artifacts.debug.locations).filter(
    (record) => record.symbolIndex === symbolIndex,
  )) {
    const availability = profileRecord(location.availability);
    if (availability.kind === "available" || availability.kind === "split") {
      for (const piece of profileRecords(availability.pieces)) {
        if (piece.kind !== "memory") continue;
        const machine = profileRecord(piece.machine);
        if (typeof machine.start !== "number" || typeof machine.end !== "number")
          throw new TypeError("Memory availability needs final physical endpoints");
        for (let address = machine.start; address < machine.end; address += 1) bytes.add(address);
      }
    } else if (availability.kind === "rematerializable") {
      if (!Array.isArray(availability.operandSymbolIndexes))
        throw new TypeError("Rematerialization needs public operand indexes");
      for (const operand of availability.operandSymbolIndexes)
        for (const address of memoryBytes(
          artifacts,
          index(operand, symbols),
          new Set([...visited, symbolIndex]),
        ))
          bytes.add(address);
    }
  }
  return bytes;
}

/** Identify a declared binding by source provenance and owning function, never display spelling. */
function sourceBindingIndex(
  artifacts: LibraryArtifacts,
  source: string,
  functionName: string,
  name: string,
  kind: "local" | "parameter",
): number {
  const simpleFunction = functionName.slice(functionName.lastIndexOf(".") + 1);
  const functionStart = source.indexOf(`function ${simpleFunction}(`);
  if (functionStart < 0) throw new Error("Missing authored function declaration");
  const nextFunction = source.indexOf("\nfunction ", functionStart + 1);
  const functionEnd = nextFunction < 0 ? source.length : nextFunction;
  const declaration = kind === "local" ? `let ${name}:` : `${name}:`;
  const declarationStart = source.indexOf(declaration, functionStart);
  if (declarationStart < 0 || declarationStart >= functionEnd)
    throw new Error("Missing authored binding declaration");
  const nameStart = declarationStart + (kind === "local" ? 4 : 0);
  const startByte = Buffer.byteLength(source.slice(0, nameStart));
  const endByte = startByte + Buffer.byteLength(name);
  const sources = profileRecords(artifacts.debug.sources);
  const functions = profileRecords(artifacts.debug.functions);
  const contexts = profileRecords(artifacts.debug.contexts);
  const locations = profileRecords(artifacts.debug.locations);
  const symbols = profileRecords(artifacts.debug.symbols);
  const inFunction = (position: number) =>
    locations.some(
      (location) =>
        location.symbolIndex === position &&
        functions[
          index(contexts[index(location.contextIndex, contexts)]!.functionIndex, functions)
        ]!.qualifiedName === functionName,
    );
  const matches = symbols.flatMap((symbol, position) => {
    if (symbol.kind !== kind) return [];
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") return [];
    const span = profileRecord(origin.span);
    return sources[index(span.sourceIndex, sources)]!.path === "src/game.blend" &&
      integer(span.startByte) <= startByte &&
      integer(span.endByte) >= endByte &&
      inFunction(position)
      ? [position]
      : [];
  });
  const diagnostic =
    matches.length === 1
      ? `${functionName} ${name}`
      : JSON.stringify(
          symbols
            .filter((symbol, position) => symbol.kind === kind && inFunction(position))
            .slice(0, 24)
            .map(({ name, kind, qualifiedName, origin }) => ({
              name,
              kind,
              qualifiedName,
              origin,
            })),
        );
  expect(matches, diagnostic).toHaveLength(1);
  return matches[0]!;
}

/** Keep source widths and context-specific final availability faithful to the frozen schema. */
function expectWordEvidence(
  artifacts: LibraryArtifacts,
  sourceText: string,
  functionName: string,
  names: readonly string[],
): number[] {
  const { debug } = artifacts;
  expect(debug).toMatchObject({ kind: "blend65.debug", schemaVersion: 1 });
  const symbols = profileRecords(debug.symbols);
  const contexts = profileRecords(debug.contexts);
  const functions = profileRecords(debug.functions);
  const ranges = profileRecords(debug.ranges);
  const spaces = profileRecords(debug.addressSpaces);
  const sources = profileRecords(debug.sources);
  const locations = profileRecords(debug.locations);
  const wanted = names.map((name) => {
    const position = sourceBindingIndex(artifacts, sourceText, functionName, name, "local");
    expect(symbols[position]!).toMatchObject({ type: "word", byteWidth: 2, shape: [] });
    return position;
  });
  for (const position of wanted) {
    const symbol = symbols[position]!;
    expect(Object.keys(symbol).sort()).toEqual([
      "byteWidth",
      "kind",
      "labels",
      "linkage",
      "locationIndexes",
      "name",
      "origin",
      "qualifiedName",
      "scope",
      "shape",
      "type",
    ]);
    const origin = profileRecord(symbol.origin);
    expect(origin.kind).toBe("source");
    const span = profileRecord(origin.span);
    const source = sources[index(span.sourceIndex, sources)]!;
    expect(source.path).toBe("src/game.blend");
    expect(span.startByte).toBeGreaterThanOrEqual(0);
    expect(integer(span.endByte)).toBeGreaterThan(integer(span.startByte));
    expect(integer(span.endByte)).toBeLessThanOrEqual(integer(source.byteLength));
    if (!Array.isArray(symbol.locationIndexes)) throw new TypeError("Missing source locations");
    expect(symbol.locationIndexes.length).toBeGreaterThan(0);
    for (const reference of symbol.locationIndexes) {
      const location = locations[index(reference, locations)]!;
      expect(location.symbolIndex).toBe(position);
      expect(Object.keys(location).sort()).toEqual([
        "availability",
        "contextIndex",
        "liveRangeIndexes",
        "symbolIndex",
      ]);
      const contextPosition = index(location.contextIndex, contexts);
      const context = contexts[contextPosition]!;
      index(context.functionIndex, functions);
      expect(["entry", "call", "inlined"]).toContain(context.kind);
      if (context.kind === "entry") {
        index(
          context.entryVariantIndex,
          profileRecords(functions[index(context.functionIndex, functions)]!.entryVariants),
        );
      } else {
        expect(index(context.parentContextIndex, contexts)).toBeLessThan(contextPosition);
      }
      if (!Array.isArray(location.liveRangeIndexes))
        throw new TypeError("Missing final live ranges");
      expect(location.liveRangeIndexes.length).toBeGreaterThan(0);
      for (const rangePosition of location.liveRangeIndexes) {
        const range = ranges[index(rangePosition, ranges)]!;
        expect(range.contextIndex).toBe(contextPosition);
        const machine = profileRecord(range.machine);
        const space = spaces[index(machine.addressSpaceIndex, spaces)]!;
        expect(machine.start).toBeGreaterThanOrEqual(0);
        expect(integer(machine.end)).toBeGreaterThan(integer(machine.start));
        expect(integer(machine.end)).toBeLessThanOrEqual(integer(space.sizeBytes));
      }
      const available = profileRecord(location.availability);
      expect([
        "available",
        "split",
        "constant",
        "rematerializable",
        "optimizedAway",
        "unavailable",
      ]).toContain(available.kind);
      if (available.kind === "available" || available.kind === "split") {
        expect(Object.keys(available).sort()).toEqual(["kind", "pieces"]);
        const pieces = profileRecords(available.pieces);
        expect(pieces.length).toBeGreaterThanOrEqual(available.kind === "split" ? 2 : 1);
        const occupied = new Set<number>();
        for (const piece of pieces) {
          expect(["memory", "register"]).toContain(piece.kind);
          expect(piece.byteLength).toBeGreaterThan(0);
          expect(piece.valueOffset).toBeGreaterThanOrEqual(0);
          if (typeof piece.byteLength !== "number" || typeof piece.valueOffset !== "number")
            throw new TypeError("Storage pieces require byte widths and offsets");
          for (
            let byte = piece.valueOffset;
            byte < piece.valueOffset + piece.byteLength;
            byte += 1
          ) {
            expect(occupied.has(byte)).toBe(false);
            occupied.add(byte);
          }
          if (piece.kind === "register") {
            expect(Object.keys(piece).sort()).toEqual([
              "byteLength",
              "kind",
              "register",
              "valueOffset",
            ]);
            if (typeof piece.register !== "string")
              throw new TypeError("Missing register identity");
            expect(["A", "X", "Y"]).toContain(piece.register.toUpperCase());
            expect(piece.byteLength).toBe(1);
          } else {
            expect(Object.keys(piece).sort()).toEqual([
              "byteLength",
              "kind",
              "machine",
              "valueOffset",
            ]);
            const machine = profileRecord(piece.machine);
            const spaceIndex = index(machine.addressSpaceIndex, spaces);
            const start = integer(machine.start);
            const end = integer(machine.end);
            expect(end - start).toBe(piece.byteLength);
            expect(
              profileRecords(artifacts.memory.intervals).some(
                (interval) =>
                  typeof interval.start === "number" &&
                  typeof interval.end === "number" &&
                  interval.start <= start &&
                  interval.end >= end &&
                  interval.addressSpaceId === spaces[spaceIndex]!.id,
              ),
            ).toBe(true);
          }
        }
        expect([...occupied].sort()).toEqual([0, 1]);
      } else if (available.kind === "constant") {
        expect(Object.keys(available).sort()).toEqual(["bytesHex", "kind"]);
        expect(available.bytesHex).toMatch(/^[0-9a-f]{4}$/u);
      } else if (available.kind === "rematerializable") {
        expect(Object.keys(available).sort()).toEqual(["kind", "operandSymbolIndexes", "rule"]);
        expect(typeof available.rule).toBe("string");
        if (!Array.isArray(available.operandSymbolIndexes))
          throw new TypeError("Missing rematerialization operands");
        for (const operand of available.operandSymbolIndexes) index(operand, symbols);
      } else if (available.kind === "optimizedAway") {
        expect(Object.keys(available).sort()).toEqual(["kind", "rule"]);
      } else {
        expect(Object.keys(available).sort()).toEqual(["kind", "reason"]);
        expect(["notLive", "notResident", "notMaterialized", "notRepresentable"]).toContain(
          available.reason,
        );
      }
    }
  }
  return wanted;
}

/** Independently reconcile physical intervals and every standard charged resource. */
function expectResources(artifacts: LibraryArtifacts): void {
  expectLibraryAccounting(artifacts);
  const resources = profileRecords(profileRecord(artifacts.costs.totals).resources);
  expect(
    resources.filter((resource) => resource.kind === "standard").map((resource) => resource.id),
  ).toEqual(["zeroPage", "residentRam", "hardwareStack", "scratch"]);
  for (const resource of resources) integer(resource.value);
  const intervals = profileRecords(artifacts.memory.intervals);
  expect(new Set(intervals.map((interval) => interval.id)).size).toBe(intervals.length);
  for (const interval of intervals) {
    expect(integer(interval.end) - integer(interval.start)).toBe(interval.size);
    expect(
      integer(interval.payloadBytes) +
        integer(interval.paddingBytes) +
        integer(interval.reservedBytes),
    ).toBe(interval.size);
    expect(interval.size).toBeGreaterThanOrEqual(0);
  }
  for (const view of profileRecords(artifacts.memory.views)) {
    const residencyIds = view.activeResidencyIds;
    if (!Array.isArray(residencyIds)) throw new TypeError("Missing active residencies");
    const active = intervals
      .filter(
        (interval) =>
          interval.addressSpaceId === view.addressSpaceId &&
          interval.bankId === view.bankId &&
          Array.isArray(interval.residencyIds) &&
          interval.residencyIds.some((id) => residencyIds.includes(id)),
      )
      .map((interval) => ({
        start: Math.max(integer(interval.start), integer(view.start)),
        end: Math.min(integer(interval.end), integer(view.end)),
      }))
      .filter((interval) => interval.end > interval.start)
      .sort((left, right) => left.start - right.start);
    let end = integer(view.start);
    let occupied = 0;
    for (const interval of active) {
      expect(interval.start).toBeGreaterThanOrEqual(end);
      occupied += interval.end - interval.start;
      end = interval.end;
    }
    expect(occupied).toBe(view.occupiedBytes);
    expect(integer(view.occupiedBytes) + integer(view.freeBytes)).toBe(view.capacityBytes);
  }
  for (const domain of profileRecords(artifacts.memory.stackDomains))
    expect(integer(domain.peakBytes) + integer(domain.headroomBytes)).toBe(domain.capacityBytes);
}

/** Find a source binding through its exact public function context, independent of home spelling. */
function bindingMemory(
  artifacts: LibraryArtifacts,
  source: string,
  functionName: string,
  name: string,
  kind: "local" | "parameter",
): Set<number> {
  return memoryBytes(artifacts, sourceBindingIndex(artifacts, source, functionName, name, kind));
}

/** Materialized contents that must survive each other's accesses cannot occupy the same byte. */
function expectDisjoint(left: ReadonlySet<number>, right: ReadonlySet<number>): void {
  expect([...left].filter((address) => right.has(address))).toEqual([]);
}

/** Build independently checked source and observe CPU accesses after startup has completed. */
async function inspectSource(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
  mode: (typeof modes)[number],
  inspect: (
    artifacts: LibraryArtifacts,
    monitor: ViceMonitor,
    finish: () => Promise<void>,
  ) => Promise<void>,
): Promise<void> {
  await withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    if (checked.kind !== "success") throw new Error("Expected legal loop and storage source");
    const built = await buildProject({ project, optimization: mode });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected a complete loop and storage build");
    const artifacts = await readProfileArtifacts(built);
    expectResources(artifacts);
    expect(libraryFunctionBytes(artifacts, "src/game.blend::Game.main").length).toBeGreaterThan(0);
    await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
      await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));
      await monitor.writeMemory(0xc110, Uint8Array.of(7, 9));
      await inspect(artifacts, monitor, () => stopAt(libraryStartup(artifacts, "startup.restore")));
    });
  });
}

describe.each(sourceLibraryProfiles)("word loops and private storage on %s", (profile) => {
  it.each(modes)(
    "should preserve eight ordinals and ordered nested pairs in %s mode",
    async (mode) => {
      // Narrowing the representation must preserve the source word and every iteration.
      const source = `${declarations}
function main(): void {
  let sum: byte = 0;
  let count: byte = 0;
  for (let ordinal: word = 0; ordinal < 8; ordinal += 1) {
    answers[ordinal + 2] = byte(ordinal);
    sum += byte(ordinal);
    count += 1;
  }
  answers[0] = sum; answers[1] = count;
  let output: byte = 10;
  for (let column: word = 0; column < 8; column += 1) {
    for (let other: word = column + 1; other < 8; other += 1) {
      answers[output] = byte(column); output += 1;
      answers[output] = byte(other); output += 1;
    }
  }
  answers[66] = output;
}`;
      await inspectSource(source, profile, mode, async (artifacts, monitor, finish) => {
        const expected = [28, 8, ...Array.from({ length: 8 }, (_, ordinal) => ordinal)];
        for (let column = 0; column < 8; column += 1)
          for (let other = column + 1; other < 8; other += 1) expected.push(column, other);
        expected.push(66);
        await finish();
        expect([...(await monitor.readMemory(0x3400, 0x3442))]).toEqual(expected);
        const [ordinal] = expectWordEvidence(artifacts, source, "src/game.blend::Game.main", [
          "ordinal",
          "column",
          "other",
        ]);
        if (mode === "size") expect(memoryBytes(artifacts, ordinal!).size).toBeLessThan(2);
      });
    },
    300_000,
  );

  it.each(modes)(
    "should preserve wide counters, borrows, break, continue and live-outs in %s mode",
    async (mode) => {
      // A borrowed address remains legal inside its owner's lifetime and observes both bytes.
      const source = `${declarations}
function readCounter(address: word): word { return peekw(address); }
function main(): void {
  let output: byte = 0;
  let crossing: word = 254;
  for (; crossing < 258; crossing += 1) {
    answers[output] = lo(crossing); output += 1;
    answers[output] = hi(crossing); output += 1;
  }
  answers[8] = lo(crossing); answers[9] = hi(crossing);
  for (let borrowed: word = 0; borrowed < 8; borrowed += 1) {
    answers[10 + borrowed] = byte(readCounter(&borrowed));
  }
  let broken: word = 0;
  for (; broken < 8; broken += 1) { if (broken == 3) { break; } }
  answers[18] = lo(broken); answers[19] = hi(broken);
  let continued: word = 0;
  let total: byte = 0;
  for (; continued < 8; continued += 1) {
    if (continued == 3) { continue; }
    total += byte(continued);
  }
  answers[20] = total; answers[21] = lo(continued); answers[22] = hi(continued);
}`;
      await inspectSource(source, profile, mode, async (artifacts, monitor, finish) => {
        await finish();
        expect([...(await monitor.readMemory(0x3400, 0x3416))]).toEqual([
          254, 0, 255, 0, 0, 1, 1, 1, 2, 1, 0, 1, 2, 3, 4, 5, 6, 7, 3, 0, 25, 8, 0,
        ]);
        const [, borrowed] = expectWordEvidence(artifacts, source, "src/game.blend::Game.main", [
          "crossing",
          "borrowed",
          "broken",
          "continued",
        ]);
        expect(memoryBytes(artifacts, borrowed!).size).toBe(2);
      });
    },
    300_000,
  );

  it.each(modes)(
    "should retain eight volatile read-write pairs and early or unknown exits in %s mode",
    async (mode) => {
      // Tracepoints observe CPU events; reading monitor memory adds no source read.
      const source = `${declarations}
function early(): void {
  for (let earlyCounter: word = 0; earlyCounter < 8; earlyCounter += 1) {
    if (earlyCounter == 3) { return; }
    poke($C102, byte(earlyCounter));
  }
}
function main(): void {
  for (let flat: word = 0; flat < 8; flat += 1) {
    poke($C100, byte(flat)); answers[flat] = peek($C100);
  }
  early();
  let bound: word = word(peek($C110));
  for (let unknown: word = 0; unknown < bound; unknown += 1) {
    answers[unknown + 8] = byte(unknown); poke($C103, byte(unknown));
  }
}`;
      await inspectSource(source, profile, mode, async (artifacts, monitor, finish) => {
        const write = await monitor.setAccessTracepoint(0xc100, "store");
        const read = await monitor.setAccessTracepoint(0xc100, "load");
        const early = await monitor.setAccessTracepoint(0xc102, "store");
        const unknown = await monitor.setAccessTracepoint(0xc103, "store");
        monitor.takeCheckpointHits();
        await finish();
        const hits = monitor.takeCheckpointHits();
        expect(hits.filter((hit) => hit === write || hit === read)).toEqual(
          Array.from({ length: 8 }, () => [write, read]).flat(),
        );
        expect(hits.filter((hit) => hit === early)).toHaveLength(3);
        expect(hits.filter((hit) => hit === unknown)).toHaveLength(7);
        expect([...(await monitor.readMemory(0x3400, 0x340e))]).toEqual([
          ...Array.from({ length: 8 }, (_, i) => i),
          ...Array.from({ length: 7 }, (_, i) => i),
        ]);
        expectWordEvidence(artifacts, source, "src/game.blend::Game.main", ["flat", "unknown"]);
        expectWordEvidence(artifacts, source, "src/game.blend::Game.early", ["earlyCounter"]);
      });
    },
    300_000,
  );

  it.each(modes)(
    "should preserve surviving values across dead writes, calls and argument delivery in %s mode",
    async (mode) => {
      // Dead assignments and unused parameters still write homes unless explicitly eliminated.
      const source = `${declarations}
function first(left: byte, unused: byte): byte { return left; }
function combine(left: byte, right: byte): byte { return left * 10 + right; }
function helper(): byte { let scratch: byte = peek($C111); return scratch; }
function main(): void {
  let a: byte = 0; answers[0] = a;
  let b: byte = 7; a = 9; answers[1] = b;
  let whole: byte[2] = [0, 0]; answers[2] = whole[0];
  let survivor: byte = 7; whole = [9, 9]; answers[3] = survivor;
  let member: byte[2] = [0, 0]; answers[4] = member[0];
  let memberSurvivor: byte = 7; member[1] = 9; answers[5] = memberSurvivor;
  answers[6] = first(7, 9);
  let old: byte = 1; let assigned: byte = 0;
  old += (assigned = 7); answers[7] = old; answers[8] = assigned;
  let right: byte = peek($C111); let left: byte = peek($C110);
  answers[9] = combine(left, right);
  let live: byte = peek($C110); answers[10] = helper(); answers[11] = live;
}`;
      await inspectSource(source, profile, mode, async (artifacts, monitor, finish) => {
        await finish();
        expect([...(await monitor.readMemory(0x3400, 0x340b))]).toEqual([
          0, 7, 0, 7, 0, 7, 7, 8, 7, 79, 9, 7,
        ]);
        expect(libraryFunctionBytes(artifacts, "src/game.blend::Game.first").at(-1)).toBe(0x60);
        expect(libraryFunctionBytes(artifacts, "src/game.blend::Game.combine").at(-1)).toBe(0x60);
        for (const functionName of ["first", "combine"])
          expectDisjoint(
            bindingMemory(
              artifacts,
              source,
              `src/game.blend::Game.${functionName}`,
              "left",
              "parameter",
            ),
            bindingMemory(
              artifacts,
              source,
              `src/game.blend::Game.${functionName}`,
              functionName === "first" ? "unused" : "right",
              "parameter",
            ),
          );
        expectDisjoint(
          bindingMemory(artifacts, source, "src/game.blend::Game.main", "live", "local"),
          bindingMemory(artifacts, source, "src/game.blend::Game.helper", "scratch", "local"),
        );
      });
    },
    300_000,
  );

  it.each(modes)(
    "should share only the homes of access-disjoint byte scopes in %s mode",
    async (mode) => {
      // The two source values are observed in order and never need simultaneous contents.
      const source = `${declarations}
function main(): void {
  { let earlier: byte = peek($C110); answers[0] = earlier; }
  { let later: byte = peek($C111); answers[1] = later; }
}`;
      await inspectSource(source, profile, mode, async (artifacts, monitor, finish) => {
        await finish();
        expect([...(await monitor.readMemory(0x3400, 0x3401))]).toEqual([7, 9]);
        if (mode === "size") {
          const earlier = bindingMemory(
            artifacts,
            source,
            "src/game.blend::Game.main",
            "earlier",
            "local",
          );
          const later = bindingMemory(
            artifacts,
            source,
            "src/game.blend::Game.main",
            "later",
            "local",
          );
          expect(new Set([...earlier, ...later]).size).toBeLessThanOrEqual(1);
        }
      });
    },
    300_000,
  );
});
