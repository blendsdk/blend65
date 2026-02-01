# Blend Integration: Code Generator Integration

> **Document**: blend-integration/05-codegen-integration.md
> **Parent**: [00-overview.md](00-overview.md)
> **Status**: Design Complete
> **Last Updated**: 2025-02-01

## Overview

This document describes how the Frame Allocator integrates with the Code Generator in Blend65 compiler-v2. The code generator receives IL with fully resolved addresses and generates 6502 assembly. The main integration point is using **ZP vs RAM addressing modes** based on slot location.

---

## Integration Point

The code generator receives IL with addresses already resolved. Its main frame-related responsibility is:

1. **Use correct addressing modes** - ZP addresses use shorter, faster instructions
2. **Generate frame comments** - Document frame layout for debugging
3. **Emit runtime code** - No frame setup/teardown needed (static allocation!)

```
┌─────────────────────────────────────────────────────────────────┐
│                       CODE GENERATOR                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Input:                                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      ILProgram                            │   │
│  │                                                           │   │
│  │  • functions[]: ILFunction                                │   │
│  │    - name: string                                         │   │
│  │    - frame: Frame (includes slot locations)               │   │
│  │    - instructions[]: ILInstruction (absolute addresses)   │   │
│  │                                                           │   │
│  │  • frameMap: FrameMap (for cross-function reference)      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │               ADDRESSING MODE SELECTION                    │  │
│  │                                                            │  │
│  │  For each memory operation:                                │  │
│  │    1. Check if address is in ZP range ($00-$FF)            │  │
│  │    2. If ZP: use zero page addressing mode                 │  │
│  │    3. If RAM: use absolute addressing mode                 │  │
│  │                                                            │  │
│  │  ZP Example:  LDA $02    ; 3 cycles, 2 bytes               │  │
│  │  RAM Example: LDA $0200  ; 4 cycles, 3 bytes               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│  Output:                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  6502 Assembly (ACME)                     │   │
│  │                                                           │   │
│  │  • Optimized addressing modes                             │   │
│  │  • Frame layout comments                                  │   │
│  │  • No prologue/epilogue (static frames!)                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6502 Addressing Mode Optimization

### ZP vs Absolute Addressing

The 6502 has special shorter, faster addressing modes for zero page ($00-$FF):

| Mode | Instruction | Bytes | Cycles | Example |
|------|-------------|-------|--------|---------|
| ZP | `LDA $02` | 2 | 3 | Load from ZP address |
| Absolute | `LDA $0200` | 3 | 4 | Load from RAM address |
| ZP,X | `LDA $02,X` | 2 | 4 | ZP indexed |
| Absolute,X | `LDA $0200,X` | 3 | 4+ | RAM indexed |

### Performance Impact

For variables accessed frequently (e.g., in loops), ZP saves:
- **1 byte per instruction** (smaller code)
- **1 cycle per instruction** (faster execution)

In a loop that runs 1000 times with 10 variable accesses:
- ZP: 10,000 × 3 cycles = 30,000 cycles
- RAM: 10,000 × 4 cycles = 40,000 cycles
- **Savings: 10,000 cycles (25% faster)**

---

## Code Generator Modifications

### Address Formatting

```typescript
// codegen/generator.ts

/**
 * Format an address for 6502 assembly.
 * Uses ZP format for addresses in $00-$FF range.
 * 
 * @param addr - Absolute memory address
 * @returns Formatted address string (e.g., "$02" or "$0200")
 */
protected formatAddress(addr: number): string {
  if (addr <= 0xFF) {
    // Zero page - use 2-digit hex
    return `$${addr.toString(16).toUpperCase().padStart(2, '0')}`;
  } else {
    // Absolute - use 4-digit hex
    return `$${addr.toString(16).toUpperCase().padStart(4, '0')}`;
  }
}

/**
 * Check if an address is in zero page.
 * 
 * @param addr - Address to check
 * @returns True if address is in ZP range
 */
protected isZeroPage(addr: number): boolean {
  return addr >= 0x00 && addr <= 0xFF;
}
```

### Memory Operations with ZP Awareness

```typescript
/**
 * Generate load byte instruction with optimal addressing mode.
 */
protected genLoadByte(instr: ILInstruction): void {
  const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
  
  // Track accumulator state for optimization
  if (this.aRegister.known && this.aRegister.address === addr) {
    // Value already in A - skip redundant load
    return;
  }
  
  // Use ZP or absolute addressing based on address range
  if (this.isZeroPage(addr)) {
    // Zero page: 2 bytes, 3 cycles
    this.asm.instruction('LDA', this.formatAddress(addr));
  } else {
    // Absolute: 3 bytes, 4 cycles
    this.asm.instruction('LDA', this.formatAddress(addr));
  }
  
  this.aRegister = { known: true, address: addr };
}

