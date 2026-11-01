# Platform libraries

Blend65 includes narrow, target-specific platform support. Import it like any other module.
It does not provide a game loop, input manager or gameplay framework.

## C64 input

The four cooperative C64 profiles currently supported by this library are
`c64-pal-prg-kernal-6581`, `c64-pal-prg-kernal-8580`, `c64-ntsc-prg-kernal-6581` and
`c64-ntsc-prg-kernal-8580`. Other target identities are not implied.

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
- `UNAVAILABLE`: CIA1 timer output or port configuration prevented sampling; raw bytes are zero placeholders.

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

A clear masked joystick bit means pressed. The upper three sampled bits are not
joystick controls; the read does not discard them.

`readInputSnapshot` writes idle columns, captures coherent port directions,
installs its temporary callback-only NMI route, samples the matrix and both
connectors, removes its route and restores the saved directions and caller
status. Timer-driven port output returns `UNAVAILABLE` without a write. The scan
does not write the row latch, timer controls, interrupt-source registers or CIA2,
and it does not retry or keep an undocumented last-good value. Key repeat,
debounce, retry policy, gameplay decisions and restored-device policy remain
application-owned.

The combined API is ordinary Blend65 source in the shipped
[c64/input.blend](../packages/compiler/stdlib/c64/input.blend). It is included in
installed compiler packages; you do not copy the library into your project.
`none` is the correctness baseline. `size` remains experimental and its complete
output budget is owned by the separate RD-08 optimizer track.

## Qualification

Current evidence is **VICE-verified / hardware-unverified** on the four profiles
above. The [keyboard closeout](../codeops/features/blend65-v4/plans/rd-05-keyboard-input/09-closeout.md)
records the 76 behavior cases, four-profile native matrix/purity, acquisition
paths and NMI-link results. Physical hardware, Windows/macOS user-release
qualification and the deferred 963/725 size targets remain later work.
