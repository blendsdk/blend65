/**
 * The IL→Instr translator — lowers one single-block `ILFunction` (the live
 * lowering shape) into one validated-ready `InstrStream`.
 *
 * Translates the ops the live lowering emits: `load`, `store`, `const`,
 * `copy`, the arithmetic/bitwise binary family, shifts (byte + word, constant
 * and variable counts, sign-preserving arithmetic right shifts), comparisons
 * in all four byte/word × unsigned/signed framings, unary `neg`/`not`, the
 * width conversions (`zext`/`sext`/`trunc`), `mul`/`div`/`mod` call-sites,
 * user `call`s, and intrinsics, plus every terminator. The indexed/indirect
 * memory ops reach a default arm that raises an `E90001` ICE and remain
 * deferred to a later slice.
 *
 * **Value-flow.** A one-accumulator 6502 cannot translate each op in
 * isolation and still produce the tight goldens (`r = a + b` →
 * `LDA a / CLC / ADC b / STA r`). The translator therefore pre-scans the block,
 * counts each temp's uses, and **folds** single-use load results directly into the
 * consuming ALU/store operand; byte ALU results stay in A until the consumer
 * stores them, and word ALU results are written inline to the consuming store's
 * target. Folds are conservative — when a fold cannot be proven safe the value is
 * materialised — so the output is never incorrect, only occasionally one
 * `LDA`/`STA` longer than optimal (the peephole optimizer closes the gap).
 *
 * The {@link "./register-binding.js".RegisterBinder} is the register-allocation
 * seam a later allocator will drive; in this slice the translator keeps a small
 * local A/X mirror for fold decisions and records results through the binder.
 * Consumes the `il/` model read-only; lives in `@blend65/codegen`.
 */

import { DiagCode, IceCode, RT_ROUTINES } from "@blend65/core";
import type { AllocationPlan, DiagnosticBag, IntrinsicDescriptor, SourceSpan } from "@blend65/core";

import type { ILType } from "../il/il-type.js";
import { isAddr, isAddrByte, isImmediate, isLocation, isTemp } from "../il/operand.js";
import type { ILOperand } from "../il/operand.js";
import type { ILInstruction, ILTerminator } from "../il/instruction.js";
import type { ILFunction } from "../il/cfg.js";
import { terminatorTargets } from "../il/cfg.js";
import { log2Exact } from "../util/bits.js";

import type { Opcode } from "./opcode.js";
import type { ConditionalBranch } from "./branch-tail.js";
import { isConditionalBranch, planBranchTail } from "./branch-tail.js";
import type { AddressingMode } from "./addressing-mode.js";
import { imm8, labelRef, none, symbolExpr, symbolRef } from "./operand.js";
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
 * What a comparison does with the flags it just produced.
 *
 * `value` materialises the 0/1 byte into `dest` — the form a boolean-valued
 * expression needs. `branch` hands the flags straight to the two block edges:
 * no 0/1 is built, so no temp, no frame slot, and no reload stand between the
 * compare and the branch.
 *
 * Both tails sit behind ONE compare sequence per framing. That is deliberate:
 * a divergence in polarity between the two forms is not something review has
 * to catch, because there is only one place the polarity is decided.
 */
type CmpTail =
  | { readonly kind: "value"; readonly dest: ILOperand }
  | { readonly kind: "branch"; readonly trueTarget: string; readonly falseTarget: string };

/**
 * Optional per-target translation options.
 *
 * `zpArgBlockSize` enables the runtime-call ZP arg-block check (E10044):
 * when absent (bare `generateInstr` callers) the check is skipped;
 * `assembleProgram` threads it from `plugin.profile`. `platformId` names the
 * platform in the E10044 message.
 */
export interface TranslateOptions {
  /** The target profile's ZP arg-block size in bytes (enables E10044). */
  readonly zpArgBlockSize?: number;
  /** The target platform id, for the E10044 message. */
  readonly platformId?: string;
  /**
   * A program-shared comparison-label allocator. The `_cmpN` labels are
   * global assembler symbols, so every function of one program must draw
   * from a single sequence — two functions both starting at `_cmp0` would
   * collide at assembly. Absent (single-function translation in tests),
   * a translator-local counter serves.
   */
  readonly cmpLabels?: { next: number };
}

/**
 * Translate one {@link ILFunction} into one {@link InstrStream}.
 *
 * Emits the function's entry label, then each instruction of its single live
 * block, then the terminator. Deterministic: the same IL yields the same stream.
 *
 * @param fn The lowered function (single-block live shape).
 * @param plan The carried allocation plan (`ilProgram.allocationPlan`).
 * @param _cpuVariant The target CPU variant. The live op set is wholly NMOS-legal,
 *   so the slice never needs the variant to choose an encoding; it is part of the
 *   signature for symmetry with `generateInstr` and for later slices, where 65C02
 *   addressing modes become selectable. `generateInstr` validates the emitted
 *   stream against the variant, so an illegal pair would still be caught.
 * @param bag Diagnostic sink: deferred-op ICEs + cost warnings.
 * @param opts Optional target options: ZP arg-block size + platform id
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
 * The operator-backing T3 routine catalog keyed by symbol — a single
 * keyed table (no per-name special-casing), consulted by the `mul`/
 * `div`/`mod` call sites for the routine's descriptor (ABI + ZP requirement).
 */
const RT_BY_NAME: ReadonlyMap<string, IntrinsicDescriptor> = new Map(
  RT_ROUTINES.map((d) => [d.name, d]),
);

/**
 * The T1 opcode-intrinsic name → 6502 mnemonic map. A single
 * keyed table built at module load — not a scattered per-name switch — so the
 * "no intrinsic special-casing" audit passes. Each entry lowers to exactly
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


/** Per-function translation state. One instance per `translateFunction`. */
class FunctionTranslator {
  private readonly out: StreamEntry[] = [];
  private readonly binder: ReturnType<typeof createRegisterBinder>;

  /** Use-count per temp id, from the pre-scan. */
  private readonly useCount = new Map<number, number>();
  /**
   * REMAINING uses per temp id — a separate copy of the pre-scan totals,
   * decremented once per consumed IL operand occurrence as instructions and
   * terminators are translated. `useCount` itself is never decremented (the
   * fold decisions read the static totals). At a user-call `JSR` this is what
   * answers "is any value still needed after the call?".
   */
  private readonly remainingUses = new Map<number, number>();
  /** Temp ids defined so far in the CURRENT block (dest of const/load/ALU/call). */
  private readonly producedThisBlock = new Set<number>();
  /** Single-use `load` results deferred for folding: temp id → source location. */
  private readonly loadSource = new Map<number, ILOperand>();
  /**
   * Zero-extension results folded away entirely: temp id → the byte source.
   * Consumers read the low byte from the source's home/immediate and the high
   * byte as the constant 0 — a zext of a memory-resident byte costs nothing.
   */
  private readonly convSource = new Map<number, ILOperand>();

  /** Temp id currently resident in A (byte value or word low byte), or null. */
  private regA: number | null = null;
  /** Temp id whose word high byte is resident in X, or null. */
  private regX: number | null = null;
  /**
   * What the Y register currently holds — an immediate offset value or a
   * temp's byte value — or `null`. Only the indirect `(zp),Y` framings load
   * Y; the mirror lets same-offset runs share one `LDY` and is invalidated
   * by every Y-touching sequence (`INY`), every `JSR`, and block boundaries.
   */
  private regY: { readonly kind: "imm"; readonly value: number } | { readonly kind: "temp"; readonly id: number } | null =
    null;
  /** Span to attach to the next emitted lead instruction. */
  private leadSpan: SourceSpan | undefined = undefined;
  /** Instruction index whose `store` has been folded into a word ALU (skip it). */
  private skipIndex = -1;
  /**
   * Fallback generated-label counter (`_cmpN`) for translator-local use
   * when no program-shared allocator is supplied.
   */
  private cmpCounter = 0;
  /**
   * The **IL** label of the block that will be emitted next, or `undefined`
   * while translating the last one.
   *
   * This is the only point in the pipeline where block adjacency exists, which
   * is why the tail decision is taken here rather than as a later text pass.
   * The comparison is on IL labels, never on rendered names: the entry block
   * renders under a different scheme from every other block, and comparing
   * rendered names would either produce a dangling label or — worse — silently
   * miss the elision.
   */
  private nextBlockLabel: string | undefined = undefined;

  /** The next program-unique generated-label number (shared across families). */
  private nextLabelNumber(): number {
    const shared = this.opts?.cmpLabels;
    return shared !== undefined ? shared.next++ : this.cmpCounter++;
  }

  /** The next program-unique comparison label. */
  private nextCmpLabel(): string {
    return `_cmp${this.nextLabelNumber()}`;
  }

  constructor(
    private readonly fn: ILFunction,
    private readonly plan: AllocationPlan,
    private readonly bag: DiagnosticBag,
    private readonly opts?: TranslateOptions,
  ) {
    // Interrupt-only functions spill into the separate irq pool (Ch 06's
    // ZP-separation rule); everything else keeps the main pool.
    this.binder = createRegisterBinder(
      plan,
      bag,
      plan.irqOnlyFunctions?.has(fn.name) === true ? "irq-temp" : "temp",
    );
  }

