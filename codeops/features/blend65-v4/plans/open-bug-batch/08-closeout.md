# Open bug correctness batch — closeout

> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Issues**: #77, #76, #68, #90, #66, #91, #99, #55 — all closed with evidence comments.
> **Status**: implemented and verified locally; no push.

## Delivered changes

| Issue | Delivery | Evidence |
| --- | --- | --- |
| #77 | Declared-before-use now resolves the pre-declaration use to the module binding. | `test/rd04/declaration-scope.spec.test.ts`: byte probe emits `lda #$04`; nested local does not capture; word probe keeps both bytes. |
| #76 | A use after its declaring block is `E10239`, or resolves to an outer binding when one exists. | Same file: sibling-block probe is rejected; outer-binding probe reads the outer home. |
| #66 | A slot-claiming conditional discriminant is lowered once and reused. | `test/rd05/runtime-switch.spec.test.ts` conditional-discriminant build case. |
| #90 | Returning byte/word runtime switches build and execute. | Existing `runtime-switch.spec.test.ts` / `runtime-switch-vice.spec.test.ts`, rerun green. |
| #91 | Byte dispatch keeps one selector in A and compares non-destructively; word dispatch compares low/high bytes directly, shares a common low test and removes equality scratch before SFA closure. | New `packages/compiler/src/machine/switch-dispatch.ts`; byte routine 20 B (paths 17/21/20 cycles), word routine 25 B (paths 23/27/17/26 cycles) — matching the issue's expert candidates; `scratch = 0`, `zeroPage = 0`; VICE values `11,22,99,99` for byte and word; the balanced default and observer evidence are covered. |
| #99 | A fixed scalar borrow reads its certified home directly and reuses the volatile read in A. | `clear(mask)` is exactly `LDA home; AND #$1F; STA $DD0D; RTS` = 9 B / 16 cycles; `zeroPage = 0`; `test/rd05/cia2-review-effects.spec.test.ts`. |
| #68 | v4 does not implicitly page-align address-taken const arrays; VIC consumers validate the resolved address. | `test/rd06/vic-diagnostics.spec.test.ts` rejects VIC-visible `place(at: $1000)` and `place(at: $4000)` with `E10273`; `docs/platform-libraries.md` states `&X` is not a VIC visibility proof. |
| #55 | Relative project/outDir paths resolve against the invocation directory; ACME file-open failures are path-oriented. | Built-binary test in `packages/cli/src/bin.spec.test.ts`; `runAcme` path-failure diagnostic in `packages/compiler/src/artifacts/acme.spec.test.ts`. |

## Verification

| Check | Result |
| --- | --- |
| `yarn build` | 4/4 packages pass |
| `yarn typecheck` | 7/7 pass |
| Compiler package suite | 226 files, 3,808 passed / 2 skipped |
| Root suite | pending final run |
| Targeted switch build/output | 13/13 |
| Targeted switch VICE | byte/word `11,22,99,99`; effects and caller return pass |
| Targeted CIA2 borrow | 40/40 across four profiles |
| Targeted CIA2 runtime | 4/4; borrowed read returns `$1F` |
| Targeted raw-footprint/NMI regressions | 128/128 |
| Machine/storage package subset | 79 files, 980 passed |
| Targeted scope | 6/6 |
| Targeted VIC diagnostics | 7/7 |
| Targeted CLI | 70/70 package tests including relative/absolute relative-outDir build |
| `spec/` | clean |

## Notes

- #77, #76, #66 and #90 were already fixed on `4cc2d766`; this batch adds the missing independent
  regression oracles and confirms the runtime evidence rather than changing those paths.
- #68 is closed by the v4 placement model, not by adding implicit alignment: page alignment is not
  applied to ordinary address-taken arrays, and `vicSpriteBlock` rejects a VIC-invisible resolved
  address. `hi(&X) * 4` remains ordinary user arithmetic, as the issue itself notes.
- The only existing implementation oracle changed is `parameter-address.impl.test.ts`, which now
  asserts the stronger direct-home read instead of the old pointer-pair materialization.
- Independent correctness review found three critical issues in the first implementation: removed
  word-test labels broke balanced-mode observer evidence, the forwarded borrow could stay in A
  across a call, and a signed ordering consumer reloaded A from its right operand. All were
  reproduced, fixed by keeping every original test label on a replacement block, by requiring an
  adjacent non-call consumer, and by restricting forwarding to equality/bitwise consumers, and
  each has a regression case.
- The first full root run exposed one more real regression: a `label` value produced by loading a
  global word variable was treated as the final address, so `peek(pointer)` read the pointer's
  home instead of dereferencing it. Direct reads now accept only true `static-address` and
  `symbol-address` operands. The two failing files pass 128/128 and the machine/storage subset
  passes 980/980 after the correction.
- No frozen specification, expert skill, public API or source-language restriction changed.
