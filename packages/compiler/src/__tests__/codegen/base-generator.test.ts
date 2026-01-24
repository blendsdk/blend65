/**
 * Tests for BaseCodeGenerator
 *
 * Tests the foundation layer of the code generator inheritance chain.
 * BaseCodeGenerator provides core utilities, state management, and
 * common instruction emission helpers.
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * @module __tests__/codegen/base-generator.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseCodeGenerator } from '../../codegen/base-generator.js';
import { AssemblyWriter } from '../../codegen/assembly-writer.js';
import { LabelGenerator } from '../../codegen/label-generator.js';
import { SourceMapper } from '../../codegen/source-mapper.js';
import { ILModule } from '../../il/module.js';
import { C64_CONFIG } from '../../target/index.js';
import type { CodegenOptions } from '../../codegen/types.js';

/**
 * Concrete test implementation of BaseCodeGenerator
 *
 * BaseCodeGenerator is abstract, so we need a concrete class
 * to test its protected methods.
 */
class TestBaseGenerator extends BaseCodeGenerator {
  // Expose protected methods for testing

  public exposeAssemblyWriter(): AssemblyWriter {
    return this.assemblyWriter;
  }

  public exposeLabelGenerator(): LabelGenerator {
    return this.labelGenerator;
  }

  public exposeSourceMapper(): SourceMapper {
    return this.sourceMapper;
  }

  public exposeResetState(): void {
    this.resetState();
  }

  public exposeFormatHex(value: number, digits?: number): string {
    return this.formatHex(value, digits);
  }

  public exposeFormatImmediate(value: number): string {
    return this.formatImmediate(value);
  }

  public exposeFormatAbsolute(address: number): string {
    return this.formatAbsolute(address);
  }

  public exposeFormatZeroPage(address: number): string {
    return this.formatZeroPage(address);
  }

  public exposeEmitComment(comment: string): void {
    this.emitComment(comment);
  }

  public exposeEmitLabel(label: string): void {
    this.emitLabel(label);
  }

  public exposeEmitInstruction(
    mnemonic: string,
    operand?: string,
    comment?: string,
    bytes?: number
  ): void {
    this.emitInstruction(mnemonic, operand, comment, bytes);
  }

  public exposeEmitLdaImmediate(value: number, comment?: string): void {
    this.emitLdaImmediate(value, comment);
  }

  public exposeEmitStaAbsolute(address: number, comment?: string): void {
    this.emitStaAbsolute(address, comment);
  }

  public exposeEmitLdaAbsolute(address: number, comment?: string): void {
    this.emitLdaAbsolute(address, comment);
  }

  public exposeEmitStaZeroPage(address: number, comment?: string): void {
    this.emitStaZeroPage(address, comment);
  }

  public exposeEmitLdaZeroPage(address: number, comment?: string): void {
    this.emitLdaZeroPage(address, comment);
  }

  public exposeEmitJmp(label: string, comment?: string): void {
    this.emitJmp(label, comment);
  }

  public exposeEmitJsr(label: string, comment?: string): void {
    this.emitJsr(label, comment);
  }

  public exposeEmitRts(comment?: string): void {
    this.emitRts(comment);
  }

  public exposeEmitNop(comment?: string): void {
    this.emitNop(comment);
  }

  public exposeEmitSectionComment(title: string): void {
    this.emitSectionComment(title);
  }

  public exposeAddWarning(warning: string): void {
    this.addWarning(warning);
  }

  public exposeGetWarnings(): string[] {
    return this.getWarnings();
  }

  public exposeGetStats(): { codeSize: number; dataSize: number; zpBytesUsed: number; functionCount: number; globalCount: number; totalSize: number } {
    return this.getStats();
  }

  public exposeAddCodeBytes(count: number): void {
    this.addCodeBytes(count);
  }

  public exposeAddDataBytes(count: number): void {
    this.addDataBytes(count);
  }

  public exposeAddZpBytes(count: number): void {
    this.addZpBytes(count);
  }

  public exposeIncrementFunctionCount(): void {
    this.incrementFunctionCount();
  }

  public exposeIncrementGlobalCount(): void {
    this.incrementGlobalCount();
  }

  public exposeGetFunctionLabel(name: string): string {
    return this.getFunctionLabel(name);
  }

  public exposeGetGlobalLabel(name: string): string {
    return this.getGlobalLabel(name);
  }

  public exposeGetTempLabel(prefix: string): string {
    return this.getTempLabel(prefix);
  }

  public exposeGetBlockLabel(blockName: string): string {
    return this.getBlockLabel(blockName);
  }

