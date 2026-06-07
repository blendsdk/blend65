# Design: IL→Instr Translation (live op set)

> **Document**: 03-01-il-to-instr-translation.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-07 R17–R28, R32, R50–R51, R60 (live subset) · spec Ch 04 §3/§5, Ch 06 §6
> **Decisions**: D1 (slice), D3 (live set + ICE-default), D4 (mul/div/mod call-site), D5 (both widths), D7 (diagnostics)

## Overview

`instr/translate.ts` lowers one `ILFunction` into one `InstrStream` by visiting each
`BasicBlock`'s instructions in order and emitting `StreamEntry` records via RD-07a's `instr`/
`label` constructors. Control flow for the live set is trivial — every live `ILFunction` is
**single-block** ending in `ret` (RD-06 `lowerFunction`) — so this slice translates a flat
instruction list + one terminator. Multi-block CFG walking (`br`/`brcond`, block labels) is
RD-07c.

Translation is **deterministic** (R17): the same IL yields the same `StreamEntry` sequence.
Operand placement (which register a value is in) is owned by the **register binder**
(03-02), which the translator calls through a small interface; this document specifies the
**instruction shapes**, the binder specifies **where operands live**.

## Translator structure

```typescript
// instr/translate.ts  (internal; surfaced only via generateInstr)
interface TranslateCtx {
  readonly fn: ILFunction;
  readonly binder: RegisterBinder;     // 03-02 — temp → register/ZP slot
  readonly out: StreamEntry[];          // accumulating stream entries
  readonly bag: DiagnosticBag;          // ICEs (D7) + cost warnings (R60)
  leadSpan: SourceSpan | undefined;     // span to attach to the next lead Instr (R50)
}

export function translateFunction(fn: ILFunction, plan: AllocationPlan,
  cpuVariant: CpuVariant, bag: DiagnosticBag): InstrStream;
```

`translateFunction`:
1. emit a `label(sanitize(fn.name))` as the function's entry label;
2. for the single live block, `translateInstruction(instr, ctx)` for each instruction;
3. `translateTerminator(block.terminator, ctx)`;
4. return `{ symbol: fn.name, segment: "code", entries: ctx.out }`.

`translateInstruction` is a `switch (instr.op)`; every arm not listed below falls to the
**default arm** → `bag.addICE(IceCode.Unexpected, span, "IL→Instr: unsupported op '<op>' (deferred to RD-07c)")`
(D3/D7) and emits nothing, so the back end fails deterministically.

## Operand lowering (`ILOperand` → `InstrOperand` + addressing)

| `ILOperand` | Lowers to | Notes |
| ----------- | --------- | ----- |
| `imm(value, type)` | `imm8(value)` (8-bit) / byte-select pair (16-bit, see `const`) | R9 |
| `temp(id, type)` | the register/ZP slot the **binder** assigns (03-02) | not an `InstrOperand` literal — drives which register an instr reads/writes |
| `loc(name, type)` | `symbolRef(name)` with `Absolute`/`ZeroPage` mode | frame slot `__frame_*`, module var `__var_*`, or the `$HEX` address-symbol from `poke`/`peek` (renders verbatim) |

**Addressing-mode selection for a `loc`:** the slice uses `Absolute` for frame/module
symbols (the ACME label resolves the address; RD-09 may relax to zero-page later) and
`Absolute` for the `$HEX` address-symbols too (a `SymbolRef` whose name *is* `$D020` renders
as the literal address — RD-06 D9). A future ZP-residency optimization (using `ZeroPage`
when the plan places a symbol in zero page) is a peephole/RD-07c concern, not required for
correctness.

## Per-op translation rules

### `load` / `store` (R27/R28; FR-9/FR-10)

8-bit:
```
load  dest, [sym]   →   LDA sym        ; A ← [sym]   (dest bound to A)
store val,  [sym]   →   STA sym        ; [sym] ← A   (val already in A)
```
16-bit (`type` is `IL_WORD`/`IL_SWORD`):
```
load  dest, [sym]   →   LDA sym        ; lo
                        LDX sym+1      ; hi  (dest.hi bound to X)
store val,  [sym]   →   STA sym
                        STX sym+1
```
The `+1` is a `symbolRef(name, { offset: 1 })` → renders `sym+1` (RD-07a ST-S11).

### `const` (materialise; R28; FR-11)

```
const dest, imm(v:byte)   →   LDA #v               ; dest ← A
const dest, imm(v:word)   →   LDA #<v   LDX #>v     ; lo via byteSelect "low", hi "high"
```
16-bit immediates use `symbolRef`/`imm8` byte-select where the value is symbolic, or two
`imm8`s carrying the low/high bytes for a numeric literal. (Numeric 16-bit literal: low =
`v & 0xFF`, high = `v >> 8`.)

### Arithmetic `add` / `sub` (R18/R19/R20; FR-2/FR-3)

8-bit:
```
add dest,l,r  →  LDA l   CLC   ADC r   STA dest
sub dest,l,r  →  LDA l   SEC   SBC r   STA dest
```
16-bit:
```
add dest,l,r  →  LDA l_lo  CLC  ADC r_lo  STA dest_lo
                 LDA l_hi       ADC r_hi  STA dest_hi
sub dest,l,r  →  LDA l_lo  SEC  SBC r_lo  STA dest_lo
                 LDA l_hi       SBC r_hi  STA dest_hi
```
(`l`, `r`, `dest` resolve through the binder; a `loc`/`imm` operand uses `Absolute`/
`Immediate` directly without a preparatory load when it is the `ADC`/`SBC` source.)

