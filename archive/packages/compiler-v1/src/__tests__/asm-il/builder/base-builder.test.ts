/**
 * Base ASM Builder Tests
 *
 * Tests for BaseAsmBuilder functionality: state management,
 * source location tracking, labels, and directives.
 *
 * @module __tests__/asm-il/builder/base-builder.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AsmModuleBuilder } from '../../../asm-il/builder/module-builder.js';
import { LabelType, isAsmLabel, isAsmComment, isAsmBlankLine, isAsmOrigin, isAsmRaw } from '../../../asm-il/types.js';
import type { SourceLocation } from '../../../ast/base.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a test source location
 */
function createTestLocation(line: number = 1, column: number = 0): SourceLocation {
  return {
    start: { line, column, offset: 0 },
    end: { line, column: column + 10, offset: 10 },
    file: 'test.blend',
  };
}

// ============================================================================
// CONSTRUCTION TESTS
// ============================================================================

describe('BaseAsmBuilder construction', () => {
  it('should create builder with default values', () => {
    const builder = new AsmModuleBuilder('test.blend');

    expect(builder.getName()).toBe('test.blend');
    expect(builder.getOrigin()).toBe(0x0801);
    expect(builder.getTarget()).toBe('c64');
    expect(builder.getItemCount()).toBe(0);
  });

  it('should create builder with custom origin', () => {
    const builder = new AsmModuleBuilder('test.blend', 0xC000);

    expect(builder.getOrigin()).toBe(0xC000);
    expect(builder.getCurrentAddress()).toBe(0xC000);
  });

  it('should create builder with custom target', () => {
    const builder = new AsmModuleBuilder('test.blend', 0x0801, 'vic20');

    expect(builder.getTarget()).toBe('vic20');
  });
});

// ============================================================================
// SOURCE LOCATION TRACKING TESTS
// ============================================================================

describe('Source location tracking', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  it('should set and get source location', () => {
    const location = createTestLocation(10, 5);
    builder.setLocation(location);

    expect(builder.getLocation()).toEqual(location);
  });

  it('should clear source location', () => {
    const location = createTestLocation();
    builder.setLocation(location);
    builder.clearLocation();

    expect(builder.getLocation()).toBeUndefined();
  });

  it('should return this for chaining', () => {
    const location = createTestLocation();
    const result = builder.setLocation(location);

    expect(result).toBe(builder);
  });

  it('should attach location to items', () => {
    const location = createTestLocation(5, 10);
    builder.setLocation(location);
    builder.functionLabel('_main');

    const items = builder.getItems();
    const label = items[0];
    expect(isAsmLabel(label)).toBe(true);
    if (isAsmLabel(label)) {
      expect(label.sourceLocation).toEqual(location);
    }
  });

  it('should not attach location when cleared', () => {
    builder.setLocation(createTestLocation());
    builder.clearLocation();
    builder.functionLabel('_main');

    const items = builder.getItems();
    const label = items[0];
    if (isAsmLabel(label)) {
      expect(label.sourceLocation).toBeUndefined();
    }
  });
});

// ============================================================================
// LABEL MANAGEMENT TESTS
// ============================================================================

