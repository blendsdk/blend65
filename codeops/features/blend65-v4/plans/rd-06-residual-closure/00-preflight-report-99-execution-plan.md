# Preflight Report: RD-06 Residual Closure (T-20–T-27)

> **Status**: ✅ PREFLIGHT PASSED WITH NOTES — 33 findings resolved (0 critical, 14 major, 16 minor, 3 observations accepted)
> **Iteration**: 3 (iteration 1 findings resolved; iteration 2 found and fixed 7 regressions; iteration 3 verifies the fixes)
> **Artifact**: Single plan document (task mini-plan) at `codeops/features/blend65-v4/plans/rd-06-residual-closure/99-execution-plan.md`
> **Artifact hash at scan start**: `2f4daaf9f77920ba110526c2de679f3cb1b7e14c88b97bfe829b32038595eea4`
> **Artifact hash after iteration-3 fixes**: `1b0cfee6093689b553143ffa3f2f653ad6c9eb0b924c69c396334a73d98bc98a`
> **Codebase Grounded**: 31 source/test/requirement files examined; every cited `file:line` verified
> **Last Updated**: 2026-11-09 16:25
> **Mode**: Auto-design active; strict scope; single-document audit. Context artifacts are read-only.
>
> ⚠️ **SAME-SESSION REVIEW** — this plan was created in the current session. An independent five-cluster
> preflight fan-out and one independent design challenger were used to reduce same-model bias. A
> fresh-session audit remains advisable before a release decision.

### Codebase Context Summary

**Repository:** Blend65 v4 compiler and toolchain.
**Tech Stack:** TypeScript 7, ESM/NodeNext, Yarn classic workspaces, Vitest, Turbo, ACME 0.97, VICE 3.10.
**Architecture:** frontend → semantic operations → machine lowering → SFA closure → C64 layout → ACME
serialization and evidence sidecars. Raw memory and platform operations lower directly to structured
NMOS 6510 instructions; final layout resolves symbolic VIC fields and publishes `.assets.json`,
`.memory.json`, `.costs.json` and `.debug.json`.

**Key files examined:** `lower-c64.ts`, `lower-memory.ts`, `lower-register-forwarding.ts`,
`lower-arithmetic.ts`, `lower-operation.ts`, `lower-aggregate-place.ts`, `lower-state.ts`,
`lower-control.ts`, `lower-function.ts`, `vic-fields.ts`, `c64-layout.ts`,
`c64-layout-objects.ts`, `startup.ts`, `size-selection.ts`, `shared-storage.ts`, `evidence.ts`,
`memory-evidence-records.ts`, `memory-evidence-validator.ts`, `resource-diagnostics.ts`,
`spritepad.ts`, `charpad.ts`, `koala.ts`, `psid.ts`, Q-P15 source/oracle, RD-05/RD-08 fixtures,
`test/rd06/layout-assets.spec.test.ts`, `test/rd06/qp15.spec.test.ts`, frozen `spec/11`, `spec/13`,
`spec/14`, F005/F015.

**Reference verification:** all plan `file:line` references resolve; no phantom path was found.
**Baseline correction:** Q-P15 is `optimization: "none"`, and the existing ordinal read proof is
installed only when `observerEvidence && optimizationFacts` (`lower-function.ts:162–164`). This is the
root of PF-001.

### Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 3 | 🟠 MAJOR |
| 2 | Implicit Assumptions | 2 | 🟠 MAJOR |
| 3 | Logical Contradictions | 4 | 🟠 MAJOR |
| 4 | Completeness Gaps | 4 | 🟠 MAJOR |
| 5 | Dependency Issues | 2 | 🟡 MINOR |
| 6 | Feasibility Concerns | 4 | 🟠 MAJOR |
| 7 | Testability | 2 | 🟡 MINOR |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 4 | 🟡 MINOR |
| 10 | Scope Creep Indicators | 1 | 🟠 MAJOR |
| 11 | Ordering & Sequencing | 2 | 🟠 MAJOR |
| 12 | Consistency | 4 | 🟡 MINOR |
| 13 | Codebase Alignment | 4 | 🟠 MAJOR |

