import { createHash } from "node:crypto";

import { createOracleContractsSpecFixture } from "./oracle-contracts-spec-fixture.js";

const encoder = new TextEncoder();

type Digest = `sha256:${string}`;

interface IdentityInput {
  readonly schemaVersion: 1;
  readonly sourceProvenance: {
    readonly schemaVersion: 1;
    readonly campaign: {
      readonly inventorySchemaVersion: 1;
      readonly inventoryVersion: string;
      readonly inventoryDigest: Digest;
      readonly specRevision: string;
      readonly ruleModelVersion: string;
      readonly ruleModelDigest: Digest;
      readonly generator: {
        readonly handlerId: string;
        readonly contractVersion: string;
        readonly implementationRevision: Digest;
      };
      readonly boundaryTransform: {
        readonly handlerId: string;
        readonly contractVersion: string;
        readonly implementationRevision: Digest;
      };
      readonly rendererRevision: Digest;
      readonly target: "c64";
      readonly prngAlgorithm: "blend65-sha256-ctr-v1";
      readonly seed: Digest;
      readonly configurationDigest: Digest;
    };
    readonly campaignDigest: Digest;
    readonly caseIdentity: {
      readonly campaignDigest: Digest;
      readonly generationPath: readonly number[];
      readonly ordinal: number;
      readonly digest: Digest;
    };
    readonly configuration: {
      readonly caseCount: number;
      readonly maxInvalidCases: number;
      readonly enabledRuleIds: readonly string[];
      readonly spellings: readonly string[];
      readonly budget: {
        readonly maxModules: number;
        readonly maxDeclarations: number;
        readonly maxIrNodes: number;
        readonly maxStatements: number;
        readonly maxExpressionDepth: number;
        readonly maxLoopWork: bigint;
        readonly maxSourceBytes: number;
        readonly maxAttempts: number;
      };
    };
  };
  readonly sourceContentIdentity: Digest;
  readonly transformedContentIdentity?: Digest;
  readonly relationId?: string;
  readonly entryFunction: string;
  readonly initialMemoryIdentity: Digest;
  readonly diagnosticManifestDigest: Digest;
  readonly bindingRejectionDigest: Digest;
  readonly budget: {
    readonly inputNodes: bigint;
    readonly expressionDepth: bigint;
    readonly evaluationSteps: bigint;
    readonly frames: bigint;
    readonly memoryCells: bigint;
    readonly effects: bigint;
    readonly transformedNodes: bigint;
  };
  readonly policyRevision: `oracle-policy-v${number}`;
  readonly observableProjectionId: string;
  readonly participants: readonly {
    readonly handlerId: string;
    readonly contractVersion: string;
    readonly implementationRevision: Digest;
  }[];
}

const digest = (digit: string): Digest => `sha256:${digit.repeat(64)}`;

const sourceContent = Buffer.from(
  "7b2263617365223a22736f75726365222c2276616c7565223a2231227d0a",
  "hex",
);
const transformedContent = Buffer.from(
  "7b2263617365223a227472616e73666f726d6564222c2276616c7565223a22312b30227d0a",
  "hex",
);

const initialMemory = Object.freeze({
  schemaVersion: 1 as const,
  cells: Object.freeze([
    Object.freeze({ address: 0n, value: 1n }),
    Object.freeze({ address: 4096n, value: 52n }),
    Object.freeze({ address: 4097n, value: 18n }),
    Object.freeze({ address: 65_535n, value: 255n }),
  ]),
});

