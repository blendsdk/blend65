/**
 * Pass-1 function + local collection for RD-18 Slice 3a (the leading edge of
 * RD-04 §4.2 declaration/scope collection; FR-1).
 *
 * This is the collector that turns the empty-model passthrough into a *real*
 * model the SFA adapter can project. For each program it builds the program's
 * **module** `Scope`, registers every top-level `function`/`interrupt` as a
 * function `Symbol` declared **in that module scope** (so `fn.scope.node` is the
 * `ModuleDeclNode` the adapter reads for the fully-qualified name — AR-13), and
 * builds a function **body** `Scope` holding the function's local variables (from
 * body `LetDecl`s) in declaration order (AR-6). It resolves `mainFunction`.
 *
 * It is a **reusable** slice: Slice 3b extends it with the full scope/symbol table
 * + typing (module registration, export visibility, duplicate-decl E10003, block
 * scopes, parameters) rather than replacing it (AR-5). Nothing here does typing,
 * name resolution, or duplicate detection yet.
 *
 * Emit-diagnostic-never-throw (AR-15/AR-73): a malformed / body-less declaration
 * is skipped, not crashed on. This module lives in `@blend65/frontend` and imports
 * `@blend65/core` only — never `@blend65/codegen` (R15/AR-20).
 */

import { createScope, ERROR_TYPE, primitive } from "@blend65/core";
import type {
  AstNode,
  ProgramNode,
  Scope,
  StmtNode,
  Symbol,
  Type,
  TypeNode,
} from "@blend65/core";

/**
 * The function-level model data collected in Pass 1 (Slice 3a surface).
 */
export interface FunctionTables {
  /**
   * Every function/interrupt declaration as a resolved function `Symbol`. Each
   * carries `scope` = its declaring **module** `Scope`, so the adapter recovers
   * the module for the FQN from the model alone (AR-13).
   */
  readonly functions: ReadonlySet<Symbol>;
  /** The resolved `main` function symbol, or `null` if absent. */
  readonly mainFunction: Symbol | null;
  /**
   * decl `AstNode` → its **body** scope (holding ordered locals), backing the
   * model's `scopeOf` query helper (AR-10).
   */
  readonly scopeByNode: ReadonlyMap<AstNode, Scope>;
}

/**
 * Collects functions + locals across all programs into {@link FunctionTables}
 * (Slice 3a; RD-04 R2 leading edge). Never throws.
 *
 * @param programs The parsed program ASTs (one per source file).
 * @param globalScope The model's global scope (root; parent of the module scopes).
 * @returns The collected function symbols, `mainFunction`, and decl → body-scope map.
 */
export function collectFunctions(
  programs: readonly ProgramNode[],
  globalScope: Scope,
): FunctionTables {
  const functions = new Set<Symbol>();
  const scopeByNode = new Map<AstNode, Scope>();
  let mainFunction: Symbol | null = null;

  for (const program of programs) {
    // Step 0 — the program's module scope (RD-04 §4.2: functions live in it, AR-13).
    // `moduleDecl` is always present per the parser contract; guard defensively.
    const moduleNode: AstNode | null = program.moduleDecl ?? null;
    const moduleScope = createScope("module", globalScope, moduleNode);
    globalScope.children.push(moduleScope);

    for (const item of program.items) {
      if (item.kind !== "FunctionDecl" && item.kind !== "InterruptDecl") continue;

      // Step 1 — the function `Symbol`, declared in the module scope. `type` stays
      // ERROR_TYPE in 3a — nothing reads a function symbol's type here, and 3b's
      // Pass-3 typing assigns the real function type (PF-006).
      const fnSym: Symbol = {
        name: item.name,
        kind: item.kind === "InterruptDecl" ? "interrupt" : "function",
        type: ERROR_TYPE,
        decl: item,
        scope: moduleScope,
        exported: item.exported,
        mutable: false,
        byRef: false,
      };
      moduleScope.symbols.set(item.name, fnSym);
      functions.add(fnSym);

      // Step 4 (entry selection) — first `main` wins (PF-005); multi-file entry
      // selection is a Slice-3b Pass-4 duty.
      if (item.kind === "FunctionDecl" && item.name === "main" && mainFunction === null) {
        mainFunction = fnSym;
      }

      // Step 2 — the function body scope, recorded for `scopeOf(decl)` (AR-10).
      const bodyScope = createScope("function", moduleScope, item);
      moduleScope.children.push(bodyScope);
      scopeByNode.set(item, bodyScope);

      // Step 3 — the function's locals, in source order (AR-6). RD-18 Slice 4a
      // recurses into control-flow bodies (flat-recurse, AR-9): nested `let`
      // locals AND each `for`-counter land in the enclosing FUNCTION scope so SFA
      // assigns every one a `__frame_*` slot. No new `Scope` objects are created
      // and no duplicate detection is done (sibling-block locals silently alias,
      // last-wins — real block-scope lifetime + E10101/E10062 are deferred,
      // AR-2/AR-5). A body-less/malformed declaration contributes no locals.
      collectBodyLocals(item.body?.statements ?? [], bodyScope);
    }
  }

  return { functions, mainFunction, scopeByNode };
}

