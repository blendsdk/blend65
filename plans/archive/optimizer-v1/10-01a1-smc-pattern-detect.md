# Task 10.1a1: SMC Pattern Detection

> **Session**: 5.1a1
> **Phase**: 10-smc (Self-Modifying Code)
> **Estimated Time**: 3-4 hours
> **Tests**: 25-30 unit tests
> **Prerequisites**: 08-peephole complete, IL infrastructure

---

## Overview

This document specifies the **SMC pattern detection system** that identifies code constructs which can benefit from self-modifying code techniques on the 6502 processor.

### What is Self-Modifying Code?

Self-modifying code (SMC) is a technique where a program modifies its own instructions at runtime. On the 6502, this is particularly valuable because:

1. **Limited registers**: Only A, X, Y - SMC can create "virtual registers"
2. **Indexed mode limitations**: Only +X or +Y from base address
3. **No indirect indexed with Y offset**: SMC can simulate this
4. **Performance**: Direct addressing (4 cycles) vs indirect (5-6 cycles)

### SMC Categories

```
┌─────────────────────────────────────────────────────────────┐
│                    SMC Pattern Categories                    │
├─────────────────────────────────────────────────────────────┤
│  1. Loop Unrolling          - Counter/index in instruction  │
│  2. Jump Tables             - Computed jump targets         │
│  3. Address Modification    - Dynamic base addresses        │
│  4. Constant Injection      - Runtime constant loading      │
│  5. Opcode Modification     - Switching instruction types   │
└─────────────────────────────────────────────────────────────┘
```

---

## Type Definitions

### SMC Pattern Types

```typescript
/**
 * Categories of self-modifying code patterns
 */
enum SMCPatternCategory {
  /** Loop counter embedded in instruction operand */
  LOOP_COUNTER = 'loop_counter',
  
  /** Base address modified for array/table access */
  ADDRESS_MODIFICATION = 'address_modification',
  
  /** Jump target computed and written to instruction */
  COMPUTED_JUMP = 'computed_jump',
  
  /** Constant value injected into immediate operand */
  CONSTANT_INJECTION = 'constant_injection',
  
  /** Opcode itself is modified (e.g., BEQ↔BNE) */
  OPCODE_MODIFICATION = 'opcode_modification',
  
  /** Combination of multiple SMC techniques */
  COMPOSITE = 'composite'
}

/**
 * Detected SMC pattern with source location and metadata
 */
interface SMCPattern {
  /** Unique pattern identifier */
  readonly id: string;
  
  /** Pattern category */
  readonly category: SMCPatternCategory;
  
  /** IL instructions involved in the pattern */
  readonly instructions: readonly ILInstruction[];
  
  /** Basic block containing the pattern */
  readonly block: BasicBlock;
  
  /** Source location for diagnostics */
  readonly location: SourceLocation;
  
  /** Pattern-specific metadata */
  readonly metadata: SMCPatternMetadata;
  
  /** Confidence score (0.0 - 1.0) */
  readonly confidence: number;
}

/**
 * Metadata specific to each pattern category
 */
type SMCPatternMetadata = 
  | LoopCounterMetadata
  | AddressModificationMetadata
  | ComputedJumpMetadata
  | ConstantInjectionMetadata
  | OpcodeModificationMetadata;

/**
 * Loop counter pattern metadata
 */
interface LoopCounterMetadata {
  readonly kind: 'loop_counter';
  
  /** Loop being unrolled */
  readonly loopId: string;
  
  /** Iteration count (if known) */
  readonly iterationCount: number | 'dynamic';
  
  /** Variable used as counter */
  readonly counterVariable: string;
  
  /** Instructions modified per iteration */
  readonly modifiedInstructions: readonly ILInstruction[];
}

/**
 * Address modification pattern metadata
 */
interface AddressModificationMetadata {
  readonly kind: 'address_modification';
  
  /** Base address being modified */
  readonly baseAddress: number | 'computed';
  
  /** Offset calculation expression */
  readonly offsetExpression: string;
  
  /** Target instruction opcode */
  readonly targetOpcode: M6502Opcode;
  
  /** Addressing mode being simulated */
  readonly simulatedMode: AddressingMode;
}

/**
 * Computed jump pattern metadata
 */
interface ComputedJumpMetadata {
  readonly kind: 'computed_jump';
  
  /** Jump table base address */
  readonly tableBase: number | 'computed';
  
  /** Number of entries (if known) */
  readonly entryCount: number | 'dynamic';
  
  /** Entry size in bytes */
  readonly entrySize: 1 | 2;
  
  /** Index variable */
  readonly indexVariable: string;
}
```

