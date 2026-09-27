# Profile Facts: RD-05 Stage A

> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P2, AR-P4–AR-P7

## Source Contract

These are plan-owned names for the behavior required by R5.3, using existing scalar constant
and module rules. They are not a new language feature. The namespace is `c64.profile`; all
bindings are exported, immutable and available through qualified names or ordinary imports.

| Member | Type | PAL value | Later-NTSC value |
|---|---|---|---|
| `isPal` | `boolean` | `true` | `false` |
| `isNtsc` | `boolean` | `false` | `true` |
| `frameRateWhole` | `byte` | `50` | `59` |
| `frameRateFractionNumerator` | `word` | `34` | `2825` |
| `frameRateFractionDenominator` | `word` | `273` | `3419` |
| `rasterLines` | `word` | `312` | `263` |
| `cyclesPerLine` | `byte` | `63` | `65` |
| `cyclesPerFrame` | `word` | `19656` | `17095` |
| `cpuClockKilohertz` | `word` | `985` | `1022` |
| `cpuClockHzRemainder` | `word` | `248` | `730` |
| `sidModel` | `word` | `6581` or `8580`, selected by complete ID | Same |
| `sidAddress` | `word` | `$D400` | `$D400` |
| `usesKernal` | `boolean` | `true` | `true` |
| `hasRawInterrupts` | `boolean` | `false` | `false` |

The exact frame rate is mathematically `whole + numerator / denominator`; its fractional
part is positive, proper and reduced. The exact clock is mathematically
`kilohertz × 1000 + remainder`. These representations fit existing scalar types without a
32-bit integer, floating point, runtime object or arithmetic helper (AR-P5).

The values derive from the frozen [C64 appendix](../../../../../spec/appendix-c64.md) §9.1:
985248 / 19656 Hz and 1022730 / 17095 Hz. They are nominal profile clocks, not a promise about
every physical oscillator. Source arithmetic still obeys normal constant-context precision
and ordinary runtime integer rules; integer division is not silently changed into rational
arithmetic.

```blend
module Game;
import { isPal, rasterLines } from c64.profile;

const LAST_LINE: word = rasterLines - 1;

function main(): void {
  if (isPal) {
    c64.vic.setBorderColor(6);
  } else {
    c64.vic.setBorderColor(2);
  }
}
```

For example, a `word` constant initialized from
`c64.profile.frameRateWhole * 1000 + c64.profile.frameRateFractionNumerator * 1000 / c64.profile.frameRateFractionDenominator`
uses full-precision constant evaluation and truncates to integer millihertz. This is not a
recommendation to evaluate the same large intermediate expression in runtime `word` arithmetic.

`hasRawInterrupts` describes the cooperative contract, not a compiler-readiness probe.
There is no positive NMI-availability flag: AR-P3 is still unresolved. All branches retain
normal name/type checking; this API is not a preprocessor for referring to nonexistent names.

## Integration

AR-P6 selects one small, pure `packages/compiler/src/profile/c64-kernal.ts` module. Export a
closed `C64KernalProfileId` union, immutable `C64KernalProfileFacts`, and
`selectC64KernalFacts(profileId: string): C64KernalProfileFacts | null`. Four literal rows carry
ID, video (`pal`/`ntsc`), SID (`6581`/`8580`), clock hertz, raster geometry and the exact rate
components above. Unknown inputs return `null`, never a default. This module has no backend,
host, tool or service import, registry API or runtime configuration reader.

In `frontend/profile.ts`, widen `FrontendProfile.id` to that union and add a separate
`constants: readonly ProfileConstant[]` member. `ProfileConstant` has `name: string`,
`type: SemanticType` and `value: bigint | boolean`, all readonly. Keep the existing operation
list/signatures/effects unchanged. Constants are sorted by qualified name; operations keep
their current identities and order. Frontend declarations expose source-level facts, not
machine instructions, memory layout or emulator APIs.

Profile constants must also be available before enum/struct preparation and function-header
typing (PF-002). In `analyzer.ts`, supply the same selected immutable scalar declarations to
the existing aggregate constant lookup before constructing `AggregateRegistry` or calling
`prepareModuleBindings`. Use its existing host boundary in `semantic-types.ts` and the lookup
in `aggregate-constants.ts`; `aggregate-types.ts` owns the early consumers. Qualified names,
selective imports and aliases must resolve with the same identity, visibility, collision and
lexical-precedence rules as later expressions. A source constant derived from a profile constant
must work in array extents and enum values too. This is an input to the existing evaluators,
not another evaluator, manufactured source declaration or broad initialization-order refactor.

