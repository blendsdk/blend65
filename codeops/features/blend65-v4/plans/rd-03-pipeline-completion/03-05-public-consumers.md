# Public Consumers: RD-03 Pipeline Completion

> **Document**: 03-05-public-consumers.md
> **Parent**: [Index](00-index.md)

## Overview

Expose the completed pipeline through three direct compiler services, the existing CLI, one
diagnostics-only language server and one thin VS Code extension. The editor path stops at the
backend-free frontend export. No daemon, command framework, navigation feature or build UI is
introduced (AR-C2, AR-C9, AR-C10).

## Compiler Service Surface

`@blend65/compiler` exports these asynchronous services and their documented option/result types:

```ts
checkProject(options?: CheckOptions): Promise<CheckResult>
buildProject(options?: BuildOptions): Promise<BuildResult>
runProject(options?: RunOptions): Promise<RunResult>
```

All options carry the RD-02 discovery inputs plus an optional `AbortSignal`. Build/run options may
override only the manifest fields already authorized by RD-03. Results are discriminated unions;
expected project, source, tool and host failures never require consumers to parse text or catch a
process exception (AR-C9, AR-C14).

| Service | Work performed | Success payload | Must not do |
|---|---|---|---|
| `checkProject` | Fresh load, reachable frontend, profile binding, asset validation, semantic CFG, whole-program and SFA closure checks that are provable before layout | Snapshot/profile identities, diagnostics and check measurements | Create output, run ACME/VICE or claim layout/artifact proof |
| `buildProject` | Fresh complete check through layout, ACME verification and publication | Exact `PublishedGeneration`, diagnostics, evidence identities and measurements | Reuse a prior artifact as success |
| `runProject` | Its own fresh successful build, same-critical-section pin, exact VICE launch and cleanup | Built generation, run status and bounded verification label | Re-resolve current, launch stale output or patch program state |

The public failure discriminator is one of `source`, `compiler`, `assembler`, `packaging`,
`tool-discovery`, `emulator-start`, `emulator-runtime`, `cancelled` or `recovery-required`.
Unexpected invariant failures remain internal errors and cannot leave a runnable-looking current
generation (AR-C9, AR-C14).

## Backend-Free Frontend Subpath

`@blend65/compiler/frontend` exports only:

- the stable diagnostic/source/result types already needed by consumers;
- `analyzeProject` for an immutable RD-02 snapshot; and
- `analyzeProjectOverlay` for the same snapshot with a bounded map of canonical source IDs to
  in-memory UTF-8 text.

An overlay changes no disk file or snapshot identity. It replaces only known source contents for
one analysis, recomputes their content hashes in memory and cannot add assets, modules, profile
facts or outputs. Unknown IDs, invalid UTF-8 and over-limit content return diagnostics. The subpath
cannot import or re-export semantic CFG, SFA, target, lowering, layout, ACME, publication or VICE
modules. The existing transitive import-boundary test enforces that property (AR-C2, AR-C9).

## CLI

The existing `blendc` parser admits exactly `check`, `build` and `run`, plus its existing
help/version behavior. It maps these options directly to the compiler service types:

- `--project <path>`;
- `--target <profile>`;
- `--entry <module>`;
- `--optimization none`;
- `--bounds-check <true|false>`; and
- `--division-zero-check <true|false>`.

Options use exact allowlists, reject duplicates/unknowns/missing values and never become shell
fragments. Human output renders diagnostics and one concise success summary. Exit statuses are
fixed by the failure categories above; `check` never prints a build/run success, and `run` does not
report success before the emulator starts. A SIGINT/SIGTERM-owned abort reaches the selected
service and awaits cleanup (AR-C9, AR-C14).

## Language Server

`@blend65/language-server` is a Node ESM workspace depending on
`@blend65/compiler` only through `@blend65/compiler/frontend`, plus
`vscode-languageserver` and `vscode-languageserver-textdocument`. Its stdio entry:

1. accepts file-document URIs with the `.blend` suffix;
2. discovers the nearest RD-02 project for the document;
3. loads a fresh project snapshot and applies all open documents belonging to that project as
   analysis-only overlays;
4. runs only project/frontend analysis on open/change/save/close; and
5. publishes lexical, syntax, module and semantic diagnostics for open documents.

One monotonically increasing request number per project makes older analysis results ineligible for
publication. A newer request aborts the previous one; no generic scheduler or incremental compiler
cache is added. Closing a document removes its overlay and triggers one disk-backed analysis.

Diagnostic conversion preserves severity, code, message and related locations. Raw UTF-8 byte
offsets are converted against the exact analyzed text to zero-based UTF-16 LSP positions, including
non-ASCII and zero-width EOF spans. Diagnostics are bounded by the compiler service and ordered by
the compiler, not re-sorted by the server. Invalid/non-file/out-of-project URIs receive no project
analysis and cannot escape project discovery (AR-C9, AR-C10, AR-C14).

The server advertises text synchronization and diagnostics only. It registers no build/run,
completion, hover, definition, rename, formatting, workspace command or file-write capability.

## VS Code Extension

`@blend65/vscode` is a thin Node extension workspace using `vscode-languageclient`. Its manifest:

- contributes language ID `blend65` for `*.blend`;
- activates only for that language;
- starts the bundled language-server entry over stdio; and
- stops the client/server cleanly on deactivation.

Vite bundles the server and extension Node entry points from explicit configurations. The bundles
are real executable outputs; they contain no backend/compiler build imports. There is no VSIX
publishing, command palette item, settings schema, icon/theme, web extension or test host in RD-03
(AR-C10).

## Testing Requirements

- Compiler API cases prove fresh check/build/run sequencing, result categories, cancellation and
  absence of output from `check`.
- CLI cases prove every option and exit category without invoking a shell.
- Frontend-subpath and transitive package-boundary cases prove no backend reachability.
- Language-server cases use real JSON-RPC messages for open/change/save/close, overlay siblings,
  UTF-8-to-UTF-16 spans, stale-result suppression and malformed URI containment.
- Bundle cases build both Node entries, start the real server over stdio, exchange initialize/open
  messages and inspect the extension manifest. They do not pretend to be native VS Code UI proof.
- Native Windows Node 22 editor/process smoke remains only the named AR-C16 deferral.
