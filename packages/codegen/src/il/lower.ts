/**
 * AST→IL lowering for the RD-06 gate/slice-2 surface (R29–R52 subset, R68/R69,
 * §3.5/§4.7/§4.12; registers D1/D5/D8/D9).
 *
 * `lowerToIL` walks the validated AST and emits an {@link ILProgram}. Per D1 only
 * the **gate + slice-2 surface** is lowered; every other AST node kind reaches a
 * visitor **default arm** that raises an `E90001` ICE (D6/R69) and returns a
 * poison operand so the walk continues deterministically — it **never throws**.
 * Per D5 the lowering is real and fixture-tested today; only the live façade
 * wiring (a populated `SemanticModel`) is deferred, so under the live passthrough
 * the program is empty and this returns an empty `ILProgram`.
 *
 * Two register decisions shape the textual surface:
 * - **D8** — function-header params are the plan-backed frame-slot `Location`
 *   operands, rendered verbatim (`__frame_Math_add_a: i8u`).
 * - **D9** — the `poke`/`peek` address lowers to a **symbolic `location`**
 *   (`$D020`), not a decimal immediate, keeping addresses symbolic until the
 *   ACME emitter (AR-52) and matching the printer with no change.
 */

import { byteSize, createIntrinsicRegistry, DiagCode, IceCode, primitive, walkChildren, walkNode } from "@blend65/core";
import type {
  AstNode,
  AstVisitor,
  BinaryExprNode,
  BinaryOp,
  BlockNode,
  DiagnosticBag,
  ExprNode,
  FunctionDeclNode,
  FunctionFrame,
  IdentExprNode,
  InterruptDeclNode,
  IntrinsicCallExprNode,
  IntrinsicDescriptor,
  IntrinsicRegistry,
  LetDeclNode,
  AssignExprNode,
  NumericLitExprNode,
  PrimitiveName,
  ProgramNode,
  ReturnStmtNode,
  SemanticModel,
  AllocationPlan,
  StmtNode,
  Type,
  TypeNode,
} from "@blend65/core";

import { IL_BYTE, IL_WORD, ilTypeOfType } from "./il-type.js";
import type { ILType } from "./il-type.js";
import { imm, isTemp, loc } from "./operand.js";
import type { ILOperand } from "./operand.js";
import type { ILInstruction } from "./instruction.js";
import type { ILFunction, ILProgram } from "./cfg.js";
import { IlFunctionBuilder } from "./builder.js";

/**
 * The lowering entry point's input (§4.12, D4): the AST roots plus the RD-04
 * model and RD-05 plan that resolve types and addresses.
 */
export interface LowerInput {
  /** RD-03 AST roots. */
  readonly program: readonly ProgramNode[];
  /** RD-04 semantic model (typed AST, symbols, const values, struct/enum tables). */
  readonly model: SemanticModel;
  /** RD-05 allocation plan (frame/zp/symbol addresses). */
  readonly plan: AllocationPlan;
  /**
   * The intrinsic registry (RD-17). When absent, a core-only registry is built
   * internally so existing RD-06 callers/tests keep working (non-breaking).
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

/** IL opcodes whose result is always an `IL_BYTE` 0/1 (R20). */
const COMPARISON_RESULT_OPS = new Set(["eq", "ne", "lt", "le", "gt", "ge"]);

/** Per-function lowering context threaded through the statement/expression walk. */
interface LowerCtx {
  readonly builder: IlFunctionBuilder;
  readonly fqName: string;
  readonly frame: FunctionFrame | undefined;
  readonly bag: DiagnosticBag;
  /** RD-17: the semantic model (struct/enum tables for sizeof/offsetof folds). */
  readonly model: SemanticModel;
  /** RD-17: the intrinsic registry (descriptor lookup for strategy dispatch). */
  readonly registry: IntrinsicRegistry;
}

/**
 * Lower the validated AST + model + plan to IL (D4). Never throws (R69): user
 * errors are caught upstream; this emits only `E90001` ICEs for AST shapes it
 * does not yet handle. Functions carrying an `ErrorType`/error node are skipped
 * (R68).
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
          continue; // R68 — skip functions tainted by an ErrorType/error node
        }
        functions.push(lowerFunction(item, moduleName, input.plan, input.model, registry, bag));
      }
    }
  }
  return Object.freeze({
    functions: Object.freeze(functions),
    initCode: Object.freeze([]),
    constData: Object.freeze([]),
    allocationPlan: input.plan,
  });
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
  const ctx: LowerCtx = { builder, fqName, frame, bag, model, registry };

  lowerBlock(fn.body, ctx);

  // Fall-through end of a function closes the entry block with `ret()` (R42).
  return builder.finish({ kind: "ret" });
}

/** Lower a block's statements in order into the current block. */
function lowerBlock(blockNode: BlockNode, ctx: LowerCtx): void {
  for (const stmt of blockNode.statements) {
    lowerStmt(stmt, ctx);
  }
}

/** Lower a single statement (gate/slice-2 surface); ICE default for the rest. */
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
    default:
      iceUnsupported(stmt, ctx, "statement");
  }
}

