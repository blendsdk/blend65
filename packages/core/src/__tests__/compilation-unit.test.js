/**
 * Tests for CompilationUnit
 * Task 1.5.5: Multi-file Compilation Infrastructure
 */
import { describe, it, expect } from 'vitest';
import { CompilationUnit } from '../compilation-unit.js';
import { createDefaultProjectConfig } from '../types.js';
describe('CompilationUnit', () => {
    describe('Basic functionality', () => {
        it('should create empty compilation unit', () => {
            const unit = new CompilationUnit();
            expect(unit.getAllPrograms()).toEqual([]);
            expect(unit.hasErrors()).toBe(false);
            expect(unit.getErrors()).toEqual([]);
        });
        it('should add source files', () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('test.blend', 'module Test\n');
            const sourceFiles = unit.getSourceFiles();
            expect(sourceFiles.size).toBe(1);
            expect(sourceFiles.has('test.blend')).toBe(true);
            const sourceFile = unit.getSourceFile('test.blend');
            expect(sourceFile).not.toBeNull();
            expect(sourceFile?.path).toBe('test.blend');
            expect(sourceFile?.content).toBe('module Test\n');
        });
        it('should normalize file paths', () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('path\\to\\test.blend', 'module Test\n');
            // Should normalize backslashes to forward slashes
            expect(unit.getSourceFile('path/to/test.blend')).not.toBeNull();
            expect(unit.getSourceFile('path\\to\\test.blend')).not.toBeNull();
        });
        it('should track file status', () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('test.blend', 'module Test\n');
            expect(unit.getFileStatus('test.blend')).toBe('pending');
        });
    });
    describe('Static factory methods', () => {
        it('should create from project config', () => {
            const config = createDefaultProjectConfig('TestProject');
            config.sourceFiles = ['main.blend', 'player.blend'];
            const result = CompilationUnit.fromConfig(config);
            expect(result.success).toBe(true);
            if (result.success) {
                const unit = result.data;
                expect(unit.getSourceFiles().size).toBe(2);
                expect(unit.getSourceFile('main.blend')).not.toBeNull();
                expect(unit.getSourceFile('player.blend')).not.toBeNull();
            }
        });
        it('should validate file extensions from config', () => {
            const config = createDefaultProjectConfig('TestProject');
            config.sourceFiles = ['main.blend', 'player.blend']; // Valid extensions
            const result = CompilationUnit.fromConfig(config);
            expect(result.success).toBe(true);
        });
        it('should reject invalid file extensions', async () => {
            const result = await CompilationUnit.fromFiles(['test.txt', 'invalid.js']);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors).toHaveLength(2);
                expect(result.errors[0].type).toBe('ProjectError');
                expect(result.errors[0].message).toContain('not a Blend65 source file');
            }
        });
        it('should accept valid file extensions', async () => {
            const result = await CompilationUnit.fromFiles(['main.blend', 'player.bl65']);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.getSourceFiles().size).toBe(2);
            }
        });
    });
    describe('Lexing operations', () => {
        it('should lex simple valid content', async () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('test.blend', 'module Test\n');
            const result = await unit.lexAllFiles();
            expect(result.success).toBe(true);
            expect(unit.getFileStatus('test.blend')).toBe('lexed');
            const sourceFile = unit.getSourceFile('test.blend');
            expect(sourceFile?.tokens).not.toBeNull();
            expect(sourceFile?.tokens?.length).toBeGreaterThan(0);
        });
        it('should handle lexing errors gracefully', async () => {
            const unit = new CompilationUnit();
            // Add content that might cause lexing issues
            unit.addSourceFile('test.blend', 'module Test\n"unterminated string');
            const result = await unit.lexAllFiles();
            expect(result.success).toBe(false);
            expect(unit.getFileStatus('test.blend')).toBe('error');
            expect(unit.hasErrors()).toBe(true);
            const errors = unit.getErrors();
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].type).toBe('LexError');
        });
        it('should lex multiple files', async () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('main.blend', 'module Main\n');
            unit.addSourceFile('player.blend', 'module Player\n');
            const result = await unit.lexAllFiles();
            expect(result.success).toBe(true);
            expect(unit.getFileStatus('main.blend')).toBe('lexed');
            expect(unit.getFileStatus('player.blend')).toBe('lexed');
        });
    });
    describe('Parsing operations', () => {
        it('should parse lexed content', async () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('test.blend', 'module Test\n');
            // First lex the file
            await unit.lexAllFiles();
            expect(unit.getFileStatus('test.blend')).toBe('lexed');
            // Then parse
            const result = await unit.parseAllFiles();
            expect(result.success).toBe(true);
            expect(unit.getFileStatus('test.blend')).toBe('parsed');
            const sourceFile = unit.getSourceFile('test.blend');
            expect(sourceFile?.program).not.toBeNull();
        });
        it('should skip parsing files that failed lexing', async () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('good.blend', 'module Good\n');
            unit.addSourceFile('bad.blend', '"unterminated');
            // Lex all files (one will fail)
            await unit.lexAllFiles();
            expect(unit.getFileStatus('good.blend')).toBe('lexed');
            expect(unit.getFileStatus('bad.blend')).toBe('error');
            // Parse all lexed files
            const result = await unit.parseAllFiles();
            // Should succeed for the good file, skip the bad one
            expect(result.success).toBe(true);
            expect(unit.getFileStatus('good.blend')).toBe('parsed');
            expect(unit.getFileStatus('bad.blend')).toBe('error'); // Still error, not parsed
        });
    });
    describe('Combined operations', () => {
        it('should lex and parse all files in sequence', async () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('main.blend', 'module Main\n');
            unit.addSourceFile('player.blend', 'module Player\n');
            const result = await unit.lexAndParseAll();
            expect(result.success).toBe(true);
            expect(unit.getFileStatus('main.blend')).toBe('parsed');
            expect(unit.getFileStatus('player.blend')).toBe('parsed');
            const programs = unit.getAllPrograms();
            expect(programs).toHaveLength(2);
        });
        it('should stop on lexing errors', async () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('good.blend', 'module Good\n');
            unit.addSourceFile('bad.blend', '"unterminated');
            const result = await unit.lexAndParseAll();
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors.some(e => e.type === 'LexError')).toBe(true);
            }
        });
    });
    describe('Statistics and debugging', () => {
        it('should provide compilation statistics', async () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('test1.blend', 'module Test1\nfunction main(): void\nend function\n');
            unit.addSourceFile('test2.blend', 'module Test2\n');
            await unit.lexAndParseAll();
            const stats = unit.getStatistics();
            expect(stats.fileCount).toBe(2);
            expect(stats.totalLines).toBeGreaterThan(0);
            expect(stats.totalTokens).toBeGreaterThan(0);
            expect(stats.lexedFiles).toBe(2);
            expect(stats.parsedFiles).toBe(2);
            expect(stats.errorCount).toBe(0);
        });
        it('should provide string representation', () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('test.blend', 'module Test\n');
            const str = unit.toString();
            expect(str).toContain('CompilationUnit[1 files]');
            expect(str).toContain('test.blend: pending');
        });
        it('should reset to initial state', async () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('test.blend', 'module Test\n');
            await unit.lexAndParseAll();
            expect(unit.getFileStatus('test.blend')).toBe('parsed');
            unit.reset();
            expect(unit.getFileStatus('test.blend')).toBe('pending');
            expect(unit.getAllPrograms()).toEqual([]);
            const sourceFile = unit.getSourceFile('test.blend');
            expect(sourceFile?.tokens).toBeNull();
            expect(sourceFile?.program).toBeNull();
        });
        it('should remove source files', () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('test1.blend', 'module Test1\n');
            unit.addSourceFile('test2.blend', 'module Test2\n');
            expect(unit.getSourceFiles().size).toBe(2);
            const removed = unit.removeSourceFile('test1.blend');
            expect(removed).toBe(true);
            expect(unit.getSourceFiles().size).toBe(1);
            expect(unit.getSourceFile('test1.blend')).toBeNull();
            expect(unit.getSourceFile('test2.blend')).not.toBeNull();
        });
        it('should clear all source files', () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('test1.blend', 'module Test1\n');
            unit.addSourceFile('test2.blend', 'module Test2\n');
            expect(unit.getSourceFiles().size).toBe(2);
            unit.clear();
            expect(unit.getSourceFiles().size).toBe(0);
            expect(unit.hasErrors()).toBe(false);
        });
    });
    describe('Error handling', () => {
        it('should aggregate errors across files', async () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('bad1.blend', '"unterminated1');
            unit.addSourceFile('bad2.blend', '"unterminated2');
            await unit.lexAndParseAll();
            expect(unit.hasErrors()).toBe(true);
            const errors = unit.getErrors();
            expect(errors.length).toBeGreaterThanOrEqual(2);
            expect(errors.some(e => e.filePath.includes('bad1.blend'))).toBe(true);
            expect(errors.some(e => e.filePath.includes('bad2.blend'))).toBe(true);
        });
        it('should maintain file-specific error tracking', async () => {
            const unit = new CompilationUnit();
            unit.addSourceFile('good.blend', 'module Good\n');
            unit.addSourceFile('bad.blend', '"unterminated');
            await unit.lexAndParseAll();
            const goodFile = unit.getSourceFile('good.blend');
            const badFile = unit.getSourceFile('bad.blend');
            expect(goodFile?.errors).toHaveLength(0);
            expect(badFile?.errors.length).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=compilation-unit.test.js.map