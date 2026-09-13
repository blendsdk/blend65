# F025 — Deterministic compile-time functions

> **Status**: ✅ Accepted
> **Stability**: Stable
> **Guard**: Pass (all rules)

## Description

`comptime function` provides typed, bounded constant generation using ordinary Blend65 expressions,
control flow, local fixed storage, direct calls, and aggregate returns. Evaluation happens entirely
inside the compiler. It emits only constant results, never a target function or runtime service.

## Syntax

```ebnf
comptime_decl = [ "export" ] , "comptime" , "function" , identifier
              , "(" , [ parameter_list ] , ")"
              , ":" , return_type , block ;
```

```blend65
comptime function clamp(value: byte, maximum: byte): byte {
    if (value > maximum) {
        return maximum;
    }
    return value;
}

const STARTING_LIVES: byte = clamp(5, 3);
```

## Semantics

- Declarations are module-level and may be exported. They use the ordinary function namespace,
  parameter rules, explicit return type, lexical scopes, typing, fixed-width arithmetic, bounds,
  division, and caller-owned aggregate-return semantics.
- Parameters, externally read values, and call results are compile-time constants. Local `let`
  values may change during evaluation.
- Calls may directly name another compile-time function or a compile-time intrinsic. Indirect calls
  and calls to ordinary runtime or interrupt functions are rejected with E10191.
- Existing constants and already validated embedded data may be read. `embed()` itself remains a
  module-level constant initializer and cannot be invoked from a compile-time function.
- Runtime state, MMIO, memory-access intrinsics, `asm_*`, files, time, randomness, environment,
  network, and other host state are unavailable. E10191 identifies the prohibited dependency or
  operation.
- Taking the address of a compile-time function is E10043. It has no target entry point or function
  value.
- Direct and indirect recursion remain E10180 and E10181.
- Success substitutes one typed constant result. There is no target code, SFA frame, hardware-stack
  use, zero-page scratch, runtime helper, registry, or evaluator library in the output.

```blend65
let liveScore: byte = 0;

comptime function invalid(callback: fn(): byte): byte {
    let snapshot: byte = liveScore; // E10191: runtime-state read
    return callback();              // E10191: indirect call
}
```

## Constant-data pattern

```blend65
comptime function makeWave(): sbyte[256] {
    let values: sbyte[256] = [; 0];
    for (let phase: word = 0; phase < 256; phase += 1) {
        values[phase] = sin8(byte(phase));
    }
    return values;
}

const WAVE: sbyte[256] = makeWave();
```

The returned array is an ordinary constant and may subsequently participate in placement,
alignment, deduplication, memory maps, and debug provenance.

## Exact integer trigonometry

| Intrinsic | Signature | Range |
|---|---|---:|
| `sin8` | `fn(byte): sbyte` | `-127..127` |
| `cos8` | `fn(byte): sbyte` | `-127..127` |
| `sin16` | `fn(word): sword` | `-32767..32767` |
| `cos16` | `fn(word): sword` | `-32767..32767` |

The signatures define direct-call checking. These reserved intrinsics are not function values and
cannot be addressed or called indirectly.

For `k` in `{8, 16}`, let `N = 2^k`, `A = 2^(k-1)-1`, and let unsigned phase `p` denote `p/N`
turns:

```text
sin_k(p) = roundNearestAwayFromZero(A × sin(2πp/N))
cos_k(p) = sin_k((p + N/4) mod N)
```

Nearest values are selected and exact halves round away from zero. The rule fixes all observable
results without prescribing a compiler algorithm.

| Input | Result | Input | Result |
|---|---:|---|---:|
| `sin8(0)` | 0 | `cos8(0)` | 127 |
| `sin8(32)` | 90 | `sin8(64)` | 127 |
| `sin8(128)` | 0 | `sin8(192)` | -127 |
| `sin16(8192)` | 23170 | `sin16(16384)` | 32767 |
| `sin16(32768)` | 0 | `sin16(49152)` | -32767 |

