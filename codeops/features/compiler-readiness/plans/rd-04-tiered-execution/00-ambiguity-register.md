# Ambiguity Register: RD-04 Tiered Compiler, ACME and VICE Execution

> **Status**: ✅ GATE PASSED — all 37 items resolved; AR-P32–AR-P37 added during execution
> **Last Updated**: 2026-08-22
> **Mode**: Auto-design
> **Root Invocation ID**: `make-plan-rd04-20260821-01`
> **Policy Version**: 1

## Planning Scope Contract

| Boundary | Confirmed boundary |
|---|---|
| Planning target | `compiler-readiness/RD-04` exactly as approved after requirements preflight |
| Context artifacts | RD-01–RD-04 requirements and completed plans; selected readiness publications; readiness/compiler/CLI/test-harness source; repository instructions and quality policy |
| Modification set | This new RD-04 plan directory and roadmap lifecycle metadata only; requirements, source, tests, generated/reviewed readiness evidence and frozen `spec/` remain read-only during planning |
| Scope mode | Strict; RD-08 model/generator/oracle expansion and additional target emulators remain outside this plan |

## Register

| # | Category | Ambiguity / Gap | Options Presented | Resolution / Authority | Status |
|---|---|---|---|---|---|
| AR-P1 | Scope ambiguities | Does implementation preserve the preflighted RD-04 population and target boundary? | Implement only the selected modeled C64 population and retain RD-06 blockers / absorb RD-08 or other targets | Exact RD-04 scope; user-authorized preflight baseline | ✅ Resolved |
| AR-P2 | Technical unknowns | Where do toolchain-dependent execution adapters live while `@blend65/readiness` remains workspace-independent? | New `@blend65/readiness-execution` composition package / relax readiness boundary / host all adapters in test-harness | New private composition package; AI delegated by `--auto-design`; challenger converged | ✅ Resolved |
| AR-P3 | Integration points | How does the engine observe compiler diagnostic phase without changing ordinary diagnostics or inferring phase from an expected code? | Additive compiler evidence sidecar with phase-aware bag / add phase to public `Diagnostic` / post-hoc inference | Accepted-diagnostic phase sidecar plus CLI observer injection; AI delegated; challenger converged | ✅ Resolved |
| AR-P4 | Integration points | How is VICE control reused while adding lease fencing, process identity, cancellation and cumulative budgets? | Refactor a bounded VICE-control subpath from test-harness / duplicate a new driver / move all control into another new package | Additive `@blend65/test-harness/vice-control` subpath; AI delegated; challenger converged | ✅ Resolved |
| AR-P5 | Data & state | What is the child execution-publication authority and compatibility boundary? | Separate content-addressed child release selected atomically against one parent digest / mutate publication-v1 / ephemeral bindings | Separate reviewed child publication and opaque composite snapshot | ✅ Resolved |
| AR-P6 | Behavioral gaps | What deterministic algorithm selects expensive-tier cases across validity, spelling and boundary strata? | Digest-ranked round-robin strata / ordinal-first selection / outcome-triggered escalation | Revisioned digest-ranked stratified selector with fail-closed caps | ✅ Resolved |
| AR-P7 | Data & state | How are valid probes made executable and observed without embedding expectations or risking layout collisions? | Versioned generator-IR envelope with compiler-allocated observation globals and completion-last marker / fixed addresses / post-build binary patching | Separate envelope IR with compiler-allocated globals and post-build label proof; challenger converged | ✅ Resolved |
| AR-P8 | Edge cases | How is current C64 initial machine state established and made identical to the oracle fixture? | Closed `$D020..$D022` target projection with write/read preflight and host-side fixture / raw-RAM assumption / unverified emulator defaults | Closed fixture/projection revision; real-VICE proof gates authority | ✅ Resolved |
| AR-P9 | Behavioral gaps | Which closed execution result model and precedence governs simultaneous failures? | Stage-scoped discriminated result with declared pipeline order and instruction-before-cycle budget precedence / exceptions / free-form strings | Closed stage/result unions and first-terminal precedence | ✅ Resolved |
| AR-P10 | Security & compliance | How are filesystem/process/output boundaries enforced without unbounded allocation or shell exposure? | Canonical per-case root, argv-only child supervisor, streaming bounded evidence ledger and all-outcomes cleanup / reuse unbounded process helpers / shell wrapper | Isolated worker/process supervisor, bounded streaming evidence and all-outcomes cleanup | ✅ Resolved |
| AR-P11 | Edge cases | Which hosts may recover a stale VICE lease, and how is ambiguous identity handled? | Linux first with boot ID + `/proc/<pid>/stat` start time; other hosts unavailable until a positive identity provider exists / PID-only portability / best-effort kill | Linux positive identity provider; fail closed elsewhere; challenger converged | ✅ Resolved |
| AR-P12 | Naming & terminology | What stable package, artifact, type and file vocabulary will execution use? | `readiness-execution`, `execution-publication-v1`, `ExecutionRoutePlanV1`, `ExecutionResultV1`, focused kebab-case modules / extend overloaded campaign/publication names | Dedicated execution vocabulary and focused modules | ✅ Resolved |
| AR-P13 | Non-functional gaps | What verification tiers and coverage targets make the plan executable in CI and locally? | Per-component 90% branch target; CI-safe fake/process tiers plus mandatory local real ACME/VICE acceptance; exact repository verify / emulator-required CI / unit-only | 90% branch floors for readiness cores; CI-safe tiers plus mandatory local ACME/VICE proof | ✅ Resolved |
| AR-P14 | Technical unknowns | What exact command fills every execution-plan Verify line? | Repository-mandated frozen install + Turbo build/typecheck/lint + full test command / package-only shortcuts | Exact repository verify command from `AGENTS.md` | ✅ Resolved |
| AR-P15 | Integration points | Which serializable boundary makes deterministic planning testable without forging opaque authority? | Passive guarded projections / counterfeit opaque fixtures / adapter-coupled planner | Serializable passive planning projections; AI delegated during execution | ✅ Resolved |
| AR-P16 | Behavioral gaps | Which Phase 2 seams expose envelope and evidence behavior without inventing execution authority? | Focused pure validators / composite producer / execution callback | Focused phase-aligned validators; AI delegated; challenger converged | ✅ Resolved |
| AR-P17 | Data & state | How is completion-last preserved through lowering and assembly? | Genuine-case report-backed store proof / source-order trust / runtime inference | Live report-backed store-order layout proof; semantic review resolution | ✅ Resolved |
| AR-P18 | Integration points | Which closed construction, fault-injection and inspection seams let an implementation-blind oracle prove ST-23–ST-33 without counterfeit authority or production-detail guesses? | Production contract kernel plus spec-owned genuine fixtures / exported testkit / testing-only supervisor hooks | Production ports and strict parsers; immutable local fixtures own fakes/probes; challenger converged | ✅ Resolved |
| AR-P19 | Behavioral gaps | How does ST-24 prove ordinary compiler compatibility when two ordinary results contain fresh closure-bearing graph/source-map objects and are not deep-equal? | Exact stable public projection plus behavioral probes / generic function-stripping serialization / cross-call caching | Behavioral projection plus same-invocation evidence linkage; challenger converged | ✅ Resolved |
| AR-P20 | Data & state | Which genuine authority supplies exact invalid-case diagnostic expectations to frontend/compiler/CLI routes when `ExecutionCaseV1` is valid-only and `PublishedOracleContext` is opaque? | Additive joint campaign+oracle diagnostic capability / broaden executable case / caller-supplied expectation | Opaque `PublishedDiagnosticCaseV1` plus closed valid/invalid request union; challenger converged | ✅ Resolved |
| AR-P21 | Data & state | How does the selected parent publication authenticate the new published-diagnostic authority source after its implementation digest becomes stale? | Deterministically refresh the existing implementation-authority source closure / bypass freshness / omit the new authority source / select a new release | Refresh only the content-bound implementation-authority metadata; preserve the selected release pointer and semantics | ✅ Resolved |
| AR-P22 | Behavioral gaps | How can the immutable diagnostic fixture request an `invalid-source-transform` when its genuine campaign enables only parameter spelling? | Add a source spelling to the fixture campaign / change generator semantics / weaken authority expectations | Correct the spec-owned genuine campaign configuration; keep production generation and expectations unchanged | ✅ Resolved |
| AR-P23 | Data & state | Must diagnostic authority require exact campaign/case identity across caller and selected replay when their freshness-proven handler participants differ? | Exact selected identity / semantic case-content join across separately authenticated authorities | Versioned cross-authority case-equivalence join with dual provenance and a closed ambient-compatibility tuple; challenger converged | ✅ Resolved |
| AR-P24 | Integration points | How can immutable tests mutate join fields that genuine campaign construction fixes and never exposes? | Test mutable axes through genuine authorities and fixed axes at their owning constructors / export a forging seam / use structural copies | Layered genuine construction-gate coverage; no test-only authority seam | ✅ Resolved |
| AR-P25 | Behavioral gaps | Why do all new diagnostic-equivalence scenarios stop while constructing the fixture's ambient-mismatch campaign? | Diagnose/correct genuine fixture input / change production join / weaken scenarios | Route fixed rule-model fields to preparation rejection and handler contracts to freshness registration; genuine join cases now reach production | ✅ Resolved |
| AR-P26 | Data & state | Why does the selected replay expose a stripped inventory content digest as campaign `specRevision` while genuine campaigns use semantic `spec-v3.0`? | Map authenticated selected inventory to the frozen semantic revision / alias in join / retain stripped digest | Fix the published-context projection to semantic `spec-v3.0`; keep content digest separate and join equality exact | ✅ Resolved |
| AR-P27 | Data & state | Which inventory bytes must the genuine diagnostic fixture use when workspace inventory and selected-release member digests differ? | Selected release member / workspace bytes / relax digest equality / select another release | Build the fixture campaign from the authenticated selected-release inventory member; preserve selection and exact join equality | ✅ Resolved |
| AR-P28 | Data & state | Does the selected oracle publication own one campaign seed/configuration, or replay each authenticated caller campaign's inputs? | Caller-authenticated replay inputs / add selected fixed seed and configuration / weaken identity binding | Seed and normalized configuration are caller-campaign replay inputs with exact echo and identity binding; challenger converged | ✅ Resolved |
| AR-P29 | Security & compliance | How can Phase 3 terminate a descendant process group without a validate-to-signal PGID-reuse race? | Persistent in-group ownership anchor / pidfd group signal / delegated cgroup / parent negative-PGID signal | Trusted detached Node anchor self-signals its pinned group over authenticated IPC; parent never sends a negative-PGID signal; challenger converged | ✅ Resolved |
| AR-P30 | Integration points | Which production-shaped seam lets an implementation-blind spec prove the real anchor protocol without exporting debug authority? | Raw host/transport ports around the real parent and anchor kernels / fake abstract handle / debug snapshots | Export one runtime factory plus the real anchor runner over bounded raw OS/transport ports; no parent signal port or parsed-message injection | ✅ Resolved |
| AR-P31 | Integration points | How does the anchor learn the parent nonce before emitting authenticated `anchor-ready`? | Raw bootstrap frame / spawn environment or argv / hidden transport state | Parent sequence-zero bootstrap frame carries the nonce; anchor adopts it before sequence-zero ready; launch is parent sequence one | ✅ Resolved |
| AR-P32 | Integration points (runtime) | Which exact observable kernel and protocol semantics let immutable Phase 4 tests prove low-level VICE control without guessing or injecting parsed outcomes? | Raw production host/runtime factory plus default-adapter smoke / black-box fake VICE executable / pure codec-planner exports plus smaller integration | Versioned raw host/runtime factory, named endpoints, exact one-child-attempt handshake/cancellation/copy semantics and split low-level/route retry ownership; AI delegated by `--auto-design`; challenger converged | ✅ Resolved |
| AR-P33 | Integration points (runtime) | Which production boundary lets immutable Phase 4 tests prove lease, identity, retry and budget policy without unsafe real-host mutation or test-only authority? | Public lease-runtime factory over a narrow domain host / package-private factory / black-box subprocess matrix | Versioned public runtime factory over raw lease/process/endpoint facts and constrained record-then-exec/termination operations; global facade delegates one singleton; AI delegated by `--auto-design`; challenger converged | ✅ Resolved |
| AR-P34 | Behavioral gaps (runtime) | How is the frozen low-level oracle corrected when its default `Uint8Array` parameter infers an `ArrayBuffer` backing narrower than the raw handshake helper's `ArrayBufferLike` bytes? | Add the declared `Uint8Array` parameter annotation / weaken package typechecking / alter runtime bytes | Add the semantics-neutral helper annotation, preserve every assertion, rerun GREEN and freeze the replacement hash; AI delegated by `--auto-design` | ✅ Resolved |
| AR-P35 | Behavioral gaps (runtime) | How can the immutable lease oracle prove a replaced inode when its first snapshot originally named the new inode as both observed and expected? | Retain the prior inode in the snapshot reference / invent a fixed inode relation / reject every first observation | Correct the mutant so the retained reference names the prior inode while the observed file names the replacement; AI delegated by `--auto-design` | ✅ Resolved |
| AR-P36 | Security & compliance (runtime) | Does POSIX directory `st_nlink` need to equal one like the regular lease file's link count? | Retain positive raw directory count but exclude its exact value from identity / ignore it / normalize it / require one | Positive safe-integer raw directory count; exact count non-authoritative; regular lease file remains exactly one link; AI delegated by `--auto-design`; challenger converged | ✅ Resolved |
| AR-P37 | Behavioral gaps (runtime) | How can the route oracle model an exact checkpoint hit after quality review requires execution to settle only after VICE also reports STOPPED? | Emit the matching STOPPED event while preserving adversarial response order / settle on checkpoint alone / weaken completion cases | Correct the raw fake to emit checkpoint metadata, correlated acknowledgement, then STOPPED; production waits for both; AI delegated by `--auto-design` | ✅ Resolved |

