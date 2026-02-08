# Requirements: Code Generator

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

The Code Generator is responsible for transforming IL (Intermediate Language) instructions into 6502 assembly code. It is the bridge between the high-level IL representation and the low-level machine code.

## Functional Requirements

### Must Have

- [ ] Generate correct 6502 assembly for ALL IL opcodes (~50 opcodes)
- [ ] Support zero-page and absolute addressing modes
- [ ] Generate function prologues and epilogues
- [ ] Handle all control flow (jumps, branches, labels)
- [ ] Generate code for intrinsics (peek, poke, peekw, pokew, hi, lo)
- [ ] Include runtime routines for software multiply/divide/modulo
- [ ] Generate BASIC stub for program entry
- [ ] Support multiple functions per program
- [ ] Output to ASM-IL intermediate format
- [ ] Track accumulator state for load elimination

### Should Have

- [ ] Generate comments for debugging
- [ ] Efficient addressing mode selection (ZP when possible)
- [ ] Minimal instruction count (within correctness constraints)
- [ ] Clear error messages for unsupported IL

### Won't Have (Out of Scope)

- Complex optimization passes (deferred to ASM-IL Optimizer)
- Register allocation (SFA provides static addresses)
- Inline assembly support (deferred to future phase)
- Multi-target support (C64-only for now)

## Technical Requirements

### Performance

- Code generation should be O(n) where n = IL instruction count
- No exponential blowup for any IL pattern
- Generated code size should be predictable

### Correctness

- Every IL opcode must map to semantically equivalent 6502 code
- Carry/borrow flags must be set correctly for arithmetic
- Branch conditions must match IL comparison semantics
- Function calls must preserve/restore state correctly

### Maintainability

- Each IL opcode handler in its own method
- Clear separation between codegen phases
- Comprehensive JSDoc documentation
- All code follows `.clinerules/code.md` standards

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Output format | Direct ASM text vs ASM-IL | ASM-IL | Enables optimization before emission |
| Branch range | Handle inline vs defer | Defer to optimizer | Keep codegen simple |
| Accumulator tracking | Yes vs No | Yes | Significant code size reduction |
| ZP selection | Codegen vs Frame allocator | Frame allocator | Single source of truth |

## Acceptance Criteria

1. [ ] All 50 IL opcodes have corresponding handlers
2. [ ] Unit tests for every opcode (300+ tests)
3. [ ] Integration tests for IL sequences (150+ tests)
4. [ ] Real-world scenario tests (100+ tests)
5. [ ] 6502-specific tests (100+ tests)
6. [ ] Edge case tests (75+ tests)
7. [ ] Intrinsic tests (50+ tests)
8. [ ] End-to-end tests (75+ tests)
9. [ ] Stress tests (25+ tests)
10. [ ] Total: 875+ tests passing
11. [ ] Complete pipeline works: Source → ... → CodeGen → ASM-IL
12. [ ] Generated code can be assembled with ACME
13. [ ] Generated code runs correctly in VICE emulator

## Dependencies

### Internal Dependencies

| Component | What It Provides |
|-----------|------------------|
| IL Types (`il/enums.ts`) | `ILOpcode` enum |
| IL Structures (`il/structures.ts`) | `ILProgram`, `ILFunction`, `ILInstruction` |
| Frame Types (`frame/types.ts`) | `Frame`, `FrameSlot` with addresses |
| Operands (`il/operands.ts`) | `SlotOperand`, `ImmediateOperand`, etc. |

### External Dependencies

None - code generator has no external package dependencies.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Branch range overflow | Medium | High | Defer long branch handling to optimizer |
| Incorrect flag handling | Medium | High | Comprehensive tests for each comparison |
| Runtime routine bugs | Low | High | Extensive tests for mul/div/mod |
| Accumulator tracking bugs | Medium | Medium | Clear state reset at control flow points |
| Missing IL opcodes | Low | High | Generate compile error for unknown opcodes |