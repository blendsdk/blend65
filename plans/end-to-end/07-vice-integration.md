# Phase 5: VICE Integration

> **Status**: Planning  
> **Phase**: 5  
> **Priority**: MEDIUM  
> **Dependencies**: Phase 4 (CLI)  
> **Estimated Tasks**: 4

---

## Codebase Analysis (Validated)

**VICE Integration Status: DOES NOT EXIST**

There is **no existing VICE-related code** in the codebase. All VICE integration is new.

**What Needs to be Created:**

1. **`packages/cli/src/runners/vice.ts`** - ViceRunner class
2. **Emulator detection** - Find x64sc/x64/x128/x16emu in PATH
3. **Process spawning** - Child process management
4. **VICE binary monitor protocol** (future) - For E2E testing

**Target Platform Info Already Exists:**

The `target/config.ts` provides platform info that maps to VICE executables:

```typescript
// Existing in packages/compiler/src/target/config.ts
export enum TargetArchitecture {
  C64 = 'c64',      // ’ x64sc or x64
  C128 = 'c128',    // ’ x128
  X16 = 'x16',      // ’ x16emu (Commander X16)
}
```

**External Dependencies:**
- VICE emulator must be installed on user's system
- PATH discovery for cross-platform support (macOS/Linux/Windows)
- No npm packages for VICE - use Node.js `child_process`

---

## Overview

VICE (Versatile Commodore Emulator) integration enables automatic program launching and testing.

---

## Emulator Detection

### Search Order
1. `emulator.path` in blend65.json
2. `BLEND65_EMULATOR` environment variable
3. Search PATH for: `x64sc`, `x64`, `xvic`, `x128`, `x16emu`

### Executable Names by Target

| Target | Executables (priority order) |
|--------|------------------------------|
| c64 | `x64sc`, `x64` |
| c128 | `x128` |
| x16 | `x16emu` |

```typescript
// runners/vice.ts

export function findEmulator(target: TargetArchitecture): string | null {
  const executables = {
    c64: ['x64sc', 'x64'],
    c128: ['x128'],
    x16: ['x16emu'],
  };
  
  for (const name of executables[target]) {
    const path = findInPath(name);
    if (path) return path;
  }
  return null;
}
```

---

## Launch Options

### VICE Arguments

```typescript
interface ViceLaunchOptions {
  prgPath: string;           // .prg file to load
  autoRun?: boolean;         // Auto-run after load (default: true)
  warp?: boolean;            // Warp mode for fast startup
  labelsFile?: string;       // Load VICE labels
  monitorCommands?: string;  // Execute monitor commands
  waitForExit?: boolean;     // Wait for emulator to close
}

function buildViceArgs(options: ViceLaunchOptions): string[] {
  const args: string[] = [];
  
  // Autostart the PRG
  args.push('-autostart', options.prgPath);
  
  // Auto-run mode
  if (options.autoRun !== false) {
    args.push('-autostartprgmode', '1');
  }
  
  // Warp mode
  if (options.warp) {
    args.push('-autostart-warp');
  }
  
  // Load labels
  if (options.labelsFile) {
    args.push('-moncommands', options.labelsFile);
  }
  
  return args;
}
```

---

## ViceRunner Class

```typescript
// runners/vice.ts

export class ViceRunner {
  protected emulatorPath: string;
  protected process: ChildProcess | null = null;
  
  constructor(emulatorPath?: string) {
    this.emulatorPath = emulatorPath || findEmulator('c64');
    if (!this.emulatorPath) {
      throw new Error('VICE emulator not found');
    }
  }
  
  /**
   * Launch VICE with compiled program
   */
  async launch(options: ViceLaunchOptions): Promise<void> {
    const args = buildViceArgs(options);
    
    this.process = spawn(this.emulatorPath, args, {
      detached: !options.waitForExit,
      stdio: options.waitForExit ? 'inherit' : 'ignore',
    });
    
    if (!options.waitForExit) {
      this.process.unref();
    } else {
      await new Promise<void>((resolve, reject) => {
        this.process!.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`VICE exited with code ${code}`));
        });
      });
    }
  }
  
  /**
   * Kill running emulator
   */
  kill(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
```

---

## Configuration

### blend65.json emulator section

```json
{
  "emulator": {
    "path": "/usr/local/bin/x64sc",
    "type": "vice",
    "args": ["-autostartprgmode", "1"],
    "autoRun": true,
    "waitForExit": false
  }
}
```

---

## Task Breakdown

### Task 5.1: Emulator Detection
- Search PATH for emulator
- Support environment variable
- Config file path

**Acceptance Criteria:**
- [ ] Finds emulator in PATH
- [ ] Respects config override
- [ ] Works on macOS/Linux/Windows

---

### Task 5.2: ViceRunner Class
- Launch emulator with PRG
- Handle arguments
- Wait or detach

**Acceptance Criteria:**
- [ ] Launches VICE correctly
- [ ] Loads PRG automatically
- [ ] Labels file loaded
- [ ] Warp mode works

---

### Task 5.3: CLI Integration
- Integrate with `run` command
- Integrate with `watch --run`
- Error handling

**Acceptance Criteria:**
- [ ] `blend65 run` works
- [ ] `blend65 watch --run` works
- [ ] Good error messages

---

### Task 5.4: Cross-Platform Testing
- Test on macOS
- Test on Linux
- Test on Windows

**Acceptance Criteria:**
- [ ] Works on all platforms
- [ ] Path handling correct
- [ ] Process spawning works

---

## Task Checklist

| Task | Description | Status |
|------|-------------|--------|
| 5.1 | Emulator Detection | [ ] |
| 5.2 | ViceRunner Class | [ ] |
| 5.3 | CLI Integration | [ ] |
| 5.4 | Cross-Platform Testing | [ ] |

---

**This document defines VICE integration for Blend65.**