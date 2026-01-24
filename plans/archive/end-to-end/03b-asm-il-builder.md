# Phase 2b: ASM-IL Builder (Inheritance Chain)

> **Status**: Planning  
> **Parent**: [03-codegen-stub.md](03-codegen-stub.md)  
> **Priority**: HIGH  
> **Dependencies**: 03a-asm-il-types.md  
> **Estimated Time**: 3-4 hours  
> **Sessions**: 3-5 (types+base, instruction, data+module)

---

## Overview

This document defines the builder classes for constructing ASM-IL modules. Following the project's multi-chain inheritance pattern (like the parser), the builder is split into logical layers.

---

## Inheritance Chain

```
BaseAsmBuilder          (utilities, state, item management)
       ↓
InstructionBuilder      (CPU instruction methods: lda, sta, jmp, etc.)
       ↓
DataBuilder             (data directives: byte, word, text, fill)
       ↓
AsmModuleBuilder        (final: module construction, build())
```

**Each layer: 200-400 lines maximum**

---

## Directory Structure

```
packages/compiler/src/asm-il/builder/
├── index.ts                 # Public exports
├── base-builder.ts          # BaseAsmBuilder (~250 lines)
├── instruction-builder.ts   # InstructionBuilder (~350 lines)
├── data-builder.ts          # DataBuilder (~200 lines)
└── module-builder.ts        # AsmModuleBuilder (~200 lines)
```

---

## File 1: `base-builder.ts`

### Purpose
Foundation class with:
- Item array management
- Label tracking
- Statistics tracking
- Comment/blank/origin helpers
- Source location tracking

### Implementation (~250 lines)

