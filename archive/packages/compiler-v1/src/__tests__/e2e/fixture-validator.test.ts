/**
 * @file Fixture Validator Tests
 * @description Unit tests for the fixture validation utilities and sample fixtures.
 */

import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  validateFixtureFile,
  validateAllFixtures,
  discoverBlendFiles,
  loadFixture,
  loadAllFixtures,
  generateValidationReport,
} from './fixture-validator.js';
import { FixtureCategory } from './fixture-types.js';

// Get the fixtures directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, '../../..', 'fixtures');

describe('Fixture Validator', () => {
  describe('discoverBlendFiles', () => {
    it('should discover .blend files in fixtures directory', () => {
      const files = discoverBlendFiles(FIXTURES_DIR);

      expect(files.length).toBeGreaterThan(0);
      expect(files.every((f) => f.endsWith('.blend'))).toBe(true);
    });

    it('should return empty array for non-existent directory', () => {
      const files = discoverBlendFiles('/non/existent/path');
      expect(files).toEqual([]);
    });
  });

  describe('validateFixtureFile', () => {
    it('should validate decimal-literals fixture', () => {
      const fixturePath = join(
        FIXTURES_DIR,
        '01-lexer/numbers/decimal-literals.blend',
      );
      const result = validateFixtureFile(fixturePath, FIXTURES_DIR);

      expect(result.valid).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.fixture).toBe('lexer/numbers/decimal-literals');
      expect(result.metadata!.category).toBe(FixtureCategory.Lexer);
      expect(result.metadata!.expect).toBe('success');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate arithmetic-operations fixture', () => {
      const fixturePath = join(
        FIXTURES_DIR,
        '02-parser/expressions/binary/arithmetic-operations.blend',
      );
      const result = validateFixtureFile(fixturePath, FIXTURES_DIR);

      expect(result.valid).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.fixture).toBe('parser/expressions/binary/arithmetic-operations');
      expect(result.metadata!.category).toBe(FixtureCategory.Parser);
      expect(result.metadata!.outputChecks).toBeDefined();
      expect(result.metadata!.outputChecks!.length).toBeGreaterThan(0);
    });

    it('should validate byte-word-types fixture', () => {
      const fixturePath = join(
        FIXTURES_DIR,
        '03-semantic/type-checking/byte-word-types.blend',
      );
      const result = validateFixtureFile(fixturePath, FIXTURES_DIR);

      expect(result.valid).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.category).toBe(FixtureCategory.Semantic);
    });

    it('should validate border-color integration fixture', () => {
      const fixturePath = join(
        FIXTURES_DIR,
        '10-integration/real-programs/border-color.blend',
      );
      const result = validateFixtureFile(fixturePath, FIXTURES_DIR);

      expect(result.valid).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.category).toBe(FixtureCategory.Integration);
      expect(result.metadata!.tags).toContain('hardware');
      expect(result.metadata!.tags).toContain('vic-ii');
    });

    it('should validate missing-semicolon error fixture', () => {
      const fixturePath = join(
        FIXTURES_DIR,
        '30-error-cases/parser-errors/missing-semicolon.blend',
      );
      const result = validateFixtureFile(fixturePath, FIXTURES_DIR);

      expect(result.valid).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.category).toBe(FixtureCategory.ErrorCases);
      expect(result.metadata!.expect).toBe('error');
      expect(result.metadata!.errorCode).toBe('P002');
    });

    it('should validate dominator-warning regression fixture', () => {
      const fixturePath = join(
        FIXTURES_DIR,
        '99-regressions/issue-001-dominator-warning.blend',
      );
      const result = validateFixtureFile(fixturePath, FIXTURES_DIR);

      expect(result.valid).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.category).toBe(FixtureCategory.Regressions);
      expect(result.metadata!.tags).toContain('regression');
    });

    it('should return error for non-existent file', () => {
      const result = validateFixtureFile(
        '/non/existent/file.blend',
        FIXTURES_DIR,
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateAllFixtures', () => {
    it('should validate all fixtures in the fixtures directory', () => {
      const summary = validateAllFixtures(FIXTURES_DIR);

      // We have 6 sample fixtures
      expect(summary.validFixtures).toBeGreaterThanOrEqual(6);
      expect(summary.invalidFixtures).toBe(0);

      // Log for debugging if there are errors
      if (summary.invalidFixtures > 0) {
        console.log('Invalid fixtures:');
        for (const [file, errors] of summary.errors) {
          console.log(`  ${file}: ${errors.join(', ')}`);
        }
      }
    });

    it('should return accurate counts', () => {
      const summary = validateAllFixtures(FIXTURES_DIR);

      expect(summary.totalFiles).toBe(
        summary.validFixtures + summary.invalidFixtures + summary.skippedFiles,
      );
    });
  });

  describe('loadFixture', () => {
    it('should load a valid fixture', () => {
      const fixturePath = join(
        FIXTURES_DIR,
        '01-lexer/numbers/decimal-literals.blend',
      );
      const fixture = loadFixture(fixturePath, FIXTURES_DIR);

      expect(fixture).not.toBeNull();
      expect(fixture!.source).toContain('module DecimalLiterals');
      expect(fixture!.metadata.fixture).toBe('lexer/numbers/decimal-literals');
    });

    it('should return null for non-fixture file', () => {
      const fixture = loadFixture('/non/existent/file.blend', FIXTURES_DIR);
      expect(fixture).toBeNull();
    });
  });

  describe('loadAllFixtures', () => {
    it('should load all valid fixtures', () => {
      const fixtures = loadAllFixtures(FIXTURES_DIR);

      expect(fixtures.length).toBeGreaterThanOrEqual(6);
      expect(fixtures.every((f) => f.metadata !== undefined)).toBe(true);
    });

    it('should filter by category', () => {
      const fixtures = loadAllFixtures(FIXTURES_DIR, FixtureCategory.Lexer);

      expect(fixtures.length).toBeGreaterThan(0);
      expect(fixtures.every((f) => f.metadata.category === FixtureCategory.Lexer)).toBe(true);
    });
  });

  describe('generateValidationReport', () => {
    it('should generate a report', () => {
      const summary = validateAllFixtures(FIXTURES_DIR);
      const report = generateValidationReport(summary);

      expect(report).toContain('Fixture Validation Report');
      expect(report).toContain('Valid fixtures:');
      expect(report).toContain(`${summary.validFixtures}`);
    });
  });
});

describe('Sample Fixtures Content Validation', () => {
  it('should have correct metadata in all sample fixtures', () => {
    const fixtures = loadAllFixtures(FIXTURES_DIR);

    for (const fixture of fixtures) {
      // Every fixture must have required fields
      expect(fixture.metadata.fixture).toBeTruthy();
      expect(fixture.metadata.category).toBeTruthy();
      expect(fixture.metadata.description).toBeTruthy();
      expect(fixture.metadata.expect).toBeTruthy();

      // Fixture ID should contain category path
      expect(fixture.metadata.fixture).toContain('/');

      // Source should start with metadata comments
      expect(fixture.source.trim()).toMatch(/^\/\/ @fixture:/);
    }
  });

  it('should have valid module declarations', () => {
    const fixtures = loadAllFixtures(FIXTURES_DIR);

    for (const fixture of fixtures) {
      // Error fixtures testing parser errors may have intentionally broken module declarations
      // Only check module declaration for success fixtures
      if (fixture.metadata.expect === 'success') {
        // Every success fixture should have a valid module declaration
        // Supports both simple (ModuleName) and hierarchical (Utils.Colors) module names
        expect(fixture.source).toMatch(/module\s+[\w.]+;/);
      }
    }
  });
});