# RD-18 Slice 6 — Full Expressions & Mixed Width — Implementation Plan

> **Feature**: Complete the expression system — the full binary-operator matrix
> (comparisons/logical/bitwise/shifts joining arithmetic), TS-4 mixed-width
> auto-promotion reaching assignments/arguments/returns, unary `- ! ~`, FR-40
> `<type>(expr)` casts, the ternary, TS-17 compound assignment, `&&`/`||` with the
> short-circuit **guarantee** lowered as CFG diamonds over synthetic SFA slots,
> signed + word comparison codegen (fixing a latent word-compare miscompile, DEF-1),
> word/variable shifts, non-const `lo`/`hi`, width-aware const folding, and four new
> warnings. Closes **RD-18 AC-5**.
> **Status**: Planning Complete · Zero-Ambiguity Gate ✅ PASSED (2026-07-11,
> `00-ambiguity-register.md`, AR-1…AR-14) · Preflight ✅ PASSED (2026-07-11,
> `00-preflight-report.md`, 13/13 findings resolved + fixes applied)
> **Created**: 2026-07-11
> **Implements**: blend65-ri/RD-18 (Slice 6 row; closes AC-5)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) (Slice 6 row; AC-5)
> **CodeOps Skills Version**: 3.3.1

## Overview

Slices 3a–5b built the pipeline's skeleton surface: scalars, control flow,
functions, and the module system, all VICE-proven. Slice 6 makes the *expression
language* real. Today only same-type arithmetic is typed — every other operator
silently poisons (and comparisons still LOWER, byte-width-only: a `word` loop bound
compiles silently wrong today). This slice replaces that hole with the full spec
Ch 02/04 system across all four middle stages, and is the last slice before
aggregates (7) and hardware (8).

The riskiest pieces were gate-resolved: short-circuit/ternary results cross basic
blocks through synthetic SFA frame slots (AR-6) with a count-parity ICE guard;
comparisons carry their operand type in IL (AR-9) and translate grows all four
byte/word × unsigned/signed framings (AR-1); signed `/`/`%` becomes a loud ICE
instead of a silent unsigned-routine miscompile (AR-2); widening adopts one
`isAssignableTo` rule everywhere, superseding 5a's strict-argument interim (AR-3).

## Document Index

| # | Document | Description |
|---|----------|-------------|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Gate decisions AR-1…AR-14 (audit trail) |
| 00 | [Index](00-index.md) | This document |
| 01 | [Requirements](01-requirements.md) | Delta view onto RD-18 + plan-local decisions |
| 02 | [Current State](02-current-state.md) | Recon @ `36c71fb`; the four gaps |
| 03-01 | [Typing & Promotion](03-01-typing-promotion.md) | Core policy + full Pass-3 expression typing + codes/warnings |
| 03-02 | [Const-Eval Widths](03-02-const-eval-widths.md) | Type-aware folds (bitwise/shift/cast/ternary/logical) |
| 03-03 | [Lowering & Slots](03-03-lowering.md) | Synthetic `0sc` slots, coercions, CFG diamonds, guards |
| 03-04 | [Translate](03-04-translate.md) | neg/not/zext/sext/trunc, 4 comparison framings, shifts |
| 03-05 | [Acceptance Fixtures](03-05-acceptance-fixtures.md) | `examples/slice6/` + 3-part bar + negatives |
| 07 | [Testing Strategy](07-testing-strategy.md) | ST-1…ST-34 + impl-test catalog |
| 99 | [Execution Plan](99-execution-plan.md) | 6 phases, 52 tasks |

## Quick Reference

### Usage example (the fixture's heart)

```blend65
let r: word = base + a;                    // byte auto-promotes (zext)
r += 55;                                   // compound assignment
let cond: boolean = (a < base) && (s < 0); // mixed-width + signed compare
let pick: byte = cond ? 7 : 9;             // ternary
let dead: boolean = (a > base) && bump();  // bump() provably NOT called
```

### Key decisions

| Decision | Outcome |
|----------|---------|
| Signed relational compares | in (N⊕V, byte+word) — AR-1 |
| Signed `/` `%` | loud lowering ICE — AR-2 |
| Widening | one rule everywhere (args/returns too) — AR-3 |
| Cross-block results | synthetic `0sc<N>` SFA slots + parity ICE — AR-6 |
| Cast surface | FR-40 `<type>(expr)`; TS-11/grammar drift recorded — AR-14 |
| New codes | E10086/E10087/E10088 minted; E10083/E10155 first emitted; W10101/W10160/W10161/W10174 minted — AR-10, AR-4 |

## Related Files

Core: `type-utils.ts`, `diagnostic-codes.ts` · Frontend:
`expression-typing.ts`, `statement-typing.ts`, `const-eval.ts`,
`sfa/model-adapter.ts` · Codegen: `il/lower.ts`, `instr/translate.ts` ·
Harness: `testing/slice6.ts`, three slice6 suites, `test/golden/slice6.asm.golden` ·
Fixture: `examples/slice6/main.blend`
