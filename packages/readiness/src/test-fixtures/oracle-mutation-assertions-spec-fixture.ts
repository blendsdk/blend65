import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  oracleMutationCatalog,
  oracleMutationVectorIds,
} from "./oracle-mutation-canonical-vectors.js";
import { createSemanticRelationsSpecFixture } from "./semantic-relations-spec-fixture.js";

type ScalarType = "boolean" | "byte" | "sbyte" | "word" | "sword";
type IntegerType = Exclude<ScalarType, "boolean">;
type MutationFamily =
  | "evaluator-operation"
  | "diagnostic-mapping"
  | "transform-precondition"
  | "transform-rewrite"
  | "relation-comparator";

interface CatalogRow {
  readonly mutantId: string;
  readonly family: MutationFamily;
  readonly operationId: string;
  readonly pathId: string;
  readonly variantId: string;
  readonly vectorId: string;
}

const budget = Object.freeze({
  inputNodes: "128",
  expressionDepth: "32",
  evaluationSteps: "256",
  frames: "1",
  memoryCells: "64",
  effects: "64",
  transformedNodes: "256",
});

const emptyMemory = Object.freeze({ schemaVersion: 1, cells: Object.freeze([]) });

const integer = (type: IntegerType, value: bigint) =>
  Object.freeze({ kind: "integer", type, value: value.toString(10) });
const booleanValue = (value: boolean) => Object.freeze({ kind: "boolean", type: "boolean", value });
const literal = (type: ScalarType, value: bigint | boolean) =>
  Object.freeze({
    kind: "literal",
    type,
    value: typeof value === "bigint" ? value.toString(10) : value,
  });
const binary = (
  type: ScalarType,
  operator: string,
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
) => Object.freeze({ kind: "binary", type, operator, left, right });
const unary = (type: ScalarType, operator: string, operand: Readonly<Record<string, unknown>>) =>
  Object.freeze({ kind: "unary", type, operator, operand });
const memoryRead = (type: "byte" | "word", width: 1 | 2, address: bigint) =>
  Object.freeze({
    kind: "memory-read",
    type,
    width,
    address: literal("word", address),
  });

function program(
  returnType: ScalarType | "void",
  body: readonly Readonly<Record<string, unknown>>[],
  memory: Readonly<Record<string, unknown>> = emptyMemory,
) {
  return Object.freeze({
    schemaVersion: 1,
    module: Object.freeze({
      kind: "module",
      path: Object.freeze(["mutation_assertion"]),
      constants: Object.freeze([]),
      functions: Object.freeze([
        Object.freeze({
          kind: "function",
          name: "main",
          parameters: Object.freeze([]),
          returnType,
          body: Object.freeze(body),
        }),
      ]),
    }),
    entryFunction: "main",
    parameterBindings: Object.freeze([]),
    memory,
    budget,
  });
}

const returnProgram = (
  returnType: ScalarType,
  expression: Readonly<Record<string, unknown>>,
  memory?: Readonly<Record<string, unknown>>,
) => program(returnType, [Object.freeze({ kind: "return", value: expression })], memory);

function valueState(
  returnValue: Readonly<Record<string, unknown>> | null,
  effects: readonly Readonly<Record<string, unknown>>[] = [],
  finalMemory: readonly Readonly<Record<string, unknown>>[] = [],
) {
  return Object.freeze({
    ok: true,
    outcome: "modeled",
    observation: Object.freeze({
      kind: "value-state",
      returnValue,
      effects: Object.freeze(effects),
      finalMemory: Object.freeze(finalMemory),
    }),
    diagnostics: Object.freeze([]),
  });
}

function scalarFixture(
  expression: Readonly<Record<string, unknown>>,
  returnType: ScalarType,
  expected: Readonly<Record<string, unknown>>,
) {
  return {
    fixture: { kind: "program-evaluation", input: returnProgram(returnType, expression) },
    expected: valueState(expected),
  };
}

