import { describe, expect, it } from "vitest";

import { DiagCode, renderJson } from "@blend65/core";
import { compile } from "./compile.js";
import { compileWithEvidence, emitAsmWithEvidence, emitIlWithEvidence } from "./evidence-facade.js";
import { GATE_SRC, memHost } from "./test-fixtures.js";
import type { CompilerOptions } from "./options.js";

describe("compiler diagnostic evidence façade", () => {
  it("joins a promoted lexer warning to its final severity without changing diagnostics", () => {
    const source = "module Main;\nfunction main(): void { poke(0xD020, 05); }\n";
    const options: CompilerOptions = {
      platform: "c64",
      cwd: "/project",
      sourceFiles: ["main.blend"],
      warnAsError: true,
    };
    const ordinary = compile(options, memHost({ "main.blend": source }));
    const observed = compileWithEvidence(options, memHost({ "main.blend": source }));

    expect(renderJson(observed.result.diagnostics)).toBe(renderJson(ordinary.diagnostics));
    expect(observed.evidence.entries).toEqual([
      expect.objectContaining({
        code: DiagCode.NumericLeadingZeros,
        phase: "lexer",
        finalSeverity: "error",
      }),
    ]);
  });

  it("omits suppressed accepted warnings from final evidence", () => {
    const source = "module Main;\nfunction main(): void { poke(0xD020, 05); }\n";
    const observed = compileWithEvidence(
      {
        platform: "c64",
        cwd: "/project",
        sourceFiles: ["main.blend"],
        suppressWarnings: [DiagCode.NumericLeadingZeros],
      },
      memHost({ "main.blend": source }),
    );
    expect(observed.result.diagnostics).toEqual([]);
    expect(observed.evidence.entries).toEqual([]);
  });

  it("records parser and semantic entries at their real active phases", () => {
    const parser = compileWithEvidence(
      { platform: "c64", cwd: "/project", sourceFiles: ["main.blend"] },
      memHost({ "main.blend": "module Main\nfunction main(): void { }\n" }),
    );
    expect(parser.evidence.entries.some((entry) => entry.phase === "parser")).toBe(true);

    const semantic = compileWithEvidence(
      { platform: "c64", cwd: "/project", sourceFiles: ["main.blend"] },
      memHost({ "main.blend": "module Main;\nfunction main(): void { missing(); }\n" }),
    );
    expect(semantic.evidence.entries.some((entry) => entry.phase === "semantic")).toBe(true);
  });

  it("returns unique accepted identities for capped diagnostics only", () => {
    const source = "module Main;\nfunction main(): void {\n@\n@\n@\n@\n}\n";
    const observed = compileWithEvidence(
      {
        platform: "c64",
        cwd: "/project",
        sourceFiles: ["main.blend"],
        maxErrors: 2,
      },
      memHost({ "main.blend": source }),
    );
    expect(observed.evidence.entries.map((entry) => entry.code)).toEqual(
      observed.result.diagnostics.map((diagnostic) => diagnostic.code),
    );
    expect(new Set(observed.evidence.entries.map((entry) => entry.acceptedEntryId)).size).toBe(
      observed.evidence.entries.length,
    );
  });

  it("runs both partial emit façades once and keeps ordinary result shapes", () => {
    const options: CompilerOptions = {
      platform: "c64",
      cwd: "/project",
      sourceFiles: ["main.blend"],
    };
    const il = emitIlWithEvidence(options, memHost({ "main.blend": GATE_SRC }));
    const asm = emitAsmWithEvidence(options, memHost({ "main.blend": GATE_SRC }));
    expect(il.result.text).toContain("function Main.main");
    expect(asm.result.text).toContain("Main.main");
    expect(il.evidence.entries).toEqual([]);
    expect(asm.evidence.entries).toEqual([]);
    expect(il.result).not.toHaveProperty("evidence");
  });
});
