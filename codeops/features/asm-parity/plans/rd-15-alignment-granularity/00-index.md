# Implementation Plan: Alignment Granularity

> **Implements**: asm-parity/RD-15
> **Source**: [RD-15](../../requirements/RD-15-alignment-granularity.md) ·
> [RD preflight](../../requirements/00-preflight-report-rd-15.md)
> **Issue**: [#69](https://github.com/blendsdk/blend65/issues/69)
> **Status**: ✅ Complete — 2026-07-21 (3 phases / 24 tasks, all criteria discharged)
> **CodeOps Skills Version**: 3.11.0

## What this plan delivers

A `const` image whose address the program takes is emitted at a 256-byte boundary. A C64 hardware
sprite is dereferenced in 64-byte blocks. This plan makes the emitted boundary follow the
arithmetic the source already writes: `lo(&X / 64)` and `lo(&X >> 6)` demand **64**, every other
const-`&` form demands **256**, and a symbol gets the coarsest demand it collected — which is what
keeps `hi(&X) * 4` correct without a caution anywhere.

| Milestone | Lands in | Byte movement |
|---|---|---|
| **M3** the mark becomes a value, not a flag | Phase 1 | **none, by construction** |
| **M1/M2** the fold shape demands 64; coarsest-wins keeps `hi(&X) * 4` right | Phase 2 | `balloon-color` −128 B |
| **M4** the three fold-form oracles re-derived, three kept as the bare-`&` control | Phase 2 | none |
| **M5** ledgers, back-propagation, closeout | Phase 3 | none |

**The deliverable is the bound, not the bytes.** Padding to 256 makes every image's pad a uniform
draw from 0–255 that re-rolls whenever unrelated code changes size — noise larger than most of the
optimizations this project measures. `balloon` is the only address-taken program carrying a size
budget and it recovers **nothing**; the corpus total does not move. What changes is that a
64-demand image's pad is bounded below 64 instead of below 256, a measurement-hygiene property
every later code-size requirement inherits (AR #101).

## Documents

| Document | Contents |
|---|---|
| [00-ambiguity-register.md](00-ambiguity-register.md) | ✅ Gate passed — 9 decisions (AR #113–#121) |
| [00-preflight-report.md](00-preflight-report.md) | ✅ Passed — 10 findings (1 major, 6 minor, 3 observations), all resolved |
| [01-requirements.md](01-requirements.md) | Scope delta against RD-15, plan-local criteria |
| [02-current-state.md](02-current-state.md) | The three seams the change touches and every site on them |
| [03-01-demand-and-emission.md](03-01-demand-and-emission.md) | M1/M2/M3 — the demand map, the allowlist, the per-entry directive |
| [03-02-oracles-and-ledgers.md](03-02-oracles-and-ledgers.md) | M4/M5 — the six pinned assertions, the sixteen reshaped sites, the ledger corrections |
| [07-testing-strategy.md](07-testing-strategy.md) | ST-cases, the re-derivations, red/green ordering |
| [99-execution-plan.md](99-execution-plan.md) | 3 phases / 24 tasks, per-phase verify and commit points |
| [08-closeout.md](08-closeout.md) | ✅ All 15 acceptance criteria + P-1/P-2/P-3 discharged with evidence |

## Key decisions

| Decision | Outcome | AR |
|---|---|---|
| How the demand reaches the mark site | the derived **boundary in bytes**, typed `AlignBoundary = 64 \| 256`; the allowlist stays in `foldedAddressByte` | AR #113 |
| The context field | `alignmentDemands: Map<string, AlignBoundary>` | AR #114 |
| Where the new fixtures live | inline sources through `build()`, no new `examples/` directory | AR #115, #116 |
| Tier for the AC-5/AC-6 matrices | end-to-end through ACME | AR #117 |
| Phase structure | 3 phases; the data-shape migration lands behaviour-neutral first | AR #118 |
| RD-15's Should-Have | excluded — no platform threading in this plan | AR #119 |
| AC-5's `lo(&X / 65536)` clause | dropped — measured, the lexer rejects the literal before lowering runs, so there is no boundary to keep | AR #121 |

## The hazard this plan is built around

`!align` takes a **bitmask**, not a modulus. `!align 64, 0` assembles cleanly, appears in the
output, and aligns nothing. The derivation lives in exactly one place — `print-instr.ts:179`
renders `boundary - 1` — and it validates nothing, so a boundary that is not a power of two
produces a silently under-aligned image and a sprite that reads from the wrong block. AR #113
closes that at the type: `AlignBoundary` admits 64 and 256 and no third value, at every producer
of a `ConstDataEntry` rather than only inside lowering.

The second-order version of the same hazard is that **a 64-byte boundary and a 256-byte boundary
usually coincide**. Two of the three programs this plan moves land on addresses that are multiples
of both, so a resolved-address assertion cannot tell the two apart on them, in either direction.
Every oracle this plan re-derives therefore pins the **directive text** alongside the address —
the only deterministic discriminator (AR #108).

## Related files

| File | Role |
|---|---|
| `packages/codegen/src/il/lower.ts` | the demand map, the mark, the allowlist |
| `packages/codegen/src/il/cfg.ts` | `AlignBoundary`, `ConstDataEntry.boundary` |
| `packages/codegen/src/instr/instr-program.ts` | the per-entry directive |
| `packages/test-harness/src/align-granularity.spec.test.ts` | new — AC-1..AC-6, AC-15 |
| `packages/test-harness/src/{balloon,balloon-color,boing-ball}.spec.test.ts` | the three re-derived oracles |
| `packages/test-harness/src/align-mixed.spec.test.ts` | untouched — the bare-`&` negative control |
