import { describe, expect, it } from "vitest";

import { validateStructuredGeneratorProgram } from "./structured-ir-validation.js";
import { createStructuredGeneratedProgramsSpecFixture } from "./test-fixtures/structured-generated-programs-spec-fixture.js";

const fixture = createStructuredGeneratedProgramsSpecFixture();
const byte = (value: bigint) => ({ kind: "literal", type: "byte", value }) as const;
const word = (value: bigint) => ({ kind: "literal", type: "word", value }) as const;
const bool = (value: bigint) => ({ kind: "literal", type: "boolean", value }) as const;
const byteName = (name: string) => ({ kind: "name", type: "byte", name }) as const;

function moduleWith(
  body: readonly object[],
  returnType: "byte" | "word" | "void" = "void",
  parameters: readonly object[] = [],
  functions: readonly object[] = [],
) {
  return {
    kind: "module",
    path: ["Review"],
    constants: [],
    functions: [{ kind: "function", name: "main", parameters, returnType, body }, ...functions],
  } as const;
}

function forLoop(counter: string, count: number, body: readonly object[]) {
  return {
    kind: "for",
    counter,
    counterType: "byte",
    start: byte(0n),
    direction: "until",
    end: byte(BigInt(count)),
    step: 1n,
    body,
  } as const;
}

function expectReason(module: unknown, reason: string, path?: string): void {
  expect(validateStructuredGeneratorProgram(module, fixture.generationBudget)).toMatchObject({
    ok: false,
    diagnostics: [{ reason, ...(path === undefined ? {} : { path }) }],
  });
}

describe("structured semantic name and type closure", () => {
  it.each([
    {
      label: "unresolved names",
      module: moduleWith([{ kind: "return", value: byteName("missing") }], "byte"),
      reason: "name-unresolved",
    },
    {
      label: "duplicate functions",
      module: moduleWith(
        [],
        "void",
        [],
        [{ kind: "function", name: "main", parameters: [], returnType: "void", body: [] }],
      ),
      reason: "name-conflict",
    },
    {
      label: "duplicate parameters",
      module: moduleWith([], "void", [
        { kind: "scalar-parameter", name: "value", type: "byte" },
        { kind: "scalar-parameter", name: "value", type: "byte" },
      ]),
      reason: "name-conflict",
    },
    {
      label: "duplicate locals",
      module: moduleWith([
        { kind: "local", name: "value", type: "byte", initializer: byte(1n) },
        { kind: "local", name: "value", type: "byte", initializer: byte(2n) },
      ]),
      reason: "name-conflict",
    },
    {
      label: "expression result types",
      module: moduleWith(
        [
          {
            kind: "return",
            value: { kind: "binary", type: "word", operator: "+", left: byte(1n), right: byte(2n) },
          },
        ],
        "word",
      ),
      reason: "expression-type-mismatch",
    },
    {
      label: "initializer types",
      module: moduleWith([{ kind: "local", name: "value", type: "byte", initializer: word(1n) }]),
      reason: "initializer-type-mismatch",
    },
    {
      label: "assignment types",
      module: moduleWith([
        { kind: "local", name: "value", type: "byte", initializer: byte(1n) },
        { kind: "assign", target: "value", value: word(2n) },
      ]),
      reason: "assignment-type-mismatch",
    },
    {
      label: "memory operand types",
      module: moduleWith([{ kind: "memory-write", width: 1, address: byte(0n), value: byte(1n) }]),
      reason: "memory-operand-type-mismatch",
    },
    {
      label: "return types",
      module: moduleWith([{ kind: "return", value: word(1n) }], "byte"),
      reason: "return-type-mismatch",
    },
  ])("rejects $label with its focused reason", ({ module, reason }) => {
    expectReason(module, reason);
  });

  it("keeps loop counters read-only and non-shadowable throughout nested bodies", () => {
    expectReason(
      moduleWith([forLoop("i", 2, [{ kind: "assign", target: "i", value: byte(1n) }])]),
      "loop-counter-read-only",
      "/functions/0/body/0/body/0/target",
    );
    expectReason(
      moduleWith([
        forLoop("i", 2, [{ kind: "local", name: "i", type: "byte", initializer: byte(1n) }]),
      ]),
      "name-conflict",
      "/functions/0/body/0/body/0/name",
    );
  });

  it("closes array cardinality, element type, unsigned index, and storage-reference type", () => {
    expectReason(
      moduleWith([
        {
          kind: "array",
          name: "values",
          elementType: "byte",
          extent: 1,
          initializer: [byte(1n), byte(2n)],
        },
      ]),
      "initializer-type-mismatch",
    );
    expectReason(
      moduleWith([
        { kind: "array", name: "values", elementType: "byte", extent: 1, initializer: [word(1n)] },
      ]),
      "initializer-type-mismatch",
    );
    expectReason(
      moduleWith(
        [
          { kind: "array", name: "values", elementType: "byte", extent: 2, initializer: [] },
          {
            kind: "return",
            value: {
              kind: "index",
              type: "byte",
              target: "values",
              index: { kind: "literal", type: "sbyte", value: 0n },
            },
          },
        ],
        "byte",
      ),
      "expression-type-mismatch",
    );
    expectReason(
      moduleWith(
        [
          { kind: "array", name: "values", elementType: "byte", extent: 2, initializer: [] },
          {
            kind: "call-statement",
            callee: "consume",
            arguments: [
              {
                kind: "array-reference",
                name: "values",
                type: { kind: "array-type", elementType: "word", extent: 2, access: "mutable" },
              },
            ],
          },
        ],
        "void",
        [],
        [
          {
            kind: "function",
            name: "consume",
            parameters: [
              {
                kind: "array-parameter",
                name: "items",
                type: { kind: "array-type", elementType: "word", extent: 2, access: "mutable" },
              },
            ],
            returnType: "void",
            body: [],
          },
        ],
      ),
      "call-argument-type-mismatch",
    );
  });

  it("finds a call cycle hidden in a nested call argument", () => {
    const nestedCycle = moduleWith(
      [
        {
          kind: "return",
          value: {
            kind: "call",
            type: "byte",
            callee: "identity",
            arguments: [{ kind: "call", type: "byte", callee: "main", arguments: [] }],
          },
        },
      ],
      "byte",
      [],
      [
        {
          kind: "function",
          name: "identity",
          parameters: [{ kind: "scalar-parameter", name: "value", type: "byte" }],
          returnType: "byte",
          body: [{ kind: "return", value: byteName("value") }],
        },
      ],
    );
    expectReason(nestedCycle, "call-cycle");
  });
});

