/**
 * RD-07b IL→Instr translator — lowers one single-block `ILFunction` (the RD-06
 * live shape) into one validated-ready `InstrStream`
 * (`plans/rd-07b-il-to-instr/03-01-il-to-instr-translation.md`, R17–R28/R32/R50/R51).
 *
 * The slice translates exactly the ops the live lowering emits (D3): `load`,
 * `store`, `const`, the arithmetic/bitwise/shift binary family, comparisons, and
 * `mul`/`div`/`mod` call-sites (the latter three added in Session 2.2), plus the
 * `ret` terminator — both byte and word widths (D5). Every other IL op reaches a
 * default arm that raises an `E90001` ICE (D7) and is deferred to RD-07c.
 *
 * **Value-flow (D10).** A one-accumulator 6502 cannot translate each op in
 * isolation and still produce the tight goldens (`r = a + b` →
 * `LDA a / CLC / ADC b / STA r`). The translator therefore pre-scans the block,
 * counts each temp's uses, and **folds** single-use load results directly into the
 * consuming ALU/store operand; byte ALU results stay in A until the consumer
 * stores them, and word ALU results are written inline to the consuming store's
 * target. Folds are conservative — when a fold cannot be proven safe the value is
 * materialised — so the output is never incorrect, only occasionally one
 * `LDA`/`STA` longer than optimal (RD-08 peephole closes the gap).
 *
 * The {@link "./register-binding.js".RegisterBinder} is the register-allocation
 * seam RD-07c's allocator will drive; in this slice the translator keeps a small
 * local A/X mirror for fold decisions and records results through the binder.
 * Consumes the `il/` model read-only (D6); lives in `@blend65/codegen`
 * (R15/AR-20).
 */

import { DiagCode, IceCode } from "@blend65/core";
import type { AllocationPlan, DiagnosticBag, SourceSpan } from "@blend65/core";

import type { ILType } from "../il/il-type.js";
import { isImmediate, isLocation, isTemp } from "../il/operand.js";
import type { ILOperand } from "../il/operand.js";
import type { ILInstruction, ILTerminator } from "../il/instruction.js";
import type { BasicBlock, ILFunction } from "../il/cfg.js";

import type { Opcode } from "./opcode.js";
import type { AddressingMode } from "./addressing-mode.js";
import { imm8, labelRef, none, symbolRef } from "./operand.js";
import type { InstrOperand } from "./operand.js";
import { instr, label } from "./stream.js";

import type { CpuVariant, InstrStream, StreamEntry } from "./stream.js";
import { createRegisterBinder } from "./register-binding.js";

/** A resolved memory source: the operand plus the addressing mode to read it. */
interface SourceRef {
  readonly operand: InstrOperand;
  readonly mode: AddressingMode;
}

/** A symbolic memory home (`name` + byte `offset`) a value lives at or stores to. */
interface MemHome {
  readonly name: string;
  readonly offset: number;
}

/**
 * Translate one {@link ILFunction} into one {@link InstrStream} (R17, FR-1).
 *
 * Emits the function's entry label, then each instruction of its single live
 * block, then the terminator. Deterministic: the same IL yields the same stream
 * (R17/AC-06).
 *
 * @param fn The lowered function (single-block live shape, RD-06).
 * @param plan The carried allocation plan (`ilProgram.allocationPlan`, D2).
 * @param _cpuVariant The target CPU variant. The live op set is wholly NMOS-legal,
 *   so the slice never needs the variant to choose an encoding; it is part of the
 *   signature (D2) for symmetry with `generateInstr` and for RD-07c, where 65C02
 *   addressing modes become selectable. `generateInstr` validates the emitted
 *   stream against the variant, so an illegal pair would still be caught.
 * @param bag Diagnostic sink: deferred-op ICEs (D7) + cost warnings (R60).
 * @returns The function's instruction stream (`segment: "code"`).
 */
export function translateFunction(
  fn: ILFunction,
  plan: AllocationPlan,
  _cpuVariant: CpuVariant,
  bag: DiagnosticBag,
): InstrStream {
  const tr = new FunctionTranslator(fn, plan, bag);
  return tr.run();
}


