/**
 * Specification test for the width of a shared frame slot.
 *
 * When sibling scopes each declare a local with the same name (the `if`
 * arm and the `else` arm both declaring `t`), the two never coexist and
 * share ONE frame slot. That shared slot must be sized to the WIDEST
 * colliding declaration — otherwise the wider store would overrun the
 * neighbouring variable's bytes.
 *
 * The layout contract asserted here is order-stability plus no-overlap:
 * slots keep declaration order and a later local starts at or beyond the
 * end of the shared slot. Offset IDENTITY is deliberately not asserted —
 * later slots are EXPECTED to shift by the width delta; that shift is
 * the fix, not a regression.
 *
 * The program compiles through the REAL frontend pipeline (lexer +
 * parser + analyzer) and the frame is computed via the real
 * model-adapter + frame-computation seam.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { DiagnosticBag, SemanticModel } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";
import { modelToFunctionInfo } from "./model-adapter.js";
import { computeFrames } from "./frame-computation.js";

/** Compiles `source` through the real frontend, asserting zero diagnostics. */
function analyzeClean(source: string): SemanticModel {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast } = parse({ tokens, source, sourceId: 1, bag });
  const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  expect(bag.getAll()).toEqual([]);
  return model;
}

describe("Specification: shared frame slot is sized to the widest declaration", () => {
  it("should size a sibling-shared slot to its widest declaration and place the next local past it", () => {
    const source = [
      "module Main;",
      "function main(): void {",
      "  let c: boolean = true;",
      "  if (c) {",
      "    let t: word = 300;",
      "  } else {",
      "    let t: byte = 5;",
      "  }",
      "  let u: byte = 7;",
      "}",
      "",
    ].join("\n");

    const model = analyzeClean(source);
    const infos = modelToFunctionInfo(model);
    const frame = computeFrames(infos).get("Main.main");
    expect(frame).toBeDefined();
    if (frame === undefined) return;

    // Order-stability: no parameters, then the locals in declaration
    // order — and the two sibling `t`s collapse into ONE shared slot.
    expect(frame.slots.map((s) => s.name)).toEqual(["c", "t", "u"]);

    const t = frame.slots.find((s) => s.name === "t");
    const u = frame.slots.find((s) => s.name === "u");
    expect(t).toBeDefined();
    expect(u).toBeDefined();
    if (t === undefined || u === undefined) return;

    // The shared slot takes the WIDEST colliding declaration: the word
    // arm needs 2 bytes, so the byte arm's 1 byte must not win.
    expect(t.kind).toBe("local");
    expect(t.size).toBe(2);

    // No-overlap: the neighbour starts at or beyond the end of the
    // shared slot, so a 2-byte store into `t` can never clobber `u`.
    // (Exact offsets are NOT pinned — widening `t` legitimately shifts
    // every later slot by the width delta.)
    expect(u.offset).toBeGreaterThanOrEqual(t.offset + t.size);

    // Slots stay packed without padding: consecutive slots never
    // overlap, and the frame total is the plain sum of slot sizes.
    for (let i = 1; i < frame.slots.length; i++) {
      const prev = frame.slots[i - 1];
      const curr = frame.slots[i];
      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      if (prev === undefined || curr === undefined) continue;
      expect(curr.offset).toBeGreaterThanOrEqual(prev.offset + prev.size);
    }
    const sizeSum = frame.slots.reduce((acc, s) => acc + s.size, 0);
    expect(frame.totalSize).toBe(sizeSum);
  });
});
