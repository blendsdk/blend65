# Preflight Report: RD-05 Block Layout (implementation plan)

> **Status**: ✅ **PREFLIGHT PASSED** — all 27 findings resolved and applied
> **Iteration**: 1 (first scan)
> **Artifact**: implementation plan at `codeops/features/asm-parity/plans/rd-05-block-layout/`
> **Codebase Grounded**: 41 source/test/config files examined, 41 references verified
> **Method**: 5-cluster preflight-auditor fan-out on a different model family, plus one
> hardening challenger over the major batch
> **Last Updated**: 2026-07-20

> **Cross-session review.** The plan was authored in a previous session, so the same-session
> bias caveat does not apply. The scan clusters and the challenger ran on Fable; the lead
> context ran on Opus. Every load-bearing numeric claim was additionally re-derived
> independently by the lead.

## Codebase Context Summary

**Tech Stack:** TypeScript (ESM, NodeNext, strict) · Yarn v1 workspaces · Turborepo · Vitest ·
ESLint v9 flat config · Node 22. An AOT compiler for 6502 retro platforms.

**Architecture:** Lexer → Parser → Analyzer → SFA → IL/Optimizer → Codegen → Emitter across 10
`@blend65/*` packages, with a load-bearing R15 boundary (`frontend` and `language-server` must
never import `codegen`).

**Key files examined:** `compiler/src/api/emit.ts` · `compiler/src/api/build.ts` ·
`codegen/src/instr/translate.ts` (2250 lines) · `codegen/src/instr/peephole.ts` ·
`codegen/src/instr/print-instr.ts` · `codegen/src/instr/instr-program.ts` ·
`codegen/src/il/{cfg,termination,instruction}.ts` · `codegen/src/il/optimizer/*` ·
`core/src/instr-model/{stream,operand}.ts` · `config/src/defaults.ts` · `eslint.config.mjs` ·
the 14 `*.asm.golden` files · `test-harness/{budgets.spec.test.ts, testing/*, run/*}` ·
`test/golden/{budgets,twins}.json` · `scripts/gen-parity-scoreboard.mjs`.

**Verified sound (recorded so a re-scan does not re-litigate):** every one of the three seams and
all four jump-emission sites exist as cited. The corpus baseline reproduces exactly — 14 goldens,
105 `JMP`s, 47 intra-function fall-through across 9 goldens, 13 trampoline blocks, 3896 bytes /
5023 static cycles, `guards` at 23 jumps, 5 branch-free goldens. The `rasterpoll` hand-trace
matches the golden line-for-line and yields the plan's exact 3-instruction / 7-byte / 9-cycle
result; the `guards` 24 → 18 inversion arithmetic is correct and both inversions are
polarity-legal. The relaxation displacement formula, its boundary conditions, and its
monotone-termination argument are all correct. The "byte- and cycle-identical reconstitution"
claim for an inverted-then-relaxed branch was worked through and holds. All five comparison
framings survive elision and inversion. `translateComparison` swaps operands but not targets, so
the true/false decision table holds at every site. The four consult sites are complete — a grep of
every `JMP` emission in `translate.ts` finds no fifth block tail.

**Refuted during the scan (do not re-raise):** the `origin`-directive offset hazard (directives
live only in the preamble and const-data streams, never in a function code stream); the IL-pass
convergence question (one pass each suffices); `print-il.golden.spec.test.ts` (calls `lowerToIL`
directly, never `optimizeIL`); the startup-shim-variant derivation (`functionCanReturn` on the
post-removal program sees the same reachable set); the third `translate.impl.test.ts` fixture at
`:468-495` (loose assertions, survives inversion).

## Summary by Dimension

| # | Dimension | Findings | Highest |
|---|-----------|----------|---------|
| 1 | Ambiguities | 3 | 🟡 |
| 2 | Implicit Assumptions | 3 | 🟠 |
| 3 | Logical Contradictions | 2 | 🟡 |
| 4 | Completeness Gaps | 7 | 🟠 |
| 5 | Dependency Issues | 1 | 🟠 |
| 6 | Feasibility Concerns | 2 | 🟠 |
| 7 | Testability | 5 | 🟠 |
| 8 | Security Blind Spots | 2 | ⚪ |
| 9 | Edge Cases | 2 | 🟡 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 2 | 🟠 |
| 12 | Consistency | 3 | 🟡 |
| 13 | Codebase Alignment | 5 | 🟠 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 6 | ✅ all resolved |
| 🟡 MINOR | 15 | ✅ all resolved |
| ⚪ OBSERVATION | 6 | ✅ all resolved |

