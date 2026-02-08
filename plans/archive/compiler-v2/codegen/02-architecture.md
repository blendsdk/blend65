# Architecture: Code Generator

> **Document**: 02-architecture.md
> **Parent**: [Index](00-index.md)

## Overview

The Code Generator follows a simple, direct translation approach. Each IL instruction maps to a known pattern of 6502 instructions with minimal transformation.

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Code Generator                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  ILProgram   │───▶│  Generator   │───▶│ AsmILProgram │       │
│  │  (input)     │    │  (process)   │    │  (output)    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                              │                                   │
│                              ▼                                   │
│                      ┌──────────────┐                            │
│                      │ Accumulator  │                            │
│                      │   Tracker    │                            │
│                      └──────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## ASM-IL Intermediate Format

### Why ASM-IL?

Instead of generating raw assembly text, we generate an intermediate representation:

1. **Enables Optimization**: ASM-IL optimizer can transform before emission
2. **Structured Data**: Labels, instructions, and data are distinct
3. **Easy Testing**: Can inspect structure without parsing text
4. **Flexible Output**: Can emit to ACME, KickAssembler, or others

### ASM-IL Types

```typescript
// codegen/asm-il/types.ts

/**
 * A single 6502 instruction in ASM-IL format.
 */
export interface AsmILInstruction {
  /** The 6502 mnemonic (LDA, STA, ADC, etc.) */
  readonly opcode: string;
  
  /** The operand string ($1234, #$FF, label, etc.) */
  readonly operand?: string;
  
  /** Addressing mode for validation/optimization */
  readonly mode: AddressingMode;
  
  /** Optional comment for debugging */
  readonly comment?: string;
}

/**
 * 6502 addressing modes.
 */
export enum AddressingMode {
  Implied = 'implied',       // RTS, SEI, etc.
  Immediate = 'immediate',   // LDA #$00
  ZeroPage = 'zeropage',     // LDA $00
  ZeroPageX = 'zeropageX',   // LDA $00,X
  ZeroPageY = 'zeropageY',   // LDX $00,Y
  Absolute = 'absolute',     // LDA $1234
  AbsoluteX = 'absoluteX',   // LDA $1234,X
  AbsoluteY = 'absoluteY',   // LDA $1234,Y
  Indirect = 'indirect',     // JMP ($1234)
  IndirectX = 'indirectX',   // LDA ($00,X)
  IndirectY = 'indirectY',   // LDA ($00),Y
  Relative = 'relative',     // BEQ label
  Accumulator = 'accumulator', // ASL A
}

/**
 * A label definition in ASM-IL.
 */
export interface AsmILLabel {
  readonly kind: 'label';
  readonly name: string;
}

/**
 * A directive (pseudo-instruction) in ASM-IL.
 */
export interface AsmILDirective {
  readonly kind: 'directive';
  readonly name: string;      // '*=', '!byte', etc.
  readonly value: string;
}

/**
 * A comment line in ASM-IL.
 */
export interface AsmILComment {
  readonly kind: 'comment';
  readonly text: string;
}

/**
 * A blank line for readability.
 */
export interface AsmILBlank {
  readonly kind: 'blank';
}

/**
 * Data bytes in ASM-IL.
 */
export interface AsmILData {
  readonly kind: 'data';
  readonly bytes: number[];
}

/**
 * Any ASM-IL element.
 */
export type AsmILElement = 
  | AsmILInstruction 
  | AsmILLabel 
  | AsmILDirective 
  | AsmILComment 
  | AsmILBlank
  | AsmILData;

/**
 * A complete ASM-IL program.
 */
export interface AsmILProgram {
  /** All elements in order */
  readonly elements: AsmILElement[];
  
  /** Lookup table: label name → index in elements */
  readonly labelIndex: Map<string, number>;
}
```

### ASM-IL Builder

