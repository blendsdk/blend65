/**
 * Behavioral spec for the diagnostics core, end-to-end.
 *
 * Where the `*.impl.test.ts` tiers unit-test each module in isolation, this spec
 * exercises the public surface re-exported from `@blend65/core` through a single
 * realistic producer sequence, asserting the whole diagnostics contract holds
 * together: the diagnostic shape, the span/line model, accumulation,
 * deterministic ordering, dedup, the max-errors cap, and the code bands. It
 * also pins the export surface itself.
 */

import { describe, expect, it } from "vitest";
import {
  createDiagnosticBag,
  DiagCode,
  IceCode,
  isIceCode,
  LineMap,
  makeSpan,
  VERSION,
} from "../index.js";
import type {
  Diagnostic,
  DiagnosticBag,
  DiagnosticOptions,
  LabeledSpan,
  Severity,
  SourceId,
  SourceSpan,
} from "../index.js";

describe("@blend65/core diagnostics export surface (ST-28)", () => {
  it("re-exports every diagnostics value alongside VERSION", () => {
    expect(VERSION).toBe("0.1.0");
    expect(typeof makeSpan).toBe("function");
    expect(typeof isIceCode).toBe("function");
    expect(typeof createDiagnosticBag).toBe("function");
    expect(typeof LineMap).toBe("function");
    expect(DiagCode.MissingModuleDecl).toBe("E10001");
    expect(IceCode.Unexpected).toBe("E90001");
  });

  it("re-exports the diagnostics types (compile-time surface)", () => {
    // These bindings only need to type-check; referencing them keeps the
    // imports live and documents the public type surface.
    const span: SourceSpan = makeSpan(0, 0, 1);
    const id: SourceId = span.sourceId;
    const labeled: LabeledSpan = { span, label: "here" };
    const severity: Severity = "error";
    const options: DiagnosticOptions = { notes: ["n"] };
    const bag: DiagnosticBag = createDiagnosticBag();
    bag.addError(DiagCode.UndeclaredIdentifier, span, "x", options);
    const diag: Diagnostic = bag.getAll()[0];
    expect(id).toBe(0);
    expect(labeled.label).toBe("here");
    expect(severity).toBe("error");
    expect(diag.code).toBe(DiagCode.UndeclaredIdentifier);
  });
});

describe("diagnostics end-to-end (AC-1..AC-8)", () => {
  it("accumulates, dedups, orders, and caps a realistic producer run", () => {
    const bag = createDiagnosticBag({ maxErrors: 3 });

    // A producer reports problems out of order, across two files, with a dup.
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(1, 10, 12), "in file 1");
    bag.addWarning(DiagCode.UnusedVariable, makeSpan(0, 30, 33), "unused");
    bag.addError(DiagCode.TypeMismatchAssignment, makeSpan(0, 5, 9), "type");
    bag.addError(DiagCode.TypeMismatchAssignment, makeSpan(0, 5, 9), "type dup"); // deduped
    bag.addError(DiagCode.AssignToConst, makeSpan(0, 20, 24), "const");
    // 4th distinct error exceeds maxErrors=3 → suppressed + truncation sentinel.
    bag.addError(DiagCode.NameShadows, makeSpan(0, 40, 44), "shadow");

    expect(bag.hasErrors()).toBe(true); // accumulation is reflected
    expect(bag.isErrorLimitReached()).toBe(true); // the cap was hit

    const all = bag.getAll();

    // The duplicate TypeMismatchAssignment collapsed.
    const typeMismatches = all.filter((d) => d.code === DiagCode.TypeMismatchAssignment);
    expect(typeMismatches).toHaveLength(1);

    // Exactly one truncation sentinel, span-less, severity error.
    const truncation = all.filter((d) => d.code === DiagCode.TooManyErrors);
    expect(truncation).toHaveLength(1);
    expect(truncation[0].primarySpan).toBeNull();
    expect(truncation[0].severity).toBe("error");

    // Deterministic ordering — file 0 spans first (by start), then file 1,
    // then the null-span truncation last. Repeated calls match.
    const layout = all.map((d) => [d.primarySpan?.sourceId ?? null, d.primarySpan?.start ?? null]);
    expect(layout).toEqual([
      [0, 5], // TypeMismatchAssignment
      [0, 20], // AssignToConst
      [0, 30], // UnusedVariable (warning)
      [1, 10], // UndeclaredIdentifier
      [null, null], // truncation sentinel
    ]);
    expect(bag.getAll()).toEqual(all);

    // Every diagnostic has the documented shape.
    for (const d of all) {
      expect(typeof d.code).toBe("string");
      expect(["error", "warning"]).toContain(d.severity);
      expect(typeof d.message).toBe("string");
      expect(Array.isArray(d.secondarySpans)).toBe(true);
      expect(Array.isArray(d.notes)).toBe(true);
    }

    // Bands are disjoint — no user-facing code lands in the ICE band.
    for (const d of all) {
      expect(isIceCode(d.code)).toBe(false);
    }
  });

  it("derives line/column for a diagnostic span via LineMap (AC-2, AC-3)", () => {
    const source = "let x = 1\nlet yy = x + z\n";
    const map = new LineMap(0, source);
    // Point at `z` on the second line (byte offset of the last identifier).
    const zByte = source.indexOf("z");
    const span: SourceSpan = makeSpan(0, zByte, zByte + 1);

    const bag = createDiagnosticBag();
    bag.addError(DiagCode.UndeclaredIdentifier, span, "undeclared name 'z'");

    const [diag] = bag.getErrors();
    expect(diag.primarySpan).not.toBeNull();
    const pos = map.getLineCol(diag.primarySpan!.start);
    expect(pos.line).toBe(2);
    expect(pos.column).toBeGreaterThan(1);
  });

  it("keeps ICEs uncapped and reflected by hasErrors (AC-8)", () => {
    const bag = createDiagnosticBag({ maxErrors: 1 });
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 0, 1), "e0");
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 2, 3), "e1"); // suppressed
    bag.addICE(IceCode.Unexpected, makeSpan(0, 9, 10), "compiler bug");

    const ice = bag.getAll().find((d) => isIceCode(d.code));
    expect(ice).toBeDefined();
    expect(ice?.severity).toBe("error");
    expect(bag.hasErrors()).toBe(true);
  });
});
