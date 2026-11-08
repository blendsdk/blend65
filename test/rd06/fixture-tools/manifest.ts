import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

/** One expected fixed-array selector output. */
export interface FixtureArrayExpectation {
  readonly type: "byte[]";
  readonly length: number;
  readonly sha256: string;
}

/** One expected scalar selector output. */
export interface FixtureScalarExpectation {
  readonly type: "byte" | "word";
  readonly value: number;
}

/** Accepted value expectation for one selector. */
export type FixtureSelectorExpectation = FixtureArrayExpectation | FixtureScalarExpectation;

/** Closed expectation record for one accepted fixture. */
export interface FixtureExpectation {
  readonly parse: "accept" | "reject";
  readonly selectors: Readonly<Record<string, FixtureSelectorExpectation>>;
}

/** One committed fixture entry. */
export interface FixtureEntry {
  readonly id: string;
  readonly family: "raw" | "psid" | "koala" | "spritepad" | "charpad";
  readonly path: string;
  readonly sha256: string;
  readonly provenance: {
    readonly kind: "constructed" | "producer-save";
    readonly source: string;
    readonly sourceSha256: string;
    readonly author: string;
    readonly date: string;
  };
  readonly producer: string | null;
  readonly producerVersion: string | null;
  readonly settings: Readonly<Record<string, string>>;
  readonly license: {
    readonly disposition: "redistributable" | "local-only";
    readonly text: string;
  };
  readonly expected: FixtureExpectation | null;
  readonly malformedOf: string | null;
  readonly derivation: string | null;
}

/** Complete committed fixture manifest. */
export interface FixtureManifest {
  readonly schemaVersion: 1;
  readonly fixtures: readonly FixtureEntry[];
}

/** Narrow an untrusted value to an ordinary record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Read and shape-check one manifest without trusting its contents. */
export function parseFixtureManifest(value: unknown): FixtureManifest {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.fixtures)) {
    throw new Error("Fixture manifest must contain schemaVersion 1 and a fixtures array");
  }
  const seen = new Set<string>();
  const seenPaths = new Set<string>();
  for (const item of value.fixtures) {
    if (!isRecord(item)) throw new Error("Fixture entry must be an object");
    for (const key of [
      "id",
      "family",
      "path",
      "sha256",
      "provenance",
      "producer",
      "producerVersion",
      "settings",
      "license",
      "expected",
      "malformedOf",
      "derivation",
    ]) {
      if (!(key in item)) throw new Error(`Fixture entry is missing '${key}'`);
    }
    if (typeof item.id !== "string" || seen.has(item.id)) {
      throw new Error("Fixture ids must be unique strings");
    }
    seen.add(item.id);
    if (typeof item.path !== "string" || item.path.includes("\\") || item.path.startsWith("/")) {
      throw new Error(`Fixture '${item.id}' has an invalid project-relative path`);
    }
    if (seenPaths.has(item.path)) {
      throw new Error(`Fixture path '${item.path}' is recorded more than once`);
    }
    seenPaths.add(item.path);
    if (typeof item.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(item.sha256)) {
      throw new Error(`Fixture '${item.id}' has an invalid SHA-256`);
    }
    if (!isRecord(item.provenance) || typeof item.provenance.kind !== "string") {
      throw new Error(`Fixture '${item.id}' has invalid provenance`);
    }
    if (!isRecord(item.license) || typeof item.license.disposition !== "string") {
      throw new Error(`Fixture '${item.id}' has an invalid license record`);
    }
  }
  return value as unknown as FixtureManifest;
}

/** Lowercase digest of exact bytes. */
export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** List every committed file under the public fixture directory. */
async function publicFiles(root: string, directory = join(root, "public")): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await publicFiles(root, path)));
    else if (entry.isFile()) found.push(relative(root, path).split(sep).join("/"));
  }
  return found;
}

