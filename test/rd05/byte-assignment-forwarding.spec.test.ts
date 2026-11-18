import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecord, profileRecords } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];

/** Ignore mirrored device projections: only CPU-addressable code is executable. */
function codeRegions(memory: Record<string, unknown>) {
  const regions = profileRecords(memory.intervals).filter(
    (entry) => entry.addressSpaceId === "cpu16" && entry.kind === "code",
  );
  expect(regions.length).toBeGreaterThan(0);
  return regions.map((entry) => {
    const { start, end, size } = entry;
    if (typeof start !== "number" || typeof end !== "number" || typeof size !== "number") {
      throw new Error("Code interval requires numeric bounds and size");
    }
    expect(end - start).toBe(size);
    expect(size).toBeGreaterThan(0);
    return { start, end };
  });
}

/** Extract instruction spellings, not labels or assembler data directives. */
function instructions(assembly: string) {
  return assembly.split(/\r?\n/).flatMap((line) => {
    const statement = line.replace(/^\s*[A-Za-z_][\w.]*:\s*/, "");
    const match =
      /^\s*(adc|and|asl|bcc|bcs|beq|bit|bmi|bne|bpl|brk|bvc|bvs|clc|cld|cli|clv|cmp|cpx|cpy|dec|dex|dey|eor|inc|inx|iny|jmp|jsr|lda|ldx|ldy|lsr|nop|ora|pha|php|pla|plp|rol|ror|rti|rts|sbc|sec|sed|sei|sta|stx|sty|tax|tay|tsx|txa|txs|tya)\b\s*([^;]*)/i.exec(
        statement,
      );
    return match
      ? [{ opcode: match[1]!.toLowerCase(), operand: match[2]!.trim().toLowerCase() }]
      : [];
  });
}

/** Read an actual CPU byte, failing if code lies outside the delivered PRG. */
function byteAt(prg: Buffer, address: number): number {
  const offset = address - prg.readUInt16LE(0) + 2;
  if (offset < 2 || offset >= prg.length) throw new Error("Code address is outside PRG");
  return prg[offset]!;
}

