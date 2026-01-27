# Loop Invariant Code Motion (LICM)

> **Phase**: 7 - Advanced Optimizations  
> **Document**: 02-licm.md  
> **Focus**: Moving loop-invariant computations outside loops  
> **Est. Lines**: ~350

---

## Overview

**Loop Invariant Code Motion (LICM)** identifies computations inside loops that produce the same value on every iteration, and moves them to a **preheader** block that executes once before the loop begins.

**Benefits**:
- Eliminates redundant computation inside loops
- Critical for tight inner loops common in C64 graphics
- Can save hundreds or thousands of cycles for nested loops

---

## 1. What is Loop Invariant Code?

An instruction is **loop invariant** if:
1. Its operands are defined **outside** the loop, OR
2. Its operands are defined by **other invariant** instructions

```js
// Example: baseAddr + 40 is loop invariant
for (let i = 0; i < 100; i++) {
    let offset = baseAddr + 40;  // ← Invariant! Same every iteration
    buffer[i] = offset + i;
}

// After LICM:
let offset = baseAddr + 40;       // ← Moved out (computed once)
for (let i = 0; i < 100; i++) {
    buffer[i] = offset + i;       // ← Uses precomputed value
}
```

**Savings**: 100 iterations × ~6 cycles = 600 cycles saved!

---

## 2. LICM Algorithm

### 2.1 Core Algorithm

```typescript
/**
 * Loop Invariant Code Motion pass.
 * Moves invariant computations to loop preheader.
 */
export class LICMPass extends OptimizationPass {
  protected readonly loopAnalysis: LoopAnalyzer;
  protected readonly useDefChains: UseDefChains;
  
  /**
   * Main entry point for LICM.
   */
  public run(func: ILFunction): boolean {
    let changed = false;
    
    // Analyze loops
    const loopResults = this.loopAnalysis.analyzeLoops(func);
    
    // Process loops from innermost to outermost
    // (inner loops first allows hoisting through multiple levels)
    for (const result of loopResults.sort((a, b) => b.loop.getDepth() - a.loop.getDepth())) {
      changed = this.processLoop(result) || changed;
    }
    
    return changed;
  }
  
  /**
   * Process a single loop for LICM.
   */
  protected processLoop(loopResult: LoopAnalysisResult): boolean {
    const loop = loopResult.loop;
    let changed = false;
    
    // Ensure preheader exists (create if needed)
    const preheader = this.getOrCreatePreheader(loop);
    
    // Find all loop-invariant instructions
    const invariants = this.findInvariants(loop);
    
    // Sort by dependency order (move dependencies first)
    const sortedInvariants = this.topologicalSort(invariants);
    
    // Move each invariant instruction
    for (const inst of sortedInvariants) {
      if (this.canHoist(inst, loop)) {
        this.hoistToPreheader(inst, preheader);
        changed = true;
      }
    }
    
    return changed;
  }
}
```

### 2.2 Finding Invariant Instructions

