# IL Generator: Compiler v2

> **Document**: 08-il-generator.md  
> **Parent**: [Index](00-index.md)  
> **Status**: Planning Complete

## Overview

The IL Generator produces a simple **linear Intermediate Language** from the AST and frame information. Unlike v1's SSA-based IL, v2 uses a straightforward linear IL with:
- No PHI nodes
- No SSA versioning
- Direct frame slot references
- Accumulator-centric design (~20-25 opcodes)

## Design Principles

### 1. Simple Linear Structure

Instructions execute sequentially with explicit jumps for control flow. No graph-based representation.

### 2. Static Addresses

All variables have known addresses from the frame allocator. No virtual registers or temporaries that need later allocation.

### 3. Accumulator-Centric

Designed around the 6502's accumulator (A register). Most operations:
1. Load value into A
2. Perform operation
3. Store result from A

### 4. Minimal Opcodes

~20-25 opcodes covering all language operations. Each maps cleanly to 1-3 6502 instructions.

---

## IL Types

```typescript
// il/types.ts

/**
 * IL Opcode enumeration.
 * Each opcode has a specific meaning and operand format.
 */
export enum ILOpcode {
  // === Memory Operations ===
  
  /** Load byte from address into accumulator: A ← [addr] */
  LOAD_BYTE = 'LOAD_BYTE',
  
  /** Store accumulator to address: [addr] ← A */
  STORE_BYTE = 'STORE_BYTE',
  
  /** Load word from address: A ← [addr], X ← [addr+1] */
  LOAD_WORD = 'LOAD_WORD',
  
  /** Store word to address: [addr] ← A, [addr+1] ← X */
  STORE_WORD = 'STORE_WORD',
  
  /** Load immediate byte: A ← imm */
  LOAD_IMM = 'LOAD_IMM',
  
  /** Load immediate word: A ← lo(imm), X ← hi(imm) */
  LOAD_IMM_WORD = 'LOAD_IMM_WORD',

  // === Arithmetic Operations ===
  
  /** Add byte: A ← A + [addr] */
  ADD_BYTE = 'ADD_BYTE',
  
  /** Subtract byte: A ← A - [addr] */
  SUB_BYTE = 'SUB_BYTE',
  
  /** Add immediate: A ← A + imm */
  ADD_IMM = 'ADD_IMM',
  
  /** Subtract immediate: A ← A - imm */
  SUB_IMM = 'SUB_IMM',
  
  /** Multiply (software): A ← A * [addr] */
  MUL_BYTE = 'MUL_BYTE',
  
  /** Divide (software): A ← A / [addr] */
  DIV_BYTE = 'DIV_BYTE',
  
  /** Modulo (software): A ← A % [addr] */
  MOD_BYTE = 'MOD_BYTE',

  // === Bitwise Operations ===
  
  /** Bitwise AND: A ← A & [addr] */
  AND_BYTE = 'AND_BYTE',
  
  /** Bitwise OR: A ← A | [addr] */
  OR_BYTE = 'OR_BYTE',
  
  /** Bitwise XOR: A ← A ^ [addr] */
  XOR_BYTE = 'XOR_BYTE',
  
  /** Bitwise NOT: A ← ~A */
  NOT_BYTE = 'NOT_BYTE',
  
  /** Shift left: A ← A << count */
  SHL_BYTE = 'SHL_BYTE',
  
  /** Shift right: A ← A >> count */
  SHR_BYTE = 'SHR_BYTE',

  // === Comparison Operations ===
  
  /** Compare byte with address: flags ← A cmp [addr] */
  CMP_BYTE = 'CMP_BYTE',
  
  /** Compare byte with immediate: flags ← A cmp imm */
  CMP_IMM = 'CMP_IMM',

  // === Control Flow ===
  
  /** Label definition (not a real instruction) */
  LABEL = 'LABEL',
  
  /** Unconditional jump */
  JUMP = 'JUMP',
  
  /** Jump if zero flag set (A == 0 or comparison equal) */
  JUMP_EQ = 'JUMP_EQ',
  
  /** Jump if zero flag clear (A != 0 or comparison not equal) */
  JUMP_NE = 'JUMP_NE',
  
  /** Jump if carry clear (less than, unsigned) */
  JUMP_LT = 'JUMP_LT',
  
  /** Jump if carry set or zero (less than or equal, unsigned) */
  JUMP_LE = 'JUMP_LE',
  
  /** Jump if carry set (greater than or equal, unsigned) */
  JUMP_GE = 'JUMP_GE',
  
  /** Jump if carry set and zero clear (greater than, unsigned) */
  JUMP_GT = 'JUMP_GT',

  // === Function Operations ===
  
  /** Call function */
  CALL = 'CALL',
  
  /** Return from function */
  RETURN = 'RETURN',

  // === Intrinsics ===
  
  /** peek(addr): A ← [addr] (uses indirect if needed) */
  PEEK = 'PEEK',
  
  /** poke(addr, val): [addr] ← val */
  POKE = 'POKE',
  
  /** peekw(addr): AX ← [addr] */
  PEEKW = 'PEEKW',
  
  /** pokew(addr, val): [addr] ← val (word) */
  POKEW = 'POKEW',
  
  /** hi(word): A ← high byte of word */
  HI = 'HI',
  
  /** lo(word): A ← low byte of word */
  LO = 'LO',
}

/**
 * Operand types for IL instructions.
 */
export type ILOperand =
  | { kind: 'immediate'; value: number }
  | { kind: 'address'; address: number }
  | { kind: 'label'; name: string }
  | { kind: 'function'; name: string };

/**
 * A single IL instruction.
 */
export interface ILInstruction {
  /** The opcode */
  opcode: ILOpcode;
  /** Operands (0-2 depending on opcode) */
  operands: ILOperand[];
  /** Source location for debugging */
  location?: SourceLocation;
  /** Comment for IL debugging */
  comment?: string;
}

/**
 * An IL function (sequence of instructions).
 */
export interface ILFunction {
  /** Function name */
  name: string;
  /** Associated frame */
  frame: Frame;
  /** Instructions */
  instructions: ILInstruction[];
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
}
```

