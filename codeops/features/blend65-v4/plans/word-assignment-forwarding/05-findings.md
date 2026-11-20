# Word assignment forwarding — findings

> **Owner**: T-37 / #168 · **CodeOps Artifact Schema**: 1
> **Last Updated**: 2026-11-21

Findings from the plan preflight, which ran before any implementation. Severity is the auditor's.
Every empirical claim was re-verified by the parent before disposition, because the auditor runs
read-only and cannot build the compiler.

**0 critical, 4 major, 8 minor.** All four majors are confirmed and all four are defects in this
plan rather than in the compiler. The verdict — do not start implementing as planned — is accepted.

## PA-1 — the golden exposure was enumerated by an unsound method · **task reopened**

T-37.2 was marked complete on the claim that only 4 of 25 pinned oracles could reach the pattern,
and that no oracle pins a global code-byte total. Both are false, and the method could not have
produced a right answer.

| Sub-claim | Verified refutation |
| --- | --- |
| `sprite-publication-forwarding.spec.test.ts` reaches via `address = load + offset - 2` | That is **TypeScript**, at `:96`, inside a loop scanning PRG bytes. Its Blend fixture declares only `byte` values |
| `input-loop-storage.spec.test.ts` reaches via `other = column + 1` | Also TypeScript, at `:427`, a harness loop building expectations |
| "No oracle pins a global code-byte total" | `test/rd08/optimizer-exact-output.impl.test.ts:29-36` pins whole-PRG **SHA-256 digests** and a payload length of 2,159 — the strongest possible form of the thing the claim denied |

The cause is that the detector searched whole test files, so it could not tell Blend source from
the TypeScript around it, and it required a `;` terminator, so it missed every `+=` in a `for`
header — including `for (let i: word = 0; i < 8; i += 1)` at
`test/rd05/fixtures/input-saved-caller.blend:10`, which is exactly the fixture
`optimizer-exact-output` digests.

**A second attempt also failed**, which is the useful part. Restricting the scan to Blend sources
and adding `+=` raised the count to 16 tests plus a fixture, but still missed the same `for`-header
case for the same reason. Making the criterion safely over-inclusive — any oracle pinning exact
output that can see a word-typed value — returns **173 files, 120 of them frozen**, because the
generic fixture name `game.blend` appears in most harnesses. That is not an exposure set; it is the
corpus.

**Disposition — the task is reopened with a different method, not a better regex.** Static
prediction of which goldens a lowering change reaches is not reliable here, and two failed attempts
are enough evidence of that. The exposure is settled **empirically**: run the affected tiers before
and after the change and attribute every single delta, which is the method the preceding unit used
successfully. The over-inclusive list is retained only as a watch list.

One fact from it is load-bearing and changes the risk: **120 of the candidates are frozen
`.spec.test.ts` oracles, which may never be edited.** If the change shifts even one, the slice is
blocked or must narrow until it does not. That possibility now has to be proved absent rather than
assumed, and the empirical run is what proves it.

## PA-2 — the barrier argument was a false proof of a right conclusion · **repaired**

The dated investigation concluded that the aliasing hazard cannot occur, and the core of that is
confirmed independently by the auditor: source locals and parameters both take `declaredLifetime`
whose `liveAt` is every position in the body, so two same-function locals always interfere and can
never be overlaid. That part stands.

Three defects in the supporting argument, all verified:

| Defect | Evidence |
| --- | --- |
| The cross-owner closure is false | The plan claimed cross-owner requests set `persistent: true`, citing three sites. All three are interrupt-predecessor words — *"Saved predecessor in a proved installation-owned word"*, *"...for uncertified retained source code"*, *"Saved NMI predecessor at nesting depth"*. Ordinary locals of **different** functions are cross-owner and are not persistent; their non-overlap is intended home reuse. The real reason the case is irrelevant is that one arithmetic's destination and operands resolve to homes owned by the same function, or to labels |
| Machine-created operand homes sit outside the guarantee | `requestStorage` (`lower-state.ts:483-514`) sets **no `domain`**, and `lifetimesOverlap` returns `false` on any domain mismatch (`interference.ts:287`). A domain-tagged destination local and a domainless machine temporary therefore have **no interference edge at all** and may be overlaid at an offset. Today the private scratch is safe because scratch and operand temporary are both domainless; forwarding into the local trades that for a pair the edge builder does not relate |
| The barrier existed in three unreconciled formulations | An undecidable one in the risk section, a six-item list in the oracle task, and the shape conditions in the investigation — while the implementation task said only "when the barrier condition holds" |

