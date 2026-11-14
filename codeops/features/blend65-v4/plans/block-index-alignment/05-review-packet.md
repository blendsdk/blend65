# #74 independent review packet

> **Baseline**: `7236f7a2` (pre-v4 triage), working tree with the #74 change
> **Scope**: infer 64/256-byte block-index alignment for module storage, with no new runtime,
> no new diagnostic code and no rejection of runtime-index arithmetic.
> **Status**: targeted oracles green; complete checkpoint pending

## Authorized reads

You are authorized to read these exact paths for this review, including the frozen expert
authority named below:

- `packages/compiler/src/semantic/block-index-alignment.ts`
- `packages/compiler/src/semantic/lower.ts`
- `packages/compiler/src/semantic/block-index-alignment.impl.test.ts`
- `test/rd04/block-index-alignment.spec.test.ts`
- `codeops/features/blend65-v4/plans/block-index-alignment/99-execution-plan.md`
- `codeops/features/blend65-v4/plans/block-index-alignment/00-preflight-report-99-execution-plan.md`
- `.agents/skills/blend65-domain-expert/SKILL.md`
- `.agents/skills/blend65-domain-expert/qualification/release.md`
- The CPU/platform, memory/placement and lowering references those files route to.
- Frozen specification files named in the plan.

Shell execution is not required. Treat the diff and evidence below as the change under review.

## Expert lineage

| Field | Value |
| --- | --- |
| Active qualified version | `2.0.4` |
| Status | Active qualified and frozen |
| Router | `2.0.4`; SHA-256 `0760ec9d73fc7ed0e8575eb22d3fa9e5bdd2388d27b3989233239342c0b35ad8` |
| Specification | `BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b` |
| Immutable content commit | `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15` |

## Scope confirmations

| Check | Evidence |
| --- | --- |
| `spec/` unchanged | `git status --porcelain spec/` produced no output. |
| No new diagnostic code | The pass emits no diagnostic; no registry row changed. |
| No new source restriction | Explicit placement, zero-page storage, runtime indices and unalignable field offsets are preserved unchanged. |
| No oracle weakened | No pre-existing test deleted, skipped or edited. The new spec file was authored before the implementation. |
| Public API | No package export, CLI, profile or ABI shape changed. |
| Production surface | One new semantic module plus its call site. |

## RED evidence

Before the implementation, with a fresh `dist`:

| Oracle | Result | Meaning |
| --- | --- | --- |
| `test/rd04/block-index-alignment.spec.test.ts` (initial 28 cases) | **20 failed / 8 passed (28)** | All 16 alignment positives and all 4 misaligned rejections failed. The 4 plain `lo` controls and 4 explicitly aligned controls passed. The regression cases added after review round 1 are recorded separately below. |

The first failing reason was the observed public memory interval: `alignmentBytes: 1` instead of
`64`/`256`; the misaligned build succeeded instead of failing E10273.

## GREEN evidence

| Command | Result |
| --- | --- |
| `yarn vitest run test/rd04/block-index-alignment.spec.test.ts` | 64 passed (64), 12.6 s |
| `yarn workspace @blend65/compiler vitest run src/semantic/block-index-alignment.impl.test.ts` | 20 passed (20) |
| `yarn workspace @blend65/compiler vitest run src/semantic src/machine src/layout` | 103 files, 1,343 passed |
| Complete compiler package suite | 228 files, 3,848 passed / 2 skipped, 4m12 |

## Before / after public output

Witness: `let buffer: byte[64]; c64.vic.setSpritePointer(0, lo(&buffer / 64));`

| Fact | Baseline | After |
| --- | --- | --- |
| Buffer start | `$0afd` | `$0ac0` |
| Public `alignmentBytes` | `1` | `64` |
| Block pointer | 43 | 43 |
| Selected block slot | `$0ac0` | `$0ac0` |
| Buffer bytes inside the 64-byte slot | 3 of 64 | 64 of 64 |

The block index itself was always arithmetically correct; the defect was that the buffer did not
start at the block the index selected. `setSpritePointer` installs the value in the active screen's
pointer table, so the witness names a real platform consumer rather than a VIC register. The test
is build/placement-only: it proves the address and the consumer wiring, not bank visibility or
rendered sprite pixels. The fix is a **partial alignment inference** for the inferred cases; an
explicit misalignment, an unalignable automatic field, a runtime index, or an object outside the
selected VIC bank remains the user's platform contract.

