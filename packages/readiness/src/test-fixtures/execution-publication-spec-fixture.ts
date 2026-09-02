import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import {
  prepareIncrementalBindingPublication,
  prepareIncrementalBindingPublicationReview,
  publishIncrementalBindingPublication,
} from "../binding-publication.js";
import { resolvePublishedSnapshotByDigest } from "../publication-resolver.js";
import { createHistoricalReadinessAuthorityRepository } from "./historical-readiness-authority.js";

import type { PublicationReviewRequestV1 } from "../publication-model.js";

export const CURRENT_PARENT_DIGEST =
  "sha256:e1713db3ca7dc9d624d0f9e9cb064b6fdcfd3a3e2b0e2421b5c482e00f266905";
export const HISTORICAL_PARENT_DIGEST =
  "sha256:41afbb4512456470e0b182fb14edb5caeaac7688d7e36ba1e102fc8d42ae3403";
export const SPEC_REVISION =
  "sha256:51860164138f80e23eabf7cfd685ed47a8faf486ff7aee36cc9f46d8b86e1ccd";

export const CAPABILITY_IDS = ["frontend", "compiler-api", "cli", "emit", "acme", "vice"] as const;

export const BINDING_IDS = ["acme", "cli", "compiler-api", "emit", "frontend", "vice"] as const;

const MODELED_RULE_BOUNDARIES = [
  ["rule.ch02.2-primitive-types.boolean.range.true", "boundary.scalar.boolean"],
  ["rule.ch02.2-primitive-types.byte.range.0-255", "boundary.scalar.byte"],
  ["rule.ch02.2-primitive-types.sbyte.range.128-127", "boundary.scalar.sbyte"],
  ["rule.ch02.2-primitive-types.sword.range.32768-32767", "boundary.scalar.sword"],
  ["rule.ch02.2-primitive-types.word.range.0-65535", "boundary.scalar.word"],
  ["rule.ch12.3-1-memory-access.peek-addr.signature.word", "boundary.memory.peek"],
  ["rule.ch12.3-1-memory-access.peekw-addr.signature.word", "boundary.memory.peekw"],
  ["rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte", "boundary.memory.poke"],
  ["rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word", "boundary.memory.pokew"],
] as const;

const ALLOWED_APPLICABILITY = new Set(["mandatory-c64", "out-of-claim-target"] as const);

export type CapabilityId = (typeof CAPABILITY_IDS)[number];
export type ParentRuleApplicability = "mandatory-c64" | "out-of-claim-target";

export interface ParentModeledRuleFixtureV1 {
  readonly ruleId: string;
  readonly applicability: ParentRuleApplicability;
  readonly evidenceObligations: readonly string[];
  readonly boundaryFamilyIds: readonly [string];
}

export interface ExecutionBindingFixtureV1 {
  capabilityId: CapabilityId | string;
  contractVersion: string;
  implementationRevision: string;
}

export interface ExecutionBindingsFixtureV1 {
  schemaVersion: 1;
  kind: "execution-bindings-v1";
  bindings: ExecutionBindingFixtureV1[];
}

export interface ExecutionReviewFixtureV1 {
  schemaVersion: 1;
  kind: "execution-semantic-review-v1";
  specRevision: string;
  parentDigest: string;
  bindingDigest: string;
  ciSafe: { digest: string; outcome: "accepted" };
  coverage: { digest: string; outcome: "accepted" };
  localAcmeVice: { digest: string; outcome: "accepted" };
  unresolvedCritical: number;
  unresolvedMajor: number;
  reviewer: string;
  outcome: "accepted";
}

export interface ExecutionPublicationInputFixtureV1 {
  repositoryRoot: string;
  parentDigest: string;
  bindingBytes: Uint8Array;
  semanticReviewBytes: Uint8Array;
}

export interface ExpectedExecutionPublicationV1 {
  digest: string;
  parentDigest: string;
  bindingDigest: string;
  semanticReviewDigest: string;
  manifestBytes: Uint8Array;
  memberBytes: Readonly<Record<string, Uint8Array>>;
}

const encoder = new TextEncoder();
const CURRENT_ORACLE_HANDLER_IDS = Object.freeze([
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.semantic-relations",
]);
let currentParentTemplatePromise: Promise<Readonly<Record<string, Uint8Array>>> | undefined;

