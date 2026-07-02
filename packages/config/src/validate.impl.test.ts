/**
 * Implementation tests for validation internals (execution plan task 3.3.1):
 * synthetic-span scheme stability (PF-019), the AR-P5 pattern rule's `\`
 * normalization and win32 absolute/UNC forms (security tier — R29), and
 * boolean-vs-array `warnAsError` narrowing.
 */

import { createDiagnosticBag } from "@blend65/core";
import { describe, expect, it } from "vitest";
import { CONFIG_SCHEMA } from "./defaults.js";
import { mergeConfig } from "./merge.js";
import { CONFIG_SOURCE_ID, SYNTHETIC_SPAN_STRIDE } from "./types.js";
import {
  isPatternInsideRoot,
  RESERVED_ORDINAL_FILE_NOT_FOUND,
  RESERVED_ORDINAL_MISSING_PLATFORM,
  syntheticSpan,
  validateSemantics,
} from "./validate.js";

const ORIGIN = { configPath: null, projectRoot: "/proj" };

describe("synthetic-span scheme (AR-P2/PF-019)", () => {
  it("occupies the negative coordinate space, disjoint from byte offsets", () => {
    const span = syntheticSpan(CONFIG_SOURCE_ID, 0, 0);
    expect(span.start).toBeLessThan(0);
    expect(span.end).toBe(span.start);
    expect(span.sourceId).toBe(CONFIG_SOURCE_ID);
  });

  it("gives distinct starts per ordinal and per entry index (dedup survival)", () => {
    const seen = new Set<number>();
    for (let ordinal = 0; ordinal <= RESERVED_ORDINAL_MISSING_PLATFORM; ordinal++) {
      for (let entry = 0; entry < 3; entry++) {
        seen.add(syntheticSpan(CONFIG_SOURCE_ID, ordinal, entry).start);
      }
    }
    expect(seen.size).toBe((RESERVED_ORDINAL_MISSING_PLATFORM + 1) * 3);
  });

  it("is stable: start = -(2 + ordinal * stride + entryIndex)", () => {
    expect(syntheticSpan(CONFIG_SOURCE_ID, 0, 0).start).toBe(-2);
    expect(syntheticSpan(CONFIG_SOURCE_ID, 1, 0).start).toBe(-(2 + SYNTHETIC_SPAN_STRIDE));
    expect(syntheticSpan(CONFIG_SOURCE_ID, 1, 5).start).toBe(-(2 + SYNTHETIC_SPAN_STRIDE + 5));
  });

  it("reserves post-schema ordinals for E10240/E10245", () => {
    expect(RESERVED_ORDINAL_FILE_NOT_FOUND).toBe(CONFIG_SCHEMA.size);
    expect(RESERVED_ORDINAL_MISSING_PLATFORM).toBe(CONFIG_SCHEMA.size + 1);
  });

  it("keeps override-sourced same-code diagnostics dedup-distinct across array entries", () => {
    const bag = createDiagnosticBag();
    const config = mergeConfig({}, { platform: "c64", suppressWarnings: ["bad1", "bad2"] }, ORIGIN);
    validateSemantics({
      bag,
      sourceId: CONFIG_SOURCE_ID,
      config,
      overrides: { platform: "c64", suppressWarnings: ["bad1", "bad2"] },
    });
    const errors = bag.getErrors().filter((d) => d.code === "E10243");
    expect(errors.length).toBe(2);
    expect(errors[0]!.primarySpan?.start).not.toBe(errors[1]!.primarySpan?.start);
  });
});

describe("isPatternInsideRoot (R29/AR-P5 security tier)", () => {
  it.each([
    ["src/**/*.blend", true],
    ["**/*.blend", true],
    ["a/b/c", true],
    ["..", false],
    ["../x", false],
    ["a/../../b", false],
    ["/etc/passwd", false],
    ["/abs/**", false],
  ])("POSIX form %s → inside=%s", (pattern, inside) => {
    expect(isPatternInsideRoot(pattern)).toBe(inside);
  });

  it.each([
    ["C:\\Windows\\**", false],
    ["c:/lower/drive", false],
    ["\\\\server\\share\\**", false],
    ["\\absolute-from-root", false],
  ])("win32 absolute/UNC form %s is rejected", (pattern, inside) => {
    expect(isPatternInsideRoot(pattern)).toBe(inside);
  });

  it("normalizes backslash separators before the `..` segment check", () => {
    expect(isPatternInsideRoot("a\\..\\b")).toBe(false);
    expect(isPatternInsideRoot("src\\sub\\*.blend")).toBe(true);
  });

  it("does not reject `..` as a substring of a legitimate segment", () => {
    expect(isPatternInsideRoot("a..b/c")).toBe(true);
    expect(isPatternInsideRoot("..hidden/x")).toBe(true);
  });
});

describe("warnAsError boolean-vs-array narrowing", () => {
  it("runs no entry rule and no overlap check for the boolean forms", () => {
    for (const value of [true, false]) {
      const bag = createDiagnosticBag();
      const config = mergeConfig(
        { platform: "c64", warnAsError: value, suppressWarnings: ["W10130"] },
        undefined,
        ORIGIN,
      );
      validateSemantics({ bag, sourceId: CONFIG_SOURCE_ID, config });
      expect(bag.count()).toBe(0);
    }
  });

  it("applies the W-code entry rule only to the array form", () => {
    const bag = createDiagnosticBag();
    const config = mergeConfig({ platform: "c64", warnAsError: ["nope"] }, undefined, ORIGIN);
    validateSemantics({ bag, sourceId: CONFIG_SOURCE_ID, config });
    const errors = bag.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0]!.code).toBe("E10243");
    expect(errors[0]!.message).toContain("warnAsError");
  });
});
