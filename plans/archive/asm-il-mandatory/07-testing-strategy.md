# Testing Strategy: ASM-IL Mandatory

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit tests: 95%+ coverage for modified code
- Integration tests: All codegen flows verified
- E2E tests: Complete compilation pipeline works
- Regression tests: All 7,000+ existing tests pass

## Test Categories

### Unit Tests

| Test                                   | Description                         | Priority |
| -------------------------------------- | ----------------------------------- | -------- |
| AsmModuleBuilder instruction methods   | Each instruction emits correct node | High     |
| AsmModuleBuilder source location       | Locations preserved on nodes        | High     |
| AcmeEmitter source comments            | Source locations in output          | High     |
| AcmeEmitter instruction formatting     | Correct ACME syntax                 | High     |
| BaseCodeGenerator emit methods         | Only uses AsmBuilder                | High     |
| InstructionGenerator generateXxx       | Correct ASM-IL nodes emitted        | High     |
| CodeGenerator generate()               | Full flow works                     | High     |
| VICE label generation from ASM-IL      | Correct label format                | Medium   |
| Source map extraction from ASM-IL      | Correct address mapping             | Medium   |

### Integration Tests

| Test                           | Components                          | Description                    |
| ------------------------------ | ----------------------------------- | ------------------------------ |
| Full compilation flow          | CodeGen → ASM-IL → Emitter → ACME   | Complete pipeline works        |
| Source location flow           | IL → CodeGen → ASM-IL → Output      | Locations preserved end-to-end |
| Multi-function compilation     | Multiple functions in one module    | Labels resolved correctly      |
| Global variable allocation     | ZP, RAM, DATA, MAP                  | Correct addresses              |
| BASIC stub generation          | ASM-IL data directives              | Valid C64 autostart            |

### End-to-End Tests

| Scenario                     | Steps                                | Expected Result              |
| ---------------------------- | ------------------------------------ | ---------------------------- |
| Simple program               | Compile hello.blend → .prg          | Runs on C64                  |
| Hardware access              | Compile border change → .prg        | Border color changes         |
| Control flow                 | Compile loops/conditions → .prg     | Correct behavior             |
| Function calls               | Compile multi-function → .prg       | Functions execute correctly  |
| Debug mode compilation       | Compile with --debug → .asm         | Source comments in output    |

## Test Data

### Fixtures Needed

**Existing fixtures** (in `fixtures/`) cover most cases. Additional fixtures:

```
fixtures/06-codegen/
├── asm-il/
│   ├── source-location-simple.blend      # Single instruction
│   ├── source-location-multi.blend       # Multiple instructions per line
│   ├── source-location-loop.blend        # Loop with location
│   └── no-source-location.blend          # Compiler-generated code
```

### Mock Requirements

**Prefer real objects** per code.md Rule 25. No mocking needed for this change.

## Verification Checklist

### Pre-Implementation
- [ ] Document current assembly output for key test cases
- [ ] Create baseline snapshots for comparison

### During Implementation
- [ ] Run targeted tests after each file change
- [ ] Verify no regressions in modified areas

### Post-Implementation
- [ ] All unit tests pass: `./compiler-test codegen`
- [ ] All ASM-IL tests pass: `./compiler-test asm-il`
- [ ] All integration tests pass: `./compiler-test integration`
- [ ] All E2E tests pass: `./compiler-test e2e`
- [ ] Full test suite passes: `./compiler-test`
- [ ] Test coverage meets goals

## Specific Test Cases

### 1. AsmBuilder Source Location Tests

```typescript
describe('AsmModuleBuilder with source locations', () => {
  it('should preserve source location on LDA immediate', () => {
    const builder = new AsmModuleBuilder('test');
    const loc: SourceLocation = {
      file: 'test.blend',
      start: { line: 10, column: 5, offset: 100 },
      end: { line: 10, column: 20, offset: 115 },
    };
    
    builder.ldaImm(42, 'Load value', loc);
    const module = builder.build();
    
    expect(module.items[0]).toMatchObject({
      kind: 'instruction',
      mnemonic: 'LDA',
      sourceLocation: loc,
    });
  });
});
```

### 2. AcmeEmitter Source Comment Tests

```typescript
describe('AcmeEmitter source comments', () => {
  it('should emit source location comment when enabled', () => {
    const emitter = createAcmeEmitter({ includeSourceComments: true });
    const module = createTestModule();
    
    const result = emitter.emit(module);
    
    expect(result.text).toContain('; test.blend:10:5');
    expect(result.text).toContain('LDA #$2A');
  });
  
  it('should not emit source comment when disabled', () => {
    const emitter = createAcmeEmitter({ includeSourceComments: false });
    const module = createTestModule();
    
    const result = emitter.emit(module);
    
    expect(result.text).not.toContain('; test.blend');
  });
});
```

### 3. CodeGenerator ASM-IL Output Tests

```typescript
describe('CodeGenerator produces ASM-IL', () => {
  it('should always produce AsmModule', () => {
    const generator = new CodeGenerator();
    const result = generator.generate(testILModule, options);
    
    expect(result.module).toBeDefined();
    expect(result.module.items.length).toBeGreaterThan(0);
  });
  
  it('should not use AssemblyWriter', () => {
    // Verify AssemblyWriter is not called
    // This is structural - verify no assemblyWriter property exists
    const generator = new CodeGenerator();
    expect((generator as any).assemblyWriter).toBeUndefined();
  });
});
```

### 4. Regression Test: Assembly Output Equivalence

```typescript
describe('Assembly output equivalence', () => {
  it('should produce equivalent assembly', () => {
    // Load baseline assembly from before refactor
    const baseline = readFileSync('fixtures/baseline/simple.asm', 'utf-8');
    
    // Compile with new ASM-IL path
    const result = compile('fixtures/simple.blend');
    
    // Normalize and compare (ignoring whitespace/comment differences)
    expect(normalizeAsm(result.assembly)).toEqual(normalizeAsm(baseline));
  });
});
```

### 5. Source Location Preservation E2E

```typescript
describe('Source location E2E', () => {
  it('should have correct line numbers in debug output', () => {
    const result = compile('fixtures/debug-test.blend', { debug: 'inline' });
    
    // Line 5: let x: byte = 10;
    expect(result.assembly).toContain('; debug-test.blend:5');
    
    // Line 10: borderColor = x;
    expect(result.assembly).toContain('; debug-test.blend:10');
  });
});
```

## Test Execution Commands

```bash
# Run all codegen tests
./compiler-test codegen

# Run all ASM-IL tests
./compiler-test asm-il

# Run specific test file
./compiler-test asm-il/builder

# Run E2E tests
./compiler-test e2e

# Run full test suite
./compiler-test
```

## Success Metrics

| Metric                    | Target              |
| ------------------------- | ------------------- |
| Test pass rate            | 100%                |
| Code coverage (modified)  | 95%+                |
| Regression count          | 0                   |
| New tests added           | 20-30               |
| Assembly output match     | 100% (normalized)   |