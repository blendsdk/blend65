# Platform libraries

Blend65 includes narrow, target-specific platform support. Import it like any other module.
It does not provide a game loop, input manager or gameplay framework.

## C64 input

The `c64.input` library is qualified on the four cooperative C64 profiles:
`c64-pal-prg-kernal-6581`, `c64-pal-prg-kernal-8580`, `c64-ntsc-prg-kernal-6581` and
`c64-ntsc-prg-kernal-8580`. The four takeover profiles are executable for raw startup,
banking and raw IRQ, but this NMI-based input library is not claimed there while source
raw NMI remains deferred under `V4-TAKEOVER-F2`. Other target identities are not implied.

The ordinary input API is a saved observation plus pure queries:

```blend65
module Game;
import {
  InputState, InputSnapshot, Key, JoystickPort, JoystickControl,
  readInputSnapshot, keyState, joystickState
} from c64.input;

function main(): void {
  let saved: InputSnapshot = readInputSnapshot();
  let space: InputState = keyState(saved, Key.SPACE);
  let fire: InputState = joystickState(saved, JoystickPort.PORT_2, JoystickControl.FIRE);
  if (space == InputState.OBSERVED_DOWN && fire == InputState.OBSERVED_DOWN) {
    poke($C100, 1);
  }
}
```

`readInputSnapshot()` performs one scoped CIA1 acquisition and returns an
11-byte `InputSnapshot`. Retain the returned object and query it as often as
needed. `keyState` and `joystickState` read those saved bytes; they do not
resample the device and do not perform fresh CIA or VIC I/O.

| Name | Result |
| --- | --- |
| `readInputSnapshot()` | One packed saved observation with raw rows, both joystick bytes and quality |
| `keyState(snapshot, key)` | `OBSERVED_DOWN`, `OBSERVED_UP` or `UNCERTAIN` for one of the 64 matrix keys |
| `joystickState(snapshot, port, control)` | `OBSERVED_DOWN`, `OBSERVED_UP` or `UNCERTAIN` for one joystick switch |

`InputState` describes the saved bytes, not the current live device state:

- `OBSERVED_DOWN`: every compatible explanation has the switch closed.
- `OBSERVED_UP`: the saved observation establishes that the switch is open.
- `UNCERTAIN`: invalid, interrupted or ambiguous data cannot establish the state.

`SnapshotQuality` describes the acquisition:

- `COMPLETE`: all planned samples were taken. This is not an atomic snapshot.
- `INTERRUPTED`: a returning NMI reached the scoped scan. Raw bytes remain available.
- `UNAVAILABLE`: CIA1 timer output (PBON on CRA/CRB) prevented sampling; raw bytes are zero placeholders.

Keyboards and joysticks share electrical lines. A key or a driven output pin can
therefore make a saved joystick bit low even when the switch is open. The query
returns `UNCERTAIN` when the saved bytes cannot distinguish the cases. It does
not invent certainty from a single low bit.

The module also exports ordinary bit masks for custom tests:

| Constant | Byte value |
| --- | --- |
| `joystickUpMask` | 1 |
| `joystickDownMask` | 2 |
| `joystickLeftMask` | 4 |
| `joystickRightMask` | 8 |
| `joystickFireMask` | 16 |
| `joystickControlsMask` | 31 |

A clear masked joystick bit is a low line, not by itself a switch certificate;
use `joystickState` when the answer must distinguish a pressed switch from
shared-line ambiguity. The upper three sampled bits are not joystick controls;
the read does not discard them.

`readInputSnapshot` writes idle columns, captures coherent port directions,
installs its temporary callback-only NMI route, samples the matrix and both
connectors, removes its route and restores the saved directions and caller
status. It leaves the CIA1 PA latch at `$7F`; it does not promise to restore a
previous PA latch. The scan requires a compatible prior port/NMI owner and no
competing port writer. It is not reentrant from an active NMI handler. Timer-driven port output returns `UNAVAILABLE` without a write. The scan
does not write the row latch, timer controls, interrupt-source registers or CIA2,
and it does not retry or keep an undocumented last-good value. Key repeat,
debounce, retry policy, gameplay decisions and restored-device policy remain
application-owned. The generated callback route bounds its own saved frame and
link; unrestricted external NMI stack, retained-firmware completion and a finite
external deadline remain **Unknown**, not whole-program guarantees.

