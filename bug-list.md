# Blend65 Compiler — Bug List

> **Source**: Analysis of `examples/border-cycle/main.blend` generated assembly
> **Created**: 2025-08-02
> **Fixed this session**: Startup tail-call optimization (JSR/RTS → JMP), @zp unused variable warnings

---

## Compiler Bugs

### BUG-001: Double CMP destroys comparison flags (CRITICAL)

**Severity**: Critical — generates incorrect code
**Component**: Code Generator (if-statement emission)

The compiler emits two consecutive `CMP` instructions for an `if (color > 15)` check,
where the second `CMP` overwrites the CPU flags set by the first. This makes the
branch condition test the wrong thing entirely.

**Generated assembly (broken):**
```asm
  CMP #$0F        ; compare color > 15
  CMP #$00        ; ← OVERWRITES flags from above!
  BEQ .else2      ; now tests A == 0 instead of color > 15
  LDA #$00
  STA $02
.else2
```

**Expected assembly:**
```asm
  CMP #$10        ; compare color >= 16 (i.e. > 15)
  BCC .else2      ; branch if carry clear (color < 16)
  LDA #$00
  STA $02
.else2
```

**Blend source triggering the bug:**
```js
if (color > 15) {
    color = 0;
}
```

---

### BUG-002: Redundant variable initialization before for-loop

**Severity**: Low — generates correct but wasteful code
**Component**: Code Generator / IL Generator

When `let x: byte = 0` is followed by `for x = 0 to N`, the compiler generates
two identical `LDA #0 / STA x` sequences. The first init is immediately overwritten
by the for-loop's initialization.

**Generated assembly (wasteful):**
```asm
  LDA #$00        ; let x: byte = 0
  STA $02
  ; ...
  LDA #$00        ; for x = 0 to N (loop init)
  STA $02
```

**Optimization**: The IL optimizer or code generator should detect when a variable
is initialized and then immediately overwritten by a for-loop init, eliminating
the first store.

---

### BUG-003: Misleading compiler-generated comments

**Severity**: Low — cosmetic, affects debugging
**Component**: Code Generator (comment emission)

Comments like `; A already has $02` can be misleading when the actual register
state depends on the execution path taken. The comment suggests A contains the
value of zero-page address `$02`, but this may not hold true after branches or
other instructions modify A.

---

### BUG-004: Duplicate labels across functions — ACME assembler rejects output

**Severity**: Critical — generated .asm fails to assemble
**Component**: Code Generator (label emission)

The code generator resets its internal label counter per function. When multiple
functions use the same control-flow constructs (e.g., `while` loops), they produce
identical local labels (`.while0`, `.endwhile1`, etc.). Since ACME assembler treats
all `.`-prefixed local labels in the same zone (`<untitled>`), the duplicate labels
cause assembly errors.

**Reproduction:**
```bash
./packages/cli/bin/blend65.js build ./examples/border-cycle/main.blend \
  && acme -o ./build/color.prg -f cbm ./build/main.asm
```

**ACME error output:**
```
Error - File ./build/main.asm, line 112 (Zone <untitled>): Symbol already defined.
Error - File ./build/main.asm, line 121 (Zone <untitled>): Symbol already defined.
```

**Generated assembly (broken) — labels collide between `test1` and `main`:**
```asm
; Function: test1
test1:
  ...
.while0          ; ← first definition
  ...
.endwhile1       ; ← first definition
  RTS

; Function: main
main:
.while0          ; ← ERROR: duplicate of test1's .while0
  ...
.endwhile1       ; ← ERROR: duplicate of test1's .endwhile1
  RTS
```

**Possible fixes (pick one):**
1. **Global counter** — never reset the label counter between functions, so labels
   are unique across the entire module (`.while0` in test1, `.while3` in main)
2. **Scoped label prefix** — emit labels as `.<module>_<function>_<label>`
   (e.g., `.BorderCycle_test1_while0`, `.BorderCycle_main_while3`)

**Blend source triggering the bug:**
```js
// Both test1 and main contain while loops, producing duplicate .while0 labels
fn test1() {
    let color: byte = 0;
    while (true) { ... }
}

fn main() {
    while (true) { ... }
}
```

---

### BUG-005: CLI -O1 shorthand doesn't work — requires -O O1 instead

**Severity**: Medium — CLI usability issue
**Component**: CLI (build command option parsing)

The help text advertises `-O1`, `-O2`, `-Os`, `-Oz` style flags (GCC convention),
but they don't actually work. The yargs option is defined with `choices: ['O0', 'O1', ...]`
— so when you type `-O1`, yargs parses it as flag `-O` with value `1`, which fails
validation because `1` is not in the choices list (`O1` is). The workaround `-O O1`
works because the value is literally the string `O1`.

