# Phase 3: CLI Commands

> **Document**: 05-cli-commands.md
> **Parent**: [Index](00-index.md)
> **Phase**: 3
> **Sessions**: 2
> **Dependencies**: Phase 2 (VICE Integration)

---

## Overview

Complete CLI with all developer commands. Existing commands (`build`, `check`) are already implemented. This phase adds `init`, `run`, and `watch`.

---

## Existing Commands (Already Implemented)

| Command | Status | Description |
|---------|--------|-------------|
| `blend65 build` | ✅ Complete | Compile project to .prg |
| `blend65 check` | ✅ Complete | Syntax check without output |

---

## New Commands

### 1. blend65 init

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

**Generated Files (basic template):**
```
my-game/
├── blend65.json
├── src/
│   └── main.blend
├── build/
│   └── .gitkeep
└── .gitignore
```

---

### 2. blend65 run

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

### 3. blend65 watch

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

## Implementation Details

### init Command

```typescript
// commands/init.ts

export async function initCommand(options: InitOptions): Promise<void> {
  const targetDir = options.name || '.';
  const templateName = options.template || 'basic';
  
  // Validate directory
  if (!options.force && directoryHasFiles(targetDir)) {
    throw new Error('Directory not empty. Use --force to overwrite.');
  }
  
  // Copy template
  const templateDir = getTemplateDir(templateName);
  await copyTemplate(templateDir, targetDir);
  
  // Update blend65.json with project name
  const configPath = path.join(targetDir, 'blend65.json');
  const config = JSON.parse(await readFile(configPath, 'utf-8'));
  config.name = path.basename(targetDir);
  await writeFile(configPath, JSON.stringify(config, null, 2));
  
  console.log(`✓ Created project in ${targetDir}`);
}
```

### run Command

```typescript
// commands/run.ts

export async function runCommand(options: RunOptions): Promise<void> {
  // Build first (unless --no-build)
  if (!options.noBuild) {
    const buildResult = await buildCommand(options);
    if (!buildResult.success) {
      process.exit(1);
    }
  }
  
  // Find PRG file
  const prgPath = findPrgFile(options);
  const labelsPath = prgPath.replace('.prg', '.labels');
  
  // Launch emulator
  const runner = new ViceRunner(options.emulator);
  await runner.launch({
    prgPath,
    labelsFile: existsSync(labelsPath) ? labelsPath : undefined,
    warp: options.warp,
    waitForExit: false,
  });
  
  console.log('Launching VICE...');
}
```

### watch Command

```typescript
// commands/watch.ts

import chokidar from 'chokidar';

export async function watchCommand(options: WatchOptions): Promise<void> {
  const sourceDir = options.sourceDir || 'src';
  const pattern = `${sourceDir}/**/*.blend`;
  
  console.log(`Watching for changes in ${pattern}`);
  
  const watcher = chokidar.watch(pattern, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100 },
  });
  
  let building = false;
  
  watcher.on('change', async (path) => {
    if (building) return;
    building = true;
    
    const time = new Date().toLocaleTimeString();
    
    if (options.clear) {
      console.clear();
    }
    
    console.log(`[${time}] File changed: ${path}`);
    console.log(`[${time}] Rebuilding...`);
    
    try {
      const result = await buildCommand(options);
      
      if (result.success) {
        console.log(`[${time}] ✓ Build succeeded in ${result.timeMs} ms`);
        
        if (options.run) {
          await runCommand({ ...options, noBuild: true });
        }
      }
    } catch (error) {
      console.error(`[${time}] ✗ Build failed:`, error.message);
    }
    
    building = false;
  });
  
  // Keep process alive
  process.stdin.resume();
}
```

---

## Task Breakdown

### Task 3.1: init Command
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

### Task 3.2: run Command
**File**: `packages/cli/src/commands/run.ts`

- Build (unless --no-build)
- Find emulator
- Launch with .prg
- Handle emulator errors

**Acceptance Criteria:**
- [ ] Builds before running
- [ ] Finds emulator in PATH
- [ ] --no-build skips compilation
- [ ] Works on macOS/Linux

---

### Task 3.3: watch Command
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

### Task 3.4: CLI Registration
**File**: `packages/cli/src/cli.ts`

- Register new commands with yargs
- Update help text
- Add command aliases

**Acceptance Criteria:**
- [ ] All commands accessible
- [ ] Help text accurate
- [ ] Tab completion works

---

## Task Checklist

| Task | Description | Status |
|------|-------------|--------|
| 3.1 | init Command | [ ] |
| 3.2 | run Command | [ ] |
| 3.3 | watch Command | [ ] |
| 3.4 | CLI Registration | [ ] |

---

**This document defines CLI commands for Blend65.**