**Resolution.** The user approved the batch as recommended on 2026-07-20 and the fixes were
applied to the plan in the same session. 18 resolutions are recorded as AR #40–#57 in
[00-ambiguity-register.md](00-ambiguity-register.md); three amended the RD itself (AC-10, AC-13 and
the label-re-anchoring hazard text) and are cross-referenced in the RD's own preflight report as
PF-050…PF-052. Task numbering in the execution plan re-flowed from 54 to 58 tasks; the phase shape
is unchanged.

---

# MAJOR findings

### PF-001: ST-B27 cannot be written in the package it is assigned to 🟠 MAJOR

**Dimension:** 5 (Dependency Issues) / 7 (Testability)
**Location:** `07-testing-strategy.md` suites table + ST-B27 + the AC-7 coverage row; `99-execution-plan.md` task 4.1
**Codebase Evidence:** `packages/codegen/package.json` declares only `@blend65/core` and `@blend65/frontend` — no compiler dependency, not even dev. The `--optimize` flag is read at `packages/compiler/src/api/emit.ts:139-141`.

**The Problem:** ST-B27 is the **sole** stated proof of AC-7, and it is assigned to
`codegen/src/instr/block-layout.spec.test.ts` — a package that cannot reach the flag it must vary.
Found independently by three of the five clusters. Two further AC-7 clauses are orphaned: AC-7
enumerates AC-4 ("no block unreachable from its function's entry"), which has no textual predicate
anywhere in the plan for non-golden output; and "both out-of-range fixtures assemble under both
gatings" is assigned to no test case at all.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Move ST-B27 to a `test-harness` suite and extend `range-branches.spec.test.ts` with the both-gatings assembly clause | One suite proves all of AC-7 through the real pipeline; test-harness has compiler as a dep and ACME in CI | Splits one ST id out of the layout suite |
| B | Move it to a `compiler`-package spec driving `emitAsm` with both configs | Closest to the gate | Fragments AC-7 — the "both fixtures assemble" clause needs ACME machinery living in test-harness |
| C | Respecify at codegen level as "with and without `optimizeInstr` applied" | No file moves | Tests a proxy, not the gate. Near-vacuous today (`V1_RULES = []`) and wrong once RD-06 lands rules — the exact scenario AC-7 was worded to survive |

**Recommendation:** Option A. AC-7 is a pipeline-level property; proving it below the seam that
implements the gate proves a proxy. Two sub-decisions must be recorded in the same edit: whether
AC-7's AC-4 leg gets a real emitted-stream reachability predicate or a narrowed claim; and that
ST-B27 (Phase 4) wants the ST-B39/B40 scan predicates that Phase 5 authors — so those helpers move
earlier or the ordering is accepted explicitly.

**Confidence:** High. **Hardening:** challenger concurred on option and severity; it contributed
the AC-4-predicate and scanner-ordering sub-decisions.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-002: `invertBranch` ships wired in Phase 1; its oracle is authored in Phase 3 🟠 MAJOR

**Dimension:** 11 (Ordering & Sequencing)
**Location:** `99-execution-plan.md` tasks 1.5, 1.7, 3.1, 3.2; `00-index.md` delivery shape; `03-02-branch-tail.md` header
**Codebase Evidence:** relaxation consumes `invertBranch` per `03-03-relax-branches.md`; the Phase 1 corpus proof is a no-op precisely because no golden carries an out-of-range branch, so it exercises the polarity table zero times.

**The Problem:** Task 1.5 implements `invertBranch` plus the 8-entry polarity table in Phase 1 and
task 1.7 wires it into production, but ST-B20 (all eight partners plus involution) and ST-B21
(non-conditional → `undefined`) are authored in Phase 3. Two consequences: the component the plan
itself flags as having an invisible failure mode ("a wrong table is invisible in output") ships
live with no dedicated oracle for two phases; and task 3.2's "Verify **red**" is unachievable for
those cases because the implementation already exists. Three documents also disagree on when the
module exists — `00-index.md` and `03-02`'s header both present it as a Phase-3 unwired artifact.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Author ST-B20/B21 as their own Phase 1 task (red before 1.5); task 3.1 extends the same file with ST-B16–B19 | Restores red-first in both phases; keeps AR #38's one-suite-per-module naming | Splits one suite's authoring across two phases |
| B | Move the `invertBranch` cases into `relax-branches.spec.test.ts` and re-home the ST ids | Single-phase authoring | Buries the polarity oracle in the wrong module; 3.2's red gate still partly green |
| C | Move `invertBranch` to Phase 3, give Phase 1 relaxation a local table | Preserves the stated phase shape | Violates the plan's own "one table, one place"; creates the two-table drift that *is* the invisible failure mode |

**Recommendation:** Option A, plus correcting `00-index.md` and `03-02`'s header to state the
Phase-1/Phase-3 split that `99-execution-plan.md` already encodes.

