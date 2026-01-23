# Unified Test Plan: Phases 8-9 (Peephole Patterns)

> **Document ID**: UNIFIED-TEST-PLAN-P8-9
> **Phases Covered**: 8 (Peephole Patterns), 9 (Pattern Categories)
> **Priority**: Critical
> **Test Count**: ~200 tests

---

## Overview

This document provides the comprehensive test plan for Phases 8-9 (Peephole Optimization Patterns). This is the largest phase with patterns across all 6502 instruction categories.

---

## Phase 8: Pattern Framework Tests

### 8.1 Pattern Matcher Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P8-001 | matcher-single | Single instruction match | Critical | ⏳ |
| P8-002 | matcher-sequence | Sequence matching | Critical | ⏳ |
| P8-003 | matcher-wildcard | Wildcard operands | Critical | ⏳ |
| P8-004 | matcher-capture | Capture groups | High | ⏳ |
| P8-005 | matcher-constraint | Constraint checking | High | ⏳ |
| P8-006 | matcher-overlap | Overlapping patterns | High | ⏳ |
| P8-007 | matcher-priority | Pattern priority | High | ⏳ |
| P8-008 | matcher-no-match | No match case | Medium | ⏳ |

### 8.2 Pattern Registry Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P8-009 | registry-add | Add pattern | Critical | ⏳ |
| P8-010 | registry-remove | Remove pattern | Medium | ⏳ |
| P8-011 | registry-lookup | Pattern lookup | Critical | ⏳ |
| P8-012 | registry-category | Category filtering | High | ⏳ |
| P8-013 | registry-enable | Enable/disable | High | ⏳ |
| P8-014 | registry-stats | Usage statistics | Medium | ⏳ |

### 8.3 Load/Store Pattern Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P8-015 | ls-redundant-load | LDA then LDA same | Critical | ⏳ |
| P8-016 | ls-load-after-store | LDA after STA same | Critical | ⏳ |
| P8-017 | ls-store-after-load | STA after LDA | High | ⏳ |
| P8-018 | ls-dead-store | Dead store removal | Critical | ⏳ |
| P8-019 | ls-zp-prefer | Zero page preference | High | ⏳ |
| P8-020 | ls-indexed-opt | Indexed optimization | High | ⏳ |

### 8.4 Arithmetic Pattern Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P8-021 | arith-add-0 | ADC #0 removal | Critical | ⏳ |
| P8-022 | arith-sub-0 | SBC #0 removal | Critical | ⏳ |
| P8-023 | arith-inc-dec | INC/DEC preference | High | ⏳ |
| P8-024 | arith-mul-shift | Multiply to shift | High | ⏳ |
| P8-025 | arith-div-shift | Divide to shift | High | ⏳ |
| P8-026 | arith-fold | Constant folding | Critical | ⏳ |
| P8-027 | arith-identity | Identity ops | High | ⏳ |
| P8-028 | arith-inverse | Inverse ops | Medium | ⏳ |

### 8.5 Branch Pattern Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P8-029 | branch-chain | Branch chain opt | High | ⏳ |
| P8-030 | branch-complement | Complementary branches | High | ⏳ |
| P8-031 | branch-flag-aware | Flag-aware branching | Critical | ⏳ |
| P8-032 | branch-cmp-elim | CMP elimination | High | ⏳ |
| P8-033 | branch-always | Always taken branch | High | ⏳ |
| P8-034 | branch-never | Never taken branch | High | ⏳ |

### 8.6 Transfer Pattern Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P8-035 | xfer-redundant | Redundant transfer | Critical | ⏳ |
| P8-036 | xfer-chain | Transfer chain | High | ⏳ |
| P8-037 | xfer-circular | Circular transfer | High | ⏳ |
| P8-038 | xfer-stack | Stack transfer | Medium | ⏳ |
| P8-039 | xfer-combine | Combine transfers | Medium | ⏳ |

### 8.7 Flag Pattern Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P8-040 | flag-clc-redundant | Redundant CLC | Critical | ⏳ |
| P8-041 | flag-sec-redundant | Redundant SEC | Critical | ⏳ |
| P8-042 | flag-cli-sei | CLI/SEI patterns | High | ⏳ |
| P8-043 | flag-clv | CLV patterns | Medium | ⏳ |
| P8-044 | flag-status | Status flag patterns | High | ⏳ |

