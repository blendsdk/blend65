# RD-05: SFA Frame Planner & Zero-Page Allocator

> **Status**: 🟢 Authored
> **MVP Phase**: A
> **Depends On**: RD-04
> **Implements**: `spec-v3.0` Ch 11 (Memory Model & Static Frame Allocation), Ch 06
>   §5–§7 (SFA calling convention, interrupt frames, ZP temp space); Ch 14 §2–§3
>   (resource-limit diagnostics); evaluations F005, F018, F019
> **Owning package(s)**: `@blend65/frontend` (SFA planner, ZP allocator, stack-depth
>   analyzer — last stage of the error-tolerant front-end pipeline)
> **Created**: 2026-05-31
> **Last Updated**: 2026-05-31

---

## 1. Purpose

This document specifies the **SFA Frame Planner** and **Zero-Page Allocator** — the
final stage of the Blend65 front-end pipeline that transforms the `SemanticModel`
(produced by RD-04) into a concrete memory plan: every function's parameters and locals
are assigned to a fixed RAM address, every zero-page variable is placed, compiler temps
are budgeted, and stack depth is verified. The output is an `AllocationPlan` consumed
by IL lowering (RD-06) and ultimately by codegen (RD-07) and the ACME emitter (RD-09).

Static Frame Allocation is the defining memory model of Blend65 (Ch 11). Because there
is no heap, no recursion, and no dynamic allocation, the compiler can compute the
**exact** memory layout at compile time. The frame planner exploits this by applying
**frame coloring** — functions with non-overlapping lifetimes share frame memory,
typically saving 30–60% of total frame space (Ch 11 §3.4, illustrative, not
contractual — AR-87).

The SFA planner is the last front-end phase and the first phase that produces **hard
addresses**. Per AR-66, the SFA allocator owns the exact ZP and frame addresses,
materialized as ACME symbol definitions (`__frame_fn = $XXXX`, `__zp_c = $XX`). Code
and data labels remain symbolic — ACME places those via `* = $XXXX` origins (AR-66).

Per the walking-skeleton methodology (AR-38), the SFA planner comes online in **slice 2**
of Phase A (AR-43): the MVP gate program (`poke` a constant) needs zero frames/ZP; the
second slice adds a local `byte`, forcing the frame planner and ZP allocator online.

---

## 2. Scope

**In scope:**

- Frame computation: calculate frame size per function (parameters + locals)
- Call-graph consumption: use the call graph from RD-04 to derive frame lifetimes
- Frame coloring algorithm: interference-graph coloring for frame-memory sharing (AR-87)
- Interrupt-handler frame isolation: always-live, never coalesced, separate ZP/temp pool (AR-88)
- Escape-set insurance: address-taken functions pinned, never coalesced (AR-93/FUT-003)
- Frame-region layout: place all frames in a contiguous RAM region within the platform's RAM budget
- Zero-page allocation: place `zeropage` variables, compiler temps, struct/array pointers, IRQ temps (Ch 11 §4)
- ZP sharing: reuse ZP pointer bytes between non-overlapping-lifetime functions (AR-90)
- Stack-depth analysis: compute worst-case hardware stack usage from call graph
- Budget checking: emit E10032 (ZP exceeded), E10033 (RAM exceeded) **pre-ACME** (AR-81)
- Budget warnings: emit W10030 (large ZP), W10033 (RAM nearing limit), W10180 (stack depth near limit)
- Address realization: produce ACME symbol definitions for all SFA-owned addresses (AR-66)
- `AllocationPlan` output record: consumed by RD-06 (IL), RD-07 (codegen), RD-09 (emitter), RD-11 (resource reporter)
- Resource data contribution: frame-region + peak-simultaneous + ZP allocation + stack depth → `ResourceReport` (AR-79/80)

**Out of scope (and where it lives instead):**

- Call-graph construction and recursion detection → RD-04 (semantic analysis)
- Code and data segment placement (function code addresses, const data) → RD-09 (ACME emitter via `* = $XXXX`)
- Platform profile definition (RAM range, ZP range, stack budget) → RD-10 (platform plugins)
- IL representation and lowering → RD-06
- Resource report aggregation and rendering → RD-11
- Module-level variable placement (non-frame RAM) → handled here for address assignment, but variable semantics are in RD-04
- Virtual temp → register binding (A/X/Y + ZP-scratch) → RD-07 codegen (AR-47)

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, or the frozen spec section
> it implements. No decision may be invented here — discovery is closed.

---

## 3. Decisions & Requirements

