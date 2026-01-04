/**
 * Module Analyzer Test Suite
 * Task 1.6: Comprehensive testing for cross-file module analysis
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ModuleAnalyzer } from '../module-analyzer';
import { createSymbolTable } from '../../symbol-table';
import { ASTNodeFactory } from '@blend65/ast';

describe('ModuleAnalyzer', () => {
  let analyzer: ModuleAnalyzer;
  let factory: ASTNodeFactory;

  beforeEach(() => {
    const symbolTable = createSymbolTable();
    analyzer = new ModuleAnalyzer(symbolTable);
    factory = new ASTNodeFactory();
  });

  describe('Basic Module Analysis', () => {
    it('should analyze single module without errors', () => {
      const program = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Game', 'Main'])),
        [],
        [],
        [
          factory.createFunctionDeclaration(
            'main',
            [],
            factory.createPrimitiveType('void'),
            [],
            false,
            false
          ),
        ]
      );

      const errors = analyzer.analyzeModuleSystem([program]);
      expect(errors).toHaveLength(0);
    });

    it('should collect exported symbols correctly', () => {
      const exportedFunction = factory.createFunctionDeclaration(
        'updatePlayer',
        [],
        factory.createPrimitiveType('void'),
        [],
        false,
        true
      );
      const program = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Game', 'Logic'])),
        [],
        [factory.createExportDeclaration(exportedFunction)],
        [exportedFunction]
      );

      const errors = analyzer.analyzeModuleSystem([program]);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Import/Export Resolution', () => {
    it('should successfully resolve valid imports', () => {
      // Create module that exports a function
      const exportingModule = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Engine', 'Utils'])),
        [],
        [
          factory.createExportDeclaration(
            factory.createFunctionDeclaration(
              'calculateScore',
              [],
              factory.createPrimitiveType('byte'),
              [],
              false,
              true
            )
          ),
        ],
        [
          factory.createFunctionDeclaration(
            'calculateScore',
            [],
            factory.createPrimitiveType('byte'),
            [],
            false,
            true
          ),
        ]
      );

      // Create module that imports the function
      const importingModule = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Game', 'Main'])),
        [
          factory.createImportDeclaration(
            [factory.createImportSpecifier('calculateScore', null)],
            factory.createQualifiedName(['Engine', 'Utils'])
          ),
        ],
        [],
        []
      );

      const errors = analyzer.analyzeModuleSystem([exportingModule, importingModule]);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing exported symbols', () => {
      // Create module that doesn't export anything
      const exportingModule = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Engine', 'Utils'])),
        [],
        [],
        [
          factory.createFunctionDeclaration(
            'internalFunction',
            [],
            factory.createPrimitiveType('void'),
            [],
            false,
            false
          ),
        ]
      );

      // Create module that tries to import non-existent symbol
      const importingModule = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Game', 'Main'])),
        [
          factory.createImportDeclaration(
            [factory.createImportSpecifier('calculateScore', null)],
            factory.createQualifiedName(['Engine', 'Utils'])
          ),
        ],
        [],
        []
      );

      const errors = analyzer.analyzeModuleSystem([exportingModule, importingModule]);
      expect(errors).toHaveLength(1);
      expect(errors[0].errorType).toBe('ImportNotFound');
      expect(errors[0].message).toContain("does not export 'calculateScore'");
    });

    it('should detect missing modules', () => {
      const importingModule = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Game', 'Main'])),
        [
          factory.createImportDeclaration(
            [factory.createImportSpecifier('someFunction', null)],
            factory.createQualifiedName(['NonExistent', 'Module'])
          ),
        ],
        [],
        []
      );

      const errors = analyzer.analyzeModuleSystem([importingModule]);
      expect(errors).toHaveLength(1);
      expect(errors[0].errorType).toBe('ModuleNotFound');
      expect(errors[0].message).toContain("Cannot find module 'NonExistent.Module'");
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect simple circular dependencies', () => {
      const moduleA = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['ModuleA'])),
        [
          factory.createImportDeclaration(
            [factory.createImportSpecifier('funcB', null)],
            factory.createQualifiedName(['ModuleB'])
          ),
        ],
        [],
        [
          factory.createFunctionDeclaration(
            'funcA',
            [],
            factory.createPrimitiveType('void'),
            [],
            true,
            false
          ),
        ]
      );

      const moduleB = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['ModuleB'])),
        [
          factory.createImportDeclaration(
            [factory.createImportSpecifier('funcA', null)],
            factory.createQualifiedName(['ModuleA'])
          ),
        ],
        [],
        [
          factory.createFunctionDeclaration(
            'funcB',
            [],
            factory.createPrimitiveType('void'),
            [],
            true,
            false
          ),
        ]
      );

      const errors = analyzer.analyzeModuleSystem([moduleA, moduleB]);

      // Should detect circular dependency
      const circularErrors = errors.filter(e => e.errorType === 'CircularDependency');
      expect(circularErrors).toHaveLength(1);
      expect(circularErrors[0].message).toContain('Circular dependency detected');
    });

    it('should allow modules without circular dependencies', () => {
      const moduleA = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['ModuleA'])),
        [],
        [],
        [
          factory.createFunctionDeclaration(
            'funcA',
            [],
            factory.createPrimitiveType('void'),
            [],
            false,
            true
          ),
        ]
      );

      const moduleB = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['ModuleB'])),
        [
          factory.createImportDeclaration(
            [factory.createImportSpecifier('funcA', null)],
            factory.createQualifiedName(['ModuleA'])
          ),
        ],
        [],
        [
          factory.createFunctionDeclaration(
            'funcB',
            [],
            factory.createPrimitiveType('void'),
            [],
            false,
            true
          ),
        ]
      );

      const errors = analyzer.analyzeModuleSystem([moduleA, moduleB]);

      // Should not detect circular dependency
      const circularErrors = errors.filter(e => e.errorType === 'CircularDependency');
      expect(circularErrors).toHaveLength(0);
    });
  });

  describe('Export Validation', () => {
    it('should validate that exported symbols are declared', () => {
      const program = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Game', 'Main'])),
        [],
        [
          factory.createExportDeclaration(
            factory.createFunctionDeclaration(
              'undeclaredFunction',
              [],
              factory.createPrimitiveType('void'),
              [],
              false,
              true
            )
          ),
        ],
        [] // Empty body - function not actually declared
      );

      const errors = analyzer.analyzeModuleSystem([program]);
      expect(errors).toHaveLength(1);
      expect(errors[0].errorType).toBe('ExportNotFound');
      expect(errors[0].message).toContain(
        "Cannot export 'undeclaredFunction' - symbol not declared"
      );
    });

    it('should allow exporting declared symbols', () => {
      const declaredFunction = factory.createFunctionDeclaration(
        'declaredFunction',
        [],
        factory.createPrimitiveType('void'),
        [],
        false,
        true
      );
      const program = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Game', 'Main'])),
        [],
        [factory.createExportDeclaration(declaredFunction)],
        [declaredFunction]
      );

      const errors = analyzer.analyzeModuleSystem([program]);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Complex Multi-Module Scenarios', () => {
    it('should handle three-module dependency chain', () => {
      // Utils module (no dependencies)
      const utilsModule = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Utils'])),
        [],
        [],
        [
          factory.createFunctionDeclaration(
            'helper',
            [],
            factory.createPrimitiveType('void'),
            [],
            true,
            false
          ),
        ]
      );

      // Engine module (depends on Utils)
      const engineModule = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Engine'])),
        [
          factory.createImportDeclaration(
            [factory.createImportSpecifier('helper', null)],
            factory.createQualifiedName(['Utils'])
          ),
        ],
        [],
        [
          factory.createFunctionDeclaration(
            'process',
            [],
            factory.createPrimitiveType('void'),
            [],
            true,
            false
          ),
        ]
      );

      // Game module (depends on Engine)
      const gameModule = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Game'])),
        [
          factory.createImportDeclaration(
            [factory.createImportSpecifier('process', null)],
            factory.createQualifiedName(['Engine'])
          ),
        ],
        [],
        [
          factory.createFunctionDeclaration(
            'main',
            [],
            factory.createPrimitiveType('void'),
            [],
            false,
            false
          ),
        ]
      );

      const errors = analyzer.analyzeModuleSystem([utilsModule, engineModule, gameModule]);
      expect(errors).toHaveLength(0);
    });

    it('should handle multiple imports from same module', () => {
      const utilsModule = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Utils'])),
        [],
        [],
        [
          factory.createFunctionDeclaration(
            'helper1',
            [],
            factory.createPrimitiveType('void'),
            [],
            true,
            false
          ),
          factory.createFunctionDeclaration(
            'helper2',
            [],
            factory.createPrimitiveType('byte'),
            [],
            true,
            false
          ),
        ]
      );

      const gameModule = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Game'])),
        [
          factory.createImportDeclaration(
            [
              factory.createImportSpecifier('helper1', null),
              factory.createImportSpecifier('helper2', null),
            ],
            factory.createQualifiedName(['Utils'])
          ),
        ],
        [],
        []
      );

      const errors = analyzer.analyzeModuleSystem([utilsModule, gameModule]);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Error Reporting Quality', () => {
    it('should provide helpful suggestions for missing imports', () => {
      const moduleA = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['ModuleA'])),
        [],
        [],
        [
          factory.createFunctionDeclaration(
            'correctFunction',
            [],
            factory.createPrimitiveType('void'),
            [],
            false,
            true
          ),
        ]
      );

      const moduleB = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['ModuleB'])),
        [
          factory.createImportDeclaration(
            [factory.createImportSpecifier('wrongFunction', null)],
            factory.createQualifiedName(['ModuleA'])
          ),
        ],
        [],
        []
      );

      const errors = analyzer.analyzeModuleSystem([moduleA, moduleB]);
      expect(errors).toHaveLength(1);
      expect(errors[0].suggestions).toBeDefined();
      expect(errors[0].suggestions!.length).toBeGreaterThan(0);
      expect(errors[0].suggestions![0]).toContain('Check available exports');
    });

    it('should provide helpful suggestions for missing modules', () => {
      const moduleB = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['ModuleB'])),
        [
          factory.createImportDeclaration(
            [factory.createImportSpecifier('someFunction', null)],
            factory.createQualifiedName(['NonExistent'])
          ),
        ],
        [],
        []
      );

      const errors = analyzer.analyzeModuleSystem([moduleB]);
      expect(errors).toHaveLength(1);
      expect(errors[0].suggestions).toBeDefined();
      expect(errors[0].suggestions!.length).toBeGreaterThan(0);
      expect(errors[0].suggestions![0]).toContain('Check if module');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty module list', () => {
      const errors = analyzer.analyzeModuleSystem([]);
      expect(errors).toHaveLength(0);
    });

    it('should handle module with no imports or exports', () => {
      const program = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Standalone'])),
        [],
        [],
        [
          factory.createFunctionDeclaration(
            'internalFunction',
            [],
            factory.createPrimitiveType('void'),
            [],
            false,
            false
          ),
        ]
      );

      const errors = analyzer.analyzeModuleSystem([program]);
      expect(errors).toHaveLength(0);
    });

    it('should reset state between analyses', () => {
      const program1 = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Module1'])),
        [
          factory.createImportDeclaration(
            [factory.createImportSpecifier('nonExistent', null)],
            factory.createQualifiedName(['NonExistent'])
          ),
        ],
        [],
        []
      );

      const program2 = factory.createProgram(
        factory.createModuleDeclaration(factory.createQualifiedName(['Module2'])),
        [],
        [],
        []
      );

      // First analysis should have errors
      const errors1 = analyzer.analyzeModuleSystem([program1]);
      expect(errors1).toHaveLength(1);

      // Second analysis should be clean
      const errors2 = analyzer.analyzeModuleSystem([program2]);
      expect(errors2).toHaveLength(0);
    });
  });
});
