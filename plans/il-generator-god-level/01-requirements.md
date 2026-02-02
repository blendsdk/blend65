# Requirements: Beyond God-Level IL Generator

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

---

## Feature Overview

The IL Generator transforms the Abstract Syntax Tree (AST) into a simple linear Intermediate Language (IL) that:

1. **Preserves SFA context** - Every memory operation knows its slot location (ZP, Frame, Register)
2. **Carries optimization hints** - Live ranges, costs, addressing modes pre-computed
3. **Maintains loop structure** - Loop boundaries preserved for later optimizations
4. **Enables efficient codegen** - Code generator can focus on emission, not analysis

---

## Functional Requirements

### Must Have (P0)

#### IL Type System
- [ ] `ILOpcode` enum with 25-30 opcodes covering all operations
- [ ] `ILOperand` type supporting slot-centric references
- [ ] `ILInstruction` interface with operands and metadata
- [ ] `ILFunction` interface containing instructions and frame
- [ ] `ILProgram` interface for complete module

#### Slot-Centric Operands
- [ ] Operands reference `FrameSlot` objects, not raw addresses
- [ ] ZP vs Frame vs Register location accessible
- [ ] Type information preserved through IL

#### Basic IL Generation
- [ ] Generate IL for all literal types (number, string, bool)
- [ ] Generate IL for identifier expressions (variable loads)
- [ ] Generate IL for binary expressions (arithmetic, comparison, logical)
- [ ] Generate IL for unary expressions (negation, not, address-of)
- [ ] Generate IL for assignment expressions
- [ ] Generate IL for function calls (with parameter passing)

#### Control Flow IL
- [ ] Generate IL for if/else statements
- [ ] Generate IL for while loops
- [ ] Generate IL for for loops
- [ ] Generate IL for do-while loops
- [ ] Generate IL for break/continue
- [ ] Generate IL for return statements

#### Function Handling
- [ ] Generate IL for function declarations
- [ ] Generate IL for function parameters
- [ ] Generate IL for return values
- [ ] Handle callback functions appropriately

### Should Have (P1)

#### Register Parameter Optimization
- [ ] Detect first 1-2 parameters that can use registers
- [ ] Generate register-direct IL for register parameters
- [ ] Emit appropriate register transfer instructions

#### Live Range Annotations
- [ ] Track which variables are live at each instruction
- [ ] Annotate instructions with `liveIn` and `liveOut` sets
- [ ] Track `defs` and `uses` for each instruction

#### Addressing Mode Hints
- [ ] Compute optimal addressing mode for each memory access
- [ ] Consider ZP modes (ZP, ZP_X, ZP_Y, Indirect_X, Indirect_Y)
- [ ] Consider absolute modes (Absolute, Absolute_X, Absolute_Y)

#### Cost Model
- [ ] Estimate cycle count for each instruction
- [ ] Estimate byte count for each instruction
- [ ] Track memory access count

### Won't Have (Out of Scope)

- SSA form or PHI nodes (we use simple linear IL)
- Complex register allocation (handled at codegen)
- Machine-specific instruction selection (that's codegen's job)
- Interprocedural optimization (deferred to later phase)

---

## Technical Requirements

### Performance

| Requirement | Target |
|-------------|--------|
| IL generation time | < 10ms for 1000-line program |
| Memory overhead | < 2x AST size |
| Instruction count | ≤ 3x source statement count |

### Compatibility

| Requirement | Details |
|-------------|---------|
| TypeScript version | ES2022 module syntax |
| Dependencies | Only internal compiler-v2 modules |
| SFA integration | Uses `Frame`, `FrameSlot` from frame module |
| AST integration | Consumes AST from parser module |

### Code Quality

| Requirement | Target |
|-------------|---------|
| Test coverage | ≥ 95% |
| JSDoc coverage | 100% for public APIs |
| Lint errors | 0 |
| Type errors | 0 |

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| IL Structure | SSA vs Linear | **Linear** | Simpler, faster compilation, sufficient for 6502 |
| Operand Model | Address-only vs Slot-centric | **Slot-centric** | Full SFA context available, better optimization |
| Optimization Hints | None vs In-IL | **In-IL** | Early decisions enable better codegen |
| Register Params | None vs 1-2 params | **1-2 params** | Major performance win for small functions |
| Loop Structure | Discard vs Preserve | **Preserve** | Enables loop-specific optimizations |

---

## Acceptance Criteria

### Phase 7a: Core IL

1. [ ] `ILOpcode` enum defined with all opcodes
2. [ ] `ILOperand` supports slot references with location info
3. [ ] `ILInstruction` includes operands and source location
4. [ ] `ILBuilder` can emit all opcodes
5. [ ] `ILGenerator` transforms literals and identifiers
6. [ ] `ILGenerator` transforms binary/unary expressions
7. [ ] `ILGenerator` transforms all control flow statements
8. [ ] `ILGenerator` handles function calls correctly
9. [ ] Integration test: AST → IL → human-readable output
10. [ ] All tests passing

### Phase 7b: Optimization Hints

1. [ ] Live range analysis integrated
2. [ ] Instructions annotated with `liveIn`/`liveOut`
3. [ ] Instructions annotated with `defs`/`uses`
4. [ ] Cost model computed for each instruction
5. [ ] Addressing mode hints computed
6. [ ] Register parameter detection working
7. [ ] All tests passing

### Phase 7c: Advanced Features

1. [ ] Loop structure preserved in `ILFunction`
2. [ ] Counted loop detection (for unrolling hints)
3. [ ] Coalesce group awareness in IL
4. [ ] Callback function handling
5. [ ] All tests passing

### Phase 7d: Testing & Validation

1. [ ] Unit tests: ≥ 95% coverage
2. [ ] Integration tests: All control flow patterns
3. [ ] E2E tests: Real Blend programs
4. [ ] Performance tests: Meeting latency targets
5. [ ] Documentation complete

---

## Dependencies

### Internal Dependencies

| Module | What We Need |
|--------|--------------|
| `ast/*` | AST node types, type guards |
| `frame/*` | Frame, FrameSlot, SlotLocation |
| `semantic/*` | SymbolTable, CallGraph |
| `lexer/types` | SourceLocation |

### Build Dependencies

| Tool | Purpose |
|------|---------|
| TypeScript | Compilation |
| Vitest | Testing |
| ESLint | Linting |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Live range analysis too slow | Low | Medium | Use simple backward analysis |
| Slot references create coupling | Medium | Low | Define minimal slot interface |
| Cost model inaccurate | Medium | Low | Make cost model tunable |
| Loop detection complex | Low | Medium | Start with simple patterns |

---

## Related Documents

| Document | Relationship |
|----------|-------------|
| [02-current-state.md](02-current-state.md) | SFA implementation analysis |
| [03-il-types.md](03-il-types.md) | Type definitions |
| [99-execution-plan.md](99-execution-plan.md) | Implementation schedule |