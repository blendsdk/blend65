import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { afterAll, describe, expect, it, vi } from "vitest";

import {
  createAcceptedReviewBytes,
  createCurrentOraclePublicationSpecFixture,
} from "./test-fixtures/oracle-publication-spec-fixture.js";

type Digest = `sha256:${string}`;
type Api = Readonly<Record<string, unknown>>;
type Data = Readonly<Record<string, unknown>>;
type CurrentOraclePublicationSpecFixture = Awaited<
  ReturnType<typeof createCurrentOraclePublicationSpecFixture>
>;
// prettier-ignore
type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issues: readonly { readonly code: string; readonly path: string }[] };
// prettier-ignore
type Policy = { readonly revision: "failure-reduction-policy-v1"; readonly dispositionRevision: "failure-disposition-v1"; readonly catalogRevision: "failure-reduction-catalog-v1"; readonly normalizationRevision: "failure-normalization-v1"; readonly budget: Readonly<Record<string, number>> };
// prettier-ignore
type Campaign = { readonly summary: { readonly totalCaseCount: number } };
// prettier-ignore
type Projection = { readonly family: "typed-valid" | "typed-invalid" | "raw-malformed"; readonly draft: Data; readonly size: readonly (number | Digest)[] };
// prettier-ignore
type ExecutionProjection = { readonly family: string; readonly sourceBytes: Uint8Array; readonly candidateDigest: Digest };
// prettier-ignore
type Invocation = { readonly authority: object; readonly token: object; readonly purpose: "reduction" | "confirmation"; readonly proposalKind: "catalog-edit" | "normalization"; readonly sequence: number };
// prettier-ignore
type Step = { readonly kind: "execute-candidate"; readonly invocation: Invocation } | { readonly kind: "complete"; readonly result: { readonly outcome: "one-minimal" | "reduction-exhausted"; readonly best: ExecutionProjection; readonly trace: readonly Data[]; readonly exhaustedAt?: string } };
// prettier-ignore
type Fixture = { readonly root: Api; readonly internal: Api; readonly publication: CurrentOraclePublicationSpecFixture; readonly context: object; readonly plan: Campaign; readonly valid: object; readonly invalid: object };

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
// prettier-ignore
const RULES = ["rule.ch02.2-primitive-types.byte.range.0-255", "rule.ch02.2-primitive-types.sbyte.range.128-127", "rule.ch02.2-primitive-types.sword.range.32768-32767", "rule.ch02.2-primitive-types.word.range.0-65535"] as const;
// prettier-ignore
const ROOT_EXPORTS = ["createMalformedDiagnosticCaseV1", "getMalformedDiagnosticCaseProjectionV1", "authorizeFailureEnvelopeV1", "getFailureEnvelopeProjectionV1", "getFailureHistoricalAuthorityRecordsV1", "createFailureHistoricalAuthorityResolverV1", "serializeFailureEnvelopeV1", "parseFailureEnvelopeV1"] as const;
// prettier-ignore
const INTERNAL_EXPORTS = ["createInitialReductionCandidateV1", "validateReductionCandidateInvariantV1", "getValidatedReductionCandidateProjectionV1", "enumerateFailureTransformationsV1", "applyFailureTransformationV1", "normalizeFailureReductionCandidateV1", "createReductionCandidateAuthorityV1", "getReductionCandidateProjectionV1", "createReductionCandidateInvocationV1", "consumeReductionCandidateInvocationV1", "createFailureReductionSessionV1", "nextFailureReductionStepV1", "recordFailureReductionEvaluationV1"] as const;

// prettier-ignore
describe("failure reduction oracle", () => {
function call<T>(api: Api, name: string, ...args: readonly unknown[]): T {
  const callable = api[name];
  if (typeof callable !== "function") throw new TypeError(`missing callable ${name}`);
  return Reflect.apply(callable, undefined, args) as T;
}
function ok<T>(result: Result<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues));
  return result.value;
}
function fail(result: Result<unknown>, code: string, path: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result).not.toHaveProperty("value");
  expect(result.issues[0]?.code).toBe(code);
  expect(result.issues[0]?.path).toMatch(new RegExp(`^${path}(?:/|$)`, "u"));
}
function record(value: unknown, message: string): Data {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return value as Data;
}
function present<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new TypeError(message);
  return value;
}
function sha(bytes: Uint8Array): Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
function fixed(character: string): Digest {
  return `sha256:${character.repeat(64)}`;
}
async function loadApis(): Promise<Pick<Fixture, "root" | "internal">> {
  const root = await vi.importActual<Api>("./index.js");
  const missingRoot = ROOT_EXPORTS.filter((name) => typeof root[name] !== "function");
  if (missingRoot.length > 0) {
    throw new TypeError(`the failure reduction public API is unavailable: ${missingRoot.join(",")}`);
  }
  const internal = await vi.importActual<Api>("./failure-reduction-internals.js");
  const missingInternal = INTERNAL_EXPORTS.filter((name) => typeof internal[name] !== "function");
  if (missingInternal.length > 0) {
    throw new TypeError(`the failure reduction internal API is unavailable: ${missingInternal.join(",")}`);
  }
  return { root, internal };
}

