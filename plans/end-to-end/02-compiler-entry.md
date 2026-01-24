# Phase 1: Compiler Entry Point

> **Status**: ✅ Complete  
> **Phase**: 1  
> **Priority**: HIGH  
> **Dependencies**: Phase 0 (Config System)  
> **Estimated Tasks**: 7

---

## Overview

The Compiler Entry Point is a unified `Compiler` class that orchestrates the entire compilation pipeline. It provides a clean API for:

- Single-file compilation
- Multi-file project compilation
- Pipeline orchestration (Lexer → Parser → Semantic → IL → Optimizer → Codegen)
- Error aggregation and reporting
- Configuration-driven compilation

---

## Goals

1. **Unified API**: Single class for all compilation scenarios
2. **Multi-file Support**: Leverage existing `SemanticAnalyzer.analyzeMultiple()`
3. **Pipeline Orchestration**: Coordinate all compiler phases
4. **Error Handling**: Aggregate and report errors from all phases
5. **Extensibility**: Easy to add new phases (e.g., full optimizer, new targets)
6. **Configuration-Driven**: All behavior controlled by configuration passed in

---

## Codebase Analysis (Validated)

**Finding:** A unified `Compiler` class does **NOT currently exist** in the codebase.

The following components exist independently:
- `Lexer` for tokenization
- `Parser` for AST generation
- `SemanticAnalyzer` with `analyzeMultiple()` for multi-module analysis
- `ILGenerator` for intermediate language generation
- `Optimizer` (O0 stub) for optimization passes

**This plan is validated**: We need to create the `Compiler` class to orchestrate these existing components into a unified compilation pipeline.

---

## Configuration Integration

The `Compiler` class receives configuration from outside (CLI, config file) and does not load configuration itself. This keeps the Compiler decoupled and testable.

### Configuration Flow

```
CLI Arguments  →  Config Loader  →  Merged Config  →  Compiler Class
     ↓                ↓                    ↓
  -t c64         blend65.json        Blend65Config  →  affects behavior
  -O2            {target: "c64"}     
  -d both
```

### How Configuration Affects Each Phase

| Config Option | Affects Phase | Behavior Change |
|---------------|---------------|-----------------|
| `target: 'c64'` | IL Gen, Codegen | Different memory maps, hardware registers (see note below) |
| `optimization: 'O2'` | Optimize | Which optimizer passes run |
| `debug: 'both'` | Codegen | Inline comments + VICE labels |
| `outputFormat: 'prg'` | Codegen | What files to generate |
| `loadAddress: 0x0801` | Codegen | Where to load program |
| `strict: true` | All | Treat warnings as errors |
| `verbose: true` | All | Extra logging during compilation |

### Design Principle

The `Compiler` class is **config-agnostic about loading**:
- It receives a pre-merged `Blend65Config` object
- It doesn't know about CLI flags or `blend65.json`
- This makes it easy to test (pass mock configs)
- CLI (Phase 4) handles config loading and merging

### Target Implementation Note

**Currently only the C64 target is implemented.** Non-C64 targets (`c128`, `x16`) will generate a "not implemented yet" error early in compilation.

```typescript
// Early validation in Compiler.compile()
if (config.compilerOptions.target !== 'c64' && config.compilerOptions.target !== undefined) {
  return {
    success: false,
    diagnostics: [{
      severity: 'error',
      message: `Target '${config.compilerOptions.target}' is not implemented yet. Currently only 'c64' is supported.`,
      location: { source: 'config', start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
    }],
    // ... rest of result
  };
}
```

### Entry Point Detection

The compiler **automatically detects** the program entry point - no configuration required.

**Entry Point Convention:**
- The compiler looks for `export function main(): void` in the source files
- This function becomes the program's entry point
- Validation occurs during the semantic analysis phase
- If no `main` function is found, a semantic error is reported

```typescript
// Example: Valid entry point
export function main(): void {
  // Program starts here
}
```

**Error Cases:**
- No `export function main(): void` found → Error: "No entry point found. Define 'export function main(): void'."
- Multiple `main` functions exported → Error: "Multiple entry points found."
- `main` function not exported → Error: "Entry point 'main' must be exported."
- `main` function with parameters → Error: "Entry point 'main' must not have parameters."
- `main` function returns non-void → Error: "Entry point 'main' must return void."

