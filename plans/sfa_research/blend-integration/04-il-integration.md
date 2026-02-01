# Blend Integration: IL Generator Integration

> **Document**: blend-integration/04-il-integration.md
> **Parent**: [00-overview.md](00-overview.md)
> **Status**: Design Complete
> **Last Updated**: 2025-02-01

## Overview

This document describes how the Frame Allocator integrates with the IL Generator in Blend65 compiler-v2. The IL generator receives the FrameMap from semantic analysis and uses it to resolve all variable references to absolute addresses.

---

## Integration Point

The IL generator receives the FrameMap as input and uses it to generate IL instructions with resolved addresses:

```
┌─────────────────────────────────────────────────────────────────┐
│                        IL GENERATOR                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Input:                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Module     │  │   FrameMap   │  │   Symbol     │          │
│  │ Declaration  │  │   (from      │  │   Table      │          │
│  │    (AST)     │  │  semantic)   │  │              │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └────────────────┼─────────────────┘                    │
│                          │                                      │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    ADDRESS RESOLUTION                      │  │
│  │                                                            │  │
│  │  For each variable reference:                              │  │
│  │    1. Get current function name                            │  │
│  │    2. Look up Frame from FrameMap                          │  │
│  │    3. Find FrameSlot by variable name                      │  │
│  │    4. Calculate: address = frameBaseAddress + slot.offset  │  │
│  │    5. Generate IL with absolute address                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│  Output:                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      ILProgram                            │   │
│  │                                                           │   │
│  │  • ILFunction[] - each contains Frame reference           │   │
│  │  • Instructions with absolute addresses                   │   │
│  │  • Comments with variable names for debugging             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ILGenerator Class Modifications

### Constructor Changes

```typescript
// il/generator.ts

/**
 * Generate IL from AST with frame information.
 * 
 * The IL generator translates AST nodes to IL instructions with
 * absolute addresses resolved from the FrameMap.
 */
export class ILGenerator {
  /** IL instruction builder */
  protected builder: ILBuilder;
  
  /** Frame map from semantic analysis (provides addresses) */
  protected frameMap: FrameMap;
  
  /** Symbol table for type information */
  protected symbolTable: SymbolTable;
  
  /** Current function being generated */
  protected currentFunction: string | null = null;
  
  /** Current function's frame (cached for performance) */
  protected currentFrame: Frame | null = null;

  /**
   * Create IL generator with frame map.
   * 
   * @param frameMap - Frame allocation map from semantic analysis
   * @param symbolTable - Symbol table for type information
   */
  constructor(frameMap: FrameMap, symbolTable: SymbolTable) {
    this.builder = new ILBuilder();
    this.frameMap = frameMap;
    this.symbolTable = symbolTable;
  }
}
```

### Address Resolution Method

```typescript
/**
 * Get the absolute address for a variable in the current function.
 * 
 * @param name - Variable name (parameter, local, or __return)
 * @returns Absolute memory address
 * @throws Error if variable not found in current frame
 */
protected getVariableAddress(name: string): number {
  if (!this.currentFunction || !this.currentFrame) {
    throw new Error('No current function context');
  }
  
  const slot = this.currentFrame.slots.find(s => s.name === name);
  if (!slot) {
    throw new Error(
      `Unknown variable '${name}' in function '${this.currentFunction}'`
    );
  }
  
  // Calculate absolute address
  return this.currentFrame.frameBaseAddress + slot.offset;
}

/**
 * Get the slot location (ZP or RAM) for a variable.
 * 
 * @param name - Variable name
 * @returns SlotLocation.ZeroPage or SlotLocation.Ram
 */
protected getSlotLocation(name: string): SlotLocation {
  if (!this.currentFrame) {
    throw new Error('No current function context');
  }
  
  const slot = this.currentFrame.slots.find(s => s.name === name);
  if (!slot) {
    return SlotLocation.Ram; // Default to RAM
  }
  
  return slot.location;
}

/**
 * Check if a variable is allocated in zero page.
 * 
 * @param name - Variable name
 * @returns True if variable is in ZP
 */