async function oracleContext(publication: CurrentOraclePublicationSpecFixture): Promise<object> {
  const publishing = await vi.importActual<Api>("./binding-publication.js");
  const resolver = await vi.importActual<Api>("./publication-resolver.js");
  const oracle = await vi.importActual<Api>("./published-oracle-context.js");
  const snapshot = ok(
    await call<Promise<Result<object>>>(resolver, "resolvePublishedSnapshotByDigest", {
      repositoryRoot: publication.repositoryRoot,
      publicationDigest: publication.publicationDigest,
    }),
  );
  const targetHandlerIds = ["oracle.compiler-result", "oracle.emitted-program", "oracle.frontend-result", "oracle.runtime-state", "transform.semantic-relations"] as const;
  const review = ok(await call<Promise<Result<{ readonly request: Parameters<typeof createAcceptedReviewBytes>[0] }>>>(publishing, "prepareIncrementalBindingPublicationReview", { repositoryRoot: publication.repositoryRoot, baseSnapshot: snapshot, targetHandlerIds }));
  const staged = ok(await call<Promise<Result<{ readonly stagedSnapshot: object }>>>(publishing, "prepareIncrementalBindingPublication", { repositoryRoot: publication.repositoryRoot, baseSnapshot: snapshot, targetHandlerIds, semanticReviewBytes: createAcceptedReviewBytes(review.request) }));
  return ok(call<Result<object>>(oracle, "createPublishedOracleContext", staged.stagedSnapshot));
}

function register(api: Api, name: string, handlerId: string, implementation: unknown): object {
  const path = `fixtures/${name}.ts`;
  const metadata = {
    contractVersion: "1.0.0",
    entryPath: path,
    files: [{ path, content: encoder.encode(`export const fixture = "${name}";\n`) }],
  };
  const revision = present(call<{ readonly revision?: Digest }>(api, "deriveImplementationRevision", metadata).revision, "binding revision");
  const freshness = call<Data>(api, "validateImplementationRevision", {
    claimedRevision: revision,
    metadata,
  });
  return present(
    call<{ readonly registration?: object }>(api, "registerFreshCandidateBinding", {
      binding: {
        handlerId,
        kind: handlerId.startsWith("generator") ? "generator" : "transform",
        contractVersion: "1.0.0",
        implementationRevision: revision,
        implementation,
      },
      freshness,
    }).registration,
    "binding registration",
  );
}

function bindingIdentity(registration: object): object {
  const binding = Object.getOwnPropertyDescriptor(registration, "binding")?.value;
  if (typeof binding !== "object" || binding === null) throw new TypeError("binding identity");
  return Object.fromEntries(["handlerId", "contractVersion", "implementationRevision"].map((key) => [key, Reflect.get(binding, key)]));
}

