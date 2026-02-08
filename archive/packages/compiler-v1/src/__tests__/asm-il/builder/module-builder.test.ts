/**
 * Module Builder Tests
 *
 * Tests for AsmModuleBuilder: module construction, header/footer,
 * build(), reset(), clone().
 *
 * @module __tests__/asm-il/builder/module-builder.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AsmModuleBuilder, createAsmModuleBuilder } from '../../../asm-il/builder/module-builder.js';
import { isAsmComment, isAsmRaw } from '../../../asm-il/types.js';

// ============================================================================
// CONSTRUCTOR AND FACTORY TESTS
// ============================================================================

describe('AsmModuleBuilder construction', () => {
  it('should create builder with name', () => {
    const builder = new AsmModuleBuilder('main.blend');

    expect(builder.getName()).toBe('main.blend');
  });

  it('should use default origin of $0801', () => {
    const builder = new AsmModuleBuilder('test.blend');

    expect(builder.getOrigin()).toBe(0x0801);
  });

  it('should use default target of c64', () => {
    const builder = new AsmModuleBuilder('test.blend');

    expect(builder.getTarget()).toBe('c64');
  });

  it('should allow custom origin', () => {
    const builder = new AsmModuleBuilder('test.blend', 0xC000);

    expect(builder.getOrigin()).toBe(0xC000);
    expect(builder.getCurrentAddress()).toBe(0xC000);
  });

  it('should allow custom target', () => {
    const builder = new AsmModuleBuilder('test.blend', 0x0801, 'vic20');

    expect(builder.getTarget()).toBe('vic20');
  });
});

describe('createAsmModuleBuilder factory', () => {
  it('should create builder with defaults', () => {
    const builder = createAsmModuleBuilder('test.blend');

    expect(builder).toBeInstanceOf(AsmModuleBuilder);
    expect(builder.getName()).toBe('test.blend');
    expect(builder.getOrigin()).toBe(0x0801);
    expect(builder.getTarget()).toBe('c64');
  });

  it('should accept custom parameters', () => {
    const builder = createAsmModuleBuilder('test.blend', 0xA000, 'plus4');

    expect(builder.getOrigin()).toBe(0xA000);
    expect(builder.getTarget()).toBe('plus4');
  });
});

// ============================================================================
// OUTPUT CONFIGURATION TESTS
// ============================================================================

describe('Output configuration', () => {
  it('should set output file path', () => {
    const builder = new AsmModuleBuilder('test.blend');
    builder.setOutputFile('output/game.prg');

    const module = builder.build();
    expect(module.outputFile).toBe('output/game.prg');
  });

  it('should return this for chaining', () => {
    const builder = new AsmModuleBuilder('test.blend');
    const result = builder.setOutputFile('output.prg');

    expect(result).toBe(builder);
  });
});

// ============================================================================
// HEADER/FOOTER TESTS
// ============================================================================

describe('Header and footer', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  describe('header', () => {
    it('should emit header comments', () => {
      builder.header();

      const items = builder.getItems();
      expect(items.length).toBeGreaterThan(0);

      // Should have section separators and info
      const comments = items.filter(isAsmComment);
      expect(comments.length).toBeGreaterThan(0);
    });

    it('should include module name', () => {
      builder.header();

      const items = builder.getItems();
      const moduleComment = items.find(
        (item) => isAsmComment(item) && item.text.includes('test.blend')
      );
      expect(moduleComment).toBeDefined();
    });

    it('should use custom module name when provided', () => {
      builder.header('custom-module');

      const items = builder.getItems();
      const moduleComment = items.find(
        (item) => isAsmComment(item) && item.text.includes('custom-module')
      );
      expect(moduleComment).toBeDefined();
    });

    it('should include target info', () => {
      builder.header();

      const items = builder.getItems();
      const targetComment = items.find(
        (item) => isAsmComment(item) && item.text.includes('c64')
      );
      expect(targetComment).toBeDefined();
    });

    it('should return this for chaining', () => {
      const result = builder.header();
      expect(result).toBe(builder);
    });
  });

  describe('footer', () => {
    it('should emit footer comments', () => {
      builder.footer();

      const items = builder.getItems();
      expect(items.length).toBeGreaterThan(0);
    });

    it('should include size statistics', () => {
      builder.ldaImm(0x05); // 2 bytes code
      builder.byte([0x00, 0x01]); // 2 bytes data
      builder.footer();

      const items = builder.getItems();
      const codeComment = items.find(
        (item) => isAsmComment(item) && item.text.includes('Code size')
      );
      const dataComment = items.find(
        (item) => isAsmComment(item) && item.text.includes('Data size')
      );
      expect(codeComment).toBeDefined();
      expect(dataComment).toBeDefined();
    });

    it('should include function count', () => {
      builder.functionLabel('_main');
      builder.functionLabel('_update');
      builder.footer();

      const items = builder.getItems();
      const funcComment = items.find(
        (item) => isAsmComment(item) && item.text.includes('Functions')
      );
      expect(funcComment).toBeDefined();
    });

    it('should return this for chaining', () => {
      const result = builder.footer();
      expect(result).toBe(builder);
    });
  });
});

// ============================================================================
// BASIC LOADER TESTS
// ============================================================================

describe('BASIC loader', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  it('should emit BASIC loader stub', () => {
    builder.basicLoader();

    const items = builder.getItems();
    expect(items.length).toBeGreaterThan(0);

    // Should contain raw BASIC stub elements
    const rawItems = items.filter(isAsmRaw);
    expect(rawItems.length).toBeGreaterThan(0);
  });

  it('should set origin to BASIC start', () => {
    builder.basicLoader();

    // Should have set origin to $0801
    const items = builder.getItems();
    const hasOrigin = items.some(
      (item) => item.kind === 'origin' && (item as { address: number }).address === 0x0801
    );
    expect(hasOrigin).toBe(true);
  });

  it('should return this for chaining', () => {
    const result = builder.basicLoader();
    expect(result).toBe(builder);
  });

  it('should accept custom SYS address', () => {
    builder.basicLoader(0x0900);

    const items = builder.getItems();
    const sysRaw = items.find(
      (item) => isAsmRaw(item) && item.text.includes('2304') // 0x0900 = 2304
    );
    expect(sysRaw).toBeDefined();
  });
});

// ============================================================================
// BUILD TESTS
// ============================================================================

describe('build()', () => {
  it('should create immutable AsmModule', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .functionLabel('_main')
      .ldaImm(0x05)
      .rts();

    const module = builder.build();

    expect(module.name).toBe('test.blend');
    expect(module.origin).toBe(0x0801);
    expect(module.target).toBe('c64');
    expect(module.items).toHaveLength(3);
  });

  it('should include all labels in lookup', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .functionLabel('_main')
      .blockLabel('.loop');

    const module = builder.build();

    expect(module.labels.has('_main')).toBe(true);
    expect(module.labels.has('.loop')).toBe(true);
    expect(module.labels.size).toBe(2);
  });

  it('should include metadata', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .functionLabel('_main')
      .globalLabel('_counter')
      .ldaImm(0x05)
      .byte([0x00]);

    const module = builder.build();

    expect(module.metadata.compilerVersion).toBe('0.1.0');
    expect(module.metadata.optimizationLevel).toBe('O0');
    expect(module.metadata.estimatedCodeSize).toBe(2);
    expect(module.metadata.estimatedDataSize).toBe(1);
    expect(module.metadata.functionCount).toBe(1);
    expect(module.metadata.globalCount).toBe(1);
    expect(module.metadata.generatedAt).toBeDefined();
  });

  it('should create independent copy of items', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .ldaImm(0x05);

    const module = builder.build();
    const originalLength = module.items.length;

    // Add more to builder
    builder.rts();

    // Module should be unchanged
    expect(module.items.length).toBe(originalLength);
  });

  it('should create independent copy of labels', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .functionLabel('_main');

    const module = builder.build();
    const originalSize = module.labels.size;

    // Add more to builder
    builder.functionLabel('_other');

    // Module should be unchanged
    expect(module.labels.size).toBe(originalSize);
  });
});

// ============================================================================
// RESET TESTS
// ============================================================================

describe('reset()', () => {
  it('should clear all items', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .functionLabel('_main')
      .ldaImm(0x05)
      .rts();

    builder.reset();

    expect(builder.getItemCount()).toBe(0);
  });

  it('should clear all labels', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .functionLabel('_main')
      .blockLabel('.loop');

    builder.reset();

    expect(builder.hasLabel('_main')).toBe(false);
    expect(builder.hasLabel('.loop')).toBe(false);
  });

  it('should reset current address to origin', () => {
    const builder = new AsmModuleBuilder('test.blend', 0x0801)
      .ldaImm(0x05) // 2 bytes
      .staAbs(0xD020); // 3 bytes

    builder.reset();

    expect(builder.getCurrentAddress()).toBe(0x0801);
  });

  it('should reset statistics', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .functionLabel('_main')
      .globalLabel('_counter')
      .ldaImm(0x05)
      .byte([0x00, 0x01]);

    builder.reset();

    const stats = builder.getStats();
    expect(stats.codeBytes).toBe(0);
    expect(stats.dataBytes).toBe(0);
    expect(stats.functionCount).toBe(0);
    expect(stats.globalCount).toBe(0);
    expect(stats.itemCount).toBe(0);
  });

  it('should preserve name, origin, and target', () => {
    const builder = new AsmModuleBuilder('test.blend', 0xC000, 'vic20');
    builder.reset();

    expect(builder.getName()).toBe('test.blend');
    expect(builder.getOrigin()).toBe(0xC000);
    expect(builder.getTarget()).toBe('vic20');
  });

  it('should clear output file', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .setOutputFile('output.prg');

    builder.reset();

    const module = builder.build();
    expect(module.outputFile).toBeUndefined();
  });

  it('should clear source location', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .setLocation({ start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 10, offset: 10 }, file: 'test.blend' });

    builder.reset();

    expect(builder.getLocation()).toBeUndefined();
  });

  it('should return this for chaining', () => {
    const builder = new AsmModuleBuilder('test.blend');
    const result = builder.reset();

    expect(result).toBe(builder);
  });
});

// ============================================================================
// CLONE TESTS
// ============================================================================

describe('clone()', () => {
  it('should create new builder instance', () => {
    const builder = new AsmModuleBuilder('test.blend');
    const cloned = builder.clone();

    expect(cloned).not.toBe(builder);
    expect(cloned).toBeInstanceOf(AsmModuleBuilder);
  });

  it('should copy name, origin, target', () => {
    const builder = new AsmModuleBuilder('test.blend', 0xC000, 'vic20');
    const cloned = builder.clone();

    expect(cloned.getName()).toBe('test.blend');
    expect(cloned.getOrigin()).toBe(0xC000);
    expect(cloned.getTarget()).toBe('vic20');
  });

  it('should copy items', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .functionLabel('_main')
      .ldaImm(0x05);

    const cloned = builder.clone();

    expect(cloned.getItemCount()).toBe(2);
  });

  it('should copy labels', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .functionLabel('_main')
      .blockLabel('.loop');

    const cloned = builder.clone();

    expect(cloned.hasLabel('_main')).toBe(true);
    expect(cloned.hasLabel('.loop')).toBe(true);
  });

  it('should copy statistics', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .functionLabel('_main')
      .ldaImm(0x05);

    const cloned = builder.clone();

    const stats = cloned.getStats();
    expect(stats.functionCount).toBe(1);
    expect(stats.codeBytes).toBe(2);
  });

  it('should copy output file', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .setOutputFile('output.prg');

    const cloned = builder.clone();
    const module = cloned.build();

    expect(module.outputFile).toBe('output.prg');
  });

  it('should copy source location', () => {
    const location = { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 10, offset: 10 }, file: 'test.blend' };
    const builder = new AsmModuleBuilder('test.blend')
      .setLocation(location);

    const cloned = builder.clone();

    expect(cloned.getLocation()).toEqual(location);
  });

  it('should be independent of original', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .functionLabel('_main');

    const cloned = builder.clone();

    // Modify original
    builder.rts();

    // Clone should be unchanged
    expect(cloned.getItemCount()).toBe(1);
    expect(builder.getItemCount()).toBe(2);
  });

  it('should have independent labels from original', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .functionLabel('_main');

    const cloned = builder.clone();

    // Modify original
    builder.blockLabel('.new_label');

    // Clone should not have new label
    expect(cloned.hasLabel('.new_label')).toBe(false);
    expect(builder.hasLabel('.new_label')).toBe(true);
  });
});

// ============================================================================
// COMPLETE PROGRAM TESTS
// ============================================================================

describe('Complete program building', () => {
  it('should build a simple hello world program structure', () => {
    const builder = new AsmModuleBuilder('hello.blend')
      .setOutputFile('hello.prg')
      .header()
      .basicLoader()
      .functionLabel('_main', 'Entry point')
      .ldaImm(0x00)
      .staAbs(0xD020)
      .staAbs(0xD021)
      .rts()
      .footer();

    const module = builder.build();

    expect(module.name).toBe('hello.blend');
    expect(module.outputFile).toBe('hello.prg');
    expect(module.labels.has('_main')).toBe(true);
    expect(module.items.length).toBeGreaterThan(5);
  });

  it('should track all bytes correctly in complex program', () => {
    const builder = new AsmModuleBuilder('game.blend')
      .functionLabel('_main')
      .ldaImm(0x00) // 2 bytes
      .ldxImm(0xFF) // 2 bytes
      .staAbs(0xD020) // 3 bytes
      .globalLabel('_counter')
      .byte([0x00]) // 1 byte data
      .rts(); // 1 byte

    const stats = builder.getStats();
    expect(stats.codeBytes).toBe(8);
    expect(stats.dataBytes).toBe(1);
    expect(stats.functionCount).toBe(1);
    expect(stats.globalCount).toBe(1);
  });
});