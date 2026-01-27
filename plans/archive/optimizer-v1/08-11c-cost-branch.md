# Task 8.11c: Branch & Conditional Cycle Analysis

> **Task**: 8.11c of 12 (Peephole Phase - Cost Model)  
> **Time**: ~2 hours  
> **Tests**: ~35 tests  
> **Prerequisites**: Task 8.11b (Memory Access Costs)

---

## Overview

Implement detailed branch and conditional instruction cycle analysis. Branch instructions on the 6502 have variable cycle counts based on whether the branch is taken and whether it crosses a page boundary. This task provides accurate cost modeling for control flow optimization decisions.

---

## Directory Structure

```
packages/compiler/src/optimizer/cost/
├── index.ts              # Exports
├── types.ts              # Cost model types
├── cycle-table.ts        # Base cycle counts
├── instruction-cost.ts   # Per-instruction costing
├── cost-calculator.ts    # Total cost computation
├── memory-cost.ts        # Memory access costing
├── addressing-cost.ts    # Addressing mode analysis
├── page-analysis.ts      # Page boundary analysis
├── branch-cost.ts        # Branch cycle analysis (THIS TASK)
├── conditional-cost.ts   # Conditional sequence analysis (THIS TASK)
└── control-flow-cost.ts  # Control flow costing (THIS TASK)
```

---

## Implementation

### File: `branch-cost.ts`

