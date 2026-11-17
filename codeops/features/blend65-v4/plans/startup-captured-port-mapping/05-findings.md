# Captured startup mapping — findings

| Finding | Phase    | Severity | Area                     | Ruling |
| ------- | -------- | -------- | ------------------------ | ------ |
| RV-001  | T-168.24 | MAJOR    | oracle-integrity         | fixed  |
| RV-002  | T-168.28 | MAJOR    | frozen-artifact-identity | fixed  |

## RV-001 — frozen constructor asserts an unapproved capture order

**Status:** Incorrect oracle expectation corrected under exact user approval and independently
fix-reviewed; runtime/phase verification still pending. **Claim kind:** Fact,
bounded to the ordering assertion and approved unchanged-chronology constraint.

The constructor test at `startup-captured-port.spec.test.ts:127–128` requires the selected reads
`[0,1,$DD02,$D018,$D015]`. The baseline constructor captures CPU then VIC state, maps CPU port
and direction, then captures CIA2 DDRA: `[0,1,$D018,$D015,$DD02]`. The repair preserves that
chronology. Independent review identifies an oracle-authoring erratum, not an unauthorized later
edit or a production-order defect. Initial RED failed earlier on duplicate reads, so it did not
validate this later assertion.

**Authority:** frozen `spec/appendix-c64.md:219–231` requires captured-derived mapping and ordered
port-before-direction writes/restoration; it does not mandate CIA2 capture before VIC captures.
The approved plan preserves existing captures and specializes their register retention/consumption.
Snapshot offsets are storage layout, not capture chronology. Reordering hardware accesses solely
to satisfy this array would exceed that bounded repair.

**Refutation:** agreement with current implementation is not sufficient evidence. The primary
separately inspected exact baseline `27ebf448:packages/compiler/src/layout/startup.ts:286–298,
335–343,365–387`; it confirms VIC capture precedes the later CIA2 capture before this repair.
The reviewer independently inspected contract/current code; historical chronology and hashes were
parent-supplied, not independently recomputed. No broader phase verdict follows.

**Recommended exact remedy:** with explicit user approval, change only line 128's expected array
to `[0, 1, 0xd018, 0xd015, 0xdd02]`. Keep the ordered equality, filter, single-read checks,
snapshot offsets/stores, volatility, mapping core and every other assertion unchanged. Do not
sort/remove the check or move production MMIO accesses. The current freeze is
`7e8d8b3bfacd325206893b3c208fdb35d83c3057deaf47f4f16ba1e1c4cbaa53`; neither prior old-oracle
exception covers this file. The new VICE oracle remains untouched.

**Evidence limit:** constructor32/48 pass; subsequent compiler build/public/VICE steps did not run.
No complete gate, runtime, cost, aggregate interrupt-bound or physical-hardware proof is added.
**Lineage:** expert 2.0.4, frozen content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
`c64-memory-and-runtime#Startup contracts`, source `BLEND65-SPEC-4-038b70e9` Appendix C64 §5.1.

### Exact ruling and correction

On 2026-11-17 the user approved only the expected-array replacement above. The independent
original author applied that single line with no forbidden exposure or execution. Primary compared
the entire file with the preserved pre-edit bytes plus that one replacement: exact equality passes.
The VICE oracle hash is unchanged. The independent correctness fix-review reports RV-001 resolved
and no remaining finding in this bounded exception. No production MMIO access moved.

Active constructor hash is `17a5a7b7436915fa06956511f9778a70c9455be24f7bb15b34858da358522852`.
This is no permission for another edit or a passing constructor/build/runtime/full gate; those
commands remain the execution owner's next step. Whole-file hash comparison is primary evidence,
not a command independently run by the reviewer.

## Additional exact-authority gate — M1 padding consequence

The changed+host failure is independently classified as artifact snapshot drift, with **no
machine-code regression finding** in that bounded diagnosis. Seventeen cases in eight
implementation-test files report the expected two-byte full-startup reduction. Their current-output
sizes and canonical-none hash can be reconciled under the approved measured-pin scope; ZP,
scratch, sources, optimized hashes and behavior expectations remain unchanged.

The remaining case is `test/m1/pipeline.spec.test.ts:134`, SHA-256
`c2a738a96f6cfe9670c66e8142ad819d7a3f203c446d96ea93bed4691b947321`. Its exact padding
expectation2,936 becomes2,938 when the preceding full startup shrinks two bytes and the sprite
stays at `$2000`. Independent diagnosis grounds this in the official instruction sizes, fixed
asset anchor and evidence gap calculation, not merely agreement with output. Fresh public M1
measurement confirms one unchanged512-byte asset/hash, start/end `$2000/$2200`, alignment64,
and unchanged6,655 payload; smaller code is offset by greater padding.

