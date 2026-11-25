# Remaining issue waves 1–5 — execution plan

> **Owner**: the remaining open v4 issue inventory, delivered in dependency order.
> **Scope mode**: strict. `spec/` and the expressiveness ledger stay byte-identical.
> **Purpose**: hold the wave map, the per-wave specialist-gap check and the delivery
> protocol so each issue plan stays a single bounded unit.

## Wave map

| Wave | Order | Issue | Affected contract |
| --- | --- | --- | --- |
| 1. Callable proof | 1 | #161 | Cross-call and borrowed raw-write kills, finite indirect targets, restoration |
| | 2 | #157 | Definite callable-field write transfer through helpers |
| | 3 | #162 | Constant-index callable element recovery |
| 2. Storage shape | 4 | #146 | Unused SFA return/argument staging homes |
| | 5 | #153 | Bounded NMI retention on the stock chained route |
| 3. Measured output | 6 | #160 | Symbolic block index folded to an immediate selector |
| | 7 | #159 | Runtime element block indices and VIC-bank visibility |
| | 8 | #158 | Consumer-aware alignment diagnostic (user-gated) |
| | 9 | #145 | Size-mode acquisition gap against the expert baseline |
| 4. Local optimization | 10 | #124, #154, #155, #139, #135, #133, #132, #131, #151, #152, #163 | Independent single-rule output wins |
| 5. Scoreboard and parity | 11 | #72 | Hand-written boing-ball expert twin |
| | 12 | #140, #70, #53, #73 | Residual parity and output classes measured against the twin |

Wave 1 runs #161 before #157 because a helper-written aggregate field cannot be
proved while cross-call kills are missing. Wave 2 runs #146 before #153 because
both read the SFA inventory and #153's proof enumerates the requests #146 removes.
Wave 3 runs #160 before #145 because #145 measures a size gap that the lowering
wins would otherwise make stale. Wave 5 builds #72 before the broad parity classes
because the twin is the measuring stick for their wins.

## Specialist-gap check

The check applies the detection criteria in `_shared/specialist-agents.md`: a
candidate needs one evidenced strong signal and no disqualifier, is deduplicated
against installed specialists and catalog roles, and is only created after an
explicit user decision (reserved authority; `--auto-design` cannot approve it).
`analyze-agents` is the execution surface and writes `codeops/specialist-check.json`.

| Wave | Candidate capability needed | Installed coverage | Verdict |
| --- | --- | --- | --- |
| 1 | Alias, borrowed-parameter, call/return and finite-target proof | `sfa-abi-auditor` brief line 12 (`aliases`, `lifetimes`, `calls`); `machine-code-auditor` for accepted output | None |
| 2 | Function-storage inventory plus NMI coexistence and timing | `sfa-abi-auditor` line 12 (`allocation`, `interrupt overlap`); `target-platform-auditor` line 12 (`interrupts`, `timing`) | None |
| 3 | Instruction selection, layout and VIC visibility | `machine-code-auditor` line 12 (`Lowering`, `optimization`, `allocation/layout`); `target-platform-auditor` line 12 (`banking`, `visibility`) | None |
| 4 | Local peephole/codegen costs, host cost of analysis | `machine-code-auditor` line 12; catalog `performance-auditor` for host hot paths | None |
| 5 | Complete artifact costs against expert assembly, scoreboard twin | `machine-code-auditor` line 5 (`equivalent expert assembly`) and line 12 (`platform output`) | None |

**Verdict: None.** Every wave's affected contract is already assigned by
`codeops/agent-routing.md:52-58` to an installed specialist with the exact
responsibility. No candidate has an evidence source, checklist or capability
beyond those charters, so none passes the "no unique capability" disqualifier.
Creating a fifth domain auditor would restate the three existing charters and add
maintenance cost without a new proof obligation.

The smallest alternative is the dynamic packet: each phase already sends the
affected contract, exact files and acceptance to the selected specialist. That is
insufficient only if a recurring capability has no owner — which is not the case
here. The check is repeated at the start of every wave because the plan inventory
and the affected contracts change; a new candidate only becomes valid with new
evidence, never with repetition.

**Wave 2 re-check (2026-11-15T12:48:44Z).** None. #146 is an SFA inventory/debug-evidence defect
(`sfa-abi-auditor`), and #153 is chained-NMI retention with a stock frame and ownership contract
(`sfa-abi-auditor` + `target-platform-auditor`). Both are already assigned by
`codeops/agent-routing.md`; no candidate has a unique capability gap.

**Wave 2 blocker (2026-11-15).** #146 is delivered. #153 is blocked: enabling the
straight-line stack-retention proof for `setNMI` produces no `stackRetainedBindings` for the
chained handler, and the public build fails `COMPILER_INCOMPLETE` at machine storage binding. The
stock chained entry uses a different generated-entry binding path than `setNMIExclusive`; proving
the stock NMINV frame and the handler's RTS return is the missing work. The gate change was
reverted; #153 stays open with this evidence rather than binding an unproved stack plan.

**Wave 3 re-check (2026-11-15).** None. #160 is lowering/output debt (`machine-code-auditor`),
#159 is alignment and VIC visibility (`machine-code-auditor` + `target-platform-auditor`), #158 is a
diagnostic contract (`semantics-reviewer`), and #145 is a size measurement (`machine-code-auditor`).
No new capability gap; #158 remains user-gated.

