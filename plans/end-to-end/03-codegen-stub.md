# Phase 2: Code Generation Stub

> **Status**: Planning  
> **Phase**: 2  
> **Priority**: HIGH  
> **Dependencies**: Phase 1 (Compiler Entry Point)  
> **Estimated Tasks**: 8

---

## Codebase Analysis (Validated)

**IL Infrastructure Exists (READY for consumption):**
- ✅ `ILModule` - Complete compilation unit with functions, globals, imports, exports, entry point
- ✅ `ILFunction` - Function with BasicBlocks, parameters, return type
- ✅ `BasicBlock` - Control flow with instructions, predecessors, successors
- ✅ `ILInstruction` - 30+ instruction types (binary, unary, const, jump, branch, return, load/store, peek/poke, hardware read/write, etc.)
- ✅ `ILGlobalVariable` - Storage class (ZeroPage, Ram, Data, Map), fixed addresses, initial values
- ✅ `ILBuilder` - Builder pattern for IL construction
- ✅ `ILPrinter` - Debug output for IL
- ✅ `ILValidator` - Validation infrastructure

**Target Config Infrastructure Exists (READY for use):**
- ✅ `TargetConfig` - Architecture, CPU, clock speed, zero-page, graphics chip, sound chip, memory regions
- ✅ `C64_CONFIG` - Fully defined C64 configuration (PAL/NTSC variants)
- ✅ Zero-page safe range: `$02-$8F` (142 bytes)
- ✅ Reserved ranges with human-readable reasons
- ✅ `validateTargetConfig()`, `isAddressSafe()`, `doesAllocationFit()` utilities

**Codegen Infrastructure DOES NOT Exist:**
- ❌ No `CodeGenerator` class
- ❌ No assembly writer
- ❌ No ACME integration
- ❌ No BASIC stub generation
- ❌ No .prg binary generation

**Implication:** This plan is valid - we need to create the entire codegen subsystem from scratch, but we have excellent IL infrastructure to consume.

---

## Overview

The Code Generation Stub provides a minimal, working code generator that transforms IL (Intermediate Language) into 6502 assembly and executable .prg files. This is a **stub implementation** designed to:

1. Complete the end-to-end compilation pipeline
2. Produce runnable (if minimal) output
3. Establish the codegen architecture for future expansion
4. Enable CLI and testing development

Full code generation (instruction selection, register allocation, etc.) will be implemented in future phases.

---

## Goals

1. **Working Output**: Generate executable .prg files
2. **ACME Compatible**: Output assembly compatible with ACME assembler
3. **Minimal Implementation**: Focus on structure, not completeness
4. **Extensible Architecture**: Easy to add real instruction selection later
5. **Debug-Friendly**: Support basic source mapping

---

## Stub Behavior (Critical Design Decision)

**Question:** Should the stub use IL data or emit static "hello world"?

**Answer: USE IL DATA** - The stub should traverse the IL and generate meaningful (if incomplete) code.

### Why Use IL Data

1. **Validates Integration**: Proves IL→Codegen interface works correctly
2. **Incremental Progress**: Each IL instruction type we handle is real progress
3. **Real Testing**: E2E tests exercise actual compilation, not fake output
4. **Architecture Foundation**: Establishes patterns for full codegen later

### Stub Translation Strategy

The stub handles IL in three tiers:

**Tier 1: Fully Translated (Stub Phase)**
- `ILGlobalVariable` → Assembly data/ZP allocation based on `storageClass`
- `ILHardwareWrite` → Direct `STA $address` (for @map variables like `borderColor = 5`)
- `ILHardwareRead` → Direct `LDA $address`
- `ILConstInstruction` → `LDA #value` / `LDX #value`
- `ILReturnVoid` → `RTS`
- `ILJump` → `JMP label`
- Function structure → Entry label + `RTS`

**Tier 2: Simplified Translation (Stub Phase)**
- `ILBinaryInstruction` (ADD/SUB) → Comment showing intended operation + placeholder NOP
- `ILBranchInstruction` → Comment showing condition + unconditional JMP to then-block
- `ILCallInstruction` → `JSR function_label` (call ABI not implemented)
- `ILLoadVar` / `ILStoreVar` → `LDA`/`STA` to address (no register optimization)

