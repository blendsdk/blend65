/**
 * Implementation tests for the JSON renderer.
 *
 * Covers edge cases beyond the specification tier: the empty array and deep
 * field fidelity across every record shape.
 */

import { describe, expect, it } from "vitest";
import { renderJson } from "./render-json.js";
import { makeSpan } from "./source-span.js";
import type { Diagnostic } from "./diagnostic.js";

describe("renderJson implementation details", () => {
  it("renders an empty diagnostics array as an empty JSON array with a trailing newline", () => {
    expect(renderJson([])).toBe("[]\n");
  });

  it("round-trips every field with deep fidelity, including hostile message content", () => {
    const hostile: Diagnostic = {
      code: "E10001",
      severity: "error",
      // Quotes, backslashes, and newlines must survive via JSON escaping.
      message: 'a "quoted" \\ backslash\nnewline',
      primarySpan: makeSpan(3, 0, 0),
      secondarySpans: [
        { span: makeSpan(4, 1, 2), label: "first" },
        { span: makeSpan(-2, 0, 5), label: "sentinel" },
      ],
      notes: ["note 1", "note 2"],
      help: "some help",
    };

    const parsed = JSON.parse(renderJson([hostile])) as Array<Record<string, unknown>>;

    expect(parsed[0]).toEqual({
      code: "E10001",
      severity: "error",
      message: 'a "quoted" \\ backslash\nnewline',
      primarySpan: { sourceId: 3, start: 0, end: 0 },
      secondarySpans: [
        { span: { sourceId: 4, start: 1, end: 2 }, label: "first" },
        { span: { sourceId: -2, start: 0, end: 5 }, label: "sentinel" },
      ],
      notes: ["note 1", "note 2"],
      help: "some help",
    });
  });

  it("emits a null primarySpan as JSON null (not omitted)", () => {
    const spanless: Diagnostic = {
      code: "E90001",
      severity: "error",
      message: "ICE",
      primarySpan: null,
      secondarySpans: [],
      notes: [],
    };

    const parsed = JSON.parse(renderJson([spanless])) as Array<Record<string, unknown>>;

    expect("primarySpan" in parsed[0]).toBe(true);
    expect(parsed[0].primarySpan).toBeNull();
  });
});
