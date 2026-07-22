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
block — a `brcmp` of the **post-step counter against a compile-time immediate** derived from the
step and the type extreme — emitted **only** when the bound is not provably wrap-safe. The compare
is stamped with the counter type, so one form is correct for `byte`/`word`/`sbyte`/`sword`.

> **Revised at preflight iteration 1 (PF-001).** The first design compared the post-step counter
> against the *pre-step* counter (`brcmp lt/gt(next, current)`). That is correct arithmetically but
> **cannot translate**: it makes both temps multi-use at the instruction seam, ICEing the word ALU
> (`translate.ts:760`, `foldStoreHome` single-use rule) and losing `current` on the byte path
> (`bindA` rebinds A with no spill), and the naïve reload silently disables the guard. The wrap test
> is now reconstructed from `next` alone against an immediate — see AR-P3 and §Proposed-Changes-2.

## Architecture

### Current Architecture

`lowerFor` (`lower.ts:700-742`): `init → cond → body → incr → cond`. `cond` terminates on
`branchOnCounter` (`:841-861`, a type-stamped `brcmp le/ge`). `incr` runs `incrementCounter`
(`:864-883`: load `current`, `next = current ± step`, store `next`) then unconditionally
`br(condL)` (`:739`). The full-range guard (`:717-726`) ICEs on a `NumericLitExpr` type-max bound
only. See §02 for the grounded detail.

### Proposed Changes

Two coordinated changes across the frontend/codegen seam:

**1. Frontend — stamp the bound and a wrap-safe bit; range-check the step (AR-2, AR-P5).** In
for-stmt typing (`statement-typing.ts`), evaluate the bound with the **resolver-backed const
engine** (`ctx.engine.evalExpr(bound, scope)` — the same scope-aware evaluator used at
`expression-typing.ts:1601`), **not** the bare `evalConst(stmt.bound)` at `:798`, which passes no
`resolveRef` and returns `nonConst` for every named-const / const-ref bound (`const-eval.ts:187`).
Using the bare form would stamp `wrapSafe = false` on provably-interior named-const loops
(`const N: byte = 10; for (i = 0 to N)`) and emit the guard on code that never wraps — a
meet-or-beat regression with no corpus red test (PF-010). Compute `wrapSafe` and stamp it plus the
evaluated bound into the model. A loop is **wrap-safe** iff the bound is statically known AND
`bound ± step` stays within `[typeMin, typeMax]` (`to` → `bound + step ≤ typeMax`; `downto` →
`bound − step ≥ typeMin`). A runtime bound is **never** wrap-safe. This is new model state, not a
reused hook.

Also **range-check the folded step against the counter type** here (PF-009). Today the step site
(`statement-typing.ts:810-825`) only asserts `step ≥ 1`; a literal `step ≥ 2^width` (e.g.
`for (i: byte = 0 to 10 step 256)`) folds to `imm` masked to width (`translate.ts:1048-1050`) →
effective step 0 → `next == current`, defeating **both** the bound compare and the wrap check — a
silent hang in the same class, uncaught by every other deliverable. **Extend `E10061`** (the
step-validity code, `StepValueNotPositive`) with this range case — a single code, its registry
comment updated to cover "positive AND ≤ typeMax" (PF-035) — emitted when the folded step exceeds
`typeMax` (the `range` for the counter type is already in scope at that site). This narrows
spec-legal input, so it is recorded durably (AR-P10 + a `codeops/00-spec-errata.md` note — PF-036),
not left to the ephemeral plan folder.

**2. Codegen — gated wrap exit in `incr`, reconstruction-immediate form (AR-1, AR-P3).** When the
loop is **not** wrap-safe, replace the `incr` block's unconditional `br(condL)` with a `brcmp` of
the post-step counter against a **compile-time immediate**:

- ascending (`to`, step `s`): wrap ⟺ `next < typeMin + s` → `brcmp lt(next, imm(typeMin + s))` → `trueTarget: endL`, `falseTarget: condL`
- descending (`downto`, step `s`): wrap ⟺ `next > typeMax − s` → `brcmp gt(next, imm(typeMax − s))` → `trueTarget: endL`, `falseTarget: condL`