**Tier 3: Placeholder Only (Future Phases)**
- Complex expressions → Comment with IL + `LDA #$00` placeholder
- Arrays/pointers → Comment with IL + placeholder
- SSA Phi nodes → Comment with IL + placeholder

### Example Stub Output

Given this Blend65 source:
```js
@map borderColor at $D020: byte;

export function main(): void {
  borderColor = 5;
}
```

The stub generates:
```asm
; Blend65 Stub Output
* = $0801

; BASIC stub (10 SYS 2064)
!byte $0b, $08, $0a, $00, $9e, $32, $30, $36, $34, $00, $00, $00

* = $0810

_main:
  ; borderColor = 5
  LDA #$05
  STA $D020
  RTS

; End of program
```

This is **real, working code** that runs in VICE - not a placeholder.

---

## ACME Assembler Requirement

### ACME is REQUIRED for .prg Output

**Decision:** ACME is a mandatory external dependency for binary output.

**Rationale:**
1. **Production-Quality**: ACME is battle-tested, handles all 6502 edge cases
2. **Label Resolution**: Complex label arithmetic, forward references handled correctly
3. **Error Messages**: Helpful assembly-level error reporting
4. **No Wheel Reinvention**: Building our own assembler is months of work

### Fallback for Development

The built-in `BinaryWriter` is provided ONLY for:
- Very simple test cases (BASIC stub + raw bytes)
- Development when ACME isn't installed
- NOT for production use

### Installation Requirements

```bash
# macOS
brew install acme

# Ubuntu/Debian
sudo apt install acme

# Windows
# Download from https://sourceforge.net/projects/acme-crossass/
```

### ACME Not Found Error

When ACME is not found, the compiler will:
1. ✅ Generate `.asm` file (always works)
2. ❌ Skip `.prg` generation
3. ⚠️ Warn: "ACME not found. Install ACME for binary output. Assembly file generated at output.asm"

This allows developers to use the compiler even without ACME installed.

---

## Stub vs Full Implementation

### What the Stub DOES

- ✅ Accepts IL module as input
- ✅ Outputs ACME-compatible assembly text
- ✅ Generates working .prg binary (via ACME or minimal built-in)
- ✅ Creates BASIC stub for autostart
- ✅ Supports basic source location comments
- ✅ Handles simple variable declarations
- ✅ Generates function entry/exit code

### What the Stub DOES NOT (Future Work)

- ❌ Full instruction selection
- ❌ Register allocation optimization
- ❌ Complex expression compilation
- ❌ Control flow code generation
- ❌ Array/pointer operations
- ❌ Function call ABI
- ❌ Interrupt handling

---

## Architecture

### Codegen Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Code Generation Pipeline                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  ILModule   │────▶│  Codegen    │────▶│  Assembly   │────▶│  Assembler  │
│             │     │  Pass       │     │  Text       │     │  (ACME)     │
│ - functions │     │             │     │             │     │             │
│ - globals   │     │ IL → ASM    │     │ .asm file   │     │ ASM → PRG   │
│ - data      │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                    │
                                                                    ▼
                                                            ┌─────────────┐
                                                            │   Output    │
                                                            │             │
                                                            │ .prg binary │
                                                            │ .labels     │
                                                            │ .asm source │
                                                            └─────────────┘
```

### File Structure

```
packages/compiler/src/codegen/
├── index.ts              # Public exports
├── types.ts              # CodegenOptions, CodegenResult
├── code-generator.ts     # Main CodeGenerator class
├── assembly-writer.ts    # Assembly text generation
├── binary-writer.ts      # Direct .prg generation (fallback)
├── acme-invoker.ts       # ACME assembler integration
├── basic-stub.ts         # BASIC autostart generation
├── label-generator.ts    # Label naming and management
└── source-mapper.ts      # Source location tracking
```

---

## API Design

### Types

```typescript
// codegen/types.ts

import type { TargetConfig } from '../target/config.js';
import type { ILModule } from '../il/module.js';
import type { SourceLocation } from '../ast/base.js';

/**
 * Code generation options
 */
export interface CodegenOptions {
  /** Target hardware configuration */
  target: TargetConfig;
  
  /**
   * Output format
   * - "asm": Assembly source only
   * - "prg": C64 executable (.prg)
   * - "crt": Cartridge image (for cartridge-based programs) - NOT IMPLEMENTED YET
   * - "both": Assembly + PRG
   */
  format: 'asm' | 'prg' | 'crt' | 'both';
  
