# ASM-IL Emitter

> **Document**: 08-emitter.md
> **Parent**: [Index](00-index.md)

## Overview

The ASM-IL Emitter converts the structured `AsmILProgram` into ACME assembler text output. This is the final step that produces an actual `.asm` file that can be assembled.

## Purpose

```
AsmILProgram (structured) → Emitter → .asm text file (ACME format)
```

The emitter:
1. Converts each ASM-IL element to its text representation
2. Handles formatting (indentation, alignment, comments)
3. Produces ACME-compatible assembler syntax
4. Optionally writes to file or returns as string

## ACME Assembler Format

We target [ACME](https://sourceforge.net/projects/acme-crossass/) assembler syntax.

### Key ACME Syntax

```asm
; Comment (semicolon)
*= $0801               ; Set program counter
!byte $00, $0E, $08    ; Data bytes
label:                 ; Label definition
    LDA #$00           ; Instruction with immediate
    STA $D020          ; Instruction with absolute
    BEQ label          ; Branch with label
```

## Emitter Class Design

```typescript
// codegen/asm-il/emitter.ts

/**
 * Emits ACME assembler text from ASM-IL programs.
 */
export class AsmILEmitter {
  /** Indentation for instructions (spaces) */
  protected indent: string = '    ';
  
  /**
   * Emit an ASM-IL program to ACME assembler text.
   * @param program The ASM-IL program to emit
   * @returns The complete assembler text
   */
  emit(program: AsmILProgram): string {
    const lines: string[] = [];
    
    for (const element of program.elements) {
      lines.push(this.emitElement(element));
    }
    
    return lines.join('\n');
  }
  
  /**
   * Emit a single ASM-IL element.
   */
  protected emitElement(element: AsmILElement): string {
    if ('opcode' in element) {
      return this.emitInstruction(element as AsmILInstruction);
    }
    
    switch (element.kind) {
      case 'label': return this.emitLabel(element);
      case 'directive': return this.emitDirective(element);
      case 'comment': return this.emitComment(element);
      case 'blank': return '';
      case 'data': return this.emitData(element);
      default:
        throw new Error(`Unknown element kind`);
    }
  }
  
  /**
   * Emit an instruction.
   * Example: "    LDA #$00" or "    STA $D020"
   */
  protected emitInstruction(instr: AsmILInstruction): string {
    let line = this.indent + instr.opcode;
    
    if (instr.operand) {
      line += ' ' + instr.operand;
    }
    
    if (instr.comment) {
      line = line.padEnd(32) + '; ' + instr.comment;
    }
    
    return line;
  }
  
  /**
   * Emit a label definition.
   * Example: "main:" or ".loop:"
   */
  protected emitLabel(label: AsmILLabel): string {
    return label.name + ':';
  }
  
  /**
   * Emit a directive.
   * Example: "*= $0801" or "!byte $00, $0E"
   */
  protected emitDirective(directive: AsmILDirective): string {
    return directive.name + ' ' + directive.value;
  }
  
  /**
   * Emit a comment line.
   * Example: "; This is a comment"
   */
  protected emitComment(comment: AsmILComment): string {
    return '; ' + comment.text;
  }
  
  /**
   * Emit data bytes.
   * Example: "!byte $00, $0E, $08, $0A"
   */
  protected emitData(data: AsmILData): string {
    const hexBytes = data.bytes.map(b => '$' + b.toString(16).padStart(2, '0').toUpperCase());
    return '!byte ' + hexBytes.join(', ');
  }
}
```

## Output Format Examples

### Simple Program

**ASM-IL:**
```typescript
const program: AsmILProgram = {
  elements: [
    { kind: 'directive', name: '*=', value: '$0801' },
    { kind: 'comment', text: 'BASIC stub' },
    { kind: 'data', bytes: [0x0B, 0x08, 0x0A, 0x00, 0x9E, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00] },
    { kind: 'blank' },
    { kind: 'label', name: 'main' },
    { opcode: 'LDA', operand: '#$0E', mode: AddressingMode.Immediate },
    { opcode: 'STA', operand: '$D020', mode: AddressingMode.Absolute },
    { opcode: 'RTS', mode: AddressingMode.Implied },
  ],
  labelIndex: new Map([['main', 4]]),
};
```

**Emitted Output:**
```asm
*= $0801
; BASIC stub
!byte $0B, $08, $0A, $00, $9E, $32, $30, $36, $31, $00, $00, $00

main:
    LDA #$0E
    STA $D020
    RTS
```

### Function with Control Flow

**Emitted Output:**
```asm
; Function: increment
increment:
    LDA $02                         ; Load counter
    CLC
    ADC #$01                        ; Add 1
    STA $02                         ; Store result
    CMP #$0A                        ; Compare with 10
    BNE .skip
    LDA #$00
    STA $02
.skip:
    RTS
```

## Operand Formatting

| Mode | Format | Example |
|------|--------|---------|
| Immediate | `#$nn` or `#nn` | `#$FF`, `#42` |
| Zero Page | `$nn` | `$02` |
| Zero Page,X | `$nn,X` | `$02,X` |
| Zero Page,Y | `$nn,Y` | `$02,Y` |
| Absolute | `$nnnn` | `$D020` |
| Absolute,X | `$nnnn,X` | `$0400,X` |
| Absolute,Y | `$nnnn,Y` | `$0400,Y` |
| Indirect | `($nnnn)` | `($0314)` |
| Indirect,X | `($nn,X)` | `($FB,X)` |
| Indirect,Y | `($nn),Y` | `($FB),Y` |
| Relative | `label` | `.loop` |
| Implied | (none) | `RTS` |
| Accumulator | `A` | `ASL A` |

## File Structure

```
codegen/
└── asm-il/
    ├── types.ts      # ASM-IL types
    ├── builder.ts    # ASM-IL builder
    ├── emitter.ts    # ASM-IL → text (THIS DOCUMENT)
    └── index.ts      # Exports
```

## Testing Requirements

### Unit Tests

1. **Instruction Emission**
   - All addressing modes format correctly
   - Comments align properly
   - Opcodes are uppercase

2. **Label Emission**
   - Labels end with colon
   - Local labels start with dot

3. **Directive Emission**
   - Program counter directive (`*=`)
   - Byte data directive (`!byte`)

4. **Comment Emission**
   - Comment prefix (`;`)
   - Blank lines

### Integration Tests

1. **Complete Program Emission**
   - BASIC stub emits correctly
   - Functions emit in order
   - Runtime routines emit correctly

2. **Round-Trip Testing**
   - Emit program
   - Assemble with ACME
   - Verify no assembly errors

## ACME-Specific Notes

### Pseudo-Opcodes

| ACME | Purpose |
|------|---------|
| `*=` | Set program counter |
| `!byte` | Define bytes |
| `!word` | Define 16-bit word |
| `!text` | Define text string |
| `!fill n, value` | Fill n bytes |

### Local Labels

ACME supports local labels starting with dot:
```asm
main:
    BEQ .skip
.skip:
    RTS
```

The emitter should use local labels for generated labels within functions.

## Success Criteria

1. ✅ All ASM-IL elements emit correctly
2. ✅ Output assembles with ACME without errors
3. ✅ Formatting is consistent and readable
4. ✅ Comments are preserved and aligned
5. ✅ Generated code runs correctly in VICE