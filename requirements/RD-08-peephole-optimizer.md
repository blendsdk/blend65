# RD-08: Peephole Optimizer

> **Status**: 🟢 Authored
> **MVP Phase**: B (passthrough seam pulled into Phase A per `plans/ROADMAP.md`; the rule
>   catalog remains Phase B) — preflight resolution PF-008
> **Depends On**: RD-07

> **Implements**: Language Guard F3 (optimizer-friendly); pipeline position per
>   `README.md` §Compiler Pipeline ("Optimizer 2: peephole on Instr list, passthrough v1")
> **Owning package(s)**: `@blend65/codegen`
> **Created**: 2026-05-31
> **Last Updated**: 2026-06-10 (preflight iteration 2 — codebase-alignment corrections)

---

> **📌 Preflight alignment note (2026-06-10).** RD-08 was authored 2026-05-31, before the
> RD-07b/07c back end shipped. The preflight (`requirements/00-preflight-report.md`,
> PF-001..PF-009) realigned this RD with the shipped `Instr` model. The load-bearing
> corrections:
> - **v1 scope is THIN PASSTHROUGH** (keystone): v1 returns the program structurally
>   unchanged after a structural well-formedness check. The sliding-window **scanner**
>   (§4.3), its iteration limit + ICE (R18/R31), and rule plumbing are **NOT built in v1** —
>   they land with the first real rule (rules milestone). §4.3/§4.5/§4.6 are therefore
>   **Phase-B (rules-milestone) material**, retained here as forward design only.
> - **Public signature** (PF-001/003): `optimizeInstr(program, cpuVariant: CpuVariant, bag,
>   options?)` — a bare `CpuVariant` primitive (NOT a `PlatformProfile`), mirroring
>   `generateInstr`/`validateStream`. `rules` is an internal constant `V1_RULES = []`.
> - **CpuVariant** (PF-002): import the canonical `"nmos6502" | "wdc65c02"` from
>   `@blend65/core`; the 65C02 value is `"wdc65c02"` (NOT `'65c02'`).
> - **Preamble** (PF-004): `preamble` + `allocationPlan` pass through **verbatim**; only
>   `streams[].entries` are ever eligible.
> Where the detailed §4 text below still shows the pre-correction shapes, the banner and the
> inline ✅ notes are authoritative.

## 1. Purpose


This document specifies the **peephole optimizer** — the compiler stage that rewrites
short windows of the `Instr` stream into semantically equivalent but cheaper instruction
sequences. The peephole optimizer sits between codegen (RD-07) and the ACME emitter
(RD-09) in the pipeline.

In the v1 walking-skeleton (AR-38), the peephole optimizer is a **passthrough**: it
accepts an `InstrProgram` and returns it unchanged. This is deliberate — the codegen
(RD-07) produces correct code, and optimization is a Phase B concern. The v1
implementation establishes the infrastructure (rule interface, window scanning, safety
invariants) so that optimization rules can be added incrementally without architectural
changes.

---

## 2. Scope

**In scope:**

- Peephole optimizer pipeline position: consumes `InstrProgram` from RD-07, produces
  optimized `InstrProgram` for RD-09
- `PeepholeRule` interface: the contract for individual optimization rules
- Sliding-window pattern matcher over `StreamEntry[]` arrays
- Safety invariants: label preservation, directive preservation, CPU validity post-optimization
- v1 passthrough implementation (zero rules applied)
- Opt-in/opt-out mechanism via compiler flags (`--optimize` / `--no-optimize`)
- Catalog of planned future rules (specified but not implemented in v1)
- Diagnostic integration: optimization statistics and rule-application reporting

**Out of scope (and where it lives instead):**

- IL-level optimization (constant folding, dead code elimination) → RD-06
- `Instr` model definition (Opcode, AddressingMode, StreamEntry types) → RD-07
- Register binding strategy → RD-07 §4.4
- ACME serialization → RD-09
- Platform-specific optimization hooks → RD-10 (future consideration)

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, or the frozen spec section
> it implements. No decision may be invented here — discovery is closed.

---

## 3. Decisions & Requirements

