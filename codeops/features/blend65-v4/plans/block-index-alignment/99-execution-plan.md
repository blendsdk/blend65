# Block-index alignment for module storage — execution plan

> **Owner**: issue [#74](https://github.com/blendsdk/blend65/issues/74).
> **Scope mode**: strict. No frozen `spec/` change, no new runtime, no source restriction when the
> compiler can infer the required placement.

## Problem

`lo(&buffer / 64)` and `lo(&buffer >> 6)` are the sprite-block idiom. The expression is
arithmetically correct at any address, but the VIC fetches `floor(address / 64) * 64`, so unless
the buffer is 64-byte aligned the program reads the wrong block with no diagnostic. `hi(&buffer) *
4` has the same hazard and needs 256-byte alignment because it discards the low address byte.

The current v4 output places `let buffer: byte[64]` at `$0afd`: not aligned. The source compiles
and publishes block 43 (`$2b`); the VIC then fetches block 43 starting at `$0ac0`, 61 bytes
before the buffer. The sprite data the program sees is not the buffer it wrote.

## Requirement contract

Issue #74 requires the mutable block idiom to stop silently selecting a block that begins before
the buffer. The frozen diagnostic registry cannot add a warning code, and a syntax-derived
rejection would make ordinary address arithmetic illegal. Under the run's `--auto-design` mandate
the compiler therefore chooses the smallest sound contract: **strengthen automatic placement when
the effective address is static and root alignment can express it; preserve every explicit,
zero-page, runtime-index and unalignable shape exactly; never reject.** Consumer-aware diagnostics
for an unsatisfiable hardware use need a new approved warning contract and are follow-up debt.

## Decision

Infer the alignment demand from the source shape and apply it to the module-level object before
layout. This is the modern-source result: the same source that works for a resident image also
works for mutable and constant storage, with no hardware lore in user code.

This pass only strengthens automatic placement. It never rejects a program and never emits a
diagnostic. A runtime index, an explicit `place(at:)`, zero-page storage, and a structural field
offset that root alignment cannot express are preserved exactly as written. Ordinary address
arithmetic therefore keeps its ordinary meaning, and no frozen diagnostic code or template is
invented.

A consumer-aware diagnostic for an unsatisfiable hardware use would need a new approved warning
contract in the frozen registry; that is recorded as follow-up debt, not smuggled into this
delivery.

## Authority

| Fact | Authority | Consequence |
| --- | --- | --- |
| VIC sprite block is a 64-byte unit | `spec/13-c64-platform.md` / platform library `vicSpriteBlock` | `/64` and `>>6` require 64-byte alignment. |
| Module placement supports `align` | `spec/03-variables.md` §4 | The compiler may strengthen an automatically chosen placement. An explicit placement is the user's contract and is preserved. |
| Address arithmetic is ordinary integer math | `spec/04-expressions-operators.md` | Aligning the object does not change the formula's meaning; it makes the hardware consumer agree with it. |
| Startup and layout are deterministic | `spec/03-variables.md` §5, `spec/10-modules.md` | The demand is applied before layout; no runtime check is added. |

## Tasks

- [x] T-74.1 Build the workspace first, then reproduce the defect with a public build and record
      the buffer address, the emitted block value, and the VIC block it selects. Public imports
      resolve `dist`, so stale output must never stand in for baseline evidence.
- [x] T-74.2 Author the specification oracle `test/rd04/block-index-alignment.spec.test.ts` before
      the implementation. It must observe the public memory report and address: `/64` and `>>6`
      demand 64, `hi * 4` demands 256, the complete selector demands 64, a plain `lo(&buffer)`
      adds no 64-byte padding, and every explicit, zero-page, runtime-index or unalignable shape
      is preserved without a new rejection. Confirm RED for the right reason after a fresh build.
      The first draft asserted an E10273 rejection; that expectation was withdrawn before
      acceptance because the frozen registry does not authorize the diagnostic. The withdrawal is
      recorded in the review packet and the final oracle is independently audited. The user
      ratified the revision on 2026-11-14.
- [x] T-74.3 Add a semantic placement pass that matches the source shapes, resolves the static
      place offset, and strengthens `placement.align` only when the demand can be expressed by
      root alignment. An explicit `at`, zero-page object, runtime index, or unalignable field
      offset is left unchanged; the pass never rejects.
- [x] T-74.4 Implementation tests for the matcher: direct, shifted, `hi * 4` in both operand
      orders, complete selector, constant index, nested field offset, runtime-index preservation,
      explicit aligned and misaligned preservation, and converted constants.
- [x] T-74.5 Independent review: correctness, semantics, SFA/ABI, target platform and emitted
      code. A major finding stops delivery until fixed and re-reviewed.
- [ ] T-74.6 Run `yarn install --frozen-lockfile`, `yarn build` and `yarn typecheck`, rebuild
      after every compiler edit before public reruns, run the directed package and root tests,
      then the complete `yarn test:full` checkpoint at the batch gate.
- [ ] T-74.7 Closeout: record the measured before/after, update the roadmap and issue, run the
      deferral-expiry question, confirm `spec/` and the ledger are untouched, and commit. The
      closeout must name owned follow-ups for explicit misalignment, effective-address automatic
      field placement, runtime-index element addresses, consumer-aware diagnostics and VIC-bank
      visibility. It must describe a **partial alignment inference**, not universal block
      correctness.

## Acceptance

| Area | Oracle |
| --- | --- |
| `/64` | The public memory interval for the buffer has `alignmentBytes >= 64` and `start % 64 == 0`. |
| `>>6` | Same 64-byte demand as `/64`. |
| `hi * 4` | The interval has `alignmentBytes >= 256` and `start % 256 == 0`. |
| No idiom | Plain `lo(&buffer)` leaves `alignmentBytes < 64`; no speculative 64-byte padding. |
| Explicit aligned `at` | Builds; the declared address is used unchanged. |
| Explicit misaligned `at` | Builds; the exact address and its original alignment are preserved. |
| Field offset | An aligned field builds; an offset that root alignment cannot express is preserved unchanged, not rejected. |
| Constant index | A constant index is included in the static offset and proved like a field. |
| Complete selector | `hi*4 + lo>>6` in either operand order needs 64-byte alignment, not 256. |
| Dynamic index | Placement is left unchanged; the program is neither aligned nor newly rejected. This bound is recorded as follow-up debt. |
| Constant storage | An inferred demand on a `const` array also aligns its immutable label address. |
| Visibility | Alignment does not prove that the selected block is inside the selected VIC bank or outside character ROM; that remains the user's platform contract and is recorded as follow-up debt. |
| Cost | No instruction, stack, ZP or scratch byte is added by the demand; only placement padding. |
| Regression | Existing goldens, layout, VIC and array suites stay green. |

## Constraints

- `spec/` stays byte-identical; no new diagnostic code or message template is introduced.
- The inference is limited to statically provable effective addresses. Runtime-index element
  addresses are not rejected and are recorded as follow-up debt.
- No test, oracle or VICE journey is deleted, skipped or weakened.
- The expressiveness ledger gains no row: this is a diagnostic/precision improvement, not a new
  source restriction.
- The compiler package is the only production surface changed.
- No push. Commit at the verified checkpoint.
