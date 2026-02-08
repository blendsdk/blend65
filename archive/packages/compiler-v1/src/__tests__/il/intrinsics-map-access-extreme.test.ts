/**
 * @map Access Extreme Edge Case Tests
 *
 * Session 6 of 16: Task 5.6 @map Variable Access Extreme Tests
 *
 * Tests extreme edge cases for @map memory-mapped variable access:
 * - HARDWARE_READ/HARDWARE_WRITE: Simple @map (single address)
 * - MAP_LOAD_FIELD/MAP_STORE_FIELD: @map struct field access
 * - MAP_LOAD_RANGE/MAP_STORE_RANGE: @map range (indexed) access
 *
 * All C64 hardware register addresses and boundary conditions.
 *
 * @module il/intrinsics-map-access-extreme.test
 */

import { describe, expect, it } from 'vitest';
import {
  ILOpcode,
  ILHardwareReadInstruction,
  ILHardwareWriteInstruction,
  ILMapLoadFieldInstruction,
  ILMapStoreFieldInstruction,
  ILMapLoadRangeInstruction,
  ILMapStoreRangeInstruction,
} from '../../il/instructions.js';
import { VirtualRegister } from '../../il/values.js';
import { IL_BYTE, IL_WORD } from '../../il/types.js';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Creates a test virtual register.
 */
function createTestRegister(id: number, type = IL_BYTE, name?: string): VirtualRegister {
  return new VirtualRegister(id, type, name);
}

// =============================================================================
// C64 Hardware Address Constants
// =============================================================================

/** VIC-II Chip Base Address */
const VIC_BASE = 0xd000;
/** VIC-II Border Color */
const VIC_BORDER = 0xd020;
/** VIC-II Background Color */
const VIC_BACKGROUND = 0xd021;
/** VIC-II Sprite 0 X Position */
const VIC_SPRITE_0_X = 0xd000;
/** VIC-II Sprite 0 Y Position */
const VIC_SPRITE_0_Y = 0xd001;
/** VIC-II Raster Line */
const VIC_RASTER = 0xd012;

/** SID Chip Base Address */
const SID_BASE = 0xd400;
/** SID Voice 1 Frequency Low */
const SID_FREQ_LO = 0xd400;
/** SID Voice 1 Frequency High */
const SID_FREQ_HI = 0xd401;
/** SID Master Volume */
const SID_VOLUME = 0xd418;

/** CIA 1 Base Address */
const CIA1_BASE = 0xdc00;
/** CIA 1 Port A (keyboard columns) */
const CIA1_PORTA = 0xdc00;
/** CIA 1 Port B (keyboard rows) */
const CIA1_PORTB = 0xdc01;

/** CIA 2 Base Address */
const CIA2_BASE = 0xdd00;
/** CIA 2 Port A (VIC bank select) */
const CIA2_PORTA = 0xdd00;

/** Color RAM Base */
const COLOR_RAM = 0xd800;
/** Screen RAM default Base */
const SCREEN_RAM = 0x0400;

// =============================================================================
// HARDWARE_READ Instruction Extreme Tests
// =============================================================================