### 3.1 Pipeline Position & Data Flow

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | Peephole operates on the `InstrProgram` output of codegen | Input: `InstrProgram` from `generateInstr()` (RD-07). Output: optimized `InstrProgram` with the same structure. The ACME emitter (RD-09) consumes the output | AR-50 |
| R2 | Peephole is the second and final optimization stage | Two optimization opportunities exist: IL-level (RD-06, passthrough v1) and Instr-level (this RD, passthrough v1). No other optimization stages exist | AR-50 |
| R3 | Peephole operates per-function on each `InstrStream` | Each `InstrStream` is optimized independently. Cross-function optimization is out of scope | AR-59 |
| R4 | The optimizer processes `StreamEntry[]` arrays | It scans over `Array<Instr | Label | Directive>`, matching patterns of consecutive `Instr` entries while respecting `Label` and `Directive` boundaries | AR-55 |

### 3.2 v1 Passthrough

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R5 | v1 implementation is an identity function | `optimizeInstr(program)` returns the input `InstrProgram` unchanged. This is the MVP-first approach — correctness before optimization | AR-38 |
| R6 | v1 passthrough still validates the contract | Even as a passthrough, the optimizer verifies that the input is a well-formed `InstrProgram` (non-null streams, valid structure). This catches integration bugs early | AR-38 |
| R7 | v1 emits no optimization diagnostics | Since no rules are applied, no optimization statistics are reported. The diagnostic infrastructure is established but silent | Design |

### 3.3 PeepholeRule Interface

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R8 | Each optimization is encapsulated as a `PeepholeRule` | A rule has a name, a window size (how many consecutive `Instr` entries it examines), a `match()` predicate, and a `replace()` function that produces the replacement entries | Design |
| R9 | Rules are pure functions | A rule's `match()` and `replace()` depend only on the window contents — no global state, no cross-function knowledge. This guarantees determinism (H5) | H5 |
| R10 | Rules produce fewer or equal `Instr` entries | A peephole rule never increases code size. The replacement sequence must be ≤ the matched window in both byte count and instruction count. This is a hard invariant | Language Guard F3 |
| R11 | Rules preserve semantics | A rule's replacement must be semantically equivalent to the original sequence for all possible register/flag states at the entry point. Correctness is verified by golden-snapshot tests | H5 |
| R12 | Rules are ordered by priority | Rules are applied in a defined priority order. If multiple rules match the same window, the highest-priority rule wins. Priority is a static property of the rule, not runtime-computed | Design |
| R13 | Rules declare their CPU compatibility | Each rule specifies which CPU variants it applies to (NMOS 6502, 65C02, or both). A rule that emits 65C02-only instructions is never applied when targeting NMOS 6502 | AR-58 |

### 3.4 Window Scanning Algorithm

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R14 | The scanner uses a sliding window over `StreamEntry[]` | The window advances entry-by-entry through the stream. At each position, rules are tested in priority order against the instruction window | Design |
| R15 | Labels break the window | A `Label` entry acts as a barrier — no peephole rule may span across a label. Labels are potential branch targets; instructions before and after a label may execute in different contexts | AR-55 |
| R16 | Directives break the window | A `Directive` entry also acts as a barrier. Directives are not instructions and must not be part of a pattern match | AR-55 |
| R17 | After a rule fires, the scanner resets to re-examine | When a rule produces a replacement, the scanner backs up to re-examine the replacement and preceding entries (up to the maximum window size). This allows cascading optimizations | Design |
| R18 | A fixed-point iteration limit prevents infinite loops | The scanner imposes a maximum number of rule applications per stream (configurable, default 10× the stream length). If the limit is reached, the optimizer stops and emits an ICE diagnostic | H5 |
| R19 | Non-`Instr` entries pass through unchanged | Only `Instr`-type entries are candidates for rewriting. `Label` and `Directive` entries are preserved exactly as-is in the output stream | AR-55 |

