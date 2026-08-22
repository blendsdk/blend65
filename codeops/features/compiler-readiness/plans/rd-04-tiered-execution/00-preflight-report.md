# Preflight Report: RD-04 Tiered Compiler, ACME and VICE Execution Plan

> **Status**: ✅ PREFLIGHT PASSED — 0 critical or major findings unresolved
> **Iteration**: 5 (final exact verification)
> **Artifact**: full implementation plan at `codeops/features/compiler-readiness/plans/rd-04-tiered-execution/`
> **Audited Baseline Commit**: `db2a91bc753850f33c06ebda0f10c9e60f7efd8c`
> **Audited Content Hash**: `sha256:f2a40d6a65ee0d40e5637247ac1e44916357e3ec73c1cc3f44e9ebfe93b036c7`
> **Codebase Grounded**: 31 source/test/config files examined; 42 plan-to-code references verified
> **Last Updated**: 2026-08-22
>
> ⚠️ **SAME-SESSION REVIEW:** This plan was created in the current session. Same-agent bias risk is
> elevated. The clustered independent audit and recommendation challenger reduce but do not remove
> that risk. Because this plan establishes process-control and publication-authority foundations,
> consider an additional human compiler/security review before execution.

## Codebase Context Summary

**Tech Stack:** Node 22, strict TypeScript ESM/NodeNext, Yarn v1 workspaces, Turborepo, Vitest and
ESLint v9.

**Architecture:** `@blend65/readiness` is a workspace-independent authority core with exact
publication and implementation-revision boundaries. Compiler, CLI and test-harness packages expose
separate public contracts. The existing VICE driver owns binary/text monitor transports and the
current readiness publications use fixed generated dependency closures plus opaque resolver state.

**Key files examined:** root/package manifests and TypeScript references; readiness publication,
candidate-revision, resolver, source-boundary and campaign modules; compiler diagnostics and
frontend pipeline; CLI entry/I/O seams; ACME invocation; test-harness VICE driver, protocol, text
monitor and run strategies; all 13 plan documents; RD-04 and its completed requirements preflight.

