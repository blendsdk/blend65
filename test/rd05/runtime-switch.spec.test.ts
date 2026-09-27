import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecords } from "./profile-fixture.js";

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

/** Reconcile public function entry labels with the loaded PRG address range. */
function expectFunctionLabels(
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
});