  /** Generate source map information */
  sourceMap: boolean;
  
  /** Debug mode for assembly comments */
  debug: 'none' | 'inline' | 'vice' | 'both';
  
  /** Program load address (default: $0801) */
  loadAddress?: number;
  
  /** Generate BASIC stub for autostart */
  basicStub?: boolean;
  
  /** Path to ACME assembler (if not using built-in) */
  acmePath?: string;
}

/**
 * Source map entry
 */
export interface SourceMapEntry {
  /** Generated assembly address */
  address: number;
  
  /** Original source location */
  source: SourceLocation;
  
  /** Optional label at this address */
  label?: string;
}

/**
 * Code generation result
 */
export interface CodegenResult {
  /** Generated assembly text */
  assembly: string;
  
  /** Binary .prg data (if format includes 'prg') */
  binary?: Uint8Array;
  
  /** Source map entries */
  sourceMap?: SourceMapEntry[];
  
  /** VICE label file content */
  viceLabels?: string;
  
  /** Warnings during generation */
  warnings: string[];
  
  /** Statistics */
  stats: {
    /** Total code bytes */
    codeSize: number;
    /** Total data bytes */
    dataSize: number;
    /** Zero-page bytes used */
    zpBytesUsed: number;
    /** Number of functions generated */
    functionCount: number;
  };
}

/**
 * Default code generation options
 */
export function getDefaultCodegenOptions(target: TargetConfig): CodegenOptions {
  return {
    target,
    format: 'prg',
    sourceMap: false,
    debug: 'none',
    loadAddress: 0x0801,
    basicStub: true,
  };
}
```

### Main CodeGenerator Class

```typescript
// codegen/code-generator.ts

import type { ILModule } from '../il/module.js';
import type { CodegenOptions, CodegenResult } from './types.js';

/**
 * Code generator for 6502 targets
 * 
 * Transforms IL (Intermediate Language) into 6502 assembly code
 * and optionally assembles to binary .prg format.
 * 
 * **STUB IMPLEMENTATION**
 * 
 * This is a minimal implementation that generates basic working code.
 * Full instruction selection and optimization will be added in future phases.
 * 
 * @example
 * ```typescript
 * const codegen = new CodeGenerator();
 * const result = codegen.generate(ilModule, {
 *   target: getTargetConfig(TargetArchitecture.C64),
 *   format: 'both',
 *   debug: 'inline',
 * });
 * 
 * // Write outputs
 * writeFileSync('game.asm', result.assembly);
 * writeFileSync('game.prg', result.binary);
 * ```
 */
export class CodeGenerator {
  protected assemblyWriter: AssemblyWriter;
  protected labelGenerator: LabelGenerator;
  protected sourceMapper: SourceMapper;
  
  constructor() {
    this.assemblyWriter = new AssemblyWriter();
    this.labelGenerator = new LabelGenerator();
    this.sourceMapper = new SourceMapper();
  }
  
  /**
   * Generate code from IL module
   */
  generate(module: ILModule, options: CodegenOptions): CodegenResult {
    const warnings: string[] = [];
    
    // Reset state
    this.assemblyWriter.reset();
    this.labelGenerator.reset();
    this.sourceMapper.reset();
    
    // Generate assembly
    this.generateHeader(module, options);
    this.generateBasicStub(options);
    this.generateData(module, options);
    this.generateCode(module, options);
    this.generateFooter(module, options);
    
    // Get assembly text
    const assembly = this.assemblyWriter.toString();
    
    // Early validation for unsupported formats
    if (options.format === 'crt') {
      warnings.push("CRT (cartridge) output format is not implemented yet. Generating .asm only.");
    }
    
    // Assemble to binary if requested
    let binary: Uint8Array | undefined;
    if (options.format === 'prg' || options.format === 'both') {
      binary = this.assemble(assembly, options);
    }
    // Note: 'crt' format will be handled in future phases
    
    // Generate VICE labels if requested
    let viceLabels: string | undefined;
    if (options.debug === 'vice' || options.debug === 'both') {
      viceLabels = this.generateViceLabels();
    }
    
    return {
      assembly,
      binary,
      sourceMap: options.sourceMap ? this.sourceMapper.getEntries() : undefined,
      viceLabels,
      warnings,
      stats: this.calculateStats(module),
    };
  }
  
