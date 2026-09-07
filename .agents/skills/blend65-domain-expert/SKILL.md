---
name: blend65-domain-expert
description: Review, design, diagnose, or implement Blend65 behavior where decisions depend on constrained 6502/65C02 compiler engineering, expert assembly output, or C64 game hardware. Use for compiler audits, language expressiveness, lowering, allocation, ABI, instruction selection, optimization, generated-assembly review, C64 platform APIs, and game feasibility. Do not use for generic TypeScript maintenance or unrelated tooling.
---

# Blend65 Domain Expert

> **Active construction version**: `0.3.2-compiler-knowledge`
> **Qualification status**: Unqualified. This version must not authorize compiler, language,
> hardware, optimization, platform, game-design, parity, or product decisions.

The previous four-reference prototype is quarantined while the independently sourced `1.0.0`
baseline is built. The source/evidence modules and candidate language/compiler/SFA/optimization
modules are construction material, not active decision authority. The old references remain only
as read-only migration evidence. They may be inspected to ensure that no useful old rule
disappears, but their statements are not facts and must not determine new qualification
expectations or compiler architecture.

## Allowed Use During Quarantine

- Inventory an old statement and map it to a planned replacement concern.
- Reproduce the pinned red-baseline assessment recorded in `qualification/release.md`.
- Check that the four legacy reference hashes still match the pinned identity.

For any domain decision, stop and report that the active skill is unqualified. Use the reconciled
frozen Blend65 specification, explicit product decisions, and independently pinned primary
hardware/tool evidence only through the construction and qualification process. Existing compiler
code, tests, readiness artifacts, scoreboards, and feasibility snapshots are audit subjects, never
authority for the replacement skill.

## Pinned Legacy Evidence

The pinned identity is Git commit `d39ae459e02133d474d7157807d53d7e71fd6268`. The immutable
SHA-256 values for the old router, metadata, and four references are recorded in
`qualification/coverage-matrix.md`. Any change to a legacy reference before the atomic migration
invalidates the baseline and must stop the affected work.

## Exit Condition

This quarantine ends only when the isolated candidate passes structural, coverage/source, and
blind behavioral gates; the old references are accounted for in the migration ledger; and the
qualified `1.0.0` router and thirteen references replace this tree atomically. Until then, there is
no active qualified Blend65 expert baseline.
