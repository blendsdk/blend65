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

import { DiagCode, IceCode, RT_ROUTINES } from "@blend65/core";
import type { AllocationPlan, DiagnosticBag, IntrinsicDescriptor, SourceSpan } from "@blend65/core";

import type { ILType } from "../il/il-type.js";
import { isImmediate, isLocation, isTemp } from "../il/operand.js";
import type { ILOperand } from "../il/operand.js";
import type { ILInstruction, ILTerminator } from "../il/instruction.js";
import type { ILFunction } from "../il/cfg.js";

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
 * Optional per-target translation options (RD-17, PF-016).
 *
 * `zpArgBlockSize` enables the runtime-call ZP arg-block check (E10044, R35):
 * when absent (bare `generateInstr` callers) the check is skipped;
 * `assembleProgram` threads it from `plugin.profile`. `platformId` names the
 * platform in the E10044 message (AR-P11).
 */
export interface TranslateOptions {
  /** The target profile's ZP arg-block size in bytes (enables E10044). */
  readonly zpArgBlockSize?: number;
  /** The target platform id, for the E10044 message. */
  readonly platformId?: string;
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
 * @param opts Optional target options (RD-17): ZP arg-block size + platform id
 *   for the E10044 runtime-call check.
 * @returns The function's instruction stream (`segment: "code"`).
 */
export function translateFunction(
  fn: ILFunction,
  plan: AllocationPlan,
  _cpuVariant: CpuVariant,
  bag: DiagnosticBag,
  opts?: TranslateOptions,
): InstrStream {
  const tr = new FunctionTranslator(fn, plan, bag, opts);
  return tr.run();
}

/**
 * The operator-backing T3 routine catalog keyed by symbol (AR-98) — a single
 * keyed table (AC-17: no per-name special-casing), consulted by the `mul`/
 * `div`/`mod` call sites for the routine's descriptor (ABI + ZP requirement).
 */
const RT_BY_NAME: ReadonlyMap<string, IntrinsicDescriptor> = new Map(
  RT_ROUTINES.map((d) => [d.name, d]),
);

/**
 * The T1 opcode-intrinsic name → 6502 mnemonic map (RD-17 §4.3, AC-07). A single
 * keyed table built at module load — not a scattered per-name switch — so the
 * AC-17 "no intrinsic special-casing" audit passes. Each entry lowers to exactly
 * one Implied-mode instruction. `asm_wai`→`WAI` is 65C02-gated (availability is
 * enforced by the analyzer; legality by `validateStream`).
 */
const T1_OPCODES: ReadonlyMap<string, Opcode> = new Map<string, Opcode>([
  ["asm_sei", "SEI"],
  ["asm_cli", "CLI"],
  ["asm_pha", "PHA"],
  ["asm_pla", "PLA"],
  ["asm_php", "PHP"],
  ["asm_plp", "PLP"],
  ["asm_clc", "CLC"],
  ["asm_sec", "SEC"],
  ["asm_cld", "CLD"],
  ["asm_sed", "SED"],
  ["asm_clv", "CLV"],
  ["asm_nop", "NOP"],
  ["asm_brk", "BRK"],
  ["asm_wai", "WAI"],
]);


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
    private readonly opts?: TranslateOptions,
  ) {
    this.binder = createRegisterBinder(plan, bag);
  }

  /**
   * Drive the translation and return the finished stream. Iterates **every** CFG
   * block (RD-18 Slice 4a, 03-03 §1): the entry block keeps the function-entry
   * label; every non-entry block emits its own function-unique block label. The
   * use-count pre-scan covers all blocks up front, and per-block peephole/fold
   * state is reset at each block boundary (§1a — MANDATORY: a block label is a
   * branch target, so nothing may carry across it).
   */
  run(): InstrStream {
    this.binder.reset();
    this.out.push(label(sanitize(this.fn.name)));

    this.prescanAll();
    for (const block of this.fn.blocks) {
      this.resetBlockState();
      if (block.label !== "_entry") {
        this.out.push(label(this.blockLabel(block.label)));
      }
      block.instructions.forEach((ins, i) => {
        if (i === this.skipIndex) {
          return; // store folded into the preceding word ALU (D10)
        }
        this.translateInstruction(ins, i, block.instructions);
      });
      this.translateTerminator(block.terminator);
    }
    if (this.fn.blocks.length === 0) {
      this.translateTerminator({ kind: "ret" });
    }

    return { symbol: this.fn.name, segment: "code", entries: this.out };
  }

  // ── Pre-scan (D10) ─────────────────────────────────────────────────────────

  /**
   * Count every temp's reads across **all** blocks (03-03 §1a). `useCount` gates
   * the single-use load fold (`<=1`) and the store-home fold (`>1`); temp ids are
   * function-unique, so one global count is correct and covers non-entry blocks a
   * single-block prescan would under-count. Each block's terminator read operands
   * (`brcond.cond`, `ret.value`) count too, so a condition temp consumed by a
   * `brcond` is not under-counted.
   */
  private prescanAll(): void {
    for (const block of this.fn.blocks) {
      for (const ins of block.instructions) {
        for (const op of readOperands(ins)) {
          if (isTemp(op)) {
            this.useCount.set(op.id, (this.useCount.get(op.id) ?? 0) + 1);
          }
        }
      }
      const term = block.terminator;
      const termRead =
        term.kind === "ret" ? term.value : term.kind === "brcond" ? term.cond : undefined;
      if (termRead !== undefined && isTemp(termRead)) {
        this.useCount.set(termRead.id, (this.useCount.get(termRead.id) ?? 0) + 1);
      }
    }
  }

  /**
   * Reset the block-local peephole/fold state at a block boundary (03-03 §1a —
   * correctness, not optimization): `clearRegs()` (A/X residency), `skipIndex`
   * (an instruction index — block-relative, must not survive), `leadSpan`, and the
   * deferred-load map. Nothing may carry across a basic-block boundary because the
   * block label is a branch target.
   */
  private resetBlockState(): void {
    this.clearRegs();
    this.skipIndex = -1;
    this.leadSpan = undefined;
    this.loadSource.clear();
  }

  /**
   * The ASM-safe, function-unique label for a non-entry block: the sanitized
   * function name (`.`→`_`) prefixing the IL block label, e.g. `Main.main` + `_L0`
   * → `Main_main_L0`. Prefixing by the function name avoids cross-function
   * collisions (two functions both mint `_L0`). The entry function's blocks use
   * the `Module_function` form (not the `_main` entry label), so block labels never
   * collide with the startup shim's `_main` target.
   */
  private blockLabel(raw: string): string {
    return `${this.fn.name.replaceAll(".", "_")}${raw}`;
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
      case "intrinsic":
        this.translateIntrinsic(ins.name, ins.descriptor);
        return;
      default:
        this.iceUnsupported(ins.op);

    }
  }

  /**
   * Translate an IL `intrinsic` op. The T1 `'opcode'` strategy emits exactly one
   * Implied-mode instruction from the {@link T1_OPCODES} map (AC-07); the T3/T4
   * `'call'` strategy is handled by the marshalling path (03-04/03-05). Any other
   * strategy reaching translate is a lowering bug (folds/inline never emit an
   * `intrinsic` op) → ICE.
   *
   * @param name The intrinsic name (used only as the opcode-map key).
   * @param descriptor The descriptor carried on the IL op (dispatch on strategy).
   */
  private translateIntrinsic(name: string, descriptor: IntrinsicDescriptor): void {
    if (descriptor.loweringStrategy === "opcode") {
      const opcode = T1_OPCODES.get(name);
      if (opcode === undefined) {
        // Reserved-set/opcode-map drift is a compiler bug (should be unreachable).
        this.iceUnsupported(`intrinsic '${name}' (no T1 opcode)`);
        return;
      }
      this.emit(opcode, "Implied", none());
      // The opcode may touch A/X/status; drop the fold mirror conservatively.
      this.clearRegs();
      return;
    }
    if (descriptor.loweringStrategy === "call") {
      // T3/T4 runtime-routine call (03-04). The ZP arg-block requirement is
      // checked first (E10044 → poison, R35/AC-13). Per-signature argument
      // marshalling for user-visible T4 calls follows in 03-05; the internal
      // operator-backing routines marshal via `marshalAndCall` (mul/div/mod).
      if (!this.checkZpArgBlock(descriptor)) {
        return;
      }
      this.emit("JSR", "Absolute", labelRef(descriptor.name));
      this.clearRegs();
      return;
    }
    // 'fold'/'inline' never reach translate as an `intrinsic` op — the lowering
    // resolves them (03-03); reaching here is a lowering bug.
    this.iceUnsupported(`intrinsic '${name}' strategy '${descriptor.loweringStrategy}'`);
  }

  /**
   * Translate a block terminator (RD-18 Slice 4a, 03-03 §2):
   * - `ret` — bring the value into A/A:X (if any) then `RTS`/`RTI` (unchanged).
   * - `br` — an unconditional `JMP` to the target block label (3-byte absolute is
   *   always in range, unlike a relative branch).
   * - `brcond` — the condition operand is a **materialized boolean byte** (0/1),
   *   not live CPU flags (`translateComparison` materializes the 0/1 and consumes
   *   the compare's flags itself). Load it (a redundant `LDA` is suppressed only
   *   when the boolean is already resident in A within this block), branch to the
   *   true target with `BNE`, and `JMP` to the false target. Fusing the compare
   *   into the branch would need a non-materializing comparison lowering that does
   *   not exist yet (an RD-08 peephole) — out of scope, so this stays correct-first.
   * - `unreachable` — control provably cannot reach here; emit nothing.
   */
  private translateTerminator(term: ILTerminator): void {
    switch (term.kind) {
      case "ret":
        if (term.value !== undefined) {
          this.bringValueIntoRegisters(term.value, widthOf(term.value));
        }
        this.emit(this.fn.isInterrupt ? "RTI" : "RTS", "Implied", none());
        return;
      case "br":
        this.emit("JMP", "Absolute", labelRef(this.blockLabel(term.target)));
        return;
      case "brcond":
        this.leftIntoA(term.cond); // materialized 0/1 boolean → A (redundant LDA suppressed)
        this.emit("BNE", "Relative", labelRef(this.blockLabel(term.trueTarget)));
        this.emit("JMP", "Absolute", labelRef(this.blockLabel(term.falseTarget)));
        return;
      case "unreachable":
        return; // provably unreachable — no code, no ICE
    }
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
    // (3) Runtime multiply → JSR __rt_mul8/16 with full AR-33 marshalling.
    const routine = RT_BY_NAME.get(type.width === 16 ? "__rt_mul16" : "__rt_mul8");
    if (routine !== undefined && this.marshalAndCall(routine, left, right, dest, "value", type.width)) {
      this.bag.addWarning(
        DiagCode.RuntimeMultiply,
        null,
        `runtime multiply generates a subroutine call (~80-150 cycles for ${type.width}-bit)`,
      );
    }
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
    // runtime routine (AR-98: no __rt_mod* symbols exist). ABI split is AR-33/AR-P7.
    const routine = RT_BY_NAME.get(type.width === 16 ? "__rt_div16" : "__rt_div8");
    const result = op === "mod" ? "remainder" : "value";
    if (routine !== undefined && this.marshalAndCall(routine, left, right, dest, result, type.width)) {
      this.bag.addWarning(
        DiagCode.RuntimeDivide,
        null,
        `runtime ${op === "mod" ? "modulo" : "divide"} generates a subroutine call ` +
          `(~150-200 cycles for ${type.width}-bit)`,
      );
    }
    void index;
    void all;
  }

  /**
   * Verify the routine's ZP arg-block requirement against the target profile
   * (R35, AC-13). When the requirement exceeds `opts.zpArgBlockSize`, emits
   * E10044 (AR-P11 message) and returns `false` — the caller poisons the
   * statement (skips emission). When no size was threaded (bare
   * `generateInstr` callers, PF-016) the check is skipped.
   *
   * @param descriptor The routine descriptor (carries `costMetadata.zpBytes`).
   * @returns Whether emission may proceed.
   */
  private checkZpArgBlock(descriptor: IntrinsicDescriptor): boolean {
    const size = this.opts?.zpArgBlockSize;
    if (size === undefined) {
      return true;
    }
    const need = descriptor.costMetadata.zpBytes;
    if (need <= size) {
      return true;
    }
    this.bag.addError(
      DiagCode.ZpArgBlockExceeded,
      null,
      `runtime routine '${descriptor.name}' needs ${need} ZP argument bytes, ` +
        `but the '${this.opts?.platformId ?? "target"}' profile provides ${size}`,
    );
    return false;
  }

  /**
   * Emit a fully-marshalled operator-backing runtime call (RD-17 AR-33/AR-P7;
   * AC-10 — both operands are marshalled, replacing the RD-07b left-only stub).
   *
   * Byte ops: `left`→A, `right`→X. Word ops: `right`→`__zp_arg_0/1` (the SFA
   * allocator's existing arg-block symbols, PF-018) first — the loads clobber
   * A — then `left`→A(lo)/X(hi) via direct LDA/LDX so the registers hold the
   * first operand at the call. Results: the routine's return register(s) bind
   * to `dest` (`word` returns in A/X, `byte` in A); `result: "remainder"`
   * selects the modulo return instead — X→A for `__rt_div8`, `__zp_arg_0/1`
   * for `__rt_div16` (AR-98).
   *
   * @param descriptor The T3 routine descriptor (name, ABI, ZP requirement).
   * @param left The first operand (register-passed).
   * @param right The second operand (register or ZP arg-block).
   * @param dest The IL destination temp the result binds to.
   * @param result Which return value binds: the primary value or the remainder.
   * @param width The operation width (8 or 16).
   * @returns Whether the call was emitted (`false` → E10044 poison, R35).
   */
  private marshalAndCall(
    descriptor: IntrinsicDescriptor,
    left: ILOperand,
    right: ILOperand,
    dest: ILOperand,
    result: "value" | "remainder",
    width: 8 | 16,
  ): boolean {
    if (!this.checkZpArgBlock(descriptor)) {
      return false; // poisoned: statement dropped, compilation continues (AC-13)
    }
    if (width === 8) {
      this.leftIntoA(left);
      const r = this.rightSource(right, 0);
      this.emit("LDX", r.mode, r.operand);
      this.emit("JSR", "Absolute", labelRef(descriptor.name));
      this.clearRegs();
      if (result === "remainder") {
        this.emit("TXA", "Implied", none()); // remainder returns in X (AR-33)
        this.bindA(asTempId(dest));
      } else if (descriptor.signature.returnType === "word") {
        this.bindA(asTempId(dest)); // product lo→A, hi→X (AR-33)
        this.bindX(asTempId(dest));
      } else {
        this.bindA(asTempId(dest)); // quotient→A
      }
      return true;
    }
    // Word: second operand through the ZP arg-block FIRST (the loads clobber A).
    this.clearRegs();
    for (const i of [0, 1] as const) {
      const r = this.rightSource(right, i);
      this.emit("LDA", r.mode, r.operand);
      this.emit("STA", "Absolute", symbolRef(`__zp_arg_${i}`));
    }
    // First operand into A(lo)/X(hi) — direct loads, X is not otherwise needed.
    const hi = this.rightSource(left, 1);
    this.emit("LDX", hi.mode, hi.operand);
    const lo = this.rightSource(left, 0);
    this.emit("LDA", lo.mode, lo.operand);
    this.emit("JSR", "Absolute", labelRef(descriptor.name));
    this.clearRegs();
    if (result === "remainder") {
      // div16 leaves the remainder in the arg-block (overwriting b — AR-P7).
      this.emit("LDA", "Absolute", symbolRef("__zp_arg_0"));
      this.emit("LDX", "Absolute", symbolRef("__zp_arg_1"));
    }
    this.bindA(asTempId(dest)); // word result lo→A, hi→X
    this.bindX(asTempId(dest));
    return true;
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

