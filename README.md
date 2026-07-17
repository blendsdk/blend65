# Blend65

> ## ⚠️ Heavy development — not ready for real use
>
> **Blend65 is an experimental compiler under active, heavy development. Do not
> expect to build real programs with it yet.**
>
> Syntax, APIs, diagnostics, and generated output all change without notice.
> There are no releases, no stability guarantees, and no promise that the code
> it emits is correct or complete for your program. What compiles and runs today
> may break tomorrow. This repository is shared in the open as a work in
> progress — a research compiler being built in the open — **not** as a toolchain
> you can depend on.
>
> If you're here to explore the design, read the code, or follow along: welcome.
> If you're here to ship a game on real hardware: not yet.

## What is Blend65?

Blend65 is a statically-typed systems language and ahead-of-time compiler that
targets 6502-based retro platforms — the Commodore 64 (and C64 Ultimate),
Commander X16, and the Atari 800XL / 7800. The language pairs modern,
strongly-typed constructs with direct, idiomatic hardware access, and compiles
straight to 6502 assembly. The guiding benchmark is simple and strict: the code
the compiler emits should read like what an expert 6502 assembly programmer
would hand-write for a commercial game.

## Current status

Honest snapshot, not a sales pitch:

- **What works today:** the frozen v3 language compiles end-to-end to 6502
  assembly, and a set of acceptance examples are verified running on emulated
  real hardware (VICE). The lexer, parser, semantic analyzer, static frame
  allocator, and code generator are all in place for the current language slice.
- **What does *not* work yet:** the generated code is **unoptimized** (no
  cycle/byte optimizer has landed), and large parts of the capability surface a
  real game needs — disk/data loading, fixed-point/float math, sampled audio,
  hand-tuned asm linking, indirect calls/dispatch — are unimplemented or
  unscheduled. Coverage is partial and correctness is not guaranteed outside the
  tested examples.

For a concrete, capability-by-capability view of *what could actually be built
today*, see the **[C64 game feasibility matrix](docs/game-feasibility-matrix.html)**
(open the generated HTML locally). The living implementation status lives in
`codeops/features/blend65-ri/00-roadmap.md`.

## Target platforms

| Platform | Notes |
|---|---|
| Commodore 64 | Primary target; acceptance examples verified on VICE. |
| C64 Ultimate | C64-compatible target. |
| Commander X16 | Supported target. |
| Atari 800XL | Supported target. |
| Atari 7800 | Supported target. |

## Building from source

Requires **Node.js 22** (pinned via `.nvmrc`) and **Yarn classic (v1)**.

```sh
yarn install          # install workspace dependencies
yarn build            # build all packages (tsc --build across the monorepo)
yarn typecheck        # type-check
yarn lint             # ESLint + Prettier
yarn test             # run the test suites
```

The compiler is a TypeScript monorepo (`@blend65/*` packages) orchestrated with
Turborepo; the CLI is `blendc`. Some acceptance tiers require the VICE 3.10
emulator and the ACME assembler installed locally — they are skipped otherwise.

## Repository layout

- `packages/` — the `@blend65/*` compiler, CLI, and tooling packages.
- `spec/` — the frozen Blend65 language specification (v3.0).
- `examples/` — per-feature acceptance fixtures, verified on emulated hardware.
- `docs/` — documentation, including the game-feasibility matrix.
- `codeops/` — requirements, roadmap, and implementation plans.

## License

**To be determined.** No license has been chosen for this line of development
yet — until one is added here, all rights are reserved and you should treat the
code as look-but-don't-reuse.

---

*Blend65 is built and reviewed through the lens of an expert 6502 assembly game
developer: generated code is held to hand-written-idiom quality, and data is
placed where the hardware reads it rather than copied.*
