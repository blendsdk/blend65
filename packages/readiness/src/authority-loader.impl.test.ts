import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadValidatedAuthority,
  parseSemanticReviewEvidence,
  type AuthorityPaths,
} from "./authority-loader.js";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "../../..");
const PATHS: AuthorityPaths = {
  inventory: "readiness/inventory/compiler-readiness-v1.json",
  identityLedger: "readiness/inventory/rule-identities-v1.jsonl",
  reviewEvidence: "readiness/reviews/compiler-readiness-v1-review.json",
};
const temporaryRoots: string[] = [];

function firstCode(result: Awaited<ReturnType<typeof loadValidatedAuthority>>): string | undefined {
  return result.ok ? undefined : result.diagnostics[0]?.code;
}

async function root(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true })));
});

async function minimalAuthority(): Promise<string> {
  const path = await root("blend65-authority-");
  await mkdir(join(path, "readiness/inventory"), { recursive: true });
  await mkdir(join(path, "readiness/reviews"), { recursive: true });
  await mkdir(join(path, "spec"));
  await writeFile(join(path, PATHS.inventory), "{}");
  await writeFile(join(path, PATHS.identityLedger), "");
  await writeFile(join(path, PATHS.reviewEvidence), "{}");
  return path;
}

describe("authority loading internals", () => {
  it("should reject malformed review envelopes and records through the closed parser", () => {
    const encode = (value: unknown): Uint8Array =>
      new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));
    const record = {
      unitId: "chapter-00",
      reviewer: "reviewer",
      specRevision: "revision",
      semanticDigest: "digest",
      dependencyDigests: { dependency: "digest" },
      outcome: "accepted",
      resolvedDisagreementIds: [],
    };
    const invalidValues: readonly unknown[] = [
      "{",
      null,
      { schemaVersion: 1, reviews: [], extra: true },
      { schemaVersion: 2, reviews: [] },
      { schemaVersion: 1, reviews: "not-an-array" },
      { schemaVersion: 1, reviews: [null] },
      { schemaVersion: 1, reviews: [{ ...record, extra: true }] },
      { schemaVersion: 1, reviews: [{ ...record, unitId: 1 }] },
      { schemaVersion: 1, reviews: [{ ...record, reviewer: 1 }] },
      { schemaVersion: 1, reviews: [{ ...record, specRevision: 1 }] },
      { schemaVersion: 1, reviews: [{ ...record, semanticDigest: 1 }] },
      { schemaVersion: 1, reviews: [{ ...record, dependencyDigests: [] }] },
      {
        schemaVersion: 1,
        reviews: [{ ...record, dependencyDigests: { dependency: 1 } }],
      },
      { schemaVersion: 1, reviews: [{ ...record, outcome: "pending" }] },
      { schemaVersion: 1, reviews: [{ ...record, resolvedDisagreementIds: "none" }] },
      { schemaVersion: 1, reviews: [{ ...record, resolvedDisagreementIds: [1] }] },
    ];
    for (const value of invalidValues) {
      expect(parseSemanticReviewEvidence(encode(value)), JSON.stringify(value)).toBeUndefined();
    }
    expect(
      parseSemanticReviewEvidence(
        encode({ schemaVersion: 1, reviews: [{ ...record, outcome: "blocked" }] }),
      ),
    ).toHaveLength(1);
  });

  it("should cache a complete dependency-identical validation failure", async () => {
    const path = await minimalAuthority();
    const first = await loadValidatedAuthority(path, PATHS);
    const second = await loadValidatedAuthority(path, PATHS);
    expect(first).toBe(second);
    expect(first.ok).toBe(false);
  });

  it("should reject an authority tree containing an unsupported filesystem entry", async () => {
    const path = await minimalAuthority();
    await symlink(join(path, PATHS.inventory), join(path, "spec/inventory-link"));
    const result = await loadValidatedAuthority(path, PATHS);
    expect(result.ok).toBe(false);
    expect(firstCode(result)).toBe("version.unsupported");
  });

  it("should diagnose malformed review evidence after semantic authority validates", async () => {
    const path = await root("blend65-review-shape-");
    await cp(join(REPOSITORY_ROOT, "spec"), join(path, "spec"), { recursive: true });
    await cp(join(REPOSITORY_ROOT, "readiness/inventory"), join(path, "readiness/inventory"), {
      recursive: true,
    });
    await mkdir(join(path, "readiness/reviews"), { recursive: true });
    await writeFile(
      join(path, PATHS.reviewEvidence),
      JSON.stringify({ schemaVersion: 1, reviews: [{ unexpected: true }] }),
    );
    const result = await loadValidatedAuthority(path, PATHS);
    expect(result.ok).toBe(false);
    expect(firstCode(result)).toBe("review-evidence.invalid-shape");
  });

  it("should diagnose a fingerprint read failure without entering validation", async () => {
    const path = await root("blend65-missing-authority-");
    const result = await loadValidatedAuthority(path, PATHS);
    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.diagnostics[0]?.message).toContain("fingerprinted");
  });

  it("should reject symlinked fixed authority inputs", async () => {
    const path = await minimalAuthority();
    const outside = join(path, "outside.json");
    await writeFile(outside, "{}");
    await rm(join(path, PATHS.inventory));
    await symlink(outside, join(path, PATHS.inventory));
    const result = await loadValidatedAuthority(path, PATHS);
    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.diagnostics[0]?.message).toContain("fingerprinted");
  });

  it("should reject authority that changes during both bounded validation attempts", async () => {
    const path = await minimalAuthority();
    await writeFile(join(path, PATHS.inventory), '{"test":"mutation"}');
    let revision = 0;
    const result = await loadValidatedAuthority(path, PATHS, {
      async afterValidation() {
        revision += 1;
        await writeFile(join(path, PATHS.inventory), `{"revision":${revision}}`);
      },
    });
    expect(result.ok).toBe(false);
    expect(firstCode(result)).toBe("review-evidence.authority-changed");
    expect(revision).toBe(2);
  });

  it("should reject a non-canonical configured authority path", async () => {
    const path = await minimalAuthority();
    const result = await loadValidatedAuthority(path, {
      ...PATHS,
      inventory: "../outside.json",
    });
    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.diagnostics[0]?.message).toContain("fingerprinted");
  });
});