**Exact exception approved by the user on 2026-11-17:** change only
`paddingBeforeBytes: 2936` to `paddingBeforeBytes: 2938` in that file. Keep all asset identity,
copy count, placement, alignment, output-set, digest, behavior and independent expert-floor checks
unchanged. Do not retain dead code, weaken the assertion or grant another oracle exception.
Assertions after the old failure must actually run after approval.

The auditor directly inspected producer/placement/evidence and affected assertions; runtime/public
measurements are primary-supplied. Historical whole-program body binaries were not retained for
the17 implementation cases; exact body identity is unproved. That is a claim ceiling, not a blocker
to deliberate implementation-snapshot maintenance under the independently justified delta and
fresh measurements. No compiler fork, code swapping, new comparison framework or fabricated
historical evidence is warranted. No full gate or phase-pass conclusion follows.

The primary applied only that M1 scalar, verified exact whole-file reconstruction from preserved
original bytes and obtained an independent bounded application check with no findings. Active M1
SHA-256 is `dc11c7f1ca1dc782089e699b31fa0441742f3492d263320c13cdfee978cea04d`. All other
M1 assertions, including expert-floor checks, are unchanged. Eight implementation files change
only48 size fields (two bytes each) and the saved-none size/hash, verified against preserved bytes;
the independent check confirms those inspected values. Affected tests/host verification remain.

## Six-lens bounded execution reviews

The shared [review packet](07-review-context.md) fixes the actual dependency delta, exact oracle
authority and evidence limits. Reviews are read-only; verification remains the primary's separate
gate. Review agreement never advances the pending changed+host or complete checkpoint.

| Role             | Assigned boundary                                                                                       | Result                                                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness      | Correctness/maintainability/documentation, exact oracle exceptions, new-test cleanup and evidence scope | No findings. Current assertions inspected; whole-file reconstruction/hashes are primary-supplied, not independently recomputed.                                                                                                                     |
| Semantics/DX     | Source behavior, ownership/evaluation and modern-source entry expectations                              | No findings in either semantic preservation or DX. Captured formulas, A-only hold window, initializer order, tail main and original-state restoration checked.                                                                                      |
| SFA/ABI          | Held-register lifetimes, caller restoration and final storage/binding consumers                         | No findings. Producer through serializer/binding closure checked; no added home/scratch/spill/stack, no compact no-Y classification leakage or new interrupt route.                                                                                 |
| Target platform  | Selected machine/MMIO/firmware/banking/interrupt preservation and placement                             | No findings. Captured formulas, DDRA-only bank selection, admitted returning IRQ/NMI holds and constructor isolation checked; no new route qualification inferred.                                                                                  |
| Emitted code     | Equivalent expert forms and complete artifact/resource cost                                             | No findings, including actual-byte/final-placement endpoint. Fresh primary handoff directly inspected: capture10B/14cycles, mapping12B/16, entry326B/439, restore281B/385 including RTS; full607B/824 nominal cycles. No added storage/helper/mask. |
| Host performance | Bounded constructor/binding cost; no new hot-path scaling or support layer                              | No findings after supplying the exact production diff. Fixed44+B capture calls, B≤141, same two instructions per helper; added constant register selection, no new traversal/retained state/blocking. No benchmark claim.                           |

Correctness review reports no fresh runtime/full-green claim and leaves historical body-byte
identity, whole-frame timing, aggregate external interrupt bounds and silicon unproved. Other
lenses must return independently; this is not the final phase disposition. Semantics and SFA/ABI
also consume supplied qualified excerpts without hidden-authority reads; their execution results
are primary-supplied and do not certify external firmware/interrupt/physical completion.

Platform independently refutes capture/visibility/return-order faults within the admitted stock
contract. Host-performance review initially requested an exact diff; primary verified the baseline
hash and supplied that diff as authorized input before its no-findings conclusion. Emitted-code
review did not access denied retained logs and reports only a clear source/IR boundary so far.
No final six-lens disposition is claimed until the separate actual-byte evidence is assessed.

### Final six-lens disposition

All six independent execution lenses now report no findings. Emitted-code review consumed the
fresh primary [actual-byte evidence](06-actual-byte-evidence.md), not either denied external log,
and closes the encoding/final-placement endpoint. Its direct hex inspection confirms the exact
capture/mapping forms, all41 A-only snapshots, correct absolute homes and ordered restoration.
The primary checked durable excerpts against its own fresh public artifacts; reviewers did not
execute commands or recompute hashes. No production/test fix follows these execution reviews.

This disposition completes T-168.27 only. The fresh host pass is not the complete workspace/VICE
gate. Local expert mapping parity is bounded; padding absorbs the code saving and #168 still owns
799 code bytes/whole-frame timing. No universal hardware, arbitrary-handler, aggregate interrupt,
firmware completion or historical body-binary guarantee is asserted.

