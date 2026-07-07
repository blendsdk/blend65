/**
 * Security specification test for the terminal renderer.
 *
 * Echoed source excerpts must strip C0 controls (except TAB) and C1 controls
 * so a hostile source file cannot inject terminal escape sequences, and caret
 * columns must be computed against the sanitized line so alignment survives
 * the strip.
 * IMMUTABLE ORACLE: derived from the requirement, never from implementation.
 */

import { describe, expect, it } from "vitest";
import { renderTerminal } from "./render-terminal.js";
import { createSourceMap } from "./source-map.js";
import { makeSpan } from "./source-span.js";
import type { Diagnostic } from "./diagnostic.js";

describe("renderTerminal security (R52/PF-010)", () => {
  it("ST-18: strips ESC and C1 controls from the excerpt, preserves TAB, and aligns carets post-strip", () => {
    const sourceMap = createSourceMap();
    // Hostile line: TAB (keep), ESC 0x1B (strip), C1 U+0085 (strip), then the
    // span target `poke`. Byte layout (UTF-8):
    //   \t(1) A(1) ESC(1) B(1) U+0085(2) C(1) space(1) → span starts at byte 8.
    const hostileLine = "\tA\u001bB\u0085C poke(1);";
    const id = sourceMap.intern("hostile.blend", hostileLine + "\n");
    const diagnostic: Diagnostic = {
      code: "E10021",
      severity: "error",
      message: "diagnostic over a hostile source line",
      primarySpan: makeSpan(id, 8, 12), // `poke` in raw byte coordinates
      secondarySpans: [],
      notes: [],
    };

    const output = renderTerminal([diagnostic], sourceMap, { color: false });

    // The raw span start is byte 8 → 1-based column 9 on the location line.
    // Post-strip the excerpt is `\tABC poke(1);` — 5 bytes precede `poke`,
    // so the caret indent is 5 and the run covers the 4 bytes of `poke`.
    expect(output).toBe(
      [
        "error[E10021]: diagnostic over a hostile source line",
        "  --> hostile.blend:1:9",
        "  |",
        "1 | \tABC poke(1);",
        "  | " + " ".repeat(5) + "^".repeat(4),
      ].join("\n") + "\n",
    );

    // Explicit non-injection guarantees: no ESC byte and no C1 control from
    // the source survives into uncolored output; the TAB is preserved.
    expect(output.includes("\u001b")).toBe(false);
    expect(output.includes("\u0085")).toBe(false);
    expect(output.includes("\t")).toBe(true);
  });
});
