# Demand and Emission: Alignment Granularity

> **Document**: 03-01-demand-and-emission.md
> **Parent**: [Index](00-index.md)
> **Covers**: RD-15 M1, M2, M3 · decided by AR #113, #114, #119

## Overview

Four edits in three files. The demand is derived where the shift is already normalized, travels as
a byte count to the site that already records the mark, is combined coarsest-wins, and rides to the
emitter on the const-data entry. Nothing new traverses the AST, and `print-instr.ts` is not touched.

## 1 — The boundary type

New in `packages/codegen/src/il/cfg.ts`, exported alongside `ConstDataEntry`:

```ts
/**
 * A boundary a const image can be placed on, in bytes.
 *
 * Closed deliberately, and this is the reason: ACME's `!align` takes a bitmask
 * rather than a modulus, so the emitted directive is derived as `boundary - 1`.
 * That derivation is only meaningful for a power of two — any other value
 * assembles cleanly, appears in the listing, and aligns nothing, which shows up
 * as a sprite reading from the wrong block with no diagnostic anywhere. Naming
 * the two boundaries the hardware actually dereferences in makes the mistake
 * unrepresentable instead of merely warned about.
 */
export type AlignBoundary = 64 | 256;
```

The narrowing is the plan's structural guarantee (AR #113). Its reach is exactly the three
declarations that use it — the parameter (§2), the map value (§2), and the entry field (§3) — so
every producer of a `ConstDataEntry` is covered at compile time, including hand-built literals such
as `assemble.impl.test.ts:155`. It deliberately does **not** reach the `align` directive itself
(`core/src/instr-model/stream.ts:47-53`, whose `boundary` stays `number`): that directive is a
general ACME facility, its doc comment already states the power-of-two requirement, and
`constDataStream` is its only producer.

## 2 — The demand, and where it is minted

### The allowlist — in `foldedAddressByte`, not at the mark site

Module-level in `lower.ts`. `PAGE_BOUNDARY` lands in Phase 1, because the parameter default below
refers to it; the other three arrive with the fold in Phase 2:

```ts
/** The boundary a const image gets when nothing finer is demanded. */
const PAGE_BOUNDARY: AlignBoundary = 256;
/** The unit the VIC dereferences a sprite in. */
const BLOCK_BOUNDARY: AlignBoundary = 64;
/** The normalized shift that names a block — `/ 64` and `>> 6` both reduce to it. */
const BLOCK_SHIFT = 6;

/**
 * The alignment that naming a unit of `2^shift` bytes demands of the image.
 *
 * An allowlist rather than arithmetic on the shift, and the distinction is the
 * whole rule: `lo(&X / 16384)` reads which VIC bank an address sits in, which is
 * correct wherever the image lands, and treating it as a placement demand would
 * insert up to 16 KB of padding to satisfy a question. Only a unit the hardware
 * genuinely dereferences in is a demand. Everything else keeps the default —
 * including a page, which is not a VIC granularity at all but the boundary an
 * address handed out with no arithmetic around it has always been given.
 */
function boundaryOfShift(shift: number): AlignBoundary {
  return shift === BLOCK_SHIFT ? BLOCK_BOUNDARY : PAGE_BOUNDARY;
}
```

Keying on the **normalized shift** rather than the surface operator is required, not stylistic:
RD-13's AC-5 pins `lo(&X / 64)` and `lo(&X >> 6)` as byte-for-byte equal, and a rule keyed to the
operator would make that equality depend on placement.

The single call, replacing `lower.ts:2570`:

```ts
const address = lowerAddressOf(binary.left, ctx, true, boundaryOfShift(shift));
```

`shift` is already normalized (`:2565`) and already bounded to `[0, 15]` (`:2566`) at that point,
so `boundaryOfShift` never sees a value the fold itself rejected.

### The mark — `lowerAddressOf`

The signature gains a defaulted fourth parameter; the eight other call sites are unchanged:

```ts
function lowerAddressOf(
  expr: UnaryExprNode,
  ctx: LowerCtx,
  direct: boolean,
  demand: AlignBoundary = PAGE_BOUNDARY,
): ILOperand
```

and `:1864` becomes a coarsest-wins insert, inside the `sym.kind === "constant"` branch exactly as
today:

```ts
const existing = ctx.alignmentDemands.get(symbol);
if (existing === undefined || demand > existing) ctx.alignmentDemands.set(symbol, demand);
```

**Not `Math.max`** — it is typed `(...values: number[]) => number` and would widen the value back
to `number`, losing the guarantee §1 exists to provide.

Order-independence matters and is structural here: the two demand sites for one symbol can appear
in either order and in different functions, and a maximum does not care. Alignment composes — a
multiple of 256 is a multiple of 64 — so the coarser demand can only cost bytes, never change a
value. That is what makes `hi(&X) * 4` correct **by construction** rather than by caution: it
lowers through a divisor-less path, registers 256, and the maximum keeps the symbol on a page.