**Wave 4 re-check (2026-11-15).** None. #124/#154/#163 are machine lowering and semantic
precision (`machine-code-auditor`, with `sfa-abi-auditor` for the bound facts), #155 is startup
selection (`machine-code-auditor`), #167 is the callable-read alias boundary (`semantics-reviewer`),
and #139/#135/#133/#132/#131/#151/#152 are existing codegen/NMI owners. No new capability gap.

**Wave 5 corpus decision (2026-11-16).** The user scoped the corpus port to the boing-ball fixture
only. `examples/boing-ball` and `examples/boing-ball/twin.asm` now live in v4; the behavior oracle
samples frames 2/6/10/99/100 and the cost oracle pins 1,599 code bytes vs the twin's 402. The
remaining corpus fixtures (#70/#53/#73) are separate slices; the measured expert gap is #168.

This section is the durable record. `codeops/specialist-check.json` holds the
machine-readable check time and plan inventory.

## Delivery protocol per wave

1. Refine the issue into a bounded plan with acceptance witnesses and named
   residuals. Unresolved material scope is a runtime ambiguity, not a silent cut.
2. Preflight the plan with the `preflight` skill and the applicable specialist
   lens; resolve critical/major findings before any implementation.
3. Author the public specification oracle from the issue acceptance only, with
   implementation-blind authorship and recorded RED evidence.
4. Implement the smallest sound change. Reuse existing fact seams; add no second
   analyzer, runtime or source restriction.
5. Add implementation tests for the same witnesses plus the non-regression
   controls the public oracle cannot express.
6. Run independent reviews for the affected contracts. Critical work keeps two
   relevant reviewers plus base correctness.
7. Run `yarn test:changed --host` and `yarn test` before each commit; run one
   complete `yarn test:full` checkpoint at the wave close, then commit the
   closeout, roadmap row and issue evidence.
8. Answer the deferral-expiry question at wave close: name any deferral whose
   reason the wave invalidated, with a new owner.

## Progress

| Wave | State | Evidence |
| --- | --- | --- |
| Specialist assessment | Done | This section; `codeops/specialist-check.json` at `2026-11-15T08:28:44Z` |
| 1 | Done — #161, #157, #162 | `../interprocedural-raw-write-kills/08-closeout.md` · `../callable-field-helper-transfer/08-closeout.md` · `../constant-index-callable-recovery/08-closeout.md` |
| 2 | Blocked on #153 — #146 done | `../sfa-staging-home-reuse/08-closeout.md`; #153 needs the stock chained entry stack-binding proof |
| 3 | Done — #160 done; #159 closed scoped, its bank/ROM half fixed as placement rather than the diagnostic it was filed as; #145 measured non-win | `../block-index-immediate-fold/08-closeout.md` · `../runtime-block-index-alignment/08-closeout.md` · `../acquisition-size-gap/08-closeout.md` |
| 4 | Done (bounded) — #124/#131/#132/#139/#151/#154/#163/#167 done; #155 measured; #135/#133/#152 blocked | `../dynamic-callable-array-proof/08-closeout.md` |
| 5 | Done (bounded) — #140 T-20–T-27 verified; #72 boing-ball twin delivered; #70/#53/#73 follow | `../boing-ball-twin/08-closeout.md` · #168 |
| 6 | Direction recorded — unit 1 planned | The residual direction below |

## Wave 6 — residual direction (2026-11-20)

Waves 1–5 closed the inventory they were drawn from, so what remains is not a
sixth list of issues. It is six different kinds of work, and counting rows hid
that distinction: a count taken by matching only `RD-`, `T-` and `DEF-` row
identifiers reported 74 of 89 tracker rows done, while the tracker actually holds
126 rows — 83 done and 43 open — because 28 RD-08 parity sub-rows and three
qualification rows carry descriptive identifiers instead. Six further rows parsed
as open only because they are missing the `RD` column; they are complete. The 43
open rows are the authority for this section, and every open issue without a
tracker row gets one disposition line rather than a task.

### Classes of remaining work

| Class | Rows | What the work actually is |
| --- | --- | --- |
| Correctness residual | #170's two residuals, T-153, T-159 | A legal program is refused, miscompiled, or refused without a usable diagnostic. Outranks everything below: an author cannot work around a defect the compiler will not name |
| Measured non-win | T-145, T-155 | The win was implemented, measured against the expert baseline and reverted. Each row already names the unit that is missing, so neither needs another attempt — they need that unit |
| Blocked on a first-class fact | T-152, T-135, T-133 | The optimization is prototyped and its output verified by hand. The current fact model cannot represent the result, so each needs a model change, not a retry |
| Parity continuation | T-168 plus the 28 RD-08 backlog sub-rows under DEF-16 | Output quality measured against hand-written expert assembly. The largest body of remaining work by row count |
| Qualification debt | V4-HW-1, V4-HOST-1, V4-ASSET-1 | Physical hardware, a second host platform, and producer artifacts. No compiler change is available to advance these |
| Long tail | T-07, T-13, T-17, T-19, DEF-3 | Report-only host costs, retained specification copies, an unscoped audio adapter, a deferred release platform |

### Order

Correctness first, then parity. Within correctness, the unit whose cause is
already proved runs before the units that still need a proof built.

| Order | Unit | Scope | Why here |
| --- | --- | --- | --- |
| 1 | Dispatch residuals (#170) | Terminate the caller's block when no dispatch candidate returns, and give the machine-binding refusal a source span that names the construct | Both causes are proved and both remedies are specified. The lowering half was held back only because it would have invalidated the preceding unit's byte-neutrality evidence, and that evidence expired when the unit closed |
| 2 | Boing-ball parity continuation (#168) | The remaining code gap against the hand-written twin, and whole-frame timing | The measuring stick exists and the gap is the headline output-quality figure on the board |
| 3 | Chained NMI retention (T-153) | The stock `NMINV` frame and `RTS` return proof for the chained entry | A correctness residual whose missing unit is named, but which needs a proof built rather than applied |

Rows outside that order are not scheduled by this section. A measured non-win or
a model-blocked row is promoted only when its named missing unit becomes a plan
of its own; until then the measurement stands as the answer and re-running it
would produce the same number.

### Dispositions for open issues without a tracker row

| Issue | Disposition |
| --- | --- |
| #171 | Signedness repair landed with the preceding unit. Awaiting a user ruling: close against that commit, or keep open for a sibling-site audit of other lowering routes that retain a register value and could drop the same metadata |
| #172 | Enhancement, newly filed: a signed comparison against a constant allocates a RAM temporary instead of folding the bias. Unscheduled; it belongs with the parity continuation, not with correctness |
| #169 | Emulator test-order flake on an idle machine. Disclosed, not a compiler defect; it needs an isolation fix in the test file rather than a compiler unit |
| #164 | Open with two raw-write residuals routed to it from the preceding unit's reviews |
| #165, #158 | Diagnostic and restoration contracts that other rows depend on. #158 is user-gated and also gates the last task of T-159 |
| #140 | Residual parity and evidence debt, verified through T-20–T-27 and carried as evidence rather than as work |
| #110–#130 | The RD-08 parity block, already owned by the 28 tracker sub-rows under DEF-16. No separate disposition |

### Evidence debt observed while reconciling

#157 and #162 have delivered closeouts under this plan but carry no comment on
the issue itself, so a reader of the issue tracker alone cannot see that either
was delivered. Recording the evidence is cheap, but posting to the tracker is
outward-facing and is left for an explicit decision rather than taken here.

### Decisions reserved to the user

| Item | Why it cannot be settled inside a plan |
| --- | --- |
| #171 close-or-audit | Closing an issue is irreversible and the audit scope is a judgement about how much sibling risk to buy |
| #158 diagnostic contract | Explicitly user-gated, and it gates T-159's remaining task |
| Any new specialist agent | Reserved authority; the per-wave check above has returned None every time |

## Wave 7 — batch grouping (2026-11-21)

Wave 6 sorted the 43 open rows by *kind* of work and then scheduled only three
units, deliberately leaving the largest class unscheduled. Two of those three are
now consumed — #170 is closed and T-153's row is complete — and the third, T-168,
is in flight. So the question the tracker now poses is no longer which single unit
runs next, but how the remaining body is grouped so it can be worked in batches
rather than one row at a time.

One correction to Wave 6's reconciliation: the descriptive-identifier rows are 25
RD-08 parity sub-rows **plus** the three qualification rows, 28 in total, not 28
parity rows and three qualification rows besides. The 43-row open count it drew
conclusions from is unaffected.

Two of the 43 rows are second trackings rather than distinct work: `T-133` and
`↳ Predicate-proved return` are both issue #133, and `T-135` and
`↳ Direct raw argument delivery` are both issue #135. 43 rows are therefore 41
units, and each pair is grouped once.

### Why batching helps here, and where it does not

For the parity rows the edit is rarely the expensive part. Each needs a fact
proved about the code it rewrites — what is live in a register, which callee
preserves what, whether an index is still valid — and then a measurement against
a hand-written expert witness. That proof and that measurement setup are shared by
every row owned by the same seam, which is what makes a batch cheaper than its
rows. Rows owned by *different* seams share nothing, so grouping them together
buys nothing and only widens the blast radius of one commit.

What a batch can honestly claim is bounded. Whole-program reclosure is exactly
what is not available: DEF-16 is stopped with acquisition at 2442 against the 963
limit and the saved complement at 1623 against 725. So a batch verifies the way
the existing rows already do — the measured witness moves, and the frontier guards
stay green at 701/725 and 935/963 — and the analytical whole-program figure in each
row's note stays analytical until closure is reopened. Savings within a batch do
not sum, and several rows say so explicitly.

### Every open row, in exactly one group

| Group | Rows | What makes it one group |
| --- | --- | --- |
| **A — Capture and retention** | #115, #116, #123, #132 | All four remove a materialization of a value already live in A. One register-liveness fact and one capture seam serve all of them |
| **B — Word views and direct indexing** | #120 → #121, #122 → #125 | One aggregate direct-index owner plus a store-alias proof. Ordered inside the batch: #121 is defined as beyond #120, and #125 needs a strictly stronger alias proof than #122 |
| **C — Call and return linkage** | #118, #124, #126 | One call/layout owner. #126 and #124 overlap on the helper figure and are explicitly not additive, so they are measured together or the batch double-counts |
| **D — Cross-call register availability** | #104 enabler, then #127, #128 | Each needs the same missing fact: which registers a called function provably leaves alone. #104 owns that proof scope; the other two consume it |
| **E — Runtime shift** | #129, #130, #131 | One shift continuation/forwarding seam. #131's fold-safe slice has already landed and moved the saved artifact to 701, so this batch starts from a partly proved base |
| **F — Finite-loop schedule** | #119 | Owned by the finite schedule/availability seam rather than by any batch above. One row, kept separate rather than attached to a seam it does not share |
| **Decision-gated** | T-38 + T-159, #117, T-07 | Not blocked on engineering. One #158 ruling unblocks both T-38 and T-159's last task. #117 saves 755 bytes and costs 2041 cycles, so it is a question about what size mode may trade, not an implementation. T-07 waits on a bounded maintenance gate because `spec/` is frozen |
| **Blocked on a named missing unit** | T-152, T-133 with its #133 twin row, T-135 with its #135 twin row, T-155, T-145 | Wave 6's classes, unchanged. Each is prototyped or measured and names what it needs; re-running any of them produces the same number. Promoted only when its missing unit becomes a plan |
| **Composites — close through the batches** | #95, NMI witness (#70/#83/#96/#97), Input-diagnostic output (#104/#51), Input recipe mixtures | Not work of their own. Each is a measured bundle that closes when the seams underneath it land, and the first three are the natural acceptance witnesses for batches A–E. Input recipe mixtures is a gate condition on full RD-08 admission |
| **Host cost (report-only)** | T-13, T-17 | The same PE-001 class — host-side algorithmic cost with no emitted behavior or cost defect. One batch, and neither is urgent |
| **External dependency** | V4-HW-1, V4-HOST-1 (absorbs DEF-3), V4-ASSET-1, T-19 | No compiler change advances these. They need a physical C64, a second host platform, and producer artifacts including the GoatTracker 2.77 archive |
| **In flight / meta** | T-168, ↳ Bound precedence (#134), T-31, DEF-16 | Already executing, or tracking rather than doing. Not scheduled by this section |

The seam grouping has a side benefit worth one line: batches A–F are defined by
the fact they prove rather than by the rows that happen to carry a tracker entry,
so the open parity issues with no row of their own — #85 through #114 — fall into
the same batches without a separate inventory.

### Dispositions for open issues filed after Wave 6

| Issue | Disposition |
| --- | --- |
| #173 | Correctness: a call to a provably non-returning function is refused when work follows it. A legal program is rejected, so it outranks every parity batch and leads the order below |
| #174 | Correctness-adjacent: four of five machine-binding refusals reported no source location. Closed scoped to the two that name a storage demand - an unusable home and a missing one - which carried a request identity and therefore the declaration that asked for the storage. The disposition written here first said missing-storage had no instruction to witness and so stayed open; running it refuted that, because the span comes from the demand rather than from an instruction. The two genuinely remaining are #177 |
| #177 | Correctness-adjacent: the certificate and failed-function refusals still report no source location. Filed rather than left on #174, so no open work is parked behind a closed issue. The two differ in kind: the failed-function site is locatable from the failing entry's index and the function's source identity and was left out by scope, while the certificate site has no single demand or function to name. Closed: there were three producers, the locatable one names the instruction and the check that actually refused it, and the construct-less ones report at the program entry. Session 2b |
| #158 | Deferred, not actionable under the freeze. Ruled on 2026-11-22: the only route is registering a warning code, which means editing frozen `spec/` and re-pointing the oracle that asserts the on-disk and HEAD `spec/` trees match an approved commit. That anchor binds release lineage and the qualified expert baseline, so moving it is reserved to the user. The requirement is owned by errata E-10, which now records two witnesses; if the session-21 specification maintenance gate is authorized, it absorbs this |
| #159 | Closed scoped on 2026-11-22. The automatic-placement half needed no contract and is fixed; the explicit-placement half is the same wall as #158 and merged into E-10 |
| #178 | Correctness: the one block-index publishing shape #159 could not prove, where the block number crosses a function boundary. Closed. The consumer proof now leaves the body through the `return` and resumes at every call site, which also covers two hops, a result named in a local or a module variable first, and one hardware call site among several. Review found two more defects in the same seam that this unit did not cause but did extend — a join the walk never followed, and a consumer predicate that accepted any argument of any `c64.vic.*` capability, the second of which refused legal programs outright. Both reproduce inline with no helper, which is why both were fixed here rather than propagated; the residue is #189 and #188. Session 3b |
| #188 | Correctness: four crossings the block-index visibility proof still does not follow — an argument into the publishing function, a module initializer, a module variable written in one function and read in another, and an indirect call. All four measured at `$1400`, inside the character-ROM window. Filed from 3b rather than left implied. Both the semantics reviewer and the platform auditor independently ranked the argument form the worst developer-facing gap, since extracting a direct call into a reusable wrapper silently breaks the sprite. Session 3e |
| #189 | Correctness, and it outranks every remaining row: an inferred visibility demand refuses legal programs, several of which compiled before session 3b — including two ordinary 5,000-byte sprite sources neither of which is larger than a visible interval — and the diagnostic tells the author to remove an explicit constraint they never wrote. Two causes remain after 3b narrowed the consumer predicate — the whole object is constrained when the chip fetches one 64-byte block of it, so a 9,000-byte array whose block would fit perfectly is refused, and a definite overwrite between a write and a read is not noticed, so a value that provably never reaches the chip still imposes the demand. Both reproduce inline. Session 3d |
| #179 | Correctness-adjacent: the capability that computes a block number safely refuses an ordinary module array, which pushes authors onto the hand-rolled idiom that needed #159. Found while verifying a claim, not reported. Session 3c |
| #115 | Closed scoped on 2026-11-22. The expert sequence already ships at balanced, speed and size; the redundant pair survives only in canonical `none`, which recorded policy and the issue's own text both freeze. Session 4 |
| #116 | Deferred, measured rather than closed. No public build emits the held-register form at any optimization goal, so there is nothing to remove yet. Session 4b |
| #123 | Correctness-adjacent performance: delivered in session 4 for the optimized candidate, with canonical `none` deliberately unchanged |
| #132 | Already delivered in wave 4 (T-132, 2026-11-15). Listed in session 4's batch by mistake; carried here so the list cannot be derived against it again |

### Session worklist — run top to bottom (2026-11-21)

This replaces the earlier three-line order and the grouping tables above it as the
single live sequence. One row here is one session. Run them in order; when the
list is finished the board is finished, because every open tracker row appears
exactly once below and the wave-delivery row itself closes with the list.

Sessions start cold, so each row carries where to begin. No session may edit
`spec/` or any `*.spec.test.ts` oracle.

| # | Session | Closes | Where to start |
| --- | --- | --- | --- |
| 1 | Non-returning call compiles | T-173 (#173) | Apply the `interruptOwnership.returningBodies` test used at `machine/lower-indirect.ts:36` where an ordinary call is lowered in `machine/lower-call.ts`. The fact is already computed, the remedy is specified, the sibling route has a worked precedent and the issue carries a repro |
| 2 | A binding refusal names its construct | T-174 (#174), two of its five sites | `services/machine-binding-diagnostic.ts` and `services/size-selection.ts:511`. Map the `requestId` the two sites at `machine/bind.ts:561-569` already carry back to a storage request and from there to source. Delivered: missing-storage was in reach after all, since it names a demand. The certificate and failed-function sites moved to session 2b |
| 2b | The two refusals that still report nothing | T-177 (#177) | Delivered, and there were three. `validateHomes` returns an empty identity when the certificate disagrees with the program as a whole, which left that refusal unlocated for the same reason — and it is the one reachable through the real binder without forging a certificate, which made the service half testable. Locating the failed-function site was not the whole repair: three unrelated checks produced that one `null`, and the demand check one step earlier has already proved every declared demand has a home, so a missing-home sentence would have reported a check that passed. Each private helper now names the check that refused — memory the compiler never allocated, a byte that is not part of the storage allocated for a value, or an indirect pointer the compiler placed at the last byte of a page where this processor takes its high byte from the start of that same page, which is the only one naming a hardware rule rather than a bookkeeping disagreement and was indistinguishable from a missing home before. The certificate marker is `closed: true` as a literal type, so reaching it means binding was handed something that is not a certificate at all: the guard stays, the recorded answer is that it has nothing to name, and it now points where its caller tells it — closing #174's third finding. Byte identity measured rather than argued, both files reverted to `185c9d24` and rebuilt: 9/9 PRGs identical by SHA-256. No existing test flipped. Record in `plans/unbound-instruction-location/99-execution-plan.md` |
| 3 | Block-index alignment diagnostic | T-38, T-159 | Delivered, and not as a diagnostic. The measured defect was that the compiler itself placed sprite blocks inside the character-ROM window, which needed a stated demand rather than a message. #158 was ruled not deliverable: its only route is registering a warning code, which means editing frozen `spec/` and re-pointing an integrity anchor that binds release lineage - reserved to the user. Both residuals are errata E-10 |
| 3b | Block number returned by a function | T-178 (#178) | Delivered 8/8. The walk leaves the body through the `return` and resumes at every call site, so two hops, a result named in a local or a module variable first, and one hardware call site among several all fall out rather than needing cases of their own. Two shapes no source program can express decided the implementation and are built directly in the impl tests: a value identity is unique only inside its own body, so walked values are remembered per body — pooling them answers that nothing reaches the chip, the direction that leaves a sprite reading character ROM — and a call cycle terminates only because of the re-entry guard, which the first cycle case written did not actually exercise, because an answer of reaching the chip is final the moment it is found. Review then found two defects in the same walk, both reproducible inline: it never followed a join, so a block number chosen on one path of a conditional was lost with no function boundary involved; and the consumer predicate accepted any argument of any `c64.vic.*` capability, which refused legal programs because an unnecessary demand is mandatory downstream and the largest interval satisfying it is 8,192 bytes. Both fixed, with three previously refused programs now building. Attribution was corrected after measuring the right pair: against `0596547a` this unit **refuses legal programs that compiled before it**, and the decisive witness came from review rather than from me — **two 5,000-byte sprite sources published through their own helpers**, neither larger than a visible interval, which retires any argument that the refused shapes are unusual. The same layout shows the widening fixing a real silent defect, since the second object previously landed inside the character-ROM window and built. #189 owns the repair, which makes those programs build *and* be visible, and leads the remaining order. Two reviewer majors stay open, so whether these unpushed commits wait for #189 is the user's call. A scaling risk the widening introduced is closed by indexing call sites by callee, in the same traversal that indexes definitions. Record in `plans/returned-block-index-visibility/99-execution-plan.md`. Residue filed as #189 and #188 |
| 3c | The safe sprite-block form rejects a plain array | T-179 (#179) | **Delivered.** The refusal was thrown in lowering but its cause was spread over three stages: the address never stayed symbolic, layout demanded an interval of kind asset by name, and nothing constrained the object at all - so accepting the capability without a demand would have placed a sprite at $1400 and refused it for the compiler's own choice of address. One capability-to-field map is now shared by all three. The demand is the capability's contract rather than something to prove, which is the difference from the arithmetic form 3d and 3e worked on. Every ending of the address argument was enumerated before writing, which caught the input side completely and the output side not at all - and that is where three independent reviews converged without sharing notes. `vicScreenSelect` and `vicBitmapSelect` are withdrawn from module storage behind one predicate, because a screen matrix's eight sprite-pointer bytes went unreserved (measured: an unrelated object owned $23F8-$23FF) and a 64-byte bitmap built with the chip fetching 7,936 bytes from its neighbours. `vicCharsetSelect` stays at asset parity. A declared demand now holds at an address the author chose, closing a silent hole no review found. 3d/3e's lesson repeated a third time: following a route removes the protection the fallback gave every route beyond it. Six issues carry the rest: #200, #201, #202, #203, #204, #205. Record in `plans/vic-field-ordinary-storage/99-execution-plan.md` |
| 3d | An inferred visibility demand refuses legal programs | T-189 (#189) | **Delivered.** The demand was stated against the object root and enforced over every byte, so a 9,000-byte sheet publishing one 64-byte block was refused and two ordinary 5,000-byte sheets were refused together. It now carries the effective offset and the fetched extent: both build, and the second sheet moves out of the character-ROM window to $2000 rather than being silently left in it. A runtime index names the elements it can select instead of the span around them, a value-changing operator carries no provenance, a provable replacement stops the walk, and the refusal that remains names the expression it was inferred from. Four reviews found two regressions the unit had introduced - a cancelled complement, and the protection the coarse demand gave unfollowed routes - and both are fixed here: the walk carries the selector arithmetic as sign and displacement, and an escape into a call argument or module storage falls back to the whole-object demand. #190 closed by this unit, #192 and #191 filed. Record in `plans/inferred-block-visibility-extent/99-execution-plan.md` |
| 3e | The four crossings the visibility proof does not follow | T-188 (#188) | **Delivered.** Two of the four crossings are followed exactly; the other two keep the sound fallback and #188 stays open for them. The indirect-call result was the silent one and the issue had not listed all of it: a local pointer, a module pointer and both dispatch-table forms placed their object inside the character-ROM window with nothing reported, and all four now place at $2000. The acceptance cost 3d had recorded is bought back - a 9,000-byte sheet passed to a publishing helper builds with one 64-byte run, and passed to a helper that only pokes builds with no demand at all. Six reviews over two rounds found eleven regressions this unit had introduced, four of them silent and one a compiler crash, and all eleven are fixed here. The lesson from 3d repeated exactly: following a route removes the protection the fallback gave every route beyond it. The answer was to stop enumerating programs - the walk now classifies every operation that can receive a block number, and an ending it only assumes is harmless escapes once the number has crossed into a function, which makes every crossed program at least as safe as before the route was followed by construction. Seven issues carry the rest: #193, #194, #199 over-demands; #195, #198 silent and pre-existing; #196 the emulator gap; #197 the test-file split. Record in `plans/followed-argument-visibility/99-execution-plan.md` |
| 4 | Batch A — capture and retention | #115, #116, #123 (#132 was already delivered in wave 4) | Measured first, and only one of the four was a live defect. #123 delivered in `machine/byte-capture-observers.ts`: eligibility required a volatile raw producer, so an ordinary typed load never qualified. #115's expert sequence already ships at balanced, speed and size; the pair survives only in canonical `none`, which is the frozen reference contract, so it closed scoped. #116's held-register form appears at no optimization goal at all, so it moved to 4b. The batch's premise that one liveness fact served all four did not survive measurement |
| 4b | Held-counter snapshot, once it can be built | Held-ordinal snapshot (#116) | `machine/lower-unary.ts` snapshot selection, `machine/lower-arithmetic.ts` operand order and `services/size-observer-register-counter.ts`. Blocked on a reachable witness rather than on the fix: the x/y counter representation lives only inside the size-candidate internals, so no public build emits the `stx snapshot` form today. Opens when the `size` candidate construction completes, or earlier if the issue's own 24-image harness turns out to be drivable |
| 5 | Batch E — runtime shift | #130; ruling recorded for #129 (#131 was already delivered by T-131) | Measured first, and the seam was neither of the two the issues named. #130 delivered in `machine/optimization-cleanup.ts`: the pass that removes this staged pair already admitted the shape and only demanded N/Z be rewritten inside the same block, so the proof now follows control flow into the shared startup restore. Six bytes and eight cycles on every delivered result, `none` byte-identical. #129's arithmetic dissolved against the moved baseline — `TAX` delivery now costs a byte more unless a named local's home disappears — leaving one real slice, the source read twice with only a store between the reads. Record in `plans/runtime-shift-result-delivery/99-execution-plan.md` |
| 5b | A source read twice across a store | T-180 (#180) | Delivered in the named seam, which this time held the defect. `canOmitRepeatedSourceLoad` sits beside the capture window rather than widening it — the two run in opposite directions, one proved from the store and one from the earlier load — and is wired at the existing `machine/lower-function.ts` call site. No flag proof was needed: the earlier `LDA` already set N/Z from the same byte and a store writes neither, so the repeat is a complete no-op given only that nothing asynchronous can write the source. Three bytes and four cycles on every repeat, `none` byte-identical. Record in `plans/repeated-source-read/99-execution-plan.md`; the private-home variant is the residual |
| 5c | A delivery across a callee's return | T-181 (#181) | Delivered. The interprocedural fact is a new census, `machine/call-site-facts.ts`, consumed by an optional caller fact on the `flagsDead` walk whose absence is the old behaviour exactly. Measurement corrected the issue's premise: the convention hands back no flags, but a boolean-returning body does leave its answer in Z and its caller does branch on it, so the answer is read off every call site rather than off the convention. Six bytes and eight cycles on every delivered result, `none` byte-identical. The walk is now strict about stepping over a call, which the return refusal had been hiding. Record in `plans/return-boundary-delivery/99-execution-plan.md`. One pinned oracle case moved, exactly the one the issue named in advance; two residuals filed |
| 5d | A matched `php`/`plp` pair is not an observer | T-182 (#182) | Delivered in the named seam. The window matcher is its own module, `machine/status-save-window.ts`, and the walk steps over a matched save rather than through it — the reads inside would otherwise read as observations and the writes inside as replacements for a pair the restore puts straight back. The lowering's stack-depth accounting turned out to be lowering-time state the cleanup pass cannot see, so the balance is counted from the four recognised pushes and pulls and anything else touching the stack pointer refuses. Nothing about the stack contents needs proving, because the conclusion drawn is the conservative one. Six bytes and eight cycles on six witnesses, `none` byte-identical. Record in `plans/status-save-window/99-execution-plan.md`. Two pinned oracle cases moved: the one the issue named, and 5c's caller-pushes-status retention, which pinned this same rule |
| 5e | A private or parameter home read twice | T-183 (#183) | Delivered in the named seam. The fact is stated rather than inferred: an interference edge between two storage requests is the statement that they can never share one address, so the allocator's own edges are carried into lowering and the admission reads the answer off them. Sound there because the graph comes from the checked program and later allocation rounds only add edges. Reading the provisional placement's addresses was rejected — that stage re-allocates after lowering and the candidate lowering gets no placement at all. Two bytes and three cycles per repeat, `none` byte-identical. Record in `plans/private-home-repeated-read/99-execution-plan.md`. One pinned answer moved and it is an implementation test, not an oracle |
| 5f | An aggregate element read twice | T-184 (#184) | Delivered, and the issue's open question answered: an operation emitting nothing is already supported here, by five sibling routes in the load lowering, one of them for exactly a constant-indexed element place. So the repair is a sixth sibling rather than a new capability, and the lone-instruction guard was not touched at all — a probe showed the repeat is refused even when it feeds arithmetic, which locates the load in the element read rather than in its consumer. Three bytes and four cycles per repeat, six where three readers share one element, `none` byte-identical. Record in `plans/element-repeated-read/99-execution-plan.md`. No pinned answer moved, which corrects the issue's scope |
| 5g | A returned byte staged in the caller | T-185 (#185) | Delivered, and the issue's premise corrected: its own witness returns a value that leaves a shift loop at a merge block holding nothing but the return, so at the `rts` the flags describe the loop counter and the caller's reload is doing real work — a correct refusal, now pinned by an oracle case saying why. What is removable is the class that satisfies the contract, and the new `machine/return-flag-facts.ts` states it: at every reachable `rts` the last write of A also wrote both flags, weakest exit governing, a block writing no A refusing rather than chasing predecessors, and no body certifying itself. Six bytes, eight cycles and one home per delivered result, `none` byte-identical. Record in `plans/returned-byte-flags/99-execution-plan.md`. No pinned answer moved |
| 5h | A call to a shared helper block settles no flag | T-186 (#186) | Delivered for the reachable half and closed with evidence for the other. The opening question is now transitive — a call encodes no flag, so a wrapper's own callee settles the pair for both — with a visited-label cycle refusal that turns out to be doing real termination work rather than documenting the recursion diagnostic. Six bytes and eight cycles per delivered result, `none` byte-identical. The helper-block half closes as a measured barrier: six constructed shapes all load an operand before reaching the helper, so the pair is already dead and the refusal costs nothing. Record in `plans/wrapper-call-flag-settlement/99-execution-plan.md`. One pinned oracle case moved, the one the issue named in advance. One residual filed: #187, a wrapper whose inner body opens by saving the status register, six bytes inferred rather than measured. Its generated body is flag-transparent end to end — two matched save windows and a return — so the win is not one more window walk but a third answer at a call (preserved, neither rewritten nor observed) plus the caller's walk resuming after its own `jsr`. Wider than 5h, and unscheduled on this board |
| 6 | Batch F — finite-loop schedule | #119 | `machine/fixed-loop-selection.ts`. One row, one seam, nothing to sequence inside it |
| 7 | Batch B — word views and direct indexing | #120, #121, #122, #125 | `machine/lower-aggregate-index.ts`, `machine/word-assignment-forwarding.ts`. Order inside the session: #120 before #121, which is defined as beyond it, and #122 before #125, which needs a strictly stronger alias and observation proof |
| 8 | Batch C — call and return linkage | #118, #124, #126 | `machine/lower-call.ts`, `machine/lower-terminal-byte.ts`, `machine/lower-aggregate-return.ts`. Settle first how #124 and #126 are measured: they overlap on the helper figure and are not additive, so measuring them separately double-counts the batch |
| 9 | Batch D — cross-call register availability | #104, #127, #128 | `machine/lower-function.ts:1030`, `machine/lower-call.ts`. The only batch whose fact does not exist: nothing records which registers a callee provably leaves alone, and a cached index base is re-read after a call precisely because the call may have clobbered it. Build that fact, then consume it twice |
| 10 | Boing-ball remaining output | T-168 | `../boing-ball-parity/99-execution-plan.md`. Re-measure first: the 709-byte gap against the hand-written twin is largely the deficits sessions 4 to 9 close, so this session closes what is left and the whole-frame timing |
| 11 | Acquisition size gap | T-145 | `../acquisition-size-gap/08-closeout.md`. Re-measure the 58/70-byte gap after the batches, then either admit the 149-byte looped form to the size frontier or close the row on the new measurement |
| 12 | Composite parity closeout | #95, NMI witness (#70/#83/#96/#97), Input-diagnostic output (#104/#51) | The closeout document linked from each row. These are measured bundles rather than work: they close on the output sessions 4 to 9 produce, which is why they come after them |
| 13 | Reopen whole-input cost closure | DEF-16, Input recipe mixtures | `../whole-input-cost-closure/00-index.md`, stopped at 29/40 with acquisition 2442 against 963. Run it after the seams land, so it measures the accumulated result instead of the deficits, and it turns the analytical whole-program figures in sessions 4 to 9 into actual ones |
| 14 | Bound precedence qualification | #134 | Already executing within a verified bound; it needs the full phase and frontier that session 13 qualifies |
| 15 | Partial-initializer inlining | T-155 | `../partial-initializer-inlining/08-closeout.md`. Build the missing unit first - dropping the initializer routine breaks artifact evidence because the initializer source spans no longer map to an emitted machine function - then land the inline selection that was already reached and reverted |
| 16 | Cross-join NMI consumption | T-152 | `../cross-join-nmi-consumption/99-execution-plan.md`. Needs a per-predecessor consume and an A merge: pop in both arms, insert the else-arm pop, forward the join load from A, drop the wrapper X save |
| 17 | Early raw-argument delivery | T-135 and its #135 twin row | `../early-raw-argument-delivery/99-execution-plan.md`. Needs a first-class early-delivery fact: the contiguous four-item delivery window and positional `unchanged` model cannot represent the retarget. Cheaper after sessions 8 and 9 |
| 18 | Predicate-proved terminal return | T-133 and its #133 twin row | `../predicate-proved-return/99-execution-plan.md`. Needs a layout-level `jmp`-only replacement with a zero-growth check; the current bridge is a fallthrough, so the 3-byte return grows 261 to 264 |
| 19 | Global constant fill | #117 | Decide first, then implement or close: the compact form saves 755 bytes and costs 2041 cycles, so it asks what size mode may trade. Not a code question until that is answered |
| 20 | Host allocation costs | T-13, T-17 | The finding sections linked from both rows. Report-only host costs with no measured latency failure and no emitted behavior or cost defect, which is why they are this late |
| 21 | Retained specification copies | T-07 | `../nmi-proof-scope-correction/99-execution-plan.md`. `spec/` is frozen, so this opens with the user authorizing a bounded maintenance gate and the separate stability-description ruling. If that gate is authorized it also decides errata E-10, whose missing warning contract is the only thing blocking #158 and the explicit-placement half of the block-index work - so the gate is worth more than this row alone suggests |
| 22 | Producer and adapter evidence | T-19, V4-ASSET-1 | Blocked on artifacts only the user can supply: the GoatTracker 2.77 archive with member hashes, its music-only and SFX exports, ABI and writable ranges, and the CharPad 3.88 CTM producer |
| 23 | Windows and macOS qualification | V4-HOST-1, DEF-3 | Blocked on hardware only the user can supply: a Windows x64 host and a macOS arm64 or x64 host for the install, package, VSIX, tool-discovery and process-tree cancellation journeys |
| 24 | Physical C64 qualification | V4-HW-1 | Blocked on hardware only the user can supply: a C64, a real drive and both SID revisions. Every physical row stays `Unknown` until then, and emulator claims remain `VICE-verified / hardware-unverified` |
| 25 | Close the wave-delivery row | T-31 | This plan. It closes when every session above is done. Numbered entries are never renumbered - the order is referenced by number from the rows and the gate below - so an insertion takes a suffixed number instead |

Sessions 4 to 9 share one gate and it is narrower than it looks. Whole-program
reclosure is not available until session 13, so each batch proves exactly two
things: the measured witness in each row moves toward its expert target, and the
frontier guards stay green at `test/rd05/input-acquisition-output.spec.test.ts:24`
and `test/rd05/input-saved-query-output.spec.test.ts:23`, with the optimizer-mode
pair at `test/rd08/optimizer-acquisition-output.spec.test.ts:315` and
`test/rd08/optimizer-saved-output.spec.test.ts:221`. Rows that overlap are
measured together, because their savings do not sum.

This list holds the order and nothing else. Each session's state lives in its
roadmap row and its method lives in its own plan folder, most of which already
exist. Nothing is duplicated across the three, so none of them can disagree with
another: a session updates its row when it finishes, and this list is edited only
when the order itself changes.
