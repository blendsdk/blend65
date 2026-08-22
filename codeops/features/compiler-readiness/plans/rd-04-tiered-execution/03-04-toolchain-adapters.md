# Component Design: Toolchain Adapters

> **Document**: 03-04-toolchain-adapters.md
> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P2, AR-P3, AR-P9, AR-P18

## Responsibility

Implement the six real evidence routes in private workspace `@blend65/readiness-execution`. Each
adapter observes its actual public contract and prerequisite stages; it does not simulate a more
expensive tier or treat the CLI as a compiler-API alias.

## Package boundary

The new package depends on the public APIs of readiness, core, frontend, compiler, CLI and the
test-harness VICE-control subpath. It owns no language semantics. Root workspace discovery is
automatic; the root TypeScript project reference and Turbo build graph receive additive entries.
`@blend65/readiness` acquires no workspace dependency.

## Accepted diagnostic provenance

The compiler adds an optional evidence observer at diagnostic-bag construction. Pipeline code sets
the active phase at the actual lexer, parser and semantic/SFA boundaries. An entry is recorded only
when the bag accepts it after deduplication/cap rules, and its stable accepted-entry identity is
joined to final severity-policy output. `CompilerDiagnosticEvidenceV1` is returned through a
separate evidence façade; ordinary `Diagnostic`, `CompileResult` and renderer JSON do not change.

`runCli` gains optional compiler-facade/evidence injection. The CLI route invokes `runCli` once and
observes its exit status, rendered diagnostics, artifact behavior and sidecar from that same
invocation. Default callers and output remain compatible.

Phase 2 also exposes focused passive classifiers used unchanged by later adapters. Diagnostic
classification compares exact accepted code, real phase and final severity and returns only
`pass` or `diagnostic-mismatch`. Invalid-case artifact classification accepts closed IL/assembly/
binary presence flags and returns only `pass` or `unexpected-emission`; its precedence is IL,
assembly, then binary. Neither classifier invokes a compiler or grants route authority.

## Route adapters

| Terminal tier | Required real behavior | Evidence |
|---|---|---|
| `frontend` | lex → parse → analyze/SFA only | exact accepted code/phase/final severity; no later artifacts |
| `compiler-api` | call the programmatic compiler façade | result discriminator, diagnostics, IL/artifact absence or presence |
| `cli` | call `runCli` | exit status, stdout/stderr rendering, same-invocation sidecar, artifact set |
| `emit` | call the real assembly emitter | assembly bytes/digest and label requirements |
| `acme` | invoke discovered ACME through the route supervisor | binary, labels, report and bounded process evidence |
| `vice` | assemble, launch and control real VICE | fixture proof, execution usage, completion and actual observations |

Selected routes execute their declared prerequisites in order. A frontend-terminal case cannot
touch compiler API, CLI, emit, ACME or VICE. An ACME-terminal route cannot launch VICE. Invalid
cases are never wrapped; correct diagnostic code from the wrong phase/severity fails, and any IL,
assembly or binary at or after the rejecting stage is `unexpected-emission`.

## ACME integration

The existing default ACME API remains compatible. An additive runner seam accepts argv, cwd,
deadline, cancellation and streaming evidence callbacks from the route supervisor. Discovery
failure maps to `tier-unavailable`; a discovered executable returning non-zero, timing
out or omitting declared artifacts maps to its assembler-stage code. Binary, label and report files
are validated as regular files under the case root before hashing or parsing.

## Worker protocol

Compiler, CLI and emit operations run in Node worker threads because their synchronous CPU work
cannot be stopped reliably with an in-process promise timeout. Requests and tier-specific evidence
responses are closed, versioned, structured-clone-safe records. A response is never a terminal
`ExecutionResultV1`: the parent alone validates evidence, charges usage, classifies the result and
owns cleanup. One all-tier worker executor is the only parent-side dependency for frontend,
compiler-API, CLI and emit handlers. Production worker entry modules import the real frontend/
compiler/CLI facades inside the worker; functions are never cloned or invoked synchronously in the
parent. Test executors implement the same start/completion/termination boundary. A worker crash or
invalid response maps deterministically to compiler ICE or the route's stage error.

## Compatibility checks

