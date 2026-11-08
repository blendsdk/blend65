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
