/**
 * Implementation tests for ACME discovery (`discoverAcme`). Written after the
 * implementation — these cover internals and edge cases beyond the spec-level
 * oracles: the non-executable explicit-path message, the no-silent-fallback
 * rule, and the injected-probe call shape.
 */

import { describe, expect, it, vi } from "vitest";
import { createDiagnosticBag, DiagCode } from "@blend65/core";
import { discoverAcme, type AcmeProbes } from "./discover-acme.js";

const neverProbes: AcmeProbes = {
  isExecutable: () => false,
  findOnPath: () => null,
};

describe("discoverAcme — explicit path tier", () => {
  it("emits a path-specific message when the explicit path is not executable", () => {
    const bag = createDiagnosticBag();
    const result = discoverAcme({ acmePath: "/no/such/acme" }, bag, neverProbes);
    expect(result).toBeNull();
    const errors = bag.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe(DiagCode.AcmeNotFound);
    expect(errors[0].message).toBe("ACME path '/no/such/acme' is not executable");
  });

  it("never falls back to PATH when an explicit path is given but invalid", () => {
    const bag = createDiagnosticBag();
    const findOnPath = vi.fn(() => "/usr/bin/acme");
    const result = discoverAcme(
      { acmePath: "/no/such/acme" },
      bag,
      { isExecutable: () => false, findOnPath },
    );
    expect(result).toBeNull();
    // Tier 2 must not be consulted once an (invalid) explicit path is supplied.
    expect(findOnPath).not.toHaveBeenCalled();
  });

  it("does not probe PATH when the explicit path resolves", () => {
    const bag = createDiagnosticBag();
    const findOnPath = vi.fn(() => null);
    const result = discoverAcme(
      { acmePath: "/opt/acme" },
      bag,
      { isExecutable: (p) => p === "/opt/acme", findOnPath },
    );
    expect(result).toBe("/opt/acme");
    expect(findOnPath).not.toHaveBeenCalled();
  });
});

describe("discoverAcme — PATH tier", () => {
  it("queries PATH for the bare `acme` name", () => {
    const bag = createDiagnosticBag();
    const findOnPath = vi.fn((name: string) => (name === "acme" ? "/usr/local/bin/acme" : null));
    const result = discoverAcme({}, bag, { isExecutable: () => false, findOnPath });
    expect(result).toBe("/usr/local/bin/acme");
    expect(findOnPath).toHaveBeenCalledWith("acme");
  });
});
