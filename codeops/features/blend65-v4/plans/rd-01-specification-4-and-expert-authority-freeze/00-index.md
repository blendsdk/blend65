# Specification 4.0 and Expert Authority Freeze Implementation Plan

> **Feature**: Publish one qualified C64-only Specification 4.0 and matching expert authority
> **Status**: Planning Complete
> **Created**: 2026-09-13
> **Revised**: 2026-09-13 after the accepted simplification reset
> **Implements**: blend65-v4/RD-01
> **CodeOps Artifact Schema**: 1

## Outcome

This plan edits the existing `spec/` tree into the one active Specification 4.0 corpus, reconciles
an isolated `blend65-domain-expert` 2.0.0 candidate to that corpus, qualifies only the changed and
dependent expert cases, and activates the exact approved candidate. Compiler implementation starts
later in RD-02.

## Minimum-Sufficient Design

- Keep one specification tree and one live expert skill.
- Keep one central normative inventory and content digest; record raw final hashes at closeout.
- Use one four-column Specification 3→4 crosswalk plus a final semantic-diff review.
- Validate specification content with direct acceptance checks, not passive Markdown test files or
  a new documentation-test framework.
- Build and qualify the expert candidate outside the live skill path. Check every case structurally,
  but rerun model evaluation only for changed/dependent cases plus one fixed unchanged control from
  each casebook.
- Use one final independent evidence/domain review before explicit activation approval.

This is the five-phase design accepted in AR-P7. It removes the per-file identity stamps, 107-case
model rerun, hunk ledger, arbitrary file-count batching, and duplicated review layers rejected by
AR-049.

## Documents

| Document | Purpose |
|---|---|
| [Ambiguity Register](00-ambiguity-register.md) | Ten resolved plan decisions |
| [Requirements](01-requirements.md) | RD-01 scope and accepted planning constraints |
| [Current State](02-current-state.md) | Existing authorities, gaps, and risks |
| [Specification Reconciliation](03-01-specification-reconciliation.md) | Baseline, exact oracles, and language semantics |
| [C64 Authority and Freeze](03-02-c64-authority-and-freeze.md) | C64, Guard, diagnostics, inventory, crosswalk, and digest |
| [Expert Candidate and Activation](03-03-expert-candidate-and-activation.md) | Isolated candidate, impact qualification, approval, and activation |
| [Testing Strategy](07-testing-strategy.md) | Direct, observable acceptance checks |
| [Execution Plan](99-execution-plan.md) | Five phases and 31 ordered tasks |

## Execution Boundary

Use `codeops:exec-plan` for this plan. Phase 5 must stop after presenting the immutable candidate
and evidence packet. The live skill cannot change until the user explicitly approves that exact
candidate. Commits are automatic at coherent green checkpoints; pushes are never automatic.

## Authority Inputs

- [RD-01](../../requirements/RD-01-specification-4-and-expert-authority-freeze.md)
- [V4 ambiguity register](../../requirements/00-ambiguity-register.md), AR-001–AR-050
- [Phase 0 handoff](../../00-phase-0-handoff.md)
- `spec/` Specification 3 input, identity `BLEND65-SPEC-P3-4bf8a989`
- `.agents/skills/blend65-domain-expert/` 1.0.0 input, content commit
  `a96cfd3c41a456d4d4f983021cf43535a1d5bdaa`
- `.clinerules/language-guard.md`