```typescript
/**
 * Base ASM-IL Builder
 * 
 * Foundation for the builder inheritance chain.
 * Provides core item management and utilities.
 * 
 * @module asm-il/builder/base-builder
 */

import type { SourceLocation } from '../../ast/base.js';
import type {
  AsmItem,
  AsmLabel,
  AsmComment,
  AsmBlankLine,
  AsmOrigin,
  AsmRaw,
  LabelType,
} from '../types.js';

/**
 * Base builder state and statistics
 */
export interface BuilderState {
  /** Module name */
  name: string;
  /** Target architecture */
  target: string;
  /** Initial origin address */
  origin: number;
  /** Current address (estimated) */
  currentAddress: number;
  /** Accumulated items */
  items: AsmItem[];
  /** Label lookup */
  labels: Map<string, AsmLabel>;
  /** Statistics */
  codeBytes: number;
  dataBytes: number;
  functionCount: number;
  globalCount: number;
}

/**
 * Base ASM-IL Builder
 * 
 * Provides core infrastructure for building ASM-IL modules.
 * Extended by InstructionBuilder → DataBuilder → AsmModuleBuilder.
 */
export abstract class BaseAsmBuilder {
  /** Builder state */
  protected state: BuilderState;
  
  /** Current source location for tracking */
  protected currentLocation?: SourceLocation;
  
  constructor(name: string, origin: number = 0x0801, target: string = 'c64') {
    this.state = {
      name,
      target,
      origin,
      currentAddress: origin,
      items: [],
      labels: new Map(),
      codeBytes: 0,
      dataBytes: 0,
      functionCount: 0,
      globalCount: 0,
    };
  }
  
  // ========================================
  // SOURCE LOCATION TRACKING
  // ========================================
  
  /**
   * Set current source location for subsequent items
   */
  setLocation(location: SourceLocation): this {
    this.currentLocation = location;
    return this;
  }
  
  /**
   * Clear current source location
   */
  clearLocation(): this {
    this.currentLocation = undefined;
    return this;
  }
  
  // ========================================
  // ITEM MANAGEMENT
  // ========================================
  
  /**
   * Add an item to the module
   */
  protected addItem(item: AsmItem): void {
    this.state.items.push(item);
  }
  
  /**
   * Get current item count
   */
  getItemCount(): number {
    return this.state.items.length;
  }
  
  /**
   * Get current estimated address
   */
  getCurrentAddress(): number {
    return this.state.currentAddress;
  }
  
  // ========================================
  // LABEL MANAGEMENT
  // ========================================
  
  /**
   * Add a label at current position
   */
  label(name: string, type: LabelType, comment?: string): this {
    const label: AsmLabel = {
      kind: 'label',
      name,
      type,
      address: this.state.currentAddress,
      comment,
      sourceLocation: this.currentLocation,
    };
    
    this.state.labels.set(name, label);
    this.addItem(label);
    
    return this;
  }
  
  /**
   * Add a function label
   */
  functionLabel(name: string, comment?: string): this {
    this.state.functionCount++;
    return this.label(name, 'function' as LabelType, comment);
  }
  
  /**
   * Add a global variable label
   */
  globalLabel(name: string, comment?: string): this {
    this.state.globalCount++;
    return this.label(name, 'global' as LabelType, comment);
  }
  
  /**
   * Add a block label (local, starts with .)
   */
  blockLabel(name: string, comment?: string): this {
    return this.label(name, 'block' as LabelType, comment);
  }
  
  /**
   * Add a temporary label
   */
  tempLabel(name: string, comment?: string): this {
    return this.label(name, 'temp' as LabelType, comment);
  }
  
  // ========================================
  // DIRECTIVES
  // ========================================
  
  /**
   * Set assembly origin address
   */
  setOrigin(address: number, comment?: string): this {
    const origin: AsmOrigin = {
      kind: 'origin',
      address,
      comment,
    };
    this.state.currentAddress = address;
    this.addItem(origin);
    return this;
  }
  
  /**
   * Add a comment line
   */
  comment(text: string, style: 'line' | 'section' | 'inline' = 'line'): this {
    const comment: AsmComment = {
      kind: 'comment',
      text,
      style,
    };
    this.addItem(comment);
    return this;
  }
  
  /**
   * Add a section header comment
   */
  section(title: string): this {
    return this.comment(title, 'section');
  }
  
  /**
   * Add a blank line
   */
  blank(): this {
    const blank: AsmBlankLine = {
      kind: 'blank',
    };
    this.addItem(blank);
    return this;
  }
  
  /**
   * Add raw assembly text
   */
  raw(text: string): this {
    const raw: AsmRaw = {
      kind: 'raw',
      text,
    };
    this.addItem(raw);
    return this;
  }
  
  // ========================================
  // STATISTICS
  // ========================================
  
  /**
   * Add to code byte count
   */
  protected addCodeBytes(bytes: number): void {
    this.state.codeBytes += bytes;
    this.state.currentAddress += bytes;
  }
  
  /**
   * Add to data byte count
   */
  protected addDataBytes(bytes: number): void {
    this.state.dataBytes += bytes;
    this.state.currentAddress += bytes;
  }
  
  /**
   * Get current statistics
   */
  getStats(): { codeBytes: number; dataBytes: number; functionCount: number; globalCount: number } {
    return {
      codeBytes: this.state.codeBytes,
      dataBytes: this.state.dataBytes,
      functionCount: this.state.functionCount,
      globalCount: this.state.globalCount,
    };
  }
}
```

---

## File 2: `instruction-builder.ts`

### Purpose
CPU instruction methods:
- Load/Store: lda, ldx, ldy, sta, stx, sty
- Transfer: tax, tay, txa, tya, tsx, txs
- Arithmetic: adc, sbc, inc, dec, inx, iny, dex, dey
- Logical: and, ora, eor, bit
- Shift: asl, lsr, rol, ror
- Compare: cmp, cpx, cpy
- Branch: bcc, bcs, beq, bmi, bne, bpl, bvc, bvs
- Jump: jmp, jsr, rts, rti, brk
- Flag: clc, cld, cli, clv, sec, sed, sei
- Other: nop

### Implementation (~350 lines)