**Confidence:** High. **Hardening:** challenger concurred; it noted the residual risk is closed by
ST-B20's own involution clause.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-003: the 16-bit unsigned inversion has no specified mechanism 🟠 MAJOR

**Dimension:** 2 (Implicit Assumptions) / 13 (Architecture Mismatch)
**Location:** `03-02-branch-tail.md` wiring table row 4; `99-execution-plan.md` task 4.5
**Codebase Evidence:** `translate.ts:1299` emits the final `BCC`/`BCS` **inside** `wordUnsignedDecision` (`:1279-1300`), a helper called from both the branch-tail arm (`:1253`) and the value-tail arm (`:1262`). The caller at `:1250-1256` owns only the trailing `JMP` at `:1254`.

**The Problem:** The plan instructs the executor to "plan over the final `BCC`/`BCS` of
`wordUnsignedDecision`" from a call site that cannot reach that emission. No mechanism is specified
for delivering an inverted opcode into the shared helper, and the three real mechanisms differ
materially in blast radius. Under the plan's own zero-ambiguity standing rule this stops work
mid-Phase-4 — the phase tagged **sensitive**.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Optional final-branch descriptor parameter on `wordUnsignedDecision`, defaulted so the value-tail call at `:1262` is textually untouched | One plan computation, one polarity table; the default proves the value path unchanged | The helper's docstring contract ("falls through only when the answer is 'no'") becomes false and must be rewritten |
| B | Move the `:1299` emission out of the helper into the branch arm | Makes "framing-internal branches are never inverted" structurally true | Duplicates the `wantLess ? BCC : BCS` mapping across two call sites — polarity-drift surface in the trickiest framing |
| C | Post-hoc rewrite of the last emitted entry in the caller | Smallest diff | Action-at-a-distance keyed on an unstated invariant |

**Recommendation:** Option A. Also check ST-B24's wording ("the two decisions inside
`wordUnsignedDecision` are untouched") against whichever mechanism is chosen, so the oracle and the
mechanism describe the same boundary.

**Confidence:** High. **Hardening:** challenger independently reached option A over B (I had
initially leaned B); its argument — that hoisting duplicates the polarity mapping in the one
framing most prone to polarity drift — is the stronger one. Pick changed.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-004: ST-B32's input is unconstructible as written 🟠 MAJOR

**Dimension:** 7 (Testability)
**Location:** `07-testing-strategy.md` ST-B32
**Codebase Evidence:** the algorithm in `03-03-relax-branches.md` rewrites only out-of-range branches; a relaxed branch becomes an absolute `JMP` and leaves the candidate pool (monotonicity).

**The Problem:** ST-B32 specifies "two branches **each in range** only until the other relaxes →
the fixpoint relaxes both". If both are in range at iteration 1, nothing relaxes and the fixpoint
terminates as the identity — so a correct implementation **fails** this test. This project
deliberately configures its spec-test author to transcribe an enumerated case list rather than
re-derive it, and the immutable-oracle rule then indicts the implementation. It detonates in
Phase 1, the wired phase, inside the one artifact category the process cannot self-correct.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Reword to the cascade: one branch initially out of range whose relaxation (+3 bytes) pushes a second, sitting at +126/+127, out of range on the next iteration | The only faithful reading of AC-10's "chain of mutually displacing branches" | The geometry must be stated concretely enough that a transcribing author cannot get it wrong |
| B | Split into two cases — cascade relaxes both; both-in-range-at-boundary relaxes neither | Explicit | The second case already exists as ST-B31 — ships a duplicate |

**Recommendation:** Option A only. True *mutual* displacement is unconstructible in principle here
(a relaxed branch leaves the pool), so AC-10's phrasing deserves a touch-up in the same edit.

**Confidence:** High. **Hardening:** challenger concurred and explicitly rejected option B as
duplicating ST-B31 — a check I had not made.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-005: the per-program `bytes` ratchets go permanently slack 🟠 MAJOR

**Dimension:** 4 (Completeness Gaps)
**Location:** `03-04-corpus-supersession.md` §4; `99-execution-plan.md` task 4.15
**Codebase Evidence:** `packages/test-harness/test/golden/budgets.json` carries a `bytes` budget for all 15 programs; `budgets.spec.test.ts:242` asserts `checkCostWithinBudget(name, "assembled bytes", bytes, program.bytes)` for every one of them, and `budget-loader.ts:217-222` is a pure `actual > budget` test — under-budget passes silently.

