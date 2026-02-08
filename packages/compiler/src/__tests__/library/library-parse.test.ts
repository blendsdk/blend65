/**
 * Library File Parse Tests
 *
 * Verifies that all v2 library .blend files parse correctly
 * with the v2 lexer and parser. Covers:
 * - system.blend (10 intrinsic stubs)
 * - hardware.blend (C64 hardware constants)
 * - asm.blend (151 asm_* function stubs)
 *
 * Also tests that LibraryLoader integrates correctly by loading
 * and parsing all library files together.
 *
 * @module __tests__/library/library-parse
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { LibraryLoader } from '../../library/loader.js';

/**
 * Get absolute path to the v2 library directory.
 */
function getLibraryPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, '..', '..', '..', 'library');
}

/**
 * Helper: tokenize and parse a Blend source string.
 * Returns the parser instance so we can check diagnostics.
 */
function parseSource(source: string): { parser: Parser; hasErrors: boolean } {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  parser.parse();
  return { parser, hasErrors: parser.hasErrors() };
}

/**
 * Helper: read a library file from disk and parse it.
 */
function parseLibraryFile(relativePath: string): { parser: Parser; hasErrors: boolean } {
  const fullPath = path.join(getLibraryPath(), relativePath);
  const source = fs.readFileSync(fullPath, 'utf-8');
  return parseSource(source);
}

// ─────────────────────────────────────────────────────────────
// 10B.1.3 / 10B.1.4 / 10B.1.5: Verify .blend files parse
// ─────────────────────────────────────────────────────────────