### 3.5 Safety Invariants

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R20 | Labels are never deleted by the optimizer | Even if a label appears unreferenced within a single function, the optimizer does not delete it. Labels may be referenced by external mechanisms (VICE label file, `runUntilLabel`) or by branch instructions in other functions targeting the same symbol. Label deletion is not a peephole concern | AR-55, AR-67 |
| R21 | Directives are never modified or deleted | Directives represent assembler pseudo-ops that are not optimizable. They pass through verbatim | AR-55 |
| R22 | Post-optimization CPU validation | After all rules have been applied, every `Instr` in the output is validated against the active CPU's opcode+mode table (the same check as RD-07 R14). A rule that produces an illegal instruction is a compiler bug (ICE) | AR-58 |
| R23 | Source spans are preserved or merged | When a replacement sequence replaces a matched window, source spans from the original instructions are preserved on the replacement instructions. If the replacement has fewer instructions than the original, the span of the first original instruction is used for all replacements | AR-72 |
| R24 | Deterministic output | Same input `InstrProgram` + same rule set → same output `InstrProgram`. The optimizer must be fully deterministic | H5 |
| R25 | The optimizer never changes the number of `InstrStream` entries | The set of streams (one per function + init + const data) is unchanged. Only the `entries[]` within each stream may be modified | AR-59 |

### 3.6 Compiler Flags

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R26 | Optimization is controlled by `--optimize` / `--no-optimize` | `--optimize` (or `-O`) enables the peephole optimizer. `--no-optimize` (or `-O0`) disables it (passthrough). Default: enabled | Design |
| R27 | When disabled, the optimizer is a guaranteed passthrough | `--no-optimize` means the `InstrProgram` from codegen passes to the emitter with zero modifications. This is useful for debugging codegen output | Design |
| R28 | Future: `--optimize-level` for rule subsets | Reserved for future use. Levels could control which rule categories are applied (e.g., level 1 = safe only, level 2 = aggressive). v1 does not implement levels | Language Guard F1 |

### 3.7 Diagnostics

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R29 | Optimization statistics are available as part of the build summary | When rules are applied (post-v1), the optimizer reports: total rules applied, bytes saved, per-rule hit counts. This feeds the resource report (RD-11) | AR-79, AR-83 |
| R30 | No user-facing diagnostics from the optimizer | The peephole optimizer does not produce errors or warnings in the `E10xxx`/`W10xxx` user bands. Any failure is an ICE (`E9xxxx`) — the optimizer should never encounter invalid input (codegen already validated) | AR-70 |
| R31 | ICE on rule invariant violation | If a rule produces a replacement that increases code size, produces an illegal opcode+mode, or violates any safety invariant, the optimizer emits an ICE and falls back to the unoptimized stream for that function | AR-70, H5 |

---

## 4. Design Detail

### 4.1 Type Definitions

```typescript
/**
 * A single peephole optimization rule.
 */
interface PeepholeRule {
  /** Human-readable rule name for diagnostics/reporting */
  readonly name: string;

  /** Number of consecutive Instr entries this rule examines */
  readonly windowSize: number;

  /** Priority (lower = higher priority; applied first) */
  readonly priority: number;

  /** CPU variants this rule is valid for */
  readonly cpuCompat: CpuVariant[];

  /**
   * Test whether the window matches this rule's pattern.
   * @param window  Array of exactly `windowSize` Instr-type StreamEntry values
   * @returns true if the pattern matches
   */
  match(window: ReadonlyArray<InstrEntry>): boolean;

  /**
   * Produce the replacement sequence.
   * Called only if match() returned true.
   * @param window  The matched window (same entries as match() received)
   * @returns Replacement Instr entries (length ≤ windowSize)
   */
  replace(window: ReadonlyArray<InstrEntry>): InstrEntry[];
}

/** CPU variant enum — mirrors platform profile */
type CpuVariant = 'nmos6502' | '65c02';

/** Convenience alias for an Instr-type StreamEntry */
type InstrEntry = Extract<StreamEntry, { type: 'instr' }>;
```

> **✅ PF-002 correction:** do NOT redefine `CpuVariant` here, and the 65C02 spelling is
> wrong. Import the canonical type from `@blend65/core`:
> `import type { CpuVariant } from "@blend65/core";` — its members are
> `"nmos6502" | "wdc65c02"`. All `cpuCompat` comparisons are against this single type.


### 4.2 Optimizer Engine