Specification tests pin unchanged ordinary diagnostics, compiler result shape, CLI rendering/exit
behavior, default ACME caller behavior and root `ViceDriver` API. Compiler compatibility uses an
exact behavioral projection because source-map, semantic-model and call-graph query methods are
fresh closures on every ordinary invocation; it pins all stable data and query results while
excluding only callable identity. A promoted lexer warning additionally binds same-invocation
evidence code/final severity to final diagnostics. New evidence APIs are additive and documented;
no source or JSDoc mentions workflow artifact identifiers.

## Specification-visible TypeScript interface

The compiler exports these additive declarations from `@blend65/compiler`:

```ts
export type CompilerDiagnosticPhaseV1 = 'lexer' | 'parser' | 'semantic' | 'sfa';
export interface CompilerDiagnosticEvidenceEntryV1 {
  readonly acceptedEntryId: string;
  readonly code: string;
  readonly phase: CompilerDiagnosticPhaseV1;
  readonly finalSeverity: DiagnosticSeverity;
}
export interface CompilerDiagnosticEvidenceV1 {
  readonly revision: 'compiler-diagnostic-evidence-v1';
  readonly entries: readonly CompilerDiagnosticEvidenceEntryV1[];
}
export interface CompilerEvidenceObserverV1 {
  onDiagnosticEvidence(evidence: CompilerDiagnosticEvidenceV1): void;
}
export interface CompileWithEvidenceResultV1<T extends CompileResult = CompileResult> {
  readonly result: T;
  readonly evidence: CompilerDiagnosticEvidenceV1;
}
export function compileWithEvidence(
  options: CompilerOptions,
  host?: CompilerHost,
): CompileWithEvidenceResultV1;
export function emitIlWithEvidence(
  options: CompilerOptions,
  host?: CompilerHost,
): CompileWithEvidenceResultV1<EmitResult>;
export function emitAsmWithEvidence(
  options: CompilerOptions,
  host?: CompilerHost,
): CompileWithEvidenceResultV1<EmitResult>;
export function buildWithEvidence(
  options: CompilerOptions,
  host?: CompilerHost,
  deps?: BuildDeps,
): Promise<CompileWithEvidenceResultV1<BuildResult>>;
export interface CompilerEvidenceFacadeV1 {
  readonly compile: typeof compileWithEvidence;
  readonly emitIl: typeof emitIlWithEvidence;
  readonly emitAsm: typeof emitAsmWithEvidence;
  readonly build: typeof buildWithEvidence;
}
```

`@blend65/readiness-execution` exports these passive compatibility classifiers:

```ts
export interface ExecutionDiagnosticExpectationV1 {
  readonly code: string;
  readonly phase: CompilerDiagnosticPhaseV1;
  readonly severity: DiagnosticSeverity;
}
export interface ExecutionEmissionPresenceV1 {
  readonly il: boolean;
  readonly assembly: boolean;
  readonly binary: boolean;
}
export function classifyExecutionDiagnosticEvidenceV1(
  expected: ExecutionDiagnosticExpectationV1,
  observed: CompilerDiagnosticEvidenceV1,
): 'pass' | 'diagnostic-mismatch';
export function classifyInvalidCaseEmissionV1(
  presence: unknown,
): 'pass' | 'unexpected-emission';
```

The CLI adds only optional dependencies; `runCli(args)` remains source compatible:

```ts
export interface CliEvidenceDependenciesV1 {
  readonly compilerFacade?: CompilerEvidenceFacadeV1;
  readonly evidenceObserver?: CompilerEvidenceObserverV1;
}
export function runCli(
  argv: string[],
  io: CliIo,
  evidenceDependencies?: CliEvidenceDependenciesV1,
): Promise<number>;
```

`@blend65/readiness-execution` exports the adapter and supervisor seams used by immutable specs:

