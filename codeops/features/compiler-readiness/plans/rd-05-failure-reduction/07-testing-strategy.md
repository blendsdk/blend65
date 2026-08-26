# Testing Strategy: RD-05 Failure Reduction

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Each implementation phase starts with implementation-blind specification tests derived only from
RD-05 and this plan's resolved public interfaces. Each new specification file is observed RED for
the absent production capability and is immutable thereafter. Implementation tests cover internal
algorithms, fault injection, property invariants, compatibility, and focused branch coverage.

CI runs every contract, reducer, fake-worker, filesystem, regression-discovery, and orchestration
test. Real ACME/VICE confirmation remains locally gated but is mandatory before handler publication
refresh and selection. New failure-classification, reduction, authority, publication, activation,
and orchestration cores must each retain at least 90% branch coverage. (AR-P10)

## 🚨 Specification Test Cases

### Contracts and Historical Authority

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-01 | Exhaustive RD-04 code/tier/stage cross-product | Exactly one allowed primary disposition or `unsupported` | RD-05 AC-1 |
| ST-02 | Unknown code/stage/tier and extra keys | Fail closed as unsupported input; no shrink | RD-05 AC-1 |
| ST-03 | Cleanup absent/present beside every primary class | Separate `cleanup-clear`/`cleanup-blocked`; primary unchanged | RD-05 AC-1 |
| ST-04 | Mutate each predicate field independently | Predicate canonical bytes differ for every semantic field | RD-05 AC-2 |
| ST-05 | Same minimized content/predicate across campaigns | One equal promotion key despite distinct provenance | RD-05 AC-2/11 |
| ST-06 | Change selected policy/run identity only | Predicate/core key stable; event/run identity changes | RD-05 Policy |
| ST-07 | Replay typed historical envelope after authority revision | Exact original case, route, predicate, and bytes reproduce | RD-05 AC-7 |
| ST-08 | Missing/malformed/oversized historical content | `historical-authority-unavailable`; no current fallback | RD-05 AC-7 |
| ST-09 | Genuine raw malformed authority with exact/empty bytes | Accepted independently of typed authority and round trips exactly | RD-05 AC-5/19 |
| ST-10 | Plain/copy-forged raw or historical capability | Reject before source projection or execution | RD-05 Security |
| ST-11 | Each selected limit at exact/max/next and unsafe values | Exact allowed; next exhausts; hard/unsafe rejects before work | RD-05 AC-9 |
| ST-12 | Serialize an existing RD-04 report before/after RD-05 | Canonical bytes and digest remain byte-identical | RD-05 Historical authority |

### Deterministic Reduction

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-13 | Known typed-valid semantic failure | Strict shrink retains well-formed/type-correct primary witness | RD-05 AC-3/18 |
| ST-14 | Candidate that collapses to parser/type error | Invariant rejects; semantic predicate cannot be substituted | RD-05 AC-3 |
| ST-15 | Remove required versus incidental claim witnesses | Required removal rejects; incidental removal allowed only with witness | RD-05 MH-3 |
| ST-16 | Known invalid neighbor tuple | Baseline, transform, diagnostic contract, paths and one violation persist | RD-05 AC-4/18 |
| ST-17 | Every invalid transform kind after baseline edits | Target rebases and resolves exactly once or edit rejects | RD-05 Historical authority |
| ST-18 | Raw malformed zero-byte minimal reproducer | Exact empty bytes remain executable and promotable | RD-05 AC-19 |
| ST-19 | Raw malformed path-like/BOM/invalid-byte inputs | Exact authoritative bytes preserved without substring rewriting | RD-05 AC-5/16 |
| ST-20 | Same envelope/policy in repeated fresh processes | Byte-identical one-minimal result and canonical trace | RD-05 AC-8 |
| ST-21 | Full catalog pass at fixed point | Trace proves no canonical single edit preserves predicate | RD-05 AC-8/18 |
| ST-22 | Exact attempt/execution/oracle limit then next operation | Exact succeeds; next exhausts and cannot promote | RD-05 AC-9 |
| ST-23 | Foreign/replayed/out-of-order candidate evaluation | Reject before reducer state mutation | RD-05 Candidate authority |
| ST-24 | Catalog edit with equal/increasing tuple or cycle | Closed catalog-contract failure; no execution/promotion | RD-05 Deterministic reduction |

