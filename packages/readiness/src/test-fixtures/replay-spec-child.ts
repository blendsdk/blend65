import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const MAX_REPLAY_BYTES = 1_048_576;

type Digest = `sha256:${string}`;
type IdentityComponent =
  | "inventory"
  | "rule-model"
  | "generator"
  | "boundary-transform"
  | "renderer"
  | "configuration";

interface ParameterValueBinding {
  readonly kind: "parameter-value";
  readonly parameterPath: string;
  readonly value: bigint | boolean;
}

interface GeneratedModeledCase {
  readonly projection:
    | { readonly kind: "valid"; readonly module: unknown }
    | {
        readonly kind: "invalid";
        readonly baseline: unknown;
        readonly transform:
          | {
              readonly kind:
                | "intrinsic-argument-remove"
                | "intrinsic-argument-insert"
                | "intrinsic-argument-replace";
              readonly callPath: string;
              readonly argumentIndex: number;
              readonly argument?: unknown;
            }
          | {
              readonly kind: "scalar-expression-replace";
              readonly expressionPath: string;
              readonly replacement: { readonly kind: "integer-literal"; readonly value: bigint };
            }
          | {
              readonly kind: "parameter-binding-replace";
              readonly parameterPath: string;
              readonly replacement: { readonly kind: "integer-literal"; readonly value: bigint };
            };
      };
  readonly parameterBindings: readonly ParameterValueBinding[];
}

interface RenderOptions {
  readonly maxSourceBytes: number;
  readonly literalSpellings: readonly [];
}

interface RevisionRegistry {
  resolve(component: IdentityComponent, revision: Digest): unknown | undefined;
}

interface ExecutableBinding {
  readonly handlerId: string;
  readonly kind: "generator" | "transform";
  readonly contractVersion: "1.0.0";
  readonly implementationRevision: Digest;
  readonly implementation: (...args: readonly unknown[]) => unknown;
}

interface FreshCandidateRegistration {
  readonly binding: ExecutableBinding;
}

interface ImplementationRevisionInput {
  readonly contractVersion: "1.0.0";
  readonly entryPath: string;
  readonly files: readonly {
    readonly path: string;
    readonly content: Uint8Array;
  }[];
}

type ImplementationRevisionResult =
  | {
      readonly ok: true;
      readonly revision: Digest;
      readonly normalizedFiles: readonly {
        readonly path: string;
        readonly content: Uint8Array;
      }[];
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false };

interface ChildApi {
  readonly INVENTORY_V1_LIMITS: unknown;
  readonly parseInventoryJson: (
    bytes: Uint8Array,
    limits: unknown,
  ) => { readonly ok: boolean; readonly inventory?: unknown };
  readonly validateInventorySchema: (inventory: unknown) => {
    readonly ok: boolean;
    readonly inventory?: unknown;
  };
  readonly createModeledGeneratorSuite: (
    input: unknown,
  ) => { readonly ok: true; readonly suite: unknown } | { readonly ok: false };
  readonly generateRuntimeCase: (...args: readonly unknown[]) => unknown;
  readonly boundaryVariantsHandler: (...args: readonly unknown[]) => unknown;
  readonly renderGeneratedCase: (
    generatedCase: GeneratedModeledCase,
    options: RenderOptions,
  ) => unknown;
  readonly createRevisionRegistry: (
    entries: readonly { component: IdentityComponent; revision: Digest; value: unknown }[],
  ) => { readonly ok: true; readonly registry: RevisionRegistry } | { readonly ok: false };
  readonly deriveConfigurationIdentity: (
    configuration: typeof CONFIGURATION,
  ) => { readonly ok: true; readonly identity: Digest } | { readonly ok: false };
  readonly deriveImplementationRevision: (
    input: ImplementationRevisionInput,
  ) => ImplementationRevisionResult;
  readonly validateImplementationRevision: (input: {
    readonly claimedRevision: Digest;
    readonly metadata: ImplementationRevisionInput;
  }) => ImplementationRevisionResult;
  readonly registerFreshCandidateBinding: (input: {
    readonly binding: ExecutableBinding;
    readonly freshness: Extract<ImplementationRevisionResult, { readonly ok: true }>;
  }) =>
    | { readonly ok: true; readonly registration: FreshCandidateRegistration }
    | { readonly ok: false };
  readonly replayCase: (input: {
    readonly envelopeBytes: Uint8Array;
    readonly registry: RevisionRegistry;
  }) =>
    | {
        readonly ok: true;
        readonly case: { readonly identity: { readonly digest: Digest } };
        readonly source: Uint8Array;
      }
    | {
        readonly ok: false;
        readonly kind: "replay-incompatible";
        readonly missing: IdentityComponent;
      }
    | {
        readonly ok: false;
        readonly kind: "replay-invalid";
        readonly diagnostics: readonly unknown[];
      };
}

