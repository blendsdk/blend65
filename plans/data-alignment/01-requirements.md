# Requirements: Data Alignment

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Add memory alignment support to `@data` and `@ram` storage classes so the assembler
places data at hardware-required boundaries. The VIC-II, SID, and REU all require
data at specific alignments.

## Functional Requirements

### Must Have

- [ ] `@data(align: N)` syntax — emit `!align (N-1), 0` before data label
- [ ] `@ram(align: N)` syntax — emit `!align` for mutable aligned buffers
- [ ] Semantic sugar: `@sprite` → `@data(align: 64)`
- [ ] Semantic sugar: `@charset` → `@data(align: 2048)`
- [ ] Semantic sugar: `@screen` → `@data(align: 1024)`
- [ ] Semantic sugar: `@bitmap` → `@data(align: 8192)`
- [ ] Semantic sugar: `@page` → `@data(align: 256)`
- [ ] Validation: N must be power-of-2, range 2–16384
- [ ] Validation: `@sprite`/`@charset`/etc. require `const` and initializer (same as @data)
- [ ] Language specification updated
- [ ] Comprehensive tests (lexer, parser, semantic, e2e)

### Should Have

- [ ] Clear error messages for invalid alignment values
- [ ] Warning if alignment wastes excessive padding bytes

### Won't Have (Out of Scope)

- `@data($2000)` exact address placement (future feature)
- `@` address-of operator computing pointer at assembly time (future feature)
- `memcpy` intrinsic (separate feature)

## Alignment Sugar Mapping

| Sugar | Desugars To | Alignment | Use Case |
|-------|------------|-----------|----------|
| `@sprite` | `@data(align: 64)` | 64 | VIC-II sprite data |
| `@charset` | `@data(align: 2048)` | 2048 | VIC-II custom character set |
| `@screen` | `@data(align: 1024)` | 1024 | VIC-II screen memory |
| `@bitmap` | `@data(align: 8192)` | 8192 | VIC-II bitmap graphics |
| `@page` | `@data(align: 256)` | 256 | Page-aligned lookup tables |

## Technical Requirements

### Parser Changes
- Recognize `@data(align: N)` parameter syntax
- Recognize `@ram(align: N)` parameter syntax
- Recognize new keywords: `@sprite`, `@charset`, `@screen`, `@bitmap`, `@page`
- Desugar keywords to alignment values at parse time

### AST Changes
- Add `alignment?: number` field to `VariableDeclaration` AST node

### Semantic Changes
- Validate alignment is power-of-2
- Validate alignment range (2–16384)
- Sugar keywords inherit @data rules (require const + initializer)

### Code Generation Changes
- Emit `!align (N-1), 0` ACME directive before data labels when alignment is set
- Pass alignment value through GlobalSlot → FrameSlot → emitter

## Acceptance Criteria

1. [ ] `@sprite const s: byte[] = [...]` compiles and emits `!align 63, 0` before data
2. [ ] `@data(align: 64) const s: byte[] = [...]` produces identical output
3. [ ] Invalid alignment (e.g., align: 7) produces clear error
4. [ ] All existing tests still pass
5. [ ] New tests cover all sugar keywords and edge cases
6. [ ] Language specification updated with examples
7. [ ] Example programs compile successfully
