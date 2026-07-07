/**
 * Implementation tests for the VICE label-file parser (`parseLabelFile`).
 * Written after the implementation — these cover internals and edge cases
 * beyond the spec-level oracles: whitespace tolerance, leading/trailing blank
 * lines, the 4-hex-digit boundary, uppercase hex, and a trailing newline.
 */

import { describe, expect, it } from "vitest";
import { parseLabelFile } from "./label-file.js";

describe("parseLabelFile — whitespace & blank-line tolerance", () => {
  it("ignores leading and trailing blank lines and surrounding whitespace", () => {
    const content = "\n  al C:c000 .start  \n\n";
    const map = parseLabelFile(content);
    expect(map.get("start")).toBe(0xc000);
    expect(map.size).toBe(1);
  });

  it("tolerates a trailing newline without producing a phantom entry", () => {
    const map = parseLabelFile("al C:1234 .a\n");
    expect(map.size).toBe(1);
    expect(map.get("a")).toBe(0x1234);
  });
});

describe("parseLabelFile — hex handling", () => {
  it("parses uppercase hex addresses", () => {
    expect(parseLabelFile("al C:ABCD .upper").get("upper")).toBe(0xabcd);
  });

  it("parses the boundary addresses $0000 and $FFFF", () => {
    const map = parseLabelFile("al C:0000 .lo\nal C:ffff .hi");
    expect(map.get("lo")).toBe(0x0000);
    expect(map.get("hi")).toBe(0xffff);
  });

  it("skips a line whose address is not exactly 4 hex digits", () => {
    // 3-digit and 5-digit addresses do not match the VICE 4-digit format.
    const map = parseLabelFile("al C:fff .short\nal C:10000 .long\nal C:1000 .ok");
    expect(map.has("short")).toBe(false);
    expect(map.has("long")).toBe(false);
    expect(map.get("ok")).toBe(0x1000);
  });
});

describe("parseLabelFile — last-wins on duplicate labels", () => {
  it("keeps the last address when the same label appears twice", () => {
    const map = parseLabelFile("al C:1000 .dup\nal C:2000 .dup");
    expect(map.get("dup")).toBe(0x2000);
    expect(map.size).toBe(1);
  });
});
