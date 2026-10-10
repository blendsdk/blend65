import { buildProject, checkProject, loadProject } from "@blend65/compiler";
import { analyzeProject } from "@blend65/compiler/frontend";
import { describe, expect, it } from "vitest";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";
import {
  libraryBytes,
  libraryEntry,
  libraryGlobalAddress,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryVice,
} from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";

const OPTIONS = {
  optimization: "none" as const,
  boundsCheck: false,
  divisionZeroCheck: false,
};
const PAIR = "struct Pair { x: byte; y: byte; }";
const RESULT = "let result: Pair = { x: 1, y: 2 };";
const RECEIVED = "let received: Pair = make();";
const OUTPUT = "let observed: byte[2] = [0, 0];";
const PUBLISH = "observed[0] = received.x; observed[1] = received.y;";

/** Match the declaration by its source bytes, rather than an internal slot name. */
function sourceSymbols(
  artifacts: LibraryArtifacts,
  source: string,
  declaration: string,
  scope: string,
  width: number,
): number[] {
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    (entry) => entry.path === "src/game.blend",
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const offset = source.indexOf(declaration);
  expect(offset).toBeGreaterThanOrEqual(0);
  expect(source.indexOf(declaration, offset + 1)).toBe(-1);
  const start = Buffer.byteLength(source.slice(0, offset));
  const end = start + Buffer.byteLength(declaration);
  return profileRecords(artifacts.debug.symbols).flatMap((symbol, index) => {
    const origin = profileRecord(symbol.origin);
    const span = profileRecord(origin.span);
    const matches =
      symbol.kind === "local" &&
      symbol.scope === scope &&
      symbol.byteWidth === width &&
      origin.kind === "source" &&
      span.sourceIndex === sourceIndex &&
      Number(span.startByte) >= start &&
      Number(span.endByte) <= end;
    return matches ? [index] : [];
  });
}

/** Find complete static memory homes and prove that the function owns their storage. */
function fullHomes(
  artifacts: LibraryArtifacts,
  symbolIndex: number,
  scope: string,
  width: number,
): number[] {
  const intervals = profileRecords(profileRecord(artifacts.memory).intervals);
  const addresses: number[] = [];
  for (const location of profileRecords(artifacts.debug.locations)) {
    if (location.symbolIndex !== symbolIndex) continue;
    const availability = profileRecord(location.availability);
    if (availability.kind !== "available") continue;
    for (const piece of profileRecords(availability.pieces)) {
      const machine = profileRecord(piece.machine);
      if (
        piece.kind !== "memory" ||
        piece.valueOffset !== 0 ||
        piece.byteLength !== width ||
        Number(machine.end) - Number(machine.start) !== width
      ) {
        continue;
      }
      const start = Number(machine.start);
      const owned = intervals.some((interval) => {
        const owner = profileRecord(interval.owner);
        return (
          interval.kind === "sfa" &&
          owner.kind === "function" &&
          owner.id === scope &&
          Number(interval.start) <= start &&
          Number(interval.end) >= start + width &&
          Number(interval.size) === Number(interval.end) - Number(interval.start)
        );
      });
      if (owned) addresses.push(start);
    }
  }
  return [...new Set(addresses)];
}

/** A failed proof keeps a complete separate home and one canonical function entry. */
function fallbackHome(
  artifacts: LibraryArtifacts,
  source: string,
  declaration = RESULT,
  width = 2,
): number {
  const symbols = sourceSymbols(artifacts, source, declaration, "src/game.blend::Game.make", width);
  expect(symbols).toHaveLength(1);
  const homes = fullHomes(artifacts, symbols[0]!, "src/game.blend::Game.make", width);
  expect(homes).toHaveLength(1);
  const functions = profileRecords(artifacts.debug.functions).filter(
    (entry) => entry.qualifiedName === "src/game.blend::Game.make",
  );
  expect(functions).toHaveLength(1);
  expect(profileRecords(functions[0]!.entryVariants)).toHaveLength(1);
  return homes[0]!;
}

/** Eligible construction must not retain a second complete callee-owned object. */
function expectBound(
  artifacts: LibraryArtifacts,
  source: string,
  declaration: string,
  width: number,
): void {
  const symbols = sourceSymbols(artifacts, source, declaration, "src/game.blend::Game.make", width);
  expect(symbols.length).toBeLessThanOrEqual(1);
  for (const symbol of symbols) {
    expect(fullHomes(artifacts, symbol, "src/game.blend::Game.make", width)).toEqual([]);
  }
}

