import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseFixtureManifest, validateFixtureTree } from "./fixture-tools/manifest.js";

const fixturesRoot = join(process.cwd(), "test/rd06/fixtures");
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

/** Copy the committed fixture tree for one mutation. */
async function copy(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-rd06-fixtures-impl-"));
  temporaryRoots.push(root);
  await cp(fixturesRoot, root, { recursive: true });
  return root;
}

describe("fixture manifest internals", () => {
  // A hash mismatch names the fixture and both digests.
  it("should report a changed fixture digest", async () => {
    const root = await copy();
    const manifest = parseFixtureManifest(
      JSON.parse(await readFile(join(root, "manifest.json"), "utf8")),
    );
    const entry = manifest.fixtures.find(({ id }) => id === "raw-nonempty")!;
    const path = join(root, entry.path);
    const bytes = await readFile(path);
    bytes[0] = bytes[0]! ^ 0xff;
    await writeFile(path, bytes);
    const violations = await validateFixtureTree(root);
    expect(violations.some((line) => line.startsWith("Hash mismatch for raw-nonempty"))).toBe(true);
  });

  // An unlisted file is a tree failure.
  it("should report an unlisted file", async () => {
    const root = await copy();
    await writeFile(join(root, "public/raw/extra.bin"), Buffer.from([1]));
    expect(await validateFixtureTree(root)).toContain(
      "Unlisted fixture file: public/raw/extra.bin",
    );
  });

  // Duplicate ids and paths are rejected before any read.
  it("should reject duplicate ids and paths", () => {
    const base = {
      id: "one",
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
    expect(() =>
      parseFixtureManifest({
        schemaVersion: 1,
        fixtures: [base, { ...base, path: "public/raw/two.bin" }],
      }),
    ).toThrow(/unique/u);
    expect(() =>
      parseFixtureManifest({ schemaVersion: 1, fixtures: [base, { ...base, id: "two" }] }),
    ).toThrow(/recorded more than once/u);
  });
});
