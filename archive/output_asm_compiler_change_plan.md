# output.asm – Compiler-Oriented Analysis & Optimization Change Plan (C64 / ACME)

This document is written as a **compiler optimization change plan** (not a one-off hand edit).  
Goal: enable an AI or compiler engineer to trace emitted assembly patterns back to the compiler source and implement safe, testable optimizations.

---

## 1. Program summary (as emitted)

### Runtime behavior
- Emits a BASIC SYS stub at `$0801`, jumps to `main` at `$0810`.
- Initializes VIC-II sprite 0 registers:
  - `$D000/$D001` sprite 0 X/Y
  - `$D010` sprite X MSB bits
  - `$D027` sprite 0 color
  - `$D015` sprite enable
- Animates sprite 0 by writing a **sprite pointer** to `$07F8` in a loop with a busy-wait delay.
- Sprite frame data label: `__data_SpinningLine_lineFrames`
  - `!align 63,0` ensures 64-byte alignment
  - 256 bytes total => 4 frames × 64 bytes

### Main suboptimal emitted regions
1. **Sprite pointer computation** (inlined `getSpriteFrame`):
   - loads a 16-bit label address into ZP temp
   - divides by 64 via **6× (LSR/ROR)** with stack juggling
   - adds frame index
   - writes result to `$07F8`

2. **Delay** (inlined `delay`):
   - nested loops using `INC` + `CMP` + `JMP`
   - larger & slower than canonical 6502 delay sequences

3. **Frame wrap logic**:
   - increment, compare against 4, branch, then reset to 0
   - can be branchless for power-of-two frame count

---

## 2. Optimization themes

### Theme A — Strength-reduce sprite pointer math (largest win)

#### Hardware rule (C64)
Sprite pointer written to `$07F8` is:  
`pointer = spriteDataAddress / 64` (integer), as an 8-bit value.

#### Why current emission is wasteful
The compiler emits a runtime 16-bit division by 64 using repeated shifts and stack saves, *even though the address is a link-time/assembly-time constant label*.

Because `__data_SpinningLine_lineFrames` is aligned to 64 bytes and frames are packed consecutively in 64-byte chunks:

**Correct pointer for frame `n`:**
- `basePtr = (__data_SpinningLine_lineFrames / 64)`
- `ptr = basePtr + n`

No 16-bit shifts are needed at runtime.

#### Compiler change
Add an IR-level optimization (preferred) or backend peephole to rewrite:

`(labelAddr / 64) + frameIndex`  
into  
`const_base + frameIndex`

##### Preconditions
- operand is a label/symbol with known absolute address (or relocatable resolved at assembly time)
- division is by 64 (or shift right by 6)
- result is stored/used as 8-bit sprite pointer
- alignment to 64 is either:
  - proven (data layout guarantees), or
  - explicitly present (e.g., `align 64`) and recorded in metadata

##### Emission target
Instead of 6 shift steps + stack traffic, emit:

- `LDA frameIndex`
- `CLC`
- `ADC #basePtrImm` where `basePtrImm = (labelAddr >> 6)`
- `STA $07F8`

---

### Theme B — Loop-invariant hoisting / CSE for pointer base

If Theme A is not applied generally, at minimum:
- detect `(label >> 6)` inside the animation loop
- hoist it outside the loop (LICM)
- inside loop, only add the frame index

This improves general cases where constant folding is incomplete.

---

### Theme C — Power-of-two wrap → bitmask

For 4 frames, wrap is modulo 4:
- current emission: `frame++ ; if frame==4 then frame=0`
- optimized emission: `frame = (frame + 1) & 3`

#### Compiler rule
If modulo base `N` is a power of two:
- replace wrap/`% N` with bitmask `AND #(N-1)`.

#### Emission target
- `LDA frame`
- `CLC`
- `ADC #1`
- `AND #3`
- `STA frame`

---

### Theme D — Delay canonicalization

Current busy-wait is a high-level loop lowering artifact.

#### Options (compiler strategy)
1) **Intrinsic delay primitive**
- add `delay_cycles(k)` lowering to `DEX/BNE`/`DEY/BNE`, and rewrite empty loops to this intrinsic when `-O` is enabled

2) **Empty-loop pattern rewrite**
- detect loops with no side effects other than counter increments
- replace with canonical register-counted delay

