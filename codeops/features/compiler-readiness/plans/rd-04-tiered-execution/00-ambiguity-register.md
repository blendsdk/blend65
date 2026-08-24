# Ambiguity Register: RD-04 Tiered Compiler, ACME and VICE Execution

> **Status**: ✅ GATE PASSED — all 81 items resolved; AR-P32–AR-P81 added during execution
> **Last Updated**: 2026-08-24
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
| AR-P63 | Integration points (runtime) | Which deterministic, implementation-blind seam can prove orchestration mismatch, CLI exit and report-crash behavior without real tools or authority-forging public ports? | Package-private operation-scoped declarative conformance / public dependency ports / external subprocess and filesystem manipulation only | Closed `AsyncLocalStorage` conformance controls outside public exports and live-handler authority; AI delegated by `--auto-design`; challenger converged | ✅ Resolved |
| AR-P64 | Data & state (runtime) | How does the report obtain the exact genuine campaign seed when the approved orchestration input and opaque campaign summary omit it? | Dedicated passive campaign-identity subpath / caller seed plus validator / broaden campaign summary or existing projection / derive or omit | WeakMap-authenticated frozen `{campaignDigest,seed,target}` identity projection on a dedicated readiness subpath; AI delegated by `--auto-design`; challenger converged | ✅ Resolved |
| AR-P65 | Behavioral gaps (runtime) | How does the frozen oracle construct a successful VICE result when `vice` is a tier but not a legal pipeline stage? | Map VICE success to its declared terminal `compare` stage / widen the production stage union / defer typechecking | Correct only the spec helper to use `tier === 'vice' ? 'compare' : tier`, preserve assertions, rerun RED and refreeze; AI delegated by `--auto-design` | ✅ Resolved |
| AR-P66 | Data & state (runtime) | How is genuine parent authority restored after AR-P64 necessarily changes a bound readiness manifest and source closure? | Immutable reviewed parent refresh / exclude changed bytes / caller or ambient seed / defer freshness | Rebuild/select a new nine-binding parent from the fresh immutable base and current revisions; preserve all prior releases and child pointer; refreeze identity constants only; AI delegated by `--auto-design`; challenger converged | ✅ Resolved |
| AR-P67 | Data & state (runtime) | Which guarded transition can select the fresh immutable base when the current stale parent cannot mint a normal incremental capability? | One-shot locked internal maintenance transaction / add public historical selector / raw pointer edit / stop | Exact hard-coded stale→fresh-base internal commit under full resolution, lock, snapshot and reconciliation guards, followed by normal public incremental publication; AI delegated by `--auto-design`; challenger converged | ✅ Resolved |
| AR-P68 | Behavioral gaps (runtime) | Why does the frozen Phase 7 campaign stop at policy validation before orchestration? | Correct cleanup grace to the fixed protocol value / weaken parser / bypass policy validation | Change only spec fixture `cleanupGraceMs` from 1,000 to 3,000, preserve assertions, rerun and refreeze; AI delegated by `--auto-design` | ✅ Resolved |
| AR-P69 | Behavioral gaps (runtime) | How does the complete 120-case component campaign enter the selector when the reviewed cheapest-obligation cap is 16 cases per rule? | Revisioned preselection / lexical truncation / raise cap / dedicated selected campaign | Initial v2 preselection ruling disproved by measured 22-stratum write rules and superseded by AR-P70 before execution | ✅ Superseded |
| AR-P70 | Behavioral gaps (runtime) | Which genuine selected Phase 7 campaign lets every case reach its cheapest tier while preserving v1 caps and broader Phase 5 evidence? | Dedicated 40-case two-spelling campaign / raise cap to 42 / truncate 120-case campaign / reduce four-spelling campaign below its coverage minimum | Genuine 40-case `literal|parameter` campaign with 16 invalid cases; exact per-rule totals 8/8/12/12 and strata 3/3/7/6; retain selector v1 and the separate 120-case component campaign; AI delegated by `--auto-design`; challenger converged | ✅ Resolved |
| AR-P71 | Behavioral gaps (runtime) | Why do the last two frozen Phase 7 assertions fail after four scenarios reach GREEN? | Use an actually uppercase hex seed and normalize Node Buffer bytes / distort CLI or serializer behavior | Replace digit-only uppercase no-op with `A`×64 and wrap report `readFile` bytes in `Uint8Array`; preserve assertions and refreeze; AI delegated by `--auto-design` | ✅ Resolved |
| AR-P72 | Data & state (runtime) | How is Phase 5 accepted local evidence restored after AR-P66 changes the exact selected parent identity while runtime bytes remain stable? | Repeat real sealed runs and refreeze identity-bound values / weaken identity binding / retain stale expectations | Require two matching real ACME/VICE runs, update only changed evaluation/route/result identities after proving source/binary/layout/usage/completion stability, then rerun again after final review; AI delegated by `--auto-design` | ✅ Resolved |

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

### AR-P38 — Runtime actual-observation authority join

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal cross-package runtime-evidence boundary; no language semantics, modeled
population, target, public CLI behavior or expected result changes.<br>
**Status:** Resolved.<br>
**Question:** Which exact opaque interface joins VICE's actual scalar/direct-MMIO observation to
the selected RD-03 host evaluator while keeping expected values out of rendered source, child
requests and producer evidence?<br>
**Grounding:** `ViceRouteRequestV1` carries only binary/layout/fixture/observation/policy and
`executeViceRouteV1` returns only `ExecutionResultV1`; neither transports evaluator authority or
actual observation. `ExecutionCaseV1` and `PublishedOracleContext` are opaque readiness-owned
authorities, so a structural callback or invented request shape would weaken the existing
authority boundary.<br>
**Decision:** `@blend65/readiness` mints a non-callable, module-private-`WeakMap`-backed
`PublishedRuntimeEvaluationAuthorityV1` from one genuine `ExecutionCaseV1` and selected
`PublishedOracleContext`. Its passive projection exposes only source identity, fixture,
observation, selected-release identity and evaluation identity. The readiness-owned evaluator
accepts one exact `RuntimeActualObservationV1`, consumes the authority before validating hostile
actual input, retains expected value/effect/final-memory truth only in private state and returns
only `match` or `semantic-mismatch`. `@blend65/readiness-execution` adds an evaluated VICE
entrypoint that authenticates projection equality, collects raw scalar/direct-MMIO bytes privately,
calls that evaluator exactly once and returns only the existing closed `ExecutionResultV1`.<br>
**Compatibility:** The Phase 4 `ViceRouteRequestV1` and `executeViceRouteV1` remain unchanged as a
non-authorizing control/observation substrate. Phase 5/7 route handlers and the selectable live
catalog may use only `executeEvaluatedViceRouteV1`; raw actual observations are never public return
values or publication evidence.<br>
**Rejected alternatives:** A caller-injected structural callback can manufacture success and is
not identity-bound. A public raw-actual evidence result is forgeable/replayable across an unowned
trust boundary and expands the API before any provenance-authentication requirement exists.<br>
**Strongest counterargument:** Public actual evidence would simplify replay and debugging.<br>
**Resolution:** Keep the same C-shaped record package-private and digest its authoritative facts;
add public replay only if a later requirement supplies a provenance authority instead of exposing
an unauthenticated structural value now.<br>
**Confidence:** High.<br>
**Hardening:** Independent design challenger recommended the opaque-authority design with the raw
actual record kept private, specifically preserving the Phase 4 compatibility surface and package
dependency direction.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** readiness cannot reproduce the selected runtime oracle from genuine execution
authority, or local debugging requires a provenance-authenticated replay artifact rather than the
bounded evidence digest.<br>

### AR-P39 — Valid simultaneous-budget oracle policy

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Specification-fixture correction that preserves the approved simultaneous budget
precedence and existing closed policy; no expected result or production behavior changes.<br>
**Decision:** Change ST-44's simultaneous-budget policy from `routeMs: 1` to `routeMs: 3001` while
retaining `cleanupGraceMs: 3000` and `wallStepMs: 2`. The usable work window remains exactly one
millisecond, so instruction, cycle and wall exhaustion still coincide and instruction exhaustion
must remain primary.<br>
**Evidence:** `parseExecutionPolicyV1` requires the fixed 3,000 ms cleanup reserve and rejects
`routeMs <= cleanupGraceMs`; the frozen value could never reach runtime precedence. `3001 - 3000`
recreates the intended one-millisecond work window through a valid policy.<br>
**Rejected alternatives:** Weakening the policy parser contradicts the approved cleanup reserve;
changing the expected result would remove the precedence oracle; lowering cleanup grace violates
the exact revision-one contract.<br>
**Confidence:** High; this is arithmetic preservation of the authored work window.<br>
**Hardening:** Root post-freeze audit compared the new oracle against the existing public policy
parser before production implementation relied on it.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** the corrected policy does not produce simultaneous instruction, cycle and wall
exhaustion under the fake monotonic clock.

### AR-P40 — Projected C64 read-case fixed answers

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Fixed-oracle correction restoring the already approved input projection; no
runtime rule, expected evaluator behavior or production API changes.<br>
**Decision:** ST-44's fixed `peek` answer is `F1` and fixed `peekw` answer is little-endian
`F1 F1`. The `poke` and `pokew` post-write answers remain `F0` and `F0 F0`.<br>
**Evidence:** Genuine `ExecutionCaseV1` fixtures seed logical `0x21` at the selected VIC cells.
`c64-vic-color-readback-v1` maps each cell to `0xF0 | (0x21 & 0x0F) = 0xF1`; direct evaluation of
the genuine selected cases returns 241 for `peek` and 61937 (`0xF1F1`) for `peekw`. Write cases
store a generated low nibble of zero and therefore correctly observe `F0` through the separate
post-write projection. The prior fixed read answers contradicted both 03-02's table and real target
semantics.<br>
**Rejected alternatives:** Changing the initial logical fixture to `0x20` removes the deliberate
non-zero nibble that makes a missing modeled write observable. Teaching production to accept `F0`
would contradict both the host evaluator and real VICE. Changing write answers would erase the
read-versus-write projection distinction.<br>
**Confidence:** High; arithmetic, genuine evaluator output and the documented projection converge.<br>
**Hardening:** The implementation owner stopped before coding around the oracle and reproduced all
four genuine cases through the selected host evaluator.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** real VICE 3.10 does not read back `F1` after writing logical `0x21`, or the
selected evaluator ceases to use the declared projected fixture.

### AR-P41 — VIC-aware fake fixture readback

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** CI-safe fake-control correction restoring the approved C64 input projection; no
production behavior or acceptance expectation changes.<br>
**Decision:** ST-44's fake monitor applies `projectC64InitialStateV1` when a write targets the
closed `$D020..$D022` fixture cells, stores the projected physical byte and then applies the
existing deliberate mismatch mutation after projection. Ordinary binary/RAM writes remain exact.<br>
**Evidence:** The fake stored raw `0x21` in a plain map and read raw `0x21` back, while the approved
target contract and real VICE read `0xF1`. Faithful production therefore rejected every happy case
at fixture establishment before entry.<br>
**Rejected alternatives:** Accepting raw `0x21` in production contradicts real hardware; changing
the fixture to `0x20` removes the deliberate non-zero-nibble signal; hard-coding `0xF1` duplicates
the projection table and can drift.<br>
**Confidence:** High; the shared projection function is the declared single source of target
semantics.<br>
**Hardening:** Implementation traced the first happy case to exact monitor frames before requesting
an oracle correction.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** the corrected fake differs from a real VICE write/read probe for any closed
fixture cell.

### AR-P42 — Suite-scoped authority fixture lifecycle

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Specification-fixture lifecycle correction; no authority freshness rule,
production cache or expected result changes.<br>
**Decision:** Retain one immutable suite-scoped `fixturePromise`, remove per-test cleanup and dispose
that fixture exactly once in `afterAll`. Every scenario still mints its own single-use runtime
evaluation authority. Do not cache expected oracle truth in production or make genuine authority
survive deletion of its reviewed backing files merely to support the test harness.<br>
**Evidence:** The first runtime test called `cleanup()` on the cached fixture, deleting its reviewed
authority root; later tests reused the same resolved promise and failed with `ENOENT` before the
runtime API. The fixture's context, campaign and execution cases are immutable; only the newly
minted evaluation authority is consumed per scenario. Rebuilding the reviewed fixture per test
would multiply the suite's dominant publication-validation cost across every repository gate.<br>
**Rejected alternatives:** One global fixture with repeated cleanup is invalid. Suppressing final
cleanup leaks test resources. Per-test reconstruction is correct but needlessly repeats immutable
authority preparation. Production memoization would hide stale/deleted authority and weaken the
freshness boundary to repair a test lifecycle bug.<br>
**Confidence:** High; suite ownership matches immutable fixture lifetime while preserving
single-use authority per scenario.<br>
**Hardening:** Root rejected the proposed production cache, then second-guessed the initially safe
per-test reconstruction against the measured publication-fixture cost and selected the smaller
suite-scoped lifetime.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** any scenario mutates shared fixture state, a test can observe another test's
consumed evaluation authority, or the suite fails to dispose its authority root exactly once.

### AR-P43 — One staged release for ST-44 context and campaign

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Specification-fixture provenance correction restoring the approved opaque
authority join; no production equivalence rule, selected semantics or expected result changes.<br>
**Decision:** The Phase 5 fixture creates its own staged oracle context through the existing public
publication/review seams, reads that staged release's `compiler-readiness-v1.json` bytes and builds
its runtime campaign from those exact bytes. It does not borrow the Phase 3 route fixture's context,
hash ambient repository inventory for the other side of the join, or modify the older fixture.
The suite-scoped cleanup removes this one authority root after all scenarios.<br>
**Evidence:** The mixed fixture reached `oracle.contract.invalid` at `/executionCase` before monitor
access because its context and campaign did not reproduce one selected published replay. Existing
diagnostic-authority fixtures deliberately pass staged release inventory bytes into their campaign
for the same equivalence invariant.<br>
**Rejected alternatives:** Weakening production's environment/replay/configuration/modeled-case or
source-content equality permits authority from one publication to bless a case from another.
Extending the frozen Phase 3 fixture creates cross-phase ownership. Retrying with ambient files
leaves the provenance mismatch nondeterministic under publication changes.<br>
**Confidence:** High; both authorities now derive from one content-addressed release.<br>
**Hardening:** Spec owner independently confirmed the smallest correction through public seams;
implementation retained the diagnostic-authority-grade join and stopped before monitor access.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** the context and campaign can name different inventory bytes or a staged release
mutation does not invalidate the join.

