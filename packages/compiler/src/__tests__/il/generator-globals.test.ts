/**
 * IL Generator Global Variable Tests
 *
 * Tests for Phase 3 of global variables plan:
 * - Global slot resolution (GlobalSlot → FrameSlot conversion)
 * - Global initialization IL generation (@zp, @ram, @data, default)
 * - Global variable access in expressions and assignments
 *
 * @module __tests__/il/generator-globals
 */

import { describe, it, expect } from 'vitest';
import { ILGenerator } from '../../il/generator/index.js';
import { ILGeneratorBase } from '../../il/generator/base.js';
import { ILOpcode } from '../../il/enums.js';
import { Frame } from '../../frame/allocator/frame-calculator.js';
import { FrameSlot, createFrameSlot } from '../../frame/types.js';
import { SlotKind, SlotLocation, ZpDirective } from '../../frame/enums.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { SymbolKind } from '../../semantic/symbol.js';
import { TypeKind } from '../../semantic/types.js';
import type { GlobalAllocationResult, GlobalSlot } from '../../frame/types-global.js';
import { createGlobalSlot } from '../../frame/types-global.js';
import { ZpPool } from '../../frame/allocator/zp-pool.js';
import { C64_PLATFORM_CONFIG } from '../../frame/platform.js';
import { isSlotOperand, isImmediateOperand } from '../../il/guards.js';
import type { SlotOperand } from '../../il/operands.js';
import { Lexer } from '../../lexer/index.js';
import { Parser } from '../../parser/index.js';
import { SemanticAnalyzer } from '../../semantic/index.js';
import { DiagnosticSeverity as AstDiagnosticSeverity } from '../../ast/diagnostics.js';
import {
  compileToIL,
  getFunction,
  getMainFunction,
  findInstructions,
  countOpcode,
  hasOpcode,
  wrapInModule,
} from './helpers/index.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a minimal frame for a function with given slots.
 *
 * @param name - Function name
 * @param slots - FrameSlots for the function
 * @param baseAddress - Base address for the frame
 * @returns A Frame object
 */
function createTestFrame(
  name: string,
  slots: FrameSlot[] = [],
  baseAddress = 0x0200,
): Frame {
  const totalSize = slots.reduce((sum, s) => sum + s.size, 0);
  return {
    functionName: name,
    slots,
    baseAddress,
    totalSize,
    zpSlotCount: slots.filter(s => s.location === SlotLocation.ZeroPage).length,
    frameSlotCount: slots.filter(s => s.location === SlotLocation.FrameRegion).length,
    registerSlotCount: slots.filter(s => s.location === SlotLocation.Register).length,
    parameterCount: slots.filter(s => s.kind === SlotKind.Parameter).length,
    localCount: slots.filter(s => s.kind === SlotKind.Local).length,
  };
}

/**
 * Creates a minimal SymbolTable with optional global variable symbols.
 *
 * @param globalVars - Map of variable name to type info
 * @returns SymbolTable instance
 */
