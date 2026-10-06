import { describe, expect, it } from "vitest";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  profileSpan,
} from "./profile-fixture.js";

const TARGETS = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];

/** Arm IRQ before a later global initializer, keeping all memory effects ordinary source operations. */
function initializerSource(withHelper: boolean): string {
  const expression = withHelper ? "combineBytes(peek($c010), peek($c011))" : "peekw(ADDRESS)";
  const helper = withHelper
    ? "function combineBytes(low: byte, high: byte): word { return word(low) | (word(high) << 8); }"
    : "";
  return `module Game;
import { setIRQ, restoreIRQ, setNMI, restoreNMI } from c64.system;
let ADDRESS: word = $c010;
let armed: byte = arm();
let result: word = ${expression};
function arm(): byte { setIRQ(&handler); return 0; }
${helper}
interrupt function handler(): void {
  let a: byte = peek($c012);
  let b: byte = peek($c013);
  poke($c014, a);
  poke($c015, b);
}
interrupt function empty(): void {}
export function main(): void {
  setNMI(&empty); restoreNMI(); restoreIRQ(); pokew($c016, result);
}
`;
}

type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;
type Evidence = Record<string, unknown>;
type Home = { addressSpaceIndex: number; start: number; end: number };

/** Missing source and location fields must fail instead of producing an empty witness. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new TypeError("Expected integer source or storage evidence");
  return value;
}

/** Match one source proof using its UTF-8 identity, never a generated storage name. */
function sourceSymbols(artifacts: Artifacts, source: string, proof: string, contained = false) {
  const wanted = profileSpan(source, proof);
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    (entry) => entry.path === wanted.sourceId,
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  return profileRecords(artifacts.debug.symbols).filter((symbol) => {
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") return false;
    const span = profileRecord(origin.span);
    if (span.sourceIndex !== sourceIndex) return false;
    const start = integer(span.startByte);
    const end = integer(span.endByte);
    return contained
      ? start >= wanted.start && end <= wanted.end && start < end
      : start === wanted.start && end === wanted.end;
  });
}

/** Resolve available physical memory pieces while preserving each symbol's actual width. */
function memoryHomes(artifacts: Artifacts, symbols: Evidence[]): Home[] {
  const inventory = profileRecords(artifacts.debug.symbols);
  const locations = profileRecords(artifacts.debug.locations);
  return symbols.flatMap((symbol) => {
    const symbolIndex = inventory.indexOf(symbol);
    if (!Array.isArray(symbol.locationIndexes)) throw new TypeError("Missing storage locations");
    return symbol.locationIndexes.flatMap((index) => {
      const location = locations[integer(index)]!;
      expect(location.symbolIndex).toBe(symbolIndex);
      const availability = profileRecord(location.availability);
      if (availability.kind !== "available") return [];
      return profileRecords(availability.pieces).flatMap((piece) => {
        if (piece.kind !== "memory") return [];
        const machine = profileRecord(piece.machine);
        const home = {
          addressSpaceIndex: integer(machine.addressSpaceIndex),
          start: integer(machine.start),
          end: integer(machine.end),
        };
        expect(home.end - home.start).toBe(integer(piece.byteLength));
        expect(integer(piece.valueOffset)).toBeGreaterThanOrEqual(0);
        expect(integer(piece.valueOffset) + integer(piece.byteLength)).toBeLessThanOrEqual(
          integer(symbol.byteWidth),
        );
        return [home];
      });
    });
  });
}

/** Asynchronous writes cannot share a physical home with a saved mainline value. */
function requireDisjoint(mainline: Home[], interrupt: Home[]) {
  expect(mainline.length, "Witnessed live initializer storage").toBeGreaterThan(0);
  expect(interrupt.length, "Witnessed live interrupt storage").toBeGreaterThan(0);
  for (const main of mainline)
    for (const irq of interrupt)
      if (main.addressSpaceIndex === irq.addressSpaceIndex)
        expect(
          main.end <= irq.start || irq.end <= main.start,
          `Initializer [${main.start},${main.end}) and IRQ [${irq.start},${irq.end}) must be disjoint`,
        ).toBe(true);
}

/** Source-local IRQ homes remain identified even if their display names change. */
function handlerHomes(artifacts: Artifacts, source: string): Home[] {
  const functions = profileRecords(artifacts.debug.functions);
  const handler = functions.find((fn) => fn.qualifiedName === "src/game.blend::Game.handler");
  expect(handler).toMatchObject({ kind: "interrupt" });
  const locals = ["let a: byte = peek($c012);", "let b: byte = peek($c013);"];
  return locals.flatMap((declaration) => {
    const symbols = sourceSymbols(artifacts, source, declaration, true).filter(
      (symbol) =>
        symbol.kind === "local" &&
        symbol.byteWidth === 1 &&
        symbol.scope === handler!.qualifiedName,
    );
    expect(symbols.length, `Source IRQ local: ${declaration}`).toBeGreaterThan(0);
    return memoryHomes(artifacts, symbols);
  });
}

describe.each(TARGETS)("Initializer and asynchronous IRQ lifetimes on %s", (target) => {
  // The low byte remains live across the second read; IRQ locals must not overwrite it or its pointer.
  it("should keep a saved initializer word-read byte disjoint from asynchronous IRQ homes", async () => {
    const source = initializerSource(false);
    const artifacts = await buildProfileSource(source, target);
    const declaration = "let result: word = peekw(ADDRESS);";
    const globals = sourceSymbols(artifacts, source, declaration).filter(
      (symbol) => symbol.kind === "global" && symbol.byteWidth === 2,
    );
    expect(globals).toHaveLength(1);
    const span = profileSpan(source, declaration);
    const scope = `initializer::${span.sourceId}:${span.start}:${span.end}`;
    expect(profileRecords(artifacts.debug.functions).some((fn) => fn.qualifiedName === scope)).toBe(
      true,
    );
    const temporaries = sourceSymbols(artifacts, source, "peekw(ADDRESS)").filter(
      (symbol) => symbol.kind === "temporary" && symbol.scope === scope,
    );
    const savedBytes = temporaries.filter((symbol) => symbol.byteWidth === 1);
    expect(savedBytes.length, "Source-correlated saved low byte").toBeGreaterThan(0);
    const irq = handlerHomes(artifacts, source);
    requireDisjoint(memoryHomes(artifacts, savedBytes), irq);
    // Pointer projection is optional; every projected private pointer still obeys domain separation.
    const pointers = memoryHomes(
      artifacts,
      temporaries.filter((symbol) => symbol.byteWidth === 2),
    );
    if (pointers.length > 0) requireDisjoint(pointers, irq);
  }, 30_000);

  // Left-to-right initializer arguments live in the helper's static frame before the ordinary call.
  it("should keep initializer helper argument homes disjoint from asynchronous IRQ homes", async () => {
    const source = initializerSource(true);
    const artifacts = await buildProfileSource(source, target);
    const helper =
      "function combineBytes(low: byte, high: byte): word { return word(low) | (word(high) << 8); }";
    const parameters = sourceSymbols(artifacts, source, helper, true).filter(
      (symbol) =>
        symbol.kind === "parameter" &&
        symbol.byteWidth === 1 &&
        symbol.scope === "src/game.blend::Game.combineBytes",
    );
    expect(parameters).toHaveLength(2);
    const irq = handlerHomes(artifacts, source);
    for (const parameter of parameters) requireDisjoint(memoryHomes(artifacts, [parameter]), irq);
  }, 30_000);
});
