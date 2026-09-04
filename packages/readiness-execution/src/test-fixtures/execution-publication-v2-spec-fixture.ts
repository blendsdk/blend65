import { createHash } from "node:crypto";
import { cp, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  prepareExecutionPublicationCandidateV1,
  resolvePublishedExecutionRelease,
  type PublishedExecutionRelease,
  type Sha256Digest,
} from "@blend65/readiness";

import { getExecutionCatalogFixtureDescriptorV1 } from "../execution-publication-catalog-conformance-v1.js";
import {
  EXECUTION_SPEC_REVISION,
  createCurrentReadinessAuthorityFixtureV1,
  encodeCanonicalJsonV1,
  resolveCatalogSpecRepositoryRootV1,
} from "./execution-publication-catalog-spec-fixture.js";

/** A copied historical pair that lets a specification exercise parent-first recovery safely. */
export interface ExistingExecutionPairFixtureV2 {
  readonly repositoryRoot: string;
  readonly parentDigest: Sha256Digest;
  readonly childDigest: string;
  createChild(parentDigest: Sha256Digest): Promise<{
    readonly childDigest: string;
    readonly release: PublishedExecutionRelease;
  }>;
  cleanup(): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256Digest(value: unknown): value is Sha256Digest {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
}

async function readSelectedDigest(path: string): Promise<Sha256Digest> {
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!isRecord(parsed) || !isSha256Digest(parsed.publicationDigest)) {
    throw new TypeError(`selected publication pointer has an invalid digest: ${path}`);
  }
  return parsed.publicationDigest;
}

function digest(label: string): Sha256Digest {
  return `sha256:${createHash("sha256").update(label).digest("hex")}`;
}

function createSemanticReviewBytes(parentDigest: Sha256Digest, bindingBytes: Uint8Array) {
  return encodeCanonicalJsonV1({
    schemaVersion: 1,
    kind: "execution-semantic-review-v1",
    specRevision: EXECUTION_SPEC_REVISION,
    parentDigest,
    bindingDigest: `sha256:${createHash("sha256").update(bindingBytes).digest("hex")}`,
    ciSafe: { digest: digest("v2-child-ci-safe"), outcome: "accepted" },
    coverage: { digest: digest("v2-child-coverage"), outcome: "accepted" },
    localAcmeVice: { digest: digest("v2-child-local-acme-vice"), outcome: "accepted" },
    unresolvedCritical: 0,
    unresolvedMajor: 0,
    reviewer: "parent-first recovery specification reviewer",
    outcome: "accepted",
  });
}

async function createChild(repositoryRoot: string, parentDigest: Sha256Digest) {
  const bindingBytes = new Uint8Array(getExecutionCatalogFixtureDescriptorV1().bindingBytes);
  const candidate = await prepareExecutionPublicationCandidateV1({
    repositoryRoot,
    parentDigest,
    bindingBytes,
    semanticReviewBytes: createSemanticReviewBytes(parentDigest, bindingBytes),
  });
  if (!candidate.ok) {
    throw new Error(candidate.issues.map((issue) => `${issue.code} at ${issue.path}`).join("; "));
  }
  const release = await resolvePublishedExecutionRelease(repositoryRoot, candidate.value.digest);
  if (!release.ok) {
    throw new Error(release.issues.map((issue) => `${issue.code} at ${issue.path}`).join("; "));
  }
  return { childDigest: candidate.value.digest, release: release.value };
}

/** Copies the selected immutable parent and child artifacts into a bounded isolated repository. */
export async function createExistingExecutionPairFixtureV2(): Promise<ExistingExecutionPairFixtureV2> {
  const authority = await createCurrentReadinessAuthorityFixtureV1();
  try {
    await cp(
      join(resolveCatalogSpecRepositoryRootV1(), "readiness", "execution-publications"),
      join(authority.repositoryRoot, "readiness", "execution-publications"),
      { recursive: true, force: false, errorOnExist: true, dereference: false },
    );
    const parentDigest = await readSelectedDigest(
      join(authority.repositoryRoot, "readiness", "publications", "current-publication.json"),
    );
    const childDigest = await readSelectedDigest(
      join(
        authority.repositoryRoot,
        "readiness",
        "execution-publications",
        "current-execution-publication.json",
      ),
    );
    return {
      repositoryRoot: authority.repositoryRoot,
      parentDigest,
      childDigest,
      createChild: (nextParentDigest) => createChild(authority.repositoryRoot, nextParentDigest),
      cleanup: authority.cleanup,
    };
  } catch (error) {
    await authority.cleanup();
    throw error;
  }
}