---

## Error Recovery Strategy

**Strategy:** TypeScript-like diagnostic collection.

All files are processed regardless of errors in individual files. Diagnostics are aggregated and reported together. This allows developers to see all errors at once rather than fixing them one at a time.

### Existing Behavior (Verified)

The `SemanticAnalyzer.analyzeMultiple()` method already implements this pattern:

```typescript
// All modules are processed in dependency order
for (const moduleName of compilationOrder) {
  // Reset state for this module
  // Analyze this module using existing passes
  this.analyzeModuleWithContext(program, globalSymbols);
  
  // Results collected EVEN IF errors occurred
  moduleResults.set(moduleName, moduleResult);
}

// ALL diagnostics from ALL modules are aggregated
for (const result of moduleResults.values()) {
  allDiagnostics.push(...result.diagnostics);
}

// Success only if NO errors in ANY module
success: !allDiagnostics.some(d => d.severity === 'error')
```

### Exception: Fail-Fast Cases

Some errors prevent further analysis:
- **Circular imports** → Immediate failure (cannot determine compilation order)
- **Missing module imports** → Immediate failure (cannot resolve dependencies)

These fail-fast cases return early with appropriate diagnostics.

---

## Existing Infrastructure

### Already Implemented

| Component | Class/Function | Location |
|-----------|----------------|----------|
| Lexer | `Lexer` | `packages/compiler/src/lexer/lexer.ts` |
| Parser | `Parser` | `packages/compiler/src/parser/parser.ts` |
| Semantic Analyzer | `SemanticAnalyzer.analyzeMultiple()` | `packages/compiler/src/semantic/analyzer.ts` |
| IL Generator | `ILGenerator` | `packages/compiler/src/il/generator.ts` |
| Optimizer | `Optimizer` (O0 stub) | `packages/compiler/src/optimizer/optimizer.ts` |
| Target Configs | `getTargetConfig()` | `packages/compiler/src/target/registry.ts` |

### Needs Implementation

| Component | Location |
|-----------|----------|
| Code Generator | Phase 2 |
| Config Loader | Phase 0 |

---

## API Design

### Main Compiler Class

```typescript
// packages/compiler/src/compiler.ts

import type { Blend65Config, CompilerOptions } from './config/types.js';
import type { Diagnostic } from './ast/diagnostics.js';
import type { Program } from './ast/nodes.js';
import type { ILModule } from './il/module.js';
import type { TargetConfig } from './target/config.js';

/**
 * Result of a single compilation phase
 */
interface PhaseResult<T> {
  /** Phase output data */
  data: T;
  /** Diagnostics from this phase */
  diagnostics: Diagnostic[];
  /** Whether phase succeeded (no errors) */
  success: boolean;
  /** Phase execution time in milliseconds */
  timeMs: number;
}

/**
 * Complete compilation result
 */
interface CompilationResult {
  /** True if compilation succeeded with no errors */
  success: boolean;
  
  /** All diagnostics from all phases */
  diagnostics: Diagnostic[];
  
  /** Phase-specific results (for debugging) */
  phases: {
    parse?: PhaseResult<Program[]>;
    semantic?: PhaseResult<MultiModuleAnalysisResult>;
    il?: PhaseResult<ILModule>;
    optimize?: PhaseResult<OptimizationResult>;
    codegen?: PhaseResult<CodegenResult>;
  };
  
  /** Final output (if successful) */
  output?: {
    /** Generated assembly text */
    assembly?: string;
    /** Binary .prg data */
    binary?: Uint8Array;
    /** Source map data */
    sourceMap?: SourceMap;
    /** VICE label file content */
    viceLabels?: string;
  };
  
  /** Total compilation time in milliseconds */
  totalTimeMs: number;
  
  /** Target configuration used */
  target: TargetConfig;
}

/**
 * Compilation input options
 */
interface CompileOptions {
  /** Source files to compile */
  files: string[];
  
  /** Configuration (from blend65.json or defaults) */
  config: Blend65Config;
  
  /** Override: Stop after specific phase */
  stopAfterPhase?: 'parse' | 'semantic' | 'il' | 'optimize' | 'codegen';
}

/**
 * Main Blend65 compiler class
 * 
 * Orchestrates the complete compilation pipeline:
 * 1. Parse source files → AST
 * 2. Semantic analysis → Types, symbols, validation
 * 3. IL generation → Intermediate representation
 * 4. Optimization → O0 pass-through (or full optimizer later)
 * 5. Code generation → Assembly / .prg
 * 
 * @example
 * ```typescript
 * import { Compiler } from '@blend65/compiler';
 * import { ConfigLoader } from '@blend65/compiler/config';
 * 
 * const config = new ConfigLoader().load('./blend65.json');
 * const compiler = new Compiler();
 * const result = await compiler.compile({
 *   files: ['src/main.blend', 'src/game.blend'],
 *   config,
 * });
 * 
 * if (result.success) {
 *   writeFileSync('game.prg', result.output.binary);
 * } else {
 *   console.error(formatDiagnostics(result.diagnostics));
 * }
 * ```
 */
export class Compiler {
  /**
   * Compile source files
   */
  compile(options: CompileOptions): CompilationResult;
  
  /**
   * Compile from source strings (for testing/REPL)
   */
  compileSource(sources: Map<string, string>, config: Blend65Config): CompilationResult;
  
  /**
   * Parse only (for IDE integration)
   */
  parseOnly(files: string[]): PhaseResult<Program[]>;
  
  /**
   * Check only (parse + semantic, no codegen)
   */
  check(files: string[], config: Blend65Config): CompilationResult;
}
```

