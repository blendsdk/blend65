/**
 * Symbol Table Management for Blend65 Semantic Analysis
 * Task 1.2: Implement Symbol Table Management
 *
 * This file implements the core symbol table functionality for the Blend65 compiler:
 * - Hierarchical scope management (Global → Module → Function → Block)
 * - Symbol declaration and lookup with proper lexical scoping
 * - Symbol visibility and shadowing rules
 * - Blend65 module system support with import/export tracking
 * - Duplicate declaration detection
 * - Type-safe symbol resolution
 *
 * Educational Focus:
 * - How compilers manage nested scopes and symbol visibility
 * - Implementation of lexical scoping rules
 * - Module system symbol resolution
 * - Error detection and recovery in symbol management
 */
import { SourcePosition } from '@blend65/lexer';
import { Symbol, Scope, ScopeType, ModuleSymbol, SemanticError, SemanticResult, ImportInfo } from './types.js';
/**
 * Main symbol table class that manages hierarchical scopes and symbol resolution.
 *
 * Educational Note:
 * - The symbol table is the compiler's "memory" of all declared symbols
 * - Scope hierarchy enables proper variable shadowing and visibility
 * - Efficient lookup enables fast symbol resolution during compilation
 */
export declare class SymbolTable {
    /** Current scope being processed */
    private currentScope;
    /** Global scope (root of scope hierarchy) */
    private globalScope;
    /** All modules in the program, indexed by qualified name */
    private modules;
    /** Errors accumulated during symbol table construction */
    private errors;
    /**
     * Initialize symbol table with global scope.
     */
    constructor();
    /**
     * Enter a new scope (push scope onto scope stack).
     *
     * Educational Note:
     * - Entering scope creates new symbol namespace
     * - Parent scope remains accessible for symbol lookup
     * - Used when processing functions, blocks, etc.
     */
    enterScope(scopeType: ScopeType, name?: string): void;
    /**
     * Exit current scope (pop scope from scope stack).
     *
     * Educational Note:
     * - Exiting scope removes local symbols from visibility
     * - Parent scope becomes current scope again
     * - Local symbols are preserved for later phases (IL generation)
     */
    exitScope(): void;
    /**
     * Get current scope.
     */
    getCurrentScope(): Scope;
    /**
     * Get global scope.
     */
    getGlobalScope(): Scope;
    /**
     * Declare a symbol in the current scope.
     *
     * Educational Note:
     * - Declaration adds symbol to current scope's symbol table
     * - Checks for duplicate declarations in same scope
     * - Different scopes can have symbols with same name (shadowing)
     */
    declareSymbol(symbol: Symbol): SemanticResult<void>;
    /**
     * Look up a symbol by name in current scope chain.
     *
     * Educational Note:
     * - Lookup walks up the scope chain from current to global
     * - First matching symbol wins (inner scopes shadow outer scopes)
     * - Returns null if symbol not found in any accessible scope
     */
    lookupSymbol(name: string): Symbol | null;
    /**
     * Look up a symbol in a specific scope (no scope chain walking).
     *
     * Educational Note:
     * - Direct scope lookup for specific visibility rules
     * - Used for checking local vs global symbol conflicts
     * - Useful for implementing specific language semantics
     */
    lookupSymbolInScope(name: string, scope: Scope): Symbol | null;
    /**
     * Look up a qualified symbol (e.g., "Game.Main", "c64.sprites").
     *
     * Educational Note:
     * - Qualified names enable hierarchical organization
     * - Module system allows importing symbols from other modules
     * - Qualified lookup resolves module boundaries
     */
    lookupQualifiedSymbol(qualifiedName: string[]): Symbol | null;
    /**
     * Look up all symbols in current scope (for debugging/introspection).
     */
    getCurrentScopeSymbols(): Map<string, Symbol>;
    /**
     * Get all symbols accessible from current scope.
     *
     * Educational Note:
     * - Returns all symbols visible in current context
     * - Includes symbols from parent scopes
     * - Useful for IDE completion and error reporting
     */
    getAccessibleSymbols(): Map<string, Symbol>;
    /**
     * Register a module and enter its scope.
     *
     * Educational Note:
     * - Modules provide namespace isolation
     * - Module scope contains module's declarations
     * - Module registration enables import/export resolution
     */
    enterModule(moduleSymbol: ModuleSymbol): SemanticResult<void>;
    /**
     * Exit module scope.
     */
    exitModule(): void;
    /**
     * Add an export to the current module.
     *
     * Educational Note:
     * - Exported symbols become visible to importing modules
     * - Export tracking enables import resolution
     * - Only exported symbols are accessible via qualified names
     */
    exportSymbol(symbol: Symbol): SemanticResult<void>;
    /**
     * Add an import to the current module.
     *
     * Educational Note:
     * - Imports make external symbols available in current module
     * - Import resolution happens during symbol table construction
     * - Failed imports are semantic errors
     */
    importSymbol(importInfo: ImportInfo, location: SourcePosition): SemanticResult<void>;
    /**
     * Get current module (if in module scope).
     */
    getCurrentModule(): ModuleSymbol | null;
    /**
     * Get all modules in the symbol table.
     */
    getAllModules(): Map<string, ModuleSymbol>;
    /**
     * Check if a symbol would shadow another symbol.
     *
     * Educational Note:
     * - Shadowing occurs when inner scope declares symbol with same name as outer scope
     * - Some languages allow shadowing, others forbid it
     * - Blend65 allows shadowing but warns about potential confusion
     */
    checkShadowing(symbolName: string, location: SourcePosition): SemanticResult<void>;
    /**
     * Check if a symbol is visible from current scope.
     *
     * Educational Note:
     * - Visibility rules determine which symbols can be accessed
     * - Used for validating symbol references in expressions
     * - Considers scope hierarchy and module boundaries
     */
    isSymbolVisible(symbol: Symbol): boolean;
    /**
     * Add a semantic error to the error list.
     */
    private addError;
    /**
     * Get all accumulated errors.
     */
    getErrors(): SemanticError[];
    /**
     * Clear all accumulated errors.
     */
    clearErrors(): void;
    /**
     * Check if symbol table has any errors.
     */
    hasErrors(): boolean;
    /**
     * Get string representation of symbol table for debugging.
     *
     * Educational Note:
     * - Debug output helps understand symbol table structure
     * - Useful for compiler development and troubleshooting
     * - Shows scope hierarchy and symbol distribution
     */
    toString(): string;
    /**
     * Convert scope to string representation (recursive helper).
     */
    private scopeToString;
    /**
     * Get statistics about symbol table.
     */
    getStatistics(): SymbolTableStatistics;
    /**
     * Get maximum scope depth (for complexity analysis).
     */
    private getMaxScopeDepth;
}
/**
 * Statistics about symbol table structure.
 */
