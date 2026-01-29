# VICE Test Rig: Gap Amendment

> **Document**: 13-vice-test-rig.md
> **Parent**: [Index](00-index.md)
> **Type**: Gap Amendment
> **Addresses**: Gap #1 (No execution verification), Gap #10 (ACME integration)

## Overview

This amendment adds **VICE emulator integration** for true correctness verification. Instead of only checking ASM patterns, we now compile, assemble, and **run code in VICE** to verify actual behavior.

**Why This Matters:**
- ASM pattern matching can pass even when code is wrong
- Only execution proves the compiler works
- VICE is the gold standard C64 emulator

---

## Architecture

```
Test Suite
    │
    ├─► Compile Blend → ASM (existing)
    │
    ├─► Assemble with ACME → PRG (NEW)
    │
    ├─► Load PRG into VICE (NEW)
    │
    ├─► Execute and wait for completion (NEW)
    │
    ├─► Query registers/memory via monitor (NEW)
    │
    └─► Verify results match expectations (NEW)
```

---

## Component 1: VICE Runner Utility

### Location

```
packages/compiler/src/__tests__/e2e/helpers/
├── vice-runner.ts
└── vice-runner.test.ts
```

### Interface Design

```typescript
// vice-runner.ts

/**
 * Configuration for VICE emulator connection.
 */
export interface ViceConfig {
  /** Path to x64sc executable (auto-detected if not specified) */
  vicePath?: string;
  /** Remote monitor port (default: 6510) */
  port?: number;
  /** Timeout for operations in ms (default: 5000) */
  timeout?: number;
  /** Run headless (no window) */
  headless?: boolean;
}

/**
 * Result from VICE execution.
 */
export interface ViceResult {
  /** Accumulator value */
  a: number;
  /** X register value */
  x: number;
  /** Y register value */
  y: number;
  /** Stack pointer */
  sp: number;
  /** Program counter */
  pc: number;
  /** Processor status flags */
  flags: {
    negative: boolean;
    overflow: boolean;
    break: boolean;
    decimal: boolean;
    interrupt: boolean;
    zero: boolean;
    carry: boolean;
  };
}

/**
 * VICE emulator controller for automated testing.
 */
export class ViceRunner {
  /**
   * Start VICE emulator with remote monitor.
   */
  static async start(config?: ViceConfig): Promise<ViceRunner>;
  
  /**
   * Stop VICE emulator.
   */
  async stop(): Promise<void>;
  
  /**
   * Load a PRG file into VICE.
   */
  async loadPrg(prgPath: string): Promise<void>;
  
  /**
   * Execute from current PC until BRK or timeout.
   */
  async run(): Promise<void>;
  
  /**
   * Execute until specific address.
   */
  async runUntil(address: number): Promise<void>;
  
  /**
   * Get current register state.
   */
  async getRegisters(): Promise<ViceResult>;
  
  /**
   * Read memory range.
   */
  async readMemory(address: number, length: number): Promise<Uint8Array>;
  
  /**
   * Write to memory.
   */
  async writeMemory(address: number, data: Uint8Array): Promise<void>;
  
  /**
   * Send raw monitor command.
   */
  async sendCommand(command: string): Promise<string>;
  
  /**
   * Reset the machine.
   */
  async reset(): Promise<void>;
}
```

### Implementation Notes

```typescript
// Implementation sketch - uses VICE's binary remote monitor protocol

import { spawn, ChildProcess } from 'child_process';
import net from 'net';

export class ViceRunner {
  private process: ChildProcess | null = null;
  private socket: net.Socket | null = null;
  private config: Required<ViceConfig>;
  
  private constructor(config: Required<ViceConfig>) {
    this.config = config;
  }
  
  static async start(config?: ViceConfig): Promise<ViceRunner> {
    const fullConfig: Required<ViceConfig> = {
      vicePath: config?.vicePath ?? 'x64sc',
      port: config?.port ?? 6510,
      timeout: config?.timeout ?? 5000,
      headless: config?.headless ?? true,
    };
    
    const runner = new ViceRunner(fullConfig);
    await runner.startVice();
    await runner.connect();
    return runner;
  }
  
  private async startVice(): Promise<void> {
    const args = [
      '-remotemonitor',
      '-remotemonitoraddress', `127.0.0.1:${this.config.port}`,
    ];
    
    if (this.config.headless) {
      args.push('-console');  // Run without GUI
    }
    
    this.process = spawn(this.config.vicePath, args, {
      stdio: 'pipe',
    });
    
    // Wait for VICE to be ready
    await this.waitForStartup();
  }
  
  private async connect(): Promise<void> {
    this.socket = net.connect(this.config.port, '127.0.0.1');
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.timeout);
      
      this.socket!.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      this.socket!.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
  
  async loadPrg(prgPath: string): Promise<void> {
    // Use VICE monitor 'load' command
    await this.sendCommand(`load "${prgPath}" 0`);
  }
  
  async run(): Promise<void> {
    // Execute until BRK instruction
    await this.sendCommand('goto');
  }
  
  async getRegisters(): Promise<ViceResult> {
    const response = await this.sendCommand('registers');
    return this.parseRegisters(response);
  }
  
  async readMemory(address: number, length: number): Promise<Uint8Array> {
    const endAddr = address + length - 1;
    const response = await this.sendCommand(`m ${address.toString(16)} ${endAddr.toString(16)}`);
    return this.parseMemoryDump(response);
  }
  
  // ... additional implementation details
}
```