**Disposition.** The persistence argument is replaced with the same-owner one. The guarantee is
restated with its real preconditions — same owner, same `domain`, same `activationRoot`. The barrier
gains an explicit exclusion of machine-created operand homes, and the three formulations are
collapsed into one normative statement that the implementation task points at.

The auditor's out-of-cluster observation is recorded rather than absorbed: the
domainless-temporary/domain-tagged-local non-edge looks like a **pre-existing** allocator weakness,
latent only because nothing currently writes a local before reading a temporary. It is not this
unit's to fix, and it should not be silently relied upon either.

## PA-3 — the `none` figure was generalized from the `size` inspection · **repaired**

The plan claimed, in bold, that every instance was inspected and that all 16 `none` pairs and all 8
`size` pairs are the same pattern. The `size` half is true. The `none` half is not: re-listed with
their blocks, the 16 pairs are spread across **ten** blocks, where the pattern accounts for at most
eight.

| Block | Pairs | Matches the pattern? |
| --- | ---: | --- |
| `block_12`, `block_36` | 2 each | Yes — `x = x - 2` and `x = x + 2` |
| `block_0`, `block_29` | 3 each | Partly — one pair each is the `xr = x + 24` pattern; the other two per block are something else |
| `block_3`, `block_6`, `block_32`, `block_46`, `block_48`, `block_49` | 1 each | No — a different shape, not this slice's |

What happened is plain: the eight `size` pairs were inspected, found uniform, and the `none` count
was taken from a tally rather than from inspection. The word "verified" was wrong.

**Disposition.** The `none` benefit is restated as the removable subset rather than the whole tally,
and D-5's claim that the slice is worth twice as much at `none` is withdrawn pending that
attribution. The remaining pairs are noted as a separate shape that this slice does not address.

## PA-4 — the stated mechanism is not available · **repaired**

D-2 said the temporary keeps existing and only its home is redirected. A request's home is not
something lowering can redirect: `requestStorage` produces an identity, and addresses are assigned
afterwards by storage closure keyed on that identity.

The auditor's alternative is better **and smaller**, and the key fact is verified:
`loweredPlace` (`lower-state.ts:548-573`) already returns a `storage` lowered value carrying the
destination's own `requestId`, resolved from the declared storage that lowering can see. So the
destination's home is available at exactly the point the scratch is currently requested, and the
smallest sound change is to **not request the scratch at all** and give the two existing stores the
destination's lowered value.

That also withdraws a benefit claim. The plan credited 8 bytes of freed RAM in both rows; if the
request persisted, closure would still assign it a home, and the only path that drops a dead
temporary's store is gated on optimization facts that the `none` route does not supply. Under the
corrected mechanism the request is never created, so the saving is real — but it must be measured
rather than asserted, and it was asserted for the wrong reason.

**Disposition.** D-2 is restated as *the scratch request is not created when the destination's home
can carry the result*. The freed-RAM row is removed from the claim and moved to the measured
outcome. Both rejected alternatives are recorded with why they are worse: suppressing the copy
afterwards would have to re-prove an omitted home unobservable through a route unavailable in
`none`, and coalescing requests in the inventory happens before lowering knows the pattern exists.

## Minors

