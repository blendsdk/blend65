import { describe, expect, it } from "vitest";
import { escapeDiagnosticText, projectDiagnostic, sortDiagnostics } from "./diagnostics.js";
import type { ProjectDiagnostic } from "./types.js";

describe("diagnostic record internals", () => {
  it("should copy and freeze proving records instead of retaining mutable caller objects", () => {
    const span = { sourceId: "a.blend", start: 2, end: 3 };
    const related = [{ span, message: "First occurrence" }];
    const result = projectDiagnostic("X", "Failure", span, "/x", related, "Correct the value");
    span.start = 99;
    related[0]!.message = "Changed";
    expect(result.primarySpan?.start).toBe(2);
    expect(result.related[0]?.message).toBe("First occurrence");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.primarySpan)).toBe(true);
    expect(Object.isFrozen(result.related)).toBe(true);
    expect(Object.isFrozen(result.related[0])).toBe(true);
    expect(Object.isFrozen(result.related[0]?.span)).toBe(true);
  });

  it("should sort every tie-breaker without mutating caller order", () => {
    const span = { sourceId: "a.blend", start: 2, end: 3 };
    const error = projectDiagnostic("A", "a", span);
    const warning: ProjectDiagnostic = { ...error, severity: "warning" };
    const input = [
      projectDiagnostic("A", "unicode", { ...span, sourceId: "é.blend" }),
      warning,
      projectDiagnostic("B", "b", span),
      projectDiagnostic("A", "b", span),
      error,
      projectDiagnostic("X", "earlier", { ...span, start: 1 }),
      projectDiagnostic("X", "ascii", { ...span, sourceId: "z.blend" }),
    ];
    const original = [...input];
    expect(sortDiagnostics(input).map((item) => [item.message, item.severity])).toEqual([
      ["earlier", "error"],
      ["a", "error"],
      ["b", "error"],
      ["b", "error"],
      ["a", "warning"],
      ["ascii", "error"],
      ["unicode", "error"],
    ]);
    expect(input).toEqual(original);
    expect(Object.isFrozen(sortDiagnostics(input))).toBe(true);
  });

  it("should use byte spelling rather than locale normalization or case folding", () => {
    const names = ["é", "e\u0301", "a", "A"];
    const input = names.map((sourceId) =>
      projectDiagnostic("X", sourceId, { sourceId, start: 0, end: 1 }),
    );
    expect(sortDiagnostics(input).map((item) => item.message)).toEqual(["A", "a", "e\u0301", "é"]);
  });

  it("should render terminal controls without changing ordinary Unicode spelling", () => {
    expect(escapeDiagnosticText("Game Ω\u001b[31m\n\u009b")).toBe("Game ΩU+001B[31mU+000AU+009B");
  });
});
