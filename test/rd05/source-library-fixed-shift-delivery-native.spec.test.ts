import { describe, expect, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

/** A source shift and its delivery/effect boundary, independently of selected machine instructions. */
interface Probe {
  readonly name: string;
  readonly operator: "<<" | ">>";
  readonly count: number;
  readonly signed: boolean;
  readonly mode: "fixed" | "dynamic" | "word" | "call" | "multiple" | "selected";
  readonly destination: "global" | "poke";
}
const shifts = [
  { name: "unsigned left 1", operator: "<<", count: 1, signed: false },
  { name: "unsigned left 3", operator: "<<", count: 3, signed: false },
  { name: "unsigned left 7", operator: "<<", count: 7, signed: false },
  { name: "unsigned right 1", operator: ">>", count: 1, signed: false },
  { name: "unsigned right 3", operator: ">>", count: 3, signed: false },
  { name: "unsigned right 7", operator: ">>", count: 7, signed: false },
  { name: "signed right 1", operator: ">>", count: 1, signed: true },
] as const;
const probes: readonly Probe[] = [
  ...shifts.map(
    (shift): Probe => ({
      ...shift,
      mode: "fixed",
      destination: shift.operator === "<<" && shift.count === 3 ? "poke" : "global",
    }),
  ),
  ...(["dynamic", "word", "call", "multiple", "selected"] as const).map(
    (mode): Probe => ({
      name: `${mode} shift delivery control`,
      operator: ">>",
      count: 3,
      signed: false,
      mode,
      destination: "global",
    }),
  ),
];

/** Use normal typed source for direct delivery and the distinct value/effect lifetime controls. */
function source(probe: Probe): string {
  const wide = probe.mode === "word";
  const type = wide ? "word" : probe.signed ? "sbyte" : "byte";
  const operation = `value ${probe.operator} ${probe.mode === "dynamic" ? "peek($3301)" : probe.count}`;
  const expression = probe.signed ? `byte(${operation})` : operation;
  let delivery =
    probe.destination === "global" ? `result = ${expression};` : `poke($3200, ${expression});`;
  if (probe.mode === "call")
    delivery = "let shifted: byte = value >> 3; interfere(); result = shifted;";
  if (probe.mode === "multiple")
    delivery = "let shifted: byte = value >> 3; poke($3211, shifted); result = shifted;";
  if (probe.mode === "selected")
    delivery = `let shifted: byte = value >> 3;
    if (peek($3301) != 0) { result = shifted; } else { poke($3204, shifted); }`;
  const input = wide ? "peekw($3300)" : probe.signed ? "sbyte(peek($3300))" : "peek($3300)";
  return `module Game;
place(at: $3200) let result: ${wide ? "word" : "byte"};
function deliver(value: ${type}): void { ${delivery} }
function interfere(): void { poke($3210, $A1); }
function step(): void { poke(${wide ? "$3203" : "$3202"}, $5A); }
function observed(): void { poke(${wide ? "$3202" : "$3201"}, $A5); }
function main(): void {
    while (true) { step(); deliver(${input}); observed(); }
}`;
}

/** Fixed-width shifts are mathematical multiplication/division, with signed right rounding downward. */
function expected(probe: Probe, value: number, control: number): number {
  const width = probe.mode === "word" ? 16 : 8;
  const modulus = 2 ** width;
  const count = probe.mode === "dynamic" ? control : probe.count;
  const integer = probe.signed && value >= 128 ? value - 256 : value;
  if (count >= width) return probe.signed && integer < 0 ? modulus - 1 : 0;
  const shifted = probe.operator === "<<" ? integer * 2 ** count : Math.floor(integer / 2 ** count);
  return ((shifted % modulus) + modulus) % modulus;
}

describe("ordinary fixed shift delivery native values and effects", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const probe of probes) {
      it(`${profile}: ${probe.name} preserves values, ordered effects and ordinary call state`, async () => {
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
                for (const operation of ["load", "store"] as const)
                  events.set(
                    await monitor.setAccessTracepoint(address, operation),
                    `${operation}:$${address.toString(16)}`,
                  );
              }
              for (const address of [0x3200, 0x3201, 0x3202, 0x3203, 0x3204, 0x3210, 0x3211])
                events.set(
                  await monitor.setAccessTracepoint(address, "store"),
                  `store:$${address.toString(16)}`,
                );
              const trace = () =>
                monitor.takeCheckpointHits().flatMap((id) => {
                  const event = events.get(id);
                  return event === undefined ? [] : [event];
                });
              const bytes = Array.from({ length: 256 }, (_, value) => value);
              const values = wide
                ? [
                    ...new Set([
                      ...bytes.map((value) => value * 257),
                      1,
                      7,
                      8,
                      255,
                      256,
                      0x7fff,
                      0x8000,
                    ]),
                  ]
                : bytes;
              try {
                for (const value of values) {
                  const control =
                    probe.mode === "dynamic"
                      ? [0, 1, 3, 7, 8, 255][value % 6]!
                      : probe.mode === "selected"
                        ? [0, 1, 0x80, 0xff][value % 4]!
                        : 0x69;
                  const input = wide ? [value & 0xff, value >> 8] : [value, control];
                  await monitor.writeMemory(0x3300, new Uint8Array(input));
                  await monitor.writeMemory(0x3200, new Uint8Array(5).fill(0x5a));
                  await monitor.writeMemory(0x3210, new Uint8Array([0, 0]));
                  const before = await monitor.readCpuRegisters();
                  trace();
                  await stopAt(observed);
                  const after = await monitor.readCpuRegisters();
                  const answer = expected(probe, value, control);
                  const selected = probe.mode === "selected" && control === 0;
                  const result = await monitor.readMemory(
                    selected ? 0x3204 : 0x3200,
                    selected ? 0x3204 : wide ? 0x3201 : 0x3200,
                  );
                  const actual = wide ? result[0]! | (result[1]! << 8) : result[0]!;
                  expect(actual, `${probe.name}, input ${value}, control ${control}`).toBe(answer);
                  const wanted = [
                    `store:$${stepMarker.toString(16)}`,
                    "load:$3300",
                    ...(wide || probe.mode === "dynamic" || probe.mode === "selected"
                      ? ["load:$3301"]
                      : []),
                    ...(probe.mode === "call" ? ["store:$3210"] : []),
                    ...(probe.mode === "multiple" ? ["store:$3211"] : []),
                    selected ? "store:$3204" : "store:$3200",
                    ...(wide ? ["store:$3201"] : []),
                  ];
                  expect(trace()).toEqual(wanted);
                  expect([...(await monitor.readMemory(0x3300, 0x3301))]).toEqual(input);
                  if (probe.mode === "call")
                    expect((await monitor.readMemory(0x3210, 0x3210))[0]).toBe(0xa1);
                  if (probe.mode === "multiple")
                    expect((await monitor.readMemory(0x3211, 0x3211))[0]).toBe(answer);
                  if (probe.mode === "selected")
                    expect(
                      (
                        await monitor.readMemory(
                          selected ? 0x3200 : 0x3204,
                          selected ? 0x3200 : 0x3204,
                        )
                      )[0],
                    ).toBe(0x5a);
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
