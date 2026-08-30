# Ambiguity Register: RD-05 Failure Reduction

> **Status**: ✅ GATE PASSED — all 29 items resolved; 15 added during execution
> **Last Updated**: 2026-08-30 14:27
> **Planning Target**: compiler-readiness/RD-05
> **Context Artifacts**: RD-05 and its passing preflight report; RD-02/RD-04 requirements and plans;
> current `@blend65/readiness` and `@blend65/readiness-execution` source, tests, manifests, and
> project policy
> **Modification Set**: this new RD-05 plan folder and the existing compiler-readiness feature
> roadmap; requirements, source, tests, `spec/`, and portfolio roadmap are read-only during planning
> **Mode**: strict scope · auto-design
> **Root Invocation ID**: `make-plan-rd05-20260826-0856`
> **Auto-Design Policy**: 1

| # | Category | Ambiguity / Gap | Options Presented | Decision | Status |
|---|---|---|---|---|---|
| AR-P1 | Technical unknowns | Which package owns each RD-05 responsibility without reversing package dependencies? | Existing two-package split; new package; execution monolith | Existing two-package split | ✅ Resolved |
| AR-P2 | Data & state | How are predicate, promotion, envelope, policy, and disposition values split into closed versioned modules? | Cohesive per-domain modules; one aggregate schema; extend RD-04 contracts | Cohesive `failure-*` domain modules; leave RD-04 contracts unchanged | ✅ Resolved |
| AR-P3 | Integration points | How does raw malformed source enter replay and diagnostic execution without weakening typed-case authority? | Separate opaque malformed authority arm; widen typed cases; unauthenticated raw source | Separate opaque `MalformedDiagnosticCaseV1` and `MalformedReplayEnvelopeV1` arm | ✅ Resolved |
| AR-P4 | Behavioral gaps | Which deterministic algorithm and file seam implement catalog-wide one-minimal reduction? | Ordered restart-to-fixed-point reducer; worklist reducer; global search | Ordered first-preserving edit with restart and final complete catalog pass | ✅ Resolved |
| AR-P5 | Integration points | How does a reduced candidate traverse the original RD-04 route contract with a new identity? | Dedicated candidate request arm; mutate/reuse case identity; direct compiler call | Dedicated authenticated candidate request arm through published handlers | ✅ Resolved |
| AR-P6 | Security & compliance | Where do immutable cores/events/activations publish, and which secure filesystem boundary owns writes? | Execution-owned secure publisher using generalized primitives; readiness-owned Node writer; mutable merged record | Readiness schemas/encodings plus execution-owned generalized secure publisher | ✅ Resolved |
| AR-P7 | Behavioral gaps | How are fresh confirmation and stateful-sequence reproduction scheduled? | Dedicated bounded fresh-worker coordinator; reuse campaign pool; always persist source alone | Fresh worker per standalone confirmation and per complete sequence attempt; ordered cases share only their attempt worker | ✅ Resolved |
| AR-P8 | Integration points | How are inactive candidates activated into immutable specification tests while commits stay green? | Repository activation manifest plus implementation-blind spec runner; generated test files; expected-failure tests | Fail-closed repository activation manifests consumed by one implementation-blind spec runner | ✅ Resolved |
| AR-P9 | Integration points | How does RD-05 consume RD-04 results without changing the selected RD-04 authority-report format? | Join a genuine report to live authorities/campaign in a new orchestrator; extend report wire format; scrape report-only evidence | Join genuine live authority and immediately materialize a separate complete failure envelope | ✅ Resolved |
| AR-P10 | Non-functional gaps | What coverage and verification thresholds govern the new security/identity core? | Exact verify plus ≥90% branch coverage for new cores; exact verify only; whole-package threshold increase | Exact verify plus checked per-file ≥90% branch coverage for every RD-05-owned core | ✅ Resolved |
| AR-P11 | Naming & terminology | What stable file/API names and plan component boundaries will execution use? | Five focused components with `failure-*`/`reduction-*` names; fewer large modules; many micro-modules | Five component specifications and focused kebab-case modules below 500 lines where practical | ✅ Resolved |
| AR-P12 | Technical unknowns | What command is authoritative for every plan verification checkpoint? | Exact AGENTS.md verify command; package-only checks; CI workflow approximation | Exact AGENTS.md install/build/typecheck/lint/test command | ✅ Resolved |
| AR-P13 | Integration points | How does RD-05 handle invalidation of the content-bound selected RD-04 execution-handler publication when route bytes change? | Extend then regenerate/review/rerun/reselect; bypass published authority; leave selected authority stale | Extend genuine handlers, then regenerate, run real acceptance, independently review, prepare, and atomically reselect | ✅ Resolved |
| AR-P14 | Data & state | How can an immutable activation record name a green verification commit when it is itself introduced by a commit? | Reference an already-green fix commit from a later activation commit; self-hash placeholder; mutable post-commit rewrite | Two-checkpoint activation referencing an already-green ancestor commit | ✅ Resolved |
| AR-P15 | Runtime — API surface | Which exact Phase 1 identity and campaign-budget operations let immutable specifications exercise the approved contracts without inventing implementation details? | Closed validating constructors plus free operations over opaque state; method-bearing authority; generic counter-by-name mutation | Closed identity constructors and a closed operation union over a WeakMap-backed budget authority | ✅ Resolved |
| AR-P16 | Runtime — invalid classification shape | How can ST-02 return `unsupported` for hostile/open tuples without retaining or fabricating an `ExecutionResultV1`? | Discriminated unsupported-input arm without `result`; retain unsafe input; fabricate a safe result | Discriminated unsupported-input arm omits `result`; valid tuples retain a normalized result | ✅ Resolved |
| AR-P17 | Runtime — compatibility fixture authority | How can ST-12 prove RD-04 V1 bytes stay unchanged after readiness source truthfully invalidates the old source-bound parent? | Frozen preimplementation report vector; weaken parent freshness; refresh/select publication in Phase 1 | Frozen exact preimplementation report bytes/digest plus unchanged execution-production guard | ✅ Resolved |
| AR-P18 | Runtime — inherited historical parent fixture | How can existing RD-04 catalog/orchestration specs keep exercising the exact parent they name after RD-05 changes current readiness authority bytes? | Exact test-owned parent-authority overlay; weaken resolver freshness; refresh/select current publications every phase | Overlay only the named historical parent's changed authority files inside its temporary fixture | ✅ Resolved |
| AR-P19 | Runtime — Phase 2 callable contract | Which exact closed API lets an implementation-blind specification prove malformed ingress, historical resolution, family invariants, catalog behavior, candidate tokens and reduction without test-only hooks or caller callbacks? | Layered free-function protocol behind the existing internal subpath; session-only public API; test-only fixture hooks | Layered free-function protocol: root exports genuine authority/session/projection operations; `failure-reduction-internals` exports the closed invariant/catalog mechanics | ✅ Resolved |
| AR-P20 | Runtime — published invalid-case restart seam | How does a restart consumer mint typed-invalid authority when the selected context hides its exact generator/boundary/renderer capabilities? | Narrow diagnostic-from-intent factory; expose a general prepared campaign; accept semantically equivalent caller campaigns | Narrow `createPublishedDiagnosticCaseFromIntentV1` factory over exact semantic intent and one shared private preparation path | ✅ Resolved |
| AR-P21 | Runtime — Phase 2 candidate-authority boundary and review remediation | Which authority belongs in Phase 2, and which review blockers must close before the phase completes? | Candidate/token core now and route/control/sequence in Phase 3; claim all execution authority now; defer review blockers | Keep reusable candidate/token authority in Phase 2, retain route/control/sequence authority in Phase 3, and fix every fail-closed/boundedness blocker now | ✅ Resolved |
| AR-P22 | Runtime — current parent publication lifecycle | How do Phase 2 tests use current five-binding oracle authority when the selected RD-04 nine-binding release is source-stale and real reselection belongs to Phase 6? | Materialize a current five-over-four test parent; reselect production now; forge the old release as current | Materialize and pin the deterministic current test parent over the immutable four-binding base; leave real review/selection to Phase 6 | ✅ Resolved |
| AR-P23 | Runtime — Phase 2 re-review integrity and boundedness | How must the reducer close surviving authority, identity, handoff and cost-model defects without widening Phase 3 scope? | Repair all Phase 2 invariants and expose only terminal candidate authority; defer them; move confirmation into Phase 2 | Repair all Phase 2 invariants, meter descriptor preparation, bound inspection, and expose a terminal-only authority handoff while retaining execution/confirmation in Phase 3 | ✅ Resolved |
| AR-P24 | Runtime — Phase 3 callable authority protocol | Which exact callable interfaces let the immutable Phase 3 specification exercise genuine isolation lifecycles, report-sidecar association, ordered sequence positions, controls and worker observations without exposing caller-selected handlers or inventing test hooks? | Package-private protocol session; exported internal subpath; high-level public coordinator; widened public mechanism APIs | Package-private `failure-execution-internals.ts` protocol session with opaque WeakMap authorities and authenticated observation projections | ✅ Resolved |
| AR-P25 | Runtime — Phase 3 fixture observation authority | How should the frozen Phase 3 fixture correct a predicate observation digest that does not match its supplied observation bytes, after the initial RED stopped before fixture construction? | Align fixture bytes to the named observation; replace the predicate with the empty-byte digest; weaken production validation | Preserve the authored named observation, supply its exact UTF-8 bytes, and freeze the complete four-file oracle bundle | ✅ Resolved |
| AR-P26 | Runtime — Phase 3 fixture module graph | How should the oracle ensure its APIs and genuine WeakMap-backed fixture authorities come from one module graph after controlled adapter installation? | Construct each fixture before importing its APIs; redesign fixture/API loading; accept cross-registry authorities | Construct each fixture first, then load APIs inside that same reset epoch; keep production authority registries strict | ✅ Resolved |
| AR-P27 | Runtime — Phase 3 raw fixture authority | How should raw-malformed oracle cases satisfy the approved invalid-diagnostic predicate, exact route-plan digest and strict UTF-8 ingress while retaining zero/nonzero raw coverage? | Derive a genuine raw predicate/digest and use valid malformed-language UTF-8; weaken production validation; admit invalid UTF-8 | Explicitly derive the raw predicate and exact byte digests; use `@` as valid UTF-8 malformed-language input | ✅ Resolved |
| AR-P28 | Runtime — Phase 3 external fixture entrypoints | How should true Worker/subprocess fixtures resolve executable JavaScript when Vitest imports their TypeScript controller from `src/`? | Bind to prebuilt `dist/test-fixtures` entries; add a runtime TypeScript loader; treat module-load crashes as scenario outcomes | Resolve both true-external adapters from the package's build-before-test `dist/test-fixtures` output | ✅ Resolved |
| AR-P29 | Runtime — Phase 3 sequence oracle time bound | How should the ten-independent-fixture sequence matrix fit a truthful bounded test when measured fixture setup already exceeds the global 240-second timeout? | Set a case-local measured timeout; raise the package/global timeout; reduce fixture independence or matrix coverage | Apply a measured 900-second timeout only to the complete ten-fixture sequence test | ✅ Resolved |

