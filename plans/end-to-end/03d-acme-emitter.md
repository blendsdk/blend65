# 03d - ACME Emitter

> **Phase:** 2 (End-to-End Compilation)
> **Session:** 7
> **Estimated Tests:** ~45
> **Dependencies:** 03a (types), 03c (optimizer)

---

## Overview

The ACME Emitter serializes `AsmModule` into ACME assembler text format. ACME is the target assembler for Blend65, and the emitter must produce syntactically correct ACME source that can be assembled into a working C64 binary.

### Pipeline Position
```
IL Module → CodeGenerator → AsmModule → AsmOptimizer → [ACME Emitter] → .asm text
                                                             ↑
                                                       This component
```

### Design Philosophy
- **Correctness first**: Generate valid ACME syntax
- **Readability**: Produce human-readable output with comments
- **Configurable**: Support different output styles (compact vs verbose)
- **Extensible**: Easy to add new directives and pseudo-ops

---

## Directory Structure

```
packages/compiler/src/asm-il/emitters/
├── index.ts              # Public exports
├── base-emitter.ts       # Abstract base class (~150 lines)
└── acme-emitter.ts       # ACME-specific emitter (~250 lines)
```

---

## ACME Syntax Reference

### Instructions
```asm
; Standard format: MNEMONIC OPERAND
        LDA #$00        ; Immediate
        STA $D020       ; Absolute
        LDA $FB         ; Zero page
        STA $0400,X     ; Absolute indexed X
        LDA ($FB),Y     ; Indirect indexed Y
```

### Labels
```asm
.main_loop              ; Local label (starts with .)
global_label            ; Global label
+exported_label         ; Exported label (ACME specific)
```

### Data Directives
```asm
        !byte $00, $01, $02     ; Byte data
        !word $0801             ; Word data (little-endian)
        !text "HELLO"           ; ASCII text
        !fill 256, $00          ; Fill with value
```

### Pseudo-ops
```asm
        *= $0801                ; Set program counter
        !to "output.prg", cbm   ; Output file
        !source "include.asm"   ; Include file
```

---

## Type Definitions

### Emitter Configuration

```typescript
/**
 * Configuration for the ACME emitter.
 */
export interface AcmeEmitterConfig {
  /** Include source comments in output */
  includeComments: boolean;
  
  /** Include blank lines for readability */
  includeBlankLines: boolean;
  
  /** Tab width for indentation (0 = use tabs) */
  indentWidth: number;
  
  /** Use uppercase mnemonics (LDA vs lda) */
  uppercaseMnemonics: boolean;
  
  /** Hex format: '$' prefix (ACME) or '0x' prefix */
  hexPrefix: '$' | '0x';
  
  /** Include byte/cycle counts as comments */
  includeCycleCounts: boolean;
  
  /** Line ending style */
  lineEnding: '\n' | '\r\n';
}

/**
 * Default ACME emitter configuration.
 */
export const DEFAULT_ACME_EMITTER_CONFIG: AcmeEmitterConfig = {
  includeComments: true,
  includeBlankLines: true,
  indentWidth: 8,           // 8-space indent (common for 6502)
  uppercaseMnemonics: true,
  hexPrefix: '$',
  includeCycleCounts: false,
  lineEnding: '\n'
};
```

### Emitter Result

```typescript
/**
 * Result from emitting an AsmModule.
 */
export interface EmitterResult {
  /** The generated assembly text */
  text: string;
  
  /** Number of lines generated */
  lineCount: number;
  
  /** Total bytes of code/data */
  totalBytes: number;
  
  /** Source map entries (line -> source location) */
  sourceMap: Map<number, SourceLocation>;
}
```

---

## Implementation Plan

### File 1: `base-emitter.ts` (~150 lines)