---

## Component 2: ACME Assembler Integration

### Location

```
packages/compiler/src/__tests__/e2e/helpers/
├── acme-assembler.ts
└── acme-assembler.test.ts
```

### Interface Design

```typescript
// acme-assembler.ts

/**
 * Result from ACME assembly.
 */
export interface AcmeResult {
  success: boolean;
  prgPath: string | null;
  errors: string[];
  warnings: string[];
}

/**
 * Assemble a .asm file using ACME.
 * 
 * @param asmPath - Path to the .asm file
 * @param outputPath - Path for the output .prg file
 * @returns Assembly result
 */
export async function assembleWithAcme(
  asmPath: string,
  outputPath?: string
): Promise<AcmeResult>;

/**
 * Assemble ASM source string directly.
 * Creates temp files, assembles, returns result.
 * 
 * @param asmSource - Assembly source code
 * @returns Assembly result with temp PRG path
 */
export async function assembleAsmString(asmSource: string): Promise<AcmeResult>;
```

### Implementation

```typescript
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function assembleWithAcme(
  asmPath: string,
  outputPath?: string
): Promise<AcmeResult> {
  const output = outputPath ?? asmPath.replace(/\.asm$/, '.prg');
  
  return new Promise((resolve) => {
    const acme = spawn('acme', [
      '-f', 'cbm',      // CBM output format
      '-o', output,      // Output file
      asmPath            // Input file
    ]);
    
    let stderr = '';
    acme.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    acme.on('close', (code) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Parse ACME output
      for (const line of stderr.split('\n')) {
        if (line.includes('Error')) {
          errors.push(line);
        } else if (line.includes('Warning')) {
          warnings.push(line);
        }
      }
      
      resolve({
        success: code === 0 && errors.length === 0,
        prgPath: code === 0 ? output : null,
        errors,
        warnings,
      });
    });
  });
}

export async function assembleAsmString(asmSource: string): Promise<AcmeResult> {
  // Create temp directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'blend65-test-'));
  const asmPath = path.join(tempDir, 'test.asm');
  const prgPath = path.join(tempDir, 'test.prg');
  
  // Write ASM to temp file
  await fs.writeFile(asmPath, asmSource, 'utf-8');
  
  // Assemble
  return assembleWithAcme(asmPath, prgPath);
}
```

---

## Component 3: Integrated Test Helper

### Location

```
packages/compiler/src/__tests__/e2e/helpers/
└── vice-test-helper.ts
```

### Interface Design

```typescript
// vice-test-helper.ts

/**
 * Complete test result from compile → assemble → run.
 */
export interface ViceTestResult {
  /** Compilation succeeded */
  compiled: boolean;
  /** Assembly succeeded */
  assembled: boolean;
  /** Execution completed */
  executed: boolean;
  /** Register state after execution */
  registers: ViceResult | null;
  /** Memory state (if requested) */
  memory?: Uint8Array;
  /** Errors encountered */
  errors: string[];
}

/**
 * Options for VICE testing.
 */
export interface ViceTestOptions {
  /** Memory addresses to read after execution */
  readMemory?: Array<{ address: number; length: number }>;
  /** Timeout for execution */
  timeout?: number;
  /** Skip VICE testing (for CI without VICE) */
  skipVice?: boolean;
}

/**
 * Compile Blend source, assemble, and run in VICE.
 * 
 * @param source - Blend65 source code
 * @param options - Test options
 * @returns Complete test result
 */
export async function compileAndRunInVice(
  source: string,
  options?: ViceTestOptions
): Promise<ViceTestResult>;

/**
 * Check if VICE is available on this system.
 */
export function isViceAvailable(): boolean;

/**
 * Skip test if VICE is not available.
 * Use in test setup: `skipIfNoVice()`
 */
export function skipIfNoVice(): void;
```

