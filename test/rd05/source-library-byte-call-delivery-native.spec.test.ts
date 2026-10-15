import { describe, expect, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const bytes = Array.from({ length: 256 }, (_, value) => value);
const singleBytes = bytes.map((value) => [value]);
const step = "function step(): void { poke($3203, $5A); }";
const observed = "function observed(): void { poke($3202, $A5); }";
const unsignedSink = "function sink(value: byte): void { poke($3200, value); }";
const wordSink = "function sink(value: word): void { pokew($3200, value); }";

// Values come from by-value calls, represented casts, and little-endian memory semantics.
// Trace order is authored from source evaluation order, independently of emitted instructions.
const cases = [
  {
    name: "one unsigned byte argument",
    functions: unsignedSink,
    body: "sink(peek($3300));",
    inputs: singleBytes,
    output: (input: number[]) => [input[0]!],
    after: (input: number[]) => input,
    events: ["s3203", "l3300", "s3200", "s3202"],
  },
  {
    name: "one signed byte argument through same-width reinterpretation",
    functions: "function sink(value: sbyte): void { poke($3200, byte(value)); }",
    body: "sink(sbyte(peek($3300)));",
    inputs: singleBytes,
    output: (input: number[]) => [input[0]!],
    after: (input: number[]) => input,
    events: ["s3203", "l3300", "s3200", "s3202"],
  },
  {
    name: "one byte produced by an ordinary call",
    functions: `${unsignedSink}
function producer(): byte { return peek($3300); }`,
    body: "sink(producer());",
    inputs: singleBytes,
    output: (input: number[]) => [input[0]!],
    after: (input: number[]) => input,
    events: ["s3203", "l3300", "s3200", "s3202"],
  },
  {
    name: "two effectful arguments evaluated left before right",
    functions: `function left(): byte {
  let value: byte = peek($3300); poke($3210, $A1); return value;
}
function right(): byte {
  let value: byte = peek($3301); poke($3211, $B2);
  poke($3300, $CC); return value;
}
function sink(first: byte, second: byte): void {
  poke($3200, first); poke($3201, second);
}`,
    body: "sink(left(), right());",
    inputs: bytes.map((value) => [value, (value * 73 + 19) & 255]),
    output: (input: number[]) => input,
    after: (input: number[]) => [0xcc, input[1]!],
    events: ["s3203", "l3300", "s3210", "l3301", "s3211", "s3300", "s3200", "s3201", "s3202"],
  },
  {
    name: "a word argument preserves both bytes at width boundaries",
    functions: wordSink,
    body: "sink(peekw($3300));",
    inputs: [0, 1, 255, 256, 0x7fff, 0x8000, 0xffff].map((value) => [value & 255, value >>> 8]),
    output: (input: number[]) => input,
    after: (input: number[]) => input,
    events: ["s3203", "l3300", "l3301", "s3200", "s3201", "s3202"],
  },
  {
    name: "a captured byte reused across a mutating call",
    functions: `${unsignedSink}
function secondSink(value: byte): void { poke($3201, value); }
function mutate(): void { poke($3210, $A1); poke($3300, $CC); }`,
    body: "let value: byte = peek($3300); sink(value); mutate(); secondSink(value);",
    inputs: singleBytes,
    output: (input: number[]) => [input[0]!, input[0]!],
    after: () => [0xcc],
    events: ["s3203", "l3300", "s3200", "s3210", "s3300", "s3201", "s3202"],
  },
  {
    name: "a nonidentity byte-to-word conversion zero extends",
    functions: wordSink,
    body: "sink(word(peek($3300)));",
    inputs: singleBytes,
    output: (input: number[]) => [input[0]!, 0],
    after: (input: number[]) => input,
    events: ["s3203", "l3300", "s3200", "s3201", "s3202"],
  },
  {
    name: "a two-target ordinary call evaluates its target before its argument",
    functions: `${unsignedSink}
function otherSink(value: byte): void { poke($3200, value ^ $FF); }
function target(): fn(byte): void {
  return peek($3301) == 0 ? &sink : &otherSink;
}`,
    body: "target()(peek($3300));",
    inputs: [0, 1].flatMap((selector) => bytes.map((value) => [value, selector])),
    output: (input: number[]) => [input[1] === 0 ? input[0]! : input[0]! ^ 255],
    after: (input: number[]) => input,
    events: ["s3203", "l3301", "l3300", "s3200", "s3202"],
  },
];

describe("ordinary byte call delivery preserves source values and effects", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const probe of cases) {
      it(`${profile}: ${probe.name}`, async () => {
        const source = `module Game;
${probe.functions}
function deliver(): void { ${probe.body} }
${step}
${observed}
function main(): void { while (true) { step(); deliver(); observed(); } }
`;
        await withLibraryBuild(source, "module Library;", profile, async (artifacts, built) => {
          expectLibraryAccounting(artifacts);
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            const tracepoints = new Map<number, string>();
            for (const address of [0x3300, 0x3301, 0x3302, 0x3303]) {
              tracepoints.set(
                await monitor.setAccessTracepoint(address, "load"),
                `l${address.toString(16)}`,
              );
              tracepoints.set(
                await monitor.setAccessTracepoint(address, "store"),
                `s${address.toString(16)}`,
              );
            }
            for (const address of [0x3200, 0x3201, 0x3202, 0x3203, 0x3210, 0x3211]) {
              tracepoints.set(
                await monitor.setAccessTracepoint(address, "store"),
                `s${address.toString(16)}`,
              );
            }
            try {
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
              for (const input of probe.inputs) {
                await monitor.writeMemory(
                  0x3300,
                  Uint8Array.from([
                    ...input,
                    ...Array.from({ length: 4 - input.length }, () => 0x6d),
                  ]),
                );
                await monitor.writeMemory(0x3200, Uint8Array.from([0x96, 0x69, 0, 0]));
                await monitor.writeMemory(0x3210, Uint8Array.from([0x96, 0x69]));
                const before = await monitor.readCpuRegisters();
                monitor.takeCheckpointHits();
                await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
                // Execute the observed marker and stop at the next iteration's equal-depth step.
                await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
                const after = await monitor.readCpuRegisters();
                expect(
                  monitor
                    .takeCheckpointHits()
                    .filter((id) => tracepoints.has(id))
                    .map((id) => tracepoints.get(id)),
                  `${probe.name}: ${input}`,
                ).toEqual(probe.events);
                const expected = probe.output(input);
                expect([
                  ...(await monitor.readMemory(0x3200, 0x3200 + expected.length - 1)),
                ]).toEqual(expected);
                expect([...(await monitor.readMemory(0x3300, 0x3303))]).toEqual([
                  ...probe.after(input),
                  ...Array.from({ length: 4 - input.length }, () => 0x6d),
                ]);
                expect([...(await monitor.readMemory(0x3202, 0x3203))]).toEqual([0xa5, 0x5a]);
                expect([...(await monitor.readMemory(0x3210, 0x3211))]).toEqual([
                  probe.events.includes("s3210") ? 0xa1 : 0x96,
                  probe.events.includes("s3211") ? 0xb2 : 0x69,
                ]);
                expect(after.sp).toBe(before.sp);
                expect(after.p & 0x0c).toBe(before.p & 0x0c);
              }
            } finally {
              for (const checkpoint of tracepoints.keys())
                await monitor.deleteCheckpoint(checkpoint);
            }
          });
        });
      }, 180_000);
    }
  }
});
