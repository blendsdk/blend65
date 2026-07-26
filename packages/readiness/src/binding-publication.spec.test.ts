import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { restoreUnboundPublicationAuthority } from "./test-fixtures/unbound-publication-authority.js";

type Digest = `sha256:${string}`;
type HandlerKind = "generator" | "transform";
type FaultPoint =
  | "after-member-sync"
  | "after-staging-directory-sync"
  | "after-release-rename"
  | "after-releases-directory-sync"
  | "before-staged-validation"
  | "after-staged-validation"
  | "after-pointer-temporary-sync"
  | "after-pointer-rename"
  | "after-publication-root-sync";

interface FreshRegistration {
  readonly binding: {
    readonly handlerId: string;
    readonly kind: HandlerKind;
    readonly contractVersion: "1.0.0";
    readonly implementationRevision: Digest;
    readonly implementation: (...args: readonly never[]) => unknown;
  };
}

interface ReviewUnit {
  readonly unitId: string;
  readonly semanticDigest: Digest;
  readonly dependencyDigests: Readonly<Record<string, Digest>>;
}

interface ReviewRequest {
  readonly schemaVersion: 1;
  readonly semanticDigest: Digest;
  readonly specRevision: string;
  readonly dependencyDigests: {
    readonly bindings: Digest;
    readonly inventory: Digest;
    readonly "rule-model": Digest;
    readonly "rule-model-review": Digest;
  };
  readonly promotedHandlerIds: readonly string[];
  readonly reviewUnits: readonly ReviewUnit[];
}

type PublicationResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly kind: string;
      readonly diagnostics: readonly {
        readonly code: string;
        readonly path: string;
        readonly message: string;
      }[];
    };

interface PlannedApi {
  readonly PUBLICATION_V1_LIMITS: {
    readonly maxPointerBytes: 256;
    readonly maxManifestBytes: 16_384;
    readonly maxBindingBytes: 1_048_576;
    readonly maxSemanticReviewBytes: 1_048_576;
    readonly maxMembers: 7;
    readonly maxMemberBytes: 16_777_216;
    readonly maxTotalReleaseBytes: 67_108_864;
    readonly maxBindings: 4_096;
    readonly maxJsonDepth: 16;
    readonly maxJsonValues: 65_536;
    readonly maxStringBytes: 65_536;
  };
  readonly prepareBindingPublicationReview: (input: { readonly repositoryRoot: string }) => Promise<
    PublicationResult<{
      readonly review: object;
      readonly request: ReviewRequest;
      readonly requestBytes: Uint8Array;
    }>
  >;
  readonly publishBindingTransaction: (input: {
    readonly repositoryRoot: string;
    readonly semanticReviewBytes: Uint8Array;
  }) => Promise<
    PublicationResult<{
      readonly publicationDigest: Digest;
      readonly snapshot: object;
      readonly reusedExistingRelease: boolean;
    }>
  >;
  readonly resolvePublishedSnapshot: (input: {
    readonly repositoryRoot: string;
  }) => Promise<PublicationResult<object>>;
  readonly getPublishedBinding: (
    snapshot: object,
    handlerId: string,
  ) => FreshRegistration["binding"] | undefined;
  readonly getPublishedInventory: (snapshot: object) =>
    | {
        readonly handlerDeclarations: readonly {
          readonly id: string;
          readonly binding: "bound" | "unbound";
        }[];
        readonly evidenceCapabilityDeclarations: readonly {
          readonly id: string;
          readonly binding: "bound" | "unbound";
        }[];
      }
    | undefined;
  readonly getPublishedMetadata: (snapshot: object) =>
    | {
        readonly publicationDigest: Digest;
        readonly inventoryGenerationDigest: Digest;
      }
    | undefined;
  readonly runReadinessCommand: (
    command: "source-check" | "generate" | "check" | "publish",
    repositoryRoot: string,
  ) => Promise<{ readonly ok: boolean; readonly diagnostics: readonly unknown[] }>;
}

