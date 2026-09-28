import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, EffectSummary } from "../frontend/semantic-types.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { SemanticProgram } from "./operations.js";
import type { IrqOverlapFacts } from "../storage/storage-types.js";
import type { CallGraphNode, ProgramRoot, WholeProgram } from "./whole-program.js";

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

/** Prefer the complete write operation over its component read when showing an update. */
function accessSite(
  program: SemanticProgram,
  included: ReadonlySet<string>,
  binding: BindingId,
): SourceSpan | null {
  let read: SourceSpan | null = null;
  for (const fn of program.functions) {
    if (!included.has(bindingIdentityKey(fn.id))) continue;
    for (const block of fn.blocks) {
      for (const operation of block.operations) {
        if (
          (operation.kind !== "load" && operation.kind !== "store") ||
          bindingIdentityKey(operation.place.root) !== bindingIdentityKey(binding)
        )
          continue;
        if (operation.kind === "store") return operation.span;
        read ??= operation.span;
      }
    }
  }
  return read;
}

/** Find ordinary callees that execute inside one selected IRQ handler root. */
function rootFunctions(program: WholeProgram, root: string): ReadonlySet<string> {
  const calls = new Map(
    program.callGraph.map(
      (node) => [bindingIdentityKey(node.function), node.callees.map(bindingIdentityKey)] as const,
    ),
  );
  const reached = new Set<string>();
  const pending = [root];
  while (pending.length > 0) {
    const key = pending.pop()!;
    if (reached.has(key)) continue;
    reached.add(key);
    pending.push(...(calls.get(key) ?? []));
  }
  return reached;
}

/** Warn only when selected IRQ paths prove that two roots can overlap. */
export function overlappingIrqRootWarnings(
  program: WholeProgram,
  overlap: IrqOverlapFacts | undefined,
): readonly ProjectDiagnostic[] {
  if (overlap === undefined || overlap.rootPairs.length === 0) return Object.freeze([]);
  const functions = new Map<string, ReadonlySet<string>>();
  const effects = new Map(
    program.effects.map((summary) => [bindingIdentityKey(summary.function), summary] as const),
  );
  const warnings = new Map<string, ProjectDiagnostic>();
  const accessByRoot = new Map<string, Map<string, Access>>();
  const siteByRoot = new Map<string, Map<string, SourceSpan | null>>();
  /** One root's effect and source facts are reused by every overlap pair containing it. */
  const combined = (root: string, owners: ReadonlySet<string>, binding: BindingId): Access => {
    const key = bindingIdentityKey(binding);
    const cached = accessByRoot.get(root)?.get(key);
    if (cached !== undefined) return cached;
    const result = { read: false, write: false };
    for (const owner of owners) {
      const summary = effects.get(owner);
      if (summary === undefined) continue;
      const access = accessFor(summary, binding);
      result.read ||= access.read;
      result.write ||= access.write;
    }
    const entries = accessByRoot.get(root) ?? new Map<string, Access>();
    entries.set(key, result);
    accessByRoot.set(root, entries);
    return result;
  };
  const sourceSite = (
    root: string,
    owners: ReadonlySet<string>,
    binding: BindingId,
  ): SourceSpan | null => {
    const key = bindingIdentityKey(binding);
    const entries = siteByRoot.get(root) ?? new Map<string, SourceSpan | null>();
    if (entries.has(key)) return entries.get(key)!;
    const found = accessSite(program.semantic, owners, binding);
    entries.set(key, found);
    siteByRoot.set(root, entries);
    return found;
  };
  for (const [leftRoot, rightRoot] of overlap.rootPairs) {
    const leftFunctions = functions.get(leftRoot) ?? rootFunctions(program, leftRoot);
    const rightFunctions = functions.get(rightRoot) ?? rootFunctions(program, rightRoot);
    functions.set(leftRoot, leftFunctions);
    functions.set(rightRoot, rightFunctions);
    for (const global of program.semantic.globals) {
      if (global.storage !== "module") continue;
      const left = combined(leftRoot, leftFunctions, global.id);
      const right = combined(rightRoot, rightFunctions, global.id);
      const lostUpdate =
        (left.read && left.write && right.write) || (right.read && right.write && left.write);
      const tear =
        semanticTypeSize(global.type) > 1 &&
        (left.read || left.write) &&
        (right.read || right.write) &&
        (left.write || right.write);
      if (!lostUpdate && !tear) continue;
      const primary = sourceSite(leftRoot, leftFunctions, global.id) ?? global.source;
      const conflicting = sourceSite(rightRoot, rightFunctions, global.id) ?? global.source;
      const related = [{ span: conflicting, message: "Conflicting overlapping IRQ access" }];
      const name = global.name ?? "<unknown>";
      const key = bindingIdentityKey(global.id);
      if (lostUpdate) {
        warnings.set(
          `W10211:${key}`,
          Object.freeze({
            ...projectDiagnostic(
              "W10211",
              `Shared '${name}' has an unprotected cross-domain read-modify-write that can lose an update`,
              primary,
              null,
              related,
            ),
            severity: "warning" as const,
          }),
        );
      }
      if (tear) {
        warnings.set(
          `W10212:${key}`,
          Object.freeze({
            ...projectDiagnostic(
              "W10212",
              `Shared multi-byte '${name}' can tear across overlapping IRQ access`,
              primary,
              null,
              related,
            ),
            severity: "warning" as const,
          }),
        );
      }
    }
  }
  return Object.freeze([...warnings.values()]);
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
      const owners = (domain: ExecutionDomain): ReadonlySet<string> =>
        new Set([...domains].flatMap(([key, reached]) => (reached.has(domain) ? [key] : [])));
      const primary = accessSite(program, owners("main"), global.id) ?? global.source;
      const conflicting = accessSite(program, owners(interrupt), global.id) ?? global.source;
      const related = [{ span: conflicting, message: `Conflicting ${interrupt} access` }];
      if ((main.read && main.write && other.write) || (other.read && other.write && main.write)) {
        diagnostics.push(
          Object.freeze({
            ...projectDiagnostic(
              "W10211",
              `Shared '${global.name ?? "<unknown>"}' has an unprotected cross-domain read-modify-write that can lose an update`,
              primary,
              null,
              related,
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
              `Shared multi-byte '${global.name ?? "<unknown>"}' can tear across 'mainline' and '${interrupt}' access`,
              primary,
              null,
              related,
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
