# Phase 4: Strength Reduction Patterns

> **Document**: 05-strength-reduce.md  
> **Phase**: 4 - IL Peephole  
> **Focus**: Replace expensive operations with cheaper equivalents  
> **Est. Lines**: ~300

---

## Overview

**Strength Reduction** replaces expensive operations (multiplication, division, modulo) with cheaper equivalents (shifts, masks, additions). This is especially critical on the 6502 which lacks native multiply/divide instructions.

**Key Optimizations:**
1. **Multiply by Power of 2** → Left shift (x * 2 → x << 1)
2. **Divide by Power of 2** → Right shift (x / 2 → x >> 1)  
3. **Modulo by Power of 2** → Bitwise AND (x % 4 → x & 3)
4. **Multiply by Small Constants** → Shift-add combinations

---

## 6502 Context: Why This Matters

On the 6502, there are no MUL or DIV instructions. These operations require:
- **Multiply**: ~100-200 cycles using shift-add loops
- **Divide**: ~150-250 cycles using shift-subtract loops

Replacing with shifts:
- **ASL** (shift left): 2-6 cycles
- **LSR** (shift right): 2-6 cycles
- **AND**: 2-4 cycles

**Savings: 90-95% cycle reduction for power-of-2 cases!**

---

## Power of 2 Detection

### Utility Functions

```typescript
/**
 * Check if a number is a power of 2.
 */
export function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Get the log base 2 of a power of 2.
 * Returns the shift amount needed.
 */
export function log2(n: number): number {
  if (!isPowerOf2(n)) {
    throw new Error(`${n} is not a power of 2`);
  }
  
  let shift = 0;
  let value = n;
  while (value > 1) {
    value >>= 1;
    shift++;
  }
  return shift;
}

// Examples:
// isPowerOf2(1) = true, log2(1) = 0
// isPowerOf2(2) = true, log2(2) = 1
// isPowerOf2(4) = true, log2(4) = 2
// isPowerOf2(8) = true, log2(8) = 3
// isPowerOf2(16) = true, log2(16) = 4
// isPowerOf2(6) = false
```

---

## Multiply by Power of 2

### Pattern Definition

```
x * 2   → x << 1
x * 4   → x << 2
x * 8   → x << 3
x * 16  → x << 4
... etc
```

### MultiplyPowerOfTwoPattern

```typescript
/**
 * Replaces multiplication by power of 2 with left shift.
 * 
 * Pattern: MUL %r, %x, 2^n → SHL %r, %x, n
 * 
 * Savings: 100+ cycles on 6502
 */
export class MultiplyPowerOfTwoPattern extends ILPattern {
  readonly name = 'multiply-pow2';
  readonly description = 'Replace x * 2^n with x << n';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 70 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    _context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.MUL)) {
      return null;
    }
    
    // Check for power-of-2 constant (either operand)
    const op0 = this.getImmediate(inst, 0);
    const op1 = this.getImmediate(inst, 1);
    
    let multiplier: number;
    let valueOperandIndex: number;
    
    if (op0 !== null && isPowerOf2(op0) && op0 > 1) {
      multiplier = op0;
      valueOperandIndex = 1;
    } else if (op1 !== null && isPowerOf2(op1) && op1 > 1) {
      multiplier = op1;
      valueOperandIndex = 0;
    } else {
      return null;  // Not a power of 2
    }
    
    const shiftAmount = log2(multiplier);
    
    // Don't optimize if shift would overflow byte (shift > 7)
    if (shiftAmount > 7) {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    captures.set('shiftAmount', shiftAmount);
    captures.set('valueOperandIndex', valueOperandIndex);
    captures.set('inst', inst);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const inst = match.captures.get('inst') as ILInstruction;
    const result = match.captures.get('result') as string;
    const shiftAmount = match.captures.get('shiftAmount') as number;
    const valueOperandIndex = match.captures.get('valueOperandIndex') as number;
    
    const valueOperand = inst.operands[valueOperandIndex];
    
    // Create SHL instruction
    return [
      this.createInstruction(
        ILOpcode.SHL,
        [
          valueOperand,
          { kind: 'immediate', value: shiftAmount, type: { kind: 'byte', size: 1 } }
        ],
        result
      )
    ];
  }
}
```

---

## Divide by Power of 2

### Pattern Definition

```
x / 2   → x >> 1  (unsigned)
x / 4   → x >> 2
x / 8   → x >> 3
x / 16  → x >> 4
... etc
```

**Note:** This is only valid for unsigned division. Signed division requires special handling for negative numbers.

### DividePowerOfTwoPattern

