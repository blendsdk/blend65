# Open bug correctness batch — execution plan

> **Owner**: remaining v4 correctness debt, issues
> [#77](https://github.com/blendsdk/blend65/issues/77),
> [#76](https://github.com/blendsdk/blend65/issues/76),
> [#68](https://github.com/blendsdk/blend65/issues/68),
> [#90](https://github.com/blendsdk/blend65/issues/90),
> [#66](https://github.com/blendsdk/blend65/issues/66),
> [#91](https://github.com/blendsdk/blend65/issues/91),
> [#99](https://github.com/blendsdk/blend65/issues/99) and
> [#55](https://github.com/blendsdk/blend65/issues/55).
> **Scope mode**: strict. No source-language restriction, no frozen `spec/` change, no new
> runtime, and no serializer peephole.

## Goal

Deliver the open silent-wrong-code and measured-output bugs as one verified batch. Where a
reported defect was already closed by the v4 redesign, replace the report with an independent
regression oracle and record that evidence instead of inventing a second mechanism.

## Tasks

- [x] T-28.1 Frontend declaration order and block lifetime (#77, #76). Verify the reported
      probes against the current resolver, then add `test/rd04/declaration-scope.spec.test.ts`:
      pre-declaration constant reads, nested shadowing, the word variant, the out-of-block
      diagnostic, and the outer-binding fallback.
- [x] T-28.2 Runtime switch correctness (#90, #66). Reproduce the returning byte/word switch and
      the slot-claiming conditional discriminant; add the conditional-discriminant build case to
      `test/rd05/runtime-switch.spec.test.ts` and retain the existing byte/word VICE evidence.
- [x] T-28.3 Switch dispatch output (#91). Replace byte reload/EOR tests with one live selector
      and non-destructive compares; lower word equality as direct low/high compares, sharing a
      common low byte and removing equality scratch before SFA closure. Add byte, common-low word
      and distinct-low word output/scratch cases.
- [x] T-28.4 Fixed scalar borrow (#99). Bind `&parameter`/`&local` to its certified home, read it
      directly instead of copying a pointer pair, and reuse the volatile read in A for the next
      ordinary read of the same private home. Add the exact nine-byte `clear(mask)` witness and
      update the copied-parameter implementation oracle.
- [x] T-28.5 VIC placement safety (#68). The v4 design does not implicitly page-align address-taken
      const arrays; VIC consumers use `vicSpriteBlock`. Add resolved-address rejection cases for
      explicit `$1000` and `$4000` placements and document that `&X` is not a VIC visibility proof.
- [x] T-28.6 CLI path resolution (#55). Add a built-binary case that builds from a relative project
      path with the manifest's relative `outDir`, then repeats with the absolute project path.
- [x] T-28.7 Verification and closeout. Run install/build/typecheck, the complete package suites,
      the complete root suite, target formatting, and the three VICE suites touched by the batch.
- [x] T-28.8 Independent correctness review. Reproduce and fix the three critical findings (balanced
      observer labels, cross-call A retention and signed-ordering reload) and retain their
      regression cases.
- [x] T-28.9 Full root-suite remediation. The first complete root run exposed the global-word
      address misread; restrict direct reads to true `static-address`/`symbol-address` operands,
      then rerun the affected files and the complete suite.

## Acceptance

| Area | Oracle |
| --- | --- |
| Scope | Pre-declaration use reads the module constant; post-block use is `E10239` unless an outer binding exists; no silent truncation. |
| Switch correctness | Byte/word returning switches and a conditional discriminant build and execute on the four profiles. |
| Switch output | One selector load for byte dispatch; shared word low test when legal; no `EOR`/scratch equality sequence; `scratch = 0`. |
| Scalar borrow | `clear(mask)` is exactly `LDA home; AND #$1F; STA $DD0D; RTS` (9 bytes / 16 cycles); `zeroPage = 0`. |
| VIC placement | A VIC-visible placed array at `$1000` or `$4000` fails `E10273`; ordinary CPU data remains legal. |
| CLI paths | Relative and absolute project selections build successfully with a relative `outDir`. |

## Constraints

- `spec/` stays byte-identical.
- No issue is closed by weakening an oracle. Existing implementation oracles may be updated only
  where the delivered output is deliberately better and the new expectation is stronger.
- No push. Commit at the verified checkpoint.
