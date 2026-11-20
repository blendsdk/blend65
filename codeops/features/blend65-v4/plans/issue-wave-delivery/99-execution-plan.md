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
