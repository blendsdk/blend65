# Chapter 11 — Memory Model & Static Frame Allocation

> **Version**: 4.0
> **Status**: draft  
> **Stability**: stable  
> **Source**: F005, F018, F019 (consolidated)

---

## 1. Overview

Blend65 uses **Static Frame Allocation (SFA)** — all memory allocation decisions are made at compile time. There is no heap, no dynamic allocation, no garbage collector. Every variable, parameter, and local has a fixed memory address determined before the program runs.

This chapter is the canonical reference for:
- The memory map model (code, data, RAM, zero page, hardware stack)
- SFA frame allocation for functions
- Frame coloring (memory sharing for non-overlapping lifetimes)
- Zero-page budget and allocation
- Hardware stack usage
- Build summary reporting

---

## 2. Memory Map

### 2.1 Segments

The compiler organizes the output binary into segments. The platform profile (→ Ch 15) defines the address ranges for each segment.

| Segment | Contents | Placement |
|---------|----------|-----------|
| **Code** | Machine code for all functions, startup routine | Platform-defined code area |
| **Data** | Const arrays, const structs, `embed()` assets | Platform-defined data area (ROM on cartridge, RAM on disk) |
| **RAM** | Module-level `let` variables, SFA frames | Platform-defined RAM area |
| **Zero Page** | `zeropage` variables, compiler temps, struct/array pointers | $00–$FF (platform profile defines available range) |
| **Hardware Stack** | Return addresses (JSR/RTS), interrupt context | $0100–$01FF (fixed by 6502 architecture) |

`loadable const` bytes are package content, not a memory segment. They have no resident address
until a selected-profile load writes an ordinary mutable destination; that destination already
belongs to RAM, zero page, or a lifetime-valid SFA home.

### 2.2 Example Memory Map (C64)

```
$0000–$00FF  Zero Page
  $00–$01    6510 I/O direction registers (hardware)
  $02–$8F    Available for Blend65 ZP variables + compiler temps (142 bytes)
  $90–$FF    Outside the default profile (KERNAL/editor/cassette ownership)

$0100–$01FF  Hardware Stack (256 bytes)

$0801–$CFFF  Shared program span — BASIC stub + Code + Data + Variables + SFA frames
  $A000–$BFFF  RAM is selected here because the default startup banks out BASIC ROM
$D000–$DFFF  I/O registers (VIC-II, SID, CIA)
$E000–$FFFF  KERNAL ROM
```

The exact layout varies per platform and is configured in the platform profile.

For a contiguous load image such as the default C64 PRG, all emitted startup/code/const/asset bytes
form one prefix beginning at `load_address`; any address gap inside that prefix is serialized as
padding. Mutable variables and SFA homes form a disjoint trailing BSS suffix after the last emitted
byte. The linker reserves their addresses but the serializer emits no bytes for that suffix, so the
loader does not overwrite uninitialized storage. The complete prefix plus BSS suffix is the shared
program footprint and must fit the profile range. This ordering is a flat-image rule, not a claim
that ROM/cartridge targets serialize RAM reservations.

### 2.3 Explicit Placement Constraints

The linker begins with automatic profile and object constraints. A source `place(...)` modifier may
add only `at`, `align`, `noCross`, or a typed profile `region`. It never removes a constraint.
Requirements from a platform operation, asset handler, canonical alias, visibility rule, bank,
owner, or reserved range are intersected with the source clause. The complete object must satisfy
the result; otherwise E10273 reports the object, every contributing requirement, and all occupied
ranges relevant to the conflict.

An exact `at` address does not reserve otherwise illegal memory. An aligned address can still fail
`noCross`, region, visibility, banking, ownership, or overlap. The linker does not repair a conflict
by moving an `at` object, duplicating canonical bytes, or copying at runtime.

```blend65
place(at: $D020) let badTarget: byte; // ❌ MMIO is not ordinary storage
place(region: c64.vic.bank1, align: 2048) const CHARSET: byte[2048] =
    embed("level.ctm", "charset");   // ✅ only if all profile/asset constraints intersect
```

### 2.4 Captured Load Ranges

A load destination uses its existing ordinary storage; loading allocates no new home. The compiler
evaluates the place once and records a symbolic physical half-open range plus provenance and a fresh
result identity. When a dynamic expression has several proved candidates, the capture denotes the
one actually selected range; it does not mark every candidate selected. Before the call, only that
captured range becomes indeterminate. On the `true` edge it is strongly updated to the complete
logical value; on the `false` edge it stays indeterminate. Must-not-alias and unselected ranges
preserve their prior facts, while partial or may-alias ranges retain only byte facts valid for every
candidate.

