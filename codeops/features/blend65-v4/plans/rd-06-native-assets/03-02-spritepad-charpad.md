# SpritePad and CharPad: RD-06 Native Assets

> **Document**: 03-02-spritepad-charpad.md
> **Parent**: [Index](00-index.md)
> **Status**: Design gated by producer evidence (AR-1, AR-37, AR-50)

## Overview

This component owns the two producer-application project handlers: SpritePad C64 Pro 3.80 with SPD
v5 and CharPad C64 Pro 3.88 with CTM v9. It validates the complete project, exposes exactly the
approved typed selector surface, preserves native records, and attaches placement constraints. It
does not flatten, recolor, repack, or invent missing components.

**Hard gate:** RD-06 R6.1, R6.12 and R6.19 require the authentic producer-saved fixture set, settings,
provenance, retention approval and SHA-256 values before decoder planning or implementation. AR-51
records the planning boundary: this document fixes only the seam, selector contract and validation
doctrine; it does not invent the byte-level schema, flags, block order, record layout or
optional-component conditions. The checklist is
[00-rd-06-producer-evidence-handoff.md](../../00-rd-06-producer-evidence-handoff.md). A single `MIN`
file starts fixture intake, not decoder planning.

## Architecture

### Current architecture

No SpritePad or CharPad code exists. `.spd` and `.ctm` reach the generic native stub and return
E10204; `.ctm` without a selector returns E10132. No producer fixture exists in the repository.

### Proposed changes

