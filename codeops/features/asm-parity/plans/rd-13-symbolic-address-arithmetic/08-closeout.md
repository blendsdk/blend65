# Closeout — Symbolic Address Arithmetic

> **Implements**: asm-parity/RD-13 · [99-execution-plan.md](99-execution-plan.md)
> **Commit range**: `c910975..HEAD` — 5 phases, one commit each, plus one spin-off doc commit.

## What landed

An address is a link-time constant, and the assembler resolves arithmetic on it for free. The
compiler was doing that arithmetic at run time. Three forms, three failures, all measured before
anything changed:

| Source | Was | Now |
|---|---|---|
| `hi(&X)` / `lo(&X)` | 16-bit address homed into a scratch frame slot, one byte read back out | one immediate byte-select |
| `lo(&X / 64)` | `JSR __rt_div16` — a runtime 16-bit software division of a link-time constant | `LDA #<(sym / 64)` |
| `lo(&X >> 6)` | `E90001`, no emission at all | the same operand as the `/` form |
| a power-of-two multiply | `W10172`, which the frozen spec forbids verbatim | no diagnostic |

End to end, the sprite-pointer idiom went **18 bytes / 24 cycles → 5 bytes / 6 cycles**.

## The headline result, and the honest half of it

`balloon`'s sprite-pointer store is now **instruction-for-instruction identical to its
hand-written twin**:

| | |
|---|---|
| twin (`examples/balloon/balloon.asm`) | `lda #13` · `sta $07f8` — block number counted by hand |
| compiled | `LDA #<(__data_Main_BALLOON / 64)` · `STA $7F8` |

Two instructions, 5 bytes, 6 cycles on both sides. The difference is only who supplies the
constant, and the version the assembler computes is the one that cannot go stale when the image
moves. That divergence row is **gone from the ledger entirely** — not re-routed, eliminated.

**The corpus byte total did not decrease, and that is the finding, not an omission.** `balloon`'s
sprite image is page-aligned, so every byte this RD removed from its code was absorbed by
`!align 256` padding growing to match: 6 B → 19 B. The binary is 318 bytes before and after.

| | before | after |
|---|---|---|
| `balloon` code stream | 237 B | **224 B** |
| `balloon` page padding | 6 B | **19 B** |
| `balloon` total | 318 B | 318 B |
| corpus bytes | 3257 | 3257 |
| `balloon` static cycles | 300 | **282** (1.21× → **1.14×**) |
| corpus static cycles | 4237 | **4219** (4.66× → **4.64×**) |