Findings are counted once by primary root cause; overlapping clusters are merged below.

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 14 | all resolved by plan revision |
| MINOR | 16 | all resolved or explicitly accepted |
| OBSERVATION | 3 | accepted with wording fixes |

### Delegated Authority and Hardening

**Root invocation ID:** `rd06-residual-preflight-20261109-01`
**Policy version:** 1
**Authority:** AI — delegated by `--auto-design` for eligible technical decisions. No reserved
product behavior, priority, acceptance criterion, public API, credential or external action was
decided by delegation. Issue closure remains user-owned.

**Independent challenger:** one blind `design-challenger` received the eight high-stakes root causes
without the parent's preferred answer. Verdicts: (1) Q-P15/T-20 — Justified, choose enable-for-none
with a measured baseline and pinned-fixture check; (2) T-27 active screen — Justified, unique
label/constant derivation; (3) T-27 footprint — Justified, full 1,024-byte footprint; (4) T-22 —
Justified, static-address mechanism; (5) T-21 — Justified, fixed-origin compaction with keep-identity
fallback; (6) T-23 — Justified, full C/V proof and reuse of compaction; (7) T-24 — Justified, constant
fields use E10273; (8) T-26 — Justified, `bankId`-scoped VIC projections. The challenger's strongest
counterargument (ordinal writes are an RD-08 transform, not `none`) was reconciled by RD-04 AC-37 and
the unchanged pinned `none` fixture.

No Complexity Escalation Gate packet is open: the chosen mechanisms stay inside existing owners and
do not add a new layer, dependency, harness, framework or schema.

---

## Findings

### PF-001: Q-P15 re-baseline and T-20 mode gate contradict each other 🟠 MAJOR

**Dimension:** Logical Contradiction / Feasibility
**Location:** plan T-20.4, T-21.4, "Recorded Rulings"; baseline "Q-P15 is optimization none".
**Codebase Evidence:** `test/rd06/qualification/q-p15/blend65.json` selects `none`;
`packages/compiler/src/machine/lower-function.ts:162–164` installs the ordinal read proof only for
`observerEvidence && optimizationFacts`; `test/rd08/optimizer-exact-output.impl.test.ts:32–36` pins the
none identity; Q-P15 uses `poke($0500 + word(panel), ...)` and `poke($0C00 + word(cell), ...)`.
**Problem:** T-20.4 re-baselined Q-P15 but the original design gated ordinal writes to optimized mode,
so Q-P15 `none` would not change. T-21.4 also updated the oracle while the ruling said "only after
T-21 and T-20", so the T-21 checkpoint could not be green.
**Options:** A) Optimized-only and let T-21 own the only Q-P15 change. B) Enable proved ordinal writes
for all non-metadata modes, measure Q-P15 at each task, and verify the pinned none fixture unchanged.
C) Change Q-P15 to an optimized mode.
**Resolution:** ✅ Resolved — Authority: AI — delegated by `--auto-design`. Eligibility: compiler
mechanism inside the confirmed goal. Decision: B. Rejected A because it leaves the named `none`
defect open; rejected C because it redefines the qualification workload. Strongest counterargument:
ordinal writes are an RD-08 value transform; reconciled by RD-04 AC-37 and the unchanged pinned
fixture. Confidence: High. Hardening: independent challenger verdict Justified (choose B). Reopen if
the pinned none fixture changes unintentionally or the proof cannot accept the Q-P15 index shapes.

### PF-002: T-20's "mirror the read adjacency" is false for writes 🟠 MAJOR

**Dimension:** Implicit Assumption / Edge Case
**Location:** plan T-20.1–T-20.3.
**Codebase Evidence:** the read proof requires the memory read to be the next machine operation
(`lower-register-forwarding.ts:253–291`); semantic value arguments are evaluated before the
`memory-write` (`semantic/lower-calls.ts:260–299`). The value can clobber X or modify the index home.
**Problem:** A literal read-adjacency proof rejects the named `poke(base+index, value)` shape. Without
an immutability/no-X-clobber proof, reloading the index at the write can use a different value.
**Options:** A) Write-specific proof: address result single-use, value evaluation may intervene, the
index home is not written and X is not clobbered, and the value can load into A after X; otherwise
fall back to indirect. B) Keep read adjacency (no-op). C) Stage the index before value evaluation.
**Resolution:** ✅ Resolved — delegated decision A. B leaves the defect open; C adds storage cost not
needed for the common case. The fallback is a selection rejection, never a new diagnostic.
Confidence: High. Hardening: challenger Justified.

