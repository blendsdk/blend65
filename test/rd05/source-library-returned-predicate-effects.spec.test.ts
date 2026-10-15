import { describe, expect, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const boundaries = [0, 1, 255, 256, 0x7fff, 0x8000, 0xffff] as const;
const comparisons = [
  { name: "equal", operator: "==", truth: (left: number, right: number) => left === right },
  { name: "unequal", operator: "!=", truth: (left: number, right: number) => left !== right },
  { name: "less", operator: "<", truth: (left: number, right: number) => left < right },
  { name: "lessEqual", operator: "<=", truth: (left: number, right: number) => left <= right },
  { name: "greater", operator: ">", truth: (left: number, right: number) => left > right },
  { name: "greaterEqual", operator: ">=", truth: (left: number, right: number) => left >= right },
] as const;

function source(type: "word" | "sword"): string {
  return `module Game;
place(at: $3300) let first: ${type};
place(at: $3302) let second: ${type};
${comparisons.map((_, index) => `place(at: $${(0x3200 + index).toString(16)}) let result${index}: boolean;`).join("\n")}
place(at: $3208) let effectResult: boolean;
${comparisons.map(({ name, operator }) => `function ${name}(): boolean { return first ${operator} second; }`).join("\n")}
function left(): ${type} {
    let captured: ${type} = ${type}(peekw($3300));
    poke($3210, $A1);
    return captured;
}
function right(): ${type} {
    let captured: ${type} = ${type}(peekw($3302));
    poke($3211, $B2);
    pokew($3300, $7FFF);
    return captured;
}
function effectful(): boolean { return left() < right(); }
function step(): void { poke($3207, $5A); }
function observed(): void { poke($3206, $A5); }
function effectObserved(): void { poke($3209, $C3); }
function main(): void {
    while (true) {
        step();
        ${comparisons.map(({ name }, index) => `result${index} = ${name}();`).join("\n        ")}
        observed();
        effectResult = effectful();
        effectObserved();
    }
}`;
}

/** Interpret the published integer representation independently of comparison lowering. */
function mathematicalValue(bits: number, type: "word" | "sword"): number {
  return type === "sword" && bits >= 0x8000 ? bits - 0x10000 : bits;
}

function expectTruth(byte: number, truth: boolean, context: string): void {
  if (truth) expect(byte, context).not.toBe(0);
  else expect(byte, context).toBe(0);
}

describe("ordinary returned wide predicates and effectful operands", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const type of ["word", "sword"] as const) {
      it(`${profile}: ${type} comparisons preserve mathematical truth and captured operand order`, async () => {
        await withLibraryBuild(
          source(type),
          "module Library;",
          profile,
          async (artifacts, built) => {
            expectLibraryAccounting(artifacts);
            await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
              const entry = (name: string) =>
                libraryEntry(artifacts, `src/game.blend::Game.${name}`);
              const step = entry("step");
              const observed = entry("observed");
              const effectObserved = entry("effectObserved");
              await stopAt(step);
              const events = new Map<number, string>();
              for (const address of [0x3300, 0x3301, 0x3302, 0x3303]) {
                for (const operation of ["load", "store"] as const) {
                  events.set(
                    await monitor.setAccessTracepoint(address, operation),
                    `${operation}:$${address.toString(16)}`,
                  );
                }
              }
              for (const address of [
                ...Array.from({ length: 10 }, (_, i) => 0x3200 + i),
                0x3210,
                0x3211,
              ]) {
                events.set(
                  await monitor.setAccessTracepoint(address, "store"),
                  `store:$${address.toString(16)}`,
                );
              }
              const trace = () =>
                monitor.takeCheckpointHits().flatMap((id) => {
                  const event = events.get(id);
                  return event === undefined ? [] : [event];
                });
              try {
                for (const leftBits of boundaries) {
                  for (const rightBits of boundaries) {
                    const input = [
                      leftBits & 0xff,
                      leftBits >> 8,
                      rightBits & 0xff,
                      rightBits >> 8,
                    ];
                    await monitor.writeMemory(0x3300, new Uint8Array(input));
                    await monitor.writeMemory(0x3200, new Uint8Array(10).fill(0x5a));
                    await monitor.writeMemory(0x3210, new Uint8Array([0, 0]));
                    const before = await monitor.readCpuRegisters();
                    trace();
                    await stopAt(observed);
                    const after = await monitor.readCpuRegisters();
                    const results = await monitor.readMemory(0x3200, 0x3205);
                    const left = mathematicalValue(leftBits, type);
                    const right = mathematicalValue(rightBits, type);
                    for (const [index, comparison] of comparisons.entries()) {
                      expectTruth(
                        results[index]!,
                        comparison.truth(left, right),
                        `${type} ${left} ${comparison.operator} ${right}`,
                      );
                    }
                    expect(trace().filter((event) => event.startsWith("store:"))).toEqual([
                      "store:$3207",
                      ...comparisons.map((_, i) => `store:$${(0x3200 + i).toString(16)}`),
                    ]);
                    expect([...(await monitor.readMemory(0x3300, 0x3303))]).toEqual(input);
                    expect(after.sp).toBe(before.sp);
                    expect(after.p & 0x0c).toBe(before.p & 0x0c);

                    await stopAt(effectObserved);
                    const effectState = await monitor.readCpuRegisters();
                    expectTruth(
                      (await monitor.readMemory(0x3208, 0x3208))[0]!,
                      left < right,
                      `captured ${type} ${left} < ${right}`,
                    );
                    // The later mutation must not change the left operand already returned to its caller.
                    expect(trace()).toEqual([
                      "store:$3206",
                      "load:$3300",
                      "load:$3301",
                      "store:$3210",
                      "load:$3302",
                      "load:$3303",
                      "store:$3211",
                      "store:$3300",
                      "store:$3301",
                      "store:$3208",
                    ]);
                    expect([...(await monitor.readMemory(0x3300, 0x3303))]).toEqual([
                      0xff,
                      0x7f,
                      input[2],
                      input[3],
                    ]);
                    expect([...(await monitor.readMemory(0x3210, 0x3211))]).toEqual([0xa1, 0xb2]);
                    expect(effectState.sp).toBe(before.sp);
                    expect(effectState.p & 0x0c).toBe(before.p & 0x0c);
                    await stopAt(step);
                    expect(trace()).toEqual(["store:$3209"]);
                    expect((await monitor.readMemory(0x3209, 0x3209))[0]).toBe(0xc3);
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