```typescript
/**
 * Identifies loop-invariant instructions.
 */
protected findInvariants(loop: NaturalLoop): ILInstruction[] {
  const invariants: Set<ILInstruction> = new Set();
  
  // Iterate until no more invariants found
  let changed = true;
  while (changed) {
    changed = false;
    
    for (const block of loop.body) {
      for (const inst of block.getInstructions()) {
        // Skip if already identified as invariant
        if (invariants.has(inst)) continue;
        
        // Skip instructions that can't be moved
        if (!this.canBeInvariant(inst)) continue;
        
        // Check if all operands are invariant
        if (this.allOperandsInvariant(inst, loop, invariants)) {
          invariants.add(inst);
          changed = true;
        }
      }
    }
  }
  
  return Array.from(invariants);
}

/**
 * Check if all operands of an instruction are loop-invariant.
 */
protected allOperandsInvariant(
  inst: ILInstruction,
  loop: NaturalLoop,
  knownInvariants: Set<ILInstruction>
): boolean {
  for (const operand of inst.operands) {
    // Constants are always invariant
    if (this.isConstant(operand)) continue;
    
    // Find the definition of this operand
    const def = this.useDefChains.getDefinition(operand);
    
    // Invariant if:
    // 1. Defined outside the loop
    if (!loop.contains(def.block)) continue;
    
    // 2. Defined by another invariant instruction
    if (knownInvariants.has(def.instruction)) continue;
    
    // Not invariant
    return false;
  }
  
  return true;
}

/**
 * Check if instruction type can be invariant.
 * Some instructions have side effects that prevent hoisting.
 */
protected canBeInvariant(inst: ILInstruction): boolean {
  switch (inst.opcode) {
    // Arithmetic and logic - always safe
    case ILOpcode.ADD:
    case ILOpcode.SUB:
    case ILOpcode.MUL:
    case ILOpcode.DIV:
    case ILOpcode.AND:
    case ILOpcode.OR:
    case ILOpcode.XOR:
    case ILOpcode.NOT:
    case ILOpcode.SHL:
    case ILOpcode.SHR:
    case ILOpcode.NEG:
      return true;
    
    // Loads - only if not volatile and provably no aliasing stores
    case ILOpcode.LOAD:
      return !inst.isVolatile && !this.mayBeModifiedInLoop(inst);
    
    // Stores - never invariant (side effects)
    case ILOpcode.STORE:
      return false;
    
    // Calls - depend on purity
    case ILOpcode.CALL:
      return this.isPureFunction(inst.target);
    
    // Control flow - never invariant
    case ILOpcode.BRANCH:
    case ILOpcode.COND_BRANCH:
    case ILOpcode.RET:
      return false;
    
    // PHI nodes - can't be hoisted
    case ILOpcode.PHI:
      return false;
    
    default:
      return false;
  }
}
```

---

## 3. Preheader Management

### 3.1 What is a Preheader?

A **preheader** is a dedicated block that:
1. Has the loop header as its only successor
2. Is the only predecessor to the loop header (from outside the loop)
3. Executes exactly once before loop execution begins

```
           Before LICM                    After LICM
           
        ┌─────────┐                    ┌─────────┐
        │ Entry   │                    │ Entry   │
        └────┬────┘                    └────┬────┘
             │                              │
             │                         ┌────▼────┐
             │                         │Preheader│  ← New block
             │                         │ x = a+b │  ← Hoisted code
             │                         └────┬────┘
             │                              │
        ┌────▼────┐                    ┌────▼────┐
        │ Header  │◄──┐                │ Header  │◄──┐
        │ x = a+b │   │                │         │   │
        │  ...    │   │                │  ...    │   │
        └────┬────┘   │                └────┬────┘   │
             │        │                     │        │
        ┌────▼────┐   │                ┌────▼────┐   │
        │  Latch  │───┘                │  Latch  │───┘
        └────┬────┘                    └────┬────┘
             │                              │
        ┌────▼────┐                    ┌────▼────┐
        │  Exit   │                    │  Exit   │
        └─────────┘                    └─────────┘
```

### 3.2 Creating the Preheader