describe('ILHardwareReadInstruction Extreme Tests', () => {
  describe('VIC-II Register Addresses', () => {
    it('should read VIC-II border color ($D020)', () => {
      const result = createTestRegister(0);
      const inst = new ILHardwareReadInstruction(0, VIC_BORDER, result);

      expect(inst.opcode).toBe(ILOpcode.HARDWARE_READ);
      expect(inst.address).toBe(0xd020);
      expect(inst.toString()).toContain('$D020');
    });

    it('should read VIC-II background color ($D021)', () => {
      const result = createTestRegister(0);
      const inst = new ILHardwareReadInstruction(0, VIC_BACKGROUND, result);

      expect(inst.address).toBe(0xd021);
    });

    it('should read VIC-II raster line ($D012)', () => {
      const result = createTestRegister(0);
      const inst = new ILHardwareReadInstruction(0, VIC_RASTER, result);

      expect(inst.address).toBe(0xd012);
    });

    it('should read VIC-II sprite positions ($D000-$D00F)', () => {
      const result = createTestRegister(0);
      // All 8 sprites, X and Y positions
      for (let sprite = 0; sprite < 8; sprite++) {
        const xAddr = VIC_BASE + sprite * 2;
        const yAddr = VIC_BASE + sprite * 2 + 1;

        const xInst = new ILHardwareReadInstruction(0, xAddr, result);
        const yInst = new ILHardwareReadInstruction(1, yAddr, result);

        expect(xInst.address).toBe(xAddr);
        expect(yInst.address).toBe(yAddr);
      }
    });
  });

  describe('SID Register Addresses', () => {
    it('should read SID master volume ($D418)', () => {
      const result = createTestRegister(0);
      const inst = new ILHardwareReadInstruction(0, SID_VOLUME, result);

      expect(inst.address).toBe(0xd418);
    });

    it('should read SID voice 1 frequency ($D400-$D401)', () => {
      const result = createTestRegister(0);
      const loInst = new ILHardwareReadInstruction(0, SID_FREQ_LO, result);
      const hiInst = new ILHardwareReadInstruction(1, SID_FREQ_HI, result);

      expect(loInst.address).toBe(0xd400);
      expect(hiInst.address).toBe(0xd401);
    });
  });

  describe('CIA Register Addresses', () => {
    it('should read CIA1 keyboard ports ($DC00-$DC01)', () => {
      const result = createTestRegister(0);
      const portA = new ILHardwareReadInstruction(0, CIA1_PORTA, result);
      const portB = new ILHardwareReadInstruction(1, CIA1_PORTB, result);

      expect(portA.address).toBe(0xdc00);
      expect(portB.address).toBe(0xdc01);
    });

    it('should read CIA2 VIC bank ($DD00)', () => {
      const result = createTestRegister(0);
      const inst = new ILHardwareReadInstruction(0, CIA2_PORTA, result);

      expect(inst.address).toBe(0xdd00);
    });
  });

  describe('Boundary Addresses', () => {
    it('should handle address 0 (zero page start)', () => {
      const result = createTestRegister(0);
      const inst = new ILHardwareReadInstruction(0, 0x0000, result);

      expect(inst.address).toBe(0);
      expect(inst.toString()).toContain('$0');
    });

    it('should handle address $00FF (zero page end)', () => {
      const result = createTestRegister(0);
      const inst = new ILHardwareReadInstruction(0, 0x00ff, result);

      expect(inst.address).toBe(255);
    });

    it('should handle address $FFFF (max addressable)', () => {
      const result = createTestRegister(0);
      const inst = new ILHardwareReadInstruction(0, 0xffff, result);

      expect(inst.address).toBe(65535);
      expect(inst.toString()).toContain('$FFFF');
    });
  });
});

// =============================================================================
// HARDWARE_WRITE Instruction Extreme Tests
// =============================================================================