/** Per-function translation state (R17). One instance per `translateFunction`. */
class FunctionTranslator {
  private readonly out: StreamEntry[] = [];
  private readonly binder: ReturnType<typeof createRegisterBinder>;

  /** Use-count per temp id, from the pre-scan (D10). */
  private readonly useCount = new Map<number, number>();
  /** Single-use `load` results deferred for folding: temp id → source location. */
  private readonly loadSource = new Map<number, ILOperand>();

  /** Temp id currently resident in A (byte value or word low byte), or null. */
  private regA: number | null = null;
  /** Temp id whose word high byte is resident in X, or null. */
  private regX: number | null = null;
  /** Span to attach to the next emitted lead instruction (R50). */
  private leadSpan: SourceSpan | undefined = undefined;
  /** Instruction index whose `store` has been folded into a word ALU (skip it). */
  private skipIndex = -1;
  /** Per-function generated-label counter (`_cmpN`). Reserved for comparisons. */
  private cmpCounter = 0;

  constructor(
    private readonly fn: ILFunction,
    plan: AllocationPlan,
    private readonly bag: DiagnosticBag,
  ) {
    this.binder = createRegisterBinder(plan, bag);
  }

  /** Drive the translation and return the finished stream. */
  run(): InstrStream {
    this.binder.reset();
    this.out.push(label(sanitize(this.fn.name)));

    const block: BasicBlock | undefined = this.fn.blocks[0];
    if (block !== undefined) {
      this.prescan(block);
      block.instructions.forEach((ins, i) => {
        if (i === this.skipIndex) {
          return; // store folded into the preceding word ALU (D10)
        }
        this.translateInstruction(ins, i, block.instructions);
      });
      this.translateTerminator(block.terminator);
    } else {
      this.translateTerminator({ kind: "ret" });
    }

    return { symbol: this.fn.name, segment: "code", entries: this.out };
  }

  // ── Pre-scan (D10) ─────────────────────────────────────────────────────────

  /** Count temp reads and record single-use load results eligible to fold. */
  private prescan(block: BasicBlock): void {
    for (const ins of block.instructions) {
      for (const op of readOperands(ins)) {
        if (isTemp(op)) {
          this.useCount.set(op.id, (this.useCount.get(op.id) ?? 0) + 1);
        }
      }
    }
    const termValue = block.terminator.kind === "ret" ? block.terminator.value : undefined;
    if (termValue !== undefined && isTemp(termValue)) {
      this.useCount.set(termValue.id, (this.useCount.get(termValue.id) ?? 0) + 1);
    }
  }

  // ── Instruction dispatch ─────────────────────────────────────────────────────

  private translateInstruction(
    ins: ILInstruction,
    index: number,
    all: readonly ILInstruction[],
  ): void {
    switch (ins.op) {
      case "source_span":
        this.leadSpan = ins.span; // provenance: attach to the next lead instr (R50)
        return;
      case "const":
        this.translateConst(ins.dest, ins.src);
        return;
      case "load":
        this.translateLoad(ins.a, ins.b);
        return;
      case "store":
        this.translateStore(ins.a, ins.b);
        return;
      case "add":
      case "sub":
        this.translateAddSub(ins.op, ins.dest, ins.left, ins.right, ins.type, index, all);
        return;
      case "and":
      case "or":
      case "xor":
        this.translateLogic(ins.op, ins.dest, ins.left, ins.right, ins.type, index, all);
        return;
      case "shl":
      case "shr":
        this.translateShift(ins.op, ins.dest, ins.left, ins.right, ins.type);
        return;
      case "eq":
      case "ne":
      case "lt":
      case "le":
      case "gt":
      case "ge":
        this.translateComparison(ins.op, ins.dest, ins.left, ins.right, index, all);
        return;
      case "mul":
        this.translateMul(ins.dest, ins.left, ins.right, ins.type, index, all);
        return;
      case "div":
      case "mod":
        this.translateDivMod(ins.op, ins.dest, ins.left, ins.right, ins.type, index, all);
        return;
      default:
        this.iceUnsupported(ins.op);

    }
  }