### 3.1 Frame Computation

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | Every function (regular + interrupt) has a frame | The planner computes a `FunctionFrame` for each function: ordered list of slots (parameters first, then locals), each with name, type, and byte size | Ch 11 §3.1, Ch 06 §5.2 |
| R2 | Frame slot sizes follow the type-size table | `byte`/`sbyte`/`boolean` = 1 byte; `word`/`sword` = 2 bytes; enum = 1 byte; struct param (by-ref) = 2 bytes (pointer); array param (by-ref) = 2 bytes (pointer); struct local = `sizeof(type)`; array local = element size × count | Ch 11 §3.3, Ch 06 §5.3 |
| R3 | Frame size is the sum of all slot sizes | No alignment, no padding — 6502 has no alignment requirements | Ch 11 §3.1 |
| R4 | Functions with empty frames (no params, no locals) have frame size 0 | A zero-size frame consumes no RAM; the function still exists in the call graph | Ch 11 §3.1 |
| R5 | `main()` has a frame like any other function | `main()` follows all function rules (Ch 06 §11); its frame holds any locals declared in its body | Ch 06 §11 |
| R6 | Parameters are laid out before locals in the frame | Parameters occupy the first N bytes, then locals follow, preserving declaration order within each group | Ch 06 §5.2 |

### 3.2 Call-Graph Consumption

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R7 | The planner consumes the call graph from RD-04's `SemanticModel` | The call graph is complete: every function-level call is an edge; FN-12 guarantees functions are not values; no indirect calls in v3 | Ch 06 FN-12, AR-87 |
| R8 | Recursion has already been rejected | The call graph is acyclic — DFS cycle detection ran in RD-04 (E10180/E10181). The planner may assert acyclicity but must not re-detect | RD-04 R84–R87 |
| R9 | Address-taken functions are tracked | Functions marked as address-taken (via `&functionName`) are included in the planner's "escape set" (AR-93) | Ch 06 §8, AR-93 |

### 3.3 Frame Coloring

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R10 | Frame coloring shares memory between non-overlapping-lifetime functions | Two functions have non-overlapping lifetimes if neither is on the other's call path (no ancestor-descendant relationship in the call tree) | Ch 11 §3.4, AR-87 |
| R11 | The coloring algorithm uses interference-graph construction | Build an interference graph where each function is a node; add an edge between two functions if they can be simultaneously active (one is an ancestor of the other in any call path). Functions that interfere cannot share frame memory | AR-87 |
| R12 | Graph coloring assigns frame offsets | Each function receives a frame offset within the frame region. Non-interfering functions may receive overlapping offsets. The algorithm minimizes the total frame-region size | AR-87 |
| R13 | `main()` is always live | `main()` is the root of the call tree; its frame interferes with every other function's frame (it is an ancestor of all reachable functions) | Ch 11 §3.4 |
| R14 | Interrupt-handler frames are always-live | Interrupt functions fire asynchronously; their frames are modeled as live throughout the entire program execution. They interfere with every other function (including `main()` and each other) and never coalesce | AR-88, Ch 06 §7.5 |
| R15 | Escape-set functions are pinned (never coalesced) | Functions in the escape set (address-taken via `&`) are treated as always-live — their frames interfere with all other frames. This is the FUT-003 insurance: when typed function pointers land, the coloring algorithm already handles indirect-call targets conservatively | AR-93 |
| R16 | The v3 escape set contains only address-taken functions | In v3, no indirect calls exist (FN-12). The escape set comprises functions whose address is taken via `&`. If the address is only used for interrupt-vector installation, the function is already always-live via R14; otherwise, the function is pinned by R15 | AR-93, Ch 06 FN-12 |
| R17 | Unreachable functions are excluded from coloring | Functions that are never called, not exported, and not address-taken are dead code. They receive no frame allocation and no frame offset. (They may trigger W10181 — unused function warning — per Ch 06) | Ch 06 W10181 |
| R18 | Frame coloring is deterministic | Given the same call graph and frame sizes, the coloring algorithm must produce the same frame layout every time. This is required for golden-snapshot testing (AR-22) and H5 (fully deterministic) | H5, AR-22 |

### 3.4 Frame-Region Layout

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R19 | All SFA frames are placed in a contiguous frame region | The frame region starts at a base address within the platform's RAM segment (after module-level variables) and extends for `frameRegionSize` bytes | Ch 11 §3.5 |
| R20 | The frame-region base address is determined by the platform profile | The platform profile declares the RAM segment start and end. Module-level `let` variables are placed first (in declaration order), then the frame region follows | Ch 11 §2, Ch 15 |
| R21 | The frame-region size is the coloring result | The total frame-region size equals the peak simultaneous frame footprint as determined by the coloring algorithm — the minimum region that accommodates all simultaneously-live frames | AR-87, AR-92 |
| R22 | Peak simultaneous usage is a derived artifact | The peak is the coloring's max simultaneous live-frame footprint, not a separate algorithm. It equals the frame-region size | AR-92 |
| R23 | Each function's absolute frame address = frame-region base + frame offset | The planner computes a symbolic frame address for each function. At ACME emission time, this becomes an ACME symbol definition (AR-66) | AR-66 |

