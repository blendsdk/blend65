# Blend64 v0.1 — Performance Addendum (Maximum FPS)

**Status:** Draft (intended to be normative for `--profile=fast`, and recommended as the default for games)

This document updates and tightens Blend64 rules/spec specifically for **maximum FPS** on Commodore 64.
It does **not** add any runtime, heap, or dynamic features. All effects are compile-time only.

---

## 0. Performance Contract

When the compiler is in **fast profile** (or when any `@hot` / `hotloop` code exists), it MUST:

1. Prefer **fewer CPU cycles** over smaller code size when there is a trade-off.
2. Preserve deterministic output and reachable-only emission.
3. Keep all decisions **static and auditable** via emitted reports (`.map`, `.lst`, perf report).

---

## 1. Zero-Page Policy (Defaults + Determinism)

### 1.1 ZP pool default (fast profile)

By default, the compiler-managed ZP pool is:

- **Reserved:** `$00-$01` (CPU I/O port + DDR; never allocated)
- **ZP pool:** `$02-$5F` (96 bytes) — **fast profile default**

This assumes a typical game build that owns the machine (no reliance on KERNAL/BASIC ZP usage during gameplay).
If a project needs a safer pool, it MUST override the ZP pool via build config.

**Build config override (example):**
- `--zp-pool=$10-$3F`
- `--zp-pool=$02-$7F`

### 1.2 ZP budget split (fast profile)

The compiler MUST split the pool deterministically:

- **Pinned ZP (developer):** 32 bytes (default)
- **Auto ZP (compiler):** 48 bytes (default)
- **ABI + scratch:** 16 bytes (default)

If pinned usage exceeds its slice, compilation fails (do not silently spill pinned ZP).

### 1.3 Allocation order (deterministic)

Allocation MUST be stable and deterministic:

1. ABI + scratch fixed slots
2. developer `zp var` in source order (module import order is deterministic)
3. compiler auto-promotions in descending hotness score (ties broken by symbol name)

### 1.4 Auto-promotion requirement (fast profile)

The spec currently allows auto-promotion; for fast profile it becomes mandatory:

- The compiler MUST auto-promote eligible variables to `zp` unless explicitly pinned elsewhere.

Eligibility signals (any of):
- used inside `hotloop`
- used in IRQ functions
- used in loops
- used as pointer/index in array access
- used in rendering/input modules (if imported)

### 1.5 Emitted ZP report (required)

Fast profile MUST emit:
- ZP allocation map (symbol → zp address)
- spills report (what was *not* promoted and why)
- ZP slice usage summary

---

## 2. Hotness Model and `hotloop` Construct

### 2.1 Why: no profiler, still need aggressive decisions

Blend64 v0.1 does not rely on runtime profiling. Instead, it uses static hotness rules.

### 2.2 `@hot` attribute (function-level)

`@hot fn name(...) { ... }`

Effects:
- biases inlining
- biases ZP promotion
- biases lowering to faster forms
- enables more aggressive register clobber analysis (whole-program)

### 2.3 `hotloop { ... }` statement (block-level, canonical game loop)

A new statement form:

```blend64
hotloop {
  tick()
  render()
}
```

**Lowering (magic phase):**
- Introduce a label
- Emit body
- `JMP label`

**Rules:**
- `hotloop` MUST be non-terminating in release builds (no implicit exit).
- `break` is forbidden inside `hotloop` (compile-time error).
- Optional explicit escape is allowed only via a dedicated construct (e.g. `exit_hotloop()`), which is intended for dev/debug builds.

**Optimization meaning:**
- Everything transitively called from `hotloop` is considered hot unless proven cold.

### 2.4 Implicit hotness

Even without `hotloop`, the compiler MUST treat as hot:
- IRQ handlers and their callees
- loops inside `main`
- functions annotated `@hot`

---

## 3. Inlining and Specialization Policy (Fast Profile)

### 3.1 Required inlining cases

The compiler MUST inline when all are true:
- leaf function
- small body (compiler-defined threshold in IR instructions)
- called from hot code (`hotloop`, `@hot`, IRQ, or inside a loop)

