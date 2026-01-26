# Testing Strategy: Library Loading System

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Unit tests: 90%+ coverage for LibraryLoader
- Integration tests: Key workflows covered
- E2E tests: Complete compilation with libraries

## Test Categories

### Unit Tests: LibraryLoader

| Test | Description | Priority |
|------|-------------|----------|
| `loadLibraries returns empty when no libraries exist` | Empty common/ should return empty sources | High |
| `loadLibraries loads common/ directory` | Files in common/ are loaded | High |
| `loadLibraries loads target/common/ directory` | Files in c64/common/ are loaded for c64 target | High |
| `loadLibraries loads single-file library` | `sid.blend` loads when `--libraries=sid` | High |
| `loadLibraries loads folder library` | `sprites/` loads all .blend files when `--libraries=sprites` | High |
| `loadLibrary prefers file over folder` | If both `sid.blend` and `sid/` exist, load file | Medium |
| `loadLibraries returns error for missing library` | Non-existent library produces diagnostic | High |
| `loadFile handles read errors` | Permission errors produce diagnostic | Medium |
| `listAvailableLibraries returns correct list` | Lists files (without .blend) and folders | Medium |
| `listAvailableLibraries excludes common/` | common/ is not listed as optional library | Medium |

### Integration Tests: Compiler + Libraries

| Test | Components | Description |
|------|------------|-------------|
| Compile with common library | Compiler, LibraryLoader, Parser | User code imports from common library |
| Compile with optional library | Compiler, LibraryLoader, Config | `libraries: ['sid']` loads sid library |
| Library not found error | Compiler, LibraryLoader | Clear error when library missing |
| Library module in user import | Full pipeline | `import { foo } from std.c64.common;` works |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Compile with library import | 1. Create test library in common/ 2. Create user code that imports from it 3. Compile | Successful compilation, no errors |
| Missing library | 1. Create user code with `--libraries=nonexistent` 2. Compile | Error: "Library 'nonexistent' not found..." |
| CLI --libraries flag | 1. Run `blend65 compile --libraries=sid` | Libraries option passed to compiler |

## Test Data

### Test Library Files

Create test libraries for testing purposes:

**`packages/compiler/library/common/test-common.blend`:**
```js
module std.common.test;

export const TEST_VALUE: byte = 42;

export function testFunction(): byte {
  return TEST_VALUE;
}
```

**`packages/compiler/library/c64/common/test-c64.blend`:**
```js
module std.c64.test;

export const C64_TEST: byte = 64;
```

**`packages/compiler/library/c64/optional-test.blend`:**
```js
module std.c64.optional;

export function optionalFunction(): void {
  // Optional library function
}
```

### Test User Code

**Test case: Import from common library:**
```js
module TestUser;

import { TEST_VALUE, testFunction } from std.common.test;

export function main(): void {
  let x: byte = testFunction();
}
```

**Test case: Import from optional library:**
```js
module TestUser;

import { optionalFunction } from std.c64.optional;

export function main(): void {
  optionalFunction();
}
```

## Mock Requirements

- **File system**: Use real file system with temp directories for isolation
- **No mocks for LibraryLoader**: Use real implementation with test library files

## Verification Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] No regressions in existing tests
- [ ] Test coverage meets goals (90%+ for LibraryLoader)

## Test File Structure

```
packages/compiler/src/__tests__/
├── library/
│   ├── loader.test.ts           # LibraryLoader unit tests
│   └── fixtures/                # Test library files
│       ├── common/
│       │   └── test-common.blend
│       ├── c64/
│       │   ├── common/
│       │   │   └── test-c64.blend
│       │   ├── optional-test.blend
│       │   └── folder-lib/
│       │       ├── part1.blend
│       │       └── part2.blend
│       └── x16/
│           └── common/
│               └── test-x16.blend
└── integration/
    └── library-loading.test.ts  # Integration tests
```

## Example Test Code

### LibraryLoader Unit Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LibraryLoader } from '../../library/loader.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('LibraryLoader', () => {
  let testDir: string;
  let loader: LibraryLoader;

  beforeAll(() => {
    // Create temp directory with test libraries
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blend-test-lib-'));
    
    // Create directory structure
    fs.mkdirSync(path.join(testDir, 'common'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'c64', 'common'), { recursive: true });
    
    // Create test files
    fs.writeFileSync(
      path.join(testDir, 'common', 'test.blend'),
      'module std.common.test;\nexport const X: byte = 1;'
    );
    fs.writeFileSync(
      path.join(testDir, 'c64', 'common', 'c64test.blend'),
      'module std.c64.test;\nexport const Y: byte = 2;'
    );
    fs.writeFileSync(
      path.join(testDir, 'c64', 'optional.blend'),
      'module std.c64.optional;\nexport const Z: byte = 3;'
    );
    
    loader = new LibraryLoader(testDir);
  });

  afterAll(() => {
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('loadLibraries', () => {
    it('loads common/ for all targets', () => {
      const result = loader.loadLibraries('c64', []);
      
      expect(result.success).toBe(true);
      expect(result.sources.size).toBeGreaterThan(0);
      expect([...result.sources.keys()].some(k => k.includes('common/test.blend'))).toBe(true);
    });

    it('loads target/common/ for specific target', () => {
      const result = loader.loadLibraries('c64', []);
      
      expect([...result.sources.keys()].some(k => k.includes('c64/common/c64test.blend'))).toBe(true);
    });

    it('loads optional library when specified', () => {
      const result = loader.loadLibraries('c64', ['optional']);
      
      expect(result.success).toBe(true);
      expect([...result.sources.keys()].some(k => k.includes('optional.blend'))).toBe(true);
    });

    it('returns error for non-existent library', () => {
      const result = loader.loadLibraries('c64', ['nonexistent']);
      
      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("Library 'nonexistent' not found");
    });
  });

  describe('listAvailableLibraries', () => {
    it('lists optional libraries for target', () => {
      const libs = loader.listAvailableLibraries('c64');
      
      expect(libs).toContain('optional');
      expect(libs).not.toContain('common');  // common/ is not optional
    });
  });
});
```

### Integration Test

```typescript
import { describe, it, expect } from 'vitest';
import { Compiler } from '../../compiler.js';
import type { Blend65Config } from '../../config/types.js';

describe('Compiler with Libraries', () => {
  it('compiles user code that imports from library', () => {
    const compiler = new Compiler();
    
    const userCode = `
      module TestUser;
      import { TEST_VALUE } from std.common.test;
      export function main(): void {
        let x: byte = TEST_VALUE;
      }
    `;
    
    const config: Blend65Config = {
      compilerOptions: {
        target: 'c64',
      },
    };
    
    const sources = new Map([['test.blend', userCode]]);
    const result = compiler.compileSource(sources, config, 'semantic');
    
    expect(result.success).toBe(true);
    expect(result.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });
});
```