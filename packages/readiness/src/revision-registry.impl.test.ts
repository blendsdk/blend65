import { describe, expect, it, vi } from "vitest";

import {
  isFreshCandidateRegistration,
  registerFreshCandidateBinding,
} from "./binding-validator.js";
import type { ExecutableBindingInput, FreshCandidateRegistration } from "./binding-model.js";
import type { GenerationConfiguration } from "./canonical-identity.js";
import type { CampaignIdentityInput, CaseIdentity } from "./case-identity.js";
import {
  deriveImplementationRevision,
  validateImplementationRevision,
} from "./implementation-revision.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type { ReplayEnvelopeV1 } from "./replay-input.js";
import {
  createRevisionRegistry,
  resolveReplayRevisions,
  type IdentityComponent,
  type RevisionEntry,
} from "./revision-registry.js";

const encoder = new TextEncoder();

function digest(character: string): Sha256Digest {
  return `sha256:${character.repeat(64)}`;
}

function freshRegistration(
  kind: "generator" | "transform",
  handlerId: string,
  source: string,
): FreshCandidateRegistration {
  const metadata = {
    contractVersion: "1",
    entryPath: `handlers/${handlerId}.ts`,
    files: [{ path: `handlers/${handlerId}.ts`, content: encoder.encode(source) }],
  };
  const derived = deriveImplementationRevision(metadata);
  if (!derived.ok) throw new Error("expected derived revision");
  const fresh = validateImplementationRevision({
    claimedRevision: derived.revision,
    metadata,
  });
  if (!fresh.ok) throw new Error("expected fresh revision");
  const binding: ExecutableBindingInput = {
    handlerId,
    kind,
    contractVersion: "1",
    implementationRevision: fresh.revision,
    implementation: () => handlerId,
  };
  const registered = registerFreshCandidateBinding({ binding, freshness: fresh });
  if (!registered.ok) throw new Error("expected fresh candidate registration");
  expect(isFreshCandidateRegistration(registered.registration)).toBe(true);
  return registered.registration;
}

function config(): GenerationConfiguration {
  return {
    caseCount: 1,
    maxInvalidCases: 0,
    enabledRuleIds: [],
    spellings: [],
    budget: {
      maxModules: 1,
      maxDeclarations: 1,
      maxIrNodes: 1,
      maxStatements: 1,
      maxExpressionDepth: 1,
      maxLoopWork: 1n,
      maxSourceBytes: 1,
      maxAttempts: 1,
    },
  };
}

function envelope(
  generatorRevision: Sha256Digest,
  transformRevision: Sha256Digest,
): ReplayEnvelopeV1 {
  const campaign: CampaignIdentityInput = {
    inventorySchemaVersion: 1,
    inventoryVersion: "inventory-v1",
    inventoryDigest: digest("1"),
    specRevision: "spec-v3.0",
    ruleModelVersion: "models-v1",
    ruleModelDigest: digest("2"),
    generator: {
      handlerId: "generator.fixture",
      contractVersion: "1",
      implementationRevision: generatorRevision,
    },
    boundaryTransform: {
      handlerId: "transform.fixture",
      contractVersion: "1",
      implementationRevision: transformRevision,
    },
    rendererRevision: digest("5"),
    target: "c64",
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: digest("0"),
    configurationDigest: digest("6"),
  };
  const caseIdentity: CaseIdentity = {
    campaignDigest: digest("7"),
    generationPath: [],
    ordinal: 0,
    digest: digest("8"),
  };
  return {
    schemaVersion: 1,
    campaign,
    campaignDigest: caseIdentity.campaignDigest,
    caseIdentity,
    configuration: config(),
  };
}

