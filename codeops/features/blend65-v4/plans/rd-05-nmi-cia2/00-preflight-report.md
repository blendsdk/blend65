# Preflight: cooperative NMI qualification

> **Status**: ✅ PREFLIGHT PASSED — all eight findings resolved
> **Iteration**: 2 — bounded verification after the first full scan
> **Artifact**: eight core documents in `codeops/features/blend65-v4/plans/rd-05-nmi-cia2/`
> **Original SHA256**: `459498f663c39efe8c55ead08abd6f9ed71e112abc7c94fd23f024b795b2a9fd`
> **Verified SHA256**: `79fd4e6cf98b6f3db13415ab2bf2f04ab0b661d3f562eff8d1ba911921471a46`
> **Code baseline**: `0380d69ae1123a31768a04578374827e66ad3f93`; workflow setup `bfdff8d5`
> **Last Updated**: 2026-10-04
> **CodeOps Artifact Schema**: 1

SAME-SESSION REVIEW: the primary created this plan in the current logical session.
Fresh independent clusters and an independent challenger reduce, but do not erase,
that bias. A human interrupt-domain review remains useful near release.

## Target, authority and context

The exact payload is `00-ambiguity-register.md`, `00-index.md`,
`01-requirements.md`, `02-current-state.md`, `03-nmi-route.md`,
`03-stack-evidence.md`, `07-testing-strategy.md` and `99-execution-plan.md`.
Report/continuity files are excluded. Hash sorted filenames as
`name + NUL + SHA256(raw bytes) + newline`, then SHA256 that stream.
The modification set is these documents, this report and the derived feature
roadmap. Frozen authorities, compiler code and tests are audit context only.

Strict scope: AR-P2/AR-P7/AR-P10–AR-P12, four cooperative PAL/NTSC × 6581/8580
PRG profiles, stock-chained NMI and honest finite-component evidence. No API,
profile, runtime manager, framework, schema, validator, reporter, optimizer or
source-form restriction is added. CIA2 consuming reads stay stock-owned;
exclusive handoff, keyboard and remaining RD-05 obligations are not closed.

The user approved continuation. AGENTS.md's workflow prime directive §4 assigns
compiler/plan-owned technical corrections to the primary without another prompt.
All eight rulings below use that standing authority within the approved scope,
not a fabricated new user acceptance or an auto-design flag. No product fork or
complexity escalation is resolved on the user's behalf.

Context: active RD-05/feature roadmap; frozen Chapters 03/06/12/14/15 and
Appendix C64; expert 2.0.3/content
`22cc5f00f381c82d347cf342be4fcff16bc291c6`; completed T-04/T-05/T-08 proof evidence.
Governing keys include `BLEND65-SPEC-4-038b70e9`, `MOS-PGM-1976`, `MOS-HW-1976`,
`MOS-6510-1982`, `MOS-6526-1981` and `CBM-C64-KERNAL-03`.
Normative anchors: Ch 06 §7.4–§7.5 preservation/reentrancy; Ch 15 interrupt
ownership; SFA final-storage closure; pinned NMINV/KERNAL and CIA contracts.
The existing analytical 3/5, 8/21 and 16/43 wrapper byte/cycle expectations agree
with the official NMOS grid. No generated or runtime measurement follows.

## Codebase context and independent coverage

Observed stack: TypeScript/NodeNext, Node 22+, Yarn workspaces, Vitest, ACME 0.97
and VICE 3.10. Existing ownership/context analysis feeds inventory and selected
machine storage closure; check stops before final layout, while build additionally
lays out, assembles, validates evidence and publishes all-or-nothing artifacts.

Mapped source/test owners: semantic whole-program, interrupt contexts/ownership;
storage inventory/closure/IRQ stack; machine effects, platform/interrupt/function
lowering; C64 layout/placement; compiler services/evidence; memory evidence and
ordering validators; old service resource assertions and expressiveness ledger.
The current-state table and individual findings give concrete source locations.

