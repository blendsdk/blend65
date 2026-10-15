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

const declarations = `module Game;
place(at: $3200) let x: byte;
place(at: $3201) let y: byte;
place(at: $3300) let sample: byte = 0;
place(at: $3400) let answers: byte[256] = [; 0];
`;
const qualified = (name: string) => `src/game.blend::Game.${name}`;

/** Build real legal source, reconcile its charged bytes, and retain the live generation. */
async function inspectBytes(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
  inspect: (
    artifacts: LibraryArtifacts,
    monitor: ViceMonitor,
    stopAt: (address: number) => Promise<void>,
  ) => Promise<void>,
  prepare?: (monitor: ViceMonitor) => Promise<void>,
): Promise<void> {
  await withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    if (checked.kind !== "success") throw new Error("Expected legal byte-selection source");
    const built = await buildProject({ project, optimization: "size" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected a complete size-mode build");
    const artifacts = await readProfileArtifacts(built);
    expectLibraryAccounting(artifacts);
    for (const id of ["zeroPage", "residentRam", "hardwareStack", "scratch"]) {
      const resources = profileRecords(profileRecord(artifacts.costs.totals).resources).filter(
        (resource) => resource.kind === "standard" && resource.id === id,
      );
      expect(resources, id).toHaveLength(1);
      const value = resources[0]!.value;
      expect(typeof value === "number" && Number.isInteger(value) && value >= 0, id).toBe(true);
    }
    // Generated stack domains are bounded evidence; they do not certify external NMI nesting.
    for (const domain of profileRecords(artifacts.memory.stackDomains)) {
      const { peakBytes, headroomBytes, capacityBytes } = domain;
      for (const value of [peakBytes, headroomBytes, capacityBytes])
        expect(typeof value === "number" && Number.isInteger(value) && value >= 0).toBe(true);
      if (
        typeof peakBytes !== "number" ||
        typeof headroomBytes !== "number" ||
        typeof capacityBytes !== "number"
      )
        throw new TypeError("Stack domains require integer capacity evidence");
      expect(peakBytes + headroomBytes).toBe(capacityBytes);
    }
    await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
      await prepare?.(monitor);
      await stopAt(libraryEntry(artifacts, qualified("main")));
      await inspect(artifacts, monitor, stopAt);
    });
  });
}

/** Bound mnemonic inspection by published function entries and the startup restoration entry. */
function functionAssembly(artifacts: LibraryArtifacts, name: string): string {
  const entries = profileRecords(artifacts.debug.functions).flatMap((fn) => {
    if (typeof fn.qualifiedName !== "string") throw new TypeError("Missing function identity");
    return profileRecords(fn.entryVariants).map((variant) => {
      if (typeof variant.label !== "string") throw new TypeError("Missing function entry label");
      const escaped = variant.label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const match = new RegExp(`^\\s*${escaped}:?\\s*(?:;[^\\n]*)?$`, "mu").exec(
        artifacts.assembly,
      );
      if (match === null) throw new Error(`Missing assembly entry ${variant.label}`);
      return { name: fn.qualifiedName, start: match.index + match[0].length, label: match.index };
    });
  });
  const wanted = entries.filter((entry) => entry.name === qualified(name));
  expect(wanted, name).toHaveLength(1);
  const start = wanted[0]!.start;
  const restoreAddress = libraryStartup(artifacts, "startup.restore");
  const restoreLabels = [...artifacts.labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)]
    .filter((match) => Number.parseInt(match[2]!, 16) === restoreAddress)
    .flatMap((match) => {
      const escaped = match[1]!.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const definition = new RegExp(`^\\s*${escaped}:?\\s*(?:;[^\\n]*)?$`, "mu").exec(
        artifacts.assembly,
      );
      return definition === null ? [] : [definition.index];
    });
  expect(restoreLabels.length).toBeGreaterThan(0);
  const next = [...entries.map((entry) => entry.label), ...restoreLabels]
    .filter((label) => label > start)
    .sort((a, b) => a - b)[0];
  return artifacts.assembly.slice(start, next);
}

/** Locate one actual ordinary JSR and inspect only its immediately following instructions. */
function afterCall(artifacts: LibraryArtifacts, caller: string, callee: string): number[] {
  const address = libraryEntry(artifacts, qualified(callee));
  const bytes = libraryFunctionBytes(artifacts, qualified(caller));
  const indexes = bytes.flatMap((byte, index) =>
    byte === 0x20 && bytes[index + 1] === (address & 255) && bytes[index + 2] === address >> 8
      ? [index]
      : [],
  );
  expect(indexes, `${caller} calls ${callee}`).toHaveLength(1);
  return bytes.slice(indexes[0]! + 3);
}

