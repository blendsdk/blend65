# Cross-join NMI sample consumption — blocked plan

> **Owner**: issue [#152](https://github.com/blendsdk/blend65/issues/152).
> **Scope mode**: strict. No new runtime, source restriction or `spec/` change.

## Problem

The retained-sample cross-join handler is behaviorally correct but larger than the expert form:

```blend65
let sample: byte = readAndClearPendingSources();
if (flag) {
    out = sample;
} else {
    out = 0;
}
poke($0410, sample);
```

The current handler is 36 bytes / peak 6. The then arm re-reads SP and loads the slot; the join
performs the top-slot `PLA`. The expert pops once per arm, carries the sample in A, and stores it at
the join: 27 bytes / peak 5.

## Blocker

The retention plan marks only the **last load in the single return block** with `PLA`
(`nmi-register-locals.ts`'s last-use consume). A cross-join consume needs a per-predecessor fact
the plan does not represent:

- the then-arm load is the last use on that path and may pop;
- the else arm has no source load, so it needs a synthetic pop at the arm's end;
- the join's load must not reload because every predecessor leaves the same sample in A;
- the wrapper may then drop its X save because no `TSX`/slot load remains.

The semantic plan has no per-path consume/merge fact, and the machine lowering has no
`stack`-value forwarding for the join load. Adding one without the complete per-predecessor stack
and A proof would risk a double pop or a stale A.

## Disposition

No code, oracle or limit was changed. The existing `CROSS_JOIN` oracle
(`test/rd08/nmi-residual-forms.spec.test.ts:445-460,678-695`) keeps pinning 36 bytes, peak 6 and
the current `TSX`/slot-load/join-`PLA` sequence. The issue stays open.

## What closes it

1. A per-predecessor retention plan: every arm's last use (or an explicit end-of-arm consume), the
   live top slot on each arm, and the merged A value at the join.
2. A machine forwarding fact for the join load when every predecessor leaves the same sample in A.
3. A wrapper re-analysis that removes the X save once no `TSX` or slot load remains.
4. The same four-profile byte/cycle, peak, and genuine-NMI runtime evidence, with the single ICR
   read and output order pinned.
