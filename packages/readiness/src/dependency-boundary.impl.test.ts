import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = resolve(PACKAGE_ROOT, "src");

function isStringRecord(value: unknown): value is Readonly<Record<string, string>> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

describe("readiness package boundary", () => {
  it("should declare only validation-library runtime dependencies", async () => {
    const manifestValue: unknown = JSON.parse(
      await readFile(resolve(PACKAGE_ROOT, "package.json"), "utf8"),
    );
    if (
      typeof manifestValue !== "object" ||
      manifestValue === null ||
      Array.isArray(manifestValue)
    ) {
      throw new TypeError("Package manifest must be an object.");
    }
    const dependencies = Reflect.get(manifestValue, "dependencies");
    if (!isStringRecord(dependencies)) {
      throw new TypeError("Package dependencies must be a string map.");
    }

    expect(Object.keys(dependencies).sort()).toEqual(["ajv", "jsonc-parser"]);
  });

  it("should not import compiler or toolchain workspaces", async () => {
    const entries = await readdir(SOURCE_ROOT, { recursive: true, withFileTypes: true });
    const sourceFiles = entries
      .filter(
        (entry) =>
          entry.isFile() && extname(entry.name) === ".ts" && !entry.name.endsWith(".test.ts"),
      )
      .map((entry) => resolve(entry.parentPath, entry.name));
    const contents = await Promise.all(sourceFiles.map((path) => readFile(path, "utf8")));

    expect(contents.some((content) => content.includes('from "@blend65/'))).toBe(false);
    expect(contents.some((content) => content.includes("from '@blend65/"))).toBe(false);
  });
});