Both handlers implement `AssetHandler` from
[03-01](03-01-asset-handler-core.md#new-types-and-interfaces):

```text
C64 profile
  spd -> spritepad 3.80
  ctm -> charpad 3.88
```

Each handler is a pure byte parser over the already-read input. It produces a complete result or one
E10204 failure; it never returns partial selectors. The handler owns:

- signature and accepted version;
- complete structure and exact EOF;
- every declared count, index, flag, conditional block and component length;
- the selector inventory for the parsed file;
- typed output values and their SHA-256;
- handler-derived placement/visibility constraints;
- no producer provenance in runtime values; producer metadata is fixture-manifest and report data.

The handler does not own a final address, a VIC register field, a runtime copy, a renderer, or a
game policy.

## Implementation Details

### Shared parser contract

| Rule | Requirement | AR Ref |
| --- | --- | --- |
| Input bound | 1 MiB maximum; reject before allocation when exceeded | AR-12 |
| Signature/version | Exact magic and accepted version only | AR-17 |
| Counts | Overflow-safe arithmetic; every count bounded by the remaining bytes | AR-12 |
| Structure | Every block/record boundary and conditional rule validated | AR-17 |
| Exact EOF | Trailing bytes are E10204 | AR-17 |
| Selectors | Enumerated from the validated file; absent names are E10133 | AR-17 |
| Outputs | Exact scalar or fixed immutable array; no speculative companion output | AR-25 |
| Identity | Handler/version/path/input hash/selector/representation/output hash | AR-9 |
| Placement | Handler constraints only; no address guessed in the parser | AR-29 |

### SpritePad SPD v5 selector contract

| Selector | Result | Availability |
| --- | --- | --- |
| `sprites` | `const byte[]`, 64 native bytes per sprite; default | Always |
| `count` | `word` | Always |
| `background_color`, `multicolor_1`, `multicolor_2` | `byte` | Always |
| `sprite_attributes` | `const byte[]`, one packed attribute per sprite | Always; derived from record byte 63 |
| `tile_count` | `word` | Tile layer present |
| `tile_width`, `tile_height` | `byte` | Tile layer present |
| `tiles` | `const word[]`, native row-major sprite indices | Tile layer present |
| `tile_attributes`, `tile_tags` | `const byte[]` | Component present |
| `sprite_overlay_distance`, `tile_overlay_distance` | `word` | Component present |
| `sprite_animation_count` | `word` | Sprite-animation component present |
| `sprite_animation_starts`, `sprite_animation_ends` | `const word[]` | Component present |
| `sprite_animation_timers`, `sprite_animation_flags` | `const byte[]` | Component present |
| `tile_animation_count` | `word` | Tile-animation component present |
| `tile_animation_starts`, `tile_animation_ends` | `const word[]` | Component present |
| `tile_animation_timers`, `tile_animation_flags` | `const byte[]` | Component present |

`"sprites"` carries 64-byte alignment and VIC-bank visibility. `"sprite_attributes"` is a separately
emitted derived table and is never implicit. There is no file-wide multicolor, base-block or offset
selector (AR-19, AR-45).

### CharPad CTM v9 selector contract

| Selector | Result | Availability |
| --- | --- | --- |
| `charset` | `const byte[]`, 8 bytes per character; 2-KiB aligned, VIC-visible | Always |
| `tiles` | Smallest-lossless `byte[]` or `word[]`, row-major character indices | Tile mode only |
| `map` | Smallest-lossless `byte[]` or `word[]`, row-major tile or character indices | Always |
| `tiles_word`, `map_word` | Forced little-endian `word[]` | `tiles_word` tile mode only |
| `tiles_packed12`, `map_packed12` | `byte[]` packed-12 form | Layer exists and every index ≤ 4095 |
| `tiles_low`, `tiles_high` | Independent `byte[]` planes | Tile mode only |
| `map_low`, `map_high` | Independent `byte[]` planes | Always |
| `colors` | Native `byte[]` for the file's color method | Always |
| `color_method` | `byte` | Always |
| `map_width`, `map_height` | `word` | Always |
| `tile_width`, `tile_height` | `byte`; `1` without tile mode | Always |
| `tile_mode` | `boolean` | Always |

Canonical width is `byte[]` when the maximum referenced index is at most 255, otherwise `word[]`.
A declared mismatch is E10144 and reports the required type. Packed-12 emits `N` low bytes then
`ceil(N/2)` high-nibble bytes; `$123,$456,$789` becomes `$23,$56,$89,$41,$07` (AR-20, AR-46).
There is no default selector; omission is E10132.

### Producer evidence requirements

The handler implementation may start only when the relevant checkpoint is complete:

| Family | Required evidence |
| --- | --- |
| SpritePad | `SPD380-MIN-V5`, `SPD380-ALL-V5`, `SPD380-WIDE-V5`, meaningful `SPD380-OPTIONALS-V5-*`, version screenshot, settings, provenance, retention approval, SHA-256, expected selector outputs, derived v4/v6 and malformed cases |
| CharPad | `CTM388-MIN-V9`, `CTM388-ALL-V9`, `CTM388-WIDE-V9`, every meaningful display × color × tile-mode fixture, version screenshot, settings, provenance, retention approval, SHA-256, expected selector outputs, derived v8/v10 and block-malformed cases |

The fixture manifest records every value required by AR-15 and RD-06 R6.49. The Linux build and CI
never invoke SpritePad or CharPad. A different producer version is never relabelled. The RD-04
retained `assets/bad.spd` fixture (`01 02 03`) and its exact E10204 message/span oracle are part of
the SpritePad specification task; the stub message is replaced by the real structural failure.

### Derived outputs

- `sprite_attributes` extracts record byte 63 from each 64-byte SPD record. It does not emit a second
  copy of the bitmap bytes.
- `tiles`/`map` canonical width is chosen from the maximum referenced index in the validated layer.
  It never truncates or widens other outputs.
- `tiles_packed12`/`map_packed12` are independent representations. Selecting one never emits the
  canonical, forced-word, low or high companion.
- `charset` carries 2-KiB alignment and VIC visibility. Final layout derives
  `vicCharsetSelect`; the handler never supplies an address or `$D018` value.

### Error handling

| Error case | Handling strategy | AR Ref |
| --- | --- | --- |
| Wrong magic/version | E10204 at the signature/version offset | AR-17 |
| Truncated block or record | E10204 naming the block and required/remaining bytes | AR-17 |
| Count/index/attribute mismatch | E10204 naming the field and offending value | AR-17 |
| Conditional component absent | Selector absent; requesting it is E10133 | AR-17 |
| Trailing bytes | E10204 naming the exact EOF offset | AR-17 |
| Canonical width mismatch | E10144 with the required `byte[]` or `word[]` type | AR-20 |
| Packed-12 unavailable | E10133 listing available representations | AR-20 |
| Charset alignment/visibility failure | E10143 for one-object alignment; E10273 for character-ROM/cross-object conflicts | AR-11 |
| Reserved `.spd`/`.ctm` before evidence | E10204 before raw fallback | AR-53 |
| Producer evidence missing | Family stays blocked; no decoder task executes | AR-1 |

## Testing Requirements

- Fixture-manifest validation: every producer file has provenance, settings, license, SHA-256 and
  expected outputs.
- Positive selector tests for every fixture and every available selector, with exact type, length and
  SHA-256.
- Canonical-width, packed-12, low/high, tile/no-tile and optional-component presence/absence tests.
- Negative tests for adjacent versions, every truncation boundary, wrong order, count/index mismatch,
  trailing bytes, unknown selector, and exact EOF.
- Layout tests for 64-byte sprite alignment, 2-KiB charset alignment, VIC visibility, and the
  256-record-plus-screen failure.
- No Linux build or test invokes a producer application.

## Blocked Work

The following work remains `[!]` until its checkpoint passes:

- SpritePad decoder, selectors, optional components and producer regression suite.
- CharPad decoder, ordered block validation, selector matrix and producer regression suite.
- The retained `assets/bad.spd` E10204 structural-failure oracle.
- Producer-specific VICE rendering checks.
- The focused SpritePad and CharPad examples required by R6.54.

The blocked tasks are listed at the end of [99-execution-plan.md](99-execution-plan.md).
