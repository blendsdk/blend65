import { describe, expect, it } from "vitest";

import { emitAsm } from "./emit.js";
import { memHost } from "./test-fixtures.js";

/** Returns the executable instruction lines emitted for one function. */
function functionInstructions(assembly: string, functionName: string): readonly string[] {
  const marker = `; --- function: Main.${functionName} ---`;
  const start = assembly.indexOf(marker);
  if (start < 0) throw new Error(`assembly has no function section '${functionName}'`);
  const remainder = assembly.slice(start + marker.length);
  const nextSection = remainder.indexOf("; --- function:");
  const section = nextSection < 0 ? remainder : remainder.slice(0, nextSection);
  return section
    .split("\n")
    .filter((line) => /^\s+[A-Z]{3}\b/u.test(line))
    .map((line) => line.trim());
}

describe("single-call direct-memory assembly", () => {
  it("should retain direct absolute instructions for constant-specialized parameters", () => {
    const source = [
      "module Main;",
      "function readByte(address: word): byte { return peek(address); }",
      "function readWord(address: word): word { return peekw(address + 1); }",
      "function writeByte(address: word, value: byte): void { poke(address + 2, value); }",
      "function writeWord(address: word, value: word): void { pokew(address + 3, value); }",
      "function main(): void {",
      "  readByte($D020);",
      "  readWord($D020);",
      "  writeByte($D020, 32);",
      "  writeWord($D020, 8192);",
      "}",
    ].join("\n");
    const result = emitAsm(
      { platform: "c64", cwd: "/virtual", sourceFiles: ["main.blend"] },
      memHost({ "main.blend": source }),
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBeDefined();
    const assembly = result.text ?? "";
    expect(functionInstructions(assembly, "readByte")).toEqual(["LDA $D020", "RTS"]);
    expect(functionInstructions(assembly, "readWord")).toEqual(["LDA $D021", "LDX $D021+1", "RTS"]);
    expect(functionInstructions(assembly, "writeByte")).toEqual([
      "LDA __frame_Main_writeByte_value",
      "STA $D022",
      "RTS",
    ]);
    expect(functionInstructions(assembly, "writeWord")).toEqual([
      "LDA __frame_Main_writeWord_value",
      "LDX __frame_Main_writeWord_value+1",
      "STA $D023",
      "STX $D023+1",
      "RTS",
    ]);
    const mainInstructions = functionInstructions(assembly, "main");
    expect(mainInstructions).not.toContain("STA __frame_Main_readByte_address");
    expect(mainInstructions).not.toContain("STX __frame_Main_readByte_address+1");
    expect(mainInstructions).not.toContain("STA __frame_Main_readWord_address");
    expect(mainInstructions).not.toContain("STX __frame_Main_readWord_address+1");
    expect(mainInstructions).not.toContain("STA __frame_Main_writeByte_address");
    expect(mainInstructions).not.toContain("STX __frame_Main_writeByte_address+1");
    expect(mainInstructions).not.toContain("STA __frame_Main_writeWord_address");
    expect(mainInstructions).not.toContain("STX __frame_Main_writeWord_address+1");
    expect(assembly).not.toMatch(/\(\$[0-9A-F]{2}\),Y/u);
  });

  it("should wrap the high byte of a word store from $FFFF to $0000", () => {
    const source = [
      "module Main;",
      "function writeConstant(): void { pokew($FFFF, $1234); }",
      "function writeRuntime(value: word): void { pokew($FFFF, value); }",
      "function handler(): void {}",
      "function writeAddress(): void { pokew($FFFF, &handler); }",
      "function main(): void { writeConstant(); writeRuntime($1234); writeAddress(); }",
    ].join("\n");
    const result = emitAsm(
      { platform: "c64", cwd: "/virtual", sourceFiles: ["main.blend"] },
      memHost({ "main.blend": source }),
    );

    expect(result.diagnostics).toEqual([]);
    const assembly = result.text ?? "";
    expect(functionInstructions(assembly, "writeConstant")).toEqual([
      "LDA #$34",
      "STA $FFFF",
      "LDA #$12",
      "STA $0",
      "RTS",
    ]);
    expect(functionInstructions(assembly, "writeRuntime")).toEqual([
      "LDA __frame_Main_writeRuntime_value",
      "LDX __frame_Main_writeRuntime_value+1",
      "STA $FFFF",
      "STX $0",
      "RTS",
    ]);
    expect(functionInstructions(assembly, "writeAddress")).toEqual([
      "LDA #<Main_handler",
      "STA $FFFF",
      "LDA #>Main_handler",
      "STA $0",
      "RTS",
    ]);
  });
});
