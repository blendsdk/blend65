# RD-09 Developer Tooling and Debug Evidence Implementation Plan

> **Feature**: Production language server, thin VS Code client, CLI adapter, and portable debug evidence
> **Status**: Done
> **Created**: 2026-11-10 22:12
> **Implements**: blend65-v4/RD-09
> **CodeOps Artifact Schema**: 1

## Overview

RD-09 turns the existing diagnostic-only language server into the production editing surface
required by Specification 4 and the modern-developer directive. The compiler already exposes a
frontend-only typed program with stable binding identities, typed expression nodes, effects,
assets, load units, and profile facts. This plan builds one shared tooling index over that result,
then serves diagnostics, completion, hover, signature help, definition, references, rename,
symbols, semantic tokens, bounded code actions, and one canonical formatter through the language
server. It adds no second parser, type system, project model, or backend path.

The VS Code extension remains a thin client. It starts the matching language server, owns editor
integration, and delegates explicit Build/Run to the packaged `blendc` CLI through a versioned JSON
result envelope. This preserves the editor/backend import boundary and means the extension contains
no compiler, assembler, packager, or VICE protocol code.

The final workstream completes the debug-evidence consumer contract: bank/load identity, SFA
location truth, cross-artifact coherence, zero target cost, and a bounded adapter probe. RD-09 does
not build a debugger or a DAP service. It proves that the evidence a later debugger needs is
portable, final, and truthful.

## Minimum-Sufficient Baseline

**Original goal:** give Blend65 developers a real editor workflow and portable debug evidence
without moving compiler logic into the editor.

**Smallest viable design:** one frontend-only tooling index derived from the existing
`AnalysisResult`; one language server process per extension host; one canonical token-stream
formatter; one packaged `blendc` child process for explicit Build/Run; and existing RD-03 debug
records populated from existing RD-05 through RD-08 facts.

**Excluded machinery:** no incremental compiler, persistent daemon, semantic cache, plugin
framework, owned DAP, debugger UI, asset editor, package manager, remote service, telemetry, or
second build pipeline. No new runtime dependency beyond the already workspace-owned `@blend65/cli`
and existing LSP/client libraries.

**Approved complexity:** none beyond the RD baseline. Every added module is ordinary feature code
required by R9.1–R9.52; no Complexity Escalation packet was raised.

## Document Index

| #   | Document                                                       | Description                                        |
| --- | -------------------------------------------------------------- | -------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                 | Zero-Ambiguity Gate decisions                      |
| 00  | [Index](00-index.md)                                           | This document                                      |
| 01  | [Requirements](01-requirements.md)                             | RD-09 delta view and plan-local decisions          |
| 02  | [Current State](02-current-state.md)                           | Audited current implementation and gaps            |
| 03  | [Frontend Tooling Index](03-01-frontend-tooling-index.md)      | Shared query facts over the typed program          |
| 03  | [Language Server](03-02-language-server.md)                    | Protocol, snapshots, queries, capabilities         |
| 03  | [Formatter](03-03-formatter.md)                                | Canonical token-stream formatter                   |
| 03  | [VS Code Client](03-04-vscode-client.md)                       | Thin client, commands, status, evidence access     |
| 03  | [CLI JSON Adapter](03-05-cli-json-adapter.md)                  | Machine-readable command result envelope           |
| 03  | [Debug Evidence](03-06-debug-evidence.md)                      | Load/bank identity, SFA truth, zero-cost proof     |
| 07  | [Testing Strategy](07-testing-strategy.md)                     | Specification and implementation test cases        |
| 09  | [Closeout](09-closeout.md)                                     | Delivered slice, verification, deferral scan       |
| 99  | [Execution Plan](99-execution-plan.md)                         | Phases, tasks, and verification                    |

## Quick Reference

### Usage Examples

```text
blendc check --project game/blend65.json --json
blendc build --project game/blend65.json --json
blendc run   --project game/blend65.json --json
```

```text
VS Code: Blend65: Build
VS Code: Blend65: Run in VICE
VS Code: Blend65: Open Build Evidence
```

### Key Decisions

| Decision                     | Outcome                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| Editor backend boundary      | Extension spawns packaged `blendc`; never imports compiler backend   |
| Shared semantic source       | Frontend tooling index over `AnalysisResult`                         |
| Formatter                    | Token-stream, four-space, LF, no options                             |
| Code actions                 | None advertised until a proved edit exists                           |
| Debug bank/load facts        | Populate existing RD-03 fields; no schema change                     |
| Adapter probe                | Bounded report; no owned DAP                                         |

## Specialist Agents

| Role                   | Kind     | Use                                                            | AR Ref |
| ---------------------- | -------- | -------------------------------------------------------------- | ------ |
| `sfa-abi-auditor`      | reviewer | Debug evidence SFA locations, live ranges, shadowing truth     | AR-9, AR-10 |
| `target-platform-auditor` | reviewer | VICE/adapter probe, load-unit residence, zero target cost   | AR-9, AR-11 |
| `machine-code-auditor` | reviewer | Zero target debug cost artifact comparison                     | AR-10  |
| `security-auditor`     | reviewer | Protocol, containment, trust, artifact-open hardening          | AR-13, AR-15, AR-16 |

_Detection evidence: RD-09 directly changes SFA location evidence
(`packages/compiler/src/services/evidence-records.ts`), VICE/debug interoperability and load-unit
residence (`test/rd07/`, `packages/compiler/src/services/evidence.ts`), emitted artifact identity
(`packages/compiler/src/publication/`), and editor protocol/security boundaries
(`packages/language-server/src/server.ts`, `packages/vscode/src/extension.ts`). The repository
already defines these four review roles for exactly these domains.

## Related Files

| File | Purpose |
| --- | --- |
| `packages/compiler/src/frontend/tooling.ts` | New shared tooling index (planned) |
| `packages/compiler/src/frontend/formatter.ts` | New canonical formatter (planned) |
| `packages/compiler/src/frontend/index.ts` | Public frontend export surface |
| `packages/language-server/src/server.ts` | Language server transport and capabilities |
| `packages/vscode/src/extension.ts` | Thin VS Code client |
| `packages/cli/src/main.ts`, `run.ts`, `render.ts` | CLI JSON envelope |
| `packages/compiler/src/services/evidence.ts`, `evidence-records.ts` | Debug evidence producer |
| `test/rd09/` | New root specification and integration tests (planned) |
| `docs/tooling.md` | User-facing editor and debug-evidence guide |
| `docs/rd09-debug-adapter-probe.md` | Bounded adapter interoperability result |
| `docs/rd09-responsiveness.md` | Observational responsiveness record |
