/**
 * Test helpers for building compiler artifacts from source
 *
 * These builders provide a convenient way to create AST, symbol tables,
 * and call graphs from source code for testing purposes.
 *
 * @module __tests__/frame/helpers/builders
 */

import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import {
  CallGraph,
  CallGraphBuilder,
  SymbolTableBuilder,
  SemanticAnalyzer,
} from '../../../semantic/index.js';
import type { Program } from '../../../ast/index.js';
import type { SymbolTable } from '../../../semantic/symbol-table.js';

/**
 * Parse source code into AST
 *
 * @param source - The source code to parse
 * @returns Parsed AST Program node
 */
export function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Build symbol table from source
 *
 * @param source - The source code to analyze
 * @returns Object containing the parsed program and symbol table
 */
export function buildSymbolTable(source: string): {
  program: Program;
  symbolTable: SymbolTable;
} {
  const program = parseSource(source);
  const builder = new SymbolTableBuilder();
  const result = builder.build(program);
  return { program, symbolTable: result.symbolTable };
}

/**
 * Build call graph from source
 *
 * This is the main entry point for most SFA tests - it provides
 * all the artifacts needed for frame allocation testing.
 *
 * @param source - The source code to analyze
 * @returns Object containing program, symbol table, and call graph
 */
export function buildCallGraph(source: string): {
  program: Program;
  symbolTable: SymbolTable;
  callGraph: CallGraph;
} {
  const { program, symbolTable } = buildSymbolTable(source);
  const builder = new CallGraphBuilder(symbolTable);
  const callGraph = builder.build(program);
  return { program, symbolTable, callGraph };
}

/**
 * Run full semantic analysis on source
 *
 * This provides the complete semantic analysis result, useful for
 * integration tests that need full analysis results.
 *
 * @param source - The source code to analyze
 * @returns Full semantic analysis result
 */
export function runSemanticAnalysis(source: string) {
  const program = parseSource(source);
  const analyzer = new SemanticAnalyzer();
  return analyzer.analyze(program);
}

/**
 * Create a minimal module wrapper for test code
 *
 * Wraps code in a module declaration to make it valid Blend code.
 *
 * @param code - The code to wrap
 * @param moduleName - The module name (default: 'Test.Module')
 * @returns Valid Blend source code with module wrapper
 */
export function wrapInModule(code: string, moduleName = 'Test.Module'): string {
  return `module ${moduleName};\n\n${code}`;
}

/**
 * Create a minimal function wrapper
 *
 * Wraps code in a function body to make it valid statement context.
 *
 * @param code - The code to wrap in a function body
 * @param funcName - The function name (default: 'test')
 * @returns Function declaration containing the code
 */
export function wrapInFunction(code: string, funcName = 'test'): string {
  return `function ${funcName}(): void {\n  ${code}\n}`;
}

/**
 * Create a complete Blend program with module and function
 *
 * Combines module and function wrappers for maximum convenience.
 *
 * @param code - The code to wrap
 * @param moduleName - The module name
 * @param funcName - The function name
 * @returns Complete valid Blend source code
 */
export function wrapInProgram(
  code: string,
  moduleName = 'Test.Module',
  funcName = 'main'
): string {
  return wrapInModule(wrapInFunction(code, funcName), moduleName);
}