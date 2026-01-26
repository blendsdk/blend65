# Library Loading System Implementation Plan

> **Feature**: Built-in Standard Library Loading
> **Status**: Planning Complete
> **Created**: January 26, 2026

## Overview

This plan implements a built-in standard library system for Blend65. Libraries are stored in `packages/compiler/library/` and are automatically loaded based on the compilation target. Users can enable additional optional libraries via `blend65.json` or CLI flags.

**Key Goals:**
- Zero-config for common libraries (auto-loaded)
- Target-specific libraries (c64, x16, etc.)
- Opt-in mechanism for additional libraries
- Seamless integration with existing module system

## Document Index

| #  | Document | Description |
|----|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current implementation |
| 03 | [Library Loader](03-library-loader.md) | Core loader component specification |
| 04 | [Compiler Integration](04-compiler-integration.md) | Integration with Compiler class |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Library Directory Structure

```
packages/compiler/library/
├── common/                     # Always loaded (all targets)
│   └── *.blend
├── c64/
│   ├── common/                 # Always loaded when target=c64
│   │   └── *.blend
│   ├── sid.blend               # Opt-in library (file)
│   └── sprites/                # Opt-in library (folder)
│       └── *.blend
└── x16/
    ├── common/                 # Always loaded when target=x16
    │   └── *.blend
    └── vera.blend              # Opt-in library
```

### Usage Examples

**blend65.json:**
```json
{
  "compilerOptions": {
    "target": "c64",
    "libraries": ["sid", "sprites"]
  }
}
```

**CLI:**
```bash
blend65 compile main.blend --target=c64 --libraries=sid,sprites
```

**User Code:**
```js
// Libraries are available via module imports
import { waitFrame } from std.c64.common;
import { playSID } from std.c64.sid;
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Library location | `packages/compiler/library/` (inside compiler package) |
| Auto-load directories | `common/` + `{target}/common/` |
| Opt-in specification | `libraries: ["name"]` in config or `--libraries=name` CLI |
| File vs folder | Same name - loader auto-detects |
| Module naming | From `module` declaration in .blend files |

## Related Files

**New Files:**
- `packages/compiler/src/library/loader.ts` - LibraryLoader class
- `packages/compiler/src/library/index.ts` - Exports

**Modified Files:**
- `packages/compiler/src/config/types.ts` - Add `libraries` option
- `packages/compiler/src/compiler.ts` - Integrate library loading
- `packages/cli/src/commands/compile.ts` - Add `--libraries` flag