describe('Label management', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  describe('functionLabel', () => {
    it('should add function label', () => {
      builder.functionLabel('_main');

      const items = builder.getItems();
      expect(items).toHaveLength(1);

      const label = items[0];
      expect(isAsmLabel(label)).toBe(true);
      if (isAsmLabel(label)) {
        expect(label.name).toBe('_main');
        expect(label.type).toBe(LabelType.Function);
      }
    });

    it('should increment function count', () => {
      builder.functionLabel('_main');
      builder.functionLabel('_update');

      const stats = builder.getStats();
      expect(stats.functionCount).toBe(2);
    });

    it('should add comment to function label', () => {
      builder.functionLabel('_main', 'Entry point');

      const items = builder.getItems();
      const label = items[0];
      if (isAsmLabel(label)) {
        expect(label.comment).toBe('Entry point');
      }
    });

    it('should support exported function labels', () => {
      builder.functionLabel('_main', 'Entry point', true);

      const items = builder.getItems();
      const label = items[0];
      if (isAsmLabel(label)) {
        expect(label.exported).toBe(true);
      }
    });
  });

  describe('globalLabel', () => {
    it('should add global variable label', () => {
      builder.globalLabel('_counter');

      const items = builder.getItems();
      expect(items).toHaveLength(1);

      const label = items[0];
      if (isAsmLabel(label)) {
        expect(label.name).toBe('_counter');
        expect(label.type).toBe(LabelType.Global);
      }
    });

    it('should increment global count', () => {
      builder.globalLabel('_counter');
      builder.globalLabel('_score');

      const stats = builder.getStats();
      expect(stats.globalCount).toBe(2);
    });
  });

  describe('blockLabel', () => {
    it('should add block label', () => {
      builder.blockLabel('.loop');

      const items = builder.getItems();
      const label = items[0];
      if (isAsmLabel(label)) {
        expect(label.name).toBe('.loop');
        expect(label.type).toBe(LabelType.Block);
        expect(label.exported).toBe(false);
      }
    });
  });

  describe('dataLabel', () => {
    it('should add data section label', () => {
      builder.dataLabel('.str_hello');

      const items = builder.getItems();
      const label = items[0];
      if (isAsmLabel(label)) {
        expect(label.name).toBe('.str_hello');
        expect(label.type).toBe(LabelType.Data);
      }
    });
  });

  describe('tempLabel', () => {
    it('should add temporary label', () => {
      builder.tempLabel('.L0001');

      const items = builder.getItems();
      const label = items[0];
      if (isAsmLabel(label)) {
        expect(label.name).toBe('.L0001');
        expect(label.type).toBe(LabelType.Temp);
      }
    });
  });

  describe('label lookup', () => {
    it('should check if label exists', () => {
      builder.functionLabel('_main');

      expect(builder.hasLabel('_main')).toBe(true);
      expect(builder.hasLabel('_other')).toBe(false);
    });

    it('should get label by name', () => {
      builder.functionLabel('_main', 'Entry point');

      const label = builder.getLabel('_main');
      expect(label).toBeDefined();
      expect(label?.name).toBe('_main');
      expect(label?.comment).toBe('Entry point');
    });

    it('should return undefined for non-existent label', () => {
      const label = builder.getLabel('_nonexistent');
      expect(label).toBeUndefined();
    });

    it('should track label address', () => {
      // Start at $0801, add some instructions
      builder.ldaImm(0x05); // 2 bytes
      builder.functionLabel('_after');

      const label = builder.getLabel('_after');
      expect(label?.address).toBe(0x0801 + 2);
    });
  });
});

// ============================================================================
// DIRECTIVE TESTS
// ============================================================================

