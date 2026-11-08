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
