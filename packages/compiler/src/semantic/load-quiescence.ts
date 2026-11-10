import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import type { SemanticProgram } from "./operations.js";

/** One active user route tracked at a load call. */
interface ActiveRoute {
  readonly domain: "irq" | "nmi";
  readonly command: string;
  readonly span: import("../project/types.js").SourceSpan;
}

/**
 * Reject a load while a user-installed IRQ or NMI route is still active.
 *
 * This is the conservative linear proof for the first loader slice: a set/install command must be
 * followed by its matching restore before the call. Mainline audio ticks cannot run during the
 * blocking transfer, so they need no separate route state here.
 */
export function checkLoadQuiescence(program: SemanticProgram): ProjectDiagnostic | null {
  for (const fn of program.functions) {
    let irq: ActiveRoute | null = null;
    let nmi: ActiveRoute | null = null;
    for (const block of fn.blocks) {
      for (const operation of block.operations) {
        if (operation.kind === "platform") {
          if (
            operation.capability === "c64.system.setIRQ" ||
            operation.capability === "c64.system.setIRQExclusive"
          ) {
            irq = {
              domain: "irq",
              command: operation.capability,
              span: operation.span,
            };
          } else if (operation.capability === "c64.system.restoreIRQ") {
            irq = null;
          } else if (
            operation.capability === "c64.system.setNMI" ||
            operation.capability === "c64.system.setNMIExclusive"
          ) {
            nmi = {
              domain: "nmi",
              command: operation.capability,
              span: operation.span,
            };
          } else if (operation.capability === "c64.system.restoreNMI") {
            nmi = null;
          }
        }
        if (operation.kind !== "load-unit") continue;
        const active = irq ?? nmi;
        if (active === null) continue;
        const restore = active.domain === "irq" ? "restoreIRQ" : "restoreNMI";
        return projectDiagnostic(
          "E10275",
          `Cannot load unit '${operation.unitId}' — the user ${active.domain.toUpperCase()} route '${active.command}' is still active at the call; call ${restore} (and stop any audio/player route) before loading`,
          operation.span,
          null,
          [
            {
              span: active.span,
              message: `Active ${active.domain.toUpperCase()} route is installed here`,
            },
          ],
        );
      }
    }
  }
  return null;
}
