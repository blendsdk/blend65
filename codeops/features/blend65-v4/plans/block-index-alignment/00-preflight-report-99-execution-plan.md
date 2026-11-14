# Preflight: #74 block-index storage alignment

> **Status**: ✅ PREFLIGHT PASSED — findings resolved before execution; one design pivot after the
> first independent review round (no rejection at all)
> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Scope mode**: strict
> **Last Updated**: 2026-11-14

Two independent read-only auditors covered soundness (ambiguities, contradictions, consistency,
edge cases) and delivery/testability (completeness, dependencies, feasibility, testability,
ordering, codebase alignment). The plan owner merged their findings and amended the plan. A later
review round showed that any syntax-derived rejection of ordinary address arithmetic would be a new
source restriction the frozen registry does not authorize, so the final design only strengthens
automatic placement.

## Findings

| ID | Severity | Cluster | Finding | Resolution |
| --- | --- | --- | --- | --- |
| PA-001 | Major | Soundness | Inferring a hardware requirement from arithmetic syntax alone could alter or reject ordinary address arithmetic. | Inference only strengthens automatic placement. Explicit `at`, zero-page and unalignable shapes are preserved unchanged. No program is rejected. |
| PA-002 | Major | Soundness | Blanket rejection of dynamic indices would be a new source restriction, and a 64-byte element stride can keep every runtime element aligned. | A runtime index is left untouched: no inference and no rejection. The delivery is explicitly bounded to static effective addresses; dynamic element block addresses are follow-up debt. |
| PA-003 | Major | Soundness | E10143 is the asset alignment code; explicit source-placement conflicts use E10273. | The final design emits neither. It introduces no diagnostic code or template; consumer-aware diagnostics need a new approved warning contract. |
| PA-004 | Minor | Soundness | Constant storage uses a different public evidence path and may not report strengthened alignment. | The plan includes a constant-image case and observes its final label address, not a memory interval. |
| PA-005 | Minor | Soundness | The draft said block 43 was read as block 42; at `$0afd` the pointer is block 43 and the VIC fetches `$0ac0`, 61 bytes before the buffer. | The plan now records the exact pointer and fetched address. |
| PA-006 | Minor | Delivery | Public imports resolve `dist`; directed RED/GREEN could run stale output. | The plan requires a fresh build before public reproduction and after every compiler edit. |
| PA-007 | Minor | Delivery | The diagnostic envelope was under-specified. | Diagnostics are no longer emitted. The no-new-restriction controls are explicit in the oracle. |
| PA-008 | Minor | Delivery | Target-platform review was not assigned. | Added to the independent review task. |

## Review-round findings that changed the design

| ID | Finding | Resolution |
| --- | --- | --- |
| RV-001 | `4 * hi(&buffer)` did not match because the right-operand check returned first. | Both operand orders are checked; commuted regressions added. |
| RV-002 / SF-001 / TP-002 / MC-003 | A field at offset 1 was rejected even when an explicit root address made the effective address aligned. | The final design never rejects; the explicit `$0B3F` frame witness passes unchanged. |
| RV-003 | A narrowing conversion was followed as if it still carried the full address. | Only identity/reinterpret conversions are followed; a regression proves the narrowed value is not matched. |
| RV-004 | Constant divisors/indices behind conversions were not resolved. | Constants follow conversions with truncation semantics; `word(64)` and `word(1)` regressions pass. |
| SM-001 / TP-001 | Any syntax-derived rejection of ordinary arithmetic is a new source restriction. | The final design only strengthens automatic placement and never rejects. |
| SM-002 | Automatic field placement could be feasible at `root + offset` even when root alignment alone cannot express it. | The final design leaves the shape unchanged; a consumer-aware/effective-address placement is follow-up debt. |
| SM-003 | The commuted complete selector lost its 64-byte demand. | `selectorSide` checks both multiplication orders; regression added. |
| SM-004 | The task line still named E10143. | The plan no longer emits diagnostics. |
| MC-002 | An inner `hi*4` in a complete selector over-demanded 256. | The complete selector is recognized as 64; the inner product is skipped. |
| TP-003 / MC-001 | `$D018` is not a sprite pointer; a 64-byte slot is not the 63-byte image. | The oracle now uses `c64.vic.setSpritePointer` and speaks of the 64-byte block slot, not rendered pixels. |

## Soundness obligations

- Strengthen automatic placement only when the effective address is static and root alignment can
  express it.
- Never pad a plain `lo(&value)` read.
- Preserve an explicit address, zero-page object, runtime index, and unalignable field exactly.
- Recognize the complete `hi*4 + lo>>6` selector as 64, not 256.
- Add no instruction, stack, ZP or scratch byte.

## Evidence limits

Planning readiness only. No compiler behavior, alignment result, byte/cycle claim or regression
result is asserted before the tasks run. `spec/` and the expressiveness ledger remain untouched.
