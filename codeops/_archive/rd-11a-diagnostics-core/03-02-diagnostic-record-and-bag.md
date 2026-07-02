# Design: Diagnostic Record, Bag & Code Namespace

> **Document**: 03-02-diagnostic-record-and-bag.md
> **Parent**: [Index](00-index.md)
> **Covers**: FR-9..FR-19 · RD-11 §3.1, §4.1, §4.3 · Ch 14 · AR-Q6

## Files

- `packages/core/src/diagnostics/diagnostic.ts` — `Severity`, `Diagnostic`, `DiagnosticOptions`
- `packages/core/src/diagnostics/diagnostic-codes.ts` — code-namespace constants
- `packages/core/src/diagnostics/diagnostic-bag.ts` — `DiagnosticBag`, `createDiagnosticBag`
- `packages/core/src/diagnostics/index.ts` — barrel re-exporting the four modules above

## `diagnostic.ts` (FR-9, FR-10)

```typescript
import type { SourceSpan, LabeledSpan } from "./source-span.js";

export type Severity = "error" | "warning";

/** A structured compiler diagnostic. Renderer-agnostic (RD-11 §4.1). */
export interface Diagnostic {
  readonly code: string;                 // e.g. "E10001", "W10191", "E90001"
  readonly severity: Severity;
  readonly message: string;
  readonly primarySpan: SourceSpan | null;   // null only for span-less ICEs (R8)
  readonly secondarySpans: readonly LabeledSpan[];
  readonly notes: readonly string[];
  readonly help?: string;
}

/** Optional extras accepted by DiagnosticBag.add* (RD-11 §4.3). */
export interface DiagnosticOptions {
  readonly secondarySpans?: readonly LabeledSpan[];
  readonly notes?: readonly string[];
  readonly help?: string;
}
```

**Design notes**

- `secondarySpans` and `notes` always materialize as arrays (empty if omitted), so
  consumers never branch on `undefined`. `help` stays optional (R11).
- The record is `readonly` end-to-end — diagnostics are immutable once accepted.

## `diagnostic-codes.ts` (FR-17 · RD-11 §3.1 · Ch 14)

A single source of truth for every code in Ch 14, grouped by area, plus the ICE band.
Codes are exported as `const` string literals so call sites read `DiagCode.E10001`.

```typescript
/**
 * Canonical diagnostic codes (Ch 14). User-facing errors are E10xxx, warnings W10xxx;
 * internal compiler errors (ICE) occupy the E9xxxx band (RD-11 R1–R3).
 */
export const DiagCode = {
  // Module & program structure (Ch 14 §2 E100xx → Ch 10)
  MissingModuleDecl: "E10001",
  ModuleDeclNotFirst: "E10002",
  DuplicateDecl: "E10003",
  ExecAtModuleLevel: "E10010",
  ImportNonExported: "E10012",
  NoMainFunction: "E10020",
  MultipleMainFunctions: "E10021",
  CallingMainDirectly: "E10023",
  // Resource limits
  ZpBudgetExceeded: "E10032",
  RamBudgetExceeded: "E10033",
  BinaryTooLarge: "E10034",
  // Intrinsics
  ArgsToParameterlessIntrinsic: "E10040",
  WrongIntrinsicArgCount: "E10041",
  AddressOfElementDeferred: "E10042",
  // Scoping & names
  UndeclaredIdentifier: "E10100",
  NameShadows: "E10101",
  // Arrays
  ArraySizeNotConst: "E10110",
  ArraySizeZero: "E10111",
  ArraySizeExceedsMax: "E10112",
  ConstArrayNotFullyInit: "E10113",
  ArrayIndexTypeMismatch: "E10114",
  StaticIndexOutOfBounds: "E10115",
  // Type system
  MissingTypeAnnotation: "E10150",
  UnknownType: "E10151",
  TypeMismatchAssignment: "E10152",
  SignedUnsignedMismatch: "E10153",
  WidthNarrowingNoCast: "E10154",
  InvalidCast: "E10155",
  // Structs
  UnknownField: "E10160",
  MissingFieldInInit: "E10161",
  ExtraFieldInInit: "E10162",
  EmptyStruct: "E10163",
  // Functions
  WrongArgCount: "E10170",
  ArgTypeMismatch: "E10171",
  MissingReturnValue: "E10172",
  VoidFunctionReturnsValue: "E10173",
  RecursionDetected: "E10174",
  TooManyParameters: "E10175",
  // Control flow
  ForEndBoundOutOfRange: "E10064",
  BreakOutsideLoopSwitch: "E10130",
  ContinueOutsideLoop: "E10131",
  DuplicateCaseValue: "E10132",
  NonExhaustiveSwitch: "E10133",
  // Enums
  EmptyEnum: "E10140",
  TooManyEnumMembers: "E10141",
  DuplicateEnumValue: "E10142",
  EnumBackingOutOfRange: "E10143",
  // Variables
  AssignToConst: "E10191",
  ConstWithoutInit: "E10192",
  NonConstInit: "E10193",
  CircularInit: "E10194",
  // Data inclusion
  EmbedNonConst: "E10200",
  EmbedFileNotFound: "E10201",
  EmbedSizeMismatch: "E10202",
  EmbedUnknownSelector: "E10203",
  EmbedFormatParseError: "E10204",
  // Operators & expressions
  InvalidOperandType: "E10080",
  MixedSignedUnsignedOperands: "E10081",
  ConstDivisionByZero: "E10082",
  ShiftAmountOutOfRange: "E10083",

  // Warnings (Ch 14 §3)
  LargeZpAllocation: "W10030",
  RamNearingLimit: "W10033",
  DecimalModeWithoutCld: "W10120",
  BrkInRelease: "W10121",
  StackDepthNearLimit: "W10180",
  UseBeforeInit: "W10190",
  UnusedVariable: "W10191",
  UnreachableCode: "W10130",
} as const;

export type DiagCodeValue = (typeof DiagCode)[keyof typeof DiagCode];

/** Internal compiler errors — the E9xxxx band (RD-11 R2). Extended as ICEs are added. */
export const IceCode = {
  /** Generic catch-all ICE; specific ICEs get their own E9xxxx as they appear. */
  Unexpected: "E90001",
} as const;

/** True if a code string is in the ICE band (E9xxxx). */
export function isIceCode(code: string): boolean {
  return /^E9\d{4}$/.test(code);
}
```

