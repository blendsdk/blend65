import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
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
  libraryFunctionBytes,
  libraryGlobalAddress,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryVice,
} from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";

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

const GAME_SOURCE = `module Game;
import { readInputSnapshot, InputSnapshot, savedRow } from Input;

/** Normal fresh result declaration, followed by a normal borrowed saved-data read. */
function main(): void {
    let saved: InputSnapshot = readInputSnapshot();
    poke($C000, byte(saved.quality));
    poke($C001, savedRow(saved, 0));
}
`;

/** Finds one source function without depending on generated labels or opaque IDs. */
function sourceFunction(artifacts: LibraryArtifacts, qualifiedName: string) {
  const matches = profileRecords(artifacts.debug.functions).filter(
    (record) => record.qualifiedName === qualifiedName,
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

/** Source-local symbols may survive elision, but must not retain a callee-owned home. */
function expectNoHome(
  artifacts: LibraryArtifacts,
  qualifiedName: string,
  width: number,
  childWidth?: number,
) {
  const intervals = profileRecords(artifacts.memory.intervals).filter((interval) => {
    const owner = profileRecord(interval.owner);
    return owner.kind === "function" && owner.id === qualifiedName;
  });
  const general = intervals.filter(
    (interval) => interval.kind === "sfa" && interval.resourceClass === "general",
  );
  expect(general.filter((interval) => interval.size === width)).toEqual([]);
  if (childWidth !== undefined) {
    expect(general.filter((interval) => interval.size === childWidth)).toEqual([]);
  }
  const symbols = profileRecords(artifacts.debug.symbols);
  const completePieces = (symbolIndex: number) =>
    profileRecords(artifacts.debug.locations)
      .filter((location) => location.symbolIndex === symbolIndex)
      .flatMap((location) => {
        const availability = profileRecord(location.availability);
        if (availability.kind !== "available") return [];
        return profileRecords(availability.pieces)
          .filter((piece) => {
            if (piece.kind !== "memory" || piece.valueOffset !== 0 || piece.byteLength !== width)
              return false;
            const machine = profileRecord(piece.machine);
            return Number(machine.end) - Number(machine.start) === width;
          })
          .map((piece) => profileRecord(piece.machine));
      });
  const callerLocals = symbols
    .map((symbol, index) => ({ symbol, index }))
    .filter(
      ({ symbol }) =>
        symbol.kind === "local" &&
        symbol.scope === "src/game.blend::Game.main" &&
        symbol.byteWidth === width &&
        profileRecord(symbol.origin).kind === "source",
    );
  expect(callerLocals).toHaveLength(1);
  const callerPieces = completePieces(callerLocals[0]!.index);
  expect(callerPieces.length).toBeGreaterThan(0);
  // Frame coloring can reuse physical bytes later; source object identity still distinguishes homes.
  for (const [symbolIndex, symbol] of symbols.entries()) {
    if (
      symbol.kind !== "local" ||
      symbol.scope !== qualifiedName ||
      symbol.byteWidth !== width ||
      profileRecord(symbol.origin).kind !== "source"
    )
      continue;
    for (const complete of completePieces(symbolIndex)) {
      expect(
        callerPieces.some(
          (caller) =>
            caller.addressSpaceIndex === complete.addressSpaceIndex &&
            caller.start === complete.start &&
            caller.end === complete.end,
        ),
      ).toBe(true);
    }
  }
  for (const [symbolIndex, symbol] of symbols.entries()) {
    if (symbol.scope !== qualifiedName || symbol.byteWidth !== width) continue;
    const locations = profileRecords(artifacts.debug.locations).filter(
      (location) => location.symbolIndex === symbolIndex,
    );
    for (const location of locations) {
      const availability = profileRecord(location.availability);
      if (availability.kind !== "available") continue;
      const pieces = profileRecords(availability.pieces).filter((piece) => piece.kind === "memory");
      for (const piece of pieces) {
        const machine = profileRecord(piece.machine);
        expect(
          general.some(
            (interval) =>
              Number(machine.start) < Number(interval.end) &&
              Number(machine.end) > Number(interval.start),
          ),
        ).toBe(false);
      }
    }
  }
}

/** Return-address materialization and whole-function delivery suffixes must both disappear. */
function expectReturnDelivery(
  artifacts: LibraryArtifacts,
  qualifiedName: string,
  sourceId: string,
  source: string,
  returnedLocal: string,
) {
  const sources = profileRecords(artifacts.debug.sources);
  const sourceIndex = sources.findIndex((entry) => entry.path === sourceId);
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const fn = sourceFunction(artifacts, qualifiedName);
  const declaration = profileRecord(fn.declaration);
  expect(declaration.sourceIndex).toBe(sourceIndex);
  expect(Array.isArray(fn.rangeIndexes)).toBe(true);
  if (!Array.isArray(fn.rangeIndexes)) throw new Error("Missing function ranges");
  const allRanges = profileRecords(artifacts.debug.ranges);
  const ranges = fn.rangeIndexes
    .map((index) => {
      expect(Number.isInteger(index)).toBe(true);
      const range = allRanges[Number(index)];
      expect(range).toBeDefined();
      return range!;
    })
    .sort(
      (left, right) =>
        Number(profileRecord(left.machine).start) - Number(profileRecord(right.machine).start),
    );
  const bytes = (range: Record<string, unknown>) => {
    const machine = profileRecord(range.machine);
    return libraryBytes(
      artifacts,
      Number(machine.start),
      Number(machine.end) - Number(machine.start),
    );
  };
  const isDeliveryOrigin = (range: Record<string, unknown>) => {
    const origin = profileRecord(range.origin);
    if (origin.kind !== "source") return false;
    const span = profileRecord(origin.span);
    return (
      span.sourceIndex === declaration.sourceIndex &&
      span.startByte === declaration.startByte &&
      span.endByte === declaration.endByte
    );
  };
  const returns = [...source.matchAll(new RegExp(`return ${returnedLocal};`, "g"))];
  expect(returns.length).toBeGreaterThan(0);
  for (const returned of returns) {
    const startByte = Buffer.byteLength(source.slice(0, returned.index));
    const endByte = startByte + Buffer.byteLength(returned[0]);
    const materialization = ranges.filter((range) => {
      const origin = profileRecord(range.origin);
      if (origin.kind !== "source") return false;
      const span = profileRecord(origin.span);
      return (
        span.sourceIndex === sourceIndex &&
        Number(span.startByte) >= startByte &&
        Number(span.endByte) <= endByte
      );
    });
    expect(materialization).toEqual([]);
  }
  const terminals = ranges
    .map((range, index) => ({ range, index }))
    .filter(({ range }) => {
      const encoded = bytes(range);
      return encoded.length === 1 && encoded[0] === 0x60;
    });
  expect(terminals).toHaveLength(returns.length);
  for (const { range, index } of terminals) {
    expect(isDeliveryOrigin(range)).toBe(true);
    let beginning = index;
    // Control instructions share the declaration span; source writes and PLP have their own spans.
    while (
      beginning > 0 &&
      isDeliveryOrigin(ranges[beginning - 1]!) &&
      profileRecord(ranges[beginning - 1]!.machine).end ===
        profileRecord(ranges[beginning]!.machine).start
    ) {
      beginning -= 1;
    }
    const delivery = ranges.slice(beginning, index + 1).flatMap(bytes);
    expect(delivery).toEqual([0x60]);
    // NMOS RTS is one byte and six nominal CPU cycles, independently of callee contents.
    expect({ bytes: delivery.length, nominalCycles: delivery[0] === 0x60 ? 6 : undefined }).toEqual(
      { bytes: 1, nominalCycles: 6 },
    );
  }
}

/** Reconciles actual PRG bytes and all reported resource charges, keeping the header separate. */
function accounting(artifacts: LibraryArtifacts) {
  expectLibraryAccounting(artifacts);
  const intervals = profileRecords(artifacts.memory.intervals);
  for (const interval of intervals.filter(
    (entry) =>
      profileRecord(entry.owner).kind === "function" &&
      entry.kind !== "code" &&
      entry.kind !== "padding",
  )) {
    expect(["sfa", "zeroPage"]).toContain(interval.kind);
    expect(["general", "zeroPage"]).toContain(interval.resourceClass);
    expect(Number(interval.end) - Number(interval.start)).toBe(interval.size);
  }
  const sum = (records: Record<string, unknown>[], field: string) =>
    records.reduce((total, record) => total + Number(record[field]), 0);
  const totals = profileRecord(artifacts.costs.totals);
  const resource = (id: string) => {
    const matches = profileRecords(totals.resources).filter((entry) => entry.id === id);
    expect(matches).toHaveLength(1);
    return Number(matches[0]!.value);
  };
  const packaged = profileRecord(artifacts.build.package);
  expect(packaged.kind).toBe("prg");
  expect(artifacts.prg.readUInt16LE(0)).toBe(packaged.loadAddress);
  const payload = artifacts.prg.length - 2;
  expect(totals.programBytes).toBe(payload);
  expect(Number(packaged.endAddress) - Number(packaged.loadAddress)).toBe(payload);
  expect(artifacts.memory.acmeReconciled).toBe(true);
  const zeroPage = sum(
    intervals.filter((entry) => entry.resourceClass === "zeroPage"),
    "size",
  );
  expect(resource("zeroPage")).toBe(zeroPage);
  const inputs = profileRecord(artifacts.build.semanticInputs);
  expect(profileRecord(inputs.options)).toMatchObject({
    optimization: "none",
    boundsCheck: false,
    divisionZeroCheck: false,
  });
  return {
    container: artifacts.prg.length,
    payload,
    padding: sum(intervals, "paddingBytes"),
    generalSfa: sum(
      intervals.filter((entry) => entry.kind === "sfa" && entry.resourceClass === "general"),
      "size",
    ),
    zeroPage,
    platformAndGlobals: sum(
      intervals.filter((entry) => entry.kind === "bss"),
      "size",
    ),
    resident: resource("residentRam"),
    generatedStack: resource("hardwareStack"),
    scratch: resource("scratch"),
  };
}

/** Attributes platform bytes by public origin, independently of generated labels. */
function platformBytes(artifacts: LibraryArtifacts, cause: "startup" | "restore") {
  const entry = libraryStartup(
    artifacts,
    cause === "startup" ? "startup.entry" : "startup.restore",
  );
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
  expect(ranges).toHaveLength(1);
  return ranges.reduce((total, range) => {
    const machine = profileRecord(range.machine);
    return (
      total +
      libraryBytes(artifacts, Number(machine.start), Number(machine.end) - Number(machine.start))
        .length
    );
  }, 0);
}

/** Builds through the public package, preserving the fixture's bounded lifetime. */
async function withOutput(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
  inspect: (
    built: Extract<Awaited<ReturnType<typeof buildProject>>, { kind: "success" }>,
    artifacts: LibraryArtifacts,
  ) => Promise<void>,
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
    if (built.kind !== "success") throw new Error("Public build failed");
    for (const result of [checked, built]) {
      expect(result.diagnostics.every((diagnostic) => diagnostic.code === warning)).toBe(true);
      expect(result.diagnostics.every((diagnostic) => diagnostic.severity === "warning")).toBe(
        true,
      );
      if (warning !== undefined)
        expect(result.diagnostics.some((diagnostic) => diagnostic.code === warning)).toBe(true);
    }
    const artifacts = await readProfileArtifacts(built);
    await inspect(built, artifacts);
  });
}

