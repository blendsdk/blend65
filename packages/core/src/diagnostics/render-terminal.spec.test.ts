/**
 * Specification tests for the terminal diagnostic renderer.
 *
 * Golden blocks transcribed from spec Ch 14 §1 and its presentation contract.
 * IMMUTABLE ORACLE: these expectations derive from the spec, never from
 * the implementation. Security-related sanitization tests live in
 * `render-terminal.security.spec.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { renderTerminal } from "./render-terminal.js";
import { createSourceMap } from "./source-map.js";
import { makeSpan } from "./source-span.js";
import type { Diagnostic } from "./diagnostic.js";

/** Removes every SGR escape sequence from `text`. */
function stripSgr(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

/**
 * Returns the SGR parameter codes that appear immediately before the first
 * occurrence of `target` (possibly several consecutive sequences).
 */
function sgrCodesBefore(text: string, target: string): string[] {
  const idx = text.indexOf(target);
  const codes: string[] = [];
  let end = idx;
  for (;;) {
    // eslint-disable-next-line no-control-regex
    const match = /\u001b\[([0-9;]*)m$/.exec(text.slice(0, end));
    if (!match) {
      break;
    }
    codes.unshift(...match[1].split(";"));
    end -= match[0].length;
  }
  return codes;
}

/** Terse Diagnostic builder with renderer-relevant fields. */
function diag(fields: Partial<Diagnostic> & Pick<Diagnostic, "code" | "message">): Diagnostic {
  return {
    severity: "error",
    primarySpan: null,
    secondarySpans: [],
    notes: [],
    ...fields,
  };
}

/** The Ch 14 §1 sample: E10042 on line 42 of player.blend, span = bytes [4,21). */
function ch14Fixture(): { diagnostic: Diagnostic; sourceMap: ReturnType<typeof createSourceMap> } {
  const sourceMap = createSourceMap();
  const line42 = "    poke($D020, 0, 1);";
  const content = "\n".repeat(41) + line42 + "\n";
  const id = sourceMap.intern("player.blend", content);
  const lineStart = 41; // 41 bare newlines precede line 42
  return {
    sourceMap,
    diagnostic: diag({
      code: "E10042",
      message: "'poke()' expects 2 arguments — found 3",
      // Bytes [4, 21) of the line — `poke($D020, 0, 1)` excluding the `;`.
      primarySpan: makeSpan(id, lineStart + 4, lineStart + 21),
    }),
  };
}

/** The exact Ch 14 §1 golden block (uncolored) — 17 carets, no caret label. */
const CH14_GOLDEN =
  [
    "error[E10042]: 'poke()' expects 2 arguments — found 3",
    "  --> player.blend:42:5",
    "   |",
    "42 |     poke($D020, 0, 1);",
    "   | " + " ".repeat(4) + "^".repeat(17),
  ].join("\n") + "\n";

describe("renderTerminal (Ch 14 §1 / AR-105)", () => {
  // The canonical uncolored block.
  it("ST-12: renders the Ch 14 §1 block exactly (uncolored, 17 carets, no caret label)", () => {
    const { diagnostic, sourceMap } = ch14Fixture();
    expect(renderTerminal([diagnostic], sourceMap, { color: false })).toBe(CH14_GOLDEN);
  });

  // SGR variant; stripping yields the byte-for-byte uncolored golden.
  it("ST-13: colored output strips back to the uncolored golden and uses the AR-Q9 map", () => {
    const { diagnostic, sourceMap } = ch14Fixture();
    const colored = renderTerminal([diagnostic], sourceMap, { color: true });

    expect(stripSgr(colored)).toBe(CH14_GOLDEN);
    // Header prefix `error[E10042]` is bold red.
    expect(sgrCodesBefore(colored, "error[E10042]")).toEqual(expect.arrayContaining(["1", "31"]));
    // Gutter elements are cyan.
    expect(sgrCodesBefore(colored, "-->")).toEqual(expect.arrayContaining(["36"]));
    // The caret run is red (severity color, no bold).
    const caretCodes = sgrCodesBefore(colored, "^".repeat(17));
    expect(caretCodes).toEqual(expect.arrayContaining(["31"]));
    expect(caretCodes).not.toEqual(expect.arrayContaining(["1"]));
  });

  // A span-less ICE degrades to header + notes/help.
  it("ST-14: a null-span ICE renders header, notes, and help only at the fixed 3-space indent", () => {
    const sourceMap = createSourceMap();
    const ice = diag({
      code: "E90001",
      message: "internal compiler error: unexpected null frame",
      notes: ["this is a bug in the Blend65 compiler"],
      help: "please report this",
    });

    const output = renderTerminal([ice], sourceMap, { color: false });

    expect(output).toBe(
      [
        "error[E90001]: internal compiler error: unexpected null frame",
        "   = note: this is a bug in the Blend65 compiler",
        "   = help: please report this",
      ].join("\n") + "\n",
    );
  });

  // An un-interned sentinel id degrades identically.
  it("ST-15: a diagnostic on the -2 config sentinel degrades like a span-less ICE without throwing", () => {
    const sourceMap = createSourceMap(); // -2 never interned
    const configDiag = diag({
      code: "E10243",
      message: "Invalid value for 'maxErrors': expected a positive integer",
      primarySpan: makeSpan(-2, 0, 5),
      help: 'set "maxErrors" to a positive integer, e.g. 20',
    });

    const output = renderTerminal([configDiag], sourceMap, { color: false });

    expect(output).toBe(
      [
        "error[E10243]: Invalid value for 'maxErrors': expected a positive integer",
        '   = help: set "maxErrors" to a positive integer, e.g. 20',
      ].join("\n") + "\n",
    );
  });

  // A multi-line span underlines only the first line.
  it("ST-16: a span crossing a line break carets from span start to the end of the first line only", () => {
    const sourceMap = createSourceMap();
    // Line 1 is `let a = b +` (11 bytes); the span [8, 13) runs past the break.
    const id = sourceMap.intern("cross.blend", "let a = b +\nc;\n");
    const crossing = diag({
      code: "E10099",
      message: "type mismatch",
      primarySpan: makeSpan(id, 8, 13),
    });

    const output = renderTerminal([crossing], sourceMap, { color: false });

    expect(output).toBe(
      [
        "error[E10099]: type mismatch",
        "  --> cross.blend:1:9",
        "  |",
        "1 | let a = b +",
        // Carets cover bytes 8..11 (`b +` tail) — 3 carets, not the 5 of the span.
        "  | " + " ".repeat(8) + "^".repeat(3),
      ].join("\n") + "\n",
    );
  });

  // TABs render literally and count 1 byte in caret math.
  it("ST-17: a TAB before the span is rendered literally and counted as 1 byte of caret indent", () => {
    const sourceMap = createSourceMap();
    const id = sourceMap.intern("tabs.blend", "\tpoke(1);\n");
    const tabbed = diag({
      code: "E10021",
      message: "example over a tabbed line",
      primarySpan: makeSpan(id, 1, 5),
    });

    const output = renderTerminal([tabbed], sourceMap, { color: false });

    expect(output).toBe(
      [
        "error[E10021]: example over a tabbed line",
        "  --> tabs.blend:1:2",
        "  |",
        "1 | \tpoke(1);",
        "  | " + " ".repeat(1) + "^".repeat(4),
      ].join("\n") + "\n",
    );
  });

  // Secondary mini-block, notes/help alignment, per-excerpt gutter widths,
  // blank-line block separation, no footer.
  it("ST-19: renders secondary mini-blocks with their own gutter width, primary-aligned notes/help, and blank-line separation", () => {
    const sourceMap = createSourceMap();
    // Primary: line 42 (2-digit gutter). Secondary: line 7 of another file
    // (1-digit gutter) — widths must NOT be shared across sub-blocks.
    const mainId = sourceMap.intern("main.blend", "\n".repeat(41) + "    call foo();\n");
    const otherId = sourceMap.intern("other.blend", "\n".repeat(6) + "fn foo() {}\n");

    const withSecondary = diag({
      code: "E10050",
      message: "cannot call 'foo' before its definition",
      primarySpan: makeSpan(mainId, 41 + 9, 41 + 12),
      secondarySpans: [{ span: makeSpan(otherId, 6 + 3, 6 + 6), label: "defined here" }],
      notes: ["first note", "second note"],
      help: "try this",
    });
    const second = diag({
      code: "W10191",
      severity: "warning",
      message: "variable 'y' is never used",
    });

    const output = renderTerminal([withSecondary, second], sourceMap, { color: false });

    const firstBlock = [
      "error[E10050]: cannot call 'foo' before its definition",
      "  --> main.blend:42:10",
      "   |",
      "42 |     call foo();",
      "   | " + " ".repeat(9) + "^".repeat(3),
      // Secondary mini-block: own 1-digit gutter width, label after the carets.
      "  --> other.blend:7:4",
      "  |",
      "7 | fn foo() {}",
      "  | " + " ".repeat(3) + "^".repeat(3) + " defined here",
      // Notes/help align to the PRIMARY excerpt's gutter (width 2).
      "   = note: first note",
      "   = note: second note",
      "   = help: try this",
    ].join("\n");

    const secondBlock = "warning[W10191]: variable 'y' is never used";

    // One blank line between blocks; trailing newline; no summary footer.
    expect(output).toBe(`${firstBlock}\n\n${secondBlock}\n`);
  });

  // Composition edge: empty input renders as the empty string.
  it("renders an empty diagnostics array as the empty string", () => {
    expect(renderTerminal([], createSourceMap(), { color: false })).toBe("");
  });
});
