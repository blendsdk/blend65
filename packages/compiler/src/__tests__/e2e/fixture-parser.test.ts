/**
 * @file Fixture Parser Tests
 * @description Unit tests for the fixture metadata parser.
 */

import { describe, it, expect } from 'vitest';
import {
  parseFixtureMetadata,
  inferCategoryFromPath,
  isFixtureFile,
  extractFixtureId,
} from './fixture-parser.js';
import {
  ExpectedOutcome,
  FixtureCategory,
  OutputCheckType,
} from './fixture-types.js';

describe('Fixture Parser', () => {
  describe('parseFixtureMetadata', () => {
    describe('required fields', () => {
      it('should parse all required fields', () => {
        const source = `
// @fixture: integration/test-basic
// @category: integration
// @description: Tests basic integration functionality
// @expect: success

module TestBasic;
`;

        const result = parseFixtureMetadata(source);

        expect(result.success).toBe(true);
        expect(result.metadata).toBeDefined();
        expect(result.metadata!.fixture).toBe('integration/test-basic');
        expect(result.metadata!.category).toBe(FixtureCategory.Integration);
        expect(result.metadata!.description).toBe('Tests basic integration functionality');
        expect(result.metadata!.expect).toBe(ExpectedOutcome.Success);
      });

      it('should fail when @fixture is missing', () => {
        const source = `
// @category: integration
// @description: Tests something
// @expect: success

module Test;
`;

        const result = parseFixtureMetadata(source);

        expect(result.success).toBe(false);
        expect(result.errors).toContain("Missing required field: '@fixture'");
      });

      it('should fail when @description is missing', () => {
        const source = `
// @fixture: test/fixture
// @category: integration
// @expect: success

module Test;
`;

        const result = parseFixtureMetadata(source);

        expect(result.success).toBe(false);
        expect(result.errors).toContain("Missing required field: '@description'");
      });

      it('should fail when @expect is missing', () => {
        const source = `
// @fixture: test/fixture
// @category: integration
// @description: Test description

module Test;
`;

        const result = parseFixtureMetadata(source);

        expect(result.success).toBe(false);
        expect(result.errors).toContain("Missing required field: '@expect'");
      });

      it('should fail when @category is missing and no file path provided', () => {
        const source = `
// @fixture: test/fixture
// @description: Test description
// @expect: success

module Test;
`;

        const result = parseFixtureMetadata(source);

        expect(result.success).toBe(false);
        expect(result.errors).toContain("Missing required field: '@category'");
      });
    });

    describe('category validation', () => {
      it('should accept all valid categories', () => {
        const categories = [
          'lexer',
          'parser',
          'semantic',
          'il-generator',
          'optimizer',
          'codegen',
          'integration',
          'edge-cases',
          'error-cases',
          'regressions',
        ];

        for (const category of categories) {
          const source = `
// @fixture: test/${category}
// @category: ${category}
// @description: Test ${category}
// @expect: success

module Test;
`;
          const result = parseFixtureMetadata(source);
          expect(result.success).toBe(true);
          expect(result.metadata!.category).toBe(category);
        }
      });

      it('should reject invalid category', () => {
        const source = `
// @fixture: test/invalid
// @category: invalid-category
// @description: Test invalid category
// @expect: success

module Test;
`;

        const result = parseFixtureMetadata(source);

        expect(result.success).toBe(false);
        expect(result.errors![0]).toContain("Invalid category: 'invalid-category'");
      });

      it('should infer category from file path', () => {
        const source = `
// @fixture: parser/expressions/binary-add
// @description: Test binary addition
// @expect: success

module Test;
`;

        const result = parseFixtureMetadata(source, '02-parser/expressions/binary-add.blend');

        expect(result.success).toBe(true);
        expect(result.metadata!.category).toBe(FixtureCategory.Parser);
        expect(result.warnings).toContain("Inferred category 'parser' from file path");
      });
    });

    describe('expect validation', () => {
      it('should accept success expect', () => {
        const source = `
// @fixture: test/success
// @category: integration
// @description: Test success
// @expect: success

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.expect).toBe(ExpectedOutcome.Success);
      });

      it('should accept error expect', () => {
        const source = `
// @fixture: test/error
// @category: error-cases
// @description: Test error
// @expect: error
// @error-code: E001

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.expect).toBe(ExpectedOutcome.Error);
      });

      it('should accept warning expect', () => {
        const source = `
// @fixture: test/warning
// @category: semantic
// @description: Test warning
// @expect: warning

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.expect).toBe(ExpectedOutcome.Warning);
      });

      it('should reject invalid expect', () => {
        const source = `
// @fixture: test/invalid
// @category: integration
// @description: Test invalid
// @expect: invalid

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(false);
        expect(result.errors![0]).toContain("Invalid expect value: 'invalid'");
      });

      it('should warn when error expect has no error-code', () => {
        const source = `
// @fixture: test/error-no-code
// @category: error-cases
// @description: Test error without code
// @expect: error

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.warnings).toContain("Fixture expects error but no '@error-code' specified");
      });
    });

    describe('optional fields', () => {
      it('should parse error-code', () => {
        const source = `
// @fixture: test/error
// @category: error-cases
// @description: Test error
// @expect: error
// @error-code: PARSE_ERROR_001

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.errorCode).toBe('PARSE_ERROR_001');
      });

      it('should parse error-message', () => {
        const source = `
// @fixture: test/error
// @category: error-cases
// @description: Test error
// @expect: error
// @error-code: E001
// @error-message: Unexpected token

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.errorMessage).toBe('Unexpected token');
      });

      it('should parse skip reason', () => {
        const source = `
// @fixture: test/skipped
// @category: integration
// @description: Skipped test
// @expect: success
// @skip: Not implemented yet

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.skip).toBe('Not implemented yet');
      });

      it('should parse tags', () => {
        const source = `
// @fixture: test/tagged
// @category: integration
// @description: Tagged test
// @expect: success
// @tags: slow, hardware, sprite

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.tags).toEqual(['slow', 'hardware', 'sprite']);
      });

      it('should parse dependencies', () => {
        const source = `
// @fixture: test/dependent
// @category: integration
// @description: Test with dependencies
// @expect: success
// @dependencies: lib/utils.blend, lib/math.blend

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.dependencies).toEqual(['lib/utils.blend', 'lib/math.blend']);
      });

      it('should parse min-opt-level', () => {
        const source = `
// @fixture: test/optimized
// @category: optimizer
// @description: Test optimization
// @expect: success
// @min-opt-level: 2

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.minOptLevel).toBe(2);
      });

      it('should parse max-opt-level', () => {
        const source = `
// @fixture: test/no-opt
// @category: codegen
// @description: Test without optimization
// @expect: success
// @max-opt-level: 0

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.maxOptLevel).toBe(0);
      });

      it('should reject invalid min-opt-level', () => {
        const source = `
// @fixture: test/invalid
// @category: optimizer
// @description: Invalid opt level
// @expect: success
// @min-opt-level: abc

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(false);
        expect(result.errors![0]).toContain("Invalid min-opt-level value: 'abc'");
      });
    });

    describe('output checks', () => {
      it('should parse output-check with Contains', () => {
        const source = `
// @fixture: test/output
// @category: codegen
// @description: Test output check
// @expect: success
// @output-check: Contains "STA $D020"

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.outputChecks).toHaveLength(1);
        expect(result.metadata!.outputChecks![0].type).toBe(OutputCheckType.Contains);
        expect(result.metadata!.outputChecks![0].pattern).toBe('STA $D020');
      });

      it('should parse output-contains shorthand', () => {
        const source = `
// @fixture: test/output
// @category: codegen
// @description: Test output check
// @expect: success
// @output-contains: LDA #$00

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.outputChecks).toHaveLength(1);
        expect(result.metadata!.outputChecks![0].type).toBe(OutputCheckType.Contains);
        expect(result.metadata!.outputChecks![0].pattern).toBe('LDA #$00');
      });

      it('should parse output-not-contains', () => {
        const source = `
// @fixture: test/output
// @category: optimizer
// @description: Test dead code elimination
// @expect: success
// @output-not-contains: unreachable_label

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.outputChecks).toHaveLength(1);
        expect(result.metadata!.outputChecks![0].type).toBe(OutputCheckType.NotContains);
        expect(result.metadata!.outputChecks![0].pattern).toBe('unreachable_label');
      });

      it('should parse output-matches', () => {
        const source = `
// @fixture: test/output
// @category: codegen
// @description: Test regex match
// @expect: success
// @output-matches: LDA\\s+#\\$[0-9A-F]{2}

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.outputChecks).toHaveLength(1);
        expect(result.metadata!.outputChecks![0].type).toBe(OutputCheckType.Matches);
      });

      it('should parse multiple output checks', () => {
        const source = `
// @fixture: test/multi-output
// @category: codegen
// @description: Multiple checks
// @expect: success
// @output-contains: LDA #$00
// @output-not-contains: dead_code
// @output-matches: STA\\s+\\$D0[0-9]{2}

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.outputChecks).toHaveLength(3);
      });

      it('should reject invalid output-check format', () => {
        const source = `
// @fixture: test/invalid
// @category: codegen
// @description: Invalid format
// @expect: success
// @output-check: invalid format

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(false);
        expect(result.errors![0]).toContain("Invalid output-check format");
      });
    });

    describe('multi-line values', () => {
      it('should parse multi-line description', () => {
        const source = `
// @fixture: test/multiline
// @category: integration
// @description: This is a long description
//               that spans multiple lines
//               and contains important details
// @expect: success

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.description).toContain('long description');
        expect(result.metadata!.description).toContain('multiple lines');
        expect(result.metadata!.description).toContain('important details');
      });
    });

    describe('edge cases', () => {
      it('should handle empty source', () => {
        const result = parseFixtureMetadata('');
        expect(result.success).toBe(false);
        expect(result.errors).toContain("Missing required field: '@fixture'");
      });

      it('should handle source without metadata', () => {
        const source = `
module Test;

let x: byte = 0;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(false);
        expect(result.errors).toContain("Missing required field: '@fixture'");
      });

      it('should handle extra whitespace in field values', () => {
        const source = `
// @fixture:   test/whitespace   
// @category:  integration  
// @description:  Test with whitespace  
// @expect:  success  

module Test;
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.fixture).toBe('test/whitespace');
        expect(result.metadata!.description).toBe('Test with whitespace');
      });

      it('should stop parsing at non-comment code', () => {
        const source = `
// @fixture: test/stop
// @category: integration
// @description: Test stop
// @expect: success
module Test;
// @skip: This should NOT be parsed
`;

        const result = parseFixtureMetadata(source);
        expect(result.success).toBe(true);
        expect(result.metadata!.skip).toBeUndefined();
      });
    });
  });

  describe('inferCategoryFromPath', () => {
    it('should infer lexer category', () => {
      expect(inferCategoryFromPath('01-lexer/numbers/decimal.blend')).toBe(FixtureCategory.Lexer);
      expect(inferCategoryFromPath('/fixtures/01-lexer/test.blend')).toBe(FixtureCategory.Lexer);
    });

    it('should infer parser category', () => {
      expect(inferCategoryFromPath('02-parser/expressions/binary.blend')).toBe(FixtureCategory.Parser);
    });

    it('should infer semantic category', () => {
      expect(inferCategoryFromPath('03-semantic/types/byte.blend')).toBe(FixtureCategory.Semantic);
    });

    it('should infer il-generator category', () => {
      expect(inferCategoryFromPath('04-il-generator/blocks/basic.blend')).toBe(FixtureCategory.ILGenerator);
    });

    it('should infer optimizer category', () => {
      expect(inferCategoryFromPath('05-optimizer/dead-code/simple.blend')).toBe(FixtureCategory.Optimizer);
    });

    it('should infer codegen category', () => {
      expect(inferCategoryFromPath('06-codegen/addressing/direct.blend')).toBe(FixtureCategory.Codegen);
    });

    it('should infer integration category', () => {
      expect(inferCategoryFromPath('10-integration/real-programs/sprite.blend')).toBe(FixtureCategory.Integration);
    });

    it('should infer edge-cases category', () => {
      expect(inferCategoryFromPath('20-edge-cases/boundary/max.blend')).toBe(FixtureCategory.EdgeCases);
    });

    it('should infer error-cases category', () => {
      expect(inferCategoryFromPath('30-error-cases/parser/syntax.blend')).toBe(FixtureCategory.ErrorCases);
    });

    it('should infer regressions category', () => {
      expect(inferCategoryFromPath('99-regressions/issue-001.blend')).toBe(FixtureCategory.Regressions);
    });

    it('should return undefined for unknown path', () => {
      expect(inferCategoryFromPath('unknown/test.blend')).toBeUndefined();
      expect(inferCategoryFromPath('')).toBeUndefined();
    });

    it('should handle Windows-style paths', () => {
      expect(inferCategoryFromPath('fixtures\\02-parser\\test.blend')).toBe(FixtureCategory.Parser);
    });
  });

  describe('isFixtureFile', () => {
    it('should return true for valid fixture', () => {
      const source = `
// @fixture: test/valid
// @category: integration
// @description: Valid fixture
// @expect: success

module Test;
`;

      expect(isFixtureFile(source)).toBe(true);
    });

    it('should return false for non-fixture', () => {
      const source = `
// Regular comment
module Test;

let x: byte = 0;
`;

      expect(isFixtureFile(source)).toBe(false);
    });

    it('should return false for empty source', () => {
      expect(isFixtureFile('')).toBe(false);
    });
  });

  describe('extractFixtureId', () => {
    it('should extract fixture id', () => {
      const source = `
// @fixture: integration/real-programs/sprite-movement
// @category: integration
// @description: Test
// @expect: success

module Test;
`;

      expect(extractFixtureId(source)).toBe('integration/real-programs/sprite-movement');
    });

    it('should return undefined for non-fixture', () => {
      const source = `
// Regular comment
module Test;
`;

      expect(extractFixtureId(source)).toBeUndefined();
    });

    it('should handle whitespace', () => {
      const source = `// @fixture:   test/whitespace   `;
      expect(extractFixtureId(source)).toBe('test/whitespace');
    });
  });
});