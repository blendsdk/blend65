# Emulator Driver & VICE Binary-Monitor Protocol

> **Document**: 03-02-emulator-driver.md
> **Parent**: [Index](00-index.md)
> **Covers**: AC-01/02/09 · R6–R16 · AR-H4/H8/H11/H13/H14/H15/H16

## Overview

This component delivers the abstract `EmulatorDriver` interface (AC-01), the pure VICE
binary-monitor **protocol codec** (AR-H14), the concrete `ViceDriver` that speaks the
protocol over a loopback TCP socket (AC-02), and the zero-dependency PNG screenshot encoder
(AC-09, AR-H4). The codec is deliberately split from the socket transport so its framing
tests run in CI with no emulator (AR-H14).

## Architecture

### Module layout (AR-H13)

```
src/emulator/
├── driver.ts              # EmulatorDriver interface + LaunchOptions/Registers/BreakReason (RD §4.1)
└── vice/
    ├── protocol.ts        # PURE codec: command→bytes, bytes→response. No I/O. (AR-H14)
    ├── vice-driver.ts     # ViceDriver: net.Socket transport + child_process spawn + EmulatorDriver impl
    └── png.ts             # DISPLAY_GET + PALETTE_GET → truecolor PNG via zlib (AR-H4)
```

### Proposed changes

All net-new. `driver.ts` transcribes the RD §4.1 published contract verbatim (including
`Registers.flags.break_`, AR-H16). `vice-driver.ts` composes `protocol.ts` (encode/decode)
with a `net.Socket` and a spawned `x64sc` process.

## Implementation Details

### New Types/Interfaces (`driver.ts`, RD §4.1 — the published contract)

```typescript
/** Abstract emulator driver (AR-23). Any emulator that can load a binary, run it,
 *  and report register/memory state implements this. */
export interface EmulatorDriver {
  launch(options: LaunchOptions): Promise<void>;
  loadBinary(binaryPath: string): Promise<void>;
  setBreakpoint(address: number): Promise<void>;
  resume(): Promise<BreakReason>;
  readRegisters(): Promise<Registers>;
  readMemory(start: number, length: number): Promise<Uint8Array>;
  writeMemory(address: number, data: Uint8Array): Promise<void>;
  captureScreenshot(): Promise<Buffer>;
  shutdown(): Promise<void>;
}

export interface LaunchOptions {
  executablePath: string;
  monitorPort?: number;   // default 6502 (AR-H8); bound to 127.0.0.1 only
  gui?: boolean;          // default false (headless) (R8)
  extraArgs?: string[];
}

export interface Registers {
  a: number; x: number; y: number; sp: number; pc: number;
  flags: {
    carry: boolean; zero: boolean; interrupt: boolean; decimal: boolean;
    break_: boolean; overflow: boolean; negative: boolean;   // break_ per RD §4.1 (AR-H16)
  };
}

export type BreakReason = "breakpoint" | "timeout" | "exit";
```

### VICE binary-monitor protocol (`protocol.ts` — pure codec)

