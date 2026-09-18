# Phase 1 Qualification: Source Tokens and Lexical Recovery

> **Date**: 2026-09-18
> **Result**: Qualified; lexer only, not complete frontend or parent RD-03
> **Baseline tree**: 552c5c3d67ee2d3cfdfa1379f9e7690696af9197

## Independent Review

The correctness reviewer examined the complete worktree diff against the baseline
under strict scope, with correctness, maintainability, standards, internal API
surface and input-handling lenses. One bounded follow-up examined the fixes.

| Finding | Severity | Correction and evidence | Status |
|---|---|---|---|
| RV-001: content poison suppressed an independently provable literal boundary error | Minor | Retain newline/EOF roots without a termination cascade or exceeding twenty errors. Three focused cases pass; independent follow-up confirmed the correction. | Resolved |
| RV-002: a late EOF root followed its content error rather than sorting by source span | Minor | Sort this single-source diagnostic list by start, end and code, preserving stable ties. Focused cases assert returned order directly. Verified inline after the bounded follow-up; no third review claimed. | Resolved |

No critical or major finding remains. No applicable web/auth/financial/tenant/MCP
security profile or performance-critical machine path exists in this phase;
specialist auditor dispatches were therefore skipped. Typed semantics review is
reserved for the owning later phases.

## Verification

| Check | Result |
|---|---|
| Frozen-lockfile install | Pass; no dependency change |
| Initial independent oracle | Missing entry red, followed by sixteen executed behavioral failures |
| Final lexical tests | 16 specification cases and 47 implementation cases pass |
| Repository qualification | Build, typecheck and 737 tests pass; compiler 633, CLI 61, root 43 |
| Touched formatting and diff whitespace | Pass |
| Frozen specification/expert and portfolio | Unchanged |

Final verification log: `/tmp/blend65-lexer-final-green.log`. The implementation
reuses existing position validation and diagnostic helpers. No unused diagnostic
module, public compiler export, dependency, target conversion or backend was added.

The immutable new lexical specification test has SHA-256
`1a28773fb3ece89c8215073426146ab15ef7df779e531e1b6cadf5e051719353`.
The independent author did not read production frontend implementations.

## Mechanical Verification Correction

The repository-wide foundation oracle exposed two pre-existing CLI implementation
test filenames matching rejected legacy paths. AR-P9 records the filename-only
correction to `project-args.impl.test.ts` and `project-render.impl.test.ts`.
Their contents and assertions are byte-identical, with respective SHA-256 values
`483e2b4c9a6b52a40b1e44196c825e43d899d5da054233cc164de284a2ec5534` and
`f41e402ebb868614fd8d1b9626dbf8e167987551dd66a80ab168a9192a13127a`.
No existing specification oracle or production CLI behavior changed.
The tracked-path-sensitive foundation gate passed all ten cases after staging;
log `/tmp/blend65-lexer-staged-foundation.log`.

## Authority and Limits

Specification 4.0 and expert 2.0.0 remain frozen. Expert content lineage is
`c9e70fab6039e9ced3108e88f0ea9730d4fd3007`; this lexical phase makes no assembly,
allocation, runtime, expert-parity or hardware qualification claim.
Next: phase 2, admitted syntax and parser recovery, with independent tests first.
