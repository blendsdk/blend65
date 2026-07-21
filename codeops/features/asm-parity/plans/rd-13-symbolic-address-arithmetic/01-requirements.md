# Requirements & Scope

> **Source**: [RD-13](../../requirements/RD-13-symbolic-address-arithmetic.md)
> **Register**: [AR #88–#99](00-ambiguity-register.md)

The RD owns the full requirement text. This document records only what the *plan* commits to,
where the plan **narrowed or corrected** the RD, and the acceptance criteria as the phases
discharge them.

## In scope

| ID | Requirement | Phase |
|---|---|---|
| **M1** | `hi(&X)` / `lo(&X)` materialize as a single immediate byte-select, for **all four** operand kinds `lowerAddressOf` resolves — module variable, **local**, const aggregate, function/interrupt entry label (AR #91) | 2 |
| **M2** | `lo(&X / 2^k)` and `lo(&X >> k)` fold to `#<(sym / 2^k)`, `k = 1..15`, divisor a literal **or a named const** (AR #89, #90) | 3 |
| **M3** | `W10172` stops firing on power-of-two multiplies, per `spec/evaluations/F017-operators.md:442` | 1 |
| **M4** | No fixture regresses; every `bytes` ratchet and the routing prose re-derived from the new build | 2, 4, 5 |
| **M5** | The 16 misrouted `#58` divergence rows re-route to [#70](https://github.com/blendsdk/blend65/issues/70) | 5 |
| **AC-6** | `examples/balloon`, `examples/balloon-color` **and `examples/boing-ball`** migrate to `lo(&X / 64)`; the latter two gain the first suite that compiles them (AR #93, #96, #98) | 4 |
| — | Three trailing `iceUnsupported` guards close pre-existing silent-failure holes on the paths the new operand flows through (AR #92) | 2 |
| — | `indexIntoX` gains an `addrByte` arm, so an address byte stays legal as an array index — without it `table[lo(&X)]`, which compiles today, would become an `E90001` (AR #97) | 2 |
| — | `translateConst` gains an `addrByte` arm, keeping the byte-select legal in all **ten** `materialise` positions (`let` initializer, assignment, conditional arms, indexed-store value, `&&`/`\|\|` operands, `for` init, coercion). Without it every one of them — including task 4.7's own migration target — becomes an `E90001` (AR #99) | 2 |

## Corrections this plan makes to the RD

All three are back-propagated into the RD in Phase 5, so the RD does not keep describing behaviour
the implementation does not have.

| RD text | Correction | Source |
|---|---|---|
| *"A **local** variable's `&` is out of scope only because it is already excluded upstream… `hi(&local)` is unaffected by this RD either way"* (M1) | Not true of the code. `lowerAddressOf` resolves a local to a `__frame_*` symbol (`lower.ts:1851-1853`) and `emitHi`/`emitLo` reach it through the same `isAddressOfExpr` branch, so `hi(&local)` **is** affected — beneficially. M1 is uniform across all four kinds | AR #91 |
| *"M1 needs a byte-selected address to be legal as a **load source**"* (Technical Requirements) | M1 emits no `load` at all. `emitLo`/`emitHi` return the operand **directly**, exactly as they already return `imm` for a numeric literal (`lower.ts:2534`). The IL gains a byte-typed operand kind, not a third legal position for `addr` — `addr`'s two-position rule is untouched | AR #88 |
| AC-6: *"the idiom migrates in **both** examples"*, naming `balloon` and `balloon-color` | Three examples migrate. `examples/boing-ball` landed after the RD was written and carries the same idiom in a `let` initializer | AR #96 |

## Out of scope

Carried unchanged from the RD's Won't-Have; listed here only so a phase cannot quietly grow into
one. `const` declarations naming link-time addresses (spec-blocked under D3) · non-power-of-two
divisors · `hi(&X / 2^k)` and the word-context forms · `hi(&X) * 4` full-folding · making `W10172`
fire where the spec *mandates* it ([#71](https://github.com/blendsdk/blend65/issues/71)) · fixing
the 16 re-routed rows ([#70](https://github.com/blendsdk/blend65/issues/70)) · 64-byte alignment
itself (RD-15) · `&X + n` and `&X` combined with a runtime value.

Two further boundaries this plan sets and must not cross:

- **No new diagnostics.** `k >= 16`, non-power-of-two divisors, and every word-context form keep
  today's behaviour exactly — which, measured, is **three** diagnostics and not two: `W10171` on a
  runtime divide, `W10174` on a shift count ≥ the type width, and `E90001` for both `lo(&X >> k)`
  with no consuming store and `hi(&X / 2^k)`. The last two are hard errors that emit nothing, not
  slow paths (AR #89).
- **No `spec/` edit.** `git status --porcelain spec/` stays empty in every commit (D3). M3 is a
  *removal* of non-conformant behaviour, not a spec revision.

## Acceptance criteria → phases

The RD's 12 criteria, mapped to where each is discharged. Text is the RD's except where the
corrections above widened it — AC-6 covers three examples, not two (AR #96) — and this table adds
the phase and the discharging artifact.

| AC | Discharged in | By |
|---|---|---|
| AC-1 `hi(&X)`/`lo(&X)` cost one instruction each, both halves asserted | Phase 2 | ST-13a, ST-13b |
| AC-2 alignment survives — `__data_Main_BALLOON` still page-aligned | Phase 2 (gate), re-run 4 | existing ST-C15 |
| AC-3 the positional slot counter never shifted, proven **codegen-side** | Phase 2 | re-derived ST-9b |
| AC-4 `lo(&X / 2^k)` folds; assembled byte = `(addr ÷ 64) mod 256` from the symbol map | Phase 3 | ST-13d |
| AC-5 `lo(&X >> k)` folds and agrees byte-for-byte with the `/` form | Phase 3 | ST-13e |
| AC-6 all three examples migrate; balloon-color and boing-ball built and checked in CI | Phase 4 (+ ST-13k local, 5) | ST-13f, ST-13j, re-derived ST-C14; ST-13k on VICE |
| AC-7 `W10172` conforms to OP-5, witnessed by a program that still has a multiply | Phase 1 | re-derived ST-51a, ST-T16, ST-13c |
| AC-8 no fixture regresses; ratchets re-derived; freshness gate green | Phases 2, 4 (+ review 5) | budget tier + closeout walk |
| AC-9 the routing ledger is true | Phase 5 | manifest check + closeout walk |
| AC-10 `balloon` still renders on VICE 3.10 | Phase 5 | local emulator tier |
| AC-11 `spec/` untouched | Phase 5 | closeout walk of the commit range |
| AC-12 the repo-root boundary tier green | every phase | `yarn test` |

**AC-8's split is load-bearing.** "No individual fixture grows" is a test (the budget tier fails on
`actual > budget`). "Corpus total strictly decreases" is a **review gate** — the budget tier would
pass growth accompanied by a raised ratchet, so it is walked at closeout, not asserted.

## Security

No new runtime surface, no I/O, no user input, no parsing. Two properties the plan preserves:

- **The folded operand is emitted, never parsed, and cannot carry assembler syntax.** The
  parenthesized expression *does* contain source-derived text — `constDataSymbol` interpolates the
  module name and identifier verbatim (`lower.ts:1875-1880`), as does `frameSymbol`. What makes
  injection impossible is the **identifier grammar**: `[A-Za-z_][A-Za-z0-9_]*` admits no character
  ACME treats as syntax — no `/`, `(`, `)`, whitespace or `;`. Grounding the property in the charset
  rather than in "never from source text" matters, because a future grammar widening (unicode
  identifiers, say) would invalidate it and should therefore have to revisit this line.
- **No program that builds today stops building.** Every form outside the fold's closed shape —
  `k >= 16`, non-power-of-two divisors, `hi(&X / 2^k)`, the word-context forms — keeps today's
  behaviour and today's diagnostics exactly (AR #89), and a byte-select stays legal in **every
  position that accepts it today** — index (AR #97) and all ten `materialise` positions (AR #99).
  Both were originally excluded and both would have regressed; each was caught by a preflight
  iteration rather than by a test, which is why ST-13g now pins the three non-`poke` positions
  explicitly. Out-of-bank residency stays undiagnosed as it is today, tracked by
  [#68](https://github.com/blendsdk/blend65/issues/68).

## Definition of done

All 54 tasks `[x]`, all 12 acceptance criteria walked with evidence in
[08-closeout.md](08-closeout.md), verify green, `spec/` clean, the three RD corrections
back-propagated, and the coverage manifest's `pendingSuite` list **empty**.
