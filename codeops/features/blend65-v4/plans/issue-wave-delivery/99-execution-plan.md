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
| 3 | Done (bounded) — #160 done; #159 alignment slice done with bank diagnostic blocked on #158; #145 measured non-win | `../block-index-immediate-fold/08-closeout.md` · `../runtime-block-index-alignment/08-closeout.md` · `../acquisition-size-gap/08-closeout.md` |
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
| #174 | Correctness-adjacent: four of five machine-binding refusals still report no source location. The fifth already carries a span, and two of the four discard a `requestId` that maps back to a storage request and from there to source, so those two are a bounded continuation. The remaining two are not yet solved: a certificate failure and a missing-storage failure have no failing instruction to witness, so neither can reuse the instruction span, and the issue records that as a known difficulty rather than a plan |

### Recommended order

Correctness before parity, as Wave 6 established, and within parity the batch
whose enabling fact is already proved before the batch that must build one.

| Order | Work | Why here |
| --- | --- | --- |
| 1 | #173, then #174 | A refused legal program and an unlocatable refusal both block an author who has no workaround. Neither waits on anything |
| 2 | T-168 continuation | In flight, and the headline output-quality figure on the board |
| 3 | The #158 ruling | One user decision releases T-38 and T-159's last task, so it is the cheapest unblocking in the list |
| 4 | Batch A, then B | The largest measured per-iteration wins, and both consume liveness and alias facts the existing seams already carry |
| 5 | Batch E, then C, then F | E starts from a partly landed slice; C must first settle the #124/#126 overlap; F is one row and can follow at any point |
| 6 | Batch D | Ordered last among the parity batches because it is the only one that must build a new fact — callee register preservation — before any row in it can be measured |

The host-cost pair, the external-dependency rows and the blocked rows are not in
this order on purpose. They are not ready, and placing them in a sequence would
imply otherwise.