**The Problem:** The transforms shrink at least 10 programs, but the plan re-derives only the four
cycle **windows** plus the two hand-derived cycle constants. The `bytes` ratchets are named nowhere
in the plan. Nothing goes red; the ratchets simply stop biting — violating the plan's own stated
discipline ("an optimization tightens the budget in the same change") and leaving AC-9's "no
individual fixture regresses" as closeout narrative rather than a committed gate. **`balloon` has
no golden**, so for that program the `bytes` ratchet is the *only* size gate, and it is the one
that goes slack with nothing behind it.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Extend task 4.15 to re-derive every program's `bytes` from the regenerated binaries; the five branch-free programs must re-derive to their current values exactly | One more column in a step the phase already performs; converts AC-9 into a committed gate; the branch-free five become a free cross-check on the byte-unchanged claim | Makes "expected unchanged" a hard equality — needs the stated escape hatch that a moved byte there is a stop, not a budget bump |
| B | Add a corpus-total bytes ratchet instead | Cheaper | Permits individual regressions offset by other programs' headroom — directly contradicts AC-9 |

**Recommendation:** Option A. This is the only finding in the batch where every gate stays green
while a committed discipline is violated and *stays* violated — nothing forces discovery, and even
the AC-9 closeout walk passes honestly, because AC-9's text says "four budget windows".

**Confidence:** High. **Hardening:** challenger concurred, rejected option B against AC-9's text,
and contributed the balloon-has-no-other-gate argument that raises the stakes.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-006: the permanent corpus scan covers only half the tail decision 🟠 MAJOR

**Dimension:** 4 (Completeness Gaps) / 7 (Testability)
**Location:** `00-index.md` "Known weakness"; `07-testing-strategy.md` ST-B39/ST-B40 and the AC-13 row
**Codebase Evidence:** the two invariants scan for unconditional jumps to the next label and for jump-only blocks. A missed inversion leaves `B<c> T` · `JMP F` · `T:` — the `JMP` targets a non-adjacent label and no jump-only block exists.

**The Problem:** The plan bills the committed scan as "the structural answer" to its own stated
known weakness — an adjacency mistake that fails as a silently missed transform rather than a red
test. But the scan sees only the elision half. A missed **inversion** passes both invariants. The
plan declares elision and inversion "one decision", so the same bug produces a scan-visible
manifestation in one polarity and a scan-invisible one in the other. AC-13 exists precisely so the
guarantee outlives the one-time hand review; `07` claims "a fixture added after this change cannot
reintroduce either shape", which oversells by one shape.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add a third invariant — zero occurrences of `B<c> L` · `JMP x` · `L:` where `L` is the next emitted label — **with an `_rlxN` carve-out** | Same text-scan machinery, one more predicate; closes the plan's own threat model | Extends AC-13's enumerated list, so it must be recorded against the RD |
| B | Narrow the "known weakness" wording to missed-elision only and accept the gap | No new machinery | Leaves AC-13 half-enforcing and the `07` claim still an oversell |

**Recommendation:** Option A — **and the carve-out is not optional**. The proposed trigram is
textually identical to relaxation's own minted output (`B<inv> _rlxN` · `JMP far` · `_rlxN:`). No
golden contains a relaxed branch today, so the invariant would pass on commit and then permanently
ban legitimate relaxed code from ever entering the corpus. The exemption must be written into the
ST text, mirroring ST-B39's shim exemption, not discovered later.

**Confidence:** High. **Hardening:** challenger agreed with MAJOR against one auditor's MINOR, and
contributed the `_rlxN` collision — the single most valuable catch of the scan. It also verified
the trigram does not false-positive on the value-tail framing at `translate.ts:1290-1299`, whose
`BNE falseL` is followed by instructions rather than a `JMP`.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

# MINOR findings

### PF-007: "both affected assertions stay byte-identical" is false for one of them 🟡 MINOR

**Dimension:** 3 (Logical Contradictions) / 13 (Test Impact)
**Location:** `00-ambiguity-register.md` AR #36; `03-04-corpus-supersession.md` §3; `07` AC-8 row; `99-execution-plan.md` standing rules
**Codebase Evidence:** `packages/codegen/src/instr/translate.impl.test.ts:449-463` is a full-text `toBe` whose expected array inlines the entire rendered function, including `"M_f_L1:"`, `"M_f_L2:"` and `"RTS"`.

**The Problem:** The filler must sit between `_entry` and `_L1` — the only placement that breaks
adjacency — so its label and `RTS` land *inside* that expected array, growing it by two lines. The
branch-pair lines at `:454-455` do stay identical, and the `:526` `toContain` is genuinely
unaffected. The equivalent claim for `translate-brcmp.spec.test.ts` **is** accurate, because its
scaffold is centralized in the `expectFused` helper at `:143-153`. The mechanism works; the claim
is wrong — but it sits in a user-accepted register decision and in a standing rule that binds the
Phase 4 executor.

