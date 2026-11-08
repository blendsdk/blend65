# Testing Strategy: RD-06 Native Assets, Compile-Time Composition, and Resident Layout

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage goals

Coverage is measured by the completed ST-case inventory and the AC coverage map, not by an
unconfigured percentage provider. Every ST case has a concrete input/output pair and a source.
Integration and VICE cases are listed separately.

Test names state behavior: `should [expected behavior] when [condition]`. Every specification test is
filed as `*.spec.test.ts`; implementation edge cases are `*.impl.test.ts`. Expectations come from
RD-06, Specification 4 Chapter 13, Chapter 14, Appendix C64 §7, or an AR entry. They never come from
the implementation being written.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> These cases are derived exclusively from the requirements and specifications above. The immutable
> oracle rule applies: a failing specification test means the implementation is wrong, not the test.

### Asset handler core (unblocked)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|-----------------------------|--------|
| ST-1 | Nonempty `table.bin`, `const TABLE: byte[] = embed("table.bin")` | Raw handler, selector `raw`, exact bytes, `byte[N]`, no selector error | R6.1, R6.31 |
| ST-2 | Empty `empty.bin`, raw embed | E10131, no asset value, no artifact | R6.31 |
| ST-3 | 65,536-byte raw file | E10265, no asset value | R6.31 |
| ST-4 | `embed("table.bin", "x")` on unregistered `.bin` | E10137 before any read | R6.31 |
| ST-5 | `const X: byte[] = embed(NAME)` with nonliteral path | E10136 on the argument span | R6.4 |
| ST-6 | `embed("a.spd", SELECTOR)` with nonliteral selector | E10250 on the second argument | R6.4 |
| ST-10 | `loadable const X: byte[] = embed("a.spd")` | E10204 on the call span with the resident-only message; no parsing, no RD-07 behavior; ledger entry exists | AR-3 |
| ST-11 | Two declarations of the same file, selector and representation | One canonical asset/address, one byte count, W10151 | R6.7 |
| ST-12 | Same file with `"map"` and `"map_word"` | Two distinct assets, no W10151, independent bytes | R6.7 |
| ST-13 | Two different files with identical bytes and same selector | Two distinct assets and addresses | R6.7 |
| ST-17 | Missing registered file | E10130 with project-relative ordered roots, no bytes, no absolute host path | R6.4, R6.48 |
| ST-18 | Source-relative file shadows an `assetPaths` file | Source-relative file wins; evidence records the resolved identity | R6.4 |
| ST-165 | Parsed native asset exposed to the shared semantic model | Selector names, exact types, availability, provenance and pre-layout constraints are present; no codegen/layout import | R6.55 |
| ST-166 | Malformed native asset diagnostic | Names the declaration, project-relative spelling, handler identity, failed field/offset and one remedy; no absolute path or binary dump | R6.48 |
| ST-167 | Path traversal or symlink escape in a native request | `PROJECT_PATH_INVALID`; no file outside the project root is read | AC-33 |
| ST-168 | Oversized count or arithmetic overflow in a native file | E10204 naming the field; no allocation, wrap or parser exhaustion | AC-33 |
| ST-169 | Hostile asset name/tag containing ACME syntax | Never emitted as an ACME directive or string; no source injection | AC-33 |
| ST-170 | `.spd` or `.ctm` before its handler is registered | E10204 before raw fallback; no producer bytes embedded | AR-53 |

