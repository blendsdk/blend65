# Task T-01: Preserve Empty Block Labels in ACME Output

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: Remaining RD-05 compiler correctness; [issue #90](https://github.com/blendsdk/blend65/issues/90)
> **Created**: 2026-09-27 19:14
> **Progress**: 0/6 tasks (0%)
> **Status**: Planned; execution awaits its effort confirmation

## Objective and Scope

Make ordinary runtime switches with returning clauses build and execute correctly. Fix the
terminal serializer's ordering of labels that occupy no bytes; do not change source semantics,
control-flow lowering, placement, SFA, instruction selection, or optimization.

| Boundary | Scope |
|---|---|
| Planning target | The general compiler defect in #90, carried by the [Stage A handoff](../rd-05-c64-platform/08-stage-a-handoff.md#deferral-expiry-and-remaining-owner). |
| Context | Frozen Chapter 05 §8/§9.3; existing CFG, block layout, ACME serializer/driver, artifact validation and public build/VICE test helpers. |
| Planning writes | This single mini-plan and the [feature roadmap](../../00-roadmap.md). No upstream requirement, frozen spec, expert skill, or completed Stage A record changes. |
| Implementation writes | `packages/compiler/src/artifacts/acme-serializer.ts`; three new test files named below; this checklist and the feature roadmap. |
| Excluded | New compiler pass/IR form/harness/dependency; deleting CFG blocks; padding or runtime workarounds; disabling strict segments; general switch optimization; NMI/IRQ, takeover, assets, Windows and physical qualification. |

This is an existing-behavior repair, not a new feature or language decision. The user confirmed
High for bounded repair planning. The lightweight task path needs no separate 00–07 document set
or ambiguity register. Any finding requiring a wider implementation surface pauses this task.

## Verified Diagnosis

Observed at `9e83eeed`, Linux Node 22.23.1, ACME 0.97, `c64-pal-prg-kernal-6581`,
documented NMOS 6510 instructions, `optimization: none`. Exact reproduction:

```blend
module Game;
function selected(value: byte): byte {
  switch (value) {
    case 1: return 11;
    case 2: return 22;
    default: return 99;
  }
}
function main(): void {
  poke($0425, selected(peek($0400)));
}
```

The public build fails with `assembler` / `ACME_EXECUTION`. A temporary observation wrapper
copies the generated source and invokes the unchanged real ACME command. Direct replay with
`--cpu 6502 --strict-segments --format cbm` fails at line 272:
`Segment starts inside another one, overwriting it.`

| Boundary | Evidence / status |
|---|---|
| Source meaning | Chapter 05 §8.5/§8.7 and §9.3 require runtime selection, default matching and ordinary returns. No source restriction is authorized. |
| Structured layout | `machine/block-layout.ts:19–46` counts instruction-free fallthrough/unreachable blocks as zero bytes and preserves their label addresses. |
| Terminal ordering | `artifacts/acme-serializer.ts:224–251` sorts only by origin, then emits an origin for every block. Startup is flattened first. |
| Concrete failure | The empty `switch-end` and startup restore both have origin `$099B`. Restore emits bytes through `$0AB9`; the later empty marker then resets ACME to `$099B`. |
| Isolated remedy proof | Moving only the empty label/origin pair before the restore block passes the same strict ACME command. Both labels remain `$099B`; no instruction, operand, target address or data byte is changed. |
| Runtime / compiler repair | Unknown: the edited temporary assembly is not a repaired compiler or a VICE result. Execution tasks below own those proofs. |

Temporary evidence root: `/tmp/blend65-switch90-plan-uVH507/`. Original source SHA-256:
`bc7e1582a204fa84926f9bb946740af2cd9758ff27d0e2058948c49362b7b925`.
Marker-first source: `48da9020f53a52463607e9fc365aa74187b2ccbda81c7cd7b5e70ca21a291e78`.
Its 699-byte PRG: `7fe8c8fbe0c3fa6d8e1ecbe54c95b07f026469104a0a8a362c307491df9b6cca`.
ACME executable: `19485b0605ddae23897d07cde5fd05c7e0c40eea530668db0b86e68e9f45c4f8`.
The source above and causal observations are durable; temporary files are supplementary.
The earliest affected historical commit is still not established and is not needed for this repair.

## Smallest Viable Design

Keep the existing origin sort. For equal origins, emit zero-byte blocks before blocks that emit
bytes, preserving existing relative order within each group. A zero-byte block has no instructions
and a `fallthrough` or `unreachable` terminator; a return-only block is not empty. Reuse these
existing structured distinctions, not a second instruction-size calculator or assembly-text parser.
Retain every block/function label and expected address. Keep strict-segment and artifact checks.

The repair's required cost delta is zero emitted instructions, bytes, executed cycles, RAM, ZP,
scratch and hardware-stack use. No padding, jump, storage home or runtime helper may be added.
Physical operation order and addresses stay fixed; only equal-address label presentation changes.
This preserves future peephole and whole-program optimization. It does not certify the existing
runtime-switch instruction chain as optimal.

Alternatives checked: removing empty CFG blocks changes upstream identity/reachability handling
unnecessarily; emitting label equates adds a second symbol-definition path without a need.
The strongest counterexample is an equal-address block that emits only a terminator: tests must
keep its byte ownership intact. Confidence: High for this diagnosed serializer defect; a different
reproducing boundary would reopen the scope rather than silently add a broader fix.

## Independent Test Contract

New specification files: `test/rd05/runtime-switch.spec.test.ts` and
`test/rd05/runtime-switch-vice.spec.test.ts`. Reuse the existing public `buildProject` API,
`test/rd05/profile-fixture.ts`, and `test/m1/vice-runtime.ts` / `vice-monitor.ts` unchanged.
The independent author receives this contract, Chapter 05 §8/§9.3 and helper signatures, not
the diagnosis/design sections or any production implementation file. All existing spec tests
and the new frozen test hashes remain immutable during implementation.

| Case | Independent expectation |
|---|---|
| Byte selector | Exact reproduction builds a reconciled PRG; inputs `1,2,0,255` return `11,22,99,99`. |
| Word selector | Cases `$0001,$0101`, default; inputs `$0001,$0101,$0000,$FFFF` return `11,22,99,99`. Both selector bytes matter. |
| Order and placement | Declare `main` before/after its helper; also place the helper at `$2000`. Every legal variant builds; explicit placement and all label/artifact checks remain valid. Avoid a full cross-product. |
| Exit preservation | An all-returning default, and a no-default switch with a return after it, preserve selected results. Explicit fallthrough still executes the next arm; auto-break never does. |
| Observable execution | Use runtime reads, not a constant-only selector. Observe exact result stores and one selector evaluation per invocation; preserve ordered effects and ordinary caller return. |

Run a compact byte/word runtime fixture sequentially on the pinned PAL/6581 VICE helper, observe
all listed inputs before restoration, then reach the captured BASIC caller with restored I/D and SP.
No user IRQ/NMI is installed. Reuse the established startup/return checkpoint pattern; add no
monitor capability. Missing ACME/VICE is a failed qualification, never a passing skip.

New implementation file: `packages/compiler/src/artifacts/acme-empty-blocks.impl.test.ts`.
Use existing structured fixtures and real ACME to cover multiple empty markers, reversed function
enumeration, fallthrough/unreachable markers, return-only blocks, and a genuinely overlapping
nonempty block that still fails. Independently specify the fixture's opcode bytes and all label
addresses. Check deterministic output and unchanged expected segment ranges; do not derive the
expected bytes from the serializer under test. No new fixture framework is authorized.

## Tasks — One Bounded Execution Batch

- [ ] T-01.1 [spec-author] Author the two specification files from the contract above; run them red and record intended build failures plus any preservation cases. Freeze their hashes before production edits.
- [ ] T-01.2 Apply only the equal-origin empty-block ordering correction in the existing serializer. Run new specification files green and the existing ACME/placement cases unchanged.
- [ ] T-01.3 Add the focused implementation cases, including exact independent byte/label expectations and real-overlap rejection. Verify deterministic serialization without a machine-cost or address delta.
- [ ] T-01.4 Record fresh PRG hashes, exact VICE observations and output costs. Compare byte/word switch paths with equal-contract expert assembly, separating caller/startup costs and page-cross conditions. Reuse an exact matching existing debt owner or file measured output gaps under the standing project directive; never call an inefficient sequence parity or expand this repair into an optimizer project.
- [ ] T-01.5 Run full verification and one independent whole-task review. Base correctness/maintainability/standards plus API-surface and output-preservation checks apply; no new public API or artifact version is allowed. Resolve findings before completion; at most one focused re-review after a major correction.
- [ ] T-01.6 Record the bounded outcome here and update T-01 on the feature roadmap. Keep full RD-05, AR-P3 and later work open. Make a coherent green local checkpoint with the git-commit skill; never push. Report evidence for #90 without editing or closing the issue unless separately authorized.

**Verify:** From the root, `yarn build`, then
`yarn vitest run test/rd05/runtime-switch.spec.test.ts test/rd05/runtime-switch-vice.spec.test.ts test/rd04/placement.impl.test.ts --testTimeout 30000`;
within `packages/compiler`, `yarn vitest run src/artifacts/acme-empty-blocks.impl.test.ts src/artifacts/acme.spec.test.ts src/artifacts/acme.impl.test.ts`.
Full checkpoint: `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`,
`yarn test --testTimeout 30000`, targeted Prettier, links/source keys, frozen-path/oracle checks.
The temporary root host timeout follows the verified Stage A command; no permanent configuration,
assertion, explicit deadline, emulated-cycle bound or cost expectation changes. VICE stays sequential.

## Authority and Planning Validation

The governing expert branch is `acme-and-artifacts.md#placement-alignment-and-segments` and
`#reports-labels-and-actual-bytes`; language routing is `blend65-semantics.md#authority-and-use`.
Source keys: `ACME-097-R266`, `VICE-310-SOURCE`, and frozen Specification 4 Chapter 05.
Expert `skillVersion=2.0.0`, content `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`;
normative digest `ee2be7c2139ff82f22d1d8f169251bae1d2244e5e4a74bddbdfc4903af39fff8`.
Compiler/language and serialized-artifact lenses apply; artifact schema, build-identity rules and
publication protocol do not change. No new input, authentication or network surface is introduced.

Plan-only validation: targeted formatting, local links/source references, six ordered task markers,
the real failing reproduction and the isolated ACME remedy probe. No compiler fix or runtime
qualification is claimed by this planning checkpoint.

Validated 2026-09-27 19:17: build and 14 unchanged ACME/placement tests pass; formatting,
35 local links/anchors, source keys and six pending tasks pass. Only the two planned Markdown
files changed. The roadmap counter check finds no feature-counter drift; its sole drift is the
previously deferred portfolio roll-up, left untouched on this non-integration branch.
