import { describe, expect, it } from "vitest";
import {
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const values = [0, 1, 0x80, 0xff] as const;
const predicates = [
  { name: "zero equality", expression: "input == 0", kind: "equal" },
  { name: "zero inequality", expression: "input != 0", kind: "unequal" },
  { name: "ordered conjunction", expression: "(input != 0) && (peek($3301) != 0)", kind: "and" },
  { name: "ordered disjunction", expression: "(input == 0) || (peek($3301) != 0)", kind: "or" },
  { name: "raw Boolean", expression: "rawBool", kind: "raw" },
] as const;

function source(expression: string, raw: boolean): string {
  return `module Game;
place(at: $3300) let ${raw ? "rawBool: boolean" : "input: byte"};
place(at: $3200) let result: boolean;
function predicate(): boolean { return ${expression}; }
function observed(): void { poke($3201, $A5); }
function main(): void {
    while (true) { result = predicate(); observed(); }
}`;
}

describe("ordinary returned predicate native behavior", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const predicate of predicates) {
      it(`${profile}: ${predicate.name} preserves truth, ordered reads and ordinary call state`, async () => {
        await withLibraryBuild(
          source(predicate.expression, predicate.kind === "raw"),
          "module Library;",
          profile,
          async (artifacts, built) => {
            await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
              const entry = libraryEntry(artifacts, "src/game.blend::Game.predicate");
              const observed = libraryEntry(artifacts, "src/game.blend::Game.observed");
              await stopAt(entry);
              const events = new Map<number, string>();
              for (const [address, operation] of [
                [0x3300, "load"],
                [0x3301, "load"],
                [0x3300, "store"],
                [0x3301, "store"],
                [0x3200, "store"],
                [0x3201, "store"],
              ] as const) {
                events.set(
                  await monitor.setAccessTracepoint(address, operation),
                  `${operation}:$${address.toString(16)}`,
                );
              }
              const trace = () =>
                monitor.takeCheckpointHits().flatMap((id) => {
                  const event = events.get(id);
                  return event === undefined ? [] : [event];
                });
              try {
                for (const left of values) {
                  const rights = predicate.kind === "and" || predicate.kind === "or" ? values : [0];
                  for (const right of rights) {
                    await monitor.writeMemory(0x3300, new Uint8Array([left, right]));
                    await monitor.writeMemory(0x3200, new Uint8Array([0x5a, 0]));
                    const before = await monitor.readCpuRegisters();
                    trace();
                    await stopAt(observed);
                    const after = await monitor.readCpuRegisters();
                    const byte = (await monitor.readMemory(0x3200, 0x3200))[0]!;
                    const truth =
                      predicate.kind === "equal"
                        ? left === 0
                        : predicate.kind === "unequal"
                          ? left !== 0
                          : predicate.kind === "and"
                            ? left !== 0 && right !== 0
                            : predicate.kind === "or"
                              ? left === 0 || right !== 0
                              : left !== 0;
                    if (predicate.kind === "raw") expect(byte).toBe(left);
                    else if (truth) expect(byte).not.toBe(0);
                    else expect(byte).toBe(0);
                    const readsRight =
                      (predicate.kind === "and" && left !== 0) ||
                      (predicate.kind === "or" && left !== 0);
                    expect(trace()).toEqual([
                      "load:$3300",
                      ...(readsRight ? ["load:$3301"] : []),
                      "store:$3200",
                    ]);
                    expect([...(await monitor.readMemory(0x3300, 0x3301))]).toEqual([left, right]);
                    expect(after.sp).toBe(before.sp);
                    expect(after.p & 0x0c).toBe(before.p & 0x0c);
                    await stopAt(entry);
                    expect(trace()).toEqual(["store:$3201"]);
                    expect((await monitor.readMemory(0x3201, 0x3201))[0]).toBe(0xa5);
                  }
                }
              } finally {
                for (const checkpoint of events.keys()) await monitor.deleteCheckpoint(checkpoint);
              }
            });
          },
        );
      }, 180_000);
    }
  }
});