export function digestBytes(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function canonicalJsonBytes(value: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(value)}\n`);
}

function revisionFor(capabilityId: string, variant: string): string {
  return digestBytes(encoder.encode(`execution:${capabilityId}:${variant}`));
}

function reportDigest(name: string, variant: string): string {
  return digestBytes(encoder.encode(`review:${name}:${variant}`));
}

export function makeBindings(variant = "accepted"): ExecutionBindingsFixtureV1 {
  return {
    schemaVersion: 1,
    kind: "execution-bindings-v1",
    bindings: BINDING_IDS.map((capabilityId) => ({
      capabilityId,
      contractVersion: "1.0.0",
      implementationRevision: revisionFor(capabilityId, variant),
    })),
  };
}

export function makeReview(
  parentDigest: string,
  bindingBytes: Uint8Array,
  variant = "accepted",
): ExecutionReviewFixtureV1 {
  return {
    schemaVersion: 1,
    kind: "execution-semantic-review-v1",
    specRevision: SPEC_REVISION,
    parentDigest,
    bindingDigest: digestBytes(bindingBytes),
    ciSafe: { digest: reportDigest("ci-safe", variant), outcome: "accepted" },
    coverage: {
      digest: reportDigest("coverage", variant),
      outcome: "accepted",
    },
    localAcmeVice: {
      digest: reportDigest("local-acme-vice", variant),
      outcome: "accepted",
    },
    unresolvedCritical: 0,
    unresolvedMajor: 0,
    reviewer: `semantic-reviewer-${variant}`,
    outcome: "accepted",
  };
}

export function makePublicationInput(
  repositoryRoot: string,
  parentDigest = CURRENT_PARENT_DIGEST,
  variant = "accepted",
): ExecutionPublicationInputFixtureV1 {
  const bindingBytes = canonicalJsonBytes(makeBindings(variant));
  return {
    repositoryRoot,
    parentDigest,
    bindingBytes,
    semanticReviewBytes: canonicalJsonBytes(makeReview(parentDigest, bindingBytes, variant)),
  };
}

export function expectedPublication(
  input: ExecutionPublicationInputFixtureV1,
): ExpectedExecutionPublicationV1 {
  const parentBytes = canonicalJsonBytes({
    schemaVersion: 1,
    kind: "execution-parent-publication-v1",
    parentDigest: input.parentDigest,
  });
  const memberBytes = {
    "execution-bindings-v1.json": input.bindingBytes,
    "execution-parent-v1.json": parentBytes,
    "execution-semantic-review-v1.json": input.semanticReviewBytes,
  };
  const members = Object.entries(memberBytes).map(([path, bytes]) => ({
    path,
    byteLength: bytes.byteLength,
    digest: digestBytes(bytes),
  }));
  const manifestBytes = canonicalJsonBytes({
    schemaVersion: 1,
    kind: "execution-publication-v1",
    parentDigest: input.parentDigest,
    members,
  });
  const releaseHash = createHash("sha256")
    .update(encoder.encode("blend65-execution-publication-v1\0"))
    .update(manifestBytes)
    .digest("hex");

  return {
    digest: `sha256:${releaseHash}`,
    parentDigest: input.parentDigest,
    bindingDigest: digestBytes(input.bindingBytes),
    semanticReviewDigest: digestBytes(input.semanticReviewBytes),
    manifestBytes,
    memberBytes,
  };
}

function readinessReviewBytes(request: PublicationReviewRequestV1): Uint8Array {
  return canonicalJsonBytes({
    schemaVersion: 1,
    reviews: request.reviewUnits.map((unit) => ({
      unitId: unit.unitId,
      reviewer: "execution publication catalog specification fixture",
      specRevision: request.specRevision,
      semanticDigest: unit.semanticDigest,
      dependencyDigests: unit.dependencyDigests,
      outcome: "accepted",
      resolvedDisagreementIds: [],
    })),
  });
}

async function buildCurrentParentTemplate(): Promise<Readonly<Record<string, Uint8Array>>> {
  const repositoryRoot = await createHistoricalReadinessAuthorityRepository(
    "blend65-execution-parent-template-",
  );
  try {
    await writeFile(
      join(repositoryRoot, "readiness/publications/current-publication.json"),
      canonicalJsonBytes({ schemaVersion: 1, publicationDigest: HISTORICAL_PARENT_DIGEST }),
    );
    const base = await resolvePublishedSnapshotByDigest({
      repositoryRoot,
      publicationDigest: HISTORICAL_PARENT_DIGEST,
    });
    if (!base.ok) throw new Error("expected the historical execution-spec parent to resolve");
    const review = await prepareIncrementalBindingPublicationReview({
      repositoryRoot,
      baseSnapshot: base.value,
      targetHandlerIds: CURRENT_ORACLE_HANDLER_IDS,
    });
    if (!review.ok) throw new Error("expected the current execution-spec review to prepare");
    const staged = await prepareIncrementalBindingPublication({
      repositoryRoot,
      baseSnapshot: base.value,
      targetHandlerIds: CURRENT_ORACLE_HANDLER_IDS,
      semanticReviewBytes: readinessReviewBytes(review.value.request),
    });
    if (!staged.ok) throw new Error("expected the current execution-spec parent to stage");
    const published = await publishIncrementalBindingPublication(staged.value.prepared);
    if (!published.ok || published.value.publicationDigest !== CURRENT_PARENT_DIGEST) {
      throw new Error(
        `expected current execution-spec parent ${CURRENT_PARENT_DIGEST}, received ${published.ok ? published.value.publicationDigest : "publication failure"}`,
      );
    }
    return await snapshotTree(
      join(repositoryRoot, "readiness/publications/releases", CURRENT_PARENT_DIGEST),
    );
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
}

async function currentParentTemplate(): Promise<Readonly<Record<string, Uint8Array>>> {
  currentParentTemplatePromise ??= buildCurrentParentTemplate();
  return currentParentTemplatePromise;
}

export async function createIsolatedRepository(): Promise<string> {
  const template = await currentParentTemplate();
  const repositoryRoot =
    await createHistoricalReadinessAuthorityRepository("blend65-execution-spec-");
  try {
    const releaseRoot = join(
      repositoryRoot,
      "readiness/publications/releases",
      CURRENT_PARENT_DIGEST,
    );
    for (const [path, bytes] of Object.entries(template)) {
      const outputPath = join(releaseRoot, path);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, bytes);
    }
    await writeFile(
      join(repositoryRoot, "readiness/publications/current-publication.json"),
      canonicalJsonBytes({ schemaVersion: 1, publicationDigest: CURRENT_PARENT_DIGEST }),
    );
    return repositoryRoot;
  } catch (error) {
    await rm(repositoryRoot, { recursive: true, force: true });
    throw error;
  }
}

export async function removeIsolatedRepository(repositoryRoot: string): Promise<void> {
  await rm(repositoryRoot, { recursive: true, force: true });
}

export function executionPublicationRoot(repositoryRoot: string): string {
  return join(repositoryRoot, "readiness", "execution-publications");
}

export function executionReleaseRoot(repositoryRoot: string, digest: string): string {
  return join(executionPublicationRoot(repositoryRoot), "releases", digest);
}

export async function readExecutionPointer(repositoryRoot: string): Promise<unknown> {
  return JSON.parse(
    await readFile(
      join(executionPublicationRoot(repositoryRoot), "current-execution-publication.json"),
      "utf8",
    ),
  );
}

async function walkFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(root, path)));
    } else if (entry.isFile()) {
      files.push(relative(root, path));
    }
  }
  return files.sort();
}

export async function snapshotTree(root: string): Promise<Readonly<Record<string, Uint8Array>>> {
  const snapshot: Record<string, Uint8Array> = {};
  for (const path of await walkFiles(root)) {
    snapshot[path] = new Uint8Array(await readFile(join(root, path)));
  }
  return snapshot;
}

export async function snapshotParentPublications(
  repositoryRoot: string,
): Promise<Readonly<Record<string, Uint8Array>>> {
  return snapshotTree(join(repositoryRoot, "readiness", "publications"));
}

export async function readParentProjectionFacts(
  repositoryRoot: string,
  digest = CURRENT_PARENT_DIGEST,
): Promise<{
  rules: readonly ParentModeledRuleFixtureV1[];
  capabilities: readonly {
    capabilityId: string;
    state: "unbound";
    blocker: "unbound-evidence-capability";
  }[];
}> {
  const publication = JSON.parse(
    await readFile(
      join(
        repositoryRoot,
        "readiness",
        "publications",
        "releases",
        digest,
        "compiler-readiness-v1.json",
      ),
      "utf8",
    ),
  ) as {
    rules: readonly {
      ruleId: string;
      applicability: string;
      evidenceObligations: readonly string[];
    }[];
    evidenceCapabilityDeclarations: readonly {
      id: string;
      binding: string;
    }[];
  };
  const rules = MODELED_RULE_BOUNDARIES.map(([ruleId, boundaryFamilyId]) => {
    const matches = publication.rules.filter((rule) => rule.ruleId === ruleId);
    if (matches.length !== 1) {
      throw new Error(`expected exactly one raw parent rule for ${ruleId}`);
    }
    const raw = matches[0];
    if (!ALLOWED_APPLICABILITY.has(raw.applicability as ParentRuleApplicability)) {
      throw new Error(`invalid applicability for ${ruleId}`);
    }
    if (
      !Array.isArray(raw.evidenceObligations) ||
      raw.evidenceObligations.length === 0 ||
      raw.evidenceObligations.some(
        (obligation) => typeof obligation !== "string" || obligation.length === 0,
      ) ||
      new Set(raw.evidenceObligations).size !== raw.evidenceObligations.length
    ) {
      throw new Error(`invalid evidence obligations for ${ruleId}`);
    }
    return {
      ruleId,
      applicability: raw.applicability as ParentRuleApplicability,
      evidenceObligations: [...raw.evidenceObligations].sort(),
      boundaryFamilyIds: [boundaryFamilyId] as const,
    };
  }).sort((left, right) => left.ruleId.localeCompare(right.ruleId));
  return {
    rules,
    capabilities: publication.evidenceCapabilityDeclarations.map((entry) => ({
      capabilityId: entry.id,
      state: "unbound" as const,
      blocker: "unbound-evidence-capability" as const,
    })),
  };
}

export async function writeCanonicalJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, canonicalJsonBytes(value));
}

export async function assertCompleteExpectedRelease(
  repositoryRoot: string,
  expected: ExpectedExecutionPublicationV1,
): Promise<Readonly<Record<string, Uint8Array>>> {
  const root = executionReleaseRoot(repositoryRoot, expected.digest);
  const actual = await snapshotTree(root);
  const expectedFiles: Record<string, Uint8Array> = {
    "execution-manifest-v1.json": expected.manifestBytes,
    ...expected.memberBytes,
  };
  return Object.fromEntries(Object.keys(expectedFiles).map((path) => [path, actual[path]]));
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
