/**
 * IL textual form — `printIL` (RD-06 §4.6, R53–R55).
 *
 * Renders an {@link ILProgram} to a **stable, deterministic, human-readable**
 * string: the surface for `--emit-il` (wired by RD-15) and for golden-snapshot
 * testing. Same input → identical output, character-for-character (H5). It is a
 * pure function of the program — no clock, no random, no map/set iteration, no
 * locale-dependent formatting; line endings are always `\n`.
 *
 * The printer is intentionally "dumb": every operand renders verbatim from its
 * own fields (a `Location`'s `symbol` is printed as-is, including frame-slot
 * names like `__frame_Math_add_a` — register D8), so there is exactly one
 * rendering path per operand kind and no hidden lookups.
 */

import type { ILType } from "./il-type.js";
import type { ILOperand } from "./operand.js";
import type { ILInstruction, ILTerminator } from "./instruction.js";
import type { BasicBlock, ILFunction, ILProgram } from "./cfg.js";

/**
 * Map an {@link ILType} to its textual tag (§4.6). The **single** place this
 * mapping lives — width + signedness → `i8u` / `i8s` / `i16u` / `i16s`.
 *
 * @param t The IL type.
 * @returns The four-character type tag.
 */
export function ilTypeTag(t: ILType): string {
  const width = t.width === 8 ? "i8" : "i16";
  return `${width}${t.signed ? "s" : "u"}`;
}

/**
 * Render a single operand (§4.2/§4.6):
 * - immediate → bare decimal number (v1 prints decimal; the operand carries only
 *   a `number`, not its source radix — keeps output source-independent, D-watch)
 * - temp → `%N`
 * - location → `symbol` (+ `+offset` when an offset is present)
 *
 * @param o The operand to render.
 * @returns The operand's textual form.
 */
function renderOperand(o: ILOperand): string {
  switch (o.kind) {
    case "immediate":
      return String(o.value);
    case "temp":
      return `%${o.id}`;
    case "location":
      return o.offset === undefined ? o.symbol : `${o.symbol}+${o.offset}`;
  }
}

/**
 * Render one instruction line's body (without the leading two-space indent).
 *
 * Instructions with a destination render `<dest> = <op> <type?> <operands>`;
 * destination-less instructions (`store`, `source_span`, void `call`/`intrinsic`)
 * render `<op> <operands>`. The type tag is printed for the typed arithmetic/
 * bitwise/comparison forms and for `load` (matching the §4.7 golden); `copy`/
 * `const`/conversion forms print their operands without a redundant tag.
 *
 * @param ins The instruction.
 * @returns The textual body of the instruction line.
 */
function renderInstruction(ins: ILInstruction): string {
  switch (ins.op) {
    // Binary arithmetic/bitwise/comparison — `%d = op <type> %l, %r`
    case "add":
    case "sub":
    case "mul":
    case "div":
    case "mod":
    case "and":
    case "or":
    case "xor":
    case "shl":
    case "shr":
    case "eq":
    case "ne":
    case "lt":
    case "le":
    case "gt":
    case "ge":
      return `${renderOperand(ins.dest)} = ${ins.op} ${ilTypeTag(ins.type)} ${renderOperand(
        ins.left,
      )}, ${renderOperand(ins.right)}`;
    // Unary arithmetic/bitwise — `%d = op <type> %s`
    case "neg":
    case "not":
      return `${renderOperand(ins.dest)} = ${ins.op} ${ilTypeTag(ins.type)} ${renderOperand(
        ins.src,
      )}`;
    // Conversion — `%d = op %s` (widths read from the operands themselves)
    case "zext":
    case "sext":
    case "trunc":
      return `${renderOperand(ins.dest)} = ${ins.op} ${renderOperand(ins.src)}`;
    // Direct memory: `load` writes a dest temp (typed, per §4.7); `store` has no dest.
    case "load":
      return `${renderOperand(ins.a)} = load ${ilTypeTag(ins.a.type)} ${renderOperand(ins.b)}`;
    case "store":
      return `store ${renderOperand(ins.a)}, ${renderOperand(ins.b)}`;
    // Indexed memory — `op %value, %base, %index`
    case "load_indexed":
    case "store_indexed":
      return `${ins.op} ${renderOperand(ins.value)}, ${renderOperand(ins.base)}, ${renderOperand(
        ins.index,
      )}`;
    // Indirect memory — `op %value, %ptr, %offset`
    case "load_indirect":
    case "store_indirect":
      return `${ins.op} ${renderOperand(ins.value)}, ${renderOperand(ins.ptr)}, ${renderOperand(
        ins.offset,
      )}`;
    // Copy / const — `%d = op %s`
    case "copy":
    case "const":
      return `${renderOperand(ins.dest)} = ${ins.op} ${renderTyped(ins)}`;
    // Call — optional dest, target label, parenthesized args
    case "call":
      return renderCallLike(ins.op, ins.target, ins.args, ins.dest);
    // Intrinsic — optional dest, intrinsic name, parenthesized args
    case "intrinsic":
      return renderCallLike(ins.op, ins.name, ins.args, ins.dest);
    // Debug span — no value, just a marker with the byte range
    case "source_span":
      return `source_span ${ins.span.start}..${ins.span.end}`;
  }
}