| ID | Finding | Disposition |
| --- | --- | --- |
| PA-5 | `liveAt` cited at `inventory.ts:67`; it is `:69` | Corrected |
| PA-6 | "a 237-line barriers oracle" names no real file | **Refuted.** `packages/compiler/src/machine/byte-assignment-forwarding-barriers.spec.test.ts` is exactly 237 lines, matching the `+237` in `9bbc9ead`'s commit stat. The auditor checked `byte-assignment-forwarding.spec.test.ts` and `byte-write-forwarding.spec.test.ts`, omitting `-barriers` from both names. The plan's claim stands; only the file was unnamed, and it is now named |
| PA-7 | The pins-move-down contract was generalized to all cost tests; only the boing-ball one documents it | Corrected — the others need their own justification |
| PA-8 | `sprite-publication-forwarding` was called "the one to watch" on the same broken method, and is in fact robust for reasons the plan did not give | Corrected; it leaves the watch list |
| PA-9 | An unresolved "probably" sat inside a task marked complete | Resolved: the arithmetic's consumer is a call argument, not a whole-word store, so it is outside the pattern |
| PA-10 | The push-state paragraph still read in the present tense after being repaired | Corrected to past tense |
| PA-11 | "rather than adding a second analyzer" is in tension with needing a whole-body barrier, and `lower-state.ts` is already 884 lines, past the split point | Corrected — the predicate gets its own module, as the byte sibling's did |
| PA-12 | The out-of-scope note gave no direction for the zero-page interaction | Corrected: zero-page homes would make each pair 4 bytes instead of 6, so doing that first would cut this slice's optimized value from about 48 to about 32 bytes, while `none` is unaffected. The 48-byte figure is conditional on the current RAM-home policy |

## What the auditor confirmed as correct

Recorded so the repairs are not mistaken for a rewrite of the whole plan.

| Claim | Status |
| --- | --- |
| Cause 2 dismissed as delivered-as-designed, citing the zero-page gate | **Verified** — the cited line is exactly that condition, and `none` must not be "fixed" |
| The `none` baseline: 1,151 code, 0 zero page, 7,167 program, 442-byte twin | **Verified** against the pinned cost oracle; all four numbers match |
| Selection precedes storage closure, and the byte mechanism keeps the result in A | **Verified** — both citations land on the exact sentences, and the pipeline order confirms it |
| D-1, authoring a barriers oracle rather than leaning on the parity oracle | **Correct on the merits.** The parity oracle is genuinely behavioural and robust to size change, and structurally cannot prove the forwarding declines to fire on shapes the fixture does not contain — which is exactly the PA-2 class of bug |
| D-3, that the barrier must be semantic | **Forced and correct** — addresses do not exist at selection time |
| The same-function non-overlap conclusion | **Verified independently** by the auditor before it read the section. The conclusion stands; only its proof needed repair |
| Task ordering, oracle before preflight before implementation | Sound, and the preflight gate is what caught PA-1 and PA-2 before any code existed |

Cause 1, the seven-byte raster poll, is **verified only by proxy**: the form is pinned on fixtures
modelled on boing-ball rather than on boing-ball's own output. The parent measured it directly in
the emitted assembly, so it is confirmed, but the plan should cite the measurement rather than the
fixtures.

## Process slip — the oracle was committed unreviewed, inside a docs commit

Recorded because the commit history would otherwise misrepresent what happened.

Commit `7bb28f50` carries the message *"repair four confirmed preflight majors before writing
code"* and a body describing only plan repairs. It also contains **815 lines of new test code** —
`test/rd05/word-assignment-forwarding.spec.test.ts` and
`test/rd05/word-assignment-forwarding-vice.spec.test.ts` — swept in by a `git add -A` while the
oracle's author was still running. Their timestamps show they were written about a minute before
the commit, so they may well have been mid-iteration.

Two things are wrong with that, and neither is the code:

| Problem | Consequence |
| --- | --- |
| The message does not describe the contents | Anyone reading the history sees a docs commit and would not look for an oracle in it |
| The oracle entered the tree without the parent reviewing it or reproducing RED | The protocol's order is author → review → reproduce RED → freeze by hash. Committing first skips three of those |

**What is not done about it.** The commit is pushed to a shared integration branch, so it is not
rewritten and no history is force-pushed. The files are also left in place rather than reverted,
because the authoring agent was still live and removing its working files mid-run would corrupt its
output rather than tidy anything.

**What is done instead.** The oracle is treated as **not yet accepted**: `T-37.3` stays open, and
the freeze only happens after the parent has read both files, confirmed they reach no
implementation source, and reproduced RED itself. The freeze commit will record the blob hashes and
the RED split, which is the evidence that was skipped here. Until then no claim rests on these
files.

The generalisable lesson is the narrow one: `git add -A` is unsafe while a subagent with write
access is running, and the staging should be scoped to the paths the commit's message actually
describes.
