/**
 * Specification tests for config validation.
 *
 * Shape tests cover unknown keys and wrong types (validateShape); semantic
 * tests cover the post-merge value rules (validateSemantics). Assertions
 * target diagnostic code + severity + salient substrings and span
 * distinctness only — never full message prose. Written before the
 * implementation exists.
 */

import { createDiagnosticBag, type DiagnosticBag } from "@blend65/core";
import { describe, expect, it } from "vitest";
import type { BlendConfig } from "./types.js";
import { CONFIG_SOURCE_ID } from "./types.js";
import { createOffsetConverter, parseJsoncFile } from "./parse.js";
import { mergeConfig } from "./merge.js";
import { validateShape, validateSemantics } from "./validate.js";

/** Runs the shape stage over a JSONC text, returning the bag and valid keys. */
function runShape(text: string): { bag: DiagnosticBag; values: Partial<BlendConfig> } {
  const bag = createDiagnosticBag();
  const parsed = parseJsoncFile(text);
  const values = validateShape({
    bag,
    sourceId: CONFIG_SOURCE_ID,
    tree: parsed.tree,
    toByteOffset: createOffsetConverter(parsed.text),
    configText: parsed.text,
  });
  return { bag, values };
}

/** Runs shape → merge → semantics over a JSONC text (the full validation pipeline). */
function runPipeline(
  text: string,
  options?: {
    overrides?: Partial<BlendConfig>;
    knownPlatforms?: readonly string[];
  },
): { bag: DiagnosticBag; config: BlendConfig } {
  const bag = createDiagnosticBag();
  const parsed = parseJsoncFile(text);
  const toByteOffset = createOffsetConverter(parsed.text);
  const fileValues = validateShape({
    bag,
    sourceId: CONFIG_SOURCE_ID,
    tree: parsed.tree,
    toByteOffset,
    configText: parsed.text,
  });
  const config = mergeConfig(fileValues, options?.overrides, {
    configPath: "/proj/blend65.json",
    projectRoot: "/proj",
  });
  validateSemantics({
    bag,
    sourceId: CONFIG_SOURCE_ID,
    config,
    tree: parsed.tree,
    toByteOffset,
    configText: parsed.text,
    knownPlatforms: options?.knownPlatforms,
  });
  return { bag, config };
}

describe("validateShape (ST-10..ST-12, ST-16 / R19, R20)", () => {
  it("ST-10: an unknown key is a WARNING (W10240), not an error (AC-05)", () => {
    const { bag } = runShape('{"platform":"c64", "platfrom":"c64"}');
    const warnings = bag.getWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0]!.code).toBe("W10240");
    expect(warnings[0]!.message).toContain("platfrom");
    expect(bag.getErrors().length).toBe(0);
  });

  it("ST-11: two unknown keys yield TWO W10240 warnings with distinct span offsets (AR-P2)", () => {
    const { bag } = runShape('{"foo": 1, "bar": 2}');
    const warnings = bag.getWarnings().filter((d) => d.code === "W10240");
    expect(warnings.length).toBe(2);
    expect(warnings[0]!.primarySpan?.start).not.toBe(warnings[1]!.primarySpan?.start);
  });

  it("ST-12: a wrong-typed known key is E10243 and falls back to its default (AC-06)", () => {
    const { bag, values } = runShape('{"maxErrors": "twenty"}');
    const errors = bag.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0]!.code).toBe("E10243");
    expect(errors[0]!.message).toContain("maxErrors");
    expect(errors[0]!.message).toContain("number");
    expect("maxErrors" in values).toBe(false);
    const config = mergeConfig(values, undefined, {
      configPath: "/proj/blend65.json",
      projectRoot: "/proj",
    });
    expect(config.maxErrors).toBe(20);
  });

  it("ST-16: warnAsError accepts both boolean and string[] forms verbatim (R13)", () => {
    const boolRun = runPipeline('{"platform":"c64", "warnAsError": true}');
    expect(boolRun.config.warnAsError).toBe(true);
    expect(boolRun.bag.count()).toBe(0);

    const arrayRun = runPipeline('{"platform":"c64", "warnAsError": ["W10130"]}');
    expect(arrayRun.config.warnAsError).toEqual(["W10130"]);
    expect(arrayRun.bag.count()).toBe(0);
  });
});