describe('ILHardwareWriteInstruction Extreme Tests', () => {
  describe('VIC-II Register Writes', () => {
    it('should write VIC-II border color ($D020)', () => {
      const value = createTestRegister(0);
      const inst = new ILHardwareWriteInstruction(0, VIC_BORDER, value);

      expect(inst.opcode).toBe(ILOpcode.HARDWARE_WRITE);
      expect(inst.address).toBe(0xd020);
      expect(inst.hasSideEffects()).toBe(true);
    });

    it('should write all VIC-II color registers ($D020-$D024)', () => {
      const value = createTestRegister(0);
      const colorRegs = [0xd020, 0xd021, 0xd022, 0xd023, 0xd024];

      for (const addr of colorRegs) {
        const inst = new ILHardwareWriteInstruction(0, addr, value);
        expect(inst.address).toBe(addr);
        expect(inst.hasSideEffects()).toBe(true);
      }
    });
  });

  describe('SID Register Writes', () => {
    it('should write SID frequency registers with side effects', () => {
      const value = createTestRegister(0);
      const inst = new ILHardwareWriteInstruction(0, SID_FREQ_LO, value);

      expect(inst.hasSideEffects()).toBe(true);
    });

    it('should write all 29 SID registers ($D400-$D41C)', () => {
      const value = createTestRegister(0);

      for (let offset = 0; offset < 29; offset++) {
        const addr = SID_BASE + offset;
        const inst = new ILHardwareWriteInstruction(0, addr, value);
        expect(inst.address).toBe(addr);
      }
    });
  });

  describe('Side Effects', () => {
    it('should always have side effects for hardware writes', () => {
      const value = createTestRegister(0);

      const borderWrite = new ILHardwareWriteInstruction(0, VIC_BORDER, value);
      const sidWrite = new ILHardwareWriteInstruction(1, SID_VOLUME, value);
      const ciaWrite = new ILHardwareWriteInstruction(2, CIA1_PORTA, value);

      expect(borderWrite.hasSideEffects()).toBe(true);
      expect(sidWrite.hasSideEffects()).toBe(true);
      expect(ciaWrite.hasSideEffects()).toBe(true);
    });
  });
});

// =============================================================================
// MAP_LOAD_FIELD Instruction Extreme Tests
// =============================================================================

describe('ILMapLoadFieldInstruction Extreme Tests', () => {
  describe('VIC-II Struct Field Access', () => {
    it('should load VIC borderColor field', () => {
      const result = createTestRegister(0);
      const inst = new ILMapLoadFieldInstruction(0, 'vic', 'borderColor', 0xd020, result);

      expect(inst.opcode).toBe(ILOpcode.MAP_LOAD_FIELD);
      expect(inst.structName).toBe('vic');
      expect(inst.fieldName).toBe('borderColor');
      expect(inst.address).toBe(0xd020);
    });

    it('should load VIC backgroundColor field', () => {
      const result = createTestRegister(0);
      const inst = new ILMapLoadFieldInstruction(0, 'vic', 'backgroundColor', 0xd021, result);

      expect(inst.fieldName).toBe('backgroundColor');
      expect(inst.address).toBe(0xd021);
    });

    it('should format toString with struct.field and address', () => {
      const result = createTestRegister(0);
      const inst = new ILMapLoadFieldInstruction(0, 'vic', 'borderColor', 0xd020, result);

      const str = inst.toString();
      expect(str).toContain('vic.borderColor');
      expect(str).toContain('$D020');
    });
  });

  describe('SID Struct Field Access', () => {
    it('should load SID masterVolume field', () => {
      const result = createTestRegister(0);
      const inst = new ILMapLoadFieldInstruction(0, 'sid', 'masterVolume', 0xd418, result);

      expect(inst.structName).toBe('sid');
      expect(inst.fieldName).toBe('masterVolume');
      expect(inst.address).toBe(0xd418);
    });
  });

  describe('Metadata with mapInfo', () => {
    it('should preserve mapInfo metadata', () => {
      const result = createTestRegister(0);
      const metadata = {
        mapInfo: {
          structName: 'vic',
          fieldName: 'borderColor',
          baseAddress: 0xd000,
          fieldOffset: 0x20,
        },
      };
      const inst = new ILMapLoadFieldInstruction(0, 'vic', 'borderColor', 0xd020, result, metadata);

      expect(inst.metadata.mapInfo?.structName).toBe('vic');
      expect(inst.metadata.mapInfo?.baseAddress).toBe(0xd000);
      expect(inst.metadata.mapInfo?.fieldOffset).toBe(0x20);
    });
  });
});

// =============================================================================
// MAP_STORE_FIELD Instruction Extreme Tests
// =============================================================================

