# Current State: RD-02 Foundation

> **Parent**: [Index](00-index.md)
> **Observed**: 2026-09-17

## Verified Starting Position

The v4 checkout is on `feature/v4-rebuild`, descended from the Phase 0 source
commit. The parked v3 evidence checkout remains clean at its recorded commit.
RD-01 is Done. Its final active authorities are recorded in
[its closeout](../rd-01-specification-4-and-expert-authority-freeze/08-closeout.md).
The first RD-02 planning checkpoint is `f473879`; it changes no implementation.

## Inherited Evidence

| Evidence | Observed behavior | Planning consequence |
|---|---|---|
| Root `package.json:13–59` | Twelve-workspace graph, TypeScript 5, ESLint, Vite, readiness and scoreboard scripts | Replace ownership, not merely version-bump the existing graph |
| `tsconfig.json:3–16`, `turbo.json:3–17` | Existing references and Turbo dependency/build roles | Adapt the useful task pattern to real v4 packages |
| `packages/config/package.json:17–20` | Existing `jsonc-parser` 3.3.1 dependency and discarded core coupling | Retain the dependency; do not retain the config package |
| `packages/config/src/parse.ts:47–93` | Small UTF-16→UTF-8 converter; parser strips BOM and returns recovered values | Assess converter independently; preserve raw-byte identity and reject partial manifest results |
| `packages/config/src/discovery.ts:21–41` | Small upward discovery walk | Candidate adaptation, subject to focused v4 proof |
| `packages/core/src/diagnostics/source-span.ts:18–32` | Numeric registry IDs | Do not port the source-ID policy; v4 uses exact relative spelling |
| `packages/core/src/diagnostics/line-map.ts:83–123` | Explicit UTF-8/UTF-16 coordinate distinction | Reuse the idea; assess individual implementation units before copying |
| `test/boundary.spec.test.ts:1–51` | Boundary proof invokes ESLint and injects files into production packages | Re-author a direct source/dependency test, without ESLint |
| `.github/workflows/ci.yml:1–76` | Linux job includes lint, ACME, readiness-oriented root tests and scoreboards | Adapt the existing job to foundation-only native-host checks |
| `packages/cli/src/args.ts` | Yargs-based compiler commands and obsolete option surface | Rewrite the small RD-02 shell with Node argument parsing; do not port compiler claims |

These are candidate-level observations, not the complete salvage inventory.
Execution must finish that inventory before porting or deleting anything.
The [recovery audit](../../../blend65-ri/01-expert-recovery-audit.md), especially
A-010 and its preservation/removal sections, remains historical evidence, not
Specification 4 authority.

## Risks

| Risk | Direct control |
|---|---|
| Broken deletion-only checkpoint | Keep the whole transition uncommitted until Phase 1 is green |
| Existing tests become accidental authority | New spec-author packets contain the RD/contracts only; inventory removes rejected suites |
| False snapshot immutability through exposed buffers | Public content is immutable text; freeze returned records and arrays |
| Paths or concurrent edits invalidate reads | `03-02` owns containment, handle identity, revalidation, and bounded failure |
| TypeScript 7 lacks the old compiler API | The boundary test must not import the TypeScript compiler API or add a TS6 compatibility package |
| Windows behavior is asserted without native evidence | `03-03` requires actual native-host qualification |

## Dependencies

RD-01 is closed. Node 22, Yarn classic, Turbo, Vitest, Prettier, and the existing
JSONC dependency supply the foundation roles. Stable TypeScript 7 must be verified
at implementation time from the normal package and pinned exactly. No assembler,
emulator, backend, editor service, or future target is a prerequisite for this RD.
