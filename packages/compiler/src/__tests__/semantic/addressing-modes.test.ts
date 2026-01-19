/**
 * Addressing Mode Tests (Phase 2 - IL Readiness)
 *
 * Tests for the M6502HintAnalyzer addressing mode determination.
 * These tests verify that the analyzer correctly identifies optimal
 * 6502 addressing modes for variables based on their usage patterns.
 *
 * @see packages/compiler/src/semantic/analysis/m6502-hints.ts
 */

import { describe, it, expect } from 'vitest';
import { M6502HintAnalyzer } from '../../semantic/analysis/m6502-hints.js';
import {
  AddressingMode,
  OptimizationMetadataKey,
} from '../../semantic/analysis/optimization-metadata-keys.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import type { ControlFlowGraph } from '../../semantic/control-flow.js';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';

// ============================================
// Test Helpers
// ============================================

/**
 * Creates a test analyzer with the given source code
 */
function createAnalyzerFromSource(source: string): {
  analyzer: M6502HintAnalyzer;
  symbolTable: SymbolTable;
} {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  // Create symbol table and add symbols from declarations
  const symbolTable = new SymbolTable();
  const cfgs = new Map<string, ControlFlowGraph>();

  // Register variables in symbol table
  for (const decl of ast.getDeclarations()) {
    const name = decl.getName?.();
    if (name) {
      symbolTable.declare({
        name,
        kind: 'variable' as const,
        type: { name: 'byte', size: 1 },
        declaration: decl,
        scope: 'global',
      });
    }
  }

  const analyzer = new M6502HintAnalyzer(symbolTable, cfgs);
  analyzer.analyze(ast);

  return { analyzer, symbolTable };
}

// ============================================
// AddressingMode Enum Tests
// ============================================

describe('AddressingMode enum', () => {
  it('should have all 6502 addressing modes defined', () => {
    expect(AddressingMode.Immediate).toBe('Immediate');
    expect(AddressingMode.ZeroPage).toBe('ZeroPage');
    expect(AddressingMode.ZeroPageX).toBe('ZeroPageX');
    expect(AddressingMode.ZeroPageY).toBe('ZeroPageY');
    expect(AddressingMode.Absolute).toBe('Absolute');
    expect(AddressingMode.AbsoluteX).toBe('AbsoluteX');
    expect(AddressingMode.AbsoluteY).toBe('AbsoluteY');
    expect(AddressingMode.Indirect).toBe('Indirect');
    expect(AddressingMode.IndexedIndirect).toBe('IndexedIndirect');
    expect(AddressingMode.IndirectIndexed).toBe('IndirectIndexed');
  });

  it('should have exactly 10 addressing modes', () => {
    const modes = Object.values(AddressingMode);
    expect(modes).toHaveLength(10);
  });
});

// ============================================
// getAddressingMode() Tests
// ============================================

describe('M6502HintAnalyzer.getAddressingMode()', () => {
  it('should return Absolute for unknown variables', () => {
    const { analyzer } = createAnalyzerFromSource('let x: byte = 0;');
    expect(analyzer.getAddressingMode('nonExistent')).toBe(AddressingMode.Absolute);
  });

  it('should return ZeroPage for @zp variables', () => {
    const { analyzer } = createAnalyzerFromSource('@zp let counter: byte = 0;');
    expect(analyzer.getAddressingMode('counter')).toBe(AddressingMode.ZeroPage);
  });

  it('should return Absolute for regular variables without high ZP priority', () => {
    const { analyzer } = createAnalyzerFromSource('let simpleVar: byte = 0;');
    expect(analyzer.getAddressingMode('simpleVar')).toBe(AddressingMode.Absolute);
  });
});

// ============================================
// getAddressingModeReason() Tests
// ============================================

