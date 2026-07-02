/**
 * Specification tests for JSONC parsing — parse-level column only (ST-6..ST-9).
 *
 * Traceability: RD-16 R2 (JSONC tolerance) and AR-P4 (best-effort recovery)
 * via 07-testing-strategy.md ST-6..ST-9. Per the PF-015 two-level split, this
 * file asserts only what is observable from `parseJsoncFile` alone; the
 * loader-level expectations (E10241/E10242 emission, CONFIG_SOURCE_ID spans,
 * dedup survival) live in `load-config.spec.test.ts` (Phase 4). Expectations
 * derive from the RD and the ST table only, never from the implementation.
 */

import { describe, expect, it } from "vitest";
import { parseJsoncFile } from "./parse.js";

describe("parseJsoncFile (parse-level ST-6..ST-9)", () => {
  it("ST-6: tolerates comments and a trailing comma with zero parse errors (R2/AC-01)", () => {
    const text = [
      "// line comment",
      "{",
      '  /* block comment */',
      '  "platform": "c64",',
      "}",
    ].join("\n");
    const result = parseJsoncFile(text);
    expect(result.parseErrors.length).toBe(0);
    expect((result.value as { platform?: unknown }).platform).toBe("c64");
  });

  it("ST-7: malformed file yields a recovered value plus >=1 parse error with an in-file byte offset (AR-P4)", () => {
    const text = '{"platform": }';
    const result = parseJsoncFile(text);
    expect(result.value).toBeDefined();
    expect(result.parseErrors.length).toBeGreaterThanOrEqual(1);
    const byteLength = Buffer.byteLength(text, "utf8");
    for (const error of result.parseErrors) {
      expect(error.offset).toBeGreaterThanOrEqual(0);
      expect(error.offset).toBeLessThan(byteLength);
    }
  });

  it("ST-8: two distinct syntax errors yield two parse errors with distinct offsets (AR-P4/AR-P2)", () => {
    const text = '{"a": , "b": }';
    const result = parseJsoncFile(text);
    expect(result.parseErrors.length).toBe(2);
    expect(result.parseErrors[0]!.offset).not.toBe(result.parseErrors[1]!.offset);
  });

  it("ST-9: recovers a top-level array value (E10242 classification is the loader's)", () => {
    const result = parseJsoncFile("[]");
    expect(Array.isArray(result.value)).toBe(true);
  });

  it("ST-9: recovers a top-level string value (E10242 classification is the loader's)", () => {
    const result = parseJsoncFile('"x"');
    expect(result.value).toBe("x");
  });
});