### PF-003: T-20's ordinary-RAM rule leaves Q-P15's Color-RAM loop on the indirect path 🟡 MINOR

**Dimension:** Scope / Completeness
**Location:** plan T-20 "device bases" ruling.
**Codebase Evidence:** the proved window is `$0400–$CFFF`
(`lower-register-forwarding.ts:273–280`); Q-P15's `poke($D800 + index, ...)` is Color RAM.
**Problem:** The plan could be read as fixing the whole renderer; the Color-RAM loop remains indirect.
**Options:** A) State the `$D800` loop remains indirect, name `$0500`/`$0C00` as the wins, and track
the gap. B) Widen the proof to the Color-RAM window.
**Resolution:** ✅ Resolved — delegated decision A. The current observer proof is ordinary-RAM based;
widening is separate work and would change the raw-effect model. The plan now names the gap and
requires it to be recorded after the measured Q-P15 delta. Confidence: High. Hardening: challenger
noted the same boundary.

### PF-004: T-27's active-screen assumption and new rejection are under-specified 🟠 MAJOR

**Dimension:** Ambiguity / Contradiction / Scope
**Location:** plan T-27 design and ruling.
**Codebase Evidence:** `vicScreenSelect` accepts a constant or a label (`lower-c64.ts:451–506`); raw
`poke($D018, ...)` is legal; the plan claimed "no source restriction" while failing multiple screens.
**Problem:** "Sole label" misses constant screen selection and raw `$D018`; failing multiple screens is
a new user-visible restriction that must be recorded; silently defaulting to `$07F8` is wrong.
**Options:** A) Derive one active base from a unique `vicScreenSelect` argument (label or constant);
multiple distinct bases fail with source-linked E10273 and a ledger row; raw `$D018` remains
user-owned and documented. B) Per-call CFG dominance analysis. C) Silent default.
**Resolution:** ✅ Resolved — delegated decision A. B is larger and still cannot prove the field
reached `$D018`; C is the defect. The plan's objective now names the single tracked restriction and
`test/rd04/expressiveness-ledger.json` records it. Confidence: Med-High. Hardening: challenger
Justified; raw `$D018` is recorded as an unproved boundary. Reopen if a supported multi-screen API is
introduced.

### PF-005: T-27's pointer-table reservation cannot prevent collisions 🟠 MAJOR

**Dimension:** Feasibility / Edge Case
**Location:** plan T-27.3.
**Codebase Evidence:** layout places non-assets before assets (`c64-layout.ts:467–620`); `addInterval`
rejects overlaps (`c64-layout-objects.ts:37–51`); the screen asset is 1,000 bytes while R6.42 requires
a complete 1,024-byte active-screen interval.
**Problem:** Reserving only the last eight bytes after placement cannot stop an earlier object or a
later sprite from occupying `$0FF8–$0FFF`. A 1,024-byte screen asset would overlap an extra
reservation.
**Options:** A) Mark the screen role, use the full 1,024-byte footprint during placement, add a
16-byte zero tail plus an 8-byte pointer table, and fail closed on collision. B) Reserve eight bytes
after placement. C) Evidence-only reservation.
**Resolution:** ✅ Resolved — delegated decision A. B cannot prevent collisions; C cannot fail closed.
The plan now requires the full footprint, a `$3C00/$3FF8` case, a 1,024-byte screen case and a
competing-object negative case. Confidence: High. Hardening: challenger Justified.

### PF-006: T-22's `poke(&local)` direct-store claim has no static-address mechanism 🟠 MAJOR

