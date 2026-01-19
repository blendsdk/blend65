/**
 * Target Analyzer Registry Tests
 *
 * Tests for Phase B.3 - Target analyzer factory and registry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createHardwareAnalyzer,
  createHardwareAnalyzerFromConfig,
  getDefaultHardwareAnalyzer,
  isHardwareAnalyzerAvailable,
  getTargetsWithAnalyzers,
  getHardwareAnalyzer,
  NoAnalyzerForTargetError,
} from '../../../../semantic/analysis/hardware/target-analyzer-registry.js';
import { BaseHardwareAnalyzer } from '../../../../semantic/analysis/hardware/base-hardware-analyzer.js';
import { C64HardwareAnalyzer } from '../../../../semantic/analysis/hardware/c64/c64-hardware-analyzer.js';
import { TargetArchitecture, getTargetConfig } from '../../../../target/index.js';
import { SymbolTable } from '../../../../semantic/symbol-table.js';
import type { ControlFlowGraph } from '../../../../semantic/control-flow.js';

describe('Target Analyzer Registry', () => {
  let symbolTable: SymbolTable;
  let cfgs: Map<string, ControlFlowGraph>;

  beforeEach(() => {
    // Create minimal test fixtures
    symbolTable = new SymbolTable();
    cfgs = new Map();
  });

  describe('createHardwareAnalyzer', () => {
    it('should create C64 hardware analyzer', () => {
      const analyzer = createHardwareAnalyzer(
        TargetArchitecture.C64,
        symbolTable,
        cfgs
      );

      expect(analyzer).toBeInstanceOf(BaseHardwareAnalyzer);
      expect(analyzer).toBeInstanceOf(C64HardwareAnalyzer);
      expect(analyzer.getTargetName()).toBe('Commodore 64');
    });

    it('should create C128 hardware analyzer (placeholder)', () => {
      const analyzer = createHardwareAnalyzer(
        TargetArchitecture.C128,
        symbolTable,
        cfgs
      );

      expect(analyzer).toBeInstanceOf(BaseHardwareAnalyzer);
      // Placeholder returns name with "(Not Implemented)" suffix
      expect(analyzer.getTargetName()).toBe('Commodore 128 (Not Implemented)');
    });

    it('should create X16 hardware analyzer (placeholder)', () => {
      const analyzer = createHardwareAnalyzer(
        TargetArchitecture.X16,
        symbolTable,
        cfgs
      );

      expect(analyzer).toBeInstanceOf(BaseHardwareAnalyzer);
      // Placeholder returns name with "(Not Implemented)" suffix
      expect(analyzer.getTargetName()).toBe('Commander X16 (Not Implemented)');
    });

    it('should throw for Generic target (no analyzer available)', () => {
      // Generic target throws because there's no hardware to analyze
      expect(() =>
        createHardwareAnalyzer(TargetArchitecture.Generic, symbolTable, cfgs)
      ).toThrow();
    });

    it('should pass target config to analyzer', () => {
      const analyzer = createHardwareAnalyzer(
        TargetArchitecture.C64,
        symbolTable,
        cfgs
      );

      const config = analyzer.getTargetConfig();
      expect(config.architecture).toBe(TargetArchitecture.C64);
    });
  });

  describe('createHardwareAnalyzerFromConfig', () => {
    it('should create analyzer from C64 config', () => {
      const config = getTargetConfig(TargetArchitecture.C64);
      const analyzer = createHardwareAnalyzerFromConfig(config, symbolTable, cfgs);

      expect(analyzer).toBeInstanceOf(C64HardwareAnalyzer);
      expect(analyzer.getTargetConfig()).toBe(config);
    });

    it('should create analyzer from C128 config', () => {
      const config = getTargetConfig(TargetArchitecture.C128, true);
      const analyzer = createHardwareAnalyzerFromConfig(config, symbolTable, cfgs);

      // Placeholder returns name with "(Not Implemented)" suffix
      expect(analyzer.getTargetName()).toBe('Commodore 128 (Not Implemented)');
    });

    it('should create analyzer from X16 config', () => {
      const config = getTargetConfig(TargetArchitecture.X16, true);
      const analyzer = createHardwareAnalyzerFromConfig(config, symbolTable, cfgs);

      // Placeholder returns name with "(Not Implemented)" suffix
      expect(analyzer.getTargetName()).toBe('Commander X16 (Not Implemented)');
    });
  });

  describe('getDefaultHardwareAnalyzer', () => {
    it('should return C64 analyzer', () => {
      const analyzer = getDefaultHardwareAnalyzer(symbolTable, cfgs);

      expect(analyzer).toBeInstanceOf(C64HardwareAnalyzer);
      expect(analyzer.getTargetName()).toBe('Commodore 64');
    });

    it('should have C64 target config', () => {
      const analyzer = getDefaultHardwareAnalyzer(symbolTable, cfgs);
      const config = analyzer.getTargetConfig();

      expect(config.architecture).toBe(TargetArchitecture.C64);
    });
  });

  describe('isHardwareAnalyzerAvailable', () => {
    it('should return true for C64', () => {
      expect(isHardwareAnalyzerAvailable(TargetArchitecture.C64)).toBe(true);
    });

    it('should return true for C128', () => {
      expect(isHardwareAnalyzerAvailable(TargetArchitecture.C128)).toBe(true);
    });

    it('should return true for X16', () => {
      expect(isHardwareAnalyzerAvailable(TargetArchitecture.X16)).toBe(true);
    });

    it('should return false for Generic', () => {
      expect(isHardwareAnalyzerAvailable(TargetArchitecture.Generic)).toBe(false);
    });
  });

  describe('getTargetsWithAnalyzers', () => {
    it('should return array of targets', () => {
      const targets = getTargetsWithAnalyzers();

      expect(Array.isArray(targets)).toBe(true);
      expect(targets.length).toBeGreaterThanOrEqual(3);
    });

    it('should include C64', () => {
      const targets = getTargetsWithAnalyzers();
      expect(targets).toContain(TargetArchitecture.C64);
    });

    it('should include C128', () => {
      const targets = getTargetsWithAnalyzers();
      expect(targets).toContain(TargetArchitecture.C128);
    });

    it('should include X16', () => {
      const targets = getTargetsWithAnalyzers();
      expect(targets).toContain(TargetArchitecture.X16);
    });

    it('should not include Generic', () => {
      const targets = getTargetsWithAnalyzers();
      expect(targets).not.toContain(TargetArchitecture.Generic);
    });
  });

  describe('getHardwareAnalyzer alias', () => {
    it('should be alias for createHardwareAnalyzer', () => {
      const analyzer = getHardwareAnalyzer(
        TargetArchitecture.C64,
        symbolTable,
        cfgs
      );

      expect(analyzer).toBeInstanceOf(C64HardwareAnalyzer);
    });
  });

  describe('NoAnalyzerForTargetError', () => {
    it('should have correct error name', () => {
      const error = new NoAnalyzerForTargetError(TargetArchitecture.Generic);
      expect(error.name).toBe('NoAnalyzerForTargetError');
    });

    it('should include target name in message', () => {
      const error = new NoAnalyzerForTargetError(TargetArchitecture.Generic);
      expect(error.message).toContain('Generic 6502');
    });

    it('should mention that target may not be implemented', () => {
      const error = new NoAnalyzerForTargetError(TargetArchitecture.Generic);
      expect(error.message).toContain('not be fully implemented');
    });
  });
});

describe('BaseHardwareAnalyzer', () => {
  let symbolTable: SymbolTable;
  let cfgs: Map<string, ControlFlowGraph>;

  beforeEach(() => {
    symbolTable = new SymbolTable();
    cfgs = new Map();
  });

  describe('Common Analyzer Properties', () => {
    it('should provide target configuration', () => {
      const analyzer = createHardwareAnalyzer(
        TargetArchitecture.C64,
        symbolTable,
        cfgs
      );

      const config = analyzer.getTargetConfig();
      expect(config).toBeDefined();
      expect(config.architecture).toBe(TargetArchitecture.C64);
    });

    it('should initialize with empty diagnostics', () => {
      const analyzer = createHardwareAnalyzer(
        TargetArchitecture.C64,
        symbolTable,
        cfgs
      );

      expect(analyzer.getDiagnostics()).toHaveLength(0);
    });

    it('should not have errors initially', () => {
      const analyzer = createHardwareAnalyzer(
        TargetArchitecture.C64,
        symbolTable,
        cfgs
      );

      expect(analyzer.hasErrors()).toBe(false);
    });

    it('should not have warnings initially', () => {
      const analyzer = createHardwareAnalyzer(
        TargetArchitecture.C64,
        symbolTable,
        cfgs
      );

      expect(analyzer.hasWarnings()).toBe(false);
    });
  });

  describe('Zero-Page Address Utilities', () => {
    it('should correctly identify zero-page addresses', () => {
      const analyzer = createHardwareAnalyzer(
        TargetArchitecture.C64,
        symbolTable,
        cfgs
      ) as C64HardwareAnalyzer;

      // Access protected method through analyzer to verify behavior
      // We test this through the public getTargetConfig
      const config = analyzer.getTargetConfig();
      expect(config.zeroPage.safeRange.start).toBe(0x02);
      expect(config.zeroPage.safeRange.end).toBe(0x8f);
    });
  });
});