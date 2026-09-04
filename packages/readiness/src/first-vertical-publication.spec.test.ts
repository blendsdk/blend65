import { describe, expect, it, vi } from "vitest";

import {
  COMBINED_STRUCTURED_CASE_ID,
  EXPECTED_FIRST_VERTICAL_BINDINGS,
  EXPECTED_FIRST_VERTICAL_CASE_IDS,
  EXPECTED_FIRST_VERTICAL_RULE_IDS,
} from "./test-fixtures/structured-phase1-authority-spec-fixture.js";

type UnknownCallable = (...args: unknown[]) => unknown;

const LIST_SHAPE_ONLY_CASE_ID = "case.structured.first-vertical-list-shape-only-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, description: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`expected ${description}`);
  }
  return value;
}

function requireArray(value: unknown, description: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`expected ${description}`);
  }
  return value;
}

function requireString(value: unknown, description: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`expected ${description}`);
  }
  return value;
}

function isCallable(value: unknown): value is UnknownCallable {
  return typeof value === "function";
}

function requireCallable(module: Record<string, unknown>, name: string): UnknownCallable {
  const value = module[name];
  if (!isCallable(value)) {
    throw new TypeError(`missing ${name}`);
  }
  return value;
}

function requireValidated(result: unknown): Record<string, unknown> {
  const record = requireRecord(result, "candidate validation result");
  expect(record).toMatchObject({
    ok: true,
    candidateDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
    diagnostics: [],
  });
  return requireRecord(record.candidate, "validated candidate");
}

function expectFirstDiagnostic(result: unknown, code: string, path: string): void {
  const record = requireRecord(result, "rejected candidate result");
  expect(record).toMatchObject({
    ok: false,
    diagnostics: [expect.objectContaining({ code, path })],
  });
  expect(record).not.toHaveProperty("candidate");
  expect(record).not.toHaveProperty("candidateDigest");
}

function candidateRows(candidate: Record<string, unknown>): Record<string, unknown>[] {
  return requireArray(candidate.evidenceBindings, "evidence bindings").map((row) =>
    requireRecord(row, "evidence binding"),
  );
}

function rowEvidence(row: Record<string, unknown>): Record<string, unknown>[] {
  return requireArray(row.evidence, "binding evidence").map((entry) =>
    requireRecord(entry, "evidence entry"),
  );
}

async function publicationApi(): Promise<Record<string, unknown>> {
  return vi.importActual<Record<string, unknown>>("./first-vertical-publication.js");
}

async function authorityApi(): Promise<Record<string, unknown>> {
  return vi.importActual<Record<string, unknown>>("./structured-case-families.js");
}