```typescript
import { PageBoundaryAnalyzer, pageAnalyzer } from './page-analysis.js';

/**
 * Branch cost breakdown
 */
export interface BranchCost {
  /** Cycles when branch not taken */
  readonly notTakenCycles: number;
  /** Cycles when branch taken, no page cross */
  readonly takenSamePageCycles: number;
  /** Cycles when branch taken, page cross */
  readonly takenCrossPageCycles: number;
  /** Expected average cycles (based on probability) */
  readonly expectedCycles: number;
  /** Size in bytes */
  readonly bytes: number;
}

/**
 * Branch probability estimation
 */
export interface BranchProbability {
  /** Probability branch is taken (0-1) */
  readonly takenProbability: number;
  /** Probability of page cross if taken (0-1) */
  readonly pageCrossProbability: number;
  /** Confidence in this estimate (0-1) */
  readonly confidence: number;
  /** Source of estimate */
  readonly source: 'static' | 'heuristic' | 'profile';
}

/**
 * Branch instruction types
 */
export type BranchMnemonic = 
  | 'BCC' | 'BCS'  // Carry
  | 'BEQ' | 'BNE'  // Zero
  | 'BMI' | 'BPL'  // Negative
  | 'BVC' | 'BVS'; // Overflow

/**
 * Calculator for branch instruction costs
 */
export class BranchCostCalculator {
  protected pageAnalyzer: PageBoundaryAnalyzer;
  
  /** Base cycles for branch not taken */
  protected readonly NOT_TAKEN_CYCLES = 2;
  
  /** Additional cycle when branch taken */
  protected readonly TAKEN_PENALTY = 1;
  
  /** Additional cycle when crossing page */
  protected readonly PAGE_CROSS_PENALTY = 1;
  
  constructor(analyzer: PageBoundaryAnalyzer = pageAnalyzer) {
    this.pageAnalyzer = analyzer;
  }
  
  /**
   * Calculate branch cost with static analysis
   */
  calculate(
    branchAddress: number,
    targetAddress: number,
    probability?: BranchProbability
  ): BranchCost {
    const pageInfo = this.pageAnalyzer.checkBranch(branchAddress, targetAddress);
    
    const notTakenCycles = this.NOT_TAKEN_CYCLES;
    const takenSamePageCycles = this.NOT_TAKEN_CYCLES + this.TAKEN_PENALTY;
    const takenCrossPageCycles = takenSamePageCycles + this.PAGE_CROSS_PENALTY;
    
    // Use probability to calculate expected cycles
    const prob = probability || this.getDefaultProbability();
    const expectedCycles = this.calculateExpectedCycles(
      notTakenCycles,
      takenSamePageCycles,
      takenCrossPageCycles,
      prob,
      pageInfo.crossesPage
    );
    
    return {
      notTakenCycles,
      takenSamePageCycles,
      takenCrossPageCycles,
      expectedCycles,
      bytes: 2,
    };
  }
  
  /**
   * Calculate branch cost from IL instruction
   */
  calculateFromIL(
    instruction: ILInstruction,
    context: CostContext
  ): BranchCost {
    const branchAddr = context.currentAddress;
    const targetAddr = this.resolveTarget(instruction, context);
    const probability = this.estimateProbability(instruction, context);
    
    return this.calculate(branchAddr, targetAddr, probability);
  }
  
  /**
   * Calculate expected cycles based on probabilities
   */
  protected calculateExpectedCycles(
    notTaken: number,
    takenSamePage: number,
    takenCrossPage: number,
    probability: BranchProbability,
    crossesPage: boolean
  ): number {
    const notTakenProb = 1 - probability.takenProbability;
    const takenProb = probability.takenProbability;
    
    if (!crossesPage) {
      // No page crossing possible
      return (notTaken * notTakenProb) + (takenSamePage * takenProb);
    }
    
    // With page crossing possibility
    const pageCrossProb = probability.pageCrossProbability;
    const samPageProb = 1 - pageCrossProb;
    
    return (notTaken * notTakenProb) +
           (takenSamePage * takenProb * samPageProb) +
           (takenCrossPage * takenProb * pageCrossProb);
  }
  
  /**
   * Get default branch probability (50/50)
   */
  protected getDefaultProbability(): BranchProbability {
    return {
      takenProbability: 0.5,
      pageCrossProbability: 0.1, // Assume 10% page cross chance
      confidence: 0.3,
      source: 'static',
    };
  }
  
  /**
   * Estimate branch probability from context
   */
  protected estimateProbability(
    instruction: ILInstruction,
    context: CostContext
  ): BranchProbability {
    // Check for loop back-edges (usually taken)
    if (this.isLoopBackEdge(instruction, context)) {
      return {
        takenProbability: 0.9,
        pageCrossProbability: 0.05,
        confidence: 0.7,
        source: 'heuristic',
      };
    }
    
    // Check for error/null checks (usually not taken)
    if (this.isErrorCheck(instruction, context)) {
      return {
        takenProbability: 0.1,
        pageCrossProbability: 0.5,
        confidence: 0.6,
        source: 'heuristic',
      };
    }
    
    // Default probability
    return this.getDefaultProbability();
  }
  
  /**
   * Check if branch is a loop back-edge
   */
  protected isLoopBackEdge(
    instruction: ILInstruction,
    context: CostContext
  ): boolean {
    // Back-edge if target is before current address
    const target = this.resolveTarget(instruction, context);
    return target < context.currentAddress;
  }
  
  /**
   * Check if branch is likely an error check
   */
  protected isErrorCheck(
    instruction: ILInstruction,
    context: CostContext
  ): boolean {
    // Heuristic: BEQ/BNE after CMP #0 is often null check
    const prevInst = context.previousInstruction;
    if (!prevInst) return false;
    
    const mnemonic = instruction.metadata?.mnemonic;
    if (mnemonic === 'BEQ' || mnemonic === 'BNE') {
      if (prevInst.metadata?.mnemonic === 'CMP') {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Resolve branch target address
   */
  protected resolveTarget(
    instruction: ILInstruction,
    context: CostContext
  ): number {
    // Get target from instruction operand or label
    const operand = instruction.operands[0];
    if (operand?.type === 'label') {
      return context.labelAddresses?.get(operand.name) ?? context.currentAddress;
    }
    if (operand?.type === 'immediate') {
      // Relative offset
      return context.currentAddress + 2 + (operand.value as number);
    }
    return context.currentAddress;
  }
}

/**
 * Context for cost calculations
 */
export interface CostContext {
  /** Current instruction address */
  readonly currentAddress: number;
  /** Previous instruction (for context) */
  readonly previousInstruction?: ILInstruction;
  /** Label to address mapping */
  readonly labelAddresses?: Map<string, number>;
  /** Loop nesting depth */
  readonly loopDepth?: number;
}

/** Default branch cost calculator */
export const branchCost = new BranchCostCalculator();
```

### File: `conditional-cost.ts`

