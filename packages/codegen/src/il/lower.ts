/**
 * AST→IL lowering for the currently supported language surface.
 *
 * `lowerToIL` walks the validated AST and emits an {@link ILProgram}. Only
 * the currently supported surface is lowered; every other AST node kind reaches
 * a visitor **default arm** that raises an `E90001` ICE and returns a
 * poison operand so the walk continues deterministically — it **never throws**.
 * The lowering itself is real and fixture-tested today; only the live façade
 * wiring (a populated `SemanticModel`) is deferred, so under the live passthrough
 * the program is empty and this returns an empty `ILProgram`.
 *
 * Two design decisions shape the textual surface:
 * - Function-header params are the plan-backed frame-slot `Location`
 *   operands, rendered verbatim (`__frame_Math_add_a: i8u`).
 * - The `poke`/`peek` address lowers to a **symbolic `location`**
 *   (`$D020`), not a decimal immediate, keeping addresses symbolic until the
 *   ACME emitter resolves them, matching the printer with no change.
 */

import { byteSize, createIntrinsicRegistry, DiagCode, IceCode, primitive, walkChildren, walkNode } from "@blend65/core";
import type {
  AstNode,
  AstVisitor,
  BinaryExprNode,
  BinaryOp,
  BlockNode,
  CallExprNode,
  DiagnosticBag,
  DoWhileStmtNode,
  ExprNode,
  FieldAccessExprNode,
  ForStmtNode,
  FunctionDeclNode,
  FunctionFrame,
  IdentExprNode,
  IfStmtNode,
  InterruptDeclNode,
  WhileStmtNode,
  IntrinsicCallExprNode,
  IntrinsicDescriptor,
  IntrinsicRegistry,
  LetDeclNode,
  AssignExprNode,
  ModuleDeclNode,
  NumericLitExprNode,
  PrimitiveName,
  ProgramNode,
  ReturnStmtNode,
  SemanticModel,
  AllocationPlan,
  StmtNode,
  Symbol,
  SwitchStmtNode,
  Type,
  TypeNode,
} from "@blend65/core";

import { IL_BYTE, IL_WORD, ilTypeOfType } from "./il-type.js";
import type { ILType } from "./il-type.js";
import { imm, isTemp, loc } from "./operand.js";
import type { ILOperand } from "./operand.js";
import type { ILInstruction } from "./instruction.js";
import type { BasicBlock, ILFunction, ILProgram } from "./cfg.js";
import { IlFunctionBuilder } from "./builder.js";

/**
 * The lowering entry point's input: the AST roots plus the semantic model
 * and allocation plan that resolve types and addresses.
 */
export interface LowerInput {
  /** AST roots. */
  readonly program: readonly ProgramNode[];
  /** Semantic model (typed AST, symbols, const values, struct/enum tables). */
  readonly model: SemanticModel;
  /** Allocation plan (frame/zp/symbol addresses). */
  readonly plan: AllocationPlan;
  /**
   * The intrinsic registry. When absent, a core-only registry is built
   * internally so existing callers/tests keep working (non-breaking).
   */
  readonly registry?: IntrinsicRegistry;
}

/** AST binary operators that lower to a same-width IL binary instruction. */
const BINARY_OP_TO_IL: Partial<Record<BinaryOp, ILInstruction["op"]>> = {
  "+": "add",
  "-": "sub",
  "*": "mul",
  "/": "div",
  "%": "mod",
  "&": "and",
  "|": "or",
  "^": "xor",
  "<<": "shl",
  ">>": "shr",
  "==": "eq",
  "!=": "ne",
  "<": "lt",
  "<=": "le",
  ">": "gt",
  ">=": "ge",
};

/** IL opcodes whose result is always an `IL_BYTE` 0/1. */
const COMPARISON_RESULT_OPS = new Set(["eq", "ne", "lt", "le", "gt", "ge"]);

/** A loop's branch targets for `break`/`continue` lowering. */
interface LoopContext {
  /** The label `break` branches to (the loop's end block). */
  readonly breakTarget: string;
  /** The label `continue` branches to (`cond` for while/do-while, `incr` for for). */
  readonly continueTarget: string;
}

/** Per-function lowering context threaded through the statement/expression walk. */
interface LowerCtx {
  readonly builder: IlFunctionBuilder;
  readonly fqName: string;
  readonly frame: FunctionFrame | undefined;
  readonly bag: DiagnosticBag;
  /** The semantic model (symbol resolution, call graph, sizeof/offsetof folds). */
  readonly model: SemanticModel;
  /** The intrinsic registry (descriptor lookup for strategy dispatch). */
  readonly registry: IntrinsicRegistry;
  /** The enclosing-loop stack for `break`/`continue`. */
  readonly loopStack: LoopContext[];
  /** The allocation plan (callee frame slots for the calling convention). */
  readonly plan: AllocationPlan;
  /**
   * `true` while lowering the module-initializer stream. There is no frame in
   * that context, so a reference that resolves to neither a module variable
   * nor a constant is a compiler bug and must fail loudly — never fall back
   * to the (byte-defaulting) frame-slot path.
   */
  readonly moduleInit: boolean;
}

/**
 * Lower the validated AST + model + plan to IL. Never throws: user
 * errors are caught upstream; this emits only `E90001` ICEs for AST shapes it
 * does not yet handle. Functions carrying an `ErrorType`/error node are skipped.
 *
 * @param input The AST roots, semantic model, and allocation plan.
 * @param bag The diagnostic sink for ICEs.
 * @returns The lowered, frozen {@link ILProgram}.
 */
export function lowerToIL(input: LowerInput, bag: DiagnosticBag): ILProgram {
  const registry = input.registry ?? createIntrinsicRegistry();
  const functions: ILFunction[] = [];
  for (const program of input.program) {
    const moduleName = program.moduleDecl.name;
    for (const item of program.items) {
      if (item.kind === "FunctionDecl" || item.kind === "InterruptDecl") {
        if (hasErrorNode(item)) {
          continue; // skip functions tainted by an ErrorType/error node
        }
        functions.push(lowerFunction(item, moduleName, input.plan, input.model, registry, bag));
      }
    }
  }

  // Module initializers: one generated init stream (stores in the model's
  // initialization order, closed by `ret` — the startup shim calls it once
  // before the entry function). Initializer-free programs keep the stream
  // empty, so their output is byte-identical to before.
  const init =
    input.model.initOrder.length > 0
      ? lowerInitCode(input, registry, bag)
      : { blocks: Object.freeze([] as const), tempCount: 0 };

  return Object.freeze({
    functions: Object.freeze(functions),
    initCode: init.blocks,
    initTempCount: init.tempCount,
    constData: Object.freeze([]),
    allocationPlan: input.plan,
  });
}

