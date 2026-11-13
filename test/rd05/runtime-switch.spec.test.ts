import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecord, profileRecords } from "./profile-fixture.js";

const target = "c64-pal-prg-kernal-6581";
const byteHelper = `function selected(value: byte): byte {
  switch (value) {
    case 1: return 11;
    case 2: return 22;
    default: return 99;
  }
}`;
const byteMain = "function main(): void { poke($0425, selected(peek($0400))); }";
const wordHelper = `function selected(value: word): byte {
  switch (value) {
    case $0001: return 11;
    case $0101: return 22;
    default: return 99;
  }
}`;

/** Reconcile public function entry labels with the loaded PRG address range. */ function expectFunctionLabels(
  artifacts: Awaited<ReturnType<typeof buildProfileSource>>,
  placed = false,
) {
  expect(artifacts.memory.acmeReconciled).toBe(true);
  expect([...artifacts.prg.subarray(0, 2)]).toEqual([1, 8]);
  const labels = new Map(
    [...artifacts.labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
      match[1]!,
      Number.parseInt(match[2]!, 16),
    ]),
  );
  for (const name of ["main", "selected"]) {
    const functions = profileRecords(artifacts.debug.functions).filter(
      (fn) => fn.qualifiedName === `src/game.blend::Game.${name}`,
    );
    expect(functions, name).toHaveLength(1);
    const variants = profileRecords(functions[0]!.entryVariants);
    expect(variants, name).toHaveLength(1);
    const label = variants[0]!.label;
    if (typeof label !== "string") throw new Error(`Missing ${name} entry label`);
    const address = labels.get(label);
    expect(address, label).toBeDefined();
    expect(address).toBeGreaterThanOrEqual(0x0801);
    expect(address).toBeLessThan(0x0801 + artifacts.prg.length - 2);
    if (placed && name === "selected") expect(address).toBe(0x2000);
  }
}

/** Return the exact instruction lines of one named routine in generated assembly. */
function routineInstructions(assembly: string, name: string): string[] {
  const start = assembly.indexOf(`; routine "${name}"`);
  expect(start).toBeGreaterThanOrEqual(0);
  const body: string[] = [];
  for (const line of assembly.slice(start).split("\n").slice(1)) {
    if (line.startsWith("; routine ")) break;
    if (line.startsWith("  ")) body.push(line.trim());
  }
  return body;
}

