# Current State: Alignment Granularity

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> All line references verified at `8a47ada`.

## What exists

One boolean, set at one site, consumed at one site, rendered at one site. The whole of today's
alignment behaviour is that chain — which is why RD-15 is an S-complexity change everywhere and
why the risk lives in the test surface rather than in the code.

```
lowerAddressOf:1864          ctx.addressTakenConsts.add(symbol)      ← the mark (const branch only)
        ↓
lowerToIL:282                pageAligned: addressTakenConsts.has(symbol)
        ↓
constDataStream:200-208      entry.pageAligned ? [align(PAGE), label] : [label]
        ↓
print-instr.ts:179           `!align ${d.boundary - 1}, 0, ${d.fill}`
```

### Relevant files

| File | Purpose | Changes needed |
|---|---|---|
| `packages/codegen/src/il/lower.ts` | the mark and its carrier | `Set<string>` → `Map<string, AlignBoundary>` (`:199`, created `:227`, threaded `:245, :258, :307, :343, :387, :411`, consumed `:282`); `lowerAddressOf` (`:1845`) gains the demand parameter and combines coarsest-wins at `:1864`; `foldedAddressByte` (`:2557-2586`) gains the allowlist and passes the demand at `:2570` |
| `packages/codegen/src/il/cfg.ts` | the IL contract | `pageAligned: boolean` (`:119`) → `boundary?: AlignBoundary`; the new exported union |
| `packages/codegen/src/instr/instr-program.ts` | the emitted stream | `const PAGE = 256` (`:191`) deleted; `constDataStream` (`:200-208`) keys on the entry's own boundary |
| `packages/codegen/src/instr/print-instr.ts` | ACME rendering | **none** — `:171-179` already derives the bitmask from `boundary` |
| 16 test sites | the reshape | `lower-address-of.spec.test.ts` ×12, `lower-address-of.impl.test.ts` ×3, `assemble.impl.test.ts:155` ×1 |
| 3 harness oracles | the re-derivation | `balloon.spec.test.ts:191`, `balloon-color.spec.test.ts:51`, `boing-ball.spec.test.ts:68` |

### The three facts that shape the plan

**The demand is already in hand where the mark is made.** `foldedAddressByte` normalizes both
operators to one `shift` at `:2565` (`/` through `log2Exact`, `>>` as the count itself) and
bounds it to `[0, 15]` at `:2566` *before* calling `lowerAddressOf(binary.left, ctx, true)` at
`:2570` — the very function that records the mark. No new analysis, no new pass, no new traversal.

**Eight of the nine `lowerAddressOf` call sites have no divisor.** `:372, :523, :1080, :1504, :1645,
:2519, :2608, :2641` and the fold's own `:2570` are the callers — nine in all, `:1845` being the
definition — and only `:2570` knows a shift. This
is the entire content of M2's structural guarantee — every other path defaults to 256, so a symbol
that is *also* named through `hi(&X) * 4` collects a 256 demand and stays page-aligned.

**`exactOptionalPropertyTypes` is on** (`tsconfig.base.json`). Under it, `boundary: map.get(sym)`
does not typecheck against `boundary?: AlignBoundary`, because `undefined` is not an admissible
*value* of an optional property — the property must be **absent**. The entry is therefore built
with a conditional spread; see [03-01 §3](03-01-demand-and-emission.md#3--the-il-entry).

## Gaps identified

### Gap 1: the boundary is a constant, not a property of the data

**Current:** every address-taken image gets `PAGE` (`instr-program.ts:191`), a module constant with
no input.
**Required:** the boundary is decided per symbol from how the source names its address, and travels
on the entry.
**Fix:** M3's value-shaped mark; the constant disappears rather than moving.

### Gap 2: three spec oracles cannot fail in the direction that matters

**Current:** `balloon.spec.test.ts:191`, `balloon-color.spec.test.ts:51` and
`boing-ball.spec.test.ts:68` assert `addr % 256 === 0`. Under RD-15 two of them keep passing **by
luck** — `$08ED` rounds to `$0900` and `$0AFF` to `$0B00` under either boundary — and one
(`balloon-color`, `$0944` → `$0980`) fails deterministically.
**Required:** each asserts the boundary its program actually demands, and can fail when that
boundary regresses.
**Fix:** re-derive to `% 64` **and** pin the directive text. The `% 64` clause alone is unfailable
in reverse: `% 256 === 0` implies `% 64 === 0`, and all three images land on multiples of both, so
a demand silently regressing to 256 would leave all three green. Nor does anything else catch it:
`balloon` is tier `measured` and does carry a byte budget (`budgets.json`, 318 B) inside the exact-
ratchet suite, but a ratchet fails on **growth**, and a boundary regression that re-pads an image
to a page is not something a 318-byte ceiling can distinguish from any other layout; `balloon-color`
and `boing-ball` are tier `demo` (`examples-coverage.json`) and no committed golden, twin or ratchet
sees them at all. Directive text is the only deterministic discriminator (AR #108, RD preflight
PF-081).

### Gap 3: the by-reference membership rule is pinned by a boolean that is about to disappear

**Current:** `lower-address-of.spec.test.ts:232, :254-255, :277-279` assert `pageAligned === false`
for the by-reference, function-address and mutable-array cases — RD-03 M1's membership rule, the
one thing RD-15 explicitly does **not** change.
**Required:** the same rule, pinned against the replacement shape.
**Fix:** those cases assert the entry carries **no boundary**, not that it carries 256 (plan
criterion P-2). The distinction is real: absent means "no demand was ever registered", which is
what the membership rule is about.

## Dependencies

**Internal.** RD-13 (✅) is load-bearing in both directions: its fold is what makes a 64-byte
boundary usable at all — `hi(&X) * 4` is only equal to `addr / 64` when the address is
page-aligned, which is why RD-03 chose 256 — and its `foldedAddressByte` is where the demand is
read. RD-03 (✅) supplies the membership rule, preserved verbatim; only the value recorded at that
site changes.

**External.** ACME for every end-to-end assertion (installed in CI). VICE 3.10 for the Phase 3
emulator tier only (CI has no emulator tier, AR-27).

**Package edges.** `@blend65/codegen` and `@blend65/test-harness` only. R15 holds trivially —
nothing in `frontend` or `language-server` is involved and no new edge is created.

## Risks and concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A non-power-of-two boundary reaches `print-instr.ts:179` and aligns nothing, silently | Low | **High** — wrong sprite block, no diagnostic | `AlignBoundary` closes the value set at the type, at every producer (AR #113) |
| The 16-site reshape quietly weakens a negative case | Medium | High — AC-7's membership rule ends up pinned by nothing | The reshape lands in Phase 1 where behaviour cannot move; P-2 states the required shape; the three `align-mixed` oracles stay untouched as the control |
| A `% 64` oracle passes while the demand has regressed to 256 | Medium | Medium — the change silently un-does itself later | Every re-derived oracle pins the directive text as well (AC-9) |
| `balloon-color`'s move breaks something that pins its address | Low | Medium | Verified: tier `demo` — no golden, no twin, no ratchet, no `budgets.json` row; its only committed pin is its own spec test |
| `balloon-color` is CI-visible but not emulator-verified, and it is the one image that moves | Certain | Medium | Stated in AC-13 rather than papered over; its hardware correctness rests on ST-13f's assembled-pointer oracle, plus a one-off manual VICE look at closeout, recorded and not gated |
