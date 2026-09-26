import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import {
  validateAssetsEvidence,
  validateBuildEvidence,
  validateCostsEvidence,
  validateDebugEvidence,
  validateMemoryEvidence,
} from "../../packages/compiler/dist/artifacts/evidence.js";
import { beforeAll, describe, expect, it } from "vitest";

const validators = {
  build: validateBuildEvidence,
  memory: validateMemoryEvidence,
  costs: validateCostsEvidence,
  debug: validateDebugEvidence,
  assets: validateAssetsEvidence,
} as const;
type Family = keyof typeof validators;
const fixtures = new Map<Family, Record<string, unknown>>();

/** Check decoded fixture shapes before editing one independently specified field. */
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Expected a JSON record");
  }
  return value as Record<string, unknown>;
}

/** Obtain a child without using compiler validation or implementation-specific helpers. */
function child(value: unknown, key: string): unknown {
  return Array.isArray(value) ? value[Number(key)] : record(value)[key];
}

/** Replace a known field in an isolated copy, retaining every unrelated valid field. */
function replace(root: unknown, pointer: string, value: unknown): void {
  const keys = pointer.slice(1).split("/");
  const key = keys.pop()!;
  let parent = root;
  for (const part of keys) parent = child(parent, part);
  if (Array.isArray(parent)) parent[Number(key)] = value;
  else record(parent)[key] = value;
}

/** Serialize one field corruption and retain the exact raw-byte proof location. */
function malformed(family: Family, pointer: string, replacement: unknown) {
  const value = structuredClone(fixtures.get(family));
  replace(value, pointer, replacement);
  const text = `${JSON.stringify(value)}\n`;
  const token = JSON.stringify(replacement);
  const offset = text.indexOf(token);
  expect(offset).toBeGreaterThanOrEqual(0);
  expect(text.indexOf(token, offset + token.length)).toBe(-1);
  const start = Buffer.byteLength(text.slice(0, offset));
  return {
    bytes: Buffer.from(text),
    span: { sourceId: `.${family}.json`, start, end: start + Buffer.byteLength(token) },
  };
}

