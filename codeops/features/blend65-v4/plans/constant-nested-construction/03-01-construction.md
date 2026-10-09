# Bounded construction contract

> **Parent**: [Index](00-index.md)
> **Decision**: AR-1

## Eligibility and fallback

Freshness belongs to the declaration's new local lifetime, not to constantness alone.
Use existing place-destination metadata to carry that proof from local initialization.
Do not mark assignment, a borrowed parameter, a global or caller pointer as fresh.
The backend must also find a certified, non-parameter local home and a complete fixed
in-bounds member interval. Missing proof keeps existing lowering unchanged.

Require the whole literal tree to be recursively effect-free constants before child
forwarding. A constant-looking result cannot hide a call, volatile read, assignment,
unknown child or address/borrow. Preserve the existing typed constants/conversions;
do not invent an evaluator. Scalar constant fills may use the current fill builder.
Aggregate-valued fill reuse whose separate destination is unproved retains fallback.

## Existing representation, complete consumers

Construct child destinations using the existing field/index paths, retained root type
and constant indices. Preserve those index uses in semantic liveness and machine
accounting. Resolve only fixed paths to offset storage homes. No runtime pointer or
function scratch is needed for an eligible child.

Both existing aggregate builders must recognize an already-completed child only
when the full direct source home/offset/extent exactly equals the selected final
member interval. Such a child needs neither staging nor a copy. Different homes,
partial intervals, indirect/borrowed places and unknown identity keep all old guards.

Equal immediate A loads may be reused only across proved unchanged A/N/Z state
and side-effect-free construction steps. Never remove a volatile operation, change
its order/count, cross an unknown clobber or consume a flag proof not actually held.
This is local construction selection, not a new peephole pass or shared optimizer.

## Safety, ownership and evidence

Source effects and old aggregate snapshot semantics remain R3. Existing SFA and
target-domain interference remain authoritative; reduced homes do not prove shared
atomicity, new NMI admission, external stack peaks or physical timing. No post-closure
allocation is allowed. Preserve debug source spans and identities.

Planned public test interfaces are unchanged: `checkProject`, `buildProject` and
current artifact/resource records. Reuse the existing root test/VICE fixtures.
New internal helpers, if needed, are pure functions with documented narrow contracts.

Lineage: expert 2.0.4/content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`, frozen
Specification 4.0 §§7.2/7.4, array literals/assignment, evaluation order and SFA.
Normative references: SFA final storage closure, aggregate/copy lowering, NMOS
load/store flags and evidence boundaries. No qualification answers are inputs.
