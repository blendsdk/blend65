# RD-12: Test Harness & Emulator Verification

> **Status**: 🟢 Authored
> **MVP Phase**: A
> **Depends On**: RD-01
> **Implements**: Testing architecture per AR-22..AR-27; Language Guard C4 (unit
>   testable) and C5 (runtime verifiable)
> **Owning package(s)**: `@blend65/test-harness` (published pkg, AR-24)
> **Created**: 2026-05-31
> **Last Updated**: 2026-05-31

---

## 1. Purpose

This document specifies the **test harness and emulator verification** infrastructure —
the three-tier testing taxonomy and the `@blend65/test-harness` package that enables
runtime verification of compiled Blend65 programs on real (emulated) 6502 platforms.

The Language Guard mandates that every feature is both unit-testable (C4) at every
compiler stage and runtime-verifiable (C5) on all target platform emulators. This RD
defines the framework that makes C5 possible: the `EmulatorDriver` abstraction, the
VICE x64sc binary-monitor driver (MVP), the assertion model, the run-synchronization
strategies, and the CI policy.

The harness is also a **published package** (AR-24): game developers can use it to test
their own compiled programs against register/memory assertions — it is not limited to
compiler tests.

---

## 2. Scope

**In scope:**

- Three-tier test taxonomy: unit / golden-snapshot / emulator-runtime (AR-22)
- `@blend65/test-harness` published package (AR-24): headless + GUI modes
- `EmulatorDriver` abstraction interface (AR-23)
- VICE `x64sc` binary-monitor protocol driver (MVP, AR-23)
- Assertion model: register/memory as truth, screenshots as artifacts (AR-25)
- Run strategies: `runUntilLabel` / `runFrames` / `runUntilMemory` (AR-26)
- Mandatory timeout guard on all run strategies (AR-26)
- CI policy: unit+golden in GH Actions, emulator local-only for now (AR-27)
- Test-helper utilities for golden-snapshot comparisons

**Out of scope (and where it lives instead):**

- Specific test cases for each compiler stage → defined in each RD's acceptance criteria
- Compiler pipeline internals → RD-02..RD-09
- ACME invocation and label-file parsing → RD-09 (harness consumes the label file)
- Platform profile data → RD-10

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, or the frozen spec section
> it implements. No decision may be invented here — discovery is closed.

---

## 3. Decisions & Requirements

### 3.1 Three-Tier Test Taxonomy

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | **Tier 1: Unit tests** | Standard Vitest tests of individual functions/modules. Fast, no I/O. Cover lexer token output, parser AST shape, semantic type/scope validation, IL generation, Instr translation | AR-22 |
| R2 | **Tier 2: Golden-snapshot tests** | Compile a `.blend` source file, capture deterministic output (tokens, AST JSON, IL text, `.asm` text), compare to a committed golden file. Detect regressions in any compiler stage | AR-22 |
| R3 | **Tier 3: Emulator-runtime tests** | Compile to binary, load in an emulator, run to a defined sync point, assert register/memory values. This is the C5 verification | AR-22 |
| R4 | Unit and golden tests run in CI | GitHub Actions runs tier 1+2 on every push/PR. No emulator needed | AR-27 |
| R5 | Emulator tests are local-only for now | No VICE/display on GitHub Actions runners. Emulator tests run locally and on a future self-hosted build server with headless VICE | AR-27 |

### 3.2 EmulatorDriver Abstraction

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R6 | `EmulatorDriver` is an abstract interface | The harness is not coupled to VICE specifically. The interface supports any emulator that can load a binary, run it, and report register/memory state | AR-23 |
| R7 | The MVP driver is `ViceDriver` (VICE x64sc binary monitor) | VICE's x64sc has a binary monitor protocol on a TCP port. The driver connects, sends commands, and reads responses | AR-23 |
| R8 | The driver supports headless and GUI modes | Headless: VICE runs without display (for CI/scripting). GUI: VICE shows a window (for debugging). Both use the same binary-monitor protocol | AR-24 |
| R9 | Future drivers can be added for other emulators | x16emu (CX16), Altirra (Atari), Stella/7800 (Atari 7800). The interface is designed to accommodate these | AR-23 |

