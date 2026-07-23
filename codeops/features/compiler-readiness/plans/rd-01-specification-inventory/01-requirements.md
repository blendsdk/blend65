# Requirements: RD-01 Specification Inventory

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-01](../../requirements/RD-01-specification-inventory.md) — the owning requirements document

## Scope of this plan (delta view)

### In this plan

- RD-01 Must Haves: implement the closed v1 model, strict intake, source manifest, byte-exact
  fragmentation, exhaustive ledger, complete C64 rule denominator, handler/capability declarations,
  conflict and graph validation, generated projection and evolution boundary.
- RD-01 AC-1–AC-18: every acceptance criterion is represented by concrete ST cases in
  `07-testing-strategy.md`.
- Complete population is required; tooling without the validated denominator does not close the RD
  (AR-P1).

### Deferred / out of this plan

- Executable generators, transforms and oracles remain RD-02/RD-03.
- Tier-route implementations and campaign execution remain RD-04.
- Failure shrinking, release-gate aggregation and cross-version operational policy remain
  RD-05–RD-07.
- No file beneath `spec/` changes.
- No C64 readiness percentage or release claim is produced.

## Plan-local decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| Package boundary | Private `@blend65/readiness` | AR-P2 |
| Authority layout | Root `readiness/` data separated from generated projection | AR-P3 |
| Strict duplicate-preserving intake | `jsonc-parser` tree, then Ajv v8 | AR-P4, AR-P5 |
| Fragmentation mechanism | Versioned byte-oriented scanner | AR-P6 |
| Validation behavior | Prerequisite-gated accumulation and deterministic sort | AR-P7 |
| Identity | Stable assigned rules, hashed fragments, explicit lineage | AR-P8 |
| Pre-binding contracts | Generated bounded declaration unions with explicit unbound state; branded runtime rule IDs | AR-P9 |
| v1 evolution | Dispatch and atomic migration interface, no speculative v2 | AR-P10 |
| Security policy | Fixed v1 resource caps and canonical root containment | AR-P11 |
| Delivery order | Five specification-first phases | AR-P12 |

## Acceptance Criteria

The RD owns behavioral acceptance. This plan adds two process criteria:

1. [ ] Every phase closes with the full AGENTS.md verify command and Prettier checks for touched
   files (AR-P12).
2. [ ] `git status --porcelain spec/` remains empty through every phase.