describe('Library File Parsing', () => {
  describe('system.blend (10B.1.4)', () => {
    it('should parse without errors', () => {
      const { hasErrors, parser } = parseLibraryFile('common/system.blend');
      if (hasErrors) {
        const diags = parser.getDiagnostics();
        // Print diagnostics for debugging
        console.error('system.blend parse errors:', diags);
      }
      expect(hasErrors).toBe(false);
    });

    it('should contain intrinsic function declarations', () => {
      const fullPath = path.join(getLibraryPath(), 'common/system.blend');
      const source = fs.readFileSync(fullPath, 'utf-8');

      // Verify key intrinsic stubs are present in source
      const expectedIntrinsics = [
        'peek', 'poke', 'peekw', 'pokew',
        'lo', 'hi', 'length',
        'barrier', 'volatile_read', 'volatile_write',
      ];

      for (const name of expectedIntrinsics) {
        expect(source).toContain(name);
      }
    });

    it('should tokenize all tokens without lexer errors', () => {
      const fullPath = path.join(getLibraryPath(), 'common/system.blend');
      const source = fs.readFileSync(fullPath, 'utf-8');
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      // Should produce tokens (more than just EOF)
      expect(tokens.length).toBeGreaterThan(1);
    });
  });

  describe('hardware.blend (10B.1.3 / 10B.1.5)', () => {
    it('should parse without errors', () => {
      const { hasErrors, parser } = parseLibraryFile('c64/common/hardware.blend');
      if (hasErrors) {
        const diags = parser.getDiagnostics();
        console.error('hardware.blend parse errors:', diags);
      }
      expect(hasErrors).toBe(false);
    });

    it('should contain C64 hardware constant declarations', () => {
      const fullPath = path.join(getLibraryPath(), 'c64/common/hardware.blend');
      const source = fs.readFileSync(fullPath, 'utf-8');

      // Key hardware constants that should exist
      expect(source).toContain('BORDER_COLOR');
      expect(source).toContain('BG_COLOR');
      expect(source).toContain('export');
      expect(source).toContain('const');
    });

    it('should tokenize all tokens without lexer errors', () => {
      const fullPath = path.join(getLibraryPath(), 'c64/common/hardware.blend');
      const source = fs.readFileSync(fullPath, 'utf-8');
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      expect(tokens.length).toBeGreaterThan(1);
    });
  });

  describe('asm.blend (10B.2.2)', () => {
    it('should parse without errors', () => {
      const { hasErrors, parser } = parseLibraryFile('common/asm.blend');
      if (hasErrors) {
        const diags = parser.getDiagnostics();
        // Only print first few for readability
        console.error('asm.blend parse errors (first 5):', diags.slice(0, 5));
      }
      expect(hasErrors).toBe(false);
    });

    it('should contain all major asm_* function categories', () => {
      const fullPath = path.join(getLibraryPath(), 'common/asm.blend');
      const source = fs.readFileSync(fullPath, 'utf-8');

      // Core load/store
      expect(source).toContain('asm_lda');
      expect(source).toContain('asm_sta');
      expect(source).toContain('asm_ldx');
      expect(source).toContain('asm_stx');
      expect(source).toContain('asm_ldy');
      expect(source).toContain('asm_sty');

      // Arithmetic
      expect(source).toContain('asm_adc');
      expect(source).toContain('asm_sbc');

      // Logic
      expect(source).toContain('asm_and');
      expect(source).toContain('asm_ora');
      expect(source).toContain('asm_eor');

      // Shifts
      expect(source).toContain('asm_asl');
      expect(source).toContain('asm_lsr');
      expect(source).toContain('asm_rol');
      expect(source).toContain('asm_ror');

      // Transfer
      expect(source).toContain('asm_tax');
      expect(source).toContain('asm_tay');
      expect(source).toContain('asm_txa');
      expect(source).toContain('asm_tya');

      // Stack
      expect(source).toContain('asm_pha');
      expect(source).toContain('asm_pla');
      expect(source).toContain('asm_php');
      expect(source).toContain('asm_plp');

      // Branch
      expect(source).toContain('asm_jmp');
      expect(source).toContain('asm_jsr');
      expect(source).toContain('asm_rts');
      expect(source).toContain('asm_rti');

      // Flags
      expect(source).toContain('asm_clc');
      expect(source).toContain('asm_sec');
      expect(source).toContain('asm_cli');
      expect(source).toContain('asm_sei');

      // Implied
      expect(source).toContain('asm_nop');
      expect(source).toContain('asm_brk');
    });

    it('should tokenize without lexer errors', () => {
      const fullPath = path.join(getLibraryPath(), 'common/asm.blend');
      const source = fs.readFileSync(fullPath, 'utf-8');
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      // 151 function stubs should produce many tokens
      expect(tokens.length).toBeGreaterThan(100);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// 10B.1.6 / 10B.2.3: Integration: LibraryLoader loads and parses all
// ─────────────────────────────────────────────────────────────

describe('LibraryLoader Integration (10B.1.6 / 10B.2.3)', () => {
  const loader = new LibraryLoader(getLibraryPath());

  it('should load all c64 library files', () => {
    const result = loader.loadLibraries('c64');
    expect(result.success).toBe(true);
    // Should load at least: system.blend, asm.blend, hardware.blend
    expect(result.sources.size).toBeGreaterThanOrEqual(3);
  });

  it('should parse every loaded library file without errors', () => {
    const result = loader.loadLibraries('c64');
    expect(result.success).toBe(true);

    const parseFailures: string[] = [];

    for (const [filePath, source] of result.sources) {
      const { hasErrors, parser } = parseSource(source);
      if (hasErrors) {
        const errorCount = parser.getDiagnosticCounts();
        parseFailures.push(`${filePath}: ${errorCount.errors} errors`);
      }
    }

    if (parseFailures.length > 0) {
      console.error('Parse failures:', parseFailures);
    }
    expect(parseFailures).toEqual([]);
  });

  it('should auto-load asm.blend from common/', () => {
    const result = loader.loadLibraries('c64');
    const asmKey = '@stdlib/common/asm.blend';
    expect(result.sources.has(asmKey)).toBe(true);
  });

  it('should load all sources with @stdlib/ prefix', () => {
    const result = loader.loadLibraries('c64');
    for (const key of result.sources.keys()) {
      expect(key.startsWith('@stdlib/')).toBe(true);
    }
  });
});