### SpritePad 3.80 / SPD v5 (unblocked; vendor manual + local examples)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|-----------------------------|--------|
| ST-7 | `ChromeFont.spd` with no selector | Handler `spritepad`, default `sprites`, exact `64*N` bytes and manifest hash | R6.9, R6.12 |
| ST-8 | `Hexagone (5x5).ctm` with no selector | E10132 listing available selectors | R6.13 |
| ST-9 | `embed("ChromeFont.spd", "nope")` | E10133 listing the available selector inventory | R6.3 |
| ST-19 | `ChromeFont.spd` default embed | `sprites` = 64 native bytes per sprite; `count`, three colors, `sprite_attributes` exact from manifest | R6.9, R6.12 |
| ST-20 | `SpriteAnimations01.spd` every available selector | Every optional selector present with exact type/length/hash | R6.10, R6.12 |
| ST-21 | `Expanded Sprite Test.spd` tile counts/indices | Wide counts accepted with exact outputs and no truncation | R6.8, R6.12 |
| ST-22 | `Expanded Sprite Test.spd` tile selectors | `tile_count`, `tile_width`, `tile_height`, `tiles` exact | R6.10 |
| ST-23 | Synthetic SPD v5 tile-attributes case | `tile_attributes` exact | R6.10 |
| ST-24 | Synthetic SPD v5 tile-tags case | `tile_tags` exact | R6.10 |
| ST-25 | Real/synthetic SPD v5 overlay case | Both overlay distances exact | R6.10 |
| ST-26 | `SpriteAnimations01.spd` sprite animation | Count, starts, ends, timers, flags exact | R6.10 |
| ST-27 | Synthetic SPD v5 tile-animation case | Count, starts, ends, timers, flags exact | R6.10 |
| ST-28 | Selector absent from parsed optional set | E10133 listing the available names | R6.10 |
| ST-29 | SPD v4 file | E10204 at the version byte, no bytes | R6.8, AC-09 |
| ST-30 | SPD v6 file | E10204 at the version byte, no bytes | R6.8, AC-09 |
| ST-31 | Truncation at every block boundary | E10204 naming the block, required and remaining bytes | R6.8, AC-09 |
| ST-32 | Declared sprite count disagrees with records | E10204 naming count and record boundary | R6.8, AC-09 |
| ST-33 | Invalid sprite index in tiles/animations | E10204 naming the index and count | R6.8, AC-09 |
| ST-34 | Invalid packed attribute | E10204 naming the record and byte | R6.8, AC-09 |
| ST-35 | Unexplained trailing bytes | E10204 at the exact EOF offset | R6.8, AC-09 |
| ST-36 | `"sprite_attributes"` selected | One byte per sprite derived from record byte 63; no bitmap copy | R6.9, AR-45 |
| ST-37 | `"sprites"` placed | 64-byte alignment, VIC bank visibility, exact block count | R6.11, AC-10 |
| ST-38 | 256 records plus active screen | E10273 with interval evidence before ACME | R6.43, AC-10 |
| ST-39 | 128 records plus active screen | Fits in bank 0 with exact intervals and no overlap | R6.43, AC-10 |
| ST-40 | `"multicolor"`, `"base_block"` or another invented name | E10133; no file-wide multicolor or base block exists | R6.9, AC-07 |
| ST-187 | Retained `assets/bad.spd` (`01 02 03`) | Exactly one E10204 whose message matches the structural-failure regex; primary span is the embed call; no asset emitted | RD-06 retained fixture |