### AR-P44 — Advance-triggered simultaneous wall clock

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** CI-safe fake-clock correction preserving the approved simultaneous exhaustion
window and all expectations; no production budget or precedence changes.<br>
**Decision:** Keep the fake monotonic clock stable through lease, launch, handshake and fixture
setup. The fake ADVANCE event moves it by the scenario's existing two milliseconds immediately as
the full instruction chunk completes, so instruction, cycle and wall exhaustion are observed at the
same decision point. Retain `routeMs: 3001`, `cleanupGraceMs: 3000`, `wallStepMs: 2` and the
instruction-primary expectation.<br>
**Evidence:** Incrementing on every `nowMonotonicMilliseconds()` call exhausted the one-millisecond
work window during setup, before any ADVANCE or cycle sample, so the test did not exercise the
declared three-way precedence.<br>
**Rejected alternatives:** Enlarging the route budget makes setup call counts part of the oracle.
Changing the expected wall result removes precedence coverage. Delaying production checks weakens
real deadlines to suit a fake.<br>
**Confidence:** High; the clock now advances on the modeled resource-consuming event.<br>
**Hardening:** Focused ST-44 convergence separated fixture time modeling from three independent
production failures instead of reconciling the aggregate result.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** setup consumes simulated wall time or the corrected case does not record all
three exhausted totals at one terminal decision.

### AR-P45 — Three-sample fake stopwatch sequence

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** CI-safe fake-protocol correction preserving the existing public control API and
per-child delta rule; no production timing semantics or expectation changes.<br>
**Decision:** The fake text monitor provides three absolute samples: a handshake-validation sample,
the Phase 5 stopped-machine baseline and the post-ADVANCE sample. For the existing expected delta,
the latter two remain 100 and 160. Do not extend the control API with handshake timing or treat the
handshake probe as the execution baseline.<br>
**Evidence:** The low-level composite handshake legitimately consumes one stopwatch response.
ST-44 supplied only `[100, 160]`, so Phase 5 saw 160 as its baseline and the fake fallback returned
160 again, producing a zero delta. Real execution explicitly takes a fresh baseline after entry and
checkpoint setup.<br>
**Rejected alternatives:** Exposing handshake timing couples runtime accounting to connection
validation and samples too early. Adding 60 artificially in production ignores the absolute clock.
Weakening the cycle expectation loses the per-child delta proof.<br>
**Confidence:** High; three protocol reads require three absolute responses.<br>
**Hardening:** Implementation traced each text-monitor read and stopped before expanding the public
surface.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** real control no longer samples during handshake or Phase 5 no longer samples
immediately before execution.

### AR-P46 — Durable child identity in the cancellation fake

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** CI-safe raw-host lifecycle correction restoring the approved record-then-exec and
terminate-before-remove contract; no fabricated production identity or weaker cleanup rule.<br>
**Decision:** During fake spawn, the raw host durably replaces the exact lease with a checksummed
child record matching the attempt's generation, nonce, token, token path, endpoints and a fixed
positive boot/PID/start/group identity. `observeProcess` returns that exact fact while live;
compare-remove refuses the live child. Exact revalidated termination marks it absent, after which
the matching lease removal succeeds. The fake uses a spec-local independent encoder for the exact
record-v1 compact-JSON key order and payload-only SHA-256 contract back-propagated into 03-06; it
does not call or expose production's encoder. Production cleanup must observe/terminate a matching
live child under its private signal and remove only afterward.<br>
**Evidence:** The prior fake returned an owned control child but left the durable lease child null
and `observeProcess` always absent. No secure `ViceTerminationRequestV1` could be constructed, so
requiring a terminate call would force production to invent identity. The plan requires the launcher
to record identity before exec and runtime cleanup to terminate the owned child before clearing the
lease.<br>
**Rejected alternatives:** Unconditional termination fabricates PID authority. Removing a live
child's lease first abandons ownership. Dropping the terminate expectation removes cancellation
cleanup proof.<br>
**Confidence:** High; the fake now models the exact approved launcher lifecycle.<br>
**Hardening:** Implementation refused to signal without a durable child record; an independent
design challenger selected plan-visible canonical bytes plus a spec-local encoder over exposing the
production encoder or adding a mutation seam, preserving oracle independence and the root API.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** a cancellation case can remove the lease while its recorded child remains live,
or cleanup signals without matching record and process facts.

### AR-P47 — Module-constant intrinsic addresses block real acceptance

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Compiler-internal constant-recognition correction needed to execute the immutable
genuine Phase 5 cases; no source-oracle, public-language or frozen-spec change.<br>
**Decision:** Keep literal recognition, then accept only bare or qualified identifiers whose
resolved symbol is a scalar integer `constant` with an evaluated numeric `SemanticModel.constValues`
entry and no aggregate byte image. Reuse the existing symbol/constant lookup rather than rewriting
the typed AST or introducing a new lowering-time expression evaluator. Keep E10045 for module/local
runtime variables, missing/boolean/aggregate constant values and composed expressions such as
`ADDR + 1`; broader constant-expression support remains separate language work.<br>
**Evidence:** The mandatory local ACME/VICE run fails before VICE on the immutable generated source
`const modeledAddress: word = 53280; ... peek(modeledAddress)`. Frontend analysis already evaluates
module constants into `SemanticModel.constValues`, but codegen's `constAddress` accepts only a
`NumericLitExpr` and emits E10045 for the identifier. Literal-only use is an input-language
restriction with no output-quality benefit and contradicts the module-constant contract.<br>
**Rejected alternatives:** Rewriting constant references earlier would invalidate identity-keyed
typed-AST maps or require a new normalization stage. Generalizing constant-expression evaluation in
lowering would silently broaden syntax and error/range semantics beyond the blocker. Keeping the
literal-only restriction would force unidiomatic source with no machine-code benefit.<br>
**Confidence:** High; the semantic model already supplies the exact evaluated symbol value and all
four intrinsic emitters retain direct absolute locations.<br>
**Hardening:** An independent design challenger selected the narrow symbol-value seam and added the
integer-scalar/no-image guard because aggregate constant images also carry a numeric sentinel value.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** A module `const` address adds a runtime load/storage symbol, a non-integer or
aggregate constant is accepted as an address, or a runtime variable no longer receives E10045.

### AR-P48 — High-byte extraction from a computed word blocks `peekw`

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Compiler/codegen correction required by the immutable word-observation envelope;
no source-oracle, frozen-spec or expected-value change.<br>
**Decision:** Add a dedicated typed `high_byte dest, src` IL instruction for computed 16-bit
values. Preserve the compatible `load`/`store` opcode names but add an optional literal-true
`volatile` effect marker; centralized intrinsic helpers mark every `peek`, `peekw`, `poke` and
`pokew` memory operation. Volatile loads remain at their source sequence point. The adjacent
single-use `volatile word load → high_byte` pair fuses to exact low-then-high reads (`LDA source;
LDA source+1`), preserving both observable reads while leaving the high byte in A. Zero-use and
other volatile loads also execute fully; ordinary loads retain existing deferral. The printer
renders the volatile qualifier, while ordinary IL text and existing opcode-shape contracts remain
unchanged. Keep constants, address bytes, stored words and unsigned-byte handling unchanged and
retain the signed-byte rejection.<br>
**Evidence:** After AR-P47, the real `peek` case reaches VICE, but genuine `peekw` compilation fails
with E90001: `unsupported hi() of a computed 16-bit value node 'IntrinsicCallExpr'`. The envelope
records `memoryCase()` into a word-shaped observation and must publish its two bytes; lowering can
extract a stored word's high byte but rejects the computed word exposed by value substitution.
The existing `peekw` emitter already produces a word temporary and instruction lowering already
tracks per-byte homes for word temporaries, so materializing a general shift would risk code worse
than the expert byte-select idiom.<br>
**Rejected alternatives:** A synthetic frame slot adds RAM traffic and allocation ownership.
Shift-then-truncate emits roughly sixteen RMW instructions because no optimizer can recover a byte
select. Selecting only the deferred high-byte reference would erase the low read of volatile
`peekw`; the frozen oracle correctly refuted that initial optimization. Distinct volatile opcodes
would be stronger but break immutable specifications and typed IL fixtures that require the
compatible `load`/`store` names; a literal-true marker plus centralized constructors preserves both
compatibility and explicit effect semantics.<br>
**Confidence:** High; the corrected design exactly matches the manual volatile-read sequence with
no scratch, shift or address heuristic.<br>
**Hardening:** Independent review was challenged twice: first by the volatile full-word-read oracle,
then by immutable opcode compatibility. The final ruling covers zero-use, ordering, printer and
ordinary-versus-volatile cases explicitly.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** A `peek`/`peekw` read or `poke`/`pokew` write lacks the volatile marker, any
volatile byte is optimized away/reordered, or computed high-byte extraction introduces scratch,
shift or extra memory traffic beyond the expert sequence.

### AR-P49 — Effect-visible IL text versus immutable legacy goldens

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Additive diagnostic/printer compatibility decision; the volatile IL semantics and
immutable legacy specifications are both already authoritative.<br>
**Decision:** Add an optional `PrintILOptions` parameter to the existing single renderer:
`printIL(program, { exposeEffects: true })`. Default, empty-options and explicit-false calls retain
the byte-identical legacy dialect. Effect-aware mode renders `volatile` for marked loads/stores and
leaves ordinary operations unchanged. Export the options type through the existing IL/package
barrels; do not change compiler/CLI callers in this compatibility repair. Thread one resolved
boolean through the same renderer rather than create a second implementation.<br>
**Evidence:** AR-P48's effect semantics and focused tests are green, but the full codegen suite has
seven failures because existing immutable tests require exact legacy strings such as
`store 5, $D020`, while unconditional rendering produces `store volatile 5, $D020`. Editing those
oracles is forbidden and hiding the marker by target-address heuristic would make printer behavior
incomplete and misleading.<br>
**Rejected alternatives:** A second printer API creates a parallel dialect that can drift. Structured
IL alone leaves semantic effects unavailable to textual audit/snapshot tooling. Unconditional
qualifiers violate the immutable compatibility contract.<br>
**Confidence:** High; every current caller passes one argument, so the optional mode preserves source
and output compatibility while making effects explicit on demand.<br>
**Hardening:** Independent API/caller review selected the additive option and required determinism,
non-mutation, default/empty/false parity and public-barrel coverage.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Default `printIL` bytes change, effect-aware output hides a marked access, or the
two modes mutate/share state such that call order changes output.

### AR-P50 — Folded address expressions block the computed `pokew` case

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Compiler semantic-model/codegen correction required by the immutable genuine
computed-address case; no oracle, generated-source or frozen-spec change.<br>
**Decision:** Add a frontend-populated, use-site-specific semantic fact map
`constantIntrinsicAddresses: ReadonlyMap<IntrinsicCallExprNode, number>` to `SemanticModel`, following
the existing `forLoopInfo` precedent. During fully typed intrinsic-call analysis, record a fact only
for `peek`/`peekw`/`poke`/`pokew` when the address argument has a primitive integer type, the existing
frontend evaluator returns a numeric constant through constant-symbol/type/intrinsic resolvers, and
the result is a safe integer in `0..0xffff`. Nonconstant, poisoned, divide-by-zero, boolean,
aggregate-image and out-of-range inputs record no fact and emit no new diagnostic there; lowering
remains the single E10045 owner. Codegen defensively validates the fact and otherwise retains its
literal/named-constant paths, then uses the existing absolute-location emission unchanged.<br>
**Evidence:** After AR-P47–AR-P49, real `peek`, `peekw` and `poke` compile and execute, but the genuine
computed `pokew` case fails E10045 because `constAddress` accepts literal or constant-symbol nodes,
not a `BinaryExpr`. The generated address is a module `const` plus literal and frontend constant
evaluation already supports binary expressions with resolved constant references. Rewriting the
immutable case or accepting runtime expressions is forbidden.<br>
**Rejected alternatives:** A general constant-expression query/map creates a broader completeness
and lifecycle contract than needed. Exporting the evaluator makes codegen reconstruct frontend
resolver policy and risks drift around poisoned references and query intrinsics. AST normalization
erases source structure relied on by downstream identity-keyed maps. Keeping expression rejection
would make the mandated computed case inexpressible despite an already-proven compile-time value.<br>
**Confidence:** High; the fact is produced at the one fully typed use site with complete frontend
context and consumed through the existing absolute-address path.<br>
**Hardening:** Independent semantic/API/lifecycle review introduced the narrower intrinsic-call fact
map over the three broader candidate designs and fixed the exact presence/range/type contract.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** A runtime/poisoned/out-of-range expression gains a fact, a valid constant address
expression lacks one, or codegen emits anything other than literal-equivalent absolute access.

