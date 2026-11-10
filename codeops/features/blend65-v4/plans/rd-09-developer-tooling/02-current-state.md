# Current State: RD-09 Developer Tooling and Debug Evidence

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

| Area | Current facts |
| --- | --- |
| Compiler public service | `checkProject`, `buildProject`, `runProject` are exported from `packages/compiler/src/index.ts:5-9`; typed results and cancellation live in `packages/compiler/src/services/types.ts:4-108`. |
| Project model | `loadProject` performs upward `blend65.json` discovery, contained source inventory, coherent snapshot reads, and stable input hashing (`packages/compiler/src/project/snapshot.ts:256-295`, `discovery.ts:25-71`). |
| Frontend analysis | `analyzeProject` and `analyzeProjectOverlay` return a `TypedProgram` with modules, bindings, types, declarations, calls, effects, load units, assets, and profile (`packages/compiler/src/frontend/service.ts:62-113, 534-569`). |
| Typed spans | `TypedExpr` carries a source span, resolved `BindingId`, type, constant value, place, signature, member/index facts, and effects (`packages/compiler/src/frontend/semantic-types.ts:250-360`). |
| Language server | 361 lines in `packages/language-server/src/server.ts`. It publishes push diagnostics and handles open/change/save/close, overlays, project discovery, supersession by generation, and UTF-8→UTF-16 conversion. |
| VS Code extension | 26 lines in `packages/vscode/src/extension.ts`. It starts the language server over stdio and does nothing else. |
| Debug evidence | `.debug.json` version 1 is emitted with all 21 root fields (`packages/compiler/src/services/evidence.ts:1265-1356`), validated by a closed validator (`packages/compiler/src/artifacts/debug-evidence-validator.ts:33-469`), and hashed by `.build.json`. |
| CLI | `blendc check/build/run` with strict arguments and stable exit statuses (`packages/cli/src/run.ts:24-120`); human text only. |
| Protocol pins | `vscode-languageserver` 10.1.1, `vscode-languageclient` 10.1.1, protocol 3.18.3, VS Code engine `^1.138.0`. |

### Relevant Files

| File | Purpose | Changes Needed |
| --- | --- | --- |
| `packages/compiler/src/frontend/tooling.ts` | New shared query index | Create |
| `packages/compiler/src/frontend/formatter.ts` | New canonical formatter | Create |
| `packages/compiler/src/frontend/index.ts` | Frontend public exports | Export tooling and formatter |
| `packages/language-server/src/server.ts` | Protocol and diagnostics | Split into modules; add capabilities, versions, cancellation |
| `packages/language-server/src/*.ts` | Query handlers | Create per capability family |
| `packages/vscode/src/extension.ts` | Thin client | Add status, commands, trust, save, output, artifacts |
| `packages/cli/src/render.ts`, `run.ts`, `main.ts` | CLI output | Add `--json` envelope |
| `packages/compiler/src/services/evidence.ts`, `evidence-records.ts` | Debug producer | Populate load-unit residence and missing location facts |
| `packages/compiler/src/services/services.ts` | Build/run services | Internal zero-cost test observer |
| `test/rd09/` | Root tooling tests | Create |

### Code Analysis

- The language server imports only `@blend65/compiler/frontend` (`server.ts:4-15`). The import
  boundary test treats `language-server` and `vscode` as frontend owners and rejects the compiler
  root and every backend subpath (`test/import-boundary.ts:24-28, 279-310`).
- The server tracks one `ProjectQueue` per project root with a generation counter and one
  `AbortController`; stale results are dropped (`server.ts:25-37, 182-185, 243-250, 285-292`).
- The server does not read `document.version`; the overlay type has no version
  (`packages/compiler/src/frontend/overlay.ts:12-18`).
- The initialize response advertises only `textDocumentSync`; the existing spec asserts exactly
  that one key (`server.spec.test.ts:304-317`).
- The extension manifest contributes only the language and has no commands or configuration
  (`packages/vscode/package.json:19-31`); tests intentionally assert the minimal surface
  (`extension.spec.test.ts:24-32`).
- The frontend `TypedProgram` already contains the exact facts needed for tooling: stable
  `BindingId`, declaration spans, typed expressions, calls, effects, assets, placement, and load
  units. The missing layer is a deterministic index that maps source positions to those facts.
