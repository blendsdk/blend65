# Preflight Report: RD-02 Golden-Corpus Twin Audit + Scoreboard — Implementation Plan

> **Status**: ✅ PREFLIGHT PASSED — all 11 findings resolved (1 critical, 1 major, 7 minor, 2 observation); all accepted per recommendation and fixes applied to the plan documents same-session at the user's direction
> **Iteration**: 2 (fixes applied + verification sweep; PF-011 found during application)
> **Artifact**: Implementation plan at `codeops/features/asm-parity/plans/rd-02-golden-corpus-twin-audit/` (9 documents)
> **Codebase Grounded**: 26 source/test/config files examined; ~40 plan references mapped to code — 37 verified, 3 contradicted
> **Last Updated**: 2026-07-18
> **CodeOps Skills Version**: 3.9.0

> ⚠️ **SAME-AGENT REVIEW**: the plan was authored earlier today, presumably by the same model in a
> prior session; this scan ran in a fresh context. Per the hardening protocol, ONE independent
> challenger agent reviewed the full CRITICAL/MAJOR batch blind to the auditor's picks; its
> verdicts are reconciled inline (it strengthened PF-001 and PF-002 and recalibrated PF-003's
> severity down).

> **Note on finding IDs**: `PF-NNN` in this report numbers findings of THIS plan preflight.
> The plan documents cite `PF-009`…`PF-013` from the *requirements* preflight
> (`../../requirements/00-preflight-report.md`); those are referenced here as req-PF-NNN.

## Codebase Context Summary

