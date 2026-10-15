import { describe, expect, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

type Mode = "capture" | "parameter" | "call" | "multiple" | "second" | "word";
interface Probe {
  readonly name: string;
  readonly expression: string;
  readonly mode: Mode;
  readonly operation: "and" | "or" | "xor";
}
const probes: readonly Probe[] = [
  {
    name: "captured subtraction and AND",
    expression: "m & (m - 1)",
    mode: "capture",
    operation: "and",
  },
  {
    name: "reversed subtraction and AND",
    expression: "(m - 1) & m",
    mode: "capture",
    operation: "and",
  },
  { name: "captured addition and OR", expression: "m | (m + 1)", mode: "capture", operation: "or" },
  {
    name: "captured addition and XOR",
    expression: "m ^ (m + 1)",
    mode: "capture",
    operation: "xor",
  },
  {
    name: "owned parameter subtraction and AND",
    expression: "m & (m - 1)",
    mode: "parameter",
    operation: "and",
  },
  {
    name: "intervening call retains captured arithmetic",
    expression: "m & arithmetic",
    mode: "call",
    operation: "and",
  },
  {
    name: "multiple uses retain the arithmetic value",
    expression: "m & arithmetic",
    mode: "multiple",
    operation: "and",
  },
  {
    name: "later mutation retains both captured operands",
    expression: "m & arithmetic",
    mode: "second",
    operation: "and",
  },
  {
    name: "word arithmetic preserves its width",
    expression: "m & (m - 1)",
    mode: "word",
    operation: "and",
  },
];

function source(probe: Probe): string {
  const wide = probe.mode === "word";
  const parameter = probe.mode === "parameter";
  const type = wide ? "word" : "byte";
  let capture = parameter ? "" : `let m: ${type} = ${wide ? "peekw" : "peek"}($3300);`;
  if (probe.mode === "call") capture += "\n    let arithmetic: byte = m - 1; interfere();";
  if (probe.mode === "multiple")
    capture += "\n    let arithmetic: byte = m - 1; poke($3211, arithmetic);";
  if (probe.mode === "second")
    capture += "\n    let n: byte = peek($3301); let arithmetic: byte = n - 1; interfere();";
  const mutation = probe.mode === "second" ? "$3301" : "$3300";
  return `module Game;
place(at: $3200) let result: ${type};
function combine(${parameter ? "m: byte" : ""}): ${type} {
    ${capture}
    return ${probe.expression};
}
function interfere(): void { poke($3210, $A1); poke(${mutation}, $CC); }
function step(): void { poke(${wide ? "$3203" : "$3202"}, $5A); }
function observed(): void { poke(${wide ? "$3202" : "$3201"}, $A5); }
function main(): void {
    while (true) { step(); result = combine(${parameter ? "peek($3300)" : ""}); observed(); }
}`;
}

/** Model unsigned fixed-width arithmetic mathematically, then combine the represented bits. */
function expected(probe: Probe, first: number, second: number): number {
  const mask = probe.mode === "word" ? 0xffff : 0xff;
  if (probe.operation === "or") return first | ((first + 1) & mask);
  if (probe.operation === "xor") return first ^ ((first + 1) & mask);
  return first & (((probe.mode === "second" ? second : first) - 1) & mask);
}

describe("ordinary byte arithmetic and bitwise native behavior", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const probe of probes) {
      it(`${profile}: ${probe.name} preserves wrapping, single captures and ordinary call state`, async () => {
        await withLibraryBuild(
          source(probe),
          "module Library;",
          profile,
          async (artifacts, built) => {
            expectLibraryAccounting(artifacts);
            await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
              const wide = probe.mode === "word";
              const step = libraryEntry(artifacts, "src/game.blend::Game.step");
              const observed = libraryEntry(artifacts, "src/game.blend::Game.observed");
              const marker = wide ? 0x3202 : 0x3201;
              const stepMarker = wide ? 0x3203 : 0x3202;
              await stopAt(step);
              const events = new Map<number, string>();
              for (const address of [0x3300, 0x3301]) {
                for (const operation of ["load", "store"] as const) {
                  events.set(
                    await monitor.setAccessTracepoint(address, operation),
                    `${operation}:$${address.toString(16)}`,
                  );
                }
              }
              for (const address of [0x3200, 0x3201, 0x3202, 0x3203, 0x3210, 0x3211]) {
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
              const inputs = wide
                ? [0, 1, 255, 256, 0x7fff, 0x8000, 0xffff, 0x55aa, 0xaa55]
                : Array.from({ length: 256 }, (_, value) => value);
              try {
                for (const first of inputs) {
                  const second = probe.mode === "second" ? (first + 17) & 0xff : 0x69;
                  const input = wide ? [first & 0xff, first >> 8] : [first, second];
                  await monitor.writeMemory(0x3300, new Uint8Array(input));
                  await monitor.writeMemory(0x3200, new Uint8Array(4).fill(0x5a));
                  await monitor.writeMemory(0x3210, new Uint8Array([0, 0]));
                  const before = await monitor.readCpuRegisters();
                  trace();
                  await stopAt(observed);
                  const after = await monitor.readCpuRegisters();
                  const result = await monitor.readMemory(0x3200, wide ? 0x3201 : 0x3200);
                  const actual = wide ? result[0]! | (result[1]! << 8) : result[0]!;
                  expect(actual, `${probe.name} with input ${first}`).toBe(
                    expected(probe, first, second),
                  );
                  const wanted = [
                    `store:$${stepMarker.toString(16)}`,
                    "load:$3300",
                    ...(wide || probe.mode === "second" ? ["load:$3301"] : []),
                    ...(probe.mode === "call" || probe.mode === "second"
                      ? ["store:$3210", `store:$${probe.mode === "second" ? "3301" : "3300"}`]
                      : []),
                    ...(probe.mode === "multiple" ? ["store:$3211"] : []),
                    "store:$3200",
                    ...(wide ? ["store:$3201"] : []),
                  ];
                  expect(trace()).toEqual(wanted);
                  const finalInput =
                    probe.mode === "call"
                      ? [0xcc, input[1]]
                      : probe.mode === "second"
                        ? [input[0], 0xcc]
                        : input;
                  expect([...(await monitor.readMemory(0x3300, 0x3301))]).toEqual(finalInput);
                  if (probe.mode === "call" || probe.mode === "second")
                    expect((await monitor.readMemory(0x3210, 0x3210))[0]).toBe(0xa1);
                  if (probe.mode === "multiple")
                    expect((await monitor.readMemory(0x3211, 0x3211))[0]).toBe((first - 1) & 0xff);
                  expect(after.sp).toBe(before.sp);
                  expect(after.p & 0x0c).toBe(before.p & 0x0c);
                  await stopAt(step);
                  expect(trace()).toEqual([`store:$${marker.toString(16)}`]);
                  expect((await monitor.readMemory(marker, marker))[0]).toBe(0xa5);
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
