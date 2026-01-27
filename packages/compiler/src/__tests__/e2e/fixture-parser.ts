/**
 * @file Fixture Metadata Parser
 * @description Parses metadata comments from Blend fixture files.
 *
 * Metadata comments use the format:
 *   // @field: value
 *   // @field: multi
 *   //         line value
 *
 * The parser extracts these annotations and validates them against
 * the FixtureMetadata interface requirements.
 */

import {
  ExpectedOutcome,
  FixtureCategory,
  FixtureMetadata,
  FixtureParseResult,
  OutputCheck,
  OutputCheckType,
} from './fixture-types.js';

/**
 * Regular expression to match metadata comment lines.
 * Captures: @field: value (with optional continuation)
 */
const METADATA_LINE_REGEX = /^\/\/\s*@(\w+(?:-\w+)*):\s*(.*)$/;

/**
 * Regular expression to match continuation lines (indented comments).
 */
const CONTINUATION_LINE_REGEX = /^\/\/\s{2,}(.*)$/;

/**
 * Maps directory prefixes to fixture categories.
 */
const CATEGORY_DIR_MAP: Record<string, FixtureCategory> = {
  '01-lexer': FixtureCategory.Lexer,
  '02-parser': FixtureCategory.Parser,
  '03-semantic': FixtureCategory.Semantic,
  '04-il-generator': FixtureCategory.ILGenerator,
  '05-optimizer': FixtureCategory.Optimizer,
  '06-codegen': FixtureCategory.Codegen,
  '10-integration': FixtureCategory.Integration,
  '20-edge-cases': FixtureCategory.EdgeCases,
  '30-error-cases': FixtureCategory.ErrorCases,
  '99-regressions': FixtureCategory.Regressions,
};

/**
 * Valid category string values.
 */
const VALID_CATEGORIES = new Set(Object.values(FixtureCategory));

/**
 * Valid expected outcome string values.
 */
const VALID_OUTCOMES = new Set(Object.values(ExpectedOutcome));

/**
 * Parses fixture metadata from source code content.
 *
 * @param source - The complete source code of the fixture file
 * @param filePath - Optional file path for inferring category from directory
 * @returns Parse result with metadata or errors
 */
