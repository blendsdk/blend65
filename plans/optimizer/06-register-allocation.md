# Phase 6: Register Allocation

> **Phase**: 6 of 11  
> **Est. Time**: ~20 hours  
> **Tasks**: 8  
> **Tests**: ~350  
> **Prerequisites**: Phase 5 (Loop Optimizations)

---

## Overview

Register allocation is the process of mapping virtual registers (SSA values) to physical machine registers. For the 6502, this is uniquely challenging due to having only **3 general-purpose registers** (A, X, Y), each with different capabilities.

---

## 6502 Register Constraints

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    6502 REGISTER CHARACTERISTICS                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Register │ Width │ Primary Use          │ Addressing Modes              │
├──────────┼───────┼──────────────────────┼───────────────────────────────┤
│ A        │ 8-bit │ Accumulator          │ Immediate, ZP, Abs, Indirect  │
│          │       │ All arithmetic ops   │ All memory operations         │
├──────────┼───────┼──────────────────────┼───────────────────────────────┤
│ X        │ 8-bit │ Index register       │ ZP,X  Abs,X  (Ind,X)          │
│          │       │ Loop counter         │ INX, DEX, CPX, LDX, STX, TAX  │
├──────────┼───────┼──────────────────────┼───────────────────────────────┤
│ Y        │ 8-bit │ Index register       │ ZP,Y  Abs,Y  (Ind),Y          │
│          │       │ Secondary counter    │ INY, DEY, CPY, LDY, STY, TAY  │
└─────────────────────────────────────────────────────────────────────────┘

Special Constraints:
• Arithmetic (ADC, SBC, AND, ORA, EOR) ONLY works with A
• Memory indexing requires X or Y (not A)
• Only A can do shifts (ASL A, LSR A, ROL A, ROR A)
• Stack pointer manipulation limited (TSX, TXS)
• Zero-page is effectively 256 bytes of fast "registers"
```

---

## Directory Structure Created

```
packages/compiler/src/optimizer/register/
├── index.ts                    # Register allocation exports
├── live-range.ts               # Live range computation
├── interference.ts             # Interference graph construction
├── graph-color.ts              # Graph coloring allocator
├── constraints.ts              # 6502 register constraints
├── spill.ts                    # Spill code generation
├── coalesce.ts                 # Register coalescing
├── rematerialize.ts            # Rematerialization
└── split.ts                    # Live range splitting
```

---

## Task 6.1: Live Range Computation

**Time**: 2.5 hours  
**Tests**: 45 tests

**Key Concepts**:
- Compute where each virtual register is "live"
- Live = defined and will be used later
- Essential input for interference graph

**File**: `packages/compiler/src/optimizer/register/live-range.ts`

```typescript
/**
 * Live Range Computation
 * 
 * Computes the live range for each virtual register (SSA value).
 * A value is live from its definition to its last use.
 */
export class LiveRangeAnalysis extends AnalysisPass<LiveRanges> {
  readonly name = 'live-ranges';
  readonly requires = ['liveness'];
  
  analyze(func: ILFunction): LiveRanges {
    const liveness = this.getAnalysis<LivenessInfo>('liveness', func);
    const ranges = new LiveRanges();
    
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        if (inst.hasResult()) {
          const range = this.computeRange(inst, liveness, func);
          ranges.addRange(inst.getResult(), range);
        }
      }
    }
    
    return ranges;
  }
  
  protected computeRange(inst: ILInstruction, liveness: LivenessInfo, func: ILFunction): LiveRange {
    const def = this.getInstructionIndex(inst);
    let lastUse = def;
    
    // Find all uses of this value
    for (const use of inst.getResult().getUses()) {
      const useIndex = this.getInstructionIndex(use);
      lastUse = Math.max(lastUse, useIndex);
    }
    
    return new LiveRange(inst.getResult(), def, lastUse);
  }
}

/**
 * Represents the live range of a value.
 */
export class LiveRange {
  constructor(
    public readonly value: Value,
    public readonly start: number,
    public readonly end: number
  ) {}
  
  /** Check if this range overlaps with another */
  overlaps(other: LiveRange): boolean {
    return this.start <= other.end && other.start <= this.end;
  }
  
