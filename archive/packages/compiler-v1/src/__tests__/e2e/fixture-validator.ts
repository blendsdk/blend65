/**
 * @file Fixture Validator
 * @description Validates fixture files for correct metadata and structure.
 *
 * This module provides utilities to validate individual fixtures and
 * scan directories for all fixtures with validation reports.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';
import {
  parseFixtureMetadata,
  inferCategoryFromPath,
  isFixtureFile,
} from './fixture-parser.js';
import {
  FixtureCategory,
  FixtureMetadata,
  LoadedFixture,
} from './fixture-types.js';

/**
 * Result of validating a single fixture file.
 */
export interface FixtureValidationResult {
  /** File path relative to fixtures directory */
  filePath: string;
  /** Whether validation passed */
  valid: boolean;
  /** Parsed metadata (if valid) */
  metadata?: FixtureMetadata;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Summary of validating all fixtures in a directory.
 */
export interface FixtureValidationSummary {
  /** Total files scanned */
  totalFiles: number;
  /** Number of valid fixtures */
  validFixtures: number;
  /** Number of invalid fixtures */
  invalidFixtures: number;
  /** Number of non-fixture files (skipped) */
  skippedFiles: number;
  /** Individual validation results */
  results: FixtureValidationResult[];
  /** All validation errors grouped by file */
  errors: Map<string, string[]>;
}

/**
 * Validates a single fixture file.
 *
 * @param absolutePath - Absolute path to the fixture file
 * @param fixturesDir - Base fixtures directory for relative path calculation
 * @returns Validation result
 */
export function validateFixtureFile(
  absolutePath: string,
  fixturesDir: string,
): FixtureValidationResult {
  const filePath = relative(fixturesDir, absolutePath);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file exists
  if (!existsSync(absolutePath)) {
    return {
      filePath,
      valid: false,
      errors: [`File not found: ${absolutePath}`],
      warnings: [],
    };
  }

  // Read file content
  let source: string;
  try {
    source = readFileSync(absolutePath, 'utf-8');
  } catch (error) {
    return {
      filePath,
      valid: false,
      errors: [`Failed to read file: ${error}`],
      warnings: [],
    };
  }

  // Check if it's a fixture file
  if (!isFixtureFile(source)) {
    return {
      filePath,
      valid: false,
      errors: ['File does not contain fixture metadata'],
      warnings: [],
    };
  }

  // Parse metadata
  const parseResult = parseFixtureMetadata(source, filePath);

  if (!parseResult.success) {
    return {
      filePath,
      valid: false,
      errors: parseResult.errors || ['Unknown parse error'],
      warnings: parseResult.warnings || [],
    };
  }

  const metadata = parseResult.metadata!;

  // Add any parse warnings
  if (parseResult.warnings) {
    warnings.push(...parseResult.warnings);
  }

  // Validate category matches directory structure
  const inferredCategory = inferCategoryFromPath(filePath);
  if (inferredCategory && inferredCategory !== metadata.category) {
    warnings.push(
      `Category '${metadata.category}' does not match directory structure (expected '${inferredCategory}')`,
    );
  }

  // Validate fixture ID format
  if (!metadata.fixture.includes('/')) {
    warnings.push("Fixture ID should include category path (e.g., 'lexer/numbers/decimal')");
  }

  // Validate error cases have error code
  if (metadata.expect === 'error' && !metadata.errorCode) {
    warnings.push("Error fixtures should specify '@error-code'");
  }

  return {
    filePath,
    valid: errors.length === 0,
    metadata,
    errors,
    warnings,
  };
}

/**
 * Discovers all .blend files in a directory recursively.
 *
 * @param dir - Directory to scan
 * @returns Array of absolute file paths
 */
export function discoverBlendFiles(dir: string): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Recurse into subdirectories
      files.push(...discoverBlendFiles(fullPath));
    } else if (stat.isFile() && extname(entry) === '.blend') {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Validates all fixtures in a directory.
 *
 * @param fixturesDir - Path to fixtures directory
 * @returns Validation summary
 */
export function validateAllFixtures(fixturesDir: string): FixtureValidationSummary {
  const blendFiles = discoverBlendFiles(fixturesDir);
  const results: FixtureValidationResult[] = [];
  const errors = new Map<string, string[]>();

  let validFixtures = 0;
  let invalidFixtures = 0;
  let skippedFiles = 0;

  for (const filePath of blendFiles) {
    const result = validateFixtureFile(filePath, fixturesDir);

    // Check if it's actually a fixture (has metadata)
    if (result.errors.includes('File does not contain fixture metadata')) {
      skippedFiles++;
      continue;
    }

    results.push(result);

    if (result.valid) {
      validFixtures++;
    } else {
      invalidFixtures++;
      errors.set(result.filePath, result.errors);
    }
  }

  return {
    totalFiles: blendFiles.length,
    validFixtures,
    invalidFixtures,
    skippedFiles,
    results,
    errors,
  };
}

/**
 * Loads a validated fixture for execution.
 *
 * @param absolutePath - Absolute path to the fixture file
 * @param fixturesDir - Base fixtures directory
 * @returns Loaded fixture or null if invalid
 */
export function loadFixture(
  absolutePath: string,
  fixturesDir: string,
): LoadedFixture | null {
  const validationResult = validateFixtureFile(absolutePath, fixturesDir);

  if (!validationResult.valid || !validationResult.metadata) {
    return null;
  }

  const source = readFileSync(absolutePath, 'utf-8');

  return {
    filePath: validationResult.filePath,
    absolutePath,
    source,
    metadata: validationResult.metadata,
  };
}

/**
 * Loads all valid fixtures from a directory.
 *
 * @param fixturesDir - Path to fixtures directory
 * @param category - Optional category filter
 * @returns Array of loaded fixtures
 */
export function loadAllFixtures(
  fixturesDir: string,
  category?: FixtureCategory,
): LoadedFixture[] {
  const blendFiles = discoverBlendFiles(fixturesDir);
  const fixtures: LoadedFixture[] = [];

  for (const filePath of blendFiles) {
    const fixture = loadFixture(filePath, fixturesDir);

    if (fixture) {
      // Apply category filter if specified
      if (category && fixture.metadata.category !== category) {
        continue;
      }
      fixtures.push(fixture);
    }
  }

  return fixtures;
}

/**
 * Generates a human-readable validation report.
 *
 * @param summary - Validation summary
 * @returns Formatted report string
 */
export function generateValidationReport(summary: FixtureValidationSummary): string {
  const lines: string[] = [];

  lines.push('=== Fixture Validation Report ===');
  lines.push('');
  lines.push(`Total files scanned: ${summary.totalFiles}`);
  lines.push(`Valid fixtures: ${summary.validFixtures}`);
  lines.push(`Invalid fixtures: ${summary.invalidFixtures}`);
  lines.push(`Skipped (non-fixtures): ${summary.skippedFiles}`);
  lines.push('');

  if (summary.invalidFixtures > 0) {
    lines.push('=== Validation Errors ===');
    lines.push('');

    for (const [filePath, errors] of summary.errors) {
      lines.push(`File: ${filePath}`);
      for (const error of errors) {
        lines.push(`  - ${error}`);
      }
      lines.push('');
    }
  }

  // List fixtures with warnings
  const fixturesWithWarnings = summary.results.filter(
    (r) => r.valid && r.warnings.length > 0,
  );

  if (fixturesWithWarnings.length > 0) {
    lines.push('=== Warnings ===');
    lines.push('');

    for (const result of fixturesWithWarnings) {
      lines.push(`File: ${result.filePath}`);
      for (const warning of result.warnings) {
        lines.push(`  - ${warning}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}