> **Note:** the lexer (RD-02) does not introduce its own codes in Ch 14 today; it reuses
> the relevant `E10xxx` lexical codes. When RD-02's plan needs a code not yet present, it
> is added here (the single registry) — not scattered. This keeps FR-17 the one source.

## `diagnostic-bag.ts` (FR-11..FR-16, FR-18)

```typescript
import type { SourceSpan } from "./source-span.js";
import type { Diagnostic, DiagnosticOptions } from "./diagnostic.js";

export interface DiagnosticBag {
  addError(code: string, span: SourceSpan | null, message: string, options?: DiagnosticOptions): void;
  addWarning(code: string, span: SourceSpan | null, message: string, options?: DiagnosticOptions): void;
  addICE(code: string, span: SourceSpan | null, message: string): void;
  hasErrors(): boolean;
  getAll(): Diagnostic[];
  getErrors(): Diagnostic[];
  getWarnings(): Diagnostic[];
  count(): number;
  isErrorLimitReached(): boolean;
}

export function createDiagnosticBag(options?: { maxErrors?: number }): DiagnosticBag;
```

### Internal state

- `private diagnostics: Diagnostic[]` — insertion-ordered store.
- `private seen: Set<string>` — dedup keys `${code}|${sourceId}|${start}` (FR-14).
- `private errorCount: number` — count of accepted **error**-severity, non-ICE diagnostics.
- `private maxErrors: number` — from options, default `20` (FR-12).
- `private limitReached: boolean` and `private truncationEmitted: boolean`.

### `addError` / `addWarning` / `addICE` algorithm

For every add (FR-18: never throws):

1. **Build the key** from `(code, span?.sourceId ?? -1, span?.start ?? -1)`. If the key is
   in `seen`, **drop** (FR-14, dedup) and return. (Span-less ICEs key on `-1,-1` so two
   identical-code span-less ICEs dedup; distinct ICE codes do not.)