function memoryFixture(vectorId: string): {
  readonly fixture: Readonly<Record<string, unknown>>;
  readonly expected: unknown;
} {
  if (vectorId.endsWith("read-byte.v1")) {
    const memory = {
      schemaVersion: 1,
      cells: [{ address: "4096", value: "127" }],
    };
    return {
      fixture: {
        kind: "program-evaluation",
        input: returnProgram("byte", memoryRead("byte", 1, 4096n), memory),
      },
      expected: valueState(
        integer("byte", 127n),
        [{ ordinal: "0", kind: "read", width: 1, address: "4096", value: "127" }],
        [{ address: "4096", value: "127" }],
      ),
    };
  }
  if (vectorId.endsWith("read-word.v1")) {
    const memory = {
      schemaVersion: 1,
      cells: [
        { address: "4096", value: "52" },
        { address: "4097", value: "18" },
      ],
    };
    return {
      fixture: {
        kind: "program-evaluation",
        input: returnProgram("word", memoryRead("word", 2, 4096n), memory),
      },
      expected: valueState(
        integer("word", 4660n),
        [{ ordinal: "0", kind: "read", width: 2, address: "4096", value: "4660" }],
        memory.cells,
      ),
    };
  }
  const width = vectorId.endsWith("write-byte.v1") ? 1 : 2;
  const value = width === 1 ? 85n : 4660n;
  const memory = {
    schemaVersion: 1,
    cells:
      width === 1
        ? [{ address: "4096", value: "0" }]
        : [
            { address: "4096", value: "0" },
            { address: "4097", value: "0" },
          ],
  };
  return {
    fixture: {
      kind: "program-evaluation",
      input: program(
        "void",
        [
          {
            kind: "memory-write",
            width,
            address: literal("word", 4096n),
            value: literal(width === 1 ? "byte" : "word", value),
          },
        ],
        memory,
      ),
    },
    expected: valueState(
      null,
      [{ ordinal: "0", kind: "write", width, address: "4096", value: value.toString(10) }],
      width === 1
        ? [{ address: "4096", value: "85" }]
        : [
            { address: "4096", value: "52" },
            { address: "4097", value: "18" },
          ],
    ),
  };
}

function orderFixture(vectorId: string): {
  readonly fixture: Readonly<Record<string, unknown>>;
  readonly expected: unknown;
} {
  if (vectorId.endsWith("binary-operands.v1")) {
    const memory = {
      schemaVersion: 1,
      cells: [
        { address: "4096", value: "1" },
        { address: "4097", value: "2" },
      ],
    };
    return {
      fixture: {
        kind: "program-evaluation",
        input: returnProgram(
          "byte",
          binary("byte", "+", memoryRead("byte", 1, 4096n), memoryRead("byte", 1, 4097n)),
          memory,
        ),
      },
      expected: valueState(
        integer("byte", 3n),
        [
          { ordinal: "0", kind: "read", width: 1, address: "4096", value: "1" },
          { ordinal: "1", kind: "read", width: 1, address: "4097", value: "2" },
        ],
        memory.cells,
      ),
    };
  }
  if (vectorId.endsWith("memory-write-operands.v1")) {
    const memory = {
      schemaVersion: 1,
      cells: [
        { address: "4096", value: "0" },
        { address: "4097", value: "32" },
        { address: "4098", value: "85" },
        { address: "8192", value: "0" },
      ],
    };
    return {
      fixture: {
        kind: "program-evaluation",
        input: program(
          "void",
          [
            {
              kind: "memory-write",
              width: 1,
              address: memoryRead("word", 2, 4096n),
              value: memoryRead("byte", 1, 4098n),
            },
          ],
          memory,
        ),
      },
      expected: valueState(
        null,
        [
          { ordinal: "0", kind: "read", width: 2, address: "4096", value: "8192" },
          { ordinal: "1", kind: "read", width: 1, address: "4098", value: "85" },
          { ordinal: "2", kind: "write", width: 1, address: "8192", value: "85" },
        ],
        [
          { address: "4096", value: "0" },
          { address: "4097", value: "32" },
          { address: "4098", value: "85" },
          { address: "8192", value: "85" },
        ],
      ),
    };
  }
  const memory = {
    schemaVersion: 1,
    cells: [
      { address: "4096", value: "0" },
      { address: "4097", value: "0" },
    ],
  };
  return {
    fixture: {
      kind: "program-evaluation",
      input: program(
        "void",
        [
          {
            kind: "memory-write",
            width: 1,
            address: literal("word", 4096n),
            value: literal("byte", 1n),
          },
          {
            kind: "memory-write",
            width: 1,
            address: literal("word", 4097n),
            value: literal("byte", 2n),
          },
        ],
        memory,
      ),
    },
    expected: valueState(
      null,
      [
        { ordinal: "0", kind: "write", width: 1, address: "4096", value: "1" },
        { ordinal: "1", kind: "write", width: 1, address: "4097", value: "2" },
      ],
      [
        { address: "4096", value: "1" },
        { address: "4097", value: "2" },
      ],
    ),
  };
}

