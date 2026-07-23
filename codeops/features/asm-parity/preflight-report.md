# Preflight Report: Asm-Parity Strategy Roadmap

> **Status**: ❌ PREFLIGHT BLOCKED — 7 major findings unresolved
> **Iteration**: 1 (first scan)
> **Artifact**: ad-hoc strategic roadmap at `codeops/features/asm-parity/00-roadmap.md`
> **Artifact Blob**: `65311a7ccd167493f6390755175de1164eb02a10`
> **Codebase Grounded**: compiler pipeline, parity instruments, manifests, current source/tests,
> completed plans, conformance artifacts, and git history examined
> **Last Updated**: 2026-07-23

## Audit scope

- **Target**: `codeops/features/asm-parity/00-roadmap.md`
- **Context only**: asm-parity requirements/plans; conformance roadmap, triage, and RD-01 plan;
  parity scoreboard/manifests; compiler/frontend/codegen implementation and tests; portfolio and
  project guidance
- **Modification set**: this report only. No code or roadmap remediation is authorized.
- **Domain lenses**: compiler/language; data/migration
- **Traceability**: the schema-2 graph is structurally valid for its 22 completed artifact-backed
  nodes. It does not model the backlog or cross-feature dependencies audited here.

## Codebase context summary

**Tech stack:** strict TypeScript ESM monorepo, Yarn/Turborepo, Vitest, ACME, and VICE.

**Architecture:** frontend semantic analysis and SFA feed AST-to-IL lowering, IL/instruction
translation, an optional (currently empty) peephole stage, unconditional branch relaxation, ACME
emission, and emulator-backed acceptance tests.

**Observed state:**

- Seven of sixteen asm-parity RDs are recorded Done. The completed work has strong local evidence
  and produced real improvements in placement, condition lowering, block layout, symbolic-address
  folding, and alignment.
- The current parity scoreboard has 15 pairs at 3.54× aggregate bytes and 4.65× aggregate static
  instruction cost. Only `balloon` has a committed measured VICE window.
- Most pairs are synthetic language slices. The roadmap itself says the first game-shaped candidate,
  `boing-ball`, contributes roughly as much non-foldable code as the rest of the corpus combined.
- Conformance RD-01 is 37/52 tasks complete. The current branch already contains the loop-wrap,
  poke-width, and per-declaration-width fixes, so several original triage findings are historical.
- The full project verification is green, including VICE-backed suites. Green tests demonstrate
  the covered contracts; they do not close the roadmap-level strategy gaps below.
- CodeOps metrics are enabled, but the local outcome store has zero events. No workflow-rate claim
  can be supported from structured outcome metrics.

## Summary

| # | Dimension | Findings | Highest severity |
|---|---|---:|---|
| 1 | Ambiguities | 1 | 🟠 Major |
| 2 | Implicit assumptions | 2 | 🟠 Major |
| 3 | Logical contradictions | 1 | 🟠 Major |
| 4 | Completeness gaps | 3 | 🟠 Major |
| 5 | Dependency issues | 2 | 🟠 Major |
| 6 | Feasibility concerns | 2 | 🟠 Major |
| 7 | Testability | 3 | 🟠 Major |
| 8 | Security blind spots | 1 | 🟡 Minor |
| 9 | Edge cases | 1 | 🟠 Major |
| 10 | Scope creep | 2 | 🟠 Major |
| 11 | Ordering and sequencing | 4 | 🟠 Major |
| 12 | Consistency | 3 | 🟠 Major |
| 13 | Codebase alignment | 4 | 🟠 Major |

Root causes are de-duplicated into the findings below.

| Severity | Count | Status |
|---|---:|---|
| 🔴 Critical | 0 | — |
| 🟠 Major | 7 | Pending |
| 🟡 Minor | 2 | Pending |
| 🔵 Observation | 1 | Informational |

---

## PF-001: “Asm parity” has no coherent scope or decidable exit 🟠 MAJOR

**Dimensions:** Ambiguities, Completeness, Feasibility, Testability, Scope

**Location:** target lines 143–150 and tracker lines 365–387

**Evidence:** `AGENTS.md:125-149`; `SCOREBOARD.md:7-24`

The roadmap measures progress as completed RD count and names “output parity with hand-written
assembly” as its governing bar, but never defines the representative programs, target platforms,
runtime windows, acceptable exceptions, or evidence that makes the initiative Done. Closing 16
rows would not prove the Prime Directive. Conversely, compiler parity is an enduring quality
property that will evolve whenever the language or optimizer changes.

**Viable options:**

1. Reframe asm-parity as a bounded corpus-driven discovery and selected-optimization tranche.
   Create one portfolio-level compiler-readiness/parity program that owns tiered exit gates:
   semantic correctness, game expressiveness, representative workload coverage, per-routine
   no-worse floors, measured whole-program goals, and explicitly owned exceptions.
2. Keep asm-parity as the portfolio program and add those gates directly, accepting that it becomes
   an enduring program rather than a feature that can reach 16/16 and archive.

