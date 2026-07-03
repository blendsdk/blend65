/**
 * Implementation tests for `parseArgs` (03-03 "Testing Requirements"):
 * the warn-as-error coercion matrix and the flag → `ParsedArgs` mapping.
 */

import { describe, expect, it } from "vitest";
import { parseArgs, type ParsedArgs } from "./args.js";

/** Parse and assert the outcome is clean args (fails the test otherwise). */
function argsOf(argv: string[]): ParsedArgs {
  const outcome = parseArgs(argv);
  if (outcome.kind !== "args") {
    throw new Error(`expected args, got ${outcome.kind}: ${JSON.stringify(outcome)}`);
  }
  return outcome.args;
}

describe("parseArgs: warn-as-error coercion", () => {
  it("coerces a bare --warn-as-error to blanket promotion (true)", () => {
    expect(argsOf(["build", "a.blend", "--warn-as-error"]).warnAsError).toBe(true);
  });

  it("accumulates repeated --warn-as-error codes into an array", () => {
    const args = argsOf([
      "build",
      "a.blend",
      "--warn-as-error",
      "W10210",
      "--warn-as-error",
      "W10191",
    ]);
    expect(args.warnAsError).toEqual(["W10210", "W10191"]);
  });

  it("leaves warnAsError undefined when the flag is absent", () => {
    expect(argsOf(["build", "a.blend"]).warnAsError).toBeUndefined();
  });
});

describe("parseArgs: command resolution", () => {
  it("resolves the default command to build with the bare file form", () => {
    const args = argsOf(["a.blend"]);
    expect(args.command).toBe("build");
    expect(args.files).toEqual(["a.blend"]);
  });

  it("resolves the check command", () => {
    expect(argsOf(["check", "a.blend"]).command).toBe("check");
  });

  it("resolves the explicit build command", () => {
    expect(argsOf(["build", "a.blend"]).command).toBe("build");
  });
});

describe("parseArgs: flag → option mapping", () => {
  it("maps every kebab flag to its camel ParsedArgs field", () => {
    const args = argsOf([
      "build",
      "main.blend",
      "--platform",
      "c64",
      "--out-dir",
      "dist",
      "--out-name",
      "game",
      "--max-errors",
      "5",
      "--diagnostics-format",
      "json",
      "--startup",
      "bare",
      "--acme-path",
      "/usr/bin/acme",
      "--emit-asm",
      "--emit-report",
    ]);

    expect(args).toMatchObject({
      command: "build",
      files: ["main.blend"],
      platform: "c64",
      outDir: "dist",
      outName: "game",
      maxErrors: 5,
      diagnosticsFormat: "json",
      startup: "bare",
      acmePath: "/usr/bin/acme",
      emitAsm: true,
      emitReport: true,
    });
  });

  it("maps yargs boolean negation (--no-quiet → quiet:false)", () => {
    expect(argsOf(["build", "a.blend", "--no-quiet"]).quiet).toBe(false);
    expect(argsOf(["build", "a.blend", "--quiet"]).quiet).toBe(true);
  });

  it("leaves config-backed flags undefined when unset (config default survives)", () => {
    const args = argsOf(["build", "a.blend"]);
    expect(args.optimize).toBeUndefined();
    expect(args.quiet).toBeUndefined();
    expect(args.outDir).toBeUndefined();
    expect(args.diagnosticsFormat).toBeUndefined();
  });
});

describe("parseArgs: failures and help", () => {
  it("returns a fail outcome for an unknown flag", () => {
    expect(parseArgs(["build", "--bogus"]).kind).toBe("fail");
  });

  it("returns a fail outcome for a bad choice value", () => {
    expect(parseArgs(["build", "a.blend", "--startup", "nope"]).kind).toBe("fail");
  });

  it("returns a help outcome for --help and --version", () => {
    expect(parseArgs(["--help"]).kind).toBe("help");
    expect(parseArgs(["--version"]).kind).toBe("help");
  });
});