```typescript
/**
 * Instruction Builder
 * 
 * Provides methods for emitting 6502 CPU instructions.
 * Extends BaseAsmBuilder.
 * 
 * @module asm-il/builder/instruction-builder
 */

import { BaseAsmBuilder } from './base-builder.js';
import type { AsmInstruction, Mnemonic, AddressingMode } from '../types.js';
import { getInstructionBytes, getInstructionCycles } from '../types.js';

/**
 * Instruction Builder
 * 
 * Adds CPU instruction methods to the builder chain.
 */
export abstract class InstructionBuilder extends BaseAsmBuilder {
  
  // ========================================
  // CORE INSTRUCTION EMITTER
  // ========================================
  
  /**
   * Emit a CPU instruction
   */
  protected emitInstruction(
    mnemonic: Mnemonic,
    mode: AddressingMode,
    operand?: number | string,
    comment?: string
  ): this {
    const bytes = getInstructionBytes(mode);
    const cycles = getInstructionCycles(mnemonic, mode);
    
    const instruction: AsmInstruction = {
      kind: 'instruction',
      mnemonic,
      mode,
      operand,
      cycles,
      bytes,
      comment,
      sourceLocation: this.currentLocation,
    };
    
    this.addItem(instruction);
    this.addCodeBytes(bytes);
    
    return this;
  }
  
  // ========================================
  // LOAD INSTRUCTIONS
  // ========================================
  
  /** LDA immediate: LDA #$xx */
  ldaImm(value: number, comment?: string): this {
    return this.emitInstruction('LDA', 'immediate' as AddressingMode, value, comment);
  }
  
  /** LDA zero page: LDA $xx */
  ldaZp(address: number, comment?: string): this {
    return this.emitInstruction('LDA', 'zeroPage' as AddressingMode, address, comment);
  }
  
  /** LDA absolute: LDA $xxxx */
  ldaAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('LDA', 'absolute' as AddressingMode, address, comment);
  }
  
  /** LDX immediate: LDX #$xx */
  ldxImm(value: number, comment?: string): this {
    return this.emitInstruction('LDX', 'immediate' as AddressingMode, value, comment);
  }
  
  /** LDX zero page: LDX $xx */
  ldxZp(address: number, comment?: string): this {
    return this.emitInstruction('LDX', 'zeroPage' as AddressingMode, address, comment);
  }
  
  /** LDY immediate: LDY #$xx */
  ldyImm(value: number, comment?: string): this {
    return this.emitInstruction('LDY', 'immediate' as AddressingMode, value, comment);
  }
  
  /** LDY zero page: LDY $xx */
  ldyZp(address: number, comment?: string): this {
    return this.emitInstruction('LDY', 'zeroPage' as AddressingMode, address, comment);
  }
  
  // ========================================
  // STORE INSTRUCTIONS
  // ========================================
  
  /** STA zero page: STA $xx */
  staZp(address: number, comment?: string): this {
    return this.emitInstruction('STA', 'zeroPage' as AddressingMode, address, comment);
  }
  
  /** STA absolute: STA $xxxx */
  staAbs(address: number | string, comment?: string): this {
    return this.emitInstruction('STA', 'absolute' as AddressingMode, address, comment);
  }
  
  /** STX zero page: STX $xx */
  stxZp(address: number, comment?: string): this {
    return this.emitInstruction('STX', 'zeroPage' as AddressingMode, address, comment);
  }
  
  /** STY zero page: STY $xx */
  styZp(address: number, comment?: string): this {
    return this.emitInstruction('STY', 'zeroPage' as AddressingMode, address, comment);
  }
  
  // ========================================
  // TRANSFER INSTRUCTIONS (Implied mode)
  // ========================================
  
  /** TAX: Transfer A to X */
  tax(comment?: string): this {
    return this.emitInstruction('TAX', 'implied' as AddressingMode, undefined, comment);
  }
  
  /** TAY: Transfer A to Y */
  tay(comment?: string): this {
    return this.emitInstruction('TAY', 'implied' as AddressingMode, undefined, comment);
  }
  
  /** TXA: Transfer X to A */
  txa(comment?: string): this {
    return this.emitInstruction('TXA', 'implied' as AddressingMode, undefined, comment);
  }
  
  /** TYA: Transfer Y to A */
  tya(comment?: string): this {
    return this.emitInstruction('TYA', 'implied' as AddressingMode, undefined, comment);
  }
  
  // ========================================
  // STACK INSTRUCTIONS
  // ========================================
  
  /** PHA: Push A to stack */
  pha(comment?: string): this {
    return this.emitInstruction('PHA', 'implied' as AddressingMode, undefined, comment);
  }
  
  /** PLA: Pull A from stack */
  pla(comment?: string): this {
    return this.emitInstruction('PLA', 'implied' as AddressingMode, undefined, comment);
  }
  
  /** PHP: Push processor status */
  php(comment?: string): this {
    return this.emitInstruction('PHP', 'implied' as AddressingMode, undefined, comment);
  }
  
  /** PLP: Pull processor status */
  plp(comment?: string): this {
    return this.emitInstruction('PLP', 'implied' as AddressingMode, undefined, comment);
  }
  
  // ========================================
  // ARITHMETIC INSTRUCTIONS
  // ========================================
  
  /** ADC immediate: ADC #$xx */
  adcImm(value: number, comment?: string): this {
    return this.emitInstruction('ADC', 'immediate' as AddressingMode, value, comment);
  }
  
  /** SBC immediate: SBC #$xx */
  sbcImm(value: number, comment?: string): this {
    return this.emitInstruction('SBC', 'immediate' as AddressingMode, value, comment);
  }
  
  /** INC zero page: INC $xx */
  incZp(address: number, comment?: string): this {
    return this.emitInstruction('INC', 'zeroPage' as AddressingMode, address, comment);
  }
  
  /** DEC zero page: DEC $xx */
  decZp(address: number, comment?: string): this {
    return this.emitInstruction('DEC', 'zeroPage' as AddressingMode, address, comment);
  }
  
  /** INX: Increment X */
  inx(comment?: string): this {
    return this.emitInstruction('INX', 'implied' as AddressingMode, undefined, comment);
  }
  
  /** INY: Increment Y */
  iny(comment?: string): this {
    return this.emitInstruction('INY', 'implied' as AddressingMode, undefined, comment);
  }
  
  /** DEX: Decrement X */
  dex(comment?: string): this {
    return this.emitInstruction('DEX', 'implied' as AddressingMode, undefined, comment);
  }
  
  /** DEY: Decrement Y */
  dey(comment?: string): this {
    return this.emitInstruction('DEY', 'implied' as AddressingMode, undefined, comment);
  }
  
  // ========================================
  // LOGICAL INSTRUCTIONS
  // ========================================
  
  /** AND immediate: AND #$xx */
  andImm(value: number, comment?: string): this {
    return this.emitInstruction('AND', 'immediate' as AddressingMode, value, comment);
  }
  
  /** ORA immediate: ORA #$xx */
  oraImm(value: number, comment?: string): this {
    return this.emitInstruction('ORA', 'immediate' as AddressingMode, value, comment);
  }
  
  /** EOR immediate: EOR #$xx */
  eorImm(value: number, comment?: string): this {
    return this.emitInstruction('EOR', 'immediate' as AddressingMode, value, comment);
  }
  
  // ========================================
  // COMPARE INSTRUCTIONS
  // ========================================
  
  /** CMP immediate: CMP #$xx */
  cmpImm(value: number, comment?: string): this {
    return this.emitInstruction('CMP', 'immediate' as AddressingMode, value, comment);
  }
  
  /** CPX immediate: CPX #$xx */
  cpxImm(value: number, comment?: string): this {
    return this.emitInstruction('CPX', 'immediate' as AddressingMode, value, comment);
  }
  
  /** CPY immediate: CPY #$xx */
  cpyImm(value: number, comment?: string): this {
    return this.emitInstruction('CPY', 'immediate' as AddressingMode, value, comment);
  }
  
  // ========================================
  // BRANCH INSTRUCTIONS
  // ========================================
  
  /** BEQ: Branch if equal (Z=1) */
  beq(label: string, comment?: string): this {
    return this.emitInstruction('BEQ', 'relative' as AddressingMode, label, comment);
  }
  
  /** BNE: Branch if not equal (Z=0) */
  bne(label: string, comment?: string): this {
    return this.emitInstruction('BNE', 'relative' as AddressingMode, label, comment);
  }
  
  /** BCC: Branch if carry clear (C=0) */
  bcc(label: string, comment?: string): this {
    return this.emitInstruction('BCC', 'relative' as AddressingMode, label, comment);
  }
  
  /** BCS: Branch if carry set (C=1) */
  bcs(label: string, comment?: string): this {
    return this.emitInstruction('BCS', 'relative' as AddressingMode, label, comment);
  }
  
  /** BMI: Branch if minus (N=1) */
  bmi(label: string, comment?: string): this {
    return this.emitInstruction('BMI', 'relative' as AddressingMode, label, comment);
  }
  
  /** BPL: Branch if plus (N=0) */
  bpl(label: string, comment?: string): this {
    return this.emitInstruction('BPL', 'relative' as AddressingMode, label, comment);
  }
  
  // ========================================
  // JUMP INSTRUCTIONS
  // ========================================
  
  /** JMP absolute: JMP $xxxx or JMP label */
  jmp(target: number | string, comment?: string): this {
    return this.emitInstruction('JMP', 'absolute' as AddressingMode, target, comment);
  }
  
  /** JSR: Jump to subroutine */
  jsr(target: number | string, comment?: string): this {
    return this.emitInstruction('JSR', 'absolute' as AddressingMode, target, comment);
  }
  
  /** RTS: Return from subroutine */
  rts(comment?: string): this {
    return this.emitInstruction('RTS', 'implied' as AddressingMode, undefined, comment);
  }
  
  // ========================================
  // FLAG INSTRUCTIONS
  // ========================================
  
  /** CLC: Clear carry flag */
  clc(comment?: string): this {
    return this.emitInstruction('CLC', 'implied' as AddressingMode, undefined, comment);
  }
  
  /** SEC: Set carry flag */
  sec(comment?: string): this {
    return this.emitInstruction('SEC', 'implied' as AddressingMode, undefined, comment);
  }
  
  /** CLI: Clear interrupt disable */
  cli(comment?: string): this {
    return this.emitInstruction('CLI', 'implied' as AddressingMode, undefined, comment);
  }
  
  /** SEI: Set interrupt disable */
  sei(comment?: string): this {
    return this.emitInstruction('SEI', 'implied' as AddressingMode, undefined, comment);
  }
  
  // ========================================
  // OTHER
  // ========================================
  
  /** NOP: No operation */
  nop(comment?: string): this {
    return this.emitInstruction('NOP', 'implied' as AddressingMode, undefined, comment);
  }
}
```

