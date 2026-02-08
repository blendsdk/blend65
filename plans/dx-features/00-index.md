# Developer Experience (DX) Features - Master Index

> **Status**: Planning Complete
> **Created**: January 27, 2026
> **Goal**: Enhance developer experience with debugging, emulator integration, and project tooling

---

## Overview

This plan covers **Developer Experience (DX) features** that enhance the Blend65 development workflow. These features were extracted from the original end-to-end plan after the core compilation pipeline was completed.

**Core Pipeline Status (COMPLETE):**
- ✅ Compiler entry point (`packages/compiler/src/compiler.ts`)
- ✅ Config system (`packages/compiler/src/config/`)
- ✅ Code generation (`packages/compiler/src/codegen/`)
- ✅ ASM-IL optimizer infrastructure (`packages/compiler/src/asm-il/optimizer/`)
- ✅ CLI with `build` and `check` commands (`packages/cli/src/commands/`)

**This Plan Covers:**
- 🗺️ Source maps & debug support
- 📺 VICE emulator integration
- 🧪 E2E test rig with emulator
- 📁 Project templates (`blend65 init`)
- ▶️ CLI `run` command
- 👁️ CLI `watch` command
- 🔮 VS Code extension (future roadmap)

---

## Document Index

| Document | Phase | Description | Status |
|----------|-------|-------------|--------|
| [00-index.md](00-index.md) | - | This document - overview and navigation | 📋 Ready |
| [01-requirements.md](01-requirements.md) | - | Feature requirements and scope | 📋 Ready |
| [02-current-state.md](02-current-state.md) | - | Analysis of current implementation | 📋 Ready |
| [03-source-maps.md](03-source-maps.md) | Phase 1 | Debug info & VICE labels | 📋 Ready |
| [04-vice-integration.md](04-vice-integration.md) | Phase 2 | Emulator detection & launch | 📋 Ready |
| [05-cli-commands.md](05-cli-commands.md) | Phase 3 | CLI run, watch, init commands | 📋 Ready |
| [06-templates.md](06-templates.md) | Phase 3 | Project templates for `blend65 init` | 📋 Ready |
| [07-test-rig.md](07-test-rig.md) | Phase 4 | E2E testing with emulator | 📋 Ready |
| [08-testing-strategy.md](08-testing-strategy.md) | - | Test cases and verification | 📋 Ready |
| [99-execution-plan.md](99-execution-plan.md) | - | Phases, sessions, task checklist | 📋 Ready |

---

## Implementation Phases

### Phase 1: Source Maps & Debug Support
**Priority: MEDIUM** | **Dependencies: None** | **Sessions: 2**

Debug information for improved development experience.

**Key deliverables:**
- Source location tracking in assembly output
- VICE label file generation (`.labels`)
- Debug mode configuration (`none`/`inline`/`vice`/`both`)
- Inline assembly comments with source locations

---

### Phase 2: VICE Integration
**Priority: MEDIUM** | **Dependencies: Phase 1** | **Sessions: 1-2**

Automatic emulator launching and configuration.

**Key deliverables:**
- Emulator detection (PATH search, config override)
- ViceRunner class for process management
- Auto-launch with compiled `.prg`
- Cross-platform support (macOS, Linux, Windows)

---

### Phase 3: CLI Commands & Templates
**Priority: MEDIUM** | **Dependencies: Phase 2** | **Sessions: 2**

Complete CLI with all developer commands.

**Key deliverables:**
- `blend65 init [--template=basic|game|demo]` - Project scaffolding
- `blend65 run` - Build and launch in emulator
- `blend65 watch [--run]` - Auto-rebuild on file changes
- Project templates (basic, game, demo)

---

### Phase 4: E2E Test Rig
**Priority: LOW** | **Dependencies: Phase 2** | **Sessions: 1-2**

Automated end-to-end testing with emulator.

**Key deliverables:**
- ViceTestRunner helper class
- Memory and register assertions
- Compile → Run → Assert workflow
- CI integration support (optional)

---

## Phase Dependencies

```
Phase 1: Source Maps
    ↓
Phase 2: VICE Integration
    ↓
Phase 3: CLI Commands & Templates
    ↓
Phase 4: E2E Test Rig
```

---

## Future Roadmap (Not in Scope)

### VS Code Extension (Level 2 DX)
- Syntax highlighting (`.blend` files)
- Error/warning squiggles
- Hover for type info
- Go-to-definition
- Auto-completion

### Advanced Debugging (Level 3 DX)
- Source-level debugging in VICE
- Hot reload
- Memory profiler
- Cycle counter

---

## Success Criteria

### MVP DX Features
- [ ] `blend65 build` produces `.labels` file with `-d vice`
- [ ] `blend65 run` launches VICE with compiled `.prg`
- [ ] `blend65 watch` auto-rebuilds on file changes
- [ ] `blend65 init` creates project from template

### Enhanced DX Features
- [ ] E2E tests verify memory state in emulator
- [ ] Debug comments in assembly output
- [ ] Cross-platform VICE detection

---

## Cross-References

- **Optimizer Plan**: `plans/optimizer-series/` - Peephole optimization (separate)
- **Language Specification**: `docs/language-specification-v2/`
- **Compiler Design**: `docs/language-specification-v2/10-compiler.md`

---

## Quick Start

**To implement Phase 1 (Source Maps):**
```
Reference: plans/dx-features/99-execution-plan.md
Execute: "Implement Phase 1, Session 1.1 per plans/dx-features/99-execution-plan.md"
```

---

**This document is the master index for Blend65 DX features.**