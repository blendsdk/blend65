# RD-11: Diagnostics Engine & Resource Reporting

> **Status**: 🟢 Authored
> **MVP Phase**: A
> **Depends On**: RD-01
> **Implements**: `spec-v3.0` Ch 14 (Diagnostics: Error & Warning Registry); diagnostics
>   architecture per AR-70..AR-78; resource reporting per AR-79..AR-85
> **Owning package(s)**: `@blend65/core` (diagnostics engine, span model, severity
>   policy, renderers, resource reporter)
> **Created**: 2026-05-31
> **Last Updated**: 2026-07-02 (RD-16 preflight cross-doc fix PF-012: R50 promote/suppress precedence)

---

## 1. Purpose

This document specifies the **diagnostics engine** and the **resource reporter** — two
cross-cutting compiler subsystems that live in `@blend65/core` and are consumed by every
compiler phase. They are folded into one RD (per AR-85) because they share the same
architectural patterns: structured data model → accumulation → multi-renderer.

The **diagnostics engine** provides the infrastructure for all compiler errors and
warnings. Every phase (lexer, parser, semantic, SFA, IL, codegen, ACME) appends
structured `Diagnostic` records to an accumulating `DiagnosticBag` — nothing throws on
first error (AR-73, AR-15). The bag is the mechanism behind error-tolerant compilation
and the library-first API (AR-77) that will power the future LSP (AR-78).

The **resource reporter** aggregates memory/resource usage data from multiple compiler
stages into a typed `ResourceReport` and renders it as a terminal table (the Ch 11 §6
build summary) or JSON for tooling. It is the developer's primary visibility into how
their program fits on constrained 6502 platforms (AR-83).

---

## 2. Scope

**In scope:**

**Diagnostics engine:**
- `Diagnostic` structured record (AR-71)
- `SourceSpan` model: interned `SourceId` + byte offsets (AR-72)
- Line/column + UTF-16 on-demand conversion for LSP (AR-72)
- `DiagnosticBag` accumulator (AR-73): ordering, dedup, `--max-errors`
- Error-recovery architecture: error-sentinel nodes, cascade suppression (AR-74)
- Diagnostic code namespace partitioning: `E10xxx`/`W10xxx` user + `E9xxxx` ICE (AR-70)
- Severity policy layer: `--warn-as-error`, `--suppress-warning` (AR-75)
- Multi-renderer: terminal caret format + JSON emitter (AR-76)
- Library-first API returning `Diagnostic[]` (AR-77)
- LSP keep-ready posture (AR-78)

**Resource reporting:**
- `ResourceReport` aggregator (AR-79)
- Data-source ownership: SFA/ACME/profile/plugin (AR-80)
- Budget-diagnostic timing: ZP/RAM pre-ACME, binary post-ACME (AR-81)
- Multi-renderer: terminal table + JSON (AR-82)
- Default visibility: on for successful builds, quiet flag suppresses (AR-83)
- MVP scope: code+binary+budgets (AR-84)

**Out of scope (and where it lives instead):**

- Specific diagnostic codes for each compiler phase → defined in RD-02..RD-09 (each RD
  cites Ch 14 codes)
- ACME failure as ICE → RD-09
- CLI flags for rendering/format → RD-15
- `blend65.json` diagnostic settings → RD-16

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, or the frozen spec section
> it implements. No decision may be invented here — discovery is closed.

---

## 3. Decisions & Requirements

### 3.1 Diagnostic Code Namespace

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | User diagnostics use `E10xxx` (errors) and `W10xxx` (warnings) | These are the codes defined in Ch 14 — every user-facing diagnostic has a code in this range. They are stable across compiler versions | AR-70, Ch 14 |
| R2 | Internal compiler errors use `E9xxxx` | ICE codes are in a separate band that can never collide with user codes. ICEs indicate compiler bugs, not user mistakes | AR-70 |
| R3 | Diagnostic codes are unique and permanent | Once assigned, a code is never reused for a different condition. Codes may be deprecated but not reassigned | Ch 14 |

