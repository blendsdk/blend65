import { describe, expect, it } from "vitest";
import { parseManifest, validateProjectName } from "../index.js";

const invalidNames = [
  { name: "", reason: "empty", offending: null },
  { name: "\ud800", reason: "ill-formed-unicode", offending: "\ud800" },
  { name: "A\udfffB", reason: "ill-formed-unicode", offending: "\udfff" },
  ...["/", "\\", "<", ">", ":", '"', "|", "?", "*"].map((character) => ({
    name: `Game${character}Name`,
    reason: "forbidden-character",
    offending: character,
  })),
  ...Array.from({ length: 32 }, (_, point) => ({
    name: `Game${String.fromCharCode(point)}Name`,
    reason: "forbidden-character",
    offending: String.fromCharCode(point),
  })),
  { name: ".", reason: "dot-name", offending: "." },
  { name: "..", reason: "dot-name", offending: ".." },
  { name: "Game ", reason: "trailing-character", offending: " " },
  { name: "Game.", reason: "trailing-character", offending: "." },
  ...[
    "CON",
    "PRN",
    "AUX",
    "NUL",
    ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`),
    ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`),
    ...["¹", "²", "³"].flatMap((digit) => [`COM${digit}`, `LPT${digit}`]),
  ].flatMap((stem) => [
    { name: stem, reason: "reserved-device-stem", offending: stem },
    {
      name: `${stem.toLowerCase()}.map`,
      reason: "reserved-device-stem",
      offending: stem.toLowerCase(),
    },
  ]),
  { name: "NuL", reason: "reserved-device-stem", offending: "NuL" },
  { name: "NUL.txt", reason: "reserved-device-stem", offending: "NUL" },
  { name: "COM¹.map", reason: "reserved-device-stem", offending: "COM¹" },
] as const;

const validNames = [
  "CONSOLE",
  "COM0",
  "COM10",
  "LPT0",
  "LPT10",
  ".temp",
  "Game Ω 1.2",
  "Game 🎮",
  "MiXeD",
  "é",
  "e\u0301",
  " A B",
  "a..b",
  "NULish.txt",
  "ＣＯＮ",
  "a\u007fb",
  "A".repeat(5000),
];

/** Diagnostics expose a code point, never the unsafe literal control character or a rewritten name. */
function escapedOffending(offending: string | null): string {
  if (offending === null) return "";
  if ([...offending].length === 1)
    return `U+${offending.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
  return JSON.stringify(offending);
}

describe("literal primary artifact basenames", () => {
  // The output name rejects exactly the unsafe scalar, trailing, dot and device-stem classes.
  it.each(invalidNames)(
    "should reject $name with $reason and the original offending spelling",
    ({ name, reason, offending }) => {
      expect(validateProjectName(name)).toEqual({ kind: "failure", reason, offending });
    },
  );

  // Input spelling is literal: Unicode normalization, slugging and guessed length limits are forbidden.
  it.each(validNames)("should preserve the accepted name %s without rewriting", (name) => {
    expect(validateProjectName(name)).toEqual({ kind: "success" });
    const text = JSON.stringify({
      schemaVersion: 1,
      name,
      sourceRoot: "src",
      entry: "Foundation",
      target: "c64-pal-prg-kernal-6581",
      outDir: "build",
    });
    const result = parseManifest(text);
    expect(result.kind).toBe("success");
    if (result.kind !== "success")
      throw new Error("A valid literal name must produce a usable manifest");
    expect(result.manifest.name).toBe(name);
  });

  // The public diagnostic gives an exact reason and escaped offending point at the responsible field.
  it.each(invalidNames)(
    "should diagnose $name safely at the name field",
    ({ name, reason, offending }) => {
      const text = JSON.stringify({
        schemaVersion: 1,
        name,
        sourceRoot: "src",
        entry: "Foundation",
        target: "c64-pal-prg-kernal-6581",
        outDir: "build",
      });
      const result = parseManifest(text);
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure")
        throw new Error("An invalid name must not expose a usable manifest");
      expect(result).not.toHaveProperty("manifest");
      expect(result.diagnostics).toHaveLength(1);
      const token = JSON.stringify(name);
      const start = text.indexOf(token, text.indexOf('"name":') + '"name":'.length);
      expect(result.diagnostics[0]).toMatchObject({
        code: "PROJECT_INVALID_NAME",
        severity: "error",
        pointer: "/name",
        message: `Invalid project name: ${reason}${offending === null ? "" : ` ${escapedOffending(offending)}`}`,
        primarySpan: {
          sourceId: "blend65.json",
          start: Buffer.byteLength(text.slice(0, start)),
          end: Buffer.byteLength(text.slice(0, start + token.length)),
        },
      });
      expect(result.diagnostics[0]!.primarySpan).not.toBeNull();
    },
  );

  // More fundamental invalid input wins before a trailing or reserved-device interpretation.
  it.each([
    { name: "/\ud800", reason: "ill-formed-unicode", offending: "\ud800" },
    { name: "CON/", reason: "forbidden-character", offending: "/" },
    { name: "CON ", reason: "trailing-character", offending: " " },
    { name: "CON.", reason: "trailing-character", offending: "." },
  ])("should apply stable failure precedence to $name", ({ name, reason, offending }) => {
    expect(validateProjectName(name)).toEqual({ kind: "failure", reason, offending });
  });
});
