import { describe, expect, it } from "vitest";
import { artifactEvidenceDiagnostic } from "./artifact-evidence-diagnostic.js";

describe("an unexpected failure of artifact evidence preparation", () => {
  it("should keep the canonical message and carry the thrown cause in its help line", () => {
    // The failure this exists for. A compiler invariant breaking leaves the author's program
    // correct and the build dead, so the output has to name the stage and say what broke; the
    // canonical message stays put because callers already match on it.
    const diagnostic = artifactEvidenceDiagnostic({
      error: new Error("Final machine block has no semantic CFG owner"),
      stagingRetained: false,
    });

    expect(diagnostic).toMatchObject({
      code: "ARTIFACT_EVIDENCE",
      severity: "error",
      message: "Artifact evidence preparation failed",
      primarySpan: null,
      related: [],
      help: "Compiler limitation in artifact evidence preparation: Final machine block has no semantic CFG owner; please report it with the project shown",
    });
  });

  it("should let a retained staging directory own the message while still reporting the cause", () => {
    // Two facts compete for one message: evidence failed, and staging survived and needs recovery.
    // The second is the one a reader must act on first, so it keeps the message - but the cause
    // that produced it must not be destroyed on the way, which is what used to happen.
    const diagnostic = artifactEvidenceDiagnostic({
      error: new Error("EACCES: permission denied, open '/out/.memory.json'"),
      stagingRetained: true,
    });

    expect(diagnostic).toMatchObject({
      code: "ARTIFACT_EVIDENCE_CLEANUP",
      message: "Failed evidence left compiler-owned staging that requires recovery",
      help: "Compiler limitation in artifact evidence preparation: EACCES: permission denied, open '/out/.memory.json'; please report it with the project shown",
    });
  });

  it.each([
    ["a thrown string", "plain failure text", "plain failure text"],
    ["a thrown number", 42, "42"],
    ["a multi-line message", new Error("first line\n  second line"), "first line second line"],
  ])("should render %s as one reportable line", (_case, error, detail) => {
    // A throw is not required to be an Error, and a help line is not allowed to be a paragraph.
    // Whatever arrives is reduced to a single line so the console output stays readable.
    const diagnostic = artifactEvidenceDiagnostic({ error, stagingRetained: false });

    expect(diagnostic.help).toBe(
      `Compiler limitation in artifact evidence preparation: ${detail}; please report it with the project shown`,
    );
  });

  it.each([
    ["an empty message", new Error("")],
    ["whitespace only", new Error("   \n  ")],
    ["null", null],
    ["undefined", undefined],
    ["a value that cannot become a string", Object.create(null) as unknown],
  ])("should stay a usable diagnostic when the throw carries no detail: %s", (_case, error) => {
    // Degrading to a generic line is acceptable; throwing while building a diagnostic is not,
    // because it would replace a reported failure with a crash inside the error path itself.
    // A nullish throw belongs here rather than among the renderable values: `null` would print
    // cleanly and still tell its reader less than admitting there was no detail.
    const diagnostic = artifactEvidenceDiagnostic({ error, stagingRetained: false });

    expect(diagnostic).toMatchObject({
      code: "ARTIFACT_EVIDENCE",
      message: "Artifact evidence preparation failed",
      help: "Compiler limitation in artifact evidence preparation, which threw no reportable detail; please report it",
    });
  });
});
