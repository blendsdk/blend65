/**
 * Source Mapper Tests
 *
 * Tests for the source mapper that tracks the relationship between
 * generated assembly code and original Blend65 source code.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SourceMapper } from '../../codegen/source-mapper.js';
import type { SourceLocation } from '../../ast/base.js';

/**
 * Helper to create test source locations
 */
function createLocation(
  startLine: number,
  startCol: number,
  endLine?: number,
  endCol?: number
): SourceLocation {
  return {
    start: { line: startLine, column: startCol, offset: 0 },
    end: { line: endLine ?? startLine, column: endCol ?? startCol + 10, offset: 0 },
  };
}

describe('SourceMapper', () => {
  let mapper: SourceMapper;

  beforeEach(() => {
    mapper = new SourceMapper();
  });

  // ==========================================================================
  // Constructor and Reset
  // ==========================================================================

  describe('Constructor and Reset', () => {
    it('should create empty mapper', () => {
      const entries = mapper.getEntries();
      expect(entries).toHaveLength(0);
    });

    it('should accept file path option', () => {
      const mapperWithPath = new SourceMapper({ filePath: 'test.blend' });
      expect(mapperWithPath.getFilePath()).toBe('test.blend');
    });

    it('should reset all state', () => {
      mapper.setFilePath('test.blend');
      mapper.setCurrentAddress(0x1000);
      mapper.trackLocation(0x1000, createLocation(1, 1), 'test');

      mapper.reset();

      expect(mapper.getEntries()).toHaveLength(0);
      expect(mapper.getCurrentAddress()).toBe(0);
      // Note: filePath is not reset by reset() - this is intentional
    });
  });

  // ==========================================================================
  // File Path Management
  // ==========================================================================

  describe('File Path Management', () => {
    it('should get and set file path', () => {
      expect(mapper.getFilePath()).toBeNull();

      mapper.setFilePath('game.blend');
      expect(mapper.getFilePath()).toBe('game.blend');

      mapper.setFilePath('other.blend');
      expect(mapper.getFilePath()).toBe('other.blend');
    });
  });

  // ==========================================================================
  // Address Management
  // ==========================================================================

  describe('Address Management', () => {
    it('should get and set current address', () => {
      expect(mapper.getCurrentAddress()).toBe(0);

      mapper.setCurrentAddress(0x0810);
      expect(mapper.getCurrentAddress()).toBe(0x0810);

      mapper.setCurrentAddress(0x1000);
      expect(mapper.getCurrentAddress()).toBe(0x1000);
    });

    it('should advance address correctly', () => {
      mapper.setCurrentAddress(0x0810);
      mapper.advanceAddress(3);
      expect(mapper.getCurrentAddress()).toBe(0x0813);

      mapper.advanceAddress(1);
      expect(mapper.getCurrentAddress()).toBe(0x0814);
    });
  });

  // ==========================================================================
  // trackLocation
  // ==========================================================================

  describe('trackLocation', () => {
    it('should track location at specific address', () => {
      const loc = createLocation(10, 5);
      mapper.trackLocation(0x0810, loc, '_main', 'function main');

      const entries = mapper.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].address).toBe(0x0810);
      expect(entries[0].source).toEqual(loc);
      expect(entries[0].label).toBe('_main');
    });

    it('should track location at current address when null', () => {
      mapper.setCurrentAddress(0x0820);
      const loc = createLocation(15, 3);
      mapper.trackLocation(null, loc);

      const entries = mapper.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].address).toBe(0x0820);
    });

    it('should track multiple locations', () => {
      mapper.trackLocation(0x0810, createLocation(10, 1), '_main');
      mapper.trackLocation(0x0815, createLocation(11, 1));
      mapper.trackLocation(0x0818, createLocation(12, 1), '_loop');

      const entries = mapper.getEntries();
      expect(entries).toHaveLength(3);
    });

    it('should add VICE label when label is provided', () => {
      mapper.trackLocation(0x0810, createLocation(10, 1), '_main');

      const viceLabels = mapper.generateViceLabels();
      expect(viceLabels).toContain('._main');
      expect(viceLabels).toContain('C:0810');
    });
  });

  // ==========================================================================
  // trackFunction
  // ==========================================================================

  describe('trackFunction', () => {
    it('should track function entry point', () => {
      const loc = createLocation(5, 1);
      mapper.trackFunction(0x0810, loc, 'main', 'function main(): void');

      const entries = mapper.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].address).toBe(0x0810);
      expect(entries[0].label).toBe('_main');
    });

    it('should add underscore prefix to function name', () => {
      mapper.trackFunction(0x0810, createLocation(5, 1), 'doSomething');

      const entries = mapper.getEntries();
      expect(entries[0].label).toBe('_doSomething');
    });

    it('should add VICE label for function', () => {
      mapper.trackFunction(0x0810, createLocation(5, 1), 'main');

      const viceLabels = mapper.generateViceLabels();
      expect(viceLabels).toContain('._main');
    });

    it('should track multiple functions', () => {
      mapper.trackFunction(0x0810, createLocation(5, 1), 'main');
      mapper.trackFunction(0x0820, createLocation(15, 1), 'update');
      mapper.trackFunction(0x0840, createLocation(25, 1), 'render');

      const entries = mapper.getEntries();
      expect(entries).toHaveLength(3);

      const stats = mapper.getStats();
      expect(stats.functionEntries).toBe(3);
    });
  });

  // ==========================================================================
  // trackInstruction
  // ==========================================================================

  describe('trackInstruction', () => {
    it('should track instruction at current address', () => {
      mapper.setCurrentAddress(0x0810);
      mapper.trackInstruction(createLocation(10, 3), 'LDA #$05');

      const entries = mapper.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].address).toBe(0x0810);
    });

    it('should advance address when size is provided', () => {
      mapper.setCurrentAddress(0x0810);
      mapper.trackInstruction(createLocation(10, 3), 'LDA #$05', 2);

      expect(mapper.getCurrentAddress()).toBe(0x0812);
    });

    it('should not advance address when size is not provided', () => {
      mapper.setCurrentAddress(0x0810);
      mapper.trackInstruction(createLocation(10, 3), 'LDA #$05');

      expect(mapper.getCurrentAddress()).toBe(0x0810);
    });

    it('should track sequential instructions', () => {
      mapper.setCurrentAddress(0x0810);
      mapper.trackInstruction(createLocation(10, 3), 'LDA #$05', 2);
      mapper.trackInstruction(createLocation(11, 3), 'STA $D020', 3);
      mapper.trackInstruction(createLocation(12, 3), 'RTS', 1);

      const entries = mapper.getEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0].address).toBe(0x0810);
      expect(entries[1].address).toBe(0x0812);
      expect(entries[2].address).toBe(0x0815);

      expect(mapper.getCurrentAddress()).toBe(0x0816);
    });
  });

  // ==========================================================================
  // addViceLabel
  // ==========================================================================

  describe('addViceLabel', () => {
    it('should add label with dot prefix', () => {
      mapper.addViceLabel(0x0810, 'main');

      const labels = mapper.generateViceLabels();
      expect(labels).toContain('.main');
    });

    it('should not double-prefix labels that already have dot', () => {
      mapper.addViceLabel(0x0810, '.main');

      const labels = mapper.generateViceLabels();
      expect(labels).toContain('.main');
      expect(labels).not.toContain('..main');
    });

    it('should add multiple labels', () => {
      mapper.addViceLabel(0x0810, 'main');
      mapper.addViceLabel(0x0820, 'loop');
      mapper.addViceLabel(0x0830, 'end');

      const labels = mapper.generateViceLabels();
      expect(labels).toContain('.main');
      expect(labels).toContain('.loop');
      expect(labels).toContain('.end');
    });
  });

  // ==========================================================================
  // getEntries
  // ==========================================================================

  describe('getEntries', () => {
    it('should return empty array when no entries', () => {
      expect(mapper.getEntries()).toEqual([]);
    });

    it('should return all tracked entries', () => {
      mapper.trackLocation(0x0810, createLocation(1, 1));
      mapper.trackLocation(0x0815, createLocation(2, 1));
      mapper.trackLocation(0x0820, createLocation(3, 1));

      const entries = mapper.getEntries();
      expect(entries).toHaveLength(3);
    });

    it('should filter out entries with null addresses', () => {
      // This shouldn't normally happen, but test the filtering
      mapper.trackLocation(0x0810, createLocation(1, 1));
      // Internal tracking with null address isn't exposed, but entries should be filtered
      const entries = mapper.getEntries();
      expect(entries.every((e) => e.address !== null)).toBe(true);
    });
  });

  // ==========================================================================
  // getEntriesInRange
  // ==========================================================================

  describe('getEntriesInRange', () => {
    beforeEach(() => {
      mapper.trackLocation(0x0800, createLocation(1, 1));
      mapper.trackLocation(0x0810, createLocation(2, 1));
      mapper.trackLocation(0x0820, createLocation(3, 1));
      mapper.trackLocation(0x0830, createLocation(4, 1));
      mapper.trackLocation(0x0840, createLocation(5, 1));
    });

    it('should return entries in specified range', () => {
      const entries = mapper.getEntriesInRange(0x0810, 0x0830);

      expect(entries).toHaveLength(2);
      expect(entries[0].address).toBe(0x0810);
      expect(entries[1].address).toBe(0x0820);
    });

    it('should include start address (inclusive)', () => {
      const entries = mapper.getEntriesInRange(0x0810, 0x0820);

      expect(entries).toHaveLength(1);
      expect(entries[0].address).toBe(0x0810);
    });

    it('should exclude end address (exclusive)', () => {
      const entries = mapper.getEntriesInRange(0x0810, 0x0830);

      expect(entries.every((e) => e.address < 0x0830)).toBe(true);
    });

    it('should return empty array for range with no entries', () => {
      const entries = mapper.getEntriesInRange(0x0900, 0x1000);

      expect(entries).toHaveLength(0);
    });
  });

  // ==========================================================================
  // findEntryAt
  // ==========================================================================

  describe('findEntryAt', () => {
    beforeEach(() => {
      mapper.trackLocation(0x0810, createLocation(10, 1), '_main');
      mapper.trackLocation(0x0820, createLocation(20, 1), '_loop');
    });

    it('should find entry at exact address', () => {
      const entry = mapper.findEntryAt(0x0810);

      expect(entry).toBeDefined();
      expect(entry!.address).toBe(0x0810);
      expect(entry!.label).toBe('_main');
    });

    it('should return undefined for non-existent address', () => {
      const entry = mapper.findEntryAt(0x0815);

      expect(entry).toBeUndefined();
    });
  });

  // ==========================================================================
  // findNearestEntry
  // ==========================================================================

  describe('findNearestEntry', () => {
    beforeEach(() => {
      mapper.trackLocation(0x0810, createLocation(10, 1), '_main');
      mapper.trackLocation(0x0820, createLocation(20, 1), '_loop');
      mapper.trackLocation(0x0830, createLocation(30, 1), '_end');
    });

    it('should find exact match', () => {
      const entry = mapper.findNearestEntry(0x0820);

      expect(entry).toBeDefined();
      expect(entry!.address).toBe(0x0820);
    });

    it('should find nearest lower address', () => {
      const entry = mapper.findNearestEntry(0x0825);

      expect(entry).toBeDefined();
      expect(entry!.address).toBe(0x0820);
    });

    it('should return undefined for address before first entry', () => {
      const entry = mapper.findNearestEntry(0x0800);

      expect(entry).toBeUndefined();
    });

    it('should find last entry for address after all entries', () => {
      const entry = mapper.findNearestEntry(0x0900);

      expect(entry).toBeDefined();
      expect(entry!.address).toBe(0x0830);
    });
  });

  // ==========================================================================
  // formatInlineComment
  // ==========================================================================

  describe('formatInlineComment', () => {
    it('should format comment with file, line, and column', () => {
      mapper.setFilePath('game.blend');
      const loc = createLocation(42, 5);

      const comment = mapper.formatInlineComment(loc);

      expect(comment).toBe('; FILE:game.blend LINE:42 COL:5');
    });

    it('should use "unknown" when no file path set', () => {
      const loc = createLocation(10, 3);

      const comment = mapper.formatInlineComment(loc);

      expect(comment).toBe('; FILE:unknown LINE:10 COL:3');
    });

    it('should accept file path override', () => {
      mapper.setFilePath('default.blend');
      const loc = createLocation(10, 3);

      const comment = mapper.formatInlineComment(loc, 'override.blend');

      expect(comment).toBe('; FILE:override.blend LINE:10 COL:3');
    });
  });

  // ==========================================================================
  // formatInlineCommentWithDesc
  // ==========================================================================

  describe('formatInlineCommentWithDesc', () => {
    it('should format comment with description', () => {
      mapper.setFilePath('game.blend');
      const loc = createLocation(42, 5);

      const comment = mapper.formatInlineCommentWithDesc(loc, 'borderColor = 5');

      expect(comment).toBe('; FILE:game.blend LINE:42 COL:5 - borderColor = 5');
    });

    it('should handle multi-word descriptions', () => {
      mapper.setFilePath('test.blend');
      const loc = createLocation(10, 1);

      const comment = mapper.formatInlineCommentWithDesc(
        loc,
        'function main(): void - entry point'
      );

      expect(comment).toContain('function main(): void - entry point');
    });
  });

  // ==========================================================================
  // formatShortComment
  // ==========================================================================

  describe('formatShortComment', () => {
    it('should format short location comment', () => {
      const loc = createLocation(42, 5);

      const comment = mapper.formatShortComment(loc);

      expect(comment).toBe('; [42:5]');
    });

    it('should handle single-digit values', () => {
      const loc = createLocation(1, 1);

      const comment = mapper.formatShortComment(loc);

      expect(comment).toBe('; [1:1]');
    });

    it('should handle large line numbers', () => {
      const loc = createLocation(1000, 100);

      const comment = mapper.formatShortComment(loc);

      expect(comment).toBe('; [1000:100]');
    });
  });

  // ==========================================================================
  // generateViceLabels
  // ==========================================================================

  describe('generateViceLabels', () => {
    it('should generate header comments', () => {
      const labels = mapper.generateViceLabels();

      expect(labels).toContain('; VICE monitor labels');
      expect(labels).toContain('; Load with');
    });

    it('should format labels in VICE format', () => {
      mapper.addViceLabel(0x0810, 'main');

      const labels = mapper.generateViceLabels();

      expect(labels).toContain('al C:0810 .main');
    });

    it('should pad addresses to 4 digits', () => {
      mapper.addViceLabel(0x0010, 'zp_var');
      mapper.addViceLabel(0x0100, 'stack');
      mapper.addViceLabel(0xffff, 'high');

      const labels = mapper.generateViceLabels();

      expect(labels).toContain('C:0010');
      expect(labels).toContain('C:0100');
      expect(labels).toContain('C:FFFF');
    });

    it('should sort labels by address', () => {
      mapper.addViceLabel(0x0830, 'third');
      mapper.addViceLabel(0x0810, 'first');
      mapper.addViceLabel(0x0820, 'second');

      const labels = mapper.generateViceLabels();
      const lines = labels.split('\n').filter((l) => l.startsWith('al'));

      expect(lines[0]).toContain('0810');
      expect(lines[1]).toContain('0820');
      expect(lines[2]).toContain('0830');
    });

    it('should use uppercase hex addresses', () => {
      mapper.addViceLabel(0xabcd, 'test');

      const labels = mapper.generateViceLabels();

      expect(labels).toContain('C:ABCD');
    });
  });

  // ==========================================================================
  // importLabels
  // ==========================================================================

  describe('importLabels', () => {
    it('should import labels with addresses', () => {
      const labelEntries = [
        { name: '_main', type: 'function', metadata: { address: 0x0810 } },
        { name: '_loop', type: 'local', metadata: { address: 0x0820 } },
      ];

      mapper.importLabels(labelEntries);

      const viceLabels = mapper.generateViceLabels();
      expect(viceLabels).toContain('._main');
      expect(viceLabels).toContain('._loop');
    });

    it('should skip labels without addresses', () => {
      const labelEntries = [
        { name: '_main', type: 'function', metadata: { address: 0x0810 } },
        { name: '_temp', type: 'temp' }, // No metadata
        { name: '_other', type: 'local', metadata: {} }, // No address in metadata
      ];

      mapper.importLabels(labelEntries);

      const stats = mapper.getStats();
      expect(stats.viceLabels).toBe(1);
    });
  });

  // ==========================================================================
  // generateJsonSourceMap
  // ==========================================================================

  describe('generateJsonSourceMap', () => {
    it('should generate valid JSON', () => {
      mapper.trackLocation(0x0810, createLocation(10, 1), '_main');

      const json = mapper.generateJsonSourceMap();

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should include version number', () => {
      const json = mapper.generateJsonSourceMap();
      const map = JSON.parse(json);

      expect(map.version).toBe(1);
    });

    it('should include file information', () => {
      mapper.setFilePath('game.blend');
      mapper.trackLocation(0x0810, createLocation(10, 1));

      const json = mapper.generateJsonSourceMap();
      const map = JSON.parse(json);

      expect(map.file).toBe('game.blend');
      expect(map.sources).toContain('game.blend');
    });

    it('should include mappings', () => {
      mapper.trackLocation(0x0810, createLocation(10, 5), '_main');
      mapper.trackLocation(0x0815, createLocation(11, 3));

      const json = mapper.generateJsonSourceMap();
      const map = JSON.parse(json);

      expect(map.mappings).toHaveLength(2);
      expect(map.mappings[0].generated.address).toBe(0x0810);
      expect(map.mappings[0].original.line).toBe(10);
      expect(map.mappings[0].original.column).toBe(5);
      expect(map.mappings[0].name).toBe('_main');
    });
  });

  // ==========================================================================
  // getStats
  // ==========================================================================

  describe('getStats', () => {
    it('should return zero stats for empty mapper', () => {
      const stats = mapper.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.entriesWithLabels).toBe(0);
      expect(stats.entriesWithDescriptions).toBe(0);
      expect(stats.functionEntries).toBe(0);
      expect(stats.viceLabels).toBe(0);
      expect(stats.addressRange).toBeNull();
    });

    it('should count entries correctly', () => {
      mapper.trackLocation(0x0810, createLocation(10, 1), '_main', 'main function');
      mapper.trackLocation(0x0815, createLocation(11, 1));
      mapper.trackLocation(0x0820, createLocation(12, 1), '_loop');

      const stats = mapper.getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.entriesWithLabels).toBe(2);
      expect(stats.entriesWithDescriptions).toBe(1);
    });

    it('should count function entries', () => {
      mapper.trackFunction(0x0810, createLocation(5, 1), 'main');
      mapper.trackFunction(0x0820, createLocation(15, 1), 'update');
      mapper.trackLocation(0x0830, createLocation(25, 1), '_data');

      const stats = mapper.getStats();

      expect(stats.functionEntries).toBe(2);
    });

    it('should calculate address range', () => {
      mapper.trackLocation(0x0820, createLocation(1, 1));
      mapper.trackLocation(0x0810, createLocation(2, 1));
      mapper.trackLocation(0x0840, createLocation(3, 1));

      const stats = mapper.getStats();

      expect(stats.addressRange).toEqual({
        min: 0x0810,
        max: 0x0840,
      });
    });

    it('should count VICE labels', () => {
      mapper.addViceLabel(0x0810, 'main');
      mapper.addViceLabel(0x0820, 'loop');
      mapper.addViceLabel(0x0830, 'end');

      const stats = mapper.getStats();

      expect(stats.viceLabels).toBe(3);
    });
  });

  // ==========================================================================
  // Static Methods
  // ==========================================================================

  describe('Static Methods', () => {
    describe('needsInlineComments', () => {
      it('should return true for inline mode', () => {
        expect(SourceMapper.needsInlineComments('inline')).toBe(true);
      });

      it('should return true for both mode', () => {
        expect(SourceMapper.needsInlineComments('both')).toBe(true);
      });

      it('should return false for vice mode', () => {
        expect(SourceMapper.needsInlineComments('vice')).toBe(false);
      });

      it('should return false for none mode', () => {
        expect(SourceMapper.needsInlineComments('none')).toBe(false);
      });
    });

    describe('needsViceLabels', () => {
      it('should return true for vice mode', () => {
        expect(SourceMapper.needsViceLabels('vice')).toBe(true);
      });

      it('should return true for both mode', () => {
        expect(SourceMapper.needsViceLabels('both')).toBe(true);
      });

      it('should return false for inline mode', () => {
        expect(SourceMapper.needsViceLabels('inline')).toBe(false);
      });

      it('should return false for none mode', () => {
        expect(SourceMapper.needsViceLabels('none')).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('should track complete function generation', () => {
      mapper.setFilePath('game.blend');
      mapper.setCurrentAddress(0x0810);

      // Track function entry
      mapper.trackFunction(0x0810, createLocation(5, 1, 5, 30), 'main', 'function main(): void');

      // Track instructions
      mapper.trackInstruction(createLocation(6, 3), 'LDA #$05', 2);
      mapper.trackInstruction(createLocation(7, 3), 'STA $D020', 3);
      mapper.trackInstruction(createLocation(8, 3), 'RTS', 1);

      // Verify entries
      const entries = mapper.getEntries();
      expect(entries).toHaveLength(4);

      // Verify VICE labels
      const viceLabels = mapper.generateViceLabels();
      expect(viceLabels).toContain('._main');
      expect(viceLabels).toContain('C:0810');

      // Verify stats
      const stats = mapper.getStats();
      expect(stats.totalEntries).toBe(4);
      expect(stats.functionEntries).toBe(1);
      expect(stats.addressRange).toEqual({ min: 0x0810, max: 0x0815 });
    });

    it('should generate complete debug output', () => {
      mapper.setFilePath('test.blend');

      // Track some code
      mapper.trackFunction(0x0810, createLocation(1, 1), 'main');
      mapper.setCurrentAddress(0x0810);
      mapper.trackInstruction(createLocation(2, 3), 'LDA #$00', 2);

      // Generate inline comment
      const comment = mapper.formatInlineComment(createLocation(2, 3));
      expect(comment).toBe('; FILE:test.blend LINE:2 COL:3');

      // Generate VICE labels
      const labels = mapper.generateViceLabels();
      expect(labels).toContain('al C:0810 ._main');

      // Generate JSON source map
      const json = mapper.generateJsonSourceMap();
      const map = JSON.parse(json);
      expect(map.mappings.length).toBeGreaterThan(0);
    });
  });
});