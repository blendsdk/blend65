# Phase 6.2: Indexed Addressing Optimization

> **Phase**: 6.2  
> **Parent**: [Phase 6 Index](00-phase-index.md)  
> **Est. Lines**: ~300  
> **Focus**: Optimize X/Y index register usage and addressing modes

---

## Overview

The 6502 has only two index registers (X and Y) with different capabilities. Choosing the optimal index register and addressing mode can significantly impact code size and performance.

This pass analyzes array access patterns and selects the most efficient index register and addressing mode for each context.

---

## Why Indexed Addressing Matters

### Register Capabilities

| Mode | X | Y | Notes |
|------|---|---|-------|
| Zero-page,X | ✓ | ✗ | Most common indexed ZP mode |
| Zero-page,Y | LDX/STX only | ✓ | Limited instruction support |
| Absolute,X | ✓ | ✗ | Universal |
| Absolute,Y | ✓ | ✓ | Page-cross penalty |
| Indirect,X | ✓ | ✗ | Pointer tables (rare) |
| Indirect,Y | ✗ | ✓ | Array via pointer (common!) |

**Key Insight**: Y is essential for `(ptr),Y` indirect mode used for dynamic array access.

### Performance Comparison

| Addressing Mode | Bytes | Cycles | Page Cross |
|-----------------|-------|--------|------------|
| Zero-page,X | 2 | 4 | N/A |
| Absolute,X | 3 | 4 | +1 |
| Absolute,Y | 3 | 4 | +1 |
| Indirect,Y | 2 | 5 | +1 |

---

## Index Selection Strategy

### When to Use X

```asm
; X is best for:
; 1. Zero-page indexed access (only option for most instructions)
LDA table,X         ; ZP,X - fast and small

; 2. Array iteration with INC pattern
.loop:
    LDA array,X
    INX
    CPX #len
    BNE .loop
```

### When to Use Y

```asm
; Y is best for:
; 1. Indirect indexed access (REQUIRED)
LDA (ptr),Y         ; Only Y works here!

; 2. Fixed offset from pointer
LDY #offset
LDA (base),Y

; 3. When X is busy with loop counter
.loop:
    ; X = loop counter
    LDA row,Y       ; Y = column offset
    INX
    CPX #rows
    BNE .loop
```

---

## Architecture

### Pass Structure

```typescript
/**
 * Indexed Addressing Optimization Pass
 * 
 * Analyzes array access patterns and optimizes index register
 * selection for best performance and code size.
 */
export class IndexedAddressingPass implements Pass<AsmProgram> {
  readonly name = 'indexed-addressing';
  readonly dependencies = ['use-def-asm', 'loop-analysis'];
  
  run(program: AsmProgram, context: PassContext): AsmProgram {
    const analysisResult = this.analyzeIndexUsage(program, context);
    
    // Apply optimizations in priority order
    let result = program;
    
    // 1. Convert absolute to ZP indexed where possible
    result = this.optimizeToZPIndexed(result, analysisResult);
    
    // 2. Select optimal index register
    result = this.optimizeIndexSelection(result, analysisResult);
    
    // 3. Minimize index register transfers
    result = this.minimizeTransfers(result, analysisResult);
    
    return result;
  }
}
```

### Index Usage Analysis

```typescript
/**
 * Information about how indices are used in a code region.
 */
interface IndexUsageInfo {
  /** Instructions using X index */
  xUses: AsmInstruction[];
  
  /** Instructions using Y index */
  yUses: AsmInstruction[];
  
  /** Instructions requiring X (ZP,X, (zp,X)) */
  xRequired: AsmInstruction[];
  
  /** Instructions requiring Y ((zp),Y) */
  yRequired: AsmInstruction[];
  
  /** Can X and Y be swapped without breaking semantics? */
  canSwap: boolean;
  
  /** Cost of using X for all indexed ops */
  xCost: number;
  
  /** Cost of using Y for all indexed ops */
  yCost: number;
}

/**
 * Analyze index register usage in a block or region.
 */
protected analyzeIndexUsage(
  program: AsmProgram,
  context: PassContext
): Map<string, IndexUsageInfo> {
  const result = new Map<string, IndexUsageInfo>();
  
  for (const block of program.blocks) {
    const info: IndexUsageInfo = {
      xUses: [],
      yUses: [],
      xRequired: [],
      yRequired: [],
      canSwap: true,
      xCost: 0,
      yCost: 0,
    };
    
    for (const inst of block.instructions) {
      this.categorizeInstruction(inst, info);
    }
    
    // Calculate swap feasibility
    info.canSwap = info.xRequired.length === 0 || 
                   info.yRequired.length === 0;
    
    result.set(block.label, info);
  }
  
  return result;
}
```

