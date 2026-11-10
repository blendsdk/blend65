# Testing Strategy: RD-09 Developer Tooling and Debug Evidence

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

The tooling boundary is proved at four levels: the frontend tooling index, the real language-server
transport, the packaged extension/CLI adapter, and the debug-evidence producer. Root `test/rd09/`
holds specification and integration cases; the editor packages keep their existing real-transport
and bundle tests. No test uses compiler output as its own semantic oracle.

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Tooling index and formatter | 90% |
| Language-server protocol and queries | 85% |
| Extension command logic | 80% |
| Debug evidence additions | 90% |
| Glue/configuration | 60% |

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived from RD-09, the RD-03 debug contract, and the plan's component documents. Do not modify
> an expectation to match the implementation. Each row is self-contained for the spec-author packet.

### Frontend Tooling Index

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1 | A project with a module variable, function, parameter, local, constant, struct, enum, and field | `buildToolingIndex` returns one symbol per declaration with exact source spans, kinds, types, scopes, and stable ids; ordering is UTF-8 source/start/end | R9.1, R9.14, AR-4 |
| ST-2 | A local name shadowed in an inner block | `symbolAt` before, inside, and after the inner block resolves to the nearest visible binding; inner and outer ids differ | R9.18, AC-10, AR-16 |
| ST-3 | Two modules export the same name; one is imported under an alias | `visibleSymbols` and `referencesFor` use stable binding identity, not spelling; alias references resolve to the target | R9.18, AC-10, AR-16 |
| ST-4 | A struct field referenced through `.` | Field occurrence resolves to the field symbol; definition returns the field `nameSpan`; hover reports the field type and offset | R9.16, R9.18, AC-09 |
| ST-5 | A poisoned declaration from a recoverable syntax error | Index excludes poisoned declarations; queries whose answer depends on poison return no fact; a valid nearby symbol still resolves | R9.12, AC-07, AR-4 |
| ST-6 | Completion at a statement start, after `.`, inside `embed("`, and in a `place` region | Each context returns only legal candidates; struct fields for a struct operand; project-relative asset paths; profile regions; no inaccessible or wrong-kind item | R9.14, R9.15, AC-08, AR-15 |
| ST-7 | Completion in a project with more than 200 visible candidates | Result is deterministic, bounded to 200, and contains no duplicate label/kind pair | R9.14, AR-15 |
| ST-8 | Hover on a function value, interrupt sink, volatile register, compile-time value, asset, and placed object | Hover reports exact type/effects/const/volatile/asset/placement facts; no guessed final address or cost | R9.16, AC-09, AR-4 |
| ST-9 | Signature help inside a direct call's second argument | `signatureAt` reports the proved signature, active parameter index 1, parameter types/names, and return type | R9.17, AC-09 |
| ST-10 | Rename a user-owned local and a module export; rename a platform declaration, aliased import, or colliding name | Allowed renames return exact non-overlapping edits in every source; rejected renames return a typed reason and no edits | R9.19, AC-11, AR-16 |
| ST-11 | Document and workspace symbol requests on a project with nested declarations | Document symbols preserve source order/nesting; workspace symbols are project-scoped, deterministic, and capped at 100 | R9.20, AC-12, AR-17 |
| ST-12 | Semantic tokens on a valid document and on an invalid region | Valid tokens distinguish declaration/reference, readonly/mutable, compile-time, volatile, platform-owned, interrupt-only; invalid region uses lexical fallback or no modifier | R9.21, AC-12, AR-8 |
| ST-13 | A missing import, a missing lowering, a hardware-policy diagnostic, and a poisoned declaration | The code-action provider returns an empty list for every case; no speculative refactor or source workaround appears | R9.22, AC-13, AR-7 |