**Reproduction:**
```bash
# This FAILS:
blend65 build main.blend -O1

# This works (but is awkward):
blend65 build main.blend -O O1
```

**Root cause** (in `packages/cli/src/commands/build.ts`):
```typescript
.option('optimization', {
  alias: 'O',
  type: 'string',
  choices: ['O0', 'O1', 'O2', 'O3', 'Os', 'Oz'],  // ← includes 'O' prefix
  default: 'O0',
})
```

**Fix**: Remove the `O` prefix from choices and accept only the level:
```typescript
.option('optimization', {
  alias: 'O',
  type: 'string',
  choices: ['0', '1', '2', '3', 's', 'z'],  // ← just the level
  default: '0',
})
```
Then in `buildConfig`, prepend `O` when constructing the config:
```typescript
optimization: ('O' + (args.optimization || '0')) as 'O0' | 'O1' | ...
```

This makes all forms work naturally: `-O1`, `-O 1`, `-Os`, `--optimization 2`.

---

### BUG-006: CLI help doesn't explain what each optimization level does

**Severity**: Low — usability / documentation gap
**Component**: CLI (build command help text)

The `--optimization` / `-O` option lists the choices `O0, O1, O2, O3, Os, Oz` but
provides no description of what each level actually does. Users have no way to know
the difference between levels without reading compiler source code.

**Current help output:**
```
-O, --optimization  Optimization level  [choices: "O0", "O1", "O2", "O3", "Os", "Oz"] [default: "O0"]
```

**Expected**: Each level should have a brief description, e.g.:
- `O0` — No optimization (default, fastest compile)
- `O1` — Basic optimizations (dead code, constant folding)
- `O2` — Standard optimizations (O1 + peephole, register hints)
- `O3` — Aggressive optimizations (O2 + inlining, loop transforms)
- `Os` — Optimize for size (minimize code bytes)
- `Oz` — Optimize aggressively for size

**Fix**: Add a `describe` section or epilog to the build command help explaining
each optimization level, or use yargs' `.epilog()` to add a reference table.

---

### BUG-007: Duplicate --optimization flag crashes compiler

**Severity**: Medium — internal compiler error from invalid CLI input
**Component**: CLI (argument parsing) + Compiler (optimizer)

Passing `--optimization` twice causes an internal compiler crash instead of a
helpful error message. Yargs converts duplicate flags into an array, which the
optimizer doesn't handle.

**Reproduction:**
```bash
./packages/cli/bin/blend65.js build --optimization O1 --optimization Oz ./examples/border-cycle/main.blend
```

**Error output:**
```
error: Internal compiler error: LEVEL_PASSES[level] is not iterable
  --> <internal>:1:1

✗ Build failed with 1 error(s)
```

**Root cause**: When `--optimization` is specified twice, yargs produces an array
`['O1', 'Oz']` instead of a string. The `buildConfig` function passes this array
as-is to the compiler config. The optimizer then does `LEVEL_PASSES[['O1', 'Oz']]`
which is `undefined`, and iterating `undefined` throws `is not iterable`.

**Fix (two options):**
1. **Last-wins** (GCC behavior) — in `buildConfig`, if `args.optimization` is an
   array, take the last element: `Array.isArray(opt) ? opt[opt.length - 1] : opt`
2. **Reject duplicates** — add yargs validation to disallow repeated `--optimization`

---

## Optimizer Gaps (Missing Optimizations)

### OPT-001: Dead Function Elimination missing — uncalled functions emitted in assembly

**Severity**: High — wastes bytes in every program with unused functions
**Component**: Optimizer (program-level DCE)
**Discovered**: 2026-09-02 via `examples/border-cycle/main.blend` compiled with `-O1`

The `speedy()` function is never called by any reachable code path, yet it is fully
generated in the assembly output. With `-O1`, the optimizer should detect that `speedy()`
is unreachable from `main()` and remove it entirely.

**Root cause**: The current DCE pass (`optimizer/passes/dce.ts`) operates at the
**instruction level within individual functions**. It removes dead stores and unreachable
code within a function, but never asks: "Is this entire function unreachable?"

The `ILOptimizer.optimizeProgram()` iterates over ALL functions and optimizes each
individually — there is no program-level pass that can analyze cross-function relationships.

**What's needed**: A `DeadFunctionElimination` program-level pass that:
1. Builds a call graph (scan all CALL instructions across all functions)
2. Finds the entry point (exported `main`)
3. BFS/DFS from entry point to find all reachable functions
4. Removes any `ILFunction` not in the reachable set from `program.functions`

