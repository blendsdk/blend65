import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { createHash } from "node:crypto";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { selectTargetProfile } from "../target/profile.js";
import { finalPlacementProof } from "./final-placement-proof.js";
import { buildSemanticProgram } from "./lower.js";
import type { PlacedRange } from "./raw-write-kills.js";
import { closeWholeProgram } from "./whole-program.js";
import type { WholeProgram } from "./whole-program.js";

const PROFILE_ID = "c64-pal-prg-kernal-6581";

/** No platform sink is involved in these ordinary callable fixtures. */
const NO_SINKS: ReadonlySet<string> = new Set();

/** Close one source to a whole program without allocating or placing anything. */
function closed(text: string): WholeProgram {
  const hash = createHash("sha256").update(text, "utf8").digest("hex");
  const source: SourceRecord = {
    sourceId: "src/game.blend",
    text,
    sha256: hash,
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/src/game.blend",
  };
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "placement-proof",
      sourceRoot: "src",
      entry: "Game",
      target: PROFILE_ID,
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      sha256: createHash("sha256").update("{}", "utf8").digest("hex"),
      byteLength: 2,
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source],
    inputSha256: hash,
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: PROFILE_ID,
    effectiveEntry: "Game",
  };
  const target = selectTargetProfile(PROFILE_ID);
  if (target.kind !== "complete") throw new Error("Expected the selected target profile");
  const analysis = analyzeProject(snapshot);
  if (analysis.kind !== "complete") throw new Error(JSON.stringify(analysis.diagnostics));
  const semantic = buildSemanticProgram(analysis);
  if (semantic.kind !== "complete") throw new Error(JSON.stringify(semantic));
  const whole = closeWholeProgram(
    semantic.program,
    target.profile.interrupts,
    target.profile.storage,
  );
  if (whole.kind !== "complete") throw new Error(JSON.stringify(whole.diagnostics));
  return whole.program;
}

/** Address of the fixture's callable storage, chosen here instead of by a layout. */
const BASE = 0x1000;

/** Pretend the fixture's single global received a chosen interval of its size. */
function ranges(program: WholeProgram, size = 2): ReadonlyMap<string, PlacedRange> {
  const global = program.semantic.globals[0];
  if (global === undefined || program.semantic.globals.length !== 1)
    throw new Error("These fixtures declare exactly one global");
  return new Map([[bindingIdentityKey(global.id), { start: BASE, end: BASE + size }]]);
}

/** Ordinary program whose single callable global is assigned, then called. */
function fixture(body: string, declaration = "let callback: fn(): byte;"): string {
  return `module Game;
${declaration}
function chosen(): byte { return 37; }
function main(): void {
${body}
}
`;
}

describe("call proof against chosen addresses", () => {
  // Nothing to compare against means the earlier closure already decided.
  it("should accept a program when no interval was chosen", () => {
    const program = closed(
      fixture("callback = &chosen;\npokew($1000, 0);\npoke($C000, callback());"),
    );

    expect(finalPlacementProof(program, new Map(), NO_SINKS)).toEqual({ kind: "valid" });
  });

  // A chosen address can only matter through a write that lands on it.
  it("should accept a program that performs no raw write", () => {
    const program = closed(fixture("callback = &chosen;\nlet value: byte = callback();"));

    expect(finalPlacementProof(program, ranges(program), NO_SINKS)).toEqual({
      kind: "valid",
    });
  });

  // Byte precision: the error depends on the exact covered bytes, not the object.
  it.each([
    ["the write covers both callable bytes", "pokew($1000, 0);", true],
    ["the write covers only the low byte", "poke($1000, 0);", true],
    ["the write covers only the high byte", "poke($1001, 0);", true],
    ["a word write begins one byte earlier", "pokew($0FFF, 0);", true],
    ["a word write ends exactly at the callable", "pokew($0FFE, 0);", false],
    ["a byte write follows the callable", "poke($1002, 0);", false],
  ])("should decide the proof when %s", (_name, write, lost) => {
    const program = closed(fixture(`callback = &chosen;\n${write}\npoke($C000, callback());`));
    const proof = finalPlacementProof(program, ranges(program), NO_SINKS);

    expect(proof.kind).toBe(lost ? "invalid" : "valid");
  });

  // Source order decides: a write only matters between assignment and call.
  it.each([
    [
      "the write precedes the assignment",
      "pokew($1000, 0);\ncallback = &chosen;\npoke($C000, callback());",
    ],
    [
      "the write follows the last call",
      "callback = &chosen;\npoke($C000, callback());\npokew($1000, 0);",
    ],
  ])("should keep the proof when %s", (_name, body) => {
    const program = closed(fixture(body));

    expect(finalPlacementProof(program, ranges(program), NO_SINKS)).toEqual({ kind: "valid" });
  });

  // A complete typed assignment restores a proof the raw write had erased.
  it("should accept a complete reassignment after the write", () => {
    const program = closed(
      fixture(
        "callback = &chosen;\npokew($1000, 0);\ncallback = &chosen;\npoke($C000, callback());",
      ),
    );

    expect(finalPlacementProof(program, ranges(program), NO_SINKS)).toEqual({
      kind: "valid",
    });
  });

  // The error must name the call, the storage and the write that covered it.
  it("should explain a lost proof with its call, storage and write sites", () => {
    const text = fixture("callback = &chosen;\npokew($1000, 0);\npoke($C000, callback());");
    const program = closed(text);
    const proof = finalPlacementProof(program, ranges(program), NO_SINKS);

    if (proof.kind !== "invalid") throw new Error("Expected a lost proof");
    expect(proof.diagnostics).toHaveLength(1);
    const diagnostic = proof.diagnostics[0]!;
    expect(diagnostic.code).toBe("E10277");
    expect(text.slice(diagnostic.primarySpan!.start, diagnostic.primarySpan!.end)).toBe(
      "callback()",
    );
    const sites = diagnostic.related.map(({ span }) => text.slice(span.start, span.end));
    expect(sites).toContain("callback");
    expect(sites).toContain("pokew($1000, 0)");
    for (const note of diagnostic.related) expect(note.message.trim().length).toBeGreaterThan(0);
  });

  // The author cannot see the chosen address anywhere in the source, so the
  // note that blames a write has to name the bytes it actually reached.
  it("should name the chosen callable bytes in the write note", () => {
    const program = closed(
      fixture("callback = &chosen;\npokew($1000, 0);\npoke($C000, callback());"),
    );
    const proof = finalPlacementProof(program, ranges(program), NO_SINKS);

    if (proof.kind !== "invalid") throw new Error("Expected a lost proof");
    expect(proof.diagnostics[0]?.related.map(({ message }) => message)).toContain(
      "A raw memory write replaces the callable bytes placed at $1000–$1001 here",
    );
  });

  // The closed target sets are keyed by the operations this walk visits, so the
  // containment check really compares them instead of silently finding nothing.
  it("should find the closed target set of the call it re-proves", () => {
    const program = closed(fixture("callback = &chosen;\npoke($C000, callback());"));
    const calls = program.semantic.functions.flatMap((fn) =>
      fn.blocks.flatMap((block) =>
        block.operations.flatMap((operation) =>
          operation.kind === "indirect-call" ? [operation] : [],
        ),
      ),
    );

    expect(calls).toHaveLength(1);
    expect(program.indirectTargets?.get(calls[0]!)).toHaveLength(1);
  });
});
