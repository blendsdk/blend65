/**
 * Configuration Validator
 *
 * Validates Blend65 project configurations (`blend65.json`).
 * Provides helpful error messages for invalid configurations.
 *
 * **Validation Levels:**
 * 1. **Type Validation**: Values match expected types
 * 2. **Value Validation**: Values are within valid ranges/options
 * 3. **Implementation Validation**: Features are implemented
 * 4. **Semantic Validation**: Configuration is internally consistent
 *
 * @module config/validator
 */

import type {
  Blend65Config,
  ConfigValidationError,
  TargetPlatform,
  OptimizationLevelId,
  DebugMode,
  OutputFormat,
  EmulatorType,
} from './types.js';

import {
  getValidTargets,
  getValidOptimizationLevels,
  getValidDebugModes,
  getValidOutputFormats,
  getValidEmulatorTypes,
  isTargetImplemented,
  isOutputFormatImplemented,
} from './defaults.js';

/**
 * Configuration validation exception
 *
 * Thrown when configuration validation fails.
 * Contains all validation errors found.
 */
export class ConfigValidationException extends Error {
  /**
   * All validation errors found
   */
  public readonly errors: ConfigValidationError[];

  /**
   * Creates a new ConfigValidationException
   *
   * @param errors - Validation errors
   */
  constructor(errors: ConfigValidationError[]) {
    const message = ConfigValidationException.formatMessage(errors);
    super(message);
    this.name = 'ConfigValidationException';
    this.errors = errors;
  }

  /**
   * Format errors into a readable message
   */
  protected static formatMessage(errors: ConfigValidationError[]): string {
    const lines = ['Configuration validation failed:'];
    for (const error of errors) {
      lines.push(`  - ${error.path}: ${error.message}`);
    }
    return lines.join('\n');
  }
}

/**
 * Configuration validator
 *
 * Validates `blend65.json` configuration objects.
 * Provides both throwing and non-throwing validation methods.
 *
 * @example
 * ```typescript
 * const validator = new ConfigValidator();
 *
 * // Throwing validation (use in production)
 * validator.validate(config);
 *
 * // Non-throwing validation (use in tests/IDE)
 * const errors = validator.getErrors(config);
 * if (errors.length > 0) {
 *   console.error('Invalid config:', errors);
 * }
 * ```
 */
export class ConfigValidator {
  /**
   * Validate configuration and throw if invalid
   *
   * @param config - Configuration object to validate
   * @throws ConfigValidationException if validation fails
   *
   * @example
   * ```typescript
   * try {
   *   validator.validate(config);
   *   // Config is valid, proceed with compilation
   * } catch (e) {
   *   if (e instanceof ConfigValidationException) {
   *     console.error(e.errors);
   *   }
   * }
   * ```
   */
  public validate(config: unknown): asserts config is Blend65Config {
    const errors = this.getErrors(config);
    if (errors.length > 0) {
      throw new ConfigValidationException(errors);
    }
  }