**Dimension:** Logical Contradiction / Feasibility
**Location:** plan T-22 design and T-22.2.
**Codebase Evidence:** `&asset` is a `symbol-address` (`lower-operation.ts:632–641`); `&local` goes
through `lowerAggregateAddress`, which always requests a zero-page pointer pair
(`lower-aggregate-place.ts:173–229`); `lowerMemoryWrite` only special-cases a constant address
(`lower-memory.ts:274–317`).
**Problem:** A statically known local currently has no static address value, so the planned test is
not implementable as written.
**Options:** A) Add a static-address selector/`LoweredValue` kind consumed by the next raw access and
suppress the pointer pair. B) Narrow T-22 to `&asset` only. C) Reuse the pair and remove only the copy.
**Resolution:** ✅ Resolved — delegated decision A. B drops the named `&local` defect; C still costs
zero-page bytes and misses 5/6. The plan names the selector/kind, the static-home boundary, dynamic
fallback and the `&global` case. Confidence: High. Hardening: challenger Justified.

### PF-007: T-22's 5/6 witness is zero-page-dependent 🟡 MINOR

**Dimension:** Edge Case
**Location:** plan T-22.1.
**Codebase Evidence:** a zero-page home uses `sta zp` (2 bytes/3 cycles); a RAM home uses
`sta absolute` (3 bytes/4 cycles) (`lower-memory.ts:290–312`).
**Problem:** A single 5/6 assertion fails if the local is allocated in zero page.
**Resolution:** ✅ Resolved — the plan now asserts 5/6 for a RAM home and 4/5 for a zero-page home,
and requires the test to select the intended home explicitly.

### PF-008: T-21's startup and growth behavior contradict its rulings 🟠 MAJOR

**Dimension:** Contradiction / Feasibility
**Location:** plan T-21.1–T-21.3.
**Codebase Evidence:** startup is a contiguous entry/fallthrough path
(`c64-layout.ts:135–162`); `repairMachineBranches` can grow a function
(`machine/block-layout.ts`).
**Problem:** T-21.3 required failing the build for startup or growth while the ruling said startup is
untouched and a valid program must not be rejected.
**Resolution:** ✅ Resolved — delegated decision: compact ordinary functions only in the final layout;
keep startup's identity; keep the identity form and file the measured gap if a function would grow;
skip compaction in the draft layout so SFA trailing ranges cannot move. Confidence: High. Hardening:
challenger Justified (choose keep-identity over fail-closed).

### PF-009: T-21's branch repair needs a monotonic fixed point 🟡 MINOR

**Dimension:** Edge Case
**Location:** plan T-21.2.
**Codebase Evidence:** removing two bytes can relax a long branch to short, shrinking the function by
another three bytes (`c64-layout.ts:301–303`, `block-layout.ts`).
**Problem:** One repair pass can leave stale branch sizes and intervals.
**Resolution:** ✅ Resolved — the plan now requires repair to a monotonic fixed point before intervals
are finalized, plus a long-branch boundary RED case.

### PF-010: T-23 removes bytes post-layout without T-21's compaction or a complete flag proof 🟠 MAJOR

**Dimension:** Completeness / Feasibility
**Location:** plan T-23.1–T-23.3.
**Codebase Evidence:** the existing fold runs after intervals are built
(`c64-layout-objects.ts:170–224`, `c64-layout.ts:717–720`); word add/subtract keeps C live across
instructions (`lower-arithmetic.ts:54–127`); `php`/`plp` and branches read flags.
**Problem:** A new arithmetic/shift fold can reintroduce executable zero fill or corrupt a later
carry/branch if it does not reuse T-21's repair and a complete C/V-liveness proof.
**Options:** A) Reuse T-21 compaction and a forward C/V proof that scans to the next definition and
stops at flag reads, `php`/`plp`, calls, branches and block boundaries. B) Keep the chain and file the
gap. C) Fold without the proof.
**Resolution:** ✅ Resolved — delegated decision A. C is unsound; B leaves the measured delta. The
plan now covers add/subtract/shift, the proof boundary, branch/fallthrough repair and a startup
carve-out. Confidence: High. Hardening: challenger Justified.

### PF-011: T-24's E10143/E10273 mapping conflicts with the frozen registry 🟠 MAJOR