### 3.3 VICE Binary Monitor Protocol

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R10 | The driver connects to VICE's binary monitor port | VICE is launched with `-binarymonitor -binarymonitoraddress 127.0.0.1:6502` (or configurable port) | AR-23 |
| R11 | The driver can load a program | Sends the binary to VICE via the monitor protocol (or launches VICE with the binary as an argument) | AR-23 |
| R12 | The driver can set breakpoints by address | Uses the binary monitor's checkpoint command to set execution breakpoints. Addresses come from the label file (RD-09) | AR-23, AR-67 |
| R13 | The driver can read registers | After a breakpoint hit, reads A, X, Y, SP, PC, and status flags | AR-23 |
| R14 | The driver can read memory | Reads arbitrary memory ranges from the emulator. Used for asserting variable values, screen content, etc. | AR-23 |
| R15 | The driver can resume execution | Continues from a breakpoint until the next breakpoint or timeout | AR-23 |
| R16 | The driver can capture screenshots | Saves a screenshot of the current display state. Used as a failure artifact, not a golden-match assertion | AR-25 |

### 3.4 Assertion Model

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R17 | Registers and memory are the primary assertion surface | Tests assert specific register values (A, X, Y) and memory contents at specific addresses after program execution reaches a sync point. These are deterministic and binary-comparable | AR-25 |
| R18 | Screenshots are failure artifacts, not golden assertions | Screenshots are captured on test failure for human debugging. They are NOT compared to golden images (avoids flaky pixel diffs across emulator versions) | AR-25 |
| R19 | Assertions use symbolic names where possible | Instead of raw addresses, tests use label names from the VICE label file (RD-09 AR-67): `assertMemory('_main.score', 42)` resolves the label to an address | AR-25, AR-67 |

### 3.5 Run Strategies

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R20 | `runUntilLabel(label)` — default strategy | Sets a breakpoint at the label address (from label file) and runs until hit. Used for terminating programs: set breakpoint at `__startup_done` or `_main` epilogue | AR-26 |
| R21 | `runFrames(n)` — frame-based strategy | Runs the emulator for `n` video frames. Used for non-terminating programs (game loops) that need time-based measurement | AR-26 |
| R22 | `runUntilMemory(addr, value)` — sentinel strategy | Polls a memory address until it reaches a target value. Used for programs that signal completion by writing a sentinel value | AR-26 |
| R23 | All strategies have a mandatory timeout guard | If the strategy doesn't complete within the timeout (default: 5 seconds), the test fails with a timeout error. Prevents hanging tests | AR-26 |
| R24 | Timeout is configurable per test | Individual tests can set a custom timeout for long-running programs | AR-26 |

### 3.6 Harness API

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R25 | The harness is usable from Vitest test files | Tests import from `@blend65/test-harness` and use the API within `describe`/`it` blocks. The harness manages emulator lifecycle | AR-24 |
| R26 | The harness handles emulator lifecycle | `beforeAll`: launch VICE, connect to binary monitor. `afterAll`: shut down VICE. `beforeEach`: reset state, load new binary. This is encapsulated in a test fixture | AR-24 |
| R27 | The harness accepts a `BuildResult` or binary path | Tests can either compile a program inline (using the compiler API) and pass the result, or load a pre-compiled binary by path | AR-24 |
| R28 | The harness loads the label file automatically | When given a `BuildResult`, the harness uses the symbol map for label-based breakpoints and assertions. When given a binary path, the harness looks for a `.lbl` file alongside | AR-67 |

