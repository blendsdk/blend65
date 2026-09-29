import { buildProject } from "@blend65/compiler";
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
type Instruction = { opcode: string; operand: string };

/** Compile a real selected-profile program and inspect its published artifacts. */
async function build(source: string, target = profiles[0]): Promise<Artifacts> {
  return withProfileProject(source, target, async (project) => {
    const result = await buildProject({ project, optimization: "none" });
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    if (result.kind !== "success") throw new Error("Expected a complete CIA build");
    const artifacts = await readProfileArtifacts(result);
    expect(artifacts.memory.profileId).toBe(target);
    expect(artifacts.memory.acmeReconciled).toBe(true);
    return artifacts;
  });
}

/** Ignore labels and comments while retaining the assembler's selected instruction order. */
function instructions(assembly: string): Instruction[] {
  return assembly.split(/\r?\n/u).flatMap((line) => {
    const match = /^\s*([a-z]{3})\b\s*(.*?)\s*$/iu.exec(line.split(";")[0]!);
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

/** Restrict effect checks to the selected CIA registers, not unrelated KERNAL setup. */
function ciaAccesses(code: readonly Instruction[]): Instruction[] {
  return code.filter(({ operand }) => /^\$0*d[cd]0[4-7def]$/u.test(operand));
}

/** Find an exact expert fragment in the emitted instruction stream. */
function expectFragment(
  code: readonly Instruction[],
  expected: readonly Instruction[],
): Instruction[] {
  const start = code.findIndex((_, index) =>
    expected.every(
      (instruction, offset) =>
        code[index + offset]?.opcode === instruction.opcode &&
        code[index + offset]?.operand === instruction.operand,
    ),
  );
  expect(start, JSON.stringify(expected)).toBeGreaterThanOrEqual(0);
  return code.slice(start, start + expected.length);
}

/** Recount only the addressed NMOS instructions in the published expert fragments. */
function fragmentCost(code: readonly Instruction[]) {
  return code.reduce(
    (total, { operand }) => {
      const immediate = operand.startsWith("#");
      const bytes = immediate ? 2 : 3;
      const cycles = immediate ? 2 : 4;
      return { bytes: total.bytes + bytes, cycles: total.cycles + cycles };
    },
    { bytes: 0, cycles: 0 },
  );
}

/** Make the ownership handoff explicit; no compiler-created masking is needed. */
function ownedSource(body: string, pendingAction = "poke($0420, pending);"): string {
  return `module Game;
import { setIRQExclusive } from c64.system;
interrupt function onIRQ(): void {}
function main(): void {
  asm_php(); asm_sei();
  setIRQExclusive(&onIRQ);
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  let pending: byte = c64.cia1.readAndClearPendingSources();
  ${pendingAction}
  asm_plp();
  ${body}
  for (;;) { asm_nop(); }
}`;
}

describe.each(profiles)("CIA selected output on %s", (target) => {
  it("reads each timer counter low then high without consuming either interrupt register", async () => {
    const source = `module Game;
function main(): void {
  asm_nop();
  let a1: word = c64.cia1.readTimerACounter(); pokew($0400, a1);
  let b1: word = c64.cia1.readTimerBCounter(); pokew($0402, b1);
  let a2: word = c64.cia2.readTimerACounter(); pokew($0404, a2);
  let b2: word = c64.cia2.readTimerBCounter(); pokew($0406, b2);
  asm_nop();
}`;
    const code = instructions((await build(source, target)).assembly);
    expect(ciaAccesses(code)).toEqual([
      { opcode: "lda", operand: "$dc04" },
      { opcode: "ldx", operand: "$dc05" },
      { opcode: "lda", operand: "$dc06" },
      { opcode: "ldx", operand: "$dc07" },
      { opcode: "lda", operand: "$dd04" },
      { opcode: "ldx", operand: "$dd05" },
      { opcode: "lda", operand: "$dd06" },
      { opcode: "ldx", operand: "$dd07" },
    ]);
    for (const low of ["$dc04", "$dc06", "$dd04", "$dd06"]) {
      const high = `$${(Number.parseInt(low.slice(1), 16) + 1).toString(16)}`;
      const selected = expectFragment(code, [
        { opcode: "lda", operand: low },
        { opcode: "ldx", operand: high },
      ]);
      expect(fragmentCost(selected)).toEqual({ bytes: 6, cycles: 8 });
    }
    expect(code.filter(({ operand }) => /^\$0*d[cd]0d$/u.test(operand))).toEqual([]);
    const firstRead = code.findIndex(({ operand }) => operand === "$dc04");
    const lastRead = code.findIndex(({ operand }) => operand === "$dd07");
    const before = code.findLastIndex(({ opcode }, index) => index < firstRead && opcode === "nop");
    const after = code.findIndex(({ opcode }, index) => index > lastRead && opcode === "nop");
    expect(before).toBeGreaterThanOrEqual(0);
    expect(after).toBeGreaterThan(lastRead);
    const selectedBody = code.slice(before + 1, after);
    expect(
      selectedBody.filter(({ opcode }) => opcode === "php" || opcode === "sei" || opcode === "plp"),
    ).toEqual([]);
    expect(selectedBody.filter(({ opcode }) => opcode === "jsr")).toEqual([]);
  }, 60_000);
});

describe("CIA1 owned output", () => {
  it("preserves unrelated control bits with one direct read and write per register", async () => {
    const source = ownedSource(`
  c64.cia1.configureTimerA(c64.cia1.timerStart | c64.cia1.timerLoad);
  c64.cia1.configureTimerB(c64.cia1.timerStart | c64.cia1.timerBCountAUnderflows);`);
    const code = instructions((await build(source)).assembly);
    const selectedA = expectFragment(code, [
      { opcode: "lda", operand: "$dc0e" },
      { opcode: "and", operand: "#$c6" },
      { opcode: "ora", operand: "#$11" },
      { opcode: "sta", operand: "$dc0e" },
    ]);
    expect(fragmentCost(selectedA)).toEqual({ bytes: 10, cycles: 12 });
    expectFragment(code, [
      { opcode: "lda", operand: "$dc0f" },
      { opcode: "and", operand: "#$86" },
      { opcode: "ora", operand: "#$41" },
      { opcode: "sta", operand: "$dc0f" },
    ]);
    expect(ciaAccesses(code).filter(({ operand }) => /^\$dc0[ef]$/u.test(operand))).toEqual([
      { opcode: "lda", operand: "$dc0e" },
      { opcode: "sta", operand: "$dc0e" },
      { opcode: "lda", operand: "$dc0f" },
      { opcode: "sta", operand: "$dc0f" },
    ]);
  }, 60_000);

  it("writes the constant interrupt masks once each without reading the mask", async () => {
    const source = ownedSource(`
  c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA | c64.cia1.sourceTimerB);
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);`);
    const artifacts = await build(source);
    const code = instructions(artifacts.assembly);
    const enable = expectFragment(code, [
      { opcode: "lda", operand: "#$83" },
      { opcode: "sta", operand: "$dc0d" },
    ]);
    const disable = expectFragment(code, [
      { opcode: "lda", operand: "#$1f" },
      { opcode: "sta", operand: "$dc0d" },
    ]);
    expect(fragmentCost(enable)).toEqual({ bytes: 5, cycles: 6 });
    expect(fragmentCost(disable)).toEqual({ bytes: 5, cycles: 6 });
    expect(code.filter(({ operand }) => /^\$dc0d$/u.test(operand))).toEqual([
      { opcode: "sta", operand: "$dc0d" },
      { opcode: "lda", operand: "$dc0d" },
      { opcode: "sta", operand: "$dc0d" },
      { opcode: "sta", operand: "$dc0d" },
    ]);
    const totals = profileRecord(artifacts.costs.totals);
    expect(totals.programBytes).toBe(artifacts.prg.length - 2);
    expect(
      profileRecords(artifacts.costs.entries)
        .filter(({ kind, accounting }) => kind === "bytes" && accounting === "program")
        .reduce((sum, { bytes }) => sum + Number(bytes), 0),
    ).toBe(artifacts.prg.length - 2);
    expect(profileRecords(artifacts.memory.stackDomains).length).toBeGreaterThan(0);
  }, 60_000);

  it.each([
    ["enable", "enableInterruptSources", "#$03"],
    ["disable", "disableInterruptSources", "#$1f"],
  ] as const)(
    "bounds a runtime byte before the %s mask write",
    async (_, operation, bound) => {
      const source = ownedSource(`
  let requested: byte = peek($0400);
  c64.cia1.${operation}(requested);`);
      const code = instructions((await build(source)).assembly);
      const maskIndex = code.findIndex(
        ({ opcode, operand }) => opcode === "and" && operand === bound,
      );
      const writes = code.flatMap(({ opcode, operand }, index) =>
        opcode === "sta" && operand === "$dc0d" ? [index] : [],
      );
      expect(maskIndex).toBeGreaterThanOrEqual(0);
      expect(writes).toHaveLength(2);
      expect(maskIndex).toBeGreaterThan(writes[0]!);
      expect(maskIndex).toBeLessThan(writes[1]!);
      const selected = code.slice(maskIndex, writes[1]! + 1);
      expect(selected.some(({ opcode, operand }) => opcode === "ora" && operand === "#$80")).toBe(
        operation === "enableInterruptSources",
      );
      expect(
        code.filter(({ opcode, operand }) => opcode === "lda" && operand === "$dc0d"),
      ).toHaveLength(1);
    },
    60_000,
  );

  it("keeps the source-visible handoff ordered and returns all pending bits once", async () => {
    const source = ownedSource(
      `c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA);`,
      `if ((pending & c64.cia1.sourceTimerA) != 0) { poke($0420, 1); }
  if ((pending & c64.cia1.sourceTimerB) != 0) { poke($0421, 2); }
  poke($0422, pending);`,
    );
    const code = instructions((await build(source)).assembly);
    const php = code.findIndex(({ opcode }) => opcode === "php");
    const sei = code.findIndex(({ opcode }, index) => index > php && opcode === "sei");
    const disable = code.findIndex(
      ({ opcode, operand }) => opcode === "sta" && operand === "$dc0d",
    );
    const pending = code.findIndex(
      ({ opcode, operand }) => opcode === "lda" && operand === "$dc0d",
    );
    const plp = code.findIndex(({ opcode }, index) => index > pending && opcode === "plp");
    const enable = code.findIndex(
      ({ opcode, operand }, index) => index > plp && opcode === "sta" && operand === "$dc0d",
    );
    expect(php).toBeGreaterThanOrEqual(0);
    expect(sei).toBeGreaterThan(php);
    const vectorWrites = code.flatMap(({ opcode, operand }, index) =>
      /^st[axy]$/u.test(opcode) && /^\$0*31[45]$/u.test(operand) ? [index] : [],
    );
    expect(vectorWrites).toHaveLength(2);
    expect(vectorWrites.every((index) => index > sei && index < disable)).toBe(true);
    expect(disable).toBeGreaterThan(sei);
    expect(pending).toBeGreaterThan(disable);
    expect(plp).toBeGreaterThan(pending);
    expect(enable).toBeGreaterThan(plp);
    const selectedEnable = expectFragment(code, [
      { opcode: "lda", operand: "#$81" },
      { opcode: "sta", operand: "$dc0d" },
    ]);
    expect(fragmentCost(selectedEnable)).toEqual({ bytes: 5, cycles: 6 });
    expect(
      code.filter(({ opcode, operand }) => opcode === "lda" && operand === "$dc0d"),
    ).toHaveLength(1);
    expect(fragmentCost([code[pending]!])).toEqual({ bytes: 3, cycles: 4 });
    expect(code.filter(({ operand }) => operand === "$dd0d")).toEqual([]);
    expect(code.some(({ opcode, operand }) => opcode === "and" && operand === "#$01")).toBe(true);
    expect(code.some(({ opcode, operand }) => opcode === "and" && operand === "#$02")).toBe(true);
    expect(
      code.filter(({ opcode }) => /^b(?:cc|cs|eq|mi|ne|pl|vc|vs)$/u.test(opcode)).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      code.filter(
        ({ opcode, operand }) => /^st[axy]$/u.test(opcode) && /^\$0*42[012]$/u.test(operand),
      ).length,
    ).toBeGreaterThanOrEqual(3);
  }, 60_000);
});
