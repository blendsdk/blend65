import { rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Worker } from "node:worker_threads";

import { describe, expect, it } from "vitest";

import {
  prepareIncrementalBindingPublication,
  prepareIncrementalBindingPublicationReview,
  publishIncrementalBindingPublication,
} from "./binding-publication.js";
import {
  runWithPublicationConformance,
  type PublicationConformanceHooks,
} from "./publication-conformance-v1.js";
import {
  getPublishedBindingRows,
  getPublishedMetadata,
  resolvePublishedSnapshot,
  resolvePublishedSnapshotByDigest,
} from "./publication-resolver.js";
import {
  createAcceptedReviewBytes,
  createOraclePublicationSpecFixture,
} from "./test-fixtures/oracle-publication-spec-fixture.js";

const TARGET_HANDLER_IDS = [
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.semantic-relations",
] as const;

const PRE_POINTER_FAULT_POINTS = [
  "after-member-sync",
  "after-staging-directory-sync",
  "before-release-rename",
  "after-release-rename",
  "after-releases-directory-sync",
  "before-staged-validation",
  "after-staged-validation",
  "after-pointer-temporary-sync",
] as const;

const AT_OR_POST_POINTER_FAULT_POINTS = [
  "after-pointer-rename",
  "after-publication-root-sync",
] as const;

type Sha256Digest = `sha256:${string}`;
type ResolutionObservation =
  | {
      readonly operation: "selected-resolution";
      readonly attempt: 1 | 2;
      readonly event: "start" | "success" | "failure";
    }
  | {
      readonly operation: "selected-resolution";
      readonly attempt: 1;
      readonly event: "retry";
      readonly reason: "verified-pointer-replacement";
    };
type OrdinaryFailureKind =
  | "invalid"
  | "not-found"
  | "stale"
  | "collision"
  | "contended"
  | "durability-unsupported"
  | "acceptance-failed"
  | "io";
type PublicationDiagnostic = {
  readonly code: string;
  readonly path: string;
  readonly message: string;
};
type FinalPublicationResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly kind: OrdinaryFailureKind;
      readonly diagnostics: readonly PublicationDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly kind: "commit-indeterminate";
      readonly expectedOldPublicationDigest: Sha256Digest;
      readonly expectedNewPublicationDigest: Sha256Digest;
      readonly diagnostics: readonly [
        {
          readonly code: "publication.commit.indeterminate";
          readonly path: "readiness/publications/current-publication.json";
          readonly message: string;
        },
      ];
    };

interface ReaderWorkerInput {
  readonly schemaVersion: 1;
  readonly repositoryRoot: string;
  readonly pauseAfterPointerReadAttempts: readonly (1 | 2)[];
}

type ReaderResult =
  | {
      readonly ok: true;
      readonly publicationDigest: Sha256Digest;
      readonly inventoryGenerationDigest: Sha256Digest;
      readonly bindingRows: readonly Readonly<Record<string, unknown>>[];
      readonly handlerDeclarations: readonly Readonly<Record<string, unknown>>[];
    }
  | {
      readonly ok: false;
      readonly kind: OrdinaryFailureKind;
      readonly diagnostics: readonly PublicationDiagnostic[];
    };

type ReaderMessage =
  | { readonly schemaVersion: 1; readonly kind: "ready" }
  | {
      readonly schemaVersion: 1;
      readonly kind: "barrier";
      readonly barrier: "pointer-read";
      readonly attempt: 1 | 2;
    }
  | {
      readonly schemaVersion: 1;
      readonly kind: "result";
      readonly attempts: readonly ResolutionObservation[];
      readonly result: ReaderResult;
    };

const publishFinal = publishIncrementalBindingPublication as unknown as (
  prepared: unknown,
) => Promise<FinalPublicationResult<unknown>>;
const runFinalConformance = runWithPublicationConformance as unknown as <T>(
  hooks: PublicationConformanceHooks & {
    readonly atResolutionObservation?: (observation: ResolutionObservation) => void | Promise<void>;
  },
  operation: () => Promise<T>,
) => Promise<T>;

