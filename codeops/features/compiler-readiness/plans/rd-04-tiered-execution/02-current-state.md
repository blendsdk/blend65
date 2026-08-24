# Current State: RD-04 Tiered Compiler, ACME and VICE Execution

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

RD-01 through RD-03 already supply the authority substrate: immutable selected publications,
content-derived generator/oracle/transform bindings, deterministic random-access campaigns,
rendered/replayable cases, independent diagnostic and runtime oracles, and opaque selected oracle
contexts. Phase 6 refreshed the selected nine-binding parent after the Phase 3 implementation
closure changed its five oracle revisions; the selected digest is
`sha256:e5796e6f2abab401100f93547b4044c57a762b9ec7703e6183fda2c07afcd3e5`.

The compiler exposes distinct `compile`, `emitAsm` and `build` façades; the CLI exposes injectable
`runCli`; ACME discovery/invocation returns assembly/binary/label/report artifacts; test-harness
owns a real VICE 3.10 binary/text monitor driver. None of these is currently joined to readiness
authority, and all six evidence-capability declarations remain `unbound`.

### Relevant Files

| File | Current purpose | Change needed |
|---|---|---|
| `packages/readiness/src/campaign-model.ts:129` | Stable lanes, plan items and generated-case evidence | Consume without changing RD-02 identity |
| `packages/readiness/src/oracle-model.ts:1` | Closed RD-03 route/expectation protocol | Join selected host-side expectations to actual route results |
| `packages/readiness/src/publication-resolver.ts:76` | Opaque parent snapshot and revalidated immutable releases | Reuse hardened primitives for a separate child resolver |
| `packages/readiness/src/publication-filesystem.ts:167` | Pinned directories, bounded reads and atomic-pointer safeguards | Generalize narrowly for execution-publication paths |
| `packages/readiness/src/dependency-boundary.impl.test.ts:105` | Forbids production workspace imports from readiness | Preserve unchanged; add composition package outside readiness |
| `packages/compiler/src/api/run-frontend.ts:138` | Real lex/parse/analyze/SFA boundaries over one diagnostic bag | Add accepted-diagnostic phase observation sidecar |
| `packages/compiler/src/api/results.ts:22` | Stable ordinary compiler result types | Keep byte/shape compatibility; expose evidence separately |
| `packages/cli/src/main.ts:51` | Distinct exit/rendered-output contract | Add optional compiler-facade/observer injection |
| `packages/compiler/src/acme/invoke-acme.ts:120` | ACME argv and artifact invocation | Supply bounded route-owned runner; preserve default API |
| `packages/test-harness/src/emulator/vice/vice-driver.ts:73` | Public VICE driver owning spawn and both monitors | Wrap a new cancellable low-level control session |
| `packages/test-harness/src/emulator/vice/protocol.ts:202` | Live-verified u16 instruction-step codec | Validate chunks in `1..65535` and reuse from control subpath |
| `readiness/inventory/compiler-readiness-v1.json` | Six unbound execution declarations and rule obligations | Remain byte-identical parent authority |

## Code Analysis

### Authority and package boundary

`@blend65/readiness` declares only `ajv` and `jsonc-parser`, and its AST boundary test rejects every
production `@blend65/*` module load. Relaxing this would mix the independent authority core with the
implementation under test. The root workspace glob automatically admits a focused private
composition package; only the root TypeScript reference list needs an additive entry. (AR-P2)

### Cases and selected population

The modeled registry contains five scalar-range rules and four memory-intrinsic rules. The scalar
rules currently require `frontend`; the memory rules require `compiler-api`, `emit`, `acme` and
`vice`. Generated probes are functions named `scalarCase` or `memoryCase`, may carry external
parameters, and have no `main`. Memory addresses start at `$D020` or computed `$D021`; word reads
therefore touch `$D022`. The existing renderer emits only module constants and functions, so the
execution envelope must be separate from RD-02 generator IR. (AR-P6–AR-P8)

