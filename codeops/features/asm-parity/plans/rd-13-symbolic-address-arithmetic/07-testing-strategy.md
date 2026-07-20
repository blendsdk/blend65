# Testing Strategy

> **Verify** (AR #95): `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

**CI** = runs on every push (ACME installed, **no** emulator — AR-27). **Local** =
`skipIf(!hasVice())`, proven locally, never in CI.

## Specification-first ordering — non-negotiable

Every phase runs `spec tests → verify RED → implement → verify GREEN → impl tests → full verify`.
A spec test is never edited to make an implementation pass. The four re-derived tests below are
**re-derivations against a named source**, each recorded with that source in its own header, and
each one loses only the expectation the source contradicts.

> **No plan, requirement, task or issue ID appears in any test file, test title, or code comment.**
> Where a test derives from the frozen spec, it cites the `spec/` path — that is a permanent
> repository artifact, not a planning one.

## New specification tests

| ID | Assertion | Input → expected | Tier | AC |
|---|---|---|---|---|
| **ST-13a** | `hi(&X)` costs one instruction | `poke($07F8, hi(&X) * 4)` → emitted asm contains `LDA #>__data_Main_X`, then `ASL`,`ASL`,`STA`; contains **no** store or reload of a `__frame_*_0sc*` slot | CI · codegen | AC-1 |
| **ST-13b** | `lo(&X)` costs one instruction | `poke($07F9, lo(&X))` → `LDA #<__data_Main_X` · `STA`; no frame-slot traffic | CI · codegen | AC-1 |
| **ST-13c** | `W10172` does not fire on a **user-written** power-of-two multiply | `let x: byte = peek($D012); poke($D020, x * 4)` → no `ShiftAndAddMultiply` diagnostic; the two `ASL`s are pinned present | CI · codegen | AC-7 |
| **ST-13d** | `lo(&X / 2^k)` folds and means the right thing | `poke($07F8, lo(&X / 64))` → exactly one `LDA #<(__data_Main_X / 64)`; **no** `JSR __rt_div16`, no `W10171`; **assembled byte at `$07F8` == `(symbolMap(X) / 64) & 0xFF`** | CI · harness (ACME) | AC-4 |
| **ST-13e** | `>>` and `/` converge on one operand | `poke($07F8, lo(&X >> 6))` builds — no `E90001` — and its assembled byte equals ST-13d's | CI · harness (ACME) | AC-5 |
| **ST-13f** | `balloon-color` builds and points at its own sprite | assembles; `__data_Main_BALLOON % 256 == 0` and `< $1000`; assembled `$07F8` byte == `(addr / 64) & 0xFF` | CI · harness (ACME) | AC-6 |
| **ST-13j** | `boing-ball` builds and its four pointers are one block apart | assembles; `__data_Main_BALL % 256 == 0` and `< $1000`; assembled `$07F8`..`$07FB` bytes == `b, b+1, b+2, b+3` where `b = (addr / 64) & 0xFF` | CI · harness (ACME) | AC-6 |
| **ST-13g** | M1 is uniform across all four operand kinds | `hi`/`lo` of a module variable, a **local**, a const aggregate and a function each emit one byte-select of `__var_*` / `__frame_*` / `__data_*` / the entry label | CI · codegen | AR #91 |
| **ST-13h** | the fold's edges behave as specified | `lo(&X / 1)` and `lo(&X >> 0)` emit M1's plain `LDA #<sym` (not `#<(sym / 1)`); `lo(&X / 40)` and `lo(&X >> 16)` are **byte-identical to today's** emission and still carry today's diagnostics | CI · codegen | AR #89 |
| **ST-13i** | a named const divisor folds | `const BLOCK: byte = 64; poke($07F8, lo(&X / BLOCK))` → the same single `LDA #<(__data_Main_X / 64)` as the literal form | CI · codegen | AR #90 |

**ST-13d's oracle is the assembled byte, not the operand's presence.** RD-03's `!align 256, 0` trap
showed that a plausible-looking operand can assemble cleanly and mean something else. The
`mod 256` is not pedantry either: for `X >= $4000` the quotient exceeds a byte and the truncated
value is the correct within-bank block, so an assertion written without it would fail a correct
emission.

**ST-13e is not circular** because ST-13d anchors the shared value externally against the symbol
map. If ST-13d is ever weakened to an operand-presence check, this pair becomes circular and both
must be revisited.

## Re-derived specification tests

| Test | Currently pins | Re-derived from | Becomes | Phase |
|---|---|---|---|---|
| **ST-51a** `translate-indexed.spec.test.ts:112,121` | `W10172` fires on a compiler-generated 2-byte element scale | `spec/evaluations/F017-operators.md:442` | the diagnostic is **absent**; `ASL` present and `__rt_mul8` absent both unchanged | 1 |
| **ST-T16** `translate.spec.test.ts:458,470` | `W10172` fires on a power-of-two multiply | `spec/evaluations/F017-operators.md:442` | `.not.toContain(…)`; the exact `LDA a`/`ASL`×3/`STA r` text at `:466-469` unchanged | 1 |
| **ST-9b** `lower-address-of.spec.test.ts:157-174` | `store &Main_helper, …_0sc0` / `load i8u …_0sc1+1` — frame-slot homing for `lo(&fn)`/`hi(&fn)` | M1 | no homing store, no slot reload; the IL carries the byte-select operand directly **and** the positional slot claim is proven still standing — see below | 2 |
| **module header** `lower-address-of.spec.test.ts:6-10` | prose: *"In every other position (ALU arithmetic, `lo`/`hi` extraction) the address is first homed into a synthetic word frame slot"* | M1 | `lo`/`hi` extraction is removed from that sentence; ALU arithmetic still homes | 2 |
| **ST-C14** `balloon.spec.test.ts:166-181` | ordered subsequence `LDA #>__data_Main_BALLOON`·`ASL`·`ASL`·`STA $07F8` | M2 + AC-6 | the two-instruction subsequence `LDA #<(__data_Main_BALLOON / 64)`·`STA $07F8` | 4 |

### ST-9b carries AC-3, and this is the correction the RD preflight forced

AC-3 proves the positional slot counter never shifted. The authored RD named
`model-adapter.spec.test.ts` — a `packages/frontend/src/sfa/` suite that exercises only
`lex → parse → analyze → modelToFunctionInfo`, cannot import codegen (R15 forbids it), and has
**no `&` fixture at all**. It could not fail for the risk it was gating.

The proof is codegen-side, in the re-derived ST-9b, whose program is extended to contain a `hi`/`lo`
site **followed by a plain-store `&` site in the same function**:

```
function main(): void {
  poke($C000, lo(&helper));      // claims 0sc0 — claimed, never written
  poke($C001, hi(&helper));      // claims 0sc1 — claimed, never written
  vec = &helper;                 // plain store — must still receive 0sc2
}
```

The assertion is that the trailing plain-store site still names `0sc2`. If M1 dropped the claim,
that site would collect `0sc0` and this test fails loudly. The frontend suite stays green as
context, **not** as proof.

## Tests that must NOT change

| Test | Why it stays exactly as written |
|---|---|
| **ST-C15** `balloon.spec.test.ts:184-195` | AC-2's entire proof. `addr % 256 == 0` and `addr < $1000` is what fails if any path shortcuts `lowerAddressOf` and loses the page-alignment mark. `balloon` has no golden — this is the only thing watching |
| **ST-51b** `translate-indexed.spec.test.ts` | a 3-byte element scale still calls `__rt_mul8` with `W10170`. Untouched by M3 |
| **ST-9** `lower-address-of.spec.test.ts:140-155` | `&m + 2` still homes through a word slot — ALU arithmetic is not in M1's scope, and this proves the boundary |
| **ST-R15a/b/c** `test/boundary.spec.test.ts` | AC-12. Nothing here adds a codegen import anywhere |
| the 14 committed goldens | byte-identical through Phases 1 and 3; only `balloon`'s numbers move, and it has no golden |

## Implementation tests

| Area | Coverage |
|---|---|
| `addrByteOf` / `isAddrByte` | construction, `IL_BYTE` typing, absent-vs-present `shift`, `toEqual` stability |
| `symbolExpr` / `isSymbolExprOperand` | construction; `symbolText` renders `<(sym / 64)` and `>(sym / 64)` for `k = 1..15` |
| `instrOperandFor` | maps shift-absent → `symbolRef`, shift-present → `symbolExpr`; the one mapping site both representations flow through |
| `log2Exact` after its move to `bits.ts` | behaviour unchanged — the existing cases, relocated |
| the three ICE guards | each fires on a deliberately malformed operand |

## Per-phase red/green

| Phase | RED before implementing | GREEN after |
|---|---|---|
| 1 · M3 | ST-51a, ST-T16 re-derived; ST-13c written | full suite; **zero** byte movement anywhere |
| 2 · M1 | ST-13a, ST-13b, ST-13g, ST-9b + header | full suite; ST-C15 still green (AC-2); `balloon` ratchet re-derived |
| 3 · M2 | ST-13d, ST-13e, ST-13h, ST-13i | full suite; **zero** byte movement — the operand is built unwired |
| 4 · AC-6 | ST-13f, ST-13j; ST-C14 re-derived | full suite; goldens + ratchets + `SCOREBOARD.md` in the same commit |
| 5 · ledgers | the `twins.json` structural check | full suite; local VICE tier for AC-10 |

**Phase 3 moving zero bytes is a deliberate proof.** The fold operand lands with no `examples/`
source using it, so the 14 byte-identical goldens are a free confirmation that M2 changed nothing
it was not asked to change — the same build-unwired-then-wire discipline RD-05 used.

## Guards against the known traps

| Trap | Guard |
|---|---|
| a path reaching a byte-select without `lowerAddressOf` → silently unaligned sprite | ST-C15, run from Phase 2 onward; the three ICE guards (AR #92) |
| ACME precedence: `#<(sym+3 / 64)` assembles silently to `0x00` | the operand has **no offset field** — unrepresentable, not merely unrendered |
| a plausible operand that assembles to the wrong byte | ST-13d/e/f assert the **assembled byte** against the symbol map, never operand presence |
| ratchet/scoreboard staleness → CI-red by construction | source, ratchet, goldens and `SCOREBOARD.md` in one commit per byte-moving phase |
| a test that passes vacuously | ST-13c is AC-7's witness precisely because the migrated `balloon` has no multiply left |
| a claim asserted rather than proven | each of ST-13a, ST-13d and ST-C15 is **seeded and watched to fail** before being accepted as green |
