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
| **ST-13j** | `boing-ball` builds and its block number is still a usable block base | assembles; `__data_Main_BALL % 256 == 0` and `< $1000`; the **`base` initializer immediate** == `(addr / 64) & 0xFF`; the `ADC #1`/`#2`/`#3` → `STA $07F9`..`$07FB` chain present | CI · harness (ACME) | AC-6 |
| **ST-13k** | the four pointers land one block apart **at runtime** | run `boing-ball`; `peek($07F8..$07FB)` == `b, b+1, b+2, b+3` for the current frame | **Local** · VICE 3.10 | AC-6 |
| **ST-13g** | M1 is uniform across all four operand kinds **and every consumer position** | `hi`/`lo` of a module variable, a **local**, a const aggregate and a function each emit one byte-select of `__var_*` / `__frame_*` / `__data_*` / the entry label. Plus the three non-`poke` positions, each of which compiles today and must keep compiling: `table[lo(&X)]` (**index**, AR #97) → `LDX #<__data_Main_X`; `let b: byte = lo(&X);` (**`let` initializer**, AR #99) and `v = hi(&X);` (**assignment**, AR #99) → `LDA #<`/`#>` then a single `STA`, with no frame-slot traffic in any of them | CI · codegen | AR #91, #97, #99 |
| **ST-13h** | the fold's edges behave as specified | **degenerate ends**: `lo(&X / 1)` and `lo(&X >> 0)` emit M1's plain `LDA #<sym`, not `#<(sym / 1)`. **`k >= 8` folds**: `lo(&X / 256)` → `#<(sym / 256)` and `lo(&X / 32768)` → `#<(sym / 32768)`. **Rejected forms**: `lo(&X / 40)` stays byte-identical to today's emission and still warns `W10171`; `lo(&X >> 16)` still warns **`W10174`** and still hard-errors `E90001` with **no emission** | CI · codegen | AR #89 |
| **ST-13i** | a named const folds for **both** operators | `const BLOCK: byte = 64; poke($07F8, lo(&X / BLOCK))` **and** `const SHIFT: byte = 6; poke($07F8, lo(&X >> SHIFT))` → the same single `LDA #<(__data_Main_X / 64)` as the literal forms. The `>>` half is the one that matters more: an unresolved named divisor is merely slow, an unresolved named **count** is a hard `E90001` | CI · codegen | AR #90 |

**ST-13d's oracle is the assembled byte, not the operand's presence.** RD-03's `!align 256, 0` trap
showed that a plausible-looking operand can assemble cleanly and mean something else. The
`mod 256` is not pedantry either: for `X >= $4000` the quotient exceeds a byte and the truncated
value is the correct within-bank block, so an assertion written without it would fail a correct
emission.

**How the assembled byte is actually read.** No harness helper reads "the byte at an address"
outside the VICE tier. `testing/balloon.ts` exposes `symbolMap`, `asmText` and `binary`, so the
oracle for ST-13d/e/f is a scan of `result.binary` for the immediate feeding the store —
`A9 xx 8D F8 07` (`LDA #xx` · `STA $07F8`) — with `xx` compared against
`(symbolMap(X) / 64) & 0xFF`. Naming the mechanism here is deliberate: without it the cheap way to
make these green is the operand-presence check the paragraph above forbids.

**ST-13e is not circular** because ST-13d anchors the shared value externally against the symbol
map. If ST-13d is ever weakened to an operand-presence check, this pair becomes circular and both
must be revisited.

**Why ST-13h carries `k = 8` and `k = 15` cases.** AR #89 deliberately took `k = 1..15` over
`k = 1..7`, but every other fold case in this plan uses `k = 6`. The exposure is specific rather
than theoretical: the only existing `log2Exact` call site masks its argument to a byte
(`translate.ts:1581`, correctly — a power-of-two *multiply* is byte-only), and that call sits beside
the function Phase 3 relocates. Carry the mask into the fold and every divisor ≥ 256 returns `null`,
falls through to the runtime divide, and **still emits `W10171`** — indistinguishable from the
designed fall-through. Nothing else in the suite would fail. A decision's extra range has to be
tested or it is not really a decision.

## Re-derived specification tests

| Test | Currently pins | Re-derived from | Becomes | Phase |
|---|---|---|---|---|
| **ST-51a** `translate-indexed.spec.test.ts:112,121` | `W10172` fires on a compiler-generated 2-byte element scale | `spec/evaluations/F017-operators.md:442` | the diagnostic is **absent**; `ASL` present and `__rt_mul8` absent both unchanged | 1 |
| **ST-T16** `translate.spec.test.ts:457,458,470` | `W10172` fires on a power-of-two multiply | `spec/evaluations/F017-operators.md:442` | `.not.toContain(…)`; the exact `LDA a`/`ASL`×3/`STA r` text at `:467-469` unchanged; the `:457` comment rewritten with it | 1 |
| **ST-9b** `lower-address-of.spec.test.ts:157-174` | `store &Main_helper, …_0sc0` / `load i8u …_0sc1+1` — frame-slot homing for `lo(&fn)`/`hi(&fn)` | M1 | no homing store, no slot reload; the IL carries the byte-select operand directly **and** a trailing homing `&` site still names `0sc2` — see below | 2 |
| **module header** `lower-address-of.spec.test.ts:6-10` | prose: *"In every other position (ALU arithmetic, `lo`/`hi` extraction) the address is first homed into a synthetic word frame slot"* | M1 | `lo`/`hi` extraction is removed from that sentence; ALU arithmetic still homes | 2 |
| **ST-C14** `balloon.spec.test.ts:169-181` | ordered subsequence `LDA #>__data_Main_BALLOON`·`ASL`·`ASL`·`STA $07F8` | M2 + AC-6 | the two-instruction subsequence `LDA #<(__data_Main_BALLOON / 64)`·`STA $07F8`. **`:166-167` — the embed-appears-exactly-once assertions in the same block — are not part of the re-derivation and stay byte-for-byte** | 4 |

### ST-9b carries AC-3, and this is the correction the RD preflight forced

AC-3 proves the positional slot counter never shifted. The authored RD named
`model-adapter.spec.test.ts` — a `packages/frontend/src/sfa/` suite that exercises only
`lex → parse → analyze → modelToFunctionInfo`, cannot import codegen (R15 forbids it), and has
**no `&` fixture at all**. It could not fail for the risk it was gating.

The proof is codegen-side, in the re-derived ST-9b, whose program is extended to contain a `hi`/`lo`
site **followed by a slot-naming `&` site in the same function**:

```
function main(): void {
  poke($C000, lo(&helper));      // claims 0sc0 — claimed, never written
  poke($C001, hi(&helper));      // claims 0sc1 — claimed, never written
  let w: word = &helper + 2;     // HOMES — must still name 0sc2 in the IL
}
```

The assertion is that the trailing site emits `store &Main_helper, __frame_Main_main_0sc2`. If M1
dropped the claims, it would name `0sc0` and the test fails on the text.

> **The trailing site must be a homing one, and this is the second time AC-3's proof has had to be
> corrected.** A *plain store* — `vec = &helper;` — cannot carry this assertion: every plain-store
> position lowers with `direct = true` (`lower.ts:371`, `:522`, `:1079`, `:1644`, `:2518`), and the
> `direct` return at `:1870` hands back the bare address, so the emitted IL is
> `store &Main_helper, __var_Main_vec` and **the slot name never appears in the text at all**. Nor
> would drift fail elsewhere: `0sc0` is also word-typed, so `claimResultSlot`'s byte-size check
> (`:1395-1400`) passes and no ICE fires. ALU arithmetic is the one `&` position that still homes —
> `lowerUnary:1503` passes `direct = false` — which is why `&helper + 2` works and is exactly the
> shape ST-9 (`:140-155`) already asserts for `0sc0`.
>
> The RD's original AC-3 proof named a frontend suite that could not import codegen and had no `&`
> fixture. This replacement was caught at plan preflight failing the same way in a new form. The
> lesson worth keeping: a slot-counter assertion is only real if the slot **name reaches the IL
> text**.

The frontend suite stays green as context, **not** as proof.

## Tests that must NOT change

| Test | Why it stays exactly as written |
|---|---|
| **ST-C15** `balloon.spec.test.ts:184-195` | AC-2's entire proof. `addr % 256 == 0` and `addr < $1000` is what fails if any path shortcuts `lowerAddressOf` and loses the page-alignment mark. `balloon` has no golden — this is the only thing watching |
| **ST-51b** `translate-indexed.spec.test.ts` | a 3-byte element scale still calls `__rt_mul8` with `W10170`. Untouched by M3 |
| **ST-9** `lower-address-of.spec.test.ts:140-155` | `&m + 2` still homes through a word slot — ALU arithmetic is not in M1's scope, and this proves the boundary |
| **ST-R15a/b/c** `test/boundary.spec.test.ts` | AC-12. Nothing here adds a codegen import anywhere |
| **`balloon.spec.test.ts:166-167`** | the embedded sprite appears in the binary **exactly once** — the "never duplicate bytes in RAM" property. It shares an `it` block with ST-C14 and is not part of that re-derivation |
| the 14 committed goldens | byte-identical in **every** phase — no phase of this RD touches a corpus fixture. Only `balloon`, `balloon-color` and `boing-ball` change, and none of the three has a golden. A non-empty golden diff at any point is a defect to stop on |

## Implementation tests

| Area | Coverage |
|---|---|
| `addrByteOf` / `isAddrByte` | construction, `IL_BYTE` typing, absent-vs-present `shift`, `toEqual` stability |
| `symbolExpr` / `isSymbolExprOperand` | construction; `symbolText` renders `<(sym / 64)` and `>(sym / 64)` for `k = 1..15` |
| `instrOperandFor` | maps shift-absent → `symbolRef`, shift-present → `symbolExpr`; the one mapping site both representations flow through |
| `log2Exact` after its move to `util/bits.ts` | **first-time** direct coverage (it has none today — module-private, reached only through `translateMul`): 0 and negatives → `null`; 1 → 0; 2 → 1; 64 → 6; **256 → 8; 32768 → 15**; 40 → `null` |
| the three ICE guards (AR #92) | each **fires** on a deliberately malformed operand — task 2.1's green verify proves them unreachable, never that they work |
| `indexIntoX`'s `addrByte` arm (AR #97) | emits `LDX` Immediate; the trailing ICE still fires for a genuinely unhandled kind |
| `translateConst`'s `addrByte` arm (AR #99) | emits `LDA` Immediate and binds A; the existing temp/immediate ICE still fires for every other non-immediate source |

## Per-phase red/green

| Phase | RED before implementing | GREEN after |
|---|---|---|
| 1 · M3 | ST-51a, ST-T16 re-derived; ST-13c written | full suite; **zero** byte movement anywhere |
| 2 · M1 | ST-13a, ST-13b, ST-13g, ST-9b + header | full suite; ST-C15 still green (AC-2); `balloon` ratchet re-derived |
| 3 · M2 | ST-13d, ST-13e, ST-13h, ST-13i | full suite; **zero** byte movement — the operand is built unwired |
| 4 · AC-6 | ST-13f, ST-13j; ST-C14 re-derived | full suite; ratchets + `SCOREBOARD.md` in the same commit; **zero** golden diff; `balloon`'s new asm hand-reviewed against its twin |
| 5 · ledgers | the `twins.json` structural check — written **before** the rows are re-routed, and watched failing on all 17 | full suite; local VICE tier for AC-10 and ST-13k |

**Phase 3 moving zero bytes is a deliberate proof.** The fold operand lands with no `examples/`
source using it, so the 14 byte-identical goldens are a free confirmation that M2 changed nothing
it was not asked to change — the same build-unwired-then-wire discipline RD-05 used.

## Guards against the known traps

| Trap | Guard |
|---|---|
| a path reaching a byte-select without `lowerAddressOf` → silently unaligned sprite | ST-C15, run from Phase 2 onward; the three ICE guards (AR #92). **Its seed is code-side**: drop the alignment mark at `lower.ts:1863`, rebuild, watch `addr % 256 == 0` fail, restore. Perturbing the assertion instead would only prove the test executes — it would pass for any test that runs at all, and would not exercise the causal chain the hazard section stakes on |
| ACME precedence: `#<(sym+3 / 64)` assembles silently to `0x00` | the operand has **no offset field** — unrepresentable, not merely unrendered |
| a plausible operand that assembles to the wrong byte | ST-13d/e/f assert the **assembled byte** against the symbol map, never operand presence |
| ratchet/scoreboard staleness → CI-red by construction | source, ratchet, goldens and `SCOREBOARD.md` in one commit per byte-moving phase |
| a test that passes vacuously | ST-13c is AC-7's witness precisely because the migrated `balloon` has no multiply left |
| a claim asserted rather than proven | each of ST-13a, ST-13d and ST-C15 is **seeded and watched to fail** before being accepted as green |
| a decision whose extra range is never exercised | ST-13h carries `k = 8` and `k = 15` fold cases, not only the `k = 6` every other case uses |
| a slot-counter assertion that cannot observe the counter | ST-9b's trailing site **homes**, so the slot name reaches the IL text (a plain store would not — see above) |
| an oracle that cannot exist | ST-13j asserts only link-time facts; the runtime pointer values move to ST-13k on VICE |
