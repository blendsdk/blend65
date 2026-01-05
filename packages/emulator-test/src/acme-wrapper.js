/**
 * ACME Cross-Assembler wrapper for automated assembly compilation
 */
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { dirname } from 'path';
export class AcmeAssembler {
    acmePath;
    constructor(acmePath) {
        this.acmePath = acmePath;
    }
    /**
     * Assemble a 6502 assembly file to executable program
     * @param options Assembly options
     * @returns Assembly result with success/error information
     */
    async assemble(options) {
        const { inputFile, outputFile, format = 'cbm' } = options;
        try {
            // Ensure output directory exists
            await fs.mkdir(dirname(outputFile), { recursive: true });
            // Build ACME command arguments
            const args = [
                '-f', format, // Output format (cbm for .prg files)
                '-o', outputFile, // Output file
                inputFile // Input assembly file
            ];
            const result = await this.executeAcme(args);
            // Check if output file was created
            const outputExists = await this.fileExists(outputFile);
            if (result.exitCode === 0 && outputExists) {
                return {
                    success: true,
                    outputFile,
                    warnings: result.warnings.length > 0 ? result.warnings : undefined
                };
            }
            else {
                return {
                    success: false,
                    outputFile,
                    errors: result.errors.length > 0 ? result.errors : ['Assembly failed with unknown error'],
                    warnings: result.warnings.length > 0 ? result.warnings : undefined
                };
            }
        }
        catch (error) {
            return {
                success: false,
                outputFile,
                errors: [`ACME execution failed: ${error.message}`]
            };
        }
    }
    /**
     * Execute ACME with given arguments
     * @param args Command line arguments
     * @returns Execution result
     */
    async executeAcme(args) {
        return new Promise((resolve, reject) => {
            const process = spawn(this.acmePath, args);
            let stdout = '';
            let stderr = '';
            process.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            process.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            process.on('close', (code) => {
                const errors = this.parseErrors(stderr);
                const warnings = this.parseWarnings(stderr + stdout);
                resolve({
                    exitCode: code,
                    stdout,
                    stderr,
                    errors,
                    warnings
                });
            });
            process.on('error', (error) => {
                reject(new Error(`Failed to execute ACME: ${error.message}`));
            });
        });
    }
    /**
     * Parse error messages from ACME output
     * @param output ACME stderr output
     * @returns Array of error messages
     */
    parseErrors(output) {
        const errors = [];
        const lines = output.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0)
                continue;
            // ACME error patterns
            if (trimmed.includes('Error:') ||
                trimmed.includes('error:') ||
                trimmed.includes('Syntax error') ||
                trimmed.includes('Unknown mnemonic') ||
                trimmed.includes('Label not found')) {
                errors.push(trimmed);
            }
        }
        return errors;
    }
    /**
     * Parse warning messages from ACME output
     * @param output ACME stdout/stderr output
     * @returns Array of warning messages
     */
    parseWarnings(output) {
        const warnings = [];
        const lines = output.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0)
                continue;
            // ACME warning patterns
            if (trimmed.includes('Warning:') ||
                trimmed.includes('warning:')) {
                warnings.push(trimmed);
            }
        }
        return warnings;
    }
    /**
     * Check if file exists
     * @param filePath Path to check
     * @returns true if file exists
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get ACME version information
     * @returns Version string or error message
     */
    async getVersion() {
        try {
            const result = await this.executeAcme(['--version']);
            return result.stdout.trim() || result.stderr.trim() || 'Version unknown';
        }
        catch (error) {
            return `Version check failed: ${error.message}`;
        }
    }
}
//# sourceMappingURL=acme-wrapper.js.map