## Resolution Notes

### AR-P1 — Scope and modification boundary

**Authority:** User — explicit request to plan the preflighted `compiler-readiness/RD-04`.<br>
**Decision:** Implement the nine selected modeled rules and their declared routes for C64 only.
Retain every RD-06 blocker and RD-08's ownership of the remaining population; do not edit the RD or
frozen specification during planning.<br>
**Evidence:** RD-04's overview and Won't Have section; passing PF-001/PF-002; feature roadmap.<br>
**Rejected alternative:** absorbing RD-08 or additional emulators would expand product scope.<br>
**Reopen trigger:** the user explicitly expands scope or the selected parent publication changes
before execution starts.

### AR-P2 — Composition package

**Authority:** AI — delegated by `--auto-design`.<br>
**Eligibility:** Internal package architecture inside the approved execution feature.<br>
**Objective:** Add real toolchain adapters without weakening independent readiness authority.<br>
**Decision:** Add private `@blend65/readiness-execution`, depending on the pure readiness API and
the actual frontend/compiler/CLI/test-harness packages. `@blend65/readiness` keeps its existing
workspace-import prohibition.<br>
**Evidence:** `packages/readiness/package.json` has only validation dependencies;
`dependency-boundary.impl.test.ts` rejects every workspace import; the root discovers
`packages/*` automatically.<br>
**Rejected alternatives:** direct readiness imports break a load-bearing gate; putting all
orchestration in test-harness assigns publication/compiler ownership to a testing toolkit; a root
script lacks a versioned implementation boundary.<br>
**Strongest counterargument:** another workspace adds build ordering and a second API seam.<br>
**Confidence:** High — changes only if new private workspaces become prohibited.<br>
**Hardening:** Independent challenger converged on this option.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `make-plan-rd04-20260821-01`.<br>
**Reopen triggers:** a cycle appears in the concrete workspace graph, or the boundary test is
explicitly superseded by a later approved architecture.

### AR-P3 — Direct diagnostic phase provenance

**Authority:** AI — delegated by `--auto-design`.<br>
**Eligibility:** Additive compiler/CLI instrumentation mechanism; no diagnostic behavior changes.<br>
**Objective:** Observe the exact accepted diagnostic code, phase and final severity in the same
route invocation while preserving ordinary public output.<br>
**Decision:** Add an accepted-diagnostic observer to the diagnostic-bag construction used by the
compiler, set the active phase at real lexer/parser/semantic boundaries, and expose a separate
`CompilerDiagnosticEvidenceV1` sidecar. Carry sidecar entries through deduplication, max-error and
severity-policy transformations. Add an optional compiler-facade/observer injection to `runCli`
so its existing exit/rendered-output contract and the same invocation's sidecar are both observed.
Do not add phase to `Diagnostic` or renderer JSON.<br>
**Evidence:** `Diagnostic` and `CompileResult` omit phase; `runFrontend` has explicit stage calls
over one bag; the bag deduplicates/caps; JSON mirrors the current record.<br>
**Rejected alternatives:** public `Diagnostic.phase` is a compatibility change and optional phase
permits missing evidence; code/manifest inference violates RD-04.<br>
**Strongest counterargument:** a sidecar can drift from sorted or severity-adjusted diagnostics.<br>
**Confidence:** High — the accepted-entry hook and final-policy join make the association testable.<br>
**Hardening:** Independent challenger converged and required recording only accepted diagnostics.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `make-plan-rd04-20260821-01`.<br>
**Reopen triggers:** phase becomes an approved general public compiler contract, or severity policy
cannot retain a one-to-one accepted-entry identity.

### AR-P4 — Reusable bounded VICE control

**Authority:** AI — delegated by `--auto-design`.<br>
**Eligibility:** Internal emulator-control architecture inside the approved C64/VICE route.<br>
**Objective:** Reuse live-verified monitor codecs while adding lifecycle control required by RD-04.<br>
**Decision:** Factor an additive `@blend65/test-harness/vice-control` subpath. It owns the binary
and text monitor transports, cancellable pending commands, target/version handshake and a launch
surface with before-spawn/after-spawn/pre-signal hooks. Existing `ViceDriver` becomes a compatibility
wrapper; readiness-execution supplies the lease, identity, deadlines and evidence sinks.<br>
**Evidence:** current `ViceDriver` owns both protocols but directly spawns with discarded output,
fixed retries and no cancellation hooks.<br>
**Rejected alternatives:** duplicate control code would diverge from live-verified framing; a
generic emulator package is premature in C64-only scope. A focused `@blend65/vice-control` package
is viable but adds a second new workspace without current independent-release need.<br>
**Strongest counterargument:** security-sensitive process control under a test-harness package has
ownership baggage.<br>
**Confidence:** High — the explicit subpath separates the low-level API from the stable root barrel.<br>
**Hardening:** Independent challenger converged and added the focused-package reopen option.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `make-plan-rd04-20260821-01`.<br>
**Reopen triggers:** another production consumer requires independent release/versioning, or a
second emulator proves the control contract is genuinely cross-platform.

### AR-P5 — Child execution publication

**Authority:** AI — delegated by `--auto-design`.<br>
**Eligibility:** Compatible persistence/publication mechanism within the approved authority model.<br>
**Objective:** Bind all six routes atomically without changing historical parent bytes.<br>
**Decision:** Add `readiness/execution-publications/` with a selected pointer and immutable
digest-named releases. Each release contains a closed six-row binding member, exact parent
publication digest, manifest and accepted semantic-review evidence. Resolution revalidates review,
parent digest, declarations and content-derived implementations before creating opaque
`PublishedExecutionRelease`; readiness-execution separately creates a branded
`LiveExecutionContextV1` after fixed-catalog freshness proof, and a composite resolver projects exactly accepted parent `unbound`
capabilities as bound. Pointer replacement uses existing hardened publication primitives and
reconciliation semantics.<br>
**Evidence:** existing publication-v1 is immutable and its filesystem/resolver already implements
pinned directories, bounded reads, review reconstruction and atomic pointer handling.<br>
**Rejected alternatives:** mutating publication-v1 breaks historical bytes; ephemeral bindings
cannot be independently selected or reviewed.<br>
**Strongest counterargument:** parent and child pointers can select an incompatible pair.<br>
**Confidence:** High — the child stores and resolves one exact parent digest rather than trusting
the mutable parent pointer.<br>
**Hardening:** Forced compatibility and crash-recovery reframing did not change the choice.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `make-plan-rd04-20260821-01`.<br>
**Reopen triggers:** publication-v2 gains an approved general child/member mechanism, or required
parent bytes become unavailable.

