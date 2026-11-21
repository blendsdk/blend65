import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectDiagnostic, ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "./service.js";

const PROFILE_ID = "c64-pal-prg-kernal-6581";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Build the immutable frontend input for one single-source program on the selected profile. */
function snapshot(text: string): ProjectSnapshot {
  const manifestText = "{}";
  const source: SourceRecord = Object.freeze({
    sourceId: "src/game.blend",
    text,
    sha256: sha256(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/src/game.blend",
  });
  return Object.freeze({
    manifest: Object.freeze({
      schemaVersion: 1,
      name: "raw-vector-handler-spec",
      sourceRoot: "src",
      entry: "Game",
      target: PROFILE_ID,
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    }),
    manifestSource: Object.freeze({
      sourceId: "blend65.json",
      text: manifestText,
      sha256: sha256(manifestText),
      byteLength: Buffer.byteLength(manifestText, "utf8"),
      resolvedPath: "/checkout/blend65.json",
    }),
    sources: Object.freeze([source]),
    inputSha256: sha256(text),
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: Object.freeze([]),
    outDir: "/checkout/out",
    overrides: Object.freeze({ target: null, entry: null }),
    effectiveTarget: PROFILE_ID,
    effectiveEntry: "Game",
  }) as ProjectSnapshot;
}

/** Analyze one program and return the errors it reports, in order. */
function errorsOf(text: string): readonly ProjectDiagnostic[] {
  const result = analyzeProject(snapshot(text));
  return result.kind === "error"
    ? result.diagnostics.filter(({ severity }) => severity === "error")
    : [];
}

/** One handler and one ordinary function, so either kind of address can be written. */
const DECLARATIONS = `interrupt function onRaster(): void { poke($D020, 7); }
function plain(): void { poke($D020, 7); }`;

/** Wrap one statement in a program that declares both function kinds. */
function program(statement: string): string {
  return `module Game;
${DECLARATIONS}
function main(): void { ${statement} }
`;
}

describe("a raw interrupt-entry address written to a recognized firmware vector", () => {
  it.each([
    ["the post-save CINV hook", "$0314", "c64.system.setIRQ"],
    ["the NMI vector", "$0318", "c64.system.setNMI"],
  ])(
    "should be refused at %s, naming the sink that selects the entry variant",
    (_case, vector, sink) => {
      // Each vector is entered under its own stack and exit contract, so an entry compiled for one
      // does not satisfy another. What the author needs is the operation that owns that vector, not
      // a different way of spelling the address, and the refusal says so.
      const errors = errorsOf(program(`pokew(${vector}, &onRaster);`));

      expect(errors.map(({ code }) => code)).toEqual(["E10252"]);
      expect(errors[0]?.message).toBe(
        `Raw interrupt-entry address for 'onRaster' cannot be written directly to firmware vector '${vector.toLowerCase()}' — use '${sink}' so the compiler selects the required entry variant`,
      );
      expect(errors[0]?.related.map(({ message }) => message)).toEqual([
        "Interrupt function is declared here",
      ]);
    },
  );

  it("should be refused whether or not the address is converted on the way", () => {
    // The conversion changes what the compiler can prove about the value, but it does not change
    // where the value is going or what entering there requires. Both spellings are the same
    // mistake and must reach the same answer.
    const bare = errorsOf(program("pokew($0314, &onRaster);"));
    const converted = errorsOf(program("pokew($0314, word(&onRaster));"));

    expect(bare.map(({ code }) => code)).toEqual(["E10252"]);
    expect(converted.map(({ code }) => code)).toEqual(["E10252"]);
    expect(bare[0]?.message).toBe(converted[0]?.message);
  });
});

describe("a function or handler address arriving where a scalar is required", () => {
  it.each([
    ["an interrupt handler", "&onRaster", "interrupt handler"],
    ["an ordinary function", "&plain", "fn(): void"],
  ])("should require the conversion to be written down: %s", (_case, address, from) => {
    // Exposing the address throws away what makes the value safe to install — its signature, or
    // the proof that a sink will accept it. The language requires that to be written rather than
    // assumed, so an implicit arrival is refused and names the conversion.
    const errors = errorsOf(program(`let destination: word = ${address};`));

    expect(errors.map(({ code }) => code)).toEqual(["E10080"]);
    // The documented shape is pinned and the detail clause after it is not, because which remedy
    // reads best is the compiler's business while naming both types is the contract.
    const documented = `Cannot implicitly convert '${from}' to 'word' — `;
    expect(errors[0]?.message.slice(0, documented.length)).toBe(documented);
    expect(errors[0]?.message.length, "no remedy follows the two type names").toBeGreaterThan(
      documented.length,
    );
  });

  it("should accept the same address once the conversion is written", () => {
    // The refusal is about silence, not about the operation. Written down, exposing the address is
    // ordinary and stays available: a raw boundary is the escape hatch the language offers.
    expect(
      errorsOf(program("let destination: word = word(&plain); poke($C000, lo(destination));")),
    ).toEqual([]);
  });
});
