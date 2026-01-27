# Phase 4b: CLI Commands

> **Status**: Planning  
> **Phase**: 4b  
> **Priority**: HIGH  
> **Dependencies**: Phase 4a (CLI Architecture)  
> **Estimated Tasks**: 5

---

## Codebase Analysis (Validated)

**Dependency**: This phase builds on Phase 4a (CLI Architecture) which creates the `packages/cli/` package.

**Compiler Integration Points:**

Since the CLI commands invoke the compiler, here's what the commands will call:

| Command | Compiler Usage |
|---------|----------------|
| `init` | No compiler - creates files from templates |
| `build` | `Compiler.compile()` → full pipeline |
| `check` | `Compiler.check()` → parse + semantic only, no codegen |
| `run` | `build` + `ViceRunner.launch()` |
| `watch` | `chokidar` → `build` on change |

**Template Storage:**
- Templates will be stored in `packages/cli/templates/` (bundled with CLI)
- Or fetched from npm (future enhancement)

**No existing CLI commands to integrate** - all commands are new.

---

## Command Overview

| Command | Description | Priority |
|---------|-------------|----------|
| `blend65 init` | Create new project | HIGH |
| `blend65 build` | Compile project | HIGH |
| `blend65 check` | Syntax check only | HIGH |
| `blend65 run` | Build + launch emulator | MEDIUM |
| `blend65 watch` | Auto-rebuild on change | MEDIUM |

---

## 1. blend65 init

Initialize a new Blend65 project with sensible defaults.

```bash
blend65 init [name] [options]

Options:
  --template   Project template (basic, game, demo)  [default: "basic"]
  --force      Overwrite existing files             [default: false]

Examples:
  blend65 init                    # Init in current directory
  blend65 init my-game            # Init in ./my-game/
  blend65 init --template=game    # Use game template
```

**Generated Files:**
```
my-game/
├── blend65.json
├── src/
│   └── main.blend
├── assets/
│   └── .gitkeep
├── build/
│   └── .gitkeep
└── .gitignore
```

---

## 2. blend65 build

Compile the project to .prg and optionally .asm.

```bash
blend65 build [files...] [options]

Options:
  -t, --target        Target platform (c64, c128, x16)
  -O, --optimization  Optimization level (O0-O3, Os, Oz)
  -d, --debug         Debug info (none, inline, vice, both)
  -o, --out           Output directory
  --outFile           Output filename

Examples:
  blend65 build                        # Build using blend65.json
  blend65 build -t c64 -O2            # With overrides
  blend65 build game.blend -o dist     # Single file
```

**Output:**
```
Compiling 3 file(s)...
✓ Build succeeded in 245 ms
  → build/game.prg (2,847 bytes)
  → build/game.labels
```

---

## 3. blend65 check

Check syntax and types without generating output.

```bash
blend65 check [files...] [options]

Options:
  --strict    Treat warnings as errors

Examples:
  blend65 check                   # Check all project files
  blend65 check src/**/*.blend     # Check specific files
  blend65 check --strict          # Fail on warnings
```

**Output (success):**
```
✓ No errors found in 5 file(s)
```

**Output (errors):**
```
error: Type mismatch: expected 'byte', got 'word'
  --> src/game.blend:42:15

error: Unknown identifier 'playerSpeed'
  --> src/game.blend:58:5

✗ Found 2 error(s) in 5 file(s)
```

---

## 4. blend65 run

Build and launch in emulator.

```bash
blend65 run [files...] [options]

Options:
  --emulator     Emulator executable path
  --no-build     Skip build, run existing .prg
  --warp         Enable warp mode for fast startup

Examples:
  blend65 run                      # Build and run
  blend65 run --no-build           # Run existing .prg
  blend65 run --emulator=/path/to/x64sc
```

**Output:**
```
Compiling 3 file(s)...
✓ Build succeeded in 245 ms
Launching VICE (x64sc)...
```

---

## 5. blend65 watch

Watch for file changes and auto-rebuild.

```bash
blend65 watch [files...] [options]

Options:
  --run        Also launch emulator on rebuild
  --clear      Clear terminal on rebuild

Examples:
  blend65 watch                    # Watch and rebuild
  blend65 watch --run              # Watch, rebuild, and run
```

**Output:**
```
Watching for changes in src/**/*.blend
[12:34:56] File changed: src/game.blend
[12:34:56] Rebuilding...
[12:34:57] ✓ Build succeeded in 189 ms
```

---

## Task Breakdown

### Task 4b.1: init Command
**File**: `packages/cli/src/commands/init.ts`

- Create project directory structure
- Generate blend65.json with defaults
- Copy template files
- Initialize .gitignore

**Acceptance Criteria:**
- [ ] Creates correct directory structure
- [ ] Generates valid blend65.json
- [ ] Templates work (basic, game, demo)
- [ ] --force overwrites existing

---

### Task 4b.2: build Command
**File**: `packages/cli/src/commands/build.ts`

- Load config and merge CLI options
- Invoke Compiler
- Write output files (.prg, .asm, .labels)
- Report results

**Acceptance Criteria:**
- [ ] Compiles successfully
- [ ] CLI overrides work
- [ ] Output files written correctly
- [ ] Errors formatted nicely

---

### Task 4b.3: check Command
**File**: `packages/cli/src/commands/check.ts`

- Parse and analyze without codegen
- Report errors/warnings
- --strict mode

**Acceptance Criteria:**
- [ ] No output files generated
- [ ] Errors reported correctly
- [ ] --strict works
- [ ] Fast execution

---

### Task 4b.4: run Command
**File**: `packages/cli/src/commands/run.ts`

- Build (unless --no-build)
- Find emulator
- Launch with .prg
- Handle emulator errors

**Acceptance Criteria:**
- [ ] Builds before running
- [ ] Finds emulator in PATH
- [ ] --no-build skips compilation
- [ ] Works on macOS/Linux/Windows

---

### Task 4b.5: watch Command
**File**: `packages/cli/src/commands/watch.ts`

- Use chokidar for file watching
- Debounce rebuilds
- Clear terminal option
- Optional emulator relaunch

**Acceptance Criteria:**
- [ ] Detects file changes
- [ ] Debounces rapid changes
- [ ] --clear works
- [ ] --run relaunches emulator

---

## Task Checklist

| Task | Description | Status |
|------|-------------|--------|
| 4b.1 | init Command | [ ] |
| 4b.2 | build Command | [ ] |
| 4b.3 | check Command | [ ] |
| 4b.4 | run Command | [ ] |
| 4b.5 | watch Command | [ ] |

---

**This document defines the CLI commands for Blend65.**