**Dimension:** Consistency / Codebase Alignment
**Location:** plan T-24.1.
**Codebase Evidence:** E10143 is the asset-placement alignment/visibility trigger
(`spec/13-data-inclusion.md:237`, template `spec/14-diagnostics.md:160`); E10273 is the combined
constraint conflict (`spec/14-diagnostics.md:244`, F015 §3.2). `vicFieldValue` returns one `null` for
misalignment, out-of-bank and character-ROM overlap (`vic-fields.ts:36–70`).
**Problem:** A constant misaligned VIC field is not a handler-owned asset placement; sending it to
E10143 imports the wrong trigger/template. The producer also loses the failure reason.
**Resolution:** ✅ Resolved — delegated decision: E10143 stays the one-object asset placement
diagnostic; constant field failures, out-of-bank, character-ROM, cross-object, non-asset and explicit
place conflicts use E10273; `vic-fields.ts` returns a structured failure reason and is added to the
modification set. The plan includes a per-condition mapping matrix. Confidence: High. Hardening:
challenger Justified.

### PF-012: T-24 omits `vic-fields.ts` from the modification set 🟡 MINOR

**Dimension:** Dependency Issues
**Location:** plan T-24.2.
**Codebase Evidence:** only `vic-fields.ts` can distinguish misalignment, out-of-bank and
character-ROM reasons; callers currently see one `null`.
**Resolution:** ✅ Resolved — `packages/compiler/src/machine/vic-fields.ts` is now named in the T-24
source set. (Merged with PF-011 for implementation; retained for audit identity.)

### PF-013: T-26's view change collides with the version-1 validator and resident-RAM consumers 🟠 MAJOR

**Dimension:** Logical Contradiction / Codebase Alignment
**Location:** plan T-26 design and T-26.2.
**Codebase Evidence:** `bank0` filters whole intervals (`evidence.ts:563–570`); `reconcileView` keys
on `bankId` (`memory-evidence-validator.ts:374–430`); resident RAM sums all cpu16 non-reservation
records (`evidence.ts:699–701`); the RD-06 test recomputes that sum
(`test/rd06/layout-assets.spec.test.ts:95–101`).
**Problem:** View-local records would fail reconciliation; global records of kind code/asset would
double-count resident RAM; changing the schema is a frozen version-1 change.
**Options:** A) Add VIC-scoped records with `bankId: "vic-bank-0"` in the existing `intervals`, clip at
`$4000`, split reservation fragments, and exclude VIC-scoped records from resident-RAM/SFA-hash
consumers. B) Extend the schema. C) Clip only.
**Resolution:** ✅ Resolved — delegated decision A. B changes the frozen sidecar; C cannot publish
reservations. The plan now names the validator and evidence-test updates. Confidence: High. Hardening:
challenger Justified.

### PF-014: T-26's half-open end, test premise and bank-end case are ambiguous 🟡 MINOR

**Dimension:** Edge Cases
**Location:** plan T-26.1.
**Codebase Evidence:** evidence records use half-open `end = last + 1`
(`memory-evidence-records.ts:94–99`); the default screen window is below `residentStart` and always
reserved; the last bank-0 screen is `$3C00` with table `$3FF8`.
**Problem:** A literal `$3FFF` end would drop a byte; the screen-fill premise must use a relocated
screen; the bank-end case is untested.
**Resolution:** ✅ Resolved — the plan now states `[start,$4000)` with last address `$3FFF`, uses the
relocated active screen and character-ROM window, and adds the `$3C00/$3FF8` case.

### PF-015: The strict modification set is not enumerated 🟠 MAJOR

**Dimension:** Completeness / Ambiguity
**Location:** plan scope table and task steps.
**Codebase Evidence:** the original plan named no test files; existing tests that move include
`lowering-c64.impl.test.ts`, `lowering-layout.impl.test.ts`, `layout-assets.spec.test.ts`,
`evidence-assets.impl.test.ts`, `spritepad.spec.test.ts` and `charpad.impl.test.ts`.
**Problem:** A strict scope cannot be audited without exact paths; an executor could edit an oracle
outside the approved set.
**Resolution:** ✅ Resolved — the plan now has a modification-set table with exact source and test
paths per task, including the new RED tests and the Q-P15 oracle. JSDoc is required for new exported
members.