  /**
   * Get validation errors without throwing
   *
   * Validates the configuration and returns all errors found.
   * Returns an empty array if configuration is valid.
   *
   * @param config - Configuration object to validate
   * @returns Array of validation errors
   *
   * @example
   * ```typescript
   * const errors = validator.getErrors(config);
   * if (errors.length === 0) {
   *   console.log('Configuration is valid');
   * } else {
   *   for (const error of errors) {
   *     console.error(`${error.path}: ${error.message}`);
   *   }
   * }
   * ```
   */
  public getErrors(config: unknown): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];

    // Check root is an object
    if (!this.isObject(config)) {
      errors.push({
        path: '',
        message: 'Configuration must be an object',
        value: config,
      });
      return errors;
    }

    // Validate required fields
    if (!('compilerOptions' in config)) {
      errors.push({
        path: 'compilerOptions',
        message: 'compilerOptions is required',
        value: undefined,
      });
    } else {
      this.validateCompilerOptions(config.compilerOptions, errors);
    }

    // Validate optional fields
    if ('include' in config) {
      this.validateStringArray(config.include, 'include', errors);
    }

    if ('exclude' in config) {
      this.validateStringArray(config.exclude, 'exclude', errors);
    }

    if ('files' in config) {
      this.validateStringArray(config.files, 'files', errors);
    }

    if ('rootDir' in config) {
      this.validateString(config.rootDir, 'rootDir', errors);
    }

    if ('emulator' in config) {
      this.validateEmulatorConfig(config.emulator, errors);
    }

    if ('resources' in config && config.resources !== undefined) {
      this.validateResourceConfig(config.resources, errors);
    }

    return errors;
  }

  /**
   * Validate compiler options
   */
  protected validateCompilerOptions(options: unknown, errors: ConfigValidationError[]): void {
    if (!this.isObject(options)) {
      errors.push({
        path: 'compilerOptions',
        message: 'compilerOptions must be an object',
        value: options,
      });
      return;
    }

    // Validate target
    if ('target' in options && options.target !== undefined) {
      this.validateTarget(options.target, errors);
    }

    // Validate optimization
    if ('optimization' in options && options.optimization !== undefined) {
      this.validateOptimization(options.optimization, errors);
    }

    // Validate debug
    if ('debug' in options && options.debug !== undefined) {
      this.validateDebugMode(options.debug, errors);
    }

    // Validate outDir
    if ('outDir' in options && options.outDir !== undefined) {
      this.validateString(options.outDir, 'compilerOptions.outDir', errors);
    }

    // Validate outFile
    if ('outFile' in options && options.outFile !== undefined) {
      this.validateString(options.outFile, 'compilerOptions.outFile', errors);
    }

    // Validate outputFormat
    if ('outputFormat' in options && options.outputFormat !== undefined) {
      this.validateOutputFormat(options.outputFormat, errors);
    }

    // Validate verbose
    if ('verbose' in options && options.verbose !== undefined) {
      this.validateBoolean(options.verbose, 'compilerOptions.verbose', errors);
    }

    // Validate strict
    if ('strict' in options && options.strict !== undefined) {
      this.validateBoolean(options.strict, 'compilerOptions.strict', errors);
    }

    // Validate loadAddress
    if ('loadAddress' in options && options.loadAddress !== undefined) {
      this.validateLoadAddress(options.loadAddress, errors);
    }
  }

  /**
   * Validate target platform
   */
  protected validateTarget(target: unknown, errors: ConfigValidationError[]): void {
    const path = 'compilerOptions.target';
    const validTargets = getValidTargets();

    if (typeof target !== 'string') {
      errors.push({
        path,
        message: `Target must be a string. Valid targets: ${validTargets.join(', ')}`,
        value: target,
      });
      return;
    }

    if (!validTargets.includes(target as TargetPlatform)) {
      errors.push({
        path,
        message: `Invalid target '${target}'. Valid targets: ${validTargets.join(', ')}`,
        value: target,
      });
      return;
    }

    // Check if target is implemented
    if (!isTargetImplemented(target as TargetPlatform)) {
      errors.push({
        path,
        message: `Target '${target}' is not implemented yet. Currently only 'c64' is supported.`,
        value: target,
      });
    }
  }

  /**
   * Validate optimization level
   */
  protected validateOptimization(optimization: unknown, errors: ConfigValidationError[]): void {
    const path = 'compilerOptions.optimization';
    const validLevels = getValidOptimizationLevels();

    if (typeof optimization !== 'string') {
      errors.push({
        path,
        message: `Optimization level must be a string. Valid levels: ${validLevels.join(', ')}`,
        value: optimization,
      });
      return;
    }

    if (!validLevels.includes(optimization as OptimizationLevelId)) {
      errors.push({
        path,
        message: `Invalid optimization level '${optimization}'. Valid levels: ${validLevels.join(', ')}`,
        value: optimization,
      });
    }
  }

  /**
   * Validate debug mode
   */
  protected validateDebugMode(debug: unknown, errors: ConfigValidationError[]): void {
    const path = 'compilerOptions.debug';
    const validModes = getValidDebugModes();

    if (typeof debug !== 'string') {
      errors.push({
        path,
        message: `Debug mode must be a string. Valid modes: ${validModes.join(', ')}`,
        value: debug,
      });
      return;
    }

    if (!validModes.includes(debug as DebugMode)) {
      errors.push({
        path,
        message: `Invalid debug mode '${debug}'. Valid modes: ${validModes.join(', ')}`,
        value: debug,
      });
    }
  }

  /**
   * Validate output format
   */
  protected validateOutputFormat(format: unknown, errors: ConfigValidationError[]): void {
    const path = 'compilerOptions.outputFormat';
    const validFormats = getValidOutputFormats();

    if (typeof format !== 'string') {
      errors.push({
        path,
        message: `Output format must be a string. Valid formats: ${validFormats.join(', ')}`,
        value: format,
      });
      return;
    }

    if (!validFormats.includes(format as OutputFormat)) {
      errors.push({
        path,
        message: `Invalid output format '${format}'. Valid formats: ${validFormats.join(', ')}`,
        value: format,
      });
      return;
    }

    // Check if format is implemented
    if (!isOutputFormatImplemented(format as OutputFormat)) {
      errors.push({
        path,
        message: `Output format '${format}' is not implemented yet.`,
        value: format,
      });
    }
  }

  /**
   * Validate load address
   */
  protected validateLoadAddress(address: unknown, errors: ConfigValidationError[]): void {
    const path = 'compilerOptions.loadAddress';

    if (typeof address !== 'number') {
      errors.push({
        path,
        message: 'Load address must be a number',
        value: address,
      });
      return;
    }

    if (!Number.isInteger(address)) {
      errors.push({
        path,
        message: 'Load address must be an integer',
        value: address,
      });
      return;
    }

    // Valid 6502 address range: $0000-$FFFF
    if (address < 0 || address > 0xffff) {
      errors.push({
        path,
        message: `Load address must be between 0 and 65535 (0x0000-0xFFFF). Got: ${address}`,
        value: address,
      });
    }
  }

  /**
   * Validate emulator configuration
   */
  protected validateEmulatorConfig(emulator: unknown, errors: ConfigValidationError[]): void {
    if (!this.isObject(emulator)) {
      errors.push({
        path: 'emulator',
        message: 'emulator must be an object',
        value: emulator,
      });
      return;
    }

    // Validate path
    if ('path' in emulator && emulator.path !== undefined) {
      this.validateString(emulator.path, 'emulator.path', errors);
    }

    // Validate type
    if ('type' in emulator && emulator.type !== undefined) {
      this.validateEmulatorType(emulator.type, errors);
    }

    // Validate args
    if ('args' in emulator && emulator.args !== undefined) {
      this.validateStringArray(emulator.args, 'emulator.args', errors);
    }

    // Validate autoRun
    if ('autoRun' in emulator && emulator.autoRun !== undefined) {
      this.validateBoolean(emulator.autoRun, 'emulator.autoRun', errors);
    }

    // Validate waitForExit
    if ('waitForExit' in emulator && emulator.waitForExit !== undefined) {
      this.validateBoolean(emulator.waitForExit, 'emulator.waitForExit', errors);
    }
  }

  /**
   * Validate emulator type
   */
  protected validateEmulatorType(type: unknown, errors: ConfigValidationError[]): void {
    const path = 'emulator.type';
    const validTypes = getValidEmulatorTypes();

    if (typeof type !== 'string') {
      errors.push({
        path,
        message: `Emulator type must be a string. Valid types: ${validTypes.join(', ')}`,
        value: type,
      });
      return;
    }

    if (!validTypes.includes(type as EmulatorType)) {
      errors.push({
        path,
        message: `Invalid emulator type '${type}'. Valid types: ${validTypes.join(', ')}`,
        value: type,
      });
    }
  }

  /**
   * Validate resource configuration
   */
  protected validateResourceConfig(resources: unknown, errors: ConfigValidationError[]): void {
    if (!this.isObject(resources)) {
      errors.push({
        path: 'resources',
        message: 'resources must be an object',
        value: resources,
      });
      return;
    }

    // Validate sprites
    if ('sprites' in resources && resources.sprites !== undefined) {
      this.validateStringArray(resources.sprites, 'resources.sprites', errors);
    }

    // Validate music
    if ('music' in resources && resources.music !== undefined) {
      this.validateStringArray(resources.music, 'resources.music', errors);
    }

    // Validate charsets
    if ('charsets' in resources && resources.charsets !== undefined) {
      this.validateStringArray(resources.charsets, 'resources.charsets', errors);
    }
  }

  /**
   * Validate a string value
   */
  protected validateString(value: unknown, path: string, errors: ConfigValidationError[]): void {
    if (typeof value !== 'string') {
      errors.push({
        path,
        message: `${path} must be a string`,
        value,
      });
    }
  }

  /**
   * Validate a boolean value
   */
  protected validateBoolean(value: unknown, path: string, errors: ConfigValidationError[]): void {
    if (typeof value !== 'boolean') {
      errors.push({
        path,
        message: `${path} must be a boolean`,
        value,
      });
    }
  }

  /**
   * Validate a string array
   */
  protected validateStringArray(value: unknown, path: string, errors: ConfigValidationError[]): void {
    if (!Array.isArray(value)) {
      errors.push({
        path,
        message: `${path} must be an array`,
        value,
      });
      return;
    }

    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'string') {
        errors.push({
          path: `${path}[${i}]`,
          message: `${path}[${i}] must be a string`,
          value: value[i],
        });
      }
    }
  }

  /**
   * Check if a value is a plain object
   */
  protected isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}