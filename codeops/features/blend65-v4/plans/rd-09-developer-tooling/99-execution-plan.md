# Execution Plan: RD-09 Developer Tooling and Debug Evidence

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-10 22:12
> **Progress**: 0/100 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement RD-09 in eight phases. Each feature phase follows the specification-first order: spec
tests → red evidence → implementation → green → implementation tests → verify. Phase 8 is the
bounded qualification and closeout phase. The tooling boundary is proved with real stdio and a real
CLI child; no compiler backend enters the editor.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Frontend tooling index | 16 |
| 2 | Language server core | 15 |
| 3 | Language server queries | 11 |
| 4 | Canonical formatter | 8 |
| 5 | CLI JSON and evidence | 11 |
| 6 | VS Code thin client | 14 |
| 7 | Debug evidence completion | 13 |
| 8 | Qualification, docs, and closeout | 12 |

**Total: 100 tasks across 8 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line
> appears exactly once. On implementation mark `[~]` with a timestamp; on verify pass promote to
> `[x]`. Update the Progress header and Last Updated after every task. Resume at the first `[~]`,
> else the first `[ ]`. On blocker mark `[!]` and name the reason.

---

## Phase 1: Frontend Tooling Index

> **Reasoning**: high — new shared semantic query surface used by every editor operation.
> **Lenses**: correctness, security, maintainability.
> **Reference**: [03-01](03-01-frontend-tooling-index.md) · ST-1–ST-13 · AR-4, AR-15–AR-17

### Step 1.1: Specification Tests

- [ ] 1.1.1 [spec-author] Write tooling-index specification tests from ST-1–ST-5 — `test/rd09/tooling-index.spec.test.ts`
- [ ] 1.1.2 [spec-author] Write query specification tests for completion, hover, signature, definition, references, rename, symbols, tokens, and code actions from ST-6–ST-13 — `test/rd09/tooling-queries.spec.test.ts`
- [ ] 1.1.3 Run the new specification tests and record the RED evidence (missing module/functions) — `test/rd09/`

### Step 1.2: Index and Symbols

- [ ] 1.2.1 Create tooling types and `buildToolingIndex` derivation — `packages/compiler/src/frontend/tooling.ts`
- [ ] 1.2.2 Derive declaration, local, parameter, module, field, and import symbols with stable scopes — `packages/compiler/src/frontend/tooling.ts`
- [ ] 1.2.3 Derive reference occurrences from typed expressions, statements, initializers, and imports — `packages/compiler/src/frontend/tooling.ts`
- [ ] 1.2.4 Implement `symbolAt`, `referencesFor`, and `visibleSymbols` with shadowing order — `packages/compiler/src/frontend/tooling.ts`
- [ ] 1.2.5 Export the tooling surface from the frontend subpath — `packages/compiler/src/frontend/index.ts`

### Step 1.3: Queries

- [ ] 1.3.1 Implement `completionAt` with ordinary, member, `embed()`, call-argument, type, and placement contexts — `packages/compiler/src/frontend/tooling.ts`
- [ ] 1.3.2 Implement `hoverAt` and `signatureAt` with type/constant/effect/asset/placement facts — `packages/compiler/src/frontend/tooling.ts`
- [ ] 1.3.3 Implement `documentSymbols` and `workspaceSymbols` with source order and the 100-result bound — `packages/compiler/src/frontend/tooling.ts`
- [ ] 1.3.4 Implement `renameEdits` with containment, poison, collision, alias, and platform rejection — `packages/compiler/src/frontend/tooling.ts`
- [ ] 1.3.5 Implement `semanticTokenFacts` with lexical fallback and `codeActionsAt` with the unique `E10239` rule — `packages/compiler/src/frontend/tooling.ts`

### Step 1.4: Implementation Tests and Verify

- [ ] 1.4.1 Write implementation tests for ordering, occurrence containment, field identity, and rename collisions — `packages/compiler/src/frontend/tooling.impl.test.ts`
- [ ] 1.4.2 Run the tooling specification and implementation tests green; confirm the boundary test still rejects backend imports — `test/rd09/`, `test/rd03-import-boundary.spec.test.ts`
- [ ] 1.4.3 Run the compiler package suite and typecheck — `yarn workspace @blend65/compiler test`, `yarn typecheck`

**Deliverables**: tooling index, all queries, spec/impl tests, green compiler package.

**Verify**: `yarn workspace @blend65/compiler test` and `yarn typecheck`.

---

## Phase 2: Language Server Core

