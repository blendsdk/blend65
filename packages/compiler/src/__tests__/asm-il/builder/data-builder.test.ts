/**
 * Data Builder Tests
 *
 * Tests for DataBuilder: byte, word, text, fill directives.
 *
 * @module __tests__/asm-il/builder/data-builder.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AsmModuleBuilder } from '../../../asm-il/builder/module-builder.js';
import { DataType, isAsmData, isAsmRaw } from '../../../asm-il/types.js';
import type { AsmData } from '../../../asm-il/types.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Get the last data item from builder
 */
function getLastData(builder: AsmModuleBuilder): AsmData | undefined {
  const items = builder.getItems();
  const last = items[items.length - 1];
  return isAsmData(last) ? last : undefined;
}

// ============================================================================
// BYTE DIRECTIVE TESTS
// ============================================================================

describe('Byte directive', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  describe('byte', () => {
    it('should emit byte array', () => {
      builder.byte([0x00, 0x01, 0x02]);

      const data = getLastData(builder);
      expect(data).toBeDefined();
      expect(data?.type).toBe(DataType.Byte);
      expect(data?.values).toEqual([0x00, 0x01, 0x02]);
    });

    it('should track data bytes', () => {
      builder.byte([0x01, 0x02, 0x03, 0x04]);

      const stats = builder.getStats();
      expect(stats.dataBytes).toBe(4);
    });

    it('should support comment', () => {
      builder.byte([0xFF], 'Max value');

      const data = getLastData(builder);
      expect(data?.comment).toBe('Max value');
    });

    it('should emit empty byte array', () => {
      builder.byte([]);

      const data = getLastData(builder);
      expect(data?.values).toEqual([]);
    });
  });

  describe('singleByte', () => {
    it('should emit single byte', () => {
      builder.singleByte(0x42);

      const data = getLastData(builder);
      expect(data?.values).toEqual([0x42]);
    });

    it('should track one data byte', () => {
      builder.singleByte(0x00);

      const stats = builder.getStats();
      expect(stats.dataBytes).toBe(1);
    });
  });
});

// ============================================================================
// WORD DIRECTIVE TESTS
// ============================================================================

describe('Word directive', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  describe('word', () => {
    it('should emit word array', () => {
      builder.word([0x1234, 0x5678]);

      const data = getLastData(builder);
      expect(data).toBeDefined();
      expect(data?.type).toBe(DataType.Word);
      expect(data?.values).toEqual([0x1234, 0x5678]);
    });

    it('should track data bytes (2 per word)', () => {
      builder.word([0x1234, 0x5678]);

      const stats = builder.getStats();
      expect(stats.dataBytes).toBe(4);
    });

    it('should support comment', () => {
      builder.word([0xD020], 'Border color address');

      const data = getLastData(builder);
      expect(data?.comment).toBe('Border color address');
    });
  });

  describe('singleWord', () => {
    it('should emit single word', () => {
      builder.singleWord(0xABCD);

      const data = getLastData(builder);
      expect(data?.values).toEqual([0xABCD]);
    });

    it('should track two data bytes', () => {
      builder.singleWord(0x0000);

      const stats = builder.getStats();
      expect(stats.dataBytes).toBe(2);
    });
  });

  describe('wordLabel', () => {
    it('should emit word label reference via raw', () => {
      builder.wordLabel('_main');

      const items = builder.getItems();
      const last = items[items.length - 1];
      expect(isAsmRaw(last)).toBe(true);
    });

    it('should include comment when provided', () => {
      builder.wordLabel('_main', 'Function pointer');

      const items = builder.getItems();
      const last = items[items.length - 1];
      if (isAsmRaw(last)) {
        expect(last.text).toContain('Function pointer');
      }
    });

    it('should track two data bytes', () => {
      builder.wordLabel('_main');

      const stats = builder.getStats();
      expect(stats.dataBytes).toBe(2);
    });
  });
});

// ============================================================================
// TEXT DIRECTIVE TESTS
// ============================================================================

