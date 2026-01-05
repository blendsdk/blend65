/**
 * Module System Analyzer for Blend65
 * Task 1.6: Implement Module System Analysis
 *
 * Handles cross-file module analysis including import/export resolution,
 * dependency validation, and symbol visibility across modules.
 *
 * Key Responsibilities:
 * - Cross-file import/export resolution
 * - Circular dependency detection
 * - Symbol visibility enforcement across module boundaries
 * - Qualified name resolution (Module.symbolName)
 * - Module dependency graph construction
 */
import { Program } from '@blend65/ast';
import { SemanticError } from '../types.js';
import { SymbolTable } from '../symbol-table.js';
/**
 * Handles cross-file module analysis including import/export resolution,
 * dependency validation, and symbol visibility across modules.
 */
export declare class ModuleAnalyzer {
    private symbolTable;
    private errors;
    private warnings;
    private dependencyGraph;
    private processingStack;
    private moduleExports;
    private programMap;
    constructor(symbolTable: SymbolTable);
    /**
     * Analyzes all imports and exports across multiple programs in compilation unit.
     * This is the main entry point called from SemanticAnalyzer.
     */
    analyzeModuleSystem(programs: Program[]): SemanticError[];
    /**
     * Reset analyzer state for fresh analysis
     */
    private reset;
    /**
     * Build mapping from module names to programs for quick lookup
     */
    private buildProgramMap;
    /**
     * Builds a dependency graph from all import declarations
     */
    private buildDependencyGraph;
    /**
     * Collect all exported symbols from all modules
     */
    private collectAllExports;
    /**
     * Detects circular dependencies using DFS
     */
    private detectCircularDependencies;
    private detectCircularDependencyDFS;
    /**
     * Resolves imports in proper dependency order (topological sort)
     */
    private resolveImportsInOrder;
    private resolveModuleImports;
    /**
     * Process a single module's import declarations
     */
    private processModuleImports;
    /**
     * Resolve a single import declaration
     */
    private resolveImportDeclaration;
    /**
     * Add an imported symbol to the importing module's scope
     */
    private addImportedSymbol;
    /**
     * Validate that all export declarations are valid
     */
    private validateExports;
    /**
     * Validate exports for a single module
     */
    private validateModuleExports;
    /**
     * Convert QualifiedName to string representation
     */
    private qualifiedNameToString;
    /**
     * Get current errors (for testing and debugging)
     */
    getErrors(): SemanticError[];
    /**
     * Get current warnings (for testing and debugging)
     */
    getWarnings(): SemanticError[];
}
//# sourceMappingURL=module-analyzer.d.ts.map