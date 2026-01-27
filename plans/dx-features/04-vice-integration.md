# Phase 2: VICE Integration

> **Document**: 04-vice-integration.md
> **Parent**: [Index](00-index.md)
> **Phase**: 2
> **Sessions**: 1-2
> **Dependencies**: Phase 1 (Source Maps)

---

## Overview

VICE (Versatile Commodore Emulator) integration enables automatic program launching and testing.

---

## Emulator Detection

### Search Order
1. `emulator.path` in blend65.json
2. `BLEND65_EMULATOR` environment variable
3. Search PATH for: `x64sc`, `x64`, `x128`, `x16emu`

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

import { spawn, ChildProcess } from 'child_process';

export class ViceRunner {
  protected emulatorPath: string;
  protected process: ChildProcess | null = null;
  
  constructor(emulatorPath?: string) {
    this.emulatorPath = emulatorPath || findEmulator('c64');
    if (!this.emulatorPath) {
      throw new Error('VICE emulator not found. Install VICE or set emulator.path in blend65.json');
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
    "warp": false,
    "waitForExit": false
  }
}
```

---

## Cross-Platform Support

### macOS
- VICE installed via Homebrew: `/opt/homebrew/bin/x64sc`
- VICE.app bundle: `/Applications/VICE/x64sc.app/Contents/MacOS/x64sc`

### Linux
- Package manager: `/usr/bin/x64sc`
- Manual install: `/usr/local/bin/x64sc`

### Windows
- Default install: `C:\Program Files\VICE\x64sc.exe`
- Portable: User-specified path

---

## Task Breakdown

### Task 2.1: Emulator Detection
**File**: `packages/cli/src/runners/vice.ts`

- Search PATH for emulator
- Support environment variable
- Config file path override

**Acceptance Criteria:**
- [ ] Finds emulator in PATH
- [ ] Respects config override
- [ ] Works on macOS/Linux/Windows
- [ ] Clear error when not found

---

### Task 2.2: ViceRunner Class
**File**: `packages/cli/src/runners/vice.ts`

- Launch emulator with PRG
- Handle arguments
- Wait or detach modes

**Acceptance Criteria:**
- [ ] Launches VICE correctly
- [ ] Loads PRG automatically
- [ ] Labels file loaded
- [ ] Warp mode works

---

### Task 2.3: Config Integration
**Files**: Update config types

- Add emulator config to blend65.json schema
- CLI argument handling

**Acceptance Criteria:**
- [ ] Config schema updated
- [ ] CLI passes options to ViceRunner
- [ ] Default config works

---

### Task 2.4: Error Handling
**Files**: Various

- Clear error messages
- Install instructions
- Platform-specific guidance

**Acceptance Criteria:**
- [ ] Helpful error when VICE not found
- [ ] Clear error on launch failure
- [ ] Logs for debugging

---

## Task Checklist

| Task | Description | Status |
|------|-------------|--------|
| 2.1 | Emulator Detection | [ ] |
| 2.2 | ViceRunner Class | [ ] |
| 2.3 | Config Integration | [ ] |
| 2.4 | Error Handling | [ ] |

---

**This document defines VICE integration for Blend65.**