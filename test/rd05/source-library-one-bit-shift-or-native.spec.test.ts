import { describe, expect, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

/** A scalar source expression and the precise delivery/value lifetime observed by this probe. */
interface Probe {
  readonly name: string;
  readonly operator: "<<" | ">>";
  readonly signed: boolean;
  readonly delivery: "global" | "poke" | "return";
  readonly mode: "fixed" | "dynamic" | "word" | "multiple" | "call" | "indexed";
}
const shifts = [
  { name: "unsigned left", operator: "<<", signed: false },
  { name: "unsigned right", operator: ">>", signed: false },
  { name: "signed right", operator: ">>", signed: true },
] as const;
const deliveries = ["global", "poke", "return"] as const;
const probes: readonly Probe[] = [
  ...shifts.flatMap((shift) =>
    deliveries.map(
      (delivery): Probe => ({
        ...shift,
        delivery,
        name: `${shift.name} ${delivery}`,
        mode: "fixed",
      }),
    ),
  ),
  ...(["dynamic", "word", "multiple", "call", "indexed"] as const).map(
    (mode): Probe => ({
      name: `${mode} behavior control`,
      operator: "<<",
      signed: false,
      delivery: "global",
      mode,
    }),
  ),
];

/** Keep direct forms ordinary, and explicitly retain the extra value/effect lifetime in controls. */
function source(probe: Probe): string {
  const wide = probe.mode === "word";
  const indexed = probe.mode === "indexed";
  const type = wide ? "word" : probe.signed ? "sbyte" : "byte";
  const count = probe.mode === "dynamic" ? "peek($3301)" : "1";
  const operation = `(value ${probe.operator} ${count}) | 1`;
  const expression = probe.signed ? `byte(${operation})` : operation;
  let body =
    probe.delivery === "return"
      ? `return ${expression};`
      : probe.delivery === "poke"
        ? `poke($3200, ${expression});`
        : `result = ${expression};`;
  if (probe.mode === "multiple")
    body = "let shifted: byte = value << 1; poke($3211, shifted); result = shifted | 1;";
  if (probe.mode === "call")
    body = "let shifted: byte = value << 1; interfere(); result = shifted | 1;";
  if (indexed) body = "result[peek($3301)] = (value << 1) | 1;";
  const argument = wide ? "peekw($3300)" : probe.signed ? "sbyte(peek($3300))" : "peek($3300)";
  return `module Game;
place(at: $3200) let result: ${wide ? "word" : indexed ? "byte[2]" : "byte"};
function transform(value: ${type}): ${probe.delivery === "return" ? "byte" : "void"} { ${body} }
function interfere(): void { poke($3210, $A1); }
function step(): void { poke(${wide || indexed ? "$3203" : "$3202"}, $5A); }
function observed(): void { poke(${wide || indexed ? "$3202" : "$3201"}, $A5); }
function main(): void {
    while (true) { step(); ${probe.delivery === "return" ? "result = " : ""}transform(${argument}); observed(); }
}`;
}

/** Model the typed shift mathematically, wrap its represented bits, then force only bit zero. */
function expected(probe: Probe, value: number, control: number): number {
  const width = probe.mode === "word" ? 16 : 8;
  const modulus = 2 ** width;
  const count = probe.mode === "dynamic" ? control : 1;
  const integer = probe.signed && value >= 128 ? value - 256 : value;
  const shifted =
    count >= width
      ? probe.signed && integer < 0
        ? -1
        : 0
      : probe.operator === "<<"
        ? integer * 2 ** count
        : Math.floor(integer / 2 ** count);
  const represented = ((shifted % modulus) + modulus) % modulus;
  return represented + (represented % 2 === 0 ? 1 : 0);
}

describe("ordinary one-bit shift then OR one native semantics", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const probe of probes) {
      it(`${profile}: ${probe.name} preserves represented values and ordered effects`, async () => {
        await withLibraryBuild(
          source(probe),
          "module Library;",
          profile,
          async (artifacts, built) => {
            expectLibraryAccounting(artifacts);
            await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
              const wide = probe.mode === "word";
              const indexed = probe.mode === "indexed";
              const step = libraryEntry(artifacts, "src/game.blend::Game.step");
              const observed = libraryEntry(artifacts, "src/game.blend::Game.observed");
              const marker = wide || indexed ? 0x3202 : 0x3201;
              const stepMarker = wide || indexed ? 0x3203 : 0x3202;
              await stopAt(step);
              const events = new Map<number, string>();
              for (const address of [0x3300, 0x3301]) {
                for (const operation of ["load", "store"] as const)
                  events.set(
                    await monitor.setAccessTracepoint(address, operation),
                    `${operation}:$${address.toString(16)}`,
                  );
              }
              for (const address of [0x3200, 0x3201, 0x3202, 0x3203, 0x3210, 0x3211])
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
                      : indexed
                        ? value % 2
                        : 0x69;
                  const input = wide ? [value & 0xff, value >> 8] : [value, control];
                  await monitor.writeMemory(0x3300, new Uint8Array(input));
                  await monitor.writeMemory(0x3200, new Uint8Array(4).fill(0x5a));
                  await monitor.writeMemory(0x3210, new Uint8Array([0, 0]));
                  const before = await monitor.readCpuRegisters();
                  trace();
                  await stopAt(observed);
                  const after = await monitor.readCpuRegisters();
                  const address = indexed ? 0x3200 + control : 0x3200;
                  const result = await monitor.readMemory(address, wide ? address + 1 : address);
                  const actual = wide ? result[0]! | (result[1]! << 8) : result[0]!;
                  expect(actual, `${probe.name}, input ${value}, control ${control}`).toBe(
                    expected(probe, value, control),
                  );
                  expect(trace()).toEqual([
                    `store:$${stepMarker.toString(16)}`,
                    "load:$3300",
                    ...(wide || probe.mode === "dynamic" || indexed ? ["load:$3301"] : []),
                    ...(probe.mode === "call" ? ["store:$3210"] : []),
                    ...(probe.mode === "multiple" ? ["store:$3211"] : []),
                    `store:$${address.toString(16)}`,
                    ...(wide ? ["store:$3201"] : []),
                  ]);
                  expect([...(await monitor.readMemory(0x3300, 0x3301))]).toEqual(input);
                  if (probe.mode === "call")
                    expect((await monitor.readMemory(0x3210, 0x3210))[0]).toBe(0xa1);
                  if (probe.mode === "multiple")
                    expect((await monitor.readMemory(0x3211, 0x3211))[0]).toBe((value * 2) % 256);
                  if (indexed) {
                    const untouched = 0x3200 + (1 - control);
                    expect((await monitor.readMemory(untouched, untouched))[0]).toBe(0x5a);
                  }
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
