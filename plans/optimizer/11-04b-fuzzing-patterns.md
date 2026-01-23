# 11-04b: Pattern Fuzzer

> **Document ID**: 11-04b-fuzzing-patterns
> **Phase**: 11 - Testing Framework
> **Task**: 11.4b - Pattern fuzzer
> **Priority**: High
> **Estimated LOC**: 300-350

---

## Overview

This document specifies a specialized fuzzer for peephole patterns. It generates 6502 instruction sequences and tests pattern matching, transformation correctness, and semantic preservation.

### Goals

1. Fuzz peephole pattern matching
2. Test pattern transformation correctness
3. Find pattern ordering issues
4. Discover missed optimization opportunities
5. Verify semantic equivalence after transformation

---

## Type Definitions

```typescript
/**
 * Pattern fuzzer configuration
 */
interface PatternFuzzerConfig {
  /** Random seed */
  seed: number;
  /** Maximum instructions per sequence */
  maxInstructions: number;
  /** Instruction distribution */
  distribution: InstructionCategoryDistribution;
  /** Patterns to test (null = all) */
  patterns: string[] | null;
  /** Enable semantic validation */
  validateSemantics: boolean;
  /** Test pattern ordering */
  testOrdering: boolean;
}

/**
 * 6502 instruction categories
 */
interface InstructionCategoryDistribution {
  load: number;        // LDA, LDX, LDY
  store: number;       // STA, STX, STY
  transfer: number;    // TAX, TXA, TAY, TYA, TXS, TSX
  arithmetic: number;  // ADC, SBC, INC, DEC, INX, DEX, INY, DEY
  logical: number;     // AND, ORA, EOR
  shift: number;       // ASL, LSR, ROL, ROR
  compare: number;     // CMP, CPX, CPY
  branch: number;      // BEQ, BNE, BCS, BCC, BMI, BPL, BVS, BVC
  jump: number;        // JMP, JSR, RTS
  flag: number;        // CLC, SEC, CLI, SEI, CLV, CLD, SED
  stack: number;       // PHA, PLA, PHP, PLP
  nop: number;         // NOP, BRK, BIT
}

/**
 * Pattern fuzz result
 */
interface PatternFuzzResult {
  testId: string;
  seed: number;
  sequence: Asm6502Instruction[];
  patternsMatched: string[];
  transformations: PatternTransformation[];
  outcome: PatternFuzzOutcome;
  error?: Error;
}

type PatternFuzzOutcome =
  | 'pass'                  // All transformations correct
  | 'invalid_match'         // Pattern matched incorrectly
  | 'invalid_transform'     // Transformation produced invalid code
  | 'semantic_change'       // Semantics changed
  | 'ordering_issue'        // Pattern ordering caused problem
  | 'crash';                // Pattern threw exception

/**
 * Transformation record
 */
interface PatternTransformation {
  patternId: string;
  input: Asm6502Instruction[];
  output: Asm6502Instruction[];
  cycleSaved: number;
  bytesSaved: number;
}

/**
 * 6502 instruction
 */
interface Asm6502Instruction {
  opcode: string;
  addressingMode: AddressingMode;
  operand?: number | string;
}

type AddressingMode =
  | 'implied'
  | 'immediate'
  | 'zeropage'
  | 'zeropage_x'
  | 'zeropage_y'
  | 'absolute'
  | 'absolute_x'
  | 'absolute_y'
  | 'indirect'
  | 'indirect_x'
  | 'indirect_y'
  | 'relative';
```

---

## Implementation

### Pattern Fuzzer