  private translateTerminator(term: ILTerminator): void {
    if (term.kind !== "ret") {
      this.iceUnsupported(`terminator '${term.kind}'`);
      this.emit("RTS", "Implied", none());
      return;
    }
    if (term.value !== undefined) {
      this.bringValueIntoRegisters(term.value, widthOf(term.value));
    }
    this.emit(this.fn.isInterrupt ? "RTI" : "RTS", "Implied", none());
  }

  // ── const / load / store ─────────────────────────────────────────────────────

  private translateConst(dest: ILOperand, src: ILOperand): void {
    if (!isTemp(dest) || !isImmediate(src)) {
      this.iceUnsupported("const (non-temp dest or non-immediate src)");
      return;
    }
    const width = dest.type.width;
    this.emit("LDA", "Immediate", imm8(src.value & 0xff));
    this.bindA(dest.id);
    if (width === 16) {
      this.emit("LDX", "Immediate", imm8((src.value >> 8) & 0xff));
      this.bindX(dest.id);
    }
  }

  private translateLoad(dest: ILOperand, source: ILOperand): void {
    if (!isTemp(dest) || !isLocation(source)) {
      this.iceUnsupported("load (non-temp dest or non-location source)");
      return;
    }
    // Single-use load results are deferred and folded at the consumer (D10).
    if ((this.useCount.get(dest.id) ?? 0) <= 1) {
      this.loadSource.set(dest.id, source);
      return;
    }
    // Multi-use: materialise eagerly so subsequent uses read a stable A/X home.
    const width = dest.type.width;
    this.emit("LDA", "Absolute", symHome(source, 0));
    this.bindA(dest.id);
    if (width === 16) {
      this.emit("LDX", "Absolute", symHome(source, 1));
      this.bindX(dest.id);
    }
  }

  private translateStore(value: ILOperand, target: ILOperand): void {
    if (!isLocation(target)) {
      this.iceUnsupported("store (non-location target)");
      return;
    }
    const width = widthOf(value);
    this.bringValueIntoRegisters(value, width);
    this.emit("STA", "Absolute", symHome(target, 0));
    if (width === 16) {
      this.emit("STX", "Absolute", symHome(target, 1));
    }
  }

  // ── arithmetic / bitwise ─────────────────────────────────────────────────────

  private translateAddSub(
    op: "add" | "sub",
    dest: ILOperand,
    left: ILOperand,
    right: ILOperand,
    type: ILType,
    index: number,
    all: readonly ILInstruction[],
  ): void {
    const setCarry: Opcode = op === "add" ? "CLC" : "SEC";
    const aluOp: Opcode = op === "add" ? "ADC" : "SBC";
    if (type.width === 8) {
      this.leftIntoA(left);
      this.emit(setCarry, "Implied", none());
      const r = this.rightSource(right, 0);
      this.emit(aluOp, r.mode, r.operand);
      this.bindA(asTempId(dest));
      return;
    }
    // 16-bit: write each byte inline to the consuming store's target (D10).
    const home = this.foldStoreHome(dest, index, all);
    if (home === null) {
      this.iceUnsupported("word arithmetic result not consumed by a store (RD-07c)");
      return;
    }
    this.wordLeftByteIntoA(left, 0);
    this.emit(setCarry, "Implied", none());
    const rLo = this.rightSource(right, 0);
    this.emit(aluOp, rLo.mode, rLo.operand);
    this.emit("STA", "Absolute", symAt(home, 0));
    this.wordLeftByteIntoA(left, 1);
    const rHi = this.rightSource(right, 1);
    this.emit(aluOp, rHi.mode, rHi.operand);
    this.emit("STA", "Absolute", symAt(home, 1));
    this.clearRegs();
  }

  private translateLogic(
    op: "and" | "or" | "xor",
    dest: ILOperand,
    left: ILOperand,
    right: ILOperand,
    type: ILType,
    index: number,
    all: readonly ILInstruction[],
  ): void {
    const aluOp: Opcode = op === "and" ? "AND" : op === "or" ? "ORA" : "EOR";
    if (type.width === 8) {
      this.leftIntoA(left);
      const r = this.rightSource(right, 0);
      this.emit(aluOp, r.mode, r.operand);
      this.bindA(asTempId(dest));
      return;
    }
    const home = this.foldStoreHome(dest, index, all);
    if (home === null) {
      this.iceUnsupported("word bitwise result not consumed by a store (RD-07c)");
      return;
    }
    this.wordLeftByteIntoA(left, 0);
    const rLo = this.rightSource(right, 0);
    this.emit(aluOp, rLo.mode, rLo.operand);
    this.emit("STA", "Absolute", symAt(home, 0));
    this.wordLeftByteIntoA(left, 1);
    const rHi = this.rightSource(right, 1);
    this.emit(aluOp, rHi.mode, rHi.operand);
    this.emit("STA", "Absolute", symAt(home, 1));
    this.clearRegs();
  }

