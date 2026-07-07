import { describe, expect, it } from "vitest";
import { DiagCode, TokenKind, createDiagnosticBag, makeSpan } from "@blend65/core";
import type { AstNode, DiagnosticBag, SourceId, Token, TokenKindValue } from "@blend65/core";
import { lex } from "../index.js";
// Import through the package PUBLIC entry so this tier also pins that `parse`
// is re-exported from `@blend65/frontend` (FR-47).
import { parse } from "../index.js";

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/**
 * Lexes `source` then parses it through the public `parse()` entry, threading
 * the source text into the `ParseInput` object so identifier lexemes
 * resolve via the cursor's single `lexeme()` site.
 */
function parseSource(source: string, bag: DiagnosticBag) {
  const { tokens } = lex(SRC, source, bag);
  return parse({ tokens, source, sourceId: SRC, bag });
}

/** True when `v` is an AST node (string `kind` + `span`). */
function isAstNode(v: unknown): v is AstNode {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { kind?: unknown }).kind === "string" &&
    typeof (v as { span?: unknown }).span === "object"
  );
}

/**
 * Serialises an AST into a stable, span-free plain-object tree for golden
 * snapshots: `kind` first, then every child node / array of nodes and
 * scalar field, with `span`/`*Span` fields omitted so the snapshot captures
 * *shape*, not byte offsets. Deterministic key order (insertion order of the
 * node interfaces) makes the output byte-identical across runs.
 */
function serialize(value: unknown): unknown {
  if (isAstNode(value)) {
    const out: Record<string, unknown> = { kind: value.kind };
    for (const [key, child] of Object.entries(value)) {
      if (key === "kind" || key === "span" || key.endsWith("Span")) continue;
      out[key] = serialize(child);
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map((element) => serialize(element));
  }
  return value;
}

/** Visits every AST node reachable from `root`, depth-first. */
function forEachNode(root: AstNode, visit: (n: AstNode) => void): void {
  visit(root);
  for (const child of Object.values(root)) {
    if (isAstNode(child)) {
      forEachNode(child, visit);
    } else if (Array.isArray(child)) {
      for (const element of child) {
        if (isAstNode(element)) forEachNode(element, visit);
      }
    }
  }
}

describe("parser public contract — Phase 2 (ST-P5..P8)", () => {
  it("re-exports `parse` from the @blend65/frontend public entry", () => {
    expect(typeof parse).toBe("function");
  });

  // ----- Minimal program (FR-12/13) -----
  it("ST-P5: `module Main;` → ProgramNode, name 'Main', no items, no errors", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource("module Main;", bag);
    expect(ast.kind).toBe("Program");
    expect(ast.moduleDecl.kind).toBe("ModuleDecl");
    expect(ast.moduleDecl.name).toBe("Main");
    expect(ast.items).toEqual([]);
    expect(hasErrors).toBe(false);
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-P5: dotted module name `module Game.Engine;` resolves the full path", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource("module Game.Engine;", bag);
    expect(ast.moduleDecl.name).toBe("Game.Engine");
    expect(hasErrors).toBe(false);
  });

  // ----- Missing module (FR-13) -----
  it("ST-P6: source with no `module` → E10001, ProgramNode still returned", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource("function main(): void { }", bag);
    expect(ast.kind).toBe("Program");
    expect(ast.moduleDecl.kind).toBe("ModuleDecl");
    expect(hasErrors).toBe(true);
    expect(bag.getAll().some((d) => d.code === DiagCode.MissingModuleDecl)).toBe(true);
  });

  // ----- Second module (FR-13) -----
  it("ST-P7: two `module` declarations → E10002 on the second; one ProgramNode", () => {
    const bag = createDiagnosticBag();
    const { ast } = parseSource("module A;\nmodule B;", bag);
    expect(ast.kind).toBe("Program");
    expect(ast.moduleDecl.name).toBe("A");
    expect(bag.getAll().some((d) => d.code === DiagCode.ModuleDeclNotFirst)).toBe(true);
  });

  // ----- Import (FR-14) -----
  it("ST-P8: `import { a, b } from Foo.Bar;` → ImportStmtNode with symbols + path", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource("module M;\nimport { a, b } from Foo.Bar;", bag);
    expect(hasErrors).toBe(false);
    expect(ast.items).toHaveLength(1);
    const imp = ast.items[0]!;
    expect(imp.kind).toBe("ImportStmt");
    if (imp.kind !== "ImportStmt") {
      throw new Error("expected ImportStmt");
    }
    expect(imp.symbols.map((s) => s.name)).toEqual(["a", "b"]);
    expect(imp.modulePath).toBe("Foo.Bar");
  });

  // ----- Determinism -----
  it("parse() never throws and always returns a ParseResult", () => {
    const bag = createDiagnosticBag();
    expect(() => parseSource("module M;", bag)).not.toThrow();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Phase 6 — golden snapshots, span correctness, determinism, fuzz, performance
// ───────────────────────────────────────────────────────────────────────────

/** A representative valid program exercising many grammar productions. */
const VALID_PROGRAM = `module Game.Engine;
import { clear } from Std.Mem;

const WIDTH: byte = 40;

struct Point {
  x: byte;
  y: byte;
}

enum Dir { Up, Down = 2, Left, Right }

zeropage {
  cursor: word;
  flags: byte = 0;
}

let origin: Point = Point { x: 1, y: 2 };

interrupt function isr() {
  flags = flags + 1;
}

export function step(p: Point, n: byte): byte {
  let total: byte = 0;
  for (let i: byte = 0 to n step 2) {
    if (i < WIDTH) {
      total = total + p.x * 2 - peek($D020);
    } else {
      total = total + <byte>(i);
    }
  }
  while (total > 0) {
    total = total - 1;
  }
  switch (n) {
    case 1, 2:
      total = sizeof(Point);
      break;
    default:
      total = 0;
  }
  return total;
}
`;

/** A representative invalid program exercising sentinels + recovery. */
const INVALID_PROGRAM = `module Broken;
+
struct E { }
enum Z { }
const k: byte;
function good(): void {
  let x: 123 = 0;
  let y: byte = +;
}
`;

describe("golden AST snapshots (ST-P30/P31, AC-07)", () => {
  it("ST-P30: a representative valid program → committed AST snapshot, no errors", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource(VALID_PROGRAM, bag);
    expect(hasErrors).toBe(false);
    expect(bag.getAll()).toHaveLength(0);
    expect(serialize(ast)).toMatchSnapshot();
  });

  it("ST-P31: a representative invalid program → AST (with sentinels) + ordered diagnostics", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource(INVALID_PROGRAM, bag);
    expect(hasErrors).toBe(true);
    expect(serialize(ast)).toMatchSnapshot();
    expect(bag.getAll().map((d) => d.code)).toMatchSnapshot();
  });
});