  /**
   * Drive the translation and return the finished stream. Iterates **every** CFG
   * block: the entry block keeps the function-entry label; every non-entry
   * block emits its own function-unique block label. The use-count pre-scan
   * covers all blocks up front, and per-block peephole/fold state is reset at
   * each block boundary (MANDATORY: a block label is a branch target, so
   * nothing may carry across it).
   */
  run(): InstrStream {
    this.binder.reset();
    this.out.push(label(sanitize(this.fn.name)));

    // Interrupt handlers preserve all three CPU registers around the body:
    // the hardware already stacked P and the return address, so saving
    // A/X/Y here (and restoring them at every `ret`) makes the interruption
    // invisible to the interrupted code. Unconditional — no clobber
    // analysis; a leaner save is a future optimization.
    if (this.fn.isInterrupt) {
      this.emit("PHA", "Implied", none());
      this.emit("TXA", "Implied", none());
      this.emit("PHA", "Implied", none());
      this.emit("TYA", "Implied", none());
      this.emit("PHA", "Implied", none());
    }

    this.validateTerminatorTargets();
    this.prescanAll();
    this.fn.blocks.forEach((block, i) => {
      this.resetBlockState();
      this.nextBlockLabel = this.fn.blocks[i + 1]?.label;
      if (block.label !== "_entry") {
        this.out.push(label(this.blockLabel(block.label)));
      }
      block.instructions.forEach((ins, i) => {
        if (i !== this.skipIndex) {
          // A skipped store was folded into the preceding word ALU — its
          // reads are still consumed below so the remaining-use ledger stays
          // truthful.
          this.translateInstruction(ins, i, block.instructions);
        }
        this.consumeReads(readOperands(ins));
        const produced = destTempId(ins);
        if (produced !== null) {
          this.producedThisBlock.add(produced);
        }
      });
      this.translateTerminator(block.terminator);
      this.consumeReads(terminatorReads(block.terminator));
    });
    this.nextBlockLabel = undefined;
    if (this.fn.blocks.length === 0) {
      this.translateTerminator({ kind: "ret" });
    }

    return { symbol: this.fn.name, segment: "code", entries: this.out };
  }

  // ── Pre-passes ─────────────────────────────────────────────────────────────

  /**
   * Check that every terminator branches to a block that exists.
   *
   * A branch into a label with no block would assemble to a jump at an
   * undefined address — the kind of defect that surfaces as a hang on real
   * hardware rather than as a compiler message. Lowering is what mints labels,
   * so this catches its bugs at the boundary, before a single instruction is
   * emitted. Every branching kind is checked from the one shared successor
   * enumeration, so a terminator kind can never slip past by being forgotten
   * here.
   */
  private validateTerminatorTargets(): void {
    const labels = new Set(this.fn.blocks.map((b) => b.label));
    for (const block of this.fn.blocks) {
      for (const target of terminatorTargets(block.terminator)) {
        if (!labels.has(target)) {
          this.iceDanglingTarget(target, block.label, block.terminator.kind);
        }
      }
    }
  }

  // ── Pre-scan (D10) ─────────────────────────────────────────────────────────

  /**
   * Count every temp's reads across **all** blocks. `useCount` gates
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
      for (const termRead of terminatorReads(block.terminator)) {
        if (isTemp(termRead)) {
          this.useCount.set(termRead.id, (this.useCount.get(termRead.id) ?? 0) + 1);
        }
      }
    }
    // Seed the remaining-use ledger with a COPY of the totals; translation
    // decrements the copy only.
    for (const [id, count] of this.useCount) {
      this.remainingUses.set(id, count);
    }
  }

  /** Decrement the remaining-use ledger once per consumed temp occurrence. */
  private consumeReads(reads: readonly ILOperand[]): void {
    for (const op of reads) {
      if (isTemp(op)) {
        this.remainingUses.set(op.id, (this.remainingUses.get(op.id) ?? 0) - 1);
      }
    }
  }

  /**
   * Reset the block-local peephole/fold state at a block boundary (this is
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
    this.convSource.clear();
    this.producedThisBlock.clear();
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
        this.leadSpan = ins.span; // provenance: attach to the next lead instr
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
        this.translateShift(ins.op, ins.dest, ins.left, ins.right, ins.type, index, all);
        return;
      case "eq":
      case "ne":
      case "lt":
      case "le":
      case "gt":
      case "ge":
        this.translateComparison(
          ins.op,
          { kind: "value", dest: ins.dest },
          ins.left,
          ins.right,
          ins.type,
        );
        return;
      case "neg":
        this.translateNeg(ins.dest, ins.src, ins.type, index, all);
        return;
      case "not":
        this.translateNot(ins.dest, ins.src, ins.type, index, all);
        return;
      case "zext":
        this.translateZext(ins.dest, ins.src);
        return;
      case "sext":
        this.translateSext(ins.dest, ins.src, index, all);
        return;
      case "trunc":
        this.translateTrunc(ins.dest, ins.src);
        return;
      case "copy":
        this.translateCopy(ins.dest, ins.src);
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
      case "call":
        this.translateCall(ins.dest, ins.target);
        return;
      case "load_indexed":
        this.translateLoadIndexed(ins.value, ins.base, ins.index, index, all);
        return;
      case "store_indexed":
        this.translateStoreIndexed(ins.value, ins.base, ins.index);
        return;
      case "load_indirect":
        this.translateLoadIndirect(ins.value, ins.ptr, ins.offset, index, all);
        return;
      case "store_indirect":
        this.translateStoreIndirect(ins.value, ins.ptr, ins.offset);
        return;
      default: {
        // Exhaustiveness guard: a new IL op without a case above fails to
        // type-check here rather than mistranslating silently.
        const unreachable: never = ins;
        this.iceUnsupported(String((unreachable as ILInstruction).op));
        return;
      }
    }
  }

  /**
   * Translate a user-function `call`: the arguments already sit in the
   * callee's frame slots (explicit `store` ops from lowering), so the call is
   * a bare `JSR` to the sanitized `Module_function` label plus result
   * binding — A for a byte result, A:X for a word. A user callee may clobber
   * any register or shared expression temp, so every other mirror is dropped.
   *
   * Never-miscompile guard: expression temps spill to the one shared
   * zero-page pool the callee's own expressions reuse, and registers do not
   * survive a call — so ANY value produced in this block that still has
   * remaining uses at the `JSR` and is not memory-homed (a deferred load can
   * be re-read from its home afterwards) would come back corrupted. That
   * shape (`f() + g()`) is rejected loudly before emitting anything;
   * evaluating each call into a variable first compiles fine.
   */
  private translateCall(dest: ILOperand | undefined, target: string): void {
    const destId = dest !== undefined && isTemp(dest) ? dest.id : null;
    for (const id of this.producedThisBlock) {
      if (id === destId) continue;
      if ((this.remainingUses.get(id) ?? 0) <= 0) continue;
      if (this.loadSource.has(id)) continue; // memory-homed → survives the call
      this.bag.addICE(
        IceCode.Unexpected,
        null,
        `IL→Instr: value live across a call to '${target}' — ` +
          `evaluate calls into variables first`,
      );
      return;
    }

    this.emit("JSR", "Absolute", labelRef(sanitize(target)));
    this.clearRegs();
    if (dest !== undefined && destId !== null) {
      this.bindA(destId); // byte result in A; word low byte in A
      if (widthOf(dest) === 16) {
        this.bindX(destId); // word high byte in X
      }
    }
  }