describe('ILMapStoreFieldInstruction Extreme Tests', () => {
  describe('VIC-II Struct Field Store', () => {
    it('should store VIC borderColor field', () => {
      const value = createTestRegister(0);
      const inst = new ILMapStoreFieldInstruction(0, 'vic', 'borderColor', 0xd020, value);

      expect(inst.opcode).toBe(ILOpcode.MAP_STORE_FIELD);
      expect(inst.structName).toBe('vic');
      expect(inst.fieldName).toBe('borderColor');
      expect(inst.address).toBe(0xd020);
      expect(inst.hasSideEffects()).toBe(true);
    });

    it('should have no result register (void operation)', () => {
      const value = createTestRegister(0);
      const inst = new ILMapStoreFieldInstruction(0, 'vic', 'borderColor', 0xd020, value);

      expect(inst.result).toBeNull();
    });

    it('should format toString correctly', () => {
      const value = createTestRegister(0);
      const inst = new ILMapStoreFieldInstruction(0, 'vic', 'borderColor', 0xd020, value);

      const str = inst.toString();
      expect(str).toContain('vic.borderColor');
      expect(str).toContain('$D020');
      expect(str).toContain('v0');
    });
  });

  describe('Used Registers', () => {
    it('should return value register in getUsedRegisters', () => {
      const value = createTestRegister(0);
      const inst = new ILMapStoreFieldInstruction(0, 'vic', 'borderColor', 0xd020, value);

      const usedRegs = inst.getUsedRegisters();
      expect(usedRegs).toHaveLength(1);
      expect(usedRegs[0]).toBe(value);
    });

    it('should return value register in getOperands', () => {
      const value = createTestRegister(0);
      const inst = new ILMapStoreFieldInstruction(0, 'vic', 'borderColor', 0xd020, value);

      const operands = inst.getOperands();
      expect(operands).toHaveLength(1);
      expect(operands[0]).toBe(value);
    });
  });
});

// =============================================================================
// MAP_LOAD_RANGE Instruction Extreme Tests
// =============================================================================

describe('ILMapLoadRangeInstruction Extreme Tests', () => {
  describe('VIC-II Sprite Position Ranges', () => {
    it('should load from sprite X position range ($D000-$D00E)', () => {
      const index = createTestRegister(0);
      const result = createTestRegister(1);
      const inst = new ILMapLoadRangeInstruction(0, 'spriteX', 0xd000, 0xd00e, index, result);

      expect(inst.opcode).toBe(ILOpcode.MAP_LOAD_RANGE);
      expect(inst.rangeName).toBe('spriteX');
      expect(inst.baseAddress).toBe(0xd000);
      expect(inst.endAddress).toBe(0xd00e);
    });

    it('should load from sprite Y position range ($D001-$D00F)', () => {
      const index = createTestRegister(0);
      const result = createTestRegister(1);
      const inst = new ILMapLoadRangeInstruction(0, 'spriteY', 0xd001, 0xd00f, index, result);

      expect(inst.rangeName).toBe('spriteY');
      expect(inst.baseAddress).toBe(0xd001);
      expect(inst.endAddress).toBe(0xd00f);
    });
  });

  describe('Color RAM Range', () => {
    it('should load from color RAM range ($D800-$DBE7)', () => {
      const index = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1);
      const inst = new ILMapLoadRangeInstruction(0, 'colorRam', 0xd800, 0xdbe7, index, result);

      expect(inst.rangeName).toBe('colorRam');
      expect(inst.baseAddress).toBe(0xd800);
      expect(inst.endAddress).toBe(0xdbe7);
    });
  });

  describe('Index Register', () => {
    it('should use byte index for small ranges', () => {
      const index = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1);
      const inst = new ILMapLoadRangeInstruction(0, 'spriteX', 0xd000, 0xd00e, index, result);

      expect(inst.index.type).toBe(IL_BYTE);
    });

    it('should use word index for large ranges', () => {
      const index = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1);
      const inst = new ILMapLoadRangeInstruction(0, 'screenRam', 0x0400, 0x07e7, index, result);

      expect(inst.index.type).toBe(IL_WORD);
    });

    it('should return index in getUsedRegisters', () => {
      const index = createTestRegister(0);
      const result = createTestRegister(1);
      const inst = new ILMapLoadRangeInstruction(0, 'spriteX', 0xd000, 0xd00e, index, result);

      const usedRegs = inst.getUsedRegisters();
      expect(usedRegs).toHaveLength(1);
      expect(usedRegs[0]).toBe(index);
    });
  });

  describe('toString Formatting', () => {
    it('should format with range name, index, and address range', () => {
      const index = createTestRegister(0);
      const result = createTestRegister(1);
      const inst = new ILMapLoadRangeInstruction(0, 'spriteX', 0xd000, 0xd00e, index, result);

      const str = inst.toString();
      expect(str).toContain('spriteX');
      expect(str).toContain('v0');
      expect(str).toContain('$D000');
      expect(str).toContain('$D00E');
    });
  });
});

