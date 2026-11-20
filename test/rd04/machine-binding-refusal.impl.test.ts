import { buildProject, checkProject } from "@blend65/compiler";
import type { BuildResult, CheckResult, ProjectDiagnostic } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";

const target = "c64-pal-prg-kernal-6581";

/**
 * When the compiler gives up on a program it still has to say where. An author working on a
 * machine with no debugger cannot act on a stage name, and cannot report a defect they are
 * unable to locate.
 *
 * These cases are deliberately written against the *presence* and *placement* of a location
 * rather than its exact offset. Which internal check reports first follows a work-list order:
 * deterministic for a given program, but not canonical, so pinning an offset would make an
 * unrelated and correct change look like a regression.
 */

/**
 * A legal program the compiler currently refuses. The callee never reaches its own end, so it
 * preserves no processor state, and the addition afterwards is left with no proved producer for
 * the flags it reads. Everything after the call is unreachable, which is legal — so this is a
 * compiler limitation rather than a mistake in the source.
 */
const refusedSource = `module Game;
function spin(): void { while (true) { } }
function main(): void {
  spin();
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
`;

/** The single error a refusal must report, failing loudly if the shape is not what it was. */
function soleError(result: BuildResult | CheckResult): ProjectDiagnostic {
  expect(result.kind, "this program is expected to be refused, not accepted").toBe("failure");
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  expect(
    errors.length,
    `expected exactly one error, got ${JSON.stringify(result.diagnostics)}`,
  ).toBe(1);
  return errors[0]!;
}

describe("a machine-stage refusal reports where it gave up", () => {
  it("should carry a source span inside the program's own source", async () => {
    await withProfileProject(refusedSource, target, async (project) => {
      const error = soleError(await buildProject({ project, optimization: "none" }));

      expect(error.code).toBe("COMPILER_INCOMPLETE");
      expect(error.primarySpan, "a refusal with no location leaves nothing to act on").not.toBe(
        null,
      );
      const span = error.primarySpan;
      if (span === null) throw new Error("The refusal carried no span");

      expect(span.sourceId, "the span must name the file the author wrote").toContain(".blend");
      expect(span.end, "a span must cover at least one character").toBeGreaterThan(span.start);
      expect(
        span.end,
        "the span must fall inside the source rather than past its end",
      ).toBeLessThanOrEqual(refusedSource.length);
    });
  });

  it("should name the construct it failed on rather than only the stage", async () => {
    await withProfileProject(refusedSource, target, async (project) => {
      const error = soleError(await buildProject({ project, optimization: "none" }));

      // Naming the owning function and the selected instruction is what makes the message
      // actionable; the previous wording named only the stage and could have described any
      // program at all.
      expect(error.message).toContain("main");
      expect(error.message.toLowerCase()).toContain("adc");
    });
  });

  it("should say plainly that it reports a compiler limitation, not a bad line", async () => {
    await withProfileProject(refusedSource, target, async (project) => {
      const error = soleError(await buildProject({ project, optimization: "none" }));

      // A caret under correct source invites the author to edit a line that is not wrong, so
      // the message has to carry that disclaimer with it.
      expect(
        error.help,
        "a located limitation must explain that the line is not at fault",
      ).not.toBe(null);
      expect((error.help ?? "").toLowerCase()).toContain("compiler limitation");
    });
  });

  it("should name no internal planning identifier in anything the author reads", async () => {
    await withProfileProject(refusedSource, target, async (project) => {
      const error = soleError(await buildProject({ project, optimization: "none" }));
      const shown = `${error.message} ${error.help ?? ""} ${error.pointer ?? ""}`;

      expect(shown, "user-facing text must not leak an internal tracking identifier").not.toMatch(
        /\b(?:RD|AR|T)-\d+|\bissues?\/\d+|#\d{2,}/u,
      );
    });
  });

  it("should refuse the same way under check as under build", async () => {
    await withProfileProject(refusedSource, target, async (project) => {
      const checked = soleError(await checkProject({ project }));

      // An author told a program is fine must not then be refused by the build, and the
      // location they are given must not depend on which service they asked.
      expect(checked.code).toBe("COMPILER_INCOMPLETE");
      expect(checked.primarySpan).not.toBe(null);
    });
  });
});