### Pattern Detection Context

```typescript
/**
 * Context for pattern detection analysis
 */
interface SMCDetectionContext {
  /** Current function being analyzed */
  readonly function: ILFunction;
  
  /** Control flow graph */
  readonly cfg: ControlFlowGraph;
  
  /** Loop information */
  readonly loopInfo: LoopAnalysisResult;
  
  /** Variable liveness information */
  readonly liveness: LivenessResult;
  
  /** Reaching definitions */
  readonly reachingDefs: ReachingDefinitionsResult;
  
  /** Memory alias analysis */
  readonly aliasInfo: AliasAnalysisResult;
  
  /** Detected patterns (accumulated) */
  patterns: SMCPattern[];
}

/**
 * Pattern detector interface
 */
interface SMCPatternDetector {
  /** Pattern category this detector handles */
  readonly category: SMCPatternCategory;
  
  /** Detect patterns in the given context */
  detect(context: SMCDetectionContext): SMCPattern[];
  
  /** Check if a specific instruction sequence matches */
  matches(instructions: readonly ILInstruction[]): boolean;
}
```

---

## Implementation

### SMC Pattern Detection Pass

```typescript
/**
 * Main SMC pattern detection pass
 * 
 * Analyzes IL code to identify opportunities for self-modifying
 * code optimization. Runs after loop analysis and before code
 * generation.
 * 
 * @example
 * ```typescript
 * const detector = new SMCPatternDetectionPass();
 * const patterns = detector.analyze(ilFunction, cfg, analysisResults);
 * ```
 */
class SMCPatternDetectionPass implements ILPass {
  readonly name = 'smc-pattern-detection';
  readonly category = PassCategory.ANALYSIS;
  
  /** Registered pattern detectors */
  protected readonly detectors: Map<SMCPatternCategory, SMCPatternDetector>;
  
  /** Configuration options */
  protected readonly config: SMCDetectionConfig;
  
  constructor(config: Partial<SMCDetectionConfig> = {}) {
    this.config = { ...DEFAULT_SMC_DETECTION_CONFIG, ...config };
    this.detectors = new Map();
    this.registerDefaultDetectors();
  }
  
  /**
   * Register default pattern detectors
   */
  protected registerDefaultDetectors(): void {
    this.registerDetector(new LoopCounterDetector(this.config));
    this.registerDetector(new AddressModificationDetector(this.config));
    this.registerDetector(new ComputedJumpDetector(this.config));
    this.registerDetector(new ConstantInjectionDetector(this.config));
    this.registerDetector(new OpcodeModificationDetector(this.config));
  }
  
  /**
   * Register a custom pattern detector
   */
  registerDetector(detector: SMCPatternDetector): void {
    this.detectors.set(detector.category, detector);
  }
  
  /**
   * Analyze function for SMC opportunities
   */
  analyze(
    func: ILFunction,
    cfg: ControlFlowGraph,
    analysisResults: AnalysisBundle
  ): SMCDetectionResult {
    // Build detection context
    const context: SMCDetectionContext = {
      function: func,
      cfg,
      loopInfo: analysisResults.loopAnalysis,
      liveness: analysisResults.liveness,
      reachingDefs: analysisResults.reachingDefinitions,
      aliasInfo: analysisResults.aliasAnalysis,
      patterns: []
    };
    
    // Run all detectors
    for (const detector of this.detectors.values()) {
      if (this.isDetectorEnabled(detector.category)) {
        const patterns = detector.detect(context);
        context.patterns.push(...patterns);
      }
    }
    
    // Filter by confidence threshold
    const filteredPatterns = context.patterns.filter(
      p => p.confidence >= this.config.minConfidence
    );
    
    // Remove overlapping patterns (keep highest confidence)
    const finalPatterns = this.resolveOverlaps(filteredPatterns);
    
    return {
      patterns: finalPatterns,
      statistics: this.computeStatistics(finalPatterns)
    };
  }
  
  /**
   * Check if a detector category is enabled
   */
  protected isDetectorEnabled(category: SMCPatternCategory): boolean {
    return this.config.enabledCategories.includes(category);
  }
  
  /**
   * Resolve overlapping patterns
   */
  protected resolveOverlaps(patterns: SMCPattern[]): SMCPattern[] {
    // Sort by confidence descending
    const sorted = [...patterns].sort((a, b) => b.confidence - a.confidence);
    
    const selected: SMCPattern[] = [];
    const usedInstructions = new Set<ILInstruction>();
    
    for (const pattern of sorted) {
      // Check if any instruction is already used
      const overlaps = pattern.instructions.some(i => usedInstructions.has(i));
      
      if (!overlaps) {
        selected.push(pattern);
        pattern.instructions.forEach(i => usedInstructions.add(i));
      }
    }
    
    return selected;
  }
  
  /**
   * Compute detection statistics
   */
  protected computeStatistics(patterns: SMCPattern[]): SMCDetectionStatistics {
    const byCategory = new Map<SMCPatternCategory, number>();
    
    for (const pattern of patterns) {
      const count = byCategory.get(pattern.category) || 0;
      byCategory.set(pattern.category, count + 1);
    }
    
    return {
      totalPatterns: patterns.length,
      byCategory,
      averageConfidence: patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
        : 0
    };
  }
}
```