## Implementation summary

- Match `address / 64`, `address >> 6`, standalone `hi(address) * 4` in either operand order, and
  the complete `hi(address) * 4 + (lo(address) >> 6)` selector (64, not 256).
- Resolve the address only through bit-preserving conversions; a narrowing conversion is ordinary
  arithmetic and is not treated as the full address.
- Resolve constant divisors and indices through conversions with truncation semantics.
- Compute a static offset through fields and constant indices; a runtime index leaves the
  placement untouched.
- Strengthen `placement.align` to 64 or 256 only for automatic placement where the static offset
  is a multiple of the demand. Padding is 0-63 or 0-255 bytes; no instruction, stack, ZP or scratch
  byte is added.
- Preserve an explicit `at`, zero-page storage, a runtime index, and an unalignable field offset
  exactly as written. The pass never rejects and never emits a diagnostic.
- `lo(&buffer)` alone is not matched and adds no padding.
- A consumer-aware diagnostic for an unsatisfiable hardware use needs a new approved warning
  contract and is follow-up debt.

## Production diff

```diff
diff --git a/packages/compiler/src/semantic/lower.ts b/packages/compiler/src/semantic/lower.ts
index a9f348eb..f71c6ddb 100644
--- a/packages/compiler/src/semantic/lower.ts
+++ b/packages/compiler/src/semantic/lower.ts
@@ -8,6 +8,7 @@ import { initializerBytes } from "./lower-data.js";
 import { sinkTerminalChoice } from "./lower-control.js";
 import { checkLoadQuiescence } from "./load-quiescence.js";
 import { enforceLoadDestinationConstraints } from "./load-destination-constraints.js";
+import { alignBlockIndexStorage } from "./block-index-alignment.js";
 import type {
   AggregateDestination,
   SemanticFunction,
@@ -257,9 +258,13 @@ export function buildSemanticProgram(analysis: AnalysisResult): SemanticBuildRes
       inputs: analysis.inputs,
     });
   }
+  // A block-index expression proves the hardware alignment its storage needs.
+  // Apply that demand before layout; explicit, zero-page and runtime-index
+  // placements are preserved exactly as written.
+  const alignedGlobals = alignBlockIndexStorage(functions, constrained.globals);
   const program: SemanticProgram = Object.freeze({
     main: mainCandidates[0]!.id,
-    globals: constrained.globals,
+    globals: alignedGlobals,
     functions: Object.freeze(
       functions.map((fn) => sinkTerminalChoice(fn, functions, bindingsByKey)),
     ),
diff --git a/packages/compiler/src/semantic/block-index-alignment.ts b/packages/compiler/src/semantic/block-index-alignment.ts
new file mode 100644
index 00000000..56abdcf8
--- /dev/null
+++ b/packages/compiler/src/semantic/block-index-alignment.ts
@@ -0,0 +1,306 @@
+import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
+import { bindingIdentityKey } from "../frontend/semantic-types.js";
+import type { SemanticType } from "../frontend/semantic-types.js";
+import type {
+  SemanticBlock,
+  SemanticFunction,
+  SemanticGlobal,
+  SemanticOperation,
+  SemanticPlace,
+  ValueId,
+} from "./operations.js";
+
+/** One storage use that requires a stronger alignment than the declaration states. */
+interface AlignmentDemand {
+  /** Required first-byte alignment for the effective address. */
+  readonly align: number;
+  /** Static byte offset from the module object's first byte. */
+  readonly offset: number;
+}
+
+/** One value definition retained for static address and index resolution. */
+type Definitions = ReadonlyMap<string, SemanticOperation>;
+
+/**
+ * Resolve the integer value of one constant expression, or null when it is
+ * not compile-time known. Conversions preserve the mathematical value except
+ * for truncation, which masks to the converted scalar width.
+ */
+function constantValue(
+  operation: SemanticOperation | undefined,
+  definitions: Definitions,
+): number | null {
+  if (operation?.kind === "constant")
+    return typeof operation.value === "boolean"
+      ? operation.value
+        ? 1
+        : 0
+      : Number(operation.value);
+  if (operation?.kind !== "convert") return null;
+  const value = constantValue(definitions.get(operation.operand), definitions);
+  if (value === null) return null;
+  if (operation.conversion !== "truncate") return value;
+  const bits = semanticTypeSize(operation.type) * 8;
+  const mask = 2 ** bits - 1;
+  return value & mask;
+}
+
+/**
+ * Follow only bit-preserving conversions. A narrowing or value-changing
+ * conversion means the value is no longer the object's full address, so the
+ * block-index shape does not apply.
+ */
+function throughConversions(
+  value: ValueId,
+  definitions: Definitions,
+): SemanticOperation | undefined {
+  let current = definitions.get(value);
+  for (;;) {
+    if (
+      current?.kind !== "convert" ||
+      (current.conversion !== "identity" && current.conversion !== "reinterpret")
+    )
+      return current;
+    current = definitions.get(current.operand);
+  }
+}
+
+/** Follow widening conversions too; they preserve the numeric value of a selector half. */
+function throughWidening(value: ValueId, definitions: Definitions): SemanticOperation | undefined {
+  let current = definitions.get(value);
+  for (;;) {
+    if (current?.kind !== "convert") return current;
+    if (current.conversion === "truncate") return current;
+    current = definitions.get(current.operand);
+  }
+}
+
+/** Locate the address-of operation behind one value, following preserving conversions. */
+function addressOperation(
+  value: ValueId,
+  definitions: Definitions,
+): Extract<SemanticOperation, { readonly kind: "place-address" }> | undefined {
+  const operation = throughConversions(value, definitions);
+  return operation?.kind === "place-address" ? operation : undefined;
+}
+
+/** Locate the operand of a `hi` unary operation behind one preserving conversion. */
+function highByteOperand(value: ValueId, definitions: Definitions): ValueId | null {
+  const operation = throughConversions(value, definitions);
+  return operation?.kind === "unary" && operation.operator === "hi" ? operation.operand : null;
+}
+
+/** Locate the operand of a `lo` unary operation behind one preserving conversion. */
+function lowByteOperand(value: ValueId, definitions: Definitions): ValueId | null {
+  const operation = throughConversions(value, definitions);
+  return operation?.kind === "unary" && operation.operator === "lo" ? operation.operand : null;
+}
+
+/**
+ * Compute the static byte offset of one place, or null when a runtime index
+ * decides it. Only field offsets and constant element indices are provable;
+ * a runtime index is left outside the inference domain.
+ */
+function staticPlaceOffset(place: SemanticPlace, definitions: Definitions): number | null {
+  let type: SemanticType | undefined = place.rootType;
+  let offset = 0;
+  for (const step of place.path) {
+    if (step.kind === "field") {
+      if (type?.kind !== "struct") return null;
+      const field = type.fields.find(({ name }) => name === step.name);
+      if (field === undefined) return null;
+      offset += field.offset;
+      type = field.type;
+      continue;
+    }
+    if (type?.kind !== "array") return null;
+    const index = constantValue(definitions.get(step.value), definitions);
+    if (index === null || index < 0 || index >= type.length) return null;
+    offset += semanticTypeSize(type.element) * index;
+    type = type.element;
+  }
+  return offset;
+}
+
+/**
+ * Whether one value reaches a larger arithmetic expression, including through
+ * value-preserving conversions such as `word(hi(...) * 4)`.
+ */
+function usedByBinary(
+  value: ValueId,
+  blocks: readonly SemanticBlock[],
+  definitions: Definitions,
+): boolean {
+  for (const block of blocks) {
+    for (const operation of block.operations) {
+      if (operation.kind === "binary" && (operation.left === value || operation.right === value))
+        return true;
+      if (
+        operation.kind === "convert" &&
+        operation.operand === value &&
+        operation.conversion !== "truncate" &&
+        usedByBinary(operation.result, blocks, definitions)
+      )
+        return true;
+    }
+  }
+  return false;
+}
+
+/** One half of a complete `hi * 4 + lo >> 6` block selector. */
+type SelectorSide = { readonly high: boolean; readonly address: ValueId };
+
+/** Classify one operand of `+` as the high or low half of a complete selector. */
+function selectorSide(value: ValueId, definitions: Definitions): SelectorSide | null {
+  const operation = throughWidening(value, definitions);
+  if (operation?.kind !== "binary") return null;
+  const right = constantValue(definitions.get(operation.right), definitions);
+  if (operation.operator === "*") {
+    if (right === 4) {
+      const high = highByteOperand(operation.left, definitions);
+      if (high !== null) return { high: true, address: high };
+    }
+    if (constantValue(definitions.get(operation.left), definitions) === 4) {
+      const high = highByteOperand(operation.right, definitions);
+      if (high !== null) return { high: true, address: high };
+    }
+    return null;
+  }
+  if (operation.operator === ">>" && right === 6) {
+    const low = lowByteOperand(operation.left, definitions);
+    return low === null ? null : { high: false, address: low };
+  }
+  return null;
+}
+
+/**
+ * Recognize the complete 14-bit selector `hi(address) * 4 + (lo(address) >> 6)`.
+ * It is a correct block number at any 64-byte-aligned address; it does not need
+ * the 256-byte alignment a standalone `hi * 4` requires.
+ */
+function completeSelector(operation: SemanticOperation, definitions: Definitions): ValueId | null {
+  if (operation.kind !== "binary" || operation.operator !== "+") return null;
+  const left = selectorSide(operation.left, definitions);
+  const right = selectorSide(operation.right, definitions);
+  if (left === null || right === null || left.high === right.high) return null;
+  const leftAddress = addressOperation(left.address, definitions);
+  const rightAddress = addressOperation(right.address, definitions);
+  if (leftAddress === undefined || rightAddress === undefined) return null;
+  if (bindingIdentityKey(leftAddress.place.root) !== bindingIdentityKey(rightAddress.place.root))
+    return null;
+  const leftOffset = staticPlaceOffset(leftAddress.place, definitions);
+  const rightOffset = staticPlaceOffset(rightAddress.place, definitions);
+  if (leftOffset === null || rightOffset === null || leftOffset !== rightOffset) return null;
+  return left.address;
+}
+
+/**
+ * Recognize one block-index expression.
+ *
+ * Division and shift forms directly produce a 64-byte block number. A
+ * standalone `hi(address) * 4` discards the low address byte and therefore
+ * needs 256-byte alignment. When that product is itself an operand of a larger
+ * expression, it does not prove a standalone block number; leave it alone so
+ * an ordinary combined selector is not over-aligned.
+ */
+function blockDemand(
+  operation: SemanticOperation,
+  definitions: Definitions,
+  blocks: readonly SemanticBlock[],
+): { readonly align: number; readonly address: ValueId } | null {
+  if (operation.kind !== "binary") return null;
+  const right = constantValue(definitions.get(operation.right), definitions);
+  if (operation.operator === "/" && right === 64) return { align: 64, address: operation.left };
+  if (operation.operator === ">>" && right === 6) return { align: 64, address: operation.left };
+  if (operation.operator !== "*") return null;
+  if (usedByBinary(operation.result, blocks, definitions)) return null;
+  const leftHigh = highByteOperand(operation.left, definitions);
+  if (right === 4 && leftHigh !== null) return { align: 256, address: leftHigh };
+  const left = constantValue(definitions.get(operation.left), definitions);
+  const rightHigh = left === 4 ? highByteOperand(operation.right, definitions) : null;
+  return rightHigh === null ? null : { align: 256, address: rightHigh };
+}
+
+/**
+ * Record the alignment a module object needs when its address is used as a
+ * block index.
+ *
+ * The pass only strengthens placement; it never invents a diagnostic and never
+ * rejects a program. A runtime index, an explicit address and a structural
+ * field offset that cannot be expressed by root alignment are left exactly as
+ * written. This preserves ordinary address arithmetic and every explicit
+ * placement; a consumer-aware diagnostic for an unsatisfiable hardware use
+ * needs a new approved warning contract and is tracked separately.
+ *
+ * @param functions Ordinary and initializer bodies to scan.
+ * @param globals Module objects whose placement may be strengthened.
+ * @returns The globals with any proved alignment demand applied.
+ */
+export function alignBlockIndexStorage(
+  functions: readonly SemanticFunction[],
+  globals: readonly SemanticGlobal[],
+): readonly SemanticGlobal[] {
+  const byKey = new Map(globals.map((global) => [bindingIdentityKey(global.id), global] as const));
+  const demands = new Map<string, AlignmentDemand[]>();
+  const scan = (blocks: readonly SemanticBlock[]): void => {
+    const definitions = new Map<string, SemanticOperation>();
+    for (const block of blocks)
+      for (const operation of block.operations) {
+        const result = "result" in operation ? operation.result : null;
+        if (result !== null && result !== undefined) definitions.set(result, operation);
+      }
+    const record = (addressValue: ValueId, align: number): void => {
+      const address = addressOperation(addressValue, definitions);
+      if (address === undefined || address.place.asset !== undefined) return;
+      const key = bindingIdentityKey(address.place.root);
+      if (!byKey.has(key)) return;
+      const offset = staticPlaceOffset(address.place, definitions);
+      if (offset === null) return;
+      const known = demands.get(key) ?? [];
+      known.push({ align, offset });
+      demands.set(key, known);
+    };
+    for (const block of blocks) {
+      for (const operation of block.operations) {
+        const complete = completeSelector(operation, definitions);
+        if (complete !== null) {
+          record(complete, 64);
+          continue;
+        }
+        const demand = blockDemand(operation, definitions, blocks);
+        if (demand !== null) record(demand.address, demand.align);
+      }
+    }
+  };
+  for (const fn of functions) scan(fn.blocks);
+  for (const global of globals) scan(global.blocks);
+  if (demands.size === 0) return globals;
+  return Object.freeze(
+    globals.map((global) => {
+      const required = demands.get(bindingIdentityKey(global.id));
+      if (required === undefined) return global;
+      const placement = global.placement;
+      // An explicit or zero-page placement is the user's chosen contract; only
+      // strengthen an automatically placed object.
+      if (placement?.at !== null && placement?.at !== undefined) return global;
+      if (global.zeropage === true) return global;
+      let align = placement?.align ?? 1;
+      for (const demand of required) {
+        // Root alignment can only express a demand whose static offset is a
+        // multiple of it. Leave other shapes exactly as written.
+        if (demand.offset % demand.align !== 0) continue;
+        align = Math.max(align, demand.align);
+      }
+      if (align === (placement?.align ?? 1)) return global;
+      return Object.freeze({
+        ...global,
+        placement: Object.freeze({
+          at: null,
+          align,
+          noCross: placement?.noCross ?? null,
+          region: placement?.region ?? null,
+        }),
+      });
+    }),
+  );
+}
```

