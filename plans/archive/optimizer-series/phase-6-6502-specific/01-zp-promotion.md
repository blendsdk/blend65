# Phase 6.1: Zero-Page Promotion

> **Phase**: 6.1  
> **Parent**: [Phase 6 Index](00-phase-index.md)  
> **Est. Lines**: ~350  
> **Focus**: Promote hot variables to zero-page for smaller/faster code

---

## Overview

Zero-page ($00-$FF) is the most valuable memory on the 6502. Zero-page instructions are:
- **Shorter**: 2 bytes vs 3 bytes for absolute addressing
- **Faster**: 3 cycles vs 4 cycles (1 cycle saved per access!)
- **Required**: For indirect addressing modes `LDA ($50),Y`

This pass analyzes variable access patterns and promotes the hottest variables to available zero-page locations.

---

## Why Zero-Page Matters

### Instruction Size Comparison

| Addressing Mode | Example | Bytes | Cycles |
|-----------------|---------|-------|--------|
| Zero-page | `LDA $50` | 2 | 3 |
| Absolute | `LDA $0400` | 3 | 4 |
| Zero-page,X | `LDA $50,X` | 2 | 4 |
| Absolute,X | `LDA $0400,X` | 3 | 4+ |
| Indirect | `LDA ($50),Y` | 2 | 5+ |

**Key Insight**: Every zero-page access saves 1 byte and often 1 cycle.

### Real-World Impact

```asm
; Hot loop - 1000 iterations
.loop:
    LDA counter         ; $0400 = 4 cycles × 1000 = 4000 cycles
    CLC
    ADC #1
    STA counter         ; $0400 = 4 cycles × 1000 = 4000 cycles
    BNE .loop
    
; With ZP promotion (counter at $50):
.loop:
    LDA counter         ; $50 = 3 cycles × 1000 = 3000 cycles (-1000!)
    CLC
    ADC #1
    STA counter         ; $50 = 3 cycles × 1000 = 3000 cycles (-1000!)
    BNE .loop
    
; Total: 2000 cycles saved for ONE variable in ONE loop!
```

---

## Architecture

### Pass Structure

```typescript
/**
 * Zero-Page Promotion Pass
 * 
 * Analyzes variable access patterns and promotes frequently-accessed
 * variables to zero-page locations for smaller/faster code.
 * 
 * Dependencies:
 * - Use-def analysis (access frequency counting)
 * - Liveness analysis (variable lifetime overlap)
 */
export class ZeroPagePromotionPass implements Pass<AsmProgram> {
  readonly name = 'zero-page-promotion';
  readonly dependencies = ['use-def-asm', 'liveness-asm'];
  
  /**
   * Available zero-page locations for promotion.
   * C64-specific: $02-$8F is generally safe (142 bytes).
   */
  protected availableZP: Set<number>;
  
  /**
   * Track which variables are promoted and where.
   */
  protected promotionMap: Map<string, number>;
  
  run(program: AsmProgram, context: PassContext): AsmProgram {
    // 1. Collect variable access statistics
    const stats = this.collectAccessStats(program, context);
    
    // 2. Rank variables by hotness
    const ranked = this.rankByHotness(stats);
    
    // 3. Allocate ZP space to hottest variables
    const assignments = this.allocateZeroPage(ranked);
    
    // 4. Rewrite all references
    return this.rewriteReferences(program, assignments);
  }
}
```

### Access Statistics

```typescript
/**
 * Statistics about variable access patterns.
 */
interface VariableAccessStats {
  /** Variable identifier (label or address) */
  name: string;
  
  /** Current address (if known) */
  currentAddress?: number;
  
  /** Size in bytes */
  size: number;
  
  /** Total access count (loads + stores) */
  accessCount: number;
  
  /** Load count */
  loadCount: number;
  
  /** Store count */
  storeCount: number;
  
  /** Access inside loops (weighted higher) */
  loopAccessCount: number;
  
  /** Loop nesting depth for weighting */
  maxLoopDepth: number;
  
  /** Whether indirect addressing is used */
  usedIndirect: boolean;
  
  /** Computed hotness score */
  hotnessScore: number;
}
```