```typescript
interface PeepholeOptions {
  /** Whether optimization is enabled (--optimize / --no-optimize) */
  enabled: boolean;

  /** Maximum rule applications per stream (safety limit) */
  maxApplications?: number;  // default: 10 × stream.entries.length
}

/**
 * Apply peephole optimization to an InstrProgram.
 *
 * @param program   The InstrProgram from generateInstr() (RD-07)
 * @param profile   The active platform profile (for CPU variant)
 * @param rules     The ordered list of PeepholeRules to apply
 * @param options   Optimizer configuration
 * @param bag       DiagnosticBag for ICE errors
 * @returns         The optimized InstrProgram
 */
function optimizeInstr(
  program: InstrProgram,
  profile: PlatformProfile,
  rules: PeepholeRule[],
  options: PeepholeOptions,
  bag: DiagnosticBag
): InstrProgram;
```

### 4.3 Window Scanning Algorithm

```
function optimizeStream(stream: InstrStream, rules, profile, options, bag):
  if not options.enabled:
    return stream                    // passthrough

  entries = [...stream.entries]      // mutable copy
  cpuRules = rules.filter(r => r.cpuCompat.includes(profile.cpu))
  cpuRules.sort(by r.priority ascending)
  applicationCount = 0
  maxApps = options.maxApplications ?? 10 * entries.length

  i = 0
  while i < entries.length:
    if applicationCount >= maxApps:
      bag.addICE(E9_PEEPHOLE_LIMIT, null,
        "peephole iteration limit reached in " + stream.symbol)
      break

    if entries[i].type !== 'instr':
      i++                            // skip labels/directives
      continue

    for each rule in cpuRules:
      window = extractInstrWindow(entries, i, rule.windowSize)
      if window is null:
        continue                     // not enough instrs before next barrier
      if rule.match(window):
        replacement = rule.replace(window)
        assert replacement.length <= window.length   // size invariant
        spliceWindow(entries, i, window.length, replacement)
        applicationCount++
        // Back up to re-examine (cascade), but not before index 0
        i = max(0, i - maxWindowSize + 1)
        break                        // restart rule matching at new position
    else:
      i++                            // no rule matched; advance

  return { ...stream, entries }

function extractInstrWindow(entries, startIndex, size):
  // Collect `size` consecutive Instr entries starting at startIndex.
  // If a Label or Directive is encountered before collecting `size` entries,
  // return null (barrier).
  window = []
  j = startIndex
  while window.length < size and j < entries.length:
    if entries[j].type === 'label' or entries[j].type === 'directive':
      return null                    // barrier
    window.push(entries[j])
    j++
  if window.length < size:
    return null
  return window
```

### 4.4 v1 Implementation

The v1 implementation passes an empty rule list:

```typescript
// v1: no rules — pure passthrough
const V1_RULES: PeepholeRule[] = [];

function optimizeInstr(program, profile, rules, options, bag): InstrProgram {
  if (!options.enabled) return program;

  // Even in v1 (empty rules), validate structure
  for (const stream of program.streams) {
    validateStreamStructure(stream, bag);
  }

  // With zero rules, the scanning loop is a no-op
  return {
    ...program,
    streams: program.streams.map(s =>
      optimizeStream(s, rules, profile, options, bag)
    ),
  };
}
```

> **✅ PF-004 / PF-006 / THIN-PASSTHROUGH correction (authoritative v1 shape):**
> v1 does NOT invoke the sliding-window scanner (§4.3). It validates structure and returns
> the program with `preamble` and `allocationPlan` carried through **verbatim** — only
> `streams[].entries` are ever eligible for future rewriting (PF-004):
> ```typescript
> const V1_RULES: PeepholeRule[] = []; // internal — no scanner is run while empty (PF-001)
>
> export function optimizeInstr(
>   program: InstrProgram,
>   cpuVariant: CpuVariant,
>   bag: DiagnosticBag,
>   options?: PeepholeOptions,
> ): InstrProgram {
>   if (options && options.enabled === false) return program; // guaranteed passthrough (R27)
>   validateProgramStructure(program, bag); // R6 — see structural predicates below
>   return program; // verbatim: preamble + streams + allocationPlan unchanged (PF-004, R25)
> }
> ```
> **PF-006 structural predicates** (`validateProgramStructure`, the concrete R6 contract):
> 1. `program.streams` is a present, non-null array;
> 2. each `StreamEntry` is a valid discriminated union — exactly one of `isInstr` /
>    `isLabel` / `isDirective` (`@blend65/core`) holds;
> 3. no `null` / `undefined` entries.
> Opcode/addressing legality is NOT re-checked here — that remains `validateStream`'s job
> (R22), already run inside `generateInstr`. Any structural violation is an ICE (`E90001`),
> never a user-band diagnostic (R30).
>
> **PF-005 / PF-009 (deferred):** the iteration limit + its ICE and `maxWindowSize` belong to
> the scanner and are NOT built in v1; they land with the first real rule.