```typescript
import type { AsmModule, AsmElement, AsmInstruction, AsmLabel, AsmData, AsmComment } from '../types.js';
import type { AcmeEmitterConfig, EmitterResult } from './types.js';

/**
 * Abstract base class for assembly emitters.
 * Provides common infrastructure for serializing AsmModule to text.
 */
export abstract class BaseEmitter {
  protected readonly config: AcmeEmitterConfig;
  protected lines: string[] = [];
  protected currentLine: number = 0;
  protected totalBytes: number = 0;
  protected sourceMap: Map<number, SourceLocation> = new Map();
  
  constructor(config: Partial<AcmeEmitterConfig> = {}) {
    this.config = { ...DEFAULT_ACME_EMITTER_CONFIG, ...config };
  }
  
  /**
   * Emit the entire module to assembly text.
   */
  abstract emit(module: AsmModule): EmitterResult;
  
  /**
   * Reset emitter state for new emission.
   */
  protected reset(): void {
    this.lines = [];
    this.currentLine = 0;
    this.totalBytes = 0;
    this.sourceMap = new Map();
  }
  
  /**
   * Add a line to the output.
   */
  protected addLine(line: string, sourceLocation?: SourceLocation): void {
    this.lines.push(line);
    this.currentLine++;
    if (sourceLocation) {
      this.sourceMap.set(this.currentLine, sourceLocation);
    }
  }
  
  /**
   * Add a blank line if configured.
   */
  protected addBlankLine(): void {
    if (this.config.includeBlankLines) {
      this.addLine('');
    }
  }
  
  /**
   * Format a hex value with configured prefix.
   */
  protected formatHex(value: number, width: number = 2): string {
    const hex = value.toString(16).toUpperCase().padStart(width, '0');
    return `${this.config.hexPrefix}${hex}`;
  }
  
  /**
   * Create indentation string.
   */
  protected indent(): string {
    if (this.config.indentWidth === 0) {
      return '\t';
    }
    return ' '.repeat(this.config.indentWidth);
  }
  
  /**
   * Build the final result.
   */
  protected buildResult(): EmitterResult {
    return {
      text: this.lines.join(this.config.lineEnding),
      lineCount: this.lines.length,
      totalBytes: this.totalBytes,
      sourceMap: this.sourceMap
    };
  }
}
```

### File 2: `acme-emitter.ts` (~250 lines)