### 3.5 Module-Level Variable Placement

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R24 | Module-level `let` variables are placed in the RAM segment | Each module-level `let` variable gets a fixed RAM address, allocated sequentially in declaration order per module, in module initialization order (AR-91) | Ch 11 §7 |
| R25 | Module-level `const` scalars are inlined, not placed | Const scalars are replaced by their literal value at each use site; they consume 0 bytes of RAM | Ch 11 §7 |
| R26 | Module-level `const` arrays and `const` structs are placed in the Data segment | Const aggregates are baked into the binary in the Data segment | Ch 11 §7 |
| R27 | `zeropage` variables are placed by the ZP allocator (§3.6) | `zeropage` declared variables are not placed in the RAM segment — they go to the ZP allocator | Ch 11 §4, Ch 03 |

### 3.6 Zero-Page Allocation

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R28 | The platform profile defines the available ZP range | The ZP range is a set of byte addresses within $00–$FF that the platform makes available to Blend65 (e.g., C64: $02–$2F = 46 bytes) | Ch 11 §4.1, Ch 15 |
| R29 | ZP allocation follows the priority order from Ch 11 §4.2 | Priority: (1) user-declared `zeropage` variables, (2) struct/array pointers (2 bytes per active by-ref parameter level), (3) expression evaluation temps, (4) interrupt handler temps (separate pool) | Ch 11 §4.2, AR-90 |
| R30 | User `zeropage` variables are placed first | Each `zeropage`-declared variable is placed at a specific ZP address. If total user ZP exceeds the budget, emit E10032 | Ch 11 §4.2 |
| R31 | Struct/array pointer bytes are shared using frame-coloring lifetimes | ZP pointer bytes for by-ref parameters are shared between functions with non-overlapping lifetimes, reusing the AR-87 interference graph. Sequential calls share; nested calls accumulate | Ch 11 §4.3, AR-90 |
| R32 | Peak ZP pointer bytes are computed from the call graph | The worst-case simultaneous ZP pointer usage equals the deepest nesting of functions-with-by-ref-params on any call path, times 2 bytes each | Ch 11 §4.3 |
| R33 | Expression evaluation temps are allocated as a fixed pool | The compiler allocates a small number of ZP bytes for expression evaluation scratch space. The exact count depends on the most complex expression in the main code path; typically 2–4 bytes | Ch 11 §4.1 |
| R34 | Interrupt handler temps are a separate pool | Interrupt handlers get their own ZP temp bytes, distinct from the main-path temps. This prevents corruption when an interrupt fires during main-path expression evaluation | Ch 11 §4.1, Ch 06 §7.6, AR-88 |
| R35 | ZP budget overflow is a compile-time error | If total ZP allocation (user vars + pointers + temps + IRQ temps) exceeds the platform's ZP budget → E10032 | Ch 11 §4.4 |
| R36 | ZP allocation is deterministic | Same input → same ZP layout, for golden-snapshot testing | H5, AR-22 |

### 3.7 Stack-Depth Analysis

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R37 | The planner computes worst-case hardware stack depth from the call graph | Each function call consumes 2 bytes of hardware stack (JSR return address). The worst-case stack depth is the longest call chain in the call graph times 2 | Ch 11 §5, Ch 06 §5.5 |
| R38 | Interrupt overhead is added to the stack budget | Each interrupt entry adds 6 bytes (3 CPU push + 3 register save). If the interrupt handler calls functions, those add 2 bytes each. The worst case is: main-path depth + interrupt entry + interrupt-handler depth | Ch 06 §7.8 |
| R39 | The platform profile defines the stack budget | The profile declares total hardware stack (256 bytes) minus platform reserves (e.g., C64: 20 bytes KERNAL reserve → 236 available; or 230 as in the Ch 11 example) | Ch 11 §5.2 |
| R40 | Stack depth near limit emits W10180 | If worst-case stack usage exceeds a platform-defined warning threshold (e.g., 75% of budget), emit W10180 | Ch 06 W10180, Ch 11 §5.3 |

### 3.8 Budget Diagnostics

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R41 | ZP budget exceeded → E10032 (pre-ACME) | Emitted by the SFA planner before `.asm` generation. User errors never first surface at the ACME stage (AR-68) | Ch 11 §8, Ch 14 E10032, AR-81 |
| R42 | RAM budget exceeded → E10033 (pre-ACME) | Total RAM usage (module-level variables + frame region) checked against the platform's RAM budget before `.asm` generation | Ch 11 §8, Ch 14 E10033, AR-81 |
| R43 | Large ZP allocation → W10030 | Emitted when ZP usage exceeds a configurable threshold (e.g., 80% of budget) | Ch 14 W10030, AR-85 |
| R44 | RAM nearing limit → W10033 | Emitted when RAM usage exceeds a configurable threshold (e.g., 90% of budget) | Ch 14 W10033, AR-85 |
| R45 | Stack depth near limit → W10180 | Emitted when worst-case stack usage exceeds a configurable threshold | Ch 06 W10180, AR-85 |
| R46 | All budget diagnostics flow through DiagnosticBag | Budget errors and warnings are appended to the same `DiagnosticBag` (AR-73) used by lexer/parser/semantic. The central severity-policy layer (AR-75) can promote warnings to errors | AR-73, AR-75 |

