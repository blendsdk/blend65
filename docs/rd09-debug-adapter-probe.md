# RD-09 VICE Debug Adapter Probe

> **Status**: Bounded interoperability probe — no maintained adapter installed
> **Date**: 2026-11-10
> **Debug schema**: `blend65.debug` version 1
> **VICE**: `x64sc` (VICE 3.10) at `/home/gevik/.local/bin/x64sc`
> **Host**: Linux x64, Node v22.23.1

## Result

No maintained VICE-capable debugger adapter was available in the qualification environment.
The probe therefore records the adapter dimension as **unsupported (not installed)** rather than
claiming a working source-debugging integration. The translation table below is the checked-in
mapping a later probe must exercise against a real adapter. No Blend65-owned DAP service,
adapter bundle, or support claim is shipped.

## Commands and evidence

```text
$ command -v x64sc
/home/gevik/.local/bin/x64sc
$ x64sc -version
x64sc (VICE 3.10)

$ command -v dap debugadapter vice-dap vscode-vice
(no output)

$ ls node_modules/@vscode
(no output)
```

The only local package containing `debug` is the unrelated generic `debug` logging package. No
`@vscode/debugadapter`, no VICE DAP server, and no maintained third-party adapter is installed.

## Required mapping

| `.debug.json` fact | Adapter/DAP destination | Current result |
| ------------------ | ----------------------- | -------------- |
| `sources[].path`, `sha256`, `byteLength` | Source map and source hashes | Supported by the schema; not exercised without an adapter |
| `functions[].declaration`, `entryVariants`, `rangeIndexes` | Function breakpoints and entry locations | Supported by the schema; not exercised |
| `ranges[].machine`, `origin`, `contextIndex` | Source/instruction stepping and breakpoint resolution | Supported by the schema; not exercised |
| `symbols[]` plus `locations[]` | Watch/REPL variable discovery | Supported for available memory/register pieces; **lossy** for `optimizedAway`, `constant`, `rematerializable`, and `unavailable` values |
| `loadUnits[]` plus `residence` | Bank/load-unit stepping and memory interpretation | Supported by the schema for D64 residence; not exercised |
| `addressSpaces[]` and optional `bankIndex` | Address-space/bank-aware memory reads | Supported by the schema; current C64 profiles emit `cpu16` only |

## Available vs unavailable inspection

- **Available** memory and register pieces can be read exactly at the recorded final machine range.
- **Constant** values may be reconstructed from the recorded compile-time value.
- **Rematerializable** values require the consumer to reproduce the recorded transformation.
- **Optimized-away** and **unavailable** values must be reported as unavailable; the adapter must
  not display a stale home or a guessed value.

## Reproduction procedure for a later probe

1. Install one maintained VICE-capable adapter and record its exact version or commit.
2. Start `x64sc` through the adapter and load a published `.prg` from one immutable generation.
3. Translate the generation's `.debug.json` with the mapping table above.
4. Exercise one source breakpoint, one source step, one instruction step, and one available,
   one constant, one rematerializable, and one unavailable variable.
5. Record each result as `supported`, `lossy`, or `unsupported` with the exact commands and
   observed output.

This report is not a deferral of the probe; it is the probe result for the current environment.
Re-run it when an adapter is installed. RD-10 owns native user-host qualification.
