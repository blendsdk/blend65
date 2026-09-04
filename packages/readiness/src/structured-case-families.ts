import type {
  GenArrayPlacementFixtureV1,
  GenArrayReferenceExpression,
  GenIdentifier,
  GenStructuredExpression,
  GenStructuredFunction,
  GenStructuredModule,
  GenStructuredParameter,
  GenStructuredStatement,
  StructuredGenerationBudgetV2,
} from "./generator-ir.js";
import { isGenIdentifier } from "./generator-ir.js";
import type {
  ParameterValueBinding,
  StructuredGeneratedModeledCaseV1,
} from "./modeled-generator-model.js";
import type {
  MemoryFixtureV1,
  OracleBudgetV1,
  OracleSuite,
  Rd02ReplayProvenanceV1,
} from "./oracle-model.js";
import { buildStructuredCaseRegistryV1 } from "./structured-case-registry.js";
import type { RuleId, Sha256Digest } from "./model-registry-model.js";

/** Stable published case identities in the first structured vertical. */
export type FirstVerticalCaseIdV1 =
  | "case.structured.branch-arms-v1"
  | "case.structured.invalid-condition-v1"
  | "case.structured.missing-return-v1"
  | "case.structured.while-zero-v1"
  | "case.structured.do-while-one-v1"
  | "case.structured.for-inclusive-extremes-v1"
  | "case.structured.for-until-v1"
  | "case.structured.call-argument-order-v1"
  | "case.structured.scalar-copy-v1"
  | "case.structured.scalar-signatures-v1"
  | "case.structured.scalar-returns-v1"
  | "case.structured.byte-array-index-v1"
  | "case.structured.constant-index-v1"
  | "case.structured.constant-oob-v1"
  | "case.structured.runtime-oob-public-v1"
  | "case.structured.runtime-wrap-oracle-v1";

/** Every authenticated case identity owned by the structured registry. */
export type StructuredCaseIdV1 =
  | FirstVerticalCaseIdV1
  | "case.structured.vertical-combined-v1"
  | "case.structured.loop-volatile-order-v1";

/** Closed program input consumed by the independent structured evaluator. */
export interface StructuredOracleProgramInputV2 {
  readonly schemaVersion: 2;
  readonly handlerId: "oracle.structured-program";
  readonly module: GenStructuredModule;
  readonly entryFunction: GenIdentifier;
  readonly parameterBindings: readonly ParameterValueBinding[];
  readonly memory: MemoryFixtureV1;
  readonly arrayPlacement?: GenArrayPlacementFixtureV1;
  readonly generationBudget: StructuredGenerationBudgetV2;
  readonly budget: OracleBudgetV1;
  readonly expectationAuthority: "independent-structured-oracle-v2";
}

/** Complete immutable authority resolved from one stable structured case ID. */
export interface StructuredCaseAuthorityV1 {
  readonly caseId: StructuredCaseIdV1;
  readonly caseDigest: Sha256Digest;
  readonly generatedCase: StructuredGeneratedModeledCaseV1;
  readonly sourceProvenance: Rd02ReplayProvenanceV1;
  readonly oracleSuite: OracleSuite;
  readonly oracleInput: StructuredOracleProgramInputV2;
  readonly relationSelectionPath?: string;
}

/** Result of resolving one structured case through the authenticated registry. */
export type StructuredCaseAuthorityResultV1 =
  | {
      readonly ok: true;
      readonly authority: StructuredCaseAuthorityV1;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly {
        readonly code: "structured-case.unknown" | "structured-case.unavailable";
        readonly path: "/caseId";
        readonly message: string;
      }[];
    };

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
/** Exact lexical rule population represented by the structured case registry. */
export const STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1 = Object.freeze([
  "rule.ch05.4-2-rules.both-body-else-body-blocks-cf",
  "rule.ch05.4-2-rules.e10100-condition-boolean-cf-2-divide",
  "rule.ch05.4-2-rules.e10102-all-code-paths-return-non",
  "rule.ch05.5-2-rules.condition-evaluated-before-each-iteration-false",
  "rule.ch05.6-2-rules.body-executes-least-once-condition-evaluated",
  "rule.ch05.7-2-direction-bounds.requirement.meaning.loop-visits-start-end",
  "rule.ch05.7-2-direction-bounds.until.meaning.loop-visits-start-end",
  "rule.ch06.fn-10.calling-function-multiple-arguments-argument-expressions",
  "rule.ch06.fn-2.callee-receives-copy-modifying-parameter-inside",
  "rule.ch06.fn-2.parameters-scalar-types-byte-sbyte-word",
  "rule.ch06.fn-4.functions-return-scalar-types-only",
  "rule.ch08.2-2-element-types.byte.size-per-element.1-byte",
  "rule.ch08.ar-8.compile-time-index-compile-time-constant",
  "rule.ch08.ar-8.out-bounds-constant-index-compile-error",
  "rule.ch08.ar-8.runtime-no-bounds-checking-default-too",
  "rule.ch08.ar-8.without-bounds-check-out-bounds-runtime",
] satisfies readonly RuleId[]);

