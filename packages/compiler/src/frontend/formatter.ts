/** One token or comment retained by the formatting scanner. */
type FormatPiece =
  | {
      readonly kind: "token";
      readonly category: "word" | "number" | "string" | "char" | "operator";
      readonly text: string;
    }
  | { readonly kind: "line-comment"; readonly text: string }
  | { readonly kind: "block-comment"; readonly text: string; readonly multiline: boolean };

/** One piece plus the trivia context that preceded it. */
interface ScannedPiece {
  readonly piece: FormatPiece;
  readonly newlinesBefore: number;
  readonly blankLineBefore: boolean;
}

/** Formatting result or a documented refusal. */
export type FormatResult =
  | { readonly kind: "formatted"; readonly text: string }
  | { readonly kind: "unsupported"; readonly reason: string };

/** Keywords that receive a space before an opening parenthesis. */
const CONTROL_KEYWORDS = new Set(["if", "while", "for", "switch"]);

/** Longest-first operator and punctuation spellings. */
const OPERATORS = [
  "<<=",
  ">>=",
  "&&",
  "||",
  "==",
  "!=",
  "<=",
  ">=",
  "<<",
  ">>",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "+",
  "-",
  "*",
  "/",
  "%",
  "&",
  "|",
  "^",
  "~",
  "!",
  "=",
  "<",
  ">",
  "?",
  ":",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  ",",
  ";",
  ".",
] as const;

/** Operators that may be unary and therefore take no following space. */
const UNARY_CANDIDATES = new Set(["-", "+", "&"]);

/** Binary operators that take one space on each side. */
const BINARY_OPERATORS = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "&",
  "|",
  "^",
  "<<",
  ">>",
  "&&",
  "||",
  "==",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "=",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "<<=",
  ">>=",
  "?",
]);

/** Return whether one scalar starts a word. */
function isWordStart(character: string): boolean {
  return /^[A-Za-z_]$/u.test(character);
}

/** Return whether one scalar continues a word or number. */
function isWordPart(character: string): boolean {
  return /^[A-Za-z0-9_]$/u.test(character);
}

/** Scan one source into tokens, comments, and trivia context. */
function scan(source: string): ScannedPiece[] | { readonly unsupported: string } {
  const pieces: ScannedPiece[] = [];
  let index = 0;
  let newlines = 0;

  /** Push one piece with the trivia context accumulated since the previous piece. */
  const push = (piece: FormatPiece): void => {
    pieces.push({
      piece,
      newlinesBefore: newlines,
      blankLineBefore: newlines >= 2,
    });
    newlines = 0;
  };

  /** Consume a quoted literal, preserving escapes and refusing unterminated input. */
  const literal = (quote: string, category: "string" | "char"): boolean => {
    const start = index;
    index += 1;
    while (index < source.length) {
      const character = source[index]!;
      if (character === "\\") {
        index += 2;
        continue;
      }
      index += 1;
      if (character === quote) {
        push({ kind: "token", category, text: source.slice(start, index) });
        return true;
      }
      if (character === "\n" || character === "\r") return false;
    }
    return false;
  };

  while (index < source.length) {
    const character = source[index]!;
    if (character === " " || character === "\t" || character === "\r" || character === "\n") {
      if (character === "\r" && source[index + 1] === "\n") {
        index += 2;
        newlines += 1;
      } else {
        index += 1;
        if (character === "\n" || character === "\r") newlines += 1;
      }
      continue;
    }
    if (source.startsWith("//", index)) {
      const start = index;
      while (index < source.length && source[index] !== "\n" && source[index] !== "\r") index += 1;
      push({ kind: "line-comment", text: source.slice(start, index) });
      continue;
    }
    if (source.startsWith("/*", index)) {
      const start = index;
      index += 2;
      while (index < source.length && !source.startsWith("*/", index)) index += 1;
      if (index >= source.length) return { unsupported: "Unterminated block comment" };
      index += 2;
      const text = source.slice(start, index);
      push({ kind: "block-comment", text, multiline: text.includes("\n") || text.includes("\r") });
      continue;
    }
    if (character === '"' || character === "'") {
      if (!literal(character, character === '"' ? "string" : "char")) {
        return { unsupported: "Unterminated literal" };
      }
      continue;
    }
    if (character === "$" || /^[0-9]$/u.test(character)) {
      const start = index;
      index += 1;
      while (index < source.length && /^[A-Za-z0-9_]$/u.test(source[index]!)) index += 1;
      push({ kind: "token", category: "number", text: source.slice(start, index) });
      continue;
    }
    if (isWordStart(character)) {
      const start = index;
      while (index < source.length && isWordPart(source[index]!)) index += 1;
      push({ kind: "token", category: "word", text: source.slice(start, index) });
      continue;
    }
    const operator = OPERATORS.find((candidate) => source.startsWith(candidate, index));
    if (operator === undefined) return { unsupported: `Unrecognized character ${character}` };
    index += operator.length;
    push({ kind: "token", category: "operator", text: operator });
  }
  return pieces;
}

