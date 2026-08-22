# Testing Strategy: RD-04 Tiered Compiler, ACME and VICE Execution

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing overview

Each phase starts with implementation-blind specification tests derived from RD-04 and the resolved
public contracts. The new spec file is observed RED before production work and is immutable
thereafter. Implementation tests cover internal algorithms, fault injection and compatibility.
`@blend65/readiness` and `@blend65/readiness-execution` each retain at least 90% branch coverage.

CI runs all contract, codec, fake-process, worker, filesystem, publication and orchestration tests.
Real ACME/VICE tests remain locally gated, but accepted local evidence is mandatory before the
execution publication may be selected; missing tools produce blockers rather than passes.

## 🚨 Specification test cases

### Contracts and deterministic routing

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-01 | Call `parseExecutionContractsV1` with each six-tier capability and one complete policy | Exact closed contracts accept and canonicalize | RD-04 MH-1; 03-01 |
| ST-02 | Call `parseExecutionContractsV1` with an unknown tier/code/stage, extra property or duplicate capability | Input rejects before route planning | RD-04 MH-1/2; 03-01 |
| ST-03 | Each operation, launch-attempt, route, cleanup, output, evidence, instruction, cycle and attempt budget at `0`, fraction, unsafe integer, max and max+1 | Only positive safe values through each inclusive maximum accept | RD-04 Technical Requirements; AR-P9 |
| ST-04 | Same serializable composite/campaign projections, oracle digest and policy in two fresh processes | Byte-identical route plan and digest without constructing opaque authority | RD-04 AC-2; AR-P6/P15 |
| ST-05 | Frontend, ACME and VICE terminal cases | Exact prerequisite order; the pure planner exposes no adapter invocation seam, while Phase 3 proves real no-later-adapter behavior | RD-04 AC-1; 03-01; AR-P15 |
| ST-06 | Valid/invalid, spelling and boundary strata in shuffled input | Same digest-ranked lexical round-robin selections | RD-04 MH-5; AR-P6 |
| ST-07 | Four runtime rules with VICE obligation | At least one valid VICE case selected for each | RD-04 AC-3; AR-P6 |
| ST-08 | Required minima exceed per-obligation or campaign cap | `execution-plan-capacity`; no partial plan/work | AR-P6; 03-01 |
| ST-09 | External prior outcome data changes while planner input stays identical, then an outcome field is added to the strict input | Selection is unchanged because outcomes are not inputs; the extra field rejects rather than enabling heuristic escalation | RD-04 MH-5; AR-P6/P15 |
| ST-10 | Call `reduceExecutionTerminalV1` with an explicit provisional tier/stage/usage/evidence base, then no candidates, simultaneous staged failures, cleanup blocker and exhausted counters | Empty candidates preserve the exact base stage and evidence as pass; first operational result stays primary, cleanup blocker prevents authority, provisional pass becomes recovery-blocked, and instruction precedes cycle | RD-04 AC-7/8; AR-P9 |

### Envelope, identity and diagnostic evidence

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-11 | Valid scalar and memory cases with complete parameters | Valid `main(): void`; actual stores precede completion `0xA5` | RD-04 MH-9/11; AR-P7 |
| ST-12 | Invalid diagnostic source, plain/copy-forged envelope authority, and structural historical replay without its named campaign | Reject before rendering; genuine replay through the historical campaign reproduces; original source identity and bytes stay unchanged | RD-04 MH-8/9; AR-P7 |
| ST-13 | Seed expected value/text into executable source | Leakage check rejects before compile | RD-04 AC-5; 03-02 |
| ST-14 | Change each envelope, argument, fixture-content byte, budget, selector, handler capability/contract-version/implementation-revision tuple or layout address | Execution identity changes for every mutation; source-case identity does not | RD-04 AC-4; AR-P7 |
| ST-15 | Same pre-build identity with two accepted label layouts | Final identities differ and name exact layout proofs | AR-P7; 03-02 |
| ST-16 | Missing/overlapping label, stack/MMIO/footprint collision | Layout proof rejects before runtime acceptance | RD-04 AC-5; AR-P7 |
| ST-17 | Stale success byte or completion-before-result mutant | Evidence rejects even when observed value matches | RD-04 AC-5; 03-02 |
| ST-18 | `$D020..$D022` fixture, logical `$20`/`$2000` writes, low-nibble mutants and both word starts | Input and actual projections use `F0|nibble`; words are little-endian; logical RD-03 effects stay unchanged | RD-04 MH-10/11; AR-P8 |
| ST-19 | Missing fixture cell or pre-entry mismatch | Stable non-passing fixture result; no case entry | RD-04 AC-5; AR-P8 |
| ST-20 | Same diagnostic code from wrong phase or severity | Diagnostic mismatch | RD-04 AC-6; AR-P3 |
| ST-21 | Invalid case emits IL, assembly or binary | `unexpected-emission` | RD-04 AC-6; AR-P3 |
| ST-22 | Deduplicated/capped and severity-adjusted diagnostics | Sidecar contains only accepted entries joined to final severity | AR-P3; 03-04 |

