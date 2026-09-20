# M1 qualification inputs

This directory freezes the independent inputs used to check the first playable Blend65 program.
The behavior oracle is a pure model of the language requirements. It does not import compiler or
emulator code. `win-trace.json` stores the fixed active-low joystick sequence as value/count runs.

## Sprite fixture

`sprite-recipe.ts` generates original artwork created for this repository. The project intends to
retain both the readable recipe and its exact 512-byte output so later qualification can reproduce
and inspect the input without relying on an external asset tool.

The eight 64-byte native records are stored in this exact order:

1. `player`
2. `invader-a-frame-1`
3. `invader-a-frame-2`
4. `invader-b-frame-1`
5. `invader-b-frame-2`
6. `projectile`
7. `explosion-frame-1`
8. `explosion-frame-2`

SHA-256: `c590c49d0e0aae8a20b39e2f6246c530bb7f52fe8b4c21131ec09a442509f68a`

The fixture is raw sprite data only. It does not define a private format or claim qualification for
SpritePad or another native asset producer.

## Frozen behavior inputs

- Oracle SHA-256: `7ea949a34ecde626f80ddb373858f09b8be8ebedd9cd544936eacf431789a5e3`
- Win-trace SHA-256: `01dba080800f2984d7a424748ecfcb02bf03da9ccce2b515c88d72cb6a02792b`
