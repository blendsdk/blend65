import { describe, expect, it } from "vitest";
import { makeSpan, type LabeledSpan, type SourceSpan } from "./source-span.js";

/**
 * Implementation tests for the span & source model.
 *
 * Covers the span model's boundary/internal cases beyond the specification
 * tests. The span model is pure data, so these tests focus on the one
 * behavioural helper (`makeSpan` clamping) and the structural shape of the
 * value objects.
 */
describe("makeSpan", () => {
  // The headline spec case: an inverted (end < start) range must clamp `end`
  // up to `start` so the resulting span can never invert.
  it("should clamp end to start when end precedes start (ST-1)", () => {
    const span = makeSpan(0, 5, 3);
    expect(span.start).toBe(5);
    expect(span.end).toBe(5);
    expect(span.sourceId).toBe(0);
  });

  it("should preserve a well-ordered range unchanged", () => {
    const span = makeSpan(2, 3, 10);
    expect(span).toEqual({ sourceId: 2, start: 3, end: 10 });
  });

  it("should allow an empty (zero-length) span when start equals end", () => {
    const span = makeSpan(1, 7, 7);
    expect(span.start).toBe(7);
    expect(span.end).toBe(7);
  });

  it("should clamp to an empty span at start for an inverted range", () => {
    // end is well below start → collapses to an empty span at `start`.
    const span = makeSpan(4, 100, 0);
    expect(span.start).toBe(100);
    expect(span.end).toBe(100);
  });

  it("should carry the provided sourceId verbatim", () => {
    expect(makeSpan(42, 0, 1).sourceId).toBe(42);
  });
});

describe("SourceSpan / LabeledSpan shape", () => {
  it("should expose sourceId, start, and end on a SourceSpan", () => {
    const span: SourceSpan = makeSpan(0, 0, 4);
    expect(Object.keys(span).sort()).toEqual(["end", "sourceId", "start"]);
  });

  it("should wrap a span and a label in a LabeledSpan", () => {
    const labeled: LabeledSpan = {
      span: makeSpan(0, 1, 2),
      label: "defined here",
    };
    expect(labeled.label).toBe("defined here");
    expect(labeled.span.start).toBe(1);
  });
});
