/**
 * Unit tests for the {@link NodeKind} AST vocabulary.
 *
 * Verifies the enumerated node-kind set is pinned at exactly 51 kinds, every
 * value equals its key (the string-valued convention mirroring `TokenKind`),
 * no duplicates, and the per-group counts (3 + 11 + 13 + 18 + 3 + 3) are guarded so
 * a category can never silently drift.
 */

import { describe, expect, it } from "vitest";
import { NODE_KINDS } from "./node-kind.js";

describe("NodeKind vocabulary (ST-P1)", () => {
  it("enumerates exactly 51 kinds (ArrayLitExpr joined the expression group)", () => {
    // 3 source + 11 declaration + 13 statement + 18 expression + 3 type +
    // 3 error sentinel = 51.
    expect(NODE_KINDS.length).toBe(51);
  });

  it("assigns no duplicate kinds", () => {
    expect(new Set(NODE_KINDS).size).toBe(NODE_KINDS.length);
  });

  it("does NOT contain the removed AsmBlock kind (AR-1)", () => {
    expect(NODE_KINDS as readonly string[]).not.toContain("AsmBlock");
  });

  it("spot-checks one kind per category", () => {
    const set = new Set<string>(NODE_KINDS);
    expect(set.has("Program")).toBe(true); // source structure
    expect(set.has("FunctionDecl")).toBe(true); // declaration
    expect(set.has("SwitchStmt")).toBe(true); // statement
    expect(set.has("IntrinsicCallExpr")).toBe(true); // expression
    expect(set.has("ArrayType")).toBe(true); // type
    expect(set.has("ErrorType")).toBe(true); // error sentinel
  });

  it("guards per-group membership counts (3/11/13/18/3/3)", () => {
    const set = new Set<string>(NODE_KINDS);
    const source = ["Program", "ModuleDecl", "ImportStmt"];
    const decls = [
      "FunctionDecl",
      "InterruptDecl",
      "StructDecl",
      "StructField",
      "EnumDecl",
      "EnumMember",
      "LetDecl",
      "ConstDecl",
      "ZeropageBlock",
      "ZeropageField",
      "Parameter",
    ];
    const stmts = [
      "Block",
      "IfStmt",
      "WhileStmt",
      "DoWhileStmt",
      "ForStmt",
      "SwitchStmt",
      "CaseClause",
      "DefaultClause",
      "ReturnStmt",
      "BreakStmt",
      "ContinueStmt",
      "FallthroughStmt",
      "ExpressionStmt",
    ];
    const exprs = [
      "AssignExpr",
      "ConditionalExpr",
      "BinaryExpr",
      "UnaryExpr",
      "CastExpr",
      "FieldAccessExpr",
      "IndexExpr",
      "CallExpr",
      "IntrinsicCallExpr",
      "IdentExpr",
      "NumericLitExpr",
      "BoolLitExpr",
      "StringLitExpr",
      "CharLitExpr",
      "StructLitExpr",
      "StructLitField",
      "ArrayLitExpr",
      "EmbedExpr",
    ];
    const types = ["PrimitiveType", "NamedType", "ArrayType"];
    const errors = ["ErrorExpr", "ErrorStmt", "ErrorType"];

    expect(source.length).toBe(3);
    expect(decls.length).toBe(11);
    expect(stmts.length).toBe(13);
    expect(exprs.length).toBe(18);
    expect(types.length).toBe(3);
    expect(errors.length).toBe(3);

    for (const kind of [...source, ...decls, ...stmts, ...exprs, ...types, ...errors]) {
      expect(set.has(kind), kind).toBe(true);
    }
  });
});
