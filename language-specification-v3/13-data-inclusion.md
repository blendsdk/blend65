# Chapter 13 — Data Inclusion & Asset Embedding

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F015

---

## 1. Overview

The `embed()` intrinsic includes external binary data into the compiled program at compile time. It supports two modes:

1. **Raw binary inclusion** — embeds file bytes directly, no format interpretation
2. **Format-aware asset import** — uses platform-profile-registered format handlers to parse asset files and extract specific data parts via dot-notation selectors

This eliminates the manual conversion step between third-party asset tools (SpritePad, CharPad, SID editors) and Blend65 source code.

```blend65
// Raw binary — any platform, any file
const LOOKUP: byte[] = embed("table.bin");

// Format-aware — SpritePad file, extract sprite data
const SPRITES: byte[] = embed("player.spd").sprites;
const SPRITE_COLORS: byte[] = embed("player.spd").colors;
```

---

## 2. Syntax

### 2.1 Raw Binary Embed

```ebnf
embed_expr = "embed" , "(" , string_literal , ")" ;
```

```blend65
const DATA: byte[] = embed("filename.bin");
```

The compiler reads the file at compile time and inserts the raw bytes into the data section. The array size is inferred from the file size.

### 2.2 Format-Aware Embed

```ebnf
embed_selector = "embed" , "(" , string_literal , ")" , "." , identifier ;
```

```blend65
const SPRITES: byte[] = embed("player.spd").sprites;
```

The compiler detects the file format (by extension or explicit specifier), invokes the format handler defined in the platform profile, and extracts the named data part.

---

## 3. Rules

### EMB-1 — Compile-Time Only

`embed()` is a compile-time intrinsic. The file is read during compilation. The result is a `const byte[]` — immutable, placed in the data section.

```blend65
const DATA: byte[] = embed("table.bin");    // ✅ const declaration
let DATA: byte[] = embed("table.bin");      // ❌ E10200: embed produces const data
```

### EMB-2 — File Path Relative to Source

The file path is relative to the source file containing the `embed()` call. The compiler searches:
1. Directory of the current source file
2. Directories listed in the `--asset-path` compiler option

### EMB-3 — File Not Found

If the file cannot be found → E10201.

```blend65
const DATA: byte[] = embed("missing.bin");  // ❌ E10201: file not found
```

### EMB-4 — Size Inference

The array size is inferred from the file contents. An explicit size may be provided; if it doesn't match, the compiler reports an error.

```blend65
const DATA: byte[] = embed("table.bin");           // ✅ size inferred
const DATA: byte[256] = embed("table.bin");        // ✅ if file is exactly 256 bytes
const DATA: byte[100] = embed("table.bin");        // ❌ E10202 if file is not 100 bytes
```

### EMB-5 — Format Handlers Are Platform-Profile Defined

Available format handlers and their selectors are defined in the platform profile (→ Ch 15). The core language defines only the `embed()` syntax — format support is extensible.

### EMB-6 — Unknown Selector

If a selector doesn't match any field in the format handler → E10203.

```blend65
const DATA: byte[] = embed("player.spd").unknown;  // ❌ E10203: unknown selector
```

---

## 4. Code Generation

`embed()` data is placed directly in the data/ROM section of the binary — identical to how `const byte[]` initializers are placed. There is no runtime cost. The data is accessed using the same codegen as any `const` array (→ Ch 08, §10.6).

```
; embed("table.bin") — 256 bytes placed in data section
_LOOKUP:
    .incbin "table.bin"    ; assembler directive equivalent
```

---

## 5. Error Codes

| Code | Condition | Message |
|------|-----------|---------|
| E10200 | Embed in non-const context | `embed() produces const data — use 'const' declaration` |
| E10201 | File not found | `Cannot find file '<path>' for embed() — check file path and --asset-path` |
| E10202 | Size mismatch | `embed('<path>') produces <N> bytes but array declares <M> bytes` |
| E10203 | Unknown selector | `Unknown selector '<name>' for format '<format>' — available selectors: <list>` |
| E10204 | Format parse error | `Cannot parse '<path>' as '<format>' — <details>` |

---

## 6. Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **Arrays** (→ Ch 08) | `embed()` produces `const byte[]`. All const array rules apply. `length()` returns the embedded data size. |
| **Variables** (→ Ch 03) | Must be `const`. Cannot be `let`. |
| **Memory model** (→ Ch 11) | Embedded data goes to data section. Adds to binary size. Reported in build summary. |
| **Platform profile** (→ Ch 15) | Format handlers, selector names, and supported file types are platform-profile-defined. |

---

## 7. Examples

### 7.1 Raw Lookup Table

```blend65
module Tables;
const SINE: byte[] = embed("sine256.bin");     // 256-byte sine table
const COSINE: byte[] = embed("cosine256.bin"); // 256-byte cosine table
```

### 7.2 Platform-Specific Asset Import (C64)

```blend65
module Assets;

// SpritePad file — extract parts
const PLAYER_SPRITES: byte[] = embed("player.spd").sprites;
const PLAYER_COLORS: byte[] = embed("player.spd").colors;

// CharPad tilemap
const LEVEL_MAP: byte[] = embed("level1.ctm").map;
const LEVEL_TILES: byte[] = embed("level1.ctm").tiles;

// SID music
const MUSIC: byte[] = embed("ingame.sid").data;
const MUSIC_INIT: word = embed("ingame.sid").initAddress;
const MUSIC_PLAY: word = embed("ingame.sid").playAddress;
```