### 8.8 Combining Pattern Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P8-045 | comb-load-xfer | Load-transfer combine | High | ⏳ |
| P8-046 | comb-stack | Stack combinations | Medium | ⏳ |
| P8-047 | comb-register | Register combinations | High | ⏳ |
| P8-048 | comb-idiom | Idiom combinations | High | ⏳ |

### 8.9 Redundant Instruction Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P8-049 | red-cmp-arith | CMP after arithmetic | High | ⏳ |
| P8-050 | red-cmp-logical | CMP after logical | High | ⏳ |
| P8-051 | red-accumulator | Redundant A ops | High | ⏳ |
| P8-052 | red-index | Redundant index ops | High | ⏳ |
| P8-053 | red-store | Redundant store | High | ⏳ |
| P8-054 | red-context | Context-aware removal | Medium | ⏳ |

---

## Phase 9: Advanced Pattern Tests

### 9.1 Multi-Instruction Pattern Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P9-001 | multi-3instr | 3-instruction pattern | High | ⏳ |
| P9-002 | multi-4instr | 4-instruction pattern | Medium | ⏳ |
| P9-003 | multi-variable | Variable length pattern | Medium | ⏳ |
| P9-004 | multi-context | Context-dependent | Medium | ⏳ |

### 9.2 Semantic Pattern Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P9-005 | sem-swap | Swap pattern | Medium | ⏳ |
| P9-006 | sem-multiply | Multiply pattern | High | ⏳ |
| P9-007 | sem-divide | Divide pattern | High | ⏳ |
| P9-008 | sem-abs | Absolute value | Medium | ⏳ |
| P9-009 | sem-min-max | Min/max patterns | Medium | ⏳ |
| P9-010 | sem-sign | Sign extension | Medium | ⏳ |

---

## Test Implementation Examples

### Pattern Matcher Test

```typescript
describe('PatternMatcher', () => {
  it('should match redundant load pattern', () => {
    const sequence = [
      { opcode: 'LDA', mode: 'zeropage', operand: 0x10 },
      { opcode: 'LDA', mode: 'zeropage', operand: 0x10 }
    ];
    
    const pattern = createPattern('redundant_load', [
      { opcode: 'LDA', capture: 'addr' },
      { opcode: 'LDA', match: 'addr' }
    ]);
    
    const matcher = new PatternMatcher();
    const match = matcher.match(sequence, pattern);
    
    expect(match).not.toBeNull();
    expect(match.captures.get('addr')).toBe(0x10);
  });
  
  it('should apply transformation', () => {
    const sequence = [
      { opcode: 'LDA', mode: 'zeropage', operand: 0x10 },
      { opcode: 'LDA', mode: 'zeropage', operand: 0x10 }
    ];
    
    const optimizer = new PeepholeOptimizer();
    const result = optimizer.optimize(sequence);
    
    // Should remove redundant LDA
    expect(result.length).toBe(1);
    expect(result[0].opcode).toBe('LDA');
  });
});
```

### Flag Pattern Test

```typescript
describe('FlagPatterns', () => {
  it('should remove redundant CLC', () => {
    const sequence = [
      { opcode: 'CLC' },
      { opcode: 'ADC', mode: 'immediate', operand: 5 },
      { opcode: 'CLC' },  // Redundant - carry already clear after ADC with no overflow
      { opcode: 'ADC', mode: 'immediate', operand: 3 }
    ];
    
    const optimizer = new PeepholeOptimizer();
    const result = optimizer.optimize(sequence);
    
    // Check only one CLC remains
    const clcCount = result.filter(i => i.opcode === 'CLC').length;
    expect(clcCount).toBe(1);
  });
});
```

---

## Test Coverage Requirements

| Component | Target Coverage | Current |
|-----------|-----------------|---------|
| Pattern Matcher | 95% | 0% |
| Pattern Registry | 90% | 0% |
| Load/Store Patterns | 95% | 0% |
| Arithmetic Patterns | 95% | 0% |
| Branch Patterns | 90% | 0% |
| Transfer Patterns | 90% | 0% |
| Flag Patterns | 95% | 0% |
| Combining Patterns | 85% | 0% |
| Redundant Patterns | 90% | 0% |

---

## References

- `08-01-pattern-framework.md` through `08-09j-redundant-context.md`