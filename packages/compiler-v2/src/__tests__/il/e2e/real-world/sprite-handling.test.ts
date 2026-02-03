/**
 * IL Generator E2E Test: Sprite Handling Patterns
 *
 * Real-world C64 sprite manipulation patterns that the IL Generator must handle.
 * Tests verify that sprite-related code compiles to proper IL instructions.
 *
 * Pipeline: Source → Lexer → Parser → Semantic → Frame Allocator → IL Generator
 *
 * @module __tests__/il/e2e/real-world/sprite-handling
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
// C64 VIC-II Sprite Register Addresses
// ============================================================================

// Sprite position registers
// $D000-$D00F: Sprite 0-7 X/Y positions (2 bytes each)
// $D010: Sprite X MSB (bit per sprite for X > 255)
// $D015: Sprite enable register
// $D017: Sprite Y expand
// $D01B: Sprite priority (behind/in-front of background)
// $D01C: Sprite multicolor mode
// $D01D: Sprite X expand
// $D01E: Sprite-sprite collision
// $D01F: Sprite-background collision
// $D025-$D026: Sprite multicolor colors
// $D027-$D02E: Sprite colors (0-7)

// ============================================================================
// Sprite Enable/Disable
// ============================================================================

describe('E2E Real-World: Sprite Handling Patterns', () => {
  describe('Sprite Enable/Disable', () => {
    it('should generate IL for sprite enable via mapped register', () => {
      const source = `
        module SpriteEnable;
        
        @map spriteEnable at $D015: byte;
        
        function enableSprite(mask: byte): void {
          spriteEnable = spriteEnable | mask;
        }
        
        function main(): void {
          enableSprite(1);
        }
      `;

      const program = compileToIL(source);
      const enableFunc = getFunction(program, 'enableSprite');
      expect(enableFunc).toBeDefined();

      // Should have LOAD for current value, OR for enable, STORE for write
      expect(hasOpcode(enableFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(enableFunc!.instructions, ILOpcode.OR_BYTE)).toBe(true);
      expect(hasOpcode(enableFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for sprite disable via AND mask', () => {
      const source = `
        module SpriteDisable;
        
        @map spriteEnable at $D015: byte;
        
        function disableSprite(mask: byte): void {
          spriteEnable = spriteEnable & mask;
        }
        
        function main(): void {
          disableSprite(254);
        }
      `;

      const program = compileToIL(source);
      const disableFunc = getFunction(program, 'disableSprite');
      expect(disableFunc).toBeDefined();

      // Should have AND for masking
      expect(hasOpcode(disableFunc!.instructions, ILOpcode.AND_BYTE)).toBe(true);
    });

    it('should generate IL for enable all sprites pattern', () => {
      const source = `
        module EnableAll;
        
        @map spriteEnable at $D015: byte;
        
        function enableAllSprites(): void {
          spriteEnable = 255;
        }
        
        function main(): void {
          enableAllSprites();
        }
      `;

      const program = compileToIL(source);
      const enableFunc = getFunction(program, 'enableAllSprites');
      expect(enableFunc).toBeDefined();

      // Should have LOAD_IMM for 255 and STORE_BYTE
      expect(hasOpcode(enableFunc!.instructions, ILOpcode.LOAD_IMM)).toBe(true);
      expect(hasOpcode(enableFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });
  });

  // ============================================================================
  // Sprite Position
  // ============================================================================

  describe('Sprite Position', () => {
    it('should generate IL for sprite X position setting (0-255)', () => {
      const source = `
        module SpriteX;
        
        @map sprite0X at $D000: byte;
        
        function setSprite0X(x: byte): void {
          sprite0X = x;
        }
        
        function main(): void {
          setSprite0X(100);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setSprite0X');
      expect(setFunc).toBeDefined();

      // Should load parameter and store to mapped address
      expect(hasOpcode(setFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(setFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for sprite Y position setting (0-255)', () => {
      const source = `
        module SpriteY;
        
        @map sprite0Y at $D001: byte;
        
        function setSprite0Y(y: byte): void {
          sprite0Y = y;
        }
        
        function main(): void {
          setSprite0Y(150);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setSprite0Y');
      expect(setFunc).toBeDefined();

      expect(hasOpcode(setFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for sprite MSB handling for X > 255', () => {
      const source = `
        module SpriteMSB;
        
        @map sprite0X at $D000: byte;
        @map spriteMSB at $D010: byte;
        
        function setSprite0XExtended(xLo: byte, xHi: byte): void {
          sprite0X = xLo;
          
          if (xHi > 0) {
            spriteMSB = spriteMSB | 1;
          } else {
            spriteMSB = spriteMSB & 254;
          }
        }
        
        function main(): void {
          setSprite0XExtended(44, 1);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setSprite0XExtended');
      expect(setFunc).toBeDefined();

      // Should have bitwise OR and AND for MSB manipulation
      const hasOr =
        hasOpcode(setFunc!.instructions, ILOpcode.OR_IMM) ||
        hasOpcode(setFunc!.instructions, ILOpcode.OR_BYTE);
      const hasAnd =
        hasOpcode(setFunc!.instructions, ILOpcode.AND_IMM) ||
        hasOpcode(setFunc!.instructions, ILOpcode.AND_BYTE);

      expect(hasOr).toBe(true);
      expect(hasAnd).toBe(true);
    });

    it('should generate IL for multiple sprite coordinate update', () => {
      const source = `
        module MultiSprite;
        
        @map sprite0X at $D000: byte;
        @map sprite0Y at $D001: byte;
        @map sprite1X at $D002: byte;
        @map sprite1Y at $D003: byte;
        
        function updateSprites(x0: byte, y0: byte, x1: byte, y1: byte): void {
          sprite0X = x0;
          sprite0Y = y0;
          sprite1X = x1;
          sprite1Y = y1;
        }
        
        function main(): void {
          updateSprites(100, 100, 150, 150);
        }
      `;

      const program = compileToIL(source);
      const updateFunc = getFunction(program, 'updateSprites');
      expect(updateFunc).toBeDefined();

      // Should have 4 STORE_BYTE operations
      const storeCount = countOpcode(updateFunc!.instructions, ILOpcode.STORE_BYTE);
      expect(storeCount).toBe(4);
    });
  });

  // ============================================================================
  // Sprite Colors and Attributes
  // ============================================================================

  describe('Sprite Colors and Attributes', () => {
    it('should generate IL for sprite color setting', () => {
      const source = `
        module SpriteColor;
        
        @map sprite0Color at $D027: byte;
        
        function setSprite0Color(color: byte): void {
          sprite0Color = color;
        }
        
        function main(): void {
          setSprite0Color(1);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setSprite0Color');
      expect(setFunc).toBeDefined();

      expect(hasOpcode(setFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for sprite priority (behind/in-front)', () => {
      const source = `
        module SpritePriority;
        
        @map spritePriority at $D01B: byte;
        
        function setSpriteInFront(spriteNum: byte): void {
          let mask: byte = 1;
          spritePriority = spritePriority & (255 - mask);
        }
        
        function setSpriteBehind(spriteNum: byte): void {
          let mask: byte = 1;
          spritePriority = spritePriority | mask;
        }
        
        function main(): void {
          setSpriteInFront(0);
          setSpriteBehind(1);
        }
      `;

      const program = compileToIL(source);
      const inFrontFunc = getFunction(program, 'setSpriteInFront');
      const behindFunc = getFunction(program, 'setSpriteBehind');

      expect(inFrontFunc).toBeDefined();
      expect(behindFunc).toBeDefined();

      // Behind should use OR
      const hasOr =
        hasOpcode(behindFunc!.instructions, ILOpcode.OR_BYTE) ||
        hasOpcode(behindFunc!.instructions, ILOpcode.OR_IMM);
      expect(hasOr).toBe(true);
    });
  });

  // ============================================================================
  // Sprite Animation
  // ============================================================================

  describe('Sprite Animation', () => {
    it('should generate IL for sprite animation frame cycling', () => {
      const source = `
        module SpriteAnim;
        
        let currentFrame: byte = 0;
        let maxFrames: byte = 4;
        
        @map spritePointer at $07F8: byte;
        
        function nextFrame(): void {
          currentFrame = currentFrame + 1;
          if (currentFrame >= maxFrames) {
            currentFrame = 0;
          }
          spritePointer = currentFrame + 192;
        }
        
        function main(): void {
          nextFrame();
        }
      `;

      const program = compileToIL(source);
      const nextFunc = getFunction(program, 'nextFrame');
      expect(nextFunc).toBeDefined();

      // Should have increment, comparison, and store
      const hasAdd =
        hasOpcode(nextFunc!.instructions, ILOpcode.ADD_IMM) ||
        hasOpcode(nextFunc!.instructions, ILOpcode.INC_BYTE);
      expect(hasAdd).toBe(true);

      expect(hasOpcode(nextFunc!.instructions, ILOpcode.CMP_BYTE)).toBe(true);
      expect(hasOpcode(nextFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for sprite frame lookup pattern', () => {
      const source = `
        module FrameLookup;
        
        let animTable: byte[4] = [192, 193, 194, 195];
        let frameIndex: byte = 0;
        
        @map spritePointer at $07F8: byte;
        
        function setFrame(index: byte): void {
          spritePointer = animTable[index];
        }
        
        function main(): void {
          setFrame(2);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setFrame');
      expect(setFunc).toBeDefined();

      // Should have array access and store
      expect(hasOpcode(setFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });
  });

  // ============================================================================
  // Sprite Collision
  // ============================================================================

  describe('Sprite Collision', () => {
    it('should generate IL for sprite-sprite collision flag reading', () => {
      const source = `
        module SpriteCollision;
        
        @map spriteCollision at $D01E: byte;
        
        function checkCollision(): byte {
          return spriteCollision;
        }
        
        function main(): void {
          let collision: byte = checkCollision();
        }
      `;

      const program = compileToIL(source);
      const checkFunc = getFunction(program, 'checkCollision');
      expect(checkFunc).toBeDefined();

      // Should have LOAD_BYTE and RETURN
      expect(hasOpcode(checkFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(checkFunc!.instructions, ILOpcode.RETURN)).toBe(true);
    });

    it('should generate IL for sprite-background collision reading', () => {
      const source = `
        module BgCollision;
        
        @map bgCollision at $D01F: byte;
        
        function checkBgCollision(spriteMask: byte): byte {
          let result: byte = bgCollision & spriteMask;
          return result;
        }
        
        function main(): void {
          let hit: byte = checkBgCollision(1);
        }
      `;

      const program = compileToIL(source);
      const checkFunc = getFunction(program, 'checkBgCollision');
      expect(checkFunc).toBeDefined();

      // Should have AND for masking specific sprite
      expect(hasOpcode(checkFunc!.instructions, ILOpcode.AND_BYTE)).toBe(true);
    });

    it('should generate IL for collision check with conditional response', () => {
      const source = `
        module CollisionResponse;
        
        @map spriteCollision at $D01E: byte;
        let playerHit: byte = 0;
        
        function checkPlayerCollision(): void {
          let collision: byte = spriteCollision & 1;
          if (collision > 0) {
            playerHit = 1;
          }
        }
        
        function main(): void {
          checkPlayerCollision();
        }
      `;

      const program = compileToIL(source);
      const checkFunc = getFunction(program, 'checkPlayerCollision');
      expect(checkFunc).toBeDefined();

      // Should have load, AND, CMP, conditional jump, store
      expect(hasOpcode(checkFunc!.instructions, ILOpcode.AND_IMM)).toBe(true);
      expect(hasOpcode(checkFunc!.instructions, ILOpcode.CMP_IMM)).toBe(true);
    });
  });

  // ============================================================================
  // Sprite Pool Pattern
  // ============================================================================

  describe('Sprite Pool Pattern', () => {
    it('should generate IL for sprite pool enable nth sprite', () => {
      const source = `
        module SpritePool;
        
        @map spriteEnable at $D015: byte;
        
        function enableNthSprite(n: byte): void {
          let mask: byte = 1;
          
          for (let i: byte = 0 to n step 1) {
            if (i > 0) {
              mask = mask + mask;
            }
          }
          
          spriteEnable = spriteEnable | mask;
        }
        
        function main(): void {
          enableNthSprite(3);
        }
      `;

      const program = compileToIL(source);
      const enableFunc = getFunction(program, 'enableNthSprite');
      expect(enableFunc).toBeDefined();

      // Should have loop structure with shift-like operation
      expect(hasOpcode(enableFunc!.instructions, ILOpcode.LABEL)).toBe(true);
      expect(hasOpcode(enableFunc!.instructions, ILOpcode.JUMP)).toBe(true);

      // Should have ADD for doubling (shift left)
      expect(hasOpcode(enableFunc!.instructions, ILOpcode.ADD_BYTE)).toBe(true);
    });

    it('should generate IL for sprite pool disable pattern', () => {
      const source = `
        module SpritePoolDisable;
        
        @map spriteEnable at $D015: byte;
        
        function disableNthSprite(n: byte): void {
          let mask: byte = 1;
          
          for (let i: byte = 0 to n step 1) {
            if (i > 0) {
              mask = mask + mask;
            }
          }
          
          mask = 255 - mask;
          spriteEnable = spriteEnable & mask;
        }
        
        function main(): void {
          disableNthSprite(3);
        }
      `;

      const program = compileToIL(source);
      const disableFunc = getFunction(program, 'disableNthSprite');
      expect(disableFunc).toBeDefined();

      // Should have SUB for inverting mask
      expect(hasOpcode(disableFunc!.instructions, ILOpcode.SUB_BYTE)).toBe(true);
      // Should have AND for clearing bit
      expect(hasOpcode(disableFunc!.instructions, ILOpcode.AND_BYTE)).toBe(true);
    });
  });

  // ============================================================================
  // Sprite Expand
  // ============================================================================

  describe('Sprite Expand', () => {
    it('should generate IL for sprite X expand', () => {
      const source = `
        module SpriteExpand;
        
        @map spriteXExpand at $D01D: byte;
        
        function expandSpriteX(spriteMask: byte): void {
          spriteXExpand = spriteXExpand | spriteMask;
        }
        
        function main(): void {
          expandSpriteX(1);
        }
      `;

      const program = compileToIL(source);
      const expandFunc = getFunction(program, 'expandSpriteX');
      expect(expandFunc).toBeDefined();

      expect(hasOpcode(expandFunc!.instructions, ILOpcode.OR_BYTE)).toBe(true);
    });

    it('should generate IL for sprite Y expand', () => {
      const source = `
        module SpriteExpandY;
        
        @map spriteYExpand at $D017: byte;
        
        function expandSpriteY(spriteMask: byte): void {
          spriteYExpand = spriteYExpand | spriteMask;
        }
        
        function main(): void {
          expandSpriteY(1);
        }
      `;

      const program = compileToIL(source);
      const expandFunc = getFunction(program, 'expandSpriteY');
      expect(expandFunc).toBeDefined();

      expect(hasOpcode(expandFunc!.instructions, ILOpcode.OR_BYTE)).toBe(true);
    });
  });
});