### Language Server

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-14 | Open a valid project and an invalid project; compare API, `blendc check`, and LSP diagnostics | Code, severity, message, primary/related spans, order, and cascade suppression are identical | R9.11, AC-01 |
| ST-15 | Open documents under two different manifests | Two isolated contexts; every query and diagnostic contains only its own project's facts | R9.8, AC-02 |
| ST-16 | Open saved version 1, change to unsaved version 2, request hover/definition/diagnostics | Every response reflects version 2; closing restores saved version 1 | R9.7, AC-03 |
| ST-17 | Controlled slow analysis for version 1 followed by version 2 | No version-1 diagnostic, edit, token, symbol, navigation, completion, or hover is published after version 2 is current | R9.9, AC-04 |
| ST-18 | ASCII, two-/three-byte UTF-8, astral, tabs, LF, CRLF, empty file, EOF | Byte↔protocol round-trip is exact for diagnostics, definition, references, rename, tokens, and formatting; the following token never shifts | R9.10, AC-05 |
| ST-19 | A frontend error and a seeded final-layout failure | Frontend error appears identically in CLI/LSP; final-layout failure appears only in build/run, never as a guessed live diagnostic | R9.11, AC-06 |
| ST-20 | Unknown method, malformed params, absent document, bad version, oversized payload, internal failure | Bounded protocol error or empty result; no crash, stack/path leak, stale publication, or file mutation | R9.24, AC-15, AR-14 |
| ST-21 | Cancel a request during analysis | Protocol-correct empty result; no publication; owned analysis stops; subsequent version still analyzes | R9.9, R9.24, AC-22 |
| ST-22 | Query before the first analysis completes | Empty/null result and a scheduled refresh; never a guessed or stale fact | R9.9, AC-04 |
| ST-23 | Project status transitions: no project, invalid, analyzing, ready, error, cancelled | `blend65/projectStatus` reports the matching state and effective profile; never `ready` for stale/poisoned/failed analysis | R9.26, AC-17 |
| ST-24 | File create/delete/rename and module-header change | Only affected project contexts invalidate and refresh; no stale ready state | R9.31, AC-17 |
| ST-25 | Real stdio transport for every advertised capability | Initialize advertises exactly the implemented surface; each request returns a valid protocol response | R9.14–R9.24, AC-16 |
| ST-26 | Bundle inspection of the language server | Imports only `@blend65/compiler/frontend`; no codegen/optimizer/packager/VICE/process-adapter path | R9.13, AC-01 |

### Formatter

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-27 | Representative valid document with module/import/function/control flow/struct/enum/comments | Canonical four-space/LF output; every non-trivia token, literal, comment, and declaration order preserved | R9.23, AC-14, AR-6 |
| ST-28 | Format a formatted document again | Second output is byte-identical; second request returns zero edits | R9.23, AC-14 |
| ST-29 | CRLF, tabs, astral text, empty file, comment-only file | Output is deterministic and token-preserving; empty stays empty; final newline exactly one | R9.23, AC-14, AR-18 |
| ST-30 | Syntax-invalid document | Formatter returns `unsupported`; server returns no edits; no guessed structure | R9.23, AC-14, AR-19 |

### CLI JSON and Evidence

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-31 | `check`, `build`, `run` success with `--json` | Exactly one `blend65.cli` version-1 object on stdout, one LF, empty stderr, exit 0, success outcome | R9.4, AC-01, AR-3 |
| ST-32 | Source diagnostics, compiler/tool failure, cancellation with `--json` | Correct outcome/category/diagnostics and unchanged exit status; no human text mixed into stdout | R9.4, AC-01, AR-3 |
| ST-33 | Invalid arguments and duplicate `--json` | Invalid-arguments envelope, exit 2, no process execution | R9.4, AC-15, AR-3 |
| ST-34 | `blendc evidence` on a valid current generation | Validated current generation and all eight artifact roles/hashes; no mutation | R9.32, AC-24, AR-13 |
| ST-35 | Evidence missing, malformed, escaping, symlinked, hash-mismatched, mixed, or stale | Typed failure; no artifact path returned; nothing executed or deleted | R9.32, AC-24, AR-13 |