### AR-P6 — Deterministic stratified selector

**Authority:** AI — delegated by `--auto-design`.<br>
**Eligibility:** Internal deterministic algorithm and resource policy.<br>
**Objective:** Cover every obligation without outcome-triggered escalation or unbounded VICE work.<br>
**Decision:** Selector revision `execution-selector-v1` assigns every case its cheapest declared
terminal tier, then groups valid candidates by rule, obligation, validity, spelling tuple and
boundary family. It ranks each candidate by a domain-separated digest over parent/campaign/case,
selector revision and obligation, takes one per non-empty stratum in lexical round-robin order,
and guarantees at least one valid VICE case per modeled mandatory-C64 runtime rule. V1 caps are 16
selected cases per rule/expensive obligation and 256 expensive selections per campaign. If required
minima cannot fit, planning fails `execution-plan-capacity`; it never truncates an obligation.
**Evidence:** campaign items already expose stable lane/path/case identities; RD-04 requires
pre-execution, stratified, revision-bound selection.<br>
**Rejected alternatives:** ordinal-first selection biases generation order; failure-triggered
escalation violates the requirement and repeatability.<br>
**Strongest counterargument:** digest ranking is less human-readable than choosing the first case.<br>
**Confidence:** High — complete selected-case records make the result auditable.<br>
**Hardening:** 10×-population reframing added explicit fail-closed campaign capacity.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `make-plan-rd04-20260821-01`.<br>
**Reopen triggers:** RD-08's accepted population cannot satisfy minima within v1 caps, requiring a
new selector revision rather than an in-place limit change.

### AR-P7 — Envelope, observation and two-stage identity

**Authority:** AI — delegated by `--auto-design`.<br>
**Eligibility:** Internal compiler-evidence representation and allocation mechanism.<br>
**Objective:** Execute probes and publish actual results without embedding oracle truth or reserving
unsafe absolute RAM.<br>
**Decision:** A separate `ExecutionEnvelopeIrV1` wraps only valid RD-02 source. It adds complete
literal arguments, compiler-allocated ordinary-RAM globals for actual bytes and a distinct
completion byte initialized non-success, plus `main(): void` that stores actual observations before
writing `$A5` completion last. Void memory-write cases declare direct MMIO observation instead.
Envelope-source identity is derived before compilation; final execution identity adds authoritative
label/report addresses and collision proof after assembly. The source-case identity never changes.
**Evidence:** RD-02 `GenModule` intentionally has constants/functions only; compiler SFA allocates
module variables and `BuildResult` exposes the label map.<br>
**Rejected alternatives:** fixed addresses can collide; binary patching destroys source/assembly
provenance. Direct register observation remains only the requirement's narrow semantic exception.<br>
**Strongest counterargument:** envelope globals perturb allocation and make identity two-stage.<br>
**Confidence:** High — the perturbation is itself identity-bound and checked in final layout.<br>
**Hardening:** Independent challenger converged.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `make-plan-rd04-20260821-01`.<br>
**Reopen triggers:** compiler labels cannot identify envelope globals exactly, or a selected rule's
observable cannot be projected without semantic change.

### AR-P8 — C64 initial-state projection

**Authority:** AI — delegated by `--auto-design`.<br>
**Eligibility:** Target-specific fixture mechanism fixed by the approved C64 behavior.<br>
**Objective:** Feed emulator and independent oracle identical authoritative initial state.<br>
**Decision:** `c64-vic-color-readback-v1` owns `$D020..$D022`: write each fixture byte's low nibble,
require readback `0xF0 | lowNibble`, and compute word reads from projected adjacent bytes in
little-endian order. The same host fixture is passed to RD-03 evaluation. Unsupported cells or a
pre-entry mismatch return non-passing results. The revision remains non-authoritative until local
real-VICE tests cover all three registers and direct/computed word starts.<br>
**Evidence:** generated memory cases start at `$D020` or `$D021`; `peekw($D021)` touches `$D022`;
RD-03 fails on absent cells.<br>
**Rejected alternatives:** ordinary-RAM semantics and emulator defaults are not authoritative.<br>
**Strongest counterargument:** this is a narrow hardware fact rather than a general MMIO model.<br>
**Confidence:** High for current scope; unknown cells deliberately remain unmodeled.<br>
**Hardening:** Requirements preflight's late challenger established the third cell and real-VICE gate.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `make-plan-rd04-20260821-01`.<br>
**Reopen triggers:** VICE contradicts the projection, or RD-08 introduces a touched cell outside
the reviewed set.

### AR-P9 — Closed result state machine

**Authority:** AI — delegated by `--auto-design`.<br>
**Eligibility:** Internal error/result representation.<br>
**Objective:** Produce stable repeatable primary outcomes under multi-symptom failures.<br>
**Decision:** `ExecutionResultV1` is a closed pass/failure union carrying terminal tier, stage,
stable code, cumulative usage and bounded evidence. Stages are input → capability → frontend →
compiler-api/CLI → emit → ACME → VICE launch → handshake → fixture → run → observe →
compare → cleanup. The first terminal stage wins. Within one VICE checkpoint, instruction
exhaustion precedes cycle exhaustion while recording both; a fired wall watchdog is terminal before
route return. Missing tools are `tier-unavailable`, not launch failures. Public results use only
the canonical RD-compatible literals in `03-01`; adapter detail stays in `adapterSubcode`.<br>
**Evidence:** RD-04 enumerates required categories and precedence.<br>
**Rejected alternatives:** exceptions/free-form strings are not closed or replay-stable.<br>
**Strongest counterargument:** a large union adds maintenance overhead when stages evolve.<br>
**Confidence:** High — compatible additions require a new policy/contract revision.<br>
**Hardening:** Forced evolution review added explicit stage-versioning and cumulative usage.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `make-plan-rd04-20260821-01`.<br>
**Reopen triggers:** a new terminal tier or failure category is approved.

### AR-P10 — Filesystem, worker and process safety

**Authority:** AI — delegated by `--auto-design`.<br>
**Eligibility:** Security, recovery and resource implementation inside approved limits.<br>
**Objective:** Enforce real wall/output/evidence limits and eliminate path/shell/process leaks.<br>
**Decision:** Every case gets a canonical mode-0700 root with handle/identity checks. Relative
lexical regular-file inputs only; reject absolute, traversal, symlink and special-file inputs.
Compiler/CLI/emit work runs in cancellable worker threads so synchronous CPU work is interruptible.
ACME/VICE use argv arrays and owned process groups. One streaming collector drains stdout/stderr
after retention, keeps deterministic head/tail/count/hash metadata, and charges every retained byte
to a lazy 16 MiB evidence ledger. A route-wide deadline/cancellation scope owns workers, children,
monitors, checkpoints, lease and cleanup.<br>
**Evidence:** current ACME `execFile` and VICE spawn do not enforce RD-04 cumulative output/deadline
rules; readiness publication I/O already demonstrates pinned-path patterns.<br>
**Rejected alternatives:** reusing unbounded helpers cannot enforce hard maxima; shell wrappers add
injection and process-tree ambiguity.<br>
**Strongest counterargument:** worker/process isolation adds protocol and cleanup complexity.<br>
**Confidence:** High — the complexity is required for enforceable synchronous timeouts.<br>
**Hardening:** 10×-budget and crash reframing added lazy allocation and one top-level owner.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `make-plan-rd04-20260821-01`.<br>
**Reopen triggers:** Node workers cannot isolate a route operation, or supported-host process-group
termination cannot be positively proven.

### AR-P11 — Supported-host process identity

**Authority:** AI — delegated by `--auto-design`.<br>
**Eligibility:** Fail-closed host safety mechanism; no existing VICE readiness support is removed.<br>
**Objective:** Recover ordinary crashes without ever signaling a PID-reused unrelated process.<br>
**Decision:** V1 supports Linux only through an injectable identity provider reading the boot ID
and `/proc/<pid>/stat` start time, defensively parsing parenthesized command names. Lease metadata
also binds nonce, generation, exact launch-token path and endpoints. Owner/child identity is checked
at observation and immediately before every signal. Restricted Linux, macOS and Windows return
`tier-unavailable` until an equivalent positive provider exists. Ambiguity retains the lease and
returns `emulator-lease-recovery-blocked` with bounded manual recovery data.<br>
**Evidence:** PID-only locking exists but is insufficient; RD-04 and PF-007 explicitly require boot,
start and launch-token proof.<br>
**Rejected alternatives:** PID-only is unsafe; never reclaiming contradicts crash recovery.<br>
**Strongest counterargument:** VICE may be installed on a host that v1 cannot support.<br>
**Confidence:** High — broader host support requires new positive providers, not weaker proof.<br>
**Hardening:** Independent challenger converged and required restricted-container failure coverage.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `make-plan-rd04-20260821-01`.<br>
**Reopen triggers:** user requires another host, or Linux identity sources are unavailable in the
actual acceptance environment.

### AR-P12 — Stable vocabulary and public seams

**Authority:** AI — delegated by `--auto-design`.<br>
**Eligibility:** Naming and internal API design.<br>
**Objective:** Keep RD-04 concepts distinct from RD-02 campaigns and parent publications.<br>
**Decision:** Use package `@blend65/readiness-execution`; artifact root
`readiness/execution-publications`; core types `ExecutionRoutePlanV1`, `ExecutionEnvelopeIrV1`,
`ExecutionBudgetV1`, `ExecutionResultV1`, `PublishedExecutionRelease`, `LiveExecutionContextV1` and
`CompositeReadinessSnapshot`; focused kebab-case `execution-*` modules. Only passive contracts and
opaque capabilities export from readiness; real adapters export from the composition package;
low-level monitor control exports only from test-harness's `./vice-control` subpath.<br>
**Evidence:** existing RD-02/RD-03 modules already use versioned passive models and opaque state.<br>
**Rejected alternative:** overloading `CampaignPlan` or `PublishedSnapshot` would obscure separate
identity and authority boundaries.<br>
**Strongest counterargument:** long execution-prefixed names are verbose.<br>
**Confidence:** High — precision outweighs local verbosity in an evidence system.<br>
**Hardening:** Contrarian naming review found no shorter vocabulary preserving all boundaries.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `make-plan-rd04-20260821-01`.<br>
**Reopen triggers:** an existing exported name acquires the same semantics before implementation.

