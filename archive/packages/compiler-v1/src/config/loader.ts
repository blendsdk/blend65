/**
 * Configuration Loader
 *
 * Loads Blend65 project configurations from `blend65.json` files.
 * Handles file discovery, JSON parsing, and error reporting.
 *
 * **Loading Process:**
 * 1. Find config file (explicit path or directory search)
 * 2. Read and parse JSON
 * 3. Validate configuration
 * 4. Return parsed configuration
 *
 * @module config/loader
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

import type { Blend65Config, ConfigLoadOptions } from './types.js';
import { ConfigValidator } from './validator.js';

/**
 * Configuration file name
 *
 * The standard name for Blend65 project configuration files.
 */
export const CONFIG_FILE_NAME = 'blend65.json';

/**
 * Configuration loading exception
 *
 * Thrown when configuration loading fails.
 * Provides detailed error information for debugging.
 */
export class ConfigLoadException extends Error {
  /**
   * Path to the config file that failed to load
   */
  public readonly configPath: string | null;

  /**
   * The underlying error that caused the failure
   */
  public readonly cause: Error | null;

  /**
   * Creates a new ConfigLoadException
   *
   * @param message - Error message
   * @param configPath - Path to config file (if known)
   * @param cause - Underlying error (if any)
   */
  constructor(message: string, configPath: string | null = null, cause: Error | null = null) {
    super(message);
    this.name = 'ConfigLoadException';
    this.configPath = configPath;
    this.cause = cause;
  }
}

/**
 * Configuration loader
 *
 * Loads and parses `blend65.json` configuration files.
 * Integrates with {@link ConfigValidator} for validation.
 *
 * @example
 * ```typescript
 * const loader = new ConfigLoader();
 *
 * // Load from explicit path
 * const config = loader.load('./project/blend65.json');
 *
 * // Find and load config file
 * const configPath = loader.findConfigFile();
 * if (configPath) {
 *   const config = loader.load(configPath);
 * }
 * ```
 */
export class ConfigLoader {
  /**
   * Validator instance for config validation
   */
  protected readonly validator: ConfigValidator;

  /**
   * Creates a new ConfigLoader
   *
   * @param validator - Optional custom validator instance
   */
  constructor(validator?: ConfigValidator) {
    this.validator = validator ?? new ConfigValidator();
  }

  /**
   * Load configuration from a file
   *
   * Reads, parses, and validates a configuration file.
   *
   * @param path - Path to the configuration file
   * @returns Validated configuration object
   * @throws ConfigLoadException if file cannot be read or parsed
   * @throws ConfigValidationException if configuration is invalid
   *
   * @example
   * ```typescript
   * const config = loader.load('./blend65.json');
   * console.log(config.compilerOptions.target); // 'c64'
   * ```
   */
  public load(path: string): Blend65Config {
    const absolutePath = resolve(path);

    // Check file exists
    if (!existsSync(absolutePath)) {
      throw new ConfigLoadException(`Configuration file not found: ${absolutePath}`, absolutePath);
    }

    // Read file contents
    let content: string;
    try {
      content = readFileSync(absolutePath, 'utf-8');
    } catch (error) {
      throw new ConfigLoadException(
        `Failed to read configuration file: ${absolutePath}`,
        absolutePath,
        error instanceof Error ? error : null
      );
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      const jsonError = error instanceof SyntaxError ? error : null;
      throw new ConfigLoadException(
        `Invalid JSON in configuration file: ${absolutePath}${jsonError ? ` - ${jsonError.message}` : ''}`,
        absolutePath,
        jsonError
      );
    }

    // Validate configuration
    // This throws ConfigValidationException if invalid
    this.validator.validate(parsed);

    return parsed;
  }

