# Phase 6.4: 6502 Strength Reduction

> **Phase**: 6.4  
> **Parent**: [Phase 6 Index](00-phase-index.md)  
> **Est. Lines**: ~300  
> **Focus**: Replace expensive operations with cheap 6502-specific alternatives

---

## Overview

The 6502 has no multiply or divide instructions. Naive implementations use expensive loops (~100+ cycles). However, many common multiplications and divisions can be replaced with shift sequences that execute in 2-10 cycles.

This pass identifies multiplication/division by constants and replaces them with optimal 6502 instruction sequences.

---

## Why 6502 Strength Reduction Matters

### Cost Comparison

| Operation | Naive Implementation | Optimized | Savings |
|-----------|---------------------|-----------|---------|
| `x * 2` | Multiply routine (~80 cycles) | `ASL A` (2 cycles) | 78 cycles |
| `x * 4` | Multiply routine (~100 cycles) | `ASL A; ASL A` (4 cycles) | 96 cycles |
| `x / 2` | Divide routine (~100 cycles) | `LSR A` (2 cycles) | 98 cycles |
| `x % 2` | Modulo routine (~120 cycles) | `AND #$01` (2 cycles) | 118 cycles |
| `x * 3` | Multiply routine (~80 cycles) | `STA t; ASL A; CLC; ADC t` (10 cycles) | 70 cycles |
| `x * 10` | Multiply routine (~100 cycles) | See below (18 cycles) | 82 cycles |

---

## Multiplication Patterns

### Powers of Two (Shift Only)

The simplest and fastest pattern - just shift left.

```asm
; x * 2
    ASL A           ; 2 cycles

; x * 4
    ASL A           ; 2 cycles
    ASL A           ; 2 cycles = 4 total

; x * 8
    ASL A
    ASL A
    ASL A           ; 6 cycles

; x * 16
    ASL A
    ASL A
    ASL A
    ASL A           ; 8 cycles
```

```typescript
/**
 * Generate ASL sequence for power-of-2 multiply.
 */
protected multiplyByPowerOfTwo(power: number): AsmInstruction[] {
  const instructions: AsmInstruction[] = [];
  
  for (let i = 0; i < power; i++) {
    instructions.push({
      opcode: Opcode.ASL,
      addressingMode: AddressingMode.Accumulator,
    });
  }
  
  return instructions;
}
```

### Small Multipliers (Shift + Add)

For non-power-of-two multipliers, decompose into powers of two.

```asm
; x * 3 = x * 2 + x
    STA temp        ; 3 cycles - save original
    ASL A           ; 2 cycles - x * 2
    CLC             ; 2 cycles
    ADC temp        ; 3 cycles - + x
                    ; Total: 10 cycles

; x * 5 = x * 4 + x
    STA temp        ; 3 cycles
    ASL A           ; 2 cycles
    ASL A           ; 2 cycles - x * 4
    CLC             ; 2 cycles
    ADC temp        ; 3 cycles - + x
                    ; Total: 12 cycles

; x * 6 = x * 4 + x * 2
    ASL A           ; x * 2
    STA temp        ; save x * 2
    ASL A           ; x * 4
    CLC
    ADC temp        ; x * 4 + x * 2 = x * 6
                    ; Total: 12 cycles

; x * 7 = x * 8 - x
    STA temp        ; save x
    ASL A
    ASL A
    ASL A           ; x * 8
    SEC
    SBC temp        ; x * 8 - x
                    ; Total: 14 cycles

; x * 9 = x * 8 + x
    STA temp
    ASL A
    ASL A
    ASL A           ; x * 8
    CLC
    ADC temp        ; + x
                    ; Total: 14 cycles

; x * 10 = x * 8 + x * 2
    ASL A           ; x * 2
    STA temp        ; save x * 2
    ASL A
    ASL A           ; x * 8
    CLC
    ADC temp        ; x * 8 + x * 2 = x * 10
                    ; Total: 14 cycles
```

### Lookup Table (For Large Multipliers)

When multiplication is frequent and value range is small, use lookup tables.

```asm
; x * 40 (screen row offset) - better as table
    TAX
    LDA row_offset_lo,X   ; 4 cycles
    ; or
    LDA row_offset_hi,X   ; 4 cycles

; Table in ROM:
row_offset_lo:
    .byte <0, <40, <80, <120, <160, ...
row_offset_hi:
    .byte >0, >40, >80, >120, >160, ...
```

---

## Division Patterns

### Powers of Two (Shift Right)

```asm
; x / 2 (unsigned)
    LSR A           ; 2 cycles

; x / 4
    LSR A
    LSR A           ; 4 cycles

; x / 8
    LSR A
    LSR A
    LSR A           ; 6 cycles
```

