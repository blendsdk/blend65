import { UNKNOWN_MACHINE_SITE, type MachineProgramDefect } from "../machine/machine-defect.js";
import type { MachineProgram } from "../machine/machine-types.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import { sourceObjectName } from "./resource-diagnostics.js";

/** Stage name, spelled once so the message and the established fallback cannot drift apart. */
const STAGE = "machine storage binding";

/** Inputs for one refusal from binding storage into the selected machine program. */
export interface MachineBindingFailure {
  /** Machine program that was bound, used to name the function the defect belongs to. */
  readonly program: MachineProgram;
  /** Failed check, absent when the refusal came from storage rather than from validation. */
  readonly defect: MachineProgramDefect | undefined;
  /** Location to point at when the failing construct carries no source of its own. */
  readonly fallbackSpan: SourceSpan | null;
}

/**
 * Name the function a defect belongs to the way the source spells it.
 *
 * Generated functions need not carry a display name, and startup code has no source at all.
 * Both cases return null so the message can name the stage instead of inventing a construct;
 * a link identity is evidence for a bug report, not something an author can look up.
 */
function definingFunctionName(program: MachineProgram, functionId: string): string | null {
  if (functionId === program.startup.id) return null;
  const owner = program.functions.find((fn) => fn.id === functionId);
  return owner?.sourceName === undefined ? null : sourceObjectName(owner, null);
}

/**
 * Explain why machine storage binding refused a program the compiler cannot finish.
 *
 * The refusal reports a limitation of the compiler, not a mistake on the line it points at, and
 * the message says so: a caret under correct source would otherwise send an author off editing
 * code that is fine. The construct is named because the alternative — a bare stage name with no
 * location — leaves nothing to act on, report or work around on a machine with no debugger.
 *
 * Generated block and function identities stay in the help line. They mean something to whoever
 * receives a bug report and nothing to whoever wrote the program.
 *
 * @param failure The bound program, the failed check when one was recorded, and a fallback span.
 * @returns The compiler-stage diagnostic for this refusal.
 * @example machineBindingDiagnostic({ program, defect: result.defect, fallbackSpan: null })
 */
export function machineBindingDiagnostic(failure: MachineBindingFailure): ProjectDiagnostic {
  const { defect } = failure;
  // A refusal with no failed check disagrees with the program as a whole rather than with one of
  // its constructs, so the established program-scoped wording stays. A generated failure with no
  // source expression is still reported at the responsible declaration when one exists, which is
  // the program entry its caller supplies; the help line says that the location is the entry
  // rather than a construct that caused the failure, so the caret cannot be read as blame.
  if (defect === undefined)
    return projectDiagnostic(
      "COMPILER_INCOMPLETE",
      `The ${STAGE} stage is not complete for this program`,
      failure.fallbackSpan,
      null,
      [],
      failure.fallbackSpan === null
        ? `Compiler limitation in the ${STAGE} stage, with no source construct to name; please report it`
        : `Compiler limitation in the ${STAGE} stage, shown at the program entry rather than at a construct that caused it; please report it with the source shown`,
    );
  const name = definingFunctionName(failure.program, defect.functionId);
  const subject =
    name !== null
      ? `'${name}'`
      : defect.functionId === failure.program.startup.id
        ? "generated startup code"
        : "generated code";
  const span = defect.source ?? failure.fallbackSpan;
  // The refusal names the obligation that actually failed. Proving flag producers and finding
  // storage homes fail for unrelated reasons, and announcing one as the other misdirects both
  // the author and whoever reads the report.
  const stage = defect.stage;
  // Without a span of its own the failing construct cannot be claimed to be "here", so the
  // message names the stage rather than suggesting the pointed-at line selected the instruction.
  const message =
    defect.source === null
      ? `The ${stage} stage did not complete for ${subject} — ${defect.reason}`
      : `${stage.charAt(0).toUpperCase()}${stage.slice(1)} did not complete for ${subject} — ${defect.reason}`;
  // The block label already embeds the owning function, so the link identity is added only
  // when nothing else in the message identifies the function.
  const block =
    defect.blockLabel === UNKNOWN_MACHINE_SITE
      ? `the ${stage} stage`
      : name !== null
        ? `generated block '${defect.blockLabel}'`
        : `generated block '${defect.blockLabel}' of '${defect.functionId}'`;
  // Someone reading a report needs the selected opcode without having to parse the sentence,
  // so it is stated here rather than left to the prose that explains the failure.
  const site = defect.opcode === null ? block : `${block} at '${defect.opcode}'`;
  const help =
    span === null
      ? `Compiler limitation in ${site}; please report it`
      : `Compiler limitation in ${site}, not an error on this line; please report it with the source shown`;
  return projectDiagnostic("COMPILER_INCOMPLETE", message, span, null, [], help);
}
