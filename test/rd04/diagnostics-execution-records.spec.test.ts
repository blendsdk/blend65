import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { diagnosticSpan } from "./diagnostic-fixture.js";

/** Exercise source analysis and execution-graph checks through the user's public build service. */
async function build(source: string) {
  const root = await mkdtemp(join(tmpdir(), "blend65-execution-records-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "execution-records",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: [],
        outDir: "out",
        optimization: "none",
      }),
    );
    return await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const cases = [
  {
    code: "E10244",
    source:
      "module Game; import { setIRQ } from c64.system; function ordinary(): void {} function main(): void { setIRQ(&ordinary); }",
    proof: "&ordinary",
    message:
      "Ordinary function value 'ordinary' cannot be installed in interrupt-handler sink 'c64.system.setIRQ' — use an interrupt function",
    related: ["ordinary"],
  },
  {
    code: "E10248",
    source: "module Game; function main(): void { asm_plp(); }",
    proof: "asm_plp()",
    message: expect.stringMatching(
      /^Status-save operations in 'main' do not preserve the function-entry stack state on every path — .+$/u,
    ),
    related: [],
  },
  {
    code: "E10252",
    source:
      "module Game; interrupt function handler(): void {} function main(): void { pokew($0314, word(&handler)); }",
    proof: "pokew($0314, word(&handler))",
    message: expect.stringMatching(
      /^Raw interrupt-entry address for 'handler' cannot be written directly to firmware vector '(?:CINV|\$0314)' — use 'c64\.system\.setIRQ' so the compiler selects the required entry variant$/u,
    ),
    related: ["handler"],
  },
  {
    code: "E10260",
    source:
      "module Game; export function leak(): word { let value: byte = 7; return &value; } function main(): void {}",
    proof: "&value",
    message: expect.stringMatching(
      /^Address derived from 'value' escapes its lifetime through .*return.* — the address may only be used while its origin is alive or passed to a proven non-retaining parameter; move persistent data to module scope or keep it caller-owned$/u,
    ),
    related: ["value"],
  },
  {
    code: "E10262",
    source: "module Game; function main(): void { for (let i: byte = 0; i < 256; i += 1) {} }",
    proof: "for (let i: byte = 0; i < 256; i += 1) {}",
    message:
      "Loop counter 'i' repeats within 0–255 before condition bound 256 can be reached — use 'word' or make deliberate wrap/infinite control explicit",
    related: [],
  },
  {
    code: "E10272",
    source: "module Game; place(foo: 1) let data: byte; function main(): void {}",
    proof: "foo",
    message: expect.stringMatching(
      /^Invalid place constraint on 'data' — .*foo.*; allowed keys are at, align, noCross, and region on module-level stored data or emitted functions$/u,
    ),
    related: [],
  },
  {
    code: "E10273",
    source:
      "module Game; place(at: $2001, align: 256) const DATA: byte = 7; function main(): void { poke($0400, DATA); }",
    proof: "place(at: $2001, align: 256)",
    message: expect.stringMatching(
      /^Cannot place 'DATA' — .+ conflict with .+; change or remove the explicit constraint$/u,
    ),
    related: [],
  },
  {
    code: "E10274",
    source:
      "module Game; loadable const DATA: byte = 1; function main(): void { poke($0400, DATA); }",
    proof: "DATA",
    occurrence: 1,
    message:
      "Loadable constant 'DATA' has no resident value or address — use compile-time metadata or pass it to a compatible selected-profile load operation",
    related: ["DATA"],
  },
  {
    code: "E10275",
    source:
      "module Game; loadable const DATA: byte[2] = [1, 2]; let target: byte[2]; function main(): void { c64.loader.load(DATA, target); }",
    proof: "c64.loader.load(DATA, target)",
    message: expect.stringMatching(/^Cannot load 'DATA' into 'target' — .+$/u),
    related: [],
  },
  {
    code: "E10277",
    source:
      "module Game; let callback: fn(byte): byte; function main(): void { poke($0400, callback(1)); }",
    proof: "callback(1)",
    message:
      "Cannot prove a finite source-function target set for call through 'callback' of type 'fn(byte): byte' — keep the value within closed-program typed storage",
    related: ["callback"],
  },
  {
    code: "E10278",
    source:
      "module Game; import { restoreIRQ } from c64.system; function main(): void { restoreIRQ(); }",
    proof: "restoreIRQ()",
    message: expect.stringMatching(
      /^Interrupt ownership for sink 'c64\.system\.setIRQ' is invalid at '(?:c64\.system\.)?restoreIRQ(?:\(\))?' — .+$/u,
    ),
    related: [],
  },
] as const;

describe("canonical execution ownership failures", () => {
  // The actual public build must preserve each language-owned error through whole-program checks.
  it.each(cases)(
    "should report $code with its source and related ownership sites",
    async (testCase) => {
      const result = await build(testCase.source);
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(result.kind).toBe("failure");
      expect(errors.map(({ code }) => code)).toEqual([testCase.code]);
      expect(errors[0]).toMatchObject({
        code: testCase.code,
        severity: "error",
        pointer: null,
        message: testCase.message,
        primarySpan: diagnosticSpan(
          testCase.source,
          testCase.proof,
          "occurrence" in testCase ? testCase.occurrence : 0,
        ),
      });
      expect(errors[0]?.related.map(({ span }) => span)).toEqual(
        testCase.related.map((proof) => diagnosticSpan(testCase.source, proof)),
      );
      expect(result).not.toHaveProperty("generation");
    },
    60_000,
  );
});