const evaluationInput: IdentityInput = Object.freeze({
  schemaVersion: 1,
  sourceProvenance: Object.freeze({
    schemaVersion: 1,
    campaign: Object.freeze({
      inventorySchemaVersion: 1,
      inventoryVersion: "inventory-v1",
      inventoryDigest: digest("a"),
      specRevision: "spec-v3.0",
      ruleModelVersion: "rule-models-v1",
      ruleModelDigest: digest("b"),
      generator: Object.freeze({
        handlerId: "generator.frontend-cases",
        contractVersion: "1.0.0",
        implementationRevision: digest("c"),
      }),
      boundaryTransform: Object.freeze({
        handlerId: "transform.boundary-variants",
        contractVersion: "1.0.0",
        implementationRevision: digest("d"),
      }),
      rendererRevision: digest("e"),
      target: "c64",
      prngAlgorithm: "blend65-sha256-ctr-v1",
      seed: digest("f"),
      configurationDigest:
        "sha256:91b75fcac727ac6cdece9e55a347f78195ef08b2f5b05adf57928e30f6a3afbd",
    }),
    campaignDigest: "sha256:afb1717039f93cbe1911a7a8277a319bfcf6ac4ebe6ed90753521c3212bbcf4d",
    caseIdentity: Object.freeze({
      campaignDigest: "sha256:afb1717039f93cbe1911a7a8277a319bfcf6ac4ebe6ed90753521c3212bbcf4d",
      generationPath: Object.freeze([2, 7]),
      ordinal: 3,
      digest: "sha256:29e10746065e9410bfc3a9b902d3df65c0772806d89728d30308447b4da4b872",
    }),
    configuration: Object.freeze({
      caseCount: 2,
      maxInvalidCases: 1,
      enabledRuleIds: Object.freeze([
        "rule.ch02.2-primitive-types.byte.range.0-255",
        "rule.ch02.2-primitive-types.word.range.0-65535",
      ]),
      spellings: Object.freeze(["const", "literal", "local", "parameter"]),
      budget: Object.freeze({
        maxModules: 2,
        maxDeclarations: 8,
        maxIrNodes: 64,
        maxStatements: 32,
        maxExpressionDepth: 6,
        maxLoopWork: 64n,
        maxSourceBytes: 4096,
        maxAttempts: 128,
      }),
    }),
  }),
  sourceContentIdentity: "sha256:add938cb04f8efc3171efbff6a5d7f5f00f9a3e45eef4b1b77fda6c3ed52681a",
  transformedContentIdentity:
    "sha256:437aba703668d086f61f8bfca9520dba026c61e363bda57b44ebbf302ad3c946",
  relationId: "relation.algebraic-identity",
  entryFunction: "main",
  initialMemoryIdentity: "sha256:5de5deb6d5497e4d809d43425475cf11c496ac85e4b9048d8b9fe51466116729",
  diagnosticManifestDigest:
    "sha256:52e3b2e55f112f5ffdcdb9b3e7284af08a67426b8c7eeb6027f8e5bbf2c9c335",
  bindingRejectionDigest: "sha256:dbb7de1c32c39876319cce7426f85d9700d63c1e2bb33943f9f84330b759024e",
  budget: Object.freeze({
    inputNodes: 128n,
    expressionDepth: 16n,
    evaluationSteps: 1024n,
    frames: 1n,
    memoryCells: 4n,
    effects: 16n,
    transformedNodes: 256n,
  }),
  policyRevision: "oracle-policy-v1",
  observableProjectionId: "projection.value-state.exact-v1",
  participants: Object.freeze([
    Object.freeze({
      handlerId: "oracle.frontend-result",
      contractVersion: "1.0.0",
      implementationRevision: digest("1"),
    }),
    Object.freeze({
      handlerId: "transform.semantic-relations",
      contractVersion: "1.0.0",
      implementationRevision: digest("2"),
    }),
  ]),
});

