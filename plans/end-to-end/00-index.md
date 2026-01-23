# End-to-End Compiler Pipeline - Master Index

> **Status**: Planning Phase  
> **Created**: January 23, 2026  
> **Last Updated**: January 23, 2026  
> **Goal**: Complete end-to-end compilation from Blend65 source to executable .prg

---

## Overview

This document set covers the complete end-to-end compilation pipeline for Blend65, from source code to runnable C64 program. The pipeline enables developers to:

1. Write Blend65 code with modern developer experience
2. Compile to 6502 assembly and .prg executables
3. Debug with source maps and VICE integration
4. Test with automated emulator-based testing

---

## Current Infrastructure Status

| Component | Status | Notes |
|-----------|--------|-------|
| Lexer | ✅ Complete | Full tokenization |
| Parser | ✅ Complete | AST generation |
| Semantic Analyzer | ✅ Complete | Multi-module support, type checking |
| IL Generator | ✅ Complete | Intermediate representation |
| Optimizer | ✅ Stub (O0) | Pass-through ready |
| Target Configs | ✅ Ready | C64/C128/X16 |
| **Code Generator** | ❌ Missing | **Phase 2** |
| **Compiler Entry** | ❌ Missing | **Phase 1** |
| **Config System** | ❌ Missing | **Phase 0** |
| **CLI** | ❌ Missing | **Phase 4** |
| **VICE Integration** | ❌ Missing | **Phase 5** |
| **Test Rig** | ❌ Missing | **Phase 6** |

---

## Document Index

| Document | Phase | Description | Status |
|----------|-------|-------------|--------|
| [01-config-system.md](01-config-system.md) | Phase 0 | blend65.json configuration system | 📝 Draft |
| [02-compiler-entry.md](02-compiler-entry.md) | Phase 1 | Unified Compiler class | 📝 Draft |
| [03-codegen-stub.md](03-codegen-stub.md) | Phase 2 | Code generation stub | 📝 Draft |
| [04-source-maps.md](04-source-maps.md) | Phase 3 | Debug info & source maps | 📝 Draft |
| [05-cli-architecture.md](05-cli-architecture.md) | Phase 4a | CLI package structure | 📝 Draft |
| [06-cli-commands.md](06-cli-commands.md) | Phase 4b | Individual CLI commands | 📝 Draft |
| [07-vice-integration.md](07-vice-integration.md) | Phase 5 | VICE emulator integration | 📝 Draft |
| [08-test-rig.md](08-test-rig.md) | Phase 6 | E2E testing framework | 📝 Draft |
| [09-templates.md](09-templates.md) | - | Project templates | 📝 Draft |
| [10-dx-roadmap.md](10-dx-roadmap.md) | - | Developer experience roadmap | 📝 Draft |

---

## Implementation Phases

### Phase 0: Configuration System
**Priority: HIGH** | **Dependencies: None**

Creates the `blend65.json` project configuration system, similar to `tsconfig.json`.

**Key deliverables:**
- Config file schema and validation
- Config loader with CLI override support
- Default configuration generation

---

### Phase 1: Compiler Entry Point
**Priority: HIGH** | **Dependencies: Phase 0**

Unified `Compiler` class that orchestrates the entire compilation pipeline.

**Key deliverables:**
- Multi-file compilation support
- Pipeline orchestration (Lexer → Parser → Semantic → IL → Optimizer → Codegen)
- Comprehensive error reporting

---

### Phase 2: Code Generation Stub
**Priority: HIGH** | **Dependencies: Phase 1**

Minimal code generator that produces assembly output.

**Key deliverables:**
- Assembly text generation (stub)
- ACME assembler integration
- .prg binary output

---

### Phase 3: Source Maps & Debug Support
**Priority: MEDIUM** | **Dependencies: Phase 2**

Debug information for improved development experience.

**Key deliverables:**
- Inline assembly comments with source locations
- VICE label file generation
- Debug mode configuration

---

### Phase 4: CLI Package
**Priority: HIGH** | **Dependencies: Phases 0-3**