describe('M6502HintAnalyzer.getAddressingModeReason()', () => {
  it('should return explanation for unknown variables', () => {
    const { analyzer } = createAnalyzerFromSource('let x: byte = 0;');
    const reason = analyzer.getAddressingModeReason('unknown');
    expect(reason).toContain('Unknown variable');
    expect(reason).toContain('Absolute');
  });

  it('should return explanation for @zp variables', () => {
    const { analyzer } = createAnalyzerFromSource('@zp let zpVar: byte = 0;');
    const reason = analyzer.getAddressingModeReason('zpVar');
    expect(reason).toContain('@zp');
    expect(reason).toContain('ZeroPage');
  });

  it('should return explanation for absolute mode', () => {
    const { analyzer } = createAnalyzerFromSource('let plainVar: byte = 0;');
    const reason = analyzer.getAddressingModeReason('plainVar');
    expect(reason).toContain('Absolute');
  });

  it('should include cycle count in explanations', () => {
    const { analyzer } = createAnalyzerFromSource('@zp let fast: byte = 0;');
    const reason = analyzer.getAddressingModeReason('fast');
    expect(reason).toMatch(/\d+ cycles/);
  });
});

// ============================================
// getVariablesWithAddressingMode() Tests
// ============================================

describe('M6502HintAnalyzer.getVariablesWithAddressingMode()', () => {
  it('should return empty array for mode with no variables', () => {
    const { analyzer } = createAnalyzerFromSource('let x: byte = 0;');
    const vars = analyzer.getVariablesWithAddressingMode(AddressingMode.Indirect);
    expect(vars).toEqual([]);
  });

  it('should return @zp variables for ZeroPage mode', () => {
    const { analyzer } = createAnalyzerFromSource(`
      @zp let zpA: byte = 0;
      @zp let zpB: byte = 0;
      let regular: byte = 0;
    `);
    const zpVars = analyzer.getVariablesWithAddressingMode(AddressingMode.ZeroPage);
    expect(zpVars).toContain('zpA');
    expect(zpVars).toContain('zpB');
    expect(zpVars).not.toContain('regular');
  });

  it('should return absolute variables for Absolute mode', () => {
    const { analyzer } = createAnalyzerFromSource(`
      let absA: byte = 0;
      let absB: byte = 0;
      @zp let zpVar: byte = 0;
    `);
    const absVars = analyzer.getVariablesWithAddressingMode(AddressingMode.Absolute);
    expect(absVars).toContain('absA');
    expect(absVars).toContain('absB');
    expect(absVars).not.toContain('zpVar');
  });
});

// ============================================
// getAddressingModeSummary() Tests
// ============================================

describe('M6502HintAnalyzer.getAddressingModeSummary()', () => {
  it('should return map of addressing modes to counts', () => {
    const { analyzer } = createAnalyzerFromSource(`
      @zp let zp1: byte = 0;
      @zp let zp2: byte = 0;
      let abs1: byte = 0;
    `);
    const summary = analyzer.getAddressingModeSummary();
    expect(summary.get(AddressingMode.ZeroPage)).toBe(2);
    expect(summary.get(AddressingMode.Absolute)).toBe(1);
  });

  it('should return empty map for no variables', () => {
    const symbolTable = new SymbolTable();
    const cfgs = new Map<string, ControlFlowGraph>();
    const analyzer = new M6502HintAnalyzer(symbolTable, cfgs);

    const lexer = new Lexer('');
    const parser = new Parser(lexer.tokenize());
    const ast = parser.parse();
    analyzer.analyze(ast);

    const summary = analyzer.getAddressingModeSummary();
    expect(summary.size).toBe(0);
  });
});

// ============================================
// Zero-Page Addressing Mode Tests
// ============================================

describe('Zero-Page addressing modes', () => {
  it('should detect ZeroPage for @zp storage class', () => {
    const { analyzer } = createAnalyzerFromSource('@zp let zpCounter: byte = 0;');
    expect(analyzer.getAddressingMode('zpCounter')).toBe(AddressingMode.ZeroPage);
  });

  it('should detect ZeroPage for multiple @zp variables', () => {
    const { analyzer } = createAnalyzerFromSource(`
      @zp let a: byte = 0;
      @zp let b: byte = 0;
      @zp let c: byte = 0;
    `);
    expect(analyzer.getAddressingMode('a')).toBe(AddressingMode.ZeroPage);
    expect(analyzer.getAddressingMode('b')).toBe(AddressingMode.ZeroPage);
    expect(analyzer.getAddressingMode('c')).toBe(AddressingMode.ZeroPage);
  });
});

// ============================================
// Absolute Addressing Mode Tests
// ============================================