  /**
   * Translate an IL `intrinsic` op. The T1 `'opcode'` strategy emits exactly one
   * Implied-mode instruction from the {@link T1_OPCODES} map; the T3/T4
   * `'call'` strategy is handled by the marshalling path. Any other
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
      // T3/T4 runtime-routine call. The ZP arg-block requirement is
      // checked first (E10044 → poison). Per-signature argument
      // marshalling for user-visible T4 calls happens separately; the internal
      // operator-backing routines marshal via `marshalAndCall` (mul/div/mod).
      if (!this.checkZpArgBlock(descriptor)) {
        return;
      }
      this.emit("JSR", "Absolute", labelRef(descriptor.name));
      this.clearRegs();
      return;
    }
    // 'fold'/'inline' never reach translate as an `intrinsic` op — the lowering
    // resolves them earlier; reaching here is a lowering bug.
    this.iceUnsupported(`intrinsic '${name}' strategy '${descriptor.loweringStrategy}'`);
  }

  /**
   * Translate a block terminator:
   * - `ret` — bring the value into A/A:X (if any) then `RTS`/`RTI` (unchanged).
   * - `br` — an unconditional `JMP` to the target block label (3-byte absolute is
   *   always in range, unlike a relative branch) — omitted entirely when the
   *   target is the block that follows, which control reaches by falling through.
   * - `brcond` — the condition operand is a **materialized boolean byte** (0/1),
   *   not live CPU flags. Load it (a redundant `LDA` is suppressed only when the
   *   boolean is already resident in A within this block), then emit the planned
   *   tail: `BNE` to the true target and `JMP` to the false one, with the jump
   *   dropped — and the branch inverted, when it is the *true* edge that
   *   follows — whenever one of the two edges is the next block. This is the
   *   terminator for branching on a boolean *value* — one that was computed
   *   elsewhere, or stored, or passed in.
   * - `brcmp` — the comparison IS the branch: the same framing a value context
   *   would run, ending in a branch to the true target instead of a 0/1 byte.
   *   Nothing is materialized, so no temp, no frame slot, and no reload sit
   *   between the compare and the branch.
   * - `unreachable` — control provably cannot reach here; emit nothing.
   */
  private translateTerminator(term: ILTerminator): void {
    switch (term.kind) {
      case "ret":
        if (term.value !== undefined) {
          this.bringValueIntoRegisters(term.value, widthOf(term.value));
        }
        if (this.fn.isInterrupt) {
          // Restore Y, X, A in reverse push order; RTI then restores P and
          // the return address the hardware stacked. Every exit path carries
          // the full sequence — correct and unoptimized by design.
          this.emit("PLA", "Implied", none());
          this.emit("TAY", "Implied", none());
          this.emit("PLA", "Implied", none());
          this.emit("TAX", "Implied", none());
          this.emit("PLA", "Implied", none());
          this.emit("RTI", "Implied", none());
        } else {
          this.emit("RTS", "Implied", none());
        }
        return;
      case "br":
        // The degenerate tail: a jump to the block that follows is exactly the
        // fall-through the hardware does for free.
        if (term.target !== this.nextBlockLabel) {
          this.emit("JMP", "Absolute", labelRef(this.blockLabel(term.target)));
        }
        return;
      case "brcond":
        this.leftIntoA(term.cond); // materialized 0/1 boolean → A (redundant LDA suppressed)
        this.emitBranchTail("BNE", term.trueTarget, term.falseTarget);
        return;
      case "unreachable":
        return; // provably unreachable — no code, no ICE
      case "brcmp":
        this.translateComparison(
          term.op,
          { kind: "branch", trueTarget: term.trueTarget, falseTarget: term.falseTarget },
          term.left,
          term.right,
          term.type,
        );
        return;
      default: {
        // Exhaustiveness guard: a new terminator kind without a case here is a
        // compile error, never a block that silently falls through.
        const _exhaustive: never = term;
        this.iceNoTranslation(String((_exhaustive as ILTerminator).kind));
        return;
      }
    }
  }

  // ── const / load / store ─────────────────────────────────────────────────────