function identifier(value: string): GenIdentifier {
  if (!isGenIdentifier(value)) throw new TypeError("Structured registry identifier is invalid.");
  return value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  for (const key of Reflect.ownKeys(value)) deepFreeze(Reflect.get(value, key));
  if (!Object.isFrozen(value)) Object.freeze(value);
  return value;
}

function literal(type: GenStructuredExpression["type"], value: bigint): GenStructuredExpression {
  return Object.freeze({ kind: "literal", type, value });
}

function name(type: GenStructuredExpression["type"], value: string): GenStructuredExpression {
  return Object.freeze({ kind: "name", type, name: identifier(value) });
}

function binary(
  type: GenStructuredExpression["type"],
  operator: "+" | ">",
  left: GenStructuredExpression,
  right: GenStructuredExpression,
): GenStructuredExpression {
  return Object.freeze({ kind: "binary", type, operator, left, right });
}

function call(
  type: GenStructuredExpression["type"],
  callee: string,
  argumentsValue: readonly (GenStructuredExpression | GenArrayReferenceExpression)[],
): GenStructuredExpression {
  return Object.freeze({
    kind: "call",
    type,
    callee: identifier(callee),
    arguments: argumentsValue,
  });
}

function scalarParameter(
  nameValue: string,
  type: GenStructuredExpression["type"],
): GenStructuredParameter {
  return Object.freeze({ kind: "scalar-parameter", name: identifier(nameValue), type });
}

function functionDeclaration(
  nameValue: string,
  parameters: readonly GenStructuredParameter[],
  returnType: GenStructuredFunction["returnType"],
  body: readonly GenStructuredStatement[],
): GenStructuredFunction {
  return Object.freeze({
    kind: "function",
    name: identifier(nameValue),
    parameters: Object.freeze([...parameters]),
    returnType,
    body: Object.freeze([...body]),
  });
}

function moduleValue(
  path: string,
  functions: readonly GenStructuredFunction[],
): GenStructuredModule {
  return Object.freeze({
    kind: "module",
    path: Object.freeze([identifier(path)]),
    constants: Object.freeze([]),
    functions: Object.freeze([...functions]),
  });
}

function returned(value?: GenStructuredExpression): GenStructuredStatement {
  return value === undefined
    ? Object.freeze({ kind: "return" })
    : Object.freeze({ kind: "return", value });
}

function local(
  nameValue: string,
  type: GenStructuredExpression["type"],
  initializer: GenStructuredExpression,
): GenStructuredStatement {
  return Object.freeze({ kind: "local", name: identifier(nameValue), type, initializer });
}

function assign(target: string, value: GenStructuredExpression): GenStructuredStatement {
  return Object.freeze({ kind: "assign", target: identifier(target), value });
}

function increment(target: string): GenStructuredStatement {
  return assign(target, binary("word", "+", name("word", target), literal("word", 1n)));
}

function memoryWrite(address: bigint, value: bigint): GenStructuredStatement {
  return Object.freeze({
    kind: "memory-write",
    width: 1,
    address: literal("word", address),
    value: literal("byte", value),
  });
}

function arrayDeclaration(nameValue = "values"): GenStructuredStatement {
  return Object.freeze({
    kind: "array",
    name: identifier(nameValue),
    elementType: "byte",
    extent: 4,
    initializer: Object.freeze([1n, 2n, 3n, 4n].map((value) => literal("byte", value))),
  });
}

function index(target: string, value: GenStructuredExpression): GenStructuredExpression {
  return Object.freeze({ kind: "index", type: "byte", target: identifier(target), index: value });
}

function forLoop(
  counter: string,
  direction: "until" | "to" | "downto",
  start: bigint,
  end: bigint,
  step: bigint,
  body: readonly GenStructuredStatement[],
): GenStructuredStatement {
  return Object.freeze({
    kind: "for",
    counter: identifier(counter),
    counterType: "byte",
    start: literal("byte", start),
    direction,
    end: literal("byte", end),
    step,
    body: Object.freeze([...body]),
  });
}