/**
 * Lower the module-variable initializers into the init stream: for each
 * symbol in the model's initialization order, evaluate its initializer
 * expression and store the value to the variable's storage symbol. The
 * stream is built like a void function body (same builder, same expression
 * lowering) and closed with `ret`, so translation and the startup call reuse
 * the ordinary function machinery.
 */
function lowerInitCode(
  input: LowerInput,
  registry: IntrinsicRegistry,
  bag: DiagnosticBag,
): { blocks: readonly BasicBlock[]; tempCount: number } {
  // Initializer expressions, keyed by their declared symbol (typing records
  // the declaration-node → symbol entry).
  const initializers = new Map<Symbol, ExprNode>();
  for (const program of input.program) {
    for (const item of program.items) {
      if (item.kind !== "LetDecl" || item.initialiser === null) continue;
      const sym = input.model.symbolOf(item);
      if (sym !== null) initializers.set(sym, item.initialiser);
    }
  }

  const builder = new IlFunctionBuilder("__init", [], "void", false);
  const ctx: LowerCtx = {
    builder,
    fqName: "__init",
    frame: undefined,
    bag,
    model: input.model,
    registry,
    loopStack: [],
    plan: input.plan,
    moduleInit: true,
  };
  for (const sym of input.model.initOrder) {
    const init = initializers.get(sym);
    if (init === undefined) continue; // defensive — the order holds initialized vars only
    const value = lowerExpr(init, ctx);
    const target = moduleVarLocOfSymbol(sym);
    if (target === null) {
      iceUnsupported(init, ctx, "module initializer target (not a module variable)");
      continue;
    }
    builder.emit({ op: "store", a: value, b: loc(target.symbol, target.type) });
  }
  const fn = builder.finish({ kind: "ret" });
  return { blocks: [...fn.blocks], tempCount: fn.tempCount };
}

/** Lower one function/interrupt declaration into a single-block `ILFunction`. */
function lowerFunction(
  fn: FunctionDeclNode | InterruptDeclNode,
  moduleName: string,
  plan: AllocationPlan,
  model: SemanticModel,
  registry: IntrinsicRegistry,
  bag: DiagnosticBag,
): ILFunction {
  const fqName = `${moduleName}.${fn.name}`;
  const frame = plan.frames.get(fqName)?.frame;
  const isInterrupt = fn.kind === "InterruptDecl";

  const params: ILOperand[] =
    fn.kind === "FunctionDecl"
      ? fn.params.map((p) => loc(frameSymbol(fqName, p.name), slotIlType(frame, p.name)))
      : [];
  const returnType = fn.kind === "FunctionDecl" ? typeNodeToIl(fn.returnType) : "void";

  const builder = new IlFunctionBuilder(fqName, params, returnType, isInterrupt);
  const ctx: LowerCtx = {
    builder,
    fqName,
    frame,
    bag,
    model,
    registry,
    loopStack: [],
    plan,
    moduleInit: false,
  };

  lowerBlock(fn.body, ctx);

  // Fall-through end of a function closes the entry block with `ret()`.
  return builder.finish({ kind: "ret" });
}

/**
 * Lower a block's statements in order into the current block. Stops emitting once
 * the current block is terminated: statements after a
 * `return`/`break`/`continue` are unreachable and must not append to a terminated
 * block (keeps every block single-terminator).
 */
function lowerBlock(blockNode: BlockNode, ctx: LowerCtx): void {
  for (const stmt of blockNode.statements) {
    if (ctx.builder.isTerminated()) break;
    lowerStmt(stmt, ctx);
  }
}

/** Lower a single statement; unsupported statement kinds fall to the ICE default. */
function lowerStmt(stmt: StmtNode, ctx: LowerCtx): void {
  switch (stmt.kind) {
    case "Block":
      lowerBlock(stmt, ctx);
      return;
    case "LetDecl":
      lowerLetDecl(stmt, ctx);
      return;
    case "ExpressionStmt":
      // Lower for side effects (e.g. poke); the produced operand is discarded.
      lowerExpr(stmt.expression, ctx);
      return;
    case "ReturnStmt":
      lowerReturn(stmt, ctx);
      return;
    case "IfStmt":
      lowerIf(stmt, ctx);
      return;
    case "WhileStmt":
      lowerWhile(stmt, ctx);
      return;
    case "DoWhileStmt":
      lowerDoWhile(stmt, ctx);
      return;
    case "ForStmt":
      lowerFor(stmt, ctx);
      return;
    case "SwitchStmt":
      lowerSwitch(stmt, ctx);
      return;
    case "BreakStmt":
      lowerBreak(stmt, ctx);
      return;
    case "ContinueStmt":
      lowerContinue(stmt, ctx);
      return;
    default:
      iceUnsupported(stmt, ctx, "statement");
  }
}

/** `let v = init;` → materialise init into a value, then store it to v's slot. */
function lowerLetDecl(decl: LetDeclNode, ctx: LowerCtx): void {
  if (decl.initialiser === null) {
    return; // no IL for an initialiser-less declaration
  }
  const value = materialise(lowerExpr(decl.initialiser, ctx), ctx);
  const target = loc(frameSymbol(ctx.fqName, decl.name), slotIlType(ctx.frame, decl.name));
  ctx.builder.emit({ op: "store", a: value, b: target });
}

/** `return [expr];` → terminate the block with `ret(value?)`. */
function lowerReturn(stmt: ReturnStmtNode, ctx: LowerCtx): void {
  if (stmt.value === null) {
    ctx.builder.terminate({ kind: "ret" });
    return;
  }
  const value = lowerExpr(stmt.value, ctx);
  ctx.builder.terminate({ kind: "ret", value });
}

// ── Control-flow lowering — the multi-block CFG keystone ─────

/**
 * Lower `if (cond) then [else]` into a multi-block CFG. The condition
 * lowers to a boolean operand; a `brcond` selects the `then`/`else` (or `end`)
 * block; each arm falls through to a shared `end` block via `br` unless it already
 * terminated (a `return`/`break`/`continue`). `else if` chains nest the same shape.
 */
