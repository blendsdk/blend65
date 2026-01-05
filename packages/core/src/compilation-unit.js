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
import { Blend65Lexer } from '@blend65/lexer';
import { Blend65Parser } from '@blend65/parser';
import { createSourceFile, createCompilationError, isBlend65File, normalizePath, } from './types.js';
// ============================================================================
// COMPILATION UNIT IMPLEMENTATION
// ============================================================================
/**
 * Main compilation unit that orchestrates multi-file compilation.
 * Manages the progression from source files → tokens → ASTs → semantic analysis.
 */
export class CompilationUnit {
    /** Source files in the compilation unit */
    sourceFiles = new Map();
    /** Compilation errors across all files */
    errors = [];
    /** Compilation warnings across all files */
    warnings = [];
    /** Processing status for each file */
    fileStatuses = new Map();
    /** Compilation start time for performance metrics */
    startTime = 0;
    /** Project configuration */
    _config = null;
    // ============================================================================
    // STATIC FACTORY METHODS
    // ============================================================================
    /**
     * Create compilation unit from explicit file paths.
     * Files must exist and be accessible.
     */
    static async fromFiles(filePaths) {
        const unit = new CompilationUnit();
        const errors = [];
        for (const filePath of filePaths) {
            const normalizedPath = normalizePath(filePath);
            if (!isBlend65File(normalizedPath)) {
                errors.push(createCompilationError('ProjectError', `File '${normalizedPath}' is not a Blend65 source file (.blend or .bl65)`, normalizedPath, undefined, ['Ensure file has .blend or .bl65 extension']));
                continue;
            }
            // For testing purposes, we'll assume content is provided
            // In real implementation, would read from file system
            unit.addSourceFile(normalizedPath, '');
        }
        if (errors.length > 0) {
            return {
                success: false,
                errors,
            };
        }
        return {
            success: true,
            data: unit,
        };
    }
    /**
     * Create compilation unit from project configuration.
     * For testing, this will work with manually provided files.
     */
    static fromConfig(config) {
        const unit = new CompilationUnit();
        unit._config = config;
        if (config.sourceFiles) {
            for (const filePath of config.sourceFiles) {
                const normalizedPath = normalizePath(filePath);
                if (isBlend65File(normalizedPath)) {
                    unit.addSourceFile(normalizedPath, ''); // Empty content for now
                }
            }
        }
        return {
            success: true,
            data: unit,
        };
    }
    // ============================================================================
    // SOURCE FILE MANAGEMENT
    // ============================================================================
    /**
     * Add a source file to the compilation unit.
     */
    addSourceFile(path, content) {
        const normalizedPath = normalizePath(path);
        const sourceFile = createSourceFile(normalizedPath, content);
        this.sourceFiles.set(normalizedPath, sourceFile);
        this.fileStatuses.set(normalizedPath, 'pending');
    }
    /**
     * Get all source files.
     */
    getSourceFiles() {
        return new Map(this.sourceFiles);
    }
    /**
     * Get source file by path.
     */
    getSourceFile(path) {
        const normalizedPath = normalizePath(path);
        return this.sourceFiles.get(normalizedPath) || null;
    }
    /**
     * Get file status by path.
     */
    getFileStatus(path) {
        const normalizedPath = normalizePath(path);
        return this.fileStatuses.get(normalizedPath) || null;
    }
    /**
     * Get project configuration.
     */
    getConfig() {
        return this._config;
    }
    // ============================================================================
    // BATCH COMPILATION OPERATIONS
    // ============================================================================
    /**
     * Lex all source files in the compilation unit.
     * Converts source code to tokens for each file.
     */
    async lexAllFiles() {
        this.startTime = Date.now();
        const errors = [];
        const warnings = [];
        for (const [path, sourceFile] of this.sourceFiles) {
            this.fileStatuses.set(path, 'lexing');
            try {
                const lexer = new Blend65Lexer(sourceFile.content);
                const tokens = lexer.tokenize();
                sourceFile.tokens = tokens;
                this.fileStatuses.set(path, 'lexed');
            }
            catch (error) {
                const compilationError = createCompilationError('LexError', `Lexing error: ${error instanceof Error ? error.message : String(error)}`, path);
                errors.push(compilationError);
                sourceFile.errors.push(compilationError);
                this.fileStatuses.set(path, 'error');
            }
        }
        this.errors.push(...errors);
        this.warnings.push(...warnings);
        if (errors.length > 0) {
            return {
                success: false,
                errors,
                warnings: warnings.length > 0 ? warnings : undefined,
            };
        }
        return {
            success: true,
            data: undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }
    /**
     * Parse all lexed files in the compilation unit.
     * Converts tokens to ASTs for each file.
     */
    async parseAllFiles() {
        const errors = [];
        const warnings = [];
        for (const [path, sourceFile] of this.sourceFiles) {
            // Skip files that failed lexing
            if (this.fileStatuses.get(path) !== 'lexed') {
                continue;
            }
            if (!sourceFile.tokens) {
                const error = createCompilationError('ParseError', 'Cannot parse file: no tokens available (lexing may have failed)', path);
                errors.push(error);
                sourceFile.errors.push(error);
                this.fileStatuses.set(path, 'error');
                continue;
            }
            this.fileStatuses.set(path, 'parsing');
            try {
                const parser = new Blend65Parser(sourceFile.tokens);
                const program = parser.parse();
                sourceFile.program = program;
                this.fileStatuses.set(path, 'parsed');
            }
            catch (error) {
                const compilationError = createCompilationError('ParseError', `Parse error: ${error instanceof Error ? error.message : String(error)}`, path);
                errors.push(compilationError);
                sourceFile.errors.push(compilationError);
                this.fileStatuses.set(path, 'error');
            }
        }
        this.errors.push(...errors);
        this.warnings.push(...warnings);
        if (errors.length > 0) {
            return {
                success: false,
                errors,
                warnings: warnings.length > 0 ? warnings : undefined,
            };
        }
        return {
            success: true,
            data: undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }
    /**
     * Perform complete lex and parse operations on all files.
     * Convenience method that combines lexing and parsing.
     */
    async lexAndParseAll() {
        // First, lex all files
        const lexResult = await this.lexAllFiles();
        if (!lexResult.success) {
            return lexResult;
        }
        // Then, parse all successfully lexed files
        const parseResult = await this.parseAllFiles();
        if (!parseResult.success) {
            return {
                success: false,
                errors: parseResult.errors,
                warnings: [...(lexResult.warnings || []), ...(parseResult.warnings || [])],
            };
        }
        return {
            success: true,
            data: undefined,
            warnings: [...(lexResult.warnings || []), ...(parseResult.warnings || [])],
        };
    }
    // ============================================================================
    // SEMANTIC ANALYSIS INTERFACE
    // ============================================================================
    /**
     * Get all successfully parsed programs for semantic analysis.
     * This is the main interface used by the semantic analyzer.
     */
    getAllPrograms() {
        const programs = [];
        for (const sourceFile of this.sourceFiles.values()) {
            if (sourceFile.program && this.fileStatuses.get(sourceFile.path) === 'parsed') {
                programs.push(sourceFile.program);
            }
        }
        return programs;
    }
    /**
     * Check if compilation unit has any errors.
     */
    hasErrors() {
        return (this.errors.length > 0 ||
            Array.from(this.sourceFiles.values()).some(file => file.errors.length > 0));
    }
    /**
     * Get all compilation errors across all files.
     */
    getErrors() {
        const allErrors = [...this.errors];
        // Add file-specific errors
        for (const sourceFile of this.sourceFiles.values()) {
            allErrors.push(...sourceFile.errors);
        }
        return allErrors;
    }
    /**
     * Get all compilation warnings across all files.
     */
    getWarnings() {
        return [...this.warnings];
    }
    /**
     * Get compilation statistics.
     */
    getStatistics() {
        const endTime = Date.now();
        const compilationTime = this.startTime > 0 ? endTime - this.startTime : 0;
        let totalLines = 0;
        let totalTokens = 0;
        let lexedFiles = 0;
        let parsedFiles = 0;
        for (const [path, sourceFile] of this.sourceFiles) {
            // Count lines
            totalLines += sourceFile.content.split('\n').length;
            // Count tokens
            if (sourceFile.tokens) {
                totalTokens += sourceFile.tokens.length;
            }
            // Count successful operations
            const status = this.fileStatuses.get(path);
            if (status === 'lexed' || status === 'parsed') {
                lexedFiles++;
            }
            if (status === 'parsed') {
                parsedFiles++;
            }
        }
        return {
            fileCount: this.sourceFiles.size,
            totalLines,
            totalTokens,
            lexedFiles,
            parsedFiles,
            errorCount: this.getErrors().length,
            warningCount: this.warnings.length,
            compilationTime,
        };
    }
    // ============================================================================
    // DEBUGGING AND INTROSPECTION
    // ============================================================================
    /**
     * Get string representation of compilation unit for debugging.
     */
    toString() {
        const stats = this.getStatistics();
        let result = `CompilationUnit[${stats.fileCount} files]\n`;
        for (const [path, sourceFile] of this.sourceFiles) {
            const status = this.fileStatuses.get(path);
            const errorCount = sourceFile.errors.length;
            result += `  ${path}: ${status}${errorCount > 0 ? ` (${errorCount} errors)` : ''}\n`;
        }
        if (this.hasErrors()) {
            result += '\nErrors:\n';
            for (const error of this.getErrors()) {
                result += `  ${error.filePath}: ${error.message}\n`;
            }
        }
        return result;
    }
    /**
     * Reset compilation unit to initial state.
     * Useful for re-compilation scenarios.
     */
    reset() {
        for (const sourceFile of this.sourceFiles.values()) {
            sourceFile.tokens = null;
            sourceFile.program = null;
            sourceFile.errors = [];
        }
        for (const path of this.fileStatuses.keys()) {
            this.fileStatuses.set(path, 'pending');
        }
        this.errors = [];
        this.warnings = [];
        this.startTime = 0;
    }
    /**
     * Remove a source file from the compilation unit.
     */
    removeSourceFile(path) {
        const normalizedPath = normalizePath(path);
        const existed = this.sourceFiles.delete(normalizedPath);
        this.fileStatuses.delete(normalizedPath);
        return existed;
    }
    /**
     * Clear all source files.
     */
    clear() {
        this.sourceFiles.clear();
        this.fileStatuses.clear();
        this.errors = [];
        this.warnings = [];
        this.startTime = 0;
        this._config = null;
    }
}
//# sourceMappingURL=compilation-unit.js.map