/**
 * Recursively harvests the local variables introduced anywhere in a function
 * body into its (flat) function `Scope` (RD-18 Slice 4a §B, AR-9): top-level and
 * control-flow-nested `let` locals, plus each `for`-loop counter. No `Scope`
 * nesting; insertion order == source order.
 *
 * @param statements The statements to scan (a block's `statements`).
 * @param bodyScope The enclosing function scope every local is registered into.
 */
function collectBodyLocals(statements: readonly StmtNode[], bodyScope: Scope): void {
  for (const stmt of statements) collectStmtLocals(stmt, bodyScope);
}

/** Harvests the local(s) a single statement introduces, recursing into bodies. */
function collectStmtLocals(stmt: StmtNode, bodyScope: Scope): void {
  switch (stmt.kind) {
    case "LetDecl":
      registerLocal(bodyScope, stmt.name, stmt.declaredType, stmt, true);
      return;
    case "Block":
      collectBodyLocals(stmt.statements, bodyScope);
      return;
    case "IfStmt":
      collectBodyLocals(stmt.thenBlock.statements, bodyScope);
      if (stmt.elseClause !== null) {
        // A `Block` else, or a chained `else if` (an IfStmt) — recurse either way.
        if (stmt.elseClause.kind === "Block") {
          collectBodyLocals(stmt.elseClause.statements, bodyScope);
        } else {
          collectStmtLocals(stmt.elseClause, bodyScope);
        }
      }
      return;
    case "WhileStmt":
    case "DoWhileStmt":
      collectBodyLocals(stmt.body.statements, bodyScope);
      return;
    case "ForStmt":
      // The for-counter is a read-only (`mutable:false`, AR-5) function local; it
      // is visible to the bound, step, and body. Its type may be `null`/non-integer
      // (parser-optional annotation) — resolved defensively here; the type-check
      // pass emits E10065 and poisons it (AR-15). Counter first, then the body.
      registerLocal(bodyScope, stmt.varName, stmt.varType, stmt, false);
      collectBodyLocals(stmt.body.statements, bodyScope);
      return;
    default:
      // ExpressionStmt / ReturnStmt / Break / Continue / Const / Switch / error —
      // introduce no function-frame local in the Slice-4a surface.
      return;
  }
}

/** Registers one local `variable` symbol into the (flat) function scope (AR-6/AR-9). */
function registerLocal(
  bodyScope: Scope,
  name: string,
  declaredType: TypeNode | null,
  decl: AstNode,
  mutable: boolean,
): void {
  const sym: Symbol = {
    name,
    kind: "variable",
    type: primitiveFromTypeNode(declaredType),
    decl,
    scope: bodyScope,
    exported: false,
    mutable,
    byRef: false,
  };
  bodyScope.symbols.set(name, sym); // insertion order == declaration order (last-wins)
}

/**
 * Maps a declared `TypeNode` to a resolved {@link Type} for the 3a surface: a
 * primitive node → its `primitive(name)`; everything else (inferred `null`,
 * named/array types out of the 3a scalar surface) → {@link ERROR_TYPE}. The SFA
 * planner sizes an `ERROR_TYPE` slot defensively, so this never crashes; real
 * typing of non-primitives arrives with Slice 3b / Slice 7.
 *
 * @param node The declared type node, or `null` for an inferred `let`.
 * @returns The resolved primitive type, or `ERROR_TYPE`.
 */
function primitiveFromTypeNode(node: TypeNode | null): Type {
  return node !== null && node.kind === "PrimitiveType" ? primitive(node.name) : ERROR_TYPE;
}