const BUDGET = {
  maxModules: 4,
  maxDeclarations: 128,
  maxIrNodes: 512,
  maxStatements: 256,
  maxExpressionDepth: 16,
  maxLoopWork: 1n,
  maxSourceBytes: 65_536,
  maxAttempts: 128,
} as const;

const CONFIGURATION = {
  caseCount: 120,
  maxInvalidCases: 32,
  enabledRuleIds: [
    "rule.ch12.3-1-memory-access.peek-addr.signature.word",
    "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
    "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
    "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
  ].sort(),
  spellings: ["const", "literal", "local", "parameter"],
  budget: BUDGET,
} as const;

function sha256(bytes: Uint8Array): Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fixedDigest(digit: string): Digest {
  return `sha256:${digit.repeat(64)}`;
}

function isChildApi(value: object): value is ChildApi {
  const callables = [
    "parseInventoryJson",
    "validateInventorySchema",
    "createModeledGeneratorSuite",
    "generateRuntimeCase",
    "boundaryVariantsHandler",
    "renderGeneratedCase",
    "createRevisionRegistry",
    "deriveConfigurationIdentity",
    "deriveImplementationRevision",
    "validateImplementationRevision",
    "registerFreshCandidateBinding",
    "replayCase",
  ] as const;
  return (
    "INVENTORY_V1_LIMITS" in value &&
    callables.every((name) => name in value && typeof Reflect.get(value, name) === "function")
  );
}

async function api(): Promise<ChildApi> {
  const value = await import("../index.js");
  if (!isChildApi(value)) {
    throw new TypeError("campaign replay child API is incomplete");
  }
  return value;
}

function freshCandidate(
  childApi: ChildApi,
  fixtureName: string,
  binding: Omit<ExecutableBinding, "implementationRevision">,
): FreshCandidateRegistration {
  const path = `fixtures/${fixtureName}.ts`;
  const metadata: ImplementationRevisionInput = {
    contractVersion: "1.0.0",
    entryPath: path,
    files: [
      {
        path,
        content: new TextEncoder().encode(`export const fixture = "${fixtureName}";\n`),
      },
    ],
  };
  const derived = childApi.deriveImplementationRevision(metadata);
  if (!derived.ok) {
    throw new TypeError("fixed implementation revision derivation failed");
  }
  const freshness = childApi.validateImplementationRevision({
    claimedRevision: derived.revision,
    metadata,
  });
  if (!freshness.ok) {
    throw new TypeError("fixed implementation revision validation failed");
  }
  const registered = childApi.registerFreshCandidateBinding({
    binding: { ...binding, implementationRevision: derived.revision },
    freshness,
  });
  if (!registered.ok) {
    throw new TypeError("fixed candidate registration failed");
  }
  return registered.registration;
}