describe("validateSemantics value rules (ST-13..ST-15, ST-17 / §4.3 step 6)", () => {
  it.each([0, -5, 2.5])("ST-13: maxErrors %s violates the integer >= 1 rule (E10243, AC-09)", (bad) => {
    const { bag } = runPipeline(`{"platform":"c64", "maxErrors": ${bad}}`);
    const errors = bag.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0]!.code).toBe("E10243");
    expect(errors[0]!.message).toContain("maxErrors");
  });

  it("ST-14: an invalid diagnosticsFormat names the valid literals (R15)", () => {
    const { bag } = runPipeline('{"platform":"c64", "diagnosticsFormat": "xml"}');
    const errors = bag.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0]!.code).toBe("E10243");
    expect(errors[0]!.message).toContain("terminal");
    expect(errors[0]!.message).toContain("json");
  });

  it("ST-15: an invalid startup mode names the valid literals (R18)", () => {
    const { bag } = runPipeline('{"platform":"c64", "startup": "fast"}');
    const errors = bag.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0]!.code).toBe("E10243");
    for (const literal of ["auto", "terminating", "minimal", "bare"]) {
      expect(errors[0]!.message).toContain(literal);
    }
  });

  it("ST-17: non-W-code entries in warnAsError and suppressWarnings are E10243 each (§4.3 step 6)", () => {
    const promoted = runPipeline('{"platform":"c64", "warnAsError": ["E10001"]}');
    expect(promoted.bag.getErrors().length).toBe(1);
    expect(promoted.bag.getErrors()[0]!.code).toBe("E10243");

    const suppressed = runPipeline('{"platform":"c64", "suppressWarnings": ["banana"]}');
    expect(suppressed.bag.getErrors().length).toBe(1);
    expect(suppressed.bag.getErrors()[0]!.code).toBe("E10243");
  });
});

describe("validateSemantics platform & patterns (ST-18..ST-24)", () => {
  it("ST-18: an unknown platform lists the offender and the available names (E10244, AC-07)", () => {
    const { bag } = runPipeline('{"platform":"c65"}', { knownPlatforms: ["c64", "cx16"] });
    const errors = bag.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0]!.code).toBe("E10244");
    for (const name of ["c65", "c64", "cx16"]) {
      expect(errors[0]!.message).toContain(name);
    }
  });

  it("ST-19: the platform-membership check is skipped when knownPlatforms is omitted (R21)", () => {
    const { bag } = runPipeline('{"platform":"c65"}');
    const codes = bag.getAll().map((d) => d.code);
    expect(codes).not.toContain("E10244");
    expect(codes).not.toContain("E10245");
  });

  it("ST-20: platform unset after merge is E10245 (R31, AC-09)", () => {
    const { bag } = runPipeline("{}");
    const errors = bag.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0]!.code).toBe("E10245");
  });

  it.each([
    ['{"platform":"c64", "include": ["/etc/**"]}', "/etc/**"],
    ['{"platform":"c64", "include": ["../other/**"]}', "../other/**"],
    ['{"platform":"c64", "exclude": ["a/../../b"]}', "a/../../b"],
  ])("ST-21: root-escaping pattern in %s is E10246 (R29/AR-P5, AC-09)", (text, pattern) => {
    const { bag } = runPipeline(text);
    const errors = bag.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0]!.code).toBe("E10246");
    expect(errors[0]!.message).toContain(pattern);
  });

  it("ST-22: valid relative patterns pass and land in BlendConfig verbatim (AC-10)", () => {
    const { bag, config } = runPipeline(
      '{"platform":"c64", "include": ["src/**/*.blend"], "exclude": ["src/test/**"]}',
    );
    expect(bag.count()).toBe(0);
    expect(config.include).toEqual(["src/**/*.blend"]);
    expect(config.exclude).toEqual(["src/test/**"]);
  });

  it("ST-23: an empty include array is accepted — emptiness is RD-15's concern (§4.3 edge table)", () => {
    const { bag, config } = runPipeline('{"platform":"c64", "include": []}');
    expect(bag.count()).toBe(0);
    expect(config.include).toEqual([]);
  });

  it("ST-24: a code both promoted and suppressed is one W10241 WARNING; suppression wins (R30, AC-09)", () => {
    const { bag } = runPipeline(
      '{"platform":"c64", "warnAsError": ["W10130"], "suppressWarnings": ["W10130"]}',
    );
    const warnings = bag.getWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0]!.code).toBe("W10241");
    expect(warnings[0]!.message).toContain("W10130");
    expect(bag.getErrors().length).toBe(0);
  });
});