### CharPad 3.80 / CTM v9 (unblocked; vendor manual + local examples)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|-----------------------------|--------|
| ST-41 | `Hexagone (5x5).ctm` | `charset`, `map`, `colors`, `color_method`, dimensions exact; `tile_mode=false`, `tile_width=1`, `tile_height=1` | R6.14, R6.19 |
| ST-42 | `C64 ROM Upper Case.ctm` every available selector | Every selector present with exact type/length/hash | R6.14, R6.19 |
| ST-43 | Synthetic CTM v9 wide boundary | Wide dimensions/counts accepted, exact outputs | R6.13, R6.19 |
| ST-44 | Tile-mode fixture | `tiles`, `tiles_word`, `tiles_low/high`, `tiles_packed12` exact | R6.14–R6.16 |
| ST-45 | No-tile fixture | `tiles`, `tiles_word`, `tiles_low/high`, `tiles_packed12` absent → E10133; `tile_mode=false` | R6.14 |
| ST-46 | Every referenced index ≤ 255 | `map` and `tiles` are `byte[]` | R6.15, AC-12 |
| ST-47 | One index = 256 | `map` and `tiles` are little-endian `word[]` | R6.15, AC-12 |
| ST-48 | Declared `byte[]` when `word[]` required | E10144 reporting required `word[]` | R6.15, AC-12 |
| ST-49 | `$123,$456,$789` packed-12 | Exactly `$23,$56,$89,$41,$07` | R6.17, AC-13 |
| ST-50 | Odd packed-12 count | Final absent value contributes zero in the upper nibble | R6.17, AC-13 |
| ST-51 | Max index 4095 / 4096 | 4095 available; 4096 absent → E10133 | R6.17, AC-13 |
| ST-52 | `tiles_low` only | Only the low plane is emitted; no high/canonical companion | R6.16 |
| ST-53 | `map_high` only | Only the high plane is emitted; no low/canonical companion | R6.16 |
| ST-54 | CTM v9 no selector | E10132; handler has no default | R6.13 |
| ST-55 | CTM v8 | E10204 at the version byte | R6.13, AC-15 |
| ST-56 | CTM v10 | E10204 at the version byte | R6.13, AC-15 |
| ST-57 | Wrong `$DABn` block order | E10204 naming the expected/actual block | R6.13, AC-15 |
| ST-58 | Truncation at every block boundary | E10204 naming the block and lengths | R6.13, AC-15 |
| ST-59 | Trailing bytes | E10204 at the exact EOF offset | R6.13, AC-15 |
| ST-60 | Invalid map/tile/character index | E10204 naming the index and referenced set | R6.13, AC-15 |
| ST-61 | `"charset"` placed | 2,048-byte alignment and VIC bank visibility | R6.18 |
| ST-62 | Charset forced into character ROM | E10273 naming the character-ROM window | R6.18 |
| ST-63 | `"colors"` and `"color_method"` | Exact native color table and method byte | R6.14 |
| ST-64 | `"map_width"`, `"map_height"` | Exact word dimensions | R6.14 |
| ST-65 | Unknown CharPad selector | E10133 listing available names | R6.14 |

### PSID v1–v4 and callable audio (unblocked)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|-----------------------------|--------|
| ST-14 | PSID `init_address` on a valid file | Typed `word` scalar with the exact header value; no resident bytes | R6.5, R6.6 |
| ST-15 | PSID `init_address` declared as `byte` | E10144 reporting required `word` | R6.5 |
| ST-16 | PSID `data` used where a scalar is required | E10142 | R6.5 |
| ST-66 | PSID v1 fixed load | `data` exact; `init_address`/`play_address` exact; data offset `$0076` | R6.20, R6.21 |
| ST-67 | PSID v1 zero load | First two payload bytes are little-endian load and stripped; zero init resolves to it | R6.21, AC-16 |
| ST-68 | PSID v2 fixed load | Data offset `$007C`; flags decoded | R6.20, AC-16 |
| ST-69 | PSID v3 fixed load | Second-SID field validated | R6.20, AC-16 |
| ST-70 | PSID v4 payload load | Third-SID field validated; load stripped | R6.20, AC-16 |
| ST-71 | Big-endian header fields | Version, offset, addresses, songs and flags decode big-endian | R6.20, AC-16 |
| ST-72 | `RSID` magic | E10204 before selector exposure | R6.20, AC-17 |
| ST-73 | Compute! MUS payload | E10204 | R6.20, AC-17 |
| ST-74 | PlaySID-dependent flag | E10204 | R6.20, AC-17 |
| ST-75 | Zero play address | E10204 | R6.20, AC-17 |
| ST-76 | Play outside emitted interval | E10204 naming the address and interval | R6.20 |
| ST-77 | Init outside emitted interval | E10204 naming the address and interval | R6.20 |
| ST-78 | Load range wraps past `$10000` | E10204 with the computed range | R6.20, AC-17 |
| ST-79 | Songs = 0 | E10204 | R6.20 |
| ST-80 | Songs = 257 | E10204 | R6.20 |
| ST-81 | Start song = 0 | E10204 | R6.20 |
| ST-82 | Start song > songs | E10204 | R6.20 |
| ST-83 | Specific incompatible video standard | E10261, no conversion | R6.22, AC-17 |
| ST-84 | Specific incompatible SID model | E10261, no conversion | R6.22, AC-17 |
| ST-85 | Second/third SID endpoint on one-SID profile | E10261 | R6.22, AC-17 |
| ST-86 | Unknown video/model | Embed accepted; no callable compatibility claim | R6.22, AC-18 |
| ST-87 | Plain PSID `audioInitDefault(&MUSIC)` | E10256 naming the missing exact contract | R6.23, AC-18 |
| ST-88 | Plain PSID each `c64.audio` operation | E10256 for every operation | R6.23 |
| ST-89 | Contract missing requested cue/voice/operation | E10257 listing available forms | R6.23 |
| ST-90 | Non-reentrant operation reachable from mainline and IRQ | E10258 naming both domains | R6.25 |
| ST-91 | Source `place(at)` differs from PSID fixed load | E10273 naming both constraints | R6.21, R6.44 |
| ST-93 | `embed("a.sid")` | Default `"data"` selector | R6.21 |
| ST-181 | PSID with a specific compatible video/model set | Embed accepted; a matching synthetic contract can call it | R6.22, AC-18 |