describe.sequential(
  "returned locals construct in the caller result on every cooperative profile",
  () => {
    for (const profile of sourceLibraryProfiles) {
      // A complete nested literal needs neither a second object nor a final delivery copy.
      it(`should deliver an ordinary completed return with only RTS on ${profile}`, async () => {
        await withOutput(ORDINARY_SOURCE, profile, async (_built, artifacts) => {
          const name = "src/game.blend::Game.sample";
          expectNoHome(artifacts, name, 11, 8);
          expectReturnDelivery(artifacts, name, "src/game.blend", ORDINARY_SOURCE, "result");
          expect(profileRecords(sourceFunction(artifacts, name).entryVariants)).toHaveLength(1);
        });
      }, 120_000);

      // Savings must survive caller, packaging, startup and complete resource accounting.
      it(`should reduce ordinary code and complete storage without hidden growth on ${profile}`, async () => {
        await withOutput(ORDINARY_SOURCE, profile, async (_built, artifacts) => {
          const sample = libraryFunctionBytes(artifacts, "src/game.blend::Game.sample").length;
          const main = libraryFunctionBytes(artifacts, "src/game.blend::Game.main").length;
          expect(sample).toBeLessThan(70);
          expect(sample + main).toBeLessThan(90);
          const measured = accounting(artifacts);
          const startup = platformBytes(artifacts, "startup");
          const restore = platformBytes(artifacts, "restore");
          expect(measured.container).toBeLessThan(713);
          expect(measured.payload).toBeLessThan(711);
          expect(measured.padding).toBe(0);
          expect(measured.generalSfa).toBeLessThanOrEqual(12);
          expect(measured.zeroPage).toBeLessThanOrEqual(4);
          expect(measured.generatedStack).toBe(2);
          expect(measured.platformAndGlobals).toBe(49);
          expect(measured.scratch).toBe(0);
          expect(measured.resident).toBeLessThanOrEqual(787);
          // Whole-path nominal cycles require a separate actual-byte assessment; reports are unknown.
          console.info(
            JSON.stringify({
              profile,
              sample,
              main,
              startup,
              restore,
              ...measured,
              nominalPathCycles: "manual qualification required",
            }),
          );
        });
      }, 120_000);

      for (const fixture of [
        {
          type: "byte[257]",
          size: 257,
          writes: "result[255] = 3; result[256] = 5;",
          tail: [3, 5],
          zeroBytes: 255,
        },
        {
          type: "word[129]",
          size: 258,
          writes: "result[127] = $1234; result[128] = $5678;",
          tail: [0x34, 0x12, 0x78, 0x56],
          zeroBytes: 254,
        },
      ]) {
        // A complete fill and later writes must preserve the original root across page advancement.
        it(`should fill and return complete ${fixture.type} values across page and stride boundaries on ${profile}`, async () => {
          const source = `module Game;
let observed: ${fixture.type} = [;0];
function make(): ${fixture.type} {
    let result: ${fixture.type} = [;0];
    ${fixture.writes}
    return result;
}
function main(): void {
    let received: ${fixture.type} = make();
    observed = received;
}
`;
          await withOutput(
            source,
            profile,
            async (built, artifacts) => {
              const name = "src/game.blend::Game.make";
              expectNoHome(artifacts, name, fixture.size);
              expectReturnDelivery(artifacts, name, "src/game.blend", source, "result");
              expect(profileRecords(sourceFunction(artifacts, name).entryVariants)).toHaveLength(1);
              const measured = accounting(artifacts);
              expect(measured.scratch).toBeLessThanOrEqual(measured.generalSfa + measured.zeroPage);
              const observed = libraryGlobalAddress(
                artifacts,
                source,
                `let observed: ${fixture.type} = [;0];`,
                fixture.size,
                "src/game.blend",
              );
              await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
                await stopAt(libraryStartup(artifacts, "startup.restore"));
                expect([
                  ...(await monitor.readMemory(observed, observed + fixture.size - 1)),
                ]).toEqual([...Array<number>(fixture.zeroBytes).fill(0), ...fixture.tail]);
              });
            },
            undefined,
            "W10143",
          );
        }, 120_000);
      }

      // The exact PA-only source must qualify without claiming input or route runtime validation.
      it(`should remove acquisition result copies with no extra variant or net resource growth on ${profile}`, async () => {
        expect(createHash("sha256").update(INPUT_SOURCE).digest("hex")).toBe(
          "860a0c523355e544a0d47da99089e2d74994a78c67dfd1efdb65e1cb4aa314f0",
        );
        expect(createHash("sha256").update(GAME_SOURCE).digest("hex")).toBe(
          "a5d2ec4473b267366695a01e3ede9f45cf3659e1ec312965916669611c3466c2",
        );
        await withOutput(
          GAME_SOURCE,
          profile,
          async (_built, artifacts) => {
            const name = "src/input.blend::Input.readInputSnapshot";
            expectNoHome(artifacts, name, 11, 8);
            expectReturnDelivery(artifacts, name, "src/input.blend", INPUT_SOURCE, "saved");
            expect(profileRecords(sourceFunction(artifacts, name).entryVariants)).toHaveLength(1);
            const lengths = {
              acquisition: libraryFunctionBytes(artifacts, name).length,
              ingress: libraryFunctionBytes(artifacts, "src/input.blend::Input.ingress").length,
              savedRow: libraryFunctionBytes(artifacts, "src/input.blend::Input.savedRow").length,
              main: libraryFunctionBytes(artifacts, "src/game.blend::Game.main").length,
            };
            const startup = platformBytes(artifacts, "startup");
            const restore = platformBytes(artifacts, "restore");
            expect(startup).toBeLessThanOrEqual(328);
            expect(restore).toBeLessThanOrEqual(281);
            expect(lengths.acquisition).toBeLessThan(397);
            expect(lengths.ingress).toBeLessThanOrEqual(18);
            expect(lengths.savedRow).toBeLessThanOrEqual(63);
            expect(lengths.main).toBeLessThanOrEqual(55);
            expect(
              Object.values(lengths).reduce((total, length) => total + length, 0),
            ).toBeLessThan(533);
            const measured = accounting(artifacts);
            expect(measured.container).toBeLessThanOrEqual(1395);
            expect(measured.payload).toBeLessThanOrEqual(1393);
            expect(measured.generalSfa).toBeLessThanOrEqual(45);
            expect(measured.zeroPage).toBeLessThanOrEqual(10);
            expect(measured.generatedStack).toBe(5);
            expect(measured.platformAndGlobals).toBe(50);
            expect(measured.scratch).toBe(0);
            expect(measured.resident).toBeLessThanOrEqual(1498);
            // Overlay with the later borrowed consumer forbids assuming an eleven-byte net RAM saving.
            console.info(
              JSON.stringify({
                profile,
                ...lengths,
                startup,
                restore,
                ...measured,
                generalSfaDelta: measured.generalSfa - 45,
                nominalPathCycles: "manual qualification required",
              }),
            );
          },
          INPUT_SOURCE,
          "W10211",
        );
      }, 120_000);
    }
  },
);
