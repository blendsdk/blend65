import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { diagnosticSpan } from "./diagnostic-fixture.js";

/** Exercise semantic and selected-profile producers through the existing public build boundary. */
async function build(source: string, rawAsset?: Uint8Array) {
  const root = await mkdtemp(join(tmpdir(), "blend65-alternate-placement-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    if (rawAsset) await writeFile(join(root, "src/oversized.bin"), rawAsset);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "alternate-placement",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    return await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const invalidPlacement = [
  {
    name: "duplicate key",
    clause: "place(align: 2, align: 4)",
    proof: "align",
    occurrence: 1,
    related: ["align"],
  },
  {
    name: "unavailable region",
    clause: "place(region: c64.missing)",
    proof: "c64.missing",
    related: [],
  },
  { name: "non-power-of-two alignment", clause: "place(align: 3)", proof: "3", related: [] },
  {
    name: "address outside the 16-bit domain",
    clause: "place(at: -1)",
    proof: "-1",
    related: [],
  },
  {
    name: "quoted region",
    clause: 'place(region: "c64.vic.bank1")',
    proof: '"c64.vic.bank1"',
    related: [],
  },
] as const;

describe("canonical diagnostics from alternate placement producers", () => {
  it.each(invalidPlacement)(
    "reports the exact invalid place record for $name",
    async (testCase) => {
      const source = `module Game; ${testCase.clause} let data: byte; function main(): void {}`;
      const result = await build(source);
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(result.kind).toBe("failure");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "E10272",
        severity: "error",
        pointer: null,
        message: expect.stringMatching(
          /^Invalid place constraint on 'data' — .+; allowed keys are at, align, noCross, and region on module-level stored data or emitted functions$/u,
        ),
        primarySpan: diagnosticSpan(
          source,
          testCase.proof,
          "occurrence" in testCase ? testCase.occurrence : 0,
        ),
      });
      expect(errors[0]?.related.map(({ span }) => span)).toEqual(
        testCase.related.map((proof) => diagnosticSpan(source, proof)),
      );
      expect(result).not.toHaveProperty("generation");
    },
  );

  it("reports a source-local object as ineligible for explicit placement", async () => {
    const source = "module Game; function main(): void { place(at: $2000) let data: byte; }";
    const result = await build(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10272",
      severity: "error",
      pointer: null,
      message: expect.stringMatching(
        /^Invalid place constraint on 'data' — .+; allowed keys are at, align, noCross, and region on module-level stored data or emitted functions$/u,
      ),
      primarySpan: diagnosticSpan(source, "place(at: $2000)"),
      related: [],
    });
  });

  it.each([
    [
      "crossing a complete-object window",
      "place(at: $20FF, noCross: 256) const DATA: byte[2] = [1, 2];",
      "DATA",
      "place(at: $20FF, noCross: 256)",
    ],
    ["ordinary data in I/O", "place(at: $D020) let data: byte;", "data", "place(at: $D020)"],
    [
      "zero page outside the selected allocation window",
      "zeropage { place(at: $90) data: byte; }",
      "data",
      "place(at: $90)",
    ],
  ])(
    "retains canonical placement conflict framing for %s",
    async (_name, declaration, object, proof) => {
      const source = `module Game; ${declaration} function main(): void {}`;
      const result = await build(source);
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(result.kind).toBe("failure");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "E10273",
        severity: "error",
        pointer: null,
        message: expect.stringMatching(
          new RegExp(
            `^Cannot place '${object}' — .+ conflict with .+; change or remove the explicit constraint$`,
            "u",
          ),
        ),
        primarySpan: diagnosticSpan(source, proof),
        related: [],
      });
      expect(result).not.toHaveProperty("generation");
    },
  );

  it("retains canonical framing when a resident object is supplied as a load unit", async () => {
    const call = "c64.loader.load(DATA, target)";
    const source = `module Game; const DATA: byte[2] = [1, 2]; let target: byte[2]; function main(): void { ${call}; }`;
    const result = await build(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("failure");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10275",
      severity: "error",
      pointer: null,
      message: expect.stringMatching(/^Cannot load 'DATA' into 'target' — .+$/u),
      primarySpan: diagnosticSpan(source, call),
    });
    expect(errors[0]?.related.map(({ span }) => span)).toEqual([diagnosticSpan(source, "DATA")]);
    expect(result).not.toHaveProperty("generation");
  });

  it("reports the unbounded cooperative NMI entry through its canonical execution-path record", async () => {
    const source = `module Game;
import { setNMI, restoreNMI } from c64.system;
interrupt function handler(): void {
  let a: byte = peek($0400);
  let b: byte = peek($0401);
  let c: byte = peek($0402);
  let d: byte = peek($0403);
  let e: byte = peek($0404);
  poke($0410, a);
  poke($0411, b);
  poke($0412, c);
  poke($0413, d);
  poke($0414, e);
}
function main(): void { setNMI(&handler); restoreNMI(); }`;
    const result = await build(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("failure");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10245",
      severity: "error",
      pointer: null,
      message: expect.stringMatching(
        /^Execution path '[^']+' has unbounded private-storage overlap, disallowed unbounded stack use, or unproved generated reentrancy$/u,
      ),
      primarySpan: diagnosticSpan(source, "setNMI(&handler)"),
      related: [],
    });
    expect(result).not.toHaveProperty("generation");
  });

  it("reports the canonical entry-ABI remedy for an opaque handler address", async () => {
    const call = "setIRQ(peekw($0400))";
    const source = `module Game; import { setIRQ } from c64.system; function main(): void { ${call}; }`;
    const result = await build(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("failure");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10247",
      severity: "error",
      pointer: null,
      message:
        "Cannot prove the entry ABI of the value passed to function-address sink 'c64.system.setIRQ' — pass a provenance-preserving function address or use an explicit raw hardware boundary",
      primarySpan: diagnosticSpan(source, "peekw($0400)"),
      related: [],
    });
    expect(result).not.toHaveProperty("generation");
  });

  it("reports the complete byte size of an unrepresentable inferred raw asset array", async () => {
    const source =
      'module Game; const DATA: byte[] = embed("oversized.bin"); function main(): void {}';
    const result = await build(source, new Uint8Array(65_536));
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("failure");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10265",
      severity: "error",
      pointer: null,
      message:
        "Type 'byte[65536]' requires 65536 bytes — fixed array and struct types are limited to 65535 bytes",
      primarySpan: diagnosticSpan(source, 'embed("oversized.bin")'),
      related: [],
    });
    expect(result).not.toHaveProperty("generation");
  });
});