### Koala (unblocked)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|-----------------------------|--------|
| ST-94 | Exact 10,003-byte `$6000` Koala | `bitmap` 8,000; `screen` 1,000; `color_ram` 1,000; `background` 1 byte; exact hashes | R6.27, R6.28, AC-21 |
| ST-95 | Same bytes with `.koa` extension | Same handler and outputs | R6.27 |
| ST-96 | Koala with no selector | E10132 listing the four selectors | R6.27 |
| ST-97 | Wrong file length | E10204 naming actual/required length | R6.27, AC-24 |
| ST-98 | Wrong load address | E10204 naming the address | R6.27 |
| ST-99 | Color RAM byte with high nibble set | Full byte preserved; low nibble is the VIC color meaning | R6.29, AC-22 |
| ST-100 | Background byte with high nibble set | Full byte preserved; low nibble is the VIC color meaning | R6.29, AC-22 |
| ST-101 | Only `"bitmap"` selected | Only 8,000 bytes emitted; no screen/color/background companion | R6.28, AC-21 |
| ST-102 | Bitmap placed | 8-KiB alignment, VIC bank 0 visibility | R6.30, AC-23 |
| ST-103 | Screen placed | 1-KiB alignment, VIC bank 0 visibility | R6.30, AC-23 |
| ST-104 | Bitmap and screen selected together | Same VIC bank, exact nonoverlapping intervals | R6.30, AC-23 |
| ST-105 | `vicBitmapSelect(&BITMAP)` | Exact pure field constant `((offset / $2000) & $01) << 3` | R6.41, AC-23 |
| ST-106 | `vicScreenSelect(&SCREEN)` | Exact pure field constant `((offset / $0400) & $0f) << 4` | R6.41, AC-23 |
| ST-107 | Bitmap/screen forced into character ROM | E10273 naming the window | R6.30 |
| ST-108 | Handler import only | No implicit Color RAM transfer, no duplicate image | R6.30, AC-29 |
| ST-109 | User-authored Color RAM transfer | Transfer bytes/cycles reported separately from asset bytes | R6.30, AC-23 |
| ST-110 | Malformed `.kla` | E10204; never raw fallback | R6.31, AC-24 |
| ST-186 | Bitmap and screen fields combined | Bitmap and screen field constants OR to the exact `$D018` value | R6.41 |

