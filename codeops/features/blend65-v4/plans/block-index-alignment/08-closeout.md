# Block-index storage alignment — closeout

> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Review packet**: [05-review-packet.md](05-review-packet.md)
> **Issue**: [#74](https://github.com/blendsdk/blend65/issues/74)
> **Status**: implemented, reviewed and verified at the complete checkpoint
> **Follow-up debt**: [#158](https://github.com/blendsdk/blend65/issues/158),
> [#159](https://github.com/blendsdk/blend65/issues/159)

## Delivered behavior

The compiler now infers the hardware alignment of a module object used as a block index and
strengthens **automatic** placement before layout:

| Source shape | Inferred demand |
| --- | --- |
| `lo(&buffer / 64)` | 64 |
| `lo(&buffer >> 6)` | 64 |
| `hi(&buffer) * 4` or `4 * hi(&buffer)` standalone | 256 |
| `hi(&buffer) * 4 + (lo(&buffer) >> 6)` in either order, including widening wrappers | 64 |
| `lo(&buffer)` only | none |

The pass preserves every explicit `place(at:)`, zero-page object, runtime index and field offset
that root alignment cannot express. It never rejects and emits no diagnostic. This is a **partial
alignment inference**, not universal block correctness.

## Measured evidence

| Check | Result |
| --- | --- |
| Witness `let buffer: byte[64]; c64.vic.setSpritePointer(0, lo(&buffer / 64));` | Buffer start `$0afd` → `$0ac0`; public `alignmentBytes` 1 → 64 |
| Selected block slot | `$0ac0`; the buffer now starts at the selected slot instead of 61 bytes into it |
| `test/rd04/block-index-alignment.spec.test.ts` | 52 passed (52) across four profiles |
| `packages/compiler/src/semantic/block-index-alignment.impl.test.ts` | 20 passed (20) |
| `yarn workspace @blend65/compiler vitest run src/semantic src/machine src/layout` | 103 files, 1,346 passed |
| Complete compiler package suite | 228 files, 3,848 passed / 2 skipped |
| Padding and runtime cost | 0-63 or 0-255 placement bytes; zero added instructions, stack, ZP or scratch |
| Emitted-code comparison | Explicit `$0AC0` and `$0AFD` builds have an identical `Game.main` instruction sequence; only scratch/data addresses differ |
| Runtime block selector | 66 bytes / about 112 nominal cycles versus the 5-byte / 6-cycle expert form; owned by [#160](https://github.com/blendsdk/blend65/issues/160) |
| Complete `yarn test:full` | 86m10s: packages green, host 220 files / 4,745 passed, VICE 122 files / 2,270 passed / 4 skipped |

## Review record

| Lens | Verdict |
| --- | --- |
| Correctness | APPROVE — operand order, widening conversions, effective field address and no-rejection contract verified. |
| Semantics | Approves within the no-rejection contract; two documentation findings fixed. |
| SFA/ABI | APPROVE; placement metadata only, zero function storage, ZP, scratch or ABI change. |
| Target platform | APPROVE — 64/256 arithmetic, `setSpritePointer` consumer, visibility caveat and follow-up ownership confirmed. |
| Emitted code | APPROVE — identical PRG/code bytes and instruction count across the three builds; runtime-shift debt owned by #160. |
| Spec oracle | PASS — first draft revision recorded and **user-ratified on 2026-11-14**; final oracle independently audited. |

## Residual boundaries and owners

| Boundary | Why it remains | Owner |
| --- | --- | --- |
| Explicit misaligned `place(at:)` | The explicit address is the user's contract; a new diagnostic contract is required. | [#158](https://github.com/blendsdk/blend65/issues/158) |
| Automatic field offset that root alignment cannot express | Effective-address automatic placement is a layout capability, not a root-align flag. | [#158](https://github.com/blendsdk/blend65/issues/158) |
| Runtime element index | Needs stride/effective-address proof. | [#159](https://github.com/blendsdk/blend65/issues/159) |
| VIC-bank visibility and character ROM | Alignment alone does not prove the block is visible to the selected VIC. | [#159](https://github.com/blendsdk/blend65/issues/159) |
| Consumer-aware diagnostic | The frozen registry has no warning code for a hardware alignment advisory. | [#158](https://github.com/blendsdk/blend65/issues/158) |

## Deferral-expiry check

- #74 was an open defect, not a deferral. Its reported static root-address shape is delivered.
- The two residual boundaries are filed as #158 and #159 with explicit acceptance criteria; none
  named #74 as its future landing place.
- `spec/` is byte-identical and the expressiveness ledger has the same eight rows.
- No existing oracle was deleted, skipped or weakened. The new oracle's first draft was withdrawn
  before acceptance because it asserted an unauthorized E10273; the revision is recorded in the
  review packet, independently audited, and **ratified by the user on 2026-11-14**.

## Verification status

Install/build/typecheck and the directed package/root tests pass. The complete `yarn test:full`
checkpoint passed in 86m10s: compiler 228 files / 3,848 passed / 2 skipped, host 220 files / 4,745
passed, VICE 122 files / 2,270 passed / 4 skipped (1 file skipped). No oracle was deleted, skipped
or weakened.
