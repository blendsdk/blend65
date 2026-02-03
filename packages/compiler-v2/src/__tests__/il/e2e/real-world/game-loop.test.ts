/**
 * IL Generator E2E Test: Game Loop Patterns
 *
 * Real-world C64 game loop patterns that the IL Generator must handle correctly.
 * Tests verify that actual game code compiles to proper IL instructions.
 *
 * Pipeline: Source → Lexer → Parser → Semantic → Frame Allocator → IL Generator
 *
 * @module __tests__/il/e2e/real-world/game-loop
 */

import { describe, it, expect } from 'vitest';
import {
  compileToIL,
  countOpcode,
  hasOpcode,
  getFunction,
  getMainFunction,
  wrapInModule,
  verifyOpcodeSequence,
} from '../../helpers/il-test-utils.js';
import { ILOpcode } from '../../../../il/enums.js';

// ============================================================================
// Game Loop - Basic Patterns
// ============================================================================

describe('E2E Real-World: Game Loop Patterns', () => {
  describe('Basic Game Loop', () => {
    it('should generate IL for simple game loop with running flag', () => {
      const source = `
        module GameLoop;
        
        let running: byte = 1;
        
        function main(): void {
          while (running == 1) {
            let x: byte = 1;
          }
        }
      `;

      const program = compileToIL(source);
      const mainFunc = getMainFunction(program);
      expect(mainFunc).toBeDefined();

      // Game loop should have: LOAD (running), CMP (1), conditional JUMP, JUMP (back)
      expect(hasOpcode(mainFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(mainFunc!.instructions, ILOpcode.CMP_IMM)).toBe(true);
      expect(hasOpcode(mainFunc!.instructions, ILOpcode.JUMP)).toBe(true);
      expect(hasOpcode(mainFunc!.instructions, ILOpcode.LABEL)).toBe(true);
    });

    it('should generate IL for frame counter increment pattern', () => {
      const source = `
        module FrameCounter;
        
        let frameCount: byte = 0;
        
        function main(): void {
          let running: byte = 1;
          while (running == 1) {
            frameCount = frameCount + 1;
          }
        }
      `;

      const program = compileToIL(source);
      const mainFunc = getMainFunction(program);
      expect(mainFunc).toBeDefined();

      // Should have increment operation inside loop
      const hasIncrement =
        hasOpcode(mainFunc!.instructions, ILOpcode.ADD_IMM) ||
        hasOpcode(mainFunc!.instructions, ILOpcode.INC_BYTE);
      expect(hasIncrement).toBe(true);

      // Should have store for frameCount update
      expect(hasOpcode(mainFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for init-loop-cleanup pattern', () => {
      const source = `
        module InitLoopCleanup;
        
        let gameData: byte = 0;
        
        function initGame(): void {
          gameData = 1;
        }
        
        function runGame(): void {
          gameData = gameData + 1;
        }
        
        function cleanup(): void {
          gameData = 0;
        }
        
        function main(): void {
          initGame();
          
          let running: byte = 1;
          while (running == 1) {
            runGame();
            if (gameData > 10) {
              running = 0;
            }
          }
          
          cleanup();
        }
      `;

      const program = compileToIL(source);
      const mainFunc = getMainFunction(program);
      expect(mainFunc).toBeDefined();

      // Should have multiple CALL instructions (init, runGame, cleanup)
      const callCount = countOpcode(mainFunc!.instructions, ILOpcode.CALL);
      expect(callCount).toBeGreaterThanOrEqual(3);

      // Verify all helper functions exist
      expect(getFunction(program, 'initGame')).toBeDefined();
      expect(getFunction(program, 'runGame')).toBeDefined();
      expect(getFunction(program, 'cleanup')).toBeDefined();
    });
  });

  // ============================================================================
  // Game Loop - Frame Structure
  // ============================================================================

  describe('Frame Structure', () => {
    it('should generate IL for input-update-render frame structure', () => {
      const source = `
        module FrameStructure;
        
        function readInput(): void {
          let input: byte = 0;
        }
        
        function updateGame(): void {
          let state: byte = 1;
        }
        
        function renderFrame(): void {
          let pixels: byte = 0;
        }
        
        function main(): void {
          let running: byte = 1;
          while (running == 1) {
            readInput();
            updateGame();
            renderFrame();
          }
        }
      `;

      const program = compileToIL(source);
      const mainFunc = getMainFunction(program);
      expect(mainFunc).toBeDefined();

      // Should have 3 CALL instructions in each frame iteration
      const callCount = countOpcode(mainFunc!.instructions, ILOpcode.CALL);
      expect(callCount).toBe(3);
    });

    it('should generate IL for state machine main loop pattern', () => {
      const source = `
        module StateMachine;
        
        let gameState: byte = 0;
        
        function handleMenu(): void {
          gameState = 1;
        }
        
        function handleGame(): void {
          gameState = 2;
        }
        
        function handlePause(): void {
          gameState = 1;
        }
        
        function handleGameOver(): void {
          gameState = 0;
        }
        
        function main(): void {
          gameState = 0;
          
          let running: byte = 1;
          while (running == 1) {
            if (gameState == 0) {
              handleMenu();
            }
            if (gameState == 1) {
              handleGame();
            }
            if (gameState == 2) {
              handlePause();
            }
            if (gameState == 3) {
              handleGameOver();
              running = 0;
            }
          }
        }
      `;

      const program = compileToIL(source);
      const mainFunc = getMainFunction(program);
      expect(mainFunc).toBeDefined();

      // Should have multiple comparisons for state checking
      const cmpCount = countOpcode(mainFunc!.instructions, ILOpcode.CMP_IMM);
      expect(cmpCount).toBeGreaterThanOrEqual(4); // At least 4 state checks

      // Should have conditional jumps for each if
      const hasConditionalJumps =
        hasOpcode(mainFunc!.instructions, ILOpcode.JUMP_EQ) ||
        hasOpcode(mainFunc!.instructions, ILOpcode.JUMP_NE);
      expect(hasConditionalJumps).toBe(true);
    });

    it('should generate IL for frame-locked timing wait pattern', () => {
      const source = `
        module FrameLock;
        
        // Simulated raster register
        @map rasterLine at $D012: byte;
        
        function waitForVBlank(): void {
          while (rasterLine != 0) {
            let wait: byte = 0;
          }
        }
        
        function main(): void {
          let running: byte = 1;
          while (running == 1) {
            waitForVBlank();
            let frame: byte = 1;
          }
        }
      `;

      const program = compileToIL(source);
      const waitFunc = getFunction(program, 'waitForVBlank');
      expect(waitFunc).toBeDefined();

      // Wait function should read from mapped register
      expect(hasOpcode(waitFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(waitFunc!.instructions, ILOpcode.CMP_IMM)).toBe(true);
    });
  });

  // ============================================================================
  // Game Loop - Timing Patterns
  // ============================================================================

  describe('Timing Patterns', () => {
    it('should generate IL for delta accumulation pattern', () => {
      const source = `
        module DeltaAccum;
        
        let accumulated: byte = 0;
        let delta: byte = 1;
        
        function main(): void {
          let running: byte = 1;
          let threshold: byte = 60;
          
          while (running == 1) {
            accumulated = accumulated + delta;
            
            if (accumulated >= threshold) {
              accumulated = accumulated - threshold;
              let tick: byte = 1;
            }
          }
        }
      `;

      const program = compileToIL(source);
      const mainFunc = getMainFunction(program);
      expect(mainFunc).toBeDefined();

      // Should have ADD for accumulation
      const hasAdd =
        hasOpcode(mainFunc!.instructions, ILOpcode.ADD_BYTE) ||
        hasOpcode(mainFunc!.instructions, ILOpcode.ADD_IMM);
      expect(hasAdd).toBe(true);

      // Should have SUB for threshold subtraction
      const hasSub =
        hasOpcode(mainFunc!.instructions, ILOpcode.SUB_BYTE) ||
        hasOpcode(mainFunc!.instructions, ILOpcode.SUB_IMM);
      expect(hasSub).toBe(true);
    });

    it('should generate IL for subsystem update ordering', () => {
      const source = `
        module Subsystems;
        
        function updatePhysics(): void {
          let physics: byte = 1;
        }
        
        function updateAI(): void {
          let ai: byte = 1;
        }
        
        function updateAnimation(): void {
          let anim: byte = 1;
        }
        
        function updateSound(): void {
          let sound: byte = 1;
        }
        
        function main(): void {
          let running: byte = 1;
          while (running == 1) {
            updatePhysics();
            updateAI();
            updateAnimation();
            updateSound();
          }
        }
      `;

      const program = compileToIL(source);
      const mainFunc = getMainFunction(program);
      expect(mainFunc).toBeDefined();

      // Should have 4 CALL instructions in order
      const callCount = countOpcode(mainFunc!.instructions, ILOpcode.CALL);
      expect(callCount).toBe(4);

      // All subsystem functions should exist
      expect(getFunction(program, 'updatePhysics')).toBeDefined();
      expect(getFunction(program, 'updateAI')).toBeDefined();
      expect(getFunction(program, 'updateAnimation')).toBeDefined();
      expect(getFunction(program, 'updateSound')).toBeDefined();
    });

    it('should generate IL for game tick timing with comparison', () => {
      const source = `
        module GameTick;
        
        let tickCounter: byte = 0;
        let tickRate: byte = 6;
        
        function gameTick(): void {
          let tick: byte = 1;
        }
        
        function main(): void {
          let running: byte = 1;
          while (running == 1) {
            tickCounter = tickCounter + 1;
            
            if (tickCounter >= tickRate) {
              tickCounter = 0;
              gameTick();
            }
          }
        }
      `;

      const program = compileToIL(source);
      const mainFunc = getMainFunction(program);
      expect(mainFunc).toBeDefined();

      // Should have comparison for tick rate
      expect(hasOpcode(mainFunc!.instructions, ILOpcode.CMP_BYTE)).toBe(true);

      // Should have CALL for gameTick
      expect(hasOpcode(mainFunc!.instructions, ILOpcode.CALL)).toBe(true);

      // Should have store to reset counter
      expect(hasOpcode(mainFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });
  });

  // ============================================================================
  // Game Loop - Exit Conditions
  // ============================================================================

  describe('Exit Conditions', () => {
    it('should generate IL for infinite loop with break condition', () => {
      const source = `
        module InfiniteLoop;
        
        let lives: byte = 3;
        
        function main(): void {
          let running: byte = 1;
          while (running == 1) {
            lives = lives - 1;
            
            if (lives == 0) {
              running = 0;
            }
          }
        }
      `;

      const program = compileToIL(source);
      const mainFunc = getMainFunction(program);
      expect(mainFunc).toBeDefined();

      // Should have decrement for lives
      const hasDec =
        hasOpcode(mainFunc!.instructions, ILOpcode.DEC_BYTE) ||
        hasOpcode(mainFunc!.instructions, ILOpcode.SUB_IMM);
      expect(hasDec).toBe(true);

      // Should have comparison for lives == 0
      expect(hasOpcode(mainFunc!.instructions, ILOpcode.CMP_IMM)).toBe(true);

      // Should have store to set running = 0
      expect(hasOpcode(mainFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for multiple exit condition checks', () => {
      const source = `
        module MultiExit;
        
        let lives: byte = 3;
        let level: byte = 1;
        let maxLevel: byte = 10;
        
        function main(): void {
          let running: byte = 1;
          while (running == 1) {
            if (lives == 0) {
              running = 0;
            }
            if (level > maxLevel) {
              running = 0;
            }
          }
        }
      `;

      const program = compileToIL(source);
      const mainFunc = getMainFunction(program);
      expect(mainFunc).toBeDefined();

      // Should have multiple comparisons
      const cmpImmCount = countOpcode(mainFunc!.instructions, ILOpcode.CMP_IMM);
      const cmpByteCount = countOpcode(mainFunc!.instructions, ILOpcode.CMP_BYTE);
      expect(cmpImmCount + cmpByteCount).toBeGreaterThanOrEqual(2);
    });
  });
});