```typescript
/**
 * Replaces unsigned division by power of 2 with right shift.
 * 
 * Pattern: DIV %r, %x, 2^n → SHR %r, %x, n
 * 
 * Savings: 150+ cycles on 6502
 */
export class DividePowerOfTwoPattern extends ILPattern {
  readonly name = 'divide-pow2';
  readonly description = 'Replace x / 2^n with x >> n (unsigned)';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 70 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.DIV)) {
      return null;
    }
    
    // Divisor must be second operand and power of 2
    const divisor = this.getImmediate(inst, 1);
    
    if (divisor === null || !isPowerOf2(divisor) || divisor <= 1) {
      return null;
    }
    
    // Check if dividend is unsigned (important for correctness)
    // For simplicity, assume bytes are unsigned in Blend65
    const shiftAmount = log2(divisor);
    
    if (shiftAmount > 7) {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    captures.set('shiftAmount', shiftAmount);
    captures.set('inst', inst);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const inst = match.captures.get('inst') as ILInstruction;
    const result = match.captures.get('result') as string;
    const shiftAmount = match.captures.get('shiftAmount') as number;
    
    const valueOperand = inst.operands[0];
    
    // Create SHR (logical shift right) instruction
    return [
      this.createInstruction(
        ILOpcode.SHR,
        [
          valueOperand,
          { kind: 'immediate', value: shiftAmount, type: { kind: 'byte', size: 1 } }
        ],
        result
      )
    ];
  }
}
```

---

## Modulo by Power of 2

### Pattern Definition

```
x % 2   → x & 1    (0b00000001)
x % 4   → x & 3    (0b00000011)
x % 8   → x & 7    (0b00000111)
x % 16  → x & 15   (0b00001111)
... etc
```

### ModuloPowerOfTwoPattern

```typescript
/**
 * Replaces modulo by power of 2 with bitwise AND.
 * 
 * Pattern: MOD %r, %x, 2^n → AND %r, %x, (2^n - 1)
 * 
 * Savings: 150+ cycles on 6502
 */
export class ModuloPowerOfTwoPattern extends ILPattern {
  readonly name = 'modulo-pow2';
  readonly description = 'Replace x % 2^n with x & (2^n - 1)';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 70 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    _context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.MOD)) {
      return null;
    }
    
    // Divisor must be second operand and power of 2
    const divisor = this.getImmediate(inst, 1);
    
    if (divisor === null || !isPowerOf2(divisor) || divisor <= 1) {
      return null;
    }
    
    // Mask is divisor - 1 (e.g., 8 → 7, which is 0b00000111)
    const mask = divisor - 1;
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    captures.set('mask', mask);
    captures.set('inst', inst);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const inst = match.captures.get('inst') as ILInstruction;
    const result = match.captures.get('result') as string;
    const mask = match.captures.get('mask') as number;
    
    const valueOperand = inst.operands[0];
    
    // Create AND instruction with mask
    return [
      this.createInstruction(
        ILOpcode.AND,
        [
          valueOperand,
          { kind: 'immediate', value: mask, type: { kind: 'byte', size: 1 } }
        ],
        result
      )
    ];
  }
}
```

---

## Multiply by Small Constants

### Pattern Definition

For non-power-of-2 constants, we can use shift-add combinations:

```
x * 3  → (x << 1) + x      ; x*2 + x
x * 5  → (x << 2) + x      ; x*4 + x
x * 6  → (x << 2) + (x << 1) ; x*4 + x*2
x * 7  → (x << 3) - x      ; x*8 - x
x * 9  → (x << 3) + x      ; x*8 + x
x * 10 → (x << 3) + (x << 1) ; x*8 + x*2
```

### MultiplySmallConstantPattern

