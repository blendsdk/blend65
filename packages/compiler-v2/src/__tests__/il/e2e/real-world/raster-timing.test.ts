/**
 * IL Generator E2E Test: Raster Timing Patterns
 *
 * Real-world C64 raster-synchronized code patterns.
 * Tests verify that timing-critical code compiles to proper IL instructions.
 *
 * Pipeline: Source → Lexer → Parser → Semantic → Frame Allocator → IL Generator
 *
 * @module __tests__/il/e2e/real-world/raster-timing
 */

import { describe, it, expect } from 'vitest';
import {
  compileToIL,
  countOpcode,
  hasOpcode,
  getFunction,
  getMainFunction,
} from '../../helpers/il-test-utils.js';
import { ILOpcode } from '../../../../il/enums.js';

// ============================================================================
// C64 Raster Reference
// ============================================================================

// VIC-II Raster:
// $D012: Current raster line (low 8 bits, read) / Raster compare (write)
// $D011 bit 7: Raster line bit 8 (for lines 256-311)
// $D019 bit 0: Raster interrupt flag
// $D01A bit 0: Raster interrupt enable
//
// NTSC: 262 lines (0-261), ~60 Hz
// PAL: 312 lines (0-311), ~50 Hz
// Visible area: approximately lines 51-250

// ============================================================================
// Basic Raster Wait
// ============================================================================

