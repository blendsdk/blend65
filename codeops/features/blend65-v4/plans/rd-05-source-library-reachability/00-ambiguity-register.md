# Decisions: source-library reachability prerequisite

> **Status**: 10 resolved; no open material item
> **Last Updated**: 2026-10-09 11:51 CEST
> **CodeOps Artifact Schema**: 1

## Boundaries and authority

Planning target: the approved [keyboard AR-P7](../rd-05-keyboard-input/00-ambiguity-register.md#ar-p7--selected-library-reachability-discovery)
prerequisite under blend65-v4/RD-05. This is not acquisition implementation or a new RD.
Context: frozen Chapters 3, 10–12; selected frontend, semantic, storage and artifact consumers;
the accepted keyboard contract. Modification set: this compact plan, the keyboard register,
feature roadmap, bounded compiler closure/metadata code and new tests. No old specification
test edits, bundled-library export changes, dependency, CLI mode, spec or expert changes.

The original complexity decision remains owned by keyboard AR-P7, including its complete
packet, independent **Justified** verdict and direct user **“I approve”** on 2026-10-08.
It is imported, not reopened or duplicated. Compiler-owned technical choices below use the
user's AGENTS.md PRIME workflow clause 4, which overrides default technical-decision prompts.
This is **not** `--auto-design`. Scope expansion and old-oracle edits still require exact authority.

| #    | Category                    | Closed question                                     | Resolution and authority                                                                                                                                                                                                                                                                                                                                                                       | Status      |
| ---- | --------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| AR-1 | Scope / approved complexity | Which prerequisite is authorized?                   | Only keyboard AR-P7's ordinary executable root/private-storage correction; imported exact approval.                                                                                                                                                                                                                                                                                            | ✅ Resolved |
| AR-2 | Behavior / integration      | Does source export create a binary entry?           | Frozen Chapter 10 defines visibility. Current builds require main; CLI/manifest/services expose no library-build ABI. Keep main, initializer, normative address and selected callback roots; remove export-only roots and their independent-entry seed in target analysis. A discovered real independent ABI reopens this item. Compiler-owned resolution.                                     | ✅ Resolved |
| AR-3 | Data / edge cases           | Which unused storage can disappear safely?          | Only explicitly private module storage with no initializer, placement, address escape or reached use. Unknown metadata, exported data, constants and explicitly requested zeropage remain. Apply before reservation/SFA/layout. Unknown or overlapping raw-memory access retains candidates; known disjoint byte/word access respects 16-bit wrapping. Compiler-owned resolution within AR-P7. | ✅ Resolved |
| AR-4 | Compatibility / failure     | What remains observable and how do failures behave? | Preserve every explicit initializer and its ordering, all reached load/store/address/destination uses, normative function addresses, handler routes and volatile effects. No new diagnostic or source restriction. Unknown proof retains data rather than rejecting source. Existing spec tests immutable, including AR-P6 until later acquisition implementation. Compiler-owned resolution.  | ✅ Resolved |
| AR-5 | Non-functional / naming     | How much machinery and cost is allowed?             | One focused semantic helper if needed to keep existing whole-program file below its size limit; optional private-visibility metadata, no new pass/framework/API. Scan definitions/uses with maps/sets, no per-global cross-product or new fixed-point solver. Runtime support cost zero; unused code/data absent; exact artifact deltas measured. Compiler-owned resolution.                   | ✅ Resolved |
| AR-6 | Verification / security     | Which proof and review gates apply?                 | Existing approved project rule: directed tests, then frozen install/build/typecheck/full Linux tests; VICE sequential. New implementation-blind spec author; independent correctness, semantics, SFA, output and host-performance review. No new input/security/host-tool boundary; immutable negative checks stay intact. Existing user-approved rule imported.                               | ✅ Resolved |

## Systematic scan

All twelve categories checked: feature, behavior and scope (AR-1/2/4); technical and
integration (AR-2/5); edge and data/state (AR-3/4); security/compliance (AR-6); non-functional
(AR-5/6); UX (AR-4, no new diagnostic); stakeholder conflict (AR-1/4, modern source and expert
output both retained); naming (AR-5, existing conventions). No hidden deferral or optional feature.

## Grounding and limits

`semantic/whole-program.ts:201–225` roots exports; `semantic/function-targets.ts:289–309`
also seeds exported functions as independent entries. `semantic/lower.ts:106–195` lacks
global visibility metadata. `services/zero-page-globals.ts:18` and `machine/lower.ts:73–98`
consume the retained global list. Frontend selection stays unchanged.

The executable API inspection includes `packages/cli/src/args.ts`, project manifest and
`services/services.ts:175–210`; frozen Chapter 10 mentions a future `--library` flag, which
this correction does not implement or redefine. Current selected platform operations have
scalar/handler inputs and fixed device/vector effects, not arbitrary source-RAM access;
operand place dependencies and callback bodies remain visible. Raw computed memory operations
are checked separately. A new opaque platform operation reopens this proof, not permission
to assume it harmless.

Confidence: Medium; a real independently callable ABI or unaccounted memory observer changes
the remedy. Hardening: include assignment-entry provenance, aggregate destinations, address
escape and raw-memory boundaries before consumers, not emitter-only pruning. Challenger:
converged for imported AR-P7; the planning run's two-challenger budget is exhausted for further
technical details. Those details add no material support surface and will receive independent
preflight/phase review. No compiler/output/runtime result is claimed yet.

Preflight PF-001 refines AR-3's conservative observer rule to cover unproved unchecked indexed
places/destinations, including locals and borrowed parameters, with complete width/stride/wrap
footprints. Independent finding-batch challenger converged on this direct extension; no new
range/alias framework or material support surface. PF-002 refines the existing indirect-call test
to require caller-assigned global callback use inside an exported helper. Both are compiler-owned
correctness/test-completeness resolutions under PRIME workflow4, not user risk waivers or new
product decisions. The approved AR-P7 boundary and immutable old-oracle rule are unchanged.

Expert lineage: `2.0.4`, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`;
`compiler-architecture.md#information-that-cannot-be-erased-early`,
`sfa-and-abi.md#call-graph-roots-and-escape` and `#final-storage-closure`,
`il-and-optimization.md#memory-effects-and-volatility` and `#two-oracle-proof`;
source key `BLEND65-SPEC-4-038b70e9`. Finding: current export/data retention prevents the cold
source-library bound. Remedy: approved existing-closure correction. Status: Verified partial
(source inspection only); claim kind: Fact for current retention, Recommendation for remedy.

## AR-7 (runtime): exact new-fixture semantic corrections

The first implementation-blind data run exposed assumptions in newly authored fixtures, not
authority to change compiler behavior or an old oracle. Frozen Chapter 3 §5.1 requires explicit
module initialization before main, not containment of its home in loaded PRG bytes. Chapter 12
§3.1 returns the complete raw device byte, not just the meaningful color nibble.

Compiler-owned resolution under PRIME workflow4: the blind author replaces only ST-9's
explicit-zero PRG-containment assertion with a seeded retained-home VICE observation and exactly
one final initializer write before main. Retention/identity/size, placed address, requested ZP,
constant bytes and accounting checks remain. ST-11 and ST-12 compare source A/X results with
independent device-byte observations and separately check written color nibbles. Their sources,
volatile width/order/count, exact output and selection expectations remain unchanged.

No old specification test, frozen authority, product contract or support surface changes. The
initial RED log remains evidence; the corrected qualified run must be recorded before production
implementation. Independent oracle review remains required. Status: Resolved; no behavior or
runtime qualification of the compiler correction is implied.

## AR-8 (runtime): small existing output/evidence defects outside named producers

The new complete word-footprint oracle independently expects zero-page instructions. Its first
RED run shows absolute instructions at `$0001/$0002`, costing two extra bytes and two nominal
cycles per word read/write. `machine/lower-memory.ts` selects `absolute` unconditionally for
known byte addresses; frozen Chapter 12 §3.1 requires appropriate zero-page selection.
Separately, `services/memory-evidence-records.ts:70` classifies only SFA intervals as zero page,
so a retained explicit source-global ZP home is reported as general memory. The unchanged new
ST-9 assertion will independently check that consumer boundary after its fixture correction.

Best option: extend this phase only to the three fixed-byte addressing-mode selections in
`machine/lower-memory.ts`, physical zero-page classification in
`services/memory-evidence-records.ts`, and focused implementation tests. No public interface,
runtime, framework, frozen authority or old specification-test change. The alternative is to
keep the scope unchanged and leave the affected new output/evidence cases unresolved with a
separate owned correction. This is an exact modification-set scope decision, not permission to
weaken either oracle. The user explicitly approved this exact two-file extension on 2026-10-09
with “I approve” after the self-contained scope request. Status: Resolved. The modification set
now includes only these fixed-address selections, complete physical zero-page classification
and focused implementation tests. Existing independent RED expectations remain unchanged.

The first post-selection run reaches the previously hidden `$FFFF` word assertions. Their high
byte at `$0000` exposes the same addressing defect. Sixteen word instruction cases and four
zero-page resource-class cases now depend on this exact extension. Retention/omission assertions
reached before those failures pass. Neither additional production file has been edited.

## AR-9 (runtime): observation boundary in the new joystick trace fixture

ST-14's exact generated bytes, complete artifact/resource comparisons and returned raw port byte
pass, but collecting monitor events immediately at the instruction following the load returns
no read event. Eight unchanged joystick-order controls pass on the same four profiles.

Compiler-owned resolution under PRIME workflow4: after preserving the original stopped-CPU
value assertion, execute the fixture's already-present NOP before collecting the preceding read
event. Sources, expected bytes, exact one-read assertion and all cost expectations remain
unchanged. All eight new joystick cases then pass (`joystick-trace-nop.log`, 11.60 seconds).
This qualifies the observation-boundary remedy, not a universal explanation of VICE internals.

No production behavior, generated instruction, cost bound, old oracle, public monitor API or
support framework changes. Independent oracle review remains required. Status: Resolved;
this directed fixture result is not an all-green phase or full-checkpoint claim.

## AR-10 (runtime): collect the initializer trace after a verified non-writing instruction

After the approved AR-8 corrections, all sixteen instruction and four physical-resource cases
pass. ST-9 then reaches its previously hidden exact write-event assertion: memory is correctly
zero before main, but the immediate boundary reports no event. The same collection boundary
was already qualified for the new joystick fixture under AR-9.

Compiler-owned resolution under PRIME workflow4: preserve the zero-before-main assertion, verify
that main begins with the existing two-byte `LDA #37`, execute only that non-writing instruction,
then collect the exact one initializer-write event. The original source, expected zero value,
one-write requirement and every retention/placement/resource assertion remain unchanged. The
added byte and A-value checks independently exclude a write during the extended observation.
No old oracle, compiler behavior, source instruction or cost bound changes. Status: Resolved;
directed and combined runs plus independent oracle review must qualify the instrumentation.
