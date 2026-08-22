/**
 * Unit tests for the {@link DiagnosticBag}.
 *
 * Exercises accumulation, deterministic ordering, deduplication, the
 * `--max-errors` cap with its single truncation diagnostic, uncapped ICEs,
 * and the never-throws contract.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, type DiagnosticBagAcceptedEntry } from "./diagnostic-bag.js";
import { DiagCode, IceCode } from "./diagnostic-codes.js";
import { makeSpan } from "./source-span.js";

describe("DiagnosticBag accumulation (ST-15..ST-17)", () => {
  it("starts empty (ST-15)", () => {
    const bag = createDiagnosticBag();
    expect(bag.hasErrors()).toBe(false);
    expect(bag.count()).toBe(0);
    expect(bag.getAll()).toEqual([]);
    expect(bag.isErrorLimitReached()).toBe(false);
  });

  it("records a single error (ST-16)", () => {
    const bag = createDiagnosticBag();
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 0, 1), "undeclared");
    expect(bag.hasErrors()).toBe(true);
    expect(bag.count()).toBe(1);
    expect(bag.getErrors()).toHaveLength(1);
    expect(bag.getWarnings()).toHaveLength(0);

    const [diag] = bag.getErrors();
    expect(diag.code).toBe(DiagCode.UndeclaredIdentifier);
    expect(diag.severity).toBe("error");
    expect(diag.message).toBe("undeclared");
    expect(diag.secondarySpans).toEqual([]);
    expect(diag.notes).toEqual([]);
  });

  it("records a warning without flagging errors (ST-17)", () => {
    const bag = createDiagnosticBag();
    bag.addWarning(DiagCode.UnusedVariable, makeSpan(0, 0, 1), "unused");
    expect(bag.hasErrors()).toBe(false);
    expect(bag.count()).toBe(1);
    expect(bag.getWarnings()).toHaveLength(1);
    expect(bag.getErrors()).toHaveLength(0);
    expect(bag.getWarnings()[0].severity).toBe("warning");
  });

  it("normalizes provided options onto the diagnostic", () => {
    const bag = createDiagnosticBag();
    const secondary = { span: makeSpan(0, 5, 6), label: "defined here" };
    bag.addError(DiagCode.NameShadows, makeSpan(0, 0, 1), "shadows", {
      secondarySpans: [secondary],
      notes: ["a note"],
      help: "rename it",
    });
    const [diag] = bag.getErrors();
    expect(diag.secondarySpans).toEqual([secondary]);
    expect(diag.notes).toEqual(["a note"]);
    expect(diag.help).toBe("rename it");
  });
});

describe("DiagnosticBag deduplication (ST-18, ST-19, ST-25)", () => {
  it("drops a duplicate (code, sourceId, start) error (ST-18)", () => {
    const bag = createDiagnosticBag();
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 4, 8), "x");
    // Same code + sourceId + start, different end → still a duplicate.
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 4, 9), "x again");
    expect(bag.count()).toBe(1);
  });

  it("keeps same-code diagnostics at different starts (ST-19)", () => {
    const bag = createDiagnosticBag();
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 4, 8), "x");
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 9, 12), "y");
    expect(bag.count()).toBe(2);
  });

  it("deduplicates two identical span-less ICEs (ST-25)", () => {
    const bag = createDiagnosticBag();
    bag.addICE(IceCode.Unexpected, null, "boom");
    bag.addICE(IceCode.Unexpected, null, "boom again");
    expect(bag.count()).toBe(1);
  });
});

describe("DiagnosticBag determinism (ST-20, ST-21)", () => {
  it("sorts getAll() by sourceId, start, code and is repeatable (ST-20)", () => {
    const bag = createDiagnosticBag();
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(1, 5, 6), "b");
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 9, 10), "c");
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 2, 3), "a");
    // Same sourceId + start as "a" but a later code → tie broken by code.
    bag.addError(DiagCode.AssignToConst, makeSpan(0, 2, 3), "a2");

    const first = bag.getAll();
    const order = first.map((d) => [d.primarySpan?.sourceId, d.primarySpan?.start, d.code]);
    // Tie at (sourceId 0, start 2) broken by code: "E10100" < "E10191".
    expect(order).toEqual([
      [0, 2, DiagCode.UndeclaredIdentifier], // E10100
      [0, 2, DiagCode.AssignToConst], // E10191
      [0, 9, DiagCode.UndeclaredIdentifier],
      [1, 5, DiagCode.UndeclaredIdentifier],
    ]);

    const second = bag.getAll();
    expect(second).toEqual(first);
    // getAll() must return a copy, not the internal array.
    expect(second).not.toBe(first);
  });

  it("sorts null-span diagnostics after spanned ones (ST-21)", () => {
    const bag = createDiagnosticBag();
    bag.addICE(IceCode.Unexpected, null, "ice");
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 0, 1), "spanned");
    const all = bag.getAll();
    expect(all[0].primarySpan).not.toBeNull();
    expect(all[all.length - 1].primarySpan).toBeNull();
  });
});

describe("DiagnosticBag max-errors cap (ST-22, ST-23, ST-24, ST-26)", () => {
  it("caps errors and appends one truncation diagnostic (ST-22)", () => {
    const bag = createDiagnosticBag({ maxErrors: 3 });
    for (let i = 0; i < 5; i++) {
      bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, i, i + 1), `e${i}`);
    }
    expect(bag.isErrorLimitReached()).toBe(true);

    const all = bag.getAll();
    const truncation = all.find((d) => d.code === DiagCode.TooManyErrors);
    expect(truncation).toBeDefined();
    expect(truncation?.primarySpan).toBeNull();
    expect(truncation?.severity).toBe("error");

    // 3 real errors stored + 1 truncation sentinel.
    const real = all.filter((d) => d.code !== DiagCode.TooManyErrors);
    expect(real).toHaveLength(3);
    expect(all).toHaveLength(4);
  });

  it("still accepts warnings after the cap is reached (ST-23)", () => {
    const bag = createDiagnosticBag({ maxErrors: 1 });
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 0, 1), "e0");
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 2, 3), "e1"); // suppressed
    bag.addWarning(DiagCode.UnusedVariable, makeSpan(0, 4, 5), "w");
    expect(bag.getWarnings()).toHaveLength(1);
  });

  it("still accepts ICEs after the cap is reached (ST-24)", () => {
    const bag = createDiagnosticBag({ maxErrors: 1 });
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 0, 1), "e0");
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 2, 3), "e1"); // suppressed
    bag.addICE(IceCode.Unexpected, makeSpan(0, 6, 7), "ice");
    const ice = bag.getAll().find((d) => d.code === IceCode.Unexpected);
    expect(ice).toBeDefined();
  });

  it("emits the truncation diagnostic exactly once (ST-26)", () => {
    const bag = createDiagnosticBag({ maxErrors: 2 });
    for (let i = 0; i < 10; i++) {
      bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, i, i + 1), `e${i}`);
    }
    const truncations = bag.getAll().filter((d) => d.code === DiagCode.TooManyErrors);
    expect(truncations).toHaveLength(1);
  });

  it("reports the truncation diagnostic through hasErrors()", () => {
    const bag = createDiagnosticBag({ maxErrors: 1 });
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 0, 1), "e0");
    bag.addError(DiagCode.UndeclaredIdentifier, makeSpan(0, 2, 3), "e1");
    expect(bag.hasErrors()).toBe(true);
    expect(bag.isErrorLimitReached()).toBe(true);
  });
});

describe("DiagnosticBag never throws (ST-27)", () => {
  it("tolerates null spans, empty messages, and arbitrary code strings", () => {
    const bag = createDiagnosticBag();
    expect(() => {
      bag.addError("E99999-not-a-real-code", null, "");
      bag.addWarning("", null, "");
      bag.addICE("anything", null, "");
    }).not.toThrow();
    expect(bag.count()).toBeGreaterThan(0);
  });
});

describe("DiagnosticBag accepted-entry observation", () => {
  it("observes only entries retained after deduplication and the error cap", () => {
    const accepted: string[] = [];
    const bag = createDiagnosticBag({
      maxErrors: 1,
      onAccepted(entry): void {
        accepted.push(`${entry.acceptanceOrdinal}:${entry.diagnostic.code}`);
      },
    });
    const span = makeSpan(0, 0, 1);
    bag.addError(DiagCode.UndeclaredIdentifier, span, "first");
    bag.addError(DiagCode.UndeclaredIdentifier, span, "duplicate");
    bag.addError(DiagCode.AssignToConst, makeSpan(0, 2, 3), "capped");

    expect(accepted).toEqual([`0:${DiagCode.UndeclaredIdentifier}`, `1:${DiagCode.TooManyErrors}`]);
  });

  it("keeps accepted diagnostics when an additive observer throws", () => {
    const bag = createDiagnosticBag({
      onAccepted(): void {
        throw new Error("observer failure");
      },
    });
    expect(() => bag.addWarning(DiagCode.UnusedVariable, null, "unused")).not.toThrow();
    expect(bag.getWarnings()).toHaveLength(1);
  });

  it("isolates deeply frozen observer snapshots from stored diagnostics", () => {
    let observed: DiagnosticBagAcceptedEntry | undefined;
    const bag = createDiagnosticBag({
      onAccepted(entry): void {
        observed = entry;
        Reflect.set(entry.diagnostic, "code", "E99999");
        Reflect.set(entry.diagnostic.primarySpan ?? {}, "start", 999);
        Reflect.set(entry.diagnostic.secondarySpans[0] ?? {}, "label", "mutated");
        Reflect.set(entry.diagnostic.secondarySpans[0]?.span ?? {}, "end", 999);
        Reflect.set(entry.diagnostic.notes, "0", "mutated");
      },
    });
    bag.addError(DiagCode.AssignToConst, makeSpan(1, 2, 3), "immutable", {
      secondarySpans: [{ span: makeSpan(1, 4, 5), label: "related" }],
      notes: ["original note"],
      help: "original help",
    });

    const stored = bag.getErrors()[0];
    expect(stored).toMatchObject({
      code: DiagCode.AssignToConst,
      primarySpan: { sourceId: 1, start: 2, end: 3 },
      secondarySpans: [{ span: { sourceId: 1, start: 4, end: 5 }, label: "related" }],
      notes: ["original note"],
    });
    expect(bag.hasErrors()).toBe(true);
    expect(observed?.diagnostic).not.toBe(stored);
    expect(Object.isFrozen(observed?.diagnostic)).toBe(true);
    expect(Object.isFrozen(observed?.diagnostic.primarySpan)).toBe(true);
    expect(Object.isFrozen(observed?.diagnostic.secondarySpans)).toBe(true);
    expect(Object.isFrozen(observed?.diagnostic.secondarySpans[0])).toBe(true);
    expect(Object.isFrozen(observed?.diagnostic.secondarySpans[0]?.span)).toBe(true);
    expect(Object.isFrozen(observed?.diagnostic.notes)).toBe(true);
  });
});