### Modulo Powers of Two (AND Mask)

```asm
; x % 2 (even/odd)
    AND #$01        ; 2 cycles

; x % 4
    AND #$03        ; 2 cycles

; x % 8
    AND #$07        ; 2 cycles

; x % 16
    AND #$0F        ; 2 cycles

; x % 256
    ; Already in low byte - no operation needed!
```

---

## Architecture

### Pass Structure

```typescript
/**
 * 6502 Strength Reduction Pass
 * 
 * Replaces expensive multiply/divide operations with
 * optimal shift/add sequences.
 */
export class Strength6502Pass implements Pass<AsmProgram> {
  readonly name = '6502-strength-reduction';
  readonly dependencies = [];
  
  /** Temporary ZP location for multi-step calculations */
  protected tempAddr: number;
  
  run(program: AsmProgram, context: PassContext): AsmProgram {
    // Get temp location from context
    this.tempAddr = context.allocateTemp(1);
    
    return this.mapInstructions(program, inst => {
      // Check for multiplication
      if (this.isMultiply(inst)) {
        const multiplier = this.getMultiplier(inst);
        if (multiplier !== null) {
          return this.optimizeMultiply(multiplier);
        }
      }
      
      // Check for division
      if (this.isDivide(inst)) {
        const divisor = this.getDivisor(inst);
        if (divisor !== null) {
          return this.optimizeDivide(divisor);
        }
      }
      
      // Check for modulo
      if (this.isModulo(inst)) {
        const modulus = this.getModulus(inst);
        if (modulus !== null) {
          return this.optimizeModulo(modulus);
        }
      }
      
      return [inst];  // No change
    });
  }
}
```

### Multiplier Decomposition

```typescript
/**
 * Decompose a multiplier into optimal shift/add sequence.
 */
protected decomposeMultiplier(n: number): MultiplierPlan {
  // Handle special cases
  if (n === 0) return { type: 'zero' };
  if (n === 1) return { type: 'identity' };
  
  // Check if power of 2
  if (this.isPowerOfTwo(n)) {
    return {
      type: 'shift',
      shifts: Math.log2(n),
    };
  }
  
  // Try shift+add decomposition
  const plan = this.findOptimalDecomposition(n);
  if (plan.cost < this.CALL_THRESHOLD) {
    return plan;
  }
  
  // Fall back to runtime multiply
  return { type: 'call', value: n };
}

/**
 * Find optimal decomposition using shift+add/sub.
 * 
 * Algorithm: Express n as sum/difference of powers of 2
 * Example: 10 = 8 + 2, 7 = 8 - 1, 15 = 16 - 1
 */
protected findOptimalDecomposition(n: number): MultiplierPlan {
  // Strategy 1: Sum of powers of 2
  const sumPlan = this.decomposeAsSum(n);
  
  // Strategy 2: Difference of powers of 2 (for numbers like 7, 15, 31)
  const diffPlan = this.decomposeAsDifference(n);
  
  // Return cheaper option
  return sumPlan.cost <= diffPlan.cost ? sumPlan : diffPlan;
}

/**
 * Express n as sum of powers of 2.
 * Example: 10 = 8 + 2 → ASL³; STA t; ASL; CLC; ADC t
 */
protected decomposeAsSum(n: number): MultiplierPlan {
  const powers: number[] = [];
  let remaining = n;
  
  while (remaining > 0) {
    const power = Math.floor(Math.log2(remaining));
    powers.push(power);
    remaining -= (1 << power);
  }
  
  return {
    type: 'sum',
    powers,
    cost: this.calculateSumCost(powers),
  };
}

/**
 * Express n as difference of powers of 2.
 * Example: 7 = 8 - 1 → ASL³; SEC; SBC original
 */
protected decomposeAsDifference(n: number): MultiplierPlan {
  // Find smallest power of 2 > n
  const upperPower = Math.ceil(Math.log2(n + 1));
  const upper = 1 << upperPower;
  const diff = upper - n;
  
  // If diff is small, use subtraction
  if (this.isPowerOfTwo(diff) || diff <= 3) {
    return {
      type: 'difference',
      upperPower,
      subtract: diff,
      cost: this.calculateDiffCost(upperPower, diff),
    };
  }
  
  return { type: 'none', cost: Infinity };
}
```

### Code Generation

