# 03e - CodeGenerator Rewire

> **Phase:** 2 (End-to-End Compilation)
> **Sessions:** 8-9 (split into two parts)
> **Estimated Tests:** ~100 (50 per session)
> **Dependencies:** 03a (types), 03b (builder), 03c (optimizer), 03d (emitter)

---

## Overview

This document describes how to refactor the existing CodeGenerator to produce `AsmModule` instead of raw ACME text. The existing inheritance chain (`BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator`) will be preserved and modified to use the new ASM-IL builder.

### Pipeline Change
```
BEFORE:
  IL Module → CodeGenerator → ACME text (string)

AFTER:
  IL Module → CodeGenerator → AsmModule → AsmOptimizer → ACME Emitter → text
```

### Refactoring Strategy
- **Preserve** the existing inheritance chain architecture
- **Replace** direct string concatenation with AsmModuleBuilder calls
- **Maintain** all existing tests (they should still pass after refactoring)
- **Add** new tests for ASM-IL output correctness

---

## Current Architecture Analysis

### Existing Files
```
packages/compiler/src/codegen/
├── index.ts              # Public exports
├── base.ts               # BaseCodeGenerator (~200 lines)
├── globals-generator.ts  # GlobalsGenerator (~300 lines)
├── instruction-generator.ts # InstructionGenerator (~400 lines)
├── code-generator.ts     # CodeGenerator (~300 lines)
├── label-generator.ts    # LabelGenerator helper
├── source-mapper.ts      # SourceMapper helper
└── basic-stub.ts         # BASIC loader helper
```

### Current Flow
1. `generate(ilModule)` called on CodeGenerator
2. Builds ACME text by string concatenation
3. Returns `CodeGenResult` with `{ code: string, sourceMap }`

### New Flow
1. `generate(ilModule)` called on CodeGenerator
2. Uses `AsmModuleBuilder` to build `AsmModule`
3. Returns `CodeGenResult` with `{ module: AsmModule, sourceMap }`
4. Caller uses `AcmeEmitter` to serialize to text

---

## Refactoring Plan

### Phase 1: Session 8 - Base Infrastructure (~50 tests)

#### Task 8.1: Update CodeGenResult Type
```typescript
// OLD
export interface CodeGenResult {
  code: string;
  sourceMap: SourceMap;
}

// NEW
export interface CodeGenResult {
  module: AsmModule;       // ASM-IL module (primary output)
  sourceMap: SourceMap;    // Source mapping
}
```

#### Task 8.2: Add Builder to BaseCodeGenerator
```typescript
export abstract class BaseCodeGenerator {
  protected readonly builder: AsmModuleBuilder;
  
  constructor(config: CodeGenConfig) {
    this.builder = new AsmModuleBuilder();
    // ... existing initialization
  }
  
  /**
   * Start a new code generation session.
   */
  protected startGeneration(moduleName: string, origin: number): void {
    this.builder.reset();
    this.builder.header(moduleName, origin);
  }
  
  /**
   * Finish code generation and return the module.
   */
  protected finishGeneration(): AsmModule {
    this.builder.footer();
    return this.builder.build();
  }
}
```

#### Task 8.3: Refactor Label Generation
```typescript
// OLD (string-based)
protected emitLabel(name: string): void {
  this.output += `${name}\n`;
}

// NEW (builder-based)
protected emitLabel(name: string, exported: boolean = false): void {
  this.builder.label(name, exported);
}
```

#### Task 8.4: Refactor Comment Generation
```typescript
// OLD
protected emitComment(text: string): void {
  this.output += `; ${text}\n`;
}

// NEW
protected emitComment(text: string): void {
  this.builder.comment(text);
}
```

#### Task 8.5: Update Helper Classes
- `LabelGenerator` - No changes needed (generates names, not output)
- `SourceMapper` - Update to work with AsmModule line numbers
- `BasicStub` - Refactor to use builder for BASIC loader data

### Phase 2: Session 9 - Instructions & Integration (~50 tests)

#### Task 9.1: Refactor InstructionGenerator
```typescript
// OLD - String-based emission
protected emitLDA(mode: AddressingMode, operand: number | string): void {
  switch (mode) {
    case AddressingMode.Immediate:
      this.output += `        LDA #${this.formatHex(operand)}\n`;
      break;
    // ... etc
  }
}