describe("exact revision registry", () => {
  it("closes opaque values and resolves all six exact revisions", () => {
    const generator = freshRegistration("generator", "generator.fixture", "export const g = 1;\n");
    const transform = freshRegistration("transform", "transform.fixture", "export const t = 1;\n");
    const replay = envelope(
      generator.binding.implementationRevision,
      transform.binding.implementationRevision,
    );
    const render = vi.fn();
    const inventoryValue = { version: 1, nested: { stable: true } };
    const entries: RevisionEntry[] = [
      { component: "inventory", revision: replay.campaign.inventoryDigest, value: inventoryValue },
      { component: "rule-model", revision: replay.campaign.ruleModelDigest, value: { rules: [] } },
      {
        component: "generator",
        revision: replay.campaign.generator.implementationRevision,
        value: generator,
      },
      {
        component: "boundary-transform",
        revision: replay.campaign.boundaryTransform.implementationRevision,
        value: transform,
      },
      { component: "renderer", revision: replay.campaign.rendererRevision, value: { render } },
      {
        component: "configuration",
        revision: replay.campaign.configurationDigest,
        value: config(),
      },
    ];

    const registryResult = createRevisionRegistry(entries);
    expect(registryResult.ok).toBe(true);
    if (!registryResult.ok) return;
    inventoryValue.version = 2;
    const resolved = resolveReplayRevisions(replay, registryResult.registry);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.resolved.inventory).toMatchObject({ version: 1 });
    expect(Object.isFrozen(resolved.resolved)).toBe(true);
    expect(Object.isFrozen(resolved.resolved.inventory)).toBe(true);
    expect(registryResult.registry.resolve("inventory", replay.campaign.inventoryDigest)).toBe(
      registryResult.registry.resolve("inventory", replay.campaign.inventoryDigest),
    );
    expect(resolved.resolved.inventory).toBe(
      registryResult.registry.resolve("inventory", replay.campaign.inventoryDigest),
    );
    expect(resolved.resolved.generator).toMatchObject({
      implementationRevision: generator.binding.implementationRevision,
    });
  });

  it.each([
    [[{ component: "future", revision: digest("1"), value: {} }], "/entries/0/component"],
    [[{ component: "renderer", revision: "latest", value: {} }], "/entries/0/revision"],
    [[{ component: "renderer", revision: digest("1"), value: {}, extra: true }], "/entries/0"],
    [[{ component: "generator", revision: digest("1"), value: {} }], "/entries/0/value"],
  ])("rejects malformed or ungated revision entries", (entries, path) => {
    // @ts-expect-error Hostile runtime registry input is intentionally malformed.
    expect(createRevisionRegistry(entries)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "replay.schema.invalid", path }],
    });
  });

  it("rejects handler revision and kind mismatches after freshness registration", () => {
    const generator = freshRegistration("generator", "generator.fixture", "export const g = 1;\n");
    expect(
      createRevisionRegistry([{ component: "generator", revision: digest("f"), value: generator }]),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/entries/0/revision" }],
    });
    expect(
      createRevisionRegistry([
        {
          component: "boundary-transform",
          revision: generator.binding.implementationRevision,
          value: generator,
        },
      ]),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/entries/0/value" }],
    });
  });

  it("rejects cyclic, proxy, sparse and oversized entry inputs as data", () => {
    // @ts-expect-error Non-array registry input is intentional hostile data.
    expect(createRevisionRegistry({})).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/entries" }],
    });
    const exotic: RevisionEntry[] = [];
    Object.setPrototypeOf(exotic, null);
    expect(createRevisionRegistry(exotic)).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/entries" }],
    });
    const inheritedEntry: RevisionEntry = {
      component: "renderer",
      revision: digest("1"),
      value: {},
    };
    Object.setPrototypeOf(inheritedEntry, { inherited: true });
    expect(createRevisionRegistry([inheritedEntry])).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/entries/0" }],
    });
    const accessorEntry: RevisionEntry = {
      component: "renderer",
      revision: digest("1"),
      value: {},
    };
    Object.defineProperty(accessorEntry, "value", {
      enumerable: true,
      get: () => ({}),
    });
    expect(createRevisionRegistry([accessorEntry])).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/entries/0" }],
    });
    const symbolEntry: RevisionEntry & { [key: symbol]: boolean } = {
      component: "renderer",
      revision: digest("1"),
      value: {},
      [Symbol("extra")]: true,
    };
    expect(createRevisionRegistry([symbolEntry])).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/entries/0" }],
    });
    const hiddenEntry: RevisionEntry = {
      component: "renderer",
      revision: digest("1"),
      value: {},
    };
    Object.defineProperty(hiddenEntry, "extra", { value: true });
    expect(createRevisionRegistry([hiddenEntry])).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/entries/0" }],
    });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(
      createRevisionRegistry([{ component: "renderer", revision: digest("1"), value: cyclic }]),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/entries/0/value/self" }],
    });
    const sparse: RevisionEntry[] = new Array(1);
    expect(createRevisionRegistry(sparse)).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/entries" }],
    });
    const hostileTarget: RevisionEntry[] = [
      { component: "renderer", revision: digest("1"), value: {} },
    ];
    const hostile = new Proxy(hostileTarget, {
      ownKeys: () => {
        throw new TypeError("blocked");
      },
    });
    expect(createRevisionRegistry(hostile)).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/entries" }],
    });
    const excessive = Array.from(
      { length: 4_097 },
      (_, index): RevisionEntry => ({
        component: "renderer",
        revision: digest((index % 10).toString()),
        value: {},
      }),
    );
    expect(createRevisionRegistry(excessive)).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/entries" }],
    });
  });

  it("enforces one aggregate value budget across otherwise valid entries", () => {
    const large = "x".repeat(2_100_000);
    expect(
      createRevisionRegistry([
        { component: "inventory", revision: digest("1"), value: large },
        { component: "rule-model", revision: digest("2"), value: large },
      ]),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "replay.input.limit", path: "/entries/1/value" }],
    });
  });

  it("returns the first missing exact component when a resolver throws", () => {
    const replay = envelope(digest("3"), digest("4"));
    const calls: IdentityComponent[] = [];
    const result = resolveReplayRevisions(replay, {
      resolve: (component) => {
        calls.push(component);
        if (component === "rule-model") throw new TypeError("blocked");
        return {};
      },
    });

    expect(result).toEqual({
      ok: false,
      kind: "replay-incompatible",
      missing: "rule-model",
    });
    expect(calls).toEqual(["inventory", "rule-model"]);
  });

  it("returns undefined for invalid direct lookup and closes hostile resolver values", () => {
    const valid = createRevisionRegistry([
      { component: "renderer", revision: digest("1"), value: {} },
    ]);
    if (!valid.ok) throw new Error("expected registry");
    // @ts-expect-error Invalid component is intentional runtime input.
    expect(valid.registry.resolve("future", digest("1"))).toBeUndefined();
    // @ts-expect-error Invalid digest is intentional runtime input.
    expect(valid.registry.resolve("renderer", "latest")).toBeUndefined();

    const hostile = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new TypeError("blocked");
        },
      },
    );
    const replay = envelope(digest("3"), digest("4"));
    expect(
      resolveReplayRevisions(replay, {
        resolve: () => hostile,
      }),
    ).toEqual({
      ok: false,
      kind: "replay-incompatible",
      missing: "inventory",
    });
  });
});
