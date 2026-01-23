# Developer Experience Roadmap

> **Status**: Planning  
> **Priority**: Reference Document

---

## Current Implementation Status (Validated)

**This is a roadmap document.** The comparison table below reflects aspirational goals.

**What Currently Exists:**

| Component | Status |
|-----------|--------|
| Lexer | ✅ Complete |
| Parser | ✅ Complete |
| Semantic Analyzer | ✅ Complete |
| IL Generator | ✅ Complete |
| Optimizer | 🔄 In Progress (peephole patterns) |
| Code Generator | ❌ Not Started (Phase 2) |
| CLI | ❌ Not Started (Phase 4) |
| VICE Integration | ❌ Not Started (Phase 5) |
| VS Code Extension | ❌ Not Started (Level 2) |

**Focus of End-to-End Plan:**
Phases 0-6 implement "Level 1: MVP" features to achieve working end-to-end compilation.

---

## Overview

Long-term developer experience vision for Blend65.

---

## DX Levels

### Level 1: MVP (Current Phase)
**Goal**: Working end-to-end compilation

| Feature | Status |
|---------|--------|
| `blend65 build` compiles to .prg | ⏳ In Progress |
| Multi-file projects | ⏳ In Progress |
| Clear error messages | ⏳ In Progress |
| `blend65 run` launches VICE | ⏳ In Progress |
| Project templates | ⏳ In Progress |

---

### Level 2: Enhanced DX (Next)
**Goal**: IDE integration and better debugging

| Feature | Status |
|---------|--------|
| VS Code syntax highlighting | ❌ Not Started |
| Error squiggles in editor | ❌ Not Started |
| Hover types | ❌ Not Started |
| Go-to-definition | ❌ Not Started |
| Watch mode | ⏳ In Progress |
| VICE label debugging | ⏳ In Progress |

---

### Level 3: Pro DX (Future)
**Goal**: Advanced tooling

| Feature | Status |
|---------|--------|
| Hot reload | ❌ Future |
| Source-level debugging | ❌ Future |
| Memory profiler | ❌ Future |
| Cycle counter | ❌ Future |
| Package manager | ❌ Future |
| Sprite editor integration | ❌ Future |

---

## VS Code Extension (Level 2)

### Features
- Syntax highlighting (.blend files)
- Error/warning squiggles
- Hover for type info
- Go-to-definition
- Auto-completion
- Format on save

### Architecture
```
packages/vscode-extension/
├── package.json
├── syntaxes/
│   └── blend65.tmLanguage.json
├── language-configuration.json
└── src/
    ├── extension.ts
    └── language-server/
```

---

## Comparison with Existing Tools

| Feature | cc65 | KickC | Blend65 (Goal) |
|---------|------|-------|----------------|
| Modern syntax | ❌ | ⚠️ | ✅ |
| Type system | ⚠️ | ⚠️ | ✅ |
| IDE support | ❌ | ⚠️ | ✅ |
| Error messages | ⚠️ | ⚠️ | ✅ |
| Debug support | ⚠️ | ⚠️ | ✅ |
| Watch mode | ❌ | ❌ | ✅ |
| Project config | ❌ | ❌ | ✅ |

---

## Community Feedback Integration

- GitHub Issues for feature requests
- Discord for community discussion
- User surveys for prioritization
- Beta testing program

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Compile time | <1s for typical project |
| Error clarity | 95% actionable messages |
| VICE launch | <2s from build |
| Watch rebuild | <500ms |

---

**This document outlines the developer experience roadmap for Blend65.**