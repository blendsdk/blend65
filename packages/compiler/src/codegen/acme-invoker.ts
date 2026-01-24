/**
 * ACME Assembler Integration
 *
 * Provides integration with the ACME cross-assembler for 6502/65C02
 * to assemble generated assembly source into binary .prg format.
 *
 * **Key Functions:**
 * - {@link invokeAcme} - Invoke ACME to assemble source
 * - {@link findAcme} - Find ACME executable in PATH
 * - {@link isAcmeAvailable} - Check if ACME is installed
 *
 * **Why ACME?**
 * ACME is a battle-tested 6502 cross-assembler that handles:
 * - Complex label arithmetic and forward references
 * - Multiple output formats (PRG, binary, etc.)
 * - Macro system and pseudo-ops
 * - Excellent error messages
 *
 * Building our own assembler would take months - ACME is the
 * industry standard for 6502 development.
 *
 * **Installation:**
 * ```bash
 * # macOS
 * brew install acme
 *
 * # Ubuntu/Debian
 * sudo apt install acme
 *
 * # Windows
 * # Download from https://sourceforge.net/projects/acme-crossass/
 * ```
 *
 * @module codegen/acme-invoker
 */

import { spawn, execSync } from 'child_process';
import { writeFile, readFile, unlink, mkdtemp, rmdir } from 'fs/promises';
import {
  existsSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  mkdtempSync,
  rmdirSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Options for ACME assembler invocation
 *
 * Controls how ACME is invoked and what outputs are generated.
 *
 * @example
 * ```typescript
 * const options: AcmeOptions = {
 *   format: 'prg',
 *   labels: true,
 *   verbose: false,
 * };
 * ```
 */
export interface AcmeOptions {
  /**
   * Path to ACME executable
   *
   * If not provided, ACME will be searched for in PATH.
   * Set this to use a specific ACME installation.
   */
  acmePath?: string;

  /**
   * Output format
   *
   * - 'prg': C64 PRG format with 2-byte load address header
   * - 'bin': Raw binary without load address header
   */
  format: 'prg' | 'bin';

  /**
   * Generate VICE label file
   *
   * When true, generates a label file in VICE monitor format
   * for debugger integration.
   */
  labels?: boolean;

  /**
   * Verbose output from ACME
   *
   * When true, captures verbose output from ACME.
   * Useful for debugging assembly issues.
   */
  verbose?: boolean;

  /**
   * Timeout in milliseconds
   *
   * Maximum time to wait for ACME to complete.
   * Default: 30000 (30 seconds)
   */
  timeout?: number;
}

/**
 * Result from ACME invocation
 *
 * Contains the assembled binary and optionally a label file.
 */
export interface AcmeResult {
  /**
   * Assembled binary data
   *
   * For 'prg' format: includes 2-byte load address header
   * For 'bin' format: raw binary without header
   */
  binary: Uint8Array;

  /**
   * VICE label file content
   *
   * Only populated if labels option was true.
   * Contains label definitions in VICE monitor format.
   */
  labels?: string;

  /**
   * ACME stdout output
   *
   * Any messages printed to stdout during assembly.
   */
  stdout: string;

  /**
   * ACME stderr output
   *
   * Any warnings or info printed to stderr.
   * Note: ACME errors cause an exception, not this field.
   */
  stderr: string;
}

/**
 * Error thrown when ACME assembly fails
 *
 * Contains detailed information about the failure including
 * ACME's error output and the source that was assembled.
 */
export class AcmeError extends Error {
  /**
   * ACME's exit code
   */
  readonly exitCode: number;

  /**
   * ACME's stdout output
   */
  readonly stdout: string;

  /**
   * ACME's stderr output (contains error messages)
   */
  readonly stderr: string;

  /**
   * The assembly source that failed
   */
  readonly source: string;

  /**
   * Create an ACME error
   *
   * @param message - Error message
   * @param exitCode - ACME's exit code
   * @param stdout - ACME's stdout output
   * @param stderr - ACME's stderr output
   * @param source - The assembly source that failed
   */
  constructor(message: string, exitCode: number, stdout: string, stderr: string, source: string) {
    super(message);
    this.name = 'AcmeError';
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
    this.source = source;
  }
}

/**
 * Error thrown when ACME is not found
 *
 * Provides installation instructions for the user's platform.
 */
export class AcmeNotFoundError extends Error {
  /**
   * Paths that were searched for ACME
   */
  readonly searchedPaths: string[];

  /**
   * Create an ACME not found error
   *
   * @param searchedPaths - Paths that were searched
   */
  constructor(searchedPaths: string[]) {
    super(
      'ACME assembler not found. Install ACME to generate binary output.\n\n' +
        'Installation instructions:\n' +
        '  macOS:   brew install acme\n' +
        '  Ubuntu:  sudo apt install acme\n' +
        '  Windows: Download from https://sourceforge.net/projects/acme-crossass/\n\n' +
        'Or specify the path with --acme-path option.',
    );
    this.name = 'AcmeNotFoundError';
    this.searchedPaths = searchedPaths;
  }
}

/**
 * ACME executable names by platform
 *
 * On Windows, the executable typically has .exe extension.
 */
const ACME_EXECUTABLE_NAMES =
  process.platform === 'win32' ? ['acme.exe', 'acme64.exe', 'acme'] : ['acme'];

/**
 * Find ACME executable in system PATH
 *
 * Searches common locations for the ACME assembler:
 * 1. System PATH directories
 * 2. Common installation locations (Homebrew, apt, etc.)
 *
 * @returns Path to ACME executable, or null if not found
 *
 * @example
 * ```typescript
 * const acmePath = findAcme();
 * if (acmePath) {
 *   console.log('Found ACME at:', acmePath);
 * } else {
 *   console.log('ACME not installed');
 * }
 * ```
 */
export function findAcme(): string | null {
  // Get PATH directories
  const pathEnv = process.env['PATH'] || process.env['Path'] || '';
  const pathSeparator = process.platform === 'win32' ? ';' : ':';
  const pathDirs = pathEnv.split(pathSeparator).filter(Boolean);

  // Add common installation directories not always in PATH
  const additionalDirs = getAdditionalSearchDirs();
  const allDirs = [...pathDirs, ...additionalDirs];

  // Search for ACME executable
  for (const dir of allDirs) {
    for (const name of ACME_EXECUTABLE_NAMES) {
      const fullPath = join(dir, name);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

/**
 * Get additional directories to search for ACME
 *
 * These are common installation locations that may not be in PATH.
 *
 * @returns Array of directory paths to search
 */
function getAdditionalSearchDirs(): string[] {
  const dirs: string[] = [];

  if (process.platform === 'darwin') {
    // macOS: Homebrew locations
    dirs.push('/opt/homebrew/bin'); // Apple Silicon
    dirs.push('/usr/local/bin'); // Intel
  } else if (process.platform === 'linux') {
    // Linux: common locations
    dirs.push('/usr/bin');
    dirs.push('/usr/local/bin');
    dirs.push('/snap/bin');
  } else if (process.platform === 'win32') {
    // Windows: common locations
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    dirs.push(join(programFiles, 'ACME'));
    dirs.push(join(programFilesX86, 'ACME'));
  }

  return dirs;
}

/**
 * Check if ACME is available on this system
 *
 * Quick check to determine if ACME is installed and accessible.
 *
 * @param acmePath - Optional specific path to check
 * @returns True if ACME is available
 *
 * @example
 * ```typescript
 * if (isAcmeAvailable()) {
 *   // Can generate binary output
 * } else {
 *   // Assembly-only output
 * }
 * ```
 */
export function isAcmeAvailable(acmePath?: string): boolean {
  // If a specific path is provided (including empty string), check only that path
  if (acmePath !== undefined) {
    // Empty string is considered "no valid path"
    if (acmePath === '') {
      return false;
    }
    return existsSync(acmePath);
  }
  // No path provided - search for ACME in PATH
  return findAcme() !== null;
}

/**
 * Invoke ACME assembler to assemble source code
 *
 * Takes assembly source code and invokes ACME to produce
 * binary output. Handles temp file management and cleanup.
 *
 * **Process:**
 * 1. Create temp directory for assembly files
 * 2. Write source to temp file
 * 3. Invoke ACME with appropriate options
 * 4. Read output files (binary, labels)
 * 5. Clean up temp files
 * 6. Return results or throw on error
 *
 * @param source - Assembly source code (ACME-compatible)
 * @param options - Assembly options
 * @returns Promise resolving to assembled binary and labels
 * @throws {AcmeNotFoundError} If ACME is not installed
 * @throws {AcmeError} If assembly fails
 *
 * @example
 * ```typescript
 * const source = `
 *   * = $0801
 *   !byte $0b, $08, $0a, $00, $9e, $32, $30, $36, $34, $00, $00, $00
 *   * = $0810
 *   LDA #$05
 *   STA $D020
 *   RTS
 * `;
 *
 * const result = await invokeAcme(source, {
 *   format: 'prg',
 *   labels: true,
 * });
 *
 * console.log('Binary size:', result.binary.length);
 * ```
 */
export async function invokeAcme(source: string, options: AcmeOptions): Promise<AcmeResult> {
  // Find ACME executable
  const acmePath = options.acmePath || findAcme();
  const searchedPaths = options.acmePath ? [options.acmePath] : getSearchedPaths();

  if (!acmePath || !existsSync(acmePath)) {
    throw new AcmeNotFoundError(searchedPaths);
  }

  // Create temp directory for assembly
  const tempDir = await mkdtemp(join(tmpdir(), 'blend65-acme-'));

  const sourceFile = join(tempDir, 'source.asm');
  const outputFile = join(tempDir, 'output.prg');
  const labelFile = join(tempDir, 'output.labels');

  try {
    // Write source to temp file
    await writeFile(sourceFile, source, 'utf-8');

    // Build ACME arguments
    const args = buildAcmeArgs(sourceFile, outputFile, labelFile, options);

    // Invoke ACME
    const { stdout, stderr, exitCode } = await runAcme(
      acmePath,
      args,
      options.timeout ?? 30000,
      tempDir,
    );

    // Check for errors
    if (exitCode !== 0) {
      throw new AcmeError(
        `ACME assembly failed with exit code ${exitCode}:\n${stderr}`,
        exitCode,
        stdout,
        stderr,
        source,
      );
    }

    // Read output files
    const binary = await readFile(outputFile);
    const labels = options.labels ? await readFileSafe(labelFile) : undefined;

    return {
      binary: new Uint8Array(binary),
      labels,
      stdout,
      stderr,
    };
  } finally {
    // Clean up temp files
    await cleanupTempDir(tempDir, [sourceFile, outputFile, labelFile]);
  }
}

/**
 * Get the list of paths that were searched for ACME
 *
 * Useful for error reporting to show the user where we looked.
 *
 * @returns Array of searched paths
 */
function getSearchedPaths(): string[] {
  const pathEnv = process.env['PATH'] || process.env['Path'] || '';
  const pathSeparator = process.platform === 'win32' ? ';' : ':';
  const pathDirs = pathEnv.split(pathSeparator).filter(Boolean);
  const additionalDirs = getAdditionalSearchDirs();

  const paths: string[] = [];
  for (const dir of [...pathDirs, ...additionalDirs]) {
    for (const name of ACME_EXECUTABLE_NAMES) {
      paths.push(join(dir, name));
    }
  }

  return paths;
}

/**
 * Build ACME command-line arguments
 *
 * @param sourceFile - Path to source file
 * @param outputFile - Path for binary output
 * @param labelFile - Path for label output
 * @param options - Assembly options
 * @returns Array of command-line arguments
 */
function buildAcmeArgs(
  sourceFile: string,
  outputFile: string,
  labelFile: string,
  options: AcmeOptions,
): string[] {
  const args: string[] = [];

  // Output format
  // 'cbm' = PRG format (with 2-byte load address)
  // 'plain' = raw binary (no header)
  if (options.format === 'prg') {
    args.push('-f', 'cbm');
  } else {
    args.push('-f', 'plain');
  }

  // Output file
  args.push('-o', outputFile);

  // Label file
  if (options.labels) {
    args.push('-l', labelFile);
  }

  // Verbose mode
  if (options.verbose) {
    args.push('-v');
  }

  // Source file
  args.push(sourceFile);

  return args;
}

/**
 * Run ACME process and capture output
 *
 * @param acmePath - Path to ACME executable
 * @param args - Command-line arguments
 * @param timeout - Timeout in milliseconds
 * @param cwd - Working directory
 * @returns Promise with stdout, stderr, and exit code
 */
function runAcme(
  acmePath: string,
  args: string[],
  timeout: number,
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(acmePath, args, { cwd });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Set timeout
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
      reject(
        new Error(`ACME process timed out after ${timeout}ms. ` + `Command: ${acmePath} ${args.join(' ')}`),
      );
    }, timeout);

    // Capture stdout
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    // Capture stderr
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Handle process exit
    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      if (!killed) {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        });
      }
    });

    // Handle errors (e.g., spawn failure)
    child.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start ACME: ${err.message}`));
    });
  });
}

/**
 * Read a file, returning undefined if it doesn't exist
 *
 * @param filePath - Path to file
 * @returns File content or undefined
 */
async function readFileSafe(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

/**
 * Clean up temp directory and files
 *
 * Attempts to delete all files and the directory.
 * Failures are silently ignored (cleanup is best-effort).
 *
 * @param tempDir - Temp directory path
 * @param files - Files to delete
 */
async function cleanupTempDir(tempDir: string, files: string[]): Promise<void> {
  // Delete files (ignore errors)
  for (const file of files) {
    try {
      await unlink(file);
    } catch {
      // Ignore - file may not exist
    }
  }

  // Delete directory (ignore errors)
  try {
    await rmdir(tempDir);
  } catch {
    // Ignore - directory may not be empty or already deleted
  }
}

/**
 * Assemble simple source without options
 *
 * Convenience function for quick assembly with default options.
 * Uses PRG format without labels.
 *
 * @param source - Assembly source code
 * @param acmePath - Optional path to ACME
 * @returns Promise resolving to binary data
 *
 * @example
 * ```typescript
 * const binary = await assembleSimple(`
 *   * = $C000
 *   LDA #$00
 *   RTS
 * `);
 * ```
 */
export async function assembleSimple(source: string, acmePath?: string): Promise<Uint8Array> {
  const result = await invokeAcme(source, {
    format: 'prg',
    acmePath,
  });
  return result.binary;
}

/**
 * Get ACME version string
 *
 * Invokes ACME with --version to get version information.
 * Returns null if ACME is not found or fails.
 *
 * @param acmePath - Optional path to ACME
 * @returns Promise resolving to version string or null
 *
 * @example
 * ```typescript
 * const version = await getAcmeVersion();
 * if (version) {
 *   console.log('ACME version:', version);
 * }
 * ```
 */
export async function getAcmeVersion(acmePath?: string): Promise<string | null> {
  const acme = acmePath || findAcme();
  if (!acme) {
    return null;
  }

  return new Promise((resolve) => {
    const child = spawn(acme, ['--version']);

    let output = '';

    child.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      output += data.toString();
    });

    child.on('close', () => {
      // ACME outputs version to stderr, extract first line
      const firstLine = output.trim().split('\n')[0];
      resolve(firstLine || null);
    });

    child.on('error', () => {
      resolve(null);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      child.kill();
      resolve(null);
    }, 5000);
  });
}

/**
 * Invoke ACME assembler synchronously
 *
 * Synchronous version of invokeAcme() for use in synchronous code paths.
 * Uses Node.js execSync and synchronous file operations.
 *
 * **WARNING:** This blocks the event loop. Use the async version when possible.
 *
 * @param source - Assembly source code (ACME-compatible)
 * @param options - Assembly options
 * @returns Assembled binary and labels
 * @throws {AcmeNotFoundError} If ACME is not installed
 * @throws {AcmeError} If assembly fails
 *
 * @example
 * ```typescript
 * const result = invokeAcmeSync(source, { format: 'prg' });
 * console.log('Binary size:', result.binary.length);
 * ```
 */
export function invokeAcmeSync(source: string, options: AcmeOptions): AcmeResult {
  // Find ACME executable
  const acmePath = options.acmePath || findAcme();
  const searchedPaths = options.acmePath ? [options.acmePath] : getSearchedPaths();

  if (!acmePath || !existsSync(acmePath)) {
    throw new AcmeNotFoundError(searchedPaths);
  }

  // Create temp directory for assembly
  const tempDir = mkdtempSync(join(tmpdir(), 'blend65-acme-'));

  const sourceFile = join(tempDir, 'source.asm');
  const outputFile = join(tempDir, 'output.prg');
  const labelFile = join(tempDir, 'output.labels');

  try {
    // Write source to temp file
    writeFileSync(sourceFile, source, 'utf-8');

    // Build ACME arguments
    const args = buildAcmeArgs(sourceFile, outputFile, labelFile, options);

    // Build command string
    const command = `"${acmePath}" ${args.map(arg => `"${arg}"`).join(' ')}`;

    // Invoke ACME synchronously
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      stdout = execSync(command, {
        cwd: tempDir,
        encoding: 'utf-8',
        timeout: options.timeout ?? 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: unknown) {
      // execSync throws on non-zero exit code
      const execErr = err as { status?: number; stdout?: string; stderr?: string };
      exitCode = execErr.status ?? 1;
      stdout = execErr.stdout ?? '';
      stderr = execErr.stderr ?? '';
    }

    // Check for errors
    if (exitCode !== 0) {
      throw new AcmeError(
        `ACME assembly failed with exit code ${exitCode}:\n${stderr}`,
        exitCode,
        stdout,
        stderr,
        source,
      );
    }

    // Read output files
    const binary = readFileSync(outputFile);
    const labels = options.labels ? readFileSyncSafe(labelFile) : undefined;

    return {
      binary: new Uint8Array(binary),
      labels,
      stdout,
      stderr,
    };
  } finally {
    // Clean up temp files
    cleanupTempDirSync(tempDir, [sourceFile, outputFile, labelFile]);
  }
}

/**
 * Read a file synchronously, returning undefined if it doesn't exist
 *
 * @param filePath - Path to file
 * @returns File content or undefined
 */
function readFileSyncSafe(filePath: string): string | undefined {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

/**
 * Clean up temp directory and files synchronously
 *
 * @param tempDir - Temp directory path
 * @param files - Files to delete
 */
function cleanupTempDirSync(tempDir: string, files: string[]): void {
  // Delete files (ignore errors)
  for (const file of files) {
    try {
      unlinkSync(file);
    } catch {
      // Ignore - file may not exist
    }
  }

  // Delete directory (ignore errors)
  try {
    rmdirSync(tempDir);
  } catch {
    // Ignore - directory may not be empty or already deleted
  }
}