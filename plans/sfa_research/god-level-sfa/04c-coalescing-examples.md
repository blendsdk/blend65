# God-Level SFA: Frame Coalescing Examples

> **Document**: god-level-sfa/04c-coalescing-examples.md
> **Purpose**: Worked examples and visualizations of frame coalescing
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

This document provides **worked examples** showing frame coalescing in action, from simple cases to complex real-world scenarios.

---

## 1. Simple Example: Sibling Functions

### 1.1 Source Code

```
fn main() {
    let game_running: bool = true;    // 1 byte
    
    init_game();
    
    while game_running {
        handle_input();
        update_game();
        render_frame();
    }
}

fn init_game() {
    let init_counter: byte = 0;       // 1 byte
    let init_flags: byte = 0;         // 1 byte
    // Setup code...
}

fn handle_input() {
    let key_pressed: byte = 0;        // 1 byte
    // Input handling...
}

fn update_game() {
    let delta_time: byte = 1;         // 1 byte
    let collision: bool = false;      // 1 byte
    // Game logic...
}

fn render_frame() {
    let sprite_count: byte = 0;       // 1 byte
    let bg_scroll: word = 0;          // 2 bytes
    // Rendering...
}
```

### 1.2 Call Graph

```
main() ─┬─ init_game()
        ├─ handle_input()
        ├─ update_game()
        └─ render_frame()
```

### 1.3 Frame Sizes

| Function | Locals | Size |
|----------|--------|------|
| main | game_running | 1 byte |
| init_game | init_counter, init_flags | 2 bytes |
| handle_input | key_pressed | 1 byte |
| update_game | delta_time, collision | 2 bytes |
| render_frame | sprite_count, bg_scroll | 3 bytes |

**Total raw:** 1 + 2 + 1 + 2 + 3 = **9 bytes**

### 1.4 Coalescing Analysis

**Recursive callers:**
- main: {}
- init_game: {main}
- handle_input: {main}
- update_game: {main}
- render_frame: {main}

**Can coalesce?**

| A | B | Overlap? | Can Coalesce? |
|---|---|----------|---------------|
| init_game | handle_input | No | ✅ Yes |
| init_game | update_game | No | ✅ Yes |
| init_game | render_frame | No | ✅ Yes |
| handle_input | update_game | No | ✅ Yes |
| handle_input | render_frame | No | ✅ Yes |
| update_game | render_frame | No | ✅ Yes |

All sibling functions can coalesce!

### 1.5 Coalesce Groups

```
Group 0: main (1 byte) - entry point, can't coalesce
Group 1: init_game, handle_input, update_game, render_frame
         Max size: max(2, 1, 2, 3) = 3 bytes
```

### 1.6 Final Memory Layout

```
Frame Region: $0200-$03FF

Without Coalescing:
$0200: main.game_running      (1 byte)
$0201: init_game.init_counter (1 byte)
$0202: init_game.init_flags   (1 byte)
$0203: handle_input.key_pressed (1 byte)
$0204: update_game.delta_time (1 byte)
$0205: update_game.collision  (1 byte)
$0206: render_frame.sprite_count (1 byte)
$0207: render_frame.bg_scroll (2 bytes)
────────────────────────────────────
Total: 9 bytes

With Coalescing:
$0200: main.game_running      (1 byte)
$0201-$0203: [SHARED - Group 1]
  When init_game runs:    offset 0: init_counter, offset 1: init_flags
  When handle_input runs: offset 0: key_pressed
  When update_game runs:  offset 0: delta_time, offset 1: collision
  When render_frame runs: offset 0: sprite_count, offset 1-2: bg_scroll
────────────────────────────────────
Total: 4 bytes

SAVINGS: 5 bytes (55.6%)
```

---

## 2. Nested Call Example

### 2.1 Source Code

```
fn main() {
    let state: byte = 0;              // 1 byte
    process_data();
}

fn process_data() {
    let buffer: byte[4] = [0,0,0,0];  // 4 bytes
    transform(buffer);
    output(buffer);
}

fn transform(data: byte[4]) {
    let temp: word = 0;               // 2 bytes
    // Transform data...
}

fn output(data: byte[4]) {
    let channel: byte = 0;            // 1 byte
    // Output data...
}
```