### AR-P51 — Post-build route binding versus the frozen fake-host contract

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Security/correctness repair required by independent Phase 5 review; the user has
delegated design decisions, while immutable specification oracles and the production trust boundary
remain fixed.<br>
**Decision:** Add an opaque one-shot post-build binding capability that binds the genuine published
runtime-evaluation authority to the exact finalized route before production monitor access. The
binding commits to source/evaluation identity, binary digest and load/entry addresses, observation
layout proof, fixture/observation projection, policy and participating handler identities available
at this layer. The default production runtime and exported production facade require that bound
capability and reject missing or cross-paired binary/layout/entry identity before allocating endpoints
or opening monitor control. Preserve immutable ST-44 through its explicitly injected, caller-owned
host seam only: an unbound authority may exercise that isolated host because it has no production
process or monitor authority, but it must remain one-shot and fixture/observation-bound. Do not add a
boolean bypass, ambient fallback or production-host compatibility path.<br>
**Evidence:** Independent review proved that `{ route, evaluation }` currently joins two genuine but
unrelated inputs: authority construction precedes build/layout, and the runtime checks only fixture
and observation shape. A different binary with the same shape can therefore receive the original
case digest and potentially pass. Frozen ST-44 intentionally uses a synthetic one-byte RTS plus an
injected fake host, so requiring post-build production identity on that isolated seam would rewrite
the immutable oracle without improving the real trust boundary.<br>
**Rejected alternatives:** Trust-on-first-use authenticates only replay, not provenance. Rebuilding
inside the runtime duplicates the compiler worker and still lacks the accepted build identity.
Allowing unbound production execution preserves the vulnerability. Editing ST-44 violates the
specification-first immutability contract. A public bypass flag can leak into production and is
therefore forbidden.<br>
**Confidence:** Medium-high; the additive binder closes the real monitor boundary while preserving
the already-frozen fake-control oracle, but its exact field vocabulary must reuse existing canonical
identity serializers rather than create a parallel digest dialect.<br>
**Hardening:** The correctness reviewer supplied the cross-paired-route counterexample, and the
implementation executor independently stopped when it proved that pre-build authority cannot derive
binary/layout/entry authenticity. The ruling narrows compatibility to an injected caller-owned host,
not merely a test mode.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Any default/production path accepts unbound authority, a bound field can change
without rejection before monitor access, or the injected-host compatibility seam can acquire a
production process/monitor capability.

### AR-P52 — Genuine build provenance for production evaluated VICE

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Security/correctness closure of independent finding RV-002; the existing raw-route
binder was proven trust-on-first-use and cannot remain in production.<br>
**Decision:** Remove public raw-route minting. Add one sealed asynchronous production preparation
path inside `readiness-execution` that accepts only a genuine execution case, its one-shot published
evaluation authority, a closed policy and cancellation. It renders from genuine case authority,
runs the default worker under the default supervisor, retains/revalidates assembly, invokes supervised
ACME, reads the exact PRG/labels/report through pinned workspace descriptors, derives load/entry and
the observation layout from those artifacts plus a strictly validated worker-produced allocation
range projection, then mints an opaque one-shot bound request from private state. No public
`BuildResult`, route, binary, address, layout or handler array can mint authority. Pull forward only a
private fixed evaluated-VICE handler-set capability/revision tuple needed by this sealed path; Phase 6
must reuse and freshness-bind it when building the complete six-handler generated catalog rather than
introduce a second identity dialect. The bound request no longer structurally exposes the raw request.
Default production accepts only the sealed capability. An injected caller-owned coordinator rejects
sealed production capability and accepts only its isolated unbound one-shot request, preserving
frozen ST-44 without a production bypass.<br>
**Evidence:** Closure review showed the prior binder merely hashed caller-supplied binary/load/entry/
layout fields and then registered them; its own implementation test successfully blessed a synthetic
one-byte RTS. The existing genuine artifact chain already exists in the worker, supervisor, pinned
workspace and ACME adapter, but currently records and discards PRG/label/report bytes. The emit worker
also observes the compiler allocation plan but does not return the bounded data-range projection
needed by the layout proof.<br>
**Rejected alternatives:** Hashing a raw `BuildResult` or route remains TOFU. Minting inside
`createExecutionRouteHandlersV1` is invalid because that factory accepts injected worker, ACME,
supervisor and VICE implementations. Rebuilding in the VICE runtime duplicates resource ownership.
Pulling the whole Phase 6 publication/catalog forward violates specification-first order; disabling
all production execution would fail the Phase 5 real-authority deliverable. The narrow private
handler-set capability closes current provenance and deliberately becomes a Phase 6 dependency.<br>
**Confidence:** Medium-high; the trusted artifact chain is already implemented and independently
tested, but factoring it to return private artifacts must preserve every existing budget, inode,
cleanup and failure-classification guarantee.<br>
**Hardening:** The original correctness reviewer rejected trust-on-first-use after the first AR-P51
repair. A demanding executor then traced every existing mint candidate and refuted the public adapter
factory, raw `BuildResult` and pre-catalog handler-array alternatives before recommending the sealed
default path.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Caller-supplied build/layout data can mint authority; injected dependencies can
mint or consume production authority; any artifact changes after validation without rejection; the
worker layout basis is unbounded/malformed; or Phase 6 creates a competing handler identity dialect.

### AR-P53 — Exact identity capture for short-lived supervised tools

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Linux process-supervision correctness repair discovered by the mandatory real ACME
acceptance run; the existing exact non-null process-identity contract remains authoritative.<br>
**Decision:** In the dedicated Linux anchor, install completion and stream listeners, capture the
allocated child PID, and synchronously read the boot ID plus `/proc/<pid>/stat` immediately after
`spawn()` returns and before any `await` or event-loop yield. Then await the normal Node spawn/error
result and discard the captured identity if spawn reports an error. Preserve the existing exact
non-null target identity and authenticated anchor protocol. If an allocated PID encounters a
post-spawn identity or cancellation failure, terminate the anchor-owned group, prove the
excluding-anchor group empty, and escalate to group KILL when absence cannot be proven; never rely
on `child.kill()` alone.<br>
**Evidence:** Real sealed ACME preparation exposed `ESRCH` because ACME can exit between Node's
`spawn` event and the later asynchronous procfs read. An independent pinned-Node-22 challenge ran
2,000 `/bin/true` launches per strategy: the current wait-then-async read failed 2,000/2,000,
an immediate async read also failed 2,000/2,000, and the immediate synchronous read failed 0/2,000.
The focused repository regression then retained a non-null exact identity across eight consecutive
real short-lived launches.<br>
**Rejected alternatives:** A terminal-before-identity state weakens positive identity into nullable
public evidence and expands the authenticated protocol. Merely starting the asynchronous read
earlier retains the race. A fixed wrapper/handshake is a viable fallback but adds another trusted
executable and protocol, startup cost, signal/exit forwarding and a wrapper-versus-tool identity
distinction that the narrow host-local repair avoids.<br>
**Confidence:** High; the behavior is confined to the already Linux-specific dedicated anchor,
grounded in the pinned Node 22 runtime and guarded by a real short-lived-process regression.<br>
**Hardening:** An independent design challenger rejected the initial terminal-before-identity
ruling after measuring all three capture strategies. The superseded nullable protocol patch was
fully removed before final acceptance.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** A successfully spawned short-lived target lacks exact identity, a spawn error
can retain captured identity, procfs capture yields before reading, or a post-spawn failure can
return without proving the anchor-owned descendant group absent.

### AR-P54 — Route-wide budget and cleanup continuity across sealed preparation

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Correctness closure of independent findings RV-004 and RV-005; the plan already
requires one cumulative route lifecycle and cleanup evidence that never hides behind an earlier
failure.<br>
**Decision:** The sealed build retains a private baseline containing the supervisor's original
absolute start/work/hard deadlines, cumulative output/evidence usage and build-evidence digest.
Only after cleanup is positively confirmed may that baseline enter the opaque one-shot request.
Bound VICE execution uses the original absolute deadline, so a later caller signal can shorten but
never restart or extend the route. Its public result adds build output/evidence and elapsed wall time
from the original start to VICE launch/instruction/cycle usage; final evaluation evidence
domain-binds the build-evidence digest and charges its retained bytes against the remaining route
allowance. The isolated injected-host compatibility path retains its current-start, zero-build
baseline. Preparation always reports cleanup failure: after a successful operation it becomes the
terminal cleanup failure, while after an operational failure it is appended as bounded cleanup
evidence with the operational issue kept first.<br>
**Evidence:** Independent closure review showed that preparation spent the full selected policy in
one supervisor, disposed it, sealed the original unspent policy and let VICE start a second full
deadline and byte allowance. It also showed that a failed operation plus failed supervisor cleanup
returned only the operational issue even though a worker, process or workspace could remain.<br>
**Rejected alternatives:** Treating preparation and VICE as separate routes contradicts the
route-wide budget contract and understates public evidence. Requiring callers to reuse one
`AbortSignal` is neither sealed nor sufficient for output/evidence continuity. Keeping a live
supervisor across the public prepare/execute gap expands resource lifetime and gives the opaque
request unnecessary mutable ownership; a sealed immutable baseline preserves the required
continuity with less authority.<br>
**Confidence:** High; this is a direct preservation of the existing route-wide deadline, evidence
and cleanup semantics across the newly introduced sealed seam.<br>
**Hardening:** The original correctness reviewer supplied both counterexamples after closing the
raw-route provenance finding. Focused tests cover delayed execution, reduced remaining byte
allowances, cumulative public evidence, non-extending caller cancellation and dual operational plus
cleanup failure reporting.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Any bound execution restarts wall/output/evidence allowances, omits build usage
or evidence identity, a caller extends the sealed deadline, or cleanup failure is discarded on any
operational outcome.

### AR-P55 — Canonical ACME report source identity in sealed evidence

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Determinism repair discovered by repeating the mandatory real sealed route; raw
ACME report semantics and the generic adapter's byte-for-byte evidence behavior remain fixed.<br>
**Decision:** The production-sealed ACME profile validates that the report's single source header
names the exact retained assembly descriptor path used for invocation, then replaces that complete
validated header with one fixed domain-tagged byte string only for evidence hashing. Parsing,
instruction/layout proof and passive artifact reads continue to use the raw descriptor-read report.
The generic ACME adapter continues to hash raw bytes. Near matches, unexpected or multiple source
headers fail closed. Canonicalization replaces the whole header rather than zeroing digits in place,
because PID and descriptor digit widths are themselves volatile.<br>
**Evidence:** Two semantically identical real builds produced different build/result digests because
ACME writes `; ******** Source: /proc/<child-pid>/fd/<fd>` into `main.report`; the PID and descriptor
are lifecycle facts, not compiler evidence. Semantics and cumulative usage remained identical.<br>
**Rejected alternatives:** Hashing raw report bytes preserves host-scheduling nondeterminism.
Length-preserving digit replacement still varies when PID or descriptor widths change. Excluding the
whole report loses instruction/layout evidence. Rewriting the retained artifact would violate raw
artifact identity and parsing provenance.<br>
**Confidence:** High; the normalization is limited to one positively validated non-semantic header
and is tested across differing digit widths.<br>
**Hardening:** The initial digit-zeroing proposal was refuted before acceptance because it retained
variable header length; the final ruling requires a fixed replacement and hostile-header tests.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Equivalent sealed builds differ only because of the report source descriptor,
an unvalidated header is normalized, raw parsing stops using the descriptor-read bytes, or generic
adapter evidence changes.

### AR-P56 — Implementation-blind execution-publication oracle contract

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal persistence, testability and authority-containment design inside the
approved child-publication mechanism.<br>
**Decision:** Keep the planned public APIs unchanged and add package-private conformance seams plus
independent specification fixtures. The passive child uses canonical UTF-8 JSON, one LF and exact
closed shapes recorded in `03-03`. Child-unique members are `execution-manifest-v1.json`,
`execution-parent-v1.json`, `execution-bindings-v1.json` and
`execution-semantic-review-v1.json`; this avoids broadening the immutable historical
publication-v1 literal family. Member digests are raw SHA-256, binding revisions domain-separate
`blend65-execution-binding-v1`, and release digests domain-separate
`blend65-execution-publication-v1`. Passive failures use `execution.invalid-schema` for closed-shape,
ordering and value errors, `execution.stale-authority` for content/review/parent/catalog mismatch,
`execution.identity` for forged opaque capabilities or digest mismatch, `execution.io` for bounded
filesystem failures and `execution.reconciliation` only when state cannot be classified safely;
the issue path names the first rejected field or member.

The exact readiness owners are `execution-publication-model.ts`,
`execution-publication-resolver.ts`, `execution-publication-transaction.ts`,
`execution-publication-pointer.ts` and `execution-publication-conformance-v1.ts`. Their distinct
literal family is `readiness/execution-publications`, `current-execution-publication.json`, the four
child-unique member names, `execution-publication-v1` and corresponding constant identifiers. The
historical `readiness/publications` validator and its eight-owner set remain byte-identical. The
exact readiness-execution owners are `execution-publication-catalog.ts`,
`execution-handler-catalog.generated.ts` and
`execution-publication-catalog-conformance-v1.ts`; only generated-catalog path/domain identifiers,
not the shared six tier words, form its literal family.

`runWithExecutionPublicationConformanceV1` is package-private `AsyncLocalStorage` over the closed
fault points `after-member-sync`, `after-staging-sync`, `before-review-validation`,
`after-review-validation`, `before-release-rename`, `after-release-rename`,
`after-releases-sync`, `before-pointer-write`, `after-pointer-file-sync`,
`before-pointer-rename`, `after-pointer-rename`, `after-pointer-directory-sync` and
`during-reconciliation`, with bounded passive reconciliation observations. The package-private
catalog seam exposes defensive participant/dependency metadata and can replace exactly one
dependency byte during an operation; it exposes no handler, registration or authority mint. The
catalog authority is generated TypeScript. Specification fixtures independently encode bytes and
copy the committed four-row parent
`sha256:41afbb4512456470e0b182fb14edb5caeaac7688d7e36ba1e102fc8d42ae3403` and fresh nine-row parent
`sha256:8f27564485518a6addbab549ab75c85bbf19a3cc976ec9de61ea4d04a55bf597`
into isolated repositories. `resolvePublishedSnapshotByDigest` is the approved parent-capability
constructor; opaque child/composite/live capabilities have no structural substitute.<br>
**Evidence:** Both implementation-blind Phase 6 authors independently stopped before guessing the
same missing wire, fixture and fault contracts. Existing publication-v1 already uses scoped
package-private conformance and generated TypeScript revision authority.<br>
**Rejected alternatives:** Public builders or fault hooks enlarge the authority surface; public
serializers and metadata accessors make internal wire machinery a permanent API. Reusing generic
`manifest.json` and `semantic-review-v1.json` weakens the historical path-family separation.<br>
**Confidence:** High.<br>
**Hardening:** An independent challenger selected the package-private seam, required independent
fixtures and recommended generated TypeScript. Its proposal to treat the six shared tier words as
catalog-only literals was narrowed because those words legitimately occur throughout execution
production; only catalog-specific domains and paths are confined.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** A spec requires implementation inspection, a conformance seam can mint or
register live authority, historical publication boundary bytes change, or a child artifact can
resolve without exact canonical review/parent/catalog reconstruction.

