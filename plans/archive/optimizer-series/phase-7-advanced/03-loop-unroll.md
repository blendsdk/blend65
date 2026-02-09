# Loop Unrolling

> **Phase**: 7 - Advanced Optimizations  
> **Document**: 03-loop-unroll.md  
> **Focus**: Full and partial loop unrolling strategies  
> **Est. Lines**: ~350

---

## Overview

**Loop unrolling** replicates the loop body multiple times to reduce loop overhead (counter updates, branch instructions) and create opportunities for further optimization.

**Benefits on 6502**:
- Eliminates expensive DEX/INX + branch instructions (5-7 cycles per iteration)
- Enables instruction scheduling across unrolled iterations
- Creates constant folding opportunities for loop indices
- Critical for tight inner loops (screen fills, sprite updates)

---

## 1. Types of Loop Unrolling

### 1.1 Full Unrolling

**Full unrolling** completely eliminates the loop by replicating the body for each iteration:

```js
// Before (4 iterations)
for (let i = 0; i < 4; i++) {
    buffer[i] = 0;
}

// After full unrolling
buffer[0] = 0;
buffer[1] = 0;
buffer[2] = 0;
buffer[3] = 0;
```

**When to use**: Trip count is small and known at compile time (typically ≤ 8).

### 1.2 Partial Unrolling

**Partial unrolling** replicates the body N times but keeps the loop:

```js
// Before (100 iterations)
for (let i = 0; i < 100; i++) {
    buffer[i] = 0;
}

// After 4× partial unrolling (25 iterations)
for (let i = 0; i < 100; i += 4) {
    buffer[i] = 0;
    buffer[i+1] = 0;
    buffer[i+2] = 0;
    buffer[i+3] = 0;
}
```

**When to use**: Trip count is large or unknown but divisible by unroll factor.

### 1.3 Unrolling with Remainder

When trip count isn't divisible by unroll factor:

```js
// Before (10 iterations)
for (let i = 0; i < 10; i++) {
    buffer[i] = 0;
}

// After 4× unrolling with remainder
// Main loop: 2 iterations (handles 8 elements)
for (let i = 0; i < 8; i += 4) {
    buffer[i] = 0;
    buffer[i+1] = 0;
    buffer[i+2] = 0;
    buffer[i+3] = 0;
}
// Remainder: 2 elements
buffer[8] = 0;
buffer[9] = 0;
```

---

## 2. Unrolling Algorithm

### 2.1 Core Unrolling Logic

```typescript
/**
 * Loop unrolling pass.
 */
export class LoopUnrollPass extends OptimizationPass {
  /** Maximum unroll factor for full unrolling */
  protected static readonly MAX_FULL_UNROLL = 8;
  
  /** Default partial unroll factor */
  protected static readonly DEFAULT_PARTIAL_FACTOR = 4;
  
  /** Maximum code expansion allowed (bytes) */
  protected static readonly MAX_EXPANSION = 64;
  
  /**
   * Main entry point.
   */
  public run(func: ILFunction): boolean {
    let changed = false;
    
    const loopResults = this.loopAnalysis.analyzeLoops(func);
    
    // Process innermost loops first
    for (const result of this.getInnermostFirst(loopResults)) {
      const decision = this.makeUnrollDecision(result);
      
      if (decision.type === 'full') {
        changed = this.fullyUnroll(result, decision) || changed;
      } else if (decision.type === 'partial') {
        changed = this.partiallyUnroll(result, decision) || changed;
      }
      // decision.type === 'none' - don't unroll
    }
    
    return changed;
  }
  
  /**
   * Decide whether and how to unroll a loop.
   */
  protected makeUnrollDecision(result: LoopAnalysisResult): UnrollDecision {
    const loop = result.loop;
    const tripCount = result.tripCount;
    
    // Check safety first
    if (!this.canUnroll(result)) {
      return { type: 'none', reason: 'safety check failed' };
    }
    
    // Full unroll if small constant trip count
    if (tripCount !== null && tripCount <= LoopUnrollPass.MAX_FULL_UNROLL) {
      const expandedSize = this.estimateUnrolledSize(result, tripCount);
      if (expandedSize <= LoopUnrollPass.MAX_EXPANSION) {
        return { type: 'full', factor: tripCount };
      }
    }
    
    // Partial unroll for larger loops
    if (this.shouldPartialUnroll(result)) {
      const factor = this.choosePartialFactor(result);
      return { type: 'partial', factor };
    }
    
    return { type: 'none', reason: 'not profitable' };
  }
}

/**
 * Unroll decision type.
 */
interface UnrollDecision {
  type: 'full' | 'partial' | 'none';
  factor?: number;
  reason?: string;
}
```