/** Resolve an exact source NOP so unchecked writes can be observed before return copying. */
function observationMarker(artifacts: LibraryArtifacts, source: string, offset: number): number {
  const start = Buffer.byteLength(source.slice(0, offset));
  const end = start + Buffer.byteLength("asm_nop();");
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    (entry) => entry.path === "src/game.blend",
  );
  const functionIndex = profileRecords(artifacts.debug.functions).findIndex(
    (entry) => entry.qualifiedName === "src/game.blend::Game.make",
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  expect(functionIndex).toBeGreaterThanOrEqual(0);
  const matches = profileRecords(artifacts.debug.ranges).filter((range) => {
    const origin = profileRecord(range.origin);
    if (origin.kind !== "source") return false;
    const span = profileRecord(origin.span);
    const owner = profileRecord(range.owner);
    return (
      origin.kind === "source" &&
      span.sourceIndex === sourceIndex &&
      Number(span.startByte) >= start &&
      Number(span.endByte) <= end &&
      owner.kind === "function" &&
      owner.functionIndex === functionIndex
    );
  });
  expect(matches).toHaveLength(1);
  const machine = profileRecord(matches[0]!.machine);
  expect(Number(machine.end) - Number(machine.start)).toBe(1);
  const address = Number(machine.start);
  expect(libraryBytes(artifacts, address, 1)).toEqual([0xea]);
  return address;
}

/** Compile through public entry points, preserving the exact warning set. */
async function inspectBuild(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
  inspect: (
    artifacts: LibraryArtifacts,
    run: (
      inspect: (monitor: ViceMonitor, stopAt: (address: number) => Promise<void>) => Promise<void>,
    ) => Promise<void>,
  ) => Promise<void>,
  warnings: string[] = [],
): Promise<void> {
  await withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project, ...OPTIONS });
    expect(checked.kind).toBe("success");
    expect(checked.diagnostics.map((diagnostic) => diagnostic.code).sort()).toEqual(
      [...warnings].sort(),
    );
    const built = await buildProject({ project, ...OPTIONS });
    expect(built.kind).toBe("success");
    expect(built.diagnostics.map((diagnostic) => diagnostic.code).sort()).toEqual(
      [...warnings].sort(),
    );
    if (built.kind !== "success") throw new Error("Expected a successful build");
    const artifacts = await readProfileArtifacts(built);
    await inspect(artifacts, (probe) => withLibraryVice(built, artifacts, profile, probe));
  });
}

/** Observe published initialized values after main returns, before restoration. */
async function expectObserved(
  monitor: ViceMonitor,
  stopAt: (address: number) => Promise<void>,
  artifacts: LibraryArtifacts,
  source: string,
  expected: number[],
  declaration = OUTPUT,
): Promise<void> {
  await stopAt(libraryStartup(artifacts, "startup.restore"));
  const address = libraryGlobalAddress(
    artifacts,
    source,
    declaration,
    expected.length,
    "src/game.blend",
  );
  expect(Array.from(await monitor.readMemory(address, address + expected.length - 1))).toEqual(
    expected,
  );
}