**Options:** A — reword AR #36, `03-04` §3 and the AC-8 row to "the branch-pair lines stay
byte-identical; the `:449` expected text grows by the filler's label and `RTS`, which is the
recorded scaffold change". B — restructure the test to use a scaffold helper so byte-identity
becomes literally true.

**Recommendation:** Option A. Option B is ceremony serving the claim rather than the test's purpose
(block-boundary register reset), and this file is an impl-tier test, not an immutable spec oracle.
Correct it **before Phase 4 starts** — the standing rule quoting it would otherwise force
re-litigating an accepted AR mid-sensitive-phase.

**Confidence:** High. **Hardening:** challenger downgraded this from my MAJOR to MINOR — the
mechanism is intact and the correction unambiguous. Severity changed.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-008: `relaxBranches`'s `cpu` parameter fails lint 🟡 MINOR

**Dimension:** 13 (Convention Violations) / 6 (Feasibility)
**Location:** `03-03-relax-branches.md` signature (inherited from the RD)
**Codebase Evidence:** `eslint.config.mjs:26-33` sets `@typescript-eslint/no-unused-vars` to **error** with `argsIgnorePattern: "^_"`; lint is inside the verify command. Nothing in the described algorithm consumes `cpu` — `instrByteSize` is CPU-independent, `invertBranch` is CPU-independent, and `BRA` is never emitted.

**The Problem:** Phase 1 cannot end with the verify green as specified.

**Options:** A — drop the parameter. B — rename to `_cpu` with a doc comment, the repo's canonical
marker for an intentionally-unused parameter documenting a future API. C — give it a real use
(validate rewritten entries against the CPU table).

**Recommendation:** Option B. The exact precedent exists at `peephole.ts:145-150`
(`_cpuVariant`), and the eslint config's own comment names the `_` prefix "the single, canonical
mechanism". The future seam is real rather than decorative: Commander X16 is a 65C02 target, and an
out-of-range `BRA` relaxes to a single `JMP` rather than the three-entry shape — so the CPU
genuinely belongs in this signature eventually. Option C is dead code by the plan's own AR #37
standard: every mintable opcode is valid on every supported variant, so the validation can never
fire.

**Confidence:** High. **Hardening:** challenger changed my pick from A to B on the 65C02-`BRA`
argument, which I had not considered. Pick changed.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-009: AC-12's proof has no home, and its motivating premise is false 🟡 MINOR

**Dimension:** 2 (Implicit Assumptions) / 7 (Testability)
**Location:** `07-testing-strategy.md` AC-12 row; `03-04-corpus-supersession.md` §2; the corresponding RD hazard text
**Codebase Evidence:** `testing/rasterpoll.ts:92` asserts `$0400 == 0x01` annotated "heartbeat: frame counter after one body"; `testing/guards.ts` asserts four guard verdicts at `$0400-$0403`; `testing/balloon.ts:70-72` asserts sprite x/y `174/141` after "one +2 step".

**The Problem:** Two issues. (1) AC-12's assertion has no ST id, no named suite and no authoring
task. (2) The hazard motivating it — stated in both the plan and the already-preflighted RD — is
that a careless re-anchor onto the poll block leaves "every observable assertion still passing,
against a state that means nothing". That is **false**: all three fixtures assert body-written
state, so stopping at the 2nd poll arrival (before the first body) makes those checks fail loudly.
The re-anchoring decision itself is unaffected and still required; only the rationale is wrong, and
it changes what AC-12 needs.

**Options:** A — point AC-12's coverage at the existing body-state checks with the discrimination
argument stated, and correct the rationale in both the plan and the RD. B — treat the arrival-count
equivalence as a new committed assertion and name its suite, tier and mechanism.

**Recommendation:** Option A. The existing check at `arrivals = 2` *is* the once-per-frame witness:
poll-anchored it reads 0 ≠ 1 and fails; body-anchored it reads 1 and passes. **But the correction
must not merely delete the hazard** — the premise is contingently false, not absurd. It fails only
because these three observable tables happen to assert first-body-written state; balloon's table
also carries init-only checks (`$07f8`, `$d015`, `$d027`), and a future fixture whose observables
were *all* init-state would make the feared silent green real. State the property that defeats it —
every re-anchored fixture's check set must include at least one first-body-written value — so it is
preserved deliberately rather than by luck.

**Confidence:** Medium-High. **Hardening:** challenger landed MINOR against my MAJOR-adjacent
framing (no silent green, guaranteed discovery on both halves) and contributed the
contingent-falsity refinement. Severity changed.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-010: AC-11's `--emit-il` assertion has no home 🟡 MINOR

**Dimension:** 4 (Completeness Gaps)
**Location:** `07-testing-strategy.md` AC-11 row; `99-execution-plan.md` task 4.20
**Codebase Evidence:** `packages/compiler/src/api/emit.spec.test.ts` exists and already drives `emitIl`; the plan names no file.

