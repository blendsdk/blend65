/**
 * IL Generator E2E Test: Joystick & Keyboard Patterns
 *
 * Real-world C64 input handling patterns for games.
 * Tests verify that input reading code compiles to proper IL instructions.
 *
 * Pipeline: Source → Lexer → Parser → Semantic → Frame Allocator → IL Generator
 *
 * @module __tests__/il/e2e/real-world/joystick-keyboard
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
// C64 Input Reference
// ============================================================================

// Joystick Port 1: $DC01 (active low bits)
// Joystick Port 2: $DC00 (active low bits)
// Bit 0: Up
// Bit 1: Down
// Bit 2: Left
// Bit 3: Right
// Bit 4: Fire button

// Keyboard matrix via CIA:
// $DC00: Column select
// $DC01: Row read

// ============================================================================
// Joystick Reading
// ============================================================================

describe('E2E Real-World: Joystick & Keyboard Patterns', () => {
  describe('Joystick Port Reading', () => {
    it('should generate IL for joystick port 1 reading ($DC00)', () => {
      const source = `
        module Joy1;
        
        @map joy1 at $DC00: byte;
        
        function readJoystick1(): byte {
          return joy1;
        }
        
        function main(): void {
          let input: byte = readJoystick1();
        }
      `;

      const program = compileToIL(source);
      const readFunc = getFunction(program, 'readJoystick1');
      expect(readFunc).toBeDefined();

      // Should have LOAD_BYTE and RETURN
      expect(hasOpcode(readFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(readFunc!.instructions, ILOpcode.RETURN)).toBe(true);
    });

    it('should generate IL for joystick port 2 reading ($DC01)', () => {
      const source = `
        module Joy2;
        
        @map joy2 at $DC01: byte;
        
        function readJoystick2(): byte {
          return joy2;
        }
        
        function main(): void {
          let input: byte = readJoystick2();
        }
      `;

      const program = compileToIL(source);
      const readFunc = getFunction(program, 'readJoystick2');
      expect(readFunc).toBeDefined();

      expect(hasOpcode(readFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
    });
  });

  // ============================================================================
  // Direction Extraction
  // ============================================================================

  describe('Direction Bit Extraction', () => {
    it('should generate IL for up direction extraction (bit 0)', () => {
      const source = `
        module JoyUp;
        
        @map joy at $DC00: byte;
        
        function isUp(): byte {
          let raw: byte = joy & 1;
          if (raw == 0) {
            return 1;
          }
          return 0;
        }
        
        function main(): void {
          let up: byte = isUp();
        }
      `;

      const program = compileToIL(source);
      const isUpFunc = getFunction(program, 'isUp');
      expect(isUpFunc).toBeDefined();

      // Should have AND for bit extraction
      expect(hasOpcode(isUpFunc!.instructions, ILOpcode.AND_IMM)).toBe(true);
      // Should have CMP for checking
      expect(hasOpcode(isUpFunc!.instructions, ILOpcode.CMP_IMM)).toBe(true);
    });

    it('should generate IL for down direction extraction (bit 1)', () => {
      const source = `
        module JoyDown;
        
        @map joy at $DC00: byte;
        
        function isDown(): byte {
          let raw: byte = joy & 2;
          if (raw == 0) {
            return 1;
          }
          return 0;
        }
        
        function main(): void {
          let down: byte = isDown();
        }
      `;

      const program = compileToIL(source);
      const isDownFunc = getFunction(program, 'isDown');
      expect(isDownFunc).toBeDefined();

      expect(hasOpcode(isDownFunc!.instructions, ILOpcode.AND_IMM)).toBe(true);
    });

    it('should generate IL for left direction extraction (bit 2)', () => {
      const source = `
        module JoyLeft;
        
        @map joy at $DC00: byte;
        
        function isLeft(): byte {
          let raw: byte = joy & 4;
          if (raw == 0) {
            return 1;
          }
          return 0;
        }
        
        function main(): void {
          let left: byte = isLeft();
        }
      `;

      const program = compileToIL(source);
      const isLeftFunc = getFunction(program, 'isLeft');
      expect(isLeftFunc).toBeDefined();

      expect(hasOpcode(isLeftFunc!.instructions, ILOpcode.AND_IMM)).toBe(true);
    });

    it('should generate IL for right direction extraction (bit 3)', () => {
      const source = `
        module JoyRight;
        
        @map joy at $DC00: byte;
        
        function isRight(): byte {
          let raw: byte = joy & 8;
          if (raw == 0) {
            return 1;
          }
          return 0;
        }
        
        function main(): void {
          let right: byte = isRight();
        }
      `;

      const program = compileToIL(source);
      const isRightFunc = getFunction(program, 'isRight');
      expect(isRightFunc).toBeDefined();

      expect(hasOpcode(isRightFunc!.instructions, ILOpcode.AND_IMM)).toBe(true);
    });

    it('should generate IL for fire button detection (bit 4)', () => {
      const source = `
        module JoyFire;
        
        @map joy at $DC00: byte;
        
        function isFire(): byte {
          let raw: byte = joy & 16;
          if (raw == 0) {
            return 1;
          }
          return 0;
        }
        
        function main(): void {
          let fire: byte = isFire();
        }
      `;

      const program = compileToIL(source);
      const isFireFunc = getFunction(program, 'isFire');
      expect(isFireFunc).toBeDefined();

      expect(hasOpcode(isFireFunc!.instructions, ILOpcode.AND_IMM)).toBe(true);
      expect(hasOpcode(isFireFunc!.instructions, ILOpcode.CMP_IMM)).toBe(true);
    });
  });

  // ============================================================================
  // Combined Movement
  // ============================================================================

  describe('Combined Movement Detection', () => {
    it('should generate IL for diagonal movement (combined bits)', () => {
      const source = `
        module JoyDiagonal;
        
        @map joy at $DC00: byte;
        
        function isUpRight(): byte {
          let mask: byte = 1 + 8;
          let raw: byte = joy & mask;
          if (raw == 0) {
            return 1;
          }
          return 0;
        }
        
        function main(): void {
          let upRight: byte = isUpRight();
        }
      `;

      const program = compileToIL(source);
      const isDiagFunc = getFunction(program, 'isUpRight');
      expect(isDiagFunc).toBeDefined();

      // Should have ADD for mask creation
      expect(hasOpcode(isDiagFunc!.instructions, ILOpcode.ADD_IMM)).toBe(true);
      // Should have AND for extraction
      expect(hasOpcode(isDiagFunc!.instructions, ILOpcode.AND_BYTE)).toBe(true);
    });

    it('should generate IL for all-direction handler pattern', () => {
      const source = `
        module JoyHandler;
        
        @map joy at $DC00: byte;
        
        let playerX: byte = 128;
        let playerY: byte = 128;
        
        function handleJoystick(): void {
          let input: byte = joy;
          
          if ((input & 1) == 0) {
            playerY = playerY - 1;
          }
          if ((input & 2) == 0) {
            playerY = playerY + 1;
          }
          if ((input & 4) == 0) {
            playerX = playerX - 1;
          }
          if ((input & 8) == 0) {
            playerX = playerX + 1;
          }
        }
        
        function main(): void {
          handleJoystick();
        }
      `;

      const program = compileToIL(source);
      const handleFunc = getFunction(program, 'handleJoystick');
      expect(handleFunc).toBeDefined();

      // Should have multiple AND for bit checks
      const andCount = countOpcode(handleFunc!.instructions, ILOpcode.AND_IMM);
      expect(andCount).toBe(4);

      // Should have ADD and SUB for movement
      const hasAdd =
        hasOpcode(handleFunc!.instructions, ILOpcode.ADD_IMM) ||
        hasOpcode(handleFunc!.instructions, ILOpcode.INC_BYTE);
      const hasSub =
        hasOpcode(handleFunc!.instructions, ILOpcode.SUB_IMM) ||
        hasOpcode(handleFunc!.instructions, ILOpcode.DEC_BYTE);

      expect(hasAdd).toBe(true);
      expect(hasSub).toBe(true);
    });
  });

  // ============================================================================
  // Debounce Pattern
  // ============================================================================

  describe('Debounce Pattern', () => {
    it('should generate IL for debounce pattern (last vs current)', () => {
      const source = `
        module JoyDebounce;
        
        @map joy at $DC00: byte;
        let lastInput: byte = 255;
        
        function isNewPress(): byte {
          let current: byte = joy;
          let newPress: byte = (lastInput ^ current) & current;
          lastInput = current;
          return newPress;
        }
        
        function main(): void {
          let pressed: byte = isNewPress();
        }
      `;

      const program = compileToIL(source);
      const debounceFunc = getFunction(program, 'isNewPress');
      expect(debounceFunc).toBeDefined();

      // Should have XOR for detecting changes
      expect(hasOpcode(debounceFunc!.instructions, ILOpcode.XOR_BYTE)).toBe(true);
      // Should have AND for masking
      expect(hasOpcode(debounceFunc!.instructions, ILOpcode.AND_BYTE)).toBe(true);
    });

    it('should generate IL for fire button debounce', () => {
      const source = `
        module FireDebounce;
        
        @map joy at $DC00: byte;
        let lastFire: byte = 1;
        
        function checkFirePressed(): byte {
          let currentFire: byte = joy & 16;
          
          if (currentFire == 0) {
            if (lastFire != 0) {
              lastFire = 0;
              return 1;
            }
          } else {
            lastFire = 1;
          }
          return 0;
        }
        
        function main(): void {
          let fired: byte = checkFirePressed();
        }
      `;

      const program = compileToIL(source);
      const checkFunc = getFunction(program, 'checkFirePressed');
      expect(checkFunc).toBeDefined();

      // Should have nested conditionals
      const cmpCount = countOpcode(checkFunc!.instructions, ILOpcode.CMP_IMM);
      expect(cmpCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // Input Buffer Pattern
  // ============================================================================

  describe('Input Buffer Pattern', () => {
    it('should generate IL for input buffer pattern', () => {
      const source = `
        module InputBuffer;
        
        @map joy at $DC00: byte;
        let inputBuffer: byte[8] = [];
        let bufferIndex: byte = 0;
        
        function recordInput(): void {
          inputBuffer[bufferIndex] = joy;
          bufferIndex = bufferIndex + 1;
          if (bufferIndex >= 8) {
            bufferIndex = 0;
          }
        }
        
        function main(): void {
          recordInput();
        }
      `;

      const program = compileToIL(source);
      const recordFunc = getFunction(program, 'recordInput');
      expect(recordFunc).toBeDefined();

      // Should have array store
      expect(hasOpcode(recordFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
      // Should have increment and compare
      expect(hasOpcode(recordFunc!.instructions, ILOpcode.CMP_IMM)).toBe(true);
    });

    it('should generate IL for input history check', () => {
      const source = `
        module InputHistory;
        
        let inputHistory: byte[4] = [];
        let historyIndex: byte = 0;
        
        function checkSequence(expected: byte): byte {
          let i: byte = historyIndex;
          
          for (let count: byte = 0 to 3 step 1) {
            if (inputHistory[i] != expected) {
              return 0;
            }
            i = i + 1;
            if (i >= 4) {
              i = 0;
            }
          }
          return 1;
        }
        
        function main(): void {
          let match: byte = checkSequence(1);
        }
      `;

      const program = compileToIL(source);
      const checkFunc = getFunction(program, 'checkSequence');
      expect(checkFunc).toBeDefined();

      // Should have loop with comparison
      expect(hasOpcode(checkFunc!.instructions, ILOpcode.LABEL)).toBe(true);
      expect(hasOpcode(checkFunc!.instructions, ILOpcode.CMP_BYTE)).toBe(true);
    });
  });

  // ============================================================================
  // Keyboard Matrix (Simplified)
  // ============================================================================

  describe('Keyboard Matrix Pattern', () => {
    it('should generate IL for keyboard column select and row read', () => {
      const source = `
        module Keyboard;
        
        @map keyColumn at $DC00: byte;
        @map keyRow at $DC01: byte;
        
        function checkKey(column: byte): byte {
          keyColumn = column;
          return keyRow;
        }
        
        function main(): void {
          let row: byte = checkKey(254);
        }
      `;

      const program = compileToIL(source);
      const checkFunc = getFunction(program, 'checkKey');
      expect(checkFunc).toBeDefined();

      // Should have STORE for column select and LOAD for row read
      expect(hasOpcode(checkFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
      expect(hasOpcode(checkFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
    });

    it('should generate IL for keyboard scan pattern', () => {
      const source = `
        module KeyScan;
        
        @map keyColumn at $DC00: byte;
        @map keyRow at $DC01: byte;
        
        function scanKeyboard(): byte {
          let column: byte = 254;
          
          for (let i: byte = 0 to 7 step 1) {
            keyColumn = column;
            let row: byte = keyRow;
            
            if (row != 255) {
              return i;
            }
            
            column = (column * 2) | 1;
          }
          
          return 255;
        }
        
        function main(): void {
          let key: byte = scanKeyboard();
        }
      `;

      const program = compileToIL(source);
      const scanFunc = getFunction(program, 'scanKeyboard');
      expect(scanFunc).toBeDefined();

      // Should have loop with shift-like operation
      expect(hasOpcode(scanFunc!.instructions, ILOpcode.MUL_BYTE)).toBe(true);
      expect(hasOpcode(scanFunc!.instructions, ILOpcode.OR_IMM)).toBe(true);
    });
  });

  // ============================================================================
  // Multi-Player Input
  // ============================================================================

  describe('Multi-Player Input', () => {
    it('should generate IL for two-player joystick reading', () => {
      const source = `
        module TwoPlayer;
        
        @map joy1 at $DC01: byte;
        @map joy2 at $DC00: byte;
        
        let player1X: byte = 64;
        let player1Y: byte = 128;
        let player2X: byte = 192;
        let player2Y: byte = 128;
        
        function updatePlayers(): void {
          let input1: byte = joy1;
          let input2: byte = joy2;
          
          if ((input1 & 4) == 0) {
            player1X = player1X - 1;
          }
          if ((input1 & 8) == 0) {
            player1X = player1X + 1;
          }
          
          if ((input2 & 4) == 0) {
            player2X = player2X - 1;
          }
          if ((input2 & 8) == 0) {
            player2X = player2X + 1;
          }
        }
        
        function main(): void {
          updatePlayers();
        }
      `;

      const program = compileToIL(source);
      const updateFunc = getFunction(program, 'updatePlayers');
      expect(updateFunc).toBeDefined();

      // Should have multiple loads from both ports
      const loadCount = countOpcode(updateFunc!.instructions, ILOpcode.LOAD_BYTE);
      expect(loadCount).toBeGreaterThanOrEqual(2);

      // Should have multiple AND for bit checks
      const andCount = countOpcode(updateFunc!.instructions, ILOpcode.AND_IMM);
      expect(andCount).toBe(4);
    });
  });
});