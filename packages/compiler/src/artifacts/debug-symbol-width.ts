interface ParsedType {
  readonly next: number;
  readonly shape: readonly (number | "unsized")[];
}

const IDENTIFIER_START = /[A-Za-z_]/u;
const IDENTIFIER_PART = /[A-Za-z0-9_]/u;
const PRIMITIVES = ["boolean", "sbyte", "sword", "byte", "word"] as const;
const KEYWORDS = new Set([
  "module",
  "import",
  "export",
  "from",
  "function",
  "return",
  "interrupt",
  "fn",
  "comptime",
  "if",
  "else",
  "while",
  "do",
  "for",
  "switch",
  "case",
  "default",
  "fallthrough",
  "break",
  "continue",
  "let",
  "const",
  "loadable",
  "place",
  "zeropage",
  "struct",
  "byte",
  "sbyte",
  "word",
  "sword",
  "boolean",
  "void",
  "true",
  "false",
  "enum",
  "type",
]);

/** Parse one identifier or module-qualified type name. */
function parseQualifiedName(source: string, start: number): number | null {
  let index = start;
  for (;;) {
    const partStart = index;
    if (!IDENTIFIER_START.test(source[index] ?? "")) return null;
    index += 1;
    while (IDENTIFIER_PART.test(source[index] ?? "")) index += 1;
    if (KEYWORDS.has(source.slice(partStart, index))) return null;
    if (source[index] !== ".") return index;
    index += 1;
  }
}

/** Parse canonical resolved array extents after a value-type atom. */
function parseShape(source: string, start: number): ParsedType {
  let index = start;
  const shape: (number | "unsized")[] = [];
  while (source[index] === "[") {
    const close = source.indexOf("]", index + 1);
    if (close < 0) return Object.freeze({ next: index, shape: Object.freeze(shape) });
    const text = source.slice(index + 1, close);
    if (text === "") {
      shape.push("unsized");
    } else if (!/^(?:0|[1-9][0-9]*)$/u.test(text) || !Number.isSafeInteger(Number(text))) {
      return Object.freeze({ next: index, shape: Object.freeze(shape) });
    } else {
      shape.push(Number(text));
    }
    index = close + 1;
  }
  return Object.freeze({ next: index, shape: Object.freeze(shape) });
}

/** Parse an exact canonical function-value spelling. */
function parseFunctionType(source: string, start: number): number | null {
  if (!source.startsWith("fn(", start)) return null;
  let index = start + 3;
  if (source[index] !== ")") {
    for (;;) {
      if (source.startsWith("const ", index)) index += 6;
      const parameter = parseValueType(source, index);
      if (parameter === null) return null;
      index = parameter.next;
      if (source.startsWith(", ", index)) {
        index += 2;
        continue;
      }
      break;
    }
  }
  if (!source.startsWith("): ", index)) return null;
  index += 3;
  if (source.startsWith("void", index)) return index + 4;
  return parseValueType(source, index)?.next ?? null;
}

/** Parse one canonical Specification-4 value type and expose its outer array shape. */
function parseValueType(source: string, start: number): ParsedType | null {
  let index = start;
  let parenthesizedFunction = false;
  let bareFunction = false;
  if (source[index] === "(" && source.startsWith("fn(", index + 1)) {
    const end = parseFunctionType(source, index + 1);
    if (end === null || source[end] !== ")") return null;
    index = end + 1;
    parenthesizedFunction = true;
  } else if (source.startsWith("fn(", index)) {
    const end = parseFunctionType(source, index);
    if (end === null) return null;
    index = end;
    bareFunction = true;
  } else if (
    source.startsWith("interrupt-handler", index) &&
    !IDENTIFIER_PART.test(source[index + "interrupt-handler".length] ?? "")
  ) {
    // Handler values are a distinct internal two-byte kind, not ordinary fn values.
    index += "interrupt-handler".length;
  } else {
    const primitive = PRIMITIVES.find(
      (name) =>
        source.startsWith(name, index) && !IDENTIFIER_PART.test(source[index + name.length] ?? ""),
    );
    if (primitive !== undefined) {
      index += primitive.length;
    } else {
      const end = parseQualifiedName(source, index);
      if (end === null) return null;
      index = end;
    }
  }
  const parsed = parseShape(source, index);
  if (parenthesizedFunction && parsed.shape.length === 0) return null;
  if (bareFunction && parsed.shape.length > 0) return null;
  return parsed;
}

/** Return whether a symbol carries an exact canonical type spelling and matching outer shape. */
export function symbolShapeMatchesType(symbol: Record<string, unknown>): boolean {
  if (typeof symbol.type !== "string" || !Array.isArray(symbol.shape)) return false;
  const parsed = parseValueType(symbol.type, 0);
  const shape = symbol.shape as (number | "unsized")[];
  return (
    parsed !== null &&
    parsed.next === symbol.type.length &&
    parsed.shape.length === shape.length &&
    parsed.shape.every((extent, index) => extent === shape[index])
  );
}
