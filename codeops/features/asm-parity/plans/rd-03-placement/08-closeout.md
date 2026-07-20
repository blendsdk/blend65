# Closeout — Placement (RD-03)

> **Implements**: asm-parity/RD-03 · [#49](https://github.com/blendsdk/blend65/issues/49) (placement slice)
> **Commit range**: `9534760..6ad9fdb` (7 commits, one per phase plus two review follow-ups)
> **Status**: all 41 tasks complete; every acceptance criterion walked against committed artifacts

---

## What shipped

A `const` aggregate whose address is taken with a source-level `&` is emitted at a 256-byte
boundary. `examples/balloon` stops copying its sprite 63 bytes at a time into the tape buffer and
points the VIC at the embedded image itself.

| | Before | After |
|---|---|---|
| balloon, assembled | 677 B | **318 B** |
| ratio vs the hand-written twin | 2.70× | **1.27×** |
| `__data_Main_BALLOON` | `$0A67` | **`$0900`** (sprite block 36) |
| runtime sprite copy | 63 stores at startup | **none** |
| corpus total | 3616 B / 4724 cyc | **3257 B / 4237 cyc** |
| corpus ratio | 3.93× / 5.20× | **3.54× / 4.66×** |

The compiler now beats the twin at **runtime** — the twin still copies 63 bytes at startup — and
remains behind it on **bytes**. Both statements are true and neither survives alone.

## Acceptance criteria

| AC | Tier | Verdict | Evidence |
|---|---|---|---|
| **AC-1** — address-taken const is page-aligned, below `$1000`, via a directive | CI | ✅ | ST-C15: `__data_Main_BALLOON` = `$0900`, `% 256 === 0`, `< $1000`. Emission is the `!align 255, 0, 0` directive (ST-C11), not a computed address |
| **AC-2** — M1's exclusions hold on named negative controls | CI | ✅ | `git diff 9534760..HEAD -- '*.asm.golden'` empty. `slice7b`, `slice8b` (by-ref const data) and `slice8` (`&onIRQ`) byte-identical. `slice7` correctly **not** cited — it reads `__data_Gfx_TABLE,X` directly indexed and materializes no address |
| **AC-3** — `hi(&X) * 4` names the sprite block | CI | ✅ | ST-C14 asserts the ordered subsequence `LDA #>__data_Main_BALLOON` … `ASL` … `ASL` … `STA $7F8` on the emitted asm. ST-C13 asserts `hi(addr)*4 === addr/64` on a real resolved address. `$0900 < $4000`, so the bounded region holds |
| **AC-4** — balloon copies nothing | CI | ✅ | ST-C14: no `STA` anywhere in `$0340–$037E`; the 63-byte asset appears in the binary exactly once |
| **AC-5** — renders correctly on VICE 3.10 | Local | ✅ | ST-C17: the eight source-mandated observables pass unchanged. ST-C18: `peek($07F8) === addr/64` and the 63 bytes at `addr` equal the committed asset, both symbol-resolved. Twin tier 19/19 green against the **unmodified** twin |
| **AC-6** — no fixture regresses | CI + review | ✅ | All 15 fixtures re-measured from the aligned build: 14 unchanged to the byte, balloon 677 → 318. The only `budgets.json` change in the whole range is balloon's `bytes`. Corpus total 3616 → 3257 — strictly decreased. Freshness gate clean and idempotent |
| **AC-7** — the new emission has a discriminating artifact | CI | ✅ | `examples/align-mixed/` + `align-mixed.spec.test.ts` (ST-C11–ST-C13), built through the real facade and real ACME, no golden. RD-05's `golden-layout.spec.test.ts` 43/43 green over the regenerated corpus |
| **AC-8** — balloon's routing ledger re-audited | CI | ✅ | All four rows re-authored from measurement; `sourceForced` dropped and the `copy()`-gap attribution retired (ST-C20 pins both mechanically). The honest decomposition is below |
| **AC-9** — `spec/` untouched | Review | ✅ | `git status --porcelain spec/` empty **and** `git diff --name-only 9534760..HEAD -- spec/` empty across all 7 commits. No new syntax: only `embed`, `&`, `hi`, `poke` as frozen v3.0 already defines them |
| **AC-10** — boundary holds | CI | ✅ | `test/boundary.spec.test.ts` 3/3 green (R15 / AR-20) |

## The residual, decomposed honestly

318 − 251 = **67 bytes**, and it splits cleanly:

| Part | Bytes | Where it goes |
|---|---|---|
| Code stream | **+61** (237 vs 176) | Redundant load/store → [#52](https://github.com/blendsdk/blend65/issues/52); address materialization → [#58](https://github.com/blendsdk/blend65/issues/58) |
| Non-code | **+6** (81 vs 75) | Page-alignment padding — the only byte cost placement itself adds |

The padding is an **accident of where the image lands**. It re-rolls anywhere in 0–255 when
unrelated code sizes shift, so 6 is today's number and not a property of the feature. Nothing
reports it — [#67](https://github.com/blendsdk/blend65/issues/67).

The two programs now use **different legitimate idioms**, which is what makes 1.27× a true
statement rather than a flattering one. The twin stages its image into the tape buffer below the
PRG load address: a single-load PRG cannot place there, so this is unreachable by placement and buys
file size. The compiled program aligns its image and reads it in place, which buys runtime. Neither
is the defect version of the other.

## Divergences carried, not hidden

Both are attributed to [#58](https://github.com/blendsdk/blend65/issues/58) /
[#60](https://github.com/blendsdk/blend65/issues/60), not to placement.

**1. `hi(&X) * 4` materializes the whole address first — 8 instructions where a hand-coder writes 4.**

```asm
; emitted today
LDA #<__data_Main_BALLOON
STA __frame_Main_main_0sc0
LDA #>__data_Main_BALLOON
STA __frame_Main_main_0sc0+1
LDA __frame_Main_main_0sc0+1
ASL
ASL
STA $7F8

; what the twin's author writes
LDA #>balloon
ASL
ASL
STA $7f8
```

The address is homed into a synthetic word frame slot before its high byte is read, so four
instructions of pointer formation are paid for a value that was a link-time constant all along.
This is a constant-materialization defect, not a placement one — placement's own contribution is
the two `ASL`s, which are exactly what the hand-coder writes.

**2. A spurious `W10172`.** The build warns *"multiply by 4 generates a shift-and-add sequence"*.
It does not: it generates `ASL` / `ASL`. The warning is wrong about code the compiler itself
emitted.

ST-C14 asserts the pointer store as an **ordered subsequence**, deliberately, so that when #58
tightens this shape the test moves with it rather than blocking it.

## Execution-time decisions

Two runtime ambiguities were raised, resolved with the user, and back-propagated — AR #76 and
AR #77 in [`00-ambiguity-register.md`](00-ambiguity-register.md).

- **AR #76** — the const-data flag was renamed `aligned` → `pageAligned`. On a 6502 target
  "aligned" reads as sprite block, character set or page, and page-vs-block was live enough that
  AR #68 had to settle it.
- **AR #77** — retiring balloon's false `sourceForced` broke two spec-tier assertions in
  `test/gen-parity-scoreboard.spec.test.ts`. The `**source-forced**` check was reaching a generator
  capability through whichever corpus pair happened to carry the flag; it moved onto the staged
  synthetic manifest in the same suite. **Recorded as a preflight gap**: the plan preflight
  identified this exact hazard and cleared `twin-manifest.spec.test.ts` for it, but did not reach
  the second file, which asserts against the *committed* scoreboard.

## What the phasing bought

Phases 1–3 were corpus-invariant by construction, and stayed so. No fixture took a const array's
address before Phase 4, which made the 14 byte-identical goldens a **free proof that the marking
rule excludes by-reference arguments** — the RD-stage preflight's most dangerous finding, since
`&X` and a by-ref argument emit the identical IL `addrOf` operand. Had the rule been wrong, it
would have surfaced against a byte-exact oracle rather than tangled up in balloon's own 359-byte
delta.

Three claims were **seeded and watched to fail** rather than asserted:

| Claim | Seeded | Observed |
|---|---|---|
| ST-C12 is the operand-trap oracle | rendered `!align 256, 0` | build succeeded, directive present and correctly placed, ST-C11's placement clause passed — **ST-C12 alone failed**, address stayed at `…3E` |
| ST-C18 really asserts on VICE | expected pointer `+1` | failed with `expected [0x25], was [0x24]` — a real read of real emulator memory |
| ST-C14 catches the copy | ran against the pre-rewrite program | failed on `STA $340`. An earlier draft used the padded `$0340` and matched nothing — the serializer emits shortest-fit hex, so that draft would have passed vacuously |

## Review finding worth recording

The Phase 4 review caught that the observable split was **one-sided**, and it was right.

The sprite pointer and image bytes were removed from the shared table on the grounds that the
address is allocator-chosen — true for the *compiled* program, and false for the twin, whose own
source hardcodes `lda #13 / sta $07f8` and `sta $0340,x`. ST-C18 restored the checks for the
compiled side only, so for a window the twin's sprite display was asserted **nowhere**: a broken
copy loop would have passed the twin tier while the reference program showed garbage — and that
twin is the 251-byte denominator behind every ratio in `SCOREBOARD.md`.

Fixed by giving `PairTable` a `twinExtraChecks` field: checks the twin's source mandates but the
compiled program does not, run against the twin alongside the shared eight. The asymmetry is now
explicit in the type rather than implied by a comment — and the comment that claimed "the twin has
no equivalent" was simply wrong and has been corrected. Seeded and watched to fail: expecting
block 14 fails with `expected [0x0e], was [0x0d]`.

The general lesson: when a shared contract shrinks because one side changed, the rows that leave
it still belong to whichever side still mandates them. Dropping them from the shared table is only
half the move.

## Known gaps left open

| Gap | Where |
|---|---|
| Padding is invisible — no report, no diagnostic | [#67](https://github.com/blendsdk/blend65/issues/67) |
| No residency check: an aligned array landing in the char-ROM shadow or outside the VIC bank is undiagnosed. AC-1 pins balloon only | [#68](https://github.com/blendsdk/blend65/issues/68) |
| `hi(&X)` codegen and the spurious `W10172` | [#58](https://github.com/blendsdk/blend65/issues/58) / [#60](https://github.com/blendsdk/blend65/issues/60) |
| Cross-module `&` of a const is rejected upstream (`E10042` — a qualified name parses as a field access). Pre-existing, unchanged here; pinned by an impl test so it cannot start compiling unnoticed | — |
| Cumulative padding across many aligned arrays is specified but has no built fixture | [03-01](03-01-directive-and-marking.md) §4 |

`copy(dst, src, count)` (FUT-012) and `@align(n)` (FUT-014) remain out of scope — both need a
`spec/` edit and a Language-Guard evaluation.

## Still open

**#49 stays open.** This RD is its **placement slice** only; the wider slice — runtime-address
`poke`, the const-evaluated half, format handlers — is untouched.

**Task 5.6 — posting the area report on #49 — is outward-facing and was not done.** It requires an
explicit go-ahead and is not covered by an auto-commit run.