### VS Code Client

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-36 | Manifest inspection | Registers Build, Run in VICE, Open Build Evidence; no Build and Run, no no-build rerun, no auto-run, no configuration/webview | R9.27, AC-18, AR-2 |
| ST-37 | Untrusted workspace | Diagnostics/hover/navigation/symbols/formatting work; Build/Run/artifact reveal denied before save, spawn, or monitor | R9.28, AC-20, AR-13 |
| ST-38 | One dirty consumed source and one dirty unrelated file | Consumed source is saved and build consumes saved bytes; unrelated file does not block; decline/failure aborts and names the input | R9.27, AC-19, AR-2 |
| ST-39 | Build success and failure | Progress shows project/profile/phase; Problems receives structured diagnostics; Output has bounded summary/final artifact/category; no source dump/stack/unnecessary absolute path | R9.30, AC-23, AR-2 |
| ST-40 | Run success and cancellation | Fresh build, pinned generation, only its hash-bound artifact launched; cancellation terminates owned process group and reports build/run status separately | R9.27, R9.6, AC-21, AC-22 |
| ST-41 | Missing CLI, malformed JSON, child spawn failure | Actionable command failure; no success claim; no fallback pipeline | R9.29, AC-21, AR-3, AR-20 |
| ST-42 | Artifact open on valid, historical, and invalid generations | Valid current evidence opens/reveals exactly the hash-matching contained file; historical is labeled by generation; invalid/hash-mismatch/mixed opens nothing | R9.32, AC-24, AR-13 |
| ST-43 | Extension bundle inspection | Contains no compiler backend path; externalizes `@blend65/cli`; resolves `./bin` and spawns with an argument array | R9.25, R9.33, AC-16, AR-2 |
| ST-44 | Project status refresh on manifest/source/asset change | Status transitions truthfully and refreshes only the affected context; no stale ready | R9.31, AC-17 |
| ST-45 | Project/source/setting/artifact injection attempts | No shell option injection, `..`, absolute content path, symlink escape, hostile Markdown, monitor injection, or unescaped output | R9.24, R9.32, AC-32, AR-13 |

### Debug Evidence

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-46 | `.debug.json` validation on a successful build | Validates against the frozen version-1 contract; identities match `.build.json`; unsupported major is E10268; malformed payload is E10267 | R9.34, AC-25, AR-9 |
| ST-47 | Two byte-identical projects at different absolute roots | Normalized debug evidence is byte-identical; no absolute path, timestamp, generation id, or random identity | R9.35, AC-25, AR-9 |
| ST-48 | Ordinary calls, inlining/elimination, split ranges, branch repair, generated helper/startup code | Every range uses final bytes and lies inside the corresponding bank-qualified emitted object; non-contiguous mappings are represented | R9.36, AC-26, AR-9 |
| ST-49 | Nested calls, aggregate return, overlays, mainline/IRQ variants, constant/optimized-away/rematerializable/unavailable values | Exact type, domain, location/live interval, and availability; same-spelling shadowed bindings stay distinct; no invalid static home | R9.38, AC-27, AR-9 |
| ST-50 | Resident and loadable D64 fixtures | Each loadable unit records its exact residence interval from the load destination; boot has none; no synthetic bank is emitted for cpu16 | R9.39, AC-28, AR-9 |
| ST-51 | Helper-scratch fixture | Generated `helperScratch` symbol with exact home, owning function context, distinct identity, and no source declaration | R9.38, AC-27, AR-9 |
| ST-52 | Cross-artifact mutation of address, bank, range, hash, generation, required field, or schema major | Validation fails; every sidecar validates independently; `.build.json` hashes every other artifact but not itself | R9.40, AC-29, AR-9 |
| ST-53 | Same frozen project built with debug observation enabled and disabled in the test observer | Assembly, primary artifact, maps, target symbols, memory/ZP/SFA/stack totals, startup path, and VICE behavior are byte-identical; only host `.debug.json` observation differs | R9.41, AC-30, AR-10 |
| ST-54 | Adapter probe report | Records exact VICE/adapter/schema versions and supported/lossy/unsupported source-breakpoint, stepping, and variable inspection results; no shipped DAP or support claim | R9.42, AC-31, AR-11 |