describe.each(sourceLibraryProfiles)("returned-local safety on %s", (profile) => {
  // A local address can affect values even when it never escapes the invocation.
  it("should retain the original home when a branch observes its address", async () => {
    const source = `module Game; ${PAIR} ${OUTPUT}
function make(): Pair {
  ${RESULT} result.y = 7;
  if (lo(&result) == 0) { result.y = 99; }
  return result;
}
function main(): void { ${RECEIVED} ${PUBLISH} }`;
    await inspectBuild(source, profile, async (artifacts, run) => {
      const home = fallbackHome(artifacts, source);
      await run((monitor, stopAt) =>
        expectObserved(monitor, stopAt, artifacts, source, [1, (home & 255) === 0 ? 99 : 7]),
      );
    });
  });

  // Partial initialization remains legal; no value is promised for the remainder.
  it("should accept a partially initialized returned array in the frontend", async () => {
    const source = `module Game;
function make(): byte[2] { let rows: byte[2] = [7]; return rows; }
function main(): void { let received: byte[2] = make(); poke($D020, received[0]); }`;
    await withProfileProject(source, profile, async (project) => {
      const loaded = await loadProject({ project });
      expect(loaded.kind).toBe("success");
      if (loaded.kind !== "success") throw new Error("Expected a loaded project");
      const analyzed = analyzeProject(loaded.snapshot);
      expect(analyzed.kind).toBe("complete");
      expect(analyzed.diagnostics.map((diagnostic) => diagnostic.code).sort()).toEqual([
        "W10140",
        "W10190",
      ]);
    });
  });

  // The complete masked footprint fits the initialized object without a range solver.
  it("should bind complete masked-index writes to the fresh caller array", async () => {
    const rows = "let rows: byte[8] = [; 0];";
    const output = "let observed: byte[8] = [; 0];";
    const source = `module Game; ${output}
function make(): byte[8] {
  ${rows}
  for (let column: byte = 0; column < 8; column += 1) { rows[column & 7] = column; }
  return rows;
}
function main(): void {
  asm_php(); asm_sei(); asm_nop(); let received: byte[8] = make();
  observed = received; asm_plp();
}`;
    await inspectBuild(source, profile, async (artifacts, run) => {
      await run((monitor, stopAt) =>
        expectObserved(monitor, stopAt, artifacts, source, [0, 1, 2, 3, 4, 5, 6, 7], output),
      );
      expectBound(artifacts, source, rows, 8);
    });
  });

  // Unchecked indexing retains the original base, including writes just beyond the object.
  it("should target the original local base plus eight for an unchecked runtime index", async () => {
    const rows = "let rows: byte[8] = [; 0];";
    const received = "let received: byte[8] = make(runtimeIndex);";
    const source = `module Game; let runtimeIndex: byte = 8;
function make(index: byte): byte[8] {
  ${rows} asm_nop(); rows[index] = $6B; asm_nop(); return rows;
}
function main(): void {
  asm_php(); asm_sei(); ${received} poke($D020, received[0]); asm_plp();
}`;
    await inspectBuild(source, profile, async (artifacts, run) => {
      const original = fallbackHome(artifacts, source, rows, 8);
      const symbols = sourceSymbols(artifacts, source, received, "src/game.blend::Game.main", 8);
      expect(symbols).toHaveLength(1);
      const callerHomes = fullHomes(artifacts, symbols[0]!, "src/game.blend::Game.main", 8);
      expect(callerHomes).toHaveLength(1);
      const caller = callerHomes[0]!;
      expect(original + 8 <= caller || caller + 8 <= original).toBe(true);
      const first = source.indexOf("asm_nop();");
      const second = source.indexOf("asm_nop();", first + 1);
      const before = observationMarker(artifacts, source, first);
      const after = observationMarker(artifacts, source, second);
      await run(async (monitor, stopAt) => {
        await stopAt(libraryEntry(artifacts, "src/game.blend::Game.make"));
        await stopAt(before);
        const originalTarget = (original + 8) & 0xffff;
        // The adjacent byte holds the live index, so the sentinel must preserve index eight.
        await monitor.writeMemory(originalTarget, Uint8Array.of(8));
        expect(Array.from(await monitor.readMemory(originalTarget, originalTarget))).toEqual([8]);
        const write = await monitor.setAccessTracepoint(originalTarget, "store");
        monitor.takeCheckpointHits();
        await stopAt(after + 1);
        expect(Array.from(await monitor.readMemory(originalTarget, originalTarget))).toEqual([
          0x6b,
        ]);
        expect(monitor.takeCheckpointHits().filter((id) => id === write)).toEqual([write]);
        await monitor.deleteCheckpoint(write);
        // Adjacent storage may have been corrupted. Teardown ends the emulator here.
      });
    });
  });

  // A known runtime device address is not a static proof about an unknown pointer.
  it("should preserve one unknown-address read and the complete local home", async () => {
    const source = `module Game; ${PAIR} ${OUTPUT}
function make(address: word): Pair {
  ${RESULT} result.y = peek(address) & 15; return result;
}
function main(): void { let received: Pair = make($D020); ${PUBLISH} }`;
    await inspectBuild(source, profile, async (artifacts, run) => {
      fallbackHome(artifacts, source);
      await run(async (monitor, stopAt) => {
        await stopAt(libraryEntry(artifacts, "src/game.blend::Game.make"));
        await monitor.writeIo(0xd020, Uint8Array.of(7));
        const read = await monitor.setAccessTracepoint(0xd020, "load");
        monitor.takeCheckpointHits();
        await expectObserved(monitor, stopAt, artifacts, source, [1, 7]);
        expect(monitor.takeCheckpointHits().filter((id) => id === read)).toEqual([read]);
        await monitor.deleteCheckpoint(read);
      });
    });
  });

  // Hardware-visible activity during construction requires an observer proof.
  it("should retain the complete home when construction changes a hardware observer", async () => {
    const source = `module Game; ${PAIR} ${OUTPUT}
function make(): Pair { ${RESULT} poke($D018, $18); result.y = 7; return result; }
function main(): void { ${RECEIVED} ${PUBLISH} }`;
    await inspectBuild(source, profile, async (artifacts, run) => {
      fallbackHome(artifacts, source);
      await run(async (monitor, stopAt) => {
        await stopAt(libraryEntry(artifacts, "src/game.blend::Game.make"));
        const write = await monitor.setAccessTracepoint(0xd018, "store");
        monitor.takeCheckpointHits();
        await expectObserved(monitor, stopAt, artifacts, source, [1, 7]);
        expect(monitor.takeCheckpointHits().filter((id) => id === write)).toEqual([write]);
        await monitor.deleteCheckpoint(write);
      });
    });
  });

  // A generated interrupt may observe an unknown raw address before the return.
  it("should retain the complete home with a live IRQ unknown-address reader", async () => {
    const source = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
${PAIR} ${OUTPUT} let address: word = $D020;
interrupt function observer(): void { poke($D021, peek(address)); }
function make(): Pair { ${RESULT} result.y = 7; return result; }
function main(): void { setIRQ(&observer); ${RECEIVED} ${PUBLISH} restoreIRQ(); }`;
    await inspectBuild(source, profile, async (artifacts, run) => {
      fallbackHome(artifacts, source);
      await run((monitor, stopAt) => expectObserved(monitor, stopAt, artifacts, source, [1, 7]));
    });
  });

  // The same IRQ-masked call binds only when no generated NMI observer is live.
  for (const liveNmi of [true, false]) {
    it(`should ${liveNmi ? "retain the complete home with" : "bind the fresh destination without"} a live NMI observer under I=1`, async () => {
      const source = `module Game;
${liveNmi ? "import { setNMI, restoreNMI } from c64.system;" : ""}
${PAIR} ${OUTPUT}
interrupt function observer(): void { poke($D018, $18); }
function make(): Pair { ${RESULT} result.y = 7; return result; }
function main(): void {
  asm_php(); asm_sei(); asm_nop(); ${liveNmi ? "setNMI(&observer);" : ""}
  ${RECEIVED} ${PUBLISH} poke($D020, received.y);
  ${liveNmi ? "restoreNMI();" : ""} asm_plp();
}`;
      await inspectBuild(
        source,
        profile,
        async (artifacts, run) => {
          await run(async (monitor, stopAt) => {
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.make"));
            expect((await monitor.readCpuRegisters()).p & 4).toBe(4);
            await expectObserved(monitor, stopAt, artifacts, source, [1, 7]);
          });
          if (liveNmi) fallbackHome(artifacts, source);
          else expectBound(artifacts, source, RESULT, 2);
        },
        liveNmi ? [] : ["W10181"],
      );
    });
  }

  // Taking the ordinary function value keeps its stable ABI even with a direct caller.
  it("should retain the canonical local and values for indirect and direct calls", async () => {
    const output = "let observed: byte[4] = [; 0];";
    const source = `module Game; ${PAIR} ${output}
function make(): Pair { ${RESULT} result.y = 7; return result; }
function main(): void {
  let callback: fn(): Pair = &make;
  let indirect: Pair = callback();
  ${RECEIVED}
  observed[0] = indirect.x; observed[1] = indirect.y;
  observed[2] = received.x; observed[3] = received.y;
}`;
    await inspectBuild(source, profile, async (artifacts, run) => {
      fallbackHome(artifacts, source);
      await run((monitor, stopAt) =>
        expectObserved(monitor, stopAt, artifacts, source, [1, 7, 1, 7], output),
      );
    });
  });
});
