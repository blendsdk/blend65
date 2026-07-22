/**
 * Pass-1 function + local collection — the leading edge of declaration/scope
 * collection.
 *
 * This is the collector that turns the empty-model passthrough into a *real*
 * model the SFA adapter can project. For each program it finds-or-creates the
 * program's **module** `Scope` — module scopes are keyed by module NAME, so
 * several files declaring the same module share ONE scope (a module may span
 * multiple files; the first file's `ModuleDeclNode` stays the scope's
 * representative node) — registers every top-level `function`/`interrupt` as a
 * function `Symbol` declared **in that module scope** (so `fn.scope.node` is the
 * `ModuleDeclNode` the adapter reads for the fully-qualified name; a name
 * already taken in the module — same file or another file of the merged
 * module — is a duplicate declaration, E10003, first-wins), and
 * builds a function **body** `Scope` holding the function's parameters
 * (declaration order, before the locals; a duplicate name is E10003) followed
 * by its local variables (from body `LetDecl`s) in declaration order. It
 * resolves `mainFunction`. {@link checkLocalShadowing} — run separately, once
 * all module-level names exist — rejects a parameter or local shadowing a
 * module-level declaration (E10101).
 *
 * Each block additionally gets a nested `Scope` of its own holding the
 * declarations written inside it. Those scopes are what let a name USE resolve
 * to the declaration covering it — two sibling blocks may each declare `t` at
 * different widths, and each use must read its own. They do not change where a
 * variable lives: every local is still registered in the flat function scope
 * the frame layout reads, in the same order as before.
 *
 * No typing or name resolution happens here.
 *
 * Emit-diagnostic-never-throw: a malformed / body-less declaration is skipped,
 * not crashed on. This module lives in `@blend65/frontend` and imports
 * `@blend65/core` only — never `@blend65/codegen`.
 */

import { createScope, DiagCode, ERROR_TYPE, primitive } from "@blend65/core";
import type {
  AstNode,
  BlockNode,
  DiagnosticBag,
  ForStmtNode,
  FunctionDeclNode,
  InterruptDeclNode,
  LetDeclNode,
  ParameterNode,
  ProgramNode,
  Scope,
  SourceSpan,
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
   * Block-introducing node (`Block`, `ForStmt`, `CaseClause`, `DefaultClause`)
   * → the nested `Scope` its own declarations live in.
   *
   * These scopes exist so a NAME USE resolves to the declaration lexically
   * covering it rather than to whichever declaration of that name happened to
   * be collected last. Two sibling blocks may each declare `t` at different
   * widths; each use must read its own `t`'s width, or a wide read silently
   * truncates. Type checking threads these scopes, and `resolveName` is
   * already innermost-first, so per-use resolution falls out of the tree.
   *
   * They deliberately do NOT introduce block-scope *lifetime*: every local is
   * ALSO registered in the flat function body scope, so a use outside its
   * declaring block still resolves exactly as before. The frame layout reads
   * the flat scope, so slot order is untouched.
   */
  readonly blockScopeByNode: ReadonlyMap<AstNode, Scope>;
  /**
   * Each program → its module `Scope`, so later passes (import resolution)
   * can address a specific file's module scope without relying on the
   * global scope's child order. Files of the same module map to ONE scope.
   */
  readonly moduleScopeByProgram: ReadonlyMap<ProgramNode, Scope>;
  /**
   * Module name → its (shared) module `Scope` — one entry per distinct module,
   * consumed by import resolution and qualified-access resolution.
   */
  readonly moduleScopeByName: ReadonlyMap<string, Scope>;
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
  const blockScopeByNode = new Map<AstNode, Scope>();
  const moduleScopeByProgram = new Map<ProgramNode, Scope>();
  const moduleScopeByName = new Map<string, Scope>();
  let mainFunction: Symbol | null = null;

  for (const program of programs) {
    // Step 0 — the program's module scope (functions live in it), keyed by
    // module name so every file of one module shares ONE scope. The first
    // file's `ModuleDeclNode` stays the scope's representative node.
    // `moduleDecl` is always present per the parser contract; guard defensively.
    const moduleNode: AstNode | null = program.moduleDecl ?? null;
    const moduleName = program.moduleDecl?.name;
    let moduleScope = moduleName !== undefined ? moduleScopeByName.get(moduleName) : undefined;
    if (moduleScope === undefined) {
      moduleScope = createScope("module", globalScope, moduleNode);
      globalScope.children.push(moduleScope);
      if (moduleName !== undefined) moduleScopeByName.set(moduleName, moduleScope);
    }
    moduleScopeByProgram.set(program, moduleScope);

    for (const item of program.items) {
      if (item.kind !== "FunctionDecl" && item.kind !== "InterruptDecl") continue;

      // A name already declared in this module — an earlier function in the
      // same file, or any top-level name from another file of the merged
      // module — is a duplicate declaration. First-wins; the duplicate
      // contributes no symbol, no body scope, and is not typed.
      if (moduleScope.symbols.has(item.name)) {
        bag.addError(
          DiagCode.DuplicateDecl,
          item.nameSpan,
          `Duplicate declaration '${item.name}' in this module`,
        );
        continue;
      }

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

      // Step 2b — parameters, before locals: their insertion order is what the
      // frame layout reads. A body local of the same name is rejected as
      // shadowing, so the overwrite that follows in the flat map is only ever
      // reached on a program that has already errored. The type here is
      // provisional (primitive annotations resolve now; named/array/unsized
      // annotations finalize in the type-resolution pass, which also patches
      // `byRef` — an array annotation is known by-ref syntactically, a named
      // one only once it resolves to a struct rather than an enum). A const
      // parameter is read-only (`mutable: false`) — the write checks key on
      // this one bit. Interrupts take no parameters (AST shape). A duplicate
      // parameter name is E10003, first-wins.
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
            mutable: !param.isConst,
            byRef: param.paramType.kind === "ArrayType",
          });
        }
      }

      // Step 3 — the function's locals, in source order. Every local (nested
      // `let`s and each `for`-counter alike) lands in the FLAT function scope
      // so SFA assigns it a `__frame_*` slot, exactly as before: insertion
      // order is declaration order, and a repeated name keeps its first
      // position. Alongside that, each block gets a nested `Scope` holding its
      // OWN declarations, so a use resolves to the declaration covering it
      // instead of to the last one collected. A body-less/malformed
      // declaration contributes no locals.
      if (item.body !== null && item.body !== undefined) {
        collectBlockLocals(item.body, {
          bodyScope,
          block: bodyScope,
          enclosing: [],
          params: new Set(
            [...bodyScope.symbols.values()]
              .filter((s) => s.kind === "parameter")
              .map((s) => s.name),
          ),
          counters: new Set(),
          fnName: item.name,
          blockScopeByNode,
          bag,
        });
      }
    }
  }

  return {
    functions,
    mainFunction,
    scopeByNode,
    blockScopeByNode,
    moduleScopeByProgram,
    moduleScopeByName,
  };
}

