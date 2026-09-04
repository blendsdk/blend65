import { createHash } from "node:crypto";

import {
  deriveCampaignIdentity,
  deriveCaseIdentity,
  deriveConfigurationIdentity,
  type CampaignIdentityInput,
} from "./case-identity.js";
import type { GenerationConfiguration, GenerationSpelling } from "./canonical-identity.js";
import type { GenIdentifier, StructuredGenerationBudgetV2 } from "./generator-ir.js";
import { isGenIdentifier } from "./generator-ir.js";
import { validateStructuredGeneratorIrSyntax } from "./generator-ir-validator.js";
import type { StructuredGeneratedModeledCaseV1 } from "./modeled-generator-model.js";
import { ORACLE_SUITE_CAPABILITY } from "./oracle-model.js";
import type { MemoryFixtureV1, OracleBudgetV1, OracleSuite } from "./oracle-model.js";
import { renderSourceModule } from "./source-renderer.js";
import {
  createStructuredCaseDefinitionsV1,
  STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1,
  type StructuredCaseAuthorityV1,
} from "./structured-case-families.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { normalizeReplayEnvelope } from "./replay-envelope-normalizer.js";
import { deriveStructuredConstructionUsage } from "./structured-ir-usage.js";

const GENERATION_BUDGET: StructuredGenerationBudgetV2 = Object.freeze({
  schemaVersion: 2,
  maxModules: 8,
  maxDeclarations: 128,
  maxIrNodes: 8_192,
  maxStatements: 4_096,
  maxExpressionDepth: 64,
  maxLoopWork: 1_024n,
  maxSourceBytes: 1_048_576,
  maxAttempts: 64,
  maxStatementDepth: 8,
});
const ORACLE_BUDGET: OracleBudgetV1 = Object.freeze({
  inputNodes: 16_384n,
  expressionDepth: 128n,
  evaluationSteps: 65_536n,
  frames: 256n,
  memoryCells: 65_536n,
  effects: 16_384n,
  transformedNodes: 32_768n,
});
const EMPTY_MEMORY: MemoryFixtureV1 = Object.freeze({ schemaVersion: 1, cells: Object.freeze([]) });
const TEXT_ENCODER = new TextEncoder();
const AUTHORITY_DOMAIN = "blend65.readiness.structured-case-authority.v1";

interface AuthorityIdentityField {
  readonly name: string;
  readonly value: string | Uint8Array;
}

function digest(text: string): Sha256Digest {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function digestBytes(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function u32Bytes(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError("Structured authority field exceeds the unsigned 32-bit range.");
  }
  return Uint8Array.of(
    Math.floor(value / 0x100_0000),
    Math.floor(value / 0x1_0000) & 0xff,
    Math.floor(value / 0x100) & 0xff,
    value & 0xff,
  );
}

function canonicalIdentityJson(value: unknown): string {
  const normalize = (member: unknown): unknown => {
    if (typeof member === "bigint") return { $bigint: member.toString(10) };
    if (member instanceof Uint8Array) return { $bytes: Buffer.from(member).toString("base64") };
    if (Array.isArray(member)) return member.map(normalize);
    if (typeof member !== "object" || member === null) return member;
    return Object.fromEntries(
      Object.entries(member)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalize(child)]),
    );
  };
  return JSON.stringify(normalize(value));
}

function hashAuthorityFields(fields: readonly AuthorityIdentityField[]): Sha256Digest {
  const hash = createHash("sha256");
  const domain = TEXT_ENCODER.encode(AUTHORITY_DOMAIN);
  hash.update(u32Bytes(domain.byteLength));
  hash.update(domain);
  hash.update(u32Bytes(fields.length));
  for (const field of fields) {
    const name = TEXT_ENCODER.encode(field.name);
    const value = typeof field.value === "string" ? TEXT_ENCODER.encode(field.value) : field.value;
    hash.update(u32Bytes(name.byteLength));
    hash.update(name);
    hash.update(u32Bytes(value.byteLength));
    hash.update(value);
  }
  return `sha256:${hash.digest("hex")}`;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  for (const key of Reflect.ownKeys(value)) deepFreeze(Reflect.get(value, key));
  if (!Object.isFrozen(value)) Object.freeze(value);
  return value;
}