async function prepareFreshPromotion() {
  const fixture = await createOraclePublicationSpecFixture();
  const base = await resolvePublishedSnapshotByDigest({
    repositoryRoot: fixture.repositoryRoot,
    publicationDigest: fixture.publicationDigest,
  });
  if (!base.ok) {
    await fixture.cleanup();
    throw new Error(`Unable to resolve fixture base: ${JSON.stringify(base)}`);
  }

  const review = await prepareIncrementalBindingPublicationReview({
    repositoryRoot: fixture.repositoryRoot,
    baseSnapshot: base.value,
    targetHandlerIds: TARGET_HANDLER_IDS,
  });
  if (!review.ok) {
    await fixture.cleanup();
    throw new Error(`Unable to prepare review: ${JSON.stringify(review)}`);
  }

  const prepared = await prepareIncrementalBindingPublication({
    repositoryRoot: fixture.repositoryRoot,
    baseSnapshot: base.value,
    targetHandlerIds: TARGET_HANDLER_IDS,
    semanticReviewBytes: createAcceptedReviewBytes(review.value.request),
  });
  if (!prepared.ok) {
    await fixture.cleanup();
    throw new Error(`Unable to prepare promotion: ${JSON.stringify(prepared)}`);
  }

  return {
    fixture,
    prepared: prepared.value.prepared,
    newPublicationDigest: prepared.value.publicationDigest,
  };
}

async function resolveSelectedState(repositoryRoot: string) {
  const selected = await resolvePublishedSnapshot({ repositoryRoot });
  expect(selected.ok).toBe(true);
  if (!selected.ok) {
    throw new Error(`Selected publication did not resolve: ${JSON.stringify(selected)}`);
  }

  const metadata = getPublishedMetadata(selected.value);
  const rows = getPublishedBindingRows(selected.value);
  expect(metadata).toBeDefined();
  expect(rows).toBeDefined();
  if (metadata === undefined || rows === undefined) {
    throw new Error("Selected publication metadata was unavailable.");
  }

  return { metadata, rows };
}

class ReaderHarness {
  readonly worker: Worker;
  readonly #messages: ReaderMessage[] = [];
  readonly #waiters: Array<{
    readonly resolve: (message: ReaderMessage) => void;
    readonly reject: (error: Error) => void;
  }> = [];
  #failure: Error | undefined;

  constructor(input: ReaderWorkerInput) {
    this.worker = new Worker(
      new URL("../dist/test-fixtures/final-publication-reader-spec-fixture.js", import.meta.url),
      { workerData: input },
    );
    this.worker.on("message", (message: ReaderMessage) => {
      const waiter = this.#waiters.shift();
      if (waiter === undefined) {
        this.#messages.push(message);
      } else {
        waiter.resolve(message);
      }
    });
    this.worker.on("error", (error) => {
      this.#failure = error;
      for (const waiter of this.#waiters.splice(0)) {
        waiter.reject(error);
      }
    });
  }

  nextMessage(): Promise<ReaderMessage> {
    if (this.#failure !== undefined) {
      return Promise.reject(this.#failure);
    }
    const message = this.#messages.shift();
    if (message !== undefined) {
      return Promise.resolve(message);
    }
    return new Promise((complete, reject) => {
      this.#waiters.push({ resolve: complete, reject });
    });
  }

  continue(attempt: 1 | 2): void {
    this.worker.postMessage({
      schemaVersion: 1,
      kind: "continue",
      barrier: "pointer-read",
      attempt,
    });
  }

  async terminate(): Promise<void> {
    await this.worker.terminate();
  }
}

function expectReady(message: ReaderMessage): void {
  expect(message).toEqual({ schemaVersion: 1, kind: "ready" });
}

function expectBarrier(message: ReaderMessage, attempt: 1 | 2): void {
  expect(message).toEqual({
    schemaVersion: 1,
    kind: "barrier",
    barrier: "pointer-read",
    attempt,
  });
}

async function runReader(
  repositoryRoot: string,
): Promise<Extract<ReaderMessage, { readonly kind: "result" }>> {
  const harness = new ReaderHarness({
    schemaVersion: 1,
    repositoryRoot,
    pauseAfterPointerReadAttempts: [],
  });
  try {
    expectReady(await harness.nextMessage());
    const message = await harness.nextMessage();
    expect(message.kind).toBe("result");
    if (message.kind !== "result") {
      throw new Error("Reader did not return its result.");
    }
    return message;
  } finally {
    await harness.terminate();
  }
}

