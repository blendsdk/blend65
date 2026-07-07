/**
 * Implementation tests for the terminal renderer.
 *
 * Covers internals and edge cases beyond the specification tests:
 * 3-digit gutter widths, EOF and empty-span carets, CRLF sources, multi-byte
 * UTF-8 byte-column math, and the color/no-color byte relationship.
 */

import { describe, expect, it } from "vitest";
import { renderTerminal } from "./render-terminal.js";
import { createSourceMap } from "./source-map.js";
import { makeSpan } from "./source-span.js";
import type { Diagnostic, SourceSpan } from "../index.js";

/** Terse error diagnostic over a span. */
function diag(span: SourceSpan | null): Diagnostic {
  return {
    code: "E10001",
    severity: "error",
    message: "test message",
    primarySpan: span,
    secondarySpans: [],
    notes: [],
  };
}

describe("renderTerminal implementation details", () => {
  it("widens the gutter for 3-digit line numbers", () => {
    const sourceMap = createSourceMap();
    const id = sourceMap.intern("long.blend", "\n".repeat(104) + "x = 1;\n");

    const output = renderTerminal([diag(makeSpan(id, 104, 105))], sourceMap, { color: false });

    expect(output).toBe(
      [
        "error[E10001]: test message",
        "  --> long.blend:105:1",
        "    |",
        "105 | x = 1;",
        "    | ^",
      ].join("\n") + "\n",
    );
  });

  it("renders a single caret for a span at end-of-file", () => {
    const sourceMap = createSourceMap();
    const id = sourceMap.intern("eof.blend", "ab");

    // Span starts exactly at the EOF byte — nothing to underline but the
    // renderer must stay total and emit the minimum 1 caret.
    const output = renderTerminal([diag(makeSpan(id, 2, 2))], sourceMap, { color: false });

    expect(output).toBe(
      [
        "error[E10001]: test message",
        "  --> eof.blend:1:3",
        "  |",
        "1 | ab",
        "  |   ^",
      ].join("\n") + "\n",
    );
  });

  it("renders a single caret for an empty span mid-line", () => {
    const sourceMap = createSourceMap();
    const id = sourceMap.intern("empty-span.blend", "abcdef\n");

    const output = renderTerminal([diag(makeSpan(id, 3, 3))], sourceMap, { color: false });

    expect(output).toBe(
      [
        "error[E10001]: test message",
        "  --> empty-span.blend:1:4",
        "  |",
        "1 | abcdef",
        "  |    ^",
      ].join("\n") + "\n",
    );
  });

  it("strips the CR of a CRLF source from the excerpt and keeps caret math in line-local bytes", () => {
    const sourceMap = createSourceMap();
    // Line 2 (`let y = 2;`) starts at byte 12 (line 1 is 10 bytes + CRLF).
    const id = sourceMap.intern("crlf.blend", "let x = 1;\r\nlet y = 2;\r\n");

    const output = renderTerminal([diag(makeSpan(id, 16, 17))], sourceMap, { color: false });

    expect(output).toBe(
      [
        "error[E10001]: test message",
        "  --> crlf.blend:2:5",
        "  |",
        "2 | let y = 2;",
        "  |     ^",
      ].join("\n") + "\n",
    );
  });

  it("computes caret indent and width in UTF-8 bytes for multi-byte content", () => {
    const sourceMap = createSourceMap();
    // `é` is 2 bytes, `€` is 3 bytes: line = `é€x = 1;` → `x` starts at byte 5.
    const id = sourceMap.intern("utf8.blend", "é€x = 1;\n");

    const output = renderTerminal([diag(makeSpan(id, 5, 6))], sourceMap, { color: false });

    expect(output).toBe(
      [
        "error[E10001]: test message",
        "  --> utf8.blend:1:6",
        "  |",
        "1 | é€x = 1;",
        // Byte-column math: 5 padding bytes before the caret.
        "  | " + " ".repeat(5) + "^",
      ].join("\n") + "\n",
    );
  });

  it("colored output differs from uncolored only by SGR sequences", () => {
    const sourceMap = createSourceMap();
    const id = sourceMap.intern("main.blend", "poke(1);\n");
    const warning: Diagnostic = {
      code: "W10191",
      severity: "warning",
      message: "example warning",
      primarySpan: makeSpan(id, 0, 4),
      secondarySpans: [],
      notes: ["a note"],
      help: "a help line",
    };

    const plain = renderTerminal([warning], sourceMap, { color: false });
    const colored = renderTerminal([warning], sourceMap, { color: true });

    expect(colored).not.toBe(plain);
    // eslint-disable-next-line no-control-regex
    expect(colored.replace(/\u001b\[[0-9;]*m/g, "")).toBe(plain);
    // Warning severity paints yellow (33), never red (31).
    expect(colored).toContain("\u001b[1;33m");
    expect(colored).not.toContain("31m");
  });

  it("skips only the unresolvable secondary span, keeping the rest of the block", () => {
    const sourceMap = createSourceMap();
    const id = sourceMap.intern("main.blend", "poke(1);\n");
    const mixed: Diagnostic = {
      code: "E10001",
      severity: "error",
      message: "test message",
      primarySpan: makeSpan(id, 0, 4),
      // Unresolvable secondary (never-interned id 7) degrades to nothing (R51).
      secondarySpans: [{ span: makeSpan(7, 0, 1), label: "elsewhere" }],
      notes: [],
    };

    const output = renderTerminal([mixed], sourceMap, { color: false });

    expect(output).toBe(
      [
        "error[E10001]: test message",
        "  --> main.blend:1:1",
        "  |",
        "1 | poke(1);",
        "  | ^^^^",
      ].join("\n") + "\n",
    );
    expect(output).not.toContain("elsewhere");
  });
});
