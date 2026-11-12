# Blend65

Blend65 is a statically typed language and ahead-of-time compiler for 6502-family
machines. Modern source code and expert-quality machine code are the product
goals. This checkout is the clean v4 rebuild, not the operational v3 compiler.

## Current status

The language specification is frozen at **4.0**. The v4 compiler implements the complete
normative language, C64 KERNAL profiles, native assets, loadable D64 delivery, the optimizer,
the CLI, the language server, and the VS Code extension. The v4 production candidate is qualified
on `linux/x64` for the eight resident PRG profiles
(`c64-{pal|ntsc}-prg-{kernal|takeover}-{6581|8580}`) and the one `c64-pal-d64-kernal-6581`
profile; the four takeover rows were approved on 2026-11-12. Runtime evidence
is **VICE-verified / hardware-unverified**; no physical C64, drive, or SID unit is available.

The release does **not** claim source-installed raw NMI (`V4-TAKEOVER-F2`), raw-MMIO
interrupt source containment (`V4-TAKEOVER-F3`), native Windows or macOS hosts
(`V4-HOST-1`), physical timing/analogue/drive behavior (`V4-HW-1`), C64U target support
(handoff only), CharPad 3.88 producer evidence, or the GoatTracker 2.77 adapter. See the
[release record](docs/releases/v4-production-qualification.md) for the exact support statement and
the [v4 roadmap](codeops/features/blend65-v4/00-roadmap.md) for current ownership.

Rejected v3 code and fixtures remain recoverable from Git and the parked v3 checkout. Retained
historical CodeOps records and research are reference evidence, not current implementation status.
No copied legacy runtime is maintained here.

## Development

Requires Node.js 22 or newer and Yarn classic 1.22.22. The compiler and CLI use the normal stable
TypeScript 7 package, `tsc --build`, Turbo and Vitest. The editor packages add Vite for their
bundles. Run:

```sh
yarn install --frozen-lockfile
yarn build
yarn typecheck
yarn test
```

Prettier provides targeted formatting checks. There is no semantic linter. Full local runtime
qualification also needs ACME 0.97 and VICE 3.10 `x64sc`; `check` and ordinary language-server
analysis need neither.

## Repository layout

- `packages/compiler/` — compiler library, frontend, target profiles, assets, layout, optimizer,
  publication, and public services.
- `packages/cli/` — the `blendc` command-line interface.
- `packages/language-server/` — the frontend-only language server.
- `packages/vscode/` — the thin VS Code client and local VSIX.
- `examples/` — source examples and workload inputs.
- `test/` — specification and implementation tests, including VICE journeys.
- `spec/` — frozen Specification 4.0; never edited during implementation.
- `.agents/skills/blend65-domain-expert/` — frozen, qualified expert authority.
- `codeops/features/blend65-v4/` — current requirements, plan and roadmap.
- `research/` — retained historical research.

## Build and run

After building, use the CLI directly:

```sh
node packages/cli/dist/bin.js check --project examples/foundation/blend65.json
node packages/cli/dist/bin.js build --project examples/foundation/blend65.json
node packages/cli/dist/bin.js run --project examples/foundation/blend65.json
node packages/cli/dist/bin.js evidence --project examples/foundation/blend65.json
```

`blendc check` performs semantic analysis without tools. `build` requires ACME 0.97; `run` also
requires VICE 3.10 `x64sc`. Machine-local executable paths can be selected in
`${XDG_CONFIG_HOME:-$HOME/.config}/blend65/tools.jsonc` on Linux/macOS or
`%APPDATA%\blend65\tools.jsonc` on Windows; otherwise the CLI scans `PATH`. Add `--json` for the
machine-readable envelope. `build` publishes one immutable generation with `.asm`, `.labels`,
`.assets.json`, `.memory.json`, `.costs.json`, `.debug.json`, and `.build.json`.

Library consumers use the public package:

```typescript
import { buildProject, checkProject, runProject } from "@blend65/compiler";
import { loadProject } from "@blend65/compiler/frontend";
```

The installed package also exposes the host tools-file reader at `@blend65/compiler/tools`; the
compiler root and `frontend` entries never load it.

`boundsCheck` and `divisionZeroCheck` default to `false` in `blend65.json` and accept strict
booleans. The CLI can override them per invocation with `--bounds-check true|false` and
`--division-zero-check true|false`; these checks trade target bytes/cycles for runtime safety and
are not enabled silently.

A successful result contains a complete immutable snapshot and host observations.
A failure contains diagnostics, with no usable partial snapshot.

## License

To be determined. No license has been chosen for this line of development.
Until one is added, all rights are reserved.
