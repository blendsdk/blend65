import { describe, expect, it } from "vitest";
import { acmeLabelName, acmeLabelNames } from "./acme-labels.js";

describe("readable ACME label identities", () => {
  it("keeps equal display names distinct and escapes directive-shaped input", () => {
    const hint = "main\n!binary evil\r: ";
    const first = acmeLabelName("file:a", hint);
    const second = acmeLabelName("file/a", hint);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^b65_main_[A-Za-z0-9_]+$/);
    expect(second).toMatch(/^b65_main_[A-Za-z0-9_]+$/);
  });

  it("keeps the source entry label when its first block shares the identity", () => {
    const names = acmeLabelNames({
      startup: { id: "startup", blocks: [] },
      functions: [
        {
          id: "fn.1",
          sourceName: "Game.main",
          blocks: [{ label: "fn.1", instructions: [], terminator: { kind: "return" } }],
        },
      ],
      data: [],
      requiredStorage: [],
    });
    expect(names.get("fn.1")).toBe(acmeLabelName("fn.1", "Game.main"));
  });
});
