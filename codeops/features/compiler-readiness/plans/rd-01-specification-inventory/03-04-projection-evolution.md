# Projection and Evolution: RD-01 Specification Inventory

> **Document**: 03-04-projection-evolution.md
> **Parent**: [Index](00-index.md)

## Overview

The CLI exposes a non-mutating trust gate and an explicit generator. A version dispatcher and
failure-atomic migration seam make future formats safe without inventing v2 semantics (AR-P3,
AR-P7, AR-P10, AR-P11).

## Commands

`readiness:check`:

1. loads through the strict version dispatcher;
2. performs all schema/source/semantic validation;
3. renders Markdown in memory;
4. byte-compares it with the committed projection;
5. emits ordered diagnostics and exits nonzero on any error or freshness mismatch.

`readiness:generate` performs the same validation, then atomically replaces only
`readiness/generated/compiler-readiness.md`. It never rewrites authoritative JSON, schemas,
conformance vectors or `spec/` (AR-P3, AR-P7).

## Markdown projection

The renderer includes every rule exactly once with source, applicability, evidence obligations and
relationships. It emits relative repository links only after allowlist validation. Table cells,
HTML-significant characters and link destinations use context-specific escaping; raw HTML and
unsafe schemes never pass through. Stable sorting and LF output make consecutive renders
byte-identical (AR-P11).

## Version dispatch and migration

`readInventory` inspects only enough strict JSON to select an exact supported reader. Unknown
versions fail before schema selection or output.

The v1 migration API defines:

```ts
interface InventoryMigration {
  readonly fromVersion: number;
  readonly toVersion: number;
  migrate(input: Readonly<unknown>): MigrationResult;
}

interface MigrationInvalidation {
  readonly kind: "rule" | "handler" | "capability" | "campaign" | "regression";
  readonly identity: string;
  readonly reasonCode: string;
}
```

No production v2 migration ships. Tests register a deterministic in-memory migration to prove
dispatch, chaining, invalidation ordering and failure atomicity. Before any real upgrade, the
source inventory must contain a current `evolutionGate` naming RD-07, its semantic revision,
acceptance gate and validation time. Missing/stale gates reject before creating a temporary output
(AR-P10).

Atomic writes create a same-directory temporary file, flush/close it, then rename over the target.
Failure removes only the known temporary path and leaves source evidence unchanged. Paths are
canonicalized and fixed by the caller; inventory content never selects output paths (AR-P11).

## Inventory population and closeout

Population proceeds in reviewable source groups after mechanisms are green:

1. chapters 00–03;
2. chapters 04–08;
3. chapters 09–12;
4. chapters 13–15, normative grammar and C64 appendix;
5. contextual/other-target classifications, conflict consolidation and feature-index
   reconciliation.

Each group runs the fragment/ledger validator and leaves no undisposed included span. The aggregate
must then validate with stable rule IDs, complete evidence obligations and no ordinary rule hiding
an unresolved contradiction (AR-P1, AR-P8).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Projection stale | Check-mode diagnostic; never writes | AR-P3, AR-P7 |
| Unsafe Markdown/link value | Escaped text or rejected link diagnostic | AR-P11 |
| Unknown version | Exact unsupported-version diagnostic, no output | AR-P10 |
| Missing/stale evolution gate | Reject before temp-file creation | AR-P10 |
| Migration or write failure | Ordered failure plus unchanged source/destination | AR-P10 |
| Invalid inventory during generation | No generated file modification | AR-P7 |

## Testing Requirements

- Exact projection completeness and two-render determinism.
- Markdown table, raw HTML and unsafe-link attacks.
- Check-mode freshness without mutation.
- Unknown-version, missing/stale/current-gate fixtures.
- Deterministic test migration and injected write failure.
- Final real-inventory validation, feature-index reconciliation and `spec/` freeze check.