Joins intersect predecessor initialization facts, loops use the ordinary monotone fixed point, and
overlapping later writes kill only the overlap. A whole-value read requires its complete byte range
on every reaching path. Using the new load's logical-value fact also requires that the read
must-alias the successful capture. These are compiler facts only; no target descriptor, validity
flag, generation counter, bitmap, handle, or read check exists.

---

## 3. Static Frame Allocation (SFA)

### 3.1 Core Principle

Every function receives one or more **static invocation-private homes** at compile-time-known
addresses. A home contains parameters, return slots, locals, temporaries, spills, staging values,
zero-page pairs, and helper scratch needed by one concurrently possible invocation. Mainline, startup,
IRQ, NMI, nested/re-enabled interrupt roots, and compiler-visible escaped callbacks all participate.
Taking `&local` does not make the home persistent. It creates a borrow bounded by the local's
dynamic source lifetime. Legal borrow uses extend that home's liveness; E10260 rejects any possible
escape beyond the lifetime.

```
Function: calculate(a: byte, b: byte): word
  Frame at $2000 (example):
    $2000: parameter 'a'    (1 byte)
    $2001: parameter 'b'    (1 byte)
    $2002: local 'result'   (2 bytes)
    $2004: local 'temp'     (1 byte)
  Total frame size: 5 bytes
```

### 3.2 Why SFA?

| Traditional (stack-based) | SFA (static) |
|--------------------------|--------------|
| Parameters pushed to stack | Parameters stored at fixed addresses |
| Stack pointer manipulation per call | No stack pointer manipulation |
| Variable-size stack frame | Fixed-size frame, known at compile time |
| Supports recursion | No recursion (→ Ch 06, FN-6) |
| 256-byte stack limit is a problem | SFA removes data frames; the remaining returns, interrupts, and explicit pushes are statically budgeted |
| Frame access via stack pointer + offset | Frame access via absolute addressing |

On the 6502, stack-based data frames are expensive: the hardware stack is only 256 bytes, there is
no frame pointer register, and accessing stack data requires pulling/pushing. SFA eliminates data
frames, but the compiler still accounts for return addresses, interrupts, and explicit stack
intrinsics.

### 3.3 Frame Size per Type

| Item | Frame Bytes |
|------|-------------|
| `byte` / `sbyte` / `boolean` parameter or local | 1 |
| `word` / `sword` parameter or local | 2 |
| Enum parameter or local | 1 |
| Struct parameter (by-reference) | 2 (base address pointer) |
| Exact `T[N]` array parameter (by-reference) | 2 (base address pointer) |
| Any-size `T[]` array parameter (by-reference) | 4 (base address pointer + word element count) |
| Struct local (by-value) | `sizeof(Type)` |
| Array local (by-value) | element size × count |

### 3.4 Frame Coloring

Functions with **non-overlapping lifetimes** can share frame memory. The compiler computes this from the static call graph.

The interference graph includes both ordinary call nesting and interrupt preemption. A function
reachable from overlapping execution domains receives separate storage homes; a code variant is
needed only when fixed addresses or specialized callees differ. Globals/assets/MMIO are shared state,
not frame storage. Final allocation occurs only after lowering has exposed every helper scratch need.
An unbounded or unknown storage-bearing overlap is a compile-time error, never silent corruption.

Address-derived provenance participates in the interference proof. A local home remains
non-reusable while a legal borrow can observe it, including through a proven non-retaining callee
or a feasible preempting domain. Bounded concurrent domains receive disjoint homes and any code
variant needed to materialize the correct fixed address. Sequential invocations and loop
iterations may reuse one physical home only because E10260 makes an earlier borrowed address
unobservable. SFA never pins an automatic local for program lifetime or silently converts it into
shared static state.

The same rule covers every addressable storage place. A scalar parameter has the current
invocation's lifetime. An aggregate-parameter place inherits the caller object's lifetime.
Variables, parameters, nested fields, and indexed elements also retain mutable or read-only origin
through copies and address arithmetic. A known write through a read-only-derived address is
rejected. Place and index expressions evaluate once, and normal array bounds behavior applies;
there is no implicit one-past element. A one-past numeric address can only be formed explicitly by
ordinary `word` arithmetic.

```
Call graph:
  main → init, update, render
  update → handleInput, moveEnemies
  render → drawBackground, drawSprites

Frame allocation:
  init, update, render    — all called from main, never simultaneously
  handleInput, moveEnemies — both called from update, never simultaneously
  drawBackground, drawSprites — both called from render, never simultaneously

Sharing:
  init and render can share frame memory (non-overlapping)
  handleInput and drawSprites can share frame memory (non-overlapping)
```

**Result**: The total frame region is typically 30–60% smaller than the sum of all individual frames.

### 3.5 Frame Region Size

The compiler computes the worst-case simultaneous frame usage from the call graph. This is reported in the build summary:

```
Frame allocation:
  Total frame region: 47 bytes at $2000–$202E
  Peak simultaneous usage: main(3) + update(5) + handleInput(2) = 10 bytes
  Sharing saved: 37 bytes via frame coloring
```

### 3.6 Aggregate Return Destinations and Copies

A fixed struct or array result is constructed in storage owned by its caller. A declaration or
assignment can supply its final object directly; another consuming expression may require an SFA
temporary. Each live nested or cross-domain result has disjoint storage unless a proof permits the
same final destination. The destination address, temporary, overlap snapshot, and selected helper
scratch all close through SFA before emission.

Aggregate assignment and return preserve the complete source value when ranges alias or overlap.
The compiler may construct directly, elide a copy, choose a safe copy direction, inline a copy, or
select a specialized shared sequence only when observable values and left-to-right effects are
unchanged. The build summary reports every copy that remains, including bytes, cycles, and scratch.
This requires no heap, dynamic frame, mandatory runtime, or source-level copy operation.

---

## 4. Zero-Page Allocation

### 4.1 ZP Budget

The platform profile defines the available zero-page range. The compiler allocates from this range for:

1. **User-declared `zeropage` variables** — explicit developer request
2. **Compiler temps** — scratch bytes for expression evaluation
3. **Struct/array pointers** — 2-byte pointers for indirect addressing (`(ptr),Y`)
4. **Interrupt handler temps** — separate from main code temps (→ Ch 06, §7.6)

### 4.2 ZP Allocation Priority

1. User-declared `zeropage` variables (highest priority)
2. Struct/array pointers (2 bytes per active by-ref parameter level)
3. Expression evaluation temps
4. Interrupt handler temps (separate pool)

### 4.3 ZP Sharing

Like SFA frames, ZP pointer bytes are shared between functions with non-overlapping lifetimes:

| Call Pattern | ZP Pointer Bytes |
|-------------|-----------------|
| Sequential: `f(s); g(s);` | 2 bytes (shared) |
| Nested: `f(s)` calls `g(s2)` | 4 bytes |
| Deep: `f → g → h`, all with struct params | 6 bytes |

### 4.4 Budget Exceeded

If total ZP allocation exceeds the platform budget → E10032.

---

## 5. Hardware Stack Usage

### 5.1 Stack Purpose

In Blend65, the hardware stack uses the selected profile's proven-writable part of page one
(normally `$0100`–`$01FF`; `$0140`–`$01FF` on Atari 7800). It is used for:
- **Return addresses** — 2 bytes per active `JSR` (function call)
- **Interrupt context** — 3 bytes CPU push (P, PCL, PCH) + 3 bytes register save (A, X, Y)
- **Source status saves** — each live `asm_php()` contributes one byte until its matching
  `asm_plp()`

Parameters, locals, and return values **never** touch the hardware stack.

### 5.2 Stack Budget

The platform profile supplies raw stack capacity and bytes reserved for firmware/platform use. The
compiler derives usable capacity and computes the worst simultaneous peak across the call graph,
interrupt/preemption graph, and explicit stack deltas:

```
Stack budget (C64 example):
  256 bytes total
  - 20 bytes KERNAL reserve
  = 236 bytes available to Blend65 execution

One possible simultaneous path:
  24 bytes main call chain
   6 bytes IRQ entry
   8 bytes IRQ call chain
   2 bytes explicit pushes
  = 40 bytes peak
```

The six-byte entry is charged once for every interrupt entry that can be live simultaneously; it is
not pre-subtracted as a single fixed allowance. `asm_cli()` and platform non-maskable sources affect
which entries can overlap. An unbounded re-entry path is rejected with E10245. A finite peak beyond
capacity is E10238. Source status-stack analysis tracks relative depth. Pulls may not consume
pre-entry state; joins and loop backedges require identical depths; all exits must restore the empty
relative state (E10248). A status-save cycle whose depth grows without a static bound is E10245.

### 5.3 Stack Depth Warning

The profile's stack warning threshold is `warn_stack_peak` when present. When absent, it is 80% of
derived usable capacity (`stack_capacity - stack_reserve`), rounded down. The compiler emits W10180
when the proven simultaneous peak reaches or exceeds that threshold (→ Ch 06).

---

## 6. Build Summary

The compiler produces a **build summary** reporting all memory usage. This is critical for developers targeting constrained platforms.

