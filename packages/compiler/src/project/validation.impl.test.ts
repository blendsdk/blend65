import { describe, expect, it } from "vitest";
import { validateProjectName } from "./basename.js";
import { parseManifest } from "./manifest.js";
import { firstUnpairedSurrogate, utf16ByteBounds } from "./positions.js";

const valid = {
  schemaVersion: 1,
  name: "Game",
  sourceRoot: "src",
  entry: "Game",
  target: "c64-pal-prg-kernal-6581",
  outDir: "build",
};

describe("Unicode and JSONC validation internals", () => {
  it("should distinguish paired scalars from each lone-surrogate position", () => {
    expect(firstUnpairedSurrogate("🎮")).toBeNull();
    expect(firstUnpairedSurrogate("a\ud800")).toBe("\ud800");
    expect(firstUnpairedSurrogate("\udc00a")).toBe("\udc00");
    expect(firstUnpairedSurrogate("🎮\ud800a")).toBe("\ud800");
  });

  it("should widen recovery bounds for either half of an astral scalar", () => {
    const bounds = utf16ByteBounds("Aé🎮Z");
    expect([...bounds.starts]).toEqual([0, 1, 3, 3, 7, 8]);
    expect([...bounds.ends]).toEqual([0, 1, 3, 7, 7, 8]);
  });

  it("should keep first-predicate priority when several basename predicates fail", () => {
    expect(validateProjectName("\ud800/")).toMatchObject({ reason: "ill-formed-unicode" });
    expect(validateProjectName("NUL/ ")).toMatchObject({ reason: "forbidden-character" });
    expect(validateProjectName("NUL.")).toMatchObject({ reason: "trailing-character" });
    expect(validateProjectName("..")).toMatchObject({ reason: "dot-name" });
  });

  it("should reject prototype-shaped unknown keys without changing object prototypes", () => {
    const result = parseManifest(
      JSON.stringify(valid).slice(0, -1) + ',"__proto__":{"polluted":true}}',
    );
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Unknown fields must fail");
    expect(result.diagnostics[0]?.pointer).toBe("/__proto__");
    expect({}).not.toHaveProperty("polluted");
  });

  it("should find nested duplicate keys even inside a rejected unknown object", () => {
    const result = parseManifest(JSON.stringify(valid).slice(0, -1) + ',"unknown":{"x":0,"x":1}}');
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Unknown data cannot become configuration");
    expect(result.diagnostics.some((item) => item.code === "PROJECT_DUPLICATE_KEY")).toBe(true);
  });

  it("should walk a wide hostile array without overflowing a function argument stack", () => {
    const text = '{"unknown":[' + "0,".repeat(140000) + "0]}";
    const result = parseManifest(text);
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Unknown fields must fail");
    expect(result.diagnostics.map((item) => item.code)).toContain("PROJECT_MANIFEST_FIELD");
  });

  it("should freeze accepted defaults and complete failure records", () => {
    const accepted = parseManifest(JSON.stringify(valid));
    expect(accepted.kind).toBe("success");
    if (accepted.kind !== "success") throw new Error("Valid values must pass");
    expect(Object.isFrozen(accepted)).toBe(true);
    expect(Object.isFrozen(accepted.manifest)).toBe(true);
    expect(Object.isFrozen(accepted.manifest.assetPaths)).toBe(true);
    const rejected = parseManifest('{"name":false}');
    expect(rejected.kind).toBe("failure");
    if (rejected.kind !== "failure") throw new Error("Missing fields must fail");
    expect(Object.isFrozen(rejected)).toBe(true);
    expect(Object.isFrozen(rejected.diagnostics)).toBe(true);
    expect(rejected.diagnostics.every((item) => Object.isFrozen(item))).toBe(true);
  });
});
