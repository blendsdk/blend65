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
| ST-01 | Exhaustive RD-04 code/tier/stage cross-product plus every known result with a mismatched authenticated terminal tier | Exactly one allowed primary disposition or `unsupported`; route-relative tier mismatch fails closed | RD-05 AC-1 |
| ST-02 | Unknown code/stage/tier, extra keys, and a globally allowed stage absent from the authenticated route prefix | Fail closed as unsupported input; no shrink | RD-05 AC-1 |
| ST-03 | Cleanup absent/present beside every primary class | Separate `cleanup-clear`/`cleanup-blocked`; primary unchanged | RD-05 AC-1 |
| ST-04 | Mutate each predicate field independently | Predicate canonical bytes differ for every semantic field | RD-05 AC-2 |
| ST-05 | Same minimized content/predicate across campaigns | One equal promotion key despite distinct provenance | RD-05 AC-2/11 |
| ST-06 | Change selected policy/run identity only | Predicate and promotion key stable; run identity changes (event/core consequences are owned by ST-37) | RD-05 Policy |
| ST-11 | Each selected limit at exact/max/next and unsafe values | Exact allowed; next exhausts; hard/unsafe rejects before work | RD-05 AC-9 |
| ST-12 | Serialize an existing RD-04 report before/after RD-05 | Canonical bytes and digest remain byte-identical | RD-05 Historical authority |

### Deterministic Reduction

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-07 | Replay typed historical envelope after authority revision | Exact original case, route, predicate, and bytes reproduce | RD-05 AC-7 |
| ST-08 | Missing/malformed/oversized historical content, split across authority/run/orchestration facets | Phase 2 returns unavailable with no envelope/fallback; Phase 4 canonically publishes and reloads the unavailable run; Phase 5 includes it in the durable summary | RD-05 AC-7 |
| ST-09 | Genuine raw malformed authority with exact/empty valid UTF-8 bytes | Accepted independently of typed authority and round trips exactly; invalid UTF-8 rejects before minting | RD-05 AC-5/19 |
| ST-10 | Plain/copy-forged raw, historical, evidence-root or report-sidecar capability, split at each capability's owning phase | Reject before source projection, filesystem, or execution | RD-05 Security |
| ST-13 | Known typed-valid semantic failure | Strict shrink retains well-formed/type-correct primary witness | RD-05 AC-3/18 |
| ST-14 | Candidate that collapses to parser/type error | Invariant rejects; semantic predicate cannot be substituted | RD-05 AC-3 |
| ST-15 | Remove required versus incidental claim witnesses | Required removal rejects; incidental removal allowed only with witness | RD-05 MH-3 |
| ST-16 | Known invalid neighbor tuple | Baseline, transform, diagnostic contract, paths and one violation persist | RD-05 AC-4/18 |
| ST-17 | Every invalid transform kind after baseline edits | Target rebases and resolves exactly once or edit rejects | RD-05 Historical authority |
| ST-18 | Raw malformed zero-byte minimal reproducer, split across reducer/route/lifecycle facets | Phase 2 preserves/minimizes empty bytes; Phase 3 executes them; Phase 4 publishes the unchanged inactive candidate | RD-05 AC-19 |
| ST-19 | Raw malformed path-like/BOM/multibyte/malformed-language inputs encoded as valid UTF-8 | Exact authoritative bytes preserved; edits use code-point boundaries and strict post-edit UTF-8 validation | RD-05 AC-5/16 |
| ST-20 | Same envelope/policy in repeated fresh processes | Byte-identical one-minimal result and canonical trace | RD-05 AC-8 |
| ST-21 | Full catalog pass at fixed point | Trace proves no canonical single edit preserves predicate | RD-05 AC-8/18 |
| ST-22 | Exact discretionary limit, mandatory terminal reserve and next operation, split across reserve/accounting/persistence facets | Phase 1 rejects an undersized reserve; Phase 2 exact work succeeds and next exhausts; Phase 4/5 terminal run and summary persist | RD-05 AC-9 |
| ST-23 | Foreign/replayed/out-of-order/cross-subject token and legitimate fresh-token candidate reuse, split across token and route facets | Phase 2 mint/replay/substitution rules reject invalid use; Phase 3 proves each bound subject can execute only through its purpose and isolation mode | RD-05 Candidate authority |
| ST-24 | Catalog edit with equal/increasing tuple or cycle; separate idempotent normalization | Illegal catalog edit fails closed; normalization is separately traced and byte-changing normalization is evaluated | RD-05 Deterministic reduction |

