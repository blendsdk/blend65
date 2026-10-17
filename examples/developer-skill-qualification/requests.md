# Independent Authoring Requests

These are answer-free requests, not reference implementations or grading data.
Deliver only the assigned section to each fresh application author. The companion
skill writer must not read this file. No authored application or qualified skill
is supplied by the presence of these requests.

### Score request

Write `module AwardMath` exporting `addAward(total: word, award: byte): word`,
and `module Score` importing it and exporting:

```blend65
export function addAwards(initial: word, awards: const byte[4]): word;
```

Return the initial score plus all four awards with normal 16-bit wrapping.
Traverse the array in ordinary source and use the imported helper; do not
modify the const array, hard-code answers or manually unroll it. The returned
score must retain carries beyond 255. Explicit widening is normal language,
not a compiler workaround. This request tests the approved source subset,
not a gameplay scoring rule imposed on other applications. AR-S4.

### Unseen patrol request

Write `module Patrol`, exporting `PatrolState` with fields `x: word` and
`right: boolean`, and:

```blend65
export function step(x: word, right: boolean, amount: byte): PatrolState;
```

For the request domain `0 <= x <= 319`, move `amount` toward the selected
direction. Clamp at 0 or 319 and reverse direction when a positive move reaches
or crosses that endpoint. A zero move returns the unchanged position and
direction, including at an endpoint. Return the struct normally; no out
parameter, assembly or global scratch workaround. Other input values are
outside this exercise's stated application domain, not illegal Blend65.
This scenario and its answers must not appear as worked teaching examples.
AR-S4–AR-S5.