function lowerIf(stmt: IfStmtNode, ctx: LowerCtx): void {
  const cond = lowerExpr(stmt.condition, ctx);
  const thenL = ctx.builder.reserveLabel();
  const endL = ctx.builder.reserveLabel();
  const elseL = stmt.elseClause !== null ? ctx.builder.reserveLabel() : endL;

  ctx.builder.terminate({ kind: "brcond", cond, trueTarget: thenL, falseTarget: elseL });

  ctx.builder.openBlock(thenL);
  lowerBlock(stmt.thenBlock, ctx);
  if (!ctx.builder.isTerminated()) ctx.builder.terminate({ kind: "br", target: endL });

  if (stmt.elseClause !== null) {
    ctx.builder.openBlock(elseL);
    if (stmt.elseClause.kind === "Block") {
      lowerBlock(stmt.elseClause, ctx);
    } else {
      lowerIf(stmt.elseClause, ctx); // chained `else if`
    }
    if (!ctx.builder.isTerminated()) ctx.builder.terminate({ kind: "br", target: endL });
  }

  ctx.builder.openBlock(endL); // successor continues here (may be an empty join)
}

/**
 * Lower `while (cond) body`: entry → `cond`; `cond` branches to `body`
 * or `end`; `body` back-edges to `cond`. `break`→`end`, `continue`→`cond`.
 */
function lowerWhile(stmt: WhileStmtNode, ctx: LowerCtx): void {
  const condL = ctx.builder.reserveLabel();
  const bodyL = ctx.builder.reserveLabel();
  const endL = ctx.builder.reserveLabel();

  ctx.builder.terminate({ kind: "br", target: condL });
  ctx.builder.openBlock(condL);
  const cond = lowerExpr(stmt.condition, ctx);
  ctx.builder.terminate({ kind: "brcond", cond, trueTarget: bodyL, falseTarget: endL });

  ctx.loopStack.push({ breakTarget: endL, continueTarget: condL });
  ctx.builder.openBlock(bodyL);
  lowerBlock(stmt.body, ctx);
  if (!ctx.builder.isTerminated()) ctx.builder.terminate({ kind: "br", target: condL });
  ctx.loopStack.pop();

  ctx.builder.openBlock(endL);
}

/**
 * Lower `do body while (cond)`: entry → `body`; `body` → `cond`;
 * `cond` branches back to `body` or on to `end`. `break`→`end`, `continue`→`cond`
 * (re-evaluate the condition, correct for do-while).
 */
function lowerDoWhile(stmt: DoWhileStmtNode, ctx: LowerCtx): void {
  const bodyL = ctx.builder.reserveLabel();
  const condL = ctx.builder.reserveLabel();
  const endL = ctx.builder.reserveLabel();

  ctx.builder.terminate({ kind: "br", target: bodyL });
  ctx.loopStack.push({ breakTarget: endL, continueTarget: condL });
  ctx.builder.openBlock(bodyL);
  lowerBlock(stmt.body, ctx);
  if (!ctx.builder.isTerminated()) ctx.builder.terminate({ kind: "br", target: condL });
  ctx.loopStack.pop();

  ctx.builder.openBlock(condL);
  const cond = lowerExpr(stmt.condition, ctx);
  ctx.builder.terminate({ kind: "brcond", cond, trueTarget: bodyL, falseTarget: endL });

  ctx.builder.openBlock(endL);
}

/**
 * Lower `for (let i: T = init to|downto bound [step s]) body` (Pattern A).
 * The counter is a frame local: `init` stores it; `cond` compares it against
 * `bound` (`le` for `to`, `ge` for `downto`) via `brcond`; `body` falls to
 * `incr`; `incr` adds/subtracts the const step and back-edges to `cond`.
 * `break`→`end`, `continue`→`incr`.
 *
 * Full-range guard: a `to <type-max>` inclusive bound is the Pattern-B wrap
 * case — its `counter <= max` predicate can never go false — so it records an
 * ICE (Pattern B deferred) rather than lower a non-terminating loop.
 */
function lowerFor(stmt: ForStmtNode, ctx: LowerCtx): void {
  const counterType = slotIlType(ctx.frame, stmt.varName);
  const counterLoc = loc(frameSymbol(ctx.fqName, stmt.varName), counterType);

  // init: counter = init
  const initValue = materialise(lowerExpr(stmt.init, ctx), ctx);
  ctx.builder.emit({ op: "store", a: initValue, b: counterLoc });

  const condL = ctx.builder.reserveLabel();
  const bodyL = ctx.builder.reserveLabel();
  const incrL = ctx.builder.reserveLabel();
  const endL = ctx.builder.reserveLabel();

  ctx.builder.terminate({ kind: "br", target: condL });

  // cond: continue while counter <= bound (to) / >= bound (downto) — Pattern A.
  ctx.builder.openBlock(condL);
  if (
    stmt.direction === "to" &&
    stmt.bound.kind === "NumericLitExpr" &&
    stmt.bound.value === ilTypeMax(counterType)
  ) {
    // Pattern-B wrap (full-range `to <type-max>`) is deferred: a compare
    // `counter <= max` never falls through. Record the ICE; the emitted compare is
    // never assembled (hasErrors), but keeps the block well-formed.
    iceUnsupported(stmt, ctx, "for-loop full-range 'to <type-max>' (Pattern B deferred)");
  }
  const boundValue = lowerExpr(stmt.bound, ctx);
  const cmp = compareCounter(counterLoc, counterType, stmt.direction, boundValue, ctx);
  ctx.builder.terminate({ kind: "brcond", cond: cmp, trueTarget: bodyL, falseTarget: endL });

  ctx.loopStack.push({ breakTarget: endL, continueTarget: incrL });
  ctx.builder.openBlock(bodyL);
  lowerBlock(stmt.body, ctx);
  if (!ctx.builder.isTerminated()) ctx.builder.terminate({ kind: "br", target: incrL });
  ctx.loopStack.pop();

  // incr: counter = counter ± step
  ctx.builder.openBlock(incrL);
  incrementCounter(counterLoc, counterType, stmt.direction, constStep(stmt.step, ctx), ctx);
  ctx.builder.terminate({ kind: "br", target: condL });

  ctx.builder.openBlock(endL);
}

/**
 * Lower `switch (D) { case v...: B ... default: Bd }` into a `brcond` compare-chain
 * over the multi-block CFG keystone. No jump table, no new IL terminator (a
 * jump-table lowering is deferred to a later pass).
 *
 * Shape: one dispatch **test block** per case value emits `eq(disc, value)` +
 * `brcond(→ shared body, else next test)`; multi-value cases point every true-edge
 * at the same body block. After the last test the unmatched discriminant
 * falls unconditionally to the (always-present) `default` body. Each clause
 * body is its own block: without a trailing `fallthrough` it ends `br(join)`
 * (auto-break); with one it ends `br(<next clause body>)`. `break`/`continue`
 * inside a body resolve to the enclosing `LoopContext` — switch pushes nothing.
 *
 * The discriminant is re-lowered **fresh in each test block** (a single-use temp
 * the block's `eq` consumes) rather than materialised once and reused: a temp
 * cannot live across a basic-block boundary in `translate.ts` (block-local
 * fold/register state), so this mirrors the for-loop counter reload.
 */