**Recommendation:** Option 1. It makes this branch finitely governable without pretending that
compiler quality ends, while retaining one named portfolio owner for the real goal.

**Strongest counterargument:** splitting governance can dilute accountability. Require one program
owner and mechanically linked child outcomes.

**Confidence:** High

**Hardening:** changed from adding exits only to separating the bounded tranche from the enduring
program after the independent challenger identified the lifecycle mismatch.

**Challenger:** diverged constructively; recommendation incorporates the stronger structure.

**User Decision:** Pending

## PF-002: Architectural priorities are chosen before a representative game oracle exists 🟠 MAJOR

**Dimensions:** Assumptions, Ordering, Testability, Codebase Alignment

**Location:** target lines 152–166 and RD-16 row at line 383

**Evidence:** `examples-coverage.json` classifies `boing-ball` as a demo; `SCOREBOARD.md:7-24`

The roadmap admits the current headline is dominated by synthetic or constant-by-construction
programs, but hard-delays the first game-shaped twin until conformance P6 while authorizing several
optimization RDs now. Avoiding regeneration is ranked above acquiring the evidence needed to choose
which optimizer/ABI work matters.

**Viable options:**

1. Build a versioned, provisional `boing-ball` twin and hot-window baseline now. It is a diagnostic
   calibration artifact, not a frozen acceptance oracle, until P6; regenerate deliberately as
   conformance changes it.
2. Keep the P6 delay, but pause architecture and optimization selection until then. Permit only
   correctness work and benchmark infrastructure.

**Recommendation:** Option 1. Bounded re-baselining costs less than steering blind and still allows
independent learning before conformance stabilizes.

**Strongest counterargument:** pre-P6 churn can invalidate numbers. Label them provisional and
version inputs/tooling.

**Confidence:** High

**Hardening:** the challenger converged.

**Challenger:** converged.

**User Decision:** Pending

## PF-003: The headline cycle KPI is not a runtime-performance oracle 🟠 MAJOR

**Dimensions:** Assumptions, Testability, Codebase Alignment

**Location:** target lines 183–187, 332–357, and completed tracker narratives

**Evidence:** `scripts/gen-parity-scoreboard.mjs:139-158,223-243`;
`budgets.json:2-95`

The aggregate “Cycles” value sums each emitted instruction’s maximum cost once. It does not model
reachability, loop frequency, frame paths, or execution count. Only `balloon` has a committed
measured window, and the aggregate measured total is intentionally blank. Static cost is useful
triage evidence, but cannot prove runtime parity or a whole-program win.

**Recommendation (only viable direction):** relabel the metric everywhere as static
instruction-stream cost, keep it as a secondary screening proxy, and require repeatable VICE hot
windows for representative programs before it can drive priority or exit decisions.

**Considered and dropped:** treating static cost as a weighted runtime estimate; without execution
frequencies, the weights would be invented.

**Confidence:** Very high

**Hardening:** the challenger converged.

**Challenger:** converged.

**User Decision:** Pending

## PF-004: Correctness and optimization lanes have contradictory execution rules 🟠 MAJOR

**Dimensions:** Contradictions, Dependencies, Ordering, Edge Cases

**Location:** target lines 154–166

**Evidence:** conformance roadmap records RD-01 at 37/52; its execution plan lines 164–209 still
contain M-04 and closeout work

The target says asm-parity “does not stop,” says it pauses through P0-core→P2, and simultaneously
lists work as “parallel-safe now.” “The scoreboard is sound for what it measures” is a coverage
disclaimer, not a correctness gate. It permits a lowering/codegen RD to close while relevant
silent-miscompile or expressiveness defects remain open.

**Viable options:**

1. Allow only work with an explicit independence proof. A lowering/codegen parity RD cannot close
   while a relevant P0/P1 defect remains unresolved unless its acceptance corpus covers that form
   and proves semantic safety. Documentation and benchmark infrastructure may proceed.
2. Fully serialize all parity work behind conformance P1/P2.

**Recommendation:** Option 1. Full serialization is unnecessarily broad, but independence must be
an auditable mapping and reviewer gate—not prose.

**Strongest counterargument:** “independent” can become a loophole. Require named defect-domain
mapping and reviewer sign-off.

**Confidence:** High

**Hardening:** the challenger converged.

**Challenger:** converged.

**User Decision:** Pending

## PF-005: Cross-lane ownership and dependencies are not executable 🟠 MAJOR

**Dimensions:** Completeness, Dependencies, Ordering, Consistency, Codebase Alignment

**Location:** target lines 163–166 and tracker lines 374–383

**Evidence:** L-3/L-5 say #70 is absorbed and RD-09/RD-12 require re-scope, but their tracker rows
remain ordinary backlog; RD-16's row names only the already-complete RD-13 dependency

The roadmap’s prose says one thing while its authoritative tracker says another. RD-08 overlaps the
conformance feature’s expressiveness ownership; RD-09/RD-12 can be picked from stale scope; #70’s
sixteen routed gaps have no reciprocal milestone; RD-16’s P6 block is absent. The schema-2 graph
contains only completed nodes, so it cannot catch these omissions.