### 3.2 Diagnostic Record

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R4 | `Diagnostic` is a structured record, never a pre-rendered string | `{ code, severity, message, primarySpan, secondarySpans[], notes[], help? }`. No compiler component ever produces a formatted/caret-rendered string — rendering is a separate concern | AR-71 |
| R5 | `code` is a string in the format `"E10042"` or `"W10130"` | Parseable prefix (`E`/`W`) + numeric code. ICEs use `"E9xxxx"` | AR-70 |
| R6 | `severity` is `'error'` or `'warning'` | No "info" or "hint" severity in v1. Warnings can be promoted/suppressed via severity policy | AR-75 |
| R7 | `message` is a human-readable, actionable string | Must tell the developer what went wrong and suggest how to fix it. No technical jargon without explanation | Ch 14 |
| R8 | `primarySpan` identifies the main location | Points to the offending source text. May be null for ICEs that have no source location | AR-72 |
| R9 | `secondarySpans[]` provide additional context | Optional. Example: "declared here" pointing to the original declaration when a duplicate is found | AR-71 |
| R10 | `notes[]` provide supplemental explanation | Optional. Example: "note: mixed-signedness arithmetic is prohibited" | AR-71 |
| R11 | `help?` provides a fix suggestion | Optional. Example: "help: add an explicit cast: `byte(value)`" | AR-71 |

### 3.3 Source Span Model

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R12 | Spans use interned `SourceId` + byte offsets | `{ sourceId: SourceId, start: number, end: number }`. Byte offsets into the UTF-8 source text. Multi-file aware | AR-72 |
| R13 | `SourceId` is an interned identifier for a source file | Maps to the file path via a `SourceMap` registry. Interning avoids storing full paths in every span | AR-72, AR-39 |
| R14 | Line/column computed on demand | `LineMap` (built by the lexer, RD-02) converts byte offsets to `{ line, column }` on demand. Never stored in the `Diagnostic` | AR-72 |
| R15 | UTF-16 columns computed on demand for LSP | LSP uses UTF-16 code units for column positions. A conversion layer computes UTF-16 columns from byte offsets when needed | AR-72 |
| R16 | Spans survive lowering through IL to `Instr` | `Instr.sourceSpan?` (AR-54) carries spans so codegen/resource diagnostics point back to source | AR-72 |

### 3.4 DiagnosticBag Accumulator

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R17 | `DiagnosticBag` accumulates diagnostics without throwing | Every compiler phase appends to the bag. No phase aborts on a single error — this is the mechanism behind error-tolerant compilation (AR-15) | AR-73 |
| R18 | Ordering is deterministic | Diagnostics are ordered by source file (SourceId), then by byte offset, then by code. Same input → same diagnostic order | AR-73, H5 |
| R19 | Duplicate diagnostics are suppressed | If the same `(code, sourceId, start)` triple appears twice, the second is silently dropped | AR-73 |
| R20 | `--max-errors` limits the number of errors reported | Default: 20. After reaching the limit, the bag stops accepting new error-severity diagnostics (warnings still accepted). A final diagnostic announces truncation | AR-73 |
| R21 | The bag provides query methods | `hasErrors(): boolean`, `getAll(): Diagnostic[]`, `getErrors(): Diagnostic[]`, `getWarnings(): Diagnostic[]`, `count(): number` | Design |
| R22 | The bag is thread-safe (single-threaded, but re-entrant safe) | The bag must be safe to use across async boundaries (e.g., the compiler facade may be called from an async context). In practice, Node.js is single-threaded, so this is a design constraint on the API surface, not a concurrency requirement | Design |

### 3.5 Error-Recovery Architecture

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R23 | Error-sentinel AST nodes exist for error recovery | `ErrorExpr`, `ErrorStmt`, `ErrorType` — these are produced by the parser when it encounters a syntax error and recovers. They carry a span but no valid semantics | AR-74 |
| R24 | Cascade suppression is mandatory | When a node carries `ErrorType` (poison type), downstream phases must not emit further diagnostics derived from that node. This prevents "one typo → fifty errors" | AR-74 |
| R25 | The recovery architecture is stable; rule coverage is provisional | The architectural pattern (accumulate, sentinel nodes, poison types) is frozen. The specific set of parser sync points and recovery heuristics grows per vertical slice (F4) | AR-74 |
| R26 | Determinism is a hard invariant | Same source input → same diagnostic set, same order. This is enforced by golden-snapshot tests | AR-74, H5 |