function lowerSwitch(stmt: SwitchStmtNode, ctx: LowerCtx): void {
  const join = ctx.builder.reserveLabel();

  // Reserve one body label per clause up front (cases in order, then default) so a
  // `fallthrough`'s "next clause body" edge resolves regardless of emission order.
  const bodyLabels: string[] = stmt.cases.map(() => ctx.builder.reserveLabel());
  const defaultBodyL = ctx.builder.reserveLabel();
  bodyLabels.push(defaultBodyL);

  // Dispatch chain: one test block per case value, in source order.
  for (let i = 0; i < stmt.cases.length; i++) {
    for (const value of stmt.cases[i].values) {
      const disc = lowerExpr(stmt.discriminant, ctx); // fresh, single-use in this block
      const match = ctx.builder.newTemp(IL_BYTE);
      ctx.builder.emit({
        op: "eq",
        dest: match,
        left: disc,
        right: lowerExpr(value, ctx),
        type: IL_BYTE,
      } as ILInstruction);
      const nextTest = ctx.builder.reserveLabel();
      ctx.builder.terminate({
        kind: "brcond",
        cond: match,
        trueTarget: bodyLabels[i],
        falseTarget: nextTest,
      });
      ctx.builder.openBlock(nextTest);
    }
  }
  // Unmatched discriminant → the default body (the dispatch tail's unconditional br).
  ctx.builder.terminate({ kind: "br", target: defaultBodyL });

  // Bodies: cases in order, then default. `bodyLabels[i + 1]` is clause i's
  // fall-through target; the default (last) falls through to `join`.
  const clauses = [...stmt.cases, stmt.defaultClause];
  for (let i = 0; i < clauses.length; i++) {
    ctx.builder.openBlock(bodyLabels[i]);
    lowerClauseBody(clauses[i].body, bodyLabels[i + 1] ?? join, join, ctx);
  }

  ctx.builder.openBlock(join); // subsequent statements continue here
}

/**
 * Lower one switch clause body into the current block. A
 * trailing `fallthrough` (guaranteed last by semantics E10074) terminates the body
 * with `br(nextBodyL)`; otherwise the body auto-breaks with `br(join)`. A body that
 * already terminated (a `break`/`continue`/`return`) is left as-is (isTerminated
 * guard) — matching `lowerBlock`.
 */
function lowerClauseBody(
  body: readonly StmtNode[],
  nextBodyL: string,
  join: string,
  ctx: LowerCtx,
): void {
  for (const s of body) {
    if (ctx.builder.isTerminated()) break;
    if (s.kind === "FallthroughStmt") {
      ctx.builder.terminate({ kind: "br", target: nextBodyL });
      return;
    }
    lowerStmt(s, ctx);
  }
  if (!ctx.builder.isTerminated()) ctx.builder.terminate({ kind: "br", target: join });
}

/**
 * Emit the Pattern-A continue predicate: load the counter and compare it to the
 * bound (`le` for `to`, `ge` for `downto`). Returns the boolean result operand.
 */
function compareCounter(
  counterLoc: ILOperand,
  counterType: ILType,
  direction: "to" | "downto",
  bound: ILOperand,
  ctx: LowerCtx,
): ILOperand {
  const current = ctx.builder.newTemp(counterType);
  ctx.builder.emit({ op: "load", a: current, b: counterLoc });
  const result = ctx.builder.newTemp(IL_BYTE);
  const op: ILInstruction["op"] = direction === "to" ? "le" : "ge";
  // Comparison result is the i8u 0/1 flag — mirrors `lowerBinary`.
  ctx.builder.emit({ op, dest: result, left: current, right: bound, type: IL_BYTE } as ILInstruction);
  return result;
}

/** Emit `counter = counter ± step` into the counter slot (the for-loop increment). */
function incrementCounter(
  counterLoc: ILOperand,
  counterType: ILType,
  direction: "to" | "downto",
  step: number,
  ctx: LowerCtx,
): void {
  const current = ctx.builder.newTemp(counterType);
  ctx.builder.emit({ op: "load", a: current, b: counterLoc });
  const next = ctx.builder.newTemp(counterType);
  const op: ILInstruction["op"] = direction === "to" ? "add" : "sub";
  ctx.builder.emit({
    op,
    dest: next,
    left: current,
    right: imm(step, counterType),
    type: counterType,
  } as ILInstruction);
  ctx.builder.emit({ op: "store", a: next, b: counterLoc });
}

/**
 * The compile-time for-loop step: absent → 1; a numeric literal → its value. The
 * semantic pass has already required a present `step` to be a positive constant
 * (E10061); lowering only folds a literal here (the const-evaluator is
 * frontend-private), so a non-literal step records an ICE and defaults to 1.
 */
function constStep(step: ExprNode | null, ctx: LowerCtx): number {
  if (step === null) return 1;
  if (step.kind === "NumericLitExpr") return step.value;
  iceUnsupported(step, ctx, "non-literal for-loop step");
  return 1;
}

/** Lower `break;` → an unconditional branch to the enclosing loop's end. */
function lowerBreak(stmt: StmtNode, ctx: LowerCtx): void {
  const top = ctx.loopStack[ctx.loopStack.length - 1];
  if (top === undefined) {
    iceUnsupported(stmt, ctx, "break outside a loop"); // semantic pass rejected it (E10130)
    return;
  }
  ctx.builder.terminate({ kind: "br", target: top.breakTarget });
}

/** Lower `continue;` → an unconditional branch to the enclosing loop's cond/incr. */
function lowerContinue(stmt: StmtNode, ctx: LowerCtx): void {
  const top = ctx.loopStack[ctx.loopStack.length - 1];
  if (top === undefined) {
    iceUnsupported(stmt, ctx, "continue outside a loop"); // semantic pass rejected it (E10131)
    return;
  }
  ctx.builder.terminate({ kind: "br", target: top.continueTarget });
}

/** The inclusive maximum value representable by an IL integer type (used by the full-range guard). */
function ilTypeMax(t: ILType): number {
  if (t.signed) return t.width === 8 ? 127 : 32767;
  return t.width === 8 ? 255 : 65535;
}