### PF-016: The plan has no independent review step 🟠 MAJOR

**Dimension:** Completeness / Ordering
**Location:** final verification.
**Codebase Evidence:** `codeops/agent-routing.md` requires correctness, machine-code, target-platform,
SFA/ABI and semantics reviews for this risk class; `codeops/codeops.json` sets strict quality with
`stopOnMajorFinding`.
**Problem:** Critical/major findings could be marked Done with no independent evidence.
**Resolution:** ✅ Resolved — the plan now includes a whole-task independent review with the required
roles, a fix-and-reverify loop, and a closeout step.

### PF-017: Final verification omits affected RD-05/RD-08 suites 🟡 MINOR

**Dimension:** Completeness
**Location:** final verification.
**Codebase Evidence:** `test/rd05/profile-mutable-values.impl.test.ts` uses `poke(&value, 2)`;
RD-05 source-library suites use static raw writes; `test/rd08/optimizer-exact-output.impl.test.ts`
pins the none identity.
**Resolution:** ✅ Resolved — the plan now runs the affected RD-05 raw-address/mutable-value/
source-library suites and the RD-08 identity test.

### PF-018: RD-06 findings and closeout remain stale after closure 🟡 MINOR

**Dimension:** Completeness
**Location:** final verification.
**Codebase Evidence:** `05-findings.md` still says "deferred to T-20…T-27"; `09-closeout.md` retains
the residual table.
**Resolution:** ✅ Resolved — the plan now updates both documents with the exact verified evidence.

### PF-019: Closing issue #140 is an unauthorized external mutation 🟡 MINOR

**Dimension:** Scope / Security
**Location:** final verification.
**Codebase Evidence:** issue mutation is an outward-facing action; repository policy authorizes
parity-gap issue creation, not blanket closure.
**Resolution:** ✅ Resolved — the plan now proposes closure with evidence and closes only on explicit
user instruction.

### PF-020: The blanket preservation sentence contradicts four tasks 🟡 MINOR

**Dimension:** Consistency
**Location:** scope guard.
**Codebase Evidence:** T-24 changes diagnostics, T-25 changes inventory types, T-26 changes views and
T-27 changes pointer/reservation behavior.
**Resolution:** ✅ Resolved — replaced by the changed-oracle table; every other oracle remains fixed.

### PF-021: T-25's exact inventory derivations are under-specified 🟡 MINOR

**Dimension:** Edge Cases
**Location:** plan T-25.2.
**Codebase Evidence:** CTM packed-12 length is `cells + ceil(cells/2)`; canonical cells choose byte
or word from the values; SPD tiles are `tileCount*tileWidth*tileHeight` words.
**Resolution:** ✅ Resolved — the plan now requires lengths from the actual parsed slices and names
the packed-12 and canonical-width cases.

### PF-022: T-27's VICE test does not prove the screen is active; the pointer-table hardware window is unmodeled 🟡 MINOR

**Dimension:** Testability / Edge Case
**Location:** plan T-27.2.
**Codebase Evidence:** fixed sprite-pointer windows appear in
`semantic/aggregate-place-proof.ts:338,585` and `closed-object-facts.ts:249`; `setSpritePointer` is not
a fixed capability.
**Resolution:** ✅ Resolved — the VICE test now reads `$D018` and asserts the `$0C00` screen field; the
pointer-table effect is resolved to an absolute address after layout, and the raw `$D018`/unmodeled
future-observer boundary is recorded as user-owned. No new semantic proof is added.

### PF-023: "0 identity bytes" can be read as an artifact-size win 🔵 OBSERVATION

**Dimension:** Consistency
**Location:** residual-delta table.
**Resolution:** ✅ Accepted with wording — the plan now says "identity code bytes" and states that the
loaded PRG retains an unreachable zero fill unless the last loaded interval is compacted.

### PF-024: "every E10132/E10133 remedy" overstates SPD 🔵 OBSERVATION

**Dimension:** Consistency
**Location:** plan T-25.1.
**Resolution:** ✅ Accepted with wording — changed to "every applicable E10132/E10133 remedy"; SPD
has no E10132 path because it defaults to `sprites`.

