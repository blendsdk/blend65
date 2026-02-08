/**
 * Tests for Label Generator
 *
 * Tests for unique label generation and management.
 *
 * @module __tests__/codegen/label-generator.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LabelGenerator } from '../../codegen/label-generator.js';
import type { LabelType } from '../../codegen/label-generator.js';

describe('LabelGenerator', () => {
  let labels: LabelGenerator;

  beforeEach(() => {
    labels = new LabelGenerator();
  });

  // ===========================================================================
  // Constructor and State Management
  // ===========================================================================

  describe('constructor and state', () => {
    it('should create empty generator', () => {
      expect(labels.getLabelCount()).toBe(0);
      expect(labels.getAllLabels()).toEqual([]);
    });

    it('should reset to initial state', () => {
      labels.functionLabel('main');
      labels.tempLabel();
      labels.reset();

      expect(labels.getLabelCount()).toBe(0);
      expect(labels.getCurrentFunction()).toBeNull();
    });

    it('should track current function context', () => {
      labels.setCurrentFunction('myFunc');
      expect(labels.getCurrentFunction()).toBe('myFunc');

      labels.setCurrentFunction(null);
      expect(labels.getCurrentFunction()).toBeNull();
    });
  });

  // ===========================================================================
  // Function Labels
  // ===========================================================================

  describe('function labels', () => {
    it('should generate function label with underscore prefix', () => {
      const label = labels.functionLabel('main');
      expect(label).toBe('_main');
    });

    it('should register function label', () => {
      labels.functionLabel('init');
      const entry = labels.lookupLabel('_init');

      expect(entry).toBeDefined();
      expect(entry?.type).toBe('function');
      expect(entry?.originalName).toBe('init');
    });

    it('should store address if provided', () => {
      labels.functionLabel('start', 0x0810);
      const entry = labels.lookupLabel('_start');

      expect(entry?.address).toBe(0x0810);
    });
  });

  // ===========================================================================
  // Global Variable Labels
  // ===========================================================================

  describe('global labels', () => {
    it('should generate global label with underscore prefix', () => {
      const label = labels.globalLabel('score');
      expect(label).toBe('_score');
    });

    it('should register global label', () => {
      labels.globalLabel('counter');
      const entry = labels.lookupLabel('_counter');

      expect(entry).toBeDefined();
      expect(entry?.type).toBe('global');
    });

    it('should store address for global', () => {
      labels.globalLabel('playerX', 0x02);
      const entry = labels.lookupLabel('_playerX');

      expect(entry?.address).toBe(0x02);
    });
  });

  // ===========================================================================
  // Local Labels
  // ===========================================================================

  describe('local labels', () => {
    it('should generate local label with dot prefix', () => {
      const label = labels.localLabel('loop');
      expect(label).toBe('.loop');
    });

    it('should register local label', () => {
      labels.localLabel('skip');
      const entry = labels.lookupLabel('.skip');

      expect(entry).toBeDefined();
      expect(entry?.type).toBe('local');
    });

    it('should include function context for local labels', () => {
      labels.setCurrentFunction('_main');
      labels.localLabel('done');
      const entry = labels.lookupLabel('.done');

      expect(entry?.sourceFile).toBe('_main');
    });
  });

  // ===========================================================================
  // Temporary Labels
  // ===========================================================================

  describe('temporary labels', () => {
    it('should generate temp label with counter', () => {
      const label1 = labels.tempLabel();
      const label2 = labels.tempLabel();

      expect(label1).toBe('.L_0001');
      expect(label2).toBe('.L_0002');
    });

    it('should accept custom prefix', () => {
      const label = labels.tempLabel('T');
      expect(label).toBe('.T_0001');
    });

    it('should register temp labels', () => {
      labels.tempLabel();
      const entry = labels.lookupLabel('.L_0001');

      expect(entry).toBeDefined();
      expect(entry?.type).toBe('temp');
    });

    it('should continue counter after reset', () => {
      labels.tempLabel(); // .L_0001
      labels.tempLabel(); // .L_0002
      labels.reset();

      const label = labels.tempLabel();
      expect(label).toBe('.L_0001'); // Resets
    });
  });

  // ===========================================================================
  // Block Labels
  // ===========================================================================

  describe('block labels', () => {
    it('should generate block label', () => {
      const label = labels.blockLabel('entry');
      expect(label).toBe('.block_entry');
    });

    it('should register block label', () => {
      labels.blockLabel('exit');
      const entry = labels.lookupLabel('.block_exit');

      expect(entry).toBeDefined();
      expect(entry?.type).toBe('block');
    });

    it('should generate anonymous block labels', () => {
      const label1 = labels.anonymousBlockLabel();
      const label2 = labels.anonymousBlockLabel();

      expect(label1).toBe('.block_0001');
      expect(label2).toBe('.block_0002');
    });
  });

  // ===========================================================================
  // Data Labels
  // ===========================================================================

  describe('data labels', () => {
    it('should generate data label with underscore prefix', () => {
      const label = labels.dataLabel('gameTitle');
      expect(label).toBe('_gameTitle');
    });

    it('should register data label', () => {
      labels.dataLabel('spriteData');
      const entry = labels.lookupLabel('_spriteData');

      expect(entry).toBeDefined();
      expect(entry?.type).toBe('data');
    });
  });

  // ===========================================================================
  // Label Lookup
  // ===========================================================================

  describe('label lookup', () => {
    beforeEach(() => {
      labels.functionLabel('main', 0x0810);
      labels.globalLabel('score', 0x02);
      labels.localLabel('loop');
    });

    it('should lookup by assembly label', () => {
      const entry = labels.lookupLabel('_main');
      expect(entry).toBeDefined();
      expect(entry?.originalName).toBe('main');
    });

    it('should return undefined for unknown label', () => {
      const entry = labels.lookupLabel('_unknown');
      expect(entry).toBeUndefined();
    });

    it('should lookup by original name', () => {
      const entry = labels.lookupByName('score');
      expect(entry).toBeDefined();
      expect(entry?.label).toBe('_score');
    });

    it('should lookup by name with type filter', () => {
      const funcEntry = labels.lookupByName('main', 'function');
      expect(funcEntry).toBeDefined();

      const globalEntry = labels.lookupByName('main', 'global');
      expect(globalEntry).toBeUndefined();
    });

    it('should check if label is used', () => {
      expect(labels.isUsed('_main')).toBe(true);
      expect(labels.isUsed('_unknown')).toBe(false);
    });

    it('should get all labels', () => {
      const all = labels.getAllLabels();
      expect(all).toHaveLength(3);
    });

    it('should get labels by type', () => {
      const functions = labels.getLabelsByType('function');
      expect(functions).toHaveLength(1);
      expect(functions[0].label).toBe('_main');

      const locals = labels.getLabelsByType('local');
      expect(locals).toHaveLength(1);
    });

    it('should get label count', () => {
      expect(labels.getLabelCount()).toBe(3);
    });
  });

  // ===========================================================================
  // Address Updates
  // ===========================================================================

  describe('address updates', () => {
    it('should update address of existing label', () => {
      labels.functionLabel('handler');
      const updated = labels.updateAddress('_handler', 0x1000);

      expect(updated).toBe(true);
      expect(labels.lookupLabel('_handler')?.address).toBe(0x1000);
    });

    it('should return false for unknown label', () => {
      const updated = labels.updateAddress('_unknown', 0x1000);
      expect(updated).toBe(false);
    });

    it('should update source info', () => {
      labels.functionLabel('init');
      const updated = labels.updateSourceInfo('_init', 'game.blend', 42);

      expect(updated).toBe(true);
      const entry = labels.lookupLabel('_init');
      expect(entry?.sourceFile).toBe('game.blend');
      expect(entry?.sourceLine).toBe(42);
    });
  });

  // ===========================================================================
  // Collision Detection
  // ===========================================================================

  describe('collision detection', () => {
    it('should make duplicate labels unique', () => {
      const label1 = labels.functionLabel('test');
      const label2 = labels.functionLabel('test');

      expect(label1).toBe('_test');
      expect(label2).toBe('_test_1');
    });

    it('should handle multiple collisions', () => {
      labels.functionLabel('handler');
      labels.functionLabel('handler');
      const label3 = labels.functionLabel('handler');

      expect(label3).toBe('_handler_2');
    });
  });

  // ===========================================================================
  // Name Sanitization
  // ===========================================================================

  describe('name sanitization', () => {
    it('should replace invalid characters', () => {
      const label = labels.functionLabel('my-func!');
      expect(label).toBe('_my_func_');
    });

    it('should handle names starting with number', () => {
      const label = labels.globalLabel('1stPlace');
      expect(label).toBe('__1stPlace');
    });

    it('should handle empty name', () => {
      const label = labels.functionLabel('');
      expect(label).toBe('__empty');
    });

    it('should preserve valid characters', () => {
      const label = labels.functionLabel('myFunc_v2');
      expect(label).toBe('_myFunc_v2');
    });
  });

  // ===========================================================================
  // VICE Integration
  // ===========================================================================

  describe('VICE integration', () => {
    beforeEach(() => {
      labels.functionLabel('main', 0x0810);
      labels.functionLabel('init', 0x0850);
      labels.globalLabel('score', 0x0002);
      labels.localLabel('loop'); // No address
    });

    it('should generate VICE label file', () => {
      const viceLabels = labels.generateViceLabels();

      expect(viceLabels).toContain('VICE labels');
      expect(viceLabels).toContain('al C:0002 .score');
      expect(viceLabels).toContain('al C:0810 .main');
      expect(viceLabels).toContain('al C:0850 .init');
    });

    it('should exclude labels without address', () => {
      const viceLabels = labels.generateViceLabels();
      expect(viceLabels).not.toContain('loop');
    });

    it('should sort by address', () => {
      const viceLabels = labels.generateViceLabels();
      const lines = viceLabels.split('\n').filter((l) => l.startsWith('al '));

      // First non-comment line should be lowest address (0x0002)
      expect(lines[0]).toContain('0002');
    });
  });

  // ===========================================================================
  // Label Types
  // ===========================================================================

  describe('label types', () => {
    it('should correctly categorize all label types', () => {
      labels.functionLabel('func');
      labels.globalLabel('global');
      labels.localLabel('local');
      labels.tempLabel();
      labels.blockLabel('block');
      labels.dataLabel('data');

      const types = labels.getAllLabels().map((e) => e.type);
      const expectedTypes: LabelType[] = ['function', 'global', 'local', 'temp', 'block', 'data'];

      expectedTypes.forEach((type) => {
        expect(types).toContain(type);
      });
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle very long names', () => {
      const longName = 'a'.repeat(100);
      const label = labels.functionLabel(longName);
      expect(label).toBe('_' + longName);
    });

    it('should handle unicode characters', () => {
      const label = labels.functionLabel('café');
      expect(label).toContain('caf');
    });

    it('should handle all-invalid characters', () => {
      const label = labels.functionLabel('!!!');
      expect(label).toBe('____');
    });

    it('should handle spaces', () => {
      const label = labels.functionLabel('my func');
      expect(label).toBe('_my_func');
    });
  });
});