interface ConformanceApi {
  readonly runWithPublicationConformance: <T>(
    hooks: {
      readonly atFaultPoint?: (
        point: FaultPoint,
        context: {
          readonly publicationDigest?: Digest;
          readonly memberPath?: string;
        },
      ) => void | Promise<void>;
      readonly digest?: (domain: string, bytes: Uint8Array) => Digest;
      readonly forceDurabilityUnsupported?: boolean;
      readonly forceStagedValidationFailure?: boolean;
    },
    operation: () => Promise<T>,
  ) => Promise<T>;
  readonly inspectPublicationLimitsForTest: (input: {
    readonly pointerBytes: number;
    readonly manifestBytes: number;
    readonly bindingBytes: number;
    readonly semanticReviewBytes: number;
    readonly memberCount: number;
    readonly memberBytes: number;
    readonly totalReleaseBytes: number;
  }) => PublicationResult<true>;
}

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CHILD_PATH = resolve(
  REPOSITORY_ROOT,
  "packages/readiness/dist/test-fixtures/publication-spec-child.js",
);
const CLI_PATH = resolve(REPOSITORY_ROOT, "packages/readiness/dist/cli.js");
const encoder = new TextEncoder();
const temporaryRoots: string[] = [];
const REQUIRED_EXPORTS = [
  "PUBLICATION_V1_LIMITS",
  "prepareBindingPublicationReview",
  "publishBindingTransaction",
  "resolvePublishedSnapshot",
  "getPublishedBinding",
  "getPublishedInventory",
  "getPublishedMetadata",
] as const;
const BOUND_HANDLER_IDS = [
  "generator.compiler-cases",
  "generator.frontend-cases",
  "generator.runtime-cases",
  "transform.boundary-variants",
] as const;
const UNBOUND_HANDLER_IDS = [
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
] as const;
const MEMBER_PATHS = [
  "bindings-v1.json",
  "compiler-readiness-v1.json",
  "compiler-readiness.md",
  "declarations.ts",
  "rule-models-v1-review.json",
  "rule-models-v1.json",
  "semantic-review-v1.json",
] as const;

function requireSuccess<T>(result: PublicationResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new TypeError(
      `expected publication success: ${result.diagnostics
        .map(({ code, path }) => `${code}@${path}`)
        .join(",")}`,
    );
  }
  return result.value;
}

function isPlannedApi(value: object): value is PlannedApi {
  return (
    "PUBLICATION_V1_LIMITS" in value &&
    REQUIRED_EXPORTS.slice(1).every(
      (name) => name in value && typeof Reflect.get(value, name) === "function",
    )
  );
}

async function plannedApi(): Promise<PlannedApi> {
  const module = await import("./index.js");
  for (const name of REQUIRED_EXPORTS) {
    expect(module).toHaveProperty(name);
  }
  if (!isPlannedApi(module)) {
    throw new TypeError("The binding publication API has an invalid runtime shape.");
  }
  return module;
}

async function conformanceApi(): Promise<ConformanceApi> {
  return vi.importActual<ConformanceApi>("./publication-conformance-v1.js");
}

function reviewBytes(request: ReviewRequest, reviewer = "phase7-spec-reviewer"): Uint8Array {
  const reviews = request.reviewUnits.map((unit) => ({
    unitId: unit.unitId,
    reviewer,
    specRevision: request.specRevision,
    semanticDigest: unit.semanticDigest,
    dependencyDigests: unit.dependencyDigests,
    outcome: "accepted",
    resolvedDisagreementIds: [],
  }));
  return encoder.encode(`${JSON.stringify({ schemaVersion: 1, reviews })}\n`);
}

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-publication-spec-"));
  temporaryRoots.push(root);
  await cp(join(REPOSITORY_ROOT, "readiness"), join(root, "readiness"), { recursive: true });
  await cp(join(REPOSITORY_ROOT, "spec"), join(root, "spec"), { recursive: true });
  await cp(join(REPOSITORY_ROOT, "packages/readiness/src"), join(root, "packages/readiness/src"), {
    recursive: true,
  });
  await restoreUnboundPublicationAuthority(REPOSITORY_ROOT, root);
  return root;
}

async function publish(api: PlannedApi, root: string, reviewer = "phase7-spec-reviewer") {
  const prepared = requireSuccess(
    await api.prepareBindingPublicationReview({
      repositoryRoot: root,
    }),
  );
  expect(JSON.parse(new TextDecoder().decode(prepared.requestBytes))).toEqual(prepared.request);
  return {
    prepared,
    published: await api.publishBindingTransaction({
      repositoryRoot: root,
      semanticReviewBytes: reviewBytes(prepared.request, reviewer),
    }),
  };
}

interface ChildResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runNodeProcess(
  arguments_: readonly string[],
  cwd: string,
  stdin = "",
): Promise<ChildResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, arguments_, {
      cwd,
      env: { PATH: process.env.PATH, NODE_NO_WARNINGS: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    child.stdin.end(stdin);
  });
}

