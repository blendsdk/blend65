# Register Allocation Improvements

> **Phase**: 7 - Advanced Optimizations  
> **Document**: 04-register-alloc.md  
> **Focus**: Improved A/X/Y allocation, spill minimization  
> **Est. Lines**: ~400

---

## Overview

The 6502 has extremely limited registers: **A** (accumulator), **X**, and **Y** (index registers). Efficient register allocation is critical for performance since every spill to memory costs 6-8 cycles.

**Goals**:
- Minimize spills to zero-page temporaries
- Keep hot values in registers across operations
- Smart X/Y allocation for indexed addressing
- Exploit accumulator for computation chains

---

## 1. 6502 Register Characteristics

### 1.1 Register Capabilities

| Register | Size | Arithmetic | Index | Stack | Transfer To |
|----------|------|------------|-------|-------|-------------|
| **A** | 8-bit | ✅ All ops | ❌ | PHA/PLA | TAX, TAY |
| **X** | 8-bit | INX/DEX | ✅ ,X modes | TXS | TXA, TXS |
| **Y** | 8-bit | INY/DEY | ✅ ,Y modes | ❌ | TYA |

### 1.2 Addressing Mode Constraints

```asm
; X register required for:
LDA addr,X          ; Absolute indexed
LDA zp,X            ; Zero-page indexed  
LDA (zp,X)          ; Indexed indirect

; Y register required for:
LDA addr,Y          ; Absolute indexed
LDA (zp),Y          ; Indirect indexed (most flexible)
LDX zp,Y            ; Zero-page indexed X

; A register required for:
ADC, SBC            ; Arithmetic
AND, ORA, EOR       ; Logic
ASL, LSR, ROL, ROR  ; Shifts on accumulator
CMP                 ; Compare
```

---

## 2. Register Allocation Strategy

### 2.1 Allocation Priorities

```typescript
/**
 * Register allocation priorities for 6502.
 */
export enum RegisterPriority {
  /** Must be in A for arithmetic operations */
  ACCUMULATOR_REQUIRED = 100,
  
  /** Should be in A for chain of operations */
  ACCUMULATOR_PREFERRED = 80,
  
  /** Must be in X for indexed addressing mode */
  INDEX_X_REQUIRED = 90,
  
  /** Must be in Y for indirect indexed mode */
  INDEX_Y_REQUIRED = 90,
  
  /** Hot loop counter - prefer index register */
  LOOP_COUNTER = 70,
  
  /** Frequently accessed value */
  HOT_VALUE = 50,
  
  /** Default - can be spilled */
  NORMAL = 10,
}

/**
 * Allocation constraints for a value.
 */
export interface AllocationConstraint {
  /** Required register (if any) */
  requiredRegister?: 'A' | 'X' | 'Y';
  
  /** Preferred register (if any) */
  preferredRegister?: 'A' | 'X' | 'Y';
  
  /** Priority for allocation */
  priority: RegisterPriority;
  
  /** Live range (instruction indices) */
  liveRange: [number, number];
  
  /** Number of uses */
  useCount: number;
}
```

### 2.2 Allocation Algorithm

```typescript
/**
 * Register allocator for 6502.
 */
export class M6502RegisterAllocator {
  protected readonly liveness: LivenessAnalysis;
  protected readonly useDefChains: UseDefChains;
  
  /**
   * Main allocation entry point.
   */
  public allocate(func: ILFunction): AllocationResult {
    // 1. Collect all virtual registers
    const virtRegs = this.collectVirtualRegisters(func);
    
    // 2. Compute constraints for each
    const constraints = this.computeConstraints(virtRegs, func);
    
    // 3. Build interference graph
    const interference = this.buildInterferenceGraph(virtRegs, func);
    
    // 4. Color the graph with 3 colors (A, X, Y)
    const coloring = this.colorGraph(virtRegs, constraints, interference);
    
    // 5. Handle spills for uncolorable nodes
    const spills = this.handleSpills(coloring, constraints);
    
    return { coloring, spills };
  }
  
  /**
   * Build interference graph.
   * Two values interfere if their live ranges overlap.
   */
  protected buildInterferenceGraph(
    virtRegs: VirtualRegister[],
    func: ILFunction
  ): InterferenceGraph {
    const graph = new InterferenceGraph();
    
    for (const reg of virtRegs) {
      graph.addNode(reg);
    }
    
    // Two registers interfere if live at same point
    for (let i = 0; i < virtRegs.length; i++) {
      for (let j = i + 1; j < virtRegs.length; j++) {
        if (this.rangesOverlap(virtRegs[i].liveRange, virtRegs[j].liveRange)) {
          graph.addEdge(virtRegs[i], virtRegs[j]);
        }
      }
    }
    
    return graph;
  }
}
```

