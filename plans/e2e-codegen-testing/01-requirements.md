# Requirements: E2E CodeGen Testing

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Create a comprehensive end-to-end testing framework that validates the entire Blend65 compilation pipeline, identifying all gaps between language specification and actual implementation.

## Functional Requirements

### Must Have

- [ ] Test infrastructure that compiles Blend code programmatically
- [ ] ASM output validator that checks for expected patterns
- [ ] Test categories covering all language features
- [ ] Clear distinction between "bug" and "not implemented"
- [ ] Test helper functions for common patterns
- [ ] Integration with existing Vitest test runner

### Should Have

- [ ] Automatic gap report generation
- [ ] Test result summary by category
- [ ] Performance benchmarks for compilation time

### Won't Have (Out of Scope)

- Emulator-based runtime testing (future phase)
- Visual diff tools for ASM comparison
- CI/CD integration (separate task)

## Test Scope

### Layer 1: Semantic Validation

Tests what the compiler **accepts** or **rejects**:

| Category | Test Focus |
|----------|------------|
| **Type Acceptance** | Which types are valid in which contexts |
| **Intrinsic Signatures** | What arguments intrinsics accept |
| **Variable Scopes** | Local, global, parameter visibility |
| **Import/Export** | Module system validation |

**Example Test:**
```typescript
it('length() should accept string type', () => {
  const result = compile(`
    let msg: string = "hello";
    let len = length(msg);
  `);
  expect(result.errors).toHaveLength(0); // Should compile
});
```

### Layer 2: Code Generation

Tests what assembly **gets generated**:

| Category | Test Focus |
|----------|------------|
| **Literals** | Numbers, arrays, strings in data section |
| **Global Variables** | Initialization, storage allocation |
| **Local Variables** | Stack/ZP allocation, load/store |
| **Expressions** | Arithmetic, logical, bitwise |
| **Control Flow** | If/else, loops, branches |
| **Functions** | Calls, parameters, returns |
| **Intrinsics** | Correct instruction sequences |
| **Memory** | @map, peek/poke patterns |

**Example Test:**
```typescript
it('array literal generates correct bytes', () => {
  const asm = compileToAsm(`let data: byte[3] = [1, 2, 3];`);
  expect(asm).toContain('!byte $01, $02, $03');
});
```

## Known Issues to Test

These are **already identified** issues that MUST have tests:

| Issue | Category | Current Behavior |
|-------|----------|------------------|
| Array initializers | CodeGen | Generates `$00` instead of values |
| Local variables | CodeGen | `STUB: Unknown variable` |
| `length(string)` | Semantic | Type error, expects `byte[]` |

## Technical Requirements

### Test Helper Functions

```typescript
// Core helpers needed
function compile(source: string): CompileResult;
function compileToAsm(source: string): string;
function expectNoErrors(result: CompileResult): void;
function expectError(result: CompileResult, code: string): void;
function expectAsmContains(asm: string, pattern: string | RegExp): void;
function expectAsmNotContains(asm: string, pattern: string | RegExp): void;
```

### Test Organization

```
packages/compiler/src/__tests__/e2e/
├── helpers/
│   ├── compile-helper.ts    # Compilation utilities
│   └── asm-validator.ts     # ASM pattern matching
├── semantic/
│   ├── type-acceptance.test.ts
│   ├── intrinsic-signatures.test.ts
│   └── scopes.test.ts
└── codegen/
    ├── literals.test.ts
    ├── variables.test.ts
    ├── expressions.test.ts
    ├── control-flow.test.ts
    ├── functions.test.ts
    └── intrinsics.test.ts
```

## Acceptance Criteria

1. [ ] Test infrastructure runs via `./compiler-test e2e`
2. [ ] At least 100 test cases across all categories
3. [ ] All known issues have corresponding failing tests
4. [ ] Each test is clearly documented with purpose
5. [ ] Gap report shows: feature, expected, actual, status
6. [ ] Easy to add new tests following established patterns