## Review round 3 and final dispositions

| ID | Reviewer | Severity | Finding | Disposition |
| --- | --- | --- | --- | --- |
| RV-006 | Correctness | Major | A widening-wrapped complete selector `word(hi*4) + word(lo>>6)` still demanded 256 because selector recognition stopped at `zero-extend` and the inner product's indirect binary consumer was missed. | Fixed: selector halves follow widening conversions, and `usedByBinary` follows non-truncating conversions. Impl and spec regressions cover the wrapped selector and a field at offset 64. |
| RV-007 / SM-004 | Correctness, semantics | Minor | The execution plan still required E10143 rejection and the packet described diagnostics that no longer exist. | Fixed: the plan requires preservation; no diagnostic is emitted. |
| SM-005 / TP-004 | Semantics, platform | Minor | The correctness claim must be qualified, and the residual boundaries need named owners. | Fixed: the packet and closeout call this partial alignment inference and name follow-ups for explicit misalignment, effective-address placement, runtime indices, consumer-aware diagnostics and VIC-bank visibility. |
| RV-008 | Correctness | Critical | The new specification oracle changed from rejection to preservation after the first draft. | Recorded as an oracle revision: the first draft was never committed, asserted an unauthorized E10273, and was withdrawn before acceptance. The final oracle is independently audited against the requirement contract. This is an explicit review gate, not a silent weakening. |

