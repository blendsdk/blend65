# Requirements: Go-Intrinsics

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Complete the code generation layer for all 18 Blend65 intrinsic functions. Currently, 12 intrinsics generate proper 6502 assembly code, while 6 intrinsics fall through to placeholder generation (NOP with comment).

## Functional Requirements

### Must Have

- [ ] `brk()` generates `BRK` instruction
- [ ] `barrier()` generates optimization barrier comment (no code)
- [ ] `lo(value)` extracts low byte from word value
- [ ] `hi(value)` extracts high byte from word value
- [ ] `volatile_read(addr)` generates forced `LDA` that cannot be optimized away
- [ ] `volatile_write(addr, val)` generates forced `STA` that cannot be optimized away

### Should Have

- [ ] All intrinsics work correctly in end-to-end compilation
- [ ] Generated code follows existing patterns in instruction-generator.ts
- [ ] Consistent error handling and warning messages

### Won't Have (Out of Scope)

- Optimizer integration (volatile/barrier semantics for optimizer)
- New intrinsics beyond the 18 currently defined
- Changes to IL generator layer (already complete)

## Technical Requirements

### Code Quality

- Follow existing patterns in `instruction-generator.ts`
- Use proper TypeScript types for IL instruction parameters
- Add JSDoc comments to new methods
- Maintain inheritance chain architecture

### Compatibility

- Must not break any existing functionality
- All 6,500+ existing tests must pass
- Generated assembly must be valid ACME assembler syntax

### Performance

- No performance impact on compilation (simple switch cases)
- Generated 6502 code should be optimal (no unnecessary instructions)

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Barrier implementation | NOP vs Comment | Comment | Barrier is optimizer directive only, no runtime cost |
| Volatile operations | Separate handling vs Reuse peek/poke | Reuse with comments | Same code, just different semantics for optimizer |
| lo/hi for constants | Handle specially | Let IL handle | IL generator already folds constants |

## Acceptance Criteria

1. [ ] All 6 missing intrinsics have switch cases in `generateInstruction()`
2. [ ] Each intrinsic generates correct 6502 assembly
3. [ ] All existing tests pass (6,500+)
4. [ ] New tests cover all 6 intrinsics
5. [ ] No placeholder/NOP generation for any intrinsic
6. [ ] Code follows project coding standards (code.md)