```typescript
/**
 * Fuzzer specialized for peephole patterns
 */
export class PatternFuzzer {
  protected rng: SeededRandom;
  protected config: PatternFuzzerConfig;
  protected matcher: PatternMatcher;
  protected analyzer: SemanticAnalyzer;
  
  constructor(config: PatternFuzzerConfig) {
    this.config = config;
    this.rng = new SeededRandom(config.seed);
    this.matcher = new PatternMatcher();
    this.analyzer = new SemanticAnalyzer();
  }
  
  /**
   * Run pattern fuzzing campaign
   */
  async runCampaign(iterations: number): Promise<PatternFuzzCampaignResult> {
    const results: PatternFuzzResult[] = [];
    const patternCoverage = new Map<string, number>();
    
    for (let i = 0; i < iterations; i++) {
      const result = this.fuzzOnce(i);
      results.push(result);
      
      // Track pattern coverage
      for (const pattern of result.patternsMatched) {
        patternCoverage.set(pattern, (patternCoverage.get(pattern) || 0) + 1);
      }
    }
    
    return {
      totalTests: iterations,
      passed: results.filter(r => r.outcome === 'pass').length,
      failures: results.filter(r => r.outcome !== 'pass'),
      patternCoverage,
      untestedPatterns: this.findUntestedPatterns(patternCoverage)
    };
  }
  
  /**
   * Single fuzz iteration
   */
  protected fuzzOnce(iteration: number): PatternFuzzResult {
    const testId = `pattern_fuzz_${this.config.seed}_${iteration}`;
    const sequence = this.generateSequence();
    
    try {
      // Run pattern matching
      const matchResult = this.matcher.findMatches(sequence);
      const patternsMatched = matchResult.matches.map(m => m.patternId);
      
      // Apply transformations
      const transformations: PatternTransformation[] = [];
      let current = [...sequence];
      
      for (const match of matchResult.matches) {
        const transformed = this.matcher.applyTransformation(current, match);
        transformations.push({
          patternId: match.patternId,
          input: current.slice(match.startIndex, match.endIndex),
          output: transformed.slice(match.startIndex, match.startIndex + match.replacementLength),
          cycleSaved: this.calculateCycleDiff(current, transformed),
          bytesSaved: this.calculateSizeDiff(current, transformed)
        });
        current = transformed;
      }
      
      // Validate transformation
      const outcome = this.validateTransformations(sequence, current, transformations);
      
      return {
        testId,
        seed: this.config.seed,
        sequence,
        patternsMatched,
        transformations,
        outcome
      };
    } catch (error) {
      return {
        testId,
        seed: this.config.seed,
        sequence,
        patternsMatched: [],
        transformations: [],
        outcome: 'crash',
        error: error as Error
      };
    }
  }
  
  /**
   * Generate random instruction sequence
   */
  protected generateSequence(): Asm6502Instruction[] {
    const length = this.rng.int(2, this.config.maxInstructions);
    const sequence: Asm6502Instruction[] = [];
    
    for (let i = 0; i < length; i++) {
      sequence.push(this.generateInstruction());
    }
    
    return sequence;
  }
  
  /**
   * Generate random 6502 instruction
   */
  protected generateInstruction(): Asm6502Instruction {
    const category = this.selectCategory();
    
    switch (category) {
      case 'load':
        return this.generateLoadInstruction();
      case 'store':
        return this.generateStoreInstruction();
      case 'transfer':
        return this.generateTransferInstruction();
      case 'arithmetic':
        return this.generateArithmeticInstruction();
      case 'logical':
        return this.generateLogicalInstruction();
      case 'shift':
        return this.generateShiftInstruction();
      case 'compare':
        return this.generateCompareInstruction();
      case 'branch':
        return this.generateBranchInstruction();
      case 'jump':
        return this.generateJumpInstruction();
      case 'flag':
        return this.generateFlagInstruction();
      case 'stack':
        return this.generateStackInstruction();
      case 'nop':
        return this.generateNopInstruction();
      default:
        return { opcode: 'NOP', addressingMode: 'implied' };
    }
  }
  
  /**
   * Generate load instruction
   */
  protected generateLoadInstruction(): Asm6502Instruction {
    const opcode = this.rng.pick(['LDA', 'LDX', 'LDY']);
    const mode = this.selectAddressingMode(opcode);
    return { opcode, addressingMode: mode, operand: this.generateOperand(mode) };
  }
  
  /**
   * Generate store instruction
   */
  protected generateStoreInstruction(): Asm6502Instruction {
    const opcode = this.rng.pick(['STA', 'STX', 'STY']);
    const mode = this.selectAddressingMode(opcode);
    return { opcode, addressingMode: mode, operand: this.generateOperand(mode) };
  }
  
  /**
   * Generate transfer instruction
   */
  protected generateTransferInstruction(): Asm6502Instruction {
    const opcode = this.rng.pick(['TAX', 'TXA', 'TAY', 'TYA', 'TXS', 'TSX']);
    return { opcode, addressingMode: 'implied' };
  }
  
  /**
   * Generate arithmetic instruction
   */
  protected generateArithmeticInstruction(): Asm6502Instruction {
    const opcode = this.rng.pick(['ADC', 'SBC', 'INC', 'DEC', 'INX', 'DEX', 'INY', 'DEY']);
    
    if (['INX', 'DEX', 'INY', 'DEY'].includes(opcode)) {
      return { opcode, addressingMode: 'implied' };
    }
    
    const mode = this.selectAddressingMode(opcode);
    return { opcode, addressingMode: mode, operand: this.generateOperand(mode) };
  }
  
  /**
   * Generate logical instruction
   */
  protected generateLogicalInstruction(): Asm6502Instruction {
    const opcode = this.rng.pick(['AND', 'ORA', 'EOR']);
    const mode = this.selectAddressingMode(opcode);
    return { opcode, addressingMode: mode, operand: this.generateOperand(mode) };
  }
  
  /**
   * Generate shift instruction
   */
  protected generateShiftInstruction(): Asm6502Instruction {
    const opcode = this.rng.pick(['ASL', 'LSR', 'ROL', 'ROR']);
    const mode = this.rng.pick(['implied', 'zeropage', 'zeropage_x', 'absolute']);
    
    if (mode === 'implied') {
      return { opcode, addressingMode: 'implied' };
    }
    
    return { opcode, addressingMode: mode as AddressingMode, operand: this.generateOperand(mode as AddressingMode) };
  }
  
  /**
   * Generate compare instruction
   */
  protected generateCompareInstruction(): Asm6502Instruction {
    const opcode = this.rng.pick(['CMP', 'CPX', 'CPY']);
    const mode = this.selectAddressingMode(opcode);
    return { opcode, addressingMode: mode, operand: this.generateOperand(mode) };
  }
  
  /**
   * Generate branch instruction
   */
  protected generateBranchInstruction(): Asm6502Instruction {
    const opcode = this.rng.pick(['BEQ', 'BNE', 'BCS', 'BCC', 'BMI', 'BPL', 'BVS', 'BVC']);
    return { opcode, addressingMode: 'relative', operand: `label_${this.rng.int(0, 10)}` };
  }
  
  /**
   * Generate jump instruction
   */
  protected generateJumpInstruction(): Asm6502Instruction {
    const opcode = this.rng.pick(['JMP', 'JSR', 'RTS']);
    
    if (opcode === 'RTS') {
      return { opcode, addressingMode: 'implied' };
    }
    
    const mode = opcode === 'JMP' && this.rng.bool() ? 'indirect' : 'absolute';
    return { opcode, addressingMode: mode, operand: this.rng.int(0x0800, 0xFFFF) };
  }
  
  /**
   * Generate flag instruction
   */
  protected generateFlagInstruction(): Asm6502Instruction {
    const opcode = this.rng.pick(['CLC', 'SEC', 'CLI', 'SEI', 'CLV', 'CLD', 'SED']);
    return { opcode, addressingMode: 'implied' };
  }
  
  /**
   * Generate stack instruction
   */
  protected generateStackInstruction(): Asm6502Instruction {
    const opcode = this.rng.pick(['PHA', 'PLA', 'PHP', 'PLP']);
    return { opcode, addressingMode: 'implied' };
  }
  
  /**
   * Generate NOP/misc instruction
   */
  protected generateNopInstruction(): Asm6502Instruction {
    const opcode = this.rng.pick(['NOP', 'BIT']);
    
    if (opcode === 'NOP') {
      return { opcode, addressingMode: 'implied' };
    }
    
    const mode = this.rng.pick(['zeropage', 'absolute']);
    return { opcode, addressingMode: mode as AddressingMode, operand: this.generateOperand(mode as AddressingMode) };
  }
  
  /**
   * Select addressing mode
   */
  protected selectAddressingMode(opcode: string): AddressingMode {
    const modes = this.getValidModes(opcode);
    return this.rng.pick(modes);
  }
  
  /**
   * Get valid addressing modes for opcode
   */
  protected getValidModes(opcode: string): AddressingMode[] {
    const modeMap: Record<string, AddressingMode[]> = {
      'LDA': ['immediate', 'zeropage', 'zeropage_x', 'absolute', 'absolute_x', 'absolute_y', 'indirect_x', 'indirect_y'],
      'LDX': ['immediate', 'zeropage', 'zeropage_y', 'absolute', 'absolute_y'],
      'LDY': ['immediate', 'zeropage', 'zeropage_x', 'absolute', 'absolute_x'],
      'STA': ['zeropage', 'zeropage_x', 'absolute', 'absolute_x', 'absolute_y', 'indirect_x', 'indirect_y'],
      'STX': ['zeropage', 'zeropage_y', 'absolute'],
      'STY': ['zeropage', 'zeropage_x', 'absolute'],
      'ADC': ['immediate', 'zeropage', 'zeropage_x', 'absolute', 'absolute_x', 'absolute_y', 'indirect_x', 'indirect_y'],
      'SBC': ['immediate', 'zeropage', 'zeropage_x', 'absolute', 'absolute_x', 'absolute_y', 'indirect_x', 'indirect_y'],
      'AND': ['immediate', 'zeropage', 'zeropage_x', 'absolute', 'absolute_x', 'absolute_y', 'indirect_x', 'indirect_y'],
      'ORA': ['immediate', 'zeropage', 'zeropage_x', 'absolute', 'absolute_x', 'absolute_y', 'indirect_x', 'indirect_y'],
      'EOR': ['immediate', 'zeropage', 'zeropage_x', 'absolute', 'absolute_x', 'absolute_y', 'indirect_x', 'indirect_y'],
      'CMP': ['immediate', 'zeropage', 'zeropage_x', 'absolute', 'absolute_x', 'absolute_y', 'indirect_x', 'indirect_y'],
      'CPX': ['immediate', 'zeropage', 'absolute'],
      'CPY': ['immediate', 'zeropage', 'absolute'],
      'INC': ['zeropage', 'zeropage_x', 'absolute', 'absolute_x'],
      'DEC': ['zeropage', 'zeropage_x', 'absolute', 'absolute_x']
    };
    
    return modeMap[opcode] || ['immediate'];
  }
  
  /**
   * Generate operand for mode
   */
  protected generateOperand(mode: AddressingMode): number | string {
    switch (mode) {
      case 'immediate':
        return this.rng.int(0, 255);
      case 'zeropage':
      case 'zeropage_x':
      case 'zeropage_y':
        return this.rng.int(0, 255);
      case 'absolute':
      case 'absolute_x':
      case 'absolute_y':
        return this.rng.int(0x0100, 0xFFFF);
      case 'indirect':
        return this.rng.int(0x0100, 0xFFFF);
      case 'indirect_x':
      case 'indirect_y':
        return this.rng.int(0, 255);
      case 'relative':
        return `label_${this.rng.int(0, 10)}`;
      default:
        return 0;
    }
  }
  
  /**
   * Select instruction category
   */
  protected selectCategory(): keyof InstructionCategoryDistribution {
    const dist = this.config.distribution;
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    const r = this.rng.float() * total;
    
    let cumulative = 0;
    for (const [cat, weight] of Object.entries(dist)) {
      cumulative += weight;
      if (r <= cumulative) {
        return cat as keyof InstructionCategoryDistribution;
      }
    }
    
    return 'nop';
  }
  
  /**
   * Validate transformations
   */
  protected validateTransformations(
    original: Asm6502Instruction[],
    transformed: Asm6502Instruction[],
    transformations: PatternTransformation[]
  ): PatternFuzzOutcome {
    // Check all transformed instructions are valid
    for (const instr of transformed) {
      if (!this.isValidInstruction(instr)) {
        return 'invalid_transform';
      }
    }
    
    // Check semantic equivalence if enabled
    if (this.config.validateSemantics) {
      const originalEffect = this.analyzer.analyze(original);
      const transformedEffect = this.analyzer.analyze(transformed);
      
      if (!this.effectsEquivalent(originalEffect, transformedEffect)) {
        return 'semantic_change';
      }
    }
    
    // Check pattern ordering if enabled
    if (this.config.testOrdering && transformations.length > 1) {
      const orderingIssue = this.checkOrderingIssue(original, transformations);
      if (orderingIssue) {
        return 'ordering_issue';
      }
    }
    
    return 'pass';
  }
  
  /**
   * Check if instruction is valid
   */
  protected isValidInstruction(instr: Asm6502Instruction): boolean {
    const validOpcodes = new Set([
      'LDA', 'LDX', 'LDY', 'STA', 'STX', 'STY',
      'TAX', 'TXA', 'TAY', 'TYA', 'TXS', 'TSX',
      'ADC', 'SBC', 'INC', 'DEC', 'INX', 'DEX', 'INY', 'DEY',
      'AND', 'ORA', 'EOR',
      'ASL', 'LSR', 'ROL', 'ROR',
      'CMP', 'CPX', 'CPY',
      'BEQ', 'BNE', 'BCS', 'BCC', 'BMI', 'BPL', 'BVS', 'BVC',
      'JMP', 'JSR', 'RTS', 'RTI', 'BRK',
      'CLC', 'SEC', 'CLI', 'SEI', 'CLV', 'CLD', 'SED',
      'PHA', 'PLA', 'PHP', 'PLP',
      'NOP', 'BIT'
    ]);
    
    return validOpcodes.has(instr.opcode);
  }
  
  /**
   * Check if effects are equivalent
   */
  protected effectsEquivalent(a: SemanticEffect, b: SemanticEffect): boolean {
    // Compare register effects
    if (a.accumulator !== b.accumulator) return false;
    if (a.xRegister !== b.xRegister) return false;
    if (a.yRegister !== b.yRegister) return false;
    
    // Compare memory effects
    if (a.memoryWrites.size !== b.memoryWrites.size) return false;
    for (const [addr, val] of a.memoryWrites) {
      if (b.memoryWrites.get(addr) !== val) return false;
    }
    
    return true;
  }
  
  /**
   * Check for ordering issues
   */
  protected checkOrderingIssue(
    original: Asm6502Instruction[],
    transformations: PatternTransformation[]
  ): boolean {
    // Check if different ordering would yield better results
    // (simplified - just check if patterns conflict)
    for (let i = 0; i < transformations.length - 1; i++) {
      const t1 = transformations[i];
      const t2 = transformations[i + 1];
      
      // Check for overlapping ranges
      if (t1.patternId !== t2.patternId) {
        // Patterns could interact - flag for review
        return false;
      }
    }
    
    return false;
  }
  
  /**
   * Calculate cycle difference
   */
  protected calculateCycleDiff(a: Asm6502Instruction[], b: Asm6502Instruction[]): number {
    return this.countCycles(a) - this.countCycles(b);
  }
  
  /**
   * Calculate size difference
   */
  protected calculateSizeDiff(a: Asm6502Instruction[], b: Asm6502Instruction[]): number {
    return this.countBytes(a) - this.countBytes(b);
  }
  
  /**
   * Count cycles
   */
  protected countCycles(seq: Asm6502Instruction[]): number {
    let total = 0;
    for (const instr of seq) {
      total += this.getInstructionCycles(instr);
    }
    return total;
  }
  
  /**
   * Count bytes
   */
  protected countBytes(seq: Asm6502Instruction[]): number {
    let total = 0;
    for (const instr of seq) {
      total += this.getInstructionSize(instr);
    }
    return total;
  }
  
  /**
   * Get instruction cycles
   */
  protected getInstructionCycles(instr: Asm6502Instruction): number {
    // Simplified cycle counts
    const baseCycles: Record<AddressingMode, number> = {
      'implied': 2,
      'immediate': 2,
      'zeropage': 3,
      'zeropage_x': 4,
      'zeropage_y': 4,
      'absolute': 4,
      'absolute_x': 4,
      'absolute_y': 4,
      'indirect': 5,
      'indirect_x': 6,
      'indirect_y': 5,
      'relative': 2
    };
    return baseCycles[instr.addressingMode] || 2;
  }
  
  /**
   * Get instruction size
   */
  protected getInstructionSize(instr: Asm6502Instruction): number {
    const sizes: Record<AddressingMode, number> = {
      'implied': 1,
      'immediate': 2,
      'zeropage': 2,
      'zeropage_x': 2,
      'zeropage_y': 2,
      'absolute': 3,
      'absolute_x': 3,
      'absolute_y': 3,
      'indirect': 3,
      'indirect_x': 2,
      'indirect_y': 2,
      'relative': 2
    };
    return sizes[instr.addressingMode] || 1;
  }
  
  /**
   * Find untested patterns
   */
  protected findUntestedPatterns(coverage: Map<string, number>): string[] {
    const allPatterns = this.config.patterns || this.matcher.getAllPatternIds();
    return allPatterns.filter(p => !coverage.has(p));
  }
}
```