---

## 3. Graph Coloring with Constraints

### 3.1 Constrained Coloring

```typescript
/**
 * Graph coloring with register constraints.
 */
protected colorGraph(
  virtRegs: VirtualRegister[],
  constraints: Map<VirtualRegister, AllocationConstraint>,
  graph: InterferenceGraph
): Map<VirtualRegister, Register | 'spill'> {
  const coloring = new Map<VirtualRegister, Register | 'spill'>();
  
  // Sort by priority (high priority first)
  const sorted = [...virtRegs].sort((a, b) => {
    const pa = constraints.get(a)?.priority ?? 0;
    const pb = constraints.get(b)?.priority ?? 0;
    return pb - pa;
  });
  
  // Pre-color required registers
  for (const reg of sorted) {
    const constraint = constraints.get(reg);
    if (constraint?.requiredRegister) {
      coloring.set(reg, constraint.requiredRegister);
    }
  }
  
  // Color remaining registers
  for (const reg of sorted) {
    if (coloring.has(reg)) continue;
    
    // Find available colors
    const neighbors = graph.getNeighbors(reg);
    const usedColors = new Set<Register>();
    
    for (const neighbor of neighbors) {
      const color = coloring.get(neighbor);
      if (color && color !== 'spill') {
        usedColors.add(color);
      }
    }
    
    // Try to allocate preferred register
    const constraint = constraints.get(reg);
    if (constraint?.preferredRegister && !usedColors.has(constraint.preferredRegister)) {
      coloring.set(reg, constraint.preferredRegister);
      continue;
    }
    
    // Allocate any available register
    for (const color of ['A', 'X', 'Y'] as Register[]) {
      if (!usedColors.has(color)) {
        coloring.set(reg, color);
        break;
      }
    }
    
    // If no color available, mark for spilling
    if (!coloring.has(reg)) {
      coloring.set(reg, 'spill');
    }
  }
  
  return coloring;
}
```

### 3.2 Spill Handling

```typescript
/**
 * Handle spilled registers.
 */
protected handleSpills(
  coloring: Map<VirtualRegister, Register | 'spill'>,
  constraints: Map<VirtualRegister, AllocationConstraint>
): SpillInfo[] {
  const spills: SpillInfo[] = [];
  
  // Allocate zero-page slots for spilled values
  let zpSlot = this.firstAvailableZP;
  
  for (const [reg, color] of coloring) {
    if (color === 'spill') {
      const slot = zpSlot++;
      
      spills.push({
        virtualReg: reg,
        zpSlot: slot,
        loadPoints: this.findLoadPoints(reg),
        storePoints: this.findStorePoints(reg),
      });
      
      // Don't exceed safe ZP range
      if (zpSlot > 0x8F) {
        throw new Error('Ran out of zero-page slots for spills');
      }
    }
  }
  
  return spills;
}

/**
 * Generate spill code.
 */
protected generateSpillCode(spill: SpillInfo): void {
  // At each definition: store to ZP
  for (const storePt of spill.storePoints) {
    this.insertAfter(storePt, `STA ${spill.zpSlot}`);
  }
  
  // At each use: load from ZP
  for (const loadPt of spill.loadPoints) {
    this.insertBefore(loadPt, `LDA ${spill.zpSlot}`);
  }
}
```

---

## 4. Live Range Analysis

### 4.1 Computing Live Ranges