  private translateShift(
    op: "shl" | "shr",
    dest: ILOperand,
    left: ILOperand,
    right: ILOperand,
    type: ILType,
  ): void {
    if (type.width !== 8 || !isImmediate(right)) {
      // Word shifts and variable-count shifts are deferred to RD-07c (D3).
      this.iceUnsupported(`${op} (word or non-constant count)`);
      return;
    }
    const shiftOp: Opcode = op === "shl" ? "ASL" : "LSR";
    this.leftIntoA(left);
    for (let i = 0; i < (right.value & 0xff); i++) {
      this.emit(shiftOp, "Accumulator", none());
    }
    this.bindA(asTempId(dest));
  }

  // ── Operand / register helpers ───────────────────────────────────────────────

  /** Bring a byte operand (ALU left, value) into A, suppressing a redundant load. */
  private leftIntoA(op: ILOperand): void {
    if (isTemp(op)) {
      if (this.regA === op.id) {
        return; // already in A (R44 redundant-load suppression)
      }
      const home = this.sourceHome(op);
      if (home !== null) {
        this.emit("LDA", "Absolute", symAt(home, 0));
        this.bindA(op.id);
        return;
      }
      // Spilled temp (RD-07c pressure path): read from its ZP home (D9).
      this.emit("LDA", "ZeroPage", this.binder.operandFor(op));
      this.bindA(op.id);
      return;
    }
    if (isImmediate(op)) {
      this.emit("LDA", "Immediate", imm8(op.value & 0xff));
      this.clearRegs();
      return;
    }
    if (isLocation(op)) {
      this.emit("LDA", "Absolute", symHome(op, 0));
      this.clearRegs();
      return;
    }
  }

  /** Bring one byte (lo=0/hi=1) of a word ALU left operand into A. */
  private wordLeftByteIntoA(op: ILOperand, byteIndex: number): void {
    const home = this.sourceHome(op);
    if (home !== null) {
      this.emit("LDA", "Absolute", symAt(home, byteIndex));
      return;
    }
    if (isImmediate(op)) {
      const v = byteIndex === 0 ? op.value & 0xff : (op.value >> 8) & 0xff;
      this.emit("LDA", "Immediate", imm8(v));
      return;
    }
    if (byteIndex === 0 && isTemp(op) && this.regA === op.id) {
      return; // word low byte already in A
    }
    if (byteIndex === 1 && isTemp(op) && this.regX === op.id) {
      this.emit("TXA", "Implied", none()); // bring the high byte from X into A
      return;
    }
    // Fallback: spilled word temp (RD-07c) — read its ZP home byte.
    if (isTemp(op)) {
      this.emit("LDA", "ZeroPage", this.binder.operandFor(op));
    }
  }

  /** Bring a value into A (byte) or A:X (word) for a `store`/`ret` consumer. */
  private bringValueIntoRegisters(value: ILOperand, width: 8 | 16): void {
    if (width === 8) {
      this.leftIntoA(value);
      return;
    }
    if (isTemp(value) && this.regA === value.id && this.regX === value.id) {
      return; // word already in A:X (e.g. a const-word result)
    }
    const home = this.sourceHome(value);
    if (home !== null) {
      this.emit("LDA", "Absolute", symAt(home, 0));
      this.emit("LDX", "Absolute", symAt(home, 1));
      this.bindA(isTemp(value) ? value.id : null);
      this.bindX(isTemp(value) ? value.id : null);
      return;
    }
    if (isImmediate(value)) {
      this.emit("LDA", "Immediate", imm8(value.value & 0xff));
      this.emit("LDX", "Immediate", imm8((value.value >> 8) & 0xff));
      this.clearRegs();
    }
  }

