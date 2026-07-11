/**
 * Implementation tests for the expression operator matrix: the full 5×5
 * operand-pair sweep per operator class, literal adaptation per class,
 * compound-assignment dispatch internals, and the warning trigger/non-trigger
 * boundaries. Spec-level behavior is pinned by the co-located spec suites;
 * these tests sweep the combinatorial interior and the edges.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, primitive } from "@blend65/core";
import type {
  Diagnostic,
  DiagnosticBag,
  ExprNode,
  FunctionDeclNode,
  LetDeclNode,
  ProgramNode,
} from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";

const SRC = 1;

/** Result bundle of one full `lex → parse → analyze` run. */
interface Analyzed {
  program: ProgramNode;
  model: ReturnType<typeof analyze>;
  bag: DiagnosticBag;
}

function analyzeSource(source: string): Analyzed {
  const bag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return { program: ast, model, bag };
}

function letInMain(program: ProgramNode, name: string): LetDeclNode {
  const fn = program.items.find(
    (i): i is FunctionDeclNode => i.kind === "FunctionDecl" && i.name === "main",
  );
  if (fn === undefined) throw new Error("fixture must declare main");
  const decl = fn.body.statements.find(
    (s): s is LetDeclNode => s.kind === "LetDecl" && s.name === name,
  );
  if (decl === undefined) throw new Error(`fixture must declare 'let ${name}'`);
  return decl;
}

function initOf(decl: LetDeclNode): ExprNode {
  if (decl.initialiser === null) throw new Error(`'let ${decl.name}' must have an initialiser`);
  return decl.initialiser;
}

function errorCodes(bag: DiagnosticBag): string[] {
  return bag.getErrors().map((d: Diagnostic) => d.code);
}

function warningCodes(bag: DiagnosticBag): string[] {
  return bag.getWarnings().map((d: Diagnostic) => d.code);
}

/** The five operand types and an in-range literal for each. */
const OPERAND_TYPES = ["byte", "sbyte", "word", "sword", "boolean"] as const;
type OperandType = (typeof OPERAND_TYPES)[number];
const LITERAL: Record<OperandType, string> = {
  byte: "1",
  sbyte: "-1",
  word: "1000",
  sword: "-300",
  boolean: "true",
};

const isBool = (t: OperandType): boolean => t === "boolean";
const signed = (t: OperandType): boolean => t === "sbyte" || t === "sword";
const wide = (t: OperandType): boolean => t === "word" || t === "sword";
const widerOf = (l: OperandType, r: OperandType): OperandType => (wide(l) ? l : r);

/** Builds `main` with `a: l`, `b: r`, and `let out: <target> = a OP b;`. */
function pairSource(l: OperandType, r: OperandType, op: string, target: string): string {
  return (
    "module Main;\nfunction main(): void {" +
    ` let a: ${l} = ${LITERAL[l]}; let b: ${r} = ${LITERAL[r]};` +
    ` let out: ${target} = a ${op} b; }\n`
  );
}

describe("arithmetic/bitwise operand matrix (25 pairs each)", () => {
  for (const op of ["+", "&"]) {
    for (const l of OPERAND_TYPES) {
      for (const r of OPERAND_TYPES) {
        if (isBool(l) || isBool(r)) {
          it(`rejects ${l} ${op} ${r} with E10080`, () => {
            const { bag } = analyzeSource(pairSource(l, r, op, "byte"));
            expect(errorCodes(bag)).toContain("E10080");
          });
        } else if (signed(l) !== signed(r)) {
          it(`rejects ${l} ${op} ${r} with E10081`, () => {
            const { bag } = analyzeSource(pairSource(l, r, op, "byte"));
            expect(errorCodes(bag)).toContain("E10081");
          });
        } else {
          const result = widerOf(l, r);
          it(`types ${l} ${op} ${r} as ${result}`, () => {
            const { program, model, bag } = analyzeSource(pairSource(l, r, op, result));
            expect(bag.hasErrors()).toBe(false);
            expect(model.typeOf(initOf(letInMain(program, "out")))).toEqual(primitive(result));
          });
        }
      }
    }
  }
});

