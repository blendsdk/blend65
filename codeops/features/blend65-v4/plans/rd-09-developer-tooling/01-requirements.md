# Requirements: RD-09 Developer Tooling and Debug Evidence

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-09](../../requirements/RD-09-developer-tooling-and-debug-evidence.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan

- R9.1–R9.6 — typed check/build/run service, one project contract, truthful CLI outcomes,
  deterministic machine-local tool discovery, exact cancellation and publication ownership.
- R9.7–R9.13 — versioned editor snapshots, project isolation, stale-result rejection, coordinate
  conversion, authoritative diagnostics, poison safety, frontend-only editor requests.
- R9.14–R9.24 — completion, bounded `embed()` path completion, hover, signature help, definition,
  references, safe rename, document/workspace symbols, semantic tokens, bounded code actions,
  canonical formatting, bounded protocol failures.
- R9.25–R9.33 — thin VS Code client, truthful status, exact Build/Run commands, trust, save-or-
  abort, authoritative command routing, progress/output, refresh, artifact access, packaging.
- R9.34–R9.42 — portable version-1 debug evidence, source identity, final range mapping, symbols
  and function contexts, SFA location truth, bank/load identity, label coherence, zero target
  cost, bounded adapter interoperability probe.
- R9.43–R9.49 — specification-first tooling tests, structural/behavioral sharing proof, real
  protocol and extension-host verification, independent evidence qualification, impact-based
  verification, observational responsiveness, deferral-expiry closeout.
- R9.50–R9.52 — source-first explanations, correlated evidence, economical activation.

### Deferred / out of this plan

- None. Every RD-09 Must Have and Should Have requirement is in this plan.
- RD-10 owns native Linux/Windows/macOS user-host qualification, the packaged VSIX release,
  physical-hardware QA, and production host claims (RD-09 R9.5/R9.45/R9.47 boundaries).

## Plan-local decisions

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Extension build/run adapter | Spawn packaged `blendc --json`; no backend import | AR-2 |
| CLI machine-readable result | `blend65.cli` schema version 1 | AR-3 |
| Shared editor facts | `frontend/tooling.ts` over `AnalysisResult` | AR-4 |
| Editor document version | Server-owned map, not `SourceOverlay` | AR-5 |
| Formatter policy | Token-stream, four spaces, LF, no options | AR-6, AR-18 |
| Code actions | Empty provider; no proved edit exists | AR-7 |
| Semantic-token legend | Standard LSP types/modifiers | AR-8 |
| Debug bank/load facts | Existing RD-03 fields populated; no schema change | AR-9 |
| Zero-cost observation | Internal test observer only | AR-10 |
| Adapter probe | Bounded report; no owned DAP | AR-11 |
| Tool discovery | Existing `tools.jsonc`/`PATH` rule | AR-12 |
| Artifact access | Validated generation; `showTextDocument`, trust-gated reveal | AR-13 |
| Diagnostics transport | Push only | AR-14 |
| `embed()` completion bound | Declaring directory + contained asset roots, 200 items | AR-15 |
| Rename eligibility | User-owned source declarations only | AR-16 |
| Workspace-symbol bound | 100 deterministic results | AR-17 |

## Acceptance Criteria

The RD owns AC-01 through AC-37. This plan adds no acceptance criterion and narrows none. The
execution plan traces every phase to its governing RD requirements and to the ST cases in
[07-testing-strategy.md](07-testing-strategy.md).
