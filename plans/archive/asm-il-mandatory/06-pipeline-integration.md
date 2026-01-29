# Pipeline Integration

> **Document**: 06-pipeline-integration.md
> **Parent**: [Index](00-index.md)

## Overview

The compiler pipeline must be updated to use the ASM-IL flow exclusively. Currently, `codegen-phase.ts` calls `generate()` which defaults to the legacy AssemblyWriter path.

## Current Pipeline Flow

```
┌─────────────────┐
│   ParsePhase    │ → AST
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ SemanticPhase   │ → Type-checked AST
└─────────────────┘
        │
        ▼
┌─────────────────┐
│   ILPhase       │ → ILModule
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ OptimizePhase   │ → Optimized ILModule (pass-through for now)
└─────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│            CodegenPhase                          │
│                                                  │
│  codeGenerator.generate(ilModule, options)       │
│        │                                         │
│        ▼ (Legacy - CURRENT)                      │
│  AssemblyWriter → text                           │
│                                                  │
│  OR (if useAsmIL=true - NOT USED)                │
│        ▼                                         │
│  AsmModuleBuilder → AsmModule → AcmeEmitter      │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────┐
│  .asm / .prg    │
└─────────────────┘
```

## Target Pipeline Flow

```
┌─────────────────┐
│   ParsePhase    │ → AST
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ SemanticPhase   │ → Type-checked AST
└─────────────────┘
        │
        ▼
┌─────────────────┐
│   ILPhase       │ → ILModule
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ OptimizePhase   │ → Optimized ILModule
└─────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│            CodegenPhase                          │
│                                                  │
│  codeGenerator.generate(ilModule, options)       │
│        │                                         │
│        ▼ (NEW - ONLY PATH)                       │
│  AsmModuleBuilder → AsmModule                    │
│        │                                         │
│        ▼                                         │
│  ASM-IL Optimizer (optional)                     │
│        │                                         │
│        ▼                                         │
│  AcmeEmitter → text                              │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────┐
│  .asm / .prg    │
└─────────────────┘
```

## Changes to CodegenPhase

### Current Implementation

```typescript
// pipeline/codegen-phase.ts

public execute(ilModule: ILModule, options: CodegenOptions): PhaseResult<CodegenResult> {
  // ... setup ...
  
  // Use the real CodeGenerator
  const codegenResult = this.codeGenerator.generate(ilModule, internalOptions);
  
  // Convert warnings to diagnostics
  for (const warning of codegenResult.warnings ?? []) {
    // ...
  }
  
  const result: CodegenResult = {
    assembly: codegenResult.assembly,
    binary: codegenResult.binary,
    sourceMap: undefined,
    viceLabels: codegenResult.viceLabels,
  };
  
  return { data: result, diagnostics, success: true, timeMs };
}
```

### Target Implementation

**Option A: Minimal Change**

Update CodeGenerator.generate() to always use ASM-IL (no pipeline changes needed):

```typescript
// codegen-phase.ts - No changes, but CodeGenerator changed internally
const codegenResult = this.codeGenerator.generate(ilModule, internalOptions);
// generate() now always produces AsmModule internally and emits via AcmeEmitter
```

**Option B: Explicit ASM-IL Flow in Pipeline**

Use the ASM-IL compile flow directly:

```typescript
// pipeline/codegen-phase.ts

import { compileToAcme, createDefaultConfig } from '../asm-il/index.js';

public execute(ilModule: ILModule, options: CodegenOptions): PhaseResult<CodegenResult> {
  const startTime = performance.now();
  const diagnostics: Diagnostic[] = [];

  // Configure ASM-IL compilation
  const config = createDefaultConfig({
    codeGen: {
      target: options.target,
      format: options.format,
      debug: options.debug ?? 'none',
      sourceMap: options.sourceMap ?? false,
      basicStub: true,
    },
    optimize: false,  // ASM-IL optimization (separate from IL optimization)
    emitter: {
      includeComments: true,
      includeSourceComments: options.debug === 'inline' || options.debug === 'both',
      uppercaseMnemonics: true,
    },
  });

  // Use the ASM-IL compilation flow
  const compileResult = compileToAcme(ilModule, config);

  // Convert warnings to diagnostics
  for (const warning of compileResult.codeGenResult.warnings ?? []) {
    diagnostics.push({
      code: DiagnosticCode.TYPE_MISMATCH,
      severity: DiagnosticSeverity.WARNING,
      message: warning.message,
      location: warning.location ?? { /* fallback */ },
    });
  }

  // Build result
  const result: CodegenResult = {
    assembly: compileResult.asmText,
    binary: compileResult.codeGenResult.binary,
    sourceMap: undefined,  // TODO: Convert from ASM-IL
    viceLabels: compileResult.codeGenResult.viceLabels,
  };

  return {
    data: result,
    diagnostics,
    success: true,
    timeMs: performance.now() - startTime,
  };
}
```

### Recommended: Option A

Option A (minimal change) is recommended because:
1. Less code change in pipeline
2. CodeGenerator is the right place for this logic
3. `compileToAcme()` can be used for standalone compilation if needed

## Integration Points

### 1. Update Pipeline Types

The `CodegenResult` type should include `AsmModule`:

```typescript
// pipeline/types.ts

export interface CodegenResult {
  assembly: string;
  binary?: Uint8Array;
  sourceMap?: SourceMap;
  viceLabels?: string;
  asmModule?: AsmModule;  // NEW: Include for debugging/inspection
}
```

### 2. Update Compiler Class

The main `Compiler` class may need updates:

```typescript
// compiler.ts

public compile(source: string, options: CompileOptions): CompileResult {
  // ... existing phases ...
  
  // CodegenPhase now always uses ASM-IL internally
  const codegenResult = this.codegenPhase.execute(ilModule, codegenOptions);
  
  // Access AsmModule if needed for debugging
  if (options.debug) {
    console.log('ASM-IL items:', codegenResult.data.asmModule?.items.length);
  }
  
  return {
    assembly: codegenResult.data.assembly,
    binary: codegenResult.data.binary,
    // ...
  };
}
```

### 3. CLI Integration

No changes needed to CLI - it uses the pipeline which handles everything.

## Testing Integration

### Pipeline Tests

```typescript
// __tests__/pipeline/codegen-phase.test.ts

describe('CodegenPhase', () => {
  it('should produce AsmModule in result', async () => {
    const phase = new CodegenPhase();
    const result = phase.execute(ilModule, options);
    
    expect(result.data.asmModule).toBeDefined();
    expect(result.data.asmModule.items.length).toBeGreaterThan(0);
  });

  it('should produce identical assembly via ASM-IL path', async () => {
    // Compare old output with new ASM-IL output
    // They should be equivalent (or improved)
  });
});
```

### E2E Tests

All existing E2E tests should pass with the new flow. The output format is unchanged.

## Migration Steps

1. **Phase 1**: Update CodeGenerator to always use ASM-IL internally
2. **Phase 2**: Update CodegenPhase to access AsmModule from result
3. **Phase 3**: Run full test suite, fix any regressions
4. **Phase 4**: Update types to include AsmModule
5. **Phase 5**: Clean up legacy code paths