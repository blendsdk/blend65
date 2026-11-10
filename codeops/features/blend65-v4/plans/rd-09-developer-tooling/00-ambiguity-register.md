# Ambiguity Register: RD-09 Developer Tooling and Debug Evidence

> **Status**: ✅ GATE PASSED — all 20 items resolved
> **Last Updated**: 2026-11-10 22:12

Scope baseline: the complete RD-09 Must Have and Should Have set. The user's go-ahead authorizes
plan-level technical decisions; no user-owned product scope, external action, or irreversible
choice is decided here. Existing RD-03 through RD-08 contracts are consumed unchanged.

| #   | Category | Ambiguity / Gap | Options Presented | Decision | Status |
| --- | -------- | --------------- | ----------------- | -------- | ------ |
| 1 | Scope | Which RD-09 requirements enter this plan? | All Must/Should / a subset | All Must Have and Should Have requirements R9.1–R9.52. No new capability is added. | ✅ Resolved — plan authority, scope already owned by RD-09 |
| 2 | Technical | How does the thin VS Code extension invoke Build/Run without importing compiler backend code? | In-process compiler root / spawn packaged `blendc` / duplicate pipeline | Spawn the packaged `blendc` with an argument array. The extension declares `@blend65/cli` as a runtime dependency, resolves its new `./bin` export, and starts it with `process.execPath`. No shell, no backend import, no second pipeline. | ✅ Resolved — preserves `test/import-boundary.ts` editor rule |
| 3 | Integration | What machine-readable CLI result does the extension consume? | Parse human text / new JSON envelope / private IPC | Add `blendc <check\|build\|run> --json` emitting one canonical JSON object with `kind: "blend65.cli"`, `schemaVersion: 1`, command, outcome, diagnostics, generation/status, and failure category. Exit statuses stay unchanged. | ✅ Resolved — R9.4 requires stable machine-readable categories |
| 4 | Technical | Where do hover/definition/references/rename facts come from? | Extend `TypedProgram` inline / new frontend tooling index / duplicate editor analysis | Add `packages/compiler/src/frontend/tooling.ts`, a frontend-only index built from `AnalysisResult`, exported through `@blend65/compiler/frontend`. Stable binding identities and typed spans are reused; no backend import. | ✅ Resolved — smallest shared-query surface |
| 5 | Data & state | Where is an open document's version tracked? | Extend `SourceOverlay` / server-owned map | The language server tracks URI → version and overlay text. `SourceOverlay` remains `{ sourceId, text }`; the compiler does not gain editor state. | ✅ Resolved — one owner for protocol state |
| 6 | UX | What formatter policy is canonical? | Configurable style / token-stream canonical / AST pretty-printer | One token-stream formatter: four-space indent, LF, no options or range mode. It preserves comments, literals, and non-trivia token order, and rejects syntax-invalid input with no edits. | ✅ Resolved — R9.23 forbids style options |
| 7 | Behavioral | Which code actions may be advertised? | Broad refactors / only proved edits / none | One action family only: add a missing import for `E10239` when exactly one exported declaration in the project can satisfy the name. Every other diagnostic returns no action. | ✅ Resolved — R9.22 forbids speculative edits |
| 8 | Data & state | Which semantic-token legend? | Custom rich legend / standard LSP legend | Standard LSP token types and modifiers only, with a fixed legend. Invalid regions use lexical fallback or no semantic modifier. | ✅ Resolved — avoids client-specific configuration |
| 9 | Integration | How are banked/loadable identities represented in `.debug.json`? | New schema fields / populate existing contract fields / omit | Populate existing contract fields only. D64 load units receive `residence` records from the memory load states. Bank records are emitted only when a selected profile produces banks; no synthetic bank is invented. | ✅ Resolved — RD-03 version-1 contract is frozen |
| 10 | Technical | How is zero target debug cost observed? | Public build option / internal test observer / no proof | An internal-only build path accepts a test observer flag that skips debug-evidence derivation; the public API always emits evidence. The test compares assembly, PRG/D64, labels, maps, totals, and VICE behavior. | ✅ Resolved — AC-30 permits a test observer |
| 11 | Integration | What is the VICE debugger-adapter probe? | Build a DAP / probe an existing adapter / skip | A bounded checked-in report probes the adapters actually available in the environment against VICE 3.10 and debug schema 1. If no maintained adapter is installed, the report records `unsupported` with exact versions, commands, and the mapping table; no DAP is built. | ✅ Resolved — AR-010 and R9.42 |
| 12 | Integration | How are ACME/VICE discovered for CLI and extension? | New setting / reuse `tools.jsonc` / project config | Reuse the existing machine-local `tools.jsonc` schema 1 and ordered `PATH` discovery. `blendc` is packaged, not discovered through `tools.jsonc`. | ✅ Resolved — R9.5 and AR-048 |
| 13 | Security | How may artifact-open commands access build evidence? | Free path from `.build.json` / validated generation only / shell open | Read `.build.json` from one generation, validate the hash and containment, then use `showTextDocument` for text evidence. `revealFileInOS` is workspace-trust-gated. Never execute the artifact. | ✅ Resolved — R9.28 and R9.32 |
| 14 | Behavioral | Push or pull diagnostics? | Push / pull / both | Push `textDocument/publishDiagnostics`, as today. Pull diagnostics are not added in this plan. | ✅ Resolved — smaller protocol surface |
| 15 | Security | What bounds `embed()` path completion? | Whole workspace scan / declaring directory and asset roots / no completion | Only the declaring source directory and contained asset roots from the effective manifest; canonical containment, regular-file checks, no symlink escape, and a 200-item bound. | ✅ Resolved — R9.15 |
| 16 | Behavioral | Which declarations may be renamed? | All bindings / user-owned source bindings only | Rename user-owned module, function, type, struct, enum, field, local, parameter, and constant declarations. Reject platform/installed-library, asset-selector, generated, poisoned, colliding, or cross-project targets. | ✅ Resolved — R9.19 |
| 17 | Non-functional | What workspace-symbol bound applies? | Unbounded / 100 / 1000 | 100 deterministic results per request; the response carries no truncation flag because LSP has no standard one, and the bound is documented in the server README. | ✅ Resolved — R9.20 requires a documented bound |
| 18 | UX | Which line ending does the formatter emit? | Preserve per document / always LF / configurable | Always LF. The formatter is canonical and has no option surface; VS Code and Git handle host line endings. | ✅ Resolved — R9.23 |
| 19 | Behavioral | What does formatting return for invalid input? | Guessed full edit / null / error | Return `null` (no edits). No structural guess is emitted. | ✅ Resolved — R9.23 permits rejection |
| 20 | Integration | How is `blendc` located for the extension? | PATH lookup / VS Code setting / packaged export | The extension resolves the `@blend65/cli` package's new `./bin` export and starts it with `process.execPath`. A missing package is an actionable command failure; there is no PATH or setting fallback. | ✅ Resolved — self-contained extension packaging |

## Resolution Notes

**AR-2:** The extension never imports `@blend65/compiler`. It owns editor integration only and
delegates build/run to the CLI adapter, which already owns publication, tool discovery, ACME, and
VICE. The CLI JSON envelope is the typed boundary.

**AR-4:** The tooling index is a derived read-only view over the existing `AnalysisResult`. It
does not add a parser, type system, module graph, or project model. It is the shared frontend query
surface required by R9.1 and used only by the language server.

**AR-7:** `E10239` identifies an undeclared name. The action searches the project's exported
declarations for an exact name match. If zero or more than one candidate exists, no action is
returned. The edit inserts one import declaration at the top of the importing source and is
revalidated against the document version before return.

**AR-9:** RD-03's debug contract already admits `bankIndex`, `loadUnitIndex`, `residence`, and
`BankRecord`. The producer currently emits only `cpu16` and empty residence. RD-07's memory
evidence already records load states; this plan wires those facts into the debug sidecar without
changing the schema.

**AR-11:** A probe is not a product integration. The report is a checked-in markdown document plus
a reproducible command record. No debug adapter is bundled, started by the extension, or promised.

**AR-18:** LF is not semantic content. The formatter's token/literal/comment preservation test
compares decoded values, not raw line endings.