function evaluatorFixture(vectorId: string): {
  readonly fixture: Readonly<Record<string, unknown>>;
  readonly expected: unknown;
} {
  const scalar = new Map<string, ReturnType<typeof scalarFixture>>([
    [
      "vector.evaluator.binary.boolean.equal.v1",
      scalarFixture(
        binary("boolean", "==", literal("boolean", true), literal("boolean", true)),
        "boolean",
        booleanValue(true),
      ),
    ],
    [
      "vector.evaluator.binary.boolean.not-equal.v1",
      scalarFixture(
        binary("boolean", "!=", literal("boolean", true), literal("boolean", false)),
        "boolean",
        booleanValue(true),
      ),
    ],
    ...[
      ["add", "+", 5n, 3n, 8n],
      ["bitwise-and", "&", 15n, 3n, 3n],
      ["bitwise-or", "|", 1n, 2n, 3n],
      ["bitwise-xor", "^", 3n, 1n, 2n],
      ["divide", "/", 9n, 2n, 4n],
      ["multiply", "*", 3n, 4n, 12n],
      ["remainder", "%", 9n, 4n, 1n],
      ["subtract", "-", 5n, 3n, 2n],
      ["shift-left", "<<", 1n, 2n, 4n],
      ["shift-right", ">>", 8n, 2n, 2n],
    ].map(
      ([name, operator, left, right, expected]) =>
        [
          `vector.evaluator.binary.integer.${name}.v1`.replace(".integer.shift", ".shift"),
          scalarFixture(
            binary(
              "word",
              String(operator),
              literal("word", left as bigint),
              literal("word", right as bigint),
            ),
            "word",
            integer("word", expected as bigint),
          ),
        ] as const,
    ),
    ...[
      ["equal", "==", 3n, 3n],
      ["greater", ">", 3n, 2n],
      ["greater-equal", ">=", 3n, 3n],
      ["less", "<", 2n, 3n],
      ["less-equal", "<=", 3n, 3n],
      ["not-equal", "!=", 3n, 2n],
    ].map(
      ([name, operator, left, right]) =>
        [
          `vector.evaluator.binary.integer.${name}.v1`,
          scalarFixture(
            binary(
              "boolean",
              String(operator),
              literal("word", left as bigint),
              literal("word", right as bigint),
            ),
            "boolean",
            booleanValue(true),
          ),
        ] as const,
    ),
    ...[
      ["byte", "byte", 255n, 1n, 0n],
      ["sbyte", "sbyte", 127n, 1n, -128n],
      ["sword", "sword", 32_767n, 1n, -32_768n],
      ["word", "word", 65_535n, 1n, 0n],
    ].map(
      ([name, type, left, right, expected]) =>
        [
          `vector.evaluator.normalize.${name}.v1`,
          scalarFixture(
            binary(
              type as ScalarType,
              "+",
              literal(type as ScalarType, left as bigint),
              literal(type as ScalarType, right as bigint),
            ),
            type as ScalarType,
            integer(type as IntegerType, expected as bigint),
          ),
        ] as const,
    ),
    [
      "vector.evaluator.unary.bitwise-not.v1",
      scalarFixture(unary("byte", "~", literal("byte", 0n)), "byte", integer("byte", 255n)),
    ],
    [
      "vector.evaluator.unary.logical-not.v1",
      scalarFixture(
        unary("boolean", "!", literal("boolean", false)),
        "boolean",
        booleanValue(true),
      ),
    ],
    [
      "vector.evaluator.unary.negate.v1",
      scalarFixture(unary("sword", "-", literal("sword", 5n)), "sword", integer("sword", -5n)),
    ],
  ]);
  const direct = scalar.get(vectorId);
  if (direct !== undefined) return direct;
  if (vectorId.includes(".memory.")) return memoryFixture(vectorId);
  if (vectorId.includes(".order.")) return orderFixture(vectorId);
  throw new TypeError(`missing evaluator assertion ${vectorId}`);
}