### AR-P57 — Live-gated child selection ownership

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal cross-package authority handoff required to satisfy the already-approved
freshness-at-selection rule.<br>
**Decision:** Move public `selectExecutionPublicationByDigestV1` to
`@blend65/readiness-execution`. Readiness retains only a package-private durable selection primitive
that accepts a closed synchronous freshness callback. The live package resolves the exact passive
release, pins and validates its fixed generated closure, enters the transaction and revalidates the
same closure through that callback immediately before pointer rename. Any change aborts with the
old pointer intact. No public passive selector or pre-minted freshness proof exists.<br>
**Evidence:** Readiness cannot import the live catalog without reversing the package dependency;
two separate public calls leave a time-of-check/time-of-use window before pointer replacement.<br>
**Rejected alternatives:** A minted opaque proof can stale after minting; independent freshness and
selection calls cannot meet the immediate revalidation requirement.<br>
**Confidence:** High.<br>
**Hardening:** An independent challenger selected live-package ownership and required the exact
pre-commit callback.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Readiness gains a dependency-safe way to verify live closures itself, or any
selection path can replace the pointer without same-transaction live-catalog revalidation.

### AR-P58 — Exact modeled rule projection in the composite oracle

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Correction of a specification-fixture contradiction against the already-approved
pure planner contract; product scope and execution semantics remain unchanged.<br>
**Decision:** The composite projects exactly AR-P1's nine selected modeled rules. It joins each
modeled fact to the exact parent inventory row for reviewed `applicability` and
`evidenceObligations`, and returns only
`{ruleId,applicability,evidenceObligations,boundaryFamilyIds}`. The boundary list is the single ID
already derived by campaign projection: `boundary.scalar.<scalarType>` for the five scalar facts or
`boundary.memory.<intrinsic>` for `peek`, `peekw`, `poke` and `pokew`. Rows and both string sets are
lexical, unique and immutable; missing, duplicate or incompatible facts fail closed. The Phase 6
fixture independently encodes the fixed nine rule IDs/kinds and derives that projection from parent
bytes. It does not import production mapping code.<br>
**Evidence:** The first RED fixture incorrectly returned all 2,112 raw inventory rule objects, while
`CompositeReadinessProjectionV1` and the Phase 1 planner strictly accept only the four-field shape
and require non-empty boundary IDs. The selected parent has zero raw `boundaryFamilies` across all
2,112 rows, so direct field renaming cannot satisfy the planner. AR-P1 already limits RD-04 to nine
modeled rules, and readiness's campaign projection already derives the exact boundary vocabulary
from the same modeled facts.<br>
**Rejected alternatives:** Expanding the planner to raw inventory couples it to unrelated evolving
authority and breaks strict input validation. Passing extra fields is a type lie. Projecting every
inventory row would invent boundary IDs for 2,103 unmodeled rules and absorb RD-08 scope.<br>
**Confidence:** High.<br>
**Hardening:** An independent challenger required preservation of the four-field contract and
identified the non-empty-boundary risk; repository measurement then proved the raw parent cannot be
mapped directly and AR-P1 supplies the exact selection predicate.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** The modeled fact set changes revision, a fact lacks an exact parent rule, a
campaign boundary ID is not present in the composite row, or unmodeled inventory rules enter the
Phase 7 planner without a new scope decision.

### AR-P59 — Isolated parent-authority fixture materialization

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Test-fixture provenance correction required to exercise the unchanged hardened
parent resolver.<br>
**Decision:** Both Phase 6 isolated repository fixtures copy only four exact allowlisted authority
roots from the checked-out repository: `readiness/`, `spec/`, `packages/readiness/src/` and
`packages/readiness/package.json`. Before copying they recursively reject symbolic links and
non-regular/non-directory nodes, cap the union at 512 files and 64 MiB, and then copy into a fresh
per-test temporary root while excluding `readiness/execution-publications`, `dist`, `node_modules`
and other workspace output. Parent releases
remain byte-identical; the real resolver reads only its generated lexical dependency closure.
There is no production fixture bypass and no duplicated implementation-owned path list in the
specification.<br>
**Evidence:** The unchanged parent resolver correctly rejected the initial publication-only temp
root because `<fixture>/packages` and oracle authority were absent. The allowlisted source contains
366 files and about 32 MiB at the ruling point, inside the fixed cap.<br>
**Rejected alternatives:** Embedding roughly one hundred generated paths duplicates
implementation-owned closure knowledge and drifts with legitimate dependency changes. A resolver
bypass defeats the provenance property under test. Copying the repository root is overbroad.<br>
**Confidence:** High.<br>
**Hardening:** An independent challenger selected bounded authority-tree copying and required
symlink/special-file rejection plus explicit exclusion of build/dependency output.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** The allowlisted authority exceeds either bound, the parent resolver needs a new
root, a copied special node is accepted, or resolution reads any file outside its generated
closure.

### AR-P60 — Refresh stale selected parent before child publication

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Runtime authority correction required by the already approved content-fresh parent
invariant; no product-scope or public-interface choice.<br>
**Decision:** Rebuild the nine-binding parent from the still-fresh immutable four-binding base and
the current five generated oracle revisions, accept it using the completed Phase 3 semantic-review
closure, and select
`sha256:8f27564485518a6addbab549ab75c85bbf19a3cc976ec9de61ea4d04a55bf597`
before preparing any execution child. Existing parent releases remain byte-identical. Phase 6
fixtures exercise the fresh four-binding and refreshed nine-binding shapes; the superseded
nine-binding release remains immutable evidence but correctly fails executable freshness after its
dependency closure changed.<br>
**Evidence:** Both the checked-out repository and the bounded fixture rejected the previously
selected nine-binding parent at `/bindings/3`: Phase 3 commit `4e7a60f` regenerated all five oracle
implementation revisions, while its selected parent still serialized the older revisions. The
four-binding base resolves against current authority, and the incremental publication transaction
reproduced and selected the refreshed nine-binding release without editing either prior release.<br>
**Rejected alternatives:** Weakening parent freshness would permit stale executable handlers.
Treating the fixture as exceptional would hide the same failure in the real repository. Rewriting
the old release would violate immutable publication identity.<br>
**Confidence:** High.<br>
**Hardening:** The ruling follows the existing immutable incremental-publication path and was
validated against both real and isolated resolution; no new mechanism or bypass was introduced.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** The refreshed parent fails exact candidate freshness, any prior release byte
changes, or child preparation can name the superseded stale parent.

### AR-P61 — Phase 6 authority, durability and generated-closure quality closure

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Mandatory correctness, security and performance repairs within the approved child
publication scope after independent Phase 6 review.<br>
**Decision:** Retain `@blend65/readiness/execution-publication-internals` as a defensive passive
descriptor accessor that accepts a genuine opaque release and exports no raw commit, selection or
freshness callback. The relative internal transaction remains available solely to the frozen
readiness conformance specification. The operational durable selector is co-located in
`@blend65/readiness-execution`, reachable only through public
`selectExecutionPublicationByDigestV1`, so the live owner performs the final catalog guard and
pointer rename itself. All authority owner gates compare normalized package-relative paths and
reject absolute, traversing or duplicate records.

Review acceptance joins `specRevision` to the exact parent inventory revision. Passive preparation
accepts any exact fresh named parent so immutable historical candidates remain reproducible; the
authority-bearing final commit alone requires that parent to be the currently selected exact fresh
parent. Child resolution uses canonical
containment and a pinned repository/readiness/publication/releases/release ancestor chain, verifies
that chain around reads and parent-resolution awaits and before minting, and permits exactly one
complete retry only when a private verified selected-pointer replacement marker proves a concurrent
pointer change. Inputs are bounded before their byte arrays are copied and are snapshotted once.

Selection performs all asynchronous fault hooks, directory validation, bounded catalog scanning and
pointer-file synchronization before a final synchronous commit section. That section rechecks the
already pinned secure catalog snapshot, selected-parent pointer, exact child directory/member
identities and bytes, and retained temporary pointer inode and bytes, then invokes the rename
syscall without an intervening await or callback. The renamed pointer must retain that exact inode
and bytes. Post-rename directory synchronization is retried to a closed bound; a visible pointer
without proven directory durability never resolves as success and returns
reconciliation-indeterminate instead. Success returns a newly resolved selected-child authority,
not the precommit passive object. Cleanup failures are retained as diagnostics rather than
discarded.

The generated handler catalog is derived with a real JavaScript/TypeScript module parser, including
literal dynamic imports and `new URL(..., import.meta.url)` runtime assets. Its explicit roots cover
the live handler plus worker, process-anchor and VICE-launcher entries, and its identity binds the
emitted distribution JavaScript/assets Node executes. Generation is a deterministic
build→generate→build→check cycle with no self-digest. The live freshness scan opens every emitted
dependency through descriptor-backed no-follow/nonblocking reads, requires a single-link regular
file inside the canonical distribution root, reverifies inode identity, and applies file-count,
per-file and aggregate-byte bounds. One unique scan/hash result is shared by all six rows and the
final guard; mutation conformance copies only its target file.

Inspection pins and revalidates the complete repository/readiness/publication/releases chain,
lstat-validates every bounded release, staging and pointer-temporary entry, diagnoses malformed
digest names, links, special nodes and cleanup residue, and never treats a selected name as healthy
without release validation. The historical publication owner set stays unchanged while
its complete-source implementation gate explicitly recognizes the new isolated owners. Full
noncoverage specifications remain mandatory; branch coverage at or above 90% is measured on the
new publication/catalog cores with focused implementation/conformance runs rather than combining
V8 coverage with the large copied-authority end-to-end fixture. Full repository verification still
runs before commit.<br>
**Evidence:** Independent correctness, security and performance review found a review-revision join
gap, an async freshness window, basename-only owner checks, unproven post-rename durability,
incomplete ancestor pinning and inspection, regex-only source closure, path-following catalog reads,
duplicate scans and a pathological readiness coverage run. The instrumented full readiness worker
reached about 3.97 GiB RSS after fourteen minutes without completing, while the same frozen suite
was bounded in its noncoverage run.<br>
**Rejected alternatives:** Exporting a raw cross-package commit subpath preserves an avoidable
authority surface. An async callback immediately before rename still admits an event-loop turn.
Treating a visible renamed pointer as committed ignores directory durability. Regex source closure
cannot prove runtime edges, and source-byte hashes do not identify emitted code. Weakening the
coverage threshold or omitting full noncoverage specifications would hide rather than fix the
instrumentation pathology.<br>
**Confidence:** High.<br>
**Hardening:** Every independent major/security/performance finding is accepted as mandatory; the
operational authority is narrowed while the passive frozen interfaces remain compatible.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Any raw commit primitive becomes package-exported, a yield can occur between the
final guard and rename, directory durability is inferred from visibility, a dependency/runtime edge
is unresolved, a path-following catalog read is reintroduced, or focused core branch coverage falls
below 90%.

### AR-P62 — Isolate live execution from the broad readiness barrel

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Runtime dependency-authority correction within the approved fixed-handler catalog;
no product scope or public execution semantics change.<br>
**Decision:** Add the minimal `@blend65/readiness/execution-runtime` subpath containing only the
leaf runtime values required by the four generated execution roots. Live runtime modules import
those values directly and retain root-package imports only for erased types. The generator must
reject any closure containing the readiness root index or `node_modules/typescript/**`, continue to
fail closed on unresolved runtime edges, and bind every reached third-party runtime module together
with its package manifest/export map under the secure count and byte bounds. This authority change
requires publishing and selecting one new reviewed parent before the child fixtures can be
refrozen; prior releases remain immutable. The selected refreshed parent is
`sha256:8f27564485518a6addbab549ab75c85bbf19a3cc976ec9de61ea4d04a55bf597`.<br>
**Evidence:** Binding the readiness root barrel instantiated unrelated boundary tooling and reached
TypeScript's nonliteral plugin loader even though no live handler calls that API. A call-site
allowlist would silently turn unresolved executable edges into generator policy. The leaf subpath
removes the accidental graph while keeping the generator fail-closed.<br>
**Rejected alternatives:** Allowlisting TypeScript's nonliteral `require(modulePath)` cannot prove
the target bytes. Binding the whole dependency tree is overbroad and still cannot bind an arbitrary
plugin path. Retaining the broad barrel preserves authority for code the fixed handlers never use.<br>
**Confidence:** High.<br>
**Hardening:** An independent challenge selected the leaf subpath and required both generated-graph
negative assertions and a reviewed parent refresh rather than weakening runtime-edge validation.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** A live emitted root imports a runtime value through `@blend65/readiness`, the
generated closure reaches the readiness index or TypeScript, or a reached third-party executable or
package manifest is not bound.