describe('Text directive', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  describe('text', () => {
    it('should emit text string', () => {
      builder.text('HELLO');

      const data = getLastData(builder);
      expect(data).toBeDefined();
      expect(data?.type).toBe(DataType.Text);
      expect(data?.values).toBe('HELLO');
    });

    it('should track data bytes (one per character)', () => {
      builder.text('HELLO');

      const stats = builder.getStats();
      expect(stats.dataBytes).toBe(5);
    });

    it('should handle empty string', () => {
      builder.text('');

      const data = getLastData(builder);
      expect(data?.values).toBe('');
    });

    it('should support comment', () => {
      builder.text('WORLD', 'Greeting text');

      const data = getLastData(builder);
      expect(data?.comment).toBe('Greeting text');
    });
  });

  describe('textNullTerminated', () => {
    it('should emit text followed by null byte', () => {
      builder.textNullTerminated('HELLO');

      const items = builder.getItems();
      expect(items).toHaveLength(2);

      // First item: text
      const textItem = items[0];
      expect(isAsmData(textItem)).toBe(true);
      if (isAsmData(textItem)) {
        expect(textItem.type).toBe(DataType.Text);
      }

      // Second item: null terminator
      const nullItem = items[1];
      expect(isAsmData(nullItem)).toBe(true);
      if (isAsmData(nullItem)) {
        expect(nullItem.type).toBe(DataType.Byte);
        expect(nullItem.values).toEqual([0]);
      }
    });

    it('should track all data bytes including null', () => {
      builder.textNullTerminated('HI');

      const stats = builder.getStats();
      expect(stats.dataBytes).toBe(3); // 'H', 'I', 0x00
    });
  });

  describe('petscii', () => {
    it('should emit PETSCII via raw directive', () => {
      builder.petscii('HELLO');

      const items = builder.getItems();
      const last = items[items.length - 1];
      expect(isAsmRaw(last)).toBe(true);
      if (isAsmRaw(last)) {
        expect(last.text).toContain('!pet');
        expect(last.text).toContain('HELLO');
      }
    });

    it('should track data bytes', () => {
      builder.petscii('TEST');

      const stats = builder.getStats();
      expect(stats.dataBytes).toBe(4);
    });
  });
});

// ============================================================================
// FILL DIRECTIVE TESTS
// ============================================================================

describe('Fill directive', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  describe('fill', () => {
    it('should emit fill directive', () => {
      builder.fill(256, 0xFF);

      const data = getLastData(builder);
      expect(data).toBeDefined();
      expect(data?.type).toBe(DataType.Fill);
      expect(data?.values).toEqual({ count: 256, value: 0xFF });
    });

    it('should default value to 0', () => {
      builder.fill(100);

      const data = getLastData(builder);
      expect((data?.values as { count: number; value: number }).value).toBe(0);
    });

    it('should track data bytes', () => {
      builder.fill(256, 0x00);

      const stats = builder.getStats();
      expect(stats.dataBytes).toBe(256);
    });

    it('should support comment', () => {
      builder.fill(64, 0x00, 'Screen buffer');

      const data = getLastData(builder);
      expect(data?.comment).toBe('Screen buffer');
    });
  });

  describe('zero', () => {
    it('should emit zero-filled region', () => {
      builder.zero(128);

      const data = getLastData(builder);
      expect(data?.type).toBe(DataType.Fill);
      expect((data?.values as { count: number; value: number }).count).toBe(128);
      expect((data?.values as { count: number; value: number }).value).toBe(0);
    });
  });

  describe('reserve', () => {
    it('should reserve space (alias for zero fill)', () => {
      builder.reserve(64);

      const data = getLastData(builder);
      expect(data?.type).toBe(DataType.Fill);
      expect((data?.values as { count: number; value: number }).count).toBe(64);
    });

    it('should add default comment', () => {
      builder.reserve(32);

      const data = getLastData(builder);
      expect(data?.comment).toBe('reserved');
    });

    it('should allow custom comment', () => {
      builder.reserve(32, 'Sprite buffer');

      const data = getLastData(builder);
      expect(data?.comment).toBe('Sprite buffer');
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Data builder integration', () => {
  it('should track total data bytes across directives', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .byte([0x01, 0x02]) // 2 bytes
      .word([0x1234]) // 2 bytes
      .text('HI') // 2 bytes
      .fill(10, 0x00); // 10 bytes

    const stats = builder.getStats();
    expect(stats.dataBytes).toBe(16);
  });

  it('should update current address', () => {
    const builder = new AsmModuleBuilder('test.blend', 0x0801)
      .byte([0x01, 0x02, 0x03]); // 3 bytes

    expect(builder.getCurrentAddress()).toBe(0x0801 + 3);
  });

  it('should support source location tracking', () => {
    const builder = new AsmModuleBuilder('test.blend');
    const location = {
      start: { line: 1, column: 0, offset: 0 },
      end: { line: 1, column: 10, offset: 10 },
      file: 'test.blend',
    };

    builder.setLocation(location);
    builder.byte([0x00]);

    const data = getLastData(builder);
    expect(data?.sourceLocation).toEqual(location);
  });
});