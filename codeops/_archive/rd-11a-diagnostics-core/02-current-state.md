# Current State: RD-11a Diagnostics Core

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

`@blend65/core` is an **empty-but-wired** package from RD-01. Its entire source is:

```typescript
// packages/core/src/index.ts
export const VERSION = "0.1.0";
```

It has a smoke test (`src/index.spec.test.ts` asserting `VERSION === "0.1.0"`), a
`package.json` (private, ESM, `tsc --build` / `vitest run`), a `tsconfig.json`, and a
`vitest.config.ts` (`include: ["src/**/*.spec.test.ts"]` per AR-P8). There is **no**
diagnostics code, no span model, no `LineMap`.

### Relevant Files

| File                                   | Purpose                                  | Changes Needed                                  |
| -------------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| `packages/core/src/index.ts`           | Public barrel (currently just `VERSION`) | Re-export the new diagnostics module            |
| `packages/core/src/index.spec.test.ts` | VERSION smoke test                       | Unchanged                                        |
| `packages/core/package.json`           | Manifest                                 | Unchanged (no new deps)                          |
| `packages/core/tsconfig.json`          | TS project                               | Unchanged (new files compile under existing glob) |
| `packages/core/vitest.config.ts`       | Test discovery                           | Unchanged (`src/**/*.spec.test.ts` already covers new tests; impl tests use `*.impl.test.ts`) |

### Code Analysis

The package is a clean slate, so this plan **adds new files** under a new
`packages/core/src/diagnostics/` directory rather than modifying logic. The only edit to
an existing file is wiring the new barrel export into `src/index.ts`.

> **Note on test globs:** `vitest.config.ts` currently includes only `*.spec.test.ts`. RD-01
> reserved `*.impl.test.ts` for logic tiers (RD-02+). This plan introduces the first real
> logic, so impl tests use `*.impl.test.ts` — the per-package glob must include them. This
> is captured as a task in 99 (extend the `include` glob to `src/**/*.{spec,impl}.test.ts`),
> consistent with the RD-01 convention that impl tests arrive "with RD-02+".

## Gaps Identified

### Gap 1: No diagnostics types exist

**Current Behavior:** No compiler phase can emit a diagnostic; no span type exists.
**Required Behavior:** The full RD-11 diagnostics-core API exists and is exported.
**Fix Required:** Implement the span model, `LineMap`, `Diagnostic`, `DiagnosticBag`, and
the code namespace per 03-01 and 03-02.

### Gap 2: `*.impl.test.ts` not yet discovered by Vitest

**Current Behavior:** `vitest.config.ts` globs only `*.spec.test.ts`.
**Required Behavior:** Both spec and impl test tiers run under `yarn test`.
**Fix Required:** Widen the `include` glob in `packages/core/vitest.config.ts` to
`src/**/*.{spec,impl}.test.ts`.

## Dependencies

### Internal Dependencies

- **RD-01** (done): provides the `@blend65/core` package scaffold and toolchain.

### External Dependencies

- None. No new npm packages. Pure TypeScript using built-in `string` UTF-16 semantics.

## Risks and Concerns

| Risk                                                                 | Likelihood | Impact | Mitigation                                                                 |
| -------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| UTF-16 vs byte-offset confusion in `LineMap`                         | Med        | High   | Spec tests assert exact columns for ASCII *and* multi-byte/surrogate input |
| Ordering tie-breaks (null spans, equal offsets) underspecified       | Med        | Med    | 03-02 defines a total order; ST cases lock it down                          |
| Building 11a "ahead" of RD-11 causes later divergence                | Low        | High   | Built verbatim to RD-11 §4.1–4.3 (AR-Q2); RD-11 plan inherits, not rewrites |
| `--max-errors` interaction with ICE / dedup ambiguous                | Med        | Med    | 03-02 fixes precedence: dedup first, ICEs uncapped, then error cap          |
| Widening test glob accidentally double-runs spec tests               | Low        | Low    | `{spec,impl}` brace glob is disjoint by filename suffix                     |