Extend `profile-bindings.ts` directly:

- Inject a readonly, initialized, known scalar constant binding using the existing constant
  storage kind and value state. Stable synthetic spans use `profile:<complete-id>` and a
  deterministic index after the existing operation indices.
- Include both operations and constants when recognizing imported profile modules. Qualified
  access, selective imports and aliases resolve to the same binding. Preserve normal lexical
  child-scope shadowing.
- Detect an existing source binding at a reserved qualified constant name and duplicate import
  aliases before inserting; report the ordinary duplicate-name diagnostic instead of silently
  overwriting a source binding. Unrelated source members in the same module remain ordinary
  source members; the module name alone does not grant an override.
- Reuse the binding-state callback already consumed by `ComptimeEvaluator`. A compile-time
  function can read these constants just as it can other constants; do not add an evaluator,
  context-specific substitute or profile singleton cache.

In `service.ts`, pass exact selected synthetic-member knowledge into the existing `modules.ts`
resolution path before it diagnoses missing exports (PF-003). This must work both without a
source `c64.profile` module and when that module contributes unrelated source members. Accept
only the selected profile's actual members; retain E10012 for genuinely missing or private
source members and E10003 for reserved-name/import collisions. Do not suppress E10012 wholesale
or grant all members of a profile-named module export visibility. Reuse the same selected
declarations, not backend facts or a new platform registry.

Also update `service.ts`'s existing `profileSatisfiesObligation` lookup to include the constant
namespace as well as operation namespaces. This handles unavailable-module obligations; it
does not replace the earlier mixed-module resolution check. Do not manufacture a source file.

Each analysis selects facts from its own immutable snapshot/override. Running PAL and NTSC
analyses consecutively or concurrently must not leak values between them (AR-P7).

## No Runtime Cost

Constants have no address, initializer, emitted data, SFA home, function scratch or runtime
dispatch. Their consumers use the existing expression-constant and mandatory CFG lowering.
Under `optimization: none`, compile-time-selected `if`, conditional, `switch` and loop paths
must disappear before SFA closure, including dead calls and MMIO effects. This does not relax
semantic checks on unreachable source (AR-P5/AR-P6).

Do not add an optional peephole pass or freeze a late code-generation workaround. Preserve
symbolic operations, effects and allocation boundaries so later optimizers retain the same
opportunities as they have with literal source. Behavior and assembly/cost are independent
oracles; see ST-14–ST-15. New source facts must add zero cost relative to the same literal
program on the same profile. Existing startup cost is accounted for separately, not hidden.

## Diagnostics and Compatibility

All cases use existing language diagnostics and source spans (AR-P7):

| Input/error class | Handling |
|---|---|
| Assignment to a profile constant | E10192, ordinary readonly-constant rule |
| Address of a scalar profile constant | E10040, no addressable storage |
| Unknown selective import | E10012 |
| Conflicting qualified definition or duplicate import binding | E10003; never silently overwrite |
| Result outside declared scalar range | Existing constant range diagnostic E10084 |
| Unsupported complete ID / partial or unknown ID at profile selection | E10279 with exact requested ID and deterministic supported-ID list; no fallback |
| Resident loader call on any of the four profiles | Preserve E10275 and its source proof; name the selected profile |
| Unencodable character on any selected profile | Preserve E10249; name the selected profile |

Thread the selected ID to `encodeC64Literal` as an optional fourth argument with the existing
PAL ID as its compatibility default. Production `encoded-literals.ts` supplies the actual
host profile ID after its existing selected-profile check. Existing three-argument encoding
tests/callers remain valid. Generalize the two resident-loader guards in `service.ts` and
`scalar-expressions.ts` through the closed selection predicate.

`firmwareVectorSink` applies its existing `$0314`/`$0318` restrictions to all four cooperative
IDs; it does not create or prove a new sink. The old `SELECTED_PROFILE_ID` may remain only as
the explicit PAL compatibility default, not as the admission guard. Preserve existing spec
tests. Change only the obsolete 8580 fixture in `profile.impl.test.ts` to an unsupported
takeover ID while retaining its rejection assertion (AR-P6).

## Verification

ST-1–ST-12 govern the frontend contract; ST-14–ST-15 govern generated cost and effects.
Implementation tests cover deterministic binding identities, immutable shared data and
snapshot isolation. The existing import-boundary suite must pass unchanged.
