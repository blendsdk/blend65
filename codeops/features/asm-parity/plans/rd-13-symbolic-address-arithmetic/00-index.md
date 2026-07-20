# Implementation Plan: Symbolic Address Arithmetic

> **Implements**: asm-parity/RD-13
> **Source**: [RD-13](../../requirements/RD-13-symbolic-address-arithmetic.md) ·
> [RD preflight](../../requirements/00-preflight-report-rd-13.md)
> **Issue**: [#58](https://github.com/blendsdk/blend65/issues/58) — the symbolic-address slice only
> **Status**: 📋 Plan created — 2026-07-21
> **CodeOps Skills Version**: 3.11.0

## What this plan delivers

An address is a link-time constant the assembler resolves for free. The compiler materializes it
at runtime instead. This plan makes `hi(&X)` / `lo(&X)` cost one instruction, makes
`lo(&X / 2^k)` and `lo(&X >> k)` fold to an ACME expression, and stops `W10172` firing where the
frozen spec forbids it.

| Milestone | Lands in | Byte movement |
|---|---|---|
| **M3** `W10172` stops firing on power-of-two multiplies | Phase 1 | none |
| **M1** `hi(&X)` / `lo(&X)` → one immediate byte-select | Phase 2 | `balloon` −11 B |
| **M2** `lo(&X / 2^k)` / `lo(&X >> k)` fold, built **unwired** | Phase 3 | none |
| **AC-6** all three examples migrate to the blessed idiom | Phase 4 | `balloon` −2 B |
| **M4/M5** ledgers re-derived, 16 rows re-routed, closeout | Phase 5 | none |

The corpus regenerates **exactly twice** — Phase 2 and Phase 4 — and each regeneration carries its
ratchets, goldens and `SCOREBOARD.md` in the *same* commit, because the freshness gate rebuilds
every pair from `examples/` source.

## Documents

| Document | Contents |
|---|---|
| [00-ambiguity-register.md](00-ambiguity-register.md) | ✅ Gate passed — 9 decisions (AR #88–#96) |
| [01-requirements.md](01-requirements.md) | Scope, acceptance criteria, what is deliberately excluded |
| [02-current-state.md](02-current-state.md) | The three measured defects and every seam they touch |
| [03-01-operand-and-lowering.md](03-01-operand-and-lowering.md) | M1 + M2 — the two new operand variants, lowering, and every translator consumer |
| [03-02-diagnostics-examples-ledgers.md](03-02-diagnostics-examples-ledgers.md) | M3 + AC-6 + the `balloon-color` and `boing-ball` checks + M4/M5 |
| [07-testing-strategy.md](07-testing-strategy.md) | ST-* cases, the four re-derived spec tests, red/green ordering |
| [99-execution-plan.md](99-execution-plan.md) | 5 phases / 52 tasks, per-phase verify and commit points |

## The one hazard this plan is built around

RD-03 aligns a `&`-taken const array by marking it **inside** `lowerAddressOf`
(`lower.ts:1863`), and that same function claims the site's positional frame slot (`:1845`). Its
`direct` path (`:1870`) returns the raw address operand *after both side effects*.

`examples/balloon/main.blend:11` contains that program's **only** `&`. An implementation that
reaches a byte-select without calling `lowerAddressOf` silently moves the sprite off its page
boundary — and nothing in CI would notice, because `balloon` has no committed golden and the
alignment is observable only through the symbol map or on VICE.

Every path this plan adds routes through `lowerAddressOf(arg, ctx, true)`. Phase 2 lands the
existing ST-C15 alignment assertion as its gate before any lowering changes, so the hazard is
watched from the first commit that could cause it.

## To begin implementation

Run the exec_plan skill on `asm-parity rd-13-symbolic-address-arithmetic`.