### Compile-time refinement and Q-P15 (unblocked)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|-----------------------------|--------|
| ST-111 | `comptime function` reads embedded array and returns transformed fixed array | Exact output bytes; no target code for the transformation | R6.32, R6.33, AC-25 |
| ST-112 | `comptime function` reads embedded scalar | Exact compile-time value used in the result | R6.32 |
| ST-113 | Transformation inspected in `.asm`/`.memory.json` | No target instructions, SFA homes, stack use or helper payload for the transformation | R6.33, AC-25 |
| ST-114 | Visible embed referenced twice | Bytes not charged twice; transformation steps charged | R6.33, AC-25 |
| ST-115 | Compile-time step budget exceeded | E10269 with the rejected operation and root | R6.33 |
| ST-116 | `comptime function` calls `embed()` | E10135 | R6.33 |
| ST-117 | `comptime function` calls `peek()`/`poke()` | E10191 | R6.33 |
| ST-118 | `comptime function` calls an ordinary/runtime function | E10191 | R6.33 |
| ST-119 | `comptime function` reads environment/time/random | Not expressible; no such source operation exists | R6.33 |
| ST-120 | Q-P15 artifact | Exact bytes, masks, priority metadata and one reported multicolor conflict | R6.36, AC-26 |
| ST-121 | Q-P15 two source-selected representations | Each emits only its own exact representation | R6.36, AC-26 |
| ST-122 | Q-P15 reuse/padding/alignment/VIC | Exact reuse, padding, alignment and visibility, no silent copies | R6.36, AC-26 |
| ST-123 | Q-P15 static inspection | No hidden copy, duplicate image, offset table or runtime transcoding | R6.36, AC-29 |
| ST-124 | Q-P15 VICE draw/occlusion | Expected draw order and foreground occlusion | R6.37, AC-27 |
| ST-125 | Q-P15 changed panel and Color RAM transfer | Expected update behavior and explicit transfer cost | R6.37, AC-27 |
| ST-126 | Q-P15 worst-case cycle record | Recorded separately and honestly; unavailable terms `Unknown` | R6.37, AC-27 |
| ST-127 | Q-P15 renderer cost | Reported separately from asset bytes and compiler metadata | R6.37, AC-27 |
| ST-128 | Public package/example inspection | No renderer, scene runtime, scheduler or game API | R6.37, AC-36 |

### Resident layout and evidence (unblocked)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|-----------------------------|--------|
| ST-92 | PSID fixed load outside resident range | E10273 with the interval evidence | R6.21, R6.43 |
| ST-129 | Complete resident program | Every code/global/SFA/asset/player/screen/charset/bitmap interval nonoverlapping | R6.39, AC-28 |
| ST-130 | Every interval | Contained in its view and address space | R6.39 |
| ST-131 | 128 sprite records plus screen | Fits in bank 0 with exact intervals | R6.43 |
| ST-132 | 256 sprite records plus screen | Fails before ACME with bank/interval evidence | R6.43, AC-10 |
| ST-133 | Misaligned sprite asset | E10143 naming the 64-byte requirement | R6.11 |
| ST-134 | Misaligned charset | E10143 naming the 2,048-byte requirement | R6.18 |
| ST-135 | Misaligned bitmap | E10143 naming the 8,192-byte requirement | R6.30 |
| ST-136 | Misaligned screen | E10143 naming the 1,024-byte requirement | R6.30 |
| ST-137 | Charset or code/data in character-ROM window | E10273 naming the window; existing fixtures audited | R6.18, R6.39 |
| ST-138 | Bitmap/screen mixed bank | E10273 naming both objects | R6.30 |
| ST-139 | `place(region: c64.vic.bank0)` | Accepted when all other constraints pass | R6.44, AR-5 |
| ST-140 | `place(region: c64.vic.bank1)` | E10272; region unavailable in the selected profile | AR-5 |
| ST-141 | Source `place(at)` conflicts with another interval | E10273 naming every contributor | R6.44 |
| ST-142 | `vicSpriteBlock(&SPRITES)` after placement | Exact block index, no runtime calculation | R6.41 |
| ST-143 | `vicCharsetSelect(&CHARSET)` after placement | Exact pure `$D018` character field | R6.41 |
| ST-144 | `vicBitmapSelect(&BITMAP)` after placement | Exact pure `$D018` bitmap field | R6.41 |
| ST-145 | `vicScreenSelect(&SCREEN)` after placement | Exact pure `$D018` screen field | R6.41 |
| ST-146 | `.assets.json` for each handler | Exact handler/version/selector/type/shape/hashes/constraints/placement; scalar records use `compileTime` | R6.46, AC-31 |
| ST-147 | `.memory.json` | Intervals, CPU/VIC/Color RAM views, free intervals, largest hole | R6.42, R6.46 |
| ST-148 | Screen/Color RAM/character ROM accounting | 1,024 / 1,024 / 4,096 addresses, no double counting | R6.42 |
| ST-149 | `.costs.json` | Zero import cost, artifact bytes and explicit runtime transfer separate; unavailable timing `Unknown` | R6.46 |
| ST-150 | `.debug.json` | Asset input, symbol, origin, location and final range records; scalar compile-time symbols | R6.46 |
| ST-151 | `.asm` inspection | Only labels, addresses, alignment/fill and final bytes; no asset path or `!binary` validation | R6.45 |
| ST-152 | Failed import/layout/ACME | No new PRG or evidence generation published | R6.47 |
| ST-153 | Canonical alias | One address and byte count; W10151 | R6.7, AC-06 |
| ST-154 | Cross-sidecar reconciliation | `.assets.json`, `.memory.json`, `.debug.json`, `.build.json` agree | R6.46 |
| ST-182 | Reserved-range overlap or out-of-memory | E10273 with every conflicting interval and no artifact | R6.42, AC-30 |
| ST-185 | Sprite set fits only in a legal hole below `$2000` | Placement succeeds at the lowest legal hole | R6.43 |