  // ... implementation methods
}
```

---

## Assembly Output Format

### Generated Assembly Structure

```asm
; ===========================================================================
; Blend65 Compiler Output
; Generated: 2026-01-23T10:00:00.000Z
; Target: c64 (PAL)
; ===========================================================================

; ---------------------------------------------------------------------------
; Configuration
; ---------------------------------------------------------------------------
* = $0801                      ; Load address

; ---------------------------------------------------------------------------
; BASIC Stub (10 SYS 2064)
; ---------------------------------------------------------------------------
!byte $0b, $08                 ; Next line pointer
!byte $0a, $00                 ; Line number 10
!byte $9e                      ; SYS token
!byte $32, $30, $36, $34       ; "2064"
!byte $00                      ; End of line
!byte $00, $00                 ; End of program

; ---------------------------------------------------------------------------
; Program Entry Point
; ---------------------------------------------------------------------------
* = $0810                      ; Code start (2064 decimal)

main:
; FILE:main.blend LINE:5 COL:1
  JSR _init_globals
  JSR _main
  RTS

; ---------------------------------------------------------------------------
; Initialization
; ---------------------------------------------------------------------------
_init_globals:
  ; Zero-page variables
  LDA #$00
  STA $02                      ; counter
  STA $03                      ; flags
  RTS

; ---------------------------------------------------------------------------
; User Functions
; ---------------------------------------------------------------------------

; FILE:main.blend LINE:10 COL:1
; function main(): void
_main:
  ; Function prologue
  
  ; Function body (STUB)
  LDA #$00
  STA $D020                    ; borderColor = 0
  STA $D021                    ; backgroundColor = 0
  
  ; Function epilogue
  RTS

; ---------------------------------------------------------------------------
; Data Section
; ---------------------------------------------------------------------------
.data:

; Global variables (non-ZP)
_score:       !word $0000
_highScore:   !word $0000
_gameTitle:   !text "BLEND65 GAME", $00

; ---------------------------------------------------------------------------
; End of Program
; ---------------------------------------------------------------------------
```

### Source Location Comments

```asm
; Inline debug mode (-d inline)

; FILE:game.blend LINE:42 COL:5
  LDA _playerX
; FILE:game.blend LINE:43 COL:5
  CLC
  ADC #$01
; FILE:game.blend LINE:44 COL:5
  STA _playerX
```

---

## BASIC Stub Generation

### Standard BASIC Stub

```typescript
// codegen/basic-stub.ts

/**
 * Generate BASIC stub for C64 autostart
 * 
 * Creates: 10 SYS <address>
 * 
 * The BASIC stub allows the .prg to be loaded and run automatically
 * with LOAD"*",8,1 followed by RUN.
 */
export function generateBasicStub(sysAddress: number): Uint8Array {
  // BASIC line format:
  // [next line ptr:2] [line num:2] [tokens...] [0] [0,0 for end]
  
  const sysString = sysAddress.toString();
  const bytes: number[] = [];
  
  // Next line pointer (will be calculated)
  bytes.push(0x00, 0x00);  // Placeholder
  
  // Line number: 10
  bytes.push(0x0a, 0x00);
  
  // SYS token
  bytes.push(0x9e);
  
  // Address as ASCII digits
  for (const char of sysString) {
    bytes.push(char.charCodeAt(0));
  }
  
  // End of line
  bytes.push(0x00);
  
  // End of BASIC program
  bytes.push(0x00, 0x00);
  
  // Calculate next line pointer
  const nextLine = 0x0801 + bytes.length;
  bytes[0] = nextLine & 0xff;
  bytes[1] = (nextLine >> 8) & 0xff;
  
  return new Uint8Array(bytes);
}
```

---

## ACME Integration

### ACME Invoker

```typescript
// codegen/acme-invoker.ts

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Options for ACME assembler
 */
export interface AcmeOptions {
  /** Path to ACME executable */
  acmePath?: string;
  
  /** Output format */
  format: 'prg' | 'bin';
  
