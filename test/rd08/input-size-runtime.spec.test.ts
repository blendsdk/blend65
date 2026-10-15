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
  libraryBytes,
  libraryEntry,
  libraryGlobalAddress,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryVice,
} from "../rd05/source-library-fixture.js";
import type { LibraryArtifacts } from "../rd05/source-library-fixture.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";

const savedDeclaration = "let saved: InputSnapshot";
const savedSource = `module Game;
import { InputSnapshot, SnapshotQuality, Key, JoystickPort, JoystickControl,
  keyState, joystickState } from c64.input;
place(at: $3200) let saved: InputSnapshot;
place(at: $3400) let answers: byte[7] = [; 0];
function main(): void {
  answers[0] = keyState(saved, Key.SPACE);
  answers[1] = keyState(saved, Key.DELETE);
  answers[2] = joystickState(saved, JoystickPort.PORT_1, JoystickControl.UP);
  answers[3] = joystickState(saved, JoystickPort.PORT_2, JoystickControl.DOWN);
  answers[4] = keyState(saved, Key(64));
  answers[5] = joystickState(saved, JoystickPort(3), JoystickControl.UP);
  answers[6] = joystickState(saved, JoystickPort.PORT_1, JoystickControl(5));
}`;

// These examples describe contact graphs independently of the source library's classifier.
const savedCases = [
  {
    name: "released contacts",
    rows: [255, 255, 255, 255, 255, 255, 255, 255],
    j1: 255,
    j2: 255,
    quality: 0,
    expected: [1, 1, 1, 1],
  },
  {
    name: "one closed SPACE contact",
    rows: [255, 255, 255, 255, 255, 255, 255, 239],
    j1: 255,
    j2: 255,
    quality: 0,
    expected: [0, 1, 1, 1],
  },
  {
    name: "a floating two-column two-row ghost block",
    rows: [252, 252, 255, 255, 255, 255, 255, 255],
    j1: 255,
    j2: 255,
    quality: 0,
    expected: [1, 2, 1, 1],
  },
  {
    name: "overlapping unequal row sets",
    rows: [252, 254, 255, 255, 255, 255, 255, 255],
    j1: 255,
    j2: 255,
    quality: 0,
    expected: [1, 2, 1, 1],
  },
  {
    name: "one grounded PB row without a grounded PA column",
    rows: [254, 254, 254, 254, 254, 254, 254, 254],
    j1: 254,
    j2: 255,
    quality: 0,
    expected: [1, 1, 0, 1],
  },
  {
    name: "one grounded PA column without a grounded PB row",
    rows: [255, 255, 255, 255, 255, 255, 255, 255],
    j1: 255,
    j2: 253,
    quality: 0,
    expected: [1, 1, 1, 0],
  },
  ...[1, 2, 255].map((quality) => ({
    name: `non-complete acquisition quality ${quality}`,
    rows: [255, 255, 255, 255, 255, 255, 255, 255],
    j1: 255,
    j2: 255,
    quality,
    expected: [2, 2, 2, 2],
  })),
];

/** Check ordinary source before building and keep its generation alive for bounded native observation. */
async function inspectSize(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
  inspect: (
    artifacts: LibraryArtifacts,
    monitor: ViceMonitor,
    stopAt: (address: number) => Promise<void>,
  ) => Promise<void>,
  prepare: (monitor: ViceMonitor) => Promise<void>,
): Promise<void> {
  await withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    if (checked.kind !== "success") throw new Error("Expected legal ordinary input source");
    const built = await buildProject({ project, optimization: "size" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected a complete size build");
    const artifacts = await readProfileArtifacts(built);
    expectLibraryAccounting(artifacts);
    expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
    await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
      // Incoming storage must exist before startup can legally read or optimize its contents.
      await prepare(monitor);
      await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));
      await inspect(artifacts, monitor, stopAt);
    });
  });
}

