# Requirements: ASM-IL Optimizer

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

The ASM-IL Optimizer is the **second stage** of the Blend65 v2 two-stage optimization pipeline. It transforms ASM-IL (6502 assembly intermediate language) produced by the Code Generator into highly optimized 6502 assembly code.

**Primary Goal**: Produce 6502 assembly code that rivals hand-written assembly in quality and efficiency.

## Functional Requirements

### Must Have (P0)

- [ ] **Pass Manager Integration** - Use existing `AsmOptimizer` infrastructure
- [ ] **Flag Pattern Optimization** - Remove redundant CLC/SEC/CMP operations
- [ ] **Store-Load Elimination** - Remove `STA $X; LDA $X` patterns
- [ ] **Branch Optimization** - Collapse branch/jump chains
- [ ] **Transfer Optimization** - Optimize TAX/TXA/TAY/TYA sequences
- [ ] **Optimization Level Support** - Respect -O0 through -Oz flags
- [ ] **Correctness Preservation** - All optimizations must be semantically correct
- [ ] **Integration Tests** - Full pipeline tests (Blend → ASM)

### Should Have (P1)

- [ ] **Zero-Page Promotion** - Move hot variables to ZP for faster access
- [ ] **6502 Strength Reduction** - Replace expensive ops with cheaper 6502 sequences
- [ ] **Stack Optimization** - Eliminate redundant PHA/PLA pairs
- [ ] **Size Optimization** - Special passes for -Os/-Oz
- [ ] **Statistics Reporting** - Track transformations per pass

### Nice to Have (P2)

- [ ] **Self-Modifying Code** - Optional -Osmc for ultra-tight code
- [ ] **Index Register Selection** - Optimal X vs Y usage
- [ ] **Instruction Scheduling** - Reorder for fewer page-crossing penalties

### Won't Have (Out of Scope)

- Loop analysis and LICM (belongs at IL level)
- Constant propagation (belongs at IL level)
- Dead code elimination (belongs at IL level)
- Multi-module optimization (linker territory)
- Illegal opcode support (portability concern)

## Technical Requirements

### Performance

| Metric | Target |
|--------|--------|
| Compilation overhead | < 50ms for 10KB source |
| Fixed-point iterations | Max 5 (typical: 2-3) |
| Memory overhead | < 2x input module size |

### Compatibility

- **Input**: `AsmModule` from Code Generator
- **Output**: Optimized `AsmModule` (same type)
- **Assembler**: ACME syntax compatible
- **Targets**: C64, Commander X16, generic 6502

### Correctness

- **No semantic changes** - Optimized code must produce identical results
- **Flag preservation** - Cannot remove flag operations that are read later
- **Alias safety** - Cannot optimize across potential aliases
- **Branch range** - Must not create out-of-range branches

## Optimization Level Matrix

### Combined Two-Stage Optimization

| Level | IL Optimizer | ASM-IL Optimizer | Description |
|-------|--------------|------------------|-------------|
| **-O0** | OFF | OFF | Debug, no optimization |
| **-O1** | DCE + ConstFold | Flag + StoreLoad | Fast compile |
| **-O2** | Full | Standard passes | Release builds |
| **-O3** | Full + iter | All + iterations | Maximum perf |
| **-Os** | Full | O2 + size passes | Prefer size |
| **-Oz** | Full + iter | O3 + size focus | Minimum size |

### ASM-IL Optimizer Pass Matrix

| Pass | O0 | O1 | O2 | O3 | Os | Oz |
|------|:--:|:--:|:--:|:--:|:--:|:--:|
| Flag Patterns | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Store-Load | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Branch Opt | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Transfer Opt | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ZP Promotion | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| 6502 Strength | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Stack Opt | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Size Opt | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Fixed-Point | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |

## Pass Descriptions

### Flag Pattern Optimization (O1+)

**Removes redundant flag operations:**