describe("public byte assignment emission", () => {
  for (const profile of profiles) {
    for (const operator of ["+", "-"]) {
      for (const runtime of [false, true]) {
        it(`should emit a direct named store when ${operator} uses ${runtime ? "runtime" : "constant"} RHS on ${profile}`, async () => {
          const built = await buildProfileSource(
            `module Game;
function main(): void {
  let value: byte = $A5;
  let step: byte = 37;
  while (true) {
    value = value ${operator} ${runtime ? "step" : "37"};
    poke($D005, value);
    ${runtime ? "step += 1;" : ""}
  }
}`,
            profile,
            "none",
          );
          const listing = instructions(built.assembly);
          const deviceStores = listing.flatMap((instruction, index) =>
            instruction.opcode === "sta" && /^(?:\$0*d005|53253)$/.test(instruction.operand)
              ? [index]
              : [],
          );
          expect(deviceStores).toHaveLength(1);
          const device = deviceStores[0]!;
          const namedLoad = listing[device - 1]!;
          const namedStore = listing[device - 2]!;
          expect(namedLoad.opcode).toBe("lda");
          expect(namedStore).toEqual({ opcode: "sta", operand: namedLoad.operand });
          expect(listing[device - 3]!.opcode).toBe(operator === "+" ? "adc" : "sbc");
          expect(listing[device - 4]!.opcode).toBe(operator === "+" ? "clc" : "sec");
          expect(listing[device - 5]!.opcode).toBe("lda");
          expect(
            listing.filter(
              (instruction) =>
                ["inc", "dec", "asl", "lsr", "rol", "ror"].includes(instruction.opcode) &&
                instruction.operand === namedLoad.operand,
            ),
          ).toEqual([]);

          const writes: number[] = [];
          for (const region of codeRegions(built.memory)) {
            for (let pc = region.start; pc + 2 < region.end; pc += 1) {
              if (
                byteAt(built.prg, pc) === 0x8d &&
                byteAt(built.prg, pc + 1) === 0x05 &&
                byteAt(built.prg, pc + 2) === 0xd0
              )
                writes.push(pc);
            }
          }
          expect(writes).toHaveLength(1);
          const pc = writes[0]!;
          expect(byteAt(built.prg, pc - 3)).toBe(0xad);
          expect(byteAt(built.prg, pc - 6)).toBe(0x8d);
          const namedAddress = byteAt(built.prg, pc - 2) | (byteAt(built.prg, pc - 1) << 8);
          expect(byteAt(built.prg, pc - 5) | (byteAt(built.prg, pc - 4) << 8)).toBe(namedAddress);
          const frames = profileRecords(built.memory.intervals).filter(
            (entry) =>
              entry.addressSpaceId === "cpu16" &&
              entry.kind === "sfa" &&
              typeof entry.start === "number" &&
              typeof entry.end === "number" &&
              entry.start <= namedAddress &&
              namedAddress < entry.end,
          );
          expect(frames).toHaveLength(1);
          const arithmetic = pc - 6;
          const carry = operator === "+" ? 0x18 : 0x38;
          const immediate =
            byteAt(built.prg, arithmetic - 3) === carry &&
            byteAt(built.prg, arithmetic - 2) === (operator === "+" ? 0x69 : 0xe9);
          const absolute =
            byteAt(built.prg, arithmetic - 4) === carry &&
            byteAt(built.prg, arithmetic - 3) === (operator === "+" ? 0x6d : 0xed);
          expect(Number(immediate) + Number(absolute)).toBe(1);
          const arithmeticStart = arithmetic - (immediate ? 2 : 3);
          expect(byteAt(built.prg, arithmeticStart - 1)).toBe(operator === "+" ? 0x18 : 0x38);
          expect(byteAt(built.prg, arithmeticStart - 4)).toBe(0xad);
          const totals = profileRecord(built.costs.totals);
          expect(typeof totals.programBytes).toBe("number");
          expect(built.prg.length - 2).toBe(totals.programBytes);
        }, 300_000);
      }
    }
  }

  const legalFallbacks = [
    "value = value ^ step;",
    "value = lo(wide);",
    "value = byte(wide + 1);",
    "poke($D005, value - 37);",
    "poke($D005, value + step);",
  ];
  for (const statement of legalFallbacks) {
    it(`should build normally when forwarding does not apply to ${statement}`, async () => {
      const built = await buildProfileSource(
        `module Game;
function main(): void {
  let value: byte = 165;
  let step: byte = 37;
  let wide: word = 4660;
  while (true) { ${statement} poke($D007, value); }
}`,
        profiles[0]!,
        "none",
      );
      expect(codeRegions(built.memory).length).toBeGreaterThan(0);
      expect(built.prg.length).toBeGreaterThan(2);
    }, 300_000);
  }

  const observedMain = `function main(): void {
  let value: byte = 165;
  let step: byte = 37;
  while (true) {
    value = value + step;
    poke($D005, value);
  }
}`;
  const observedPrograms = [
    {
      name: "module storage",
      source: `module Game;\nlet value: byte = 165;\n${observedMain.replace("  let value: byte = 165;\n", "")}`,
    },
    {
      name: "runtime initializer",
      source: `module Game;\nlet seed: byte = peek($D012);\n${observedMain}`,
    },
    {
      name: "source interrupt",
      source: `module Game;
import { setIRQ } from c64.system;
interrupt function observe(): void { poke($D020, 1); }
${observedMain.replace("  while (true)", "  setIRQ(&observe);\n  while (true)")}`,
    },
    {
      name: "ordinary helper",
      source: `module Game;
function sample(): byte { return peek($D012); }
${observedMain.replace("poke($D005, value);", "poke($D005, value); poke($D007, sample());")}`,
    },
    {
      name: "escaped local",
      source: `module Game;\n${observedMain
        .replace("  while (true)", "  let address: word = word(&value);\n  while (true)")
        .replace("poke($D005, value);", "poke($D005, value); poke($D007, peek(address));")}`,
    },
    ...[
      ["private raw read", "poke($D007, peek($2455));"],
      ["CIA routing", "poke($DD00, 0);"],
      ["firmware memory", "poke($00D1, 0);"],
    ].map(([name, statement]) => ({
      name,
      source: `module Game;\n${observedMain.replace("poke($D005, value);", `poke($D005, value); ${statement}`)}`,
    })),
    {
      name: "unknown raw address",
      source: `module Game;\n${observedMain
        .replace("  while (true)", "  let address: word = word(peek($D012));\n  while (true)")
        .replace("poke($D005, value);", "poke($D005, value); poke($D007, peek(address));")}`,
    },
  ];
  for (const program of observedPrograms) {
    it(`should preserve normal source acceptance when ${program.name} prevents forwarding`, async () => {
      const built = await buildProfileSource(program.source, profiles[0]!, "none");
      expect(codeRegions(built.memory).length).toBeGreaterThan(0);
      expect(built.prg.length).toBeGreaterThan(2);
    }, 300_000);
  }
});
