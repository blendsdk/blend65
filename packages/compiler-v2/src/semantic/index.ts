/**
 * Semantic Analysis module for Blend65 v2
 *
 * Responsible for type checking, symbol resolution, and recursion detection.
 * This is a migration from v1 with SSA preparation removed and
 * call graph + recursion detection added.
 *
 * **Key Components:**
 * - Symbol Table: Variable and function symbol management
 * - Type System: Type definitions and checking
 * - Type Checker: Semantic validation
 * - Call Graph: Function call relationship tracking
 * - Recursion Detection: Compile-time cycle detection (SFA requirement)
 *
 * @module semantic
 */

// Will be populated in Phase 5: Semantic Migration
// export * from './symbol-table.js';
// export * from './types.js';
// export * from './type-checker.js';
// export * from './call-graph.js';
// export * from './recursion-check.js';