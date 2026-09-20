import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "./service.js";
import { selectFrontendProfile } from "./profile.js";

const PROFILE_ID = "c64-pal-prg-kernal-6581";

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function source(text: string): SourceRecord {
  return {
    sourceId: "src/game.blend",
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/src/game.blend",
  };
}

/** Build the immutable frontend input selected by the profile under test. */
function snapshot(text: string): ProjectSnapshot {
  const manifestText = "{}";
  return {
    manifest: {
      schemaVersion: 1,
      name: "profile-spec",
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
      text: manifestText,
      sha256: hash(manifestText),
      byteLength: Buffer.byteLength(manifestText, "utf8"),
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source(text)],
    inputSha256: hash(text),
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: PROFILE_ID,
    effectiveEntry: "Game",
  };
}

/** Reduce semantic types to their source-language spelling for exact signature comparisons. */
function typeName(type: { readonly kind: string; readonly name?: string }): string {
  return type.kind === "scalar" ? (type.name ?? "<missing>") : type.kind;
}

describe("selected frontend profile", () => {
  // The frontend sees only typed source operations and their language-level effects.
  it("exposes the complete source declaration environment in stable name order", () => {
    const result = selectFrontendProfile(PROFILE_ID);

    expect(result.kind).toBe("complete");
    expect(result).not.toHaveProperty("diagnostics");
    if (result.kind !== "complete") throw new Error("Expected the selected profile");
    expect(result.profile.id).toBe(PROFILE_ID);
    expect(
      result.profile.capabilities.map(({ name, parameters, returnType, effect }) => ({
        name,
        parameters: parameters.map(typeName),
        returnType: typeName(returnType),
        effect,
      })),
    ).toEqual([
      {
        name: "c64.input.joystickFire",
        parameters: ["byte"],
        returnType: "boolean",
        effect: "pure",
      },
      {
        name: "c64.input.joystickLeft",
        parameters: ["byte"],
        returnType: "boolean",
        effect: "pure",
      },
      {
        name: "c64.input.joystickRight",
        parameters: ["byte"],
        returnType: "boolean",
        effect: "pure",
      },
      {
        name: "c64.input.readJoystick2",
        parameters: [],
        returnType: "byte",
        effect: "volatile-read",
      },
      {
        name: "c64.vic.setBorderColor",
        parameters: ["byte"],
        returnType: "void",
        effect: "volatile-write",
      },
      {
        name: "c64.vic.setSpriteColor",
        parameters: ["byte", "byte"],
        returnType: "void",
        effect: "volatile-write",
      },
      {
        name: "c64.vic.setSpriteEnabled",
        parameters: ["byte", "boolean"],
        returnType: "void",
        effect: "volatile-write",
      },
      {
        name: "c64.vic.setSpritePointer",
        parameters: ["byte", "byte"],
        returnType: "void",
        effect: "volatile-write",
      },
      {
        name: "c64.vic.setSpritePosition",
        parameters: ["byte", "word", "byte"],
        returnType: "void",
        effect: "volatile-write",
      },
      {
        name: "c64.vic.vicSpriteBlock",
        parameters: ["word"],
        returnType: "byte",
        effect: "pure",
      },
      {
        name: "c64.video.waitNextFrame",
        parameters: [],
        returnType: "void",
        effect: "ordered-wait",
      },
    ]);
  });

  // A selected profile resolves every game-facing call before the typed program is complete.
  it("types every selected profile call and retains the selected declaration environment", () => {
    const text = [
      "module Game;",
      "function useProfile(spriteAddress: word): byte {",
      "  c64.video.waitNextFrame();",
      "  let sample: byte = c64.input.readJoystick2();",
      "  let left: boolean = c64.input.joystickLeft(sample);",
      "  let right: boolean = c64.input.joystickRight(sample);",
      "  let fire: boolean = c64.input.joystickFire(sample);",
      "  c64.vic.setSpriteEnabled(0, left || right || fire);",
      "  c64.vic.setSpritePosition(0, 0, 0);",
      "  c64.vic.setSpritePointer(0, 0);",
      "  c64.vic.setSpriteColor(0, 0);",
      "  c64.vic.setBorderColor(0);",
      "  return c64.vic.vicSpriteBlock(spriteAddress);",
      "}",
      "function main(): void { useProfile(0); }",
    ].join("\n");
    const result = analyzeProject(snapshot(text));

    expect(result.kind).toBe("complete");
    expect(result.diagnostics).toEqual([]);
    if (result.kind !== "complete") throw new Error(`Expected complete, got ${result.kind}`);
    const selected = selectFrontendProfile(PROFILE_ID);
    expect(selected.kind).toBe("complete");
    if (selected.kind !== "complete") throw new Error("Expected the selected profile");
    expect(result.program.profile).toEqual(selected.profile);
    expect(result.program.calls).toHaveLength(12);
  });

  // An unknown selection is terminal and cannot silently acquire another environment.
  it("rejects an unknown profile without a fallback profile", () => {
    const result = selectFrontendProfile("c64");

    expect(result.kind).toBe("error");
    expect(result).not.toHaveProperty("profile");
    if (result.kind !== "error") throw new Error("Expected an unknown-profile error");
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10279"]);
  });
});