### Candidate Execution and Confirmation

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-25 | Original case and several reduction candidates | Original immutable; each candidate has a new domain identity | RD-05 AC-6 |
| ST-26 | Execute candidate through original route | Obligation, tier, policy, fixture, oracle and predicate unchanged | RD-05 AC-6 |
| ST-27 | Direct compiler callback, forged authority or caller handler | Reject before compiler/worker activity | RD-05 Won't Have |
| ST-28 | Typed-valid and typed-invalid route requests | Existing published handler chain evaluates exact candidate | RD-05 Candidate execution |
| ST-29 | Raw diagnostic route with zero/nonzero bytes | Diagnostic handler executes without typed IR | RD-05 AC-5/19 |
| ST-30 | Equivalent ordinary generated-case route | Existing request/result behavior remains byte-compatible | Plan compatibility |
| ST-31 | Confirm minimized source failure twice | Two distinct workers/roots/processes reproduce equal predicate | RD-05 AC-10 |
| ST-32 | Failure exists only in campaign worker state | Fresh runs differ; bounded sequence reproduces and persists order | RD-05 AC-10 |
| ST-33 | Unstable failure across fresh and sequence runs | `flaky-failure`; campaign evidence only | RD-05 AC-10 |
| ST-34 | Infrastructure-like failure and same-route control | Shrink only when two failures reproduce and control passes | RD-05 Dispositions |
| ST-35 | Missing historical handler/tool authority | Closed unavailable result; never substitute current authority | RD-05 AC-7 |

### Immutable Evidence and Regression Activation

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-36 | Two campaigns discover equal promoted key | One byte-identical core and two distinct events | RD-05 AC-11 |
| ST-37 | Same failure under different selected policies | Core stays equal; policy-bearing events differ | RD-05 Identity |
| ST-38 | Concurrent/retried identical publication | Idempotent core/events; no lost provenance | RD-05 AC-11 |
| ST-39 | Same path/identity with different canonical bytes | Fatal collision; accepted evidence unchanged | RD-05 AC-12 |
| ST-40 | Symlink, special file or replaced pinned directory | Fail closed before accepting evidence | RD-05 AC-12 |
| ST-41 | Partial temp file and orphan event | Safe reconciliation/ignore; authority never inferred | RD-05 AC-12 |
| ST-42 | Oversized/open/unsupported record | Closed schema rejection without partial publication | RD-05 AC-12 |
| ST-43 | Source/path/secret canaries in all candidate fields | Exact source survives only source field; forbidden host data absent | RD-05 AC-15/16 |
| ST-44 | Publish a confirmed current defect inactive | Durable candidate remains outside test discovery | RD-05 AC-13 |
| ST-45 | Activate unchanged candidate after green ancestor | Dynamic specification runner discovers and passes it | RD-05 AC-14 |
| ST-46 | Missing/malformed/duplicate/non-ancestor activation | Regression suite fails closed | RD-05 AC-14 |
| ST-47 | Reintroduce activated defect | Unchanged specification expectation fails | RD-05 AC-14 |
| ST-48 | Evidence root has zero activation records | Explicit valid empty state; suite runs rather than skips | AR-P8 |
| ST-49 | Activation attempts to alter source/predicate/expectation | Digest/cross-reference rejection | RD-05 AC-14 |

### Orchestration, Publication Refresh and Closeout

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-50 | Genuine matching report/campaign/execution/oracle join | Complete envelope materialized immediately for every non-pass | RD-05 Historical authority |
| ST-51 | Structural report or mismatched authority identity | Reject before envelope/reduction/publication | RD-05 Security |
| ST-52 | All closed non-pass results through orchestrator | Every result retained under exact disposition; only eligible paths shrink | RD-05 AC-1 |
| ST-53 | End-to-end typed-valid/invalid/raw failures | Strict shrink, confirmation, inactive core and event | RD-05 AC-3–11/18/19 |
| ST-54 | Unsupported, unavailable, exhausted, sequence and flaky cases | Campaign evidence retained; no promotion authority | RD-05 Outputs |
| ST-55 | Track files written during end-to-end run | Only readiness evidence paths change; compiler and `spec/` untouched | RD-05 AC-17 |
| ST-56 | Mutate route adapter/worker executor after generated catalog | Freshness check detects stale selected child | RD-05 Publication refresh |
| ST-57 | Prepare/select refreshed child then old→new→old resolve | Both generations remain exact; new routes work; pointer reconciles safely | RD-05 Publication refresh |
| ST-58 | Reviewed real C64 campaign with ACME and VICE 3.10 | Candidate route/confirmation and retained report pass exact bounded policy | RD-05 AC-5/6/10 |

