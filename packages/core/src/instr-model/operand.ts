/**
 * Symbolic instruction operands — RD-07 §4.2, R8–R13.
 *
 * Mirrors `il/operand.ts`: a `kind`-discriminated readonly union, small
 * constructors, and type guards. Operands are kept **symbolic** (R8): there are
 * no hard `$xxxx` addresses here — named symbols, labels, and ZP slots stay as
 * identifiers and ACME resolves them to numbers later (RD-09). The only concrete
 * numeric operand is `immediate`, which is a literal value the program computed.
 *
 * Pure data + trivial constructors/guards — no behavior, no validation. Every
 * constructor always succeeds (H5): operand value-range checks are a translation
 * concern owned by RD-07b/peephole, not the model layer.
 *
 * Relocated to `@blend65/core` (`instr-model/`) by RD-10 D7/D8; `@blend65/codegen`
 * re-exports it unchanged.
 */

/**
 * A value source for a single 6502 instruction (§4.2). A discriminated union
 * keyed on `kind`:
 *
 * - **none** — implied/accumulator instructions carry no operand (R8)
 * - **immediate** — a concrete literal value, e.g. `LDA #$42` (R9)
 * - **symbolRef** — a named symbol (variable/struct field/code label) with an
 *   optional struct/array `offset` and a `byteSelect` for ACME `<sym`/`>sym`
 *   low/high-byte selection (R10/R13)
 * - **labelRef** — a branch/jump target label (R11)
 * - **zpSlot** — a zero-page allocation symbol (R12)
 */
export type InstrOperand =
  | { readonly kind: "none" }
  | { readonly kind: "immediate"; readonly value: number }
  | {
      readonly kind: "symbolRef";
      readonly name: string;
      readonly offset?: number;
      readonly byteSelect: "low" | "high" | "none";
    }
  | { readonly kind: "labelRef"; readonly label: string }
  | { readonly kind: "zpSlot"; readonly name: string };

/**
 * Construct the empty operand for implied/accumulator instructions (R8).
 *
 * @returns A `none` operand.
 */
export function none(): InstrOperand {
  return { kind: "none" };
}

/**
 * Construct an immediate (literal) operand, e.g. `LDA #$42` (R9).
 *
 * The value is stored verbatim; this constructor performs no range check — an
 * out-of-range value (e.g. `imm8(300)`) is a translation-stage concern, not a
 * model concern (the model is intentionally total, H5).
 *
 * @param value The literal numeric value.
 * @returns An `immediate` operand.
 */
export function imm8(value: number): InstrOperand {
  return { kind: "immediate", value };
}

/**
 * Construct a symbolic reference to a named symbol (R10/R13).
 *
 * `offset` is attached **only** when supplied, so two refs without offsets
 * compare equal under `toEqual` and serialize identically (mirroring `loc` in
 * `il/operand.ts`). `byteSelect` is **always** present (defaulting to `"none"`)
 * because the serializer branches on it unconditionally — `"low"`/`"high"`
 * render ACME's `<sym`/`>sym` byte selectors (R13).
 *
 * @param name The symbol name (variable, struct field base, or code label).
 * @param opts Optional `offset` (byte displacement into an aggregate) and
 *   `byteSelect` (low/high-byte selection; defaults to `"none"`).
 * @returns A `symbolRef` operand.
 */
export function symbolRef(
  name: string,
  opts?: { offset?: number; byteSelect?: "low" | "high" | "none" },
): InstrOperand {
  const byteSelect = opts?.byteSelect ?? "none";
  // Only attach `offset` when supplied so the bare form has no `offset` key —
  // keeps `toEqual` comparisons and serialized output stable.
  return opts?.offset === undefined
    ? { kind: "symbolRef", name, byteSelect }
    : { kind: "symbolRef", name, offset: opts.offset, byteSelect };
}

/**
 * Construct a reference to a branch/jump target label (R11).
 *
 * @param label The target label name.
 * @returns A `labelRef` operand.
 */
export function labelRef(label: string): InstrOperand {
  return { kind: "labelRef", label };
}

/**
 * Construct a reference to a zero-page allocation slot (R12).
 *
 * @param name The ACME symbol naming that zero-page byte.
 * @returns A `zpSlot` operand.
 */
export function zpSlot(name: string): InstrOperand {
  return { kind: "zpSlot", name };
}

/**
 * Type guard: is this operand an immediate? (R7)
 *
 * Named `isImmediateOperand` (not `isImmediate`) so it does not collide with the
 * IL operand guard `il/operand.ts#isImmediate` at the `@blend65/codegen` barrel —
 * both families are re-exported flat and used together by RD-07b (AR D10).
 *
 * @param o The operand to classify.
 * @returns `true` and narrows to the `immediate` variant when matched.
 */
export function isImmediateOperand(
  o: InstrOperand,
): o is Extract<InstrOperand, { kind: "immediate" }> {
  return o.kind === "immediate";
}

/**
 * Type guard: is this operand a symbolic reference? (R7)
 *
 * @param o The operand to classify.
 * @returns `true` and narrows to the `symbolRef` variant when matched.
 */
export function isSymbolRef(
  o: InstrOperand,
): o is Extract<InstrOperand, { kind: "symbolRef" }> {
  return o.kind === "symbolRef";
}

/**
 * Type guard: is this operand a label reference? (R7)
 *
 * @param o The operand to classify.
 * @returns `true` and narrows to the `labelRef` variant when matched.
 */
export function isLabelRef(
  o: InstrOperand,
): o is Extract<InstrOperand, { kind: "labelRef" }> {
  return o.kind === "labelRef";
}

/**
 * Type guard: is this operand a zero-page slot? (R7)
 *
 * @param o The operand to classify.
 * @returns `true` and narrows to the `zpSlot` variant when matched.
 */
export function isZpSlot(
  o: InstrOperand,
): o is Extract<InstrOperand, { kind: "zpSlot" }> {
  return o.kind === "zpSlot";
}