// =============================================================================
// MAP_STORE_RANGE Instruction Extreme Tests
// =============================================================================

describe('ILMapStoreRangeInstruction Extreme Tests', () => {
  describe('VIC-II Sprite Position Range Store', () => {
    it('should store to sprite X position range', () => {
      const index = createTestRegister(0);
      const value = createTestRegister(1);
      const inst = new ILMapStoreRangeInstruction(0, 'spriteX', 0xd000, 0xd00e, index, value);

      expect(inst.opcode).toBe(ILOpcode.MAP_STORE_RANGE);
      expect(inst.rangeName).toBe('spriteX');
      expect(inst.baseAddress).toBe(0xd000);
      expect(inst.endAddress).toBe(0xd00e);
      expect(inst.hasSideEffects()).toBe(true);
    });

    it('should have no result register (void operation)', () => {
      const index = createTestRegister(0);
      const value = createTestRegister(1);
      const inst = new ILMapStoreRangeInstruction(0, 'spriteX', 0xd000, 0xd00e, index, value);

      expect(inst.result).toBeNull();
    });
  });

  describe('Used Registers', () => {
    it('should return both index and value in getUsedRegisters', () => {
      const index = createTestRegister(0);
      const value = createTestRegister(1);
      const inst = new ILMapStoreRangeInstruction(0, 'spriteX', 0xd000, 0xd00e, index, value);

      const usedRegs = inst.getUsedRegisters();
      expect(usedRegs).toHaveLength(2);
      expect(usedRegs).toContain(index);
      expect(usedRegs).toContain(value);
    });

    it('should return both index and value in getOperands', () => {
      const index = createTestRegister(0);
      const value = createTestRegister(1);
      const inst = new ILMapStoreRangeInstruction(0, 'spriteX', 0xd000, 0xd00e, index, value);

      const operands = inst.getOperands();
      expect(operands).toHaveLength(2);
      expect(operands).toContain(index);
      expect(operands).toContain(value);
    });
  });

  describe('toString Formatting', () => {
    it('should format with range name, index, address range, and value', () => {
      const index = createTestRegister(0);
      const value = createTestRegister(1);
      const inst = new ILMapStoreRangeInstruction(0, 'spriteX', 0xd000, 0xd00e, index, value);

      const str = inst.toString();
      expect(str).toContain('spriteX');
      expect(str).toContain('v0');
      expect(str).toContain('v1');
      expect(str).toContain('$D000');
      expect(str).toContain('$D00E');
    });
  });
});

// =============================================================================
// Side Effects Comparison
// =============================================================================