```typescript
/**
 * Gets or creates a preheader block for the loop.
 */
protected getOrCreatePreheader(loop: NaturalLoop): BasicBlock {
  const header = loop.header;
  
  // Check if preheader already exists
  const outsidePreds = header.getPredecessors().filter(
    pred => !loop.contains(pred)
  );
  
  // If exactly one predecessor from outside, that's our preheader
  if (outsidePreds.length === 1) {
    const candidate = outsidePreds[0];
    // Verify it only branches to the header
    if (candidate.getSuccessors().length === 1 &&
        candidate.getSuccessors()[0] === header) {
      return candidate;
    }
  }
  
  // Need to create a preheader
  return this.createPreheader(loop);
}

/**
 * Creates a new preheader block.
 */
protected createPreheader(loop: NaturalLoop): BasicBlock {
  const header = loop.header;
  
  // Create new empty block
  const preheader = new BasicBlock(`${header.label}_preheader`);
  
  // Add unconditional branch to header
  preheader.addInstruction({
    opcode: ILOpcode.BRANCH,
    target: header.label,
  });
  
  // Redirect all non-loop predecessors to preheader
  for (const pred of header.getPredecessors()) {
    if (!loop.contains(pred)) {
      // Update pred's successor from header to preheader
      pred.redirectSuccessor(header, preheader);
    }
  }
  
  // Update predecessor lists
  preheader.addPredecessor(/* all redirected preds */);
  preheader.addSuccessor(header);
  header.removePredecessorsExcept(/* loop back edges */);
  header.addPredecessor(preheader);
  
  // Insert into function CFG
  this.function.insertBlockBefore(preheader, header);
  
  return preheader;
}
```

---

## 4. Safety Checks

### 4.1 Movement Safety

Not all invariant code can be safely hoisted:

```typescript
/**
 * Check if an instruction can be safely hoisted.
 */
protected canHoist(inst: ILInstruction, loop: NaturalLoop): boolean {
  // 1. Must dominate all uses
  if (!this.dominatesAllUses(inst, loop)) {
    return false;
  }
  
  // 2. Must dominate all loop exits
  if (!this.dominatesAllExits(inst, loop)) {
    return false;
  }
  
  // 3. Must not have side effects (already checked in canBeInvariant)
  
  // 4. For loads: no aliasing stores in loop
  if (inst.opcode === ILOpcode.LOAD) {
    if (this.hasAliasingStore(inst, loop)) {
      return false;
    }
  }
  
  // 5. Result must not be reassigned in loop
  if (this.isReassignedInLoop(inst.dest, loop)) {
    return false;
  }
  
  return true;
}

/**
 * Check if instruction dominates all its uses.
 */
protected dominatesAllUses(inst: ILInstruction, loop: NaturalLoop): boolean {
  const uses = this.useDefChains.getUses(inst.dest);
  
  for (const use of uses) {
    // Use inside loop: always dominated from preheader
    if (loop.contains(use.block)) {
      continue;
    }
    
    // Use outside loop: must be after loop exit
    if (!this.dominatesAfterLoop(inst, use, loop)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if instruction dominates all loop exits.
 * Required for correctness when value used after loop.
 */
protected dominatesAllExits(inst: ILInstruction, loop: NaturalLoop): boolean {
  // If instruction is in header, it dominates all exits
  if (inst.block === loop.header) {
    return true;
  }
  
  // Otherwise, check each exit block
  for (const exit of loop.getExitBlocks()) {
    const exitPred = this.getExitPredecessor(exit, loop);
    if (!this.dominates(inst.block, exitPred)) {
      return false;
    }
  }
  
  return true;
}
```

### 4.2 Control Flow Safety

```typescript
/**
 * Special handling for code in conditional blocks.
 * Hoisting makes code execute unconditionally.
 */
protected checkControlFlowSafety(inst: ILInstruction, loop: NaturalLoop): boolean {
  // If instruction is in a conditional block within the loop,
  // hoisting would change semantics
  
  const block = inst.block;
  
  // Check if block is conditionally executed
  if (!loop.header.dominates(block)) {
    // Block is conditionally executed
    // Can only hoist if:
    // 1. Instruction is pure (no side effects)
    // 2. Instruction doesn't trap (no division by zero, etc.)
    
    if (!this.isPure(inst)) {
      return false;
    }
    
    if (this.mayTrap(inst)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if instruction may trap/throw.
 */
protected mayTrap(inst: ILInstruction): boolean {
  switch (inst.opcode) {
    case ILOpcode.DIV:
    case ILOpcode.MOD:
      // Division may trap on divide by zero
      // Safe if divisor is constant non-zero
      return !this.isConstantNonZero(inst.operands[1]);
    
    case ILOpcode.LOAD:
      // Load may trap on null pointer (not relevant for 6502)
      return false;
    
    default:
      return false;
  }
}
```