/** Lower a single expression to an operand; ICE default for unsupported expression kinds. */
function lowerExpr(expr: ExprNode, ctx: LowerCtx): ILOperand {
  switch (expr.kind) {
    case "NumericLitExpr":
      return lowerNumericLit(expr, ctx);
    case "BoolLitExpr":
      return imm(expr.value ? 1 : 0, IL_BYTE);
    case "IdentExpr":
      return lowerIdent(expr, ctx);
    case "FieldAccessExpr":
      return lowerFieldAccess(expr, ctx);
    case "BinaryExpr":
      return lowerBinary(expr, ctx);
    case "AssignExpr":
      return lowerAssign(expr, ctx);
    case "IntrinsicCallExpr":
      return lowerIntrinsic(expr, ctx);
    case "CallExpr":
      return lowerCall(expr, ctx);
    default:
      return iceUnsupported(expr, ctx, "expression");
  }
}

/**
 * Lower a plain call expression. A call whose callee names a registered
 * `'call'`-strategy intrinsic is a T4 platform intrinsic — T4
 * names parse as ordinary `CallExprNode` and are recognized semantically via
 * the registry: it lowers to the IL `intrinsic` op exactly like a T3
 * routine. Anything else is a user function call.
 */
function lowerCall(expr: CallExprNode, ctx: LowerCtx): ILOperand {
  if (expr.callee.kind === "IdentExpr") {
    const descriptor = ctx.registry.get(expr.callee.name);
    if (descriptor !== undefined && descriptor.loweringStrategy === "call") {
      emitIntrinsicOp(expr.callee.name, descriptor, ctx);
      return imm(0, IL_BYTE); // void result, discarded by the ExpressionStmt
    }
  }
  return lowerUserCall(expr, ctx);
}

/**
 * Lower a user-function call with the store-per-argument convention (static
 * frames): evaluate each argument left to right and store it into the
 * callee's frame slot the moment it exists, then emit a bare `call` whose
 * only job is the transfer + result binding (`args` stays empty by design —
 * the marshalling is the explicit stores). Memory-homing every argument as
 * it is produced means a call nested in a LATER argument cannot clobber an
 * earlier one — the interference planner keeps the frames disjoint — except
 * when that nested call can reach this callee itself (its own frame would be
 * overwritten mid-marshalling); that residual shape is rejected loudly
 * before anything is emitted, never compiled wrong.
 *
 * A callee that is not a resolved user function (unsupported callee shapes,
 * unresolved symbols) keeps the unsupported-ICE contract. Both supported
 * shapes — a bare identifier and a qualified `Module.member` — carry their
 * resolved symbol in the model's symbol map.
 */
function lowerUserCall(expr: CallExprNode, ctx: LowerCtx): ILOperand {
  const calleeExpr = expr.callee;
  if (calleeExpr.kind !== "IdentExpr" && calleeExpr.kind !== "FieldAccessExpr") {
    return iceUnsupported(expr, ctx, "call expression (unsupported callee shape)");
  }
  const callee = ctx.model.symbolOf(calleeExpr);
  if (callee === null || callee.kind !== "function" || !isFunctionDecl(callee.decl)) {
    return iceUnsupported(expr, ctx, "call expression (unresolved callee)");
  }
  const calleeFq = symbolFqName(callee);
  const decl = callee.decl;

  // Never-miscompile guard: a call nested in any argument after the first
  // that can reach this callee again would overwrite the argument slots
  // stored so far. Visited-set-bounded reachability — terminates on any
  // graph.
  for (const arg of expr.args.slice(1)) {
    for (const nested of collectCallExprs(arg)) {
      const nestedCallee =
        nested.callee.kind === "IdentExpr" || nested.callee.kind === "FieldAccessExpr"
          ? ctx.model.symbolOf(nested.callee)
          : null;
      if (nestedCallee === null || nestedCallee.kind !== "function") continue;
      if (canReach(nestedCallee, callee, ctx.model)) {
        return iceUnsupported(
          expr,
          ctx,
          `call reaching '${callee.name}' inside an argument of a call to '${callee.name}'`,
        );
      }
    }
  }

  // Store-per-arg, left to right: every argument value is memory-homed in
  // the callee's frame the moment it is evaluated.
  const calleeFrame = ctx.plan.frames.get(calleeFq)?.frame;
  for (let i = 0; i < expr.args.length; i++) {
    const param = decl.params[i];
    if (param === undefined) {
      // An arity mismatch is a type error caught upstream; reaching here is
      // a compiler bug.
      return iceUnsupported(expr, ctx, "call with unexpected argument count");
    }
    const value = lowerExpr(expr.args[i], ctx);
    const slotType = slotIlType(calleeFrame, param.name);
    ctx.builder.emit({ op: "store", a: value, b: loc(frameSymbol(calleeFq, param.name), slotType) });
  }

  // The bare transfer + result binding.
  const returnType = typeNodeToIl(decl.returnType);
  if (returnType === "void") {
    ctx.builder.emit({ op: "call", target: calleeFq, args: [] });
    return imm(0, IL_BYTE); // void result, discarded by the ExpressionStmt
  }
  const dest = ctx.builder.newTemp(returnType);
  ctx.builder.emit({ op: "call", dest, target: calleeFq, args: [] });
  return dest;
}

/** Narrows a symbol's declaring node to a {@link FunctionDeclNode}. */
function isFunctionDecl(node: AstNode): node is FunctionDeclNode {
  return node.kind === "FunctionDecl";
}

/**
 * The fully-qualified `Module.function` name of a function symbol, read from
 * its declaring module scope — the same recovery the SFA adapter uses, so
 * `plan.frames` and the emitted `__frame_*`/label references line up.
 */
function symbolFqName(fn: Symbol): string {
  const modNode = fn.scope.node;
  const moduleName = isModuleDecl(modNode) ? modNode.name : "";
  return `${moduleName}.${fn.name}`;
}

/** Collects every plain call expression in a subtree (uniform visitor walk). */
function collectCallExprs(root: AstNode): CallExprNode[] {
  const found: CallExprNode[] = [];
  const visit = (node: AstNode): void => {
    if (node.kind === "CallExpr") {
      found.push(node as CallExprNode);
    }
    walkChildren(node, visitor);
  };
  const visitor = new Proxy({} as AstVisitor<void>, { get: () => visit });
  walkNode(root, visitor);
  return found;
}

/**
 * Whether `from` can reach `target` along call-graph edges, `from` itself
 * included. Visited-set-bounded — terminates on any input, cyclic included.
 */
