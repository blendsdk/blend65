# Shared Test Helpers

> **Document**: 11-shared-helpers.md
> **Parent**: [Index](00-index.md)

## Overview

Shared test helper utilities that reduce duplication across test files. These helpers provide common functionality for IL generation, optimization, and verification.

## Helper Files

### File 1: `il/helpers/il-test-utils.ts`

**Purpose**: Common utilities for IL Generator tests

**Functions**:

```typescript
/**
 * IL Generator Test Utilities
 * Shared helpers for IL generation tests
 */

import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import { SemanticAnalyzer } from '../../../semantic/index.js';
import { ILGenerator, ILOpcode } from '../../../il/index.js';
import type { ILProgram, ILFunction, ILInstruction } from '../../../il/structures.js';

/**
 * Compiles source code to IL program through the full pipeline.
 * @param source - Blend source code
 * @param filename - Optional filename for error reporting
 * @returns IL program
 * @throws Error if compilation fails
 */
export function compileToIL(source: string, filename = 'test.blend'): ILProgram {
  const lexer = new Lexer(source, filename);
  const tokens = lexer.tokenize();

  const parser = new Parser(tokens, { filename });
  const ast = parser.parse();

  const semanticAnalyzer = new SemanticAnalyzer({
    runFrameAllocation: true,
    runAdvancedAnalysis: false,
  });
  const analysisResult = semanticAnalyzer.analyze(ast);

  const errors = analysisResult.diagnostics.filter(d => d.severity === 0);
  if (errors.length > 0) {
    throw new Error(`Semantic errors: ${errors.map(e => e.message).join(', ')}`);
  }

  if (!analysisResult.frameMap) {
    throw new Error('Frame allocation failed');
  }

  const ilGenerator = new ILGenerator(analysisResult.frameMap, analysisResult.symbolTable);
  return ilGenerator.generate(ast);
}

/**
 * Counts occurrences of a specific opcode in an instruction list.
 */
export function countOpcode(instructions: ILInstruction[], opcode: ILOpcode): number {
  return instructions.filter(i => i.opcode === opcode).length;
}

/**
 * Checks if an instruction list contains a specific opcode.
 */
export function hasOpcode(instructions: ILInstruction[], opcode: ILOpcode): boolean {
  return instructions.some(i => i.opcode === opcode);
}

/**
 * Finds all instructions with a specific opcode.
 */
export function findInstructions(instructions: ILInstruction[], opcode: ILOpcode): ILInstruction[] {
  return instructions.filter(i => i.opcode === opcode);
}

/**
 * Gets the first instruction with a specific opcode.
 */
export function getFirstInstruction(instructions: ILInstruction[], opcode: ILOpcode): ILInstruction | undefined {
  return instructions.find(i => i.opcode === opcode);
}

/**
 * Gets the immediate operand value from an instruction.
 */
export function getOperandValue(instruction: ILInstruction): number | undefined {
  if (instruction.operands.length > 0 && instruction.operands[0].type === 'immediate') {
    return instruction.operands[0].value;
  }
  return undefined;
}

/**
 * Gets a function by name from an IL program.
 */
export function getFunction(program: ILProgram, name: string): ILFunction | undefined {
  return program.functions.find(f => f.name === name);
}

/**
 * Verifies that an opcode does NOT appear in instructions.
 */
export function verifyNoOpcode(instructions: ILInstruction[], opcode: ILOpcode): void {
  const found = instructions.find(i => i.opcode === opcode);
  if (found) {
    throw new Error(`Unexpected opcode ${ILOpcode[opcode]} found`);
  }
}

/**
 * Generates a simple Blend module wrapper.
 */
export function wrapInModule(body: string, moduleName = 'Test'): string {
  return `module ${moduleName};\n${body}`;
}

/**
 * Generates a simple function wrapper.
 */
export function wrapInFunction(body: string, fnName = 'main', returnType = 'void'): string {
  return `function ${fnName}(): ${returnType} {\n${body}\n}`;
}
```

---

### File 2: `optimizer/helpers/optimizer-test-utils.ts`

**Purpose**: Common utilities for IL Optimizer tests

**Functions**:

```typescript
/**
 * IL Optimizer Test Utilities
 * Shared helpers for optimization tests
 */

import { ILOptimizer } from '../../../optimizer/index.js';
import { ILOpcode } from '../../../il/enums.js';
import type { ILFunction, ILProgram, ILInstruction } from '../../../il/structures.js';
import type { OptimizationResult, OptimizationLevel } from '../../../optimizer/types.js';
import { SlotKind, SlotLocation } from '../../../frame/enums.js';
import type { FrameSlot } from '../../../frame/types.js';
import { Frame } from '../../../frame/allocator/frame-calculator.js';
import {
  createSlotOperand,
  createImmediateOperand,
} from '../../../il/factories.js';

// Re-export IL helpers
export { compileToIL, countOpcode, hasOpcode, findInstructions, getFunction } from '../../il/helpers/il-test-utils.js';

/**
 * Compiles and optimizes source code.
 */
export function compileAndOptimize(
  source: string,
  level: OptimizationLevel = 'O2'
): { program: ILProgram; stats: OptimizationResult } {
  // Import here to avoid circular dependency
  const { compileToIL } = require('../../il/helpers/il-test-utils.js');
  
  const program = compileToIL(source);
  const optimizer = new ILOptimizer({ level });
  optimizer.optimizeProgram(program);
  
  return {
    program,
    stats: optimizer.getProgramResult()!,
  };
}

/**
 * Creates a test frame slot.
 */
export function createTestSlot(name: string, kind = SlotKind.Variable): FrameSlot {
  return {
    name,
    kind,
    location: SlotLocation.ZeroPage,
    address: 0x10,
    size: 1,
    accessCount: 0,
    maxLoopDepth: 0,
    isSingleDef: false,
    canPromoteToZP: false,
  };
}

/**
 * Creates a mock frame for testing.
 */
export function createMockFrame(name = 'test'): Frame {
  return {
    name,
    slots: [],
    isExported: false,
    isCallback: false,
    zpUsed: 0,
    ramUsed: 0,
    maxZpAvailable: 64,
    maxRamAvailable: 256,
    coalesceGroup: 0,
  } as Frame;
}

/**
 * Creates a test IL function.
 */
export function createTestILFunction(
  name: string,
  instructions: ILInstruction[],
  isExported = false
): ILFunction {
  return {
    name,
    frame: createMockFrame(name),
    instructions,
    isExported,
    isCallback: false,
    loops: [],
    maxLoopDepth: 0,
  };
}

/**
 * Creates a test IL program.
 */
export function createTestILProgram(functions: ILFunction[], entryPoint = 'main'): ILProgram {
  return {
    moduleName: 'test',
    functions,
    globalInit: [],
    entryPoint,
    instructionCount: functions.reduce((sum, f) => sum + f.instructions.length, 0),
    totalEstimatedCycles: 0,
  };
}

// ============================================================================
// Instruction Creation Helpers
// ============================================================================

export function createLoadImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

export function createStoreByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.STORE_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [] },
  };
}

export function createLoadByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.LOAD_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [slotName] },
  };
}

export function createAddImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.ADD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

export function createSubImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.SUB_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

export function createAndImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.AND_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

export function createOrImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.OR_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

export function createReturnInstr(): ILInstruction {
  return {
    opcode: ILOpcode.RETURN,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

// ============================================================================
// Large Code Generation Helpers
// ============================================================================

/**
 * Generates a function with many instructions.
 */
export function generateLargeFunction(instructionCount: number): ILFunction {
  const instructions: ILInstruction[] = [];
  
  for (let i = 0; i < instructionCount; i++) {
    if (i % 3 === 0) {
      instructions.push(createLoadImmInstr(i % 256));
    } else if (i % 3 === 1) {
      instructions.push(createAddImmInstr(1));
    } else {
      instructions.push(createStoreByteInstr(`v${i % 10}`));
    }
  }
  instructions.push(createReturnInstr());
  
  return createTestILFunction('largeFunc', instructions);
}

/**
 * Generates a function with many dead code opportunities.
 */
export function generateManyDeadCodeOpportunities(count: number): ILFunction {
  const instructions: ILInstruction[] = [];
  
  for (let i = 0; i < count; i++) {
    instructions.push(createLoadImmInstr(i % 256));
    instructions.push(createStoreByteInstr(`dead${i}`));
  }
  instructions.push(createReturnInstr());
  
  return createTestILFunction('deadCode', instructions);
}

/**
 * Generates a function with many constant fold opportunities.
 */
export function generateManyConstantFoldOpportunities(count: number): ILFunction {
  const instructions: ILInstruction[] = [];
  
  for (let i = 0; i < count; i++) {
    instructions.push(createLoadImmInstr(i % 128));
    instructions.push(createAddImmInstr((i + 1) % 128));
  }
  instructions.push(createReturnInstr());
  
  return createTestILFunction('constantFold', instructions);
}

/**
 * Generates a function with many identity operations (peephole opportunities).
 */
export function generateManyIdentityOpportunities(count: number): ILFunction {
  const instructions: ILInstruction[] = [createLoadImmInstr(1)];
  
  for (let i = 0; i < count; i++) {
    instructions.push(createAddImmInstr(0)); // Identity: x + 0 = x
  }
  instructions.push(createReturnInstr());
  
  return createTestILFunction('identity', instructions);
}

// ============================================================================
// Verification Helpers
// ============================================================================

/**
 * Verifies optimization statistics.
 */
export function verifyOptimizationStats(
  stats: OptimizationResult,
  expectations: {
    modified?: boolean;
    minRemoved?: number;
    maxRemoved?: number;
  }
): void {
  if (expectations.modified !== undefined) {
    expect(stats.modified).toBe(expectations.modified);
  }
  if (expectations.minRemoved !== undefined) {
    expect(stats.totalInstructionsRemoved).toBeGreaterThanOrEqual(expectations.minRemoved);
  }
  if (expectations.maxRemoved !== undefined) {
    expect(stats.totalInstructionsRemoved).toBeLessThanOrEqual(expectations.maxRemoved);
  }
}
```

