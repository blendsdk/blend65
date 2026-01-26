# Requirements: Exit Behavior

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Add a configurable `exitBehavior` option to the Blend65 compiler that controls what the program does when the `main()` function returns.

On the Commodore 64, when machine code finishes execution, there's no operating system to return to - the CPU just keeps executing whatever bytes come next in memory. The compiler must generate explicit exit code to handle this safely.

## Functional Requirements

### Must Have

- [ ] Add `exitBehavior` option to `CompilerOptions` interface
- [ ] Add `--exit-behavior` CLI flag to `blend65 build` command
- [ ] Support `exitBehavior` in `blend65.json` configuration file
- [ ] Implement three exit behaviors:
  - `loop` - Infinite loop (current behavior)
  - `basic` - Jump to BASIC warm start ($A474)
  - `reset` - Jump to system reset ($FCE2)
- [ ] Default to `loop` for backward compatibility
- [ ] Pass option from CLI → Compiler Config → CodeGenerator

### Should Have

- [ ] Validate exit behavior value in CLI and config file
- [ ] Clear error messages for invalid values
- [ ] Document the option in CLI help text

### Won't Have (Out of Scope)

- Custom exit addresses (e.g., `--exit-address=0xC000`)
- Target-specific exit addresses (C128, X16 support)
- Wait-for-keypress exit behavior
- These can be added in future iterations

## Technical Requirements

### Exit Addresses (C64)

| Behavior | Address | Description |
|----------|---------|-------------|
| `loop` | N/A | `JMP` to self (current address) |
| `basic` | `$A474` | BASIC warm start - returns to READY prompt |
| `reset` | `$FCE2` | Cold reset - full system initialization |

### Compatibility

- Must work with BASIC stub (default load at $0801)
- Must work without BASIC stub (custom load addresses)
- Must work with all optimization levels

### Implementation Flow

```
CLI (--exit-behavior=basic)
    ↓
buildConfig() in build.ts
    ↓
CompilerOptions.exitBehavior
    ↓
CodeGenerator receives in CodegenOptions
    ↓
generateEntryPoint() uses exitBehavior
    ↓
Correct assembly generated
```

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Default value | `loop` or `basic` | `loop` | Backward compatible, safest |
| CLI flag name | `--exit`, `--exit-behavior` | `--exit-behavior` | Explicit, matches config key |
| Type | string literal union | `'loop' \| 'basic' \| 'reset'` | Type-safe, matches pattern |

## Acceptance Criteria

1. [ ] `blend65 build main.blend --exit-behavior=basic` compiles with `JMP $A474`
2. [ ] `blend65 build main.blend --exit-behavior=loop` compiles with infinite loop
3. [ ] `blend65 build main.blend --exit-behavior=reset` compiles with `JMP $FCE2`
4. [ ] `blend65 build main.blend` (no flag) uses `loop` (default)
5. [ ] `blend65.json` with `exitBehavior: "basic"` works correctly
6. [ ] Invalid values show clear error message
7. [ ] All existing tests pass
8. [ ] New tests cover all exit behaviors
9. [ ] Documentation updated