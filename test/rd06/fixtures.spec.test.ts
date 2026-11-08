import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseFixtureManifest,
  validateFixtureTree,
  type FixtureManifest,
} from "./fixture-tools/manifest.js";

const fixturesRoot = join(process.cwd(), "test/rd06/fixtures");
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

/** Read the committed manifest as untrusted data. */
async function manifest(): Promise<FixtureManifest> {
  return parseFixtureManifest(
    JSON.parse(await readFile(join(fixturesRoot, "manifest.json"), "utf8")),
  );
}

/** Copy the committed fixture tree so a mutation cannot touch versioned bytes. */
async function fixtureCopy(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-rd06-fixtures-"));
  temporaryRoots.push(root);
  await cp(fixturesRoot, root, { recursive: true });
  return root;
}

describe("fixture manifest", () => {
  // Every committed media file has exactly one entry and every recorded digest matches.
  it("should validate every fixture entry and committed digest", async () => {
    const violations = await validateFixtureTree(fixturesRoot);
    expect(violations).toEqual([]);
  });

  // The public families are complete for the constructed formats used by later phases.
  it("should contain the complete public fixture families", async () => {
    const entries = (await manifest()).fixtures;
    expect(entries.filter(({ family }) => family === "raw")).toHaveLength(4);
    expect(entries.filter(({ family }) => family === "psid")).toHaveLength(8);
    expect(entries.filter(({ family }) => family === "koala")).toHaveLength(4);
    for (const entry of entries) {
      expect(entry.provenance.kind).toBe("constructed");
      expect(entry.license.disposition).toBe("redistributable");
      expect(entry.producer).toBeNull();
      expect(entry.producerVersion).toBeNull();
    }
  });

  // A changed byte invalidates the recorded digest instead of silently updating it.
  it("should report a hash mismatch with expected and actual digests", async () => {
    const root = await fixtureCopy();
    const entry = (await manifest()).fixtures.find(({ id }) => id === "raw-nonempty")!;
    const path = join(root, entry.path);
    const bytes = await readFile(path);
    bytes[0] = bytes[0]! ^ 0xff;
    await writeFile(path, bytes);
    const violations = await validateFixtureTree(root);
    expect(violations.some((line) => line.includes("Hash mismatch for raw-nonempty"))).toBe(true);
  });

  // A file without one manifest entry is a fixture-tree failure.
  it("should report an unlisted fixture file", async () => {
    const root = await fixtureCopy();
    await writeFile(join(root, "public/raw/unlisted.bin"), Buffer.from([1]));
    const violations = await validateFixtureTree(root);
    expect(violations).toContain("Unlisted fixture file: public/raw/unlisted.bin");
  });

  // Duplicate identities and repeated paths are rejected before any file is read.
  it("should reject duplicate ids and unsafe fixture paths", () => {
    const base = {
      id: "duplicate",
      family: "raw",
      path: "public/raw/one.bin",
      sha256: "0".repeat(64),
      provenance: {
        kind: "constructed",
        source: "test",
        sourceSha256: "0".repeat(64),
        author: "test",
        date: "2026-11-08",
      },
      producer: null,
      producerVersion: null,
      settings: {},
      license: { disposition: "redistributable", text: "test" },
      expected: { parse: "reject", selectors: {} },
      malformedOf: null,
      derivation: null,
    };
    expect(() => parseFixtureManifest({ schemaVersion: 1, fixtures: [base, { ...base }] })).toThrow(
      /unique/u,
    );
    expect(() =>
      parseFixtureManifest({
        schemaVersion: 1,
        fixtures: [{ ...base, id: "absolute", path: "/outside.bin" }],
      }),
    ).toThrow(/project-relative/u);
  });
});
