# 03f - CodeGenerator Integration & E2E Tests

> **Phase:** 2 (End-to-End Compilation)
> **Session:** 10
> **Estimated Tests:** ~50
> **Dependencies:** All previous (03a-03e)

---

## Overview

This document describes the final integration of all ASM-IL components and comprehensive end-to-end testing. This session validates the complete pipeline from IL to ACME text output.

### Complete Pipeline
```
IL Module → CodeGenerator → AsmModule → AsmOptimizer → ACME Emitter → .asm text → ACME → .prg
                ↓                ↓              ↓              ↓
           03b Builder      03a Types     03c Pass-through  03d Emitter
```

### Goals
1. **Integrate** all ASM-IL components into a cohesive system
2. **Validate** the complete compilation pipeline
3. **Test** real-world Blend programs end-to-end
4. **Document** the public API for external use

---

## Integration Architecture

### Main Compilation Flow

```typescript
import { CodeGenerator } from './codegen/index.js';
import { createPassThroughOptimizer, createAsmOptimizer } from './asm-il/optimizer/index.js';
import { createAcmeEmitter } from './asm-il/emitters/index.js';

/**
 * Complete compilation from IL to ACME text.
 */
export function compileToAcme(
  ilModule: ILModule,
  config: CompilationConfig
): CompilationResult {
  // 1. Code generation: IL → AsmModule
  const codeGen = new CodeGenerator(config.codeGen);
  const codeGenResult = codeGen.generate(ilModule);
  
  // 2. Optimization: AsmModule → AsmModule (currently pass-through)
  const optimizer = config.optimize 
    ? createAsmOptimizer(config.asmOptimizer)
    : createPassThroughOptimizer();
  const optResult = optimizer.optimize(codeGenResult.module);
  
  // 3. Emission: AsmModule → text
  const emitter = createAcmeEmitter(config.emitter);
  const emitResult = emitter.emit(optResult.module);
  
  return {
    asmText: emitResult.text,
    asmModule: optResult.module,
    sourceMap: codeGenResult.sourceMap,
    stats: {
      totalBytes: emitResult.totalBytes,
      lineCount: emitResult.lineCount,
      optimizationPasses: optResult.iterations,
      changed: optResult.changed
    }
  };
}
```

### Public API Design

```typescript
// packages/compiler/src/asm-il/index.ts - Public exports

// Types
export type {
  AsmModule,
  AsmSection,
  AsmElement,
  AsmInstruction,
  AsmLabel,
  AsmData,
  AsmComment,
  AsmDirective,
  AddressingMode,
  Mnemonic
} from './types.js';

// Type guards
export {
  isAsmInstruction,
  isAsmLabel,
  isAsmData,
  isAsmComment,
  isAsmDirective
} from './types.js';

// Builder
export { AsmModuleBuilder } from './builder/module-builder.js';
export { createAsmModule } from './types.js';

// Optimizer
export { 
  AsmOptimizer,
  PassThroughOptimizer,
  createAsmOptimizer,
  createPassThroughOptimizer
} from './optimizer/index.js';
export type { 
  AsmOptimizerConfig,
  AsmOptimizationPass,
  AsmOptimizationResult 
} from './optimizer/index.js';

// Emitter
export {
  AcmeEmitter,
  createAcmeEmitter
} from './emitters/index.js';
export type {
  AcmeEmitterConfig,
  EmitterResult
} from './emitters/index.js';
```

---

## Integration Tests

### Test Categories

1. **Component Integration** - Verify components work together
2. **Pipeline Validation** - Test complete flow
3. **Real Program Tests** - Compile actual Blend code
4. **Error Handling** - Validate error propagation
5. **Performance** - Measure compilation speed

---

## Test Plan (~50 tests)

### Test File: `__tests__/integration/asm-il-pipeline.test.ts`

