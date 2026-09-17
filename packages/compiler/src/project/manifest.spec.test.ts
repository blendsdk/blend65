import { describe, expect, it } from "vitest";
import { parseManifest } from "../index.js";

const manifest = {
  schemaVersion: 1,
  name: "Game Ω 1.2",
  sourceRoot: "src",
  entry: "Foundation",
  target: "c64-pal-prg-kernal-6581",
  outDir: "build",
};
const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-pal-prg-takeover-6581",
  "c64-pal-prg-takeover-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
  "c64-ntsc-prg-takeover-6581",
  "c64-ntsc-prg-takeover-8580",
  "c64-pal-d64-kernal-6581",
] as const;
const stringFields = ["name", "sourceRoot", "entry", "target", "outDir"] as const;
const wrongTypes = [
  ...stringFields.flatMap((key) => [null, false, 1, [], {}].map((value) => ({ key, value }))),
  ...[null, false, "1", [], {}].map((value) => ({ key: "schemaVersion", value })),
  ...[null, false, 1, "assets", {}].map((value) => ({ key: "assetPaths", value })),
  ...[null, false, 1, [], {}].map((value) => ({ key: "optimization", value })),
  ...["boundsCheck", "divisionZeroCheck"].flatMap((key) =>
    [null, "false", 0, [], {}].map((value) => ({ key, value })),
  ),
];

