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
/**
 * Create a new SourceFile from path and content.
 */
export function createSourceFile(path, content) {
    return {
        path,
        content,
        tokens: null,
        program: null,
        errors: [],
    };
}
/**
 * Default project configuration.
 */
export function createDefaultProjectConfig(name, rootDirectory = '.') {
    return {
        name,
        sourcePatterns: ['**/*.blend'],
        targetPlatform: 'c64',
        rootDirectory,
        excludePatterns: ['node_modules/**', 'dist/**', '**/*.test.blend'],
    };
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Create a compilation error with consistent formatting.
 */
export function createCompilationError(type, message, filePath, location, suggestions) {
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
export function matchesPatterns(filePath, patterns) {
    // Simple pattern matching - in real implementation would use glob library
    return patterns.some(pattern => {
        if (pattern.includes('**')) {
            // Recursive wildcard
            const basePattern = pattern.replace('**/', '').replace('/**', '');
            return filePath.includes(basePattern);
        }
        else if (pattern.includes('*')) {
            // Simple wildcard
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(filePath);
        }
        else {
            // Exact match
            return filePath.includes(pattern);
        }
    });
}
/**
 * Validate project configuration for common issues.
 */
export function validateProjectConfig(config) {
    const errors = [];
    if (!config.name || config.name.trim() === '') {
        errors.push(createCompilationError('ProjectError', 'Project name is required', 'project-config'));
    }
    if (!config.sourceFiles && !config.sourcePatterns) {
        errors.push(createCompilationError('ProjectError', 'Either sourceFiles or sourcePatterns must be specified', 'project-config', undefined, ['Add sourceFiles: ["path/to/file.blend"]', 'Add sourcePatterns: ["src/**/*.blend"]']));
    }
    if (config.sourceFiles && config.sourceFiles.length === 0) {
        errors.push(createCompilationError('ProjectError', 'sourceFiles array cannot be empty', 'project-config'));
    }
    if (config.sourcePatterns && config.sourcePatterns.length === 0) {
        errors.push(createCompilationError('ProjectError', 'sourcePatterns array cannot be empty', 'project-config'));
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
export function getFileExtension(filePath) {
    const lastDotIndex = filePath.lastIndexOf('.');
    return lastDotIndex >= 0 ? filePath.substring(lastDotIndex) : '';
}
/**
 * Check if file is a Blend65 source file based on extension.
 */
export function isBlend65File(filePath) {
    const extension = getFileExtension(filePath);
    return extension === '.blend' || extension === '.bl65';
}
/**
 * Normalize file path for consistent handling across platforms.
 */
export function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
}
//# sourceMappingURL=types.js.map