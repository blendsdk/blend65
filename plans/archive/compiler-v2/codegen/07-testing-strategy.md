# Testing Strategy: Code Generator

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Overview

The Code Generator requires extensive testing to ensure zero gaps before the ASM-IL Optimizer phase. Target: **875+ tests**.

## Test Categories

### 1. Unit Tests (~300 tests)

Test each IL opcode generates correct 6502 code.

**File Structure:**
```
codegen/unit/
├── memory-ops.test.ts       # LOAD_BYTE, STORE_BYTE, etc. (~40)
├── arithmetic.test.ts       # ADD, SUB, MUL, DIV, MOD (~50)
├── bitwise.test.ts          # AND, OR, XOR, NOT, shifts (~40)
├── comparison.test.ts       # CMP operations (~30)
├── control-flow.test.ts     # JUMP, branches, LABEL (~50)
├── functions.test.ts        # CALL, RETURN (~30)
├── transfer.test.ts         # TAX, TXA, etc. (~20)
└── special.test.ts          # NOP, PUSH, POP (~40)
```

### 2. Integration Tests (~150 tests)

Test IL sequences produce correct code.

**File Structure:**
```
codegen/integration/
├── expressions.test.ts      # Arithmetic expressions (~40)
├── assignments.test.ts      # Variable assignments (~30)
├── control-structures.test.ts # if/while/for patterns (~40)
├── function-chains.test.ts  # Multi-function programs (~40)
```

### 3. Real-World Scenarios (~100 tests)

Test complete programs matching real use cases.

**File Structure:**
```
codegen/real-world/
├── counter-program.test.ts  # Simple counter (~15)
├── array-operations.test.ts # Array access patterns (~20)
├── c64-hardware.test.ts     # Memory-mapped I/O (~25)
├── game-patterns.test.ts    # Input/update/render (~25)
└── utility-programs.test.ts # Common patterns (~15)
```

### 4. 6502-Specific Tests (~100 tests)

Test 6502 architectural correctness.

**File Structure:**
```
codegen/6502-specific/
├── addressing-modes.test.ts # ZP vs ABS selection (~25)
├── flag-handling.test.ts    # Carry, zero, negative (~25)
├── branch-range.test.ts     # Branch limitations (~20)
├── signed-unsigned.test.ts  # Signed vs unsigned ops (~15)
└── register-state.test.ts   # A/X/Y preservation (~15)
```

### 5. Edge Case Tests (~75 tests)

Test boundary conditions.

**File Structure:**
```
codegen/edge-cases/
├── boundary-values.test.ts  # 0, 255, 65535 (~25)
├── empty-functions.test.ts  # No-op functions (~15)
├── nested-control.test.ts   # Deep nesting (~20)
└── large-programs.test.ts   # Many functions (~15)
```

### 6. Intrinsic Tests (~50 tests)

Test intrinsic code generation.

**File Structure:**
```
codegen/intrinsics/
├── peek-poke.test.ts        # Memory access (~20)
├── peekw-pokew.test.ts      # Word access (~10)
├── hi-lo.test.ts            # Byte extraction (~10)
└── volatile.test.ts         # Optimization barriers (~10)
```

### 7. End-to-End Tests (~75 tests)

Test complete pipeline.

**File Structure:**
```
codegen/e2e/
├── simple-programs.test.ts  # Hello world, counter (~20)
├── control-flow.test.ts     # All control structures (~20)
├── functions.test.ts        # Function calls, params (~20)
└── hardware-access.test.ts  # C64 I/O patterns (~15)
```

### 8. Stress Tests (~25 tests)

Test limits and performance.

**File Structure:**
```
codegen/stress/
├── many-functions.test.ts   # 100+ functions (~10)
├── deep-nesting.test.ts     # 20+ nesting levels (~8)
└── large-arrays.test.ts     # Large data (~7)
```

---

## Test Patterns

### Unit Test Pattern

```typescript
describe('LOAD_BYTE', () => {
  it('should generate LDA for ZP slot', () => {
    const il = createIL([
      { opcode: ILOpcode.LOAD_BYTE, operand: zpSlot(0x02) }
    ]);
    const asm = generate(il);
    expectInstructions(asm, ['LDA $02']);
  });

  it('should generate LDA for ABS slot', () => {
    const il = createIL([
      { opcode: ILOpcode.LOAD_BYTE, operand: absSlot(0x0400) }
    ]);
    const asm = generate(il);
    expectInstructions(asm, ['LDA $0400']);
  });
});
```

### Integration Test Pattern

```typescript
describe('Addition expression', () => {
  it('should generate correct sequence for a + b', () => {
    const il = createIL([
      { opcode: ILOpcode.LOAD_BYTE, operand: slot('a') },
      { opcode: ILOpcode.ADD_BYTE, operand: slot('b') },
      { opcode: ILOpcode.STORE_BYTE, operand: slot('result') },
    ]);
    const asm = generate(il);
    expectInstructions(asm, [
      'LDA $02',    // Load a
      'CLC',        // Clear carry
      'ADC $03',    // Add b
      'STA $04',    // Store result
    ]);
  });
});
```

### E2E Test Pattern

```typescript
describe('Complete program', () => {
  it('should compile counter program', () => {
    const source = `
      function main(): void {
        let counter: byte = 0;
        counter = counter + 1;
      }
    `;
    const result = compile(source);
    expect(result.errors).toHaveLength(0);
    expectContains(result.asm, ['LDA #0', 'STA', 'CLC', 'ADC #1', 'STA', 'RTS']);
  });
});
```

---

## Coverage Requirements

| Category | Minimum Tests | Coverage Goal |
|----------|---------------|---------------|
| Unit | 300 | 100% of IL opcodes |
| Integration | 150 | All expression types |
| Real-World | 100 | Common use cases |
| 6502-Specific | 100 | Architectural correctness |
| Edge Cases | 75 | Boundary conditions |
| Intrinsics | 50 | All intrinsics |
| E2E | 75 | Full pipeline |
| Stress | 25 | Performance limits |
| **Total** | **875** | **Zero gaps** |