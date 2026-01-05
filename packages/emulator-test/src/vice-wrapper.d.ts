import type { ViceOptions, ViceResult } from './types.js';
export declare class ViceEmulator {
    private vicePath;
    constructor(vicePath: string);
    /**
     * Run a program in VICE emulator with automated testing
     * @param options VICE execution options
     * @returns Execution result with performance and memory data
     */
    runProgram(options: ViceOptions): Promise<ViceResult>;
    /**
     * Build VICE command line arguments
     * @param options Vice execution configuration
     * @returns Array of command line arguments
     */
    private buildViceArgs;
    /**
     * Execute VICE with given arguments
     * @param args Command line arguments
     * @param timeoutMs Execution timeout in milliseconds
     * @returns Execution result
     */
    private executeVice;
    /**
     * Parse memory dumps from VICE output
     * @param output VICE stdout output
     * @param addresses Requested memory addresses
     * @returns Array of memory dumps
     */
    private parseMemoryDumps;
    /**
     * Parse cycle count from VICE output
     * @param output VICE stdout output
     * @returns Cycle count or undefined if not found
     */
    private parseCycleCount;
    /**
     * Load and run a program with memory validation
     * @param programFile Program file to load
     * @param expectedMemory Expected memory states for validation
     * @returns Test result with memory validation
     */
    validateMemoryStates(programFile: string, expectedMemory: Array<{
        address: number;
        expectedValue: number;
    }>): Promise<{
        success: boolean;
        memoryFailures: Array<{
            address: number;
            expected: number;
            actual: number;
        }>;
        viceResult: ViceResult;
    }>;
    /**
     * Get VICE version information
     * @returns Version string or error message
     */
    getVersion(): Promise<string>;
}
//# sourceMappingURL=vice-wrapper.d.ts.map