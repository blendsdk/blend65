# Blend64 — Showcase (v0.1)

This document is a **showcase** of what Blend64 *looks like* and the kind of workflows it enables for **Commodore 64 game development**.

Blend64 is **assembler-plus**:
- ahead-of-time compiled to a C64 **PRG**
- **no implicit runtime**
- **reachability-based dead-code elimination**
- **static memory only** (no heap, no dynamic containers)
- designed for **maximum FPS** (cycle-efficient 6502/6510 output)

> Notes:
> - Code shown is **representative** of the spec and rules in this repo.
> - Library modules like `c64:*` are **conventional** (toolchain-provided or developer-provided), and all imported code is tree-shaken.

---

## 1) “Hello, HUD” — Fixed-capacity strings and screen output

Blend64 strings are fixed-capacity buffers: `string(N)`.
Template strings exist, but are **restricted** and lower to static copies + formatting helpers **only if used**.

```Pascal
module Game.Hud

import poke, memcpy from c64:mem
import Screen_PrintString from c64:screen

// 40 columns on the C64
ram  var hudLine: string(40)
zp   var score: word
zp   var lives: byte

export function Hud_Draw(): void
    // Restricted template string → copies + helpers (hex/pad) if used
    hudLine = `S:${hex(score)}  L:${lives}`

    // Example helper: prints PETSCII to screen at row/col
    Screen_PrintString(0, 0, hudLine)
end function
```

What this demonstrates:
- `string(N)` is static storage, not heap-backed.
- Formatting helpers (like `hex`) are emitted only if reachable.
- The compiler can place hot HUD state in `zp` for speed.

---

## 2) Memory-mapped I/O in a readable way

You can name hardware registers explicitly using `io` plus pinned placement.

```blend
module C64.Vic

io var VIC_BORDER: byte @ $D020
io var VIC_BG0:    byte @ $D021

export function SetColors(border: byte, bg: byte): void
    VIC_BORDER = border
    VIC_BG0    = bg
end function
```

What this demonstrates:
- Explicit I/O mapping.
- No “host objects” or runtime interop.
- Writes compile to direct `STA $D020` etc.

---

## 3) Sprites — a typical game-facing API

Toolchain or developer modules can wrap VIC-II sprite setup. The important part: **imports are explicit** and
**unused code is not emitted**.

```blend
module Game.Player

import Sprites_Enable, Sprites_SetPos, Sprites_SetPtr from c64:sprites
import VIC_SPR_PTR_BASE from c64:vic

// Hot state: positions frequently updated in the main loop
zp  var playerX: word
zp  var playerY: byte
zp  var playerSpriteId: byte

// Sprite data pointer (example: points to sprite #128 in a bank)
const var PLAYER_SPR_PTR: byte = 128

export function Player_Init(): void
    playerSpriteId = 0
    playerX = 160
    playerY = 100

    Sprites_SetPtr(playerSpriteId, PLAYER_SPR_PTR)
    Sprites_Enable(playerSpriteId, true)
end function

export function Player_Draw(): void
    Sprites_SetPos(playerSpriteId, playerX, playerY)
end function
```

What this demonstrates:
- “Assembler-plus” ergonomics without hiding costs.
- ZP placement aligns with the **maximum FPS** rules.

---

## 4) The canonical game loop — `hotloop`

For performance builds, Blend64 favors a canonical hot path where the compiler can apply aggressive heuristics.

```blend
module Game.Main

import Hud_Draw from game:hud
import Player_Init, Player_Draw from game:player
import Input_Tick from c64:input
import Game_Tick from game:logic
import Render_Tick from game:render

export function main(): void
    Player_Init()

    hotloop {
        Input_Tick()
        Game_Tick()
        Render_Tick()
        Player_Draw()
        Hud_Draw()
    }
end function
```

What this demonstrates:
- `hotloop` is a clear marker for “this is the frame kernel”.
- Everything called from `hotloop` is treated as **hot** by default.
- In fast builds, the compiler biases:
  - ZP promotion
  - inlining
  - branch lowering that reduces cycles

---

## 5) `match` for state machines — predictable lowering

State machines are common on C64. `match` lowers to either compare chains or jump tables depending on density.

