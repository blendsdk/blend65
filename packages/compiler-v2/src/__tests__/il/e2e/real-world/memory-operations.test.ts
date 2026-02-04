/**
 * IL Generator E2E Test: Memory Operation Patterns
 *
 * Real-world C64 memory block operations common in games.
 * Tests verify that memory manipulation code compiles to proper IL instructions.
 *
 * Pipeline: Source → Lexer → Parser → Semantic → Frame Allocator → IL Generator
 *
 * @module __tests__/il/e2e/real-world/memory-operations
 */

import { describe, it, expect } from 'vitest';
import {
  compileToIL,
  countOpcode,
  hasOpcode,
  getFunction,
  getMainFunction,
  getTotalInstructionCount,
} from '../../helpers/il-test-utils.js';
import { ILOpcode } from '../../../../il/enums.js';

// ============================================================================
// C64 Memory Layout Reference
// ============================================================================

// Screen RAM: $0400-$07E7 (1000 bytes)
// Color RAM: $D800-$DBE7 (1000 bytes)
// Character ROM: $D000-$DFFF (when visible)
// Sprite Pointers: $07F8-$07FF (8 bytes)
// Zero Page: $00-$FF (256 bytes - fast access)

// ============================================================================
// Screen Memory Operations
// ============================================================================