### Loop Counter Pattern Detector

```typescript
/**
 * Detects loop patterns that can benefit from counter-in-instruction SMC
 * 
 * This technique embeds the loop counter directly in instruction operands,
 * avoiding register usage and enabling deeper loop unrolling.
 * 
 * @example
 * Before SMC:
 * ```
 * loop:  LDX counter
 *        LDA table,X
 *        ...
 *        DEX
 *        BNE loop
 * ```
 * 
 * After SMC:
 * ```
 * loop:  LDA table+7   ; +7 is modified each iteration
 *        ...
 *        DEC loop+1    ; Modify the +7 operand
 *        BNE loop
 * ```
 */
class LoopCounterDetector implements SMCPatternDetector {
  readonly category = SMCPatternCategory.LOOP_COUNTER;
  
  protected readonly config: SMCDetectionConfig;
  
  constructor(config: SMCDetectionConfig) {
    this.config = config;
  }
  
  /**
   * Detect loop counter patterns
   */
  detect(context: SMCDetectionContext): SMCPattern[] {
    const patterns: SMCPattern[] = [];
    
    // Analyze each loop
    for (const loop of context.loopInfo.loops) {
      const pattern = this.analyzeLoop(loop, context);
      if (pattern) {
        patterns.push(pattern);
      }
    }
    
    return patterns;
  }
  
  /**
   * Analyze a single loop for SMC opportunity
   */
  protected analyzeLoop(
    loop: LoopInfo,
    context: SMCDetectionContext
  ): SMCPattern | null {
    // Must have a simple induction variable
    const inductionVar = this.findInductionVariable(loop, context);
    if (!inductionVar) return null;
    
    // Must have bounded iteration count (or profile data)
    const iterationCount = this.estimateIterations(loop, inductionVar);
    if (iterationCount === null) return null;
    
    // Find instructions using the induction variable for indexing
    const indexedInstructions = this.findIndexedInstructions(
      loop, inductionVar, context
    );
    if (indexedInstructions.length === 0) return null;
    
    // Check if SMC transformation is beneficial
    const confidence = this.computeConfidence(
      loop, inductionVar, indexedInstructions, iterationCount
    );
    
    if (confidence < this.config.minConfidence) return null;
    
    return {
      id: `loop_counter_${loop.header.id}`,
      category: SMCPatternCategory.LOOP_COUNTER,
      instructions: this.collectLoopInstructions(loop, context),
      block: loop.header,
      location: loop.header.location,
      metadata: {
        kind: 'loop_counter',
        loopId: loop.header.id,
        iterationCount,
        counterVariable: inductionVar.name,
        modifiedInstructions: indexedInstructions
      },
      confidence
    };
  }
  
  /**
   * Find the primary induction variable
   */
  protected findInductionVariable(
    loop: LoopInfo,
    context: SMCDetectionContext
  ): InductionVariable | null {
    // Look for canonical loop counter pattern:
    // - Initialized before loop
    // - Incremented/decremented once per iteration
    // - Used in loop exit condition
    
    const candidates: InductionVariable[] = [];
    
    for (const block of loop.blocks) {
      for (const inst of block.instructions) {
        if (this.isInductionUpdate(inst)) {
          const variable = this.extractInductionVariable(inst, context);
          if (variable && this.isUsedInExit(variable, loop)) {
            candidates.push(variable);
          }
        }
      }
    }
    
    // Prefer X or Y register if available (more efficient for indexing)
    const xOrY = candidates.find(v => 
      v.preferredRegister === 'X' || v.preferredRegister === 'Y'
    );
    
    return xOrY || candidates[0] || null;
  }
  
  /**
   * Check if instruction is an induction variable update
   */
  protected isInductionUpdate(inst: ILInstruction): boolean {
    // Look for INC, DEC, ADD #1, SUB #1 patterns
    if (inst.opcode === ILOpcode.INC || inst.opcode === ILOpcode.DEC) {
      return true;
    }
    
    if (inst.opcode === ILOpcode.ADD || inst.opcode === ILOpcode.SUB) {
      // Check for constant +1 or -1
      const operand = inst.operands[1];
      return operand?.kind === 'immediate' && 
             (operand.value === 1 || operand.value === -1);
    }
    
    return false;
  }
  
  /**
   * Find instructions that use induction variable for indexing
   */
  protected findIndexedInstructions(
    loop: LoopInfo,
    inductionVar: InductionVariable,
    context: SMCDetectionContext
  ): ILInstruction[] {
    const indexed: ILInstruction[] = [];
    
    for (const block of loop.blocks) {
      for (const inst of block.instructions) {
        // Look for load/store with indexed addressing
        if (this.usesVariableAsIndex(inst, inductionVar)) {
          indexed.push(inst);
        }
      }
    }
    
    return indexed;
  }
  
  /**
   * Compute confidence score for the pattern
   */
  protected computeConfidence(
    loop: LoopInfo,
    inductionVar: InductionVariable,
    indexedInstructions: ILInstruction[],
    iterationCount: number | 'dynamic'
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Higher confidence for known iteration count
    if (typeof iterationCount === 'number') {
      confidence += 0.2;
      
      // Optimal range for unrolling: 4-16 iterations
      if (iterationCount >= 4 && iterationCount <= 16) {
        confidence += 0.1;
      }
    }
    
    // More indexed instructions = more benefit
    if (indexedInstructions.length >= 2) {
      confidence += 0.1;
    }
    if (indexedInstructions.length >= 4) {
      confidence += 0.1;
    }
    
    // Penalty for nested loops (SMC more complex)
    if (loop.depth > 1) {
      confidence -= 0.1 * (loop.depth - 1);
    }
    
    // Penalty for multiple exit points
    if (loop.exits.length > 1) {
      confidence -= 0.1;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Check if instruction sequence matches loop counter pattern
   */
  matches(instructions: readonly ILInstruction[]): boolean {
    // Quick check for characteristic pattern
    // Looking for: indexed load/store + increment/decrement + conditional branch
    
    let hasIndexed = false;
    let hasInduction = false;
    let hasCondBranch = false;
    
    for (const inst of instructions) {
      if (this.isIndexedAccess(inst)) hasIndexed = true;
      if (this.isInductionUpdate(inst)) hasInduction = true;
      if (inst.opcode === ILOpcode.BR_COND) hasCondBranch = true;
    }
    
    return hasIndexed && hasInduction && hasCondBranch;
  }
  
  /**
   * Check if instruction uses indexed addressing
   */
  protected isIndexedAccess(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.LOAD && inst.opcode !== ILOpcode.STORE) {
      return false;
    }
    
    const addressMode = inst.metadata?.addressingMode;
    return addressMode === AddressingMode.ABSOLUTE_X ||
           addressMode === AddressingMode.ABSOLUTE_Y ||
           addressMode === AddressingMode.ZERO_PAGE_X ||
           addressMode === AddressingMode.ZERO_PAGE_Y;
  }
}
```

