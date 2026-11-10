import { describe, expect, it } from "vitest";
import { parseProjectStatus, statusText } from "./status.js";

describe("VS Code project status", () => {
  it("should parse the version-one status notification and render truthful states", () => {
    const ready = parseProjectStatus({
      kind: "blend65.projectStatus",
      schemaVersion: 1,
      state: "ready",
      projectName: "game",
      profileId: "c64-pal-prg-kernal-6581",
      documentUri: "file:///project/src/game.blend",
    });
    expect(ready).not.toBeNull();
    expect(statusText(ready!)).toBe("Blend65: ready — game · c64-pal-prg-kernal-6581");
    expect(statusText({ ...ready!, state: "analyzing" })).toBe("Blend65: analyzing…");
    expect(statusText({ ...ready!, state: "error" })).toBe("Blend65: error");
    expect(statusText({ ...ready!, state: "no-project" })).toBe("Blend65: no project");
  });

  it("should reject malformed status payloads", () => {
    expect(parseProjectStatus(null)).toBeNull();
    expect(parseProjectStatus({ kind: "other", schemaVersion: 1, state: "ready" })).toBeNull();
    expect(parseProjectStatus({ kind: "blend65.projectStatus", schemaVersion: 2 })).toBeNull();
    expect(
      parseProjectStatus({
        kind: "blend65.projectStatus",
        schemaVersion: 1,
        state: "unknown",
        projectName: null,
        profileId: null,
        documentUri: null,
      }),
    ).toBeNull();
  });
});