### 3.9 Address Realization

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R47 | SFA-owned addresses are materialized as ACME symbol definitions | The planner produces a list of ACME symbol definitions: `__frame_<fn> = $XXXX` for each function's frame base, `__zp_<name> = $XX` for each ZP allocation, `__var_<module>_<name> = $XXXX` for each module-level variable | AR-66 |
| R48 | Operands in generated code reference symbolic names, not hard addresses | Codegen (RD-07) uses the symbolic names (`__frame_<fn>`, `__zp_<name>`) in `Instr` operands. ACME substitutes the values from the symbol definitions | AR-66, AR-56 |
| R49 | Code and data labels are NOT assigned by the SFA planner | Function code addresses and data block addresses are placed by ACME via `* = $XXXX` origins and label resolution. The SFA planner only owns ZP, frame, and module-variable addresses | AR-66 |
| R50 | Symbol definitions appear at the top of the emitted `.asm` file | The ACME emitter (RD-09) emits all SFA symbol definitions before any code/data segments, so all symbols are resolved when ACME processes the code | AR-66, AR-63 |

### 3.10 AllocationPlan Output

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R51 | The planner produces an `AllocationPlan` record | This is the planner's single output artifact, consumed by downstream phases | AR-66, AR-80 |
| R52 | The `AllocationPlan` contains frame allocations | For each function: frame base offset, frame size, list of named slots with offsets and types | Ch 11 §3 |
| R53 | The `AllocationPlan` contains ZP allocations | For each ZP allocation: address, name, size, category (user-var / pointer / temp / irq-temp) | Ch 11 §4 |
| R54 | The `AllocationPlan` contains module-variable allocations | For each module-level `let` variable: address, name, type, size, module | Ch 11 §7 |
| R55 | The `AllocationPlan` contains stack-depth analysis results | Worst-case main-path depth, worst-case interrupt depth, total worst-case, platform budget | Ch 11 §5 |
| R56 | The `AllocationPlan` contains the frame-region summary | Frame-region base address, frame-region size (= peak simultaneous), number of functions colored, sharing savings | Ch 11 §3.5, AR-92 |
| R57 | The `AllocationPlan` contains ACME symbol definitions | The complete list of symbol definitions to be emitted at the top of the `.asm` file | AR-66 |
| R58 | The `AllocationPlan` contains resource-report data | Pre-computed numbers for the `ResourceReport`: frame-region bytes, ZP bytes used/budget, stack depth/budget, RAM bytes used/budget. These feed RD-11's aggregator (AR-79/80) | AR-79, AR-80, AR-84 |
| R59 | The `AllocationPlan` is immutable once produced | Downstream phases read the plan; they do not modify it | Design principle |

### 3.11 Error Tolerance

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R60 | The planner runs even when `SemanticModel.hasErrors` is true | For LSP/editor support, the planner should produce a best-effort `AllocationPlan` even from an incomplete semantic model. Functions with error types or unresolved symbols get empty frames | AR-15 |
| R61 | Missing or unresolvable functions are skipped | If the call graph contains error nodes, the planner skips them without crashing. Diagnostics from earlier phases already cover the root cause | AR-15, AR-74 |
| R62 | Budget diagnostics are suppressed if upstream errors exist | If the semantic model has errors, budget warnings/errors are suppressed — the numbers are unreliable and would confuse the developer | AR-74 (cascade suppression) |

---

## 4. Design Detail

### 4.1 Planner Pipeline

The SFA planner runs as a single pass after semantic analysis, consuming the `SemanticModel` and the platform profile:

```
SemanticModel + PlatformProfile
  │
  ├─ 1. Frame Computation ──────── compute FunctionFrame per function
  │
  ├─ 2. Interference Graph ─────── build from call graph + interrupt/escape sets
  │
  ├─ 3. Frame Coloring ─────────── assign frame offsets, minimize region
  │
  ├─ 4. Module Variable Layout ── sequential placement in RAM
  │
  ├─ 5. Frame Region Layout ───── place frame region after module variables
  │
  ├─ 6. Zero-Page Allocation ──── priority-ordered ZP placement
  │
  ├─ 7. Stack-Depth Analysis ──── worst-case from call graph
  │
  ├─ 8. Budget Checking ────────── E10032, E10033, W10030, W10033, W10180
  │
  └─ 9. Emit AllocationPlan ───── package all results
```

### 4.2 FunctionFrame Record

```typescript
interface FrameSlot {
  name: string;               // parameter or local variable name
  kind: 'parameter' | 'local';
  type: Type;                 // from RD-04 type representation
  size: number;               // byte count (1 or 2 for scalars; sizeof for structs; N*elem for arrays)
  offset: number;             // offset within the frame (bytes from frame base)
}

interface FunctionFrame {
  functionName: string;       // fully qualified: module.function
  slots: FrameSlot[];         // parameters first, then locals, in declaration order
  totalSize: number;          // sum of all slot sizes
  isInterrupt: boolean;       // true for interrupt functions
  isEscaped: boolean;         // true if address-taken (&functionName)
  isReachable: boolean;       // true if called, exported, or address-taken
}
```