### Security, Qualification, Closeout

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-55 | Malicious project/setting/protocol/artifact values | All injection/containment cases reject with no outside file, command, process, or unescaped output | R9.24, R9.32, AC-32, AR-13 |
| ST-56 | Closeout verification run | Family-directed checks, one complete tooling boundary, packaged extension check, debug cross-artifact validation, one small ACME build, one sequential VICE run/cleanup; no unrelated full corpora | R9.47, AC-33 |
| ST-57 | Responsiveness observation on a real qualified project | Phase-separated durations and peak memory with complete host/project/tool identity; no wall-clock assertion | R9.48, AC-34 |
| ST-58 | Deferral-expiry scan | Closeout answers whether RD-09 expired any deferral and assigns an owner for every newly due item before Done | R9.49, AC-35 |

## Test Categories

### Specification Tests (from ST cases above)

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `test/rd09/tooling-index.spec.test.ts` | ST-1–ST-13 | Tooling index |
| `test/rd09/lsp-diagnostics.spec.test.ts` | ST-14, ST-18–ST-20, ST-25, ST-26 | LSP diagnostics/protocol |
| `test/rd09/lsp-snapshots.spec.test.ts` | ST-15–ST-17, ST-21–ST-24 | LSP snapshots/status |
| `test/rd09/formatter.spec.test.ts` | ST-27–ST-30 | Formatter |
| `test/rd09/cli-json.spec.test.ts` | ST-31–ST-35 | CLI adapter |
| `test/rd09/vscode-commands.spec.test.ts` | ST-36–ST-45 | VS Code client |
| `test/rd09/debug-evidence.spec.test.ts` | ST-46–ST-54 | Debug evidence |
| `test/rd09/security.spec.test.ts` | ST-55 | Security |
| `test/rd09/qualification.spec.test.ts` | ST-56–ST-58 | Closeout |

### Implementation Tests

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/compiler/src/frontend/tooling.impl.test.ts` | Index internals, ordering, occurrence invariants | High |
| `packages/compiler/src/frontend/formatter.impl.test.ts` | Scanner edge cases, unary/binary spacing, comment preservation | High |
| `packages/language-server/src/server.impl.test.ts` | Version/store/cancellation internals | High |
| `packages/vscode/src/extension.impl.test.ts` | Host wiring, CLI resolution, process-group cleanup | High |
| `packages/cli/src/json.impl.test.ts` | Envelope serialization, argument edge cases | High |
| `packages/compiler/src/services/debug-evidence-zero-cost.impl.test.ts` | Internal observer comparison | High |

### Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| Real LSP transport | Server + compiler frontend | Every capability over framed JSON-RPC |
| Real CLI child | Extension command logic + `blendc` | Build/run JSON, cancellation, evidence |
| Debug cross-artifact | Compiler services + publication | Hash/address/range coherence |
| One small VICE case | CLI + VICE 3.10 | Sequential launch/cleanup, opt-in |

## Test Data

### Fixtures Needed

- A small valid project with modules, imports, a struct, enum, function, locals, parameters,
  constants, placement, and one asset.
- A project with two manifests for isolation.
- UTF-8/astral/CRLF/tabs/EOF source fixtures.
- A D64 loadable fixture with two units (reuse the RD-07 synthetic project shape).
- A helper-scratch fixture that exercises a certified helper request.
- A frozen project for zero-cost comparison.
- Malicious path/JSON/protocol fixtures.
- The packaged extension bundle and the built `blendc`.

### Mock Requirements

- The VS Code host is faked through the narrow `CommandHost` interface; the CLI and compiler remain
  real.
- The LSP transport is real for protocol cases; only the OS child boundary may be faked where the
  test host cannot spawn.
- No compiler service is mocked in a test that proves shared semantics.

## Verification Checklist

- [ ] All specification test cases (ST-\*) defined with concrete input/output pairs
- [ ] Every ST case traces to a requirement, contract, or AR entry
- [ ] Specification tests written before implementation
- [ ] Specification tests verified to fail before implementation
- [ ] All specification tests pass after implementation
- [ ] Implementation tests written for edge cases and internals
- [ ] All unit/integration/E2E tests pass
- [ ] No regressions in existing suites
- [ ] Coverage meets goals
