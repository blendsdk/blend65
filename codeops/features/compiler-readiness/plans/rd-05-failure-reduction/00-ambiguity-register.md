# Ambiguity Register: RD-05 Failure Reduction

> **Status**: ✅ GATE PASSED — all 18 items resolved; 4 added during execution
> **Last Updated**: 2026-08-26 17:29
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
