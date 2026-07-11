# IL→Instr Translation: RD-18 Slice 6

> **Document**: 03-04-translate.md
> **Parent**: [Index](00-index.md)

## Overview

Retires the deferred-op ICEs Slice 6's IL now reaches: `neg`, `not`, `zext`, `sext`,
`trunc`, the four comparison framings (byte/word × unsigned/signed — AR-1/AR-9,
closing DEF-1/AR-5), and word + variable-count shifts. All sequences are NMOS-legal
(no variant gating). Existing fold machinery (single-use loads, word store-fold) is
reused; no new architecture.

## Implementation Details

### 1. Unary ops

**`neg` (8-bit)** — two's complement in A:
`leftIntoA(src)` → `EOR #$FF` → `CLC` → `ADC #$01` → `bindA(dest)`.

**`neg` (16-bit)** — `0 − x` with borrow, via the word store-fold home (like word
bitwise, `foldStoreHome`; no home → the existing "word result not consumed by a
store" ICE):
`SEC` → `LDA #$00` → `SBC src+0` → `STA home+0` → `LDA #$00` → `SBC src+1` →
`STA home+1` → `clearRegs()`.

**`not` (8-bit)** — `leftIntoA(src)` → `EOR #$FF` → `bindA(dest)`.
**`not` (16-bit)** — per-byte `EOR #$FF` through the store-fold home.

### 2. Conversions

**`zext`** — 8→16, high byte zero. Byte source into A; word consumer home:
`STA home+0` → `LDA #$00` → `STA home+1`. When the consumer is a `store` the fold
home IS the destination (word store-fold path); otherwise A:X binding
(`TAX`-free form: load low into A, `LDX #$00`, bind pair).

**`sext`** — 8→16 sign-propagating:
`leftIntoA(src)` → `STA home+0` → `LDA #$00` → *(A=0)* → `BIT home+0`? No — the
canonical branchless-ish NMOS form used here (7 bytes, no flags dependency on the
store):
```
LDA src        ; low byte (or already in A)
STA home+0
ASL A          ; sign bit -> carry
LDA #$00
ADC #$FF       ; A = $FF + carry: sign 1 -> $00+? …
EOR #$FF       ; -> $00 if positive, $FF if negative
STA home+1
```
*(Sequence pinned at implementation with an exhaustive 0–255 impl test — the doc
requirement is: branch-free or short-branch, NMOS-legal, byte-exact-deterministic;
the golden pins whatever lands.)*

**`trunc`** — 16→8: read the source's LOW byte (`symAt(home,0)` / immediate low /
A-mirror) into A, `bindA(dest)`. Zero instructions when the low byte is already in A.

### 3. Comparisons — four framings (AR-1, AR-9)

`translateComparison` dispatches on the instruction's `type` (now the OPERAND type):

| Framing | eq/ne | Ordered |
|---------|-------|---------|
| 8-bit unsigned | existing CMP+BEQ/BNE materialization (unchanged — golden-protected) | existing CMP carry framing (unchanged) |
| 8-bit signed | same CMP (bit equality) | SEC · SBC rhs · BVC skip · EOR #$80 · skip: BMI/BPL materialize — the standard N⊕V dance |
| 16-bit unsigned | OR-combine the two byte CMPs (lo, hi) into the Z decision, or chained BNE — pinned at impl | high-first CMP/SBC chain: CMP hi; BNE decide; CMP lo; decide on carry |
| 16-bit signed | as unsigned eq/ne | SBC-based with N⊕V on the high byte: SEC · lo SBC · hi SBC · BVC/EOR #$80 · sign decision |

All four materialize the 0/1 into A exactly like today (dest is a byte temp; the
flag-freshness rule from the 4a DEF-1 fix — branch on the fresh flag BEFORE any
`LDA` — carries over to every new framing). Word operands read through
`sourceHome`/`wordLeftByteIntoA`-style helpers; immediates split lo/hi as in the
existing word ALU paths.

**DEF-1 regression witness**: a translate-tier impl test proving a `word`-typed
`lt` on operands equal in the low byte but differing in the high byte yields the
correct 0/1 (the old code compared low bytes only — AR-5).

### 4. Shifts

**8-bit const count** — existing unrolled ASL/LSR (unchanged).
**8-bit signed `shr` (arithmetic)** — per count step: `CMP #$80` → `ROR A`
(sign-replicating right shift; count from the immediate).
**16-bit const count** — through the store-fold home, per step:
`shl`: `ASL home+0` → `ROL home+1`; `shr` unsigned: `LSR home+1` → `ROR home+0`;
`shr` signed: `LDA home+1` → `CMP #$80` → `ROR home+1` → `ROR home+0` (A untouched
variant pinned at impl).
**Variable count (8/16)** — count byte into X, guard `BEQ done`, loop the
single-step sequence with `DEX` / `BNE loop`. Counts ≥ width shift to 0/sign
naturally (deterministic; the W10174 warning is frontend-only and const-only).
Const count 0 emits nothing (value passes through).

### 5. Doc header
The module doc comment's live-op list is refreshed (the "deferred to a later slice"
sentences for these ops drop out); the deferred-ops ICE remains for
indexed/indirect memory ops (Slice 7).

## Integration Points

- Consumes 03-03's IL shapes; the slot `store`/`load` traffic needs zero new work
  (frame-symbol load/store is the original 3a path).
- `register-binding.ts` itself untouched — new ops use A and X plus memory homes;
  the X uses (`zext`'s `LDX #$00`, the variable-count shift loops) follow the
  existing register-mirror/`clearRegs` discipline.
- Warnings: none added at this layer (W10170/71 stay as-is).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Word unary/shift result not consumed by a store | existing word-fold ICE (conservative, never wrong) | AR-6 |
| Any op/width pair outside the table | existing deferred-op ICE | — |

## Testing Requirements

ST-28…ST-30 (07) pin end-to-end ASM landmarks via the golden. Impl tests: exhaustive
sext byte sweep, each comparison framing's boundary quads (0/1, $7F/$80, $FF/0;
word: $00FF/$0100, $7FFF/$8000), signed-shr sign retention, variable-shift zero-count
and ≥width behavior, the DEF-1 witness (§3).
