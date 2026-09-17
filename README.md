# Blend65

Blend65 is a statically typed language and ahead-of-time compiler for 6502-family
machines. Modern source code and expert-quality machine code are the product
goals. This checkout is the clean v4 rebuild, not the operational v3 compiler.

## Current status

The language specification is frozen at **4.0**. The Phase 1 library provides
pure JSONC manifest validation, exact project-name validation, structured
diagnostics and UTF-8 byte-position conversion. RD-02 project loading and the CLI
are still later work; do not treat this foundation as a usable compiler.

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
- `test/` — direct foundation and import-boundary tests.
- `spec/` — frozen Specification 4.0; never edited during implementation.
- `.agents/skills/blend65-domain-expert/` — frozen, qualified expert authority.
- `codeops/features/blend65-v4/` — current requirements, plan and roadmap.
- `research/` — retained historical research.

The CLI package is added only when its actual behavior lands.

## License

To be determined. No license has been chosen for this line of development.
Until one is added, all rights are reserved.