```typescript
import { BranchCost, BranchCostCalculator, branchCost, CostContext } from './branch-cost.js';

/**
 * Conditional sequence cost analysis
 */
export interface ConditionalSequenceCost {
  /** Total cycles for condition evaluation */
  readonly conditionCycles: number;
  /** Cycles for branch instruction */
  readonly branchCycles: number;
  /** Cycles for taken path (if known) */
  readonly takenPathCycles?: number;
  /** Cycles for not-taken path (if known) */
  readonly notTakenPathCycles?: number;
  /** Expected total cycles */
  readonly expectedTotalCycles: number;
  /** Total bytes */
  readonly totalBytes: number;
}

/**
 * If-then-else structure costs
 */
export interface IfElseCost {
  /** Condition evaluation cycles */
  readonly conditionCycles: number;
  /** Then-branch cycles */
  readonly thenCycles: number;
  /** Else-branch cycles */
  readonly elseCycles: number;
  /** Expected cycles (weighted average) */
  readonly expectedCycles: number;
  /** Overhead cycles (branches, jumps) */
  readonly overheadCycles: number;
}

/**
 * Analyzer for conditional code sequences
 */
export class ConditionalCostAnalyzer {
  protected branchCalculator: BranchCostCalculator;
  
  constructor(calculator: BranchCostCalculator = branchCost) {
    this.branchCalculator = calculator;
  }
  
  /**
   * Analyze cost of a compare-and-branch sequence
   */
  analyzeCompareAndBranch(
    compareInst: ILInstruction,
    branchInst: ILInstruction,
    context: CostContext
  ): ConditionalSequenceCost {
    // Compare instruction cost
    const compareCycles = this.getCompareCycles(compareInst);
    const compareBytes = this.getCompareBytes(compareInst);
    
    // Branch instruction cost
    const branchCostResult = this.branchCalculator.calculateFromIL(
      branchInst,
      context
    );
    
    return {
      conditionCycles: compareCycles,
      branchCycles: branchCostResult.expectedCycles,
      expectedTotalCycles: compareCycles + branchCostResult.expectedCycles,
      totalBytes: compareBytes + branchCostResult.bytes,
    };
  }
  
  /**
   * Analyze if-then-else structure
   */
  analyzeIfElse(
    condition: ILInstruction[],
    thenBlock: ILInstruction[],
    elseBlock: ILInstruction[],
    thenProbability: number,
    context: CostContext
  ): IfElseCost {
    // Condition evaluation
    let conditionCycles = 0;
    for (const inst of condition) {
      conditionCycles += this.getInstructionCycles(inst);
    }
    
    // Then/else block cycles
    let thenCycles = 0;
    for (const inst of thenBlock) {
      thenCycles += this.getInstructionCycles(inst);
    }
    
    let elseCycles = 0;
    for (const inst of elseBlock) {
      elseCycles += this.getInstructionCycles(inst);
    }
    
    // Branch overhead: one branch at condition, one jump at end of then
    const branchOverhead = 2 + 3; // Branch (2-4) + JMP (3)
    
    // Expected cycles
    const expectedCycles = conditionCycles +
      (thenCycles * thenProbability) +
      (elseCycles * (1 - thenProbability)) +
      branchOverhead;
    
    return {
      conditionCycles,
      thenCycles,
      elseCycles,
      expectedCycles,
      overheadCycles: branchOverhead,
    };
  }
  
  /**
   * Calculate cost savings from branch elimination
   */
  calculateBranchEliminationSavings(
    branchCost: BranchCost,
    replacementCycles: number
  ): number {
    return branchCost.expectedCycles - replacementCycles;
  }
  
  /**
   * Analyze loop exit condition cost
   */
  analyzeLoopExitCost(
    compareInst: ILInstruction,
    branchInst: ILInstruction,
    expectedIterations: number,
    context: CostContext
  ): number {
    const seqCost = this.analyzeCompareAndBranch(compareInst, branchInst, context);
    
    // Loop exit check runs once per iteration
    // Last iteration: branch not taken
    // All other iterations: branch taken
    const takenIterations = expectedIterations - 1;
    const notTakenIterations = 1;
    
    return seqCost.expectedTotalCycles * expectedIterations;
  }
  
  /**
   * Get cycles for compare instruction
   */
  protected getCompareCycles(inst: ILInstruction): number {
    // CMP/CPX/CPY cycles based on addressing mode
    const mode = inst.metadata?.addressingMode;
    switch (mode) {
      case 'immediate': return 2;
      case 'zero-page': return 3;
      case 'zero-page-x':
      case 'zero-page-y': return 4;
      case 'absolute': return 4;
      case 'absolute-x':
      case 'absolute-y': return 4; // +1 if page cross
      default: return 2;
    }
  }
  
  /**
   * Get bytes for compare instruction
   */
  protected getCompareBytes(inst: ILInstruction): number {
    const mode = inst.metadata?.addressingMode;
    switch (mode) {
      case 'immediate':
      case 'zero-page':
      case 'zero-page-x':
      case 'zero-page-y': return 2;
      case 'absolute':
      case 'absolute-x':
      case 'absolute-y': return 3;
      default: return 2;
    }
  }
  
  /**
   * Get cycles for any instruction (simplified)
   */
  protected getInstructionCycles(inst: ILInstruction): number {
    // This would ideally use the main cost calculator
    // Simplified version for conditional analysis
    return inst.metadata?.cycles ?? 3;
  }
}

/** Default conditional cost analyzer */
export const conditionalCost = new ConditionalCostAnalyzer();
```

