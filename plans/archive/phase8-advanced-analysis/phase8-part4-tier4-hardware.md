# Phase 8 Implementation Plan - Part 4: Tier 4 - Hardware & Modern Compiler

> **Navigation**: [Part 3](phase8-part3-tier3.md) ← [Part 4] → [Part 5: Tier 4 Call/Inst & Cross-Module](phase8-part5-tier4-optimization.md)
>
> **Focus**: Weeks 4-5 - God-Level 6502 Hardware & Modern Compiler Techniques
> **Tasks**: 8.15-8.17, 8.20, 8.22-8.23, 8.26 (7 tasks, 46 hours, 142+ tests) 🔧 **EXPANDED**
> **Prerequisites**: Part 3 complete (Tier 3 - Advanced Analysis) ✅

---

## Tier 4 Overview: God-Level Analysis

**What Makes Tier 4 "God-Level":**

1. **40 years of 6502 game development** - VIC-II timing, SID conflicts, hardware constraints
2. **Modern compiler techniques** - Value range analysis (Rust-level), carry flag dataflow (6502-specific)
3. **Production C64 game patterns** - Real-world optimization opportunities

**This tier separates hobby compilers from production-grade tools.**

---

## Category A: 6502 Hardware-Specific Analysis

### Task 8.15: VIC-II Timing & Raster Analysis (8 hours) 🔧

**File**: `packages/compiler/src/semantic/analysis/vic-ii-timing.ts`

**Goal**: Analyze cycle budgets and VIC-II timing constraints

**Why Critical**: C64 games MUST fit work within raster timing:
- 63 cycles per raster line
- 19,656 cycles per frame (PAL)
- Badlines steal 40-43 cycles every 8 lines
- Sprite DMA steals 2 cycles per sprite (up to 16 cycles!)
- Page crossing adds +1 cycle penalty
- RMW instructions cost 5-6 cycles (vs 2 for registers)
- Missing raster deadlines causes visible glitches

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.VICIICyclesBudget;      // number - estimated cycles for function
OptimizationMetadataKey.VICIIRasterSafe;        // boolean - fits in raster budget
OptimizationMetadataKey.VICIIBadlineAware;      // boolean - accounts for badlines
OptimizationMetadataKey.SpriteMultiplexCandidate; // boolean - can multiplex sprites
```

**Implementation**:

```typescript
/**
 * VIC-II timing analyzer
 *
 * Estimates cycle counts and validates raster timing constraints.
 * Critical for C64 game development where missing a raster
 * deadline causes visible glitches.
 */
export class VICIITimingAnalyzer {
  private readonly CYCLES_PER_LINE = 63;
  private readonly CYCLES_PER_FRAME_PAL = 19656;
  private readonly BADLINE_STEAL_CYCLES = 40;

  constructor(
    private cfg: ControlFlowGraph,
    private symbolTable: SymbolTable
  ) {}

  analyze(): void {
    // Estimate cycle counts for each function
    for (const func of this.getAllFunctions()) {
      const cycleCount = this.estimateFunctionCycles(func);
      
      func.metadata = func.metadata || new Map();
      func.metadata.set(
        OptimizationMetadataKey.VICIICyclesBudget,
        cycleCount
      );

      // Check if function fits in single raster line
      const rasterSafe = cycleCount < this.CYCLES_PER_LINE;
      func.metadata.set(
        OptimizationMetadataKey.VICIIRasterSafe,
        rasterSafe
      );

      // Warn if close to badline budget
      if (cycleCount > (this.CYCLES_PER_LINE - this.BADLINE_STEAL_CYCLES)) {
        this.diagnostics.push(
          Diagnostic.warning(
            func.location,
            `Function may miss raster deadline during badlines (${cycleCount} cycles)`
          )
        );
      }
    }

    // Detect sprite multiplexing opportunities
    this.analyzeSpriteMultiplexing();
  }

  private estimateFunctionCycles(func: FunctionDeclaration): number {
    let totalCycles = 0;

    // JSR/RTS overhead
    totalCycles += 12;

    // Estimate body cycles
    for (const stmt of func.body) {
      totalCycles += this.estimateStatementCycles(stmt);
    }

    return totalCycles;
  }

  private estimateStatementCycles(stmt: Statement): number {
    // Rough 6502 cycle estimates with hardware penalties
    if (this.isAssignment(stmt)) {
      const baseCycles = 5; // LDA + STA approximate
      const penalties = this.calculateHardwarePenalties(stmt);
      return baseCycles + penalties;
    } else if (this.isBinaryOp(stmt)) {
      return 3; // ADC/AND/ORA approximate
    } else if (this.isConditional(stmt)) {
      return 3; // Branch instruction
    } else if (this.isLoop(stmt)) {
      const iterations = this.getLoopIterations(stmt);
      const bodyCycles = this.estimateBlockCycles(stmt.body);
      return (bodyCycles + 5) * iterations; // 5 = loop overhead
    }
    return 2; // Default
  }

