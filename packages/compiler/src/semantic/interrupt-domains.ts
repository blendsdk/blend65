import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, EffectSummary } from "../frontend/semantic-types.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import type { SemanticProgram } from "./operations.js";
import type { CallGraphNode, ProgramRoot } from "./whole-program.js";

/** An independently entering mainline or interrupt execution context. */
export type ExecutionDomain = "main" | "irq" | "nmi";

/** Domains which can enter one source function and its private storage. */
export interface FunctionDomains {
  /** Source function identity. */
  readonly function: BindingId;
  /** Distinct reachable entry domains. */
  readonly domains: readonly ExecutionDomain[];
}

/** Closed domain reachability and non-fatal shared-state findings. */
export interface InterruptDomainAnalysis {
  /** Entry domains for each reachable source function. */
  readonly functions: readonly FunctionDomains[];
  /** Cross-domain state warnings; no masking or storage copying is implied. */
  readonly diagnostics: readonly ProjectDiagnostic[];
}

/** Record whether a domain can read, write, or update one visible global. */
interface Access {
  read: boolean;
  write: boolean;
}

/** Keep shared-state analysis at the source effect boundary. */
function accessFor(summary: EffectSummary, binding: BindingId): Access {
  const key = bindingIdentityKey(binding);
  return {
    read: summary.reads.some((place) => bindingIdentityKey(place.binding) === key),
    write: summary.writes.some((place) => bindingIdentityKey(place.binding) === key),
  };
}

/** Propagate entry domains through the already closed call graph. */
export function analyzeInterruptDomains(
  program: SemanticProgram,
  roots: readonly ProgramRoot[],
  callGraph: readonly CallGraphNode[],
): InterruptDomainAnalysis {
  const callees = new Map(
    callGraph.map((node) => [bindingIdentityKey(node.function), node.callees] as const),
  );
  const domains = new Map<string, Set<ExecutionDomain>>();
  const pending: { function: BindingId; domain: ExecutionDomain }[] = [];
  for (const root of roots) {
    if (root.kind === "main" || root.kind === "callable") {
      pending.push({ function: root.function, domain: "main" });
    }
    if (root.kind === "interrupt") {
      pending.push({ function: root.function, domain: root.domain });
    }
  }
  while (pending.length > 0) {
    const current = pending.shift()!;
    const key = bindingIdentityKey(current.function);
    const reached = domains.get(key) ?? new Set<ExecutionDomain>();
    if (reached.has(current.domain)) continue;
    reached.add(current.domain);
    domains.set(key, reached);
    for (const callee of callees.get(key) ?? []) {
      pending.push({ function: callee, domain: current.domain });
    }
  }

  const effects = new Map(
    (program.effects ?? []).map(
      (summary) => [bindingIdentityKey(summary.function), summary] as const,
    ),
  );
  const diagnostics: ProjectDiagnostic[] = [];
  for (const global of program.globals) {
    if (global.storage !== "module") continue;
    const byDomain = new Map<ExecutionDomain, Access>();
    for (const [key, reached] of domains) {
      const summary = effects.get(key);
      if (summary === undefined) continue;
      const access = accessFor(summary, global.id);
      for (const domain of reached) {
        const previous = byDomain.get(domain) ?? { read: false, write: false };
        previous.read ||= access.read;
        previous.write ||= access.write;
        byDomain.set(domain, previous);
      }
    }
    const main = byDomain.get("main");
    if (main === undefined) continue;
    for (const interrupt of ["irq", "nmi"] as const) {
      const other = byDomain.get(interrupt);
      if (other === undefined) continue;
      if ((main.read && main.write && other.write) || (other.read && other.write && main.write)) {
        diagnostics.push(
          Object.freeze({
            ...projectDiagnostic(
              "W10211",
              `Shared global can lose a read-modify-write update across mainline and ${interrupt.toUpperCase()}`,
              global.source,
            ),
            severity: "warning" as const,
          }),
        );
      }
      if (
        semanticTypeSize(global.type) > 1 &&
        (main.read || main.write) &&
        (other.read || other.write) &&
        (main.write || other.write)
      ) {
        diagnostics.push(
          Object.freeze({
            ...projectDiagnostic(
              "W10212",
              `Multi-byte shared global can tear across mainline and ${interrupt.toUpperCase()}`,
              global.source,
            ),
            severity: "warning" as const,
          }),
        );
      }
    }
  }

  return Object.freeze({
    functions: Object.freeze(
      program.functions.flatMap((fn) => {
        const reached = domains.get(bindingIdentityKey(fn.id));
        return reached === undefined
          ? []
          : [Object.freeze({ function: fn.id, domains: Object.freeze([...reached]) })];
      }),
    ),
    diagnostics: Object.freeze(diagnostics),
  });
}
