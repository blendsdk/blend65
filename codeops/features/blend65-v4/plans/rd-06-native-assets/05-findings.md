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
| SR-301 | 4 | MAJOR | machine/ordinal-write | deferred to T-20 — `poke(base+index)` uses the indirect 16-bit path. Q-P15 publishes 385 code-segment bytes and marks whole-path cycles `Unknown`; no parity claim. The earlier 3,150-cycle comparison was not a viable expert baseline and is removed from the roadmap text |
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
| SR-504 | 5 | MAJOR | evidence/memory-views | fixed — `cpu16-resident`, `vic-bank-0` and `color-ram` views reconcile occupancy and free intervals |
| SR-505 | 5 | MINOR | costs/compile-time | fixed — each scalar asset has a zero-byte program entry and an `optimizedAway` debug symbol/location |
| SR-506 | 5 | MINOR | layout/global-rom | deferred — character ROM is reserved for VIC-visible assets and PSID fixed loads, not every CPU-only code/data interval; a blanket reservation breaks existing M1 code placement |
| SR-507 | 5 | MINOR | platform/screen-tail | deferred — a relocated screen's full 1-KiB pointer tail and `setSpritePointer` base are not yet layout-derived |
| SR-508 | 5 | MINOR | qualification/layout | fixed — dedicated layout/evidence spec tests and the VICE Koala visibility check exist |
| SR-701 | 7 | MAJOR | spritepad/parser | fixed — SPD v5 header, exact block order, tile names/tags, animation frames, exact EOF and selector hashes verified against the three 3.80 examples |
| SR-702 | 8 | MAJOR | charpad/parser | fixed — CTM v9 header, ordered blocks, per-mode color width, canonical/word/plane/packed-12 forms and exact EOF verified against five 3.80 examples |
| SR-703 | 7/8 | MAJOR | fixtures/synthetic | fixed — committed synthetic SPD v5 and CTM v9 public fixtures with exact hashes and spec coverage; producer examples remain local-only and skip without the apps folder |
| SR-704 | 7/8 | MINOR | qualification/impl | fixed — dedicated impl tests, producer VICE rendering checks and formal phase reviews exist |
| SR-705 | 6 | MAJOR | examples/status | fixed — `examples/rd06-assets/`, host observations and public status text remain |
| SR-706 | 8 | MINOR | charpad/tags | accepted — tile tags are validated structurally but not exposed as a selector because the plan does not list one |
| SR-801 | 6 | MAJOR | example/status | fixed — `examples/rd06-assets/` builds raw, Koala and PSID assets and `08-host-observations.md` records handler identities and the VICE/hardware boundary |
| SR-802 | 8 | MINOR | charpad/impl | fixed — synthetic CTM tests cover packed-12 overflow, no-tile defaults and per-mode color width |
| SR-803 | 7/8 | MINOR | producer/vice | fixed — native VICE observes SpritePad sprite bytes and CharPad charset bytes at their final addresses |
| SR-804 | 6/7/8 | MAJOR | closeout/coverage | fixed — committed synthetic SPD/CTM fixtures, focused producer examples, dedicated layout/evidence sidecar tests and formal phase 10 reviews exist |
| SR-805 | 5 | MINOR | layout/spec | fixed — 128-sprite fit, 256-sprite failure, alignment, bank visibility, character-ROM and region tests |
| SR-806 | 6 | MINOR | status/spec | fixed — producer-evidence retention, public synthetic status and VICE boundary tests |
| SR-807 | 5 | MINOR | evidence/impl | fixed — sidecar tests cover scalar `compileTime`, resident constraints/alignment/visibility and deduplicated build inputs |
| SR-808 | 7 | MINOR | spritepad/impl | fixed — synthetic name-length, no-tile and tile-cell tests |
| SR-809 | 7 | MAJOR | spritepad/tiles | fixed — `tiles` is `word[]` of sprite indices, cells are validated against SPQ |
| SR-810 | 8 | MAJOR | charpad/map | fixed — `map_packed12` added with 12-bit availability and packed bytes |
| SR-811 | 5 | MAJOR | layout/sprite-placement | fixed — sprite placement honors source `at`/align/noCross/region and fixed data |
| SR-812 | 5 | MAJOR | layout/sprite-holes | fixed — bank-0 first-fit from $2000 with a full-bank fallback below $2000 |
| SR-813 | 5 | MINOR | memory/views | fixed for views — CPU/VIC/Color windows tile and reconcile; screen/character-ROM reservation intervals remain deferred under SR-506 because the contiguous PRG spans them |
| SR-814 | 5 | MAJOR | evidence/word-types | fixed — resident assets carry their exact ArrayType; `word[]` type/shape and debug symbols are correct |
| SR-815 | 8 | MAJOR | charpad/robustness | fixed — maxima use loops, no spread-argument crash on large maps |
| SR-816 | 7 | MAJOR | example/sprite-pointer | fixed — the example and layout test use `setSpritePointer` instead of the color register |
| SR-817 | 8 | MAJOR | example/d018 | fixed — the CharPad example combines the screen field instead of clearing it |
| SR-818 | 5 | MINOR | diagnostics/field-errors | deferred — VIC field failures still surface as COMPILER_LOWERING/COMPILER_LAYOUT instead of E10143/E10273 |
| SR-819 | 5 | MINOR | diagnostics/reasons | deferred — invalid-asset/capacity reasons remain generic |
| SR-820 | 5 | MINOR | diagnostics/names | fixed — asset names use the basename instead of the extension token |
| SR-821 | 8 | MINOR | charpad/extra-selectors | accepted — `char_materials`/count selectors are useful extra surface; 65,536 count representation remains open |
| SR-822 | 8 | MINOR | charpad/colors | accepted — per-project colors are normalized to low nibbles; other methods preserve native bytes |
| SR-823 | 7/8 | MINOR | producer/vice-oracle | fixed — producer VICE checks assert alignment and bank-0 placement |
| SR-824 | 6 | MINOR | status/coverage | fixed — status counts and selector claim refreshed |
| SR-825 | 2 | MINOR | psid/rom-window | fixed — PSID no longer rejects CPU-visible $1000/$A000 payload intervals |
| SR-826 | 7/8 | MINOR | inventory/dynamic-types | deferred — SPD/CTM inventories advertise zero-length dynamic arrays |
| SR-827 | 5 | MINOR | evidence/padding | fixed — `paddingBeforeBytes` is derived from the preceding loaded payload and reported per asset |
| SR-828 | 6 | MINOR | qualification/red-phase | accepted gap — no preserved pre-implementation red log exists for the final fixture/example/integration/aliasing/blocked-gate files; green run is 14/14 and observed failure modes are recorded in 08-host-observations |

