# Closeout: Alignment Granularity

> **Document**: 08-closeout.md
> **Parent**: [Index](00-index.md)
> **Implements**: asm-parity/RD-15 · [#69](https://github.com/blendsdk/blend65/issues/69)
> **Completed**: 2026-07-21 · 3 phases / 24 tasks
> **CodeOps Skills Version**: 3.11.0

## What shipped

A const image's alignment boundary now follows the arithmetic the source writes around its
address. `lo(&X / 64)` and `lo(&X >> 6)` — one normalized shift of 6 — demand **64**, the unit the
VIC dereferences a sprite in. Every other const-`&` form demands **256**. A symbol named more than
one way takes the coarser of the two, which is what keeps `hi(&X) * 4` correct *by construction*:
that idiom lowers through a divisor-less path, registers a page, and the maximum keeps it there.

| Phase | Commit | Delivered |
|---|---|---|
| 1 | `37038ff` | `pageAligned: boolean` → `boundary?: AlignBoundary`; the demand map; 16 test sites reshaped. **Behaviour-neutral, proven.** |
| 2 | `9b7d7bc` | `boundaryOfShift`, the single fold call site, ST-15a…ST-15g, three oracles re-derived. `balloon-color` −128 B. |
| 3 | *(this commit)* | Ledger corrections, RD back-propagation, the emulator tier, this closeout. |

## The deliverable is the bound, not the bytes

Padding every address-taken image to 256 made its pad a uniform draw from 0–255 that re-rolled
whenever unrelated code changed size — noise larger than most of the optimizations this project
measures. A 64-demand image's pad is now bounded under 64.

**Measured at Phase 2 green**, by building each committed example through `build()`:

| Program | Directive | Address | Pad | `.prg` | Payload |
|---|---|---|---|---|---|
| `balloon` | `!align 63, 0, 0` | `$0900` | **19** | 320 | **318** — unchanged |
| `balloon-color` | `!align 63, 0, 0` | `$0980` | **60** | 456 (was 584) | 454 (was 582) |
| `boing-ball` | `!align 63, 0, 0` | `$0B00` | **1** | 1793 | 1791 |
| `align-mixed` | `!align 255, 0, 0` | `$0900` | 194 | 265 | 263 |

**This RD recovers 128 bytes in a program that carries no budget, and the corpus byte total does
not move.** `balloon` is the only address-taken program with a `budgets.json` row and it recovers
nothing — still 318 B. `align-mixed`'s 194 sits outside the bound's scope: it is the bare-`&`
256-demand control, and 194 < 256 as that demand requires. A closeout claiming a corpus byte
improvement would be wrong, and this one does not.

## Acceptance criteria

| # | Criterion | Evidence |
|---|---|---|
| AC-1 | Directive text, 64 demand | ST-15a — exactly one `!align` line, text exactly `!align 63, 0, 0`, image label on the next line; both wrong spellings (`255`, and the modulus-trap `64`) pinned out explicitly |
| AC-2 | Resolved boundary | ST-15b — the fold program resolves `% 64 === 0`, the bare-`&` counterpart `% 256 === 0` |
| AC-3 | Code-size-independent delta | ST-15c — two fold-named 4-byte arrays land exactly 64 apart, in **both** builds (with and without a filler function shifting the start), so a delta that only holds from one lucky address cannot pass |
| AC-4 | Maximum rule, both directions | ST-15d — both statement orders emit one `!align 255, 0, 0` and resolve `% 256 === 0`; the fold-only contrast case emits `!align 63, 0, 0`; the `$07F8` immediate equals `(addr / 64) & 0xff` and `(addr >> 8) * 4 === addr / 64` on the same resolved address |
| AC-5 | Non-allowlisted shapes keep 256 | ST-15e — all six forms (`/1`, `/128`, `/16384`, `/32768`, `lo`, `hi`) emit `!align 255, 0, 0` and resolve `% 256 === 0`. The `/65536` clause was dropped as untestable and the reason back-propagated into the RD |
| AC-6 | `/ 64`, `>> 6`, `/ BLOCK` indistinguishable | ST-15f — all three spellings emit `!align 63, 0, 0`, resolve `% 64 === 0`, and store the same immediate, each anchored against its own program's symbol map first |
| AC-7 | By-reference registers nothing | ST-C6 — the entry carries **no boundary at all**, not 256. Also ST-C7, ST-C8 and ST-C10's second array |
| AC-8 | Bare `&` untouched | `align-mixed.spec.test.ts` and `examples/align-mixed/main.blend` appear in **no diff** of any phase; ST-C11/C12/C13 green throughout |
| AC-9 | Three fold-form oracles re-derived | ST-C15, ST-13f, ST-13j — each `% 64` **plus** the directive text on the line preceding its label, with every pre-existing clause (`< 0x1000` char-ROM, assembled pointer byte, sibling-pointer chain) intact |
| AC-10 | The bound | Measured above: 19, 60, 1 — every 64-demand pad under 64 |
| AC-11 | No corpus movement claimed | `budgets.json` unchanged, `balloon` still 318 B, no ratchet moves, `SCOREBOARD.md` unchanged, 14 goldens byte-identical. `balloon-color`'s 582 → 454 recorded as a measurement, never as a budget row |
| AC-12 | Ledger contradiction closed | `RD-13-symbolic-address-arithmetic.md` — the prediction that this RD makes `hi(&X) * 4` *incorrect* is corrected in place, with the peephole **conclusion** visibly unchanged: it stands on the wraparound-semantics argument, which never depended on the prediction |
| AC-13 | Verify green | Full verify green at every phase boundary. Local VICE 3.10 tier green: `balloon`'s shared observable set and ST-C18, `boing-ball`'s ST-13k. See the emulator note below |
| AC-14 | Prime Directive review | Below |
| AC-15 | Non-const `&` registers nothing | ST-15g — a mutable module array and a function, both fold-named, produce **no** `!align` anywhere, and the folded operand still assembles to `lo(__var_Main_buf / 64)` per the symbol map |

### Plan-local criteria

| # | Criterion | Evidence |
|---|---|---|
| P-1 | Phase 1 moves no bytes | At `37038ff`: 14 goldens byte-identical, `budgets.json` unchanged, no ratchet moves, `SCOREBOARD.md` unchanged, and ST-C15 / ST-13f / ST-13j still asserting `% 256`, untouched and green |
| P-2 | The reshape weakens no negative case | Every `pageAligned: false` site became an **absent** field, never `boundary === 256`. Independently audited one-to-one by the phase review, which confirmed no test dropped and every positive case *tightened* from a boolean to the exact value |
| P-3 | No boundary outside `{64, 256}` representable | `AlignBoundary = 64 \| 256` on the parameter, the map value and the entry field — a compile error at every producer, including hand-built literals in tests |

## AC-14 — Prime Directive review

Judged as an expert 6502 developer building a commercial C64 game would judge it.

**The emitted idiom is the hand idiom.** `!align 63, 0, 0` immediately ahead of a sprite image is
exactly what a hand-written source carries, and the pointer store beside it is one `LDA #imm` /
`STA $07F8` on an operand the assembler folds. Nothing is copied, nothing is computed at runtime.

**Judged against staging-copy, not line-for-line against the twin.** The committed hand twin
`examples/balloon/balloon.asm` contains no `!align` at all — it stages the sprite into the tape
buffer with a copy loop. In-place-plus-align is the better trade on both axes a game developer
counts: it spends 19 bytes of padding once at link time instead of a copy loop's bytes *and* its
cycles every run, and it frees the tape buffer. A developer who wanted the copy would still write
it; the compiler no longer forces it.

**The refusal is as important as the rule.** `lo(&X / 16384)` reads which VIC bank an address sits
in — a question answered correctly wherever the image lands. Honoring it as a placement demand
would spend up to 16 KB of padding to answer a question, and the allowlist declines it by design
rather than by accident. The doc comment on `boundaryOfShift` carries that reasoning in plain
language, so the next person to widen the allowlist has to argue past it.

## The emulator tier

Stated plainly rather than buried: AC-13's gated VICE run covers `balloon` and `boing-ball` — the
two programs whose image address this change does **not** move. `balloon-color`, the one image that
does move, is build-tier only, and its hardware correctness in CI rests on ST-13f's
assembled-pointer oracle.

A **one-off manual VICE look was taken at closeout and is recorded here**. Built and run on VICE
3.10, `balloon-color`'s image resolves to `$0980` (block 38); at the second frame-body arrival the
sprite-0 pointer at `$07F8` holds **38**, sprite 0 is enabled at `$D015`, and all 63 image bytes
live at `$0980` match the committed `balloon.bin` byte-for-byte. It is not gated, because nothing
in CI could re-run it.

## What the red phase caught, and what it could not have

This feature manufactures unfailable guards: 64- and 256-byte boundaries coincide on most real
addresses, so several correct new assertions were already green before the implementation existed.
Every one of them — ST-15b's `% 64` half, ST-15d (a) and (c), ST-15e, ST-15g, and the `% 64` clause
of all three re-derived oracles — was **perturbed once and watched to fail**, then restored. All 11
failed. An unfailable guard is worse than no guard, and the only reason to believe these are guards
is that they were made to fail on purpose.

The three re-derived oracles went red on their **directive-text clause alone**, exactly as
predicted: every one of the three images was already page-aligned, and a multiple of 256 is a
multiple of 64.

## Follow-ups, unowned by this RD

- [#74](https://github.com/blendsdk/blend65/issues/74) — the fold-site warning for a `&` on an
  SFA-placed mutable buffer, whose demand parameter is inert by design (AC-15) and which therefore
  gets no diagnostic today.
- RD-15's Should-Have — sourcing the granularity allowlist from the platform rather than a literal
  in lowering. Excluded here for zero behaviour change; a second granularity (charset 2048) is what
  should motivate the threading.