Targets the VICE 3.7+ binary-monitor protocol; **exact body layouts validated live against
VICE 3.10 during execution** (RD Open Q #1). The frame headers are stable and pinned here.

**Command frame (client → VICE):**

| Offset | Field           | Notes                                   |
| ------ | --------------- | --------------------------------------- |
| 0      | STX `0x02`      | start of frame                          |
| 1      | API version `0x02` |                                      |
| 2–5    | body length     | `uint32` little-endian                  |
| 6–9    | request id      | `uint32` LE (monotonic per driver)      |
| 10     | command type    | `uint8` (see table)                     |
| 11+    | command body    | per-command                             |

**Response frame (VICE → client):**

| Offset | Field           | Notes                                            |
| ------ | --------------- | ------------------------------------------------ |
| 0      | STX `0x02`      |                                                  |
| 1      | API version `0x02` |                                               |
| 2–5    | body length     | `uint32` LE                                      |
| 6      | response type   | `uint8`                                          |
| 7      | error code      | `uint8` (0 = OK)                                 |
| 8–11   | request id      | `uint32` LE (`0xffffffff` for unsolicited events)|
| 12+    | response body   | per-response                                     |

**Command types used** (RD §4.5): `MEMORY_GET 0x01`, `MEMORY_SET 0x02`,
`CHECKPOINT_SET 0x12`, `CHECKPOINT_DELETE 0x13`, `REGISTERS_GET 0x31`, `REGISTERS_SET 0x32`,
`ADVANCE_INSTRUCTIONS 0x71`, `EXECUTE_UNTIL_RETURN 0x73`, `REGISTERS_AVAILABLE 0x83`,
`DISPLAY_GET 0x84`, `PALETTE_GET 0x91`, `EXIT 0xaa` (resume), `QUIT 0xbb`, `RESET 0xcc`.
**Events (unsolicited):** `CHECKPOINT_INFO 0x11`, `STOPPED 0x62`, `RESUMED 0x63`,
`JAM 0x61`.

**Codec API (pure, no I/O):**

```typescript
export const CMD = { MEMORY_GET: 0x01, MEMORY_SET: 0x02, CHECKPOINT_SET: 0x12,
  CHECKPOINT_DELETE: 0x13, REGISTERS_GET: 0x31, REGISTERS_SET: 0x32,
  ADVANCE_INSTRUCTIONS: 0x71, EXECUTE_UNTIL_RETURN: 0x73, REGISTERS_AVAILABLE: 0x83,
  DISPLAY_GET: 0x84, PALETTE_GET: 0x91, EXIT: 0xaa, QUIT: 0xbb, RESET: 0xcc } as const;

/** Encode one command frame. `requestId` is supplied by the caller (monotonic). */
export function encodeCommand(type: number, requestId: number, body: Uint8Array): Uint8Array;

/** A decoded response frame. */
export interface ResponseFrame {
  type: number; errorCode: number; requestId: number; body: Uint8Array;
}
/** Decode zero or more complete response frames from a socket buffer, returning the
 *  frames and the number of bytes consumed (partial trailing frame left for next read). */
export function decodeResponses(buffer: Uint8Array): { frames: ResponseFrame[]; consumed: number };

/** Body builders (little-endian; validated live). */
export function memoryGetBody(start: number, end: number): Uint8Array;      // sideEffects=0, memspace=0
export function memorySetBody(start: number, data: Uint8Array): Uint8Array;
export function checkpointSetBody(address: number): Uint8Array;             // exec, stop-on-hit, enabled
export function registersGetBody(): Uint8Array;
export function registersSetBody(items: Array<{ id: number; value: number }>): Uint8Array;
export function executeUntilReturnBody(): Uint8Array;                       // empty
export function displayGetBody(): Uint8Array;

/** Body parsers. */
export function parseMemoryGet(body: Uint8Array): Uint8Array;               // strips the 2-byte length
export function parseRegistersGet(body: Uint8Array): Map<number, number>;   // id → value
export function parseRegistersAvailable(body: Uint8Array): Map<string, number>; // NAME → id (AR-H15)
export function parseCheckpointInfo(body: Uint8Array): { number: number; hit: boolean };
export function parseDisplayGet(body: Uint8Array): { width: number; height: number; bpp: number; data: Uint8Array };
```

### `ViceDriver` (`vice-driver.ts`)

```typescript
export class ViceDriver implements EmulatorDriver {
  // launch(): spawn x64sc with the monitor flags, connect a net.Socket to 127.0.0.1:port
  //   with bounded connect-retry, then issue REGISTERS_AVAILABLE to build the name→id map.
  // loadBinary(): the fixture relaunches per binary via -autostart (AR-H6), so loadBinary
  //   is satisfied at launch; a monitor RESET+AUTOSTART path is available but unused for MVP.
  // setBreakpoint(): CHECKPOINT_SET (exec, stop-on-hit) at the address.
  // resume(): send EXIT (0xaa) to leave the monitor/continue; await a STOPPED/CHECKPOINT_INFO
  //   event or the timeout guard → BreakReason.
  // readRegisters()/readMemory()/writeMemory(): REGISTERS_GET / MEMORY_GET / MEMORY_SET.
  // captureScreenshot(): DISPLAY_GET + PALETTE_GET → png.ts → Buffer.
  // shutdown(): QUIT (0xbb), close the socket, await child exit.
}
```

**Launch command (RD §4.5, headless):**
`x64sc -binarymonitor -binarymonitoraddress 127.0.0.1:<port> +sound -warp -autostartprgmode 1 <binary>`
(the `+sound`/`-warp` speed the headless run; GUI mode drops `-warp` and shows the window).
Spawned via `child_process.spawn(exe, argvArray)` — **argv array, never a shell string**
(injection-safe; see Security in `01-requirements.md`).

**Request/response correlation:** each command carries a monotonic `requestId`; the driver
keeps a pending-promise map keyed by id and a socket-read accumulator that feeds
`decodeResponses`. Unsolicited events (`STOPPED`/`RESUMED`/`CHECKPOINT_INFO`, id
`0xffffffff`) route to the `resume()` waiter, not the request map.

### Screenshot encoder (`png.ts`, AR-H4)

`DISPLAY_GET` returns an indexed frame buffer (width/height/bpp + pixel bytes);
`PALETTE_GET` returns the active palette (RGB triples). The encoder maps indexed pixels →
RGB, then emits a minimal **truecolor PNG**: signature, `IHDR`, one `IDAT` of
`zlib.deflateSync(scanlines)` (each scanline prefixed with filter byte 0), and `IEND`, each
chunk with its CRC-32. No external dependency (Node `zlib` + a small CRC table).

## Code Examples

### Example: read A after a breakpoint

```typescript
await driver.setBreakpoint(symbols.get("_main")!);   // $0819
const reason = await driver.resume();                // "breakpoint"
const regs = await driver.readRegisters();
// regs.a, regs.x, … mapped from REGISTERS_GET via the REGISTERS_AVAILABLE name→id map
```

## Error Handling

| Error Case                                              | Handling Strategy                                                                              | AR Ref |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| VICE not on PATH / spawn fails                          | `launch()` rejects; the fixture translates to `describe.skipIf` at suite level (AC-13)         | AR-H3  |
| Socket connect refused (VICE not ready)                 | Bounded connect-retry within the launch timeout; then reject                                   | R23    |
| Response `errorCode !== 0`                              | Reject the pending request with the VICE error code + command name                             | R6     |
| Partial frame across socket reads                       | `decodeResponses` returns `consumed`; the accumulator retains the tail until the next read     | AR-H14 |
| Unknown/unsupported opcode in a body layout             | Codec throws a descriptive error (caught by tests; validated live) — never a silent mis-decode | AR-H14 |
| Register name absent from `REGISTERS_AVAILABLE`         | Fail fast at connect with the available names listed (guards VICE-version drift)               | AR-H15 |
| `resume()` never breaks                                 | The mandatory timeout guard (strategy layer, R23) fires → `BreakReason "timeout"`              | AR-H3  |

> **Traceability:** the interface is RD §4.1 verbatim; the protocol commands are RD §4.5;
> the codec split is AR-H14; PNG is AR-H4; register-id resolution is AR-H15; loopback bind +
> argv-array spawn are the `01-requirements.md` Security items.

## Testing Requirements

- **Protocol codec spec tests (CI, no VICE):** byte-exact `encodeCommand` frames;
  `decodeResponses` round-trips including split/partial buffers and multiple frames per read;
  body builders/parsers against fixed byte fixtures. Source: ST-03..ST-08.
- **`ViceDriver` integration tests (local, skipIf-VICE):** launch → connect → read/write
  memory round-trip → set breakpoint → resume → read registers → shutdown; screenshot
  produces a PNG whose IHDR decodes. Source: ST-09..ST-13.
- **PNG impl test:** encode a tiny synthetic indexed frame; assert the signature/IHDR/IEND
  and that the CRCs verify.
