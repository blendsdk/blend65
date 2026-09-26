import { expect, it } from "vitest";
import { validateAssetsEvidence } from "./evidence.js";

it("rejects a leading UTF-8 BOM without shifting the artifact byte coordinates", () => {
  const bytes = Buffer.from('\ufeff{"kind":"blend65.assets","schemaVersion":2}');
  expect(validateAssetsEvidence(bytes)).toMatchObject({
    kind: "error",
    reason: "malformed",
    record: { code: "E10267", primarySpan: { sourceId: ".assets.json", start: 0, end: 3 } },
  });
});

it("preserves UTF-8 offsets when a duplicate key follows non-ASCII text", () => {
  const source = '{"kind":"blend65.assets","schemaVersion":1,"é":0,"é":1}';
  const first = Buffer.byteLength(source.slice(0, source.indexOf('"é"')));
  const second = Buffer.byteLength(source.slice(0, source.lastIndexOf('"é"')));
  expect(validateAssetsEvidence(Buffer.from(source))).toMatchObject({
    kind: "error",
    record: {
      code: "E10267",
      primarySpan: { sourceId: ".assets.json", start: second, end: second + 4 },
      related: [{ span: { sourceId: ".assets.json", start: first, end: first + 4 } }],
    },
  });
});

it("does not interpret future payload duplicates before rejecting the schema version", () => {
  const source = '{"kind":"blend65.assets","schemaVersion":2,"future":{"x":0,"x":1}}';
  expect(validateAssetsEvidence(Buffer.from(source))).toMatchObject({
    kind: "error",
    reason: "unsupported-version",
    record: { code: "E10268", related: [] },
  });
});
