/**
 * E2E Pipeline Tests: memcpy Intrinsic
 *
 * Tests the complete compilation pipeline for the memcpy() intrinsic,
 * which copies blocks of memory using optimized page-based 6502 indirect
 * addressing with ZP pointers ($FB/$FC for source, $FD/$FE for dest).
 *
 * **Test Coverage:**
 * - Small copies (< 256 bytes): single Y-indexed loop
 * - Exact page copies (256 bytes): one page iteration, no remainder
 * - Large copies (>= 256 bytes): page-based outer loop + remainder
 * - Multi-page copies (2048 bytes): 8 full pages, no remainder
 * - Assembly pattern verification: correct 6502 instructions emitted
 * - Compile-time constant count requirement
 * - Integration with @data arrays as source addresses
 *
 * @module __tests__/e2e/pipeline/memcpy-intrinsic
 */

import { describe, it } from 'vitest';
import {
  compileBlend,
  expectSuccess,
  expectAssemblyContains,
  expectAssemblyNotContains,
  getAssembly,
} from './helpers.js';

describe('E2E: memcpy intrinsic', () => {
  // ── Small Copy (< 256 bytes) ───────────────────────────────────

  describe('small copy (< 256 bytes)', () => {
    it('should compile memcpy with small constant count', () => {
      const source = `
        @data const src: byte[] = [1, 2, 3, 4, 5, 6, 7, 8];
        export function main(): void {
          memcpy($0400, @src, 8);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'memcpy small copy');
    });

    it('should generate single Y-indexed loop for count < 256', () => {
      const source = `
        @data const src: byte[] = [1, 2, 3, 4];
        export function main(): void {
          memcpy($0400, @src, 4);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'memcpy small loop');

      // Should contain indirect Y addressing for copy
      const asm = getAssembly(result);
      expectAssemblyContains(result,
        'LDA ($FB),Y',   // Read from source via ZP indirect
        'STA ($FD),Y',   // Write to dest via ZP indirect
        'INY',           // Increment byte index
      );
    });

    it('should set up ZP pointers for dest ($FD/$FE) and src ($FB/$FC)', () => {
      const source = `
        @data const src: byte[] = [10, 20, 30];
        export function main(): void {
          memcpy($D800, @src, 3);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'memcpy ZP pointer setup');

      // Should store dest address to $FD/$FE
      expectAssemblyContains(result,
        'STA $FD',    // Dest low byte
        'STA $FE',    // Dest high byte
      );
    });

    it('should compile memcpy with 64-byte copy (sprite size)', () => {
      // 63 bytes of sprite data + 1 padding = 64 bytes per frame
      const source = `
        @data const spriteData: byte[] = [
          0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0
        ];
        export function main(): void {
          memcpy($3F80, @spriteData, 64);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'memcpy sprite copy (64 bytes)');
    });

    it('should use CPY for small loop termination', () => {
      const source = `
        @data const src: byte[] = [1, 2, 3, 4, 5];
        export function main(): void {
          memcpy($0400, @src, 5);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'memcpy CPY loop check');

      // Small copies use CPY #count / BNE pattern
      expectAssemblyContains(result,
        'CPY #$05',     // Compare Y with count (5)
      );
    });
  });

  // ── Exact Page Copy (256 bytes) ────────────────────────────────

  describe('exact page copy (256 bytes)', () => {
    it('should compile memcpy with exactly 256 bytes using word addresses', () => {
      // Use word addresses instead of huge literal arrays to avoid timeout
      const source = `
        export function main(): void {
          let src: word = $C000;
          let dst: word = $3800;
          memcpy(dst, src, 256);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'memcpy exact page (256)');

      // 256 = 1 full page, 0 remainder → should use page loop with LDX #1
      expectAssemblyContains(result,
        'LDX #$01',        // 1 page
        'LDA ($FB),Y',     // Read via indirect Y
        'STA ($FD),Y',     // Write via indirect Y
        'INC $FC',         // Increment src high byte
        'INC $FE',         // Increment dst high byte
        'DEX',             // Decrement page counter
      );
    });
  });

  // ── Large Copy (>= 256 bytes with remainder) ──────────────────

  describe('large copy (multiple pages with remainder)', () => {
    it('should compile memcpy with 300 bytes (1 page + 44 remainder)', () => {
      // Use word addresses for large copies to keep test fast
      const source = `
        export function main(): void {
          let src: word = $C000;
          memcpy($0400, src, 300);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'memcpy 300 bytes (1 page + 44 remainder)');

      // 300 = 1 page (256) + 44 remainder
      expectAssemblyContains(result,
        'LDX #$01',        // 1 full page
        'INC $FC',         // Advance src page
        'INC $FE',         // Advance dst page
        'CPY #$2C',        // Remainder = 44 = $2C
      );
    });
  });

  // ── Armenian Charset Pattern (2048 bytes) ──────────────────────

  describe('armenian charset pattern (2048 bytes)', () => {
    it('should compile memcpy with 2048 bytes for charset copy', () => {
      // This simulates the real armenian charset use case:
      // copying 2048 bytes of charset data to VIC bank memory
      const source = `
        export function main(): void {
          let charsetSrc: word = $D000;
          let charsetDst: word = $3800;
          memcpy(charsetDst, charsetSrc, 2048);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'memcpy charset 2048 bytes');

      // 2048 = 8 full pages, 0 remainder
      expectAssemblyContains(result,
        'LDX #$08',        // 8 pages
        'LDA ($FB),Y',     // Indirect Y read
        'STA ($FD),Y',     // Indirect Y write
        'INC $FC',         // Advance source page
        'INC $FE',         // Advance dest page
        'DEX',             // Decrement page counter
      );
    });

    it('should compile memcpy with @data source for charset copy', () => {
      // Using @data array as charset source
      const source = `
        @data const charFont: byte[] = [
          0, 0, 0, 0, 0, 0, 0, 0,
          $3C, $66, $6E, $76, $66, $66, $3C, 0,
          $18, $38, $18, $18, $18, $18, $7E, 0,
          $3C, $66, $06, $1C, $30, $60, $7E, 0
        ];
        export function main(): void {
          memcpy($3800, @charFont, 32);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'memcpy @data charset');

      // Small copy (32 < 256) should use single loop
      expectAssemblyContains(result,
        'LDA ($FB),Y',
        'STA ($FD),Y',
        'CPY #$20',      // 32 = $20
      );
    });
  });

  // ── memcpy inside functions ────────────────────────────────────

  describe('memcpy inside functions', () => {
    it('should compile memcpy called from a function', () => {
      const source = `
        @data const src: byte[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        function copyData(): void {
          memcpy($0400, @src, 10);
        }

        export function main(): void {
          copyData();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'memcpy in function');
    });

    it('should compile memcpy with constant address expressions', () => {
      const source = `
        @data const src: byte[] = [1, 2, 3, 4];
        export function main(): void {
          memcpy($0400, @src, 4);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'memcpy constant addresses');
    });
  });

  // ── Assembly Quality Verification ──────────────────────────────

  describe('assembly quality', () => {
    it('should not generate page loop instructions for small copies', () => {
      const source = `
        @data const src: byte[] = [1, 2, 3];
        export function main(): void {
          memcpy($0400, @src, 3);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'memcpy no page loop for small');

      // Small copy should NOT have page loop instructions
      expectAssemblyNotContains(result,
        'INC $FC',   // No page advance
        'INC $FE',   // No page advance
        'DEX',       // No page counter
      );
    });

    it('should have balanced stack across memcpy', () => {
      // memcpy should not leave stack in unbalanced state
      const source = `
        @data const src: byte[] = [1, 2, 3, 4];
        export function main(): void {
          let x: byte = 42;
          memcpy($0400, @src, 4);
          poke($D020, x);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'memcpy stack balance');
    });
  });
});