/**
 * Generate store byte instruction with optimal addressing mode.
 */
protected genStoreByte(instr: ILInstruction): void {
  const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
  
  // STA uses same format - ACME assembler handles ZP optimization
  this.asm.instruction('STA', this.formatAddress(addr));
  
  this.aRegister = { known: true, address: addr };
}

/**
 * Generate add byte instruction with optimal addressing mode.
 */
protected genAddByte(instr: ILInstruction): void {
  const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
  
  this.asm.instruction('CLC');
  this.asm.instruction('ADC', this.formatAddress(addr));
  
  this.aRegister = { known: false };
}
```

---

## Function Generation with Frame Comments

### Frame Layout Comments

Generate helpful comments showing frame layout:

```typescript
/**
 * Generate code for a function with frame documentation.
 */
protected generateFunction(func: ILFunction): void {
  this.currentFunction = func.name;
  this.aRegister = { known: false };

  // Emit function header with frame info
  this.asm.blank();
  this.asm.comment('═'.repeat(60));
  this.asm.comment(`Function: ${func.name}`);
  this.asm.comment('═'.repeat(60));
  
  // Document frame layout
  this.emitFrameLayoutComment(func.frame);
  
  // Emit function label
  this.asm.label(func.name);

  // Generate each IL instruction
  for (const instr of func.instructions) {
    this.generateInstruction(instr);
  }
}

/**
 * Emit frame layout as comments for debugging.
 */
protected emitFrameLayoutComment(frame: Frame): void {
  this.asm.comment(`Frame: base=$${frame.frameBaseAddress.toString(16).toUpperCase()}, size=${frame.totalFrameSize}`);
  
  // Separate ZP and RAM slots
  const zpSlots = frame.slots.filter(s => s.location === SlotLocation.ZeroPage);
  const ramSlots = frame.slots.filter(s => s.location === SlotLocation.Ram);
  
  if (zpSlots.length > 0) {
    this.asm.comment('Zero Page slots:');
    for (const slot of zpSlots) {
      const addr = slot.address;
      this.asm.comment(`  ${slot.name}: $${addr.toString(16).toUpperCase().padStart(2, '0')} (${slot.size} byte${slot.size > 1 ? 's' : ''})`);
    }
  }
  
  if (ramSlots.length > 0) {
    this.asm.comment('RAM slots:');
    for (const slot of ramSlots) {
      const addr = slot.address;
      this.asm.comment(`  ${slot.name}: $${addr.toString(16).toUpperCase().padStart(4, '0')} (${slot.size} byte${slot.size > 1 ? 's' : ''})`);
    }
  }
  
  this.asm.comment('─'.repeat(60));
}
```

### Example Output

```asm
; ════════════════════════════════════════════════════════════
; Function: game_loop
; ════════════════════════════════════════════════════════════
; Frame: base=$0200, size=8
; Zero Page slots:
;   counter: $02 (1 byte)
;   ptr: $03 (2 bytes)
; RAM slots:
;   score: $0200 (2 bytes)
;   temp: $0202 (1 byte)
; ────────────────────────────────────────────────────────────
game_loop:
    LDA $02           ; load counter (ZP)
    CLC
    ADC #1
    STA $02           ; store counter (ZP)
    
    LDA $0200         ; load score (RAM)
    CLC
    ADC #10
    STA $0200         ; store score (RAM)
    
    RTS
```

---

## No Prologue/Epilogue Needed!

### Traditional Stack-Based vs SFA

**Traditional (with stack):**
```asm
my_function:
    ; Prologue - save registers, allocate locals
    PHA               ; Save A
    TXA
    PHA               ; Save X
    TYA
    PHA               ; Save Y
    TSX               ; Get stack pointer
    ; ... allocate locals on stack
    
    ; ... function body ...
    
    ; Epilogue - deallocate locals, restore registers
    ; ... deallocate locals
    PLA               ; Restore Y
    TAY
    PLA               ; Restore X
    TAX
    PLA               ; Restore A
    RTS
```

**SFA (static allocation):**
```asm
my_function:
    ; No prologue needed - locals already have addresses!
    
    ; ... function body ...
    
    RTS               ; No epilogue needed!
```

### Benefits

1. **No stack manipulation** - Variables have fixed addresses
2. **No register saves** - Unless explicitly needed
3. **Faster function calls** - Just JSR/RTS
4. **Simpler code generation** - No stack frame tracking

---

## Platform-Specific Code

### Address Region Configuration

```typescript
// codegen/platform.ts

/**
 * Platform-specific memory configuration.
 */
export interface PlatformCodegenConfig {
  /** Name of the platform */
  name: string;
  
  /** Start of zero page available for compiler */
  zpStart: number;
  
  /** End of zero page available for compiler */
  zpEnd: number;
  