  /** A right ALU operand's read reference for the given byte index (lo=0/hi=1). */
  private rightSource(op: ILOperand, byteIndex: number): SourceRef {
    if (isImmediate(op)) {
      const v = byteIndex === 0 ? op.value & 0xff : (op.value >> 8) & 0xff;
      return { operand: imm8(v), mode: "Immediate" };
    }
    const home = this.sourceHome(op);
    if (home !== null) {
      return { operand: symAt(home, byteIndex), mode: "Absolute" };
    }
    if (isTemp(op)) {
      return { operand: this.binder.operandFor(op), mode: "ZeroPage" };
    }
    return { operand: none(), mode: "Implied" };
  }

  /**
   * The memory home a temp/location operand reads from: a deferred load's source
   * symbol, or a direct location operand. `null` when the operand is
   * register/immediate-resident (no memory home).
   */
  private sourceHome(op: ILOperand): MemHome | null {
    if (isLocation(op)) {
      return { name: op.symbol, offset: op.offset ?? 0 };
    }
    if (isTemp(op)) {
      const src = this.loadSource.get(op.id);
      if (src !== undefined && isLocation(src)) {
        return { name: src.symbol, offset: src.offset ?? 0 };
      }
    }
    return null;
  }

  /**
   * When `dest` is single-use and immediately consumed by `store dest,[target]`,
   * return that target as the word ALU's destination home and mark the store to
   * be skipped (D10). Otherwise `null`.
   */
  private foldStoreHome(
    dest: ILOperand,
    index: number,
    all: readonly ILInstruction[],
  ): MemHome | null {
    if (!isTemp(dest) || (this.useCount.get(dest.id) ?? 0) > 1) {
      return null;
    }
    const next = all[index + 1];
    if (
      next !== undefined &&
      next.op === "store" &&
      isTemp(next.a) &&
      next.a.id === dest.id &&
      isLocation(next.b)
    ) {
      this.skipIndex = index + 1;
      return { name: next.b.symbol, offset: next.b.offset ?? 0 };
    }
    return null;
  }

  // ── comparison (R23, unsigned) ───────────────────────────────────────────────

  private translateComparison(
    op: "eq" | "ne" | "lt" | "le" | "gt" | "ge",
    dest: ILOperand,
    left: ILOperand,
    right: ILOperand,
    index: number,
    all: readonly ILInstruction[],
  ): void {
    // Unsigned framing: gt/le compare with operands swapped (a>b ≡ b<a;
    // a<=b ≡ b>=a). Branch taken ⇒ result is 1 (R23).
    const swap = op === "gt" || op === "le";
    const lhs = swap ? right : left;
    const rhs = swap ? left : right;
    const branch: Opcode =
      op === "eq" ? "BEQ" : op === "ne" ? "BNE" : op === "lt" || op === "gt" ? "BCC" : "BCS";

    this.leftIntoA(lhs);
    const r = this.rightSource(rhs, 0);
    this.emit("CMP", r.mode, r.operand);
    const done = `_cmp${this.cmpCounter++}`;
    this.emit("LDA", "Immediate", imm8(0x01));
    this.emit(branch, "Relative", labelRef(done));
    this.emit("LDA", "Immediate", imm8(0x00));
    this.out.push(label(done));
    this.bindA(asTempId(dest));
    // The 0/1 result is a single-use value the following store consumes; the
    // store fold (foldStoreHome) only applies to word ALUs, so emit the byte
    // store path normally via the next `store` instruction (result in A).
    void index;
    void all;
  }

  // ── mul / div / mod (R21/R22, call-site; D4) ─────────────────────────────────