> **The ascending immediate carries `typeMin` (PF-032, it.2).** The `brcmp` is signed-dispatched on
> the counter type, so a *signed* `lt` executes for `sbyte`/`sword`. For those, a non-wrapped
> post-step value lands in `[typeMin + s, typeMax]` — which includes negatives — while a wrapped one
> lands in `[typeMin, typeMin + s − 1]`; only `next < typeMin + s` separates them. Unsigned
> `typeMin = 0` degenerates to `next < s`, so byte/word are unchanged. Dropping `typeMin` (as the
> first revision did) makes a guarded ascending loop through negatives — e.g. `sbyte -5 to 127` —
> exit after one iteration. The descending form already uses the type extreme and is correct on all
> four types; only ascending needed the fix. **Both immediates assume `1 ≤ s ≤ typeMax`, enforced by
> the step range-check — the two are one invariant** (PF-046).

Only `next` is read (single-use into the compare → the deferred-load path folds it into `CMP` /
the word framing), so the shape **translates at every width with zero `translate.ts`/binder
changes** and costs exactly the RD-budgeted +1 load+compare. The immediate is derived per counter
type, so signed dispatch (else M-01f) and the 16-bit high-byte shape (M-01e) fall out of the
type-stamped compare. When the loop **is** wrap-safe, `incr` keeps today's exact `br(condL)` —
byte-identical output (AC-12; slice4a `1 to 10`, slice7 `0 to 4`).

> **Why immediate, not pre-step counter (PF-001).** Wrap on an unsigned add of a positive step `s`
> is exactly "the result landed below `s`" (ascending) or "above `typeMax − s`" (descending) — the
> pre-step value is not needed. Comparing against `current` instead would make `current` and `next`
> both multi-use, which the translator cannot honour (word ALU requires a single-use store-folded
> dest; the byte path spills nothing). The immediate form sidesteps the whole hazard.

The full-range ICE guard (`:717-726`) is removed: a `0 to 255` literal is now wrap-unsafe, gets
the guard, terminates, and compiles (R3). The retained `cond` bound compare handles interior bounds
and the zero-trip case (init already past bound → `cond` falls straight to `endL`, body runs zero
times — RD R1 zero-trip invariant).

### Why the wrap check catches exactly the failing corner

| Case | `cond` bound compare | `incr` wrap check | Result |
| ---- | -------------------- | ----------------- | ------ |
| Interior, step divides range | fires normally | not emitted (wrap-safe) | unchanged |
| Interior, step escapes range (`0 to 254 step 2`) | never fires (counter steps past) | after `254+2=0`, `next(0) < step(2)` → exit | terminates; body ran at 254 once, never at 0 |
| Bound at extreme (`0 to 255`, `9 downto 0`) | never fires | wrap detected at the extreme step | terminates, visits bound once |
| Zero-trip (`9 to 0` ascending) | fires immediately → `endL` | n/a (body/incr never entered) | zero iterations |

## Implementation Details

### New / changed model state (frontend → core)

`wrapSafe`/`evaluatedBound` are **whole-program model state on `@blend65/core`** — there is no
per-statement "for-loop node" to extend (`SemanticModel`, `core/src/semantics/semantic-model.ts:27-76`,
carries only whole-program maps). Add a **node-keyed map** (for-stmt AST node → `{ wrapSafe,
evaluatedBound? }`) to `SemanticModel`, mirror it in `createEmptyModel` (`:88-108`), thread it
through `TypeCheckContext` and the `analyze.ts` assembly (`:172-194`), and read it in `lower.ts`
via `ctx.model`. **This is a `packages/core` change** (impact was missed in the first draft — PF-003).

### Changed functions (codegen)

- `lowerFor` (`lower.ts:700-742`): drop the `:717-726` ICE guard; after `incrementCounter`,
  terminate `incr` with the gated wrap `brcmp` (below) instead of the unconditional `br(condL)`
  when `!wrapSafe`.
