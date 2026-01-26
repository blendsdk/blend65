# Requirements: Library Loading System

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

The Library Loading System provides built-in standard libraries that ship with the Blend65 compiler. Libraries are loaded automatically based on the compilation target, with optional libraries enabled via configuration or CLI flags.

## Functional Requirements

### Must Have

- [ ] **R1**: Load library `.blend` files from `packages/compiler/library/` directory
- [ ] **R2**: Auto-load `common/` directory for all targets
- [ ] **R3**: Auto-load `{target}/common/` directory for the specified target
- [ ] **R4**: Support opt-in libraries via `libraries` config option
- [ ] **R5**: Support opt-in libraries via `--libraries` CLI flag
- [ ] **R6**: Support both single-file libraries (`sid.blend`) and folder libraries (`sprites/`)
- [ ] **R7**: Library sources are prepended to user sources before compilation
- [ ] **R8**: Module names come from `module` declaration in library files (not file paths)
- [ ] **R9**: Report clear errors when requested library is not found

### Should Have

- [ ] **R10**: CLI `--libraries` flag overrides (not merges with) config file
- [ ] **R11**: Warn if library file has no `module` declaration
- [ ] **R12**: Support library discovery (list available libraries)

### Won't Have (Out of Scope)

- User-defined library paths (only `packages/compiler/library/`)
- Remote/network library loading
- Library versioning
- Circular library dependency detection (handled by existing DependencyGraph)
- Pre-compiled/cached ASTs (future optimization)

## Technical Requirements

### Performance

- Library loading should add minimal overhead (<100ms for typical projects)
- Libraries should only be loaded once per compilation

### Compatibility

- Works with existing module system (`ModuleRegistry`, `ImportResolver`)
- Works with existing compilation pipeline
- No breaking changes to existing code

### Error Handling

- Clear error message: "Library 'xyz' not found for target 'c64'"
- Include available libraries in error message
- File I/O errors should include the path that failed

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Library location | Separate package vs in compiler | In compiler | Simpler, no extra dependency |
| Auto-load strategy | All libraries vs common only | Common only | Faster compilation |
| Opt-in specification | Array vs comma-separated | Both (array in config, comma in CLI) | Best of both |
| File vs folder | Different names vs same name | Same name | User-friendly |

## Acceptance Criteria

1. [ ] `common/*.blend` files are loaded for all compilations
2. [ ] `{target}/common/*.blend` files are loaded when target is specified
3. [ ] Optional libraries load when specified in config
4. [ ] Optional libraries load when specified via CLI
5. [ ] Both single-file and folder libraries work with same syntax
6. [ ] Error is shown when library doesn't exist
7. [ ] All tests pass
8. [ ] Documentation updated