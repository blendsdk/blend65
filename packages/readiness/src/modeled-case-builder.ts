import type { GenerationSpelling } from "./canonical-identity.js";
import {
  isGenIdentifier,
  type GenConst,
  type GenExpression,
  type GenFunction,
  type GenIdentifier,
  type GenModule,
  type GenParameter,
  type GenStatement,
  type ScalarType,
} from "./generator-ir.js";
import type { MemoryRuleFact, ModeledRuleFact, ScalarRuleFact } from "./modeled-generator-facts.js";
import type {
  MemoryCaseChoice,
  ModeledCaseChoice,
  ScalarCaseChoice,
} from "./modeled-generator-model.js";

interface ValueBinding {
  readonly expression: GenExpression;
  readonly constants: readonly GenConst[];
  readonly parameters: readonly GenParameter[];
  readonly statements: readonly GenStatement[];
}

function identifier(value: string): GenIdentifier {
  if (!isGenIdentifier(value)) {
    throw new TypeError("Internal modeled-generator identifier is invalid.");
  }
  return value;
}

function literal(type: ScalarType, value: bigint): GenExpression {
  return Object.freeze({ kind: "literal", type, value });
}

function choiceValue(value: bigint | boolean): bigint {
  return typeof value === "boolean" ? (value ? 1n : 0n) : value;
}

function bindValue(
  spelling: GenerationSpelling,
  type: ScalarType,
  value: bigint,
  nameStem: string,
): ValueBinding {
  const name = identifier(nameStem);
  const valueExpression = literal(type, value);
  if (spelling === "literal") {
    return {
      expression: valueExpression,
      constants: [],
      parameters: [],
      statements: [],
    };
  }
  const expression: GenExpression = Object.freeze({ kind: "name", type, name });
  if (spelling === "const") {
    return {
      expression,
      constants: [Object.freeze({ kind: "const", name, type, value: valueExpression })],
      parameters: [],
      statements: [],
    };
  }
  if (spelling === "parameter") {
    return {
      expression,
      constants: [],
      parameters: [Object.freeze({ name, type })],
      statements: [],
    };
  }
  return {
    expression,
    constants: [],
    parameters: [],
    statements: [Object.freeze({ kind: "local", name, type, initializer: valueExpression })],
  };
}

function buildScalarModule(
  fact: ScalarRuleFact,
  choice: ScalarCaseChoice,
  path: readonly GenIdentifier[],
): GenModule {
  const value = bindValue(
    choice.spelling,
    fact.scalarType,
    choiceValue(choice.value),
    "modeledValue",
  );
  const fn: GenFunction = Object.freeze({
    kind: "function",
    name: identifier("scalarCase"),
    parameters: Object.freeze([...value.parameters]),
    returnType: fact.scalarType,
    body: Object.freeze([
      ...value.statements,
      Object.freeze({ kind: "return", value: value.expression }),
    ]),
  });
  return Object.freeze({
    kind: "module",
    path,
    constants: Object.freeze([...value.constants]),
    functions: Object.freeze([fn]),
  });
}

function memoryAddress(choice: MemoryCaseChoice): ValueBinding {
  const base = bindValue(choice.addressSpelling, "word", 0xd020n, "modeledAddress");
  if (choice.addressForm === "direct") return base;
  return {
    ...base,
    expression: Object.freeze({
      kind: "binary",
      type: "word",
      operator: "+",
      left: base.expression,
      right: literal("word", 1n),
    }),
  };
}

function buildMemoryBody(
  fact: MemoryRuleFact,
  address: ValueBinding,
  value: ValueBinding | undefined,
): readonly GenStatement[] {
  const prefix = [...address.statements, ...(value?.statements ?? [])];
  if (fact.intrinsic === "peek" || fact.intrinsic === "peekw") {
    const readType = fact.intrinsic === "peek" ? "byte" : "word";
    const read: GenExpression = Object.freeze({
      kind: "memory-read",
      type: readType,
      width: fact.intrinsic === "peek" ? 1 : 2,
      address: address.expression,
    });
    return Object.freeze([...prefix, Object.freeze({ kind: "return", value: read })]);
  }
  if (value === undefined) {
    throw new TypeError("Memory-write modeled cases require a value.");
  }
  return Object.freeze([
    ...prefix,
    Object.freeze({
      kind: "memory-write",
      width: fact.intrinsic === "poke" ? 1 : 2,
      address: address.expression,
      value: value.expression,
    }),
    Object.freeze({ kind: "return" }),
  ]);
}

function buildMemoryModule(
  fact: MemoryRuleFact,
  choice: MemoryCaseChoice,
  path: readonly GenIdentifier[],
): GenModule {
  const address = memoryAddress(choice);
  const valueType = fact.parameterTypes[1];
  const value =
    valueType === undefined || choice.valueSpelling === undefined
      ? undefined
      : bindValue(
          choice.valueSpelling,
          valueType,
          valueType === "byte" ? 0x20n : 0x2000n,
          "modeledValue",
        );
  const parameters = Object.freeze([...address.parameters, ...(value?.parameters ?? [])]);
  const fn: GenFunction = Object.freeze({
    kind: "function",
    name: identifier("memoryCase"),
    parameters,
    returnType: fact.returnType,
    body: buildMemoryBody(fact, address, value),
  });
  return Object.freeze({
    kind: "module",
    path,
    constants: Object.freeze([...address.constants, ...(value?.constants ?? [])]),
    functions: Object.freeze([fn]),
  });
}

/**
 * Builds one valid independent generator-IR module from a canonical reviewed choice.
 *
 * @param fact Reviewed rule semantics.
 * @param choice Canonical choice from that rule's closed domain.
 * @param path Validated logical module path.
 * @returns A structurally typed module ready for independent validation.
 */
export function buildModeledModule(
  fact: ModeledRuleFact,
  choice: ModeledCaseChoice,
  path: readonly GenIdentifier[],
): GenModule {
  if (fact.kind === "scalar" && choice.kind === "scalar") {
    return buildScalarModule(fact, choice, path);
  }
  if (fact.kind === "memory" && choice.kind === "memory") {
    return buildMemoryModule(fact, choice, path);
  }
  throw new TypeError("Modeled fact and construction choice do not belong to the same domain.");
}
