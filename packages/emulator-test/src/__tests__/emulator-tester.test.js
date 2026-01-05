/**
 * Tests for EmulatorTester main orchestrator
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EmulatorTester } from '../emulator-tester.js';
import { AcmeAssembler } from '../acme-wrapper.js';
import { ViceEmulator } from '../vice-wrapper.js';
// Mock the wrapper classes
vi.mock('../acme-wrapper.js', () => ({
    AcmeAssembler: vi.fn()
}));
vi.mock('../vice-wrapper.js', () => ({
    ViceEmulator: vi.fn()
}));
vi.mock('../tool-config.js', () => ({
    getValidatedToolPaths: vi.fn()
}));
describe('EmulatorTester', () => {
    let emulatorTester;
    let mockAcme;
    let mockVice;
    let mockGetValidatedToolPaths;
    beforeEach(async () => {
        vi.clearAllMocks();
        // Setup mock implementations
        mockAcme = {
            assemble: vi.fn(),
            getVersion: vi.fn()
        };
        mockVice = {
            runProgram: vi.fn(),
            getVersion: vi.fn()
        };
        // Mock constructors
        vi.mocked(AcmeAssembler).mockImplementation(() => mockAcme);
        vi.mocked(ViceEmulator).mockImplementation(() => mockVice);
        // Mock tool config
        const { getValidatedToolPaths } = await import('../tool-config.js');
        mockGetValidatedToolPaths = vi.mocked(getValidatedToolPaths);
        mockGetValidatedToolPaths.mockResolvedValue({
            acme: '/test/acme',
            vice64: '/test/vice64'
        });
        emulatorTester = new EmulatorTester(mockAcme, mockVice);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe('create', () => {
        it('should create EmulatorTester with validated tool paths', async () => {
            const tester = await EmulatorTester.create();
            expect(mockGetValidatedToolPaths).toHaveBeenCalled();
            expect(AcmeAssembler).toHaveBeenCalledWith('/test/acme');
            expect(ViceEmulator).toHaveBeenCalledWith('/test/vice64');
            expect(tester).toBeInstanceOf(EmulatorTester);
        });
    });
    describe('runTestCase', () => {
        it('should successfully run a test case', async () => {
            const testCase = {
                name: 'Simple Test',
                assemblyFile: '/test/simple.asm',
                expectedMemoryStates: [
                    { address: 0x0400, expectedValue: 0x42 }
                ]
            };
            // Mock successful assembly
            mockAcme.assemble.mockResolvedValue({
                success: true,
                outputFile: '/test/simple.prg'
            });
            // Mock successful VICE execution
            mockVice.runProgram.mockResolvedValue({
                success: true,
                exitCode: 0,
                executionTimeMs: 100,
                memoryDumps: [
                    { address: 0x0400, value: 0x42 }
                ]
            });
            const result = await emulatorTester.runTestCase(testCase);
            expect(result.success).toBe(true);
            expect(result.testCase).toBe(testCase);
            expect(result.assemblyResult.success).toBe(true);
            expect(result.viceResult.success).toBe(true);
            expect(result.memoryValidation?.passed).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should handle assembly failures', async () => {
            const testCase = {
                name: 'Failed Assembly Test',
                assemblyFile: '/test/broken.asm'
            };
            // Mock assembly failure
            mockAcme.assemble.mockResolvedValue({
                success: false,
                outputFile: '/test/broken.prg',
                errors: ['Syntax error in line 5']
            });
            const result = await emulatorTester.runTestCase(testCase);
            expect(result.success).toBe(false);
            expect(result.assemblyResult.success).toBe(false);
            expect(result.viceResult.success).toBe(false);
            expect(result.errors).toContain('Syntax error in line 5');
        });
        it('should handle VICE execution failures', async () => {
            const testCase = {
                name: 'VICE Failure Test',
                assemblyFile: '/test/crash.asm'
            };
            // Mock successful assembly
            mockAcme.assemble.mockResolvedValue({
                success: true,
                outputFile: '/test/crash.prg'
            });
            // Mock VICE failure
            mockVice.runProgram.mockResolvedValue({
                success: false,
                exitCode: 1,
                executionTimeMs: 50,
                errors: ['Program crashed']
            });
            const result = await emulatorTester.runTestCase(testCase);
            expect(result.success).toBe(false);
            expect(result.assemblyResult.success).toBe(true);
            expect(result.viceResult.success).toBe(false);
            expect(result.errors).toContain('Program crashed');
        });
        it('should validate memory states', async () => {
            const testCase = {
                name: 'Memory Validation Test',
                assemblyFile: '/test/memory.asm',
                expectedMemoryStates: [
                    { address: 0x0400, expectedValue: 0x42 },
                    { address: 0x0401, expectedValue: 0xFF }
                ]
            };
            // Mock successful assembly
            mockAcme.assemble.mockResolvedValue({
                success: true,
                outputFile: '/test/memory.prg'
            });
            // Mock VICE execution with wrong memory value
            mockVice.runProgram.mockResolvedValue({
                success: true,
                exitCode: 0,
                executionTimeMs: 100,
                memoryDumps: [
                    { address: 0x0400, value: 0x42 }, // Correct
                    { address: 0x0401, value: 0x00 } // Wrong - expected 0xFF
                ]
            });
            const result = await emulatorTester.runTestCase(testCase);
            expect(result.success).toBe(false);
            expect(result.memoryValidation?.passed).toBe(false);
            expect(result.memoryValidation?.failures).toHaveLength(1);
            expect(result.memoryValidation?.failures[0]).toEqual({
                address: 0x0401,
                expected: 0xFF,
                actual: 0x00
            });
        });
        it('should validate cycle counts', async () => {
            const testCase = {
                name: 'Cycle Count Test',
                assemblyFile: '/test/cycles.asm',
                expectedCycles: 1000,
                toleranceCycles: 10
            };
            // Mock successful assembly
            mockAcme.assemble.mockResolvedValue({
                success: true,
                outputFile: '/test/cycles.prg'
            });
            // Mock VICE execution with incorrect cycle count
            mockVice.runProgram.mockResolvedValue({
                success: true,
                exitCode: 0,
                executionTimeMs: 100,
                cycleCount: 1050 // Outside tolerance
            });
            const result = await emulatorTester.runTestCase(testCase);
            expect(result.success).toBe(false);
            expect(result.cycleValidation?.passed).toBe(false);
            expect(result.cycleValidation?.expected).toBe(1000);
            expect(result.cycleValidation?.actual).toBe(1050);
        });
    });
    describe('runTestSuite', () => {
        it('should run multiple test cases in a suite', async () => {
            const testSuite = {
                name: 'Test Suite',
                testCases: [
                    {
                        name: 'Test 1',
                        assemblyFile: '/test/test1.asm'
                    },
                    {
                        name: 'Test 2',
                        assemblyFile: '/test/test2.asm'
                    }
                ]
            };
            // Mock successful assembly and execution for both tests
            mockAcme.assemble.mockResolvedValue({
                success: true,
                outputFile: '/test/output.prg'
            });
            mockVice.runProgram.mockResolvedValue({
                success: true,
                exitCode: 0,
                executionTimeMs: 100
            });
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const result = await emulatorTester.runTestSuite(testSuite);
            expect(result.suite).toBe(testSuite);
            expect(result.results).toHaveLength(2);
            expect(result.summary.total).toBe(2);
            expect(result.summary.passed).toBe(2);
            expect(result.summary.failed).toBe(0);
            // Check console output
            expect(consoleSpy).toHaveBeenCalledWith('Running test suite: Test Suite');
            expect(consoleSpy).toHaveBeenCalledWith('  Running test: Test 1');
            expect(consoleSpy).toHaveBeenCalledWith('    ✅ PASSED');
            consoleSpy.mockRestore();
        });
    });
    describe('testAssemblyProgram', () => {
        it('should test a simple assembly program', async () => {
            const assemblyFile = '/test/program.asm';
            const expectedMemory = [
                { address: 0x0400, expectedValue: 0x42 }
            ];
            // Mock successful assembly
            mockAcme.assemble.mockResolvedValue({
                success: true,
                outputFile: '/test/program.prg'
            });
            // Mock successful VICE execution
            mockVice.runProgram.mockResolvedValue({
                success: true,
                exitCode: 0,
                executionTimeMs: 100,
                memoryDumps: [
                    { address: 0x0400, value: 0x42 }
                ]
            });
            const result = await emulatorTester.testAssemblyProgram(assemblyFile, expectedMemory);
            expect(result.success).toBe(true);
            expect(result.testCase.name).toBe('program.asm');
            expect(result.testCase.assemblyFile).toBe(assemblyFile);
            expect(result.testCase.expectedMemoryStates).toBe(expectedMemory);
        });
    });
    describe('getToolVersions', () => {
        it('should return versions from both tools', async () => {
            mockAcme.getVersion.mockResolvedValue('ACME v0.97');
            mockVice.getVersion.mockResolvedValue('VICE 3.7');
            const versions = await emulatorTester.getToolVersions();
            expect(versions).toEqual({
                acme: 'ACME v0.97',
                vice: 'VICE 3.7'
            });
        });
    });
    describe('error handling', () => {
        it('should handle exceptions during test execution', async () => {
            const testCase = {
                name: 'Exception Test',
                assemblyFile: '/test/exception.asm'
            };
            // Mock assembly throwing exception
            mockAcme.assemble.mockRejectedValue(new Error('Unexpected error'));
            const result = await emulatorTester.runTestCase(testCase);
            expect(result.success).toBe(false);
            expect(result.errors).toContain('Test execution failed: Unexpected error');
        });
    });
});
//# sourceMappingURL=emulator-tester.test.js.map