function canReach(from: Symbol, target: Symbol, model: SemanticModel): boolean {
  const visited = new Set<Symbol>([from]);
  const stack: Symbol[] = [from];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    if (current === target) return true;
    for (const callee of model.callGraph.edges.get(current) ?? []) {
      if (visited.has(callee)) continue;
      visited.add(callee);
      stack.push(callee);
    }
  }
  return false;
}

/**
 * A numeric literal folds directly to an immediate operand. Its IL
 * width comes from the model's resolved type, so a word
 * literal is `IL_WORD`. An `ErrorType`/absent
 * type falls back to `IL_BYTE` via `ilTypeOfType` (an errored program does not
 * reach a clean build).
 */
function lowerNumericLit(expr: NumericLitExprNode, ctx: LowerCtx): ILOperand {
  return imm(expr.value, ilTypeOfType(ctx.model.typeOf(expr)));
}

/**
 * A variable read loads its storage location into a fresh temp; a constant
 * inlines to its evaluated immediate (constants own no storage). A module-
 * scope variable resolves to its `__var_*` symbol; a local/param resolves to
 * its `__frame_*` slot (existing path) — except inside the module-initializer
 * stream, where no frame exists and an unresolved reference is a loud
 * compiler bug rather than a silently mis-sized frame slot.
 */
function lowerIdent(expr: IdentExprNode, ctx: LowerCtx): ILOperand {
  const sym = ctx.model.symbolOf(expr);
  if (sym !== null && sym.kind === "constant") {
    return constImmediate(sym, expr, ctx);
  }
  const moduleVar = sym !== null ? moduleVarLocOfSymbol(sym) : null;
  if (moduleVar !== null) {
    const dest = ctx.builder.newTemp(moduleVar.type);
    ctx.builder.emit({ op: "load", a: dest, b: loc(moduleVar.symbol, moduleVar.type) });
    return dest;
  }
  if (ctx.moduleInit) {
    return iceUnsupported(expr, ctx, "module-initializer reference (no frame storage)");
  }
  const type = slotIlType(ctx.frame, expr.name);
  const dest = ctx.builder.newTemp(type);
  ctx.builder.emit({ op: "load", a: dest, b: loc(frameSymbol(ctx.fqName, expr.name), type) });
  return dest;
}

/**
 * A qualified `Module.member` read in value position. Typing resolved the
 * member to the SAME symbol the module declares, so the read mirrors the
 * identifier paths: a module variable loads from its `__var_*` symbol; a
 * constant inlines to its evaluated immediate. Anything else was already
 * rejected by typing — reaching it here is a compiler bug.
 */
function lowerFieldAccess(expr: FieldAccessExprNode, ctx: LowerCtx): ILOperand {
  const sym = ctx.model.symbolOf(expr);
  if (sym !== null && sym.kind === "constant") {
    return constImmediate(sym, expr, ctx);
  }
  const moduleVar = sym !== null ? moduleVarLocOfSymbol(sym) : null;
  if (moduleVar !== null) {
    const dest = ctx.builder.newTemp(moduleVar.type);
    ctx.builder.emit({ op: "load", a: dest, b: loc(moduleVar.symbol, moduleVar.type) });
    return dest;
  }
  return iceUnsupported(expr, ctx, "field access");
}

/**
 * A resolved constant inlines to its evaluated immediate value — constants
 * are compile-time-only and never own RAM. A missing value cannot survive to
 * a clean build (evaluation failures are user errors upstream); the ICE is
 * defense in depth.
 */
function constImmediate(sym: Symbol, expr: ExprNode, ctx: LowerCtx): ILOperand {
  const value = ctx.model.constValues.get(sym);
  if (value === undefined) {
    return iceUnsupported(expr, ctx, "constant without an evaluated value");
  }
  const raw = typeof value.value === "boolean" ? (value.value ? 1 : 0) : value.value;
  return imm(raw, ilTypeOfType(sym.type));
}

/** A same-width binary expression: evaluate left, then right, then the op. */
function lowerBinary(expr: BinaryExprNode, ctx: LowerCtx): ILOperand {
  const op = BINARY_OP_TO_IL[expr.op];
  if (op === undefined) {
    return iceUnsupported(expr, ctx, `binary operator '${expr.op}'`);
  }
  const left = lowerExpr(expr.left, ctx); // left-first (FN-10)
  const right = lowerExpr(expr.right, ctx);
  // Result width comes from the model's resolved type, so
  // `word OP word → i16u` reaches `__rt_mul16`/`__rt_div16`; comparisons are
  // always the i8u 0/1 flag. ErrorType falls back to IL_BYTE.
  const type: ILType = COMPARISON_RESULT_OPS.has(op)
    ? IL_BYTE
    : ilTypeOfType(ctx.model.typeOf(expr));
  const dest = ctx.builder.newTemp(type);
  // The opcode is one of the binary arithmetic/bitwise/comparison families, all
  // of which share the `{dest,left,right,type}` shape.
  ctx.builder.emit({ op, dest, left, right, type } as ILInstruction);
  return dest;
}

/** `target = rhs` → materialise rhs and store it to the target's storage. */
function lowerAssign(expr: AssignExprNode, ctx: LowerCtx): ILOperand {
  const targetExpr = expr.target;
  if (expr.op !== "=" || (targetExpr.kind !== "IdentExpr" && targetExpr.kind !== "FieldAccessExpr")) {
    return iceUnsupported(expr, ctx, "assignment");
  }
  const value = materialise(lowerExpr(expr.value, ctx), ctx);

  const sym = ctx.model.symbolOf(targetExpr);
  const moduleVar = sym !== null ? moduleVarLocOfSymbol(sym) : null;
  let target: ILOperand;
  if (moduleVar !== null) {
    target = loc(moduleVar.symbol, moduleVar.type); // module scalar → __var_*
  } else if (targetExpr.kind === "IdentExpr") {
    target = loc(frameSymbol(ctx.fqName, targetExpr.name), slotIlType(ctx.frame, targetExpr.name));
  } else {
    // A qualified target that is not a module variable was already rejected
    // by typing; reaching it here is a compiler bug.
    return iceUnsupported(expr, ctx, "assignment (qualified target)");
  }
  ctx.builder.emit({ op: "store", a: value, b: target });
  return value;
}

/**
 * Lower an intrinsic call by dispatching on its descriptor's `loweringStrategy`
 * — never on the intrinsic name. `'fold'` evaluates to an
 * immediate, `'inline'` selects an emitter from {@link INLINE_EMITTERS}, and
 * `'opcode'`/`'call'` emit an IL `intrinsic` op carrying the descriptor for
 * translate to finish (T1 opcode / T3-T4 marshalling).
 */
