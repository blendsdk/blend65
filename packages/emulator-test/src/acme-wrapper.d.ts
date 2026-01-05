import type { AssemblyOptions, AssemblyResult } from './types.js';
export declare class AcmeAssembler {
    private acmePath;
    constructor(acmePath: string);
    /**
     * Assemble a 6502 assembly file to executable program
     * @param options Assembly options
     * @returns Assembly result with success/error information
     */
    assemble(options: AssemblyOptions): Promise<AssemblyResult>;
    /**
     * Execute ACME with given arguments
     * @param args Command line arguments
     * @returns Execution result
     */
    private executeAcme;
    /**
     * Parse error messages from ACME output
     * @param output ACME stderr output
     * @returns Array of error messages
     */
    private parseErrors;
    /**
     * Parse warning messages from ACME output
     * @param output ACME stdout/stderr output
     * @returns Array of warning messages
     */
    private parseWarnings;
    /**
     * Check if file exists
     * @param filePath Path to check
     * @returns true if file exists
     */
    private fileExists;
    /**
     * Get ACME version information
     * @returns Version string or error message
     */
    getVersion(): Promise<string>;
}
//# sourceMappingURL=acme-wrapper.d.ts.map