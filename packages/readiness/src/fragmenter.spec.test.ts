import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fragmentSource, INVENTORY_V1_LIMITS } from "./index.js";
import type { FragmentKind, FragmentationProfile } from "./index.js";

const PROFILE: FragmentationProfile = {
  profileId: "markdown-ebnf-v1",
  version: 1,
  contentHashAlgorithm: "sha256",
  newlinePolicy: "lf",
};

type ExpectedFragment = readonly [
  kind: FragmentKind,
  startByte: number,
  endByte: number,
  headingAncestry: readonly string[],
  contentHash: string,
  parentIndex?: number,
];

interface FragmentVector {
  readonly name: string;
  readonly path: string;
  readonly sourceBase64: string;
  readonly expected: readonly ExpectedFragment[];
}

interface FragmentVectorFile {
  readonly profileId: string;
  readonly profileVersion: number;
  readonly vectors: readonly FragmentVector[];
}

function loadVectors(): FragmentVectorFile {
  const path = fileURLToPath(
    new URL("../../../readiness/conformance/fragmentation-v1.json", import.meta.url),
  );
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("profileId" in parsed) ||
    !("profileVersion" in parsed) ||
    !("vectors" in parsed) ||
    !Array.isArray(parsed.vectors)
  ) {
    throw new TypeError("The fragmentation conformance file has an invalid root shape.");
  }

  return {
    profileId: String(parsed.profileId),
    profileVersion: Number(parsed.profileVersion),
    vectors: parsed.vectors.map(parseVector),
  };
}

function parseVector(value: unknown): FragmentVector {
  if (
    typeof value !== "object" ||
    value === null ||
    !("name" in value) ||
    !("path" in value) ||
    !("sourceBase64" in value) ||
    !("expected" in value) ||
    !Array.isArray(value.expected)
  ) {
    throw new TypeError("A fragmentation vector has an invalid shape.");
  }

  return {
    name: String(value.name),
    path: String(value.path),
    sourceBase64: String(value.sourceBase64),
    expected: value.expected.map(parseExpectedFragment),
  };
}

function parseExpectedFragment(value: unknown): ExpectedFragment {
  if (
    !Array.isArray(value) ||
    value.length < 5 ||
    value.length > 6 ||
    typeof value[0] !== "string" ||
    typeof value[1] !== "number" ||
    typeof value[2] !== "number" ||
    !Array.isArray(value[3]) ||
    !value[3].every((part) => typeof part === "string") ||
    typeof value[4] !== "string" ||
    (value[5] !== undefined && typeof value[5] !== "number")
  ) {
    throw new TypeError("A fragmentation expectation has an invalid tuple.");
  }
  if (!isFragmentKind(value[0])) {
    throw new TypeError(`Unknown fragment kind: ${value[0]}`);
  }

  return [value[0], value[1], value[2], value[3], value[4], value[5]];
}

function isFragmentKind(value: string): value is FragmentKind {
  return [
    "heading",
    "paragraph",
    "list-item",
    "table-row",
    "table-cell",
    "ebnf-fence",
    "ebnf-production",
    "residual",
  ].includes(value);
}

const VECTOR_FILE = loadVectors();

describe("byte-oriented source fragmentation", () => {
  // Every supported construct retains the exact raw span, ancestry, hierarchy, and independent hash.
  it.each(VECTOR_FILE.vectors)(
    "should match the independent $name vector byte for byte",
    (vector) => {
      const bytes = Uint8Array.from(Buffer.from(vector.sourceBase64, "base64"));
      const result = fragmentSource({ path: vector.path, bytes }, PROFILE, INVENTORY_V1_LIMITS);

      expect(result.ok).toBe(true);
      expect(result.diagnostics).toEqual([]);
      expect(result.fragments).toHaveLength(vector.expected.length);

      for (const [index, expected] of vector.expected.entries()) {
        const [kind, startByte, endByte, headingAncestry, contentHash, parentIndex] = expected;
        expect(result.fragments[index]).toEqual(
          expect.objectContaining({
            kind,
            startByte,
            endByte,
            headingAncestry,
            contentHash,
            displayLine: expect.any(Number),
            displayColumn: expect.any(Number),
          }),
        );
        expect(result.fragments[index]?.parentFragmentId).toBe(
          parentIndex === undefined ? undefined : result.fragments[parentIndex]?.fragmentId,
        );
      }
    },
  );

  // Identical source bytes always produce deeply identical ordered fragment trees.
  it("should return the same identities and metadata on repeated scans", () => {
    const vector = VECTOR_FILE.vectors[1];
    if (vector === undefined) {
      throw new TypeError("The deterministic table vector is missing.");
    }
    const bytes = Uint8Array.from(Buffer.from(vector.sourceBase64, "base64"));

    const first = fragmentSource({ path: vector.path, bytes }, PROFILE, INVENTORY_V1_LIMITS);
    const second = fragmentSource({ path: vector.path, bytes }, PROFILE, INVENTORY_V1_LIMITS);

    expect(second).toEqual(first);
  });

  // Changing one authoritative byte invalidates the independently recorded content hash.
  it("should expose a hash mismatch when one vector byte changes", () => {
    const vector = VECTOR_FILE.vectors[0];
    const expectedParagraph = vector?.expected[1];
    if (vector === undefined || expectedParagraph === undefined) {
      throw new TypeError("The paragraph mutation vector is missing.");
    }
    const bytes = Uint8Array.from(Buffer.from(vector.sourceBase64, "base64"));
    bytes[expectedParagraph[1]] ^= 1;

    const result = fragmentSource({ path: vector.path, bytes }, PROFILE, INVENTORY_V1_LIMITS);

    expect(result.fragments[1]?.contentHash).not.toBe(expectedParagraph[4]);
  });

  // Removing one complete derived span leaves the vector-backed ledger identity undisposed.
  it("should omit the deleted span rather than silently transferring its identity", () => {
    const vector = VECTOR_FILE.vectors[0];
    const deleted = vector?.expected[4];
    if (vector === undefined || deleted === undefined) {
      throw new TypeError("The residual deletion vector is missing.");
    }
    const original = Uint8Array.from(Buffer.from(vector.sourceBase64, "base64"));
    const bytes = new Uint8Array(original.length - (deleted[2] - deleted[1]));
    bytes.set(original.subarray(0, deleted[1]));
    bytes.set(original.subarray(deleted[2]), deleted[1]);

    const result = fragmentSource({ path: vector.path, bytes }, PROFILE, INVENTORY_V1_LIMITS);

    expect(result.fragments).not.toContainEqual(
      expect.objectContaining({
        kind: deleted[0],
        contentHash: deleted[4],
      }),
    );
  });
});
