# Findings: RD-06 Native Assets

> **Document**: 05-findings.md
> **Parent**: [Index](00-index.md)

| Finding | Phase | Severity | Area | Ruling |
| ------- | ----- | -------- | ---- | ------ |
| SR-001 | 1 | MAJOR | frontend/typing | fixed — E10142/E10144 on declaration conversions; operator promotion exempt |
| SR-002 | 1 | MAJOR | frontend/type-constants | fixed — embedded scalar exposed to fixed-extent evaluation |
| SR-003 | 1 | MAJOR | frontend/storage | fixed — scalar `place(...)` rejected with E10272; `&` uses E10040 |
| SR-004 | 1 | MAJOR | semantic/resident-roots | fixed — zero-byte outputs excluded from roots, placement, asset references and runtime use |
| SR-005 | 1 | MAJOR | frontend/promotion | fixed — unary/binary/conditional promotion marked as operator conversion |
| SR-006 | 1 | MINOR | frontend/diagnostics | fixed — E10040 for scalar constants, E10272 for scalar placement |
| SR-001 | 1 | MINOR | frontend/extent | accepted — inferred `byte[]` from a scalar selector still reports E10253 first; regression deferred to the first scalar handler (Phase 2) |
| SR-001 | 1 | MAJOR | assets/native-cache | fixed — request-bound candidate; retarget, deletion/fallback, second spelling and hard-link alias fail deterministically |
| SR-002 | 1 | MAJOR | layout/handler-constraints | fixed — handler constraints seed the merge; omitted align is not a weakening; contradictions E10273 |
| SR-003 | 1 | MINOR | fixtures/manifest | fixed — duplicate paths rejected with a distinct-id regression |
| RV-001 | 1 | MAJOR | evidence/debug | fixed — debug asset digest is the input hash |
| RV-002 | 1 | MAJOR | evidence/build-debug | fixed — build inputs deduplicated by path+hash; debug assets sorted by path/handler/selector |
| RV-003 | 1 | MINOR | evidence/input-size | fixed — `inputBytes` carried through every asset record |
| RV-004 | 1 | MINOR | frontend/unary-promotion | fixed — unary ordinal promotion marked as operator conversion |
| RV-005 | 1 | MINOR | assets/dispatch | fixed — selector echo, output digest and canonical asset id re-verified |
| RV-006 | 1 | MINOR | layout/regions | deferred — handler `region` constraints become satisfiable in Phase 5 task 5.2.6; the handler inventory is empty until then |
| RV-007 | 1 | MINOR | profile/inventories | accepted — internal read-only inventory; comments softened to contract wording |
| RV-008 | 1 | MINOR | diagnostics/roots | fixed — empty project-relative root renders as `.` |
| RV-009 | 1 | MINOR | assets/diagnostics | fixed — dispatch escapes path, selector and extension text |
| SR-101 | 2 | MAJOR | audio/surface | fixed — six frozen §7.3.1 operation names; extra `stop` removed; E10256 precedes argument checking |
| SR-102 | 2 | MAJOR | psid/reserved-fields | fixed — per-version flag masks and reserved address bytes |
| SR-103 | 2 | MAJOR | frontend/operators | fixed — embedded arrays report E10142 in binary and unary expressions |
| SR-104 | 2 | MAJOR | psid/compatibility | fixed — video/model/SID/song compatibility retained on the asset provenance |
| SR-105 | 2 | MAJOR | layout/fixed-load-diagnostic | fixed — handler fixed-address E10273 names `$addr`, never a null window; out-of-window test added |
| SR-106 | 2 | MINOR | audio/contract | fixed — closed cost union; numeric/named song validation; stop removed |
| SR-107 | 2 | MINOR | frontend/address-of | fixed — `&c64.audio.*` is E10043 |
| SR-108 | 2 | MINOR | psid/rom-windows | fixed — fixed payloads under visible character/BASIC ROM are E10261 |
| SR-109 | 2 | MINOR | audio/profile-lookup | deferred — profile-aware contract lookup, duplicate-claim rejection and topology validation belong to T-19 (AR-59) |
| SR-110 | 2 | MINOR | plan/AR-59 | fixed — 03-03/07 and ST-90/ST-181 reconciled with AR-59 |
| SR-111 | 2 | MINOR | fixtures/derivations | accepted — malformed PSID bytes are deterministic test-time mutations of committed fixtures; 03-07 records the exception |
| SR-112 | 2 | MINOR | evidence/constraints | deferred to Phase 5.2.7/5.2.9/5.2.11 — handler constraints and scalar `compileTime` records are Phase 5-owned |
| SR-113 | 2 | MINOR | vice/profile | fixed — `withProject` takes the profile so the NTSC 8580 artifact is built for that profile |
| SR-114 | 2 | MINOR | layout/rom-reservation | deferred to Phase 5.2.4 — global character-ROM reservation; PSID now rejects its own visible-ROM intervals |
| SR-201 | 3 | MAJOR | tests/vic-fields | fixed — direct `vicFieldValue` table and rejection tests; root assertions target `lda #$38`/`lda #$0a` |
| SR-202 | 3 | MAJOR | machine/immediate-fold | fixed — one constant `lda` + logical op folds to a single immediate; OR case is 5 bytes/6 cycles |
| SR-203 | 3 | MAJOR | machine/diagnostics | fixed — constant field failures use `loweringFailure` with the source span; layout transform failures remain Phase 5 E10273 |
| SR-204 | 3 | MAJOR | evidence/vic | deferred to Phase 5.2.7/5.2.8/5.2.11 — constraints, alignment, visibility and VIC memory views |
| SR-205 | 3 | MINOR | layout/non-asset-fields | deferred to Phase 5 — field transforms resolve asset intervals only; non-asset arguments currently fail as layout |
| SR-206 | 3 | MINOR | layout/diagnostics | fixed — conflicting source placement names the combined alignment/window detail |
| SR-207 | 3 | MINOR | vic/character-rom | fixed — field derivation rejects any consumer interval over the VIC-invisible character ROM |
| SR-208 | 3 | MINOR | fixtures/provenance | accepted — Koala `sourceSha256` is a construction-domain token; bytes and manifest hashes are exact |
| SR-209 | 3 | MINOR | plan/charen | accepted — reserving character ROM for all resident objects is the approved plan policy; Phase 5 keeps it |
| SR-210 | 3 | MINOR | platform/screen-tail | deferred to Phase 5 — a relocated screen's full 1 Ki-sprite-pointer tail and `setSpritePointer` base need the layout-owned screen relation |
| SR-301 | 4 | MAJOR | machine/ordinal-write | deferred to T-20 — `poke(base+index)` uses the indirect 16-bit path; 385-byte renderer and ~200-byte/~283-cycle loop versus expert ~33 bytes/~3,150 cycles. Q-P15 reports the real size and marks cycles Unknown; no parity claim |
| SR-302 | 4 | MAJOR | evidence/renderer-cost | fixed — Q-P15 asserts the exact `Game.render` code bytes (385) and `Unknown` whole-path cycles separately from asset bytes |
| SR-303 | 4 | MAJOR | qp15/scene | fixed — foreground overlay, two changed cells, Color RAM transfer, bitmap/screen setup, exact final RAM oracle |
| SR-304 | 4 | MAJOR | qp15/conflict | fixed — low-nibble background conflict count 63 with exact artifact bytes |
| SR-305 | 4 | MAJOR | qp15/evidence | deferred to Phase 5.2.7/5.2.8 — handler alignment/visibility and same-bank evidence; Q-P15 uses explicit source placements |
| SR-306 | 4 | MINOR | qp15/oracle | fixed — every expected hash, full ranges, bitmap position and VICE register-independent bytes asserted |
| SR-307 | 4 | MINOR | qp15/representations | fixed — REFERENCES is derived from the embedded screen low nibbles |
| SR-308 | 4 | MINOR | qp15/scalar-oracle | fixed — the PSID scalar test observes both low and high bytes |
| SR-309 | 4 | MINOR | plan/budget-coverage | fixed — `comptime-assets.impl.test.ts` proves no 64-byte embed charge and the step budget |
| SR-501 | 5 | MAJOR | layout/vic-visibility | fixed — VIC-visible assets require bank 0, avoid character ROM and the active screen, and `c64.vic.bank0` is a real region; other regions are E10272 |
| SR-502 | 5 | MAJOR | evidence/assets | fixed — handler/source constraints, exact alignment/visibility and scalar `compileTime` records are published |
| SR-503 | 5 | MAJOR | publication/scalars | fixed — build/debug/scalar input and placement reconciliation accept zero-byte records |
| SR-504 | 5 | MAJOR | evidence/memory-views | deferred — `.memory.json` has only `cpu16-resident`; the VIC bank and Color RAM views need a schema addition for a non-`cpu16` address space |
| SR-505 | 5 | MINOR | costs/compile-time | deferred — `.costs.json` has no compile-time-zero accounting component; no artifact-byte inflation is claimed |
| SR-506 | 5 | MINOR | layout/global-rom | deferred — character ROM is reserved for VIC-visible assets and PSID fixed loads, not every CPU-only code/data interval; a blanket reservation breaks existing M1 code placement |
| SR-507 | 5 | MINOR | platform/screen-tail | deferred — a relocated screen's full 1-KiB pointer tail and `setSpritePointer` base are not yet layout-derived |
| SR-508 | 5 | MINOR | qualification/layout | deferred — the dedicated layout/evidence spec file and VICE Koala visibility check remain; Q-P15 covers the visible bitmap/screen/Color RAM path |
