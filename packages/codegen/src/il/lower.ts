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

import {
  byteSize,
  commonType,
  createIntrinsicRegistry,
  DiagCode,
  IceCode,
  primitive,
  walkChildren,
  walkNode,
} from "@blend65/core";
import type {
  AstNode,
  AstVisitor,
  BinaryExprNode,
  BinaryOp,
  BlockNode,
  CallExprNode,
  CastExprNode,
  ConditionalExprNode,
  DiagnosticBag,
  DoWhileStmtNode,
  ExprNode,
  FieldAccessExprNode,
  ForStmtNode,
  FunctionDeclNode,
  FunctionFrame,
  IdentExprNode,
  IndexExprNode,
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
  UnaryExprNode,
} from "@blend65/core";

import { IL_BYTE, IL_WORD, ilTypeOfType } from "./il-type.js";
import type { ILType } from "./il-type.js";
import { addrByteOf, addrOf, imm, isAddr, isTemp, loc } from "./operand.js";
import { log2Exact } from "../util/bits.js";
import type { ILOperand } from "./operand.js";
import type { ILInstruction, ILTerminator } from "./instruction.js";
import type { BasicBlock, ConstDataEntry, ILFunction, ILProgram } from "./cfg.js";
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

/** The comparison opcodes the fused compare-and-branch terminator accepts. */
type CompareOp = Extract<ILTerminator, { kind: "brcmp" }>["op"];

/**
 * AST comparison operators mapped to their IL comparison opcode. The value
 * type is the fused terminator's own op union, so a comparison recognized here
 * is always one the branch form has a framing for — the value form and the
 * branch form can never disagree about which operators are comparisons.
 */
const COMPARISON_OP_TO_IL: Partial<Record<BinaryOp, CompareOp>> = {
  "==": "eq",
  "!=": "ne",
  "<": "lt",
  "<=": "le",
  ">": "gt",
  ">=": "ge",
};

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
  ...COMPARISON_OP_TO_IL,
};

/**
 * IL opcodes whose result is always an `IL_BYTE` 0/1. Note the asymmetry: the
 * DEST temp of a comparison is a byte flag, but the instruction's `type`
 * field carries the (promoted) OPERAND type — the translator dispatches its
 * byte/word × unsigned/signed comparison framing on it.
 */
const COMPARISON_RESULT_OPS = new Set<string>(Object.values(COMPARISON_OP_TO_IL));