> **Reasoning**: high — protocol state, versions, cancellation, and project isolation.
> **Lenses**: correctness, security, concurrency.
> **Reference**: [03-02](03-02-language-server.md) · ST-14–ST-26 · AR-5, AR-14

### Step 2.1: Specification Tests

- [ ] 2.1.1 [spec-author] Write diagnostics parity and protocol robustness tests from ST-14, ST-18–ST-20, ST-25, ST-26 — `test/rd09/lsp-diagnostics.spec.test.ts`
- [ ] 2.1.2 [spec-author] Write snapshot, version, stale, cancellation, isolation, and status tests from ST-15–ST-17, ST-21–ST-24 — `test/rd09/lsp-snapshots.spec.test.ts`
- [ ] 2.1.3 Run the new specification tests and record RED evidence — `test/rd09/`

### Step 2.2: Document and Project State

- [ ] 2.2.1 Add reverse `positionToByteOffset` with UTF-16/UTF-8, CRLF, tabs, astral, empty, and EOF handling — `packages/compiler/src/frontend/positions.ts`
- [ ] 2.2.2 Extract the document store with URI identity, newest-version rule, overlay construction, and close restore — `packages/language-server/src/documents.ts`
- [ ] 2.2.3 Extract project contexts with nearest-manifest mapping, snapshot load, analysis scheduling, and bounded release — `packages/language-server/src/projects.ts`
- [ ] 2.2.4 Send bounded `blend65/projectStatus` notifications for every state transition — `packages/language-server/src/projects.ts`
- [ ] 2.2.5 Extract diagnostic normalization/publication while preserving existing behavior — `packages/language-server/src/diagnostics.ts`

### Step 2.3: Protocol Surface

- [ ] 2.3.1 Replace the minimal initialize response with the exact implemented capability object — `packages/language-server/src/protocol.ts`
- [ ] 2.3.2 Wire document, project, diagnostic, cancellation, workspace-folder, and watched-file handlers — `packages/language-server/src/server.ts`
- [ ] 2.3.3 Add request cancellation-token adaptation and bounded result limits — `packages/language-server/src/security.ts`
- [ ] 2.3.4 Add workspace-folder and watched-file refresh handling with affected-context invalidation — `packages/language-server/src/projects.ts`

### Step 2.4: Implementation Tests and Verify

- [ ] 2.4.1 Write implementation tests for version regression, stale suppression, cancellation cleanup, and bounded release — `packages/language-server/src/server.impl.test.ts`
- [ ] 2.4.2 Run the existing language-server suite and the new root protocol suites green — `packages/language-server/src/`, `test/rd09/`
- [ ] 2.4.3 Run language-server build, typecheck, and tests — `yarn workspace @blend65/language-server test`, `yarn typecheck`

**Deliverables**: split server modules, versioned state, project isolation, cancellation, status,
capability object, green diagnostics/protocol suites.

**Verify**: `yarn workspace @blend65/language-server test` and `yarn typecheck`.

---

## Phase 3: Language Server Queries

> **Reasoning**: high — every editor operation must preserve shared semantics and stale rejection.
> **Lenses**: correctness, UX, security.
> **Reference**: [03-02](03-02-language-server.md) · ST-6–ST-13, ST-22 · AR-4, AR-6–AR-8, AR-15–AR-17

### Step 3.1: Specification Tests

- [ ] 3.1.1 [spec-author] Write real-transport query tests for completion, hover, signature help, definition, and references — `test/rd09/lsp-queries.spec.test.ts`
- [ ] 3.1.2 [spec-author] Write real-transport tests for rename, symbols, semantic tokens, code actions, and formatting — `test/rd09/lsp-queries.spec.test.ts`
- [ ] 3.1.3 Run the new query tests and record RED evidence — `test/rd09/`

### Step 3.2: Query Handlers

- [ ] 3.2.1 Implement completion and bounded `embed()` path completion handlers — `packages/language-server/src/queries/completion.ts`
- [ ] 3.2.2 Implement hover and signature-help handlers — `packages/language-server/src/queries/hover.ts`
- [ ] 3.2.3 Implement definition, references, prepare-rename, and rename handlers with version revalidation — `packages/language-server/src/queries/navigation.ts`
- [ ] 3.2.4 Implement document/workspace symbols and semantic-token handlers — `packages/language-server/src/queries/symbols.ts`
- [ ] 3.2.5 Implement the unique `E10239` code action and the canonical formatter handler — `packages/language-server/src/queries/actions.ts`

### Step 3.3: Implementation Tests and Verify