  private translateConst(dest: ILOperand, src: ILOperand): void {
    // Only a store source takes a lowered value raw; every other expression
    // position wraps it in a `const` first, so this is where an address byte
    // arrives when it initialises a variable, feeds an assignment, or reaches
    // any of the other materialising positions. It is always byte-wide, so the
    // 16-bit high half below never applies to it.
    if (isAddrByte(src) && isTemp(dest)) {
      this.protectA();
      this.emit("LDA", "Immediate", this.instrOperandFor(src));
      this.bindA(dest.id);
      return;
    }
    if (!isTemp(dest) || !isImmediate(src)) {
      this.iceUnsupported("const (non-temp dest or non-immediate src)");
      return;
    }
    this.protectA(); // a live index/value in A survives the immediate load
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
    // Single-use load results are deferred and folded at the consumer.
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
    // An address-of source stores the symbol's link-time address byte by
    // byte (`#<sym+off` / `#>sym+off`) — argument marshalling and the
    // formation's scratch seed. Clobbers A, so a live value spills first.
    if (isAddr(value)) {
      this.protectA();
      const opts = value.offset !== undefined ? { offset: value.offset } : {};
      this.emit(
        "LDA",
        "Immediate",
        symbolRef(value.symbol, { ...opts, byteSelect: "low" }),
      );
      this.emit("STA", "Absolute", symHome(target, 0));
      this.emit(
        "LDA",
        "Immediate",
        symbolRef(value.symbol, { ...opts, byteSelect: "high" }),
      );
      this.emit("STA", "Absolute", symHome(target, 1));
      this.clearRegs();
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
    // 16-bit: write each byte inline to the consuming store's target.
    const home = this.foldStoreHome(dest, index, all);
    if (home === null) {
      this.iceUnsupported("word arithmetic result not consumed by a store");
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
      this.iceUnsupported("word bitwise result not consumed by a store");
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

  /**
   * Translate a shift. Byte shifts run in A (unrolled for constant counts, an
   * X-counted loop with a zero-count guard for variable counts); signed right
   * shifts replicate the sign per step (`CMP #$80` seeds the carry with bit 7
   * before `ROR`). Word shifts run in memory through the consuming store's
   * home (`ASL`/`ROL` up, `LSR`/`ROR` down, sign-seeded for signed) — a word
   * shift result not consumed by a store is rejected loudly, never guessed.
   */
  private translateShift(
    op: "shl" | "shr",
    dest: ILOperand,
    left: ILOperand,
    right: ILOperand,
    type: ILType,
    index: number,
    all: readonly ILInstruction[],
  ): void {
    const signedShr = op === "shr" && type.signed;

    if (type.width === 8) {
      this.leftIntoA(left);
      if (isImmediate(right)) {
        for (let i = 0; i < (right.value & 0xff); i++) {
          this.emitByteShiftStep(op, signedShr);
        }
        this.bindA(asTempId(dest));
        return;
      }
      const count = this.rightSource(right, 0);
      this.emit("LDX", count.mode, count.operand);
      const loopL = `_sh${this.nextLabelNumber()}`;
      const doneL = `_sh${this.nextLabelNumber()}`;
      this.emit("BEQ", "Relative", labelRef(doneL)); // a zero count shifts nothing
      this.out.push(label(loopL));
      this.emitByteShiftStep(op, signedShr);
      this.emit("DEX", "Implied", none());
      this.emit("BNE", "Relative", labelRef(loopL));
      this.out.push(label(doneL));
      this.bindA(asTempId(dest));
      return;
    }

    // 16-bit: in place at the consuming store's home.
    const home = this.foldStoreHome(dest, index, all);
    if (home === null) {
      this.iceUnsupported(`word ${op} result not consumed by a store`);
      return;
    }
    this.copyWordToHome(left, home);
    if (isImmediate(right)) {
      for (let i = 0; i < (right.value & 0xff); i++) {
        this.emitWordShiftStep(op, signedShr, home);
      }
      this.clearRegs();
      return;
    }
    const count = this.rightSource(right, 0);
    this.emit("LDX", count.mode, count.operand);
    const loopL = `_sh${this.nextLabelNumber()}`;
    const doneL = `_sh${this.nextLabelNumber()}`;
    this.emit("BEQ", "Relative", labelRef(doneL));
    this.out.push(label(loopL));
    this.emitWordShiftStep(op, signedShr, home);
    this.emit("DEX", "Implied", none());
    this.emit("BNE", "Relative", labelRef(loopL));
    this.out.push(label(doneL));
    this.clearRegs();
  }

  /** One byte shift step in A (`ASL`/`LSR`; signed right = sign-seeded `ROR`). */
  private emitByteShiftStep(op: "shl" | "shr", signedShr: boolean): void {
    if (op === "shl") {
      this.emit("ASL", "Accumulator", none());
      return;
    }
    if (!signedShr) {
      this.emit("LSR", "Accumulator", none());
      return;
    }
    // Arithmetic: seed the carry with the sign bit (A >= $80), then rotate.
    this.emit("CMP", "Immediate", imm8(0x80));
    this.emit("ROR", "Accumulator", none());
  }

  /** One word shift step in memory at `home` (lo/hi byte pair). */
  private emitWordShiftStep(op: "shl" | "shr", signedShr: boolean, home: MemHome): void {
    if (op === "shl") {
      this.emit("ASL", "Absolute", symAt(home, 0));
      this.emit("ROL", "Absolute", symAt(home, 1));
      return;
    }
    if (!signedShr) {
      this.emit("LSR", "Absolute", symAt(home, 1));
      this.emit("ROR", "Absolute", symAt(home, 0));
      return;
    }
    // Arithmetic: seed the carry with the high byte's sign, then rotate down.
    this.emit("LDA", "Absolute", symAt(home, 1));
    this.emit("CMP", "Immediate", imm8(0x80));
    this.emit("ROR", "Absolute", symAt(home, 1));
    this.emit("ROR", "Absolute", symAt(home, 0));
  }

  /** Copy a word operand into `home` (skipped when it already lives there). */
  private copyWordToHome(value: ILOperand, home: MemHome): void {
    const src = this.sourceHome(value);
    if (src !== null && src.name === home.name && src.offset === home.offset) {
      return; // shifting a variable back into itself — already in place
    }
    for (const i of [0, 1] as const) {
      const ref = this.byteRefOf(value, i);
      if (ref === null) {
        this.iceUnsupported("word shift operand without a memory home");
        return;
      }
      this.emit("LDA", ref.mode, ref.operand);
      this.emit("STA", "Absolute", symAt(home, i));
    }
    this.clearRegs();
  }

  // ── Operand / register helpers ───────────────────────────────────────────────

  /** Bring a byte operand (ALU left, value) into A, suppressing a redundant load. */
  private leftIntoA(op: ILOperand): void {
    if (isAddr(op)) {
      this.iceUnsupported("addr operand outside a store source or ALU right operand");
      return;
    }
    if (isTemp(op)) {
      if (this.regA === op.id) {
        return; // already in A (redundant-load suppression)
      }
      const home = this.sourceHome(op);
      if (home !== null) {
        this.emit("LDA", "Absolute", symAt(home, 0));
        this.bindA(op.id);
        return;
      }
      // Spilled temp (register-pressure path): read from its ZP home.
      this.emit("LDA", "ZeroPage", this.binder.operandFor(op));
      this.bindA(op.id);
      return;
    }
    if (isImmediate(op)) {
      this.emit("LDA", "Immediate", imm8(op.value & 0xff));
      this.clearRegs();
      return;
    }
    if (isAddrByte(op)) {
      this.emit("LDA", "Immediate", this.instrOperandFor(op));
      this.clearRegs();
      return;
    }
    if (isLocation(op)) {
      this.emit("LDA", "Absolute", symHome(op, 0));
      this.clearRegs();
      return;
    }
    // Falling out of the chain would emit nothing at all, and the caller's
    // following STA would then store whatever value happens to be left in A.
    // Silence is the one outcome this must never have.
    this.iceUnsupported("byte operand with no load form");
  }

  /** Bring one byte (lo=0/hi=1) of a word ALU left operand into A. */
  private wordLeftByteIntoA(op: ILOperand, byteIndex: number): void {
    if (isAddr(op)) {
      this.iceUnsupported("addr operand outside a store source or ALU right operand");
      return;
    }
    const ref = this.byteRefOf(op, byteIndex); // homes, immediates, folded zext
    if (ref !== null) {
      this.emit("LDA", ref.mode, ref.operand);
      return;
    }
    if (byteIndex === 0 && isTemp(op) && this.regA === op.id) {
      return; // word low byte already in A
    }
    if (byteIndex === 1 && isTemp(op) && this.regX === op.id) {
      this.emit("TXA", "Implied", none()); // bring the high byte from X into A
      return;
    }
    // Fallback: spilled word temp — read its ZP home byte.
    if (isTemp(op)) {
      this.emit("LDA", "ZeroPage", this.binder.operandFor(op));
    }
  }

  /** Bring a value into A (byte) or A:X (word) for a `store`/`ret` consumer. */
  private bringValueIntoRegisters(value: ILOperand, width: 8 | 16): void {
    if (isAddr(value)) {
      this.iceUnsupported("addr operand outside a store source or ALU right operand");
      return;
    }
    if (width === 8) {
      this.leftIntoA(value);
      return;
    }
    if (isTemp(value) && this.regA === value.id && this.regX === value.id) {
      return; // word already in A:X (e.g. a const-word result)
    }
    // Per-byte references cover memory homes, immediates, and folded
    // zero-extensions (low byte from the source, high byte the constant 0).
    const lo = this.byteRefOf(value, 0);
    const hi = this.byteRefOf(value, 1);
    if (lo !== null && hi !== null) {
      this.emit("LDA", lo.mode, lo.operand);
      this.emit("LDX", hi.mode, hi.operand);
      this.bindA(isTemp(value) ? value.id : null);
      this.bindX(isTemp(value) ? value.id : null);
      return;
    }
    // Without an else the word simply never reaches A:X, and the consumer
    // stores stale registers as if it had.
    this.iceUnsupported("word value with no per-byte read reference");
  }

  /**
   * The assembler operand a selected address byte maps to. This is the single
   * place the IL variant becomes an instruction operand, so the plain and
   * shifted spellings cannot drift apart as consumers are added.
   *
   * @param op The address-byte operand to map.
   * @returns The immediate operand the assembler resolves at link time.
   */
  private instrOperandFor(op: Extract<ILOperand, { kind: "addrByte" }>): InstrOperand {
    return op.shift === undefined
      ? symbolRef(op.symbol, { byteSelect: op.select })
      : symbolExpr(op.symbol, op.shift, op.select);
  }

  /**
   * The read reference for one byte (lo=0/hi=1) of an operand, or `null` when
   * the operand has no addressable byte source (register-resident temps).
   * Covers immediates (split lo/hi), memory homes (locations + deferred
   * loads), and folded zero-extensions (low byte delegates to the byte
   * source; high byte is the constant 0).
   */
  private byteRefOf(op: ILOperand, byteIndex: number): SourceRef | null {
    if (isImmediate(op)) {
      const v = byteIndex === 0 ? op.value & 0xff : (op.value >> 8) & 0xff;
      return { operand: imm8(v), mode: "Immediate" };
    }
    if (isAddrByte(op)) {
      // A byte value widened to a word has a zero high byte; without that half
      // a word consumer would read a null here and emit nothing for it.
      return byteIndex === 0
        ? { operand: this.instrOperandFor(op), mode: "Immediate" }
        : { operand: imm8(0), mode: "Immediate" };
    }
    const home = this.sourceHome(op);
    if (home !== null) {
      return { operand: symAt(home, byteIndex), mode: "Absolute" };
    }
    if (isTemp(op)) {
      const conv = this.convSource.get(op.id);
      if (conv !== undefined) {
        return byteIndex === 0
          ? this.byteRefOf(conv, 0)
          : { operand: imm8(0), mode: "Immediate" };
      }
    }
    return null;
  }

  /**
   * A right ALU operand's read reference for the given byte index (lo=0/hi=1).
   * An address-of right operand reads as the assembler-resolved byte-select
   * immediate (`#<sym+off` / `#>sym+off`) — the runtime pointer formation
   * adds a base address to a scaled index this way.
   */
  private rightSource(op: ILOperand, byteIndex: number): SourceRef {
    if (isAddr(op)) {
      const opts = op.offset !== undefined ? { offset: op.offset } : {};
      return {
        operand: symbolRef(op.symbol, {
          ...opts,
          byteSelect: byteIndex === 0 ? "low" : "high",
        }),
        mode: "Immediate",
      };
    }
    const ref = this.byteRefOf(op, byteIndex);
    if (ref !== null) {
      return ref;
    }
    if (isTemp(op)) {
      return { operand: this.binder.operandFor(op), mode: "ZeroPage" };
    }
    // An implied-mode operand on an instruction that needs a source is not a
    // read at all; it survives translation and validation and only the
    // assembler ever objects, by which point the cause is long gone. The
    // returned reference is unreachable — the ICE fails the build first.
    this.iceUnsupported("ALU right operand with no read reference");
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

  // ── comparisons — byte/word × unsigned/signed framings ─────────────────────

  /**
   * Translate a comparison. The `type` is the (promoted) OPERAND type — it
   * selects the framing. Equality is signedness-neutral (bit compare) at both
   * widths; ordered comparisons dispatch to the carry framing (unsigned) or the
   * N-xor-V framing (signed). All framings branch on the FRESH compare flag
   * before any `LDA` (an `LDA` clobbers Z/N).
   *
   * `tail` decides what happens to those flags — a materialised 0/1 byte in A
   * for a value context, or a direct branch to the two block edges for a fused
   * compare-and-branch. Every framing below produces its flags identically for
   * both.
   */
  private translateComparison(
    op: "eq" | "ne" | "lt" | "le" | "gt" | "ge",
    tail: CmpTail,
    left: ILOperand,
    right: ILOperand,
    type: ILType,
  ): void {
    // gt/le compare with operands swapped (a>b ≡ b<a; a<=b ≡ b>=a) in every
    // framing, so the emitters only implement lt/ge (and eq/ne).
    const swap = op === "gt" || op === "le";
    const lhs = swap ? right : left;
    const rhs = swap ? left : right;

    if (type.width === 16) {
      if (op === "eq" || op === "ne") {
        this.wordEquality(op, tail, lhs, rhs);
      } else if (type.signed) {
        this.wordSignedOrdered(op, tail, lhs, rhs);
      } else {
        this.wordUnsignedOrdered(op, tail, lhs, rhs);
      }
      return;
    }
    if (type.signed && op !== "eq" && op !== "ne") {
      this.byteSignedOrdered(op, tail, lhs, rhs);
      return;
    }

    // 8-bit unsigned framing (and 8-bit equality — bit compare).
    const branch: Opcode =
      op === "eq" ? "BEQ" : op === "ne" ? "BNE" : op === "lt" || op === "gt" ? "BCC" : "BCS";

    this.leftIntoA(lhs);
    const r = this.rightSource(rhs, 0);
    this.emit("CMP", r.mode, r.operand);
    // Equality decides on Z, order on the carry — and only the carry survives
    // an intervening `LDA`, which is what lets the compact value tail exist.
    this.emitCmpTail(tail, branch, op === "eq" || op === "ne" ? "zn" : "carry");
  }

  /**
   * Consume the flags a framing just produced.
   *
   * `branch` is the opcode taken exactly when the comparison holds, and it is
   * always the first instruction emitted here: an `LDA` between the compare and
   * the branch would clobber Z/N. `flag` says which flag carries the answer —
   * the carry survives an `LDA`, so a carry-based value tail can use the
   * compact three-instruction form, while a Z/N-based one must branch first.
   */
  private emitCmpTail(tail: CmpTail, branch: Opcode, flag: "carry" | "zn"): void {
    if (tail.kind === "branch") {
      this.emitBranchTail(branch, tail.trueTarget, tail.falseTarget);
      // No result exists to bind, and the framings that reach here have left a
      // compare residue in A. The block ends at a terminator either way, but
      // clearing here keeps the mirror honest without relying on that.
      this.clearRegs();
      return;
    }
    if (flag === "carry") {
      // `LDA #$01; B?? done; LDA #$00` is correct here only because the branch
      // still tests the carry the `CMP` set.
      const done = this.nextCmpLabel();
      this.emit("LDA", "Immediate", imm8(0x01));
      this.emit(branch, "Relative", labelRef(done));
      this.emit("LDA", "Immediate", imm8(0x00));
      this.out.push(label(done));
    } else {
      // The same shape on Z/N would test the flag set by `LDA #$01` (always
      // Z=0, N=0) and never take the branch, so the branch goes first.
      this.materialiseOnBranch(branch);
    }
    this.bindA(asTempId(tail.dest));
  }

  /**
   * Emit a conditional block tail: the branch, plus the jump to the other edge
   * unless the block that follows makes it redundant.
   *
   * This is the single place a block tail is emitted, so elision and inversion
   * cannot diverge. A branch with no polarity partner cannot reach a block tail
   * — every framing ends in one of the eight conditional branches — so an
   * opcode that fails the guard is a translator bug; it is reported rather than
   * quietly emitted un-inverted, because a missed inversion is invisible in the
   * output.
   */
  private emitBranchTail(branch: Opcode, trueTarget: string, falseTarget: string): void {
    const trueL = this.blockLabel(trueTarget);
    const falseL = this.blockLabel(falseTarget);
    if (!isConditionalBranch(branch)) {
      this.bag.addICE(
        IceCode.Unexpected,
        null,
        `translate: block tail on non-conditional branch '${branch}'`,
      );
      this.emit(branch, "Relative", labelRef(trueL));
      this.emit("JMP", "Absolute", labelRef(falseL));
      return;
    }
    const plan = planBranchTail(branch, trueTarget, falseTarget, this.nextBlockLabel);
    switch (plan.kind) {
      case "elide":
        this.emit(branch, "Relative", labelRef(trueL));
        return;
      case "invert":
        this.emit(plan.opcode, "Relative", labelRef(falseL));
        return;
      case "both":
        this.emit(branch, "Relative", labelRef(trueL));
        this.emit("JMP", "Absolute", labelRef(falseL));
        return;
      default: {
        const _exhaustive: never = plan;
        return _exhaustive;
      }
    }
  }

  /** Branch-taken ⇒ 1: materialise the 0/1 from a flag-fresh branch opcode. */
  private materialiseOnBranch(branch: Opcode): void {
    const trueL = this.nextCmpLabel();
    const endL = this.nextCmpLabel();
    this.emit(branch, "Relative", labelRef(trueL));
    this.emit("LDA", "Immediate", imm8(0x00));
    this.emit("JMP", "Absolute", labelRef(endL));
    this.out.push(label(trueL));
    this.emit("LDA", "Immediate", imm8(0x01));
    this.out.push(label(endL));
  }

  /**
   * 8-bit signed ordered comparison: `SEC · SBC · BVC skip · EOR #$80 · skip`
   * leaves N = the true sign of lhs−rhs (the EOR corrects an overflowed
   * subtraction), so `BMI` decides "less" and `BPL` decides "greater-or-equal".
   */
  private byteSignedOrdered(
    op: "lt" | "le" | "gt" | "ge",
    tail: CmpTail,
    lhs: ILOperand,
    rhs: ILOperand,
  ): void {
    const wantLess = op === "lt" || op === "gt"; // after the caller's swap
    this.leftIntoA(lhs);
    this.emit("SEC", "Implied", none());
    const r = this.rightSource(rhs, 0);
    this.emit("SBC", r.mode, r.operand);
    const skipL = this.nextCmpLabel();
    this.emit("BVC", "Relative", labelRef(skipL));
    this.emit("EOR", "Immediate", imm8(0x80));
    this.out.push(label(skipL));
    this.emitCmpTail(tail, wantLess ? "BMI" : "BPL", "zn");
  }

  /**
   * 16-bit equality: low bytes decide fast, high bytes break the tie (Z-based).
   *
   * A differing low byte already settles the answer, so where that early-out
   * goes is what separates the two tails. A value context has to rejoin — the
   * 0/1 tail reads Z, and both paths must reach it — but a fused branch sends
   * it straight to the edge it decided, saving the second branch on what is
   * the common outcome when comparing 16-bit positions or counters.
   */
  private wordEquality(op: "eq" | "ne", tail: CmpTail, lhs: ILOperand, rhs: ILOperand): void {
    const lowDiffers =
      tail.kind === "branch"
        ? this.blockLabel(op === "eq" ? tail.falseTarget : tail.trueTarget)
        : this.nextCmpLabel();
    this.wordLeftByteIntoA(lhs, 0);
    const rLo = this.rightSource(rhs, 0);
    this.emit("CMP", rLo.mode, rLo.operand);
    this.emit("BNE", "Relative", labelRef(lowDiffers)); // low differs → not equal
    this.wordLeftByteIntoA(lhs, 1);
    const rHi = this.rightSource(rhs, 1);
    this.emit("CMP", rHi.mode, rHi.operand);
    if (tail.kind === "value") {
      this.out.push(label(lowDiffers)); // Z now holds the full 16-bit equality
    }
    // The framing leaves A holding a compare residue, never the result: drop
    // the residency mirror before any tail rebinds it.
    this.clearRegs();
    this.emitCmpTail(tail, op === "eq" ? "BEQ" : "BNE", "zn");
  }

  /**
   * 16-bit unsigned ordered comparison, high byte first: a differing high
   * byte decides outright; equal high bytes fall through to the low-byte
   * carry decision.
   *
   * The framing's two internal joins are the only place the two tails differ
   * structurally. In a value context they are generated labels that a 0/1 tail
   * hangs off; in a fused branch they ARE the block edges, so each decision
   * branches straight to its target and the 0/1 tail disappears entirely.
   */
  private wordUnsignedOrdered(
    op: "lt" | "le" | "gt" | "ge",
    tail: CmpTail,
    lhs: ILOperand,
    rhs: ILOperand,
  ): void {
    const wantLess = op === "lt" || op === "gt"; // after the caller's swap

    if (tail.kind === "branch") {
      const trueL = this.blockLabel(tail.trueTarget);
      const falseL = this.blockLabel(tail.falseTarget);
      // This framing is the one where the branch that pairs with the trailing
      // jump is emitted by a helper rather than here — and that helper is
      // shared with the value tail, where inverting would be wrong. So the
      // decision is taken here and handed down as a descriptor; the helper's
      // other caller passes nothing and is provably unaffected.
      const branch: ConditionalBranch = wantLess ? "BCC" : "BCS";
      const plan = planBranchTail(branch, tail.trueTarget, tail.falseTarget, this.nextBlockLabel);
      this.wordUnsignedDecision(
        wantLess,
        lhs,
        rhs,
        trueL,
        falseL,
        plan.kind === "invert"
          ? { opcode: plan.opcode, target: falseL }
          : { opcode: branch, target: trueL },
      );
      if (plan.kind === "both") {
        this.emit("JMP", "Absolute", labelRef(falseL)); // low-byte carry said no
      }
      this.clearRegs();
      return;
    }

    const falseL = this.nextCmpLabel();
    const trueL = this.nextCmpLabel();
    const endL = this.nextCmpLabel();
    this.wordUnsignedDecision(wantLess, lhs, rhs, trueL, falseL);
    this.out.push(label(falseL));
    this.emit("LDA", "Immediate", imm8(0x00));
    this.emit("JMP", "Absolute", labelRef(endL));
    this.out.push(label(trueL));
    this.emit("LDA", "Immediate", imm8(0x01));
    this.out.push(label(endL));
    this.clearRegs();
    this.bindA(asTempId(tail.dest));
  }

  /**
   * The high-then-low carry decision both 16-bit unsigned tails run: a
   * differing high byte branches to its verdict outright, and equal high bytes
   * leave the low-byte carry to decide.
   *
   * The final low-byte branch is the one that can pair with a caller's trailing
   * jump, so the caller may replace it wholesale via `finalBranch` — opcode and
   * target together. Left to the default it branches to `trueL` and the framing
   * falls through only when the answer is "no"; inverted by the caller it
   * branches to `falseL` and falls through when the answer is "yes". Only the
   * caller knows which, because only the caller knows what block comes next.
   * The two high-byte decisions above are framing-internal and keep their
   * polarity in either case.
   */
  private wordUnsignedDecision(
    wantLess: boolean,
    lhs: ILOperand,
    rhs: ILOperand,
    trueL: string,
    falseL: string,
    finalBranch?: { readonly opcode: ConditionalBranch; readonly target: string },
  ): void {
    this.wordLeftByteIntoA(lhs, 1);
    const rHi = this.rightSource(rhs, 1);
    this.emit("CMP", rHi.mode, rHi.operand);
    if (wantLess) {
      this.emit("BCC", "Relative", labelRef(trueL)); // hi < → less
      this.emit("BNE", "Relative", labelRef(falseL)); // hi > → not less
    } else {
      this.emit("BCC", "Relative", labelRef(falseL)); // hi < → not greater-or-equal
      this.emit("BNE", "Relative", labelRef(trueL)); // hi > → greater-or-equal
    }
    this.wordLeftByteIntoA(lhs, 0);
    const rLo = this.rightSource(rhs, 0);
    this.emit("CMP", rLo.mode, rLo.operand);
    const final = finalBranch ?? { opcode: wantLess ? "BCC" : ("BCS" as const), target: trueL };
    this.emit(final.opcode, "Relative", labelRef(final.target));
  }

  /**
   * 16-bit signed ordered comparison: the low-byte `CMP` seeds the borrow,
   * the high-byte `SBC` (an `LDA` in between preserves carry) produces N/V,
   * and the `BVC`/`EOR #$80` correction leaves N = the true sign of lhs−rhs.
   */
  private wordSignedOrdered(
    op: "lt" | "le" | "gt" | "ge",
    tail: CmpTail,
    lhs: ILOperand,
    rhs: ILOperand,
  ): void {
    const wantLess = op === "lt" || op === "gt"; // after the caller's swap
    this.wordLeftByteIntoA(lhs, 0);
    const rLo = this.rightSource(rhs, 0);
    this.emit("CMP", rLo.mode, rLo.operand);
    this.wordLeftByteIntoA(lhs, 1);
    const rHi = this.rightSource(rhs, 1);
    this.emit("SBC", rHi.mode, rHi.operand);
    const skipL = this.nextCmpLabel();
    this.emit("BVC", "Relative", labelRef(skipL));
    this.emit("EOR", "Immediate", imm8(0x80));
    this.out.push(label(skipL));
    // As in the equality framing, A holds a subtraction residue here.
    this.clearRegs();
    this.emitCmpTail(tail, wantLess ? "BMI" : "BPL", "zn");
  }

  // ── unary ops + width conversions ───────────────────────────────────────────

  /**
   * Two's-complement negation. 8-bit runs in A (`EOR #$FF · CLC · ADC #$01`);
   * 16-bit computes `0 − x` with borrow through the consuming store's home.
   */
  private translateNeg(
    dest: ILOperand,
    src: ILOperand,
    type: ILType,
    index: number,
    all: readonly ILInstruction[],
  ): void {
    if (type.width === 8) {
      this.leftIntoA(src);
      this.emit("EOR", "Immediate", imm8(0xff));
      this.emit("CLC", "Implied", none());
      this.emit("ADC", "Immediate", imm8(0x01));
      this.bindA(asTempId(dest));
      return;
    }
    const home = this.foldStoreHome(dest, index, all);
    if (home === null) {
      this.iceUnsupported("word negation result not consumed by a store");
      return;
    }
    this.emit("SEC", "Implied", none());
    this.emit("LDA", "Immediate", imm8(0x00));
    const lo = this.rightSource(src, 0);
    this.emit("SBC", lo.mode, lo.operand);
    this.emit("STA", "Absolute", symAt(home, 0));
    this.emit("LDA", "Immediate", imm8(0x00));
    const hi = this.rightSource(src, 1);
    this.emit("SBC", hi.mode, hi.operand);
    this.emit("STA", "Absolute", symAt(home, 1));
    this.clearRegs();
  }

  /** Bitwise complement: `EOR #$FF` in A (8-bit) or per byte through the home. */
  private translateNot(
    dest: ILOperand,
    src: ILOperand,
    type: ILType,
    index: number,
    all: readonly ILInstruction[],
  ): void {
    if (type.width === 8) {
      this.leftIntoA(src);
      this.emit("EOR", "Immediate", imm8(0xff));
      this.bindA(asTempId(dest));
      return;
    }
    const home = this.foldStoreHome(dest, index, all);
    if (home === null) {
      this.iceUnsupported("word complement result not consumed by a store");
      return;
    }
    for (const i of [0, 1] as const) {
      this.wordLeftByteIntoA(src, i);
      this.emit("EOR", "Immediate", imm8(0xff));
      this.emit("STA", "Absolute", symAt(home, i));
    }
    this.clearRegs();
  }

  /**
   * Zero-extension. A memory-homed or immediate byte source folds away
   * entirely: consumers read the low byte from the source and the high byte
   * as the constant 0 (see {@link byteRefOf}). An A-resident source binds
   * A:X with a zero high byte for the store/return consumers.
   */
  private translateZext(dest: ILOperand, src: ILOperand): void {
    const destId = asTempId(dest);
    if (this.byteRefOf(src, 0) !== null) {
      this.convSource.set(destId, src);
      return; // zero instructions — the fold serves every per-byte reader
    }
    this.leftIntoA(src);
    this.emit("LDX", "Immediate", imm8(0x00));
    this.bindA(destId);
    this.bindX(destId);
  }

  /**
   * Sign-extension through the consuming store's home: store the low byte,
   * then compute the sign byte branch-free — `ASL A` moves the sign into
   * carry, `LDA #$00 · ADC #$FF` yields $00/$FF inverted, and the closing
   * `EOR #$FF` corrects it to $00 (positive) / $FF (negative).
   */
  private translateSext(
    dest: ILOperand,
    src: ILOperand,
    index: number,
    all: readonly ILInstruction[],
  ): void {
    const home = this.foldStoreHome(dest, index, all);
    if (home === null) {
      this.iceUnsupported("word sign-extension result not consumed by a store");
      return;
    }
    this.leftIntoA(src);
    this.emit("STA", "Absolute", symAt(home, 0));
    this.emit("ASL", "Accumulator", none());
    this.emit("LDA", "Immediate", imm8(0x00));
    this.emit("ADC", "Immediate", imm8(0xff));
    this.emit("EOR", "Immediate", imm8(0xff));
    this.emit("STA", "Absolute", symAt(home, 1));
    this.clearRegs();
  }

  /** Truncation 16→8: read the source's LOW byte only (0 instructions when in A). */
  private translateTrunc(dest: ILOperand, src: ILOperand): void {
    const destId = asTempId(dest);
    if (isTemp(src) && this.regA === src.id) {
      this.bindA(destId); // the word's low byte is already in A
      return;
    }
    const ref = this.byteRefOf(src, 0);
    if (ref === null) {
      this.iceUnsupported("trunc of a value without a memory home");
      return;
    }
    this.emit("LDA", ref.mode, ref.operand);
    this.bindA(destId);
  }

  /** Same-width re-type: bring the value into A (byte) or A:X (word), re-bind. */
  private translateCopy(dest: ILOperand, src: ILOperand): void {
    const destId = asTempId(dest);
    if (widthOf(dest) === 8) {
      this.leftIntoA(src);
      this.bindA(destId);
      return;
    }
    this.bringValueIntoRegisters(src, 16);
    this.bindA(destId);
    this.bindX(destId);
  }

  // ── mul / div / mod (call-site) ──────────────────────────────────────────────

  private translateMul(
    dest: ILOperand,
    left: ILOperand,
    right: ILOperand,
    type: ILType,
    index: number,
    all: readonly ILInstruction[],
  ): void {
    this.protectA();
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
        return;
      }
    }
    // (3) Runtime multiply → JSR __rt_mul8/16 with full operand marshalling.
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
    // runtime routine (no separate __rt_mod* symbols exist).
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
   * Verify the routine's ZP arg-block requirement against the target profile.
   * When the requirement exceeds `opts.zpArgBlockSize`, emits E10044 and
   * returns `false` — the caller poisons the statement (skips emission). When
   * no size was threaded (bare `generateInstr` callers) the check is skipped.
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
   * Emit a fully-marshalled operator-backing runtime call — both operands are
   * marshalled (not just the left one).
   *
   * Byte ops: `left`→A, `right`→X. Word ops: `right`→`__zp_arg_0/1` (the SFA
   * allocator's existing arg-block symbols) first — the loads clobber
   * A — then `left`→A(lo)/X(hi) via direct LDA/LDX so the registers hold the
   * first operand at the call. Results: the routine's return register(s) bind
   * to `dest` (`word` returns in A/X, `byte` in A); `result: "remainder"`
   * selects the modulo return instead — X→A for `__rt_div8`, `__zp_arg_0/1`
   * for `__rt_div16`.
   *
   * @param descriptor The T3 routine descriptor (name, ABI, ZP requirement).
   * @param left The first operand (register-passed).
   * @param right The second operand (register or ZP arg-block).
   * @param dest The IL destination temp the result binds to.
   * @param result Which return value binds: the primary value or the remainder.
   * @param width The operation width (8 or 16).
   * @returns Whether the call was emitted (`false` → E10044 poison).
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
      return false; // poisoned: statement dropped, compilation continues
    }
    if (width === 8) {
      this.leftIntoA(left);
      const r = this.rightSource(right, 0);
      this.emit("LDX", r.mode, r.operand);
      this.emit("JSR", "Absolute", labelRef(descriptor.name));
      this.clearRegs();
      if (result === "remainder") {
        this.emit("TXA", "Implied", none()); // remainder returns in X
        this.bindA(asTempId(dest));
      } else if (descriptor.signature.returnType === "word") {
        this.bindA(asTempId(dest)); // product lo→A, hi→X
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
      // div16 leaves the remainder in the arg-block (overwriting b).
      this.emit("LDA", "Absolute", symbolRef("__zp_arg_0"));
      this.emit("LDX", "Absolute", symbolRef("__zp_arg_1"));
    }
    this.bindA(asTempId(dest)); // word result lo→A, hi→X
    this.bindX(asTempId(dest));
    return true;
  }

  // ── Indexed memory (tier-1 `abs,X` framings) ─────────────────────────────────

  /**
   * Spill a live, memory-less temp out of A before an operation that will
   * clobber the accumulator. Without this, the temp's only copy dies and its
   * later consumer fails in the register binder — spilling to a zero-page
   * scratch slot keeps it readable.
   */
  private protectA(): void {
    const id = this.regA;
    if (id === null) return;
    if ((this.remainingUses.get(id) ?? 0) <= 0) return; // dead — nothing to save
    if (this.loadSource.has(id)) return; // memory-homed — reloadable
    this.binder.spill({ kind: "temp", id, type: { width: 8, signed: false } }, (e) =>
      this.out.push(e),
    );
    this.regA = null;
  }

  /**
   * Bring the (byte-offset) index into X. Loading X invalidates any word
   * high byte mirrored there, so the mirror is cleared FIRST — a stale read
   * afterwards fails loudly in the binder instead of silently reading the
   * index as data.
   */
  private indexIntoX(index: ILOperand): void {
    this.regX = null;
    if (isAddr(index)) {
      this.iceUnsupported("addr operand outside a store source or ALU right operand");
      return;
    }
    if (isImmediate(index)) {
      this.emit("LDX", "Immediate", imm8(index.value & 0xff));
      return;
    }
    if (isAddrByte(index)) {
      // A block number indexing a table is an ordinary byte; the assembler
      // supplies its value the same way it supplies any other immediate.
      this.emit("LDX", "Immediate", this.instrOperandFor(index));
      return;
    }
    if (isTemp(index)) {
      if (this.regA === index.id) {
        this.emit("TAX", "Implied", none());
        return;
      }
      const home = this.sourceHome(index);
      if (home !== null) {
        this.emit("LDX", "Absolute", symAt(home, 0));
        return;
      }
      // Spilled temp — read its zero-page scratch home.
      this.emit("LDX", "ZeroPage", this.binder.operandFor(index));
      return;
    }
    if (isLocation(index)) {
      this.emit("LDX", "Absolute", symHome(index, 0));
      return;
    }
    this.iceUnsupported("indexed access with a non-value index operand");
  }

  /**
   * `load_indexed value, base, index` — tier-1 `abs,X` read.
   *
   * Byte: `LDX <index>` → `LDA base+k,X`, then the result is HOMED — folded
   * into the consuming store when one immediately follows, spilled to a
   * zero-page scratch slot otherwise — so a consumer that needs A (e.g. the
   * accumulation `sum = sum + a[i]`) never destroys the only copy.
   *
   * Word: both bytes stash straight to the consuming store's home
   * (`LDA base+k,X / STA lo` then `LDA base+k+1,X / STA hi`), mirroring the
   * word-ALU discipline; a word read with no consuming store is rejected.
   */
  private translateLoadIndexed(
    value: ILOperand,
    base: ILOperand,
    index: ILOperand,
    at: number,
    all: readonly ILInstruction[],
  ): void {
    if (!isTemp(value) || !isLocation(base)) {
      this.iceUnsupported("load_indexed (non-temp value or non-location base)");
      return;
    }
    this.protectA();
    this.indexIntoX(index);

    if (value.type.width === 8) {
      this.emit("LDA", "AbsoluteX", symHome(base, 0));
      this.bindA(value.id);
      const home = this.foldStoreHome(value, at, all);
      if (home !== null) {
        this.emit("STA", "Absolute", symAt(home, 0));
        return;
      }
      if ((this.remainingUses.get(value.id) ?? 0) > 0) {
        this.binder.spill(value, (e) => this.out.push(e));
        this.regA = null;
      }
      return;
    }

    const home = this.foldStoreHome(value, at, all);
    if (home === null) {
      this.iceUnsupported("word indexed load not consumed by a store");
      return;
    }
    this.emit("LDA", "AbsoluteX", symHome(base, 0));
    this.emit("STA", "Absolute", symAt(home, 0));
    this.emit("LDA", "AbsoluteX", symHome(base, 1));
    this.emit("STA", "Absolute", symAt(home, 1));
    this.clearRegs();
  }

  /**
   * `store_indexed value, base, index` — tier-1 `abs,X` write.
   *
   * Byte: the value reaches A (immediates load AFTER `LDX` — an A load never
   * touches X), then `STA base+k,X`. When the value already sits in A and the
   * index does not need A, the index loads around it.
   *
   * Word: the source must be readable from MEMORY (home or immediate) —
   * `LDX <index>` physically destroys an X-resident high byte, so a
   * register-resident word source is rejected loudly rather than silently
   * storing the index as data. Then lo/hi each `LDA` + `STA base+k(+1),X`.
   */
  private translateStoreIndexed(value: ILOperand, base: ILOperand, index: ILOperand): void {
    if (!isLocation(base)) {
      this.iceUnsupported("store_indexed (non-location base)");
      return;
    }
    const width = widthOf(value);

    if (width === 8) {
      const valueInA = isTemp(value) && this.regA === value.id;
      const indexNeedsA = isTemp(index) && this.regA === index.id;
      if (valueInA && !indexNeedsA) {
        this.indexIntoX(index);
        this.emit("STA", "AbsoluteX", symHome(base, 0));
        return;
      }
      this.indexIntoX(index);
      this.leftIntoA(value);
      this.emit("STA", "AbsoluteX", symHome(base, 0));
      return;
    }

    // Word: the source must have a memory home or be an immediate.
    if (isImmediate(value)) {
      this.indexIntoX(index);
      this.emit("LDA", "Immediate", imm8(value.value & 0xff));
      this.emit("STA", "AbsoluteX", symHome(base, 0));
      this.emit("LDA", "Immediate", imm8((value.value >> 8) & 0xff));
      this.emit("STA", "AbsoluteX", symHome(base, 1));
      this.clearRegs();
      return;
    }
    const home = this.sourceHome(value);
    if (home === null) {
      this.iceUnsupported(
        "word indexed store from a register-resident value (assign it to a variable first)",
      );
      return;
    }
    this.indexIntoX(index);
    this.emit("LDA", "Absolute", symAt(home, 0));
    this.emit("STA", "AbsoluteX", symHome(base, 0));
    this.emit("LDA", "Absolute", symAt(home, 1));
    this.emit("STA", "AbsoluteX", symHome(base, 1));
    this.clearRegs();
  }

  /**
   * The pointer operand of an indirect access must be a location naming a
   * zero-page pair the plan actually reserved — anything else is a lowering
   * contract violation or a reservation/demand drift, reported loudly rather
   * than emitted as a dangling symbol.
   */
  private indirectPair(ptr: ILOperand): Extract<ILOperand, { kind: "location" }> | null {
    if (!isLocation(ptr)) {
      this.iceUnsupported("indirect access with a non-location pointer operand");
      return null;
    }
    if (!this.plan.symbolDefinitions.some((s) => s.name === ptr.symbol)) {
      this.bag.addICE(
        IceCode.Unexpected,
        null,
        `IL→Instr: indirect staging demanded but no '${ptr.symbol}' pair reserved`,
      );
      return null;
    }
    return ptr;
  }

  /**
   * Bring the indirect access's byte offset into Y. The mirror suppresses a
   * redundant `LDY` when Y already holds the same immediate or temp; `TAY`
   * serves an A-resident temp (A stays intact — Y is not an accumulator).
   */
  private offsetIntoY(offset: ILOperand): void {
    if (isImmediate(offset)) {
      if (this.regY?.kind === "imm" && this.regY.value === (offset.value & 0xff)) {
        return;
      }
      this.emit("LDY", "Immediate", imm8(offset.value & 0xff));
      this.regY = { kind: "imm", value: offset.value & 0xff };
      return;
    }
    if (isTemp(offset)) {
      if (this.regY?.kind === "temp" && this.regY.id === offset.id) {
        return;
      }
      if (this.regA === offset.id) {
        this.emit("TAY", "Implied", none());
        this.regY = { kind: "temp", id: offset.id };
        return;
      }
      const home = this.sourceHome(offset);
      if (home !== null) {
        this.emit("LDY", "Absolute", symAt(home, 0));
      } else {
        this.emit("LDY", "ZeroPage", this.binder.operandFor(offset));
      }
      this.regY = { kind: "temp", id: offset.id };
      return;
    }
    if (isLocation(offset)) {
      this.emit("LDY", "Absolute", symHome(offset, 0));
      this.regY = null; // a raw location read carries no reusable identity
      return;
    }
    this.iceUnsupported("indirect access with a non-value offset operand");
  }

  /**
   * `load_indirect value, ptr, offset` — the `(zp),Y` read through a bound
   * pair or the formation scratch.
   *
   * Byte: `LDY <offset>` (mirror-suppressed) → `LDA (pair),Y`, then the 7a
   * homing ladder — folded into the consuming store, spilled when uses
   * remain. Word: only when consumed by an immediate store (the word-load
   * discipline): lo → home, `INY` (mirror invalidated), hi → home+1. The
   * lowering predicate keeps word offsets ≤ 254; the guard here is the drift
   * backstop (an `INY` from `#$FF` would wrap Y to 0 and read pointee+0).
   */
  private translateLoadIndirect(
    value: ILOperand,
    ptr: ILOperand,
    offset: ILOperand,
    at: number,
    all: readonly ILInstruction[],
  ): void {
    const pair = this.indirectPair(ptr);
    if (pair === null) return;
    if (!isTemp(value)) {
      this.iceUnsupported("load_indirect (non-temp value)");
      return;
    }

    if (value.type.width === 8) {
      this.protectA();
      this.offsetIntoY(offset);
      this.emit("LDA", "IndirectY", symbolRef(pair.symbol));
      this.bindA(value.id);
      const home = this.foldStoreHome(value, at, all);
      if (home !== null) {
        this.emit("STA", "Absolute", symAt(home, 0));
        return;
      }
      if ((this.remainingUses.get(value.id) ?? 0) > 0) {
        this.binder.spill(value, (e) => this.out.push(e));
        this.regA = null;
      }
      return;
    }

    if (!isImmediate(offset) || offset.value > 254) {
      this.iceUnsupported("word indirect load at an offset beyond the INY-safe range");
      return;
    }
    const home = this.foldStoreHome(value, at, all);
    if (home === null) {
      this.iceUnsupported("word indirect load not consumed by a store");
      return;
    }
    this.offsetIntoY(offset);
    this.emit("LDA", "IndirectY", symbolRef(pair.symbol));
    this.emit("STA", "Absolute", symAt(home, 0));
    this.emit("INY", "Implied", none());
    this.regY = null; // Y advanced past the mirrored offset
    this.emit("LDA", "IndirectY", symbolRef(pair.symbol));
    this.emit("STA", "Absolute", symAt(home, 1));
    this.clearRegs();
  }

  /**
   * `store_indirect value, ptr, offset` — the `(zp),Y` write.
   *
   * Byte: the value-in-A fast path stores around the `LDY` (an `LDY` never
   * clobbers A); otherwise Y first, then the value into A. Word: the source
   * must be an immediate or memory-readable — lo/`INY`/hi — and a
   * register-resident word is rejected loudly (the `INY` sequencing cannot
   * preserve A:X). Same ≤254 offset backstop as the load.
   */
  private translateStoreIndirect(value: ILOperand, ptr: ILOperand, offset: ILOperand): void {
    const pair = this.indirectPair(ptr);
    if (pair === null) return;
    const width = widthOf(value);

    if (width === 8) {
      const valueInA = isTemp(value) && this.regA === value.id;
      if (valueInA) {
        this.offsetIntoY(offset);
        this.emit("STA", "IndirectY", symbolRef(pair.symbol));
        return;
      }
      if (isAddr(value)) {
        this.iceUnsupported("addr operand outside a store source or ALU right operand");
        return;
      }
      this.offsetIntoY(offset);
      this.leftIntoA(value);
      this.emit("STA", "IndirectY", symbolRef(pair.symbol));
      return;
    }

    if (!isImmediate(offset) || offset.value > 254) {
      this.iceUnsupported("word indirect store at an offset beyond the INY-safe range");
      return;
    }
    if (isImmediate(value)) {
      this.offsetIntoY(offset);
      this.emit("LDA", "Immediate", imm8(value.value & 0xff));
      this.emit("STA", "IndirectY", symbolRef(pair.symbol));
      this.emit("INY", "Implied", none());
      this.regY = null;
      this.emit("LDA", "Immediate", imm8((value.value >> 8) & 0xff));
      this.emit("STA", "IndirectY", symbolRef(pair.symbol));
      this.clearRegs();
      return;
    }
    const home = this.sourceHome(value);
    if (home === null) {
      this.iceUnsupported(
        "word indirect store from a register-resident value (assign it to a variable first)",
      );
      return;
    }
    this.offsetIntoY(offset);
    this.emit("LDA", "Absolute", symAt(home, 0));
    this.emit("STA", "IndirectY", symbolRef(pair.symbol));
    this.emit("INY", "Implied", none());
    this.regY = null;
    this.emit("LDA", "Absolute", symAt(home, 1));
    this.emit("STA", "IndirectY", symbolRef(pair.symbol));
    this.clearRegs();
  }

  // ── Register-state mirror (the binder is the allocation seam) ─────────────────


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
    this.regY = null;
  }

  // ── Emission ─────────────────────────────────────────────────────────────────

  /** Emit one instruction, attaching the pending lead span to the first only. */
  private emit(opcode: Opcode, mode: AddressingMode, operand: InstrOperand): void {
    if (this.leadSpan !== undefined) {
      this.out.push(instr(opcode, mode, operand, this.leadSpan));
      this.leadSpan = undefined;
      return;
    }
    this.out.push(instr(opcode, mode, operand));
  }

  /** Raise the deferred/unsupported-op ICE and emit nothing for it. */
  private iceUnsupported(what: string): void {
    this.bag.addICE(
      IceCode.Unexpected,
      null,
      `IL→Instr: unsupported op '${what}' — not yet implemented`,
    );
  }

  /**
   * Raise the ICE for a construct the translator has no encoding for yet.
   * Distinct from {@link iceUnsupported}, whose message names a specific
   * deferred instruction-level work item.
   */
  private iceNoTranslation(what: string): void {
    this.bag.addICE(IceCode.Unexpected, null, `IL→Instr: no translation for '${what}'`);
  }

  /**
   * Raise the dangling-branch-target ICE. Recorded rather than thrown, like
   * every translator ICE, so one malformed function does not hide the
   * diagnostics of the rest of the program.
   */
  private iceDanglingTarget(target: string, fromBlock: string, kind: string): void {
    this.bag.addICE(
      IceCode.Unexpected,
      null,
      `IL→Instr: terminator target '${target}' resolves to no block ` +
        `(function '${this.fn.name}', block '${fromBlock}', ${kind})`,
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

/** The temp id an instruction defines (its destination), or `null`. */
function destTempId(ins: ILInstruction): number | null {
  switch (ins.op) {
    case "load":
      return isTemp(ins.a) ? ins.a.id : null;
    case "load_indexed":
    case "load_indirect":
      // The loads carry their destination in `value` — without this arm the
      // generic `"dest" in ins` fallback would miss the def entirely (the
      // prescan would count the destination as a READ and the call guard
      // could not see the result's liveness).
      return isTemp(ins.value) ? ins.value.id : null;
    case "store":
    case "store_indexed":
    case "store_indirect":
    case "source_span":
      return null;
    case "call":
    case "intrinsic":
      return ins.dest !== undefined && isTemp(ins.dest) ? ins.dest.id : null;
    default:
      return "dest" in ins && isTemp(ins.dest) ? ins.dest.id : null;
  }
}

/**
 * The operands a block terminator reads. These count toward the use tally that
 * gates the single-use load fold, so a terminator whose reads are missed here
 * would let a fold fire on a value that is in fact read twice.
 */
function terminatorReads(term: ILTerminator): readonly ILOperand[] {
  switch (term.kind) {
    case "ret":
      return term.value !== undefined ? [term.value] : [];
    case "brcond":
      return [term.cond];
    case "brcmp":
      return [term.left, term.right];
    case "br":
    case "unreachable":
      return [];
    default: {
      // Exhaustiveness guard: a new terminator kind without a case here is a
      // compile error, never a silently under-counted read.
      const _exhaustive: never = term;
      return _exhaustive;
    }
  }
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

/** The read operands of an instruction (for the use-count pre-scan). */
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
      return [ins.base, ins.index]; // `value` is the DESTINATION, not a read
    case "store_indexed":
      return [ins.base, ins.index, ins.value];
    case "load_indirect":
      return [ins.ptr, ins.offset]; // `value` is the DESTINATION, not a read
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

/** The special ACME label for the program entry point. */
const ENTRY_LABEL = "_main";

/**
 * The ACME-legal label for a function stream:
 *   - the unique entry function (fqName whose bare name is `main`) → `_main`,
 *     resolving the c64 startup shim's `JSR _main`;
 *   - every other `Module.function` → `Module_function` (`.`→`_`).
 *
 * Only `[A-Za-z0-9_]` survive the `.`→`_` rewrite, so the result is always a legal
 * ACME label; the `__` prefix stays reserved for compiler-generated symbols (frame
 * homes, startup, the module-initializer routine). The one `__`-prefixed name
 * this function passes through is the compiler's own `__init` stream — a
 * dot-free generated name, unchanged by the rewrite.
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
 * is `main`. Multiple/zero `main` functions are a semantic error caught
 * upstream in the frontend (E10020/E10021); this maps purely by bare name.
 *
 * @param fqName The fully-qualified function name (`"Module.function"`).
 * @returns `true` when the bare name is `main`.
 */
function isEntryFunction(fqName: string): boolean {
  const dot = fqName.lastIndexOf(".");
  const bare = dot >= 0 ? fqName.slice(dot + 1) : fqName;
  return bare === ENTRY_FUNCTION;
}