### Usage Example

```typescript
// In a test file
import { compileAndRunInVice, skipIfNoVice } from './helpers/vice-test-helper';

describe('VICE Integration Tests', () => {
  beforeAll(() => {
    skipIfNoVice();  // Skip all tests if VICE not installed
  });
  
  it('should compute 5 + 3 = 8', async () => {
    const result = await compileAndRunInVice(`
      function main(): void {
        let result: byte = 5 + 3;
        poke($C000, result);  // Write result to known location
        brk();                // Signal completion
      }
    `, {
      readMemory: [{ address: 0xC000, length: 1 }]
    });
    
    expect(result.executed).toBe(true);
    expect(result.memory![0]).toBe(8);
  });
  
  it('should handle if-else correctly', async () => {
    const result = await compileAndRunInVice(`
      function main(): void {
        let x: byte = 10;
        let y: byte;
        if (x > 5) {
          y = 1;
        } else {
          y = 2;
        }
        poke($C000, y);
        brk();
      }
    `, {
      readMemory: [{ address: 0xC000, length: 1 }]
    });
    
    expect(result.memory![0]).toBe(1);  // x > 5, so y = 1
  });
});
```

---

## Component 4: Environment Detection

### Skip Logic

```typescript
// Check environment for VICE availability
export function isViceAvailable(): boolean {
  try {
    // Try to find x64sc in PATH
    const which = spawnSync('which', ['x64sc']);
    return which.status === 0;
  } catch {
    return false;
  }
}

export function skipIfNoVice(): void {
  if (process.env.SKIP_VICE === '1') {
    console.log('Skipping VICE tests (SKIP_VICE=1)');
    return;
  }
  
  if (!isViceAvailable()) {
    console.log('Skipping VICE tests (x64sc not found)');
    // Use vitest's skip mechanism
    throw new Error('VICE not available - skipping test');
  }
}
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `SKIP_VICE=1` | Skip all VICE tests (for CI without VICE) |
| `VICE_PATH=/path/to/x64sc` | Custom path to VICE executable |
| `VICE_TIMEOUT=10000` | Custom timeout in milliseconds |

---

## Task Breakdown

### Session 0.5: VICE Test Rig (4-5 hours)

| Task | Description | File |
|------|-------------|------|
| 0.5.1 | Create ViceRunner class skeleton | `vice-runner.ts` |
| 0.5.2 | Implement VICE process management | `vice-runner.ts` |
| 0.5.3 | Implement remote monitor protocol | `vice-runner.ts` |
| 0.5.4 | Create ACME assembler helper | `acme-assembler.ts` |
| 0.5.5 | Create integrated test helper | `vice-test-helper.ts` |
| 0.5.6 | Add environment detection | `vice-test-helper.ts` |
| 0.5.7 | Write tests for VICE helper | `vice-runner.test.ts` |
| 0.5.8 | Document usage in README | README update |

---

## Success Criteria

### This amendment is complete when:

1. ✅ ViceRunner can start/stop VICE emulator
2. ✅ ViceRunner can load PRG files
3. ✅ ViceRunner can execute and query registers
4. ✅ ViceRunner can read/write memory
5. ✅ ACME assembler integration works
6. ✅ compileAndRunInVice() end-to-end works
7. ✅ Tests skip gracefully when VICE unavailable
8. ✅ At least 10 example VICE tests pass

### Verification

```bash
# With VICE installed
./compiler-test e2e/helpers

# Without VICE (should skip gracefully)
SKIP_VICE=1 ./compiler-test e2e/helpers
```

---

## Integration with Existing Plan

This amendment:
- Extends **Phase 0: Test Infrastructure** with Session 0.5
- Enables **Phase 9: Correctness Tests** to use VICE verification
- Makes testing **mandatory by default** with opt-out

---

## Related Documents

- [Test Infrastructure](03-test-infrastructure.md) - Phase 0 base
- [Correctness Tests](12-correctness-tests.md) - Uses VICE testing
- [Execution Plan](99-execution-plan.md) - Session scheduling