## Test Files and Authoring Gates

| New specification file | Cases | Authored before |
|---|---|---|
| `packages/readiness/src/failure-contracts.spec.test.ts` | ST-01–ST-12 | Phase 1 production |
| `packages/readiness/src/failure-reduction.spec.test.ts` | ST-13–ST-24 | Phase 2 production |
| `packages/readiness-execution/src/failure-candidate-execution.spec.test.ts` | ST-25–ST-35 | Phase 3 production |
| `packages/readiness/src/failure-evidence.spec.test.ts` | Readiness contract portions of ST-36–ST-49 | Phase 4 production |
| `packages/readiness-execution/src/failure-publication-regressions.spec.test.ts` | Durable publication/activation portions of ST-36–ST-49 | Phase 4 production |
| `packages/readiness-execution/src/failure-orchestration.spec.test.ts` | ST-50–ST-58 | Phase 5 production |

Specification fixtures may construct genuine prerequisite authorities through existing public
constructors, but they never inspect production implementation or import private modules. After the
recorded RED checkpoint, expectations and fixtures are frozen; later failures are fixed in
production code only.

## Implementation Test Files

| Package | Implementation test files | Internal focus |
|---|---|---|
| readiness | `failure-contracts.impl.test.ts`, `failure-history.impl.test.ts` | Cross-products, canonical identities, limits, replay corruption |
| readiness | `failure-reduction-catalog.impl.test.ts`, `failure-reducer.impl.test.ts` | Catalog properties, invariants, state-machine faults |
| readiness | `failure-evidence.impl.test.ts` | Canonical records, collision and lifecycle invariants |
| readiness-execution | `failure-candidate-execution.impl.test.ts`, `failure-confirmation.impl.test.ts` | Route isolation, workers, controls, sequences |
| readiness-execution | `failure-publication.impl.test.ts`, `failure-regressions.impl.test.ts` | Filesystem faults, concurrency, activation discovery |
| readiness-execution | `failure-orchestration.impl.test.ts` | Genuine joins, closed outcomes, end-to-end flow |

## Implementation Test Coverage

Implementation suites add exhaustive/property catalog checks, canonical-byte collision injection,
large shallow input and accessor/proxy rejection, reducer state-machine replay faults, fresh-worker
ownership probes, process/environment isolation, filesystem descriptor races, durability failures,
concurrent no-clobber attempts, derived projection rebuilding, and historical content revision
fixtures. Real objects are preferred; fakes are limited to true process, clock, filesystem-fault,
ACME, and VICE boundaries.

## Security Applicability

RD-05 adds no network, HTTP, authentication, database, container, credential, or transport surface,
so CSRF, CORS, rate limiting, SQL/XSS, TLS, password hashing, and container-hardening controls are
not applicable. Its security boundary is local capability authorization plus hostile structured
input, path, filesystem and subprocess handling. ST-02, ST-08–ST-11, ST-14, ST-19, ST-23–ST-24,
ST-27, ST-35, ST-39–ST-43, ST-46, ST-49, ST-51 and ST-55 cover fail-closed input, authority,
resource, path, command/data-exposure and publication behavior. No shell execution seam is added;
existing bounded argv-array tool routes remain authoritative. (AR-P3, AR-P5–AR-P8)

## Verification Commands

Focused package verification runs throughout implementation. Before every commit and at final
closeout, run exactly:

```bash
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

Run `npx prettier --check <touched-files>` before each checkpoint. The final gate also checks
`git status --porcelain spec/`, focused branch coverage, generated handler freshness, and the local
real ACME/VICE acceptance path. (AR-P10, AR-P12, AR-P13)
