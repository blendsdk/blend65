import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { isMainThread, parentPort, workerData } from "node:worker_threads";

import {
  runWithPublicationConformance,
  type PublicationConformanceHooks,
} from "../publication-conformance-v1.js";
import {
  getPublishedBindingRows,
  getPublishedInventory,
  getPublishedMetadata,
  resolvePublishedSnapshot,
} from "../publication-resolver.js";

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

interface ReaderWorkerInput {
  readonly schemaVersion: 1;
  readonly repositoryRoot: string;
  readonly pauseAfterPointerReadAttempts: readonly (1 | 2)[];
}

function readInput(value: unknown): ReaderWorkerInput {
  if (
    typeof value !== "object" ||
    value === null ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error("Reader worker input must be a plain object.");
  }

  const record = value as Record<string, unknown>;
  const pauses = record.pauseAfterPointerReadAttempts;
  if (
    record.schemaVersion !== 1 ||
    typeof record.repositoryRoot !== "string" ||
    record.repositoryRoot.length === 0 ||
    !Array.isArray(pauses) ||
    pauses.some((attempt) => attempt !== 1 && attempt !== 2) ||
    new Set(pauses).size !== pauses.length ||
    Object.keys(record).sort().join(",") !==
      "pauseAfterPointerReadAttempts,repositoryRoot,schemaVersion"
  ) {
    throw new Error("Reader worker input does not match the closed protocol.");
  }

  return {
    schemaVersion: 1,
    repositoryRoot: record.repositoryRoot,
    pauseAfterPointerReadAttempts: [...pauses] as readonly (1 | 2)[],
  };
}

function isContinueMessage(
  value: unknown,
  attempt: 1 | 2,
): value is {
  readonly schemaVersion: 1;
  readonly kind: "continue";
  readonly barrier: "pointer-read";
  readonly attempt: 1 | 2;
} {
  if (
    typeof value !== "object" ||
    value === null ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === 1 &&
    record.kind === "continue" &&
    record.barrier === "pointer-read" &&
    record.attempt === attempt &&
    Object.keys(record).sort().join(",") === "attempt,barrier,kind,schemaVersion"
  );
}

if (isMainThread || parentPort === null) {
  throw new Error("The reader fixture must run in a worker thread.");
}

const port = parentPort;
const input = readInput(workerData);
const repositoryRoot = await realpath(input.repositoryRoot);
const selectedPointerPath = resolve(
  repositoryRoot,
  "readiness/publications/current-publication.json",
);
const pauses = new Set(input.pauseAfterPointerReadAttempts);
const reachedPauses = new Set<1 | 2>();
const attempts: ResolutionObservation[] = [];
let currentAttempt: 1 | 2 | undefined;

port.postMessage({ schemaVersion: 1, kind: "ready" });

async function pauseAtPointerRead(attempt: 1 | 2): Promise<void> {
  port.postMessage({
    schemaVersion: 1,
    kind: "barrier",
    barrier: "pointer-read",
    attempt,
  });

  await new Promise<void>((complete, reject) => {
    port.once("message", (message: unknown) => {
      if (!isContinueMessage(message, attempt)) {
        reject(new Error("Reader worker received an invalid continue message."));
        return;
      }
      complete();
    });
  });
}

const hooks: PublicationConformanceHooks & {
  readonly atResolutionObservation: (observation: ResolutionObservation) => void | Promise<void>;
} = {
  atResolutionObservation(observation: ResolutionObservation): void {
    attempts.push(observation);
    if (observation.event === "start") {
      currentAttempt = observation.attempt;
    }
  },
  async atFilesystemPoint(point, context): Promise<void> {
    if (
      point !== "after-file-read" ||
      context.path !== selectedPointerPath ||
      currentAttempt === undefined ||
      !pauses.has(currentAttempt) ||
      reachedPauses.has(currentAttempt)
    ) {
      return;
    }

    reachedPauses.add(currentAttempt);
    await pauseAtPointerRead(currentAttempt);
  },
};

const resolution = await runWithPublicationConformance(hooks, () =>
  resolvePublishedSnapshot({ repositoryRoot }),
);

if (!resolution.ok) {
  port.postMessage({
    schemaVersion: 1,
    kind: "result",
    attempts,
    result: resolution,
  });
  port.close();
} else {
  const metadata = getPublishedMetadata(resolution.value);
  const bindingRows = getPublishedBindingRows(resolution.value);
  const inventory = getPublishedInventory(resolution.value);
  if (metadata === undefined || bindingRows === undefined || inventory === undefined) {
    throw new Error("Resolved snapshot projection is unavailable.");
  }

  port.postMessage({
    schemaVersion: 1,
    kind: "result",
    attempts,
    result: {
      ok: true,
      publicationDigest: metadata.publicationDigest,
      inventoryGenerationDigest: metadata.inventoryGenerationDigest,
      bindingRows,
      handlerDeclarations: inventory.handlerDeclarations,
    },
  });
  port.close();
}