describe("ordered-comparison operand matrix (25 pairs)", () => {
  for (const l of OPERAND_TYPES) {
    for (const r of OPERAND_TYPES) {
      if (isBool(l) || isBool(r)) {
        // Boolean in an ordered comparison — including boolean < boolean.
        it(`rejects ${l} < ${r} with E10080`, () => {
          const { bag } = analyzeSource(pairSource(l, r, "<", "boolean"));
          expect(errorCodes(bag)).toContain("E10080");
        });
      } else if (signed(l) !== signed(r)) {
        it(`rejects ${l} < ${r} with E10081`, () => {
          const { bag } = analyzeSource(pairSource(l, r, "<", "boolean"));
          expect(errorCodes(bag)).toContain("E10081");
        });
      } else {
        it(`types ${l} < ${r} as boolean`, () => {
          const { program, model, bag } = analyzeSource(pairSource(l, r, "<", "boolean"));
          expect(bag.hasErrors()).toBe(false);
          expect(model.typeOf(initOf(letInMain(program, "out")))).toEqual(primitive("boolean"));
        });
      }
    }
  }

  it("accepts boolean == boolean and boolean != boolean (equality only)", () => {
    for (const op of ["==", "!="]) {
      const { program, model, bag } = analyzeSource(
        pairSource("boolean", "boolean", op, "boolean"),
      );
      expect(bag.hasErrors()).toBe(false);
      expect(model.typeOf(initOf(letInMain(program, "out")))).toEqual(primitive("boolean"));
    }
  });

  it("accepts integer == integer with promotion", () => {
    const { program, model, bag } = analyzeSource(pairSource("byte", "word", "==", "boolean"));
    expect(bag.hasErrors()).toBe(false);
    expect(model.typeOf(initOf(letInMain(program, "out")))).toEqual(primitive("boolean"));
  });
});

describe("logical operand matrix", () => {
  for (const l of OPERAND_TYPES) {
    for (const r of OPERAND_TYPES) {
      if (isBool(l) && isBool(r)) {
        it(`types ${l} && ${r} as boolean`, () => {
          const { program, model, bag } = analyzeSource(pairSource(l, r, "&&", "boolean"));
          expect(bag.hasErrors()).toBe(false);
          expect(model.typeOf(initOf(letInMain(program, "out")))).toEqual(primitive("boolean"));
        });
      } else {
        it(`rejects ${l} || ${r} with E10080`, () => {
          const { bag } = analyzeSource(pairSource(l, r, "||", "boolean"));
          expect(errorCodes(bag)).toContain("E10080");
        });
      }
    }
  }
});

describe("shift operand matrix", () => {
  for (const l of OPERAND_TYPES) {
    for (const r of OPERAND_TYPES) {
      if (isBool(l)) {
        it(`rejects ${l} << ${r} with E10080 (left operand)`, () => {
          const { bag } = analyzeSource(pairSource(l, r, "<<", "byte"));
          expect(errorCodes(bag)).toContain("E10080");
        });
      } else if (isBool(r)) {
        it(`rejects ${l} << ${r} with E10080 (amount)`, () => {
          const { bag } = analyzeSource(pairSource(l, r, "<<", l));
          expect(errorCodes(bag)).toContain("E10080");
        });
      } else if (signed(r)) {
        it(`rejects ${l} << ${r} with E10083 (signed amount)`, () => {
          const { bag } = analyzeSource(pairSource(l, r, "<<", l));
          expect(errorCodes(bag)).toContain("E10083");
        });
      } else {
        it(`types ${l} >> ${r} as ${l} (left type)`, () => {
          const { program, model, bag } = analyzeSource(pairSource(l, r, ">>", l));
          expect(bag.hasErrors()).toBe(false);
          expect(model.typeOf(initOf(letInMain(program, "out")))).toEqual(primitive(l));
        });
      }
    }
  }
});