function deepSnapshot<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function identifier(value: string): GenIdentifier {
  if (!isGenIdentifier(value)) throw new TypeError("Structured registry identifier is invalid.");
  return value;
}

function configuration(): GenerationConfiguration {
  return Object.freeze({
    caseCount: 18,
    maxInvalidCases: 3,
    enabledRuleIds: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1,
    spellings: Object.freeze([
      "const",
      "literal",
      "local",
      "parameter",
    ] satisfies readonly GenerationSpelling[]),
    budget: Object.freeze({
      maxModules: GENERATION_BUDGET.maxModules,
      maxDeclarations: GENERATION_BUDGET.maxDeclarations,
      maxIrNodes: GENERATION_BUDGET.maxIrNodes,
      maxStatements: GENERATION_BUDGET.maxStatements,
      maxExpressionDepth: GENERATION_BUDGET.maxExpressionDepth,
      maxLoopWork: GENERATION_BUDGET.maxLoopWork,
      maxSourceBytes: GENERATION_BUDGET.maxSourceBytes,
      maxAttempts: GENERATION_BUDGET.maxAttempts,
    }),
  });
}

function campaign(configurationDigest: Sha256Digest): CampaignIdentityInput {
  return Object.freeze({
    inventorySchemaVersion: 1,
    inventoryVersion: "structured-phase1-v1",
    inventoryDigest: digest("structured-inventory-v1"),
    specRevision: "spec-v3.0",
    ruleModelVersion: "structured-phase1-v1",
    ruleModelDigest: digest("structured-rule-model-v1"),
    generator: Object.freeze({
      handlerId: "generator.runtime-cases",
      contractVersion: "1.0.0",
      implementationRevision: digest("structured-generator-v1"),
    }),
    boundaryTransform: Object.freeze({
      handlerId: "transform.boundary-variants",
      contractVersion: "1.0.0",
      implementationRevision: digest("structured-boundary-v1"),
    }),
    rendererRevision: digest("structured-renderer-v1"),
    target: "c64",
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: digest("structured-phase1-seed"),
    configurationDigest,
  });
}

/**
 * Builds the immutable internal registry behind the structured case resolver.
 *
 * @returns Every reviewed structured authority indexed by its stable case ID.
 *
 * @example
 * ```ts
 * const registry = buildStructuredCaseRegistryV1();
 * ```
 */
