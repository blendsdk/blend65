/**
 * Symbolic instruction operands.
 *
 * Mirrors `il/operand.ts`: a `kind`-discriminated readonly union, small
 * constructors, and type guards. Operands are kept **symbolic**: there are
 * no hard `$xxxx` addresses here — named symbols, labels, and ZP slots stay as
 * identifiers and ACME resolves them to numbers later. The only concrete
 * numeric operand is `immediate`, which is a literal value the program computed.
 *
 * Pure data + trivial constructors/guards — no behavior, no validation. Every
 * constructor always succeeds: operand value-range checks are a translation
 * concern owned downstream (codegen/peephole), not the model layer.
 *
 * Lives in `@blend65/core` (`instr-model/`); `@blend65/codegen` re-exports it
 * unchanged.
 */

/**
 * A value source for a single 6502 instruction. A discriminated union keyed
 * on `kind`:
 *
 * - **none** — implied/accumulator instructions carry no operand
 * - **immediate** — a concrete literal value, e.g. `LDA #$42`
 * - **symbolRef** — a named symbol (variable/struct field/code label) with an
 *   optional struct/array `offset` and a `byteSelect` for ACME `<sym`/`>sym`
 *   low/high-byte selection
 * - **symbolExpr** — a byte of a symbol's address after dividing it by a power
 *   of two, e.g. `<(sprite / 64)` for a sprite's 64-byte block number. The
 *   assembler does the division at link time, so what would otherwise be a
 *   runtime divide of a constant costs nothing at all
 * - **labelRef** — a branch/jump target label
 * - **zpSlot** — a zero-page allocation symbol
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
  | {
      readonly kind: "symbolExpr";
      readonly name: string;
      readonly shift: number;
      readonly byteSelect: "low" | "high";
    }
  | { readonly kind: "labelRef"; readonly label: string }
  | { readonly kind: "zpSlot"; readonly name: string };

/**
 * Construct the empty operand for implied/accumulator instructions.
 *
 * @returns A `none` operand.
 */
export function none(): InstrOperand {
  return { kind: "none" };
}

/**
 * Construct an immediate (literal) operand, e.g. `LDA #$42`.
 *
 * The value is stored verbatim; this constructor performs no range check — an
 * out-of-range value (e.g. `imm8(300)`) is a translation-stage concern, not a
 * model concern (the model is intentionally total — every constructor always
 * succeeds).
 *
 * @param value The literal numeric value.
 * @returns An `immediate` operand.
 */
export function imm8(value: number): InstrOperand {
  return { kind: "immediate", value };
}

/**
 * Construct a symbolic reference to a named symbol.
 *
 * `offset` is attached **only** when supplied, so two refs without offsets
 * compare equal under `toEqual` and serialize identically (mirroring `loc` in
 * `il/operand.ts`). `byteSelect` is **always** present (defaulting to `"none"`)
 * because the serializer branches on it unconditionally — `"low"`/`"high"`
 * render ACME's `<sym`/`>sym` byte selectors.
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
 * Construct a byte of a symbol's address divided by `2**shift`.
 *
 * Both `shift` and `byteSelect` are required, and `shift` is at least 1. That
 * leaves every value exactly one spelling: an unshifted select is
 * {@link symbolRef}, which already exists and already round-trips, and a
 * select is never optional because the truncation is what keeps the divided
 * value in range at any address.
 *
 * There is deliberately no offset parameter. ACME binds `/` tighter than `+`,
 * so an addend written inside the division without its own parentheses
 * silently assembles to the wrong byte; omitting the field makes that
 * unwritable rather than merely discouraged.
 *
 * @param name The symbol name.
 * @param shift The power-of-two divisor's exponent (≥ 1).
 * @param byteSelect Which byte of the divided address to take.
 * @returns A `symbolExpr` operand.
 * @example
 * // A sprite's 64-byte block number, resolved by the assembler:
 * symbolExpr("__data_Main_BALLOON", 6, "low"); // renders <(__data_Main_BALLOON / 64)
 */
export function symbolExpr(name: string, shift: number, byteSelect: "low" | "high"): InstrOperand {
  return { kind: "symbolExpr", name, shift, byteSelect };
}

/**
 * Construct a reference to a branch/jump target label.
 *
 * @param label The target label name.
 * @returns A `labelRef` operand.
 */
export function labelRef(label: string): InstrOperand {
  return { kind: "labelRef", label };
}

/**
 * Construct a reference to a zero-page allocation slot.
 *
 * @param name The ACME symbol naming that zero-page byte.
 * @returns A `zpSlot` operand.
 */
export function zpSlot(name: string): InstrOperand {
  return { kind: "zpSlot", name };
}

/**
 * Type guard: is this operand an immediate?
 *
 * Named `isImmediateOperand` (not `isImmediate`) so it does not collide with the
 * IL operand guard `il/operand.ts#isImmediate` at the `@blend65/codegen` barrel —
 * both families are re-exported flat and used together.
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
 * Type guard: is this operand a symbolic reference?
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
 * Type guard: is this operand a divided-address byte?
 *
 * Named `isSymbolExprOperand` for the same reason as
 * {@link isImmediateOperand} — both operand families are re-exported flat at
 * the `@blend65/codegen` barrel and used side by side.
 *
 * @param o The operand to classify.
 * @returns `true` and narrows to the `symbolExpr` variant when matched.
 */
export function isSymbolExprOperand(
  o: InstrOperand,
): o is Extract<InstrOperand, { kind: "symbolExpr" }> {
  return o.kind === "symbolExpr";
}

/**
 * Type guard: is this operand a label reference?
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
 * Type guard: is this operand a zero-page slot?
 *
 * @param o The operand to classify.
 * @returns `true` and narrows to the `zpSlot` variant when matched.
 */
export function isZpSlot(
  o: InstrOperand,
): o is Extract<InstrOperand, { kind: "zpSlot" }> {
  return o.kind === "zpSlot";
}