```ts
export interface ExecutionCancellationV1 {
  readonly signal: AbortSignal;
  readonly deadlineMonotonicMs: number;
}
export interface ValidExecutionRouteRequestV1<TTier extends ExecutionTierV1> {
  readonly kind: 'valid-envelope';
  readonly route: ExecutionRoutePlanItemV1 & { readonly terminalTier: TTier };
  readonly executionCase: ExecutionCaseV1;
  readonly oracle: PublishedOracleContext;
  readonly policy: ExecutionPolicyV1;
}
export type ExecutionDiagnosticTierV1 = 'frontend' | 'compiler-api' | 'cli';
export interface DiagnosticExecutionRouteRequestV1<TTier extends ExecutionDiagnosticTierV1> {
  readonly kind: 'invalid-diagnostic';
  readonly route: ExecutionRoutePlanItemV1 & { readonly terminalTier: TTier };
  readonly diagnosticCase: PublishedDiagnosticCaseV1;
  readonly policy: ExecutionPolicyV1;
}
export type ExecutionRouteRequestV1 =
  | ValidExecutionRouteRequestV1<'frontend'>
  | ValidExecutionRouteRequestV1<'compiler-api'>
  | ValidExecutionRouteRequestV1<'cli'>
  | ValidExecutionRouteRequestV1<'emit'>
  | ValidExecutionRouteRequestV1<'acme'>
  | ValidExecutionRouteRequestV1<'vice'>
  | DiagnosticExecutionRouteRequestV1<'frontend'>
  | DiagnosticExecutionRouteRequestV1<'compiler-api'>
  | DiagnosticExecutionRouteRequestV1<'cli'>;
export type CreateExecutionRouteRequestInputV1 = ExecutionRouteRequestV1;
export function createExecutionRouteRequestV1(
  input: CreateExecutionRouteRequestInputV1,
): ExecutionOperationResultV1<ExecutionRouteRequestV1>;
export interface ExecutionRouteHandlerV1 {
  execute(
    request: ExecutionRouteRequestV1,
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionResultV1>;
}
export type ExecutionWorkerTierV1 = 'frontend' | 'compiler-api' | 'cli' | 'emit';
export interface ExecutionWorkerSourceV1 {
  readonly revision: 'execution-worker-source-v1';
  readonly relativePath: string;
  readonly bytes: Uint8Array;
  readonly digest: string;
}
export interface ExecutionWorkerRequestBaseV1<TTier extends ExecutionWorkerTierV1> {
  readonly revision: 'execution-worker-request-v1';
  readonly tier: TTier;
  readonly caseKind: 'valid-envelope' | 'invalid-diagnostic';
  readonly caseIdentity: string;
  readonly caseRoot: string;
  readonly source: ExecutionWorkerSourceV1;
}
export type ExecutionWorkerRequestV1 =
  | (ExecutionWorkerRequestBaseV1<'frontend'> & { readonly contract: 'frontend-pipeline-v1' })
  | (ExecutionWorkerRequestBaseV1<'compiler-api'> & {
      readonly contract: 'compiler-evidence-facade-v1';
    })
  | (ExecutionWorkerRequestBaseV1<'cli'> & {
      readonly contract: 'blendc-cli-v1';
      readonly argv: readonly string[];
    })
  | (ExecutionWorkerRequestBaseV1<'emit'> & { readonly contract: 'assembly-emitter-v1' });
export interface ExecutionWorkerEmissionV1 {
  readonly il: boolean;
  readonly assembly: boolean;
  readonly binary: boolean;
}
export interface DirectDiagnosticEvidenceV1 {
  readonly revision: 'direct-diagnostic-evidence-v1';
  readonly sourceCaseDigest: string;
  readonly diagnostics: CompilerDiagnosticEvidenceV1;
  readonly emission: ExecutionWorkerEmissionV1;
}
export type DiagnosticExecutionResultV1 =
  | { readonly status: 'pass'; readonly code: 'pass' }
  | {
      readonly status: 'failure';
      readonly code: 'diagnostic-mismatch' | 'unexpected-emission';
    };
export function classifyDiagnosticRouteEvidenceV1(
  authority: PublishedDiagnosticCaseV1,
  observed: unknown,
): ExecutionOperationResultV1<DiagnosticExecutionResultV1>;
export type ExecutionWorkerResponseV1 =
  | {
      readonly revision: 'execution-worker-response-v1';
      readonly tier: 'frontend';
      readonly contract: 'frontend-pipeline-v1';
      readonly caseIdentity: string;
      readonly diagnostics: CompilerDiagnosticEvidenceV1;
      readonly semanticModelPresent: boolean;
      readonly allocationPlanPresent: boolean;
      readonly emission: ExecutionWorkerEmissionV1;
    }
  | {
      readonly revision: 'execution-worker-response-v1';
      readonly tier: 'compiler-api';
      readonly contract: 'compiler-evidence-facade-v1';
      readonly caseIdentity: string;
      readonly hasErrors: boolean;
      readonly diagnostics: CompilerDiagnosticEvidenceV1;
      readonly emission: ExecutionWorkerEmissionV1;
    }
  | {
      readonly revision: 'execution-worker-response-v1';
      readonly tier: 'cli';
      readonly contract: 'blendc-cli-v1';
      readonly caseIdentity: string;
      readonly exitCode: 0 | 1 | 2 | 3;
      readonly stdout: Uint8Array;
      readonly stderr: Uint8Array;
      readonly diagnostics: CompilerDiagnosticEvidenceV1;
      readonly emission: ExecutionWorkerEmissionV1;
    }
  | {
      readonly revision: 'execution-worker-response-v1';
      readonly tier: 'emit';
      readonly contract: 'assembly-emitter-v1';
      readonly caseIdentity: string;
      readonly assemblyBytes: Uint8Array;
      readonly diagnostics: CompilerDiagnosticEvidenceV1;
      readonly emission: ExecutionWorkerEmissionV1;
    };
export function parseExecutionWorkerResponseV1(
  request: ExecutionWorkerRequestV1,
  input: unknown,
): ExecutionOperationResultV1<ExecutionWorkerResponseV1>;
export type ExecutionWorkerCompletionV1 =
  | { readonly kind: 'message'; readonly value: unknown }
  | { readonly kind: 'crash'; readonly exitCode: number | null };
export interface ExecutionWorkerHandleV1 {
  readonly completion: Promise<ExecutionWorkerCompletionV1>;
  terminate(): Promise<void>;
}
export interface ExecutionWorkerExecutorV1 {
  start(
    request: ExecutionWorkerRequestV1,
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionOperationResultV1<ExecutionWorkerHandleV1>>;
}
export interface ExecutionAdapterDependenciesV1 {
  readonly worker: { readonly executor: ExecutionWorkerExecutorV1 };
  readonly acme: { readonly runner: BoundedAcmeRunnerV1 };
  readonly lifecycle: { readonly supervisor: ExecutionSupervisorV1 };
  readonly vice: { readonly execute: typeof executeViceRouteV1 };
}
export function createExecutionRouteHandlersV1(
  dependencies: ExecutionAdapterDependenciesV1,
): PublishedExecutionHandlersV1;
```