Professional command-line interface using yargs.

**Key deliverables:**
- Separate `packages/cli/` package
- Commands: init, build, run, watch, check
- Cross-platform support

---

### Phase 5: VICE Integration
**Priority: MEDIUM** | **Dependencies: Phase 4**

Automatic emulator launching and configuration.

**Key deliverables:**
- Emulator detection and configuration
- Auto-launch with compiled .prg
- Cross-platform VICE support

---

### Phase 6: Test Rig
**Priority: MEDIUM** | **Dependencies: Phase 5**

Automated end-to-end testing with emulator.

**Key deliverables:**
- ViceRunner test helper
- Memory and register assertions
- CI integration support

---

## Compilation Pipeline Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Blend65 Compilation Pipeline                       │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Config    │───▶│   Source    │───▶│   Lexer     │───▶│   Parser    │
│  Loader     │    │   Files     │    │ (per file)  │    │ (per file)  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                                                                ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Output    │◀───│   Codegen   │◀───│  Optimizer  │◀───│  Semantic   │
│  (.prg)     │    │  (stub)     │    │   (O0)      │    │  Analyzer   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │
      ▼                  ▼
┌─────────────┐    ┌─────────────┐
│    VICE     │    │   Source    │
│  Emulator   │    │    Maps     │
└─────────────┘    └─────────────┘
```

---

## Package Structure

```
blend65/
├── packages/
│   ├── compiler/                 # Core compiler (existing)
│   │   ├── src/
│   │   │   ├── lexer/           # ✅ Complete
│   │   │   ├── parser/          # ✅ Complete
│   │   │   ├── semantic/        # ✅ Complete
│   │   │   ├── il/              # ✅ Complete
│   │   │   ├── optimizer/       # ✅ Stub ready
│   │   │   ├── target/          # ✅ Complete
│   │   │   ├── codegen/         # 📝 Phase 2
│   │   │   ├── config/          # 📝 Phase 0
│   │   │   └── compiler.ts      # 📝 Phase 1
│   │   └── package.json
│   │
│   └── cli/                      # New CLI package
│       ├── src/
│       │   ├── index.ts         # Entry point
│       │   ├── commands/        # CLI commands
│       │   ├── config/          # Config loading
│       │   └── runners/         # Emulator runners
│       └── package.json
│
└── plans/
    └── end-to-end/              # This document set
```

---

## Success Criteria

### MVP (Minimum Viable Pipeline)
- [ ] `blend65 build main.bl65` produces .prg file
- [ ] Error messages show file:line:column
- [ ] Multi-file projects compile correctly
- [ ] `blend65 run` launches VICE with output

### Enhanced Pipeline
- [ ] Source maps enable debugging
- [ ] Watch mode auto-rebuilds
- [ ] Project templates available
- [ ] VS Code integration (future)

---

## Cross-References

- **Optimizer Plans**: `plans/optimizer/` - Peephole optimization documentation
- **IL Generator Plans**: `plans/il-generator/` - Intermediate language documentation
- **Language Specification**: `docs/language-specification/` - Blend65 language reference
- **Compiler Design**: `docs/language-specification/30-compiler-design.md` - Design decisions

---

## Task Tracking

### Overall Progress

| Phase | Documents | Tasks | Status |
|-------|-----------|-------|--------|
| Phase 0 | 01-config-system.md | TBD | ⏳ Planning |
| Phase 1 | 02-compiler-entry.md | TBD | ⏳ Planning |
| Phase 2 | 03-codegen-stub.md | TBD | ⏳ Planning |
| Phase 3 | 04-source-maps.md | TBD | ⏳ Planning |
| Phase 4 | 05-cli-architecture.md, 06-cli-commands.md | TBD | ⏳ Planning |
| Phase 5 | 07-vice-integration.md | TBD | ⏳ Planning |
| Phase 6 | 08-test-rig.md | TBD | ⏳ Planning |

---

**This document is the master index for the Blend65 end-to-end compilation pipeline.**