## Resolution Notes

### AR-P1 — Package ownership

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal architecture inside approved package and behavior boundaries.
**Objective:** Preserve dependency direction and keep domain authority independent of host I/O.
**Decision:** `@blend65/readiness` owns closed models, identity, replay, reduction, evidence schemas,
and lifecycle; `@blend65/readiness-execution` owns route execution, workers, orchestration, and
filesystem publication.
**Evidence:** `readiness` has no toolchain dependency; `readiness-execution` already depends on it
and the compiler/toolchain.
**Rejected alternatives:** A new package adds forwarding/authority ambiguity; an execution monolith
couples domain semantics to Node processes.
**Strongest counterargument:** Cross-package protocols add integration surface.
**Confidence:** High — change only if implementation proves a dependency cycle or independent
multi-package consumption.
**Hardening:** Challenger converged.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** A real cycle appears or a third consumer needs the whole reduction application.

### AR-P2 — Closed domain modules

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal file/module decomposition.
**Objective:** Keep versioned identities and parsers reviewable without enlarging RD-04 wire types.
**Decision:** Add focused modules for contracts/policy, identity, envelopes, malformed authority,
catalog/reducer, candidate authority, evidence, and regression lifecycle; export only reviewed public
seams.
**Evidence:** Existing contract and orchestration files are already 700+ lines and RD-04 report
serialization is closed/content-bound.
**Rejected alternatives:** One aggregate schema becomes monolithic; extending RD-04 contracts
breaks authority compatibility.
**Strongest counterargument:** More files increase navigation cost.
**Confidence:** High — reopen only if a module cannot retain a single responsibility.
**Hardening:** Forced decomposition review retained cohesive domain modules.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Any proposed module remains under roughly 100 lines and has no independent API.

### AR-P3 — Raw malformed ingress

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal authority/interface mechanism required by approved malformed behavior.
**Objective:** Admit exact, including empty, UTF-8 bytes without weakening typed case invariants.
**Decision:** Introduce separately branded `MalformedDiagnosticCaseV1` and
`MalformedReplayEnvelopeV1`, constructed only from bounded source, reviewed rule/obligation,
selected diagnostic-oracle authority, and canonical token/text provenance.
**Evidence:** Current generated cases are typed valid/invalid projections and existing diagnostic
authority regenerates only campaign ordinals.
**Rejected alternatives:** Widening typed cases destroys typed invariants; unauthenticated bytes
bypass oracle/route authority.
**Strongest counterargument:** A second replay arm increases parser and test surface.
**Confidence:** High — the existing union has no viable raw arm.
**Hardening:** In-context adversarial review found no narrower compliant seam.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** A pre-existing genuine raw-source authority is introduced before execution.

