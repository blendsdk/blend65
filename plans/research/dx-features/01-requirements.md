# Requirements: DX Features

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

---

## Feature Overview

Developer Experience (DX) features enhance the Blend65 development workflow beyond basic compilation. These features make it easier to debug, test, and iterate on C64/C128/X16 programs.

---

## Functional Requirements

### Must Have (Phase 1-3)

- [ ] **Source Maps**: Generate VICE-compatible label files (`.labels`)
- [ ] **Debug Mode**: Support `none`/`inline`/`vice`/`both` debug output modes
- [ ] **Emulator Detection**: Find VICE executables in PATH
- [ ] **Auto-Launch**: `blend65 run` compiles and launches emulator
- [ ] **Watch Mode**: `blend65 watch` auto-rebuilds on file changes
- [ ] **Project Init**: `blend65 init` creates project from templates
- [ ] **Templates**: Basic, game, and demo project templates

### Should Have (Phase 4)

- [ ] **E2E Test Rig**: Test helper for emulator-based testing
- [ ] **Memory Assertions**: Verify memory values after program execution
- [ ] **CI Support**: E2E tests work in headless CI environments

### Won't Have (Out of Scope)

- VS Code extension (future roadmap, separate plan)
- Source-level debugging in VICE (requires VICE `.dbg` support)
- Hot reload (complex, future enhancement)
- Package manager (future project)
- Sprite editor integration (future project)

---

## Technical Requirements

### Cross-Platform Support

| Platform | Requirement |
|----------|-------------|
| macOS | Full support (primary development platform) |
| Linux | Full support (CI, secondary development) |
| Windows | Basic support (PATH detection, process spawning) |

### VICE Compatibility

| VICE Version | Support Level |
|--------------|---------------|
| 3.5+ | Full support |
| 3.7+ | Enhanced (binary monitor protocol) |

### Performance

| Metric | Target |
|--------|--------|
| Watch rebuild | < 500ms |
| VICE launch | < 2s from build |
| Label file generation | Negligible overhead |

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Label format | Custom, VICE format | VICE format | Native VICE support |
| Emulator detection | Config only, PATH search | PATH search + config | Better DX |
| Watch library | Custom, chokidar, nodemon | chokidar | Proven, minimal |
| Template storage | npm, bundled | Bundled | Simpler distribution |

---

## Acceptance Criteria

### Phase 1: Source Maps Complete
1. [ ] `-d vice` produces valid `.labels` file
2. [ ] `-d inline` adds source comments to assembly
3. [ ] `-d both` produces both outputs
4. [ ] Labels load correctly in VICE monitor

### Phase 2: VICE Integration Complete
1. [ ] `blend65 run` finds emulator automatically
2. [ ] Emulator launches with compiled `.prg`
3. [ ] Works on macOS and Linux
4. [ ] Config override for emulator path

### Phase 3: CLI Commands Complete
1. [ ] `blend65 init` creates valid project
2. [ ] Templates (basic, game, demo) work correctly
3. [ ] `blend65 watch` detects file changes
4. [ ] `blend65 watch --run` relaunches emulator

### Phase 4: Test Rig Complete
1. [ ] ViceTestRunner compiles and runs code
2. [ ] Memory assertions verify state
3. [ ] Clear error messages on failure
4. [ ] Example tests demonstrate usage

---

## Dependencies

### External Dependencies

| Dependency | Purpose | Version |
|------------|---------|---------|
| chokidar | File watching | ^3.5.0 |
| VICE | Emulator (user-installed) | 3.5+ |

### Internal Dependencies

| Component | Required For |
|-----------|--------------|
| Compiler | All features |
| Config system | Debug mode, emulator config |
| CLI (build, check) | run, watch commands |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| VICE API changes | Low | Medium | Pin to stable VICE versions |
| Cross-platform issues | Medium | Medium | Test on all platforms |
| File watch reliability | Medium | Low | Use proven chokidar library |
| CI headless testing | Medium | Medium | Document VICE headless mode |

---

**This document defines requirements for Blend65 DX features.**