/**
 * Rejects parameters and locals that shadow a module-level declaration (E10101).
 *
 * Runs as a separate step after ALL module-level names exist (functions,
 * module variables/constants, imported names) — collection itself runs before
 * module variables are collected, so the check cannot live inline there. The
 * shadowing a body can see on its own (a local over an enclosing block's local
 * or over a parameter) is caught during collection; only the module-level half
 * has to wait for this pass.
 *
 * @param scopeByNode Decl → body scope (from {@link collectFunctions}).
 * @param bag The diagnostic accumulator (receives E10101).
 */
export function checkLocalShadowing(
  scopeByNode: ReadonlyMap<AstNode, Scope>,
  bag: DiagnosticBag,
): void {
  for (const bodyScope of scopeByNode.values()) {
    const moduleScope = bodyScope.parent;
    if (moduleScope === null) continue;
    const decl = bodyScope.node;
    const fnName = isFunctionLikeDecl(decl) ? decl.name : "?";
    for (const sym of declaredSymbols(bodyScope)) {
      const moduleSym = moduleScope.symbols.get(sym.name);
      if (moduleSym === undefined) continue;
      if (sym.kind === "parameter") {
        bag.addError(
          DiagCode.NameShadows,
          isParameterNode(sym.decl) ? sym.decl.nameSpan : null,
          `Parameter '${sym.name}' of '${fnName}' shadows the module-level ` +
            `declaration of '${sym.name}'`,
        );
      } else if (sym.kind === "variable" && moduleSym.kind === "variable") {
        // Only a module VARIABLE is shadowed in the sense that matters: it is
        // storage, and a local of the same name hides it for the rest of the
        // function. A local named after a module function, constant, struct or
        // enum is ordinary code in any modern language and cannot collapse two
        // variables onto one slot, so it is left alone.
        bag.addError(
          DiagCode.NameShadows,
          declNameSpan(sym.decl),
          `Declaration of '${sym.name}' in function '${fnName}' shadows the ` +
            `module-level variable '${sym.name}'`,
        );
      }
    }
  }
}