### Address Modification Detector

```typescript
/**
 * Detects patterns where base addresses can be modified at runtime
 * 
 * Useful for:
 * - Multi-dimensional array access
 * - Pointer chasing
 * - Dynamic buffer selection
 */
class AddressModificationDetector implements SMCPatternDetector {
  readonly category = SMCPatternCategory.ADDRESS_MODIFICATION;
  
  protected readonly config: SMCDetectionConfig;
  
  constructor(config: SMCDetectionConfig) {
    this.config = config;
  }
  
  /**
   * Detect address modification patterns
   */
  detect(context: SMCDetectionContext): SMCPattern[] {
    const patterns: SMCPattern[] = [];
    
    for (const block of context.cfg.blocks) {
      // Look for indirect addressing that could be replaced with SMC
      const candidates = this.findIndirectAccesses(block, context);
      
      for (const candidate of candidates) {
        const pattern = this.analyzeCandidate(candidate, context);
        if (pattern) {
          patterns.push(pattern);
        }
      }
    }
    
    return patterns;
  }
  
  /**
   * Find indirect memory accesses
   */
  protected findIndirectAccesses(
    block: BasicBlock,
    context: SMCDetectionContext
  ): IndirectAccessCandidate[] {
    const candidates: IndirectAccessCandidate[] = [];
    
    for (let i = 0; i < block.instructions.length; i++) {
      const inst = block.instructions[i];
      
      // Look for LDA/STA (indirect),Y or similar
      if (this.isIndirectAccess(inst)) {
        candidates.push({
          instruction: inst,
          index: i,
          block
        });
      }
      
      // Also look for computed address loads
      if (this.isComputedAddressLoad(inst, i, block, context)) {
        candidates.push({
          instruction: inst,
          index: i,
          block,
          computed: true
        });
      }
    }
    
    return candidates;
  }
  
  /**
   * Analyze if indirect access can be converted to SMC
   */
  protected analyzeCandidate(
    candidate: IndirectAccessCandidate,
    context: SMCDetectionContext
  ): SMCPattern | null {
    const inst = candidate.instruction;
    
    // Get the pointer variable being dereferenced
    const pointerVar = this.extractPointerVariable(inst, context);
    if (!pointerVar) return null;
    
    // Check how often the pointer changes
    const modificationFrequency = this.analyzeModificationFrequency(
      pointerVar, candidate.block, context
    );
    
    // SMC beneficial if pointer changes infrequently relative to accesses
    if (modificationFrequency === 'frequent') return null;
    
    // Calculate confidence
    const confidence = this.computeConfidence(
      candidate, pointerVar, modificationFrequency, context
    );
    
    if (confidence < this.config.minConfidence) return null;
    
    return {
      id: `addr_mod_${candidate.block.id}_${candidate.index}`,
      category: SMCPatternCategory.ADDRESS_MODIFICATION,
      instructions: [inst],
      block: candidate.block,
      location: inst.location,
      metadata: {
        kind: 'address_modification',
        baseAddress: this.extractBaseAddress(inst),
        offsetExpression: this.extractOffsetExpression(inst),
        targetOpcode: this.mapToM6502Opcode(inst),
        simulatedMode: AddressingMode.ABSOLUTE // Direct after SMC
      },
      confidence
    };
  }
  
  /**
   * Check if instruction uses indirect addressing
   */
  protected isIndirectAccess(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.LOAD && inst.opcode !== ILOpcode.STORE) {
      return false;
    }
    
    const mode = inst.metadata?.addressingMode;
    return mode === AddressingMode.INDIRECT_Y ||
           mode === AddressingMode.INDIRECT_X ||
           mode === AddressingMode.INDIRECT;
  }
  
  /**
   * Compute confidence for address modification pattern
   */
  protected computeConfidence(
    candidate: IndirectAccessCandidate,
    pointerVar: string,
    modFreq: 'rare' | 'occasional' | 'frequent',
    context: SMCDetectionContext
  ): number {
    let confidence = 0.4;
    
    // Higher confidence for rare modifications
    if (modFreq === 'rare') confidence += 0.3;
    else if (modFreq === 'occasional') confidence += 0.15;
    
    // Check if in a loop (more benefit)
    const inLoop = context.loopInfo.loops.some(
      loop => loop.blocks.includes(candidate.block)
    );
    if (inLoop) confidence += 0.2;
    
    // Multiple accesses through same pointer = more benefit
    const accessCount = this.countPointerAccesses(pointerVar, context);
    if (accessCount >= 3) confidence += 0.1;
    
    return Math.min(1, confidence);
  }
  
  matches(instructions: readonly ILInstruction[]): boolean {
    return instructions.some(i => this.isIndirectAccess(i));
  }
}
```

