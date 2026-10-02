# Platform libraries

Blend65 includes narrow, target-specific platform support. Import it like any other module.
It does not provide a game loop, input manager or gameplay framework.

## C64 input

The four cooperative C64 profiles currently supported by this library are
`c64-pal-prg-kernal-6581`, `c64-pal-prg-kernal-8580`, `c64-ntsc-prg-kernal-6581` and
`c64-ntsc-prg-kernal-8580`. Other target identities are not implied.

```blend65
module Game;
import { readJoystick1, readJoystick2, joystickFire, joystickUp } from c64.input;

let firstFire: boolean = false;
let secondUp: boolean = false;

function main(): void {
    let first: byte = readJoystick1();
    let second: byte = readJoystick2();
    firstFire = joystickFire(first);
    secondUp = joystickUp(second);
}
```

Each read captures one full eight-bit port byte. Each predicate tests the byte you supply;
it does not read the joystick again. Save a sample once when several tests must use the same
observation. Two port reads are separate observations, not an atomic pair.

| Name | Result |
| --- | --- |
| `readJoystick1()` / `readJoystick2()` | Full sampled `byte`, without changing device configuration |
| `joystickUp(sample)` / `joystickDown(sample)` | `boolean` for the selected direction |
| `joystickLeft(sample)` / `joystickRight(sample)` | `boolean` for the selected direction |
| `joystickFire(sample)` | `boolean` for fire |

A clear switch bit means pressed. For custom bit tests, the same module exports ordinary
Blend65 constants:

| Constant | Byte value |
| --- | --- |
| `joystickUpMask` | 1 |
| `joystickDownMask` | 2 |
| `joystickLeftMask` | 4 |
| `joystickRightMask` | 8 |
| `joystickFireMask` | 16 |
| `joystickControlsMask` | 31 |

For example, `(sample & joystickFireMask) == 0` tests fire after importing that mask.
The upper three sampled bits are not joystick controls; the read does not discard them.

## Keyboard sharing

C64 joysticks and the keyboard share electrical lines. A keyboard key or a driven output pin
can therefore affect a returned bit even when the joystick switch is released. These operations
return the actual pin observation; they do not isolate the joystick or scan the keyboard.
They preserve CIA1 port directions and output latches, do not touch CIA2, and do not hide interrupt
masking. A combined keyboard/joystick scanning API is not delivered yet. Key repeat, debounce
and game input policy belong in application code.

## What is implemented as Blend65 source?

The six masks are real exported constants in the shipped
[c64/input.blend](../packages/compiler/stdlib/c64/input.blend). They use ordinary module and
constant semantics, are included in installed compiler packages, and need no runtime initializer
or helper when used as immediate constants. You do not copy the library into your project.

The two reads and five predicates are currently typed compiler platform operations, not ordinary
Blend65 function bodies. Reads lower to one volatile hardware load. Predicates test the saved byte
directly without a helper call. Callable helpers will move to shipped Blend65 source only after
general function expansion is proved to preserve behavior and complete output cost. Rewriting
them as ordinary calls today would add calling overhead.

Named operations add no dispatch or hidden extra hardware access. The current unoptimized
compiler can still retain unnecessary local save/reload and branch traffic around these operations;
that broader optimization work is not claimed complete.

## Qualification

Current evidence is **VICE-verified / hardware-unverified** on the four profiles above.
The [pilot closeout](../codeops/features/blend65-v4/plans/rd-05-joystick-library/08-closeout.md)
records installed-package proof, runtime boundaries, independent review and measured optimization
targets. Physical hardware and Windows/macOS user-release qualification remain later work.