const rules = Object.freeze({
  boolean: "rule.ch02.2-primitive-types.boolean.range.true",
  byte: "rule.ch02.2-primitive-types.byte.range.0-255",
  sbyte: "rule.ch02.2-primitive-types.sbyte.range.128-127",
  sword: "rule.ch02.2-primitive-types.sword.range.32768-32767",
  word: "rule.ch02.2-primitive-types.word.range.0-65535",
  peek: "rule.ch12.3-1-memory-access.peek-addr.signature.word",
  peekw: "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
  poke: "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
  pokew: "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
});

function ruleForNeighbor(neighborId: string): string {
  if (neighborId.includes(".boolean.")) return rules.boolean;
  if (neighborId.includes(".sbyte.")) return rules.sbyte;
  if (neighborId.includes(".sword.")) return rules.sword;
  if (neighborId.includes(".byte.")) return rules.byte;
  if (neighborId.includes(".word.")) return rules.word;
  if (neighborId.includes(".peekw.")) return rules.peekw;
  if (neighborId.includes(".peek.")) return rules.peek;
  if (neighborId.includes(".pokew.")) return rules.pokew;
  if (neighborId.includes(".poke.")) return rules.poke;
  throw new TypeError(`unknown neighbor ${neighborId}`);
}

function diagnosticCode(neighborId: string): string {
  if (neighborId.includes("wrong-arity")) return "E10041";
  if (neighborId.includes("above-max") || neighborId.includes("below-min")) return "E10084";
  if (neighborId.endsWith("wrong-type.initializer")) return "E10152";
  return "E10172";
}

