# Pipeline & Compiler Class

> **Document**: 06-pipeline-compiler.md
> **Parent**: [Index](00-index.md)

## Overview

Create the main `Compiler` class that orchestrates the full compilation pipeline, along with pipeline phase wrappers, public API, and `index.ts` exports.

## Architecture

### Pipeline Phases

```
Source Files → Library Loading → Parse → Semantic → Frame Allocator → IL → IL Optimizer → CodeGen → ASM Optimizer → Emitter → Output
```

### Phase Wrapper Classes

Adapt the v1 pipeline phase pattern. Each phase wraps one compiler component:

| Phase Class | V2 Component | Input | Output |
|-------------|-------------|-------|--------|
| `ParsePhase` | Lexer + Parser | `Map<string, string>` | `Program[]` |
| `SemanticPhase` | SemanticAnalyzer | `Program[]` | `MultiModuleAnalysisResult` |
| `FramePhase` | FrameAllocator | `AnalysisResult + CallGraph` | `FrameMap` |
| `ILPhase` | ILGenerator | `Programs + Frames + Target` | `ILModule` |
| `OptimizePhase` | ILOptimizer | `ILModule + Level` | `OptimizedILModule` |
| `CodegenPhase` | CodeGenerator | `ILModule + Target` | `AsmILModule` |
| `AsmOptPhase` | AsmOptimizer | `AsmILModule` | `OptimizedAsmIL` |
| `EmitPhase` | AsmILEmitter | `AsmIL` | `Assembly string` |

### Compiler Class

Adapt from v1 `Compiler` class (`packages/compiler/src/compiler.ts`):

```typescript
export class Compiler {
  // Phase instances
  protected parsePhase: ParsePhase;
  protected semanticPhase: SemanticPhase;
  protected framePhase: FramePhase;
  protected ilPhase: ILPhase;
  protected optimizePhase: OptimizePhase;
  protected codegenPhase: CodegenPhase;
  protected asmOptPhase: AsmOptPhase;
  protected emitPhase: EmitPhase;
  protected libraryLoader: LibraryLoader;

  // Public API
  compile(options: CompileOptions): CompilationResult;
  compileSource(sources: Map<string, string>, config: Blend65Config): CompilationResult;
  check(files: string[], config: Blend65Config): CompilationResult;
  parseOnly(files: string[]): PhaseResult<Program[]>;
}
```

### Key Behaviors to Preserve from V1

1. **Library auto-loading**: Load `common/` + `{target}/common/` before user sources
2. **Source merging**: Library sources prepended to user sources
3. **Target validation**: Check target is valid and implemented
4. **Phase sequencing**: Stop on error, support `stopAfterPhase`
5. **Timing**: Track time per phase and total
6. **Diagnostics**: Aggregate from all phases
7. **Output artifacts**: Assembly text, binary (optional), source map, VICE labels

## Files to Create

```
packages/compiler-v2/src/
├── pipeline/
│   ├── types.ts          ← Adapt from v1 (PhaseResult, CompilationResult, etc.)
│   ├── parse-phase.ts    ← New
│   ├── semantic-phase.ts ← New
│   ├── frame-phase.ts    ← New
│   ├── il-phase.ts       ← New
│   ├── optimize-phase.ts ← New
│   ├── codegen-phase.ts  ← New
│   ├── asm-opt-phase.ts  ← New
│   ├── emit-phase.ts     ← New
│   └── index.ts          ← Re-exports
├── utils/
│   └── source-registry.ts ← Copy from v1 (used by CLI formatter)
├── compiler.ts           ← Main compiler class
└── index.ts              ← Update: export all public API + uncomment module re-exports
```

## Public API (index.ts exports)

```typescript
// Core compiler
export { Compiler } from './compiler.js';
export { formatDiagnostics, formatDiagnostic } from './compiler.js';

// Pipeline types
export type { CompilationResult, CompileOptions, PhaseResult, CodegenResult } from './pipeline/types.js';

// Config types
export type { Blend65Config, CompilerOptions } from './config/types.js';

// Target types
export { getTargetConfig, getDefaultTargetConfig } from './target/registry.js';
export type { TargetConfig } from './target/config.js';

// Library
export { LibraryLoader } from './library/loader.js';

// Submodule re-exports (currently only lexer is active — UNCOMMENT the rest)
export * from './lexer/index.js';     // ✅ already active
export * from './parser/index.js';    // ⚠️ currently commented out in index.ts — UNCOMMENT
export * from './ast/index.js';       // ⚠️ currently commented out in index.ts — UNCOMMENT
export * from './semantic/index.js';  // ⚠️ currently commented out in index.ts — UNCOMMENT
export * from './frame/index.js';     // ⚠️ currently commented out in index.ts — UNCOMMENT
export * from './il/index.js';        // ⚠️ currently commented out in index.ts — UNCOMMENT
export * from './codegen/index.js';   // ⚠️ currently commented out in index.ts — UNCOMMENT
export * from './optimizer/index.js'; // ⚠️ currently commented out in index.ts — UNCOMMENT

// Utilities
export { SourceRegistry } from './utils/source-registry.js';
```

## Testing Requirements

- Unit test: Compiler.compile() runs full pipeline
- Unit test: Compiler.compileSource() works with source map input
- Unit test: Compiler.check() stops after semantic phase
- Unit test: stopAfterPhase works for each phase
- Unit test: Library auto-loading works
- Unit test: Target validation rejects invalid targets
- Unit test: Error propagation stops pipeline on error
- Integration test: Full pipeline produces valid assembly output

## Dependencies

- All infrastructure (01-infrastructure.md)
- All library files (02-library-sync.md, 03-asm-blend-declarations.md)
- All asm_* support (04-asm-il-wiring.md, 05-asm-codegen.md)
- All v2 compiler components (Phases 1-9 complete)