### AR-P13 — Test and acceptance tiers

**Authority:** AI — delegated by `--auto-design`.<br>
**Eligibility:** Testing strategy within fixed acceptance criteria.<br>
**Objective:** Keep CI deterministic while proving the real hardware-facing route locally.<br>
**Decision:** Immutable specification suites precede every phase; implementation suites cover
internals/fault injection. Keep `@blend65/readiness` and new `@blend65/readiness-execution` at or
above 90% branch coverage. CI runs fake worker/process/monitor, real compiler/CLI, ACME when present,
publication and crash-state simulations; it must report missing VICE as unavailable, never skip
campaign semantics. Final local acceptance on Linux runs real ACME and VICE 3.10, proves the MMIO
projection and at least one selected case for each of the four modeled runtime rules. Existing
test-harness/compiler/CLI regressions and root R15 boundary tests remain green.<br>
**Evidence:** CI has ACME but no VICE; current VICE codec has real-3.10 evidence; prior readiness
plans enforce 90% branches.<br>
**Rejected alternatives:** emulator-required CI is unavailable; unit-only cannot authorize target
semantics.<br>
**Strongest counterargument:** local-only evidence is easier to miss in routine CI.<br>
**Confidence:** High — publication cannot complete until the explicit local proof is recorded.<br>
**Hardening:** Pre-emptive challenge added publication gating rather than relying on a skipped test.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `make-plan-rd04-20260821-01`.<br>
**Reopen triggers:** CI gains a trustworthy VICE tier or the required local tool version changes.

### AR-P14 — Verification command

**Authority:** User-supplied repository policy and `--auto-commit` request.<br>
**Decision:** Every phase Verify line uses
`yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`.
Focused suites, coverage, Prettier checks, publication resolution, local ACME/VICE acceptance and
`git status --porcelain spec/` are additional gates, never replacements. Commit coherent green
checkpoints without asking and never push.<br>
**Rejected alternative:** package-only shortcuts cannot establish repository-wide compatibility.<br>
**Reopen trigger:** `AGENTS.md` or root manifests change the authoritative verify command.

### AR-P15 — Serializable pure-planning boundary

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal API correction required to make an already-approved pure selector
specifiable and implementable; no product scope or authority policy changes.<br>
**Objective:** Let immutable tests prove fresh-process determinism without forging opaque campaign
or oracle capabilities, while giving the selector all rule/obligation/case strata it needs.<br>
**Decision:** `planExecutionRoutesV1` accepts only strict serializable passive projections: the
guarded composite projection (including lexical rule obligations and boundary families), a guarded
campaign projection (including case identity, validity, spelling tuple and exact boundary family),
the selected oracle digest and policy. A readiness-owned `projectExecutionCampaignV1` derives the
campaign projection from a genuine `PreparedCampaign`; Phase 7 derives the composite projection
from genuine selected authority. The route plan conveys no authority and has no adapter dependency.
ST-05 therefore proves prerequisite structure and that planning exposes no invocation seam; Phase 3
owns real invocation absence. ST-09 proves outcomes are not an input and extra outcome fields reject.<br>
**Evidence:** the original opaque inputs were not serializable across the two fresh processes
required by ST-04, no public oracle-context fixture exists, and the selector could not read
obligations or boundary families from the declared inputs.<br>
**Rejected alternatives:** public test-only opaque factories would create counterfeit authority;
making the planner invoke adapters would violate pre-execution purity; hard-coding current rule
obligations would make RD-08 evolution unsafe.<br>
**Strongest counterargument:** passive projections can be forged by direct callers.<br>
**Resolution:** a forged projection can produce only a non-authoritative plan. The Phase 7
orchestrator alone obtains projections through guarded accessors before any workspace or adapter
exists, so executable authority is never delegated to the pure planner.<br>
**Confidence:** High.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** a route plan itself becomes executable authority or a future modeled rule needs
more than one case-specific boundary-family witness under selector v1.

### AR-P16 — Phase-aligned envelope and evidence validation seams

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Additive internal validation interfaces needed to make already-approved Phase 2
behavior testable; no product scope, execution authority or public diagnostic behavior changes.<br>
**Objective:** Let immutable tests prove expectation-leakage rejection, completion-last structure,
fixture mismatch, diagnostic provenance and unexpected-emission classification without inventing a
Phase 2 adapter or callback.<br>
**Decision:** Add an exact post-entry store sequence to `ExecutionEnvelopeIrV1`: scalar envelopes
contain each observation-byte store in byte order followed by exactly one `$A5` completion store;
direct-MMIO envelopes contain only that completion store. Add focused pure seams in
`@blend65/readiness-execution` for canonical rendered-source validation against a genuine opaque
execution case, fixture digest derivation, passive fixture-readback validation, diagnostic
code/real-phase/final-severity classification and invalid-case artifact-presence classification.
The source validator regenerates canonical bytes and compares them exactly; it never accepts oracle
text or values. Fixture mismatch returns non-passing evidence in Phase 2. Literal proof that VICE
case entry was not reached remains in Phase 5, where entry authority first exists. Do not add an
execution callback or a composite evidence record to a pure validator.<br>
**Evidence:** the accepted design prose already promised actual stores and completion-last but the
declared IR could not represent their order; ST-13, ST-17 and ST-19–ST-21 otherwise had no callable
seam, while adapters and VICE entry are deliberately owned by later phases.<br>
**Rejected alternatives:** one composite Phase 2 evidence record freezes producers that do not yet
exist; callback injection manufactures execution authority solely for a test; substring leakage
checks expose oracle material and admit false positives.<br>
**Strongest counterargument:** several focused public seams increase API surface.<br>
**Resolution:** later adapters must call these same predicates rather than duplicate them; every
output remains passive data or a closed result code and cannot execute a case.<br>
**Confidence:** High.<br>
**Hardening:** Independent design challenger selected this phase-aligned shape and rejected both a
composite evidence record and a Phase 2 callback.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** a later adapter cannot reuse a predicate without giving its return value
execution authority, or runtime store-order evidence becomes independently observable.

### AR-P17 — Report-backed store-order layout proof

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal proof-record completion discovered by the configured semantic review; it
preserves the approved completion-last requirement and does not change product scope.<br>
**Objective:** Prevent lowering, optimization or assembly from moving completion `0xA5` before an
actual observation store while binding the final identity to the exact chosen symbols.<br>
**Decision:** Preserve `resolveExecutionObservationLayoutV1` as the already-frozen passive
structural/historical layout validator. Add
`resolveExecutionCaseObservationLayoutV1(executionCase, input)` as the only live acceptance seam;
its report input adds an ordered `ExecutionEmittedStoreV1[]` containing instruction address, target
address, store kind, exact completion value `0xA5`, and observation byte index where applicable. The live resolver obtains the
guarded case projection, requires zero result symbols for direct-MMIO or exactly the scalar byte
width, requires the emitted store sequence to match the envelope's exact post-entry sequence,
requires strictly increasing instruction addresses inside code, and requires each target to equal
the resolved result/completion address. `ExecutionObservationLayoutV1` retains the selected result
symbol names, completion symbol and emitted stores; all enter its proof digest and final execution
identity. Later orchestration must never accept the structural resolver as live evidence.<br>
**Evidence:** the first Phase 2 semantic review showed that passive IR ordering alone cannot prove
the emitted assembly preserved the order, and address-only hashing aliases two symbol names at the
same address.<br>
**Rejected alternatives:** trusting source order ignores optimizer/codegen behavior; runtime-only
temporal evidence cannot reliably reconstruct store order after completion is observed.<br>
**Strongest counterargument:** the pure resolver receives a passive report projection that a direct
caller can forge.<br>
**Resolution:** the record grants no execution authority; later adapters derive it from genuine
compiler/ACME report evidence before the guarded orchestration path accepts it.<br>
**Confidence:** High.<br>
**Hardening:** The independent semantics reviewer supplied both optimizer-reordering and symbol-
alias counterexamples.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** emitted store targets cannot be reconstructed unambiguously from accepted ACME
report evidence for one of the selected envelope shapes.

### AR-P18 — Phase 3 production contract kernel

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Additive internal contracts required to make the already-approved worker, process,
filesystem and budget behavior testable before implementation; no product scope or authority policy
changes.<br>
**Objective:** Let an implementation-blind oracle prove ST-23–ST-33 without forging an opaque
execution case, guessing OS implementation details or exporting a testing-only debug surface.<br>
**Decision:** Export only production-shaped ports and strict parsers: a genuine-case route-request
constructor; tier-discriminated structured-clone worker requests and evidence responses; start/
completion/termination worker ownership; workspace, process and monotonic-time drivers; an
independently callable bounded evidence ledger; and a cumulative budget scope for deadlines,
launch attempts, output, evidence, instructions and per-child absolute stopwatch cycles. Workers
return tier evidence, never `ExecutionResultV1`; the parent alone classifies terminal results,
charges usage and owns cleanup. Flood authority retains only the stable exhaustion code, selected
limit and cleanup digest. Immutable specification-owned fixtures construct genuine campaign/case/
oracle inputs and own scripted fakes plus resource probes; no testkit, fault hook or ownership
snapshot is exported by production. The bounded ACME route uses an additive entry point and leaves
legacy `invokeAcme` behavior unchanged.<br>
**Evidence:** The first implementation-blind author could not construct genuine route requests or
drive/observe worker, process, ledger and counter failures from the planned interfaces. Repository
grounding found no existing process-group supervisor, abortable ACME runner, bounded stream
collector or reusable resource-inspection contract. Existing worker precedent already separates
closed messages from parent termination, and existing path/publication code uses injected OS
boundaries.<br>
**Rejected alternatives:** an exported conformance testkit freezes fake behavior as quasi-public
API; supervisor `faultAt` and `inspectOwnedResources` hooks leak test-only state and can perturb
cleanup ordering; weakening or deferring immutable coverage violates the phase gate.<br>
**Strongest counterargument:** the production kernel introduces more types than a private
implementation strictly requires.<br>
**Resolution:** every exported port corresponds to a real replaceable OS/protocol boundary also
needed by later VICE ownership; all fake scripting and ownership inspection remains local to the
immutable specification fixture.<br>
**Confidence:** High.<br>
**Hardening:** Independent design challenger selected this option and corrected the worker response
from terminal results to tier-specific evidence.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** a required safety property cannot be observed through production semantics, or
one of these ports would need to expose authority not held by its genuine opaque input.