### Fixtures, qualification and closeout

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|-----------------------------|--------|
| ST-155 | Fixture tree and manifest | Every fixture media file has exactly one entry; every entry resolves and hashes match; tools are excluded | R6.49, AC-32 |
| ST-156 | Manifest hash mismatch | Test fails with expected/actual | R6.49 |
| ST-157 | Public PSID fixture construction | Deterministic bytes, spec-derived header fields and manifest hash | R6.26 |
| ST-158 | Public Koala fixture construction | Deterministic 10,003 bytes and manifest hash | R6.27 |
| ST-159 | Producer checkpoint without `MIN` or owner/completion | Checkpoint blocked; decoder task does not run | R6.12, R6.19, AR-51 |
| ST-160 | Producer checkpoint with wrong version | Rejected; never relabelled | R6.1, R6.12 |
| ST-161 | Status text | Names exact handler identities, selectors, profiles and evidence level | R6.52, AC-35 |
| ST-162 | VICE-only evidence | Reported `VICE-verified / hardware-unverified` | R6.52 |
| ST-163 | Host observations | Per-handler parse/type/layout/build duration and peak memory recorded as trends; refreshed at closeout | R6.56 |
| ST-164 | Deferral-expiry closeout | Every due item re-owned; no deferral names closed RD-06 work | R6.53, AC-37 |
| ST-183 | Impact-based verification record | One record lists focused handler/frontend/layout/ACME/VICE tests and one complete RD-06 run; no repeated unrelated corpora | AC-34 |
| ST-180 | Source/manifest/asset changes during capture | Complete retry or deterministic failure; no mixed input hashes | AC-03 |
| ST-184 | Mutable/runtime-local/explicit-extent/element-type mismatch | Specification 4 diagnostic and no artifact | AC-04 |

### GoatTracker 2.77 adapter (moved out of RD-06)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|-----------------------------|--------|
| — | GoatTracker 2.77 adapter | Moved to a follow-up feature (AR-58); not an RD-06 specification case | R6.24–R6.25 |

## Test Categories

### Specification tests

