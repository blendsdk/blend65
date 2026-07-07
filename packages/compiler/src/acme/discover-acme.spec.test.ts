/**
 * Specification tests for ACME discovery (`discoverAcme`).
 *
 * Written from the requirements, never from the implementation. Immutable
 * oracles: the three-tier behaviour and the actionable not-found message are
 * pinned from the requirement, not from the implementation.
 *
 * The filesystem/PATH are injected via {@link AcmeProbes} so these tests never
 * touch the real environment and never require a real ACME binary.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DiagCode } from "@blend65/core";
import { discoverAcme, type AcmeProbes } from "./discover-acme.js";

/** Build probes whose behaviour is fixed per test. */
function probes(opts: {
  executable?: (path: string) => boolean;
  onPath?: (name: string) => string | null;
}): AcmeProbes {
  return {
    isExecutable: opts.executable ?? (() => false),
    findOnPath: opts.onPath ?? (() => null),
  };
}

describe("Specification: discoverAcme — three-tier resolution (ST-D1..D3)", () => {
  it("returns the explicit acmePath when it is executable, with no diagnostic (ST-D1)", () => {
    const bag = createDiagnosticBag();
    const result = discoverAcme(
      { acmePath: "/opt/acme/acme" },
      bag,
      probes({ executable: (p) => p === "/opt/acme/acme" }),
    );
    expect(result).toBe("/opt/acme/acme");
    expect(bag.hasErrors()).toBe(false);
  });

  it("falls back to the PATH-resolved acme when no explicit path is given (ST-D2)", () => {
    const bag = createDiagnosticBag();
    const result = discoverAcme(
      {},
      bag,
      probes({ onPath: (name) => (name === "acme" ? "/usr/bin/acme" : null) }),
    );
    expect(result).toBe("/usr/bin/acme");
    expect(bag.hasErrors()).toBe(false);
  });

  it("returns null and emits AcmeNotFound with the R29 message when unresolved (ST-D3)", () => {
    const bag = createDiagnosticBag();
    const result = discoverAcme({}, bag, probes({}));
    expect(result).toBeNull();
    expect(bag.hasErrors()).toBe(true);
    const errors = bag.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe(DiagCode.AcmeNotFound);
    expect(errors[0].message).toBe(
      "ACME assembler not found — install ACME and ensure it is on your PATH, " +
        "or set --acme-path / acmePath in blend65.json",
    );
  });
});