/** Require canonical field framing plus an actionable invariant, not a generic invalid-value label. */
function expectFieldFailure(
  family: Family,
  pointer: string,
  replacement: unknown,
  invariant: RegExp,
) {
  const input = malformed(family, pointer, replacement);
  const result = validators[family](input.bytes);
  expect(result.kind).toBe("error");
  if (result.kind !== "error") throw new Error("Expected malformed supported-version evidence");
  expect(result.reason).toBe("malformed");
  expect(result.diagnostic).toEqual(expect.stringMatching(/\S/u));
  expect(result.record).toMatchObject({
    code: "E10267",
    severity: "error",
    pointer,
    primarySpan: input.span,
    related: [],
  });
  const prefix = `Malformed public artifact '.${family}.json' at '${pointer}' — `;
  expect(result.record.message.startsWith(prefix)).toBe(true);
  expect(result.record.message.slice(prefix.length)).toMatch(invariant);
}

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), "blend65-artifact-field-diagnostics-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/data.bin"), Uint8Array.of(3, 5, 7));
    await writeFile(
      join(root, "src/game.blend"),
      'module Game; const DATA: byte[] = embed("data.bin"); function main(): void { poke($0400, DATA[0]); }',
    );
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "artifact-fields",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    const build = await buildProject({ project: join(root, "blend65.json") });
    expect(build.kind, JSON.stringify(build.diagnostics)).toBe("success");
    if (build.kind !== "success") throw new Error("Expected valid baseline artifacts");
    for (const family of Object.keys(validators) as Family[]) {
      fixtures.set(
        family,
        record(
          JSON.parse(await readFile(join(build.generation.directory, `.${family}.json`), "utf8")),
        ),
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);

describe("field-specific malformed public artifact diagnostics", () => {
  // The unchanged controls ensure a rejected mutation is not hiding an already-invalid fixture.
  it("should accept all five unchanged supported-version artifacts", () => {
    for (const family of Object.keys(validators) as Family[]) {
      expect(
        validators[family](Buffer.from(`${JSON.stringify(fixtures.get(family))}\n`)).kind,
      ).toBe("complete");
    }
  });

  const collections = [
    ["build", "/artifacts"],
    ["memory", "/intervals"],
    ["costs", "/entries"],
    ["debug", "/functions"],
    ["assets", "/assets"],
  ] as const;
  // An invalid collection must identify that field, not merely the root sidecar envelope.
  it.each(collections)("should locate the non-array %s field %s", (family, pointer) => {
    expectFieldFailure(family, pointer, "not-an-array-é", /array/iu);
  });

  const elements = [
    ["build", "/semanticInputs/sources/0"],
    ["memory", "/intervals/0"],
    ["costs", "/entries/0"],
    ["debug", "/functions/0"],
    ["assets", "/assets/0"],
  ] as const;
  // The element, rather than its containing array, is the smallest proof of a non-record entry.
  it.each(elements)("should locate the non-record %s element %s", (family, pointer) => {
    expectFieldFailure(family, pointer, "not-a-record-é", /object|record/iu);
  });

  // A well-shaped record with one invalid scalar must name that leaf, not the whole record.
  it("should locate an empty build compiler name and explain the nonempty text requirement", () => {
    expectFieldFailure("build", "/semanticInputs/compiler/name", "", /non[- ]?empty/iu);
  });

  it("should locate an empty memory residency identity and explain the nonempty text requirement", () => {
    expectFieldFailure("memory", "/residencies/0/id", "", /non[- ]?empty/iu);
  });

  it("should locate negative total program bytes and explain the nonnegative count requirement", () => {
    expectFieldFailure("costs", "/totals/programBytes", -913, /non[- ]?negative/iu);
  });

  it("should locate an empty debug compiler name and explain the nonempty text requirement", () => {
    expectFieldFailure("debug", "/compiler/name", "", /non[- ]?empty/iu);
  });

  it("should locate negative asset payload bytes and explain the nonnegative count requirement", () => {
    expectFieldFailure("assets", "/assets/0/payloadBytes", -917, /non[- ]?negative/iu);
  });

  // Relationships use the smallest record containing both independently well-typed operands.
  it("should identify the invalid loaded range in build package evidence", () => {
    const value = record(fixtures.get("build")?.package);
    expectFieldFailure(
      "build",
      "/package",
      { ...value, loadAddress: 4096, endAddress: 4095 },
      /range|end|start|loadAddress/iu,
    );
  });

  it("should identify the stack capacity equation in memory evidence", () => {
    const first = record(child(fixtures.get("memory")?.stackDomains, "0"));
    expectFieldFailure(
      "memory",
      "/stackDomains/0",
      { ...first, capacityBytes: 237, peakBytes: 3, headroomBytes: 235 },
      /capacity|peak|headroom/iu,
    );
  });

  it("should identify reversed cycle bounds in costs evidence", () => {
    expectFieldFailure(
      "costs",
      "/totals/pathCycles/0/cycles",
      { kind: "range", minimum: 917, maximum: 913 },
      /minimum|maximum|range|bound/iu,
    );
  });

  it("should identify source line offsets outside the debug source length", () => {
    const first = record(child(fixtures.get("debug")?.sources, "0"));
    expectFieldFailure(
      "debug",
      "/sources/0",
      { ...first, byteLength: 7, lineStarts: [0, 9] },
      /line|offset|length|byteLength/iu,
    );
  });

  it("should identify the selected payload and emitted byte mismatch for a single asset", () => {
    const first = record(child(fixtures.get("assets")?.assets, "0"));
    expectFieldFailure(
      "assets",
      "/assets/0",
      { ...first, emittedBytes: 913 },
      /emittedBytes|payloadBytes|emitted|payload/iu,
    );
  });

  // A future schema is rejected at its envelope without interpreting an unknown payload.
  it.each(Object.keys(validators) as Family[])(
    "should preserve unsupported-version precedence for %s",
    (family) => {
      const input = { kind: `blend65.${family}`, schemaVersion: 2, payload: null };
      const result = validators[family](Buffer.from(JSON.stringify(input)));
      expect(result.kind).toBe("error");
      if (result.kind !== "error") throw new Error("Expected unsupported schema version");
      expect(result.reason).toBe("unsupported-version");
      expect(result.record).toMatchObject({
        code: "E10268",
        severity: "error",
        message: `Unsupported public artifact schema version 2 for '.${family}.json' — supported version: 1`,
        related: [],
      });
    },
  );
});
