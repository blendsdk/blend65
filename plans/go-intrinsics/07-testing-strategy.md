# Testing Strategy: Go-Intrinsics

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Unit tests: 100% coverage for new code
- Integration tests: All 6 intrinsics work end-to-end
- Regression: All 6,500+ existing tests pass

## Test Categories

### Unit Tests

| Test | Description | Priority |
|------|-------------|----------|
| `generates BRK instruction` | CPU_BRK opcode emits BRK | High |
| `generates barrier comment` | OPT_BARRIER emits comment only | High |
| `generates lo byte extraction` | INTRINSIC_LO handles word values | High |
| `generates hi byte extraction` | INTRINSIC_HI extracts high byte | High |
| `generates volatile read` | VOLATILE_READ emits forced LDA | High |
| `generates volatile write` | VOLATILE_WRITE emits forced STA | High |

### Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| `brk in function` | IL → Codegen → Assembly | Full brk() compilation |
| `barrier in sequence` | IL → Codegen → Assembly | barrier() preserves order |
| `lo/hi extraction` | IL → Codegen → Assembly | Byte extraction works |
| `volatile memory access` | IL → Codegen → Assembly | Volatile ops compile |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Compile brk() call | Parse → Analyze → IL → Codegen | BRK in output |
| Compile barrier() call | Parse → Analyze → IL → Codegen | Comment in output |
| Compile lo/hi calls | Parse → Analyze → IL → Codegen | Byte extraction code |
| Compile volatile ops | Parse → Analyze → IL → Codegen | Forced memory access |

## Test File

**File**: `packages/compiler/src/__tests__/codegen/instruction-generator-intrinsics.test.ts`

### Test Implementation

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ILOpcode,
  ILCpuInstruction,
  ILOptBarrierInstruction,
  ILLoInstruction,
  ILHiInstruction,
  ILVolatileReadInstruction,
  ILVolatileWriteInstruction,
} from '../../il/instructions.js';
import { IL_BYTE, IL_WORD } from '../../il/types.js';
// ... test setup imports ...

describe('InstructionGenerator - Intrinsics', () => {
  // Test setup with mock/real module, builder, writer

  describe('CPU_BRK', () => {
    it('should generate BRK instruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_BRK, null);
      generator.generateInstruction(instr);
      
      expect(output).toContain('BRK');
      expect(output).toContain('Software interrupt');
    });
  });

  describe('OPT_BARRIER', () => {
    it('should generate comment only (no code)', () => {
      const instr = new ILOptBarrierInstruction(0);
      generator.generateInstruction(instr);
      
      expect(output).toContain('OPTIMIZATION BARRIER');
      expect(output).not.toMatch(/^\s+(LDA|STA|NOP)/m);
    });
  });

  describe('INTRINSIC_LO', () => {
    it('should generate low byte extraction', () => {
      const instr = new ILLoInstruction(0, 'v0', 'v1');
      generator.generateInstruction(instr);
      
      expect(output).toContain('lo(v0)');
      expect(output).toContain('Low byte');
    });
  });

  describe('INTRINSIC_HI', () => {
    it('should generate high byte extraction with TXA', () => {
      const instr = new ILHiInstruction(0, 'v0', 'v1');
      generator.generateInstruction(instr);
      
      expect(output).toContain('hi(v0)');
      expect(output).toContain('TXA');
      expect(output).toContain('High byte');
    });
  });

  describe('VOLATILE_READ', () => {
    it('should generate forced LDA with volatile marker', () => {
      const instr = new ILVolatileReadInstruction(0, 'v0', 'v1');
      generator.generateInstruction(instr);
      
      expect(output).toContain('volatile_read');
      expect(output).toContain('[VOLATILE]');
      expect(output).toContain('LDA');
    });
  });

  describe('VOLATILE_WRITE', () => {
    it('should generate forced STA with volatile marker', () => {
      const instr = new ILVolatileWriteInstruction(0, 'v0', 'v1');
      generator.generateInstruction(instr);
      
      expect(output).toContain('volatile_write');
      expect(output).toContain('[VOLATILE]');
      expect(output).toContain('STA');
    });
  });
});
```

## Verification Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No regressions in existing tests (6,500+)
- [ ] Output assembly is valid ACME syntax
- [ ] Comments are helpful and accurate

## Test Commands

```bash
# Run just the new intrinsics tests
./compiler-test codegen

# Run all tests to check for regressions
./compiler-test

# Run with verbose output
clear && yarn clean && yarn build && yarn test --reporter=verbose
```

## Expected Test Count

| Category | New Tests | Existing Tests |
|----------|-----------|----------------|
| Codegen intrinsics | ~12-15 | 500+ |
| Integration | ~6 | 1,500+ |
| **Total New** | **~18-21** | - |
| **Total After** | - | **6,520+** |