  /**
   * Calculate hardware-specific cycle penalties
   * 
   * CRITICAL 6502 Hardware Details:
   * 1. Sprite DMA: 2 cycles per enabled sprite (up to 8 sprites = 16 cycles!)
   * 2. Page crossing: +1 cycle for indexed addressing across page boundary
   * 3. RMW operations: INC/DEC memory = 5-6 cycles (vs 2 for registers)
   */
  private calculateHardwarePenalties(stmt: Statement): number {
    let penalties = 0;

    // Sprite DMA penalty (if sprites are enabled)
    if (this.spritesEnabled()) {
      const spriteCount = this.getEnabledSpriteCount();
      penalties += spriteCount * 2; // 2 cycles per sprite
    }

    // Page crossing penalty (for indexed memory access)
    if (this.isIndexedMemoryAccess(stmt)) {
      const crossesBoundary = this.detectPageCrossing(stmt);
      if (crossesBoundary) {
        penalties += 1; // +1 cycle for page boundary cross
      }
    }

    // RMW operation penalty (Read-Modify-Write)
    if (this.isRMWOperation(stmt)) {
      // INC/DEC memory: 6 cycles
      // INC/DEC register: 2 cycles
      // Penalty: 4 extra cycles for memory RMW
      if (this.isMemoryOperation(stmt)) {
        penalties += 4; // 6 - 2 = 4 cycle penalty
      }
    }

    return penalties;
  }

  /**
   * Detect page crossing for indexed memory access
   * 
   * Example: LDA $C000,X crosses page if X >= $100 - low byte of $C000
   * Page crossing adds +1 cycle penalty
   */
  private detectPageCrossing(stmt: Statement): boolean {
    if (!this.isIndexedMemoryAccess(stmt)) {
      return false;
    }

    const baseAddr = this.getBaseAddress(stmt);
    const indexVar = this.getIndexVariable(stmt);
    const indexRange = this.ranges.get(indexVar);

    if (!indexRange) {
      return true; // Conservative: assume crossing
    }

    // Check if index + base could cross page boundary
    const basePage = Math.floor(baseAddr / 256);
    const maxAddr = baseAddr + indexRange.max;
    const maxPage = Math.floor(maxAddr / 256);

    return basePage !== maxPage;
  }

  /**
   * Detect Read-Modify-Write operations (INC, DEC)
   * 
   * RMW memory operations are EXPENSIVE:
   * - INC mem: 6 cycles
   * - INC reg: 2 cycles
   * - Prefer registers for performance-critical code!
   */
  private isRMWOperation(stmt: Statement): boolean {
    // Detect patterns like: x = x + 1 or x = x - 1
    if (!this.isAssignment(stmt)) return false;
    
    const isIncrement = this.matchesPattern(stmt, 'x = x + 1');
    const isDecrement = this.matchesPattern(stmt, 'x = x - 1');
    
    return isIncrement || isDecrement;
  }

  /**
   * Analyze sprite multiplexing opportunities
   * 
   * Sprite multiplexing: Reuse 8 hardware sprites to display 20+ on screen
   * Requires precise raster timing and sprite repositioning
   */
  private analyzeSpriteMultiplexing(): void {
    // Detect functions that manipulate sprite positions
    for (const func of this.getAllFunctions()) {
      const spriteWrites = this.countSpriteRegisterWrites(func);
      
      if (spriteWrites >= 8) {
        func.metadata = func.metadata || new Map();
        func.metadata.set(
          OptimizationMetadataKey.SpriteMultiplexCandidate,
          true
        );
        
        this.diagnostics.push(
          Diagnostic.info(
            func.location,
            'Function is candidate for sprite multiplexing (8+ sprite updates detected)'
          )
        );
      }
    }
  }

  // ... more methods
}
```

**Why These Hardware Details Matter**:

**Sprite DMA Stealing** (2 cycles per sprite):
```typescript
// Game with 8 sprites enabled
// BEFORE awareness: Budget 63 cycles per line
// REALITY: Only 63 - 16 = 47 cycles available!
// Result: Missed raster deadline, visible glitches
```

**Page Crossing Penalty** (+1 cycle):
```typescript
// WITHOUT detection:
LDA $C0FF,X  // If X=1, crosses to $C100 → +1 cycle penalty
// Compiler thinks: 4 cycles
// Reality: 5 cycles → timing error!
```

**RMW Memory Operations** (6 cycles vs 2):
```typescript
// SLOW: INC $D020 (6 cycles)
// FAST: LDA $D020 / CLC / ADC #1 / STA $D020 (4+2+2+4=12 cycles) - WAIT, THAT'S SLOWER!
// FASTEST: Use register: INX (2 cycles) then STX $D020 (4 cycles) = 6 cycles total

