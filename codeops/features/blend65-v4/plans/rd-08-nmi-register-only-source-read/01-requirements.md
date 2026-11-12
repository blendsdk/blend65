# Requirements Delta — NMI Register-Only Source Reads

> **Issue**: [#100](https://github.com/blendsdk/blend65/issues/100) — "keep ordinary NMI global
> stores and bit conditions register-only"
> **Parent**: RD-08 measured output debt; RD-05 NMI route
> **Updated**: 2026-11-12

## Requirement mapping

| Source requirement | Current state | Plan deliverable |
|---|---|---|
| #100: ordinary global assignment of a consuming read compiles | Builds on all four cooperative profiles | Keep as a regression case; no new work |
| #100: a direct conditional on the returned Timer A bit compiles | Fails `E10245` on all four profiles | Forward the read result into the adjacent byte mask |
| #100: the equivalent expert sequence needs no private home | Compiler invents one one-byte temporary | Zero private requests for both forms |
| #100: preserve volatile read count/order, exact Boolean/flags, ABI and source spans | Read and branch already preserve order | No extra read, no reordering, no flag assumption |
| #100: independent specification-first positives on every profile | None for this form | One spec case per cooperative profile plus a runtime case |
| #100: keep real private-home rejection controls | Existing controls pass | Multi-retained and local negatives stay `E10245` |
| #100: qualify complete selected assembly/resource costs | Admission fails, so no cost exists | Measure emitted bytes/cycles/stack and resource report |
| #100: sequential VICE behavior | None for this form | Handler entry, shared-global value, `restoreNMI`, caller return |
| #100: record the exact user-visible restriction in the ledger | Row exists but is broader than reality | Narrow the row to the forms that still fail, with probes |
| RD-08 expert parity | Rejection is an infinite ratio | Emitted sequence matches the hand-written expert sequence |

## Explicit non-goals

- No local-storage elision.
- No producer flag-ownership model for a bare byte zero-test.
- No new optimizer framework, runtime helper, dispatcher or shadow storage.
- No NMI proof relaxation, and no exemption for any private request.
- No `spec/` edit and no takeover source-NMI work.
- No physical-hardware claim.

## Acceptance

1. Both issue witnesses build with optimization `none` on all four cooperative profiles.
2. Their memory evidence contains no NMI-private request; the read is a single volatile access and
   the store targets the declared global.
3. The multi-retained-sample and single-use-local handlers still fail `E10245` on every profile.
4. Emitted handler bytes and cycles are measured and recorded; the conditional form matches the
   expert `read; and; branch` shape with no temporary store.
5. A sequential VICE case proves the handler value reaches mainline and the program returns.
6. `yarn build`, `yarn typecheck` and the complete compiler suite pass; `spec/` is clean.