```typescript
/**
 * Generate multiply instruction sequence.
 */
protected generateMultiply(plan: MultiplierPlan): AsmInstruction[] {
  switch (plan.type) {
    case 'zero':
      return [{ opcode: Opcode.LDA, operand: 0, mode: AddressingMode.Immediate }];
      
    case 'identity':
      return [];  // x * 1 = x
      
    case 'shift':
      return this.multiplyByPowerOfTwo(plan.shifts);
      
    case 'sum':
      return this.generateSumMultiply(plan.powers);
      
    case 'difference':
      return this.generateDiffMultiply(plan.upperPower, plan.subtract);
      
    case 'call':
      return this.generateMultiplyCall(plan.value);
  }
}

/**
 * Generate multiply by sum of powers.
 * Example: x * 10 = x * 8 + x * 2
 */
protected generateSumMultiply(powers: number[]): AsmInstruction[] {
  if (powers.length === 1) {
    return this.multiplyByPowerOfTwo(powers[0]);
  }
  
  const instructions: AsmInstruction[] = [];
  const [first, ...rest] = powers.sort((a, b) => a - b);  // Smallest first
  
  // Generate smallest power and save
  for (let i = 0; i < first; i++) {
    instructions.push({ opcode: Opcode.ASL, mode: AddressingMode.Accumulator });
  }
  instructions.push({
    opcode: Opcode.STA,
    operand: this.tempAddr,
    mode: AddressingMode.ZeroPage,
  });
  
  // Add remaining powers
  let currentPower = first;
  for (const power of rest) {
    // Shift up to next power
    for (let i = currentPower; i < power; i++) {
      instructions.push({ opcode: Opcode.ASL, mode: AddressingMode.Accumulator });
    }
    currentPower = power;
    
    // Add saved value
    instructions.push({ opcode: Opcode.CLC });
    instructions.push({
      opcode: Opcode.ADC,
      operand: this.tempAddr,
      mode: AddressingMode.ZeroPage,
    });
  }
  
  return instructions;
}
```

---

## Special C64 Patterns

### Screen Row Calculation

Screen memory offset (row × 40) is very common:

```typescript
/**
 * Optimize row * 40 for screen addressing.
 * 40 = 32 + 8 = x * 32 + x * 8
 */
protected multiplyBy40(): AsmInstruction[] {
  return [
    // x * 8
    { opcode: Opcode.ASL, mode: AddressingMode.Accumulator },
    { opcode: Opcode.ASL, mode: AddressingMode.Accumulator },
    { opcode: Opcode.ASL, mode: AddressingMode.Accumulator },
    { opcode: Opcode.STA, operand: this.tempAddr, mode: AddressingMode.ZeroPage },
    // x * 32
    { opcode: Opcode.ASL, mode: AddressingMode.Accumulator },
    { opcode: Opcode.ASL, mode: AddressingMode.Accumulator },
    // x * 32 + x * 8
    { opcode: Opcode.CLC },
    { opcode: Opcode.ADC, operand: this.tempAddr, mode: AddressingMode.ZeroPage },
  ];
}
```

### Sprite Block Number

Sprite data is at block × 64:

```asm
; sprite block * 64
    ASL A
    ASL A
    ASL A
    ASL A
    ASL A
    ASL A           ; 12 cycles
```

### Color RAM Offset

Color RAM uses same 40×25 layout as screen:

```asm
; Same as screen row calculation
; row * 40 + col
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('Strength6502Pass', () => {
  describe('power of 2 multiply', () => {
    it('converts * 2 to ASL', () => {
      const result = pass.optimizeMultiply(2);
      expect(result).toHaveLength(1);
      expect(result[0].opcode).toBe(Opcode.ASL);
    });
    
    it('converts * 4 to ASL; ASL', () => {
      const result = pass.optimizeMultiply(4);
      expect(result).toHaveLength(2);
      expect(result.every(i => i.opcode === Opcode.ASL)).toBe(true);
    });
    
    it('converts * 16 to four ASLs', () => {
      const result = pass.optimizeMultiply(16);
      expect(result).toHaveLength(4);
    });
  });
  
  describe('non-power-of-2 multiply', () => {
    it('converts * 3 to shift+add', () => {
      const result = pass.optimizeMultiply(3);
      // STA temp; ASL; CLC; ADC temp
      expect(result.some(i => i.opcode === Opcode.STA)).toBe(true);
      expect(result.some(i => i.opcode === Opcode.ASL)).toBe(true);
      expect(result.some(i => i.opcode === Opcode.ADC)).toBe(true);
    });
    
    it('converts * 5 to shift+add', () => {
      const result = pass.optimizeMultiply(5);
      // x * 4 + x
      const aslCount = result.filter(i => i.opcode === Opcode.ASL).length;
      expect(aslCount).toBe(2);  // * 4
    });
    
    it('converts * 7 to shift-subtract', () => {
      const result = pass.optimizeMultiply(7);
      // x * 8 - x
      expect(result.some(i => i.opcode === Opcode.SBC)).toBe(true);
    });
    
    it('converts * 10 to optimal sequence', () => {
      const result = pass.optimizeMultiply(10);
      // x * 8 + x * 2
      const aslCount = result.filter(i => i.opcode === Opcode.ASL).length;
      expect(aslCount).toBeGreaterThanOrEqual(3);  // At least x * 8
    });
  });
  
  describe('division', () => {
    it('converts / 2 to LSR', () => {
      const result = pass.optimizeDivide(2);
      expect(result).toHaveLength(1);
      expect(result[0].opcode).toBe(Opcode.LSR);
    });
    
    it('converts / 8 to LSR; LSR; LSR', () => {
      const result = pass.optimizeDivide(8);
      expect(result).toHaveLength(3);
    });
  });
  
  describe('modulo', () => {
    it('converts % 2 to AND #$01', () => {
      const result = pass.optimizeModulo(2);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        opcode: Opcode.AND,
        operand: 0x01,
      });
    });
    
    it('converts % 16 to AND #$0F', () => {
      const result = pass.optimizeModulo(16);
      expect(result[0]).toMatchObject({
        opcode: Opcode.AND,
        operand: 0x0F,
      });
    });
  });
  
  describe('cost calculation', () => {
    it('prefers shift over shift+add', () => {
      const shiftCost = pass.calculateCost(pass.optimizeMultiply(4));
      const addCost = pass.calculateCost(pass.optimizeMultiply(3));
      expect(shiftCost).toBeLessThan(addCost);
    });
    
    it('falls back to call for large multipliers', () => {
      const result = pass.optimizeMultiply(123);
      expect(result[0].opcode).toBe(Opcode.JSR);  // Call multiply routine
    });
  });
});
```

### Integration Tests

```typescript
describe('Strength Reduction Integration', () => {
  it('optimizes screen row calculation', () => {
    const blend = `
      function screenOffset(row: byte): word {
        return row * 40;
      }
    `;
    
    const result = compile(blend, { optimize: true });
    
    // Should NOT call multiply routine
    expect(result.asm.join('\n')).not.toMatch(/JSR.*multiply/i);
    // Should use shifts
    expect(result.asm.filter(i => i.opcode === 'ASL').length)
      .toBeGreaterThan(0);
  });
  
  it('optimizes power-of-2 operations', () => {
    const blend = `
      function double(x: byte): byte {
        return x * 2;
      }
      
      function half(x: byte): byte {
        return x / 2;
      }
      
      function isOdd(x: byte): bool {
        return (x % 2) != 0;
      }
    `;
    
    const result = compile(blend, { optimize: true });
    
    // double: should be single ASL
    // half: should be single LSR
    // isOdd: should be AND #$01
    expect(result.asm.some(i => i.opcode === 'ASL')).toBe(true);
    expect(result.asm.some(i => i.opcode === 'LSR')).toBe(true);
    expect(result.asm.some(i => 
      i.opcode === 'AND' && i.operand === '#$01'
    )).toBe(true);
  });
});
```

---

## Configuration

```typescript
interface Strength6502Options {
  /** Maximum cycles for inline multiply (above this, call routine) */
  maxInlineCycles: number;
  
  /** Enable shift optimizations */
  enableShift: boolean;
  
  /** Enable shift+add decomposition */
  enableShiftAdd: boolean;
  
  /** Generate lookup tables for common multipliers */
  generateLookupTables: boolean;
}

export const DEFAULT_STRENGTH_OPTIONS: Strength6502Options = {
  maxInlineCycles: 30,  // ~15 ASL+ADC ops
  enableShift: true,
  enableShiftAdd: true,
  generateLookupTables: false,  // Only when size allows
};
```

---

## Summary

**6502 Strength Reduction** provides massive speedups:

| Operation | Before | After | Speedup |
|-----------|--------|-------|---------|
| `* 2` | ~80 cycles | 2 cycles | **40×** |
| `* 10` | ~100 cycles | 14 cycles | **7×** |
| `/ 2` | ~100 cycles | 2 cycles | **50×** |
| `% 8` | ~120 cycles | 2 cycles | **60×** |

**Key patterns**:
1. Power-of-2: Pure shifts (fastest)
2. Small constants: Shift + add/sub decomposition
3. Large constants: Fall back to runtime routine
4. Modulo: AND mask for powers of 2

---

**Previous**: [Flag Optimization](03-flag-opt.md)  
**Next**: [Stack Optimization](05-stack-opt.md)