---

## Configuration

```typescript
/**
 * Configuration for SMC pattern detection
 */
interface SMCDetectionConfig {
  /** Minimum confidence score to report pattern (0.0 - 1.0) */
  minConfidence: number;
  
  /** Enabled pattern categories */
  enabledCategories: SMCPatternCategory[];
  
  /** Maximum iterations for loop unrolling consideration */
  maxUnrollIterations: number;
  
  /** Whether to consider nested loops */
  allowNestedLoops: boolean;
  
  /** Whether to use profile data for decisions */
  useProfileData: boolean;
  
  /** RAM regions where SMC is allowed */
  allowedRAMRegions: AddressRange[];
}

/**
 * Default configuration
 */
const DEFAULT_SMC_DETECTION_CONFIG: SMCDetectionConfig = {
  minConfidence: 0.5,
  enabledCategories: [
    SMCPatternCategory.LOOP_COUNTER,
    SMCPatternCategory.ADDRESS_MODIFICATION,
    SMCPatternCategory.COMPUTED_JUMP,
    SMCPatternCategory.CONSTANT_INJECTION
  ],
  maxUnrollIterations: 16,
  allowNestedLoops: false,
  useProfileData: true,
  allowedRAMRegions: [
    { start: 0x0800, end: 0x9FFF }, // BASIC area (if not used)
    { start: 0xC000, end: 0xCFFF }  // Upper RAM
  ]
};
```