## Review round 4 and emitted-cost evidence

| ID | Reviewer | Severity | Finding | Disposition |
| --- | --- | --- | --- | --- |
| RV-006 remainder | Correctness | Major | Widening inside each selector half (`word(hi(...))`, `word(lo(...))`) was still rejected. | Fixed: `highByteOperand`/`lowByteOperand` follow widening conversions; impl regression and public oracle cover the inside-widening form. |
| Oracle round 4 | Spec audit | Major | Automatic complete-selector coverage could not distinguish 64 from 256; zero-page and constant-index cases were missing. | Added automatic `64 <= alignmentBytes < 256` cases in both orders, a constant-index case, zero-page preservation, and symbol-metadata address resolution. |
| RV-007 | Correctness | Minor | Packet rows still described effective-address validation and diagnostic assertions. | Marked superseded by the final no-rejection design. |
| MC-004 | Machine code | Major | Padding-only growth and emitted costs were asserted without artifact evidence. | Added the explicit-address comparison below: the instruction sequence is identical; only scratch and data addresses differ. The runtime-shift gap is filed as #160 with 66 B / about 112 cycles versus 5 B / 6 cycles. |

## MC-004 emitted-cost evidence

Two explicit-address builds, `place(at: $0AC0)` and `place(at: $0AFD)`, use the same source and the
same consumer. Their `Game.main` instruction sequence is identical; the only differences are the
scratch and data addresses. The explicit-address alignment of 1 is preserved in both, which is the
documented boundary. The automatic build moves the object to `$0AC0` and leaves the same
instruction sequence.

