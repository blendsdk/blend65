import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { bindingIdentityKey } from "./semantic-types.js";
import { analyzeProject } from "./service.js";

const SELECTED_PROFILE = "c64-pal-prg-kernal-6581";

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function source(text: string): SourceRecord {
  return Object.freeze({
    sourceId: "src/game.blend",
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/src/game.blend",
  });
}

/** Build a compiler-loaded-shaped snapshot for profile integration checks. */
function snapshot(text: string, target = SELECTED_PROFILE): ProjectSnapshot {
  const manifestText = "{}";
  return Object.freeze({
    manifest: Object.freeze({
      schemaVersion: 1,
      name: "profile-implementation",
      sourceRoot: "src",
      entry: "Game",
      target,
      assetPaths: Object.freeze([]),
      outDir: "out",
      optimization: "none",
      boundsCheck: false,
      divisionZeroCheck: false,
    }),
    manifestSource: Object.freeze({
      sourceId: "blend65.json",
      text: manifestText,
      sha256: hash(manifestText),
      byteLength: Buffer.byteLength(manifestText),
      resolvedPath: "/checkout/blend65.json",
    }),
    sources: Object.freeze([source(text)]),
    inputSha256: hash(text),
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: Object.freeze([]),
    outDir: "/checkout/out",
    overrides: Object.freeze({ target: null, entry: null }),
    effectiveTarget: target,
    effectiveEntry: "Game",
  });
}

describe("frontend profile integration", () => {
  it("propagates ordered and volatile profile effects through ordinary callers", () => {
    const text = [
      "module Game;",
      "function io(): void {",
      "  c64.video.waitNextFrame();",
      "  let sample: byte = c64.input.readJoystick2();",
      "  c64.vic.setBorderColor(sample);",
      "}",
      "function main(): void { io(); }",
    ].join("\n");

    const result = analyzeProject(snapshot(text));

    if (result.kind !== "complete") throw new Error(JSON.stringify(result));
    for (const name of ["Game.io", "Game.main"]) {
      const binding = result.program.bindings.find(({ qualifiedName }) => qualifiedName === name);
      expect(binding, `Missing ${name}`).toBeDefined();
      const summary = result.program.effects.find(
        ({ function: functionId }) =>
          binding !== undefined &&
          bindingIdentityKey(functionId) === bindingIdentityKey(binding.id),
      );
      expect(summary?.operationEffects).toEqual([
        "ordered-wait",
        "volatile-read",
        "volatile-write",
      ]);
      expect(summary?.opaque).toBe(true);
    }
  });

  it("rejects a schema-valid profile without a declaration environment", () => {
    const result = analyzeProject(
      snapshot("module Game; function main(): void {}", "c64-pal-prg-kernal-8580"),
    );

    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error(`Expected error, got ${result.kind}`);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10279"]);
  });
});
