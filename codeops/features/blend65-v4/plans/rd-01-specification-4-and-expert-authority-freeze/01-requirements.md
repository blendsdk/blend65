# Requirements: Specification 4.0 and Expert Authority Freeze

> **Parent**: [Index](00-index.md)
> **Owning source**:
> [RD-01](../../requirements/RD-01-specification-4-and-expert-authority-freeze.md)

## In Scope

- Verify and record the Phase 0 handoff, Specification 3 input, expert 1.0.0 input, and all resolved
  AR-001–AR-050 decisions.
- Reconcile RD-01 R1.2–R1.20 into the existing `spec/` tree and Language Guard.
- Publish the central normative inventory, deterministic corpus digest, concise transition
  crosswalk, final semantic-diff result, and raw final hashes.
- Build expert 2.0.0 outside the live skill path, update only affected knowledge and cases, derive
  the transitive impact set, and qualify it under R1.21–R1.23.
- Obtain explicit approval of the exact candidate, activate it atomically, complete freeze and
  deferral-expiry evidence, and update the feature roadmap.

## Out of Scope

- Compiler, package, CLI, LSP, editor, assembler, packager, runtime, or generated-artifact changes.
- Compiler, ACME, VICE, readiness, emulator, game-corpus, or feasibility execution.
- Normative C64U, X16, Atari 800XL, or Atari 7800 support.
- A documentation test framework, evidence database, generalized evaluator service, second active
  spec tree, or second live expert release.

## Accepted Planning Constraints

| Decision | Binding outcome |
|---|---|
| AR-P1 | Plan and execute RD-01 only. |
| AR-P2 / AR-P7 | Replace the original eight-phase split with five outcome-oriented phases. |
| AR-P3 / AR-P7 | Reuse the five casebooks; qualify by dependency impact and fixed controls. |
| AR-P4 / AR-P7 | Run direct checks only; create no passive `tests/*.md` artifacts. |
| AR-P5 / AR-P7 | One central inventory-derived digest; no repeated identity stamps. |
| AR-P6 / AR-P7 | Inventory in `spec/`; crosswalk, hashes, approval, and freeze in one closeout. |
| AR-P8 | Use the exact AR-050 `sin_k`/`cos_k` rule, vectors, ranges, and fingerprints. |
| AR-P9 / AR-P10 | AR-P10 supersedes the unused test-pair proposal; RD-01 uses direct checks and independent review without test files. |

## Completion Rule

Every RD-01 acceptance criterion must pass. The plan may group related Markdown edits into one
coherent task because file-count batching is not a requirement. A task may not weaken semantics,
qualification expectations, the explicit approval gate, or the single-active-authority rule.