// Actually, the optimization is:
// SLOW: counter = counter + 1 (LDA mem, CLC, ADC #1, STA mem = 4+2+2+4 = 12 cycles)
// FAST: INC counter (6 cycles) - this IS the optimization!
// But if counter is in register: INX (2 cycles) - even better!
```

**Tests** (20+):

- Simple function cycle estimation
- Loop cycle calculation
- Nested loop cycle estimation
- Branch overhead estimation
- Badline cycle warnings
- Frame budget validation
- Sprite multiplexing detection
- Raster interrupt timing
- Critical section detection
- Function call overhead
- Conditional branch prediction
- Array access cycles
- @map I/O access cycles

**Test Example**:

```typescript
describe('VICIITimingAnalyzer', () => {
  it('should estimate function cycles and warn about badlines', () => {
    const source = `
      function updateSprites() {
        // ~50 cycles of work
        for (let i: byte = 0; i < 8; i = i + 1) {
          sprites[i].x = sprites[i].x + 1;  // ~6 cycles each
        }
      }
    `;
    
    const { ast, analyzer } = setupTest(source);
    analyzer.analyze();
    
    const func = findNode(ast, 'updateSprites');
    const cycles = func.metadata?.get(
      OptimizationMetadataKey.VICIICyclesBudget
    );
    
    expect(cycles).toBeGreaterThan(40);
    expect(cycles).toBeLessThan(70);
    
    // Should warn: might miss deadline during badlines
    const diagnostics = analyzer.getDiagnostics();
    expect(diagnostics).toContainWarning('may miss raster deadline');
  });
});
```

---

### Task 8.16: SID Resource Conflict Analysis (6 hours)

**File**: `packages/compiler/src/semantic/analysis/sid-conflicts.ts`

**Goal**: Detect SID voice and filter resource conflicts

**Why Critical**: C64 SID chip constraints:
- Only 3 voices available (Voice 0, 1, 2)
- Only 1 filter (shared across voices)
- Filter + voice conflicts cause audio glitches
- Interrupt timing affects music/SFX

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.SIDVoiceUsage;          // Set<number> - which voices used
OptimizationMetadataKey.SIDVoiceConflict;       // boolean - conflict detected
OptimizationMetadataKey.SIDFilterInUse;         // boolean - filter enabled
OptimizationMetadataKey.SIDTimingRequirements;  // number - IRQ timing needs
```

**Implementation**: Track SID register writes, detect voice/filter conflicts, analyze interrupt timing

**Tests** (15+): Voice allocation, voice conflicts, filter sharing, filter conflicts, interrupt timing, music/SFX conflicts, ADSR timing, waveform conflicts

---

### Task 8.17: Memory Region Conflict Analysis (6 hours) 🔧

**File**: `packages/compiler/src/semantic/analysis/memory-regions.ts`

**Goal**: Detect I/O region vs RAM conflicts, alignment requirements, VIC-II banking

**Why Critical**: C64 memory map complexities:
- $D000-$DFFF can be I/O or RAM (bank switching)
- Sprite data must be 64-byte aligned
- Screen memory must be 1K aligned
- Character set must be 2K aligned
- VIC-II sees only 16K at a time (banks 0-3)
- Character ROM at $D000-$DFFF conflicts with I/O
- Bitmap mode requires specific memory layout

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.MemoryRegion;          // MemoryRegion enum
OptimizationMetadataKey.MemoryOverlap;         // boolean - overlapping regions
OptimizationMetadataKey.AlignmentRequirement;  // number - required alignment
OptimizationMetadataKey.BankingRequired;       // boolean - needs bank switching
OptimizationMetadataKey.VICIIBank;             // number - VIC bank (0-3)
OptimizationMetadataKey.VICIIBankConflict;     // boolean - outside VIC bank
```

**MemoryRegion enum**:
```typescript
export enum MemoryRegion {
  ZeroPage = 'ZeroPage',           // $0000-$00FF
  Stack = 'Stack',                  // $0100-$01FF
  RAM = 'RAM',                      // $0200-$CFFF
  IORegion = 'IORegion',           // $D000-$DFFF (when I/O visible)
  ColorRAM = 'ColorRAM',           // $D800-$DBFF
  BASIC = 'BASIC',                 // $A000-$BFFF
  Kernal = 'Kernal',               // $E000-$FFFF
}
```

**Implementation**:

```typescript
/**
 * Memory region conflict analyzer
 *
 * Validates memory-mapped declarations, alignment requirements,
 * and VIC-II banking constraints.
 *
 * CRITICAL: VIC-II can only see 16K at a time!
 */
export class MemoryRegionAnalyzer {
  // VIC-II Bank boundaries (configured via $DD00)
  private readonly VIC_BANKS = [
    { bank: 0, start: 0x0000, end: 0x3FFF }, // $0000-$3FFF (default)
    { bank: 1, start: 0x4000, end: 0x7FFF }, // $4000-$7FFF
    { bank: 2, start: 0x8000, end: 0xBFFF }, // $8000-$BFFF
    { bank: 3, start: 0xC000, end: 0xFFFF }, // $C000-$FFFF
  ];

  constructor(
    private symbolTable: SymbolTable,
    private diagnostics: Diagnostic[]
  ) {}

