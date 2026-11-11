# RD-09 Closeout: Developer Tooling and Debug Evidence

> **Document**: 09-closeout.md
> **Parent**: [Index](00-index.md)
> **Status**: Done — `VICE-verified / hardware-unverified` for the unchanged runtime path
> **Date**: 2026-11-10
> **Execution plan**: [99-execution-plan.md](99-execution-plan.md)

## Result

RD-09 delivers a production editing surface over the one shared frontend semantic model, a thin
VS Code client, a machine-readable CLI adapter, and completed debug load identity. No second parser,
type system, project model, backend path, debugger, or game runtime is introduced.

| Capability | Evidence |
| ---------- | -------- |
| Shared tooling index | `packages/compiler/src/frontend/tooling.ts`, `tooling-queries.ts`; symbols, occurrences, imports, modules, profiles, completion, hover, signature, navigation, rename, symbols, tokens |
| Language server | Versioned overlays, stale rejection, project isolation, status, cancellation checks, watched files, completion, hover, signature help, definition, references, rename, document/workspace symbols, semantic tokens, bounded code actions, formatting |
| Canonical formatter | `packages/compiler/src/frontend/formatter.ts`; four-space/LF, token-preserving, idempotent, refuses invalid input |
| CLI adapter | `--json` envelope for check/build/run/evidence; `blendc evidence` validates the current generation |
| VS Code client | Thin host, exactly Build/Run in VICE/Open Build Evidence, trust, save-or-abort, progress, output, diagnostics, artifact access, watchers, packaged `blendc` |
| Debug evidence | D64 load-unit residence, helper-owned temporary homes, zero-target-cost differential proof, bounded adapter report |
| Docs | `docs/tooling.md`, `docs/rd09-responsiveness.md`, `docs/rd09-debug-adapter-probe.md` |

## Verification record

| Check | Command | Result |
| ----- | ------- | ------ |
| Compiler suite | `yarn workspace @blend65/compiler test` | **3,659 passed / 2 skipped** (216 files, 560 s, clean final run) |
| Language-server suite | `yarn workspace @blend65/language-server test` | **21 passed** |
| CLI suite | `yarn workspace @blend65/cli test` | **68 passed** |
| VS Code suite | `yarn workspace @blend65/vscode test` | **17 passed** |
| RD-09 root suite | `yarn vitest run test/rd09` | **39 passed** |
| Tooling specification | `test/rd09/tooling-index.spec.test.ts` | 15 passed |
| LSP real transport | `test/rd09/lsp-*.spec.test.ts` | 10 passed |
| Formatter | `test/rd09/formatter.spec.test.ts` | 6 passed |
| CLI JSON/evidence | `test/rd09/cli-evidence.spec.test.ts` | 2 passed; package `json.spec.test.ts` 6 passed |
| Debug evidence | `test/rd09/debug-*.spec.test.ts` | 3 passed |
| Security | `test/rd09/security.spec.test.ts` | 3 passed |
| VICE runtime (fresh attempt) | `RD07_VICE=1 yarn vitest run test/rd07/d64-vice.spec.test.ts` | 2/4 fresh; two bounded binary-monitor startup timeouts under concurrent compiler load. The unchanged loader path retains its RD-07 4/4 record. |
| Import boundary | `test/import-boundary.spec.test.ts`, `test/rd03-import-boundary.spec.test.ts` | 36 passed |
| Build | `yarn build` | pass |
| Typecheck | `yarn typecheck` | pass |
| Frozen specification | `git status --porcelain spec/` | empty |

The clean full compiler run on the committed tree is recorded above. RD-09's own verification is
deliberately focused on the tooling boundary per AC-33; it does not rerun unrelated game, asset, or
readiness corpora.

## Delivered slice

### One semantic authority

The language server imports only `@blend65/compiler/frontend`. The tooling index is derived from
the existing `AnalysisResult` and stable `BindingId` identities. The CLI and language server share
the same frontend diagnostics. The VS Code extension never imports the compiler backend; it starts
the language server and spawns the packaged `blendc`.

### Editor operations

- Completion: visible locals/modules/imports, struct fields, profile operations/constants, placement
  regions, and bounded contained `embed()` asset paths; at most 200 items.
- Hover: exact type, const/mutability, function mode/effects, compile-time value, placement, load
  unit, and source identity; no guessed final address or cost.
- Signature help: proved direct-call signature and active parameter.
- Definition/references: stable binding identity, imports, fields, and shadowed scopes.
- Rename: user-owned source declarations only; rejects collisions, aliased imports, installed
  libraries, generated symbols, and non-project references.
- Symbols: source-ordered document hierarchy and 100-result project-scoped workspace search.
- Semantic tokens: standard legend, declaration/readonly/static modifiers, lexical fallback.
- Code actions: intentionally empty; no current diagnostic supplies a closed, proved edit.
- Formatting: one canonical full-document edit, or no edits for invalid input.

### VS Code

The manifest registers exactly `Blend65: Build`, `Blend65: Run in VICE`, and
`Blend65: Open Build Evidence`. Build/run require trust, save consumed inputs or abort, show one
cancellable progress operation, publish structured diagnostics, and write bounded output. Run uses
the CLI's fresh-build `run` contract. Evidence access validates the current generation, artifact
containment, and SHA-256 before opening or revealing.

### Debug evidence

- Each D64 loadable unit records the exact memory `loadDestination` interval as `residence`, with
  `loadUnitIndex`; the boot unit has no residence and no synthetic bank is emitted for `cpu16`.
- Helper-owned temporaries now reconcile with their memory helper owner instead of failing
  publication.
- The zero-cost differential test builds the same code with different trailing comments: `.prg`,
  `.labels`, `.memory.json`, `.costs.json`, and the instruction stream are byte-identical while
  `.debug.json` differs.
