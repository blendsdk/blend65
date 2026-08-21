# Ambiguity Register: RD-04 Tiered Compiler, ACME and VICE Execution

> **Status**: ✅ GATE PASSED — all 14 items resolved
> **Last Updated**: 2026-08-21 23:21
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
`PublishedExecutionContext`; a composite resolver projects exactly accepted parent `unbound`
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
minima cannot fit, planning fails `execution.plan.capacity`; it never truncates an obligation.
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
route return. Missing tools are `tier-unavailable`, not launch failures.<br>
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
`ExecutionBudgetV1`, `ExecutionResultV1`, `PublishedExecutionContext` and
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

## Systematic 12-Category Closure

| Category | Closure evidence |
|---|---|
| Feature gaps | RD-04 owns all six routes, selected modeled population, publication and local acceptance; RD-08 remains outside scope (AR-P1). |
| Behavioral gaps | Selector, stage order, failure precedence and tool absence are closed (AR-P6, AR-P9). |
| Scope ambiguities | Planning target and modification set are explicit; no optional expansion was accepted (AR-P1). |
| Technical unknowns | Package, provenance, VICE, process and publication mechanisms are selected (AR-P2–AR-P5, AR-P10–AR-P12). |
| Edge cases | Fixture cells, exact limits, retries, PID reuse, crash states, stale sentinel and cleanup are owned (AR-P8–AR-P11). |
| Integration points | Frontend/compiler/CLI/emit/ACME/VICE boundaries and opaque authority seams are explicit (AR-P2–AR-P5). |
| Data & state | Two-stage identity, observation layout, child publication and lease generations are closed (AR-P5, AR-P7, AR-P11). |
| Security & compliance | Canonical paths, argv-only processes, bounded evidence and fail-closed identity are required; there is no auth, credential, PII or remote-network surface (AR-P10–AR-P11). |
| Non-functional gaps | Finite budgets, deterministic output, coverage and local/CI tiers are fixed (AR-P6, AR-P9–AR-P10, AR-P13). |
| UX & presentation | Existing CLI rendering remains unchanged; new machine evidence uses closed codes and bounded manual-recovery text (AR-P3, AR-P9, AR-P11). |
| Stakeholder conflicts | Compiler users, CI and local acceptance share the approved fail-closed readiness objective; no permission or role conflict exists. |
| Naming & terminology | Package, artifact, type and module vocabulary is fixed (AR-P12). |