### AR-P19 — Compiler-result behavioral compatibility

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Correction of an impossible immutable compatibility assertion; no compiler API or
runtime behavior change.<br>
**Objective:** Prove ordinary/evidence-facade compatibility without requiring fresh closure-bearing
public objects from separate invocations to share function identity.<br>
**Decision:** Replace whole-graph deep equality with a test-local exact behavioral projection that
pins own result keys, error state, canonical diagnostics, resolved config, public source-map
lookups, stable semantic collections and query results, call-graph contents/cycles and the complete
allocation plan. Assert the results and source maps are fresh objects and the ordinary result has
no `evidence` member. Use the fixed leading-zero fixture with warning promotion and separately
assert that the evidence entries' code/final severity match the same invocation's final diagnostics
and retain lexer phase. Exclude only callable object identity; do not cache results, drop functions
through generic serialization or refactor compiler/core APIs.<br>
**Evidence:** Two ordinary `compile(options)` calls differ only at nine freshly constructed public
function fields: five source-map methods, three semantic query methods and
`callGraph.findCycles`. No scalar, collection, diagnostic, config, allocation, AST/span or evidence
shape differs.<br>
**Rejected alternatives:** cross-call caching changes execution semantics; a generic serializer can
silently erase future observable data and mishandle cycles/Maps/Sets; a closure-free compiler API
refactor is out of RD-04 scope.<br>
**Strongest counterargument:** the explicit semantic projection is longer than comparing a few
selected fields.<br>
**Resolution:** its length makes every compatibility-significant public behavior explicit and
prevents a broad serializer from concealing a real regression.<br>
**Confidence:** High.<br>
**Hardening:** Independent design challenger selected the behavioral projection and same-invocation
sidecar linkage.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** `CompileResult` becomes a pure data record or adds another public callable query
whose behavior is not captured by the projection.

### AR-P20 — Genuine invalid-case diagnostic authority

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Additive authority contract required to implement the approved invalid frontend/
compiler/CLI routes; no scope expansion beyond RD-04.<br>
**Objective:** Compare observed diagnostic code, real phase and final severity against genuine
campaign/oracle truth without wrapping invalid source, exposing expectation to a worker or accepting
caller-supplied passive truth.<br>
**Decision:** Keep `ExecutionCaseV1` valid-only. Add opaque `PublishedDiagnosticCaseV1` under the
readiness published-oracle boundary, constructed only from a genuine `PublishedOracleContext`,
`PreparedCampaign` and ordinal. The constructor regenerates the case, requires
`invalid-source-transform`, derives all request inputs from authenticated private campaign state,
evaluates the published oracle, verifies rule/neighbor/source provenance/content and stores the
joined authority in a private WeakMap. Its guarded projection exposes fresh source bytes, exact
code/phase/error severity and evaluation/source-content identities for parent-side comparison only.
`ExecutionRouteRequestV1` becomes a closed `valid-envelope` or `invalid-diagnostic` union; the
invalid branch is legal only for frontend/compiler-API/CLI and carries no duplicate oracle context.
Worker messages carry case kind and source bytes but never the expectation. Parent adapters apply
the existing exact diagnostic and invalid-emission classifiers to the authenticated projection.
Emit/ACME/VICE planning must select valid cases; an invalid case cannot satisfy a later-tier
obligation.<br>
**Evidence:** `ExecutionCaseV1` correctly rejects non-valid generation and its projection has no
diagnostic truth. Published oracle requests need private campaign seed/configuration/handler facts
not present in the route. The published diagnostic observation already binds exact rule, neighbor,
code, phase, severity, evaluation identity and source-content identity.<br>
**Rejected alternatives:** broadening `ExecutionCaseV1` collapses executable and rejected-source
invariants; accepting caller fields permits internally consistent counterfeit truth; two opaque
tokens add cross-pair mismatch and replay surface; treating current routes as valid-only silently
drops explicit RD-04 invalid-route behavior.<br>
**Strongest counterargument:** readiness gains an execution-adjacent authority type.<br>
**Resolution:** it owns only the join between campaign and oracle authority, not toolchain/process
behavior; no downstream package can derive the private campaign inputs honestly.<br>
**Confidence:** High.<br>
**Hardening:** Independent design challenger selected the joint opaque capability and rejected all
passive/downstream constructions.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** invalid parameter-binding cases become executable evidence routes or the
published oracle context exposes a different authenticated diagnostic-case constructor.

### AR-P21 — Parent implementation-authority freshness

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Deterministic content-identity maintenance required by the already-approved
published-oracle source addition; it changes neither publication selection nor product behavior.<br>
**Objective:** Keep the genuine selected parent authority fail-closed while allowing it to
authenticate every implementation byte that now participates in diagnostic-case construction.<br>
**Decision:** Use the repository's canonical deterministic regeneration path to add the new
published-diagnostic source to the existing implementation-authority closure and refresh only its
content-bound metadata. Do not change the selected publication pointer, review semantics, oracle
truth, immutable execution specification, or any external state.<br>
**Evidence:** The focused immutable suite stops during genuine publication preparation with
`publication.review.stale` at `/publicationImplementation` immediately after the new source is
added; the resolver intentionally compares the retained authority with current implementation
bytes before exposing an opaque context.<br>
**Rejected alternatives:** bypassing the stale gate destroys the authority boundary; omitting a
participating source makes the retained digest incomplete; selecting a new release prematurely
changes durable state reserved for the final reviewed campaign.<br>
**Strongest counterargument:** touching retained publication metadata during adapter work expands
the apparent Phase 3 file set.<br>
**Resolution:** this is the minimum necessary content-identity consequence of the authorized
upstream source addition, and it is constrained to deterministic metadata with the pointer held
fixed.<br>
**Confidence:** High — the resolver's exact stale diagnostic and source-closure mechanism make the
required correction unambiguous.<br>
**Hardening:** The existing fail-closed publication freshness check rejects every alternative that
does not bind the new source bytes; no separate architectural choice is introduced.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** canonical regeneration would alter the selected pointer, accepted semantic
review, or any publication behavior rather than only implementation-authority content identity.

### AR-P22 — Genuine diagnostic fixture source stratum

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Immutable-oracle construction correction required to exercise the already-approved
invalid-source authority; it does not change product behavior or acceptance criteria.<br>
**Objective:** Build the diagnostic capability from a genuine campaign case whose generated kind
is exactly `invalid-source-transform`.<br>
**Decision:** Reopen only the spec-owned fixture and include a source spelling in its diagnostic
campaign (or an equivalent separate genuine source-invalid campaign if required for deterministic
strata). Preserve every assertion and production generator/rendering rule, then re-freeze both
immutable hashes after the focused characterization run.<br>
**Evidence:** With `spellings: ["parameter"]`, the scalar word-range campaign filters every choice
to parameter spelling and can generate only `parameter-binding-replace`, rendered as
`invalid-parameter-binding`; therefore its scan cannot find the source-invalid ordinal it requires.<br>
**Rejected alternatives:** changing generation semantics would contradict the explicit campaign
configuration and published diagnostic contract; accepting a parameter-invalid case would weaken
the authority kind the execution route is required to prove.<br>
**Strongest counterargument:** reopening a frozen fixture after implementation begins risks making
the oracle implementation-aware.<br>
**Resolution:** the spec author remains forbidden from production and changes only the impossible
input configuration; all output assertions remain immutable and unchanged.<br>
**Confidence:** High — the configured spelling allowlist makes the missing stratum mechanically
unreachable.<br>
**Hardening:** The correction is routed back to the implementation-blind spec author and must
reproduce a genuine expected RED/green characterization before new hashes are accepted.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** adding source spelling changes any expectation rather than only making the
required genuine case reachable, or deterministic generation still lacks the source-invalid kind.

### AR-P23 — Versioned diagnostic case-equivalence join

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal authority-join semantics between two already-authenticated capabilities;
the decision preserves the approved genuine-case behavior, passive boundary and selected release.<br>
**Objective:** Prove a caller's genuine RD-02 case and the selected oracle's replay describe the
same diagnostic input without falsely requiring their intentionally distinct provenance identities
to collapse.<br>
**Decision:** Use `published-diagnostic-case-equivalence-v1`. Retain the caller
`sourceCaseDigest`, and separately retain selected release, campaign and case digests plus
evaluation/source-content identities. Require equality of inventory schema/version/digest, spec
revision, rule-model version/digest, target, PRNG algorithm, seed, configuration digest, and
generator/boundary handler IDs and contract versions. Generator/boundary implementation revisions
may differ only when the complete modeled case and exact rendered source are equal. Require exact
validity, transform, bindings, rule and neighbor; require modeled error diagnostic truth. Derive
the oracle handler privately from the selected rule route, including runtime-domain handlers.
Include the join-policy revision and both provenances in downstream execution/publication identity.<br>
**Evidence:** Campaign identity deliberately includes generator/boundary implementation revisions,
while published replay deliberately substitutes the selected release participants. Consequently,
equal genuine semantics can and should have different campaign/case provenance digests.<br>
**Rejected alternatives:** exact digest equality conflates provenance with semantics and would
require a new selected-private campaign factory; an unversioned model/source comparison can omit
future ambient inputs and become an incomplete ad hoc predicate.<br>
**Strongest counterargument:** equivalence joins are vulnerable when a future semantic ambient
field is added without updating the tuple.<br>
**Resolution:** close and version the compatibility tuple, fail closed on unrecognized campaign
shape, preserve dual provenance, and reopen this decision whenever diagnostics gain another input.<br>
**Confidence:** High.<br>
**Hardening:** Independent challenger grounded the intentional identity divergence in campaign
identity and published replay code, attacked the equivalence predicate, and required the closed
ambient tuple, dual provenance, selected-route handler derivation and immutable mutants.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** diagnostic semantics gain any input beyond the closed ambient tuple, exact
modeled case/source and selected diagnostic publication, or downstream identity omits either
provenance or the join-policy revision.