3) **Raster sync delay** (semantic change; only if requested)
- wait on `$D012` / frame boundary for consistent animation timing

#### Detection (IR-level)
A loop is a “busy-wait” if:
- loop body has no externally visible side effects
- body only mutates loop counters/temporaries
- no reads of volatile/I/O-mapped addresses

#### Emission target (canonical, small)
Typical structure:
- `LDX #outer`
- `LDY #inner`
- `DEY; BNE inner`
- `DEX; BNE outer`
- `RTS`

---

### Theme E — Backend value tracking (correctness-friendly)

The file includes sequences relying on A still containing an immediate from prior code (e.g., store to `$D027` then store to `$D015` without reloading).  
This is correct now, but fragile if scheduling changes.

**Compiler change:** add a simple register-value tracker (or disable such reuse unless proven).  
If proof is not implemented, emit explicit `LDA #imm` for each store.

---

## 3. Concrete “before/after” targets

### 3.1 Sprite pointer update (inside loop)

**Before (conceptual):**
- load label address into temp
- 16-bit shift-right by 6 via stack juggling
- add frame
- store to `$07F8`

**After:**
- `LDA frame`
- `CLC`
- `ADC #(__data_SpinningLine_lineFrames / 64)`
- `STA $07F8`

---

### 3.2 Frame wrap

**Before:**
- `ADC #1`
- `CMP #4`
- `BNE cont`
- `LDA #0`
- `STA frame`

**After:**
- `ADC #1`
- `AND #3`

---

### 3.3 Delay

**Before:**
- nested loops with `INC` and `JMP`

**After:**
- canonical register-count loops or raster wait

---

## 4. Compiler pipeline implementation plan

### Pass 1 — Constant folding for label arithmetic
- Represent labels/symbols as constant-like expressions in IR.
- Enable folding of:
  - `label + const`
  - `label >> k` / `label / 2^k` when used in byte contexts
- Specifically: fold `label >> 6` when used for sprite pointers.

**Deliverable:** immediate 8-bit base pointer for `__data_*` labels.

---

### Pass 2 — Strength reduction for division by power-of-two
- Replace `/64` with `>>6` in IR.
- If operand becomes constant/label => fold to immediate.
- If operand not constant => emit a more direct 16-bit shift sequence (avoid stack), if your backend supports it.

---

### Pass 3 — LICM / CSE
- Hoist loop-invariant `label >> 6` computations out of loops.
- Reuse computed base across iterations.

---

### Pass 4 — Backend peephole rules (6502)
Add targeted peepholes:
- increment+compare+reset to 0 => `AND #(N-1)` when N is power-of-two
- remove redundant loads to temporaries when value is already in A/X/Y
- (optional) replace some counter loops with `DEX/BNE` patterns

---

### Pass 5 — Delay canonicalization (optional)
- Recognize “empty/busy-wait loops” and replace with:
  - intrinsic delay, or
  - canonical register-count delay, or
  - raster sync if requested

---

## 5. Safety constraints & correctness notes

### Sprite pointer math
- Ensure base pointer is computed as integer division by 64 (`>> 6`).
- Ensure frame index stays within expected range.
- Ensure label alignment or frame boundary assumptions are validated (metadata or explicit align).

### Mask wrapping
- Only apply `AND (N-1)` when `N` is a power of two.
- Otherwise keep compare/branch or use a general modulo strategy.

### Delay
- Replacing a busy-wait loop may change exact timing.
- If exact cycle timing matters, expose a “timing mode” option or keep old behavior without `-O`.

---

## 6. Regression tests to add

1. **Pointer correctness test**
- assemble and run a small test that checks `$07F8` sequence equals `(label>>6)+frame`.

2. **Wrap correctness**
- verify frame index cycles 0,1,2,3 repeatedly for N=4.
- ensure no mask optimization is applied for N=5.

3. **Delay preservation**
- if delay is rewritten, validate approximate cycle counts or observable timing behavior.

4. **Value tracking**
- if backend reuses register values, prove liveness; otherwise always reload immediates for I/O stores.

---

## 7. Expected outcomes

- Major reduction in per-frame overhead from removing runtime `addr/64` computation.
- Smaller, faster animation loop.
- Cleaner backend output with fewer temporaries and less stack usage.
- More stable and maintainable compiler output.

