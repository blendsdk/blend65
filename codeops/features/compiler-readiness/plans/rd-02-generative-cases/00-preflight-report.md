# Preflight Report: RD-02 Typed Generative Cases and Deterministic Replay Plan

> **Status**: ✅ PASSED — all 12 findings resolved
> **Iteration**: 2 (verification after target-local remediation)
> **Artifact**: `plans/rd-02-generative-cases/`
> **Artifact Revision**: `sha256:037044cf63c6b27ad9002906784dea553937df1e70c89df0017139a70afd966f`
> **Audit Target**: `compiler-readiness/RD-02 plan`
> **Last Updated**: 2026-07-24
> **Mode**: Auto-design
> **Same-session Bias**: Disclosed — the plan author and preflight dispatcher were the same root
> **Hardening**: Five clustered scans, three independent auditors and one independent challenger

## Scope

- **Target:** the complete RD-02 plan directory; requirements and code were grounding context.
- **Domain lenses:** compiler/language semantics, data/migration, concurrency/durability and
  security/input safety.
- **Authorized changes:** plan-local corrections plus roadmap, traceability and this report.
- **Out of scope:** implementation, changes under `spec/`, broad inventory regeneration and RD-03+.

## Summary

| # | Finding | Severity | Resolution |
|---|---|---|---|
| PF-001 | Phase 1 required Phase 5/6 behavior to be green | 🟠 Major | Resolved |
| PF-002 | Initial modeled denominator and semantic review were non-exact | 🟠 Major | Resolved |
| PF-003 | Handler revision was not tied to implementation bytes | 🟠 Major | Resolved |
| PF-004 | Replay omitted reconstructible configuration content | 🟠 Major | Resolved |
| PF-005 | Independent semantic review occurred too late for publication | 🟠 Major | Resolved |
| PF-006 | Loose-file CLI behavior had no source/published migration | 🟠 Major | Resolved |
| PF-007 | Atomic publication was one-shot rather than reusable | 🟠 Major | Resolved |
| PF-008 | Release bytes were not crash-durable before pointer commit | 🟠 Major | Resolved |
| PF-009 | Publication digest and collision behavior were undefined | 🟠 Major | Resolved |
| PF-010 | Raw values could bypass the published authority boundary | 🟠 Major | Resolved |
| PF-011 | Publication inputs lacked pre-read resource limits | 🟠 Major | Resolved |
| PF-012 | Renderer inverse independence was only asserted in prose | 🟠 Major | Resolved |

All 13 dimensions were scanned in five clusters. Iteration 2 found no surviving critical, major,
minor or observation finding.

## Resolutions

### PF-001 — phase ownership

Phase 1 now proves only the exhaustive skeleton and binding contracts. Phase 5 owns the exact
modeled population; Phase 6 owns composition and fresh-process replay. A phase cannot claim RED or
GREEN using behavior implemented by a later phase.

### PF-002 — semantic denominator and review

The first coverage denominator is exactly five scalar-domain and four memory-signature inventory
rules. Canonical records carry typed domains, construction preconditions, invalid contracts,
boundaries and spellings. Exact set/matrix equality and digest-bound independent semantic review
replace the prior non-zero-total oracle.

### PF-003 — implementation identity

Handler revisions are derived from a domain-separated canonical preimage containing the entry
module and complete transitive production dependency bytes. Freshness and unequal-preimage
collision checks run before candidate validation, replay and publication.

### PF-004 — replay reconstruction

Replay records carry bounded normalized configuration content and verify it against the campaign
digest. Missing, mismatched or ambient-only configuration is explicitly incompatible.

### PF-005 — review before publication

The publisher stages semantic digests, pauses for independent accepted review evidence, validates
the complete release and runs all specification and implementation tests through an isolated
resolver before selecting the real pointer.

### PF-006 and PF-007 — migration and durable operation

`readiness:generate` and `readiness:source-check` are non-authoritative authoring commands;
`readiness:check` validates the selected release. A guarded handler-agnostic
`readiness:publish` entry point becomes the reusable route for RD-02 and later handler promotions.

### PF-008 and PF-009 — durability and publication identity

Members, staging directory and releases parent are synchronized before pointer publication; the
pointer and publication root are then synchronized in order. Unsupported durability is a typed
failure. A closed publication-digest preimage binds manifest and member bytes; byte-identical
reuse is idempotent and unequal-preimage collisions fail without changing the pointer.

### PF-010 and PF-011 — authority and hostile inputs

The resolver returns an opaque `PublishedSnapshot` required by every published claim or lookup.
Raw/candidate APIs remain explicitly non-authoritative. Regular-file checks and fixed pointer,
manifest, binding, member-count, per-member and total-release caps apply before reads or hashes.

### PF-012 — independent inverse

A static module-graph gate forbids renderer behavior from entering the inverse. Independently
authored frozen vectors cover every emitted token, spelling, normalization rule, precedence level
and associativity class in addition to renderer mutation tests.

## Recommendation Hardening

- **Recommendation:** amend the plan in place and retain RD-02's generation-plus-publication scope.
- **Strongest counterargument:** the safe authority mechanism adds substantial work before the
  first campaign runs.
- **Rejected split:** a separate publication RD would create drift between candidate bindings and
  the later publication contract without reducing the required work.
- **Overreach excluded:** no cryptographic signatures, generic release manager, retention service,
  garbage collector or separate inverse package.
- **Confidence:** High.
- **Reopen triggers:** a modeled rule falls outside the exact reviewed seed; behavior changes
  without revision churn; replay consults ambient state; raw values can make a published claim; or
  pointer selection precedes accepted review and staging-green proof.

## Verdict

✅ **PREFLIGHT PASSED — all 12 findings resolved.**