protected isZeroPage(name: string): boolean {
  return this.getSlotLocation(name) === SlotLocation.ZeroPage;
}
```

---

## ILFunction Structure

Each IL function includes a reference to its frame:

```typescript
// il/types.ts

/**
 * An IL function (sequence of instructions).
 */
export interface ILFunction {
  /** Function name */
  name: string;
  
  /** ★ Frame from FrameMap - contains all address information */
  frame: Frame;
  
  /** IL instructions */
  instructions: ILInstruction[];
  
  /** Source location for debugging */
  location?: SourceLocation;
}

/**
 * Complete IL program.
 */
export interface ILProgram {
  /** Module name */
  moduleName: string;
  
  /** All functions */
  functions: ILFunction[];
  
  /** Global variable initialization */
  globals: ILInstruction[];
  
  /** ★ Reference to frame map for cross-function access */
  frameMap: FrameMap;
}
```

---

## IL Generation with Frame Addresses

### Function Generation

```typescript
/**
 * Generate IL for a function.
 */
protected generateFunction(func: FunctionDeclaration): ILFunction {
  // Set current function context
  this.currentFunction = func.name;
  this.currentFrame = this.frameMap.frames.get(func.name) ?? null;
  
  if (!this.currentFrame) {
    throw new Error(`No frame allocated for function '${func.name}'`);
  }
  
  // Clear builder for new function
  this.builder.clear();
  
  // Generate function body
  this.generateStatement(func.body);
  
  // Ensure void functions have a return
  if (func.returnType.name === 'void') {
    this.builder.return_();
  }
  
  return {
    name: func.name,
    frame: this.currentFrame,
    instructions: this.builder.getInstructions(),
    location: func.location,
  };
}
```

### Variable Declaration

```typescript
/**
 * Generate IL for variable declaration with initialization.
 */
protected generateVariableDecl(decl: VariableDeclaration): void {
  if (decl.initializer) {
    // Generate initializer expression (result in accumulator)
    this.generateExpression(decl.initializer);
    
    // Get the absolute address for this variable
    const addr = this.getVariableAddress(decl.name);
    const isZp = this.isZeroPage(decl.name);
    
    // Store to variable's frame slot
    if (decl.type.size === 1) {
      this.builder.storeByte(addr, `store ${decl.name}${isZp ? ' (ZP)' : ''}`);
    } else {
      this.builder.storeWord(addr, `store ${decl.name}${isZp ? ' (ZP)' : ''}`);
    }
  }
}
```

### Identifier Expression (Variable Load)

```typescript
/**
 * Generate IL for identifier expression (variable load).
 */
protected generateIdentifier(node: IdentifierExpression): void {
  const name = node.name;
  const addr = this.getVariableAddress(name);
  const isZp = this.isZeroPage(name);
  
  // Get type size
  const symbol = this.symbolTable.lookup(name);
  const size = symbol?.type?.size ?? 1;
  
  if (size === 1) {
    this.builder.loadByte(addr, `load ${name}${isZp ? ' (ZP)' : ''}`);
  } else {
    this.builder.loadWord(addr, `load ${name}${isZp ? ' (ZP)' : ''}`);
  }
}
```

### Assignment Expression

```typescript
/**
 * Generate IL for assignment expression.
 */
protected generateAssignment(node: AssignmentExpression): void {
  // Generate the value expression (result in accumulator)
  this.generateExpression(node.right);
  
  // Get the target variable address
  if (isIdentifierExpression(node.left)) {
    const name = node.left.name;
    const addr = this.getVariableAddress(name);
    const isZp = this.isZeroPage(name);
    
    // Get type size
    const symbol = this.symbolTable.lookup(name);
    const size = symbol?.type?.size ?? 1;
    
    if (size === 1) {
      this.builder.storeByte(addr, `store to ${name}${isZp ? ' (ZP)' : ''}`);
    } else {
      this.builder.storeWord(addr, `store to ${name}${isZp ? ' (ZP)' : ''}`);
    }
  } else if (isIndexExpression(node.left)) {
    // Array element assignment - more complex
    this.generateIndexedStore(node.left, node.right);
  }
}
```

---

## Function Call with Parameters

### Parameter Passing

Parameters are passed by copying values to the callee's frame:

```typescript
/**
 * Generate IL for function call.
 */