---

## Pipeline Architecture

### Phase Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Compilation Pipeline                             │
└─────────────────────────────────────────────────────────────────────────┘

     ┌─────────┐
     │ Config  │ ──────────────────────────────────────────────┐
     └─────────┘                                               │
          │                                                    │
          ▼                                                    ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Source Files   │────▶│    Phase 1      │────▶│    Phase 2      │
│  (strings)      │     │    PARSE        │     │    SEMANTIC     │
│                 │     │                 │     │                 │
│ main.blend      │     │ Lexer → Parser  │     │ analyzeMultiple │
│ game.blend      │     │ per file        │     │ cross-module    │
│ utils.blend     │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │                       │
                                ▼                       ▼
                        ┌─────────────┐         ┌─────────────┐
                        │ Program[]   │         │ GlobalSymbol│
                        │ (ASTs)      │         │ Table       │
                        └─────────────┘         └─────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    OUTPUT       │◀────│    Phase 5      │◀────│    Phase 3      │
│                 │     │    CODEGEN      │     │    IL GEN       │
│ .prg binary     │     │                 │     │                 │
│ .asm source     │     │ ILModule → ASM  │     │ AST → ILModule  │
│ .labels file    │     │ per target      │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                ▲                       │
                                │                       ▼
                        ┌─────────────────┐     ┌─────────────┐
                        │    Phase 4      │◀────│  ILModule   │
                        │    OPTIMIZE     │     │             │
                        │                 │     └─────────────┘
                        │ O0: pass-through│
                        │ O1+: full optim │
                        └─────────────────┘
