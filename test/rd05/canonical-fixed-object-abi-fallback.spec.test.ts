import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import type { BuildSuccess } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryBytes,
  libraryEntry,
  libraryFunctionBytes,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryVice,
} from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";

/** The original small return fixture is kept byte-for-byte, including its whitespace. */
const ORDINARY_SOURCE = `module Game;
struct Sample { values: byte[8]; first: byte; second: byte; quality: byte; }
function sample(): Sample {
    let result: Sample = { values: [0,0,0,0,0,0,0,0], first: 0, second: 0, quality: 2 };
    result.values[0] = peek($D020);
    return result;
}
function main(): void {
    let received: Sample = sample();
    poke($D021, received.values[0]);
}
`;

/** This acquisition source is an output oracle, not input-device or unrestricted-NMI qualification. */
const INPUT_SOURCE = `module Input;
import { setNMI, restoreNMI } from c64.system;

/** Whether one bounded acquisition completed without observed interference. */
export enum SnapshotQuality { COMPLETE = 0, INTERRUPTED = 1, UNAVAILABLE = 2 }

/** Raw electrical observations; quality does not certify physical contact stability. */
export struct InputSnapshot {
    rows: byte[8];
    joystick1: byte;
    joystick2: byte;
    quality: SnapshotQuality;
}

const PORT_A: word = $DC00;
const PORT_B: word = $DC01;
const DDR_A: word = $DC02;
const DDR_B: word = $DC03;
const CONTROL_A: word = $DC0E;
const CONTROL_B: word = $DC0F;
const TIMER_PBON: byte = 2;
const STOCK_PA_IDLE: byte = $7F;
let interrupted: byte;

/** The scoped ingress changes only idle PA and the interruption marker. */
interrupt function ingress(): void {
    poke(PORT_A, STOCK_PA_IDLE);
    interrupted = 1;
}

/** Diagnostic acquisition shape; admission is not route or hardware qualification. */
export function readInputSnapshot(): InputSnapshot {
    let saved: InputSnapshot = {
        rows: [0,0,0,0,0,0,0,0], joystick1: 0, joystick2: 0,
        quality: SnapshotQuality.UNAVAILABLE
    };
    asm_php();
    asm_sei();
    if (((peek(CONTROL_A) | peek(CONTROL_B)) & TIMER_PBON) != 0) {
        asm_plp();
        return saved;
    }
    let priorA: byte = peek(DDR_A);
    let priorB: byte = peek(DDR_B);
    poke(PORT_A, STOCK_PA_IDLE);
    poke(DDR_A, $FF);
    poke(DDR_B, 0);
    interrupted = 0;
    setNMI(&ingress);
    poke(PORT_A, $FF);
    saved.joystick1 = peek(PORT_B);
    saved.joystick2 = peek(PORT_A);
    let drive: byte = $FE;
    for (let column: byte = 0; column < 8; column = column + 1) {
        poke(PORT_A, drive);
        saved.rows[column & 7] = peek(PORT_B);
        drive = (drive << 1) | 1;
    }
    poke(PORT_A, STOCK_PA_IDLE);
    restoreNMI();
    poke(DDR_A, priorA);
    poke(DDR_B, priorB);
    if (interrupted != 0) {
        saved.quality = SnapshotQuality.INTERRUPTED;
    } else {
        saved.quality = SnapshotQuality.COMPLETE;
    }
    asm_plp();
    return saved;
}

/** Ordinary saved-data consumer after acquisition, with no device reads. */
export function savedRow(source: const InputSnapshot, column: byte): byte {
    return source.rows[column & 7];
}
`;

/** The caller still uses an ordinary fresh declaration and an ordinary borrowed read. */
const GAME_SOURCE = `module Game;
import { readInputSnapshot, InputSnapshot, savedRow } from Input;

/** Normal fresh result declaration, followed by a normal borrowed saved-data read. */
function main(): void {
    let saved: InputSnapshot = readInputSnapshot();
    poke($C000, byte(saved.quality));
    poke($C001, savedRow(saved, 0));
}
`;

