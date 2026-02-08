/**
 * End-to-End Test Utilities for Optimizer Testing
 *
 * This module provides utilities for compiling Blend source code at different
 * optimization levels and comparing metrics between optimization levels.
 *
 * @module e2e/e2e-test-utils
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory containing this file for relative fixture paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Optimization levels supported by the compiler.
 */
export type OptimizationLevel = 'O0' | 'O1' | 'O2' | 'O3' | 'Os' | 'Oz';

/**
 * Result of compiling a source file.
 */
export interface CompilationResult {
  /** Whether compilation was successful */
  success: boolean;

  /** Generated assembly code (if successful) */
  asm: string;

  /** Number of instructions in the generated assembly */
  instructionCount: number;

  /** Estimated cycle count (if available) */
  cycleCount: number;

  /** Number of bytes in the generated code */
  byteCount: number;

  /** Compilation errors (if any) */
  errors: string[];

  /** Optimization level used */
  level: OptimizationLevel;
}

/**
 * Options for compilation.
 */
export interface CompileOptions {
  /** Optimization level (default: O0) */
  level?: OptimizationLevel;

  /** Target platform (default: c64) */
  target?: 'c64' | 'c128' | 'x16';

  /** Enable verbose output */
  verbose?: boolean;
}

/**
 * Metrics comparison result.
 */
export interface MetricsComparison {
  /** Instruction count reduction (positive = improvement) */
  instructionReduction: number;

  /** Cycle count reduction (positive = improvement) */
  cycleReduction: number;

  /** Byte count reduction (positive = improvement) */
  byteReduction: number;

  /** Whether the optimized version is better */
  isImproved: boolean;
}

/**
 * Load a fixture file from the fixtures directory.
 *
 * @param fixturePath - Relative path from the fixtures directory
 * @returns The contents of the fixture file
 * @throws Error if the fixture file doesn't exist
 */
export function loadFixture(fixturePath: string): string {
  const fullPath = join(__dirname, 'fixtures', fixturePath);

  if (!existsSync(fullPath)) {
    throw new Error(`Fixture not found: ${fixturePath} (${fullPath})`);
  }

  return readFileSync(fullPath, 'utf-8');
}

/**
 * Check if a fixture file exists.
 *
 * @param fixturePath - Relative path from the fixtures directory
 * @returns true if the fixture exists
 */
export function fixtureExists(fixturePath: string): boolean {
  const fullPath = join(__dirname, 'fixtures', fixturePath);
  return existsSync(fullPath);
}

/**
 * Compile a Blend source file at the specified optimization level.
 *
 * NOTE: This is a scaffold implementation. The actual compilation
 * will be implemented when the optimizer is ready.
 *
 * @param source - Blend source code or fixture path
 * @param options - Compilation options
 * @returns Compilation result with metrics
 */
export function compile(
  source: string,
  options: CompileOptions = {}
): CompilationResult {
  const level = options.level ?? 'O0';

  // If source looks like a fixture path, load it
  const sourceCode = source.includes('\n') || !source.endsWith('.blend')
    ? source
    : loadFixture(source);

  // TODO: Replace with actual compilation when optimizer is implemented
  // For now, return a placeholder result for test scaffolding

  // Placeholder: simulate different instruction counts for different levels
  // Note: Os/Oz are size-optimized, so they produce smaller byte counts
  const baseInstructionCount = countSourceLines(sourceCode) * 5;
  const levelMultiplier: Record<OptimizationLevel, number> = {
    O0: 1.0,
    O1: 0.8,
    O2: 0.7,
    O3: 0.65,
    Os: 0.68,  // Os produces smaller code than O2
    Oz: 0.65,  // Oz produces smallest code
  };

  const instructionCount = Math.floor(baseInstructionCount * levelMultiplier[level]);
  const cycleCount = instructionCount * 3; // Rough estimate
  const byteCount = instructionCount * 2; // Rough estimate

  return {
    success: true,
    asm: `; Placeholder ASM for ${level}\n; Source has ${countSourceLines(sourceCode)} lines\n`,
    instructionCount,
    cycleCount,
    byteCount,
    errors: [],
    level,
  };
}

/**
 * Compile a fixture file at multiple optimization levels and compare metrics.
 *
 * @param fixturePath - Path to the fixture file
 * @param levelA - First optimization level
 * @param levelB - Second optimization level
 * @returns Metrics comparison between the two levels
 */
export function compareOptimizationLevels(
  fixturePath: string,
  levelA: OptimizationLevel,
  levelB: OptimizationLevel
): MetricsComparison {
  const resultA = compile(fixturePath, { level: levelA });
  const resultB = compile(fixturePath, { level: levelB });

  const instructionReduction = resultA.instructionCount - resultB.instructionCount;
  const cycleReduction = resultA.cycleCount - resultB.cycleCount;
  const byteReduction = resultA.byteCount - resultB.byteCount;

  return {
    instructionReduction,
    cycleReduction,
    byteReduction,
    isImproved: instructionReduction > 0 || cycleReduction > 0 || byteReduction > 0,
  };
}

/**
 * Count the number of meaningful source lines (excluding comments and empty lines).
 *
 * @param source - Blend source code
 * @returns Number of meaningful lines
 */
function countSourceLines(source: string): number {
  return source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//');
    })
    .length;
}

/**
 * Count occurrences of a pattern in assembly output.
 *
 * @param asm - Assembly code
 * @param pattern - Pattern to search for (string or regex)
 * @returns Number of occurrences
 */
export function countPatternInAsm(asm: string, pattern: string | RegExp): number {
  if (typeof pattern === 'string') {
    return (asm.match(new RegExp(pattern, 'g')) || []).length;
  }
  return (asm.match(pattern) || []).length;
}

/**
 * Check if assembly output contains a specific instruction.
 *
 * @param asm - Assembly code
 * @param instruction - Instruction mnemonic (e.g., 'ASL', 'LDA')
 * @returns true if the instruction is present
 */
export function asmContainsInstruction(asm: string, instruction: string): boolean {
  // Match instruction at word boundary
  const pattern = new RegExp(`\\b${instruction}\\b`, 'i');
  return pattern.test(asm);
}

/**
 * Check if assembly output does NOT contain a specific instruction.
 *
 * @param asm - Assembly code
 * @param instruction - Instruction mnemonic
 * @returns true if the instruction is NOT present
 */
export function asmDoesNotContainInstruction(asm: string, instruction: string): boolean {
  return !asmContainsInstruction(asm, instruction);
}

/**
 * Get all fixtures in a directory.
 *
 * @param directory - Directory name under fixtures/
 * @returns Array of fixture file names
 */
export function getFixturesInDirectory(directory: string): string[] {
  const fs = require('fs') as typeof import('fs');
  const fullPath = join(__dirname, 'fixtures', directory);

  if (!existsSync(fullPath)) {
    return [];
  }

  return fs
    .readdirSync(fullPath)
    .filter((file: string) => file.endsWith('.blend'))
    .map((file: string) => join(directory, file));
}