---

## Optimization Patterns

### Pattern 1: Absolute to Zero-Page Indexed

When base address fits in zero-page, convert to smaller instruction.

```asm
; Before (absolute indexed - 3 bytes)
LDA $0050,X

; After (zero-page indexed - 2 bytes)
LDA $50,X
```

```typescript
/**
 * Convert absolute indexed to zero-page indexed.
 */
protected optimizeToZPIndexed(
  program: AsmProgram,
  analysis: Map<string, IndexUsageInfo>
): AsmProgram {
  return this.mapInstructions(program, inst => {
    // Check if absolute indexed
    if (inst.addressingMode !== AddressingMode.AbsoluteX &&
        inst.addressingMode !== AddressingMode.AbsoluteY) {
      return inst;
    }
    
    // Check if address fits in zero-page
    const addr = this.getOperandValue(inst);
    if (addr > 0xFF) {
      return inst;
    }
    
    // Check instruction supports ZP mode
    if (!this.supportsZPIndexed(inst.opcode, inst.addressingMode)) {
      return inst;
    }
    
    // Convert
    return {
      ...inst,
      addressingMode: inst.addressingMode === AddressingMode.AbsoluteX
        ? AddressingMode.ZeroPageX
        : AddressingMode.ZeroPageY,
    };
  });
}

/**
 * Check if instruction supports ZP,X or ZP,Y mode.
 */
protected supportsZPIndexed(
  opcode: Opcode,
  mode: AddressingMode
): boolean {
  // ZP,Y is only supported by LDX and STX
  if (mode === AddressingMode.AbsoluteY) {
    return opcode === Opcode.LDX || opcode === Opcode.STX;
  }
  
  // ZP,X supported by most memory operations
  const zpxSupported = [
    Opcode.LDA, Opcode.STA, Opcode.LDY, Opcode.STY,
    Opcode.ADC, Opcode.SBC, Opcode.CMP,
    Opcode.AND, Opcode.ORA, Opcode.EOR,
    Opcode.ASL, Opcode.LSR, Opcode.ROL, Opcode.ROR,
    Opcode.INC, Opcode.DEC,
  ];
  
  return zpxSupported.includes(opcode);
}
```

### Pattern 2: Index Register Swap

When swapping X↔Y reduces transfers or enables better modes.

```asm
; Before - X used for indirect (can't work!)
LDA (ptr,X)         ; Rare indirect indexed X
; ... many instructions ...
LDA (other),Y       ; Indirect Y

; After - swap if X and Y can be exchanged
LDA (ptr),Y         ; Now works!
; ... many instructions using X ...
```

```typescript
/**
 * Optimize index register selection.
 */
protected optimizeIndexSelection(
  program: AsmProgram,
  analysis: Map<string, IndexUsageInfo>
): AsmProgram {
  // Analyze global index pressure
  let totalXPressure = 0;
  let totalYPressure = 0;
  
  for (const [, info] of analysis) {
    totalXPressure += info.xRequired.length;
    totalYPressure += info.yRequired.length;
  }
  
  // If Y is under more pressure, try to move some X uses to Y
  // (This is a heuristic - real implementation needs more analysis)
  
  return program;
}
```

### Pattern 3: Minimize Index Transfers

Avoid unnecessary TAX/TXA/TAY/TYA when index already has correct value.

```asm
; Before
LDX counter
; ... code that doesn't touch X ...
TXA             ; Redundant if A not needed
TAX             ; Completely pointless!

; After
LDX counter
; ... code that doesn't touch X ...
; (transfers removed)
```

