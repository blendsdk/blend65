/**
 * Core Compilation Infrastructure Types for Blend65
 * Task 1.5.5: Multi-file Compilation Infrastructure
 *
 * This file defines the core types for multi-file compilation:
 * - SourceFile representation
 * - CompilationUnit orchestration
 * - Project configuration
 * - Compilation error handling
 */
import { Token } from '@blend65/lexer';
import { Program } from '@blend65/ast';
/**
 * Represents a single .blend source file in the compilation unit.
 * Tracks the progression from source code → tokens → AST.
 */
export interface SourceFile {
    /** Absolute file path */
    path: string;
    /** Raw source content */
    content: string;
    /** Lexed tokens (null until lexing performed) */
    tokens: Token[] | null;
    /** Parsed AST (null until parsing performed) */
    program: Program | null;
    /** Compilation errors for this specific file */
    errors: CompilationError[];
}
/**
 * Create a new SourceFile from path and content.
 */
export declare function createSourceFile(path: string, content: string): SourceFile;
/**
 * Represents compilation errors that can occur during lex/parse phases.
 * Different from semantic errors which occur later in the pipeline.
 */
export interface CompilationError {
    /** Error type for categorization */
    type: CompilationErrorType;
    /** Human-readable error message */
    message: string;
    /** File where error occurred */
    filePath: string;
    /** Optional source location within file */
    location?: {
        line: number;
        column: number;
        offset: number;
    };
    /** Optional suggestions for fixing the error */
    suggestions?: string[];
}
/**
 * Categories of compilation errors.
 */
export type CompilationErrorType = 'FileNotFound' | 'FileReadError' | 'LexError' | 'ParseError' | 'ProjectError';
/**
 * Result type for operations that can fail with compilation errors.
 * Similar to SemanticResult but for earlier compilation phases.
 */
export type CompilationResult<T> = {
    success: true;
    data: T;
    warnings?: CompilationError[];
} | {
    success: false;
    errors: CompilationError[];
    warnings?: CompilationError[];
};
/**
 * Project configuration for multi-file compilation.
 * Specifies which files to include and how to process them.
 */
export interface ProjectConfig {
    /** Project name for identification */
    name: string;
    /** Explicit list of source files to compile */
    sourceFiles?: string[];
    /** Glob patterns for discovering source files */
    sourcePatterns?: string[];
    /** Target platform for compilation */
    targetPlatform?: 'c64' | 'vic20' | 'x16';
    /** Root directory for resolving relative paths */
    rootDirectory?: string;
    /** Exclude patterns for filtering out files */
    excludePatterns?: string[];
}
/**
 * Default project configuration.
 */
export declare function createDefaultProjectConfig(name: string, rootDirectory?: string): ProjectConfig;
/**
 * Statistics about the compilation unit for analysis and debugging.
 */
export interface CompilationStatistics {
    /** Total number of source files */
    fileCount: number;
    /** Total lines of source code */
    totalLines: number;
    /** Total number of tokens across all files */
    totalTokens: number;
    /** Number of files successfully lexed */
    lexedFiles: number;
    /** Number of files successfully parsed */
    parsedFiles: number;
    /** Total compilation errors across all files */
    errorCount: number;
    /** Total warnings across all files */
    warningCount: number;
    /** Compilation time in milliseconds */
    compilationTime: number;
}
/**
 * File processing status for tracking compilation progress.
 */
export type FileStatus = 'pending' | 'lexing' | 'lexed' | 'parsing' | 'parsed' | 'error';
/**
 * Create a compilation error with consistent formatting.
 */
export declare function createCompilationError(type: CompilationErrorType, message: string, filePath: string, location?: CompilationError['location'], suggestions?: string[]): CompilationError;
/**
 * Check if a file path matches any of the given patterns.
 * Used for include/exclude pattern matching.
 */
export declare function matchesPatterns(filePath: string, patterns: string[]): boolean;
/**
 * Validate project configuration for common issues.
 */
export declare function validateProjectConfig(config: ProjectConfig): CompilationResult<void>;
/**
 * Get file extension from path.
 */
export declare function getFileExtension(filePath: string): string;
/**
 * Check if file is a Blend65 source file based on extension.
 */
export declare function isBlend65File(filePath: string): boolean;
/**
 * Normalize file path for consistent handling across platforms.
 */
export declare function normalizePath(filePath: string): string;
//# sourceMappingURL=types.d.ts.map