- [ ] 3.3.1 Write implementation tests for query cancellation, malformed requests, and bounded results — `packages/language-server/src/queries/queries.impl.test.ts`
- [ ] 3.3.2 Run the query, diagnostics, snapshot, and existing server suites green — `packages/language-server/src/`, `test/rd09/`
- [ ] 3.3.3 Run the compiler tooling suite and the language-server build — `yarn workspace @blend65/compiler test`, `yarn workspace @blend65/language-server build`

**Deliverables**: all advertised query handlers, real-transport tests, green server.

**Verify**: `yarn workspace @blend65/language-server test` and `yarn typecheck`.

---

## Phase 4: Canonical Formatter

> **Reasoning**: high — token preservation and idempotence are correctness properties.
> **Lenses**: correctness, maintainability.
> **Reference**: [03-03](03-03-formatter.md) · ST-27–ST-30 · AR-6, AR-18, AR-19

### Step 4.1: Specification Tests

- [ ] 4.1.1 [spec-author] Write canonical-output, token-preservation, idempotence, line-ending, and invalid-input tests from ST-27–ST-30 — `test/rd09/formatter.spec.test.ts`
- [ ] 4.1.2 Run the formatter specification tests and record RED evidence — `test/rd09/`

### Step 4.2: Implementation

- [ ] 4.2.1 Implement the trivia-preserving scanner and `FormatResult` refusal states — `packages/compiler/src/frontend/formatter.ts`
- [ ] 4.2.2 Implement the canonical emitter with indentation, spacing, comments, blank-line, and final-newline rules — `packages/compiler/src/frontend/formatter.ts`
- [ ] 4.2.3 Export the formatter from the frontend subpath — `packages/compiler/src/frontend/index.ts`

### Step 4.3: Implementation Tests and Verify

- [ ] 4.3.1 Write implementation tests for unary/binary spacing, comment placement, empty blocks, switch labels, and scanner refusal — `packages/compiler/src/frontend/formatter.impl.test.ts`
- [ ] 4.3.2 Run formatter, tooling, and language-server formatting tests green — `test/rd09/`, `packages/language-server/src/`
- [ ] 4.3.3 Run the compiler package suite and typecheck — `yarn workspace @blend65/compiler test`, `yarn typecheck`

**Deliverables**: formatter module, spec/impl tests, LSP formatting handler green.

**Verify**: `yarn workspace @blend65/compiler test` and `yarn typecheck`.

---

## Phase 5: CLI JSON and Evidence

> **Reasoning**: high — public machine-readable contract and validated artifact access.
> **Lenses**: security, correctness, integration.
> **Reference**: [03-05](03-05-cli-json-adapter.md) · ST-31–ST-35 · AR-3, AR-13, AR-20

### Step 5.1: Specification Tests

- [ ] 5.1.1 [spec-author] Write JSON envelope, outcome, exit-status, invalid-argument, and human-output tests from ST-31–ST-33 — `test/rd09/cli-json.spec.test.ts`
- [ ] 5.1.2 [spec-author] Write evidence current/historical/invalid/containment tests from ST-34–ST-35 — `test/rd09/cli-evidence.spec.test.ts`
- [ ] 5.1.3 Run the new CLI tests and record RED evidence — `test/rd09/`

### Step 5.2: Implementation

- [ ] 5.2.1 Add `--json` and the `evidence` command to strict argument parsing — `packages/cli/src/args.ts`
- [ ] 5.2.2 Define the version-1 envelope and canonical serializer — `packages/cli/src/render.ts`
- [ ] 5.2.3 Route check/build/run/help/version/invalid-arguments/cancellation through the envelope — `packages/cli/src/run.ts`
- [ ] 5.2.4 Implement the read-only current-generation resolver and artifact validation — `packages/cli/src/evidence.ts`
- [ ] 5.2.5 Wire the evidence dependency and add the `./bin` export — `packages/cli/src/main.ts`, `packages/cli/package.json`

### Step 5.3: Implementation Tests and Verify

- [ ] 5.3.1 Write implementation tests for duplicate `--json`, malformed envelopes, and evidence hashing — `packages/cli/src/json.impl.test.ts`
- [ ] 5.3.2 Run the CLI suite, new root CLI suites, and the existing human-output tests green — `packages/cli/src/`, `test/rd09/`
- [ ] 5.3.3 Run CLI build, typecheck, and tests — `yarn workspace @blend65/cli test`, `yarn typecheck`

**Deliverables**: `--json`, `evidence`, envelope, bin export, green CLI.

**Verify**: `yarn workspace @blend65/cli test` and `yarn typecheck`.

---

## Phase 6: VS Code Thin Client

