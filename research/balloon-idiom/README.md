# Balloon — idiom spikes

Two rewrites of the hot-air balloon program from `examples/balloon/`, written the way a 6502 game
developer would actually write it rather than the way the language currently forces.

**Neither of these compiles today.** They are target-state illustrations, kept as the concrete
argument for what the generated code should look like once the language closes the gaps below.

| File | What it demonstrates |
|---|---|
| `balloon2.blend` | The 63-byte sprite copy as a single `copy()` call instead of 63 unrolled `poke`s, and every hardware access written as a named VIC-II register instead of a bare `$Dxxx` literal. |
| `balloon3.blend` | The per-frame update driven by a raster interrupt rather than a busy-wait on the raster line, freeing the main path for game logic. |

## Why they don't build

`copy()` and the named hardware-register bindings are not part of the frozen v3 language, so
`balloon2.blend` fails to compile and `balloon3.blend` builds on it. They are also both
`module Main` with their own `main()`, which is why they cannot sit beside `examples/balloon/main.blend` —
the twin-corpus builder compiles every `.blend` in an example directory as one program.

## Why they are worth keeping

The unrolled-poke sequence in the shipping example is the largest single divergence between the
compiler's output and the hand-written `balloon.asm` twin. A restriction that forces a developer to
write 63 pokes where the hardware wants an indexed copy loop is not a missing convenience — it is a
defect in the language's expressiveness, and these files are what the fix should be measured against.
