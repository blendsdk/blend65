/**
 * Specification tests for the full expression operator matrix and mixed-width
 * promotion (Pass 3).
 *
 * Expectations derive exclusively from the **frozen spec** — Ch 02 (TS-4
 * widening promotion, §5.1/§5.2 operand legality, §5.3 assignment
 * compatibility, TS-11/12/13 casts, TS-17 compound assignment) and Ch 04
 * (operator semantics: §4 shifts, §5 comparisons, §6 logical, §7 conditional)
 * — plus the canonical diagnostic-code registry. NOT from implementation
 * logic. Immutable oracle.
 *
 * The engine is exercised through the REAL public path (`lex` → `parse` →
 * `analyze`); assertions read `model.typeOf(expr)` and the diagnostic bag.
 * Codes are asserted by their frozen numeric strings so the oracle pins the
 * user-visible contract, not registry key names.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, primitive } from "@blend65/core";
import type {
  AssignExprNode,
  Diagnostic,
  DiagnosticBag,
  ExprNode,
  FunctionDeclNode,
  LetDeclNode,
  ProgramNode,
} from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/** Result bundle of one full `lex → parse → analyze` run. */
interface Analyzed {
  program: ProgramNode;
  model: ReturnType<typeof analyze>;
  bag: DiagnosticBag;
}

/** Runs `source` through the public pipeline and returns AST + model + bag. */
function analyzeSource(source: string): Analyzed {
  const bag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return { program: ast, model, bag };
}

/** The named `FunctionDecl` of a parsed program. */
function fnOf(program: ProgramNode, name: string): FunctionDeclNode {
  const fn = program.items.find(
    (i): i is FunctionDeclNode => i.kind === "FunctionDecl" && i.name === name,
  );
  if (fn === undefined) throw new Error(`fixture must declare function ${name}`);
  return fn;
}

/** The `let <name> …` declaration inside `main`'s body. */
function letInMain(program: ProgramNode, name: string): LetDeclNode {
  const decl = fnOf(program, "main").body.statements.find(
    (s): s is LetDeclNode => s.kind === "LetDecl" && s.name === name,
  );
  if (decl === undefined) throw new Error(`fixture must declare 'let ${name}'`);
  return decl;
}

/** The (required-present) initialiser of a `let` fixture declaration. */
function initOf(decl: LetDeclNode): ExprNode {
  if (decl.initialiser === null) throw new Error(`'let ${decl.name}' must have an initialiser`);
  return decl.initialiser;
}

/** The `index`-th assignment expression statement inside `main`'s body. */
function assignInMain(program: ProgramNode, index: number): AssignExprNode {
  const assigns = fnOf(program, "main").body.statements.flatMap((s) =>
    s.kind === "ExpressionStmt" && s.expression.kind === "AssignExpr" ? [s.expression] : [],
  );
  const found = assigns[index];
  if (found === undefined) throw new Error(`fixture must carry assignment #${index}`);
  return found;
}

/** The error codes recorded on the bag, in the bag's sorted order. */
function errorCodes(bag: DiagnosticBag): string[] {
  return bag.getErrors().map((d: Diagnostic) => d.code);
}

/** Wraps `body` statements in the standard single-module `main` fixture. */
function inMain(body: string): string {
  return `module Main;\nfunction main(): void { ${body} }\n`;
}

describe("Specification: mixed-width promotion (TS-4, §5.3)", () => {
  it("should promote byte to word in mixed-width arithmetic (TS-4)", () => {
    const { program, model, bag } = analyzeSource(
      inMain("let base: word = 1000; let a: byte = 200; let r: word = base + a;"),
    );

    expect(model.typeOf(initOf(letInMain(program, "r")))).toEqual(primitive("word"));
    expect(bag.hasErrors()).toBe(false);
  });

  it("should widen a byte value into a word initialiser and reject the narrowing direction (§5.3)", () => {
    const accepted = analyzeSource(inMain("let b: byte = 5; let w2: word = b;"));
    expect(accepted.bag.hasErrors()).toBe(false);

    const rejected = analyzeSource(inMain("let w: word = 1000; let b2: byte = w;"));
    expect(errorCodes(rejected.bag)).toContain("E10154"); // narrowing needs a cast
  });

  it("should widen a byte argument into a word parameter and reject a cross-sign argument (§5.3)", () => {
    const accepted = analyzeSource(
      "module Main;\nfunction take(v: word): void { let x: word = v; }\n" +
        "function main(): void { let b: byte = 5; take(b); }\n",
    );
    expect(accepted.bag.hasErrors()).toBe(false);

    const rejected = analyzeSource(
      "module Main;\nfunction take(v: word): void { let x: word = v; }\n" +
        "function main(): void { let s: sbyte = -1; take(s); }\n",
    );
    expect(errorCodes(rejected.bag)).toContain("E10171"); // argument type mismatch
  });

  it("should widen a byte return value into a word return type (§5.3)", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction f(): word { let b: byte = 5; return b; }\n" +
        "function main(): void { let r: word = f(); }\n",
    );
    expect(bag.hasErrors()).toBe(false);
  });
});

