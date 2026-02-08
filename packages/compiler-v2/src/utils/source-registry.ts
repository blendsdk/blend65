/**
 * Source Text Registry for Rich Diagnostic Output
 *
 * Stores original source text during compilation to enable
 * rich error/warning output with source code snippets.
 *
 * @module utils/source-registry
 */

/**
 * Global registry for source text storage
 *
 * Enables rich diagnostic output by storing original source text
 * that can be retrieved during error formatting to show code snippets.
 *
 * **Design:**
 * - Singleton pattern for global access across compiler phases
 * - Stores source text by file path (key)
 * - Provides line extraction for snippet generation
 */
export class SourceRegistry {
  /** Singleton instance */
  protected static instance: SourceRegistry | null = null;

  /** Map of file path to source text */
  protected sources: Map<string, string> = new Map();

  /** Cache of split lines per file for efficient line access */
  protected lineCache: Map<string, string[]> = new Map();

  /** Protected constructor for singleton pattern */
  protected constructor() {}

  /**
   * Gets the singleton instance
   *
   * @returns The global SourceRegistry instance
   */
  public static getInstance(): SourceRegistry {
    if (!SourceRegistry.instance) {
      SourceRegistry.instance = new SourceRegistry();
    }
    return SourceRegistry.instance;
  }

  /**
   * Resets the singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (SourceRegistry.instance) {
      SourceRegistry.instance.clear();
    }
    SourceRegistry.instance = null;
  }

  /**
   * Registers source text for a file
   *
   * @param filePath - Path to the source file (used as key)
   * @param sourceText - Complete source text content
   */
  public register(filePath: string, sourceText: string): void {
    this.sources.set(filePath, sourceText);
    this.lineCache.delete(filePath);
  }

  /**
   * Gets the complete source text for a file
   *
   * @param filePath - Path to the source file
   * @returns Source text or undefined if not registered
   */
  public get(filePath: string): string | undefined {
    return this.sources.get(filePath);
  }

  /**
   * Checks if source text is registered for a file
   *
   * @param filePath - Path to the source file
   * @returns True if source text is available
   */
  public has(filePath: string): boolean {
    return this.sources.has(filePath);
  }

  /**
   * Gets a specific line from source text (1-indexed)
   *
   * @param filePath - Path to the source file
   * @param lineNumber - Line number (1-indexed)
   * @returns The line text (without newline) or undefined
   */
  public getLine(filePath: string, lineNumber: number): string | undefined {
    if (lineNumber < 1) {
      return undefined;
    }

    let lines = this.lineCache.get(filePath);
    if (!lines) {
      const source = this.sources.get(filePath);
      if (!source) {
        return undefined;
      }
      lines = source.split('\n');
      this.lineCache.set(filePath, lines);
    }

    const index = lineNumber - 1;
    if (index >= lines.length) {
      return undefined;
    }

    return lines[index];
  }

  /**
   * Gets multiple consecutive lines from source text
   *
   * @param filePath - Path to the source file
   * @param startLine - Starting line number (1-indexed, inclusive)
   * @param endLine - Ending line number (1-indexed, inclusive)
   * @returns Array of line texts or empty array
   */
  public getLines(filePath: string, startLine: number, endLine: number): string[] {
    const result: string[] = [];

    for (let line = startLine; line <= endLine; line++) {
      const lineText = this.getLine(filePath, line);
      if (lineText !== undefined) {
        result.push(lineText);
      }
    }

    return result;
  }

  /**
   * Gets the total number of lines in a source file
   *
   * @param filePath - Path to the source file
   * @returns Number of lines or 0 if file not registered
   */
  public getLineCount(filePath: string): number {
    this.getLine(filePath, 1);
    const lines = this.lineCache.get(filePath);
    return lines?.length ?? 0;
  }

  /**
   * Gets all registered file paths
   *
   * @returns Array of registered file paths
   */
  public getFilePaths(): string[] {
    return Array.from(this.sources.keys());
  }

  /**
   * Clears all stored source texts
   */
  public clear(): void {
    this.sources.clear();
    this.lineCache.clear();
  }
}