function arrayProgram(indexValue: GenStructuredExpression): GenStructuredModule {
  return moduleValue("StructuredArray", [
    functionDeclaration("main", [], "byte", [
      arrayDeclaration(),
      returned(index("values", indexValue)),
    ]),
  ]);
}

function runtimeArrayProgram(): GenStructuredModule {
  return moduleValue("StructuredRuntimeArray", [
    functionDeclaration("read", [scalarParameter("i", "byte")], "byte", [
      arrayDeclaration(),
      returned(index("values", name("byte", "i"))),
    ]),
    functionDeclaration("main", [], "void", [returned()]),
  ]);
}

function branchProgram(condition: GenStructuredExpression): GenStructuredModule {
  return moduleValue("StructuredBranch", [
    functionDeclaration("main", [], "byte", [
      Object.freeze({
        kind: "if",
        condition,
        thenBody: Object.freeze([returned(literal("byte", 1n))]),
        elseBody: Object.freeze([returned(literal("byte", 2n))]),
      }),
    ]),
  ]);
}

function loopProgram(direction: "until" | "to", end: bigint): GenStructuredModule {
  return moduleValue("StructuredLoop", [
    functionDeclaration("main", [], "word", [
      local("count", "word", literal("word", 0n)),
      forLoop("i", direction, 0n, end, 1n, [increment("count")]),
      returned(name("word", "count")),
    ]),
  ]);
}

function callProgram(): GenStructuredModule {
  return moduleValue("StructuredCalls", [
    functionDeclaration(
      "add",
      [scalarParameter("a", "byte"), scalarParameter("b", "byte")],
      "byte",
      [returned(binary("byte", "+", name("byte", "a"), name("byte", "b")))],
    ),
    functionDeclaration("main", [], "byte", [
      returned(call("byte", "add", [literal("byte", 1n), literal("byte", 2n)])),
    ]),
  ]);
}

function callArgumentOrderProgram(): GenStructuredModule {
  return moduleValue("CallArgumentOrder", [
    functionDeclaration("first", [], "byte", [
      memoryWrite(0xc000n, 1n),
      returned(literal("byte", 1n)),
    ]),
    functionDeclaration("second", [], "byte", [
      memoryWrite(0xc001n, 2n),
      returned(literal("byte", 2n)),
    ]),
    functionDeclaration(
      "selectSecond",
      [scalarParameter("a", "byte"), scalarParameter("b", "byte")],
      "byte",
      [returned(name("byte", "b"))],
    ),
    functionDeclaration("main", [], "byte", [
      returned(
        call("byte", "selectSecond", [call("byte", "first", []), call("byte", "second", [])]),
      ),
    ]),
  ]);
}

function scalarCopyProgram(): GenStructuredModule {
  return moduleValue("ScalarCopy", [
    functionDeclaration("mutate", [scalarParameter("input", "byte")], "byte", [
      assign("input", literal("byte", 9n)),
      returned(name("byte", "input")),
    ]),
    functionDeclaration("main", [], "byte", [
      local("original", "byte", literal("byte", 4n)),
      local("calleeResult", "byte", call("byte", "mutate", [name("byte", "original")])),
      returned(name("byte", "original")),
    ]),
  ]);
}

function scalarSignaturesProgram(): GenStructuredModule {
  const scalarTypes = ["boolean", "byte", "sbyte", "word", "sword"] as const;
  return moduleValue("ScalarSignatures", [
    ...scalarTypes.map((type) =>
      functionDeclaration(`identity${type}`, [scalarParameter("input", type)], type, [
        returned(name(type, "input")),
      ]),
    ),
    functionDeclaration("main", [], "byte", [
      returned(call("byte", "identitybyte", [literal("byte", 7n)])),
    ]),
  ]);
}

function scalarReturnsProgram(): GenStructuredModule {
  return moduleValue("ScalarReturns", [
    functionDeclaration("returnboolean", [], "boolean", [returned(literal("boolean", 1n))]),
    functionDeclaration("returnbyte", [], "byte", [returned(literal("byte", 255n))]),
    functionDeclaration("returnsbyte", [], "sbyte", [returned(literal("sbyte", -128n))]),
    functionDeclaration("returnword", [], "word", [returned(literal("word", 65_535n))]),
    functionDeclaration("returnsword", [], "sword", [returned(literal("sword", -32_768n))]),
    functionDeclaration("main", [], "word", [returned(call("word", "returnword", []))]),
  ]);
}

