import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  INVENTORY_V1_LIMITS,
  boundaryVariantsHandler,
  createCampaignPlan,
  createExecutionCaseV1,
  createModeledGeneratorSuite,
  deriveConfigurationIdentity,
  deriveImplementationRevision,
  generateRuntimeCase,
  getCampaignPlanItem,
  getExecutionCaseProjectionV1,
  parseInventoryJson,
  prepareIncrementalBindingPublication,
  prepareIncrementalBindingPublicationReview,
  registerFreshCandidateBinding,
  renderGeneratedCase,
  resolvePublishedSnapshotByDigest,
  validateImplementationRevision,
  validateInventorySchema,
  type CampaignDependenciesV1,
  type CampaignIdentityInput,
  type ExecutionCaseProjectionV1,
  type ExecutionCaseV1,
  type ExecutionObservationRequestV1,
  type FreshCandidateRegistration,
  type GenerationConfiguration,
  type PreparedCampaign,
  type PublishedOracleContext,
  type Sha256Digest,
} from "@blend65/readiness";
import { createPublishedOracleContext } from "@blend65/readiness/published-oracle";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const MODEL_PATH = resolve(REPOSITORY_ROOT, "readiness/rule-models/rule-models-v1.json");
const SEED_PATH = resolve(REPOSITORY_ROOT, "readiness/rule-models/rule-model-seed-v1.json");
const REVIEW_PATH = resolve(REPOSITORY_ROOT, "readiness/reviews/rule-models-v1-review.json");
const ENCODER = new TextEncoder();
const BASE_PUBLICATION_DIGEST =
  "sha256:41afbb4512456470e0b182fb14edb5caeaac7688d7e36ba1e102fc8d42ae3403";
const ORACLE_HANDLER_IDS = [
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.semantic-relations",
] as const;

/** One independently fixed runtime case and its machine-visible answer. */
export interface RuntimeAcceptanceCaseFixture {
  readonly name: "peek" | "peekw" | "poke" | "pokew";
  readonly ruleId: string;
  readonly addressForm: "direct" | "computed";
  readonly observation: ExecutionObservationRequestV1;
  readonly expectedBytes: Uint8Array;
}

/**
 * The four accepted runtime cases cover both word starts and both read/write families.
 * Expected bytes are target-visible values, authored independently from generated source.
 */
export const RUNTIME_ACCEPTANCE_CASES: readonly RuntimeAcceptanceCaseFixture[] = [
  {
    name: "peek",
    ruleId: "rule.ch12.3-1-memory-access.peek-addr.signature.word",
    addressForm: "direct",
    observation: { kind: "scalar-bytes", byteLength: 1 },
    expectedBytes: Uint8Array.of(0xf1),
  },
  {
    name: "peekw",
    ruleId: "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
    addressForm: "direct",
    observation: { kind: "scalar-bytes", byteLength: 2 },
    expectedBytes: Uint8Array.of(0xf1, 0xf1),
  },
  {
    name: "poke",
    ruleId: "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
    addressForm: "direct",
    observation: {
      kind: "direct-mmio",
      byteLength: 1,
      address: 0xd020,
      projectionRevision: "c64-vic-color-observation-v1",
    },
    expectedBytes: Uint8Array.of(0xf0),
  },
  {
    name: "pokew",
    ruleId: "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
    addressForm: "computed",
    observation: {
      kind: "direct-mmio",
      byteLength: 2,
      address: 0xd021,
      projectionRevision: "c64-vic-color-observation-v1",
    },
    expectedBytes: Uint8Array.of(0xf0, 0xf0),
  },
] as const;

/** Genuine execution authority paired with its independent fixed answer. */
export interface GenuineRuntimeAcceptanceCase {
  readonly fixed: RuntimeAcceptanceCaseFixture;
  readonly ordinal: number;
  readonly executionCase: ExecutionCaseV1;
  readonly projection: ExecutionCaseProjectionV1;
}

/** Complete authority fixture used by the fake-control acceptance suite. */
export interface RuntimeAcceptanceFixture {
  readonly context: PublishedOracleContext;
  readonly campaign: PreparedCampaign;
  readonly cases: readonly GenuineRuntimeAcceptanceCase[];
  cleanup(): Promise<void>;
}