/** `let v = init;` → materialise init into a value, then store it to v's slot (R29/R30). */
function lowerLetDecl(decl: LetDeclNode, ctx: LowerCtx): void {
  if (decl.initialiser === null) {
    return; // R30 — no IL for an initialiser-less declaration
  }
  const value = materialise(lowerExpr(decl.initialiser, ctx), ctx);
  const target = loc(frameSymbol(ctx.fqName, decl.name), slotIlType(ctx.frame, decl.name));
  ctx.builder.emit({ op: "store", a: value, b: target });
}

/** `return [expr];` → terminate the block with `ret(value?)` (R42). */
function lowerReturn(stmt: ReturnStmtNode, ctx: LowerCtx): void {
  if (stmt.value === null) {
    ctx.builder.terminate({ kind: "ret" });
    return;
  }
  const value = lowerExpr(stmt.value, ctx);
  ctx.builder.terminate({ kind: "ret", value });
}

/** Lower a single expression to an operand (gate/slice-2 surface); ICE default. */
function lowerExpr(expr: ExprNode, ctx: LowerCtx): ILOperand {
  switch (expr.kind) {
    case "NumericLitExpr":
      return lowerNumericLit(expr);
    case "BoolLitExpr":
      return imm(expr.value ? 1 : 0, IL_BYTE);
    case "IdentExpr":
      return lowerIdent(expr, ctx);
    case "BinaryExpr":
      return lowerBinary(expr, ctx);
    case "AssignExpr":
      return lowerAssign(expr, ctx);
    case "IntrinsicCallExpr":
      return lowerIntrinsic(expr, ctx);
    default:
      return iceUnsupported(expr, ctx, "expression");
  }
}

/** A numeric literal folds directly to an immediate operand (R28/R45). */
function lowerNumericLit(expr: NumericLitExprNode): ILOperand {
  // No live typed model yet (D5): the slice is byte-typed, so IL_BYTE is the
  // documented default; the wider type matrix arrives with RD-04b (D1).
  return imm(expr.value, IL_BYTE);
}

/** A variable read loads its frame slot into a fresh temp (R22). */
function lowerIdent(expr: IdentExprNode, ctx: LowerCtx): ILOperand {
  const type = slotIlType(ctx.frame, expr.name);
  const dest = ctx.builder.newTemp(type);
  ctx.builder.emit({ op: "load", a: dest, b: loc(frameSymbol(ctx.fqName, expr.name), type) });
  return dest;
}

/** A same-width binary expression: evaluate left, then right, then the op (R18/R19/R33). */
function lowerBinary(expr: BinaryExprNode, ctx: LowerCtx): ILOperand {
  const op = BINARY_OP_TO_IL[expr.op];
  if (op === undefined) {
    return iceUnsupported(expr, ctx, `binary operator '${expr.op}'`);
  }
  const left = lowerExpr(expr.left, ctx); // left-first (FN-10)
  const right = lowerExpr(expr.right, ctx);
  const type: ILType = COMPARISON_RESULT_OPS.has(op) ? IL_BYTE : operandType(left);
  const dest = ctx.builder.newTemp(type);
  // The opcode is one of the binary arithmetic/bitwise/comparison families, all
  // of which share the `{dest,left,right,type}` shape.
  ctx.builder.emit({ op, dest, left, right, type } as ILInstruction);
  return dest;
}

