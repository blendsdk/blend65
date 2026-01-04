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

// ============================================================================
// SOURCE FILE REPRESENTATION
// ============================================================================

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
export function createSourceFile(path: string, content: string): SourceFile {
  return {
    path,
    content,
    tokens: null,
    program: null,
    errors: [],
  };
}

// ============================================================================
// COMPILATION ERROR HANDLING
// ============================================================================

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
export type CompilationErrorType =
  | 'FileNotFound' // File discovery errors
  | 'FileReadError' // File system access errors
  | 'LexError' // Lexical analysis errors
  | 'ParseError' // Syntax parsing errors
  | 'ProjectError'; // Project configuration errors

/**
 * Result type for operations that can fail with compilation errors.
 * Similar to SemanticResult but for earlier compilation phases.
 */
export type CompilationResult<T> =
  | {
      success: true;
      data: T;
      warnings?: CompilationError[];
    }
  | {
      success: false;
      errors: CompilationError[];
      warnings?: CompilationError[];
    };

// ============================================================================
// PROJECT CONFIGURATION
// ============================================================================

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
export function createDefaultProjectConfig(
  name: string,
  rootDirectory: string = '.'
): ProjectConfig {
  return {
    name,
    sourcePatterns: ['**/*.blend'],
    targetPlatform: 'c64',
    rootDirectory,
    excludePatterns: ['node_modules/**', 'dist/**', '**/*.test.blend'],
  };
}

// ============================================================================
// COMPILATION UNIT INTERFACE
// ============================================================================

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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a compilation error with consistent formatting.
 */
export function createCompilationError(
  type: CompilationErrorType,
  message: string,
  filePath: string,
  location?: CompilationError['location'],
  suggestions?: string[]
): CompilationError {
  return {
    type,
    message,
    filePath,
    location,
    suggestions,
  };
}

/**
 * Check if a file path matches any of the given patterns.
 * Used for include/exclude pattern matching.
 */
export function matchesPatterns(filePath: string, patterns: string[]): boolean {
  // Simple pattern matching - in real implementation would use glob library
  return patterns.some(pattern => {
    if (pattern.includes('**')) {
      // Recursive wildcard
      const basePattern = pattern.replace('**/', '').replace('/**', '');
      return filePath.includes(basePattern);
    } else if (pattern.includes('*')) {
      // Simple wildcard
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filePath);
    } else {
      // Exact match
      return filePath.includes(pattern);
    }
  });
}

/**
 * Validate project configuration for common issues.
 */
export function validateProjectConfig(config: ProjectConfig): CompilationResult<void> {
  const errors: CompilationError[] = [];

  if (!config.name || config.name.trim() === '') {
    errors.push(
      createCompilationError('ProjectError', 'Project name is required', 'project-config')
    );
  }

  if (!config.sourceFiles && !config.sourcePatterns) {
    errors.push(
      createCompilationError(
        'ProjectError',
        'Either sourceFiles or sourcePatterns must be specified',
        'project-config',
        undefined,
        ['Add sourceFiles: ["path/to/file.blend"]', 'Add sourcePatterns: ["src/**/*.blend"]']
      )
    );
  }

  if (config.sourceFiles && config.sourceFiles.length === 0) {
    errors.push(
      createCompilationError('ProjectError', 'sourceFiles array cannot be empty', 'project-config')
    );
  }

  if (config.sourcePatterns && config.sourcePatterns.length === 0) {
    errors.push(
      createCompilationError(
        'ProjectError',
        'sourcePatterns array cannot be empty',
        'project-config'
      )
    );
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: undefined,
  };
}

/**
 * Get file extension from path.
 */
export function getFileExtension(filePath: string): string {
  const lastDotIndex = filePath.lastIndexOf('.');
  return lastDotIndex >= 0 ? filePath.substring(lastDotIndex) : '';
}

/**
 * Check if file is a Blend65 source file based on extension.
 */
export function isBlend65File(filePath: string): boolean {
  const extension = getFileExtension(filePath);
  return extension === '.blend' || extension === '.bl65';
}

/**
 * Normalize file path for consistent handling across platforms.
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