### 2.2 Safety Checks

```typescript
/**
 * Check if loop can be safely unrolled.
 */
protected canUnroll(result: LoopAnalysisResult): boolean {
  const loop = result.loop;
  
  // 1. Must have single latch (single back edge)
  if (!this.hasSingleLatch(loop)) {
    return false;
  }
  
  // 2. Must have single exit (or we need complex remainder handling)
  if (!loop.hasSingleExit()) {
    return false;
  }
  
  // 3. Must have identifiable primary induction variable
  if (result.primaryIV === null) {
    return false;
  }
  
  // 4. No irreducible control flow in body
  if (this.hasIrreducibleControlFlow(loop)) {
    return false;
  }
  
  // 5. No function calls (unless marked unrollable)
  if (this.hasNonUnrollableCalls(loop)) {
    return false;
  }
  
  // 6. Check loop-carried dependencies don't prevent unrolling
  if (!this.dependenciesAllowUnroll(result)) {
    return false;
  }
  
  return true;
}

/**
 * Check if loop-carried dependencies allow unrolling.
 */
protected dependenciesAllowUnroll(result: LoopAnalysisResult): boolean {
  for (const dep of result.dependencies) {
    // Distance 1 dependencies are OK (adjacent iterations)
    // Distance > 1 requires that distance to be <= unroll factor
    if (dep.type === DependencyType.FLOW && dep.distance === 1) {
      // Need special handling but can unroll
      continue;
    }
  }
  return true;
}
```

---

## 3. Full Unrolling Implementation

### 3.1 Full Unroll Algorithm

```typescript
/**
 * Fully unroll a loop (eliminate loop entirely).
 */
protected fullyUnroll(result: LoopAnalysisResult, decision: UnrollDecision): boolean {
  const loop = result.loop;
  const tripCount = decision.factor!;
  const iv = result.primaryIV!;
  
  // Collect all instructions in loop body (excluding control flow)
  const bodyInstructions = this.collectBodyInstructions(loop);
  
  // Create unrolled instruction sequence
  const unrolledInsts: ILInstruction[] = [];
  
  for (let iter = 0; iter < tripCount; iter++) {
    // Calculate IV value for this iteration
    const ivValue = this.computeIVValue(iv, iter);
    
    // Clone and substitute each body instruction
    for (const inst of bodyInstructions) {
      const cloned = this.cloneInstruction(inst, iter);
      
      // Substitute IV with constant
      this.substituteIV(cloned, iv.variable, ivValue);
      
      unrolledInsts.push(cloned);
    }
  }
  
  // Replace loop with unrolled sequence
  this.replaceLoopWithSequence(loop, unrolledInsts);
  
  return true;
}

/**
 * Compute IV value at given iteration.
 */
protected computeIVValue(iv: InductionVariable, iteration: number): number {
  const init = typeof iv.init === 'number' ? iv.init : 0;
  return init + (iv.step * iteration);
}

/**
 * Clone an instruction for a specific unroll iteration.
 */
protected cloneInstruction(inst: ILInstruction, iteration: number): ILInstruction {
  const clone = { ...inst };
  
  // Rename destinations to avoid conflicts
  if (clone.dest) {
    clone.dest = `${clone.dest}_u${iteration}`;
  }
  
  // Update operand references
  clone.operands = clone.operands.map(op => {
    if (this.isTemporary(op)) {
      return `${op}_u${iteration}`;
    }
    return op;
  });
  
  return clone;
}
```

### 3.2 Full Unroll Example

