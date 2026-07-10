/**
 * Pass-1 function + local collection — the leading edge of declaration/scope
 * collection.
 *
 * This is the collector that turns the empty-model passthrough into a *real*
 * model the SFA adapter can project. For each program it builds the program's
 * **module** `Scope`, registers every top-level `function`/`interrupt` as a
 * function `Symbol` declared **in that module scope** (so `fn.scope.node` is the
 * `ModuleDeclNode` the adapter reads for the fully-qualified name), and
 * builds a function **body** `Scope` holding the function's parameters
 * (declaration order, before the locals; a duplicate name is E10003) followed
 * by its local variables (from body `LetDecl`s) in declaration order. It
 * resolves `mainFunction`. {@link checkParameterShadowing} — run separately,
 * once all module-level names exist — rejects a parameter shadowing a
 * module-level declaration (E10101).
 *
 * It is designed to be extended rather than replaced: later work adds block
 * scopes and the remaining visibility rules on top of it. No typing or name
 * resolution happens here.
 *
 * Emit-diagnostic-never-throw: a malformed / body-less declaration is skipped,
 * not crashed on. This module lives in `@blend65/frontend` and imports
 * `@blend65/core` only — never `@blend65/codegen`.
 */

import { createScope, DiagCode, ERROR_TYPE, primitive } from "@blend65/core";
import type {
  AstNode,
  DiagnosticBag,
  FunctionDeclNode,
  InterruptDeclNode,
  ParameterNode,
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
   * decl `AstNode` → its **body** scope (holding ordered parameters + locals),
   * backing the model's `scopeOf` query helper.
   */
  readonly scopeByNode: ReadonlyMap<AstNode, Scope>;
  /**
   * Each program → its module `Scope`, so later passes (import resolution)
   * can address a specific file's module scope without relying on the
   * global scope's child order.
   */
  readonly moduleScopeByProgram: ReadonlyMap<ProgramNode, Scope>;
}

/**
 * Collects functions + parameters + locals across all programs into
 * {@link FunctionTables}. Never throws.
 *
 * @param programs The parsed program ASTs (one per source file).
 * @param globalScope The model's global scope (root; parent of the module scopes).
 * @param bag The diagnostic accumulator (receives duplicate-parameter E10003).
 * @returns The collected function symbols, `mainFunction`, and scope maps.
 */
export function collectFunctions(
  programs: readonly ProgramNode[],
  globalScope: Scope,
  bag: DiagnosticBag,
): FunctionTables {
  const functions = new Set<Symbol>();
  const scopeByNode = new Map<AstNode, Scope>();
  const moduleScopeByProgram = new Map<ProgramNode, Scope>();
  let mainFunction: Symbol | null = null;

  for (const program of programs) {
    // Step 0 — the program's module scope (functions live in it).
    // `moduleDecl` is always present per the parser contract; guard defensively.
    const moduleNode: AstNode | null = program.moduleDecl ?? null;
    const moduleScope = createScope("module", globalScope, moduleNode);
    globalScope.children.push(moduleScope);
    moduleScopeByProgram.set(program, moduleScope);

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

      // Step 2b — parameters, before locals (their insertion order is what the
      // frame layout reads, and a body local of the same name deliberately
      // wins over its parameter — flat-scope last-wins). Scalars only: struct
      // and array parameters (and with them `byRef`) are not supported yet.
      // Interrupts take no parameters (AST shape). A duplicate parameter name
      // is E10003, first-wins.
      if (item.kind === "FunctionDecl") {
        for (const param of item.params) {
          if (bodyScope.symbols.has(param.name)) {
            bag.addError(
              DiagCode.DuplicateDecl,
              param.nameSpan,
              `Duplicate parameter '${param.name}' in function '${item.name}'`,
            );
            continue;
          }
          bodyScope.symbols.set(param.name, {
            name: param.name,
            kind: "parameter",
            type: primitiveFromTypeNode(param.paramType),
            decl: param,
            scope: bodyScope,
            exported: false,
            mutable: true,
            byRef: false,
          });
        }
      }

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

  return { functions, mainFunction, scopeByNode, moduleScopeByProgram };
}

/**
 * Rejects parameters that shadow a module-level declaration (E10101).
 *
 * Runs as a separate step after ALL module-level names exist (functions,
 * module variables/constants, imported names) — parameter collection itself
 * runs before module variables are collected, so the check cannot live
 * inline there. A parameter's own body scope legitimately shadows nothing;
 * only a hit in the enclosing module scope is an error.
 *
 * @param scopeByNode Decl → body scope (from {@link collectFunctions}).
 * @param bag The diagnostic accumulator (receives E10101).
 */
export function checkParameterShadowing(
  scopeByNode: ReadonlyMap<AstNode, Scope>,
  bag: DiagnosticBag,
): void {
  for (const bodyScope of scopeByNode.values()) {
    const moduleScope = bodyScope.parent;
    if (moduleScope === null) continue;
    const decl = bodyScope.node;
    const fnName = isFunctionLikeDecl(decl) ? decl.name : "?";
    for (const sym of bodyScope.symbols.values()) {
      if (sym.kind !== "parameter") continue;
      if (moduleScope.symbols.has(sym.name)) {
        bag.addError(
          DiagCode.NameShadows,
          isParameterNode(sym.decl) ? sym.decl.nameSpan : null,
          `Parameter '${sym.name}' of '${fnName}' shadows the module-level ` +
            `declaration of '${sym.name}'`,
        );
      }
    }
  }
}

/** Narrows a scope's introducing node to a function-like declaration. */
function isFunctionLikeDecl(
  node: AstNode | null,
): node is FunctionDeclNode | InterruptDeclNode {
  return node !== null && (node.kind === "FunctionDecl" || node.kind === "InterruptDecl");
}

/** Narrows a symbol's declaring node to a {@link ParameterNode}. */
function isParameterNode(node: AstNode): node is ParameterNode {
  return node.kind === "Parameter";
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