```

### Phase Details

| Phase | Input | Output | Errors Possible |
|-------|-------|--------|-----------------|
| 1. Parse | Source strings | Program[] (AST per file) | Syntax errors |
| 2. Semantic | Program[] | GlobalSymbolTable, Types | Type errors, missing imports |
| 3. IL Gen | AST + Types | ILModule | Code generation errors |
| 4. Optimize | ILModule | ILModule (optimized) | None (O0) |
| 5. Codegen | ILModule | Assembly + Binary | Target-specific errors |

---

## Implementation

### File Structure

```
packages/compiler/src/
├── compiler.ts           # Main Compiler class
├── pipeline/
│   ├── index.ts          # Pipeline exports
│   ├── types.ts          # PhaseResult, CompilationResult
│   ├── parse-phase.ts    # Phase 1: Parsing
│   ├── semantic-phase.ts # Phase 2: Semantic analysis
│   ├── il-phase.ts       # Phase 3: IL generation
│   ├── optimize-phase.ts # Phase 4: Optimization
│   └── codegen-phase.ts  # Phase 5: Code generation (stub)
└── index.ts              # Public API exports
```

### Phase Implementations

```typescript
// pipeline/parse-phase.ts
export class ParsePhase {
  /**
   * Parse multiple source files
   */
  execute(sources: Map<string, string>): PhaseResult<Program[]> {
    const startTime = performance.now();
    const programs: Program[] = [];
    const diagnostics: Diagnostic[] = [];
    
    for (const [filename, source] of sources) {
      // Lexer
      const lexer = new Lexer(source, filename);
      const tokens = lexer.tokenize();
      diagnostics.push(...lexer.getDiagnostics());
      
      // Parser
      const parser = new Parser(tokens, filename);
      const program = parser.parse();
      diagnostics.push(...parser.getDiagnostics());
      
      programs.push(program);
    }
    
    return {
      data: programs,
      diagnostics,
      success: !diagnostics.some(d => d.severity === 'error'),
      timeMs: performance.now() - startTime,
    };
  }
}

// pipeline/semantic-phase.ts
export class SemanticPhase {
  /**
   * Run semantic analysis on parsed programs
   */
  execute(programs: Program[]): PhaseResult<MultiModuleAnalysisResult> {
    const startTime = performance.now();
    
    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyzeMultiple(programs);
    
    return {
      data: result,
      diagnostics: result.diagnostics,
      success: result.success,
      timeMs: performance.now() - startTime,
    };
  }
}

// pipeline/il-phase.ts
export class ILPhase {
  /**
   * Generate IL from analyzed AST
   */
  execute(
    semanticResult: MultiModuleAnalysisResult,
    targetConfig: TargetConfig
  ): PhaseResult<ILModule> {
    const startTime = performance.now();
    const diagnostics: Diagnostic[] = [];
    
    const generator = new ILGenerator(
      semanticResult.globalSymbolTable,
      targetConfig
    );
    
    const ilModule = generator.generate(/* ... */);
    diagnostics.push(...generator.getDiagnostics());
    
    return {
      data: ilModule,
      diagnostics,
      success: !diagnostics.some(d => d.severity === 'error'),
      timeMs: performance.now() - startTime,
    };
  }
}

// pipeline/optimize-phase.ts
export class OptimizePhase {
  /**
   * Optimize IL module
   */
  execute(
    ilModule: ILModule,
    level: OptimizationLevel
  ): PhaseResult<OptimizationResult> {
    const startTime = performance.now();
    
    const optimizer = createOptimizerForLevel(level);
    const result = optimizer.optimize(ilModule);
    
    return {
      data: result,
      diagnostics: [], // Optimizer doesn't produce diagnostics (yet)
      success: true,
      timeMs: performance.now() - startTime,
    };
  }
}

// pipeline/codegen-phase.ts
export class CodegenPhase {
  /**
   * Generate target code from IL
   * 
   * NOTE: This is a STUB implementation for Phase 2
   */
  execute(
    ilModule: ILModule,
    options: CodegenOptions
  ): PhaseResult<CodegenResult> {
    const startTime = performance.now();
    
    // STUB: Generate minimal output
    const assembly = this.generateStubAssembly(ilModule);
    const binary = this.generateStubBinary(assembly);
    
    return {
      data: {
        assembly,
        binary,
        sourceMap: undefined, // Phase 3
      },
      diagnostics: [],
      success: true,
      timeMs: performance.now() - startTime,
    };
  }
  
  protected generateStubAssembly(ilModule: ILModule): string {
    // STUB: Placeholder assembly
    return `; Blend65 Compiler Output (STUB)
; Generated: ${new Date().toISOString()}
;
; NOTE: This is a stub implementation.
; Real code generation will be implemented in Phase 2.

* = $0801

; BASIC stub: 10 SYS 2064
!byte $0b, $08, $0a, $00, $9e, $32, $30, $36, $34, $00, $00, $00

* = $0810

; Main program entry
main:
  LDA #$00
  STA $D020    ; Set border color
  STA $D021    ; Set background color
  RTS

; End of program
`;
  }
  