### AR-P4 — Reduction algorithm

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Algorithm and data-structure choice.
**Objective:** Produce deterministic one-minimal results within selected budgets.
**Decision:** Enumerate the closed catalog in canonical order, accept the first strictly smaller
predicate-preserving candidate, restart at the first transformation, and finish only after one
complete catalog pass accepts nothing.
**Evidence:** Strict size tuples prove termination; the RD explicitly rejects global minimality.
**Rejected alternatives:** A worklist adds ordering/state complexity; global search is infeasible
under bounded execution.
**Strongest counterargument:** Restarting can repeat catalog scans.
**Confidence:** High — bounded attempts cap the cost and identity binds the policy.
**Hardening:** 10×-budget reframing still favored determinism over global search.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Measured catalog rescans exceed selected limits on known-reducible fixtures.

### AR-P5 — Candidate execution authority

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Complex internal protocol design inside approved authority policy.
**Objective:** Execute transformed bytes through unchanged obligation/tier/policy/fixture/oracle.
**Decision:** Add a dedicated discriminated candidate request arm derived from genuine
`ReductionCandidateAuthorityV1`; published tier handlers accept it only after original route-contract
and new candidate identity validation. A closed family-specific payload and purpose-limited
candidate runtime authority adapt transformed source/semantics to route, live-handler, ACME, VICE,
and runtime-evaluation consumers without forging `ExecutionCaseV1` or reusing original expected
runtime bytes.
**Evidence:** Current handlers already consume a closed request union and are the only reviewed path
through workers, ACME, VICE, and oracle evaluation.
**Rejected alternatives:** Reusing identity falsifies provenance; direct invocation bypasses route
and publication authority.
**Strongest counterargument:** Candidate branches can duplicate validations and drift.
**Confidence:** High — shared route-contract validators and cross-arm conformance tests contain it.
**Hardening:** Challenger converged; it allowed future generalization only if brands stay distinct.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** A smaller generalized authenticated payload union proves equivalent fail-closed behavior.

### AR-P6 — Secure immutable publication

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Sensitive persistence mechanism inside the approved immutable/no-follow policy.
**Objective:** Publish canonical records durably without duplication, lost updates, or authority drift.
**Decision:** Readiness authorizes canonical bytes and digests; execution generalizes its pinned,
no-follow, synced, no-clobber filesystem primitives and accepts only branded authorized records.
**Evidence:** Existing execution primitives already prove inode identity, exclusive temporary
writes, byte revalidation, and directory durability.
**Rejected alternatives:** A readiness writer duplicates sensitive code; mutable merging reopens
lost-update and crash hazards.
**Strongest counterargument:** Split schema/write ownership needs an unforgeable byte handoff.
**Confidence:** High — opaque authorized-record capabilities close that seam.
**Hardening:** Challenger converged.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Another independent package requires the same publisher, justifying a lower-level package.

### AR-P7 — Confirmation coordination

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Concurrency and recovery mechanism.
**Objective:** Distinguish standalone, sequence-dependent, and flaky failures.
**Decision:** A bounded coordinator acquires a fresh worker-thread/V8 isolate/root for each of two
standalone confirmations and for each complete sequence attempt; ordered cases reuse their dedicated
attempt worker through the selected maximum of 64 so cross-case state can reproduce while ordinary
per-case workspaces still clean up. Independent attempts never share state, the coordinator bypasses
the campaign pool's eight-case retirement, and external tool subprocesses remain route-isolated.
**Evidence:** The current executor intentionally reuses workers for up to eight cases.
**Rejected alternatives:** Pool reuse preserves contamination; source-only persistence misclassifies
stateful defects.
**Strongest counterargument:** Fresh isolates and external subprocesses are expensive.
**Confidence:** High — the cost applies only to final confirmation/sequence reproduction.
**Hardening:** Performance reframing retained isolation at the final boundary.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** The worker gains a formally verified complete reset primitive.

### AR-P8 — Regression activation

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Complex test architecture inside approved inactive/active behavior.
**Objective:** Make active regressions immutable and green without manufacturing mutable tests.
**Decision:** Store inactive cores under tracked readiness evidence; activation adds one immutable
marker. A co-located readiness-execution spec runner traverses from activation roots, validates the
complete reachable activation/core graph, and registers one stable test per active key;
malformed, duplicate, missing, or forged reachable authority fails the suite. Valid unreferenced
events remain inactive reconciliation evidence and emit only a diagnostic.
**Evidence:** The repo tracks readiness authorities and uses implementation-blind co-located spec
tests; execution owns compiler/tool routes.
**Rejected alternatives:** Generated tests drift and duplicate harnesses; expected-failure tests
approve defects.
**Strongest counterargument:** Dynamic discovery can conceal omissions.
**Confidence:** High — explicit zero/malformed/duplicate/missing-graph tests make discovery closed.
**Hardening:** Challenger converged and added fail-closed graph loading.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Vitest cannot expose stable per-key cases or implementation blindness forbids enumeration.

### AR-P9 — RD-04 join and envelope materialization

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Complex compatibility/integration mechanism.
**Objective:** Obtain complete shrink authority without changing `ExecutionAuthorityReportV1`.
**Decision:** A new orchestrator validates an existing report against genuine parent, execution,
oracle, campaign, route, and result authority. Report authorization privately binds an ordered
handler-minted predicate-sidecar map without changing V1 bytes. The orchestrator creates a complete
`FailureEnvelopeV1` only when all authority is resolvable; otherwise it creates a closed durable
unavailable-source run without pretending an envelope exists.
**Evidence:** The report retains digests/results but not source, IR, route bytes, or replay envelope;
its V1 serializer is exact and content-bound.
**Rejected alternatives:** Extending V1 breaks compatibility; report-only processing cannot replay
or authenticate candidate bytes.
**Strongest counterargument:** Old reports cannot reduce without resolvable live authority.
**Confidence:** High — unavailable authority already has a closed RD outcome.
**Hardening:** Challenger converged and required immediate sidecar materialization.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Reduction must begin in a disconnected process; add a separate bundle, never mutate V1.

### AR-P10 — Quality thresholds

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Testing and verification strategy.
**Objective:** Hold new identity/security cores to the established readiness quality floor.
**Decision:** Require checked exact RD-05 source lists and Vitest `perFile` branch coverage of at
least 90% in both packages. A Git-baseline freshness command independently derives every changed
production participant, classifies new cores versus legacy hosts/generated/barrels, and prevents a
self-declared allowlist from omitting a touched file. The exact repository verification command
remains mandatory.
**Evidence:** RD-04 used focused 90% branch floors; package scripts already expose coverage.
**Rejected alternatives:** Exact verify alone has no branch floor; raising whole-package floors
would expand unrelated remediation.
**Strongest counterargument:** Focused thresholds require maintained include lists.
**Confidence:** High — component-owned lists are stable plan deliverables.
**Hardening:** Scope check rejected unrelated whole-package cleanup.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Vitest cannot measure the selected modules independently.