---

## 5. Hoisting Mechanism

### 5.1 Moving Instructions

```typescript
/**
 * Hoist an instruction to the preheader.
 */
protected hoistToPreheader(inst: ILInstruction, preheader: BasicBlock): void {
  // Remove from original block
  const originalBlock = inst.block;
  originalBlock.removeInstruction(inst);
  
  // Insert before the branch in preheader
  // (Preheader ends with unconditional branch to header)
  const branchInst = preheader.getLastInstruction();
  preheader.insertBefore(inst, branchInst);
  
  // Update instruction's block reference
  inst.block = preheader;
  
  // Update use-def chains
  this.useDefChains.updateDefinition(inst.dest, preheader);
  
  // Log the transformation
  this.log(`LICM: Hoisted ${inst.opcode} ${inst.dest} from ${originalBlock.label} to preheader`);
}

/**
 * Sort invariant instructions by dependency order.
 * Instructions that define values used by other invariants must come first.
 */
protected topologicalSort(invariants: ILInstruction[]): ILInstruction[] {
  const result: ILInstruction[] = [];
  const visited = new Set<ILInstruction>();
  const visiting = new Set<ILInstruction>();
  
  const visit = (inst: ILInstruction): void => {
    if (visited.has(inst)) return;
    if (visiting.has(inst)) {
      throw new Error('Cycle in invariant dependencies');
    }
    
    visiting.add(inst);
    
    // Visit dependencies first
    for (const operand of inst.operands) {
      const def = this.useDefChains.getDefinition(operand);
      if (def && invariants.includes(def.instruction)) {
        visit(def.instruction);
      }
    }
    
    visiting.delete(inst);
    visited.add(inst);
    result.push(inst);
  };
  
  for (const inst of invariants) {
    visit(inst);
  }
  
  return result;
}
```

---

## 6. 6502-Specific LICM Patterns

### 6.1 Address Calculation Hoisting

Common C64 pattern - screen address calculation:

```js
// Before LICM
for (let y = 0; y < 25; y++) {
    let screenRow = 1024 + y * 40;  // ← Invariant part: 1024
    for (let x = 0; x < 40; x++) {
        screen[screenRow + x] = color;
    }
}

// After LICM (inner loop)
for (let y = 0; y < 25; y++) {
    let screenRow = 1024 + y * 40;
    let baseScreen = screenRow;  // ← Hoisted to outer loop body
    for (let x = 0; x < 40; x++) {
        screen[baseScreen + x] = color;
    }
}
```

### 6.2 Hardware Address Hoisting

```js
// Before - loading hardware register base each iteration
for (let i = 0; i < 8; i++) {
    let vicBase = $D000;           // ← Invariant constant
    sprites[vicBase + i] = data;
}

// After LICM - becomes constant folding opportunity
let vicBase = $D000;                // ← Hoisted
for (let i = 0; i < 8; i++) {
    sprites[vicBase + i] = data;
}
```

### 6.3 Assembly-Level Impact

```asm
; Before LICM (inner loop)
loop:
    LDA #$00                ; Screen bank - hoistable!
    STA $D018
    LDA color
    LDY #39
inner:
    STA (ptr),Y
    DEY
    BPL inner
    ; ... loop continuation

; After LICM
    LDA #$00                ; ← Hoisted to preheader
    STA $D018               ; ← Hoisted
loop:
    LDA color
    LDY #39
inner:
    STA (ptr),Y
    DEY
    BPL inner
    ; ... loop continuation
```

---

## 7. Complex Examples

### 7.1 Nested Loop LICM

