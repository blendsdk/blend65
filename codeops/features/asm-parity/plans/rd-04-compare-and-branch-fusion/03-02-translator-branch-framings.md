# Translator Branch-Form Framings: RD-04 Compare-and-Branch Fusion

> **Document**: 03-02-translator-branch-framings.md
> **Parent**: [Index](00-index.md)

## Overview

The five comparison framings gain a branch-form terminal: where the value form materializes 0/1
(`materialiseOnBranch` or the carry-based compact tail), the fused path emits
`<branch> → trueTarget` + `JMP falseTarget` (RD "All framings branch directly"). The value form
stays byte-identical — value contexts are untouched (RD AC-6).

## Architecture

### Current
`translateComparison` (`translate.ts:1022`) dispatches on width/signedness to emitters that all
end in 0/1 materialization + `bindA(dest)`; `translateTerminator`'s `brcond` (:555-558)
reload-retests. Operand plumbing: `leftIntoA`/`rightSource`/`wordLeftByteIntoA` accept
temp/immediate/location; `prescanAll` (:284) counts terminator reads via `terminatorReads` so
single-use loads defer (:588) and fold at the consumer.

### Proposed
`translateTerminator` gains a `brcmp` case dispatching to a branch-form twin of
`translateComparison`. Each framing is refactored into a **flag-producing core** (operand
staging + compare sequence — shared verbatim with the value form) and two tails:

- **value tail** — exactly today's materialization (unchanged bytes), or
- **branch tail** — `this.emit(<branch>, "Relative", labelRef(this.blockLabel(trueTarget)))` +
  `this.emit("JMP", "Absolute", labelRef(this.blockLabel(falseTarget)))`.

Sharing the core is what makes polarity divergence between the two forms structurally
impossible — one compare sequence, two consumers.

## Implementation Details

### Dispatch

```ts
case "brcmp":
  this.translateComparisonBranch(term.op, term.left, term.right, term.type,
                                 term.trueTarget, term.falseTarget);
  return;
```

`gt`/`le` keep the operand-swap framing (`translate.ts:1029-1033`) — swap operands, emitters
implement `lt`/`ge`/`eq`/`ne` only (RD Must-Have).

The same change closes `translateTerminator`'s switch with the repo's `default:` never-guard:
today the switch (`translate.ts:533-562`) has no `default` and returns `void`, so an unhandled
terminator kind silently emits nothing — control would fall into the next block's code. After
this task a future terminator kind is a compile error, never silent no-emission (the same
idiom the instruction switch already uses at `translate.ts:430`).

### Per-framing branch tails

| Framing (core unchanged) | Branch tail (post-swap `wantLess` per `translate.ts:1099`) |
| ------------------------ | ---------------------------------------------------------- |
| 8-bit unsigned / equality (`:1050-1073`) | `BEQ`/`BNE`/`BCC`(lt)/`BCS`(ge) → true · `JMP` false |
| 8-bit signed (`byteSignedOrdered` `:1093`) | after `SEC·SBC·BVC skip·EOR #$80·skip:` — `BMI`(less)/`BPL` → true · `JMP` false (RD AC-5) |
| 16-bit equality (`wordEquality` `:1113`) | internal `diff` label **becomes a real target** in branch form — a differing low byte already settles equality, so `BNE` goes straight to false (`eq`) or true (`ne`); the high-byte compare then `BEQ`/`BNE` → true · `JMP` false. Same bytes, one fewer label, 5 cycles cheaper on the differing-low path (3 for `ne`). The value form keeps the join — its 0/1 tail reads Z and both paths must reach it. *(Amended at execution: the original row kept the join in both forms, which emitted a branch-to-branch a hand-writing developer would not — plan-AR #10.)* |
| 16-bit unsigned (`wordUnsignedOrdered` `:1133`) | internal `trueL`/`falseL`/`endL` labels **become the real targets**: hi-CMP decides via `BCC`/`BNE` straight to true/false, lo-CMP `BCC`/`BCS` → true, fall into `JMP` false — the `LDA #$01/#$00` tails disappear (the Should-Have simplification, plan-AR #7) |
| 16-bit signed (`wordSignedOrdered` `:1173`) | after the `CMP lo · SBC hi · BVC/EOR` correction — `BMI`/`BPL` → true · `JMP` false |

Framing-internal labels that survive (`skip`, `diff`) keep using `nextCmpLabel`; branches to
block targets use `blockLabel`. These internal branches now jump to real block labels — the
knowingly widened branch-range surface (req-AR #25, #65 → #51).

### Register-residency and use-count semantics

- The branch tail calls **no** `bindA` — no 0/1 value exists (RD Technical Requirements). The
  word framings' existing `clearRegs()` stays; block-boundary reset (`resetBlockState`, :322)
  makes end-of-block state moot either way.
- `terminatorReads` gains `brcmp` → `[left, right]` so `prescanAll` counts them and the
  deferred single-use load folds into the compare — this is precisely what produces
  `LDA $D012 · CMP #$FB` with no intermediate temp traffic (RD AC-1/AC-7).
- `consumeReads` is invoked for the terminator's reads exactly as `brcond.cond` is today.

### MMIO discipline

The fused path changes only the flag-to-branch plumbing: operand staging (`leftIntoA` /
`rightSource`) is the SAME code the value form runs, so load count and order per evaluation are
unchanged by construction (RD Must-Have "MMIO discipline is preserved"; asserted by ST-7).

## Code Example

```asm
; if (sx < sy) — signed bytes, fused (RD AC-5)
    LDA sx_home
    SEC
    SBC sy_home
    BVC +
    EOR #$80
+   BMI Main_fn_L1      ; true target — real block label
    JMP Main_fn_L2      ; false target
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `brcmp` target missing | Caught by the 03-01 pre-pass before this code runs | plan-AR #2 |
| Terminator kind unhandled by the translator | `default:` never-guard closes `translateTerminator` (compile error; was a silent fall-through) | preflight PF-002 |
| Unsupported operand shape | Existing `iceUnsupported` conventions of the operand plumbing (unchanged) | — |

## Testing Requirements

- Spec: ST-10 (framing × polarity × operand order byte sequences, both branch senses —
  constructed IL, `translate.spec.test.ts`), ST-6 (value form byte-identical), ST-7 (MMIO).
- Impl: swapped-operand cases (`gt`/`le`), immediate vs memory right-hand sides, deferred-load
  folding into the compare, `_cmp` internal-label allocation.