## RV-002 — newly reached frozen saved-none identity pin

The complete gate exposes a separate frozen assertion at
`test/rd05/canonical-fixed-object-abi-fallback.spec.test.ts:531–533`, original SHA-256
`de1900b7b209bbf1d76c5ba64b9ff19b60ec2c31698c253855a860dd03c712fc`.
Independent correctness diagnosis (reviewer-local RV-001, uniquely recorded here as RV-002)
classifies it as an artifact snapshot requiring a new exact user exception, not a requirement to
retain the incorrect live-read startup. Previous implementation-pin maintenance grants no spec
authority. No unauthorized edit is reported; this file remains frozen.

The frozen captured-readback contract mandates the repair; independent instruction sizes justify
two fewer bytes. Fresh public measurements of this exact unchanged saved-input source/profile/
`none` mode report payload2,159, entry371 and PRG SHA-256
`f40c0fa82e77b7ab74fc932d8267d84934724851be65170c71282f757271f6e6`.
The strongest objection is valid: an exact-identity test cannot be changed merely because output
is smaller or a neighbouring implementation test was updated. The separate correctness obligation
and independent sequence justify requesting an exception, not bypassing its user-owned gate.

**Exact correction approved by the user on 2026-11-17:** only payload2,161→2,159 and old hash
`74b9d6b8ab3e81b309284652a061682f718ef3543f22bd3f8505753d22b99252`→
`f40c0fa82e77b7ab74fc932d8267d84934724851be65170c71282f757271f6e6`.
Retain exact equality/hash checks, source/profile/mode, accounting and all ABI/layout/candidate/
resource/behavior assertions. Preserve original bytes, check exact reconstruction, independently
review and re-freeze under that exact approval. No other oracle exception is authorized.

This diagnosis did not run commands or independently recompute hashes. The complete run failed
before its hash assertion; historical body-byte identity remains unproved. The independent safe-
return timeout is not classified by this review, and no full GREEN follows either result.

The user subsequently approved exactly those two values. Primary preserved the original and
verified whole-file reconstruction from only the single payload and hash replacements. Active
file SHA-256 is `414f14a0ae4d7051633cd0ee105b259a47cb33efce8305e29bce08cdf3051296`.
Independent correctness fix-review reports no findings/RV-002 resolved. No other byte or oracle
assertion changed. Both affected files now pass24/24 under the existing serialized VICE tier;
that directed result is not complete-gate closure or an explanation for the old timeout.

## DG-001 — safe-return timeout, original cause remains Unknown

The platform auditor's initial reviewer-local TP-001 analysis is retained as this distinct
diagnostic, not confused with the parent's resolved sampler TP-001. The original full-run error
does not identify which checkpoint await timed out. It remains a failed gate observation.

One primary existing-API phase probe uses unchanged source/configuration/100M-cycle limit and
only the original entry/return checkpoints. Source SHA-256 is
`27a970b18672513af26e36f3415645549da12b0c372817ef38f7041ab08760a9`;
PRG SHA-256 is `abcfc13b00d7d8b1619a021acfc846bbd3855385bbe87cf870d1c07b3d4e05cf`.
It selects compact-stored/no-Y, not the changed full-capture path: entry51B at `$080D–$0840`,
restore29B at `$9E2A–$9E47`, state6B at `$9E47–$9E4D`, all below BASIC's `$A000` window.
Published component peak187/capacity236 is not an external interrupt-stack guarantee.

The probe reaches startup in14,621.374ms and SYS continuation `$E147` in72.859ms. Caller SP246/P0
returns SP248/P32, exactly satisfying the original SP+2 and P&`$CF` assertions. Its configured
60-second observation windows are diagnostic only; both actual waits finish within the original
20 seconds. No retry, injection, intermediate halt, constructor/test/helper edit or emulator
configuration change occurred. The owned temporary project/process is cleaned.

After consuming these results, independent platform analysis finds no concrete banking/return/
stack fault for this artifact, but does not call the original timeout fixed or a host flake. The
original await, original artifact identity and all interleavings are not recovered by this probe.
No additional launch is justified without a concrete new hypothesis.

**Minimum retained qualification:** leave runtime assertions/timeouts/source unchanged, preserve
the original failure and require the actual fresh complete gate after separately authorized
RV-002 correction. This waives no normative obligation and the diagnostic is not gate closure.
A later green run qualifies that checkpoint, not a retrospective explanation; another timeout
stops for bounded diagnosis, never retry-until-green. Physical/timing/external bounds remain open.

The unchanged runtime test subsequently passes in the actual two-file/24-case directed command,
using its original20-second helper waits. This is stronger than the configured60-second diagnostic
but still does not recover the earlier failure's phase/cause. The prior failed gate remains;
require the actual new complete run and stop on any recurrence rather than change the timeout.