**The Problem:** AC-11's assertion is concretely described ("no trampoline, no unreachable block,
block set equals the emitted set") but appears in no suite table, has no ST id, and task 4.20 says
"assert" without a file. It is the only committed-test evidence for the "Printed IL stays honest"
Must-Have, and it is cheap and CI-runnable. Found by three clusters.

**Recommendation:** Home it in `compiler/src/api/emit.spec.test.ts` (or the suite PF-001 relocates,
which will already drive `emitIl`/`emitAsm`) and give it an ST id, extending AR #38's naming batch.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-011: cyclic trampoline resolution is ambiguously specified 🟡 MINOR

**Dimension:** 1 (Ambiguities)
**Location:** `03-01-il-passes.md` ("resolution stops and returns the label at which the cycle was detected"); ST-B4

**The Problem:** For `A → T1 → T2 → T1`, "the label at which the cycle was detected" reads as T1
(the revisited label), T2 (the label under examination), or "leave the original target unchanged".
All three leave a legal program and ST-B4 asserts only termination plus legality — so two
conforming implementations emit different bytes in a byte-exact-golden regime. Stakes are low today
(no fixture produces a multi-block ring; `while (true) {}` lowers to a self-loop, unambiguous via
ST-B5), but the spec is the oracle.

**Recommendation:** Define it as "when a target's chain is cyclic, the original target is left
unchanged" — the simplest deterministic statement, and consistent with ST-B5's 1-ring behavior.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-012: the "v1 ships no passes" doc comments go stale unscheduled 🟡 MINOR

**Dimension:** 4 (Completeness Gaps) / 13 (Impact Blindness)
**Location:** `03-01-il-passes.md` Registration; `99-execution-plan.md` task 4.6
**Codebase Evidence:** `il/optimizer/pass.ts:6-10` ("v1 ships **no** passes… no v1 pass exists to violate them"), `optimize-il.ts:5-7` ("**v1 callers pass `[]`** — the loop body never runs"), `compiler/src/api/emit.ts:107` ("v1 ships no passes → identity").

**The Problem:** Registering the two passes falsifies all three. The `emit.ts:107` comment sits on
the line adjacent to the one task 4.6 rewrites and will plausibly be caught; the two module-level
docs are named in no task and will rot. JSDoc is a required convention in this repo.

**Recommendation:** Add the three doc-comment updates to task 4.6.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-013: citation drift in a plan that trades on line-exactness 🟡 MINOR

**Dimension:** 12 (Consistency) / 13 (Phantom References)
**Location:** `02-current-state.md` and `03-04-corpus-supersession.md`
**Codebase Evidence:** balloon `frameUpdate.fromLabel` is `budgets.json:55`, not the cited `:52` (`:52` is `"windows": [`); `fusedFn` is `translate-brcmp.spec.test.ts:86-99`, not the cited `:83-96`. Also `02-current-state` cites `wordEquality`'s early-out as `:1211-1215` while `03-02` cites `:1211-1219` — the `BNE lowDiffers` is at `:1219`.

**The Problem:** `02-current-state.md` stakes "line numbers are as of commit `c06a10f`", and the
`:52` error is repeated in two documents. Every underlying claim is correct; only the citations
drift. (Noted in passing: the RD cites the `unreachable` no-op at `translate.ts:611-612` where the
plan correctly says `:610-611` — the plan is right, the RD is off by one.)

**Recommendation:** Correct the three citations.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-014: "inversion fires on all 47 rows" overstates the blast radius 🟡 MINOR

**Dimension:** 12 (Consistency)
**Location:** `02-current-state.md` oracle disposition table
**Codebase Evidence:** `translate-brcmp.spec.test.ts` holds 47 expected arrays = 40 `it.each` fused matrix rows + 6 `expectValue` cases + 1 fused deferred-load case. Inversion touches the 41 fused cases only; the 6 value-form cases are single-block value tails the plan itself classifies as unaffected elsewhere.

**The Problem:** The prescribed disposition remains correct and sufficient; only the count is
imprecise.

**Recommendation:** Correct to "the 41 fused cases (of 47 expected arrays)".

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-015: Phase 2's "the corpus cannot move" is inaccurate as stated 🟡 MINOR

**Dimension:** 11 (Ordering & Sequencing)
**Location:** `99-execution-plan.md` Phase 2 header and task 2.4
**Codebase Evidence:** `il/termination.ts:30-66` is production code reached via `instr-program.ts:224-226` (`derivePreambleOptions` selects the startup shim variant); existing guards are `termination.spec.test.ts` and `termination.impl.test.ts`.

