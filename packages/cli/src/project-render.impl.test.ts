import type { ProjectDiagnostic } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { escapeTerminalText, renderDiagnostics } from "./render.js";

describe("terminal rendering boundary", () => {
  it("should escape controls while preserving ordinary Unicode text", () => {
    expect(escapeTerminalText("Game Ω\n\t\u001b\u009b")).toBe("Game ΩU+000AU+0009U+001BU+009B");
  });

  it("should render byte locations warnings related proof and help without reading input", () => {
    const diagnostic: ProjectDiagnostic = {
      code: "PROJECT_HOST_BEST_EFFORT",
      severity: "warning",
      message: "Safe\nmessage",
      primarySpan: { sourceId: "src/Ω.blend", start: 3, end: 7 },
      related: [{ span: { sourceId: "blend65.json", start: 1, end: 2 }, message: "First\tvalue" }],
      pointer: "/name",
      help: "Choose\u001b a value",
    };
    expect(renderDiagnostics([diagnostic])).toBe(
      "warning[PROJECT_HOST_BEST_EFFORT]: SafeU+000Amessage\n" +
        "  --> src/Ω.blend:bytes 3..7\n" +
        "  field: /name\n" +
        "  related: blend65.json:bytes 1..2: FirstU+0009value\n" +
        "  help: ChooseU+001B a value\n",
    );
    expect(renderDiagnostics([])).toBe("");
  });
});