### PF-025: "no failure may be waived" conflicts with the known RD-05 flake 🔵 OBSERVATION

**Dimension:** Consistency
**Location:** final verification.
**Resolution:** ✅ Accepted with wording — a known flake must be rerun to green and the rerun
recorded; it is not waived.

### PF-026: T-27 before T-24 needs a source-linked diagnostic path 🟡 MINOR

**Dimension:** Ordering & Sequencing
**Location:** task order.
**Codebase Evidence:** `sourcePlacementFailure` already emits source-linked E10273 for layout failures
(`resource-diagnostics.ts:49–76`); T-24 generalizes VIC field diagnostics.
**Resolution:** ✅ Resolved — T-27 uses the existing `sourcePlacementFailure` path for the ambiguous
screen rejection; T-24 later generalizes the VIC field/layout diagnostic plumbing. The order stays as
requested (real hardware defect first).

### PF-027: T-21's draft/final compaction split breaks the shared-storage stability gate 🟠 MAJOR

**Dimension:** Logical Contradiction / Feasibility / Ordering (iteration 2)
**Location:** revised T-21.2–T-21.3 and T-23.2.
**Codebase Evidence:** `closeSharedStorage` compares a draft and final layout shape that includes
`loadRange` and every function's per-instruction `codeShape`
(`packages/compiler/src/services/shared-storage.ts:181–196,262–270`). Compacting only when
`draftFunctionStorage` is false guarantees a shape mismatch for every folded VIC op.
**Problem:** The revised plan would fail `storage-layout-instability` on Q-P15 and the RD-06 layout
assets, so T-21 and T-23 could not land.
**Options:** A) Compact identically in the draft and final layouts, so the draft's trailing ranges
use the same compacted size. B) Keep draft-only identity and teach `shared-storage.ts` to ignore the
intended fold/fill difference. C) Drop the compaction.
**Resolution:** ✅ Resolved — delegated decision A. B adds a special-case comparison surface; C
reopens the defect. The plan now requires identical draft/final fold and compaction and verifies the
stability gate. Confidence: High. Hardening: iteration-2 auditor identified the contradiction;
fixed design rechecked below.

### PF-028: T-24's structured fields are dropped at the `lower.ts` boundary 🟠 MAJOR

**Dimension:** Completeness / Dependency (iteration 2)
**Location:** revised T-24.2 and modification set.
**Codebase Evidence:** `lowerMachineProgramBody` catches `LoweringFailure` and returns only
`{kind, reason, source}` (`packages/compiler/src/machine/lower.ts:702–705`).
**Problem:** A new diagnostic code and contributors would never reach `size-selection.ts` unless the
catch copies them.
**Resolution:** ✅ Resolved — `packages/compiler/src/machine/lower.ts` is now in T-24's source set, and
T-24.2 explicitly copies the structured fields through the catch.

### PF-029: T-26's VIC projections would corrupt CPU view and cost sums 🟠 MAJOR

**Dimension:** Completeness / Codebase Alignment (iteration 2)
**Location:** revised T-26.2.
**Codebase Evidence:** CPU view and resident-RAM/zero-page/scratch sums select records by
`addressSpaceId` only (`services/evidence.ts:563–569,699–727`); the evidence sort omits `bankId`
(`evidence.ts:550–562`), while the validator keys on it
(`memory-evidence-validator.ts:333–337,380–409`); `buildView` has no bank parameter.
**Problem:** VIC-scoped projections would inflate CPU-view aggregates, double-count costs, and fail
interval ordering; the VIC view could not select the projections.
**Resolution:** ✅ Resolved — the plan now requires CPU view and cost sums to select only
non-`bankId` records, the VIC view to select only `bankId: "vic-bank-0"` records, `buildView` to be
bank-aware, and the evidence sort to include `bankId`. A directed test asserts CPU sums are unchanged
and both views reconcile.

### PF-030: T-22's static selector is never installed in lowering state 🟡 MINOR

