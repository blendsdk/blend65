# RD-06 Closeout

> **Document**: 09-closeout.md
> **Parent**: [Index](00-index.md)
> **Status**: Closed
> **Date**: 2026-11-09

## Result

RD-06 delivered native asset handlers (raw, PSID v1–v4, Koala, SpritePad SPD v5 and
CharPad CTM v9), compile-time selectors and retention, resident layout constraints,
derived VIC fields, producer evidence, public synthetic fixtures and the Q-P15
qualification workload. Phases 1–8 are complete; the eleven Phase 10 closeout tasks
are recorded below.

The RD is **complete with owned residual work**. No known critical or major
correctness defect is open. Deferred evidence/optimization items are re-owned by
`T-20`–`T-27` in the roadmap; they do not name RD-06 as their landing place.

## Verification record

Impact-based verification is the repository standard. The complete root suite was
attempted once at the Phase 10 boundary; its result is recorded below. Directed
suites cover every changed area.

| Check | Command | Result |
| --- | --- | --- |
| Frozen install | `yarn install --frozen-lockfile` | pass |
| Build | `yarn build` | pass |
| Typecheck | `yarn typecheck` | pass |
| Compiler package | `yarn workspace @blend65/compiler test` | 3,634 passed, 2 skipped |
| Foundation boundary | `BLEND65_FOUNDATION_CI=1 yarn vitest run` | 57 passed |
| RD-06 directed | `yarn vitest run test/rd06/...` (non-VICE) | 82 passed |
| RD-04/M1/RD-06 directed | `yarn vitest run test/rd06 test/rd04 test/m1 test/rd05/joystick-api-output.spec.test.ts` | 908 passed |
| Sequential VICE qualification | four RD-06 VICE files, then the directed run | 6 passed within the 908 |
| Complete root suite | `yarn test` | attempted twice; 1,958 root tests passed with 0 failures before the 90-minute host limit |
| Frozen specification | `git status --porcelain spec/` | empty |

The impact-based record is the compiler package plus the directed RD-06, RD-04,
M1 and RD-05 joystick suites, including every RD-06 VICE file. The complete root
suite includes every historical RD-04/RD-05 emulator journey and runs serially.
It passed 1,958 root tests with zero failures in the second attempt before the
90-minute host limit. The remaining RD-05 corpus is outside RD-06's changed
impact set and remains RD-05-owned; its duration is host-bound and is not used
to weaken the directed gates.

## Evidence audit

The unblocked evidence set was audited through `test/rd06/evidence-assets.impl.test.ts`
and the integration/aliasing tests:

- `.assets.json`, `.memory.json`, `.costs.json`, `.debug.json` and `.labels` reconcile
  for resident, scalar and zero-byte assets.
- `.memory.json` publishes three views. The CPU free partition is bounded to
  `$0801-$CFFF`; non-allocatable CPU ranges, the active screen and uncovered
  character-ROM windows are reported as reservations. The VIC bank view and Color
  RAM view tile their windows exactly.
- Compile-time scalar outputs publish `compileTime` placement, an optimized-away
  debug symbol/location and a zero-byte program cost entry. Zero-byte selected
  arrays publish `byte[0]` debug evidence without resident bytes.
- Asset padding is derived from the preceding loaded payload.
- `residentRam` excludes reservation intervals; `scratch` counts every helper-owned
  interval regardless of zero-page/RAM placement.
- Duplicate selector declarations merge into one asset, emit W10151 and emit the
  bytes once.

## Independent reviews