**Size computation per type** (from Ch 11 §3.3):

| Type | As Parameter | As Local |
|------|-------------|----------|
| `byte` / `sbyte` / `boolean` | 1 byte | 1 byte |
| `word` / `sword` | 2 bytes | 2 bytes |
| enum | 1 byte | 1 byte |
| struct `T` | 2 bytes (pointer) | `sizeof(T)` |
| array `T[N]` | 2 bytes (pointer) | `sizeof(element) × N` |

### 4.3 Interference Graph

The interference graph determines which functions' frames must be allocated at non-overlapping addresses.

```typescript
interface InterferenceGraph {
  nodes: Set<string>;                    // function names
  edges: Set<[string, string]>;          // pairs that interfere (cannot share)
}
```

**Construction algorithm:**

1. **Call-tree edges**: For every call edge `A → B` in the call graph, `A` and `B` interfere (they are simultaneously active). Transitively, if `A → B → C`, then `A` interferes with both `B` and `C` (ancestor-descendant pairs all interfere).

2. **Always-live nodes**: Interrupt functions (R14) and escape-set functions (R15) are connected to **all** other nodes — they interfere with everything.

3. **Concrete algorithm** (ancestor enumeration via DFS):
   ```
   for each function F in the call graph:
     walk the call graph upward from F to all ancestors
     add an interference edge between F and each ancestor

   for each always-live function L (interrupt or escaped):
     add an interference edge between L and every other function
   ```

4. **Unreachable functions** (R17) are not added to the interference graph.

### 4.4 Frame Coloring Algorithm

The coloring algorithm assigns a frame offset to each function such that interfering functions have non-overlapping frame regions, and the total frame-region size is minimized.

This is equivalent to the **interval graph coloring** / **register allocation** problem. Because the interference graph derived from a call tree is a **chordal graph** (perfect elimination order exists), optimal coloring can be done in polynomial time.

**Algorithm: Greedy coloring with ordering**

```
Input:  InterferenceGraph, FunctionFrame[] (with sizes)
Output: Map<functionName, frameOffset>

1. Order functions by frame size descending (largest first — heuristic for tighter packing)
   Break ties by function name (determinism, R18)

2. For each function F in order:
   a. Collect the frame offsets + sizes of all neighbors of F in the interference graph
      (these are the "occupied intervals")
   b. Find the smallest offset O ≥ 0 such that [O, O + F.totalSize) does not overlap
      any occupied interval
   c. Assign F.frameOffset = O

3. frameRegionSize = max(F.frameOffset + F.totalSize) over all assigned functions
```

**Properties:**
- Deterministic (R18): same ordering → same result
- Polynomial: O(N²) where N = number of functions (practical N < 100 for 6502 programs)
- Sound: interfering functions never overlap
- Near-optimal for chordal graphs from call trees

**Example** (from Ch 11 §3.4):
```
Call graph: main → init, update, render
            update → handleInput, moveEnemies
            render → drawBackground, drawSprites

Interference edges (ancestor-descendant pairs only):
  main ↔ {init, update, render, handleInput, moveEnemies, drawBackground, drawSprites}
  update ↔ {handleInput, moveEnemies}
  render ↔ {drawBackground, drawSprites}

Non-interfering pairs (sequential siblings / different subtrees):
  init ↔ update ↔ render     — sequential under main, never simultaneously active
  handleInput ↔ drawSprites  — different subtrees, never simultaneously active
  moveEnemies ↔ drawBackground — different subtrees

Result: init, update, and render can share frame memory with each other.
        handleInput and drawSprites can share frame memory with each other.
        moveEnemies and drawBackground can share frame memory with each other.
```

### 4.5 Module-Variable Layout

Module-level `let` variables are placed sequentially in RAM:

```
Input:  SemanticModel.moduleVariables (in initialization order per AR-91)
        PlatformProfile.ramStart, PlatformProfile.ramEnd
Output: Map<variableName, ramAddress>

1. currentAddress = PlatformProfile.ramStart (or after code/data segments — 
   see note below)
2. For each module in initialization order:
     For each `let` variable in declaration order:
       assign variable.address = currentAddress
       currentAddress += variable.size
3. ramVariablesEnd = currentAddress
```

> **Note**: The exact placement of RAM variables relative to code and data segments
> depends on the platform plugin's segment ordering. The C64 plugin uses the order:
> code → const-data → mutable variables → SFA frames (AR-64). The planner computes
> sizes and relative offsets; the absolute base address is provided by the platform
> profile or computed after code/data size is known (post-ACME via the label file,
> AR-67). For pre-ACME budget checking (AR-81), the planner uses the **sum of sizes**
> against the platform's total RAM budget — absolute addresses are finalized at emit
> time.

### 4.6 Frame Region Placement

```
frameRegionBase = ramVariablesEnd   (immediately after module-level variables)
frameRegionEnd  = frameRegionBase + frameRegionSize

For each function F with a frame:
  F.absoluteAddress = frameRegionBase + F.frameOffset
```