  analyze(): void {
    // Analyze all @map declarations
    for (const symbol of this.symbolTable.getAllSymbols()) {
      if (symbol.kind === SymbolKind.MemoryMapped) {
        this.analyzeMemoryMappedSymbol(symbol);
      }
    }
  }

  private analyzeMemoryMappedSymbol(symbol: MemoryMappedSymbol): void {
    const address = symbol.address;

    // Check alignment requirements
    this.validateAlignment(symbol);

    // Check VIC-II banking constraints
    this.validateVICIIBanking(symbol);

    // Check memory region conflicts
    this.validateMemoryRegion(symbol);
  }

  /**
   * Validate alignment requirements
   *
   * CRITICAL VIC-II Alignment Requirements:
   * - Sprite data: 64-byte aligned ($xx00, $xx40, $xx80, $xxC0)
   * - Screen memory: 1K aligned ($x000, $x400, $x800, $xC00)
   * - Character set: 2K aligned ($x000, $x800)
   * - Bitmap: 8K aligned ($0000, $2000, $4000, $6000, $8000, $A000, $C000, $E000)
   */
  private validateAlignment(symbol: MemoryMappedSymbol): void {
    const address = symbol.address;
    const typeName = this.getTypeName(symbol.type);

    // Detect alignment requirements from type name or usage
    let requiredAlignment = 1;
    let alignmentType = '';

    if (typeName.includes('Sprite') || symbol.name.includes('sprite')) {
      requiredAlignment = 64;
      alignmentType = 'sprite data';
    } else if (typeName.includes('Screen') || symbol.name.includes('screen')) {
      requiredAlignment = 1024;
      alignmentType = 'screen memory';
    } else if (typeName.includes('Charset') || symbol.name.includes('charset')) {
      requiredAlignment = 2048;
      alignmentType = 'character set';
    } else if (typeName.includes('Bitmap') || symbol.name.includes('bitmap')) {
      requiredAlignment = 8192;
      alignmentType = 'bitmap';
    }

    // Validate alignment
    if (requiredAlignment > 1) {
      if (address % requiredAlignment !== 0) {
        this.diagnostics.push(
          Diagnostic.error(
            symbol.location,
            `${alignmentType} must be ${requiredAlignment}-byte aligned. ` +
            `Address $${address.toString(16).toUpperCase()} is not aligned. ` +
            `Next valid address: $${this.nextAligned(address, requiredAlignment).toString(16).toUpperCase()}`
          )
        );
      }

      // Store metadata
      symbol.metadata = symbol.metadata || new Map();
      symbol.metadata.set(
        OptimizationMetadataKey.AlignmentRequirement,
        requiredAlignment
      );
    }
  }

  /**
   * Validate VIC-II banking constraints
   *
   * CRITICAL: VIC-II can only see 16K at a time!
   * - Screen and charset must be in the SAME VIC bank
   * - Bank is configured via CIA2 ($DD00)
   * - Character ROM at $1000-$1FFF and $9000-$9FFF is inaccessible in banks 0 and 2
   */
  private validateVICIIBanking(symbol: MemoryMappedSymbol): void {
    const address = symbol.address;
    const bank = this.getVICBank(address);

    // Store VIC bank metadata
    symbol.metadata = symbol.metadata || new Map();
    symbol.metadata.set(OptimizationMetadataKey.VICIIBank, bank);

    // Check if screen and charset are in same bank
    const isScreen = this.isScreenMemory(symbol);
    const isCharset = this.isCharsetMemory(symbol);

    if (isScreen || isCharset) {
      // Find related screen/charset declarations
      const relatedSymbols = this.findRelatedVICSymbols(symbol);
      
      for (const related of relatedSymbols) {
        const relatedBank = this.getVICBank(related.address);
        
        if (relatedBank !== bank) {
          this.diagnostics.push(
            Diagnostic.error(
              symbol.location,
              `VIC-II banking conflict: ${symbol.name} (bank ${bank}) ` +
              `and ${related.name} (bank ${relatedBank}) must be in the same 16K bank. ` +
              `VIC-II can only see one 16K bank at a time!`
            )
          );
          
          symbol.metadata.set(OptimizationMetadataKey.VICIIBankConflict, true);
        }
      }
    }

    // Check for character ROM conflicts in banks 0 and 2
    if (isCharset && (bank === 0 || bank === 2)) {
      const bankBase = this.VIC_BANKS[bank].start;
      const offsetInBank = address - bankBase;
      
      // Character ROM visible at $1000-$1FFF within VIC bank
      if (offsetInBank >= 0x1000 && offsetInBank < 0x2000) {
        this.diagnostics.push(
          Diagnostic.error(
            symbol.location,
            `Charset at $${address.toString(16).toUpperCase()} conflicts with Character ROM. ` +
            `In VIC bank ${bank}, Character ROM is visible at offset $1000-$1FFF. ` +
            `Use different VIC bank or different offset within bank.`
          )
        );
      }
    }
  }

