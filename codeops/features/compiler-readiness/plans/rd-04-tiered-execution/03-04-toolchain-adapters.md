# Component Design: Toolchain Adapters

> **Document**: 03-04-toolchain-adapters.md
> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P2, AR-P3, AR-P9

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
cannot be stopped reliably with an in-process promise timeout. The request and response are closed,
versioned, structured-clone-safe records. One all-tier worker executor is the only parent-side
dependency for frontend, compiler-API, CLI and emit handlers. Production worker entry modules
import the real frontend/compiler/CLI facades inside the worker; functions are never cloned or
invoked synchronously in the parent. Test executors implement the same closed request/response
boundary. The parent owns deadline, termination and evidence; a worker crash or invalid response
maps deterministically to compiler ICE or the route's stage error.

## Compatibility checks

Specification tests pin unchanged ordinary diagnostics, compiler result shape, CLI rendering/exit
behavior, default ACME caller behavior and root `ViceDriver` API. New evidence APIs are additive and
documented; no source or JSDoc mentions workflow artifact identifiers.

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
export interface ExecutionRouteRequestBaseV1<TTier extends ExecutionTierV1> {
  readonly route: ExecutionRoutePlanItemV1 & { readonly terminalTier: TTier };
  readonly executionCase: ExecutionCaseV1;
  readonly oracle: PublishedOracleContext;
  readonly policy: ExecutionPolicyV1;
}
export type ExecutionRouteRequestV1 =
  | ExecutionRouteRequestBaseV1<'frontend'>
  | ExecutionRouteRequestBaseV1<'compiler-api'>
  | ExecutionRouteRequestBaseV1<'cli'>
  | ExecutionRouteRequestBaseV1<'emit'>
  | ExecutionRouteRequestBaseV1<'acme'>
  | ExecutionRouteRequestBaseV1<'vice'>;
export interface ExecutionRouteHandlerV1 {
  execute(
    request: ExecutionRouteRequestV1,
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionResultV1>;
}
export interface ExecutionWorkerRequestV1 {
  readonly revision: 'execution-worker-request-v1';
  readonly tier: 'frontend' | 'compiler-api' | 'cli' | 'emit';
  readonly caseRoot: string;
  readonly sourceBytes: Uint8Array;
}
export interface ExecutionWorkerResponseV1 {
  readonly revision: 'execution-worker-response-v1';
  readonly result: ExecutionResultV1;
}
export interface ExecutionWorkerExecutorV1 {
  execute(
    request: ExecutionWorkerRequestV1,
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionWorkerResponseV1>;
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
export interface AcmeProcessControlsV1 {
  readonly signal: AbortSignal;
  readonly deadlineMonotonicMs: number;
  readonly onStdout: (bytes: Uint8Array) => void;
  readonly onStderr: (bytes: Uint8Array) => void;
}
```
