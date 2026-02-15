# Testing Strategy: Data Alignment

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit tests: All new lexer tokens, parser paths, semantic validation, emitter output
- Integration tests: Full pipeline from source to assembly
- E2E tests: Compile real example programs and verify output

## Test Categories

### Lexer Tests (~15 tests)

| Test | Description | Priority |
|------|-------------|----------|
| Tokenize `@sprite` | New keyword token | High |
| Tokenize `@charset` | New keyword token | High |
| Tokenize `@screen` | New keyword token | High |
| Tokenize `@bitmap` | New keyword token | High |
| Tokenize `@page` | New keyword token | High |
| Tokenize `@data(` | Existing @data with paren | High |
| Tokenize `@ram(` | Existing @ram with paren | High |
| Tokenize `align:` | Keyword inside parens | High |
| Sugar keywords as identifiers | `sprite` used as variable name still works | Medium |

### Parser Tests (~20 tests)

| Test | Description | Priority |
|------|-------------|----------|
| Parse `@sprite const s: byte[] = [1,2,3]` | Sugar → alignment: 64 | High |
| Parse `@charset const f: byte[2048] = [...]` | Sugar → alignment: 2048 | High |
| Parse `@screen const s: byte[1000] = [...]` | Sugar → alignment: 1024 | High |
| Parse `@bitmap const b: byte[8000] = [...]` | Sugar → alignment: 8192 | High |
| Parse `@page const t: byte[256] = [...]` | Sugar → alignment: 256 | High |
| Parse `@data(align: 64) const s: byte[] = [1]` | Core syntax | High |
| Parse `@data(align: 256) const t: byte[256] = [...]` | Core with 256 | High |
| Parse `@ram(align: 64) let buf: byte[64]` | RAM alignment | High |
| Parse `@data(align: 64) let s: byte[] = [1]` | Error: requires const | High |
| Parse `@sprite let s: byte[] = [1]` | Error: requires const | High |
| Parse `@sprite const s: byte[]` | Error: requires initializer | High |
| Parse `@data(align: 7) const s: byte[] = [1]` | Error: not power of 2 | High |
| Parse `@data(align: 0) const s: byte[] = [1]` | Error: zero alignment | Medium |
| Parse `@data(align: 32768) const s: byte[] = [1]` | Error: too large | Medium |
| Alignment value preserved in AST | Check AST node | High |
| Sugar desugars correctly | @sprite AST == @data(align:64) AST | High |

### Semantic Tests (~10 tests)

| Test | Description | Priority |
|------|-------------|----------|
| Valid alignment values (2,4,8,...,16384) | All pass | High |
| Invalid alignment: non-power-of-2 | Error produced | High |
| @sprite requires const | Error if let | High |
| @sprite requires initializer | Error if no value | High |
| Alignment propagated to GlobalSlot | Check slot.alignment | High |
| @sprite inside function | Error: module-level only | High |

### Emitter Tests (~10 tests)

| Test | Description | Priority |
|------|-------------|----------|
| @sprite emits `!align 63, 0` | Check assembly output | High |
| @charset emits `!align 2047, 0` | Check assembly output | High |
| @page emits `!align 255, 0` | Check assembly output | High |
| @data(align: 64) emits `!align 63, 0` | Check assembly output | High |
| No alignment → no !align directive | Backward compatible | High |
| !align placed BEFORE data label | Order check | High |
| Multiple aligned data blocks | Each gets own !align | Medium |

### E2E Pipeline Tests (~10 tests)

| Test | Description | Priority |
|------|-------------|----------|
| Balloon sprite with @sprite | Full compile, check ASM | High |
| Space shooter with @sprite | Full compile, check ASM | High |
| Custom charset with @charset | Full compile, check ASM | High |
| Lookup table with @page | Full compile, check ASM | High |
| Mixed @sprite + @data + @page | Full compile | High |
| @data(align: 64) identical to @sprite | Output comparison | High |

## Verification Checklist

- [ ] All new lexer tokens recognized correctly
- [ ] All parser paths produce correct AST
- [ ] All semantic validations catch errors
- [ ] All sugar keywords desugar correctly
- [ ] Emitter produces correct !align directives
- [ ] All existing 8830 tests still pass
- [ ] Example programs compile successfully
- [ ] No regressions in any compiler phase
