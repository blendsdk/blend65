# The finite-loop schedule for a loop that runs once, and the byte it reloads

> **Owner**: [#119](https://github.com/blendsdk/blend65/issues/119) · **Type**: Task
> **CodeOps Artifact Schema**: 1
> **Status**: In progress — Gap B delivered and under verification, Gap A measured and re-scoped
> **Progress**: 4/7 tasks
> **Last Updated**: 2026-11-26

## Tasks

| # | Task | State |
| --- | --- | --- |
| 1 | Measure both gaps on the current tree; correct the issue's stale figures and witness spellings | Done |
| 2 | Establish why each gap is refused, by spike and by the build's own decision record | Done |
| 3 | Lowering: hoist the proved invariant load into the preheader | Done — `machine/fixed-counter-invariant-load.ts` |
| 4 | Observer: accept the hoisted exact template and relocate the accumulator obligation | Done — `size-observer-register-counter.ts`, `size-observer-selected-loops.ts` |
| 5 | Public oracle authored independently, implementation-blind, with RED evidence | In progress |
| 6 | Implementation tests for the guards the public oracle cannot express | Pending |
| 7 | Independent reviews, complete gates, closeout and issue evidence | Pending |

## Both gaps reproduce exactly

The issue names two output gaps in the finite-loop schedule. Both reproduce on the
current tree at `balanced` and at `size`, from the issue's own witness:

```blend65
module Game;
let rows: byte[8] = [;0];
function work(): void {
  for (let i: word = 0; i < 1; i += 1) { rows[i] = 7; }
}
function main(): void { work(); }
```

```asm
  ldx #$00
  lda #$07
  sta rows,x
  inx
  cpx #$01
  bcc loop
  rts
```

That is the full schedule for a loop the compiler has already proved runs exactly
once. An expert writes `lda #$07 / sta rows / rts`: 6 bytes against 13.

Gap B reproduces in all three witnesses the issue lists. The body reloads an
invariant byte on every iteration — `lda #$07` or `lda value` — where the expert
loads A once before the loop and keeps it through `sta/inx/cpx/bcc`, none of which
touch the accumulator.

## The issue's absolute figures are stale; its relative figures are exact

| Quantity | Issue | Measured here |
| --- | ---: | ---: |
| One-trip routine work | 13 bytes | 13 bytes, confirmed |
| Expert equivalent | 6 bytes | 6 bytes, by hand |
| Complete PRG | 119 bytes | **128 bytes** (126 `programBytes` + the two-byte load header) |
| One-trip X PRG SHA-256 | `89629cce…` | **`fdc85ed2…`** |

The tree moved after the issue was filed, so this plan pins its own figures. A
spec author must work from these: the issue's would never go green.

## Gap B: the one gate, and the proof that already exists

### Measured cause

Hoisting the load is rejected by exactly one gate. A spike moved the leading body
`lda` into the preheader and rebuilt; the build's own decision record says:

```
selected: closed:original:compact-unrolled        (fallback, 198 bytes)
  x24  Selected loop body, storage or lifetime correspondence is unresolved
```

That is `size-observer-selected-loops.ts:689`, reached because
`registerCounterIndex` returns null. Its selected-side template at
`size-observer-register-counter.ts:333-342` is positionally exact:

```ts
const selected = [
  ["lda", source.mode, source.operand],
  ["sta", `absolute-${proof.representation}`, { kind: "label", label, offset: source.offset }],
];
const items = current.symbols[2]!.instructions;   // the body block
if (items.length !== template.length) return null;
```

Hoisting leaves one instruction in the body, the length check fails, and the whole
candidate becomes infeasible. The output does not get worse — it reverts to the
198-byte generic form, which is a 72-byte regression, so the gate is doing its job
and the template is the thing to extend.

### Every premise the hoist needs is already proved

This is why Gap B is small. `indexSource` and `synchronous` already establish, for
any loop that reaches this template:

| Premise the hoist needs | Already enforced by |
| --- | --- |
| The RHS is invariant | `indexSource` admits only a byte constant or a load of a module byte scalar (`size-observer-register-counter.ts:229-250`) |
| The RHS is not a volatile or MMIO read | `synchronous` admits only `SCALAR_OPERATIONS`; `memory-read` and `platform` are excluded |
| No interrupt can rewrite it between the hoisted load and the stores | `synchronous` rejects any program with `interruptRoutes` or a callable/interrupt root (`size-observer-selected-loops.ts:404-407`) |
| No aggregate alias can reach it | `indexSource:251-261` rejects the tuple if any reachable operation is an `aggregate`, or a pathed/non-scalar load or store other than this one |
| A is not written across the back edge | `selectFixedCounterHeaderState` has already removed the header's `lda #0 / sbc #0` under its own continuation proof, leaving `cpx`; `sta`/`inx`/`cpx`/`bcc` write no A |
| The loop runs at least once, so the hoisted load is not newly executed | `firstTestElided === true` is required by the template, and it is set only for a bottom-tested loop whose first test is proved true |

So the hoist adds no premise. It relocates one instruction inside a shape whose
invariance, synchrony and alias facts are already closed.

### The work

1. **Lowering** — a sibling of `selectFixedCounterHeaderState` in
   `machine/lower-control.ts` that hoists the proved invariant load from the body
   block to the end of the preheader. Same kind of proved block surgery, in the
   same family, next to the function whose removal of `lda #0 / sbc #0` is what
   makes A invariant in the first place. The lowering guard must stand alone and
   must exclude the asynchronous case itself rather than leaning on the observer,
   because a candidate that lowering makes unprovable is a regression even when it
   is not a miscompile.
2. **Observer** — a second accepted exact template: body `[sta label+offset,x]`
   with the `lda` verified at the tail of the preheader, and the typed
   observer-origin still carried by the last body instruction. Extended, not
   loosened: the current template stays the only one accepted for the unhoisted
   shape.

### What "packed offset N" actually means

The issue's witness table says "packed offset 1/127/255", and the first reading —
an initializer value, `let rows: byte[8] = [;255];` — is wrong. The offset is the
array's **displacement inside its enclosing object**, which is what puts a nonzero
figure on the generated store. The eligible shape needs the index last in the
place path, so the array sits behind padding in a struct rather than being a
struct field itself:

```blend65
struct Sheet { pad: byte[127]; row: byte[8]; }
let sheet: Sheet;
let value: byte = 128;
function work(): void {
  for (let i: word = 0; i < 4; i += 1) { sheet.row[i] = value; }
}
```

`sheet.row[i]` has the index last and the field first, so the displacement folds
into the store operand. `cells[i].field` would have the field last and is not this
shape at all.

### Delivered

All three witnesses the issue tabulates now emit the expert sequence:

```asm
  ldx #$00
  lda value            ; or lda #$07 — once, before the loop
loop:
  sta sheet + $007f,x
  inx
  cpx #$04
  bcc loop
  rts
```

| Witness | Displacement | Bound | Work bytes | Cycles before | Cycles after | Issue's target |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| constant 7 | 1 | 4 | 13 unchanged | 63 | **57** | 57 |
| global 255 | 255 | 8 | 14 unchanged | 135 | **107** | 107 |
| global 128 | 127 | 4 | 14 unchanged | 71 | **59** | 59 |

The cycle figures are derived from the emitted sequence, not copied: removing
`(trips - 1)` copies of a two-cycle immediate load gives 63 − 6 = 57, and of a
four-cycle absolute load gives 135 − 28 = 107 and 71 − 12 = 59. All three match
the issue's independently stated targets exactly, which is the strongest available
evidence that the transformation is the one specified rather than one that merely
looks similar.

`programBytes` is unchanged in every witness, as the issue requires.

### Non-regression

Nine canonical identities, three examples by three goals, are **byte-identical** to
the figures recorded before this work. So `none` is untouched — no counter is
selected there at all — and the three real programs' balanced and size output is
unchanged, because none of their loops is this exact shape.

Negative controls all keep today's output and keep their load inside the loop: the
RHS written by the loop itself, a volatile `peek($d012)` RHS, a computed RHS, the
counter as its own RHS, and a nested loop. Each is excluded before this work by
`indexSource` or by the five-block eligibility, so they are preserved-behavior
controls rather than evidence about the new guard.

### Disclosure: one guard has no output witness

The lowering guard refuses to hoist when the program installs an interrupt route
or exposes a callable or interrupt root. That condition is **not observable in the
output**, because `synchronous` already rejects the whole candidate for any such
program, so the fallback is identical with or without the guard.

It is kept deliberately. A lowering that emits an unsound construction and relies
on a later gate to reject it is sound only by accident, and the accident is one
relaxation of `synchronous` away from being a miscompile. Its witness belongs in
an implementation test, which can observe the lowering decision directly; the
public oracle cannot express it.

### The Y register is proved, but never as selected output

The issue says "Y is equivalent". It is, and it is covered — but not by anything
readable from a build artifact. The register is a whole-program selection
dimension that settles on X for every witness here, and an unselected candidate
emits nothing. What does cover it is the unit level: the existing observer
implementation test drives both policies directly, and its `y-first` cases pass
against the hoisted shape for bounds 1, 4 and 8 and for displacements 0, 1 and
255. So the public oracle asserts nothing about Y, deliberately, and the
implementation test is where Y is held.

### An existing implementation test had to change, and what that proved

`size-observer-register-index.impl.test.ts` pinned the body as `[lda, sta]`. It is
an implementation test, so it moves with the implementation: it now pins the body
as the store alone **and** the preheader as `[ldx #0, lda]`, which is strictly
stronger, because the old assertion could not say where the load went.

Six of its cases looked more alarming: tests that damage the typed observer origin
and require a rejection began reporting a proved result instead. They damage the
body instruction at index 1, which the hoisted body no longer has, so the mutation
had become a no-op. Corrected to index 0 — the store, which is where the origin
now lives — all six reject again. That is the check worth recording: the origin
bookkeeping is still load-bearing, and the failure was the test's hard-coded
position rather than a hole in the proof.

## Gap A: the named seam is right and the named change is not sufficient

The issue asks to extend the schedule in `machine/fixed-loop-selection.ts` "for
exact trip count one". That seam does hold the expansion machinery, and admitting
trip count one is a few lines. It does not produce the win.

### What the selection actually chose

For the bound-1 witness the selected candidate is
`closed:flat-eight-x-first:compact-unrolled`, so the flat-eight **policy** is
already live; the expansion is skipped only because `fixed-loop-selection.ts:128`
demands `exactIterations === 8`. The X counter that ships comes from the separate
`counterFacts` path, which admits any `bound <= 8`. That also resolves an apparent
contradiction: `counterFacts` is empty unless a non-`original` policy is selected,
yet a counter ships at `balanced` — because `balanced` runs the whole
size-selection search and a flat-eight policy won it.

### Measured: three gates, each behind the last

| Spike | Bound 1 outcome |
| --- | --- |
| Expansion admits trip count one | every non-`original` candidate **rejected**: "Conditional induction needs actual Original homes in both layouts"; falls back to the 198-byte form |
| …plus expanded loops excused from `originalInduction` | every candidate **rejected**: "Selected machine windows still have pending observers" |
| …plus `fixedLoopProofs` admitted there | build **fails**: `ARTIFACT_EVIDENCE: Artifact evidence preparation failed` |

The spikes were reverted and the baseline re-measured at 126 `programBytes`.

### Why

The expansion removes the loop's header and update blocks
(`fixed-loop-selection.ts:171-173`) and therefore excludes the loop from
`counterFacts` (`:199`). So the loop keeps its range-observer obligation and loses
its counter proof, landing in `remaining` at `size-observer-effects.ts:871`. And
`size-observers.ts:464-475` gives a `FixedCounterProof` a discharge condition —
representation in `low-byte`/`x`/`y` and the loop in the proved set — while a
`FixedLoopProof` has none. `FixedLoopProof.pendingObservers` is typed `true` and
nothing discharges it.

Stated at the width it was measured: **for this witness family, every candidate
carrying a `FixedLoopProof` is rejected.** Two cautions keep that from being read
as more — `originalInduction` only sees range-observer loops and has a
`returnedLocalDestinations` escape, and the `ARTIFACT_EVIDENCE` failure was
measured with two gates already bypassed, so it may be a consequence of the bypass
rather than an independent defect. Both are recorded as unverified.

### What Gap A would take

Not the ordinal fold. A final-observer template for a **one-block after side**:
`continuations` indexes `current.blocks[1]`, `[2]` and `[4]`, and `side()` returns
null unless five unshared role blocks exist, so a loop whose header and update are
gone has no after side to compare. The flag and register continuation proof itself
is derived from actual instructions (`byteContinuationQuery`), so that half is an
addition; the five-block structure is the part that has to grow a second shape.

The cheaper of the two routes keeps the counter proof and adds an elided-control
flag beside the existing `firstTestElided`, rather than reviving `FixedLoopProof`.
`firstTestElided` is the precedent and it is also the schema precedent: only
`representation` reaches a public artifact (`evidence-records.ts:380` writes
`fixed-counter:x` into `.debug.json`), and a sibling boolean reaches none, so no
`schemaVersion: 1` surface moves.

Gap A is therefore its own unit with its own proof obligation, and #119 stays open
for it.

## Residuals

- **Gap A** — the one-trip elided-control recipe and its one-block after-side
  observer template. Named here, #119 stays open.
- **The expansion recipe has no discharge path.** `FixedLoopProof` and
  `nativeStoreProofs` are both rejected unconditionally by the same clause. To be
  filed as its own unit; the artifact-evidence half is unverified.
- **Dead debug scaffolding in shipped source.** `fixed-loop-selection.ts:652-658`
  and `:690-699` carry `console.error` blocks gated on
  `process.env.BLEND65_DEBUG_INNER2` and compared against a magic source offset
  (`loop.comparison.span.start === 6929`). To be filed and removed.