  /**
   * Determine which VIC-II bank (0-3) contains this address
   */
  private getVICBank(address: number): number {
    for (const bank of this.VIC_BANKS) {
      if (address >= bank.start && address <= bank.end) {
        return bank.bank;
      }
    }
    return 0; // Default to bank 0
  }

  /**
   * Get offset within VIC-II bank (0-16383)
   */
  private getOffsetInVICBank(address: number): number {
    const bank = this.getVICBank(address);
    return address - this.VIC_BANKS[bank].start;
  }

  /**
   * Calculate next aligned address
   */
  private nextAligned(address: number, alignment: number): number {
    return Math.ceil(address / alignment) * alignment;
  }

  // ... more methods
}
```

**Why These Details Matter**:

**VIC-II 16K Banking** (CRITICAL!):
```typescript
// FATAL ERROR - Different banks:
@map screenMemory at $0400: byte[1000];  // Bank 0 ($0000-$3FFF)
@map charset at $4000: byte[2048];        // Bank 1 ($4000-$7FFF)
// ERROR: VIC-II can't see both! Screen will show garbage!

// CORRECT - Same bank:
@map screenMemory at $0400: byte[1000];  // Bank 0
@map charset at $2000: byte[2048];        // Bank 0
// ✅ Both visible in bank 0
```

**Alignment Requirements** (VIC-II Hardware):
```typescript
// FATAL ERROR - Wrong alignment:
@map spriteData at $2001: byte[64];  // NOT 64-byte aligned!
// Hardware ignores low 6 bits → sprite pointer wrong!

// CORRECT:
@map spriteData at $2000: byte[64];  // $2000 = aligned to 64 bytes
// ✅ Hardware sprite pointer works correctly
```

**Character ROM Conflict** (Banks 0 & 2):
```typescript
// FATAL ERROR - Character ROM conflict:
@map charset at $1000: byte[2048];  // In bank 0, offset $1000
// ERROR: Character ROM is visible at $1000-$1FFF in banks 0 and 2!
// Your charset is invisible!

// CORRECT:
@map charset at $2000: byte[2048];  // Offset $2000 in bank 0
// ✅ No Character ROM conflict
```

**Tests** (26+):
- I/O vs RAM detection
- Sprite 64-byte alignment validation
- Sprite misalignment error messages
- Screen 1K alignment validation
- Screen misalignment error messages
- Charset 2K alignment validation
- Charset misalignment error messages
- Bitmap 8K alignment validation
- Color RAM bounds checking
- VIC bank detection (0-3)
- VIC bank conflict detection (screen/charset in different banks)
- Character ROM conflict detection (banks 0 and 2)
- Offset-in-bank calculation
- Next aligned address calculation
- Banking requirements detection
- Overlap detection
- Zero-page allocation
- Stack usage

---

### Task 8.20: Branch Distance Analysis (6 hours)

**File**: `packages/compiler/src/semantic/analysis/branch-distance.ts`

**Goal**: Detect branches exceeding ±127 byte limit, recommend JMP

**Why Critical**: 6502 branch instructions (BEQ, BNE, BCC, etc.) are limited to ±127 bytes. Exceeding this causes assembly errors. Code generator must use JMP instead.

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.BranchDistance;         // number - estimated byte distance
OptimizationMetadataKey.RequiresJMP;            // boolean - branch too far, use JMP
OptimizationMetadataKey.BranchFrequency;        // number - how often branch taken
OptimizationMetadataKey.BranchPredictionHint;   // boolean - likely true/false
```

**Implementation**: Estimate code size between branch and target, flag long branches, analyze branch frequency

**Tests** (12+): Short branches (OK), long branches (requires JMP), forward branches, backward branches (loops), conditional branches, nested branches, branch frequency, branch prediction hints

---

## Category B: Modern Compiler Techniques

### Task 8.22: Integer Range Analysis (7 hours)

**File**: `packages/compiler/src/semantic/analysis/value-range.ts`

**Goal**: Track value ranges to eliminate overflow checks (Rust-level optimization)

**Why Critical**: Rust compiler's secret weapon - eliminate bounds checking when provably safe

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.ValueRange;            // {min: number, max: number}
OptimizationMetadataKey.OverflowImpossible;    // boolean - provably no overflow
OptimizationMetadataKey.UnderflowPossible;     // boolean - might underflow
OptimizationMetadataKey.SignednessInferred;    // boolean - signed vs unsigned
```

**Implementation**:

```typescript
/**
 * Value range analyzer (Rust-style bounds checking elimination)
 *
 * Tracks min/max possible values to eliminate runtime checks.
 */
export class ValueRangeAnalyzer {
  private ranges = new Map<string, ValueRange>();

