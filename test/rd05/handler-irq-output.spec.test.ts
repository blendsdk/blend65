import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** Check the source and inspect only the generation returned by its successful build. */
async function build(source: string, target: string): Promise<Artifacts> {
  return withProfileProject(source, target, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    if (checked.kind !== "success") throw new Error("Expected a valid IRQ source program");
    expect(checked.profileId).toBe(target);
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected a complete IRQ build");
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory.profileId).toBe(target);
    expect(artifacts.memory.acmeReconciled).toBe(true);
    return artifacts;
  });
}

/** Read selected machine labels without assuming a compiler-private spelling scheme. */
function labels(artifacts: Artifacts): Map<string, number> {
  return new Map(
    [...artifacts.labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
      match[1]!,
      Number.parseInt(match[2]!, 16),
    ]),
  );
}

/** Resolve a source function through its published selected entry variants. */
function entries(artifacts: Artifacts, name: string): { label: string; address: number }[] {
  const functions = profileRecords(artifacts.debug.functions).filter(
    (fn) => fn.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(functions, name).toHaveLength(1);
  const published = labels(artifacts);
  return profileRecords(functions[0]!.entryVariants).map((variant) => {
    if (typeof variant.label !== "string") throw new TypeError(`Missing ${name} entry label`);
    const address = published.get(variant.label);
    expect(address, variant.label).toBeDefined();
    if (address === undefined) throw new Error(`Unresolved ${name} entry label`);
    expect(address).toBeGreaterThanOrEqual(artifacts.prg.readUInt16LE(0));
    expect(address).toBeLessThan(artifacts.prg.readUInt16LE(0) + artifacts.prg.length - 2);
    return { label: variant.label, address };
  });
}

/** The load word is not part of the assembled instruction stream. */
function bytesAt(artifacts: Artifacts, address: number, count: number): number[] {
  const offset = 2 + address - artifacts.prg.readUInt16LE(0);
  return [...artifacts.prg.subarray(offset, offset + count)];
}

/** Preserve operation order while ignoring labels and assembler annotations. */
function instructions(assembly: string): { opcode: string; operand: string }[] {
  return assembly.split(/\r?\n/u).flatMap((line) => {
    const match = /^\s*([a-z]{3})\b\s*(.*?)\s*$/iu.exec(line.split(";")[0]!);
    return match ? [{ opcode: match[1]!.toLowerCase(), operand: match[2]!.toLowerCase() }] : [];
  });
}

/** Read the body of one published entry until its declared firmware tail. */
function entryInstructions(
  artifacts: Artifacts,
  label: string,
  terminal: "irq" | "ordinary" = "irq",
) {
  const lines = artifacts.assembly.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.trim() === `${label}:`);
  expect(start, `Missing assembly for ${label}`).toBeGreaterThanOrEqual(0);
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    body.push(line);
    if (terminal === "ordinary" && /^\s*rts\s*(?:;.*)?$/iu.test(line)) break;
    if (terminal === "irq" && /^\s*jmp\s+(?:\([^)]*\)|\$ea81)\s*(?:;.*)?$/iu.test(line)) break;
  }
  return instructions(body.join("\n"));
}

/** Derive NMOS instruction costs from the actual addressing mode, not compiler cost claims. */
function instructionCost(opcode: string, operand: string) {
  const implied = new Map([
    ["php", [1, 3]],
    ["pha", [1, 3]],
    ["sei", [1, 2]],
    ["pla", [1, 4]],
    ["plp", [1, 4]],
    ["cld", [1, 2]],
    ["nop", [1, 2]],
  ]);
  const fixed = implied.get(opcode);
  if (fixed !== undefined) return { bytes: fixed[0]!, cycles: fixed[1]! };
  if (/^ld[axy]$/u.test(opcode)) {
    if (operand.startsWith("#")) return { bytes: 2, cycles: 2 };
    if (/^\$[0-9a-f]{1,2}$/u.test(operand)) return { bytes: 2, cycles: 3 };
    return { bytes: 3, cycles: 4 };
  }
  if (/^st[axy]$/u.test(opcode)) {
    if (/^\$[0-9a-f]{1,2}$/u.test(operand)) return { bytes: 2, cycles: 3 };
    return { bytes: 3, cycles: 4 };
  }
  if (opcode === "jmp") return { bytes: 3, cycles: operand.startsWith("(") ? 5 : 3 };
  throw new Error(`Unaccounted vector-transaction instruction: ${opcode} ${operand}`);
}

/** NOP delimiters expose the two transactions without adding observable state. */
function transactions(artifacts: Artifacts, label: string, terminal: "irq" | "ordinary" = "irq") {
  const body = entryInstructions(artifacts, label, terminal);
  const markers = body.flatMap(({ opcode }, index) => (opcode === "nop" ? [index] : []));
  expect(markers).toHaveLength(terminal === "irq" ? 5 : 3);
  return [body.slice(markers[0]! + 1, markers[1]), body.slice(markers.at(-2)! + 1, markers.at(-1))];
}

