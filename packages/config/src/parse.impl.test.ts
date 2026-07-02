/**
 * Implementation tests for JSONC parsing internals (execution plan task
 * 2.3.2): UTF-8 BOM handling (AR-P10), empty files, code-unit→byte offset
 * conversion on non-ASCII content (PF-017), and an F9 message-format smoke
 * check building line/col via core's `LineMap` (PF-018).
 */

import { Buffer } from "node:buffer";
import { LineMap } from "@blend65/core";
import { describe, expect, it } from "vitest";
import { CONFIG_SOURCE_ID } from "./types.js";
import { createOffsetConverter, parseJsoncFile } from "./parse.js";

describe("parseJsoncFile internals", () => {
  it("strips a leading UTF-8 BOM without reporting a parse error (AR-P10)", () => {
    const result = parseJsoncFile('\uFEFF{"platform":"c64"}');
    expect(result.parseErrors.length).toBe(0);
    expect((result.value as { platform?: unknown }).platform).toBe("c64");
    expect(result.text.startsWith("\uFEFF")).toBe(false);
  });

  it("returns the input unchanged as `text` when there is no BOM", () => {
    const text = '{"platform":"c64"}';
    expect(parseJsoncFile(text).text).toBe(text);
  });

  it("degrades an empty file to an undefined value plus one parse error", () => {
    const result = parseJsoncFile("");
    expect(result.value).toBeUndefined();
    expect(result.parseErrors.length).toBe(1);
    expect(result.parseErrors[0]!.offset).toBe(0);
  });

  it("converts parse-error offsets to UTF-8 byte offsets on non-ASCII content (PF-017)", () => {
    // 'é' is 2 UTF-8 bytes and '☕' is 3, so byte offsets diverge from
    // code-unit offsets for everything after the comment.
    const text = '// café ☕\n{"platform": }';
    const result = parseJsoncFile(text);
    expect(result.parseErrors.length).toBeGreaterThanOrEqual(1);
    const bytes = Buffer.from(text, "utf8");
    const offset = result.parseErrors[0]!.offset;
    // The ValueExpected error points at the closing brace — verify via the
    // BYTE at the reported offset, which only matches if conversion happened.
    expect(String.fromCharCode(bytes[offset]!)).toBe("}");
  });

  it("supports F9 message formatting: LineMap over the parsed text yields line/col (PF-018)", () => {
    const text = '// header\n{\n  "platform": \n}';
    const result = parseJsoncFile(text);
    expect(result.parseErrors.length).toBeGreaterThanOrEqual(1);
    const lineMap = new LineMap(CONFIG_SOURCE_ID, result.text);
    const { line, column } = lineMap.getLineCol(result.parseErrors[0]!.offset);
    // The error sits on line 4 (the lone `}`) or line 3 depending on parser
    // anchoring — assert it is within the file and formats plausibly.
    expect(line).toBeGreaterThanOrEqual(3);
    expect(line).toBeLessThanOrEqual(4);
    expect(column).toBeGreaterThanOrEqual(1);
    expect(`blend65.json:${line}:${column}`).toMatch(/^blend65\.json:\d+:\d+$/);
  });
});

describe("createOffsetConverter (PF-017)", () => {
  it("is the identity for pure-ASCII text", () => {
    const convert = createOffsetConverter('{"a": 1}');
    expect(convert(0)).toBe(0);
    expect(convert(5)).toBe(5);
  });

  it("accounts for multi-byte characters before the offset", () => {
    const text = 'é☕x'; // é: 1 cu / 2 bytes, ☕: 1 cu / 3 bytes
    const convert = createOffsetConverter(text);
    expect(convert(0)).toBe(0);
    expect(convert(1)).toBe(2); // after é
    expect(convert(2)).toBe(5); // after é + ☕
    expect(convert(3)).toBe(6); // after x
  });

  it("handles astral (surrogate-pair) characters", () => {
    const text = "𝄞x"; // U+1D11E: 2 code units, 4 UTF-8 bytes
    const convert = createOffsetConverter(text);
    expect(convert(2)).toBe(4);
    expect(convert(3)).toBe(5);
  });
});