describe("Specification: comparison operators (§5.2, TS-7)", () => {
  it("should type a same-type comparison as boolean (TS-7)", () => {
    const { program, model, bag } = analyzeSource(
      inMain("let a: byte = 1; let b: byte = 2; let ok: boolean = a < b;"),
    );

    expect(model.typeOf(initOf(letInMain(program, "ok")))).toEqual(primitive("boolean"));
    expect(bag.hasErrors()).toBe(false);
  });

  it("should reject assigning a comparison result to an integer target (TS-7)", () => {
    const { bag } = analyzeSource(
      inMain("let a: byte = 1; let b: byte = 2; let n: byte = a < b;"),
    );
    expect(errorCodes(bag)).toContain("E10152"); // boolean value, integer target
  });

  it("should reject a mixed-signedness comparison (TS-5, §5.2)", () => {
    const { bag } = analyzeSource(
      inMain("let b: byte = 1; let s: sbyte = -1; let ok: boolean = b < s;"),
    );
    expect(errorCodes(bag)).toContain("E10081");
  });

  it("should reject an ordered comparison on boolean operands (Ch 04 §5)", () => {
    const { bag } = analyzeSource(
      inMain("let f1: boolean = true; let f2: boolean = false; let r: boolean = f1 < f2;"),
    );
    expect(errorCodes(bag)).toContain("E10080");
  });

  it("should accept a signed same-type relational comparison as boolean (§5.2)", () => {
    const { program, model, bag } = analyzeSource(
      inMain("let s1: sbyte = -1; let s2: sbyte = 2; let r: boolean = s1 < s2;"),
    );

    expect(model.typeOf(initOf(letInMain(program, "r")))).toEqual(primitive("boolean"));
    expect(bag.hasErrors()).toBe(false);
  });
});

describe("Specification: logical operators (Ch 04 §6)", () => {
  it("should type boolean && boolean as boolean", () => {
    const { program, model, bag } = analyzeSource(
      inMain(
        "let flag: boolean = true; let a: byte = 1; let b: byte = 2;" +
          " let r: boolean = flag && (a < b);",
      ),
    );

    expect(model.typeOf(initOf(letInMain(program, "r")))).toEqual(primitive("boolean"));
    expect(bag.hasErrors()).toBe(false);
  });

  it("should reject a non-boolean operand to && (Ch 04 §6)", () => {
    const { bag } = analyzeSource(
      inMain("let count: byte = 1; let flag: boolean = true; let r: boolean = count && flag;"),
    );
    expect(errorCodes(bag)).toContain("E10080");
  });
});

describe("Specification: unary operators (TS-6, TS-8, Ch 04 §4/§6)", () => {
  it("should type !boolean as boolean and ~integer as the operand type", () => {
    const { program, model, bag } = analyzeSource(
      inMain("let flag: boolean = true; let c: byte = 5; let a1: boolean = !flag; let a2: byte = ~c;"),
    );

    expect(model.typeOf(initOf(letInMain(program, "a1")))).toEqual(primitive("boolean"));
    expect(model.typeOf(initOf(letInMain(program, "a2")))).toEqual(primitive("byte"));
    expect(bag.hasErrors()).toBe(false);
  });

  it("should reject ! on an integer and ~ on a boolean (TS-6, Ch 04 §6)", () => {
    const notInteger = analyzeSource(inMain("let c: byte = 5; let r1: boolean = !c;"));
    expect(errorCodes(notInteger.bag)).toContain("E10080");

    const complementBoolean = analyzeSource(
      inMain("let flag: boolean = true; let r2: boolean = ~flag;"),
    );
    expect(errorCodes(complementBoolean.bag)).toContain("E10080");
  });

  it("should negate a signed operand and reject negating an unsigned one (TS-8)", () => {
    const accepted = analyzeSource(inMain("let s: sbyte = -1; let n: sbyte = -s;"));
    expect(accepted.model.typeOf(initOf(letInMain(accepted.program, "n")))).toEqual(
      primitive("sbyte"),
    );
    expect(accepted.bag.hasErrors()).toBe(false);

    const rejected = analyzeSource(inMain("let b: byte = 5; let n2: byte = -b;"));
    expect(errorCodes(rejected.bag)).toContain("E10087"); // cannot negate unsigned
  });
});

