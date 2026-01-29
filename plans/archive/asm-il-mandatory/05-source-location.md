# Source Location Handling

> **Document**: 05-source-location.md
> **Parent**: [Index](00-index.md)

## Overview

Source locations must flow from Blend65 source code through IL instructions to ASM-IL nodes, and finally be emitted as comments in the assembly output.

## Data Flow

```
Blend65 Source
    │
    │  SourceLocation { file, start: {line, column}, end: {line, column} }
    ▼
┌─────────────────┐
│   AST Node      │  node.location: SourceLocation
└─────────────────┘
    │
    │  Preserved through semantic analysis
    ▼
┌─────────────────┐
│  IL Instruction │  instr.metadata.location: SourceLocation
└─────────────────┘
    │
    │  Passed to AsmBuilder methods
    ▼
┌─────────────────┐
│ AsmInstruction  │  instr.sourceLocation: SourceLocation
└─────────────────┘
    │
    │  Emitted by AcmeEmitter
    ▼
┌─────────────────┐
│  Assembly Text  │  ; file.blend:25:3
│                 │    LDA #$0E
└─────────────────┘
```

## Current State

### ASM-IL Types Already Support It

The `AsmInstruction` type already has `sourceLocation`:

```typescript
// asm-il/types.ts
export interface AsmInstruction {
  readonly kind: 'instruction';
  readonly mnemonic: Mnemonic;
  readonly mode: AddressingMode;
  readonly operand?: number | string;
  readonly cycles: number;
  readonly bytes: number;
  readonly comment?: string;
  readonly sourceLocation?: SourceLocation;  // ✓ Already exists!
}
```

### IL Instructions Have Location

```typescript
// il/instructions.ts
export interface ILInstruction {
  opcode: ILOpcode;
  metadata: ILInstructionMetadata;
}

export interface ILInstructionMetadata {
  location?: SourceLocation;  // ✓ Already exists!
  // ... other metadata
}
```

## Implementation Requirements

### 1. Pass Location in CodeGenerator

Every `generateXxx` method must pass the location:

```typescript
// instruction-generator.ts

protected generateConst(instr: ILConstInstruction): void {
  const value = instr.value;
  const loc = instr.metadata.location;  // Get location from IL
  
  this.asmBuilder.ldaImm(value, `${instr.result} = ${value}`, loc);
}

protected generateHardwareWrite(instr: ILHardwareWriteInstruction): void {
  const loc = instr.metadata.location;
  this.asmBuilder.staAbs(instr.address, `Write to ${this.formatHex(instr.address)}`, loc);
}
```

### 2. Track Current Location

For helper methods that don't have direct IL instruction access:

```typescript
// base-generator.ts

protected currentSourceLocation?: SourceLocation;

protected setCurrentLocation(loc?: SourceLocation): void {
  this.currentSourceLocation = loc;
}

// In generateInstruction:
protected generateInstruction(instr: ILInstruction): void {
  this.setCurrentLocation(instr.metadata.location);
  
  switch (instr.opcode) {
    case ILOpcode.CONST:
      this.generateConst(instr as ILConstInstruction);
      break;
    // ...
  }
}
```

### 3. Update AcmeEmitter

The emitter must output source location comments:

```typescript
// asm-il/emitters/acme-emitter.ts

protected emitInstruction(instr: AsmInstruction): string {
  const lines: string[] = [];
  
  // Emit source location comment (if enabled and present)
  if (this.config.includeSourceComments && instr.sourceLocation) {
    const loc = instr.sourceLocation;
    lines.push(`; ${loc.file}:${loc.start.line}:${loc.start.column}`);
  }
  
  // Emit the instruction
  const operandStr = this.formatOperand(instr);
  const commentStr = instr.comment ? `; ${instr.comment}` : '';
  lines.push(`  ${instr.mnemonic} ${operandStr}${commentStr}`);
  
  return lines.join('\n');
}
```

### 4. Configuration Options

```typescript
// asm-il/emitters/types.ts

export interface AcmeEmitterConfig {
  includeComments?: boolean;           // Include inline comments
  includeSourceComments?: boolean;     // Include source location comments
  sourceCommentFormat?: 'full' | 'short';  // Format style
  uppercaseMnemonics?: boolean;
  // ...
}
```

## Output Formats

### Full Format (default)
```asm
; examples/demo.blend:25:3
  LDA #$0E         ; borderColor = 14
; examples/demo.blend:26:3
  STA $D020        ; Write to $D020
```

### Short Format
```asm
; :25
  LDA #$0E         ; borderColor = 14
; :26
  STA $D020        ; Write to $D020
```

### Debug Mode Output
```asm
; =====================================
; examples/demo.blend:25 - borderColor = 14
; =====================================
  LDA #$0E
  STA $D020
```

## Edge Cases

### 1. Missing Source Location

Some generated code has no source location (e.g., BASIC stub, entry point):

```typescript
// Use undefined, don't fake it
this.asmBuilder.ldaImm(0, 'Initialize counter');  // No location
```

### 2. Multiple Instructions from One Source Line

```blend
borderColor = 14;  // Becomes: LDA #$0E, STA $D020
```

Both instructions get the same source location - this is correct.

### 3. Compiler-Generated Code

Code not directly from source (loop counters, temporary variables):

```typescript
// Mark as compiler-generated in comment, no location
this.asmBuilder.ldxImm(0, '[compiler] loop counter');
```

## Testing Requirements

1. **Unit tests**: Verify source locations flow through each method
2. **Integration tests**: Compile program, verify assembly has correct line references
3. **Edge case tests**: Missing locations, multi-instruction lines

## Example: Full Flow

**Source (test.blend):**
```blend
module Test;

@map borderColor at $D020: byte;

function main(): void {
  borderColor = 14;  // Line 6
}
```

**IL:**
```
CONST %0 = 14        ; location: {file: 'test.blend', line: 6, col: 3}
HARDWARE_WRITE $D020, %0  ; location: {file: 'test.blend', line: 6, col: 3}
```

**ASM-IL:**
```typescript
[
  { kind: 'instruction', mnemonic: 'LDA', mode: 'immediate', operand: 14,
    sourceLocation: { file: 'test.blend', start: { line: 6, column: 3 }, ... } },
  { kind: 'instruction', mnemonic: 'STA', mode: 'absolute', operand: 0xD020,
    sourceLocation: { file: 'test.blend', start: { line: 6, column: 3 }, ... } },
]
```

**Assembly Output:**
```asm
; test.blend:6:3
  LDA #$0E         ; %0 = 14
; test.blend:6:3
  STA $D020        ; Write to $D020
```