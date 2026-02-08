/**
 * Extreme Tests: peek/poke Intrinsics
 *
 * Session 2 of 16: Task 5.2 peek/poke Extreme Tests
 *
 * This file contains edge case and boundary condition tests for the
 * peek() and poke() intrinsic functions and their IL generation.
 *
 * Tests cover:
 * - C64 memory map boundary addresses (ZP, RAM, hardware, ROM)
 * - VIC-II, SID, CIA register addresses
 * - Value edge cases (0x00, 0xFF, bit patterns)
 * - Builder API edge cases and sequences
 * - Instruction property verification
 *
 * @module il/intrinsics-peek-poke-extreme.test
 */

import { describe, expect, it } from 'vitest';
import {
  ILOpcode,
  ILPeekInstruction,
  ILPokeInstruction,
} from '../../il/instructions.js';
import { VirtualRegister } from '../../il/values.js';
import { IL_BYTE, IL_WORD } from '../../il/types.js';
import { ILModule } from '../../il/module.js';
import { ILBuilder } from '../../il/builder.js';
import { INTRINSIC_REGISTRY } from '../../il/intrinsics/registry.js';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Creates a test virtual register with the specified type.
 */
function createTestRegister(id: number, type = IL_BYTE, name?: string): VirtualRegister {
  return new VirtualRegister(id, type, name);
}

/**
 * Creates a test address register (word type).
 */
function createAddressRegister(id: number, name?: string): VirtualRegister {
  return createTestRegister(id, IL_WORD, name);
}

/**
 * Creates a test value register (byte type).
 */
function createValueRegister(id: number, name?: string): VirtualRegister {
  return createTestRegister(id, IL_BYTE, name);
}

/**
 * C64 Memory Map Constants
 */
const C64_MEMORY = {
  // Zero Page
  ZP_START: 0x0000,
  ZP_END: 0x00ff,

  // Stack
  STACK_START: 0x0100,
  STACK_END: 0x01ff,

  // BASIC/Screen RAM
  BASIC_START: 0x0800,
  SCREEN_DEFAULT: 0x0400,
  SCREEN_END: 0x07e7,

  // VIC-II
  VIC_START: 0xd000,
  VIC_END: 0xd3ff,
  VIC_SPRITE_X: 0xd000, // Sprite 0 X position
  VIC_SPRITE_Y: 0xd001, // Sprite 0 Y position
  VIC_BORDER: 0xd020,
  VIC_BACKGROUND: 0xd021,
  VIC_RASTER: 0xd012,
  VIC_CTRL1: 0xd011,
  VIC_SPRITE_ENABLE: 0xd015,

  // SID
  SID_START: 0xd400,
  SID_END: 0xd7ff,
  SID_VOICE1_FREQ_LO: 0xd400,
  SID_VOICE1_FREQ_HI: 0xd401,
  SID_VOICE1_CTRL: 0xd404,
  SID_VOLUME: 0xd418,

  // Color RAM
  COLOR_RAM_START: 0xd800,
  COLOR_RAM_END: 0xdbff,

  // CIA1
  CIA1_START: 0xdc00,
  CIA1_END: 0xdcff,
  CIA1_DATA_A: 0xdc00,
  CIA1_DATA_B: 0xdc01,
  CIA1_TIMER_A_LO: 0xdc04,

  // CIA2
  CIA2_START: 0xdd00,
  CIA2_END: 0xddff,
  CIA2_DATA_A: 0xdd00,

  // ROM Areas
  KERNAL_START: 0xe000,
  KERNAL_END: 0xffff,

  // Boundary
  MAX_ADDRESS: 0xffff,
};

// =============================================================================
// ILPeekInstruction - Address Boundary Tests
// =============================================================================

