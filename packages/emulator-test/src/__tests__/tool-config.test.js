/**
 * Tests for tool configuration and validation
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getToolPaths, validateToolPaths, getValidatedToolPaths } from '../tool-config.js';
describe('Tool Configuration', () => {
    const originalEnv = process.env;
    beforeEach(() => {
        // Reset environment variables
        process.env = { ...originalEnv };
    });
    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });
    describe('getToolPaths', () => {
        it('should return tool paths from environment variables', () => {
            process.env.VICE64_PATH = '/test/vice64';
            process.env.ACME_PATH = '/test/acme';
            const result = getToolPaths();
            expect(result).toEqual({
                vice64: '/test/vice64',
                acme: '/test/acme'
            });
        });
        it('should throw error when VICE64_PATH is not configured', () => {
            delete process.env.VICE64_PATH;
            process.env.ACME_PATH = '/test/acme';
            expect(() => getToolPaths()).toThrow('VICE64_PATH not configured in .env file');
        });
        it('should throw error when ACME_PATH is not configured', () => {
            process.env.VICE64_PATH = '/test/vice64';
            delete process.env.ACME_PATH;
            expect(() => getToolPaths()).toThrow('ACME_PATH not configured in .env file');
        });
        it('should throw error when both paths are not configured', () => {
            delete process.env.VICE64_PATH;
            delete process.env.ACME_PATH;
            expect(() => getToolPaths()).toThrow('VICE64_PATH not configured in .env file');
        });
    });
    describe('validateToolPaths', () => {
        it('should return false for non-existent tool paths', async () => {
            const toolPaths = {
                vice64: '/non/existent/vice64',
                acme: '/non/existent/acme'
            };
            const result = await validateToolPaths(toolPaths);
            expect(result).toBe(false);
        });
        it('should handle validation errors gracefully', async () => {
            const toolPaths = {
                vice64: '',
                acme: ''
            };
            const result = await validateToolPaths(toolPaths);
            expect(result).toBe(false);
        });
    });
    describe('getValidatedToolPaths', () => {
        it('should throw error when tools are not available', async () => {
            process.env.VICE64_PATH = '/non/existent/vice64';
            process.env.ACME_PATH = '/non/existent/acme';
            await expect(getValidatedToolPaths()).rejects.toThrow('Required tools are not available');
        });
        it('should throw error when paths are not configured', async () => {
            delete process.env.VICE64_PATH;
            delete process.env.ACME_PATH;
            await expect(getValidatedToolPaths()).rejects.toThrow('VICE64_PATH not configured in .env file');
        });
    });
    describe('Error Messages', () => {
        it('should provide helpful error message for missing VICE64_PATH', () => {
            delete process.env.VICE64_PATH;
            process.env.ACME_PATH = '/test/acme';
            try {
                getToolPaths();
            }
            catch (error) {
                expect(error.message).toContain('VICE64_PATH not configured in .env file');
                expect(error.message).toContain('Please add: VICE64_PATH=/path/to/vice64');
            }
        });
        it('should provide helpful error message for missing ACME_PATH', () => {
            process.env.VICE64_PATH = '/test/vice64';
            delete process.env.ACME_PATH;
            try {
                getToolPaths();
            }
            catch (error) {
                expect(error.message).toContain('ACME_PATH not configured in .env file');
                expect(error.message).toContain('Please add: ACME_PATH=/path/to/acme');
            }
        });
    });
});
//# sourceMappingURL=tool-config.test.js.map