describe("declarative project manifests", () => {
  // Comments and trailing commas are accepted without changing the ten public values.
  it("should load all public JSONC fields exactly", () => {
    const text = `{
      // The name controls a literal artifact basename.
      "schemaVersion": 1, "name": "Game Ω 1.2", "sourceRoot": "src", "entry": "Game.Render",
      "target": "c64-pal-prg-kernal-6581", "assetPaths": ["assets", "music",], "outDir": "build/new",
      "optimization": "speed", "boundsCheck": true, "divisionZeroCheck": true,
    }`;
    expect(parseManifest(text)).toEqual({
      kind: "success",
      manifest: {
        schemaVersion: 1,
        name: "Game Ω 1.2",
        sourceRoot: "src",
        entry: "Game.Render",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: ["assets", "music"],
        outDir: "build/new",
        optimization: "speed",
        boundsCheck: true,
        divisionZeroCheck: true,
      },
    });
  });

  // Optional values have one fixed default; no second configuration model is inferred.
  it("should supply exact defaults for omitted optional fields", () => {
    expect(parseManifest(JSON.stringify(manifest))).toEqual({
      kind: "success",
      manifest: {
        ...manifest,
        assetPaths: [],
        optimization: "balanced",
        boundsCheck: false,
        divisionZeroCheck: false,
      },
    });
  });

  // Every required key fails independently rather than producing a usable partial manifest.
  it.each(Object.keys(manifest))("should reject the missing required key %s", (key) => {
    const value = Object.fromEntries(Object.entries(manifest).filter(([field]) => field !== key));
    const text = JSON.stringify(value);
    const result = parseManifest(text);
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Missing fields must fail the complete parse");
    expect(result).not.toHaveProperty("manifest");
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "PROJECT_MANIFEST_FIELD",
      severity: "error",
      pointer: `/${key}`,
      primarySpan: { sourceId: "blend65.json", start: 0, end: Buffer.byteLength(text) },
    });
  });

  // JSON types are not coerced, including textual false and numerical safety values.
  it.each(wrongTypes)("should reject the wrong JSON type for $key: $value", ({ key, value }) => {
    const result = parseManifest(JSON.stringify({ ...manifest, [key]: value }));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Wrong field types must not be coerced");
    expect(result).not.toHaveProperty("manifest");
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "PROJECT_MANIFEST_FIELD",
      severity: "error",
      pointer: `/${key}`,
    });
  });

  // An asset search list contains strings only, retaining its order and exact accepted spelling.
  it.each([["assets", 1], [null], [false], [[]], [{}]].map((assetPaths) => ({ assetPaths })))(
    "should reject a non-string asset path list $assetPaths",
    ({ assetPaths }) => {
      const result = parseManifest(JSON.stringify({ ...manifest, assetPaths }));
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") throw new Error("Invalid asset path elements must fail");
      expect(
        result.diagnostics.some((diagnostic) => diagnostic.code === "PROJECT_MANIFEST_FIELD"),
      ).toBe(true);
    },
  );

  // Unsupported schema versions cannot silently select a different interpretation.
  it.each([0, 2, -1, 1.5])("should reject unsupported schema version %s", (schemaVersion) => {
    const result = parseManifest(JSON.stringify({ ...manifest, schemaVersion }));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Unsupported schema versions must fail");
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "PROJECT_MANIFEST_FIELD",
      pointer: "/schemaVersion",
    });
  });

  // Optimization is a closed enum, not a plugin name or a case-insensitive preference.
  it.each(["none", "balanced", "speed", "size"])(
    "should accept optimization %s exactly",
    (optimization) => {
      const result = parseManifest(JSON.stringify({ ...manifest, optimization }));
      expect(result.kind).toBe("success");
      if (result.kind !== "success")
        throw new Error("A declared optimization value must be accepted");
      expect(result.manifest.optimization).toBe(optimization);
    },
  );
  it.each(["fast", "SPEED", "", "debug"])(
    "should reject unknown optimization %s",
    (optimization) => {
      const result = parseManifest(JSON.stringify({ ...manifest, optimization }));
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") throw new Error("Unknown optimization values must fail");
      expect(result.diagnostics[0]).toMatchObject({
        code: "PROJECT_MANIFEST_FIELD",
        pointer: "/optimization",
      });
    },
  );

  // Executable configuration, source lists, tools and extension maps cannot enter the public model.
  it.each([
    "unknown",
    "scripts",
    "hooks",
    "plugins",
    "packages",
    "environment",
    "acme",
    "vice",
    "tools",
    "sourceGlobs",
    "sources",
    "files",
    "extensions",
    "variants",
    "video",
    "sid",
  ])("should reject undeclared manifest key %s", (key) => {
    const result = parseManifest(JSON.stringify({ ...manifest, [key]: "untrusted" }));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Unknown fields cannot become extensions");
    expect(result).not.toHaveProperty("manifest");
    expect(result.diagnostics[0]).toMatchObject({
      code: "PROJECT_MANIFEST_FIELD",
      pointer: `/${key}`,
    });
  });

  // Target identity accepts every complete qualified profile, independently of later lowering.
  it.each(profiles)("should accept exact target profile %s", (target) => {
    const result = parseManifest(JSON.stringify({ ...manifest, target }));
    expect(result.kind).toBe("success");
    if (result.kind !== "success")
      throw new Error("Every qualified configuration identity must load");
    expect(result.manifest.target).toBe(target);
  });
  // Invalid profile IDs use the canonical compiler diagnostic rather than a competing host identifier.
  it.each([
    "c64u",
    "cx16",
    "a800xl",
    "a7800",
    "c64-pal",
    "c64u-pal",
    "c64-pal-d64-kernal-8580",
    "c64-ntsc-d64-kernal-6581",
    "C64-PAL-PRG-KERNAL-6581",
    "",
    "unknown",
  ])("should reject unqualified target %s with the exact public diagnostic", (target) => {
    const result = parseManifest(JSON.stringify({ ...manifest, target }));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Invalid targets must fail before lowering");
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "E10279",
      severity: "error",
      pointer: "/target",
      message: `Target profile '${target}' is not a complete qualified profile ID — choose one of: ${profiles.join(", ")}`,
    });
  });

  // Entry identity is an ASCII qualified module name, never a source filename.
  it.each([
    "Foundation",
    "Game.Render",
    "_Game.render_2",
    "game",
    "GAME",
    "as",
    "Game" + "A".repeat(5000),
  ])("should accept qualified module entry %s", (entry) => {
    const result = parseManifest(JSON.stringify({ ...manifest, entry }));
    expect(result.kind).toBe("success");
    if (result.kind !== "success")
      throw new Error("A legal qualified module name must be accepted");
    expect(result.manifest.entry).toBe(entry);
  });
  it.each([
    "src/main.blend",
    "",
    "1Game",
    "Game..Render",
    ".Game",
    "Game.",
    "Game-Render",
    "Game Render",
    "Gáme",
    "module",
    "Game.true",
    "peek",
  ])("should reject invalid module entry %s", (entry) => {
    const result = parseManifest(JSON.stringify({ ...manifest, entry }));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Invalid entries must not be treated as paths");
    expect(result.diagnostics[0]).toMatchObject({
      code: "PROJECT_MANIFEST_FIELD",
      pointer: "/entry",
    });
  });
});