| Cluster     | Dimensions | Independent result                                                                      |
| ----------- | ---------- | --------------------------------------------------------------------------------------- |
| ① Soundness | 1/3/12     | Endpoint and ledger ordering gaps; no new bounded-peak contradiction                    |
| ② Grounding | 2/13       | Owner, placement, identity and existing-test impact corrections                         |
| ③ Delivery  | 4/5/11     | Duplicate record failure; old implementation fixture and ledger sequencing              |
| ④ Risk      | 8/9/6      | Missing NMI-origin IRQ counterexample; no additional security/feasibility defect        |
| ⑤ Fit       | 7/10       | Primary inline after runtime thread-limit refusal; no added defect or support machinery |

Auditors are read-only; unavailable specialist names used bounded generic packets.
One independent `design-challenger` assessed the complete major batch without the
primary's preferred choices and confirmed both roots and the smaller remedies.
Its accidental broad release-history read was disclosed and excluded from decisive
reasoning. This is a plan/code audit, not a blind qualification check.
No second full audit team or extra challenger was dispatched.

## Summary by dimension

Counts name distinct first-scan roots; repeated cluster reports are deduplicated.

| #   | Dimension               | Findings | Highest severity |
| --- | ----------------------- | -------- | ---------------- |
| 1   | Ambiguities             | 1        | 🟡 MINOR         |
| 2   | Implicit assumptions    | 2        | 🟡 MINOR         |
| 3   | Logical contradictions  | 0        | —                |
| 4   | Completeness gaps       | 1        | 🟠 MAJOR         |
| 5   | Dependency issues       | 0        | —                |
| 6   | Feasibility concerns    | 0        | —                |
| 7   | Testability             | 0        | —                |
| 8   | Security blind spots    | 0        | —                |
| 9   | Edge cases              | 1        | 🟠 MAJOR         |
| 10  | Scope creep             | 0        | —                |
| 11  | Ordering and sequencing | 1        | 🟡 MINOR         |
| 12  | Consistency             | 0        | —                |
| 13  | Codebase alignment      | 2        | 🟡 MINOR         |

| Severity    | First scan | Final state            |
| ----------- | ---------- | ---------------------- |
| CRITICAL    | 0          | None                   |
| MAJOR       | 2          | Both verified resolved |
| MINOR       | 6          | All verified resolved  |
| OBSERVATION | 0          | None                   |

## Findings and technical rulings

Locations below refer to the original payload unless a corrected heading is named.
Compiler paths are relative to `packages/compiler/src/`; root tests use `test/`.

### PF-001: duplicate evidence keys 🟠 MAJOR

**Dimension:** 4 — completeness.
**Location:** `03-stack-evidence.md:13–24`, Direct change.
**Codebase evidence:** `artifacts/memory-evidence-validator.ts:505–511` keys by
source site plus kind; `artifacts/evidence-validation.ts:127–130` requires strict
order; `services/evidence.ts:408–420` fails invalid encoding before publication.
**Problem:** three same-site machine-state rows have identical keys even with
different classes. An empty cooperative build would fail evidence preparation.
**Best option:** one truthful main-site machine-state record with the exact stable
compound class naming all three unproved obligations. Keep it opaque; no parser
or schema change. ST-1/internal grouping must assert the same representation.
**Refutation:** sorting or renaming classes does not change the key. Fabricated
sites are false attribution. Independent class counting could justify a later
schema/consumer project, but is not required or authorized here.
**Authority:** standing plan-owned technical ruling, workflow prime directive §4.
**Hardening:** independent challenger confirms; confidence High. Reopen if a real
consumer requires separately addressable classes. Implementation output remains Unknown.
**Iteration 2:** resolved. The existing type accepts one nonempty opaque class;
the source-site/kind key occurs once. Independent challenger verifies the fixed
contract and ST-1/internal grouping. No validator/schema expansion.