> **Reasoning**: high — trust, save-or-abort, process cleanup, and artifact containment.
> **Lenses**: security, correctness, UX.
> **Reference**: [03-04](03-04-vscode-client.md) · ST-36–ST-45 · AR-2, AR-13, AR-20

### Step 6.1: Specification Tests

- [ ] 6.1.1 [spec-author] Write manifest, trust, save-or-abort, command routing, and status tests from ST-36–ST-39, ST-44 — `test/rd09/vscode-commands.spec.test.ts`
- [ ] 6.1.2 [spec-author] Write run-pinning, cancellation, CLI-failure, artifact, and bundle tests from ST-40–ST-43, ST-45 — `test/rd09/vscode-commands.spec.test.ts`
- [ ] 6.1.3 Run the new extension tests and record RED evidence — `test/rd09/`

### Step 6.2: Host and Command Logic

- [ ] 6.2.1 Define the narrow `CommandHost` interface and real VS Code adapter — `packages/vscode/src/host.ts`
- [ ] 6.2.2 Implement trust, no-project, save-or-abort, dirty-input selection, and progress — `packages/vscode/src/commands.ts`
- [ ] 6.2.3 Implement the packaged `blendc` resolver, JSON parser, output streaming, and process-group cancellation — `packages/vscode/src/cli-client.ts`
- [ ] 6.2.4 Implement status bar, build diagnostics mapping, and bounded Output summaries — `packages/vscode/src/status.ts`, `packages/vscode/src/diagnostics.ts`

### Step 6.3: Activation and Artifacts

- [ ] 6.3.1 Implement validated evidence opening/reveal with containment and hash checks — `packages/vscode/src/artifacts.ts`
- [ ] 6.3.2 Wire activation, client lifecycle, command registration, watchers, and deactivate — `packages/vscode/src/extension.ts`
- [ ] 6.3.3 Add the exact commands, activation events, menus, and trust capability to the manifest — `packages/vscode/package.json`
- [ ] 6.3.4 Add `@blend65/cli` as a runtime dependency and externalize it in the Vite build — `packages/vscode/package.json`, `packages/vscode/vite.config.ts`

### Step 6.4: Implementation Tests and Verify

- [ ] 6.4.1 Write implementation tests for host wiring, CLI resolution, argument arrays, and process-group cleanup — `packages/vscode/src/extension.impl.test.ts`
- [ ] 6.4.2 Run the extension suites, the new root command suites, and the import-boundary tests green — `packages/vscode/src/`, `test/rd09/`, `test/import-boundary.spec.test.ts`
- [ ] 6.4.3 Run VS Code build, typecheck, and tests — `yarn workspace @blend65/vscode test`, `yarn typecheck`

**Deliverables**: thin client, commands, CLI adapter, status/output/diagnostics, artifact access,
packaged bundle shape, green extension.

**Verify**: `yarn workspace @blend65/vscode test` and `yarn typecheck`.

---

## Phase 7: Debug Evidence Completion

> **Reasoning**: high — location truth and zero target cost.
> **Lenses**: SFA/ABI, platform, machine cost, correctness.
> **Reference**: [03-06](03-06-debug-evidence.md) · ST-46–ST-54 · AR-9, AR-10, AR-11

### Step 7.1: Specification Tests

- [ ] 7.1.1 [spec-author] Write load-residence, helper-scratch, bank/load, and cross-artifact tests from ST-46–ST-52 — `test/rd09/debug-evidence.spec.test.ts`
- [ ] 7.1.2 [spec-author] Write zero-cost and adapter-probe tests/checks from ST-53–ST-54 — `test/rd09/debug-zero-cost.spec.test.ts`
- [ ] 7.1.3 Run the new debug tests and record RED evidence — `test/rd09/`

### Step 7.2: Producer

- [ ] 7.2.1 Populate D64 load-unit residence from memory load destinations with exact intervals and deduplication — `packages/compiler/src/services/evidence.ts`
- [ ] 7.2.2 Emit certified helper-scratch symbols and locations with generated origins and owning contexts — `packages/compiler/src/services/evidence-records.ts`
- [ ] 7.2.3 Emit `split` only for real multi-piece availability and keep existing unavailable reasons — `packages/compiler/src/services/evidence-records.ts`
- [ ] 7.2.4 Add the internal zero-cost build observer without changing the public API — `packages/compiler/src/services/services.ts`

### Step 7.3: Proof and Probe

- [ ] 7.3.1 Write the internal observer comparison for assembly, artifact, labels, maps, totals, and VICE behavior — `packages/compiler/src/services/debug-evidence-zero-cost.impl.test.ts`
- [ ] 7.3.2 Run the cross-artifact mutation suite and fix any producer/validator mismatch — `test/rd09/debug-evidence.spec.test.ts`
- [ ] 7.3.3 Check the environment for maintained VICE debugger adapters and record the exact probe commands and results — `docs/rd09-debug-adapter-probe.md`