**External protocol grounding:** The official
[VICE binary-monitor manual](https://vice-emu.sourceforge.io/vice_13.html) defines checkpoint CPU
operation `0x02` as store and `0x04` as execute, and defines Advance Instructions as a 16-bit request
whose response contains no executed-count field. The official
[Node child-process documentation](https://nodejs.org/api/child_process.html) exposes stdout and
stderr as separate readable pipes. The cross-stream ordering conclusion below is therefore an
explicit inference from those separate transports, not a claimed Node ordering rule.

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---:|---|---:|---|
| 1 | Ambiguities | 1 | 🟠 MAJOR |
| 2 | Implicit Assumptions | 3 | 🟠 MAJOR |
| 3 | Logical Contradictions | 1 | 🟠 MAJOR |
| 4 | Completeness Gaps | 6 | 🟠 MAJOR |
| 5 | Dependency Issues | 2 | 🟠 MAJOR |
| 6 | Feasibility Concerns | 4 | 🟠 MAJOR |
| 7 | Testability | 3 | 🟠 MAJOR |
| 8 | Security Blind Spots | 2 | 🟠 MAJOR |
| 9 | Edge Cases | 5 | 🟠 MAJOR |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 1 | 🟠 MAJOR |
| 12 | Consistency | 1 | 🟡 MINOR |
| 13 | Codebase Alignment | 6 | 🟠 MAJOR |

Counts overlap where one root cause spans dimensions; the finding total is deduplicated below.

## Final Summary by Severity

| Severity | Encountered | Unresolved | Status |
|---|---:|---:|---|
| CRITICAL | 0 | 0 | None |
| MAJOR | 30 | 0 | All remediated and verified |
| MINOR | 6 | 0 | All remediated and verified |
| OBSERVATION | 0 | 0 | None |

| Iteration | Frozen hash | Result |
|---:|---|---|
| 1 | `524ab8cb…3678` | 14 major and 3 minor findings; auto-design rulings recorded below |
| 2 | `cc207b1c…d3aa6` | 9 major and 1 minor residual/new findings; challenger-converged fixes applied |
| 3 | `9dfd6a8e…9e60` | 5 major and 1 minor dependency-surface findings; fixes applied |
| 4 | `5fbc85d4…484d` | 2 major and 1 minor exact-contract findings; fixes applied |
| 5 | `f2a40d6a…36c7` | Two independent exact rechecks: no findings |

## Findings

### PF-001: Completion polling runs beyond semantic completion 🟠 MAJOR

**Dimension:** 1 Ambiguities; 2 Implicit Assumptions; 13 Codebase Alignment
**Location:** `03-06-vice-control-lease.md`, Runtime loop; `99-execution-plan.md`, tasks 4.2.7 and 5.2.1–5.2.2
**Codebase Evidence:** `packages/test-harness/src/emulator/vice/vice-driver.ts:268`; `packages/test-harness/src/emulator/vice/protocol.ts:156`; `packages/test-harness/src/run/strategies.ts:198`

**The Problem:** Polling the completion byte only between instruction chunks lets VICE execute the
remainder of a chunk after the completion-last store. Direct MMIO can change after completion, and
VICE returns no partial executed count when a checkpoint interrupts Advance Instructions.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Emit an identity-bound label immediately after the completion store, arm a temporary EXEC checkpoint there, and charge the full requested chunk before submission | Stops after the committed store; uses the proven EXEC codec; conservative budget proof | Adds synthetic control flow and couples the proof to its label |
| B | Arm a temporary STORE watchpoint on the completion byte, require its exact hit and `$A5` readback, and charge the full requested chunk | Stops on the semantic completion operation itself | Requires live VICE 3.10 proof that readback is committed at the event |

**Recommendation:** Option B. It observes the semantic completion operation without adding control
flow. Require live VICE 3.10 validation of watchpoint timing, exact address/event matching and the
subsequent `$A5` readback. Add midway-through-chunk, post-return mutation, final-budget-chunk and
cleanup tests. Single-stepping was rejected as incompatible with the
10,000,000-instruction/120-second envelope.

**User Decision:** `Authority: AI — delegated by --auto-design`; Option B selected, applied and verified.

### PF-002: Cleanup failure precedence contradicts first-terminal semantics 🟠 MAJOR

**Dimension:** 3 Logical Contradictions
**Location:** `03-01-execution-contracts-routing.md`, Failure behavior; `03-05-process-filesystem-safety.md`, Ownership state machine; `00-ambiguity-register.md`, AR-P9
**Codebase Evidence:** `packages/test-harness/src/emulator/vice/vice-driver.ts:242`

**The Problem:** The plan says the first terminal stage wins, but also says ambiguous VICE cleanup
produces the recovery-blocked result. It does not say which code is primary when an operational
failure and unsafe cleanup coexist.

**Recommendation:** Preserve the first operational failure as primary and attach a mandatory
structured cleanup blocker; treat pass as provisional so cleanup failure becomes primary when no
earlier failure exists. Every recovery ambiguity prevents authority and retains the lease. Always
replacing the primary result was rejected because it hides the original deterministic failure.

**User Decision:** `Authority: AI — delegated by --auto-design`; recommendation selected, applied and verified.

### PF-003: Write cases lack a post-write C64 MMIO projection 🟠 MAJOR

**Dimension:** 2 Implicit Assumptions; 13 Codebase Alignment
**Location:** `03-02-envelope-identity-observation.md`, Initial state projection and Envelope IR; `03-07-orchestration-acceptance.md`, Entry point
**Codebase Evidence:** `packages/readiness/src/modeled-case-builder.ts:158`; `packages/readiness/src/oracle-memory.ts:447`

**The Problem:** RD-03 records logical writes such as `$20`, while a direct read of VIC color
register `$D020` returns `$F0`. The plan defines only a pre-entry read projection, so the required
direct comparison makes valid `poke`/`pokew` cases fail or invites an undocumented oracle change.

**Recommendation:** Add a separate versioned C64 observation projection that maps each logical
write byte to `0xF0 | (byte & 0x0F)` for `$D020..$D022`, bind its revision into execution identity,
and leave RD-03 logical effects unchanged. Test the existing `$20`/`$2000` values and low-nibble
mutants. Changing RD-03 expectations was rejected because it would conflate logical semantics with
target readback.

**User Decision:** `Authority: AI — delegated by --auto-design`; recommendation selected, applied and verified.

### PF-004: Specification-visible TypeScript interfaces are incomplete 🟠 MAJOR

**Dimension:** 4 Completeness Gaps; 6 Feasibility Concerns; 7 Testability
**Location:** all `03-*` component designs; `99-execution-plan.md`, every `[spec-author]` task
**Codebase Evidence:** `packages/readiness/src/index.ts:23`; `packages/readiness/package.json:6`

**The Problem:** The documents name types and behaviors but omit exact export paths, function
signatures, fields and result discriminators. An implementation-blind spec author must invent the
API, making the immutable oracle an accidental design authority.

**Recommendation:** Add per-phase interface appendices with exact module paths and TypeScript
signatures for every spec-visible constructor, validator, planner, envelope/evidence façade,
supervisor seam, VICE control/lease operation, publication/composite resolver and orchestrator.
Leave internal helpers undesigned.

**User Decision:** `Authority: AI — delegated by --auto-design`; recommendation selected, applied and verified.

### PF-005: Phase 4 specification placement creates a reverse dependency 🟠 MAJOR

**Dimension:** 5 Dependency Issues; 11 Ordering & Sequencing
**Location:** `07-testing-strategy.md`, ST-34–ST-43 file table; `99-execution-plan.md`, tasks 4.1.1–4.2.8
**Codebase Evidence:** `packages/test-harness/package.json:16`; `packages/test-harness/tsconfig.json:4`

**The Problem:** The test-harness specification is assigned lease, identity, budget and cleanup
behavior owned by readiness-execution, while readiness-execution already depends on test-harness.
The test cannot turn green without a dependency cycle or an ownership reversal.

**Recommendation:** Split Phase 4 specs by owner: low-level codec/control and root-driver
compatibility stay in test-harness; lease, identity, launch policy, cumulative budgets and cleanup
move to readiness-execution. Update the RED/GREEN tasks and testing table together.

**User Decision:** `Authority: AI — delegated by --auto-design`; recommendation selected, applied and verified.

### PF-006: Child-publication authority is absent from the source-boundary gate 🟠 MAJOR

**Dimension:** 4 Completeness Gaps; 8 Security Blind Spots; 13 Codebase Alignment
**Location:** `03-03-execution-publication.md`, Atomic publication; `99-execution-plan.md`, Phase 6
**Codebase Evidence:** `packages/readiness/src/publication-conformance-v1.ts:97`; `packages/readiness/src/binding-publication.spec.test.ts:627`

**The Problem:** New execution-publication modules and literals are outside the current exact owner
allowlist. Common member names may fail the old gate, while the new root/pointer literals can evade
it entirely. Generalizing filesystem primitives does not update this independent containment gate.

**Recommendation:** Add a path-family-specific exact execution-publication owner allowlist and
complete-source tests. Preserve the existing publication-v1 owner set and immutable specification
unchanged; prove ordinary modules cannot access either authority family. A shared broad allowlist
was rejected because it weakens historical ownership.

**User Decision:** `Authority: AI — delegated by --auto-design`; recommendation selected, applied and verified.

### PF-007: Cross-workspace content-derived route authority is undefined 🟠 MAJOR

**Dimension:** 2 Implicit Assumptions; 4 Completeness Gaps; 5 Dependency Issues; 13 Codebase Alignment
**Location:** `03-03-execution-publication.md`, Resolver model and Review gate; `99-execution-plan.md`, task 6.2.3
**Codebase Evidence:** `packages/readiness/src/publication-candidates.ts:28`; `packages/readiness/src/publication-authority-loader.ts:72`; `packages/readiness/src/dependency-boundary.impl.test.ts:105`

**The Problem:** The plan never defines how the workspace-independent readiness resolver verifies
and reconstructs six implementations whose live entrypoints span readiness-execution, compiler, CLI
and test-harness. Generic caller-supplied candidates would be substitutable; toolchain imports would
violate the package boundary.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Readiness owns passive child bytes/schema/path validation; readiness-execution owns the fixed six-handler live catalog and generated cross-workspace closures, creating the opaque context only after exact row/freshness matching | Preserves dependency direction and associates live functions in their composition owner | Requires a precise two-package capability handoff |
| B | Readiness owns the cross-workspace generated closure catalog and reconstructs live authority through passive adapters | Centralizes publication authority | Risks recreating a live toolchain association inside a package forbidden to import it |

**Recommendation:** Option A. Define the exact handoff, generation/freshness command, historical
revision rejection and one-byte mutation tests. Arbitrary registration and current-handler fallback
are forbidden.

**User Decision:** `Authority: AI — delegated by --auto-design`; Option A selected, applied and verified.

### PF-008: Evidence freeze and publication selection precede code-changing reviews 🟠 MAJOR

**Dimension:** 11 Ordering & Sequencing
**Location:** `99-execution-plan.md`, tasks 5.2.6–5.3.2, 6.2.3–6.3.1 and 7.2.6–7.3.2
**Codebase Evidence:** `packages/readiness/src/implementation-revision.ts:1`; `packages/readiness/src/publication-resolver.ts:445`

**The Problem:** Review fixes can invalidate already frozen local evidence, generated dependency
closures, semantic-review bytes or even an already selected child pointer. The resume rule does not
automatically reopen those earlier completed tasks.

**Recommendation:** Move every potentially code-changing review/fix before evidence freeze and
candidate generation. In final closeout: review/fix → full CI-safe verify → real ACME/VICE rerun →
closure generation → semantic acceptance → candidate resolution → atomic selection → non-mutating
post-selection source/resolution checks.

**User Decision:** `Authority: AI — delegated by --auto-design`; recommendation selected, applied and verified.

### PF-009: Durable VICE lease namespace and filesystem trust are unspecified 🟠 MAJOR

**Dimension:** 8 Security Blind Spots; 9 Edge Cases
**Location:** `03-06-vice-control-lease.md`, Durable lease record; `03-05-process-filesystem-safety.md`, Case workspace
**Codebase Evidence:** `packages/readiness/src/generation-lock.ts:34`

**The Problem:** A per-case lease is not crash-durable, a repository-local lease does not coordinate
other clones, and an unspecified shared path permits symlink/replacement or foreign-owner attacks.

**Recommendation:** Define a Linux host-wide, target-keyed, effective-UID-owned runtime directory:
canonical real directory, mode `0700`; lease files `0600`; no symlink/hardlink/special components;
retained device/inode/UID identity; bounded no-follow reads/writes; atomic replacement and directory
sync. Fail closed when trust cannot be proven. Repository-local locking was rejected because it
does not satisfy host-wide exclusivity.

**User Decision:** `Authority: AI — delegated by --auto-design`; recommendation selected, applied and verified.

### PF-010: Spawn-before-child-record recovery cannot identify the child 🟠 MAJOR

**Dimension:** 6 Feasibility Concerns; 8 Security Blind Spots; 9 Edge Cases
**Location:** `03-06-vice-control-lease.md`, Durable lease record; `07-testing-strategy.md`, ST-37–ST-39
**Codebase Evidence:** `packages/test-harness/src/emulator/vice/vice-driver.ts:120`

**The Problem:** If the owner dies after spawn but before persisting PID/start ticks, a token file
exists but identifies no process. PID/start revalidation works only after a PID was recorded, so the
claimed closed crash window is not implementable as written.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Bounded `/proc` discovery requiring an exact argv element, executable identity, UID/boot/session/start/PGID proof and exactly one stable match before promotion | Fits Linux scope; recoverable without PID guessing | `/proc` parsing and race proof are complex |
| B | Use a small dedicated launcher that durably publishes child identity before exec and remains positively recoverable | Narrows the critical window and protocol | Adds another executable/protocol and still needs launcher crash recovery |

**Recommendation:** Option B as a same-PID record-then-exec launcher. It durably records its own
PID/start/PGID and generation/token before replacing itself with VICE, so VICE cannot exist without
a recorded identity. Feature-gate `process.execve` (present in the audited Node 22.23.1 runtime) and
report VICE unavailable when the pinned runtime cannot provide it. Add real crashes before record,
after record and after exec. Command-substring or PID-only discovery remains forbidden.

**User Decision:** `Authority: AI — delegated by --auto-design`; Option B selected, applied and verified.

### PF-011: Route deadline reserves no time for mandatory cleanup 🟠 MAJOR

**Dimension:** 6 Feasibility Concerns; 9 Edge Cases
**Location:** `03-05-process-filesystem-safety.md`, Deadlines and counters; `99-execution-plan.md`, tasks 3.2.5 and 3.2.7
**Codebase Evidence:** `packages/test-harness/src/emulator/vice/vice-driver.ts:242`

**The Problem:** If work runs until the hard route deadline, graceful/forced cleanup necessarily
runs after a deadline that supposedly includes cleanup. A selected limit can also be smaller than
the configured grace.

**Recommendation:** Set a work/cancellation deadline at `hardRouteDeadline - cleanupGrace`, reject
child-capable limits that cannot contain the fixed grace, and reserve the interval for cleanup.
Unproven safe termination at the hard deadline retains the lease and blocks authority.

**User Decision:** `Authority: AI — delegated by --auto-design`; recommendation selected, applied and verified.

### PF-012: Combined stdout/stderr ordering cannot be deterministic over separate pipes 🟠 MAJOR

**Dimension:** 4 Completeness Gaps; 6 Feasibility Concerns; 13 Codebase Alignment
**Location:** `03-05-process-filesystem-safety.md`, Streaming evidence; `07-testing-strategy.md`, ST-29
**Codebase Evidence:** `packages/compiler/src/acme/invoke-acme.ts:158`; Node child-process contract (stdout/stderr are separate pipes)

**The Problem:** Hashing callback arrival across separate stdout/stderr streams makes evidence
scheduler-dependent. The plan promises deterministic stream order but defines no single ordered
transport.

**Recommendation:** Partition the aggregate cap into deterministic per-stream retention quotas,
retain independent head/tail/count/hash/truncation records, and serialize them in fixed `stdout`,
`stderr` order. Do not hash cross-stream callback arrival. Optional arrival telemetry must be
non-authoritative. Treating observed callback order as authoritative was rejected because it is not
reproducible.

**User Decision:** `Authority: AI — delegated by --auto-design`; recommendation selected, applied and verified.

### PF-013: Local execution command, report and durable evidence sink are undefined 🟠 MAJOR

**Dimension:** 4 Completeness Gaps; 7 Testability
**Location:** `03-07-orchestration-acceptance.md`, Publication acceptance; `99-execution-plan.md`, tasks 5.2.6 and 7.2.3
**Codebase Evidence:** `package.json:18`; `packages/readiness/src/cli.ts:459`

**The Problem:** The plan promises a reproducible local authority proof but gives no command
grammar, inputs/defaults, exit taxonomy, output destination, atomic-write behavior, report schema or
link from retained report bytes to semantic review.

**Recommendation:** Specify the exact root script/CLI grammar, safe defaults, exit codes,
stdout/stderr contract, canonical bounded report schema, atomic durable output/overwrite rules and
the digest handoff to semantic review. Test invalid usage, unavailable tools, semantic failure,
atomic-write faults, deterministic reruns and absence of machine-specific temporary paths.

**User Decision:** `Authority: AI — delegated by --auto-design`; recommendation selected, applied and verified.

### PF-014: Ambiguous lease recovery has no safe operator workflow 🟠 MAJOR

**Dimension:** 4 Completeness Gaps; 7 Testability; 9 Edge Cases
**Location:** `03-06-vice-control-lease.md`, Durable lease record; `07-testing-strategy.md`, ST-38–ST-41
**Codebase Evidence:** no existing guarded recovery command; `packages/readiness/src/cli.ts:459`

**The Problem:** Fail-closed ambiguity can permanently block VICE, but the plan offers only bounded
manual-action text. A developer may delete the lease or kill a PID—the unsafe operations the design
forbids.

**Recommendation:** Define bounded `ManualLeaseRecoveryV1` evidence, a read-only inspection command
and a separately guarded exact-generation clear operation after positive confirmation that the
child is absent. Never instruct raw file deletion or PID-only signaling. Test changed/stale records,
restricted hosts, bounded output and no unrelated signal.

**User Decision:** `Authority: AI — delegated by --auto-design`; recommendation selected, applied and verified.

### PF-015: Stable result-code spellings conflict 🟡 MINOR

**Dimension:** 12 Consistency
**Location:** `03-01-execution-contracts-routing.md`, Failure behavior; `03-04-toolchain-adapters.md`, ACME integration; `03-06-vice-control-lease.md`, Durable lease record
**Codebase Evidence:** not applicable; the contradiction is plan-local.

**The Problem:** Public codes alternate between `tier-unavailable` and
`execution.tier.unavailable`, and between `emulator-lease-recovery-blocked` and
`execution.lease.recovery-blocked`, with no normalization layer.

**Recommendation:** Add one canonical result-code table and use RD-04's exact public literals. If
adapter-internal subcodes remain useful, define their separate field and normalization explicitly.

**User Decision:** `Authority: AI — delegated by --auto-design`; recommendation selected, applied and verified.

### PF-016: Absolute VICE stopwatch accounting is undefined across retries 🟡 MINOR

**Dimension:** 9 Edge Cases
**Location:** `03-05-process-filesystem-safety.md`, Deadlines and counters; `03-06-vice-control-lease.md`, Runtime loop; `07-testing-strategy.md`, ST-32
**Codebase Evidence:** `packages/test-harness/src/emulator/vice/text-monitor.ts:112`

**The Problem:** VICE returns an absolute machine-cycle count that includes boot/autostart cycles
and resets with a new child. The plan requires route-cumulative cycles but does not define baselines
and deltas.

**Recommendation:** Sample a stopped-machine baseline per child after fixture/entry setup, compute
monotonic deltas, and add them to a route total retained across retries. Counter decrease, missing
sample or child-identity change fails closed. Test restart and exact-bound cases.

**User Decision:** `Authority: AI — delegated by --auto-design`; recommendation selected, applied and verified.

### PF-017: Historical child reselection has no guarded operational surface 🟡 MINOR

**Dimension:** 7 Testability; 9 Edge Cases
**Location:** `03-03-execution-publication.md`, Compatibility and recovery; `99-execution-plan.md`, Phases 6–7
**Codebase Evidence:** `packages/readiness/src/cli.ts:459`

**The Problem:** The plan guarantees old→new→old child reselection but defines only candidate
publication and one final selection. The claim otherwise requires raw pointer editing or
republishing current code.

**Recommendation:** Add guarded inspect/select-by-digest operations that fully revalidate immutable
child bytes, exact parent and accepted review before atomic pointer replacement. Test old→new→old
and reconciliation faults; never document manual pointer editing.

**User Decision:** `Authority: AI — delegated by --auto-design`; recommendation selected, applied and verified.

## Corrective Iteration Findings

| IDs | Iteration | Severity | Deduplicated root causes | Resolution |
|---|---:|---|---|---|
| PF-018–PF-027 | 2 | 9 major, 1 minor | Composite opacity; aggregate output arbitration; Phase 6 spec ownership; missing adapter contracts; incomplete fixture/handler identity; missing callable parser/reducer; missing launch-attempt budget; untrusted envelope construction; forgeable lease handle; `pass` admitted as an operation issue | Challenger-converged remedies applied |
| PF-028–PF-033 | 3 | 5 major, 1 minor | Future composite required by Phase 1; opaque case unreadable across package boundary; flood samples scheduler-dependent; reducer lacked a provisional pass base; parent-thread facade dependencies contradicted worker isolation; composite forgery lacked immutable coverage | Remedies applied |
| PF-034–PF-036 | 4 | 2 major, 1 minor | Provisional base omitted pass stage; specs did not pin all four worker mappings; detached mutable bytes were overstated as deeply immutable | Remedies applied |

Iteration 5 independently rechecked only PF-034–PF-036 and returned no findings. Earlier corrective
surfaces were frozen between scans, and each subsequent iteration was bounded to the prior fixes
plus their direct dependency surfaces. The final plan contains 88 tasks and ST-01–ST-62.

## Auto-Design Resolution Provenance

All 17 rulings share: **Authority:** AI — delegated by `--auto-design`; **Eligibility:** internal
architecture, algorithms, security mechanisms, recovery, test design and sequencing within the
approved RD-04 scope; **Objective:** make the approved six-route execution evidence deterministic,
safe, content-derived and implementable without weakening historical compatibility; **Policy
version:** 1; **Root invocation ID:** `preflight-rd04-20260822-01`.

Evidence and rejected alternatives are recorded in each finding. The strongest general
counterargument is that these amendments increase plan size and Phase 4–7 implementation work; the
counterargument does not outweigh correctness because the omitted details sit on immutable spec,
process-signal, budget and publication-authority boundaries. **Confidence:** High except Medium for
PF-001 until live STORE-watchpoint timing is proven and PF-010 until the launcher protocol is
crash-tested on the supported Node/Linux baseline. **Hardening:** one independent batch challenger
accepted every major finding, converged on 12 recommendations and changed PF-001 and PF-010 as
recorded below. **Reopen triggers:** a new VICE monitor response exposes actual interrupted
instruction count; a supported positive child-identity primitive replaces the launcher; Node gains a documented ordered
combined output transport; or publication-v2 supplies an approved cross-package child-authority
protocol.

## Challenger Reconciliation

| Finding | Verdict | Confidence | Hardening result |
|---|---|---:|---|
| PF-001 | Valid; STORE watchpoint | 0.94 | Diverged from EXEC-label option; challenger option adopted with mandatory live timing proof |
| PF-002 | Valid; first failure plus mandatory cleanup blocker | 0.96 | Converged |
| PF-003 | Valid; distinct identity-bound output projection | 0.95 | Converged; share one register-behavior table to prevent drift |
| PF-004 | Valid; exact spec-visible TypeScript signatures | 0.99 | Converged |
| PF-005 | Valid; split specs by package ownership | 0.99 | Converged; require one execution-side seam integration spec |
| PF-006 | Valid; exact path-family boundary | 0.99 | Converged; complete-source checks must cover both owning packages |
| PF-007 | Valid; readiness passive, readiness-execution live catalog | 0.93 | Converged |
| PF-008 | Valid; reviews before freeze and selection | 1.00 | Converged |
| PF-009 | Valid; host-wide per-UID lease root | 0.97 | Converged |
| PF-010 | Valid; same-PID record-then-exec launcher | 0.82 | Diverged from `/proc` discovery; launcher adopted with runtime feature gate |
| PF-011 | Valid; reserve cleanup grace | 0.98 | Converged |
| PF-012 | Valid; deterministic per-stream evidence | 0.99 | Converged; added fixed per-stream quotas under the aggregate cap |
| PF-013 | Valid; exact command/report/sink contract | 0.98 | Converged |
| PF-014 | Valid; guarded manual recovery | 0.97 | Converged |

The challenger recommends an additional human review by Linux process-lifecycle/security expertise
for PF-009/PF-010/PF-014 and empirical VICE binary-monitor expertise for PF-001/PF-003.

## Verdict and Required Follow-up

**PASS.** All 36 encountered findings were remediated under delegated auto-design authority; the
final exact verification returned no findings at
`sha256:f2a40d6a65ee0d40e5637247ac1e44916357e3ec73c1cc3f44e9ebfe93b036c7`.
The implementation plan may advance to **Plan Preflighted** and execution may begin at Phase 1.

No source file, existing immutable specification, requirement or frozen `spec/` file was modified
by this audit. The optional human Linux process-lifecycle and VICE monitor review remains prudent
but is not a blocking gate because the implementation plan already requires empirical crash,
identity and STORE-watchpoint proof before publication authority can be selected.