protected generateCall(expr: CallExpression): void {
  const funcName = (expr.callee as IdentifierExpression).name;
  
  // Check for intrinsics first
  if (this.isIntrinsic(funcName)) {
    this.generateIntrinsic(funcName, expr.arguments);
    return;
  }
  
  // Get callee's frame
  const calleeFrame = this.frameMap.frames.get(funcName);
  if (!calleeFrame) {
    throw new Error(`Unknown function: ${funcName}`);
  }
  
  // Copy arguments to callee's parameter slots
  for (let i = 0; i < expr.arguments.length; i++) {
    // Generate argument value
    this.generateExpression(expr.arguments[i]);
    
    // Find the parameter slot in callee's frame
    const paramSlot = calleeFrame.slots.find(s => s.kind === 'parameter');
    if (!paramSlot) {
      throw new Error(`Missing parameter slot for ${funcName}`);
    }
    
    // Calculate parameter address
    const paramAddr = calleeFrame.frameBaseAddress + calleeFrame.slots[i].offset;
    const isZp = calleeFrame.slots[i].location === SlotLocation.ZeroPage;
    
    // Store argument to parameter slot
    if (calleeFrame.slots[i].size === 1) {
      this.builder.storeByte(paramAddr, `arg ${i} → ${calleeFrame.slots[i].name}${isZp ? ' (ZP)' : ''}`);
    } else {
      this.builder.storeWord(paramAddr, `arg ${i} → ${calleeFrame.slots[i].name}${isZp ? ' (ZP)' : ''}`);
    }
  }
  
  // Call the function
  this.builder.call(funcName);
  
  // Load return value if function returns non-void
  const returnSlot = calleeFrame.slots.find(s => s.kind === 'return');
  if (returnSlot) {
    const returnAddr = calleeFrame.frameBaseAddress + returnSlot.offset;
    const isZp = returnSlot.location === SlotLocation.ZeroPage;
    
    if (returnSlot.size === 1) {
      this.builder.loadByte(returnAddr, `return value from ${funcName}${isZp ? ' (ZP)' : ''}`);
    } else {
      this.builder.loadWord(returnAddr, `return value from ${funcName}${isZp ? ' (ZP)' : ''}`);
    }
  }
}
```

### Return Statement

```typescript
/**
 * Generate IL for return statement.
 */
protected generateReturn(stmt: ReturnStatement): void {
  if (stmt.expression) {
    // Generate return value
    this.generateExpression(stmt.expression);
    
    // Store to return slot
    const returnAddr = this.getVariableAddress('__return');
    const returnSlot = this.currentFrame!.slots.find(s => s.kind === 'return');
    const isZp = returnSlot?.location === SlotLocation.ZeroPage;
    
    if ((returnSlot?.size ?? 1) === 1) {
      this.builder.storeByte(returnAddr, `store return value${isZp ? ' (ZP)' : ''}`);
    } else {
      this.builder.storeWord(returnAddr, `store return value${isZp ? ' (ZP)' : ''}`);
    }
  }
  
  this.builder.return_();
}
```

---

## Binary Expression with ZP Awareness

When generating binary expressions, we can note which operands are in ZP for later optimization:

```typescript
/**
 * Generate IL for binary expression.
 */