---

## IL Builder

```typescript
// il/builder.ts

/**
 * Builder for constructing IL instructions.
 */
export class ILBuilder {
  protected instructions: ILInstruction[] = [];
  protected labelCounter: number = 0;

  /**
   * Generate a unique label name.
   */
  newLabel(prefix: string = 'L'): string {
    return `${prefix}${this.labelCounter++}`;
  }

  /**
   * Emit a label.
   */
  label(name: string): void {
    this.instructions.push({
      opcode: ILOpcode.LABEL,
      operands: [{ kind: 'label', name }],
    });
  }

  /**
   * Load byte from frame slot.
   */
  loadByte(address: number, comment?: string): void {
    this.instructions.push({
      opcode: ILOpcode.LOAD_BYTE,
      operands: [{ kind: 'address', address }],
      comment,
    });
  }

  /**
   * Store byte to frame slot.
   */
  storeByte(address: number, comment?: string): void {
    this.instructions.push({
      opcode: ILOpcode.STORE_BYTE,
      operands: [{ kind: 'address', address }],
      comment,
    });
  }

  /**
   * Load immediate value.
   */
  loadImm(value: number): void {
    this.instructions.push({
      opcode: ILOpcode.LOAD_IMM,
      operands: [{ kind: 'immediate', value }],
    });
  }

  /**
   * Add byte from address.
   */
  addByte(address: number): void {
    this.instructions.push({
      opcode: ILOpcode.ADD_BYTE,
      operands: [{ kind: 'address', address }],
    });
  }

  /**
   * Unconditional jump.
   */
  jump(label: string): void {
    this.instructions.push({
      opcode: ILOpcode.JUMP,
      operands: [{ kind: 'label', name: label }],
    });
  }

  /**
   * Jump if equal (zero flag set).
   */
  jumpEq(label: string): void {
    this.instructions.push({
      opcode: ILOpcode.JUMP_EQ,
      operands: [{ kind: 'label', name: label }],
    });
  }

  /**
   * Compare with immediate.
   */
  cmpImm(value: number): void {
    this.instructions.push({
      opcode: ILOpcode.CMP_IMM,
      operands: [{ kind: 'immediate', value }],
    });
  }

  /**
   * Call function.
   */
  call(funcName: string): void {
    this.instructions.push({
      opcode: ILOpcode.CALL,
      operands: [{ kind: 'function', name: funcName }],
    });
  }

  /**
   * Return from function.
   */
  return_(): void {
    this.instructions.push({
      opcode: ILOpcode.RETURN,
      operands: [],
    });
  }

  /**
   * Get all built instructions.
   */
  getInstructions(): ILInstruction[] {
    return this.instructions;
  }

  /**
   * Clear instructions.
   */
  clear(): void {
    this.instructions = [];
  }
}
```

---

## IL Generator