  private translateMul(
    dest: ILOperand,
    left: ILOperand,
    right: ILOperand,
    type: ILType,
    index: number,
    all: readonly ILInstruction[],
  ): void {
    // (1) Both operands constant → fold at compile time, emit as a const.
    if (isImmediate(left) && isImmediate(right)) {
      const product = (left.value * right.value) & (type.width === 16 ? 0xffff : 0xff);
      this.translateConst(dest, { kind: "immediate", value: product, type });
      return;
    }
    // (2) One operand a constant power-of-two → shift sequence (byte only here).
    const constSide = isImmediate(right) ? right : isImmediate(left) ? left : null;
    const varSide = isImmediate(right) ? left : right;
    if (constSide !== null && type.width === 8) {
      const k = log2Exact(constSide.value & 0xff);
      if (k !== null) {
        this.leftIntoA(varSide);
        for (let i = 0; i < k; i++) {
          this.emit("ASL", "Accumulator", none());
        }
        this.bindA(asTempId(dest));
        this.bag.addWarning(
          DiagCode.ShiftAndAddMultiply,
          null,
          `multiply by ${constSide.value & 0xff} generates a shift-and-add sequence`,
        );
        return;
      }
    }
    // (3) Runtime multiply → JSR __rt_mul8/16 (marshalling ABI is RD-17 AR-33).
    this.emitRuntimeCall(type.width === 16 ? "__rt_mul16" : "__rt_mul8", left, right, dest);
    this.bag.addWarning(
      DiagCode.RuntimeMultiply,
      null,
      `runtime multiply generates a subroutine call (~80-150 cycles for ${type.width}-bit)`,
    );
    void index;
    void all;
  }

  private translateDivMod(
    op: "div" | "mod",
    dest: ILOperand,
    left: ILOperand,
    right: ILOperand,
    type: ILType,
    index: number,
    all: readonly ILInstruction[],
  ): void {
    // div takes the quotient return, mod the remainder return; both call the same
    // runtime routine (R22). The exact return-register split is RD-17 AR-33.
    this.emitRuntimeCall(type.width === 16 ? "__rt_div16" : "__rt_div8", left, right, dest);
    this.bag.addWarning(
      DiagCode.RuntimeDivide,
      null,
      `runtime ${op === "mod" ? "modulo" : "divide"} generates a subroutine call ` +
        `(~150-200 cycles for ${type.width}-bit)`,
    );
    void index;
    void all;
  }

  /**
   * Emit the minimal runtime-routine call site (D4): bring the operands into A
   * (and the binder's view), then `JSR` the symbolic routine name. The detailed
   * argument-marshalling ABI (which bytes go in A/X/Y vs a ZP arg-block) is RD-17
   * AR-33; this slice emits the call and binds the result to A so a following
   * `store`/`ret` consumes it.
   */
  private emitRuntimeCall(
    routine: string,
    left: ILOperand,
    right: ILOperand,
    dest: ILOperand,
  ): void {
    // Marshal the left operand into A (the documented minimal entry); the right
    // operand's placement is the routine's ABI concern (RD-17).
    this.leftIntoA(left);
    void right;
    this.emit("JSR", "Absolute", labelRef(routine));
    this.bindA(asTempId(dest));
  }

  // ── Register-state mirror (the binder is the RD-07c allocation seam) ──────────


  private bindA(id: number | null): void {
    this.regA = id;
    this.regX = null;
    if (id !== null) {
      this.binder.bindResultToA({ kind: "temp", id, type: { width: 8, signed: false } });
    }
  }

  private bindX(id: number | null): void {
    this.regX = id;
    if (id !== null) {
      this.binder.bindResultToX({ kind: "temp", id, type: { width: 16, signed: false } });
    }
  }

  private clearRegs(): void {
    this.regA = null;
    this.regX = null;
  }

  // ── Emission ─────────────────────────────────────────────────────────────────

  /** Emit one instruction, attaching the pending lead span to the first only (R50). */
  private emit(opcode: Opcode, mode: AddressingMode, operand: InstrOperand): void {
    if (this.leadSpan !== undefined) {
      this.out.push(instr(opcode, mode, operand, this.leadSpan));
      this.leadSpan = undefined;
      return;
    }
    this.out.push(instr(opcode, mode, operand));
  }

  /** Raise the deferred/unsupported-op ICE (D7) and emit nothing for it. */
  private iceUnsupported(what: string): void {
    this.bag.addICE(
      IceCode.Unexpected,
      null,
      `IL→Instr: unsupported op '${what}' (deferred to RD-07c)`,
    );
  }
}

// ── Module-level helpers ───────────────────────────────────────────────────────

/** The IL width of an operand (8 or 16). */
function widthOf(op: ILOperand): 8 | 16 {
  return op.type.width;
}