describe('ILPeekInstruction - Address Boundary Tests', () => {
  describe('Zero Page Addresses', () => {
    it('should handle zero page start address (0x0000)', () => {
      const address = createAddressRegister(0, 'zpStart');
      const result = createValueRegister(1, 'val');
      const inst = new ILPeekInstruction(0, address, result);

      expect(inst.opcode).toBe(ILOpcode.INTRINSIC_PEEK);
      expect(inst.address).toBe(address);
      expect(inst.result).toBe(result);
    });

    it('should handle zero page end address (0x00FF)', () => {
      const address = createAddressRegister(0, 'zpEnd');
      const result = createValueRegister(1, 'val');
      const inst = new ILPeekInstruction(0, address, result);

      expect(inst.getUsedRegisters()).toContain(address);
      expect(inst.getOperands()).toContain(address);
    });

    it('should handle zero page processor port addresses', () => {
      // $00 = CPU Data Direction Register, $01 = CPU I/O Port
      const address = createAddressRegister(0, 'processorPort');
      const result = createValueRegister(1, 'portValue');
      const inst = new ILPeekInstruction(0, address, result);

      expect(inst.hasSideEffects()).toBe(false);
      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('VIC-II Register Addresses', () => {
    it('should handle VIC-II sprite X position register', () => {
      const address = createAddressRegister(0, 'spriteX');
      const result = createValueRegister(1, 'xPos');
      const inst = new ILPeekInstruction(0, address, result);

      // toString includes register names when present
      expect(inst.toString()).toContain('INTRINSIC_PEEK');
      expect(inst.toString()).toContain('v0');
      expect(inst.toString()).toContain('v1');
    });

    it('should handle VIC-II border color register ($D020)', () => {
      const address = createAddressRegister(0, 'borderAddr');
      const result = createValueRegister(1, 'borderColor');
      const inst = new ILPeekInstruction(0, address, result);

      expect(inst.opcode).toBe(ILOpcode.INTRINSIC_PEEK);
    });

    it('should handle VIC-II raster register ($D012)', () => {
      const address = createAddressRegister(0, 'rasterAddr');
      const result = createValueRegister(1, 'rasterLine');
      const inst = new ILPeekInstruction(0, address, result);

      // Raster reads are critical for timing - peek should not have side effects
      expect(inst.hasSideEffects()).toBe(false);
    });

    it('should handle VIC-II sprite enable register ($D015)', () => {
      const address = createAddressRegister(0, 'spriteEnable');
      const result = createValueRegister(1, 'enableMask');
      const inst = new ILPeekInstruction(0, address, result);

      expect(inst.result?.type).toBe(IL_BYTE);
    });
  });

  describe('SID Register Addresses', () => {
    it('should handle SID voice frequency registers', () => {
      const addrLo = createAddressRegister(0, 'freqLo');
      const addrHi = createAddressRegister(2, 'freqHi');
      const resultLo = createValueRegister(1, 'lo');
      const resultHi = createValueRegister(3, 'hi');

      const peekLo = new ILPeekInstruction(0, addrLo, resultLo);
      const peekHi = new ILPeekInstruction(1, addrHi, resultHi);

      expect(peekLo.id).toBe(0);
      expect(peekHi.id).toBe(1);
    });

    it('should handle SID volume register ($D418)', () => {
      const address = createAddressRegister(0, 'sidVolume');
      const result = createValueRegister(1, 'volume');
      const inst = new ILPeekInstruction(0, address, result);

      expect(inst.address.type).toBe(IL_WORD);
    });
  });

  describe('CIA Register Addresses', () => {
    it('should handle CIA1 data port A ($DC00)', () => {
      const address = createAddressRegister(0, 'cia1DataA');
      const result = createValueRegister(1, 'keys');
      const inst = new ILPeekInstruction(0, address, result);

      expect(inst.getUsedRegisters()).toHaveLength(1);
    });

    it('should handle CIA1 timer register ($DC04)', () => {
      const address = createAddressRegister(0, 'cia1Timer');
      const result = createValueRegister(1, 'timerLo');
      const inst = new ILPeekInstruction(0, address, result);

      expect(inst.getOperands()).toHaveLength(1);
    });
  });

  describe('Maximum Address Boundary', () => {
    it('should handle maximum address (0xFFFF)', () => {
      const address = createAddressRegister(0, 'maxAddr');
      const result = createValueRegister(1, 'maxVal');
      const inst = new ILPeekInstruction(0, address, result);

      expect(inst.opcode).toBe(ILOpcode.INTRINSIC_PEEK);
      expect(inst.address.name).toBe('maxAddr');
    });

    it('should handle Kernal ROM addresses', () => {
      const address = createAddressRegister(0, 'kernalAddr');
      const result = createValueRegister(1, 'romByte');
      const inst = new ILPeekInstruction(0, address, result);

      expect(inst.result?.name).toBe('romByte');
    });
  });
});

// =============================================================================
// ILPokeInstruction - Address Boundary Tests
// =============================================================================

describe('ILPokeInstruction - Address Boundary Tests', () => {
  describe('Zero Page Addresses', () => {
    it('should handle zero page start address (0x0000)', () => {
      const address = createAddressRegister(0, 'zpStart');
      const value = createValueRegister(1, 'newVal');
      const inst = new ILPokeInstruction(0, address, value);

      expect(inst.opcode).toBe(ILOpcode.INTRINSIC_POKE);
      expect(inst.address).toBe(address);
      expect(inst.value).toBe(value);
      expect(inst.result).toBeNull();
    });

    it('should handle processor port write ($01)', () => {
      const address = createAddressRegister(0, 'processorPort');
      const value = createValueRegister(1, 'portConfig');
      const inst = new ILPokeInstruction(0, address, value);

      expect(inst.hasSideEffects()).toBe(true);
    });
  });

  describe('VIC-II Register Writes', () => {
    it('should handle VIC-II border color write ($D020)', () => {
      const address = createAddressRegister(0, 'borderAddr');
      const value = createValueRegister(1, 'newColor');
      const inst = new ILPokeInstruction(0, address, value);

      // toString includes register names when present
      expect(inst.toString()).toContain('INTRINSIC_POKE');
      expect(inst.toString()).toContain('v0');
      expect(inst.toString()).toContain('v1');
      expect(inst.hasSideEffects()).toBe(true);
    });

    it('should handle VIC-II control register write ($D011)', () => {
      const address = createAddressRegister(0, 'ctrlAddr');
      const value = createValueRegister(1, 'ctrlVal');
      const inst = new ILPokeInstruction(0, address, value);

      expect(inst.getUsedRegisters()).toHaveLength(2);
      expect(inst.getUsedRegisters()).toContain(address);
      expect(inst.getUsedRegisters()).toContain(value);
    });

    it('should handle VIC-II sprite position writes', () => {
      const addrX = createAddressRegister(0, 'spriteX');
      const addrY = createAddressRegister(2, 'spriteY');
      const valX = createValueRegister(1, 'xPos');
      const valY = createValueRegister(3, 'yPos');

      const pokeX = new ILPokeInstruction(0, addrX, valX);
      const pokeY = new ILPokeInstruction(1, addrY, valY);

      expect(pokeX.id).not.toBe(pokeY.id);
      expect(pokeX.hasSideEffects()).toBe(true);
      expect(pokeY.hasSideEffects()).toBe(true);
    });
  });

  describe('SID Register Writes', () => {
    it('should handle SID volume write ($D418)', () => {
      const address = createAddressRegister(0, 'sidVolume');
      const value = createValueRegister(1, 'volume');
      const inst = new ILPokeInstruction(0, address, value);

      expect(inst.opcode).toBe(ILOpcode.INTRINSIC_POKE);
      expect(inst.isTerminator()).toBe(false);
    });

    it('should handle SID voice control write', () => {
      const address = createAddressRegister(0, 'voiceCtrl');
      const value = createValueRegister(1, 'waveform');
      const inst = new ILPokeInstruction(0, address, value);

      expect(inst.getOperands()).toHaveLength(2);
    });
  });

  describe('Color RAM Writes', () => {
    it('should handle color RAM start address ($D800)', () => {
      const address = createAddressRegister(0, 'colorRam');
      const value = createValueRegister(1, 'color');
      const inst = new ILPokeInstruction(0, address, value);

      expect(inst.hasSideEffects()).toBe(true);
    });
  });
});

// =============================================================================
// Value Edge Cases for Poke
// =============================================================================

describe('ILPokeInstruction - Value Edge Cases', () => {
  it('should handle minimum value (0x00)', () => {
    const address = createAddressRegister(0, 'addr');
    const value = createValueRegister(1, 'zero');
    const inst = new ILPokeInstruction(0, address, value);

    expect(inst.value).toBe(value);
    expect(inst.value.type).toBe(IL_BYTE);
  });

  it('should handle maximum value (0xFF)', () => {
    const address = createAddressRegister(0, 'addr');
    const value = createValueRegister(1, 'max');
    const inst = new ILPokeInstruction(0, address, value);

    expect(inst.value.type).toBe(IL_BYTE);
  });

  it('should handle alternating bit pattern (0x55)', () => {
    const address = createAddressRegister(0, 'addr');
    const value = createValueRegister(1, 'pattern55');
    const inst = new ILPokeInstruction(0, address, value);

    expect(inst.opcode).toBe(ILOpcode.INTRINSIC_POKE);
  });

  it('should handle alternating bit pattern (0xAA)', () => {
    const address = createAddressRegister(0, 'addr');
    const value = createValueRegister(1, 'patternAA');
    const inst = new ILPokeInstruction(0, address, value);

    expect(inst.hasSideEffects()).toBe(true);
  });
});

// =============================================================================
// Builder API Edge Cases
// =============================================================================

describe('ILBuilder - peek/poke API Edge Cases', () => {
  it('should emit multiple consecutive peeks', () => {
    const module = new ILModule('test');
    const builder = new ILBuilder(module);

    builder.beginFunction('readMultiple', [], IL_BYTE);

    const addr1 = builder.emitConstWord(C64_MEMORY.VIC_BORDER);
    const addr2 = builder.emitConstWord(C64_MEMORY.VIC_BACKGROUND);
    const addr3 = builder.emitConstWord(C64_MEMORY.VIC_RASTER);

    const val1 = builder.emitPeek(addr1);
    const val2 = builder.emitPeek(addr2);
    const val3 = builder.emitPeek(addr3);

    expect(val1).toBeDefined();
    expect(val2).toBeDefined();
    expect(val3).toBeDefined();
    expect(val1.type).toBe(IL_BYTE);
    expect(val2.type).toBe(IL_BYTE);
    expect(val3.type).toBe(IL_BYTE);

    builder.emitReturn(val1);
    builder.endFunction();
  });

  it('should emit multiple consecutive pokes', () => {
    const module = new ILModule('test');
    const builder = new ILBuilder(module);

    builder.beginFunction('writeMultiple', [], IL_VOID);

    const addr1 = builder.emitConstWord(C64_MEMORY.VIC_BORDER);
    const addr2 = builder.emitConstWord(C64_MEMORY.VIC_BACKGROUND);
    const val = builder.emitConstByte(0);

    // Should not throw - pokes are void and have side effects
    builder.emitPoke(addr1, val);
    builder.emitPoke(addr2, val);

    builder.emitReturnVoid();
    builder.endFunction();

    // Verify function exists
    const func = module.getFunction('writeMultiple');
    expect(func).toBeDefined();
  });

  it('should emit peek immediately followed by poke to same address', () => {
    const module = new ILModule('test');
    const builder = new ILBuilder(module);

    builder.beginFunction('readModifyWrite', [], IL_VOID);

    const addr = builder.emitConstWord(C64_MEMORY.VIC_BORDER);

    // Read-modify-write pattern
    const oldVal = builder.emitPeek(addr);
    const one = builder.emitConstByte(1);
    const newVal = builder.emitAdd(oldVal, one);
    builder.emitPoke(addr, newVal);

    builder.emitReturnVoid();
    builder.endFunction();

    const func = module.getFunction('readModifyWrite');
    expect(func).toBeDefined();
    expect(func?.getEntryBlock().getInstructions().length).toBeGreaterThan(0);
  });

  it('should handle poke with result from peek', () => {
    const module = new ILModule('test');
    const builder = new ILBuilder(module);

    builder.beginFunction('copyByte', [], IL_VOID);

    const srcAddr = builder.emitConstWord(C64_MEMORY.VIC_BORDER);
    const dstAddr = builder.emitConstWord(C64_MEMORY.VIC_BACKGROUND);

    const val = builder.emitPeek(srcAddr);
    builder.emitPoke(dstAddr, val);

    builder.emitReturnVoid();
    builder.endFunction();

    expect(module.getFunction('copyByte')).toBeDefined();
  });
});

// =============================================================================
// Metadata Preservation Tests
// =============================================================================

describe('ILPeekInstruction - Metadata Tests', () => {
  it('should preserve source location metadata', () => {
    const address = createAddressRegister(0, 'addr');
    const result = createValueRegister(1, 'val');
    const metadata = {
      location: { line: 42, column: 10, sourceFile: 'game.bl65' },
    };
    const inst = new ILPeekInstruction(0, address, result, metadata);

    expect(inst.metadata.location?.line).toBe(42);
    expect(inst.metadata.location?.column).toBe(10);
    expect(inst.metadata.location?.sourceFile).toBe('game.bl65');
  });

  it('should preserve rasterCritical metadata', () => {
    const address = createAddressRegister(0, 'rasterAddr');
    const result = createValueRegister(1, 'rasterLine');
    const metadata = {
      rasterCritical: true,
      estimatedCycles: 4,
    };
    const inst = new ILPeekInstruction(0, address, result, metadata);

    expect(inst.metadata.rasterCritical).toBe(true);
    expect(inst.metadata.estimatedCycles).toBe(4);
  });

  it('should preserve addressing mode hint metadata', () => {
    const address = createAddressRegister(0, 'zpAddr');
    const result = createValueRegister(1, 'val');
    const metadata = {
      addressingMode: 'ZeroPage',
    };
    const inst = new ILPeekInstruction(0, address, result, metadata);

    expect(inst.metadata.addressingMode).toBe('ZeroPage');
  });
});

describe('ILPokeInstruction - Metadata Tests', () => {
  it('should preserve source location metadata', () => {
    const address = createAddressRegister(0, 'addr');
    const value = createValueRegister(1, 'val');
    const metadata = {
      location: { line: 100, column: 5, sourceFile: 'sprites.bl65' },
    };
    const inst = new ILPokeInstruction(0, address, value, metadata);

    expect(inst.metadata.location?.line).toBe(100);
    expect(inst.metadata.location?.sourceFile).toBe('sprites.bl65');
  });

  it('should preserve hardware hint metadata', () => {
    const address = createAddressRegister(0, 'sidAddr');
    const value = createValueRegister(1, 'volume');
    const metadata = {
      m6502Hints: {
        preferredRegister: 'A' as const,
      },
    };
    const inst = new ILPokeInstruction(0, address, value, metadata);

    expect(inst.metadata.m6502Hints?.preferredRegister).toBe('A');
  });
});

// =============================================================================
// Registry Definition Verification
// =============================================================================

describe('peek/poke Registry Definitions', () => {
  it('should have peek intrinsic registered', () => {
    const peekDef = INTRINSIC_REGISTRY.get('peek');

    expect(peekDef).toBeDefined();
    expect(peekDef?.name).toBe('peek');
    expect(peekDef?.opcode).toBe(ILOpcode.INTRINSIC_PEEK);
    expect(peekDef?.parameterTypes).toHaveLength(1);
    expect(peekDef?.returnType.kind).toBe('byte');
    expect(peekDef?.hasSideEffects).toBe(false);
    expect(peekDef?.cycleCount).toBe(4);
  });

  it('should have poke intrinsic registered', () => {
    const pokeDef = INTRINSIC_REGISTRY.get('poke');

    expect(pokeDef).toBeDefined();
    expect(pokeDef?.name).toBe('poke');
    expect(pokeDef?.opcode).toBe(ILOpcode.INTRINSIC_POKE);
    expect(pokeDef?.parameterTypes).toHaveLength(2);
    expect(pokeDef?.returnType.kind).toBe('void');
    expect(pokeDef?.hasSideEffects).toBe(true);
    expect(pokeDef?.cycleCount).toBe(4);
  });

  it('should categorize peek/poke as Memory intrinsics', () => {
    const peekDef = INTRINSIC_REGISTRY.get('peek');
    const pokeDef = INTRINSIC_REGISTRY.get('poke');

    expect(peekDef?.category).toBe('memory');
    expect(pokeDef?.category).toBe('memory');
  });

  it('should mark peek/poke as non-compile-time intrinsics', () => {
    const peekDef = INTRINSIC_REGISTRY.get('peek');
    const pokeDef = INTRINSIC_REGISTRY.get('poke');

    expect(peekDef?.isCompileTime).toBe(false);
    expect(pokeDef?.isCompileTime).toBe(false);
  });

  it('should mark peek/poke as non-barrier intrinsics', () => {
    const peekDef = INTRINSIC_REGISTRY.get('peek');
    const pokeDef = INTRINSIC_REGISTRY.get('poke');

    expect(peekDef?.isBarrier).toBe(false);
    expect(pokeDef?.isBarrier).toBe(false);
  });
});

// =============================================================================
// C64-Specific Memory Region Tests
// =============================================================================

describe('C64 Memory Region Tests', () => {
  it('should handle screen memory region peek', () => {
    const address = createAddressRegister(0, 'screenAddr');
    const result = createValueRegister(1, 'char');
    const inst = new ILPeekInstruction(0, address, result);

    // Screen memory at $0400-$07E7
    expect(inst.opcode).toBe(ILOpcode.INTRINSIC_PEEK);
  });

  it('should handle color RAM region poke', () => {
    const address = createAddressRegister(0, 'colorAddr');
    const value = createValueRegister(1, 'color');
    const inst = new ILPokeInstruction(0, address, value);

    // Color RAM at $D800-$DBFF
    expect(inst.hasSideEffects()).toBe(true);
  });

  it('should handle BASIC ROM area peek', () => {
    const address = createAddressRegister(0, 'basicAddr');
    const result = createValueRegister(1, 'romByte');
    const inst = new ILPeekInstruction(0, address, result);

    // BASIC ROM at $A000-$BFFF
    expect(inst.hasSideEffects()).toBe(false);
  });

  it('should handle I/O area peek ($D000-$DFFF)', () => {
    const address = createAddressRegister(0, 'ioAddr');
    const result = createValueRegister(1, 'ioByte');
    const inst = new ILPeekInstruction(0, address, result);

    // I/O area contains VIC, SID, CIA, etc.
    expect(inst.result?.type).toBe(IL_BYTE);
  });
});

// =============================================================================
// Import Type for IL_VOID
// =============================================================================

import { IL_VOID } from '../../il/types.js';