**Recommendation (hybrid):** conformance owns semantic correctness and expressiveness root causes;
asm-parity owns performance consequences and linked post-fix follow-ups. Retire or absorb
overlapping asm rows, then encode reciprocal dependency IDs, blocked/absorbed/re-scope states,
measurement-return gates, and exact surviving deliverables in both trackers and traceability.

**Considered and dropped:** leaving both lanes co-owning the same root cause; it preserves the
current ambiguity.

**Confidence:** High

**Hardening:** the challenger combined ownership separation with the stronger dependency mechanics.

**Challenger:** diverged constructively; recommendation incorporates both requirements.

**User Decision:** Pending

## PF-006: MMIO volatility and interrupt isolation are not shared optimization gates 🟠 MAJOR

**Dimensions:** Dependencies, Feasibility, Security, Edge Cases, Ordering

**Location:** target lines 166 and tracker lines 374–379

**Evidence:** `peephole.ts:47-75` has a rule seam and empty catalog but no volatility model;
current SFA code carries dedicated IRQ scratch/isolation behavior

RD-06 acknowledges an MMIO deadlock, yet RD-09/RD-10/RD-11 have no shared boundary that prevents
load/store elimination, ABI, frame, or runtime changes from altering hardware access order/count or
mainline/interrupt isolation.

**Recommendation:** establish one explicit volatility/alias/interrupt semantics model and a shared
gate with MMIO order/count tests plus interrupt-interleaving/scratch-isolation tests. Until it is
green, mechanically restrict optimizers to typed non-MMIO/non-IRQ regions and block broad
transforms.

**Strongest counterargument:** the shared model can delay safe scalar wins. The temporary typed
containment policy preserves those wins.

**Confidence:** Very high

**Hardening:** the challenger converged and combined the two options as permanent gate plus interim
containment.

**Challenger:** converged.

**User Decision:** Pending

## PF-007: The roadmap is not an operational decision surface 🟠 MAJOR

**Dimensions:** Ambiguities, Contradictions, Completeness, Consistency

**Location:** target lines 1–360 and 365–387

The 72-KB document mixes current state, retracted claims, chronology, and an explicitly stale
Resume section. It says “current pick RD-13” while RD-13 and RD-15 are Done, and its “Next” text is
historical. Multiple executable-looking surfaces can restart completed work or select backlog by
narrative momentum.

**Viable options:**

1. Compact the roadmap to one authoritative current-state view and ordered queue. Preserve history
   in git, RDs, closeouts, and preflight reports.
2. Retain a history appendix but add a single current-decision section with explicit precedence.

**Recommendation:** Option 1. Another precedence section leaves the competing surfaces in place.

**Strongest counterargument:** in-file history aids session recovery. Keep concise decision links
and generated snapshots, not executable-looking stale prose.

**Confidence:** High

**Hardening:** the challenger converged.

**Challenger:** converged.

**User Decision:** Pending

## PF-008: Live guidance contains broken and superseded references 🟡 MINOR

**Dimensions:** Consistency, Codebase Alignment

**Location:** target line 150 and historical code claims around lines 299–303

The governing policy points to removed `CLAUDE.md` rather than `AGENTS.md`. The chronology also
retains a present-tense claim that `symbolText` would silently render a new union member as
`undefined`, although the current function's explicit return type makes the missing arm a TS2366
error and the roadmap later records that correction.

**Recommendation:** fix the policy link and remove/retract superseded claims from the live view;
git and RD reports retain the history.

**User Decision:** Pending

## PF-009: Malformed-input robustness is not a remaining-work invariant 🟡 MINOR

**Dimensions:** Security, Edge Cases, Testability

**Location:** backlog tracker lines 374–383

Broad future lowering, optimizer, ABI, and intrinsic sweeps carry no roadmap-wide rule that
malformed/adversarial source must terminate deterministically with bounded diagnostics rather than
throw, hang, or leak an ICE. Completed RDs often include such tests, but the policy does not compose
across the initiative.

**Recommendation:** add a global acceptance invariant for every remaining compiler RD: bounded
diagnostic-only failure, no uncaught exception/hang, and targeted negatives for each new lowering
or optimizer path.

**User Decision:** Pending

## Observation: process evidence

The branch history shows substantial review/rework, but the opt-in structured outcome store has
zero events. The audit can identify concrete artifact and code defects; it cannot honestly compute
first-pass success, escaped-finding rates, or planning accuracy. Start recording outcomes before
using those rates to tune CodeOps routing or reviewer count.

## Current verdict

The branch is not a write-off. Completed parity changes are locally well-tested and several are
clear improvements. The branch also contains three completed conformance fix phases. The failure is
strategic composition: local acceptance gates do not add up to a coherent, representative, safely
sequenced compiler program.

No new asm-parity implementation should be selected from the current roadmap until PF-001 through
PF-007 are resolved. Continuing the already-started conformance RD-01 is consistent with every
viable remediation above.