  /** Generate label file */
  labels?: boolean;
  
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Invoke ACME assembler to assemble source
 */
export async function invokeAcme(
  source: string,
  options: AcmeOptions
): Promise<{ binary: Uint8Array; labels?: string }> {
  const acme = options.acmePath || findAcme();
  
  if (!acme) {
    throw new Error(
      'ACME assembler not found. Install ACME or specify path with --acme-path'
    );
  }
  
  // Write source to temp file
  const tempDir = tmpdir();
  const sourceFile = join(tempDir, `blend65_${Date.now()}.asm`);
  const outputFile = join(tempDir, `blend65_${Date.now()}.prg`);
  const labelFile = join(tempDir, `blend65_${Date.now()}.labels`);
  
  try {
    writeFileSync(sourceFile, source);
    
    // Build ACME arguments
    const args = [
      '-f', 'cbm',           // CBM format (.prg with load address)
      '-o', outputFile,
      sourceFile,
    ];
    
    if (options.labels) {
      args.push('-l', labelFile);
    }
    
    if (options.verbose) {
      args.push('-v');
    }
    
    // Run ACME
    await runCommand(acme, args);
    
    // Read outputs
    const binary = readFileSync(outputFile);
    const labels = options.labels ? readFileSync(labelFile, 'utf-8') : undefined;
    
    return {
      binary: new Uint8Array(binary),
      labels,
    };
  } finally {
    // Cleanup temp files
    tryUnlink(sourceFile);
    tryUnlink(outputFile);
    tryUnlink(labelFile);
  }
}

/**
 * Find ACME in PATH
 */
function findAcme(): string | null {
  const names = ['acme', 'acme.exe'];
  // ... search PATH for ACME
  return null;
}
```

### Fallback Binary Writer

```typescript
// codegen/binary-writer.ts

/**
 * Fallback binary writer for when ACME is not available
 * 
 * This is a MINIMAL implementation that only handles simple cases:
 * - Fixed load address
 * - BASIC stub
 * - Raw byte sequences
 * 
 * For full assembly support, ACME should be used.
 */
export class BinaryWriter {
  protected bytes: number[] = [];
  protected loadAddress: number = 0x0801;
  
  /**
   * Set load address
   */
  setLoadAddress(address: number): void {
    this.loadAddress = address;
  }
  
  /**
   * Write bytes at current position
   */
  write(data: Uint8Array | number[]): void {
    for (const b of data) {
      this.bytes.push(b & 0xff);
    }
  }
  