### 3.7 Golden-Snapshot Testing

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R29 | Golden files are committed to the repository | Each golden test has a `.blend` input and one or more `.golden` output files (e.g., `.tokens.golden`, `.ast.golden`, `.il.golden`, `.asm.golden`) | AR-22 |
| R30 | Golden comparison is exact (byte-for-byte) | The test compiles the `.blend` file, captures the output at the relevant stage, and compares to the golden file. Any difference is a failure | H5 |
| R31 | Golden files are updated with a `--update-golden` flag | When the compiler output intentionally changes, running tests with `--update-golden` overwrites the golden files. This is a manual developer action | Design |
| R32 | Golden test helper utilities are provided | `assertGolden(actual: string, goldenPath: string)` — compares and reports diff on failure. Lives in `@blend65/test-harness` or a test-utils module | Design |

### 3.8 Published Package

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R33 | `@blend65/test-harness` is a published npm package | Game developers can install it and write runtime tests for their own compiled programs. It is not internal-only | AR-24 |
| R34 | The public API is stable and documented | The `EmulatorDriver`, `runUntilLabel`, assertion functions, and fixture helpers are the public API. Internal VICE protocol details are not exposed | AR-24 |
| R35 | The package works with any binary + platform profile | Not limited to Blend65-compiled programs. Any `.prg` (or platform binary) + label file can be tested | AR-24 |

---

## 4. Design Detail

### 4.1 EmulatorDriver Interface

```typescript
/**
 * Abstract emulator driver interface.
 * Defined in @blend65/test-harness.
 */
interface EmulatorDriver {
  /** Launch the emulator process */
  launch(options: LaunchOptions): Promise<void>;

  /** Load a binary into the emulator */
  loadBinary(binaryPath: string): Promise<void>;

  /** Set a breakpoint at an address */
  setBreakpoint(address: number): Promise<void>;

  /** Resume execution until next breakpoint or timeout */
  resume(): Promise<BreakReason>;

  /** Read CPU registers */
  readRegisters(): Promise<Registers>;

  /** Read a memory range */
  readMemory(start: number, length: number): Promise<Uint8Array>;

  /** Write to a memory location */
  writeMemory(address: number, data: Uint8Array): Promise<void>;

  /** Capture a screenshot (PNG) */
  captureScreenshot(): Promise<Buffer>;

  /** Shut down the emulator */
  shutdown(): Promise<void>;
}

interface LaunchOptions {
  /** Path to the emulator executable */
  executablePath: string;

  /** Monitor port (default: 6502) */
  monitorPort?: number;

  /** Whether to show the GUI (default: false = headless) */
  gui?: boolean;

  /** Additional emulator arguments */
  extraArgs?: string[];
}

interface Registers {
  a: number;
  x: number;
  y: number;
  sp: number;
  pc: number;
  flags: {
    carry: boolean;
    zero: boolean;
    interrupt: boolean;
    decimal: boolean;
    break_: boolean;
    overflow: boolean;
    negative: boolean;
  };
}

type BreakReason = 'breakpoint' | 'timeout' | 'exit';
```

### 4.2 Run Strategy Functions

```typescript
/**
 * Run until a labeled address is reached.
 * Resolves the label via the symbol map.
 */
async function runUntilLabel(
  driver: EmulatorDriver,
  symbols: Map<string, number>,
  label: string,
  timeout?: number
): Promise<Registers>;

/**
 * Run for N video frames.
 */
async function runFrames(
  driver: EmulatorDriver,
  frames: number,
  timeout?: number
): Promise<void>;

/**
 * Run until a memory address reaches a target value.
 */
async function runUntilMemory(
  driver: EmulatorDriver,
  address: number,
  value: number,
  timeout?: number
): Promise<void>;
```

### 4.3 Assertion Helpers

```typescript
/**
 * Assert that a register has a specific value.
 */
function assertRegister(
  registers: Registers,
  register: 'a' | 'x' | 'y' | 'sp',
  expected: number
): void;

/**
 * Assert that a memory location holds a specific value.
 * Supports symbolic names via the symbol map.
 */
async function assertMemory(
  driver: EmulatorDriver,
  address: number | string,
  expected: number | number[],
  symbols?: Map<string, number>
): Promise<void>;

/**
 * Assert golden-snapshot match.
 */
function assertGolden(
  actual: string,
  goldenPath: string,
  updateMode?: boolean
): void;
```

