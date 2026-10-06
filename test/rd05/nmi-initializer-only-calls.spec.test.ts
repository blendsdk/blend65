import { describe, expect, it } from "vitest";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  profileSpan,
} from "./profile-fixture.js";

const targets = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];

const source = `module Game;
let first: byte = peek($c010);
let out: byte = choose(first, inner(7));
function inner(x: byte): byte { return x; }
function choose(a: byte, b: byte): byte { return a; }
export function main(): void { poke($c016, out); }
`;

type Home = { addressSpaceIndex: number; start: number; end: number };

function homes(
  debug: Record<string, unknown>,
  sourceIndex: number,
  scope: string,
  kind: string,
  proof: string,
  occurrence: number,
  contained: boolean,
): Home[] {
  const span = profileSpan(source, proof, occurrence);
  const symbols = profileRecords(debug.symbols);
  const locations = profileRecords(debug.locations);
  const selected = symbols.filter((symbol) => {
    if (symbol.scope !== scope || symbol.kind !== kind || symbol.byteWidth !== 1) return false;
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") return false;
    const actual = profileRecord(origin.span);
    return (
      actual.sourceIndex === sourceIndex &&
      (contained
        ? Number(actual.startByte) >= span.start && Number(actual.endByte) <= span.end
        : actual.startByte === span.start && actual.endByte === span.end)
    );
  });
  expect(selected.length, `Required source-correlated ${kind} in ${scope}`).toBeGreaterThan(0);
  const result: Home[] = [];
  for (const symbol of selected) {
    expect(Array.isArray(symbol.locationIndexes)).toBe(true);
    const indexes = symbol.locationIndexes as number[];
    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) {
      expect(Number.isInteger(index) && index >= 0 && index < locations.length).toBe(true);
      const location = locations[index]!;
      expect(location.symbolIndex).toBe(symbols.indexOf(symbol));
      const availability = profileRecord(location.availability);
      if (availability.kind !== "available") continue;
      for (const piece of profileRecords(availability.pieces)) {
        if (piece.kind !== "memory") continue;
        const machine = profileRecord(piece.machine);
        expect(piece.valueOffset).toBe(0);
        expect(piece.byteLength).toBe(1);
        const home = {
          addressSpaceIndex: Number(machine.addressSpaceIndex),
          start: Number(machine.start),
          end: Number(machine.end),
        };
        expect(Number.isInteger(home.addressSpaceIndex)).toBe(true);
        expect(Number.isInteger(home.start)).toBe(true);
        expect(home.end - home.start).toBe(1);
        result.push(home);
      }
    }
  }
  expect(result.length, "Required actual available memory homes").toBeGreaterThan(0);
  return result;
}

describe.each(targets)("initializer-only nested calls on %s", (target) => {
  it("retains the outer first argument independently of the inner parameter", async () => {
    const artifacts = await buildProfileSource(source, target);
    expect(artifacts.prg.length).toBeGreaterThan(2);
    const debug = artifacts.debug;
    const sources = profileRecords(debug.sources);
    const sourceIndex = sources.findIndex((entry) => entry.path === "src/game.blend");
    expect(sourceIndex).toBeGreaterThanOrEqual(0);
    const declaration = profileSpan(source, "let out: byte = choose(first, inner(7));");
    const initializer = `initializer::${declaration.sourceId}:${declaration.start}:${declaration.end}`;
    const functions = profileRecords(debug.functions);
    const inner = functions.find((entry) => entry.qualifiedName === "src/game.blend::Game.inner");
    expect(inner).toBeDefined();
    expect(inner!.kind).toBe("ordinary");
    const staged = homes(debug, sourceIndex, initializer, "temporary", "first", 1, false);
    const parameter = homes(
      debug,
      sourceIndex,
      String(inner!.qualifiedName),
      "parameter",
      "x: byte",
      0,
      true,
    );
    const physical = profileRecords(artifacts.memory.intervals).filter((interval) =>
      ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)),
    );
    for (const home of [...staged, ...parameter]) {
      expect(
        physical.some(
          (interval) => Number(interval.start) <= home.start && Number(interval.end) >= home.end,
        ),
        "Available private home must have actual physical storage",
      ).toBe(true);
    }
    // choose returns the saved first value, not the inner call's constant seven.
    for (const outer of staged) {
      for (const nested of parameter) {
        expect(
          outer.addressSpaceIndex !== nested.addressSpaceIndex ||
            outer.end <= nested.start ||
            nested.end <= outer.start,
          `Live outer ${JSON.stringify(outer)} overlaps inner ${JSON.stringify(nested)}`,
        ).toBe(true);
      }
    }
  });
});