```asm
; Before: Loop to clear 4 bytes
    LDX #3
loop:
    LDA #$00
    STA buffer,X
    DEX
    BPL loop          ; 4 iterations × 10 cycles = 40 cycles

; After full unrolling
    LDA #$00          ; 2 cycles
    STA buffer+3      ; 4 cycles
    STA buffer+2      ; 4 cycles
    STA buffer+1      ; 4 cycles
    STA buffer        ; 4 cycles
                      ; Total: 18 cycles (55% savings!)
```

---

## 4. Partial Unrolling Implementation

### 4.1 Partial Unroll Algorithm

```typescript
/**
 * Partially unroll a loop (keep loop but expand body).
 */
protected partiallyUnroll(result: LoopAnalysisResult, decision: UnrollDecision): boolean {
  const loop = result.loop;
  const factor = decision.factor!;
  const iv = result.primaryIV!;
  const tripCount = result.tripCount;
  
  // Determine if we need remainder handling
  const needsRemainder = tripCount === null || (tripCount % factor !== 0);
  
  // Collect body instructions
  const bodyInstructions = this.collectBodyInstructions(loop);
  
  // Build unrolled body
  const unrolledBody: ILInstruction[] = [];
  
  for (let u = 0; u < factor; u++) {
    for (const inst of bodyInstructions) {
      const cloned = this.cloneInstruction(inst, u);
      
      // Adjust IV-relative offsets
      this.adjustIVOffset(cloned, iv.variable, u * iv.step);
      
      unrolledBody.push(cloned);
    }
  }
  
  // Update IV increment
  const newStep = iv.step * factor;
  this.updateIVIncrement(loop, iv.variable, newStep);
  
  // Replace original body with unrolled body
  this.replaceLoopBody(loop, unrolledBody);
  
  // Handle remainder if needed
  if (needsRemainder) {
    this.generateRemainderLoop(loop, factor, tripCount);
  }
  
  return true;
}

/**
 * Choose optimal partial unroll factor.
 */
protected choosePartialFactor(result: LoopAnalysisResult): number {
  const tripCount = result.tripCount;
  const bodySize = this.estimateBodySize(result);
  
  // Prefer powers of 2 for efficiency
  const candidates = [8, 4, 2];
  
  for (const factor of candidates) {
    // Check code size expansion
    const expandedSize = bodySize * factor;
    if (expandedSize > LoopUnrollPass.MAX_EXPANSION) {
      continue;
    }
    
    // Prefer factor that divides trip count evenly
    if (tripCount !== null && tripCount % factor === 0) {
      return factor;
    }
    
    // Otherwise just pick first that fits
    return factor;
  }
  
  return 2; // Minimum useful unroll
}
```

### 4.2 Partial Unroll Example

```asm
; Before: 100 iteration loop
    LDX #99
loop:
    LDA data,X
    STA buffer,X
    DEX
    BPL loop          ; 100 × 9 = 900 cycles

; After 4× partial unrolling (25 iterations)
    LDX #96
loop:
    LDA data+3,X
    STA buffer+3,X
    LDA data+2,X
    STA buffer+2,X
    LDA data+1,X
    STA buffer+1,X
    LDA data,X
    STA buffer,X
    DEX
    DEX
    DEX
    DEX
    BPL loop          ; 25 × 29 = 725 cycles (19% savings)
    
    ; Remainder: last 4 bytes (X = -4, handle specially)
    ; ... remainder code ...
```

---

## 5. Remainder Handling

### 5.1 Epilogue Generation

```typescript
/**
 * Generate remainder handling code.
 */
protected generateRemainderLoop(
  loop: NaturalLoop, 
  factor: number,
  tripCount: number | null
): void {
  const iv = loop.inductionVars[0];
  
  if (tripCount !== null) {
    // Known trip count: generate unrolled remainder
    const remainder = tripCount % factor;
    
    if (remainder > 0) {
      this.generateUnrolledRemainder(loop, remainder);
    }
  } else {
    // Unknown trip count: generate remainder loop
    this.generateRemainderLoopDynamic(loop, factor);
  }
}

/**
 * Generate statically unrolled remainder.
 */
protected generateUnrolledRemainder(loop: NaturalLoop, count: number): void {
  // Similar to full unrolling, but just for remainder iterations
  const bodyInstructions = this.collectBodyInstructions(loop);
  const remainderInsts: ILInstruction[] = [];
  
  for (let i = 0; i < count; i++) {
    for (const inst of bodyInstructions) {
      const cloned = this.cloneInstruction(inst, `rem${i}`);
      remainderInsts.push(cloned);
    }
  }
  
  // Insert after main loop
  this.insertAfterLoop(loop, remainderInsts);
}

/**
 * Generate dynamic remainder loop (Duff's device style).
 */
protected generateRemainderLoopDynamic(loop: NaturalLoop, factor: number): void {
  // For unknown trip count, compute remainder at runtime:
  // remainder = tripCount % factor
  // 
  // Then either:
  // 1. Simple: add a small remainder loop
  // 2. Advanced: use computed jump (Duff's device)
  
  // For 6502, simple remainder loop is usually better
  this.generateSimpleRemainderLoop(loop, factor);
}
```