```typescript
/**
 * Compute live range for a virtual register.
 */
protected computeLiveRange(
  reg: VirtualRegister,
  func: ILFunction
): LiveRange {
  const defPoints: number[] = [];
  const usePoints: number[] = [];
  
  let instrIndex = 0;
  for (const block of func.blocks) {
    for (const inst of block.instructions) {
      // Check if this instruction defines the register
      if (inst.dest === reg.name) {
        defPoints.push(instrIndex);
      }
      
      // Check if this instruction uses the register
      if (inst.operands?.includes(reg.name)) {
        usePoints.push(instrIndex);
      }
      
      instrIndex++;
    }
  }
  
  // Live range is from first def to last use
  const start = Math.min(...defPoints);
  const end = Math.max(...usePoints);
  
  return { start, end, defPoints, usePoints };
}

/**
 * Check if two live ranges overlap.
 */
protected rangesOverlap(a: LiveRange, b: LiveRange): boolean {
  return !(a.end < b.start || b.end < a.start);
}
```

### 4.2 Live Range Splitting

```typescript
/**
 * Split long live ranges to reduce interference.
 */
protected splitLiveRange(reg: VirtualRegister, splitPoint: number): void {
  // Create new virtual register for second half
  const newReg = this.createVirtualReg(`${reg.name}_split`);
  
  // Insert copy at split point
  this.insertAt(splitPoint, `MOV ${newReg.name}, ${reg.name}`);
  
  // Update uses after split point
  this.rewriteUses(reg, newReg, splitPoint);
}
```

---

## 5. Instruction Reordering

### 5.1 Reorder for Better Allocation

```typescript
/**
 * Reorder instructions to improve register allocation.
 */
export class InstructionReorderPass extends OptimizationPass {
  /**
   * Reorder to minimize live range overlaps.
   */
  public run(func: ILFunction): boolean {
    let changed = false;
    
    for (const block of func.blocks) {
      changed = this.reorderBlock(block) || changed;
    }
    
    return changed;
  }
  
  /**
   * Reorder instructions in a basic block.
   */
  protected reorderBlock(block: BasicBlock): boolean {
    const instructions = block.instructions;
    let changed = false;
    
    for (let i = 0; i < instructions.length - 1; i++) {
      for (let j = i + 1; j < instructions.length; j++) {
        // Check if swapping reduces register pressure
        if (this.shouldSwap(instructions, i, j)) {
          // Verify swap is legal (no dependency violation)
          if (this.canSwap(instructions, i, j)) {
            this.swap(instructions, i, j);
            changed = true;
          }
        }
      }
    }
    
    return changed;
  }
  
  /**
   * Check if swapping reduces register pressure.
   */
  protected shouldSwap(insts: ILInstruction[], i: number, j: number): boolean {
    // Move definitions closer to their uses
    const instI = insts[i];
    const instJ = insts[j];
    
    // If I defines something used by J, don't swap
    if (this.uses(instJ, instI.dest)) {
      return false;
    }
    
    // If moving J earlier brings its use closer to definition
    const jUseDistance = this.distanceToFirstUse(insts, j);
    const jNewDistance = this.distanceToFirstUse(insts, i);
    
    return jNewDistance < jUseDistance;
  }
}
```

### 5.2 Example: Reordering Benefit

```asm
; Before reordering (poor allocation)
    LDA value1        ; Live: A=value1
    STA temp          ; Spill needed - X,Y occupied
    LDA value2        ; Live: temp=value1
    LDX count         ; Live: A=value2, temp=value1
    ...use X...
    LDA temp          ; Reload value1
    CLC
    ADC value2        ; Finally use value1

; After reordering (no spill needed)
    LDX count         ; Load X first
    ...use X...       ; X no longer live
    LDA value1        ; Now A free for both values
    CLC
    LDA value2        ; 
    ADC value1        ; No spill needed!
```

---

## 6. Accumulator Chain Optimization

### 6.1 Keep Results in A

