# CodeGenerator Refactor: ASM-IL Mandatory

> **Document**: 03-codegen-refactor.md
> **Parent**: [Index](00-index.md)

## Overview

This document specifies the changes needed to make the CodeGenerator produce ASM-IL exclusively.

## Architecture

### Current Architecture

```
BaseCodeGenerator
  ├── assemblyWriter: AssemblyWriter  ← REMOVE
  ├── asmBuilder: AsmModuleBuilder    ← KEEP (primary)
  ├── useAsmIL: boolean = false       ← REMOVE
  ├── labelGenerator: LabelGenerator  ← KEEP
  └── sourceMapper: SourceMapper      ← INTEGRATE with ASM-IL
      │
      ▼
GlobalsGenerator extends BaseCodeGenerator
      │
      ▼
InstructionGenerator extends GlobalsGenerator
      │
      ▼
CodeGenerator extends InstructionGenerator
```

### Proposed Architecture

```
BaseCodeGenerator
  ├── asmBuilder: AsmModuleBuilder    ← PRIMARY OUTPUT
  ├── labelGenerator: LabelGenerator  ← KEEP
  └── currentSourceLocation?: SourceLocation  ← NEW: track current loc
      │
      ▼
GlobalsGenerator extends BaseCodeGenerator
      │
      ▼
InstructionGenerator extends GlobalsGenerator
      │
      ▼
CodeGenerator extends InstructionGenerator
      │
      │  generate(ilModule, options)
      │      │
      │      ▼
      │  AsmModule ────────────────────►  AcmeEmitter  ────►  text
      │                                                        │
      └────────────────────────────────────────────────────────┘
```

## Implementation Details

### Changes to BaseCodeGenerator

**Remove:**
```typescript
// REMOVE these
protected assemblyWriter: AssemblyWriter;
protected useAsmIL: boolean = false;
```

**Keep/Enhance:**
```typescript
// KEEP these
protected asmBuilder: AsmModuleBuilder;
protected labelGenerator: LabelGenerator;
protected sourceMapper: SourceMapper;  // May keep for backward compat

// ADD this
protected currentSourceLocation?: SourceLocation;
```

**Update emit methods:**

Before:
```typescript
protected emitLdaImmediate(value: number, comment?: string): void {
  // Legacy: AssemblyWriter (ALWAYS RUNS) - REMOVE THIS
  this.emitInstruction('LDA', this.formatImmediate(value), comment, 2);

  // Phase 3e: AsmBuilder (ONLY IF useAsmIL is true) - MAKE THIS PRIMARY
  if (this.useAsmIL) {
    this.asmBuilder.ldaImm(value, comment);
  }
}
```

After:
```typescript
protected emitLdaImmediate(value: number, comment?: string, location?: SourceLocation): void {
  this.asmBuilder.ldaImm(value, comment, location ?? this.currentSourceLocation);
  this.addCodeBytes(2);
}
```

### Changes to InstructionGenerator

All `generateXxx` methods need to:
1. Pass source location from IL instruction metadata
2. Use only `asmBuilder` methods

Example:
```typescript
protected generateConst(instr: ILConstInstruction): void {
  const value = instr.value;
  const location = instr.metadata.location;
  
  if (value > 255) {
    const lowByte = value & 0xFF;
    const highByte = (value >> 8) & 0xFF;
    this.asmBuilder.ldaImm(lowByte, `${instr.result} = ${value} (low byte)`, location);
    this.asmBuilder.ldxImm(highByte, `${instr.result} high byte`, location);
  } else {
    this.asmBuilder.ldaImm(value, `${instr.result} = ${value}`, location);
  }
}
```

### Changes to CodeGenerator

**Update `generate()` method:**