describe.each(sourceLibraryProfiles)("byte availability on %s", (profile) => {
  it("should retain the left byte through comparison and AND for every byte pair", async () => {
    // Each row is independently checked; aggregate counts cannot hide a wrong individual answer.
    const source = `${declarations}
place(at: $3500) let truth: boolean[256] = [; false];
let effects: byte = 0;
function predicate(): boolean { return x != y && (x & y) != 0; }
function rightSide(): boolean { effects += 1; return (x & y) != 0; }
function guarded(): boolean { return x != y && rightSide(); }
function rowReady(): void { asm_nop(); }
function main(): void {
  for (let row: word = 0; row < 256; row += 1) {
    x = byte(row);
    for (let column: word = 0; column < 256; column += 1) {
      y = byte(column);
      truth[column] = predicate();
    }
    rowReady();
  }
  x = 3; y = 1; effects = 0;
  answers[0] = guarded() ? 1 : 0; answers[1] = effects;
  x = 1; y = 1; effects = 0;
  answers[2] = guarded() ? 1 : 0; answers[3] = effects;
  x = 0; y = 1; effects = 0;
  answers[4] = guarded() ? 1 : 0; answers[5] = effects;
}`;
    await inspectBytes(source, profile, async (artifacts, monitor, stopAt) => {
      const bytes = libraryFunctionBytes(artifacts, qualified("predicate"));
      // Absolute LDA/CMP/BEQ/AND costs eleven bytes before Boolean materialization.
      expect(bytes.slice(0, 7)).toEqual([0xad, 0, 0x32, 0xcd, 1, 0x32, 0xf0]);
      expect(bytes.slice(8, 11)).toEqual([0x2d, 1, 0x32]);
      expect(bytes[7]).toBeGreaterThanOrEqual(3);
      expect(8 + bytes[7]!).toBeLessThan(bytes.length);
      for (let x = 0; x < 256; x += 1) {
        await stopAt(libraryEntry(artifacts, qualified("rowReady")));
        const expected = Array.from({ length: 256 }, (_, y) => Number(x !== y && (x & y) !== 0));
        expect([...(await monitor.readMemory(0x3500, 0x35ff))], `x=${x}`).toEqual(expected);
      }
      await stopAt(libraryStartup(artifacts, "startup.restore"));
      expect([...(await monitor.readMemory(0x3400, 0x3405))]).toEqual([1, 1, 0, 0, 0, 1]);
    });
  }, 300_000);

  it.each([
    [0x80, 0x81, 0],
    [0xff, 0xff, 1],
    [0, 1, 8],
    [3, 1, 9],
  ] as const)(
    "should preserve captured %i against %i across calls loads and restored status %i",
    async (x, y, flags) => {
      // Incoming carry and decimal state cannot change byte comparison or bitwise meanings.
      const source = `${declarations}
function overwriteA(): byte { poke($C110, $55); return peek($C111); }
function captured(): void {
  asm_php();
  let different: boolean = x != y;
  sample = x;
  let loaded: byte = overwriteA();
  answers[1] = peek($C112);
  asm_plp();
  answers[0] = different ? sample & y : 0;
  answers[2] = peek(&sample);
  answers[3] = loaded;
}
function main(): void { asm_php(); asm_nop(); asm_plp(); captured(); }
`;
      await inspectBytes(
        source,
        profile,
        async (artifacts, monitor, stopAt) => {
          const main = libraryEntry(artifacts, qualified("main"));
          expect(libraryFunctionBytes(artifacts, qualified("main")).slice(0, 3)).toEqual([
            0x08, 0xea, 0x28,
          ]);
          const restore = libraryStartup(artifacts, "startup.restore");
          const traces = [
            await monitor.setAccessTracepoint(0x3300, "store"),
            await monitor.setAccessTracepoint(0xc110, "store"),
            await monitor.setAccessTracepoint(0xc111, "load"),
            await monitor.setAccessTracepoint(0xc112, "load"),
          ];
          try {
            await monitor.writeMemory(0xc111, Uint8Array.of(0xa7, 0x5c));
            await stopAt(main + 1);
            const registers = await monitor.readCpuRegisters();
            const savedAddress = 0x100 | ((registers.sp + 1) & 255);
            const saved = (await monitor.readMemory(savedAddress, savedAddress))[0]!;
            // Restoring the opposite Z makes a stale condition flag observably wrong on either path.
            const unrelatedZero = x !== y ? 2 : 0;
            await monitor.writeMemory(
              savedAddress,
              Uint8Array.of((saved & ~11) | flags | unrelatedZero),
            );
            await stopAt(main + 3);
            expect((await monitor.readCpuRegisters()).p & 11).toBe(flags | unrelatedZero);
            monitor.takeCheckpointHits();
            await stopAt(restore);
            expect([...(await monitor.readMemory(0x3400, 0x3403))]).toEqual([
              x !== y ? x & y : 0,
              0x5c,
              x,
              0xa7,
            ]);
            const hits = monitor.takeCheckpointHits().filter((hit) => traces.includes(hit));
            expect(hits).toEqual(traces);
          } finally {
            for (const checkpoint of traces) await monitor.deleteCheckpoint(checkpoint);
          }
        },
        async (monitor) => {
          await monitor.writeMemory(0x3200, Uint8Array.of(x, y));
        },
      );
    },
    300_000,
  );

  it.each([0, 1, 0x80, 0xff])(
    "should return canonical Booleans for %i and branch only from certified exits",
    async (x) => {
      // Both helper exits must agree with returned A; PLP alone does not imply an invalid exit.
      const source = `${declarations}
function clean(): boolean { if (x == 0) { return false; } return true; }
function restored(): boolean {
  asm_php();
  let result: boolean = x != 0;
  asm_plp();
  return result;
}
function cleanCaller(): void { if (clean()) { answers[2] = 7; } else { answers[2] = 9; } }
function restoredCaller(): void {
  if (restored()) { answers[3] = 11; } else { answers[3] = 13; }
}
function main(): void {
  answers[0] = clean() ? 1 : 0;
  answers[1] = restored() ? 1 : 0;
  cleanCaller(); restoredCaller();
}`;
      await inspectBytes(
        source,
        profile,
        async (artifacts, monitor, stopAt) => {
          const direct = afterCall(artifacts, "cleanCaller", "clean");
          expect([0xf0, 0xd0]).toContain(direct[0]);
          const restored = libraryFunctionBytes(artifacts, qualified("restored"));
          const caller = afterCall(artifacts, "restoredCaller", "restored");
          if (restored.slice(-2).join(",") === "40,96") {
            expect(caller.slice(0, 2)).toEqual([0xc9, 0]);
            expect([0xf0, 0xd0]).toContain(caller[2]);
          }
          for (const [callerName, suffix] of [
            ["cleanCaller", direct],
            ["restoredCaller", caller],
          ] as const) {
            const bytes = libraryFunctionBytes(artifacts, qualified(callerName));
            await stopAt(
              libraryEntry(artifacts, qualified(callerName)) + bytes.length - suffix.length,
            );
            const registers = await monitor.readCpuRegisters();
            expect(registers.a).toBe(Number(x !== 0));
            if ([0xf0, 0xd0].includes(suffix[0]!)) expect(registers.p & 2).toBe(x === 0 ? 2 : 0);
          }
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect([...(await monitor.readMemory(0x3400, 0x3403))]).toEqual(
            x === 0 ? [0, 0, 9, 13] : [1, 1, 7, 11],
          );
        },
        async (monitor) => {
          await monitor.writeMemory(0x3200, Uint8Array.of(x));
        },
      );
    },
    300_000,
  );

  it.each([0, 255])(
    "should reuse one complement of stable byte %i across two fixed loops",
    async (g) => {
      // Stability permits one ordinary sample and one EOR; each iteration must still write its answer.
      const source = `${declarations}
function stable(): void {
  for (let i: word = 0; i < 4; i += 1) { answers[i] = ~x; }
  for (let i: word = 4; i < 8; i += 1) { answers[i] = ~x; }
}
function main(): void { stable(); }`;
      await inspectBytes(
        source,
        profile,
        async (artifacts, monitor, stopAt) => {
          const complements =
            functionAssembly(artifacts, "stable").match(
              /^\s+eor\s+#(?:\$ff|255)\s*(?:;[^\n]*)?$/gimu,
            ) ?? [];
          expect(complements).toHaveLength(1);
          const load = await monitor.setAccessTracepoint(0x3200, "load");
          monitor.takeCheckpointHits();
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect([...(await monitor.readMemory(0x3400, 0x3407))]).toEqual(Array(8).fill(g ^ 255));
          expect(monitor.takeCheckpointHits().filter((hit) => hit === load)).toEqual([load]);
          await monitor.deleteCheckpoint(load);
        },
        async (monitor) => {
          await monitor.writeMemory(0x3200, Uint8Array.of(g));
        },
      );
    },
    300_000,
  );

  it.each([0x3200, 0xc130])(
    "should invalidate a complement after body writes and raw alias %i",
    async (address) => {
      // A runtime pointer can name x or a disjoint byte; neither route permits assuming a stable x.
      const source = `${declarations}
function changing(): void {
  for (let i: word = 0; i < 8; i += 1) {
    x = byte(i); answers[i] = ~x; answers[i + 16] = peek(&x);
  }
}
function aliased(): void {
  for (let i: word = 0; i < 8; i += 1) {
    poke(peekw($C120), byte(i)); answers[i + 8] = ~x;
  }
}
function main(): void { changing(); x = 0; aliased(); }`;
      await inspectBytes(source, profile, async (artifacts, monitor, stopAt) => {
        await monitor.writeMemory(0xc120, Uint8Array.of(address & 255, address >> 8));
        const stores = await monitor.setAccessTracepoint(0x3200, "store");
        const rawStores =
          address === 0x3200 ? stores : await monitor.setAccessTracepoint(address, "store");
        const pointerLoads = [
          await monitor.setAccessTracepoint(0xc120, "load"),
          await monitor.setAccessTracepoint(0xc121, "load"),
        ];
        monitor.takeCheckpointHits();
        await stopAt(libraryStartup(artifacts, "startup.restore"));
        const expected = Array.from({ length: 8 }, (_, i) => 255 ^ i);
        expect([...(await monitor.readMemory(0x3400, 0x340f))]).toEqual([
          ...expected,
          ...(address === 0x3200 ? expected : Array(8).fill(255)),
        ]);
        expect([...(await monitor.readMemory(0x3410, 0x3417))]).toEqual(
          Array.from({ length: 8 }, (_, i) => i),
        );
        const hits = monitor.takeCheckpointHits();
        expect(hits.filter((hit) => hit === stores)).toHaveLength(address === 0x3200 ? 17 : 9);
        if (address !== 0x3200) expect(hits.filter((hit) => hit === rawStores)).toHaveLength(8);
        expect(hits.filter((hit) => pointerLoads.includes(hit))).toEqual(
          Array.from({ length: 8 }, () => pointerLoads).flat(),
        );
        // A non-ZP runtime pointer needs a real invocation-private two-byte indirect-address home.
        const zp = profileRecords(profileRecord(artifacts.costs.totals).resources).find(
          (resource) => resource.kind === "standard" && resource.id === "zeroPage",
        );
        if (typeof zp?.value !== "number") throw new TypeError("Missing zero-page cost");
        expect(zp.value).toBeGreaterThanOrEqual(2);
        expect(functionAssembly(artifacts, "aliased")).toMatch(/^\s+sta\s+\([^\n]+\)/imu);
        for (const checkpoint of new Set([stores, rawStores, ...pointerLoads]))
          await monitor.deleteCheckpoint(checkpoint);
      });
    },
    300_000,
  );

  it("should retain volatile samples and skip an effectful producer in a zero-trip loop", async () => {
    // Volatile reads are separate source events, even when the returned bytes happen to agree.
    const source = `${declarations}
function producer(): byte { poke($C111, 1); return peek($C110); }
function volatileLoop(): void {
  for (let i: word = 0; i < 8; i += 1) { answers[i] = ~peek($C110); }
}
function zeroTrip(): void {
  for (let i: word = 0; i < 0; i += 1) { answers[8] = ~producer(); }
}
function main(): void { volatileLoop(); zeroTrip(); }`;
    await inspectBytes(source, profile, async (artifacts, monitor, stopAt) => {
      // Volatile absolute sample plus EOR #$FF is a five-byte instruction core.
      const bytes = libraryFunctionBytes(artifacts, qualified("volatileLoop"));
      const cores = bytes.flatMap((_, index) =>
        bytes.slice(index, index + 5).join(",") === "173,16,193,73,255" ? [index] : [],
      );
      expect(cores.length).toBeGreaterThanOrEqual(1);
      await monitor.writeMemory(0xc110, Uint8Array.of(0x80, 0xa5));
      await monitor.writeMemory(0x3408, Uint8Array.of(0x3c));
      const load = await monitor.setAccessTracepoint(0xc110, "load");
      const store = await monitor.setAccessTracepoint(0xc111, "store");
      monitor.takeCheckpointHits();
      await stopAt(libraryStartup(artifacts, "startup.restore"));
      expect([...(await monitor.readMemory(0x3400, 0x3408))]).toEqual([
        ...Array(8).fill(0x7f),
        0x3c,
      ]);
      expect([...(await monitor.readMemory(0xc111, 0xc111))]).toEqual([0xa5]);
      expect(monitor.takeCheckpointHits().filter((hit) => hit === load || hit === store)).toEqual(
        Array(8).fill(load),
      );
      for (const checkpoint of [load, store]) await monitor.deleteCheckpoint(checkpoint);
    });
  }, 300_000);
});
