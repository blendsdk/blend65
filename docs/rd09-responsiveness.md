# RD-09 Responsiveness Observations

> **Status**: Observational — no wall-clock assertion or release gate
> **Date**: 2026-11-10
> **Host**: Linux x64, Node v22.23.1
> **Tools**: ACME 0.97, VICE 3.10 `x64sc`

These measurements describe one small synthetic project on the development host. They are trend
data, not acceptance thresholds. No test or CI gate reads them.

| Operation | Observed | Fixture |
| --------- | -------- | ------- |
| `checkProject` | 116 ms | `dbgval` fixture: one module, two globals, three helper operations |
| `buildProject` (ACME + publication) | 283 ms | Same fixture, `none` mode, PRG profile |
| Peak host RSS for the check/build process | 96,692 KB | Same process, includes Node and ACME child |
| Real stdio LSP suite | 4 tests in 1.13 s | Server startup, diagnostics, completion, hover, signature, definition, references, rename, symbols, tokens, formatting |
| Canonical formatter | 5 tests in 8 ms | Representative document with comments and literals |
| D64 evidence build | 284 ms | Two-component D64 with one loadable unit |
| CLI evidence lookup | 284 ms end-to-end | Real published generation |

## Interpretation

- The editor path is dominated by one process start and one project load; individual queries are
  sub-millisecond after analysis.
- Build time is dominated by ACME and publication, not debug evidence. The zero-target-cost test
  proves target artifacts are byte-identical when only host debug observation differs.
- The 20-block D64 load measurement remains the RD-07 record: 5,000 bytes in 512 PAL jiffies
  (8.53 s emulated). It is not repeated here.
- No incremental compiler, persistent cache, daemon, or worker pool is introduced. Reopen
  incremental analysis only if a real project shows a measured need.
