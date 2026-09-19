# Phase 3 Qualification: Module Graph and Declaration Bindings

> **Date**: 2026-09-19
> **Result**: Qualified; module graph only, not typed body acceptance or complete RD-03
> **Phase baseline tree**: `a17413080305edbd7fc02ff956d0f1c27148defb`
> **Implementation-review baseline tree**: `df10a000b6fea2f9573396c6304d73c0494fe483`

## Independent Review

The correctness reviewer examined the Phase 3 implementation under strict
scope, with correctness, maintainability, standards and internal API-surface
lenses. The implementation-review baseline contains the authorized immutable
module oracle, so implementation review does not misclassify specification-first
authoring as an oracle edit.

| Finding | Severity | Correction and evidence | Status |
|---|---|---|---|
| RV-001: the phase baseline preceded specification-test authoring | Critical | Established a separate implementation-review tree containing the corrected oracle at its recorded hash; the focused re-review verified no later oracle change. | Resolved |
| RV-002: incomplete parser results lacked explicit obligations | Major | Retained unsupported syntax as implementation obligations and bounded exhaustion as analysis-limit obligations. Directed cases cover both. | Resolved by focused re-review |
| RV-003: calls ending in `.main` were diagnosed by spelling | Major | Resolve every direct callee to a declaration `BindingId`; E10023 is independent of entry signature/count and ordinary local `object.main()` is not rejected. | Resolved by focused re-review |
| RV-004: later or sibling locals suppressed earlier module references | Major | Walk lexical scopes in source order, introduce locals only after their initializer, and discard child-scope names on exit. The reviewer's exact earlier-reference/later-child-local shape now reaches `Math`. | Corrected inline after focused re-review |
| RV-005: declaration duplicates bypassed the import/declaration event order | Major | Feed every import alias and module declaration through one source-span-sorted stream; every later collision relates to the earliest exact name span. A three-way alias/declaration case proves both later reports. | Corrected inline after focused re-review |

The protocol permits one focused re-review. RV-004 and RV-005 were found still
open by that re-review, then corrected with direct regressions and inline
verification; no unsupported third independent review is claimed. No critical
or major finding remains in the final verified tree.

## Verification

| Check | Result |
|---|---|
| Initial independent oracle | 9 behavioral cases executed and failed before implementation |
| Final module-focused tests | 19 pass: 9 specification and 10 implementation cases |
| Compiler qualification | Build and typecheck pass; 25 test files and 701 tests pass |
| Root integration | Build, typecheck and test pass; 43 root foundation/boundary tests pass |
| Import-boundary qualification | 24 tests pass |
| Touched formatting and diff whitespace | Pass |
| Frozen specification and expert skill | Unchanged |

Final phase log: `/tmp/blend65-modules-phase3-final-green.log`. The checkout has
no lint task in its root manifest or Turbo configuration, so qualification uses
the plan's observed build, typecheck, test and import-boundary commands rather
than claiming a nonexistent lint pass.

The immutable module specification test has SHA-256
`c4af1131482c703c1b5ce36fd59464ea8a0a5a4ad176c2aaec0c9034d67486d2`.
The implementation uses only the existing parser, project snapshot and project
diagnostics. It adds no compiler-root export, CLI behavior, dependency, profile
declaration, target conversion, initializer scheduling or generalized framework.

## Authority and Limits

Specification 4.0 and expert 2.0.0 remain frozen. This phase proves header
indexing, merged module declarations, selected reachability, imports, qualified
references, declaration identities and entry-point rules. It makes no typed-body,
initializer-order, machine-lowering, assembly-parity or hardware claim.

Next: phase 4, scalar expressions, direct calls and structured flow.