describe.each(sourceLibraryProfiles)("ordinary size input runtime on %s", (profile) => {
  it.each(savedCases)(
    "should preserve saved bytes and classify $name without fresh device access",
    async ({ rows, j1, j2, quality, expected }) => {
      // Retaining a snapshot permits repeatable pure queries; illegal enum bytes remain uncertain.
      const snapshot = Uint8Array.from([...rows, j1, j2, quality]);
      await inspectSize(
        savedSource,
        profile,
        async (artifacts, monitor, stopAt) => {
          expect(
            libraryGlobalAddress(artifacts, savedSource, savedDeclaration, 11, "src/game.blend"),
          ).toBe(0x3200);
          // Exclude firmware timer traffic from the interval that measures the pure queries.
          await monitor.writeIo(0xdc0d, Uint8Array.of(0x7f));
          await monitor.writeIo(0xdc0e, Uint8Array.of(0, 0));
          const forbidden: number[] = [];
          for (const base of [0xdc00, 0xdd00])
            for (let offset = 0; offset < 16; offset += 1) {
              forbidden.push(await monitor.setAccessTracepoint(base + offset, "load"));
              forbidden.push(await monitor.setAccessTracepoint(base + offset, "store"));
            }
          for (let offset = 0; offset < 11; offset += 1)
            forbidden.push(await monitor.setAccessTracepoint(0x3200 + offset, "store"));
          monitor.takeCheckpointHits();
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect([...(await monitor.readMemory(0x3400, 0x3406))]).toEqual([...expected, 2, 2, 2]);
          expect(await monitor.readMemory(0x3200, 0x320a)).toEqual(snapshot);
          expect(monitor.takeCheckpointHits().filter((hit) => forbidden.includes(hit))).toEqual([]);
        },
        async (monitor) => {
          await monitor.writeMemory(0x3200, snapshot);
        },
      );
    },
    300_000,
  );

  it("should read a wrapped word once in little-endian bus order", async () => {
    const source = `module Game;
place(at: $3400) let answers: byte[2] = [; 0];
function main(): void {
  asm_sei();
  let value: word = peekw($FFFF);
  answers[0] = lo(value);
  answers[1] = hi(value);
}`;
    await inspectSize(
      source,
      profile,
      async (artifacts, monitor, stopAt) => {
        // Startup may read the CPU port; only main's source operation is observed here.
        expect([...(await monitor.readMemory(0, 0))]).toEqual([0x2f]);
        expect([...(await monitor.readMemory(0xffff, 0xffff))]).toEqual([0xff]);
        await monitor.writeIo(0xdc0d, Uint8Array.of(0x7f));
        await monitor.writeIo(0xdc0e, Uint8Array.of(0, 0));
        const lowRead = await monitor.setAccessTracepoint(0xffff, "load");
        const highRead = await monitor.setAccessTracepoint(0, "load");
        monitor.takeCheckpointHits();
        await stopAt(libraryStartup(artifacts, "startup.restore"));
        const reads = monitor
          .takeCheckpointHits()
          .filter((hit) => hit === lowRead || hit === highRead);
        expect(reads).toEqual([lowRead, highRead]);
        expect([...(await monitor.readMemory(0x3400, 0x3401))]).toEqual([0xff, 0x2f]);
      },
      async (monitor) => {
        await monitor.writeMemory(0, Uint8Array.of(0x2f));
      },
    );
  }, 300_000);

  it("should read runtime word-indexed VIC mirrors without a page-cross dummy device read", async () => {
    const source = `module Game;
place(at: $3200) let indices: word[2];
place(at: $3400) let answers: byte[2] = [; 0];
function main(): void {
  asm_sei();
  answers[0] = peek($D0FF + indices[0]);
  answers[1] = peek($D0FF + indices[1]);
}`;
    await inspectSize(
      source,
      profile,
      async (artifacts, monitor, stopAt) => {
        const functions = profileRecords(artifacts.debug.functions);
        const ranges = profileRecords(artifacts.debug.ranges);
        const spaces = profileRecords(artifacts.debug.addressSpaces);
        const mainIndexes = functions.flatMap((fn, index) =>
          fn.qualifiedName === "src/game.blend::Game.main" ? [index] : [],
        );
        expect(mainIndexes).toHaveLength(1);
        const mainIndex = mainIndexes[0]!;
        const main = functions[mainIndex]!;
        expect(main.kind).toBe("ordinary");
        if (!Array.isArray(main.rangeIndexes)) throw new Error("Expected machine range indexes");
        const rangeIndexes = main.rangeIndexes;
        expect(rangeIndexes.length).toBeGreaterThan(0);
        const operationBytes = new Map<number, number>();
        for (const rangeIndex of rangeIndexes) {
          expect(Number.isInteger(rangeIndex)).toBe(true);
          expect(typeof rangeIndex).toBe("number");
          if (typeof rangeIndex !== "number") throw new Error("Expected a machine range index");
          expect(rangeIndex).toBeGreaterThanOrEqual(0);
          expect(rangeIndex).toBeLessThan(ranges.length);
          const range = ranges[rangeIndex]!;
          expect(range.owner).toEqual({ kind: "function", functionIndex: mainIndex });
          const machine = profileRecord(range.machine);
          expect(Number.isInteger(machine.addressSpaceIndex)).toBe(true);
          expect(typeof machine.addressSpaceIndex).toBe("number");
          if (typeof machine.addressSpaceIndex !== "number")
            throw new Error("Expected a machine address-space index");
          expect(machine.addressSpaceIndex).toBeGreaterThanOrEqual(0);
          expect(machine.addressSpaceIndex).toBeLessThan(spaces.length);
          expect(spaces[machine.addressSpaceIndex]).toMatchObject({
            kind: "cpu",
            sizeBytes: 65536,
            banks: [],
          });
          expect(Number.isInteger(machine.start)).toBe(true);
          expect(Number.isInteger(machine.end)).toBe(true);
          if (typeof machine.start !== "number" || typeof machine.end !== "number")
            throw new Error("Expected half-open machine addresses");
          expect(machine.start).toBeGreaterThanOrEqual(0);
          expect(machine.end).toBeLessThanOrEqual(65536);
          expect(machine.end).toBeGreaterThan(machine.start);
          const bytes = libraryBytes(artifacts, machine.start, machine.end - machine.start);
          for (const [offset, value] of bytes.entries())
            operationBytes.set(machine.start + offset, value);
        }
        // VICE's binary monitor omits some NMOS dummy reads. Final-read tracepoints alone
        // cannot prove safety: these exact indexed loads would also read $D000 for index 1.
        // Contiguous declared ranges are checked together without inspecting unrelated PRG bytes.
        for (const [address, opcode] of operationBytes) {
          const form = [opcode, operationBytes.get(address + 1), operationBytes.get(address + 2)];
          expect(form).not.toEqual([0xbd, 0xff, 0xd0]);
          expect(form).not.toEqual([0xb9, 0xff, 0xd0]);
        }
        expect([...(await monitor.readMemory(0x3200, 0x3203))]).toEqual([0, 0, 1, 0]);
        await monitor.writeIo(0xd000, Uint8Array.of(0x21));
        await monitor.writeIo(0xdc0d, Uint8Array.of(0x7f));
        await monitor.writeIo(0xdc0e, Uint8Array.of(0, 0));
        const firstRead = await monitor.setAccessTracepoint(0xd0ff, "load");
        const secondRead = await monitor.setAccessTracepoint(0xd100, "load");
        const unintendedRead = await monitor.setAccessTracepoint(0xd000, "load");
        monitor.takeCheckpointHits();
        await stopAt(libraryStartup(artifacts, "startup.restore"));
        const reads = monitor
          .takeCheckpointHits()
          .filter((hit) => [firstRead, secondRead, unintendedRead].includes(hit));
        expect(reads).toEqual([firstRead, secondRead]);
        expect([...(await monitor.readMemory(0x3400, 0x3401))]).toEqual([0xff, 0x21]);
      },
      async (monitor) => {
        await monitor.writeMemory(0x3200, Uint8Array.of(0, 0, 1, 0));
      },
    );
  }, 300_000);

  it.each([
    {
      name: "released inputs with stopped timers",
      controlA: 0,
      controlB: 0,
      callerIrqEnabled: true,
      available: true,
    },
    {
      name: "released inputs with running timers and PBON clear",
      controlA: 0x11,
      controlB: 0x11,
      callerIrqEnabled: false,
      available: true,
    },
    {
      name: "timer A PBON contamination",
      controlA: 2,
      controlB: 0,
      callerIrqEnabled: true,
      available: false,
    },
    {
      name: "timer B PBON contamination",
      controlA: 0,
      controlB: 2,
      callerIrqEnabled: false,
      available: false,
    },
  ])(
    "should preserve acquisition effects and caller state for $name",
    async ({ controlA, controlB, callerIrqEnabled, available }) => {
      const source = `module Game;
import { InputSnapshot, readInputSnapshot } from c64.input;
import { setNMI, restoreNMI } from c64.system;
place(at: $3200) let saved: InputSnapshot;
interrupt function priorNmi(): void { asm_nop(); }
function beforeScan(): void { asm_nop(); }
function afterScan(): void { asm_nop(); }
function main(): void {
  asm_php();
  asm_sei();
  setNMI(&priorNmi);
  ${callerIrqEnabled ? "asm_cli();" : "asm_sei();"}
  beforeScan();
  saved = readInputSnapshot();
  afterScan();
  restoreNMI();
  asm_plp();
}`;
      await inspectSize(
        source,
        profile,
        async (artifacts, monitor, stopAt) => {
          expect(
            libraryGlobalAddress(artifacts, source, savedDeclaration, 11, "src/game.blend"),
          ).toBe(0x3200);
          // Generated NMINV installers require the pinned stock entry vector.
          const stockVector = await monitor.readMemory(0x318, 0x319);
          expect([...stockVector]).toEqual([0x47, 0xfe]);
          // Mask host timer IRQs before the fixture enables caller IRQ recognition.
          await monitor.writeIo(0xdc0d, Uint8Array.of(0x7f));
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.beforeScan"));
          const priorVector = await monitor.readMemory(0x318, 0x319);
          expect(priorVector[0]! | (priorVector[1]! << 8)).toBe(
            libraryEntry(artifacts, "src/game.blend::Game.priorNmi"),
          );
          const before = await monitor.readCpuRegisters();
          expect(before.p & 4).toBe(callerIrqEnabled ? 0 : 4);

          // Device setup is host work outside the observed acquisition interval.
          await monitor.writeIo(0xdc0e, Uint8Array.of(0, 0));
          await monitor.writeIo(0xdc04, Uint8Array.of(0xff, 0xff, 0xff, 0xff));
          await monitor.writeIo(0xdc00, Uint8Array.of(0xff, 0xff, 0xa5, 0x5a));
          await monitor.writeIo(0xdc0e, Uint8Array.of(controlA, controlB));
          const controls = [controlA & 0xef, controlB & 0xef];
          expect([...(await monitor.readIo(0xdc0e, 0xdc0f))]).toEqual(controls);

          const loads: number[] = [];
          const stores: number[] = [];
          for (let offset = 0; offset < 16; offset += 1) {
            loads.push(await monitor.setAccessTracepoint(0xdc00 + offset, "load"));
            stores.push(await monitor.setAccessTracepoint(0xdc00 + offset, "store"));
          }
          const forbidden: number[] = [];
          for (const address of [0xdd00, 0xdd0d]) {
            forbidden.push(await monitor.setAccessTracepoint(address, "load"));
            forbidden.push(await monitor.setAccessTracepoint(address, "store"));
          }
          const vectorStores = [
            await monitor.setAccessTracepoint(0x318, "store"),
            await monitor.setAccessTracepoint(0x319, "store"),
          ];
          monitor.takeCheckpointHits();
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.afterScan"));
          const hits = monitor.takeCheckpointHits();
          const after = await monitor.readCpuRegisters();
          // Acquisition preserves caller I/D and stack balance, without an A/X/Y save promise.
          expect(after.p & 0x0c).toBe(before.p & 0x0c);
          expect(after.sp).toBe(before.sp);
          expect(await monitor.readMemory(0x318, 0x319)).toEqual(priorVector);
          expect([...(await monitor.readMemory(0x3200, 0x320a))]).toEqual(
            available ? [...Array<number>(10).fill(0xff), 0] : [...Array<number>(10).fill(0), 2],
          );
          expect([...(await monitor.readIo(0xdc02, 0xdc03))]).toEqual([0xa5, 0x5a]);
          expect([...(await monitor.readIo(0xdc0e, 0xdc0f))]).toEqual(controls);
          expect([...(await monitor.readIo(0xdc00, 0xdc00))]).toEqual([available ? 0x7f : 0xff]);
          expect(hits.filter((hit) => forbidden.includes(hit))).toEqual([]);

          const ciaHits = hits.filter((hit) => loads.includes(hit) || stores.includes(hit));
          const expectedCia = available
            ? [
                loads[14]!,
                loads[15]!,
                loads[2]!,
                loads[3]!,
                stores[0]!,
                stores[2]!,
                stores[3]!,
                stores[0]!,
                loads[1]!,
                loads[0]!,
                ...Array.from({ length: 8 }, () => [stores[0]!, loads[1]!]).flat(),
                stores[0]!,
                stores[2]!,
                stores[3]!,
              ]
            : [loads[14]!, loads[15]!];
          expect(ciaHits).toEqual(expectedCia);
          expect(ciaHits.filter((hit) => loads.includes(hit))).toHaveLength(available ? 14 : 2);
          expect(ciaHits.filter((hit) => stores.includes(hit))).toHaveLength(available ? 15 : 0);

          // Address tracepoints prove order/count, not the eight distinct PA mask values.
          const vectorBoundaries: number[] = [];
          let ciaCount = 0;
          for (const hit of hits) {
            if (loads.includes(hit) || stores.includes(hit)) ciaCount += 1;
            else if (vectorStores.includes(hit)) vectorBoundaries.push(ciaCount);
          }
          expect([...new Set(vectorBoundaries)]).toEqual(available ? [7, 27] : []);
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect(await monitor.readMemory(0x318, 0x319)).toEqual(stockVector);
        },
        async (monitor) => {
          await monitor.writeMemory(0x3200, new Uint8Array(11).fill(0xa5));
        },
      );
    },
    300_000,
  );
  it("should preserve live returned pairs and refresh shared complements across a chained IRQ", async () => {
    const source = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
const VIC_IRQ_STATUS: word = $D019;
const VIC_IRQ_ENABLE: word = $D01A;
struct Pair { first: byte; second: byte; }
place(at: $3400) let answers: byte[8] = [; 0];
let shared: byte = 7;
let done: byte = 0;
function make(seed: byte): Pair {
  return { first: seed, second: seed + 2 };
}
function armIRQ(): void {
  asm_nop();
}
interrupt function onRaster(): void {
  poke(VIC_IRQ_STATUS, 1);
  poke(VIC_IRQ_ENABLE, 0);
  let irqPair: Pair = make(9);
  answers[6] = irqPair.first;
  answers[7] = irqPair.second;
  shared = 42;
  done = 1;
}
function main(): void {
  asm_php();
  asm_sei();
  setIRQ(&onRaster);
  let mainPair: Pair = make(7);
  for (let before: byte = 0; before < 2; before += 1) {
    answers[before] = ~shared;
  }
  armIRQ();
  asm_cli();
  while (done == 0) {
  }
  asm_sei();
  for (let after: byte = 0; after < 2; after += 1) {
    answers[after + 2] = ~shared;
  }
  answers[4] = mainPair.first;
  answers[5] = mainPair.second;
  restoreIRQ();
  asm_plp();
  armIRQ();
}`;
    await inspectSize(
      source,
      profile,
      async (artifacts, monitor, stopAt) => {
        const mainEntry = await monitor.readCpuRegisters();
        const priorVector = await monitor.readMemory(0x0314, 0x0315);
        // The host owns this raster fixture; it does not recover arbitrary prior VIC state.
        await monitor.writeIo(0xdc0d, Uint8Array.of(0x7f));
        await monitor.writeIo(0xdc0e, Uint8Array.of(0, 0));
        const armEntry = libraryEntry(artifacts, "src/game.blend::Game.armIRQ");
        await stopAt(armEntry);
        const firstArm = await monitor.readCpuRegisters();
        expect(firstArm.p & 0x04).toBe(0x04);
        await monitor.writeIo(0xd01a, Uint8Array.of(0));
        await monitor.writeIo(0xd011, Uint8Array.of(0x1b));
        await monitor.writeIo(0xd012, Uint8Array.of(0));
        await monitor.writeIo(0xd019, Uint8Array.of(1));
        await monitor.writeIo(0xd01a, Uint8Array.of(1));
        const acknowledge = await monitor.setAccessTracepoint(0xd019, "store");
        const disable = await monitor.setAccessTracepoint(0xd01a, "store");
        monitor.takeCheckpointHits();
        await stopAt(armEntry);
        const secondArm = await monitor.readCpuRegisters();
        expect(secondArm.p & 0x0c).toBe(mainEntry.p & 0x0c);
        expect((secondArm.sp + 2) & 0xff).toBe(mainEntry.sp);
        expect((firstArm.sp + 1) & 0xff).toBe(secondArm.sp);
        await stopAt(libraryStartup(artifacts, "startup.restore"));
        expect([...(await monitor.readMemory(0x3400, 0x3407))]).toEqual([
          248, 248, 213, 213, 7, 9, 9, 11,
        ]);
        expect(await monitor.readMemory(0x0314, 0x0315)).toEqual(priorVector);
        expect(
          monitor.takeCheckpointHits().filter((hit) => hit === acknowledge || hit === disable),
        ).toEqual([acknowledge, disable]);
      },
      async () => {},
    );
  }, 300_000);
});