### 4.4 Test Fixture

```typescript
/**
 * Vitest fixture that manages emulator lifecycle.
 * Usage:
 *   const { driver, symbols } = await setupEmulator({ binary: 'test.prg' });
 *   const regs = await runUntilLabel(driver, symbols, '_main_end');
 *   assertRegister(regs, 'a', 42);
 */
async function setupEmulator(options: {
  binary: string;
  labelFile?: string;
  platform?: string;
  timeout?: number;
  gui?: boolean;
}): Promise<{
  driver: EmulatorDriver;
  symbols: Map<string, number>;
}>;
```

### 4.5 VICE x64sc Driver Implementation Notes

- **Connection**: TCP socket to `127.0.0.1:6502` (or configured port)
- **Protocol**: VICE binary monitor protocol (binary framing, command/response pairs)
- **Commands used**: `CHECKPOINT_SET` (breakpoints), `REGISTERS_GET`, `MEMORY_GET`,
  `MEMORY_SET`, `ADVANCE_INSTRUCTIONS`, `EXIT`
- **Screenshot**: `DISPLAY_GET` command captures frame buffer, saved as PNG
- **Headless launch**: `x64sc -binarymonitor -binarymonitoraddress 127.0.0.1:6502
  +sound -warp -autostartprgmode 1 <binary>`
- **Timeout**: Implemented via `setTimeout` on the resume() Promise; on timeout,
  send `CHECKPOINT_SET` at current PC to stop execution and read state

---

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-01 | Package structure: `@blend65/test-harness` is a published package in the monorepo |
| RD-09 | **Artifact provider**: the VICE label file (symbol map) enables `runUntilLabel` and symbolic `assertMemory` |
| RD-10 | **Consumer**: platform profile determines which emulator to launch and how to configure it |
| RD-11 | **Consumer**: test failures may reference diagnostic codes for expected-error tests |
| RD-15 | **Consumer**: compiler API enables compile-and-test workflows within test files |

---

## 6. Acceptance Criteria

- [ ] AC-01: `EmulatorDriver` interface is defined with launch/load/breakpoint/resume/read/screenshot/shutdown methods
- [ ] AC-02: `ViceDriver` implements the `EmulatorDriver` interface using VICE's binary monitor protocol
- [ ] AC-03: `runUntilLabel()` sets a breakpoint at a label address and returns registers on break
- [ ] AC-04: `runFrames()` runs the emulator for N frames
- [ ] AC-05: `runUntilMemory()` polls until a memory value matches
- [ ] AC-06: All run strategies enforce a mandatory timeout guard
- [ ] AC-07: `assertRegister()` validates register values
- [ ] AC-08: `assertMemory()` validates memory content (numeric address or symbolic label)
- [ ] AC-09: Screenshots are captured on test failure as artifacts (not golden-matched)
- [ ] AC-10: `assertGolden()` compares output to committed golden files with `--update-golden` support
- [ ] AC-11: The test fixture manages emulator lifecycle (launch/load/shutdown)
- [ ] AC-12: Unit and golden tests run in GitHub Actions CI (AR-27)
- [ ] AC-13: Emulator tests are skippable when VICE is not available (graceful skip, not failure)
- [ ] AC-14: `@blend65/test-harness` is a publishable npm package with a stable public API
- [ ] AC-15: The harness works with any binary + label file (not Blend65-specific)
- [ ] AC-16: All decisions trace to an `AR-NN` or a frozen spec section

---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

1. **VICE binary monitor protocol stability**: The binary monitor protocol is documented
   but has evolved between VICE versions. The driver targets VICE 3.7+ (current stable).
   If the protocol changes, the driver needs an update. Version detection at connection
   time could be added as a future enhancement.

2. **Headless VICE on CI**: Currently local-only (AR-27). When a self-hosted build server
   with headless VICE is available, emulator tests will be added to CI. The `xvfb` (X
   Virtual Framebuffer) approach or VICE's built-in headless mode can be used.