```blend
module Game.State

zp var state: byte

export function State_Tick(): void
    match state
        case 0:
            // boot
            state = 1
        case 1:
            // playing
            // ...
        case 2:
            // paused
            // ...
        case _:
            state = 0
    end match
end function
```

What this demonstrates:
- Developer-friendly control flow.
- Predictable lowering choices (jump table when dense; compare chain when sparse).
- Source order matters (developer can order likely cases first).

---

## 6) Fixed-size arrays for fast tables (no heap)

Tables are foundational in 6502 code: sine tables, sprite X positions, tile maps, etc.

```blend
module Game.Tables

// 256-byte sine table
const var sin256: byte[256] = [
    128, 131, 134, /* ... */ 125
]

// Runtime-updated sprite X positions
ram var spriteX: byte[8]

export function MoveSprites(): void
    // For loop uses a static loop index (no locals)
    for i = 0 to 7
        spriteX[i] += 1
    next
end function
```

What this demonstrates:
- Arrays are fixed-size and statically allocated.
- No `.push`, `.pop`, or resizing.
- Bounds checks are a **debug-only** option; performance builds forbid them.

---

## 7) Records (structs) with deterministic layout

Records are flattened and laid out deterministically.

```blend
module Game.Types

type Player
    x: word
    y: byte
    vx: byte
    flags: byte
end type

ram var p1: Player

export function Player_Reset(): void
    p1.x = 160
    p1.y = 100
    p1.vx = 2
    p1.flags = 0
end function
```

What this demonstrates:
- No classes, no methods, no dynamic dispatch.
- Predictable memory layout that maps to contiguous bytes/words.

---

## 8) IRQ-safe code paths (static temps partitioning)

Blend64 has no locals; temps are static. For safety and speed, the compiler must prevent IRQ/mainline temp aliasing.

```blend
module Game.Irq

import Irq_InstallRaster, Irq_Enable from c64:irq
import Vic_SetBorder from c64:vic

@irq export function RasterIrq(): void
    // IRQ-only path: must not touch mainline temps.
    Vic_SetBorder(6)
end function

export function InitIrq(): void
    Irq_InstallRaster(RasterIrq, 50)
    Irq_Enable(true)
end function
```

What this demonstrates:
- `@irq` marks the function as IRQ context.
- Compiler enforces temp partition rules at compile time.
- Calling convention and register preservation can be optimized per IRQ model.

---

## 9) Determinism & auditability — what the toolchain emits

A conforming Blend64 toolchain emits artifacts that make performance and memory auditable:

- `game.prg` — the binary
- `game.map` — symbols, segments, ZP usage, addresses
- `game.lst` — annotated listing (assembly + source mapping)
- `game.perf.txt` — cycle estimates per hot path (fast profile)
- `game.il.txt` — optional IL dump for inspection

This is central to Blend64’s philosophy:

> If you can’t inspect it, you can’t trust it.

---

## 10) What “reachable-only” looks like in practice

If you import a module but never call a function, it does not make it into the PRG.

```blend
module Game.Main

import Debug_Print from c64:debug  // imported but never called

export function main(): void
    hotloop {
        // ...
    }
end function
```

In a conforming compiler:
- `Debug_Print` (and any helpers it needs) is **not emitted**
- no runtime or stdlib baggage is linked “just in case”

---

## 11) A tiny “engine style” layout

Blend64 encourages explicit module structure:

```
game/
  main.blend
  player.blend
  hud.blend
  render.blend
  logic.blend

c64/
  mem.blend
  vic.blend
  sprites.blend
  irq.blend
  input.blend
```

All `c64:*` modules are optional:
- you can ship them with the toolchain
- or implement your own
- and only what is imported and reachable gets emitted

---

## Closing Notes

Blend64 is designed so that:

- you write clear, data-oriented game logic
- the compiler lowers it into a **single, explicit IL**
- optimization decisions are made on that IL (not the AST)
- codegen produces cycle-efficient 6502/6510 code
- emitted reports make performance and memory visible

If a feature cannot be explained in terms of:
- static memory
- addressing modes
- control flow
- cycle cost

…then it does not belong in Blend64 v0.1.
