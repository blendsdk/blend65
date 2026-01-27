# Task 9.8a: Target Emitter Interface Design

> **Session**: 4.8a
> **Phase**: 09-target-specific
> **Est. Time**: 45 min
> **Tests**: ~25 unit tests
> **Prerequisites**: Task 9.3b2 complete (NOP slides)

---

## Overview

This document defines the target emitter interface that abstracts code generation for different output formats (ACME assembly, native binary). All optimization happens at IL level; target emitters are thin translators.

---

## 1. Target Architecture

### 1.1 Two-Target Strategy

```
IL Optimization Pipeline:
┌─────────────────────────────────────────────────────────────┐
│ Blend65 Source → Lexer → Parser → AST → IL Generator        │
│                                          ↓                  │
│                          🔥 IL OPTIMIZATION PIPELINE 🔥      │
│                          (All heavy optimization here)       │
│                                          ↓                  │
│                 ┌────────────────────────┴──────────────┐   │
│                 ↓                                       ↓   │
│        ACME Target (.asm)                    Native Target  │
│        ~500 LOC                              ~1500 LOC      │
│        Libraries, debugging                  Production     │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Target Responsibilities

| Target | Output     | Use Case                    | Complexity |
| ------ | ---------- | --------------------------- | ---------- |
| ACME   | .asm text  | Libraries, integration, debug | ~500 LOC   |
| Native | .prg binary | Production builds, speed    | ~1500 LOC  |

---

## 2. Directory Structure

```
packages/compiler/src/target/
├── interface/
│   ├── target-emitter.ts      # Base interface
│   ├── emit-context.ts        # Emission context
│   └── target-config.ts       # Configuration types
├── acme/
│   ├── acme-emitter.ts        # ACME implementation
│   ├── acme-formatter.ts      # Assembly formatting
│   └── index.ts
├── native/
│   ├── native-emitter.ts      # Binary implementation
│   ├── binary-writer.ts       # Binary output
│   ├── relocation.ts          # Address relocation
│   └── index.ts
└── index.ts                   # Public exports
```

---

## 3. Type Definitions

```typescript
// packages/compiler/src/target/interface/types.ts

/**
 * Supported target output formats
 */
export enum TargetFormat {
  ACME = 'acme',       // ACME assembler text output
  NATIVE = 'native',   // Direct binary output (.prg)
}

/**
 * Target platform (affects timing, memory layout)
 */
export enum TargetPlatform {
  C64_PAL = 'c64_pal',
  C64_NTSC = 'c64_ntsc',
}

/**
 * Output configuration
 */
export interface TargetConfig {
  readonly format: TargetFormat;
  readonly platform: TargetPlatform;
  readonly startAddress: number;         // Default $0801 for BASIC start
  readonly outputPath: string;
  readonly includeBasicStub: boolean;    // Add BASIC SYS line
  readonly generateSourceMap: boolean;
  readonly optimizationLevel: OptimizationLevel;
}

export enum OptimizationLevel {
  NONE = 0,       // Debug builds
  BASIC = 1,      // Simple optimizations
  STANDARD = 2,   // Default
  AGGRESSIVE = 3, // Maximum optimization
}

/**
 * Emitted code section
 */
export interface CodeSection {
  readonly name: string;
  readonly startAddress: number;
  readonly data: Uint8Array;
  readonly sourceMap?: SourceMapEntry[];
}

/**
 * Source map entry for debugging
 */
export interface SourceMapEntry {
  readonly address: number;
  readonly sourceLine: number;
  readonly sourceColumn: number;
  readonly sourceFile: string;
}

/**
 * Emission result
 */
export interface EmitResult {
  readonly success: boolean;
  readonly sections: CodeSection[];
  readonly totalSize: number;
  readonly errors: EmitError[];
  readonly warnings: EmitWarning[];
  readonly statistics: EmitStatistics;
}

/**
 * Emission error
 */
export interface EmitError {
  readonly code: string;
  readonly message: string;
  readonly location?: SourceLocation;
}

/**
 * Emission warning
 */
export interface EmitWarning {
  readonly code: string;
  readonly message: string;
  readonly location?: SourceLocation;
}

/**
 * Emission statistics
 */
export interface EmitStatistics {
  readonly codeBytes: number;
  readonly dataBytes: number;
  readonly totalBytes: number;
  readonly instructionCount: number;
  readonly emitTimeMs: number;
}

/**
 * Source location
 */
export interface SourceLocation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}
```

---

## 4. Target Emitter Interface

```typescript
// packages/compiler/src/target/interface/target-emitter.ts

import {
  TargetConfig,
  EmitResult,
  CodeSection,
  EmitStatistics,
} from './types.js';
import { ILProgram, ILFunction, ILInstruction } from '../../il/types.js';
import { BasicBlock, CFG } from '../../il/cfg.js';