describe.each(PRE_POINTER_FAULT_POINTS)(
  "incremental publication before pointer replacement",
  (faultPoint) => {
    it(`leaves the exact old publication selected after ${faultPoint}`, async () => {
      const promotion = await prepareFreshPromotion();
      try {
        const result = await runFinalConformance(
          {
            atFaultPoint(point): void {
              if (point === faultPoint) {
                throw new Error(`Injected fault at ${faultPoint}.`);
              }
            },
          },
          () => publishFinal(promotion.prepared),
        );

        expect(result.ok).toBe(false);
        if (result.ok) {
          throw new Error("Pre-pointer fault unexpectedly committed.");
        }
        expect(result.kind).not.toBe("commit-indeterminate");

        const selected = await resolveSelectedState(promotion.fixture.repositoryRoot);
        expect(selected.metadata.publicationDigest).toBe(promotion.fixture.publicationDigest);
        expect(selected.rows).toHaveLength(4);
      } finally {
        await promotion.fixture.cleanup();
      }
    });
  },
);

describe.each(AT_OR_POST_POINTER_FAULT_POINTS)(
  "incremental publication at or after pointer replacement",
  (faultPoint) => {
    it(`reconciles ${faultPoint} to the exact committed publication`, async () => {
      const promotion = await prepareFreshPromotion();
      try {
        const result = await runFinalConformance(
          {
            atFaultPoint(point): void {
              if (point === faultPoint) {
                throw new Error(`Injected fault at ${faultPoint}.`);
              }
            },
          },
          () => publishFinal(promotion.prepared),
        );

        expect(result.ok).toBe(true);
        const selected = await resolveSelectedState(promotion.fixture.repositoryRoot);
        expect(selected.metadata.publicationDigest).toBe(promotion.newPublicationDigest);
        expect(selected.rows).toHaveLength(9);
      } finally {
        await promotion.fixture.cleanup();
      }
    });
  },
);

