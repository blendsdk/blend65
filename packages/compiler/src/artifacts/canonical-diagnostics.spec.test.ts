import { describe, expect, it } from "vitest";
import {
  validateAssetsEvidence,
  validateBuildEvidence,
  validateCostsEvidence,
  validateDebugEvidence,
  validateMemoryEvidence,
} from "./evidence.js";

const validators = [
  { file: ".build.json", kind: "blend65.build", validate: validateBuildEvidence },
  { file: ".assets.json", kind: "blend65.assets", validate: validateAssetsEvidence },
  { file: ".memory.json", kind: "blend65.memory", validate: validateMemoryEvidence },
  { file: ".costs.json", kind: "blend65.costs", validate: validateCostsEvidence },
  { file: ".debug.json", kind: "blend65.debug", validate: validateDebugEvidence },
] as const;

/** Find a literal JSON token's trustworthy UTF-8 byte range without using validator output. */
function tokenSpan(sourceId: string, text: string, token: string, occurrence = 0) {
  let index = -1;
  for (let n = 0; n <= occurrence; n += 1) index = text.indexOf(token, index + 1);
  if (index < 0) throw new Error(`Missing JSON token ${token}`);
  const start = Buffer.byteLength(text.slice(0, index));
  return { sourceId, start, end: start + Buffer.byteLength(token) };
}

describe.each(validators)("canonical $file validation failures", ({ file, kind, validate }) => {
  // A future envelope is recognized before inspecting a payload that this version cannot know.
  it("should report E10268 for a positive unsupported version without inspecting its payload", () => {
    const text = JSON.stringify({ kind, schemaVersion: 2, futurePayload: { invalidToday: true } });
    expect(validate(Buffer.from(text))).toMatchObject({
      kind: "error",
      reason: "unsupported-version",
      diagnostic: expect.any(String),
      record: {
        code: "E10268",
        severity: "error",
        message: `Unsupported public artifact schema version 2 for '${file}' — supported version: 1`,
        pointer: "/schemaVersion",
        primarySpan: tokenSpan(file, text, "2"),
        related: [],
      },
    });
  });

  // A primitive JSON root has no sidecar envelope; the input token itself proves the failure.
  it("should report E10267 for a non-object envelope", () => {
    const text = "true";
    const result = validate(Buffer.from(text));
    expect(result).toMatchObject({
      kind: "error",
      reason: "malformed",
      diagnostic: expect.any(String),
      record: {
        code: "E10267",
        severity: "error",
        message: expect.stringMatching(
          new RegExp(
            `^Malformed public artifact '${file.replaceAll(".", "\\.")}' at '${file.replaceAll(".", "\\.")}' — .*object.*$`,
            "u",
          ),
        ),
        pointer: null,
        primarySpan: tokenSpan(file, text, "true"),
        related: [],
      },
    });
  });

  // The kind must be validated even when a positive future version would otherwise be recognized.
  it("should report E10267 rather than E10268 for a wrong artifact kind", () => {
    const text = '{"kind":"wrong","schemaVersion":2}';
    expect(validate(Buffer.from(text))).toMatchObject({
      kind: "error",
      reason: "malformed",
      record: {
        code: "E10267",
        severity: "error",
        message: expect.stringMatching(
          new RegExp(
            `^Malformed public artifact '${file.replaceAll(".", "\\.")}' at '${file.replaceAll(".", "\\.")}' — .*kind.*$`,
            "u",
          ),
        ),
        pointer: null,
        primarySpan: tokenSpan(file, text, '"wrong"'),
        related: [],
      },
    });
  });

  // Zero and non-integer schema versions are malformed envelopes, not future schema versions.
  it.each([0, 1.5])("should report E10267 for invalid schema version %s", (schemaVersion) => {
    const text = JSON.stringify({ kind, schemaVersion });
    expect(validate(Buffer.from(text))).toMatchObject({
      kind: "error",
      reason: "malformed",
      record: {
        code: "E10267",
        severity: "error",
        message: expect.stringMatching(
          new RegExp(
            `^Malformed public artifact '${file.replaceAll(".", "\\.")}' at '${file.replaceAll(".", "\\.")}' — .*(?:version|schemaVersion|integer).*$`,
            "u",
          ),
        ),
        pointer: null,
        primarySpan: tokenSpan(file, text, String(schemaVersion)),
        related: [],
      },
    });
  });
});

describe("canonical supported artifact payload failures", () => {
  // A truncated JSON input is malformed before a kind or schema version can be trusted.
  it("should report E10267 at the end of truncated JSON", () => {
    const text = '{"kind":';
    expect(validateAssetsEvidence(Buffer.from(text))).toMatchObject({
      kind: "error",
      reason: "malformed",
      record: {
        code: "E10267",
        severity: "error",
        message: expect.stringMatching(
          /^Malformed public artifact '\.assets\.json' at '\.assets\.json' — .+$/u,
        ),
        pointer: null,
        primarySpan: { sourceId: ".assets.json", start: text.length, end: text.length },
        related: [],
      },
    });
  });

  // An absent required envelope member has no field token; the complete input is responsible.
  it.each([
    ["kind", '{"schemaVersion":1}'],
    ["schemaVersion", '{"kind":"blend65.assets"}'],
  ])("should report E10267 for a missing %s envelope member", (member, text) => {
    expect(validateAssetsEvidence(Buffer.from(text))).toMatchObject({
      kind: "error",
      reason: "malformed",
      record: {
        code: "E10267",
        severity: "error",
        message: expect.stringMatching(
          new RegExp(
            `^Malformed public artifact '\\.assets\\.json' at '\\.assets\\.json' — .*${member}.*$`,
            "u",
          ),
        ),
        pointer: null,
        primarySpan: { sourceId: ".assets.json", start: 0, end: text.length },
        related: [],
      },
    });
  });

  // A valid supported envelope localizes a malformed value to its JSON pointer and token.
  it("should report E10267 at the supported assets field that is not an array", () => {
    const text = '{"kind":"blend65.assets","schemaVersion":1,"assets":true}';
    expect(validateAssetsEvidence(Buffer.from(text))).toMatchObject({
      kind: "error",
      reason: "malformed",
      record: {
        code: "E10267",
        severity: "error",
        message: expect.stringMatching(
          /^Malformed public artifact '\.assets\.json' at '\/assets' — .*array.*$/u,
        ),
        pointer: "/assets",
        primarySpan: tokenSpan(".assets.json", text, "true"),
        related: [],
      },
    });
  });

  // The later duplicate key is primary; the first spelling is the conflicting related site.
  it("should report E10267 for duplicate keys with both exact ordered locations", () => {
    const text = '{"kind":"blend65.assets","kind":"blend65.assets","schemaVersion":1,"assets":[]}';
    expect(validateAssetsEvidence(Buffer.from(text))).toMatchObject({
      kind: "error",
      reason: "malformed",
      record: {
        code: "E10267",
        severity: "error",
        message: expect.stringMatching(
          /^Malformed public artifact '\.assets\.json' at '\.assets\.json' — .*[Dd]uplicate.*kind.*$/u,
        ),
        pointer: null,
        primarySpan: tokenSpan(".assets.json", text, '"kind"', 1),
        related: [{ span: tokenSpan(".assets.json", text, '"kind"') }],
      },
    });
  });
});