/**
 * Target Emitter Interface
 *
 * Abstract base class for all target emitters.
 * Defines the contract for converting optimized IL to target output.
 */
export abstract class TargetEmitter {
  protected readonly config: TargetConfig;
  protected currentAddress: number;
  protected sections: CodeSection[] = [];
  protected errors: EmitError[] = [];
  protected warnings: EmitWarning[] = [];

  constructor(config: TargetConfig) {
    this.config = config;
    this.currentAddress = config.startAddress;
  }

  /**
   * Emit a complete IL program
   */
  public abstract emit(program: ILProgram): EmitResult;

  /**
   * Emit a single function
   */
  public abstract emitFunction(func: ILFunction): void;

  /**
   * Emit a basic block
   */
  public abstract emitBlock(block: BasicBlock): void;

  /**
   * Emit a single IL instruction
   */
  public abstract emitInstruction(instr: ILInstruction): void;

  /**
   * Write output to file/buffer
   */
  public abstract writeOutput(): Uint8Array | string;

  /**
   * Get target-specific instruction encoding
   */
  protected abstract getInstructionBytes(instr: ILInstruction): Uint8Array;

  /**
   * Get instruction size in bytes
   */
  protected abstract getInstructionSize(instr: ILInstruction): number;

  /**
   * Check if target supports a feature
   */
  public abstract supportsFeature(feature: string): boolean;

  /**
   * Get target-specific configuration
   */
  public getConfig(): TargetConfig {
    return this.config;
  }

  /**
   * Get current emission address
   */
  public getCurrentAddress(): number {
    return this.currentAddress;
  }

  /**
   * Advance address by given bytes
   */
  protected advanceAddress(bytes: number): void {
    this.currentAddress += bytes;
  }

  /**
   * Add an error
   */
  protected addError(code: string, message: string, location?: SourceLocation): void {
    this.errors.push({ code, message, location });
  }

  /**
   * Add a warning
   */
  protected addWarning(code: string, message: string, location?: SourceLocation): void {
    this.warnings.push({ code, message, location });
  }

  /**
   * Create emit result
   */
  protected createResult(startTime: number): EmitResult {
    const endTime = Date.now();
    const statistics = this.calculateStatistics(endTime - startTime);

    return {
      success: this.errors.length === 0,
      sections: this.sections,
      totalSize: statistics.totalBytes,
      errors: this.errors,
      warnings: this.warnings,
      statistics,
    };
  }

  /**
   * Calculate emission statistics
   */
  protected calculateStatistics(emitTimeMs: number): EmitStatistics {
    let codeBytes = 0;
    let dataBytes = 0;
    let instructionCount = 0;

    for (const section of this.sections) {
      if (section.name.startsWith('code')) {
        codeBytes += section.data.length;
      } else {
        dataBytes += section.data.length;
      }
    }

    return {
      codeBytes,
      dataBytes,
      totalBytes: codeBytes + dataBytes,
      instructionCount,
      emitTimeMs,
    };
  }
}
```

---

## 5. Emit Context

```typescript
// packages/compiler/src/target/interface/emit-context.ts

import { TargetConfig, SourceMapEntry } from './types.js';
import { ILFunction, ILInstruction } from '../../il/types.js';
import { BasicBlock } from '../../il/cfg.js';

/**
 * Label reference for resolution
 */
export interface LabelRef {
  readonly name: string;
  readonly address: number | null;
  readonly references: number[]; // Addresses that reference this label
}

/**
 * Emit Context
 *
 * Tracks state during code emission including labels,
 * current position, and source mapping.
 */
export class EmitContext {
  protected readonly config: TargetConfig;
  protected address: number;
  protected labels: Map<string, LabelRef> = new Map();
  protected sourceMap: SourceMapEntry[] = [];
  protected currentFunction: ILFunction | null = null;
  protected currentBlock: BasicBlock | null = null;

  constructor(config: TargetConfig) {
    this.config = config;
    this.address = config.startAddress;
  }

  /**
   * Get current emission address
   */
  public getAddress(): number {
    return this.address;
  }

  /**
   * Set current address
   */
  public setAddress(address: number): void {
    this.address = address;
  }

  /**
   * Advance address by bytes
   */
  public advance(bytes: number): void {
    this.address += bytes;
  }

  /**
   * Define a label at current address
   */
  public defineLabel(name: string): void {
    const existing = this.labels.get(name);
    if (existing) {
      // Update existing label with address
      this.labels.set(name, {
        ...existing,
        address: this.address,
      });
    } else {
      this.labels.set(name, {
        name,
        address: this.address,
        references: [],
      });
    }
  }

  /**
   * Reference a label (may be forward reference)
   */
  public referenceLabel(name: string): number | null {
    const label = this.labels.get(name);
    if (label) {
      label.references.push(this.address);
      return label.address;
    }

    // Forward reference
    this.labels.set(name, {
      name,
      address: null,
      references: [this.address],
    });
    return null;
  }

