/**
 * Specification tests for the JSON diagnostic renderer.
 *
 * IMMUTABLE ORACLE: expectations are transcribed from the specification,
 * never derived from the implementation.
 */

import { describe, expect, it } from "vitest";
import { renderJson } from "./render-json.js";
import { makeSpan } from "./source-span.js";
import type { Diagnostic } from "./diagnostic.js";

describe("renderJson (AC-13 / AR-Q10)", () => {
  // Parseable array; spans verbatim including sentinels.
  it("ST-20: emits a parseable top-level array mirroring the records, spans verbatim including the -2 sentinel", () => {
    const first: Diagnostic = {
      code: "E10042",
      severity: "error",
      message: "'poke()' expects 2 arguments — found 3",
      primarySpan: makeSpan(0, 45, 62),
      secondarySpans: [{ span: makeSpan(1, 3, 6), label: "defined here" }],
      notes: ["a note"],
      help: "remove the extra argument",
    };
    const sentinel: Diagnostic = {
      code: "E10243",
      severity: "error",
      message: "Invalid value for 'maxErrors'",
      // The config sentinel — emitted raw, never resolved.
      primarySpan: makeSpan(-2, 0, 5),
      secondarySpans: [],
      notes: [],
    };

    const output = renderJson([first, sentinel]);
    const parsed = JSON.parse(output) as unknown[];

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      code: "E10042",
      severity: "error",
      message: "'poke()' expects 2 arguments — found 3",
      primarySpan: { sourceId: 0, start: 45, end: 62 },
      secondarySpans: [{ span: { sourceId: 1, start: 3, end: 6 }, label: "defined here" }],
      notes: ["a note"],
      help: "remove the extra argument",
    });
    expect(parsed[1]).toEqual({
      code: "E10243",
      severity: "error",
      message: "Invalid value for 'maxErrors'",
      primarySpan: { sourceId: -2, start: 0, end: 5 },
      secondarySpans: [],
      notes: [],
    });
  });

  // Absent help omits the key; 2-space indent; trailing newline.
  it("ST-21: omits the help key when absent and serializes with 2-space indent plus a trailing newline", () => {
    const noHelp: Diagnostic = {
      code: "W10191",
      severity: "warning",
      message: "variable 'y' is never used",
      primarySpan: makeSpan(0, 10, 11),
      secondarySpans: [],
      notes: [],
    };

    const output = renderJson([noHelp]);
    const parsed = JSON.parse(output) as Array<Record<string, unknown>>;

    expect("help" in parsed[0]).toBe(false);
    // 2-space indent + trailing newline: the exact byte form is the
    // JSON.stringify(value, null, 2) of the mirror object.
    expect(output).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
  });
});