  protected generateStubBinary(assembly: string): Uint8Array {
    // STUB: Return minimal .prg
    // Real implementation will invoke ACME or internal assembler
    return new Uint8Array([
      0x01, 0x08,  // Load address: $0801
      // BASIC stub + minimal code
      0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x34, 0x00, 0x00, 0x00,
      // LDA #$00, STA $D020, STA $D021, RTS
      0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x8d, 0x21, 0xd0, 0x60,
    ]);
  }
}
```

### Main Compiler Class

```typescript
// compiler.ts
export class Compiler {
  protected parsePhase = new ParsePhase();
  protected semanticPhase = new SemanticPhase();
  protected ilPhase = new ILPhase();
  protected optimizePhase = new OptimizePhase();
  protected codegenPhase = new CodegenPhase();
  
  /**
   * Compile source files to target output
   */
  compile(options: CompileOptions): CompilationResult {
    const startTime = performance.now();
    const { files, config } = options;
    
    // Get target configuration
    const target = getTargetConfig(
      parseTargetArchitecture(config.compilerOptions.target || 'c64')!
    );
    
    const result: CompilationResult = {
      success: false,
      diagnostics: [],
      phases: {},
      totalTimeMs: 0,
      target,
    };
    
    try {
      // Load source files
      const sources = this.loadSourceFiles(files);
      
      // Phase 1: Parse
      const parseResult = this.parsePhase.execute(sources);
      result.phases.parse = parseResult;
      result.diagnostics.push(...parseResult.diagnostics);
      
      if (!parseResult.success || options.stopAfterPhase === 'parse') {
        return this.finalize(result, startTime);
      }
      
      // Phase 2: Semantic Analysis
      const semanticResult = this.semanticPhase.execute(parseResult.data);
      result.phases.semantic = semanticResult;
      result.diagnostics.push(...semanticResult.diagnostics);
      
      if (!semanticResult.success || options.stopAfterPhase === 'semantic') {
        return this.finalize(result, startTime);
      }
      
      // Phase 3: IL Generation
      const ilResult = this.ilPhase.execute(semanticResult.data, target);
      result.phases.il = ilResult;
      result.diagnostics.push(...ilResult.diagnostics);
      
      if (!ilResult.success || options.stopAfterPhase === 'il') {
        return this.finalize(result, startTime);
      }
      
      // Phase 4: Optimization
      const optimizeResult = this.optimizePhase.execute(
        ilResult.data,
        this.parseOptLevel(config.compilerOptions.optimization)
      );
      result.phases.optimize = optimizeResult;
      
      if (options.stopAfterPhase === 'optimize') {
        return this.finalize(result, startTime);
      }
      
      // Phase 5: Code Generation
      const codegenResult = this.codegenPhase.execute(
        optimizeResult.data.module,
        {
          target,
          format: config.compilerOptions.outputFormat || 'prg',
          sourceMap: config.compilerOptions.debug !== 'none',
        }
      );
      result.phases.codegen = codegenResult;
      result.diagnostics.push(...codegenResult.diagnostics);
      
      if (codegenResult.success) {
        result.output = {
          assembly: codegenResult.data.assembly,
          binary: codegenResult.data.binary,
          sourceMap: codegenResult.data.sourceMap,
        };
        result.success = true;
      }
      
    } catch (error) {
      result.diagnostics.push(this.createInternalError(error));
    }
    
    return this.finalize(result, startTime);
  }
  
  /**
   * Convenience: Compile from source strings
   */
  compileSource(
    sources: Map<string, string>,
    config: Blend65Config
  ): CompilationResult {
    // ... similar to compile() but skip file loading
  }
  
  /**
   * Parse only (for IDE integration)
   */
  parseOnly(files: string[]): PhaseResult<Program[]> {
    const sources = this.loadSourceFiles(files);
    return this.parsePhase.execute(sources);
  }
  
  /**
   * Check only (parse + semantic, no codegen)
   */
  check(files: string[], config: Blend65Config): CompilationResult {
    return this.compile({
      files,
      config,
      stopAfterPhase: 'semantic',
    });
  }
  
