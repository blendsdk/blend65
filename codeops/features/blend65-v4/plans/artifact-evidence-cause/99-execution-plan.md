# Artifact evidence preparation — reporting the cause

> **Owner**: T-46 · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Complete
> **Progress**: 3/3 tasks (100%)
> **Last Updated**: 2026-11-21

## Why

Evidence preparation was wrapped in a `catch` that took no binding. The thrown value was therefore
unreachable, and every failure — whatever its cause — was reported as one fixed sentence:

```
error[ARTIFACT_EVIDENCE]: Artifact evidence preparation failed
```

No cause, no location, no construct, and nothing written to any log. The build died and left
nothing to act on.

What makes that worth fixing rather than tidying is the kind of error that reaches there. Not only
I/O: debug-range construction throws when a machine block's label family is not among the prefixes
it recognizes, and any code-generation change that splits a block into a new family can trigger it.
That is a routine kind of change, which is why the recognized list has fourteen entries. The real
cause is then a one-line registration and the output points nowhere near it. It happened while the
two-byte unit step was being added, and it cost real time.

## What was decided, and what was deliberately left alone

| Decision | Reason |
| --- | --- |
| Preserve both canonical messages exactly | Callers and operators already match on them; the cause belongs in the help line, which is where this codebase already puts the part of a compiler-stage refusal meant for whoever receives a bug report |
| Carry the cause on **both** exits from the catch | A retained staging directory still owns the message, because needing recovery is the more urgent fact — but the cause that produced it must not be destroyed on the way, which is exactly what used to happen |
| Put the helper in its own module | The file it is called from is already well past the size guidance, and a diagnostic builder beside the existing one is the established shape here |
| Leave the neighbouring catch in owned-directory identification untouched | A missing path yielding null is correct there. It is not a swallowed error, and widening the change would have made that claim harder to check |
| Not distinguish an expected I/O failure from an internal invariant | Worth having and not needed here: the expected-failure path is already separate and already carries its own message. Guessing the difference from a thrown value would be invention |

## Treating the thrown value as genuinely unknown

A `catch` binding is not an `Error`, so nothing is assumed about it:

| Shape | Behaviour |
| --- | --- |
| An `Error` | Its message is used; the stack is left out, because it belongs in a bug report rather than in console output |
| A string, a number, any stringifiable value | Converted behind a guard — a value with a null prototype throws on conversion, and a crash inside the error path would replace a reported failure with no failure at all |
| A multi-line message | Collapsed to one line, because a help line is not a paragraph |
| `null` or `undefined` | Treated as carrying no detail, deliberately, even though it would render cleanly. The word `null` names a host-language value and tells its reader less than admitting there was nothing to report |

## Tasks

- [x] **T-46.1 Confirm the scope.** Establish which catch is at fault, which errors can reach it,
      and that the neighbouring catch is correct as written.
- [x] **T-46.2 Convert the throw.** Bind it and build the diagnostic in a named helper, preserving
      both canonical messages and carrying the cause on both exits.
- [x] **T-46.3 Verify.** Unit-cover the helper, and force the real throw inside a real build.

## Verification

| Check | Result |
| --- | --- |
| New controls on the helper: both exits, three renderable shapes, four empty ones | **10/10** |
| Forcing the known internal invariant to throw inside a real build | Cause now reported in the help line, where it previously reported nothing |
| Compiler service tier | **1,006/1,006** |
| CLI tier | **70/70** |

The end-to-end check is what makes this more than a unit test. The invariant that motivated the
fix cannot be reached from any source program, so it was triggered in a built compiler and the
resulting console output read directly:

```
error[ARTIFACT_EVIDENCE]: Artifact evidence preparation failed
  help: Compiler limitation in artifact evidence preparation: Final machine block has no semantic
        CFG owner; please report it with the project shown
```

## Stop conditions observed

No frozen oracle was edited and no specification file was touched. The forced throw was injected
only into generated output that is not tracked, and removed by rebuilding, with the removal
confirmed before committing. A pre-existing formatting lapse in an unrelated file in the same
directory was left alone rather than folded into this change.