- New helper `wrapExitBranch(next, direction, step, counterType, condL, endL, ctx)`: emits
  `brcmp lt(next, imm(typeMin + step))` (ascending) / `brcmp gt(next, imm(typeMax − step))` (descending),
  type-stamped with `counterType`. Reads only `next` (the value `incrementCounter` already stored)
  — reloaded single-use so it folds into the compare; **no pre-step temp, no scratch**.

### Integration points

- Reads the wrap-safe map from `ctx.model` (frontend → codegen via core), consistent with how
  `slotIlType`/`typeOf` flow.
- No new IL terminator kind — reuses `brcmp` (`instruction.ts:160-185`); nothing crosses a
  basic-block boundary (`translate.ts:374-380` invariant preserved) — the compare's only value
  operand (`next`) is loaded fresh in the terminator's own block.
- **`translate.ts`-seam verification (AR-P3):** no translator change is expected, but the plan
  proves the emitted `brcmp lt/gt(next, imm)` lowers cleanly at byte **and** word width before the
  mechanism is trusted (the first design's failure was invisible at the IL level).

## Code Examples

```
; incr block, wrap-unsafe ascending loop, step s (schematic IL → asm)
  load  current, i
  add   next, current, #s
  store i, next
  load  next2, i                       ; FRESH single-use reload — keeps next2 single-use into the
                                        ; compare so it folds (else the add-dest goes multi-use → word ICE, PF-045)
  brcmp lt(next2, #(typeMin + s)) ? end : cond   ; NEW — post-step below typeMin+s ⇒ it wrapped
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Full-range `0 to 255` literal (was ICE) | Wrap-unsafe → guard emitted → compiles and terminates | RD AR-1; R3 (AC-1/AC-3) |
| Literal `step ≥ 2^width` (effective step 0) | Frontend range-check → `E10061` range diagnostic (PF-009) | RD R1; AC-3 |
| Non-literal `step` (named const / const-expr) | Out of scope — `constStep` still ICEs (RD-04); unchanged here | RD "Won't have" |
| Retained `CMP #$00 / BCC` survives on `downto 0`, voiding X-08 | P1 perturbs X-08, retightens signature to the wrap form | AR-P8 |

> **Traceability:** the wrap mechanism, the carry-exit rejection, and the emission-gating rule are
> resolved in RD-01 AR-1 (with AR-P3/AR-P5 for the plan-level how; AR-P3 reopened at preflight it.1).
> The +1 load/compare per guarded iteration is the RD's owned scoreboard row (Notes).

## Testing Requirements

- Spec (`[CI]`, **shape/gating only** — a CI codegen test cannot observe termination, AC-1's own
  oracle): IL-level `brcmp` wrap-form assertion (AC-4); the wrap guard is **present** on
  wrap-unsafe loops and **absent** on wrap-safe ones (gating); one end-to-end asm case asserting
  the wrap compare's taken edge resolves (through relaxation/inversion) to the loop-exit label and
  **exactly one** of its operand pair reads the counter slot, the other the immediate — never both
  the slot (PF-007/PF-034 — rules out the stale-reload trap, direction-tolerant across the `gt` swap);
  oversized-body relaxation (AC-5); the `[CI]`-observable half of the axis matrix per §07. Named-
  const interior bound emits **no** guard (PF-010); literal `step ≥ 2^width` diagnoses (PF-009).
- Spec (`[local]`, VICE — the only tier that observes behaviour): termination + exact visit-count
  across every axis incl. `sword`, held in a **word** accumulator (AC-1, AC-2; §07 ST-16L/ST-16C).
- Golden: slice8b `copyBytes` re-golden is the committed idiom pin (AC-13); slice4a/slice7
  byte-identical is the gated-emission proof (AC-12).
- Unit pins that move: `control-flow-lowering.impl.test.ts:62-70` (+ boundary case), `:72-78`
  (ICE-expected flips at `:76-77`) — RD AR-10.