### PF-008: NMI-origin IRQ saved-word overwrite 🟠 MAJOR

**Dimension:** 9 — edge cases.
**Location:** `07-testing-strategy.md:33` ST-13; `03-nmi-route.md:67–72` preserved IRQ path.
**Codebase evidence:** `semantic/interrupt-contexts.ts:147–169` supplies an
activation root only for IRQ; `machine/lower-platform.ts:99–113` binds NMI-origin
IRQ installation to a depth-only word; `machine/lower.ts:317–324` chains through it.
**Problem:** outer NMI saves IRQ A in W and installs B; repeated NMI saves current
B into the same W. Both restores now select B, potentially chaining B to itself.
This is an analytical admission-path witness, not an already admitted runtime bug.
**Best option:** explicitly apply the existing all-link invariant to both sinks
reached from NMI, including helpers. Add direct/helper changed-capture cases with
canonical E10245 in check/build and no generation. Preserve ordinary IRQ-only behavior.
**Refutation:** universal observer prose already requires rejection, but the
explicitly preserved depth-only path had no discriminating oracle. Prose alone
does not cover that seam; a blanket source ban or new analysis framework is unnecessary.
**Authority:** standing plan-owned technical ruling; AR-P12's existing observer invariant.
**Hardening:** independent challenger confirms; confidence High for the witness
and missing coverage. Actual diagnostics and runtime qualification remain Unknown.
**Iteration 2:** resolved. The independent risk reviewer confirms both-sink/helper
coverage, unchanged ordinary IRQ-only behavior and the discriminating ST-13 oracle.

### PF-002: nonexistent evidence owner 🟡 MINOR

**Dimension:** 13 — phantom reference.
**Location:** `03-stack-evidence.md:8,50`.
**Codebase evidence:** `services/evidence.ts:139` exports `prepareEvidence`.
**Best option:** replace both `deriveBuildEvidence` references with that existing
owner; no extraction or signature change. Searching for the former found no owner.
**Authority:** standing plan-owned technical correction. **Iteration 2:** resolved;
both references match the actual exported owner without a signature change.

### PF-003: missed existing implementation fixture 🟡 MINOR

**Dimension:** 13 — test impact.
**Location:** `99-execution-plan.md:54–65`, task 1.3.1.
**Codebase evidence:** `services/services.impl.test.ts:99–104` expects reserve as
20 used bytes and inflated qualified capacity. It will fail after the correct fix.
**Best option:** name only those obsolete reserve/capacity assertions as
implementation-tier updates alongside the new internal tests. Preserve publication,
identity, debug and unrelated assertions; no specification-test exception is needed.
**Authority:** standing plan-owned technical correction. **Iteration 2:** resolved;
task 1.3.1 names the existing fixture and preserves unrelated assertions.

### PF-004: missing placement propagation 🟡 MINOR

**Dimension:** 2 — implicit assumption.
**Location:** `02-current-state.md:17`; route ABI/placement and task 2.2.7.
**Codebase evidence:** `machine/lower-function.ts:635–639` omits placement;
`machine/lower.ts:315–337` attaches it only to ordinary functions;
`machine/lower-c64-interrupt.ts:143` inherits only the supplied body's placement.
**Best option:** explicitly propagate semantic placement onto the complete
interrupt wrapper before entry adaptation. Existing wrapper copying cannot recover
absent facts; moving only the pad would violate the source constraint.
**Authority:** standing plan-owned technical correction. **Iteration 2:** resolved;
the current-state table, route and task 2.2.7 require propagation before adaptation.

### PF-005: build identity overclaim 🟡 MINOR

**Dimension:** 2 — implicit assumption.
**Location:** `02-current-state.md:39–40`, compatibility.
**Codebase evidence:** `services/evidence.ts:142–150` hashes static BUILD_INFO;
`services/services.ts:468` creates a fresh generation UUID. Source/options identity
does not detect an implementation-only compiler revision.
**Best option:** record compiler commit, fresh generation ID and exact artifact/
sidecar digests in qualification. Do not invent a public revision field, migration
or cache system. Existing generation separation suffices for this slice.
**Authority:** standing plan-owned technical correction. **Iteration 2:** resolved;
current-state compatibility and task 2.3.3 require fresh exact evidence, not a false
implementation fingerprint.