```typescript
/**
 * Replaces multiplication by small constants with shift-add.
 * 
 * Only handles common cases that are cheaper than full multiply.
 */
export class MultiplySmallConstantPattern extends ILPattern {
  readonly name = 'multiply-small';
  readonly description = 'Replace x * n with shift-add combinations';
  
  /** Mapping of constants to their decomposition */
  protected readonly decompositions: Map<number, Decomposition>;
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 65 });
    
    // Pre-computed decompositions
    this.decompositions = new Map([
      [3, { shifts: [1], adds: [0], subtracts: [] }],      // x*2 + x
      [5, { shifts: [2], adds: [0], subtracts: [] }],      // x*4 + x
      [6, { shifts: [2, 1], adds: [], subtracts: [] }],    // x*4 + x*2
      [7, { shifts: [3], adds: [], subtracts: [0] }],      // x*8 - x
      [9, { shifts: [3], adds: [0], subtracts: [] }],      // x*8 + x
      [10, { shifts: [3, 1], adds: [], subtracts: [] }],   // x*8 + x*2
    ]);
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    _context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.MUL)) {
      return null;
    }
    
    // Check for known constant
    const op0 = this.getImmediate(inst, 0);
    const op1 = this.getImmediate(inst, 1);
    
    let multiplier: number;
    let valueOperandIndex: number;
    
    if (op0 !== null && this.decompositions.has(op0)) {
      multiplier = op0;
      valueOperandIndex = 1;
    } else if (op1 !== null && this.decompositions.has(op1)) {
      multiplier = op1;
      valueOperandIndex = 0;
    } else {
      return null;
    }
    
    const decomp = this.decompositions.get(multiplier)!;
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    captures.set('decomposition', decomp);
    captures.set('valueOperandIndex', valueOperandIndex);
    captures.set('inst', inst);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const inst = match.captures.get('inst') as ILInstruction;
    const result = match.captures.get('result') as string;
    const decomp = match.captures.get('decomposition') as Decomposition;
    const valueOperandIndex = match.captures.get('valueOperandIndex') as number;
    
    const valueOperand = inst.operands[valueOperandIndex];
    const instructions: ILInstruction[] = [];
    
    // Generate shifted values
    const shiftedRegs: string[] = [];
    for (let i = 0; i < decomp.shifts.length; i++) {
      const shiftAmount = decomp.shifts[i];
      const shiftedReg = `_t${i}`;
      shiftedRegs.push(shiftedReg);
      
      instructions.push(
        this.createInstruction(
          ILOpcode.SHL,
          [
            valueOperand,
            { kind: 'immediate', value: shiftAmount, type: { kind: 'byte', size: 1 } }
          ],
          shiftedReg
        )
      );
    }
    
    // Combine shifted values
    let accumulator = shiftedRegs[0];
    
    // Add other shifted values
    for (let i = 1; i < shiftedRegs.length; i++) {
      const newAcc = `_t${shiftedRegs.length + i}`;
      instructions.push(
        this.createInstruction(
          ILOpcode.ADD,
          [
            { kind: 'virtual', name: accumulator },
            { kind: 'virtual', name: shiftedRegs[i] }
          ],
          newAcc
        )
      );
      accumulator = newAcc;
    }
    
    // Add original value if needed
    for (const addIdx of decomp.adds) {
      const newAcc = `_t${instructions.length}`;
      instructions.push(
        this.createInstruction(
          ILOpcode.ADD,
          [
            { kind: 'virtual', name: accumulator },
            valueOperand
          ],
          newAcc
        )
      );
      accumulator = newAcc;
    }
    
    // Subtract original value if needed
    for (const subIdx of decomp.subtracts) {
      const newAcc = `_t${instructions.length}`;
      instructions.push(
        this.createInstruction(
          ILOpcode.SUB,
          [
            { kind: 'virtual', name: accumulator },
            valueOperand
          ],
          newAcc
        )
      );
      accumulator = newAcc;
    }
    
    // Final copy to result register
    if (accumulator !== result) {
      instructions.push(this.createCopy(result, accumulator));
    }
    
    return instructions;
  }
}

interface Decomposition {
  shifts: number[];     // Shift amounts
  adds: number[];       // Indices to add original value
  subtracts: number[];  // Indices to subtract original value
}
```

---

## Summary

| Pattern | Before | After | Cycle Savings |
|---------|--------|-------|---------------|
| Multiply ×2 | `x * 2` | `x << 1` | ~98 cycles |
| Multiply ×4 | `x * 4` | `x << 2` | ~96 cycles |
| Multiply ×8 | `x * 8` | `x << 3` | ~94 cycles |
| Divide ÷2 | `x / 2` | `x >> 1` | ~148 cycles |
| Divide ÷4 | `x / 4` | `x >> 2` | ~146 cycles |
| Modulo %2 | `x % 2` | `x & 1` | ~148 cycles |
| Modulo %4 | `x % 4` | `x & 3` | ~148 cycles |
| Multiply ×3 | `x * 3` | `(x<<1)+x` | ~80 cycles |
| Multiply ×5 | `x * 5` | `(x<<2)+x` | ~75 cycles |

**Impact:** These patterns transform expensive runtime operations into cheap compile-time shifts and masks. Critical for 6502 performance where every cycle counts.

---

## All Patterns Registered

```typescript
export function registerStrengthReductionPatterns(
  registry: PatternRegistry<ILInstruction>
): void {
  registry.register(
    new MultiplyPowerOfTwoPattern(),
    PatternCategory.STRENGTH_REDUCTION,
    { tags: ['shift', 'multiply'] }
  );
  
  registry.register(
    new DividePowerOfTwoPattern(),
    PatternCategory.STRENGTH_REDUCTION,
    { tags: ['shift', 'divide'] }
  );
  
  registry.register(
    new ModuloPowerOfTwoPattern(),
    PatternCategory.STRENGTH_REDUCTION,
    { tags: ['mask', 'modulo'] }
  );
  
  registry.register(
    new MultiplySmallConstantPattern(),
    PatternCategory.STRENGTH_REDUCTION,
    { tags: ['shift-add', 'multiply'] }
  );
}
```

---

**Previous**: [04-arithmetic-identity.md](04-arithmetic-identity.md)  
**Next**: [99-phase-tasks.md](99-phase-tasks.md) - Phase task checklist