The ACME seam is additive in `@blend65/compiler`:

```ts
export interface BoundedAcmeRunnerV1 {
  run(
    request: AcmeInvocation,
    controls: AcmeProcessControlsV1,
  ): Promise<AcmeRunOutput>;
}
export function invokeBoundedAcmeV1(
  request: AcmeInvocation,
  runner: BoundedAcmeRunnerV1,
  controls: AcmeProcessControlsV1,
): Promise<AcmeRunOutput>;
export interface AcmeProcessControlsV1 {
  readonly signal: AbortSignal;
  readonly deadlineMonotonicMs: number;
  readonly onStdout: (bytes: Uint8Array) => void;
  readonly onStderr: (bytes: Uint8Array) => void;
}
```

`classifyDiagnosticRouteEvidenceV1` is hostile-total over `unknown`. It re-authenticates the opaque
diagnostic case, requires the same source-case digest and exactly one accepted diagnostic entry with
the authority's code, phase and final severity. A diagnostic mismatch wins before later-artifact
classification; otherwise any IL, assembly or binary presence returns `unexpected-emission` in the
existing IL→assembly→binary precedence. Only an exact diagnostic with no later artifact passes.
Malformed evidence returns `invalid-evidence-input` through the outer operation result. No expected
field is accepted on `DirectDiagnosticEvidenceV1` or any worker request/response.

The diagnostic capability itself uses the closed
`published-diagnostic-case-equivalence-v1` join. Its passive authority projection preserves the
caller's `sourceCaseDigest` and separately carries the join revision, selected release digest,
selected campaign digest, selected source-case digest, evaluation identity and source-content
identity. These fields are parent-side identity inputs only and never enter the worker wire.
Construction validates the complete ambient compatibility tuple and full modeled case/source, and
privately derives the oracle handler from the selected rule route; callers cannot choose a handler
or assert that distinct caller/selected provenance digests are equal.

The bounded entry point is additive. Legacy `invokeAcme(inv, bag, runner)` retains its exact argv,
result and diagnostic behavior; it is not overloaded with cancellation semantics. The immutable
Phase 3 fixture constructs route requests through genuine campaign, execution-case and selected
oracle capabilities. Scripted workers and ownership probes remain local to that fixture and never
export from production.