function combinedProgram(): GenStructuredModule {
  const values = arrayDeclaration();
  const totalUpdate = assign(
    "total",
    binary("byte", "+", name("byte", "total"), index("values", name("byte", "i"))),
  );
  const nestedUpdate = assign("total", call("byte", "nested", [name("byte", "total")]));
  return moduleValue("ReadinessVertical", [
    ...callProgram().functions.slice(0, 1),
    functionDeclaration("nested", [scalarParameter("v", "byte")], "byte", [
      returned(
        call("byte", "add", [
          call("byte", "add", [name("byte", "v"), literal("byte", 1n)]),
          literal("byte", 2n),
        ]),
      ),
    ]),
    functionDeclaration("main", [], "void", [
      values,
      local("total", "byte", literal("byte", 0n)),
      forLoop("i", "to", 0n, 3n, 1n, [
        Object.freeze({
          kind: "if",
          condition: binary(
            "boolean",
            ">",
            index("values", name("byte", "i")),
            literal("byte", 1n),
          ),
          thenBody: Object.freeze([totalUpdate]),
          elseBody: Object.freeze([nestedUpdate]),
        }),
      ]),
      Object.freeze({
        kind: "memory-write",
        width: 1,
        address: literal("word", 0xc000n),
        value: name("byte", "total"),
      }),
      returned(),
    ]),
  ]);
}

/** One reviewed structured case definition before identity and provenance are attached. */
export interface StructuredCaseDefinitionV1 {
  readonly caseId: StructuredCaseIdV1;
  readonly ruleId: RuleId;
  readonly module: GenStructuredModule;
  readonly validity?: StructuredGeneratedModeledCaseV1["validity"];
  readonly entryFunction?: string;
  readonly relationSelectionPath?: string;
  readonly arrayPlacement?: GenArrayPlacementFixtureV1;
  readonly parameterBindings?: readonly ParameterValueBinding[];
}

/**
 * Builds the finite reviewed program definitions retained by the case registry.
 *
 * @returns Immutable array, call, branch, loop, and combined program definitions.
 *
 * @example
 * ```ts
 * const definitions = createStructuredCaseDefinitionsV1();
 * ```
 */