/**
 * Every symbol a function body declares, each exactly once: the parameters and
 * the flat local copies in the body scope, then the block scopes' own
 * declarations. Locals appear in both places by design, so identity dedupes.
 *
 * This is the canonical way to enumerate a body's symbols now that a local
 * lives both in its block scope and in the flat function scope — walking
 * either one alone misses declarations or reports them twice.
 *
 * @param bodyScope The function body scope to walk from.
 * @returns The distinct declared symbols, outermost scope first.
 */
export function declaredSymbols(bodyScope: Scope): Symbol[] {
  const seen = new Set<Symbol>();
  const out: Symbol[] = [];
  const visit = (scope: Scope): void => {
    for (const sym of scope.symbols.values()) {
      if (seen.has(sym)) continue;
      seen.add(sym);
      out.push(sym);
    }
    for (const child of scope.children) visit(child);
  };
  visit(bodyScope);
  return out;
}

/** The span naming a local's declaration, for a diagnostic that points at it. */
function declNameSpan(decl: AstNode): SourceSpan | null {
  if (decl.kind === "LetDecl") return (decl as LetDeclNode).nameSpan;
  if (decl.kind === "ForStmt") return (decl as ForStmtNode).varNameSpan;
  return decl.span;
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
 * The lexical position local collection is currently at: which scopes a new
 * declaration lands in, and what it may legally shadow.
 */
interface LocalCtx {
  /** The flat function scope. Every local is registered here for frame layout. */
  readonly bodyScope: Scope;
  /** The scope the declarations being collected right now belong to. */
  readonly block: Scope;
  /** The block scopes strictly enclosing {@link block} — what a name may shadow. */
  readonly enclosing: readonly Scope[];
  /**
   * The function's parameter names, captured before any local is registered.
   * The flat scope cannot answer this later: registering a local overwrites
   * the parameter's entry there, so the second offender would go unreported.
   */
  readonly params: ReadonlySet<string>;
  /** The names of the `for` counters this position sits inside. */
  readonly counters: ReadonlySet<string>;
  /** The enclosing function's name, for diagnostic text. */
  readonly fnName: string;
  /** The block-scope index being built. */
  readonly blockScopeByNode: Map<AstNode, Scope>;
  /** The diagnostic accumulator (E10003 / E10101 / E10062). */
  readonly bag: DiagnosticBag;
}

/**
 * Opens a nested scope for a block-introducing node and returns the context
 * its declarations are collected in.
 *
 * The function body's own scope attaches directly to the function scope, so
 * the function scope — which also holds the flat copy of every local — is
 * never treated as an "enclosing block" a sibling could be said to shadow.
 */
function pushBlock(node: AstNode, ctx: LocalCtx): LocalCtx {
  const scope = createScope("block", ctx.block, node);
  ctx.block.children.push(scope);
  ctx.blockScopeByNode.set(node, scope);
  return {
    ...ctx,
    block: scope,
    enclosing: ctx.block === ctx.bodyScope ? [] : [...ctx.enclosing, ctx.block],
  };
}

/** Harvests the locals of one block into a scope of its own. */
function collectBlockLocals(block: BlockNode, ctx: LocalCtx): void {
  const inner = pushBlock(block, ctx);
  for (const stmt of block.statements) collectStmtLocals(stmt, inner);
}

/** Harvests the locals of a statement list into a scope of its own. */
function collectClauseLocals(
  clause: AstNode,
  statements: readonly StmtNode[],
  ctx: LocalCtx,
): void {
  const inner = pushBlock(clause, ctx);
  for (const stmt of statements) collectStmtLocals(stmt, inner);
}

/** Harvests the local(s) a single statement introduces, recursing into bodies. */
function collectStmtLocals(stmt: StmtNode, ctx: LocalCtx): void {
  switch (stmt.kind) {
    case "LetDecl":
      registerLocal(ctx, stmt.name, stmt.declaredType, stmt, stmt.nameSpan, true, false);
      return;
    case "Block":
      collectBlockLocals(stmt, ctx);
      return;
    case "IfStmt":
      collectBlockLocals(stmt.thenBlock, ctx);
      if (stmt.elseClause !== null) {
        // A `Block` else, or a chained `else if` (an IfStmt) — recurse either way.
        if (stmt.elseClause.kind === "Block") {
          collectBlockLocals(stmt.elseClause, ctx);
        } else {
          collectStmtLocals(stmt.elseClause, ctx);
        }
      }
      return;
    case "WhileStmt":
    case "DoWhileStmt":
      collectBlockLocals(stmt.body, ctx);
      return;
    case "ForStmt": {
      // The counter is a read-only (`mutable:false`) local visible to the
      // bound, the step, and the body, so it gets a scope of its own that the
      // body's scope nests inside. Its type may be `null`/non-integer
      // (parser-optional annotation) — resolved defensively here; the
      // type-check pass emits E10065 and poisons it.
      const forCtx = pushBlock(stmt, ctx);
      registerLocal(forCtx, stmt.varName, stmt.varType, stmt, stmt.varNameSpan, false, true);
      collectBlockLocals(stmt.body, {
        ...forCtx,
        counters: new Set([...forCtx.counters, stmt.varName]),
      });
      return;
    }
    case "SwitchStmt":
      // Each clause body is a scope of its own — sibling clauses may reuse a
      // name, exactly as sibling `if`/`else` arms may. `stmt.defaultClause` is
      // always present (the parser synthesizes it).
      for (const clause of stmt.cases) collectClauseLocals(clause, clause.body, ctx);
      collectClauseLocals(stmt.defaultClause, stmt.defaultClause.body, ctx);
      return;
    default:
      // ExpressionStmt / ReturnStmt / Break / Continue / Const / error — none of
      // these introduce a function-frame local.
      return;
  }
}

/**
 * Registers one local `variable` symbol, rejecting the reuse shapes that would
 * otherwise collapse two distinct variables onto one frame slot.
 *
 * Three shapes are errors: a second declaration of the name in the SAME scope
 * (E10003), a declaration shadowing an enclosing block's local or one of the
 * function's parameters (E10101), and a `for` counter reusing the name of a
 * counter it is nested inside (E10062 — the inner loop would destroy the outer
 * loop's position). Sibling reuse is silent by design: two blocks that cannot
 * be live at once share one slot, which is the layout a hand-coder wants.
 *
 * The symbol lands in its own block scope (so each USE resolves to its own
 * declaration's type) and in the flat function scope (which the frame layout
 * reads, keeping slot order exactly as it has always been).
 */
function registerLocal(
  ctx: LocalCtx,
  name: string,
  declaredType: TypeNode | null,
  decl: AstNode,
  nameSpan: SourceSpan,
  mutable: boolean,
  isCounter: boolean,
): void {
  if (ctx.block.symbols.has(name)) {
    ctx.bag.addError(
      DiagCode.DuplicateDecl,
      nameSpan,
      `Duplicate declaration of '${name}' in function '${ctx.fnName}'`,
    );
    return; // first declaration wins, as it does for a duplicate parameter
  }

  if (isCounter && ctx.counters.has(name)) {
    ctx.bag.addError(
      DiagCode.NestedCounterReuse,
      nameSpan,
      `Nested for-loop counter '${name}' reuses the counter of an enclosing loop ` +
        `in function '${ctx.fnName}' — the inner loop would destroy the outer loop's position`,
    );
  } else {
    const shadowed = shadowedKind(name, ctx);
    if (shadowed !== null) {
      ctx.bag.addError(
        DiagCode.NameShadows,
        nameSpan,
        `Declaration of '${name}' in function '${ctx.fnName}' shadows the ${shadowed} ` +
          `of the same name`,
      );
    }
  }

  const sym: Symbol = {
    name,
    kind: "variable",
    type: primitiveFromTypeNode(declaredType),
    decl,
    scope: ctx.block,
    exported: false,
    mutable,
    byRef: false,
  };
  ctx.block.symbols.set(name, sym);
  // The flat copy: a `Map` keeps a repeated key at its FIRST insertion
  // position, so slot order is declaration order whether or not a name repeats.
  ctx.bodyScope.symbols.set(name, sym);
}

/**
 * What an about-to-be-declared local would shadow, or `null` if nothing.
 *
 * Innermost outwards: an enclosing block's local, then one of the function's
 * parameters. Module-level names are NOT checked here — they are collected
 * after this pass, so that half runs later (see {@link checkLocalShadowing}).
 */
function shadowedKind(name: string, ctx: LocalCtx): string | null {
  for (let i = ctx.enclosing.length - 1; i >= 0; i--) {
    if (ctx.enclosing[i]?.symbols.has(name) === true) return "local";
  }
  return ctx.params.has(name) ? "parameter" : null;
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
