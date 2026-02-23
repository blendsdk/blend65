# Testing Strategy: DX Features

> **Document**: 08-testing-strategy.md
> **Parent**: [Index](00-index.md)

---

## Testing Overview

### Coverage Goals
- Unit tests: 80%+ coverage for new code
- Integration tests: Key workflows covered
- E2E tests: VICE integration verified (when VICE available)

---

## Test Categories

### Unit Tests

| Component | Test Description | Priority |
|-----------|-----------------|----------|
| SourceMapper | Address tracking, label registration | HIGH |
| SourceMapper | Inline comment generation | HIGH |
| SourceMapper | VICE label file generation | HIGH |
| ViceRunner | Emulator detection (mocked) | MEDIUM |
| ViceRunner | Argument building | MEDIUM |
| init command | Template copying | MEDIUM |
| watch command | File change detection (mocked) | MEDIUM |

### Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| Source maps end-to-end | Compiler + SourceMapper | Compile with debug mode, verify output |
| CLI build with debug | CLI + Compiler | `-d vice` produces .labels file |
| Template creation | init + filesystem | Templates create valid projects |

### Manual Tests (VICE Required)

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Labels in VICE | Build with `-d vice`, load labels in VICE | Labels work in monitor |
| Auto-launch | `blend65 run` | VICE opens with program |
| Watch mode | `blend65 watch`, modify file | Auto-rebuild triggers |

---

## Test Files

### Phase 1: Source Maps

```
packages/compiler/src/__tests__/codegen/
├── source-mapper.test.ts        # SourceMapper unit tests
├── source-map-types.test.ts     # Type tests
└── inline-comments.test.ts      # Inline comment generation
```

**Test Cases:**

```typescript
describe('SourceMapper', () => {
  describe('address tracking', () => {
    it('should track current address');
    it('should advance address by bytes');
    it('should reset state');
  });
  
  describe('label registration', () => {
    it('should register labels at current address');
    it('should handle duplicate labels');
    it('should categorize functions vs variables');
  });
  
  describe('inline comments', () => {
    it('should generate FILE:LINE:COL format');
    it('should map addresses to comments');
    it('should handle missing source info');
  });
  
  describe('VICE labels', () => {
    it('should generate valid VICE format');
    it('should sort labels by address');
    it('should format addresses as hex');
    it('should include header comments');
  });
});
```

### Phase 2: VICE Integration

```
packages/cli/src/__tests__/runners/
└── vice.test.ts                 # ViceRunner tests (mocked)
```

**Test Cases:**

```typescript
describe('ViceRunner', () => {
  describe('emulator detection', () => {
    it('should find emulator in PATH');
    it('should use config path override');
    it('should use environment variable');
    it('should throw when not found');
  });
  
  describe('argument building', () => {
    it('should include autostart flag');
    it('should include labels file when provided');
    it('should include warp mode when enabled');
  });
});
```

### Phase 3: CLI Commands

```
packages/cli/src/__tests__/commands/
├── init.test.ts                 # init command tests
├── run.test.ts                  # run command tests
└── watch.test.ts                # watch command tests
```

**Test Cases:**

```typescript
describe('init command', () => {
  it('should create project directory');
  it('should copy template files');
  it('should update project name in config');
  it('should fail if directory not empty');
  it('should allow --force to overwrite');
  it('should support basic template');
  it('should support game template');
  it('should support demo template');
});

describe('watch command', () => {
  it('should detect file changes');
  it('should debounce rapid changes');
  it('should trigger rebuild');
  it('should clear terminal with --clear');
});
```

### Phase 4: E2E Test Rig

```
packages/compiler/src/__tests__/test-utils/
├── vice-test-runner.test.ts     # ViceTestRunner tests
└── __tests__/
    └── e2e/
        └── vice-e2e.test.ts     # Example VICE E2E tests
```

**Test Cases:**

```typescript
describe('ViceTestRunner', () => {
  it('should compile source code');
  it('should create temp PRG file');
  it('should return compilation errors');
});

describe('Memory assertions', () => {
  it('should verify single memory location');
  it('should verify array of memory locations');
  it('should provide clear error messages');
});
```

---

## Test Data

### Fixtures Needed

| Fixture | Description | Location |
|---------|-------------|----------|
| Simple program | Minimal valid Blend65 code | `__fixtures__/simple.blend` |
| Hardware access | Code using @map | `__fixtures__/hardware.blend` |
| Multi-file project | Import/export example | `__fixtures__/multi/` |

### Mock Requirements

| Mock | Purpose | Notes |
|------|---------|-------|
| File system | Template copying tests | Use memfs or temp directories |
| Child process | VICE spawning tests | Mock spawn(), verify arguments |
| chokidar | File watching tests | Mock watcher events |

---

## Verification Checklist

### Per-Phase Verification

**Phase 1: Source Maps**
- [ ] SourceMapper unit tests pass
- [ ] Inline comments appear in assembly
- [ ] VICE labels file loads in VICE
- [ ] Integration test with full compiler

**Phase 2: VICE Integration**
- [ ] Emulator detection tests pass
- [ ] Argument building tests pass
- [ ] Manual test: VICE launches correctly

**Phase 3: CLI Commands**
- [ ] init command tests pass
- [ ] Templates create valid projects
- [ ] watch command tests pass
- [ ] Manual test: watch detects changes

**Phase 4: Test Rig**
- [ ] ViceTestRunner tests pass
- [ ] Example E2E tests demonstrate usage
- [ ] Tests skip gracefully if VICE unavailable

---

## Running Tests

```bash
# Run all DX feature tests
./compiler-test codegen cli

# Run specific component
./compiler-test codegen/source-mapper
./compiler-test cli/commands

# Run E2E tests (requires VICE)
VICE_AVAILABLE=1 ./compiler-test e2e/vice
```

---

**This document defines the testing strategy for Blend65 DX features.**