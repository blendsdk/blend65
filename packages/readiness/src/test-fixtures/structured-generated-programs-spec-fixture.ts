import type { validateStructuredGenerationBudgetV2 } from "../generation-budget.js";

type StructuredGenerationBudgetV2 = Extract<
  ReturnType<typeof validateStructuredGenerationBudgetV2>,
  { readonly ok: true }
>["budget"];

const literal = (type: string, value: bigint | boolean) =>
  ({ kind: "literal", type, value }) as const;
const name = (type: string, value: string) => ({ kind: "name", type, name: value }) as const;
const binary = (type: string, operator: string, left: object, right: object) =>
  ({ kind: "binary", type, operator, left, right }) as const;
const unary = (type: string, operator: string, operand: object) =>
  ({ kind: "unary", type, operator, operand }) as const;
const constant = (nameValue: string, type: string, value: object) =>
  ({ kind: "const", name: nameValue, type, value }) as const;
const local = (nameValue: string, type: string, initializer: object) =>
  ({ kind: "local", name: nameValue, type, initializer }) as const;
const assign = (target: string | object, value: object) =>
  ({ kind: "assign", target, value }) as const;
const returnValue = (value?: object) =>
  (value === undefined ? { kind: "return" } : { kind: "return", value }) as
    | { readonly kind: "return" }
    | { readonly kind: "return"; readonly value: object };
const scalarParameter = (nameValue: string, type: string) =>
  ({ kind: "scalar-parameter", name: nameValue, type }) as const;
const arrayType = (elementType: string, extent: number | null, access: "const" | "mutable") =>
  ({ kind: "array-type", elementType, extent, access }) as const;
const arrayParameter = (
  nameValue: string,
  elementType: string,
  extent: number | null,
  access: "const" | "mutable",
) =>
  ({
    kind: "array-parameter",
    name: nameValue,
    type: arrayType(elementType, extent, access),
  }) as const;
const arrayReference = (
  nameValue: string,
  elementType: string,
  extent: number | null,
  access: "const" | "mutable",
) =>
  ({
    kind: "array-reference",
    name: nameValue,
    type: arrayType(elementType, extent, access),
  }) as const;
const arrayDeclaration = (
  nameValue: string,
  elementType: string,
  extent: number | null,
  initializer: readonly object[],
) => ({ kind: "array", name: nameValue, elementType, extent, initializer }) as const;
const index = (type: string, target: string, indexValue: object) =>
  ({ kind: "index", type, target, index: indexValue }) as const;
const indexTarget = (type: string, target: string, indexValue: object) =>
  ({ kind: "index-target", type, target, index: indexValue }) as const;
const call = (type: string, callee: string, argumentsValue: readonly object[]) =>
  ({ kind: "call", type, callee, arguments: argumentsValue }) as const;
const callStatement = (callee: string, argumentsValue: readonly object[]) =>
  ({ kind: "call-statement", callee, arguments: argumentsValue }) as const;
const functionDeclaration = (
  nameValue: string,
  parameters: readonly object[],
  returnType: string,
  body: readonly object[],
) => ({ kind: "function", name: nameValue, parameters, returnType, body }) as const;
const module = (path: string, functions: readonly object[], constants: readonly object[] = []) =>
  ({ kind: "module", path: [path], constants, functions }) as const;
const increment = (target: string, type: string = "byte") =>
  assign(target, binary(type, "+", name(type, target), literal(type, 1n)));
const memoryWrite = (address: bigint, value: bigint) =>
  ({
    kind: "memory-write",
    width: 1,
    address: literal("word", address),
    value: literal("byte", value),
  }) as const;
const forLoop = (
  counter: string,
  counterType: string,
  start: bigint | boolean,
  direction: "until" | "to" | "downto",
  end: bigint | boolean,
  step: bigint,
  body: readonly object[],
) =>
  ({
    kind: "for",
    counter,
    counterType,
    start: literal(counterType, start),
    direction,
    end: literal(counterType, end),
    step,
    body,
  }) as const;