| Test file | ST cases | Component |
| --- | --- | --- |
| `packages/compiler/src/assets/asset-handler.spec.test.ts` | ST-1–ST-6, ST-10–ST-13, ST-17, ST-18 | Core dispatch, identity, typing |
| `test/rd06/frontend-assets.spec.test.ts` | ST-165 | Frontend asset metadata |
| `test/rd06/security-assets.spec.test.ts` | ST-166–ST-170 | Diagnostic quality, path containment, reserved extensions, overflow and injection |
| `packages/compiler/src/assets/c64/spritepad.spec.test.ts` | ST-7–ST-9, ST-19–ST-40, ST-187 | SpritePad (blocked) |
| `packages/compiler/src/assets/c64/charpad.spec.test.ts` | ST-41–ST-65 | CharPad (blocked) |
| `packages/compiler/src/assets/c64/psid.spec.test.ts` | ST-66–ST-91, ST-93, ST-181 | PSID |
| `packages/compiler/src/assets/c64/koala.spec.test.ts` | ST-94–ST-101, ST-108, ST-110 | Koala parser/components |
| `test/rd06/comptime-assets.spec.test.ts` | ST-111–ST-119 | Compile-time refinement |
| `test/rd06/qp15.spec.test.ts` | ST-120–ST-128 | Q-P15 |
| `test/rd06/layout-assets.spec.test.ts` | ST-92, ST-102–ST-107, ST-109, ST-129–ST-154, ST-182, ST-185, ST-186 | Layout, VIC fields and evidence |
| `test/rd06/integration.spec.test.ts` | Integration of ST-1–ST-154 | Whole pipeline |
| `test/rd06/aliasing.spec.test.ts` | ST-11–ST-13 | Canonical aliasing |
| `test/rd06/blocked-gates.spec.test.ts` | ST-159, ST-160 | Blocked-family honesty |
| `test/rd06/examples.spec.test.ts` | ST-128, ST-161 | Example builds |
| `test/rd06/fixtures.spec.test.ts` | ST-155–ST-164, ST-180, ST-183, ST-184 | Fixtures/status/closeout |


### Implementation tests

| Test file | Description | Priority |
| --- | --- | --- |
| `packages/compiler/src/assets/asset-handler.impl.test.ts` | Identity collisions, owner edges, selector ordering, reserved extensions, diagnostic spans | High |
| `packages/compiler/src/assets/c64/psid.impl.test.ts` | Offset arithmetic, reserved flags, relocation, boundary values, malformed derivations | High |
| `packages/compiler/src/assets/c64/koala.impl.test.ts` | Component boundary arithmetic, high-bit preservation, extension casing | High |
| `packages/compiler/src/assets/c64/audio-contract.impl.test.ts` | Contract validation, pruning, overlap, cost records | High |
| `packages/compiler/src/layout/c64-layout-assets.impl.test.ts` | First-fit cursor, noCross, alignment, derived fields, free intervals, full-bank holes | High |
| `test/rd06/evidence-assets.impl.test.ts` | Sidecar canonical order, extended ids, compile-time scalars, cross-sidecar reconciliation | High |
| `test/rd06/security-assets.impl.test.ts` | Path containment, hostile names/tags, overflow boundaries, diagnostic redaction, ACME injection | High |
| `packages/compiler/src/frontend/comptime-assets.impl.test.ts` | Budget and aggregate-read internals | High |
| `test/rd06/fixtures.impl.test.ts` | Manifest duplicate/unlisted/hash-mismatch cases | High |
| `packages/compiler/src/assets/c64/spritepad.impl.test.ts` | Optional-matrix and malformed derivations | High |
| `packages/compiler/src/assets/c64/charpad.impl.test.ts` | Block order, truncation, width and packed-12 internals | High |


### Integration and end-to-end tests

| Test | Components | Description |
| --- | --- | --- |
| `test/rd06/integration.spec.test.ts` | Dispatch, handlers, layout, evidence, ACME | One complete build per unblocked family |
| `test/rd06/aliasing.spec.test.ts` | Identity, layout, evidence | Same/different selector aliasing |
| `test/rd06/blocked-gates.spec.test.ts` | Manifest and gates | Missing producer evidence cannot be reported as verified |
| `test/rd06/vice-psid.spec.test.ts` | PSID, layout, VICE | Fixed load and payload load address at runtime |
| `test/rd06/vice-koala.spec.test.ts` | Koala, layout, VICE | Bitmap/screen visibility and Color RAM transfer |
| `test/rd06/vice-qp15.spec.test.ts` | Q-P15, VICE | Draw order, occlusion, update, cycle evidence |
| `test/rd06/vice-spritepad.spec.test.ts` | SpritePad, VICE | Producer rendering check (blocked) |
| `test/rd06/vice-charpad.spec.test.ts` | CharPad, VICE | Charset visibility (blocked) |