### File: `control-flow-cost.ts`

```typescript
import { BranchCost, BranchCostCalculator, branchCost, CostContext } from './branch-cost.js';
import { ConditionalCostAnalyzer, conditionalCost } from './conditional-cost.js';

/**
 * Jump instruction costs
 */
export interface JumpCost {
  /** Cycles for the jump */
  readonly cycles: number;
  /** Size in bytes */
  readonly bytes: number;
  /** Is this a subroutine call? */
  readonly isCall: boolean;
}

/**
 * Control flow path cost
 */
export interface PathCost {
  /** Path identifier */
  readonly pathId: string;
  /** Total cycles for this path */
  readonly cycles: number;
  /** Total bytes for this path */
  readonly bytes: number;
  /** Probability of taking this path */
  readonly probability: number;
}

/**
 * Comprehensive control flow cost analysis
 */
export interface ControlFlowCost {
  /** Costs for each possible path */
  readonly paths: PathCost[];
  /** Expected cost (probability-weighted average) */
  readonly expectedCycles: number;
  /** Minimum possible cycles */
  readonly minCycles: number;
  /** Maximum possible cycles */
  readonly maxCycles: number;
  /** Total size in bytes */
  readonly totalBytes: number;
}

/**
 * Analyzer for complete control flow structures
 */
export class ControlFlowCostAnalyzer {
  protected branchCalculator: BranchCostCalculator;
  protected conditionalAnalyzer: ConditionalCostAnalyzer;
  
  constructor(
    branchCalc: BranchCostCalculator = branchCost,
    condCalc: ConditionalCostAnalyzer = conditionalCost
  ) {
    this.branchCalculator = branchCalc;
    this.conditionalAnalyzer = condCalc;
  }
  
  /**
   * Get cost for JMP instruction
   */
  getJumpCost(mode: 'absolute' | 'indirect'): JumpCost {
    if (mode === 'absolute') {
      return { cycles: 3, bytes: 3, isCall: false };
    }
    return { cycles: 5, bytes: 3, isCall: false }; // JMP ($xxxx)
  }
  
  /**
   * Get cost for JSR/RTS pair
   */
  getCallReturnCost(): { call: number; return: number; total: number } {
    return {
      call: 6,    // JSR
      return: 6,  // RTS
      total: 12,
    };
  }
  
  /**
   * Analyze switch/case statement cost
   */
  analyzeSwitchCase(
    cases: { value: number; probability: number; bodyCycles: number }[],
    defaultCycles: number,
    context: CostContext
  ): ControlFlowCost {
    const paths: PathCost[] = [];
    let totalProbability = 0;
    let totalBytes = 0;
    
    // Each case: CMP + BEQ + body
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      const cmpCycles = 2; // CMP #imm
      const branchCycles = 2; // BEQ (assume not taken for most)
      
      // If this case matches:
      // - Skip remaining comparisons
      // - Execute body
      const matchCycles = (cmpCycles * (i + 1)) + c.bodyCycles;
      
      paths.push({
        pathId: `case-${c.value}`,
        cycles: matchCycles,
        bytes: 4 + c.bodyCycles, // CMP + BEQ + body estimate
        probability: c.probability,
      });
      
      totalProbability += c.probability;
      totalBytes += 4; // CMP + BEQ per case
    }
    
    // Default case
    const remainingProb = 1 - totalProbability;
    const allCompareCycles = cases.length * 4; // All CMPs and BEQs
    paths.push({
      pathId: 'default',
      cycles: allCompareCycles + defaultCycles,
      bytes: 3 + defaultCycles, // JMP + body estimate
      probability: remainingProb,
    });
    
    totalBytes += 3; // JMP to default
    
    // Calculate statistics
    const expectedCycles = paths.reduce(
      (sum, p) => sum + (p.cycles * p.probability),
      0
    );
    const minCycles = Math.min(...paths.map(p => p.cycles));
    const maxCycles = Math.max(...paths.map(p => p.cycles));
    
    return {
      paths,
      expectedCycles,
      minCycles,
      maxCycles,
      totalBytes,
    };
  }
  
  /**
   * Analyze while loop cost
   */
  analyzeWhileLoop(
    conditionCycles: number,
    bodyCycles: number,
    expectedIterations: number,
    context: CostContext
  ): ControlFlowCost {
    // Condition checked every iteration
    // Body executed every iteration except last
    // Final check exits the loop
    
    const iterationCycles = conditionCycles + bodyCycles + 3; // +3 for branch
    const exitCycles = conditionCycles + 2; // Condition + branch not taken
    
    const totalCycles = (iterationCycles * (expectedIterations - 1)) + exitCycles;
    
    return {
      paths: [
        {
          pathId: 'loop',
          cycles: totalCycles,
          bytes: conditionCycles + bodyCycles + 5, // Estimate
          probability: 1.0,
        },
      ],
      expectedCycles: totalCycles,
      minCycles: exitCycles, // Zero iterations
      maxCycles: totalCycles * 2, // Double iterations
      totalBytes: conditionCycles + bodyCycles + 5,
    };
  }
  
  /**
   * Analyze for loop cost
   */
  analyzeForLoop(
    initCycles: number,
    conditionCycles: number,
    updateCycles: number,
    bodyCycles: number,
    iterations: number
  ): ControlFlowCost {
    // Init runs once
    // Condition runs iterations+1 times (including final exit check)
    // Update runs iterations times
    // Body runs iterations times
    
    const loopCycles = initCycles +
      (conditionCycles * (iterations + 1)) +
      (updateCycles * iterations) +
      (bodyCycles * iterations) +
      (3 * iterations); // Branch overhead
    
    return {
      paths: [
        {
          pathId: 'for-loop',
          cycles: loopCycles,
          bytes: initCycles + conditionCycles + updateCycles + bodyCycles + 8,
          probability: 1.0,
        },
      ],
      expectedCycles: loopCycles,
      minCycles: initCycles + conditionCycles + 2, // Zero iterations
      maxCycles: loopCycles,
      totalBytes: initCycles + conditionCycles + updateCycles + bodyCycles + 8,
    };
  }
  
  /**
   * Compare branch vs branchless implementation
   */
  compareBranchVsBranchless(
    branchCycles: number,
    branchlesssCycles: number,
    branchTakenProbability: number
  ): { useBranchless: boolean; savings: number } {
    // Branch has variable cost based on taken probability
    // Branchless is constant
    
    const avgBranchCycles = branchCycles; // Already accounts for probability
    const savings = avgBranchCycles - branchlesssCycles;
    
    return {
      useBranchless: savings > 0,
      savings,
    };
  }
}

/** Default control flow cost analyzer */
export const controlFlowCost = new ControlFlowCostAnalyzer();
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `branch-cost.calculate` | Calculate branch costs for all scenarios |
| `branch-cost.calculateExpectedCycles` | Probability-weighted cycle calculation |
| `branch-cost.isLoopBackEdge` | Detect loop back-edges |
| `branch-cost.estimateProbability` | Heuristic probability estimation |
| `conditional-cost.analyzeCompareAndBranch` | Compare-branch sequence cost |
| `conditional-cost.analyzeIfElse` | If-else structure analysis |
| `conditional-cost.analyzeLoopExitCost` | Loop exit overhead |
| `control-flow-cost.getJumpCost` | JMP instruction costs |
| `control-flow-cost.getCallReturnCost` | JSR/RTS overhead |
| `control-flow-cost.analyzeSwitchCase` | Switch statement analysis |
| `control-flow-cost.analyzeWhileLoop` | While loop cost model |
| `control-flow-cost.analyzeForLoop` | For loop cost model |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `branch-cost.ts` | [ ] |
| Create `conditional-cost.ts` | [ ] |
| Create `control-flow-cost.ts` | [ ] |
| Update `index.ts` exports | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 8.11d → `08-11d-cost-tradeoffs.md`