  /** Get the length of this live range */
  getLength(): number {
    return this.end - this.start;
  }
}
```

**Tests**:
- Single instruction live range
- Multi-block live range
- Phi node live ranges
- Loop-carried live ranges
- Dead value (no uses)

---

## Task 6.2: Interference Graph Construction

**Time**: 2.5 hours  
**Tests**: 45 tests

**Key Concepts**:
- Two values interfere if their live ranges overlap
- Graph where nodes = values, edges = interference
- Foundation for graph coloring

**File**: `packages/compiler/src/optimizer/register/interference.ts`

```typescript
/**
 * Interference Graph
 * 
 * Builds a graph where nodes are virtual registers and
 * edges connect registers that cannot share the same
 * physical register (their live ranges overlap).
 */
export class InterferenceGraph {
  protected nodes = new Map<Value, InterferenceNode>();
  protected edges = new Set<string>();
  
  constructor(ranges: LiveRanges) {
    // Create nodes for all values
    for (const range of ranges.getAllRanges()) {
      this.nodes.set(range.value, new InterferenceNode(range.value));
    }
    
    // Add interference edges
    const allRanges = ranges.getAllRanges();
    for (let i = 0; i < allRanges.length; i++) {
      for (let j = i + 1; j < allRanges.length; j++) {
        if (allRanges[i].overlaps(allRanges[j])) {
          this.addEdge(allRanges[i].value, allRanges[j].value);
        }
      }
    }
  }
  
  /** Add interference edge between two values */
  addEdge(a: Value, b: Value): void {
    const key = this.edgeKey(a, b);
    if (!this.edges.has(key)) {
      this.edges.add(key);
      this.nodes.get(a)!.addNeighbor(b);
      this.nodes.get(b)!.addNeighbor(a);
    }
  }
  
  /** Get the degree (number of neighbors) of a node */
  getDegree(value: Value): number {
    return this.nodes.get(value)?.getNeighbors().length ?? 0;
  }
  
  /** Check if two values interfere */
  interferes(a: Value, b: Value): boolean {
    return this.edges.has(this.edgeKey(a, b));
  }
}
```

**Tests**:
- No interference (disjoint ranges)
- Two values interfere
- Multiple interfering values
- Phi node interference
- Loop-back interference

---

## Task 6.3: Graph Coloring Allocator

**Time**: 3 hours  
**Tests**: 50 tests

**Key Concepts**:
- Assign colors (registers) to graph nodes
- Adjacent nodes cannot have same color
- 6502: Only 3 colors available (A, X, Y)!

**File**: `packages/compiler/src/optimizer/register/graph-color.ts`

```typescript
/**
 * Graph Coloring Register Allocator
 * 
 * Allocates physical registers using graph coloring.
 * For 6502: only 3 colors (A, X, Y) with constraints.
 */
export class GraphColoringAllocator {
  protected readonly numColors = 3; // A, X, Y
  protected readonly colors = [Reg6502.A, Reg6502.X, Reg6502.Y];
  
  allocate(graph: InterferenceGraph, constraints: RegisterConstraints): AllocationResult {
    const stack: Value[] = [];
    const spilled = new Set<Value>();
    
    // 1. Simplify: push low-degree nodes onto stack
    while (graph.hasNodes()) {
      const node = this.findSimplifiable(graph);
      
      if (node) {
        // Node with degree < numColors can be colored
        stack.push(node);
        graph.removeNode(node);
      } else {
        // Must spill: choose node to spill
        const spillNode = this.chooseSpill(graph, constraints);
        spilled.add(spillNode);
        graph.removeNode(spillNode);
      }
    }
    
    // 2. Select: pop and assign colors
    const allocation = new Map<Value, Reg6502>();
    
    while (stack.length > 0) {
      const node = stack.pop()!;
      const availableColors = this.getAvailableColors(node, allocation, graph, constraints);
      
      if (availableColors.length > 0) {
        allocation.set(node, availableColors[0]);
      } else {
        // Shouldn't happen if simplify was correct
        spilled.add(node);
      }
    }
    
    return new AllocationResult(allocation, spilled);
  }
  
  protected findSimplifiable(graph: InterferenceGraph): Value | null {
    // Find node with degree < numColors
    for (const node of graph.getNodes()) {
      if (graph.getDegree(node) < this.numColors) {
        return node;
      }
    }
    return null;
  }
  