async function exactRegistry(childApi: ChildApi): Promise<RevisionRegistry> {
  const [inventoryBytes, modelBytes, seedContractBytes, reviewEvidenceBytes] = await Promise.all([
    readFile(resolve(REPOSITORY_ROOT, "readiness/inventory/compiler-readiness-v1.json")),
    readFile(resolve(REPOSITORY_ROOT, "readiness/rule-models/rule-models-v1.json")),
    readFile(resolve(REPOSITORY_ROOT, "readiness/rule-models/rule-model-seed-v1.json")),
    readFile(resolve(REPOSITORY_ROOT, "readiness/reviews/rule-models-v1-review.json")),
  ]);
  const parsed = childApi.parseInventoryJson(inventoryBytes, childApi.INVENTORY_V1_LIMITS);
  if (!parsed.ok || parsed.inventory === undefined) {
    throw new TypeError("fixed inventory parse failed");
  }
  const validated = childApi.validateInventorySchema(parsed.inventory);
  if (!validated.ok || validated.inventory === undefined) {
    throw new TypeError("fixed inventory validation failed");
  }
  const suite = childApi.createModeledGeneratorSuite({
    seedContractBytes,
    ruleModelBytes: modelBytes,
    reviewEvidenceBytes,
    inventory: validated.inventory,
  });
  if (!suite.ok) {
    throw new TypeError("fixed reviewed suite failed");
  }

  const inventoryDigest = sha256(inventoryBytes);
  const ruleModelDigest = sha256(modelBytes);
  const inventory = {
    schemaVersion: 1,
    inventoryVersion: "compiler-readiness-v1",
    inventoryDigest,
    specRevision: "spec-v3.0",
  } as const;
  const generator = freshCandidate(childApi, "generator-runtime", {
    handlerId: "generator.runtime-cases",
    kind: "generator",
    contractVersion: "1.0.0",
    implementation: childApi.generateRuntimeCase,
  });
  const boundaryTransform = freshCandidate(childApi, "boundary-default", {
    handlerId: "transform.boundary-variants",
    kind: "transform",
    contractVersion: "1.0.0",
    implementation: childApi.boundaryVariantsHandler,
  });
  const caseRenderer = {
    implementationRevision: fixedDigest("5"),
    implementation: childApi.renderGeneratedCase,
  } as const;
  const configurationIdentity = childApi.deriveConfigurationIdentity(CONFIGURATION);
  if (!configurationIdentity.ok) {
    throw new TypeError("fixed configuration identity failed");
  }

  const registry = childApi.createRevisionRegistry([
    { component: "inventory", revision: inventoryDigest, value: inventory },
    { component: "rule-model", revision: ruleModelDigest, value: suite.suite },
    {
      component: "generator",
      revision: generator.binding.implementationRevision,
      value: generator,
    },
    {
      component: "boundary-transform",
      revision: boundaryTransform.binding.implementationRevision,
      value: boundaryTransform,
    },
    {
      component: "renderer",
      revision: caseRenderer.implementationRevision,
      value: caseRenderer,
    },
    {
      component: "configuration",
      revision: configurationIdentity.identity,
      value: CONFIGURATION,
    },
  ]);
  if (!registry.ok) {
    throw new TypeError("fixed exact registry failed");
  }
  return registry.registry;
}

let stdinPromise: Promise<Uint8Array> | undefined;

function readStdin(): Promise<Uint8Array> {
  stdinPromise ??= new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let byteLength = 0;
    process.stdin.on("data", (chunk: Buffer) => {
      if (byteLength <= MAX_REPLAY_BYTES) {
        chunks.push(chunk);
      }
      byteLength += chunk.byteLength;
    });
    process.stdin.on("error", reject);
    process.stdin.on("end", () => {
      const bytes = Buffer.concat(chunks);
      resolvePromise(byteLength > MAX_REPLAY_BYTES ? new Uint8Array(MAX_REPLAY_BYTES + 1) : bytes);
    });
  });
  return stdinPromise;
}

async function main(): Promise<void> {
  const childApi = await api();
  const envelopeBytes = await readStdin();
  const result = childApi.replayCase({
    envelopeBytes,
    registry: await exactRegistry(childApi),
  });
  const response = result.ok
    ? {
        schemaVersion: 1,
        ok: true,
        caseDigest: result.case.identity.digest,
        sourceBase64: Buffer.from(result.source).toString("base64"),
      }
    : {
        schemaVersion: 1,
        ok: false,
        result:
          result.kind === "replay-incompatible"
            ? { kind: result.kind, missing: result.missing }
            : { kind: result.kind, diagnostics: result.diagnostics },
      };
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