### 4.7 Zero-Page Allocation Algorithm

ZP allocation follows the priority order (Ch 11 §4.2, AR-90):

```
Input:  SemanticModel (zeropage variables, function signatures)
        InterferenceGraph (from §4.3, reused for ZP pointer sharing)
        PlatformProfile.zpStart, PlatformProfile.zpEnd
Output: ZpAllocation[]

zpCursor = PlatformProfile.zpStart

// Priority 1: User-declared zeropage variables
for each zeropage variable in declaration order:
  assign zpAddress = zpCursor
  zpCursor += variable.size
  if zpCursor > zpEnd: emit E10032, stop ZP allocation

// Priority 2: Struct/array pointer bytes
// Compute peak pointer usage from the call graph:
//   - For each call path, count the number of active by-ref parameters
//   - The deepest nesting of by-ref params on any path = peak pointers
//   - Each pointer = 2 bytes
peakPointers = computePeakPointers(callGraph)
for i in 0..peakPointers:
  assign zpAddress = zpCursor (2 bytes per pointer)
  zpCursor += 2
  if zpCursor > zpEnd: emit E10032

// Priority 3: Expression evaluation temps (main path)
mainTempCount = computeMainTempNeed(semanticModel)
for i in 0..mainTempCount:
  assign zpAddress = zpCursor
  zpCursor += 1
  if zpCursor > zpEnd: emit E10032

// Priority 4: Interrupt handler temps (separate pool)
irqTempCount = computeIrqTempNeed(semanticModel)
for i in 0..irqTempCount:
  assign zpAddress = zpCursor
  zpCursor += 1
  if zpCursor > zpEnd: emit E10032

totalZpUsed = zpCursor - zpStart
```

**Pointer sharing** (R31): ZP pointer slots are shared between functions with non-overlapping lifetimes. The planner reuses the interference graph from §4.3:

```
Sequential calls: f(structA); g(structB);
  → f and g don't interfere → share the same 2-byte ZP pointer slot
  → total: 2 bytes

Nested calls: f(structA) internally calls g(structB)
  → f and g interfere → separate ZP pointer slots
  → total: 4 bytes

Deepest nesting determines peak:
  main → f(struct) → g(struct) → h(struct)
  → 3 levels of nesting × 2 bytes = 6 bytes of ZP pointers
```

### 4.8 Expression Temp Estimation

The compiler needs ZP scratch bytes for evaluating complex expressions (e.g., intermediate results in 16-bit arithmetic, address calculations). The exact temp count is determined by analyzing the expression complexity in the program.

**Baseline estimation:**
- Walk all expressions in all function bodies
- For each expression tree, compute the minimum number of simultaneous temps needed
  (this is the Sethi-Ullman register count, adapted for our ZP use)
- The program-wide peak is the maximum across all expressions on the main path
- Interrupt expressions are counted separately (R34)

**Typical values:**
| Expression Complexity | Temps Needed |
|----------------------|--------------|
| Simple: `a + b` | 0 (uses A register directly) |
| Medium: `a + b * c` (with 16-bit intermediate) | 2 bytes |
| Complex: `(a + b) * (c + d)` (16-bit) | 4 bytes |

> **Refinement**: The exact temp-estimation algorithm will be refined when IL lowering
> (RD-06) and codegen (RD-07) are authored, since those phases determine the actual
> temp demand. For RD-05, the planner reserves a **configurable** number of ZP temp
> bytes (default: 4 for main, 2 for IRQ) that can be tuned per platform profile.

### 4.9 Stack-Depth Analysis

```typescript
interface StackAnalysis {
  maxMainDepth: number;      // deepest call chain in the main code path (in call levels)
  maxMainStackBytes: number; // maxMainDepth × 2
  maxIrqDepth: number;       // deepest call chain within any interrupt handler
  maxIrqStackBytes: number;  // maxIrqDepth × 2
  irqOverhead: number;       // 6 bytes per interrupt handler (3 CPU + 3 register save)
  totalWorstCase: number;    // maxMainStackBytes + irqOverhead + maxIrqStackBytes
  platformBudget: number;    // from platform profile (256 - platform reserve)
  exceedsWarningThreshold: boolean;
}
```

**Algorithm:**

```
1. Find the longest path from main() in the call graph (DFS, tracking depth)
   maxMainDepth = length of longest path

2. For each interrupt function:
   Find the longest path from that interrupt function in the call graph
   irqPathDepth = length of longest path
   maxIrqDepth = max(maxIrqDepth, irqPathDepth)

3. Compute:
   maxMainStackBytes = maxMainDepth × 2
   irqOverhead = (number of interrupt functions > 0) ? 6 : 0
   maxIrqStackBytes = maxIrqDepth × 2
   totalWorstCase = maxMainStackBytes + irqOverhead + maxIrqStackBytes

4. Compare against platformBudget:
   if totalWorstCase >= platformBudget × warningThreshold → emit W10180
```

### 4.10 AllocationPlan Interface