```typescript
/**
 * Optimize accumulator usage across operations.
 */
export class AccumulatorChainOpt extends OptimizationPass {
  /**
   * Find chains of operations that can stay in A.
   */
  protected findAccumulatorChains(block: BasicBlock): Chain[] {
    const chains: Chain[] = [];
    let currentChain: ILInstruction[] = [];
    
    for (const inst of block.instructions) {
      if (this.usesAccumulator(inst)) {
        if (this.resultInAccumulator(inst)) {
          // Chain continues
          currentChain.push(inst);
        } else {
          // Chain breaks
          if (currentChain.length > 1) {
            chains.push(currentChain);
          }
          currentChain = [];
        }
      }
    }
    
    return chains;
  }
  
  /**
   * Optimize a chain to minimize A stores/loads.
   */
  protected optimizeChain(chain: ILInstruction[]): void {
    // Remove intermediate stores to temps
    // Result stays in A through the chain
    
    for (let i = 0; i < chain.length - 1; i++) {
      const inst = chain[i];
      const nextInst = chain[i + 1];
      
      // If next instruction uses this result, no store needed
      if (this.nextUsesResult(inst, nextInst)) {
        this.removeStore(inst);
      }
    }
  }
}
```

### 6.2 Example: Chain Optimization

```asm
; Before (unnecessary stores)
    LDA value1
    CLC
    ADC value2
    STA temp1         ; Unnecessary!
    LDA temp1         ; Unnecessary!
    CLC
    ADC value3
    STA result

; After (chain optimization)
    LDA value1
    CLC
    ADC value2        ; Result stays in A
    CLC
    ADC value3        ; Still in A
    STA result        ; Only final store needed
```

---

## 7. Index Register Optimization

### 7.1 X/Y Assignment Strategy

```typescript
/**
 * Optimize X and Y register assignments.
 */
export class IndexRegisterOpt {
  /**
   * Assign X or Y based on addressing mode requirements.
   */
  protected assignIndexRegister(
    variable: VirtualRegister,
    uses: AddressingModeUse[]
  ): 'X' | 'Y' {
    let xScore = 0;
    let yScore = 0;
    
    for (const use of uses) {
      switch (use.mode) {
        case AddressingMode.INDEXED_INDIRECT:
          // (zp,X) - requires X
          xScore += 100;
          break;
          
        case AddressingMode.INDIRECT_INDEXED:
          // (zp),Y - requires Y
          yScore += 100;
          break;
          
        case AddressingMode.ABSOLUTE_X:
        case AddressingMode.ZEROPAGE_X:
          // Can use either, slight X preference
          xScore += 10;
          break;
          
        case AddressingMode.ABSOLUTE_Y:
        case AddressingMode.ZEROPAGE_Y:
          // Can use either, slight Y preference
          yScore += 10;
          break;
      }
    }
    
    return yScore > xScore ? 'Y' : 'X';
  }
}
```

### 7.2 Loop Counter Allocation

```typescript
/**
 * Allocate loop counters to X or Y.
 */
protected allocateLoopCounters(loops: NaturalLoop[]): void {
  for (const loop of loops) {
    const iv = loop.getInductionVariable();
    if (!iv) continue;
    
    // Determine best register for this loop
    const uses = this.analyzeLoopIndexUses(loop);
    const reg = this.assignIndexRegister(iv, uses);
    
    // Force allocation to chosen register
    this.setConstraint(iv, {
      requiredRegister: reg,
      priority: RegisterPriority.LOOP_COUNTER,
    });
  }
}
```

---

## 8. Transfer Instruction Optimization

### 8.1 Minimize Transfers

