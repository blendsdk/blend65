/**
 * Shared source-lowering helpers for the block-index suites.
 *
 * Both suites need a real lowered program rather than a hand-built one, and the
 * same two readers for the demands a module object came out with. They live in
 * their own module because importing one suite from another would register its
 * cases a second time, and duplicating the helpers would put the same snapshot
 * construction in two places.
 */
import { createHash } from "node:crypto";
import { expect } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "../frontend/service.js";
import { buildSemanticProgram } from "./lower.js";
import type { SemanticGlobal } from "./operations.js";

/** Lower one real source file without host I/O or generated output. */
export function lowerSource(text: string) {
  const source: SourceRecord = {
    sourceId: "src/game.blend",
    text,
    sha256: createHash("sha256").update(text).digest("hex"),
    byteLength: Buffer.byteLength(text),
    resolvedPath: "/checkout/src/game.blend",
  };
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "block-index-alignment",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      sha256: createHash("sha256").update("{}").digest("hex"),
      byteLength: 2,
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source],
    inputSha256: source.sha256,
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: "c64-pal-prg-kernal-6581",
    effectiveEntry: "Game",
  };
  const analyzed = analyzeProject(snapshot);
  if (analyzed.kind !== "complete") throw new Error(JSON.stringify(analyzed.diagnostics));
  return buildSemanticProgram(analyzed);
}

/** Find one module object by source name in a completed semantic program. */
export function globalNamed(globals: readonly SemanticGlobal[], name: string): SemanticGlobal {
  const global = globals.find((item) => item.name === name);
  if (global === undefined) throw new Error(`Missing global ${name}`);
  return global;
}
/**
 * The one 64-byte run a sprite image occupies, which is what the chip fetches
 * when it receives a block number computed from an object's first byte.
 */
export const FIRST_SPRITE_BLOCK = [{ offset: 0, bytes: 64 }] as const;

/**
 * Resolve both demands one lowered program proved for a module object: the
 * alignment its address arithmetic needs, and the runs the video chip fetches.
 *
 * The two are read together because they are separate claims about the same
 * object. Alignment follows from the shape of the expression and holds whoever
 * receives the number; the fetched runs exist only where the chip provably
 * receives it, and they say which bytes must be reachable rather than
 * constraining the object as a whole.
 */
export function provedFor(source: string, name: string) {
  const lowered = lowerSource(source);
  expect(lowered.kind).toBe("complete");
  if (lowered.kind !== "complete") throw new Error("Expected a complete lowering");
  const global = globalNamed(lowered.program.globals, name);
  return {
    align: global.placement?.align ?? 1,
    fetched: global.vicFetch?.ranges ?? null,
  };
}

/** Read the same two demands off a global the pass has already returned. */
export function provedDemands(global: SemanticGlobal | undefined) {
  return {
    align: global?.placement?.align ?? 1,
    fetched: global?.vicFetch?.ranges ?? null,
  };
}
