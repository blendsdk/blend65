# @map Memory-Mapped Variables - Compiler Architecture

> **Document Purpose:** Architecture and implementation strategy for `@map` memory-mapped variable feature in Blend65 compiler pipeline.
>
> **Date:** January 8, 2026
> **Status:** Design Document

---

## Table of Contents

1. [Overview](#overview)
2. [Compiler Pipeline Stages](#compiler-pipeline-stages)
3. [AST Node Design](#ast-node-design)
4. [Symbol Table Strategy](#symbol-table-strategy)
5. [Code Generation Strategy](#code-generation-strategy)
6. [Implementation Examples](#implementation-examples)
7. [Design Rationale](#design-rationale)

---

## Overview

The `@map` feature enables **direct memory-mapped access** to hardware registers in 6502 systems without peek/poke overhead. Since Blend65 compiles to native 6502 assembly, memory-mapped variables translate to **direct LDA/STA instructions** at specific addresses.

**Key Insight:** No runtime peek/poke gymnastics needed - just direct memory access at compile time!

---

## Compiler Pipeline Stages

### Stage 1: Lexer ✅ (COMPLETED)

**Responsibility:** Tokenize `@map` syntax

**Tokens Added:**
- `@map` (MAP) - Storage class keyword
- `at` (AT) - Address specifier keyword  
- `layout` (LAYOUT) - Explicit layout keyword

**Status:** ✅ Implemented with 26 passing tests

---

### Stage 2: Parser (TODO)

**Responsibility:** Parse `@map` declarations and build AST nodes

**Grammar to Parse:**
```ebnf
(* Simple memory-mapped variable *)
simple_map_decl = "@map" , identifier , "at" , address , ":" , type_name , ";" ;

(* Range memory-mapped array *)
range_map_decl = "@map" , identifier , "from" , address , "to" , address , ":" , type_name , ";" ;

(* Structured memory-mapped type - sequential layout *)
sequential_struct_map_decl = "@map" , identifier , "at" , address , "type"
                            , { NEWLINE }
                            , field_list
                            , "end" , "@map" ;

(* Structured memory-mapped type - explicit layout *)
explicit_struct_map_decl = "@map" , identifier , "at" , address , "layout"
                         , { NEWLINE }
                         , explicit_field_list
                         , "end" , "@map" ;
```

**AST Nodes Created:** See [AST Node Design](#ast-node-design) section

---

### Stage 3: Semantic Analysis (TODO)

**Responsibility:** Validate `@map` declarations and build symbol table

**Tasks:**
1. **Address Validation**
   - Check for address overlaps between `@map` declarations
   - Validate addresses are within valid 6502 memory range ($0000-$FFFF)
   - Warn about common system memory conflicts

2. **Type Checking**
   - Verify field access is valid (struct members exist)
   - Check array bounds (if indices are constant)
   - Ensure correct data types (byte/word)

3. **Symbol Table Construction**
   - Create entries for each `@map` variable
   - Track metadata: address, size, type, fields
   - Mark as `memory-mapped` kind

4. **Scope Validation**
   - Enforce module-scope only rule
   - Error if `@map` appears inside functions

**Symbol Table Entries:** See [Symbol Table Strategy](#symbol-table-strategy) section

---

### Stage 4: Code Generation (TODO) ✨

**Responsibility:** Emit direct 6502 memory access instructions

**Critical Decision:** When generating code for variable access, check if variable is memory-mapped:

```typescript
if (symbol.kind === 'memory-mapped') {
  // Emit direct LDA/STA to fixed address
  return generateDirectMemoryAccess(symbol);
} else {
  // Emit normal variable access
  return generateVariableAccess(symbol);
}
```

**Code Generation Patterns:** See [Code Generation Strategy](#code-generation-strategy) section

---

## AST Node Design

### Base Interface

```typescript
interface MapDeclarationBase extends ASTNode {
  kind: 'MapDeclaration';
  name: string;
  // Specific variant determined by 'variant' field
}
```

### Variant 1: Simple Map Declaration

```typescript
interface SimpleMapDeclaration extends MapDeclarationBase {
  variant: 'simple';
  address: number;           // e.g., 0xD020
  dataType: 'byte' | 'word';
}

// Example AST:
// @map vicBorderColor at $D020: byte;
{
  kind: 'MapDeclaration',
  variant: 'simple',
  name: 'vicBorderColor',
  address: 0xD020,
  dataType: 'byte'
}
```

### Variant 2: Range Map Declaration

```typescript
interface RangeMapDeclaration extends MapDeclarationBase {
  variant: 'range';
  startAddress: number;      // e.g., 0xD000
  endAddress: number;        // e.g., 0xD02E
  dataType: 'byte' | 'word';
  
  // Computed properties:
  get length(): number {
    return this.endAddress - this.startAddress + 1;
  }
}

// Example AST:
// @map spriteRegisters from $D000 to $D02E: byte;
{
  kind: 'MapDeclaration',
  variant: 'range',
  name: 'spriteRegisters',
  startAddress: 0xD000,
  endAddress: 0xD02E,
  dataType: 'byte',
  length: 47  // Computed: 0xD02E - 0xD000 + 1
}
```

### Variant 3: Sequential Struct Map Declaration

```typescript
interface SequentialStructMapDeclaration extends MapDeclarationBase {
  variant: 'sequential-struct';
  baseAddress: number;       // e.g., 0xD400
  fields: FieldDefinition[];
}

interface FieldDefinition {
  name: string;
  type: TypeExpression;
  // Address computed automatically based on layout order
  computedAddress?: number;
  computedSize?: number;
}

// Example AST:
// @map sid at $D400 type
//   frequencyLo: byte,
//   frequencyHi: byte
// end @map
{
  kind: 'MapDeclaration',
  variant: 'sequential-struct',
  name: 'sid',
  baseAddress: 0xD400,
  fields: [
    { name: 'frequencyLo', type: { kind: 'byte' }, computedAddress: 0xD400, computedSize: 1 },
    { name: 'frequencyHi', type: { kind: 'byte' }, computedAddress: 0xD401, computedSize: 1 }
  ]
}
```

### Variant 4: Explicit Struct Map Declaration

```typescript
interface ExplicitStructMapDeclaration extends MapDeclarationBase {
  variant: 'explicit-struct';
  baseAddress: number;       // e.g., 0xD000 (for documentation)
  fields: ExplicitFieldDefinition[];
}

interface ExplicitFieldDefinition {
  name: string;
  address: FieldAddress;
  type: 'byte' | 'word';
}

type FieldAddress = 
  | { kind: 'single'; address: number }           // at $D020
  | { kind: 'range'; start: number; end: number } // from $D000 to $D00F

// Example AST:
// @map vic at $D000 layout
//   borderColor: at $D020: byte,
//   sprites: from $D000 to $D00F: byte
// end @map
{
  kind: 'MapDeclaration',
  variant: 'explicit-struct',
  name: 'vic',
  baseAddress: 0xD000,
  fields: [
    { 
      name: 'borderColor', 
      address: { kind: 'single', address: 0xD020 },
      type: 'byte'
    },
    { 
      name: 'sprites',
      address: { kind: 'range', start: 0xD000, end: 0xD00F },
      type: 'byte'
    }
  ]
}
```

---

## Symbol Table Strategy

### Symbol Table Entry Structure

```typescript
interface SymbolTableEntry {
  name: string;
  kind: 'variable' | 'memory-mapped' | 'function' | 'type';
  scope: Scope;
  
  // For regular variables:
  variable?: {
    dataType: Type;
    storageClass: '@zp' | '@ram' | '@data';
    allocatedAddress?: number;  // Determined by linker
    size: number;
  };
  
  // For memory-mapped variables:
  memoryMapped?: {
    mapType: 'simple' | 'range' | 'sequential-struct' | 'explicit-struct';
    address: number;              // Base or single address
    size: number;                 // Total bytes occupied
    dataType: 'byte' | 'word';
    isArray: boolean;
    arrayLength?: number;
    fields?: Map<string, FieldInfo>;  // For struct variants
  };
}

interface FieldInfo {
  name: string;
  address: number;
  size: number;
  dataType: 'byte' | 'word';
  isArray: boolean;
  arrayLength?: number;
}
```

### Symbol Table Operations

```typescript
class SymbolTable {
  /**
   * Check if a variable is memory-mapped
   */
  isMemoryMapped(name: string): boolean {
    const entry = this.lookup(name);
    return entry?.kind === 'memory-mapped';
  }
  
  /**
   * Get address for memory-mapped variable
   */
  getMemoryAddress(name: string, field?: string, index?: number): number {
    const entry = this.lookup(name);
    if (entry.kind !== 'memory-mapped') {
      throw new Error(`${name} is not memory-mapped`);
    }
    
    const mm = entry.memoryMapped;
    
    // Handle field access: vic.borderColor
    if (field) {
      const fieldInfo = mm.fields?.get(field);
      if (!fieldInfo) {
        throw new Error(`Field ${field} not found in ${name}`);
      }
      return fieldInfo.address;
    }
    
    // Handle array access: spriteRegisters[3]
    if (index !== undefined) {
      if (!mm.isArray) {
        throw new Error(`${name} is not an array`);
      }
      const elementSize = mm.dataType === 'byte' ? 1 : 2;
      return mm.address + (index * elementSize);
    }
    
    // Simple access: vicBorderColor
    return mm.address;
  }
  
  /**
   * Validate no address overlaps between @map declarations
   */
  validateMemoryMappedAddresses(): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const ranges: Array<{name: string, start: number, end: number}> = [];
    
    for (const entry of this.entries.values()) {
      if (entry.kind === 'memory-mapped') {
        const start = entry.memoryMapped.address;
        const end = start + entry.memoryMapped.size - 1;
        
        // Check for overlaps
        for (const existing of ranges) {
          if (this.rangesOverlap(start, end, existing.start, existing.end)) {
            diagnostics.push({
              severity: 'error',
              message: `Memory-mapped variable '${entry.name}' overlaps with '${existing.name}'`,
              range: { start, end }
            });
          }
        }
        
        ranges.push({ name: entry.name, start, end });
      }
    }
    
    return diagnostics;
  }
}
```

---

## Code Generation Strategy

### Overview

**Key Principle:** Memory-mapped variables generate **direct memory access** instead of variable access.

### Code Generator Architecture

```typescript
class CodeGenerator {
  protected symbolTable: SymbolTable;
  protected output: string[] = [];
  
  /**
   * Generate code for variable assignment
   */
  generateAssignment(left: Expression, right: Expression): void {
    const symbol = this.symbolTable.lookup(this.getIdentifierName(left));
    
    if (symbol?.kind === 'memory-mapped') {
      this.generateMemoryMappedWrite(symbol, left, right);
    } else {
      this.generateVariableWrite(symbol, left, right);
    }
  }
  
  /**
   * Generate code for variable read
   */
  generateVariableRead(expr: Expression): void {
    const name = this.getIdentifierName(expr);
    const symbol = this.symbolTable.lookup(name);
    
    if (symbol?.kind === 'memory-mapped') {
      this.generateMemoryMappedRead(symbol, expr);
    } else {
      this.generateVariableRead(symbol, expr);
    }
  }
}
```

### Memory-Mapped Write Patterns

```typescript
protected generateMemoryMappedWrite(
  symbol: SymbolTableEntry,
  left: Expression,
  right: Expression
): void {
  // Generate code to load value into accumulator
  this.generateExpression(right);  // Result in A register
  
  // Determine target address based on expression type
  const address = this.resolveMemoryAddress(symbol, left);
  
  if (left.kind === 'Identifier') {
    // Simple: vicBorderColor = 5
    this.emit(`STA $${this.formatAddress(address)}`);
    
  } else if (left.kind === 'MemberExpression') {
    // Struct field: vic.borderColor = 5
    this.emit(`STA $${this.formatAddress(address)}`);
    
  } else if (left.kind === 'IndexExpression') {
    // Array access
    if (left.index.kind === 'NumericLiteral') {
      // Constant index: spriteRegisters[0] = 100
      this.emit(`STA $${this.formatAddress(address)}`);
    } else {
      // Dynamic index: spriteRegisters[i] = 100
      // Assume index already in X register
      this.emit(`STA $${this.formatAddress(symbol.memoryMapped.address)},X`);
    }
  }
}
```

### Memory-Mapped Read Patterns

```typescript
protected generateMemoryMappedRead(
  symbol: SymbolTableEntry,
  expr: Expression
): void {
  const address = this.resolveMemoryAddress(symbol, expr);
  
  if (expr.kind === 'Identifier') {
    // Simple: let x = vicBorderColor
    this.emit(`LDA $${this.formatAddress(address)}`);
    
  } else if (expr.kind === 'MemberExpression') {
    // Struct field: let x = vic.borderColor
    this.emit(`LDA $${this.formatAddress(address)}`);
    
  } else if (expr.kind === 'IndexExpression') {
    // Array access
    if (expr.index.kind === 'NumericLiteral') {
      // Constant index: let x = spriteRegisters[0]
      this.emit(`LDA $${this.formatAddress(address)}`);
    } else {
      // Dynamic index: let x = spriteRegisters[i]
      // Assume index in X register
      this.emit(`LDA $${this.formatAddress(symbol.memoryMapped.address)},X`);
    }
  }
}
```

---

## Implementation Examples

### Example 1: Simple Write

**Source Code:**
```javascript
@map vicBorderColor at $D020: byte;
vicBorderColor = 5;
```

**Generated Assembly:**
```asm
; vicBorderColor = 5
LDA #$05          ; Load immediate value 5
STA $D020         ; Store directly to VIC border color register
```

**No peek/poke runtime call needed!**

---

### Example 2: Simple Read

**Source Code:**
```javascript
@map vicBorderColor at $D020: byte;
let x: byte = vicBorderColor;
```

**Generated Assembly:**
```asm
; let x = vicBorderColor
LDA $D020         ; Load from VIC border color
STA ZP_X          ; Store to zero-page variable x
```

---

### Example 3: Range Array - Constant Index

**Source Code:**
```javascript
@map spriteRegisters from $D000 to $D02E: byte;
spriteRegisters[0] = 100;
spriteRegisters[2] = 150;
```

**Generated Assembly:**
```asm
; spriteRegisters[0] = 100
LDA #$64          ; Load 100
STA $D000         ; Store to $D000 + 0

; spriteRegisters[2] = 150
LDA #$96          ; Load 150
STA $D002         ; Store to $D000 + 2
```

**Addresses computed at compile time!**

---

### Example 4: Range Array - Dynamic Index

**Source Code:**
```javascript
@map spriteRegisters from $D000 to $D02E: byte;
let i: byte = 3;
spriteRegisters[i] = 200;
```

**Generated Assembly:**
```asm
; let i = 3
LDA #$03
STA ZP_I

; spriteRegisters[i] = 200
LDX ZP_I          ; Load index into X register
LDA #$C8          ; Load value 200
STA $D000,X       ; Store to $D000 + X (indexed addressing mode)
```

**Uses 6502 indexed addressing mode!**

---

### Example 5: Sequential Struct

**Source Code:**
```javascript
@map sid at $D400 type
  frequencyLo: byte,
  frequencyHi: byte,
  pulseLo: byte,
  pulseHi: byte,
  waveform: byte
end @map

sid.waveform = 0x41;  // Triangle wave + gate on
```

**Symbol Table (computed during semantic analysis):**
```typescript
{
  name: 'sid',
  kind: 'memory-mapped',
  memoryMapped: {
    mapType: 'sequential-struct',
    address: 0xD400,
    size: 5,
    fields: new Map([
      ['frequencyLo', { address: 0xD400, size: 1, dataType: 'byte' }],
      ['frequencyHi', { address: 0xD401, size: 1, dataType: 'byte' }],
      ['pulseLo',     { address: 0xD402, size: 1, dataType: 'byte' }],
      ['pulseHi',     { address: 0xD403, size: 1, dataType: 'byte' }],
      ['waveform',    { address: 0xD404, size: 1, dataType: 'byte' }]
    ])
  }
}
```

**Generated Assembly:**
```asm
; sid.waveform = 0x41
LDA #$41
STA $D404         ; Direct access to computed field address
```

---

### Example 6: Explicit Struct

**Source Code:**
```javascript
@map vic at $D000 layout
  sprites: from $D000 to $D00F: byte,
  spriteXMSB: at $D010: byte,
  raster: at $D012: byte,
  borderColor: at $D020: byte
end @map

vic.borderColor = 0;
let line: byte = vic.raster;
```

**Generated Assembly:**
```asm
; vic.borderColor = 0
LDA #$00
STA $D020         ; Field address explicitly specified

; let line = vic.raster
LDA $D012         ; Read from explicitly specified field address
STA ZP_LINE
```

---

## Design Rationale

### Why No Peek/Poke?

**Traditional Approach (BASIC, interpreted languages):**
```basic
POKE 53280, 5     REM Set border color
X = PEEK(53280)   REM Read border color
```

**Problems:**
- Runtime function call overhead
- No type safety
- Error-prone (magic numbers)
- Poor readability

**Blend65 Approach:**
```javascript
@map vicBorderColor at $D020: byte;
vicBorderColor = 5;       // Direct STA $D020
let x = vicBorderColor;   // Direct LDA $D020
```

**Benefits:**
- ✅ Zero runtime overhead
- ✅ Type-safe (compiler knows it's a byte)
- ✅ Named constants (no magic numbers)
- ✅ Excellent readability
- ✅ Compile-time address validation

---

### Why Code Generation Stage?

**Alternative considered:** Transform AST during semantic analysis

**Rejected because:**
- ❌ Violates separation of concerns
- ❌ Makes compiler harder to maintain
- ❌ Prevents IR optimization passes
- ❌ Couples validation with implementation

**Code generation is correct stage because:**
- ✅ Separation: validation ≠ implementation
- ✅ Symbol table complete by this stage
- ✅ Platform-specific code isolated
- ✅ Could target different architectures later
- ✅ IR optimizations can happen between stages

---

### Why Four Declaration Forms?

**Simple** - Individual registers:
```javascript
@map vicBorderColor at $D020: byte;
```
✅ Most common case, cleanest syntax

**Range** - Contiguous memory:
```javascript
@map colorRAM from $D800 to $DBE7: byte;
```
✅ Perfect for screen memory, color RAM, sprite registers

**Sequential Struct** - Packed hardware:
```javascript
@map sid at $D400 type
  frequencyLo: byte,
  frequencyHi: byte
end @map
```
✅ Clean syntax for tightly-packed registers (SID voices)

**Explicit Struct** - Sparse hardware:
```javascript
@map vic at $D000 layout
  raster: at $D012: byte,
  borderColor: at $D020: byte
end @map
```
✅ Handles gaps and non-sequential layouts (VIC-II)

---

### Why Module-Scope Only?

**Design decision:** `@map` declarations only allowed at module scope, not inside functions.

**Rationale:**
1. **Semantic correctness** - Hardware registers have global scope
2. **No ambiguity** - Prevents shadowing and scope confusion
3. **Simpler implementation** - Symbol table lookup straightforward
4. **Better performance** - No stack allocation/deallocation
5. **Clearer intent** - Hardware mapping is inherently global

---

## Implementation Checklist

### ✅ Phase 1: Lexer (COMPLETED)
- [x] Add `@map`, `at`, `layout` tokens
- [x] Update lexer to recognize new keywords
- [x] Create 26 comprehensive tests
- [x] All tests passing

### 📝 Phase 2: Parser (TODO)
- [ ] Design AST node types for @map declarations
- [ ] Implement parser for simple @map
- [ ] Implement parser for range @map
- [ ] Implement parser for sequential struct @map
- [ ] Implement parser for explicit struct @map
- [ ] Add parser tests
- [ ] Validate syntax (end @map matching, etc.)

### 📝 Phase 3: Semantic Analysis (TODO)
- [ ] Design symbol table entries for memory-mapped variables
- [ ] Implement address overlap detection
- [ ] Implement type checking for field/array access
- [ ] Validate module-scope-only rule
- [ ] Compute addresses for sequential structs
- [ ] Add semantic analysis tests

### 📝 Phase 4: Code Generation (TODO)
- [ ] Implement memory-mapped write code generation
- [ ] Implement memory-mapped read code generation
- [ ] Handle constant array indices (compile-time address)
- [ ] Handle dynamic array indices (indexed addressing mode)
- [ ] Handle struct field access
- [ ] Add codegen tests
- [ ] Verify generated assembly is optimal

### 📝 Phase 5: Integration Testing (TODO)
- [ ] End-to-end tests: source → assembly
- [ ] Test all @map forms in real programs
- [ ] Performance benchmarks vs peek/poke
- [ ] Documentation and examples

---

## References

- **Language Specification:** `docs/language-specification.md` (Section: Memory-Mapped Variables)
- **Lexer Implementation:** `packages/compiler/src/lexer/lexer.ts`
- **Lexer Tests:** `packages/compiler/src/__tests__/lexer/map-declarations.test.ts`
- **6502 Addressing Modes:** http://www.6502.org/tutorials/6502opcodes.html

---

**Document Status:** Design Complete, Implementation In Progress
**Next Steps:** Implement Parser (Phase 2)