function lowerIntrinsic(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  const descriptor = ctx.registry.get(expr.name);
  if (descriptor === undefined) {
    return iceUnsupported(expr, ctx, `intrinsic '${expr.name}'`);
  }
  switch (descriptor.loweringStrategy) {
    case "fold":
      return foldIntrinsic(expr, ctx);
    case "inline":
      return inlineIntrinsic(expr, ctx);
    case "opcode":
    case "call":
      // Carry the descriptor to translate: T1 → one opcode; T3/T4 → JSR + marshal.
      emitIntrinsicOp(expr.name, descriptor, ctx);
      return imm(0, IL_BYTE); // void result, discarded by the ExpressionStmt
    default:
      return iceUnsupported(expr, ctx, `intrinsic strategy '${String(descriptor.loweringStrategy)}'`);
  }
}

/** Emit the IL `intrinsic` op carrying the descriptor (opcode/call strategies). */
function emitIntrinsicOp(name: string, descriptor: IntrinsicDescriptor, ctx: LowerCtx): void {
  ctx.builder.emit({ op: "intrinsic", name, args: [], descriptor });
}

// ── T2 folds (sizeof/offsetof/length — Ch 12 §3.3) ───────────────────────────

/**
 * Fold a `'fold'`-strategy intrinsic to an immediate (no runtime code).
 * Dispatch is by NODE SHAPE, not name: `offsetof` carries a `fieldArg`, `sizeof`
 * carries a `typeArg`, and `length` carries a value argument. The analyzer
 * has already resolved the type/field, so failures here are defensive zeros.
 */
function foldIntrinsic(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  if (expr.fieldArg !== null && expr.typeArg !== null) {
    return imm(offsetOfField(expr.typeArg, expr.fieldArg.name, ctx), IL_BYTE);
  }
  if (expr.typeArg !== null) {
    return imm(sizeOfType(expr.typeArg, ctx), IL_BYTE);
  }
  // length(array): ≤255 → `byte`, else `word` (a deliberate spec deviation).
  const count = lengthOfArray(expr.args[0], ctx);
  return imm(count, count <= 255 ? IL_BYTE : IL_WORD);
}

/** The byte size of an AST type (primitive fixed sizes; struct/enum from the model). */
function sizeOfType(node: TypeNode, ctx: LowerCtx): number {
  switch (node.kind) {
    case "PrimitiveType":
      return byteSize(primitive(node.name));
    case "NamedType": {
      const struct = ctx.model.structTypes.get(node.name);
      if (struct !== undefined) return struct.byteSize;
      return ctx.model.enumTypes.has(node.name) ? 1 : 0; // enum backing = 1 byte
    }
    case "ArrayType": {
      const element = sizeOfType(node.elementType, ctx);
      const length = node.size !== null && node.size.kind === "NumericLitExpr" ? node.size.value : 0;
      return element * length;
    }
    default:
      return 0;
  }
}

/** The byte offset of a struct field (from the model's resolved struct table). */
function offsetOfField(node: TypeNode, field: string, ctx: LowerCtx): number {
  if (node.kind === "NamedType") {
    return ctx.model.structTypes.get(node.name)?.fields.get(field)?.offset ?? 0;
  }
  return 0;
}

/** The element count of an array variable (from its resolved frame-slot type). */
function lengthOfArray(arg: ExprNode | undefined, ctx: LowerCtx): number {
  if (arg !== undefined && arg.kind === "IdentExpr") {
    const slot = ctx.frame?.slots.find((s) => s.name === arg.name);
    const type: Type | undefined = slot?.type;
    if (type !== undefined && type.kind === "array") return type.size;
  }
  return 0;
}

// ── T2 inline emitters (peek/poke/peekw/pokew/lo/hi) ─────────────────────────

/** An inline T2 emitter: lowers the call to IL load/store/immediate operands. */
type InlineEmitter = (expr: IntrinsicCallExprNode, ctx: LowerCtx) => ILOperand;

/** Dispatch a `'inline'`-strategy intrinsic through the keyed emitter map. */
function inlineIntrinsic(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  const emitter = INLINE_EMITTERS.get(expr.name);
  if (emitter === undefined) {
    return iceUnsupported(expr, ctx, `inline intrinsic '${expr.name}'`);
  }
  return emitter(expr, ctx);
}

/** `peek(addr)` → one byte `load` from the constant address. */
function emitPeek(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  const base = constAddress(expr.args[0], "peek", ctx);
  if (base === null) return imm(0, IL_BYTE);
  const dest = ctx.builder.newTemp(IL_BYTE);
  ctx.builder.emit({ op: "load", a: dest, b: loc(hexAddr(base), IL_WORD) });
  return dest;
}

/** `poke(addr, val)` → one byte `store` to the constant address. */
function emitPoke(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  const base = constAddress(expr.args[0], "poke", ctx);
  if (base === null) return imm(0, IL_BYTE);
  const value = lowerExpr(expr.args[1] ?? errorExpr(), ctx);
  ctx.builder.emit({ op: "store", a: value, b: loc(hexAddr(base), IL_WORD) });
  return imm(0, IL_BYTE); // void result
}

/** `peekw(addr)` → one word `load` (translate splits it into addr / addr+1). */
function emitPeekw(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  const base = constAddress(expr.args[0], "peekw", ctx);
  if (base === null) return imm(0, IL_WORD);
  const dest = ctx.builder.newTemp(IL_WORD);
  ctx.builder.emit({ op: "load", a: dest, b: loc(hexAddr(base), IL_WORD) });
  return dest;
}

/**
 * `pokew(addr, val)` → little-endian word write (Ch 12 §3.1). A constant value is
 * split into two byte stores (`lo`→addr, `hi`→addr+1); a runtime value is a single
 * word `store` translate splits.
 */
function emitPokew(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  const base = constAddress(expr.args[0], "pokew", ctx);
  if (base === null) return imm(0, IL_BYTE);
  const valueExpr = expr.args[1];
  if (valueExpr !== undefined && valueExpr.kind === "NumericLitExpr") {
    const value = valueExpr.value;
    ctx.builder.emit({ op: "store", a: imm(value & 0xff, IL_BYTE), b: loc(hexAddr(base), IL_BYTE) });
    ctx.builder.emit({ op: "store", a: imm((value >> 8) & 0xff, IL_BYTE), b: loc(hexAddr(base + 1), IL_BYTE) });
    return imm(0, IL_BYTE);
  }
  const value = lowerExpr(valueExpr ?? errorExpr(), ctx);
  ctx.builder.emit({ op: "store", a: value, b: loc(hexAddr(base), IL_WORD) });
  return imm(0, IL_BYTE);
}

