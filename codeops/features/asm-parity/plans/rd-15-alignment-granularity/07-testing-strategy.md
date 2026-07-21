# Testing Strategy: Alignment Granularity

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Overview

No coverage-percentage target is set for this plan: the change is four edits across three files,
and every one of them is on a path an existing suite already exercises. What matters instead is
that each new assertion can **fail in the direction the change could break**, which on this feature
is the hard part — see [Red-phase expectations](#red-phase-expectations).

All end-to-end cases build an **inline source through the real `build()` facade in a temp
directory** under `describe.skipIf(!hasAcme())`, the pattern `symbolic-address.spec.test.ts:25-36`
established; no new `examples/` directory is created (AR #115). They live in one new file,
`packages/test-harness/src/align-granularity.spec.test.ts` (AR #116), whose header states the ACME
bitmask trap in the style of `align-mixed.spec.test.ts:1-19`.

## 🚨 Specification Test Cases

> Derived from RD-15's acceptance criteria and the component specs, never from the implementation.
> **Immutable oracle rule:** if the implementation does not match one of these, the implementation
> is wrong. In-code traceability comments state the behavior in plain language and never cite an
> AC, ST, AR or plan path.

Every program below is a single `main.blend` module. `SPRITE` is a 64-byte `const byte[64]`, `A`
and `B` are 4-byte `const byte[4]`, and the sink for a folded byte is `poke($07F8, …)` — the VIC's
sprite-pointer address, which is what the idiom is for.

### New — the 64-byte demand (Phase 2)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-15a | `poke($07F8, lo(&SPRITE / 64));` — the only `&` in the program | The assembly contains **exactly one** `!align` line; its text is exactly `!align 63, 0, 0`; the line immediately after it is `__data_Main_SPRITE:`. The text is never `!align 255, 0, 0` and never `!align 64, 0, 0` — the latter assembles silently and aligns nothing | AC-1 |
| ST-15b | The ST-15a program, and a bare-`&` counterpart whose only address use is `let p: word = &SPRITE;` | The fold program resolves `__data_Main_SPRITE` to an address where `addr % 64 === 0`; the bare-`&` program resolves it to `addr % 256 === 0` | AC-2 |
| ST-15c | Two 4-byte const arrays, both fold-named: `poke($07F8, lo(&A / 64)); poke($07F9, lo(&B / 64));` — built twice, once with an extra filler function ahead of `main` | In **both** builds, `__data_Main_B` resolves to exactly `__data_Main_A + 64`. A delta of 256 would mean the demand was not applied; a delta of 4 would mean alignment was dropped entirely | AC-3 |
| ST-15d | (a) One program naming `SPRITE` **both** ways — `poke($07F8, lo(&SPRITE / 64)); poke($D000, hi(&SPRITE) * 4);` — and a second identical but for the two statements swapped. (b) A program naming it only as `lo(&SPRITE / 64)` | (a) Both orders emit exactly one `!align 255, 0, 0` and resolve `addr % 256 === 0`. (b) Emits `!align 63, 0, 0`. (c) In (a), the immediate stored to `$07F8` equals `(addr / 64) & 0xff`, and on that same resolved address `(addr >> 8) * 4 === addr / 64` — the two idioms name the same block. *(The `hi(&X) * 4` side is computed at runtime by shifts, so it contributes no second immediate to read; the identity on the resolved address is the property that matters and the one available.)* | AC-4 |
| ST-15e | Six programs, each with `SPRITE`'s address used exactly once, as: `lo(&SPRITE / 1)`, `lo(&SPRITE / 128)`, `lo(&SPRITE / 16384)`, `lo(&SPRITE / 32768)`, `lo(&SPRITE)`, `hi(&SPRITE)` | Each emits exactly one `!align 255, 0, 0` and resolves `addr % 256 === 0`. `/ 1` and `/ 32768` are `k = 0` and `k = 15`, the extremes the fold accepts; `/ 16384` is a VIC-bank read, correct at any address, and must not be honored as a placement demand | AC-5, AR #121 |
| ST-15f | Three programs identical but for the divisor's spelling: `lo(&SPRITE / 64)`, `lo(&SPRITE >> 6)`, and `lo(&SPRITE / BLOCK)` with `const BLOCK: byte = 64;` | All three emit `!align 63, 0, 0`, all three resolve `addr % 64 === 0`, and all three store the same immediate to `$07F8`. The demand keys on the normalized shift, not on a literal `64` token | AC-6 |
| ST-15g | A program with **no** const aggregate addressed: a mutable module array `let buf: byte[64]` used as `poke($07F8, lo(&buf / 64));`, and a function used as `poke($D020, lo(&helper / 64));` | The assembly contains **no** `!align` directive at all, and the folded operands still assemble — the byte stored to `$07F8` is the low byte of `__var_Main_buf / 64` as the symbol map resolves it. The demand parameter is inert outside the const branch | AC-15 |

### Re-derived — the three fold-form oracles (Phase 2)

Each keeps its existing `< 0x1000` char-ROM clause and its existing assembled-pointer clause
unchanged; only the boundary assertion is restated, and each gains the directive-text clause.

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-C15 | `examples/balloon`, built through `build()` (`balloon.spec.test.ts:185-196`) | `__data_Main_BALLOON` resolves to `addr % 64 === 0`, **and** the line immediately preceding `__data_Main_BALLOON:` is exactly `!align 63, 0, 0` | AC-9 |
| ST-13f | `examples/balloon-color` (`balloon-color.spec.test.ts:42-60`) | Same two clauses on its sprite label, alongside the unchanged assembled-pointer assertion | AC-9 |
| ST-13j | `examples/boing-ball` (`boing-ball.spec.test.ts:58-75`) | Same two clauses on `__data_Main_BALL`, alongside the unchanged base-slot and sibling-pointer assertions | AC-9 |

### Unmodified — the bare-`&` negative control (no phase)

ST-C11, ST-C12 and ST-C13 (`align-mixed.spec.test.ts:85-87, :99, :104, :115`) assert
`!align 255, 0, 0`, `aligned % 256 === 0`, `plain === aligned + 4`, and the `hi * 4` identity.
`examples/align-mixed/main.blend`'s only `&` is bare, so all three must pass **with no edit to
either file** — AC-8 is satisfied by their absence from every diff in this plan.

### Reshaped — the sixteen `pageAligned` sites (Phase 1)

Owned by [03-02 §1](03-02-oracles-and-ledgers.md#1--the-sixteen-reshaped-sites-phase-1). ST-C5,
ST-C9, ST-C10, ST-C19 and ST-C19b assert `boundary === 256`; ST-C6, ST-C7, ST-C8 and ST-C10's
second array assert the entry carries **no boundary at all** (plan criterion P-2).

## Red-phase expectations

The 64- and 256-byte boundaries coincide on most real addresses, so several correct new assertions
pass *before* the implementation exists. Distinguishing the two groups up front is what keeps the
red phase honest — and the pre-green group is not padding, it is the regression surface that stops
the change from over-reaching.

| Goes RED in Phase 2 | Pre-green — a guard, not a gate |
|---|---|
| ST-15a (directive text is `!align 255` today) | ST-15b's `% 64` half — today's images already sit on `$0900`, a multiple of both |
| ST-15c (the delta is 256 today) | ST-15d (a) and (c) — the mixed-demand program is page-aligned today and stays so |
| ST-15d (b) | ST-15e — every one of these shapes is already 256; the test exists so they *stay* 256 |
| ST-15f (all three spellings emit `!align 255` today) | ST-15g — a variable and a function own no const image today either; the test exists so the new parameter cannot change that |
| ST-C15, ST-13f, ST-13j — their **directive-text clause only** | The `% 64` half of all three re-derived oracles — see below |

**All three re-derived oracles go red on the directive clause alone, and none of them on the
address clause.** Every one of the three images is page-aligned today, and a multiple of 256 is a
multiple of 64, so `% 64 === 0` already holds at `$0900`, `$0A00` and `$0B00`. There is no
exception: `balloon-color` moves the furthest — `$0A00` today, `$0980` after — and both satisfy
`% 64`. What fails deterministically at `$0980` is the **old** `% 256` assertion, which is the
forward tripwire M4 is named for, not a red phase. The three `% 64` clauses are therefore guards in
exactly the sense the second column means, and task 2.3's perturbation step covers them.

Phase 1's red phase is separate and unambiguous, though it is not one failure mode but two: fifteen
of the sixteen reshaped sites read a field that does not exist yet, and the sixteenth
(`assemble.impl.test.ts:155`) omits a field that is still required. Either way
`yarn turbo run typecheck` fails before any test runs.

## Implementation tests

Written after the implementation, and free to derive from it.

| File | Covers | Phase |
|---|---|---|
| `packages/codegen/src/instr/instr-program.impl.test.ts` | `constDataStream`'s two branches at the stream level: an entry carrying a boundary opens with the align directive ahead of its label, an entry without one opens with the label | 1 |
| `packages/codegen/src/il/lower-address-of.impl.test.ts` | The allowlist exhaustively **through lowering** — `lo(&X / 2^k)` for every `k = 0..15`, expecting `boundary === 256` for all but `k = 6`, which is 64. Reached this way rather than by exporting the mapping, and cheap: it is the IL tier, no ACME. Plus the coarsest-wins insert in both source orders, and a symbol demanded 64 from **two different functions** staying 64 | 2 |

## Verification checklist

- [ ] Every ST case above traces to an RD-15 acceptance criterion or an AR entry
- [ ] Specification tests written before the implementation in their phase
- [ ] The RED set above verified red, and the pre-green set verified green **and** verified to fail
      when the expectation is deliberately perturbed (they are guards; an unfailable guard is worse
      than none)
- [ ] All specification tests green after implementation
- [ ] Implementation tests written for the allowlist, the combining rule, and the stream branch
- [ ] No regressions: 14 committed goldens byte-identical, `budgets.json` unchanged, no ratchet
      moves, `SCOREBOARD.md` unchanged
- [ ] `align-mixed.spec.test.ts` and `examples/align-mixed/main.blend` appear in no diff (AC-8)