The canonical `sin8` stream encodes phases `0..255` as one two's-complement byte per result and has
SHA-256 `fec3247a063767c499a18d6efdb1e5f86f96f859e2e98a859d621e93af013259`. The canonical
`sin16` stream encodes phases `0..65535` as little-endian two's-complement words and has SHA-256
`e0313f89310605acaa740fa67cf9fb157e363c9bd4af10fea66d8846735c5a50`. Cosine is derived by
the wrapped quarter-turn relation.

## `comptime-budget-v1`

One fixed counter set is shared by all compile-time roots in a `check` or `build`. Dependencies run
first; ready roots use case-sensitive ASCII order of the owning fully qualified declaration name;
multiple roots in one owner use left-to-right source order.

| Resource | Allowed | First rejected attempt | Diagnostic |
|---|---:|---|---|
| Abstract steps | 16,777,216 | Step 16,777,217 | E10269 |
| Peak live logical value storage | 16,777,216 bytes | Any allocation above the limit | E10270 |
| Active compile-time calls | 512 | Depth 513 | E10271 |

One step is charged before each selected expression node, statement node, loop iteration, function
or intrinsic entry, and aggregate byte initialized, copied, or materialized. Short-circuited and
unselected nodes charge nothing. Caching must reproduce uncached abstract charges and logical
live-memory transitions.

Logical memory uses language widths and normative `sizeof`. Live parameters, locals, temporaries,
in-progress aggregates, returns, and retained generated constants count. Aliases and uncopied reads
of existing immutable constants or validated assets add no bytes; semantic copies do. Storage is
released at its full-expression, block, call, or evaluation-phase lifetime boundary. A semantic
copy charges separate logical bytes and aggregate-byte steps even when host sharing, direct
construction, or copy elision avoids physical work.

Exactly the limit is legal. The exceeding operation fails before its node, effect, mutation,
argument evaluation, allocation, or body entry. The root and its dependents are poisoned, partial
evaluator values are discarded, and no target artifact is emitted. Host allocation failure is a
separate bounded compiler failure, never E10270.

The budget has no source, manifest, environment, or CLI setting. A lower limit or changed unit is a
breaking language change; a higher limit requires a new named budget/specification version.

## Boundary examples

| Case | Result |
|---|---|
| Exactly 16,777,216 steps | Allowed |
| Selected node would charge step 16,777,217 | E10269 before the node or effect |
| Exactly 16,777,216 logical bytes live | Allowed |
| Allocation would make 16,777,217 bytes live | E10270 before allocation or mutation |
| A block ends before a later allocation | Released bytes reduce the live total |
| A second name aliases existing storage | No extra memory charge |
| An aggregate is copied | Copy bytes and aggregate-byte steps are charged |
| Right side of `false && expression` | No charge for `expression` |
| Cached evaluation | Same charges and result as uncached evaluation |
| Root plus nested calls reaches depth 512 | Allowed |
| A call would enter depth 513 | E10271 before arguments or entry |

## Diagnostics

| Code | Condition | Fix |
|---|---|---|
| E10043 | Address is requested for a compile-time function | Call it in a compile-time expression; it has no target address |
| E10180 / E10181 | Direct or indirect recursion | Use a bounded loop or explicit fixed work structure |
| E10191 | Evaluation depends on runtime/host state or a forbidden operation/call | Pass constants and use permitted direct compile-time operations |
| E10269 | Step 16,777,217 would be charged | Reduce selected evaluation work |
| E10270 | Live logical storage would exceed 16,777,216 bytes | Release or reduce simultaneous logical values |
| E10271 | A call would enter depth 513 | Replace deep calls with a bounded loop |

Each budget diagnostic names `comptime-budget-v1`, the exact limit and attempted use, and the root.
Its primary span identifies the rejected node, allocation, or call; a related span identifies the
root invocation.

## Alternatives considered

