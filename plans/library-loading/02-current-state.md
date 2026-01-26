# Current State: Library Loading System

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

1. **Library Directory Structure** - Already created (empty folders):
   ```
   packages/compiler/library/
   ├── common/           # Empty
   ├── c64/
   │   └── common/       # Empty
   └── x16/
       └── common/       # Empty
   ```

2. **Module System** - Fully functional:
   - `ModuleRegistry` tracks all modules by name
   - `ImportResolver` validates imports exist
   - `DependencyGraph` handles module ordering
   - Module names from `module` declarations

3. **Compilation Pipeline** - Works with multiple sources:
   ```
   Sources → Parse → Semantic → IL → Optimize → Codegen
   ```

4. **Configuration System** - `Blend65Config` in `packages/compiler/src/config/types.ts`

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `packages/compiler/src/compiler.ts` | Main compiler class | Add library loading call |
| `packages/compiler/src/config/types.ts` | Configuration types | Add `libraries` option |
| `packages/compiler/src/pipeline/semantic-phase.ts` | Semantic analysis | None (receives all sources) |
| `packages/compiler/src/semantic/module-registry.ts` | Module tracking | None |
| `packages/compiler/src/semantic/import-resolver.ts` | Import validation | None |

### Code Analysis

**Compiler.compile() - Current Flow:**
```typescript
public compile(options: CompileOptions): CompilationResult {
  // 1. Validate target
  const targetValidation = this.validateTarget(config);
  
  // 2. Load source files from disk
  const sources = this.loadSourceFiles(files);
  
  // 3. Run pipeline
  return this.runPipeline(sources.data, config, ...);
}
```

**Compiler.compileSource() - Current Flow:**
```typescript
public compileSource(
  sources: Map<string, string>,
  config: Blend65Config,
  stopAfterPhase?: string
): CompilationResult {
  // 1. Validate target
  const targetValidation = this.validateTarget(config);
  
  // 2. Run pipeline directly with sources
  return this.runPipeline(sources, config, ...);
}
```

**CompilerOptions Interface - Current:**
```typescript
export interface CompilerOptions {
  target?: TargetPlatform;
  optimization?: OptimizationLevelId;
  debug?: DebugMode;
  outDir?: string;
  outFile?: string;
  outputFormat?: OutputFormat;
  verbose?: boolean;
  strict?: boolean;
  loadAddress?: number;
  // NOTE: No 'libraries' option yet
}
```

## Gaps Identified

### Gap 1: No Library Loading Mechanism

**Current Behavior:** Only user-provided source files are compiled.

**Required Behavior:** Library sources should be loaded and prepended before user sources.

**Fix Required:** 
- Create `LibraryLoader` class
- Call it before `runPipeline()`
- Merge library sources with user sources

### Gap 2: No `libraries` Configuration Option

**Current Behavior:** No way to specify opt-in libraries.

**Required Behavior:** `libraries: ["sid", "sprites"]` in config, `--libraries=sid,sprites` in CLI.

**Fix Required:**
- Add `libraries?: string[]` to `CompilerOptions`
- Update CLI to parse `--libraries` flag

### Gap 3: Library Files Don't Exist

**Current Behavior:** Library directories exist but are empty.

**Required Behavior:** Sample libraries for testing.

**Fix Required:**
- Create at least one library file for testing
- Example: `common/test.blend` or `c64/common/vic.blend`

## Dependencies

### Internal Dependencies

- `fs` module for file reading
- `path` module for path resolution
- Existing `Compiler` class
- Existing `CompilerOptions` interface

### External Dependencies

- None (all native Node.js)

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Path resolution differs in development vs published package | Medium | High | Use `__dirname` relative paths |
| Library files not included in npm package | Medium | High | Update `package.json` files array |
| Module name conflicts with user code | Low | Medium | Document reserved namespaces |
| Performance impact of loading many libraries | Low | Low | Only load requested libraries |