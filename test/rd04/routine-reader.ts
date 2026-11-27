/**
 * Read one generated routine's instructions from emitted assembly.
 *
 * Labels, origin directives and comments are dropped, the assembler's operand
 * width hint is removed and generated label identities are collapsed, so
 * nothing read here depends on a chosen address or encoding.
 *
 * A routine that ends without leaving by itself falls into whatever is placed
 * next. That is reported as a last line `falls into <label>` only when the
 * label really begins at the address where the routine ends, which is worked
 * out from the origin directives and the length of every instruction between
 * them. A routine that merely precedes another label in the text, with a gap
 * between them, gets no such line.
 */

/** Branch mnemonics, all two bytes long. */
const BRANCHES = new Set(["bcc", "bcs", "beq", "bne", "bmi", "bpl", "bvc", "bvs"]);

/**
 * Encoded length of one emitted NMOS 6502 instruction line.
 * @param text One instruction line without its comment.
 * @returns Its length in bytes.
 * @example
 * encodedLength("lda+1 $02"); // 2
 */
export function encodedLength(text: string): number {
  const match = /^([a-z]{3})(\+[12])?\s*(.*)$/u.exec(text.trim());
  if (match === null) throw new Error(`Unreadable instruction: ${text}`);
  const [, mnemonic, hint, operand] = match;
  if (operand === "" || operand === "a") return 1;
  if (BRANCHES.has(mnemonic!)) return 2;
  if (operand!.startsWith("#")) return 2;
  if (hint === "+1") return 2;
  if (hint === "+2" || mnemonic === "jmp" || mnemonic === "jsr") return 3;
  if (operand!.startsWith("(")) return 2;
  return /^\$[0-9a-f]{1,2}(,[xy])?$/iu.test(operand!) ? 2 : 3;
}

/** Collapse generated label identities and drop the width hint. */
function normalized(text: string): string {
  return text.replace(/^(\w+)\+\d+/u, "$1").replace(/_[0-9a-f]{8}[0-9a-f]*/gu, "_");
}

/**
 * Instructions of the routine `Game.<name>` in emitted assembly.
 * @param assembly Complete emitted assembly text.
 * @param name Source function name inside module `Game`.
 * @param allowEmpty Whether a routine with no instructions of its own is accepted.
 * @returns The routine's normalized instruction lines.
 * @example
 * const body = routineBody(assembly, "use");
 */
export function routineBody(assembly: string, name: string, allowEmpty = false): string[] {
  const body: string[] = [];
  let inside = false;
  let cursor: number | undefined;
  let end: number | undefined;
  for (const line of assembly.split("\n")) {
    const text = line.replace(/;.*$/u, "").trim();
    const origin = /^\*\s*=\s*\$([0-9a-f]+)$/iu.exec(text);
    if (origin !== null) {
      // The address the previous bytes ended at, and where the next ones start.
      end = cursor;
      cursor = Number.parseInt(origin[1]!, 16);
      continue;
    }
    if (new RegExp(`^b65_Game_${name}_`, "u").test(line)) {
      inside = true;
      end = cursor;
      continue;
    }
    if (/^b65_/u.test(line)) {
      if (!inside) continue;
      if (line.includes(`_${name}_`)) {
        end = cursor;
        continue;
      }
      const leaves = /^(rts|rti|jmp) /u.test(`${body.at(-1) ?? ""} `);
      if (!leaves && end !== undefined && end === cursor && (body.length > 0 || allowEmpty))
        body.push(`falls into ${normalized(line.replace(/:.*$/u, ""))}`);
      break;
    }
    if (!inside || text.length === 0 || text.startsWith("!")) continue;
    body.push(normalized(text));
    if (cursor !== undefined) cursor += encodedLength(text);
    end = cursor;
  }
  if (body.length === 0) throw new Error(`Missing generated routine Game.${name}`);
  return body;
}