describe("literal adaptation per operator class", () => {
  it("adapts a literal to a signed operand in arithmetic (no E10081)", () => {
    const { program, model, bag } = analyzeSource(
      "module Main;\nfunction main(): void { let s: sbyte = -5; let out: sbyte = s + 1; }\n",
    );
    expect(bag.hasErrors()).toBe(false);
    expect(model.typeOf(initOf(letInMain(program, "out")))).toEqual(primitive("sbyte"));
  });

  it("adapts a literal to a word operand in a comparison", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let w: word = 1000; let out: boolean = w < 5; }\n",
    );
    expect(bag.hasErrors()).toBe(false);
  });

  it("adapts a left literal to the other operand in bitwise ops", () => {
    const { program, model, bag } = analyzeSource(
      "module Main;\nfunction main(): void { let w: word = 1000; let out: word = 15 & w; }\n",
    );
    expect(bag.hasErrors()).toBe(false);
    expect(model.typeOf(initOf(letInMain(program, "out")))).toEqual(primitive("word"));
  });
});

describe("compound-assignment dispatch internals", () => {
  it("accepts every arithmetic compound with a literal value", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let b: byte = 8;" +
        " b += 1; b -= 1; b *= 2; b /= 2; b %= 3; }\n",
    );
    expect(bag.hasErrors()).toBe(false);
  });

  it("accepts bitwise and shift compounds with unsigned amounts", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let w: word = 8; let n: byte = 2;" +
        " w &= 15; w |= 3; w ^= 5; w <<= n; w >>= 1; }\n",
    );
    expect(bag.hasErrors()).toBe(false);
  });

  it("rejects a signed shift-compound amount with E10083", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let b: byte = 8; let s: sbyte = 1; b <<= s; }\n",
    );
    expect(errorCodes(bag)).toContain("E10083");
  });

  it("rejects a boolean operand in a bitwise compound with E10080", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let b: byte = 8; let f: boolean = true; b &= f; }\n",
    );
    expect(errorCodes(bag)).toContain("E10080");
  });

  it("rejects the promoted write-back of a bitwise compound with E10154", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let b: byte = 8; let w: word = 1000; b &= w; }\n",
    );
    expect(errorCodes(bag)).toContain("E10154");
  });

  it("range-checks a constant compound value against the target (E10084)", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let b: byte = 8; b += 300; }\n",
    );
    expect(errorCodes(bag)).toContain("E10084");
  });
});

describe("unary/cast/ternary interior edges", () => {
  it("types nested negation of a signed value", () => {
    const { program, model, bag } = analyzeSource(
      "module Main;\nfunction main(): void { let s: sbyte = -5; let out: sbyte = -(-s); }\n",
    );
    expect(bag.hasErrors()).toBe(false);
    expect(model.typeOf(initOf(letInMain(program, "out")))).toEqual(primitive("sbyte"));
  });

  it("types a negative literal by value without a context (sword default)", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let out: sword = -300 + -300; }\n",
    );
    expect(bag.hasErrors()).toBe(false);
  });

  it("types ~word as word (operand width, no context adaptation)", () => {
    const { program, model, bag } = analyzeSource(
      "module Main;\nfunction main(): void { let w: word = 1; let out: word = ~w; }\n",
    );
    expect(bag.hasErrors()).toBe(false);
    expect(model.typeOf(initOf(letInMain(program, "out")))).toEqual(primitive("word"));
  });

  it("types every remaining integer cast pair as its target", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let s: sbyte = -1; let sw: sword = -300;" +
        " let c1: sword = <sword>(s); let c2: sbyte = <sbyte>(sw);" +
        " let c3: word = <word>(sw); let c4: byte = <byte>(s); }\n",
    );
    expect(bag.hasErrors()).toBe(false);
  });

  it("accepts a boolean identity cast", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let f: boolean = true; let out: boolean = <boolean>(f); }\n",
    );
    expect(bag.hasErrors()).toBe(false);
  });

  it("types a nested right-associative ternary in a byte context", () => {
    const { program, model, bag } = analyzeSource(
      "module Main;\nfunction main(): void { let c1: boolean = true; let c2: boolean = false;" +
        " let out: byte = c1 ? 3 : c2 ? 2 : 1; }\n",
    );
    expect(bag.hasErrors()).toBe(false);
    expect(model.typeOf(initOf(letInMain(program, "out")))).toEqual(primitive("byte"));
  });
});