async function createCampaign(api: Api, seed: Digest): Promise<Campaign> {
  const [inventoryBytes, ruleModelBytes, seedContractBytes, reviewEvidenceBytes] = await Promise.all(["readiness/inventory/compiler-readiness-v1.json", "readiness/rule-models/rule-models-v1.json", "readiness/rule-models/rule-model-seed-v1.json", "readiness/reviews/rule-models-v1-review.json"].map((path) => readFile(new URL(`../../../${path}`, import.meta.url))));
  const inventory = present(call<{ readonly inventory?: unknown }>(api, "parseInventoryJson", inventoryBytes, api.INVENTORY_V1_LIMITS).inventory, "parsed inventory");
  const validated = present(call<{ readonly inventory?: unknown }>(api, "validateInventorySchema", inventory).inventory, "validated inventory");
  const suite = present(
    call<{ readonly suite?: unknown }>(api, "createModeledGeneratorSuite", {
      seedContractBytes,
      ruleModelBytes,
      reviewEvidenceBytes,
      inventory: validated,
    }).suite,
    "modeled suite",
  );
  const configuration = {
    caseCount: 72,
    maxInvalidCases: 24,
    enabledRuleIds: [...RULES].sort(),
    spellings: ["const", "literal", "local", "parameter"],
    budget: {
      maxModules: 4,
      maxDeclarations: 128,
      maxIrNodes: 512,
      maxStatements: 256,
      maxExpressionDepth: 16,
      maxLoopWork: 1n,
      maxSourceBytes: 65_536,
      maxAttempts: 128,
    },
  };
  const configurationDigest = present(call<{ readonly identity?: Digest }>(api, "deriveConfigurationIdentity", configuration).identity, "configuration identity");
  const generator = register(api, "reduction-generator", "generator.frontend-cases", api.generateFrontendCase);
  const boundary = register(api, "reduction-boundary", "transform.boundary-variants", api.boundaryVariantsHandler);
  const dependencies = {
    inventory: {
      schemaVersion: 1,
      inventoryVersion: "compiler-readiness-v1",
      inventoryDigest: sha(inventoryBytes),
      specRevision: "spec-v3.0",
    },
    ruleModel: {
      schemaVersion: 1,
      ruleModelVersion: "rule-model-v1",
      ruleModelDigest: sha(ruleModelBytes),
      suite,
    },
    generator,
    boundaryTransform: boundary,
    renderer: { implementationRevision: fixed("5"), implementation: api.renderGeneratedCase },
  };
  const plan = ok(
    call<Result<Campaign>>(api, "createCampaignPlan", {
      campaign: {
        inventorySchemaVersion: 1,
        inventoryVersion: dependencies.inventory.inventoryVersion,
        inventoryDigest: dependencies.inventory.inventoryDigest,
        specRevision: dependencies.inventory.specRevision,
        ruleModelVersion: dependencies.ruleModel.ruleModelVersion,
        ruleModelDigest: dependencies.ruleModel.ruleModelDigest,
        generator: bindingIdentity(generator),
        boundaryTransform: bindingIdentity(boundary),
        rendererRevision: fixed("5"),
        target: "c64",
        prngAlgorithm: "blend65-sha256-ctr-v1",
        seed,
        configurationDigest,
      },
      configuration,
      dependencies,
    }),
  );
  campaignInputs.set(plan, { seed, configuration });
  return plan;
}
const campaignInputs = new WeakMap<object, { readonly seed: Digest; readonly configuration: object }>();
async function typedAuthorities(api: Api, context: object, plan: Campaign) {
  const published = await vi.importActual<Api>("./published-oracle.js");
  const campaignInput = present(campaignInputs.get(plan), "campaign intent");
  let valid: object | undefined;
  let invalid: object | undefined;
  for (let ordinal = 0; ordinal < plan.summary.totalCaseCount; ordinal += 1) {
    const item = ok(call<Result<{ readonly lane: string; readonly request: { readonly choice: { readonly ruleId: string } } }>>(api, "getCampaignPlanItem", plan, ordinal));
    if (valid === undefined && item.lane !== "invalid") {
      const result = call<Result<object>>(api, "createExecutionCaseV1", plan, ordinal, {
        kind: "scalar-bytes",
        byteLength: 1,
      });
      if (result.ok) valid = result.value;
    }
    if (invalid === undefined && item.lane === "invalid") {
      const result = call<Result<object>>(published, "createPublishedDiagnosticCaseFromIntentV1", context, { schemaVersion: 1, ruleId: item.request.choice.ruleId, seed: campaignInput.seed, configuration: campaignInput.configuration, ordinal });
      if (result.ok) invalid = result.value;
    }
    if (valid !== undefined && invalid !== undefined) return { valid, invalid };
  }
  throw new TypeError("genuine typed authorities");
}
let pending: Promise<Fixture> | undefined;
let completed: Fixture | undefined;

async function fixture(): Promise<Fixture> {
  pending ??= (async () => {
    const apis = await loadApis();
    const publication = await createCurrentOraclePublicationSpecFixture();
    try {
      const context = await oracleContext(publication);
      const plan = await createCampaign(apis.root, fixed("6"));
      completed = {
        ...apis,
        publication,
        context,
        plan,
        ...(await typedAuthorities(apis.root, context, plan)),
      };
      return completed;
    } catch (error) {
      await publication.cleanup();
      throw error;
    }
  })();
  return pending;
}
afterAll(async () => completed?.publication.cleanup());
function selectedPolicy(f: Fixture): Policy {
  return f.root.FAILURE_REDUCTION_DEFAULT_POLICY_V1 as Policy;
}

