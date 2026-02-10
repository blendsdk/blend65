# Requirements: Global Variables & Storage Classes

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Implement complete support for module-level global variables with storage class directives (`@zp`, `@ram`, `@data`) throughout the entire compiler pipeline — from semantic analysis through frame allocation, IL generation, optimization, and code generation.

## Functional Requirements

### Must Have

- [ ] Global `@zp` variables get ZP addresses and use ZP-mode 6502 instructions
- [ ] Global `@ram` variables get RAM addresses and use absolute-mode instructions
- [ ] Global `@data const` variables are placed in a data segment as raw bytes
- [ ] Default globals (no annotation) get RAM addresses
- [ ] Cross-module `@zp` exports share the same ZP address across modules
- [ ] Optimizer NEVER eliminates `@zp` globals (pinned)
- [ ] Optimizer NEVER caches `@zp` global values across statements (volatile)
- [ ] Optimizer NEVER eliminates `@data` blocks (immutable static data)
- [ ] `@data` requires `const` keyword (compile error without it)
- [ ] `@data` requires initializer (compile error without it)
- [ ] Storage classes inside functions produce clear error message
- [ ] Language specification updated to document all storage class rules
- [ ] ZP overflow produces clear error showing which variable couldn't fit

### Should Have

- [ ] ZP overflow error shows total ZP usage (X/142 bytes)
- [ ] ZP overflow suggests demoting variables to `@ram`
- [ ] Cross-module ZP overflow shows which module's `@zp` variables consume space
- [ ] `@data` arrays emitted as raw bytes (not individual STORE instructions)

### Won't Have (Out of Scope)

- `@zp`/`@ram`/`@data` inside functions (auto-scoring handles locals)
- `@map` hardware register mapping (separate feature)
- Runtime-mutable `@data` (self-modifying data — future feature)
- Global variable auto-scoring for ZP promotion (future feature)
- Stack-based allocation (SFA is stack-less by design)

## Technical Requirements

### Memory Layout

```
$0002-$008F   Zero Page (~142 bytes available)
              - @zp globals (allocated first, cross-module)
              - Auto-scored function locals (remaining space)

$0200-$03FF   Frame Region (~512 bytes)
              - Function parameters and locals
              - @ram globals (or separate region TBD)

$0801         BASIC SYS stub
$080D-$xxxx   Code Segment
$xxxx-$yyyy   Global RAM Region
              - Default globals (no annotation)
              - @ram globals
$yyyy-$zzzz   Data Segment
              - @data const blocks (raw bytes)
```

### Performance

- `@zp` globals use 2-byte ZP instructions (LDA $xx) — saves 1 byte and ~1 cycle vs absolute
- `@ram` globals use 3-byte absolute instructions (LDA $xxxx)
- `@data` arrays are loaded from data segment via absolute or indexed addressing

### Compatibility

- Must not break any existing tests (8000+ tests)
- Must work with existing SFA frame allocation for function locals
- Must work with existing multi-module compilation
- Must work with existing optimizer passes (with protection additions)

## Scope Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Storage classes in functions | Allow / Block | Block | Auto-scoring is optimal for locals |
| `@zp` volatile semantics | Yes / No | Yes | Interrupts can modify `@zp` globals |
| `@data` mutability | const-only / mutable | const-only | Static data shouldn't change |
| Global RAM region | Shared with frame / Separate | Separate | Cleaner memory layout |
| `@data` IL strategy | Individual STOREs / Raw bytes | Raw bytes | Performance for large arrays |

## Acceptance Criteria

1. [ ] `examples/sprite-test/sprite-test.blend` compiles without errors
2. [ ] `@zp` globals get ZP addresses and ZP-mode codegen
3. [ ] `@data const` arrays placed in data segment as raw bytes
4. [ ] Cross-module `@zp` imports resolve to correct ZP addresses
5. [ ] Optimizer preserves all `@zp` and `@data` globals
6. [ ] Clear error messages for invalid usage
7. [ ] Language spec updated
8. [ ] All existing tests still pass
9. [ ] ~140+ new tests passing
10. [ ] No regressions