  analyze(): void {
    // Initialize ranges from type declarations
    for (const symbol of this.symbolTable.getAllSymbols()) {
      if (symbol.kind === SymbolKind.Variable) {
        this.ranges.set(symbol.name, this.getTypeRange(symbol.type));
      }
    }

    // Refine ranges through dataflow
    let changed = true;
    while (changed) {
      changed = false;
      
      for (const block of this.cfg.getBlocks()) {
        for (const stmt of block.statements) {
          if (this.isAssignment(stmt)) {
            const newRange = this.computeRange(stmt.value);
            const oldRange = this.ranges.get(stmt.target);
            
            if (!this.rangesEqual(oldRange, newRange)) {
              this.ranges.set(stmt.target, this.intersectRanges(oldRange, newRange));
              changed = true;
            }
          }
        }
      }
    }

    // Attach metadata
    this.attachMetadata();
  }

  private computeRange(expr: Expression): ValueRange {
    if (this.isLiteral(expr)) {
      return { min: expr.value, max: expr.value };
    } else if (this.isBinaryOp(expr)) {
      const left = this.getRange(expr.left);
      const right = this.getRange(expr.right);
      
      switch (expr.operator) {
        case '+':
          return { 
            min: left.min + right.min, 
            max: left.max + right.max 
          };
        case '-':
          return { 
            min: left.min - right.max, 
            max: left.max - right.min 
          };
        // ... other operators
      }
    }
    return { min: 0, max: 255 }; // Conservative
  }

  // ... more methods
}
```

**Tests** (20+): Constant ranges, arithmetic range propagation, overflow detection, underflow detection, array bounds elimination, loop counter ranges, conditional refinement, signed vs unsigned inference

---

### Task 8.23: Carry Flag Dataflow Analysis (6 hours) 🔧

**File**: `packages/compiler/src/semantic/analysis/carry-flag.ts`

**Goal**: Track carry flag state to eliminate redundant CLC/SEC (6502-specific!)

**Why Critical**: CLC/SEC instructions are 2 cycles each. Eliminating redundant ones saves cycles.
- Decimal mode (SED/CLD) changes ADC/SBC behavior
- IRQ does NOT clear decimal flag (6502 quirk!)
- Decimal flag must be tracked alongside carry flag
- BCD arithmetic requires different optimization strategies

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.CarryFlagState;        // 'Clear' | 'Set' | 'Unknown'
OptimizationMetadataKey.RequiresCLC;           // boolean - needs CLC before op
OptimizationMetadataKey.RequiresSEC;           // boolean - needs SEC before op
OptimizationMetadataKey.CarryPropagation;      // boolean - carry propagates to next
OptimizationMetadataKey.DecimalMode;           // 'Binary' | 'Decimal' | 'Unknown'
OptimizationMetadataKey.DecimalFlagRisk;       // boolean - IRQ may leave D flag set
```

**Implementation**:

