# Word views, direct indexing and word-update forwarding

> **Owner**: [#120](https://github.com/blendsdk/blend65/issues/120),
> [#121](https://github.com/blendsdk/blend65/issues/121),
> [#122](https://github.com/blendsdk/blend65/issues/122),
> [#125](https://github.com/blendsdk/blend65/issues/125) · **Type**: Task
> **CodeOps Artifact Schema**: 1
> **Status**: In progress — delivered, reviewed, host-verified; the complete gate remains
> **Progress**: 8/9 tasks
> **Last Updated**: 2026-11-26

## Tasks

| # | Task | State |
| --- | --- | --- |
| 1 | Measure all four witnesses on the current tree at every goal | Done |
| 2 | Find the gate each witness hits, by spike, and what each gate protects | Done |
| 3 | Implement #120, #121, #122, #125 in their named seams | Done — measured below |
| 4 | Canonical identities, integration tier and frontier guards | Done |
| 5 | Public oracle, authored independently and implementation-blind, with RED | Done |
| 6 | Behaviour oracle in VICE with discriminating inputs | Done |
| 7 | Implementation witnesses for the guards the public oracle cannot express | Done — three, one verified by mutation; three guards unwitnessed and itemised; a fourth witnessed after review |
| 8 | Independent reviews and dispositions | Done — three reviews, eight findings, all dispositioned |
| 9 | Complete gate and closeout | Pending |

## The witnesses, measured

Every witness emits the same program at `none`, `balanced`, `speed` and `size` on
the base tree `9f1d24b1`, and the bodies are exactly the forms the issues quote.
The issues' absolute PRG figures are stale; the windows are not.

| Witness | Issue's PRG | Measured `programBytes` |
| --- | --- | --- |
| #120 nested fill | 261 | 268 |
| #121/#122 `scan(seed)` | 178 | 185 |
| #125 `touch()` then fill | 227 | 234 |

## What each gate was

| Issue | Gate | Why it was there |
| --- | --- | --- |
| #120 | `directAggregateAccess` took the bounded word view only for a returned-local or aggregate-parameter root | Workload scoping when the view was added for one input, not a stated hazard. The pointer construction already consumed the same proved maximum to drop the high byte |
| #121 | No selection reused the index byte as the stored value | Not built |
| #122 | The induction backstop in `selectForwardedWordAssignments` excludes every root a loop test names, because the narrowing facts are absent on some passes | Protects counters a fixed-loop construction could narrow. A counter seeded from a parameter can never be narrowed, and still paid the scratch copy |
| #125 | Forwarding admitted only declared parameter and local homes | Globals are nameable outside the frame, so the alias and observation argument was never made for them |

## Delivered

| Issue | Window before → after | Witness `programBytes` at `balanced` | Expert target |
| --- | --- | --- | --- |
| #120 | 21 B / 30 c → `ldy j / lda i / sta data,y` 9 B / 13 c | nested fill 268 → 238 | met |
| #121 | 9 B / 13 c → `lda i / tay / sta data,y` 7 B / 11 c | — (shares #122's witness) | met |
| #122 | 32 B / 41 c → `inc lo / bne header / inc hi / jmp header` 11 B / 9 c common path | `scan(seed)` 185 → 132 | cycles met; 5 B behind the range-proved form (#216) |
| #125 | 30 B / 44 c → 18 B / 28 c incl. `rts` | `touch` program 234 → 190 | met as specified; `INC` beat path filed (#217) |

Both #120 and #125 measured more than the issues projected, because the
compiler's own storage closure did what the issues declined to credit
analytically: once no store requests the aggregate pointer, its zero-page home
is never requested and the borrowed `$03` save and restore disappear from
startup. That is closure by construction, not a release after allocation.

Canonical `none` is byte-identical on every witness and on all three examples.
`m1` moved at `balanced` and `size` (`99d16c37…` → `1921494f…`): the #125 path
removed 24 code bytes from its two `playerX` updates, and an alignment fill grew
by the same 24, so its `programBytes` is unchanged.

## The design turn: the reference the held-counter constructions are checked against

The first widening applied the bounded view everywhere in the optimized
candidate. The fast tier stayed green; the integration tier did not: the saved
input frontier went 701 → 948, and every held-counter construction for row 6's
three witnesses became infeasible ("Selected loop body, storage or lifetime
correspondence is unresolved"), so their 100/106/106-byte forms fell back to
142/148/148.

A discriminating spike settled why. The held-counter constructions are checked
against the canonical lowering — the one with no `sourceFacts` — as their
reference, and expect its pointer form. Widening only the explicit `original`
construction, and leaving the reference alone, restored every row 6 selection
exactly and kept #120's witness at 238.

So the rule is: take the view when the index is a plain read of a variable no
fixed-loop construction could narrow, or in the `original` construction, which
narrows nothing. A variable a held-counter construction could take is left to
those constructions, which are cheaper still when they win.

The same experiment for word updates failed: lifting the counter exclusion in
the `original` construction makes the final observer refuse it ("Original
counter initialization or unit update is not completely materialized"), so the
nested witness's two counter updates stay staged. Filed as #219.

## What each guard is, and whether anything fails without it

| Guard | Witnessed | How |
| --- | --- | --- |
| #120: index root not narrowable, or `original` construction | yes | integration tier: removing it fails the saved-input frontier and row 6's oracle |
| #120: the plain construction stands down where a complement could be cached | yes | `input-byte-selection.spec.test.ts` (VICE, four profiles): without it the plain construction wins with two complements |
| #120: unit stride and one-byte element | **no** | scope; the excluded shapes are #218 |
| #120: index origin known | **no** | fail-closed; no fixture reaches an unknown origin with a bounded maximum |
| #121: same request and offset | yes | public oracle, different-variable control |
| #121: no asynchronous entry | yes | implementation witness; verified by deleting the gate (`tay` appears) |
| #122: exemption only for roots outside the narrowable set | yes | integration tier (the row 6 and saved-input constructions) |
| #122: unknown set releases nothing | **no** | unreachable: `optimizationFacts` carries every function |
| #125: operand is the destination or a constant | yes, twice | implementation witness; selection and resolution each refuse, so neither alone is load-bearing |
| #125: no asynchronous entry | yes | implementation witness with an IRQ handler; verified by deleting the gate (the update forwards). First recorded here as shadowed — true only for NMI programs, whose blocks are projected per route and so never reach forwarding (#215). The SFA/ABI audit caught the overstatement |
| #125: never `INC` on a module word | yes | implementation witness on a loop-closing `total += 1` |

## Oracles

| Oracle | Result |
| --- | --- |
| `word-views-direct-indexing.spec.test.ts` + `word-update-forwarding.spec.test.ts` (19 cases), implementation-blind | green; on `9f1d24b1` exactly the 9 predicted cases fail for the predicted reasons, the 10 preservation controls pass on both |
| `word-views-direct-indexing-vice.spec.test.ts` | green in VICE; confirms all four constructions are emitted before executing, then reads every result. Fails on `9f1d24b1` on the construction check |
| `word-views-guards.impl.test.ts` (3 cases) | green; the interrupt guard verified by mutation |

Three first-draft oracle defects were the author's to fix and were: the
evaluator could not follow `main`'s exit into the startup restore, a span
evaluation followed the update's own back edge, and one control's NMI handler
body is refused by the compiler on both trees — which is itself a defect, #214.

## Review dispositions

| Finding | Severity | Disposition |
| --- | --- | --- |
| RV-001 / MC-003: the page-crossing comment was wrong — the pointer form's discarded store read is the element itself, absolute-Y's is one page below | minor | Fixed. The comment now states the difference and the real safeguard: the final observer refuses any access envelope, discarded reads included, that is not ordinary RAM. A VICE case writes an array straddling `$3400` and checks both neighbours |
| RV-002: moved exports undocumented, one doc comment stranded | minor | Fixed |
| RV-003: oracle authored after implementation | major (process) | Recorded below as a deviation; not rewritten |
| MC-001: word `< 8` guard pays a full subtraction | minor | Pre-existing; filed #220 (2 B / 2 c per test) |
| MC-002: second `lda #$00` in zero initialisation | minor | Pre-existing; the mechanism #204 owns, witness added there |
| #216 target | — | Refined to `inc lo / bne header`, 5 B |
| SF-001: "any installed handler" disables forwarding was too broad | minor | Correct: IRQ-only programs keep their blocks and reach the #125 gate. Witness added and verified by mutation; record and #215 narrowed to NMI |

Machine-code verdict: both store windows **meet** the expert; the updates
remain below it and are filed. SFA/ABI verdict: static closure passes, no
critical or major finding. Correctness verdict: no runtime defect.

## The complete gate found a third reference conflict

The first complete `yarn test:full` failed eight cases of
`input-byte-selection.spec.test.ts` — two per profile, all deterministic — plus
the #191 collision flake. The failing program fills two loops with `~x` for a
stable byte `x`; its oracle requires the complement to be computed once.

The exception that lets the plain construction take the bounded view for a
narrowable counter broke the construction that caches the complement: that
construction's observer compares every instruction outside its substitution
with the canonical reference, which keeps the pointer form. It was refused,
and the plain construction then won on size (1539 against 1572) by computing
`~x` on every trip. The exception now stands down in any function where a
complement could be cached, restoring 1572 and the single complement; the
row's own witnesses and row 6's selections are unchanged. Having both wins
needs the complement observer to accept the absolute-indexed store, filed as
#221.

This is the third time in two rows that a construction's reference has
decided what another construction may do. The integration tier caught the
held-counter case; only the VICE tier carries the complement oracle, and it was
not among the affected VICE tests run before the gate — a lowering change that
touches every indexed store should have run every VICE file that pins a
loop's store shape.

## Process deviation: the oracle followed the implementation

The specification-first order — oracle, RED, then implementation — was not
followed. The four seams were found by spiking and were implemented before the
oracle was commissioned; the spikes and the implementation are the same work.
Two things hold anyway, and neither is the same as pre-implementation authorship:

- The author was **implementation-blind**: it was given the issue text, the
  frozen specification and the public test helpers, with the machine and
  services sources, every diff and `/tmp` explicitly forbidden, and reported
  seeing none of them.
- **RED was measured, not argued**, against a worktree of the pre-change tree
  `9f1d24b1` with its own build: exactly the nine predicted assertions fail,
  each for its predicted reason.

What retrospective RED cannot show is that the expectations were not shaped by
knowing what would pass. The safeguard here is that every expected window was
copied from the issue text before any output existed, and that three of the
author's first-draft cases failed on the new tree and were corrected for
defects in the oracle, never by moving an expectation. Recorded as a deviation
rather than counted as specification-first.

## Verification

| Gate | Result |
| --- | --- |
| install, build, typecheck | clean, 7/7 |
| Canonical identities | all `none` unchanged; `m1` balanced/size moved and explained above |
| Fast tier | compiler 190 / 3,108, root 48 / 1,357 |
| Integration tier | 237 / 4,876 before the oracles were added |
| Host checkpoint `yarn test` | compiler 270 / 4,601 + 2 skipped; root **288 / 6,255** |
| Complete gate `yarn test:full` | pending |

## Residuals, all filed

| Issue | What |
| --- | --- |
| #214 | An NMI handler cannot increment a byte global — E10245 on both routes |
| #215 | Word forwarding never runs in a program that installs an NMI handler (route-projected blocks) |
| #216 | The range-proved 6-byte counter step |
| #217 | `INC` for a module word when nothing observes A, flags or the bus |
| #218 | Word-element and scaled bounded indexing, 52 → 17 B |
| #219 | The plain construction stages updates of narrowable counters |
| #220 | A word compared against a power of two still subtracts |
| #221 | A cached complement and an absolute-indexed store cannot both be selected |
