import { describe, expect, it } from "vitest";
import { compareDiagnostics, createDiagnostic, sortDiagnostics } from "./index.js";
import type { InventoryDiagnostic } from "./index.js";

function diagnostic(
  overrides: Partial<InventoryDiagnostic> & Pick<InventoryDiagnostic, "code" | "phase">,
): InventoryDiagnostic {
  return createDiagnostic({
    path: "",
    message: "message",
    ...overrides,
  });
}

describe("inventory diagnostic ordering", () => {
  it("should order diagnostics by phase before code and path", () => {
    const diagnostics = [
      diagnostic({ phase: "schema", code: "a", path: "/z" }),
      diagnostic({ phase: "input", code: "z", path: "/a" }),
      diagnostic({ phase: "schema", code: "a", path: "/a" }),
      diagnostic({ phase: "schema", code: "b", path: "/a" }),
    ];

    expect(
      sortDiagnostics(diagnostics).map((item) => `${item.phase}:${item.code}:${item.path}`),
    ).toEqual(["input:z:/a", "schema:a:/a", "schema:a:/z", "schema:b:/a"]);
    expect(diagnostics[0]?.path).toBe("/z");
  });

  it("should order present locations before missing locations", () => {
    const located = diagnostic({
      phase: "input",
      code: "input.failure",
      location: { line: 2, column: 3 },
    });
    const unlocated = diagnostic({ phase: "input", code: "input.failure" });

    expect(compareDiagnostics(located, unlocated)).toBeLessThan(0);
    expect(compareDiagnostics(unlocated, unlocated)).toBe(0);
  });

  it("should use line, column, then message as deterministic tie breakers", () => {
    const diagnostics = [
      diagnostic({
        phase: "input",
        code: "input.failure",
        location: { line: 2, column: 4 },
        message: "b",
      }),
      diagnostic({
        phase: "input",
        code: "input.failure",
        location: { line: 2, column: 3 },
        message: "z",
      }),
      diagnostic({
        phase: "input",
        code: "input.failure",
        location: { line: 2, column: 4 },
        message: "a",
      }),
    ];

    expect(sortDiagnostics(diagnostics).map((item) => item.message)).toEqual(["z", "a", "b"]);
  });

  it("should supply default severity and related paths", () => {
    expect(
      createDiagnostic({
        phase: "schema",
        code: "schema.failure",
        path: "/field",
        message: "Invalid field.",
      }),
    ).toEqual({
      phase: "schema",
      code: "schema.failure",
      severity: "error",
      path: "/field",
      relatedPaths: [],
      message: "Invalid field.",
    });
  });

  it("should compare Unicode text by locale-independent code units", () => {
    const lowerCodeUnit = diagnostic({ phase: "schema", code: "z" });
    const higherCodeUnit = diagnostic({ phase: "schema", code: "ä" });

    expect(compareDiagnostics(lowerCodeUnit, higherCodeUnit)).toBeLessThan(0);
  });
});
