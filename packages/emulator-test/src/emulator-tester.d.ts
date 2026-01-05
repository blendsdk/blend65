import { AcmeAssembler } from './acme-wrapper.js';
import { ViceEmulator } from './vice-wrapper.js';
import type { EmulatorTestCase, EmulatorTestResult, EmulatorTestSuite, EmulatorTestSuiteResult } from './types.js';
export declare class EmulatorTester {
    private acme;
    private vice;
    constructor(acme: AcmeAssembler, vice: ViceEmulator);
    /**
     * Create EmulatorTester with auto-configured tools
     * @returns Configured EmulatorTester instance
     */
    static create(): Promise<EmulatorTester>;
    /**
     * Run a single test case (assemble + execute + validate)
     * @param testCase Test case to execute
     * @returns Complete test result
     */
    runTestCase(testCase: EmulatorTestCase): Promise<EmulatorTestResult>;
    /**
     * Run a complete test suite
     * @param testSuite Test suite to execute
     * @returns Complete suite results
     */
    runTestSuite(testSuite: EmulatorTestSuite): Promise<EmulatorTestSuiteResult>;
    /**
     * Validate memory states against expected values
     * @param testCase Test case with expected memory states
     * @param viceResult VICE execution result
     * @returns Memory validation result
     */
    private validateMemoryStates;
    /**
     * Validate cycle count against expected value
     * @param testCase Test case with expected cycle count
     * @param viceResult VICE execution result
     * @returns Cycle validation result
     */
    private validateCycleCount;
    /**
     * Collect all errors from test execution
     * @param assemblyResult Assembly result
     * @param viceResult VICE result
     * @param memoryValidation Memory validation result
     * @param cycleValidation Cycle validation result
     * @returns Array of error messages
     */
    private collectErrors;
    /**
     * Generate output file path for compiled program
     * @param assemblyFile Input assembly file path
     * @returns Output .prg file path
     */
    private generateOutputPath;
    /**
     * Test a simple assembly program (convenience method)
     * @param assemblyFile Path to assembly file
     * @param expectedMemory Optional expected memory states
     * @returns Test result
     */
    testAssemblyProgram(assemblyFile: string, expectedMemory?: Array<{
        address: number;
        expectedValue: number;
    }>): Promise<EmulatorTestResult>;
    /**
     * Get tool versions for debugging
     * @returns Tool version information
     */
    getToolVersions(): Promise<{
        acme: string;
        vice: string;
    }>;
}
//# sourceMappingURL=emulator-tester.d.ts.map