function sha256(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function acceptedReviewBytes(request: {
  readonly specRevision: string;
  readonly reviewUnits: readonly {
    readonly unitId: string;
    readonly semanticDigest: string;
    readonly dependencyDigests: Readonly<Record<string, string>>;
  }[];
}): Uint8Array {
  return ENCODER.encode(
    `${JSON.stringify({
      schemaVersion: 1,
      reviews: request.reviewUnits.map((unit) => ({
        unitId: unit.unitId,
        reviewer: "runtime-acceptance-spec-reviewer",
        specRevision: request.specRevision,
        semanticDigest: unit.semanticDigest,
        dependencyDigests: unit.dependencyDigests,
        outcome: "accepted",
        resolvedDisagreementIds: [],
      })),
    })}\n`,
  );
}

async function createOracleAuthority(): Promise<{
  readonly root: string;
  readonly context: PublishedOracleContext;
  readonly inventoryBytes: Uint8Array;
}> {
  const root = await mkdtemp(join(tmpdir(), "blend65-runtime-acceptance-authority-"));
  await cp(join(REPOSITORY_ROOT, "readiness"), join(root, "readiness"), { recursive: true });
  await cp(join(REPOSITORY_ROOT, "spec"), join(root, "spec"), { recursive: true });
  await cp(join(REPOSITORY_ROOT, "packages/readiness/src"), join(root, "packages/readiness/src"), {
    recursive: true,
  });
  await cp(
    join(REPOSITORY_ROOT, "packages/readiness/package.json"),
    join(root, "packages/readiness/package.json"),
  );
  await writeFile(
    join(root, "readiness/publications/current-publication.json"),
    ENCODER.encode(
      `${JSON.stringify({ schemaVersion: 1, publicationDigest: BASE_PUBLICATION_DIGEST })}\n`,
    ),
  );
  const base = await resolvePublishedSnapshotByDigest({
    repositoryRoot: root,
    publicationDigest: BASE_PUBLICATION_DIGEST,
  });
  if (!base.ok) throw new TypeError("base publication resolution failed");
  const review = await prepareIncrementalBindingPublicationReview({
    repositoryRoot: root,
    baseSnapshot: base.value,
    targetHandlerIds: ORACLE_HANDLER_IDS,
  });
  if (!review.ok) throw new TypeError("publication review preparation failed");
  const prepared = await prepareIncrementalBindingPublication({
    repositoryRoot: root,
    baseSnapshot: base.value,
    targetHandlerIds: ORACLE_HANDLER_IDS,
    semanticReviewBytes: acceptedReviewBytes(review.value.request),
  });
  if (!prepared.ok) throw new TypeError("publication preparation failed");
  const inventoryBytes = await readFile(
    join(
      root,
      "readiness/publications/releases",
      prepared.value.publicationDigest,
      "compiler-readiness-v1.json",
    ),
  );
  const context = createPublishedOracleContext(prepared.value.stagedSnapshot);
  if (!context.ok) throw new TypeError("published oracle context creation failed");
  return { root, context: context.value, inventoryBytes };
}

function freshRegistration<TImplementation extends (...arguments_: never[]) => unknown>(
  name: string,
  binding: {
    readonly handlerId: string;
    readonly kind: "generator" | "transform";
    readonly contractVersion: string;
    readonly implementation: TImplementation;
  },
): FreshCandidateRegistration {
  const path = `fixtures/${name}.ts`;
  const metadata = {
    contractVersion: binding.contractVersion,
    entryPath: path,
    files: [{ path, content: ENCODER.encode(`export const fixture = "${name}";\n`) }],
  };
  const derived = deriveImplementationRevision(metadata);
  if (!derived.ok) throw new TypeError("fixture implementation revision failed");
  const freshness = validateImplementationRevision({
    claimedRevision: derived.revision,
    metadata,
  });
  if (!freshness.ok) throw new TypeError("fixture implementation freshness failed");
  const registered = registerFreshCandidateBinding({
    binding: { ...binding, implementationRevision: derived.revision },
    freshness,
  });
  if (!registered.ok) throw new TypeError("fixture binding registration failed");
  return registered.registration;
}

async function createRuntimeCampaign(inventoryBytes: Uint8Array): Promise<PreparedCampaign> {
  const [ruleModelBytes, seedContractBytes, reviewEvidenceBytes] = await Promise.all([
    readFile(MODEL_PATH),
    readFile(SEED_PATH),
    readFile(REVIEW_PATH),
  ]);
  const parsed = parseInventoryJson(inventoryBytes, INVENTORY_V1_LIMITS);
  if (!parsed.ok || parsed.inventory === undefined) throw new TypeError("inventory parse failed");
  const validated = validateInventorySchema(parsed.inventory);
  if (!validated.ok || validated.inventory === undefined) {
    throw new TypeError("inventory validation failed");
  }
  const modeled = createModeledGeneratorSuite({
    inventory: validated.inventory,
    seedContractBytes,
    ruleModelBytes,
    reviewEvidenceBytes,
  });
  if (!modeled.ok) throw new TypeError("modeled suite creation failed");
  const configuration: GenerationConfiguration = {
    caseCount: 160,
    maxInvalidCases: 32,
    enabledRuleIds: RUNTIME_ACCEPTANCE_CASES.map(({ ruleId }) => ruleId).sort(),
    spellings: ["const", "literal", "local", "parameter"],
    budget: {
      maxModules: 4,
      maxDeclarations: 128,
      maxIrNodes: 512,
      maxStatements: 256,
      maxExpressionDepth: 16,
      maxLoopWork: 1n,
      maxSourceBytes: 65_536,
      maxAttempts: 192,
    },
  };
  const configurationIdentity = deriveConfigurationIdentity(configuration);
  if (!configurationIdentity.ok) throw new TypeError("configuration identity failed");
  const generator = freshRegistration("runtime-acceptance-generator", {
    handlerId: "generator.runtime-cases",
    kind: "generator",
    contractVersion: "1.0.0",
    implementation: generateRuntimeCase,
  });
  const boundary = freshRegistration("runtime-acceptance-boundary", {
    handlerId: "transform.boundary-variants",
    kind: "transform",
    contractVersion: "1.0.0",
    implementation: boundaryVariantsHandler,
  });
  const rendererMetadata = {
    contractVersion: "1.0.0",
    entryPath: "fixtures/runtime-acceptance-renderer.ts",
    files: [
      {
        path: "fixtures/runtime-acceptance-renderer.ts",
        content: ENCODER.encode('export const fixture = "runtime-acceptance-renderer";\n'),
      },
    ],
  };
  const rendererRevision = deriveImplementationRevision(rendererMetadata);
  if (!rendererRevision.ok) throw new TypeError("renderer revision failed");
  const dependencies: CampaignDependenciesV1 = {
    inventory: {
      schemaVersion: 1,
      inventoryVersion: validated.inventory.inventoryVersion,
      inventoryDigest: sha256(inventoryBytes),
      specRevision: "spec-v3.0",
    },
    ruleModel: {
      schemaVersion: 1,
      ruleModelVersion: "rule-model-v1",
      ruleModelDigest: modeled.ruleModelDigest,
      suite: modeled.suite,
    },
    generator,
    boundaryTransform: boundary,
    renderer: {
      implementationRevision: rendererRevision.revision,
      implementation: renderGeneratedCase,
    },
  };
  const campaign: CampaignIdentityInput = {
    inventorySchemaVersion: 1,
    inventoryVersion: dependencies.inventory.inventoryVersion,
    inventoryDigest: dependencies.inventory.inventoryDigest,
    specRevision: dependencies.inventory.specRevision,
    ruleModelVersion: dependencies.ruleModel.ruleModelVersion,
    ruleModelDigest: dependencies.ruleModel.ruleModelDigest,
    generator: {
      handlerId: generator.binding.handlerId,
      contractVersion: generator.binding.contractVersion,
      implementationRevision: generator.binding.implementationRevision,
    },
    boundaryTransform: {
      handlerId: boundary.binding.handlerId,
      contractVersion: boundary.binding.contractVersion,
      implementationRevision: boundary.binding.implementationRevision,
    },
    rendererRevision: rendererRevision.revision,
    target: "c64",
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: `sha256:${"4".repeat(64)}`,
    configurationDigest: configurationIdentity.identity,
  };
  const prepared = createCampaignPlan({ campaign, configuration, dependencies });
  if (!prepared.ok) throw new TypeError("runtime campaign creation failed");
  return prepared.value;
}

function findCase(
  campaign: PreparedCampaign,
  fixed: RuntimeAcceptanceCaseFixture,
): GenuineRuntimeAcceptanceCase {
  for (let ordinal = 0; ordinal < campaign.summary.totalCaseCount; ordinal += 1) {
    const item = getCampaignPlanItem(campaign, ordinal);
    if (!item.ok || item.value.lane === "invalid") continue;
    const choice = item.value.request.choice;
    if (
      choice.kind !== "memory" ||
      choice.ruleId !== fixed.ruleId ||
      choice.addressForm !== fixed.addressForm
    ) {
      continue;
    }
    const created = createExecutionCaseV1(campaign, ordinal, fixed.observation);
    if (!created.ok) continue;
    const projection = getExecutionCaseProjectionV1(created.value);
    if (!projection.ok) continue;
    return {
      fixed,
      ordinal,
      executionCase: created.value,
      projection: projection.value,
    };
  }
  throw new TypeError(`missing fixed runtime case: ${fixed.name}`);
}

/** Creates selected oracle authority plus all four deterministic runtime cases. */
export async function createRuntimeAcceptanceFixture(
  _legacyRouteApi?: unknown,
): Promise<RuntimeAcceptanceFixture> {
  const authority = await createOracleAuthority();
  const campaign = await createRuntimeCampaign(authority.inventoryBytes);
  const context = authority.context;
  const cases = RUNTIME_ACCEPTANCE_CASES.map((fixed) => findCase(campaign, fixed));
  for (const entry of cases) {
    const source = new TextDecoder().decode(entry.projection.sourceBytes);
    if (/oracle|expected|0xF0|\b240\b/iu.test(source)) {
      await rm(authority.root, { recursive: true, force: true });
      throw new TypeError("generated source contains host-side answer material");
    }
  }
  return {
    context,
    campaign,
    cases,
    cleanup: () => rm(authority.root, { recursive: true, force: true }),
  };
}