  /** Start of frame region */
  frameStart: number;
  
  /** End of frame region */
  frameEnd: number;
  
  /** Base address for code */
  codeBase: number;
  
  /** BASIC stub required? */
  basicStub: boolean;
}

/**
 * C64 platform configuration.
 */
export const C64_CODEGEN_CONFIG: PlatformCodegenConfig = {
  name: 'C64',
  zpStart: 0x02,
  zpEnd: 0x8F,
  frameStart: 0x0200,
  frameEnd: 0x0400,
  codeBase: 0x0801,
  basicStub: true,
};

/**
 * Commander X16 platform configuration.
 */
export const X16_CODEGEN_CONFIG: PlatformCodegenConfig = {
  name: 'X16',
  zpStart: 0x22,
  zpEnd: 0x7F,
  frameStart: 0x0400,
  frameEnd: 0x0800,
  codeBase: 0x0801,
  basicStub: true,
};
```

### Platform-Specific Header

```typescript
/**
 * Emit platform-specific program header.
 */
protected emitHeader(program: ILProgram): void {
  this.asm.comment(`Blend65 v2 - ${this.config.name}`);
  this.asm.comment(`Module: ${program.moduleName}`);
  this.asm.blank();

  if (this.config.basicStub) {
    // BASIC stub for auto-run
    this.asm.directive(`*=$${this.config.codeBase.toString(16).toUpperCase()}`);
    this.emitBasicStub();
  }

  // Frame region reservation comment
  this.asm.blank();
  this.asm.comment('Frame Region:');
  this.asm.comment(`  Range: $${this.config.frameStart.toString(16).toUpperCase()}-$${this.config.frameEnd.toString(16).toUpperCase()}`);
  this.asm.comment(`  Used: ${program.frameMap.stats.frameRegionUsed} bytes`);
  if (program.frameMap.stats.zpUsed > 0) {
    this.asm.comment(`  ZP Used: ${program.frameMap.stats.zpUsed} bytes`);
  }
  this.asm.blank();

  // Entry point
  this.asm.label('_start');
  this.asm.instruction('JSR', '_init_globals');
  this.asm.instruction('JSR', 'main');
  this.asm.instruction('RTS');
}
```

---

## Indexed Addressing for Arrays

### Array Access with ZP Pointer

When array base is in ZP, we can use indirect indexed addressing:

```typescript
/**
 * Generate array element load with ZP optimization.
 */
protected generateArrayLoad(baseAddr: number, indexInA: boolean): void {
  if (this.isZeroPage(baseAddr)) {
    // ZP indirect indexed: LDA ($02),Y - very fast!
    if (!indexInA) {
      // Index already in Y
      this.asm.instruction('LDA', `(${this.formatAddress(baseAddr)}),Y`);
    } else {
      // Index in A, need to transfer to Y
      this.asm.instruction('TAY');
      this.asm.instruction('LDA', `(${this.formatAddress(baseAddr)}),Y`);
    }
  } else {
    // Absolute indexed or runtime calculation
    // More complex - depends on index size and type
    this.generateAbsoluteArrayLoad(baseAddr, indexInA);
  }
}
```

### Example: ZP Pointer Array Access

```asm
; Array pointer in ZP at $02-$03
; Index in Y register

    LDY #5            ; index = 5
    LDA ($02),Y       ; load array[5] - 5 cycles, 2 bytes!
    
; vs. Absolute (non-ZP pointer)
    LDY #5
    LDA ptr_lo        ; 4 cycles
    STA $FB
    LDA ptr_hi        ; 4 cycles
    STA $FC
    LDA ($FB),Y       ; 5 cycles - had to copy pointer first!
```

---

## Complete Code Generation Example

### Source Code

```js
function add(a: byte, b: byte): byte {
  return a + b;
}

function main(): void {
  let x: byte = 10;
  let y: byte = 20;
  let result: byte = add(x, y);
  poke($0400, result);
}
```

### Frame Allocation

```
add:
  ZP: a=$02, b=$03, __return=$04
  
main:
  RAM: x=$0200, y=$0201, result=$0202
```

### Generated Assembly

```asm
; Blend65 v2 - C64
; Module: main

*=$0801
; BASIC stub
    !byte $0C, $08, $0A, $00, $9E, $20, $32, $30, $36, $31, $00, $00, $00

; Frame Region:
;   Range: $0200-$0400
;   Used: 6 bytes
;   ZP Used: 3 bytes

_start:
    JSR _init_globals
    JSR main
    RTS