  /**
   * Get final .prg output
   */
  toUint8Array(): Uint8Array {
    // PRG format: 2-byte load address + data
    const result = new Uint8Array(2 + this.bytes.length);
    result[0] = this.loadAddress & 0xff;
    result[1] = (this.loadAddress >> 8) & 0xff;
    result.set(this.bytes, 2);
    return result;
  }
}
```

---

## Task Breakdown

### Task 2.1: Codegen Types
**File**: `packages/compiler/src/codegen/types.ts`

Define types for code generation.

```typescript
// Deliverables:
// - CodegenOptions interface
// - CodegenResult interface
// - SourceMapEntry interface
// - getDefaultCodegenOptions() function
```

**Acceptance Criteria:**
- [ ] All types defined with JSDoc
- [ ] Default options function
- [ ] Unit tests for defaults

---

### Task 2.2: Assembly Writer
**File**: `packages/compiler/src/codegen/assembly-writer.ts`

Implement assembly text generation.

```typescript
// Deliverables:
// - AssemblyWriter class
// - emit() methods for instructions, labels, data
// - Comment and section formatting
// - toString() for final output
```

**Acceptance Criteria:**
- [ ] Generates ACME-compatible syntax
- [ ] Supports labels, instructions, data
- [ ] Handles indentation and formatting
- [ ] Unit tests for output format

---

### Task 2.3: Label Generator
**File**: `packages/compiler/src/codegen/label-generator.ts`

Implement label naming and management.

```typescript
// Deliverables:
// - LabelGenerator class
// - Unique label generation
// - Function, variable, and temp labels
// - VICE-compatible label format
```

**Acceptance Criteria:**
- [ ] Generates unique labels
- [ ] Follows naming conventions
- [ ] No collisions
- [ ] Unit tests for uniqueness

---

### Task 2.4: BASIC Stub Generator
**File**: `packages/compiler/src/codegen/basic-stub.ts`

Implement BASIC autostart stub.

```typescript
// Deliverables:
// - generateBasicStub() function
// - Configurable SYS address
// - Correct BASIC token encoding
```

**Acceptance Criteria:**
- [ ] Generates valid BASIC program
- [ ] Works with VICE
- [ ] Configurable address
- [ ] Unit tests for byte output

---

### Task 2.5: Source Mapper
**File**: `packages/compiler/src/codegen/source-mapper.ts`

Implement source location tracking.

```typescript
// Deliverables:
// - SourceMapper class
// - Track source locations during generation
// - Generate inline comments
// - Generate VICE label format
```

**Acceptance Criteria:**
- [ ] Tracks source → assembly mapping
- [ ] Generates inline comments
- [ ] Generates VICE labels
- [ ] Unit tests for mapping

---

### Task 2.6: ACME Invoker
**File**: `packages/compiler/src/codegen/acme-invoker.ts`

Implement ACME assembler integration.

```typescript
// Deliverables:
// - invokeAcme() async function
// - ACME detection in PATH
// - Temp file management
// - Error handling
```

**Acceptance Criteria:**
- [ ] Invokes ACME correctly
- [ ] Handles ACME errors
- [ ] Cleans up temp files
- [ ] Works on macOS/Linux/Windows

---

### Task 2.7: Code Generator Class
**File**: `packages/compiler/src/codegen/code-generator.ts`

Implement main CodeGenerator class.

```typescript
// Deliverables:
// - CodeGenerator class
// - generate() method
// - Stub code generation for IL
// - Integration with all helper classes
```

**Acceptance Criteria:**
- [ ] Generates working .asm output
- [ ] Produces runnable .prg (with ACME)
- [ ] Handles all options
- [ ] Integration tests pass

---

### Task 2.8: Integration & Tests
**Files**: `packages/compiler/src/codegen/index.ts`, `packages/compiler/src/__tests__/codegen/`

Export public API and create tests.

```typescript
// Deliverables:
// - Export CodeGenerator
// - Export types
// - Integration tests
// - E2E test with VICE
```

**Acceptance Criteria:**
- [ ] Clean public API
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Generated .prg runs in VICE

---

## Test Plan

### Unit Tests

| Test Suite | Coverage |
|------------|----------|
| types.test.ts | Type definitions |
| assembly-writer.test.ts | Assembly output format |
| label-generator.test.ts | Label uniqueness |
| basic-stub.test.ts | BASIC stub bytes |
| source-mapper.test.ts | Source mapping |
| code-generator.test.ts | Full generation |

### Integration Tests

| Test Case | Description |
|-----------|-------------|
| Minimal program | Empty main() generates valid .prg |
| Variables | Variable declarations compile |
| Functions | Function definitions compile |
| BASIC stub | Program autoruns in VICE |
| Source comments | Debug info in assembly |
| VICE labels | Label file loads in VICE |

### E2E Tests (with VICE)

| Test Case | Description |
|-----------|-------------|
| Border color | Program sets border color |
| Memory write | Variable stores work |
| Function call | Function calls work |

---

## Task Checklist

| Task | Description | Status |
|------|-------------|--------|
| 2.1 | Codegen Types | [ ] |
| 2.2 | Assembly Writer | [ ] |
| 2.3 | Label Generator | [ ] |
| 2.4 | BASIC Stub Generator | [ ] |
| 2.5 | Source Mapper | [ ] |
| 2.6 | ACME Invoker | [ ] |
| 2.7 | Code Generator Class | [ ] |
| 2.8 | Integration & Tests | [ ] |

---

## Dependencies

### External Dependencies

```json
{
  "devDependencies": {
    "@types/node": "^20.x"     // For child_process, fs
  }
}
```

### Runtime Dependencies

- **ACME Assembler**: Required for assembly → binary
  - macOS: `brew install acme`
  - Linux: `apt install acme`
  - Windows: Download from ACME site

### Internal Dependencies

- Phase 1: Compiler Entry Point (uses CodeGenerator)
- IL Module definitions

---

## Future Expansion

### Full Code Generator (Future Phases)

1. **Instruction Selection**: IL op → 6502 instructions
2. **Register Allocation**: A, X, Y allocation
3. **Addressing Modes**: Zero-page, absolute, indexed
4. **Control Flow**: Branches, loops, conditionals
5. **Function Calls**: Stack frame, parameter passing
6. **Optimizations**: Peephole, dead code elimination

### Integration Points

- Optimizer peephole patterns (Phase 7+)
- Advanced register allocation (Phase 8+)
- Self-modifying code support (Phase 10+)

---

**This document defines the code generation stub for Blend65.**