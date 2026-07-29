type Digest = `sha256:${string}`;

export interface PublishedOracleRequestIntentV1 {
  readonly schemaVersion: 1;
  readonly handlerId: "oracle.frontend-result";
  readonly ruleId: "rule.ch02.2-primitive-types.word.range.0-65535";
  readonly seed: Digest;
  readonly configuration: {
    readonly caseCount: 16;
    readonly maxInvalidCases: 0;
    readonly enabledRuleIds: readonly ["rule.ch02.2-primitive-types.word.range.0-65535"];
    readonly spellings: readonly ["parameter"];
    readonly budget: {
      readonly maxModules: 2;
      readonly maxDeclarations: 128;
      readonly maxIrNodes: 512;
      readonly maxStatements: 128;
      readonly maxExpressionDepth: 16;
      readonly maxLoopWork: 1n;
      readonly maxSourceBytes: 65_536;
      readonly maxAttempts: 32;
    };
  };
  readonly ordinal: 0;
  readonly memory: {
    readonly schemaVersion: 1;
    readonly cells: readonly [{ readonly address: 4096n; readonly value: 4n }];
  };
  readonly budget: {
    readonly inputNodes: 4096n;
    readonly expressionDepth: 32n;
    readonly evaluationSteps: 16_384n;
    readonly frames: 16n;
    readonly memoryCells: 256n;
    readonly effects: 256n;
    readonly transformedNodes: 8192n;
  };
  readonly observable: { readonly kind: "value-state" };
}

export const PUBLISHED_ORACLE_REQUEST_INTENT: PublishedOracleRequestIntentV1 = Object.freeze({
  schemaVersion: 1,
  handlerId: "oracle.frontend-result",
  ruleId: "rule.ch02.2-primitive-types.word.range.0-65535",
  seed: `sha256:${"1".repeat(64)}`,
  configuration: Object.freeze({
    caseCount: 16,
    maxInvalidCases: 0,
    enabledRuleIds: Object.freeze(["rule.ch02.2-primitive-types.word.range.0-65535"] as const),
    spellings: Object.freeze(["parameter"] as const),
    budget: Object.freeze({
      maxModules: 2,
      maxDeclarations: 128,
      maxIrNodes: 512,
      maxStatements: 128,
      maxExpressionDepth: 16,
      maxLoopWork: 1n,
      maxSourceBytes: 65_536,
      maxAttempts: 32,
    }),
  }),
  ordinal: 0,
  memory: Object.freeze({
    schemaVersion: 1,
    cells: Object.freeze([Object.freeze({ address: 4096n, value: 4n })] as const),
  }),
  budget: Object.freeze({
    inputNodes: 4096n,
    expressionDepth: 32n,
    evaluationSteps: 16_384n,
    frames: 16n,
    memoryCells: 256n,
    effects: 256n,
    transformedNodes: 8192n,
  }),
  observable: Object.freeze({ kind: "value-state" }),
});