  // ... helper methods
}
```

---

## Task Breakdown

### Task 1.1: Pipeline Types
**File**: `packages/compiler/src/pipeline/types.ts`

Define types for compilation pipeline.

```typescript
// Deliverables:
// - PhaseResult<T> interface
// - CompilationResult interface
// - CompileOptions interface
// - CodegenResult interface (stub)
```

**Acceptance Criteria:**
- [ ] All types defined with JSDoc
- [ ] Types exported from pipeline/index.ts
- [ ] Unit tests for type assertions

---

### Task 1.2: Parse Phase
**File**: `packages/compiler/src/pipeline/parse-phase.ts`

Implement parsing phase orchestration.

```typescript
// Deliverables:
// - ParsePhase class
// - Multi-file parsing
// - Diagnostic aggregation
```

**Acceptance Criteria:**
- [ ] Parses multiple files correctly
- [ ] Aggregates diagnostics from all files
- [ ] Reports timing information
- [ ] Unit tests with multiple files

---

### Task 1.3: Semantic Phase
**File**: `packages/compiler/src/pipeline/semantic-phase.ts`

Implement semantic analysis phase.

```typescript
// Deliverables:
// - SemanticPhase class
// - Integration with analyzeMultiple()
// - Cross-module resolution
```

**Acceptance Criteria:**
- [ ] Uses existing SemanticAnalyzer.analyzeMultiple()
- [ ] Handles multi-module projects
- [ ] Reports all diagnostics
- [ ] Unit tests with imports/exports

---

### Task 1.4: IL Phase
**File**: `packages/compiler/src/pipeline/il-phase.ts`

Implement IL generation phase.

```typescript
// Deliverables:
// - ILPhase class
// - Integration with ILGenerator
// - Target-aware generation
```

**Acceptance Criteria:**
- [ ] Uses existing ILGenerator
- [ ] Passes target configuration
- [ ] Reports diagnostics
- [ ] Unit tests for IL output

---

### Task 1.5: Optimize Phase
**File**: `packages/compiler/src/pipeline/optimize-phase.ts`

Implement optimization phase.

```typescript
// Deliverables:
// - OptimizePhase class
// - Integration with Optimizer (O0 stub)
// - Level-based optimization selection
```

**Acceptance Criteria:**
- [ ] Uses existing Optimizer
- [ ] Supports all optimization levels
- [ ] O0 is pass-through
- [ ] Unit tests for optimization

---

### Task 1.6: Main Compiler Class
**File**: `packages/compiler/src/compiler.ts`

Implement the unified Compiler class.

```typescript
// Deliverables:
// - Compiler class
// - compile() method
// - compileSource() method
// - parseOnly() method
// - check() method
```

**Acceptance Criteria:**
- [ ] Orchestrates all phases
- [ ] Handles errors gracefully
- [ ] Supports stopAfterPhase
- [ ] Integration tests for full pipeline

---

### Task 1.7: Public API & Tests
**Files**: `packages/compiler/src/index.ts`, `packages/compiler/src/__tests__/compiler/`

Export public API and create comprehensive tests.

```typescript
// Deliverables:
// - Export Compiler from index.ts
// - Integration tests
// - Error handling tests
// - Multi-file project tests
```

**Acceptance Criteria:**
- [ ] Clean public API export
- [ ] Integration tests pass
- [ ] Error cases handled
- [ ] Documentation complete

---

## Error Handling

### Error Aggregation Strategy

```typescript
/**
 * Errors are aggregated from all phases and reported at the end.
 * Compilation stops at first phase with errors.
 * 
 * Priority:
 * 1. Parse errors (syntax)
 * 2. Semantic errors (types, missing symbols)
 * 3. IL errors (code generation)
 * 4. Codegen errors (target-specific)
 */
```

### Error Reporting

```typescript
function formatDiagnostics(diagnostics: Diagnostic[]): string {
  return diagnostics
    .sort((a, b) => {
      // Sort by file, then line, then severity
      if (a.location.source !== b.location.source) {
        return a.location.source.localeCompare(b.location.source);
      }
      if (a.location.start.line !== b.location.start.line) {
        return a.location.start.line - b.location.start.line;
      }
      return severityOrder(a.severity) - severityOrder(b.severity);
    })
    .map(d => formatDiagnostic(d))
    .join('\n');
}