```typescript
public generate(module: ILModule, options: CodegenOptions): CodegenResult {
  this.options = options;
  this.currentModule = module;
  
  // Reset state
  this.resetState();
  
  // Configure ASM-IL builder
  const loadAddress = options.loadAddress ?? C64_BASIC_START;
  this.startAsmILGeneration(module.name, loadAddress);
  
  // === GENERATION PIPELINE ===
  this.generateHeader();
  if (options.basicStub !== false) {
    this.generateBasicStubSection();
  }
  this.generateEntryPoint();
  this.generateGlobals();
  this.generateFunctions();
  this.generateFooter();
  this.finalizeStats();
  
  // === BUILD RESULT ===
  const asmModule = this.finishAsmILGeneration();
  
  // Convert to text via emitter
  const emitter = createAcmeEmitter({
    includeComments: true,
    includeSourceComments: options.debug === 'inline' || options.debug === 'both',
    uppercaseMnemonics: true,
  });
  const emitResult = emitter.emit(asmModule);
  const assembly = emitResult.text;
  
  // Assemble to binary if requested
  let binary: Uint8Array | undefined;
  if (options.format === 'prg' || options.format === 'both') {
    binary = this.assembleWithAcme(assembly);
  }
  
  // Generate VICE labels from ASM-IL labels
  let viceLabels: string | undefined;
  if (options.debug === 'vice' || options.debug === 'both') {
    viceLabels = this.generateViceLabelsFromAsmIL(asmModule);
  }
  
  return {
    module: asmModule,  // ALWAYS populated now
    assembly,
    binary,
    sourceMap: this.extractSourceMapFromAsmIL(asmModule),
    viceLabels,
    warnings: this.getWarningsWithLocations(),
    stats: this.getStats(),
  };
}
```

**Remove `generateWithAsmIL()` method** - no longer needed since generate() always uses ASM-IL.

## New Functions/Methods

### `generateViceLabelsFromAsmIL(module: AsmModule): string`

```typescript
protected generateViceLabelsFromAsmIL(module: AsmModule): string {
  const lines: string[] = [];
  let address = module.origin;
  
  for (const item of module.items) {
    if (isAsmLabel(item)) {
      lines.push(`al ${this.formatHex(address, 4)} .${item.name}`);
    }
    if (isAsmInstruction(item)) {
      address += item.bytes;
    }
    if (isAsmData(item)) {
      address += this.calculateDataSize(item);
    }
  }
  
  return lines.join('\n');
}
```

### `extractSourceMapFromAsmIL(module: AsmModule): SourceMapEntry[]`

```typescript
protected extractSourceMapFromAsmIL(module: AsmModule): SourceMapEntry[] {
  const entries: SourceMapEntry[] = [];
  let address = module.origin;
  
  for (const item of module.items) {
    if (isAsmInstruction(item) && item.sourceLocation) {
      entries.push({
        address,
        source: item.sourceLocation,
        label: undefined,
        description: item.comment,
      });
    }
    if (isAsmInstruction(item)) {
      address += item.bytes;
    }
  }
  
  return entries;
}
```

## Code Examples

### Example 1: Simple Hardware Write

**IL Input:**
```
CONST %0 = 14
HARDWARE_WRITE $D020, %0
```

**Generated ASM-IL nodes:**
```typescript
[
  { kind: 'instruction', mnemonic: 'LDA', mode: 'immediate', operand: 14, 
    comment: '%0 = 14', sourceLocation: { file: 'test.blend', ... } },
  { kind: 'instruction', mnemonic: 'STA', mode: 'absolute', operand: 0xD020,
    comment: 'Write to $D020', sourceLocation: { file: 'test.blend', ... } },
]
```

**Emitted Assembly:**
```asm
; test.blend:5:3
  LDA #$0E         ; %0 = 14
; test.blend:6:3
  STA $D020        ; Write to $D020
```

## Error Handling

| Error Case                       | Handling Strategy                         |
| -------------------------------- | ----------------------------------------- |
| Missing AsmBuilder method        | Add method to builder, fail fast otherwise |
| Null source location             | Use `currentSourceLocation` fallback      |
| Unknown IL instruction           | Emit comment placeholder + warning        |

## Testing Requirements

- Unit tests for all refactored emit methods
- Integration tests for full code generation
- Snapshot tests comparing output before/after

## Migration Notes

**Methods to remove from BaseCodeGenerator:**
- `assemblyWriter` property
- `useAsmIL` property
- All direct `this.assemblyWriter.xxx()` calls
- Conditional `if (this.useAsmIL)` blocks

**Methods to update:**
- All `emit*` methods (50+ methods)
- All `generate*` methods in InstructionGenerator
- `generate()` in CodeGenerator