/** Narrow a destination operand to its temp id, or `-1` for a non-temp (ICE-safe). */
function asTempId(op: ILOperand): number {
  return isTemp(op) ? op.id : -1;
}

/** A `symbolRef` for a location operand at the given byte offset (lo=0/hi=1). */
function symHome(locOp: ILOperand, byteIndex: number): InstrOperand {
  if (!isLocation(locOp)) {
    return none();
  }
  const off = (locOp.offset ?? 0) + byteIndex;
  return off === 0 ? symbolRef(locOp.symbol) : symbolRef(locOp.symbol, { offset: off });
}

/** A `symbolRef` for a resolved {@link MemHome} at the given byte offset. */
function symAt(home: MemHome, byteIndex: number): InstrOperand {
  const off = home.offset + byteIndex;
  return off === 0 ? symbolRef(home.name) : symbolRef(home.name, { offset: off });
}

/** The read operands of an instruction (for the use-count pre-scan, D10). */
function readOperands(ins: ILInstruction): readonly ILOperand[] {
  switch (ins.op) {
    case "add":
    case "sub":
    case "mul":
    case "div":
    case "mod":
    case "and":
    case "or":
    case "xor":
    case "shl":
    case "shr":
    case "eq":
    case "ne":
    case "lt":
    case "le":
    case "gt":
    case "ge":
      return [ins.left, ins.right];
    case "neg":
    case "not":
    case "zext":
    case "sext":
    case "trunc":
    case "copy":
    case "const":
      return [ins.src];
    case "store":
      return [ins.a];
    case "load":
      return [];
    case "load_indexed":
    case "store_indexed":
      return [ins.base, ins.index, ins.value];
    case "load_indirect":
    case "store_indirect":
      return [ins.ptr, ins.offset, ins.value];
    case "call":
    case "intrinsic":
      return ins.args;
    case "source_span":
      return [];
  }
}

/** The unqualified entry-point function name (spec Ch 10 — exactly one `main`). */
const ENTRY_FUNCTION = "main";

/** The special ACME label for the program entry point (RD-09 R15/R19, RD-10 §4.6). */
const ENTRY_LABEL = "_main";

/**
 * The ACME-legal label for a function stream (R47/R15, RD-07c D4):
 *   - the unique entry function (fqName whose bare name is `main`) → `_main`,
 *     resolving the c64 startup shim's `JSR _main`;
 *   - every other `Module.function` → `Module_function` (`.`→`_`).
 *
 * Only `[A-Za-z0-9_]` survive the `.`→`_` rewrite, so the result is always a legal
 * ACME label; the `__` prefix stays reserved for compiler-generated symbols (frame
 * homes, startup) and is never produced here.
 *
 * @param fqName The fully-qualified function name (`"Module.function"`).
 * @returns The sanitized ACME label.
 */
function sanitize(fqName: string): string {
  if (isEntryFunction(fqName)) {
    return ENTRY_LABEL;
  }
  return fqName.replaceAll(".", "_");
}

/**
 * True when `fqName` names the program entry point — its bare (unqualified) name
 * is `main` (RD-07c D4). Multiple/zero `main` functions are a semantic error caught
 * upstream in RD-04 (E10020/E10021); this maps purely by bare name.
 *
 * @param fqName The fully-qualified function name (`"Module.function"`).
 * @returns `true` when the bare name is `main`.
 */
function isEntryFunction(fqName: string): boolean {
  const dot = fqName.lastIndexOf(".");
  const bare = dot >= 0 ? fqName.slice(dot + 1) : fqName;
  return bare === ENTRY_FUNCTION;
}


/**
 * The exact base-2 logarithm of `n` when `n` is a power of two (≥ 1), else
 * `null`. Used to pick the shift count for a power-of-two multiply (R21 tier 2).
 *
 * @param n The candidate constant multiplier.
 * @returns `k` such that `n === 2**k`, or `null` when `n` is not a power of two.
 */
function log2Exact(n: number): number | null {
  if (n < 1 || (n & (n - 1)) !== 0) {
    return null;
  }
  let k = 0;
  let v = n;
  while (v > 1) {
    v >>= 1;
    k++;
  }
  return k;
}

