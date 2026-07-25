import { uint8ArrayByteLength } from "./canonical-identity.js";
import { deriveCaseIdentity, type CaseIdentity } from "./case-identity.js";
import { getCampaignPlanItem } from "./campaign-plan-item.js";
import {
  readCampaignPlanItemOrdinal,
  snapshotCampaignPlanItem,
} from "./campaign-plan-item-snapshot.js";
import type {
  CampaignDiagnostic,
  CampaignPlanItem,
  CampaignResult,
  CaseRenderSuccess,
  GeneratedCase,
  PreparedCampaign,
} from "./campaign-model.js";
import { getPreparedCampaignState, type PreparedCampaignState } from "./campaign-state.js";
import type { GenerationUsage } from "./generator-ir.js";
import { inspectGeneratorInput } from "./generator-ir-validator.js";
import { validateGeneratedConstruction } from "./modeled-construction-templates.js";
import type { GeneratedModeledCase, GeneratorCaseResult } from "./modeled-generator-model.js";
import { getReplayCampaignTargetState, type ReplayCampaignTarget } from "./replay-target.js";

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const ATTEMPTS = 1;
const TEXT_DECODER = new TextDecoder("utf-8", { fatal: true });

function failure<T>(
  code: CampaignDiagnostic["code"],
  path: string,
  message: string,
): CampaignResult<T> {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([Object.freeze({ code, path, message })]),
  });
}

function success<T>(value: T): CampaignResult<T> {
  return Object.freeze({ ok: true, value, diagnostics: EMPTY_DIAGNOSTICS });
}

function generatedOutcome(
  value: unknown,
): value is Extract<GeneratorCaseResult, { readonly ok: true; readonly outcome: "generated" }> {
  if (typeof value !== "object" || value === null) return false;
  const structure = inspectGeneratorInput(value, "/generator", () => false);
  if (structure !== undefined) return false;
  const caseValue = Reflect.get(value, "case");
  return (
    Reflect.get(value, "ok") === true &&
    Reflect.get(value, "outcome") === "generated" &&
    typeof caseValue === "object" &&
    caseValue !== null &&
    Array.isArray(Reflect.get(value, "diagnostics")) &&
    Reflect.get(value, "diagnostics").length === 0 &&
    validateGeneratedConstruction(caseValue)
  );
}

function renderedOutcome(value: unknown): value is CaseRenderSuccess {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    const expectedKeys = [
      "ok",
      "kind",
      "source",
      "sourceBytes",
      "projection",
      "effectiveParameterBindings",
      "diagnostics",
    ];
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) {
      return false;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      expectedKeys.some((key) => {
        const descriptor = descriptors[key];
        return descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable;
      })
    ) {
      return false;
    }
    const sourceBytes = descriptors.sourceBytes;
    const source = descriptors.source;
    const projection = descriptors.projection;
    const bindings = descriptors.effectiveParameterBindings;
    const diagnostics = descriptors.diagnostics;
    if (
      descriptors.ok?.value !== true ||
      (descriptors.kind?.value !== "valid" &&
        descriptors.kind?.value !== "invalid-source-transform" &&
        descriptors.kind?.value !== "invalid-parameter-binding") ||
      source === undefined ||
      !("value" in source) ||
      typeof source.value !== "string" ||
      sourceBytes === undefined ||
      !("value" in sourceBytes) ||
      uint8ArrayByteLength(sourceBytes.value) === undefined ||
      projection === undefined ||
      !("value" in projection) ||
      bindings === undefined ||
      !("value" in bindings) ||
      !Array.isArray(bindings.value) ||
      diagnostics === undefined ||
      !("value" in diagnostics) ||
      !Array.isArray(diagnostics.value) ||
      diagnostics.value.length !== 0
    ) {
      return false;
    }
    const projectionFailure = inspectGeneratorInput(projection.value, "/projection", () => false);
    const bindingFailure = inspectGeneratorInput(bindings.value, "/bindings", () => false);
    return (
      projectionFailure === undefined &&
      bindingFailure === undefined &&
      TEXT_DECODER.decode(sourceBytes.value) === source.value
    );
  } catch {
    return false;
  }
}

function finalizeUsage(
  modeledCase: GeneratedModeledCase,
  sourceBytes: Uint8Array,
): GenerationUsage {
  return Object.freeze({
    modules: modeledCase.constructionUsage.modules,
    declarations: modeledCase.constructionUsage.declarations,
    "ir-nodes": modeledCase.constructionUsage["ir-nodes"],
    statements: modeledCase.constructionUsage.statements,
    "expression-depth": modeledCase.constructionUsage["expression-depth"],
    "loop-work": modeledCase.constructionUsage["loop-work"],
    "source-bytes": BigInt(sourceBytes.byteLength),
    attempts: BigInt(ATTEMPTS),
  });
}

