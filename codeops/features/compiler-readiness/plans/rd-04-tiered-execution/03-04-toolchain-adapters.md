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
assembly or binary at or after the rejecting stage is `execution.unexpected-emission`.

## ACME integration

The existing default ACME API remains compatible. An additive runner seam accepts argv, cwd,
deadline, cancellation and streaming evidence callbacks from the route supervisor. Discovery
failure maps to `execution.tier.unavailable`; a discovered executable returning non-zero, timing
out or omitting declared artifacts maps to its assembler-stage code. Binary, label and report files
are validated as regular files under the case root before hashing or parsing.

## Worker protocol

Compiler, CLI and emit operations run in Node worker threads because their synchronous CPU work
cannot be stopped reliably with an in-process promise timeout. The request and response are closed,
versioned, structured-clone-safe records. The parent owns deadline, termination and evidence; a
worker crash or invalid response maps deterministically to compiler ICE or the route's stage error.

## Compatibility checks

Specification tests pin unchanged ordinary diagnostics, compiler result shape, CLI rendering/exit
behavior, default ACME caller behavior and root `ViceDriver` API. New evidence APIs are additive and
documented; no source or JSDoc mentions workflow artifact identifiers.