function predicate(api: Api, route: string, ruleId: string, obligation: string): Data {
  return ok(
    call<Result<{ readonly predicate: Data }>>(api, "deriveFailurePredicateIdentityV1", {
      revision: "failure-predicate-v1",
      resultCode: "semantic-mismatch",
      terminalTier: route === "valid-envelope" ? "vice" : "frontend",
      terminalStage: route === "valid-envelope" ? "compare" : "frontend",
      observation: { kind: "observed", digest: sha(new Uint8Array()) },
      cleanup: "cleanup-clear",
      primaryRuleId: ruleId,
      requiredClaimedRuleIds: [ruleId],
      target: "c64",
      routeContract: {
        originalRouteKind: route,
        terminalTier: route === "valid-envelope" ? "vice" : "frontend",
        obligation,
        prerequisiteTiers: route === "valid-envelope" ? ["frontend", "compiler-api", "cli", "emit", "acme"] : [],
        policyDigest: fixed("a"),
        fixtureDigest: fixed("b"),
        oracleContractDigest: fixed("c"),
        toolContractDigests: [],
      },
    }),
  ).predicate;
}

function envelope(f: Fixture, authority: object, kind: "typed-valid" | "typed-invalid" | "raw-malformed", policy = selectedPolicy(f)): object {
  const route = kind === "typed-valid" ? "valid-envelope" : "invalid-diagnostic";
  const ruleId = kind === "raw-malformed" ? "diagnostic.malformed-source" : RULES[0];
  const obligation = `${kind}-failure`;
  const routeBytes = encoder.encode(`${JSON.stringify({ route, obligation })}\n`);
  return ok(
    call<Result<object>>(f.root, "authorizeFailureEnvelopeV1", {
      revision: "failure-envelope-authorization-input-v1",
      source: { kind, authority },
      routePlanBytes: routeBytes,
      routePlanDigest: sha(routeBytes),
      predicate: predicate(f.root, route, ruleId, obligation),
      policy,
      observationBytes: new Uint8Array(),
      toolVersions: [],
    }),
  );
}

function malformed(f: Fixture, bytes: Uint8Array): object {
  return ok(
    call<Result<object>>(f.root, "createMalformedDiagnosticCaseV1", f.context, {
      revision: "malformed-diagnostic-case-input-v1",
      sourceBytes: bytes,
      encoding: "utf-8",
      ruleId: "diagnostic.malformed-source",
      obligation: "reject malformed language input",
      provenance: {
        revision: "malformed-token-text-provenance-v1",
        tokenizerRevision: "utf8-byte-spans-v1",
        tokens: bytes.length === 0 ? [] : [{ kind: "unknown", startByte: 0, endByte: bytes.length }],
      },
    }),
  );
}

function raw(f: Fixture, bytes: Uint8Array, policy = selectedPolicy(f)): object {
  return envelope(f, malformed(f, bytes), "raw-malformed", policy);
}

function initial(f: Fixture, original: object): object {
  return ok(call<Result<object>>(f.internal, "createInitialReductionCandidateV1", original));
}

function projection(f: Fixture, candidate: object): Projection {
  return ok(call<Result<Projection>>(f.internal, "getValidatedReductionCandidateProjectionV1", candidate));
}

function edits(f: Fixture, candidate: object): readonly Data[] {
  return call<readonly Data[]>(f.internal, "enumerateFailureTransformationsV1", candidate);
}

function sizeOrder(left: readonly (number | Digest)[], right: readonly (number | Digest)[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] === right[index]) continue;
    return String(left[index]) < String(right[index]) ? -1 : 1;
  }
  return left.length - right.length;
}

function budget(f: Fixture, policy: Policy): object {
  return ok(
    call<Result<object>>(f.root, "createFailureCampaignBudgetAuthorityV1", policy, {
      nonPassResults: 0,
      resolvableNonPassResults: 0,
    }),
  );
}

function evaluate(f: Fixture, session: object, invocation: Invocation, reproduced: boolean, observation: unknown): Step {
  const consumed = ok(call<Result<{ readonly candidate: ExecutionProjection }>>(f.internal, "consumeReductionCandidateInvocationV1", invocation));
  return ok(
    call<Result<Step>>(f.internal, "recordFailureReductionEvaluationV1", session, {
      revision: "reduction-candidate-evaluation-v1",
      token: invocation.token,
      candidateDigest: consumed.candidate.candidateDigest,
      purpose: invocation.purpose,
      reproduced,
      observation,
    }),
  );
}