### Real adapters and bounded lifecycle

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-23 | Frontend/compiler/CLI/emit fixtures through one injected `ExecutionWorkerExecutorV1` | Each tier emits exactly one closed tier-specific structured-clone request through that executor, observes its distinct real worker-side contract, and never invokes a real facade in the parent | RD-04 MH-7; AR-P3/P9 |
| ST-24 | Existing compiler, renderer, CLI and ACME callers | Ordinary result/output/default behavior stays compatible | Plan AC-2; 03-04 |
| ST-25 | Missing ACME versus discovered failing ACME | `tier-unavailable` versus `assembler-failure` | RD-04 MH-13/16; 03-04 |
| ST-26 | Each frontend/compiler/CLI/emit worker hangs, crashes or sends a malformed tier response | Deadline/ICE result; exactly the owned worker and case root are cleaned; no synchronous parent fallback occurs | RD-04 AC-7/9; AR-P10 |
| ST-27 | Relative path with `..`, absolute, symlink or special file | Reject before file access or child launch | RD-04 AC-10; AR-P10 |
| ST-28 | Shell metacharacters in valid argv data | Passed as one argv value; never evaluated by a shell | RD-04 Security; AR-P10 |
| ST-29 | Finite independently varied/interleaved stdout/stderr at and beyond selected aggregate limits, plus a non-terminating flood | Both pipes drain/count/hash independently; the exact aggregate bound passes and first excess byte irreversibly exhausts without per-stream budgets; finite evidence serializes stably stdout-then-stderr, while flood authority contains only the stable code, configured limit and cleanup proof and excludes all scheduler-dependent stream evidence | RD-04 AC-8; AR-P10 |
| ST-30 | Serialized artifacts cross 16 MiB evidence cap | Stable evidence-limit failure; no partial pass | RD-04 AC-8; AR-P10 |
| ST-31 | Exact operation/launch-attempt/work/hard-route bounds, undersized grace and next tick | Fixed cleanup grace is reserved, each launch attempt is capped at 15 seconds, undersized child policy rejects, exact bound passes and next event exhausts deterministically | RD-04 AC-8; AR-P9 |
| ST-32 | Retries/restarts consume attempts, time, instructions and absolute stopwatch cycles | Per-child baselines yield monotonic deltas; route totals remain cumulative; decreases, missing samples and identity changes fail closed | RD-04 AC-8; AR-P9/P10 |
| ST-33 | Failure injected at each owned-resource boundary | No worker, child, monitor, checkpoint or temp root remains | RD-04 AC-9; AR-P10 |

### VICE control, lease and runtime

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-34 | Existing `ViceDriver` suites through refactored control | Root API behavior remains byte-for-byte compatible | Plan AC-2; AR-P4 |
| ST-35 | Instruction totals around 65,535 and 10,000,000 | Wire chunks always `1..65535`; no wrap/truncation | RD-04 AC-8; 03-06 |
| ST-36 | Two concurrent lease acquisitions plus a plain/copy-forged handle | Exactly one runtime-backed owner; structural impostors cannot launch or control VICE | RD-04 AC-9; AR-P11 |
| ST-37 | Launcher crash before record, after record, after exec and each later lease lifecycle state | VICE cannot exist without recorded same-PID identity; next owner recovers only after generation/identity proof | RD-04 AC-9; AR-P11 |
| ST-38 | Reused PID, changed boot/start/token, absent `process.execve` or unreadable identity | Recovery blocked and lease retained, or tier unavailable before spawn; unrelated process unsignaled | RD-04 AC-9; AR-P11 |
| ST-39 | Record changes between validation and signal | Pre-signal revalidation blocks the signal | RD-04 AC-9; AR-P11 |
| ST-40 | Cleanup with wrong generation/nonce, foreign coordinator, concurrent reuse or second use | Lease remains; matching owner alone can clear it; a genuine handle is single-active and single-use | RD-04 AC-9; AR-P11 |
| ST-41 | Non-Linux/restricted identity provider | VICE is `tier-unavailable`, never PID-only fallback | AR-P11; 03-06 |
| ST-42 | Endpoint collision, wrong target/version or dead child | Bounded retry then stable launch/handshake result | RD-04 Lifecycle; AR-P4 |
| ST-43 | STORE checkpoint midway through a chunk, wrong event/address/readback, post-return mutation and instruction/cycle/wall races | Full chunk is charged; only exact committed `$A5` completes; no later mutation; stable precedence and cancellation | RD-04 AC-7/8; AR-P9 |
| ST-44 | Real VICE fixture proof and `peek`/`peekw`/`poke`/`pokew` | Projection plus one selected case per rule passes locally | RD-04 AC-5/12; AR-P8/P13 |