```typescript
/**
 * Remove unnecessary index register transfers.
 */
protected minimizeTransfers(
  program: AsmProgram,
  analysis: Map<string, IndexUsageInfo>
): AsmProgram {
  return this.mapBlocks(program, block => {
    const newInsts: AsmInstruction[] = [];
    
    // Track what's in each register
    let aValue: RegisterValue = { known: false };
    let xValue: RegisterValue = { known: false };
    let yValue: RegisterValue = { known: false };
    
    for (const inst of block.instructions) {
      // Check for redundant transfer
      if (this.isRedundantTransfer(inst, aValue, xValue, yValue)) {
        continue;  // Skip this instruction
      }
      
      // Update register tracking
      this.updateRegisterValues(inst, aValue, xValue, yValue);
      
      newInsts.push(inst);
    }
    
    return { ...block, instructions: newInsts };
  });
}

/**
 * Check if transfer instruction is redundant.
 */
protected isRedundantTransfer(
  inst: AsmInstruction,
  aValue: RegisterValue,
  xValue: RegisterValue,
  yValue: RegisterValue
): boolean {
  switch (inst.opcode) {
    case Opcode.TAX:
      // TAX redundant if X already equals A
      return xValue.known && aValue.known && 
             xValue.value === aValue.value;
      
    case Opcode.TXA:
      // TXA redundant if A already equals X
      return aValue.known && xValue.known &&
             aValue.value === xValue.value;
      
    case Opcode.TAY:
      return yValue.known && aValue.known &&
             yValue.value === aValue.value;
      
    case Opcode.TYA:
      return aValue.known && yValue.known &&
             aValue.value === yValue.value;
      
    default:
      return false;
  }
}
```

---

## Array Access Patterns

### Sequential Array Iteration

```asm
; Optimal pattern for sequential access
    LDX #0
.loop:
    LDA array,X
    ; process element
    INX
    CPX #length
    BNE .loop
```

### Pointer-Based Array Access

```asm
; Optimal pattern for pointer + offset
    LDA #<array
    STA ptr
    LDA #>array
    STA ptr+1
    
    LDY #0
.loop:
    LDA (ptr),Y     ; Y is required here!
    ; process element
    INY
    CPY #length
    BNE .loop
```

### Two-Dimensional Array

```asm
; Row-major 2D array: arr[row][col]
; X = row * width, Y = col
    LDX row_offset  ; Pre-calculated row * width
    LDY col
    LDA array,X     ; Get arr[row][0]
    ; For arr[row][col], need different approach
    
; Better: Use pointer
    ; ptr = array + row * width
    LDY col
    LDA (ptr),Y     ; arr[row][col]
```

---

## C64-Specific Considerations

### Sprite Access Pattern

Sprites are typically accessed with fixed offsets (0-62 bytes):

```asm
; Sprite data access - Y is ideal for fixed offsets
    LDA #<sprite_data
    STA $FB
    LDA #>sprite_data
    STA $FC
    
    LDY #0
.copy_sprite:
    LDA (ptr),Y     ; Must use Y!
    STA sprite_buffer,Y
    INY
    CPY #63
    BNE .copy_sprite
```

### Screen Memory Access

Screen memory is 1000 bytes (40×25), often accessed row by row:

```asm
; Screen row access - X for column index
    LDX #0
.clear_row:
    LDA #$20        ; Space character
    STA $0400,X     ; Screen row start
    INX
    CPX #40
    BNE .clear_row
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('IndexedAddressingPass', () => {
  describe('ZP conversion', () => {
    it('converts absolute,X to zeropage,X when address fits', () => {
      const program = parseAsm(`
        LDA $0050,X     ; Address fits in ZP
      `);
      
      const result = pass.run(program, context);
      
      expect(result.blocks[0].instructions[0]).toMatchObject({
        addressingMode: AddressingMode.ZeroPageX,
        operand: { value: 0x50 },
      });
    });
    
    it('preserves absolute,X when address > $FF', () => {
      const program = parseAsm(`
        LDA $0400,X     ; Address too large
      `);
      
      const result = pass.run(program, context);
      
      expect(result.blocks[0].instructions[0].addressingMode)
        .toBe(AddressingMode.AbsoluteX);
    });
    
    it('only converts to ZP,Y for LDX/STX', () => {
      const program = parseAsm(`
        LDA $0050,Y     ; LDA doesn't support ZP,Y
        LDX $0050,Y     ; LDX does support ZP,Y
      `);
      
      const result = pass.run(program, context);
      
      // LDA stays absolute
      expect(result.blocks[0].instructions[0].addressingMode)
        .toBe(AddressingMode.AbsoluteY);
      // LDX converts
      expect(result.blocks[0].instructions[1].addressingMode)
        .toBe(AddressingMode.ZeroPageY);
    });
  });
  
  describe('transfer elimination', () => {
    it('removes TAX when X already equals A', () => {
      const program = parseAsm(`
        LDA #5
        TAX             ; X = 5
        ; ... code not touching A or X ...
        TAX             ; Redundant!
      `);
      
      const result = pass.run(program, context);
      
      // Should have only one TAX
      const taxCount = result.blocks[0].instructions
        .filter(i => i.opcode === Opcode.TAX).length;
      expect(taxCount).toBe(1);
    });
    
    it('removes round-trip TXA;TAX', () => {
      const program = parseAsm(`
        LDX #5
        TXA             ; A = X
        TAX             ; X = A (same value!)
      `);
      
      const result = pass.run(program, context);
      
      // TAX should be removed (X unchanged)
      expect(result.blocks[0].instructions.length).toBe(2);
    });
  });
  
  describe('index analysis', () => {
    it('identifies X-required instructions', () => {
      const program = parseAsm(`
        LDA $50,X       ; Requires X
        LDA (ptr,X)     ; Requires X
      `);
      
      const analysis = pass.analyzeIndexUsage(program, context);
      
      expect(analysis.get('main')?.xRequired.length).toBe(2);
    });
    
    it('identifies Y-required instructions', () => {
      const program = parseAsm(`
        LDA (ptr),Y     ; Requires Y (indirect Y)
      `);
      
      const analysis = pass.analyzeIndexUsage(program, context);
      
      expect(analysis.get('main')?.yRequired.length).toBe(1);
    });
  });
});
```

### Integration Tests

```typescript
describe('Indexed Addressing Integration', () => {
  it('optimizes array iteration', () => {
    const blend = `
      let arr: byte[10] @ $50;  // ZP array
      
      function sum(): byte {
        let total: byte = 0;
        for (let i: byte = 0; i < 10; i++) {
          total = total + arr[i];
        }
        return total;
      }
    `;
    
    const result = compile(blend, { optimize: true });
    
    // Should use ZP,X not Absolute,X
    const loads = result.asm.filter(i => 
      i.opcode === 'LDA' && i.operand.includes(',X')
    );
    expect(loads.every(l => l.addressingMode === 'zp,X')).toBe(true);
  });
  
  it('uses indirect Y for pointer access', () => {
    const blend = `
      function copy(src: *byte, dst: *byte, len: byte): void {
        for (let i: byte = 0; i < len; i++) {
          dst[i] = src[i];
        }
      }
    `;
    
    const result = compile(blend, { optimize: true });
    
    // Should use (ptr),Y addressing
    const indirectY = result.asm.filter(i =>
      i.addressingMode === 'indirect-y'
    );
    expect(indirectY.length).toBeGreaterThan(0);
  });
});
```

---

## Configuration

```typescript
interface IndexedAddressingOptions {
  /** Enable absolute to ZP conversion */
  convertToZP: boolean;
  
  /** Enable index register swapping */
  allowIndexSwap: boolean;
  
  /** Enable transfer elimination */
  eliminateTransfers: boolean;
  
  /** Prefer X for iteration (conventional) */
  preferXForLoop: boolean;
}

export const DEFAULT_INDEX_OPTIONS: IndexedAddressingOptions = {
  convertToZP: true,
  allowIndexSwap: true,
  eliminateTransfers: true,
  preferXForLoop: true,
};
```

---

## Summary

**Indexed Addressing Optimization** improves code by:

| Optimization | Benefit |
|--------------|---------|
| Absolute → ZP indexed | 1 byte per instruction |
| Smart index selection | Fewer transfers, better modes |
| Transfer elimination | 2 cycles per removed TAX/TYA |

**Key principles**:
1. Use X for loop counters and ZP indexed access
2. Reserve Y for indirect indexed `(ptr),Y` mode
3. Convert to ZP indexed when possible
4. Minimize register transfers

---

**Previous**: [Zero-Page Promotion](01-zp-promotion.md)  
**Next**: [Flag Optimization](03-flag-opt.md)