### Hotness Calculation

```typescript
/**
 * Calculate variable hotness score for promotion priority.
 * 
 * Factors:
 * - Access frequency
 * - Loop depth (×10 per nesting level)
 * - Indirect usage (requires ZP, highest priority)
 * - Code size savings (based on access count)
 */
protected calculateHotness(stats: VariableAccessStats): number {
  let score = 0;
  
  // Base score: raw access count
  score += stats.accessCount;
  
  // Loop weight: accesses in loops are MUCH hotter
  // Assume 100 iterations average
  const loopMultiplier = Math.pow(100, stats.maxLoopDepth);
  score += stats.loopAccessCount * loopMultiplier;
  
  // Indirect usage: MUST be in ZP, give very high priority
  if (stats.usedIndirect) {
    score += 1_000_000;  // Prioritize over everything
  }
  
  // Size weight: larger savings for more accesses
  // Each access saves 1 byte (3→2)
  score += stats.accessCount;  // byte savings
  
  return score;
}
```

---

## Zero-Page Map (C64)

### Available Regions

```typescript
/**
 * C64 Zero-Page memory map.
 * 
 * SAFE for Blend65:
 * - $02-$8F: 142 bytes, generally free
 * 
 * RESERVED (avoid by default):
 * - $00-$01: CPU port, I/O direction
 * - $90-$FF: Kernel/BASIC workspace
 * 
 * CONDITIONAL (usable if BASIC/Kernel disabled):
 * - $90-$FA: BASIC workspace
 * - $FB-$FE: Kernel workspace
 */
export const C64_ZP_REGIONS = {
  // Absolutely reserved - never use
  CPU_PORT: { start: 0x00, end: 0x01 },
  
  // Safe for Blend65 programs
  SAFE: { start: 0x02, end: 0x8F },  // 142 bytes
  
  // Usable with BASIC disabled
  BASIC_WORKSPACE: { start: 0x90, end: 0xFA },  // 107 bytes
  
  // Usable with Kernel disabled
  KERNEL_WORKSPACE: { start: 0xFB, end: 0xFE },  // 4 bytes
  
  // Vector - never use
  VECTORS: { start: 0xFF, end: 0xFF },
};

/**
 * Default available ZP for safe programs.
 */
export const DEFAULT_AVAILABLE_ZP = new Set(
  Array.from({ length: 0x8F - 0x02 + 1 }, (_, i) => i + 0x02)
);  // $02-$8F = 142 bytes
```

### ZP Allocation Strategy

```typescript
/**
 * ZP allocation strategy.
 * 
 * Goals:
 * 1. Maximize coverage of hot variables
 * 2. Respect size requirements (word = 2 consecutive bytes)
 * 3. Allow compiler-reserved slots
 */
interface ZPAllocationConfig {
  /** Available ZP bytes */
  availableRange: { start: number; end: number };
  
  /** Reserved for compiler temporaries */
  compilerReserved: number[];  // e.g., [$02, $03, $04, $05] for scratch
  
  /** Reserved for specific purposes */
  purposeReserved: Map<string, number>;  // e.g., 'ptr1' → $FB
  
  /** Allow multi-byte allocations */
  allowMultiByte: boolean;
}

/**
 * Default config for Blend65.
 */
export const DEFAULT_ZP_CONFIG: ZPAllocationConfig = {
  availableRange: { start: 0x02, end: 0x8F },
  compilerReserved: [0x02, 0x03, 0x04, 0x05],  // 4 scratch bytes
  purposeReserved: new Map([
    ['ptr1', 0xFB],  // Pointer 1 (2 bytes)
    ['ptr2', 0xFD],  // Pointer 2 (2 bytes)
  ]),
  allowMultiByte: true,
};
```

