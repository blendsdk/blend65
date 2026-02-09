# Phase 4: Arithmetic Identity Patterns

> **Document**: 04-arithmetic-identity.md  
> **Phase**: 4 - IL Peephole  
> **Focus**: Arithmetic identity simplifications (x+0, x*1, x-x, etc.)  
> **Est. Lines**: ~300

---

## Overview

**Arithmetic Identity Patterns** simplify trivial arithmetic operations that always produce predictable results. These patterns eliminate unnecessary computations at the IL level.

**Identity Categories:**
1. **Additive Identity** - x + 0 = x, x - 0 = x
2. **Multiplicative Identity** - x * 1 = x, x / 1 = x
3. **Zero Patterns** - x * 0 = 0, x & 0 = 0
4. **Self Patterns** - x - x = 0, x / x = 1, x | x = x, x & x = x
5. **Bitwise Identity** - x | 0 = x, x ^ 0 = x, x & 0xFF = x (for bytes)

---

## Additive Identity Patterns

### Add Zero (x + 0 = x)

```typescript
/**
 * Eliminates addition of zero.
 * 
 * Pattern: ADD %r, %x, 0 → COPY %r, %x
 */
export class AddZeroPattern extends ILPattern {
  readonly name = 'add-zero';
  readonly description = 'Eliminate x + 0 = x';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 80 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.ADD)) {
      return null;
    }
    
    // Check for zero operand (either position)
    const op0 = this.getImmediate(inst, 0);
    const op1 = this.getImmediate(inst, 1);
    
    let nonZeroOperandIndex: number;
    
    if (op0 === 0) {
      nonZeroOperandIndex = 1;
    } else if (op1 === 0) {
      nonZeroOperandIndex = 0;
    } else {
      return null;  // Neither operand is zero
    }
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    captures.set('nonZeroIndex', nonZeroOperandIndex);
    captures.set('inst', inst);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const inst = match.captures.get('inst') as ILInstruction;
    const result = match.captures.get('result') as string;
    const nonZeroIndex = match.captures.get('nonZeroIndex') as number;
    
    const operand = inst.operands[nonZeroIndex];
    
    if (operand.kind === 'virtual') {
      // Replace with COPY
      return [this.createCopy(result, operand.name)];
    } else if (operand.kind === 'immediate') {
      // Replace with CONST
      return [this.createConst(result, operand.value, operand.type)];
    }
    
    // Shouldn't reach here
    return [inst];
  }
}
```

### Subtract Zero (x - 0 = x)

```typescript
/**
 * Eliminates subtraction of zero.
 * 
 * Pattern: SUB %r, %x, 0 → COPY %r, %x
 */
export class SubtractZeroPattern extends ILPattern {
  readonly name = 'subtract-zero';
  readonly description = 'Eliminate x - 0 = x';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 80 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    _context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.SUB)) {
      return null;
    }
    
    // Only right operand can be zero (x - 0 = x, but 0 - x ≠ x)
    const op1 = this.getImmediate(inst, 1);
    
    if (op1 !== 0) {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    captures.set('inst', inst);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const inst = match.captures.get('inst') as ILInstruction;
    const result = match.captures.get('result') as string;
    
    const operand = inst.operands[0];
    
    if (operand.kind === 'virtual') {
      return [this.createCopy(result, operand.name)];
    } else if (operand.kind === 'immediate') {
      return [this.createConst(result, operand.value, operand.type)];
    }
    
    return [inst];
  }
}
```

---

## Multiplicative Identity Patterns

### Multiply One (x * 1 = x)

```typescript
/**
 * Eliminates multiplication by one.
 * 
 * Pattern: MUL %r, %x, 1 → COPY %r, %x
 */
export class MultiplyOnePattern extends ILPattern {
  readonly name = 'multiply-one';
  readonly description = 'Eliminate x * 1 = x';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 80 });
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
    
    // Check for one operand (either position - commutative)
    const op0 = this.getImmediate(inst, 0);
    const op1 = this.getImmediate(inst, 1);
    
    let nonOneIndex: number;
    
    if (op0 === 1) {
      nonOneIndex = 1;
    } else if (op1 === 1) {
      nonOneIndex = 0;
    } else {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    captures.set('nonOneIndex', nonOneIndex);
    captures.set('inst', inst);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const inst = match.captures.get('inst') as ILInstruction;
    const result = match.captures.get('result') as string;
    const nonOneIndex = match.captures.get('nonOneIndex') as number;
    
    const operand = inst.operands[nonOneIndex];
    
    if (operand.kind === 'virtual') {
      return [this.createCopy(result, operand.name)];
    } else if (operand.kind === 'immediate') {
      return [this.createConst(result, operand.value, operand.type)];
    }
    
    return [inst];
  }
}
```

### Divide One (x / 1 = x)

