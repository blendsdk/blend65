import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const specRoot = join(repository, "spec");
const coveragePath = join(import.meta.dirname, "normative-coverage.json");
const identity = "BLEND65-SPEC-4-5c6bac04a56b91d7d55ff570fbbf0dde5f521e2edce8901279dfa39a32c7acfa";

/** Keep fixture edits separate from the checked-in completion record. */
async function coverageDocument(): Promise<Record<string, unknown>> {
  const text = await readFile(coveragePath, "utf8");
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error("The completion record must be an object");
  return parsed;
}

/** Narrow only enough to alter one test copy; the validator owns full row validation. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Reject a broken fixture instead of silently giving a malformed-row test a false pass. */
function entriesOf(document: unknown): readonly Record<string, unknown>[] {
  if (!isRecord(document) || !Array.isArray(document.entries))
    throw new Error("The completion record must contain entries");
  const entries: readonly unknown[] = document.entries;
  if (!entries.every(isRecord)) throw new Error("The completion rows must be objects");
  return entries;
}

describe("frozen language coverage", () => {
  // The printed grammar index and active diagnostic tables set fixed, reviewable boundaries.
  it("should extract only named normative source keys", async () => {
    const { readNormativeSourceKeys } = await import("./normative-coverage-validator.js");
    const keys = await readNormativeSourceKeys(specRoot);
    const names = keys.map(({ key }) => key);

    expect(new Set(names).size).toBe(names.length);
    expect(keys.filter(({ kind }) => kind === "grammar")).toHaveLength(106);
    expect(keys.filter(({ kind }) => kind === "semantic-rule")).toHaveLength(102);
    expect(keys.filter(({ kind }) => kind === "diagnostic")).toHaveLength(182);
    expect(keys.filter(({ kind }) => kind === "conformance")).toHaveLength(5);
    expect(keys).toContainEqual(
      expect.objectContaining({
        key: "grammar:conditional_expr",
        kind: "grammar",
      }),
    );
    expect(keys).toContainEqual(
      expect.objectContaining({
        key: "rule:03-variables.md#VAR-7",
        kind: "semantic-rule",
      }),
    );
    expect(keys).toContainEqual(
      expect.objectContaining({
        key: "diagnostic:E10130",
        kind: "diagnostic",
      }),
    );
    expect(keys).toContainEqual(
      expect.objectContaining({
        key: "conformance:15-platform-profile.md#5.5",
        kind: "conformance",
      }),
    );
    expect(names).not.toContain("diagnostic:E10101");
    expect(names).not.toContain("diagnostic:E10093");
    expect(names).not.toContain("rule:01-lexical-structure.md#UTF-8");
  });

  // The one checked record must cover every named obligation and carry the frozen corpus identity.
  it("should match the complete source-key set with no coverage violations", async () => {
    const { readNormativeSourceKeys, coverageViolations } =
      await import("./normative-coverage-validator.js");
    const document = await coverageDocument();
    const keys = await readNormativeSourceKeys(specRoot);
    expect(coverageViolations(document, keys, identity)).toEqual([]);
    expect(entriesOf(document)).toHaveLength(keys.length);
  });

  // A single removed grammar row must name that exact production, not a generic count mismatch.
  it("should identify the one missing grammar production in an otherwise valid copy", async () => {
    const { readNormativeSourceKeys, coverageViolations } =
      await import("./normative-coverage-validator.js");
    const document = await coverageDocument();
    const keys = await readNormativeSourceKeys(specRoot);
    const missing = "grammar:conditional_expr";
    const entries = entriesOf(document).filter((entry) => entry.key !== missing);
    expect(entries).toHaveLength(keys.length - 1);
    const edited = { ...document, entries };
    const violations = coverageViolations(edited, keys, identity);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain(missing);
  });

  // Duplicate and invented rows cannot make an incomplete ledger appear complete.
  it("should reject duplicate and unknown coverage keys", async () => {
    const { readNormativeSourceKeys, coverageViolations } =
      await import("./normative-coverage-validator.js");
    const document = await coverageDocument();
    const keys = await readNormativeSourceKeys(specRoot);
    const entries = entriesOf(document);
    const original = entries.find((entry) => entry.key === "grammar:conditional_expr");
    if (original === undefined) throw new Error("Missing grammar fixture row");
    const duplicate = coverageViolations(
      { ...document, entries: [...entries, original] },
      keys,
      identity,
    );
    expect(duplicate.some((message) => message.includes("grammar:conditional_expr"))).toBe(true);
    const unknown = coverageViolations(
      { ...document, entries: [...entries, { ...original, key: "grammar:invented" }] },
      keys,
      identity,
    );
    expect(unknown.some((message) => message.includes("grammar:invented"))).toBe(true);
  });

  // A different corpus identity invalidates even a row-complete ledger.
  it("should reject a wrong specification identity", async () => {
    const { readNormativeSourceKeys, coverageViolations } =
      await import("./normative-coverage-validator.js");
    const document = await coverageDocument();
    const keys = await readNormativeSourceKeys(specRoot);
    const violations = coverageViolations(
      { ...document, specificationIdentity: "BLEND65-SPEC-4-wrong" },
      keys,
      identity,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.toLowerCase()).toContain("identity");
  });
});