  protected chooseSpill(graph: InterferenceGraph, constraints: RegisterConstraints): Value {
    // Spill heuristic: choose node with highest degree / lowest cost
    let best: Value | null = null;
    let bestScore = -Infinity;
    
    for (const node of graph.getNodes()) {
      const degree = graph.getDegree(node);
      const cost = this.getSpillCost(node);
      const score = degree / cost;
      
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    }
    
    return best!;
  }
}
```

**Tests**:
- Color 2 non-interfering values
- Color 3 non-interfering values
- Force spill when > 3 interfering
- Respect register constraints
- Optimal coloring for simple cases

---

## Task 6.4: 6502 Register Constraints

**Time**: 2 hours  
**Tests**: 40 tests

**Key Concepts**:
- A is required for arithmetic
- X/Y required for indexing
- Some operations are register-specific

**File**: `packages/compiler/src/optimizer/register/constraints.ts`

```typescript
/**
 * 6502 Register Constraints
 * 
 * Defines which registers can be used for which operations.
 */
export class RegisterConstraints {
  /** Get allowed registers for an instruction's result */
  getAllowedRegisters(inst: ILInstruction): Set<Reg6502> {
    switch (inst.getOpcode()) {
      // Arithmetic must use A
      case ILOpcode.ADD:
      case ILOpcode.SUB:
      case ILOpcode.AND:
      case ILOpcode.OR:
      case ILOpcode.XOR:
      case ILOpcode.SHL:
      case ILOpcode.SHR:
        return new Set([Reg6502.A]);
      
      // Index operations need X or Y
      case ILOpcode.INDEX:
        return new Set([Reg6502.X, Reg6502.Y]);
      
      // Most operations can use any register
      default:
        return new Set([Reg6502.A, Reg6502.X, Reg6502.Y]);
    }
  }
  
  /** Check if a value MUST be in a specific register */
  getRequiredRegister(inst: ILInstruction): Reg6502 | null {
    // Function return values must be in A
    if (inst.isReturn() && inst.hasValue()) {
      return Reg6502.A;
    }
    
    // Call results are in A
    if (inst.isCall()) {
      return Reg6502.A;
    }
    
    return null;
  }
  
  /** Get preference order for register assignment */
  getPreferenceOrder(inst: ILInstruction): Reg6502[] {
    // Prefer A for values used in arithmetic
    // Prefer X/Y for loop indices
    if (this.isUsedInArithmetic(inst)) {
      return [Reg6502.A, Reg6502.X, Reg6502.Y];
    }
    
    if (this.isLoopIndex(inst)) {
      return [Reg6502.X, Reg6502.Y, Reg6502.A];
    }
    
    return [Reg6502.A, Reg6502.X, Reg6502.Y];
  }
}
```

**Tests**:
- ADC requires A register
- LDX,X requires X register
- Loop index prefers X/Y
- Return value in A
- Mixed constraints resolution

---

## Task 6.5: Spill Code Generation

**Time**: 2.5 hours  
**Tests**: 45 tests

**Key Concepts**:
- When can't fit in register, spill to memory
- 6502: Spill to zero-page is fast
- Insert load/store around uses

**File**: `packages/compiler/src/optimizer/register/spill.ts`

```typescript
/**
 * Spill Code Generator
 * 
 * Generates code to spill values to memory when
 * not enough registers are available.
 */
export class SpillCodeGenerator {
  protected spillSlots = new Map<Value, SpillSlot>();
  protected nextZPSlot = 0x02; // Start after ZP reserved area
  
  /** Generate spill code for a set of spilled values */
  generateSpillCode(func: ILFunction, spilled: Set<Value>): void {
    // 1. Allocate spill slots
    for (const value of spilled) {
      this.allocateSpillSlot(value);
    }
    
    // 2. Insert stores after definitions
    for (const value of spilled) {
      const def = value.getDefinition();
      this.insertStore(def, this.spillSlots.get(value)!);
    }
    
    // 3. Insert loads before uses
    for (const value of spilled) {
      for (const use of value.getUses()) {
        this.insertLoad(use, this.spillSlots.get(value)!);
      }
    }
  }
  
  protected allocateSpillSlot(value: Value): SpillSlot {
    const size = value.getType().getSize();
    
    // Prefer zero-page for frequently accessed values
    if (this.nextZPSlot + size <= 0xFF) {
      const slot = new SpillSlot(this.nextZPSlot, size, SpillLocation.ZERO_PAGE);
      this.nextZPSlot += size;
      this.spillSlots.set(value, slot);
      return slot;
    }
    
    // Fall back to stack or RAM
    return this.allocateRAMSlot(value, size);
  }
  