// NEW - Builder-based emission
protected emitLDA(mode: AddressingMode, operand: number | string): void {
  switch (mode) {
    case AddressingMode.Immediate:
      this.builder.ldaImm(operand as number);
      break;
    case AddressingMode.ZeroPage:
      this.builder.ldaZp(operand as number);
      break;
    case AddressingMode.Absolute:
      this.builder.ldaAbs(operand as number);
      break;
    // ... etc
  }
}
```

#### Task 9.2: Refactor All Instruction Methods
Convert all instruction emission methods to use builder:
- Load/Store: `emitLDA`, `emitLDX`, `emitLDY`, `emitSTA`, `emitSTX`, `emitSTY`
- Arithmetic: `emitADC`, `emitSBC`, `emitINC`, `emitDEC`
- Logic: `emitAND`, `emitORA`, `emitEOR`
- Shift: `emitASL`, `emitLSR`, `emitROL`, `emitROR`
- Compare: `emitCMP`, `emitCPX`, `emitCPY`
- Branch: `emitBCC`, `emitBCS`, `emitBEQ`, `emitBNE`, etc.
- Jump: `emitJMP`, `emitJSR`, `emitRTS`, `emitRTI`
- Stack: `emitPHA`, `emitPLA`, `emitPHP`, `emitPLP`
- Flags: `emitCLC`, `emitSEC`, `emitCLI`, `emitSEI`, `emitCLD`, `emitSED`, `emitCLV`
- Transfer: `emitTAX`, `emitTAY`, `emitTXA`, `emitTYA`, `emitTXS`, `emitTSX`
- Other: `emitNOP`, `emitBRK`

#### Task 9.3: Refactor GlobalsGenerator
```typescript
// OLD
protected emitGlobalVariable(decl: GlobalVariable): void {
  this.emitLabel(decl.name);
  this.output += `        !byte ${this.formatBytes(decl.initialValue)}\n`;
}

// NEW
protected emitGlobalVariable(decl: GlobalVariable): void {
  this.builder.label(decl.name, decl.exported);
  this.builder.byte(...decl.initialValue);
}
```

#### Task 9.4: Update CodeGenerator.generate()
```typescript
// OLD
generate(ilModule: ILModule): CodeGenResult {
  this.output = '';
  this.emitHeader();
  this.emitGlobals(ilModule.globals);
  this.emitFunctions(ilModule.functions);
  this.emitFooter();
  return { code: this.output, sourceMap: this.sourceMapper.getMap() };
}