describe('Directives', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  describe('setOrigin', () => {
    it('should add origin directive', () => {
      builder.setOrigin(0xC000);

      const items = builder.getItems();
      expect(items).toHaveLength(1);

      const origin = items[0];
      expect(isAsmOrigin(origin)).toBe(true);
      if (isAsmOrigin(origin)) {
        expect(origin.address).toBe(0xC000);
      }
    });

    it('should update current address', () => {
      builder.setOrigin(0xC000);

      expect(builder.getCurrentAddress()).toBe(0xC000);
    });

    it('should support comment', () => {
      builder.setOrigin(0xC000, 'High memory');

      const items = builder.getItems();
      const origin = items[0];
      if (isAsmOrigin(origin)) {
        expect(origin.comment).toBe('High memory');
      }
    });
  });

  describe('comment', () => {
    it('should add line comment', () => {
      builder.comment('This is a comment');

      const items = builder.getItems();
      expect(items).toHaveLength(1);

      const comment = items[0];
      expect(isAsmComment(comment)).toBe(true);
      if (isAsmComment(comment)) {
        expect(comment.text).toBe('This is a comment');
        expect(comment.style).toBe('line');
      }
    });

    it('should add section comment', () => {
      builder.comment('Section Header', 'section');

      const items = builder.getItems();
      const comment = items[0];
      if (isAsmComment(comment)) {
        expect(comment.style).toBe('section');
      }
    });

    it('should add inline comment', () => {
      builder.comment('inline note', 'inline');

      const items = builder.getItems();
      const comment = items[0];
      if (isAsmComment(comment)) {
        expect(comment.style).toBe('inline');
      }
    });
  });

  describe('section', () => {
    it('should add section header', () => {
      builder.section('Code Section');

      const items = builder.getItems();
      const comment = items[0];
      expect(isAsmComment(comment)).toBe(true);
      if (isAsmComment(comment)) {
        expect(comment.text).toBe('Code Section');
        expect(comment.style).toBe('section');
      }
    });
  });

  describe('blank', () => {
    it('should add blank line', () => {
      builder.blank();

      const items = builder.getItems();
      expect(items).toHaveLength(1);
      expect(isAsmBlankLine(items[0])).toBe(true);
    });
  });

  describe('raw', () => {
    it('should add raw text', () => {
      builder.raw('        !align 256');

      const items = builder.getItems();
      expect(items).toHaveLength(1);

      const raw = items[0];
      expect(isAsmRaw(raw)).toBe(true);
      if (isAsmRaw(raw)) {
        expect(raw.text).toBe('        !align 256');
      }
    });
  });
});

// ============================================================================
// STATISTICS TESTS
// ============================================================================

describe('Statistics', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  it('should track code bytes', () => {
    builder.ldaImm(0x05); // 2 bytes
    builder.staAbs(0xD020); // 3 bytes
    builder.rts(); // 1 byte

    const stats = builder.getStats();
    expect(stats.codeBytes).toBe(6);
  });

  it('should track data bytes', () => {
    builder.byte([0x01, 0x02, 0x03]); // 3 bytes
    builder.word([0x1234]); // 2 bytes

    const stats = builder.getStats();
    expect(stats.dataBytes).toBe(5);
  });

  it('should track current address', () => {
    builder.ldaImm(0x05); // 2 bytes
    builder.staAbs(0xD020); // 3 bytes

    const stats = builder.getStats();
    expect(stats.currentAddress).toBe(0x0801 + 5);
  });

  it('should track item count', () => {
    builder.functionLabel('_main');
    builder.ldaImm(0x05);
    builder.rts();

    const stats = builder.getStats();
    expect(stats.itemCount).toBe(3);
  });

  it('should provide complete stats snapshot', () => {
    builder.functionLabel('_main');
    builder.globalLabel('_counter');
    builder.ldaImm(0x05);
    builder.byte([0x00]);

    const stats = builder.getStats();
    expect(stats).toHaveProperty('codeBytes');
    expect(stats).toHaveProperty('dataBytes');
    expect(stats).toHaveProperty('functionCount');
    expect(stats).toHaveProperty('globalCount');
    expect(stats).toHaveProperty('itemCount');
    expect(stats).toHaveProperty('currentAddress');
  });
});

// ============================================================================
// FLUENT API TESTS
// ============================================================================

describe('Fluent API', () => {
  it('should support method chaining', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .setOrigin(0x0801)
      .comment('Test program')
      .functionLabel('_main')
      .ldaImm(0x05)
      .staAbs(0xD020)
      .rts();

    expect(builder.getItemCount()).toBe(6);
  });

  it('should support location chaining', () => {
    const location = createTestLocation();
    const builder = new AsmModuleBuilder('test.blend')
      .setLocation(location)
      .functionLabel('_main')
      .clearLocation()
      .rts();

    expect(builder.getItemCount()).toBe(2);
  });
});