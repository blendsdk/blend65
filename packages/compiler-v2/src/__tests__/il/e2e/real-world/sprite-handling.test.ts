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
    it('should generate IL for sprite enable via poke/peek', () => {
      const source = `
        module SpriteEnable;
        
        const SPRITE_ENABLE: word = $D015;
        
        function enableSprite(mask: byte): void {
          poke(SPRITE_ENABLE, peek(SPRITE_ENABLE) | mask);
        }
        
        function main(): void {
          enableSprite(1);
        }
      `;

      const program = compileToIL(source);
      const enableFunc = getFunction(program, 'enableSprite');
      expect(enableFunc).toBeDefined();

      // Should have LOAD for current value, OR for enable, POKE for write
      expect(hasOpcode(enableFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(enableFunc!.instructions, ILOpcode.OR_BYTE)).toBe(true);
      // poke() intrinsic generates POKE opcode
      expect(hasOpcode(enableFunc!.instructions, ILOpcode.POKE)).toBe(true);
    });

    it('should generate IL for sprite disable via AND mask', () => {
      const source = `
        module SpriteDisable;
        
        const SPRITE_ENABLE: word = $D015;
        
        function disableSprite(mask: byte): void {
          poke(SPRITE_ENABLE, peek(SPRITE_ENABLE) & mask);
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
        
        const SPRITE_ENABLE: word = $D015;
        
        function enableAllSprites(): void {
          poke(SPRITE_ENABLE, 255);
        }
        
        function main(): void {
          enableAllSprites();
        }
      `;

      const program = compileToIL(source);
      const enableFunc = getFunction(program, 'enableAllSprites');
      expect(enableFunc).toBeDefined();

      // Should have LOAD_IMM for 255 and POKE for poke() intrinsic
      expect(hasOpcode(enableFunc!.instructions, ILOpcode.LOAD_IMM)).toBe(true);
      expect(hasOpcode(enableFunc!.instructions, ILOpcode.POKE)).toBe(true);
    });
  });

  // ============================================================================
  // Sprite Position
  // ============================================================================

  describe('Sprite Position', () => {
    it('should generate IL for sprite X position setting (0-255)', () => {
      const source = `
        module SpriteX;
        
        const SPRITE_0_X: word = $D000;
        
        function setSprite0X(x: byte): void {
          poke(SPRITE_0_X, x);
        }
        
        function main(): void {
          setSprite0X(100);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setSprite0X');
      expect(setFunc).toBeDefined();

      // Should load parameter and POKE to address via poke() intrinsic
      expect(hasOpcode(setFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(setFunc!.instructions, ILOpcode.POKE)).toBe(true);
    });

    it('should generate IL for sprite Y position setting (0-255)', () => {
      const source = `
        module SpriteY;
        
        const SPRITE_0_Y: word = $D001;
        
        function setSprite0Y(y: byte): void {
          poke(SPRITE_0_Y, y);
        }
        
        function main(): void {
          setSprite0Y(150);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setSprite0Y');
      expect(setFunc).toBeDefined();

      // poke() intrinsic generates POKE opcode
      expect(hasOpcode(setFunc!.instructions, ILOpcode.POKE)).toBe(true);
    });

    it('should generate IL for sprite MSB handling for X > 255', () => {
      const source = `
        module SpriteMSB;
        
        const SPRITE_0_X: word = $D000;
        const SPRITE_MSB: word = $D010;
        
        function setSprite0XExtended(xLo: byte, xHi: byte): void {
          poke(SPRITE_0_X, xLo);
          
          if (xHi > 0) {
            poke(SPRITE_MSB, peek(SPRITE_MSB) | 1);
          } else {
            poke(SPRITE_MSB, peek(SPRITE_MSB) & 254);
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
        
        const SPRITE_0_X: word = $D000;
        const SPRITE_0_Y: word = $D001;
        const SPRITE_1_X: word = $D002;
        const SPRITE_1_Y: word = $D003;
        
        function updateSprites(x0: byte, y0: byte, x1: byte, y1: byte): void {
          poke(SPRITE_0_X, x0);
          poke(SPRITE_0_Y, y0);
          poke(SPRITE_1_X, x1);
          poke(SPRITE_1_Y, y1);
        }
        
        function main(): void {
          updateSprites(100, 100, 150, 150);
        }
      `;

      const program = compileToIL(source);
      const updateFunc = getFunction(program, 'updateSprites');
      expect(updateFunc).toBeDefined();

      // poke() intrinsic generates POKE opcode - should have 4 POKE operations
      const pokeCount = countOpcode(updateFunc!.instructions, ILOpcode.POKE);
      expect(pokeCount).toBe(4);
    });
  });

  // ============================================================================
  // Sprite Colors and Attributes
  // ============================================================================

  describe('Sprite Colors and Attributes', () => {
    it('should generate IL for sprite color setting', () => {
      const source = `
        module SpriteColor;
        
        const SPRITE_0_COLOR: word = $D027;
        
        function setSprite0Color(color: byte): void {
          poke(SPRITE_0_COLOR, color);
        }
        
        function main(): void {
          setSprite0Color(1);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setSprite0Color');
      expect(setFunc).toBeDefined();

      // poke() intrinsic generates POKE opcode
      expect(hasOpcode(setFunc!.instructions, ILOpcode.POKE)).toBe(true);
    });

    it('should generate IL for sprite priority (behind/in-front)', () => {
      const source = `
        module SpritePriority;
        
        const SPRITE_PRIORITY: word = $D01B;
        
        function setSpriteInFront(spriteNum: byte): void {
          let mask: byte = 1;
          poke(SPRITE_PRIORITY, peek(SPRITE_PRIORITY) & (255 - mask));
        }
        
        function setSpriteBehind(spriteNum: byte): void {
          let mask: byte = 1;
          poke(SPRITE_PRIORITY, peek(SPRITE_PRIORITY) | mask);
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
        
        const SPRITE_POINTER: word = $07F8;
        
        function nextFrame(): void {
          currentFrame = currentFrame + 1;
          if (currentFrame >= maxFrames) {
            currentFrame = 0;
          }
          poke(SPRITE_POINTER, currentFrame + 192);
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
        
        const SPRITE_POINTER: word = $07F8;
        
        function setFrame(index: byte): void {
          poke(SPRITE_POINTER, animTable[index]);
        }
        
        function main(): void {
          setFrame(2);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setFrame');
      expect(setFunc).toBeDefined();

      // Should have array access and POKE via poke() intrinsic
      expect(hasOpcode(setFunc!.instructions, ILOpcode.POKE)).toBe(true);
    });
  });

  // ============================================================================
  // Sprite Collision
  // ============================================================================

  describe('Sprite Collision', () => {
    it('should generate IL for sprite-sprite collision flag reading', () => {
      const source = `
        module SpriteCollision;
        
        const SPRITE_COLLISION: word = $D01E;
        
        function checkCollision(): byte {
          return volatile_read(SPRITE_COLLISION);
        }
        
        function main(): void {
          let collision: byte = checkCollision();
        }
      `;

      const program = compileToIL(source);
      const checkFunc = getFunction(program, 'checkCollision');
      expect(checkFunc).toBeDefined();

      // volatile_read() intrinsic generates PEEK opcode
      expect(hasOpcode(checkFunc!.instructions, ILOpcode.PEEK)).toBe(true);
      expect(hasOpcode(checkFunc!.instructions, ILOpcode.RETURN)).toBe(true);
    });

    it('should generate IL for sprite-background collision reading', () => {
      const source = `
        module BgCollision;
        
        const BG_COLLISION: word = $D01F;
        
        function checkBgCollision(spriteMask: byte): byte {
          let result: byte = volatile_read(BG_COLLISION) & spriteMask;
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
        
        const SPRITE_COLLISION: word = $D01E;
        let playerHit: byte = 0;
        
        function checkPlayerCollision(): void {
          let collision: byte = volatile_read(SPRITE_COLLISION) & 1;
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
        
        const SPRITE_ENABLE: word = $D015;
        
        function enableNthSprite(n: byte): void {
          let mask: byte = 1;
          
          for (let i: byte = 0 to n step 1) {
            if (i > 0) {
              mask = mask + mask;
            }
          }
          
          poke(SPRITE_ENABLE, peek(SPRITE_ENABLE) | mask);
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
        
        const SPRITE_ENABLE: word = $D015;
        
        function disableNthSprite(n: byte): void {
          let mask: byte = 1;
          
          for (let i: byte = 0 to n step 1) {
            if (i > 0) {
              mask = mask + mask;
            }
          }
          
          mask = 255 - mask;
          poke(SPRITE_ENABLE, peek(SPRITE_ENABLE) & mask);
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
        
        const SPRITE_X_EXPAND: word = $D01D;
        
        function expandSpriteX(spriteMask: byte): void {
          poke(SPRITE_X_EXPAND, peek(SPRITE_X_EXPAND) | spriteMask);
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
        
        const SPRITE_Y_EXPAND: word = $D017;
        
        function expandSpriteY(spriteMask: byte): void {
          poke(SPRITE_Y_EXPAND, peek(SPRITE_Y_EXPAND) | spriteMask);
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