/** Determine whether one operator is unary at the current position. */
function isUnary(operator: string, previous: FormatPiece | null): boolean {
  if (operator === "!" || operator === "~") return true;
  if (!UNARY_CANDIDATES.has(operator)) return false;
  if (previous === null) return true;
  if (previous.kind !== "token") return true;
  if (previous.category === "word") {
    return previous.text === "return" || previous.text === "case";
  }
  return (
    previous.category === "operator" &&
    previous.text !== ")" &&
    previous.text !== "]" &&
    previous.text !== "}"
  );
}

/** Return whether one token is word-like for spacing. */
function wordLike(piece: FormatPiece | null): boolean {
  return (
    piece !== null &&
    piece.kind === "token" &&
    (piece.category === "word" ||
      piece.category === "number" ||
      piece.category === "string" ||
      piece.category === "char")
  );
}

/** Return whether one token is a closing punctuation that never takes a leading space. */
function tightBefore(text: string): boolean {
  return [",", ";", ")", "]", ".", ":"].includes(text);
}

/** Return whether one token never takes a trailing space. */
function tightAfter(text: string): boolean {
  return ["(", "[", "."].includes(text);
}

/** Format one complete Blend65 document. */
export function formatBlend65(source: string): FormatResult {
  const scanned = scan(source);
  if ("unsupported" in scanned) return { kind: "unsupported", reason: scanned.unsupported };
  if (scanned.length === 0) return { kind: "formatted", text: "" };

  const lines: string[] = [];
  let current = "";
  let indent = 0;
  let lineIndent = 0;
  let parenDepth = 0;
  let pendingBlank = false;
  let pendingEmptyBlock = false;
  let previous: FormatPiece | null = null;
  let previousUnary = false;
  let previousWasCaseLabel = false;

  /** Start or continue the current output line. */
  const ensureIndent = (): void => {
    if (current.trim().length === 0) current = " ".repeat(Math.max(0, lineIndent) * 4);
  };

  /** Append one text with an optional separator. */
  const append = (text: string, space: boolean): void => {
    ensureIndent();
    if (space && current.trim().length > 0 && !current.endsWith(" ")) current += " ";
    current += text;
  };

  /** Finish the current line and retain at most one blank separator. */
  const flush = (): void => {
    if (current.trim().length > 0) {
      lines.push(current.replace(/\s+$/u, ""));
    }
    current = "";
    lineIndent = indent;
    if (pendingBlank && lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push("");
    }
    pendingBlank = false;
  };

  /** Decide the separator before one token. */
  const separatorBefore = (piece: FormatPiece): boolean => {
    if (piece.kind !== "token") return current.trim().length > 0;
    const text = piece.text;
    if (current.trim().length === 0) return false;
    if (tightBefore(text) || previousUnary) return false;
    if (previous === null) return false;
    if (previous.kind !== "token") return true;
    if (tightAfter(previous.text)) return false;
    if (text === "(") {
      return previous.category === "word" && CONTROL_KEYWORDS.has(previous.text);
    }
    if (text === "[") {
      return !(previous.kind === "token" && previous.category === "word");
    }
    if (text === "{") return true;
    if (text === ".") return false;
    if (previous.text === ",") return true;
    if (previous.text === ":") return true;
    if (BINARY_OPERATORS.has(text) || BINARY_OPERATORS.has(previous.text)) return true;
    if (wordLike(previous) && wordLike(piece)) return true;
    return false;
  };

  for (let position = 0; position < scanned.length; position += 1) {
    const { piece, newlinesBefore, blankLineBefore } = scanned[position]!;
    const next = scanned[position + 1]?.piece;
    if (blankLineBefore && current.trim().length === 0) {
      pendingBlank = true;
      flush();
    }

    if (piece.kind === "line-comment") {
      append(piece.text, current.trim().length > 0);
      flush();
      previous = piece;
      previousUnary = false;
      continue;
    }
    if (piece.kind === "block-comment") {
      if (newlinesBefore > 0 || current.trim().length === 0) {
        flush();
        append(piece.text, false);
      } else {
        append(piece.text, true);
      }
      if (piece.multiline) flush();
      previous = piece;
      previousUnary = false;
      continue;
    }

    const text = piece.text;
    if (text === "}") {
      if (pendingEmptyBlock) {
        append("}", false);
        pendingEmptyBlock = false;
        previous = piece;
        previousUnary = false;
        continue;
      }
      indent = Math.max(0, indent - 1);
      flush();
      append("}", false);
      if (
        next !== undefined &&
        next.kind === "token" &&
        next.text !== "else" &&
        next.text !== "while" &&
        next.text !== ";" &&
        next.text !== "," &&
        next.text !== ")"
      ) {
        flush();
      }
      previous = piece;
      previousUnary = false;
      continue;
    }
    if (text === "{") {
      append("{", separatorBefore(piece));
      if (next?.kind === "token" && next.text === "}") {
        pendingEmptyBlock = true;
      } else {
        indent += 1;
        flush();
      }
      previous = piece;
      previousUnary = false;
      continue;
    }
    if (text === ";") {
      append(";", false);
      if (parenDepth === 0) flush();
      else append("", true);
      previous = piece;
      previousUnary = false;
      previousWasCaseLabel = false;
      continue;
    }
    if (text === "(") {
      parenDepth += 1;
      append("(", separatorBefore(piece));
      previous = piece;
      previousUnary = false;
      continue;
    }
    if (text === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      append(")", false);
      previous = piece;
      previousUnary = false;
      continue;
    }
    if (text === ":") {
      append(":", false);
      if (previousWasCaseLabel) {
        flush();
        previousWasCaseLabel = false;
      }
      previous = piece;
      previousUnary = false;
      continue;
    }
    if (text === "case" || text === "default") {
      if (current.trim().length > 0) flush();
      lineIndent = Math.max(0, indent - 1);
      append(text, false);
      previous = piece;
      previousUnary = false;
      previousWasCaseLabel = true;
      continue;
    }
    if (text === "else" && previous?.kind === "token" && previous.text === "}") {
      append("else", true);
      previous = piece;
      previousUnary = false;
      previousWasCaseLabel = false;
      continue;
    }
    if (text === "while" && previous?.kind === "token" && previous.text === "}") {
      append("while", true);
      previous = piece;
      previousUnary = false;
      previousWasCaseLabel = false;
      continue;
    }
    if (newlinesBefore > 0 && current.trim().length > 0) flush();

    const unary = piece.category === "operator" && isUnary(text, previous);
    append(text, separatorBefore(piece));
    previous = piece;
    previousUnary = unary;
    previousWasCaseLabel = false;
  }
  flush();
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return { kind: "formatted", text: lines.length === 0 ? "" : lines.join("\n") + "\n" };
}