function reduce(f: Fixture, original: object, reproduced: boolean) {
  const source = ok(call<Result<{ readonly policy: Policy; readonly predicate: Data }>>(f.root, "getFailureEnvelopeProjectionV1", original));
  const session = ok(call<Result<object>>(f.internal, "createFailureReductionSessionV1", original, budget(f, source.policy)));
  let step = ok(call<Result<Step>>(f.internal, "nextFailureReductionStepV1", session));
  let evaluations = 0;
  while (step.kind === "execute-candidate") {
    evaluations += 1;
    if (evaluations > source.policy.budget.oracleEvaluations) throw new TypeError("termination");
    step = evaluate(f, session, step.invocation, reproduced, source.predicate.observation);
  }
  return { result: step.result, evaluations };
}

describe("historical authority", () => {
  // Replay remains bound to exact retained content after current authority changes.
  it("should reproduce the original typed case, route, predicate, and source after authority revision", async () => {
    const f = await fixture();
    const original = envelope(f, f.valid, "typed-valid");
    const before = ok(call<Result<Data>>(f.root, "getFailureEnvelopeProjectionV1", original));
    const bytes = call<Uint8Array>(f.root, "serializeFailureEnvelopeV1", original);
    const records = ok(call<Result<readonly Data[]>>(f.root, "getFailureHistoricalAuthorityRecordsV1", original));
    await createCampaign(f.root, fixed("7"));
    const resolver = ok(call<Result<object>>(f.root, "createFailureHistoricalAuthorityResolverV1", records));
    const resolved = ok(call<Result<Data>>(f.root, "parseFailureEnvelopeV1", bytes, resolver));
    expect(resolved).toMatchObject({ outcome: "resolved", missingAuthorityDigests: [] });
    const replayed = record(resolved.envelope, "resolved envelope");
    expect(ok(call<Result<Data>>(f.root, "getFailureEnvelopeProjectionV1", replayed))).toEqual(before);
    expect(call<Uint8Array>(f.root, "serializeFailureEnvelopeV1", replayed)).toEqual(bytes);
  });

  // Missing history is unavailable; malformed, oversized, and copied resolver brands fail closed.
  it("should return unavailable without an envelope or fallback and reject malformed or forged authority", async () => {
    const f = await fixture();
    const original = envelope(f, f.valid, "typed-valid");
    const bytes = call<Uint8Array>(f.root, "serializeFailureEnvelopeV1", original);
    const records = ok(call<Result<readonly Data[]>>(f.root, "getFailureHistoricalAuthorityRecordsV1", original));
    const first = present(records[0], "historical record");
    const incomplete = ok(call<Result<object>>(f.root, "createFailureHistoricalAuthorityResolverV1", records.slice(1)));
    expect(ok(call<Result<Data>>(f.root, "parseFailureEnvelopeV1", bytes, incomplete))).toEqual({
      outcome: "historical-authority-unavailable",
      missingAuthorityDigests: [first.digest],
    });
    fail(call<Result<unknown>>(f.root, "createFailureHistoricalAuthorityResolverV1", [{ ...first, digest: fixed("0") }]), "execution.identity", "/resolver");
    const oversized = new Uint8Array(67_108_865);
    fail(call<Result<unknown>>(f.root, "createFailureHistoricalAuthorityResolverV1", [{ ...first, bytes: oversized, digest: sha(oversized) }]), "execution.invalid-schema", "/resolver");
    const resolver = ok(call<Result<object>>(f.root, "createFailureHistoricalAuthorityResolverV1", records));
    for (const forged of [{}, { ...resolver }]) {
      fail(call<Result<unknown>>(f.root, "parseFailureEnvelopeV1", bytes, forged), "unbound-capability", "/resolver");
    }
  });
});

