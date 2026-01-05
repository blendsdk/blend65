/**
 * Tool configuration for VICE and ACME from environment variables
 */
import { config } from 'dotenv';
// Load environment variables from project root
config({ path: '../../.env' });
/**
 * Get tool paths from environment variables
 * @throws Error if required paths are not configured
 */
export function getToolPaths() {
    const vice64 = process.env.VICE64_PATH;
    const acme = process.env.ACME_PATH;
    if (!vice64) {
        throw new Error('VICE64_PATH not configured in .env file. ' +
            'Please add: VICE64_PATH=/path/to/vice64');
    }
    if (!acme) {
        throw new Error('ACME_PATH not configured in .env file. ' +
            'Please add: ACME_PATH=/path/to/acme');
    }
    return { vice64, acme };
}
/**
 * Validate that configured tool paths exist and are executable
 * @param toolPaths Tool paths to validate
 * @returns Promise<boolean> true if all tools are available
 */
export async function validateToolPaths(toolPaths) {
    const { access, constants } = await import('fs/promises');
    try {
        // Check VICE64 file exists and is executable
        await access(toolPaths.vice64, constants.F_OK | constants.X_OK);
        // Check ACME file exists and is executable
        await access(toolPaths.acme, constants.F_OK | constants.X_OK);
        return true;
    }
    catch (error) {
        console.error('Tool validation failed:', error.message);
        return false;
    }
}
/**
 * Get validated tool paths - throws if tools are not available
 */
export async function getValidatedToolPaths() {
    const toolPaths = getToolPaths();
    const isValid = await validateToolPaths(toolPaths);
    if (!isValid) {
        throw new Error('Required tools are not available. Please ensure VICE and ACME are properly installed and configured in .env');
    }
    return toolPaths;
}
//# sourceMappingURL=tool-config.js.map