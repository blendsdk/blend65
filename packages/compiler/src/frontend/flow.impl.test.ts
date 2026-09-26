import { describe, expect, it } from "vitest";
import type { TypedBlock, TypedExpr, TypedStatement } from "./semantic-types.js";
import { checkStatusStack } from "./status-stack.js";

const SPAN = Object.freeze({ sourceId: "status.blend", start: 0, end: 1 });
const VOID = Object.freeze({ kind: "scalar" as const, name: "void" as const });
const BOOLEAN = Object.freeze({ kind: "scalar" as const, name: "boolean" as const });

/** Build only the checked expression fields consumed by status-stack analysis. */
function expression(kind: TypedExpr["kind"], name: string | null = null): TypedExpr {
  return Object.freeze({
    kind,
    span: SPAN,
    type: VOID,
    constant: null,
    binding: null,
    place: null,
    conversion: null,
    integer: null,
    ...(name === null ? {} : { name }),
  });
}

/** Give a CPU-control call the same typed shape as an analyzed source statement. */
function control(name: "asm_php" | "asm_plp"): TypedStatement {
  return Object.freeze({
    kind: "expression-statement",
    span: SPAN,
    expression: Object.freeze({ ...expression("call"), callee: expression("name", name) }),
  });
}

/** Keep each branch's statement order explicit in these focused flow probes. */
function block(...statements: TypedStatement[]): TypedBlock {
  return Object.freeze({ kind: "block", span: SPAN, statements: Object.freeze(statements) });
}

const UNKNOWN_CONDITION: TypedExpr = Object.freeze({
  ...expression("boolean"),
  type: BOOLEAN,
});

describe("processor-status flow implementation", () => {
  it("should join equal saved depths and permit one matching pull after the branch", () => {
    const body = block(
      Object.freeze({
        kind: "if",
        span: SPAN,
        condition: UNKNOWN_CONDITION,
        then: block(control("asm_php")),
        otherwise: block(control("asm_php")),
      }),
      control("asm_plp"),
    );

    expect(checkStatusStack(body)).toEqual({ diagnostics: [], peak: 1 });
  });

  it("should diagnose unequal saved depths where branches rejoin", () => {
    const body = block(
      Object.freeze({
        kind: "if",
        span: SPAN,
        condition: UNKNOWN_CONDITION,
        then: block(control("asm_php")),
        otherwise: block(),
      }),
    );

    const result = checkStatusStack(body);
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10248");
    expect(result.peak).toBe(1);
  });

  it("should diagnose a save that accumulates across a loop backedge", () => {
    const body = block(
      Object.freeze({
        kind: "while",
        span: SPAN,
        condition: UNKNOWN_CONDITION,
        body: block(control("asm_php")),
      }),
    );

    expect(checkStatusStack(body).diagnostics.map(({ code }) => code)).toContain("E10248");
  });
});