/**
 * Generates one exact prepared plan item without reading mutable campaign state.
 *
 * @param campaign Factory-produced prepared campaign.
 * @param item Exact item derived from that campaign.
 * @returns Final case evidence or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const generated = generateCase(campaign, item);
 * ```
 */
export function generateCase(
  campaign: PreparedCampaign,
  item: CampaignPlanItem,
): CampaignResult<GeneratedCase> {
  const state = getPreparedCampaignState(campaign);
  if (state === undefined) {
    return failure("campaign.input.invalid", "/campaign", "Prepared campaign is invalid.");
  }
  const ordinal = readCampaignPlanItemOrdinal(item);
  const expectedItem = ordinal === undefined ? undefined : getCampaignPlanItem(campaign, ordinal);
  const snapshot =
    expectedItem?.ok === true ? snapshotCampaignPlanItem(item, expectedItem.value) : undefined;
  if (snapshot === undefined) {
    return failure(
      "campaign.input.invalid",
      "/item",
      "Plan item does not belong to this prepared campaign.",
    );
  }
  return generateResolvedCase(state, snapshot);
}

function generateResolvedCase(
  state: PreparedCampaignState,
  item: CampaignPlanItem,
  retainedIdentity?: CaseIdentity,
): CampaignResult<GeneratedCase> {
  let generated: unknown;
  try {
    generated = state.dependencies.generator.implementation(
      state.dependencies.ruleModel.suite,
      item.request,
    );
  } catch {
    return failure(
      "campaign.case.invalid",
      "/dependencies/generator",
      "Generator implementation threw.",
    );
  }
  if (!generatedOutcome(generated)) {
    return failure(
      "campaign.case.invalid",
      "/dependencies/generator",
      "Generator did not return one closed generated case.",
    );
  }
  let rendered: unknown;
  try {
    rendered = state.dependencies.renderer.implementation(generated.case, item.renderOptions);
  } catch {
    return failure(
      "campaign.render.invalid",
      "/dependencies/renderer",
      "Renderer implementation threw.",
    );
  }
  if (!renderedOutcome(rendered)) {
    return failure(
      "campaign.render.invalid",
      "/dependencies/renderer",
      "Renderer did not return one closed independently parsed case.",
    );
  }
  const identity =
    retainedIdentity === undefined
      ? deriveCaseIdentity(state.campaignDigest, item.generationPath, item.ordinal)
      : undefined;
  const caseIdentity = retainedIdentity ?? (identity?.ok === true ? identity.identity : undefined);
  if (caseIdentity === undefined) {
    return failure(
      "campaign.case.invalid",
      "/identity",
      "Generated case identity could not be derived.",
    );
  }
  const usage = finalizeUsage(generated.case, rendered.sourceBytes);
  if (
    usage["source-bytes"] > BigInt(state.configuration.budget.maxSourceBytes) ||
    usage.attempts > BigInt(state.configuration.budget.maxAttempts)
  ) {
    return failure(
      "campaign.case.invalid",
      "/usage",
      "Final case usage exceeds the prepared generation budget.",
    );
  }
  return success(
    Object.freeze({
      identity: caseIdentity,
      planItem: item,
      modeledCase: generated.case,
      source: rendered.source,
      sourceBytes: rendered.sourceBytes,
      roundTripProjection: rendered.projection,
      effectiveParameterBindings: rendered.effectiveParameterBindings,
      usage,
      attempts: ATTEMPTS,
    }),
  );
}

/**
 * Generates one factory-verified target-only replay item.
 *
 * @param target Distinct single-item replay capability.
 * @returns Exact generated case without a campaign-wide identity scan.
 */
export function generateReplayTargetCase(
  target: ReplayCampaignTarget,
): CampaignResult<GeneratedCase> {
  const retained = getReplayCampaignTargetState(target);
  return retained === undefined
    ? failure("campaign.input.invalid", "/target", "Replay campaign target is invalid.")
    : generateResolvedCase(retained.campaign, retained.item, retained.identity);
}

/**
 * Resolves and generates one campaign ordinal in a single output-pure operation.
 *
 * @param campaign Factory-produced prepared campaign.
 * @param ordinal Zero-based campaign ordinal.
 * @returns Final generated case or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const generated = generateCampaignCase(campaign, 0);
 * ```
 */
export function generateCampaignCase(
  campaign: PreparedCampaign,
  ordinal: number,
): CampaignResult<GeneratedCase> {
  const item = getCampaignPlanItem(campaign, ordinal);
  if (!item.ok) return item;
  const state = getPreparedCampaignState(campaign);
  return state === undefined
    ? failure("campaign.input.invalid", "/campaign", "Prepared campaign is invalid.")
    : generateResolvedCase(state, item.value);
}
