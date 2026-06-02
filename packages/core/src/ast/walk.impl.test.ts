/**
 * Unit tests for the AST traversal helpers (RD-03 FR-48).
 *
 * Covers spec case ST-P3 from plans/rd-03-parser-ast/07-testing-strategy.md:
 * `walkNode` dispatches each node to its matching `visit*` method, and
 * `walkChildren` performs a depth-first visit of every child of a hand-built
 * tree. The visitor contract is otherwise enforced statically by the type
 * checker (exhaustive `switch` with a `never` default arm).
 */

import { describe, expect, it } from "vitest";
import { makeSpan, type SourceSpan } from "../diagnostics/index.js";
import type { AstNode, BinaryExprNode, IdentExprNode, NumericLitExprNode } from "./nodes.js";
import { walkChildren, walkNode } from "./walk.js";
import type { AstVisitor } from "./visitor.js";

const SID = 0;
const span = (start: number, end: number): SourceSpan => makeSpan(SID, start, end);

/**
 * A partial visitor that records the kind of every node it is invoked on.
 *
 * It deliberately implements only the handful of `visit*` methods this test
 * exercises (not the full 50-method {@link AstVisitor} contract); call sites
 * cast it to `AstVisitor<void>` since `walkNode`/`walkChildren` only ever invoke
 * the methods matching the kinds present in the hand-built trees below.
 */
class RecordingVisitor {
  readonly visited: string[] = [];
  protected record(node: AstNode): void {
    this.visited.push(node.kind);
  }

  visitBinaryExpr(node: BinaryExprNode): void {
    this.record(node);
  }
  visitIdentExpr(node: IdentExprNode): void {
    this.record(node);
  }
  visitNumericLitExpr(node: NumericLitExprNode): void {
    this.record(node);
  }
}

function makeIdent(name: string, start: number): IdentExprNode {
  return { kind: "IdentExpr", span: span(start, start + name.length), name };
}

function makeNumber(value: number, raw: string, start: number): NumericLitExprNode {
  return { kind: "NumericLitExpr", span: span(start, start + raw.length), value, raw };
}

describe("walkNode dispatch (ST-P3)", () => {
  it("dispatches a node to its matching visit* method", () => {
    const ident = makeIdent("x", 0);
    const visitor = new RecordingVisitor();
    walkNode(ident, visitor as unknown as AstVisitor<void>);
    expect(visitor.visited).toEqual(["IdentExpr"]);
  });

  it("dispatches different kinds to different methods", () => {
    const num = makeNumber(42, "42", 4);
    const visitor = new RecordingVisitor();
    walkNode(num, visitor as unknown as AstVisitor<void>);
    expect(visitor.visited).toEqual(["NumericLitExpr"]);
  });
});

describe("walkChildren traversal (ST-P3)", () => {
  it("visits every direct child of a binary expression", () => {
    // x + 42
    const left = makeIdent("x", 0);
    const right = makeNumber(42, "42", 4);
    const bin: BinaryExprNode = {
      kind: "BinaryExpr",
      span: span(0, 6),
      op: "+",
      left,
      right,
    };
    const visitor = new RecordingVisitor();
    walkChildren(bin, visitor as unknown as AstVisitor<void>);
    expect(visitor.visited).toEqual(["IdentExpr", "NumericLitExpr"]);
  });
});
