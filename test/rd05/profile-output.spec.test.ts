import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecord, profileRecords } from "./profile-fixture.js";

const profiles = [
  ["c64-pal-prg-kernal-6581", true, 6581],
  ["c64-pal-prg-kernal-8580", true, 8580],
  ["c64-ntsc-prg-kernal-6581", false, 6581],
  ["c64-ntsc-prg-kernal-8580", false, 8580],
] as const;

/** Keep every instruction in order so clobbers cannot be hidden from value observations. */
function instructions(assembly: string) {
  return assembly.split(/\r?\n/u).flatMap((line) => {
    const match = /^\s*([a-z]{3})\s*(.*?)\s*$/iu.exec(line.split(";")[0]!);
    return match
      ? [
          {
            opcode: match[1]!.toLowerCase(),
            operand: match[2]!.replace(/^\+[12]\s+/u, "").toLowerCase(),
          },
        ]
      : [];
  });
}

/** Decode only literal assembler integers; symbolic or computed operands are not constants here. */
function integer(text: string): number {
  if (/^\$[0-9a-f]+$/iu.test(text)) return Number.parseInt(text.slice(1), 16);
  if (/^\d+$/u.test(text)) return Number(text);
  throw new Error(`Expected a literal integer operand: ${text}`);
}

/** The independent effect oracle specifies each immediate value and volatile store count in order. */
function expectMarkerEffects(assembly: string, values: readonly number[]) {
  const code = instructions(assembly);
  const stores: number[] = [];
  let accumulator: number | undefined;
  for (const { opcode, operand } of code) {
    if (opcode === "lda" && operand.startsWith("#")) accumulator = integer(operand.slice(1));
    else if (
      /^(?:lda|adc|sbc|and|ora|eor|asl|lsr|rol|ror|pla|txa|tya|b..|jmp|jsr|rts|rti)$/u.test(opcode)
    )
      accumulator = undefined;
    if (opcode === "sta" && /^\$0*420$/u.test(operand)) {
      expect(accumulator, "marker store must have a proven immediate value").toBeDefined();
      stores.push(accumulator!);
    }
  }
  expect(stores).toEqual(values);
  expect(code.filter(({ operand }) => /^\$0*421$/u.test(operand))).toEqual([]);
}

