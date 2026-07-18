# Parity Scripts: twin-diff, annotate-cycles

> **Document**: 03-04-parity-scripts.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 F5/F6/F9 (AC-5, AC-6, AC-9) · req-AR #8, #9, #10, #11 · plan-AR #5, #7, #11

## Overview

Two repo-root Node scripts (ESM `.mjs`, the `gen-capability-matrix.mjs` conventions: fail
loudly, canonicalize paths, argv-array spawns only). Both import the built
`@blend65/core/platform` for timing (PF-016) and `@blend65/compiler` for the balloon build and
the shared ACME report parser (plan-AR #5, PF-010; a missing `dist/` fails with a clear "run
yarn build first" message).

## Shared acquisition — the ACME report parser (PF-010)

`packages/compiler/src/acme/report-file.ts` (new; sibling of `label-file.ts`, the established
home for ACME-artifact parsing): parses an ACME `--report` file into
`{ address, bytes, opcode, mode }` records typed on core's `instr-model` unions. Final
addresses/operand bytes decide the addressing mode **exactly** — zeropage-vs-absolute is
undecidable from asm text with symbolic operands, which is why no consumer parses raw asm.
Strict and loud: malformed lines fail naming the file + line. This one module serves all three
cost consumers — the budget tier's static windows (03-03), twin-diff, and annotate-cycles —
concentrating the ACME-format risk in one version-gated place. Exported from
`@blend65/compiler`.

## `scripts/twin-diff.mjs` (alias `yarn twin:diff`)

- **Manifest** `packages/test-harness/test/golden/twins.json` (plan-AR #7): maps golden →
  twin. Goldens pair with `<fixture>.twin.asm` siblings; the balloon entry maps the
  generated-at-run-time balloon build (compiled via the `build()` facade into a temp dir, never
  committed) to `examples/balloon/balloon.asm` (req-AR #10; RD §pair manifest).
- Per pair: **assemble both sides via ACME** (argv array, `--report` + `--vicelabels`; the
  generated side's build already produced its artifacts, the twin side is assembled into a temp
  dir; `hasAcme()`-guarded locally, ACME present in CI) and obtain each side's instruction
  stream through the shared report parser — hand-written twins included (PF-010); categorize
  every divergence into exactly one of the five req-AR #9 categories (instruction selection,
  layout, data placement, addressing modes, register usage); compute parity ratios (generated ÷
  hand-written, two decimals): **bytes** from the assembled PRG sizes, **cycles** as the
  max-sum ÷ max-sum of the straight-line spans (worst-case cost is the headline metric; the
  JSON output carries min and max sums per side — PF-015).
- Output: markdown scoreboard to stdout; `--json <file>` writes the same content as JSON
  (req-AR #11). Missing twins listed as "unpaired", exit 0 (RD §pair manifest — useful from day
  one with a single pair).
- CI: step **"twin-diff (informational)"** appended after tests in the existing job — never
  fails the build (req-AR #11; plan-AR #11).

## `scripts/annotate-cycles.mjs` (alias `yarn annotate:cycles`)

- Input: an ACME report file (req-AR #8 — final addresses make page-cross detection exact and
  macro/`!fill` twins parseable), read through the same shared report parser (PF-010). Emits
  the listing with per-instruction cycle counts (`min–max` where branch/page-cross variable,
  via `getTiming`) and per-block sums (block = label or branch boundary; req-AR #7 semantics).
- **F9 convenience flag**: given a `.asm` and the assemble flag, invoke ACME (argv array) with
  `-r <tmp report>` first, then annotate (req-AR #8).

## Security (RD §Security Considerations — binding for both scripts)

- Canonicalize every input path; reject resolution outside the repo root (no `..` traversal).
- Spawn ACME via argv arrays only; no `eval`/dynamic code.
- Malformed manifest / budgets / ACME-report input fails with a clear error before any output
  is written.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Path outside repo root | Reject before any FS access, named error, exit ≠ 0 | RD AC-9 |
| Built packages missing | "run yarn build first" error, exit ≠ 0 | plan-AR #5 |
| Malformed manifest / report file | Named parse error before output | RD §Technical Requirements |
| Missing twin | "unpaired" listing, exit 0 | RD AC-5 |

## Testing Requirements
- Spec: ST-20…ST-26 (07 §Parity Scripts) at repo-root `test/twin-diff.spec.test.ts` and
  `test/annotate-cycles.spec.test.ts` (plan-AR #7 — the root tier already runs `vitest run test/`);
  ST-32/ST-33 for the shared report parser (`compiler/src/acme/report-file.spec.test.ts`).
- Impl: category-classifier internals, ratio math, ACME-report parser edge cases.