describe("intermediate-overflow warning boundaries", () => {
  it("warns W10160 for signed narrow arithmetic into sword", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let a: sbyte = -5; let b: sbyte = -6;" +
        " let out: sword = a + b; }\n",
    );
    expect(bag.hasErrors()).toBe(false);
    expect(warningCodes(bag)).toContain("W10160");
  });

  it("warns W10160 for narrow multiplication into word", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let a: byte = 5; let b: byte = 6;" +
        " let out: word = a * b; }\n",
    );
    expect(warningCodes(bag)).toContain("W10160");
  });

  it("does NOT warn for division or bitwise results into word", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let a: byte = 5; let b: byte = 6;" +
        " let d: word = a / b; let m: word = a & b; }\n",
    );
    expect(bag.hasErrors()).toBe(false);
    expect(warningCodes(bag)).not.toContain("W10160");
    expect(warningCodes(bag)).not.toContain("W10161");
  });

  it("warns W10161 with the wrapped value for a provably-wrapping constant", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let out: word = 200 + 100; }\n",
    );
    expect(bag.hasErrors()).toBe(false);
    expect(warningCodes(bag)).toContain("W10161");
    const warning = bag.getWarnings().find((d) => d.code === "W10161");
    expect(warning?.message).toContain("44"); // 300 wraps to 44 at byte width
  });

  it("stays silent for a provably in-range constant expression", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let out: word = 100 + 100; }\n",
    );
    expect(bag.hasErrors()).toBe(false);
    expect(warningCodes(bag)).not.toContain("W10160");
    expect(warningCodes(bag)).not.toContain("W10161");
  });

  it("warns on a compound assignment whose value is narrow arithmetic", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let w: word = 0; let a: byte = 5;" +
        " let b: byte = 6; w += a + b; }\n",
    );
    expect(warningCodes(bag)).toContain("W10160");
  });

  it("warns at the argument and return sites too", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction take(v: word): void { let x: word = v; }\n" +
        "function give(): word { let a: byte = 5; let b: byte = 6; return a + b; }\n" +
        "function main(): void { let a: byte = 5; let b: byte = 6; take(a + b); give(); }\n",
    );
    expect(bag.hasErrors()).toBe(false);
    // One warning from the argument site, one from the return site.
    expect(warningCodes(bag).filter((c) => c === "W10160")).toHaveLength(2);
  });
});

describe("shift-width warning boundaries", () => {
  it("warns W10174 exactly at the width boundary (8 for byte, 16 for word)", () => {
    const atByte = analyzeSource(
      "module Main;\nfunction main(): void { let b: byte = 1; let out: byte = b << 8; }\n",
    );
    expect(warningCodes(atByte.bag)).toContain("W10174");

    const atWord = analyzeSource(
      "module Main;\nfunction main(): void { let w: word = 1; let out: word = w >> 16; }\n",
    );
    expect(warningCodes(atWord.bag)).toContain("W10174");
  });

  it("does not warn just below the boundary for word", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let w: word = 1; let out: word = w >> 15; }\n",
    );
    expect(bag.hasErrors()).toBe(false);
    expect(warningCodes(bag)).not.toContain("W10174");
  });

  it("does not warn for a runtime (non-constant) amount", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let w: word = 1; let n: byte = 20;" +
        " let out: word = w << n; }\n",
    );
    expect(bag.hasErrors()).toBe(false);
    expect(warningCodes(bag)).not.toContain("W10174");
  });
});
