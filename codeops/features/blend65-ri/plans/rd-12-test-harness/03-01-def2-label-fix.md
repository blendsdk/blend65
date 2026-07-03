# DEF-2: VICE Label Fix (Phase-0 Prerequisite)

> **Document**: 03-01-def2-label-fix.md
> **Parent**: [Index](00-index.md)
> **Covers**: AR-H7 · RD-09 R45–R47 · RD-12 R19/R20/R28 · roadmap DEF-2

## Overview

Before any harness code is written, this phase fixes the latent RD-09 defect that makes the
compiler's `symbolMap` empty for every real build (Gap 1 in `02-current-state.md`). Without
it, `runUntilLabel` and symbolic `assertMemory` — load-bearing for RD-12 — would resolve
against an empty map. It is a one-flag change plus a new regression oracle.

## Architecture

### Current Architecture

`packages/compiler/src/acme/invoke-acme.ts` → `acmeArgv(inv)`:

```typescript
function acmeArgv(inv: AcmeInvocation): string[] {
  return ["-l", inv.labelPath, "--report", inv.reportPath, inv.asmPath];
}
```

ACME's `-l` (alias of `--symbollist`) writes its **native** label format
(`\t<name>\t= $<addr>\t; <comment>`). `parseLabelFile` matches only the **VICE** format
(`al C:<addr> .<name>`), so it skips every line (R47 total-parse) → empty `symbolMap`.

### Proposed Changes

Emit VICE-format labels by switching the flag to ACME's `--vicelabels`:

```typescript
function acmeArgv(inv: AcmeInvocation): string[] {
  // --vicelabels (not -l/--symbollist): ACME's -l writes its native
  // `name = $addr` format, which parseLabelFile cannot read. --vicelabels emits
  // `al C:xxxx .name` — exactly the VICE format parseLabelFile parses (DEF-2, AR-H7).
  return ["--vicelabels", inv.labelPath, "--report", inv.reportPath, inv.asmPath];
}
```

The output **path** (`inv.labelPath`, `<outDir>/<name>.lbl`) is unchanged, so `emit-binary.ts`
step 5 (`parseLabelFile(deps.readFile(labelPath))`, `emit-binary.ts:122`) needs no change —
it now receives parseable content. The `AcmeInvocation.labelPath` JSDoc ("ACME `-l`",
`invoke-acme.ts:41`) and the `label-file.ts` header comment ("`-l`/`--labeldump` output is a
VICE-format symbol file") are corrected to name `--vicelabels`.

## Implementation Details

### Verified ground truth (live, this session)

A real `build()` of `examples/gate/main.blend` with `--vicelabels` produced:

| Symbol          | Address  |
| --------------- | -------- |
| `_main`         | `$0819`  |
| `__startup`     | `$080d`  |
| `__zp_arg_0..3` | `$02..$05` |
| `__zp_tmp_0..3` | `$06..$09` |
| `__zp_irq_tmp_0/1` | `$0a/$0b` |

These are the concrete keys the harness resolves (PF-004: pinned against real ACME output,
not assumed). Note `parseLabelFile` strips the leading `.` and `C:` prefix, so the map keys
are `_main`, `__startup`, `__zp_arg_0`, … (no dot).

### Integration Points

- **RD-15 `build()` / `emitBinary`** — now returns a populated `BuildResult.symbolMap`.
- **RD-11 resource report** — also consumes the symbol map (previously empty); the fix is a
  strict improvement; no report format change.
- **RD-12 fixture / strategies / assertions** — depend on the populated map.

## Error Handling

| Error Case                                        | Handling Strategy                                                                 | AR Ref |
| ------------------------------------------------- | --------------------------------------------------------------------------------- | ------ |
| ACME version lacks `--vicelabels`                 | `--vicelabels` is long-standing in ACME; a non-zero exit still ICEs via the existing `invokeAcme` exit-code path (R35). No new failure mode | AR-H7  |
| Label file still unparseable (unexpected format)  | `parseLabelFile` stays total (R47) — empty map, never throws; the new spec oracle catches a genuinely empty map in CI | R47    |

> **Traceability:** the flag choice and regression-oracle design trace to AR-H7; the label
> key format traces to RD-12 R19 / PF-004 and the live ACME output above.

## Testing Requirements

- **Spec oracle (new, CI, skipIf-ACME):** `packages/compiler/src/acme/vice-label.spec.test.ts`
  — assemble a fixture `.asm` (or run the gate `build()`), then assert the parsed
  `symbolMap` is non-empty and contains `_main === 0x0819` and `__startup === 0x080d`. This
  is the immutable oracle that would have caught DEF-2. Source: AR-H7, ST-01/ST-02.
- **Impl test update:** `invoke-acme.impl.test.ts` — change the argv assertion from
  containing `"-l"` to containing `"--vicelabels"` and **not** `"-l"`.
- **Regression:** full `@blend65/compiler` suite + root tier must stay green (the fix must
  not disturb the DEF-1 header behavior or the RD-09 golden tests).
