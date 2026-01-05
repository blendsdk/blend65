/**
 * Type definitions for emulator testing system
 */
export interface ToolPaths {
    vice64: string;
    acme: string;
}
export interface AssemblyOptions {
    inputFile: string;
    outputFile: string;
    format?: 'cbm' | 'plain';
}
export interface AssemblyResult {
    success: boolean;
    outputFile: string;
    errors?: string[];
    warnings?: string[];
}
export interface ViceOptions {
    programFile: string;
    headless?: boolean;
    exitOnIdle?: boolean;
    timeoutMs?: number;
    memoryDumpAddresses?: number[];
}
export interface MemoryDump {
    address: number;
    value: number;
}
export interface ViceResult {
    success: boolean;
    exitCode: number;
    executionTimeMs: number;
    cycleCount?: number;
    memoryDumps?: MemoryDump[];
    output?: string;
    errors?: string[];
}
export interface EmulatorTestCase {
    name: string;
    assemblyFile: string;
    expectedMemoryStates?: Array<{
        address: number;
        expectedValue: number;
    }>;
    expectedCycles?: number;
    toleranceCycles?: number;
    timeoutMs?: number;
}
export interface EmulatorTestResult {
    testCase: EmulatorTestCase;
    success: boolean;
    assemblyResult: AssemblyResult;
    viceResult: ViceResult;
    memoryValidation?: {
        passed: boolean;
        failures: Array<{
            address: number;
            expected: number;
            actual: number;
        }>;
    };
    cycleValidation?: {
        passed: boolean;
        expected?: number;
        actual?: number;
        tolerance?: number;
    };
    errors: string[];
}
export interface EmulatorTestSuite {
    name: string;
    testCases: EmulatorTestCase[];
}
export interface EmulatorTestSuiteResult {
    suite: EmulatorTestSuite;
    results: EmulatorTestResult[];
    summary: {
        total: number;
        passed: number;
        failed: number;
        duration: number;
    };
}
//# sourceMappingURL=types.d.ts.map