function mappingFixture(row: CatalogRow) {
  const marker = row.pathId.indexOf("neighbor.");
  const suffix = row.pathId.slice(marker);
  const context = suffix.endsWith(".initializer")
    ? "initializer"
    : suffix.endsWith(".return-expression")
      ? "return-expression"
      : undefined;
  const neighborId = suffix
    .replace(/\.parameter$/u, "")
    .replace(/\.initializer$/u, "")
    .replace(/\.return-expression$/u, "");
  if (row.operationId === "binding-rejection.mapping") {
    return {
      fixture: {
        kind: "binding-rejection-mapping",
        ruleId: ruleForNeighbor(neighborId),
        neighborId,
        parameterPath: "/functions/0/parameters/0",
      },
      expected: {
        kind: "binding-rejection-mapping",
        rejectionCode: neighborId.includes(".boolean.")
          ? "binding.value.type-invalid"
          : "binding.value.range-invalid",
      },
    };
  }
  return {
    fixture: {
      kind: "diagnostic-mapping",
      ruleId: ruleForNeighbor(neighborId),
      neighborId,
      ...(context === undefined ? {} : { diagnosticContext: context }),
    },
    expected: { kind: "diagnostic-mapping", diagnosticCode: diagnosticCode(suffix) },
  };
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function relationSelection(row: CatalogRow): { readonly path: string; readonly variant: string } {
  const inapplicable = row.family === "transform-precondition";
  switch (row.operationId) {
    case "relation.identifier-renaming":
      return {
        path: inapplicable ? "/functions/0/body/999" : "/functions/0/parameters/0",
        variant: "fresh-sibling-v1",
      };
    case "relation.literal-to-local":
      return {
        path: inapplicable ? "/functions/0/body/0/initializer" : "/functions/0/body/1/initializer",
        variant: "introduce-local-v1",
      };
    case "relation.local-to-parameter":
      return {
        path: inapplicable ? "/functions/0/body/2" : "/functions/0/body/0",
        variant: "lift-entry-local-v1",
      };
    case "relation.independent-declaration-reordering":
      return {
        path: inapplicable ? "/constants/2" : "/constants/0",
        variant: "swap-independent-constants-v1",
      };
    case "relation.algebraic-identity": {
      const suffix = row.vectorId.match(/rewrite\.([^.]+)\.v1$/u)?.[1];
      return {
        path: inapplicable ? "/functions/0/body/4" : "/functions/0/body/10/initializer",
        variant: suffix ?? "add-zero-right",
      };
    }
    default:
      throw new TypeError(`unknown relation ${row.operationId}`);
  }
}

async function relationContext(authorityRoot: URL) {
  const fixture = await createSemanticRelationsSpecFixture();
  const source = fixture.valid;
  const [inventory, seed, ruleModel, review, diagnostic, binding] = await Promise.all([
    readFile(new URL("inventory/compiler-readiness-v1.json", authorityRoot)),
    readFile(new URL("rule-models/rule-model-seed-v1.json", authorityRoot)),
    readFile(new URL("rule-models/rule-models-v1.json", authorityRoot)),
    readFile(new URL("reviews/rule-models-v1-review.json", authorityRoot)),
    readFile(new URL("oracles/diagnostic-oracle-v1.json", authorityRoot)),
    readFile(new URL("oracles/binding-rejections-v1.json", authorityRoot)),
  ]);
  const campaign = source.sourceProvenance.campaign;
  return {
    source,
    budget: fixture.budget,
    suite: {
      schemaVersion: 1,
      suiteId: "oracle-suite.phase4-mutation-v1",
      inventoryDigest: sha256(inventory),
      seedContractDigest: sha256(seed),
      ruleModelDigest: sha256(ruleModel),
      ruleModelReviewDigest: sha256(review),
      diagnosticManifestDigest: sha256(diagnostic),
      bindingRejectionDigest: sha256(binding),
      replayRevisions: {
        inventory: campaign.inventoryDigest,
        ruleModel: campaign.ruleModelDigest,
        generator: campaign.generator.implementationRevision,
        boundaryTransform: campaign.boundaryTransform.implementationRevision,
        renderer: campaign.rendererRevision,
        configuration: campaign.configurationDigest,
      },
    },
  };
}

const relationObservation = Object.freeze({
  kind: "value-state",
  returnValue: integer("word", 8n),
  effects: Object.freeze([
    Object.freeze({
      ordinal: "0",
      kind: "read",
      width: 1,
      address: "4096",
      value: "4",
    }),
  ]),
  finalMemory: Object.freeze([{ address: "4096", value: "4" }]),
});

async function relationFixture(
  row: CatalogRow,
  context: Awaited<ReturnType<typeof relationContext>>,
) {
  const selection = relationSelection(row);
  const request = {
    schemaVersion: 1,
    handlerId: "transform.semantic-relations",
    relationId: row.operationId,
    sourceProvenance: context.source.sourceProvenance,
    sourceCase: context.source.sourceCase,
    entryFunction: context.source.entryFunction,
    selectionPath: selection.path,
    variantId: selection.variant,
    memory: context.source.memory,
    budget: context.budget,
  };
  return {
    fixture: { kind: "semantic-relation", suite: context.suite, request },
    expected:
      row.family === "transform-precondition"
        ? { kind: "semantic-relation-inapplicable", relationId: row.operationId }
        : {
            kind: "semantic-relation-modeled",
            relationId: row.operationId,
            sourceObservation: relationObservation,
            transformedObservation: relationObservation,
          },
  };
}

function catalogRows(): readonly CatalogRow[] {
  return oracleMutationCatalog.mutants.map(
    ({ mutantId, family, operationId, pathId, variantId }, index) => ({
      mutantId,
      family,
      operationId,
      pathId,
      variantId,
      vectorId: oracleMutationVectorIds[index]!,
    }),
  );
}

export async function createOracleMutationAssertionsSpecFixture() {
  const rows = catalogRows();
  const authorityRoot = new URL("../../../../readiness/", import.meta.url);
  const relation = await relationContext(authorityRoot);
  const assertions = await Promise.all(
    rows.map(async (row) => {
      const vector =
        row.family === "evaluator-operation"
          ? evaluatorFixture(row.vectorId)
          : row.family === "diagnostic-mapping"
            ? mappingFixture(row)
            : await relationFixture(row, relation);
      return {
        vectorId: row.vectorId,
        family: row.family,
        fixture: vector.fixture,
        assertion: { kind: "exact-observation", expected: vector.expected },
      };
    }),
  );
  return Object.freeze({
    schemaVersion: 1,
    packetVersion: "1.0.0",
    rows: Object.freeze(assertions),
    selections: Object.freeze(
      rows.map(({ mutantId, operationId, pathId, variantId }) =>
        Object.freeze({ mutantId, operationId, pathId, variantId }),
      ),
    ),
  });
}