describe('E2E Real-World: Raster Timing Patterns', () => {
  describe('Basic Raster Wait', () => {
    it('should generate IL for wait for specific raster line', () => {
      const source = `
        module RasterWait;
        
        const RASTER_LINE: word = $D012;
        
        function waitForLine(line: byte): void {
          while (volatile_read(RASTER_LINE) != line) {
            let wait: byte = 0;
          }
        }
        
        function main(): void {
          waitForLine(100);
        }
      `;

      const program = compileToIL(source);
      const waitFunc = getFunction(program, 'waitForLine');
      expect(waitFunc).toBeDefined();

      // Should have LOAD, CMP, conditional JUMP, unconditional JUMP
      expect(hasOpcode(waitFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(waitFunc!.instructions, ILOpcode.CMP_BYTE)).toBe(true);
      expect(hasOpcode(waitFunc!.instructions, ILOpcode.JUMP)).toBe(true);
      expect(hasOpcode(waitFunc!.instructions, ILOpcode.LABEL)).toBe(true);
    });

    it('should generate IL for raster compare loop', () => {
      const source = `
        module RasterCompare;
        
        const RASTER_LINE: word = $D012;
        
        function waitUntilRaster(target: byte): void {
          while (volatile_read(RASTER_LINE) < target) {
            let spin: byte = 0;
          }
        }
        
        function main(): void {
          waitUntilRaster(250);
        }
      `;

      const program = compileToIL(source);
      const waitFunc = getFunction(program, 'waitUntilRaster');
      expect(waitFunc).toBeDefined();

      expect(hasOpcode(waitFunc!.instructions, ILOpcode.CMP_BYTE)).toBe(true);
    });

    it('should generate IL for top of screen detection (line 0)', () => {
      const source = `
        module TopOfScreen;
        
        const RASTER_LINE: word = $D012;
        
        function waitForTopOfScreen(): void {
          while (volatile_read(RASTER_LINE) != 0) {
            let wait: byte = 0;
          }
        }
        
        function main(): void {
          waitForTopOfScreen();
        }
      `;

      const program = compileToIL(source);
      const waitFunc = getFunction(program, 'waitForTopOfScreen');
      expect(waitFunc).toBeDefined();

      expect(hasOpcode(waitFunc!.instructions, ILOpcode.CMP_IMM)).toBe(true);
    });

    it('should generate IL for bottom of screen detection (line 255)', () => {
      const source = `
        module BottomOfScreen;
        
        const RASTER_LINE: word = $D012;
        
        function waitForBottomOfScreen(): void {
          while (volatile_read(RASTER_LINE) != 255) {
            let wait: byte = 0;
          }
        }
        
        function main(): void {
          waitForBottomOfScreen();
        }
      `;

      const program = compileToIL(source);
      const waitFunc = getFunction(program, 'waitForBottomOfScreen');
      expect(waitFunc).toBeDefined();

      expect(hasOpcode(waitFunc!.instructions, ILOpcode.CMP_IMM)).toBe(true);
    });
  });

  // ============================================================================
  // Raster Bar Effects
  // ============================================================================

  describe('Raster Bar Effects', () => {
    it('should generate IL for raster bar color change', () => {
      const source = `
        module RasterBar;
        
        const RASTER_LINE: word = $D012;
        const BORDER_COLOR: word = $D020;
        
        let colors: byte[8] = [0, 6, 14, 3, 1, 3, 14, 6];
        
        function drawRasterBar(startLine: byte): void {
          for (let i: byte = 0 to 7 step 1) {
            let targetLine: byte = startLine + i;
            while (volatile_read(RASTER_LINE) != targetLine) {
              let wait: byte = 0;
            }
            poke(BORDER_COLOR, colors[i]);
          }
        }
        
        function main(): void {
          drawRasterBar(100);
        }
      `;

      const program = compileToIL(source);
      const drawFunc = getFunction(program, 'drawRasterBar');
      expect(drawFunc).toBeDefined();

      // Should have nested loop (for + while)
      const labelCount = countOpcode(drawFunc!.instructions, ILOpcode.LABEL);
      expect(labelCount).toBeGreaterThanOrEqual(4);

      // Should have array access and POKE via poke() intrinsic
      expect(hasOpcode(drawFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(drawFunc!.instructions, ILOpcode.POKE)).toBe(true);
    });

    it('should generate IL for multi-color raster effect', () => {
      const source = `
        module MultiColorRaster;
        
        const RASTER_LINE: word = $D012;
        const BG_COLOR: word = $D021;
        
        function colorSplit(line1: byte, color1: byte, line2: byte, color2: byte): void {
          while (volatile_read(RASTER_LINE) != line1) {
            let wait: byte = 0;
          }
          poke(BG_COLOR, color1);
          
          while (volatile_read(RASTER_LINE) != line2) {
            let wait: byte = 0;
          }
          poke(BG_COLOR, color2);
        }
        
        function main(): void {
          colorSplit(50, 0, 150, 6);
        }
      `;

      const program = compileToIL(source);
      const splitFunc = getFunction(program, 'colorSplit');
      expect(splitFunc).toBeDefined();

      // poke() intrinsic generates POKE opcode - should have 2 POKE for color changes
      const pokeCount = countOpcode(splitFunc!.instructions, ILOpcode.POKE);
      expect(pokeCount).toBe(2);
    });
  });

  // ============================================================================
  // Split Screen
  // ============================================================================

  describe('Split Screen', () => {
    it('should generate IL for split screen boundary detection', () => {
      const source = `
        module SplitScreen;
        
        const RASTER_LINE: word = $D012;
        const MEM_CONTROL: word = $D018;
        
        let screenConfig1: byte = $14;
        let screenConfig2: byte = $18;
        
        function handleSplitScreen(splitLine: byte): void {
          while (volatile_read(RASTER_LINE) != splitLine) {
            let wait: byte = 0;
          }
          poke(MEM_CONTROL, screenConfig2);
        }
        
        function main(): void {
          handleSplitScreen(128);
        }
      `;

      const program = compileToIL(source);
      const splitFunc = getFunction(program, 'handleSplitScreen');
      expect(splitFunc).toBeDefined();

      // poke() intrinsic generates POKE opcode
      expect(hasOpcode(splitFunc!.instructions, ILOpcode.POKE)).toBe(true);
    });
  });

  // ============================================================================
  // Interrupt Trigger
  // ============================================================================

  describe('Raster Interrupt Setup', () => {
    it('should generate IL for raster interrupt trigger line setup', () => {
      const source = `
        module RasterIRQ;
        
        const RASTER_COMPARE: word = $D012;
        const VIC_CONTROL: word = $D011;
        const IRQ_ENABLE: word = $D01A;
        
        function setupRasterIRQ(line: byte, highBit: byte): void {
          poke(RASTER_COMPARE, line);
          
          if (highBit > 0) {
            poke(VIC_CONTROL, peek(VIC_CONTROL) | 128);
          } else {
            poke(VIC_CONTROL, peek(VIC_CONTROL) & 127);
          }
          
          poke(IRQ_ENABLE, peek(IRQ_ENABLE) | 1);
        }
        
        function main(): void {
          setupRasterIRQ(100, 0);
        }
      `;

      const program = compileToIL(source);
      const setupFunc = getFunction(program, 'setupRasterIRQ');
      expect(setupFunc).toBeDefined();

      // Should have OR and AND for bit manipulation
      const hasOr =
        hasOpcode(setupFunc!.instructions, ILOpcode.OR_IMM) ||
        hasOpcode(setupFunc!.instructions, ILOpcode.OR_BYTE);
      const hasAnd =
        hasOpcode(setupFunc!.instructions, ILOpcode.AND_IMM) ||
        hasOpcode(setupFunc!.instructions, ILOpcode.AND_BYTE);

      expect(hasOr).toBe(true);
      expect(hasAnd).toBe(true);
    });
  });

  // ============================================================================
  // Stable Raster
  // ============================================================================

  describe('Stable Raster', () => {
    it('should generate IL for stable raster wait pattern', () => {
      const source = `
        module StableRaster;
        
        const RASTER_LINE: word = $D012;
        
        function stableWait(line: byte): void {
          while (volatile_read(RASTER_LINE) != line) {
            let wait: byte = 0;
          }
          
          while (volatile_read(RASTER_LINE) == line) {
            let stable: byte = 0;
          }
        }
        
        function main(): void {
          stableWait(100);
        }
      `;

      const program = compileToIL(source);
      const stableFunc = getFunction(program, 'stableWait');
      expect(stableFunc).toBeDefined();

      // Should have two while loops
      const labelCount = countOpcode(stableFunc!.instructions, ILOpcode.LABEL);
      expect(labelCount).toBeGreaterThanOrEqual(4);
    });

    it('should generate IL for cycle-counted delay loop', () => {
      const source = `
        module CycleDelay;
        
        function delayLoops(count: byte): void {
          for (let i: byte = 0 to count step 1) {
            let nop: byte = 0;
          }
        }
        
        function main(): void {
          delayLoops(10);
        }
      `;

      const program = compileToIL(source);
      const delayFunc = getFunction(program, 'delayLoops');
      expect(delayFunc).toBeDefined();

      // Should have loop structure
      expect(hasOpcode(delayFunc!.instructions, ILOpcode.LABEL)).toBe(true);
      expect(hasOpcode(delayFunc!.instructions, ILOpcode.JUMP)).toBe(true);
    });
  });

  // ============================================================================
  // Vertical Blank
  // ============================================================================

  describe('Vertical Blank Detection', () => {
    it('should generate IL for vertical blank detection', () => {
      const source = `
        module VBlank;
        
        const RASTER_LINE: word = $D012;
        
        function waitForVBlank(): void {
          while (volatile_read(RASTER_LINE) < 251) {
            let wait: byte = 0;
          }
        }
        
        function main(): void {
          waitForVBlank();
        }
      `;

      const program = compileToIL(source);
      const waitFunc = getFunction(program, 'waitForVBlank');
      expect(waitFunc).toBeDefined();

      expect(hasOpcode(waitFunc!.instructions, ILOpcode.CMP_IMM)).toBe(true);
    });

    it('should generate IL for frame sync pattern', () => {
      const source = `
        module FrameSync;
        
        const RASTER_LINE: word = $D012;
        let lastFrameRaster: byte = 0;
        
        function waitNextFrame(): void {
          while (volatile_read(RASTER_LINE) >= 200) {
            let wait: byte = 0;
          }
          
          while (volatile_read(RASTER_LINE) < 200) {
            let wait: byte = 0;
          }
        }
        
        function main(): void {
          waitNextFrame();
        }
      `;

      const program = compileToIL(source);
      const syncFunc = getFunction(program, 'waitNextFrame');
      expect(syncFunc).toBeDefined();

      // Should have two comparison loops
      const cmpCount = countOpcode(syncFunc!.instructions, ILOpcode.CMP_IMM);
      expect(cmpCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // PAL/NTSC Detection
  // ============================================================================

  describe('PAL/NTSC Detection', () => {
    it('should generate IL for PAL/NTSC detection pattern', () => {
      const source = `
        module SystemDetect;
        
        const RASTER_LINE: word = $D012;
        
        function detectSystem(): byte {
          while (volatile_read(RASTER_LINE) != 0) {
            let wait: byte = 0;
          }
          
          let maxLine: byte = 0;
          let prevLine: byte = 0;
          
          for (let i: word = 0 to 400 step 1) {
            let current: byte = volatile_read(RASTER_LINE);
            if (current > maxLine) {
              maxLine = current;
            }
          }
          
          if (maxLine > 255) {
            return 1;
          }
          return 0;
        }
        
        function main(): void {
          let isPAL: byte = detectSystem();
        }
      `;

      const program = compileToIL(source);
      const detectFunc = getFunction(program, 'detectSystem');
      expect(detectFunc).toBeDefined();

      // Should have nested loops
      expect(hasOpcode(detectFunc!.instructions, ILOpcode.LABEL)).toBe(true);
      expect(hasOpcode(detectFunc!.instructions, ILOpcode.JUMP)).toBe(true);
    });
  });
});