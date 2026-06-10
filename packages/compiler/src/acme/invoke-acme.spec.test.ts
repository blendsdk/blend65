/**
 * Specification tests for RD-09 ACME invocation (`invokeAcme`) — ST-I1..ST-I3.
 *
 * Derived EXCLUSIVELY from `requirements/RD-09-acme-emitter.md` (R30–R33, R35–R38,
 * AC-11/12/13), the component spec
 * `plans/rd-09-acme-emitter/03-02-acme-process-layer.md`, and the testing strategy
 * `07-testing-strategy.md` (ST-I1..I3). Immutable oracles (testing.md Rule 10):
 * the success/failure contract and the ICE-on-non-zero-exit rule come from the RD.
 *
 * The child process and filesystem are injected via {@link AcmeRunner} so no test
 * spawns a real ACME binary (AR-27; CI has no ACME tier until RD-12).
 */

import { describe, expect, it, vi } from "vitest";
import { createDiagnosticBag, IceCode } from "@blend65/core";
import {
  invokeAcme,
  type AcmeInvocation,
  type AcmeRunner,
} from "./invoke-acme.js";

/** A baseline invocation descriptor; individual tests override as needed. */
function invocation(overrides: Partial<AcmeInvocation> = {}): AcmeInvocation {
  return {
    acmeExe: "/usr/bin/acme",
    asmPath: "/build/main.asm",
    binaryPath: "/build/main.prg",
    labelPath: "/build/main.lbl",
    reportPath: "/build/main.report",
    cwd: "/build",
    ...overrides,
  };
}

/** Build a runner whose exit code, stderr, and binary size are fixed per test. */
function runner(opts: {
  exitCode: number;
  stderr?: string;
  binarySize?: number;
}): AcmeRunner {
  return {
    run: vi.fn(async () => ({ exitCode: opts.exitCode, stderr: opts.stderr ?? "" })),
    binarySize: vi.fn(() => opts.binarySize ?? 0),
  };
}

describe("Specification: invokeAcme — success & failure (ST-I1..I3)", () => {
  it("returns success with artifact paths and binary size on exit 0 (ST-I1)", async () => {
    const bag = createDiagnosticBag();
    const result = await invokeAcme(invocation(), bag, runner({ exitCode: 0, binarySize: 42 }));
    expect(result.success).toBe(true);
    expect(result.binaryPath).toBe("/build/main.prg");
    expect(result.labelFilePath).toBe("/build/main.lbl");
    expect(result.binarySize).toBe(42);
    expect(bag.hasErrors()).toBe(false);
  });

  it("reports an ICE (E90001) containing ACME stderr on non-zero exit (ST-I2)", async () => {
    const bag = createDiagnosticBag();
    const result = await invokeAcme(
      invocation(),
      bag,
      runner({ exitCode: 1, stderr: "Error: x" }),
    );
    expect(result.success).toBe(false);
    expect(bag.hasErrors()).toBe(true);
    const errors = bag.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe(IceCode.Unexpected);
    expect(errors[0].message).toContain("Error: x");
  });

  it("does not delete the .asm file on failure (ST-I3)", async () => {
    const bag = createDiagnosticBag();
    const deleteAsm = vi.fn();
    const r: AcmeRunner = {
      run: vi.fn(async () => ({ exitCode: 1, stderr: "boom" })),
      binarySize: vi.fn(() => 0),
      deleteFile: deleteAsm,
    };
    await invokeAcme(invocation(), bag, r);
    // Retention (R36): the runner's optional delete hook must never be called.
    expect(deleteAsm).not.toHaveBeenCalled();
  });
});