### AR-P24 — Layered coverage for closed authority fields

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Test-observability mechanism for an approved authority invariant; it neither
changes behavior nor exposes additional authority.<br>
**Objective:** Prove every ambient compatibility axis fails closed at the earliest genuine public
boundary without manufacturing an impossible opaque campaign state.<br>
**Decision:** Exercise axes that public inputs can vary by joining two independently genuine
authorities. For schema, PRNG and handler identity/contract fields fixed by public campaign
construction, prove the owning public preparation/parser rejects the mutant before a
`PreparedCampaign` exists. Retain plain/copy/proxy capability-rejection cases. Do not export a
test-only constructor, debug hook or structural authority seam.<br>
**Evidence:** `createPublishedDiagnosticCaseV1` accepts only opaque `PreparedCampaign`; public
preparation fixes inventory schema version, PRNG algorithm and generator/boundary handler IDs and
contract versions, so a genuine token with those mismatches is unconstructable.<br>
**Rejected alternatives:** a forging seam weakens the opacity being tested; a structural copy tests
only authentication and cannot prove field-specific compatibility; silently dropping coverage
would leave no proof that the owning constructor enforces the closed value.<br>
**Strongest counterargument:** layered tests do not execute every comparison inside the final join
function.<br>
**Resolution:** unreachable states are proved at their owner boundary, while every reachable
mismatch is exercised at the join; this follows the actual capability graph and avoids dishonest
test states.<br>
**Confidence:** High.<br>
**Hardening:** The implementation-blind spec author identified the impossible genuine mutants and
the resolution preserves authority opacity rather than adding a test-only escape hatch.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** a fixed ambient field becomes caller-configurable or any public path can create
a genuine campaign carrying a previously unreachable mismatch.

### AR-P25 — Ambient-mutant fixture construction ownership

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Correction of spec-owned test setup to follow the layered genuine-boundary policy
already resolved in AR-P24; no behavioral or acceptance change.<br>
**Objective:** Ensure each ambient mutant reaches the earliest public owner that can genuinely
observe it and allow all diagnostic join scenarios to reach production.<br>
**Decision:** Treat rule-model version/digest mutants as campaign-preparation rejection cases and
generator/boundary contract mutants as freshness-registration rejection cases. Use only genuinely
constructible campaigns for final join mismatches. Preserve all authority, source, route, worker
and classifier expectations.<br>
**Evidence:** Forcing either fixed rule-model field through campaign creation caused the shared
fixture to fail before any scenario; handler contract mismatches are rejected earlier by freshness
registration. After routing those axes to their owners, all 19 tests construct and the eight new
scenarios reach the production diagnostic constructor.<br>
**Rejected alternatives:** relaxing production construction would admit invalid ambient state;
weakening or dropping mutants would lose closed-field evidence.<br>
**Strongest counterargument:** distributed boundary tests make the equivalence proof less visually
centralized.<br>
**Resolution:** explicit axis-to-owner scenario names keep the complete proof auditable while
respecting the actual opaque capability graph.<br>
**Confidence:** High.<br>
**Hardening:** The implementation-blind spec author reproduced the failure, isolated exact axes and
proved the corrected fixture reaches production without reading implementation files.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** an owner boundary begins accepting one of these fixed mutants or a join scenario
again fails before invoking the production diagnostic constructor.

### AR-P26 — Semantic spec revision versus content digest

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal correction of two conflated identity dimensions inside the selected
published-context adapter; product scope and accepted language revision remain frozen.<br>
**Objective:** Make genuine caller and selected replay campaigns compare the same semantic language
revision while retaining the inventory bytes' content digest as an independent authority field.<br>
**Decision:** Replace digest-prefix stripping with a private named campaign semantic revision
`spec-v3.0` at every selected campaign construction/projection site in this frozen-v3.0 release.
Keep the authenticated inventory content digest separate and retain exact `specRevision` equality
inside `published-diagnostic-case-equivalence-v1`; do not add aliases or comparison exceptions.<br>
**Evidence:** The caller campaign consistently carries `spec-v3.0`; selected replay carried bare
`518601…` only because `campaignSpecRevision()` removed `sha256:` from the publication inventory's
content digest. That value is neither a semantic revision nor the original content identity.<br>
**Rejected alternatives:** join aliasing weakens a closed ambient invariant; retaining the stripped
digest preserves a lossy type error; changing caller campaigns would rewrite established RD-02
semantic identity.<br>
**Strongest counterargument:** a private v3.0 constant must change when a future spec revision is
selected.<br>
**Resolution:** this project and plan explicitly target frozen spec-v3.0; reopening is mandatory
when publication metadata gains or selects another semantic revision.<br>
**Confidence:** High.<br>
**Hardening:** The exact mismatch was isolated with every other ambient field equal, and the
correction preserves rather than relaxes the independent challenger's closed join predicate.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** selected publication authority supports a semantic revision other than v3.0 or
exposes a dedicated authenticated semantic-revision field.

### AR-P27 — Selected-release inventory provenance in the diagnostic fixture

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Spec-owned authority-fixture correction that preserves the selected release and
exact join policy.<br>
**Decision:** Construct diagnostic campaigns from the resolver-validated selected release's
`compiler-readiness-v1.json` member, not the different workspace inventory bytes. Keep exact
inventory-digest equality; do not select another release or substitute workspace state.<br>
**Evidence:** The selected member hashes to `e7e341eb…`, while the current workspace inventory
hashes to `19863d38…`; the release is the authority the context authenticates.<br>
**Confidence:** High.<br>
**Hardening:** The implementation-blind fixture owner proved all baseline and mutant paths use the
resolver-validated release member and retained every negative expectation.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** the selected pointer changes or the resolver no longer exposes the exact
authenticated release member used by campaign construction.

### AR-P28 — Caller-campaign seed and configuration authority

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal authority ownership inside the approved diagnostic replay join; no
product, publication or campaign-selection policy changes.<br>
**Objective:** Bind reproducible campaign inputs without making an implementation publication own
one arbitrary campaign instance.<br>
**Decision:** A runtime-authenticated `PreparedCampaign` is the sole source of seed and normalized
generation configuration. Pass both unchanged into selected-context replay and require exact
normalized echo as replay-integrity postconditions. Keep both in caller and selected campaign/case
identities and in selected evaluation identity. Treat publication-owned inventory/spec/rule-model/
target and handler contracts as ambient authority. Distinct genuine seed/configuration campaigns
may join the same context when each independently reproduces its full modeled case and source;
cross-paired route identities and hostile serialized mutations reject. Keep join revision v1
because it has not shipped.<br>
**Evidence:** RD-02 defines seed/configuration per campaign, and RD-03 accepts both as caller
semantic intent while `PublishedOracleContext` owns selected implementations. The context contains
no selected campaign instance; comparing caller values to replayed copies cannot be an independent
allowlist.<br>
**Rejected alternatives:** adding a fixed selected seed/configuration conflates implementation and
campaign authority, reduces generative diversity and requires republishing for each campaign;
dropping replay/identity checks would weaken reproducibility.<br>
**Strongest counterargument:** caller-selected seeds can cherry-pick easy cases.<br>
**Resolution:** coverage minima and orchestration own campaign selection; oracle truth must remain
valid for every authenticated campaign input.<br>
**Confidence:** High.<br>
**Hardening:** Independent challenger grounded the ownership split in RD-02/RD-03 and required
positive distinct-input, deterministic replay, hostile mutation and cross-pair tests; the final
immutable suite passes 19/19.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** a future orchestration policy introduces canonical campaign seeds/configuration
or publication authority explicitly selects a campaign instance.

### AR-P29 — Race-free process-group ownership anchor

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Linux/Node process-ownership mechanism inside the approved argv-only bounded child
supervisor; no compatibility, platform-policy or product-scope change.<br>
**Objective:** Terminate a target and every descendant without ever signaling a recycled or
otherwise unrelated numeric process group.<br>
**Decision:** Launch a package-owned Node anchor as the detached PID/PGID/SID leader. After
installing signal handlers and positively validating its own boot/start/group/session identity, it
authenticates a bounded exact-key parent IPC protocol with nonce and sequence, then spawns the
requested target non-detached into its group. Only the live anchor may signal the group, using
`process.kill(0, signal)` from inside its pinned membership. The parent never calls a negative-PGID
signal. The anchor stays alive after target exit until a bounded membership check proves the group
empty; forced kill is preceded by an authenticated flushed `kill-armed` event and includes the
anchor. Control loss, malformed/order/nonce failure or ambiguous post-anchor membership fails closed
with a cleanup blocker and no fallback signal. Public request, handle and relayed target outcome
remain compatible.<br>
**Evidence:** Parent-side identity validation followed by `kill(-pgid)` has an unavoidable reuse
window. Node 22 exposes no public pidfd API, process-group pidfd signaling requires newer Linux and
native syscall glue, and cgroup kill requires a delegated writable subtree unavailable by default.
The live in-group anchor turns sampled identity into a capability held at the signal syscall.<br>
**Rejected alternatives:** immediate revalidation cannot close the race; per-member pidfds miss
fork/enumeration gaps; child-only signaling leaks descendants; cgroups and native pidfds add
unsupported host/dependency assumptions.<br>
**Strongest counterargument:** the anchor adds one trusted Node process and a non-trivial protocol
per external tool launch.<br>
**Resolution:** the protocol is closed, bounded and testable, retains the public API, and fails
closed on every anchor/control failure; no simpler viable mechanism meets descendant cleanup and
unrelated-process safety together.<br>
**Confidence:** High.<br>
**Hardening:** Independent challenger compared wrapper, pidfd, cgroup and fail-closed child-only
designs, corrected the design so the parent never group-signals, and specified crash/reuse/protocol
tests.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Node gains a portable process-group pidfd capability, a trusted cgroup subtree
becomes a declared prerequisite, or the anchor cannot remain live until descendant absence proof.