### Candidate Execution and Confirmation

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-25 | Original case and several reduction candidates | Original immutable; each candidate has a new domain identity | RD-05 AC-6 |
| ST-26 | Execute candidate through original route | Obligation, tier, policy, fixture, oracle and predicate unchanged | RD-05 AC-6 |
| ST-27 | Direct compiler callback, forged authority or caller handler | Reject before compiler/worker activity | RD-05 Won't Have |
| ST-28 | Typed-valid and typed-invalid route requests | Existing published handler chain evaluates exact candidate | RD-05 Candidate execution |
| ST-29 | Raw diagnostic route with zero/nonzero bytes | Diagnostic handler executes without typed IR | RD-05 AC-5/19 |
| ST-30 | Equivalent ordinary generated-case route | Existing request/result behavior remains byte-compatible | Plan compatibility |
| ST-31 | Confirm minimized source failure twice | Two distinct workers/roots/V8 isolates reproduce equal predicate | RD-05 AC-10 |
| ST-32 | Failure exists after cases 2–9 share one dedicated sequence worker; exact 64/next 65 | Attempt reuses one worker independent of pool retirement through 64, persists position, isolates attempts, and rejects 65 pre-launch | RD-05 AC-10 |
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
| ST-41 | Partial temp file, valid unreferenced event, and broken reachable reference | Temp/unreferenced event is excluded with diagnostic; reachable graph corruption fails closed | RD-05 AC-12 |
| ST-42 | Oversized/open/unsupported canonical record or active graph above fixed root/node/edge/depth/byte limit, split across schema and traversal facets | Readiness rejects invalid records and exposes canonical limits; execution rejects exact-next traversal/cycle breaches without partial publication or unbounded traversal | RD-05 AC-12 |
| ST-43 | Source/path/secret canaries in all candidate fields | Exact source survives only source field; forbidden host data absent | RD-05 AC-15/16 |
| ST-44 | Publish a confirmed current defect inactive plus envelope/run records | Durable candidate and restart-resolvable history remain outside test discovery | RD-05 AC-13 |
| ST-45 | Activate unchanged candidate after an exact lowercase 40-hex green ancestor | Dynamic specification runner discovers and passes it using argv-only Git ancestry probes | RD-05 AC-14 |
| ST-46 | Missing/shallow/malformed/non-lowercase/duplicate/non-ancestor activation, including detached HEAD | Regression suite fails closed except a valid ancestor of detached `HEAD` | RD-05 AC-14 |
| ST-47 | Reintroduce activated defect | Unchanged specification expectation fails | RD-05 AC-14 |
| ST-48 | Evidence root has zero activation records | Explicit valid empty state; suite runs rather than skips | AR-P8 |
| ST-49 | Activation attempts to alter source/predicate/expectation | Digest/cross-reference rejection | RD-05 AC-14 |

### Orchestration, Publication Refresh and Closeout

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-50 | Genuine matching report/campaign/execution/oracle join | Complete envelope materialized immediately for every resolvable non-pass | RD-05 Historical authority |
| ST-51 | Structural report or mismatched authority identity | Reject before envelope/reduction/publication | RD-05 Security |
| ST-52 | All closed non-pass results through orchestrator | Every result retained under exact disposition; only eligible paths shrink | RD-05 AC-1 |
| ST-53 | End-to-end typed-valid/invalid/raw failures | Strict shrink, confirmation, inactive core and event | RD-05 AC-3–11/18/19 |
| ST-54 | Unsupported, unavailable, exhausted, sequence and flaky cases across restart | Every case has run/summary evidence; resolvable cases reference envelopes, unavailable cases use the closed source arm | RD-05 Outputs |
| ST-55 | Track files written during end-to-end run | Only readiness evidence paths change; compiler and `spec/` untouched | RD-05 AC-17 |
| ST-56 | Mutate route adapter/worker executor after generated catalog | Freshness check detects stale selected child | RD-05 Publication refresh |
| ST-57 | Passively resolve old release before/after selecting refreshed child | Old descriptor/binding bytes remain exact; only new revision is live; unavailable historical execution fails closed | RD-05 Publication refresh |
| ST-58 | Reviewed real C64 campaign with ACME 0.97 and VICE 3.10 | Public workflow passes seed `0xB16505` and retains report/envelope/run/summary paths under exact shared budget | RD-05 AC-5/6/10 |

