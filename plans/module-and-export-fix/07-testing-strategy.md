# Testing Strategy: Module Declaration and Export Warning Fix

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Unit tests: 100% coverage for changed code paths
- Integration tests: Library loading with fixed parser/analyzer
- Regression tests: All 6585+ existing tests must pass

## Test Categories

### Parser Unit Tests

| Test | Description | Priority |
|------|-------------|----------|
| Module with semicolon | `module system;` parses successfully | High |
| Hierarchical module with semicolon | `module Game.Main;` parses successfully | High |
| Missing semicolon error | `module system` without semicolon reports error | High |
| Module after content with semicolon | Module followed by declarations | Medium |

### Semantic Analyzer Unit Tests

| Test | Description | Priority |
|------|-------------|----------|
| Exported const no warning | `export const X: byte = 1;` no warning | High |
| Exported let no warning | `export let x: byte = 0;` no warning | High |
| Non-exported unused warns | `const X: byte = 1;` shows warning | High |
| Non-exported write-only warns | `let x: byte = 0; x = 5;` shows warning | High |

### Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| Library loading | Parser + Semantic | Load `common/system.blend` without errors |
| Hardware library | Parser + Semantic | Load `c64/common/hardware.blend` without warnings |
| Full compilation | All | Compile with `--libraries=common` flag |

## Test Implementation

### Parser Tests

**File:** `packages/compiler/src/__tests__/parser/modules.test.ts`

Add or modify test cases:

```typescript
describe('Module Declaration Semicolon', () => {
  it('should parse simple module with semicolon', () => {
    const source = 'module system;';
    const parser = new Parser(new Lexer(source).tokenize());
    const result = parser.parse();
    
    expect(result.diagnostics).toHaveLength(0);
    expect(result.ast.getModuleDecl().getNamePath()).toEqual(['system']);
    expect(result.ast.getModuleDecl().isImplicit()).toBe(false);
  });

  it('should parse hierarchical module with semicolon', () => {
    const source = 'module c64.graphics.screen;';
    const parser = new Parser(new Lexer(source).tokenize());
    const result = parser.parse();
    
    expect(result.diagnostics).toHaveLength(0);
    expect(result.ast.getModuleDecl().getNamePath()).toEqual(['c64', 'graphics', 'screen']);
  });

  it('should parse module followed by declarations', () => {
    const source = `
      module test;
      let x: byte = 0;
    `;
    const parser = new Parser(new Lexer(source).tokenize());
    const result = parser.parse();
    
    expect(result.diagnostics).toHaveLength(0);
    expect(result.ast.getModuleDecl().getNamePath()).toEqual(['test']);
    expect(result.ast.getDeclarations()).toHaveLength(1);
  });

  it('should report error for missing semicolon', () => {
    const source = 'module system\nlet x: byte = 0;';
    const parser = new Parser(new Lexer(source).tokenize());
    const result = parser.parse();
    
    expect(result.diagnostics.some(d => 
      d.message.toLowerCase().includes('semicolon')
    )).toBe(true);
  });
});
```

### Semantic Analyzer Tests

**File:** `packages/compiler/src/__tests__/semantic/variable-usage.test.ts`

Add test cases:

```typescript
describe('Exported Variable Warnings', () => {
  it('should NOT warn for exported const never read locally', () => {
    const source = `
      module test;
      export const COLOR: byte = 14;
    `;
    const analyzer = createAnalyzer(source);
    const result = analyzer.analyze();
    
    const unusedWarnings = result.diagnostics.filter(d => 
      d.message.includes('never read') || 
      d.message.includes('never used')
    );
    expect(unusedWarnings).toHaveLength(0);
  });

  it('should NOT warn for exported let never read locally', () => {
    const source = `
      module test;
      export let counter: byte = 0;
    `;
    const analyzer = createAnalyzer(source);
    const result = analyzer.analyze();
    
    const unusedWarnings = result.diagnostics.filter(d => 
      d.message.includes('never read') || 
      d.message.includes('never used')
    );
    expect(unusedWarnings).toHaveLength(0);
  });

  it('should warn for non-exported unused const', () => {
    const source = `
      module test;
      const PRIVATE: byte = 14;
    `;
    const analyzer = createAnalyzer(source);
    const result = analyzer.analyze();
    
    expect(result.diagnostics.some(d => 
      d.message.includes('never used')
    )).toBe(true);
  });

  it('should warn for non-exported write-only variable', () => {
    const source = `
      module test;
      let counter: byte = 0;
      export function test(): void {
        counter = 5;
      }
    `;
    const analyzer = createAnalyzer(source);
    const result = analyzer.analyze();
    
    expect(result.diagnostics.some(d => 
      d.message.includes('never read')
    )).toBe(true);
  });
});
```

### Integration Tests

**File:** `packages/compiler/src/__tests__/integration/library-loading.test.ts`

```typescript
describe('Library Loading Integration', () => {
  it('should load common/system.blend without parser errors', async () => {
    const compiler = new Compiler({
      compilerOptions: {
        target: 'c64',
        libraries: ['common']
      }
    });
    
    const result = await compiler.compile(new Map([
      ['main.blend', 'module main;\nexport function main(): void {}']
    ]));
    
    const parserErrors = result.diagnostics.filter(d => 
      d.code.startsWith('P')
    );
    expect(parserErrors).toHaveLength(0);
  });

  it('should load hardware library without semantic warnings', async () => {
    const compiler = new Compiler({
      compilerOptions: {
        target: 'c64',
        libraries: ['common']
      }
    });
    
    const result = await compiler.compile(new Map([
      ['main.blend', `
        module main;
        import { COLOR_LIGHT_BLUE } from c64.hardware;
        export function main(): void {
          poke(0xD020, COLOR_LIGHT_BLUE);
        }
      `]
    ]));
    
    const exportWarnings = result.diagnostics.filter(d => 
      d.message.includes('never read') && 
      d.location?.source?.includes('@stdlib')
    );
    expect(exportWarnings).toHaveLength(0);
  });
});
```

## Verification Checklist

- [ ] Parser: `module system;` parses without error
- [ ] Parser: `module Game.Main;` parses without error
- [ ] Parser: Missing semicolon reports clear error
- [ ] Semantic: Exported variables don't trigger warnings
- [ ] Semantic: Non-exported unused variables still warn
- [ ] Integration: Library loading works with `--libraries=common`
- [ ] Regression: All 6585+ existing tests pass
- [ ] Regression: No new warnings introduced

## Test Execution Commands

```bash
# Run all tests
clear && yarn clean && yarn build && yarn test

# Run specific test file (parser)
clear && yarn build && yarn test --filter="modules.test"

# Run specific test file (semantic)
clear && yarn build && yarn test --filter="variable-usage.test"

# Run integration tests only
clear && yarn build && yarn test --filter="library-loading"
```