export function parseFixtureMetadata(
  source: string,
  filePath?: string,
): FixtureParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawMetadata: Map<string, string> = new Map();

  // Parse all metadata comment lines
  const lines = source.split('\n');
  let currentField: string | null = null;
  let currentValue: string = '';

  for (const line of lines) {
    // Check for new metadata field
    const metadataMatch = line.match(METADATA_LINE_REGEX);
    if (metadataMatch) {
      // Save previous field if exists
      if (currentField !== null) {
        rawMetadata.set(currentField, currentValue.trim());
      }

      currentField = metadataMatch[1];
      currentValue = metadataMatch[2];
      continue;
    }

    // Check for continuation line
    const continuationMatch = line.match(CONTINUATION_LINE_REGEX);
    if (continuationMatch && currentField !== null) {
      currentValue += ' ' + continuationMatch[1];
      continue;
    }

    // Non-metadata line ends the metadata section
    // (unless it's an empty line or regular comment)
    if (line.trim() !== '' && !line.trim().startsWith('//')) {
      // Save final field and stop parsing metadata
      if (currentField !== null) {
        rawMetadata.set(currentField, currentValue.trim());
      }
      break;
    }

    // Save field before a blank line or regular comment
    if (currentField !== null && line.trim() === '') {
      rawMetadata.set(currentField, currentValue.trim());
      currentField = null;
      currentValue = '';
    }
  }

  // Save any remaining field
  if (currentField !== null) {
    rawMetadata.set(currentField, currentValue.trim());
  }

  // Validate required fields
  if (!rawMetadata.has('fixture')) {
    errors.push("Missing required field: '@fixture'");
  }

  if (!rawMetadata.has('description')) {
    errors.push("Missing required field: '@description'");
  }

  if (!rawMetadata.has('expect')) {
    errors.push("Missing required field: '@expect'");
  }

  // Parse and validate category
  let category: FixtureCategory | undefined;
  const rawCategory = rawMetadata.get('category');

  if (rawCategory) {
    if (VALID_CATEGORIES.has(rawCategory as FixtureCategory)) {
      category = rawCategory as FixtureCategory;
    } else {
      errors.push(`Invalid category: '${rawCategory}'. Valid values: ${[...VALID_CATEGORIES].join(', ')}`);
    }
  } else if (filePath) {
    // Try to infer category from file path
    category = inferCategoryFromPath(filePath);
    if (!category) {
      errors.push("Missing required field: '@category' (and could not infer from file path)");
    } else {
      warnings.push(`Inferred category '${category}' from file path`);
    }
  } else {
    errors.push("Missing required field: '@category'");
  }

  // Parse and validate expect
  let expect: ExpectedOutcome | undefined;
  const rawExpect = rawMetadata.get('expect');

  if (rawExpect) {
    if (VALID_OUTCOMES.has(rawExpect as ExpectedOutcome)) {
      expect = rawExpect as ExpectedOutcome;
    } else {
      errors.push(`Invalid expect value: '${rawExpect}'. Valid values: ${[...VALID_OUTCOMES].join(', ')}`);
    }
  }

  // Validate error-specific fields
  if (expect === ExpectedOutcome.Error && !rawMetadata.has('error-code')) {
    warnings.push("Fixture expects error but no '@error-code' specified");
  }

  // Parse output checks
  const outputChecks = parseOutputChecks(rawMetadata, errors);

  // Parse tags
  const tags = parseTags(rawMetadata.get('tags'));

  // Parse dependencies
  const dependencies = parseDependencies(rawMetadata.get('dependencies'));

  // Parse optimization level constraints
  const minOptLevel = parseOptLevel(rawMetadata.get('min-opt-level'), 'min-opt-level', errors);
  const maxOptLevel = parseOptLevel(rawMetadata.get('max-opt-level'), 'max-opt-level', errors);

  // Return error result if validation failed
  if (errors.length > 0) {
    return {
      success: false,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Build metadata object
  const metadata: FixtureMetadata = {
    fixture: rawMetadata.get('fixture')!,
    category: category!,
    description: rawMetadata.get('description')!,
    expect: expect!,
  };

  // Add optional fields
  if (rawMetadata.has('error-code')) {
    metadata.errorCode = rawMetadata.get('error-code');
  }

  if (rawMetadata.has('error-message')) {
    metadata.errorMessage = rawMetadata.get('error-message');
  }

  if (outputChecks.length > 0) {
    metadata.outputChecks = outputChecks;
  }

  if (rawMetadata.has('skip')) {
    metadata.skip = rawMetadata.get('skip');
  }

  if (tags.length > 0) {
    metadata.tags = tags;
  }

  if (dependencies.length > 0) {
    metadata.dependencies = dependencies;
  }

  if (minOptLevel !== undefined) {
    metadata.minOptLevel = minOptLevel;
  }

  if (maxOptLevel !== undefined) {
    metadata.maxOptLevel = maxOptLevel;
  }

  return {
    success: true,
    metadata,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Infers fixture category from the file path.
 *
 * @param filePath - File path relative to fixtures directory
 * @returns Inferred category or undefined
 */
export function inferCategoryFromPath(filePath: string): FixtureCategory | undefined {
  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Check each category directory prefix
  for (const [dirPrefix, category] of Object.entries(CATEGORY_DIR_MAP)) {
    if (normalizedPath.includes(`/${dirPrefix}/`) || normalizedPath.startsWith(`${dirPrefix}/`)) {
      return category;
    }
  }

  return undefined;
}

/**
 * Parses output check annotations from metadata.
 *
 * Supports multiple formats:
 *   @output-check: Contains "pattern"
 *   @output-contains: pattern
 *   @output-not-contains: pattern
 *   @output-matches: /regex/
 *
 * @param metadata - Raw metadata map
 * @param errors - Error array to populate
 * @returns Array of output checks
 */
function parseOutputChecks(metadata: Map<string, string>, errors: string[]): OutputCheck[] {
  const checks: OutputCheck[] = [];

  // Parse @output-check field (generic format)
  const outputCheck = metadata.get('output-check');
  if (outputCheck) {
    const check = parseOutputCheckValue(outputCheck, errors);
    if (check) {
      checks.push(check);
    }
  }

  // Parse @output-contains shorthand
  const outputContains = metadata.get('output-contains');
  if (outputContains) {
    checks.push({
      type: OutputCheckType.Contains,
      pattern: outputContains,
    });
  }

  // Parse @output-not-contains shorthand
  const outputNotContains = metadata.get('output-not-contains');
  if (outputNotContains) {
    checks.push({
      type: OutputCheckType.NotContains,
      pattern: outputNotContains,
    });
  }

  // Parse @output-matches shorthand
  const outputMatches = metadata.get('output-matches');
  if (outputMatches) {
    checks.push({
      type: OutputCheckType.Matches,
      pattern: outputMatches,
    });
  }

  return checks;
}

/**
 * Parses a single output check value in the format: Type "pattern"
 *
 * @param value - The raw output-check value
 * @param errors - Error array to populate
 * @returns Parsed output check or undefined
 */
function parseOutputCheckValue(value: string, errors: string[]): OutputCheck | undefined {
  // Match: Contains "pattern" or NotContains "pattern" etc.
  const match = value.match(/^(Contains|NotContains|Matches|SizeConstraint)\s+"([^"]+)"(?:\s+(.*))?$/i);

  if (!match) {
    errors.push(`Invalid output-check format: '${value}'. Expected: Type "pattern"`);
    return undefined;
  }

  const typeStr = match[1].toLowerCase();
  const pattern = match[2];
  const description = match[3];

  let type: OutputCheckType;
  switch (typeStr) {
    case 'contains':
      type = OutputCheckType.Contains;
      break;
    case 'notcontains':
      type = OutputCheckType.NotContains;
      break;
    case 'matches':
      type = OutputCheckType.Matches;
      break;
    case 'sizeconstraint':
      type = OutputCheckType.SizeConstraint;
      break;
    default:
      errors.push(`Unknown output check type: '${typeStr}'`);
      return undefined;
  }

  return {
    type,
    pattern,
    description,
  };
}

/**
 * Parses comma-separated tags string.
 *
 * @param tagsStr - Raw tags string
 * @returns Array of tag strings
 */
function parseTags(tagsStr: string | undefined): string[] {
  if (!tagsStr) {
    return [];
  }

  return tagsStr
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/**
 * Parses comma-separated dependencies string.
 *
 * @param depsStr - Raw dependencies string
 * @returns Array of dependency paths
 */
function parseDependencies(depsStr: string | undefined): string[] {
  if (!depsStr) {
    return [];
  }

  return depsStr
    .split(',')
    .map((dep) => dep.trim())
    .filter((dep) => dep.length > 0);
}

/**
 * Parses an optimization level value.
 *
 * @param value - Raw value string
 * @param fieldName - Field name for error messages
 * @param errors - Error array to populate
 * @returns Parsed level or undefined
 */
function parseOptLevel(
  value: string | undefined,
  fieldName: string,
  errors: string[],
): number | undefined {
  if (!value) {
    return undefined;
  }

  const level = parseInt(value, 10);
  if (isNaN(level) || level < 0) {
    errors.push(`Invalid ${fieldName} value: '${value}'. Expected non-negative integer.`);
    return undefined;
  }

  return level;
}

/**
 * Validates that a fixture file has the minimum required structure.
 *
 * @param source - Source code content
 * @returns true if the file appears to be a fixture
 */
export function isFixtureFile(source: string): boolean {
  // A fixture file must have at least @fixture annotation
  // Check each line individually since the regex needs to match a full line
  const lines = source.split('\n');
  const hasMetadataLine = lines.some((line) => METADATA_LINE_REGEX.test(line));
  return hasMetadataLine && source.includes('@fixture:');
}

/**
 * Extracts just the fixture identifier from source code (for quick scanning).
 *
 * @param source - Source code content
 * @returns Fixture identifier or undefined
 */
export function extractFixtureId(source: string): string | undefined {
  const match = source.match(/@fixture:\s*([^\n]+)/);
  return match ? match[1].trim() : undefined;
}