/** Resolve published labels and observe literal register stores without requiring a register choice. */
function expectFixedStores(
  artifacts: Awaited<ReturnType<typeof buildProfileSource>>,
  expected: readonly (readonly [number, number])[],
) {
  const labels = new Map(
    [...artifacts.labels.matchAll(/^\s*(\w+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
      match[1]!.toLowerCase(),
      Number.parseInt(match[2]!, 16),
    ]),
  );
  const registers = new Map<string, number | undefined>();
  const stores: [number, number | undefined][] = [];
  for (const { opcode, operand } of instructions(artifacts.assembly)) {
    if (/^ld[axy]$/u.test(opcode))
      registers.set(opcode[2]!, operand.startsWith("#") ? integer(operand.slice(1)) : undefined);
    else if (/^t[axy][axy]$/u.test(opcode)) registers.set(opcode[2]!, registers.get(opcode[1]!));
    else if (/^(?:adc|sbc|and|ora|eor|asl|lsr|rol|ror|pla)$/u.test(opcode))
      registers.set("a", undefined);
    else if (/^(?:inx|dex|tsx)$/u.test(opcode)) registers.set("x", undefined);
    else if (/^(?:iny|dey)$/u.test(opcode)) registers.set("y", undefined);
    else if (/^(?:b..|jmp|jsr|rts|rti)$/u.test(opcode)) registers.clear();
    if (!/^st[axy]$/u.test(opcode)) continue;
    const parts = operand.split(/\s*\+\s*/u);
    const base = parts[0]!;
    const address = base.startsWith("$") ? integer(base) : labels.get(base);
    if (address === undefined) continue;
    const resolved = address + (parts[1] === undefined ? 0 : integer(parts[1]));
    if (expected.some(([target]) => target === resolved))
      stores.push([resolved, registers.get(opcode[2]!)]);
  }
  expect(stores).toEqual(expected);
}

/** Build a single main and a deliberately distinguishable helper reachable only from dead paths. */
function source(body: string): string {
  return `module Game;
function deadHelper(): void { let deadLocal: word = peekw($0400); pokew($0421, deadLocal); }
function main(): void { ${body} }`;
}

/** Profile selection contributes neither runtime dispatch nor function storage beyond literal code. */
function expectNoSelectionCost(
  actual: Awaited<ReturnType<typeof buildProfileSource>>,
  literal: Awaited<ReturnType<typeof buildProfileSource>>,
) {
  // These selected bodies have no calls or tests; the cooperative return jump remains legal.
  expect(
    instructions(actual.assembly).filter(({ opcode }) =>
      /^(?:cmp|cpx|cpy|bcc|bcs|beq|bmi|bne|bpl|bvc|bvs|jsr)$/u.test(opcode),
    ),
  ).toEqual([]);
  expect(actual.prg).toEqual(literal.prg);
  expect(profileRecord(actual.costs.totals)).toEqual(profileRecord(literal.costs.totals));
  const allocation = (value: unknown) =>
    profileRecords(value).map(
      ({ kind, start, end, size, payloadBytes, paddingBytes, reservedBytes }) => ({
        kind,
        start,
        end,
        size,
        payloadBytes,
        paddingBytes,
        reservedBytes,
      }),
    );
  expect(allocation(actual.memory.intervals)).toEqual(allocation(literal.memory.intervals));
  expect(actual.memory.stackDomains).toEqual(literal.memory.stackDomains);
  expect(profileRecords(actual.debug.functions).map(({ qualifiedName }) => qualifiedName)).toEqual([
    "src/game.blend::Game.main",
  ]);
  const dispatch = (assembly: string) =>
    instructions(assembly)
      .filter(({ opcode }) => /^(?:b..|jmp|jsr)$/u.test(opcode))
      .map(({ opcode }) => opcode);
  expect(dispatch(actual.assembly)).toEqual(dispatch(literal.assembly));
  expect(JSON.stringify(actual.memory.intervals)).not.toMatch(/c64\.profile|deadHelper|deadLocal/u);
}

describe.each(profiles)("mandatory profile selection on %s", (target, pal, sid) => {
  const marker = pal ? 6 : 2;
  const cases = [
    ["if", "if (c64.profile.isPal) { poke($0420, 6); } else { poke($0420, 2); }", [marker]],
    ["conditional", "poke($0420, c64.profile.isPal ? byte(6) : byte(2));", [marker]],
    [
      "switch match",
      "switch (c64.profile.rasterLines) { case 312: poke($0420, 6); case 263: poke($0420, 2); default: deadHelper(); }",
      [marker],
    ],
    [
      "switch default",
      "switch (c64.profile.rasterLines) { case 1: deadHelper(); default: poke($0420, 7); }",
      [7],
    ],
    [
      "switch fallthrough",
      "switch (c64.profile.rasterLines) { case 312: poke($0420, 6); fallthrough; case 263: poke($0420, 2); default: deadHelper(); }",
      pal ? [6, 2] : [2],
    ],
    [
      "false while",
      "while (c64.profile.hasRawInterrupts) { deadHelper(); poke($0421, 99); } poke($0420, 7);",
      [7],
    ],
    [
      "false for",
      "for (; c64.profile.hasRawInterrupts; ) { deadHelper(); poke($0421, 99); } poke($0420, 7);",
      [7],
    ],
  ] as const;

  // The source language selects these exact effects even when optional optimization is disabled.
  it.each(cases)(
    "should retain only the selected effects for %s",
    async (_name, body, values) => {
      const actual = await buildProfileSource(source(body), target);
      expectMarkerEffects(actual.assembly, values);
      const literal = await buildProfileSource(
        source(values.map((value) => `poke($0420, ${value});`).join(" ")),
        target,
      );
      expectNoSelectionCost(actual, literal);
    },
    60_000,
  );

  // Knowing the selector's result does not erase the ordinary assignment which computes it.
  it("should preserve an effectful known switch selector exactly once", async () => {
    const declaration = "module Game; place(at: $3000) let selected: word;";
    const literal = await buildProfileSource(
      `${declaration}
function main(): void { selected = ${pal ? 312 : 263}; poke($0420, ${marker}); }`,
      target,
    );
    const stores = [
      [0x3000, pal ? 56 : 7],
      [0x3001, 1],
    ] as const;
    expectFixedStores(literal, stores);
    const actual = await buildProfileSource(
      `${declaration}
function main(): void {
 switch (selected = c64.profile.rasterLines) {
  case 312: poke($0420, 6);
  case 263: poke($0420, 2);
  default: poke($0421, 99);
 }
}`,
      target,
    );
    expectMarkerEffects(actual.assembly, [marker]);
    expectFixedStores(actual, stores);
    expectNoSelectionCost(actual, literal);
  }, 60_000);

  // A false pretest suppresses the loop body and update, but its initializer still runs once.
  it("should preserve the initializer of a known false for loop", async () => {
    const declaration = "module Game; place(at: $3000) let initialized: byte;";
    const literal = await buildProfileSource(
      `${declaration}
function main(): void { initialized = 9; poke($0420, 7); }`,
      target,
    );
    expectFixedStores(literal, [[0x3000, 9]]);
    const actual = await buildProfileSource(
      `${declaration}
function deadHelper(): void { poke($0421, 99); }
function main(): void {
 for (initialized = 9; c64.profile.hasRawInterrupts; initialized += 1) { deadHelper(); }
 poke($0420, 7);
}`,
      target,
    );
    expectMarkerEffects(actual.assembly, [7]);
    expectFixedStores(actual, [[0x3000, 9]]);
    expectNoSelectionCost(actual, literal);
  }, 60_000);

  // Independently spelled values exercise every fact; equivalent literal input is supporting evidence.
  it("should expose all fourteen facts with zero emitted storage or selection cost", async () => {
    const facts = {
      isPal: pal,
      isNtsc: !pal,
      frameRateWhole: pal ? 50 : 59,
      frameRateFractionNumerator: pal ? 34 : 2825,
      frameRateFractionDenominator: pal ? 273 : 3419,
      rasterLines: pal ? 312 : 263,
      cyclesPerLine: pal ? 63 : 65,
      cyclesPerFrame: pal ? 19656 : 17095,
      cpuClockKilohertz: pal ? 985 : 1022,
      cpuClockHzRemainder: pal ? 248 : 730,
      sidModel: sid,
      sidAddress: 0xd400,
      usesKernal: true,
      hasRawInterrupts: false,
    };
    const body = Object.entries(facts)
      .map(
        ([name, value]) =>
          `if (c64.profile.${name} == ${value}) { poke($0420, 7); } else { deadHelper(); }`,
      )
      .join("\n");
    const actual = await buildProfileSource(source(body), target);
    expectMarkerEffects(actual.assembly, Array<number>(14).fill(7));
    let literalSource = source(body);
    for (const [name, value] of Object.entries(facts))
      literalSource = literalSource.replaceAll(`c64.profile.${name}`, String(value));
    const literal = await buildProfileSource(literalSource, target);
    expectNoSelectionCost(actual, literal);
    const selected = await buildProfileSource(source("poke($0420, 7);".repeat(14)), target);
    expectNoSelectionCost(actual, selected);
  }, 60_000);
});
