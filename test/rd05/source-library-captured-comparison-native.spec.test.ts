import { describe, expect, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const predicates = [
  { name: "less than 128", expression: "m < 128", truth: (value: number) => value < 128 },
  { name: "greater than 127", expression: "m > 127", truth: (value: number) => value > 127 },
  { name: "at least 128", expression: "m >= 128", truth: (value: number) => value >= 128 },
  { name: "at most 127", expression: "m <= 127", truth: (value: number) => value <= 127 },
] as const;

function source(expression: string): string {
  return `module Game;
place(at: $3200) let result: byte;
function choose(): byte {
    let m: byte = peek($3300);
    if (${expression}) { interfere(); }
    return m;
}
function interfere(): void { poke($3210, $A1); poke($3300, $CC); }
function step(): void { poke($3202, $5A); }
function observed(): void { poke($3201, $A5); }
function main(): void {
    while (true) { step(); result = choose(); observed(); }
}`;
}

describe("captured byte comparisons across an ordinary clobbering call", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const predicate of predicates) {
      it(`${profile}: ${predicate.name} returns the original captured sample on both paths`, async () => {
        await withLibraryBuild(
          source(predicate.expression),
          "module Library;",
          profile,
          async (artifacts, built) => {
            expectLibraryAccounting(artifacts);
            await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
              const step = libraryEntry(artifacts, "src/game.blend::Game.step");
              const observed = libraryEntry(artifacts, "src/game.blend::Game.observed");
              await stopAt(step);
              const events = new Map<number, string>();
              for (const [address, operation] of [
                [0x3300, "load"],
                [0x3300, "store"],
                [0x3210, "store"],
                [0x3200, "store"],
                [0x3201, "store"],
                [0x3202, "store"],
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
                for (let sample = 0; sample < 256; sample += 1) {
                  await monitor.writeMemory(0x3300, new Uint8Array([sample]));
                  await monitor.writeMemory(0x3200, new Uint8Array([0x5a, 0, 0]));
                  await monitor.writeMemory(0x3210, new Uint8Array([0]));
                  const before = await monitor.readCpuRegisters();
                  trace();
                  await stopAt(observed);
                  const after = await monitor.readCpuRegisters();
                  const called = predicate.truth(sample);
                  expect(
                    (await monitor.readMemory(0x3200, 0x3200))[0],
                    `captured sample ${sample}`,
                  ).toBe(sample);
                  expect(trace()).toEqual([
                    "store:$3202",
                    "load:$3300",
                    ...(called ? ["store:$3210", "store:$3300"] : []),
                    "store:$3200",
                  ]);
                  expect((await monitor.readMemory(0x3300, 0x3300))[0]).toBe(
                    called ? 0xcc : sample,
                  );
                  expect((await monitor.readMemory(0x3210, 0x3210))[0]).toBe(called ? 0xa1 : 0);
                  expect(after.sp).toBe(before.sp);
                  expect(after.p & 0x0c).toBe(before.p & 0x0c);
                  await stopAt(step);
                  expect(trace()).toEqual(["store:$3201"]);
                  expect((await monitor.readMemory(0x3201, 0x3201))[0]).toBe(0xa5);
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