  /**
   * Load configuration from a file without throwing validation errors
   *
   * Returns the parsed configuration even if validation fails.
   * Useful for IDE integration where partial configs are acceptable.
   *
   * @param path - Path to the configuration file
   * @returns Object containing config and any validation errors
   * @throws ConfigLoadException if file cannot be read or parsed
   *
   * @example
   * ```typescript
   * const result = loader.loadWithErrors('./blend65.json');
   * if (result.errors.length > 0) {
   *   console.warn('Config has issues:', result.errors);
   * }
   * // Can still use result.config
   * ```
   */
  public loadWithErrors(
    path: string
  ): { config: unknown; errors: ReturnType<ConfigValidator['getErrors']> } {
    const absolutePath = resolve(path);

    // Check file exists
    if (!existsSync(absolutePath)) {
      throw new ConfigLoadException(`Configuration file not found: ${absolutePath}`, absolutePath);
    }

    // Read file contents
    let content: string;
    try {
      content = readFileSync(absolutePath, 'utf-8');
    } catch (error) {
      throw new ConfigLoadException(
        `Failed to read configuration file: ${absolutePath}`,
        absolutePath,
        error instanceof Error ? error : null
      );
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      const jsonError = error instanceof SyntaxError ? error : null;
      throw new ConfigLoadException(
        `Invalid JSON in configuration file: ${absolutePath}${jsonError ? ` - ${jsonError.message}` : ''}`,
        absolutePath,
        jsonError
      );
    }

    // Get validation errors (don't throw)
    const errors = this.validator.getErrors(parsed);

    return { config: parsed, errors };
  }

  /**
   * Find configuration file
   *
   * Searches for a configuration file using the following strategy:
   * 1. If explicit path provided, use it (error if not found)
   * 2. Look for blend65.json in current directory
   * 3. Return null if not found
   *
   * **Note**: Does NOT walk up parent directories.
   *
   * @param explicitPath - Explicit path to config file
   * @param cwd - Working directory to search in
   * @returns Path to config file, or null if not found
   * @throws ConfigLoadException if explicit path doesn't exist
   *
   * @example
   * ```typescript
   * // Explicit path
   * const path = loader.findConfigFile('./custom.json');
   *
   * // Search current directory
   * const path = loader.findConfigFile();
   * if (path) {
   *   console.log('Found config at:', path);
   * }
   * ```
   */
  public findConfigFile(explicitPath?: string, cwd?: string): string | null {
    // 1. Explicit path takes precedence
    if (explicitPath) {
      const absolutePath = resolve(cwd ?? process.cwd(), explicitPath);
      if (!existsSync(absolutePath)) {
        throw new ConfigLoadException(`Configuration file not found: ${absolutePath}`, absolutePath);
      }
      return absolutePath;
    }

    // 2. Search current directory
    const workDir = cwd ?? process.cwd();
    const localConfig = resolve(workDir, CONFIG_FILE_NAME);
    if (existsSync(localConfig)) {
      return localConfig;
    }

    // 3. Not found
    return null;
  }

  /**
   * Load configuration with options
   *
   * High-level method that handles the full config loading workflow:
   * 1. Find config file (or use default)
   * 2. Load and validate configuration
   * 3. Return config along with the path it was loaded from
   *
   * @param options - Loading options
   * @returns Loaded configuration and source path
   *
   * @example
   * ```typescript
   * const { config, configPath } = loader.loadWithOptions({
   *   configPath: './custom.json',
   *   cwd: '/project',
   * });
   *
   * if (configPath) {
   *   console.log(`Loaded config from: ${configPath}`);
   * } else {
   *   console.log('Using default configuration');
   * }
   * ```
   */
  public loadWithOptions(options: ConfigLoadOptions = {}): {
    config: Blend65Config | null;
    configPath: string | null;
  } {
    const configPath = this.findConfigFile(options.configPath, options.cwd);

    if (configPath) {
      const config = this.load(configPath);
      return { config, configPath };
    }

    return { config: null, configPath: null };
  }

  /**
   * Get the directory containing a config file
   *
   * Useful for resolving relative paths in the configuration.
   *
   * @param configPath - Path to the config file
   * @returns Directory containing the config file
   *
   * @example
   * ```typescript
   * const dir = loader.getConfigDir('./project/blend65.json');
   * console.log(dir); // '/absolute/path/to/project'
   * ```
   */
  public getConfigDir(configPath: string): string {
    return dirname(resolve(configPath));
  }
}