### 2.2 Call Graph

```
main() ─── process_data() ─┬─ transform()
                           └─ output()
```

### 2.3 Frame Sizes

| Function | Size |
|----------|------|
| main | 1 byte |
| process_data | 4 bytes |
| transform | 2 bytes |
| output | 1 byte |

**Total raw:** 1 + 4 + 2 + 1 = **8 bytes**

### 2.4 Coalescing Analysis

**Recursive callers:**
- main: {}
- process_data: {main}
- transform: {main, process_data}
- output: {main, process_data}

**Can coalesce?**

| A | B | A's callers | B's callers | Overlap? |
|---|---|-------------|-------------|----------|
| main | process_data | {} | {main} | main in B's → ❌ |
| process_data | transform | {main} | {main, process_data} | process_data in B's → ❌ |
| process_data | output | {main} | {main, process_data} | process_data in B's → ❌ |
| transform | output | {main, process_data} | {main, process_data} | Neither in other's → ✅ |

Only `transform` and `output` can coalesce!

### 2.5 Coalesce Groups

```
Group 0: main (1 byte)
Group 1: process_data (4 bytes)
Group 2: transform, output
         Max size: max(2, 1) = 2 bytes
```

### 2.6 Final Memory Layout

```
Without Coalescing: 8 bytes
With Coalescing: 1 + 4 + 2 = 7 bytes

SAVINGS: 1 byte (12.5%)
```

Less savings because the call chain is linear with only siblings at leaf level.

---

## 3. ISR Example

### 3.1 Source Code

```
fn main() {
    let score: word = 0;              // 2 bytes
    game_loop();
}

fn game_loop() {
    let frame: byte = 0;              // 1 byte
    // Game loop...
}

interrupt fn irq_handler() {
    let timer_tick: byte = 0;         // 1 byte
    update_music();
}

fn update_music() {
    let channel: byte = 0;            // 1 byte
    let volume: byte = 255;           // 1 byte
    // Music update...
}
```

### 3.2 Call Graph

```
Main Thread:
  main() ─── game_loop()

ISR Thread:
  irq_handler() ─── update_music()
```

### 3.3 Thread Contexts

| Function | Reachable From Main? | Reachable From ISR? | Context |
|----------|---------------------|---------------------|---------|
| main | Yes | No | MainOnly |
| game_loop | Yes | No | MainOnly |
| irq_handler | No | Yes | IsrOnly |
| update_music | No | Yes | IsrOnly |

### 3.4 Coalescing Analysis

**Can coalesce?**

| A | B | Same Context? | Can Coalesce? |
|---|---|---------------|---------------|
| main | game_loop | Yes (Main) | ❌ (call overlap) |
| irq_handler | update_music | Yes (ISR) | ❌ (call overlap) |
| main | irq_handler | No | ❌ (different threads) |
| game_loop | update_music | No | ❌ (different threads) |

**No coalescing possible!** Each function needs its own frame.

### 3.5 Coalesce Groups

```
Group 0: main (2 bytes) - MainOnly
Group 1: game_loop (1 byte) - MainOnly
Group 2: irq_handler (1 byte) - IsrOnly
Group 3: update_music (2 bytes) - IsrOnly
```

### 3.6 Final Memory Layout

```
Without Coalescing: 2 + 1 + 1 + 2 = 6 bytes
With Coalescing: 2 + 1 + 1 + 2 = 6 bytes

SAVINGS: 0 bytes (0%)
```

ISR isolation prevents any coalescing.

---

## 4. Shared Helper Example

### 4.1 Source Code

```
fn main() {
    init();
    game_loop();
}

fn init() {
    let setup_flag: byte = 0;
    helper();  // Calls helper
}

fn game_loop() {
    let counter: byte = 0;
    helper();  // Also calls helper
}

fn helper() {
    let temp: byte = 0;
    // Shared utility code...
}
```

### 4.2 Call Graph

```
main() ─┬─ init() ───── helper()
        │                  ↑
        └─ game_loop() ────┘
```

### 4.3 Analysis

