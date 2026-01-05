import type { ToolPaths } from './types.js';
/**
 * Get tool paths from environment variables
 * @throws Error if required paths are not configured
 */
export declare function getToolPaths(): ToolPaths;
/**
 * Validate that configured tool paths exist and are executable
 * @param toolPaths Tool paths to validate
 * @returns Promise<boolean> true if all tools are available
 */
export declare function validateToolPaths(toolPaths: ToolPaths): Promise<boolean>;
/**
 * Get validated tool paths - throws if tools are not available
 */
export declare function getValidatedToolPaths(): Promise<ToolPaths>;
//# sourceMappingURL=tool-config.d.ts.map