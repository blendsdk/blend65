# Loop Structure: Beyond God-Level IL Generator

> **Document**: 06-loop-structure.md
> **Parent**: [Index](00-index.md)

---

## Overview

This document describes how **loop structure is preserved in IL** for loop-specific optimizations like unrolling, strength reduction, and loop-invariant code motion.

---

## Why Preserve Loop Structure?

Traditional IL loses loop information:
```
; Original: for (i = 0; i < 10; i++) { ... }
; Traditional IL - just flat jumps:
  LOAD_IMM 0
  STORE_BYTE i
L0:
  LOAD_BYTE i
  CMP_IMM 10
  JUMP_GE L1
  ; body
  LOAD_BYTE i
  ADD_IMM 1
  STORE_BYTE i
  JUMP L0
L1:
```

**Problems:**
- Optimizer doesn't know this is a counted loop (i = 0 to 10)
- Can't easily decide on loop unrolling
- Loop-invariant hoisting requires re-analysis

---

## Loop Data Structure

```typescript
interface ILLoop {
  /** Label at loop header (start) */
  headerLabel: string;
  
  /** Label at loop exit */
  exitLabel: string;
  
  /** Loop nesting depth (1 = outermost) */
  depth: number;
  
  /** Is this a counted loop (for i = 0 to n)? */
  isCountedLoop: boolean;
  
  /** Loop counter slot (if counted) */
  counterSlot?: FrameSlot;
  
  /** Loop bound (if statically known) */
  boundValue?: number;
  
  /** Loop bound slot (if dynamic) */
  boundSlot?: FrameSlot;
  
  /** Estimated iteration count */
  estimatedIterations?: number;
}
```

---

## Loop Detection During IL Generation

### For Loops

```typescript
protected generateFor(stmt: ForStatement): void {
  const loopLabel = this.builder.newLabel('for');
  const exitLabel = this.builder.newLabel('endfor');
  
  // Detect if this is a counted loop
  const loopInfo = this.analyzeForLoop(stmt);
  
  // Generate initializer
  if (stmt.initializer) {
    this.generateStatement(stmt.initializer);
  }
  
  // Record loop start
  this.builder.label(loopLabel);
  this.currentLoopDepth++;
  
  // Generate condition
  if (stmt.condition) {
    this.generateExpression(stmt.condition);
    this.builder.cmpImm(0);
    this.builder.jumpEq(exitLabel);
  }
  
  // Generate body
  this.generateStatement(stmt.body);
  
  // Generate update
  if (stmt.update) {
    this.generateExpression(stmt.update);
  }
  
  // Loop back
  this.builder.jump(loopLabel);
  this.builder.label(exitLabel);
  this.currentLoopDepth--;
  
  // Record loop structure
  if (loopInfo) {
    this.currentFunction.loops.push({
      headerLabel: loopLabel,
      exitLabel: exitLabel,
      depth: this.currentLoopDepth + 1,
      isCountedLoop: loopInfo.isCounted,
      counterSlot: loopInfo.counterSlot,
      boundValue: loopInfo.boundValue,
      estimatedIterations: loopInfo.boundValue,
    });
  }
}
```

### Analyzing Counted Loops

```typescript
interface CountedLoopInfo {
  isCounted: boolean;
  counterSlot?: FrameSlot;
  boundValue?: number;
  boundSlot?: FrameSlot;
}

/**
 * Analyze a for loop to detect if it's a counted loop.
 * 
 * Recognized patterns:
 *   for (i = 0; i < N; i++)
 *   for (i = START; i < END; i++)
 */
protected analyzeForLoop(stmt: ForStatement): CountedLoopInfo | null {
  // Check initializer: i = constant
  if (!isVariableDecl(stmt.initializer) && !isAssignment(stmt.initializer)) {
    return null;
  }
  
  // Check condition: i < N
  if (!isBinaryExpr(stmt.condition) || 
      stmt.condition.operator !== '<' ||
      !isIdentifier(stmt.condition.left)) {
    return null;
  }
  
  // Check update: i++ or i = i + 1
  if (!isIncrementExpr(stmt.update)) {
    return null;
  }
  
  // Get counter variable
  const counterName = stmt.condition.left.name;
  const counterSlot = this.resolveVariable(counterName);
  
  // Get bound
  let boundValue: number | undefined;
  let boundSlot: FrameSlot | undefined;
  
  if (isLiteral(stmt.condition.right)) {
    boundValue = stmt.condition.right.value as number;
  } else if (isIdentifier(stmt.condition.right)) {
    boundSlot = this.resolveVariable(stmt.condition.right.name);
  }
  
  return {
    isCounted: true,
    counterSlot,
    boundValue,
    boundSlot,
  };
}
```

---

## Loop Optimizations Enabled

### 1. Loop Unrolling

For small counted loops, unroll completely:

```typescript
function shouldUnroll(loop: ILLoop): boolean {
  return loop.isCountedLoop && 
         loop.estimatedIterations !== undefined &&
         loop.estimatedIterations <= 8;
}
```

### 2. Strength Reduction

Multiply in loop → shift or add:

```js
// Before: for i = 0 to 10: arr[i*2] = i
// After:  j = 0; for i = 0 to 10: arr[j] = i; j += 2
```

### 3. Loop-Invariant Code Motion

Move constant computations outside loop:

```js
// Before:
for (i = 0; i < 10; i++) {
  let offset: byte = baseAddr + 5;  // Computed every iteration!
  poke(offset + i, i);
}

// After:
let offset: byte = baseAddr + 5;  // Hoisted!
for (i = 0; i < 10; i++) {
  poke(offset + i, i);
}
```

---

## Loop-Aware IL Generation

### Marking Hot Instructions

Instructions inside loops get marked as hot:

```typescript
protected emitInstruction(instr: ILInstruction): void {
  // Add loop depth hint
  if (this.currentLoopDepth > 0) {
    instr.hints = instr.hints || {};
    instr.hints.isHotPath = true;
  }
  
  this.builder.instructions.push(instr);
}
```

### Tracking Max Loop Depth

```typescript
protected generateFunction(func: FunctionDecl): ILFunction {
  this.currentLoopDepth = 0;
  this.maxLoopDepth = 0;
  
  // Generate body...
  
  return {
    name: func.getName(),
    frame: this.frameMap.get(func.getName()),
    instructions: this.builder.getInstructions(),
    loops: this.loops,
    maxLoopDepth: this.maxLoopDepth,
  };
}
```

---

## Summary

| Feature | Benefit |
|---------|---------|
| `ILLoop` structure | Optimizer knows loop boundaries |
| `isCountedLoop` | Can decide on unrolling |
| `boundValue` | Know iteration count |
| `depth` tracking | Prioritize inner loops |
| Hot path marking | Focus optimization effort |

---

## Related Documents

| Document | Relationship |
|----------|-------------|
| [05-optimization-hints.md](05-optimization-hints.md) | Hint system |
| [08-il-generator.md](08-il-generator.md) | Generator implementation |