describe("malformed source authority", () => {
  // Exact valid UTF-8 bytes survive copying, including empty, path-like, BOM, and language-invalid input.
  it("should round-trip empty, path-like, BOM, multibyte, and malformed-language bytes exactly", async () => {
    const f = await fixture();
    for (const bytes of [new Uint8Array(), encoder.encode("../../tmp/game.bl65"), Uint8Array.from([0xef, 0xbb, 0xbf, ...encoder.encode("main")]), encoder.encode("sprites = '👾'; café = true;"), encoder.encode("fn main( { deliberately malformed Blend65")]) {
      const expected = Uint8Array.from(bytes);
      const authority = malformed(f, bytes);
      bytes.fill(0x61);
      const replay = ok(call<Result<Data>>(f.root, "getMalformedDiagnosticCaseProjectionV1", authority));
      expect(replay).toMatchObject({ revision: "malformed-replay-envelope-v1", encoding: "utf-8" });
      expect(replay.sourceBytes).toEqual(expected);
      expect(replay.sourceBytes).not.toBe(bytes);
    }
  });

  // Invalid UTF-8 and copied capabilities fail before projection or envelope minting.
  it("should reject invalid UTF-8 before minting and reject plain or copy-forged raw authority", async () => {
    const f = await fixture();
    fail(
      call<Result<unknown>>(f.root, "createMalformedDiagnosticCaseV1", f.context, {
        revision: "malformed-diagnostic-case-input-v1",
        sourceBytes: Uint8Array.from([0xc3, 0x28]),
        encoding: "utf-8",
        ruleId: "diagnostic.malformed-source",
        obligation: "reject malformed language input",
        provenance: {
          revision: "malformed-token-text-provenance-v1",
          tokenizerRevision: "utf8-byte-spans-v1",
          tokens: [{ kind: "unknown", startByte: 0, endByte: 2 }],
        },
      }),
      "invalid-evidence-input",
      "/malformedCase",
    );
    const authority = malformed(f, encoder.encode("?"));
    for (const forged of [{}, { ...authority }]) {
      fail(call<Result<unknown>>(f.root, "getMalformedDiagnosticCaseProjectionV1", forged), "unbound-capability", "/malformedCase");
    }
  });
});