### AR-P63 — Operation-scoped orchestration conformance

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Deterministic specification observability inside the approved orchestration,
command and durable-report contracts; no public API, product-scope or authority change.<br>
**Decision:** Add one package-private `execution-orchestration-conformance-v1` module backed by an
operation-scoped `AsyncLocalStorage`. It accepts only deeply copied, frozen and bounded declarative
controls: single-use closed handler-result substitutions keyed by exact planned execution identity
and tier, normalized capability facts without executable paths, and a closed set of report fault
points spanning temporary creation/write, file synchronization, pre/post rename, directory
synchronization and reconciliation. Substituted results must pass the normal closed
`ExecutionResultV1` validation and can prove only orchestration aggregation and serialization;
the frozen Phase 5 evaluator oracle remains the proof that actual runtime observations reach the
genuine selected oracle comparison. The seam never receives an expectation, opaque authority,
live handler, raw observation callback or caller-selected path.
Duplicate, unmatched or unused substitutions reject. Nested scopes reject, all work and cleanup
settles before scope return, and observations are returned only as a bounded frozen transcript.
The module is absent from the root barrel and package exports, production behavior without a scope
uses genuine handlers, probes and filesystem operations, and the six-handler generated authority
closure must not reach the conformance module. Prefer one package-private module instance; use the
repository's established global singleton bridge only if source/build dual loading otherwise
splits the async scope.<br>
**Evidence:** Phase 7's immutable oracle must deterministically force a semantic mismatch, all five
CLI exits and post-rename report reconciliation. The declared public signatures expose no ports,
and black-box host mutation cannot prove those states without real-tool and filesystem races. The
accepted publication conformance modules already use operation-local `AsyncLocalStorage` outside
public barrels.<br>
**Rejected alternatives:** Public dependency ports enlarge production authority and change the
approved API. Subprocess/environment/filesystem manipulation alone is nondeterministic for
semantic mismatch and post-rename reconciliation. A private explicit kernel can supplement
implementation tests but cannot prove the declared public wrappers by itself.<br>
**Strongest counterargument:** Hidden async state can leak across nested work or split across
source and built module instances.<br>
**Confidence:** High.<br>
**Hardening:** An independent challenger selected the package-private operation scope and required
declarative-only controls, single-use identity binding, return-only observations, nested-scope
rejection and exclusion from live-handler authority.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** A control can bypass genuine planning, is used as proof of evaluator behavior,
mint or receive live authority, alter behavior outside its async scope, escape through package
exports, or enter the generated six-handler closure.

### AR-P64 — Genuine campaign report identity

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Minimal passive identity projection required to populate the already approved
canonical report; no campaign semantics, caller input or product scope change.<br>
**Decision:** Add a dedicated `@blend65/readiness/execution-campaign-identity` subpath exporting
`getPreparedCampaignExecutionIdentityV1(campaign)`. It authenticates only through the existing
private prepared-campaign state and returns a new deeply frozen
`{revision:'prepared-campaign-execution-identity-v1',campaignDigest,seed,target}` value. Structural
copies and forged summaries reject. It exposes no configuration, dependencies, cases, callbacks or
execution authority. The orchestrator must join `campaignDigest` to
`projectExecutionCampaignV1(campaign)`, require `target` to equal the fixed orchestration target and
serialize `seed` verbatim. There is no caller seed, ambient fallback or digest derivation. The
subpath stays separate from `execution-runtime`; final catalog regeneration must prove it did not
enter the six-handler closure merely because the readiness package manifest changed.<br>
**Evidence:** `PreparedCampaignState` retains the exact seed/target behind `PREPARED_STATES`, while
the public summary and existing execution campaign projection intentionally omit seed. A digest is
one-way and cannot reproduce the generating seed. Existing readiness projections already
authenticate genuine capabilities through the same private state pattern.<br>
**Rejected alternatives:** A caller seed plus private validation is redundant and adds a mismatch
axis while changing the frozen orchestration input. Broadening every campaign summary or the
existing planning projection has a larger compatibility blast radius. Omitting or deriving seed
violates exact report reproducibility.<br>
**Strongest counterargument:** Seed is not secret and could be simpler on the existing projection;
the dedicated subpath nevertheless keeps planning wire shape and ordinary campaign summaries
unchanged.<br>
**Confidence:** High.<br>
**Hardening:** An independent challenger selected the dedicated passive subpath and required exact
digest/target joins plus final proof that the live-handler authority closure did not absorb it.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** The accessor accepts a structural lookalike, returns retained private state,
the orchestrator fails to cross-check digest/target, or the subpath enters the generated live
handler closure without a real runtime import.

### AR-P65 — VICE success stage in the frozen orchestration oracle

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Semantics-preserving specification helper correction required for the immutable
oracle to typecheck; no assertion, product behavior or production contract change.<br>
**Decision:** In the Phase 7 specification's `terminalResult` helper, map a successful `vice` tier
to stage `compare` and retain the tier itself for every other tier. Preserve all six scenarios and
assertions, rerun the expected RED classification, then freeze the replacement hash.<br>
**Evidence:** `ExecutionTierV1` contains `vice`, while `ExecutionStageV1` contains the concrete VICE
pipeline stages and not `vice`. The accepted production `routePass` already uses stage `compare`.
TypeScript rejects the unqualified `stage: tier` helper before tests can run.<br>
**Rejected alternatives:** Adding `vice` to the stage union weakens a production semantic contract
to accommodate a test typo. Deferring typechecking leaves the oracle uncompilable.<br>
**Confidence:** High.<br>
**Hardening:** Direct union and accepted route-constructor evidence make an independent design
challenge disproportionate; the correction is the unique existing production mapping.<br>
**Policy version:** 1.<br>
**Root invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Any assertion or scenario changes, RED fails for a reason other than missing
Phase 7 APIs, or production no longer defines successful VICE completion at `compare`.

### AR-P66 — Refresh content-bound parent after campaign-identity authority

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Mandatory immutable authority maintenance after an approved readiness API changes
bytes already bound by the selected parent; no modeled population or semantic-review scope change.<br>
**Decision:** Regenerate compatible-publication implementation authority, start from the exact
fresh immutable four-binding base, reconstruct the nine-binding parent with the current five oracle
revisions, produce fresh accepted review bytes for that exact reconstructed request, publish a new
immutable release and select it through the guarded transaction. Reuse prior semantic conclusions
as rationale but never reuse stale review or implementation-authority digests. Every former parent
and base release remains byte-identical. Leave the execution-child pointer untouched; no child may
be prepared, reviewed or selected until it names the new parent. Refreeze only cryptographically
identity-bound fixture constants, then rerun parent/current-five/isolated resolution, Phase 6 and 7
specifications, generated catalog freshness and the mandatory real ACME/VICE evidence before final
child review and selection.<br>
**Evidence:** The readiness manifest is in the generated parent implementation closure. AR-P64's
new export therefore makes the old selected parent correctly stale. The guarded incremental
publication path requires review bytes bound to the current request and has already completed this
same immutable transition for AR-P60 and AR-P62.<br>
**Rejected alternatives:** Excluding the manifest or source weakens content authority. Caller or
ambient seed reintroduces unauthenticated identity. Deferring freshness blocks genuine child
preparation and knowingly leaves selected authority stale.<br>
**Confidence:** High.<br>
**Hardening:** An independent challenger converged on the established immutable refresh and
required fresh review/implementation digests, exact-base reconstruction, child-pointer preservation
and full identity-bound reruns.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Any old release byte changes, the child pointer changes, the new parent is not
derived from the exact fresh base/current revisions, or an identity-bound fixture/evidence remains
on the superseded parent.

### AR-P67 — One-shot guarded transition to the fresh base

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal maintenance transition needed because the stale selected parent cannot
mint the normal incremental capability; no reusable API or public authority is added.<br>
**Decision:** In one bounded maintenance process, hard-code the exact expected stale parent and
target fresh base, regenerate current implementation authority, hold the publication generation
lock, snapshot the parent and complete child publication trees, resolve the exact base through the
genuine named resolver, reconstruct its release solely from authenticated canonical bytes and
independently verify member set/lengths/digests/publication digest. Immediately revalidate the
current pointer identity and bytes, invoke the existing package-internal
`commitPublicationPointer`, then resolve the selected snapshot as the exact base and prove all
release bytes, child state and temporary-entry cleanliness. Release the lock before the ordinary
public incremental prepare/publish flow takes its own lock and selects the reviewed new parent.
No digest or release object is caller-selected and no raw commit function becomes public.<br>
**Failure recovery:** A pre-rename failure must leave the old pointer and stops. A post-rename
failure is reconciliation-indeterminate: reacquire the lock, inspect pointer and trees, and rerun
the exact guarded base commit only when the pointer is the expected old digest or verified base.
Never raw-restore the stale parent. A third/malformed state or child-tree change hard-stops. A later
incremental failure may safely leave the fresh base selected.<br>
**Evidence:** The internal commit already exists and is explicitly absent from the package index;
AR-P61 prohibits exporting reusable raw commit authority, not a one-shot fully verified
maintenance transition. The normal public flow rechecks the selected base and owns final review,
promotion and selection.<br>
**Rejected alternatives:** A new public historical selector changes the authority closure and adds
reusable surface for one recovery. Raw pointer editing omits durability and identity guards.
Stopping is unnecessary because a valid immutable base exists.<br>
**Confidence:** High.<br>
**Hardening:** An independent challenger accepted the internal path only with hard-coded digests,
generation locking, authenticated byte reconstruction, immediate pre/post resolution, complete
child snapshots and closed reconciliation behavior.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** The maintenance code accepts caller-selected authority, runs without the lock,
uses unauthenticated release bytes, exposes the commit publicly, raw-restores stale authority, or
observes any child-tree mutation.

### AR-P68 — Fixed cleanup-grace policy in the frozen orchestration oracle

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Assertion-neutral specification fixture correction to the already approved fixed
policy contract; no production or product behavior change.<br>
**Decision:** Change only the Phase 7 specification's `cleanupGraceMs` fixture value from 1,000 to
3,000 milliseconds, retain all scenarios/assertions, rerun the focused oracle and freeze the
replacement hash.<br>
**Evidence:** The accepted production policy parser requires exactly 3,000 milliseconds and the
first genuine orchestration body rejects 1,000 at `/policy/budget/cleanupGraceMs` before any route
work. The same failure reproduces independently in the new implementation diagnostic test.<br>
**Rejected alternatives:** Weakening or bypassing validation changes the closed resource protocol
to accommodate an invalid test fixture.<br>
**Confidence:** High.<br>
**Hardening:** Parser contract and independent reproduction identify one exact correction; an
independent architecture challenge is disproportionate.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Any assertion/scenario changes, a different policy field fails, or the accepted
protocol no longer fixes cleanup grace at 3,000 milliseconds.

### AR-P69 — Revisioned bounded population selection

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal deterministic execution resource policy needed to reconcile the complete
genuine campaign with the already approved per-rule expensive-work cap; campaign semantics and
modeled rule scope remain unchanged.<br>
**Decision:** Implement `execution-selector-v2` inside the pure readiness-execution planner. Keep
the complete genuine campaign projection and original campaign digest. For each modeled rule,
group cases by the existing canonical `(validity,spellingTuple,boundaryFamilyId)` stratum, compute a
domain-separated population rank over selector revision, parent digest, campaign digest, rule ID,
case identity and `population`, sort candidates in each lexical stratum by rank then case identity,
and take one per stratum per pass until 16 unique cases are selected or the population is exhausted.
More than 16 non-empty strata fails `execution-plan-capacity`; no stratum is silently omitted. Run
the existing per-obligation selection over that bounded population, retaining mandatory valid-VICE
and aggregate 256-route gates. Use v2 in every population/obligation rank and prebuild identity.
Derive residual population from unique planned case identities, not route count, and serialize one
lexically sorted `residual:case:<ruleId>:<caseIdentity>` blocker per omitted case. Capacity failure
precedes every workspace, handler and partial report.<br>
**Evidence:** The genuine runtime campaign has 120 cases while the approved v1 cheapest obligation
requires every planner-input case and caps a rule at 16. AR-P6 already rejects ordinal-first
selection and requires digest-ranked coverage across validity, spelling and boundary strata.
Lexical truncation can systematically discard hardware-boundary variants.<br>
**Rejected alternatives:** First-case selection reintroduces generation/identity-order bias.
Raising the cap expands ACME/VICE work and weakens the reviewed resource policy. Shrinking RD-02's
campaign configuration changes genuine campaign identity and discards broader evidence.<br>
**Confidence:** High.<br>
**Hardening:** An independent challenger required a new selector revision, whole-stratum coverage,
unique-case residual accounting and execution-package ownership rather than orchestration-local
filtering.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Current or future strata cannot fit 16, a residual case is not named exactly,
v1 identity remains on a v2-produced route, or filtering occurs outside the pure planner.

**Execution correction:** Read-only measurement disproved this ruling before any route executed:
the 120-case component campaign contains 22 non-empty tuple strata for both `poke` and `pokew`, so
full-stratum preselection cannot fit 16. Raising the preselection cap to 32 would still discard
campaign cases before their cheapest tier, contradicting the approved every-case invariant. AR-P70
supersedes this attempted v2 design; no v2 plan or evidence is accepted.

### AR-P70 — Dedicated genuine Phase 7 campaign

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Exact selected-campaign configuration within the approved four-rule C64 scope;
selector resource policy and the separate Phase 5 component-evidence campaign remain unchanged.<br>
**Decision:** Retain `execution-selector-v1` and its inclusive 16-per-rule/expensive-obligation and
256-campaign caps. Construct the Phase 7 selected campaign genuinely with `caseCount:40`,
`maxInvalidCases:16`, the four runtime rule IDs, spellings `literal` and `parameter`, the unchanged
runtime generator/boundary/renderer authorities, target, seed and budgets. Mandatory coverage
occupies 24 valid cases and the invalid lane contributes four per rule. Exact measured totals are
`peek=8`, `peekw=8`, `poke=12`, `pokew=12`; valid totals `4/4/8/8`; invalid totals `4/4/4/4`;
full tuple strata `3/3/7/6`. Every selected campaign case receives its cheapest tier, every
additional obligation covers each non-empty tuple stratum, all mandatory rules retain valid VICE
witnesses and total expensive accounting is 59. The existing 120-case, four-spelling campaign
remains Phase 5 component evidence and is not reported as omitted Phase 7 population. Residual
blockers continue to represent only unmodeled, not-generatable, oracle-unmodeled or capability-
unbound authority.<br>
**Evidence:** Genuine construction with four spellings requires at least 80 cases even with zero
invalid cases; measured 32/48/64 candidates all reject `campaign.coverage.insufficient`. The exact
40-case two-spelling configuration constructs genuinely and plans within every v1 cap. Literal and
parameter retain the compile-time/runtime-binding extremes; Phase 5 retains const/local evidence.<br>
**Rejected alternatives:** Truncating a genuine campaign violates every-case execution. Raising the
cap to 42 supersedes reviewed resource policy and drives 120 cheapest routes plus 54 VICE minima.
Shrinking the four-spelling campaign below 80 is not a genuine configuration.<br>
**Confidence:** High.<br>
**Hardening:** An independent challenger selected the dedicated campaign; a separate read-only
measurement reproduced its counts/strata and refuted every smaller four-spelling candidate.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Any measured total/stratum changes, a selected case lacks its cheapest route,
the production CLI and specification construct different campaign identities, v1 caps change, or
the 120-case component fixture is misreported as Phase 7 residual population.

