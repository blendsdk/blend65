# Address-Of Operator and @address Type - Design & Implementation Plan

**Date:** January 8, 2026  
**Status:** Design Approved - Ready for Implementation  
**Feature:** Address-of operator (`@variable`) and `@address` type alias

---

## Table of Contents

1. [Overview](#overview)
2. [Motivation](#motivation)
3. [Design Decisions](#design-decisions)
4. [Language Specification](#language-specification)
5. [Implementation Strategy](#implementation-strategy)
6. [Use Cases and Examples](#use-cases-and-examples)
7. [Implementation Phases](#implementation-phases)
8. [Testing Strategy](#testing-strategy)
9. [Documentation Requirements](#documentation-requirements)
10. [Future Enhancements](#future-enhancements)

---

## Overview

This document specifies the design and implementation plan for two related features:

1. **Address-of operator (`@`)** - Retrieves the memory address of a variable
2. **`@address` type alias** - Syntactic sugar for `word` type to document address parameters

### Quick Example

```js
// @address is built-in alias for word (documentation only)
function copyMemory(src: @address, dst: @address, len: byte): void
  for i = 0 to len - 1
    poke(dst + i, peek(src + i));
  next i
end function

// Address-of operator (@) returns the address of a variable
@data const spriteData: byte[63] = [...];
@ram let activeSprite: byte[63];

copyMemory(@spriteData, @activeSprite, 63);  // Pass addresses
```

---

## Motivation

### Problem Statement

Without pointer/address support, developers cannot write generic memory manipulation functions:

**❌ Current Problem:**
```js
// Must write duplicate functions for each array
@data const spriteBank1: byte[252] = [...];
@data const spriteBank2: byte[252] = [...];
@ram let activeSprites: byte[252];

function copySpriteBank1ToActive(): void
  for i = 0 to 251
    activeSprites[i] = spriteBank1[i];  // Duplicate code!
  next i
end function

function copySpriteBank2ToActive(): void
  for i = 0 to 251
    activeSprites[i] = spriteBank2[i];  // Duplicate code!
  next i
end function
```

**✅ With Address-Of Operator:**
```js
function copyMemory(src: @address, dst: @address, len: byte): void
  for i = 0 to len - 1
    poke(dst + i, peek(src + i));
  next i
end function

// Now reusable!
copyMemory(@spriteBank1, @activeSprites, 252);
copyMemory(@spriteBank2, @activeSprites, 252);
```

### Key Benefits

1. **Reusable memory utilities** - Generic copy, fill, compare functions
2. **Self-documenting code** - `@address` type makes intent clear
3. **Zero runtime cost** - `@address` is compile-time alias
4. **Consistent with language** - `@` symbol already means "memory/address"
5. **C64 game development** - Essential for sprite banks, table lookups, screen manipulation

---

## Design Decisions

### Decision 1: `@address` is Type Alias, Not New Type

**Chosen:** `@address` is a **built-in type alias** for `word`

**Rationale:**
- Addresses ARE 16-bit words on 6502
- No new type checking rules needed
- Can freely mix `@address` and `word`
- Pure documentation benefit (zero cost)

**Type Equivalence:**
```js
let addr1: @address = 0xD020;
let addr2: word = addr1;        // ✅ OK - same type
let addr3: @address = addr2;    // ✅ OK - same type
```

### Decision 2: `@` for Address-Of (Not `&`)

**Chosen:** Use `@` prefix for address-of operator

**Rationale:**
- Consistent with existing `@zp`, `@ram`, `@data`, `@map` (memory/address theme)
- No confusion with bitwise `&` operator
- More readable than C's `&`
- Fits language philosophy

**Comparison:**
```js
// Blend65 - clear distinction
let addr: @address = @buffer;  // @ for address
let masked: byte = value & 0xFF;  // & for bitwise AND

// C - same symbol for two operations (confusing!)
int *ptr = &buffer;  // & for address
int masked = value & 0xFF;  // & for bitwise AND
```

### Decision 3: Address-Of Returns `@address` (Which Is `word`)

**Chosen:** Expression `@variable` has type `@address`

**Rationale:**
- Self-documenting (result is clearly an address)
- Allows using `@address` or `word` in function parameters
- Type checker treats them identically

**Example:**
```js
let addr1: @address = @myVar;  // ✅ Preferred (clear intent)
let addr2: word = @myVar;      // ✅ Also OK (same type)
```

### Decision 4: Allow `@` on Any Variable

**Chosen:** Address-of works on all variables (arrays, scalars, memory-mapped)

**Allowed:**
- `@arrayVariable` - Returns base address of array
- `@scalarVariable` - Returns address of scalar
- `@memoryMappedVariable` - Returns hardware address

**Not Allowed:**
- `@literal` - Error: literals have no address
- `@expression` - Error: expressions have no address
- `@(@variable)` - Error: addresses are values, not lvalues

---

## Language Specification

### Grammar Extensions

#### Type Names

```ebnf
type_name = "byte" 
          | "word" 
          | "@address"    (* Built-in alias for word *)
          | "void" 
          | "boolean"
          | "string" 
          | "callback"
          | identifier ;
```

#### Address-Of Expression

```ebnf
unary_expr = [ "!" | "~" | "+" | "-" | "@" ] , unary_expr
           | primary_expr ;

address_of_expr = "@" , identifier ;
```

#### Built-in Type Aliases

```js
// Compiler-provided type aliases (no declaration needed):
type @address = word;   // Memory address (16-bit)
type boolean = byte;    // Boolean value (8-bit)
```

### Type Rules

#### Type Equivalence

```
@address ≡ word

// All these are valid:
@address → word
word → @address
@address → @address
word → word
```

#### Type Checking

```typescript
// Type checker rules:
if (typeA === '@address') typeA = 'word';
if (typeB === '@address') typeB = 'word';
return typeA === typeB;
```

### Semantics

#### Address-Of Operator

**Syntax:** `@variable`

**Type:** `@address` (which is `word`)

**Semantics:** Returns the memory address of `variable` as a 16-bit value

**Compile-Time vs. Runtime:**
- For module-scope variables: Address resolved at link time
- For local variables: Address computed at runtime (stack pointer + offset)
- For memory-mapped variables: Address is constant (from `@map` declaration)

#### Examples

```js
// Module-scope variables
@data const table: byte[256] = [...];
let tableAddr: @address = @table;  // Link-time constant

// Local variables
function foo(): void
  let local: byte = 5;
  let localAddr: @address = @local;  // Runtime: SP + offset
end function

// Memory-mapped hardware
@map vicBorderColor at $D020: byte;
let vicAddr: @address = @vicBorderColor;  // Compile-time constant $D020
```

---

## Implementation Strategy

### Phase 1: Lexer (Minimal Changes)

**Current State:** Lexer already tokenizes `@` as part of storage classes

**Required Changes:**
1. Continue tokenizing `@` as `AT` token
2. Parser will determine context (storage class vs. address-of)

**No lexer changes needed!** ✅

### Phase 2: Parser

#### Parse Address-Of Expression

```typescript
class Parser {
  protected parseUnaryExpression(): Expression {
    // Handle address-of operator
    if (this.match(TokenType.AT)) {
      return this.parseAddressOfExpression();
    }
    
    // ... existing unary operators
  }
  
  protected parseAddressOfExpression(): AddressOfExpression {
    const atToken = this.previous();
    
    // Must be followed by identifier
    if (!this.check(TokenType.IDENTIFIER)) {
      throw this.error('Expected identifier after @');
    }
    
    const identifier = this.advance();
    
    return {
      kind: 'AddressOfExpression',
      operator: '@',
      operand: identifier.value,
      location: atToken.location
    };
  }
}
```

#### AST Node

```typescript
interface AddressOfExpression extends Expression {
  kind: 'AddressOfExpression';
  operator: '@';
  operand: string;  // Variable name
}
```

### Phase 3: Type Checker

#### Built-in Type Alias

```typescript
class TypeChecker {
  protected builtinTypeAliases: Map<string, string> = new Map([
    ['@address', 'word'],
    ['boolean', 'byte']
  ]);
  
  protected resolveType(typeName: string): ResolvedType {
    // Check if it's a built-in alias
    if (this.builtinTypeAliases.has(typeName)) {
      const aliasedType = this.builtinTypeAliases.get(typeName)!;
      return this.resolveType(aliasedType);
    }
    
    // ... rest of type resolution
  }
}
```

#### Address-Of Type Checking

```typescript
protected checkAddressOfExpression(expr: AddressOfExpression): Type {
  // Look up variable in symbol table
  const symbol = this.symbolTable.lookup(expr.operand);
  
  if (!symbol) {
    throw new Error(`Undefined variable: ${expr.operand}`);
  }
  
  // Check if we can take address of this variable
  if (!this.canTakeAddress(symbol)) {
    throw new Error(`Cannot take address of ${expr.operand}`);
  }
  
  // Address-of returns @address type (alias for word)
  return { kind: '@address' };
}

protected canTakeAddress(symbol: SymbolTableEntry): boolean {
  switch (symbol.kind) {
    case 'variable':        return true;  // ✅ Regular variables
    case 'memory-mapped':   return true;  // ✅ Hardware registers
    case 'constant':        return true;  // ✅ Const data
    case 'function':        return false; // ❌ Cannot take address of function
    case 'type':            return false; // ❌ Cannot take address of type
    default:                return false;
  }
}
```

### Phase 4: Symbol Table

#### Track Variable Addresses

```typescript
interface SymbolTableEntry {
  name: string;
  kind: 'variable' | 'memory-mapped' | 'constant' | 'function' | 'type';
  type: Type;
  
  // Address information
  address?: number;        // Resolved address (link time or runtime)
  addressKnown: boolean;   // Is address known at compile time?
  storageClass?: '@zp' | '@ram' | '@data';
  
  // For memory-mapped variables
  memoryMapped?: {
    fixedAddress: number;  // Hardware register address
  };
}
```

### Phase 5: Code Generation

#### Generate Address Load

```typescript
class CodeGenerator {
  protected generateAddressOfExpression(expr: AddressOfExpression): void {
    const symbol = this.symbolTable.lookup(expr.operand);
    
    if (symbol.kind === 'memory-mapped') {
      // Memory-mapped: address is compile-time constant
      this.generateLoadConstantWord(symbol.memoryMapped!.fixedAddress);
      
    } else if (symbol.addressKnown) {
      // Module-scope variable: address known at link time
      this.generateLoadAddress(symbol.name);
      
    } else {
      // Local variable: compute address at runtime
      this.generateComputeLocalAddress(symbol);
    }
  }
  
  protected generateLoadConstantWord(address: number): void {
    // Load immediate 16-bit value
    this.emit(`LDA #<$${address.toString(16)}`);  // Low byte
    this.emit(`STA resultLo`);
    this.emit(`LDA #>$${address.toString(16)}`);  // High byte
    this.emit(`STA resultHi`);
  }
  
  protected generateLoadAddress(symbolName: string): void {
    // Load address of symbol (resolved by linker)
    this.emit(`LDA #<${symbolName}`);
    this.emit(`STA resultLo`);
    this.emit(`LDA #>${symbolName}`);
    this.emit(`STA resultHi`);
  }
  
  protected generateComputeLocalAddress(symbol: SymbolTableEntry): void {
    // Compute address relative to stack/frame pointer
    // SP + offset → result
    // (Implementation depends on calling convention)
  }
}
```

---

## Use Cases and Examples

### Use Case 1: Generic Memory Copy

```js
module utils.memory

export function copyMemory(src: @address, dst: @address, len: byte): void
  for i = 0 to len - 1
    poke(dst + i, peek(src + i));
  next i
end function
```

**Usage:**
```js
import { copyMemory } from utils.memory

@data const spriteData: byte[63] = [...];
@ram let activeSprite: byte[63];

copyMemory(@spriteData, @activeSprite, 63);
```

**Generated Assembly (conceptual):**
```asm
; Load source address
LDA #<spriteData
STA src_lo
LDA #>spriteData
STA src_hi

; Load dest address
LDA #<activeSprite
STA dst_lo
LDA #>activeSprite
STA dst_hi

; Copy loop
LDY #0
loop:
  LDA (src_lo),Y
  STA (dst_lo),Y
  INY
  CPY #63
  BNE loop
```

### Use Case 2: Generic Memory Fill

```js
export function fillMemory(addr: @address, len: word, value: byte): void
  for i = 0 to len - 1
    poke(addr + i, value);
  next i
end function
```

**Usage:**
```js
@map screenRAM from $0400 to $07E7: byte;
@map colorRAM from $D800 to $DBE7: byte;

// Clear screen with spaces
fillMemory(@screenRAM, 1000, 32);

// Set all colors to light blue
fillMemory(@colorRAM, 1000, 14);

// Or use literals for direct addresses
fillMemory(0x0400, 1000, 32);  // word literal = @address
```

### Use Case 3: Table-Driven Interpolation

```js
@data const sineTable: byte[256] = [...];
@data const easeInTable: byte[256] = [...];
@data const easeOutTable: byte[256] = [...];

function interpolate(tableAddr: @address, index: byte): byte
  return peek(tableAddr + index);
end function

// Usage
let x: byte = interpolate(@sineTable, angle);
let y: byte = interpolate(@easeInTable, progress);
```

### Use Case 4: Multi-Sprite Bank Access

```js
// Import multi-sprite file as flat array
import allSprites from "./player.spd";  // byte[252] = 4 × 63

function setSpriteFromBank(spriteNum: byte, bankIndex: byte): void
  let spriteAddr: @address = @allSprites + (bankIndex * 63);
  
  // Copy sprite data to VIC-II memory
  copySpriteToVIC(spriteNum, spriteAddr);
end function

function copySpriteToVIC(spriteNum: byte, srcAddr: @address): void
  let destAddr: @address = 0x0800 + (spriteNum * 64);
  copyMemory(srcAddr, destAddr, 63);
end function
```

### Use Case 5: Screen Scrolling

```js
@map screenRAM from $0400 to $07E7: byte;

function scrollUp(): void
  // Scroll screen up one line (40 chars)
  // Copy lines 1-24 to lines 0-23
  copyMemory(@screenRAM + 40, @screenRAM, 960);
  
  // Clear bottom line
  fillMemory(@screenRAM + 960, 40, 32);
end function
```

---

## Implementation Phases

### Phase 1: Lexer ✅ (Already Done)
- [x] Lexer already tokenizes `@` as `AT` token
- [x] No changes needed

### Phase 2: Parser 📝 (TODO)
- [ ] Add `AddressOfExpression` AST node type
- [ ] Parse `@identifier` as unary expression
- [ ] Add parser tests for address-of expressions
- [ ] Handle error cases (e.g., `@5`, `@(expr)`)

**Estimated Time:** 2-3 hours

### Phase 3: Type Checker 📝 (TODO)
- [ ] Add `@address` to built-in type aliases
- [ ] Implement type resolution for `@address` → `word`
- [ ] Type check address-of expressions (return `@address`)
- [ ] Validate that operand is addressable
- [ ] Add type checking tests

**Estimated Time:** 3-4 hours

### Phase 4: Symbol Table 📝 (TODO)
- [ ] Extend symbol table entries with address information
- [ ] Track which variables have known addresses
- [ ] Store fixed addresses for memory-mapped variables
- [ ] Add symbol table tests

**Estimated Time:** 2-3 hours

### Phase 5: Code Generation 📝 (TODO)
- [ ] Generate code for address-of expressions
- [ ] Handle compile-time constant addresses
- [ ] Handle link-time addresses (module-scope variables)
- [ ] Handle runtime addresses (local variables - future)
- [ ] Add codegen tests
- [ ] Verify generated assembly

**Estimated Time:** 4-6 hours

### Phase 6: Integration Testing 📝 (TODO)
- [ ] End-to-end tests: source → AST → assembly
- [ ] Test memory copy functions
- [ ] Test memory fill functions
- [ ] Test table lookups
- [ ] Test with sprite data
- [ ] Verify optimal 6502 code generation

**Estimated Time:** 2-3 hours

### Phase 7: Documentation 📝 (TODO)
- [ ] Update language specification
- [ ] Add examples to docs
- [ ] Create tutorial for pointer/address usage
- [ ] Document best practices
- [ ] Add to migration guide

**Estimated Time:** 2-3 hours

**Total Estimated Time:** 15-22 hours

---

## Testing Strategy

### Unit Tests

#### Parser Tests

```typescript
describe('Address-Of Expression Parser', () => {
  test('parses simple address-of', () => {
    const ast = parse('@myVariable');
    expect(ast).toMatchObject({
      kind: 'AddressOfExpression',
      operator: '@',
      operand: 'myVariable'
    });
  });
  
  test('rejects address-of literal', () => {
    expect(() => parse('@5')).toThrow('Expected identifier after @');
  });
  
  test('rejects address-of expression', () => {
    expect(() => parse('@(x + 5)')).toThrow('Expected identifier after @');
  });
});
```

#### Type Checker Tests

```typescript
describe('@address Type Alias', () => {
  test('@address resolves to word', () => {
    const type = typeChecker.resolveType('@address');
    expect(type).toEqual({ kind: 'word' });
  });
  
  test('@address and word are compatible', () => {
    const code = `
      let addr1: @address = 0xD020;
      let addr2: word = addr1;
      let addr3: @address = addr2;
    `;
    expect(() => typeCheck(code)).not.toThrow();
  });
  
  test('address-of returns @address', () => {
    const code = `
      @ram let buffer: byte[10];
      let addr: @address = @buffer;
    `;
    const ast = parse(code);
    const type = typeChecker.inferType(ast.declarations[1].initializer);
    expect(type).toEqual({ kind: '@address' });
  });
});
```

#### Code Generation Tests

```typescript
describe('Address-Of Code Generation', () => {
  test('generates load for constant address', () => {
    const code = `
      @map vic at $D020: byte;
      let addr: word = @vic;
    `;
    const asm = compile(code);
    expect(asm).toContain('LDA #<$D020');
    expect(asm).toContain('LDA #>$D020');
  });
  
  test('generates address reference for module variable', () => {
    const code = `
      @data const table: byte[256] = [...];
      let addr: word = @table;
    `;
    const asm = compile(code);
    expect(asm).toContain('LDA #<table');
    expect(asm).toContain('LDA #>table');
  });
});
```

### Integration Tests

```typescript
describe('Memory Utilities Integration', () => {
  test('copyMemory with address-of', () => {
    const code = `
      module test
      
      function copyMemory(src: @address, dst: @address, len: byte): void
        for i = 0 to len - 1
          poke(dst + i, peek(src + i));
        next i
      end function
      
      @data const source: byte[10] = [1,2,3,4,5,6,7,8,9,10];
      @ram let dest: byte[10];
      
      export function main(): void
        copyMemory(@source, @dest, 10);
      end function
    `;
    
    const asm = compile(code);
    
    // Verify assembly contains copy loop
    expect(asm).toContain('LDA (');  // Indirect indexed addressing
    expect(asm).toContain('STA (');
    expect(asm).toContain('INY');    // Loop counter
    expect(asm).toContain('BNE');    // Branch
  });
});
```

---

## Documentation Requirements

### Language Specification Updates

Add new section to `docs/language-specification.md`:

**Section: Address-Of Operator and Address Type**

```markdown
### Address-Of Operator

The address-of operator (`@`) returns the memory address of a variable as a 16-bit word.

**Syntax:**
```js
@variable
```

**Type:** `@address` (which is an alias for `word`)

**Examples:**
```js
@ram let buffer: byte[256];
let bufferAddr: @address = @buffer;

@map screenRAM from $0400 to $07E7: byte;
let screenAddr: word = @screenRAM;  // Same as @address
```

### @address Type

`@address` is a built-in type alias for `word`. It provides self-documenting code when working with memory addresses.

**Type Equivalence:**
```js
@address ≡ word
```

**Usage:**
```js
// Function parameters
function copyMemory(src: @address, dst: @address, len: byte): void

// Variables
let addr: @address = 0xD020;

// Interchangeable with word
let wordValue: word = addr;  // ✅ OK
```
```

### Tutorial Document

Create `docs/tutorials/pointer-and-addresses.md`:

**Topics:**
1. Why addresses matter in 6502 programming
2. Introduction to `@` address-of operator
3. Using `@address` type for clarity
4. Writing generic memory functions
5. Working with sprite banks
6. Table-driven programming patterns
7. Best practices and pitfalls

### API Documentation

Document standard library memory utilities:

```markdown
## utils.memory Module

### copyMemory(src: @address, dst: @address, len: byte)
Copies `len` bytes from `src` to `dst`.

### fillMemory(addr: @address, len: word, value: byte)
Fills `len` bytes at `addr` with `value`.

### compareMemory(addr1: @address, addr2: @address, len: byte): boolean
Returns true if memory regions are identical.
```

---

## Future Enhancements

### Enhancement 1: Pointer Dereference Operator

```js
// Read byte at address
let value: byte = *addr;

// Write byte to address
*addr = 5;
```

**Status:** Deferred (peek/poke sufficient for now)

### Enhancement 2: Typed Pointers

```js
// Pointer to specific type
let bufferPtr: *byte = @buffer;
let firstByte: byte = *bufferPtr;
```

**Status:** Deferred (current approach is simpler)

### Enhancement 3: Address Arithmetic Shortcuts

```js
// Increment address
addr += 1;  // Already works!

// Pointer increment (add sizeof type)
bufferPtr++;  // Hypothetical: add 1 for byte*, 2 for word*
```

**Status:** Deferred (manual arithmetic works fine)

### Enhancement 4: Function Pointers

```js
callback function handler(): void
end function

let handlerAddr: @address = @handler;  // Address of function?
```

**Status:** Investigate separately (callbacks already work differently)

---

## Risk Assessment

### Low Risk
✅ **`@address` type alias** - Trivial to implement, zero runtime cost  
✅ **Parser changes** - Straightforward unary operator  
✅ **Type checking** - Simple alias resolution

### Medium Risk
⚠️ **Symbol table address tracking** - Requires coordination with linker  
⚠️ **Code generation** - Must handle different address kinds correctly

### High Risk
❌ **Local variable addresses** - Complex runtime stack management  
**Mitigation:** Phase 5 focuses on module-scope variables only; defer locals

---

## Success Criteria

### Functional Requirements
- [ ] `@variable` returns memory address of variable
- [ ] `@address` type is interchangeable with `word`
- [ ] Generic `copyMemory()` function works
- [ ] Generic `fillMemory()` function works
- [ ] Works with module-scope variables
- [ ] Works with memory-mapped variables
- [ ] Works with arrays and scalars

### Quality Requirements
- [ ] All tests pass (parser, type checker, codegen)
- [ ] Generated 6502 assembly is optimal
- [ ] Documentation is complete and clear
- [ ] Examples compile and run correctly

### Performance Requirements
- [ ] Zero runtime overhead for `@address` type alias
- [ ] Address-of generates minimal instructions
- [ ] No degradation in compilation speed

---

## References

### Related Documents
- **Language Specification:** `docs/language-specification.md`
- **Sprite System Research:** `plans/sprite-system-research.md`
- **Map Codegen Architecture:** `plans/map-codegen-architecture.md`

### Related Features
- Memory-mapped variables (`@map`)
- Storage classes (`@zp`, `@ram`, `@data`)
- Import system (sprite files)
- Callback functions

### External Resources
- 6502 addressing modes: http://www.6502.org/tutorials/6502opcodes.html
- Indirect addressing: http://www.obelisk.me.uk/6502/addressing.html

---

**Document Status:** Design Complete, Ready for Implementation  
**Next Steps:** Begin Phase 2 (Parser implementation)  
**Estimated Completion:** 2-3 weeks (if working part-time)