**Dimension:** Dependency (iteration 2)
**Location:** revised T-22.2 and modification set.
**Codebase Evidence:** `selectRegisterForwarding` results are destructured into
`FunctionLoweringState` in `lower-function.ts:121–172`.
**Resolution:** ✅ Resolved — `packages/compiler/src/machine/lower-function.ts` is now in T-22's source
set.

### PF-031: Constant screen selection has no asset footprint to reserve 🟡 MINOR

**Dimension:** Ambiguity / Edge Case (iteration 2)
**Location:** revised T-27 design and T-27.1.
**Codebase Evidence:** a constant `vicScreenSelect($0C00)` produces a constant result with no label
(`lower-c64.ts:489–506`).
**Resolution:** ✅ Resolved — the plan now states that a constant selection resolves the pointer base
but creates no layout footprint and remains user-owned like raw `$D018`; the full-footprint rule
applies only to a label/asset screen. A constant RED case asserts `$0FF8` without a footprint.

### PF-032: T-20 changes the `ordinal-address` contract without editing its owner 🟡 MINOR

**Dimension:** Consistency (iteration 2)
**Location:** revised T-20.2 and modification set.
**Codebase Evidence:** the `LoweredValue` comment says only a volatile raw read may consume an
`ordinal-address` (`machine/lower-control.ts:68–75`).
**Resolution:** ✅ Resolved — `lower-control.ts` is now in T-20's source set for the comment update
only; the value kind and behavior are unchanged.

### PF-033: The canonical const-initializer screen form is untested 🟡 MINOR

**Dimension:** Testability / Completeness (iteration 2)
**Location:** revised T-27.1.
**Codebase Evidence:** the frozen F015 pattern uses
`const SCREEN_SELECT: byte = vicScreenSelect(&BMP_SCREEN)` and later writes it to `$D018`
(`spec/evaluations/F015-data-inclusion.md:851–859`).
**Resolution:** ✅ Resolved — T-27.1 now includes the const-initializer form and requires the
active-screen scan to cover the `lower-data.ts` path.

---

## Iteration 2 — Bounded Re-scan

**Scope:** verify every PF-001–PF-026 resolution; re-scan the changed sections against all 13
dimensions. Seven new root causes were found (PF-027–PF-033, 3 major, 4 minor) and fixed in the plan.

## Iteration 3 — Fix Verification

**Scope:** verify PF-027–PF-033 fixes and their direct dependency surface; no broad re-scan.

| Check | Result |
|---|---|
| Required mini-plan shape (objective, smallest design, checklist, verify) | ✅ present |
| Every T-20–T-27 defect has RED, implementation, verification | ✅ present |
| Exact modification set and test paths | ✅ enumerated per task, including the new owners |
| Q-P15 timing and T-20 mode | ✅ per-task measured updates; pinned none fixture guarded |
| T-27 active screen, const form and footprint | ✅ unique label/constant, const initializer, full 1 KiB for assets, no constant footprint, collision failure, ledger |
| T-22 static path and cost modes | ✅ static-address kind, RAM/ZP costs, dynamic fallback, state installation |
| T-21 draft/final compaction | ✅ identical fold in draft and final; stability gate checked |
| T-23 flag proof/shift/compaction | ✅ all specified |
| T-24 frozen mapping and catch boundary | ✅ E10273 for constant/field conflicts; E10143 for asset placement; `lower.ts` included |
| T-26 validator/projection scope | ✅ bank-aware views, CPU/cost/SFA consumers exclude projections, sort includes `bankId` |
| Independent review and closeout | ✅ present |
| New complexity escalation | ✅ none |
| `spec/` untouched | ✅ no edit proposed |

**Final status:** ✅ PREFLIGHT PASSED WITH NOTES — 0 critical, 0 major, 0 minor unresolved; 3
observations accepted with wording fixes.

**Residual notes:** the `$D800` Color-RAM ordinal-write gap and the ambiguous multi-screen
`setSpritePointer` restriction remain tracked, reopenable debts. Runtime status remains
`VICE-verified / hardware-unverified`.

**Artifact hash after iteration-3 fixes:** `89d280bae3c3e3f8968f9bc3f584c28cde4977925de9315ba27a44198eb722d3`.