2. **Max-errors gate (errors only, FR-15):** if this is `addError` (non-ICE) **and**
   `errorCount >= maxErrors`:
   - set `limitReached = true`;
   - if `!truncationEmitted`, append a single truncation diagnostic
     (`code "E10000"`-style sentinel? No — use a dedicated message with the *first*
     suppressed error's code band) → **decision below**; set `truncationEmitted = true`;
   - return without storing the suppressed error.
3. Otherwise construct the `Diagnostic` (normalizing `secondarySpans`/`notes` to arrays),
   push to `diagnostics`, add the key to `seen`.
4. If severity is `error` and not an ICE, increment `errorCount`.

> **ICEs are uncapped (FR-16, AR-Q6):** `addICE` skips step 2 entirely. ICEs always store
> (subject only to dedup), because a suppressed compiler-bug report is worse than noise.
> ICE severity is `"error"` so `hasErrors()` reflects them.

#### Truncation diagnostic (FR-15)

When the error cap is first exceeded, the bag appends **one** synthetic diagnostic:

- `severity: "error"`, `primarySpan: null`,
- `code: "E10000"` (reserved "too many errors" sentinel — added to `DiagCode` as
  `TooManyErrors`),
- `message: "Too many errors — stopped after <maxErrors>. Fix earlier errors and recompile."`

This sentinel is **not** counted toward `errorCount` and is exempt from its own cap (it is
emitted exactly once via `truncationEmitted`). It sorts last among same-`sourceId`/null
spans (see ordering).

> **Runtime-ambiguity note:** Ch 14 defines `--max-errors` (default 20) but does not assign
> a code to the truncation message. Using a reserved `E10000` sentinel is a plan-level
> implementation choice; if the user prefers no code (a bare message line), this is the one
> open micro-decision — flagged in 99 as a confirm-on-execute item, default = `E10000`.

### Query methods

- `getAll()` returns a **sorted copy** (never the internal array). Sort key (FR-13, R18):
  1. `sourceId` ascending (null/`-1` spans sort **after** all real source ids → use
     `Number.MAX_SAFE_INTEGER` as the comparison key when `primarySpan` is null);
  2. `start` ascending;
  3. `code` lexicographic ascending.
  The sort is **stable**, so insertion order breaks any remaining ties deterministically.
- `getErrors()` / `getWarnings()` filter `getAll()` by severity (ICEs appear among errors).
- `hasErrors()` = `errorCount > 0 || any ICE stored || truncationEmitted`.
- `count()` = total stored diagnostics (FR-18).
- `isErrorLimitReached()` = `limitReached` (FR-15).

## Interaction precedence (resolves the 02 risk)

When multiple rules apply to one `addError`, the order is fixed:

**dedup → max-errors gate → store/count.**

So a duplicate that would also exceed the cap is simply dropped as a duplicate (it never
counts toward the cap). ICEs bypass the cap but still dedup.

## Edge Cases (for tests — see 07)

| Case                                                | Expected                                                       |
| --------------------------------------------------- | -------------------------------------------------------------- |
| Two identical `(code, sourceId, start)` errors      | second dropped; `count()` unchanged (FR-14)                    |
| Same code, different `start`                        | both kept                                                      |
| 21 distinct errors, `maxErrors=20`                  | 20 stored + 1 truncation; `isErrorLimitReached()` true         |
| Warnings after error cap reached                    | still accepted (FR-15)                                          |
| ICE after error cap reached                         | still accepted (FR-16)                                          |
| Two identical span-less ICEs (same code)            | second dropped (dedup on `-1,-1`)                              |
| `getAll()` called twice                             | identical order both times (FR-13, determinism)                |
| null-span diagnostic vs spanned, same file          | null-span sorts after spanned                                  |

## Traceability

| Element                  | Requirement   | Spec / AR             |
| ------------------------ | ------------- | --------------------- |
| `Diagnostic` shape       | FR-9          | RD-11 §4.1 (R4–R11)   |
| `DiagnosticOptions`      | FR-10         | RD-11 §4.3            |
| Bag API                  | FR-11         | RD-11 §4.3 (R21); AR-Q6 |
| Factory + default 20     | FR-12         | RD-11 R20; Ch 14 §4   |
| Deterministic ordering   | FR-13         | RD-11 R18             |
| Dedup                    | FR-14         | RD-11 R19             |
| Max-errors + truncation  | FR-15         | RD-11 R20; Ch 14 §4   |
| ICE uncapped             | FR-16         | RD-11 R2; AR-Q6       |
| Code namespace           | FR-17         | RD-11 §3.1; Ch 14     |
| Never throws             | FR-18         | RD-11 R17; AR-15      |
| Barrel export            | FR-19         | RD-11 §4.8 (scoped)   |