### AR-P11 — Names and components

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal naming and file layout.
**Objective:** Keep a large feature navigable and below the project's file-size ceiling.
**Decision:** Use five owning component specs—contracts/history, reduction engine,
candidate execution, evidence/regressions, orchestration/closeout—and focused kebab-case
`failure-*`/`reduction-*` source modules, normally below 500 lines and never above 700.
**Evidence:** Several predecessor files already exceed 700 lines; project conventions require splits.
**Rejected alternatives:** Fewer components grow monoliths; premature micro-modules obscure flow.
**Strongest counterargument:** Five specs create more cross-references.
**Confidence:** High — reference-don't-restate keeps them compact.
**Hardening:** Contrarian simplification retained five cohesive ownership boundaries.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Authoring reveals a component with multiple independent state machines.

### AR-P12 — Verification command

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Detectable project verification mechanism.
**Objective:** Use the repository's declared green checkpoint.
**Decision:** Every phase uses
`yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`.
**Evidence:** Root `AGENTS.md` names this exact command as mandatory before every commit.
**Rejected alternatives:** Package-only checks miss boundaries; approximating CI diverges from policy.
**Strongest counterargument:** The full suite is expensive.
**Confidence:** High — package-focused checks may precede it, never replace it.
**Hardening:** No change.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Project guidance changes the authoritative command.

### AR-P13 — Content-bound handler refresh

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Complex compatibility/recovery sequencing required by current authority design.
**Objective:** Keep the selected execution child truthful after handler bytes change.
**Decision:** Regenerate/check handler closures after every phase's final participating-byte change
before verification/commit. After final code review, rerun genuine ACME/VICE acceptance,
independently review exact bytes/evidence, prepare a new immutable child, atomically select it, and
run only non-mutating post-selection checks. Earlier phases never prepare or select a child.
**Evidence:** `execution-route-adapters` participates in all six generated handler closures and the
selected pointer names one exact immutable child.
**Rejected alternatives:** A bypass violates route authority; stale selection claims obsolete bytes.
**Strongest counterargument:** This is an expensive local-emulator closeout gate.
**Confidence:** High — it is the only viable path if adapter bytes change.
**Hardening:** Challenger converged; no omitted option was stronger.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Final dependency-closure proof shows no selected handler byte changed.

### AR-P14 — Green activation commit identity

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal lifecycle and immutable-record mechanism within approved green activation.
**Objective:** Record a truthful immutable commit identity without circular self-reference.
**Decision:** The compiler fix or already-passing proof lands and verifies first. A later activation
commit adds the immutable marker containing that exact lowercase 40-hex commit ID, proves with fixed
argv-only Git probes that current `HEAD` descends from it, reruns the unchanged candidate, and
remains green. CI fetches full history so the proof is available for detached pull-request heads.
**Evidence:** A Git commit cannot contain its own final hash; activation may not mutate candidate or
marker bytes after publication.
**Rejected alternatives:** A placeholder is not authority; a post-commit rewrite violates
immutability and changes the commit again.
**Strongest counterargument:** Activation requires a second commit/checkpoint.
**Confidence:** High — two immutable commits are the only non-circular Git representation.
**Hardening:** Forced self-reference analysis eliminated single-commit encodings.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Activation authority moves to an external append-only store with its own commit identity.

### AR-P15 — Phase 1 identity and budget operations (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal API and data-structure design inside approved disposition, identity, and
resource-policy behavior; it changes no product scope or acceptance criterion.
**Objective:** Give implementation-blind specifications a complete closed interface without
exposing mutable state or allowing callers to bypass coupled resource charges.
**Decision:** Add validating `deriveFailurePredicateIdentityV1`, `derivePromotedFailureKeyV1`, and
`deriveFailureReductionRunIdentityV1` constructors using the existing optional
`IdentityCollisionRegistry`. Add `createFailureCampaignBudgetAuthorityV1`,
`chargeFailureCampaignBudgetV1`, and `getFailureCampaignBudgetSnapshotV1` as free operations over
one opaque WeakMap-backed authority. Charges use a closed purpose union—transformation, route by
reduction/confirmation/control purpose, oracle evaluation, diagnostic capture, provenance read or
write, sequence case, core write, terminal envelope/run write, and terminal summary write—so every
operation atomically increments campaign plus applicable category/byte counters. Construction
accepts only non-pass/resolvable cardinalities and rejects an insufficient terminal reserve.
Core and run byte limits apply per complete record, with the accounting snapshot retaining the
largest observed record size rather than an invalid campaign-total sum.
**Evidence:** Existing readiness identities use validating free constructors plus the bounded
`IdentityCollisionRegistry`; execution capabilities use module-private state and closed passive
results. The resource contract couples campaign, category, byte, and terminal-reserve charges, so a
generic counter mutation could undercharge a real operation.
**Rejected alternatives:** A method-bearing branded value exposes more operational surface and is
easier to proxy incorrectly. A generic `charge(key, amount)` lets callers omit a coupled counter or
consume terminal capacity as discretionary work. Separate authority per counter recreates the
unbounded multiplication the shared campaign budget prevents.
**Strongest counterargument:** A closed operation union must grow if a later approved operation has
new accounting semantics.
**Confidence:** High — the union already covers every operation named by the approved plan; a new
accounting class is an objective reopen trigger.
**Hardening:** Forced 10×-load and hostile-caller reframing retained atomic closed operations and
rejected caller-selected counters.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260826-1642`
**Reopen trigger:** A required Phase 2–5 operation cannot be represented without either undercharge
or a semantically false existing purpose.

### AR-P16 — Unsupported hostile classification input (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal closed-result representation inside the already approved fail-closed
`unsupported` behavior; it changes no product scope or acceptance criterion.
**Objective:** Satisfy ST-02 without allowing malformed, accessor-bearing, copied, extended, or
future-version execution input to become trusted evidence.
**Decision:** Make `ClassifiedFailureV1` a discriminated union. A structurally valid execution
result—including `pass` or a known but route-disallowed tuple—is defensively normalized and retained
in a classification whose disposition may be `unsupported`. If either input has an invalid/open
shape, classification still succeeds as the required fail-closed `unsupported` arm, sets cleanup
to `cleanup-clear`, and omits `result` entirely. Downstream reduction can therefore persist an
unsupported outcome without reading, retaining, or fabricating execution evidence.
**Evidence:** Frozen ST-02 requires a successful `unsupported` classification for unknown code,
stage, tier, extra keys, and route mismatch. The declared `ExecutionResultV1` cannot truthfully
represent unknown/open input, while retaining it would export unvalidated caller state and
fabricating a replacement would create false historical evidence.
**Rejected alternatives:** Retaining the caller value violates the hostile-input boundary;
fabricating a valid result violates evidence truth; returning an operation failure contradicts the
frozen specification's closed unsupported outcome.
**Strongest counterargument:** Consumers must handle an unsupported arm without a result projection.
**Confidence:** High — the union makes that obligation explicit and prevents unsafe evidence use.
**Hardening:** Hostile-input, authority-truth, and downstream-persistence reframing eliminated both
retention and fabrication.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260826-1642`
**Reopen trigger:** A durable unsupported record requires a bounded canonical projection of the
rejected shape; add a separate diagnostic projection, never widen `ExecutionResultV1`.