```typescript
/**
 * Eliminates division by one.
 * 
 * Pattern: DIV %r, %x, 1 → COPY %r, %x
 */
export class DivideOnePattern extends ILPattern {
  readonly name = 'divide-one';
  readonly description = 'Eliminate x / 1 = x';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 80 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    _context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.DIV)) {
      return null;
    }
    
    // Only divisor can be one (x / 1 = x)
    const op1 = this.getImmediate(inst, 1);
    
    if (op1 !== 1) {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    captures.set('inst', inst);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const inst = match.captures.get('inst') as ILInstruction;
    const result = match.captures.get('result') as string;
    
    const operand = inst.operands[0];
    
    if (operand.kind === 'virtual') {
      return [this.createCopy(result, operand.name)];
    } else if (operand.kind === 'immediate') {
      return [this.createConst(result, operand.value, operand.type)];
    }
    
    return [inst];
  }
}
```

---

## Zero Patterns

### Multiply Zero (x * 0 = 0)

```typescript
/**
 * Simplifies multiplication by zero to constant zero.
 * 
 * Pattern: MUL %r, %x, 0 → CONST %r, 0
 */
export class MultiplyZeroPattern extends ILPattern {
  readonly name = 'multiply-zero';
  readonly description = 'Simplify x * 0 = 0';
  
  constructor() {
    // Higher priority than multiply-one
    super({ minLength: 1, maxLength: 1, priority: 85 });
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
    
    // Check for zero operand (either position - commutative)
    const op0 = this.getImmediate(inst, 0);
    const op1 = this.getImmediate(inst, 1);
    
    if (op0 !== 0 && op1 !== 0) {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const result = match.captures.get('result') as string;
    
    // Result is always 0
    return [this.createConst(result, 0, { kind: 'byte', size: 1 })];
  }
}
```

### AND Zero (x & 0 = 0)

```typescript
/**
 * Simplifies bitwise AND with zero.
 * 
 * Pattern: AND %r, %x, 0 → CONST %r, 0
 */
export class AndZeroPattern extends ILPattern {
  readonly name = 'and-zero';
  readonly description = 'Simplify x & 0 = 0';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 85 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    _context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.AND)) {
      return null;
    }
    
    const op0 = this.getImmediate(inst, 0);
    const op1 = this.getImmediate(inst, 1);
    
    if (op0 !== 0 && op1 !== 0) {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const result = match.captures.get('result') as string;
    return [this.createConst(result, 0, { kind: 'byte', size: 1 })];
  }
}
```

---

## Self Patterns

### Subtract Self (x - x = 0)

```typescript
/**
 * Simplifies subtraction of value from itself.
 * 
 * Pattern: SUB %r, %x, %x → CONST %r, 0
 */
export class SubtractSelfPattern extends ILPattern {
  readonly name = 'subtract-self';
  readonly description = 'Simplify x - x = 0';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 80 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    _context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.SUB)) {
      return null;
    }
    
    // Check if both operands are same virtual register
    if (!this.sameVirtualReg(inst, 0, inst, 1)) {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const result = match.captures.get('result') as string;
    return [this.createConst(result, 0, { kind: 'byte', size: 1 })];
  }
}
```

### Divide Self (x / x = 1)

```typescript
/**
 * Simplifies division of value by itself.
 * 
 * Pattern: DIV %r, %x, %x → CONST %r, 1
 * 
 * Note: Must verify x ≠ 0, but for simplicity we assume
 * division by zero is handled elsewhere.
 */
export class DivideSelfPattern extends ILPattern {
  readonly name = 'divide-self';
  readonly description = 'Simplify x / x = 1';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 80 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    _context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.DIV)) {
      return null;
    }
    
    if (!this.sameVirtualReg(inst, 0, inst, 1)) {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const result = match.captures.get('result') as string;
    return [this.createConst(result, 1, { kind: 'byte', size: 1 })];
  }
}
```

### XOR Self (x ^ x = 0)

```typescript
/**
 * Simplifies XOR of value with itself.
 * 
 * Pattern: XOR %r, %x, %x → CONST %r, 0
 */
export class XorSelfPattern extends ILPattern {
  readonly name = 'xor-self';
  readonly description = 'Simplify x ^ x = 0';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 80 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    _context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.XOR)) {
      return null;
    }
    
    if (!this.sameVirtualReg(inst, 0, inst, 1)) {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const result = match.captures.get('result') as string;
    return [this.createConst(result, 0, { kind: 'byte', size: 1 })];
  }
}
```

### OR Self / AND Self (x | x = x, x & x = x)