| Build | PRG bytes | Program code bytes | `Game.main` instructions | Buffer | Reported alignment |
| --- | ---: | ---: | ---: | --- | ---: |
| Automatic | 702 | 688 | 124 | `$0AC0` | 64 |
| Explicit `$0AC0` | 702 | 688 | 124 | `$0AC0` | 1 |
| Explicit `$0AFD` | 702 | 688 | 124 | `$0AFD` | 1 |

The startup restore block contributes to the 124-instruction count because the listing section
runs to the next routine; the selector-and-store prefix is the first 24 instructions and is
identical in all three builds apart from scratch addresses.

```asm
  lda #<(buffer)
  sta $02
  lda #>(buffer)
  sta $03
  lda $02
  sta $0abd
  lda $03
  sta $0abe
  lsr $0abe
  ror $0abd
  lsr $0abe
  ror $0abd
  lsr $0abe
  ror $0abd
  lsr $0abe
  ror $0abd
  lsr $0abe
  ror $0abd
  lsr $0abe
  ror $0abd
  lda $0abd
  sta $0abf
  lda $0abf
  sta $07f8
```

The explicit `$0AFD` build uses `$0aef`-`$0af1` for the same three scratch bytes. ZP staging is the
same two bytes (`$02`/`$03`); there is no additional stack use in `main`; the startup save/restore
sequence is identical.