```typescript
describe('ASM-IL Pipeline Integration', () => {
  describe('Component Integration', () => {
    it('should pass AsmModule from CodeGenerator to Optimizer');
    it('should pass AsmModule from Optimizer to Emitter');
    it('should preserve module structure through pipeline');
    it('should maintain source map through pipeline');
    it('should handle empty modules through pipeline');
  });
  
  describe('Pipeline Configuration', () => {
    it('should use pass-through optimizer by default');
    it('should enable optimizer when configured');
    it('should apply emitter configuration');
    it('should combine all configurations correctly');
  });
  
  describe('Complete Pipeline', () => {
    it('should compile empty IL module');
    it('should compile module with single global');
    it('should compile module with multiple globals');
    it('should compile module with simple function');
    it('should compile module with function calls');
    it('should compile module with loops');
    it('should compile module with conditionals');
  });
});
```

### Test File: `__tests__/integration/real-programs.test.ts`

```typescript
describe('Real Program Compilation', () => {
  describe('Simple Programs', () => {
    it('should compile "Hello World" equivalent');
    it('should compile counter increment program');
    it('should compile border color change program');
    it('should compile keyboard reader program');
  });
  
  describe('C64 Hardware Access', () => {
    it('should compile VIC register access');
    it('should compile SID register access');
    it('should compile CIA timer access');
    it('should compile memory-mapped I/O');
  });
  
  describe('Control Flow', () => {
    it('should compile simple loop');
    it('should compile nested loops');
    it('should compile if-else statement');
    it('should compile switch-like dispatch');
  });
  
  describe('Data Handling', () => {
    it('should compile byte array initialization');
    it('should compile word array access');
    it('should compile string data');
    it('should compile lookup tables');
  });
});
```

### Test File: `__tests__/integration/error-handling.test.ts`

```typescript
describe('Error Handling Through Pipeline', () => {
  describe('CodeGenerator Errors', () => {
    it('should propagate invalid IL errors');
    it('should handle missing function references');
    it('should handle invalid memory addresses');
  });
  
  describe('Optimizer Errors', () => {
    it('should handle invalid AsmModule gracefully');
    it('should report optimization failures');
  });
  
  describe('Emitter Errors', () => {
    it('should handle invalid instructions');
    it('should handle invalid addressing modes');
    it('should validate operand ranges');
  });
  
  describe('Recovery', () => {
    it('should continue after recoverable errors');
    it('should accumulate multiple errors');
    it('should report all errors at end');
  });
});
```

### Test File: `__tests__/integration/output-validation.test.ts`

```typescript
describe('Output Validation', () => {
  describe('ACME Syntax Correctness', () => {
    it('should produce valid ACME header');
    it('should produce valid instruction syntax');
    it('should produce valid data directives');
    it('should produce valid label syntax');
    it('should produce valid comment syntax');
  });
  
  describe('Binary Equivalence', () => {
    // These tests compare generated ACME to expected output
    it('should match expected output for NOP program');
    it('should match expected output for LDA/STA sequence');
    it('should match expected output for branch instructions');
    it('should match expected output for BASIC loader');
  });
  
  describe('Source Map Accuracy', () => {
    it('should map ASM lines to source locations');
    it('should track multiple source files');
    it('should handle inlined code');
  });
});
```

---

## Example Programs for Testing

### Program 1: Border Color Cycle
```typescript
// IL representation of border color cycle
const borderCycleIL: ILModule = {
  name: 'border_cycle',
  globals: [
    { name: 'color', type: 'byte', initial: 0 }
  ],
  functions: [
    {
      name: 'main',
      blocks: [
        {
          label: 'loop',
          instructions: [
            { op: 'load', dest: 'r0', src: 'color' },
            { op: 'store', dest: '$D020', src: 'r0' },  // Border color
            { op: 'inc', dest: 'color' },
            { op: 'jump', target: 'loop' }
          ]
        }
      ]
    }
  ]
};
```

### Expected ACME Output
```asm
!to "border_cycle.prg", cbm
*= $0801

; === BASIC Loader ===
        !byte $0C, $08, $0A, $00, $9E, $32, $30, $36, $31, $00, $00, $00

; === Global Variables ===
color
        !byte $00

; === Code ===
main
.loop
        LDA color
        STA $D020
        INC color
        JMP .loop

; Total bytes: 23
```

