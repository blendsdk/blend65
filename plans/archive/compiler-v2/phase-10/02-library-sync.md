# Library Sync: system.blend & hardware.blend

> **Document**: 02-library-sync.md
> **Parent**: [Index](00-index.md)

## Overview

Create the v2 library directory structure and rewrite `system.blend` to match the v2 language specification. The v1 `system.blend` contains 19 intrinsic stubs but v2 only has 10 core intrinsics (sizeof removed, CPU/stack ops moved to `asm_*()` functions).

## Directory Structure

```
packages/compiler-v2/library/
├── common/
│   ├── system.blend      ← REWRITE (10 intrinsics only)
│   └── asm.blend          ← NEW (see 03-asm-blend-declarations.md)
├── c64/
│   └── common/
│       └── hardware.blend ← Copy from v1 (uses export const, fully v2-compatible)
└── x16/
    └── common/            ← Empty directory (matching v1 structure for future use)
```

## system.blend Rewrite

### V1 → V2 Changes

| V1 Function | V2 Status | Action |
|-------------|-----------|--------|
| `peek(address: word): byte` | ✅ KEEP | Copy |
| `poke(address: word, value: byte): void` | ✅ KEEP | Copy |
| `peekw(address: word): word` | ✅ KEEP | Copy |
| `pokew(address: word, value: word): void` | ✅ KEEP | Copy |
| `sizeof(t: byte): byte` | ❌ REMOVE | Not in v2 spec |
| `length(value: byte[]): word` | ✅ KEEP | Copy |
| `lo(value: word): byte` | ✅ KEEP | Copy |
| `hi(value: word): byte` | ✅ KEEP | Copy |
| `sei(): void` | ❌ REMOVE | Moved to `asm_sei()` |
| `cli(): void` | ❌ REMOVE | Moved to `asm_cli()` |
| `nop(): void` | ❌ REMOVE | Moved to `asm_nop()` |
| `brk(): void` | ❌ REMOVE | Moved to `asm_brk()` |
| `pha(): void` | ❌ REMOVE | Moved to `asm_pha()` |
| `pla(): byte` | ❌ REMOVE | Moved to `asm_pla()` |
| `php(): void` | ❌ REMOVE | Moved to `asm_php()` |
| `plp(): void` | ❌ REMOVE | Moved to `asm_plp()` |
| `barrier(): void` | ✅ KEEP | Copy |
| `volatile_read(address: word): byte` | ✅ KEEP | Copy |
| `volatile_write(address: word, value: byte): void` | ✅ KEEP | Copy |

### V2 system.blend Content (10 intrinsics)

```js
module system;

// Memory Access Intrinsics
export function peek(address: word): byte;
export function poke(address: word, value: byte): void;
export function peekw(address: word): word;
export function pokew(address: word, value: word): void;

// Byte Extraction Intrinsics
export function lo(value: word): byte;
export function hi(value: word): byte;

// Compile-Time Intrinsics
export function length(value: byte[]): word;

// Optimizer Control Intrinsics
export function barrier(): void;
export function volatile_read(address: word): byte;
export function volatile_write(address: word, value: byte): void;
```

Each function should have JSDoc comments explaining purpose, code generation, and cycle cost (copy from v1 system.blend but update to remove references to sizeof/CPU/stack ops).

## hardware.blend Audit

### Source
`packages/compiler/library/c64/common/hardware.blend`

### Action
**Copy as-is — no changes needed.** The v1 hardware.blend uses only `export const` declarations (e.g., `export const BORDER_COLOR: word = 0xD020;`). It does **NOT** use `@map` syntax. All declarations are pure `export const` with `byte` and `word` types, which are fully compatible with v2.

### Verification Checklist
- [ ] Confirm file copies without modification
- [ ] No references to removed intrinsics (sizeof, sei, cli, etc.)
- [ ] All types are valid v2 types (byte, word) — ✅ already verified
- [ ] All declarations use `export const` — ✅ already verified (no @map usage)

## Testing Requirements

- Verify `system.blend` parses correctly with v2 lexer/parser
- Verify all 10 intrinsic stubs are recognized by v2 semantic analyzer
- Verify `hardware.blend` parses correctly with v2 lexer/parser
- Integration test: LibraryLoader loads both files successfully

## Dependencies

- Library loader must be migrated first (01-infrastructure.md)
- v2 lexer/parser must handle stub function declarations (already implemented)
