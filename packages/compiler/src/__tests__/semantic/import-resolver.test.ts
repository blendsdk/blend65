/**
 * Import Resolver Tests
 *
 * Comprehensive test suite for ImportResolver class.
 * Validates import resolution, missing module detection, and integration.
 *
 * **Test Coverage:**
 * - Module existence validation
 * - Missing module detection with precise error locations
 * - Multiple imports handling
 * - Resolved import generation
 * - Integration with ModuleRegistry
 * - Edge cases and error conditions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ImportResolver } from '../../semantic/import-resolver.js';
import { ModuleRegistry } from '../../semantic/module-registry.js';
import {
  Program,
  ModuleDecl,
  ImportDecl,
  VariableDecl,
  LiteralExpression,
} from '../../ast/nodes.js';
import { DiagnosticCode, DiagnosticSeverity } from '../../ast/diagnostics.js';
import type { SourceLocation } from '../../ast/base.js';

/**
 * Helper: Create a test source location
 */
function createLocation(line = 1, column = 1): SourceLocation {
  return {
    start: { line, column, offset: 0 },
    end: { line, column: column + 10, offset: 10 },
    source: 'test.bl65',
  };
}

/**
 * Helper: Create a minimal Program with imports
 */
function createProgramWithImports(
  moduleName: string,
  imports: Array<{ identifiers: string[]; modulePath: string[] }>
): Program {
  const loc = createLocation();

  const moduleDecl = new ModuleDecl([moduleName], loc);

  const importDecls = imports.map(
    imp => new ImportDecl(imp.identifiers, imp.modulePath, loc, false)
  );

  return new Program(moduleDecl, importDecls, loc);
}

/**
 * Helper: Create a Program without imports
 */
function createProgramWithoutImports(moduleName: string): Program {
  const loc = createLocation();
  const moduleDecl = new ModuleDecl([moduleName], loc);

  // Add a dummy variable declaration (no imports)
  const varDecl = new VariableDecl(
    'dummy',
    'byte',
    new LiteralExpression(0, loc),
    loc,
    null,
    false,
    false
  );

  return new Program(moduleDecl, [varDecl], loc);
}

