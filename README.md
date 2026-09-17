# Blend65

Blend65 is a statically typed language and ahead-of-time compiler for 6502-family
machines. Modern source code and expert-quality machine code are the product
goals. This checkout is the clean v4 rebuild, not the operational v3 compiler.

## Current status

The language specification is frozen at **4.0**. The Phase 1 library provides
pure JSONC manifest validation, exact project-name validation, structured
diagnostics and UTF-8 byte-position conversion. The library also loads contained,
immutable project snapshots through `loadProject`, with exact input hashes and
bounded retries. The CLI provides help, version and the same project loading.
This is not yet a usable compiler. Native Linux checks pass; Windows qualification
is still pending.

This foundation does not compile Blend65 source, emit assembly, assemble binaries,
or run emulators. Recognizing a target profile in a manifest is not a claim that
its compiler pipeline exists. See the [v4 roadmap](codeops/features/blend65-v4/00-roadmap.md)
and [RD-02 plan](codeops/features/blend65-v4/plans/rd-02-clean-v4-foundation-and-deterministic-project-model/00-index.md).

Rejected v3 code and fixtures remain recoverable from Git and the parked v3
checkout. Retained historical CodeOps records and research are reference evidence,
not current implementation status. No copied legacy runtime is maintained here.

## Development

Requires Node.js 22 and Yarn classic 1.22.22. The replacement toolchain uses the
normal stable TypeScript 7 package, `tsc --build`, Turbo and Vitest. Run:

```sh
yarn install --frozen-lockfile
yarn build
yarn typecheck
yarn test
```

Prettier provides targeted formatting checks. There is no semantic linter or
bundler. RD-02 checks require no assembler or emulator.

## Repository layout

- `packages/compiler/` — the real project library; no placeholder compiler stages.
- `packages/cli/` — the thin `blendc` project-loading consumer.
- `examples/foundation/` — legal source input, not a compiled or running program.
- `test/` — direct foundation and import-boundary tests.
- `spec/` — frozen Specification 4.0; never edited during implementation.
- `.agents/skills/blend65-domain-expert/` — frozen, qualified expert authority.
- `codeops/features/blend65-v4/` — current requirements, plan and roadmap.
- `research/` — retained historical research.

## Project loading

After building, run the CLI directly:

```sh
node packages/cli/dist/bin.js --help
node packages/cli/dist/bin.js --project examples/foundation/blend65.json
```

The CLI's installed binary is `blendc`. For a development workspace `yarn blendc`
shim, rerun `yarn install --force --frozen-lockfile` after building.
With no arguments it searches for the
nearest ancestor `blend65.json`. `--project PATH` selects an authoritative
manifest. `--target PROFILE` and `--entry MODULE` select invocation-only overrides;
they do not edit the manifest. Options accept separate values or `--key=value`.
No `check`, `build` or `run` command exists yet.

Successful loading prints the project name and source count, followed by
`no compilation performed`. Exit codes are 0 for load/help/version, 1 for an
invalid project and 2 for invalid arguments. Failures show safe relative input
locations in UTF-8 bytes, plus known help. Loading never creates an output
directory or changes previous output.

Library consumers use the same service through the public package:

```typescript
import { loadProject } from "@blend65/compiler";

const result = await loadProject({ project: "examples/foundation/blend65.json" });
```

A successful result contains a complete immutable snapshot and host observations.
A failure contains diagnostics, with no usable partial snapshot.

## License

To be determined. No license has been chosen for this line of development.
Until one is added, all rights are reserved.