protected generateBinaryExpr(expr: BinaryExpression): void {
  // Generate left operand (result in A)
  this.generateExpression(expr.left);
  
  // Handle right operand based on its type
  if (isLiteralExpression(expr.right)) {
    // Immediate operand
    const value = expr.right.value as number;
    switch (expr.operator) {
      case '+':
        this.builder.addImm(value);
        break;
      case '-':
        this.builder.subImm(value);
        break;
      // ... more operators
    }
  } else if (isIdentifierExpression(expr.right)) {
    // Memory operand - get address
    const addr = this.getVariableAddress(expr.right.name);
    const isZp = this.isZeroPage(expr.right.name);
    
    switch (expr.operator) {
      case '+':
        this.builder.addByte(addr, isZp ? 'ZP' : undefined);
        break;
      case '-':
        this.builder.subByte(addr, isZp ? 'ZP' : undefined);
        break;
      // ... more operators
    }
  } else {
    // Complex right operand - need temp storage
    this.generateComplexBinaryOperand(expr);
  }
}
```

---

## Example IL Output

### Source Code

```js
function calculate(x: byte): byte {
  let y: byte = x * 2;
  let z: byte = y + 10;
  return z;
}
```

### Frame Allocation

```
calculate_frame at $0200 (5 bytes):
  $0200: param x (byte, 1)
  $0201: local y (byte, 1)
  $0202: local z (byte, 1)
  $0203: __return (byte, 1)
  $0204: padding
```

### Generated IL

```
; Function: calculate
; Frame base: $0200
; Slots: x=$0200, y=$0201, z=$0202, __return=$0203

calculate:
  ; let y: byte = x * 2
  LOAD_BYTE $0200           ; load x
  LOAD_IMM 2                ; load 2
  MUL_BYTE                  ; A = x * 2
  STORE_BYTE $0201          ; store y

  ; let z: byte = y + 10
  LOAD_BYTE $0201           ; load y
  ADD_IMM 10                ; A = y + 10
  STORE_BYTE $0202          ; store z

  ; return z
  LOAD_BYTE $0202           ; load z
  STORE_BYTE $0203          ; store __return
  RETURN
```

---

## ZP-Aware IL Example

When variables are allocated in zero page, comments reflect this:

### Frame Allocation with ZP

```
calculate_frame at $0200:
  $02: param x (byte, 1) - ZP
  $03: local y (byte, 1) - ZP
  $0200: local z (byte, 1) - RAM
  $0201: __return (byte, 1) - RAM
```

### Generated IL with ZP Annotations

```
; Function: calculate
; Frame base: $0200, ZP base: $02
; Slots: x=$02 (ZP), y=$03 (ZP), z=$0200, __return=$0201

calculate:
  ; let y: byte = x * 2
  LOAD_BYTE $02             ; load x (ZP)
  LOAD_IMM 2
  MUL_BYTE
  STORE_BYTE $03            ; store y (ZP)

  ; let z: byte = y + 10
  LOAD_BYTE $03             ; load y (ZP)
  ADD_IMM 10
  STORE_BYTE $0200          ; store z

  ; return z
  LOAD_BYTE $0200           ; load z
  STORE_BYTE $0201          ; store __return
  RETURN
```

---

## Intrinsic Function Handling

Intrinsics don't use frame slots - they operate directly:

```typescript
/**
 * Generate IL for intrinsic function calls.
 */