```typescript
/**
 * Carry flag dataflow analyzer
 *
 * Tracks carry flag state through arithmetic operations to eliminate
 * redundant CLC/SEC instructions.
 *
 * CRITICAL 6502 Quirks:
 * 1. IRQ does NOT clear decimal flag (unlike NMI on some processors)
 * 2. Decimal mode changes ADC/SBC behavior (BCD arithmetic)
 * 3. D flag must be explicitly cleared with CLD if uncertain
 */
export class CarryFlagAnalyzer {
  private carryStates = new Map<string, CarryState>();
  private decimalStates = new Map<string, DecimalState>();

  constructor(
    private cfg: ControlFlowGraph,
    private symbolTable: SymbolTable
  ) {}

  analyze(): void {
    // Initialize states
    for (const block of this.cfg.getBlocks()) {
      this.carryStates.set(block.id, 'Unknown');
      this.decimalStates.set(block.id, 'Unknown');
    }

    // Propagate carry and decimal flag states
    let changed = true;
    while (changed) {
      changed = false;
      
      for (const block of this.cfg.getBlocks()) {
        const newCarryState = this.computeCarryState(block);
        const newDecimalState = this.computeDecimalState(block);
        
        if (newCarryState !== this.carryStates.get(block.id)) {
          this.carryStates.set(block.id, newCarryState);
          changed = true;
        }
        
        if (newDecimalState !== this.decimalStates.get(block.id)) {
          this.decimalStates.set(block.id, newDecimalState);
          changed = true;
        }
      }
    }

    // Detect decimal flag risks
    this.detectDecimalFlagRisks();

    // Attach metadata
    this.attachMetadata();
  }

  /**
   * Compute carry flag state for a block
   *
   * Carry flag is affected by:
   * - CLC (clear carry)
   * - SEC (set carry)
   * - ADC/SBC (modifies carry based on result)
   * - ASL/LSR/ROL/ROR (shifts set carry)
   * - CMP (comparison sets carry)
   */
  private computeCarryState(block: BasicBlock): CarryState {
    let state: CarryState = 'Unknown';

    // Get carry state from predecessors
    const predStates = block.predecessors.map(pred => 
      this.carryStates.get(pred.id)
    );
    state = this.mergeCarryStates(predStates);

    // Process statements in block
    for (const stmt of block.statements) {
      if (this.isCLC(stmt)) {
        state = 'Clear';
      } else if (this.isSEC(stmt)) {
        state = 'Set';
      } else if (this.isADC(stmt) || this.isSBC(stmt)) {
        state = 'Unknown'; // Carry depends on arithmetic result
      } else if (this.isComparison(stmt)) {
        state = 'Unknown'; // Comparison sets carry based on result
      }
    }

    return state;
  }

  /**
   * Compute decimal mode state for a block
   *
   * CRITICAL: Decimal flag is STICKY!
   * - SED sets decimal mode (BCD arithmetic)
   * - CLD clears decimal mode (binary arithmetic)
   * - IRQ does NOT clear D flag (6502 quirk!)
   * - Must explicitly CLD if entering from unknown state
   */
  private computeDecimalState(block: BasicBlock): DecimalState {
    let state: DecimalState = 'Unknown';

    // Get decimal state from predecessors
    const predStates = block.predecessors.map(pred => 
      this.decimalStates.get(pred.id)
    );
    state = this.mergeDecimalStates(predStates);

    // Process statements in block
    for (const stmt of block.statements) {
      if (this.isSED(stmt)) {
        state = 'Decimal';
      } else if (this.isCLD(stmt)) {
        state = 'Binary';
      }
    }

    return state;
  }

  /**
   * Detect decimal flag risks
   *
   * CRITICAL 6502 Quirk: IRQ does NOT clear decimal flag!
   * If IRQ handler uses ADC/SBC without clearing D flag first,
   * results will be incorrect if D flag was set when IRQ fired.
   *
   * Best practice: IRQ handlers should start with CLD
   */
  private detectDecimalFlagRisks(): void {
    // Find all IRQ handlers
    for (const func of this.getAllFunctions()) {
      if (!this.isIRQHandler(func)) continue;

      // Check if handler clears decimal flag early
      const clearsDFlagEarly = this.clearDecimalFlagEarly(func);

      if (!clearsDFlagEarly) {
        // Check if handler uses ADC/SBC
        const usesArithmetic = this.usesADCorSBC(func);

        if (usesArithmetic) {
          this.diagnostics.push(
            Diagnostic.warning(
              func.location,
              'IRQ handler uses ADC/SBC without clearing decimal flag. ' +
              'Add CLD at start of handler to ensure binary arithmetic. ' +
              'CRITICAL: IRQ does NOT clear D flag automatically!'
            )
          );

          func.metadata = func.metadata || new Map();
          func.metadata.set(OptimizationMetadataKey.DecimalFlagRisk, true);
        }
      }
    }
  }

  /**
   * Check if function clears decimal flag early
   */
  private clearDecimalFlagEarly(func: FunctionDeclaration): boolean {
    // Check first few statements for CLD
    const earlyStatements = func.body.slice(0, 3);
    return earlyStatements.some(stmt => this.isCLD(stmt));
  }

  /**
   * Merge carry states from multiple predecessors
   */
  private mergeCarryStates(states: CarryState[]): CarryState {
    if (states.length === 0) return 'Unknown';
    
    const allClear = states.every(s => s === 'Clear');
    const allSet = states.every(s => s === 'Set');
    
    if (allClear) return 'Clear';
    if (allSet) return 'Set';
    return 'Unknown'; // Different paths have different states
  }

  /**
   * Merge decimal states from multiple predecessors
   */
  private mergeDecimalStates(states: DecimalState[]): DecimalState {
    if (states.length === 0) return 'Unknown';
    
    const allBinary = states.every(s => s === 'Binary');
    const allDecimal = states.every(s => s === 'Decimal');
    
    if (allBinary) return 'Binary';
    if (allDecimal) return 'Decimal';
    return 'Unknown'; // Different paths have different states
  }

  // ... more methods
}

type CarryState = 'Clear' | 'Set' | 'Unknown';
type DecimalState = 'Binary' | 'Decimal' | 'Unknown';
```

**Why Decimal Mode Matters**:

**IRQ Doesn't Clear D Flag** (6502 Quirk!):
```typescript
// DANGEROUS - Decimal flag risk:
function irqHandler() {
  // What if D flag is set when IRQ fires?
  let result = valueA + valueB;  // Will use BCD arithmetic!
  // Result will be WRONG if D flag was set!
}

// SAFE - Always clear D flag in IRQ:
function irqHandler() {
  // CLD as first instruction (compiler inserts)
  let result = valueA + valueB;  // Binary arithmetic guaranteed
}
```

**Decimal Mode vs Binary Mode**:
```typescript
// Binary mode (D flag clear):
// 15 + 15 = 30 ($0F + $0F = $1E)

// Decimal mode (D flag set):
// 15 + 15 = 30 in BCD ($15 + $15 = $30)
// Each nibble is 0-9, not 0-15!

// If IRQ fires during decimal arithmetic:
function gameLoop() {
  SED();  // Enable decimal mode for BCD score
  score = score + 1;  // $99 + $01 = $00 (BCD: 99 + 1 = 100, wraps to 00)
  // <-- IRQ FIRES HERE with D flag SET!
  CLD();  // Clear decimal mode
}

function irqHandler() {
  // If we don't CLD here, arithmetic will use BCD!
  temp = counter + 1;  // WRONG if D flag still set!
}
```