---

## Pass Implementation

### Step 1: Collect Access Statistics

```typescript
/**
 * Collect access statistics for all variables.
 */
protected collectAccessStats(
  program: AsmProgram,
  context: PassContext
): Map<string, VariableAccessStats> {
  const stats = new Map<string, VariableAccessStats>();
  
  // Get loop information for weighting
  const loopInfo = context.getAnalysis<LoopInfo>('loop-analysis');
  
  for (const block of program.blocks) {
    const loopDepth = loopInfo?.getDepth(block.label) ?? 0;
    
    for (const inst of block.instructions) {
      // Check for memory operand
      const memOp = this.extractMemoryOperand(inst);
      if (!memOp) continue;
      
      // Get or create stats entry
      let varStats = stats.get(memOp.name);
      if (!varStats) {
        varStats = this.createEmptyStats(memOp.name, memOp.size);
        stats.set(memOp.name, varStats);
      }
      
      // Update counts
      varStats.accessCount++;
      
      if (this.isLoad(inst)) {
        varStats.loadCount++;
      } else if (this.isStore(inst)) {
        varStats.storeCount++;
      }
      
      // Loop weighting
      if (loopDepth > 0) {
        varStats.loopAccessCount++;
        varStats.maxLoopDepth = Math.max(varStats.maxLoopDepth, loopDepth);
      }
      
      // Check indirect usage
      if (this.isIndirectAccess(inst)) {
        varStats.usedIndirect = true;
      }
    }
  }
  
  // Calculate hotness scores
  for (const varStats of stats.values()) {
    varStats.hotnessScore = this.calculateHotness(varStats);
  }
  
  return stats;
}
```

### Step 2: Rank Variables

```typescript
/**
 * Rank variables by hotness for promotion priority.
 */
protected rankByHotness(
  stats: Map<string, VariableAccessStats>
): VariableAccessStats[] {
  return Array.from(stats.values())
    .filter(s => s.accessCount > 0)  // Only accessed variables
    .filter(s => !this.isAlreadyZP(s))  // Not already in ZP
    .filter(s => this.canPromote(s))  // Can be promoted
    .sort((a, b) => b.hotnessScore - a.hotnessScore);  // Highest first
}

/**
 * Check if variable is already in zero-page.
 */
protected isAlreadyZP(stats: VariableAccessStats): boolean {
  if (stats.currentAddress === undefined) return false;
  return stats.currentAddress >= 0x00 && stats.currentAddress <= 0xFF;
}

/**
 * Check if variable can be promoted.
 * Some variables cannot be promoted (hardware, external, etc.)
 */
protected canPromote(stats: VariableAccessStats): boolean {
  // Cannot promote hardware registers
  if (this.isHardwareAddress(stats.currentAddress)) return false;
  
  // Cannot promote if used in indirect and not pointer-sized
  if (stats.usedIndirect && stats.size !== 2) return false;
  
  return true;
}
```

### Step 3: Allocate Zero-Page

```typescript
/**
 * Allocate ZP addresses to ranked variables.
 */
protected allocateZeroPage(
  ranked: VariableAccessStats[]
): Map<string, number> {
  const assignments = new Map<string, number>();
  const used = new Set(this.config.compilerReserved);
  
  // Add purpose-reserved addresses
  for (const addr of this.config.purposeReserved.values()) {
    used.add(addr);
    if (this.config.allowMultiByte) {
      used.add(addr + 1);  // Reserve second byte for pointers
    }
  }
  
  const { start, end } = this.config.availableRange;
  
  for (const varStats of ranked) {
    // Find contiguous space
    const slot = this.findSlot(start, end, varStats.size, used);
    
    if (slot === null) {
      // No more ZP space available
      break;
    }
    
    // Assign
    assignments.set(varStats.name, slot);
    
    // Mark as used
    for (let i = 0; i < varStats.size; i++) {
      used.add(slot + i);
    }
  }
  
  return assignments;
}

/**
 * Find contiguous slot of given size.
 */
protected findSlot(
  start: number,
  end: number,
  size: number,
  used: Set<number>
): number | null {
  for (let addr = start; addr <= end - size + 1; addr++) {
    let fits = true;
    for (let i = 0; i < size; i++) {
      if (used.has(addr + i)) {
        fits = false;
        break;
      }
    }
    if (fits) return addr;
  }
  return null;
}
```

