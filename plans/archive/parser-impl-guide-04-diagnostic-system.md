# Guide 04: Diagnostic System 🔍

**Estimated time:** 25 minutes  
**Difficulty:** Medium  
**File to create:** `packages/compiler/src/ast/diagnostics.ts`

---

## What You're Building

A professional error/warning/info system for the compiler:
- Structured diagnostics (not just thrown errors)
- Severity levels (error, warning, info, hint)
- Error codes (for programmatic handling)
- Diagnostic collector (accumulates multiple errors)
- IDE-ready format

**Why this matters:**
- Users see ALL errors, not just the first one
- IDE integration (VS Code, etc.)
- Programmatic error handling
- Clear, actionable error messages
- Used by TypeScript, Rust, GCC, Clang

---

## Prerequisites

- [x] Guide 03 completed (`base.ts` exists)
- [x] Understanding of error handling strategies
- [x] Familiarity with compiler error messages

---

## The Problem with Throwing Errors

### **Bad Approach:**
```typescript
parse() {
  if (error1) throw new Error("Error 1");
  // User never sees errors 2, 3, 4...
}
```

**Problems:**
- ❌ Only see one error at a time
- ❌ Poor user experience (fix → recompile → see next error)
- ❌ No programmatic handling
- ❌ No severity levels (everything is fatal)

### **Professional Approach:**
```typescript
parse() {
  if (error1) diagnostics.error("...");
  if (error2) diagnostics.error("...");
  if (warning1) diagnostics.warning("...");
  // Continue parsing, collect all issues
  return { ast, diagnostics: diagnostics.getAll() };
}
```

**Benefits:**
- ✅ See all errors at once
- ✅ Distinguish errors from warnings
- ✅ Continue parsing when possible
- ✅ IDE can show all issues inline

---

## Task 4.1: Create diagnostics.ts File

```bash
touch packages/compiler/src/ast/diagnostics.ts
```

---

## Task 4.2: Add Diagnostic Severity Enum

```typescript
/**
 * Diagnostic System for Blend65 Compiler
 * 
 * Provides structured error reporting with severity levels,
 * error codes, and source locations for IDE integration.
 */

import { SourceLocation } from './base.js';

/**
 * Diagnostic severity levels
 * 
 * Used to categorize issues by importance:
 * - ERROR: Compilation cannot proceed (syntax errors, type errors)
 * - WARNING: Suspicious code that might cause bugs
 * - INFO: Informational messages (deprecation notices, suggestions)
 * - HINT: Style suggestions, code improvements
 * 
 * Similar to:
 * - TypeScript's DiagnosticCategory
 * - Rust's diagnostic levels
 * - VS Code's DiagnosticSeverity
 */
export enum DiagnosticSeverity {
  /**
   * Fatal error - compilation cannot proceed
   * Examples: syntax errors, type mismatches, undefined variables
   */
  ERROR = 'error',
  
  /**
   * Warning - code is valid but suspicious
   * Examples: unused variables, implicit type conversions
   */
  WARNING = 'warning',
  
  /**
   * Informational message
   * Examples: deprecation notices, performance tips
   */
  INFO = 'info',
  
  /**
   * Style or code improvement suggestion
   * Examples: formatting suggestions, simplifications
   */
  HINT = 'hint',
}
```

---

## Task 4.3: Add Diagnostic Code Enum

```typescript
/**
 * Diagnostic code enumeration
 * 
 * Unique identifier for each type of diagnostic.
 * Enables:
 * - Programmatic error handling (suppress specific warnings)
 * - Documentation links (error code → help page)
 * - IDE quick fixes (code → suggested fix)
 * - Analytics (which errors are most common)
 * 
 * Naming convention: [Category][Number]
 * - P = Parser errors (P001, P002, ...)
 * - S = Semantic errors (S001, S002, ...)
 * - W = Warnings (W001, W002, ...)
 * 
 * Per .clinerules: Use enums instead of magic strings
 */
export enum DiagnosticCode {
  // ============================================
  // PARSER ERRORS (P001-P099)
  // ============================================
  
  /** Unexpected token found */
  UNEXPECTED_TOKEN = 'P001',
  
  /** Expected specific token but found something else */
  EXPECTED_TOKEN = 'P002',
  
  /** Duplicate module declaration in same file */
  DUPLICATE_MODULE = 'P003',
  
  /** Invalid construct at module scope */
  INVALID_MODULE_SCOPE = 'P004',
  
  /** Block statement not properly terminated */
  UNTERMINATED_BLOCK = 'P005',
  
  /** Missing 'end' keyword for block */
  MISSING_END_KEYWORD = 'P006',
  
  /** Invalid number literal format */
  INVALID_NUMBER_LITERAL = 'P007',
  
  /** Unterminated string literal */
  UNTERMINATED_STRING = 'P008',
  
  // ============================================
  // IMPORT/EXPORT ERRORS (P100-P199)
  // ============================================
  
  /** Wildcard in module path (not supported) */
  WILDCARD_IN_PATH = 'P101',
  
  /** Re-export not supported */
  REEXPORT_NOT_SUPPORTED = 'P102',
  
  /** Import statement malformed */
  INVALID_IMPORT_SYNTAX = 'P103',
  
  /** Export without declaration */
  EXPORT_REQUIRES_DECLARATION = 'P104',
  
  // ============================================
  // ORDERING ERRORS (P200-P299)
  // ============================================
  
  /** Module declaration after implicit global */
  MODULE_AFTER_IMPLICIT = 'P201',
  
  /** Executable statement at module scope */
  EXECUTABLE_AT_MODULE_SCOPE = 'P202',
  
  /** Declaration appears after executable code */
  DECLARATION_AFTER_CODE = 'P203',
  
  // ============================================
  // WARNINGS (W001-W099)
  // ============================================
  
  /** Main function not explicitly exported */
  IMPLICIT_MAIN_EXPORT = 'W001',
  
  /** Variable declared but never used */
  UNUSED_VARIABLE = 'W002',
  
  /** Function declared but never called */
  UNUSED_FUNCTION = 'W003',
  
  /** Unreachable code detected */
  UNREACHABLE_CODE = 'W004',
  
  // ============================================
  // SEMANTIC ERRORS (S001-S099)
  // ============================================
  // These will be used by semantic analyzer (future)
  
  /** Undefined variable referenced */
  UNDEFINED_VARIABLE = 'S001',
  
  /** Type mismatch in assignment or operation */
  TYPE_MISMATCH = 'S002',
  
  /** Constant declared without initializer */
  MISSING_CONST_INITIALIZER = 'S003',
  
  /** Duplicate declaration of same name */
  DUPLICATE_DECLARATION = 'S004',
  
  /** Multiple exported main functions */
  DUPLICATE_EXPORTED_MAIN = 'S005',
}
```