### Publication and orchestration

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-45 | Exact six content-derived bindings against selected parent, then plain/copied/proxied composite attempts | Candidate prepares and resolves opaque child context; guarded projection rejects every structural impostor before planning | RD-04 AC-11; AR-P5 |
| ST-46 | Missing, duplicate, stale, undeclared or incompatible row | Candidate/review/resolution rejects exact row | RD-04 AC-11; AR-P5 |
| ST-47 | Parent-only snapshot then accepted child snapshot | Six blockers remain, then exactly six clear | RD-04 AC-11; AR-P5 |
| ST-48 | Child names another/unavailable parent digest | Composite resolution rejects; parent bytes unchanged | RD-04 AC-11; AR-P5 |
| ST-49 | Fault at every staging/review/pointer operation | Prior child selection remains or committed state reconciles | RD-04 AC-11; AR-P5 |
| ST-50 | Historical four-row/nine-row parents and child release | Every named release resolves byte-identically | RD-04 AC-11; 03-03 |
| ST-51 | Campaign with unavailable ACME/VICE | Exact capability blockers remain; outcome cannot pass | RD-04 AC-12; AR-P9 |
| ST-52 | Modeled and residual population after full execution | Every obligation has selected result; residual blockers preserved | RD-04 AC-3; AR-P1 |
| ST-53 | Actual value/effect differs from host oracle | Semantic mismatch; expectation absent from source/evidence producer | RD-04 MH-9/11; AR-P7 |
| ST-54 | Attempt selection without accepted local VICE proof | Publication gate rejects even though CI-safe tests pass | RD-04 AC-12; AR-P13 |
| ST-55 | Execution-publication/root/pointer literals in every source file | Only exact path-family owners in readiness and readiness-execution pass; historical owner set is unchanged | RD-04 AC-11; 03-03 |
| ST-56 | Generated six-handler catalog whose identity is the lexical `{capabilityId, contractVersion, implementationRevision}` participant list, closure bytes, one-byte dependency mutation and historical revision | Exact fresh row reconstructs; participant/closure mutation, stale/current fallback and arbitrary registration reject | RD-04 AC-11; 03-03 |
| ST-57 | Guarded child inspect/select old→new→old plus pointer/reconciliation faults | Every selection fully revalidates and original bytes/blockers reproduce; raw pointer editing is unnecessary | RD-04 AC-11; 03-03 |
| ST-58 | Local command valid run, invalid/duplicate/traversing args and absent tools | Exact grammar, exits 0/1/2/3/4, bounded deterministic stdout/stderr and no machine paths | RD-04 AC-12; 03-07 |
| ST-59 | Report rerun, differing result, existing different bytes and atomic-write faults | Canonical bytes/digest reproduce; no overwrite or partial report; semantic review names exact digest | RD-04 AC-12; 03-07 |
| ST-60 | Trusted lease directory/file modes, owner, links, device/inode and replacement races | Every mismatch fails closed; exact trusted host-wide namespace succeeds | RD-04 AC-9/10; 03-05/03-06 |
| ST-61 | Read-only recovery inspection followed by changed/stale/clearable generations | Inspection never mutates; guarded exact-generation clear only after positive child absence | RD-04 AC-9; 03-06 |
| ST-62 | Execution-side seam consumes low-level VICE control without reverse import | Package boundary remains acyclic and one integration spec proves lease/policy ownership | Plan AC-1/2; 03-04/03-06 |

## Test files and authoring gates

| New specification file | Cases | Authored before |
|---|---|---|
| `execution-contracts-routing.spec.test.ts` | ST-01–ST-10 | Phase 1 production |
| `execution-envelope-evidence.spec.test.ts` | ST-11–ST-22 | Phase 2 production |
| `execution-adapters-safety.spec.test.ts` | ST-23–ST-33 | Phase 3 production |
| `packages/test-harness/src/emulator/vice/vice-control.spec.test.ts` | ST-34–ST-35, ST-42 and low-level portion of ST-43 | Phase 4 test-harness production |
| `packages/readiness-execution/src/execution-vice-lease.spec.test.ts` | ST-36–ST-41, ST-60–ST-62 and lease/policy portion of ST-43 | Phase 4 readiness-execution production |
| `execution-runtime-acceptance.spec.test.ts` | ST-44 | Phase 5 production |
| `packages/readiness/src/execution-publication.spec.test.ts` | ST-45–ST-50, readiness-owned portion of ST-55, ST-57 | Phase 6 readiness production |
| `packages/readiness-execution/src/execution-publication-catalog.spec.test.ts` | readiness-execution-owned portion of ST-55 and ST-56 | Phase 6 live-catalog production |
| `execution-orchestration.spec.test.ts` | ST-51–ST-54, ST-58–ST-59 | Phase 7 production |

No existing `*.spec.test.ts` is modified. New implementation tests are split by validation,
selector, identity, evidence, worker/process supervision, filesystem, lease, monitor runtime,
publication and orchestration concerns.

## Verification

Focused gates include package tests, package branch coverage, readiness source/boundary checks,
targeted Prettier, execution-publication resolution, local ACME/VICE acceptance when selecting, and
`git status --porcelain spec/` remaining empty.

Every phase also runs:

```text
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```
