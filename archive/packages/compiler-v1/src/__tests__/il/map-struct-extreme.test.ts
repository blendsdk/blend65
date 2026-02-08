/**
 * @map Struct Extreme Edge Case Tests
 *
 * Session 9 of 16: Task 5.9 @map Struct Extreme Tests
 *
 * Tests extreme edge cases for @map struct access beyond basic operations:
 * - Complex struct layouts with multiple fields
 * - Field offset calculations
 * - mapInfo metadata preservation for optimizer
 * - Word-sized field handling
 * - Range boundaries with complex patterns
 *
 * @module il/map-struct-extreme.test
 */

import { describe, expect, it } from 'vitest';
import {
  ILOpcode,
  ILMapLoadFieldInstruction,
  ILMapStoreFieldInstruction,
  ILMapLoadRangeInstruction,
  ILMapStoreRangeInstruction,
  type ILMetadata,
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
// C64 Hardware Struct Definitions (for test reference)
// =============================================================================

/**
 * VIC-II struct layout reference (47 registers at $D000-$D02E)
 */
const VIC_STRUCT = {
  base: 0xd000,
  fields: {
    sprite0X: { offset: 0x00, size: 1 },
    sprite0Y: { offset: 0x01, size: 1 },
    sprite1X: { offset: 0x02, size: 1 },
    sprite1Y: { offset: 0x03, size: 1 },
    spriteXMsb: { offset: 0x10, size: 1 },
    raster: { offset: 0x12, size: 1 },
    spriteEnable: { offset: 0x15, size: 1 },
    borderColor: { offset: 0x20, size: 1 },
    backgroundColor: { offset: 0x21, size: 1 },
  },
};

/**
 * SID struct layout reference (29 registers at $D400-$D41C)
 */
const SID_STRUCT = {
  base: 0xd400,
  fields: {
    voice1FreqLo: { offset: 0x00, size: 1 },
    voice1FreqHi: { offset: 0x01, size: 1 },
    voice1PwLo: { offset: 0x02, size: 1 },
    voice1PwHi: { offset: 0x03, size: 1 },
    voice1Control: { offset: 0x04, size: 1 },
    voice1AttackDecay: { offset: 0x05, size: 1 },
    voice1SustainRelease: { offset: 0x06, size: 1 },
    filterCutoffLo: { offset: 0x15, size: 1 },
    filterCutoffHi: { offset: 0x16, size: 1 },
    filterControl: { offset: 0x17, size: 1 },
    masterVolume: { offset: 0x18, size: 1 },
  },
};

/**
 * CIA struct layout reference (16 registers each)
 */
const CIA_STRUCT = {
  cia1Base: 0xdc00,
  cia2Base: 0xdd00,
  fields: {
    portA: { offset: 0x00, size: 1 },
    portB: { offset: 0x01, size: 1 },
    dataDirectionA: { offset: 0x02, size: 1 },
    dataDirectionB: { offset: 0x03, size: 1 },
    timerALo: { offset: 0x04, size: 1 },
    timerAHi: { offset: 0x05, size: 1 },
    timerBLo: { offset: 0x06, size: 1 },
    timerBHi: { offset: 0x07, size: 1 },
    interruptControl: { offset: 0x0d, size: 1 },
    controlA: { offset: 0x0e, size: 1 },
    controlB: { offset: 0x0f, size: 1 },
  },
};

// =============================================================================
// Complex VIC-II Struct Field Access Tests
// =============================================================================

describe('Complex VIC-II Struct Field Access', () => {
  it('should access all sprite X position fields with correct offsets', () => {
    const result = createTestRegister(0);

    // 8 sprites, X positions at even offsets 0x00, 0x02, 0x04, ..., 0x0E
    for (let sprite = 0; sprite < 8; sprite++) {
      const offset = sprite * 2;
      const addr = VIC_STRUCT.base + offset;
      const inst = new ILMapLoadFieldInstruction(
        sprite,
        'vic',
        `sprite${sprite}X`,
        addr,
        result,
        {
          mapInfo: {
            structName: 'vic',
            fieldName: `sprite${sprite}X`,
            baseAddress: VIC_STRUCT.base,
            fieldOffset: offset,
          },
        },
      );

      expect(inst.structName).toBe('vic');
      expect(inst.fieldName).toBe(`sprite${sprite}X`);
      expect(inst.address).toBe(addr);
      expect(inst.metadata.mapInfo?.fieldOffset).toBe(offset);
    }
  });

  it('should access all sprite Y position fields with correct offsets', () => {
    const result = createTestRegister(0);

    // 8 sprites, Y positions at odd offsets 0x01, 0x03, 0x05, ..., 0x0F
    for (let sprite = 0; sprite < 8; sprite++) {
      const offset = sprite * 2 + 1;
      const addr = VIC_STRUCT.base + offset;
      const inst = new ILMapLoadFieldInstruction(sprite, 'vic', `sprite${sprite}Y`, addr, result, {
        mapInfo: {
          structName: 'vic',
          fieldName: `sprite${sprite}Y`,
          baseAddress: VIC_STRUCT.base,
          fieldOffset: offset,
        },
      });

      expect(inst.address).toBe(addr);
      expect(inst.metadata.mapInfo?.fieldOffset).toBe(offset);
    }
  });

  it('should distinguish between sprite enable and X MSB fields', () => {
    const result = createTestRegister(0);

    // Sprite X MSB at $D010 (offset 0x10)
    const xMsbInst = new ILMapLoadFieldInstruction(0, 'vic', 'spriteXMsb', 0xd010, result, {
      mapInfo: {
        structName: 'vic',
        fieldName: 'spriteXMsb',
        baseAddress: VIC_STRUCT.base,
        fieldOffset: 0x10,
      },
    });

    // Sprite enable at $D015 (offset 0x15)
    const enableInst = new ILMapLoadFieldInstruction(1, 'vic', 'spriteEnable', 0xd015, result, {
      mapInfo: {
        structName: 'vic',
        fieldName: 'spriteEnable',
        baseAddress: VIC_STRUCT.base,
        fieldOffset: 0x15,
      },
    });

    expect(xMsbInst.address).toBe(0xd010);
    expect(enableInst.address).toBe(0xd015);
    expect(xMsbInst.metadata.mapInfo?.fieldOffset).toBe(0x10);
    expect(enableInst.metadata.mapInfo?.fieldOffset).toBe(0x15);
  });

  it('should access VIC-II color registers ($D020-$D024)', () => {
    const result = createTestRegister(0);
    const colorFields = ['borderColor', 'backgroundColor0', 'backgroundColor1', 'backgroundColor2'];

    for (let i = 0; i < colorFields.length; i++) {
      const offset = 0x20 + i;
      const addr = VIC_STRUCT.base + offset;
      const inst = new ILMapLoadFieldInstruction(i, 'vic', colorFields[i], addr, result, {
        mapInfo: {
          structName: 'vic',
          fieldName: colorFields[i],
          baseAddress: VIC_STRUCT.base,
          fieldOffset: offset,
        },
      });

      expect(inst.address).toBe(addr);
      expect(inst.fieldName).toBe(colorFields[i]);
    }
  });

  it('should handle VIC-II raster line field ($D012)', () => {
    const result = createTestRegister(0);
    const inst = new ILMapLoadFieldInstruction(0, 'vic', 'rasterLine', 0xd012, result, {
      mapInfo: {
        structName: 'vic',
        fieldName: 'rasterLine',
        baseAddress: VIC_STRUCT.base,
        fieldOffset: 0x12,
      },
      rasterCritical: true,
      estimatedCycles: 4,
    });

    expect(inst.address).toBe(0xd012);
    expect(inst.metadata.rasterCritical).toBe(true);
    expect(inst.metadata.estimatedCycles).toBe(4);
  });
});

// =============================================================================
// Complex SID Struct Field Access Tests
// =============================================================================

describe('Complex SID Struct Field Access', () => {
  it('should access SID voice 1 frequency as word (two bytes)', () => {
    const result = createTestRegister(0);

    // Voice 1 frequency is split across two bytes: $D400 (lo) and $D401 (hi)
    const freqLoInst = new ILMapLoadFieldInstruction(0, 'sid', 'voice1FreqLo', 0xd400, result, {
      mapInfo: {
        structName: 'sid',
        fieldName: 'voice1FreqLo',
        baseAddress: SID_STRUCT.base,
        fieldOffset: 0x00,
      },
    });

    const freqHiInst = new ILMapLoadFieldInstruction(1, 'sid', 'voice1FreqHi', 0xd401, result, {
      mapInfo: {
        structName: 'sid',
        fieldName: 'voice1FreqHi',
        baseAddress: SID_STRUCT.base,
        fieldOffset: 0x01,
      },
    });

    expect(freqLoInst.address).toBe(0xd400);
    expect(freqHiInst.address).toBe(0xd401);
    expect(freqLoInst.metadata.mapInfo?.fieldOffset).toBe(0x00);
    expect(freqHiInst.metadata.mapInfo?.fieldOffset).toBe(0x01);
  });

  it('should access all 3 SID voice frequency pairs', () => {
    const result = createTestRegister(0);

    // Voice offsets: voice1=0x00, voice2=0x07, voice3=0x0E
    const voiceOffsets = [0x00, 0x07, 0x0e];

    for (let voice = 0; voice < 3; voice++) {
      const baseOffset = voiceOffsets[voice];
      const loAddr = SID_STRUCT.base + baseOffset;
      const hiAddr = SID_STRUCT.base + baseOffset + 1;

      const loInst = new ILMapLoadFieldInstruction(
        voice * 2,
        'sid',
        `voice${voice + 1}FreqLo`,
        loAddr,
        result,
        {
          mapInfo: {
            structName: 'sid',
            fieldName: `voice${voice + 1}FreqLo`,
            baseAddress: SID_STRUCT.base,
            fieldOffset: baseOffset,
          },
        },
      );

      const hiInst = new ILMapLoadFieldInstruction(
        voice * 2 + 1,
        'sid',
        `voice${voice + 1}FreqHi`,
        hiAddr,
        result,
        {
          mapInfo: {
            structName: 'sid',
            fieldName: `voice${voice + 1}FreqHi`,
            baseAddress: SID_STRUCT.base,
            fieldOffset: baseOffset + 1,
          },
        },
      );

      expect(loInst.address).toBe(loAddr);
      expect(hiInst.address).toBe(hiAddr);
    }
  });

  it('should access SID ADSR envelope fields', () => {
    const result = createTestRegister(0);

    // Voice 1 ADSR: Attack/Decay at $D405, Sustain/Release at $D406
    const adInst = new ILMapLoadFieldInstruction(0, 'sid', 'voice1AttackDecay', 0xd405, result, {
      mapInfo: {
        structName: 'sid',
        fieldName: 'voice1AttackDecay',
        baseAddress: SID_STRUCT.base,
        fieldOffset: 0x05,
      },
    });

    const srInst = new ILMapLoadFieldInstruction(
      1,
      'sid',
      'voice1SustainRelease',
      0xd406,
      result,
      {
        mapInfo: {
          structName: 'sid',
          fieldName: 'voice1SustainRelease',
          baseAddress: SID_STRUCT.base,
          fieldOffset: 0x06,
        },
      },
    );

    expect(adInst.address).toBe(0xd405);
    expect(srInst.address).toBe(0xd406);
  });

  it('should access SID filter cutoff as word (11-bit)', () => {
    const result = createTestRegister(0);

    // Filter cutoff: lo (3 bits) at $D415, hi (8 bits) at $D416
    const cutoffLoInst = new ILMapLoadFieldInstruction(
      0,
      'sid',
      'filterCutoffLo',
      0xd415,
      result,
      {
        mapInfo: {
          structName: 'sid',
          fieldName: 'filterCutoffLo',
          baseAddress: SID_STRUCT.base,
          fieldOffset: 0x15,
        },
      },
    );

    const cutoffHiInst = new ILMapLoadFieldInstruction(
      1,
      'sid',
      'filterCutoffHi',
      0xd416,
      result,
      {
        mapInfo: {
          structName: 'sid',
          fieldName: 'filterCutoffHi',
          baseAddress: SID_STRUCT.base,
          fieldOffset: 0x16,
        },
      },
    );

    expect(cutoffLoInst.address).toBe(0xd415);
    expect(cutoffHiInst.address).toBe(0xd416);
  });

  it('should access SID master volume with filter mode ($D418)', () => {
    const value = createTestRegister(0);
    const inst = new ILMapStoreFieldInstruction(0, 'sid', 'masterVolume', 0xd418, value, {
      mapInfo: {
        structName: 'sid',
        fieldName: 'masterVolume',
        baseAddress: SID_STRUCT.base,
        fieldOffset: 0x18,
      },
      estimatedCycles: 4,
    });

    expect(inst.address).toBe(0xd418);
    expect(inst.hasSideEffects()).toBe(true);
  });
});

// =============================================================================
// Complex CIA Struct Field Access Tests
// =============================================================================

describe('Complex CIA Struct Field Access', () => {
  it('should access CIA1 timer A as word (two bytes)', () => {
    const result = createTestRegister(0);

    const timerLoInst = new ILMapLoadFieldInstruction(0, 'cia1', 'timerALo', 0xdc04, result, {
      mapInfo: {
        structName: 'cia1',
        fieldName: 'timerALo',
        baseAddress: CIA_STRUCT.cia1Base,
        fieldOffset: 0x04,
      },
    });

    const timerHiInst = new ILMapLoadFieldInstruction(1, 'cia1', 'timerAHi', 0xdc05, result, {
      mapInfo: {
        structName: 'cia1',
        fieldName: 'timerAHi',
        baseAddress: CIA_STRUCT.cia1Base,
        fieldOffset: 0x05,
      },
    });

    expect(timerLoInst.address).toBe(0xdc04);
    expect(timerHiInst.address).toBe(0xdc05);
  });

  it('should access CIA1 keyboard matrix ports', () => {
    const result = createTestRegister(0);

    const portAInst = new ILMapLoadFieldInstruction(0, 'cia1', 'portA', 0xdc00, result, {
      mapInfo: {
        structName: 'cia1',
        fieldName: 'portA',
        baseAddress: CIA_STRUCT.cia1Base,
        fieldOffset: 0x00,
      },
    });

    const portBInst = new ILMapLoadFieldInstruction(1, 'cia1', 'portB', 0xdc01, result, {
      mapInfo: {
        structName: 'cia1',
        fieldName: 'portB',
        baseAddress: CIA_STRUCT.cia1Base,
        fieldOffset: 0x01,
      },
    });

    expect(portAInst.address).toBe(0xdc00);
    expect(portBInst.address).toBe(0xdc01);
  });

  it('should access CIA2 VIC bank select port', () => {
    const value = createTestRegister(0);
    const inst = new ILMapStoreFieldInstruction(0, 'cia2', 'portA', 0xdd00, value, {
      mapInfo: {
        structName: 'cia2',
        fieldName: 'portA',
        baseAddress: CIA_STRUCT.cia2Base,
        fieldOffset: 0x00,
      },
    });

    expect(inst.address).toBe(0xdd00);
    expect(inst.hasSideEffects()).toBe(true);
  });

  it('should access CIA interrupt control register', () => {
    const result = createTestRegister(0);
    const inst = new ILMapLoadFieldInstruction(0, 'cia1', 'interruptControl', 0xdc0d, result, {
      mapInfo: {
        structName: 'cia1',
        fieldName: 'interruptControl',
        baseAddress: CIA_STRUCT.cia1Base,
        fieldOffset: 0x0d,
      },
    });

    expect(inst.address).toBe(0xdc0d);
  });
});

// =============================================================================
// @map Range Access Tests with Complex Patterns
// =============================================================================

describe('@map Range Access with Complex Patterns', () => {
  it('should handle sprite X position range with stride of 2', () => {
    const index = createTestRegister(0);
    const result = createTestRegister(1);

    // Sprite X positions are at even offsets: $D000, $D002, $D004, ...
    const inst = new ILMapLoadRangeInstruction(0, 'spriteX', 0xd000, 0xd00e, index, result, {
      mapInfo: {
        structName: 'vic',
        isRange: true,
        rangeStart: 0xd000,
        rangeEnd: 0xd00e,
        baseAddress: VIC_STRUCT.base,
      },
    });

    expect(inst.baseAddress).toBe(0xd000);
    expect(inst.endAddress).toBe(0xd00e);
    expect(inst.metadata.mapInfo?.isRange).toBe(true);
  });

  it('should handle color RAM range (1000 bytes)', () => {
    const index = createTestRegister(0, IL_WORD);
    const result = createTestRegister(1);

    // Color RAM: $D800-$DBE7 (1000 bytes for 40x25 screen)
    const inst = new ILMapLoadRangeInstruction(0, 'colorRam', 0xd800, 0xdbe7, index, result, {
      mapInfo: {
        structName: 'colorRam',
        isRange: true,
        rangeStart: 0xd800,
        rangeEnd: 0xdbe7,
        baseAddress: 0xd800,
      },
    });

    expect(inst.baseAddress).toBe(0xd800);
    expect(inst.endAddress).toBe(0xdbe7);
    expect(inst.index.type).toBe(IL_WORD);
  });

  it('should handle screen RAM range (1000 bytes)', () => {
    const index = createTestRegister(0, IL_WORD);
    const value = createTestRegister(1);

    // Screen RAM: $0400-$07E7 (1000 bytes)
    const inst = new ILMapStoreRangeInstruction(0, 'screenRam', 0x0400, 0x07e7, index, value, {
      mapInfo: {
        structName: 'screenRam',
        isRange: true,
        rangeStart: 0x0400,
        rangeEnd: 0x07e7,
        baseAddress: 0x0400,
      },
    });

    expect(inst.baseAddress).toBe(0x0400);
    expect(inst.endAddress).toBe(0x07e7);
    expect(inst.hasSideEffects()).toBe(true);
  });

  it('should handle sprite pointer range (8 bytes)', () => {
    const index = createTestRegister(0);
    const result = createTestRegister(1);

    // Sprite pointers at $07F8-$07FF (screen + 1016)
    const inst = new ILMapLoadRangeInstruction(0, 'spritePointers', 0x07f8, 0x07ff, index, result, {
      mapInfo: {
        structName: 'spritePointers',
        isRange: true,
        rangeStart: 0x07f8,
        rangeEnd: 0x07ff,
        baseAddress: 0x07f8,
      },
    });

    expect(inst.baseAddress).toBe(0x07f8);
    expect(inst.endAddress).toBe(0x07ff);
  });
});

// =============================================================================
// mapInfo Metadata Preservation for Optimizer
// =============================================================================

describe('mapInfo Metadata Preservation for Optimizer', () => {
  it('should preserve complete mapInfo for VIC struct field', () => {
    const result = createTestRegister(0);
    const metadata: ILMetadata = {
      mapInfo: {
        structName: 'vic',
        fieldName: 'borderColor',
        baseAddress: 0xd000,
        fieldOffset: 0x20,
        isRange: false,
      },
      addressingMode: 'Absolute',
      estimatedCycles: 4,
      m6502Hints: {
        preferredRegister: 'A',
        zeroPagePriority: 0,
      },
    };

    const inst = new ILMapLoadFieldInstruction(0, 'vic', 'borderColor', 0xd020, result, metadata);

    expect(inst.metadata.mapInfo?.structName).toBe('vic');
    expect(inst.metadata.mapInfo?.fieldName).toBe('borderColor');
    expect(inst.metadata.mapInfo?.baseAddress).toBe(0xd000);
    expect(inst.metadata.mapInfo?.fieldOffset).toBe(0x20);
    expect(inst.metadata.addressingMode).toBe('Absolute');
    expect(inst.metadata.m6502Hints?.preferredRegister).toBe('A');
  });

  it('should preserve mapInfo for range operations', () => {
    const index = createTestRegister(0);
    const result = createTestRegister(1);
    const metadata: ILMetadata = {
      mapInfo: {
        structName: 'spritePositions',
        isRange: true,
        rangeStart: 0xd000,
        rangeEnd: 0xd00f,
        baseAddress: 0xd000,
      },
      loopDepth: 1,
      executionFrequency: 'hot',
    };

    const inst = new ILMapLoadRangeInstruction(
      0,
      'spritePositions',
      0xd000,
      0xd00f,
      index,
      result,
      metadata,
    );

    expect(inst.metadata.mapInfo?.isRange).toBe(true);
    expect(inst.metadata.mapInfo?.rangeStart).toBe(0xd000);
    expect(inst.metadata.mapInfo?.rangeEnd).toBe(0xd00f);
    expect(inst.metadata.loopDepth).toBe(1);
    expect(inst.metadata.executionFrequency).toBe('hot');
  });

  it('should preserve rasterCritical flag for timing-critical fields', () => {
    const result = createTestRegister(0);
    const metadata: ILMetadata = {
      mapInfo: {
        structName: 'vic',
        fieldName: 'rasterLine',
        baseAddress: 0xd000,
        fieldOffset: 0x12,
      },
      rasterCritical: true,
      estimatedCycles: 4,
      isLoopInvariant: false,
    };

    const inst = new ILMapLoadFieldInstruction(0, 'vic', 'rasterLine', 0xd012, result, metadata);

    expect(inst.metadata.rasterCritical).toBe(true);
    expect(inst.metadata.isLoopInvariant).toBe(false);
  });

  it('should preserve source location for debugging', () => {
    const value = createTestRegister(0);
    const metadata: ILMetadata = {
      location: {
        start: { line: 42, column: 10, offset: 1234 },
        end: { line: 42, column: 35, offset: 1250 },
        source: 'sid.masterVolume = volume',
      },
      mapInfo: {
        structName: 'sid',
        fieldName: 'masterVolume',
        baseAddress: 0xd400,
        fieldOffset: 0x18,
      },
      sourceExpression: 'sid.masterVolume = volume',
    };

    const inst = new ILMapStoreFieldInstruction(0, 'sid', 'masterVolume', 0xd418, value, metadata);

    expect(inst.metadata.location?.start.line).toBe(42);
    expect(inst.metadata.location?.start.column).toBe(10);
    expect(inst.metadata.sourceExpression).toBe('sid.masterVolume = volume');
  });

  it('should preserve live range information for register allocation', () => {
    const result = createTestRegister(0);
    const metadata: ILMetadata = {
      mapInfo: {
        structName: 'vic',
        fieldName: 'borderColor',
        baseAddress: 0xd000,
        fieldOffset: 0x20,
      },
      liveRangeStart: 5,
      liveRangeEnd: 15,
      registerPressure: 3,
    };

    const inst = new ILMapLoadFieldInstruction(0, 'vic', 'borderColor', 0xd020, result, metadata);

    expect(inst.metadata.liveRangeStart).toBe(5);
    expect(inst.metadata.liveRangeEnd).toBe(15);
    expect(inst.metadata.registerPressure).toBe(3);
  });
});