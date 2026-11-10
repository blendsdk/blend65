import { describe, expect, it } from "vitest";
import { formatBlend65 } from "@blend65/compiler/frontend";

const SOURCE = [
  "module Game;",
  "",
  "// counter comment",
  "let counter:byte=1;",
  "const NAME: byte[3] = [65, 66, 67];",
  "",
  "/* block comment */",
  "function main():void{",
  "counter=counter+1;",
  "if(counter>2){counter=0;}",
  "else{counter=1;}",
  "}",
  "",
].join("\n");

/** Extract tokens and comments while ignoring whitespace. */
function tokens(text: string): string[] {
  return (
    text.match(
      /\/\/[^\n\r]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\$[0-9A-Fa-f_]+|0[xX][0-9A-Fa-f_]+|0[bB][01_]+|[A-Za-z_][A-Za-z0-9_]*|[0-9][0-9_]*|<<=|>>=|&&|\|\||==|!=|<=|>=|<<|>>|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|[-+*/%&|^~!=<>?:;,.(){}[\]]/gu,
    ) ?? []
  );
}

describe("canonical formatter", () => {
  it("should format a complete document canonically and idempotently", () => {
    const first = formatBlend65(SOURCE);
    expect(first.kind).toBe("formatted");
    if (first.kind !== "formatted") return;
    expect(first.text).toBe(
      [
        "module Game;",
        "",
        "// counter comment",
        "let counter: byte = 1;",
        "const NAME: byte[3] = [65, 66, 67];",
        "",
        "/* block comment */",
        "function main(): void {",
        "    counter = counter + 1;",
        "    if (counter > 2) {",
        "        counter = 0;",
        "    } else {",
        "        counter = 1;",
        "    }",
        "}",
        "",
      ].join("\n"),
    );
    const second = formatBlend65(first.text);
    expect(second.kind).toBe("formatted");
    if (second.kind === "formatted") expect(second.text).toBe(first.text);
  });

  it("should preserve every non-trivia token and comment", () => {
    const formatted = formatBlend65(SOURCE);
    expect(formatted.kind).toBe("formatted");
    if (formatted.kind !== "formatted") return;
    expect(tokens(formatted.text)).toEqual(tokens(SOURCE));
    expect(formatted.text).toContain("// counter comment");
    expect(formatted.text).toContain("/* block comment */");
  });

  it("should normalize CRLF and tabs and preserve astral content", () => {
    const source = "module Game;\r\n\t// 🎮\r\nlet x:byte=1;\r\n";
    const formatted = formatBlend65(source);
    expect(formatted.kind).toBe("formatted");
    if (formatted.kind !== "formatted") return;
    expect(formatted.text).not.toContain("\r");
    expect(formatted.text).not.toContain("\t");
    expect(formatted.text).toContain("🎮");
    expect(formatBlend65(formatted.text)).toEqual(formatted);
  });

  it("should handle empty and comment-only documents", () => {
    expect(formatBlend65("")).toEqual({ kind: "formatted", text: "" });
    const comment = formatBlend65("// only\n");
    expect(comment).toEqual({ kind: "formatted", text: "// only\n" });
  });

  it("should keep indentation after an empty nested block", () => {
    const source = ["function main(): void {", "    while (true) { }", "    let x: byte = 1;", "}", ""].join("\n");
    const formatted = formatBlend65(source);
    expect(formatted.kind).toBe("formatted");
    if (formatted.kind !== "formatted") return;
    expect(formatted.text).toContain("    while (true) {}");
    expect(formatted.text).toContain("    let x: byte = 1;");
    expect(formatBlend65(formatted.text)).toEqual(formatted);
  });

  it("should refuse unterminated comments and literals", () => {
    expect(formatBlend65("/*").kind).toBe("unsupported");
    expect(formatBlend65('"unterminated').kind).toBe("unsupported");
    expect(formatBlend65("'x").kind).toBe("unsupported");
  });
});