```
=== Blend65 Build Summary ===
Platform: c64
Target: game.prg

Code segment:    1,248 bytes ($0801–$0CE0)
Data segment:      312 bytes ($0CE1–$0E18)  [const arrays, strings, embed data]
RAM variables:      89 bytes ($0E19–$0E71)
SFA frames:         47 bytes ($0E72–$0EA0)  [peak: 10 bytes simultaneous]

Zero page:
  User variables:   6 bytes
  Compiler temps:   4 bytes
  Struct pointers:  4 bytes
  IRQ temps:        2 bytes
  Total:           16 / 142 bytes (11%)

Hardware stack:
  Raw capacity:   256 bytes
  Platform reserve: 20 bytes
  Main calls:       8 bytes
  IRQ entry/calls: 14 bytes
  Explicit pushes:  2 bytes
  Total peak:      24 / 236 usable bytes (10%)

Startup routine:   42 bytes, 68 cycles

Emitted binary:  1,560 bytes ($0801–$0E18; excludes 2-byte PRG header)
Shared footprint: 1,696 bytes ($0801–$0EA0; includes trailing non-emitted BSS)
```

---

## 7. Memory Placement Summary

Cross-reference of where each language construct lives in memory:

| Construct | Segment | Size | Notes |
|-----------|---------|------|-------|
| Module-level `let` scalar | RAM | 1–2 bytes | Initialized in startup |
| Module-level `let` array | RAM | N × element size | Initialized if has initializer |
| Module-level `let` struct | RAM | `sizeof(Type)` | Initialized if has initializer |
| Module-level `const` scalar | Inlined | 0 bytes | Replaced by literal at use site |
| Module-level `const` array | Data | N × element size | Baked into binary |
| Module-level `const` struct | Data | `sizeof(Type)` | Baked into binary |
| Placed scalar `const` | Data | Scalar width | Materialized because `place(...)` gives it an address |
| `loadable const` | Package only | 0 resident bytes | Exact logical bytes are transported only for a reachable selected-profile load |
| `zeropage` variable | Zero page | 1–2 bytes | Fast access |
| Function parameter (scalar) | SFA frame | 1–2 bytes | Caller writes before JSR |
| Function parameter (struct/exact array) | SFA frame | 2 bytes | Base address pointer |
| Function parameter (any-size array) | SFA frame | 4 bytes | Base address pointer + word element count |
| Function local (scalar) | SFA frame | 1–2 bytes | — |
| Function local (array) | SFA frame | N × element size | — |
| Scalar or enum return value | CPU registers | 0 bytes RAM | A or A/X |
| Fixed aggregate return value | Caller-owned storage | `sizeof(Type)` in its owning object or SFA temporary | Constructed directly or copied with source-value semantics |
| Materialized aggregate-return destination address | SFA frame | 2 bytes when not encoded by a fixed-address variant | Compiler-managed; never a source parameter |
| Return address | Hardware stack | 2 bytes | Per active call |
| `embed()` data | Data | File size | Baked into binary |
| Load destination | Its ordinary mutable segment/home | Exact fixed logical size | Existing storage; a load allocates no second buffer |

---

## 8. Diagnostic Conditions

This chapter owns resource and allocation predicates; Chapter 14 owns their canonical presentation.

| Code | Trigger | Rejected behavior or consequence |
|------|---------|----------------------------------|
| E10032 | Static zero-page placement exceeds the selected profile's allocatable range. | Placement fails. |
| E10034 | The final output binary exceeds the selected platform's binary-size limit. | Artifact emission fails. |
| E10238 | RAM, data, array, frame, or another target resource exceeds its selected-profile budget. | The named resource cannot be placed. |
| E10245 | A storage-bearing execution path or hardware-stack path can overlap itself without a static bound. | SFA/stack analysis cannot prove a finite peak. |
| E10248 | A source status-save path pops above function entry, joins unequal depths, or exits with a nonempty relative state. | Safe deterministic `RTS`/`RTI` state cannot be preserved. |
| E10260 | A local-origin address or derived fragment may remain observable after its local's dynamic source lifetime. | SFA cannot safely reuse the home, so the escaping use is rejected rather than pinned. |
| E10272 | A `place(...)` clause has an illegal owner, key, duplicate key, value, or region. | The declaration is rejected before layout. |
| E10273 | The intersection of explicit and automatic placement constraints is empty. | Layout fails; no requirement is weakened and no copy is introduced. |
| E10275 | A load destination cannot prove one complete compatible mutable range for every possible selection. | The load call is rejected before emission. |
| E10276 | A read is not definitely initialized on every path or cannot must-alias the successful captured range it relies on. | The read is rejected without adding target state. |

### Warning Conditions

| Code | Trigger | Consequence |
|------|---------|-------------|
| W10180 | Proven hardware-stack peak crosses the selected profile's warning threshold. | Compilation continues with the measured peak. |
| W10030 | Zero-page use reaches `warn_zp_percent`, or 75% of `max_zp` when omitted. | Compilation continues with the measured placement. |
| W10033 | RAM use reaches `warn_ram_percent`, or 75% of `max_ram` when omitted. | Compilation continues with the measured placement. |