### AR-P17 — Historical report compatibility fixture authority (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Test-fixture representation for an already approved byte-compatibility assertion;
it changes no report schema, production authority, publication lifecycle, or acceptance criterion.
**Objective:** Keep ST-12 executable after the intended readiness source additions without
weakening content-bound publication freshness or selecting an unreviewed child.
**Decision:** Freeze the exact canonical RD-04 V1 report bytes and digest obtained at the recorded
preimplementation commit, then assert those historical bytes remain byte-identical while the new
RD-05 public surface is observed. Pair that vector with the Phase 1 source-ownership/freshness gate,
which rejects any report serializer/orchestration production change while allowing the required
review-only generated binding refresh. Do not reconstruct a new report from the current source
during this historical-compatibility case. Genuine current-authority campaign
execution remains in the later integration and publication phases after the reviewed authority is
refreshed.
**Evidence:** The ST-12 baseline was GREEN before production. Adding the required readiness root
exports changes bytes bound by the committed readiness parent; the genuine fixture then correctly
fails `execution.stale-authority /parentDigest`. Refreshing/selecting publication in Phase 1 would
contradict the reviewed Phase 6 lifecycle, while weakening freshness would make the authority lie.
**Rejected alternatives:** Ignoring parent staleness violates content-bound authority; refreshing
or selecting early bypasses final review/real acceptance; dropping ST-12 loses the compatibility
gate.
**Strongest counterargument:** A frozen byte vector does not alone exercise the serializer after
the source change.
**Confidence:** High — existing serializer implementation tests still exercise authorization and
canonical serialization, while the independent source guard proves Phase 1 does not alter that
report production path.
**Hardening:** Authority-truth and lifecycle-order reframing ruled out both bypass and early
publication.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260826-1642`
**Reopen trigger:** The execution report serializer or report schema becomes an authorized RD-05
production participant; then a new versioned report compatibility vector and publication review
are required.

### AR-P18 — Inherited historical-parent fixture authority (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Test-fixture reconstruction of an already immutable published parent; it changes no
resolver, publication, selection, or product behavior.
**Objective:** Keep inherited RD-04 catalog and orchestration specifications truthful while RD-05
intentionally changes current readiness authority bytes before final publication refresh.
**Decision:** The temporary RD-04 catalog fixture continues to name parent
`sha256:e5796e6f2abab401100f93547b4044c57a762b9ec7703e6183fda2c07afcd3e5` and overlays only
the exact test-owned preimplementation bytes for authority files changed by RD-05. All other
authority and publication bytes still come from the repository and retain the existing bounded,
no-symlink copy checks. The production resolver remains strict. Current-source publication refresh,
review, real acceptance, and selection remain Phase 6 work.
**Evidence:** The inherited fixture currently copies the current `packages/readiness` authority
tree, then asks the resolver to validate the old named parent. RD-05 changes the readiness package
manifest, root barrel, and canonical identity domain, so the resolver correctly returns
`execution.stale-authority /parentDigest`. The exact old bytes exist at the recorded Phase 1
ancestor and are the authority that the immutable parent review actually accepted.
**Rejected alternatives:** Weakening the resolver would make stale authority live; refreshing and
selecting on every intermediate phase would bypass the reviewed final lifecycle and make historical
tests stop testing their named parent; skipping inherited tests violates the full verification gate.
**Strongest counterargument:** Test-owned source snapshots duplicate a small amount of historical
authority.
**Confidence:** High — the overlay is bounded to exact changed files and is hash-reviewed as part of
the inherited fixture; it reconstructs rather than substitutes authority.
**Hardening:** Historical-identity and source-archive portability checks rejected a Git-history
runtime dependency and a resolver bypass.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260826-1642`
**Reopen trigger:** Another current-source change touches a dependency in the named parent's exact
authority closure; add its preimplementation bytes to the same bounded fixture overlay.

### AR-P19 — Complete Phase 2 callable contract (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal API, data-shape and testability design inside the approved Phase 2
behavior and existing package boundary; it changes no product behavior, acceptance criterion,
security policy or scope.
**Objective:** Give the implementation-blind specification author a complete non-guessing packet
while keeping every executable authority opaque and preventing test-only production seams.
**Decision:** Use the layered free-function protocol now specified completely in
`03-02-reduction-engine.md`. Root exports accept only genuine existing typed-valid,
typed-invalid or malformed authorities, expose opaque historical resolvers/candidates/sessions and
defensive passive projections, and return closed operation results. The existing purpose-limited
`@blend65/readiness/failure-reduction-internals` subpath alone exposes family drafts,
validate/enumerate/apply/normalize operations and single-use invocation consumption needed by the
specification and the later execution package. Historical parsing consumes a WeakMap-backed
resolver built from digest-verified canonical authority records and discriminates `resolved` from
`historical-authority-unavailable`; the unavailable arm contains no envelope. Catalog edits and
normalization are distinct proposal kinds, so changed executable bytes must be evaluated before
adoption. The specification may construct a genuine published-oracle context only through the
existing historical publication fixture, resolver and `createPublishedOracleContext`; no forged
test context is added.
**Evidence:** The first specification-author dispatch stopped without editing because the plan
omitted seven required schema/signature groups. Existing `ExecutionCaseV1`,
`PublishedDiagnosticCaseV1` and `FailureCampaignBudgetAuthorityV1` already use the selected opaque
brand plus module-private WeakMap/free-operation pattern. Direct invariant and catalog operations
are necessary to make the authorized negative cases observable without implementation-specific
injection hooks.
**Rejected alternatives:** A session-only API cannot independently exercise invalid candidate
tuples, illegal non-decreasing edits, normalization cycles or direct token substitution; adding
test-only hooks would couple the immutable oracle to implementation and create a production bypass.
**Strongest counterargument:** The internal subpath freezes more mechanical shapes and makes catalog
evolution deliberately versioned.
**Confidence:** High — reopen only if the immutable cases are explicitly re-scoped away from direct
contract verification or a smaller protocol proves the same negative cases without injection.
**Hardening:** Independent challenger selected the same layered protocol and required genuine source
authorities, an opaque record resolver, runtime-opaque validated candidates/tokens, and distinct
catalog-versus-normalization proposals.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260829-resume`
**Reopen trigger:** A required specification case cannot be expressed from the completed packet, or
an operation can mint executable authority from passive caller data alone.

### AR-P20 — Published invalid-case restart seam (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Purpose-limited API completion required to exercise the already approved genuine
typed-invalid authority after restart; it changes no result semantics, route, publication policy or
scope.
**Objective:** Let a consumer holding only a genuine selected `PublishedOracleContext` mint the
existing `PublishedDiagnosticCaseV1` without exposing or accepting executable campaign
dependencies.
**Decision:** Add `createPublishedDiagnosticCaseFromIntentV1(context, intent)` to the existing
published-oracle subpath. Its exact hostile input contains only schema version, rule ID, seed,
configuration and ordinal. A shared source-private helper authenticates the context, selects the
historical generator, boundary transform, renderer and modeled suite from WeakMap state, prepares
the campaign, and regenerates the ordinal. The new factory then uses the existing diagnostic join
and returns only its opaque capability. `PreparedCampaign` remains private.
**Evidence:** The first corrected Phase 2 fixture could resolve the selected nine-binding context
and mint typed-valid `ExecutionCaseV1`, but every typed-invalid ordinal failed at `/campaign`: no
published API could reconstruct the hidden exact campaign capabilities required by the existing
diagnostic constructor after restart.
**Rejected alternatives:** Returning a general `PreparedCampaign` grants generation and valid-case
execution authority beyond the blocked diagnostic join and duplicates the existing general
campaign factory. Accepting a caller campaign by semantic output equivalence executes unselected
implementations before provenance validation and breaks exact historical authority.
**Strongest counterargument:** A future restart consumer might need the whole prepared campaign;
no independent approved consumer currently does.
**Confidence:** High — the narrow factory is sufficient for the established invalid-case join and
does not widen executable authority.
**Hardening:** Independent challenger selected the same diagnostic-from-intent seam, rejected both
general campaign exposure and semantic-equivalence fallback, and required one shared private
preparation helper.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260829-resume`
**Reopen trigger:** A separately approved restart workflow proves it needs the full prepared
campaign rather than a diagnostic authority.

