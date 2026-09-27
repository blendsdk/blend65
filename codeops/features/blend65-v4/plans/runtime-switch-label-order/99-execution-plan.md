# Task T-01: Preserve Empty Block Labels in ACME Output

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: Remaining RD-05 compiler correctness; [issue #90](https://github.com/blendsdk/blend65/issues/90)
> **Created**: 2026-09-27 19:14
> **Progress**: 6/6 tasks (100%)
> **Status**: Complete; the user-confirmed High six-task repair batch is verified
> **Last Updated**: 2026-09-27 20:50
> **Phase baseline tree**: `02843b192a3253e48aec818c4cd30a7fcbf915d8`
> **Scope mode**: strict; expected modification set is the six implementation/document paths listed below

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

- [x] T-01.1 [spec-author] Author the two specification files from the contract above; run them red and record intended build failures plus any preservation cases. Freeze their hashes before production edits. ✅ (completed: 2026-09-27 20:29)
- [x] T-01.2 Apply only the equal-origin empty-block ordering correction in the existing serializer. Run new specification files green and the existing ACME/placement cases unchanged. ✅ (completed: 2026-09-27 20:30)
- [x] T-01.3 Add the focused implementation cases, including exact independent byte/label expectations and real-overlap rejection. Verify deterministic serialization without a machine-cost or address delta. ✅ (completed: 2026-09-27 20:33)
- [x] T-01.4 Record fresh PRG hashes, exact VICE observations and output costs. Compare byte/word switch paths with equal-contract expert assembly, separating caller/startup costs and page-cross conditions. Reuse an exact matching existing debt owner or file measured output gaps under the standing project directive; never call an inefficient sequence parity or expand this repair into an optimizer project. ✅ (completed: 2026-09-27 20:38)
- [x] T-01.5 Run full verification and one independent whole-task review. Base correctness/maintainability/standards plus API-surface and output-preservation checks apply; no new public API or artifact version is allowed. Resolve findings before completion; at most one focused re-review after a major correction. ✅ (completed: 2026-09-27 20:48)
- [x] T-01.6 Record the bounded outcome here and update T-01 on the feature roadmap. Keep full RD-05, AR-P3 and later work open. Make a coherent green local checkpoint with the git-commit skill; never push. Report evidence for #90 without editing or closing the issue unless separately authorized. ✅ (completed: 2026-09-27 20:50)

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

## Execution Evidence

T-01.1: independent author read no production implementation. Eight tests: four expected
`ACME_EXECUTION` failures (exact byte, main-first byte, word, returning fallthrough);
four preservation passes (placed helper, no-default continuation, auto-break, combined VICE).
The combined runtime fixture's arrangement already avoids the terminal overlap; its pre-pass
protects semantics and return state rather than claiming to reproduce the artifact failure.
Red log: `/tmp/blend65-switch90-exec-kUv703/spec-red.log`. No production edit preceded it.

Frozen specification-test SHA-256:

- `test/rd05/runtime-switch.spec.test.ts`: `0b371853f642df395358aba5febd5e87c86a0667dca85045608f0e7282f16132`
- `test/rd05/runtime-switch-vice.spec.test.ts`: `f6695adbd0f0b68b962bf996009fb33a618b81327520db8bd0bca3316845f5f8`

T-01.2: build passes; all eight new specifications, four unchanged placement cases and ten
unchanged ACME cases pass. Logs: `build.log`, `spec-green.log`, `acme-existing.log` under the
execution evidence root above. The runtime preservation PRG remains byte-identical to red.
Only the serializer's equal-origin comparison and its private byte-emission predicate changed.

T-01.3: three new structured-fixture tests plus ten unchanged ACME tests pass
(`impl-retry.log`). Exact seven code bytes `A9 11 60 60 A9 22 60`, all thirteen labels and
both loaded intervals agree with independent constants in either function enumeration.
Fallthrough/unreachable markers remain stable; return-only blocks keep their bytes;
genuine overlapping nonempty blocks still fail real strict ACME. The first implementation-test
run exposed a test lookup assumption about encoded label names; it was corrected to use the
published name while retaining independently fixed addresses. No production or spec-test change.

### T-01.4 Artifact, Runtime and Cost Evidence

Status: **Verified complete** for the bounded empty-marker serialization repair (Fact), not
general switch optimization. Context remains PAL/6581, documented NMOS 6510, ACME 0.97,
optimization none, no user IRQ/NMI; VICE 3.10 uses the existing pinned executable/ROM helper.
Only the authorized serializer diff is present over `bc404907`.

| Fresh artifact | PRG bytes | SHA-256 |
|---|---:|---|
| Exact byte reproduction | 699 | `7fe8c8fbe0c3fa6d8e1ecbe54c95b07f026469104a0a8a362c307491df9b6cca` |
| Word counterpart | 733 | `04717e4a60f842b26a53be24da4cabcb56fa6f3a8a3a7b27aff1768758faac7f` |
| Combined sequential VICE fixture | Not recorded | `6214f25e36cfc3bd0f8a12965112ce80857b3d50425dd931eec01c83ac8258fb` |

Fresh byte/word builds are retained under `byte/out/95b7887a-6b0e-4f13-b02f-e0451decbd39`
and `word/out/51feaa95-5fc5-440d-92e7-b06892c7160d` beneath the execution evidence root.
The exact byte PRG also equals the independently marker-reordered planning probe (`cmp` passes).
The combined VICE PRG hash equals its pre-repair hash. All eight source-level spec tests pass.

VICE observations: byte and word results both `[11,22,99,99]`; effect bytes
`[7,11,22,0,11,0,0,11,99]`. The frozen test asserts the complete ordered 30-event input/store
trace (one evaluation per selector), explicit fallthrough, automatic break and no-default return.
Captured BASIC return is `$E147`; SP `$F6 → $F8`; P `$0C → $3C`, preserving I/D bits `$0C`;
binary D is clear at main entry. Status: **VICE-verified / hardware-unverified**.

The repair delta is **0 instructions / 0 bytes / 0 cycles / 0 RAM / 0 ZP / 0 scratch /
0 hardware-stack bytes**: physical operations, operands, addresses and layouts are unchanged.
Strict overlap and actual-byte reconciliation remain enabled. Future peephole, SFA and
whole-program optimization boundaries are untouched.

Existing output quality is **Incorrect** against the expert local floor, separately owned by
new [issue #91](https://github.com/blendsdk/blend65/issues/91), filed under standing authority.
The issue contains the complete reproducible source, actual bytes, equal-contract assembled
expert candidates, path counts, resource ledger and path to a whole-program win. Existing #51
covers related general block layout, but neither it nor #52 owns this full selector/equality gap.

| Helper cost, including RTS | Generated | Expert |
|---|---|---|
| Byte code / case 1 / case 2 / default | 26 B / 17 / 25 / 27 cycles | 20 B / 17 / 21 / 20 cycles |
| Word code / `$0001` / `$0101` / low-byte-mismatch default | 48 B / 31 / 53 / 55 cycles | 25 B / 23 / 27 / 17 cycles |
| Word default with low byte 1 and high byte not 0/1 | 55 cycles | 26 cycles |
| Parameter plus equality scratch RAM, byte / word | 1+0 B / 2+2 B | 1+0 B / 2+0 B |

Cycles are independently counted CPU service cycles, not raster/elapsed VICE timing. Actual
branches and assembled expert candidates stay within page `$09`; other placements add one cycle
per taken page-crossing branch. Both candidates return A, preserve their absolute parameter and
X/Y/V/I/D; C is dead at these source calls. No volatile parameter home, user interrupt route,
ZP, table, padding, extra save or runtime helper participates.

Surrounding costs stay separate: byte/word callers are 27/39 B and 37/53 cycles, including JSR
and final JMP but excluding helper RTS; startup entry 345 B/463 cycles; restore 287 B/393 cycles;
BASIC stub 12 B; startup-state RAM 50 B; total SFA reservations 5/9 B; total resident occupancy
752/790 B. Program call-stack peak is 2 B above main, platform reserve separately 20 B. These
unchanged surrounding sequences are not claimed expert-optimal. Loader/BASIC interpreter time,
DMA/IRQ jitter and physical timing remain unmeasured. No whole-program parity claim is made.

Additional lineage: `6502-lowering-casebook.md#equality-and-unsigned-comparison`,
`#boolean-values-and-control-flow`; `mos-6502-family.md#official-nmos-instruction-and-addressing-grid`;
`sfa-and-abi.md#abi-contract`; `evidence-parity-and-recovery.md#equivalent-work-accounting`;
source `MOS-PGM-1976`, plus the authority identities already recorded above.

T-01.5: install/build/typecheck pass. All workspace tests pass
(compiler 1,519; CLI 62; language server 14; editor 6). The first full run ended with SIGTERM
(exit 143), without a failing test or root-suite summary, after the new switch and all four
profile VICE cases passed. No VICE process remained. Cause is unknown; the identical test
command passed on retry in `final-test-retry.log`: 91 root files, 844 root tests, **2,445 total**
across all workspaces and root. All four cooperative profiles, the unchanged M1 journey and
the switch fixture ran sequentially in VICE. No VICE process remained after completion.

Independent whole-task review (`switch90_review`): **No findings** across correctness,
maintainability, standards, API surface and output preservation. It confirmed return-only
blocks remain byte-emitting, stable ordering, exact artifacts and frozen-oracle integrity.
No dedicated security/performance/concurrency auditor was selected: no such subsystem or
performance-critical path changed. Review and full verification are complete. No re-review
was required because no finding or subsequent code correction occurred.

## Bounded Outcome

Ordinary byte/word switches and returning clauses now build with correct labels and preserved
runtime behavior. The correction is one private predicate and one stable sort tie-breaker;
no lowering, allocation, optimizer, public API, artifact schema or frozen authority changed.
Three new test files supply independent language/runtime and exact byte/address evidence.
Formatting, 35 local links/anchors, source keys and frozen-path/oracle checks pass.

#90 has not been edited or closed; the user retains that external action. #91 owns the measured
pre-existing output gap; it is not hidden behind this correctness repair. Full RD-05 stays
Executing: AR-P3/NMI, handler-side IRQ and the remaining platform scope still have their original
owners. No RD-closeout claim or new deferral is made. Windows and physical qualification remain
at RD-10. No architecture or opt-in technical-documentation change was needed. Portfolio numeric
reconciliation remains deferred until integration; the feature's RD count stays 2/10.
