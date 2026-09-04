import { describe, expect, it } from "vitest";

import {
  createStructuredCaseDefinitionsV1,
  resolveStructuredCaseAuthorityV1,
} from "./structured-case-families.js";
import { buildStructuredCaseRegistryV1 } from "./structured-case-registry.js";

function expectDeeplyFrozen(value: unknown, path = "$"): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value), path).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    expectDeeplyFrozen(Reflect.get(value, key), `${path}.${String(key)}`);
  }
}

function requireAuthority(caseId: string) {
  const result = resolveStructuredCaseAuthorityV1(caseId);
  expect(result).toMatchObject({ ok: true, diagnostics: [] });
  if (!result.ok) throw new TypeError("expected structured case authority");
  return result.authority;
}

describe("structured case authority snapshots", () => {
  it("uses distinct stable programs and authority identities for the four scalar-call contracts", () => {
    const caseIds = [
      "case.structured.call-argument-order-v1",
      "case.structured.scalar-copy-v1",
      "case.structured.scalar-signatures-v1",
      "case.structured.scalar-returns-v1",
    ] as const;
    const authorities = caseIds.map(requireAuthority);
    expect(new Set(authorities.map(({ caseDigest }) => caseDigest)).size).toBe(caseIds.length);
    expect(
      new Set(
        authorities.map(({ generatedCase }) => generatedCase.projection.module.path.join(".")),
      ).size,
    ).toBe(caseIds.length);
  });

  it("deep-freezes definitions before registration and every semantic authority component", () => {
    const definitions = createStructuredCaseDefinitionsV1();
    expectDeeplyFrozen(definitions);

    const registry = buildStructuredCaseRegistryV1();
    for (const authority of registry.values()) expectDeeplyFrozen(authority);
    const placed = registry.get("case.structured.runtime-wrap-oracle-v1");
    expect(placed?.oracleInput.arrayPlacement?.bindings).toHaveLength(1);
    expect(
      Reflect.set(placed?.oracleInput.arrayPlacement?.bindings[0] ?? {}, "baseAddress", 0),
    ).toBe(false);
    expect(
      registry.get("case.structured.runtime-wrap-oracle-v1")?.oracleInput.arrayPlacement
        ?.bindings[0]?.baseAddress,
    ).toBe(0xfff0);
  });

  it("returns a fresh closed projection while retaining the opaque oracle capability", () => {
    const first = requireAuthority("case.structured.branch-arms-v1");
    const second = requireAuthority("case.structured.branch-arms-v1");
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(first.oracleSuite).toBe(second.oracleSuite);
    expectDeeplyFrozen(first);
    expect(first.sourceProvenance.caseIdentity.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });
});