```typescript
// il/generator.ts

/**
 * Generate IL from AST with frame information.
 */
export class ILGenerator {
  protected builder: ILBuilder;
  protected frameMap: FrameMap;
  protected currentFunction: string | null = null;

  constructor(frameMap: FrameMap) {
    this.builder = new ILBuilder();
    this.frameMap = frameMap;
  }

  /**
   * Generate IL for entire module.
   */
  generate(module: ModuleDeclaration): ILProgram {
    const functions: ILFunction[] = [];
    const globals: ILInstruction[] = [];

    // Generate IL for each function
    for (const decl of module.declarations) {
      if (isFunctionDeclaration(decl)) {
        functions.push(this.generateFunction(decl));
      } else if (isVariableDeclaration(decl)) {
        // Global variable initialization
        this.generateGlobalInit(decl, globals);
      }
    }

    return {
      moduleName: module.name,
      functions,
      globals,
    };
  }

  /**
   * Generate IL for a function.
   */
  protected generateFunction(func: FunctionDeclaration): ILFunction {
    this.currentFunction = func.name;
    this.builder.clear();

    // Generate function body
    this.generateStatement(func.body);

    // Ensure we have a return (for void functions)
    if (func.returnType.name === 'void') {
      this.builder.return_();
    }

    const frame = this.frameMap.frames.get(func.name)!;
    return {
      name: func.name,
      frame,
      instructions: this.builder.getInstructions(),
    };
  }

  /**
   * Generate IL for a statement.
   */
  protected generateStatement(stmt: Statement): void {
    if (isBlockStatement(stmt)) {
      for (const s of stmt.statements) {
        this.generateStatement(s);
      }
    } else if (isIfStatement(stmt)) {
      this.generateIf(stmt);
    } else if (isWhileStatement(stmt)) {
      this.generateWhile(stmt);
    } else if (isForStatement(stmt)) {
      this.generateFor(stmt);
    } else if (isReturnStatement(stmt)) {
      this.generateReturn(stmt);
    } else if (isExpressionStatement(stmt)) {
      this.generateExpression(stmt.expression);
    } else if (isVariableDeclaration(stmt)) {
      this.generateVariableDecl(stmt);
    }
  }

  /**
   * Generate IL for if statement.
   */
  protected generateIf(stmt: IfStatement): void {
    const elseLabel = this.builder.newLabel('else');
    const endLabel = this.builder.newLabel('endif');

    // Evaluate condition
    this.generateExpression(stmt.condition);
    
    // Jump to else if false
    this.builder.cmpImm(0);
    this.builder.jumpEq(stmt.elseBranch ? elseLabel : endLabel);

    // Then branch
    this.generateStatement(stmt.thenBranch);
    
    if (stmt.elseBranch) {
      this.builder.jump(endLabel);
      this.builder.label(elseLabel);
      this.generateStatement(stmt.elseBranch);
    }

    this.builder.label(endLabel);
  }

  /**
   * Generate IL for while statement.
   */
  protected generateWhile(stmt: WhileStatement): void {
    const loopLabel = this.builder.newLabel('while');
    const endLabel = this.builder.newLabel('endwhile');

    this.builder.label(loopLabel);

    // Evaluate condition
    this.generateExpression(stmt.condition);
    
    // Exit if false
    this.builder.cmpImm(0);
    this.builder.jumpEq(endLabel);

    // Loop body
    this.generateStatement(stmt.body);
    
    // Jump back to start
    this.builder.jump(loopLabel);

    this.builder.label(endLabel);
  }

  /**
   * Generate IL for for statement.
   */
  protected generateFor(stmt: ForStatement): void {
    const loopLabel = this.builder.newLabel('for');
    const endLabel = this.builder.newLabel('endfor');

    // Initializer
    if (stmt.initializer) {
      if (isVariableDeclaration(stmt.initializer)) {
        this.generateVariableDecl(stmt.initializer);
      } else {
        this.generateExpression(stmt.initializer);
      }
    }

    this.builder.label(loopLabel);

    // Condition
    if (stmt.condition) {
      this.generateExpression(stmt.condition);
      this.builder.cmpImm(0);
      this.builder.jumpEq(endLabel);
    }

    // Body
    this.generateStatement(stmt.body);

    // Update
    if (stmt.update) {
      this.generateExpression(stmt.update);
    }

    this.builder.jump(loopLabel);
    this.builder.label(endLabel);
  }

  /**
   * Generate IL for return statement.
   */
  protected generateReturn(stmt: ReturnStatement): void {
    if (stmt.expression) {
      // Evaluate return value
      this.generateExpression(stmt.expression);
      
      // Store in return slot
      const returnAddr = this.getVariableAddress('__return');
      this.builder.storeByte(returnAddr);
    }
    
    this.builder.return_();
  }

  /**
   * Generate IL for variable declaration.
   */
  protected generateVariableDecl(decl: VariableDeclaration): void {
    if (decl.initializer) {
      // Evaluate initializer
      this.generateExpression(decl.initializer);
      
      // Store to variable's frame slot
      const addr = this.getVariableAddress(decl.name);
      this.builder.storeByte(addr);
    }
  }

  /**
   * Generate IL for expression (result in accumulator).
   */
  protected generateExpression(expr: Expression): void {
    if (isLiteralExpression(expr)) {
      this.builder.loadImm(expr.value as number);
    } else if (isIdentifierExpression(expr)) {
      const addr = this.getVariableAddress(expr.name);
      this.builder.loadByte(addr, `load ${expr.name}`);
    } else if (isBinaryExpression(expr)) {
      this.generateBinaryExpr(expr);
    } else if (isUnaryExpression(expr)) {
      this.generateUnaryExpr(expr);
    } else if (isCallExpression(expr)) {
      this.generateCall(expr);
    } else if (isAssignmentExpression(expr)) {
      this.generateAssignment(expr);
    }
  }

  /**
   * Generate IL for binary expression.
   */
  protected generateBinaryExpr(expr: BinaryExpression): void {
    // Generate left operand (result in A)
    this.generateExpression(expr.left);
    
    // Save A to temp if right side is complex
    // For now, assume right is simple (identifier or literal)
    
    // If right is identifier or literal, generate op directly
    if (isLiteralExpression(expr.right)) {
      switch (expr.operator) {
        case '+': this.builder.addImm(expr.right.value as number); break;
        case '-': this.builder.subImm(expr.right.value as number); break;
        // ... more operators
      }
    } else if (isIdentifierExpression(expr.right)) {
      const addr = this.getVariableAddress(expr.right.name);
      switch (expr.operator) {
        case '+': this.builder.addByte(addr); break;
        case '-': this.builder.subByte(addr); break;
        // ... more operators
      }
    } else {
      // Complex right side - need temp storage
      // Store left to temp, generate right, then operate
      // Implementation depends on temp slot strategy
    }
  }

  /**
   * Generate IL for function call.
   */
  protected generateCall(expr: CallExpression): void {
    const funcName = (expr.callee as IdentifierExpression).name;
    
    // Check for intrinsics
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
      this.generateExpression(expr.arguments[i]);
      const paramSlot = calleeFrame.slots[i];
      const paramAddr = calleeFrame.baseAddress + paramSlot.offset;
      this.builder.storeByte(paramAddr);
    }

    // Call the function
    this.builder.call(funcName);

    // Load return value into A (if not void)
    const returnSlot = calleeFrame.getSlot('__return');
    if (returnSlot) {
      const returnAddr = calleeFrame.baseAddress + returnSlot.offset;
      this.builder.loadByte(returnAddr);
    }
  }

  /**
   * Get variable address from current function's frame.
   */
  protected getVariableAddress(name: string): number {
    if (!this.currentFunction) {
      throw new Error('No current function');
    }
    
    const frame = this.frameMap.frames.get(this.currentFunction);
    if (!frame) {
      throw new Error(`Unknown function: ${this.currentFunction}`);
    }

    const slot = frame.getSlot(name);
    if (!slot) {
      throw new Error(`Unknown variable: ${name}`);
    }

    return frame.baseAddress + slot.offset;
  }

  /**
   * Check if function is an intrinsic.
   */
  protected isIntrinsic(name: string): boolean {
    return ['peek', 'poke', 'peekw', 'pokew', 'hi', 'lo', 'len'].includes(name)
        || name.startsWith('asm_');
  }

  /**
   * Generate intrinsic call.
   */
  protected generateIntrinsic(name: string, args: Expression[]): void {
    switch (name) {
      case 'peek':
        this.generateExpression(args[0]);
        this.builder.emit({ opcode: ILOpcode.PEEK, operands: [] });
        break;
      case 'poke':
        // Generate address, then value, then poke
        // Implementation depends on how we handle two operands
        break;
      // ... more intrinsics
    }
  }
}
```

