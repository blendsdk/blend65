# Testing Strategy: ASM-IL Optimizer

> **Document**: 12-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit tests: 90%+ coverage per pass
- Integration tests: All pass combinations
- E2E tests: Full Blend → optimized ASM

## Test Categories

### Unit Tests per Pass

| Pass | Test File | Est. Tests |
|------|-----------|------------|
| Flag Patterns | `flag-patterns.test.ts` | 15-20 |
| Store-Load | `store-load.test.ts` | 15-20 |
| Branch Opt | `branch-opt.test.ts` | 10-15 |
| Transfer Opt | `transfer-opt.test.ts` | 10-12 |
| ZP Promotion | `zp-promotion.test.ts` | 10-15 |
| 6502 Strength | `strength-6502.test.ts` | 10-12 |
| Stack Opt | `stack-opt.test.ts` | 10-12 |
| Size Opt | `size-opt.test.ts` | 8-10 |

**Total Unit Tests**: ~90-120

### Integration Tests

| Test | Description |
|------|-------------|
| `pass-order.test.ts` | Correct ordering of passes |
| `level-config.test.ts` | Each -O level enables correct passes |
| `fixed-point.test.ts` | Iteration until convergence |
| `combined-opts.test.ts` | Multiple passes together |

**Total Integration Tests**: ~20-30

### E2E Tests

| Test | Description |
|------|-------------|
| `blend-to-asm.test.ts` | Full compilation with optimization |
| `correctness.test.ts` | Optimized code produces same results |
| `size-comparison.test.ts` | Size reduction measurements |

**Total E2E Tests**: ~15-20

## Test Utilities

```typescript
// Helper to create test AsmModule
function createModule(items: AsmItem[]): AsmModule;

// Helper to create instruction
function instr(
  mnemonic: Mnemonic, 
  mode?: AddressingMode, 
  operand?: number | string
): AsmInstruction;

// Helper to create label
function label(name: string): AsmLabel;

// Get instruction at index (skipping non-instructions)
function getInstr(module: AsmModule, index: number): AsmInstruction;
```

## Test Data Patterns

### Flag Patterns Test Data
```typescript
const redundantCmpZero = createModule([
  instr('LDA', 'zeroPage', 0x50),
  instr('CMP', 'immediate', 0),
  instr('BEQ', 'relative', 'done'),
]);
```

### Store-Load Test Data
```typescript
const storeLoadSame = createModule([
  instr('STA', 'zeroPage', 0x50),
  instr('LDA', 'zeroPage', 0x50),
]);
```

## Verification Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] No regressions in existing compiler tests
- [ ] Coverage meets 90% goal
- [ ] Optimized output is semantically correct

## Test Execution

```bash
# Run all ASM-IL optimizer tests
./compiler-test asm-il/optimizer

# Run specific pass tests
./compiler-test asm-il/optimizer/flag-patterns
./compiler-test asm-il/optimizer/store-load
```

## Performance Benchmarks

Tests should also verify optimization quality:

```typescript
describe('optimization metrics', () => {
  it('reduces code size by at least 20% at O2', () => {
    const before = compile(source, { level: 'O0' });
    const after = compile(source, { level: 'O2' });
    const reduction = 1 - (after.size / before.size);
    expect(reduction).toBeGreaterThan(0.20);
  });
});
```