This is not a defect in the work, but the obvious consolation for it is **false, and was written
into this document before being checked**. It is not the case that 64-byte alignment
([#69](https://github.com/blendsdk/blend65/issues/69), RD-15) would recover these 13 bytes.
`balloon`'s code ends at `$08ED` and its image sits at `$0900`; `$0900` is a multiple of 64 as well
as of 256, so the pad is **19 bytes under either alignment**. Before this RD the code ended at
`$08FA` and the pad was 6 under either. RD-15 converts **zero** of these 13 bytes on this layout:

| | code ends | pad @256 | pad @64 |
|---|---|---|---|
| before | `$08FA` | 6 | 6 |
| after | `$08ED` | 19 | 19 |

The true argument for RD-15 is a different one, and weaker on this program than on its neighbour.
Page alignment leaves a pad anywhere in 0–255 and 64-byte alignment bounds it at 0–63, so the
*expected* cost drops fourfold — but `balloon` currently sits at 19 either way, which is luck, and
the ledger's own note says that number "re-rolls anywhere in 0-255 when unrelated code sizes
shift". The measured demonstration is `examples/balloon-color`: **193 bytes of padding at page
alignment, 1 byte at 64**. RD-15 was blocked on this RD because `&X / 64` had to fold first, and it
is now unblocked — but this RD's byte result stands on its own as unrecovered, not as deferred.

## Acceptance criteria

| AC | Verdict | Evidence |
|---|---|---|
| **AC-1** `hi(&X)`/`lo(&X)` cost one instruction each, both halves asserted | ✅ | ST-13a, ST-13b (`codegen/src/instr/address-byte.spec.test.ts`) — one `#>`/`#<` select each, and no scratch-slot instruction anywhere in the emission |
| **AC-2** alignment survives — the image is still page-aligned | ✅ | ST-C15 (`balloon.spec.test.ts`) green in every phase. **Seeded code-side**: dropping the alignment mark landed the sprite at `$08EF` (239 mod 256) and both ST-C15 and the VICE pointer check failed. Restored |
| **AC-3** the positional slot counter never shifted, proven codegen-side | ✅ | re-derived ST-9b (`lower-address-of.spec.test.ts`) — the two byte-select sites still **claim** their slots, and a trailing homing `&helper + 2` still names `_0sc2`. It would name `_0sc0` if the claims had been dropped |
| **AC-4** `lo(&X / 2^k)` folds; assembled byte = `(addr ÷ 64) mod 256` | ✅ | ST-13d (`test-harness/src/symbolic-address.spec.test.ts`) reads the byte back out of the **linked binary** and compares it against the symbol map. It reads **36** = `$0900 / 64`. Seeded with a one-off and watched to fail |
| **AC-5** `lo(&X >> k)` folds and agrees byte-for-byte with the `/` form | ✅ | ST-13e — anchored externally against the symbol map first, so the pair is not circular |
| **AC-6** all three examples migrate; the two demos built and checked in CI | ✅ | ST-13f, ST-13j; `examples-coverage.json`'s `pendingSuite` waiver list is **empty**, and each demo is named to a real suite that compiles it through `build()` + ACME. ST-13k on VICE 3.10 covers boing-ball's run-time half |
| **AC-7** `W10172` conforms to OP-5, witnessed by a program that still has a multiply | ✅ | re-derived ST-51a and ST-T16 against `spec/evaluations/F017-operators.md:442`; ST-13c is the surviving witness — `peek($D012) * 4` pins exactly two `ASL`s, no `__rt_mul8`, and the absence of both multiply diagnostics. It compiles its own inline source, so Phase 4 removing `balloon`'s multiply did not make it vacuous |
| **AC-8** no fixture regresses; ratchets re-derived; freshness gate green | ⚠️ **split** | *"No individual fixture grows"* — ✅, budget tier green in every phase, no ratchet raised, `budgets.json` untouched (`balloon` re-derives to the same 318). *"Corpus total strictly decreases"* — ❌ **on bytes** (3257 → 3257, absorbed by padding as above), ✅ **on cycles** (4237 → 4219). Stated rather than reconciled |
| **AC-9** the routing ledger is true | ✅ | 53 → **52** routed rows: `balloon`'s symbolic-address row deleted because its divergence no longer exists, 16 re-routed to [#70](https://github.com/blendsdk/blend65/issues/70). A structural check in `twin-manifest.spec.test.ts` now asserts **no row carries `issue: 58`**, flatly. Written first and watched failing on all 17 |
| **AC-10** `balloon` still renders on VICE 3.10 | ✅ | the local emulator tier passes unchanged — shared observables at the stopped 2nd frame-body arrival, plus ST-C18's pointer and in-place image checks |
| **AC-11** `spec/` untouched | ✅ | `git status --porcelain spec/` empty at every commit in the range. M3 is a *removal* of non-conformant behaviour, not a spec revision |
| **AC-12** the repo-root boundary tier green | ✅ | 33/33 in every phase's verify |

## Ledger changes

| Change | Rows |
|---|---|
| deleted — the divergence no longer exists | 1 (`balloon` / instruction selection) |
| re-routed `#58` → `#70` | 16 (8 instruction-selection + 8 layout, across eight slices) |
| re-authored from measurement | 3 (`balloon`'s remaining rows: LDA 33 vs 27 / STA 24 vs 21; code 224 vs 176; non-code 94 vs 75) |

**The three re-authored rows are the cautionary tale of this closeout.** Only one was in the plan.
Phase 4's review found two more that were stale by the migrated bytes — and the correction it
proposed was itself wrong, because it accounted for Phase 4's 2 bytes and not Phase 2's 11. The
committed numbers come from `yarn twin:diff`, run against the final build. The generator's
stale-key abort could not have caught any of it: it is category-granular, and every category still
had backing rows. *"Re-author from measurement"* has to mean the tool, not arithmetic.

**#58 stays open.** It no longer owns a routed row, but its remaining audit halves are unaffected.

## Decisions taken during execution

| # | What |
|---|---|
| **AR #100** | The shrink pushed `balloon`'s `!align` padding past 8 bytes, so ACME truncated its report byte column with `...`; the column then exactly filled its width, and a **column-zero** directive supplies no leading space, so the two columns touched and `parseReportFile`'s whitespace split swallowed the directive. A pre-existing defect nothing had ever triggered. Fixed by splitting on the truncation marker, with a regression test — because the trigger is a size coincidence that Phase 4 could just as easily have undone |

## Spin-offs

| Issue | Why |
|---|---|
| [#73](https://github.com/blendsdk/blend65/issues/73) | Every `lo(&X)`/`hi(&X)` still **claims** a 2-byte scratch slot it no longer reads or writes — 4 B of dead frame RAM per pair, zero binary bytes. The claim is deliberate: it keeps the positional slot counter aligned between the SFA planner and lowering, so retiring it must move both sides at once. Raised by Phase 2's review |

## Reviews

Four phase reviews on a different model family. **No critical findings.** One major — Phase 4's
stale ledger rows, ruled on and folded into Phase 5's scope. The rest were minor and all applied:
a file header that misdescribed its own contents, an ICE test that asserted "some ICE fired"
rather than naming its guard, two Prettier spots, a builder type named inconsistently with its
siblings, and one real gap in ST-13k — the four sprite pointers were proven consecutive and the
base proven correct, but nothing tied them together, so four consecutive bytes of garbage would
have passed.

The most valuable finding was Phase 3's: `foldedAddressByte` discarded a potential address offset
silently. No address-of form produces one today, so no test could have caught it — but ACME binds
`/` tighter than `+`, so `#<(sym+3 / 64)` divides the 3 and assembles cleanly to the wrong byte.
That is the exact failure class the operand's missing offset field was designed to make
unwritable, resurfacing at the one boundary a type cannot police. It now raises.