### 3.6 Severity Policy

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R27 | One central severity-policy layer applies promotion and suppression | Applied over the `DiagnosticBag` after collection. The rest of the compiler always emits the natural severity | AR-75 |
| R28 | `--warn-as-error` promotes all warnings to errors | If set, any warning causes the build to fail | AR-75, Ch 14 §4 |
| R29 | `--warn-as-error=Wxxxxx` promotes a specific warning | Selective promotion. Multiple flags may be specified | AR-75 |
| R30 | `--suppress-warning=Wxxxxx` suppresses a specific warning | The warning is removed from the output. Multiple flags may be specified | AR-75 |
| R31 | Severity policy is applied exactly once, after all diagnostics are collected | The policy is a post-processing step, not per-emission. This ensures consistent behavior regardless of emission order | AR-75 |
| R50 | Suppression wins over promotion | When the same warning code is both promoted (`--warn-as-error=Wxxxxx` / config `warnAsError`) and suppressed (`--suppress-warning=Wxxxxx` / config `suppressWarnings`), suppression takes precedence — an explicitly silenced code stays silent. The config loader warns on the overlap at load time (RD-16 R30). Added by RD-16 preflight PF-012 | AR-75 + Design |

### 3.7 Diagnostic Rendering

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R32 | Multiple renderers consume the same `Diagnostic[]` | Renderers never re-derive meaning — they only format structured data | AR-76 |
| R33 | Terminal renderer produces the Ch 14 caret format | The format from Ch 14 §1: code + message + file:line:col + source excerpt with caret. Respects AR-17 conditional color | AR-76, AR-17 |
| R34 | JSON emitter produces machine-readable output | `--diagnostics-format=json` outputs JSON for tooling/CI/LSP consumption. Each diagnostic is a JSON object | AR-76 |
| R35 | Renderers use `LineMap` for line/column resolution | Source excerpts and caret positioning require the `LineMap` from the lexer | AR-72 |

### 3.8 Library-First API

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R36 | The compiler is callable as a library returning `Diagnostic[]` | The `@blend65/compiler` facade returns structured diagnostics. The CLI (`@blend65/cli`) is one consumer that renders them. LSP will be another | AR-77 |
| R37 | No diagnostics are printed inside the compiler | All output goes through the `DiagnosticBag`. Rendering happens in the consumer (CLI or LSP), never in the core compiler | AR-77 |
| R38 | LSP-compatible from day one | Every decision (structured records, byte-offset spans, UTF-16 conversion, accumulate-not-throw, JSON emitter, library API) is made so no rewrite is needed for the future LSP (AR-14) | AR-78 |

### 3.9 Resource Report — Data Model

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R39 | `ResourceReport` is a structured data record | Not a pre-formatted string. Renderers consume it separately | AR-79 |
| R40 | Data sources are explicitly owned | SFA planner (RD-05) owns: frame sizes, frame-region peak, ZP allocation count, stack depth. ACME artifacts (RD-09) own: code size, data size, binary size. Platform profile (RD-10) owns: budgets. Platform plugin owns: startup size | AR-80 |
| R41 | Each number has exactly one owner | No number is guessed or computed from two sources. If code size comes from ACME, codegen doesn't also compute it | AR-80 |
| R42 | Budget diagnostics are split by timing | ZP budget (`E10032`) and RAM budget (`E10033`) are checked **pre-ACME** from the SFA plan. Binary-size budget (`E10034`) is checked **post-ACME** from the output file. This upholds AR-68 (user errors never first surface at ACME) | AR-81 |

