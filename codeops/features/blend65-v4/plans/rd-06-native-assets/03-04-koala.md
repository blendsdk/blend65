# Koala: RD-06 Native Assets

> **Document**: 03-04-koala.md
> **Parent**: [Index](00-index.md)

## Overview

This component owns the classic Koala Paint handler (`.kla`/`.koa`). It validates the exact
10,003-byte native layout, exposes exactly four components, preserves every source byte including
unused high nibbles, and attaches only the alignment and VIC-visibility constraints the hardware
requires. It never supplies a base address, `$D018` value, renderer or implicit Color RAM copy.

## Architecture

### Current architecture

No Koala code exists. `.kla`/`.koa` files reach the generic native stub and return E10204. The
`vicBitmapSelect` and `vicScreenSelect` operations are spec-only.

### Proposed changes

`packages/compiler/src/assets/c64/koala.ts` implements `AssetHandler`:

```text
file bytes
  -> require exactly 10,003 bytes
  -> require little-endian load address == $6000
  -> slice bitmap[8000], screen[1000], colorRam[1000], background[1]
  -> expose only the requested selector
  -> attach alignment/visibility constraints to array outputs
```

The handler has no default selector. A one-argument `embed("level.kla")` is E10132.

## Implementation Details

### Layout

| Offset | Length | Component | Selector |
| --- | --- | --- | --- |
| `$0000` | 2 | Load address, little-endian `$6000` | None; metadata only |
| `$0002` | 8,000 | Multicolor bitmap | `"bitmap"` |
| `$1F42` | 1,000 | Screen matrix | `"screen"` |
| `$232A` | 1,000 | Color RAM source bytes | `"color_ram"` |
| `$2712` | 1 | Background color | `"background"` |

Total: 10,003 bytes. A wrong length, wrong load address or malformed component is E10204. The load
address is not part of any selector result.

### Selector contract

| Selector | Result | Constraints |
| --- | --- | --- |
| `bitmap` | `const byte[8000]` | 8-KiB alignment; VIC-bank visible |
| `screen` | `const byte[1000]` | 1-KiB alignment; same VIC bank as `bitmap` when both are selected |
| `color_ram` | `const byte[1000]` | None; exact source bytes |
| `background` | `byte` | None; exact source byte |

Only the requested component is emitted. The handler does not expose a combined image, base address,
bank, register field, offset table or hidden Color RAM copy.

### High-bit preservation

Every Color RAM byte and the final background byte is preserved exactly. Only `value & $0f` has
VIC-II color meaning. A nonzero high nibble is accepted and never normalized or rejected (AR-22).
The provenance record reports the full source byte and the low-nibble meaning.

### Placement and derived fields

`bitmap` carries 8-KiB alignment and VIC visibility. `screen` carries 1-KiB alignment and VIC
visibility. When both are selected, the layout must place them in the same selected VIC bank (bank 0
in RD-06, AR-5). The zero-cost platform operations derive the final `$D018` fields:

```text
vicBitmapSelect(&BITMAP) = ((addressWithinVicBank / $2000) & $01) << 3
vicScreenSelect(&SCREEN) = ((addressWithinVicBank / $0400) & $0f) << 4
```

Each operation returns a **pure field constant**, not a complete `$D018` write. Source combines the
selected fields with ordinary `|` when it writes the register. The operations validate alignment and
visibility; a one-object failure is E10143 and a cross-object/bank failure is E10273. They emit no
data, call or runtime calculation.

Color RAM is separate 4-bit hardware at `$D800`. The selected `"color_ram"` bytes are ordinary
resident data; copying them to `$D800` is explicit user-authored runtime work. The handler injects no
transfer. The `.costs.json` record reports the handler/import cost as zero and the user transfer cost
separately when the source contains it.

### Error handling

| Error case | Handling strategy | AR Ref |
| --- | --- | --- |
| Length ≠ 10,003 | E10204 naming actual/required length | AR-22 |
| Load address ≠ `$6000` | E10204 naming the address | AR-22 |
| Missing selector | E10132 listing the four selectors | AR-24 |
| Unknown selector | E10133 listing available selectors | AR-17 |
| Bitmap misaligned | E10143 naming the 8-KiB requirement | AR-11 |
| Screen/bitmap mixed bank | E10273 naming both assets | AR-11 |
| VIC character-ROM conflict | E10273 naming the window and both assets | AR-11 |
| High nibble nonzero | Accepted and preserved | AR-22 |
| Registered malformed `.kla`/`.koa` | E10204; never raw fallback | AR-18 |

## Testing Requirements

- Exact 10,003-byte fixtures: zero-pattern, patterned, Color-RAM high nibble and background high
  nibble.
- Exact type, length and SHA-256 for every selector.
- Requested-only emission and no default selector.
- Wrong length, wrong load address and component-boundary failures.
- `.kla` and `.koa` both dispatch to the same handler.
- Bitmap 8-KiB and screen 1-KiB alignment, same-bank visibility, character-ROM avoidance and exact
  derived `$D018` field constants, including an OR-combined bitmap+screen value.
- Bounded VICE check that the bitmap/screen data is visible and the user transfer of Color RAM reaches
  `$D800` with the reported cost.
- No handler-injected transfer or duplicate image.
