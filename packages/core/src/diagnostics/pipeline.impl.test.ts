/**
 * Integration chain test for the library-first diagnostics pipeline.
 *
 * Proves the collect → apply-policy → render flow end-to-end on the core
 * side: a producer populates a real DiagnosticBag (errors, warnings, an ICE,
 * and a sentinel-span config diagnostic), the severity policy is applied
 * exactly once post-collection, and both renderers consume the
 * policy-applied array — with zero printing inside core (everything returns
 * strings).
 */

import { describe, expect, it } from "vitest";
import {
  applySeverityPolicy,
  createDiagnosticBag,
  createSeverityPolicy,
  createSourceMap,
  DiagCode,
  IceCode,
  makeSpan,
  renderJson,
  renderTerminal,
} from "../index.js";

describe("bag → policy → render chain (R36–R38)", () => {
  it("collects, applies the policy once, and renders both formats from the same array", () => {
    // --- Collect: a realistic producer run over one interned file. ---
    const sourceMap = createSourceMap();
    const id = sourceMap.intern("main.blend", "module main;\nlet unused = 1;\npoke(1);\n");

    const bag = createDiagnosticBag();
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(id, 29, 33), "undeclared 'poke'");
    bag.addWarning(DiagCode.UnusedVariable, makeSpan(id, 17, 23), "variable 'unused' is never used");
    bag.addICE(IceCode.Unexpected, null, "internal compiler error: example");
    // A config diagnostic on the config sentinel source (-2) — never interned.
    bag.addError(DiagCode.ConfigInvalidValue, makeSpan(-2, 0, 5), "Invalid value for 'maxErrors'");

    // --- Apply the policy exactly once, post-collection. ---
    const policy = createSeverityPolicy({ warnAsError: true, suppressWarnings: [] });
    const finalDiagnostics = applySeverityPolicy(bag.getAll(), policy);

    // Build success derives from the policy-applied array, not the bag.
    expect(finalDiagnostics.some((d) => d.severity === "error")).toBe(true);
    expect(finalDiagnostics).toHaveLength(4);
    // The promoted warning kept its W-code.
    const promoted = finalDiagnostics.find((d) => d.code === DiagCode.UnusedVariable);
    expect(promoted?.severity).toBe("error");

    // --- Render both formats from the SAME array. ---
    const terminal = renderTerminal(finalDiagnostics, sourceMap, { color: false });
    const json = renderJson(finalDiagnostics);

    // Terminal: resolvable spans render full blocks; the sentinel and the
    // null-span ICE degrade to header-only; promotion shows through.
    expect(terminal).toContain(`error[${DiagCode.UndeclaredIdentifier}]: undeclared 'poke'`);
    expect(terminal).toContain("  --> main.blend:3:1");
    expect(terminal).toContain(`error[${DiagCode.UnusedVariable}]: variable 'unused' is never used`);
    expect(terminal).toContain(`error[${IceCode.Unexpected}]: internal compiler error: example`);
    expect(terminal).toContain(`error[${DiagCode.ConfigInvalidValue}]: Invalid value for 'maxErrors'`);
    expect(terminal.endsWith("\n")).toBe(true);

    // JSON: all four records mirrored, sentinel span verbatim.
    const parsed = JSON.parse(json) as Array<{ code: string; primarySpan: unknown }>;
    expect(parsed).toHaveLength(4);
    const sentinel = parsed.find((d) => d.code === DiagCode.ConfigInvalidValue);
    expect(sentinel?.primarySpan).toEqual({ sourceId: -2, start: 0, end: 5 });

    // Zero printing inside core: both renderers returned strings; nothing is
    // written to stdout.
    expect(typeof terminal).toBe("string");
    expect(typeof json).toBe("string");
  });
});