## Test Files and Authoring Gates

| New specification file | Cases | Authored before |
|---|---|---|
| `packages/readiness/src/failure-contracts.spec.test.ts` | ST-01–ST-06, ST-11, ST-22 reserve/minimum facet | Phase 1 production |
| `packages/readiness-execution/src/failure-report-compatibility.spec.test.ts` | ST-12 | Phase 1 production; baseline GREEN and frozen because RD-04 V1 already exists |
| `packages/readiness/src/failure-reduction.spec.test.ts` | ST-07; ST-08 authority facet; ST-09; ST-10 raw/historical facet; ST-13–ST-17; ST-18 reducer facet; ST-19–ST-21; ST-22 accounting/exhaustion facet; ST-23 mint/replay/substitution facet; ST-24 | Phase 2 production |
| `packages/readiness-execution/src/failure-candidate-execution.spec.test.ts` | ST-10 report-sidecar facet; ST-18 execution facet; ST-23 route/isolation facet; ST-25–ST-35 | Phase 3 production |
| `packages/readiness/src/failure-evidence.spec.test.ts` | ST-08 canonical unavailable-run facet; ST-18 lifecycle facet; ST-22 canonical terminal-run facet; ST-36, ST-37, ST-39; ST-42 record/schema-limit facet; ST-43, ST-49 | Phase 4 production |
| `packages/readiness-execution/src/failure-publication-regressions.spec.test.ts` | ST-08 publication/restart facet; ST-10 evidence-root facet; ST-22 run-persistence facet; ST-38, ST-40, ST-41; ST-42 active-traversal/cycle facet; ST-44–ST-48, including complete dynamic registration for ST-45/ST-47 | Phase 4 production |
| `packages/readiness-execution/src/failure-orchestration.spec.test.ts` | ST-08 summary-emission facet; ST-22 summary-persistence facet; ST-50–ST-57 plus the public-workflow/retained-evidence facet of ST-58 | Phase 5 production; exact real-tool ST-58 facet runs in Phase 6 |

Specification fixtures may construct genuine prerequisite authorities through existing public
constructors, but they never inspect production implementation or import private modules. After the
recorded RED checkpoint, expectations and fixtures are frozen; later failures are fixed in
production code only.

The two Phase 4 authors have disjoint assertion ownership. Cross-package behavior is named only in
the execution-owned ST-45/ST-47 dynamic-runner assertions; the readiness file supplies canonical
fixtures solely through its declared public API and contains no duplicate integration oracle. The
complete Vitest case-registration loop, stable per-key naming, and zero-activation registration are
written and frozen in the execution specification before production. Production task 4.2.6 may
implement only loading, activation-rooted graph validation, and public-route execution.

## Implementation Test Files

| Package | Implementation test files | Internal focus |
|---|---|---|
| readiness | `failure-contracts.impl.test.ts`, `failure-history.impl.test.ts` | Cross-products, canonical identities, limits, replay corruption |
| readiness | `failure-reduction-catalog.impl.test.ts`, `failure-reducer.impl.test.ts` | Catalog properties, invariants, state-machine faults |
| readiness | `failure-evidence.impl.test.ts` | Canonical records, collision and lifecycle invariants |
| readiness-execution | `failure-candidate-execution.impl.test.ts`, `failure-confirmation.impl.test.ts` | Route isolation, workers, controls, sequences |
| readiness-execution | `failure-publication.impl.test.ts`, `failure-regressions.impl.test.ts` | Filesystem faults, concurrency, activation discovery |
| readiness-execution | `failure-orchestration.impl.test.ts` | Genuine joins, closed outcomes, end-to-end flow |
| readiness-execution | `failure-candidate-acceptance.impl.test.ts` | Opt-in public-workflow ACME/VICE 3.10 acceptance and retained paths |

