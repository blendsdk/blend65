# Requirements: RD-02 Typed Generative Cases and Deterministic Replay

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-02](../../requirements/RD-02-generative-cases.md) — the owning requirements doc

## Scope of this plan

### In this plan

- RD-02 independent generator IR and `@blend65/*` import prohibition.
- RD-02 exhaustive rule-model classification with a non-empty scalar/memory initial subset.
- RD-02 generator and boundary-transform binding contracts.
- RD-02 stable campaign/case identities, path-local deterministic generation and replay.
- RD-02 bounded rendering and independent structural round trip.
- RD-02 pre-compilation resource limits and hostile-input rejection.
- RD-02 atomic authority/binding publication and final reviewed binding transition.

### Deferred / out of this plan

- Semantic reference evaluator, diagnostic oracle and metamorphic transforms — RD-03.
- Compiler, CLI, ACME and VICE execution routes — RD-04.
- Failure shrinking and regression promotion — RD-05.
- Release-level readiness decisions — RD-06.
- Cross-version retention policy beyond exact-current-revision incompatibility — RD-07.
- Aggregates, pointers, loops, switch, interrupts, embed and full-module semantic generation.
- Changes under `spec/`.

## Plan-local decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| First modeled subset | Exact nine-rule scalar-domain and memory-signature seed in 03-01 | AR-P1 |
| Registry split | Canonical JSON facts plus executable TypeScript table | AR-P2 |
| Deterministic selection | SHA-256 counter generation | AR-P4 |
| Publication | Content-addressed snapshot pointer | AR-P10 |

## Plan-local acceptance

- The modeled subset includes ordinary local and parameter address/value operands for memory
  intrinsics even when the current compiler rejects them (AR-P1).
- Canonical model facts and accepted independent review evidence match the exact seed and manifest
  digests; executable IDs alone cannot establish coverage.
- Handler implementation revisions are freshly derived from complete production dependency bytes.
- Replay carries and verifies normalized configuration content, not only its digest.
- No final handler declaration becomes `bound` until every RD-02 specification test passes and the
  staged publication validates as one snapshot (AR-P10, AR-P14).
- Published claims require a resolver-produced opaque snapshot; authoring commands cannot bypass
  the selected release, and future promotions reuse the guarded handler-agnostic publisher.
- All other rules remain explicit and cannot count as generated coverage (AR-P2).