function u32be(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function text(value: string | number | bigint): Uint8Array {
  return encoder.encode(String(value));
}

function optional(value: string | undefined): Uint8Array {
  return value === undefined ? Uint8Array.of(0) : concat([Uint8Array.of(1), text(value)]);
}

function canonicalPreimage(
  domain: string,
  fields: readonly (readonly [string, Uint8Array])[],
): Uint8Array {
  const domainBytes = text(domain);
  return concat([
    u32be(domainBytes.byteLength),
    domainBytes,
    u32be(fields.length),
    ...fields.flatMap(([name, value]) => {
      const nameBytes = text(name);
      return [u32be(nameBytes.byteLength), nameBytes, u32be(value.byteLength), value];
    }),
  ]);
}

function evaluationFields(input: IdentityInput): readonly (readonly [string, Uint8Array])[] {
  const { campaign, caseIdentity, configuration } = input.sourceProvenance;
  const participants = [...input.participants].sort((left, right) =>
    left.handlerId.localeCompare(right.handlerId),
  );
  return [
    ["schemaVersion", text(input.schemaVersion)],
    ["sourceProvenance.schemaVersion", text(input.sourceProvenance.schemaVersion)],
    ["sourceProvenance.campaign.inventorySchemaVersion", text(campaign.inventorySchemaVersion)],
    ["sourceProvenance.campaign.inventoryVersion", text(campaign.inventoryVersion)],
    ["sourceProvenance.campaign.inventoryDigest", text(campaign.inventoryDigest)],
    ["sourceProvenance.campaign.specRevision", text(campaign.specRevision)],
    ["sourceProvenance.campaign.ruleModelVersion", text(campaign.ruleModelVersion)],
    ["sourceProvenance.campaign.ruleModelDigest", text(campaign.ruleModelDigest)],
    ["sourceProvenance.campaign.generator.handlerId", text(campaign.generator.handlerId)],
    [
      "sourceProvenance.campaign.generator.contractVersion",
      text(campaign.generator.contractVersion),
    ],
    [
      "sourceProvenance.campaign.generator.implementationRevision",
      text(campaign.generator.implementationRevision),
    ],
    [
      "sourceProvenance.campaign.boundaryTransform.handlerId",
      text(campaign.boundaryTransform.handlerId),
    ],
    [
      "sourceProvenance.campaign.boundaryTransform.contractVersion",
      text(campaign.boundaryTransform.contractVersion),
    ],
    [
      "sourceProvenance.campaign.boundaryTransform.implementationRevision",
      text(campaign.boundaryTransform.implementationRevision),
    ],
    ["sourceProvenance.campaign.rendererRevision", text(campaign.rendererRevision)],
    ["sourceProvenance.campaign.target", text(campaign.target)],
    ["sourceProvenance.campaign.prngAlgorithm", text(campaign.prngAlgorithm)],
    ["sourceProvenance.campaign.seed", text(campaign.seed)],
    ["sourceProvenance.campaign.configurationDigest", text(campaign.configurationDigest)],
    ["sourceProvenance.campaignDigest", text(input.sourceProvenance.campaignDigest)],
    ["sourceProvenance.caseIdentity.campaignDigest", text(caseIdentity.campaignDigest)],
    [
      "sourceProvenance.caseIdentity.generationPath.count",
      text(caseIdentity.generationPath.length),
    ],
    ...caseIdentity.generationPath.map(
      (member, index) =>
        [`sourceProvenance.caseIdentity.generationPath.${index}`, text(member)] as const,
    ),
    ["sourceProvenance.caseIdentity.ordinal", text(caseIdentity.ordinal)],
    ["sourceProvenance.caseIdentity.digest", text(caseIdentity.digest)],
    ["sourceProvenance.configuration.caseCount", text(configuration.caseCount)],
    ["sourceProvenance.configuration.maxInvalidCases", text(configuration.maxInvalidCases)],
    [
      "sourceProvenance.configuration.enabledRuleIds.count",
      text(configuration.enabledRuleIds.length),
    ],
    ...configuration.enabledRuleIds.map(
      (member, index) =>
        [`sourceProvenance.configuration.enabledRuleIds.${index}`, text(member)] as const,
    ),
    ["sourceProvenance.configuration.spellings.count", text(configuration.spellings.length)],
    ...configuration.spellings.map(
      (member, index) =>
        [`sourceProvenance.configuration.spellings.${index}`, text(member)] as const,
    ),
    ["sourceProvenance.configuration.budget.maxModules", text(configuration.budget.maxModules)],
    [
      "sourceProvenance.configuration.budget.maxDeclarations",
      text(configuration.budget.maxDeclarations),
    ],
    ["sourceProvenance.configuration.budget.maxIrNodes", text(configuration.budget.maxIrNodes)],
    [
      "sourceProvenance.configuration.budget.maxStatements",
      text(configuration.budget.maxStatements),
    ],
    [
      "sourceProvenance.configuration.budget.maxExpressionDepth",
      text(configuration.budget.maxExpressionDepth),
    ],
    ["sourceProvenance.configuration.budget.maxLoopWork", text(configuration.budget.maxLoopWork)],
    [
      "sourceProvenance.configuration.budget.maxSourceBytes",
      text(configuration.budget.maxSourceBytes),
    ],
    ["sourceProvenance.configuration.budget.maxAttempts", text(configuration.budget.maxAttempts)],
    ["sourceContentIdentity", text(input.sourceContentIdentity)],
    ["transformedContentIdentity", optional(input.transformedContentIdentity)],
    ["relationId", optional(input.relationId)],
    ["entryFunction", text(input.entryFunction)],
    ["initialMemoryIdentity", text(input.initialMemoryIdentity)],
    ["diagnosticManifestDigest", text(input.diagnosticManifestDigest)],
    ["bindingRejectionDigest", text(input.bindingRejectionDigest)],
    ["budget.inputNodes", text(input.budget.inputNodes)],
    ["budget.expressionDepth", text(input.budget.expressionDepth)],
    ["budget.evaluationSteps", text(input.budget.evaluationSteps)],
    ["budget.frames", text(input.budget.frames)],
    ["budget.memoryCells", text(input.budget.memoryCells)],
    ["budget.effects", text(input.budget.effects)],
    ["budget.transformedNodes", text(input.budget.transformedNodes)],
    ["policyRevision", text(input.policyRevision)],
    ["observableProjectionId", text(input.observableProjectionId)],
    ["participantCount", text(participants.length)],
    ...participants.flatMap((participant, index) => [
      [`participants.${index}.handlerId`, text(participant.handlerId)] as const,
      [`participants.${index}.contractVersion`, text(participant.contractVersion)] as const,
      [
        `participants.${index}.implementationRevision`,
        text(participant.implementationRevision),
      ] as const,
    ]),
  ];
}

function memoryFields(): readonly (readonly [string, Uint8Array])[] {
  return [
    ["schemaVersion", text(initialMemory.schemaVersion)],
    ["cellCount", text(initialMemory.cells.length)],
    ...initialMemory.cells.flatMap((cell, index) => [
      [`cells.${index}.address`, text(cell.address)] as const,
      [`cells.${index}.value`, text(cell.value)] as const,
    ]),
  ];
}

function sha256(preimage: Uint8Array): Digest {
  return `sha256:${createHash("sha256").update(preimage).digest("hex")}`;
}

function wireBytes(value: unknown): Uint8Array {
  return encoder.encode(
    JSON.stringify(value, (_key, member: unknown) =>
      typeof member === "bigint" ? member.toString(10) : member,
    ),
  );
}

export async function createOracleReplayIdentityFixture() {
  const oracle = await createOracleContractsSpecFixture();
  const source = oracle.runtimeValid;
  const envelopeBytes = wireBytes(source.sourceProvenance);
  const changedSource = source.generatedCase.sourceBytes.slice();
  changedSource[changedSource.length - 1] = (changedSource[changedSource.length - 1] ?? 0) ^ 1;
  return Object.freeze({
    envelopeBytes,
    registry: source.registry,
    sourceProvenance: source.sourceProvenance,
    sourceContent: source.generatedCase.sourceBytes,
    changedSource,
  });
}

const sourcePreimage = canonicalPreimage("blend65-oracle-source-content-v1", [
  ["content", sourceContent],
]);
const transformedPreimage = canonicalPreimage("blend65-oracle-transformed-content-v1", [
  ["content", transformedContent],
]);
const memoryPreimage = canonicalPreimage("blend65-oracle-initial-memory-v1", memoryFields());
const evaluationPreimage = canonicalPreimage(
  "blend65-oracle-evaluation-v1",
  evaluationFields(evaluationInput),
);

if (
  sha256(sourcePreimage) !==
    "sha256:add938cb04f8efc3171efbff6a5d7f5f00f9a3e45eef4b1b77fda6c3ed52681a" ||
  sha256(transformedPreimage) !==
    "sha256:437aba703668d086f61f8bfca9520dba026c61e363bda57b44ebbf302ad3c946" ||
  sha256(memoryPreimage) !==
    "sha256:5de5deb6d5497e4d809d43425475cf11c496ac85e4b9048d8b9fe51466116729" ||
  sha256(evaluationPreimage) !==
    "sha256:a570eee0ab2be9b6bc73c62fe962eda0a588b65c5dcc07b95f03045cddcf7aec"
) {
  throw new TypeError("canonical identity fixture does not match its published digests");
}

export const oracleIdentityVectors = Object.freeze({
  source: Object.freeze({
    input: sourceContent,
    preimage: sourcePreimage,
    identity: "sha256:add938cb04f8efc3171efbff6a5d7f5f00f9a3e45eef4b1b77fda6c3ed52681a",
  }),
  transformed: Object.freeze({
    input: transformedContent,
    preimage: transformedPreimage,
    identity: "sha256:437aba703668d086f61f8bfca9520dba026c61e363bda57b44ebbf302ad3c946",
  }),
  memory: Object.freeze({
    input: initialMemory,
    preimage: memoryPreimage,
    identity: "sha256:5de5deb6d5497e4d809d43425475cf11c496ac85e4b9048d8b9fe51466116729",
  }),
  evaluation: Object.freeze({
    input: evaluationInput,
    preimage: evaluationPreimage,
    identity: "sha256:a570eee0ab2be9b6bc73c62fe962eda0a588b65c5dcc07b95f03045cddcf7aec",
  }),
});

export const evaluationIdentityMutations = Object.freeze([
  {
    name: "replay provenance",
    mutate: (input: IdentityInput): IdentityInput => ({
      ...input,
      sourceProvenance: {
        ...input.sourceProvenance,
        caseIdentity: { ...input.sourceProvenance.caseIdentity, ordinal: 4 },
      },
    }),
  },
  {
    name: "source content",
    mutate: (input: IdentityInput): IdentityInput => ({
      ...input,
      sourceContentIdentity: digest("3"),
    }),
  },
  {
    name: "transformed content",
    mutate: (input: IdentityInput): IdentityInput => ({
      ...input,
      transformedContentIdentity: digest("4"),
    }),
  },
  {
    name: "relation",
    mutate: (input: IdentityInput): IdentityInput => ({
      ...input,
      relationId: "relation.identifier-renaming",
    }),
  },
  {
    name: "entry function",
    mutate: (input: IdentityInput): IdentityInput => ({ ...input, entryFunction: "other" }),
  },
  {
    name: "initial memory",
    mutate: (input: IdentityInput): IdentityInput => ({
      ...input,
      initialMemoryIdentity: digest("5"),
    }),
  },
  {
    name: "diagnostic authority",
    mutate: (input: IdentityInput): IdentityInput => ({
      ...input,
      diagnosticManifestDigest: digest("6"),
    }),
  },
  {
    name: "binding authority",
    mutate: (input: IdentityInput): IdentityInput => ({
      ...input,
      bindingRejectionDigest: digest("7"),
    }),
  },
  {
    name: "budget",
    mutate: (input: IdentityInput): IdentityInput => ({
      ...input,
      budget: { ...input.budget, evaluationSteps: input.budget.evaluationSteps + 1n },
    }),
  },
  {
    name: "policy",
    mutate: (input: IdentityInput): IdentityInput => ({
      ...input,
      policyRevision: "oracle-policy-v2",
    }),
  },
  {
    name: "observable projection",
    mutate: (input: IdentityInput): IdentityInput => ({
      ...input,
      observableProjectionId: "projection.value-state.other-v1",
    }),
  },
  {
    name: "participant contract",
    mutate: (input: IdentityInput): IdentityInput => ({
      ...input,
      participants: [
        { ...input.participants[0]!, contractVersion: "1.0.1" },
        input.participants[1]!,
      ],
    }),
  },
  {
    name: "participant implementation",
    mutate: (input: IdentityInput): IdentityInput => ({
      ...input,
      participants: [
        { ...input.participants[0]!, implementationRevision: digest("8") },
        input.participants[1]!,
      ],
    }),
  },
]);