Final real-campaign acceptance exposed two compiler facts that the synthetic tiers did not: the
emitter may return recovery assembly while its full result still has errors, and a sole
literal-bound call into a parameter-address memory case was not propagated to the callee. The live
worker now carries the full emitter error bit, and the frontend safely specializes only a
main-reachable, same-module, non-recursive, non-address-taken callee with exactly one visible call.
That preserves direct absolute instruction selection for the selected cases. General runtime
addresses remain executable ledger row X-01 under conformance RD-02 rather than being hidden here.
(AR-P84–AR-P87)

### Diagnostic provenance gap

`Diagnostic` contains code, severity, message and locations but no compiler phase. `runFrontend`
does expose real stage boundaries while sharing a capped/deduplicating `DiagnosticBag`. A phase
sidecar must therefore attach only when the bag accepts a diagnostic and must survive final severity
policy, rather than being inferred later from a code. CLI currently injects build dependencies only,
so the same `runCli` invocation needs an additive compiler-facade/observer seam. (AR-P3)

### Process and emulator gaps

The default ACME runner uses `execFile` without RD-04 output/time ceilings. `ViceDriver` spawns
`x64sc` with ignored stdio, fixed retry windows and no durable owner, cancellation or process-start
identity. Its monitor codecs and C64/version checks are valuable live-verified assets, so they
should be factored rather than copied. The current generation lock checks PID liveness only; RD-04
needs checksummed generations, boot identity, process start identity and immediate pre-signal
revalidation. (AR-P4, AR-P10, AR-P11)

## Gaps Identified

| Gap | Required change | Governing decision |
|---|---|---|
| No execution contracts or selector | Add closed policy, result, capability and route-plan modules | AR-P6, AR-P9 |
| Probes are not programs | Add a valid-only envelope, complete args, globals and completion-last store | AR-P7 |
| Runtime input is unauthoritative | Add target fixture/projection with local real-VICE gate | AR-P8 |
| No child route authority | Add reviewed six-binding publication and composite resolver | AR-P5 |
| No toolchain composition root | Add `@blend65/readiness-execution` and real route workers | AR-P2, AR-P3 |
| Unbounded process/filesystem lifecycle | Add canonical workspaces, worker/process deadlines and bounded evidence | AR-P10 |
| VICE is neither exclusive nor crash-recoverable | Add control subpath, durable lease and positive identity provider | AR-P4, AR-P11 |
| No actual-vs-oracle campaign result | Add one orchestrator and population/blocker summary | AR-P9, AR-P13 |

## Dependencies

### Internal Dependencies

- RD-02 prepared campaign, generated case, replay and source-case identity APIs.
- RD-03 selected oracle context, runtime/diagnostic expectation and evaluation identity APIs.
- Compiler frontend/emit/build façades and CLI `runCli` public behavior.
- Compiler ACME artifact interfaces and test-harness VICE monitor codecs.
- Existing publication review, filesystem and atomic selection primitives.

### External Dependencies

- Node 22 worker threads, child processes, filesystem, crypto, sockets and Linux `/proc`.
- ACME for assembler acceptance; VICE 3.10 `x64sc` for local runtime acceptance.
- No new third-party runtime dependency, service, credential, database or remote network.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sidecar drifts from final diagnostics | Medium | High | Accepted-entry identity plus severity-policy join; immutable specs (AR-P3) |
| Envelope allocation perturbs output | Certain | Medium | Bind final labels/layout into identity; collision proof (AR-P7) |
| Parent/child selections disagree | Medium | Critical | Child names exact parent digest; opaque composite resolution (AR-P5) |
| Synchronous compiler exceeds deadline | Low | High | Execute route work in terminable workers (AR-P10) |
| PID reuse signals unrelated process | Low | Critical | Boot/start/token identity and pre-signal revalidation (AR-P11) |
| Output cap deadlocks child pipe | Low | High | Continue draining while retaining bounded head/tail/hash only (AR-P10) |
| CI silently misses VICE | Certain | High | Missing tier is a blocker; publication requires recorded local proof (AR-P13) |
| Selector caps hide obligations | Low | Critical | Fail `execution-plan-capacity`; never truncate required minima (AR-P6) |
