import { describe, expect, it } from "vitest";
import { parseManifest } from "../index.js";

const validText = JSON.stringify({
  schemaVersion: 1,
  name: "Game",
  sourceRoot: "src",
  entry: "Foundation",
  target: "c64-pal-prg-kernal-6581",
  outDir: "build",
});

describe("manifest diagnostic integrity", () => {
  // Recovery values from malformed JSONC are never exposed as usable configuration.
  it.each(["{", '{"name": }', "{} garbage", '{"name":"Game",,}'])(
    "should fail malformed syntax without dependent schema errors: %s",
    (text) => {
      const result = parseManifest(text);
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure")
        throw new Error("Malformed syntax must fail the complete parse");
      expect(result).not.toHaveProperty("manifest");
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(
        result.diagnostics.every(
          (diagnostic) =>
            diagnostic.code === "PROJECT_MANIFEST_SYNTAX" && diagnostic.severity === "error",
        ),
      ).toBe(true);
    },
  );

  // An unusable root suppresses field checks rather than fabricating ten missing-field cascades.
  it.each(["null", "true", "1", '"Game"', "[]"])(
    "should reject a non-object root %s with one root diagnostic",
    (text) => {
      const result = parseManifest(text);
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") throw new Error("Only a JSONC object defines a project");
      expect(result).not.toHaveProperty("manifest");
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "PROJECT_MANIFEST_FIELD",
        severity: "error",
        pointer: "",
        primarySpan: { sourceId: "blend65.json", start: 0, end: Buffer.byteLength(text) },
      });
    },
  );

  // Duplicate keys point to the later complete key token and relate the first, even if unknown.
  it.each(["name", "unknown"])(
    "should diagnose a duplicated %s key before value extraction",
    (key) => {
      const prefix =
        key === "name" ? validText.slice(0, -1) : `${validText.slice(0, -1)},"unknown":0`;
      const text = `${prefix},"${key}":"replacement"}`;
      const token = JSON.stringify(key);
      const first = text.indexOf(token);
      const second = text.lastIndexOf(token);
      const result = parseManifest(text, "project Ω/blend65.json");
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure")
        throw new Error("Duplicate keys must fail instead of choosing a value");
      const duplicate = result.diagnostics.find(
        (diagnostic) => diagnostic.code === "PROJECT_DUPLICATE_KEY",
      );
      expect(duplicate).toMatchObject({
        code: "PROJECT_DUPLICATE_KEY",
        severity: "error",
        message: `Duplicate project key '${key}'`,
        primarySpan: {
          sourceId: "project Ω/blend65.json",
          start: Buffer.byteLength(text.slice(0, second)),
          end: Buffer.byteLength(text.slice(0, second + token.length)),
        },
      });
      expect(duplicate!.related).toHaveLength(1);
      expect(duplicate!.related[0]!.span).toEqual({
        sourceId: "project Ω/blend65.json",
        start: Buffer.byteLength(text.slice(0, first)),
        end: Buffer.byteLength(text.slice(0, first + token.length)),
      });
      expect(result).not.toHaveProperty("manifest");
    },
  );

  // BOM and Unicode preceding a bad value remain raw UTF-8 bytes, not JavaScript indexes.
  it.each(["", "\ufeff"])(
    "should preserve byte spans after a %s BOM prefix and multibyte comment",
    (bom) => {
      const text = `${bom}/* ASCII é 🎮 */${validText.replace('"Game"', '"Bad/Name"')}`;
      const token = '"Bad/Name"';
      const start = text.indexOf(token);
      const result = parseManifest(text, "manifest.jsonc");
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure")
        throw new Error("The forbidden separator must produce a name diagnostic");
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "PROJECT_INVALID_NAME",
        pointer: "/name",
        primarySpan: {
          sourceId: "manifest.jsonc",
          start: Buffer.byteLength(text.slice(0, start)),
          end: Buffer.byteLength(text.slice(0, start + token.length)),
        },
        message: "Invalid project name: forbidden-character U+002F",
      });
    },
  );

  // Literal ill-formed JavaScript text is not implicitly repaired by UTF-8 replacement encoding.
  it.each(["\ud800", "\udfff"])("should reject literal unpaired surrogate text %s", (surrogate) => {
    const text = `${validText}/*${surrogate}*/`;
    const result = parseManifest(text);
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure")
      throw new Error("Ill-formed text must not be silently re-encoded");
    expect(result).not.toHaveProperty("manifest");
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "PROJECT_INVALID_UTF8",
      severity: "error",
      message: "Input 'blend65.json' is not valid UTF-8",
    });
  });

  // Deep hostile input below the byte limit becomes a typed root syntax error, not a stack exception.
  it("should contain parser stack exhaustion for ten thousand nested arrays", () => {
    const text = `{"unknown":${"[".repeat(10000)}0${"]".repeat(10000)}}`;
    expect(Buffer.byteLength(text)).toBe(20013);
    const result = parseManifest(text);
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure")
      throw new Error("Parser exhaustion must fail without a recovered manifest");
    expect(result).not.toHaveProperty("manifest");
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "PROJECT_MANIFEST_SYNTAX",
      severity: "error",
      message: "Invalid JSONC at 0: nesting exceeds parser capacity",
      primarySpan: { sourceId: "blend65.json", start: 0, end: 20013 },
    });
  });

  // The standalone pure entry observes the raw byte limit, including multibyte comment content.
  it("should accept the exact manifest byte maximum and reject its first excess", () => {
    const maximum = 1048576;
    const exact = `${validText}/*${"x".repeat(maximum - Buffer.byteLength(validText) - 4)}*/`;
    expect(Buffer.byteLength(exact)).toBe(maximum);
    expect(parseManifest(exact).kind).toBe("success");
    const excess = exact.replace("x*/", "é*/");
    const result = parseManifest(excess);
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Over-limit input must fail before parsing it");
    expect(result).not.toHaveProperty("manifest");
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "PROJECT_HOST_LIMIT",
      severity: "error",
      message: "Project host limit 'manifestBytes' exceeded: maximum 1048576, observed 1048577",
    });
  });

  // Independent malformed fields remain ordered by their proving byte spans and retain structured help.
  it("should return deterministic independent field diagnostics without partial configuration or host stacks", () => {
    const text = validText
      .replace('"schemaVersion":1', '"schemaVersion":2')
      .replace('"entry":"Foundation"', '"entry":false')
      .replace('"outDir":"build"', '"outDir":false');
    const first = parseManifest(text);
    expect(first.kind).toBe("failure");
    if (first.kind !== "failure") throw new Error("Independent invalid fields must fail the parse");
    expect(first.diagnostics.map((diagnostic) => diagnostic.pointer)).toEqual([
      "/schemaVersion",
      "/entry",
      "/outDir",
    ]);
    for (const diagnostic of first.diagnostics) {
      expect(diagnostic).toMatchObject({
        code: "PROJECT_MANIFEST_FIELD",
        severity: "error",
        primarySpan: { sourceId: "blend65.json" },
        related: [],
      });
      expect(diagnostic).toHaveProperty("help");
      expect(diagnostic.message).not.toMatch(/\bat .*\([^\n]*:\d+:\d+\)|(?:Error|RangeError):/);
    }
    expect(parseManifest(text)).toEqual(first);
    expect(first).not.toHaveProperty("manifest");
  });
});