describe("first structured publication candidate", () => {
  it("constructs only the exact lexical rules and authenticated case bindings", async () => {
    const [publication, authority] = await Promise.all([publicationApi(), authorityApi()]);
    const createCandidate = requireCallable(
      publication,
      "createFirstVerticalPublicationCandidateV2",
    );
    const validateCandidate = requireCallable(
      publication,
      "validateFirstVerticalPublicationCandidateV2",
    );
    const resolveAuthority = requireCallable(authority, "resolveStructuredCaseAuthorityV1");
    const candidate = requireRecord(createCandidate(), "first vertical candidate");

    expect(publication.FIRST_VERTICAL_RULE_IDS_V1).toEqual(EXPECTED_FIRST_VERTICAL_RULE_IDS);
    expect(publication.FIRST_VERTICAL_CASE_IDS_V1).toEqual(EXPECTED_FIRST_VERTICAL_CASE_IDS);
    expect(candidate.schemaVersion).toBe(2);
    expect(candidate.firstVerticalRuleIds).toEqual(EXPECTED_FIRST_VERTICAL_RULE_IDS);

    const rows = candidateRows(candidate);
    expect(
      rows.map((row) => ({
        ruleId: row.ruleId,
        caseIds: rowEvidence(row).map((entry) => entry.caseId),
      })),
    ).toEqual(EXPECTED_FIRST_VERTICAL_BINDINGS);

    for (const row of rows) {
      for (const entry of rowEvidence(row)) {
        const caseId = requireString(entry.caseId, "evidence case id");
        const resolved = requireRecord(resolveAuthority(caseId), "case authority result");
        expect(resolved).toMatchObject({ ok: true, diagnostics: [] });
        const resolvedAuthority = requireRecord(resolved.authority, "case authority");
        expect(entry.caseDigest).toBe(resolvedAuthority.caseDigest);
      }
    }

    expect(requireValidated(validateCandidate(candidate))).toEqual(candidate);
  });

  it("returns fresh deterministic candidates whose identities survive caller clone mutation", async () => {
    const publication = await publicationApi();
    const createCandidate = requireCallable(
      publication,
      "createFirstVerticalPublicationCandidateV2",
    );
    const validateCandidate = requireCallable(
      publication,
      "validateFirstVerticalPublicationCandidateV2",
    );
    const first = requireRecord(createCandidate(), "first candidate");
    const second = requireRecord(createCandidate(), "second candidate");
    const firstResult = requireRecord(validateCandidate(first), "first validation");
    const secondResult = requireRecord(validateCandidate(second), "second validation");

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(secondResult).toEqual(firstResult);

    const callerClone = requireRecord(structuredClone(first), "caller candidate clone");
    requireArray(callerClone.firstVerticalRuleIds, "caller rule ids")[0] = "rule.forged";
    expect(createCandidate()).toEqual(first);
  });

  it("rejects shuffled, duplicate, and omitted rules at their exact population paths", async () => {
    const publication = await publicationApi();
    const createCandidate = requireCallable(
      publication,
      "createFirstVerticalPublicationCandidateV2",
    );
    const validateCandidate = requireCallable(
      publication,
      "validateFirstVerticalPublicationCandidateV2",
    );

    const shuffled = requireRecord(structuredClone(createCandidate()), "shuffled candidate");
    const shuffledRules = requireArray(shuffled.firstVerticalRuleIds, "shuffled rule ids");
    [shuffledRules[0], shuffledRules[1]] = [shuffledRules[1], shuffledRules[0]];
    expectFirstDiagnostic(
      validateCandidate(shuffled),
      "first-vertical.rule-population",
      "/firstVerticalRuleIds/0",
    );

    const duplicate = requireRecord(structuredClone(createCandidate()), "duplicate candidate");
    const duplicateRules = requireArray(duplicate.firstVerticalRuleIds, "duplicate rule ids");
    duplicateRules[1] = duplicateRules[0];
    expectFirstDiagnostic(
      validateCandidate(duplicate),
      "first-vertical.rule-population",
      "/firstVerticalRuleIds/1",
    );

    const omitted = requireRecord(structuredClone(createCandidate()), "omitted-rule candidate");
    requireArray(omitted.firstVerticalRuleIds, "omitted rule ids").pop();
    expectFirstDiagnostic(
      validateCandidate(omitted),
      "first-vertical.rule-population",
      "/firstVerticalRuleIds",
    );
  });

  it("rejects missing and reordered binding rows at the first structural difference", async () => {
    const publication = await publicationApi();
    const createCandidate = requireCallable(
      publication,
      "createFirstVerticalPublicationCandidateV2",
    );
    const validateCandidate = requireCallable(
      publication,
      "validateFirstVerticalPublicationCandidateV2",
    );

    const missing = requireRecord(structuredClone(createCandidate()), "missing-binding candidate");
    requireArray(missing.evidenceBindings, "missing binding rows").pop();
    expectFirstDiagnostic(
      validateCandidate(missing),
      "first-vertical.binding-population",
      "/evidenceBindings",
    );

    const reordered = requireRecord(
      structuredClone(createCandidate()),
      "reordered-binding candidate",
    );
    const rows = requireArray(reordered.evidenceBindings, "reordered binding rows");
    [rows[0], rows[1]] = [rows[1], rows[0]];
    expectFirstDiagnostic(
      validateCandidate(reordered),
      "first-vertical.binding-population",
      "/evidenceBindings/0/ruleId",
    );
  });

  it("rejects swapped, list-only, and unrelated case identities before digest evaluation", async () => {
    const publication = await publicationApi();
    const createCandidate = requireCallable(
      publication,
      "createFirstVerticalPublicationCandidateV2",
    );
    const validateCandidate = requireCallable(
      publication,
      "validateFirstVerticalPublicationCandidateV2",
    );

    const swapped = requireRecord(structuredClone(createCandidate()), "swapped-binding candidate");
    const swappedRows = candidateRows(swapped);
    [swappedRows[0].evidence, swappedRows[1].evidence] = [
      swappedRows[1].evidence,
      swappedRows[0].evidence,
    ];
    expectFirstDiagnostic(
      validateCandidate(swapped),
      "first-vertical.case-identity",
      "/evidenceBindings/0/evidence/0/caseId",
    );

    const listOnly = requireRecord(structuredClone(createCandidate()), "list-only candidate");
    rowEvidence(candidateRows(listOnly)[0] ?? {})[0]!.caseId = LIST_SHAPE_ONLY_CASE_ID;
    expectFirstDiagnostic(
      validateCandidate(listOnly),
      "first-vertical.case-identity",
      "/evidenceBindings/0/evidence/0/caseId",
    );

    const unrelated = requireRecord(structuredClone(createCandidate()), "unrelated candidate");
    rowEvidence(candidateRows(unrelated)[0] ?? {})[0]!.caseId = COMBINED_STRUCTURED_CASE_ID;
    expectFirstDiagnostic(
      validateCandidate(unrelated),
      "first-vertical.case-identity",
      "/evidenceBindings/0/evidence/0/caseId",
    );
  });

  it("rejects missing and forged authenticated digests at the exact evidence member", async () => {
    const publication = await publicationApi();
    const createCandidate = requireCallable(
      publication,
      "createFirstVerticalPublicationCandidateV2",
    );
    const validateCandidate = requireCallable(
      publication,
      "validateFirstVerticalPublicationCandidateV2",
    );

    const missing = requireRecord(structuredClone(createCandidate()), "missing-digest candidate");
    const missingEntry = rowEvidence(candidateRows(missing)[0] ?? {})[0];
    if (missingEntry === undefined) {
      throw new TypeError("expected first evidence entry");
    }
    delete missingEntry.caseDigest;
    expectFirstDiagnostic(
      validateCandidate(missing),
      "first-vertical.case-digest",
      "/evidenceBindings/0/evidence/0/caseDigest",
    );

    const forged = requireRecord(structuredClone(createCandidate()), "forged-digest candidate");
    const forgedEntry = rowEvidence(candidateRows(forged)[0] ?? {})[0];
    if (forgedEntry === undefined) {
      throw new TypeError("expected first evidence entry");
    }
    forgedEntry.caseDigest = `sha256:${"f".repeat(64)}`;
    expectFirstDiagnostic(
      validateCandidate(forged),
      "first-vertical.case-digest",
      "/evidenceBindings/0/evidence/0/caseDigest",
    );
  });
});