**The Problem:** Task 2.4 refactors that walk inside a phase whose safety argument is that nothing
production-reachable changes. The risk is in fact well-fenced — the termination suites exist and
the phase-end verify runs the byte-exact golden suites — but the plan names none of those guards
and the header's claim is wrong.

**Recommendation:** Amend task 2.4 to name the guard (termination spec/impl suites plus a
byte-unchanged corpus), and soften the header to "nothing registered; the only production touch is
the 2.4 refactor, guarded by …".

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-016: zero-block functions and empty `initCode` are uncovered 🟡 MINOR

**Dimension:** 9 (Edge Cases)
**Location:** `03-01-il-passes.md` roots; ST-B10–B15
**Codebase Evidence:** `instr-program.ts:110-114` explicitly skips functions with no IL (error tolerance / never-lowered); empty `initCode` is the normal case (`cfg.ts:125`); `termination.ts:32` carries an `entry === undefined` guard.

**The Problem:** Both passes iterate every function and `initCode` once registered, yet no ST row
covers `blocks.length === 0` or an empty `initCode`. A careless `blocks[0].label` root read is a
compiler crash on every error-tolerant compile. The factored guard makes this likely avoided, and
failure would be loud — hence MINOR — but the plan's posture is that the spec suite, not inherited
code, is the oracle.

**Recommendation:** Add two ST rows (zero-block function → identity, no crash; empty `initCode` →
identity).

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-017: ST-B39/B40's segmentation convention is unstated, with a vacuous-green risk 🟡 MINOR

**Dimension:** 7 (Testability)
**Location:** `07-testing-strategy.md` ST-B39/ST-B40; `99-execution-plan.md` task 5.2
**Codebase Evidence:** the goldens delimit functions with `; --- function:` comment markers and place `__startup:` outside any such section.

**The Problem:** "Within the same function", "the next emitted label", "block", "function entry
block" and the shim exception all depend on parsing conventions the author must reverse-engineer.
Two authors could produce materially different scans, and a later marker-format drift makes a
section-scoped scan **vacuously green** (zero functions parsed → zero violations). Task 5.2 proves
the scan bites once, not forever.

**Recommendation:** Specify the segmentation convention in `07`, and require a non-vacuity
self-check (at least one function section parsed per golden, and at least one unconditional jump
found corpus-wide — 58 `JMP`s are expected to survive, so this is assertable).

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-018: the switch oracle's post-layout shape is unstated and authored after wiring 🟡 MINOR

**Dimension:** 7 (Testability)
**Location:** `03-04-corpus-supersession.md` §3; `99-execution-plan.md` task 4.12
**Codebase Evidence:** `switch-translate.spec.test.ts:63-64` asserts `CMP` / `BEQ` / `JMP` regexes through the real pipeline.

