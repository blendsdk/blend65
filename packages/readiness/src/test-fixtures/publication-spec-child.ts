type Digest = `sha256:${string}`;
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

interface ChildRequest {
  readonly schemaVersion: 1;
  readonly repositoryRoot: string;
  readonly crashAt: FaultPoint | null;
}

const encoder = new TextEncoder();
const CONFORMANCE_MODULE_PATH = "../publication-conformance-v1.js";

async function stdinBytes(): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  if (total > 65_536) throw new TypeError("publication child input exceeds its bound");
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function request(bytes: Uint8Array): ChildRequest {
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (
    typeof value !== "object" ||
    value === null ||
    !Object.hasOwn(value, "schemaVersion") ||
    !Object.hasOwn(value, "repositoryRoot") ||
    !Object.hasOwn(value, "crashAt") ||
    Reflect.get(value, "schemaVersion") !== 1 ||
    typeof Reflect.get(value, "repositoryRoot") !== "string"
  ) {
    throw new TypeError("publication child request is invalid");
  }
  const crashAt = Reflect.get(value, "crashAt");
  const faultPoints: readonly FaultPoint[] = [
    "after-member-sync",
    "after-staging-directory-sync",
    "after-release-rename",
    "after-releases-directory-sync",
    "before-staged-validation",
    "after-staged-validation",
    "after-pointer-temporary-sync",
    "after-pointer-rename",
    "after-publication-root-sync",
  ];
  if (
    crashAt !== null &&
    (typeof crashAt !== "string" || !faultPoints.some((point) => point === crashAt))
  ) {
    throw new TypeError("publication child crash point is invalid");
  }
  return {
    schemaVersion: 1,
    repositoryRoot: Reflect.get(value, "repositoryRoot"),
    crashAt,
  };
}

const input = request(await stdinBytes());
const api: Readonly<Record<string, unknown>> = await import("../index.js");
const conformance = await import(CONFORMANCE_MODULE_PATH);
const prepare = api.prepareBindingPublicationReview as (input: unknown) => Promise<{
  readonly ok: boolean;
  readonly value?: {
    readonly request: {
      readonly specRevision: string;
      readonly reviewUnits: readonly {
        readonly unitId: string;
        readonly semanticDigest: Digest;
        readonly dependencyDigests: Readonly<Record<string, Digest>>;
      }[];
    };
  };
}>;
const publish = api.publishBindingTransaction as (input: unknown) => Promise<{
  readonly ok: boolean;
  readonly value?: { readonly publicationDigest: Digest };
}>;
const prepared = await prepare({
  repositoryRoot: input.repositoryRoot,
});
if (!prepared.ok || prepared.value === undefined) throw new TypeError("prepare failed");
const reviewRequest = prepared.value.request;
const semanticReviewBytes = encoder.encode(
  `${JSON.stringify({
    schemaVersion: 1,
    reviews: reviewRequest.reviewUnits.map((unit) => ({
      unitId: unit.unitId,
      reviewer: "publication-spec-child",
      specRevision: reviewRequest.specRevision,
      semanticDigest: unit.semanticDigest,
      dependencyDigests: unit.dependencyDigests,
      outcome: "accepted",
      resolvedDisagreementIds: [],
    })),
  })}\n`,
);
const result = await conformance.runWithPublicationConformance(
  {
    atFaultPoint: (point: FaultPoint) => {
      if (point === input.crashAt) process.exit(91);
    },
  },
  () =>
    publish({
      repositoryRoot: input.repositoryRoot,
      semanticReviewBytes,
    }),
);
process.stdout.write(
  `${JSON.stringify({
    schemaVersion: 1,
    ok: result.ok,
    ...(result.value === undefined ? {} : { publicationDigest: result.value.publicationDigest }),
  })}\n`,
);
