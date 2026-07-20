# Requirements — Placement (RD-03)

> **Source**: [RD-03](../../requirements/RD-03-placement.md)
> **Preflight**: [00-preflight-report-rd-03.md](../../requirements/00-preflight-report-rd-03.md) — 29 findings, all resolved

The RD owns the requirements; this document owns the **plan's** reading of them — the M↔AC↔ST
mapping and the scope fence. Where a fact lives in the RD it is cited, not restated.

## Requirement → acceptance → proof

| Req | What it demands | AC | Proven by | Tier |
|-----|-----------------|----|-----------|------|
| **M1** | A const array whose address is taken **syntactically** is page-aligned; the by-ref-argument, function-address-of and mutable-variable cases are excluded | AC-1, AC-2 | ST-C5, ST-C6, ST-C7, ST-C12 | CI |
| **M2** | Alignment is page (256), not block (64) | AC-3 | ST-C13 | CI |
| **M3** | Alignment is an emitted directive, not a computed address | AC-1 | ST-C1, ST-C11 | CI |
| **M4** | No fixture grows; ratchets re-derived from the **aligned** build; `twins.json` prose re-audited | AC-6, AC-8 | ST-C15, ST-C16 + closeout review | CI + review |
| **M5** | `balloon` copies nothing | AC-4 | ST-C14 | CI |
| **M6** | Balloon's shared observable contract splits | AC-5 | ST-C17, ST-C18 | Local (VICE) |
| **M7** | RD-05's invariants stay green; the new emission gains a discriminating artifact | AC-7 | ST-C11, ST-C12, ST-C13 + existing ST-B39/B40/B43/B44 | CI |
| **S1** | Other fixtures drop copies the same way | — | expected **no-op** — see below | — |
| — | `spec/` untouched (D3) | AC-9 | existing gate | CI |
| — | R15 boundary holds | AC-10 | existing `test/boundary.spec.test.ts` | CI |

Every M is discharged. AC-9 and AC-10 trace to standing project constraints rather than to an M,
which is the same shape RD-04 and RD-05 used.

**S1 is expected to do nothing, and that is the correct outcome.** The only other const→copy path
in the corpus is `slice8b`, whose destinations (`$0400` screen RAM, `$C000`) sit below the PRG load
base — excluded by the RD's own Won't-Have. The plan carries no task for S1; if an implementer
finds a candidate, that is a scope change to raise, not to absorb.

## What this plan does NOT do

Carried from the RD's Won't-Have, with the two spin-offs now filed:

| Excluded | Where it went |
|---|---|
| `copy(dst, src, count)` | FUT-012 — needs a `spec/` edit (D3) + Guard evaluation |
| An `@align(n)` attribute | FUT-014 — needs attribute syntax v3 removed |
| Placement below the PRG load base | Not achievable in a single-load PRG; this is what the twin's copy exists for |
| Format handlers / `embed(...).selector` | Unimplemented; its own RD |
| Improving `hi(&X)`'s codegen | #58/#60 (AR #67) — the 8-instruction sequence and its `W10172` warning |
| Runtime-address `poke` | #49's wider slice |
| **Padding in the build summary** | **[#67](https://github.com/blendsdk/blend65/issues/67)** — no substrate, no producer, spec-pinned layout |
| **VIC-bank / char-ROM residency diagnostic** | **[#68](https://github.com/blendsdk/blend65/issues/68)** |
| **Updating the hand-written twin** | AR #69 — it stays the fixed 251-byte denominator |

## The scope fence that matters most

**This plan changes no package outside `@blend65/core`, `@blend65/codegen`, `@blend65/test-harness`
and `examples/`.** Specifically it does **not** touch `@blend65/compiler` or `@blend65/cli` — those
were only ever implicated by the padding-visibility requirement, now #67. An implementer who finds
themselves editing `packages/compiler/src/api/build.ts` has left scope and should stop.

R15 holds by construction: the address-taken set is accumulated inside
`packages/codegen/src/il/lower.ts` and consumed inside the same package. Neither `@blend65/frontend`
nor `@blend65/language-server` gains a codegen import (AR #72).