**The Problem:** "Superseded in writing" is a real, precedented procedure (AR #24), but the plan
never states the expected post-layout shape, and task 4.12 runs *after* the wiring tasks — so the
replacement assertions will be authored with implementation output on screen, against `07`'s own
header ("never from running the implementation") at exactly the moment the oracle is re-authored.
The shape is derivable in advance from RD-05 semantics. Residual risk is bounded (a missed elision
in a switch chain is caught by ST-B39 via the slice4b golden).

**Recommendation:** Pre-state the expected post-layout regexes in `03-04` §3 before Phase 4 begins.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-019: two JSDoc examples hard-code the label this change deletes 🟡 MINOR

**Dimension:** 13 (Impact Blindness)
**Location:** `03-04-corpus-supersession.md` §2 re-anchoring table (five artifacts)
**Codebase Evidence:** `test-harness/src/testing/observables.ts:115` and `src/run/strategies.ts:115` both carry `runUntilLabelArrivals(… "Main_main_L0" …)` in doc-comment examples.

**The Problem:** No test reads them, so nothing rots functionally — but AR #35 was raised precisely
*because* the RD's artifact list was incomplete, and these two escaped the same sweep. A reader
copying the example gets the stops-inside-first-frame semantics the plan documents as a trap.

**Recommendation:** Fold into task 4.8/4.9 as a comment touch-up.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-020: the range fixtures' source programs have no stated home 🟡 MINOR

**Dimension:** 4 (Completeness Gaps)
**Location:** `03-03-relax-branches.md` "Range fixtures"; `99-execution-plan.md` task 1.3
**Codebase Evidence:** the harness convention is an inlined `*_SRC` constant in `src/testing/<name>.ts` mirrored byte-for-byte by an `examples/` counterpart, enforced by `examples-sync.spec.test.ts` over an explicit `INLINED_MODULES` list.

**The Problem:** Task 1.3 names only the spec file. AR #32 rules out a new *corpus* fixture, but
that does not say whether the two range programs get `examples/` counterparts, `testing/` helpers,
or inline strings. Adding them to `INLINED_MODULES` without `examples/` files would fail that
suite.

**Recommendation:** Name the source files and their form in task 1.3.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

### PF-021: task 2.8's impl tests are unnamed and may duplicate spec oracles 🟡 MINOR

**Dimension:** 12 (Consistency) / 7 (Testability)
**Location:** `99-execution-plan.md` task 2.8 vs `07-testing-strategy.md` suites table

**The Problem:** Task 2.8 prescribes impl tests (idempotence under repeated scheduling, `initCode`
rooting, surviving-block order), but the suites table names no `*.impl.test.ts` file, and
ST-B8/B9/B14/B15 already pin the same behaviors at spec tier.

**Recommendation:** Either name the impl files or fold 2.8 into the spec suites, so there are no
duplicate oracles with no stated home.

**User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

# OBSERVATIONS

### PF-022: the AC coverage table mixes mechanized tests with hand-review evidence ⚪
`07-testing-strategy.md`'s "Proven by" column does not mark which proofs are committed tests and
which are one-shot artifacts. AC-9's strict-decrease and no-individual-regression clauses are
proven only by the hand-computed delta record; AC-5's proof is hand review plus a ratchet constant
re-derived from the reviewed golden. These are legitimate acceptance properties, but the table
should label them so the task 5.3 AC walk cannot silently substitute one for the other. (PF-005
would mechanize AC-9's clause.) **User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

### PF-023: balloon's block-structure claims are not tree-readable ⚪
`02-current-state.md` opens with "everything below was read from the tree at plan time, not
inferred", but balloon has no golden — its `Main_main_L0`-is-a-trampoline and `Main_main_L5`-is-the-
frame-body claims can only come from a live compile. Both are verified directly for rasterpoll and
guards. Mark balloon's as "derived from a live compile at plan time". **User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

### PF-024: AR #38's naming batch misses two suite names ⚪
AR #38 claims to fix "test-surface names not fixed by AR #33", but `relax-branches.spec.test.ts`
and `range-branches.spec.test.ts` are introduced outside any register batch. Usage is consistent
across `07` and `99`, so there is no execution risk — only a completeness slip if the register is
ever treated as the exhaustive naming authority. **User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

### PF-025: the minted-label collision check cannot see runtime-section labels ⚪
`03-03` says `_rlxN` names are "checked against the program's existing label set", but the runtime
section is pre-composed text appended at `emit.ts:147-148` and its labels are outside
`InstrProgram.streams`. No silent failure is constructible (a collision is a loud ACME
duplicate-symbol error, and user symbols are all `__`-prefixed), but ST-B33 should not promise more
than the mechanism can check. One sentence scoping it honestly. **User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

### PF-026: Phase 4 has no stated fault-attribution procedure ⚪
Rollback is a non-issue (the hand review precedes the commit; afterwards it is one `git revert`).
What is unstated is *attribution*: with four transforms wired at once, a bad shape must be pinned to
one. The real mitigation is structural — per-transform spec suites from Phases 1–3, and the wiring
being separable (unregister a pass at `emit.ts:108`, or skip one consult site, to bisect in the
working tree) — but none of it is written down for the executor of a sensitive phase. One line in
`03-04`. **User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

### PF-027: consider guarding the offset walk's stream-shape assumption ⚪
`instrByteSize` returns 0 for an `origin` directive and a codepoint-naive length for `text`. This is
provably harmless today — directives live only in the preamble and const-data streams, never in a
translator-produced code stream (verified) — and even a mis-sized entry would surface as a loud ACME
range error rather than silent machine code. Worth one guard in `relax-branches.ts` treating a
directive inside a code-segment stream as an internal error, so the invariant the walk depends on is
enforced rather than assumed when later work starts rewriting streams. **User Decision:** Resolved — User accepted the recommendation (batch approval, 2026-07-20).

---

## Not findings — verified and closed

Scope creep (Dimension 10) returned **zero** findings: every candidate traces to explicit RD text —
the `termination.ts` refactor, the permanent corpus scan, the `twins.json` note refresh, task 5.5
(labeled Should-Have), and #65's closure are all RD Must-Haves or scope-decision rows. "Delete or
retarget" is bounded mechanically by the freshness gate; "hand-review each against its twin" is
bounded at 14 goldens.

Phase 4's atomicity was judged acceptable as designed: the RD's "land as ONE change" Must-Have
forbids splitting, the true code diff is four call sites plus one registration line, and every
artifact edit carries its own verification hook.

Phase 1's "all 14 goldens byte-unchanged" is **mechanized, not eyeballed** — `assertGolden` is
byte-exact and all 14 golden suites run in CI with no `skipIf`.

All 40 ST-B ids have an authoring task and all 7 suites have an owner; no orphans.