- `.debug.json` emits `loadUnits` with empty `residence` (`evidence.ts:1336-1355`) and never emits
  `bankIndex` or `loadUnitIndex` on ranges. `.memory.json` already records load states
  (`evidence.ts:974-1017`).
- The CLI has no machine-readable output; the extension cannot consume human text reliably.

## Gaps Identified

### Gap 1: No shared tooling index

**Current Behavior:** The frontend exposes typed declarations and bodies, but there is no stable
position→symbol, symbol→references, completion, hover, or rename index.

**Required Behavior:** R9.14–R9.21 need one frontend-only derived index over `AnalysisResult`.

**Fix Required:** Add `frontend/tooling.ts` with occurrence, scope, type, field, and export facts;
export it through the frontend subpath.

### Gap 2: Language server is diagnostics-only

**Current Behavior:** Only `textDocumentSync` and push diagnostics are implemented.

**Required Behavior:** R9.7–R9.24 require versioned overlays, cancellation, project isolation, all
editor queries, and protocol robustness.

**Fix Required:** Split `server.ts` into project-context, document-store, diagnostics, and query
modules; advertise and implement the full capability set.

### Gap 3: VS Code extension is a stub

**Current Behavior:** It only starts the language client.

**Required Behavior:** R9.25–R9.33 require status, Build/Run, trust, save-or-abort, progress,
output, refresh, artifact access, and a self-contained packaged client.

**Fix Required:** Add the thin command/host module, manifest contributions, CLI adapter, and
trust/containment rules.

### Gap 4: CLI has no machine-readable result

**Current Behavior:** `blendc` prints human text and exits with a status.

**Required Behavior:** R9.4 and R9.29 require a stable machine-readable category/result for the
extension adapter.

**Fix Required:** Add `--json` with a versioned envelope; keep human output and exit statuses.

### Gap 5: Debug evidence omits load residence and some location states

**Current Behavior:** D64 `loadUnits[].residence` is always empty; ranges omit `loadUnitIndex`;
helper scratch and split availability are admitted by the schema but not produced.

**Required Behavior:** R9.36–R9.40 and AC-25–AC-29 require final load/bank identity and truthful
SFA locations.

**Fix Required:** Populate existing contract fields from the memory/load and SFA evidence that
RD-05 through RD-08 already produce. No schema-version change.

### Gap 6: No zero-cost or adapter proof

**Current Behavior:** Debug tests validate records but do not compare target bytes with evidence
observation disabled; no adapter probe report exists.

**Required Behavior:** AC-30 and AC-31.

**Fix Required:** Add an internal test observer and a checked-in probe report.

## Dependencies

### Internal Dependencies

- RD-02 project snapshots and contained paths.
- RD-03 frozen sidecar/debug contracts and diagnostics precedence.
- RD-04 complete frontend language and typed semantic model.
- RD-05 profile/platform/effect facts.
- RD-06 asset metadata and placement constraints.
- RD-07 load units, D64 publication, and memory load states.
- RD-08 optimization modes and final location evidence.

All are delivered and closed. No dependency is pending.

### External Dependencies

- Node 22+, Yarn classic, TypeScript 7, Vitest, Vite 5.4.21.
- `vscode-languageserver` 10.1.1, `vscode-languageclient` 10.1.1, protocol 3.18.3.
- ACME 0.97 and VICE 3.10 for explicit build/run and the bounded probe.
- No new package is added.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Tooling index grows into a second semantic system | Medium | High | Derive only from `AnalysisResult`; no parser/type checker; boundary tests enforce frontend-only imports |
| LSP query code duplicates scope/type rules | Medium | High | One index module owns occurrence/scope/type presentation; handlers only adapt to LSP |
| Extension import boundary breaks | Low | High | Spawn `blendc`; add an explicit import-boundary test for the extension bundle |
| Formatter changes tokens | Medium | High | Token-preservation and idempotence oracles; reject invalid input |
| Debug evidence changes target bytes | Low | High | Internal observer comparison of `.asm`, PRG/D64, labels, maps, totals |
| Protocol surface destabilizes existing diagnostics | Medium | Medium | Keep the existing diagnostics tests green; add capability tests incrementally |