---

## Helper Index Files

### `il/helpers/index.ts`

```typescript
export * from './il-test-utils.js';
```

### `optimizer/helpers/index.ts`

```typescript
export * from './optimizer-test-utils.js';
```

---

## Usage Examples

### In IL Generator Tests

```typescript
import { 
  compileToIL, 
  countOpcode, 
  hasOpcode, 
  getFunction,
  wrapInModule,
  wrapInFunction 
} from '../../helpers/il-test-utils.js';
import { ILOpcode } from '../../../../il/enums.js';

describe('Game Loop IL Generation', () => {
  it('should generate CALL for function invocation', () => {
    const source = wrapInModule(
      wrapInFunction('update();') + 
      '\nfunction update(): void {}'
    );
    
    const program = compileToIL(source);
    const main = getFunction(program, 'main');
    
    expect(hasOpcode(main!.instructions, ILOpcode.CALL)).toBe(true);
    expect(countOpcode(main!.instructions, ILOpcode.CALL)).toBe(1);
  });
});
```

### In Optimizer Tests

```typescript
import { 
  compileAndOptimize,
  createTestILFunction,
  createLoadImmInstr,
  createAddImmInstr,
  createReturnInstr,
  generateManyIdentityOpportunities 
} from '../../helpers/optimizer-test-utils.js';
import { ILOptimizer } from '../../../../optimizer/index.js';
import { ILOpcode } from '../../../../il/enums.js';

describe('Peephole Optimization', () => {
  it('should remove identity operations', () => {
    const func = createTestILFunction('test', [
      createLoadImmInstr(5),
      createAddImmInstr(0),  // Identity
      createReturnInstr(),
    ]);
    
    const optimizer = new ILOptimizer({ level: 'O2' });
    optimizer.optimizeFunction(func);
    
    // ADD 0 should be removed
    expect(func.instructions).toHaveLength(2);
  });
  
  it('should handle many identity opportunities', () => {
    const func = generateManyIdentityOpportunities(100);
    
    const optimizer = new ILOptimizer({ level: 'O2' });
    optimizer.optimizeFunction(func);
    
    // All 100 ADD 0 should be removed
    expect(func.instructions).toHaveLength(2); // LOAD_IMM + RETURN
  });
});
```

## Benefits of Shared Helpers

| Benefit | Description |
|---------|-------------|
| Reduced duplication | Common code in one place |
| Consistency | Same patterns everywhere |
| Maintainability | Fix once, fixed everywhere |
| Clarity | Tests focus on verification, not setup |
| Discoverability | Helpers document common patterns |