---

## File 3: `data-builder.ts`

### Purpose
Data directive methods:
- byte(): Single bytes
- word(): 16-bit words
- text(): Text strings
- fill(): Memory fill

### Implementation (~200 lines)

```typescript
/**
 * Data Builder
 * 
 * Provides methods for emitting data directives.
 * Extends InstructionBuilder.
 * 
 * @module asm-il/builder/data-builder
 */

import { InstructionBuilder } from './instruction-builder.js';
import type { AsmData, DataType } from '../types.js';

/**
 * Data Builder
 * 
 * Adds data directive methods to the builder chain.
 */
export abstract class DataBuilder extends InstructionBuilder {
  
  /**
   * Emit bytes: !byte $xx, $yy, ...
   */
  byte(values: number[], comment?: string): this {
    const data: AsmData = {
      kind: 'data',
      type: 'byte' as DataType,
      values,
      comment,
      sourceLocation: this.currentLocation,
    };
    
    this.addItem(data);
    this.addDataBytes(values.length);
    
    return this;
  }
  
  /**
   * Emit words: !word $xxxx, $yyyy, ...
   */
  word(values: number[], comment?: string): this {
    const data: AsmData = {
      kind: 'data',
      type: 'word' as DataType,
      values,
      comment,
      sourceLocation: this.currentLocation,
    };
    
    this.addItem(data);
    this.addDataBytes(values.length * 2);
    
    return this;
  }
  
  /**
   * Emit text: !text "string"
   */
  text(content: string, nullTerminate: boolean = false, comment?: string): this {
    const data: AsmData = {
      kind: 'data',
      type: 'text' as DataType,
      values: content,
      comment,
      sourceLocation: this.currentLocation,
    };
    
    this.addItem(data);
    this.addDataBytes(content.length + (nullTerminate ? 1 : 0));
    
    if (nullTerminate) {
      this.byte([0], 'null terminator');
    }
    
    return this;
  }
  
  /**
   * Emit fill: !fill count, value
   */
  fill(count: number, value: number = 0, comment?: string): this {
    const data: AsmData = {
      kind: 'data',
      type: 'fill' as DataType,
      values: { count, value },
      comment,
      sourceLocation: this.currentLocation,
    };
    
    this.addItem(data);
    this.addDataBytes(count);
    
    return this;
  }
}
```