### 5.2 Duff's Device (Optional)

```typescript
/**
 * Generate Duff's device for computed remainder jump.
 * Advanced technique - use when remainder is significant.
 */
protected generateDuffsDevice(loop: NaturalLoop, factor: number): void {
  // Duff's device uses computed jump to enter unrolled loop
  // at the correct point for remainder
  
  // For 6502:
  // 1. Calculate entry offset: (factor - remainder) * bytes_per_iteration
  // 2. Use self-modifying code or jump table
  
  // Example for factor=4:
  // LDA remainder
  // ASL A             ; × 2
  // ASL A             ; × 4 (bytes per unrolled iteration)
  // TAX
  // JMP (jumptable,X)
  // jumptable:
  //   .word case3, case2, case1, case0
}
```

---

## 6. 6502-Specific Optimizations

### 6.1 Index Register Optimization

```typescript
/**
 * 6502-specific unrolling optimizations.
 */
protected optimize6502Unroll(unrolledBody: ILInstruction[]): void {
  // 1. For count-down loops, unroll maintains X/Y as counter
  // 2. Use ,X or ,Y indexed addressing
  // 3. Consider self-modifying code for absolute addresses
  
  // Pattern: LDA data,X; STA buffer,X can be optimized
  // when unrolled to use different fixed offsets
}

/**
 * Optimize indexed addressing in unrolled loop.
 */
protected optimizeIndexedAccess(
  instructions: ILInstruction[],
  unrollFactor: number
): void {
  // For 6502, when unrolling indexed access:
  // Original: LDA data,X
  // Unrolled: LDA data+3,X; LDA data+2,X; LDA data+1,X; LDA data,X
  //
  // Or with decremented index:
  // DEX; DEX; DEX; DEX at end instead of per-iteration
}
```

### 6.2 Zero Page Considerations

```asm
; Original loop using zero page indirect
    LDY #99
loop:
    LDA ($FB),Y       ; (zp),Y addressing
    STA ($FD),Y
    DEY
    BPL loop

; After 2× unrolling
    LDY #98
loop:
    LDA ($FB),Y
    STA ($FD),Y
    DEY
    LDA ($FB),Y
    STA ($FD),Y
    DEY
    BPL loop
    
    ; Remainder (if odd count)
    LDA ($FB),Y
    STA ($FD),Y
```

---

## 7. Profitability Analysis

### 7.1 Cost Model

```typescript
/**
 * Estimate benefit of unrolling.
 */
protected estimateUnrollBenefit(result: LoopAnalysisResult, factor: number): number {
  const tripCount = result.tripCount ?? 100; // Assume 100 if unknown
  
  // Original loop cost
  const originalIterations = tripCount;
  const loopOverhead = 5; // DEX/INX + branch cycles
  const bodySize = this.estimateBodyCycles(result);
  const originalCost = originalIterations * (bodySize + loopOverhead);
  
  // Unrolled loop cost
  const unrolledIterations = Math.ceil(tripCount / factor);
  const unrolledBodySize = bodySize * factor;
  const unrolledCost = unrolledIterations * (unrolledBodySize + loopOverhead);
  
  // Remainder cost (if applicable)
  const remainderCost = (tripCount % factor) * bodySize;
  
  return originalCost - (unrolledCost + remainderCost);
}

/**
 * Check if unrolling is profitable.
 */
protected shouldPartialUnroll(result: LoopAnalysisResult): boolean {
  // Don't unroll tiny loops (already minimal overhead)
  if (this.estimateBodyCycles(result) < 6) {
    return false;
  }
  
  // Don't unroll if body is too large
  if (this.estimateBodySize(result) > 32) {
    return false;
  }
  
  // Check benefit
  const benefit = this.estimateUnrollBenefit(result, 4);
  return benefit > 20; // At least 20 cycles saved
}
```