### 4.5 Planned Future Rules (v2+)


The following rules are specified for future implementation. They are **not** part of v1
but guide the design of the rule interface and window scanner.

| Rule | Window | Pattern | Replacement | Savings | CPU |
|------|--------|---------|-------------|---------|-----|
| **Redundant load** | 2+ | `LDA x; ... LDA x` (A unchanged between) | Remove second `LDA` | 2–3 bytes, 3–4 cycles | Both |
| **Redundant store-load** | 2 | `STA x; LDA x` | Remove `LDA` (A already holds value) | 2–3 bytes, 3–4 cycles | Both |
| **Dead store** | 2 | `STA x; STA x` | Remove first `STA` | 2–3 bytes, 3–4 cycles | Both |
| **Branch-over-JMP** | 3 | `Bxx .skip; JMP target; .skip:` | Invert branch → `B!xx target` (if in range) | 3 bytes, ~3 cycles | Both |
| **Tail-call** | 2 | `JSR label; RTS` | `JMP label` | 1 byte, 6 cycles | Both |
| **Identity ADC** | 2 | `CLC; ADC #$00` | Remove both | 3 bytes, 4 cycles | Both |
| **Identity SBC** | 2 | `SEC; SBC #$00` | Remove both | 3 bytes, 4 cycles | Both |
| **Complementary push-pull** | 2 | `PHA; PLA` (adjacent, no intervening use) | Remove both | 2 bytes, 7 cycles | Both |
| **Transfer-load** | 2 | `TAX; LDX #imm` | Remove `TAX` (immediately overwritten) | 1 byte, 2 cycles | Both |
| **Inc/Dec by 1** | 3 | `LDA x; CLC; ADC #$01; STA x` | `INC x` (if ZP/absolute) | 4+ bytes | Both |
| **STZ replacement** | 2 | `LDA #$00; STA x` | `STZ x` | 1 byte, 2 cycles | 65C02 only |

**Note on "A unchanged between":** The redundant-load rule requires tracking whether A
has been modified between the two `LDA` instructions. This uses a simple conservative
check: any instruction that writes to A (STA excluded) breaks the pattern. This is
simpler than a full liveness analysis and sufficient for peephole scope.

### 4.6 Rule Safety Verification

Each rule is verified at registration time:

```typescript
function registerRule(rule: PeepholeRule): void {
  // Verify windowSize > 0
  assert(rule.windowSize > 0, `rule ${rule.name}: windowSize must be > 0`);

  // Verify replace() output never exceeds windowSize
  // (This is also checked dynamically at each application)

  // Verify CPU compatibility is non-empty
  assert(rule.cpuCompat.length > 0, `rule ${rule.name}: must specify CPU compat`);
}
```

At each rule application, the engine dynamically verifies:

1. `replacement.length <= window.length` (size invariant)
2. Each replacement entry is a valid `Instr` with legal opcode+mode for the active CPU
3. Source spans are properly assigned

### 4.7 Public API

```typescript
/**
 * Apply peephole optimization to an InstrProgram.
 * v1 = passthrough (empty rule set).
 *
 * @param program   The InstrProgram from generateInstr() (RD-07)
 * @param profile   The active platform profile (RD-10) for CPU variant
 * @param bag       DiagnosticBag for ICE errors
 * @param options   Optimizer configuration (enabled flag, iteration limit)
 * @returns         The (possibly optimized) InstrProgram
 */
function optimizeInstr(
  program: InstrProgram,
  profile: PlatformProfile,
  bag: DiagnosticBag,
  options?: PeepholeOptions
): InstrProgram;
```