/** Recompute emitted bytes and NMOS cycles from the decoded transaction instructions. */
function measuredCost(code: ReturnType<typeof instructions>) {
  return code.reduce(
    (total, { opcode, operand }) => {
      const cost = instructionCost(opcode, operand);
      return { bytes: total.bytes + cost.bytes, cycles: total.cycles + cost.cycles };
    },
    { bytes: 0, cycles: 0 },
  );
}

const selectedSource = `module Game;
import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;
let answer: byte = 0;
function plusOne(value: byte): byte { return value + 1; }
function plusTwo(value: byte): byte { return value + 2; }
function evaluate(value: byte): byte {
  let action: fn(byte): byte = peek($0401) == 0 ? &plusOne : &plusTwo;
  if (word(action) == word(&plusOne)) { poke($0420, 11); }
  else { poke($0420, 12); }
  return action(value);
}
interrupt function B(): void { answer = evaluate(17); }
interrupt function C(): void { answer = evaluate(33); }
interrupt function A(): void {
  if (peek($0400) == 0) { setIRQExclusive(&B); }
  else { setIRQExclusive(&C); }
  asm_cli(); asm_nop(); asm_sei();
  restoreIRQ();
}
function main(): void { setIRQ(&A); asm_cli(); asm_nop(); asm_sei(); restoreIRQ(); }`;

const costSource = `module Game;
import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;
interrupt function B(): void {}
interrupt function A(): void {
  asm_nop(); setIRQExclusive(&B); asm_nop();
  asm_cli(); asm_nop(); asm_sei(); asm_nop();
  restoreIRQ(); asm_nop();
}
function main(): void { setIRQ(&A); asm_cli(); asm_nop(); asm_sei(); restoreIRQ(); }`;

describe.each(profiles)("handler-selected IRQ output on %s", (target) => {
  // The selected sink reaches both branch targets, while each handler remains callback-only.
  it("emits distinct selected entries and ordinary calls for both source choices", async () => {
    const artifacts = await build(selectedSource, target);
    const a = entries(artifacts, "A");
    const b = entries(artifacts, "B");
    const c = entries(artifacts, "C");
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(c).toHaveLength(1);
    expect(new Set([a[0]!.address, b[0]!.address, c[0]!.address]).size).toBe(3);
    const code = instructions(artifacts.assembly);
    const handlerLabels = new Set(
      [a[0]!.label, b[0]!.label, c[0]!.label].map((v) => v.toLowerCase()),
    );
    expect(
      code.filter(({ opcode, operand }) => opcode === "jsr" && handlerLabels.has(operand)),
    ).toEqual([]);
    expect(code.some(({ opcode }) => opcode === "jsr")).toBe(true);
    expect(entries(artifacts, "evaluate").length).toBeGreaterThan(0);
    expect(entries(artifacts, "plusOne").length).toBeGreaterThan(0);
    expect(entries(artifacts, "plusTwo").length).toBeGreaterThan(0);
    const equalityStores = code.filter(
      ({ opcode, operand }) => /^st[axy]$/u.test(opcode) && /^\$0*420$/u.test(operand),
    );
    expect(equalityStores.length).toBeGreaterThanOrEqual(2);
    expect(code.some(({ opcode }) => /^(?:cmp|cpx|cpy)$/u.test(opcode))).toBe(true);
    expect(code.some(({ opcode, operand }) => opcode === "jmp" && operand === "$ea81")).toBe(true);
    expect(code.some(({ opcode, operand }) => opcode === "jmp" && /^\(.+\)$/u.test(operand))).toBe(
      true,
    );
  }, 60_000);

  // A chain entry preserves its incoming P; the exclusive entry uses the KERNAL restore tail.
  it("keeps the chain and exclusive wrapper costs at their hand-derived bounds", async () => {
    const artifacts = await build(costSource, target);
    const a = entries(artifacts, "A");
    const b = entries(artifacts, "B");
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(bytesAt(artifacts, a[0]!.address, 2)).toEqual([0x08, 0xd8]);
    expect(bytesAt(artifacts, b[0]!.address, 4)).toEqual([0xd8, 0x4c, 0x81, 0xea]);
    const chain = entryInstructions(artifacts, a[0]!.label);
    expect(chain.slice(0, 3).map(({ opcode }) => opcode)).toEqual(["php", "cld", "nop"]);
    expect(chain.slice(-3).map(({ opcode }) => opcode)).toEqual(["nop", "plp", "jmp"]);
    expect(chain.at(-1)?.operand).toMatch(/^\(.+\)$/u);
    expect(measuredCost([...chain.slice(0, 2), ...chain.slice(-2)])).toEqual({
      bytes: 6,
      cycles: 14,
    });
    const exclusive = entryInstructions(artifacts, b[0]!.label);
    expect(exclusive.map(({ opcode }) => opcode)).toEqual(["cld", "jmp"]);
    expect(exclusive.at(-1)?.operand).toBe("$ea81");
    expect(measuredCost(exclusive)).toEqual({ bytes: 4, cycles: 5 });
    const code = instructions(artifacts.assembly);
    const chainTails = code.filter(
      ({ opcode, operand }, index) =>
        opcode === "jmp" && /^\(.+\)$/u.test(operand) && code[index - 1]?.opcode === "plp",
    );
    expect(chainTails.length).toBeGreaterThanOrEqual(1);
    expect(code.some(({ opcode, operand }) => opcode === "jmp" && operand === "$ea81")).toBe(true);
    expect(code.some(({ opcode }) => opcode === "rti")).toBe(false);
    const [install, restore] = transactions(artifacts, a[0]!.label);
    expect(install.length).toBeGreaterThan(0);
    expect(restore.length).toBeGreaterThan(0);
    expect(measuredCost(install).bytes).toBeLessThanOrEqual(27);
    expect(measuredCost(install).cycles).toBeLessThanOrEqual(44);
    expect(measuredCost(restore).bytes).toBeLessThanOrEqual(17);
    expect(measuredCost(restore).cycles).toBeLessThanOrEqual(32);
    for (const transaction of [install, restore]) {
      const vectorWrites = transaction.filter(
        ({ opcode, operand }) => /^st[axy]$/u.test(opcode) && /^\$0*31[45]$/u.test(operand),
      );
      expect(vectorWrites.map(({ operand }) => Number.parseInt(operand.slice(1), 16))).toEqual([
        0x0314, 0x0315,
      ]);
    }
    const vectorReads = install.filter(
      ({ opcode, operand }) => /^ld[axy]$/u.test(opcode) && /^\$0*31[45]$/u.test(operand),
    );
    expect(vectorReads.map(({ operand }) => Number.parseInt(operand.slice(1), 16))).toEqual([
      0x0314, 0x0315,
    ]);
    const totals = profileRecord(artifacts.costs.totals);
    expect(totals.programBytes).toBe(artifacts.prg.length - 2);
    const costEntries = profileRecords(artifacts.costs.entries);
    expect(
      costEntries
        .filter(({ kind, accounting }) => kind === "bytes" && accounting === "program")
        .reduce((sum, { bytes }) => sum + Number(bytes), 0),
    ).toBe(artifacts.prg.length - 2);
    const resources = profileRecords(totals.resources);
    expect(resources.length).toBeGreaterThan(0);
    for (const resource of resources) expect(resource.value).toBeTypeOf("number");
    const stack = profileRecords(artifacts.memory.stackDomains);
    expect(stack.length).toBeGreaterThan(0);
    for (const domain of stack) expect(domain.peakBytes).toBeTypeOf("number");
    expect(profileRecords(totals.pathCycles).length).toBeGreaterThan(0);
  }, 60_000);
});