### Step 4: Rewrite References

```typescript
/**
 * Rewrite all variable references to use ZP addresses.
 */
protected rewriteReferences(
  program: AsmProgram,
  assignments: Map<string, number>
): AsmProgram {
  if (assignments.size === 0) {
    return program;  // Nothing to promote
  }
  
  // Track statistics for optimization report
  let bytesReduced = 0;
  let cyclesSaved = 0;
  
  const newBlocks = program.blocks.map(block => ({
    ...block,
    instructions: block.instructions.map(inst => {
      const rewritten = this.rewriteInstruction(inst, assignments);
      
      if (rewritten !== inst) {
        // Calculate savings
        bytesReduced += this.byteDifference(inst, rewritten);
        cyclesSaved += this.cycleDifference(inst, rewritten);
      }
      
      return rewritten;
    }),
  }));
  
  // Report savings
  if (bytesReduced > 0 || cyclesSaved > 0) {
    this.context.report({
      type: 'optimization',
      pass: this.name,
      message: `ZP promotion: ${assignments.size} variables, ` +
               `${bytesReduced} bytes, ~${cyclesSaved} cycles saved`,
    });
  }
  
  return { ...program, blocks: newBlocks };
}

/**
 * Rewrite single instruction to use ZP address.
 */
protected rewriteInstruction(
  inst: AsmInstruction,
  assignments: Map<string, number>
): AsmInstruction {
  // Check if operand references a promoted variable
  const varName = this.getVariableName(inst.operand);
  if (!varName) return inst;
  
  const zpAddr = assignments.get(varName);
  if (zpAddr === undefined) return inst;
  
  // Create new instruction with ZP addressing mode
  return {
    ...inst,
    addressingMode: this.toZPAddressingMode(inst.addressingMode),
    operand: this.createZPOperand(zpAddr, inst.operand),
  };
}
```

---

## Addressing Mode Conversion

### Mode Mapping

```typescript
/**
 * Convert absolute addressing mode to zero-page equivalent.
 */
protected toZPAddressingMode(mode: AddressingMode): AddressingMode {
  switch (mode) {
    case AddressingMode.Absolute:
      return AddressingMode.ZeroPage;
      
    case AddressingMode.AbsoluteX:
      return AddressingMode.ZeroPageX;
      
    case AddressingMode.AbsoluteY:
      // Note: Only LDX/STX support ZeroPage,Y
      // Other instructions must stay Absolute,Y
      return AddressingMode.ZeroPageY;
      
    default:
      return mode;  // Already ZP or not convertible
  }
}
```

### Special Cases

```typescript
/**
 * Handle special addressing mode constraints.
 */
protected canConvertMode(inst: AsmInstruction): boolean {
  const { opcode, addressingMode } = inst;
  
  // Absolute,Y → ZeroPage,Y only for LDX/STX
  if (addressingMode === AddressingMode.AbsoluteY) {
    return opcode === Opcode.LDX || opcode === Opcode.STX;
  }
  
  // Indirect addressing already requires ZP
  if (addressingMode === AddressingMode.IndirectY ||
      addressingMode === AddressingMode.IndirectX) {
    return false;  // Already ZP-based
  }
  
  return true;
}
```

---

## Compiler Integration

### Variable Declaration Handling