```js
// Source code with nested invariants
for (let y = 0; y < 200; y++) {
    let rowBase = $0400 + y * 40;  // Invariant in inner loop
    let color = $01;                // Invariant in both loops
    
    for (let x = 0; x < 40; x++) {
        screen[rowBase + x] = color;
    }
}

// After LICM (processing innermost first)
let color = $01;                    // Hoisted from inner to outer
for (let y = 0; y < 200; y++) {
    let rowBase = $0400 + y * 40;  // Hoisted from inner preheader
    for (let x = 0; x < 40; x++) {
        screen[rowBase + x] = color;
    }
}

// After second LICM pass (outer loop)
let color = $01;                    // Hoisted to function entry
for (let y = 0; y < 200; y++) {
    let rowBase = $0400 + y * 40;  // Can't hoist - depends on y
    for (let x = 0; x < 40; x++) {
        screen[rowBase + x] = color;
    }
}
```

### 7.2 Chained Invariants

```js
// Multiple dependent invariants
for (let i = 0; i < 100; i++) {
    let a = baseX + 10;      // Invariant
    let b = a * 2;           // Invariant (depends on a)
    let c = b + offset;      // Invariant (depends on b)
    process(c + i);
}

// After LICM (dependency order preserved)
let a = baseX + 10;          // Hoisted first
let b = a * 2;               // Hoisted second
let c = b + offset;          // Hoisted third
for (let i = 0; i < 100; i++) {
    process(c + i);
}
```

---

## 8. LICM Statistics and Debugging

```typescript
/**
 * Statistics collected during LICM.
 */
export interface LICMStats {
  /** Total loops analyzed */
  loopsAnalyzed: number;
  
  /** Instructions hoisted */
  instructionsHoisted: number;
  
  /** Instructions not hoisted (safety) */
  instructionsNotHoistable: number;
  
  /** Preheaders created */
  preheadersCreated: number;
  
  /** Estimated cycles saved */
  estimatedCyclesSaved: number;
}

/**
 * Debug output for LICM decisions.
 */
protected debugInvariant(inst: ILInstruction, reason: string): void {
  if (this.debugEnabled) {
    console.log(`LICM: ${inst.opcode} ${inst.dest} - ${reason}`);
  }
}

// Example debug output:
// LICM: ADD t5 - HOISTED (all operands invariant)
// LICM: LOAD t6 - NOT HOISTED (potential aliasing store in loop)
// LICM: MUL t7 - NOT HOISTED (does not dominate all exits)
```

---

## 9. Integration with Other Passes

### 9.1 Pass Ordering

LICM interacts with other optimizations:

```
1. Loop Analysis      → Identifies loops
2. Use-Def Chains     → LICM dependency
3. Alias Analysis     → LICM safety (for loads)
4. LICM              → Hoist invariants
5. Constant Folding   → Fold hoisted constants
6. DCE               → Clean up dead code
7. Loop Unrolling     → Unroll after LICM (smaller body)
```

### 9.2 Iterative Application

```typescript
/**
 * Run LICM until no more changes.
 * Multiple passes may find new opportunities.
 */
public runToFixpoint(func: ILFunction): void {
  let changed = true;
  let iteration = 0;
  const MAX_ITERATIONS = 10;
  
  while (changed && iteration < MAX_ITERATIONS) {
    changed = this.run(func);
    iteration++;
  }
  
  if (iteration === MAX_ITERATIONS) {
    console.warn('LICM: Hit iteration limit');
  }
}
```

---

## Success Criteria

- [ ] Correctly identifies all loop-invariant instructions
- [ ] Creates preheader blocks when needed
- [ ] Safely hoists pure computations
- [ ] Preserves program semantics
- [ ] Handles nested loops (innermost first)
- [ ] Handles chained invariants (dependency order)
- [ ] Integrates with loop analysis from 01-loop-analysis.md
- [ ] ~35 tests passing for LICM

---

**Previous Document**: [01-loop-analysis.md](01-loop-analysis.md)  
**Next Document**: [03-loop-unroll.md](03-loop-unroll.md)  
**Parent**: [00-phase-index.md](00-phase-index.md)