function formatDiagnostic(d: Diagnostic): string {
  const loc = d.location;
  const prefix = d.severity === 'error' ? 'error' : 'warning';
  return `${prefix}: ${d.message}
  --> ${loc.source}:${loc.start.line}:${loc.start.column}`;
}
```

---

## Test Plan

### Unit Tests

| Test Suite | Coverage |
|------------|----------|
| parse-phase.test.ts | Multi-file parsing |
| semantic-phase.test.ts | Cross-module analysis |
| il-phase.test.ts | IL generation |
| optimize-phase.test.ts | Optimization levels |
| compiler.test.ts | Full pipeline |

### Integration Tests

| Test Case | Description |
|-----------|-------------|
| Single file compile | Minimal program compiles |
| Multi-file project | Import/export works |
| Parse errors | Syntax errors reported correctly |
| Type errors | Semantic errors reported |
| Stop after phase | stopAfterPhase works |
| Full pipeline | End-to-end compilation |

---

## Task Checklist

| Task | Description | Status |
|------|-------------|--------|
| 1.1 | Pipeline Types | ✅ |
| 1.2 | Parse Phase | ✅ |
| 1.3 | Semantic Phase | ✅ |
| 1.4 | IL Phase | ✅ |
| 1.5 | Optimize Phase | ✅ |
| 1.6 | Main Compiler Class | ✅ |
| 1.7 | Public API & Tests | ✅ |

---

## Completion Notes

**Completed**: January 2026

**Implementation Summary:**
- Created `packages/compiler/src/pipeline/` directory with all phase classes
- Implemented `Compiler` class in `packages/compiler/src/compiler.ts`
- All pipeline phases (Parse, Semantic, IL, Optimize, Codegen) fully operational
- CodegenPhase is a stub implementation (real codegen is Phase 3)

**Test Coverage:**
- 131 new tests added across 6 test files
- All 5174 tests passing
- Test files created:
  - `__tests__/pipeline/types.test.ts`
  - `__tests__/pipeline/parse-phase.test.ts`
  - `__tests__/pipeline/semantic-phase.test.ts`
  - `__tests__/pipeline/codegen-phase.test.ts`
  - `__tests__/pipeline/optimize-phase.test.ts`
  - `__tests__/pipeline/compiler.test.ts`

**Files Created:**
- `packages/compiler/src/compiler.ts` - Main Compiler class
- `packages/compiler/src/pipeline/types.ts` - PhaseResult, CompilationResult types
- `packages/compiler/src/pipeline/parse-phase.ts` - Parse orchestration
- `packages/compiler/src/pipeline/semantic-phase.ts` - Semantic analysis orchestration
- `packages/compiler/src/pipeline/il-phase.ts` - IL generation orchestration
- `packages/compiler/src/pipeline/optimize-phase.ts` - Optimization orchestration
- `packages/compiler/src/pipeline/codegen-phase.ts` - Code generation stub
- `packages/compiler/src/pipeline/index.ts` - Public exports

---

## Dependencies

### Internal Dependencies

- Phase 0: Config System (for Blend65Config)
- Existing: Lexer, Parser, SemanticAnalyzer, ILGenerator, Optimizer

### External Dependencies

None required for this phase.

---

## Next Steps

After Phase 1 is complete:
1. **Phase 2**: Code Generation Stub (real codegen)
2. **Phase 4**: CLI (uses Compiler class)

---

## Future Enhancements

The following features are explicitly **out of scope** for MVP but should be considered for later phases:

### Incremental Compilation
- Cache parsed ASTs and analysis results
- Only recompile files that changed (based on timestamp or content hash)
- Track file dependencies for smart invalidation

### Parallel Parsing
- Parse independent files in parallel using worker threads
- Merge results before semantic analysis phase

### Watch Mode Optimization
- Keep compiler instance alive between rebuilds
- Reuse unchanged intermediate results
- Fast path for single-file changes

### Language Server Protocol (LSP)
- Expose `parseOnly()` and `check()` for IDE integration
- Real-time error reporting as user types
- Go-to-definition and hover support

**Note:** These features are explicitly deferred to avoid scope creep in the MVP phase.

---

**This document defines the unified Compiler class for Blend65.**