```typescript
/**
 * Integration with Blend65 variable declarations.
 * 
 * The compiler tracks declared variables and their intended addresses.
 * ZP promotion can override these for hot variables.
 */
interface BlendVariable {
  name: string;
  type: TypeInfo;
  declaredAddress?: number;  // From @ram annotation
  promotedAddress?: number;  // Set by ZP promotion
  isExported: boolean;
}

/**
 * Get effective address for a variable.
 */
function getEffectiveAddress(variable: BlendVariable): number {
  // Promoted address takes precedence (if in ZP)
  if (variable.promotedAddress !== undefined) {
    return variable.promotedAddress;
  }
  return variable.declaredAddress!;
}
```

### Symbol Table Integration

```typescript
/**
 * Update symbol table after ZP promotion.
 */
protected updateSymbolTable(
  symbols: SymbolTable,
  assignments: Map<string, number>
): void {
  for (const [name, zpAddr] of assignments) {
    const symbol = symbols.lookup(name);
    if (symbol && symbol.kind === SymbolKind.Variable) {
      // Update to ZP address
      symbol.address = zpAddr;
      symbol.isZeroPage = true;
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('ZeroPagePromotionPass', () => {
  describe('access statistics', () => {
    it('counts variable loads correctly', () => {
      const program = parseAsm(`
        LDA counter
        LDA counter
        LDA other
      `);
      const stats = pass.collectAccessStats(program, context);
      
      expect(stats.get('counter')?.loadCount).toBe(2);
      expect(stats.get('other')?.loadCount).toBe(1);
    });
    
    it('weights loop accesses higher', () => {
      const program = parseAsm(`
        LDA outside
      loop:
        LDA inside
        BNE loop
      `);
      // Mark 'loop' as loop header in context
      
      const stats = pass.collectAccessStats(program, context);
      expect(stats.get('inside')?.loopAccessCount).toBeGreaterThan(0);
      expect(stats.get('inside')?.hotnessScore)
        .toBeGreaterThan(stats.get('outside')?.hotnessScore!);
    });
    
    it('prioritizes indirect-required variables', () => {
      const program = parseAsm(`
        LDA (ptr),Y     ; MUST be ZP
        LDA counter     ; Can be anywhere
        LDA counter
        LDA counter
      `);
      
      const ranked = pass.rankByHotness(
        pass.collectAccessStats(program, context)
      );
      
      // ptr should be first despite fewer accesses
      expect(ranked[0].name).toBe('ptr');
    });
  });
  
  describe('allocation', () => {
    it('allocates from start of available range', () => {
      const assignments = pass.allocateZeroPage([
        { name: 'a', size: 1, hotnessScore: 100 },
        { name: 'b', size: 1, hotnessScore: 50 },
      ]);
      
      expect(assignments.get('a')).toBe(0x06);  // After reserved
      expect(assignments.get('b')).toBe(0x07);
    });
    
    it('respects multi-byte alignment', () => {
      const assignments = pass.allocateZeroPage([
        { name: 'ptr', size: 2, hotnessScore: 100 },
        { name: 'byte', size: 1, hotnessScore: 50 },
      ]);
      
      expect(assignments.get('ptr')).toBe(0x06);  // 2 bytes
      expect(assignments.get('byte')).toBe(0x08);  // After ptr
    });
    
    it('stops when ZP is full', () => {
      // Create 200 variables to exhaust ZP
      const vars = Array.from({ length: 200 }, (_, i) => ({
        name: `var${i}`,
        size: 1,
        hotnessScore: 200 - i,
      }));
      
      const assignments = pass.allocateZeroPage(vars);
      
      // Only 136 should fit (142 - 6 reserved)
      expect(assignments.size).toBeLessThanOrEqual(136);
    });
  });
  
  describe('rewriting', () => {
    it('converts absolute to zero-page', () => {
      const program = parseAsm(`
        LDA counter     ; $0400
        STA counter
      `);
      
      const assignments = new Map([['counter', 0x50]]);
      const result = pass.rewriteReferences(program, assignments);
      
      expect(result.blocks[0].instructions[0]).toMatchObject({
        opcode: Opcode.LDA,
        addressingMode: AddressingMode.ZeroPage,
        operand: { value: 0x50 },
      });
    });
    
    it('converts absolute,X to zeropage,X', () => {
      const program = parseAsm(`
        LDA array,X     ; $0400,X
      `);
      
      const assignments = new Map([['array', 0x50]]);
      const result = pass.rewriteReferences(program, assignments);
      
      expect(result.blocks[0].instructions[0].addressingMode)
        .toBe(AddressingMode.ZeroPageX);
    });
    
    it('preserves absolute,Y for non-LDX/STX', () => {
      const program = parseAsm(`
        LDA array,Y     ; Cannot be ZP,Y
      `);
      
      const assignments = new Map([['array', 0x50]]);
      const result = pass.rewriteReferences(program, assignments);
      
      // Should NOT convert - LDA doesn't support ZP,Y
      expect(result.blocks[0].instructions[0].addressingMode)
        .toBe(AddressingMode.AbsoluteY);
    });
  });
});
```

