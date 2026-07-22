# Loop Exit (M-01): gated `brcmp` wrap check

> **Document**: 03-01-loop-exit.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 R1–R3; AR-1, AR-2, AR-10; AC-1…AC-5, AC-13
> **Design owner** for the wrap-exit mechanism. RD-01 AR-1/AR-2 own the *why*; this doc owns the
> *how* at the code seam.

## Overview

A `for` loop whose counter can pass its bound by **wrapping** rather than by reaching it never
terminates: the `cond` block's bound compare (`counter <= bound` / `>= bound`) can never go false.
The fix **supplements** the retained bound compare with a value-level wrap check in the `incr`
block, emitted **only** when the bound is not provably wrap-safe. Type-dispatch on `{width, sign}`
makes one form correct for `byte`/`word`/`sbyte`/`sword`.

## Architecture

### Current Architecture

`lowerFor` (`lower.ts:700-742`): `init → cond → body → incr → cond`. `cond` terminates on
`branchOnCounter` (`:841-861`, a type-stamped `brcmp le/ge`). `incr` runs `incrementCounter`
(`:864-883`: load `current`, `next = current ± step`, store `next`) then unconditionally
`br(condL)` (`:739`). The full-range guard (`:717-726`) ICEs on a `NumericLitExpr` type-max bound
only. See §02 for the grounded detail.

### Proposed Changes

Two coordinated changes across the frontend/codegen seam:

**1. Frontend — stamp the bound and a wrap-safe bit (AR-2, AR-P5).** In for-stmt typing
(`statement-typing.ts`, at the existing `evalConst(stmt.bound)` call `:798`), retain the evaluated
bound and compute `wrapSafe` for the loop, stamping both into the model for lowering to read. A
loop is **wrap-safe** iff the bound is statically known AND `bound ± step` stays within
`[typeMin, typeMax]` for the counter type and direction (`to` → `bound + step ≤ typeMax`;
`downto` → `bound − step ≥ typeMin`). A runtime bound is **never** wrap-safe (no static proof it
cannot equal the extreme) — RD R2/AR-2: *not provably below the wrap point*, never *provably
extreme*. This is new model state, not a reused hook (the `:798` result is discarded today).

**2. Codegen — gated wrap exit in `incr` (AR-1, AR-P3).** When the loop is **not** wrap-safe,
replace the `incr` block's unconditional `br(condL)` with a `brcmp` that exits on wrap:

- ascending (`to`): `brcmp lt(next, current)` → `trueTarget: endL`, `falseTarget: condL`
- descending (`downto`): `brcmp gt(next, current)` → `trueTarget: endL`, `falseTarget: condL`

`next` and `current` are the temps `incrementCounter` already holds live in the block (AR-P3 — no
scratch copy, no `next ∓ step` reconstruction). The `brcmp` is stamped with the **counter type**,
so signed dispatch (else M-01f) and the 16-bit high-byte shape (M-01e) fall out with no per-case
flag logic. When the loop **is** wrap-safe, `incr` keeps today's exact `br(condL)` — byte-identical
output (AC-12; slice4a `1 to 10`, slice7 `0 to 4`).

The full-range ICE guard (`:717-726`) is removed: a `0 to 255` literal is now wrap-unsafe, gets
the guard, terminates, and compiles (R3). The retained `cond` bound compare handles interior bounds
and the zero-trip case (init already past bound → `cond` falls straight to `endL`, body runs zero
times — RD R1 zero-trip invariant).

### Why the wrap check catches exactly the failing corner

| Case | `cond` bound compare | `incr` wrap check | Result |
| ---- | -------------------- | ----------------- | ------ |
| Interior, step divides range | fires normally | not emitted (wrap-safe) | unchanged |
| Interior, step escapes range (`0 to 254 step 2`) | never fires (counter steps past) | `next < current` after `254+2=0` → exit | terminates, no overshoot |
| Bound at extreme (`0 to 255`, `9 downto 0`) | never fires | wrap detected at the extreme step | terminates, visits bound once |
| Zero-trip (`9 to 0` ascending) | fires immediately → `endL` | n/a (body/incr never entered) | zero iterations |

## Implementation Details

### New / changed model state (frontend)

The for-loop model node gains (names indicative; final names are the executor's, following
existing model conventions):

```
ForModel {
  …existing…
  evaluatedBound?: number      // the const-folded bound, when statically known (AR-2)
  wrapSafe: boolean            // true → omit the wrap guard (AR-P5)
}
```

### Changed functions (codegen)

- `lowerFor` (`lower.ts:700-742`): drop the `:717-726` ICE guard; after `incrementCounter`,
  terminate `incr` with the gated wrap `brcmp` (below) instead of the unconditional `br(condL)`
  when `!wrapSafe`.
- `incrementCounter` (`:864-883`): return (or leave accessible) the `current` and `next` temps so
  the caller can build the wrap `brcmp` without reloading. No new load.
- New helper `wrapExitBranch(current, next, direction, counterType, condL, endL, ctx)`: emits the
  `brcmp lt/gt(next, current)` terminator. Type-stamped with `counterType`.

### Integration points

- Reads `wrapSafe`/`evaluatedBound` from the model (frontend → codegen), consistent with how
  `slotIlType`/`typeOf` already flow.
- No new IL terminator kind — reuses `brcmp` (`instruction.ts:160-185`); nothing crosses a
  basic-block boundary (`translate.ts:374-380` invariant preserved), because both operands are
  in-block temps.

## Code Examples

```
; incr block, wrap-unsafe ascending loop (schematic IL → asm)
  load  current, i
  add   next, current, #step
  store i, next
  brcmp lt(next, current) ? end : cond     ; NEW — exits when the step wrapped
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Full-range `0 to 255` literal (was ICE) | Wrap-unsafe → guard emitted → compiles and terminates | RD AR-1, AC-... (R3) |
| Non-literal `step` (named const / const-expr) | Out of scope — `constStep` still ICEs (RD-04); unchanged here | RD "Won't have" |
| Retained `CMP #$00 / BCC` survives on `downto 0`, voiding X-08 | P1 perturbs X-08, retightens signature to the wrap form | AR-P8 |

> **Traceability:** the wrap mechanism, the carry-exit rejection, and the emission-gating rule are
> resolved in RD-01 AR-1 (with AR-P3/AR-P5 for the plan-level how). The +1 load/compare per
> guarded iteration is the RD's owned scoreboard row (Notes) — recorded, not re-litigated.

## Testing Requirements

- Spec (`[CI]`): IL-level `brcmp` wrap-form assertion (AC-4); one end-to-end asm case with a small
  body (AC-4); oversized-body relaxation (AC-5); shape-match across the axis matrix (AC-1);
  four bound spellings + interior-escape probes (AC-3). See §07 ST-1…ST-16.
- Spec (`[local]`, VICE): termination + visit-count across the axes, exact iteration counts in a
  **word** counter (AC-1, AC-2).
- Golden: slice8b `copyBytes` re-golden is the committed idiom pin (AC-13); slice4a/slice7
  byte-identical is the gated-emission proof (AC-12).
- Unit pins that move: `control-flow-lowering.impl.test.ts:62-70` (+ boundary case), `:72-78`
  (ICE-expected flips at `:76-77`) — RD AR-10.