### PF-006: check versus build endpoint 🟡 MINOR

**Dimension:** 1 — ambiguity.
**Location:** `03-nmi-route.md:8–10`, admission.
**Codebase evidence:** `services/services.ts:156–310` shares selected storage closure;
build's final layout/encoding path starts at `:403`.
**Best option:** route/context and selected-storage proof precede check success;
build additionally proves final placement before emission/publication. Do not
claim check proves layout or move layout into it. Keep endpoint attribution in
ST-18: full selected-save construction may use existing internal instruction
fixtures; public source tests must use genuinely legal source, not new register opcodes.
**Refutation:** a broad reading of “complete proof” is not wrong in intent, but
obscures which public service can produce which evidence.
**Authority:** standing plan-owned technical clarification. **Iteration 2:** resolved;
admission distinguishes selected check proof from build placement/encoding, and
testing/execution distinguish legal public source from internal selected-body fixtures.

### PF-007: ledger retirement before runtime proof 🟡 MINOR

**Dimension:** 11 — ordering.
**Location:** requirements acceptance `01-requirements.md:30–31`; tasks 2.2.10/2.3.3.
**Codebase evidence:** `test/rd04/expressiveness-ledger.spec.test.ts:153–165` rejects
a deferred row after a successful build. The old plan required ledger GREEN before
the native runtime proof required for its retirement.
**Best option:** author split probes/expectations first with deferred rows; exclude
ST-23 from the intermediate GREEN gate. After successful native qualification,
retire only chained and verify ST-23 before the full checkpoint. Never commit the
intermediate deferred-ledger/build disagreement. Preserve every unrelated negative.
**Refutation:** early retirement would make the ledger suite green but falsely
claim qualification. Weakening the ledger gate is not needed or approved.
**Authority:** standing technical sequencing within AR-P11's exact exception.
**Iteration 2:** resolved. The independent challenger verifies runtime-before-
retirement sequencing, the ST-23 exclusion and prohibition on intermediate commits.

## Bounded recheck and verdict

All eight fixes and their changed source references are verified. The bounded
iteration-2 scan covers all 13 dimensions and finds no new root or residual defect.
No product decision is opened. The original 28 tasks/two phases remain; task
status is still 0/28, not qualification. Passing never closes RD-05 or DEF-7.

Validation: the target-specific derived-status helper reports Ready 0/28 with no
problems; 44 local links/anchors, twelve resolved register rows and unique ordered
task IDs pass. Forced targeted formatting and whitespace/frozen-path guards pass.
The source baseline is unchanged. No compiler suite is required for this docs-only
checkpoint. The separate specialist setup passed the 12 foundation guards.

Repository-wide helper caveats are context, not this target's defects: seven
existing one-task mini-plans lack full-plan indexes; the portfolio still reports
1/10 versus the feature's 4/10. Non-integration policy defers that portfolio write.
No unrelated artifact is repaired or represented as passed here.

Adversarial checks cover selected hidden helper homes; post-pop observers; changing
predecessors versus repeated immutable external routes; both vector sinks;
opaque/MMIO aliasing; final source placement; per-entry versus external aggregate
stack; firmware completion and ordinary modern-source helpers/locals.
No static-frame manager, generalized observer framework, new optimizer or source
opcode is needed merely to make the review/test organization work.

Plan/source audit only: emitted admission, final assembly/bytes/costs, four-profile
genuine-source runtime and physical behavior remain Unknown. The native T-04/T-05
input mechanism is context, not generated-route qualification. Future VICE results
must remain `VICE-verified / hardware-unverified`; host/hardware QA stays RD-10.