### Integration Tests

```typescript
describe('ZP Promotion Integration', () => {
  it('promotes hot loop variable', () => {
    const blend = `
      let counter: byte @ $0400;
      
      function main(): void {
        for (counter = 0; counter < 100; counter++) {
          // counter accessed in loop
        }
      }
    `;
    
    const result = compileWithOpt(blend, { zpPromotion: true });
    
    // counter should be at ZP address
    expect(result.symbols.get('counter')?.address)
      .toBeLessThanOrEqual(0xFF);
  });
  
  it('preserves non-hot variables in RAM', () => {
    const blend = `
      let hot: byte @ $0400;
      let cold: byte @ $0401;
      
      function main(): void {
        // Access hot 100x
        for (let i: byte = 0; i < 100; i++) {
          hot = hot + 1;
        }
        // Access cold 1x
        cold = 1;
      }
    `;
    
    const result = compileWithOpt(blend, { zpPromotion: true });
    
    expect(result.symbols.get('hot')?.address).toBeLessThanOrEqual(0xFF);
    expect(result.symbols.get('cold')?.address).toBe(0x0401);  // Unchanged
  });
});
```

---

## Configuration

### Pass Options

```typescript
interface ZPPromotionOptions {
  /** Enable ZP promotion (default: true for O2+) */
  enabled: boolean;
  
  /** Minimum hotness score to consider for promotion */
  minHotness: number;
  
  /** Maximum variables to promote */
  maxPromotions: number;
  
  /** ZP range to use */
  zpRange: { start: number; end: number };
  
  /** Reserved addresses (never use) */
  reserved: number[];
}

export const DEFAULT_ZP_OPTIONS: ZPPromotionOptions = {
  enabled: true,
  minHotness: 10,  // At least 10 accesses
  maxPromotions: 50,  // Leave room for scratch
  zpRange: { start: 0x06, end: 0x8F },
  reserved: [0x02, 0x03, 0x04, 0x05],  // Compiler scratch
};
```

---

## Optimization Levels

| Level | ZP Promotion |
|-------|--------------|
| O0 | Disabled |
| O1 | Loop variables only |
| O2 | All hot variables (default settings) |
| O3 | Aggressive (use BASIC workspace if disabled) |

---

## Summary

**Zero-Page Promotion** delivers significant wins:
- **Size**: 1 byte saved per access (typical 10-30% reduction)
- **Speed**: 1 cycle saved per access (3 cycles vs 4)
- **Required**: For indirect addressing `LDA ($50),Y`

**Priority order**:
1. Variables used with indirect addressing (MUST be ZP)
2. Loop counter variables (huge cycle savings)
3. Frequently accessed globals
4. Large arrays (only if small enough for ZP)

---

**Previous**: [Phase 6 Index](00-phase-index.md)  
**Next**: [Indexed Addressing](02-indexed-addr.md)