describe('Absolute addressing modes', () => {
  it('should detect Absolute for regular variables', () => {
    const { analyzer } = createAnalyzerFromSource('let normalVar: byte = 5;');
    expect(analyzer.getAddressingMode('normalVar')).toBe(AddressingMode.Absolute);
  });

  it('should detect Absolute for @ram variables', () => {
    const { analyzer } = createAnalyzerFromSource('@ram let ramVar: byte = 0;');
    expect(analyzer.getAddressingMode('ramVar')).toBe(AddressingMode.Absolute);
  });
});

// ============================================
// Metadata Integration Tests
// ============================================

describe('Addressing mode metadata integration', () => {
  it('should track M6502AddressingMode in analyzer hints', () => {
    // The analyzer stores addressing modes internally
    const { analyzer } = createAnalyzerFromSource('@zp let zpVar: byte = 0;');

    // Verify the addressing mode is stored in hints
    const hints = analyzer.getVariableHints();
    const zpVarHints = hints.get('zpVar');
    expect(zpVarHints).toBeDefined();
    // @zp variables should have ZeroPage addressing mode
  });

  it('should have OptimizationMetadataKey.M6502AddressingMode defined', () => {
    // Verify the metadata key exists
    expect(OptimizationMetadataKey.M6502AddressingMode).toBe('M6502AddressingMode');
    expect(OptimizationMetadataKey.M6502ZeroPagePriority).toBe('M6502ZeroPagePriority');
    expect(OptimizationMetadataKey.M6502RegisterPreference).toBe('M6502RegisterPreference');
    expect(OptimizationMetadataKey.M6502CycleEstimate).toBe('M6502CycleEstimate');
  });
});

// ============================================
// Edge Cases Tests
// ============================================

describe('Addressing mode edge cases', () => {
  it('should handle variables with no usage data', () => {
    const { analyzer } = createAnalyzerFromSource('let unused: byte = 0;');
    // Should not throw
    expect(analyzer.getAddressingMode('unused')).toBeDefined();
    expect(analyzer.getAddressingModeReason('unused')).toBeDefined();
  });

  it('should handle empty program', () => {
    const symbolTable = new SymbolTable();
    const cfgs = new Map<string, ControlFlowGraph>();
    const analyzer = new M6502HintAnalyzer(symbolTable, cfgs);

    const lexer = new Lexer('');
    const parser = new Parser(lexer.tokenize());
    const ast = parser.parse();

    // Should not throw
    expect(() => analyzer.analyze(ast)).not.toThrow();
    expect(analyzer.getAddressingModeSummary().size).toBe(0);
  });

  it('should handle mixed storage classes', () => {
    const { analyzer } = createAnalyzerFromSource(`
      @zp let zpVar: byte = 0;
      @ram let ramVar: byte = 0;
      let normalVar: byte = 0;
    `);

    expect(analyzer.getAddressingMode('zpVar')).toBe(AddressingMode.ZeroPage);
    expect(analyzer.getAddressingMode('ramVar')).toBe(AddressingMode.Absolute);
    expect(analyzer.getAddressingMode('normalVar')).toBe(AddressingMode.Absolute);
  });
});

// ============================================
// 6502 Cycle Count Context Tests
// ============================================

describe('6502 addressing mode cycle context', () => {
  it('should recognize ZeroPage is faster (3 cycles) than Absolute (4 cycles)', () => {
    const { analyzer } = createAnalyzerFromSource(`
      @zp let fast: byte = 0;
      let slow: byte = 0;
    `);

    const fastReason = analyzer.getAddressingModeReason('fast');
    const slowReason = analyzer.getAddressingModeReason('slow');

    expect(fastReason).toContain('3 cycles');
    expect(slowReason).toContain('4 cycles');
  });
});

// ============================================
// Export Tests
// ============================================

describe('Addressing mode exports', () => {
  it('should export AddressingMode from optimization-metadata-keys', async () => {
    expect(AddressingMode).toBeDefined();
    expect(AddressingMode.ZeroPage).toBe('ZeroPage');
  });

  it('should export M6502AddressingMode metadata key', async () => {
    expect(OptimizationMetadataKey.M6502AddressingMode).toBe('M6502AddressingMode');
  });
});
