# Resident Layout and Evidence: RD-06 Native Assets

> **Document**: 03-06-resident-layout-evidence.md
> **Parent**: [Index](00-index.md)

## Overview

This component carries symbolic asset constraints to final layout, solves every resident object as a
physical interval with CPU and device views, derives every hardware field from the solved address,
and publishes complete asset, memory and cost evidence. It extends the existing first-fit layout; it
does not add a second allocator, a runtime loader, a copy, or a bank-transition mechanism.

RD-06 is resident-only. Every emitted object is present in the profile's primary PRG image and final
runtime layout. RD-07 owns `loadable const`, D64 packaging, loaders, decompression and overlays.

## Architecture

### Current architecture

`packages/compiler/src/layout/c64-layout.ts` builds inclusive intervals for code, data, BSS, SFA,
assets, fill and reservations. Placement is scalar first-fit with `at`, `align`, `noCross` and
overlap checks. VIC sprite assets are placed from `$2000` on 64-byte boundaries inside bank 0.
Ordinary data does not skip the character-ROM window. `.memory.json` has one `cpu16-resident` view.

### Proposed changes

```text
layout object
  -> required type/size, owner, mutability, writable ranges
  -> handler constraints (alignment, fixed load, VIC visibility, same-bank)
  -> source place(at|align|noCross|region) intersected, never weakening
  -> physical interval in cpu16
  -> CPU view and device views (vic-bank-0, color-ram)
  -> nonoverlap, containment, banking and reserved-range proof
  -> derived hardware fields
  -> ACME bytes + .assets.json + .memory.json + .costs.json + .debug.json
```

The solver remains deterministic first-fit with explicit constraint checks. Sprite placement
searches every legal 64-byte hole in the selected VIC bank, not only upward from `$2000`. An
impossible set fails with interval evidence instead of searching forever.

## Implementation Details

### Object model

Each layout object carries:

| Field | Meaning |
| --- | --- |
| `kind` | code, immutable, global, bss, asset, sfa, fill, reservation |
| `owner` | function, symbol, asset, platform, compiler |
| `bytes` | Exact payload length |
| `alignment` | Required power-of-two alignment |
| `constraints` | Handler/profile/source constraints |
| `cpu` | CPU-visible interval |
| `vic` | VIC-bank-relative interval and visibility, when applicable |
| `writable` | Declared writable/self-modifying byte ranges, if any |
| `residency` | `resident` in RD-06 |

### Address spaces and views

| View | Range | Purpose |
| --- | --- | --- |
| `cpu16-resident` | `$0000-$10000` (resident allocation limited to `$0801-$CFFF`) | Complete CPU address space and resident allocation |
| `vic-bank-0` | `$0000-$3FFF` | Bank-relative VIC view; every bank-0 interval is present and VIC-visible intervals carry the `vic` field |
| `color-ram` | `$D800-$DBFF` in a separate `colorram4` address space | 1,024 hardware addresses; 1,000 visible cells |

The `vic-bank-0` view uses the same `cpu16` address space and includes every bank-0 interval, so a
VIC asset, the active screen and the character-ROM reservation all reconcile in one view. The
`color-ram` view uses a distinct address space and one reserved `color-ram.hardware` interval; the
1,000 selected Koala bytes remain ordinary resident data and are never double-counted as Color RAM.

The `vic-bank-0` view includes:

- screen `$0400-$07FF`, whose final eight bytes are the sprite-pointer table;
- character ROM `$1000-$1FFF`, which is VIC-invisible;
- sprite records, charset, bitmap and any other VIC-visible object;
- free intervals, total free bytes and the largest contiguous hole.

The `color-ram` view reports the 1,024 hardware addresses separately from the 1,000 selected Koala
bytes. It is a hardware view, not a resident PRG interval.

### Constraints

| Constraint | Source | Handling |
| --- | --- | --- |
| `at` | Handler (PSID), source `place` | Exact start; intersection must agree |
| `align` | Handler, profile, source | Strongest alignment wins |
| `noCross` | Source, profile | Object must not cross the boundary |
| `region` | Source `c64.vic.bank0` | Must resolve to the selected profile region |
| `visibility` | Handler/profile (VIC) | Object must be VIC-visible in bank 0 |
| `writable` | Player contract | Payload-relative ranges must fit and be writable |
| `contiguous` | Handler | One physical interval, no split |
| `sameBank` | Koala bitmap/screen | Layout-only relation: both objects must resolve to the same VIC bank. It is derived from the two placed ranges and bank/visibility records, not written as a separate `.assets.json` constraint. |

Source `place(...)` may strengthen but never weaken a handler or profile constraint. A source `at`
that differs from a PSID fixed load is E10273. A handler constraint that cannot be met is E10143.
Both name every contributing requirement and the occupied ranges relevant to the conflict.

### Alignment and visibility matrix

| Object | Alignment | Visibility / reservation |
| --- | --- | --- |
| SpritePad `sprites` | 64 bytes | VIC bank 0; must not overlap screen or character ROM |
| CharPad `charset` | 2,048 bytes | VIC bank 0; must not overlap character ROM |
| Koala `bitmap` | 8,192 bytes | VIC bank 0; must not overlap character ROM |
| Koala `screen` | 1,024 bytes | VIC bank 0; same bank as bitmap when both selected |
| PSID `data` | 1 byte | CPU-resident at effective load address |
| Raw bytes | 1 byte | CPU-resident only |
| Active screen | 1,024 bytes | Reserved; includes `$07F8-$07FF` pointer table |
| Character ROM | 4,096 bytes | Reserved for **all** CPU and VIC placement and VIC-invisible while CHAREN=1 |
| Color RAM | 1,024 addresses | Separate hardware view |