## Test Data

### Fixtures needed

- `test/rd06/fixtures/manifest.json`
- `test/rd06/fixtures/public/raw/`
- `test/rd06/fixtures/public/psid/`
- `test/rd06/fixtures/public/koala/`
- `test/rd06/fixtures/spritepad/` (blocked)
- `test/rd06/fixtures/charpad/` (blocked)
- `test/rd06/fixtures/goattracker/` (moved to a follow-up; not an RD-06 fixture family)
- `test/rd06/fixture-tools/` (schema, checkpoint validator, fixture builders)

### Mock requirements

No mock parser or comparative decoder. Real compiler services, real ACME, real VICE for hardware
checks. Synthetic audio contracts are real typed records used to test contract validation; they are
not a player-adapter qualification.

## AC Coverage Map

| AC | ST cases | AC | ST cases |
| --- | --- | --- | --- |
| AC-01 | ST-1, ST-7, ST-8, ST-41, ST-66, ST-94, ST-170 | AC-20 | Moved out (AR-58) |
| AC-02 | ST-4, ST-5, ST-6, ST-8, ST-9, ST-54, ST-96 | AC-21 | ST-94, ST-95, ST-101 |
| AC-03 | ST-180 | AC-22 | ST-99, ST-100 |
| AC-04 | ST-15, ST-16, ST-184 | AC-23 | ST-102–ST-106, ST-109 |
| AC-05 | ST-101, ST-121, ST-122 | AC-24 | ST-4, ST-110, ST-170 |
| AC-06 | ST-11, ST-12, ST-13 | AC-25 | ST-111–ST-115 |
| AC-07 | ST-19, ST-36, ST-37 | AC-26 | ST-120–ST-123 |
| AC-08 | ST-20–ST-28 | AC-27 | ST-124–ST-127 |
| AC-09 | ST-29–ST-35 | AC-28 | ST-129, ST-130 |
| AC-10 | ST-37–ST-39, ST-132 | AC-29 | ST-108, ST-123, ST-151 |
| AC-11 | ST-41–ST-44, ST-55–ST-57 | AC-30 | ST-182 |
| AC-12 | ST-46–ST-48 | AC-31 | ST-146–ST-150 |
| AC-13 | ST-49–ST-51 | AC-32 | ST-155, ST-156, ST-159, ST-160 |
| AC-14 | ST-44, ST-45, ST-52, ST-53 | AC-33 | ST-166–ST-169 |
| AC-15 | ST-55–ST-60 | AC-34 | ST-183 |
| AC-16 | ST-66–ST-71 | AC-35 | ST-161, ST-162 |
| AC-17 | ST-72–ST-85 | AC-36 | ST-128 |
| AC-18 | ST-83–ST-87, ST-181 | AC-37 | ST-164 |
| AC-19 | Moved out (AR-58) | — | — |

## Verification Checklist

- [ ] All specification test cases (ST-*) defined with concrete input/output pairs
- [ ] Every ST case traces to a requirement, spec doc, or AR entry
- [ ] Every AC-01–AC-37 appears in the coverage map
- [ ] Specification tests written BEFORE implementation
- [ ] Specification tests verified to FAIL before implementation (red phase)
- [ ] All specification tests pass after implementation (green phase)
- [ ] Implementation tests written for edge cases and internals
- [ ] All unit / integration / E2E tests pass
- [ ] No regressions in existing tests
- [ ] Blocked families are not reported as verified
- [ ] VICE tests reuse the pinned harness and run sequentially