### Step 7.4: Implementation Tests and Verify

- [ ] 7.4.1 Write implementation tests for residence ordering, helper identity, and observer isolation — `packages/compiler/src/services/debug-evidence.impl.test.ts`
- [ ] 7.4.2 Run RD-06/RD-07 debug evidence suites, the new debug suites, and the compiler package — `test/rd06/`, `test/rd07/`, `test/rd09/`, `yarn workspace @blend65/compiler test`
- [ ] 7.4.3 Run the compiler build and typecheck — `yarn build`, `yarn typecheck`

**Deliverables**: complete debug evidence, zero-cost proof, adapter probe report, green suites.

**Verify**: `yarn workspace @blend65/compiler test` and `yarn typecheck`.

---

## Phase 8: Qualification, Docs, and Closeout

> **Reasoning**: high — independent qualification of the complete tooling boundary.
> **Lenses**: security, semantics, platform, machine cost.
> **Reference**: [07](07-testing-strategy.md) · ST-55–ST-58 · RD AC-32–AC-37

### Step 8.1: Security and Robustness

- [ ] 8.1.1 [spec-author] Write injection, containment, hostile Markdown, monitor, loopback, and oversized-payload tests from ST-55 — `test/rd09/security.spec.test.ts`
- [ ] 8.1.2 Run the security suite and fix every finding — `test/rd09/security.spec.test.ts`

### Step 8.2: Packaged Boundary

- [ ] 8.2.1 Build the compiler, CLI, language server, and extension; inspect the packaged bundles for forbidden backend/process paths — `packages/*/dist`
- [ ] 8.2.2 Run one small ACME build through the real CLI and extension adapter — `test/rd09/`
- [ ] 8.2.3 Run one sequential opt-in VICE build/run/cleanup case — `test/rd09/`

### Step 8.3: Observations and Documentation

- [ ] 8.3.1 Record diagnostics, queries, check/build/run, ACME, and VICE duration/peak-memory observations with host/project/tool identity — `docs/rd09-responsiveness.md`
- [ ] 8.3.2 Write the user-facing editor and debug-evidence guide — `docs/tooling.md`
- [ ] 8.3.3 Run the deferral-expiry scan and assign an owner to every newly due item — `09-closeout.md`

### Step 8.4: Closeout

- [ ] 8.4.1 Run the complete tooling boundary: editor package suites, root RD-09 suites, import boundary, debug cross-artifact, one ACME, one VICE — `yarn test`
- [ ] 8.4.2 Run independent reviews (SFA/ABI, platform, machine-code, security, correctness) and fix critical/major findings — `codeops/features/blend65-v4/plans/rd-09-developer-tooling/`
- [ ] 8.4.3 Write the closeout with delivered slice, verification record, deferral scan, and honest boundary — `codeops/features/blend65-v4/plans/rd-09-developer-tooling/09-closeout.md`
- [ ] 8.4.4 Update the feature and portfolio roadmaps to RD-09 Done and RD-10 next — `codeops/features/blend65-v4/00-roadmap.md`, `codeops/00-roadmap.md`

**Deliverables**: security suite, packaged boundary, observations, docs, independent reviews,
closeout, roadmap.

**Verify**: `yarn test`, targeted editor suites, one sequential VICE case.

---

## Dependencies

```text
Phase 1 (tooling index)
    ↓
Phase 2 (server core) → Phase 3 (queries)
    ↓
Phase 4 (formatter) ─┘
    ↓
Phase 5 (CLI JSON) → Phase 6 (VS Code client)
    ↓
Phase 7 (debug evidence)
    ↓
Phase 8 (qualification/closeout)
```

Phases 4 and 5 may run after Phase 3; Phase 7 is independent of Phases 2–6 except for the final
closeout.

## Success Criteria

1. ✅ All phases completed and all 100 tasks `[x]`.
2. ✅ All RD-09 acceptance criteria traced to passing ST cases.
3. ✅ `yarn build`, `yarn typecheck`, and the complete owned test suite pass.
4. ✅ `spec/` untouched.
5. ✅ No backend import in the language server or extension bundle.
6. ✅ Debug evidence cross-artifact and zero-cost proofs pass.
7. ✅ Security suite passes.
8. ✅ Independent reviews complete; critical/major findings fixed or explicitly owned.
9. ✅ Deferral-expiry scan recorded.
10. ✅ Roadmaps updated.