### AR-P71 — Effective uppercase seed and byte-type normalization

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Two semantics-preserving specification-oracle corrections; no assertion intent,
production contract or product behavior changes.<br>
**Decision:** Replace the alleged uppercase-invalid `SEED.toUpperCase()` input, which remains the
same all-digit string, with exactly 64 uppercase `A` hex characters. Normalize Node's `Buffer`
returned by `readFile` to the declared `Uint8Array` byte oracle before equality. Preserve every
scenario and expectation, rerun the focused suite and freeze the replacement hash.<br>
**Evidence:** Primitive-equal strings cannot receive different grammar outcomes. Vitest v2 treats
`Buffer` and `Uint8Array` as distinct constructors even when bytes match; the serializer correctly
returns the planned `Uint8Array`.<br>
**Rejected alternatives:** Making CLI reject a valid all-digit seed violates grammar. Returning a
Node-specific `Buffer` violates the public serializer type and machine-neutral contract.<br>
**Confidence:** High.<br>
**Hardening:** Both failures are directly reproducible type/value identities with one exact
requirement-preserving correction each; an independent design challenge is disproportionate.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Any other assertion/token changes, the uppercase-A seed is accepted, or equal
normalized report bytes still differ.

### AR-P72 — Refreeze parent-bound real execution evidence

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Content-identity maintenance required by the already approved immutable parent
refresh; runtime semantics, test scenarios and accepted toolchain remain unchanged.<br>
**Decision:** Run the fixed four-case local suite through real ACME and VICE at least twice from the
sealed current bytes. Require identical evaluation, route, result, source, binary, build and layout
digests, observed/completion bytes and usage across both runs except declared launch-attempt result
variants. Refreeze only identity-bound accepted values that changed because the selected parent is
now `e5796e…cd3e5`; preserve every semantic/layout/usage assertion. Rerun the focused real suite
GREEN. Because tasks 7.2.6–7.2.9 may still change participating bytes, task 7.2.8 must repeat and
refreeze this evidence again after final review before child review or selection.<br>
**Evidence:** The bounded full execution suite reached 454/455 GREEN. The only failure retained
identical source, binary, build, layout, completion and usage evidence while the parent-bound
evaluation and route identities changed, exactly as AR-P66 predicts.<br>
**Rejected alternatives:** Weakening identity binding would accept evidence against another parent.
Keeping stale constants leaves the package knowingly red. A single run is insufficient for local
emulator evidence stability.<br>
**Confidence:** High.<br>
**Hardening:** This repeats the already accepted Phase 5/6 identity-refreeze protocol and keeps a
mandatory post-review rerun; independent architecture challenge is unnecessary. The declared
two-launch variants were reconstructed from the public canonical evidence preimage only after that
formula reproduced all eight previously accepted one- and two-launch digests byte-for-byte. The
new one-launch derivations then matched both genuine current runs exactly; only the parent-bound
evaluation and route identities were substituted when deriving the retained two-launch variants.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Any non-identity evidence changes, repeated runs disagree, tool versions differ,
or post-review bytes/evidence are not rerun before child review.

### AR-P73 — Phase 7 review remediation architecture

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal provenance, report, concurrency, persistence, compatibility and resource
mechanisms required to resolve RV-001–RV-008 and PE-001 without changing accepted product scope,
route semantics, report revision, frozen specification expectations or publication policy.<br>
**Objective:** Make the final local authority independently attributable, content-bound,
race-resistant and reproducible while continuing every route whose own prerequisites are present.<br>
**Decision:** Reuse the existing generated execution dependency-closure catalog as the sole source
of real participating implementation bytes and project its exact validated closure into genuine
campaign construction; remove synthetic fixture revisions. Preserve the required positional
`results` and add canonical per-route records binding case/execution identity, rule, obligation,
terminal tier and result. Derive and validate summary status, counts and blockers from those route
records. Gate unavailability per route rather than globally. Close conformance state before an
authorized async scope returns and reject detached access. Execute only the planner's frozen policy
snapshot. Rebuild report publication from the existing pinned-directory/no-follow/exclusive-write
primitives and guarded commit pattern. Export the exact promised public type names with complete
property documentation. Remove the redundant final report decode/parse. Add focused mutation,
partial-capability, hostile-summary, detached-work, directory-replacement and policy-mutation tests;
preserve every frozen specification file and hash.<br>
**Evidence:** RV-001 found that synthetic `fixtures/*.ts` bytes could attest unrelated real
generator, boundary and renderer functions. RV-002–RV-008 demonstrated missing standalone route
attribution, global tool short-circuiting, forgeable aggregates, detached async-state reuse,
pathname replacement races, post-plan policy mutation and incomplete named exports. PE-001 found
one redundant full report parse. The generated catalog already owns exact dependency paths/digests
and freshness generation; the publication package already owns pinned directory and exclusive
file primitives. At 10× campaign size, one shared bounded provenance and persistence system avoids
duplicated large closures and heap graphs; under obsolescence, generated projections can evolve
behind the same validators; a contrarian security review favors one hardened filesystem boundary;
pre-emptive mutation tests make stale closure claims fail before evidence execution.<br>
**Rejected alternatives:** A dedicated campaign catalog plus dedicated report sink duplicates both
provenance and security-critical persistence and can drift. A campaign-only generated projection is
a viable fallback only if direct exact catalog projection proves impossible; it must still be
generated by the same owner and prove equality with the source catalog. Keeping positional results
alone cannot make a standalone report attributable; removing them breaks the frozen public oracle.<br>
**Strongest counterargument:** The six-route handler catalog was not originally a campaign schema;
using it without also binding the genuine campaign descriptor would repeat the freshness defect.
The implementation must therefore bind both the exact closure and the independently canonical
campaign configuration/seed/cases and fail closed on missing, duplicate or mismatched participants.<br>
**Confidence:** High.<br>
**Hardening:** A blind independent design challenger recommended this shared-authority architecture,
identified campaign-descriptor omission as its strongest risk, and retained a same-generator
campaign projection as the only viable fallback.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Direct catalog projection cannot prove generator/boundary/renderer bytes,
additive route records conflict with a frozen assertion, pinned primitives cannot protect the report
commit, any required fix changes public product behavior, or focused adversarial tests remain red.

### AR-P74 — Assertion-neutral orchestration fixture provenance refreeze

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Specification-oracle fixture maintenance caused solely by the mandatory content-
freshness correction; test scenarios, assertions, campaign configuration and product behavior stay
unchanged.<br>
**Decision:** The implementation-blind spec author may replace only the orchestration campaign's
synthetic generator/boundary/renderer revision inputs in
`test-fixtures/genuine-execution-campaign.ts` with the approved data-only generated closure
descriptor used by the public campaign-authority boundary. Frontend and runtime component campaigns
remain byte-identical. No specification-test token or assertion may change. Refreeze the fixture
hash, require the Phase 7 oracle to remain 6/6 GREEN, and propagate only genuinely derived campaign,
case, plan, parent and evidence identities through the ordinary freshness chain.<br>
**Evidence:** The frozen oracle discovers exact substitution identities from its genuine
orchestration fixture and supplies them to the production CLI. Correct content binding necessarily
changes those identities. Retaining the synthetic fixture makes valid substitutions stale; silently
translating stale identities in production violates the exact single-use conformance contract and
would mask the critical provenance defect.<br>
**Rejected alternatives:** Preserving the old campaign digest while adding a separate report-only
closure digest leaves the canonical campaign identity falsely code-independent. Translating or
loosening substitution identities breaks fail-closed conformance. Editing assertions is neither
necessary nor authorized.<br>
**Strongest counterargument:** Sharing a generated data descriptor reduces fixture independence.
The fixture therefore consumes only closed revision/closure data through the planned authority
interface and independently retains all configuration, dependencies and assertions; it never calls
the production campaign factory.<br>
**Confidence:** High.<br>
**Hardening:** RV-001 independently established that synthetic revisions were unsound; the AR-P73
challenger independently required canonical campaign descriptor plus exact closure binding and
identified omission as the strongest risk.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Closure evidence:** The final independently constructed fixture SHA-256 is
`20f981a67019ce6beba5801c458d82cfbee1454377ba1647c90a4aeb528c8c84`; the Phase 7 oracle remains
6/6 GREEN in 305.3 seconds. The intermediate callable-resolver refreeze
`14b52453680e9ad091d4e1d4612e0a8e417009fdb6006d29f01c71c5c3a45966` is superseded and is not
accepted closure evidence. The final fixture consumes only the data descriptor, independently
validates its exact participants and revisions through public readiness APIs, and binds only
fixture-owned known functions. Frontend remains
`6723c61e3c691ea79c33703f7ad08710f0092e45cbc6c1fc20a27181e7ab69c8` at 72/48/24 and runtime
remains `1eef551294781cddd6077027baa011b5f3c52fe77e753d7ad5e7a0e381dc01bd` at 120/88/32. Only the
orchestration campaign changed, to code-bound digest
`4b8c2c79b30ad2dab2d85776f0924f198460e67d7cf420d832c4dd433ce76f71` at 40/24/16.<br>
**Reopen trigger:** Any assertion/test token changes, frontend or runtime fixture identities change,
the fixture calls the production factory, or the data descriptor can claim bytes without freshness
validation.

### AR-P75 — Canonical report wall-time normalization

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Deterministic machine-evidence serialization mechanism; route budgets, execution
ordering, pass/failure semantics and accepted report schema remain unchanged.<br>
**Decision:** Preserve measured wall time for live budget enforcement and adapter-local diagnostics,
but normalize `usage.wallMs` to zero in every retained canonical campaign result and route record
before aggregation or serialization. Retain deterministic output/evidence byte, instruction, cycle
and launch-attempt counters exactly. Validate finite non-negative measured wall values at the
conformance boundary, including fractional monotonic durations. Add focused fractional-duration
and repeated partial-capability report tests.<br>
**Evidence:** Per-route tool gating correctly executes unaffected compiler routes when ACME/VICE are
missing, but their monotonic wall measurements made two otherwise identical unavailable reports
differ and caused immutable no-clobber publication to reject the second command. The Phase 7 oracle
requires repeatable stdout/stderr, and the design requires canonical machine-neutral report bytes.
The existing evaluated-VICE evidence identity already omits wall time because host scheduling is
nondeterministic while retaining all deterministic resource counters.<br>
**Rejected alternatives:** Restoring the global tool short-circuit violates RV-003. Reusing a prior
report without re-execution would attest stale capability/tool state. Quantizing wall time remains
host-dependent. Including raw wall time under a new field or revision contradicts the current
deterministic report contract and expands public schema.<br>
**Strongest counterargument:** The report no longer carries observed elapsed time. That value cannot
be stable authority evidence; enforcement still uses it live, while deterministic counters and
terminal results retain the auditable resource proof.<br>
**Confidence:** High.<br>
**Hardening:** The independent reviewer required per-route execution, and the existing VICE evidence
canonicalization supplies a previously reviewed equivalent treatment of host wall time.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Any budget check consumes normalized rather than measured time, deterministic
counters change, repeated identical commands still differ, or a frozen assertion requires measured
wall time in the authority report.

### AR-P76 — Final review-closure identity and persistence invariants

**Authority:** AI — delegated by `--auto-design` during execution.<br>
**Eligibility:** Internal identity, deterministic serialization and race-resistant persistence
corrections required by the one permitted review recheck; frozen behavior, route selection,
publication policy and product scope remain unchanged.<br>
**Decision:** Close the four surviving review findings as one invariant set. The specification
fixture consumes a data-only campaign-authority descriptor and independently owns every callable
registration. Each planned route receives a distinct execution identity derived from the complete
route-plan digest plus case identity, rule, obligation, terminal tier and required tools; the
serializer independently rederives that identity from the retained route record and rejects any
mismatch. Every public report serialization path normalizes nondeterministic wall time to zero.
Reading an existing report revalidates the pinned directory immediately after the read, in addition
to the existing before/after absence and commit checks, so directory replacement cannot authorize
bytes read through a stale path. Focused adversarial tests must prove all four properties before the
review gate closes.<br>
**Evidence:** The re-review found that a callable production resolver made the fixture circular,
`executionIdentity` duplicated `caseIdentity`, positional public results could retain nonzero wall
time, and an existing-report read lacked a post-read directory identity check. The data descriptor
fixture is independently GREEN 6/6 at the unchanged specification hash. Route identity now binds
the whole frozen plan and remains total for diagnostic and unavailable routes where no later
compiler/build identity can exist. The report validator recomputes it rather than trusting the
producer. The hostile filesystem test replaces the directory immediately after an identical read
and requires fail-closed rejection.<br>
**Rejected alternatives:** Binding only successful routes to final build evidence leaves
unavailable and diagnostic routes without a total report key. Reusing case identity cannot
distinguish cheapest and obligation routes for the same case. Normalizing only the orchestrator
leaves a public serializer bypass. A pre-read check alone cannot detect replacement during the
read.<br>
**Confidence:** High.<br>
**Hardening:** The configured independent re-review supplied the four counterexamples. CodeOps
permits only one re-review cycle, so closure is established by independent rederivation plus focused
adversarial tests and the full verification gates; no third review is substituted.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Closure evidence:** The frozen Phase 7 specification remains 6/6 GREEN. The combined review-
closure suite is 31/31 GREEN. Source ownership and anti-minting guards are GREEN after confining the
generated read to its existing catalog owner. The full readiness-execution coverage gate is 34/34
files and 460/460 tests GREEN, including real ACME/VICE, at 90.03% branches and 93.08% statements.
Campaign-authority validation is 92.59% branches; the report suite explicitly rejects substitution
of case identity for route execution identity. `spec/` remains unchanged.<br>
**Reopen trigger:** The fixture resolves production callables, any route identity equals its case
identity or fails independent rederivation, any public canonical report retains nonzero wall time,
directory replacement after an existing read is accepted, or a required verification gate fails.

