# Execution Plan: Bounded NMI Retention

> **Progress**: 12/12 tasks
> **Updated**: 2026-11-13

| Phase | Tasks |
|---|---:|
| 1. Plan, preflight, independent oracle | 4 |
| 2. Stack proof, lowering and accounting | 5 |
| 3. Runtime and full verification | 3 |

- [x] 1.1 Record the baseline failures and the cost bound. (completed: 2026-11-13 04:30) Baseline shared/five/runtime-word failures reproduced; total cap eight and stack evidence bound recorded.
- [x] 1.2 Run an independent preflight and disposition findings. (completed: 2026-11-13 04:30) Independent preflight PASS WITH FIXES; PA-001 cap placement, PA-002 callee accounting, PA-003 TSX reuse, PA-004 consumer gate, PA-005/006 docs/coverage dispositioned.
- [x] 1.3 Author the four-profile retention oracle independently. (completed: 2026-11-13 04:30) Implementation-blind spec author added the three positives, five negatives and the balanced-mode case.
- [x] 1.4 Capture RED for the remaining forms before finalizing. (completed: 2026-11-13 04:30) RED captured: the nine-sample case exposed the per-local cap and was fixed to a total handler cap.
- [x] 2.1 Add the bounded stack-retention proof and inventory elision. (completed: 2026-11-13 04:30) nmiStackRetainedLocals: single block, interrupt entry, void, no calls, one store, 1-8 loads, total <=8, safe consumers.
- [x] 2.2 Emit `PHA`, `TSX`-relative loads and the pops; report `stackBytes`. (completed: 2026-11-13 04:30) PHA at the store; one TSX then LDA $0100+n,X per load; PLA per push at the return; stackBytes added to the NMI entry.
- [x] 2.3 Add the zero-extension staging elision. (completed: 2026-11-13 04:30) Zero-extending byte read to a single-use word local keeps the low byte in A; no conversion staging.
- [x] 2.4 Add implementation tests for proof bounds, lowering and stack accounting. (completed: 2026-11-13 04:30) Storage proof 13/13; shared/five build and the total cap rejects nine.
- [x] 2.5 Confirm four-profile build/storage and the remaining negatives. (completed: 2026-11-13 04:30) Four profiles green; remaining forms (wide word, computed, nonzero, >8, join/call) still E10245.
- [x] 3.1 Run the sequential VICE retention case and record evidence. (completed: 2026-11-13 04:30) Genuine Timer A NMI: artifact 0f03f165, handler 2631-2730, flags [1,0], samples [17,34,51,68,85], return $E147.
- [x] 3.2 Run the complete compiler suite and affected root suites. (completed: 2026-11-13 04:30) Compiler suite 224 files/3,782 passed/2 skipped; NMI/CIA2 32 files/778; pinned optimizer and foundation/profile green.
- [x] 3.3 Update the ledger/docs/roadmap, close #149 and commit; no push. (completed: 2026-11-13 04:30) Ledger narrowed to five probes owned by #150; docs/roadmap updated; commit pending.