describe("family invariants and transformations", () => {
  // Typed-valid reduction retains its semantic witness and cannot collapse into a syntax/type error.
  it("should strictly shrink typed-valid candidates while retaining required claims and type correctness", async () => {
    const f = await fixture();
    const original = envelope(f, f.valid, "typed-valid");
    const candidate = initial(f, original);
    const before = projection(f, candidate);
    const smaller = ok(call<Result<object>>(f.internal, "applyFailureTransformationV1", original, candidate, edits(f, candidate)[0]));
    expect(sizeOrder(projection(f, smaller).size, before.size)).toBeLessThan(0);
    for (const draft of [
      { ...before.draft, sourceBytes: encoder.encode("fn main( { type collapse") },
      { ...before.draft, claimWitnesses: [] },
    ]) {
      fail(call<Result<unknown>>(f.internal, "validateReductionCandidateInvariantV1", original, draft), "invalid-evidence-input", "/candidate");
    }
    const claims = Array.isArray(before.draft.claimedRuleIds) ? before.draft.claimedRuleIds : [];
    const witnesses = Array.isArray(before.draft.claimWitnesses) ? before.draft.claimWitnesses : [];
    const incidental = claims.find((claim) => claim !== before.draft.primaryRuleId);
    if (typeof incidental === "string") {
      const remaining = claims.filter((claim) => claim !== incidental);
      fail(
        call<Result<unknown>>(f.internal, "validateReductionCandidateInvariantV1", original, {
          ...before.draft,
          claimedRuleIds: remaining,
        }),
        "invalid-evidence-input",
        "/candidate",
      );
      expect(
        call<Result<object>>(f.internal, "validateReductionCandidateInvariantV1", original, {
          ...before.draft,
          claimedRuleIds: remaining,
          claimWitnesses: witnesses.filter((witness) => record(witness, "witness").ruleId !== incidental),
        }).ok,
      ).toBe(true);
    }
  });

  // Invalid edits retain baseline, diagnostic, binding, neighbor, path, and single-violation identity.
  it("should preserve typed-invalid metadata and either rebase each transform target once or reject the edit", async () => {
    const f = await fixture();
    const original = envelope(f, f.invalid, "typed-invalid");
    const candidate = initial(f, original);
    const before = projection(f, candidate);
    expect(before.draft).toMatchObject({
      baseline: expect.any(Object),
      transform: expect.any(Object),
      parameterBindings: expect.any(Array),
      neighborId: expect.any(String),
      violatedPredicateId: expect.any(String),
      diagnosticFamily: expect.any(String),
    });
    for (const field of ["neighborId", "violatedPredicateId", "diagnosticFamily"]) {
      fail(
        call<Result<unknown>>(f.internal, "validateReductionCandidateInvariantV1", original, {
          ...before.draft,
          [field]: `${String(before.draft[field])}.substituted`,
        }),
        "invalid-evidence-input",
        "/candidate",
      );
    }
    const invalidEdits = edits(f, candidate).filter(({ kind }) => String(kind).startsWith("invalid-"));
    expect(new Set(invalidEdits.map(({ kind }) => kind))).toEqual(new Set(["invalid-baseline-delete", "invalid-baseline-simplify", "invalid-transform-target-rebase", "invalid-unused-binding-remove"]));
    for (const edit of invalidEdits) {
      const applied = call<Result<object>>(f.internal, "applyFailureTransformationV1", original, candidate, edit);
      if (!applied.ok) {
        expect(applied.issues[0]?.path).toMatch(/^\/transformation(?:\/|$)/u);
      } else {
        const after = projection(f, applied.value);
        expect(after.draft).toMatchObject({
          neighborId: before.draft.neighborId,
          violatedPredicateId: before.draft.violatedPredicateId,
          diagnosticFamily: before.draft.diagnosticFamily,
        });
        expect(sizeOrder(after.size, before.size)).toBeLessThan(0);
      }
    }
  });

  // Raw reductions preserve empty input and use only strict full-buffer UTF-8 boundaries.
  it("should preserve empty bytes and apply raw edits only on strict UTF-8 code-point boundaries", async () => {
    const f = await fixture();
    const emptyOriginal = raw(f, new Uint8Array());
    const empty = initial(f, emptyOriginal);
    expect(projection(f, empty).draft.sourceBytes).toEqual(new Uint8Array());
    expect(edits(f, empty)).toEqual([]);
    const bytes = encoder.encode("../👾/café.bl65");
    const original = raw(f, bytes);
    const candidate = initial(f, original);
    const before = projection(f, candidate);
    const boundaries = new Set<number>([0, bytes.length]);
    for (let index = 1; index < bytes.length; index += 1) {
      try {
        decoder.decode(bytes.slice(0, index));
        boundaries.add(index);
      } catch {
        // A prefix ending inside a code point is not an edit boundary.
      }
    }
    for (const edit of edits(f, candidate)) {
      expect(boundaries.has(Number(edit.startByte))).toBe(true);
      expect(boundaries.has(Number(edit.endByte))).toBe(true);
      const applied = call<Result<object>>(f.internal, "applyFailureTransformationV1", original, candidate, edit);
      if (!applied.ok) continue;
      const after = projection(f, applied.value);
      expect(() => decoder.decode(after.draft.sourceBytes as Uint8Array)).not.toThrow();
      expect(sizeOrder(after.size, before.size)).toBeLessThan(0);
    }
  });

  // Catalog mutations strictly decrease; normalization is separate, idempotent, and evaluation-aware.
  it("should fail closed on equal, increasing, unknown, or cyclic edits and keep normalization idempotent", async () => {
    const f = await fixture();
    const original = raw(f, encoder.encode("abc"));
    const candidate = initial(f, original);
    for (const edit of [
      {
        revision: "failure-transformation-v1",
        kind: "malformed-byte-chunk-delete",
        startByte: 0,
        endByte: 0,
      },
      {
        revision: "failure-transformation-v1",
        kind: "malformed-byte-chunk-delete",
        startByte: 2,
        endByte: 1,
      },
      { revision: "failure-transformation-v1", kind: "unknown-edit" },
    ]) {
      const result = call<Result<object>>(f.internal, "applyFailureTransformationV1", original, candidate, edit);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues[0]?.path).toMatch(/^\/transformation(?:\/|$)/u);
    }
    const normalized = ok(call<Result<Data>>(f.internal, "normalizeFailureReductionCandidateV1", original, candidate));
    const normalizedCandidate = record(normalized.candidate, "normalized candidate");
    expect(ok(call<Result<Data>>(f.internal, "normalizeFailureReductionCandidateV1", original, normalizedCandidate))).toMatchObject({
      changed: false,
      beforeDigest: normalized.afterDigest,
      afterDigest: normalized.afterDigest,
      requiresEvaluation: false,
    });
    const beforeBytes = projection(f, candidate).draft.sourceBytes;
    const afterBytes = projection(f, normalizedCandidate).draft.sourceBytes;
    const sourceChanged = beforeBytes instanceof Uint8Array && afterBytes instanceof Uint8Array && !Buffer.from(beforeBytes).equals(Buffer.from(afterBytes));
    expect(normalized.requiresEvaluation).toBe(sourceChanged);
  });
});