protected generateIntrinsic(name: string, args: Expression[]): void {
  switch (name) {
    case 'peek':
      // Address in first argument
      this.generateExpression(args[0]);
      this.builder.emit({ opcode: ILOpcode.PEEK, operands: [] });
      break;
      
    case 'poke':
      // Address in first argument, value in second
      this.generateExpression(args[0]);
      // Store address temporarily
      this.builder.storeByte(TEMP_ADDR_LO);
      this.builder.storeByte(TEMP_ADDR_HI);
      this.generateExpression(args[1]);
      this.builder.emit({ opcode: ILOpcode.POKE, operands: [] });
      break;
      
    case 'hi':
      this.generateExpression(args[0]);
      this.builder.emit({ opcode: ILOpcode.HI, operands: [] });
      break;
      
    case 'lo':
      this.generateExpression(args[0]);
      this.builder.emit({ opcode: ILOpcode.LO, operands: [] });
      break;
      
    case 'len':
      // Array length is compile-time constant
      const arraySize = this.getArraySize(args[0]);
      this.builder.loadImmWord(arraySize);
      break;
      
    default:
      if (name.startsWith('asm_')) {
        this.generateAsmIntrinsic(name, args);
      } else {
        throw new Error(`Unknown intrinsic: ${name}`);
      }
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('ILGenerator', () => {
  describe('address resolution', () => {
    it('should resolve variable addresses from frame map', () => {
      const frameMap = createTestFrameMap({
        'main': {
          frameBaseAddress: 0x0200,
          slots: [
            { name: 'x', offset: 0, size: 1 },
            { name: 'y', offset: 1, size: 1 },
          ]
        }
      });
      
      const generator = new ILGenerator(frameMap, symbolTable);
      const ast = parseProgram(`
        function main(): void {
          let x: byte = 10;
          let y: byte = x + 5;
        }
      `);
      
      const ilProgram = generator.generate(ast);
      
      // Verify addresses in generated IL
      const mainFunc = ilProgram.functions[0];
      const instructions = mainFunc.instructions;
      
      // First store should be to $0200 (x)
      expect(instructions[1].opcode).toBe(ILOpcode.STORE_BYTE);
      expect(instructions[1].operands[0]).toEqual({ kind: 'address', address: 0x0200 });
      
      // Load for addition should be from $0200 (x)
      expect(instructions[2].opcode).toBe(ILOpcode.LOAD_BYTE);
      expect(instructions[2].operands[0]).toEqual({ kind: 'address', address: 0x0200 });
      
      // Store result should be to $0201 (y)
      expect(instructions[4].opcode).toBe(ILOpcode.STORE_BYTE);
      expect(instructions[4].operands[0]).toEqual({ kind: 'address', address: 0x0201 });
    });
    
    it('should handle ZP and RAM addresses correctly', () => {
      const frameMap = createTestFrameMap({
        'main': {
          frameBaseAddress: 0x0200,
          zpBaseAddress: 0x02,
          slots: [
            { name: 'hot', offset: 0, size: 1, location: SlotLocation.ZeroPage },
            { name: 'cold', offset: 0, size: 1, location: SlotLocation.Ram },
          ]
        }
      });
      
      const generator = new ILGenerator(frameMap, symbolTable);
      // ... test that addresses are correctly $02 for ZP, $0200 for RAM
    });
  });
  
  describe('function calls', () => {
    it('should pass parameters to callee frame slots', () => {
      const frameMap = createTestFrameMap({
        'add': {
          frameBaseAddress: 0x0200,
          slots: [
            { name: 'a', offset: 0, size: 1, kind: 'parameter' },
            { name: 'b', offset: 1, size: 1, kind: 'parameter' },
            { name: '__return', offset: 2, size: 1, kind: 'return' },
          ]
        },
        'main': {
          frameBaseAddress: 0x0204,
          slots: [
            { name: 'result', offset: 0, size: 1 },
          ]
        }
      });
      
      const generator = new ILGenerator(frameMap, symbolTable);
      const ast = parseProgram(`
        function add(a: byte, b: byte): byte {
          return a + b;
        }
        function main(): void {
          let result = add(5, 10);
        }
      `);
      
      const ilProgram = generator.generate(ast);
      const mainFunc = ilProgram.functions.find(f => f.name === 'main')!;
      
      // Should store 5 to $0200 (add.a)
      // Should store 10 to $0201 (add.b)
      // Should call add
      // Should load from $0202 (add.__return)
      // Should store to $0204 (main.result)
    });
  });
});
```

---

## Summary

The IL generator integration uses the FrameMap to:

1. **Resolve variable addresses** - Every variable reference becomes an absolute address
2. **Include frame references** - Each ILFunction includes its Frame for codegen
3. **Handle parameters** - Function calls copy arguments to callee's parameter slots
4. **Support returns** - Return values go through the `__return` slot
5. **Track ZP status** - Comments indicate which variables are in zero page

The key principle is that **all address resolution happens in the IL generator**, so the code generator receives IL with fully resolved absolute addresses.

---

## Related Documents

| Document | Description |
|----------|-------------|
| [00-overview.md](00-overview.md) | Integration overview |
| [03-semantic-integration.md](03-semantic-integration.md) | Semantic integration |
| [05-codegen-integration.md](05-codegen-integration.md) | Code generator integration |
| [../../compiler-v2/08-il-generator.md](../../compiler-v2/08-il-generator.md) | Compiler v2 IL spec |