export function buildStructuredCaseRegistryV1(): ReadonlyMap<string, StructuredCaseAuthorityV1> {
  const closedConfiguration = configuration();
  const configurationIdentity = deriveConfigurationIdentity(closedConfiguration);
  if (!configurationIdentity.ok) throw new TypeError("Structured configuration identity failed.");
  const campaignInput = campaign(configurationIdentity.identity);
  const campaignIdentity = deriveCampaignIdentity(campaignInput);
  if (!campaignIdentity.ok) throw new TypeError("Structured campaign identity failed.");
  const entries = new Map<string, StructuredCaseAuthorityV1>();
  createStructuredCaseDefinitionsV1().forEach((inputDefinition, ordinal) => {
    const definition = deepSnapshot(inputDefinition);
    const syntax = validateStructuredGeneratorIrSyntax(definition.module);
    if (!syntax.ok) throw new TypeError(`Structured case syntax failed: ${definition.caseId}`);
    deepFreeze(syntax.module);
    const rendered = renderSourceModule(syntax.module, {
      maxSourceBytes: GENERATION_BUDGET.maxSourceBytes,
      literalSpellings: [],
    });
    if (!rendered.ok) throw new TypeError(`Structured case rendering failed: ${definition.caseId}`);
    const caseIdentity = deriveCaseIdentity(campaignIdentity.identity, [ordinal], ordinal);
    if (!caseIdentity.ok) throw new TypeError("Structured case identity failed.");
    const sourceProvenanceInput = Object.freeze({
      schemaVersion: 1,
      campaign: campaignInput,
      campaignDigest: campaignIdentity.identity,
      caseIdentity: caseIdentity.identity,
      configuration: Object.freeze({
        ...closedConfiguration,
        budget: Object.freeze({
          ...closedConfiguration.budget,
          maxLoopWork: closedConfiguration.budget.maxLoopWork.toString(10),
        }),
      }),
    });
    const provenance = normalizeReplayEnvelope(sourceProvenanceInput);
    if (!provenance.ok) {
      const first = provenance.diagnostics[0];
      throw new TypeError(
        `Structured case provenance failed: ${definition.caseId} (${first?.code ?? "unknown"} at ${first?.path ?? ""}).`,
      );
    }
    const sourceProvenance = deepSnapshot(provenance.envelope);
    const validity =
      definition.validity === undefined
        ? Object.freeze({ kind: "valid" as const })
        : deepSnapshot(definition.validity);
    const constructionUsage = deriveStructuredConstructionUsage(
      syntax.module,
      GENERATION_BUDGET.maxLoopWork,
    );
    const parameterBindings = deepSnapshot(definition.parameterBindings ?? []);
    const generatedCase: StructuredGeneratedModeledCaseV1 = deepFreeze({
      projection: Object.freeze({ kind: "structured", module: syntax.module }),
      parameterBindings,
      primaryRuleId: definition.ruleId,
      claimedRuleIds: Object.freeze([definition.ruleId]),
      spelling: "literal",
      validity,
      constructionUsage,
    });
    const oracleSuite: OracleSuite = Object.freeze({
      [ORACLE_SUITE_CAPABILITY]: true as const,
    });
    const arrayPlacement =
      definition.arrayPlacement === undefined ? undefined : deepSnapshot(definition.arrayPlacement);
    const oracleInput = deepFreeze({
      schemaVersion: 2 as const,
      handlerId: "oracle.structured-program" as const,
      module: syntax.module,
      entryFunction: identifier(definition.entryFunction ?? "main"),
      parameterBindings,
      memory: EMPTY_MEMORY,
      ...(arrayPlacement === undefined ? {} : { arrayPlacement }),
      generationBudget: GENERATION_BUDGET,
      budget: ORACLE_BUDGET,
      expectationAuthority: "independent-structured-oracle-v2" as const,
    });
    const canonicalIrDigest = digest(
      `blend65.readiness.structured-ir.v1\0${canonicalIdentityJson(syntax.module)}`,
    );
    const renderedDigest = digestBytes(rendered.sourceBytes);
    const caseDigest = hashAuthorityFields([
      { name: "schemaVersion", value: "1" },
      { name: "revision", value: "structured-case-authority-v1" },
      { name: "caseId", value: definition.caseId },
      { name: "canonicalIrDigest", value: canonicalIrDigest },
      { name: "renderedDigest", value: renderedDigest },
      { name: "renderedBytes", value: rendered.sourceBytes },
      { name: "spelling", value: generatedCase.spelling },
      { name: "validity", value: canonicalIdentityJson(generatedCase.validity) },
      { name: "primaryRuleId", value: generatedCase.primaryRuleId },
      { name: "claimedRuleIds", value: canonicalIdentityJson(generatedCase.claimedRuleIds) },
      { name: "parameterBindings", value: canonicalIdentityJson(generatedCase.parameterBindings) },
      { name: "constructionUsage", value: canonicalIdentityJson(constructionUsage) },
      { name: "oracleSchemaVersion", value: String(oracleInput.schemaVersion) },
      { name: "oracleHandlerId", value: oracleInput.handlerId },
      { name: "oracleEntryFunction", value: oracleInput.entryFunction },
      { name: "memory", value: canonicalIdentityJson(oracleInput.memory) },
      {
        name: "arrayPlacement",
        value: canonicalIdentityJson(oracleInput.arrayPlacement ?? null),
      },
      { name: "generationBudget", value: canonicalIdentityJson(oracleInput.generationBudget) },
      { name: "oracleBudget", value: canonicalIdentityJson(oracleInput.budget) },
      { name: "expectationAuthority", value: oracleInput.expectationAuthority },
      { name: "relationSelectionPath", value: definition.relationSelectionPath ?? "" },
      { name: "sourceProvenance", value: canonicalIdentityJson(sourceProvenance) },
    ]);
    const authority: StructuredCaseAuthorityV1 = deepFreeze({
      caseId: definition.caseId,
      caseDigest,
      generatedCase,
      sourceProvenance,
      oracleSuite,
      oracleInput,
      ...(definition.relationSelectionPath === undefined
        ? {}
        : { relationSelectionPath: definition.relationSelectionPath }),
    });
    entries.set(definition.caseId, authority);
  });
  return entries;
}
