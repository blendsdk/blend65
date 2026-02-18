/**
 * E2E Tests: VIC-II ROM Shadow Guard Emission
 *
 * Tests that the compiler emits ACME `!if` / `!warn` assembly-time guards
 * for aligned @data entries that may land in the VIC-II Character ROM shadow
 * region ($1000-$1FFF in VIC Bank 0).
 *
 * The VIC-II reads Character ROM (not RAM) at $1000-$1FFF within Bank 0.
 * If @charset, @sprite, @screen, @bitmap, or @page data is placed there
 * by the assembler, custom data will not be visible to the VIC-II chip.
 * These guards warn at assembly time when this happens.
 *
 * @module __tests__/e2e/pipeline/rom-shadow-guard
 */

import { describe, it, expect } from 'vitest';
import {
  compileBlend,
  expectSuccess,
  getAssembly,
} from './helpers.js';

describe('E2E: VIC-II ROM Shadow Guard', () => {

  // ========================================
  // Guard emission for VIC-II sugar keywords
  // ========================================

  describe('guard emission for VIC-II storage classes', () => {

    it('should emit ROM shadow guard for @sprite (64-byte aligned)', () => {
      const source = '@sprite const ball: byte[] = [0, 0, 0, 0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, '@sprite ROM shadow guard');

      const asm = getAssembly(result);

      // Should contain !if guard checking $1000-$1FFF range
      expect(asm).toContain('!if');
      expect(asm).toContain('>= $1000');
      expect(asm).toContain('< $2000');

      // Should contain !warn with storage class name
      expect(asm).toContain('!warn');
      expect(asm).toContain('@sprite');
      expect(asm).toContain('ROM shadow');
    });

    it('should emit ROM shadow guard for @charset (2048-byte aligned)', () => {
      const source = '@charset const font: byte[] = [0, 0, 0, 0, 0, 0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, '@charset ROM shadow guard');

      const asm = getAssembly(result);

      // Should contain !if guard
      expect(asm).toContain('!if');
      expect(asm).toContain('>= $1000');

      // Should contain !warn mentioning @charset
      expect(asm).toContain('!warn');
      expect(asm).toContain('@charset');
    });

    it('should emit ROM shadow guard for @page (256-byte aligned)', () => {
      const source = '@page const lookup: byte[] = [1, 2, 3, 4, 5];';
      const result = compileBlend(source);
      expectSuccess(result, '@page ROM shadow guard');

      const asm = getAssembly(result);
      expect(asm).toContain('!if');
      expect(asm).toContain('!warn');
      expect(asm).toContain('@page');
    });

    it('should emit ROM shadow guard for @screen (1024-byte aligned)', () => {
      const source = '@screen const screenData: byte[] = [32, 32, 32, 32];';
      const result = compileBlend(source);
      expectSuccess(result, '@screen ROM shadow guard');

      const asm = getAssembly(result);
      expect(asm).toContain('!if');
      expect(asm).toContain('!warn');
      expect(asm).toContain('@screen');
    });

    it('should emit ROM shadow guard for @bitmap (8192-byte aligned)', () => {
      const source = '@bitmap const bmpData: byte[] = [0, 0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, '@bitmap ROM shadow guard');

      const asm = getAssembly(result);
      expect(asm).toContain('!if');
      expect(asm).toContain('!warn');
      expect(asm).toContain('@bitmap');
    });
  });

  // ========================================
  // Guard emission for explicit alignment
  // ========================================

  describe('guard emission for explicit @data(align: N)', () => {

    it('should emit ROM shadow guard for @data(align: 64)', () => {
      const source = '@data(align: 64) const spriteFrame: byte[] = [1, 2, 3];';
      const result = compileBlend(source);
      expectSuccess(result, '@data(align: 64) ROM shadow guard');

      const asm = getAssembly(result);
      expect(asm).toContain('!if');
      expect(asm).toContain('>= $1000');
      expect(asm).toContain('< $2000');
      expect(asm).toContain('!warn');
      expect(asm).toContain('@sprite');
    });

    it('should emit ROM shadow guard for @data(align: 2048)', () => {
      const source = '@data(align: 2048) const charsetData: byte[] = [0, 1, 2, 3];';
      const result = compileBlend(source);
      expectSuccess(result, '@data(align: 2048) ROM shadow guard');

      const asm = getAssembly(result);
      expect(asm).toContain('!if');
      expect(asm).toContain('!warn');
      expect(asm).toContain('@charset');
    });
  });

  // ========================================
  // No guard for non-aligned or small alignment
  // ========================================

  describe('no guard for non-VIC data', () => {

    it('should NOT emit ROM shadow guard for plain @data without alignment', () => {
      const source = '@data const table: byte[] = [10, 20, 30, 40, 50];';
      const result = compileBlend(source);
      expectSuccess(result, 'plain @data — no guard');

      const asm = getAssembly(result);

      // Should NOT contain !if guard for ROM shadow
      // (plain @data has no alignment, not VIC-II relevant)
      const romShadowGuardCount = (asm.match(/ROM shadow/g) || []).length;
      expect(romShadowGuardCount).toBe(0);
    });

    it('should NOT emit ROM shadow guard for @data(align: 2) — too small for VIC', () => {
      const source = '@data(align: 2) const pair: byte[] = [1, 2];';
      const result = compileBlend(source);
      expectSuccess(result, '@data(align: 2) — no guard');

      const asm = getAssembly(result);
      const romShadowGuardCount = (asm.match(/ROM shadow/g) || []).length;
      expect(romShadowGuardCount).toBe(0);
    });
  });

  // ========================================
  // Guard placement ordering
  // ========================================

  describe('guard placement ordering', () => {

    it('should emit guard AFTER the data label', () => {
      const source = '@sprite const spriteData: byte[] = [0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, 'guard after label');

      const asm = getAssembly(result);

      // The data label should come before the !if guard
      const labelIdx = asm.indexOf('__data_');
      const guardIdx = asm.indexOf('!if');
      expect(labelIdx).toBeGreaterThan(-1);
      expect(guardIdx).toBeGreaterThan(-1);
      expect(guardIdx).toBeGreaterThan(labelIdx);
    });

    it('should emit guard BEFORE the !byte data', () => {
      const source = '@sprite const spriteData: byte[] = [0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, 'guard before data');

      const asm = getAssembly(result);

      // The !if guard should come before the !byte data directives
      const guardIdx = asm.indexOf('!if');
      // Find first !byte after the data label
      const labelIdx = asm.indexOf('__data_');
      const byteIdx = asm.indexOf('!byte', labelIdx);
      expect(guardIdx).toBeGreaterThan(-1);
      expect(byteIdx).toBeGreaterThan(-1);
      expect(guardIdx).toBeLessThan(byteIdx);
    });
  });

  // ========================================
  // Guard content verification
  // ========================================

  describe('guard content', () => {

    it('should include the data label name in the !if condition', () => {
      const source = '@sprite const ball: byte[] = [0, 0, 0, 0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, 'label in !if');

      const asm = getAssembly(result);

      // The !if should reference the specific data label
      // Data labels follow the pattern: __data_<ModuleName>_<varName>
      expect(asm).toMatch(/!if.*__data_.*>= \$1000.*AND.*__data_.*< \$2000/);
    });

    it('should include variable name in !warn message', () => {
      const source = '@charset const myFont: byte[] = [0, 0, 0, 0, 0, 0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, 'var name in !warn');

      const asm = getAssembly(result);

      // The !warn should mention the qualified variable name
      expect(asm).toContain('myFont');
    });

    it('should include explanatory comment before the guard', () => {
      const source = '@sprite const enemy: byte[] = [0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, 'guard comment');

      const asm = getAssembly(result);

      // Should have an explanatory comment before the guard
      expect(asm).toContain('VIC-II ROM shadow guard');
    });

    it('should close the !if block with }', () => {
      const source = '@sprite const enemy: byte[] = [0, 0, 0];';
      const result = compileBlend(source);
      expectSuccess(result, 'guard closing brace');

      const asm = getAssembly(result);

      // The guard should have a closing }
      const ifIdx = asm.indexOf('!if');
      const closeIdx = asm.indexOf('}', ifIdx);
      expect(closeIdx).toBeGreaterThan(ifIdx);
    });
  });

  // ========================================
  // Multiple aligned entries
  // ========================================

  describe('multiple aligned entries', () => {

    it('should emit separate guards for each aligned data entry', () => {
      const source = `
        @sprite const ball: byte[] = [0, 0, 0];
        @sprite const paddle: byte[] = [1, 1, 1];
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'multiple guards');

      const asm = getAssembly(result);

      // Should have two separate !if guards (one per sprite)
      const guardCount = (asm.match(/!if.*>= \$1000/g) || []).length;
      expect(guardCount).toBe(2);
    });

    it('should only emit guard for aligned entry, not plain @data', () => {
      const source = `
        @data const plainTable: byte[] = [1, 2, 3];
        @sprite const ball: byte[] = [0, 0, 0];
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'mixed aligned + plain');

      const asm = getAssembly(result);

      // Only one guard (for sprite, not for plain @data)
      const guardCount = (asm.match(/!if.*>= \$1000/g) || []).length;
      expect(guardCount).toBe(1);
    });
  });
});
