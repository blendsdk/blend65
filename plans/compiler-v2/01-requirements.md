# Requirements: Compiler v2

> **Document**: 01-requirements.md  
> **Parent**: [Index](00-index.md)  
> **Status**: Planning Complete

## Feature Overview

The Blend65 Compiler v2 is a complete rewrite of the code generation pipeline using **Static Frame Allocation (SFA)** instead of SSA. This document defines what we're building and the acceptance criteria.

## Why v2?

### Problems with v1 (SSA)

| Problem | Impact |
|---------|--------|
| SSA doesn't fit 6502 | Complex PHI node resolution with only 3 registers |
| Complex codegen | Interference graphs, register allocation, PHI lowering |
| Debugging difficulty | SSA form obscures original program structure |
| Many edge cases | Nested loops, multiple return paths, break/continue |
| Maintenance burden | 6500+ tests still have gaps |

### Benefits of v2 (SFA)

| Benefit | Description |
|---------|-------------|
| Natural 6502 fit | Static memory frames match hardware model |
| Simple codegen | Direct IL-to-ASM mapping |
| Predictable output | Variables have known addresses |
| Fast compilation | Linear algorithms, no graph analysis |
| Easy debugging | Source maps to memory addresses |

---

## Functional Requirements

### Must Have (MVP)

- [ ] **FR-001**: Compile all v2 language constructs
  - Variables with @zp, @ram, @data storage classes
  - All primitive types (byte, word, bool)
  - Arrays (fixed size)
  - All expressions and operators
  - All statements (if, while, for, return)
  - Functions with parameters and return values
  - Module system (import/export)

- [ ] **FR-002**: Intrinsic functions
  - `peek(addr)` - read memory byte
  - `poke(addr, val)` - write memory byte
  - `peekw(addr)` - read memory word
  - `pokew(addr, val)` - write memory word
  - `hi(word)` - extract high byte
  - `lo(word)` - extract low byte
  - `len(array)` - array length (compile-time)

- [ ] **FR-003**: asm_* functions (56 opcodes)
  - All 6502 addressing modes
  - Type-safe signatures
  - Inline assembly generation

- [ ] **FR-004**: Static Frame Allocation
  - Call graph analysis
  - Recursion detection and rejection
  - Static memory allocation per function
  - Frame collision prevention

- [ ] **FR-005**: Error handling
  - Clear error messages with source locations
  - Recursion error with cycle path
  - Type mismatch errors
  - Undefined symbol errors

- [ ] **FR-006**: ACME assembler output
  - Valid ACME syntax
  - Proper C64 memory layout
  - BASIC stub loader

### Should Have (Post-MVP)

- [ ] **FR-007**: ASM peephole optimizer
  - Redundant load elimination
  - Dead store elimination
  - Basic strength reduction

- [ ] **FR-008**: Source maps
  - Map ASM to source lines
  - VICE label file output

### Won't Have (Out of Scope)

- ❌ **Recursion support** - Fundamental SFA limitation
- ❌ **@map syntax** - Replaced by peek/poke
- ❌ **SSA optimizations** - No SSA in v2
- ❌ **Dynamic memory** - No heap, no malloc
- ❌ **Floating point** - 6502 has no FPU

---

## Technical Requirements

### Architecture

| Requirement | Description |
|-------------|-------------|
| **TR-001** | TypeScript implementation |
| **TR-002** | Monorepo package at `packages/compiler-v2/` |
| **TR-003** | Same build toolchain (yarn, turbo, vitest) |
| **TR-004** | Salvage code from v1 where possible |

### Performance

| Requirement | Target |
|-------------|--------|
| **TR-005** | Compile 1000 lines in < 1 second |
| **TR-006** | Memory usage < 100MB for large programs |

### Compatibility

| Requirement | Description |
|-------------|-------------|
| **TR-007** | Output runs on C64 (and compatible) |
| **TR-008** | ACME assembler compatible output |
| **TR-009** | VICE emulator compatible |

---

## Testing Requirements

### Coverage Goals

| Category | Target |
|----------|--------|
| Unit tests | 90%+ coverage per component |
| Integration tests | Full pipeline coverage |
| E2E tests | All language features |

### Test Categories

| Category | Description | Count Target |
|----------|-------------|--------------|
| Lexer | Token recognition | 500+ |
| Parser | AST construction | 1000+ |
| Semantic | Type checking, validation | 500+ |
| Frame Allocator | SFA correctness | 200+ |
| IL Generator | IL output validation | 500+ |
| Code Generator | ASM output validation | 1000+ |
| E2E | Full pipeline tests | 500+ |
| **Total** | | **4200+** |

### Regression Testing

- All v1 test cases that don't use @map syntax
- E2E test fixtures (adapted for v2)
- Example programs must compile and run

---

## Migration Strategy

### From v1 to v2

```
v1 (SSA)                    v2 (SFA)
─────────────────────────────────────────
packages/compiler/      →   packages/compiler-v2/
@map syntax             →   peek/poke intrinsics
SSA IL                  →   Linear IL with frames
PHI nodes               →   Not needed
Complex codegen         →   Direct memory codegen
```

### Salvage Plan

| Component | Strategy |
|-----------|----------|
| Lexer | Copy, remove @map tokens |
| Parser | Copy, remove @map parsing |
| AST | Copy, remove @map nodes |
| Type System | Copy as-is |
| Semantic | Copy, remove SSA prep, add recursion check |
| IL Generator | **Rewrite** for SFA |
| Code Generator | **Rewrite** for SFA |
| ASM-IL Emitter | Copy, minor updates |

---

## Acceptance Criteria

### v2 Compiler Complete When:

1. ✅ All Must Have requirements implemented
2. ✅ 4000+ tests passing
3. ✅ All example programs compile
4. ✅ Output runs correctly in VICE
5. ✅ Error messages are clear and helpful
6. ✅ Documentation is complete

### Quality Gates

| Gate | Criteria |
|------|----------|
| **Alpha** | Core pipeline works, basic programs compile |
| **Beta** | All features implemented, E2E tests pass |
| **Release** | All tests pass, examples verified in VICE |

---

## Scope Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Architecture | SSA / SFA | SFA | Better 6502 fit, simpler |
| Recursion | Allow / Forbid | Forbid | Required for SFA |
| @map | Keep / Remove | Remove | peek/poke is clearer |
| New package | Modify v1 / New | New | Clean start, no conflicts |
| IL complexity | Complex / Simple | Simple | ~20-25 opcodes sufficient |

---

## Related Documents

| Document | Description |
|----------|-------------|
| [02-salvage-analysis.md](02-salvage-analysis.md) | Detailed v1 analysis |
| [07-frame-allocator.md](07-frame-allocator.md) | SFA implementation |
| [99-execution-plan.md](99-execution-plan.md) | Task breakdown |
| [Language Spec v2](../../docs/language-specification-v2/) | Language definition |

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-29 | 1.0 | Initial requirements |