```typescript
/**
 * Simplifies OR of value with itself.
 * 
 * Pattern: OR %r, %x, %x → COPY %r, %x
 */
export class OrSelfPattern extends ILPattern {
  readonly name = 'or-self';
  readonly description = 'Simplify x | x = x';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 80 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    _context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.OR)) {
      return null;
    }
    
    if (!this.sameVirtualReg(inst, 0, inst, 1)) {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    captures.set('value', this.getVirtualReg(inst, 0));
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const result = match.captures.get('result') as string;
    const value = match.captures.get('value') as string;
    return [this.createCopy(result, value)];
  }
}

/**
 * Simplifies AND of value with itself.
 * 
 * Pattern: AND %r, %x, %x → COPY %r, %x
 */
export class AndSelfPattern extends ILPattern {
  readonly name = 'and-self';
  readonly description = 'Simplify x & x = x';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 80 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    _context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.AND)) {
      return null;
    }
    
    if (!this.sameVirtualReg(inst, 0, inst, 1)) {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    captures.set('value', this.getVirtualReg(inst, 0));
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const result = match.captures.get('result') as string;
    const value = match.captures.get('value') as string;
    return [this.createCopy(result, value)];
  }
}
```

---

## Bitwise Identity Patterns

### OR Zero (x | 0 = x)

```typescript
/**
 * Eliminates OR with zero.
 * 
 * Pattern: OR %r, %x, 0 → COPY %r, %x
 */
export class OrZeroPattern extends ILPattern {
  readonly name = 'or-zero';
  readonly description = 'Eliminate x | 0 = x';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 80 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    _context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.OR)) {
      return null;
    }
    
    const op0 = this.getImmediate(inst, 0);
    const op1 = this.getImmediate(inst, 1);
    
    let nonZeroIndex: number;
    
    if (op0 === 0) {
      nonZeroIndex = 1;
    } else if (op1 === 0) {
      nonZeroIndex = 0;
    } else {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    captures.set('nonZeroIndex', nonZeroIndex);
    captures.set('inst', inst);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const inst = match.captures.get('inst') as ILInstruction;
    const result = match.captures.get('result') as string;
    const nonZeroIndex = match.captures.get('nonZeroIndex') as number;
    
    const operand = inst.operands[nonZeroIndex];
    
    if (operand.kind === 'virtual') {
      return [this.createCopy(result, operand.name)];
    } else if (operand.kind === 'immediate') {
      return [this.createConst(result, operand.value, operand.type)];
    }
    
    return [inst];
  }
}
```

### XOR Zero (x ^ 0 = x)

```typescript
/**
 * Eliminates XOR with zero.
 * 
 * Pattern: XOR %r, %x, 0 → COPY %r, %x
 */
export class XorZeroPattern extends ILPattern {
  readonly name = 'xor-zero';
  readonly description = 'Eliminate x ^ 0 = x';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 80 });
  }
  
  // Same structure as OrZeroPattern, just checks XOR opcode
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    _context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const inst = instructions[index];
    
    if (!this.hasOpcode(inst, ILOpcode.XOR)) {
      return null;
    }
    
    const op0 = this.getImmediate(inst, 0);
    const op1 = this.getImmediate(inst, 1);
    
    if (op0 !== 0 && op1 !== 0) {
      return null;
    }
    
    const nonZeroIndex = op0 === 0 ? 1 : 0;
    
    const captures = new Map<string, unknown>();
    captures.set('result', inst.result);
    captures.set('nonZeroIndex', nonZeroIndex);
    captures.set('inst', inst);
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const inst = match.captures.get('inst') as ILInstruction;
    const result = match.captures.get('result') as string;
    const nonZeroIndex = match.captures.get('nonZeroIndex') as number;
    
    const operand = inst.operands[nonZeroIndex];
    
    if (operand.kind === 'virtual') {
      return [this.createCopy(result, operand.name)];
    }
    
    return [inst];
  }
}
```

---

## Summary

| Pattern | Before | After | Savings |
|---------|--------|-------|---------|
| Add Zero | `x + 0` | `x` | 2-6 cycles |
| Subtract Zero | `x - 0` | `x` | 2-6 cycles |
| Multiply One | `x * 1` | `x` | 50-100 cycles |
| Divide One | `x / 1` | `x` | 50-100 cycles |
| Multiply Zero | `x * 0` | `0` | 50-100 cycles |
| AND Zero | `x & 0` | `0` | 2-4 cycles |
| Subtract Self | `x - x` | `0` | 2-6 cycles |
| Divide Self | `x / x` | `1` | 50-100 cycles |
| XOR Self | `x ^ x` | `0` | 2-4 cycles |
| OR Self | `x | x` | `x` | 2-4 cycles |
| AND Self | `x & x` | `x` | 2-4 cycles |
| OR Zero | `x | 0` | `x` | 2-4 cycles |
| XOR Zero | `x ^ 0` | `x` | 2-4 cycles |

**Total: 13 patterns covering all common arithmetic identities.**

---

**Previous**: [03-load-store-il.md](03-load-store-il.md)  
**Next**: [05-strength-reduce.md](05-strength-reduce.md) - Strength reduction patterns