---

## Example IL Output

### Source Code

```js
function add(a: byte, b: byte): byte {
  return a + b;
}
```

### Generated IL

```
; Function: add
; Frame: $0200 (a=0, b=1, __return=2)

add:
  LOAD_BYTE $0200          ; load a
  ADD_BYTE $0201           ; add b
  STORE_BYTE $0202         ; store to __return
  RETURN
```

### More Complex Example

```js
function countTo10(): void {
  let i: byte = 0;
  while (i < 10) {
    poke($0400 + i, i);
    i = i + 1;
  }
}
```

### Generated IL

```
; Function: countTo10
; Frame: $0210 (i=0)

countTo10:
  LOAD_IMM 0               ; i = 0
  STORE_BYTE $0210

L0_while:
  LOAD_BYTE $0210          ; load i
  CMP_IMM 10               ; compare with 10
  JUMP_GE L1_endwhile      ; if i >= 10, exit

  ; poke($0400 + i, i)
  LOAD_IMM_WORD $0400      ; base address
  LOAD_BYTE $0210          ; load i
  ; ... (address calculation)
  POKE                     ; poke the value

  ; i = i + 1
  LOAD_BYTE $0210
  ADD_IMM 1
  STORE_BYTE $0210

  JUMP L0_while

L1_endwhile:
  RETURN
```