| Alternative | Why not selected |
|---|---|
| External generators only | Splits source, typing, dependencies, and reproducibility across tools |
| A separate table-comprehension language | Duplicates expressions, control flow, typing, and diagnostics |
| An unrestricted host evaluator | Permits nondeterminism, hidden host dependencies, hangs, and host-dependent acceptance |

## Feature interactions

| Area | Contract |
|---|---|
| Types and aggregates | Ordinary typing, fixed arrays/structs, and caller-owned aggregate returns apply |
| Variables and scope | Parameters and locals use normal lexical rules; external reads must be constants |
| Control flow | Conditions and loops are ordinary, but consume the fixed step budget |
| Functions | Only direct compile-time calls; no indirect calls, runtime calls, addresses, or recursion |
| Intrinsics | Pure constant/query and trigonometry operations are allowed; memory and CPU-control operations are forbidden |
| Embedded data | An already validated immutable result may be read without recharging its bytes unless copied |
| Target output | Only retained constant data is emitted; evaluation itself costs zero target cycles and bytes |

## Language Guard verdict

| Rule | Result | Reason |
|---|---|---|
| P1 Cross-platform compilable | ✅ | Evaluation is host-side and its typed constant result is target-independent |
| P2 Profile-meaningful | ✅ | Lookup tables, masks, maps, and generated constants are useful in every qualified profile |
| P3 No platform assumptions | ✅ | Core semantics name no target hardware or address |
| P4 Resource-scalable | ✅ | Evaluation adds no target runtime cost; retained data uses ordinary target budgets |
| H1 6502 implementable | ✅ | No evaluator code runs on the target |
| H2 Cost transparency | ✅ | Target evaluation cost is exactly zero; retained constant bytes remain visible |
| H3 SFA compatible | ✅ | No target frame exists; evaluator memory has its own fixed semantic budget |
| H4 Memory footprint documented | ✅ | Evaluator and retained-target storage boundaries are explicit |
| H5 Fully deterministic | ✅ | Inputs, math, order, budgets, and all failure boundaries are fixed |
| L1 Unambiguous syntax | ✅ | `comptime function` is a distinct module declaration |
| L2 Consistent with existing | ✅ | It reuses ordinary function syntax, types, blocks, and returns |
| L3 Beginner-friendly | ✅ | The modifier states when the function runs |
| L4 Minimal feature | ✅ | One modifier and four exact math intrinsics; no second language or configuration surface |
| L5 No redundancy | ✅ | It fills typed programmatic constant generation not provided by literal initializers |
| L6 Error messages defined | ✅ | Existing misuse diagnostics plus E10269–E10271 cover every rejected class |
| L7 Compile-time failure preferred | ✅ | Every misuse or exhaustion fails during compilation |
| L8 Feature interaction documented | ✅ | Types, state, calls, control flow, assets, intrinsics, and output are covered above |
| L9 Documentable with examples | ✅ | Scalar, table-generation, forbidden-use, and exact boundary cases are finite and clear |
| C1 Lexer/parser implementable | ✅ | One keyword and one declaration alternative use ordinary recursive descent |
| C2 Semantic analysis defined | ✅ | Allowed state, calls, effects, results, ordering, and budgets are closed |
| C3 Code generation strategy | ✅ | Substitute the constant result; emit no evaluator code |
| C4 Unit testable | ✅ | Lexer, declaration, evaluator, oracle, budget, and rejection cases are enumerable |
| C5 Runtime verifiable | ✅ | Programs can expose generated constants for deterministic emulator comparison |
| F1 Extensible | ✅ | New pure intrinsics can be added without changing existing declarations |
| F2 Platform-profile ready | ✅ | Platform-specific validated constants remain owned by their profiles/adapters |
| F3 Optimizer-friendly | ✅ | Constant results enter normal deduplication, placement, and optimization |
| F4 Stability classification | ✅ | The feature and `comptime-budget-v1` are stable |

No escape hatch is used.

## Verdict

**✅ Accepted.** The feature provides normal typed constant generation with a fixed deterministic
boundary. It adds no target runtime system and no configurable evaluator policy.