describe('@map Instructions Side Effects', () => {
  it('read operations should not have side effects', () => {
    const result = createTestRegister(0);
    const index = createTestRegister(1);

    const hwRead = new ILHardwareReadInstruction(0, VIC_BORDER, result);
    const fieldLoad = new ILMapLoadFieldInstruction(1, 'vic', 'borderColor', VIC_BORDER, result);
    const rangeLoad = new ILMapLoadRangeInstruction(2, 'spriteX', 0xd000, 0xd00e, index, result);

    expect(hwRead.hasSideEffects()).toBe(false);
    expect(fieldLoad.hasSideEffects()).toBe(false);
    expect(rangeLoad.hasSideEffects()).toBe(false);
  });

  it('write operations should have side effects', () => {
    const value = createTestRegister(0);
    const index = createTestRegister(1);

    const hwWrite = new ILHardwareWriteInstruction(0, VIC_BORDER, value);
    const fieldStore = new ILMapStoreFieldInstruction(1, 'vic', 'borderColor', VIC_BORDER, value);
    const rangeStore = new ILMapStoreRangeInstruction(2, 'spriteX', 0xd000, 0xd00e, index, value);

    expect(hwWrite.hasSideEffects()).toBe(true);
    expect(fieldStore.hasSideEffects()).toBe(true);
    expect(rangeStore.hasSideEffects()).toBe(true);
  });

  it('no @map instructions should be terminators', () => {
    const result = createTestRegister(0);
    const value = createTestRegister(1);
    const index = createTestRegister(2);

    const hwRead = new ILHardwareReadInstruction(0, VIC_BORDER, result);
    const hwWrite = new ILHardwareWriteInstruction(1, VIC_BORDER, value);
    const fieldLoad = new ILMapLoadFieldInstruction(2, 'vic', 'border', VIC_BORDER, result);
    const fieldStore = new ILMapStoreFieldInstruction(3, 'vic', 'border', VIC_BORDER, value);
    const rangeLoad = new ILMapLoadRangeInstruction(4, 'sp', 0xd000, 0xd00e, index, result);
    const rangeStore = new ILMapStoreRangeInstruction(5, 'sp', 0xd000, 0xd00e, index, value);

    expect(hwRead.isTerminator()).toBe(false);
    expect(hwWrite.isTerminator()).toBe(false);
    expect(fieldLoad.isTerminator()).toBe(false);
    expect(fieldStore.isTerminator()).toBe(false);
    expect(rangeLoad.isTerminator()).toBe(false);
    expect(rangeStore.isTerminator()).toBe(false);
  });
});

// =============================================================================
// C64 Hardware Complete Coverage
// =============================================================================

describe('C64 Hardware Address Complete Coverage', () => {
  it('should handle all VIC-II registers ($D000-$D02E)', () => {
    const result = createTestRegister(0);

    // VIC-II has 47 registers
    for (let offset = 0; offset <= 0x2e; offset++) {
      const addr = VIC_BASE + offset;
      const inst = new ILHardwareReadInstruction(0, addr, result);
      expect(inst.address).toBe(addr);
    }
  });

  it('should handle all SID registers ($D400-$D41C)', () => {
    const result = createTestRegister(0);

    // SID has 29 registers
    for (let offset = 0; offset <= 0x1c; offset++) {
      const addr = SID_BASE + offset;
      const inst = new ILHardwareReadInstruction(0, addr, result);
      expect(inst.address).toBe(addr);
    }
  });

  it('should handle all CIA1 registers ($DC00-$DC0F)', () => {
    const result = createTestRegister(0);

    // CIA has 16 registers
    for (let offset = 0; offset <= 0x0f; offset++) {
      const addr = CIA1_BASE + offset;
      const inst = new ILHardwareReadInstruction(0, addr, result);
      expect(inst.address).toBe(addr);
    }
  });

  it('should handle all CIA2 registers ($DD00-$DD0F)', () => {
    const result = createTestRegister(0);

    // CIA has 16 registers
    for (let offset = 0; offset <= 0x0f; offset++) {
      const addr = CIA2_BASE + offset;
      const inst = new ILHardwareReadInstruction(0, addr, result);
      expect(inst.address).toBe(addr);
    }
  });
});