describe("ordinary runtime switch builds", () => {
  // Returning cases and a returning default are an ordinary complete function body.
  it("should build a byte switch with every arm returning to its caller", async () => {
    const artifacts = await buildProfileSource(`module Game; ${byteHelper} ${byteMain}`, target);
    expectFunctionLabels(artifacts);
  });

  // Function declaration order does not change a caller's ability to use its helper.
  it("should build the returning helper when main is declared first", async () => {
    const artifacts = await buildProfileSource(`module Game; ${byteMain} ${byteHelper}`, target);
    expectFunctionLabels(artifacts);
  });

  // Legal explicit placement must survive assembly and retain its public entry address.
  it("should build the returning helper at its explicit address", async () => {
    const artifacts = await buildProfileSource(
      `module Game; ${byteMain} place(at: $2000) ${byteHelper}`,
      target,
    );
    expectFunctionLabels(artifacts, true);
  });

  // Word case values may differ only in their high byte.
  it("should build a word switch with distinct low-byte-equal cases", async () => {
    const artifacts = await buildProfileSource(
      `module Game; ${wordHelper}
function main(): void { poke($0425, selected(peekw($0400))); }`,
      target,
    );
    expectFunctionLabels(artifacts);
  });

  // An unmatched switch without default continues to the following return.
  it("should build a switch without default followed by a return", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
function selected(value: byte): byte {
  switch (value) { case 1: return 11; case 2: return 22; }
  return 99;
}
${byteMain}`,
      target,
    );
    expectFunctionLabels(artifacts);
  });

  // Only an explicit fallthrough transfers execution into the next case body.
  it("should build an effectful case falling through to a returning arm", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
function selected(value: byte): byte {
  switch (value) {
    case 1: poke($0426, 7); fallthrough;
    case 2: return 22;
    default: return 99;
  }
}
${byteMain}`,
      target,
    );
    expectFunctionLabels(artifacts);
  });

  // A conditional expression discriminant claims a frame slot and must be lowered
  // once for the dispatch chain rather than re-claiming a slot per test.
  it("should build a switch on a slot-claiming conditional discriminant", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
function selected(flag: boolean): byte {
  switch (flag ? 1 : 2) {
    case 1: return 11;
    case 2: return 22;
    default: return 99;
  }
}
function main(): void { poke($0425, selected(peek($0400) == 3)); }`,
      target,
    );
    expectFunctionLabels(artifacts);
  });

  // An ordinary case with an effect completes without executing the next case body.
  it("should build automatic case breaks before the final return", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
function selected(value: byte): byte {
  switch (value) {
    case 1: poke($0426, 11);
    case 2: poke($0426, 22);
    default: poke($0426, 99);
  }
  return 7;
}
${byteMain}`,
      target,
    );
    expectFunctionLabels(artifacts);
  });

  // The selector is loaded once and each case compares directly; EOR would
  // destroy the byte the rest of the chain still needs.
  it("should keep the byte selector live across the dispatch chain", async () => {
    const artifacts = await buildProfileSource(`module Game; ${byteHelper} ${byteMain}`, target);
    const body = routineInstructions(artifacts.assembly, "Game.selected");
    expect(body[0]).toMatch(/^lda \$/u);
    expect(body.slice(1, 5)).toEqual([
      "cmp #$01",
      expect.stringMatching(/^beq /u),
      "cmp #$02",
      expect.stringMatching(/^beq /u),
    ]);
    expect(body.filter((line) => line === "eor" || line.startsWith("eor "))).toEqual([]);
    expect(body.some((line) => line.startsWith("ldy ") || line.includes("("))).toBe(false);
    const totals = profileRecord(artifacts.costs.totals);
    const scratch = profileRecords(totals.resources).find(
      (row) => row.kind === "standard" && row.id === "scratch",
    );
    expect(scratch?.value).toBe(0);
  });

  // A word selector compares its shared low byte once, then keeps the high byte
  // in A across the remaining high-byte cases without an equality scratch home.
  it("should share the word selector low-byte test without equality scratch", async () => {
    const artifacts = await buildProfileSource(
      `module Game; ${wordHelper}
function main(): void { poke($0425, selected(peekw($0400))); }`,
      target,
    );
    const body = routineInstructions(artifacts.assembly, "Game.selected");
    expect(body[0]).toMatch(/^lda \$/u);
    expect(body[1]).toBe("cmp #$01");
    expect(body[2]).toMatch(/^bne /u);
    expect(body[3]).toMatch(/^lda \$/u);
    expect(body[4]).toMatch(/^beq /u);
    expect(body[5]).toBe("cmp #$01");
    expect(body[6]).toMatch(/^beq /u);
    expect(body.filter((line) => line.startsWith("eor ") || line.startsWith("ora "))).toEqual([]);
    expect(body.some((line) => line.startsWith("ldy ") || line.includes("("))).toBe(false);
    const totals = profileRecord(artifacts.costs.totals);
    const resources = profileRecords(totals.resources);
    expect(resources.find((row) => row.kind === "standard" && row.id === "scratch")?.value).toBe(0);
    expect(resources.find((row) => row.kind === "standard" && row.id === "zeroPage")?.value).toBe(
      0,
    );
  });

  // The balanced default carries source-observer evidence. Reshaping a word
  // dispatch must keep every original test label present for that evidence.
  it("should build the word dispatch with default optimized observer evidence", async () => {
    const artifacts = await buildProfileSource(
      `module Game; ${wordHelper}
function main(): void { poke($0425, selected(peekw($0400))); }`,
      target,
      "balanced",
    );
    expectFunctionLabels(artifacts);
    const body = routineInstructions(artifacts.assembly, "Game.selected");
    expect(body.filter((line) => line.startsWith("eor ") || line.startsWith("ora "))).toEqual([]);
    const totals = profileRecord(artifacts.costs.totals);
    expect(
      profileRecords(totals.resources).find(
        (row) => row.kind === "standard" && row.id === "scratch",
      )?.value,
    ).toBe(0);
  });

  // A word dispatch inside a selected loop must retain every observer label
  // while the loop evidence still covers the reshaped blocks.
  it("should build a runtime switch inside a fixed loop under optimization", async () => {
    const artifacts = await buildProfileSource(
      `module Game; ${wordHelper}
function main(): void {
  let sum: byte = 0;
  for (let i: byte = 0; i < 3; i += 1) { sum += selected(peekw($0400)); }
  poke($0425, sum);
}`,
      target,
      "balanced",
    );
    expectFunctionLabels(artifacts);
  });

  // Word cases with different low bytes still avoid the equality scratch by
  // testing each byte directly; the two-byte chain is only shared when legal.
  it("should compare word bytes directly when cases have different low bytes", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
function selected(value: word): byte {
  switch (value) {
    case $0001: return 11;
    case $0202: return 22;
    default: return 99;
  }
}
function main(): void { poke($0425, selected(peekw($0400))); }`,
      target,
    );
    const body = routineInstructions(artifacts.assembly, "Game.selected");
    expect(body.filter((line) => line.startsWith("eor ") || line.startsWith("ora "))).toEqual([]);
    expect(body.filter((line) => line.startsWith("cmp "))).toEqual([
      "cmp #$01",
      "cmp #$02",
      "cmp #$02",
    ]);
    const totals = profileRecord(artifacts.costs.totals);
    expect(
      profileRecords(totals.resources).find(
        (row) => row.kind === "standard" && row.id === "scratch",
      )?.value,
    ).toBe(0);
  });
});