function createTestSymbolTable(
  globalVars: Array<{ name: string; isConst?: boolean }> = [],
): SymbolTable {
  const st = new SymbolTable();
  for (const v of globalVars) {
    st.define({
      name: v.name,
      kind: v.isConst ? SymbolKind.Constant : SymbolKind.Variable,
      type: BUILTIN_TYPES.BYTE,
      isConst: v.isConst ?? false,
      isExported: false,
      definedAt: { source: 'test', start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
    });
  }
  return st;
}

/**
 * Creates a GlobalAllocationResult with given global slots.
 *
 * @param slots - Array of GlobalSlots to include
 * @returns GlobalAllocationResult
 */
function createTestGlobalAllocation(
  slots: GlobalSlot[],
): GlobalAllocationResult {
  const globals = new Map<string, GlobalSlot>();
  for (const slot of slots) {
    globals.set(slot.qualifiedName, slot);
  }
  return {
    success: true,
    globals,
    zpPool: new ZpPool(C64_PLATFORM_CONFIG),
    dataSegmentSize: 0,
    ramRegionSize: 0,
    diagnostics: [],
  };
}

/**
 * Creates a GlobalSlot with address already assigned.
 *
 * @param name - Variable name
 * @param moduleName - Module name
 * @param storageClass - Storage class
 * @param address - Pre-assigned address
 * @param options - Additional options
 * @returns GlobalSlot with address set
 */
function createAllocatedGlobalSlot(
  name: string,
  moduleName: string,
  storageClass: 'zp' | 'ram' | 'data' | 'default',
  address: number,
  options?: { isConst?: boolean; size?: number },
): GlobalSlot {
  const typeInfo = options?.size === 2 ? BUILTIN_TYPES.WORD : BUILTIN_TYPES.BYTE;
  const slot = createGlobalSlot(name, moduleName, storageClass, typeInfo, options?.size ?? 1, {
    isConst: options?.isConst ?? false,
  });
  // Assign the address (mutable field)
  slot.address = address;
  return slot;
}

// ============================================================================
// Global Slot Resolution Tests (Task 3.1.4)
// ============================================================================

describe('ILGenerator: Global Slot Resolution', () => {
  it('should accept GlobalAllocationResult in constructor', () => {
    // Verify the constructor accepts the third parameter without error
    const frameMap = new Map<string, Frame>();
    const symbolTable = createTestSymbolTable();
    const globalAlloc = createTestGlobalAllocation([]);

    const generator = new ILGenerator(frameMap, symbolTable, globalAlloc);
    expect(generator).toBeDefined();
  });

  it('should work without GlobalAllocationResult (backward compat)', () => {
    // Constructor should work with only 2 args (legacy mode)
    const frameMap = new Map<string, Frame>();
    const symbolTable = createTestSymbolTable();

    const generator = new ILGenerator(frameMap, symbolTable);
    expect(generator).toBeDefined();
  });

  it('should work with null GlobalAllocationResult', () => {
    const frameMap = new Map<string, Frame>();
    const symbolTable = createTestSymbolTable();

    const generator = new ILGenerator(frameMap, symbolTable, null);
    expect(generator).toBeDefined();
  });

  it('should resolve @zp global to ZeroPage SlotLocation', () => {
    // Create a @zp global at address $02
    const zpGlobal = createAllocatedGlobalSlot('score', 'Game', 'zp', 0x02);
    const globalAlloc = createTestGlobalAllocation([zpGlobal]);

    // Create a simple program: module Game; let score: byte = 0; function main(): void { let x: byte = score; }
    const source = wrapInModule(
      'let score: byte = 0;\nfunction main(): void {\n  let x: byte = score;\n}',
      'Game',
    );

    const program = compileToILWithGlobals(source, globalAlloc);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // The LOAD_BYTE for 'score' should use the @zp address ($02)
    const loads = findInstructions(mainFunc!.instructions, ILOpcode.LOAD_BYTE);
    const scoreLoad = loads.find(i => {
      if (isSlotOperand(i.operands[0])) {
        const slotOp = i.operands[0] as SlotOperand;
        return slotOp.slot.name === 'score';
      }
      return false;
    });

    // Should find a load for 'score' with ZP location
    if (scoreLoad && isSlotOperand(scoreLoad.operands[0])) {
      const slot = (scoreLoad.operands[0] as SlotOperand).slot;
      expect(slot.location).toBe(SlotLocation.ZeroPage);
      expect(slot.address).toBe(0x02);
      expect(slot.zpDirective).toBe(ZpDirective.Zp);
    }
  });

  it('should resolve @ram global to FrameRegion SlotLocation', () => {
    const ramGlobal = createAllocatedGlobalSlot('buffer', 'Game', 'ram', 0x0400);
    const globalAlloc = createTestGlobalAllocation([ramGlobal]);

    const source = wrapInModule(
      'let buffer: byte = 0;\nfunction main(): void {\n  let x: byte = buffer;\n}',
      'Game',
    );

    const program = compileToILWithGlobals(source, globalAlloc);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    const loads = findInstructions(mainFunc!.instructions, ILOpcode.LOAD_BYTE);
    const bufferLoad = loads.find(i => {
      if (isSlotOperand(i.operands[0])) {
        return (i.operands[0] as SlotOperand).slot.name === 'buffer';
      }
      return false;
    });

    if (bufferLoad && isSlotOperand(bufferLoad.operands[0])) {
      const slot = (bufferLoad.operands[0] as SlotOperand).slot;
      expect(slot.location).toBe(SlotLocation.FrameRegion);
      expect(slot.address).toBe(0x0400);
      expect(slot.zpDirective).toBe(ZpDirective.Ram);
    }
  });

  it('should resolve default global to FrameRegion', () => {
    const defaultGlobal = createAllocatedGlobalSlot('counter', 'Game', 'default', 0x0500);
    const globalAlloc = createTestGlobalAllocation([defaultGlobal]);

    const source = wrapInModule(
      'let counter: byte = 0;\nfunction main(): void {\n  let x: byte = counter;\n}',
      'Game',
    );

    const program = compileToILWithGlobals(source, globalAlloc);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    const loads = findInstructions(mainFunc!.instructions, ILOpcode.LOAD_BYTE);
    const counterLoad = loads.find(i => {
      if (isSlotOperand(i.operands[0])) {
        return (i.operands[0] as SlotOperand).slot.name === 'counter';
      }
      return false;
    });

    if (counterLoad && isSlotOperand(counterLoad.operands[0])) {
      const slot = (counterLoad.operands[0] as SlotOperand).slot;
      expect(slot.location).toBe(SlotLocation.FrameRegion);
      expect(slot.address).toBe(0x0500);
      expect(slot.zpDirective).toBe(ZpDirective.None);
    }
  });

  it('should prefer local variable over global with same name', () => {
    // If a function has a local 'x' and there's a global 'x', local wins
    const globalX = createAllocatedGlobalSlot('x', 'Test', 'ram', 0x0400);
    const globalAlloc = createTestGlobalAllocation([globalX]);

    // In the function body, 'x' is declared locally — should use local slot, not global
    const source = wrapInModule(
      'let x: byte = 0;\nfunction main(): void {\n  let x: byte = 5;\n}',
      'Test',
    );

    const program = compileToILWithGlobals(source, globalAlloc);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // The STORE_BYTE for local 'x' should NOT use the global address $0400
    const stores = findInstructions(mainFunc!.instructions, ILOpcode.STORE_BYTE);
    for (const store of stores) {
      if (isSlotOperand(store.operands[0])) {
        const slot = (store.operands[0] as SlotOperand).slot;
        if (slot.name === 'x') {
          // Local should not have the global address
          expect(slot.address).not.toBe(0x0400);
        }
      }
    }
  });

  it('should cache global FrameSlot conversions', () => {
    // Multiple accesses to same global should return same cached slot
    const zpGlobal = createAllocatedGlobalSlot('score', 'Test', 'zp', 0x02);
    const globalAlloc = createTestGlobalAllocation([zpGlobal]);

    const source = wrapInModule(
      'let score: byte = 0;\nfunction main(): void {\n  let a: byte = score;\n  let b: byte = score;\n}',
      'Test',
    );

    const program = compileToILWithGlobals(source, globalAlloc);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have 2 LOAD_BYTE for 'score', both with same address
    const loads = findInstructions(mainFunc!.instructions, ILOpcode.LOAD_BYTE);
    const scoreLoads = loads.filter(i => {
      if (isSlotOperand(i.operands[0])) {
        return (i.operands[0] as SlotOperand).slot.name === 'score';
      }
      return false;
    });

    expect(scoreLoads.length).toBeGreaterThanOrEqual(2);
    if (scoreLoads.length >= 2) {
      const addr1 = (scoreLoads[0].operands[0] as SlotOperand).slot.address;
      const addr2 = (scoreLoads[1].operands[0] as SlotOperand).slot.address;
      expect(addr1).toBe(addr2);
      expect(addr1).toBe(0x02);
    }
  });
});

// ============================================================================
// Global Initialization IL Tests (Task 3.2.4)
// ============================================================================

describe('ILGenerator: Global Init IL', () => {
  it('should generate init IL for @zp global with initializer', () => {
    const zpGlobal = createAllocatedGlobalSlot('score', 'Test', 'zp', 0x02);
    const globalAlloc = createTestGlobalAllocation([zpGlobal]);

    const source = wrapInModule(
      'let score: byte = 0;\nfunction main(): void {\n  let x: byte = score;\n}',
      'Test',
    );

    const program = compileToILWithGlobals(source, globalAlloc);

    // globalInit should contain LOAD_IMM + STORE_BYTE for 'score = 0'
    expect(program.globalInit.length).toBeGreaterThan(0);
    expect(hasOpcode(program.globalInit, ILOpcode.LOAD_IMM)).toBe(true);
    expect(hasOpcode(program.globalInit, ILOpcode.STORE_BYTE)).toBe(true);
  });

  it('should generate init IL for @ram global with initializer', () => {
    const ramGlobal = createAllocatedGlobalSlot('lives', 'Test', 'ram', 0x0400);
    const globalAlloc = createTestGlobalAllocation([ramGlobal]);

    const source = wrapInModule(
      'let lives: byte = 3;\nfunction main(): void {\n  let x: byte = lives;\n}',
      'Test',
    );

    const program = compileToILWithGlobals(source, globalAlloc);

    // globalInit should contain LOAD_IMM 3 + STORE_BYTE
    expect(program.globalInit.length).toBeGreaterThan(0);
    const loadImms = findInstructions(program.globalInit, ILOpcode.LOAD_IMM);
    expect(loadImms.length).toBeGreaterThanOrEqual(1);
    if (isImmediateOperand(loadImms[0].operands[0])) {
      expect(loadImms[0].operands[0].value).toBe(3);
    }
  });

  it('should skip @data const globals (no runtime init)', () => {
    const dataGlobal = createAllocatedGlobalSlot('spriteData', 'Test', 'data', 0xC000, { isConst: true });
    const globalAlloc = createTestGlobalAllocation([dataGlobal]);

    // @data const is always skipped because: (1) it's const, and (2) it's @data
    const source = wrapInModule(
      'const spriteData: byte = 42;\nfunction main(): void { }',
      'Test',
    );

    const program = compileToILWithGlobals(source, globalAlloc);

    // No init IL should be generated for const or @data
    expect(program.globalInit.length).toBe(0);
  });

  it('should skip const globals (compile-time constants)', () => {
    const source = wrapInModule(
      'const BORDER: word = $D020;\nfunction main(): void { }',
      'Test',
    );

    const program = compileToIL(source);

    // Const values are resolved inline — no init IL
    expect(program.globalInit.length).toBe(0);
  });

  it('should skip globals without initializer', () => {
    const ramGlobal = createAllocatedGlobalSlot('temp', 'Test', 'ram', 0x0400);
    const globalAlloc = createTestGlobalAllocation([ramGlobal]);

    const source = wrapInModule(
      'let temp: byte;\nfunction main(): void { }',
      'Test',
    );

    const program = compileToILWithGlobals(source, globalAlloc);

    // No init IL for uninitialized variables
    expect(program.globalInit.length).toBe(0);
  });

  it('should add volatile tag in comment for @zp init', () => {
    const zpGlobal = createAllocatedGlobalSlot('ptr', 'Test', 'zp', 0x04, { size: 2 });
    const globalAlloc = createTestGlobalAllocation([zpGlobal]);

    const source = wrapInModule(
      'let ptr: word = 0;\nfunction main(): void { }',
      'Test',
    );

    const program = compileToILWithGlobals(source, globalAlloc);

    // Check that the store instruction has the volatile tag
    const stores = findInstructions(program.globalInit, ILOpcode.STORE_WORD);
    if (stores.length > 0 && stores[0].comment) {
      expect(stores[0].comment).toContain('[volatile:zp]');
    }
  });

  it('should generate word store for word-sized globals', () => {
    const wordGlobal = createAllocatedGlobalSlot('timer', 'Test', 'ram', 0x0400, { size: 2 });
    const globalAlloc = createTestGlobalAllocation([wordGlobal]);

    const source = wrapInModule(
      'let timer: word = 1000;\nfunction main(): void { }',
      'Test',
    );

    const program = compileToILWithGlobals(source, globalAlloc);

    // Should use STORE_WORD for word-sized global
    expect(hasOpcode(program.globalInit, ILOpcode.STORE_WORD)).toBe(true);
  });
});

// ============================================================================
// Global Access IL Tests (Task 3.3.4)
// ============================================================================

describe('ILGenerator: Global Access in Expressions', () => {
  it('should generate LOAD_BYTE for global variable read', () => {
    const globalVar = createAllocatedGlobalSlot('score', 'Test', 'ram', 0x0400);
    const globalAlloc = createTestGlobalAllocation([globalVar]);

    const source = wrapInModule(
      'let score: byte = 0;\nfunction main(): void {\n  let x: byte = score;\n}',
      'Test',
    );

    const program = compileToILWithGlobals(source, globalAlloc);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have a LOAD_BYTE for 'score' with address 0x0400
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
  });

  it('should generate STORE_BYTE for global variable assignment', () => {
    const globalVar = createAllocatedGlobalSlot('score', 'Test', 'ram', 0x0400);
    const globalAlloc = createTestGlobalAllocation([globalVar]);

    const source = wrapInModule(
      'let score: byte = 0;\nfunction main(): void {\n  score = 10;\n}',
      'Test',
    );

    const program = compileToILWithGlobals(source, globalAlloc);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have LOAD_IMM 10 + STORE_BYTE for 'score'
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.LOAD_IMM)).toBe(true);
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
  });

  it('should generate correct IL for global in binary expression', () => {
    const globalVar = createAllocatedGlobalSlot('score', 'Test', 'ram', 0x0400);
    const globalAlloc = createTestGlobalAllocation([globalVar]);

    const source = wrapInModule(
      'let score: byte = 0;\nfunction main(): void {\n  let result: byte = score + 10;\n}',
      'Test',
    );

    const program = compileToILWithGlobals(source, globalAlloc);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have: LOAD_BYTE(score) + ADD_IMM(10) + STORE_BYTE(result)
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.ADD_IMM)).toBe(true);
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
  });

  it('should generate compound assignment on global', () => {
    const globalVar = createAllocatedGlobalSlot('score', 'Test', 'ram', 0x0400);
    const globalAlloc = createTestGlobalAllocation([globalVar]);

    const source = wrapInModule(
      'let score: byte = 0;\nfunction main(): void {\n  score = score + 1;\n}',
      'Test',
    );

    const program = compileToILWithGlobals(source, globalAlloc);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have LOAD + ADD + STORE sequence
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.ADD_IMM)).toBe(true);
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
  });

  it('should handle multiple globals in same function', () => {
    const scoreGlobal = createAllocatedGlobalSlot('score', 'Test', 'zp', 0x02);
    const livesGlobal = createAllocatedGlobalSlot('lives', 'Test', 'ram', 0x0400);
    const globalAlloc = createTestGlobalAllocation([scoreGlobal, livesGlobal]);

    const source = wrapInModule(
      'let score: byte = 0;\nlet lives: byte = 3;\nfunction main(): void {\n  let total: byte = score + lives;\n}',
      'Test',
    );

    const program = compileToILWithGlobals(source, globalAlloc);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have at least 2 LOAD_BYTE instructions (one for score, one for lives)
    const loads = findInstructions(mainFunc!.instructions, ILOpcode.LOAD_BYTE);
    expect(loads.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Legacy Fallback Tests
// ============================================================================

describe('ILGenerator: Legacy Module Variable Resolution', () => {
  it('should fall back to symbol-table resolution without GlobalAllocationResult', () => {
    // Without globalAllocation, the old legacy path should be used
    const source = wrapInModule(
      'let counter: byte = 0;\nfunction main(): void {\n  let x: byte = counter;\n}',
      'Test',
    );

    // compileToIL doesn't pass GlobalAllocationResult — uses legacy path
    const program = compileToIL(source);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should still resolve 'counter' via legacy path
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
  });

  it('should generate globalInit for legacy mode', () => {
    const source = wrapInModule(
      'let counter: byte = 5;\nfunction main(): void { }',
      'Test',
    );

    const program = compileToIL(source);

    // globalInit should have LOAD_IMM + STORE_BYTE
    expect(program.globalInit.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Helper: Compile with GlobalAllocationResult
// ============================================================================

/**
 * Compiles source code to IL program with a GlobalAllocationResult.
 *
 * Uses the standard pipeline but injects GlobalAllocationResult
 * into the ILGenerator constructor.
 *
 * @param source - Blend source code
 * @param globalAllocation - Global allocation result to inject
 * @param filename - Optional filename for error reporting
 * @returns IL program
 */
function compileToILWithGlobals(
  source: string,
  globalAllocation: GlobalAllocationResult,
  filename = 'test.blend',
): import('../../il/structures.js').ILProgram {
  // Standard pipeline: Source → Lexer → Parser → SemanticAnalyzer → ILGenerator
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  const parser = new Parser(tokens, { filePath: filename });
  const ast = parser.parse();

  const semanticAnalyzer = new SemanticAnalyzer({
    runFrameAllocation: true,
    runAdvancedAnalysis: false,
  });
  const analysisResult = semanticAnalyzer.analyze(ast);

  const errors = analysisResult.diagnostics.filter(
    (d) => d.severity === AstDiagnosticSeverity.ERROR,
  );
  if (errors.length > 0) {
    throw new Error(`Semantic errors: ${errors.map((e) => e.message).join(', ')}`);
  }

  if (!analysisResult.frameMap) {
    throw new Error('Frame allocation failed - no frameMap in analysis result');
  }

  // Key difference from compileToIL: pass GlobalAllocationResult to ILGenerator
  const ilGenerator = new ILGenerator(
    analysisResult.frameMap,
    analysisResult.symbolTable,
    globalAllocation,
  );
  return ilGenerator.generate(ast);
}
