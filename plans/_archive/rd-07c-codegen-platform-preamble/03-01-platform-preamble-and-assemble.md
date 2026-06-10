# Platform Preamble & `assembleProgram`: RD-07c

> **Document**: 03-01-platform-preamble-and-assemble.md
> **Parent**: [Index](00-index.md)

## Overview

This component specifies the two code changes RD-07c makes in `@blend65/codegen`:

1. **`assembleProgram(ilProgram, plugin, bag)`** — the additive wrapper that turns the
   preamble-less `InstrProgram` from `generateInstr` into a complete, platform-prefixed
   program (D2).
2. **Entry-label `_main` + real `sanitize()`** in `translate.ts` — so the entry function's
   stream is labelled `_main` (resolving the shim's `JSR _main`) and all other function
   labels are legal ACME (D4).

## Architecture

### Current

`generateInstr(ilProgram, cpuVariant, bag)` returns `{ preamble: [], streams, allocationPlan }`.
Function streams are labelled with the raw fqName (`Main.main`) via the identity-stub
`sanitize()`. No platform data reaches codegen.

### Proposed

```
assembleProgram(ilProgram, plugin, bag)
  ├─ program = generateInstr(ilProgram, plugin.profile.cpuVariant, bag)   // unchanged
  ├─ options = derivePreambleOptions(ilProgram)                            // D3
  ├─ preamble = plugin.emitPreamble(options)                              // RD-10 hook
  └─ return { ...program, preamble: Object.freeze(preamble) }
```

`translateFunction` is unchanged in signature; only `sanitize()` becomes real and the entry
function (bare name `main`) is mapped to `_main`.

## Implementation Details

### `assembleProgram` (FR-1/FR-2/FR-3/FR-8/FR-9)

Lives in `packages/codegen/src/instr/instr-program.ts` (alongside `generateInstr`).

```typescript
import type { PlatformPlugin, PreambleOptions } from "@blend65/core";

/**
 * Assemble a complete, platform-prefixed program: run {@link generateInstr} for the
 * plugin's CPU variant, then populate the preamble from the plugin's `emitPreamble`
 * hook (RD-07c D2; R46/R47/R55). `generateInstr` is unchanged — this wrapper is the
 * additive seam RD-07b documented.
 *
 * @param ilProgram The (optimized) IL program (RD-06) — carries its `AllocationPlan`.
 * @param plugin The active platform plugin (RD-10) — supplies the CPU variant + preamble.
 * @param bag Diagnostic sink (cost warnings + ICEs from translation).
 * @returns A frozen {@link InstrProgram} with a populated `preamble`.
 */
export function assembleProgram(
  ilProgram: ILProgram,
  plugin: PlatformPlugin,
  bag: DiagnosticBag,
): InstrProgram {
  const program = generateInstr(ilProgram, plugin.profile.cpu, bag);
  const options = derivePreambleOptions(ilProgram);
  const preamble = plugin.emitPreamble(options);
  return Object.freeze({
    preamble: Object.freeze([...preamble]),
    streams: program.streams,
    allocationPlan: program.allocationPlan,
  });
}
```

> **Note on `plugin.profile.cpu`:** the `PlatformProfile.cpu` field is the `CpuVariant`
> (`"nmos6502" | "wdc65c02"`) `generateInstr` expects. If the field name differs in the
> shipped profile type, use the actual field — this is a code fact to confirm against
> `@blend65/core/platform`'s `PlatformProfile`, not a design choice.

### `derivePreambleOptions` (FR-3/FR-4/FR-5, D3)

```typescript
/**
 * Derive {@link PreambleOptions} from the IL program (RD-07c D3, Half-A rule).
 *
 * SEAM (Half B): real `main`-termination + block-layout analysis is deferred (it needs
 * the multi-block CFG RD-06 does not yet lower). The Half-A rule is correct for every
 * program the live single-block lowering can produce:
 *   - shimVariant = "terminating"  (the entry function's single block ends in `ret`)
 *   - needsBssZero = the plan reserves a mutable/BSS region
 *   - needsDataInit = the program has const/initialised data to copy
 * For the gate program both flags are false. When CFG lowering lands, the fall-through
 * optimization (D8) and true termination analysis replace this rule.
 */
function derivePreambleOptions(ilProgram: ILProgram): PreambleOptions {
  return {
    projectName: "main", // FR-3: RD-15 driver overrides; no live driver yet
    shimVariant: "terminating", // FR-4: Half-A rule
    needsBssZero: false, // FR-5: no BSS region in the gate plan
    needsDataInit: ilProgram.constData.length > 0, // FR-5
  };
}
```

> `needsBssZero` stays `false` in the slice: the live `AllocationPlan` does not yet expose a
> distinct mutable/BSS region to key off, and the gate has none. This is documented as part
> of the same Half-B seam; the value is conservative (no spurious BSS-zeroing).

### Entry-label `_main` + `sanitize()` (FR-6/FR-7, D4)

In `packages/codegen/src/instr/translate.ts`:

```typescript
/** The unqualified entry-point function name (spec Ch 10 — exactly one `main`). */
const ENTRY_FUNCTION = "main";

/** The special ACME label for the program entry point (RD-09 R15/R19, RD-10 §4.6). */
const ENTRY_LABEL = "_main";

/**
 * The ACME-legal label for a function stream (R47/R15, D4):
 *   - the unique entry function (fqName ending in `.main`) → `_main`
 *   - every other `Module.function` → `Module_function` (`.`→`_`)
 * Only `[A-Za-z0-9_]` survive; the `__` prefix stays reserved for compiler symbols.
 */
function sanitize(fqName: string): string {
  if (isEntryFunction(fqName)) {
    return ENTRY_LABEL;
  }
  return fqName.replaceAll(".", "_");
}

/** True when `fqName` names the program entry point (`Module.main`). */
function isEntryFunction(fqName: string): boolean {
  const dot = fqName.lastIndexOf(".");
  const bare = dot >= 0 ? fqName.slice(dot + 1) : fqName;
  return bare === ENTRY_FUNCTION;
}
```

`run()` already calls `label(sanitize(this.fn.name))` for the entry label — so making
`sanitize()` real is the only translator change. The stream's `symbol` field keeps the fqName
(used internally); only the emitted *label* is sanitized. (If RD-09 later needs the sanitized
symbol on the stream too, that is an RD-09 concern.)

### Barrel export (FR-9)

`packages/codegen/src/index.ts` already does `export * from "./instr/index.js"`. Ensure
`instr/index.ts` re-exports `assembleProgram` from `instr-program.js` (it already re-exports
`generateInstr`/`programByteSize`).

## Integration Points

- **RD-10 plugin** — consumed via the `PlatformPlugin` type (from `@blend65/core`); the live
  `c64Plugin` (from `@blend65/platforms`, test-only) drives the golden.
- **RD-09 (next)** — will serialize `InstrProgram` (preamble → code → data) to the `.asm`
  file; `assembleProgram` is the function it calls to obtain a preamble-complete program.
- **RD-15 (later)** — the build driver passes the real `projectName` and the resolved plugin.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| IL contains a deferred op | Unchanged — `translateFunction` raises `E90001` (RD-07b D7); `assembleProgram` does not suppress it | D1 |
| Plugin profile has no `cpu` variant | Type-level guarantee (`PlatformProfile.cpu` is required); no runtime branch | D2 |
| Multiple `main` functions / none | Out of scope — a semantic error (E10020/E10021) caught upstream in RD-04; `sanitize` simply maps by bare name | D4 |

> **Traceability:** every choice above references the Ambiguity Register
> (`00-ambiguity-register.md`).

## Testing Requirements

- Spec tests (ST-A*) for `assembleProgram` preamble population, entry-label `_main`, non-entry
  sanitization, determinism — written before implementation.
- End-to-end golden (ST-AG1) — gate IL → `assembleProgram(c64Plugin)` → `printInstr` over
  preamble + streams = the exact ACME text (preamble from ST-C64-2 + `_main:` body).
- Impl tests — `programByteSize` counts the populated preamble; multi-function sanitization.