### Bitwise `and` / `or` / `xor` (R19; FR-4)

```
and dest,l,r  →  LDA l   AND r   STA dest      (ORA for or, EOR for xor)
```
16-bit applies the logic op to each byte independently (no carry coupling).

### Shift `shl` / `shr` (R19; FR-5)

The live lowering's shift count is an operand. For a **constant** count `n` the slice emits
`n` × `ASL`/`LSR` on the value (8-bit accumulator form `ASL A`). For a **non-constant** count
the slice raises the deferred-op ICE (a variable-count shift loop is RD-07c — it is not in
the gate/slice-2 surface). This keeps the in-scope path simple and total; the ICE documents
the boundary.

### Comparison `eq/ne/lt/le/gt/ge` (R23, unsigned; FR-6)

Each produces a 0/1 `IL_BYTE` result in `dest`:
```
eq dest,l,r  →  LDA l   CMP r   ; Z=1 iff equal
                LDA #0          ; default false
                <branch-on-flag skips next>  BNE .ne / BEQ .eq ...
                LDA #1
            .done: STA dest
```
The slice uses the **flag→0/1 materialization** pattern (a short branch over `LDA #1`),
choosing the branch (`BEQ`/`BNE`/`BCC`/`BCS`) per op for the unsigned interpretation:
`eq`→`BEQ`, `ne`→`BNE`, `lt`→`BCC`, `ge`→`BCS`, and `gt`/`le` via the swapped-operand forms
of `lt`/`ge`. Signed comparison (N⊕V) is deferred (R23 signed) until signed comparison
lowering is exercised — the slice's comparison result type is already `IL_BYTE` (RD-06 R20).
The internal `.ne`/`.done` labels are function-unique generated labels (`_cmpN`).

### `mul` (R21, call-site; FR-7/FR-23; D4)

1. **Both operands constant** → compute at compile time, emit as a `const` (no runtime code).
2. **One operand a constant power-of-two `2^k`** → `k` × `ASL` (8-bit) / 16-bit shift
   sequence; emit **W10172** (shift-and-add multiply).
3. **Otherwise** → marshal operands per the runtime ABI, `JSR __rt_mul8` (8-bit) /
   `JSR __rt_mul16` (16-bit), result in A / A:X; emit **W10170** (runtime multiply).

### `div` / `mod` (R22, call-site; FR-8/FR-23; D4)

Always `JSR __rt_div8` / `JSR __rt_div16`; `div` takes the quotient return, `mod` the
remainder return; emit **W10171** (runtime divide). Routine **bodies** are RD-17 (AR-30) —
the call-site needs no routine present (ACME resolves the symbol at link; dead-strip drops
unused).

> The `__rt_*` operand-marshalling ABI (which bytes go in A/X/Y vs a ZP arg-block) is RD-17's
> AR-33. For the slice, the translator emits the documented minimal marshalling (operands to
> the runtime arg ZP slots, then `JSR`); if the lowered IL surfaces a marshalling shape the
> ABI does not yet pin, that is a surface-during-execution ambiguity → register.

### `ret` terminator (R32; FR-12)

```
ret           →  RTS                       (void)
ret v:byte    →  LDA v   RTS               (value in A)
ret v:word    →  LDA v_lo   LDX v_hi   RTS (value in A:X)
```
If `fn.isInterrupt`, the terminating `RTS` is emitted as `RTI` (R33). The interrupt
**prologue/epilogue** register-save sequence is RD-07c (no interrupt body is in the live set
yet) — but the `RTS`→`RTI` swap is correct and cheap to apply now, so it is included.

## Source-span propagation (R50/R51; FR-24)

RD-06 carries provenance; when a translated IL instruction has an associated `SourceSpan`,
the translator attaches it to the **lead** `Instr` of the emitted sequence (the first `LDA`/
`CMP`/`JSR`) via the `instr(..., sourceSpan)` constructor. Subsequent instructions in the
same sequence omit the span (R50 — only the lead needs it). The translator threads the
current span through `ctx.leadSpan`, set when a `source_span` provenance is seen and cleared
after the next lead emission.

## Determinism & validation

- **Determinism (R17/AC-06):** no map iteration, no nondeterministic ordering; operands are
  visited left-then-right (matching `lowerBinary`'s FN-10 left-first), labels are generated
  by a per-function counter. Same IL → same stream.
- **Post-translation validation (R61/FR-22):** `generateInstr` (03-03) runs RD-07a
  `validateStream` over each produced `InstrStream`; any illegal opcode+mode is a codegen
  bug → `E90001` ICE. The translator therefore only ever emits opcode+mode pairs the CPU
  table permits (every pattern above is NMOS-legal; `cpuVariant` only widens the set).

## Worked example (8-bit add, from RD-06 lowering of `a + b`)

IL (single block):
```
load t0, [__frame_M_f_a]
load t1, [__frame_M_f_b]
add  t2, t0, t1 : byte
store t2, [__frame_M_f_r]
ret
```
Translated stream (`printInstr`):
```
M.f:
    LDA __frame_M_f_a
    CLC
    ADC __frame_M_f_b
    STA __frame_M_f_r
    RTS
```
(The binder routes `t0` through A and folds the `load t1`+`add` into the `ADC` of the second
operand — see 03-02 for the redundant-load suppression that yields exactly this.)