describe('E2E Real-World: Memory Operation Patterns', () => {
  describe('Screen Memory Operations', () => {
    it('should generate IL for screen clear (1000 bytes loop)', () => {
      const source = `
        module ScreenClear;
        
        let screen: byte[1000] = [];
        
        function clearScreen(): void {
          for (let i: word = 0 to 999 step 1) {
            screen[i] = 32;
          }
        }
        
        function main(): void {
          clearScreen();
        }
      `;

      const program = compileToIL(source);
      const clearFunc = getFunction(program, 'clearScreen');
      expect(clearFunc).toBeDefined();

      // Should have loop structure with STORE_BYTE inside
      expect(hasOpcode(clearFunc!.instructions, ILOpcode.LABEL)).toBe(true);
      expect(hasOpcode(clearFunc!.instructions, ILOpcode.JUMP)).toBe(true);
      expect(hasOpcode(clearFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for color memory fill ($D800 range)', () => {
      const source = `
        module ColorFill;
        
        let colorMem: byte[1000] = [];
        
        function fillColor(color: byte): void {
          for (let i: word = 0 to 999 step 1) {
            colorMem[i] = color;
          }
        }
        
        function main(): void {
          fillColor(1);
        }
      `;

      const program = compileToIL(source);
      const fillFunc = getFunction(program, 'fillColor');
      expect(fillFunc).toBeDefined();

      // Should have loop and store
      expect(hasOpcode(fillFunc!.instructions, ILOpcode.LABEL)).toBe(true);
      expect(hasOpcode(fillFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for screen row copy pattern', () => {
      const source = `
        module ScreenRowCopy;
        
        let screen: byte[1000] = [];
        
        function copyRow(srcRow: word, destRow: word): void {
          let srcOffset: word = srcRow * 40;
          let destOffset: word = destRow * 40;
          
          for (let i: byte = 0 to 39 step 1) {
            screen[destOffset] = screen[srcOffset];
            srcOffset = srcOffset + 1;
            destOffset = destOffset + 1;
          }
        }
        
        function main(): void {
          copyRow(0, 1);
        }
      `;

      const program = compileToIL(source);
      const copyFunc = getFunction(program, 'copyRow');
      expect(copyFunc).toBeDefined();

      // Should have MUL for offset calculation (multiply by immediate)
      expect(hasOpcode(copyFunc!.instructions, ILOpcode.MUL_IMM)).toBe(true);
      
      // Should have LOAD and STORE for copy
      expect(hasOpcode(copyFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(copyFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });
  });

  // ============================================================================
  // Memory Copy Operations
  // ============================================================================

  describe('Memory Copy Operations', () => {
    it('should generate IL for byte-by-byte memory copy', () => {
      const source = `
        module MemCopy;
        
        let source: byte[64] = [];
        let dest: byte[64] = [];
        
        function copyBytes(count: byte): void {
          for (let i: byte = 0 to count step 1) {
            if (i < 64) {
              dest[i] = source[i];
            }
          }
        }
        
        function main(): void {
          copyBytes(32);
        }
      `;

      const program = compileToIL(source);
      const copyFunc = getFunction(program, 'copyBytes');
      expect(copyFunc).toBeDefined();

      // Should have array access pattern
      expect(hasOpcode(copyFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(copyFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for memory fill with constant', () => {
      const source = `
        module MemFill;
        
        let buffer: byte[256] = [];
        
        function fillBuffer(value: byte): void {
          for (let i: byte = 0 to 255 step 1) {
            buffer[i] = value;
          }
        }
        
        function main(): void {
          fillBuffer(0);
        }
      `;

      const program = compileToIL(source);
      const fillFunc = getFunction(program, 'fillBuffer');
      expect(fillFunc).toBeDefined();

      // Should have loop structure
      expect(hasOpcode(fillFunc!.instructions, ILOpcode.LABEL)).toBe(true);
      expect(hasOpcode(fillFunc!.instructions, ILOpcode.JUMP)).toBe(true);
    });

    it('should generate IL for character data copy to RAM', () => {
      const source = `
        module CharCopy;
        
        let charData: byte[8] = [0, 24, 60, 126, 126, 60, 24, 0];
        let destChar: byte[8] = [];
        
        function copyCharacter(): void {
          for (let i: byte = 0 to 7 step 1) {
            destChar[i] = charData[i];
          }
        }
        
        function main(): void {
          copyCharacter();
        }
      `;

      const program = compileToIL(source);
      const copyFunc = getFunction(program, 'copyCharacter');
      expect(copyFunc).toBeDefined();

      expect(hasOpcode(copyFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(copyFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });
  });

  // ============================================================================
  // Bitmap Memory Operations
  // ============================================================================

  describe('Bitmap Memory Operations', () => {
    it('should generate IL for bitmap clear pattern', () => {
      const source = `
        module BitmapClear;
        
        let bitmap: byte[8000] = [];
        
        function clearBitmap(): void {
          for (let i: word = 0 to 7999 step 1) {
            bitmap[i] = 0;
          }
        }
        
        function main(): void {
          clearBitmap();
        }
      `;

      const program = compileToIL(source);
      const clearFunc = getFunction(program, 'clearBitmap');
      expect(clearFunc).toBeDefined();

      // Should have large loop
      expect(hasOpcode(clearFunc!.instructions, ILOpcode.LABEL)).toBe(true);
      expect(hasOpcode(clearFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for bitmap line pattern', () => {
      const source = `
        module BitmapLine;
        
        let bitmap: byte[8000] = [];
        
        function drawHorizontalLine(y: byte, pattern: byte): void {
          let offset: word = y * 320;
          
          for (let x: word = 0 to 39 step 1) {
            bitmap[offset + x * 8] = pattern;
          }
        }
        
        function main(): void {
          drawHorizontalLine(100, 255);
        }
      `;

      const program = compileToIL(source);
      const drawFunc = getFunction(program, 'drawHorizontalLine');
      expect(drawFunc).toBeDefined();

      // Should have multiplication for offset (multiply by immediate)
      expect(hasOpcode(drawFunc!.instructions, ILOpcode.MUL_IMM)).toBe(true);
    });
  });

  // ============================================================================
  // Zero Page Operations
  // ============================================================================

  describe('Zero Page Operations', () => {
    it('should generate IL for zero page variable block init', () => {
      const source = `
        module ZPInit;
        
        let zpVars: byte[16] = [];
        
        function initZeroPage(): void {
          for (let i: byte = 0 to 15 step 1) {
            zpVars[i] = 0;
          }
        }
        
        function main(): void {
          initZeroPage();
        }
      `;

      const program = compileToIL(source);
      const initFunc = getFunction(program, 'initZeroPage');
      expect(initFunc).toBeDefined();

      expect(hasOpcode(initFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for fast zero page swap', () => {
      const source = `
        module ZPSwap;
        
        let zpA: byte = 0;
        let zpB: byte = 0;
        
        function swapZP(): void {
          let temp: byte = zpA;
          zpA = zpB;
          zpB = temp;
        }
        
        function main(): void {
          swapZP();
        }
      `;

      const program = compileToIL(source);
      const swapFunc = getFunction(program, 'swapZP');
      expect(swapFunc).toBeDefined();

      // Should have multiple LOAD_BYTE and STORE_BYTE
      const loadCount = countOpcode(swapFunc!.instructions, ILOpcode.LOAD_BYTE);
      const storeCount = countOpcode(swapFunc!.instructions, ILOpcode.STORE_BYTE);

      expect(loadCount).toBeGreaterThanOrEqual(2);
      expect(storeCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // Double Buffer Operations
  // ============================================================================

  describe('Double Buffer Operations', () => {
    it('should generate IL for double buffer swap (pointer update)', () => {
      const source = `
        module DoubleBuffer;
        
        let currentBuffer: byte = 0;
        let buffer0Start: word = 1024;
        let buffer1Start: word = 2024;
        
        function swapBuffers(): void {
          if (currentBuffer == 0) {
            currentBuffer = 1;
          } else {
            currentBuffer = 0;
          }
        }
        
        function getCurrentBuffer(): word {
          if (currentBuffer == 0) {
            return buffer0Start;
          }
          return buffer1Start;
        }
        
        function main(): void {
          swapBuffers();
          let addr: word = getCurrentBuffer();
        }
      `;

      const program = compileToIL(source);
      const swapFunc = getFunction(program, 'swapBuffers');
      const getFunc = getFunction(program, 'getCurrentBuffer');

      expect(swapFunc).toBeDefined();
      expect(getFunc).toBeDefined();

      // Swap should have comparison and conditional
      expect(hasOpcode(swapFunc!.instructions, ILOpcode.CMP_IMM)).toBe(true);
    });
  });

  // ============================================================================
  // Memory Block Compare
  // ============================================================================

  describe('Memory Block Compare', () => {
    it('should generate IL for memory block compare', () => {
      const source = `
        module MemCompare;
        
        let block1: byte[16] = [];
        let block2: byte[16] = [];
        
        function compareBlocks(): byte {
          for (let i: byte = 0 to 15 step 1) {
            if (block1[i] != block2[i]) {
              return 0;
            }
          }
          return 1;
        }
        
        function main(): void {
          let same: byte = compareBlocks();
        }
      `;

      const program = compileToIL(source);
      const cmpFunc = getFunction(program, 'compareBlocks');
      expect(cmpFunc).toBeDefined();

      // Should have comparison and conditional jumps
      expect(hasOpcode(cmpFunc!.instructions, ILOpcode.CMP_BYTE)).toBe(true);
    });

    it('should generate IL for find byte in memory pattern', () => {
      const source = `
        module MemFind;
        
        let searchBuffer: byte[64] = [];
        
        function findByte(value: byte): byte {
          for (let i: byte = 0 to 63 step 1) {
            if (searchBuffer[i] == value) {
              return i;
            }
          }
          return 255;
        }
        
        function main(): void {
          let pos: byte = findByte(42);
        }
      `;

      const program = compileToIL(source);
      const findFunc = getFunction(program, 'findByte');
      expect(findFunc).toBeDefined();

      // Should have comparison with parameter
      expect(hasOpcode(findFunc!.instructions, ILOpcode.CMP_BYTE)).toBe(true);
      // Should have RETURN for early exit
      expect(hasOpcode(findFunc!.instructions, ILOpcode.RETURN)).toBe(true);
    });
  });

  // ============================================================================
  // Incremental Memory Operations
  // ============================================================================

  describe('Incremental Memory Operations', () => {
    it('should generate IL for screen scroll up pattern', () => {
      const source = `
        module ScrollUp;
        
        let screen: byte[1000] = [];
        
        function scrollUp(): void {
          for (let row: byte = 0 to 23 step 1) {
            let destOffset: word = row * 40;
            let srcOffset: word = (row + 1) * 40;
            
            for (let col: byte = 0 to 39 step 1) {
              screen[destOffset] = screen[srcOffset];
              destOffset = destOffset + 1;
              srcOffset = srcOffset + 1;
            }
          }
        }
        
        function main(): void {
          scrollUp();
        }
      `;

      const program = compileToIL(source);
      const scrollFunc = getFunction(program, 'scrollUp');
      expect(scrollFunc).toBeDefined();

      // Should have nested loops (multiple labels/jumps)
      const labelCount = countOpcode(scrollFunc!.instructions, ILOpcode.LABEL);
      const jumpCount = countOpcode(scrollFunc!.instructions, ILOpcode.JUMP);

      expect(labelCount).toBeGreaterThanOrEqual(4); // Outer and inner loop labels
      expect(jumpCount).toBeGreaterThanOrEqual(2); // Outer and inner loop jumps
    });

    it('should generate IL for memory checksum pattern', () => {
      const source = `
        module Checksum;
        
        let data: byte[64] = [];
        
        function calculateChecksum(): byte {
          let sum: byte = 0;
          for (let i: byte = 0 to 63 step 1) {
            sum = sum ^ data[i];
          }
          return sum;
        }
        
        function main(): void {
          let check: byte = calculateChecksum();
        }
      `;

      const program = compileToIL(source);
      const checksumFunc = getFunction(program, 'calculateChecksum');
      expect(checksumFunc).toBeDefined();

      // Should have XOR for checksum
      expect(hasOpcode(checksumFunc!.instructions, ILOpcode.XOR_BYTE)).toBe(true);
    });
  });
});