  protected insertStore(afterInst: ILInstruction, slot: SpillSlot): void {
    const store = new ILStore(slot.getAddress(), afterInst.getResult());
    afterInst.getBlock().insertAfter(afterInst, store);
  }
  
  protected insertLoad(beforeUse: ILInstruction, slot: SpillSlot): void {
    const load = new ILLoad(slot.getAddress());
    beforeUse.getBlock().insertBefore(beforeUse, load);
    // Replace operand with load result
    beforeUse.replaceOperand(slot.getValue(), load.getResult());
  }
}
```

**Tests**:
- Spill to zero-page
- Spill to RAM
- Multiple spill slots
- Spill with multiple uses
- Spill cost calculation

---

## Task 6.6: Register Coalescing

**Time**: 2.5 hours  
**Tests**: 45 tests

**Key Concepts**:
- Eliminate copy instructions by using same register
- TAX, TAY, TXA, etc. can be eliminated
- Must not create new interference

**File**: `packages/compiler/src/optimizer/register/coalesce.ts`

```typescript
/**
 * Register Coalescing
 * 
 * Eliminates copy/move instructions by assigning
 * source and destination to the same register.
 */
export class RegisterCoalescing {
  /** Coalesce copy instructions in the interference graph */
  coalesce(graph: InterferenceGraph, func: ILFunction): boolean {
    let changed = false;
    
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        if (this.isCopy(inst)) {
          const src = inst.getSource();
          const dst = inst.getResult();
          
          // Can coalesce if src and dst don't interfere
          if (!graph.interferes(src, dst)) {
            // Merge nodes in interference graph
            graph.merge(src, dst);
            // Remove copy instruction
            block.removeInstruction(inst);
            changed = true;
          }
        }
      }
    }
    
    return changed;
  }
  
  protected isCopy(inst: ILInstruction): boolean {
    // IL copy instruction
    if (inst.getOpcode() === ILOpcode.COPY) return true;
    
    // 6502 transfer instructions
    if (inst.is6502Transfer()) return true;
    
    return false;
  }
}

/**
 * Aggressive coalescing with Briggs' conservative heuristic.
 */
export class AggressiveCoalescing extends RegisterCoalescing {
  coalesce(graph: InterferenceGraph, func: ILFunction): boolean {
    // Use Briggs' heuristic: coalesce if combined node
    // would have < K neighbors with degree >= K
    return super.coalesce(graph, func);
  }
}
```

**Tests**:
- Coalesce simple copy
- Don't coalesce interfering values
- Coalesce TAX/TAY/TXA/TYA
- Aggressive coalescing
- Coalescing chain

---

## Task 6.7: Rematerialization

**Time**: 2 hours  
**Tests**: 40 tests

**Key Concepts**:
- Instead of spilling, recompute the value
- Cheaper if value is simple (constant, add)
- Alternative to spill

**File**: `packages/compiler/src/optimizer/register/rematerialize.ts`

```typescript
/**
 * Rematerialization
 * 
 * Instead of spilling a value to memory, recompute it
 * at each use point if cheaper than load/store.
 */
export class Rematerialization {
  /** Check if a value can be rematerialized */
  canRematerialize(value: Value): boolean {
    const def = value.getDefinition();
    
    // Constants can always be rematerialized
    if (def.isConstant()) return true;
    
    // Simple operations with available operands
    if (this.isSimpleOperation(def) && this.operandsAvailable(def)) {
      return true;
    }
    
    return false;
  }
  
  /** Get the cost of rematerializing vs spilling */
  getRematerializationCost(value: Value): number {
    const def = value.getDefinition();
    
    // LDA #imm = 2 bytes, 2 cycles
    if (def.isConstant()) return 2;
    
    // Simple ALU op = 2-3 bytes, 2-4 cycles
    if (this.isSimpleALU(def)) return 3;
    
    return Infinity; // Don't rematerialize complex ops
  }
  
  /** Rematerialize a value at its use */
  rematerialize(use: ILInstruction, value: Value): void {
    const def = value.getDefinition();
    const clone = def.clone();
    use.getBlock().insertBefore(use, clone);
    use.replaceOperand(value, clone.getResult());
  }
  
