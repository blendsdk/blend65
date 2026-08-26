# Ambiguity Register: RD-05 Failure Reduction

> **Status**: ✅ GATE PASSED — all 14 items resolved
> **Last Updated**: 2026-08-26 09:01
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
