# Game systems in application source

Use this reference to turn game rules into readable application code. Read
[workflow and source](workflow-and-source.md) for types, modules and public tools,
and [evidence and boundaries](evidence-and-boundaries.md) before making claims.

The compiler is not a game engine. You may write engines, renderers, state
machines, entity storage and audio policies in your application's normal Blend65
source when the application needs them. This guide supplies no such components
or APIs. The expert's
[product boundary](../../../../.agents/skills/blend65-domain-expert/references/c64-game-engineering.md#product-boundary)
separates application policy from narrow target-platform support.

## Lifecycle, state and frame order

Start with the application's behavior, not a hardware routine to imitate.
Write down its reachable states and the input or event that permits each
transition. Define initial state, restart behavior and normal exit. Decide which
state changes are visible in the current display update and which wait for the
next one. Keep these decisions in source, not an assumed platform dispatcher.

A useful design description names the order of input observation, interpretation,
state update, collision resolution, display publication and audio decisions.
That is a description to implement with ordinary functions, not a required
universal loop. Choose the order from the intended game rules. Rendering must
not accidentally advance simulation, and a repeated display refresh must not
consume the same input edge twice unless the rules require it.

Distinguish a simulation tick from a display frame. Fix their relationship and
the behavior when work misses its deadline: catching up, waiting or dropping work
changes observable behavior and must be an explicit application decision.
Do not silently use a different cadence because the chosen profile is faster or
because a routine is not ready. The
[profile contract](../../../../spec/15-platform-profile.md) defines the selected
machine; see also the expert's
[frame architecture](../../../../.agents/skills/blend65-domain-expert/references/c64-game-engineering.md#frame-architecture).

Bound each unit of work. A long-lived main loop can be intentional, but each
update, search and drawing pass needs a finite bound compatible with its timing
contract. Choose counter widths that can represent termination; a byte counter
cannot count upward past 255 without wrapping. Decide whether numeric wrap,
saturation or rejection is intended. Widen intermediate arithmetic before it
overflows, not after assigning its result to a wider destination.

## Entities and collision

Represent the model with ordinary structs, arrays, enums and reusable functions.
Choose fixed capacities from application needs and available resources, not a
compiler convenience limit. Specify what happens when capacity is exhausted.
Use word-capable counts and indices when their range requires them; crossing a
byte boundary does not require splitting a collection or unrolling its access.
See the source rules for [arrays](../../../../spec/08-arrays-strings.md).

Make invariants explicit: which entries are active, which fields are initialized,
which identifiers remain valid after removal, and whether new entries participate
in the current update. Removal, insertion and iteration order can change behavior.
Choose a stable rule rather than relying on incidental storage order. Storage
policy is application code, not a promised fixed-pool library.

Define collision semantics before implementation:

| Question | Decision to retain |
| --- | --- |
| What overlaps? | Logical cells, geometric shapes or another source-defined rule |
| Do touching edges count? | Exact inclusion/exclusion rule and coordinate domain |
| When is collision evaluated? | Before movement, after movement or along a defined swept path |
| What if several objects collide? | Resolution order and effect on later observations |
| What happens at boundaries? | Stop, wrap, reject or another explicit game rule |

Hardware collision observations are not automatically the game's collision rule.
If used, establish when they are sampled and whether reading or acknowledging
them changes device state. Test empty/full capacity, first/last entries, inactive
entries, edge contact, simultaneous events and coordinate extremes against
independent expected answers. The expert's
[entities, collision and state](../../../../.agents/skills/blend65-domain-expert/references/c64-game-engineering.md#entities-collision-and-state)
provides the hardware-aware review context, not a supplied gameplay system.

## Rendering, scrolling and data placement

Choose sprites, characters or another supported display representation to serve
the application's visual rules. The application owns drawing order, camera or
scroll position, dirty-region decisions and buffering policy. Request the exact
documented public platform operations for the pinned compiler/profile; do not
invent an operation name from a plausible namespace or assume that every
specification facility is implemented.

Explain platform constraints as consumer requirements. For each display resource,
identify the device that reads it, when it reads it, and the required visible
memory region, bank, alignment and lifetime. CPU access does not by itself prove
that the display device sees the same bytes. Named hardware operations should
make these contracts clear without requiring users to scatter numeric register
addresses through game logic. Use the
[C64 platform contract](../../../../spec/appendix-c64.md) for normative detail.

Prefer placing data where its consumer reads it, compile-time transformation and
legal pointer or bank changes over copying bytes in a hot path. Placement must
satisfy every live consumer and reserved range. Do not weaken a visibility or
ownership requirement merely because an address fits. Do not duplicate identical
data to hide a compiler addressing failure.

Keep these cases distinct:

- Two buffers containing different evolving states can be an intentional
  application design. Define which buffer the producer may modify and which the
  display consumes, including when each may be reused.
- Replicated identical bytes have an extra storage cost. They need a concrete
  hardware-visibility or measured timing reason that placement, banking or pointer
  changes cannot satisfy. Record the consumer, constraint, added bytes and timing
  benefit; convenience is not a reason.

A buffer flip is not automatically safe publication. Finish the data first,
publish at the contracted observation point, and do not reuse it while a consumer
can still read it. A scrolling design must also account for the moments at which
the device observes control state and display data. Measure required paths with
device bus use and interrupts, not just an isolated drawing routine's CPU work.

## Input from saved observations

Choose a sampling point and save the result of each required device observation.
Interpret that saved sample consistently during the update instead of reading
hardware again for every predicate. A second read may see a later state or have
different device effects. Use actual documented named input operations and
preserve their access order and count.

Define ambiguous or simultaneous input explicitly: opposite directions, several
buttons, a press during a transition, or an observation whose device contract
cannot distinguish several causes. Do not manufacture information the sample
does not contain. If the intended rule is missing, ask rather than choosing a
priority silently.

The application owns edge detection, debounce and repeat. Edge detection compares
saved current and previous observations. Debounce suppresses unwanted rapid
changes under an explicit rule; repeat generates further actions while input
remains held. Define the cadence, delays, release behavior and reset on state
transitions. A snapshot operation does not imply that any of these policies is
provided. See the expert's
[input guidance](../../../../.agents/skills/blend65-domain-expert/references/c64-game-engineering.md#input).

## Shared state and interrupts

Prefer one clear owner for mutable state. When producers and consumers can
interrupt one another, define a supported publication protocol: what data is
complete, what event makes it visible, and when the producer may change it again.
A ready flag alone does not prove that the payload remains stable through the
consumer's entire read.

Static Frame Allocation separates overlapping function-execution storage; it does
not make shared game state atomic. A word access may tear, meaning that its bytes
come from different updates. Even an indivisible byte access does not make a
read-modify-write sequence indivisible; one writer's update can be lost. Treat
diagnostics as evidence to investigate, not automatic synchronization. Use only
supported, proved operations for the required protocol. Do not silently add
interrupt masking or assume that masking IRQ also blocks NMI.

Before installing an interrupt path, establish the exact profile's public
installation and restoration contract, entry/exit convention, source ownership,
acknowledgement duties, predecessor lifetime and banking state. Account for every
reachable IRQ, NMI, callback and retained firmware route, including overlap and
re-entry. Ordinary helpers may be shared where compiler proof permits; do not
replace legal helpers with manual inline code to conceal missing storage proof.

Do not infer a finite NMI arrival bound, firmware completion guarantee or whole
program stack bound from a small handler or bounded per-entry cost. No generated
handler does not mean no external route. Separate proved component bounds from
unproved external behavior. The governing details are in
[functions and execution domains](../../../../spec/06-functions.md) and the
selected profile. Missing required ownership or timing proof blocks that use.

## Audio and externally authored assets

The application chooses cues, sound priorities and when music advances. It may
implement the required scheduling or mixing policy in ordinary source; the
toolchain does not supply a player scheduler, mixer or tracker adapter here.
For direct hardware work, obtain exact documented named operations and their
ownership rules. Two writers to the same sound channel need an application
agreement, not merely individually valid calls.

Before calling imported player code, establish its exact byte identity and
supported contract: initialization and play entries, arguments/results, register
and flag clobbers, zero-page and other mutable storage, hardware-stack use,
banking, IRQ/NMI interaction, reentrancy, cadence and resource costs. Keep code,
player state and retained addresses alive for every possible consumer. Match the
selected SID model and video timing; do not assume that another model or frame
rate can use the same playback calls unchanged.

Raw SID bytes being embeddable does not make them callable or prove an imported
player's application binary interface (ABI). Do not promise native format
selectors or adapters just because the specification describes them. Use only
the pinned toolchain's actual qualified public facility; ask for its signature
and contract or report the missing support. See
[music and sound effects](../../../../.agents/skills/blend65-domain-expert/references/c64-game-engineering.md#music-and-sound-effects).

Pin externally authored assets, their provenance, licences and notices. Inspect
and validate their formats and metadata before use. Compile-time ingestion,
conversion, typing and placement are toolchain responsibilities when supported;
rendering, gameplay and cue policy remain application responsibilities. Review
[data inclusion](../../../../spec/13-data-inclusion.md) and the expert's
[native asset boundary](../../../../.agents/skills/blend65-domain-expert/references/c64-game-engineering.md#native-asset-handlers)
without inferring current availability or qualification from prose.
