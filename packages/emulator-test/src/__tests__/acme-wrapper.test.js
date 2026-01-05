/**
 * Tests for ACME Cross-Assembler wrapper
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
// Mock child_process and fs before importing the class
vi.mock('child_process', () => ({
    spawn: vi.fn()
}));
vi.mock('fs', () => ({
    promises: {
        mkdir: vi.fn(),
        access: vi.fn()
    }
}));
// Import after mocking
const { AcmeAssembler } = await import('../acme-wrapper.js');
describe('AcmeAssembler', () => {
    let assembler;
    let mockSpawn;
    let mockMkdir;
    let mockAccess;
    beforeEach(async () => {
        vi.clearAllMocks();
        assembler = new AcmeAssembler('/test/path/acme');
        // Get mocked functions
        const { spawn } = await import('child_process');
        const { promises: fs } = await import('fs');
        mockSpawn = vi.mocked(spawn);
        mockMkdir = vi.mocked(fs.mkdir);
        mockAccess = vi.mocked(fs.access);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe('assemble', () => {
        it('should successfully assemble a program', async () => {
            const options = {
                inputFile: '/test/input.asm',
                outputFile: '/test/output.prg',
                format: 'cbm'
            };
            // Mock successful execution
            const mockProcess = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn()
            };
            mockSpawn.mockImplementation(() => {
                // Simulate immediate process completion
                setTimeout(() => {
                    const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')?.[1];
                    if (closeCallback) {
                        closeCallback(0);
                    }
                }, 0);
                return mockProcess;
            });
            mockMkdir.mockResolvedValue(undefined);
            mockAccess.mockResolvedValue(undefined);
            const result = await assembler.assemble(options);
            expect(result.success).toBe(true);
            expect(result.outputFile).toBe('/test/output.prg');
            expect(mockSpawn).toHaveBeenCalledWith('/test/path/acme', [
                '-f', 'cbm',
                '-o', '/test/output.prg',
                '/test/input.asm'
            ]);
        });
        it('should handle assembly failures', async () => {
            const options = {
                inputFile: '/test/input.asm',
                outputFile: '/test/output.prg'
            };
            const mockProcess = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn()
            };
            mockSpawn.mockImplementation(() => {
                setTimeout(() => {
                    const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')?.[1];
                    if (closeCallback) {
                        closeCallback(1);
                    }
                }, 0);
                return mockProcess;
            });
            mockMkdir.mockResolvedValue(undefined);
            mockAccess.mockRejectedValue(new Error('File not found'));
            const result = await assembler.assemble(options);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors?.[0]).toContain('Assembly failed');
        });
        it('should parse error messages from stderr', async () => {
            const options = {
                inputFile: '/test/input.asm',
                outputFile: '/test/output.prg'
            };
            const mockProcess = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn()
            };
            mockSpawn.mockImplementation(() => {
                setTimeout(() => {
                    // Simulate stderr data first
                    const stderrCallback = mockProcess.stderr.on.mock.calls.find(call => call[0] === 'data')?.[1];
                    if (stderrCallback) {
                        stderrCallback('Error: Syntax error in line 10');
                    }
                    // Then trigger close event with failure
                    const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')?.[1];
                    if (closeCallback) {
                        closeCallback(1);
                    }
                }, 0);
                return mockProcess;
            });
            mockMkdir.mockResolvedValue(undefined);
            mockAccess.mockRejectedValue(new Error('File not found'));
            const result = await assembler.assemble(options);
            expect(result.success).toBe(false);
            expect(result.errors).toContain('Error: Syntax error in line 10');
        });
        it('should parse warning messages', async () => {
            const options = {
                inputFile: '/test/input.asm',
                outputFile: '/test/output.prg'
            };
            const mockProcess = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn()
            };
            mockSpawn.mockImplementation(() => {
                setTimeout(() => {
                    // Simulate stdout data with warning first
                    const stdoutCallback = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1];
                    if (stdoutCallback) {
                        stdoutCallback('Warning: Unused label detected');
                    }
                    // Then trigger close event with success
                    const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')?.[1];
                    if (closeCallback) {
                        closeCallback(0);
                    }
                }, 0);
                return mockProcess;
            });
            mockMkdir.mockResolvedValue(undefined);
            mockAccess.mockResolvedValue(undefined);
            const result = await assembler.assemble(options);
            expect(result.success).toBe(true);
            expect(result.warnings).toContain('Warning: Unused label detected');
        });
        it('should use default format when not specified', async () => {
            const options = {
                inputFile: '/test/input.asm',
                outputFile: '/test/output.prg'
                // format not specified, should default to 'cbm'
            };
            const mockProcess = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn()
            };
            mockSpawn.mockImplementation(() => {
                setTimeout(() => {
                    const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')?.[1];
                    if (closeCallback) {
                        closeCallback(0);
                    }
                }, 0);
                return mockProcess;
            });
            mockMkdir.mockResolvedValue(undefined);
            mockAccess.mockResolvedValue(undefined);
            await assembler.assemble(options);
            expect(mockSpawn).toHaveBeenCalledWith('/test/path/acme', [
                '-f', 'cbm', // Default format
                '-o', '/test/output.prg',
                '/test/input.asm'
            ]);
        });
        it('should create output directory if it does not exist', async () => {
            const options = {
                inputFile: '/test/input.asm',
                outputFile: '/nested/dir/output.prg'
            };
            const mockProcess = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn()
            };
            mockSpawn.mockReturnValue(mockProcess);
            mockMkdir.mockResolvedValue(undefined);
            assembler.assemble(options);
            expect(mockMkdir).toHaveBeenCalledWith('/nested/dir', { recursive: true });
        });
    });
    describe('getVersion', () => {
        it('should return version from stdout', async () => {
            const mockProcess = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn()
            };
            mockSpawn.mockImplementation(() => {
                setTimeout(() => {
                    // Simulate version output first
                    const stdoutCallback = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1];
                    if (stdoutCallback) {
                        stdoutCallback('ACME Cross-Assembler v0.97');
                    }
                    // Then trigger close event
                    const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')?.[1];
                    if (closeCallback) {
                        closeCallback(0);
                    }
                }, 0);
                return mockProcess;
            });
            const version = await assembler.getVersion();
            expect(version).toBe('ACME Cross-Assembler v0.97');
            expect(mockSpawn).toHaveBeenCalledWith('/test/path/acme', ['--version']);
        });
        it('should handle version check failure', async () => {
            mockSpawn.mockImplementation(() => {
                throw new Error('Command failed');
            });
            const version = await assembler.getVersion();
            expect(version).toContain('Version check failed');
        });
    });
});
//# sourceMappingURL=acme-wrapper.test.js.map