---

## Task 4.4: Add Diagnostic Interface

```typescript
/**
 * Structured diagnostic with rich context
 * 
 * Represents a single issue (error/warning/info/hint) with:
 * - Unique code for programmatic handling
 * - Severity level for filtering/display
 * - Human-readable message
 * - Source location for IDE highlighting
 * - Optional related locations (multi-part errors)
 * - Optional suggested fixes (IDE quick-fix support)
 * 
 * Design matches IDE expectations:
 * - VS Code DiagnosticData
 * - Language Server Protocol Diagnostic
 */
export interface Diagnostic {
  /**
   * Diagnostic code for programmatic handling
   * Example: 'P001', 'S002', 'W003'
   */
  code: DiagnosticCode;
  
  /**
   * Severity level (error, warning, info, hint)
   */
  severity: DiagnosticSeverity;
  
  /**
   * Human-readable message
   * 
   * Should be:
   * - Clear and actionable
   * - Include context (what went wrong, where, why)
   * - Suggest fixes when possible
   * 
   * Example: "Expected ')' after function parameters, but found ']'"
   */
  message: string;
  
  /**
   * Primary source location of the issue
   * Used by IDE to highlight problematic code
   */
  location: SourceLocation;
  
  /**
   * Optional: Related locations for multi-part diagnostics
   * 
   * Example: "Variable 'x' declared here but used as different type there"
   * - Primary location: where type mismatch occurred
   * - Related location: where variable was declared
   */
  relatedLocations?: Array<{
    /** Location of related code */
    location: SourceLocation;
    
    /** Explanation of relationship */
    message: string;
  }>;
  
  /**
   * Optional: Suggested fixes for IDE quick-fix feature
   * 
   * Example: User wrote 'functino' → suggest 'function'
   * IDE can offer "Did you mean 'function'?" with auto-fix
   */
  fixes?: Array<{
    /** Description of what fix does */
    message: string;
    
    /** Code edits to apply */
    edits: Array<{
      /** Where to make the edit */
      location: SourceLocation;
      
      /** New text to insert */
      newText: string;
    }>;
  }>;
}
```

---

## Task 4.5: Add DiagnosticCollector Class