### AR-P30 — Observable production anchor kernel

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Production-shaped dependency inversion needed to test the approved anchor; it
preserves the public process runtime and exports no additional execution authority.<br>
**Objective:** Let an implementation-blind oracle drive the actual parent parser/state machine and
actual anchor parser/state machine while controlling and observing only raw operating-system facts.<br>
**Decision:** Export `createExecutionProcessRuntimeV1(parentHost?)`,
`runExecutionProcessAnchorV1(anchorHost, transport, cancellation)` and the default runtime. Inject
raw bounded control transport, spawn identities/exits, stream bytes and group-membership outcomes.
The parent host has no signal method; the anchor host accepts only a closed
`self-process-group` TERM/KILL signal with no PID/PGID field. Frames are canonical UTF-8 JSON plus
one LF, exact-key, nonce-bound and independently sequenced per direction. Limits are fixed: 8 MiB
per frame, 16 MiB/16 frames per direction, 32-byte nonce, 1,024 argv items, 64 KiB/item/path,
512 KiB argv aggregate and 128 KiB environment aggregate. The exact child environment is
`LANG=C`, `LC_ALL=C`, `TZ=UTC`; executable resolution and cwd remain explicit. Fakes may supply raw
frames/EOF/crash, OS identity/exit/membership and recorded closed signals only; they cannot inject
parsed messages, state, parser behavior or policy overrides.<br>
**Evidence:** The prior abstract handle hides anchor identity, IPC, signal target and membership
facts, so a fake handle could only restate the behavior under test. Raw ports keep both protocol
halves production-owned and make negative-PGID signaling structurally unavailable.<br>
**Rejected alternatives:** debug snapshots and parsed-message injection expose quasi-authority;
testing only the abstract handle cannot distinguish a safe anchor from the rejected parent
validate→signal implementation.<br>
**Strongest counterargument:** the exported kernel surface is larger than the runtime factory alone.<br>
**Resolution:** every port maps to a real OS/transport boundary needed by production, uses closed
bounded data, and grants no caller access to process authority beyond the existing runtime.<br>
**Confidence:** High.<br>
**Hardening:** Independent challenger supplied exact types, discriminators, bounds and authority
separation; the environment was narrowed to the three deterministic variables required by this
toolchain, avoiding a synthetic HOME override.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** the immutable spec cannot prove a required anchor state through raw OS facts,
or a port would need to expose parsed state, arbitrary signal targets or test-only mutation hooks.

### AR-P31 — Anchor nonce bootstrap

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal ordering of the approved raw anchor protocol; no public behavior or
authority expansion.<br>
**Decision:** After spawning the anchor, the parent sends a canonical parent-to-anchor
sequence-zero `bootstrap` frame whose base contains the newly generated nonce. The private channel
is the bootstrap authenticity boundary. The anchor accepts no other first frame, validates/adopts
the nonce, then emits its independently sequenced zero `anchor-ready`; parent launch is sequence
one. The nonce never enters environment, argv or hidden test state.<br>
**Evidence:** Without a bootstrap message or explicit spawn field, the anchor runner has no input
from which to authenticate its first event.<br>
**Rejected alternatives:** environment/argv transport exposes protocol material to the target
launch boundary; hidden transport state prevents implementation-blind testing.<br>
**Confidence:** High.<br>
**Hardening:** The implementation-blind spec owner found the contradiction before authoring.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** the production IPC channel is not private to parent/anchor or cannot deliver the
bootstrap frame before anchor identity observation.

### AR-P32 — Observable VICE control kernel and exact protocol ownership

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal architecture, protocol validation, cancellation and testing strategy
inside the approved additive C64 VICE-control subpath; no target, acceptance, publication or public
legacy behavior changes.<br>
**Objective:** Let an implementation-blind oracle drive the real control state machine through raw
process, socket, time and identity facts while preserving the existing `ViceDriver` surface and
making every launch/runtime failure deterministic and bounded.<br>
**Decision:** Export a versioned `createViceControlRuntimeV1(host?)` beside the default
`launchViceControlV1`. The host owns only raw spawn/owned-child lifecycle, fragmented binary/text
loopback byte channels, monotonic time/delay and positive child-to-listener ownership facts;
production owns framing, parsing, correlation, handshake, state and retry policy. Replace the
anonymous endpoint tuple with named `binaryPort`/`textPort` fields. Pass `executable`, `argv` and
`cwd` to the host byte-for-byte; the compatibility wrapper alone builds the current fixed
binary-then-text monitor flags and preserves their ordering.

One low-level call performs exactly one child launch. It may make at most 60 connection rounds,
250 ms apart under the inclusive 15-second launch-attempt deadline, but never respawns or selects
new ports. The readiness-execution owner allocates fresh distinct endpoints and performs at most
eight child attempts under the cumulative route deadline. Issues retain the four public classes
and add a closed stable reason discriminator for request, spawn, connect, child-exit,
endpoint-owner, binary-handshake, text-handshake, C64-target, version, frame, cancellation, closed
and transport failures.

The composite handshake requires API-v2 binary framing; core `A/X/Y/SP/PC/FL` registers;
`VICE_INFO` major 3 inside the caller's closed minor range; successful integer
`RESOURCE_GET("VICIIModel")` as the C64-specific live probe; one anchored text-monitor stopwatch
reply; and, for readiness authority, Linux proof that both listener socket inodes belong to the
positively identified owned child. The legacy wrapper may use compatibility ownership mode but
still performs the live protocol/target/version checks. Its effective supported floor is VICE 3.6,
because the official binary-monitor contract introduced `VICE_INFO` in 3.6; readiness authority
requires exactly 3.10.

`advanceInstructions` accepts only integers `1..65535` and never masks an out-of-range value. The
readiness loop greedily decomposes larger totals, including 10,000,000, into full 65,535 chunks and
one remainder and charges each whole requested chunk before submission. Correlated response/event
arrival is linearized by the first transition that removes the pending operation. Explicit
`cancelPending()` settles current operations as `vice.cancelled`, discards their late frames and
keeps the session usable; `close()` is idempotent, permanently closes the session and settles
pending work as `vice.closed`. Read/write byte ownership is by defensive copies: write inputs are
snapshotted before the first await, each read returns fresh bytes, and transport activity never
mutates a resolved buffer.<br>
**Evidence:** The planned API exposed aggregate operations but no observable raw boundary, endpoint
roles, retry owner or stable failure reasons. Existing `advanceInstructionsBody` masks through a
u16 writer without validation; `ViceDriver` already fixes binary-before-text argv order and gates
on `VICE_INFO`; the official installed VICE manual states `VICE_INFO` reports versions only and is
available from 3.6. Local VICE 3.10 configuration dumps show `VICIIModel` in x64sc and absent from
x128 and xvic. The Phase 3 raw-kernel pattern already proves that least-authority ports can expose
OS facts without exporting parsed authority.<br>
**Rejected alternatives:** A black-box fake executable duplicates a second VICE implementation,
makes race scheduling nondeterministic and cannot prove all late-frame interleavings. Pure exported
planners can pass while real correlation, cancellation and fragmented transport are wrong. Inferring
C64 from argv, filename, generic registers or `VICE_INFO` is not a live target proof; protocol-only
authentication is unavailable, so readiness also requires owned-listener identity.<br>
**Strongest counterargument:** The host factory exposes raw transport concepts as a supported
versioned subpath API and increases the surface that must remain stable.<br>
**Resolution:** Keep the host least-authority, versioned and confined to `vice-control`; pair its
deterministic oracle with one real-process loopback default-adapter smoke test and the unchanged
real-VICE suites. This cost is smaller than an untestable concurrency state machine or a second
fake protocol implementation.<br>
**Confidence:** High; a supported VICE release changing or removing the `VICIIModel` resource would
invalidate the target probe.<br>
**Hardening:** The implementation-blind spec author stopped on the missing contract. An independent
challenger converged on the raw-host factory, named endpoints, single low-level attempt, stable
reasons, cancellation linearization and defensive-copy semantics, and rejected protocol-only C64
inference. Local wrong-target 3.10 resource evidence closed the challenger's remaining probe
condition.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** a supported VICE release lacks a stable integer `VICIIModel` resource, endpoint
ownership cannot be proven before readiness accepts a socket, the host needs parsed messages or
arbitrary PID/signal authority, or compatibility tests show the wrapper changed observable behavior.

### AR-P33 — Observable VICE lease coordinator and raw host boundary

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal composition-package architecture and cancellation semantics inside the
approved Linux-only VICE lease; no target, publication, expectation or legacy behavior change.<br>
**Objective:** Let an implementation-blind oracle deterministically prove every crash, identity,
trusted-filesystem, retry, budget and no-signal case without mutating the developer's real lease or
injecting parsed monitor/policy outcomes.<br>
**Decision:** Export `createViceExecutionRuntimeV1(host?)`. Each runtime owns one private
coordinator and private opaque-handle registry; the existing global acquire/inspect/clear/execute
functions delegate to exactly one module singleton. Handles are bound to their creating runtime,
admitted once and transition `fresh → executing → consumed`; every terminal execution outcome
consumes them. The fixed host-wide filesystem claim, rather than process-local state, provides
cross-runtime exclusion. A concurrent mutation never queues: it fails with the existing
`execution.stale-authority` operation code so scheduling cannot choose authority.