  /**
   * Get label address (or null if forward ref)
   */
  public getLabelAddress(name: string): number | null {
    return this.labels.get(name)?.address ?? null;
  }

  /**
   * Get all unresolved labels
   */
  public getUnresolvedLabels(): string[] {
    return Array.from(this.labels.entries())
      .filter(([_, ref]) => ref.address === null)
      .map(([name, _]) => name);
  }

  /**
   * Enter a function context
   */
  public enterFunction(func: ILFunction): void {
    this.currentFunction = func;
    this.defineLabel(func.name);
  }

  /**
   * Exit function context
   */
  public exitFunction(): void {
    this.currentFunction = null;
  }

  /**
   * Enter a block context
   */
  public enterBlock(block: BasicBlock): void {
    this.currentBlock = block;
    if (block.label) {
      this.defineLabel(block.label);
    }
  }

  /**
   * Exit block context
   */
  public exitBlock(): void {
    this.currentBlock = null;
  }

  /**
   * Add source map entry
   */
  public addSourceMapping(
    sourceLine: number,
    sourceColumn: number,
    sourceFile: string
  ): void {
    if (this.config.generateSourceMap) {
      this.sourceMap.push({
        address: this.address,
        sourceLine,
        sourceColumn,
        sourceFile,
      });
    }
  }

  /**
   * Get source map
   */
  public getSourceMap(): SourceMapEntry[] {
    return this.sourceMap;
  }

  /**
   * Get all labels
   */
  public getLabels(): Map<string, LabelRef> {
    return this.labels;
  }
}
```

---

## 6. Target Registry

```typescript
// packages/compiler/src/target/interface/target-registry.ts

import { TargetEmitter } from './target-emitter.js';
import { TargetFormat, TargetConfig } from './types.js';

/**
 * Target factory function type
 */
export type TargetFactory = (config: TargetConfig) => TargetEmitter;

/**
 * Target Registry
 *
 * Manages available target emitters and creates instances.
 */
export class TargetRegistry {
  protected static targets: Map<TargetFormat, TargetFactory> = new Map();

  /**
   * Register a target emitter
   */
  public static register(format: TargetFormat, factory: TargetFactory): void {
    this.targets.set(format, factory);
  }

  /**
   * Create a target emitter
   */
  public static create(config: TargetConfig): TargetEmitter {
    const factory = this.targets.get(config.format);
    if (!factory) {
      throw new Error(`Unknown target format: ${config.format}`);
    }
    return factory(config);
  }

  /**
   * Check if target is registered
   */
  public static hasTarget(format: TargetFormat): boolean {
    return this.targets.has(format);
  }

  /**
   * Get all registered targets
   */
  public static getTargets(): TargetFormat[] {
    return Array.from(this.targets.keys());
  }
}

// Register built-in targets
import { ACMEEmitter } from '../acme/acme-emitter.js';
import { NativeEmitter } from '../native/native-emitter.js';

TargetRegistry.register(TargetFormat.ACME, (config) => new ACMEEmitter(config));
TargetRegistry.register(TargetFormat.NATIVE, (config) => new NativeEmitter(config));
```

---

## 7. Blend65 Usage

```js
// Using target emitters in Blend65 build process

// Compiler configuration in blend.config.js
export default {
    target: 'acme',      // or 'native'
    platform: 'c64_pal',
    startAddress: $0801,
    includeBasicStub: true,
    output: './build/game.asm', // or game.prg
    optimizationLevel: 2,
    sourceMap: true,
};

// Programmatic usage
import { Compiler, TargetFormat, TargetRegistry } from 'blend65';

const compiler = new Compiler({
    target: TargetFormat.ACME,
    startAddress: 0x0801,
});

const result = compiler.compile('game.blend');

if (result.success) {
    console.log(`Compiled to ${result.statistics.totalBytes} bytes`);
    console.log(`Code: ${result.statistics.codeBytes} bytes`);
    console.log(`Data: ${result.statistics.dataBytes} bytes`);
}
```

---

## 8. Test Requirements

| Category         | Test Cases | Coverage Target |
| ---------------- | ---------- | --------------- |
| Interface impl   | 5          | 100%            |
| Config handling  | 4          | 100%            |
| Context tracking | 5          | 100%            |
| Label resolution | 4          | 100%            |
| Registry         | 4          | 100%            |
| Error handling   | 3          | 100%            |
| **Total**        | **25**     | **100%**        |

---

## 9. Task Checklist

- [ ] Create type definitions for target interface
- [ ] Implement TargetEmitter base class
- [ ] Implement EmitContext class
- [ ] Implement TargetRegistry
- [ ] Create unit tests for all components
- [ ] Document target interface API
- [ ] Integrate with existing compiler pipeline

---

**Next Document**: `09-08b-target-features.md` (Session 4.8b: Platform feature flags & detection)