describe("span correctness (ST-P32, AC-15, FR-9)", () => {
  it("ST-P32: every node's span lies within the source and is well-formed", () => {
    const bag = createDiagnosticBag();
    const { ast } = parseSource(VALID_PROGRAM, bag);
    forEachNode(ast, (n) => {
      expect(n.span.sourceId).toBe(SRC);
      expect(n.span.start).toBeGreaterThanOrEqual(0);
      expect(n.span.end).toBeGreaterThanOrEqual(n.span.start);
      expect(n.span.end).toBeLessThanOrEqual(VALID_PROGRAM.length);
    });
  });

  it("ST-P32: leaf-node spans extract their exact source text", () => {
    const bag = createDiagnosticBag();
    const { ast } = parseSource(VALID_PROGRAM, bag);
    const slice = (n: AstNode) => VALID_PROGRAM.slice(n.span.start, n.span.end);
    forEachNode(ast, (n) => {
      if (n.kind === "IdentExpr") {
        // A parenthesised primary (e.g. the `i` in `<byte>(i)`) re-wraps its span
        // over the parens (FR-42, no dedicated Paren node), so the lexeme is
        // *contained* in the slice rather than exactly equal to it.
        expect(slice(n)).toContain((n as unknown as { name: string }).name);
      } else if (n.kind === "NumericLitExpr") {
        expect(slice(n)).toContain((n as unknown as { raw: string }).raw);
      } else if (n.kind === "PrimitiveType") {
        expect(slice(n)).toBe((n as unknown as { name: string }).name);
      }
    });
  });
});

