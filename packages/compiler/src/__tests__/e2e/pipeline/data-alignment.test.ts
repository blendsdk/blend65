/**
 * E2E Pipeline Tests: Data Alignment
 *
 * Tests the complete pipeline for data alignment features:
 * - Sugar keywords (@sprite, @charset, @screen, @bitmap, @page) produce !align in output
 * - Explicit @data(align: N) produces !align in output
 * - Non-aligned @data does NOT produce !align
 * - @sprite and @data(align: 64) produce identical !align directives
 *
 * @module __tests__/e2e/pipeline/data-alignment
 */

import { describe, it, expect } from 'vitest';
import {
  compileBlend,
  expectSuccess,
  getAssembly,
} from './helpers.js';

describe('E2E: Data Alignment Pipeline', () => {

  // ========================================
  // Sugar Keywords — !align emission
  // ========================================

  describe('sugar keyword alignment emission', () => {

    it('should emit !align 63, 0 for @sprite (64-byte alignment)', () => {
      // @sprite desugars to @data with alignment=64
      // ACME !align uses and_mask = alignment - 1 = 63
      const source = '@sprite const ball: byte[] = [0, 0, 0, 0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, '@sprite alignment');

      const asm = getAssembly(result);
      // Should contain !align directive with mask 63 (64-byte boundary)
      expect(asm).toContain('!align 63, 0');
    });

    it('should emit !align 255, 0 for @page (256-byte alignment)', () => {
      const source = '@page const lookup: byte[] = [1, 2, 3, 4, 5];';
      const result = compileBlend(source);
      expectSuccess(result, '@page alignment');

      const asm = getAssembly(result);
      expect(asm).toContain('!align 255, 0');
    });

    it('should emit !align 1023, 0 for @screen (1024-byte alignment)', () => {
      const source = '@screen const screenData: byte[] = [32, 32, 32, 32];';
      const result = compileBlend(source);
      expectSuccess(result, '@screen alignment');

      const asm = getAssembly(result);
      expect(asm).toContain('!align 1023, 0');
    });

    it('should emit !align 2047, 0 for @charset (2048-byte alignment)', () => {
      const source = '@charset const font: byte[] = [0, 0, 0, 0, 0, 0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, '@charset alignment');

      const asm = getAssembly(result);
      expect(asm).toContain('!align 2047, 0');
    });

    it('should emit !align 8191, 0 for @bitmap (8192-byte alignment)', () => {
      const source = '@bitmap const bmpData: byte[] = [0, 0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, '@bitmap alignment');

      const asm = getAssembly(result);
      expect(asm).toContain('!align 8191, 0');
    });
  });

  // ========================================
  // Explicit alignment — !align emission
  // ========================================

  describe('explicit @data(align: N) alignment emission', () => {

    it('should emit !align 63, 0 for @data(align: 64)', () => {
      const source = '@data(align: 64) const spriteFrame: byte[] = [1, 2, 3];';
      const result = compileBlend(source);
      expectSuccess(result, '@data(align: 64) alignment');

      const asm = getAssembly(result);
      expect(asm).toContain('!align 63, 0');
    });

    it('should emit !align 255, 0 for @data(align: 256)', () => {
      const source = '@data(align: 256) const pageTable: byte[] = [0, 0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, '@data(align: 256) alignment');

      const asm = getAssembly(result);
      expect(asm).toContain('!align 255, 0');
    });

    it('should emit !align 2047, 0 for @data(align: 2048)', () => {
      const source = '@data(align: 2048) const charsetData: byte[] = [0, 1, 2, 3];';
      const result = compileBlend(source);
      expectSuccess(result, '@data(align: 2048) alignment');

      const asm = getAssembly(result);
      expect(asm).toContain('!align 2047, 0');
    });
  });

  // ========================================
  // No alignment — no !align emission
  // ========================================

  describe('no alignment — no !align emission', () => {

    it('should NOT emit !align for plain @data without alignment', () => {
      const source = '@data const table: byte[] = [10, 20, 30, 40, 50];';
      const result = compileBlend(source);
      expectSuccess(result, 'plain @data');

      const asm = getAssembly(result);
      // Should NOT contain any !align directive
      expect(asm).not.toContain('!align');
      // Should still contain !byte data
      expect(asm).toContain('!byte');
    });
  });

  // ========================================
  // Equivalence: sugar vs explicit
  // ========================================

  describe('sugar vs explicit equivalence', () => {

    it('should produce same !align for @sprite and @data(align: 64)', () => {
      const sugarSource = '@sprite const ball: byte[] = [1, 2, 3];';
      const explicitSource = '@data(align: 64) const ball: byte[] = [1, 2, 3];';

      const sugarResult = compileBlend(sugarSource);
      const explicitResult = compileBlend(explicitSource);

      expectSuccess(sugarResult, 'sugar');
      expectSuccess(explicitResult, 'explicit');

      const sugarAsm = getAssembly(sugarResult);
      const explicitAsm = getAssembly(explicitResult);

      // Both should contain the same !align directive
      expect(sugarAsm).toContain('!align 63, 0');
      expect(explicitAsm).toContain('!align 63, 0');
    });
  });

  // ========================================
  // Alignment with data label
  // ========================================

  describe('alignment with data labels', () => {

    it('should emit !align BEFORE the data label', () => {
      const source = '@sprite const spriteData: byte[] = [0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, 'alignment + label ordering');

      const asm = getAssembly(result);
      // !align should come before the label
      const alignIdx = asm.indexOf('!align 63, 0');
      const labelIdx = asm.indexOf('__data_');

      expect(alignIdx).toBeGreaterThan(-1);
      expect(labelIdx).toBeGreaterThan(-1);
      // The !align must appear before the label in the output
      expect(alignIdx).toBeLessThan(labelIdx);
    });

    it('should include alignment comment in output', () => {
      const source = '@sprite const ball: byte[] = [0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, 'alignment comment');

      const asm = getAssembly(result);
      // Should have a comment about the alignment boundary
      expect(asm).toContain('64-byte boundary');
    });
  });

  // ========================================
  // Multiple aligned entries
  // ========================================

  describe('multiple aligned entries', () => {

    it('should emit !align for each aligned @data entry', () => {
      const source = `
        @sprite const frame1: byte[] = [0, 0, 0];
        @sprite const frame2: byte[] = [1, 1, 1];
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'multiple aligned entries');

      const asm = getAssembly(result);
      // Should have two !align directives (one per sprite)
      const alignCount = (asm.match(/!align 63, 0/g) || []).length;
      expect(alignCount).toBe(2);
    });

    it('should handle mixed aligned and non-aligned data', () => {
      const source = `
        @data const plain: byte[] = [1, 2, 3];
        @sprite const aligned: byte[] = [4, 5, 6];
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'mixed aligned + non-aligned');

      const asm = getAssembly(result);
      // Only one !align directive (for the sprite, not the plain @data)
      const alignCount = (asm.match(/!align/g) || []).length;
      expect(alignCount).toBe(1);
      expect(asm).toContain('!align 63, 0');
    });
  });
});
