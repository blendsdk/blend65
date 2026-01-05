/**
 * Compilation Unit for Multi-file Blend65 Projects
 * Task 1.5.5: Multi-file Compilation Infrastructure
 *
 * This file implements the main compilation orchestration:
 * - Multi-file loading and management
 * - Batch lexing and parsing
 * - Error aggregation across files
 * - Interface to semantic analysis
 */
import { Program } from '@blend65/ast';
import { SourceFile, CompilationError, CompilationResult, CompilationStatistics, FileStatus, ProjectConfig } from './types.js';
/**
 * Main compilation unit that orchestrates multi-file compilation.
 * Manages the progression from source files → tokens → ASTs → semantic analysis.
 */
export declare class CompilationUnit {
    /** Source files in the compilation unit */
    private sourceFiles;
    /** Compilation errors across all files */
    private errors;
    /** Compilation warnings across all files */
    private warnings;
    /** Processing status for each file */
    private fileStatuses;
    /** Compilation start time for performance metrics */
    private startTime;
    /** Project configuration */
    private _config;
    /**
     * Create compilation unit from explicit file paths.
     * Files must exist and be accessible.
     */
    static fromFiles(filePaths: string[]): Promise<CompilationResult<CompilationUnit>>;
    /**
     * Create compilation unit from project configuration.
     * For testing, this will work with manually provided files.
     */
    static fromConfig(config: ProjectConfig): CompilationResult<CompilationUnit>;
    /**
     * Add a source file to the compilation unit.
     */
    addSourceFile(path: string, content: string): void;
    /**
     * Get all source files.
     */
    getSourceFiles(): Map<string, SourceFile>;
    /**
     * Get source file by path.
     */
    getSourceFile(path: string): SourceFile | null;
    /**
     * Get file status by path.
     */
    getFileStatus(path: string): FileStatus | null;
    /**
     * Get project configuration.
     */
    getConfig(): ProjectConfig | null;
    /**
     * Lex all source files in the compilation unit.
     * Converts source code to tokens for each file.
     */
    lexAllFiles(): Promise<CompilationResult<void>>;
    /**
     * Parse all lexed files in the compilation unit.
     * Converts tokens to ASTs for each file.
     */
    parseAllFiles(): Promise<CompilationResult<void>>;
    /**
     * Perform complete lex and parse operations on all files.
     * Convenience method that combines lexing and parsing.
     */
    lexAndParseAll(): Promise<CompilationResult<void>>;
    /**
     * Get all successfully parsed programs for semantic analysis.
     * This is the main interface used by the semantic analyzer.
     */
    getAllPrograms(): Program[];
    /**
     * Check if compilation unit has any errors.
     */
    hasErrors(): boolean;
    /**
     * Get all compilation errors across all files.
     */
    getErrors(): CompilationError[];
    /**
     * Get all compilation warnings across all files.
     */
    getWarnings(): CompilationError[];
    /**
     * Get compilation statistics.
     */
    getStatistics(): CompilationStatistics;
    /**
     * Get string representation of compilation unit for debugging.
     */
    toString(): string;
    /**
     * Reset compilation unit to initial state.
     * Useful for re-compilation scenarios.
     */
    reset(): void;
    /**
     * Remove a source file from the compilation unit.
     */
    removeSourceFile(path: string): boolean;
    /**
     * Clear all source files.
     */
    clear(): void;
}
//# sourceMappingURL=compilation-unit.d.ts.map