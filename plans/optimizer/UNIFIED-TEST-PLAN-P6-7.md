# Unified Test Plan: Phases 6-7 (Register & 6502-Specific)

> **Document ID**: UNIFIED-TEST-PLAN-P6-7
> **Phases Covered**: 6 (Register Allocation), 7 (6502-Specific)
> **Priority**: Critical
> **Test Count**: ~100 tests

---

## Overview

This document provides the comprehensive test plan for Phases 6 (Register Allocation) and 7 (6502-Specific Optimizations).

---

## Phase 6: Register Allocation Tests

### 6.1 Graph Coloring Allocator Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P6-001 | gc-simple | Simple allocation | Critical | ⏳ |
| P6-002 | gc-interference | Interference graph | Critical | ⏳ |
| P6-003 | gc-coalescing | Register coalescing | High | ⏳ |
| P6-004 | gc-spill | Spill generation | Critical | ⏳ |
| P6-005 | gc-spill-cost | Spill cost calculation | High | ⏳ |
| P6-006 | gc-reload | Reload insertion | High | ⏳ |
| P6-007 | gc-preference | Register preference | Medium | ⏳ |
| P6-008 | gc-precolored | Precolored nodes | High | ⏳ |

### 6.2 Linear Scan Allocator Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P6-009 | ls-simple | Simple linear scan | High | ⏳ |
| P6-010 | ls-intervals | Live interval building | High | ⏳ |
| P6-011 | ls-spill | Spill decisions | High | ⏳ |
| P6-012 | ls-split | Interval splitting | Medium | ⏳ |
| P6-013 | ls-holes | Lifetime holes | Medium | ⏳ |
| P6-014 | ls-fast | Fast allocation path | Medium | ⏳ |

### 6.3 6502 Register Constraints Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P6-015 | 6502-a-required | A register required | Critical | ⏳ |
| P6-016 | 6502-x-index | X for indexing | Critical | ⏳ |
| P6-017 | 6502-y-index | Y for indexing | Critical | ⏳ |
| P6-018 | 6502-spill-zp | Spill to zero page | High | ⏳ |
| P6-019 | 6502-spill-stack | Spill to stack | High | ⏳ |
| P6-020 | 6502-transfer | TAX/TXA/TAY/TYA use | High | ⏳ |
| P6-021 | 6502-clobber | Instruction clobber | Critical | ⏳ |
| P6-022 | 6502-preserve | Register preservation | High | ⏳ |

### 6.4 Zero Page Allocation Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P6-023 | zp-prioritize | Hot variables to ZP | High | ⏳ |
| P6-024 | zp-limit | ZP limit respected | Critical | ⏳ |
| P6-025 | zp-reserved | Reserved ZP excluded | Critical | ⏳ |
| P6-026 | zp-16bit | 16-bit vars allocation | High | ⏳ |
| P6-027 | zp-indirect | Indirect addressing vars | High | ⏳ |

---

## Phase 7: 6502-Specific Optimization Tests

### 7.1 Instruction Selection Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P7-001 | isel-add | ADD instruction | Critical | ⏳ |
| P7-002 | isel-sub | SUB instruction | Critical | ⏳ |
| P7-003 | isel-mul | MUL (shift-add) | High | ⏳ |
| P7-004 | isel-div | DIV (shift-sub) | High | ⏳ |
| P7-005 | isel-compare | Compare patterns | Critical | ⏳ |
| P7-006 | isel-branch | Branch generation | Critical | ⏳ |
| P7-007 | isel-load-store | Memory access | Critical | ⏳ |
| P7-008 | isel-addressing | Addressing modes | Critical | ⏳ |

### 7.2 Addressing Mode Selection Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P7-009 | addr-immediate | Immediate mode | Critical | ⏳ |
| P7-010 | addr-zeropage | Zero page mode | Critical | ⏳ |
| P7-011 | addr-zp-x | Zero page,X | Critical | ⏳ |
| P7-012 | addr-zp-y | Zero page,Y | Critical | ⏳ |
| P7-013 | addr-absolute | Absolute mode | Critical | ⏳ |
| P7-014 | addr-abs-x | Absolute,X | Critical | ⏳ |
| P7-015 | addr-abs-y | Absolute,Y | Critical | ⏳ |
| P7-016 | addr-indirect-x | Indirect,X | High | ⏳ |
| P7-017 | addr-indirect-y | Indirect,Y | High | ⏳ |
| P7-018 | addr-selection | Best mode selection | High | ⏳ |

### 7.3 Idiom Recognition Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P7-019 | idiom-clc-adc | CLC+ADC pattern | Critical | ⏳ |
| P7-020 | idiom-sec-sbc | SEC+SBC pattern | Critical | ⏳ |
| P7-021 | idiom-inc-dec | INC/DEC selection | High | ⏳ |
| P7-022 | idiom-inx-dex | INX/DEX selection | High | ⏳ |
| P7-023 | idiom-16bit-inc | 16-bit increment | High | ⏳ |
| P7-024 | idiom-16bit-add | 16-bit addition | High | ⏳ |
| P7-025 | idiom-compare-0 | Compare with zero | High | ⏳ |
| P7-026 | idiom-bit-test | BIT instruction | Medium | ⏳ |