### The carrier — `LowerCtx`

`addressTakenConsts: Set<string>` (`:199`) becomes `alignmentDemands: Map<string, AlignBoundary>`
(AR #114), created once at `:227` and threaded unchanged through `:245, :258, :307, :343, :387,
:411`. It stays **one map shared by every lowering context** — a module initializer lowers through
its own context, and a per-context map would silently lose every `&` written at module scope
(pinned by ST-C19b). Its doc comment carries the same warning it carries today, restated for a map:
filled at the `&` site itself, so a by-reference argument — which lowers to the very same address
operand — never lands in it.

## 3 — The IL entry

`cfg.ts:119` replaces the boolean:

```ts
  /**
   * The boundary this image must start on, in bytes — absent when nothing
   * demands one.
   *
   * A demand comes from a source-level `&` on the aggregate, the only way a
   * program can hand the raw address to hardware that reads in page or block
   * units, and its value follows the arithmetic the source writes around it:
   * naming a 64-byte block demands 64, any other form demands a page, and a
   * symbol named both ways takes the coarser of the two. Passing the aggregate
   * by reference demands nothing — the compiler's own indexed access does not
   * care where the data sits, and aligning every table ever passed to a helper
   * would cost padding for nothing.
   */
  readonly boundary?: AlignBoundary;
```

Absent-versus-present is the suppression predicate: the directive is emitted **iff** the field is
present, which is what today's `pageAligned: false` cases become (never `boundary: 256`; plan
criterion P-2).

`exactOptionalPropertyTypes` is on, so `boundary: alignmentDemands.get(symbol)` does **not**
typecheck — `undefined` is not an admissible value of an optional property, the property has to be
absent. `lowerToIL:282` therefore builds the entry with a conditional spread:

```ts
const boundary = alignmentDemands.get(symbol);
constData.push({
  symbol,
  data: value.bytes,
  type: /* unchanged */,
  ...(boundary !== undefined ? { boundary } : {}),
});
```

## 4 — The emitted directive

`instr-program.ts` deletes `const PAGE = 256` (`:191`) — the constant does not move, it stops
existing — and `constDataStream` (`:200-208`) keys on the entry:

```ts
const entries =
  entry.boundary !== undefined
    ? [directive({ kind: "align", boundary: entry.boundary, fill: 0 }), label(entry.symbol)]
    : [label(entry.symbol)];
```

Unchanged in shape from RD-03: one directive immediately ahead of the label, inside the same
stream, so the padding lands before the data and the directive travels with the bytes it aligns.
Only the boundary value becomes per-entry. `print-instr.ts:171-179` is **not touched** — it already
derives ACME's bitmask from `boundary`, which is also why the trap RD-03 documented stays covered
in the one place it has always been.

## 5 — What deliberately does not change

| Site | Why it stays as it is |
|---|---|
| The membership rule at the `&` site | RD-03 M1, preserved verbatim; only the value recorded there changes. Scanning IL operands instead would align `slice7b` and `slice8b` (+159 and +276 bytes) and try to align function labels in `slice8` |
| The `sym.kind === "variable"` and `"function"` branches (`:1852-1854`, `:1865-1866`) | They register nothing today and register nothing after. The new parameter is **inert** outside the const branch — pinned by AC-15, because M3 threads a parameter through the very function whose other branches must ignore it. The resulting hazard on an SFA-placed mutable buffer is [#74](https://github.com/blendsdk/blend65/issues/74)'s, not this plan's |
| `print-instr.ts` | No change (§4) |
| `LowerInput` (`:84-96`) | No platform field; the Should-Have that would add one is out of scope (AR #119) |

## Error handling

| Case | Handling | AR |
|---|---|---|
| A shift outside the allowlist (`/ 1`, `/ 128`, `/ 16384`, `/ 32768`) | Falls to `PAGE_BOUNDARY` — today's behaviour, so the failure direction is over-padding rather than under-alignment | AR #104 |
| A shift the fold rejects (`k = 16`, non-power-of-two divisor) | Never reaches `boundaryOfShift`; the expression lowers through the ordinary path with its existing diagnostics, and the symbol still collects 256 from that path | AR #104 |
| `&` on a mutable aggregate or a function, with or without a divisor | No demand registered, no directive, fold arithmetic unchanged. **No new diagnostic** — the candidate fold-site warning is [#74](https://github.com/blendsdk/blend65/issues/74)'s | RD-15 Won't Have |
| A boundary that is not a power of two | Unrepresentable — compile error at every producer | AR #113 |

## Testing requirements

Specification-level behaviour is owned by [07-testing-strategy.md](07-testing-strategy.md).
Implementation tests belong to this component: `boundaryOfShift` across every shift the fold
admits (`0..15`, only 6 mapping to 64), the coarsest-wins insert in both source orders, and the
absent-versus-present branch of `constDataStream` at the stream level.