### AR-P21 — Phase 2 candidate-authority boundary and review remediation (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal phase ownership and fail-closed repair inside the already approved RD-05
candidate/reducer design; it changes no product scope, acceptance criterion, public workflow, or
publication lifecycle.
**Objective:** Reconcile the overlapping Phase 2 candidate-authority task with the explicit Phase 3
execution/control/sequence tasks while closing the Phase 2 review's correctness, semantic, and
performance blockers without silently declaring absent behavior complete.
**Decision:** Phase 2 owns the reusable validated candidate authority, its passive candidate-source,
original-route/predicate/policy identity, reduction/confirmation invocation tokens, and a
session-owned monotonic proposal sequence. Phase 3 owns the family-specific execution payload and
candidate-relative runtime authority because only its execution join can derive the required fresh
semantic/fixture/oracle bytes without fabricating them; it also owns route consumption,
known-good-control authority, sequence-position authority and terminal-position enforcement, worker
isolation, and fresh confirmation. Task 2.2.6 is narrowed to that Phase 2 boundary; tasks 3.2.1 and
3.2.6 remain open and authoritative for execution payload/runtime and control/sequence behavior.
The review's historical reconstruction, witness/binding, catalog ordering and
applicability, budget binding, normalization accounting, token-consumption, boundedness, and module
structure findings are mandatory in-scope fixes before Phase 2 may close.
**Evidence:** The Phase 2 design defines candidate payload and reusable candidate-token authority,
while Phase 3 tasks 3.2.1–3.2.6 explicitly introduce route adapters, controls, sequence attempts,
terminal placement, and isolation. The original task text incorrectly claimed both sets at Phase 2
completion. Independent correctness, semantics, and performance reviews also proved the current
implementation can mint unrelated historical authority, accept unresolved candidate paths, choose
the wrong deterministic reducer path, bypass policy/token sequencing, and exhaust memory before
budget charging.
**Rejected alternatives:** Marking absent Phase 3 execution behavior complete would make the plan
false; implementing the entire execution/confirmation layer in Phase 2 would violate dependency
ordering and the immutable Phase 3 specification-first gate; deferring fail-closed and boundedness
repairs would leave Phase 2's delivered reducer unsafe.
**Strongest counterargument:** Defining execution, control, and sequence data types in Phase 2 could
make the later package easier to implement. The current envelope retains digests, not the canonical
fixture and fresh semantic/oracle bytes needed to populate those types truthfully; defining an
unconstructable authority earlier would invite fabrication rather than reduce Phase 3 risk.
**Confidence:** High — the boundary follows the named Phase 3 tasks and preserves every approved
RD-05 behavior.
**Hardening:** Two independent semantic/correctness reviews and a performance audit converged on
the same missing authority boundary and fail-closed defects; the ruling chooses the smallest phase
correction that leaves no claimed behavior unowned.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-resume`
**Reopen trigger:** A Phase 3 specification proves that route/control/sequence authority cannot be
implemented without changing the Phase 2 candidate payload or its authenticated identity.

### AR-P22 — Current parent publication lifecycle (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Test-fixture authority and lifecycle sequencing inside the already approved
content-bound publication design; no production publication is selected or pushed.
**Objective:** Keep Phase 2 historical and current publication tests truthful after readiness source
changes invalidate the selected RD-04 release, without performing Phase 6 review and selection early.
**Decision:** Isolated tests retain the immutable four-binding historical base and deterministically
prepare the five current oracle bindings into parent
`sha256:e65b95cdc817a6b2608d6965855ca1013f36b7893424d31d2f04fd18fa0845a5`.
The selected RD-04 nine-binding release remains historical evidence and is not treated as executable
under current source. Real child review, acceptance, and atomic selection remain owned by Phase 6.
The regenerated execution catalog and local VICE goldens bind the current source identities while
preserving binary bytes, layout, cycles, and target-visible results.
**Evidence:** Current source-derived oracle revisions are fresh, generated execution bindings pass
their freshness check, the isolated parent reproduces byte-for-byte, and real ACME/VICE acceptance
is green. Selecting a production release now would bypass the plan's later semantic review and
two-checkpoint lifecycle.
**Rejected alternatives:** Early production reselection violates phase ordering; weakening freshness
or presenting the stale nine-binding release as current falsifies authority; fabricating a current
release from old bytes defeats the content-derived identity contract.
**Strongest counterargument:** A test-only parent differs from the eventual nine-binding production
child. The fixture intentionally proves current five-binding oracle authority only; Phase 6 remains
responsible for the complete reviewed child and therefore cannot inherit this parent as selection
evidence.
**Confidence:** High — the separation matches the existing publication lifecycle and keeps every
authority claim content-derived.
**Hardening:** Exact generated-binding freshness, deterministic isolated publication, and real local
ACME/VICE acceptance converged on the same lifecycle boundary.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-resume`
**Reopen trigger:** Phase 3 requires a currently selected execution parent before Phase 6, in which
case the plan must explicitly move review and selection forward rather than weakening freshness.

