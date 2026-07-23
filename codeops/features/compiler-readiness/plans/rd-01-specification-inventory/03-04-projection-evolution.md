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
4. renders bounded TypeScript declaration contracts in memory;
5. byte-compares both outputs with their committed projections;
6. verifies unit/dependency-digest and complete-inventory aggregate semantic-review evidence;
7. emits ordered diagnostics and exits nonzero on any error or freshness mismatch.

`readiness:generate` acquires one exclusive generation lock before re-reading authoritative inputs,
performs the same validation, then atomically replaces only
`packages/readiness/src/generated/declarations.ts` and
`readiness/generated/compiler-readiness.md`. It renders all outputs before writing and never
rewrites authoritative JSON, schemas, conformance vectors, review evidence or `spec/` (AR-P3,
AR-P7). The lock is an atomically created directory containing PID and random owner-token metadata.
A live competing owner produces an actionable contention diagnostic. A dead owner's directory is
reclaimed through an atomic quarantine rename; PID reuse conservatively causes false contention
rather than unsafe reclamation. Retry begins by re-acquiring the lock and re-reading current
inputs, and only the matching owner token may release or clean its lock.

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

Atomic writes create an invocation-owned, exclusive, uniquely named same-directory temporary file,
flush/close it, then rename over the target while the generation lock is held. Failure removes only
that invocation's temporary path and leaves source evidence unchanged. Both outputs embed the same
generation digest, and the command verifies the pair before releasing the lock or reporting
success. A crash can leave complete but mismatched projections; their digests make that state
deterministically detectable, dead-owner reclamation releases the abandoned lock and the next
generation safely repairs the pair after re-reading authority. Two-writer and subprocess-crash
tests prove that concurrent generation cannot report success with a mixed pair or remove another
invocation's temporary file. Paths are canonicalized and fixed by the caller; inventory content
never selects output paths (AR-P11).

## Inventory population and closeout

Population proceeds in bounded units after mechanisms are green: one unit for each chapter 00–15,
one for normative grammar, one for C64 target projections and one for
contextual/other-target/conflict/feature-index reconciliation. Every unit runs fragment, ledger,
identity and in-memory declaration-render determinism checks, then receives independent
compiler/language review keyed to its canonical unit and dependency digests. The aggregate review
is keyed separately to the complete inventory revision and must validate stable rule IDs, complete
evidence obligations, canonical cross-chapter ownership, target projections and no ordinary rule
hiding an unresolved contradiction (AR-P1, AR-P8).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Generated declaration or Markdown projection stale | Check-mode diagnostic; never writes tracked or authority artifacts | AR-P3, AR-P7 |
| Unsafe Markdown/link value | Escaped text or rejected link diagnostic | AR-P11 |
| Unknown version | Exact unsupported-version diagnostic, no output | AR-P10 |
| Missing/stale evolution gate | Reject before temp-file creation | AR-P10 |
| Migration or write failure | Ordered failure plus unchanged source/destination | AR-P10 |
| Invalid inventory during generation | No generated file modification | AR-P7 |

## Testing Requirements

- Exact declaration/Markdown projection completeness and two-render determinism.
- Markdown table, raw HTML and unsafe-link attacks.
- Check-mode freshness without changes to tracked, authoritative, conformance, review-evidence or
  generated artifacts.
- Unknown-version, missing/stale/current-gate fixtures.
- Deterministic test migration, injected write failure, live-owner contention, dead-owner lock
  reclamation and cross-output generation-digest consistency.
- A subprocess crash after the first target rename proves no success is reported, check mode names
  the mixed digest, a new generator safely reclaims the dead owner's lock and both outputs are
  repaired to one current digest.
- Final real-inventory validation, feature-index reconciliation and `spec/` freeze check.