```typescript
/**
 * Collects diagnostics during compilation
 * 
 * Used throughout compiler stages:
 * - Lexer: Reports invalid tokens
 * - Parser: Reports syntax errors
 * - Semantic analyzer: Reports type errors, undefined variables
 * - Code generator: Reports generation issues
 * 
 * Design:
 * - Accumulates issues (doesn't throw)
 * - Provides helper methods for common cases
 * - Can check if any errors occurred
 * - Returns all diagnostics at end
 */
export class DiagnosticCollector {
  /** Array of collected diagnostics */
  protected diagnostics: Diagnostic[] = [];
  
  /**
   * Adds an error diagnostic
   * 
   * Helper method for the common case of reporting an error.
   * 
   * @param code - The error code
   * @param message - Human-readable error message
   * @param location - Where the error occurred
   */
  public error(
    code: DiagnosticCode,
    message: string,
    location: SourceLocation
  ): void {
    this.add({
      code,
      severity: DiagnosticSeverity.ERROR,
      message,
      location,
    });
  }
  
  /**
   * Adds a warning diagnostic
   * 
   * @param code - The warning code
   * @param message - Human-readable warning message
   * @param location - Where the warning occurred
   */
  public warning(
    code: DiagnosticCode,
    message: string,
    location: SourceLocation
  ): void {
    this.add({
      code,
      severity: DiagnosticSeverity.WARNING,
      message,
      location,
    });
  }
  
  /**
   * Adds an info diagnostic
   * 
   * @param code - The info code
   * @param message - Informational message
   * @param location - Related location
   */
  public info(
    code: DiagnosticCode,
    message: string,
    location: SourceLocation
  ): void {
    this.add({
      code,
      severity: DiagnosticSeverity.INFO,
      message,
      location,
    });
  }
  
  /**
   * Adds a hint diagnostic
   * 
   * @param code - The hint code
   * @param message - Suggestion message
   * @param location - Related location
   */
  public hint(
    code: DiagnosticCode,
    message: string,
    location: SourceLocation
  ): void {
    this.add({
      code,
      severity: DiagnosticSeverity.HINT,
      message,
      location,
    });
  }
  
  /**
   * Adds a complete diagnostic object
   * 
   * Use this when you need to specify related locations or fixes.
   * For simple cases, use error(), warning(), etc.
   * 
   * @param diagnostic - Complete diagnostic to add
   */
  public add(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }
  
  /**
   * Gets all collected diagnostics
   * 
   * Returns a copy to prevent external modification.
   * 
   * @returns Array of all diagnostics
   */
  public getAll(): Diagnostic[] {
    return [...this.diagnostics];
  }
  
  /**
   * Gets only error diagnostics
   * 
   * Useful for checking if compilation can proceed.
   * 
   * @returns Array of error diagnostics
   */
  public getErrors(): Diagnostic[] {
    return this.diagnostics.filter(
      d => d.severity === DiagnosticSeverity.ERROR
    );
  }
  
  /**
   * Checks if any errors were collected
   * 
   * Use this to determine if compilation failed.
   * Warnings/info/hints don't prevent compilation.
   * 
   * @returns True if at least one error exists
   */
  public hasErrors(): boolean {
    return this.getErrors().length > 0;
  }
  
  /**
   * Gets count of diagnostics by severity
   * 
   * @returns Object with counts for each severity level
   */
  public getCounts(): {
    errors: number;
    warnings: number;
    info: number;
    hints: number;
  } {
    return {
      errors: this.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR).length,
      warnings: this.diagnostics.filter(d => d.severity === DiagnosticSeverity.WARNING).length,
      info: this.diagnostics.filter(d => d.severity === DiagnosticSeverity.INFO).length,
      hints: this.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT).length,
    };
  }
  
  /**
   * Clears all diagnostics
   * 
   * Useful when reusing collector for multiple files.
   */
  public clear(): void {
    this.diagnostics = [];
  }
}
```

---

## Validation Checklist

- [ ] File `diagnostics.ts` created
- [ ] `DiagnosticSeverity` enum with 4 levels
- [ ] `DiagnosticCode` enum with meaningful codes
- [ ] `Diagnostic` interface with all required fields
- [ ] `DiagnosticCollector` class with helper methods
- [ ] All exports use `export` keyword
- [ ] Comprehensive JSDoc on all types
- [ ] Import uses `.js` extension
- [ ] File compiles: `yarn build` passes

---

## Common Mistakes

❌ **Using magic strings for codes**
```typescript
diagnostics.error("P001", ...); // String literal - easy to mistype!
```
✅ Use enum: `diagnostics.error(DiagnosticCode.UNEXPECTED_TOKEN, ...)`

❌ **Throwing errors in parser**
```typescript
if (error) throw new Error("..."); // Stops at first error!
```
✅ Report and continue: `diagnostics.error(...); synchronize();`

❌ **Not checking hasErrors() before proceeding**
```typescript
const ast = parser.parse();
codegen(ast); // Might crash if AST is incomplete!
```
✅ Check errors: `if (!diagnostics.hasErrors()) { codegen(ast); }`

---

## Self-Review Questions

**Q: Why collect diagnostics instead of throwing?**  
A: So users see ALL errors at once, not one-at-a-time. Much better UX!

**Q: When should I use WARNING vs ERROR?**  
A: ERROR = compilation cannot proceed. WARNING = code works but might be buggy.

**Q: Why use enum for codes instead of strings?**  
A: Type safety, auto-complete, refactoring support, no typos. Per .clinerules philosophy.

**Q: What's the point of severity levels?**  
A: Users can filter (show only errors), IDEs can color-code, CI can fail on errors but allow warnings.

---

## What's Next?

✅ **Guide 04 complete?** Proceed to **Guide 05: Concrete AST Nodes (Part 1)**

In the next guide, you'll create:
- `Program` node (root)
- `ModuleDecl` node
- `ImportDecl` node
- `ExportDecl` node

**Estimated time:** 30 minutes

---

## Quick Reference

**File:** `packages/compiler/src/ast/diagnostics.ts`  
**Lines of code:** ~350 (with extensive docs)  
**Key exports:** 4 types + 1 class  
**Used by:** Parser, semantic analyzer, all compiler stages

---

_Guide 04 complete! You now have professional error handling infrastructure._