### 3.10 Resource Report — Rendering

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R43 | Multi-renderer: terminal table + JSON | The terminal renderer produces the Ch 11 §6 build-summary table. JSON via `--report=json` for CI/tooling | AR-82 |
| R44 | The build summary prints by default on successful builds | This is a core DX promise for constrained platforms — developers always see how much headroom they have | AR-83 |
| R45 | A quiet flag suppresses the summary | `--quiet` or `-q` suppresses the build summary. Diagnostics (errors/warnings) are still shown | AR-83 |
| R46 | JSON report is opt-in | `--emit-report` or `--report=json` writes the report to a JSON file | AR-82 |

### 3.11 Resource Report — MVP Scope

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R47 | MVP gate: code size + binary size + budget comparisons | The minimal report shows code bytes, binary bytes, and budget headroom (ZP, RAM, binary). Full columns (per-function frame sizes, ZP breakdown) come in slice 2 | AR-84 |
| R48 | Report shape is defined now, data populated per slice | The `ResourceReport` type is complete from v1. Fields that don't have data yet are null/zero. This prevents later reshaping | AR-84 |
| R49 | Warnings from the report use the AR-75 severity layer | Budget warnings (W10030 frame size, W10033 RAM, W10180 stack depth) are emitted through the `DiagnosticBag` and respect severity policy | AR-85 |

---

## 4. Design Detail

### 4.1 Diagnostic Record

```typescript
interface Diagnostic {
  /** Diagnostic code (e.g., "E10042", "W10130", "E90001") */
  code: string;

  /** Severity: error or warning */
  severity: 'error' | 'warning';

  /** Human-readable message */
  message: string;

  /** Primary source location (null for ICEs without source context) */
  primarySpan: SourceSpan | null;

  /** Additional locations (e.g., "declared here") */
  secondarySpans: LabeledSpan[];

  /** Supplemental notes */
  notes: string[];

  /** Optional fix suggestion */
  help?: string;
}

interface LabeledSpan {
  span: SourceSpan;
  label: string;  // e.g., "declared here", "first occurrence"
}
```

### 4.2 Source Span & SourceMap

```typescript
interface SourceSpan {
  /** Interned source file ID */
  sourceId: SourceId;

  /** Start byte offset (inclusive) */
  start: number;

  /** End byte offset (exclusive) */
  end: number;
}

/** Opaque interned source file identifier */
type SourceId = number;  // index into SourceMap

interface SourceMap {
  /** Intern a source file, returning its SourceId */
  intern(path: string, content: string): SourceId;

  /** Get path for a SourceId */
  getPath(id: SourceId): string;

  /** Get content for a SourceId */
  getContent(id: SourceId): string;

  /** Get or build the LineMap for a source */
  getLineMap(id: SourceId): LineMap;
}

interface LineMap {
  /** Convert byte offset to line/column (1-based) */
  getLineCol(offset: number): { line: number; column: number };

  /** Convert byte offset to UTF-16 column (for LSP) */
  getUtf16Column(offset: number): number;

  /** Get the source line text containing the given offset */
  getLineText(offset: number): string;
}
```

### 4.3 DiagnosticBag

```typescript
interface DiagnosticBag {
  /** Append an error diagnostic */
  addError(code: string, span: SourceSpan | null, message: string,
    options?: DiagnosticOptions): void;

  /** Append a warning diagnostic */
  addWarning(code: string, span: SourceSpan | null, message: string,
    options?: DiagnosticOptions): void;

  /** Append an ICE diagnostic */
  addICE(code: string, span: SourceSpan | null, message: string): void;

  /** Check if any errors have been added */
  hasErrors(): boolean;

  /** Get all diagnostics in deterministic order */
  getAll(): Diagnostic[];

  /** Get only errors */
  getErrors(): Diagnostic[];

  /** Get only warnings */
  getWarnings(): Diagnostic[];

  /** Total diagnostic count */
  count(): number;

  /** Whether the max-errors limit has been reached */
  isErrorLimitReached(): boolean;
}

interface DiagnosticOptions {
  secondarySpans?: LabeledSpan[];
  notes?: string[];
  help?: string;
}
```