describe('ImportResolver', () => {
  let registry: ModuleRegistry;
  let resolver: ImportResolver;

  beforeEach(() => {
    registry = new ModuleRegistry();
    resolver = new ImportResolver(registry);
  });

  // ============================================
  // BASIC VALIDATION - SUCCESSFUL CASES
  // ============================================

  describe('Successful Import Validation', () => {
    it('should validate imports when all modules exist', () => {
      // Register modules
      const mainProgram = createProgramWithImports('Main', [
        { identifiers: ['foo'], modulePath: ['Utils'] },
      ]);

      const utilsProgram = createProgramWithoutImports('Utils');

      registry.register('Main', mainProgram);
      registry.register('Utils', utilsProgram);

      // Validate imports
      const errors = resolver.validateAllImports([mainProgram, utilsProgram]);

      expect(errors).toHaveLength(0);
    });

    it('should handle multiple imports from same module', () => {
      // Main imports from Utils twice (different identifiers)
      const mainProgram = createProgramWithImports('Main', [
        { identifiers: ['foo'], modulePath: ['Utils'] },
        { identifiers: ['bar'], modulePath: ['Utils'] },
      ]);

      const utilsProgram = createProgramWithoutImports('Utils');

      registry.register('Main', mainProgram);
      registry.register('Utils', utilsProgram);

      const errors = resolver.validateAllImports([mainProgram, utilsProgram]);

      expect(errors).toHaveLength(0);
    });

    it('should handle modules with no imports', () => {
      const mainProgram = createProgramWithoutImports('Main');

      registry.register('Main', mainProgram);

      const errors = resolver.validateAllImports([mainProgram]);

      expect(errors).toHaveLength(0);
    });

    it('should handle complex dependency chains', () => {
      // A → B, B → C, C has no imports
      const programA = createProgramWithImports('A', [{ identifiers: ['x'], modulePath: ['B'] }]);
      const programB = createProgramWithImports('B', [{ identifiers: ['y'], modulePath: ['C'] }]);
      const programC = createProgramWithoutImports('C');

      registry.register('A', programA);
      registry.register('B', programB);
      registry.register('C', programC);

      const errors = resolver.validateAllImports([programA, programB, programC]);

      expect(errors).toHaveLength(0);
    });

    it('should handle deeply nested module names', () => {
      const mainProgram = createProgramWithImports('Main', [
        { identifiers: ['screen'], modulePath: ['c64', 'graphics', 'screen'] },
      ]);

      const screenProgram = createProgramWithoutImports('c64.graphics.screen');

      registry.register('Main', mainProgram);
      registry.register('c64.graphics.screen', screenProgram);

      const errors = resolver.validateAllImports([mainProgram, screenProgram]);

      expect(errors).toHaveLength(0);
    });
  });

  // ============================================
  // MISSING MODULE DETECTION
  // ============================================

  describe('Missing Module Detection', () => {
    it('should detect missing imported module', () => {
      // Main imports from Utils, but Utils doesn't exist
      const mainProgram = createProgramWithImports('Main', [
        { identifiers: ['foo'], modulePath: ['Utils'] },
      ]);

      registry.register('Main', mainProgram);

      const errors = resolver.validateAllImports([mainProgram]);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(DiagnosticCode.MODULE_NOT_FOUND);
      expect(errors[0].severity).toBe(DiagnosticSeverity.ERROR);
      expect(errors[0].message).toContain('Utils');
      expect(errors[0].message).toContain('not found');
      expect(errors[0].message).toContain('Main');
    });

    it('should detect multiple missing modules', () => {
      // Main imports from Utils and Graphics, neither exist
      const mainProgram = createProgramWithImports('Main', [
        { identifiers: ['foo'], modulePath: ['Utils'] },
        { identifiers: ['bar'], modulePath: ['Graphics'] },
      ]);

      registry.register('Main', mainProgram);

      const errors = resolver.validateAllImports([mainProgram]);

      expect(errors).toHaveLength(2);
      expect(errors[0].code).toBe(DiagnosticCode.MODULE_NOT_FOUND);
      expect(errors[1].code).toBe(DiagnosticCode.MODULE_NOT_FOUND);

      const messages = errors.map(e => e.message);
      expect(messages.some(m => m.includes('Utils'))).toBe(true);
      expect(messages.some(m => m.includes('Graphics'))).toBe(true);
    });

    it('should detect missing deeply nested module', () => {
      const mainProgram = createProgramWithImports('Main', [
        { identifiers: ['screen'], modulePath: ['c64', 'graphics', 'screen'] },
      ]);

      registry.register('Main', mainProgram);

      const errors = resolver.validateAllImports([mainProgram]);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('c64.graphics.screen');
    });

    it('should provide accurate error locations', () => {
      const loc = createLocation(5, 10); // Line 5, column 10

      const moduleDecl = new ModuleDecl(['Main'], loc);
      const importDecl = new ImportDecl(['foo'], ['MissingModule'], loc, false);
      const mainProgram = new Program(moduleDecl, [importDecl], loc);

      registry.register('Main', mainProgram);

      const errors = resolver.validateAllImports([mainProgram]);

      expect(errors).toHaveLength(1);
      expect(errors[0].location.start.line).toBe(5);
      expect(errors[0].location.start.column).toBe(10);
    });
  });

  // ============================================
  // IMPORT RESOLUTION
  // ============================================

  describe('Import Resolution', () => {
    it('should resolve valid imports', () => {
      const mainProgram = createProgramWithImports('Main', [
        { identifiers: ['foo', 'bar'], modulePath: ['Utils'] },
      ]);

      const utilsProgram = createProgramWithoutImports('Utils');

      registry.register('Main', mainProgram);
      registry.register('Utils', utilsProgram);

      const resolved = resolver.resolveImports([mainProgram, utilsProgram]);

      expect(resolved).toHaveLength(1);
      expect(resolved[0].fromModule).toBe('Main');
      expect(resolved[0].toModule).toBe('Utils');
      expect(resolved[0].importedIdentifiers).toEqual(['foo', 'bar']);
      expect(resolved[0].importDecl).toBeDefined();
    });

    it('should resolve multiple imports', () => {
      const mainProgram = createProgramWithImports('Main', [
        { identifiers: ['foo'], modulePath: ['Utils'] },
        { identifiers: ['bar'], modulePath: ['Graphics'] },
      ]);

      const utilsProgram = createProgramWithoutImports('Utils');
      const graphicsProgram = createProgramWithoutImports('Graphics');

      registry.register('Main', mainProgram);
      registry.register('Utils', utilsProgram);
      registry.register('Graphics', graphicsProgram);

      const resolved = resolver.resolveImports([mainProgram, utilsProgram, graphicsProgram]);

      expect(resolved).toHaveLength(2);

      const targets = resolved.map(r => r.toModule);
      expect(targets).toContain('Utils');
      expect(targets).toContain('Graphics');
    });

    it('should skip imports to non-existent modules', () => {
      // Main imports from Utils (exists) and Missing (doesn't exist)
      const mainProgram = createProgramWithImports('Main', [
        { identifiers: ['foo'], modulePath: ['Utils'] },
        { identifiers: ['bar'], modulePath: ['Missing'] },
      ]);

      const utilsProgram = createProgramWithoutImports('Utils');

      registry.register('Main', mainProgram);
      registry.register('Utils', utilsProgram);

      const resolved = resolver.resolveImports([mainProgram, utilsProgram]);

      // Only Utils import should be resolved (Missing is skipped)
      expect(resolved).toHaveLength(1);
      expect(resolved[0].toModule).toBe('Utils');
    });

    it('should return empty array for modules without imports', () => {
      const mainProgram = createProgramWithoutImports('Main');

      registry.register('Main', mainProgram);

      const resolved = resolver.resolveImports([mainProgram]);

      expect(resolved).toHaveLength(0);
    });

    it('should preserve import declaration references', () => {
      const mainProgram = createProgramWithImports('Main', [
        { identifiers: ['foo'], modulePath: ['Utils'] },
      ]);

      const utilsProgram = createProgramWithoutImports('Utils');

      registry.register('Main', mainProgram);
      registry.register('Utils', utilsProgram);

      const resolved = resolver.resolveImports([mainProgram, utilsProgram]);

      expect(resolved).toHaveLength(1);
      expect(resolved[0].importDecl).toBeInstanceOf(ImportDecl);
      expect(resolved[0].importDecl.getModuleName()).toBe('Utils');
    });
  });

  // ============================================
  // INTEGRATION WITH MODULE REGISTRY
  // ============================================

  describe('Integration with ModuleRegistry', () => {
    it('should work with empty registry', () => {
      const mainProgram = createProgramWithImports('Main', [
        { identifiers: ['foo'], modulePath: ['Utils'] },
      ]);

      // Registry is empty - module not registered

      const errors = resolver.validateAllImports([mainProgram]);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(DiagnosticCode.MODULE_NOT_FOUND);
    });

    it('should validate against registered modules', () => {
      // Register Utils
      const utilsProgram = createProgramWithoutImports('Utils');
      registry.register('Utils', utilsProgram);

      // Main imports Utils (should succeed)
      const mainProgram = createProgramWithImports('Main', [
        { identifiers: ['foo'], modulePath: ['Utils'] },
      ]);

      registry.register('Main', mainProgram);

      const errors = resolver.validateAllImports([mainProgram]);

      expect(errors).toHaveLength(0);
    });

    it('should handle case-sensitive module names', () => {
      // Register 'Utils' (exact case)
      const utilsProgram = createProgramWithoutImports('Utils');
      registry.register('Utils', utilsProgram);

      // Import 'utils' (different case) - should fail
      const mainProgram = createProgramWithImports('Main', [
        { identifiers: ['foo'], modulePath: ['utils'] }, // lowercase
      ]);

      registry.register('Main', mainProgram);

      const errors = resolver.validateAllImports([mainProgram]);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('utils');
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('Edge Cases', () => {
    it('should handle empty programs array', () => {
      const errors = resolver.validateAllImports([]);

      expect(errors).toHaveLength(0);
    });

    it('should handle wildcard imports', () => {
      const loc = createLocation();
      const moduleDecl = new ModuleDecl(['Main'], loc);

      // Wildcard import: import * from Utils
      const wildcardImport = new ImportDecl([], ['Utils'], loc, true);
      const mainProgram = new Program(moduleDecl, [wildcardImport], loc);

      const utilsProgram = createProgramWithoutImports('Utils');

      registry.register('Main', mainProgram);
      registry.register('Utils', utilsProgram);

      const errors = resolver.validateAllImports([mainProgram]);

      expect(errors).toHaveLength(0);

      const resolved = resolver.resolveImports([mainProgram]);

      expect(resolved).toHaveLength(1);
      expect(resolved[0].importedIdentifiers).toHaveLength(0); // Wildcard = empty array
    });

    it('should handle self-import attempts', () => {
      // Module tries to import from itself (technically allowed at this stage)
      const mainProgram = createProgramWithImports('Main', [
        { identifiers: ['foo'], modulePath: ['Main'] },
      ]);

      registry.register('Main', mainProgram);

      const errors = resolver.validateAllImports([mainProgram]);

      // No error - self-imports are detected later in semantic analysis
      expect(errors).toHaveLength(0);
    });

    it('should handle multiple modules with same missing import', () => {
      // Both A and B import from Missing
      const programA = createProgramWithImports('A', [
        { identifiers: ['x'], modulePath: ['Missing'] },
      ]);

      const programB = createProgramWithImports('B', [
        { identifiers: ['y'], modulePath: ['Missing'] },
      ]);

      registry.register('A', programA);
      registry.register('B', programB);

      const errors = resolver.validateAllImports([programA, programB]);

      // Should report error for both modules
      expect(errors).toHaveLength(2);
      expect(errors[0].code).toBe(DiagnosticCode.MODULE_NOT_FOUND);
      expect(errors[1].code).toBe(DiagnosticCode.MODULE_NOT_FOUND);
    });
  });

  // ============================================
  // REAL-WORLD SCENARIOS
  // ============================================

  describe('Real-World Scenarios', () => {
    it('should validate C64 system library imports', () => {
      // Game imports from C64 system modules
      const gameProgram = createProgramWithImports('Game', [
        { identifiers: ['screen'], modulePath: ['c64', 'graphics', 'screen'] },
        { identifiers: ['sprite'], modulePath: ['c64', 'graphics', 'sprite'] },
        { identifiers: ['sid'], modulePath: ['c64', 'sound', 'sid'] },
      ]);

      const screenProgram = createProgramWithoutImports('c64.graphics.screen');
      const spriteProgram = createProgramWithoutImports('c64.graphics.sprite');
      const sidProgram = createProgramWithoutImports('c64.sound.sid');

      registry.register('Game', gameProgram);
      registry.register('c64.graphics.screen', screenProgram);
      registry.register('c64.graphics.sprite', spriteProgram);
      registry.register('c64.sound.sid', sidProgram);

      const errors = resolver.validateAllImports([
        gameProgram,
        screenProgram,
        spriteProgram,
        sidProgram,
      ]);

      expect(errors).toHaveLength(0);
    });

    it('should detect missing system library module', () => {
      // Game imports from c64.graphics.screen, but it doesn't exist
      const gameProgram = createProgramWithImports('Game', [
        { identifiers: ['screen'], modulePath: ['c64', 'graphics', 'screen'] },
      ]);

      registry.register('Game', gameProgram);

      const errors = resolver.validateAllImports([gameProgram]);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('c64.graphics.screen');
      expect(errors[0].message).toContain('Game');
    });

    it('should handle large project with many modules', () => {
      // Create 10 modules, each importing from the next
      const programs: Program[] = [];

      for (let i = 0; i < 10; i++) {
        const moduleName = `Module${i}`;
        const nextModule = `Module${i + 1}`;

        if (i < 9) {
          // Import from next module
          const program = createProgramWithImports(moduleName, [
            { identifiers: ['value'], modulePath: [nextModule] },
          ]);
          programs.push(program);
          registry.register(moduleName, program);
        } else {
          // Last module has no imports
          const program = createProgramWithoutImports(moduleName);
          programs.push(program);
          registry.register(moduleName, program);
        }
      }

      const errors = resolver.validateAllImports(programs);

      expect(errors).toHaveLength(0);

      const resolved = resolver.resolveImports(programs);
      expect(resolved).toHaveLength(9); // 9 import relationships
    });
  });
});