describe("unchanged cooperative output", () => {
  // An ordinary mainline install retains the same direct chain ABI.
  it("keeps a mainline-only IRQ chain and its published cost records", async () => {
    const artifacts = await build(
      `module Game;
import { setIRQ, restoreIRQ } from c64.system;
interrupt function A(): void {}
function main(): void {
  asm_nop(); setIRQ(&A); asm_nop(); restoreIRQ(); asm_nop();
}`,
      profiles[0],
    );
    const a = entries(artifacts, "A");
    expect(a).toHaveLength(1);
    expect(bytesAt(artifacts, a[0]!.address, 2)).toEqual([0x08, 0xd8]);
    const body = entryInstructions(artifacts, a[0]!.label);
    expect(body.slice(-2).map(({ opcode }) => opcode)).toEqual(["plp", "jmp"]);
    expect(body.at(-1)?.operand).toMatch(/^\(.+\)$/u);
    const main = entries(artifacts, "main");
    expect(main).toHaveLength(1);
    const [install, restore] = transactions(artifacts, main[0]!.label, "ordinary");
    expect(measuredCost(install).bytes).toBeLessThanOrEqual(27);
    expect(measuredCost(install).cycles).toBeLessThanOrEqual(44);
    expect(measuredCost(restore).bytes).toBeLessThanOrEqual(17);
    expect(measuredCost(restore).cycles).toBeLessThanOrEqual(32);
    expect(profileRecord(artifacts.costs.totals).programBytes).toBe(artifacts.prg.length - 2);
  }, 60_000);

  // A program without interrupt sinks has no handler entry or vector transaction.
  it("keeps a no-interrupt program free of IRQ runtime work", async () => {
    const artifacts = await build("module Game; function main(): void {}", profiles[0]);
    expect(
      profileRecords(artifacts.debug.functions).map(({ qualifiedName }) => qualifiedName),
    ).toEqual(["src/game.blend::Game.main"]);
    const code = instructions(artifacts.assembly);
    expect(
      code.some(
        ({ opcode, operand }) => /^st[axy]$/u.test(opcode) && /^\$0*31[45]$/u.test(operand),
      ),
    ).toBe(false);
    expect(code.some(({ opcode, operand }) => opcode === "jmp" && operand === "$ea81")).toBe(false);
    expect(profileRecord(artifacts.costs.totals).programBytes).toBe(artifacts.prg.length - 2);
  }, 60_000);
});
