# Stack evidence: finite components, unproved external total

> **Parent**: [Index](00-index.md)
> **Authority**: AR-P7/AR-P10/AR-P12; RD-05 R5.9/R5.17; Ch 06 §5.5 and Ch 15

## Direct change

Reuse `prepareEvidence` in `services/evidence.ts`. All four cooperative PRG
profiles report `runtimeMemorySafety: "unproven"` even without a generated hook.
That says only the full external guarantee is unproved; static interval/SFA/ACME
reconciliation and proved finite component checks remain valid.

Emit one existing-shape `machineState` record in `unboundedEffects`, attributed
to the actual main declaration's source site. Its exact stable `effectClass` is
`external-nmi-aggregate-stack+retained-nmi-firmware-completion+external-nmi-finite-deadline`.
This is one opaque class value, not a new delimiter-parsing contract. It names
these three obligations; the table describes scopes, not three wire records:

| `effectClass`                      | Scope not proved                                             |
| ---------------------------------- | ------------------------------------------------------------ |
| `external-nmi-aggregate-stack`     | Unrestricted externally caused CPU frames and suspended work |
| `retained-nmi-firmware-completion` | Retained source-dependent firmware reentrancy/completion     |
| `external-nmi-finite-deadline`     | A finite completion/deadline under unrestricted arrivals     |

Preserve other genuine unbounded effects and canonical ordering. No fabricated
site, new discriminator, public schema or helper registry. Use the existing
source-site projection already used for build/debug evidence. Existing uniqueness
is source site plus kind; merge obligations into the one machine-state record
at that site rather than emitting duplicate keys.

The existing record projection is `{ kind: "machineState", site: { path,
startByte, endByte }, effectClass }`. The site is the complete selected main
declaration, including any export/placement modifiers through the closing brace,
measured in UTF-8 bytes with its real project-relative source path. It is not just
the `function` or name token or a synthetic empty site. This pins the public test interface without
requiring a specification author to inspect implementation logic.

## Numeric accounting

`usable = capacity - reserve`. Reserve is withheld capacity, never executed use.
Remove the numeric `platform-reserve` usage row and unrestricted
`qualified-capacity` claim. Preserve bounded component rows; rename the combined
finite row `bounded-component-capacity`, with usable capacity, exact proved
component peak and arithmetic headroom. Its route explicitly names the proved
component, not the unrestricted machine. Mainline/IRQ terms retain the existing
exact simultaneous-path proof; do not add independent maxima together.

Generated NMI per-entry rows are added only when [the route proof](03-nmi-route.md)
qualifies them. A per-entry row is not aggregated over unrestricted arrivals.
For each selected variant the ID is `nmi-entry:<entry-variant-id>` and the route
starts with `["per-entry:generated-nmi", "<entry-variant-id>"]`, followed by its
ordinary body/helper route. Capacity is 236, peak is CPU-inclusive selected
entry/body/helper use, and headroom is capacity minus peak. Existing debug entry
variant IDs provide the correlation; no new public field is required.
The numeric `hardwareStack` cost is the maximum proved finite component value
in `stackDomains`, excluding reserve. This preserves the old numeric relation
without claiming that number bounds external stack use. Exact resources stay
numeric; the existing unbounded-effects/status fields carry uncertainty.

Existing stack rows have `{ id, route, capacityBytes, peakBytes, headroomBytes }`.
The combined row's route starts with `bounded-component:generated-program-and-irq`
and retains its exact proved source-route tail; no reserve is a route use.
Existing cost resources have `{ kind: "standard", id: "hardwareStack", value }`.
These are schema-1 record projections, not a new interface or discriminator.

Finite capacity checks still reject an actual bounded-component overflow with
E10238. Keep W10180's exact canonical message and decomposition; the accompanying
evidence establishes its finite-component scope. No diagnostic identity/message
change and no specification-test exception beyond AR-P11/AR-P14.

## Integration and verification

No signature change to `prepareEvidence`, evidence types or validators. Use
the existing `StorageClosureCertificate` finite fields with their scoped meaning;
the NMI component owns correct mixed-route facts before evidence consumption.
Validate final evidence with existing validators. ST-1–ST-4 own public oracles.
Synthetic bounded validator/closure fixtures remain untouched. Small internal
tests cover single-record grouping, ordering, source-site provenance and
reserve/peak arithmetic. Correct only the obsolete reserve/combined-capacity
assertions in `services/services.impl.test.ts`; retain publication, identity,
debug and every unrelated assertion.
