/**
 * Pass-1 function + local collection — the leading edge of declaration/scope
 * collection.
 *
 * This is the collector that turns the empty-model passthrough into a *real*
 * model the SFA adapter can project. For each program it builds the program's
 * **module** `Scope`, registers every top-level `function`/`interrupt` as a
 * function `Symbol` declared **in that module scope** (so `fn.scope.node` is the
 * `ModuleDeclNode` the adapter reads for the fully-qualified name), and
 * builds a function **body** `Scope` holding the function's local variables (from
 * body `LetDecl`s) in declaration order. It resolves `mainFunction`.
 *
 * It is designed to be extended rather than replaced: later work adds the full
 * scope/symbol table + typing (module registration, export visibility,
 * duplicate-decl E10003, block scopes, parameters) on top of it. Nothing here
 * does typing, name resolution, or duplicate detection yet.
 *
 * Emit-diagnostic-never-throw: a malformed / body-less declaration is skipped,
 * not crashed on. This module lives in `@blend65/frontend` and imports
 * `@blend65/core` only — never `@blend65/codegen`.
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
 * The function-level model data collected in Pass 1.
 */
export interface FunctionTables {
  /**
   * Every function/interrupt declaration as a resolved function `Symbol`. Each
   * carries `scope` = its declaring **module** `Scope`, so the adapter recovers
   * the module for the FQN from the model alone.
   */
  readonly functions: ReadonlySet<Symbol>;
  /** The resolved `main` function symbol, or `null` if absent. */
  readonly mainFunction: Symbol | null;
  /**
   * decl `AstNode` → its **body** scope (holding ordered locals), backing the
   * model's `scopeOf` query helper.
   */
  readonly scopeByNode: ReadonlyMap<AstNode, Scope>;
}

/**
 * Collects functions + locals across all programs into {@link FunctionTables}.
 * Never throws.
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
    // Step 0 — the program's module scope (functions live in it).
    // `moduleDecl` is always present per the parser contract; guard defensively.
    const moduleNode: AstNode | null = program.moduleDecl ?? null;
    const moduleScope = createScope("module", globalScope, moduleNode);
    globalScope.children.push(moduleScope);

    for (const item of program.items) {
      if (item.kind !== "FunctionDecl" && item.kind !== "InterruptDecl") continue;

      // Step 1 — the function `Symbol`, declared in the module scope. `type` stays
      // ERROR_TYPE here — nothing reads a function symbol's type at this stage;
      // Pass-3 typing assigns the real function type later.
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

      // Step 4 (entry selection) — first `main` wins; multi-file entry
      // selection is a Pass-4 duty handled downstream.
      if (item.kind === "FunctionDecl" && item.name === "main" && mainFunction === null) {
        mainFunction = fnSym;
      }

      // Step 2 — the function body scope, recorded for `scopeOf(decl)`.
      const bodyScope = createScope("function", moduleScope, item);
      moduleScope.children.push(bodyScope);
      scopeByNode.set(item, bodyScope);

      // Step 3 — the function's locals, in source order. This recurses into
      // control-flow bodies (flat-recurse): nested `let` locals AND each
      // `for`-counter land in the enclosing FUNCTION scope so SFA assigns every
      // one a `__frame_*` slot. No new `Scope` objects are created and no
      // duplicate detection is done (sibling-block locals silently alias,
      // last-wins — real block-scope lifetime + E10101/E10062 are deferred). A
      // body-less/malformed declaration contributes no locals.
      collectBodyLocals(item.body?.statements ?? [], bodyScope);
    }
  }

  return { functions, mainFunction, scopeByNode };
}

/**
 * Recursively harvests the local variables introduced anywhere in a function
 * body into its (flat) function `Scope`: top-level and control-flow-nested
 * `let` locals, plus each `for`-loop counter. No `Scope` nesting; insertion
 * order == source order.
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
      // The for-counter is a read-only (`mutable:false`) function local; it
      // is visible to the bound, step, and body. Its type may be `null`/non-integer
      // (parser-optional annotation) — resolved defensively here; the type-check
      // pass emits E10065 and poisons it. Counter first, then the body.
      registerLocal(bodyScope, stmt.varName, stmt.varType, stmt, false);
      collectBodyLocals(stmt.body.statements, bodyScope);
      return;
    case "SwitchStmt":
      // case/default body `let` locals are harvested flat into the enclosing
      // function scope (an SFA frame slot each), mirroring the `IfStmt`/`ForStmt`
      // recursion above. No block-scope lifetime (deferred). `stmt.defaultClause`
      // is always present (the parser synthesizes it).
      for (const clause of stmt.cases) collectBodyLocals(clause.body, bodyScope);
      collectBodyLocals(stmt.defaultClause.body, bodyScope);
      return;
    default:
      // ExpressionStmt / ReturnStmt / Break / Continue / Const / error — none of
      // these introduce a function-frame local.
      return;
  }
}

/** Registers one local `variable` symbol into the (flat) function scope. */
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
 * Maps a declared `TypeNode` to a resolved {@link Type} for this scalar
 * surface: a primitive node → its `primitive(name)`; everything else (inferred
 * `null`, named/array types outside this scalar surface) → {@link ERROR_TYPE}.
 * The SFA planner sizes an `ERROR_TYPE` slot defensively, so this never
 * crashes; real typing of non-primitives arrives later.
 *
 * @param node The declared type node, or `null` for an inferred `let`.
 * @returns The resolved primitive type, or `ERROR_TYPE`.
 */
function primitiveFromTypeNode(node: TypeNode | null): Type {
  return node !== null && node.kind === "PrimitiveType" ? primitive(node.name) : ERROR_TYPE;
}