/** `lo(val)` → the low byte. A constant folds; a runtime value is deferred (ICE). */
function emitLo(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  const arg = expr.args[0];
  if (arg !== undefined && arg.kind === "NumericLitExpr") {
    return imm(arg.value & 0xff, IL_BYTE);
  }
  return iceUnsupported(expr, ctx, "lo() of a non-constant value");
}

/** `hi(val)` → the high byte. A constant folds; a runtime value is deferred (ICE). */
function emitHi(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  const arg = expr.args[0];
  if (arg !== undefined && arg.kind === "NumericLitExpr") {
    return imm((arg.value >> 8) & 0xff, IL_BYTE);
  }
  return iceUnsupported(expr, ctx, "hi() of a non-constant value");
}

/** The inline T2 emitter table — keyed once, not a per-name switch. */
const INLINE_EMITTERS: ReadonlyMap<string, InlineEmitter> = new Map<string, InlineEmitter>([
  ["peek", emitPeek],
  ["poke", emitPoke],
  ["peekw", emitPeekw],
  ["pokew", emitPokew],
  ["lo", emitLo],
  ["hi", emitHi],
]);

/**
 * Resolve a compile-time-constant intrinsic address. A numeric literal yields its
 * value; anything else emits **E10045** and returns `null` so the
 * caller poisons the statement — NOT an ICE.
 */
function constAddress(arg: ExprNode | undefined, name: string, ctx: LowerCtx): number | null {
  if (arg !== undefined && arg.kind === "NumericLitExpr") {
    return arg.value;
  }
  ctx.bag.addError(
    DiagCode.NonConstantIntrinsicAddress,
    arg?.span ?? ZERO_SPAN,
    `'${name}' requires a compile-time-constant address in this version`,
  );
  return null;
}

/** Render a numeric address as the `$HEX` symbol kept symbolic through the IL. */
function hexAddr(value: number): string {
  return `$${value.toString(16).toUpperCase()}`;
}

/** A deterministic error-expression placeholder for a missing (poisoned) argument. */
function errorExpr(): ExprNode {
  return { kind: "ErrorExpr", span: ZERO_SPAN };
}

/** The zero source span used for synthesized/placeholder nodes. */
const ZERO_SPAN = { sourceId: 0, start: 0, end: 0 } as const;

/** Wrap a non-temp value in a `const` temp so it can flow into a `store`. */
function materialise(value: ILOperand, ctx: LowerCtx): ILOperand {
  if (isTemp(value)) {
    return value;
  }
  const dest = ctx.builder.newTemp(operandType(value));
  ctx.builder.emit({ op: "const", dest, src: value });
  return dest;
}

/** Emit an ICE for an unsupported node and return a deterministic poison operand. */
function iceUnsupported(node: AstNode, ctx: LowerCtx, what: string): ILOperand {
  ctx.bag.addICE(
    IceCode.Unexpected,
    node.span,
    `IL lowering: unsupported ${what} node '${node.kind}'`,
  );
  return imm(0, IL_BYTE);
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** The sanitized frame-slot symbol for a variable (`__frame_<Module_fn>_<var>`). */
function frameSymbol(fqName: string, varName: string): string {
  return `__frame_${fqName.replaceAll(".", "_")}_${varName}`;
}

/** Narrows a scope's introducing node to a {@link ModuleDeclNode}. */
function isModuleDecl(node: AstNode | null): node is ModuleDeclNode {
  return node !== null && node.kind === "ModuleDecl";
}

/**
 * The module-variable symbol (`__var_<Module>_<var>`), matching SFA's
 * `symbols.ts` emission (`sanitize` = non-`[A-Za-z0-9_]` → `_`) exactly, so the
 * emitted `load`/`store` target resolves at ACME.
 */
function moduleVarSymbol(moduleName: string, varName: string): string {
  const sanitize = (n: string): string => n.replace(/[^A-Za-z0-9_]/g, "_");
  return `__var_${sanitize(moduleName)}_${sanitize(varName)}`;
}

/**
 * If `sym` is a **module-scope** `variable`, returns its `__var_*` symbol and
 * IL type; otherwise `null` (a local/param, handled by the frame path). The
 * module name is read from the symbol's declaring module scope node — the
 * same recovery used for storage layout, so the emitted reference resolves.
 * This is the discriminator between the `__var_*` and `__frame_*` paths.
 */
function moduleVarLocOfSymbol(sym: Symbol): { symbol: string; type: ILType } | null {
  if (sym.kind !== "variable" || sym.scope.kind !== "module") return null;
  const modNode = sym.scope.node;
  const moduleName = isModuleDecl(modNode) ? modNode.name : "";
  return { symbol: moduleVarSymbol(moduleName, sym.name), type: ilTypeOfType(sym.type) };
}

/** The IL type of a named frame slot, defaulting to `IL_BYTE` when absent. */
function slotIlType(frame: FunctionFrame | undefined, varName: string): ILType {
  const slot = frame?.slots.find((s) => s.name === varName);
  return slot ? ilTypeOfType(slot.type) : IL_BYTE;
}

/** The IL type carried by any operand. */
function operandType(operand: ILOperand): ILType {
  return operand.type;
}

/** Map a syntactic return type to an IL type, or `"void"`. */
function typeNodeToIl(node: TypeNode): ILType | "void" {
  if (node.kind === "PrimitiveType") {
    if (node.name === "void") {
      return "void";
    }
    return ilTypeOfType(primitive(node.name as PrimitiveName));
  }
  // NamedType (struct/enum) and ArrayType travel by-ref as a 16-bit address.
  return IL_WORD;
}

/**
 * Deep-scan a declaration subtree for any error sentinel (`ErrorExpr`/
 * `ErrorStmt`/`ErrorType`) — the "carries an ErrorType" test. Uses the core
 * traversal helpers with a uniform visitor so no node kind is missed.
 */
function hasErrorNode(root: AstNode): boolean {
  let found = false;
  const visit = (node: AstNode): void => {
    if (node.kind === "ErrorExpr" || node.kind === "ErrorStmt" || node.kind === "ErrorType") {
      found = true;
      return;
    }
    walkChildren(node, visitor);
  };
  const visitor = new Proxy({} as AstVisitor<void>, { get: () => visit });
  walkNode(root, visitor);
  return found;
}
