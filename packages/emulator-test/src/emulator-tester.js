/**
 * Main emulator testing orchestrator combining ACME and VICE for end-to-end validation
 */
import { join, dirname, basename } from 'path';
import { AcmeAssembler } from './acme-wrapper.js';
import { ViceEmulator } from './vice-wrapper.js';
import { getValidatedToolPaths } from './tool-config.js';
export class EmulatorTester {
    acme;
    vice;
    constructor(acme, vice) {
        this.acme = acme;
        this.vice = vice;
    }
    /**
     * Create EmulatorTester with auto-configured tools
     * @returns Configured EmulatorTester instance
     */
    static async create() {
        const toolPaths = await getValidatedToolPaths();
        const acme = new AcmeAssembler(toolPaths.acme);
        const vice = new ViceEmulator(toolPaths.vice64);
        return new EmulatorTester(acme, vice);
    }
    /**
     * Run a single test case (assemble + execute + validate)
     * @param testCase Test case to execute
     * @returns Complete test result
     */
    async runTestCase(testCase) {
        const errors = [];
        try {
            // Generate output file path
            const outputFile = this.generateOutputPath(testCase.assemblyFile);
            // Step 1: Assemble the program
            const assemblyResult = await this.acme.assemble({
                inputFile: testCase.assemblyFile,
                outputFile,
                format: 'cbm'
            });
            if (!assemblyResult.success) {
                return {
                    testCase,
                    success: false,
                    assemblyResult,
                    viceResult: {
                        success: false,
                        exitCode: -1,
                        executionTimeMs: 0,
                        errors: ['Assembly failed, skipping execution']
                    },
                    errors: assemblyResult.errors || ['Assembly failed']
                };
            }
            // Step 2: Execute in VICE
            const viceOptions = {
                programFile: outputFile,
                timeoutMs: testCase.timeoutMs || 10000,
                memoryDumpAddresses: testCase.expectedMemoryStates?.map(m => m.address) || []
            };
            const viceResult = await this.vice.runProgram(viceOptions);
            // Step 3: Validate results
            const memoryValidation = this.validateMemoryStates(testCase, viceResult);
            const cycleValidation = this.validateCycleCount(testCase, viceResult);
            const success = viceResult.success &&
                memoryValidation.passed &&
                cycleValidation.passed;
            return {
                testCase,
                success,
                assemblyResult,
                viceResult,
                memoryValidation,
                cycleValidation,
                errors: success ? [] : this.collectErrors(assemblyResult, viceResult, memoryValidation, cycleValidation)
            };
        }
        catch (error) {
            errors.push(`Test execution failed: ${error.message}`);
            return {
                testCase,
                success: false,
                assemblyResult: { success: false, outputFile: '', errors: [errors[0]] },
                viceResult: { success: false, exitCode: -1, executionTimeMs: 0, errors },
                errors
            };
        }
    }
    /**
     * Run a complete test suite
     * @param testSuite Test suite to execute
     * @returns Complete suite results
     */
    async runTestSuite(testSuite) {
        const startTime = Date.now();
        const results = [];
        console.log(`Running test suite: ${testSuite.name}`);
        for (const testCase of testSuite.testCases) {
            console.log(`  Running test: ${testCase.name}`);
            const result = await this.runTestCase(testCase);
            results.push(result);
            if (result.success) {
                console.log(`    ✅ PASSED`);
            }
            else {
                console.log(`    ❌ FAILED: ${result.errors.join(', ')}`);
            }
        }
        const duration = Date.now() - startTime;
        const passed = results.filter(r => r.success).length;
        const failed = results.length - passed;
        return {
            suite: testSuite,
            results,
            summary: {
                total: results.length,
                passed,
                failed,
                duration
            }
        };
    }
    /**
     * Validate memory states against expected values
     * @param testCase Test case with expected memory states
     * @param viceResult VICE execution result
     * @returns Memory validation result
     */
    validateMemoryStates(testCase, viceResult) {
        const failures = [];
        if (!testCase.expectedMemoryStates || !viceResult.memoryDumps) {
            return { passed: true, failures };
        }
        for (const expected of testCase.expectedMemoryStates) {
            const actual = viceResult.memoryDumps.find((d) => d.address === expected.address);
            if (!actual) {
                failures.push({
                    address: expected.address,
                    expected: expected.expectedValue,
                    actual: -1 // Memory not read
                });
            }
            else if (actual.value !== expected.expectedValue) {
                failures.push({
                    address: expected.address,
                    expected: expected.expectedValue,
                    actual: actual.value
                });
            }
        }
        return { passed: failures.length === 0, failures };
    }
    /**
     * Validate cycle count against expected value
     * @param testCase Test case with expected cycle count
     * @param viceResult VICE execution result
     * @returns Cycle validation result
     */
    validateCycleCount(testCase, viceResult) {
        if (!testCase.expectedCycles) {
            return { passed: true };
        }
        const tolerance = testCase.toleranceCycles || 0;
        const actual = viceResult.cycleCount || 0;
        const expected = testCase.expectedCycles;
        const passed = Math.abs(actual - expected) <= tolerance;
        return { passed, expected, actual, tolerance };
    }
    /**
     * Collect all errors from test execution
     * @param assemblyResult Assembly result
     * @param viceResult VICE result
     * @param memoryValidation Memory validation result
     * @param cycleValidation Cycle validation result
     * @returns Array of error messages
     */
    collectErrors(assemblyResult, viceResult, memoryValidation, cycleValidation) {
        const errors = [];
        if (assemblyResult.errors) {
            errors.push(...assemblyResult.errors);
        }
        if (viceResult.errors) {
            errors.push(...viceResult.errors);
        }
        if (!memoryValidation.passed) {
            errors.push(`Memory validation failed: ${memoryValidation.failures.length} mismatches`);
        }
        if (!cycleValidation.passed) {
            errors.push(`Cycle count validation failed: expected ${cycleValidation.expected}, ` +
                `got ${cycleValidation.actual} (tolerance: ${cycleValidation.tolerance})`);
        }
        return errors;
    }
    /**
     * Generate output file path for compiled program
     * @param assemblyFile Input assembly file path
     * @returns Output .prg file path
     */
    generateOutputPath(assemblyFile) {
        const dir = dirname(assemblyFile);
        const baseName = basename(assemblyFile, '.asm');
        return join(dir, `${baseName}.prg`);
    }
    /**
     * Test a simple assembly program (convenience method)
     * @param assemblyFile Path to assembly file
     * @param expectedMemory Optional expected memory states
     * @returns Test result
     */
    async testAssemblyProgram(assemblyFile, expectedMemory) {
        const testCase = {
            name: basename(assemblyFile),
            assemblyFile,
            expectedMemoryStates: expectedMemory
        };
        return this.runTestCase(testCase);
    }
    /**
     * Get tool versions for debugging
     * @returns Tool version information
     */
    async getToolVersions() {
        const [acmeVersion, viceVersion] = await Promise.all([
            this.acme.getVersion(),
            this.vice.getVersion()
        ]);
        return { acme: acmeVersion, vice: viceVersion };
    }
}
//# sourceMappingURL=emulator-tester.js.map