### 4.4 Severity Policy

```typescript
interface SeverityPolicy {
  /** Promote all warnings to errors */
  warnAsError: boolean;

  /** Specific warning codes promoted to error */
  promoteWarnings: Set<string>;

  /** Specific warning codes suppressed */
  suppressWarnings: Set<string>;
}

/**
 * Apply severity policy to a diagnostic list.
 * Called once after all diagnostics are collected.
 * Precedence: suppression wins over promotion (R50) — a code present in both
 * suppressWarnings and promoteWarnings (or covered by warnAsError) is suppressed.
 */
function applySeverityPolicy(
  diagnostics: Diagnostic[],
  policy: SeverityPolicy
): Diagnostic[];
```

### 4.5 Diagnostic Renderers

```typescript
/**
 * Render diagnostics to terminal caret format (Ch 14 §1).
 */
function renderTerminal(
  diagnostics: Diagnostic[],
  sourceMap: SourceMap,
  options: { color: boolean }
): string;

/**
 * Render diagnostics to JSON format.
 */
function renderJson(diagnostics: Diagnostic[]): string;
```

**Terminal output example (from Ch 14):**
```
error[E10042]: 'poke()' expects 2 arguments — found 3
  --> player.blend:42:5
   |
42 |     poke($D020, 0, 1);
   |     ^^^^^^^^^^^^^^^^^ extra argument
```

### 4.6 Resource Report

```typescript
interface ResourceReport {
  // --- SFA-owned (pre-ACME) ---
  /** Total ZP bytes allocated */
  zpUsed: number;
  /** ZP budget from profile */
  zpBudget: number;

  /** Total RAM bytes for frames + module vars */
  ramUsed: number;
  /** RAM budget from profile */
  ramBudget: number;

  /** Maximum stack depth (bytes) */
  stackDepth: number;
  /** Stack budget from profile */
  stackBudget: number;

  /** Per-function frame sizes (slice 2+) */
  frameSizes?: Map<string, number>;

  /** ZP allocation breakdown (slice 2+) */
  zpAllocations?: ZpAllocationEntry[];

  // --- ACME-owned (post-ACME) ---
  /** Code segment size in bytes (from label file) */
  codeSize?: number;
  /** Data segment size in bytes (from label file) */
  dataSize?: number;
  /** Total binary size (excluding load header) */
  binarySize?: number;
  /** Binary budget from profile */
  binaryBudget: number;

  // --- Plugin-owned ---
  /** Startup shim size in bytes */
  startupSize?: number;

  // --- Peephole (post-v1) ---
  /** Optimization statistics */
  peepholeStats?: PeepholeStats;
}

interface ZpAllocationEntry {
  name: string;
  address: number;
  size: number;
  owner: string;  // function name or "module"
}
```

### 4.7 Resource Report Renderers

```typescript
/**
 * Render resource report as a terminal table (Ch 11 §6 format).
 */
function renderReportTerminal(report: ResourceReport): string;

/**
 * Render resource report as JSON.
 */
function renderReportJson(report: ResourceReport): string;
```

**Terminal table example:**
```
╭──────────────────────────────────────────────╮
│           Build Summary (c64)                │
├──────────────┬──────────┬──────────┬─────────┤
│ Resource     │ Used     │ Budget   │ %       │
├──────────────┼──────────┼──────────┼─────────┤
│ Binary       │ 47 bytes │ 26623    │ 0.2%    │
│ Zero Page    │ 2 bytes  │ 142      │ 1.4%    │
│ RAM (frames) │ 0 bytes  │ 26623    │ 0.0%    │
│ Stack depth  │ 4 bytes  │ 230      │ 1.7%    │
╰──────────────┴──────────┴──────────┴─────────╯
```

### 4.8 Public API

```typescript
// @blend65/core exports:

// Diagnostics
export { Diagnostic, LabeledSpan, SourceSpan, SourceId };
export { DiagnosticBag, createDiagnosticBag };
export { SourceMap, createSourceMap };
export { LineMap };
export { SeverityPolicy, applySeverityPolicy };
export { renderTerminal, renderJson };

// Resource reporting
export { ResourceReport, ZpAllocationEntry };
export { renderReportTerminal, renderReportJson };
```