- The adapter probe records the exact environment and the mapping table; no maintained adapter was
  installed, so the adapter dimension is `unsupported (not installed)`.

## Independent security review and fixes

The security review found two major isolation issues and five hardening gaps. All were fixed
before closeout.

| Finding | Fix |
| ------- | --- |
| SA-001 Rename could edit installed-library sources | Installed sources are marked in the tooling index and excluded from the rename source set; the server also rejects any edit URI outside the project root. |
| SA-002 Parent project could adopt a nested project's open document | Publication skips any document already mapped to a different project root. |
| SA-003 Superseded analysis could commit its context | Each generation now carries its own abort controller; context and status commit only after the generation and signal checks. |
| SA-004 Diagnostics matched by raw path suffix | The VS Code client matches an exact project-relative path from the project root. |
| SA-005 Hover source path was unescaped Markdown | Inline-code escaping neutralizes backticks, backslashes, and newlines. |
| SA-006 Publication record reads were unbounded | `current.json` and `.build.json` reads are capped at 1 MiB before parsing. |
| SA-007 Rename could be captured by a nested binding | Every occurrence is rechecked for a visible binding with the new spelling; capture rejects the rename. |

No critical security finding remained open.

## Independent correctness review and fixes

The correctness review confirmed the security findings and added these fixes.

| Finding | Fix |
| ------- | --- |
| RV-003 Empty nested block lost one indentation level | Fixed the `{}` path; formatter regression test added. |
| RV-004 `for (let i = ...)` had no local symbol | The for-initializer is now indexed as a local; hover/definition/references/tokens work. |
| RV-005 Status notification was not consumed | The extension now parses `blend65/projectStatus` and renders truthful status-bar states. |
| RV-006 Save-or-abort saved unrelated dirty files | Only `.blend` sources and declared asset paths are saved; unrelated dirty files are ignored. |
| RV-007 Internal-error envelope exit status disagreed with process status | Envelope and process status both report 1. |
| RV-008 `const` locals lost readonly/value facts | Locals with constant storage are indexed as constants with readonly and proved value. |
| RV-009 Struct-literal field labels could resolve to a value token | Typed fields now carry exact `nameSpan`; labels resolve to the field. |
| RV-010 `prepareRename` self-probe rejected safe shadowed renames; fields were not renameable | Prepare uses eligibility, not a same-name edit probe; user-owned fields and enum members are renameable with collision checks. |
| RV-011 Module completion offered enum members | Module-member completion now excludes symbols with a parent. |
| RV-012 Help omitted `evidence` and `--json` | Usage now lists both. |
| RV-015 Residence validation ignored the load unit | Residence intervals must belong to the named unit's memory load-state destinations. |

`RV-013` (zero-cost experiment form) and `RV-014` (planned spec-file names) are recorded in the
honest boundary and the testing-strategy reconciliation; no oracle was replaced with a weaker one.

## Honest boundary

- **Adapter probe:** no maintained VICE debugger adapter was installed. The report is a truthful
  `unsupported` probe result, not a working source-debugging integration claim. No DAP is shipped.
- **Zero-cost proof:** the differential proof compares target artifacts when host debug observation
  differs. It does not add a public switch that disables debug validation; debug evidence is
  post-ACME and never an input to target generation.
- **VS Code host:** the packaged extension bundle, manifest, fake host, and real CLI child are
  tested. A real VS Code extension-host activation and a VSIX release remain RD-10-owned.
- **Native hosts:** Windows/macOS discovery and the packaged user workflow remain RD-10-owned.
- **Physical hardware:** no physical C64 is available. RD-10 runs every runtime test through VICE
  3.10 `x64sc` and keeps physical-only claims `VICE-verified / hardware-unverified`.
- **VICE:** the unchanged loader/runtime path remains the RD-07 4/4 `VICE-verified /
  hardware-unverified` evidence. A fresh RD-09 attempt passed 2/4; the other two hit the known
  bounded monitor-startup timeout under concurrent compiler load. RD-09 adds no new emulator
  behavior.
- **`split` availability:** no producer currently yields a genuine multi-piece value. The schema
  remains ready; no synthetic split record is emitted.
- **Helper scratch:** helper-owned storage is represented by `temporary` symbols with exact helper
  memory owners; no unused `helperScratch` kind is manufactured.

## Deferral-expiry scan

| Source | Item | Result |
| ------ | ---- | ------ |
| RD-09 Won't Have | Owned DAP, debugger UI, breakpoints, disassembler | Still out; probe only |
| RD-09 Won't Have | Asset/game editors, engine tooling | Still out |
| RD-09 Won't Have | Package manager, plugin marketplace, remote/telemetry | Still out |
| RD-09 Won't Have | Configurable formatter, range mode, refactoring engine | Still out |
| RD-09 Won't Have | Automatic build/run, no-build rerun | Still out |
| RD-09 Won't Have | Incremental compiler, daemon, cache | Still out; no measured need |
| RD-09 Won't Have | Editor-side backend | Still out; boundary tests pass |
| RD-09 Won't Have | Other platforms/editors | Still out; RD-10 owns hosts |
| RD-09 R9.42 | Adapter integration decision | Probe recorded; no integration promised |
| Expressiveness ledger | No new source restriction introduced | Nothing due |
| `spec/future-considerations.md` | No row expired by RD-09 | Nothing due |

No RD-09 deliverable expired a deferral's stated rationale. RD-10 remains the owner of native
user-host and VSIX qualification. Physical-hardware and real-drive qualification cannot run in the
current environment, so RD-10 records them as `Unknown` and keeps the release claim
`VICE-verified / hardware-unverified`.

## Roadmap

RD-09 is complete at 100/100 plan tasks. The next v4 feature is RD-10.