const forLoopWithExpressions = (
  counter: string,
  counterType: string,
  start: object,
  direction: "until" | "to" | "downto",
  end: object,
  step: bigint,
  body: readonly object[],
) => ({ kind: "for", counter, counterType, start, direction, end, step, body }) as const;

const byteValues = [1n, 2n, 3n, 4n].map((value) => literal("byte", value));

const fixedArrayModule = (selectedIndex: object, extent: number | null = 4) =>
  module("StructuredArray", [
    functionDeclaration("main", [], "byte", [
      arrayDeclaration("values", "byte", extent, byteValues),
      returnValue(index("byte", "values", selectedIndex)),
    ]),
  ]);

const runtimeArrayModule = (elementType: string, extent: number, indexType: string) =>
  module("RuntimeArray", [
    functionDeclaration("read", [scalarParameter("i", indexType)], elementType, [
      arrayDeclaration("values", elementType, extent, []),
      returnValue(index(elementType, "values", name(indexType, "i"))),
    ]),
    functionDeclaration("main", [], "void", [returnValue()]),
  ]);

const dynamicLoopModule = (
  path: string,
  start: object,
  direction: "until" | "to" | "downto",
  end: object,
  step: bigint,
  body: readonly object[] = [],
) =>
  module(path, [
    functionDeclaration(
      "main",
      [scalarParameter("start", "byte"), scalarParameter("end", "byte")],
      "void",
      [forLoopWithExpressions("i", "byte", start, direction, end, step, body)],
    ),
  ]);

const constantFailureModule = (path: string, constants: readonly object[]) =>
  module(path, [functionDeclaration("main", [], "void", [])], constants);

const integerMaximum = { byte: 255n, sbyte: 127n, word: 65_535n, sword: 32_767n } as const;
const zeroDivisorFunctions = Object.entries(integerMaximum).flatMap(([type, maximum]) => [
  functionDeclaration(`divide${type}`, [scalarParameter("divisor", type)], type, [
    returnValue(binary(type, "/", literal(type, maximum), name(type, "divisor"))),
  ]),
  functionDeclaration(`remainder${type}`, [scalarParameter("divisor", type)], type, [
    returnValue(binary(type, "%", literal(type, maximum), name(type, "divisor"))),
  ]),
]);

const emptyArrayModule = (elementType: string, extent: number | null) =>
  module("ArrayExtent", [
    functionDeclaration("main", [], "void", [
      arrayDeclaration("values", elementType, extent, []),
      returnValue(),
    ]),
  ]);

const loopModule = (
  path: string,
  counter: string,
  counterType: string,
  start: bigint,
  direction: "until" | "to" | "downto",
  end: bigint,
  step: bigint,
) =>
  module(path, [
    functionDeclaration("main", [], "word", [
      local("count", "word", literal("word", 0n)),
      forLoop(counter, counterType, start, direction, end, step, [increment("count", "word")]),
      returnValue(name("word", "count")),
    ]),
  ]);

const nestedIf = (depth: number): object => ({
  kind: "if",
  condition: literal("boolean", true),
  thenBody: depth === 1 ? [returnValue(literal("byte", 1n))] : [nestedIf(depth - 1)],
  elseBody: [returnValue(literal("byte", 0n))],
});

/**
 * Builds immutable structured-program inputs and independent expected data for the specification.
 * The builders only describe programs; all validation, rendering, evaluation, relation, and
 * boundary decisions remain the responsibility of their production entries.
 */