---

## File 4: `module-builder.ts`

### Purpose
Final concrete class:
- Module construction
- build() method returning AsmModule
- Header/footer generation helpers

### Implementation (~200 lines)

```typescript
/**
 * ASM Module Builder
 * 
 * Final concrete class for building ASM-IL modules.
 * Extends DataBuilder.
 * 
 * @module asm-il/builder/module-builder
 */

import { DataBuilder } from './data-builder.js';
import type { AsmModule, AsmModuleMetadata } from '../types.js';

/**
 * ASM Module Builder
 * 
 * Complete builder for constructing ASM-IL modules.
 * This is the final class in the inheritance chain.
 * 
 * @example
 * ```typescript
 * const module = new AsmModuleBuilder('main.blend', 0x0801, 'c64')
 *   .section('Header')
 *   .setOrigin(0x0801)
 *   .functionLabel('_main')
 *   .ldaImm(5, 'Load value')
 *   .staAbs(0xD020, 'Set border color')
 *   .rts('Return')
 *   .build();
 * ```
 */
export class AsmModuleBuilder extends DataBuilder {
  
  /**
   * Build the final AsmModule
   * 
   * @returns Complete ASM-IL module
   */
  build(): AsmModule {
    const metadata: AsmModuleMetadata = {
      generatedAt: new Date().toISOString(),
      compilerVersion: '0.1.0',
      optimizationLevel: 'O0',
      estimatedCodeSize: this.state.codeBytes,
      estimatedDataSize: this.state.dataBytes,
      functionCount: this.state.functionCount,
      globalCount: this.state.globalCount,
    };
    
    return {
      name: this.state.name,
      origin: this.state.origin,
      target: this.state.target,
      items: [...this.state.items],
      labels: new Map(this.state.labels),
      metadata,
    };
  }
  
  /**
   * Reset builder for reuse
   */
  reset(): this {
    this.state.items = [];
    this.state.labels.clear();
    this.state.currentAddress = this.state.origin;
    this.state.codeBytes = 0;
    this.state.dataBytes = 0;
    this.state.functionCount = 0;
    this.state.globalCount = 0;
    return this;
  }
  
  /**
   * Emit file header with standard comments
   */
  header(moduleName?: string): this {
    this.comment('===========================================================================', 'section');
    this.comment('Blend65 Compiler Output');
    this.comment(`Module: ${moduleName ?? this.state.name}`);
    this.comment(`Generated: ${new Date().toISOString()}`);
    this.comment(`Target: ${this.state.target}`);
    this.comment('===========================================================================', 'section');
    this.blank();
    return this;
  }
  
  /**
   * Emit file footer with statistics
   */
  footer(): this {
    this.blank();
    this.section('End of Program');
    this.comment(`Code size: ${this.state.codeBytes} bytes`);
    this.comment(`Data size: ${this.state.dataBytes} bytes`);
    this.comment(`Functions: ${this.state.functionCount}`);
    this.comment(`Globals: ${this.state.globalCount}`);
    return this;
  }
}
```