export function createStructuredCaseDefinitionsV1(): readonly StructuredCaseDefinitionV1[] {
  const invalidCondition = branchProgram(literal("byte", 1n));
  const missingReturn = moduleValue("MissingReturn", [
    functionDeclaration("main", [scalarParameter("flag", "boolean")], "byte", [
      Object.freeze({
        kind: "if",
        condition: name("boolean", "flag"),
        thenBody: Object.freeze([returned(literal("byte", 1n))]),
        elseBody: Object.freeze([]),
      }),
    ]),
  ]);
  const whileZero = moduleValue("WhileZero", [
    functionDeclaration("main", [], "byte", [
      local("count", "byte", literal("byte", 0n)),
      Object.freeze({ kind: "while", condition: literal("boolean", 0n), body: Object.freeze([]) }),
      returned(name("byte", "count")),
    ]),
  ]);
  const doWhileOne = moduleValue("DoWhileOne", [
    functionDeclaration("main", [], "byte", [
      local("count", "byte", literal("byte", 0n)),
      Object.freeze({
        kind: "do-while",
        body: Object.freeze([
          assign("count", binary("byte", "+", name("byte", "count"), literal("byte", 1n))),
        ]),
        condition: literal("boolean", 0n),
      }),
      returned(name("byte", "count")),
    ]),
  ]);
  const pureLoop = loopProgram("to", 255n);
  const volatileLoop = moduleValue("VolatileLoop", [
    functionDeclaration("main", [], "word", [
      local("count", "word", literal("word", 0n)),
      forLoop("i", "to", 0n, 255n, 1n, [
        Object.freeze({
          kind: "memory-write",
          width: 1,
          address: literal("word", 0xc000n),
          value: name("byte", "i"),
        }),
        increment("count"),
      ]),
      returned(name("word", "count")),
    ]),
  ]);
  const constantOob = arrayProgram(literal("byte", 4n));
  const computedOob = runtimeArrayProgram();
  const runtimeIndexBinding = Object.freeze([
    Object.freeze({
      kind: "parameter-value" as const,
      parameterPath: "/functions/0/parameters/0",
      value: 0x20n,
    }),
  ]);
  const definitions: StructuredCaseDefinitionV1[] = [
    {
      caseId: "case.structured.branch-arms-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[0]!,
      module: branchProgram(literal("boolean", 1n)),
    },
    {
      caseId: "case.structured.invalid-condition-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[1]!,
      module: invalidCondition,
      validity: {
        kind: "invalid",
        neighborId: "neighbor.condition",
        violatedPredicateId: "predicate.condition",
        expectedDiagnosticFamily: "condition-boolean",
      },
    },
    {
      caseId: "case.structured.missing-return-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[2]!,
      module: missingReturn,
      validity: {
        kind: "invalid",
        neighborId: "neighbor.return",
        violatedPredicateId: "predicate.return",
        expectedDiagnosticFamily: "all-code-paths-return",
      },
    },
    {
      caseId: "case.structured.while-zero-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[3]!,
      module: whileZero,
    },
    {
      caseId: "case.structured.do-while-one-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[4]!,
      module: doWhileOne,
    },
    {
      caseId: "case.structured.for-inclusive-extremes-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[5]!,
      module: pureLoop,
      relationSelectionPath: "/functions/0/body/1",
    },
    {
      caseId: "case.structured.for-until-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[6]!,
      module: loopProgram("until", 3n),
    },
    {
      caseId: "case.structured.call-argument-order-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[7]!,
      module: callArgumentOrderProgram(),
    },
    {
      caseId: "case.structured.scalar-copy-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[8]!,
      module: scalarCopyProgram(),
    },
    {
      caseId: "case.structured.scalar-signatures-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[9]!,
      module: scalarSignaturesProgram(),
    },
    {
      caseId: "case.structured.scalar-returns-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[10]!,
      module: scalarReturnsProgram(),
    },
    {
      caseId: "case.structured.byte-array-index-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[11]!,
      module: arrayProgram(literal("byte", 2n)),
    },
    {
      caseId: "case.structured.constant-index-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[12]!,
      module: arrayProgram(literal("byte", 2n)),
    },
    {
      caseId: "case.structured.constant-oob-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[13]!,
      module: constantOob,
      validity: {
        kind: "invalid",
        neighborId: "neighbor.array-index",
        violatedPredicateId: "predicate.array-index",
        expectedDiagnosticFamily: "array-index-constant-out-of-range",
      },
    },
    {
      caseId: "case.structured.runtime-oob-public-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[14]!,
      module: computedOob,
      entryFunction: "read",
      parameterBindings: runtimeIndexBinding,
    },
    {
      caseId: "case.structured.runtime-wrap-oracle-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[15]!,
      module: computedOob,
      entryFunction: "read",
      parameterBindings: runtimeIndexBinding,
      arrayPlacement: {
        revision: "structured-array-placement-v1",
        bindings: [{ arrayName: identifier("values"), baseAddress: 0xfff0 }],
      },
    },
    {
      caseId: "case.structured.vertical-combined-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[5]!,
      module: combinedProgram(),
    },
    {
      caseId: "case.structured.loop-volatile-order-v1",
      ruleId: STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1[5]!,
      module: volatileLoop,
      relationSelectionPath: "/functions/0/body/1",
    },
  ];
  return deepFreeze(definitions);
}

const STRUCTURED_CASES = buildStructuredCaseRegistryV1();

/**
 * Resolves the structured authority created with one opaque oracle capability.
 *
 * @param suite Candidate oracle capability.
 * @returns Matching authenticated authority, when present.
 */
export function structuredCaseAuthorityForSuiteV1(
  suite: OracleSuite,
): StructuredCaseAuthorityV1 | undefined {
  return [...STRUCTURED_CASES.values()].find((authority) => authority.oracleSuite === suite);
}

/**
 * Resolves one stable structured case without accepting caller-supplied case or oracle data.
 *
 * @param caseId Unknown stable case identity.
 * @returns A fresh authority projection or a deterministic unknown-case diagnostic.
 *
 * @example
 * ```ts
 * const result = resolveStructuredCaseAuthorityV1("case.structured.vertical-combined-v1");
 * ```
 */
export function resolveStructuredCaseAuthorityV1(caseId: unknown): StructuredCaseAuthorityResultV1 {
  if (typeof caseId !== "string") {
    return Object.freeze({
      ok: false,
      diagnostics: Object.freeze([
        Object.freeze({
          code: "structured-case.unknown" as const,
          path: "/caseId" as const,
          message: "Structured case ID is unknown.",
        }),
      ]),
    });
  }
  const authority = STRUCTURED_CASES.get(caseId);
  if (authority === undefined) {
    return Object.freeze({
      ok: false,
      diagnostics: Object.freeze([
        Object.freeze({
          code: "structured-case.unknown" as const,
          path: "/caseId" as const,
          message: "Structured case ID is unknown.",
        }),
      ]),
    });
  }
  return Object.freeze({
    ok: true,
    authority: Object.freeze({ ...authority }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