/** Recompute one PSID fixture's selected outputs from its own header. */
function psidOutputs(bytes: Uint8Array): Readonly<Record<string, unknown>> {
  if (Buffer.from(bytes.subarray(0, 4)).toString("ascii") !== "PSID") {
    throw new Error("PSID fixture must start with PSID");
  }
  const header = Buffer.from(bytes);
  const version = header.readUInt16BE(0x04);
  const dataOffset = header.readUInt16BE(0x06);
  const load = header.readUInt16BE(0x08);
  const init = header.readUInt16BE(0x0a);
  const play = header.readUInt16BE(0x0c);
  if (version < 1 || version > 4) throw new Error(`Unsupported PSID fixture version ${version}`);
  const payload = bytes.subarray(dataOffset);
  const effectiveLoad = load !== 0 ? load : payload[0]! | (payload[1]! << 8);
  const data = load !== 0 ? payload : payload.subarray(2);
  return {
    data: { type: "byte[]", length: data.length, sha256: sha256(data) },
    init_address: { type: "word", value: init === 0 ? effectiveLoad : init },
    play_address: { type: "word", value: play },
  };
}

/** Recompute one Koala fixture's selected components from its fixed layout. */
function koalaOutputs(bytes: Uint8Array): Readonly<Record<string, unknown>> {
  if (bytes.length !== 10_003) throw new Error("Koala fixture must be exactly 10,003 bytes");
  const load = bytes[0]! | (bytes[1]! << 8);
  if (load !== 0x6000) throw new Error("Koala fixture must load at $6000");
  return {
    bitmap: { type: "byte[]", length: 8000, sha256: sha256(bytes.subarray(2, 8002)) },
    screen: { type: "byte[]", length: 1000, sha256: sha256(bytes.subarray(8002, 9002)) },
    color_ram: { type: "byte[]", length: 1000, sha256: sha256(bytes.subarray(9002, 10002)) },
    background: { type: "byte", value: bytes[10002]! },
  };
}

/** Recompute the expected selector outputs for one fixture family. */
function expectedOutputs(family: FixtureEntry["family"], bytes: Uint8Array) {
  switch (family) {
    case "raw":
      return { raw: { type: "byte[]", length: bytes.length, sha256: sha256(bytes) } };
    case "psid":
      return psidOutputs(bytes);
    case "koala":
      return koalaOutputs(bytes);
    default:
      return null;
  }
}

/**
 * Validate every committed fixture against the manifest.
 *
 * The check returns human-readable violations instead of throwing so the
 * specification test can report every gap in one run.
 *
 * @example const violations = await validateFixtureTree("test/rd06/fixtures");
 */
export async function validateFixtureTree(root: string): Promise<readonly string[]> {
  const violations: string[] = [];
  let manifest: FixtureManifest;
  try {
    manifest = parseFixtureManifest(
      JSON.parse(await readFile(join(root, "manifest.json"), "utf8")),
    );
  } catch (caught) {
    return Object.freeze([caught instanceof Error ? caught.message : String(caught)]);
  }
  const entries = new Map(manifest.fixtures.map((entry) => [entry.path, entry]));
  const files = await publicFiles(root);
  for (const path of files) {
    if (!entries.has(path)) violations.push(`Unlisted fixture file: ${path}`);
  }
  for (const entry of manifest.fixtures) {
    if (!files.includes(entry.path)) {
      violations.push(`Missing fixture file: ${entry.path}`);
      continue;
    }
    const bytes = await readFile(join(root, entry.path));
    if (sha256(bytes) !== entry.sha256) {
      violations.push(
        `Hash mismatch for ${entry.id}: expected ${entry.sha256}, got ${sha256(bytes)}`,
      );
      continue;
    }
    if (entry.expected === null) {
      violations.push(`Fixture ${entry.id} is missing its expected outputs`);
      continue;
    }
    if (entry.expected.parse === "reject") {
      if (Object.keys(entry.expected.selectors).length !== 0) {
        violations.push(`Rejected fixture ${entry.id} must not declare selector outputs`);
      }
      continue;
    }
    const outputs = expectedOutputs(entry.family, bytes);
    if (outputs === null) continue;
    const expected = entry.expected.selectors;
    for (const [selector, value] of Object.entries(outputs)) {
      if (!(selector in expected)) {
        violations.push(`Fixture ${entry.id} is missing expectation '${selector}'`);
        continue;
      }
      const recorded = expected[selector]!;
      if (JSON.stringify(recorded) !== JSON.stringify(value)) {
        violations.push(
          `Selector '${selector}' of ${entry.id} does not match committed bytes: expected ${JSON.stringify(recorded)}, got ${JSON.stringify(value)}`,
        );
      }
    }
    for (const selector of Object.keys(expected)) {
      if (!(selector in outputs)) {
        violations.push(`Fixture ${entry.id} declares unknown selector '${selector}'`);
      }
    }
  }
  return Object.freeze(violations);
}