### Program 2: Memory Fill
```typescript
const memFillIL: ILModule = {
  name: 'mem_fill',
  globals: [],
  functions: [
    {
      name: 'main',
      blocks: [
        {
          label: 'entry',
          instructions: [
            { op: 'loadImm', dest: 'r0', value: 0 },      // Counter
            { op: 'loadImm', dest: 'r1', value: 0x20 },   // Fill value (space)
          ]
        },
        {
          label: 'loop',
          instructions: [
            { op: 'storeIndexed', base: '$0400', index: 'r0', src: 'r1' },
            { op: 'inc', dest: 'r0' },
            { op: 'cmp', left: 'r0', right: 0 },  // Wrap at 256
            { op: 'branchNe', target: 'loop' },
            { op: 'return' }
          ]
        }
      ]
    }
  ]
};
```

---

## Performance Benchmarks

### Benchmark Suite

```typescript
describe('Pipeline Performance', () => {
  it('should compile small program in < 10ms', async () => {
    const start = performance.now();
    compileToAcme(smallProgram, defaultConfig);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
  });
  
  it('should compile medium program in < 50ms', async () => {
    const start = performance.now();
    compileToAcme(mediumProgram, defaultConfig);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
  
  it('should compile large program in < 200ms', async () => {
    const start = performance.now();
    compileToAcme(largeProgram, defaultConfig);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });
});
```

### Memory Usage

```typescript
describe('Memory Usage', () => {
  it('should not leak memory on repeated compilations');
  it('should release AsmModule after emission');
  it('should handle large programs without excessive memory');
});
```

---

## Documentation

### User Guide Sections

1. **Quick Start** - Basic usage example
2. **Configuration** - All configuration options
3. **Pipeline Overview** - How components connect
4. **Extending** - Adding custom optimization passes
5. **Troubleshooting** - Common issues and solutions

### API Documentation

All public types and functions must have complete JSDoc:

```typescript
/**
 * Compiles an IL module to ACME assembly text.
 * 
 * This function orchestrates the complete compilation pipeline:
 * 1. Code generation (IL → AsmModule)
 * 2. Optimization (AsmModule → AsmModule)
 * 3. Emission (AsmModule → text)
 * 
 * @param ilModule - The intermediate language module to compile
 * @param config - Compilation configuration options
 * @returns Compilation result including assembly text and metadata
 * 
 * @example
 * ```typescript
 * const result = compileToAcme(ilModule, {
 *   codeGen: { origin: 0x0801 },
 *   optimize: false,
 *   emitter: { includeComments: true }
 * });
 * console.log(result.asmText);
 * ```
 */
export function compileToAcme(
  ilModule: ILModule,
  config: CompilationConfig
): CompilationResult;
```

---

## Migration & Deprecation

### Deprecated APIs

```typescript
// Mark old CodeGenerator.generate() signature as deprecated
/**
 * @deprecated Use compileToAcme() for complete pipeline, 
 * or generate() + AcmeEmitter for manual control.
 */
```

### Migration Path

1. **Phase 1**: New API alongside old (current session)
2. **Phase 2**: Warnings on old API usage
3. **Phase 3**: Remove old API (future session)

---

## Task Checklist

| Task | Description | Status |
|------|-------------|--------|
| 10.1 | Create compileToAcme() integration function | ⬜ |
| 10.2 | Create public API exports (index.ts) | ⬜ |
| 10.3 | Write component integration tests | ⬜ |
| 10.4 | Write pipeline configuration tests | ⬜ |
| 10.5 | Write complete pipeline tests | ⬜ |
| 10.6 | Write real program compilation tests | ⬜ |
| 10.7 | Write error handling tests | ⬜ |
| 10.8 | Write output validation tests | ⬜ |
| 10.9 | Add performance benchmarks | ⬜ |
| 10.10 | Complete API documentation | ⬜ |

---

## Success Criteria

### Session 10 Complete When:

1. ✅ All ASM-IL components integrated
2. ✅ compileToAcme() function working
3. ✅ Public API exported and documented
4. ✅ All ~50 integration tests passing
5. ✅ Real Blend programs compile successfully
6. ✅ Generated ACME is syntactically correct
7. ✅ Source maps accurate
8. ✅ Performance within targets
9. ✅ No memory leaks
10. ✅ Documentation complete

### Phase 2 Complete When:

All 10 sessions complete with:
- ~355 total tests passing
- Complete ASM-IL infrastructure
- Refactored CodeGenerator
- Working end-to-end pipeline
- Ready for Phase 3 (CLI integration)