---

## Usage Examples

```typescript
// Configure pattern fuzzer
const fuzzer = new PatternFuzzer({
  seed: 54321,
  maxInstructions: 8,
  distribution: {
    load: 20,
    store: 15,
    transfer: 15,
    arithmetic: 15,
    logical: 10,
    shift: 5,
    compare: 5,
    branch: 5,
    jump: 2,
    flag: 5,
    stack: 2,
    nop: 1
  },
  patterns: null, // Test all patterns
  validateSemantics: true,
  testOrdering: true
});

// Run campaign
const result = await fuzzer.runCampaign(5000);

console.log(`Pattern coverage: ${result.patternCoverage.size} patterns`);
console.log(`Untested: ${result.untestedPatterns.join(', ')}`);
```

---

## Test Requirements

| Test Case | Description | Status |
|-----------|-------------|--------|
| pattern-basic-fuzz | Basic fuzzing works | ⏳ |
| pattern-coverage | All patterns tested | ⏳ |
| pattern-semantic | Semantics preserved | ⏳ |
| pattern-ordering | Ordering tested | ⏳ |
| pattern-valid-6502 | All output valid | ⏳ |

---

## Task Checklist

- [ ] 11.4b.1: Implement `PatternFuzzer` core
- [ ] 11.4b.2: Implement 6502 instruction generators
- [ ] 11.4b.3: Add semantic validation
- [ ] 11.4b.4: Add pattern coverage tracking
- [ ] 11.4b.5: Write unit tests

---

## References

- `11-04a-fuzzing-il.md`, `08-01-pattern-framework.md`, `08-02-pattern-matcher.md`