  protected isSimpleOperation(inst: ILInstruction): boolean {
    switch (inst.getOpcode()) {
      case ILOpcode.CONST:
      case ILOpcode.ADD:
      case ILOpcode.SUB:
      case ILOpcode.AND:
      case ILOpcode.OR:
        return true;
      default:
        return false;
    }
  }
}
```

**Tests**:
- Rematerialize constant
- Rematerialize simple add
- Don't rematerialize memory load
- Cost comparison with spill
- Multiple rematerialization points

---

## Task 6.8: Live Range Splitting

**Time**: 2.5 hours  
**Tests**: 40 tests

**Key Concepts**:
- Split long live ranges into shorter ones
- May allow better allocation
- Insert copies at split points

**File**: `packages/compiler/src/optimizer/register/split.ts`

```typescript
/**
 * Live Range Splitting
 * 
 * Splits long live ranges into shorter ranges at
 * strategic points to improve register allocation.
 */
export class LiveRangeSplitting {
  /** Split a live range at the specified points */
  splitRange(value: Value, splitPoints: SplitPoint[]): Value[] {
    const newValues: Value[] = [];
    let currentValue = value;
    
    for (const point of splitPoints) {
      // Create new value for portion after split
      const newValue = this.createSplitValue(currentValue);
      newValues.push(newValue);
      
      // Insert copy at split point
      this.insertCopy(point, currentValue, newValue);
      
      // Update uses after split point
      this.updateUses(currentValue, newValue, point);
      
      currentValue = newValue;
    }
    
    return newValues;
  }
  
  /** Find optimal split points for a live range */
  findSplitPoints(range: LiveRange, loopInfo: LoopInfo): SplitPoint[] {
    const points: SplitPoint[] = [];
    
    // Split at loop boundaries (reduce register pressure in loops)
    for (const loop of loopInfo.getLoops()) {
      if (range.crossesLoop(loop)) {
        // Split before loop entry
        points.push(new SplitPoint(loop.getPreheader(), SplitType.BEFORE_LOOP));
        // Split after loop exit
        for (const exit of loop.getExitBlocks()) {
          points.push(new SplitPoint(exit, SplitType.AFTER_LOOP));
        }
      }
    }
    
    return points;
  }
}
```

**Tests**:
- Split at loop entry
- Split at loop exit
- Multiple split points
- Update phi nodes after split
- Split with coalescing opportunity

---

## Phase 6 Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 6.1 | Live range computation | 2.5 hr | 45 | [ ] |
| 6.2 | Interference graph | 2.5 hr | 45 | [ ] |
| 6.3 | Graph coloring allocator | 3 hr | 50 | [ ] |
| 6.4 | 6502 register constraints | 2 hr | 40 | [ ] |
| 6.5 | Spill code generation | 2.5 hr | 45 | [ ] |
| 6.6 | Register coalescing | 2.5 hr | 45 | [ ] |
| 6.7 | Rematerialization | 2 hr | 40 | [ ] |
| 6.8 | Live range splitting | 2.5 hr | 40 | [ ] |
| **Total** | | **20 hr** | **350** | |

---

## Success Criteria

- [ ] All 350 tests passing
- [ ] Minimal spill code generated
- [ ] Register constraints respected
- [ ] Coalescing eliminates unnecessary transfers
- [ ] Zero-page used for spills when possible

---

## 6502-Specific Considerations

### The 3-Register Challenge

With only A, X, Y, register allocation is extremely constrained:

```
Good allocation:                Bad allocation:
  LDA value1                      LDA value1
  ADC value2    ; A still valid   STA temp
  TAX                             LDA value2  
  LDA value3                      ADC temp    ; Extra load!
  ADC value4   
```

### Zero-Page as Register Extension

The 256-byte zero-page can act as "pseudo-registers":
- 3 cycles to load from ZP (vs 4 for absolute)
- 2 bytes for ZP addressing (vs 3 for absolute)
- Can be used for frequently accessed variables

### Register Transfer Costs

6502 transfers are cheap but not free:
- TAX, TAY, TXA, TYA = 2 cycles each
- Coalescing saves these cycles
- Sometimes a spill+reload is cheaper than many transfers

---

## Implementation Sessions

| Session | Tasks | Focus |
|---------|-------|-------|
| Session 1 | 6.1, 6.2 | Live ranges + Interference graph |
| Session 2 | 6.3, 6.4 | Graph coloring + 6502 constraints |
| Session 3 | 6.5, 6.6 | Spill + Coalescing |
| Session 4 | 6.7, 6.8 | Rematerialization + Splitting |

---

**Previous**: [05-loop-optimizations.md](05-loop-optimizations.md)  
**Next**: [07-6502-specific.md](07-6502-specific.md)