/** Compound-assignment operators mapped to their expansion's binary operator. */
const COMPOUND_BASE_OP: Partial<Record<AssignExprNode["op"], BinaryOp>> = {
  "+=": "+",
  "-=": "-",
  "*=": "*",
  "/=": "/",
  "%=": "%",
  "&=": "&",
  "|=": "|",
  "^=": "^",
  "<<=": "<<",
  ">>=": ">>",
};

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
   * `true` while lowering the module-initializer stream. There is no user
   * frame in that context (only the pseudo-frame carrying synthetic result
   * slots), so a reference that resolves to neither a module variable nor a
   * constant is a compiler bug and must fail loudly — never fall back to the
   * (byte-defaulting) frame-slot path.
   */
  readonly moduleInit: boolean;
  /**
   * The synthetic-slot claim counter. Short-circuit/conditional sites claim
   * `0sc<N>` slots in preorder at node entry — the same order the SFA
   * adapter counted them — so the running index maps each site to its
   * planned frame slot. Reset per function and per init stream.
   */
  scCounter: number;
  /**
   * The const-data labels whose address the program takes with a source-level
   * `&`. Filled at the `&` site itself, so a by-reference argument — which
   * lowers to the very same address operand — never lands in it.
   *
   * This is ONE set shared by every lowering context in the program, not one
   * per context. A module initializer lowers through its own context, so a
   * per-context set would silently lose every `&` written at module scope.
   */
  readonly addressTakenConsts: Set<string>;
  /**
   * The zero-page pair this function stages runtime pointer formation
   * through: interrupt-only functions use the dedicated
   * `__zp_irq_ptr_scratch` (an interrupt firing mid-formation must never
   * find its own staging bytes holding a mainline half-formed pointer);
   * everything else — including the module initializer — uses
   * `__zp_ptr_scratch`.
   */
  readonly scratchPair: string;
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

  // Const images whose address the program takes with `&`. Created once here
  // and handed to every lowering context, because a program's function bodies
  // and its module initializers lower through separate contexts and both can
  // contain a `&`.
  const addressTakenConsts = new Set<string>();

  const functions: ILFunction[] = [];
  for (const program of input.program) {
    const moduleName = program.moduleDecl.name;
    for (const item of program.items) {
      if (item.kind === "FunctionDecl" || item.kind === "InterruptDecl") {
        if (hasErrorNode(item)) {
          continue; // skip functions tainted by an ErrorType/error node
        }
        functions.push(
          lowerFunction(
            item,
            moduleName,
            input.plan,
            input.model,
            registry,
            bag,
            addressTakenConsts,
          ),
        );
      }
    }
  }

  // Module initializers: one generated init stream (stores in the model's
  // initialization order, closed by `ret` — the startup shim calls it once
  // before the entry function). Initializer-free programs keep the stream
  // empty, so their output is byte-identical to before.
  const init =
    input.model.initOrder.length > 0
      ? lowerInitCode(input, registry, bag, addressTakenConsts)
      : { blocks: Object.freeze([] as const), tempCount: 0 };

  // Const aggregates carry fully-evaluated memory images — each becomes an
  // in-image data entry under its `__data_<Module>_<name>` label (const
  // SCALARS keep inlining as immediates and own no data). Embedded assets
  // keep their provenance tag; everything else derives from the type.
  //
  // The address-taken set is complete by now: every function has lowered, and
  // so has the initializer stream, and those are the only two places a `&` can
  // appear.
  const constData: ConstDataEntry[] = [];
  for (const [sym, value] of input.model.constValues) {
    if (value.bytes === undefined) continue;
    const symbol = constDataSymbol(sym);
    constData.push({
      symbol,
      data: value.bytes,
      type:
        value.source === "embed"
          ? "embed"
          : sym.type.kind === "struct"
            ? "struct"
            : "array",
      pageAligned: addressTakenConsts.has(symbol),
    });
  }

  return Object.freeze({
    functions: Object.freeze(functions),
    initCode: init.blocks,
    initTempCount: init.tempCount,
    constData: Object.freeze(constData),
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
  addressTakenConsts: Set<string>,
): { blocks: readonly BasicBlock[]; tempCount: number } {
  // Initializer expressions, keyed by their declared symbol (typing records
  // the declaration-node → symbol entry).
  const initializers = new Map<Symbol, ExprNode>();
  for (const program of input.program) {
    for (const item of program.items) {
      if (item.kind === "LetDecl" && item.initialiser !== null) {
        const sym = input.model.symbolOf(item);
        if (sym !== null) initializers.set(sym, item.initialiser);
      } else if (item.kind === "ZeropageBlock") {
        // Zeropage fields join the same startup stream as module lets.
        for (const field of item.fields) {
          if (field.initialiser === null) continue;
          const sym = input.model.symbolOf(field);
          if (sym !== null) initializers.set(sym, field.initialiser);
        }
      }
    }
  }

  const builder = new IlFunctionBuilder("__init", [], "void", false);
  const ctx: LowerCtx = {
    builder,
    fqName: "__init",
    // The pseudo-frame exists only when an initializer needs a synthetic
    // short-circuit/conditional slot; identifier reads never touch it (the
    // moduleInit guard fires first).
    frame: input.plan.frames.get("__init")?.frame,
    bag,
    model: input.model,
    registry,
    loopStack: [],
    plan: input.plan,
    moduleInit: true,
    scCounter: 0,
    addressTakenConsts,
    scratchPair: SCRATCH_PAIR, // the initializer stream is never interrupt-only
  };
  for (const sym of input.model.initOrder) {
    const init = initializers.get(sym);
    if (init === undefined) continue; // defensive — the order holds initialized vars only
    const target = moduleVarLocOfSymbol(sym);
    if (target === null) {
      iceUnsupported(init, ctx, "module initializer target (not a module variable)");
      continue;
    }
    if (isAggregateType(sym.type)) {
      lowerAggregateInit(
        {
          baseKind: "direct",
          symbol: target.symbol,
          constOffset: 0,
          index: null,
          wordIndex: null,
          wordScale: 1,
        },
        sym.type,
        init,
        ctx,
      );
      continue;
    }
    // An address-of initialiser feeds the store directly, like any other
    // plain store position.
    const value = isAddressOfExpr(init) ? lowerAddressOf(init, ctx, true) : lowerExpr(init, ctx);
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
  addressTakenConsts: Set<string>,
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
    scCounter: 0,
    addressTakenConsts,
    scratchPair:
      plan.irqOnlyFunctions?.has(fqName) === true ? IRQ_SCRATCH_PAIR : SCRATCH_PAIR,
  };

  if (fn.kind === "FunctionDecl") emitPairPrologue(fn, ctx);
  lowerBlock(fn.body, ctx);

  // Fall-through end of a function closes the entry block with `ret()`.
  return builder.finish({ kind: "ret" });
}

/**
 * The entry-block frame→pair copies: each pair-accessed by-reference
 * parameter's address is copied ONCE from its 2-byte frame home (where the
 * caller stored it) into its bound zero-page pair, as two plain byte moves —
 * no word-temp machinery. Dead and pass-through-only by-ref parameters get
 * no copy (they have no pair).
 */
function emitPairPrologue(fn: FunctionDeclNode, ctx: LowerCtx): void {
  const bodyScope = ctx.model.scopeOf(fn);
  for (const sym of bodyScope.symbols.values()) {
    if (sym.kind !== "parameter" || !sym.byRef) continue;
    if (!ctx.model.pairAccessedParams.has(sym)) continue;
    const frameSym = frameSymbol(ctx.fqName, sym.name);
    const pairSym = pairSymbol(ctx.fqName, sym.name);
    const lo = ctx.builder.newTemp(IL_BYTE);
    ctx.builder.emit({ op: "load", a: lo, b: loc(frameSym, IL_BYTE) });
    ctx.builder.emit({ op: "store", a: lo, b: loc(pairSym, IL_BYTE) });
    const hi = ctx.builder.newTemp(IL_BYTE);
    ctx.builder.emit({ op: "load", a: hi, b: loc(frameSym, IL_BYTE, 1) });
    ctx.builder.emit({ op: "store", a: hi, b: loc(pairSym, IL_BYTE, 1) });
  }
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
  // Aggregate declarations initialise in place (per element/field/byte).
  const sym = ctx.model.symbolOf(decl);
  if (sym !== null && isAggregateType(sym.type)) {
    const place: Place = {
      baseKind: "direct",
      symbol: frameSymbol(ctx.fqName, decl.name),
      constOffset: 0,
      index: null,
      wordIndex: null,
      wordScale: 1,
    };
    lowerAggregateInit(place, sym.type, decl.initialiser, ctx);
    return;
  }
  // An address-of initialiser feeds the store directly (a store source is a
  // legal address position — no homing detour).
  const value = isAddressOfExpr(decl.initialiser)
    ? lowerAddressOf(decl.initialiser, ctx, true)
    : materialise(lowerExpr(decl.initialiser, ctx), ctx);
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
 * Lower `expr` in condition position: terminate the current block — possibly
 * after opening short-circuit blocks — branching to `trueL` when the condition
 * holds and `falseL` when it does not.
 *
 * A condition is asked a question, not for a value, and this is where that
 * distinction is cashed in. A comparison becomes a fused compare-and-branch:
 * the flags the compare sets feed the branch directly, so no 0/1 result is
 * built, stored, reloaded and re-tested to reach the same branch. `!` costs
 * nothing at all — it swaps the two labels. `&&`/`||` become control flow:
 * their short-circuit is the CFG shape, so unlike the value form they claim no
 * synthetic frame slot, and the right clause's block is reachable ONLY through
 * the left clause's undecided edge — which is what makes short-circuit a
 * guarantee rather than an optimization, and what keeps a hardware read in a
 * right clause from happening when the left clause already decided. A boolean
 * literal folds to a plain branch. Anything else — a boolean variable, a call
 * result, a conditional expression — has no flags of its own to branch on, so
 * it falls back to evaluating the value and branching on it.
 */
function lowerCondition(expr: ExprNode, trueL: string, falseL: string, ctx: LowerCtx): void {
  switch (expr.kind) {
    case "BoolLitExpr":
      // A constant condition is decided here; neither the test nor the code to
      // build it is worth emitting.
      ctx.builder.terminate({ kind: "br", target: expr.value ? trueL : falseL });
      return;

    case "UnaryExpr":
      if (expr.op === "!") {
        lowerCondition(expr.operand, falseL, trueL, ctx); // negation IS the swap
        return;
      }
      break;

    case "BinaryExpr": {
      const cmp = COMPARISON_OP_TO_IL[expr.op];
      if (cmp !== undefined) {
        const { left, right, type } = lowerComparisonOperands(expr, ctx);
        ctx.builder.terminate({
          kind: "brcmp",
          op: cmp,
          left,
          right,
          type,
          trueTarget: trueL,
          falseTarget: falseL,
        });
        return;
      }
      if (expr.op === "&&" || expr.op === "||") {
        // The left clause decides on one edge and defers to the right clause on
        // the other; `&&` defers when it holds, `||` when it does not.
        const rightL = ctx.builder.reserveLabel();
        if (expr.op === "&&") {
          lowerCondition(expr.left, rightL, falseL, ctx);
        } else {
          lowerCondition(expr.left, trueL, rightL, ctx);
        }
        ctx.builder.openBlock(rightL);
        lowerCondition(expr.right, trueL, falseL, ctx);
        return;
      }
      break;
    }

    default:
      break;
  }

  const cond = lowerExpr(expr, ctx);
  ctx.builder.terminate({ kind: "brcond", cond, trueTarget: trueL, falseTarget: falseL });
}

/**
 * Lower `if (cond) then [else]` into a multi-block CFG. The condition branches
 * straight to the `then`/`else` (or `end`) block; each arm falls through to a
 * shared `end` block via `br` unless it already terminated (a
 * `return`/`break`/`continue`). `else if` chains nest the same shape.
 */
function lowerIf(stmt: IfStmtNode, ctx: LowerCtx): void {
  const thenL = ctx.builder.reserveLabel();
  const endL = ctx.builder.reserveLabel();
  const elseL = stmt.elseClause !== null ? ctx.builder.reserveLabel() : endL;

  lowerCondition(stmt.condition, thenL, elseL, ctx);

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
  lowerCondition(stmt.condition, bodyL, endL, ctx);

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
  lowerCondition(stmt.condition, bodyL, endL, ctx);

  ctx.builder.openBlock(endL);
}

/**
 * Lower `for (let i: T = init to|downto bound [step s]) body` (Pattern A).
 * The counter is a frame local: `init` stores it; `cond` branches on a fused
 * compare against `bound` (`le` for `to`, `ge` for `downto`); `body` falls to
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
  branchOnCounter(counterLoc, counterType, stmt.direction, boundValue, bodyL, endL, ctx);

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
 * Lower `switch (D) { case v...: B ... default: Bd }` into a fused compare-chain
 * over the multi-block CFG keystone. No jump table (a jump-table lowering is
 * deferred to a later pass).
 *
 * Shape: one dispatch **test block** per case value, each terminating in a fused
 * `eq` compare-and-branch (→ shared body, else next test) — a dispatch test is a
 * question, so it never builds a 0/1 match flag to re-test; multi-value cases
 * point every true-edge at the same body block. After the last test the unmatched
 * discriminant
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

  // Dispatch chain: one test block per case value, in source order. The `eq`
  // is stamped with the DISCRIMINANT's type — a word/sword discriminant must
  // compare at its own width, not low-bytes-only (the 0/1 result stays a byte).
  const discType = ilTypeOfType(ctx.model.typeOf(stmt.discriminant));
  for (let i = 0; i < stmt.cases.length; i++) {
    for (const value of stmt.cases[i].values) {
      const disc = lowerExpr(stmt.discriminant, ctx); // fresh, single-use in this block
      const nextTest = ctx.builder.reserveLabel();
      ctx.builder.terminate({
        kind: "brcmp",
        op: "eq",
        left: disc,
        right: lowerExpr(value, ctx),
        type: discType,
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
 * Terminate the for-loop's condition block on the Pattern-A continue predicate:
 * load the counter and branch to the body while it is still within the bound
 * (`le` for `to`, `ge` for `downto`), else to the loop end.
 *
 * The counter is reloaded here on every iteration rather than kept live across
 * the back-edge because a temp cannot cross a basic-block boundary. The
 * comparison is stamped with the COUNTER's type — a word counter must compare
 * at word width, not low-bytes-only.
 */
function branchOnCounter(
  counterLoc: ILOperand,
  counterType: ILType,
  direction: "to" | "downto",
  bound: ILOperand,
  bodyL: string,
  endL: string,
  ctx: LowerCtx,
): void {
  const current = ctx.builder.newTemp(counterType);
  ctx.builder.emit({ op: "load", a: current, b: counterLoc });
  ctx.builder.terminate({
    kind: "brcmp",
    op: direction === "to" ? "le" : "ge",
    left: current,
    right: bound,
    type: counterType,
    trueTarget: bodyL,
    falseTarget: endL,
  });
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
    case "UnaryExpr":
      return lowerUnary(expr, ctx);
    case "CastExpr":
      return lowerCast(expr, ctx);
    case "ConditionalExpr":
      return lowerConditional(expr, ctx);
    case "AssignExpr":
      return lowerAssign(expr, ctx);
    case "IntrinsicCallExpr":
      return lowerIntrinsic(expr, ctx);
    case "CallExpr":
      return lowerCall(expr, ctx);
    case "IndexExpr":
      return lowerIndexRead(expr, ctx);
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
  // the callee's frame the moment it is evaluated. A by-reference parameter
  // (struct/array — its frame slot holds an ADDRESS) takes the argument
  // place's address: a statically-addressable place stores its link-time
  // address; a whole by-ref param of the CALLER forwards as a word copy of
  // its own frame home (the canonical address — no pair involved). Anything
  // needing runtime address arithmetic is rejected loudly.
  const calleeFrame = ctx.plan.frames.get(calleeFq)?.frame;
  for (let i = 0; i < expr.args.length; i++) {
    const param = decl.params[i];
    if (param === undefined) {
      // An arity mismatch is a type error caught upstream; reaching here is
      // a compiler bug.
      return iceUnsupported(expr, ctx, "call with unexpected argument count");
    }
    const arg = expr.args[i];
    const paramSlot = calleeFrame?.slots.find(
      (s) => s.name === param.name && s.kind === "parameter",
    );
    const paramIsByRef =
      paramSlot !== undefined &&
      (paramSlot.type.kind === "array" || paramSlot.type.kind === "struct");

    if (paramIsByRef) {
      const calleeSlot = loc(frameSymbol(calleeFq, param.name), IL_WORD);
      const argSym = arg.kind === "IdentExpr" ? ctx.model.symbolOf(arg) : null;
      if (argSym !== null && argSym.kind === "parameter" && argSym.byRef) {
        // Whole pass-through: forward the caller's own frame word.
        const t = ctx.builder.newTemp(IL_WORD);
        ctx.builder.emit({ op: "load", a: t, b: loc(frameSymbol(ctx.fqName, argSym.name), IL_WORD) });
        ctx.builder.emit({ op: "store", a: t, b: calleeSlot });
        continue;
      }
      const place = lowerPlace(arg, ctx);
      if (place === null) {
        return iceUnsupported(expr, ctx, "aggregate argument place");
      }
      if (place.baseKind === "direct" && place.index === null && place.wordIndex === null) {
        // Static place: the assembler resolves the whole address.
        ctx.builder.emit({
          op: "store",
          a: addrOf(place.symbol, place.constOffset),
          b: calleeSlot,
        });
        continue;
      }
      // Runtime-computed place (an indexed element, or a sub-object of a
      // by-ref parameter): form the complete address in the scratch pair and
      // hand the callee that word.
      const formed = formArgumentAddress(place, ctx);
      if (formed === null) continue; // reservation miss already rejected loudly
      ctx.builder.emit({ op: "store", a: formed, b: calleeSlot });
      continue;
    }

    // An address-of argument feeds the argument store directly.
    const value = isAddressOfExpr(arg) ? lowerAddressOf(arg, ctx, true) : lowerExpr(arg, ctx);
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
  if (sym !== null && sym.kind === "constant" && !isAggregateType(sym.type)) {
    return constImmediate(sym, expr, ctx);
  }
  if (sym !== null && sym.kind === "constant") {
    // An aggregate constant read in scalar position — reads go through the
    // place machinery (indexing/fields/copies); a bare value read is a bug.
    return iceUnsupported(expr, ctx, "aggregate constant in scalar position");
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
  if (sym !== null && sym.kind === "constant" && !isAggregateType(sym.type)) {
    return constImmediate(sym, expr, ctx);
  }
  // An enum member access folds to its backing byte value at compile time.
  const enumFold = enumMemberValue(expr, ctx);
  if (enumFold !== null) return imm(enumFold, IL_BYTE);

  const moduleVar = sym !== null ? moduleVarLocOfSymbol(sym) : null;
  if (moduleVar !== null && !isAggregateType(sym?.type ?? ERROR_TYPE_SENTINEL)) {
    const dest = ctx.builder.newTemp(moduleVar.type);
    ctx.builder.emit({ op: "load", a: dest, b: loc(moduleVar.symbol, moduleVar.type) });
    return dest;
  }

  // A struct-field read resolves through the place machinery.
  const objType = ctx.model.typeOf(expr.object);
  if (objType.kind === "struct") {
    return lowerPlaceRead(expr, ctx);
  }
  return iceUnsupported(expr, ctx, "field access");
}

/** The frozen poison sentinel (local alias for guard readability). */
const ERROR_TYPE_SENTINEL: Type = { kind: "error" };

/** True for array/struct types (memory aggregates, never scalar operands). */
function isAggregateType(t: Type): boolean {
  return t.kind === "array" || t.kind === "struct";
}

/**
 * The backing value of an enum member access (`Direction.UP`, incl. the
 * qualified `Mod.Enum.MEMBER` chain), or `null` when the expression is not
 * enum member access. The head's symbol was stamped by typing.
 */
function enumMemberValue(expr: FieldAccessExprNode, ctx: LowerCtx): number | null {
  const headSym = ctx.model.symbolOf(expr.object);
  if (headSym === null || headSym.kind !== "enum") return null;
  const enumType = headSym.type;
  if (enumType.kind !== "enum") return null;
  return enumType.members.get(expr.field) ?? null;
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

/**
 * A binary expression: evaluate left, then right (left-first), coerce both
 * operands to the operation's type, then emit the op.
 *
 * The instruction's `type` is the operation type: for value classes the
 * node's own resolved type (`word OP word → i16u` reaches `__rt_mul16`); for
 * COMPARISONS the promoted OPERAND type — the 0/1 result temp stays a byte,
 * but the translator picks its byte/word × unsigned/signed framing from the
 * operands, so a word compare must never be stamped as a byte compare. For
 * shifts the type (and the coerced left operand) is the LEFT operand's type;
 * the amount keeps its own width. Signed division/modulo has no correct
 * runtime routine — rejected loudly before anything is emitted.
 */
function lowerBinary(expr: BinaryExprNode, ctx: LowerCtx): ILOperand {
  if (expr.op === "&&" || expr.op === "||") {
    return lowerShortCircuit(expr, ctx); // never via BINARY_OP_TO_IL — branches mandatory
  }
  const op = BINARY_OP_TO_IL[expr.op];
  if (op === undefined) {
    return iceUnsupported(expr, ctx, `binary operator '${expr.op}'`);
  }

  if (COMPARISON_RESULT_OPS.has(op)) {
    const { left, right, type } = lowerComparisonOperands(expr, ctx);
    const dest = ctx.builder.newTemp(IL_BYTE); // the 0/1 flag, whatever the operands' width
    ctx.builder.emit({ op, dest, left, right, type } as ILInstruction);
    return dest;
  }

  const leftType = ctx.model.typeOf(expr.left);
  const rightType = ctx.model.typeOf(expr.right);
  const isShift = op === "shl" || op === "shr";
  const operationType: Type = ctx.model.typeOf(expr);

  if ((op === "div" || op === "mod") && isSignedInteger(operationType)) {
    return iceUnsupported(expr, ctx, "signed division/modulo (unsigned runtime routines only)");
  }

  let left = lowerExpr(expr.left, ctx); // left-first (FN-10)
  let right = lowerExpr(expr.right, ctx);
  left = coerce(left, leftType, operationType, ctx);
  if (!isShift) right = coerce(right, rightType, operationType, ctx); // the amount keeps its width

  const type: ILType = ilTypeOfType(operationType);
  const dest = ctx.builder.newTemp(type);
  // The opcode is one of the binary arithmetic/bitwise families, all of which
  // share the `{dest,left,right,type}` shape.
  ctx.builder.emit({ op, dest, left, right, type } as ILInstruction);
  return dest;
}

/** A comparison's promoted operands and the operand type that frames it. */
interface ComparisonOperands {
  readonly left: ILOperand;
  readonly right: ILOperand;
  readonly type: ILType;
}

/**
 * Lower a comparison's two operands and promote both to their common type —
 * the one step the value form and the branch form must perform identically.
 *
 * A comparison can appear as a value (`let c = x > y`) or as the thing a branch
 * decides on (`if (x > y)`). Both need the same left-first evaluation order and
 * the same promotion, and both stamp the result with the PROMOTED OPERAND type
 * rather than the node's own boolean type: that type is what selects the
 * translator's byte/word × unsigned/signed framing, so a word compare stamped
 * as a byte compare would silently compare low bytes only. Sharing this helper
 * is what keeps the two forms from ever drifting apart on either point.
 */
function lowerComparisonOperands(expr: BinaryExprNode, ctx: LowerCtx): ComparisonOperands {
  const leftType = ctx.model.typeOf(expr.left);
  const rightType = ctx.model.typeOf(expr.right);
  const operationType: Type = commonType(leftType, rightType) ?? primitive("byte");

  let left = lowerExpr(expr.left, ctx); // left-first (FN-10)
  let right = lowerExpr(expr.right, ctx);
  left = coerce(left, leftType, operationType, ctx);
  right = coerce(right, rightType, operationType, ctx);

  return { left, right, type: ilTypeOfType(operationType) };
}

/** Whether `t` is a signed integer primitive (poison and non-primitives are not). */
function isSignedInteger(t: Type): boolean {
  return t.kind === "primitive" && (t.name === "sbyte" || t.name === "sword");
}

/**
 * Emit the promotion coercion carrying `value` from its `from` type to the
 * width `to` requires. Same width → untouched (a cross-sign reinterpret is
 * bit-free). 8→16 widens value-preservingly — the SOURCE's signedness picks
 * zero- vs sign-extension. 16→8 truncates (explicit casts only — implicit
 * narrowing never reaches lowering). Immediates re-encode in place: their
 * bit pattern converts at compile time, no instruction needed. Poisoned or
 * non-primitive types leave the value untouched (such programs never build).
 */
function coerce(value: ILOperand, from: Type, to: Type, ctx: LowerCtx): ILOperand {
  if (from.kind !== "primitive" || to.kind !== "primitive") return value;
  const fromIl = ilTypeOfType(from);
  const toIl = ilTypeOfType(to);
  if (fromIl.width === toIl.width) return value;

  if (!isTemp(value) && value.kind === "immediate") {
    return imm(reencodeImmediate(value.value, fromIl, toIl), toIl);
  }
  const dest = ctx.builder.newTemp(toIl);
  if (fromIl.width === 8 && toIl.width === 16) {
    ctx.builder.emit({ op: fromIl.signed ? "sext" : "zext", dest, src: value });
  } else {
    ctx.builder.emit({ op: "trunc", dest, src: value });
  }
  return dest;
}

/**
 * Re-encode an immediate's raw bit pattern from one IL width to another:
 * interpret the pattern under the source type, then take the target width's
 * two's-complement pattern of that value.
 */
function reencodeImmediate(pattern: number, from: ILType, to: ILType): number {
  const fromModulus = from.width === 8 ? 0x100 : 0x10000;
  const interpreted =
    from.signed && pattern >= fromModulus / 2 ? pattern - fromModulus : pattern;
  const toModulus = to.width === 8 ? 0x100 : 0x10000;
  return ((interpreted % toModulus) + toModulus) % toModulus;
}

/**
 * Claim the next synthetic result slot for a short-circuit/conditional site.
 * Slots were counted by the SFA adapter in the same preorder, so the running
 * counter maps this site to its planned frame slot; the name AND byte size
 * are verified so neither a count drift nor an order drift can ever produce
 * a wrong address — any mismatch is a loud rejection instead.
 */
function claimResultSlot(expr: ExprNode, ctx: LowerCtx): ILOperand | null {
  const slotName = `0sc${ctx.scCounter++}`;
  const resultType = ctx.model.typeOf(expr);
  const siteType = resultType.kind === "error" ? primitive("byte") : resultType;
  const slot = ctx.frame?.slots.find((s) => s.name === slotName);
  if (slot === undefined) {
    iceUnsupported(expr, ctx, `expression result slot '${slotName}' missing from the frame`);
    return null;
  }
  if (byteSize(slot.type) !== byteSize(siteType)) {
    iceUnsupported(
      expr,
      ctx,
      `expression result slot '${slotName}' size mismatch (frame ${byteSize(slot.type)}B, site ${byteSize(siteType)}B)`,
    );
    return null;
  }
  return loc(frameSymbol(ctx.fqName, slotName), ilTypeOfType(siteType));
}

/**
 * Lower `a && b` / `a || b` as a value-producing slot diamond. Short-circuit
 * is a language guarantee, not an optimization: the right operand's code sits
 * in its own branch-target block and runs only when the left operand does not
 * decide the result. The result crosses the block boundary through its
 * synthetic frame slot (a temp cannot), and the join reloads it:
 *
 *     store lhs -> slot ; brcond lhs ? rhs : join   (|| swaps the targets)
 *     rhs:  store rhs -> slot ; br join
 *     join: result = load slot
 */
function lowerShortCircuit(expr: BinaryExprNode, ctx: LowerCtx): ILOperand {
  const slot = claimResultSlot(expr, ctx); // claimed at node entry — preorder
  if (slot === null) return imm(0, IL_BYTE);

  const left = materialise(lowerExpr(expr.left, ctx), ctx);
  ctx.builder.emit({ op: "store", a: left, b: slot });

  const rhsL = ctx.builder.reserveLabel();
  const joinL = ctx.builder.reserveLabel();
  if (expr.op === "&&") {
    ctx.builder.terminate({ kind: "brcond", cond: left, trueTarget: rhsL, falseTarget: joinL });
  } else {
    ctx.builder.terminate({ kind: "brcond", cond: left, trueTarget: joinL, falseTarget: rhsL });
  }

  ctx.builder.openBlock(rhsL);
  const right = materialise(lowerExpr(expr.right, ctx), ctx);
  ctx.builder.emit({ op: "store", a: right, b: slot });
  ctx.builder.terminate({ kind: "br", target: joinL });

  ctx.builder.openBlock(joinL);
  const result = ctx.builder.newTemp(IL_BYTE);
  ctx.builder.emit({ op: "load", a: result, b: slot });
  return result;
}

/**
 * Lower `cond ? a : b` as a diamond over the site's synthetic slot: the
 * condition dispatches, each arm lowers its expression, coerces it to the
 * node's result type, and stores to the slot; the join reloads it. Only the
 * selected arm executes — the language rule falls out of the CFG shape.
 */
function lowerConditional(expr: ConditionalExprNode, ctx: LowerCtx): ILOperand {
  const slot = claimResultSlot(expr, ctx); // claimed at node entry — preorder
  if (slot === null) return imm(0, IL_BYTE);
  const resultType = ctx.model.typeOf(expr);

  const cond = materialise(lowerExpr(expr.condition, ctx), ctx);
  const thenL = ctx.builder.reserveLabel();
  const elseL = ctx.builder.reserveLabel();
  const joinL = ctx.builder.reserveLabel();
  ctx.builder.terminate({ kind: "brcond", cond, trueTarget: thenL, falseTarget: elseL });

  ctx.builder.openBlock(thenL);
  const whenTrue = coerce(
    lowerExpr(expr.whenTrue, ctx),
    ctx.model.typeOf(expr.whenTrue),
    resultType,
    ctx,
  );
  ctx.builder.emit({ op: "store", a: materialise(whenTrue, ctx), b: slot });
  ctx.builder.terminate({ kind: "br", target: joinL });

  ctx.builder.openBlock(elseL);
  const whenFalse = coerce(
    lowerExpr(expr.whenFalse, ctx),
    ctx.model.typeOf(expr.whenFalse),
    resultType,
    ctx,
  );
  ctx.builder.emit({ op: "store", a: materialise(whenFalse, ctx), b: slot });
  ctx.builder.terminate({ kind: "br", target: joinL });

  ctx.builder.openBlock(joinL);
  const result = ctx.builder.newTemp(slot.type);
  ctx.builder.emit({ op: "load", a: result, b: slot });
  return result;
}

/**
 * Lower a unary expression. `-` on a directly-nested literal folds to the
 * two's-complement immediate (a negative literal is a value, not a runtime
 * negation); a runtime `-` emits `neg` (typing guarantees a signed operand —
 * the unsigned check here is defense in depth). `~` emits `not` at the
 * operand's width. `!` is the ==0 test: booleans are 0-false/1-true, so
 * logical not needs no new IL op. `&` (address-of) in a general value
 * position homes its address through the site's word slot — see
 * {@link lowerAddressOf}.
 */
function lowerUnary(expr: UnaryExprNode, ctx: LowerCtx): ILOperand {
  if (expr.op === "&") {
    return lowerAddressOf(expr, ctx, false);
  }
  const ilType = ilTypeOfType(ctx.model.typeOf(expr));

  if (expr.op === "-" && expr.operand.kind === "NumericLitExpr") {
    // Negative-literal shape: encode the negated value's bit pattern directly.
    const modulus = ilType.width === 8 ? 0x100 : 0x10000;
    const pattern = ((-expr.operand.value % modulus) + modulus) % modulus;
    return imm(pattern, ilType);
  }

  const src = lowerExpr(expr.operand, ctx);
  switch (expr.op) {
    case "-": {
      if (!ilType.signed) {
        return iceUnsupported(expr, ctx, "negation of an unsigned value");
      }
      const dest = ctx.builder.newTemp(ilType);
      ctx.builder.emit({ op: "neg", dest, src, type: ilType });
      return dest;
    }
    case "~": {
      const dest = ctx.builder.newTemp(ilType);
      ctx.builder.emit({ op: "not", dest, src, type: ilType });
      return dest;
    }
    default: {
      // "!": true is 1, false is 0 — logical not IS the equals-zero test.
      const dest = ctx.builder.newTemp(IL_BYTE);
      ctx.builder.emit({ op: "eq", dest, left: src, right: imm(0, IL_BYTE), type: IL_BYTE });
      return dest;
    }
  }
}

/**
 * Lower `<type>(operand)`. Width changes go through {@link coerce} (the
 * source's signedness picks the extension; narrowing truncates). A same-width
 * cast is a bit-free reinterpret: an immediate re-types in place; a temp of a
 * different signedness gets a `copy` re-typing its view (keeps the printed IL
 * honest); an already-right-typed value passes through. Boolean/void/
 * aggregate casts never reach lowering (typing rejected them).
 */
function lowerCast(expr: CastExprNode, ctx: LowerCtx): ILOperand {
  // An enum value IS its byte backing — casts to/from enums are the byte's
  // casts (an enum→word cast zero-extends like byte→word).
  const operandType = asByteBacking(ctx.model.typeOf(expr.operand));
  const targetType = asByteBacking(ctx.model.typeOf(expr));
  const value = lowerExpr(expr.operand, ctx);
  if (operandType.kind !== "primitive" || targetType.kind !== "primitive") return value;

  const fromIl = ilTypeOfType(operandType);
  const toIl = ilTypeOfType(targetType);
  if (fromIl.width !== toIl.width) {
    return coerce(value, operandType, targetType, ctx);
  }
  if (value.kind === "immediate") {
    return imm(value.value, toIl); // same-width reinterpret of a constant pattern
  }
  if (isTemp(value) && value.type.signed !== toIl.signed) {
    const dest = ctx.builder.newTemp(toIl);
    ctx.builder.emit({ op: "copy", dest, src: value });
    return dest;
  }
  return value;
}

/**
 * `target = rhs` / `target OP= rhs` → resolve the target's storage location,
 * then store the (plain) rhs or the compound expansion's result to it.
 */
function lowerAssign(expr: AssignExprNode, ctx: LowerCtx): ILOperand {
  const targetExpr = expr.target;
  const targetType = ctx.model.typeOf(targetExpr);

  // Whole-struct targets: a literal initialises per field; anything else is
  // an unrolled byte copy (structs assign by copy, never by reference).
  if (targetType.kind === "struct") {
    const place = lowerPlace(targetExpr, ctx);
    if (place === null || place.index !== null || place.wordIndex !== null) {
      return iceUnsupported(expr, ctx, "struct assignment target");
    }
    lowerAggregateInit(place, targetType, expr.value, ctx);
    return imm(0, IL_BYTE); // aggregate assignment yields no scalar value
  }

  // Element/field targets resolve through the place machinery.
  if (
    targetExpr.kind === "IndexExpr" ||
    (targetExpr.kind === "FieldAccessExpr" &&
      ctx.model.typeOf(targetExpr.object).kind === "struct")
  ) {
    const place = lowerPlace(targetExpr, ctx);
    if (place === null) return iceUnsupported(expr, ctx, "assignment target");
    const elemIl = ilTypeOfType(targetType);
    if (expr.op !== "=") {
      if (place.index !== null || place.wordIndex !== null) {
        // A read-modify-write through a runtime index needs two indexed
        // accesses sharing one index temp — deferred; reject loudly.
        return iceUnsupported(expr, ctx, "compound assignment through a runtime index");
      }
      if (place.baseKind === "pair") {
        // The direct-location rewrite below would read-modify-write the
        // POINTER pair's own bytes; a pair target must RMW THROUGH it.
        if (place.constOffset + (elemIl.width === 16 ? 2 : 1) - 1 > 255) {
          return iceUnsupported(expr, ctx, "compound assignment beyond the pair's direct reach");
        }
        return lowerCompoundAssign(expr, indirectRmwTarget(place), ctx);
      }
      return lowerCompoundAssign(
        expr,
        loc(place.symbol, elemIl, place.constOffset === 0 ? undefined : place.constOffset),
        ctx,
      );
    }
    const value = lowerExpr(expr.value, ctx);
    emitPlaceStore(place, elemIl, value, ctx);
    return value;
  }

  if (targetExpr.kind !== "IdentExpr" && targetExpr.kind !== "FieldAccessExpr") {
    return iceUnsupported(expr, ctx, "assignment");
  }

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

  if (expr.op === "=") {
    // An address-of value feeds the store directly (store source is a legal
    // address position).
    const value = isAddressOfExpr(expr.value)
      ? lowerAddressOf(expr.value, ctx, true)
      : materialise(lowerExpr(expr.value, ctx), ctx);
    ctx.builder.emit({ op: "store", a: value, b: target });
    return value;
  }
  return lowerCompoundAssign(expr, target, ctx);
}

// ── Aggregate places — base symbol + compile-time offset + optional index ──

/**
 * A resolved storage place.
 *
 * `baseKind` selects the addressing family: a `direct` base is the symbol's
 * own storage (frame slot, module var, const-data label) and emits the plain
 * or indexed memory ops; a `pair` base is a by-reference parameter's bound
 * zero-page pointer pair and emits the indirect ops (the symbol IS the pair,
 * whose CONTENTS point at the aggregate).
 *
 * `index` carries a scaled BYTE-offset temp — legal only where a byte can
 * address the whole extent. `wordIndex` carries an UNSCALED runtime index for
 * the word-domain formation path (tier-2 arrays, multi-byte elements through
 * pairs), with `wordScale` the element size the formation applies; the two
 * index forms are mutually exclusive.
 */
interface Place {
  readonly baseKind: "direct" | "pair";
  readonly symbol: string;
  readonly constOffset: number;
  readonly index: ILOperand | null;
  readonly wordIndex: ILOperand | null;
  readonly wordScale: number;
}

/**
 * Resolves an l-value/read chain (`a`, `a[i]`, `s.f`, `world.rooms[i].door`)
 * to its {@link Place}: constant indexes fold into the offset (zero runtime
 * cost); runtime indexes scale by the element size through the ordinary
 * `mul` path and chain by byte-offset addition. Returns `null` for shapes
 * that are not places (the caller reports).
 */
function lowerPlace(expr: ExprNode, ctx: LowerCtx): Place | null {
  switch (expr.kind) {
    case "IdentExpr": {
      const sym = ctx.model.symbolOf(expr);
      return sym === null ? null : basePlace(sym, ctx);
    }
    case "FieldAccessExpr": {
      // A qualified module head (`Mod.x`) carries its symbol on the node.
      const qualified = ctx.model.symbolOf(expr);
      if (qualified !== null && (qualified.kind === "variable" || qualified.kind === "constant")) {
        return basePlace(qualified, ctx);
      }
      const objType = ctx.model.typeOf(expr.object);
      if (objType.kind !== "struct") return null;
      const field = objType.fields.get(expr.field);
      if (field === undefined) return null;
      const inner = lowerPlace(expr.object, ctx);
      if (inner === null) return null;
      return { ...inner, constOffset: inner.constOffset + field.offset };
    }
    case "IndexExpr": {
      const objType = ctx.model.typeOf(expr.object);
      if (objType.kind !== "array") return null;
      const inner = lowerPlace(expr.object, ctx);
      if (inner === null) return null;
      const elemSize = byteSize(objType.element);
      const idx = lowerExpr(expr.index, ctx);
      if (idx.kind === "immediate") {
        return { ...inner, constOffset: inner.constOffset + idx.value * elemSize };
      }

      // Runtime index — classify by domain. The BYTE domain (the mod-256
      // scaler feeding the indexed/offset operands) is safe only where a
      // byte can address the whole extent: on a DIRECT base, a known array
      // span within one indexed page (the absolute base absorbs any const
      // offset); on a PAIR base, single-byte elements whose reachable span
      // never leaves the Y range — an unsized parameter qualifies exactly
      // at offset 0 (its pointee is byte-addressable by definition), a sized
      // one when offset+span fits. Everything else — word indexes,
      // multi-byte elements through pairs, tier-2 spans — is the WORD
      // domain: the formation path scales and adds at pointer width.
      const idxIsByte = idx.type.width === 8;
      const spanKnown = objType.size !== null ? objType.size * elemSize : null;
      const byteDomainSafe =
        idxIsByte &&
        (inner.baseKind === "direct"
          ? spanKnown !== null && spanKnown <= 256
          : elemSize === 1 &&
            (spanKnown !== null
              ? inner.constOffset + spanKnown - 1 <= 255
              : inner.constOffset === 0));

      if (byteDomainSafe && inner.wordIndex === null) {
        const scaled = inner.baseKind === "direct" ? scaleIndex(idx, elemSize, ctx) : idx;
        const combined =
          inner.index === null ? scaled : addByteOffsets(inner.index, scaled, ctx);
        return { ...inner, index: combined };
      }
      if (inner.index !== null || inner.wordIndex !== null) {
        // Two runtime indexes on one chain (nested arrays) — out of scope.
        iceUnsupported(expr, ctx, "nested runtime indexes in one access chain");
        return null;
      }
      const wordIdx = idxIsByte ? zextToWord(idx, ctx) : idx;
      return { ...inner, wordIndex: wordIdx, wordScale: elemSize };
    }
    default:
      return null;
  }
}

/** Zero-extends a byte operand to word (the formation path's index domain). */
function zextToWord(idx: ILOperand, ctx: LowerCtx): ILOperand {
  const dest = ctx.builder.newTemp(IL_WORD);
  ctx.builder.emit({ op: "zext", dest, src: idx });
  return dest;
}

/** The base place of a declared symbol (frame slot, module var, const data, pair). */
function basePlace(sym: Symbol, ctx: LowerCtx): Place | null {
  const direct = (symbol: string): Place => ({
    baseKind: "direct",
    symbol,
    constOffset: 0,
    index: null,
    wordIndex: null,
    wordScale: 1,
  });
  // A by-ref parameter's chain accesses go THROUGH its bound pointer pair.
  if (sym.kind === "parameter" && sym.byRef) {
    if (!ctx.model.pairAccessedParams.has(sym)) {
      // Every through-access marks the param pair-accessed by construction;
      // a miss means the classification and this chain diverged.
      return null;
    }
    return {
      baseKind: "pair",
      symbol: pairSymbol(ctx.fqName, sym.name),
      constOffset: 0,
      index: null,
      wordIndex: null,
      wordScale: 1,
    };
  }
  if (sym.kind === "constant" && isAggregateType(sym.type)) {
    return direct(constDataSymbol(sym));
  }
  const moduleVar = moduleVarLocOfSymbol(sym);
  if (moduleVar !== null) {
    return direct(moduleVar.symbol);
  }
  if (ctx.moduleInit) return null; // no frame storage in the init stream
  return direct(frameSymbol(ctx.fqName, sym.name));
}

/** The bound pointer-pair symbol of a by-ref param (`__zp_ptr_<Module_fn>_<param>`). */
function pairSymbol(fqName: string, paramName: string): string {
  return `__zp_ptr_${fqName.replaceAll(".", "_")}_${paramName}`;
}

/** The shared scratch pair the runtime pointer formation stages through. */
const SCRATCH_PAIR = "__zp_ptr_scratch";

/** The interrupt-only formation twin — see `LowerCtx.scratchPair`. */
const IRQ_SCRATCH_PAIR = "__zp_irq_ptr_scratch";

/** Narrows an expression to an address-of unary (`&x`). */
function isAddressOfExpr(e: ExprNode): e is UnaryExprNode {
  return e.kind === "UnaryExpr" && (e as UnaryExprNode).op === "&";
}

/**
 * The emitted entry label of a function/interrupt symbol — the same rule the
 * instruction layer applies to function streams: the entry point (bare name
 * `main`) is `_main`, every other function is `Module_function`.
 */
function functionEntryLabel(sym: Symbol): string {
  if (sym.name === "main") return "_main";
  const node = sym.scope.node;
  const moduleName = node !== null && node.kind === "ModuleDecl" ? (node as ModuleDeclNode).name : "";
  return `${moduleName}_${sym.name}`;
}

/**
 * Lower `&x` to its link-time address. The operand's symbol maps to the
 * storage the assembler resolves: a module variable's `__var_*` slot, a
 * local's `__frame_*` slot, a const aggregate's `__data_*` image, or a
 * function's entry label.
 *
 * An address operand is legal only as a store source or an ALU right
 * operand, so placement is two-mode: a `direct` caller sits on a plain store
 * (let initialiser, simple assignment, call argument, `poke`/`pokew` value)
 * and receives the raw address operand; every other position first homes the
 * address into the site's synthetic word frame slot and hands back the slot,
 * which any consumer can read. Every site claims its slot either way — the
 * frame planner counted one per `&` site, and the claim keeps the two
 * counters aligned (a drift is a loud slot-miss rejection, never a silent
 * mis-address).
 */
function lowerAddressOf(expr: UnaryExprNode, ctx: LowerCtx, direct: boolean): ILOperand {
  const slot = claimResultSlot(expr, ctx); // claimed at node entry — preorder
  const sym = ctx.model.symbolOf(expr.operand);
  if (sym === null) {
    return iceUnsupported(expr, ctx, "address-of operand (unresolved symbol)");
  }
  let symbol: string;
  if (sym.kind === "variable") {
    const moduleVar = moduleVarLocOfSymbol(sym);
    symbol = moduleVar !== null ? moduleVar.symbol : frameSymbol(ctx.fqName, sym.name);
  } else if (sym.kind === "constant") {
    symbol = constDataSymbol(sym); // typing admits only aggregates (they own an image)
    // Taking a const image's address is the program asking for the raw address
    // itself, which is worth aligning: only hardware reading in page or block
    // units needs one. The mark has to be made HERE, at the source-level `&`,
    // and nowhere downstream — a by-reference argument emits an identical
    // address operand, and a rule that scanned operands would align every
    // table ever passed to a helper. Every caller of this function sits behind
    // an address-of check, so the by-ref path cannot reach this line.
    ctx.addressTakenConsts.add(symbol);
  } else if (sym.kind === "function" || sym.kind === "interrupt") {
    symbol = functionEntryLabel(sym);
  } else {
    return iceUnsupported(expr, ctx, "address-of operand kind");
  }
  const address = addrOf(symbol);
  if (direct) return address;
  if (slot === null) return imm(0, IL_WORD); // slot miss already rejected loudly
  ctx.builder.emit({ op: "store", a: address, b: slot });
  return slot;
}

/** The in-image data label of a const aggregate: `__data_<Module>_<name>`. */
function constDataSymbol(sym: Symbol): string {
  const node = sym.scope.node;
  const moduleName = node !== null && node.kind === "ModuleDecl" ? (node as ModuleDeclNode).name : "";
  return `__data_${moduleName}_${sym.name}`;
}

/** Scales a runtime index temp by the element size (byte-domain `mul`). */
function scaleIndex(idx: ILOperand, elemSize: number, ctx: LowerCtx): ILOperand {
  if (elemSize === 1) return idx;
  const dest = ctx.builder.newTemp(IL_BYTE);
  ctx.builder.emit({ op: "mul", dest, left: idx, right: imm(elemSize, IL_BYTE), type: IL_BYTE });
  return dest;
}

/** Adds two byte-offset temps (nested runtime indexes fold into one). */
function addByteOffsets(a: ILOperand, b: ILOperand, ctx: LowerCtx): ILOperand {
  const dest = ctx.builder.newTemp(IL_BYTE);
  ctx.builder.emit({ op: "add", dest, left: a, right: b, type: IL_BYTE });
  return dest;
}

/** Emits the load of a place into a fresh temp (direct, indexed, or indirect). */
function emitPlaceLoad(place: Place, ilType: ILType, ctx: LowerCtx): ILOperand {
  const dest = ctx.builder.newTemp(ilType);
  if (place.baseKind === "pair" || place.wordIndex !== null) {
    const access = resolveIndirectAccess(place, ilType, ctx);
    ctx.builder.emit({ op: "load_indirect", value: dest, ptr: access.ptr, offset: access.offset });
    return dest;
  }
  const base = loc(place.symbol, ilType, place.constOffset === 0 ? undefined : place.constOffset);
  if (place.index === null) {
    ctx.builder.emit({ op: "load", a: dest, b: base });
  } else {
    ctx.builder.emit({ op: "load_indexed", value: dest, base, index: place.index });
  }
  return dest;
}

/**
 * Emits the store of a value to a place. Direct stores follow the store
 * convention (temp values — immediates wrap in a `const`); indexed and
 * indirect stores take the RAW operand — the translator loads an immediate
 * AFTER the index is staged, and wrapping it first would clobber the
 * register-resident index.
 */
function emitPlaceStore(place: Place, ilType: ILType, value: ILOperand, ctx: LowerCtx): void {
  if (place.baseKind === "pair" || place.wordIndex !== null) {
    const access = resolveIndirectAccess(place, ilType, ctx);
    ctx.builder.emit({ op: "store_indirect", value, ptr: access.ptr, offset: access.offset });
    return;
  }
  const base = loc(place.symbol, ilType, place.constOffset === 0 ? undefined : place.constOffset);
  if (place.index === null) {
    ctx.builder.emit({ op: "store", a: materialise(value, ctx), b: base });
  } else {
    ctx.builder.emit({ op: "store_indexed", value, base, index: place.index });
  }
}

/**
 * Resolves an indirect access's pointer and offset operands, staging the
 * runtime pointer FORMATION through the scratch pair when needed.
 *
 * The fast path — a pair base with no runtime index whose whole value fits
 * a Y-indexed reach (`constOffset + valueSize − 1 ≤ 255`, so a word never
 * straddles the Y wrap) — reads through the pair directly at an immediate
 * offset; a byte-domain index rides the offset operand the same way. Every
 * other shape forms the effective pointer in `__zp_ptr_scratch`:
 *
 *   1. scale the word-domain index in place (shift for power-of-two element
 *      sizes, the runtime multiply otherwise), homing the result in scratch;
 *   2. add the base — the pair's contents (loaded, so the add reads memory)
 *      or the direct symbol's ADDRESS (an `addr` right operand, resolved by
 *      the assembler) — and home the sum back in scratch;
 *   3. access `(scratch)` at offset 0.
 *
 * Every word intermediate is consumed by the immediately-following store
 * (the translator's fused word-store discipline) with one scratch home.
 */
function resolveIndirectAccess(
  place: Place,
  ilType: ILType,
  ctx: LowerCtx,
): { ptr: ILOperand; offset: ILOperand } {
  const valueSize = ilType.width === 16 ? 2 : 1;
  const pairPtr = loc(place.symbol, IL_WORD);

  if (place.baseKind === "pair" && place.wordIndex === null) {
    if (place.index !== null) {
      // Byte-domain index (single-byte elements): the offset operand carries
      // it; a non-zero const offset folds in through the byte adder (the
      // byte-domain gate bounded the whole span to 255).
      const offset =
        place.constOffset === 0
          ? place.index
          : addByteOffsets(place.index, imm(place.constOffset, IL_BYTE), ctx);
      return { ptr: pairPtr, offset };
    }
    if (place.constOffset + valueSize - 1 <= 255) {
      return { ptr: pairPtr, offset: imm(place.constOffset, IL_BYTE) };
    }
  }

  // Formation. Guard the reservation first — staging without the scratch
  // pair would emit a dangling symbol.
  if (!ctx.plan.symbolDefinitions.some((s) => s.name === ctx.scratchPair)) {
    ctx.bag.addICE(
      IceCode.Unexpected,
      null,
      `IL lowering: runtime pointer formation demanded but '${ctx.scratchPair}' is not reserved`,
    );
    return { ptr: loc(ctx.scratchPair, IL_WORD), offset: imm(0, IL_BYTE) };
  }
  const scratch = loc(ctx.scratchPair, IL_WORD);

  // (1) The scaled index (word domain) — homed in scratch. With no runtime
  // index the base's big const offset alone drives the formation.
  let indexInScratch = false;
  if (place.wordIndex !== null) {
    let scaled = place.wordIndex;
    if (place.wordScale === 2) {
      const t = ctx.builder.newTemp(IL_WORD);
      ctx.builder.emit({ op: "shl", dest: t, left: scaled, right: imm(1, IL_BYTE), type: IL_WORD });
      scaled = t;
    } else if (place.wordScale > 2) {
      const t = ctx.builder.newTemp(IL_WORD);
      ctx.builder.emit({
        op: "mul",
        dest: t,
        left: scaled,
        right: imm(place.wordScale, IL_WORD),
        type: IL_WORD,
      });
      scaled = t;
    }
    ctx.builder.emit({ op: "store", a: scaled, b: scratch });
    indexInScratch = true;
  }

  // (2) Add the base (+ const offset) into scratch.
  const eff = ctx.builder.newTemp(IL_WORD);
  if (place.baseKind === "pair") {
    const baseVal = ctx.builder.newTemp(IL_WORD);
    ctx.builder.emit({ op: "load", a: baseVal, b: pairPtr });
    const rhs = indexInScratch
      ? emitScratchLoad(ctx)
      : imm(place.constOffset, IL_WORD);
    ctx.builder.emit({ op: "add", dest: eff, left: baseVal, right: rhs, type: IL_WORD });
    ctx.builder.emit({ op: "store", a: eff, b: scratch });
    // A pair base with an index still owes its const offset — small offsets
    // ride the access itself below.
    if (indexInScratch && place.constOffset > 255) {
      const eff2 = ctx.builder.newTemp(IL_WORD);
      const cur = emitScratchLoad(ctx);
      ctx.builder.emit({
        op: "add",
        dest: eff2,
        left: cur,
        right: imm(place.constOffset, IL_WORD),
        type: IL_WORD,
      });
      ctx.builder.emit({ op: "store", a: eff2, b: scratch });
    }
  } else if (indexInScratch) {
    // Direct base + index: scratch already holds the scaled index; add the
    // base symbol's address as an assembler-resolved right operand.
    const cur = emitScratchLoad(ctx);
    ctx.builder.emit({
      op: "add",
      dest: eff,
      left: cur,
      right: addrOf(place.symbol, place.constOffset),
      type: IL_WORD,
    });
    ctx.builder.emit({ op: "store", a: eff, b: scratch });
  } else {
    // Direct base, no index (a big const offset alone): seed the folded
    // address straight into scratch.
    ctx.builder.emit({ op: "store", a: addrOf(place.symbol, place.constOffset), b: scratch });
  }

  const residual =
    place.baseKind === "pair" && indexInScratch && place.constOffset <= 255
      ? place.constOffset
      : 0;
  return { ptr: scratch, offset: imm(residual, IL_BYTE) };
}

/** Loads this function's scratch pair's current word into a fresh temp. */
function emitScratchLoad(ctx: LowerCtx): ILOperand {
  const t = ctx.builder.newTemp(IL_WORD);
  ctx.builder.emit({ op: "load", a: t, b: loc(ctx.scratchPair, IL_WORD) });
  return t;
}

/**
 * Forms the COMPLETE runtime address of an argument's place in the scratch
 * pair and returns the scratch location — a word the caller stores into the
 * callee's by-reference frame home. Unlike an indirect access — which may
 * leave a small constant offset for the access's own offset operand — the
 * callee receives one finished address, so every component (base, scaled
 * index, constant offset) folds into the formed word here.
 *
 * The idioms mirror the indirect-access formation: each word intermediate
 * homes in scratch via its immediately-following store (the translator's
 * fused word-store discipline); a direct base joins as an assembler-resolved
 * address right operand; a pair base is loaded and added at runtime. A
 * byte-domain index arrives already scaled (its gate bounded the span) and
 * widens; a word-domain index scales by the element size first.
 *
 * Returns `null` (with a loud rejection recorded) if the scratch pair was
 * never reserved — emitting would produce a dangling symbol.
 */
function formArgumentAddress(place: Place, ctx: LowerCtx): ILOperand | null {
  if (!ctx.plan.symbolDefinitions.some((s) => s.name === ctx.scratchPair)) {
    ctx.bag.addICE(
      IceCode.Unexpected,
      null,
      `IL lowering: argument-address formation demanded but '${ctx.scratchPair}' is not reserved`,
    );
    return null;
  }
  const scratch = loc(ctx.scratchPair, IL_WORD);

  // (1) Any runtime index lands scaled, word-wide, in scratch.
  let indexInScratch = false;
  if (place.index !== null) {
    const widened = zextToWord(place.index, ctx);
    ctx.builder.emit({ op: "store", a: widened, b: scratch });
    indexInScratch = true;
  } else if (place.wordIndex !== null) {
    let scaled = place.wordIndex;
    if (place.wordScale === 2) {
      const t = ctx.builder.newTemp(IL_WORD);
      ctx.builder.emit({ op: "shl", dest: t, left: scaled, right: imm(1, IL_BYTE), type: IL_WORD });
      scaled = t;
    } else if (place.wordScale > 2) {
      const t = ctx.builder.newTemp(IL_WORD);
      ctx.builder.emit({
        op: "mul",
        dest: t,
        left: scaled,
        right: imm(place.wordScale, IL_WORD),
        type: IL_WORD,
      });
      scaled = t;
    }
    ctx.builder.emit({ op: "store", a: scaled, b: scratch });
    indexInScratch = true;
  }

  // (2) Base + constant offset, folded completely into scratch.
  if (place.baseKind === "pair") {
    const baseVal = ctx.builder.newTemp(IL_WORD);
    ctx.builder.emit({ op: "load", a: baseVal, b: loc(place.symbol, IL_WORD) });
    const eff = ctx.builder.newTemp(IL_WORD);
    const rhs = indexInScratch ? emitScratchLoad(ctx) : imm(place.constOffset, IL_WORD);
    ctx.builder.emit({ op: "add", dest: eff, left: baseVal, right: rhs, type: IL_WORD });
    ctx.builder.emit({ op: "store", a: eff, b: scratch });
    if (indexInScratch && place.constOffset !== 0) {
      const cur = emitScratchLoad(ctx);
      const eff2 = ctx.builder.newTemp(IL_WORD);
      ctx.builder.emit({
        op: "add",
        dest: eff2,
        left: cur,
        right: imm(place.constOffset, IL_WORD),
        type: IL_WORD,
      });
      ctx.builder.emit({ op: "store", a: eff2, b: scratch });
    }
  } else if (indexInScratch) {
    const cur = emitScratchLoad(ctx);
    const eff = ctx.builder.newTemp(IL_WORD);
    ctx.builder.emit({
      op: "add",
      dest: eff,
      left: cur,
      right: addrOf(place.symbol, place.constOffset),
      type: IL_WORD,
    });
    ctx.builder.emit({ op: "store", a: eff, b: scratch });
  } else {
    // Direct static base (defensive — the caller stores that address
    // directly without formation).
    ctx.builder.emit({ op: "store", a: addrOf(place.symbol, place.constOffset), b: scratch });
  }
  return scratch;
}

/** An index-expression read: resolve the place, load the element. */
function lowerIndexRead(expr: IndexExprNode, ctx: LowerCtx): ILOperand {
  return lowerPlaceRead(expr, ctx);
}

/** A place-shaped read (index/struct-field chains). */
function lowerPlaceRead(expr: ExprNode, ctx: LowerCtx): ILOperand {
  const place = lowerPlace(expr, ctx);
  if (place === null) return iceUnsupported(expr, ctx, "aggregate access");
  return emitPlaceLoad(place, ilTypeOfType(ctx.model.typeOf(expr)), ctx);
}

/**
 * Initialises an aggregate place from an initialiser expression: array
 * literals store per element (the fill value is evaluated once and stored
 * into every remaining slot — the declared size bounds the unroll), struct
 * literals store per field at their layout offsets, nested literals recurse,
 * and a place-shaped source (whole-struct copy, R37) unrolls into per-byte
 * load/store pairs.
 */
function lowerAggregateInit(place: Place, type: Type, init: ExprNode, ctx: LowerCtx): void {
  if (type.kind === "array" && init.kind === "ArrayLitExpr") {
    const elemSize = byteSize(type.element);
    const elemIl = ilTypeOfType(type.element);
    init.elements.forEach((element, i) => {
      const at = { ...place, constOffset: place.constOffset + i * elemSize };
      lowerElementInit(at, type.element, elemIl, element, ctx);
    });
    // A fill under an UNSIZED annotation never reaches lowering (typing
    // rejects it — the fill needs a declared count), so a null size here
    // simply has no remainder to unroll.
    const declaredSize = type.size;
    if (init.fill !== null && declaredSize !== null && init.elements.length < declaredSize) {
      const fill = lowerExpr(init.fill, ctx);
      for (let i = init.elements.length; i < declaredSize; i += 1) {
        const at = { ...place, constOffset: place.constOffset + i * elemSize };
        emitPlaceStore(at, elemIl, fill, ctx);
      }
    }
    return;
  }
  if (type.kind === "struct" && init.kind === "StructLitExpr") {
    for (const field of init.fields) {
      const layout = type.fields.get(field.name);
      if (layout === undefined) continue; // typing already rejected extras
      const at = { ...place, constOffset: place.constOffset + layout.offset };
      lowerElementInit(at, layout.type, ilTypeOfType(layout.type), field.value, ctx);
    }
    return;
  }
  // A non-literal source: whole-aggregate copy from another place.
  const src = lowerPlace(init, ctx);
  if (
    src === null ||
    src.index !== null ||
    src.wordIndex !== null ||
    place.index !== null ||
    place.wordIndex !== null
  ) {
    iceUnsupported(init, ctx, "aggregate initialiser");
    return;
  }
  const total = byteSize(type);
  for (let i = 0; i < total; i += 1) {
    const from = { ...src, constOffset: src.constOffset + i };
    const to = { ...place, constOffset: place.constOffset + i };
    const b = emitPlaceLoad(from, IL_BYTE, ctx);
    emitPlaceStore(to, IL_BYTE, b, ctx);
  }
}

/** One element/field of an aggregate initialiser: recurse or store a scalar. */
function lowerElementInit(
  at: Place,
  elemType: Type,
  elemIl: ILType,
  value: ExprNode,
  ctx: LowerCtx,
): void {
  if (isAggregateType(elemType)) {
    lowerAggregateInit(at, elemType, value, ctx);
    return;
  }
  const v = lowerExpr(value, ctx);
  emitPlaceStore(at, elemIl, v, ctx);
}

/**
 * An RMW target: a plain memory location, or an indirect access through a
 * bound pointer pair at an immediate offset (the pair-base compound form —
 * the value behind the pointer is modified, never the pointer's own bytes).
 */
type RmwTarget =
  | ILOperand
  | { readonly indirect: true; readonly ptr: ILOperand; readonly offset: ILOperand; readonly type: ILType };

/** The indirect RMW view of a pair-base place (no runtime index). */
function indirectRmwTarget(place: Place): RmwTarget {
  return {
    indirect: true,
    ptr: loc(place.symbol, IL_WORD),
    offset: imm(place.constOffset, IL_BYTE),
    type: IL_BYTE,
  };
}

/**
 * Lower `x OP= e` with the expanded form's semantics: load the target's
 * current value, lower the rhs, coerce both to the expansion's type, emit the
 * binary op (same table and signed-div/mod guard as any binary), and store
 * the result back. Scalar l-values have no side effects, so single evaluation
 * is structural. Typing guarantees the result assigns back to the target
 * (same width by then) — the closing coercion is identity in legal programs.
 */
function lowerCompoundAssign(expr: AssignExprNode, target: RmwTarget, ctx: LowerCtx): ILOperand {
  const baseOp = COMPOUND_BASE_OP[expr.op];
  const ilOp = baseOp === undefined ? undefined : BINARY_OP_TO_IL[baseOp];
  if (ilOp === undefined) {
    return iceUnsupported(expr, ctx, `compound assignment '${expr.op}'`);
  }

  const targetType = ctx.model.typeOf(expr.target);
  const valueType = ctx.model.typeOf(expr.value);
  const isShift = ilOp === "shl" || ilOp === "shr";
  const expansionType: Type = isShift
    ? targetType
    : (commonType(targetType, valueType) ?? targetType);

  if ((ilOp === "div" || ilOp === "mod") && isSignedInteger(expansionType)) {
    return iceUnsupported(expr, ctx, "signed division/modulo (unsigned runtime routines only)");
  }

  const indirect = "indirect" in target ? target : null;
  const direct = "indirect" in target ? null : target;
  const current = ctx.builder.newTemp(indirect !== null ? indirect.type : direct!.type);
  if (indirect !== null) {
    ctx.builder.emit({
      op: "load_indirect",
      value: current,
      ptr: indirect.ptr,
      offset: indirect.offset,
    });
  } else if (direct !== null) {
    ctx.builder.emit({ op: "load", a: current, b: direct });
  }
  const rhs = lowerExpr(expr.value, ctx);

  const left = coerce(current, targetType, expansionType, ctx);
  const right = isShift ? rhs : coerce(rhs, valueType, expansionType, ctx);
  const ilType = ilTypeOfType(expansionType);
  const dest = ctx.builder.newTemp(ilType);
  ctx.builder.emit({ op: ilOp, dest, left, right, type: ilType } as ILInstruction);

  const result = materialise(coerce(dest, expansionType, targetType, ctx), ctx);
  if (indirect !== null) {
    ctx.builder.emit({
      op: "store_indirect",
      value: result,
      ptr: indirect.ptr,
      offset: indirect.offset,
    });
  } else if (direct !== null) {
    ctx.builder.emit({ op: "store", a: result, b: direct });
  }
  return result;
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

/**
 * Looks a (possibly dotted) type name up in an FQN-keyed (`"Module.Name"`)
 * type table, as seen from the function being lowered: the current module's
 * qualification first, a dotted name verbatim, then — for import-bound bare
 * names, which the model's FQN keys can't express here — a unique-suffix
 * match (exactly one module declares that name). An ambiguous bare name
 * resolves to nothing (defensive; the frontend reports collisions).
 */
function lookupFqn<T>(name: string, table: ReadonlyMap<string, T>, ctx: LowerCtx): T | undefined {
  const dot = ctx.fqName.lastIndexOf(".");
  const currentModule = dot >= 0 ? ctx.fqName.slice(0, dot) : "";
  const direct = table.get(`${currentModule}.${name}`) ?? table.get(name);
  if (direct !== undefined) return direct;
  let found: T | undefined;
  for (const [key, value] of table) {
    if (!key.endsWith(`.${name}`)) continue;
    if (found !== undefined) return undefined; // ambiguous — never guess
    found = value;
  }
  return found;
}

/** The byte size of an AST type (primitive fixed sizes; struct/enum from the model). */
function sizeOfType(node: TypeNode, ctx: LowerCtx): number {
  switch (node.kind) {
    case "PrimitiveType":
      return byteSize(primitive(node.name));
    case "NamedType": {
      const struct = lookupFqn(node.name, ctx.model.structTypes, ctx);
      if (struct !== undefined) return struct.byteSize;
      return lookupFqn(node.name, ctx.model.enumTypes, ctx) !== undefined ? 1 : 0; // enum backing = 1 byte
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
    return lookupFqn(node.name, ctx.model.structTypes, ctx)?.fields.get(field)?.offset ?? 0;
  }
  return 0;
}

/** The element count of an array variable (from its resolved frame-slot type). */
function lengthOfArray(arg: ExprNode | undefined, ctx: LowerCtx): number {
  if (arg === undefined) return 0;
  // The resolved symbol (local, module var, const, or qualified `Mod.arr`)
  // carries the authoritative array type.
  // An UNSIZED array (a `T[]` parameter) never reaches this fold — typing
  // rejects `length()` on it — so a null size falls through to the shared
  // not-found default.
  if (arg.kind === "IdentExpr" || arg.kind === "FieldAccessExpr") {
    const sym = ctx.model.symbolOf(arg);
    if (sym !== null && sym.type.kind === "array" && sym.type.size !== null) {
      return sym.type.size;
    }
  }
  if (arg.kind === "IdentExpr") {
    const slot = ctx.frame?.slots.find((s) => s.name === arg.name);
    const type: Type | undefined = slot?.type;
    if (type !== undefined && type.kind === "array" && type.size !== null) return type.size;
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
  const wordArg = valueExpr ?? errorExpr();
  // An address-of value (the vector-install idiom) feeds the word store
  // directly — the assembler materialises the label's two bytes.
  const value = isAddressOfExpr(wordArg)
    ? lowerAddressOf(wordArg, ctx, true)
    : lowerExpr(wordArg, ctx);
  ctx.builder.emit({ op: "store", a: value, b: loc(hexAddr(base), IL_WORD) });
  return imm(0, IL_BYTE);
}

/**
 * The compile-time value of a numeric literal or a resolved named constant,
 * or `null` for anything else. Accepting a named constant matters: refusing
 * one would make the more readable spelling of a block size the slower one.
 */
function constantOperandValue(e: ExprNode, ctx: LowerCtx): number | null {
  if (e.kind === "NumericLitExpr") return e.value;
  if (e.kind !== "IdentExpr" && e.kind !== "FieldAccessExpr") return null;
  const sym = ctx.model.symbolOf(e);
  if (sym === null || sym.kind !== "constant") return null;
  const value = ctx.model.constValues.get(sym);
  return value !== undefined && typeof value.value === "number" ? value.value : null;
}

/**
 * `&X / 2^k` and `&X >> k` reduced to a single selected byte of the address,
 * or `null` when the expression is not that shape.
 *
 * A sprite's block number is its address divided by 64 — arithmetic on a
 * link-time constant, which the assembler performs for free. Without this the
 * division of a constant becomes a call to the 16-bit runtime divide.
 *
 * The two operators reach `k` differently and conflating them would be a
 * defect: `/` takes a power-of-two DIVISOR, `>>` takes a shift COUNT — `>> 6`
 * has a right operand of 6, which is not a power of two. The divisor is read
 * unmasked, because a count up to 15 means divisors up to 32768.
 *
 * Anything outside the shape falls through to the caller's existing path and
 * keeps its existing diagnostics: a non-power-of-two divisor still emits the
 * runtime divide and its warning, a count at or past the type width still
 * fails the way it does today.
 */
function foldedAddressByte(arg: ExprNode, ctx: LowerCtx): ILOperand | null {
  if (arg.kind !== "BinaryExpr") return null;
  const binary = arg as BinaryExprNode;
  if (binary.op !== "/" && binary.op !== ">>") return null;
  if (!isAddressOfExpr(binary.left)) return null;

  const right = constantOperandValue(binary.right, ctx);
  if (right === null) return null;
  const shift = binary.op === "/" ? log2Exact(right) : right;
  if (shift === null || shift < 0 || shift > 15) return null;

  // The address lowers through the address-of path, so the fold inherits that
  // path's slot claim and data-placement marking exactly as a plain select does.
  const address = lowerAddressOf(binary.left, ctx, true);
  if (!isAddr(address)) return address; // rejection already reported
  if (address.offset !== undefined) {
    // An addend cannot ride inside the division: the assembler binds `/`
    // tighter than `+`, so `sym+3 / 64` divides the 3 and quietly yields a
    // different byte. No address-of form produces an offset today, and this
    // fails loudly rather than dropping one if some future form does.
    // Falling through instead is not an option — the slot for this site has
    // already been claimed, and the ordinary path would claim a second.
    return iceUnsupported(binary, ctx, "byte select of an address with an offset");
  }
  // Dividing by one names the address itself; emitting `#<(sym / 1)` would
  // assemble to the same byte and read as noise. This is an explicit branch
  // rather than a fall-through — the argument is a binary expression, so it
  // could never reach the plain address-of case below.
  return shift === 0 ? addrByteOf(address.symbol, "low") : addrByteOf(address.symbol, "low", shift);
}

/**
 * `lo(val)` → the low byte. A constant folds to an immediate. A power-of-two
 * division or shift of an address folds into the byte select itself, so the
 * assembler resolves it. A runtime 16-bit value truncates (`trunc` reads the
 * operand's home low byte); an 8-bit value IS its own low byte (identity —
 * the widened word's low byte equals the original pattern).
 */
function emitLo(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  const arg = expr.args[0];
  if (arg === undefined) return iceUnsupported(expr, ctx, "lo() argument");
  if (arg.kind === "NumericLitExpr") {
    return imm(arg.value & 0xff, IL_BYTE);
  }
  const folded = foldedAddressByte(arg, ctx);
  if (folded !== null) return folded;
  if (isAddressOfExpr(arg)) {
    // The low byte of a link-time constant is a link-time constant: the
    // assembler selects it, exactly as it does for a numeric literal above.
    // The address still lowers through the address-of path so it keeps that
    // path's slot claim and its data-placement marking.
    const address = lowerAddressOf(arg, ctx, true);
    if (!isAddr(address)) return address; // rejection already reported
    return addrByteOf(address.symbol, "low");
  }
  const value = lowerExpr(arg, ctx);
  if (value.type.width === 8) return value; // identity
  if (value.kind === "immediate") {
    return imm(value.value & 0xff, IL_BYTE); // an inlined constant folds too
  }
  const dest = ctx.builder.newTemp(IL_BYTE);
  ctx.builder.emit({ op: "trunc", dest, src: value });
  return dest;
}

/**
 * `hi(val)` → the high byte. A constant folds to an immediate. A runtime
 * MEMORY-RESIDENT 16-bit value (a local/param or module variable) reads its
 * storage location at offset +1 — the high byte of a little-endian word,
 * which for `sword` is also the sign-carrying byte, so no shift machinery is
 * needed. An unsigned 8-bit value's widened high byte is always 0. A
 * computed 16-bit argument or a signed 8-bit argument (whose widened high
 * byte would need sign extension) is rejected loudly for now.
 */
function emitHi(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  const arg = expr.args[0];
  if (arg === undefined) return iceUnsupported(expr, ctx, "hi() argument");
  if (arg.kind === "NumericLitExpr") {
    return imm((arg.value >> 8) & 0xff, IL_BYTE);
  }
  if (isAddressOfExpr(arg)) {
    // The high byte of a link-time constant is a link-time constant; see the
    // low-byte case above for why the address still lowers through the
    // address-of path rather than being named directly.
    const address = lowerAddressOf(arg, ctx, true);
    if (!isAddr(address)) return address; // rejection already reported
    return addrByteOf(address.symbol, "high");
  }

  const argIl = ilTypeOfType(ctx.model.typeOf(arg));
  if (argIl.width === 8) {
    if (argIl.signed) {
      return iceUnsupported(expr, ctx, "hi() of a signed 8-bit value (sign extension)");
    }
    return imm(0, IL_BYTE); // a widened byte's high byte is always 0
  }

  if (arg.kind === "IdentExpr" || arg.kind === "FieldAccessExpr") {
    const sym = ctx.model.symbolOf(arg);
    if (sym !== null && sym.kind === "constant") {
      const value = ctx.model.constValues.get(sym);
      if (value !== undefined && typeof value.value === "number") {
        return imm((value.value >> 8) & 0xff, IL_BYTE);
      }
      return iceUnsupported(expr, ctx, "hi() of a constant without an evaluated value");
    }
    const moduleVar = sym !== null ? moduleVarLocOfSymbol(sym) : null;
    let base: string | null = null;
    if (moduleVar !== null) {
      base = moduleVar.symbol;
    } else if (arg.kind === "IdentExpr" && !ctx.moduleInit) {
      base = frameSymbol(ctx.fqName, arg.name);
    }
    if (base !== null) {
      const dest = ctx.builder.newTemp(IL_BYTE);
      ctx.builder.emit({ op: "load", a: dest, b: loc(base, IL_BYTE, 1) });
      return dest;
    }
  }
  return iceUnsupported(expr, ctx, "hi() of a computed 16-bit value");
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

/** An enum type reads as its `byte` backing; every other type is itself. */
function asByteBacking(t: Type): Type {
  return t.kind === "enum" ? primitive("byte") : t;
}

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
  // A zeropage variable addresses through its ZP equate instead of the RAM
  // slot — everything downstream (reads, writes, indexed access, address-of,
  // the startup stream) rides the same symbol swap.
  if (sym.storage === "zeropage") {
    return { symbol: `__zp_${moduleName}_${sym.name}`, type: ilTypeOfType(sym.type) };
  }
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