```typescript
interface AllocationPlan {
  // Frame allocations
  frames: Map<string, FrameAllocation>;   // functionName → allocation
  frameRegionBase: number;                // absolute RAM address
  frameRegionSize: number;                // total bytes
  peakSimultaneous: number;               // = frameRegionSize (derived, AR-92)
  sharingSaved: number;                   // sum of all frame sizes minus frameRegionSize

  // Zero-page allocations
  zpAllocations: ZpAllocation[];          // ordered list
  zpUsed: number;                         // total ZP bytes used
  zpBudget: number;                       // from platform profile

  // Module-level variables
  moduleVariables: ModuleVariableAllocation[];
  moduleVariablesSize: number;            // total bytes

  // Stack analysis
  stackAnalysis: StackAnalysis;

  // ACME symbol definitions (AR-66)
  symbolDefinitions: SymbolDefinition[];  // name → address pairs for .asm header

  // Resource report data (AR-79/80)
  resourceData: SfaResourceData;

  // Diagnostic state
  hasErrors: boolean;                     // true if E10032 or E10033 was emitted
}

interface FrameAllocation {
  functionName: string;
  frame: FunctionFrame;
  offset: number;              // offset within frame region
  absoluteAddress: number;     // frameRegionBase + offset
}

interface ZpAllocation {
  name: string;                // variable name or "__ptr_N" / "__temp_N" / "__irq_temp_N"
  address: number;             // $00–$FF
  size: number;                // bytes (1 or 2)
  category: 'user' | 'pointer' | 'temp' | 'irq-temp';
}

interface ModuleVariableAllocation {
  moduleName: string;
  variableName: string;
  address: number;
  size: number;
  type: Type;
}

interface SymbolDefinition {
  name: string;     // ACME symbol name (e.g., "__frame_Game_update")
  value: number;    // address value
}

interface SfaResourceData {
  frameRegionBytes: number;
  frameRegionPeak: number;
  frameSharingSaved: number;
  zpUsed: number;
  zpBudget: number;
  ramUsed: number;           // moduleVariablesSize + frameRegionSize
  ramBudget: number;
  stackWorstCase: number;
  stackBudget: number;
}
```

### 4.11 ACME Symbol Definition Naming

The planner generates deterministic, collision-free symbol names for ACME:

| Category | Pattern | Example |
|----------|---------|---------|
| Function frame base | `__frame_<Module>_<function>` | `__frame_Game_update` |
| Frame slot (param/local) | `__frame_<Module>_<function>_<slot>` | `__frame_Game_update_dx` |
| Module-level variable | `__var_<Module>_<name>` | `__var_Game_score` |
| ZP user variable | `__zp_<Module>_<name>` | `__zp_Irq_rasterLine` |
| ZP struct/array pointer | `__zp_ptr_<N>` | `__zp_ptr_0` |
| ZP main temp | `__zp_tmp_<N>` | `__zp_tmp_0` |
| ZP IRQ temp | `__zp_irq_tmp_<N>` | `__zp_irq_tmp_0` |

All names use only ASCII alphanumeric + underscore, starting with `__` to avoid
collision with user labels.

### 4.12 Public API

```typescript
/**
 * Run the SFA frame planner and ZP allocator.
 *
 * @param model     The semantic model from RD-04's analyze()
 * @param profile   The active platform profile (RD-10)
 * @param bag       DiagnosticBag for budget errors/warnings
 * @returns         The allocation plan (may be partial if errors exist)
 */
function planAllocation(
  model: SemanticModel,
  profile: PlatformProfile,
  bag: DiagnosticBag
): AllocationPlan;
```

This function lives in `@blend65/frontend` — it is the last stage of the error-tolerant
front-end pipeline, and must be accessible to both the CLI compiler and the language
server (AR-15/AR-20).

### 4.13 SFA Diagnostics

All diagnostics emitted by the SFA planner, with codes from Ch 14:

| Code | Severity | Condition | Message Template |
|------|----------|-----------|-----------------|
| E10032 | Error | ZP budget exceeded | `Zero-page budget exceeded — <used> bytes used, platform '<platform>' allows <budget> bytes` |
| E10033 | Error | RAM budget exceeded | `RAM usage (<used> bytes) exceeds platform '<platform>' available RAM (<budget> bytes)` |
| W10030 | Warning | Large ZP allocation | `Zeropage allocation uses <N> of <budget> bytes — consider total ZP budget` |
| W10033 | Warning | RAM nearing limit | `RAM usage is <percent>% of platform '<platform>' budget` |
| W10180 | Warning | Stack depth near limit | `Maximum stack depth is <N> bytes (<levels> call levels) on platform '<platform>' — stack budget is <budget> bytes` |

**Notes:**
- E10032 and E10033 are emitted **pre-ACME** (AR-81) — the build stops before `.asm` generation
- All warnings flow through the central severity-policy layer (AR-75) and can be promoted to errors via `--warn-as-error`
- Budget diagnostics carry source spans pointing to the declarations that contribute most to the budget (e.g., the largest `zeropage` variable for E10032)

