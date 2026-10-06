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
const SOURCE = `module Game;
import { setIRQ, restoreIRQ, setNMI, restoreNMI } from c64.system;
let ADDRESS: word = $c010;
let armed: byte = arm();
let result: word = peekw(ADDRESS);
function arm(): byte { setIRQ(&handler); return 0; }
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

type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;

/** Missing storage coordinates must not turn an overlap check into a vacuous pass. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new TypeError("Expected integer evidence");
  return value;
}

/** Require actual memory homes of a compiler temporary identified only by source and scope. */
function retainedBytes(artifacts: Artifacts, scope: string, proof: string) {
  const span = profileSpan(SOURCE, proof);
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    (source) => source.path === span.sourceId,
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const inventory = profileRecords(artifacts.debug.symbols);
  const locations = profileRecords(artifacts.debug.locations);
  const symbols = inventory.filter((symbol) => {
    if (symbol.kind !== "temporary" || symbol.byteWidth !== 1 || symbol.scope !== scope)
      return false;
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") return false;
    const actual = profileRecord(origin.span);
    return (
      actual.sourceIndex === sourceIndex &&
      actual.startByte === span.start &&
      actual.endByte === span.end
    );
  });
  expect(symbols.length, `Source-retained temporary at ${proof}`).toBeGreaterThan(0);
  const homes = symbols.flatMap((symbol) => {
    if (!Array.isArray(symbol.locationIndexes)) throw new TypeError("Missing temporary locations");
    return symbol.locationIndexes.flatMap((index) => {
      const location = locations[integer(index)]!;
      expect(location.symbolIndex).toBe(inventory.indexOf(symbol));
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
        expect(home.end - home.start).toBe(1);
        expect(piece.byteLength).toBe(1);
        expect(piece.valueOffset).toBe(0);
        return [home];
      });
    });
  });
  expect(homes.length, `Available physical temporary at ${proof}`).toBeGreaterThan(0);
  return homes;
}

describe.each(TARGETS)("Initializer and IRQ compiler-temporary separation on %s", (target) => {
  // IRQ's first sampled byte and the initializer's saved low byte can both remain live during preemption.
  it("should separate a saved initializer byte from actual retained IRQ compiler temporaries", async () => {
    const artifacts = await buildProfileSource(SOURCE, target);
    const declaration = profileSpan(SOURCE, "let result: word = peekw(ADDRESS);");
    const initializerScope = `initializer::${declaration.sourceId}:${declaration.start}:${declaration.end}`;
    const functions = profileRecords(artifacts.debug.functions);
    expect(functions.some((fn) => fn.qualifiedName === initializerScope)).toBe(true);
    const handler = functions.find((fn) => fn.qualifiedName === "src/game.blend::Game.handler");
    expect(handler).toMatchObject({ kind: "interrupt" });
    if (typeof handler?.qualifiedName !== "string") throw new TypeError("Missing handler scope");
    const initializer = retainedBytes(artifacts, initializerScope, "peekw(ADDRESS)");
    const interrupt = retainedBytes(artifacts, handler.qualifiedName, "peek($c012)");
    for (const main of initializer)
      for (const irq of interrupt)
        if (main.addressSpaceIndex === irq.addressSpaceIndex)
          expect(
            main.end <= irq.start || irq.end <= main.start,
            `Initializer [${main.start},${main.end}) and IRQ [${irq.start},${irq.end}) must be disjoint`,
          ).toBe(true);
  }, 30_000);
});