function childPublication(root: string, crashAt: FaultPoint | null): Promise<ChildResult> {
  return runNodeProcess(
    [CHILD_PATH],
    root,
    `${JSON.stringify({ schemaVersion: 1, repositoryRoot: root, crashAt })}\n`,
  );
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("atomic binding publication", () => {
  it("selects one complete digest-verified release with one pointer commit", async () => {
    const api = await plannedApi();
    const root = await fixtureRoot();
    const { prepared, published } = await publish(api, root);
    const result = requireSuccess(published);

    expect(prepared.request.promotedHandlerIds).toEqual(BOUND_HANDLER_IDS);
    expect(Object.keys(result.snapshot)).toEqual([]);
    expect(result.reusedExistingRelease).toBe(false);
    const pointer = JSON.parse(
      await readFile(join(root, "readiness/publications/current-publication.json"), "utf8"),
    );
    expect(pointer).toEqual({
      schemaVersion: 1,
      publicationDigest: result.publicationDigest,
    });
    const release = join(root, "readiness/publications/releases", result.publicationDigest);
    const manifest = JSON.parse(await readFile(join(release, "manifest.json"), "utf8"));
    expect(manifest.members.map(({ path }: { readonly path: string }) => path)).toEqual(
      MEMBER_PATHS,
    );
    expect(api.getPublishedMetadata(result.snapshot)?.publicationDigest).toBe(
      result.publicationDigest,
    );
  });

  it("publishes exactly the four RD-02 handlers through an unforgeable snapshot", async () => {
    const api = await plannedApi();
    const root = await fixtureRoot();
    const result = requireSuccess((await publish(api, root)).published);
    const inventory = api.getPublishedInventory(result.snapshot);
    expect(inventory).toBeDefined();
    expect(
      inventory?.handlerDeclarations
        .filter(({ binding }) => binding === "bound")
        .map(({ id }) => id),
    ).toEqual(BOUND_HANDLER_IDS);
    expect(
      inventory?.handlerDeclarations
        .filter(({ binding }) => binding === "unbound")
        .map(({ id }) => id),
    ).toEqual(UNBOUND_HANDLER_IDS);
    expect(
      inventory?.evidenceCapabilityDeclarations.every(({ binding }) => binding === "unbound"),
    ).toBe(true);
    for (const handlerId of BOUND_HANDLER_IDS) {
      expect(api.getPublishedBinding(result.snapshot, handlerId)).toMatchObject({
        handlerId,
        implementationRevision: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      });
    }
    expect(api.getPublishedBinding({}, BOUND_HANDLER_IDS[0])).toBeUndefined();
    expect(api.getPublishedInventory({})).toBeUndefined();
    expect(api.getPublishedMetadata({})).toBeUndefined();
  });

  it("reuses byte-identical releases and rejects an injected unequal-preimage collision", async () => {
    const api = await plannedApi();
    const conformance = await conformanceApi();
    const root = await fixtureRoot();
    const first = requireSuccess((await publish(api, root)).published);
    const second = requireSuccess((await publish(api, root)).published);
    expect(second.publicationDigest).toBe(first.publicationDigest);
    expect(second.reusedExistingRelease).toBe(true);

    const fixed = `sha256:${"f".repeat(64)}` as Digest;
    const injectedFirst = await conformance.runWithPublicationConformance(
      { digest: () => fixed },
      async () => (await publish(api, root, "collision-reviewer-a")).published,
    );
    expect(injectedFirst).toMatchObject({ ok: true });
    const collision = await conformance.runWithPublicationConformance(
      { digest: () => fixed },
      async () => (await publish(api, root, "collision-reviewer-b")).published,
    );
    expect(collision).toMatchObject({
      ok: false,
      kind: "collision",
      diagnostics: [{ code: "publication.collision" }],
    });
    const selected = requireSuccess(
      await conformance.runWithPublicationConformance({ digest: () => fixed }, () =>
        api.resolvePublishedSnapshot({ repositoryRoot: root }),
      ),
    );
    expect(api.getPublishedMetadata(selected)?.publicationDigest).toBe(fixed);
  });

  it("enforces every publication size limit at the exact boundary", async () => {
    const api = await plannedApi();
    const conformance = await conformanceApi();
    expect(api.PUBLICATION_V1_LIMITS).toEqual({
      maxPointerBytes: 256,
      maxManifestBytes: 16_384,
      maxBindingBytes: 1_048_576,
      maxSemanticReviewBytes: 1_048_576,
      maxMembers: 7,
      maxMemberBytes: 16_777_216,
      maxTotalReleaseBytes: 67_108_864,
      maxBindings: 4_096,
      maxJsonDepth: 16,
      maxJsonValues: 65_536,
      maxStringBytes: 65_536,
    });
    const exact = {
      pointerBytes: 256,
      manifestBytes: 16_384,
      bindingBytes: 1_048_576,
      semanticReviewBytes: 1_048_576,
      memberCount: 7,
      memberBytes: 16_777_216,
      totalReleaseBytes: 67_108_864,
    };
    expect(conformance.inspectPublicationLimitsForTest(exact)).toEqual({
      ok: true,
      value: true,
      diagnostics: [],
    });
    for (const key of Object.keys(exact) as (keyof typeof exact)[]) {
      const result = conformance.inspectPublicationLimitsForTest({
        ...exact,
        [key]: exact[key] + 1,
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [{ code: "publication.input.limit" }],
      });
    }
  });

  it("blocks invalid review and staged invariant failure before selection", async () => {
    const api = await plannedApi();
    const conformance = await conformanceApi();
    const root = await fixtureRoot();
    const prepared = requireSuccess(
      await api.prepareBindingPublicationReview({
        repositoryRoot: root,
      }),
    );
    const pointerPath = join(root, "readiness/publications/current-publication.json");
    for (const bytes of [
      encoder.encode('{"schemaVersion":1,"reviews":[]}\n'),
      reviewBytes({
        ...prepared.request,
        reviewUnits: prepared.request.reviewUnits.map((unit, index) =>
          index === 0 ? { ...unit, semanticDigest: `sha256:${"0".repeat(64)}` as Digest } : unit,
        ),
      }),
      encoder.encode(
        new TextDecoder()
          .decode(reviewBytes(prepared.request))
          .replace('"outcome":"accepted"', '"outcome":"blocked"'),
      ),
    ]) {
      const result = await api.publishBindingTransaction({
        repositoryRoot: root,
        semanticReviewBytes: bytes,
      });
      expect(result.ok).toBe(false);
      await expect(readFile(pointerPath)).rejects.toMatchObject({ code: "ENOENT" });
    }
    const acceptance = await conformance.runWithPublicationConformance(
      { forceStagedValidationFailure: true },
      () =>
        api.publishBindingTransaction({
          repositoryRoot: root,
          semanticReviewBytes: reviewBytes(prepared.request),
        }),
    );
    expect(acceptance).toMatchObject({
      ok: false,
      kind: "acceptance-failed",
      diagnostics: [{ code: "publication.acceptance.failed" }],
    });
    await expect(readFile(pointerPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("fails closed when durable directory synchronization is unavailable", async () => {
    const api = await plannedApi();
    const conformance = await conformanceApi();
    const root = await fixtureRoot();
    const prepared = requireSuccess(
      await api.prepareBindingPublicationReview({
        repositoryRoot: root,
      }),
    );
    const result = await conformance.runWithPublicationConformance(
      { forceDurabilityUnsupported: true },
      () =>
        api.publishBindingTransaction({
          repositoryRoot: root,
          semanticReviewBytes: reviewBytes(prepared.request),
        }),
    );
    expect(result).toMatchObject({
      ok: false,
      kind: "durability-unsupported",
      diagnostics: [{ code: "publication.durability-unsupported" }],
    });
  });

  it("rejects selected pointer symlinks, traversal and malformed member digests", async () => {
    const api = await plannedApi();
    const root = await fixtureRoot();
    const result = requireSuccess((await publish(api, root)).published);
    const pointerPath = join(root, "readiness/publications/current-publication.json");
    const original = await readFile(pointerPath);
    await rm(pointerPath);
    await writeFile(join(root, "outside-pointer.json"), original);
    await import("node:fs/promises").then(({ symlink }) =>
      symlink(join(root, "outside-pointer.json"), pointerPath),
    );
    expect(await api.resolvePublishedSnapshot({ repositoryRoot: root })).toMatchObject({
      ok: false,
      diagnostics: [{ code: "publication.path.invalid" }],
    });
    await rm(pointerPath);
    await writeFile(
      pointerPath,
      `{"schemaVersion":1,"publicationDigest":"../${result.publicationDigest}"}\n`,
    );
    expect(await api.resolvePublishedSnapshot({ repositoryRoot: root })).toMatchObject({
      ok: false,
    });
    await writeFile(pointerPath, original);
    const release = join(root, "readiness/publications/releases", result.publicationDigest);
    const manifestPath = join(release, "manifest.json");
    const manifest = await readFile(manifestPath, "utf8");
    await writeFile(
      manifestPath,
      manifest.replace(/sha256:[0-9a-f]{64}/u, `sha256:${"0".repeat(64)}`),
    );
    expect(await api.resolvePublishedSnapshot({ repositoryRoot: root })).toMatchObject({
      ok: false,
      diagnostics: [{ code: "publication.digest.mismatch" }],
    });
  });

  it("leaves no selected snapshot when a fresh process crashes before pointer replacement", async () => {
    const api = await plannedApi();
    for (const faultPoint of [
      "after-member-sync",
      "after-staging-directory-sync",
      "after-release-rename",
      "after-releases-directory-sync",
      "before-staged-validation",
      "after-staged-validation",
      "after-pointer-temporary-sync",
    ] as const) {
      const root = await fixtureRoot();
      const result = await childPublication(root, faultPoint);
      expect(result).toEqual({ code: 91, stdout: "", stderr: "" });
      expect(
        await api.resolvePublishedSnapshot({
          repositoryRoot: root,
        }),
      ).toMatchObject({ ok: false });
    }
  });

  it("resolves a complete snapshot after a fresh process crashes after pointer replacement", async () => {
    const api = await plannedApi();
    for (const faultPoint of ["after-pointer-rename", "after-publication-root-sync"] as const) {
      const root = await fixtureRoot();
      const result = await childPublication(root, faultPoint);
      expect(result).toEqual({ code: 91, stdout: "", stderr: "" });
      const resolved = requireSuccess(
        await api.resolvePublishedSnapshot({
          repositoryRoot: root,
        }),
      );
      expect(api.getPublishedMetadata(resolved)?.publicationDigest).toMatch(
        /^sha256:[0-9a-f]{64}$/u,
      );
    }
  });

  it("keeps source authoring commands non-authoritative and check publication-only", async () => {
    const api = await plannedApi();
    const root = await fixtureRoot();
    expect(await api.runReadinessCommand("check", root)).toMatchObject({ ok: false });
    const source = await api.runReadinessCommand("source-check", root);
    expect(source).not.toHaveProperty("snapshot");
    const generated = await api.runReadinessCommand("generate", root);
    expect(generated).not.toHaveProperty("snapshot");
    const packageJson = JSON.parse(await readFile(join(REPOSITORY_ROOT, "package.json"), "utf8"));
    expect(packageJson.scripts).toHaveProperty("readiness:source-check");
    expect(packageJson.scripts).toHaveProperty("readiness:publish");
  });

  it("uses the closed four-command CLI protocol and rejects extra arguments", async () => {
    const root = await fixtureRoot();
    expect(await runNodeProcess([CLI_PATH, "invalid"], root)).toEqual({
      code: 2,
      stdout: "",
      stderr: "Usage: cli.js <source-check|generate|check|publish>\n",
    });
    expect(await runNodeProcess([CLI_PATH, "check", "extra"], root)).toEqual({
      code: 2,
      stdout: "",
      stderr: "Usage: cli.js <source-check|generate|check|publish>\n",
    });
    expect(await runNodeProcess([CLI_PATH, "source-check"], root)).toEqual({
      code: 0,
      stdout: "",
      stderr: "",
    });
  });

  it("allows publication filesystem access only in the three resolver modules", async () => {
    const boundary = await vi.importActual<{
      validatePublicationModuleBoundary: (
        files: readonly { readonly path: string; readonly source: string }[],
      ) => { readonly ok: boolean; readonly diagnostics: readonly unknown[] };
    }>("./publication-conformance-v1.js");
    expect(
      boundary.validatePublicationModuleBoundary([
        {
          path: "consumer.ts",
          source:
            'import { readFile } from "node:fs/promises"; readFile("readiness/publications/current-publication.json");',
        },
      ]),
    ).toMatchObject({ ok: false });
    for (const path of [
      "publication-resolver.ts",
      "binding-publication.ts",
      "publication-pointer.ts",
    ]) {
      expect(
        boundary.validatePublicationModuleBoundary([
          {
            path,
            source:
              'import { readFile } from "node:fs/promises"; readFile("readiness/publications/current-publication.json");',
          },
        ]),
      ).toMatchObject({ ok: true, diagnostics: [] });
    }
  });
});