---

## Migration Tasks

### Session 7.1: IL Types

| # | Task | File | Description |
|---|------|------|-------------|
| 7.1.1 | Create types.ts | `il/types.ts` | ILOpcode enum |
| 7.1.2 | Add operand types | `il/types.ts` | ILOperand types |
| 7.1.3 | Add instruction types | `il/types.ts` | ILInstruction, ILFunction |
| 7.1.4 | Create type tests | `__tests__/il/types.test.ts` | Type tests |

### Session 7.2: IL Builder

| # | Task | File | Description |
|---|------|------|-------------|
| 7.2.1 | Create builder.ts | `il/builder.ts` | ILBuilder class |
| 7.2.2 | Add emit methods | `il/builder.ts` | All opcode emitters |
| 7.2.3 | Add label management | `il/builder.ts` | Label generation |
| 7.2.4 | Add builder tests | `__tests__/il/builder.test.ts` | Builder tests |

### Session 7.3: IL Generator - Expressions

| # | Task | File | Description |
|---|------|------|-------------|
| 7.3.1 | Create generator.ts | `il/generator.ts` | ILGenerator class |
| 7.3.2 | Generate literals | `il/generator.ts` | Literal expressions |
| 7.3.3 | Generate identifiers | `il/generator.ts` | Variable loads |
| 7.3.4 | Generate binary | `il/generator.ts` | Binary expressions |
| 7.3.5 | Generate unary | `il/generator.ts` | Unary expressions |
| 7.3.6 | Add expression tests | `__tests__/il/expressions.test.ts` | Expression IL tests |

### Session 7.4: IL Generator - Control Flow

| # | Task | File | Description |
|---|------|------|-------------|
| 7.4.1 | Generate if/else | `il/generator.ts` | Conditionals |
| 7.4.2 | Generate while | `il/generator.ts` | While loops |
| 7.4.3 | Generate for | `il/generator.ts` | For loops |
| 7.4.4 | Generate break/continue | `il/generator.ts` | Loop control |
| 7.4.5 | Generate return | `il/generator.ts` | Returns |
| 7.4.6 | Add control flow tests | `__tests__/il/control-flow.test.ts` | Control flow tests |

### Session 7.5: IL Generator - Functions & Intrinsics

| # | Task | File | Description |
|---|------|------|-------------|
| 7.5.1 | Generate function calls | `il/generator.ts` | Function calls |
| 7.5.2 | Generate intrinsics | `il/generator.ts` | peek/poke/hi/lo |
| 7.5.3 | Generate asm_* | `il/generator.ts` | ASM intrinsics |
| 7.5.4 | Create index.ts | `il/index.ts` | Exports |
| 7.5.5 | Add comprehensive tests | `__tests__/il/` | Full IL tests |
| 7.5.6 | Run all tests | - | Verify |

---

## Verification Checklist

After implementation, verify:

- [ ] All opcodes defined
- [ ] Builder emits correct IL
- [ ] Literals generate LOAD_IMM
- [ ] Variables generate LOAD_BYTE with correct addresses
- [ ] Binary expressions generate correct ops
- [ ] If/else generates correct jumps
- [ ] While loops generate correct structure
- [ ] For loops generate correct structure
- [ ] Function calls pass parameters correctly
- [ ] Returns store to __return slot
- [ ] Intrinsics generate correct IL
- [ ] All tests pass

---

## Related Documents

| Document | Description |
|----------|-------------|
| [07-frame-allocator.md](07-frame-allocator.md) | Frame allocator (provides addresses) |
| [09-code-generator.md](09-code-generator.md) | Next: Code generation |
| [99-execution-plan.md](99-execution-plan.md) | Full task list |