export function createStructuredGeneratedProgramsSpecFixture() {
  const generationBudget: StructuredGenerationBudgetV2 = {
    schemaVersion: 2,
    maxModules: 8,
    maxDeclarations: 128,
    maxIrNodes: 8_192,
    maxStatements: 4_096,
    maxExpressionDepth: 64,
    maxLoopWork: 1_024n,
    maxSourceBytes: 1_048_576,
    maxAttempts: 64,
    maxStatementDepth: 8,
  } as const;
  const oracleBudget = {
    inputNodes: 16_384n,
    expressionDepth: 128n,
    evaluationSteps: 65_536n,
    frames: 256n,
    memoryCells: 65_536n,
    effects: 16_384n,
    transformedNodes: 32_768n,
  } as const;

  const nestedCalls = module("NestedCalls", [
    functionDeclaration(
      "add",
      [scalarParameter("a", "byte"), scalarParameter("b", "byte")],
      "byte",
      [returnValue(binary("byte", "+", name("byte", "a"), name("byte", "b")))],
    ),
    functionDeclaration("nested", [scalarParameter("v", "byte")], "byte", [
      returnValue(
        call("byte", "add", [
          call("byte", "add", [name("byte", "v"), literal("byte", 1n)]),
          literal("byte", 2n),
        ]),
      ),
    ]),
    functionDeclaration("main", [], "byte", [
      returnValue(call("byte", "nested", [literal("byte", 4n)])),
    ]),
  ]);

  const scalarCopy = module("ScalarCopy", [
    functionDeclaration("mutate", [scalarParameter("a", "byte")], "byte", [
      assign("a", literal("byte", 9n)),
      returnValue(name("byte", "a")),
    ]),
    functionDeclaration("main", [], "byte", [
      local("a", "byte", literal("byte", 4n)),
      local("calleeResult", "byte", call("byte", "mutate", [name("byte", "a")])),
      returnValue(name("byte", "a")),
    ]),
  ]);

  const argumentOrder = module("ArgumentOrder", [
    functionDeclaration("first", [], "byte", [
      memoryWrite(0xc000n, 1n),
      returnValue(literal("byte", 1n)),
    ]),
    functionDeclaration("second", [], "byte", [
      memoryWrite(0xc001n, 2n),
      returnValue(literal("byte", 2n)),
    ]),
    functionDeclaration(
      "selectSecond",
      [scalarParameter("a", "byte"), scalarParameter("b", "byte")],
      "byte",
      [returnValue(name("byte", "b"))],
    ),
    functionDeclaration("main", [], "byte", [
      returnValue(
        call("byte", "selectSecond", [call("byte", "first", []), call("byte", "second", [])]),
      ),
    ]),
  ]);

  const branch = module("Branch", [
    functionDeclaration("main", [scalarParameter("flag", "boolean")], "byte", [
      {
        kind: "if",
        condition: name("boolean", "flag"),
        thenBody: [memoryWrite(0xc000n, 1n)],
        elseBody: [memoryWrite(0xc000n, 2n)],
      },
      returnValue(literal("byte", 0n)),
    ]),
  ]);

  const nestedBranch = module("NestedBranch", [
    functionDeclaration("main", [], "byte", [
      {
        kind: "if",
        condition: literal("boolean", true),
        thenBody: [
          {
            kind: "if",
            condition: literal("boolean", false),
            thenBody: [returnValue(literal("byte", 2n))],
            elseBody: [returnValue(literal("byte", 3n))],
          },
        ],
        elseBody: [returnValue(literal("byte", 4n))],
      },
    ]),
  ]);

  const whileZero = module("WhileZero", [
    functionDeclaration("main", [], "byte", [
      local("n", "byte", literal("byte", 0n)),
      { kind: "while", condition: literal("boolean", false), body: [increment("n")] },
      returnValue(name("byte", "n")),
    ]),
  ]);
  const doWhileOne = module("DoWhileOne", [
    functionDeclaration("main", [], "byte", [
      local("n", "byte", literal("byte", 0n)),
      { kind: "do-while", body: [increment("n")], condition: literal("boolean", false) },
      returnValue(name("byte", "n")),
    ]),
  ]);
  const pairedForLoops = module("PairedForLoops", [
    functionDeclaration("main", [], "byte", [
      local("n", "byte", literal("byte", 0n)),
      forLoop("i", "byte", 0n, "until", 3n, 1n, [increment("n")]),
      forLoop("j", "byte", 0n, "to", 2n, 1n, [increment("n")]),
      returnValue(name("byte", "n")),
    ]),
  ]);

  const firstUnsized = module("FirstUnsized", [
    functionDeclaration(
      "first",
      [arrayParameter("data", "byte", null, "const"), scalarParameter("i", "byte")],
      "byte",
      [returnValue(index("byte", "data", name("byte", "i")))],
    ),
    functionDeclaration("main", [], "byte", [
      arrayDeclaration("values", "byte", 4, byteValues),
      returnValue(
        call("byte", "first", [arrayReference("values", "byte", 4, "const"), literal("byte", 2n)]),
      ),
    ]),
  ]);

  const mutableArray = module("MutableArray", [
    functionDeclaration("change", [arrayParameter("data", "byte", null, "mutable")], "void", [
      assign(indexTarget("byte", "data", literal("byte", 1n)), literal("byte", 9n)),
      returnValue(),
    ]),
    functionDeclaration("main", [], "byte", [
      arrayDeclaration("values", "byte", 4, byteValues),
      callStatement("change", [arrayReference("values", "byte", 4, "mutable")]),
      returnValue(index("byte", "values", literal("byte", 1n))),
    ]),
  ]);

  const constArrayWrite = module("ConstArrayWrite", [
    functionDeclaration("change", [arrayParameter("data", "byte", null, "const")], "void", [
      assign(indexTarget("byte", "data", literal("byte", 1n)), literal("byte", 9n)),
      returnValue(),
    ]),
  ]);

  const arrayMismatch = (
    path: string,
    parameterElement: string,
    parameterExtent: number | null,
    parameterAccess: "const" | "mutable",
    argumentElement: string,
    argumentExtent: number,
    argumentAccess: "const" | "mutable",
  ) =>
    module(path, [
      functionDeclaration(
        "consume",
        [arrayParameter("data", parameterElement, parameterExtent, parameterAccess)],
        "void",
        [returnValue()],
      ),
      functionDeclaration("main", [], "void", [
        arrayDeclaration("values", argumentElement, argumentExtent, []),
        callStatement("consume", [
          arrayReference("values", argumentElement, argumentExtent, argumentAccess),
        ]),
        returnValue(),
      ]),
    ]);

  const scalarSignatures = module("ScalarSignatures", [
    ...["boolean", "byte", "sbyte", "word", "sword"].map((type) =>
      functionDeclaration(`identity${type}`, [scalarParameter("value", type)], type, [
        returnValue(name(type, "value")),
      ]),
    ),
  ]);

  const voidCall = module("VoidCall", [
    functionDeclaration("noop", [], "void", [returnValue()]),
    functionDeclaration("main", [], "void", [callStatement("noop", []), returnValue()]),
  ]);

  const boundCallLoop = module("BoundCallLoop", [
    functionDeclaration("lower", [], "byte", [
      forLoop("j", "byte", 0n, "until", 3n, 1n, []),
      returnValue(literal("byte", 0n)),
    ]),
    functionDeclaration("main", [], "void", [
      forLoopWithExpressions(
        "i",
        "byte",
        call("byte", "lower", []),
        "to",
        literal("byte", 2n),
        1n,
        [],
      ),
    ]),
  ]);

  const constantProgram = module(
    "Constants",
    [
      functionDeclaration("read", [], "word", [returnValue(name("word", "FIRST"))]),
      functionDeclaration("readSigned", [], "sword", [returnValue(name("sword", "SIGNED"))]),
      functionDeclaration("main", [], "word", [returnValue(call("word", "read", []))]),
    ],
    [
      constant("FIRST", "word", binary("word", "+", name("word", "WIDE"), literal("word", 1n))),
      constant("WIDE", "word", name("byte", "SMALL")),
      constant("SMALL", "byte", literal("byte", 41n)),
      constant("SIGNED", "sword", name("sbyte", "SMALL_SIGNED")),
      constant("SMALL_SIGNED", "sbyte", unary("sbyte", "-", literal("sbyte", 2n))),
    ],
  );

  const unsizedIndexWidths = module("UnsizedIndexWidths", [
    functionDeclaration(
      "readByteIndex",
      [arrayParameter("data", "word", null, "const"), scalarParameter("i", "byte")],
      "word",
      [returnValue(index("word", "data", name("byte", "i")))],
    ),
    functionDeclaration(
      "readWordIndex",
      [arrayParameter("data", "word", null, "const"), scalarParameter("i", "word")],
      "word",
      [returnValue(index("word", "data", name("word", "i")))],
    ),
  ]);

  return Object.freeze({
    generationBudget,
    oracleBudget,
    fixedArray: fixedArrayModule(literal("byte", 2n)),
    constantOutOfBounds: fixedArrayModule(literal("byte", 4n)),
    computedOutOfBounds: runtimeArrayModule("byte", 4, "byte"),
    scaledWordArray: runtimeArrayModule("word", 129, "word"),
    zeroExtent: emptyArrayModule("byte", 0),
    retainedEmptyExtent: emptyArrayModule("byte", 4),
    nestedCalls,
    scalarCopy,
    argumentOrder,
    branch,
    nestedBranch,
    whileZero,
    doWhileOne,
    pairedForLoops,
    loopThree: loopModule("LoopThree", "i", "byte", 0n, "until", 3n, 1n),
    firstUnsized,
    unsizedLocal: emptyArrayModule("byte", null),
    extentCases: {
      byteMaximum: emptyArrayModule("byte", 65_535),
      byteOver: emptyArrayModule("byte", 65_536),
      wordMaximum: emptyArrayModule("word", 32_767),
      wordOver: emptyArrayModule("word", 32_768),
    },
    invalidConditionCases: [
      module("InvalidIf", [
        functionDeclaration("main", [], "void", [
          { kind: "if", condition: literal("byte", 1n), thenBody: [], elseBody: [] },
          returnValue(),
        ]),
      ]),
      module("InvalidWhile", [
        functionDeclaration("main", [], "void", [
          { kind: "while", condition: literal("byte", 1n), body: [] },
          returnValue(),
        ]),
      ]),
      module("InvalidDoWhile", [
        functionDeclaration("main", [], "void", [
          { kind: "do-while", body: [], condition: literal("byte", 1n) },
          returnValue(),
        ]),
      ]),
    ],
    validBooleanCondition: whileZero,
    missingReturn: module("MissingReturn", [
      functionDeclaration("main", [scalarParameter("flag", "boolean")], "byte", [
        {
          kind: "if",
          condition: name("boolean", "flag"),
          thenBody: [returnValue(literal("byte", 1n))],
          elseBody: [],
        },
      ]),
    ]),
    allPathsReturn: nestedBranch,
    mutableArray,
    constArrayWrite,
    arrayMismatches: {
      element: arrayMismatch("ElementMismatch", "byte", null, "const", "word", 4, "const"),
      extent: arrayMismatch("ExtentMismatch", "byte", 4, "const", "byte", 3, "const"),
      access: arrayMismatch("AccessMismatch", "byte", null, "mutable", "byte", 4, "const"),
    },
    scalarSignatures,
    voidCall,
    scalarAsStatement: module("ScalarAsStatement", [
      functionDeclaration("value", [], "byte", [returnValue(literal("byte", 1n))]),
      functionDeclaration("main", [], "void", [callStatement("value", []), returnValue()]),
    ]),
    voidAsExpression: module("VoidAsExpression", [
      functionDeclaration("noop", [], "void", [returnValue()]),
      functionDeclaration("main", [], "byte", [returnValue(call("byte", "noop", []))]),
    ]),
    arrayInScalarExpression: module("ArrayScalar", [
      functionDeclaration("main", [], "byte", [
        arrayDeclaration("values", "byte", 4, byteValues),
        returnValue(
          binary("byte", "+", arrayReference("values", "byte", 4, "const"), literal("byte", 1n)),
        ),
      ]),
    ]),
    callCycle: module("CallCycle", [
      functionDeclaration("first", [], "byte", [returnValue(call("byte", "second", []))]),
      functionDeclaration("second", [], "byte", [returnValue(call("byte", "first", []))]),
    ]),
    exactDepth: module("ExactDepth", [functionDeclaration("main", [], "byte", [nestedIf(1)])]),
    overDepth: module("OverDepth", [functionDeclaration("main", [], "byte", [nestedIf(2)])]),
    invalidLoopCases: {
      counterType: module("BooleanCounter", [
        functionDeclaration("main", [], "void", [
          forLoop("flag", "boolean", false, "to", true, 1n, []),
          returnValue(),
        ]),
      ]),
      zeroStep: module("ZeroStep", [
        functionDeclaration("main", [], "void", [
          forLoop("i", "byte", 0n, "to", 2n, 0n, []),
          returnValue(),
        ]),
      ]),
      fractionalStep: module("FractionalStep", [
        functionDeclaration("main", [], "void", [
          {
            ...forLoop("i", "byte", 0n, "to", 2n, 1n, []),
            step: 1.5,
          },
          returnValue(),
        ]),
      ]),
      bound: module("OutOfRangeBound", [
        functionDeclaration("main", [], "void", [
          forLoop("i", "byte", 0n, "to", 256n, 1n, []),
          returnValue(),
        ]),
      ]),
    },
    loopExtremes: {
      ascendingByte: loopModule("AscendingByte", "i", "byte", 0n, "to", 255n, 1n),
      descendingSbyte: loopModule("DescendingSbyte", "i", "sbyte", 127n, "downto", -128n, 1n),
      crossingByteMaximum: loopModule("CrossingByte", "i", "byte", 250n, "to", 255n, 3n),
    },
    dynamicLoopCases: {
      fullUntil: dynamicLoopModule(
        "FullUntil",
        name("byte", "start"),
        "until",
        name("byte", "end"),
        2n,
      ),
      partialUntil: dynamicLoopModule(
        "PartialUntil",
        literal("byte", 250n),
        "until",
        name("byte", "end"),
        2n,
      ),
      fullTo: dynamicLoopModule("FullTo", name("byte", "start"), "to", name("byte", "end"), 1n),
      partialDownTo: dynamicLoopModule(
        "PartialDownTo",
        name("byte", "start"),
        "downto",
        literal("byte", 250n),
        2n,
      ),
      actualThree: dynamicLoopModule(
        "ActualThree",
        literal("byte", 0n),
        "until",
        name("byte", "end"),
        1n,
      ),
      boundCallLoop,
    },
    constants: {
      valid: constantProgram,
      selfCycle: constantFailureModule("SelfCycle", [
        constant("SELF", "byte", name("byte", "SELF")),
      ]),
      indirectCycle: constantFailureModule("IndirectCycle", [
        constant("FIRST", "byte", name("byte", "SECOND")),
        constant("SECOND", "byte", name("byte", "FIRST")),
      ]),
      impure: module(
        "ImpureConstant",
        [
          functionDeclaration("make", [], "byte", [returnValue(literal("byte", 1n))]),
          functionDeclaration("main", [], "void", []),
        ],
        [constant("VALUE", "byte", call("byte", "make", []))],
      ),
      outOfRange: constantFailureModule("OutOfRangeConstant", [
        constant("VALUE", "byte", binary("byte", "+", literal("byte", 255n), literal("byte", 1n))),
      ]),
      exactBudget: constantFailureModule("ConstantBudget", [
        constant("VALUE", "byte", literal("byte", 1n)),
      ]),
    },
    zeroDivisors: {
      compileTimeDivide: module("ConstantDivideByZero", [
        functionDeclaration("main", [], "byte", [
          returnValue(binary("byte", "/", literal("byte", 1n), literal("byte", 0n))),
        ]),
      ]),
      compileTimeRemainder: module("ConstantRemainderByZero", [
        functionDeclaration("main", [], "byte", [
          returnValue(binary("byte", "%", literal("byte", 1n), literal("byte", 0n))),
        ]),
      ]),
      runtime: module("RuntimeZeroDivisors", zeroDivisorFunctions),
    },
    indexTiers: {
      tier1Byte: runtimeArrayModule("word", 128, "byte"),
      tier1Word: runtimeArrayModule("word", 128, "word"),
      tier2Word: runtimeArrayModule("word", 129, "word"),
      tier2Byte: runtimeArrayModule("word", 129, "byte"),
      unsizedIndexWidths,
    },
  });
}