## Implementation Test Coverage

Implementation suites add exhaustive/property catalog checks, canonical-byte collision injection,
large shallow input and accessor/proxy rejection, reducer state-machine replay faults, fresh-worker
ownership probes, process/environment isolation, filesystem descriptor races, durability failures,
concurrent no-clobber attempts, derived projection rebuilding, and historical content revision
fixtures. Real objects are preferred; fakes are limited to true process, clock, filesystem-fault,
ACME, and VICE boundaries.

## Enforceable RD-05 Coverage Gate

Each package adds `src/test-fixtures/rd05-coverage-sources.ts` as the checked source of truth and a
`vitest.rd05.config.ts` that imports its exact include list, excludes tests/barrels/generated bytes,
and sets `thresholds: { perFile: true, branches: 90 }`. The readiness list owns
`failure-contracts.ts`, `failure-identity.ts`, `failure-envelope.ts`, `failure-authority.ts`,
`malformed-diagnostic-case.ts`, `failure-invariants.ts`, `failure-transform-catalog.ts`,
`failure-reducer.ts`, `reduction-candidate.ts`, and the canonical failure evidence/lifecycle
modules introduced in Phase 4. The execution list owns `failure-route-adapter.ts`,
`failure-confirmation.ts`, predicate-sidecar extraction, secure failure publication, regression
loading, Git ancestry validation, and failure orchestration. Existing participating hosts
`execution-route-adapters.ts`, `execution-live-handlers.ts`, `execution-worker-executor.ts`,
`execution-authority-report.ts`, `execution-orchestration.ts`, `execution-vice-build.ts`, and
readiness-owned `published-runtime-evaluation.ts` are recorded in a separate checked
`participatingExistingFiles` list: their new RD-05 branches receive explicit tests and remain under
the package aggregate gate, while unrelated pre-existing branches do not become RD-05 scope.

`failure-coverage-ownership.spec.test.ts` in each package scans the closed `failure-*`/`reduction-*`
production namespace plus the explicit touched-existing-file allowlist and proves every RD-05-owned
source appears exactly once in either `coverageFiles` or `participatingExistingFiles`, never both. A
newly introduced or renamed core therefore fails before aggregate coverage can conceal it.
Generated catalogs and export barrels are named review-only exclusions, never silent omissions.

The Phase 1 manifest records the exact lowercase 40-hex pre-implementation ancestor commit.
`check:coverage:rd05` validates that ancestor, then compares all added/renamed/modified production
files from `git diff --name-only --diff-filter=ACMR <baseline>...HEAD` plus staged and unstaged
working-tree changes against `coverageFiles`, `participatingExistingFiles`, and the closed generated/
barrel exclusion list. The check therefore derives expected participants independently instead of
trusting a self-declared allowlist. It is a Git-workflow gate, not a source-archive runtime feature.

The exact commands are:

```bash
yarn workspace @blend65/readiness test:coverage:rd05
yarn workspace @blend65/readiness-execution test:coverage:rd05
yarn check:coverage:rd05
```

Each package script runs `vitest run --config vitest.rd05.config.ts --coverage`. The introducing
phase creates or updates its exports, manifest, config, ownership guard, and package script before
the GREEN checkpoint; every later phase reruns both commands after updating the lists.

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

The exact local real-tool command is:

```bash
BLEND65_RD05_LOCAL_ACCEPTANCE=1 yarn workspace @blend65/readiness-execution vitest run src/failure-candidate-acceptance.impl.test.ts --no-file-parallelism --maxWorkers=1
```

It uses the public RD-05 workflow with seed `0xB16505`, requires exact ACME 0.97 and VICE 3.10,
fails when locally opted in without either tool, and is explicitly skipped in ordinary CI. Its
success output names the retained authority-report, envelope-record, run-record, and summary-record
paths beneath the pinned temporary evidence root.