### AR-P23 — Phase 2 re-review integrity and boundedness (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correctness, semantic and performance repair inside the approved malformed-ingress,
candidate-authority and deterministic-reducer boundary; no user-visible language or publication
scope changes.
**Objective:** Close the final independent re-review findings while keeping Phase 3 able to consume
the terminal reduction result without rebuilding or fabricating authority.
**Decision:** Raw required claims must equal the source rule exactly; both observation union arms
must digest-bind their retained bytes; malformed replay text must be well-formed Unicode at ingress,
history and direct identity derivation; and every supplied trace entry must match its private
predecessor chain. A completed session exposes one terminal-only candidate-authority operation bound
to its final trace, while Phase 3 still owns route execution, controls, isolation and confirmation.
Catalog descriptor preparation consumes the authenticated transformation budget before applying or
validating a candidate, typed descriptor discovery is capped by that budget, compatibility
inspection APIs are bounded by descriptor and aggregate source-byte work, and reducer-private
identity/trace checks use retained state instead of cloning complete source payloads.
**Evidence:** Correctness re-review reproduced raw-claim and trace-prefix substitution; semantic
re-review additionally reproduced lone-surrogate digest aliasing, not-reached evidence substitution
and the absent terminal authority handoff; performance re-review measured unbounded total catalog
materialization, eager typed allocation, duplicate proposal preparation and multi-gigabyte private
clone costs at allowed limits. Focused hostile tests now cover each counterexample and the frozen
specification oracle remains byte-identical.
**Rejected alternatives:** Deferring the findings leaves minted-but-unusable envelopes and permits
authority substitution; moving confirmation into Phase 2 violates the specification-first phase
order; rejecting all large candidate inputs would turn an implementation convenience into a user-
visible failure instead of returning deterministic campaign exhaustion.
**Strongest counterargument:** A terminal authority in Phase 2 anticipates a Phase 3 consumer. It is
the already-approved reusable candidate authority over the reducer's final genuine state, not a new
execution or confirmation authority, and prevents Phase 3 from reconstructing an opaque capability
from passive bytes.
**Confidence:** High — every change is the smallest closed repair for a reproduced counterexample
and preserves the existing phase boundary.
**Hardening:** Independent correctness, semantics and performance re-reviews converged on the same
authority and boundedness seams; all critical/major findings are resolved in scope.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-resume`
**Reopen trigger:** Phase 3 cannot consume the terminal authority without changing its candidate or
trace identity, or an allowed candidate can perform unmetered work above the inspection/campaign
bounds.

### AR-P24 — Phase 3 callable authority protocol (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal capability, lifecycle and implementation-blind test interfaces inside the
approved candidate execution, isolation and confirmation behavior; no product, retention, public
compatibility or scope decision changes.
**Objective:** Make every Phase 3 oracle executable through genuine authority while keeping handler,
worker, path and isolation selection outside caller control.
**Decision:** Add one co-located production module, `failure-execution-internals.ts`, that opens an
opaque protocol session only from a genuine selected parent, execution context, ordinary route and
failure envelope. Session-bound WeakMap operations mint the three fixed isolation modes, genuine
known-good control authority, attempt/position authority and authenticated path-free execution
observations; they own shutdown and reject copied, foreign, replayed, stale or cross-mode values.
The sequence state machine issues its own next position and rejects case 65 before recording any
launch checkpoint. A package-private report-sidecar accessor returns only the exact ordered
handler-minted collection retained beside a genuine report. The module is not exported by the root
barrel or package manifest. A second opaque session/step pair is the sole binder between genuine
standalone, control and sequence evaluations and the final confirmation disposition; the public
`confirmReducedFailureV1` drives that same state machine internally, while the co-located oracle can
step it without injecting execution behavior. Fixed co-located scenario fixtures replace only true
worker/process adapter modules in a fresh test module graph before genuine context resolution; they
run independent worker threads/subprocesses and never replace the fixed handler chain or enter a
caller-facing API.
**Evidence:** Candidate invocation creation/consumption already uses purpose-bound WeakMap authority;
live execution contexts already retain fixed handler tables behind genuine review/published
contexts; authority reports already separate private WeakMap authenticity from unchanged serialized
bytes; and all Phase 3 specifications are co-located in the execution package. The first independent
spec-author dispatch proved that the earlier prose-only mint/lifecycle descriptions were
insufficient to stage success and hostile cases without guessing.
**Rejected alternatives:** Exporting an internal package subpath is viable but lets every workspace
consumer import mechanism APIs; a second public coordinator duplicates the existing orchestration
state machine and makes hostile capability substitution less direct; widening the root API exposes
lifecycle machinery solely for test convenience.
**Strongest counterargument:** Package-private operations cannot support an immutable specification
owned by another package. Phase 3's oracle is intentionally co-located, while later public workflow
tests use the root create/execute/confirm APIs and do not need the mechanics.
**Confidence:** High — the selected seam matches current authority patterns and is the narrowest
interface that makes every approved Phase 3 behavior independently observable.
**Hardening:** An independent challenger rejected all three initial candidates as stated and
strengthened the internal-subpath option into a non-exported module-private protocol session; the
ruling adopts that tighter boundary with closed result types and path-free observations.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A required Phase 3 oracle must execute from outside the package, the genuine
fixed handlers cannot report root/worker/isolate checkpoints without exposing a caller-selected
execution dependency, or the shared confirmation machine cannot classify every approved outcome
from handler-authenticated evaluations alone.

### AR-P25 — Phase 3 fixture observation authority (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correcting contradictory specification-fixture evidence inside the already approved
Phase 3 oracle; production validation, product behavior and scope remain unchanged.
**Objective:** Restore a truthful join between the fixture's named observation predicate and the
observation bytes authenticated by the failure envelope after the initial RED stopped before fixture
construction and therefore failed to exercise that join.
**Decision:** Retain the authored `failure-observation` meaning and derive both its predicate digest
and envelope bytes from one shared label. The envelope receives the exact 19 UTF-8 bytes for that
label. The specification file stays byte-identical; the corrected fixture and the other two support
fixtures join it in a newly frozen four-file oracle-bundle hash.
**Evidence:** Envelope authorization correctly requires the predicate observation digest to equal
the SHA-256 digest of the supplied bytes. UTF-8 encoding of the ASCII label produces the same digest
preimage as the fixture helper and was verified directly. The previous empty byte array contradicted
the predicate and was rejected before any Phase 3 production operation ran.
**Rejected alternatives:** Replacing the named observation with the empty-byte digest discards
authored semantic evidence to accommodate an accidental placeholder; weakening envelope validation
would admit false historical authority and violate the approved security boundary.
**Strongest counterargument:** Confirmation currently classifies reproduction from status, code,
tier and stage, so empty observation bytes would not change that result. That does not make an
authenticated predicate/byte contradiction truthful and would optimize the oracle around an
implementation detail.
**Confidence:** High — the correction is a single-source derivation of the fixture author's existing
meaning and leaves production authority checks untouched.
**Hardening:** Independent design challenge selected the same correction, required a complete
transitive-oracle bundle freeze, and rejected both semantic erasure and production weakening.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The corrected fixture cannot construct genuine envelope authority, or future
predicate evaluation requires different observation bytes for this scenario.

### AR-P26 — Phase 3 fixture module graph (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correcting test setup order so approved opaque authority semantics are exercised in
one module registry; production behavior, expectations and scope remain unchanged.
**Objective:** Ensure every fixture authority is consumed only by APIs loaded in the same module
epoch after controlled worker/process adapter installation resets the Vitest module graph.
**Decision:** In every scenario and every sequence-loop iteration, construct the fixture first and
then load the API set immediately afterward. No intervening fixture creation or reset may occur.
Keep all 14 expectations unchanged and retain strict WeakMap-backed production authority checks.
**Evidence:** The fixture installs controlled true-external adapters with `vi.resetModules()` before
constructing its genuine parent, execution, origin and candidate. APIs loaded before that reset
necessarily reference a different private registry and correctly reject the fresh candidate.
**Rejected alternatives:** Accepting cross-registry authorities defeats the capability boundary; a
combined fixture/API loader is viable but expands support interfaces and changes every call shape
when a mechanical ordering correction restores the intended single-epoch semantics.
**Strongest counterargument:** Repeated temporal ordering can regress. A durable invariant comment
now sits beside the fixture wrapper, each loop reloads APIs inside its fixture epoch, and the complete
bundle hash detects later drift.
**Confidence:** High — the correction follows the existing adapter-install lifecycle and preserves
the exact security behavior the hostile oracle is meant to prove.
**Hardening:** Independent design challenge selected the same per-epoch ordering, explicitly rejected
production weakening, and required a new complete-bundle freeze because the specification bytes
changed.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any scenario creates or resets a fixture between API loading and authority use,
or same-epoch genuine authorities remain unavailable.

### AR-P27 — Phase 3 raw fixture authority (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correcting raw specification inputs to the already approved raw-malformed,
invalid-diagnostic and strict UTF-8 contracts; production behavior and test expectations remain
unchanged.
**Objective:** Make the empty raw envelope and nonempty raw projection cases exercise genuine raw
authority instead of contradicting Phase 1/2 validation.
**Decision:** The empty case explicitly derives an `invalid-diagnostic` predicate with
`diagnostic.malformed-source` as its primary and sole required claim, hashes its exact empty
observation bytes, and hashes its exact JSON route-plan bytes. The projection-only nonempty case uses
UTF-8 `@`, retaining an exact unknown-token byte span and malformed-language meaning without
introducing invalid encoding.
**Evidence:** Envelope authorization requires source family and original route kind to agree, rule
claims to match, observation digest to bind exact bytes, and route-plan digest to bind exact bytes.
Malformed ingress separately requires complete strict UTF-8, an invariant already verified and
accepted in Phase 2. Both prior inputs failed before Phase 3 routing.
**Rejected alternatives:** Reusing the typed-valid predicate fabricates route authority; a hardcoded
route digest does not bind its bytes; weakening strict UTF-8 reopens an explicitly closed Phase 2
contract; moving this single semantic construction into shared fixture support hides the normative
raw differences.
**Strongest counterargument:** The projection-only case originally used visibly invalid bytes. Its
asserted purpose is raw zero/nonzero separation without typed IR, not encoding rejection; `@` keeps
that exact purpose while respecting the separately tested ingress boundary.
**Confidence:** High — every corrected field derives from the exact authority bytes it claims.
**Hardening:** Independent design challenge required an allowlisted predicate construction, exact
observation/route hashing, valid malformed-language UTF-8, unchanged production validation, and a
superseding complete-bundle freeze.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Either corrected raw case still fails before its intended assertion, or raw
execution requires a route contract not represented by the approved invalid-diagnostic arm.

### AR-P28 — Phase 3 external fixture entrypoints (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correcting true-external test runtime paths inside the approved fixture architecture;
production worker/process behavior, crash classification and package API remain unchanged.
**Objective:** Execute the fixture's intentional pass/crash outcomes in real Node workers and
subprocesses instead of accidentally treating missing source-relative JavaScript as a scenario crash.
**Decision:** Resolve both entrypoints from `../../dist/test-fixtures/`, whose JavaScript is produced
by the package's mandatory build-before-test scripts. Keep TypeScript sources authoritative and add
no loader, source-side JavaScript duplicate, conditional fallback or package export.
**Evidence:** The source tree contains only `.ts` entries, both compiled `.js` files exist under
`dist/test-fixtures`, and exact tracing proved ordinal two selected `pass` before its Worker failed to
load the absent source-relative path. Standalone crash scenarios had masked the same defect.
**Rejected alternatives:** A TypeScript runtime loader diverges from production execution and adds
configuration; committed JavaScript wrappers duplicate generated code; package subpaths widen API
solely for tests; treating module-load failure as an intentional crash falsifies scenario evidence.
**Strongest counterargument:** Direct `vitest` without a build can now fail. The package's `test` and
coverage paths already run `tsc --build`, making compiled entry availability an explicit enforced
contract rather than an implicit fallback.
**Confidence:** High — both source and compiled import locations resolve the same package-local dist
entries, and no production byte or decision changes.
**Hardening:** Independent design challenge selected the dist path, rejected loader/duplicate/export
alternatives, required both worker and subprocess correction, and required a new bundle freeze.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A build-before-test run cannot load either compiled entry, intentional pass
ordinal still crashes before response, or subprocess activity cannot be observed through the entry.

### AR-P29 — Phase 3 sequence oracle time bound (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correcting one specification-test watchdog from measured genuine-fixture cost;
production behavior, fixture independence, cases, expectations and package-wide timeouts remain
unchanged.
**Objective:** Let the complete positions 2–9, 64 and pre-launch 65 matrix reach semantic assertions
without allowing unrelated package tests to hide behind a larger hang threshold.
**Decision:** Set only this test's timeout to 900,000 ms. Ten independent fixtures at the measured
60-second upper setup cost require about 600 seconds; a bounded 1.5 multiplier covers scheduling,
process launch and teardown variance while retaining a finite watchdog.
**Evidence:** The unchanged test stopped at the global 240,000 ms boundary before an assertion, which
can cover only about four measured fixtures. Named genuine fixture cases consistently take 53–60
seconds, and this test intentionally owns ten distinct publication/module epochs.
**Rejected alternatives:** A global timeout increase weakens hang detection across the package;
sharing fixtures or dropping positions violates authority independence and boundary coverage;
fixture-performance redesign is broader than the correctness gate and could change what is tested.
**Strongest counterargument:** A genuine deadlock now takes up to 15 minutes to report. The exception
is case-local, the healthy measured ceiling is about ten minutes, and approaching 15 minutes is an
explicit investigation trigger rather than permission to raise it again.
**Confidence:** High — the bound follows directly from measured fixture count and cost.
**Hardening:** Independent design challenge derived the same 900-second case-local limit, rejected
global/coverage changes, and required a superseding complete-bundle freeze.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A healthy named run approaches 900 seconds, times out again, or any fixture or
sequence expectation is removed to reduce runtime.
