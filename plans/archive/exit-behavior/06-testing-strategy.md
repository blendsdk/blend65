# Testing Strategy: Exit Behavior

> **Document**: 06-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit tests: 100% coverage for new code
- Integration tests: CLI → Compiler → CodeGenerator flow
- End-to-end tests: Full compilation with each exit behavior

## Test Categories

### Unit Tests

| Test | Description | File | Priority |
|------|-------------|------|----------|
| ExitBehavior type | Type is correctly defined | config/types.test.ts | High |
| generateExitCode('loop') | Emits infinite loop | code-generator.test.ts | High |
| generateExitCode('basic') | Emits JMP $A474 | code-generator.test.ts | High |
| generateExitCode('reset') | Emits JMP $FCE2 | code-generator.test.ts | High |
| Default behavior | Uses 'loop' when undefined | code-generator.test.ts | High |

### Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| CLI option parsing | CLI → Config | --exit-behavior parsed correctly |
| Config to codegen flow | Config → CodeGenerator | exitBehavior reaches code generator |
| blend65.json loading | ConfigLoader → Compiler | exitBehavior from config file |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Build with --exit-behavior=basic | CLI → full compilation | Assembly contains JMP $A474 |
| Build with --exit-behavior=reset | CLI → full compilation | Assembly contains JMP $FCE2 |
| Build with default | CLI → full compilation | Assembly contains JMP to self |

## Test Implementation

### Code Generator Unit Tests

Add to `packages/compiler/src/__tests__/codegen/code-generator.test.ts`:

```typescript
describe('exit behavior', () => {
  describe('generateExitCode()', () => {
    it('should generate infinite loop for exitBehavior=loop', () => {
      const module = createSimpleMainModule();
      const result = new CodeGenerator().generate(module, {
        target: C64_CONFIG,
        exitBehavior: 'loop',
      });
      
      expect(result.assembly).toMatch(/JMP\s+\.end_\d+/);
      expect(result.assembly).toContain('infinite loop');
    });

    it('should generate JMP $A474 for exitBehavior=basic', () => {
      const module = createSimpleMainModule();
      const result = new CodeGenerator().generate(module, {
        target: C64_CONFIG,
        exitBehavior: 'basic',
      });
      
      expect(result.assembly).toContain('JMP $A474');
      expect(result.assembly).toContain('Return to BASIC');
    });

    it('should generate JMP $FCE2 for exitBehavior=reset', () => {
      const module = createSimpleMainModule();
      const result = new CodeGenerator().generate(module, {
        target: C64_CONFIG,
        exitBehavior: 'reset',
      });
      
      expect(result.assembly).toContain('JMP $FCE2');
      expect(result.assembly).toContain('Soft reset');
    });

    it('should default to infinite loop when exitBehavior not specified', () => {
      const module = createSimpleMainModule();
      const result = new CodeGenerator().generate(module, {
        target: C64_CONFIG,
        // exitBehavior not specified
      });
      
      expect(result.assembly).toMatch(/JMP\s+\.end_\d+/);
    });

    it('should use infinite loop for unknown exit behavior', () => {
      const module = createSimpleMainModule();
      const result = new CodeGenerator().generate(module, {
        target: C64_CONFIG,
        exitBehavior: 'unknown' as any,
      });
      
      expect(result.assembly).toMatch(/JMP\s+\.end_\d+/);
    });
  });
});
```

### CLI Integration Tests

Add to `packages/cli/src/__tests__/cli.test.ts`:

```typescript
describe('build command', () => {
  describe('--exit-behavior option', () => {
    it('should accept --exit-behavior=loop', async () => {
      // Test that CLI accepts the option
      const result = await runCli(['build', 'test.blend', '--exit-behavior=loop']);
      expect(result.exitCode).not.toBe(ExitCode.INVALID_ARGS);
    });

    it('should accept --exit-behavior=basic', async () => {
      const result = await runCli(['build', 'test.blend', '--exit-behavior=basic']);
      expect(result.exitCode).not.toBe(ExitCode.INVALID_ARGS);
    });

    it('should accept --exit-behavior=reset', async () => {
      const result = await runCli(['build', 'test.blend', '--exit-behavior=reset']);
      expect(result.exitCode).not.toBe(ExitCode.INVALID_ARGS);
    });

    it('should reject invalid exit behavior', async () => {
      const result = await runCli(['build', 'test.blend', '--exit-behavior=invalid']);
      expect(result.exitCode).toBe(ExitCode.INVALID_ARGS);
      expect(result.stderr).toContain('Invalid values');
    });

    it('should accept -e alias', async () => {
      const result = await runCli(['build', 'test.blend', '-e', 'basic']);
      expect(result.exitCode).not.toBe(ExitCode.INVALID_ARGS);
    });
  });
});
```

## Test Data

### Fixtures Needed

**Simple main module for testing:**
```typescript
function createSimpleMainModule(): ILModule {
  const module = new ILModule('test.blend');
  const mainFunc = new ILFunction('main', { returns: null });
  mainFunc.addBasicBlock(new ILBasicBlock('entry'));
  mainFunc.blocks[0].addInstruction(new ILReturn());
  module.addFunction(mainFunc);
  module.setEntryPoint('main');
  return module;
}
```

### Mock Requirements

None - use real compiler components. Per code.md Rule 25: "MUST NOT Mock Real Objects That Exist"

## Verification Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass  
- [ ] All E2E tests pass
- [ ] No regressions in existing tests
- [ ] Test coverage meets goals (100% for new code)
- [ ] Tests run in under 30 seconds