**Tech Stack:** TypeScript ESM monorepo (Node 22, Yarn v1 workspaces, Turbo, Vitest, ESLint 9); ACME 0.97 + VICE 3.10 local; CI = install→typecheck→lint→build→test + ACME install, no VICE (AR-27).
**Architecture:** RD-01 instruments all live and verified: `scripts/twin-diff.mjs` (five-category classifier, exported `classifyDivergences`, `twin-diff:` stderr prefix, repo-inside path guard), `@blend65/core` timing table, `measureCycles`/`quiesce` over `CycleMeasurementDriver` (tracked checkpoints — `measure.ts:28-39`), ratcheting budget tier + `budget-loader.ts` fail-loud pattern, `setupEmulator({binary, labelFile})` path ready for twins (`fixture.ts:22-33, 117-126`).
**Key Files Examined:** `scripts/twin-diff.mjs`, `test/twin-diff.{spec,impl}.test.ts`, `run/{strategies,measure}.ts` + `measure.spec.test.ts`, `fixture.ts`, `budgets.spec.test.ts`, `budget-loader.ts`, `index.ts` + `index.spec.test.ts`, `test/golden/{twins,budgets}.json`, `examples/balloon/{main.blend,balloon.asm}`, `testing/{balloon,rasterpoll,gate,slice5a,slice5b,slice7,slice7b,slice3b}.ts`, `slice8.spec.test.ts`, `gate.spec.test.ts`, `rasterpoll.asm.golden`, `vitest.config.ts`, `.github/workflows/ci.yml`, root `package.json`.
**Key Observations:**
- Ground-truth counts: **13 goldens** (gate + 11 slices + rasterpoll), **12 existing observable VICE suites** (gate + 11 slices), **14 fixture builders**, 13 inlined-source programs, 18 inlined modules.
- The balloon divergence (±1/exact-eq vs ±2/`>=`-`<=`), the rasterpoll/balloon observable values (174/141/$F1, $0400==1), the slice8 equate-derived addresses and masked border check, budgets (`772` bytes / `frameUpdate` 162 measured), ACME `--vicelabels`, `fileParallelism: false`, and all 8 routing-target GitHub issues (#49–#53, #56, #59, #61 — all OPEN) verified exactly as the plan states.
- `test/twin-diff.spec.test.ts` runs the script end-to-end over the *committed* manifest whenever ACME + dist are present — true locally **and in CI** — and pins `unpaired ⊇ {gate, slice8b}` (:96-98).
- Byte-for-byte sync check of all 18 inlined modules vs `examples/`: 17 match, **`SLICE3B_SRC` drifts** (comment-only).

**Reference Verification:** ~40 mapped — 37 verified; contradicted: the `twin-diff:`-prefix pin claim (PF-005), the "sources currently in sync" claim (PF-003), the "13 suites / 12 slices / 13 helpers" counts (PF-004).

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 1 (PF-006) | 🟡 |
| 4 | Completeness Gaps | 1 (PF-002) | 🟠 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 1 (PF-010) | 🔵 |
| 7 | Testability | 0 (folded into PF-002) | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 (PF-009) | 🔵 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 1 (PF-001) | 🔴 |
| 12 | Consistency | 2 (PF-004, PF-011) | 🟡 |
| 13 | Codebase Alignment | 4 (PF-003, PF-005, PF-007, PF-008) | 🟡 |

**Ambiguity Register respected (not re-litigated):** plan-AR #1–#12 and the imported req-AR #9/#10/#15–#19 + req-PF-009…013 stand. PF-006's resolution deliberately *preserves* plan-AR #6's decided export surface; PF-001's spec-amendment retiming keeps RD F3's already-planned deliberate amendment, only correctly staged.

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1 | resolved, fix applied |
| MAJOR | 1 | resolved, fix applied |
| MINOR | 7 (incl. PF-011, found in iteration 2) | resolved, fixes applied |
| OBSERVATION | 2 | resolved, notes applied |

---

### PF-001: Phase green-gates assert world states that only later phases create 🔴 CRITICAL

**Dimension:** 11 — Ordering & Sequencing (also 3 — Logical Contradictions)
**Location:** `99-execution-plan.md` — tasks 2.2.5, 3.1.1–3.4.3, 4.2.3, dependency note (:218-224); `07-testing-strategy.md` ST-10, ST-15, ST-18, ST-20
**Codebase Evidence:** `test/twin-diff.spec.test.ts:48` (suite runs whenever ACME + dist present — locally and in CI), :96-98 (pins `unpaired ⊇ {gate, slice8b}`); `scripts/twin-diff.mjs:187` (hardcoded `["main.blend"]`), :203-208 (`assembleTwin` reads the twin file — missing twin ⇒ uncaught throw); `packages/test-harness/test/golden/twins.json` (1 pair today); `test/twin-diff.spec.test.ts:90` (balloon has divergence rows ⇒ a routing-less manifest always trips the generator's enforcement).
**The Problem:** Five instances where a phase's green gate (or the standing per-task verify) is unsatisfiable under the plan's own sequencing:
1. Task 3.1.1 pairs `gate` → the twin-diff spec's membership pin fails; the amendment is scheduled ~15 tasks later (3.4.2). Every intervening task's verify is red.
2. The batch shape "add the four pairs FIRST (red), then author" leaves committed states where `assembleTwin` throws on missing twin files — the twin-diff spec crashes outright at every `x.y.1` checkpoint (challenger-found).
3. The multi-module fix (4.2.1) is required by batch B (slice5a/5b at 3.2.1) and by 3.4.2's "confirm `yarn twin:diff` reports zero unpaired" — but is sequenced a whole phase later. The dependency note records the coupling with the arrow backwards.
4. ST-10's pair-set == corpus-set assertion cannot pass at Phase 2's green gate 2.2.5 with a 1-pair manifest; the corpus completes at 3.4.1.
5. ST-18 ("pristine repo state", per-pair routing sections) and ST-20 (diff against the committed scoreboard) cannot pass at 4.2.3: routing blocks land at 5.1.4, `SCOREBOARD.md` at 5.1.6, and the generator exits non-zero on any unrouted group by design. (The plan itself re-declares ST-18 at 5.1.6 — internal evidence of the mis-staging.)

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Re-sequence + stage the gates: (1) pull the `scripts/lib` extraction + multi-module fix (with ST-14's spec) ahead of Phase 3; (2) amend the twin-diff spec ONCE at the start of Phase 3 to a computed-consistency assertion (`unpaired == goldens − manifest keys`), pinning empty at corpus completion (ST-15 unchanged); (3) make pair-entry + twin-authorship atomic per twin task (red demonstrated in-task; every committed state has manifest keys ⊆ authored twins); (4) split ST-10 — per-pair cases green from Phase 2, corpus-coverage assertion enters at 3.4; (5) move ST-18/ST-20 green to Phase 5 (4.2.3 keeps ST-14/16/17/19) | Every committed/verified state is green; the computed-consistency form is a *truer* spec of the script's documented contract (`twin-diff.mjs:6-8`); preserves 4.2.1's own "existing suites stay green" condition; mirrors the budget tier's corpus-coverage precedent | Real plan surgery: Phase 3's 18 tasks restructure; the per-batch red ceremony becomes per-task/transient |
| B | Keep the phase order; temporarily `skipIf`/todo the affected specs with documented justification, lifted when the enabling phase lands | Minimal edits | Does NOT cure instance 3 (the deadlock is in the script, not a test — 3.4.2 stays impossible); dark specs during maximum churn; incoherent with 4.2.1's "existing twin-diff suites stay green" gate |

**Recommendation:** Option A — it is the only option that resolves all five instances; B leaves 3.4.2 mechanically impossible and blinds the regression guard exactly when Phase 4's refactor depends on it.
Confidence: High — the failure modes are mechanically verified, not speculative.
Hardening: challenger converged on A and ADDED instance 2 + the atomic pair+twin refinement, now folded in. Challenger: converged (with refinement).

**User Decision:** Resolved — User accepted recommendation ("all per recommendation"); fix applied (see Iteration 2 fix log)

---

### PF-002: The generator has no specified way to run against non-committed inputs — ST-16/17/19/20 unimplementable as written 🟠 MAJOR

**Dimension:** 4 — Completeness Gaps (also 7 — Testability)
**Location:** `03-03-manifest-scoreboard-ci.md` §generator (CLI surface = `--out` only); `07-testing-strategy.md` ST-16, ST-17, ST-19 (malformed-manifest half), ST-20; `00-ambiguity-register.md` plan-AR #11 (naming batch lists no input flags)
**Codebase Evidence:** `scripts/twin-diff.mjs:24` (manifest path hardcoded — the precedent the lib inherits); `test/twin-diff.spec.test.ts:106-118` (the established child-process spec idiom the STs follow); `07-testing-strategy.md:106-107` (committed assets must never be mutated by tests).
**The Problem:** ST-16/ST-17 require exit-nonzero + no-output-written against a *temp* manifest; ST-20 requires a temp-mutated `budgets.json`; ST-19's malformed-manifest case needs a malformed *input* file. With only `--out` specified and the manifest/budgets paths hardcoded by precedent, none of these can run as the child-process specs they're written as. New surface names are register-owned in this repo, so the executor hits a guaranteed runtime-ambiguity STOP at 4.1.1.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Specify `--manifest <path>` + `--budgets <path>` now (defaults = committed paths; both through the existing repo-inside canonicalization), recorded as a register amendment and reflected in 03-03 + the ST wording | Preserves the specified process-level observables (exit code, nothing written); matches the established spec idiom; independently useful in Phase 5 — preview the scoreboard against a draft-routed temp manifest BEFORE the user confirms (plan-AR #9 posture) | Slightly larger permanent CLI surface |
| B | Test routing/staleness/malformed-input via CLI-gated function exports only; keep the CLI input paths fixed | No new surface | Loses the exit-code and no-output-written assertions as specified; cannot cover ST-19's malformed-manifest case end-to-end; contradicts the STs' plain wording |

**Recommendation:** Option A — the only option that implements the STs as specified, and the Phase-5 preview utility justifies the flags beyond testing.
Confidence: High.
Hardening: challenger converged on A and extended the blast radius to ST-19's malformed-manifest half (folded in). Challenger: converged.

**User Decision:** Resolved — User accepted recommendation ("all per recommendation"); fix applied (see Iteration 2 fix log)

---

### PF-003: "Sources currently in sync" is false — `SLICE3B_SRC` has drifted from `examples/slice3b/main.blend` 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Stale Assumptions)
**Location:** `99-execution-plan.md` task 1.1.4 ("document ST-4 pre-passing with justification (sources currently in sync)"); `02-current-state.md` ("inline sources verbatim")
**Codebase Evidence:** Byte-for-byte comparison of all 18 inlined modules vs `examples/`: 17 match; `packages/test-harness/src/testing/slice3b.ts` (`SLICE3B_SRC`) lacks the trailing explanatory comments `examples/slice3b/main.blend` carries (lines 3, 4, 10, 11, 13, 15, 16). Comment-only drift; code identical. `examples/slice4a/main.blend`'s 12 comment lines already flow byte-identical through an inlined constant to a committed golden — comments are proven inert to codegen.
**The Problem:** Task 1.1.4's premise is factually wrong: ST-4 will be RED for slice3b, not pre-passing. The reconciliation direction also needs stating.
**Related:** This is precisely the drift req-PF-013 invented the sync test to catch — the finding validates the requirement.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Keep the drift until 1.1.4; document slice3b as ST-4's *genuine* red; update `SLICE3B_SRC` to the example's text (examples/ is the oracle) in the green phase; correct 02-current-state's "verbatim" claim | ST-4's red phase becomes a real demonstration that the sync spec bites; direction follows the immutable-oracle rule (examples are the user-facing, VICE-verified fixtures); corpus norm is comment-carrying constants (slice4a precedent) | Deliberately plans a red the plan previously called a pre-pass |
| B | Strip the comments from `examples/slice3b/main.blend` to match the inlined constant | Smaller inlined constants | Degrades user-facing example documentation; against the corpus norm; wrong direction of authority |

**Recommendation:** Option A. (A simpler variant — pre-fix the constant before execution so 1.1.4 stays as written — is acceptable but forfeits the free red-phase evidence.)
Confidence: High — verified by direct byte comparison.
Hardening: challenger converged on A; severity recalibrated MAJOR → MINOR per its argument (the failing test is the very spec built to catch this; fix is trivial and unambiguous). Challenger: converged; severity adjusted.

**User Decision:** Resolved — User accepted recommendation ("all per recommendation"); fix applied (see Iteration 2 fix log)

---

### PF-004: Systematic off-by-one — "13 suites / 12 slices / 13 helpers" vs the real corpus 🟡 MINOR

**Dimension:** 12 — Consistency
**Location:** `00-index.md` Related Files ("13 existing fixture suites"); `02-current-state.md` ("×13 VICE suites", "gate + 12 slices + rasterpoll"); `03-01` ("the 13 VICE suites", "13 helpers gain data tables; 13 suites shrink", "(gate, 12 slices, rasterpoll)"); `07` ST-8 ("All 13 existing VICE suites"); plan-AR #2 note ("11 of 13 existing suites")
**Codebase Evidence:** `packages/test-harness/src/`: exactly **12** existing observable VICE suites (gate + 11 slices — the plan's own tasks 1.2.4/1.2.5 correctly enumerate these 12); **14** helpers gain `OBSERVABLES` tables (12 lifted + rasterpoll/balloon authored — 03-01's own 11-straight-lifts + 3 exceptions arithmetic agrees); 11 slice fixtures, not 12. ST-4's "13 inlined-source programs" is the one count that is *correct* (gate + 11 slices + rasterpoll).
**The Problem:** ST-8 ("All 13 existing VICE suites") is literally unsatisfiable — there is no 13th suite to refactor — and the wrong counts invite a mid-execution hunt. No design impact: the task lists enumerate the right files.

**Options:** Single viable resolution — correct the counts (12 suites, 11 slices, 14 helper tables) across the five locations. (Considered and dropped: leaving them as-is with an executor note — needless landmine in a spec table that claims immutability.)

**Recommendation:** Apply the textual corrections.

**User Decision:** Resolved — User accepted recommendation ("all per recommendation"); fix applied (see Iteration 2 fix log)

---

### PF-005: Stale claim — no spec pins the `twin-diff:` stderr prefix 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Stale Assumptions)
**Location:** plan-AR #8 ("spec test pins `twin-diff:` — `test/twin-diff.spec.test.ts:114`"); `03-03` Current ("a `twin-diff:` prefix pinned by `test/twin-diff.spec.test.ts:114`")
**Codebase Evidence:** `test/twin-diff.spec.test.ts:114` asserts `stderr` matches `/outside the repository/i` — the message body, not the prefix. No test in the repo asserts the `twin-diff:` prefix (grep-verified). The prefix itself exists (`twin-diff.mjs:29`).
**The Problem:** The per-CLI-prefix contract (lib throws, CLI maps to exit 1 under its own prefix) is justified by a regression pin that doesn't exist. Design unaffected; the citation is wrong and the contract is actually unguarded.

**Options:** Single viable resolution — correct the two citations, and (recommended) have the Phase-4 spec work add real prefix assertions (`twin-diff:` in the amended spec, `gen-parity-scoreboard:` in ST-19) so the stated contract becomes pinned. (Considered and dropped: citation fix alone — leaves the contract unguarded while the plan continues to claim it as pinned behavior.)

**Recommendation:** Fix citations + add the two prefix assertions.

**User Decision:** Resolved — User accepted recommendation ("all per recommendation"); fix applied (see Iteration 2 fix log)

---

### PF-006: "Both manifest validators consume `CATEGORIES`" is infeasible across the package boundary; import-cycle hazard in the lib split 🟡 MINOR

**Dimension:** 3 — Logical Contradictions (also 13 — Dependency Reality)
**Location:** `03-03` §CATEGORIES ("both manifest validators and the generator consume it — one vocabulary source, a rename fails loudly everywhere"); plan-AR #6 vs plan-AR #8
**Codebase Evidence:** `packages/test-harness/src/twin-manifest.ts` cannot import `scripts/twin-diff.mjs` — outside the package rootDir, untyped `.mjs`, wrong dependency direction (packages must not reach into repo-root scripts; cf. the repo's module-boundary rules). Plan-AR #8 already names the `.mjs`/`.ts` validator pair as accepted duplication. Separately: `scripts/lib/twin-corpus.mjs`'s strict `loadManifest` needs `CATEGORIES` while `twin-diff.mjs` imports the lib — a circular ESM import if `CATEGORIES` stays defined in `twin-diff.mjs` (safe only while every use stays call-time, a fragile invariant).
**The Problem:** 03-03's single-source claim contradicts both the package boundary and plan-AR #8's accepted duplication. The drift risk it worries about is *already* covered mechanically: plan-AR #7's stale-routing error "also catches category-string renames" (the register says so itself).

**Options:** Single viable resolution — amend the text: the `.mjs` validator + generator consume `CATEGORIES`; the TS loader carries a local frozen copy (plan-AR #8's named duplication), rename drift caught by the generator's stale-routing error. Define `CATEGORIES` in `scripts/lib/twin-corpus.mjs` and re-export from `twin-diff.mjs` — this kills the import cycle while preserving plan-AR #6's user-decided export surface (`test/twin-diff.impl.test.ts:10` keeps importing from `twin-diff.mjs`). (Considered and dropped: making the TS loader actually import the `.mjs` — boundary/type-safety violation; and a shared JSON vocabulary file — new surface with no consumer benefit over the re-export.)

**Recommendation:** Apply the amendment as stated.

**User Decision:** Resolved — User accepted recommendation ("all per recommendation"); fix applied (see Iteration 2 fix log)

---

### PF-007: `runUntilLabelArrivals` barrel membership unstated — `index.spec.test.ts` (ST-27) pins the exact public surface 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Impact Blindness)
**Location:** `03-01` §strategy; plan-AR #11; `00-index.md` Related Files (does not list `index.ts`/`index.spec.test.ts`)
**Codebase Evidence:** `packages/test-harness/src/index.spec.test.ts` asserts the barrel "exposes no unexpected extra value exports beyond the documented surface" (ST-27); every existing strategy in `run/strategies.ts` IS on the barrel (`index.ts:38-45`). The plan declares `observables.ts` and `twin-manifest.ts` off-barrel but is silent on the new strategy.
**The Problem:** An executor following sibling precedent (all strategies public) adds it to the barrel → ST-27 fails with no scheduled amendment; keeping it off-barrel is an undeclared inconsistency with its siblings. Either way a decision is missing.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Declare it off-barrel in 03-01 (test-only consumer today; same posture as observables/twin-manifest); `index.ts`/ST-27 untouched | No public-surface growth for a capability with one internal consumer; consistent with the plan's off-barrel posture for new modules | Inconsistent with sibling strategies' visibility (documented, so acceptable) |
| B | Add to the barrel + amend `index.spec.test.ts` + full public-API JSDoc/`@example` | Sibling-consistent public surface | Commits a public API for a test-only need; extra spec amendment |

**Recommendation:** Option A — promote to the barrel later if an external consumer appears.

**User Decision:** Resolved — User accepted recommendation ("all per recommendation"); fix applied (see Iteration 2 fix log)

---

### PF-008: The new strategy gets zero CI-runnable coverage — only the local VICE probe 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Test Impact)
**Location:** `07-testing-strategy.md` (ST-2 is the only `runUntilLabelArrivals` case; the impl-test table lists observables/loader/generator only)
**Codebase Evidence:** Existing strategies carry CI-runnable fake-driver coverage (`run/strategies.spec.test.ts`, `strategies.impl.test.ts`); the fake driver supports the measurement capabilities (`measure.impl.test.ts` runs CI-wide). ST-2 runs only under local VICE (`skipIf`), so in CI the new strategy's lifecycle (set-once / resume-n / delete-in-`finally` incl. error paths), unknown-label error, and non-measurement-driver error are untested — a break from the established per-strategy pattern.
**The Problem:** Regressions in the checkpoint lifecycle (the very leak class the plan fixes) would pass CI silently.

**Options:** Single viable resolution — add fake-driver cases for the new strategy (lifecycle incl. deletion on throw, unknown label, non-measurement driver) to the ST/impl tables, alongside the existing strategy tests. (Considered and dropped: relying on ST-2 alone — inverts the repo's convention that unit tiers run everywhere and VICE proves semantics locally.)

**Recommendation:** Add the cases.

**User Decision:** Resolved — User accepted recommendation ("all per recommendation"); fix applied (see Iteration 2 fix log)

---

### PF-009: slice8's strengthened shared check is mod-16 aliased — it pins the final border color, not saturation 🔵 OBSERVATION

**Dimension:** 9 — Edge Cases
**Location:** `03-01` per-fixture tables (slice8 row); plan-AR #4
**Codebase Evidence:** border = (boot 14 + count) mod 16 → `$F2` at count 4, 20, 36, …, 100. The fixture suite still proves saturation via its local counter/mirror waits; the twin's shared contract (`$D020 == $F2`) is satisfiable by any count ≡ 4 (mod 16).
**The Problem (context, not a defect):** The user-approved strengthening (plan-AR #4) is sound, but the twin-authorship contract should note that the twin must actually saturate (100 bumps) for the landmark to be *deterministic* — a non-saturating twin could pass or flap on transient equality.

**Recommendation:** One sentence in the twin-authorship contract / slice8 twin task. No design change.

**User Decision:** Resolved — User accepted recommendation ("all per recommendation"); fix applied (see Iteration 2 fix log)

---

### PF-010: CI wall-time growth from full-corpus generator runs is unquantified 🔵 OBSERVATION

**Dimension:** 6 — Feasibility Concerns
**Location:** `02-current-state.md` Risks (covers local tier growth only); `03-03` CI step; `07` ST-18
**Codebase Evidence:** One generator run = 14 compiler builds + 14 ACME assemblies; ST-18 runs it twice, the freshness step once more, and the informational twin-diff step grows from 1 to 14 pairs (the single-pair spec today carries a 240 s timeout budget — `test/twin-diff.spec.test.ts:103`).
**The Problem (context):** Likely acceptable (builds are seconds each), but the plan nowhere budgets it. With PF-002's `--manifest` flag, ST-16/17/19 can use 1-pair temp manifests, containing most of the test-tier cost.

**Recommendation:** Note the expectation; measure at Phase 4 and only then decide if anything needs trimming.

**User Decision:** Resolved — User accepted recommendation ("all per recommendation"); fix applied (see Iteration 2 fix log)

---

## Iteration 2 — fixes applied + verification sweep

> **Previous Iteration**: 10 findings — all resolved (user: "all per recommendation")
> **This Iteration**: 1 new finding (PF-011, found while applying fixes — resolved and fixed in the same pass)
> **Carried Forward**: none

### PF-011: 01-requirements maps F5 (CI freshness gate) to Phase 4; the CI step lands in Phase 5 🟡 MINOR

**Dimension:** 12 — Consistency
**Location:** `01-requirements.md` delta view ("F5 — CI freshness gate (Phase 4)")
**Codebase Evidence:** The execution plan places the "Scoreboard freshness" CI step at task 5.1.8 (deliberately after `SCOREBOARD.md` exists — the plan's own dependency note explains why), and did so before this preflight's restructure too.
**The Problem:** Pre-existing doc-internal mismatch surfaced while applying PF-001's re-staging.
**Resolution:** Single viable fix — corrected to Phase 5 with the rationale inline.
**User Decision:** Resolved — fixed under the standing "all per recommendation" direction.

### Fix log (all applied 2026-07-18)

- **PF-001** — `99-execution-plan.md` restructured: sequencing-invariant note added; Step 2.4 (scripts corpus lib + multi-module fix + ST-14, `CATEGORIES` re-home, `twin-diff:` prefix pin) inserted before the corpus; Phase 3 rebuilt as atomic pair+twin tasks with the one-time computed-consistency spec amendment (3.1.1) and the empty pin + ST-10b at 3.5; Phase 4 reduced to the generator (ST-16/17/19); ST-18/ST-20 authored + green at 5.1.6–5.1.7; phase table now 12/13/17/6/10 = 58 tasks; dependency diagram corrected. Mirrored in 07 (ST-10a/b split, ST-14/18/20 staging), 03-03 (overview + two-stage amendment), 02 (crash-on-missing-twin note), 00-index (overview), register (sequencing addendum).
- **PF-002** — `--manifest`/`--budgets` specified in 03-03 (pipeline step 1 + path-flag enforcement), ST-16/17/19/20 wording, task 4.2.1, Phase-5 preview at 5.1.2, plan-AR #11 addendum, 01-requirements decision row.
- **PF-003** — 1.1.4/1.2.3 reworded (slice3b genuine red → constant updated to the example text in green); 02 drift bullet + builders row; 03-01 sync-test drift note; 07 checklist note; plan-AR #10 addendum.
- **PF-004** — counts corrected everywhere: 12 suites (gate + 11 slices), 14 helper tables, 11 slices; ST-8 now satisfiable; register note "11 of 12".
- **PF-005** — prefix-pin claim corrected in 03-03, 02, and register row #8 (+ addendum); prefix pins scheduled (2.4.2 for `twin-diff:`, ST-19 for `gen-parity-scoreboard:`).
- **PF-006** — `CATEGORIES` defined in the lib, re-exported from `twin-diff.mjs`; TS loader local-copy note in 03-02; plan-AR #6 addendum.
- **PF-007** — off-barrel declared in 03-01; plan-AR #11 addendum.
- **PF-008** — ST-2b added (07 + task 1.1.2/1.2.3 + 03-01 note + file-mapping row).
- **PF-009** — saturation/mod-16 note in 03-02 authorship contract + task 3.4.3.
- **PF-010** — CI wall-time risk row added to 02.
- **PF-011** — F5 phase mapping corrected in 01-requirements.

### Verification sweep

Post-fix grep across the plan docs: zero stale "13 suites / 12 slices / 13 helpers" references, zero dangling old task numbers (the `5.1.9` AC-walk citation in Success Criteria corrected to `5.1.10`); checkbox arithmetic reconciles (58 numbered tasks + 2 deliverable checkboxes). All 11 findings resolved, none carried forward.

**Final status: ✅ PREFLIGHT PASSED — all 11 findings resolved, fixes applied.**