; ════════════════════════════════════════════════════════════
; Function: add
; ════════════════════════════════════════════════════════════
; Frame: base=$02 (ZP), size=3
; Zero Page slots:
;   a: $02 (1 byte)
;   b: $03 (1 byte)
;   __return: $04 (1 byte)
; ────────────────────────────────────────────────────────────
add:
    LDA $02           ; load a (ZP) - 3 cycles
    CLC
    ADC $03           ; add b (ZP) - 3 cycles
    STA $04           ; store __return (ZP)
    RTS

; ════════════════════════════════════════════════════════════
; Function: main
; ════════════════════════════════════════════════════════════
; Frame: base=$0200, size=3
; RAM slots:
;   x: $0200 (1 byte)
;   y: $0201 (1 byte)
;   result: $0202 (1 byte)
; ────────────────────────────────────────────────────────────
main:
    ; let x: byte = 10
    LDA #10
    STA $0200         ; store x
    
    ; let y: byte = 20
    LDA #20
    STA $0201         ; store y
    
    ; let result = add(x, y)
    LDA $0200         ; load x - 4 cycles
    STA $02           ; store to add.a (ZP)
    LDA $0201         ; load y - 4 cycles
    STA $03           ; store to add.b (ZP)
    JSR add
    LDA $04           ; load add.__return (ZP)
    STA $0202         ; store result
    
    ; poke($0400, result)
    LDA $0202         ; load result
    STA $0400         ; poke to screen
    
    RTS

_init_globals:
    RTS
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('CodeGenerator', () => {
  describe('addressing mode selection', () => {
    it('should use ZP addressing for addresses $00-$FF', () => {
      const il = createILInstruction(ILOpcode.LOAD_BYTE, { address: 0x02 });
      const asm = generator.generateInstruction(il);
      
      expect(asm).toContain('LDA $02');
      expect(asm).not.toContain('LDA $0002');
    });
    
    it('should use absolute addressing for addresses >= $0100', () => {
      const il = createILInstruction(ILOpcode.LOAD_BYTE, { address: 0x0200 });
      const asm = generator.generateInstruction(il);
      
      expect(asm).toContain('LDA $0200');
    });
  });
  
  describe('frame comments', () => {
    it('should emit frame layout comments', () => {
      const frame = createTestFrame({
        name: 'test',
        slots: [
          { name: 'x', address: 0x02, location: SlotLocation.ZeroPage },
          { name: 'y', address: 0x0200, location: SlotLocation.Ram },
        ]
      });
      
      const ilFunc = createILFunction('test', frame, []);
      const asm = generator.generateFunction(ilFunc);
      
      expect(asm).toContain('Zero Page slots:');
      expect(asm).toContain('x: $02');
      expect(asm).toContain('RAM slots:');
      expect(asm).toContain('y: $0200');
    });
  });
  
  describe('no prologue/epilogue', () => {
    it('should not emit stack manipulation for function entry/exit', () => {
      const frame = createTestFrame({ name: 'simple' });
      const ilFunc = createILFunction('simple', frame, [
        { opcode: ILOpcode.RETURN, operands: [] }
      ]);
      
      const asm = generator.generateFunction(ilFunc);
      
      expect(asm).not.toContain('PHA');
      expect(asm).not.toContain('PLA');
      expect(asm).not.toContain('TSX');
      expect(asm).toContain('RTS');
    });
  });
});
```

### Integration Tests

```typescript
describe('Full Pipeline with Frame Allocation', () => {
  it('should generate optimized code with ZP variables', async () => {
    const source = `
      function hot_loop(): void {
        @zp let counter: byte = 0;
        while (counter < 100) {
          counter = counter + 1;
        }
      }
    `;
    
    const asm = await compile(source);
    
    // ZP variable should use short addressing
    expect(asm).toContain('LDA $');  // ZP format (2 digits)
    expect(asm).not.toContain('LDA $0');  // Not absolute format (4 digits)
    
    // Verify cycle count is optimal for hot loop
    const loadCycles = countCycles(asm, /LDA \$[0-9A-F]{2}/);
    expect(loadCycles).toBe(3);  // ZP load = 3 cycles
  });
});
```

---

## Summary

The code generator integration focuses on:

1. **Addressing mode optimization** - ZP addresses use shorter, faster instructions
2. **Frame documentation** - Comments show frame layout for debugging
3. **No prologue/epilogue** - SFA eliminates stack frame overhead
4. **Platform-specific code** - Handle C64, X16, etc. differences

The key insight is that **the code generator doesn't need to manage frames at runtime** - all addresses are static and known at compile time. This makes code generation simpler and produces faster code.

---

## Related Documents

| Document | Description |
|----------|-------------|
| [00-overview.md](00-overview.md) | Integration overview |
| [03-semantic-integration.md](03-semantic-integration.md) | Semantic integration |
| [04-il-integration.md](04-il-integration.md) | IL generator integration |
| [../../compiler-v2/09-code-generator.md](../../compiler-v2/09-code-generator.md) | Compiler v2 codegen spec |