export interface SymbolTableStatistics {
    /** Total number of symbols across all scopes */
    totalSymbols: number;
    /** Total number of scopes */
    totalScopes: number;
    /** Number of modules */
    moduleCount: number;
    /** Number of accumulated errors */
    errorCount: number;
    /** Maximum nesting depth of scopes */
    maxScopeDepth: number;
}
/**
 * Create a new symbol table.
 */
export declare function createSymbolTable(): SymbolTable;
/**
 * Helper function to validate symbol table integrity.
 * Useful for testing and debugging.
 */
export declare function validateSymbolTable(symbolTable: SymbolTable): SemanticResult<void>;
/**
 * Educational Summary of Symbol Table Implementation:
 *
 * 1. HIERARCHICAL SCOPE MANAGEMENT
 *    - Global → Module → Function → Block scope hierarchy
 *    - Proper scope enter/exit with scope stack management
 *    - Parent-child relationships for scope traversal
 *
 * 2. SYMBOL DECLARATION AND LOOKUP
 *    - Type-safe symbol declaration with duplicate detection
 *    - Lexical scoping with scope chain traversal
 *    - Qualified name resolution for module system
 *    - Efficient symbol lookup with scope walking
 *
 * 3. MODULE SYSTEM SUPPORT
 *    - Module registration and scope management
 *    - Import/export tracking with resolution
 *    - Symbol visibility across module boundaries
 *    - Qualified name resolution (e.g., Game.Main, c64.sprites)
 *
 * 4. VISIBILITY AND SHADOWING
 *    - Symbol shadowing detection with warnings
 *    - Visibility checking for symbol references
 *    - Scope-based access control
 *
 * 5. ERROR HANDLING
 *    - Comprehensive error collection and reporting
 *    - Rich error messages with suggestions
 *    - Error recovery for continued compilation
 *
 * 6. DEBUGGING AND INTROSPECTION
 *    - String representation for debugging
 *    - Statistics collection for analysis
 *    - Validation functions for testing
 *
 * This symbol table implementation provides the foundation for semantic analysis
 * in the Blend65 compiler, enabling proper symbol resolution, scope management,
 * and error detection for 6502-targeted compilation.
 *
 * Next: Task 1.3 will implement the type system infrastructure that uses this
 * symbol table for type checking and validation.
 */
//# sourceMappingURL=symbol-table.d.ts.map