---

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-01 | Package structure: all diagnostics and reporting live in `@blend65/core` |
| RD-02 | **Producer**: lexer appends `E101xx` diagnostics to the bag; builds `LineMap` for span resolution |
| RD-03 | **Producer**: parser appends `E103xx` diagnostics; produces error-sentinel AST nodes |
| RD-04 | **Producer**: semantic analysis appends `E10xxx`/`W10xxx` diagnostics (45+ codes); uses poison-type cascade suppression |
| RD-05 | **Producer**: SFA planner appends budget diagnostics (E10032/E10033, W10030/W10033/W10180); contributes SFA-owned data to `ResourceReport` |
| RD-06 | **Producer**: IL lowering may append ICE diagnostics for unimplemented lowering paths |
| RD-07 | **Producer**: codegen appends cost warnings (W10170/W10171/W10172) and ICE for illegal opcode+mode |
| RD-08 | **Producer**: peephole optimizer appends ICE on invariant violation; contributes `PeepholeStats` to report |
| RD-09 | **Producer**: ACME integration appends ICE on ACME failure; contributes binary/code/data sizes post-ACME; appends E10034 on binary-size budget exceed |
| RD-10 | **Data contributor**: platform profile provides budget values for the resource report |
| RD-14 | **Consumer**: future LSP will consume `Diagnostic[]` + `SourceSpan` + UTF-16 column conversion |
| RD-15 | **Consumer**: CLI renders diagnostics via `renderTerminal()` and report via `renderReportTerminal()` |
| RD-16 | **Config surface**: diagnostic settings (max-errors, warn-as-error, suppress) in `blend65.json` |

---

## 6. Acceptance Criteria

- [ ] AC-01: `Diagnostic` record has `code`, `severity`, `message`, `primarySpan`, `secondarySpans`, `notes`, `help` fields
- [ ] AC-02: `SourceSpan` uses interned `SourceId` + byte offsets (no line/col stored)
- [ ] AC-03: `LineMap` converts byte offsets to line/column and UTF-16 columns on demand
- [ ] AC-04: `DiagnosticBag` accumulates without throwing; `hasErrors()` returns correct state
- [ ] AC-05: Diagnostic ordering is deterministic: same input → same order (golden snapshot)
- [ ] AC-06: Duplicate diagnostics (same code + location) are suppressed
- [ ] AC-07: `--max-errors` limits error count with a truncation message
- [ ] AC-08: Error-sentinel nodes (`ErrorExpr`/`ErrorStmt`/`ErrorType`) exist and carry spans
- [ ] AC-09: Poison-type cascade suppression prevents derived diagnostics from error nodes
- [ ] AC-10: User codes use `E10xxx`/`W10xxx`; ICE codes use `E9xxxx` — no overlap
- [ ] AC-11: `SeverityPolicy` correctly promotes and suppresses warnings
- [ ] AC-12: Terminal renderer produces Ch 14 caret format with conditional color
- [ ] AC-13: JSON renderer produces parseable diagnostic JSON
- [ ] AC-14: No diagnostic is printed inside the compiler core — all rendering is in consumers
- [ ] AC-15: `ResourceReport` aggregates ZP/RAM/stack/binary data from correct owners
- [ ] AC-16: Build summary prints by default on success; `--quiet` suppresses it
- [ ] AC-17: Budget diagnostics fire at correct timing (ZP/RAM pre-ACME, binary post-ACME)
- [ ] AC-18: Terminal report table shows used/budget/percentage for all resource categories
- [ ] AC-19: JSON report is available via `--emit-report` / `--report=json`
- [ ] AC-20: Unit tests cover diagnostic ordering, dedup, max-errors, severity policy (AR-22 tier 1)
- [ ] AC-21: All decisions trace to an `AR-NN` or a frozen spec section

---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

None.