  public exposeFinalizeStats(): void {
    this.finalizeStats();
  }

  public setModule(module: ILModule): void {
    this.currentModule = module;
  }

  public setOptions(options: CodegenOptions): void {
    this.options = options;
  }
}

describe('BaseCodeGenerator', () => {
  let generator: TestBaseGenerator;

  beforeEach(() => {
    generator = new TestBaseGenerator();
  });

  // ===========================================================================
  // Helper Class Initialization Tests
  // ===========================================================================

  describe('helper class initialization', () => {
    it('should initialize AssemblyWriter', () => {
      const writer = generator.exposeAssemblyWriter();
      expect(writer).toBeInstanceOf(AssemblyWriter);
    });

    it('should initialize LabelGenerator', () => {
      const labelGen = generator.exposeLabelGenerator();
      expect(labelGen).toBeInstanceOf(LabelGenerator);
    });

    it('should initialize SourceMapper', () => {
      const mapper = generator.exposeSourceMapper();
      expect(mapper).toBeInstanceOf(SourceMapper);
    });
  });

  // ===========================================================================
  // State Reset Tests
  // ===========================================================================

  describe('resetState()', () => {
    it('should reset assembly writer', () => {
      // Must set options before calling resetState (requires loadAddress)
      generator.setOptions({
        target: C64_CONFIG,
        format: 'prg',
        sourceMap: false,
        debug: 'none',
        loadAddress: 0x0801,
      });

      const writer = generator.exposeAssemblyWriter();
      writer.emitComment('test');
      expect(writer.toString()).toContain('test');

      generator.exposeResetState();
      expect(writer.toString()).toBe('');
    });

    it('should reset label generator', () => {
      // Must set options before calling resetState
      generator.setOptions({
        target: C64_CONFIG,
        format: 'prg',
        sourceMap: false,
        debug: 'none',
        loadAddress: 0x0801,
      });

      const labelGen = generator.exposeLabelGenerator();
      labelGen.functionLabel('test', 0x1000);

      generator.exposeResetState();
      // After reset, same name should be available again
      const label = labelGen.functionLabel('test', 0x2000);
      expect(label).toContain('test');
    });

    it('should reset source mapper', () => {
      // Must set options before calling resetState
      generator.setOptions({
        target: C64_CONFIG,
        format: 'prg',
        sourceMap: false,
        debug: 'none',
        loadAddress: 0x0801,
      });

      const mapper = generator.exposeSourceMapper();
      // SourceMapper uses trackLocation, not addEntry
      mapper.trackLocation(0x1000, { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } });

      generator.exposeResetState();
      expect(mapper.getEntries()).toHaveLength(0);
    });

    it('should reset statistics', () => {
      // Must set options before calling resetState
      generator.setOptions({
        target: C64_CONFIG,
        format: 'prg',
        sourceMap: false,
        debug: 'none',
        loadAddress: 0x0801,
      });

      generator.exposeAddCodeBytes(100);
      generator.exposeAddDataBytes(50);
      expect(generator.exposeGetStats().codeSize).toBe(100);

      generator.exposeResetState();
      const stats = generator.exposeGetStats();
      expect(stats.codeSize).toBe(0);
      expect(stats.dataSize).toBe(0);
    });

    it('should clear warnings', () => {
      // Must set options before calling resetState
      generator.setOptions({
        target: C64_CONFIG,
        format: 'prg',
        sourceMap: false,
        debug: 'none',
        loadAddress: 0x0801,
      });

      generator.exposeAddWarning('test warning');
      expect(generator.exposeGetWarnings()).toHaveLength(1);

      generator.exposeResetState();
      expect(generator.exposeGetWarnings()).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Formatting Helper Tests
  // ===========================================================================

  describe('formatHex()', () => {
    it('should format byte as hex with $ prefix and default 4 digits', () => {
      // Default is 4 digits
      expect(generator.exposeFormatHex(0x42)).toBe('$0042');
    });

    it('should format byte with explicit 2 digits', () => {
      expect(generator.exposeFormatHex(0x42, 2)).toBe('$42');
    });

    it('should format word as hex with 4 digits', () => {
      expect(generator.exposeFormatHex(0xD020, 4)).toBe('$D020');
    });

    it('should pad single digit bytes with zeros for default 4 digits', () => {
      expect(generator.exposeFormatHex(0x05)).toBe('$0005');
    });

    it('should pad single digit bytes with one zero for 2 digits', () => {
      expect(generator.exposeFormatHex(0x05, 2)).toBe('$05');
    });

    it('should handle zero with default digits', () => {
      expect(generator.exposeFormatHex(0)).toBe('$0000');
    });

    it('should handle zero with 2 digits', () => {
      expect(generator.exposeFormatHex(0, 2)).toBe('$00');
    });

    it('should handle 16-bit addresses', () => {
      expect(generator.exposeFormatHex(0x0801, 4)).toBe('$0801');
    });
  });

  describe('formatImmediate()', () => {
    it('should format as immediate with # prefix', () => {
      expect(generator.exposeFormatImmediate(0x42)).toBe('#$42');
    });

    it('should format zero correctly', () => {
      expect(generator.exposeFormatImmediate(0)).toBe('#$00');
    });

    it('should format max byte correctly', () => {
      expect(generator.exposeFormatImmediate(0xFF)).toBe('#$FF');
    });
  });

  describe('formatAbsolute()', () => {
    it('should format 16-bit address', () => {
      expect(generator.exposeFormatAbsolute(0xD020)).toBe('$D020');
    });

    it('should pad small addresses', () => {
      expect(generator.exposeFormatAbsolute(0x0400)).toBe('$0400');
    });
  });

  describe('formatZeroPage()', () => {
    it('should format 8-bit zero-page address', () => {
      expect(generator.exposeFormatZeroPage(0x02)).toBe('$02');
    });

    it('should format zero', () => {
      expect(generator.exposeFormatZeroPage(0x00)).toBe('$00');
    });
  });

  // ===========================================================================
  // Comment and Label Emission Tests
  // ===========================================================================

  describe('emitComment()', () => {
    it('should emit comment to assembly writer', () => {
      generator.exposeEmitComment('This is a comment');
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('; This is a comment');
    });
  });

  describe('emitLabel()', () => {
    it('should emit label to assembly writer', () => {
      generator.exposeEmitLabel('_main');
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('_main:');
    });
  });

  describe('emitSectionComment()', () => {
    it('should emit section divider with title', () => {
      generator.exposeEmitSectionComment('Functions');
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('Functions');
      expect(output).toContain('-'); // Should have divider characters
    });
  });

  // ===========================================================================
  // Instruction Emission Tests
  // ===========================================================================

  describe('emitInstruction()', () => {
    it('should emit instruction with operand', () => {
      generator.exposeEmitInstruction('LDA', '#$42');
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('LDA');
      expect(output).toContain('#$42');
    });

    it('should emit instruction without operand', () => {
      generator.exposeEmitInstruction('RTS');
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('RTS');
    });

    it('should emit instruction with comment', () => {
      generator.exposeEmitInstruction('LDA', '#$42', 'Load value');
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('Load value');
    });

    it('should track code bytes when bytes parameter provided', () => {
      generator.exposeEmitInstruction('LDA', '#$42', undefined, 2);
      expect(generator.exposeGetStats().codeSize).toBe(2);
    });
  });

  describe('emitLdaImmediate()', () => {
    it('should emit LDA with immediate addressing', () => {
      generator.exposeEmitLdaImmediate(0x05);
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('LDA');
      expect(output).toContain('#$05');
    });

    it('should track 2 bytes for immediate LDA', () => {
      generator.exposeEmitLdaImmediate(0x00);
      expect(generator.exposeGetStats().codeSize).toBe(2);
    });
  });

  describe('emitStaAbsolute()', () => {
    it('should emit STA with absolute addressing', () => {
      generator.exposeEmitStaAbsolute(0xD020);
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('STA');
      expect(output).toContain('$D020');
    });

    it('should track 3 bytes for absolute STA', () => {
      generator.exposeEmitStaAbsolute(0xD020);
      expect(generator.exposeGetStats().codeSize).toBe(3);
    });
  });

  describe('emitLdaAbsolute()', () => {
    it('should emit LDA with absolute addressing', () => {
      generator.exposeEmitLdaAbsolute(0xD020);
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('LDA');
      expect(output).toContain('$D020');
    });

    it('should track 3 bytes for absolute LDA', () => {
      generator.exposeEmitLdaAbsolute(0xD020);
      expect(generator.exposeGetStats().codeSize).toBe(3);
    });
  });

  describe('emitStaZeroPage()', () => {
    it('should emit STA with zero-page addressing', () => {
      generator.exposeEmitStaZeroPage(0x02);
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('STA');
      expect(output).toContain('$02');
    });

    it('should track 2 bytes for zero-page STA', () => {
      generator.exposeEmitStaZeroPage(0x02);
      expect(generator.exposeGetStats().codeSize).toBe(2);
    });
  });

  describe('emitLdaZeroPage()', () => {
    it('should emit LDA with zero-page addressing', () => {
      generator.exposeEmitLdaZeroPage(0x02);
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('LDA');
      expect(output).toContain('$02');
    });

    it('should track 2 bytes for zero-page LDA', () => {
      generator.exposeEmitLdaZeroPage(0x02);
      expect(generator.exposeGetStats().codeSize).toBe(2);
    });
  });

  describe('emitJmp()', () => {
    it('should emit JMP with label', () => {
      generator.exposeEmitJmp('_loop');
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('JMP');
      expect(output).toContain('_loop');
    });

    it('should track 3 bytes for JMP', () => {
      generator.exposeEmitJmp('_loop');
      expect(generator.exposeGetStats().codeSize).toBe(3);
    });
  });

  describe('emitJsr()', () => {
    it('should emit JSR with label', () => {
      generator.exposeEmitJsr('_subroutine');
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('JSR');
      expect(output).toContain('_subroutine');
    });

    it('should track 3 bytes for JSR', () => {
      generator.exposeEmitJsr('_subroutine');
      expect(generator.exposeGetStats().codeSize).toBe(3);
    });
  });

  describe('emitRts()', () => {
    it('should emit RTS instruction', () => {
      generator.exposeEmitRts();
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('RTS');
    });

    it('should track 1 byte for RTS', () => {
      generator.exposeEmitRts();
      expect(generator.exposeGetStats().codeSize).toBe(1);
    });
  });

  describe('emitNop()', () => {
    it('should emit NOP instruction', () => {
      generator.exposeEmitNop();
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('NOP');
    });

    it('should track 1 byte for NOP', () => {
      generator.exposeEmitNop();
      expect(generator.exposeGetStats().codeSize).toBe(1);
    });
  });

  // ===========================================================================
  // Statistics Tracking Tests
  // ===========================================================================

  describe('statistics tracking', () => {
    it('should track code size correctly', () => {
      generator.exposeAddCodeBytes(10);
      generator.exposeAddCodeBytes(20);
      expect(generator.exposeGetStats().codeSize).toBe(30);
    });

    it('should track data size correctly', () => {
      generator.exposeAddDataBytes(50);
      generator.exposeAddDataBytes(25);
      expect(generator.exposeGetStats().dataSize).toBe(75);
    });

    it('should track zero-page bytes correctly', () => {
      generator.exposeAddZpBytes(5);
      generator.exposeAddZpBytes(3);
      expect(generator.exposeGetStats().zpBytesUsed).toBe(8);
    });

    it('should track function count correctly', () => {
      generator.exposeIncrementFunctionCount();
      generator.exposeIncrementFunctionCount();
      generator.exposeIncrementFunctionCount();
      expect(generator.exposeGetStats().functionCount).toBe(3);
    });

    it('should track global count correctly', () => {
      generator.exposeIncrementGlobalCount();
      generator.exposeIncrementGlobalCount();
      expect(generator.exposeGetStats().globalCount).toBe(2);
    });

    it('should calculate total size correctly after finalizeStats', () => {
      generator.exposeAddCodeBytes(100);
      generator.exposeAddDataBytes(50);
      // totalSize is calculated only when finalizeStats() is called
      generator.exposeFinalizeStats();
      const stats = generator.exposeGetStats();
      expect(stats.totalSize).toBe(150);
    });
  });

  // ===========================================================================
  // Warning Collection Tests
  // ===========================================================================

  describe('warnings', () => {
    it('should collect warnings', () => {
      generator.exposeAddWarning('First warning');
      generator.exposeAddWarning('Second warning');
      const warnings = generator.exposeGetWarnings();
      expect(warnings).toHaveLength(2);
      expect(warnings[0]).toBe('First warning');
      expect(warnings[1]).toBe('Second warning');
    });

    it('should start with no warnings', () => {
      expect(generator.exposeGetWarnings()).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Label Generation Tests
  // ===========================================================================

  describe('label generation', () => {
    it('should generate function labels with underscore prefix', () => {
      const label = generator.exposeGetFunctionLabel('main');
      expect(label).toBe('_main');
    });

    it('should generate global labels with underscore prefix', () => {
      const label = generator.exposeGetGlobalLabel('counter');
      expect(label).toBe('_counter');
    });

    it('should generate unique temp labels', () => {
      const label1 = generator.exposeGetTempLabel('loop');
      const label2 = generator.exposeGetTempLabel('loop');
      expect(label1).not.toBe(label2);
    });

    it('should generate block labels', () => {
      const label = generator.exposeGetBlockLabel('entry');
      expect(label).toContain('entry');
    });
  });
});