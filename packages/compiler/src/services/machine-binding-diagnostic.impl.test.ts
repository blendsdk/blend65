import { describe, expect, it } from "vitest";
import { machineProgramDefect } from "../machine/machine-defect.js";
import type { MachineFunction, MachineProgram } from "../machine/machine-types.js";
import type { SourceSpan } from "../project/types.js";
import { machineBindingDiagnostic } from "./machine-binding-diagnostic.js";

/**
 * When the compiler gives up on a program it still has to say where.
 *
 * An author working on a machine with no debugger cannot act on a stage name, and cannot report
 * a defect they are unable to locate. These cases judge the refusal an author actually receives:
 * that it carries the construct's own location, names the failing instruction, and says plainly
 * that it reports a limitation of the compiler rather than a mistake on the line it points at.
 *
 * They are written against the presence and the content of the location rather than an exact
 * offset. Which internal check reports first follows a work-list order — deterministic for a
 * given program, but not canonical — so pinning an offset would make an unrelated and correct
 * change look like a regression.
 */

/** A span proves the refusal points at the construct rather than at a default location. */
const span: SourceSpan = { sourceId: "src/game.blend", start: 125, end: 140 };

/** The function an author wrote, named as the source spells it. */
const owner: MachineFunction = { id: "fn.main", sourceName: "Game.main", blocks: [] };

const program: MachineProgram = {
  startup: { id: "startup", blocks: [] },
  functions: [owner],
  data: [],
  requiredStorage: [],
};

/**
 * The refusal for a flag consumer whose producer no path establishes.
 *
 * This is the shape a real failure takes: an addition selected from the author's source, in a
 * generated block, with the flag it reads named in the reason.
 */
function flagProofRefusal() {
  return machineBindingDiagnostic({
    program,
    defect: machineProgramDefect({
      stage: "machine flag proof",
      reason: "the selected 'adc' has no proved producer for its decimal flag",
      functionId: owner.id,
      label: "fn.main.entry",
      instruction: { opcode: "adc", source: span },
    }),
    fallbackSpan: null,
  });
}

describe("a machine-stage refusal reports where it gave up", () => {
  it("should carry the failing construct's own source location", () => {
    const diagnostic = flagProofRefusal();

    expect(diagnostic.code).toBe("COMPILER_INCOMPLETE");
    expect(
      diagnostic.primarySpan,
      "a refusal with no location leaves nothing to act on",
    ).not.toBeNull();
    expect(diagnostic.primarySpan).toEqual(span);
  });

  it("should name the construct it failed on rather than only the stage", () => {
    // Naming the owning function and the selected instruction is what makes the message
    // actionable. A bare stage name could describe any program at all.
    const { message } = flagProofRefusal();

    expect(message).toContain("main");
    expect(message.toLowerCase()).toContain("adc");
  });

  it("should say plainly that it reports a compiler limitation, not a bad line", () => {
    // A caret under correct source invites the author to edit a line that is not wrong, so the
    // message has to carry that disclaimer with it.
    const { help } = flagProofRefusal();

    expect(help, "a located limitation must explain that the line is not at fault").not.toBeNull();
    expect((help ?? "").toLowerCase()).toContain("compiler limitation");
  });

  it("should keep the generated block identity out of the primary sentence", () => {
    // A generated label is evidence for whoever receives a bug report and means nothing to
    // whoever wrote the program, so it belongs in the help line and nowhere else.
    const diagnostic = flagProofRefusal();

    expect(diagnostic.message).not.toContain("fn.main.entry");
    expect(diagnostic.help ?? "").toContain("fn.main.entry");
  });

  it("should name no internal planning identifier in anything the author reads", () => {
    const diagnostic = flagProofRefusal();
    const shown = `${diagnostic.message} ${diagnostic.help ?? ""} ${diagnostic.pointer ?? ""}`;

    expect(shown, "user-facing text must not leak an internal tracking identifier").not.toMatch(
      /\b(?:RD|AR|T)-\d+|\bissues?\/\d+|#\d{2,}/u,
    );
  });

  it("should still report the stage when a refusal carries no failed check", () => {
    // A storage refusal records its witness elsewhere, so this one has no construct to name.
    // What it may not do is change which code an author sees for a compiler that gave up.
    const diagnostic = machineBindingDiagnostic({ program, defect: undefined, fallbackSpan: null });

    expect(diagnostic.code).toBe("COMPILER_INCOMPLETE");
    expect(diagnostic.message).toContain("machine storage binding");
  });
});