Inlining is allowed to increase code size.

### 3.2 Developer controls

- `@inline` forces inlining (compile-time error if impossible)
- `@noinline` forbids inlining

### 3.3 Fixed-count loop unrolling (optional but recommended)

A minimal directive may be supported:

- `@unroll(N)` only on loops where iteration count is compile-time constant.
- The compiler MAY reject `@unroll` if it would exceed a code-size cap (cap is compile-time config).

Unrolling is intended strictly for hot sprite/scroll kernels.

---

## 4. Lowering Rules That Prefer Cycles

### 4.1 `match`

- Dense ranges MUST lower to jump tables.
- Sparse sets MUST lower to compare chains.
- Compare chains MUST preserve source order (developer can order most-likely-first).

### 4.2 Booleans

- If a boolean value is used only to branch, it MUST NOT be materialized in memory.
- Short-circuit expressions MUST lower directly to branches.

### 4.3 Bounds checks

- Fast profile forbids bounds checks in release.
- Debug builds may enable checks via flags.

---

## 5. IRQ Safety With Static Temporaries

Because Blend64 forbids locals, temporaries are static. This is fast, but must be safe.

### 5.1 Context partitioning (required)

The compiler MUST partition temps into:
- **main temps**
- **irq temps**

An IRQ function (and its callees) MUST NOT use main temps.
Violations are compile-time errors.

### 5.2 `@irq` attribute

`@irq fn rasterIrq() { ... }`

Effects:
- uses IRQ temp partition
- enables different register preservation rules (see ABI section)

---

## 6. Calling Convention and Register Clobber Rules

### 6.1 Default fast ABI

- `byte` parameter: A
- `word` parameter: A/X (low/high)
- return follows same scheme

### 6.2 Clobber analysis

Fast profile MUST use whole-program analysis to avoid unnecessary saves/restores.

Rules:
- Leaf hot functions may clobber A/X/Y freely if callers do not require values.
- IRQ handlers must preserve the machine state required by the chosen IRQ model (project config), but may omit unnecessary preservation if proven safe.

---

## 7. Cycle-Cost Model (IR + Reports)

### 7.1 IR instruction cost annotation (required)

Every lowered IR instruction MUST carry:

- `cycles_min`
- `cycles_max` (for branches / page-crossing / taken-branch variance)
- `bytes`
- `zp_reads`, `zp_writes`
- `abs_reads`, `abs_writes`
- `clobbers` (A/X/Y/flags)

### 7.2 Basic block and function summaries

The compiler MUST compute:

- per basic block: total min/max cycles and bytes
- per function: hot-path min/max cycles (by following hotness edges)
- per `hotloop`: per-iteration min/max cycles

### 7.3 Required emitted artifacts (fast profile)

Fast profile MUST emit a performance report, e.g. `game.perf.txt`, containing:

- top 20 hottest functions by estimated cycle share
- `hotloop` per-iteration min/max cycle estimate
- ZP usage summary (pinned/auto/ABI)
- inlining summary (what was inlined and why)

### 7.4 Optional developer budgets (guardrails)

A compile-time directive is allowed:

- `@budget(cycles = N)` on `hotloop` or `@hot fn`

If the compiler’s estimated **max cycles** exceeds `N`, it MUST:
- error in `--strict-perf` mode
- warn otherwise

---

## 8. Configuration Surface (Recommended Flags)

- `--profile=fast` (enables all policies in this document)
- `--zp-pool=$02-$5F` (override)
- `--strict-perf` (turn perf budget overages into errors)
- `--bounds=off|on` (debug only; fast profile defaults off)

---

## End Guarantee

With these rules, Blend64 fast profile is designed so that:

- hot kernels are ZP-optimized
- call overhead is minimized via inlining
- lowering favors branch/jump-table forms that reduce cycles
- IRQ/mainline temp clobber bugs are rejected at compile time
- cycle costs are visible and inspectable without writing assembly

No runtime is introduced; everything remains ahead-of-time, static, and reachable-only.