---

## Test Plan

### Test Files (Split by Class)

| File | Tests | Description |
|------|-------|-------------|
| base-builder.test.ts | ~20 | State, labels, comments, origin |
| instruction-builder.test.ts | ~40 | All CPU instruction methods |
| data-builder.test.ts | ~25 | byte, word, text, fill |
| module-builder.test.ts | ~35 | build(), reset(), header/footer |

**Total: ~120 tests**

---

## Task Checklist

| Task | Description | Session | Status |
|------|-------------|---------|--------|
| 1 | Create builder/index.ts | 3 | [ ] |
| 2 | Implement BaseAsmBuilder | 3 | [ ] |
| 3 | Write base-builder.test.ts | 3 | [ ] |
| 4 | Implement InstructionBuilder | 4 | [ ] |
| 5 | Write instruction-builder.test.ts | 4 | [ ] |
| 6 | Implement DataBuilder | 5 | [ ] |
| 7 | Write data-builder.test.ts | 5 | [ ] |
| 8 | Implement AsmModuleBuilder | 5 | [ ] |
| 9 | Write module-builder.test.ts | 5 | [ ] |
| 10 | All ~120 tests passing | 5 | [ ] |

---

## Related Documents

- **Parent**: [03-codegen-stub.md](03-codegen-stub.md)
- **Previous**: [03a-asm-il-types.md](03a-asm-il-types.md)
- **Next**: [03c-asm-il-optimizer.md](03c-asm-il-optimizer.md)