**Tests** (21+):
- CLC redundancy detection
- SEC redundancy detection
- ADC carry propagation
- SBC borrow propagation
- Multi-byte arithmetic
- Conditional carry states
- Function call carry (conservative)
- Carry through branches
- Decimal mode detection (SED)
- Binary mode detection (CLD)
- Decimal flag propagation
- IRQ handler without CLD (warning)
- IRQ handler with CLD (safe)
- Decimal mode arithmetic
- BCD vs binary results
- Decimal flag through branches

---

### Task 8.26: Interrupt Safety Analysis (7 hours)

**File**: `packages/compiler/src/semantic/analysis/interrupt-safety.ts`

**Goal**: Detect race conditions, non-reentrant code, critical sections

**Why Critical**: IRQ handlers are fundamental to C64 development. Race conditions cause subtle, hard-to-debug bugs.

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.InterruptSafe;             // boolean - safe from IRQs
OptimizationMetadataKey.RequiresCriticalSection;   // boolean - needs SEI/CLI
OptimizationMetadataKey.IRQLatency;                // number - max cycles in SEI
OptimizationMetadataKey.VolatileAccess;            // boolean - shared with IRQ
```

**Implementation**: Analyze shared variable access, detect non-atomic operations, recommend critical sections

**Tests** (18+): Race condition detection, atomic operations, critical section needs, IRQ latency calculation, volatile variable detection, reentrant function analysis, shared @map access, music/game loop conflicts

---

## Tier 4 Category A+B Summary

| Task      | Description             | Hours      | Tests         | Category      | Status  | Notes |
| --------- | ----------------------- | ---------- | ------------- | ------------- | ------- | ----- |
| 8.15 🔧   | VIC-II timing           | 8          | 30+           | 6502 Hardware | [ ]     | +10 (sprite DMA, page crossing, RMW) |
| 8.16      | SID conflicts           | 6          | 15+           | 6502 Hardware | [ ]     | |
| 8.17 🔧   | Memory regions          | 6          | 26+           | 6502 Hardware | [ ]     | +8 (VIC banking, alignment) |
| 8.20      | Branch distance         | 6          | 12+           | 6502 Hardware | [ ]     | |
| 8.22      | Value range             | 7          | 20+           | Modern Comp.  | [ ]     | |
| 8.23 🔧   | Carry flag              | 6          | 21+           | 6502-Specific | [ ]     | +6 (decimal mode, IRQ quirks) |
| 8.26      | Interrupt safety        | 7          | 18+           | Critical      | [ ]     | |
| **Total** | **Hardware + Modern**   | **46 hrs** | **142+ tests**| **7 analyses**| **[ ]** | **+24 tests from expansions** |

---

## Why These Analyses Matter

### VIC-II Timing (8.15)
```typescript
// WITHOUT analysis: Glitchy graphics, missed raster splits
function gameLoop() {
  updatePlayer();    // Unknown cycles
  updateEnemies();   // Unknown cycles
  updateBullets();   // Unknown cycles
  // Did we miss the raster deadline? Who knows!
}

// WITH analysis:
function gameLoop() {
  // Metadata: gameLoop() = 4500 cycles
  // WARNING: May miss raster at line 250 (only 3969 cycles available)
  updatePlayer();    // 1200 cycles
  updateEnemies();   // 3500 cycles - TOO SLOW!
  updateBullets();   // 800 cycles
}
```

### Value Range Analysis (8.22)
```typescript
// WITHOUT analysis: Runtime bounds checks every time
let index: byte = 0;
while (index < 10) {
  array[index] = value;  // Bounds check: is index < array.length?
  index = index + 1;
}

// WITH analysis:
// Range: index ∈ [0, 9]
// Array length: 10
// OPTIMIZATION: Bounds check eliminated (provably safe)
```

### Interrupt Safety (8.26)
```typescript
// WITHOUT analysis: Subtle race condition
let score: word = 0;  // Shared with IRQ

function updateScore() {
  score = score + 10;  // Non-atomic! IRQ can interrupt between load/store
}

// WITH analysis:
// WARNING: Race condition detected on 'score'
// RECOMMENDATION: Use critical section (SEI/CLI)
function updateScore() {
  // Critical section needed
  score = score + 10;
}
```

---

## Next Steps

After completing **Part 4 (Tier 4 Categories A+B)**:

1. ✅ All hardware analyses complete (8.15-8.17, 8.20)
2. ✅ All modern compiler analyses complete (8.22-8.23, 8.26)
3. ✅ 118+ tests passing
4. ✅ Production-level 6502 optimization ready

**→ Continue to [Part 5: Tier 4 - Call/Instruction & Cross-Module](phase8-part5-tier4-optimization.md)**

---

**Part 4 Status**: Tier 4 Hardware & Modern Compiler (7 tasks, 46 hours, 118+ tests)
**Architecture**: God-level 6502 optimization + modern techniques ✅