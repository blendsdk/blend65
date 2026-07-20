# 03-01 — The directive, the marking rule, and emission

Owns the compiler-side change. Balloon and the corpus are [03-02](03-02-balloon-and-corpus.md).

## 1. The `align` directive

New variant on `AcmeDirective` (`packages/core/src/instr-model/stream.ts:37-44`):

```ts
| { readonly kind: "align"; readonly boundary: number; readonly fill: number } // !align 255, 0, 0
```

`boundary` is the alignment in bytes; `fill` is the pad byte. M2 fixes `boundary = 256` as the only
value this RD produces, and `fill = 0`. The field is `boundary` rather than a pre-computed mask so
the model stays readable — the mask is a rendering detail.

**Serialization** (`directiveText`, `print-instr.ts:165-166`): `!align ${boundary - 1}, 0, ${fill}`.

> The `- 1` is the whole trap. ACME's directive is `!align andValue, equalValue [, fill]` — a
> **bitmask**, not a modulus. `!align 256, 0` assembles cleanly and aligns nothing; `!align 255, 0`
> is page alignment. The mask form is emitted in exactly one place so it cannot be got wrong twice,
> and no test asserts on the directive text alone (see ST-C11/ST-C13).

Additive to `@blend65/core`'s instruction model. Not a `spec/` change — D3 unaffected.

## 2. The three exhaustive switches

Adding a union member breaks three `const _exhaustive: never` arms in
`packages/codegen/src/instr/print-instr.ts`. Each is a decision, not a formality:

| Function | Line | Returns | Why |
|---|---|---|---|
| `directiveText` | `:165-166` | `!align 255, 0, 0` | above |
| `directiveByteSize` | `:295-315` | **`0`** | The size is address-dependent and unknowable before assembly. Consequence: `programByteSize` becomes a documented **lower bound** — acceptable, since it has no production caller and the live budget guard reads the post-ACME `binarySize` |
| `isColumnZeroDirective` | `:178-180` | **`true`** | `!align` is conventionally column-0 like `* =`. Without this it renders at instruction indent, and every future golden carries the oddity |

`@blend65/platforms` needs no change (verified: plugins construct `outputFile` directives, never
switch over the union).

## 3. The marking rule

**Aligned iff a source-level `&` is applied to a const aggregate.** Implemented at the `&` site:

```ts
// lowerAddressOf, packages/codegen/src/il/lower.ts:1807
// — reached only from real `&` expressions; lower.ts:1042 guards the call
//   with isAddressOfExpr, so a by-reference argument can never arrive here.
if (sym.kind === "constant") {
  ctx.addressTakenConsts.add(constDataSymbol(sym));
}
```

The set lives on the lowering context and is read when `constData` is built (`lower.ts:237-249`),
which runs **after** every function is lowered — so it is already complete. `ConstDataEntry`
(`packages/codegen/src/il/cfg.ts`) gains:

```ts
readonly aligned: boolean;
```

### What the rule deliberately excludes

| Case | Why it must not align | Committed evidence |
|---|---|---|
| By-reference array/struct **argument** | Emits the identical `addrOf` operand, but the program never asked for placement — the compiler's own indexed access reads it | `slice7b.asm.golden:89,91`, `slice8b.asm.golden:100,111` |
| `&` on a **function** / interrupt handler | No data image to align | `examples/slice8/main.blend:27-28` |
| `&` on a **mutable** module variable | Lives in the SFA RAM region, never emitted into the image, cannot carry a directive | `lower.ts:1813-1816` |

An implementation that scanned IL `addrOf` operands instead would align `slice7b` (+159) and
`slice8b` (+276) and attempt to align `slice8`'s function labels. **Phase 2's acceptance is
precisely that none of that happens** — see the phase note in
[99-execution-plan.md](99-execution-plan.md).

## 4. Emission

`constDataStream` (`packages/codegen/src/instr/instr-program.ts:191-198`) prepends the directive to
its own entries, ahead of the label:

```ts
function constDataStream(entry: ConstDataEntry): InstrStream {
  const entries: StreamEntry[] = [];
  if (entry.aligned) {
    entries.push(directive({ kind: "align", boundary: 256, fill: 0 }));
  }
  entries.push(label(entry.symbol));
  // … unchanged !byte rows …
}
```

**`serialize-acme.ts` is not touched** (AR #71). It already renders stream entries through
`printInstr`, and keeping the directive inside the stream means it cannot drift away from the data
it aligns.

### Multiple aligned arrays

Padding is **per aligned stream** and accumulates — worst case ~255 bytes each. Emission order is
`program.streams` order, unchanged; this RD introduces **no reordering pass**, so an implementation
must not assume aligned streams are grouped or that padding is bounded across a program. A
zero-length const array whose address is taken aligns like any other and may pay up to 255 bytes
for a zero-byte payload; no diagnostic rejects this and none is added here.

## 5. What is deliberately absent

- **No `--optimize` gate.** Placement is structural, and the sprite pointer depends on it; a
  program that renders only with optimization on would be a defect.
- **No residency check.** Aligned data landing in the char-ROM shadow (`$1000–$1FFF`) or outside
  the VIC bank is undiagnosed here — [#68](https://github.com/blendsdk/blend65/issues/68). AC-1
  pins `balloon` below `$1000`; the general case is out of scope.
- **No padding report.** [#67](https://github.com/blendsdk/blend65/issues/67).
