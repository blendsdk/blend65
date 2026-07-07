/**
 * Implementation tests for ACME invocation (`invokeAcme`). Written after the
 * implementation — these cover internals beyond the spec-level oracles: the
 * argv array shape (no shell), the presence of the label-dump and report
 * flags, the working directory, and the PRG-header-excluding binary size.
 */

import { describe, expect, it, vi } from "vitest";
import { createDiagnosticBag } from "@blend65/core";
import {
  invokeAcme,
  type AcmeInvocation,
  type AcmeRunner,
} from "./invoke-acme.js";

function invocation(): AcmeInvocation {
  return {
    acmeExe: "/usr/bin/acme",
    asmPath: "/build/main.asm",
    binaryPath: "/build/main.prg",
    labelPath: "/build/main.lbl",
    reportPath: "/build/main.report",
    cwd: "/build",
  };
}

describe("invokeAcme — argv & process shape", () => {
  it("passes an explicit argv array (no shell) including vicelabels and report flags", async () => {
    const bag = createDiagnosticBag();
    const run = vi.fn(
      async (_exe: string, _argv: readonly string[], _cwd: string) => ({
        exitCode: 0,
        stderr: "",
      }),
    );
    const runner: AcmeRunner = { run, binarySize: () => 0 };
    await invokeAcme(invocation(), bag, runner);

    expect(run).toHaveBeenCalledTimes(1);
    const [exe, argv, cwd] = run.mock.calls[0];
    expect(exe).toBe("/usr/bin/acme");
    expect(cwd).toBe("/build");
    // argv is an array (injection-safe), and carries --vicelabels, --report, and
    // the .asm. The label flag is `--vicelabels`, NOT `-l` — ACME's
    // `-l`/`--symbollist` writes a native format `parseLabelFile` cannot
    // read, leaving `symbolMap` empty for every real build.
    // The binary output is driven by the serializer's `!to "<name>.prg", cbm`
    // directive, NOT `-o` — passing `-o` makes ACME emit headerless "plain"
    // output, dropping the c64 PRG load-address header.
    expect(Array.isArray(argv)).toBe(true);
    expect(argv).not.toContain("-o");
    expect(argv).not.toContain("-l");
    expect(argv).toContain("--vicelabels");
    expect(argv).toContain("/build/main.lbl");
    expect(argv).toContain("--report");
    expect(argv).toContain("/build/main.report");
    expect(argv).toContain("/build/main.asm");
  });

  it("reports the binary size returned by the runner on success", async () => {
    const bag = createDiagnosticBag();
    const runner: AcmeRunner = {
      run: async () => ({ exitCode: 0, stderr: "" }),
      binarySize: () => 100,
    };
    const result = await invokeAcme(invocation(), bag, runner);
    expect(result.binarySize).toBe(100);
  });
});

describe("invokeAcme — failure classification", () => {
  it("embeds the exit code and asm path in the ICE message", async () => {
    const bag = createDiagnosticBag();
    const runner: AcmeRunner = {
      run: async () => ({ exitCode: 7, stderr: "syntax error" }),
      binarySize: () => 0,
    };
    const result = await invokeAcme(invocation(), bag, runner);
    expect(result.success).toBe(false);
    const msg = bag.getErrors()[0].message;
    expect(msg).toContain("exit 7");
    expect(msg).toContain("/build/main.asm");
    expect(msg).toContain("syntax error");
  });

  it("does not query binarySize on failure", async () => {
    const bag = createDiagnosticBag();
    const binarySize = vi.fn(() => 0);
    const runner: AcmeRunner = {
      run: async () => ({ exitCode: 1, stderr: "" }),
      binarySize,
    };
    await invokeAcme(invocation(), bag, runner);
    expect(binarySize).not.toHaveBeenCalled();
  });
});