## Phase 10 independent review dispositions

Five independent read-only reviews covered phases 1–8 at HEAD `29099741`: correctness, semantics,
SFA/ABI, machine code and target platform. Every finding is dispositioned below. Fixed findings
carry a directed regression test; deferred findings are re-owned by a named roadmap row.

| Finding | Severity | Area | Disposition |
| --- | --- | --- | --- |
| P10-01 (SM-01) | CRITICAL | frontend/const aggregates | fixed — named/embedded aggregate initializers are encoded instead of silently becoming BSS; `[ROW]`, `const ALIAS = ROW` and address materialization covered |
| P10-02 (MC-01) | CRITICAL | machine/asset address | fixed — `&asset` lowers as a symbol address (`#<label`/`#>label`), never as the first data bytes; read, call-argument and VIC use covered |
| P10-03 (CR-01/SA-02/MC-03) | MAJOR | layout/sprite placement | fixed — a fixed sprite no longer collides with its own reserved range; explicit `place(at:)` covered |
| P10-04 (CR-02/SM-02) | MAJOR | layout/VIC placement | fixed — VIC-visible assets search the whole legal bank window, so content-hash order and code priority cannot decide feasibility; unplaced bitmap+screen covered |
| P10-05 (CR-03/SA-01) | MAJOR | evidence/zero-byte asset | fixed — zero-byte selected arrays publish a `byte[0]` optimized-away debug symbol plus a zero-byte cost entry; integration case covered |
| P10-06 (CR-04) | MAJOR | charpad/packed-12 | fixed — `map_packed12` publishes the complete packed length, including the odd-cell high-nibble byte; exact vector and type covered |
| P10-07 (CR-05) | MAJOR | specification coverage | partially fixed — synthetic SPD/CTM fixtures and spec negative cases added; remaining ST mapping mismatch is recorded as a documentation/test-map gap, not a code defect |
| P10-08 (SM-03) | MAJOR | machine/VIC constraints | fixed — all four VIC field operations attach consumer alignment and visibility; raw charset auto-placement covered |
| P10-09 (SM-04/SM-05) | MAJOR | diagnostics | deferred to T-24 — VIC field failures still surface as `COMPILER_LOWERING`/`COMPILER_LAYOUT` instead of source-linked E10143/E10273 with contributors; existing SR-818/SR-819 |
| P10-10 (SM-06) | MINOR | frontend/type resolution | fixed — a scalar selector in an unsized array declaration reports E10144 instead of E10253 |
| P10-11 (SM-07) | MINOR | inventory/types | deferred to T-25 — handler inventories advertise zero-length arrays despite exact parsed types; existing SR-826 |
| P10-12 (SM-08) | MINOR | diagnostics/remedies | deferred to T-25 — handler remedies list unavailable selectors alongside available ones |
| P10-13 (SM-09) | MINOR | frontend/placement | fixed — `place(...)` on a zero-byte selected output or a loadable declaration is E10272, not silently ignored |
| P10-14 (SM-10) | MINOR | aliasing/warning | fixed — raw aliases name the `raw` selector and loadable declarations no longer claim a shared resident address |
| P10-15 (SM-11) | MINOR | charpad/extra selectors | accepted — `char_materials`, `charset_count` and `tile_count` are extra useful surface; SR-821 remains the recorded decision |
| P10-16 (SA-03) | MINOR | resources/scratch | fixed — final `scratch` counts every helper-owned interval regardless of zero-page/RAM placement; `sizeCostVector` uses the same definition |
| P10-17 (MC-02) | MAJOR | machine/post-fold padding | deferred to T-21 — the VIC immediate fold now keeps a size-neutral identity logical op instead of leaving executable zero fill; the two-byte/two-cycle cost per folded op remains, Q-P15 stays at 385 bytes and makes no parity claim |
| P10-18 (MC-04) | MAJOR | machine/static raw address | deferred to T-22 — `poke(&local)`/`poke(&asset)` still build an indirect pointer instead of using a proved static absolute store |
| P10-19 (MC-05) | MAJOR | evidence/padding | fixed — `paddingBeforeBytes` reflects the real gap before each resident asset |
| P10-20 (MC-06/TP-01) | MAJOR | evidence/memory views | fixed for CPU bounds — free partitions are bounded to `$0801-$CFFF` and non-allocatable/screen/character-ROM gaps are reserved; intervals crossing `$4000` remain an SR-506/VIC-view residual |
| P10-21 (MC-07) | MAJOR | Q-P15 cost honesty | partially fixed — padding is now honest; renderer parity remains T-20 and cycles remain `Unknown` |
| P10-22 (MC-08) | MINOR | Q-P15 runtime oracle | accepted — VICE checks final memory, not MMIO order or per-loop cycles; both are recorded `Unknown`, not claimed |
| P10-23 (MC-09) | MINOR | machine/constant arithmetic | deferred to T-23 — a pure VIC field combined with an ordinary constant still emits runtime `clc`/`adc` |
| P10-24 (TP-02) | MINOR | producer identity | accepted deviation — AR-55 resolved the project pin to the available CharPad 3.80; the frozen specification still names 3.88 and that release-qualification gap is recorded in the closeout |
| P10-25 (TP-03) | MINOR | VICE claim | fixed — the Koala VICE test is titled placement/readback; it does not claim rendered-pixel visibility |
| P10-26 (TP-04) | MINOR | VICE display | accepted — the CharPad probe is a CPU-memory readback check, not a rendered-frame check; its comment now states that boundary. Combining `$10 |` was observed to fail the VICE checkpoint despite correct generated `$D018` bytes, so the probe keeps the minimal field write |
| P10-27 (TP-05) | MINOR | example/CIA2 | fixed in the public example — the redundant whole-PRA `$DD00` write is removed; the frozen Q-P15 workload keeps its historical write and records the ownership note |
| P10-28 (F-01) | CRITICAL | frontend/const aggregates | fixed — mixed named/scalar constants and inline `embed(...)` aggregates now encode; only genuinely non-constant/incomplete literals keep their existing diagnostic path. Spec coverage added for `[A, [N,4]]` and `[embed(...)]` |
| P10-29 (F-02) | MINOR | aliasing/warning | fixed — only resident declarations count toward W10151; a loadable sibling no longer suppresses the warning for resident aliases |
| P10-30 (F-03/SA-05) | MINOR | evidence/zero-byte type | fixed — zero-byte selected arrays retain their exact array type; `.assets.json` and `.debug.json` publish `shape:[0]` and the correct element spelling (`byte[0]` or `word[0]`) |
| P10-31 (SA-04) | MINOR | resources/scratch | fixed — `sizeCostVector` uses grouped all-helper physical intervals, matching the published `.costs`/reconciliation definition and avoiding overlay double counting |
| P10-32 (MC-10) | MINOR | VIC consumer extent | fixed — bitmap (8,000) and screen (1,000) consumers reject assets smaller than the bytes the VIC reads; a partial charset remains legal because only the used characters are fetched. Positive partial-charset and negative bitmap cases cover both rules |
| P10-33 (TP-06) | MINOR | plan/evidence text | fixed — plan wording now states bounded CPU free reporting, uncovered character-ROM reservations, CHAREN independence and placement/readback VICE scope |
