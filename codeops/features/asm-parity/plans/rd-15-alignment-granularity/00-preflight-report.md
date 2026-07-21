# Preflight Report: Alignment Granularity (plan)

> **Artifact**: [`codeops/features/asm-parity/plans/rd-15-alignment-granularity/`](00-index.md) — 8 documents, 920 lines
> **Implements**: asm-parity/RD-15 ([#69](https://github.com/blendsdk/blend65/issues/69))
> **Scanned at**: `8a47ada` (branch `feat/asm-parity`)
> **Date**: 2026-07-21 · Iteration 1
> **CodeOps Skills Version**: 3.11.0
> **Status**: ✅ **PREFLIGHT PASSED** — all 10 findings resolved, 2026-07-21

> ⚠️ **SAME-SESSION REVIEW.** This plan was authored in the session that reviewed it. The
> 13-dimension scan was therefore fanned out to four independent auditors on a different model
> family, each blind to the authoring rationale, and every finding below was re-verified in the
> lead context against the code before being recorded. Consider a fresh session for the next
> iteration if one is needed.

## Method

| | |
|---|---|
| Recon | Every cited `file:line` in all 8 documents resolved against the tree at `8a47ada` |
| Scan | 13 dimensions across 4 clustered auditor dispatches (① soundness ② grounding ③ delivery ④+⑤ risk & fit) |
| Grounding | ACME available locally; auditors compiled `balloon`, `balloon-color`, `boing-ball` and probe programs for every ST-15 shape rather than reasoning from the documents |
| Merge | Lead context deduped across clusters, renumbered to one `PF-NNN` sequence, and re-verified each finding independently |

**Convergence signal**: the call-site miscount (PF-003) was found independently by three of the four
clusters; the ST-13f red-phase defect (PF-001) by two, one of them with build evidence.

## Verdict summary

| Severity | Count |
|---|---|
| 🔴 CRITICAL | 0 |
| 🟠 MAJOR | 1 |
| 🟡 MINOR | 6 |
| 🔵 OBSERVATION | 3 |

Every finding is a **document correction**. Not one changes the design, the phase structure, the
mechanism, or the test inventory — the plan's codebase grounding reproduced exactly on every
measurement any auditor could re-derive.

---

## 🟠 MAJOR

### PF-001 — The red-phase table misclassifies ST-13f, and three `% 64` guards escape the perturbation discipline

**Dimension**: 7 (Testability) · **Location**: `07-testing-strategy.md:80`, `03-02-oracles-and-ledgers.md:61`

`07:80` files ST-13f under *Goes RED in Phase 2* on **both** clauses. It cannot be. `balloon-color`'s
image resolves to `$0A00` today (measured by live build), and `$0A00 % 64 === 0`. The plan states
the governing implication itself — *"`% 256 === 0` implies `% 64 === 0`, and all three images land
on multiples of both"* (`03-02:57`) — so a `% 64` clause cannot be red on any 256-aligned address.
Pre-implementation, the re-derived ST-13f fails on its **directive-text clause only**, exactly like
ST-C15 and ST-13j.

`03-02:61` propagates the same inversion (*"only `balloon-color` … fails deterministically before
the implementation lands"*). The correct claim — which `02-current-state.md:64-66` and RD-15 M4
already state properly — runs the other way: the **un-re-derived** `% 256` oracle fails
deterministically *after* implementation, at `$0980`. That is a forward tripwire, not a red phase.

**Why this is MAJOR rather than a wrong table cell.** The consequence is that the `% 64` clauses of
**all three** re-derived oracles fall outside the pre-green guard set — ST-13f's by misfiling,
ST-C15's and ST-13j's because the "directive-text clause only" row (`07:79`) never lists their
address halves anywhere. `07:98-100` mandates perturb-and-restore for every pre-green guard
precisely because *"this feature manufactures unfailable guards"*. Three guards on the exact
property the feature exists to establish would ship unproven. Task 2.3 also gates on checking
against this table **specifically** (`99:115-119`), so an executor working at clause granularity
finds the table wrong and has no sanctioned way to proceed.

**Options**

| | Option | Assessment |
|---|---|---|
| (a) | Move ST-13f to *directive-text clause only*; reword `03-02:61` to the forward direction; add all three `% 64` clauses to the pre-green guard set so task 2.3's perturbation step covers them | **Recommended.** Fixes the wrong cell and the gap it hides. Three documents, no design change |
| (b) | Correct the ST-13f row only | Leaves three guards outside the perturbation discipline — the substantive half of the defect |
| (c) | Drop the `% 64` clauses and pin directive text alone | Rejected: the address clause is what catches a directive that assembles but does not align (`align-mixed.spec.test.ts:78-81`) |

**Recommendation: (a).**
Confidence: high — the arithmetic is unconditional and the build measurement confirms it.
Hardening: found independently by two auditors; the escalation to MAJOR is the lead's call, on the
guard-coverage consequence neither auditor's severity reflected.

---

## 🟡 MINOR

### PF-002 — `PAGE_BOUNDARY` is consumed in Phase 1 but created in Phase 2

**Dimension**: 2 (Implicit Assumptions) / 11 (Ordering) · **Location**: `99-execution-plan.md:69-75` vs `:120`, `03-01-demand-and-emission.md` §2

Task 1.5 gives `lowerAddressOf` the default `demand: AlignBoundary = PAGE_BOUNDARY`. Task 2.4 says
Phase 2 **adds** `PAGE_BOUNDARY`, `BLOCK_BOUNDARY`, `BLOCK_SHIFT` and `boundaryOfShift`. Executed
literally, Phase 1 does not compile. `03-01` §2 presents all four as one Phase-2 block while its
signature work is Phase 1's.

This is the finding most likely to actually bite: the project's runtime-ambiguity protocol tells a
literal-minded executor to **STOP** on exactly this kind of contradiction, costing a round trip.

**Recommendation**: move `PAGE_BOUNDARY` alone into task 1.5's edit list; task 2.4 adds
`BLOCK_BOUNDARY`, `BLOCK_SHIFT` and `boundaryOfShift` only. Split the `03-01` §2 code block to match.

### PF-003 — `lowerAddressOf` has nine call sites, not ten

**Dimension**: 13 (Stale Assumptions) · **Location**: `02-current-state.md:41`, `03-01:85`, `99:124-125`, `00-ambiguity-register.md:25`

Measured: nine call sites — `:372, :523, :1080, :1504, :1645, :2519, :2570, :2608, :2641`. `:1845` is
the definition and `:1500` a doc `@link`. The plan's own enumeration lists nine while the prose says
ten; the correct statement is **eight of the nine** have no divisor.

Behaviourally inert (the parameter is defaulted), but the sentence carries weight — it *is* M2's
structural guarantee — and an executor verifying task 2.4 by counting comes up one short.

**Recommendation**: correct the count in all four places; the enumerated line lists are already right.

### PF-004 — RD-15's `Math.max` sentence is never back-propagated

**Dimension**: 4 (Completeness Gap) · **Location**: `03-02:76-77`, `99:161-166` vs `requirements/RD-15-alignment-granularity.md:271`

RD-15:271 prescribes `map.set(sym, Math.max(existing ?? 0, demand))`. Under
`Map<string, AlignBoundary>` that fails to typecheck twice over — `Math.max` returns `number`, and
`0` is not an `AlignBoundary`. AR #113 records the consequence (*"a comparison, not `Math.max`"*)
and the plan repeats it three times, but task 3.3 back-propagates only **two** corrections. Post-
closeout, RD-15 would still prescribe uncompilable code while success criterion 6 (`99:221`) claims
no ledger contradiction remains.

**Recommendation**: extend `03-02` §3 correction 4 and task 3.3 to replace the insertion sentence in
RD-15's *Combining demands* section with the comparison form.

### PF-005 — Gap 2 says no budget or ratchet covers the three programs; `balloon` has both

**Dimension**: 13 (Stale Assumptions) · **Location**: `02-current-state.md:72-73`

`budgets.json:83` carries `balloon: {bytes: 318, …}`, `budgets.spec.test.ts:113` maps `balloon` into
the exact-ratchet suite, and `SCOREBOARD.md:9` carries a balloon row. The plan contradicts itself
twice — `00-index.md:27-28` and task 2.7 both state balloon's budget correctly.

The operative conclusion survives: balloon lands on `$0900` under either boundary and the ratchet
only fails on growth, so neither can catch a boundary regression. Only the reason is misstated.

**Recommendation**: reword to *"the budget and ratchet that do cover `balloon` cannot fail on a
boundary regression"* rather than claiming none exists.

### PF-006 — AR #113 credits the existing doc comment with reasoning it does not contain

**Dimension**: 13 (Phantom Reference) · **Location**: `00-ambiguity-register.md:25`

AR #113 justifies keeping the allowlist in `foldedAddressByte` because its doc comment
*"already owns the sprite-block idiom and the reason `/ 16384` is a VIC-bank read rather than a
placement demand."* The comment (`lower.ts:2539-2556`) owns the sprite-block idiom but says nothing
about VIC banks — `grep -c "16384\|VIC\|bank"` over `lower.ts` returns **0**. The reasoning exists
only in the plan's *new* `boundaryOfShift` doc.

The decision stands on its other grounds; only this clause is phantom.

**Recommendation**: trim the clause to the sprite-block idiom, noting the VIC-bank rationale arrives
with `boundaryOfShift`.

### PF-007 — The Phase 1 RED description misstates the sixteenth site's failure mode

**Dimension**: 7 (Testability) · **Location**: `99-execution-plan.md:63-64`, `07-testing-strategy.md:82-83`

Both say the sixteen sites fail by *"naming a field that does not exist"*. Fifteen do (TS2339).
The sixteenth, `assemble.impl.test.ts:155`, is reshaped to **omit** `pageAligned` from a typed
literal while the field is still required — a missing-required-property error instead. RED still
occurs on all sixteen, confined to three test files.

**Recommendation**: one-line wording fix in both documents.

---

## 🔵 OBSERVATIONS

| # | Finding | Location | Suggested |
|---|---|---|---|
| **PF-008** | The coincidence comment is cited at `:76-79`; it is at `:78-81`. The RD-stage register already cites it correctly | `00-ambiguity-register.md:29` | Fix the range |
| **PF-009** | Task 3.2's premise *"sitting uncommitted in the working tree"* is true now but goes stale the moment this plan is committed, leaving a Phase 3 executor reading it against a clean tree. The load-bearing instruction (verify, do not re-apply) is stale-proof | `99-execution-plan.md:156-160` | Rephrase to "already applied during RD authoring" |
| **PF-010** | `E10216` is cited as `lexer.ts:238`. The line is right; the path is `packages/frontend/src/lexer/lexer.ts` — the repo has a `lexer/` subdirectory, so the bare filename is under-specified | `00-ambiguity-register.md:38`, `03-02:77` | Qualify the path |

---

## What survived refutation

Recorded because a preflight that reports only defects misrepresents the artifact. Each item below
was actively attacked by at least one auditor and held:

| Claim | Verification |
|---|---|
| The sixteen-site list is **complete** | Repo-wide sweep found `pageAligned` at exactly those 16 test sites plus the 3 production sites the plan owns. Nothing in `compiler`, `cli`, `language-server`, `test-harness` |
| No committed artifact captures the IL shape | The only `.snap` files are frontend parser/lexer; none of the 14 goldens contains `!align`; the hand twin `examples/balloon/balloon.asm` has no `!align`, confirming the staging-copy premise of AC-14 |
| No 4-arg hazard | All nine calls pass exactly three positional args; the function is module-private, no aliasing or `.apply` |
| `addressTakenConsts` is one shared Set | Created `lower.ts:227`, threaded to both context kinds; the module-scope-`&` behaviour is pinned by ST-C19b (`lower-address-of.spec.test.ts:337`) |
| `print-instr.ts` needs no change | The align case renders generically from `boundary`; `instr-program.ts:202` is its only production producer |
| A demand can never orphan | No unreferenced-data elimination exists; every `constValues` entry with bytes becomes a `ConstDataEntry`, keyed by the same `constDataSymbol` |
| `AlignBoundary` needs zero casts | The only `number`-typed consumer is the align directive, where `AlignBoundary → number` is a legal widening |
| The ST cases are writable and observable | `build()` exposes `asmText`, `symbolMap` and `binary`; probes confirmed ST-15f's named-const divisor folds today and ST-15g's `__var_Main_buf` resolves (`$2000`) |
| Every measurement | `balloon` 320 B / `$0900`; `balloon-color` 584 B / `$0A00`, pad 188; `boing-ball` `$0B00`, pad 1; `align-mixed` pad 194. Predicted post-change 19/60/1 and 584→456 arithmetically consistent |
| No committed pin breaks when `balloon-color` moves | Tier `demo`; absent from `budgets.json`, `SCOREBOARD.md`, `twins.json` and the goldens. Its only pin is its own spec test, which the plan re-derives |
| R15 holds | Change surface is `codegen` + `test-harness`; no task touches `frontend` or `language-server` |
| No security findings | The boundary is compiler-derived from a closed allowlist, never source-supplied; the ACME bitmask hazard is closed at the type |
| No scope creep | Every task maps to an RD-15 Must-Have or AC; AR #119 and #121 are scope *reductions* |
| All 15 ACs owned | Each maps to an ST case, a task, or an explicit closeout-by-measurement entry |

## Relationship to the Ambiguity Register

[`00-ambiguity-register.md`](00-ambiguity-register.md) records decisions made *during* authoring
(AR #113–#121). This report records defects found *after*. Two findings touch register entries —
PF-006 (AR #113's phantom clause) and PF-008 (a citation range) — and neither disturbs the decision
itself. No register decision is re-litigated here.

## Decisions

**User ruling, 2026-07-21: apply all ten recommended fixes.** No finding was deferred or accepted
as a standing note, so the plan carries no open preflight debt into execution.

| # | Sev | Decision | Applied in |
|---|---|---|---|
| PF-001 | 🟠 | Option (a) — ST-13f moved to *directive-text clause only*; the forward-tripwire direction restated; the `% 64` clause of **all three** re-derived oracles added to the pre-green guard set, so task 2.3's perturbation step covers them | `07:79`, `07` red-phase prose, `03-02:57-61`, task 2.3 |
| PF-002 | 🟡 | `PAGE_BOUNDARY` moved into task 1.5; task 2.4 now adds the other three only; `03-01` §2 states the phase split at the code block | task 1.5, task 2.4, `03-01` §2 |
| PF-003 | 🟡 | Corrected to *eight of the nine* in all four places; the definition site named so the count can be re-derived | `02-current-state:41`, `03-01:85`, task 2.4, AR #113 |
| PF-004 | 🟡 | Added as ledger correction **4b** and a third back-propagation target in task 3.3 | `03-02` §3, task 3.3, AR #113 |
| PF-005 | 🟡 | Reworded: `balloon` *does* carry a budget inside the ratchet suite; the reason it cannot catch a boundary regression is that the ratchet is a **ceiling** and fails only on growth (verified: `256 vs 256` passes, `300 vs 256` throws) | `02-current-state` Gap 2 |
| PF-006 | 🟡 | Clause trimmed; the VIC-bank rationale is now stated as arriving with `boundaryOfShift`, and the comment range corrected to `:2539-2556` | AR #113 |
| PF-007 | 🟡 | Both documents now name the two distinct failure modes | task 1.3, `07` red-phase prose |
| PF-008 | 🔵 | Range corrected to `:78-81` | AR #117 |
| PF-009 | 🔵 | Rephrased — the edits land with this plan's own commit; expect them present, not pending | task 3.2 |
| PF-010 | 🔵 | Path qualified to `packages/frontend/src/lexer/lexer.ts:238` | AR #121, `03-02` §3 |

**Net effect on the plan**: task counts, phase structure, milestone mapping, the mechanism and the
ST inventory are all unchanged. Task 2.4 loses one constant to task 1.5; task 3.3 gains a third
back-propagation target. Still **3 phases / 24 tasks**.