/**
 * Render the value side of a `copy`/`const` instruction. `const` of an immediate
 * prints `<type> <value>` (matching the slice-2 golden `%0 = const i8u 5`);
 * everything else prints the source operand bare.
 *
 * @param ins A `copy` or `const` instruction.
 * @returns The rendered right-hand side.
 */
function renderTyped(ins: Extract<ILInstruction, { op: "copy" | "const" }>): string {
  if (ins.op === "const" && ins.src.kind === "immediate") {
    return `${ilTypeTag(ins.src.type)} ${renderOperand(ins.src)}`;
  }
  return renderOperand(ins.src);
}

/**
 * Render a `call`/`intrinsic` line: an optional `%dest = ` prefix, the opcode,
 * the target/name, and the comma-separated argument operands in parentheses.
 *
 * @param op The opcode keyword (`call` or `intrinsic`).
 * @param target The call target label or intrinsic name.
 * @param args The argument operands.
 * @param dest The optional destination operand.
 * @returns The rendered instruction body.
 */
function renderCallLike(
  op: "call" | "intrinsic",
  target: string,
  args: readonly ILOperand[],
  dest: ILOperand | undefined,
): string {
  const argList = args.map(renderOperand).join(", ");
  const body = `${op} ${target}(${argList})`;
  return dest === undefined ? body : `${renderOperand(dest)} = ${body}`;
}

/**
 * Render a block's terminator line body (§4.6): `br`, `brcond`, `ret`, or
 * `unreachable`.
 *
 * @param term The terminator.
 * @returns The textual body of the terminator line.
 */
function renderTerminator(term: ILTerminator): string {
  switch (term.kind) {
    case "br":
      return `br ${term.target}`;
    case "brcond":
      return `brcond ${renderOperand(term.cond)}, ${term.trueTarget}, ${term.falseTarget}`;
    case "ret":
      return term.value === undefined ? "ret" : `ret ${renderOperand(term.value)}`;
    case "unreachable":
      return "unreachable";
  }
}

/**
 * Render one basic block: a column-0 `label:` line followed by two-space-indented
 * instruction lines and the terminator line.
 *
 * @param block The basic block.
 * @returns The block's lines (no trailing newline).
 */
function renderBlock(block: BasicBlock): string {
  const lines: string[] = [`${block.label}:`];
  for (const ins of block.instructions) {
    lines.push(`  ${renderInstruction(ins)}`);
  }
  lines.push(`  ${renderTerminator(block.terminator)}`);
  return lines.join("\n");
}

/**
 * Render a function header parameter (§4.6, D8): the param operand verbatim,
 * annotated with its IL type tag (`__frame_Math_add_a: i8u`).
 *
 * @param p The parameter operand (a `Location` from the AllocationPlan).
 * @returns The rendered `name: type` pair.
 */
function renderParam(p: ILOperand): string {
  return `${renderOperand(p)}: ${ilTypeTag(p.type)}`;
}

/**
 * Render one function: the `function <name>(<params>): <ret> {` header, each
 * block (entry first, in array order, R16), then the closing `}`.
 *
 * @param fn The IL function.
 * @returns The function's textual form (no trailing newline).
 */
function renderFunction(fn: ILFunction): string {
  const params = fn.params.map(renderParam).join(", ");
  const ret = fn.returnType === "void" ? "void" : ilTypeTag(fn.returnType);
  const lines: string[] = [`function ${fn.name}(${params}): ${ret} {`];
  for (const block of fn.blocks) {
    lines.push(renderBlock(block));
  }
  lines.push("}");
  return lines.join("\n");
}

/**
 * Render an entire {@link ILProgram} to deterministic IL text (R53–R55).
 *
 * Functions are printed in `program.functions` order, separated by a blank line.
 * `initCode`/`constData` are empty in v1 and contribute nothing. The result has
 * no trailing newline.
 *
 * @param program The IL program to print.
 * @returns The deterministic textual representation.
 */
export function printIL(program: ILProgram): string {
  return program.functions.map(renderFunction).join("\n\n");
}