The host exposes only the fixed namespace's raw bounded bytes and directory/file identity facts,
cryptographic random bytes, Linux boot/process facts, monotonic time/delay, fresh loopback endpoint
facts, and narrowly atomic compare-create/replace/remove outcomes. It creates one constrained raw
`ViceControlHostV1` for a declared attempt: that host's one `spawn` first durably replaces the exact
claim with a same-PID child record, then `execve`s the byte-exact VICE request without changing PID.
It can signal only through `revalidateAndTerminateVice`, which reopens the exact lease, rereads
boot/PID/start/token immediately before a fixed TERM or KILL and returns changed/ambiguous rather
than accepting an arbitrary PID or signal. Production retains record parsing, lifecycle decisions,
authority, retry, budget and expectation policy; low-level VICE control retains framing,
correlation and handshake. Raw bytes and token facts are defensively copied.

All public runtime operations take an `AbortSignal`. A pre-aborted operation performs no lease,
endpoint, spawn or control mutation. After cancellation no new ordinary work starts; pending
control commands are cancelled, while owned cleanup uses a private bounded cleanup signal and exact
generation/identity revalidation. Each attempt receives a distinct endpoint pair and a freshly
constructed constrained raw control host; no more than eight low-level one-child launches occur.
One route-wide budget scope charges instructions and cycles before work and never refunds failed,
cancelled or unanswered work; retries never reset attempts, instruction, cycle or monotonic wall
totals. Unsupported or restricted identity reports `tier-unavailable` before lease reads or
process operations, with no PID-only fallback.<br>
**Evidence:** Task 4.1.2 could not safely express ST-35–ST-43/ST-60–ST-62 through global functions
whose environment was hidden. Phase 3 and AR-P32 already establish the public versioned raw-host
factory pattern. The accepted API is new, so adding cancellation does not break an existing caller.<br>
**Rejected alternatives:** A package-private factory leaves the public singleton path unprovable and
is effectively a test-only seam. Black-box subprocess tests remain valuable integration evidence
but cannot deterministically schedule replacement, cancellation and exact-bound races or safely
prove that an unrelated process is never signalled.<br>
**Strongest counterargument:** A domain-specific host port is broad and can accidentally become a
second implementation of lease policy.<br>
**Resolution:** Restrict it to immutable raw facts, exact compare-and-swap outcomes, a fixed
namespace, one single-use record-then-exec attempt host and fixed TERM/KILL revalidation; it exposes
no parsed lease validity, retry decision, expectation truth, arbitrary path, PID or signal.<br>
**Confidence:** High.<br>
**Hardening:** The implementation-blind spec owner stopped at the missing seam. An independent
challenger compared the public factory, package-private factory and black-box process matrix and
converged on the public least-authority runtime factory with singleton facade and immediate
admission semantics.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** a mandatory lease state cannot be proved through raw facts, the default host
cannot make record-before-exec durable under the same PID, or any port would need arbitrary
filesystem/process authority or parsed policy injection.

### AR-P34 — Typed-array backing annotation in the immutable control oracle

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Type-only correction to a specification-local frame helper; no expectation,
scenario, production contract, runtime byte or public behavior changes.<br>
**Decision:** Explicitly annotate `responseFrame`'s optional body parameter as `Uint8Array`. The
original default expression inferred `Uint8Array<ArrayBuffer>` while `TextEncoder.encode` supplied
the valid wider `Uint8Array<ArrayBufferLike>`, causing TS2345 only after the absent module was
implemented. Preserve all 29 assertions and replace the immutable hash with
`c48953c2a1237ea03016a3ef185be4944c95ff4c413e02cecd3d32ebfffdaf2a`.<br>
**Evidence:** Before correction the runtime suite was 29/29 GREEN but package typecheck failed at
the helper call; afterward the same 29/29 pass and package typecheck is GREEN.<br>
**Rejected alternatives:** Weakening/excluding spec typechecking violates the repository gate;
altering production or handshake bytes to accommodate an inference artifact changes the wrong
owner.<br>
**Confidence:** High; this changes only the compile-time generic annotation.<br>
**Hardening:** Proportional local recheck of formatting, package typecheck, unchanged scenario
count and runtime GREEN; an architecture challenger is not warranted for a type-only helper fix.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** any expectation, emitted byte, scenario count or runtime result differs after
the annotation.

### AR-P35 — Retained identity for the replaced-inode oracle mutant

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Specification-fixture correction that restores the already approved
compare-and-swap identity invariant; no production rule or expected failure changes.<br>
**Decision:** In the `replaced inode` case, keep the prior file identity in
`ViceLeaseReferenceV1.file` and expose the new inode only in the observed snapshot file. Other
owner/mode/link mutants retain matching references. Production therefore rejects an observable
reference inconsistency, not an arbitrary inode value.<br>
**Evidence:** The original first snapshot named inode 13 in both positions, leaving no trusted
historical identity and making inode 13 indistinguishable from any legitimate first lease file.
The corrected pair directly models the replacement race required by ST-60.<br>
**Rejected alternatives:** A hard-coded inode relationship is not a filesystem guarantee; rejecting
every first observation would make stale-lease inspection impossible.<br>
**Confidence:** High; the correction supplies the missing prior fact without changing the expected
fail-closed result.<br>
**Hardening:** The implementation owner challenged the impossible premise before adding an unsafe
rule; proportional fixture review confirmed existing guarded-clear and pre-signal race coverage.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** production would still need a fabricated inode relation, or a matching
reference/observation pair is rejected solely because its inode differs from the fixture constant.

### AR-P36 — Type-specific POSIX link-count authority

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Linux filesystem validation semantics inside the approved fixed lease namespace;
no path, target, authority or recovery-safety expansion.<br>
**Decision:** Retain the unmodified raw link count in `ViceLeaseNodeIdentityV1`. For directories,
require a positive safe integer but exclude the exact count from trust and identity comparison;
compare type, device, inode, UID and mode under no-follow opens. For the regular lease file, require
and compare `links === 1`. Correct the immutable oracle to accept representative directory counts
1, 2 and 276, reject zero, and preserve the file-hard-link rejection.<br>
**Evidence:** The actual mode-0700 effective-UID runtime directory reports `st_nlink=276`, while a
new POSIX directory normally reports at least two. Directory link count reflects `.` and child
`..` topology and can also use filesystem-specific sentinel behavior; it does not provide the
regular-file anti-hard-link proof. No-follow type validation and retained device/inode detect
replacement.<br>
**Rejected alternatives:** Ignoring the raw field loses a useful malformed-fact check. Requiring
one rejects normal Linux namespaces. Normalizing to one fabricates OS evidence and could later be
mistaken for a security fact.<br>
**Strongest counterargument:** A directory count change can reveal same-UID namespace mutation.<br>
**Resolution:** Treat it as non-authoritative topology churn; if child-name policy is later needed,
express it through bounded enumeration rather than a count that causes false recovery blocks.<br>
**Confidence:** High.<br>
**Hardening:** Independent security challenger converged and required separate directory/file
comparators, positive safe-integer validation and preservation of the raw fact.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** a supported Linux filesystem yields no positive raw directory count, no-follow
directory identity cannot detect replacement, or a regular lease file with more than one link is
accepted.

### AR-P37 — Matching STOPPED event in the checkpoint-hit oracle

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Raw fake-sequence correction required by the accepted concurrency review; no
checkpoint identity, completion marker, expected result or public API change.<br>
**Decision:** The successful hit script emits unsolicited exact checkpoint metadata, then the
correlated ADVANCE acknowledgement, then unsolicited STOPPED. Production retains the checkpoint
metadata but resolves `advanceInstructions` only after both acknowledgement and the matching stop,
so a later command cannot consume a stale stop or touch a still-running machine.<br>
**Evidence:** The prior fake never emitted STOPPED on its hit path, contradicting real VICE's
asynchronous advance completion contract and making a safe implementation fail two otherwise valid
completion-marker scenarios.<br>
**Rejected alternatives:** Resolving on checkpoint alone preserves the reviewed race; weakening the
completion scenarios would remove STORE/readback authority.<br>
**Confidence:** High; the corrected order deliberately exercises event-before-ack and
stop-after-ack correlation.<br>
**Hardening:** Correctness/concurrency review RV-004 supplied the stop-gating requirement; the
implementation owner stopped instead of weakening production.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** real VICE completes a checkpointed advance without STOPPED, or a later advance
can consume an event from the prior execution epoch.

## Systematic 12-Category Closure

| Category | Closure evidence |
|---|---|
| Feature gaps | RD-04 owns all six routes, selected modeled population, publication and local acceptance; RD-08 remains outside scope (AR-P1). |
| Behavioral gaps | Selector, passive projection boundary, stage order, failure precedence, Phase 2 evidence seams and tool absence are closed (AR-P6, AR-P9, AR-P15, AR-P16). |
| Scope ambiguities | Planning target and modification set are explicit; no optional expansion was accepted (AR-P1). |
| Technical unknowns | Package, provenance, VICE, process and publication mechanisms are selected (AR-P2–AR-P5, AR-P10–AR-P12). |
| Edge cases | Fixture cells, exact limits, retries, PID reuse, crash states, stale sentinel and cleanup are owned (AR-P8–AR-P11). |
| Integration points | Frontend/compiler/CLI/emit/ACME/VICE boundaries and opaque authority seams are explicit (AR-P2–AR-P5, AR-P32–AR-P33). |
| Data & state | Two-stage identity, observation layout, child publication and lease generations are closed (AR-P5, AR-P7, AR-P11). |
| Security & compliance | Canonical paths, argv-only processes, bounded evidence and fail-closed identity are required; there is no auth, credential, PII or remote-network surface (AR-P10–AR-P11). |
| Non-functional gaps | Finite budgets, deterministic output, coverage and local/CI tiers are fixed (AR-P6, AR-P9–AR-P10, AR-P13). |
| UX & presentation | Existing CLI rendering remains unchanged; new machine evidence uses closed codes and bounded manual-recovery text (AR-P3, AR-P9, AR-P11). |
| Stakeholder conflicts | Compiler users, CI and local acceptance share the approved fail-closed readiness objective; no permission or role conflict exists. |
| Naming & terminology | Package, artifact, type and module vocabulary is fixed (AR-P12). |