**Supersession note (AR-P79):** The data-only synthetic campaign descriptor was later proven to
conflict with the selected publication's exact inventory and participant authority. AR-P79 replaces
only that fixture/campaign-provenance mechanism with a genuine selected-snapshot campaign; AR-P76's
route-identity, report-normalization and persistence invariants remain authoritative.

### AR-P77 — Prepublication execution authority and content attribution

| Field | Resolution |
|---|---|
| Category | Data & state; integration points; security; compatibility |
| Runtime ambiguity | Task 7.2.8 requires the real authority report before task 7.2.10 can accept that report digest and task 7.2.11 can prepare the reviewed child. The existing orchestrator accepts only a reviewed `PublishedExecutionRelease`, so using the final child is circular. The frozen specification fixture avoids the cycle with a bootstrap child, but selecting such a child in the real repository would prematurely clear the six parent blockers. Inspection also found that the planner validates `executionDigest` but drops it from the route-plan digest and report, so current evidence does not identify the executable authority whose handlers ran. |
| Recommended ruling | Add a purpose-limited opaque `execution-review-candidate-v1` authority. Its candidate digest is domain-separated over the exact selected parent digest and canonical six-binding digest. Mint it only after generated closure freshness and parent/binding compatibility checks; expose execution-for-review only; never make it a `PublishedExecutionRelease`, a selectable value, or a published composite. Bind the exact candidate or selected-child execution digest into the route-plan preimage and canonical authority report. Revalidate parent selection and dependency closure before and after execution. The final semantic review accepts the resulting report digest and the same parent/binding digest; final child preparation cross-checks those joins before selection. |
| Authority | Auto-design delegation authorized by the user; high-stakes recommendation independently challenged and converged |
| Status | ✅ Resolved |

**Evidence:** Published execution contexts currently require a fully reviewed release, while the
semantic review requires the real report digest. The route planner accepts the composite
`executionDigest` but its version-one preimage omits it. A separate candidate digest makes the
executable parent plus six dependency closures stable before review while keeping the final child
digest free to bind the review bytes.<br>
**Rejected alternatives:** A provisional accepted child weakens review truth; selecting a bootstrap
child mutates readiness before acceptance; a detached-attestation/pointer-v2 migration is valid but
disproportionate; a digest fixed point is computationally infeasible.<br>
**Confidence:** High.<br>
**Hardening:** Independent challenger inspected the publication, planner, report and catalog
boundaries and recommended the same candidate-only authority, with explicit anti-conversion,
freshness and attribution tests.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Candidate authority becomes selectable or convertible to a published release;
the selected pointer changes before final selection; candidate identity omits parent or binding
bytes; route/report identity omits the candidate digest; or dependency/parent mutation during the
review execution is accepted.

**Supersession note (AR-P80):** Final review proved that parent plus binding identity covered the
six handlers but not the evidence-deciding runner. AR-P80 strengthens, without replacing, this
candidate-only authority by adding the generated runner revision to the candidate preimage.

### AR-P78 — Invalid expensive obligations and real-command policy

| Field | Resolution |
|---|---|
| Category | Behavioral gaps; edge cases; non-functional constraints |
| Runtime ambiguity | The real candidate-bound command selected invalid validity strata for additional emit/ACME/VICE obligations, as ST-06/ST-52 require, but the genuine diagnostic request boundary correctly forbids invalid source from targeting those stages under ST-23. Because the selector made `terminalTier` identical to `obligation`, 49 routes failed before diagnostic execution. The command also used a 64-byte, 100-instruction test policy, causing 24 genuine valid routes to fail output exhaustion. |
| Recommended ruling | Preserve each selected obligation and its rank, but map invalid-source `emit`, `acme` and `vice` obligations to truthful `terminalTier: compiler-api`; valid cases still terminate at their obligation, and invalid frontend/compiler-api/CLI cases retain that supported terminal. Derive prerequisites/tools from the mapped terminal and require at least one valid witness for every emit/ACME/VICE obligation. Accept only this exact mapping at the diagnostic request boundary. Replace the CLI's test-sized limits with the already real-verified local profile: 60,000 ms operation, 15,000 ms launch attempt, 120,000 ms route, 3,000 ms cleanup, 1,048,576 output bytes, 16,777,216 evidence bytes, 65,535 instructions, 100,000,000 cycles and 2 launch attempts. |
| Authority | Auto-design delegation authorized by the user; high-stakes semantics independently challenged and converged |
| Status | ✅ Resolved |

**Evidence:** The frozen selector oracle requires invalid strata for every additional obligation,
while the frozen adapter safety contract forbids invalid emit/ACME/VICE requests. Compiler API is
the final real prerequisite before emission and its direct diagnostic evidence proves exact
provenance plus absence of IL, assembly and binary artifacts. Obligation and terminal tier are
already independently identity-bound. The first real report measured the artificial policy
failures exactly: 49 invalid-input routes and 24 output-exhausted routes.<br>
**Rejected alternatives:** Executing invalid source at emit violates ST-23; launching ACME/VICE
falsely claims expensive work and risks producing forbidden artifacts; dropping invalid expensive
strata violates ST-52; using parser maxima instead of the real-verified profile weakens the
accepted bounded operating contract.<br>
**Confidence:** High.<br>
**Hardening:** Independent challenger cross-checked the frozen tests, design documents, selector,
request validator, orchestration identity, diagnostic classifier, tier graph and local real policy
and converged on the compiler-API projection.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** An invalid route targets emit/ACME/VICE, loses its original obligation/rank,
requires an external tool, lacks exact no-artifact diagnostic proof, or any expensive obligation
lacks a genuine valid terminal-tier witness; or the authority command uses unreviewed limits.

### AR-P79 — Selected campaign authority versus current execution attribution

| Field | Resolution |
|---|---|
| Category | Data & state; integration points; security; compatibility |
| Runtime ambiguity | The real command's synthetic local campaign authority derived generator, boundary and renderer revisions from the current execution package's shared 492-file dependency closure. The selected parent instead authenticates the exact reviewed publication inventory and participant revisions. Every diagnostic route and genuine VICE route therefore failed the published oracle's exact-environment join even though both authorities independently resolved. The initial publication command correctly refused to replace already-bound declarations, so refreshing the parent is neither an available nor a semantically valid shortcut. |
| Recommended ruling | Add a closed semantic-only `createPublishedExecutionCampaignV1` API to the existing `@blend65/readiness/execution-campaign-identity` boundary. It accepts only a genuine resolver-created `PublishedSnapshot`, the fixed target, seed and normalized generation configuration; sources inventory, rule-model, generator, boundary and renderer authority exclusively from that snapshot's private selected authority; verifies every enabled rule maps to the same selected generator route; and rejects caller authority bytes, revisions or implementations. `createLocalExecutionCampaignV1` consumes that snapshot and the fixed 40-case configuration instead of repository source files or the synthetic campaign descriptor. Keeping this adapter outside the already-sealed oracle/publication dependency closures preserves the selected parent's exact implementation authority. The prepublication `executionDigest` remains the sole attribution for current executable route/campaign code. Refreeze only the assertion-neutral orchestration fixture provenance against the same selected parent; the frozen specification assertions remain unchanged. |
| Authority | Auto-design delegation authorized by the user; high-stakes architecture independently challenged and converged |
| Status | ✅ Resolved |

**Evidence:** The selected parent and loose workspace inventory have different content digests, and
the synthetic local participant revisions also differ from the selected generator, boundary and
renderer revisions. The published diagnostic join correctly rejects that mixed authority. The
selected snapshot reconstructs callables only after validating the current workspace implementation
bytes against the publication's claimed revisions, while AR-P77's execution digest independently
binds the current six-route closure. These are complementary, not competing, authorities.<br>
**Rejected alternatives:** Republishing or replacing the parent rewrites reviewed history and is
correctly forbidden for bound declarations. Relaxing the published-environment equality would let
one campaign execute under another campaign's oracle authority. Keeping a second synthetic
campaign identity duplicates authority and recreates the mismatch on any unrelated closure change.<br>
**Confidence:** High.<br>
**Hardening:** Independent challenger inspected campaign construction, publication resolution,
candidate freshness, frozen fixture provenance and the failed real reports and converged on the
selected-context campaign factory with separate executable-content attribution.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Campaign identity consumes loose repository bytes, caller-supplied participant
authority or a synthetic revision; enabled rules span incompatible selected generators; fixture and
production campaign identities diverge; the campaign adapter changes an already-sealed parent
dependency closure; or current executable bytes are no longer bound by the execution digest.

### AR-P80 — Evidence-deciding runner closure and report completeness authority

| Field | Resolution |
|---|---|
| Category | Data & state; integration points; security; compatibility |
| Runtime ambiguity | Final review proved that the six handler revisions did not cover campaign, orchestration, planning and report code, so those bytes could change without changing the prepublication execution digest. It also proved that the public structural report serializer could accept a self-consistent subset under a caller-invented plan digest. |
| Recommended ruling | Generate and revalidate a separate content-derived runner closure rooted at campaign construction, orchestration and report authority, with the generated handler catalog treated as the binding-digest boundary. Include its revision in the domain-separated review-candidate digest; route-plan, report and accepted semantic-review report digest then retain that exact execution identity end to end. Mint every report as a process-local opaque capability only after orchestration has planned and executed the complete route set; keep the mint function internal to the package and require that capability at serialization, digest and durable-write boundaries. Structural copies inherit no authority. |
| Authority | Auto-design delegation authorized by the user; independent correctness review identified both gaps and supplied the accepted closure constraints |
| Status | ✅ Resolved |

**Evidence:** The generated handler closure was rooted at `execution-live-handlers`, while the
review candidate preimage contained only parent and binding digests. The report parser could prove
internal route/result consistency but could not reconstruct a route plan it was not given. A
separate generated runner revision preserves the fixed six-row publication format and avoids a
self-hash through the generated handler module. Opaque report minting makes plan completeness an
orchestrator invariant instead of a caller assertion. The semantic review already accepts the
canonical report byte digest, so the candidate identity carried by that report closes the final
review join without changing the published review schema.<br>
**Rejected alternatives:** Expanding every handler closure duplicates unrelated runner bytes and
creates a generated-file self-cycle. Adding complete route-plan items to the report is viable but
duplicates an already authenticated plan and leaves every serializer caller responsible for the
join. Trusting the production CLI alone leaves alternate public writer callers unsafe.<br>
**Confidence:** High.<br>
**Hardening:** Independent correctness review reproduced both failures and required a content
closure plus either opaque reports or an exact serialized plan join; this ruling takes its stronger
opaque-capability option.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Runner code can change without changing candidate identity; route/report review
can lose that identity; a structural report or route subset can be serialized, digested or written;
or the report mint becomes part of the public package surface.

### AR-P81 — Bounded route materialization and per-case authority preparation

| Field | Resolution |
|---|---|
| Category | Non-functional constraints; data & state; integration points |
| Runtime ambiguity | Performance review proved that a 4,097-route plan could execute for days before the 4,096-record report boundary rejected it, and that repeated obligation routes regenerated the same campaign case and diagnostic/runtime authorities. The real 97-route seed repeated 16 invalid cases across 37 routes, accounting for roughly 57 seconds of redundant diagnostic preparation. |
| Recommended ruling | Define one shared inclusive 4,096-route/report limit and enforce it in selector capacity preflight before rank or route materialization. During orchestration, generate each campaign ordinal once and memoize one genuine diagnostic or execution-case authority per case identity for reuse across that case's obligation routes; unavailable and substituted routes remain preparation-free. Preserve single-use VICE process/runtime authority inside each handler invocation rather than caching process handles. |
| Authority | Auto-design delegation authorized by the user; independent performance audit measured both costs and supplied the accepted boundary constraints |
| Status | ✅ Resolved |

**Evidence:** The selector already has a pre-materialization capacity pass, making exact route-count
accounting the smallest safe insertion point. `PublishedDiagnosticCaseV1` and `ExecutionCaseV1` are
immutable case authorities; route requests and VICE runtime handles are minted later, so reusing the
case authority removes campaign-wide regeneration without reusing consumable process authority.
The generated runner revision covers this orchestration behavior.<br>
**Rejected alternatives:** Letting the report reject after execution has an unbounded cost gap.
Raising the report cap increases memory and persistence exposure without a product need. Caching
VICE sessions or runtime comparison authorities would violate their consumption model. Editing the
selected parent's sealed oracle implementation solely to add a cache would invalidate publication
freshness and is unnecessary once orchestration deduplicates by case identity.<br>
**Confidence:** High.<br>
**Hardening:** Independent performance audit reproduced the 4,097-route boundary and measured
per-route preparation; the resolution retains its early-capacity and unique-case requirements.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** A plan larger than the report can materialize; any handler runs before capacity
failure; the same case identity regenerates diagnostic/execution authority for multiple routes; or
a consumable VICE/process authority becomes shared across routes.

### AR-P82 — Opaque report authority at reconciliation fault boundaries