/** A returned value does not make a separate address of its automatic local persistent. */
const ESCAPE_SOURCE = `module Game;
struct Packet { values: byte[4]; }
let escaped: word;
function make(): Packet {
    let result: Packet = { values: [7,13,19,25] };
    escaped = &result.values[0];
    return result;
}
function main(): void {
    let received: Packet = make();
    poke($C000, peek(escaped));
    poke($C001, received.values[0]);
}
`;

/** Mainline and a feasible IRQ both call the producer; their destinations are not one object. */
const ASYNC_SOURCE = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
struct Packet { values: byte[4]; }
function make(): Packet {
    let result: Packet = { values: [7,13,19,25] };
    result.values[0] = peek($D020);
    return result;
}
interrupt function handler(): void {
    let interruptValue: Packet = make();
    poke($C001, interruptValue.values[0]);
}
function main(): void {
    setIRQ(&handler);
    let received: Packet = make();
    poke($C000, received.values[0]);
    restoreIRQ();
}
`;

/** A borrower without any aggregate-return group must keep its ordinary address parameter. */
const ORDINARY_BORROW_SOURCE = `module Game;
struct Packet { values: byte[4]; }
function read(source: const Packet, column: byte): byte {
    return source.values[column & 3];
}
function main(): void {
    let saved: Packet = { values: [7,13,19,25] };
    poke($C000, read(saved, peek($C100)));
}
`;

/** Real checks and builds share the exact same public options and source lifetime. */
async function withOutput(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
  inspect: (artifacts: LibraryArtifacts, built: BuildSuccess) => Promise<void>,
  input?: string,
  warning?: string,
) {
  await withProfileProject(source, profile, async (project, root) => {
    if (input !== undefined) await writeFile(join(root, "src/input.blend"), input);
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
    if (built.kind !== "success") throw new Error("Expected legal canonical source");
    if (warning !== undefined) {
      for (const result of [checked, built]) {
        expect(
          result.diagnostics.every(
            (entry) => entry.code === warning && entry.severity === "warning",
          ),
        ).toBe(true);
        expect(result.diagnostics.some((entry) => entry.code === warning)).toBe(true);
      }
    }
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
    await inspect(artifacts, built);
  });
}

/** Resolve a source body without depending on generated labels or opaque IDs. */
function expectOneBody(artifacts: LibraryArtifacts, qualifiedName: string) {
  const functions = profileRecords(artifacts.debug.functions).filter(
    (entry) => entry.qualifiedName === qualifiedName,
  );
  expect(functions, qualifiedName).toHaveLength(1);
  expect(profileRecords(functions[0]!.entryVariants), qualifiedName).toHaveLength(1);
}

/** Preserve a two-byte runtime address when there is no eligible fixed-object proof. */
function expectGenericPointer(artifacts: LibraryArtifacts, qualifiedName: string) {
  const pointers = profileRecords(artifacts.memory.intervals).filter((interval) => {
    const owner = profileRecord(interval.owner);
    return (
      owner.kind === "function" &&
      owner.id === qualifiedName &&
      interval.size === 2 &&
      ["sfa", "zeroPage"].includes(String(interval.kind))
    );
  });
  expect(pointers.length, `${qualifiedName}: generic address parameter`).toBeGreaterThan(0);
}

/** Charge every stored interval and reconcile the payload independently of the PRG header. */
function accounting(artifacts: LibraryArtifacts) {
  expectLibraryAccounting(artifacts);
  const intervals = profileRecords(artifacts.memory.intervals);
  const total = (entries: Record<string, unknown>[], field: string) =>
    entries.reduce((sum, entry) => sum + Number(entry[field]), 0);
  for (const interval of intervals.filter(
    (entry) =>
      profileRecord(entry.owner).kind === "function" &&
      !["code", "padding"].includes(String(entry.kind)),
  )) {
    expect(["sfa", "zeroPage"]).toContain(interval.kind);
    expect(["general", "zeroPage"]).toContain(interval.resourceClass);
    expect(Number(interval.end) - Number(interval.start)).toBe(interval.size);
  }
  const totals = profileRecord(artifacts.costs.totals);
  const resource = (id: string) => {
    const matches = profileRecords(totals.resources).filter((entry) => entry.id === id);
    expect(matches, id).toHaveLength(1);
    return Number(matches[0]!.value);
  };
  const packaged = profileRecord(artifacts.build.package);
  expect(packaged.kind).toBe("prg");
  expect(artifacts.prg.readUInt16LE(0)).toBe(packaged.loadAddress);
  expect(Number(packaged.endAddress) - Number(packaged.loadAddress)).toBe(artifacts.prg.length - 2);
  const zeroPage = total(
    intervals.filter((entry) => entry.resourceClass === "zeroPage"),
    "size",
  );
  expect(resource("zeroPage")).toBe(zeroPage);
  expect(profileRecord(profileRecord(artifacts.build.semanticInputs).options)).toMatchObject({
    optimization: "none",
    boundsCheck: false,
    divisionZeroCheck: false,
  });
  return {
    container: artifacts.prg.length,
    payload: artifacts.prg.length - 2,
    padding: total(intervals, "paddingBytes"),
    generalSfa: total(
      intervals.filter((entry) => entry.kind === "sfa" && entry.resourceClass === "general"),
      "size",
    ),
    zeroPage,
    platformAndGlobals: total(
      intervals.filter((entry) => entry.kind === "bss"),
      "size",
    ),
    resident: resource("residentRam"),
    generatedStack: resource("hardwareStack"),
    scratch: resource("scratch"),
  };
}

/** Startup/restore bytes are attributed by public machine origin, never guessed from function sizes. */
function platformBytes(artifacts: LibraryArtifacts, name: "startup.entry" | "startup.restore") {
  const entry = libraryStartup(artifacts, name);
  const ranges = profileRecords(artifacts.debug.ranges).filter((range) => {
    const owner = profileRecord(range.owner);
    const origin = profileRecord(range.origin);
    return (
      owner.kind === "platform" &&
      owner.name === "startup" &&
      origin.kind === "generated" &&
      origin.cause === "startup" &&
      profileRecord(range.machine).start === entry
    );
  });
  expect(ranges, name).toHaveLength(1);
  const machine = profileRecord(ranges[0]!.machine);
  return libraryBytes(artifacts, Number(machine.start), Number(machine.end) - Number(machine.start))
    .length;
}

/** Completed nested construction may not retain either a separate struct or its nested array home. */
function expectNoAggregateHome(artifacts: LibraryArtifacts, qualifiedName: string) {
  expectOneBody(artifacts, qualifiedName);
  const homes = profileRecords(artifacts.memory.intervals).filter((interval) => {
    const owner = profileRecord(interval.owner);
    return (
      owner.kind === "function" &&
      owner.id === qualifiedName &&
      interval.kind === "sfa" &&
      interval.resourceClass === "general" &&
      [8, 11].includes(Number(interval.size))
    );
  });
  expect(homes).toEqual([]);
}

/**
 * Follow the real caller's page-one return address and compare its live state.
 * Charged bytes in BASIC's $03–$8F borrow window are seeded and checked, so
 * omitting a save cannot pass because an address already held its later value.
 * The free compiler byte at $02 has no caller-restoration obligation.
 */
async function expectPreservedCaller(
  built: BuildSuccess,
  artifacts: LibraryArtifacts,
  profile: (typeof sourceLibraryProfiles)[number],
  prepare: (monitor: ViceMonitor) => Promise<void>,
  inspect: (monitor: ViceMonitor) => Promise<void>,
) {
  await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
    const before = await monitor.readCpuRegisters();
    const low = (
      await monitor.readMemory(0x100 | ((before.sp + 1) & 255), 0x100 | ((before.sp + 1) & 255))
    )[0]!;
    const high = (
      await monitor.readMemory(0x100 | ((before.sp + 2) & 255), 0x100 | ((before.sp + 2) & 255))
    )[0]!;
    const returnAddress = ((low | (high << 8)) + 1) & 0xffff;
    const bank = await monitor.readMemory(0, 1);
    const borrowed = [];
    for (const interval of profileRecords(artifacts.memory.intervals).filter(
      (entry) => entry.resourceClass === "zeroPage",
    )) {
      const intervalStart = Number(interval.start);
      const intervalEnd = Number(interval.end);
      expect(intervalStart).toBeGreaterThanOrEqual(2);
      expect(intervalEnd).toBeLessThanOrEqual(256);
      const start = Math.max(3, intervalStart);
      const end = Math.min(0x90, intervalEnd) - 1;
      if (start > end) continue;
      const bytes = Uint8Array.from(
        { length: end - start + 1 },
        (_, offset) => (start + offset) ^ 0xa5,
      );
      await monitor.writeMemory(start, bytes);
      borrowed.push({ start, end, bytes });
    }
    await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));
    // Startup owns display initialization; prepare source inputs after it finishes.
    await prepare(monitor);
    const vic = await monitor.readIo(0xd016, 0xd018);
    const cia1 = await monitor.readIo(0xdc02, 0xdc03);
    // Separate startup-constructor tests own CIA2 direction and VIC-bank restoration.
    await stopAt(libraryStartup(artifacts, "startup.restore"));
    await inspect(monitor);
    await stopAt(returnAddress);
    const after = await monitor.readCpuRegisters();
    expect([after.a, after.x, after.y, after.sp, after.p & 0xcf]).toEqual([
      before.a,
      before.x,
      before.y,
      (before.sp + 2) & 255,
      before.p & 0xcf,
    ]);
    expect(await monitor.readMemory(0, 1)).toEqual(bank);
    expect(await monitor.readIo(0xd016, 0xd018)).toEqual(vic);
    expect(await monitor.readIo(0xdc02, 0xdc03)).toEqual(cia1);
    for (const { start, end, bytes } of borrowed)
      expect(await monitor.readMemory(start, end)).toEqual(bytes);
  });
}

describe.sequential("fixed-object generic fallback and unchanged output contracts", () => {
  for (const profile of sourceLibraryProfiles) {
    it(`keeps the lifetime diagnostic for an escaped automatic address on ${profile}`, async () => {
      await withProfileProject(ESCAPE_SOURCE, profile, async (project) => {
        const options = {
          project,
          optimization: "none" as const,
          boundsCheck: false,
          divisionZeroCheck: false,
        };
        for (const result of [await checkProject(options), await buildProject(options)]) {
          expect(result.kind).not.toBe("success");
          const errors = result.diagnostics.filter((entry) => entry.severity === "error");
          expect(errors.length).toBeGreaterThan(0);
          expect(errors.every((entry) => entry.code === "E10260")).toBe(true);
        }
      });
    }, 120_000);

    it(`retains legal generic storage for mainline and IRQ result destinations on ${profile}`, async () => {
      await withOutput(ASYNC_SOURCE, profile, async (artifacts) => {
        expectLibraryAccounting(artifacts);
        expectGenericPointer(artifacts, "src/game.blend::Game.make");
        const functions = profileRecords(artifacts.debug.functions);
        expect(
          functions.some((entry) => entry.qualifiedName === "src/game.blend::Game.handler"),
        ).toBe(true);
        expect(
          libraryFunctionBytes(artifacts, "src/game.blend::Game.handler").length,
        ).toBeGreaterThan(0);
      });
    }, 120_000);

    it(`does not specialize a borrower without an eligible return group on ${profile}`, async () => {
      await withOutput(ORDINARY_BORROW_SOURCE, profile, async (artifacts) => {
        expectOneBody(artifacts, "src/game.blend::Game.read");
        expectGenericPointer(artifacts, "src/game.blend::Game.read");
        expectLibraryAccounting(artifacts);
      });
    }, 120_000);

    it(`preserves every ordinary code and complete-storage ceiling on ${profile}`, async () => {
      await withOutput(ORDINARY_SOURCE, profile, async (artifacts, built) => {
        await expectPreservedCaller(
          built,
          artifacts,
          profile,
          async (monitor) => {
            await monitor.writeIo(0xd020, Uint8Array.of(7));
          },
          async (monitor) => {
            expect((await monitor.readIo(0xd021, 0xd021))[0]! & 15).toBe(7);
          },
        );
        const name = "src/game.blend::Game.sample";
        expectNoAggregateHome(artifacts, name);
        const sample = libraryFunctionBytes(artifacts, name).length;
        const main = libraryFunctionBytes(artifacts, "src/game.blend::Game.main").length;
        expect(sample).toBeLessThan(70);
        expect(sample + main).toBeLessThan(90);
        const measured = accounting(artifacts);
        expect(measured.container).toBeLessThan(713);
        expect(measured.payload).toBeLessThan(711);
        expect(measured.padding).toBe(0);
        expect(measured.generalSfa).toBeLessThanOrEqual(12);
        expect(measured.zeroPage).toBeLessThanOrEqual(4);
        expect(measured.generatedStack).toBe(2);
        expect(measured.platformAndGlobals).toBe(49);
        expect(measured.scratch).toBe(0);
        expect(measured.resident).toBeLessThanOrEqual(787);
      });
    }, 120_000);

    it(`preserves exact acquisition sources and all function/startup/resource gates on ${profile}`, async () => {
      expect(createHash("sha256").update(INPUT_SOURCE).digest("hex")).toBe(
        "860a0c523355e544a0d47da99089e2d74994a78c67dfd1efdb65e1cb4aa314f0",
      );
      expect(createHash("sha256").update(GAME_SOURCE).digest("hex")).toBe(
        "a5d2ec4473b267366695a01e3ede9f45cf3659e1ec312965916669611c3466c2",
      );
      await withOutput(
        GAME_SOURCE,
        profile,
        async (artifacts, built) => {
          // The PBON refusal path avoids making any input-device or NMI arrival claim.
          await expectPreservedCaller(
            built,
            artifacts,
            profile,
            async (monitor) => {
              const control = (await monitor.readIo(0xdc0e, 0xdc0e))[0]!;
              await monitor.writeIo(0xdc0e, Uint8Array.of(control | 2));
            },
            async (monitor) => {
              expect([...(await monitor.readMemory(0xc000, 0xc001))]).toEqual([2, 0]);
            },
          );
          const name = "src/input.blend::Input.readInputSnapshot";
          expectNoAggregateHome(artifacts, name);
          const acquisition = libraryFunctionBytes(artifacts, name).length;
          const ingress = libraryFunctionBytes(artifacts, "src/input.blend::Input.ingress").length;
          const savedRow = libraryFunctionBytes(
            artifacts,
            "src/input.blend::Input.savedRow",
          ).length;
          const main = libraryFunctionBytes(artifacts, "src/game.blend::Game.main").length;
          expect(platformBytes(artifacts, "startup.entry")).toBeLessThanOrEqual(328);
          expect(platformBytes(artifacts, "startup.restore")).toBeLessThanOrEqual(281);
          expect(acquisition).toBeLessThan(397);
          expect(ingress).toBeLessThanOrEqual(18);
          expect(savedRow).toBeLessThanOrEqual(63);
          expect(main).toBeLessThanOrEqual(55);
          expect(acquisition + ingress + savedRow + main).toBeLessThan(533);
          const measured = accounting(artifacts);
          expect(measured.container).toBeLessThanOrEqual(1395);
          expect(measured.payload).toBeLessThanOrEqual(1393);
          expect(measured.generalSfa).toBeLessThanOrEqual(45);
          expect(measured.zeroPage).toBeLessThanOrEqual(10);
          expect(measured.generatedStack).toBe(5);
          expect(measured.platformAndGlobals).toBe(50);
          expect(measured.scratch).toBe(0);
          expect(measured.resident).toBeLessThanOrEqual(1498);
        },
        INPUT_SOURCE,
        "W10211",
      );
    }, 120_000);
  }

  it("keeps the saved-data none fixture's exact public artifact identity", async () => {
    const source = await readFile(
      new URL("./fixtures/input-saved-caller.blend", import.meta.url),
      "utf8",
    );
    const artifacts = await buildProfileSource(source, "c64-pal-prg-kernal-6581", "none");
    expectLibraryAccounting(artifacts);
    expect(artifacts.prg.length - 2).toBe(2163);
    expect(createHash("sha256").update(artifacts.prg).digest("hex")).toBe(
      "0417b7da8c4eabb022e6ec868e0d8dcaf4b4727da83d43e29fcbe98e16a02a93",
    );
  }, 180_000);
});