### 7.2 Size vs Speed Tradeoff

```typescript
/**
 * Adjust unrolling based on optimization level.
 */
protected getUnrollSettings(optLevel: OptLevel): UnrollSettings {
  switch (optLevel) {
    case '-O1':
      // Conservative - only full unroll tiny loops
      return { maxFullUnroll: 4, maxPartialFactor: 2, maxExpansion: 16 };
    
    case '-O2':
      // Balanced
      return { maxFullUnroll: 8, maxPartialFactor: 4, maxExpansion: 32 };
    
    case '-O3':
      // Aggressive
      return { maxFullUnroll: 16, maxPartialFactor: 8, maxExpansion: 64 };
    
    case '-Os':
      // Size preference - minimal unrolling
      return { maxFullUnroll: 2, maxPartialFactor: 0, maxExpansion: 8 };
    
    case '-Oz':
      // Minimum size - no unrolling
      return { maxFullUnroll: 0, maxPartialFactor: 0, maxExpansion: 0 };
    
    default:
      return { maxFullUnroll: 8, maxPartialFactor: 4, maxExpansion: 32 };
  }
}
```

---

## 8. Common Patterns

### 8.1 Screen Fill Pattern

```js
// Common C64 screen fill
for (let i = 0; i < 1000; i++) {
    screen[i] = char;
}

// After 4× unrolling (250 iterations)
for (let i = 0; i < 1000; i += 4) {
    screen[i] = char;
    screen[i+1] = char;
    screen[i+2] = char;
    screen[i+3] = char;
}
```

```asm
; Optimized 6502 assembly
    LDA char
    LDX #250
loop:
    STA screen,Y
    STA screen+250,Y
    STA screen+500,Y
    STA screen+750,Y
    DEY
    BNE loop
```

### 8.2 Memory Copy Pattern

```js
// Memory copy
for (let i = 0; i < len; i++) {
    dest[i] = src[i];
}

// After 2× unrolling
for (let i = 0; i < len; i += 2) {
    dest[i] = src[i];
    dest[i+1] = src[i+1];
}
```

### 8.3 Sprite Update Pattern

```js
// Update 8 sprites
for (let i = 0; i < 8; i++) {
    let offset = i * 2;
    vic[offset] = spriteX[i];
    vic[offset + 1] = spriteY[i];
}

// After full unrolling (8 iterations)
vic[0] = spriteX[0]; vic[1] = spriteY[0];
vic[2] = spriteX[1]; vic[3] = spriteY[1];
// ... etc (fully unrolled)
```

---

## 9. Integration and Pass Order

```typescript
/**
 * Recommended pass order with loop unrolling.
 */
const passOrder = [
  // Analysis
  'loop-analysis',
  'use-def',
  'liveness',
  
  // Pre-unroll optimizations
  'licm',              // Hoist invariants first (smaller loop body)
  'constant-prop',
  
  // Unrolling
  'loop-unroll',       // Unroll optimized loops
  
  // Post-unroll optimizations
  'constant-fold',     // Fold unrolled constants
  'dce',               // Remove dead unrolled code
  'peephole',          // Clean up unrolled patterns
];
```

---

## Success Criteria

- [ ] Full unrolling for small constant-bound loops
- [ ] Partial unrolling with configurable factor
- [ ] Correct remainder handling
- [ ] IV substitution with constants
- [ ] Size vs speed tradeoff based on -O level
- [ ] 6502-specific indexed addressing optimization
- [ ] Integration with LICM (unroll after hoisting)
- [ ] ~30 tests passing for loop unrolling

---

**Previous Document**: [02-licm.md](02-licm.md)  
**Next Document**: [04-register-alloc.md](04-register-alloc.md)  
**Parent**: [00-phase-index.md](00-phase-index.md)