### 7.4 Flag Optimization Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P7-027 | flag-tracking | Flag state tracking | Critical | ⏳ |
| P7-028 | flag-redundant | Redundant flag set | High | ⏳ |
| P7-029 | flag-clc-remove | Remove redundant CLC | High | ⏳ |
| P7-030 | flag-sec-remove | Remove redundant SEC | High | ⏳ |
| P7-031 | flag-cmp-after-adc | CMP after ADC | High | ⏳ |
| P7-032 | flag-branch-aware | Branch flag awareness | High | ⏳ |

### 7.5 Code Size Optimization Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P7-033 | size-zp-prefer | Prefer ZP addressing | High | ⏳ |
| P7-034 | size-short-branch | Short branch when possible | High | ⏳ |
| P7-035 | size-inline-limit | Inline size limit | Medium | ⏳ |
| P7-036 | size-subroutine | Extract to subroutine | Medium | ⏳ |

### 7.6 Cycle Optimization Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P7-037 | cycle-page-cross | Page crossing awareness | High | ⏳ |
| P7-038 | cycle-branch-taken | Branch taken cycles | High | ⏳ |
| P7-039 | cycle-alignment | Code alignment | Medium | ⏳ |
| P7-040 | cycle-timing | Cycle-accurate timing | High | ⏳ |

### 7.7 Hardware Access Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P7-041 | hw-vic-access | VIC-II access | High | ⏳ |
| P7-042 | hw-sid-access | SID access | High | ⏳ |
| P7-043 | hw-cia-access | CIA access | High | ⏳ |
| P7-044 | hw-volatile | Volatile handling | Critical | ⏳ |
| P7-045 | hw-no-reorder | No reordering | Critical | ⏳ |

---

## Test Implementation Examples

### Register Allocation Test

```typescript
describe('RegisterAllocator', () => {
  it('should allocate to A/X/Y registers', () => {
    const program = createProgram([
      createBlock('entry', [
        { opcode: 'MOV', dest: 'v1', operands: [{ imm: 1 }] },
        { opcode: 'MOV', dest: 'v2', operands: [{ imm: 2 }] },
        { opcode: 'ADD', dest: 'v3', operands: [{ var: 'v1' }, { var: 'v2' }] },
        { opcode: 'RET', operands: [{ var: 'v3' }] }
      ], null)
    ]);
    
    const allocator = new GraphColoringAllocator();
    const allocated = allocator.allocate(program);
    
    // v3 should be in A (return value)
    expect(allocated.getRegister('v3')).toBe('A');
    // v1 and v2 should be in registers (not spilled)
    expect(allocated.isSpilled('v1')).toBe(false);
    expect(allocated.isSpilled('v2')).toBe(false);
  });
  
  it('should spill when out of registers', () => {
    // Create program with many live values
    const program = createProgramWithManyVars(10);
    
    const allocator = new GraphColoringAllocator();
    const allocated = allocator.allocate(program);
    
    // Some values should be spilled
    expect(allocated.getSpilledCount()).toBeGreaterThan(0);
    // Spills should be to zero page
    expect(allocated.getSpillLocations()[0]).toBeLessThan(256);
  });
});
```

### 6502-Specific Optimization Test

```typescript
describe('6502AddressingModeSelection', () => {
  it('should select zero page mode for ZP addresses', () => {
    const instr = { opcode: 'LOAD', operands: [{ addr: 0x10 }] };
    
    const selector = new AddressingModeSelector();
    const result = selector.select(instr);
    
    expect(result.mode).toBe('zeropage');
    expect(result.encoding).toBe('A5 10'); // LDA $10
  });
  
  it('should select indexed mode for array access', () => {
    const instr = { 
      opcode: 'LOAD', 
      operands: [{ addr: 0x0400, index: 'x' }] 
    };
    
    const selector = new AddressingModeSelector();
    const result = selector.select(instr);
    
    expect(result.mode).toBe('absolute_x');
    expect(result.encoding).toMatch(/BD 00 04/); // LDA $0400,X
  });
});
```

---

## Test Coverage Requirements

| Component | Target Coverage | Current |
|-----------|-----------------|---------|
| Graph Coloring | 90% | 0% |
| Linear Scan | 85% | 0% |
| 6502 Constraints | 95% | 0% |
| Zero Page Alloc | 90% | 0% |
| Instruction Select | 95% | 0% |
| Addressing Modes | 95% | 0% |
| Idiom Recognition | 90% | 0% |
| Flag Optimization | 90% | 0% |

---

## References

- `06-register-allocation.md`, `07-6502-specific.md`, `08-01-pattern-framework.md`