**Blocked by**: No program-level pass infrastructure (GAP-1) and no call graph analysis
(GAP-2) in the optimizer. See `plans/optimizer-series/OPTIMIZER-ROADMAP.md` Known Gaps section.

**Blend source:**
```js
// speedy() is NEVER called — should be eliminated
function speedy(): void {
    while (true) {
        poke(BORDER_COLOR, peek(BORDER_COLOR)+1);
    }
}
```

**Generated assembly (should not exist):**
```asm
speedy:
.while7
  LDA $D020
  CLC
  ADC #$01
  STA $D020
  JMP .while7
.endwhile8
  RTS
```

---

### OPT-002: Single-call-site function inlining missing — JSR/RTS overhead for functions called once

**Severity**: High — wastes 12 cycles per call on 1 MHz 6502
**Component**: Optimizer (function inlining)
**Discovered**: 2026-09-02 via `examples/border-cycle/main.blend` compiled with `-O1`

The `delay()` function is called from exactly **one place** (inside `main()`'s while loop).
Instead of generating a separate `delay:` label with `JSR delay` / `RTS`, the function body
should be inlined directly into the call site. This saves:
- 6 cycles for `JSR` (3 bytes)
- 6 cycles for `RTS` (1 byte)
- = 12 cycles and 4 bytes per call

Single-call-site inlining is **always profitable** because:
- No code size increase (function body moves, doesn't duplicate)
- Saves JSR/RTS overhead
- Enables further optimizations (optimizer can see full loop context)

**Blocked by**: No call graph analysis (GAP-2) in the optimizer. The optimizer needs to
know how many times each function is called to make inlining decisions.
See `plans/optimizer-series/OPTIMIZER-ROADMAP.md` Known Gaps section.

**Current assembly (with JSR overhead):**
```asm
main:
  ...
  JSR delay        ; 6 cycles, 3 bytes
  ...

delay:
  ...nested loops...
  RTS              ; 6 cycles, 1 byte
```

**Expected assembly (inlined):**
```asm
main:
  ...
  ; --- delay body inlined here ---
  LDA #$00
  STA $03
.for3
  ...nested loops...
.endfor4
  ; --- end inlined delay ---
  ...
```

---

## Design Issues (Not Bugs)

### DESIGN-001: Zero-page variable allocation uses unsafe addresses

**Severity**: Medium — can cause intermittent corruption on real C64
**Component**: Frame Allocator / ZP allocation

The compiler allocates `@zp` variables starting at addresses like `$02`, `$03`, `$04`.
These are in the KERNAL/BASIC workspace area and may be clobbered by the default
IRQ handler or ROM routines.

**Recommendation**: Allocate user ZP variables from safer ranges like `$FB–$FE`
(commonly free on stock C64) or allow configuration of the ZP allocation range.

---

### DESIGN-003: Unnecessary JMP main — emit main() first after BASIC stub

**Severity**: Low — wastes 3 bytes and 3 cycles
**Component**: Code Generator (function ordering / startup emission)

The compiler emits all functions in source order, then generates a `JMP main`
startup section to reach the entry point. This is unnecessary — if the compiler
simply emits `main()` first (immediately after the BASIC stub), execution falls
through naturally from `SYS 2064` into `main`'s first instruction.

**Current generated assembly (wasteful):**
```asm
  *= $0810 ; Code start

; Program Startup
  JMP main          ; ← 3 bytes wasted

; Function: test1
test1:
  ...

; Function: main
main:               ; ← main is buried after other functions
  ...
```

**Desired generated assembly:**
```asm
  *= $0810 ; Code start

; Function: main
main:               ; ← emitted FIRST, no jump needed
  ...

; Function: test1
test1:
  ...
```

**Fix**: In the code generator, detect which function is `main()` and emit it
first in the code section. All other functions follow after. This eliminates the
startup section entirely — the BASIC `SYS 2064` entry point lands directly on
`main`'s first instruction.

---

### DESIGN-002: Delay loop is CPU-speed dependent

**Severity**: Low — design limitation, not a bug
**Component**: N/A (user code pattern)

Nested busy-loop delays are inherently tied to CPU clock speed and differ between
PAL/NTSC C64 variants. This is a known limitation of the approach — proper timing
should use the jiffy clock (`$A2`) or CIA timers.

Not a compiler issue, but worth noting for future standard library design
(e.g., a `delay_ms()` intrinsic using hardware timers).

---

## Resolved Issues

| ID | Description | Resolution | Date |
|----|-------------|------------|------|
| ~~FIX-001~~ | Startup uses JSR/RTS instead of JMP | Changed to `JMP main` | 2025-08-02 |
| ~~FIX-002~~ | @zp unused variables not warned with `_` prefix | Added ZP metadata check | 2025-08-02 |