describe("Specification: cast expressions (TS-11/12/13)", () => {
  it("should type integer-to-integer casts as the target type (TS-12)", () => {
    const { program, model, bag } = analyzeSource(
      inMain(
        "let b: byte = 5; let w: word = 1000;" +
          " let c1: word = <word>(b); let c2: byte = <byte>(w); let c3: sbyte = <sbyte>(b);",
      ),
    );

    expect(model.typeOf(initOf(letInMain(program, "c1")))).toEqual(primitive("word"));
    expect(model.typeOf(initOf(letInMain(program, "c2")))).toEqual(primitive("byte"));
    expect(model.typeOf(initOf(letInMain(program, "c3")))).toEqual(primitive("sbyte"));
    expect(bag.hasErrors()).toBe(false);
  });

  it("should reject casts between boolean and integer types (TS-13)", () => {
    const toBoolean = analyzeSource(inMain("let f: boolean = <boolean>(5);"));
    expect(errorCodes(toBoolean.bag)).toContain("E10086");

    const fromBoolean = analyzeSource(
      inMain("let flag: boolean = true; let b2: byte = <byte>(flag);"),
    );
    expect(errorCodes(fromBoolean.bag)).toContain("E10086");
  });
});

describe("Specification: conditional operator (Ch 04 §7)", () => {
  it("should adapt both literal arms to the context type (TS-2, §7.3)", () => {
    const { program, model, bag } = analyzeSource(
      inMain("let cond: boolean = true; let pick: byte = cond ? 4 : 2;"),
    );

    expect(model.typeOf(initOf(letInMain(program, "pick")))).toEqual(primitive("byte"));
    expect(bag.hasErrors()).toBe(false);
  });

  it("should promote mixed-width arms to the wider type (§7.3, TS-4)", () => {
    const { program, model, bag } = analyzeSource(
      inMain(
        "let cond: boolean = true; let bv: byte = 1; let wv: word = 1000;" +
          " let r: word = cond ? bv : wv;",
      ),
    );

    expect(model.typeOf(initOf(letInMain(program, "r")))).toEqual(primitive("word"));
    expect(bag.hasErrors()).toBe(false);
  });

  it("should reject arms with no common type (§7.3)", () => {
    const { bag } = analyzeSource(
      inMain(
        "let cond: boolean = true; let bv: byte = 1; let sv: sbyte = -1;" +
          " let x: byte = cond ? bv : sv;",
      ),
    );
    expect(errorCodes(bag)).toContain("E10088"); // incompatible arm types
  });

  it("should reject a non-boolean condition (§7.2)", () => {
    const { bag } = analyzeSource(inMain("let bv: byte = 1; let r2: byte = bv ? 1 : 2;"));
    expect(errorCodes(bag)).toContain("E10134");
  });
});

describe("Specification: compound assignment (TS-17)", () => {
  it("should accept a widening compound assignment (TS-17)", () => {
    const { bag } = analyzeSource(
      inMain("let score: word = 100; let bonus: byte = 5; score += bonus;"),
    );
    expect(bag.hasErrors()).toBe(false);
  });

  it("should reject a mixed-sign compound assignment (TS-5)", () => {
    const { bag } = analyzeSource(inMain("let b: byte = 1; let s: sbyte = -1; b += s;"));
    expect(errorCodes(bag)).toContain("E10081");
  });

  it("should reject a compound assignment whose result narrows back into the target (§5.3)", () => {
    const { bag } = analyzeSource(inMain("let b: byte = 1; let w: word = 1000; b += w;"));
    expect(errorCodes(bag)).toContain("E10154");
  });

  it("should reject a compound assignment to a const (VAR-5)", () => {
    const { bag } = analyzeSource(
      "module Main;\nconst LIMIT: byte = 10;\nfunction main(): void { LIMIT += 1; }\n",
    );
    expect(errorCodes(bag)).toContain("E10191");
  });

  it("should type the compound-assignment expression as the target type (TS-17)", () => {
    const { program, model, bag } = analyzeSource(
      inMain("let score: word = 100; let bonus: byte = 5; score += bonus;"),
    );

    expect(model.typeOf(assignInMain(program, 0))).toEqual(primitive("word"));
    expect(bag.hasErrors()).toBe(false);
  });
});

describe("Specification: shift operators (Ch 04 §4)", () => {
  it("should type a shift as the left operand's type", () => {
    const { program, model, bag } = analyzeSource(
      inMain("let b: byte = 1; let w: word = 1; let r1: byte = b << 2; let r2: word = w >> 1;"),
    );

    expect(model.typeOf(initOf(letInMain(program, "r1")))).toEqual(primitive("byte"));
    expect(model.typeOf(initOf(letInMain(program, "r2")))).toEqual(primitive("word"));
    expect(bag.hasErrors()).toBe(false);
  });

  it("should reject a signed shift amount (Ch 04 §4)", () => {
    const { bag } = analyzeSource(
      inMain("let b: byte = 1; let amt: sbyte = 1; let r3: byte = b << amt;"),
    );
    expect(errorCodes(bag)).toContain("E10083"); // shift amount must be unsigned
  });
});
