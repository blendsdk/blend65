# Current State: Specification 4.0 and Expert Authority Freeze

> **Parent**: [Index](00-index.md)

## Existing Authorities

| Authority | Current state | RD-01 outcome |
|---|---|---|
| `spec/` | Frozen Specification 3, identity `BLEND65-SPEC-P3-4bf8a989` | Edited in place to the one active Specification 4.0 corpus |
| `.clinerules/language-guard.md` | Version 3/five-target wording | Specification 4 wording for qualified active targets |
| Expert skill | Active 1.0.0/P3; 13 references, five casebooks, 107 case IDs | One approved, qualified 2.0.0/Spec 4 release |
| Compiler and tests | Existing v3 implementation evidence | Audit evidence only; unchanged by RD-01 |

Phase 0 prepared `feature/v4-rebuild` from the exact final v3 source and parked the prior v3
worktree. The requirements register now resolves AR-001–AR-050, including the simplification reset
and exact compile-time trigonometric oracle.

## Material Gaps

1. The active specification still contains the Specification 3 semantics, historical target claims,
   and obsolete workflow files that RD-01 changes or removes.
2. The corpus has no central normative membership record and no Specification 4 digest.
3. Shared grammar, diagnostics, evaluations, and the Guard do not yet reflect the approved language
   and C64-only authority.
4. The live expert remains bound to P3 and contains affected language, target, asset, optimizer, and
   product-boundary knowledge.
5. No RD-01 closeout yet records the transition map, raw hashes, qualification impact, approval,
   freeze, or deferral-expiry result.

## Existing Assets to Reuse

- The current `spec/` chapter, grammar, evaluation, and C64 appendix structure.
- The current expert router, references, source manifest, five casebooks, coverage matrix, and
  release-record shape.
- GNU `find`, `sort`, and `sha256sum` for deterministic inventories and hashes.
- Existing skill packaging validation and casebook evaluation conventions.
- Git history and the parked v3 worktree as the Specification 3 baseline.

## Risks and Controls

| Risk | Control |
|---|---|
| An unchanged P3 behavior disappears | Exact path membership plus one final semantic-diff review |
| Shared grammar or diagnostics disagree | Whole-corpus grammar/diagnostic closure after semantic edits |
| Digest cannot be reproduced | One documented sorted path-and-byte algorithm plus raw hashes |
| Expert evidence is merely relabelled | Byte-level dependency tracing and focused isolated reruns |
| Candidate leaks into live authority | Candidate stays outside `.agents/skills/` until approval |
| Activation partially changes the live skill | Copy exact qualified bytes, verify, and restore prior live tree on failure |
| Planning recreates a framework | Direct checks and existing formats only; no new harness or schema |