The block selector still lowers as a runtime shift: 66 bytes and about 112 nominal cycles versus
the expert `LDA #<(buffer/64); STA $07F8` at 5 bytes / 6 cycles. That is pre-existing
symbolic-address lowering debt, owned by #160; the alignment pass itself adds no instruction,
scratch, ZP or stack byte.

## Oracle revision record

The first oracle draft expected `E10273` for an explicitly misaligned buffer. Independent review
showed that the frozen registry does not authorize a new warning or a syntax-derived rejection, so
the implementation was changed to preserve every explicit placement and the oracle was revised
before acceptance. The revised cases are: explicit misaligned build-success and address
preservation (replacing rejection), explicit aligned preservation (unchanged), unalignable
automatic field preservation (replacing rejection), runtime-index preservation, and the added
complete-selector/widening cases. No pre-existing committed oracle was edited. The final oracle is
reviewed by an independent spec-test author against the requirement contract. **The user ratified
this revision on 2026-11-14**, so the exact oracle-edit authority gate is cleared.

## Review round 2 and final design pivot

| ID | Reviewer | Severity | Finding | Disposition |
| --- | --- | --- | --- | --- |
| SM-001 / TP-001 | Semantics, platform | Major | Any syntax-derived rejection of ordinary address arithmetic is a new source restriction; the frozen registry does not authorize it. | The final design removes all rejection. It only strengthens automatic placement; explicit, zero-page, runtime and unalignable shapes are preserved. |
| SM-002 | Semantics | Major | Automatic field placement can be feasible at `root + offset` even when root alignment alone cannot express it, so rejecting it is wrong. | The final design leaves the shape unchanged; effective-address automatic placement is follow-up debt. |
| SM-003 | Semantics | Major | The commuted complete selector `4 * hi + lo >> 6` lost its 64-byte demand. | `selectorSide` checks both multiplication orders; regression added. |
| SM-004 | Semantics | Minor | The task line still named E10143. | Removed with the final no-diagnostic design. |
| Oracle-01 | Spec audit | Major | The oracle selected the first 64-byte BSS interval and did not prove object ownership. | It now resolves the object label first and selects the interval at that exact start. |
| Oracle-02 | Spec audit | Moderate | Exact `alignmentBytes === 1` and the `$D018`/label spelling were over-specified. | The plain-`lo` control asserts `< 64`; the witness uses `c64.vic.setSpritePointer`; labels match the existing public test convention. |

