# The finite-loop schedule for a loop that runs once, and the byte it reloads

> **Owner**: [#119](https://github.com/blendsdk/blend65/issues/119) · **Type**: Task
> **CodeOps Artifact Schema**: 1
> **Status**: In progress — Gap B delivered, review findings being dispositioned, Gap A re-scoped to #209
> **Progress**: 8/9 tasks; complete gates remain
> **Last Updated**: 2026-11-26

## Tasks

| # | Task | State |
| --- | --- | --- |
| 1 | Measure both gaps on the current tree; correct the issue's stale figures and witness spellings | Done |
| 2 | Establish why each gap is refused, by spike and by the build's own decision record | Done |
| 3 | Lowering: hoist the proved invariant load into the preheader | Done — `machine/fixed-counter-invariant-load.ts` |
| 4 | Observer: accept the hoisted exact template and relocate the accumulator obligation | Done — `size-observer-register-counter.ts`, `size-observer-selected-loops.ts` |
| 5 | Public oracle authored independently, implementation-blind, with RED evidence | Done — `test/rd08/finite-loop-invariant-load.spec.test.ts`, 13 cases, 5 verified red against the reconstructed pre-change tree |
| 6 | Implementation tests for the guards the public oracle cannot express | Done — five lowering guards and both observer guards witnessed; each observer witness verified by deleting the guard it pins |
| 7 | Independent reviews round one | Done — emitted-code and correctness audits, 20 findings |
| 8 | Disposition the review findings | Done — one confirmed lowering defect fixed, three oracle cases re-derived, behaviour oracle added, seven guard witnesses, four comments corrected, #212 filed |
| 9 | Complete gates, closeout and issue evidence | Pending — host checkpoint running; `yarn test:full` not yet run, so the endpoint is not yet verified |

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

### RED evidence, measured against the pre-change tree

The oracle was authored implementation-blind, but it was authored **after** the
implementation existed, so running it proved nothing on its own. The pre-change
tree was reconstructed to get the evidence that matters: the five source files
reverted to the commit before this work, the four new ones removed, `dist`
deleted and rebuilt from scratch, and the absence of the transformation confirmed
in the built output before a single test ran.

| Witness | Pre-change | Required | Failure |
| --- | ---: | ---: | --- |
| constant 7, displacement 1, bound 4, balanced | 63 | 57 | `lda #$07` inside the loop; repeated span wrong |
| the same at size | 63 | 57 | identical |
| global 255, displacement 255, bound 8 | 135 | 107 | `lda value` inside the loop |
| global 128, displacement 127, bound 4 | 71 | 59 | `lda value` inside the loop |
| constant 7, undisplaced, bound 4 | 63 | 57 | `lda #$07` inside the loop |

All five fail, each on three independent assertions: the repeated span, the
accumulator being rewritten inside it, and the cycle total. Restored and rebuilt,
all thirteen pass. The seven controls and the byte-identity case pass on **both**
trees, which is what makes them controls rather than evidence — they pin current
behavior by construction, and the plan records them as such rather than counting
them toward the proof.

One trap worth recording: an intermediate check of the pre-change output looked
like it still hoisted. The filter used to read it stripped the block labels, so
`ldx / lda / sta` read as one straight run when in fact the `lda` was in the body
block below the `ldx`. Confirming it meant re-reading the same output with the
labels left in.

### The volatile guard is pinned, and a single mutation says it is not

The lowering guard has three conditions a public build can reach, and all three
are pinned at the lowering level by
`machine/fixed-counter-invariant-load.impl.test.ts`: a four-trip fill hoists, a
one-trip fill does not, and a `peek($D012)` right-hand side does not.

That third case nearly got recorded as unpinned. Removing the volatility
condition alone leaves the test green; so does widening the operand condition
alone. Removing **both** hoists the hardware read out of the loop, and the test
fails. They are redundant alternatives rather than one dead clause: a hardware
read reaches its address as a literal today, so the operand test already excludes
it, but a named hardware register would pass that test and still be unmovable, so
the access has to be asked about as well.

The method note is that a mutation which fails nothing can mean the rule is
untested or that a sibling rule covers the same case. Only mutating the pair
apart tells the two situations apart, and the first reading here was the wrong
one.

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

## Review round one, and what it overturned

Two independent audits, an emitted-code audit and a correctness review, neither
sharing notes. Both converged on the same missing thing, and each found defects
the other did not. Twenty findings; the five that change conclusions already
written above are recorded here rather than quietly edited.

### Matching the issue's cycle targets is not evidence of parity

The table above reads as though landing exactly on 57, 107 and 59 settled the
output question. It does not. **Those figures are themselves the ascending
form** — the issue derived them from the schedule the compiler already emits. So
hitting them proves the transformation is the one specified, which is real and
worth having, and says nothing about whether an expert would write this.

An expert would not. A descending counter lets the decrement set the flag and
drops the bound compare entirely:

| Witness | Delivered | Expert descending | Delta |
| --- | --- | --- | --- |
| constant 7, displacement 1, bound 4 | 13 B / 57 c | 11 B / 49 c | **−2 B / −8 c** |
| global 255, displacement 255, bound 8 | 14 B / 107 c | 12 B / 91 c | **−2 B / −16 c** |
| global 128, displacement 127, bound 4 | 14 B / 59 c | 12 B / 51 c | **−2 B / −8 c** |

Every premise is already discharged by code this row touches, and the direction
is hard-wired in three places. So the 1.0 parity floor is below these routines
after this change as it was before it. Filed as
[#212](https://github.com/blendsdk/blend65/issues/212) with the measurement; it
composes with this work rather than competing with it, and does not reopen it.

The same audit measured what [#210](https://github.com/blendsdk/blend65/issues/210)
costs: full unrolling is −33, −65 and −33 cycles on the same three witnesses, a
2.3× to 2.5× win blocked by a proof kind with no discharge path. That delta is
now on the issue, so it is prioritised as parity debt rather than as tidying.

### Three oracle cases were fitted to today's output, not derived from the requirement

This is the sharper half of the post-hoc authorship problem, and the
reconstructed RED does not reach it. RED shows the oracle discriminates the two
trees. It cannot show the oracle was not shaped by the output it was run against,
and three of thirteen cases demonstrably were:

| Case | Why it is not requirement-derived |
| --- | --- |
| the reload is kept while a handler is installed | The stored byte is the literal `7`. **No handler can write a literal**, so an expert hoists it unconditionally. The case passes because `synchronous` rejects the whole candidate, and its comment's stated reason is false for this witness. An immutable oracle would forbid correct output. |
| the reload is kept for a computed right-hand side | `value + 1` is loop-invariant too; `value` is never written in the loop. The expert form hoists `lda value / clc / adc #1`. The case pins the current scope limit as though it were a requirement. |
| a single-trip fill is byte-identical | Pins `programBytes`, artifact length and an exact digest for the bound-1 build — **precisely the artifact #209 exists to change**, from 13 work bytes to 6. The oracle was written as if the open half of the same issue would never land. |

All three are being re-derived from the requirement before the file hardens. The
record's earlier framing — that reconstructing RED settled the authorship
question — covered half the debt.

### The behaviour oracle, and what it can and cannot show

`test/rd08/finite-loop-invariant-load-vice.spec.test.ts` runs an eight-element
fill on a real emulator and reads the result back. The value is written into the
global at run time, different from its declared value, so a byte captured too
early shows up; the array is fenced on both sides, so a store one element short
or one too far overwrites a checked byte. It passes: all eight elements hold the
run-time value and both fences are untouched.

**It cannot be made to fail by mutating the hoist.** Breaking the transformation
so it drops the load instead of moving it was expected to corrupt the fill;
instead the observer refuses the resulting construction and the program falls
back to the generic word-counter form, which is correct, so the case passes. The
same happens for every unsound hoist available to inject.

That is a real property of the layered design worth stating — an unsound lowering
decision costs the candidate rather than the program — and it is equally a limit
on this oracle. It is a non-regression check on the behaviour contract, not a
discriminator for this transformation, and the record says so rather than
counting it as proof the hoist is right. What proves that remains the emitted
shape, the cycle figures, and the guards' own rejection witnesses.

### There is no behaviour oracle (closed)

Both audits found this independently, and it is the project's own two-expectation
contract: an optimization needs a behaviour oracle derived from language, CPU and
platform semantics **and** an assembly-and-cost expectation. Only the second
exists. Nothing anywhere executes an invariant fill of two or more trips and
reads the filled bytes back; the nearest existing cases store `byte(i)`, which
varies per trip and never reaches this shape. Running the emulator tier does not
fix it, because the tier contains nothing of this shape to run.

### Task 6 was marked Done and is not

The interrupt guard was disclosed as having no *output* witness. The review
established it has **no witness at any level**: the three lowering-level cases
cover the two-trip boundary and the hardware read, and none installs an interrupt
route. The disclosure understated the gap by one level while the task above it
claimed completion. Two further new guards — the hoisted load's identity check
and the relocated accumulator obligation — have no rejection witness either, so
deleting either would leave the suite green.

### The volatility clause: right conclusion, wrong reason

The record said the operand and volatility conditions are "redundant
alternatives". They are not. They are **two independently motivated necessary
conditions that happen to coincide on the single available witness**: the operand
condition is load-bearing for the observer's own template, and the volatility
condition is forward-looking defence that is currently unreachable, because a
hardware read reaches its address as a literal rather than through a name. So the
mutation note needs a third case beside "untested" and "covered by a sibling":
two conditions that exclude different classes and overlap on the only witness
available. Keeping both remains correct; the test comment claiming the volatility
clause as the witness is wrong and is being corrected.

### Smaller corrections

| Finding | Disposition |
| --- | --- |
| The oracle's cycle figures are placement-dependent, and its comment says they are safe because the routines are short — a non-sequitur, since taken-branch cost depends on placement, not length | Measured: the three loop labels sit at low bytes `$42`, `$48` and `$48`, so the figures hold today. The rationale is being corrected and the dependence recorded |
| "`programBytes` is unchanged in every witness" is asserted nowhere; the witnesses pin routine bytes, a different quantity | Measured separately at 100, 106 and 106, unchanged. Recorded as measured rather than asserted |
| The lowering guard does not require the loop's member set to be exactly body and update, so a loop with an extra in-cycle block writing the accumulator would be hoisted over | Unreachable today through any shipped path, but it contradicts this plan's own claim that the guard stands alone. Being fixed |
| The debug-scaffolding residual inventoried two sites in one file | There are **five in four files**, three of them with no offset condition at all and so reachable by one environment variable. #211 widened |
| A mutation helper silently no-ops on an out-of-range ordinal — the exact mechanism behind the six vacuous passes | Being hardened, since correcting the index left the mechanism in place |

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