Five independent read-only reviews covered phases 1–8: correctness, semantics,
SFA/ABI, machine code and target platform. All findings are dispositioned in
[05-findings.md](05-findings.md#phase-10-independent-review-dispositions).

| Result | Count |
| --- | --- |
| Critical findings fixed | 3 (including one incomplete-fix follow-up) |
| Major findings fixed | 7 |
| Major findings partially fixed with owned residual | 2 |
| Minor follow-up findings fixed | 7 |
| Findings accepted with rationale | 4 |
| Findings deferred to owned roadmap rows | 6 |

The SFA/ABI auditor confirmed: no function-execution storage is created after SFA
closure, resident assets never occupy SFA homes, scalar selectors have no ABI
storage or runtime read, and interrupt/helper storage is unchanged. The
machine-code auditor's critical address-materialization defect is fixed and
covered by an artifact assertion. The final fix-verification pass found one
incomplete critical fix (mixed scalar/embedded const aggregates) plus five minor
follow-ups (resident-only W10151, exact zero-byte array type, grouped helper
scratch, VIC bitmap/screen extent, and plan wording); all were fixed and the
directed suites re-run green.

## Deferral-expiry gate

**Question:** did this RD's deliverables expire any deferral's stated rationale?

| Deferral | Rationale when recorded | Expired by RD-06? | New owner |
| --- | --- | --- | --- |
| SR-301 ordinal write | `poke(base+index)` still uses the indirect path; parity work belongs to a dedicated lowering slice | No — RD-06 did not add ordinal write lowering | `T-20` |
| SR-506 screen/character-ROM reservations | A contiguous PRG spans those addresses as CPU RAM; adding disjoint CPU intervals would double-count bytes | No — the CPU view is now bounded and reserved; the VIC crossing projection remains separate | `T-26` |
| SR-507 relocated screen tail | Pointer table base is layout-derived work not present in the selected profile API | No — RD-06 added no relocated-screen pointer table | `T-27` |
| SR-703 synthetic SPD/CTM fixtures | Committed synthetic fixtures were not generated | **Yes — expired** | fixed in this RD |
| SR-804 closeout coverage | Synthetic fixtures, focused examples, sidecar tests and formal reviews remained | **Yes — expired** | fixed in this RD |
| SR-818/SR-819 diagnostics | VIC field failures still use generic lowering/layout diagnostics | No — the source-linked diagnostic path is separate | `T-24` |
| SR-826 dynamic inventory types | Handler inventories advertise zero-length arrays | No — inventory typing is separate | `T-25` |
| SR-827 asset padding | `paddingBeforeBytes` was hardcoded to zero | **Yes — expired** | fixed in this RD |
| SR-828 red-phase log | No pre-implementation red log exists for five final spec files | No — accepted qualification gap; the green run and observed failure modes are recorded | RD-06 record |
| P10-17 post-fold padding | VIC folding runs after sizing | No — layout/machine sizing slice | `T-21` |
| P10-18 static raw address | Static `poke(&place)` still uses an indirect pair | No — lowering slice | `T-22` |
| P10-23 VIC constant arithmetic | Pure field plus ordinary constant emits runtime arithmetic | No — optimization slice | `T-23` |
| P10-24 CharPad 3.80 pin | Only CharPad 3.80 is installed locally; the frozen specification names 3.88 | No — release qualification must obtain 3.88 evidence or record an approved deviation | release owner |

No deferral names RD-06 as its future landing place. Residual parity and evidence
debt is also tracked in [issue #140](https://github.com/blendsdk/blend65/issues/140)
and the `T-20`–`T-27` roadmap rows.

## Honest status and evidence boundary

- **VICE-verified / hardware-unverified.** All C64 runtime evidence comes from VICE
  3.10 `x64sc`. No physical C64, VIC revision, SID analogue, CIA edge or cartridge
  behavior is claimed.
- **Producer examples are local-only.** The licensed SpritePad/CharPad applications,
  manuals and real examples remain under `/home/gevik/workdir/github/blend65.ri/apps`
  and are never committed. Committed public SPD/CTM fixtures are synthetic and
  redistributable; the producer checkpoint verifies that no public fixture copies a
  local producer hash.
- **CharPad identity.** The installed producer is 3.80 and the handler/evidence
  identity records 3.80. The frozen Specification 4 profile names CharPad 3.88.
  CTM v9 bytes are unchanged by the producer release; 3.88 evidence remains a
  release-qualification item, not a claim made here.
- **Q-P15 parity.** The renderer publishes 385 code-segment bytes and marks
  whole-path cycles `Unknown`. The post-layout VIC fold keeps a size-neutral
  identity logical op so fallthrough cannot execute zero fill; the two-byte
  cost per fold and the `poke(base+index)` indirect path are owned by `T-21` and
  `T-20`. No expert-parity claim is made.
- **Review boundary.** Reviews were static. The green compiler/directed/VICE runs
  are the execution evidence; the reviewers did not re-run emulators or physical
  hardware.

### Supplementary RD-05 corpus observation

The 182-file RD-05 corpus was also run while closeout work was in progress. It
reported 5,215 passed and 17 failed in five files. Four failures were test
assumptions that every `cpu16` interval is a program home; those checks now skip
device reservation intervals. The fifth was a VIC collision timing timeout; it
passed 16/16 when rerun alone on an unloaded host. The four affected suites pass
84/84 after the adjustment, and the collision suite passes 16/16. The full
182-file corpus was not rerun end-to-end; it is RD-05-owned and outside RD-06's
changed impact set.

## Residual risk

| Risk | Level | Owner |
| --- | --- | --- |
| Q-P15 renderer remains slower/larger than an expert ordinal write | Medium | `T-20` |
| Two-byte post-fold code padding and mixed segment/executed byte reporting | Low | `T-21` |
| Static `poke(&place)` uses an indirect pair | Low | `T-22` |
| VIC field diagnostics remain generic | Low | `T-24` |
| VIC view crossing intervals / reservations | Low | `T-26` |
| CharPad 3.88 release qualification absent | Medium | release owner |

## Task record

| Task | Result |
| --- | --- |
| 10.1.1 Complete unblocked suite and impact-based record | complete |
| 10.1.2 Audit unblocked sidecars | complete |
| 10.1.3 Contingency closeout and roadmap record | complete |
| 10.1.4 Unblocked-phase reviews | complete |
| 10.2.1 Complete boundary suite | complete / recorded above |
| 10.2.2 Sequential four-profile VICE qualification | RD-06 VICE 6/6; the broader RD-05 four-profile corpus is outside RD-06's changed impact set and remains RD-05-owned |
| 10.2.3 Final independent reviews | complete |
| 10.2.4 Complete evidence audit | complete |
| 10.2.5 Deferral-expiry gate | complete |
| 10.2.6 Honest public status and host observations | complete |
| 10.2.7 Roadmap and closeout | complete |