```typescript
/**
 * Minimize TAX, TAY, TXA, TYA instructions.
 */
export class TransferOptimization {
  /**
   * Remove unnecessary transfers.
   */
  public optimize(func: ILFunction): boolean {
    let changed = false;
    
    for (const block of func.blocks) {
      changed = this.optimizeTransfers(block) || changed;
    }
    
    return changed;
  }
  
  /**
   * Track register contents to remove redundant transfers.
   */
  protected optimizeTransfers(block: BasicBlock): boolean {
    const state = new RegisterState();
    let changed = false;
    
    for (const inst of block.instructions) {
      // Check if this transfer is redundant
      if (this.isTransfer(inst)) {
        if (this.isRedundantTransfer(inst, state)) {
          this.removeInstruction(inst);
          changed = true;
          continue;
        }
      }
      
      // Update state based on instruction
      this.updateState(state, inst);
    }
    
    return changed;
  }
  
  /**
   * Check if transfer is redundant (registers already equal).
   */
  protected isRedundantTransfer(inst: AsmInstruction, state: RegisterState): boolean {
    switch (inst.opcode) {
      case 'TAX':
        return state.A === state.X;
      case 'TAY':
        return state.A === state.Y;
      case 'TXA':
        return state.X === state.A;
      case 'TYA':
        return state.Y === state.A;
      default:
        return false;
    }
  }
}
```

### 8.2 Transfer Coalescing

```asm
; Before (multiple transfers)
    LDA value
    TAX               ; A → X
    ...
    TXA               ; X → A (redundant if A unchanged)
    TAY               ; A → Y

; After (coalesced)
    LDA value
    TAX               ; A → X
    TAY               ; A → Y directly (skip TXA)
```

---

## 9. Spill Cost Model

### 9.1 Spill Cost Calculation

```typescript
/**
 * Calculate cost of spilling a value.
 */
protected calculateSpillCost(reg: VirtualRegister): number {
  const liveRange = this.computeLiveRange(reg);
  const useCount = liveRange.usePoints.length;
  const defCount = liveRange.defPoints.length;
  
  // Cost = stores (at defs) + loads (at uses)
  const storeCycles = defCount * 3;  // STA zp = 3 cycles
  const loadCycles = useCount * 3;   // LDA zp = 3 cycles
  
  // Multiply by loop depth
  const loopDepth = this.getLoopDepth(reg);
  const loopMultiplier = Math.pow(10, loopDepth);
  
  return (storeCycles + loadCycles) * loopMultiplier;
}

/**
 * Choose which register to spill (lowest cost).
 */
protected chooseSpillCandidate(
  candidates: VirtualRegister[]
): VirtualRegister {
  let bestCandidate = candidates[0];
  let bestCost = Infinity;
  
  for (const candidate of candidates) {
    const cost = this.calculateSpillCost(candidate);
    if (cost < bestCost) {
      bestCost = cost;
      bestCandidate = candidate;
    }
  }
  
  return bestCandidate;
}
```

---

## 10. Integration with Code Generation

```typescript
/**
 * Apply register allocation to code generation.
 */
export class RegisterAllocatedCodeGen {
  protected readonly allocator: M6502RegisterAllocator;
  
  /**
   * Generate code with register allocation applied.
   */
  public generate(ilFunc: ILFunction): AsmFunction {
    // Run allocation
    const allocation = this.allocator.allocate(ilFunc);
    
    // Generate code using allocation
    const asmFunc = new AsmFunction(ilFunc.name);
    
    for (const block of ilFunc.blocks) {
      for (const inst of block.instructions) {
        // Map virtual registers to physical registers
        const physInst = this.mapToPhysical(inst, allocation);
        asmFunc.addInstruction(physInst);
      }
    }
    
    // Insert spill code
    for (const spill of allocation.spills) {
      this.insertSpillCode(asmFunc, spill);
    }
    
    return asmFunc;
  }
}
```

---

## Success Criteria

- [ ] Graph coloring with A/X/Y constraints
- [ ] Live range analysis for virtual registers
- [ ] Spill to zero-page when necessary
- [ ] Accumulator chain optimization
- [ ] Index register assignment based on addressing modes
- [ ] Transfer instruction minimization
- [ ] Loop counter allocation to index registers
- [ ] Spill cost model respects loop depth
- [ ] ~40 tests passing for register allocation

---

**Previous Document**: [03-loop-unroll.md](03-loop-unroll.md)  
**Next Document**: [05-size-opt.md](05-size-opt.md)  
**Parent**: [00-phase-index.md](00-phase-index.md)