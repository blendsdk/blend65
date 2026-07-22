/**
 * Implementation tests for how a frame slot shared by several declarations of
 * one name is sized, and for where that leaves the slots after it.
 *
 * Blocks that cannot be live at once may each declare the same name, and they
 * deliberately share one slot — so the slot has to be as wide as the widest of
 * them. The interesting consequence is what happens to the NEXT slot: it moves.
 * That movement is the point, not a regression, so the invariants asserted here
 * are the ones that must hold at any sizing — declaration order is preserved,
 * every offset is the running sum of the sizes before it, and no two slots
 * overlap. Pinning a literal offset instead would freeze the very number the
 * widening is supposed to change.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, byteSize } from "@blend65/core";
import type { DiagnosticBag, FunctionFrame, SemanticModel } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";
import { modelToFunctionInfo } from "./model-adapter.js";
import { computeFrames } from "./frame-computation.js";

/** Lexes + parses + analyzes `source`, asserting the program is clean. */
function analyzeClean(source: string): SemanticModel {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast } = parse({ tokens, source, sourceId: 1, bag });
  const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  expect(bag.getAll()).toEqual([]);
  return model;
}

/** The computed frame of `Main.main` for `source`. */
function mainFrame(source: string): FunctionFrame {
  const frame = computeFrames(modelToFunctionInfo(analyzeClean(source))).get("Main.main");
  expect(frame).toBeDefined();
  if (frame === undefined) throw new Error("Main.main has no frame");
  return frame;
}

/**
 * Asserts the invariants that hold for every frame at every sizing: each slot
 * sits at the running sum of the sizes before it (so none overlaps its
 * neighbour), and the total is that sum.
 */
function expectPositionalLayout(frame: FunctionFrame): void {
  let running = 0;
  for (const slot of frame.slots) {
    expect(slot.offset).toBe(running);
    running += slot.size;
  }
  expect(frame.totalSize).toBe(running);
}

describe("frame slot sizing — a name declared by sibling blocks", () => {
  it("sizes the shared slot to the widest declaration, whichever arm declares it", () => {
    const wordFirst = mainFrame(
      "module Main;\nfunction main(): void { let c: boolean = true;\n" +
        "if (c) { let t: word = 300; } else { let t: byte = 5; } }\n",
    );
    const byteFirst = mainFrame(
      "module Main;\nfunction main(): void { let c: boolean = true;\n" +
        "if (c) { let t: byte = 5; } else { let t: word = 300; } }\n",
    );

    // The wider declaration wins from either arm — the slot is not sized by
    // whichever declaration happens to be collected last.
    for (const frame of [wordFirst, byteFirst]) {
      const t = frame.slots.find((s) => s.name === "t");
      expect(t?.size).toBe(2);
    }
  });

  it("keeps declaration order and pushes the following slot past the widened one", () => {
    const frame = mainFrame(
      "module Main;\nfunction main(): void { let c: boolean = true;\n" +
        "if (c) { let t: word = 300; } else { let t: byte = 5; }\n" +
        "let u: byte = 7; }\n",
    );

    // One slot per name, in declaration order — sharing is still sharing.
    expect(frame.slots.map((s) => s.name)).toEqual(["c", "t", "u"]);
    expectPositionalLayout(frame);

    const t = frame.slots.find((s) => s.name === "t");
    const u = frame.slots.find((s) => s.name === "u");
    // `u` starts after ALL of `t`, so the wide store into `t` cannot reach it.
    expect(u?.offset).toBe((t?.offset ?? 0) + 2);
  });

  it("sizes a slot shared by three arms to the widest of them", () => {
    const frame = mainFrame(
      "module Main;\nfunction main(): void { let k: byte = 1;\n" +
        "switch (k) { case 1: let t: byte = 1; case 2: let t: word = 300;\n" +
        "default: let t: byte = 3; }\nlet u: byte = 7; }\n",
    );

    expect(frame.slots.find((s) => s.name === "t")?.size).toBe(2);
    expectPositionalLayout(frame);
  });

  it("leaves a frame with no repeated name exactly as it was", () => {
    const frame = mainFrame(
      "module Main;\nfunction main(): void { let a: byte = 1; let b: word = 300; let c: byte = 3; }\n",
    );

    expect(frame.slots.map((s) => [s.name, s.size])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 1],
    ]);
    expectPositionalLayout(frame);
  });

  it("sizes a slot shared by two loop counters to the wider counter", () => {
    const frame = mainFrame(
      "module Main;\nfunction main(): void {\n" +
        "for (let i: byte = 0 to 9) { poke($D020, i); }\n" +
        "for (let i: word = 0 to 9) { pokew($D000, i); }\n" +
        "let u: byte = 7; }\n",
    );

    expect(frame.slots.map((s) => s.name)).toEqual(["i", "u"]);
    expect(frame.slots.find((s) => s.name === "i")?.size).toBe(2);
    expectPositionalLayout(frame);
  });

  it("sizes every shared slot by its own widest declaration, independently", () => {
    const frame = mainFrame(
      "module Main;\nfunction main(): void { let c: boolean = true;\n" +
        "if (c) { let s: word = 300; let t: byte = 1; }\n" +
        "else { let s: byte = 1; let t: word = 300; } }\n",
    );

    for (const name of ["s", "t"]) {
      expect(frame.slots.find((slot) => slot.name === name)?.size).toBe(2);
    }
    expectPositionalLayout(frame);
  });

  it("sizes the slot by byte size, not by declaration order or type name", () => {
    const frame = mainFrame(
      "module Main;\nfunction main(): void { let c: boolean = true;\n" +
        "if (c) { let t: sword = 300; } else { let t: sbyte = 5; } }\n",
    );

    const t = frame.slots.find((s) => s.name === "t");
    expect(t?.size).toBe(2);
    expect(byteSize(t?.type ?? { kind: "error" })).toBe(2);
  });
});