// NEW
generate(ilModule: ILModule): CodeGenResult {
  this.startGeneration(ilModule.name, this.config.origin);
  
  // BASIC loader section
  this.builder.startSection('BASIC Loader');
  this.emitBasicStub();
  
  // Data section
  this.builder.startSection('Global Variables');
  this.emitGlobals(ilModule.globals);
  
  // Code section
  this.builder.startSection('Code');
  this.emitFunctions(ilModule.functions);
  
  return {
    module: this.finishGeneration(),
    sourceMap: this.sourceMapper.getMap()
  };
}
```

#### Task 9.5: Update Existing Tests
- Modify test assertions to use `AcmeEmitter` for text comparison
- Add helper function for test compatibility:
```typescript
function generateAndEmit(ilModule: ILModule): string {
  const result = codeGenerator.generate(ilModule);
  const emitter = createAcmeEmitter();
  return emitter.emit(result.module).text;
}
```

---

## Test Plan

### Session 8 Tests (~50)

```typescript
describe('CodeGenerator Rewire - Base Infrastructure', () => {
  describe('CodeGenResult Type', () => {
    it('should return AsmModule in result');
    it('should include sourceMap in result');
    it('should create valid AsmModule structure');
  });
  
  describe('BaseCodeGenerator with Builder', () => {
    it('should initialize builder');
    it('should reset builder on new generation');
    it('should call header with correct params');
    it('should call footer on finish');
    it('should return built module');
  });
  
  describe('Label Generation', () => {
    it('should emit global labels via builder');
    it('should emit local labels via builder');
    it('should emit exported labels via builder');
    it('should track label positions');
  });
  
  describe('Comment Generation', () => {
    it('should emit comments via builder');
    it('should emit section comments');
    it('should handle empty comments');
  });
  
  describe('BasicStub Integration', () => {
    it('should generate BASIC loader via builder');
    it('should emit correct SYS address');
    it('should emit BASIC line number');
  });
  
  describe('SourceMapper Integration', () => {
    it('should track source locations');
    it('should map to AsmModule line numbers');
    it('should handle multiple source files');
  });
  
  // ... additional tests for base infrastructure
});
```

### Session 9 Tests (~50)

```typescript
describe('CodeGenerator Rewire - Instructions & Integration', () => {
  describe('InstructionGenerator Methods', () => {
    describe('Load Instructions', () => {
      it('should emit LDA immediate via builder');
      it('should emit LDA zero page via builder');
      it('should emit LDA absolute via builder');
      it('should emit LDX/LDY variants');
    });
    
    describe('Store Instructions', () => {
      it('should emit STA immediate via builder');
      it('should emit STA zero page via builder');
      it('should emit STA absolute via builder');
      it('should emit STX/STY variants');
    });
    
    describe('Branch Instructions', () => {
      it('should emit BEQ with label');
      it('should emit BNE with label');
      it('should emit other branch variants');
    });
    
    describe('Jump Instructions', () => {
      it('should emit JMP absolute');
      it('should emit JMP indirect');
      it('should emit JSR');
      it('should emit RTS');
    });
    
    // ... all other instruction categories
  });
  
  describe('GlobalsGenerator Methods', () => {
    it('should emit byte variables');
    it('should emit word variables');
    it('should emit array variables');
    it('should emit initialized data');
  });
  
  describe('Complete Generation', () => {
    it('should generate empty module');
    it('should generate module with globals only');
    it('should generate module with functions');
    it('should generate complete program');
  });
  
  describe('Backward Compatibility', () => {
    it('should produce equivalent ACME text for simple program');
    it('should produce equivalent text for arithmetic');
    it('should produce equivalent text for loops');
    it('should produce equivalent text for function calls');
  });
});
```

---

## Migration Checklist

### Pre-Migration
- [ ] All existing tests pass
- [ ] ASM-IL types implemented (03a)
- [ ] Builder implemented (03b)
- [ ] Emitter implemented (03d)

### During Migration (Session 8)
- [ ] Create new CodeGenResult type
- [ ] Add builder to BaseCodeGenerator
- [ ] Refactor label emission
- [ ] Refactor comment emission
- [ ] Update BasicStub
- [ ] Update SourceMapper
- [ ] All Session 8 tests pass

### During Migration (Session 9)
- [ ] Refactor all instruction methods
- [ ] Refactor GlobalsGenerator
- [ ] Update CodeGenerator.generate()
- [ ] Add backward compatibility helpers
- [ ] All Session 9 tests pass

### Post-Migration
- [ ] All original tests pass (with emitter helper)
- [ ] Remove deprecated string-based code
- [ ] Update documentation
- [ ] Performance validation

---

## Backward Compatibility Strategy

To maintain backward compatibility during migration:

### 1. Wrapper Function
```typescript
/**
 * Generate ACME text directly (backward compatible).
 * @deprecated Use generate() + AcmeEmitter instead
 */
generateText(ilModule: ILModule): { code: string; sourceMap: SourceMap } {
  const result = this.generate(ilModule);
  const emitter = createAcmeEmitter();
  const emitResult = emitter.emit(result.module);
  return { code: emitResult.text, sourceMap: result.sourceMap };
}
```

### 2. Test Helper
```typescript
// In test utilities
export function generateAndEmit(
  generator: CodeGenerator, 
  ilModule: ILModule
): string {
  const result = generator.generate(ilModule);
  return createAcmeEmitter().emit(result.module).text;
}
```

### 3. Gradual Migration
- Phase 1: Add new methods alongside old ones
- Phase 2: Switch tests to use new methods
- Phase 3: Remove deprecated methods

---

## Task Checklist

### Session 8

| Task | Description | Status |
|------|-------------|--------|
| 8.1 | Update CodeGenResult type | ⬜ |
| 8.2 | Add builder to BaseCodeGenerator | ⬜ |
| 8.3 | Refactor label generation | ⬜ |
| 8.4 | Refactor comment generation | ⬜ |
| 8.5 | Update BasicStub | ⬜ |
| 8.6 | Update SourceMapper | ⬜ |
| 8.7 | Write base infrastructure tests | ⬜ |

### Session 9

| Task | Description | Status |
|------|-------------|--------|
| 9.1 | Refactor load instructions | ⬜ |
| 9.2 | Refactor store instructions | ⬜ |
| 9.3 | Refactor arithmetic instructions | ⬜ |
| 9.4 | Refactor branch/jump instructions | ⬜ |
| 9.5 | Refactor all other instructions | ⬜ |
| 9.6 | Refactor GlobalsGenerator | ⬜ |
| 9.7 | Update CodeGenerator.generate() | ⬜ |
| 9.8 | Add backward compatibility helpers | ⬜ |
| 9.9 | Update existing tests | ⬜ |
| 9.10 | Write integration tests | ⬜ |