> **✅ PF-001/PF-003 correction (authoritative signature):** the second parameter is a bare
> `CpuVariant` primitive, NOT a `PlatformProfile` — mirroring `generateInstr(ilProgram,
> cpuVariant, bag)` and `validateStream(stream, cpuVariant, bag)`:
> ```typescript
> function optimizeInstr(
>   program: InstrProgram,
>   cpuVariant: CpuVariant,   // bare primitive (PF-003); a driver passes plugin.profile.cpu
>   bag: DiagnosticBag,
>   options?: PeepholeOptions
> ): InstrProgram;
> ```
> `rules` is NOT a parameter — v1 uses an internal `const V1_RULES: PeepholeRule[] = []`
> (PF-001).

This function lives in `@blend65/codegen`, alongside the IL optimizer and code generator.


### 4.8 Optimization Statistics

```typescript
interface PeepholeStats {
  /** Total number of rule applications across all streams */
  totalApplications: number;

  /** Per-rule hit counts */
  ruleHits: Map<string, number>;

  /** Estimated bytes saved (sum of byte-size reductions) */
  bytesSaved: number;

  /** Estimated cycles saved (sum of cycle-count reductions, where computable) */
  cyclesSaved: number;
}
```

Statistics are computed during optimization and returned alongside the `InstrProgram` (or
as a side-channel attached to the program). They feed the resource report (RD-11) when
optimization is active.

---

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-01 | Package structure: peephole optimizer lives in `@blend65/codegen` |
| RD-07 | **Input**: consumes `InstrProgram` produced by `generateInstr()`. Uses the `StreamEntry`, `Opcode`, `AddressingMode`, `InstrOperand` types defined in RD-07 |
| RD-09 | **Consumer**: the ACME emitter consumes the optimized `InstrProgram`. The emitter is agnostic to whether optimization was applied |
| RD-10 | **Input**: platform profile provides the CPU variant for rule filtering (NMOS 6502 vs 65C02) |
| RD-11 | **Data contributor**: optimization statistics (bytes saved, rules applied) feed the resource report |
| RD-15 | **Flag surface**: `--optimize` / `--no-optimize` flags are exposed through the CLI (RD-15) and programmatic API |
| RD-16 | **Config surface**: `optimize` setting in `blend65.json` provides the default; CLI flag overrides |

---

## 6. Acceptance Criteria

- [ ] AC-01: `optimizeInstr()` accepts an `InstrProgram` + `PlatformProfile` and returns an `InstrProgram`
- [ ] AC-02: v1 passthrough returns the input program unchanged (byte-identical golden snapshot)
- [ ] AC-03: `--no-optimize` flag bypasses the optimizer entirely (guaranteed passthrough)
- [ ] AC-04: `--optimize` flag runs the optimizer engine (even with zero rules in v1)
- [ ] AC-05: The `PeepholeRule` interface is defined with `name`, `windowSize`, `priority`, `cpuCompat`, `match()`, and `replace()` methods
- [ ] AC-06: The window scanner correctly skips `Label` entries (label = barrier)
- [ ] AC-07: The window scanner correctly skips `Directive` entries (directive = barrier)
- [ ] AC-08: Labels are never deleted or modified by the optimizer
- [ ] AC-09: Directives are never deleted or modified by the optimizer
- [ ] AC-10: The number of `InstrStream` entries in the program is preserved (no streams added/removed)
- [ ] AC-11: Post-optimization CPU validation runs on all output instructions
- [ ] AC-12: Source spans on replacement instructions are preserved from the matched window
- [ ] AC-13: Determinism: same input + same rules → same output (verified by golden snapshot)
- [ ] AC-14: The iteration limit prevents infinite rule-application loops (ICE emitted on limit)
- [ ] AC-15: Unit tests cover the window scanner with label/directive barriers (AR-22 tier 1)
- [ ] AC-16: Golden-snapshot tests confirm v1 passthrough produces identical output to codegen (AR-22 tier 2)
- [ ] AC-17: All decisions trace to an `AR-NN` or a frozen spec section

---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

1. **Rule application order within a window**: §4.3 applies rules in priority order and
   stops at the first match. An alternative is to score all matching rules and pick the
   best. The simple "first match by priority" approach is correct for v1 (no rules) and
   is the standard peephole strategy. If future rules exhibit priority conflicts, this
   can be refined without changing the public API.

2. **Cross-function optimization**: The current design optimizes each `InstrStream`
   independently. Whole-program peephole (e.g., removing a `JSR`/`RTS` pair where the
   callee is trivial) is out of scope for this RD and would be a separate optimization
   pass if ever needed.