/** `target = rhs` → materialise rhs and store it to the target's slot (R31). */
function lowerAssign(expr: AssignExprNode, ctx: LowerCtx): ILOperand {
  if (expr.op !== "=" || expr.target.kind !== "IdentExpr") {
    return iceUnsupported(expr, ctx, "assignment");
  }
  const value = materialise(lowerExpr(expr.value, ctx), ctx);
  const name = expr.target.name;
  ctx.builder.emit({
    op: "store",
    a: value,
    b: loc(frameSymbol(ctx.fqName, name), slotIlType(ctx.frame, name)),
  });
  return value;
}

/**
 * Lower an intrinsic call by dispatching on its descriptor's `loweringStrategy`
 * (R17, AR-49) — never on the intrinsic name (AC-17). `'fold'` evaluates to an
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
 * Fold a `'fold'`-strategy intrinsic to an immediate (AC-09; no runtime code).
 * Dispatch is by NODE SHAPE, not name: `offsetof` carries a `fieldArg`, `sizeof`
 * carries a `typeArg`, and `length` carries a value argument. The analyzer (V7)
 * has already resolved the type/field, so failures here are defensive zeros.
 */
function foldIntrinsic(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  if (expr.fieldArg !== null && expr.typeArg !== null) {
    return imm(offsetOfField(expr.typeArg, expr.fieldArg.name, ctx), IL_BYTE);
  }
  if (expr.typeArg !== null) {
    return imm(sizeOfType(expr.typeArg, ctx), IL_BYTE);
  }
  // length(array): ≤255 → `byte`, else `word` (AR-P15 — deliberate spec deviation).
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

/** Dispatch a `'inline'`-strategy intrinsic through the keyed emitter map (AC-17). */
function inlineIntrinsic(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  const emitter = INLINE_EMITTERS.get(expr.name);
  if (emitter === undefined) {
    return iceUnsupported(expr, ctx, `inline intrinsic '${expr.name}'`);
  }
  return emitter(expr, ctx);
}

/** `peek(addr)` → one byte `load` from the constant address (AC-08). */
function emitPeek(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  const base = constAddress(expr.args[0], "peek", ctx);
  if (base === null) return imm(0, IL_BYTE);
  const dest = ctx.builder.newTemp(IL_BYTE);
  ctx.builder.emit({ op: "load", a: dest, b: loc(hexAddr(base), IL_WORD) });
  return dest;
}

/** `poke(addr, val)` → one byte `store` to the constant address (AC-08). */
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

/** The inline T2 emitter table — keyed once, not a per-name switch (AC-17). */
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
 * value; anything else emits **E10045** (R39, AR-P5) and returns `null` so the
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

/** Render a numeric address as the `$HEX` symbol kept symbolic through the IL (AR-52). */
function hexAddr(value: number): string {
  return `$${value.toString(16).toUpperCase()}`;
}

/** A deterministic error-expression placeholder for a missing (poisoned) argument. */
function errorExpr(): ExprNode {
  return { kind: "ErrorExpr", span: ZERO_SPAN };
}

/** The zero source span used for synthesized/placeholder nodes. */
const ZERO_SPAN = { sourceId: 0, start: 0, end: 0 } as const;

/** Wrap a non-temp value in a `const` temp so it can flow into a `store` (R28). */
function materialise(value: ILOperand, ctx: LowerCtx): ILOperand {
  if (isTemp(value)) {
    return value;
  }
  const dest = ctx.builder.newTemp(operandType(value));
  ctx.builder.emit({ op: "const", dest, src: value });
  return dest;
}

/** Emit the R69 ICE for an unsupported node and return a deterministic poison operand. */
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
 * `ErrorStmt`/`ErrorType`) — the R68 "carries an ErrorType" test. Uses the core
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