describe("structured call-expanded loop-work accounting", () => {
  it("multiplies nested domains and accepts only the exact 10,100-unit limit", () => {
    const nested = moduleWith([forLoop("outer", 100, [forLoop("inner", 100, [])])]);
    expect(
      validateStructuredGeneratorProgram(nested, {
        ...fixture.generationBudget,
        maxLoopWork: 10_100n,
      }),
    ).toMatchObject({
      ok: true,
      usage: { "loop-work": 10_100n },
    });
    expectReason(nested, "loop-work-exceeded", "/functions/0/body/0");
  });

  it("expands callee work at each call multiplicity and takes the maximum branch arm", () => {
    const loopCallee = {
      kind: "function",
      name: "work",
      parameters: [],
      returnType: "void",
      body: [forLoop("inner", 3, [])],
    } as const;
    const called = moduleWith(
      [forLoop("outer", 2, [{ kind: "call-statement", callee: "work", arguments: [] }])],
      "void",
      [],
      [loopCallee],
    );
    expect(validateStructuredGeneratorProgram(called, fixture.generationBudget)).toMatchObject({
      ok: true,
      usage: { "loop-work": 8n },
    });

    const branches = moduleWith([
      {
        kind: "if",
        condition: bool(1n),
        thenBody: [forLoop("left", 3, [])],
        elseBody: [forLoop("right", 5, [])],
      },
    ]);
    expect(validateStructuredGeneratorProgram(branches, fixture.generationBudget)).toMatchObject({
      ok: true,
      usage: { "loop-work": 5n },
    });
  });

  it("models only statically proved while and do-while domains", () => {
    const closed = moduleWith([
      { kind: "while", condition: bool(0n), body: [forLoop("never", 9, [])] },
      { kind: "do-while", body: [forLoop("once", 2, [])], condition: bool(0n) },
    ]);
    expect(validateStructuredGeneratorProgram(closed, fixture.generationBudget)).toMatchObject({
      ok: true,
      usage: { "loop-work": 3n },
    });

    const unknown = moduleWith(
      [{ kind: "while", condition: { kind: "name", type: "boolean", name: "flag" }, body: [] }],
      "void",
      [{ kind: "scalar-parameter", name: "flag", type: "boolean" }],
    );
    expectReason(unknown, "loop-work-exceeded", "/functions/0/body/0");
  });
});