```typescript
import type { 
  AsmModule, AsmElement, AsmSection,
  AsmInstruction, AsmLabel, AsmData, AsmComment, AsmDirective 
} from '../types.js';
import type { EmitterResult } from './types.js';
import { BaseEmitter } from './base-emitter.js';
import { AddressingMode } from '../types.js';

/**
 * ACME assembler emitter.
 * Serializes AsmModule to ACME-compatible assembly text.
 */
export class AcmeEmitter extends BaseEmitter {
  /**
   * Emit the module to ACME assembly text.
   */
  emit(module: AsmModule): EmitterResult {
    this.reset();
    
    // Emit header
    this.emitHeader(module);
    
    // Emit each section
    for (const section of module.sections) {
      this.emitSection(section);
    }
    
    // Emit footer
    this.emitFooter(module);
    
    return this.buildResult();
  }
  
  /**
   * Emit module header (origin, output file, etc.)
   */
  protected emitHeader(module: AsmModule): void {
    // Output file directive
    if (module.outputFile) {
      this.addLine(`!to "${module.outputFile}", cbm`);
    }
    
    // Set origin
    this.addLine(`*= ${this.formatHex(module.origin, 4)}`);
    this.addBlankLine();
  }
  
  /**
   * Emit a single section.
   */
  protected emitSection(section: AsmSection): void {
    // Section comment
    if (this.config.includeComments && section.name) {
      this.addLine(`; === ${section.name} ===`);
    }
    
    // Emit each element
    for (const element of section.elements) {
      this.emitElement(element);
    }
    
    this.addBlankLine();
  }
  
  /**
   * Emit a single element (instruction, label, data, etc.)
   */
  protected emitElement(element: AsmElement): void {
    switch (element.kind) {
      case 'instruction':
        this.emitInstruction(element);
        break;
      case 'label':
        this.emitLabel(element);
        break;
      case 'data':
        this.emitData(element);
        break;
      case 'comment':
        this.emitComment(element);
        break;
      case 'directive':
        this.emitDirective(element);
        break;
    }
  }
  
  /**
   * Emit a CPU instruction.
   */
  protected emitInstruction(instr: AsmInstruction): void {
    const mnemonic = this.config.uppercaseMnemonics 
      ? instr.mnemonic.toUpperCase() 
      : instr.mnemonic.toLowerCase();
    
    const operand = this.formatOperand(instr);
    const line = operand 
      ? `${this.indent()}${mnemonic} ${operand}`
      : `${this.indent()}${mnemonic}`;
    
    // Add cycle count comment if configured
    let finalLine = line;
    if (this.config.includeCycleCounts && instr.cycles) {
      finalLine = line.padEnd(32) + `; ${instr.bytes}b ${instr.cycles}c`;
    }
    
    this.addLine(finalLine, instr.sourceLocation);
    this.totalBytes += instr.bytes;
  }
  
  /**
   * Format instruction operand based on addressing mode.
   */
  protected formatOperand(instr: AsmInstruction): string {
    const { mode, operand } = instr;
    
    switch (mode) {
      case AddressingMode.Implied:
      case AddressingMode.Accumulator:
        return '';
      
      case AddressingMode.Immediate:
        return `#${this.formatHex(operand as number)}`;
      
      case AddressingMode.ZeroPage:
        return this.formatHex(operand as number);
      
      case AddressingMode.ZeroPageX:
        return `${this.formatHex(operand as number)},X`;
      
      case AddressingMode.ZeroPageY:
        return `${this.formatHex(operand as number)},Y`;
      
      case AddressingMode.Absolute:
        return this.formatHex(operand as number, 4);
      
      case AddressingMode.AbsoluteX:
        return `${this.formatHex(operand as number, 4)},X`;
      
      case AddressingMode.AbsoluteY:
        return `${this.formatHex(operand as number, 4)},Y`;
      
      case AddressingMode.Indirect:
        return `(${this.formatHex(operand as number, 4)})`;
      
      case AddressingMode.IndirectX:
        return `(${this.formatHex(operand as number)}),X`;
      
      case AddressingMode.IndirectY:
        return `(${this.formatHex(operand as number)}),Y`;
      
      case AddressingMode.Relative:
        // Relative branches use label names
        return typeof operand === 'string' ? operand : this.formatHex(operand as number);
      
      default:
        return String(operand);
    }
  }
  
  /**
   * Emit a label.
   */
  protected emitLabel(label: AsmLabel): void {
    const prefix = label.exported ? '+' : label.local ? '.' : '';
    this.addLine(`${prefix}${label.name}`);
  }
  
  /**
   * Emit data directive.
   */
  protected emitData(data: AsmData): void {
    switch (data.type) {
      case 'byte':
        this.emitBytes(data.values as number[]);
        break;
      case 'word':
        this.emitWords(data.values as number[]);
        break;
      case 'text':
        this.emitText(data.values as string);
        break;
      case 'fill':
        this.emitFill(data.count!, data.value!);
        break;
    }
  }
  
  /**
   * Emit !byte directive.
   */
  protected emitBytes(values: number[]): void {
    const formatted = values.map(v => this.formatHex(v)).join(', ');
    this.addLine(`${this.indent()}!byte ${formatted}`);
    this.totalBytes += values.length;
  }
  
  /**
   * Emit !word directive.
   */
  protected emitWords(values: number[]): void {
    const formatted = values.map(v => this.formatHex(v, 4)).join(', ');
    this.addLine(`${this.indent()}!word ${formatted}`);
    this.totalBytes += values.length * 2;
  }
  
  /**
   * Emit !text directive.
   */
  protected emitText(text: string): void {
    this.addLine(`${this.indent()}!text "${text}"`);
    this.totalBytes += text.length;
  }
  
  /**
   * Emit !fill directive.
   */
  protected emitFill(count: number, value: number): void {
    this.addLine(`${this.indent()}!fill ${count}, ${this.formatHex(value)}`);
    this.totalBytes += count;
  }
  
  /**
   * Emit a comment.
   */
  protected emitComment(comment: AsmComment): void {
    if (this.config.includeComments) {
      this.addLine(`; ${comment.text}`);
    }
  }
  
  /**
   * Emit a directive (origin change, etc.)
   */
  protected emitDirective(directive: AsmDirective): void {
    switch (directive.type) {
      case 'origin':
        this.addLine(`*= ${this.formatHex(directive.value as number, 4)}`);
        break;
      case 'align':
        this.addLine(`!align ${directive.value}`);
        break;
    }
  }
  
  /**
   * Emit module footer.
   */
  protected emitFooter(module: AsmModule): void {
    // Optional: Add statistics comment
    if (this.config.includeComments) {
      this.addLine(`; Total bytes: ${this.totalBytes}`);
    }
  }
}

/**
 * Factory function to create an ACME emitter.
 */