---

## Blend65 Integration

### Attribute Hints

```js
// Enable SMC for specific function
@smc(allow)
function fastMemCopy(src: word, dst: word, len: byte): void {
    // SMC detection will prioritize this function
    for (let i: byte = 0; i < len; i++) {
        poke(dst + i, peek(src + i));
    }
}

// Disable SMC for safety-critical code
@smc(deny)
function safeRoutine(): void {
    // No SMC will be applied here
}

// Specify SMC category preference
@smc(prefer: loop_unroll)
function processTable(): void {
    for (let i: byte = 0; i < 16; i++) {
        process(table[i]);
    }
}
```

### Example Patterns

```js
// Pattern 1: Loop counter - High confidence
function clearScreen(): void {
    for (let i: word = 0; i < 1000; i++) {
        poke($0400 + i, 32);  // Space character
    }
}
// Detected: LOOP_COUNTER pattern, confidence 0.85

// Pattern 2: Address modification - Medium confidence  
function drawSprite(addr: word): void {
    for (let y: byte = 0; y < 21; y++) {
        let row = peek(addr + y);
        // ... use row
    }
}
// Detected: ADDRESS_MODIFICATION pattern, confidence 0.65

// Pattern 3: Jump table - High confidence
function dispatch(cmd: byte): void {
    switch (cmd) {
        case 0: handleMove(); break;
        case 1: handleFire(); break;
        case 2: handleJump(); break;
        // ... more cases
    }
}
// Detected: COMPUTED_JUMP pattern, confidence 0.80
```

---

## Test Requirements

| Test Category | Test Cases | Description |
|--------------|------------|-------------|
| Loop Counter Detection | 8 | Simple loops, nested loops, complex bounds |
| Address Modification | 6 | Indirect access, pointer arrays, multi-dim |
| Computed Jump | 5 | Switch statements, dispatch tables |
| Constant Injection | 4 | Runtime constants, configuration values |
| Confidence Scoring | 4 | Threshold behavior, scoring factors |
| Configuration | 3 | Enable/disable categories, RAM regions |

**Total: ~30 tests**

---

## Task Checklist

- [ ] Define SMCPatternCategory enum
- [ ] Define SMCPattern interface and metadata types
- [ ] Implement SMCPatternDetectionPass class
- [ ] Implement LoopCounterDetector
- [ ] Implement AddressModificationDetector  
- [ ] Implement ComputedJumpDetector
- [ ] Implement ConstantInjectionDetector
- [ ] Add configuration options
- [ ] Create unit tests for each detector
- [ ] Integration tests with full analysis pipeline

---

## Next Document

**10-01a2-smc-opportunity-id.md** - SMC opportunity identification and ranking