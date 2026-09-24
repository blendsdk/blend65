import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { coverageViolations, readNormativeSourceKeys } from "./normative-coverage-validator.js";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const identity = "BLEND65-SPEC-4-5c6bac04a56b91d7d55ff570fbbf0dde5f521e2edce8901279dfa39a32c7acfa";

/** Narrow a parsed JSON value before accessing its checked fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Read one fresh copy so malformed-row probes cannot mutate the checked record. */
async function fixture(): Promise<{
  readonly document: Record<string, unknown>;
  readonly keys: Awaited<ReturnType<typeof readNormativeSourceKeys>>;
}> {
  const parsed: unknown = JSON.parse(
    await readFile(join(repository, "test/rd04/normative-coverage.json"), "utf8"),
  );
  if (!isRecord(parsed)) throw new Error("Invalid fixture envelope");
  return { document: parsed, keys: await readNormativeSourceKeys(join(repository, "spec")) };
}

/** Replace one existing row without changing any other fixture item. */
function changedRow(
  document: Record<string, unknown>,
  replacement: Record<string, unknown>,
): Record<string, unknown> {
  if (!Array.isArray(document.entries)) throw new Error("Missing fixture rows");
  const entries: readonly unknown[] = document.entries;
  if (!entries.every(isRecord)) throw new Error("Invalid fixture rows");
  return {
    ...document,
    entries: entries.map((row, index) => (index === 0 ? { ...row, ...replacement } : row)),
  };
}

describe("completion record validation details", () => {
  it.each([
    ["kind", "invented", "Incorrect kind or source"],
    ["source", "wrong.md", "Incorrect kind or source"],
    ["owner", "", "Missing owner"],
    ["disposition", "done-ish", "Invalid disposition"],
    ["proof", [], "Invalid proof path"],
    ["proof", ["../outside"], "Invalid proof path"],
  ])("should reject malformed %s metadata", async (field, value, message) => {
    const { document, keys } = await fixture();
    const violations = coverageViolations(changedRow(document, { [field]: value }), keys, identity);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain(message);
  });

  it("should reject a row without a string key", async () => {
    const { document, keys } = await fixture();
    const violations = coverageViolations(changedRow(document, { key: null }), keys, identity);
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Entry 0"),
        expect.stringContaining("Missing coverage key"),
      ]),
    );
  });
});