**Recursive callers:**
- main: {}
- init: {main}
- game_loop: {main}
- helper: {main, init, game_loop}

**Can coalesce?**

| A | B | Check |
|---|---|-------|
| init | game_loop | Neither in other's callers → ✅ |
| init | helper | init in helper's callers → ❌ |
| game_loop | helper | game_loop in helper's callers → ❌ |

### 4.4 Result

```
Group 0: main (0 bytes)
Group 1: init, game_loop (max of both)
Group 2: helper (1 byte) - can't join Group 1

Partial coalescing achieved.
```

---

## 5. Diamond Pattern

### 5.1 Source Code

```
fn main() {
    let state: byte = 0;
    A();
    B();
}

fn A() {
    let a_data: byte = 0;
    C();
}

fn B() {
    let b_data: word = 0;
    C();
}

fn C() {
    let c_data: byte = 0;
    // Shared code...
}
```

### 5.2 Call Graph

```
        ┌─ A() ─┐
main() ─┤       ├─ C()
        └─ B() ─┘
```

### 5.3 Analysis

| Function | Recursive Callers |
|----------|-------------------|
| main | {} |
| A | {main} |
| B | {main} |
| C | {main, A, B} |

**Coalesce possibilities:**
- A and B: ✅ (siblings, neither calls other)
- A and C: ❌ (A in C's callers)
- B and C: ❌ (B in C's callers)

### 5.4 Result

```
Group 0: main (1 byte)
Group 1: A, B - max(1, 2) = 2 bytes
Group 2: C (1 byte)

Total: 1 + 2 + 1 = 4 bytes
Raw: 1 + 1 + 2 + 1 = 5 bytes
Savings: 1 byte (20%)
```

---

## 6. Real Game Example

### 6.1 Source Code (Simplified)

```
fn main() {
    let game_state: byte = 0;           // 1 byte
    init_hardware();
    
    while true {
        read_input();
        update_physics();
        check_collisions();
        update_enemies();
        update_player();
        render_all();
        wait_vsync();
    }
}

fn init_hardware() {
    let vic_config: byte[8] = [...];    // 8 bytes
    // Setup VIC-II, SID, etc.
}

fn read_input() {
    let joy_state: byte = 0;            // 1 byte
    let key_state: byte = 0;            // 1 byte
}

fn update_physics() {
    let gravity: word = 256;            // 2 bytes
    let friction: byte = 240;           // 1 byte
}

fn check_collisions() {
    let hit_x: byte = 0;                // 1 byte
    let hit_y: byte = 0;                // 1 byte
}

fn update_enemies() {
    let enemy_idx: byte = 0;            // 1 byte
    let ai_state: byte = 0;             // 1 byte
    move_enemy();
}

fn move_enemy() {
    let dx: byte = 0;                   // 1 byte
    let dy: byte = 0;                   // 1 byte
}

fn update_player() {
    let anim_frame: byte = 0;           // 1 byte
    let jump_timer: byte = 0;           // 1 byte
}

fn render_all() {
    let sprite_ptr: word = 0;           // 2 bytes
    draw_background();
    draw_sprites();
}

fn draw_background() {
    let scroll_x: word = 0;             // 2 bytes
    let scroll_y: byte = 0;             // 1 byte
}

fn draw_sprites() {
    let spr_x: byte = 0;                // 1 byte
    let spr_y: byte = 0;                // 1 byte
}

fn wait_vsync() {
    let raster_pos: byte = 0;           // 1 byte
}

interrupt fn irq_handler() {
    let isr_temp: byte = 0;             // 1 byte
    play_music();
}

fn play_music() {
    let note: byte = 0;                 // 1 byte
    let duration: byte = 0;             // 1 byte
}
```

### 6.2 Frame Sizes

| Function | Size |
|----------|------|
| main | 1 |
| init_hardware | 8 |
| read_input | 2 |
| update_physics | 3 |
| check_collisions | 2 |
| update_enemies | 2 |
| move_enemy | 2 |
| update_player | 2 |
| render_all | 2 |
| draw_background | 3 |
| draw_sprites | 2 |
| wait_vsync | 1 |
| irq_handler | 1 |
| play_music | 2 |

**Raw total: 33 bytes**

### 6.3 Call Graph

```
Main Thread:
main ─┬─ init_hardware
      ├─ read_input
      ├─ update_physics
      ├─ check_collisions
      ├─ update_enemies ─── move_enemy
      ├─ update_player
      ├─ render_all ─┬─ draw_background
      │              └─ draw_sprites
      └─ wait_vsync

ISR Thread:
irq_handler ─── play_music
```

### 6.4 Coalesce Groups

**Group 0:** main (1 byte) - entry point

**Group 1:** init_hardware, read_input, update_physics, check_collisions, update_player, wait_vsync
- All called directly by main, don't call each other
- Max size: 8 bytes (init_hardware)

**Group 2:** update_enemies
- Calls move_enemy, so can't join Group 1 with siblings
- Size: 2 bytes

**Group 3:** move_enemy, render_all (both are leaf-like from different subtrees)
- Neither in other's callers
- Max size: 2 bytes

**Group 4:** draw_background, draw_sprites
- Both called by render_all, siblings
- Max size: 3 bytes

**Group 5:** irq_handler (1 byte) - ISR entry

**Group 6:** play_music (2 bytes) - ISR child

### 6.5 Final Layout

```
Without Coalescing: 33 bytes

With Coalescing:
Group 0: 1 byte  (main)
Group 1: 8 bytes (init_hardware + 5 siblings)
Group 2: 2 bytes (update_enemies)
Group 3: 2 bytes (move_enemy + render_all)
Group 4: 3 bytes (draw_background + draw_sprites)
Group 5: 1 byte  (irq_handler)
Group 6: 2 bytes (play_music)
─────────────────
Total: 19 bytes

SAVINGS: 14 bytes (42.4%)
```

---

## 7. Summary of Examples

| Example | Raw Size | Coalesced | Savings |
|---------|----------|-----------|---------|
| Simple siblings | 9 bytes | 4 bytes | 55.6% |
| Nested calls | 8 bytes | 7 bytes | 12.5% |
| ISR isolation | 6 bytes | 6 bytes | 0% |
| Shared helper | varies | varies | partial |
| Diamond pattern | 5 bytes | 4 bytes | 20% |
| Real game | 33 bytes | 19 bytes | 42.4% |

### Key Insights

1. **Siblings save most** - Functions at same call depth share well
2. **Linear chains save least** - Each function on stack blocks sharing
3. **ISR blocks sharing** - Different thread contexts isolate
4. **Leaf functions share** - Functions at bottom of call tree often coalesce
5. **Real programs: 30-50%** - Typical savings for game-style code

---

## 8. Visualization Tools

### 8.1 ASCII Diagrams

The compiler should output coalescing visualizations:

```
=== Frame Coalescing Report ===

Call Graph:
  main() ─┬─ init() ........ Group 1
          ├─ update() ...... Group 1
          └─ render() ...... Group 1

Coalesce Groups:
  Group 0: main          Base: $0200  Size: 2 bytes
  Group 1: init, update, render  Base: $0202  Size: 8 bytes

Memory Map:
  $0200 ████  main
  $0202 ████████████████  Group 1 (init/update/render share)

Raw: 22 bytes → Coalesced: 10 bytes → Saved: 12 bytes (54.5%)
```

### 8.2 Debugging Coalescing Decisions

```
=== Coalescing Debug ===

Function: render
  Recursive callers: {main}
  Thread context: MainOnly
  Frame size: 5 bytes

Trying to join Group 1 (members: init, update):
  ✓ Same thread context (MainOnly)
  ✓ Not recursive
  Checking overlap with init:
    init's callers: {main}
    render in init's callers? No
    init in render's callers? No
    ✓ No overlap with init
  Checking overlap with update:
    update's callers: {main}
    render in update's callers? No
    update in render's callers? No
    ✓ No overlap with update
  
  → render JOINS Group 1
  Group 1 max size: max(3, 4, 5) = 5 bytes
```

---

**Previous Document:** [04b-coalescing-algorithm.md](04b-coalescing-algorithm.md)  
**Next Document:** [05-recursion-handling.md](05-recursion-handling.md)