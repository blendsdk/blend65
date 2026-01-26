# Execution Plan: Library Loading System

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and AI chat sessions for implementing the Library Loading System.

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Configuration Types | 1 | 20 min |
| 2 | LibraryLoader Core | 1 | 45 min |
| 3 | Compiler Integration | 1 | 30 min |
| 4 | CLI Integration | 1 | 20 min |
| 5 | Testing | 1-2 | 45 min |
| 6 | Sample Libraries & Documentation | 1 | 20 min |

**Total: 5-6 sessions, ~3 hours**

---

## Phase 1: Configuration Types

### Session 1.1: Add libraries Option to CompilerOptions

**Reference**: [04-compiler-integration.md](04-compiler-integration.md)

**Objective**: Add the `libraries` configuration option to enable opt-in library loading.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Add `libraries?: string[]` to CompilerOptions interface | `packages/compiler/src/config/types.ts` |
| 1.1.2 | Add `cliLibraries?: string[]` to ConfigLoadOptions interface | `packages/compiler/src/config/types.ts` |
| 1.1.3 | Add JSDoc documentation for new options | `packages/compiler/src/config/types.ts` |

**Deliverables**:
- [ ] `libraries` option added to CompilerOptions
- [ ] `cliLibraries` option added to ConfigLoadOptions
- [ ] Full JSDoc documentation

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 2: LibraryLoader Core

### Session 2.1: Implement LibraryLoader Class

**Reference**: [03-library-loader.md](03-library-loader.md)

**Objective**: Create the core library loading functionality.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Create `packages/compiler/src/library/` directory | - |
| 2.1.2 | Create LibraryLoadResult interface | `packages/compiler/src/library/loader.ts` |
| 2.1.3 | Create LibraryLoader class with constructor | `packages/compiler/src/library/loader.ts` |
| 2.1.4 | Implement `loadLibraries()` method | `packages/compiler/src/library/loader.ts` |
| 2.1.5 | Implement `loadDirectory()` protected method | `packages/compiler/src/library/loader.ts` |
| 2.1.6 | Implement `loadLibrary()` protected method | `packages/compiler/src/library/loader.ts` |
| 2.1.7 | Implement `loadFile()` protected method | `packages/compiler/src/library/loader.ts` |
| 2.1.8 | Implement `listAvailableLibraries()` method | `packages/compiler/src/library/loader.ts` |
| 2.1.9 | Create index.ts with exports | `packages/compiler/src/library/index.ts` |

**Deliverables**:
- [ ] LibraryLoader class implemented
- [ ] All public and protected methods working
- [ ] Exports in index.ts

**Verify**: `clear && yarn clean && yarn build`

---

## Phase 3: Compiler Integration

### Session 3.1: Integrate LibraryLoader into Compiler

**Reference**: [04-compiler-integration.md](04-compiler-integration.md)

**Objective**: Connect the LibraryLoader to the Compiler class.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Add LibraryLoader import | `packages/compiler/src/compiler.ts` |
| 3.1.2 | Add libraryLoader instance to Compiler class | `packages/compiler/src/compiler.ts` |
| 3.1.3 | Add `loadLibrarySources()` helper method | `packages/compiler/src/compiler.ts` |
| 3.1.4 | Modify `compile()` to load and merge library sources | `packages/compiler/src/compiler.ts` |
| 3.1.5 | Modify `compileSource()` to load and merge library sources | `packages/compiler/src/compiler.ts` |
| 3.1.6 | Export LibraryLoader from compiler index | `packages/compiler/src/index.ts` |

**Deliverables**:
- [ ] Compiler loads libraries before user code
- [ ] Both compile() and compileSource() support libraries
- [ ] Library sources prepended to user sources

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 4: CLI Integration

### Session 4.1: Add --libraries CLI Flag

**Reference**: [04-compiler-integration.md](04-compiler-integration.md)

**Objective**: Allow users to specify libraries via command line.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Check current CLI compile command structure | `packages/cli/src/` |
| 4.1.2 | Add `--libraries` option to compile command | `packages/cli/src/commands/compile.ts` (or equivalent) |
| 4.1.3 | Implement parseLibraries function for comma-separated values | `packages/cli/src/commands/compile.ts` |
| 4.1.4 | Pass libraries to compiler config | `packages/cli/src/commands/compile.ts` |

**Deliverables**:
- [ ] `--libraries=sid,sprites` CLI flag works
- [ ] Libraries passed correctly to compiler

**Verify**: Manual test with CLI

---

## Phase 5: Testing

### Session 5.1: Unit Tests for LibraryLoader

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Create comprehensive unit tests for LibraryLoader.

**Tasks**:

| # | Task | File |
|---|------|------|
| 5.1.1 | Create test directory structure | `packages/compiler/src/__tests__/library/` |
| 5.1.2 | Create test fixtures directory | `packages/compiler/src/__tests__/library/fixtures/` |
| 5.1.3 | Create test library files | Fixtures |
| 5.1.4 | Write tests for loadLibraries() | `packages/compiler/src/__tests__/library/loader.test.ts` |
| 5.1.5 | Write tests for loadLibrary() file vs folder | `packages/compiler/src/__tests__/library/loader.test.ts` |
| 5.1.6 | Write tests for listAvailableLibraries() | `packages/compiler/src/__tests__/library/loader.test.ts` |
| 5.1.7 | Write error case tests | `packages/compiler/src/__tests__/library/loader.test.ts` |

**Deliverables**:
- [ ] 10+ unit tests for LibraryLoader
- [ ] Test fixtures created
- [ ] All tests passing

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 6: Sample Libraries & Documentation

### Session 6.1: Create Sample Libraries and Update Documentation

**Objective**: Add sample library files and document the system.

**Tasks**:

| # | Task | File |
|---|------|------|
| 6.1.1 | Create sample common library | `packages/compiler/library/common/` |
| 6.1.2 | Create sample c64/common library | `packages/compiler/library/c64/common/` |
| 6.1.3 | Update package.json to include library folder | `packages/compiler/package.json` |
| 6.1.4 | Document library system in README or docs | `README.md` or `docs/` |

**Deliverables**:
- [ ] Sample library files for testing
- [ ] Library folder included in npm package
- [ ] Documentation updated

**Verify**: Manual verification of library loading

---

## Task Checklist (All Phases)

### Phase 1: Configuration Types ✅
- [x] 1.1.1 Add `libraries?: string[]` to CompilerOptions
- [x] 1.1.2 Add `cliLibraries?: string[]` to ConfigLoadOptions
- [x] 1.1.3 Add JSDoc documentation
- [x] 1.1.4 Add libraries default to getDefaultCompilerOptions()

### Phase 2: LibraryLoader Core ✅
- [x] 2.1.1 Create library directory
- [x] 2.1.2 Create LibraryLoadResult interface
- [x] 2.1.3 Create LibraryLoader class
- [x] 2.1.4 Implement loadLibraries()
- [x] 2.1.5 Implement loadDirectory()
- [x] 2.1.6 Implement loadLibrary()
- [x] 2.1.7 Implement loadFile()
- [x] 2.1.8 Implement listAvailableLibraries()
- [x] 2.1.9 Create index.ts

### Phase 3: Compiler Integration ✅
- [x] 3.1.1 Add LibraryLoader import
- [x] 3.1.2 Add libraryLoader instance
- [x] 3.1.3 Add loadLibrarySources() helper
- [x] 3.1.4 Add mergeSources() helper
- [x] 3.1.5 Modify runPipeline() to load and merge library sources
- [x] 3.1.6 Export from index

### Phase 4: CLI Integration ✅
- [x] 4.1.1 Check CLI structure
- [x] 4.1.2 Add --libraries option to BuildOptions interface
- [x] 4.1.3 Add --libraries option to yargs builder
- [x] 4.1.4 Implement parseLibraries function
- [x] 4.1.5 Pass libraries to compiler config

### Phase 5: Testing ✅
- [x] 5.1.1 Create test directory
- [x] 5.1.2 Create fixtures directory (using temp dirs)
- [x] 5.1.3 Create test library files (dynamically created)
- [x] 5.1.4 Write loadLibraries tests
- [x] 5.1.5 Write file vs folder tests
- [x] 5.1.6 Write listAvailableLibraries tests
- [x] 5.1.7 Write error case tests

### Phase 6: Documentation ✅
- [x] 6.1.1 Create common library sample (system.blend exists)
- [x] 6.1.2 Create c64/common library sample (hardware.blend)
- [x] 6.1.3 Update package.json files array
- [ ] 6.1.4 Document in README/docs (deferred - requires stub function support)

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/library-loading/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
clear && yarn clean && yarn build && yarn test

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

### Between Sessions

1. Review completed tasks in this checklist
2. Mark completed items with [x]
3. Start new conversation for next session
4. Reference next session's tasks

---

## Dependencies

```
Phase 1 (Config)
    ↓
Phase 2 (LibraryLoader)
    ↓
Phase 3 (Compiler Integration)
    ↓
Phase 4 (CLI)
    ↓
Phase 5 (Testing)
    ↓
Phase 6 (Documentation)
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ All phases completed
2. ✅ All tests passing
3. ✅ `common/` and `{target}/common/` auto-load
4. ✅ Optional libraries load via config/CLI
5. ✅ Clear errors for missing libraries
6. ✅ Documentation updated
7. ✅ Sample libraries exist