describe("reduction state and candidate authority", () => {
  // Fresh construction is deterministic, and a complete rejected pass proves one-minimality.
  it("should produce byte-identical one-minimal results and prove a complete catalog fixed point", async () => {
    const f = await fixture();
    const bytes = encoder.encode("fn main( { 👾 }");
    expect(reduce(f, raw(f, bytes), true)).toEqual(reduce(f, raw(f, bytes), true));
    expect(reduce(f, raw(f, bytes), true).result).toMatchObject({
      outcome: "one-minimal",
      best: { family: "raw-malformed", sourceBytes: new Uint8Array() },
    });
    const fixedPoint = raw(f, encoder.encode("not valid Blend65"));
    const catalogSize = edits(f, initial(f, fixedPoint)).length;
    expect(reduce(f, fixedPoint, false)).toMatchObject({
      evaluations: catalogSize,
      result: {
        outcome: "one-minimal",
        best: { sourceBytes: encoder.encode("not valid Blend65") },
      },
    });
    expect(reduce(f, raw(f, new Uint8Array()), true)).toMatchObject({
      evaluations: 0,
      result: { outcome: "one-minimal", best: { sourceBytes: new Uint8Array() }, trace: [] },
    });
  });

  // Exact discretionary work succeeds; only the following operation reports closed exhaustion.
  it("should retain the best candidate when the operation after the exact campaign budget exhausts", async () => {
    const f = await fixture();
    const policy: Policy = {
      ...selectedPolicy(f),
      budget: {
        ...selectedPolicy(f).budget,
        campaignOperations: 3,
        transformationAttempts: 1,
        oracleEvaluations: 1,
      },
    };
    const original = raw(f, encoder.encode("ab"), policy);
    const session = ok(call<Result<object>>(f.internal, "createFailureReductionSessionV1", original, budget(f, policy)));
    const step = ok(call<Result<Step>>(f.internal, "nextFailureReductionStepV1", session));
    if (step.kind !== "execute-candidate") throw new TypeError("exact operation");
    const source = ok(call<Result<{ readonly predicate: Data }>>(f.root, "getFailureEnvelopeProjectionV1", original));
    expect(evaluate(f, session, step.invocation, false, source.predicate.observation)).toMatchObject({
      kind: "complete",
      result: {
        outcome: "reduction-exhausted",
        exhaustedAt: "transformation-attempt",
        best: { sourceBytes: encoder.encode("ab") },
      },
    });
  });

  // Tokens bind one candidate, purpose, proposal kind, and sequence while fresh reuse remains valid.
  it("should reject forged, replayed, foreign, out-of-order, and substituted tokens but allow fresh-token reuse", async () => {
    const f = await fixture();
    const original = raw(f, encoder.encode("abc"));
    const candidate = initial(f, original);
    const authority = ok(call<Result<object>>(f.internal, "createReductionCandidateAuthorityV1", original, candidate, []));
    const foreignAuthority = ok(call<Result<object>>(f.internal, "createReductionCandidateAuthorityV1", original, candidate, []));
    const mint = (owner: object, purpose: string, proposal: string) => ok(call<Result<Invocation>>(f.internal, "createReductionCandidateInvocationV1", owner, purpose, proposal));
    const first = mint(authority, "reduction", "catalog-edit");
    const second = mint(authority, "reduction", "catalog-edit");
    const foreign = mint(foreignAuthority, "confirmation", "normalization");
    fail(call<Result<unknown>>(f.internal, "consumeReductionCandidateInvocationV1", {}), "execution.invalid-schema", "/invocation");
    for (const forged of [{ ...first, token: foreign.token }, { ...first, authority: foreignAuthority }, { ...first, purpose: "confirmation" }, { ...first, proposalKind: "normalization" }, second]) {
      const result = call<Result<unknown>>(f.internal, "consumeReductionCandidateInvocationV1", forged);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues[0]?.path).toMatch(/^\/invocation(?:\/|$)/u);
    }
    expect(ok(call<Result<Data>>(f.internal, "consumeReductionCandidateInvocationV1", first))).toMatchObject({
      purpose: "reduction",
      sequence: first.sequence,
    });
    fail(call<Result<unknown>>(f.internal, "consumeReductionCandidateInvocationV1", first), "unbound-capability", "/invocation");
    expect(ok(call<Result<Data>>(f.internal, "consumeReductionCandidateInvocationV1", second))).toMatchObject({
      sequence: second.sequence,
    });
    expect(ok(call<Result<Data>>(f.internal, "consumeReductionCandidateInvocationV1", mint(authority, "confirmation", "normalization")))).toMatchObject({ purpose: "confirmation" });
    for (const forged of [{}, { ...authority }]) {
      fail(call<Result<unknown>>(f.internal, "getReductionCandidateProjectionV1", forged), "unbound-capability", "/candidate");
    }
  });
});
});