```typescript
// codegen/asm-il/builder.ts

/**
 * Builder for constructing ASM-IL programs.
 */
export class AsmILBuilder {
  protected elements: AsmILElement[] = [];
  protected labelIndex: Map<string, number> = new Map();

  /**
   * Add an instruction.
   */
  instruction(opcode: string, operand?: string, mode?: AddressingMode, comment?: string): this {
    this.elements.push({
      opcode,
      operand,
      mode: mode ?? this.inferMode(opcode, operand),
      comment,
    });
    return this;
  }

  /**
   * Add a label.
   */
  label(name: string): this {
    this.labelIndex.set(name, this.elements.length);
    this.elements.push({ kind: 'label', name });
    return this;
  }

  /**
   * Add a directive.
   */
  directive(name: string, value: string): this {
    this.elements.push({ kind: 'directive', name, value });
    return this;
  }

  /**
   * Add a comment.
   */
  comment(text: string): this {
    this.elements.push({ kind: 'comment', text });
    return this;
  }

  /**
   * Add a blank line.
   */
  blank(): this {
    this.elements.push({ kind: 'blank' });
    return this;
  }

  /**
   * Add data bytes.
   */
  data(bytes: number[]): this {
    this.elements.push({ kind: 'data', bytes });
    return this;
  }

  /**
   * Build the final program.
   */
  build(): AsmILProgram {
    return {
      elements: [...this.elements],
      labelIndex: new Map(this.labelIndex),
    };
  }

  /**
   * Infer addressing mode from operand format.
   */
  protected inferMode(opcode: string, operand?: string): AddressingMode {
    if (!operand) return AddressingMode.Implied;
    if (operand === 'A') return AddressingMode.Accumulator;
    if (operand.startsWith('#')) return AddressingMode.Immediate;
    // ... more inference logic
    return AddressingMode.Absolute;
  }
}
```

## Code Generator Class Design

```typescript
// codegen/generator.ts

/**
 * Generates 6502 assembly (ASM-IL) from IL programs.
 */
export class CodeGenerator {
  /** ASM-IL builder */
  protected builder: AsmILBuilder;
  
  /** Accumulator state tracking */
  protected accState: AccumulatorState;
  
  /** Current function being generated */
  protected currentFunction: ILFunction | null = null;
  
  /** Label counter for unique labels */
  protected labelCounter: number = 0;

  constructor() {
    this.builder = new AsmILBuilder();
    this.accState = { known: false };
  }

  /**
   * Generate ASM-IL for an IL program.
   */
  generate(program: ILProgram): AsmILProgram {
    // 1. Emit program header
    this.emitHeader(program);
    
    // 2. Emit global initialization
    this.emitGlobalInit(program.globalInit);
    
    // 3. Emit each function
    for (const func of program.functions) {
      this.generateFunction(func);
    }
    
    // 4. Emit runtime routines
    this.emitRuntime();
    
    return this.builder.build();
  }

  /**
   * Generate code for a single function.
   */
  protected generateFunction(func: ILFunction): void {
    this.currentFunction = func;
    this.accState = { known: false };
    
    this.builder.blank();
    this.builder.comment(`Function: ${func.name}`);
    this.builder.label(func.name);
    
    for (const instr of func.instructions) {
      this.generateInstruction(instr);
    }
    
    this.currentFunction = null;
  }

  /**
   * Generate code for a single IL instruction.
   */
  protected generateInstruction(instr: ILInstruction): void {
    // Dispatch to specific handler
    switch (instr.opcode) {
      case ILOpcode.LOAD_BYTE: this.genLoadByte(instr); break;
      case ILOpcode.STORE_BYTE: this.genStoreByte(instr); break;
      // ... all other opcodes
      default:
        throw new Error(`Unknown IL opcode: ${instr.opcode}`);
    }
  }
}
```

## Accumulator Tracking

The code generator tracks what value is currently in the accumulator to eliminate redundant loads:

```typescript
/**
 * State of the accumulator (A register).
 */
interface AccumulatorState {
  /** Do we know what's in A? */
  known: boolean;
  
  /** Address of loaded value (if from memory) */
  address?: number;
  
  /** Immediate value (if loaded directly) */
  immediate?: number;
}
```

**Example Optimization:**
```
; Without tracking:
LDA $0200      ; Load value
STA $0300      ; Store it
LDA $0200      ; Load same value again (redundant!)
STA $0301      ; Store it

; With tracking:
LDA $0200      ; Load value
STA $0300      ; Store it (A still has $0200's value)
STA $0301      ; Store it (no reload needed!)
```

**Reset Points:**
- After any label (unknown due to jumps)
- After JSR (callee may clobber A)
- After arithmetic operations (new value in A)

## File Structure

```
codegen/
├── index.ts              # Public exports
├── types.ts              # AccumulatorState, etc.
├── generator.ts          # Main CodeGenerator class
├── intrinsics.ts         # peek/poke/hi/lo handlers
├── runtime.ts            # Runtime routine emission
└── asm-il/
    ├── index.ts          # ASM-IL exports
    ├── types.ts          # AsmILProgram, AsmILInstruction, etc.
    ├── builder.ts        # AsmILBuilder class
    └── emitter.ts        # Emit to ACME syntax
```