---

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-01 | Package structure: SFA planner lives in `@blend65/frontend` |
| RD-04 | **Primary input**: consumes `SemanticModel` (call graph, symbol table, type information, const values). Must match `SemanticModel` interface exactly |
| RD-06 | **Primary consumer**: IL lowering consumes the `AllocationPlan` to resolve variable/param/local references to frame slot addresses. IL operands use the symbolic names from R47 |
| RD-07 | **Consumer**: 6502 codegen uses `AllocationPlan` for frame addresses in `Instr` operands, ZP pointer addresses for indirect addressing, and temp allocation |
| RD-09 | **Consumer**: ACME emitter uses `AllocationPlan.symbolDefinitions` to emit ACME symbol defs at file top. Also uses frame/ZP data for the build summary |
| RD-10 | **Input**: platform profile provides RAM range, ZP range, stack budget, segment ordering. The planner is platform-agnostic — all platform-specific data comes from the profile |
| RD-11 | **Data contributor**: `AllocationPlan.resourceData` feeds the `ResourceReport` aggregator. The planner owns frame-region, ZP, stack-depth, and RAM-variable numbers (AR-80) |
| RD-14 | **LSP support**: the planner runs in error-tolerant mode (R60–R62) so the language server can show partial allocation info even with errors |
| RD-17 | **Interaction**: intrinsic runtime routines (T3/T4) may consume ZP arg-block bytes. The ZP arg-block minimum is declared per platform profile (AR-34). The planner must reserve this block as part of ZP allocation |

---

## 6. Acceptance Criteria

- [ ] AC-01: `planAllocation()` accepts a `SemanticModel` and `PlatformProfile` and returns an `AllocationPlan`
- [ ] AC-02: Every function with parameters or locals gets a `FunctionFrame` with correct slot sizes per the Ch 11 §3.3 type-size table
- [ ] AC-03: Frame coloring produces non-overlapping allocations for interfering functions and overlapping allocations for non-interfering functions
- [ ] AC-04: Interrupt-handler frames never share memory with any other function's frame
- [ ] AC-05: Address-taken functions (escape set) never share memory with any other function's frame
- [ ] AC-06: The frame-region size equals the peak simultaneous frame footprint (not the sum of all frames)
- [ ] AC-07: Given the Ch 11 §3.4 example call graph, the planner demonstrably shares frames between `init`/`update`/`render` and between `handleInput`/`drawSprites`
- [ ] AC-08: `zeropage` variables are placed at valid ZP addresses within the platform's ZP range
- [ ] AC-09: ZP allocation follows the priority order: user vars → pointers → temps → IRQ temps
- [ ] AC-10: ZP pointer bytes are shared between non-overlapping-lifetime functions
- [ ] AC-11: E10032 is emitted when ZP allocation exceeds the platform budget
- [ ] AC-12: E10033 is emitted when RAM usage (module variables + frame region) exceeds the platform budget
- [ ] AC-13: W10180 is emitted when stack depth approaches the platform stack budget
- [ ] AC-14: Budget diagnostics (E10032, E10033) are emitted pre-ACME — before `.asm` generation
- [ ] AC-15: ACME symbol definitions are generated for all frame bases, frame slots, module variables, and ZP allocations
- [ ] AC-16: Symbol names are deterministic: same input → same symbol names and addresses
- [ ] AC-17: The planner runs without crashing when `SemanticModel.hasErrors` is true (error-tolerant mode)
- [ ] AC-18: `AllocationPlan.resourceData` contains all numbers needed by the `ResourceReport` for the SFA-owned columns
- [ ] AC-19: All decisions trace to an `AR-NN` or a frozen spec section
- [ ] AC-20: Unit tests cover frame computation, interference graph construction, frame coloring, ZP allocation, stack-depth analysis, and budget checking (AR-22 tier 1)
- [ ] AC-21: Golden-snapshot tests assert deterministic `AllocationPlan` output for a representative set of call graphs (AR-22 tier 2)

---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

1. **Expression temp count precision**: R33 and §4.8 acknowledge that the exact ZP temp
   requirement depends on IL lowering (RD-06) and codegen (RD-07), which are not yet
   authored. The current design uses a configurable default (4 main, 2 IRQ). This will
   be refined when RD-06/RD-07 are authored. No AR is needed — this is a refinement of
   an existing design, not a new ambiguity.

2. **RAM layout ordering**: §4.5 notes that the exact placement of module variables
   relative to code/data depends on the platform plugin's segment ordering (AR-64). The
   planner computes sizes for pre-ACME budget checking; absolute addresses may be
   finalized at emit time using the ACME label file (AR-67). This interaction will be
   detailed further in RD-09 and RD-10.

3. **ZP arg-block reservation**: AR-34 specifies that the platform profile declares a ZP
   arg-block size for runtime-routine ABI (AR-33). The planner must reserve this block.
   The exact minimum floor is deferred to RD-17 — the planner will read it from the
   platform profile.