| Field | Resolution |
|---|---|
| Category | Security; compatibility; testing boundary |
| Runtime ambiguity | Opaque report minting correctly rejected structural copies, but the frozen reconciliation oracle deliberately supplies a different structurally valid report inside a closed fault scope so every atomic filesystem boundary can be reached while prior canonical bytes remain immutable. Rejecting the copy before filesystem work left the configured boundary unconsumed and made the frozen oracle fail. |
| Recommended ruling | Preserve opaque authority for every public serializer, digest and ordinary durable-write call. Add one private writer-only fallback that may snapshot a structurally valid alternate report only while the package-private conformance context owns an unconsumed report fault. Do not register or return authority for that snapshot; the structural object must remain rejected before and after the scope. Include the fallback in the generated runner closure and independently re-review it before evidence generation. |
| Authority | Auto-design delegation authorized by the user; frozen specification failure supplied the compatibility constraint |
| Status | ✅ Resolved |

**Evidence:** The isolated frozen canonical-report case reproduced the failure after competing test
processes were removed. The corrected implementation test uses an unauthorized structural copy at
all seven fault boundaries and proves it remains unauthorized after each scope. The focused report
suite passes 10/10, the isolated frozen case passes 1/1, and the complete frozen suite passes 6/6
at unchanged specification and fixture hashes. The regenerated runner revision is
`sha256:1971920b5f53511d5b41b0330ee895aca068ba910ab391754ea2851b8d9cc379`.<br>
**Rejected alternatives:** Re-authorizing structural reports globally reopens the completeness
forgery closed by AR-P80. Silently consuming a named fault during schema rejection would claim a
transaction boundary that was never reached. Changing the frozen specification would weaken the
immutable oracle.<br>
**Confidence:** High.<br>
**Hardening:** Independent re-review found no critical or major findings and confirmed that the
fallback is private, fault-scope-only, non-authorizing and content-bound by the runner revision.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** An ordinary structural report can serialize, digest or persist; a fault-scope
snapshot receives reusable authority; the conformance context becomes public; or the fallback is
absent from execution-candidate freshness.

### AR-P83 — Canonical report spelling for evaluated VICE evidence digests

| Field | Resolution |
|---|---|
| Category | Data & state; compatibility; integration points |
| Runtime ambiguity | The mandatory real campaign completed its routes but report minting rejected evaluated VICE evidence. General execution evidence carries `sha256:<64-hex>`, while the frozen runtime-evaluation contract intentionally exposes a bare 64-hex evidence digest. The report snapshot validator accepted only the prefixed spelling, so genuine VICE results could not become canonical authority. |
| Recommended ruling | Preserve both existing producer contracts. At the private orchestration/report snapshot join, accept exactly either `sha256:<64-lowercase-hex>` or bare `<64-lowercase-hex>` for route and cleanup evidence, normalize the latter to the prefixed report spelling, and continue rejecting every other value. Bind the normalization code into the generated runner revision and rerun review, full verification and real evidence generation. |
| Authority | Auto-design delegation authorized by the user; the mandatory real campaign supplied the integration constraint |
| Status | ✅ Resolved |

**Evidence:** The real command resolved the parent, oracle, candidate and campaign and ran for about
88 seconds before throwing from `snapshotEvidence` during opaque report minting. An instrumented
stage-local rerun produced the same stack after route execution. Frozen runtime specifications pin
the evaluated digest to lowercase 64-hex, while other execution producers and publication identity
use the prefixed form. Independent review also found that genuine cleanup-blocker lease evidence
uses the bare spelling; the same normalizer now covers both fields and rejects malformed,
uppercase and wrong-length values. Focused report/conformance tests pass 16/16 and prove one
canonical report spelling; generated freshness passes at runner revision
`sha256:be77abdac54197499b98b7a39deb8fc8412e6fc8fe0d94d780a9158e54ff724e`.<br>
**Rejected alternatives:** Changing evaluated VICE evidence would violate the frozen runtime oracle.
Allowing arbitrary text would weaken report identity validation. Retaining two spellings in durable
reports would make semantically identical SHA-256 evidence byte-distinct.<br>
**Confidence:** High.<br>
**Hardening:** Independent correctness re-review found the adjacent raw VICE cleanup-evidence
spelling, then closed RV-001 with no remaining critical or major findings after the shared exact
normalizer and negative cases landed.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Any non-SHA-256 spelling is accepted; normalized report bytes cease to be
prefixed; a producer's evidence identity changes silently; or normalization escapes the private
report snapshot boundary.

### AR-P84 — Runtime memory addresses in the mandatory selected campaign

| Field | Resolution |
|---|---|
| Category | Compiler semantics; code generation; expressiveness; acceptance |
| Runtime ambiguity | The first canonical real authority report reached every route but six parameter-spelling VICE cases failed. Their envelopes contain the correct external bindings, while the compiler emits E10045 and replaces each runtime-address memory intrinsic with a zero/no-op stub. RD-04's reviewed campaign deliberately retains literal and parameter spellings, and publication acceptance requires real proof for all four memory rules. |
| Recommended ruling | Preserve the immutable current codegen oracle that rejects genuinely dynamic addresses until its owned conformance RD-02 lands. For the selected externally bound cases, add bounded whole-program constant propagation: when a non-entry function has exactly one reachable call site and an address parameter is bound by a compile-time constant, resolve that parameter (including constant arithmetic) through the existing direct-address path. Multi-call, recursive, imported-unknown and genuinely dynamic cases fail closed under E10045. This makes the selected case semantically faithful while emitting the exact expert literal sequence, and leaves ledger X-01 active for the unimplemented general runtime form. Preserve the campaign and published oracle unchanged; add implementation tests and rerun semantic/codegen review plus real VICE authority. |
| Authority | Auto-design delegation authorized by the user; mandatory real acceptance and the frozen language contract supplied the constraint |
| Status | ✅ Resolved |

**Evidence:** The failed report contains six VICE semantic mismatches and all are parameter-address
cases. Re-rendering the genuine cases proves the calls carry `53280` and the modeled values in
parameter order. Direct compiler reproduction emits E10045 and a `memoryCase` body that returns
zero, while the plan's ST-11 and publication gate require complete-parameter cases to execute.
Treating them as residual or removing parameter spelling would weaken reviewed acceptance. The
general runtime-address failure is already executable ledger row X-01, owned by conformance RD-02;
three immutable codegen specifications currently pin E10045 for that genuinely dynamic form.<br>
**Rejected alternatives:** Removing parameter spelling contradicts AR-P70 and the acceptance
contract. Accepting the failed report would select authority known to miscompile valid source.
Expanding the envelope into literals would test different source semantics and make external
parameter bindings decorative. Implementing general `(zp),Y` in RD-04 would contradict immutable
codegen oracles and duplicate the already-planned conformance RD-02, whose expert bar also requires
absolute-indexed selection for `BASE + i` rather than uniform indirect access.<br>
**Confidence:** High.<br>
**Hardening:** Compiler-semantics and correctness review must inspect the final lowering and exact
instruction sequences before evidence freeze.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** A single-call constant argument is rejected or stubbed; constant propagation
crosses a multi-call/recursive/unknown boundary; direct addressing regresses; or ledger X-01 loses
its conformance RD-02 owner before general runtime addressing ships.

**Measured parity debt:** The accepted seam removes every dead address-parameter store, but a
constant write wrapper still retains value marshalling plus `JSR`/`RTS` (about 15 bytes / 26 cycles
versus the expert inline 5 bytes / 6 cycles) and its unused address frame slot. GitHub issue #79
owns constant-value specialization, sole-call leaf inlining, dead-frame elimination and whole-call
byte/cycle goldens. This keeps the local direct-memory sequence at the expert floor while tracking
the concrete path to beat it at whole-program scale.

### AR-P85 — Full emitter error authority at the worker boundary

| Field | Resolution |
|---|---|
| Category | Evidence integrity; integration points; fail-closed execution |
| Runtime ambiguity | The same real run showed emit and downstream ACME/VICE routes proceeding after E10045. `emitAsmWithEvidence` reported `result.hasErrors = true`, but its diagnostic evidence sidecar contains only frontend-accepted entries; the emit worker returned neither the full result flag nor an error entry, and the adapter classified non-empty recovery assembly as success. |
| Recommended ruling | Add the real emitter result's `hasErrors` boolean to the exact emit-worker response contract, validate and evidence-bound it, and require `false` before emit success or downstream artifact authority. Keep the diagnostic sidecar unchanged as provenance for accepted entries; do not infer full compiler success from that narrower sidecar. |
| Authority | Auto-design delegation authorized by the user; mandatory real acceptance supplied the integration constraint |
| Status | ✅ Resolved |

**Evidence:** A direct reproduction returns `hasErrors: true`, an empty evidence-entry list and
non-empty recovery assembly whose intrinsic body is a zero stub. The current emit success predicate
checks only assembly length and the sidecar, so the bad artifact reaches VICE and is reported as a
semantic mismatch rather than being stopped at emission.<br>
Binding `hasErrors` adds 18 canonical retained bytes to each sealed local build. The four accepted
ACME/VICE build and one-/two-attempt result digests were independently remeasured on ACME 0.97 and
VICE 3.10; binary, layout, instruction, cycle and completion-timing evidence remained byte-for-byte
unchanged.<br>
**Rejected alternatives:** Extending the frontend-only capture after the fact conflates diagnostic
acceptance provenance with later codegen diagnostics. Treating non-empty recovery output as success
is fail-open. A worker-local throw would stop execution but discard the precise full-result fact
needed by the typed response contract.<br>
**Confidence:** High.<br>
**Hardening:** Focused protocol and adapter tests must reject missing, malformed and true emitter
error flags; final correctness review must confirm downstream ACME/VICE cannot consume such output.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** Any emitter result with `hasErrors` can pass the emit adapter or enter ACME; the
flag is not covered by response validation/evidence limits; or the diagnostic sidecar is treated as
a complete replacement for the compiler result.

### AR-P86 — Exact invalid source plus a trusted diagnostic-only entrypoint

| Field | Resolution |
|---|---|
| Category | Diagnostic evidence; source authority; integration points |
| Runtime ambiguity | Every selected invalid source intentionally contains only `memoryCase`, so the real compiler adds E10020 (`main` missing) alongside the expected intrinsic diagnostic. The published diagnostic join correctly requires exactly one diagnostic and exact invalid source bytes. Appending `main` would mutate those authority bytes; accepting extra diagnostics would weaken exactness. |
| Recommended ruling | For `invalid-diagnostic` worker requests only, compile the exact authenticated invalid source as one module together with one fixed package-owned companion module containing only `function main(): void {}`. The companion bytes and filename are constants inside the generated runner closure, are unavailable to valid-source routes, and add no diagnostic or artifact truth. Pass both exact paths explicitly to the compiler and retain the invalid case digest as the classified source identity. |
| Authority | Auto-design delegation authorized by the user; mandatory real acceptance supplied the integration constraint |
| Status | ✅ Resolved |

**Evidence:** A two-module compiler probe produces exactly the expected E10041 for `peek()` and no
E10020, while leaving the invalid module bytes unchanged. The worker already owns a package-fixed
host and explicit file list; the generated runner revision binds changes to that boundary.<br>
**Rejected alternatives:** Appending or rewriting `main` changes authenticated source content.
Ignoring E10020 makes the exact diagnostic oracle permissive. Relaxing the compiler's global entry
contract for diagnostic runs introduces a new compiler mode solely for the harness.<br>
**Confidence:** High.<br>
**Hardening:** A real worker-thread implementation test must prove one accepted diagnostic and no
missing-main cascade; final correctness review must confirm the companion cannot enter valid routes.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** The invalid bytes are modified; valid routes see the companion; the companion
is caller-controlled or absent from runner freshness; or extra diagnostics are accepted.

### AR-P87 — Published direct-memory type diagnostics across frozen code assignments

| Field | Resolution |
|---|---|
| Category | Compiler diagnostics; compatibility; oracle integration |
| Runtime ambiguity | The selected RD-03 oracle correctly expects F020's E10172 for boolean direct-memory arguments, but the compiler registry also uses E10172 for a missing return value and its general argument mismatch is E10171. A separate immutable poke-width oracle requires `poke(addr, boolean)` to remain E10152 as a byte-width kind mismatch. The selected seed's only invalid value case is `pokew(addr, false)`; its other boolean cases are address operands. |
| Recommended ruling | Preserve all established general-call and one-byte `poke` diagnostics. At the narrow direct-memory boundary, emit the frozen F020 numeric contract E10172 for boolean address operands of all four operations and for a boolean `pokew` value, using the existing unique registry value with an explicit durable collision comment. Wrong arity remains E10041; `poke` boolean values remain E10152; never emit a duplicate cascade. Track the broader diagnostic-number drift for eventual spec errata rather than renumbering unrelated frozen behavior inside RD-04. |
| Authority | Auto-design delegation authorized by the user; conflicting immutable oracles and the exact selected campaign supplied the constraint |
| Status | ✅ Resolved |

**Evidence:** The selected ordinals 24/25/27/30/33/36/37 use boolean addresses and ordinal 39 uses
a boolean `pokew` value; their published expectation is exactly one semantic E10172. The immutable
poke-width test pins E10152 only for `poke($D020, true)`, while general user-call tests pin E10171.
The diagnostic registry enforces unique values, so adding a second E10172 name is invalid.<br>
**Rejected alternatives:** Globally renumbering argument or return diagnostics breaks immutable
language tests. Emitting both codes fails the exact-one diagnostic authority and reports one root
cause twice. Context-dependent codes based on function names or missing `main` are semantically
indefensible. Changing the selected oracle rewrites reviewed RD-03 truth.<br>
**Confidence:** High.<br>
**Hardening:** Focused compiler implementation tests must cover each retained boundary, and the
real selected diagnostic routes must all pass exact code/phase/severity comparison.<br>
**Policy version:** 1.<br>
**Root Invocation ID:** `exec-rd04-20260822-01`.<br>
**Reopen trigger:** General user calls or `poke` boolean values change code; a selected invalid
memory case emits zero/multiple diagnostics; or E10172's broader registry drift is silently claimed
resolved by this narrow compatibility seam.

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