The combined API is ordinary Blend65 source in the shipped
[c64/input.blend](../packages/compiler/stdlib/c64/input.blend). It is included in
installed compiler packages; you do not copy the library into your project.
`none` is the correctness baseline. `balanced`, `speed`, and `size` are wired; the RD-08
saved/acquisition gates pass, with the remaining 66-byte size acquisition gap tracked in
[issue #145](https://github.com/blendsdk/blend65/issues/145).

## C64 interrupt ownership

Cooperative profiles expose the KERNAL CINV/NMINV installers and restores. Takeover
profiles replace that map with the raw IRQ sink:

```blend65
module Game;
import { setRawIRQ, restoreRawIRQ } from c64.system;

interrupt function onIRQ(): void {
  // Every path must consume or fully disable the enabled CIA1 source.
  let pending: byte = c64.cia1.readAndClearPendingSources();
}

function main(): void {
  setRawIRQ(&onIRQ);
  // ... application work ...
  restoreRawIRQ();
}
```

The compiler owns both hardware vectors from startup. A source raw IRQ handler is
installed inside an IRQ-masked transaction and must acknowledge every enabled CIA1
source; a conditional or early-return path that can skip the acknowledgement fails with
`E10278`. A full `disableInterruptSources($1F)` is accepted only on a nonreturning path,
because takeover has no cooperative stock-CIA1 handback. Direct writes to the
compiler-owned processor port, VIC-bank or hardware-vector bytes are rejected. The
startup default NMI entry is compiler-owned; source `setRawNMI` remains deferred under
`V4-TAKEOVER-F2`.

### NMI consuming reads

A cooperative NMI handler must stay free of private storage, so the compiler keeps a
single-use consuming read in the accumulator. These forms compile on every cooperative
profile:

```blend65
let pendingSources: byte = 0;
let timerFinished: boolean = false;
let maskValue: byte = 1;

// Assign the consuming read.
interrupt function onTimer(): void {
  pendingSources = c64.cia2.readAndClearPendingSources();
}

// Branch directly on a zero or nonzero read.
interrupt function onAny(): void {
  if (c64.cia2.readAndClearPendingSources() != 0) { timerFinished = true; }
}

// Branch on one masked bit with a constant or directly addressable mask.
interrupt function onBit(): void {
  if ((c64.cia2.readAndClearPendingSources() & sourceTimerA) != 0) {
    timerFinished = true;
  }
  if ((c64.cia2.readAndClearPendingSources() & maskValue) != 0) {
    timerFinished = true;
  }
}

// A bit test materializes a Boolean with no private home. Mask one is the
// identity; masks two and four are shift-normalized; any other nonzero mask
// uses the expert branch; the zero mask folds to a constant.
interrupt function onBoolean(): void {
  timerFinished = (c64.cia2.readAndClearPendingSources() & 1) != 0;
  timerFinished = (c64.cia2.readAndClearPendingSources() & 1) == 0;
  timerFinished = (c64.cia2.readAndClearPendingSources() & 2) != 0;
  timerFinished = (c64.cia2.readAndClearPendingSources() & 2) == 0;
  timerFinished = (c64.cia2.readAndClearPendingSources() & 4) != 0;
  timerFinished = (c64.cia2.readAndClearPendingSources() & 4) == 0;
  timerFinished = (c64.cia2.readAndClearPendingSources() & 8) != 0;
  timerFinished = (c64.cia2.readAndClearPendingSources() & 3) == 0;
  timerFinished = (c64.cia2.readAndClearPendingSources() & 0) != 0;
  timerFinished = (c64.cia2.readAndClearPendingSources() & 255) != 0;
}

// A byte-masked word keeps only its low byte: mask one is the identity, mask
// two is one shift, and other byte masks use the branch.
place(at: $C100) let pendingWord: word = 0;
interrupt function onWord(): void {
  timerFinished = (pendingWord & 1) != 0;
  timerFinished = (pendingWord & 2) != 0;
  timerFinished = (pendingWord & 8) != 0;
}

// A single-use local with an adjacent consumer stays in the accumulator.
interrupt function onLocal(): void {
  let sample: byte = c64.cia2.readAndClearPendingSources();
  pendingSources = sample;
}
```

The read is still exactly one volatile access. A handler that needs a real private home
still fails `E10245`. That includes several simultaneously retained samples, a masked
value shared by several consumers, a 16-bit word mask whose high byte can be nonzero, a
runtime word local that stages its zero-extension, a computed (non-addressable) mask, and
a masked value compared to a nonzero constant. The delivered forms use an inline branch, a
shift chain, the identity, or a constant fold and meet or beat the expert sequence. The
remaining forms need bounded retention or a wider join and are tracked by
[#150](https://github.com/blendsdk/blend65/issues/150), not language restrictions or
recommended source workarounds.

## Qualification

Current evidence is **VICE-verified / hardware-unverified** on the four profiles
above. The [keyboard closeout](../codeops/features/blend65-v4/plans/rd-05-keyboard-input/09-closeout.md)
records the 76 behavior cases, four-profile saved matrix/purity, acquisition
paths and NMI-link results. The live returning-NMI quality path, genuine
STOP/RESTORE and pressed-contact acquisition remain partial/Unknown; see the
closeout. Physical hardware remains `Unknown` under `V4-HW-1`, Windows/macOS
native user-release qualification is not claimed, and the RD-08 saved/acquisition
gates now pass at 709/725 and 943/963. The four takeover profiles execute raw
startup, banking and the raw IRQ sink; this NMI-based input library is not claimed
there while source-installed raw NMI remains deferred under `V4-TAKEOVER-F2`.