## Review round 1 and dispositions

| ID | Reviewer | Severity | Finding | Disposition |
| --- | --- | --- | --- | --- |
| RV-001 | Correctness | Major | `4 * hi(&buffer)` never matched because the right-operand check returned first. | Fixed: both operand orders are checked; commuted regression added. |
| RV-002 / SF-001 / TP-002 / MC-003 | Correctness, SFA, platform, machine code | Major | A field at offset 1 was rejected even when an explicit root address made the effective address aligned. | **Superseded by the final no-rejection design.** The explicit address is preserved unchanged and the `$0B3F` frame witness builds; no effective-address validation or diagnostic remains. |
| RV-003 | Correctness | Major | A narrowing conversion such as `word(byte(&buffer))` was followed as if it still carried the full address. | Fixed: only identity/reinterpret conversions are followed; a regression proves the narrowed value is not matched. |
| RV-004 | Correctness | Major | Constant divisors/indices behind `word(...)` conversions were not resolved. | Fixed: constants follow conversions with truncation semantics; `word(64)` and `word(1)` regressions pass. |
| RV-005 | Correctness | Minor | The diagnostic primary span omitted the matched operation, and the message used "conflicts with" instead of the registry's "conflict with". | **Superseded by the final no-rejection design.** The pass emits no diagnostic; there is no span or message claim left. |
| MC-002 | Machine code | Major | An inner `hi*4` in the complete `hi*4 + lo>>6` selector over-demanded 256-byte alignment. | Fixed: the complete selector is recognized as a 64-byte demand; the inner product is skipped; explicit `$30C0` regression passes. |
| TP-001 / MC-001 | Platform, machine code | Major | The `$D018` witness is not a sprite-pointer install and does not prove a real VIC consumer. | Fixed: the spec witness now uses `c64.vic.setSpritePointer`. The test remains build/placement-only; it claims the block value and slot, not rendered pixels. |
| TP-003 | Platform | Minor | The 64-byte storage slot is not the same as the sprite's 63-byte image. | Recorded: the packet speaks of the 64-byte block slot and the pointer value; no pixel-footprint claim is made. |

## Test inventory

`test/rd04/block-index-alignment.spec.test.ts` (four profiles each):
`/64` alignment, `>>6` alignment, `hi*4` 256-byte alignment, commuted `4 * hi`, plain `lo` no
padding, constant image alignment, explicit-misaligned preservation, explicit-aligned
preservation, explicit-root field alignment, unalignable automatic field preservation,
runtime-index preservation, the complete `hi/lo` selector at a 64-byte address, automatic
complete selectors in both orders with a 64..255 alignment bound, a widening-wrapped/inside
selector, a constant-index element, and zero-page preservation.

`packages/compiler/src/semantic/block-index-alignment.impl.test.ts`:
division, shift, `hi*4`, commuted `4 * hi`, plain `lo`, constant index, runtime index untouched,
aligned field, unalignable field preservation, explicit effective field address,
narrowing-conversion non-match, converted constants, complete selector (both orders and
widening-wrapped), a field at offset 64, explicit aligned address, explicit misaligned
preservation, strongest demand across uses.

## Evidence limits

Targeted and package results only at this packet; the complete `yarn test:full` checkpoint is
recorded in the closeout. No byte/cycle claim is made for the runtime shift itself; the change only
adds placement padding and makes the selected block correct.