export function createAcmeEmitter(config?: Partial<AcmeEmitterConfig>): AcmeEmitter {
  return new AcmeEmitter(config);
}
```

---

## Test Plan (~45 tests)

### Test File: `__tests__/asm-il/emitter.test.ts`

```typescript
describe('ACME Emitter', () => {
  describe('Header/Footer', () => {
    it('should emit origin directive');
    it('should emit output file directive');
    it('should emit total bytes comment');
    it('should respect includeComments config');
  });
  
  describe('Instructions - Addressing Modes', () => {
    it('should emit implied mode (CLC, RTS)');
    it('should emit accumulator mode (ASL A)');
    it('should emit immediate mode (LDA #$00)');
    it('should emit zero page mode (LDA $FB)');
    it('should emit zero page X mode (LDA $FB,X)');
    it('should emit zero page Y mode (LDX $FB,Y)');
    it('should emit absolute mode (LDA $0400)');
    it('should emit absolute X mode (LDA $0400,X)');
    it('should emit absolute Y mode (LDA $0400,Y)');
    it('should emit indirect mode (JMP ($FFFC))');
    it('should emit indirect X mode (LDA ($FB,X))');
    it('should emit indirect Y mode (LDA ($FB),Y)');
    it('should emit relative mode with label');
    it('should emit relative mode with offset');
  });
  
  describe('Instructions - Formatting', () => {
    it('should use uppercase mnemonics by default');
    it('should use lowercase mnemonics when configured');
    it('should use $ hex prefix by default');
    it('should use 0x hex prefix when configured');
    it('should pad hex values correctly');
    it('should include cycle counts when configured');
    it('should track source locations');
  });
  
  describe('Labels', () => {
    it('should emit global labels');
    it('should emit local labels with . prefix');
    it('should emit exported labels with + prefix');
  });
  
  describe('Data Directives', () => {
    it('should emit !byte with single value');
    it('should emit !byte with multiple values');
    it('should emit !word with single value');
    it('should emit !word with multiple values');
    it('should emit !text with string');
    it('should emit !fill directive');
    it('should track data bytes correctly');
  });
  
  describe('Comments', () => {
    it('should emit section comments');
    it('should emit inline comments');
    it('should skip comments when includeComments = false');
  });
  
  describe('Sections', () => {
    it('should emit multiple sections');
    it('should add blank lines between sections');
    it('should respect includeBlankLines config');
  });
  
  describe('Configuration', () => {
    it('should use default config');
    it('should accept partial config');
    it('should use tabs when indentWidth = 0');
    it('should use spaces when indentWidth > 0');
  });
  
  describe('Complete Module', () => {
    it('should emit empty module');
    it('should emit module with BASIC loader');
    it('should emit complete program');
    it('should return correct lineCount');
    it('should return correct totalBytes');
    it('should return source map entries');
  });
});
```

---

## Integration Points

### With Optimizer
```typescript
// Optimizer produces AsmModule (possibly transformed)
const optimizerResult = asmOptimizer.optimize(asmModule);

// Emitter serializes to text
const emitter = createAcmeEmitter({
  includeComments: !isProductionBuild,
  includeCycleCounts: isDebugBuild
});
const result = emitter.emit(optimizerResult.module);

// Write to file
await fs.writeFile('output.asm', result.text);
```

### With Source Maps
```typescript
// Emitter produces source map
const result = emitter.emit(asmModule);

// Can be used for debugging
for (const [line, sourceLocation] of result.sourceMap) {
  console.log(`ASM line ${line} -> source ${sourceLocation.file}:${sourceLocation.line}`);
}
```

---

## Task Checklist

| Task | Description | Status |
|------|-------------|--------|
| 7.1 | Create emitter types (interfaces) | ⬜ |
| 7.2 | Implement BaseEmitter | ⬜ |
| 7.3 | Implement AcmeEmitter - header/footer | ⬜ |
| 7.4 | Implement AcmeEmitter - instructions | ⬜ |
| 7.5 | Implement AcmeEmitter - labels | ⬜ |
| 7.6 | Implement AcmeEmitter - data directives | ⬜ |
| 7.7 | Write unit tests for all addressing modes | ⬜ |
| 7.8 | Write unit tests for data directives | ⬜ |
| 7.9 | Write integration tests for complete modules | ⬜ |
| 7.10 | Create index.ts with public exports | ⬜ |