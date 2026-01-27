# Current State: DX Features

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

---

## Existing Implementation

### What Exists

The core compilation pipeline is complete and provides the foundation for DX features:

| Component | Location | Status |
|-----------|----------|--------|
| Compiler Entry | `packages/compiler/src/compiler.ts` | ✅ Complete |
| Config System | `packages/compiler/src/config/` | ✅ Complete |
| Code Generator | `packages/compiler/src/codegen/` | ✅ Complete |
| ASM-IL Optimizer | `packages/compiler/src/asm-il/optimizer/` | ✅ Complete |
| CLI Package | `packages/cli/src/` | ✅ Partial |
| CLI `build` Command | `packages/cli/src/commands/build.ts` | ✅ Complete |
| CLI `check` Command | `packages/cli/src/commands/check.ts` | ✅ Complete |

### Source Location Infrastructure (Already Exists)

The codebase has **extensive source location tracking** that can be leveraged:

**AST Level** (`ast/base.ts`):
- `SourceLocation` interface with `start`/`end` positions (line, column, offset)
- Every AST node stores its location via `protected readonly location: SourceLocation`
- `getLocation()` method on all nodes

**IL Level** (`il/instructions.ts`):
- IL instructions have `location?: SourceLocation` field
- `ILPrinter` already supports `showSourceLocations` option
- Metadata includes location tracking

**Diagnostics** (`ast/diagnostics.ts`):
- `DiagnosticCollector` uses `SourceLocation` for all error reporting
- Location tracking for errors, warnings, hints

### Target Configuration (Already Exists)

`packages/compiler/src/target/config.ts` provides platform info:

```typescript
export enum TargetArchitecture {
  C64 = 'c64',   // → x64sc or x64
  C128 = 'c128', // → x128
  X16 = 'x16',   // → x16emu
}
```

---

## Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `packages/compiler/src/codegen/` | Code generation | Add source mapper |
| `packages/cli/src/commands/` | CLI commands | Add run, watch, init |
| `packages/cli/src/` | CLI package | Add runners/, templates/ |
| `packages/compiler/src/config/` | Config system | Add debug, emulator options |

---

## Gaps Identified

### Gap 1: No Source Mapping in Output

**Current Behavior:** Assembly output contains no debug information
**Required Behavior:** Optional source comments and VICE labels
**Fix Required:** Create `SourceMapper` class, integrate with codegen

### Gap 2: No VICE Integration

**Current Behavior:** No emulator-related code exists
**Required Behavior:** Automatic emulator detection and launch
**Fix Required:** Create `ViceRunner` class in CLI package

### Gap 3: Missing CLI Commands

**Current Behavior:** Only `build` and `check` commands exist
**Required Behavior:** `run`, `watch`, `init` commands
**Fix Required:** Implement missing command files

### Gap 4: No Project Templates

**Current Behavior:** No template system exists
**Required Behavior:** `blend65 init --template=game` creates project
**Fix Required:** Create templates directory and init command

### Gap 5: No E2E Test Infrastructure

**Current Behavior:** No emulator-based testing
**Required Behavior:** Test helper that runs code in VICE and asserts state
**Fix Required:** Create ViceTestRunner helper

---

## Code Analysis

### Existing CLI Structure

```
packages/cli/src/
├── cli.ts              # Main CLI entry
├── index.ts            # Exports
├── commands/
│   ├── build.ts        # ✅ Exists
│   ├── check.ts        # ✅ Exists
│   ├── index.ts        # Command registry
│   └── types.ts        # Command types
├── output/
│   └── formatter.ts    # Output formatting
└── utils/
    └── exit-codes.ts   # Exit codes
```

### What Needs to be Added

```
packages/cli/src/
├── commands/
│   ├── init.ts         # ❌ NEW
│   ├── run.ts          # ❌ NEW
│   └── watch.ts        # ❌ NEW
├── runners/
│   ├── index.ts        # ❌ NEW
│   └── vice.ts         # ❌ NEW - ViceRunner
└── templates/
    ├── basic/          # ❌ NEW
    ├── game/           # ❌ NEW
    └── demo/           # ❌ NEW

packages/compiler/src/codegen/
├── source-mapper.ts    # ❌ NEW
└── source-map-types.ts # ❌ NEW
```

---

## Dependencies

### Internal Dependencies

| Component | Required For |
|-----------|--------------|
| Source location tracking | Source maps |
| Compiler | All CLI commands |
| Config system | Debug mode |
| Target config | Emulator selection |

### External Dependencies (New)

| Dependency | Purpose | Version |
|------------|---------|---------|
| chokidar | File watching for watch command | ^3.5.0 |

---

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| VICE not installed | High | Medium | Clear error message with install instructions |
| Cross-platform PATH | Medium | Medium | Use standard PATH resolution per platform |
| File watch edge cases | Low | Low | Use proven chokidar library |

---

**This document analyzes the current state for Blend65 DX features.**