it("returns bounded recovery data when committed state cannot be established", async () => {
  const promotion = await prepareFreshPromotion();
  const pointerPath = resolve(
    promotion.fixture.repositoryRoot,
    "readiness/publications/current-publication.json",
  );
  let pointerWasReplaced = false;
  try {
    const result = await runFinalConformance(
      {
        atFaultPoint(point): void {
          if (point === "after-pointer-rename") {
            pointerWasReplaced = true;
            throw new Error("Injected failure after pointer replacement.");
          }
        },
        atFilesystemPoint(point, context): void {
          if (pointerWasReplaced && point === "before-file-read" && context.path === pointerPath) {
            throw new Error("Injected reconciliation read failure.");
          }
        },
      },
      () => publishFinal(promotion.prepared),
    );

    expect(result).toEqual({
      ok: false,
      kind: "commit-indeterminate",
      expectedOldPublicationDigest: promotion.fixture.publicationDigest,
      expectedNewPublicationDigest: promotion.newPublicationDigest,
      diagnostics: [
        {
          code: "publication.commit.indeterminate",
          path: "readiness/publications/current-publication.json",
          message: expect.any(String),
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain(promotion.fixture.repositoryRoot);
  } finally {
    await promotion.fixture.cleanup();
  }
});

it("fully restarts one reader and returns the exact new snapshot", async () => {
  const promotion = await prepareFreshPromotion();
  const crossingReader = new ReaderHarness({
    schemaVersion: 1,
    repositoryRoot: promotion.fixture.repositoryRoot,
    pauseAfterPointerReadAttempts: [1],
  });
  try {
    const oldControl = await runReader(promotion.fixture.repositoryRoot);
    expect(oldControl.result.ok).toBe(true);
    if (!oldControl.result.ok) {
      throw new Error("Old control reader failed.");
    }
    expect(oldControl.result.publicationDigest).toBe(promotion.fixture.publicationDigest);
    expect(oldControl.result.bindingRows).toHaveLength(4);

    expectReady(await crossingReader.nextMessage());
    expectBarrier(await crossingReader.nextMessage(), 1);

    const publication = await publishFinal(promotion.prepared);
    expect(publication.ok).toBe(true);
    const newControl = await runReader(promotion.fixture.repositoryRoot);
    expect(newControl.result.ok).toBe(true);
    if (!newControl.result.ok) {
      throw new Error("New control reader failed.");
    }
    expect(newControl.result.publicationDigest).toBe(promotion.newPublicationDigest);
    expect(newControl.result.bindingRows).toHaveLength(9);

    crossingReader.continue(1);
    const crossed = await crossingReader.nextMessage();
    expect(crossed.kind).toBe("result");
    if (crossed.kind !== "result") {
      throw new Error("Crossing reader did not return its result.");
    }
    expect(crossed.attempts).toEqual([
      { operation: "selected-resolution", attempt: 1, event: "start" },
      { operation: "selected-resolution", attempt: 1, event: "failure" },
      {
        operation: "selected-resolution",
        attempt: 1,
        event: "retry",
        reason: "verified-pointer-replacement",
      },
      { operation: "selected-resolution", attempt: 2, event: "start" },
      { operation: "selected-resolution", attempt: 2, event: "success" },
    ]);
    expect(crossed.result).toEqual(newControl.result);
    expect(crossed.result).not.toEqual(oldControl.result);
  } finally {
    await crossingReader.terminate();
    await promotion.fixture.cleanup();
  }
});

it("fails closed after a second verified pointer replacement", async () => {
  const promotion = await prepareFreshPromotion();
  const crossingReader = new ReaderHarness({
    schemaVersion: 1,
    repositoryRoot: promotion.fixture.repositoryRoot,
    pauseAfterPointerReadAttempts: [1, 2],
  });
  const pointerPath = resolve(
    promotion.fixture.repositoryRoot,
    "readiness/publications/current-publication.json",
  );
  const replacementPath = `${pointerPath}.second-replacement`;
  try {
    expectReady(await crossingReader.nextMessage());
    expectBarrier(await crossingReader.nextMessage(), 1);
    const publication = await publishFinal(promotion.prepared);
    expect(publication.ok).toBe(true);

    crossingReader.continue(1);
    expectBarrier(await crossingReader.nextMessage(), 2);
    await writeFile(replacementPath, promotion.fixture.pointerBytes, {
      flag: "wx",
    });
    await rename(replacementPath, pointerPath);
    crossingReader.continue(2);

    const crossed = await crossingReader.nextMessage();
    expect(crossed.kind).toBe("result");
    if (crossed.kind !== "result") {
      throw new Error("Crossing reader did not return its result.");
    }
    expect(crossed.attempts).toEqual([
      { operation: "selected-resolution", attempt: 1, event: "start" },
      { operation: "selected-resolution", attempt: 1, event: "failure" },
      {
        operation: "selected-resolution",
        attempt: 1,
        event: "retry",
        reason: "verified-pointer-replacement",
      },
      { operation: "selected-resolution", attempt: 2, event: "start" },
      { operation: "selected-resolution", attempt: 2, event: "failure" },
    ]);
    expect(crossed.result.ok).toBe(false);
  } finally {
    await crossingReader.terminate();
    await promotion.fixture.cleanup();
  }
});

it("does not retry an unrelated selected-pointer filesystem failure", async () => {
  const promotion = await prepareFreshPromotion();
  const pointerPath = resolve(
    promotion.fixture.repositoryRoot,
    "readiness/publications/current-publication.json",
  );
  const attempts: ResolutionObservation[] = [];
  try {
    const result = await runFinalConformance(
      {
        atResolutionObservation(observation): void {
          attempts.push(observation);
        },
        atFilesystemPoint(point, context): void {
          if (point === "before-file-read" && context.path === pointerPath) {
            throw new Error("Injected unrelated pointer read failure.");
          }
        },
      },
      () =>
        resolvePublishedSnapshot({
          repositoryRoot: promotion.fixture.repositoryRoot,
        }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Unrelated filesystem failure unexpectedly resolved.");
    }
    expect(result.kind).toBe("io");
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "publication.io" })]);
    expect(attempts).toEqual([
      { operation: "selected-resolution", attempt: 1, event: "start" },
      { operation: "selected-resolution", attempt: 1, event: "failure" },
    ]);
  } finally {
    await promotion.fixture.cleanup();
  }
});