describe("determinism (ST-P9, AC-16)", () => {
  it("ST-P9: parsing the same tokens twice → byte-identical serialised AST + diagnostics", () => {
    const { tokens } = lex(SRC, VALID_PROGRAM, createDiagnosticBag());

    const bagA = createDiagnosticBag();
    const a = parse({ tokens, source: VALID_PROGRAM, sourceId: SRC, bag: bagA });
    const bagB = createDiagnosticBag();
    const b = parse({ tokens, source: VALID_PROGRAM, sourceId: SRC, bag: bagB });

    expect(JSON.stringify(serialize(a.ast))).toBe(JSON.stringify(serialize(b.ast)));
    expect(bagA.getAll()).toEqual(bagB.getAll());
  });
});

describe("no-throw fuzz (ST-P34, AC-14, FR-4)", () => {
  /** Every token kind the fuzzer may emit (the full vocabulary). */
  const ALL_KINDS: TokenKindValue[] = Object.values(TokenKind);

  /** A tiny deterministic LCG so the fuzz run is reproducible across machines. */
  function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  /**
   * Builds a random token array (always Eof-terminated) over a fixed buffer.
   * Token **kinds** are random — that is what we fuzz — but their spans are
   * monotonically increasing, exactly as the real lexer guarantees. The
   * parser's forward-progress guards rely on that monotonicity; feeding random,
   * non-monotonic spans would model an impossible lexer output, so we don't.
   */
  function randomTokens(rng: () => number, source: string, sourceId: SourceId): Token[] {
    const count = 1 + Math.floor(rng() * 12);
    const tokens: Token[] = [];
    let pos = 0;
    for (let i = 0; i < count; i++) {
      const kind = ALL_KINDS[Math.floor(rng() * ALL_KINDS.length)]!;
      if (kind === TokenKind.Eof) continue; // Eof is appended once at the end.
      const start = Math.min(source.length - 1, pos);
      const end = Math.min(source.length, start + 1 + Math.floor(rng() * 3));
      pos = end + 1;
      const span = makeSpan(sourceId, start, end);
      const token: Token =
        kind === TokenKind.Number
          ? { kind, span, value: Math.floor(rng() * 256) }
          : kind === TokenKind.String || kind === TokenKind.Char
            ? { kind, span, value: "x" }
            : { kind, span };
      tokens.push(token);
    }
    tokens.push({ kind: TokenKind.Eof, span: makeSpan(sourceId, source.length, source.length) });
    return tokens;
  }

  it("ST-P34: 1,000 random token sequences never throw and always return an AST", () => {
    const source = "abcdefghijklmnop ".repeat(8); // a safe buffer for lexeme slicing
    const rng = makeRng(0x5eed);
    for (let i = 0; i < 1000; i++) {
      const bag = createDiagnosticBag();
      const tokens = randomTokens(rng, source, SRC);
      let result: ReturnType<typeof parse> | undefined;
      expect(() => {
        result = parse({ tokens, source, sourceId: SRC, bag });
      }).not.toThrow();
      expect(result!.ast.kind).toBe("Program");
    }
  });
});

describe("performance (ST-P35, AC-17)", () => {
  // Budget note: this guard exists to catch a genuine algorithmic regression
  // (accidental super-linear parsing), NOT to enforce a hard micro-benchmark. The
  // parser runs ~10–20 ms locally; the original 50 ms budget flaked on shared
  // GitHub CI runners (observed 54–58 ms under CPU contention — runner noise, not
  // slowness). The budget is set to 250 ms: >4× headroom over observed CI noise,
  // yet a real quadratic blow-up on 10k+ tokens would take seconds and still trip
  // it.
  const PARSE_BUDGET_MS = 250;

  it(`ST-P35: a 10,000-token file parses within ${PARSE_BUDGET_MS} ms`, () => {
    // ~7 tokens per `let` line → ~1,500 lines ≈ 10,000+ tokens.
    let src = "module Perf;\n";
    for (let i = 0; i < 1500; i++) {
      src += `let a${i}: byte = ${i % 256};\n`;
    }
    const { tokens } = lex(SRC, src, createDiagnosticBag());
    expect(tokens.length).toBeGreaterThan(10000);

    const bag = createDiagnosticBag();
    const startedAt = performance.now();
    parse({ tokens, source: src, sourceId: SRC, bag });
    const elapsedMs = performance.now() - startedAt;
    expect(elapsedMs).toBeLessThan(PARSE_BUDGET_MS);
  });
});