| Pattern | Before | After | Savings |
|---------|--------|-------|---------|
| Dead CLC | `CLC` (carry not read) | (removed) | 2 cycles, 1 byte |
| Dead SEC | `SEC` (carry not read) | (removed) | 2 cycles, 1 byte |
| Redundant CMP | `LDA val; CMP #0` | `LDA val` | 2 cycles, 2 bytes |
| Double flag | `CLC; CLC` | `CLC` | 2 cycles, 1 byte |

### Store-Load Elimination (O1+)

**Removes redundant load after store:**

```asm
; Before
STA $50
LDA $50                     ; REDUNDANT - A still has value!

; After
STA $50
```

**Safety**: Only safe when no intervening alias writes.

### Branch Optimization (O2+)

**Collapses branch/jump chains:**

```asm
; Before
BEQ label1
...
label1: JMP label2

; After
BEQ label2                  ; Direct branch
```

**Patterns:**
- JMP chain collapse
- Conditional branch to JMP → direct conditional
- Dead branch removal (unreachable code after unconditional jump)

### Transfer Optimization (O2+)

**Optimizes register transfer sequences:**

```asm
; Before
TAX
TXA                         ; REDUNDANT - A unchanged

; After
TAX
```

**Patterns:**
- Redundant reverse transfer
- Transfer to unused register
- Transfer chain simplification

### Zero-Page Promotion (O3+)

**Promotes hot variables to zero-page:**

```asm
; Before (absolute)
LDA $0400                   ; 4 cycles, 3 bytes

; After (zero-page)
LDA $50                     ; 3 cycles, 2 bytes
```

**Algorithm:**
1. Count variable access frequency
2. Rank by hotness = frequency × (cycles_saved)
3. Allocate top-N to available ZP slots
4. Update all references

### 6502 Strength Reduction (O3)

**Replaces expensive operations with 6502-specific sequences:**

| Original | Optimized | Cycles Saved |
|----------|-----------|--------------|
| `x * 2` | `ASL A` | ~70 cycles |
| `x * 4` | `ASL A; ASL A` | ~140 cycles |
| `x / 2` | `LSR A` | ~50 cycles |
| `x % 2` | `AND #$01` | ~50 cycles |

**Note**: Multiplication/division by runtime JSR is ~80 cycles minimum.

### Stack Optimization (O3+)

**Eliminates redundant push/pull pairs:**

```asm
; Before
PHA
; ... no A usage ...
PLA
; ... A not used after ...

; After
; (both removed)
```

**Safety**: Requires tracking that A isn't needed in between or after.

### Size Optimization (Os/Oz)

**Size-focused optimizations:**

| Strategy | Os | Oz |
|----------|:--:|:--:|
| Short branches when possible | ✅ | ✅ |
| Prefer JSR over inline | ❌ | ✅ |
| Aggressive tail call | ✅ | ✅ |
| Common sequence factoring | ❌ | ✅ |

## Scope Decisions

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| Where to do constant folding | IL level | Works on abstract values, not registers |
| Where to do DCE | IL level | Graph-based analysis easier on IL |
| Where to do ZP promotion | ASM level | Requires address mode knowledge |
| Where to do flag opt | ASM level | Requires 6502 flag semantics |
| Illegal opcodes | No | Portability to FPGA/modern cores |

## Acceptance Criteria

### Functionality
1. [ ] All P0 requirements implemented
2. [ ] All optimization levels working correctly
3. [ ] Integration with existing `AsmOptimizer` infrastructure

### Quality
4. [ ] No regressions in existing tests
5. [ ] 90%+ test coverage for optimizer passes
6. [ ] Each pass has dedicated test suite

### Performance
7. [ ] Optimization overhead < 50ms for typical programs
8. [ ] Measurable improvement in output quality

### Documentation
9. [ ] JSDoc for all public APIs
10. [ ] Pattern documentation for each pass
11. [ ] Optimization level documentation

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Code size reduction | 20-40% vs O0 | Compare output sizes |
| Cycle reduction | 30-50% vs O0 | Estimate from patterns |
| Test coverage | 90%+ | Coverage report |
| Compile time | < 50ms overhead | Benchmark |
| Correctness | 100% | All tests pass |