### Derived hardware fields

| Field | Derivation | Failure |
| --- | --- | --- |
| `vicSpriteBlock` | `(addressWithinVicBank / 64)` | Misaligned → E10143; out-of-bank → E10273 |
| `vicCharsetSelect` | `((addressWithinVicBank / 2048) & $07) << 1` | Misaligned/invisible → E10143; character-ROM overlap → E10273 |
| `vicBitmapSelect` | `((addressWithinVicBank / $2000) & $01) << 3` | Misaligned → E10143; mixed bank → E10273 |
| `vicScreenSelect` | `((addressWithinVicBank / $0400) & $0f) << 4` | Misaligned → E10143; mixed bank → E10273 |

Each is a pure field constant, not a complete `$D018` write. Source combines selected fields with
ordinary `|`. They never emit runtime division, lookup tables, relocation or copies.

### Impossible resident sets

The solver fails before ACME when the reachable set cannot satisfy every constraint. The canonical
case is 256 native sprite records plus an active screen: the records alone occupy `[0,$4000)`, so
they cannot coexist with the screen in one 16-KiB bank. The diagnostic names the objects, the
16-KiB bank, the active screen interval, the character-ROM window and every compatible hole. It does
not hide a copy, split, overlay, loader or bank transition.

### Evidence

.assets.json` populates the existing version-1 fields and one additive `compileTime` placement
variant for scalar outputs. The evidence `id` is extended additively to include the input identity
and representation so distinct files with equal output bytes remain distinct. No version bump is
introduced; the validator and its tests are updated explicitly.

| Field | Content |
| --- | --- |
| `inputs` | Project-relative path, byte count, input SHA-256 |
| `handler`, `handlerVersion` | Exact handler identity |
| `selector` | Resolved selector including default |
| `logicalType`, `shape` | Exact scalar or fixed array type |
| `outputSha256` | Exact selected output hash |
| `payloadBytes`, `emittedBytes` | Useful and emitted bytes |
| `aliases` | Canonical alias identities |
| `constraints` | Handler/profile/source constraints |
| `placement` | `single` for resident arrays, `compileTime` for scalar/zero-byte outputs (payload 0, emitted 0, encoded output hash), residency, visibility, writable ranges, padding |

`.memory.json` reports each interval with owner, origin, kind, CPU mapping, VIC view, bank, payload,
padding, reserved bytes and mutability. It reports the three views and their free intervals, total
free bytes and largest hole. `runtimeMemorySafety` stays honest; an unavailable proof is `unproven`,
not zero.

`.costs.json` reports zero compile-time import cost separately from artifact bytes and any explicit
runtime transfer/access. Unavailable timing evidence is `Unknown`.

`.debug.json` populates the existing asset-input, asset-symbol, generated-origin, location and
final-range records.

### ACME boundary

ACME receives symbolic labels, explicit addresses, alignment/fill and final byte sequences. Generated
ACME never parses an authoring format, obtains an unsanitized source path, or uses permissive
`!binary` truncation/padding to validate an asset. A failed import, layout or reconciliation publishes
no target artifact.

### Error handling

| Error case | Handling strategy | AR Ref |
| --- | --- | --- |
| Handler alignment/visibility failure | E10143 naming the constraint and object | AR-11 |
| Source `place` conflict | E10273 naming every source and handler contributor | AR-11, AR-33 |
| Region unavailable | E10272 | AR-5 |
| Overlap | E10273 naming every contributor | AR-11 |
| Out of resident range | E10273 with the interval evidence | AR-32 |
| 256 sprites plus screen | E10273 with bank, screen and hole evidence | AR-32 |
| ACME mismatch | Hard diagnostic; no publication | AR-34 |
| Unavailable timing | `Unknown` | AR-35 |

## Testing Requirements

- Interval nonoverlap and containment for every object kind.
- Alignment and visibility matrix for sprites, charset, bitmap and screen.
- PSID fixed-load placement and conflict tests.
- Bank-0 free intervals, total free bytes and largest hole.
- Screen 1,024-byte and Color RAM 1,024-address accounting without double counting.
- 128 sprites plus screen fits; 256 sprites plus screen fails with interval evidence.
- A sprite set that fits only in a legal hole below `$2000` succeeds.
- Code/data crossing the character-ROM window is moved or fails with interval evidence; existing
  fixtures are audited for the window.
- Scalar selectors produce `compileTime` records and no `.memory.json`/`.costs.json` placement.
- Derived field values for all four `vic*` operations.
- `.assets.json`, `.memory.json`, `.costs.json` and `.debug.json` field completeness and
  cross-sidecar reconciliation, including extended evidence ids and compile-time scalar records.
- The existing Specification 4 W10150 percentage warning remains unchanged; RD-06 adds no new
  percentage warning.
- ACME source contains only labels, addresses and final bytes; no asset path or truncation.
- No partial artifact on failure.
