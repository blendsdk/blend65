import { projectDiagnostic, sortDiagnostics } from "../project/diagnostics.js";
import type {
  ProjectDiagnostic,
  ProjectSnapshot,
  SourceRecord,
  SourceSpan,
} from "../project/types.js";
import { parseSource, readModuleHeader } from "./parser.js";
import { ANALYSIS_OBLIGATION_KIND } from "./semantic-types.js";
import type {
  AnalysisObligation,
  Binding,
  BindingId,
  BindingStorage,
  ModuleGraph,
  ModuleGraphResult,
  ModuleContribution,
  ModuleIndex,
  ModuleIndexResult,
  ResolvedImport,
} from "./semantic-types.js";
import type { Declaration, SyntaxUnit } from "./syntax.js";
import { collectModuleReferences } from "./module-references.js";
import type { ModuleReference } from "./module-references.js";

export { ANALYSIS_OBLIGATION_KIND } from "./semantic-types.js";
export type {
  AnalysisObligation,
  Binding,
  BindingId,
  BindingStorage,
  ModuleGraph,
  ModuleGraphResult,
  ModuleContribution,
  ModuleIndex,
  ModuleIndexResult,
  ResolvedImport,
} from "./semantic-types.js";

/** Compare exact text by its UTF-8 bytes, independent of locale. */
function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

/** Compare source spans by source identity and then raw byte boundaries. */
function compareSpans(left: SourceSpan, right: SourceSpan): number {
  return (
    compareText(left.sourceId, right.sourceId) || left.start - right.start || left.end - right.end
  );
}

/** Freeze a span copy so no result shares a mutable caller-owned record. */
function freezeSpan(span: SourceSpan): SourceSpan {
  return Object.freeze({ sourceId: span.sourceId, start: span.start, end: span.end });
}

/** Map a parsed module declaration to its pre-body storage role. */
function declarationStorage(declaration: Declaration): BindingStorage | null {
  if (declaration.kind === "function") return "function";
  if (declaration.kind === "struct") return "type";
  if (declaration.kind === "variable") {
    return declaration.declarationKind === "const" ? "constant" : "module";
  }
  return null;
}

/** Return the declaration name facts shared by every bindable module form. */
function declarationName(declaration: Declaration): {
  readonly name: string;
  readonly nameSpan: SourceSpan;
  readonly exported: boolean;
} | null {
  if (
    declaration.kind !== "function" &&
    declaration.kind !== "struct" &&
    declaration.kind !== "variable"
  ) {
    return null;
  }
  return {
    name: declaration.name,
    nameSpan: declaration.nameSpan,
    exported: declaration.exported,
  };
}

/** Render a one-based raw-byte position without converting it to an editor column. */
function rawByteLocation(source: SourceRecord, offset: number): string {
  const bytes = Buffer.from(source.text, "utf8");
  let line = 1;
  let column = 1;
  let previousCR = false;
  for (let index = 0; index < Math.min(offset, bytes.length); index += 1) {
    const byte = bytes[index]!;
    if (byte === 0x0d) {
      line += 1;
      column = 1;
      previousCR = true;
    } else if (byte === 0x0a) {
      if (!previousCR) line += 1;
      column = 1;
      previousCR = false;
    } else {
      column += 1;
      previousCR = false;
    }
  }
  return `${source.sourceId}:${line}:${column}`;
}

/** Build a source-based binding from one bindable module declaration. */
function createBinding(moduleName: string, declaration: Declaration): Binding | null {
  const name = declarationName(declaration);
  const storage = declarationStorage(declaration);
  if (name === null || storage === null) return null;
  const declarationSpan = freezeSpan(declaration.span);
  return Object.freeze({
    id: Object.freeze({ sourceId: declaration.span.sourceId, span: declarationSpan }),
    name: name.name,
    qualifiedName: `${moduleName}.${name.name}`,
    declaration: declarationSpan,
    exported: name.exported,
    storage,
  });
}

/** Select the longest known module prefix from one dotted reference. */
function referencedModule(
  reference: ModuleReference,
  moduleNames: readonly string[],
): { readonly module: string; readonly declaration: string } | null {
  if (reference.localRoot) return null;
  for (const moduleName of moduleNames) {
    const prefix = `${moduleName}.`;
    if (!reference.name.startsWith(prefix)) continue;
    const declaration = reference.name.slice(prefix.length).split(".")[0];
    if (declaration !== undefined && declaration.length > 0)
      return { module: moduleName, declaration };
  }
  return null;
}

/** Infer an absent module only where syntax rules out an ordinary value member chain. */
function missingReferencedModule(reference: ModuleReference): string | null {
  if (reference.localRoot || !reference.name.includes(".")) return null;
  const parts = reference.name.split(".");
  if (!reference.typeReference && !reference.directCall && parts.length !== 2) return null;
  parts.pop();
  const moduleName = parts.join(".");
  return moduleName.length === 0 ? null : moduleName;
}

/**
 * Discover every source module header without interpreting declaration bodies.
 * @example indexModules(snapshot).index.modules.map(({ name }) => name)
 */
export function indexModules(snapshot: ProjectSnapshot): ModuleIndexResult {
  const grouped = new Map<string, ModuleContribution[]>();
  const diagnostics: ProjectDiagnostic[] = [];
  let complete = true;

  for (const source of snapshot.sources) {
    const result = readModuleHeader(source);
    diagnostics.push(...result.diagnostics);
    complete &&= result.complete;
    if (result.header === null) continue;
    const contributions = grouped.get(result.header.name) ?? [];
    contributions.push(Object.freeze({ sourceId: source.sourceId, header: result.header }));
    grouped.set(result.header.name, contributions);
  }

  const modules = [...grouped.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([name, contributions]) =>
      Object.freeze({
        name,
        contributions: Object.freeze(
          [...contributions].sort((left, right) => compareText(left.sourceId, right.sourceId)),
        ),
      }),
    );
  const orderedDiagnostics = sortDiagnostics(diagnostics);
  return Object.freeze({
    index: Object.freeze({ modules: Object.freeze(modules) }),
    diagnostics: orderedDiagnostics,
    complete: complete && orderedDiagnostics.every(({ severity }) => severity !== "error"),
    obligations: Object.freeze([]),
  });
}

/** Parsed facts retained for one reachable module before cross-module lookup. */
interface ReachableModule {
  /** Exact module name. */
  readonly name: string;
  /** Parsed source contributions. */
  readonly units: readonly SyntaxUnit[];
  /** First declaration accepted for each module-local name. */
  readonly bindings: ReadonlyMap<string, Binding>;
  /** Qualified references observed while parsing the module. */
  readonly references: readonly ModuleReference[];
  /** Module-scope value names that make a dotted expression ordinary member access. */
  readonly valueRoots: ReadonlySet<string>;
}

/** One declaration or resolved import competing for a module-scope spelling. */
interface ScopeEvent {
  /** Event kind used to publish only accepted imports. */
  readonly kind: "declaration" | "import";
  /** Name introduced into the module scope. */
  readonly name: string;
  /** Exact name or alias span. */
  readonly nameSpan: SourceSpan;
  /** Complete import-item span, or null for a declaration. */
  readonly importSpan: SourceSpan | null;
  /** Binding selected by the declaration or import. */
  readonly binding: Binding;
  /** Source used to render a raw-byte related location. */
  readonly source: SourceRecord;
}

/** Compare stable declaration identities by source fields. */
function sameBinding(left: BindingId, right: BindingId): boolean {
  return (
    left.sourceId === right.sourceId &&
    left.span.sourceId === right.span.sourceId &&
    left.span.start === right.span.start &&
    left.span.end === right.span.end
  );
}

/** One reachable declaration using the reserved entry-point name. */
interface EntryCandidate {
  /** Owning module name. */
  readonly module: string;
  /** Parsed declaration. */
  readonly declaration: Declaration;
  /** Accepted declaration binding. */
  readonly binding: Binding;
  /** Immutable source containing the declaration. */
  readonly source: SourceRecord;
}

/** Decode one raw-byte source range whose boundaries came from the scanner. */
function sourceSlice(source: SourceRecord, start: number, end: number): string {
  return Buffer.from(source.text, "utf8").subarray(start, end).toString("utf8");
}

/** Classify a retained unchecked region without fabricating accepted syntax. */
function uncheckedObligation(source: SourceRecord, span: SourceSpan): AnalysisObligation {
  const spelling = sourceSlice(source, span.start, span.end).trimStart();
  const implementationForm =
    /^(?:comptime|do|enum|fn|for|interrupt|loadable|place|switch|zeropage)\b/u.test(spelling);
  return Object.freeze({
    kind: implementationForm
      ? ANALYSIS_OBLIGATION_KIND.implementation
      : ANALYSIS_OBLIGATION_KIND.analysisLimit,
    span: freezeSpan(span),
    message: implementationForm
      ? "Source form is not implemented by the current frontend slice"
      : "Frontend analysis stopped at its defensive nesting limit",
  });
}

/** Render the written declaration prefix used by the canonical entry diagnostic. */
function entrySpelling(candidate: EntryCandidate): string {
  const end =
    candidate.declaration.kind === "function"
      ? candidate.declaration.body.span.start
      : candidate.declaration.span.end;
  return sourceSlice(candidate.source, candidate.declaration.span.start, end)
    .trim()
    .replace(/;$/u, "");
}

/** Check the exact accepted entry signature without performing general type analysis. */
function hasEntrySignature(candidate: EntryCandidate): boolean {
  const declaration = candidate.declaration;
  return (
    declaration.kind === "function" &&
    declaration.parameters.length === 0 &&
    declaration.returnType?.kind === "named-type" &&
    declaration.returnType.name === "void"
  );
}

/** Find each accepted reachable declaration named `main`. */
function entryCandidates(
  reachable: ReadonlyMap<string, ReachableModule>,
  sources: ReadonlyMap<string, SourceRecord>,
): readonly EntryCandidate[] {
  const candidates: EntryCandidate[] = [];
  for (const module of reachable.values()) {
    const binding = module.bindings.get("main");
    if (binding === undefined) continue;
    const source = sources.get(binding.id.sourceId);
    if (source === undefined) continue;
    for (const unit of module.units) {
      const declaration = unit.declarations.find(
        (item) =>
          item.span.sourceId === binding.id.span.sourceId &&
          item.span.start === binding.id.span.start &&
          item.span.end === binding.id.span.end,
      );
      if (declaration !== undefined) {
        candidates.push(Object.freeze({ module: module.name, declaration, binding, source }));
        break;
      }
    }
  }
  return Object.freeze(
    candidates.sort(
      (left, right) =>
        compareText(left.module, right.module) ||
        compareSpans(left.binding.declaration, right.binding.declaration),
    ),
  );
}

/** Add one dependency obligation once, preserving its first proving location. */
function addMissingDependency(
  obligations: AnalysisObligation[],
  missing: Set<string>,
  moduleName: string,
  span: SourceSpan | null,
): void {
  if (missing.has(moduleName)) return;
  missing.add(moduleName);
  obligations.push(
    Object.freeze({
      kind: ANALYSIS_OBLIGATION_KIND.dependency,
      span: span === null ? null : freezeSpan(span),
      message: `Required module '${moduleName}' is unavailable`,
    }),
  );
}

/**
 * Resolve imports and qualified names from the selected entry module only.
 * Unreachable bodies remain unparsed, while declaration-only cycles are legal.
 * @example resolveModules(snapshot, indexModules(snapshot).index).graph?.bindings
 */
export function resolveModules(snapshot: ProjectSnapshot, index: ModuleIndex): ModuleGraphResult {
  const indexedModules = new Map(index.modules.map((module) => [module.name, module]));
  const selected = indexedModules.get(snapshot.effectiveEntry);
  if (selected === undefined) {
    return Object.freeze({
      graph: null,
      diagnostics: Object.freeze([]),
      complete: false,
      obligations: Object.freeze([
        Object.freeze({
          kind: ANALYSIS_OBLIGATION_KIND.dependency,
          span: null,
          message: `Selected entry module '${snapshot.effectiveEntry}' is unavailable`,
        }),
      ]),
    });
  }

  const sources = new Map(snapshot.sources.map((source) => [source.sourceId, source]));
  const moduleNames = index.modules
    .map(({ name }) => name)
    .sort((left, right) => right.length - left.length || compareText(left, right));
  const diagnostics: ProjectDiagnostic[] = [];
  const obligations: AnalysisObligation[] = [];
  const missingDependencies = new Set<string>();
  const reachable = new Map<string, ReachableModule>();
  const enqueued = new Set<string>([selected.name]);
  const pending = [selected.name];
  let complete = true;

  while (pending.length > 0) {
    const moduleName = pending.shift()!;
    const indexedModule = indexedModules.get(moduleName);
    if (indexedModule === undefined) continue;
    const units: SyntaxUnit[] = [];
    const bindings = new Map<string, Binding>();
    const references: ModuleReference[] = [];

    for (const contribution of indexedModule.contributions) {
      const source = sources.get(contribution.sourceId);
      if (source === undefined) {
        addMissingDependency(
          obligations,
          missingDependencies,
          moduleName,
          contribution.header.span,
        );
        complete = false;
        continue;
      }
      const parsed = parseSource(source);
      diagnostics.push(...parsed.diagnostics);
      complete &&= parsed.complete;
      for (const span of parsed.unchecked) obligations.push(uncheckedObligation(source, span));
      if (
        !parsed.complete &&
        parsed.unchecked.length === 0 &&
        parsed.diagnostics.every(({ severity }) => severity !== "error")
      ) {
        obligations.push(
          Object.freeze({
            kind: ANALYSIS_OBLIGATION_KIND.analysisLimit,
            span: freezeSpan(parsed.unit?.span ?? contribution.header.span),
            message: "Frontend analysis stopped before all syntax obligations were checked",
          }),
        );
      }
      if (parsed.unit === null) continue;
      units.push(parsed.unit);
      references.push(...collectModuleReferences(parsed.unit));

      for (const declaration of parsed.unit.declarations) {
        const name = declarationName(declaration);
        if (name === null) continue;
        if (bindings.has(name.name)) continue;
        const binding = createBinding(moduleName, declaration);
        if (binding !== null) bindings.set(name.name, binding);
      }
    }

    units.sort((left, right) => compareText(left.span.sourceId, right.span.sourceId));
    const valueRoots = new Set(bindings.keys());
    for (const unit of units) {
      for (const imported of unit.imports) {
        for (const item of imported.items) valueRoots.add(item.alias ?? item.name);
      }
    }
    reachable.set(
      moduleName,
      Object.freeze({
        name: moduleName,
        units: Object.freeze(units),
        bindings,
        references: Object.freeze(references),
        valueRoots,
      }),
    );

    const dependencies: { readonly name: string; readonly span: SourceSpan }[] = [];
    for (const unit of units) {
      for (const imported of unit.imports) {
        dependencies.push({ name: imported.module, span: imported.moduleSpan });
      }
    }
    for (const reference of references) {
      const root = reference.name.split(".")[0] ?? "";
      if (reference.localRoot || valueRoots.has(root)) continue;
      const qualified = referencedModule(reference, moduleNames);
      if (qualified !== null) {
        dependencies.push({ name: qualified.module, span: reference.span });
      } else {
        const missing = missingReferencedModule(reference);
        if (missing !== null) dependencies.push({ name: missing, span: reference.span });
      }
    }
    dependencies.sort(
      (left, right) => compareText(left.name, right.name) || compareSpans(left.span, right.span),
    );
    for (const dependency of dependencies) {
      if (!indexedModules.has(dependency.name)) {
        addMissingDependency(obligations, missingDependencies, dependency.name, dependency.span);
        complete = false;
      } else if (!enqueued.has(dependency.name)) {
        enqueued.add(dependency.name);
        pending.push(dependency.name);
        pending.sort(compareText);
      }
    }
  }

  const resolvedImports: ResolvedImport[] = [];
  const visibleBindings = new Map<string, ReadonlyMap<string, Binding>>();
  for (const module of reachable.values()) {
    const events: ScopeEvent[] = [];
    for (const unit of module.units) {
      const source = sources.get(unit.span.sourceId);
      if (source === undefined) continue;
      for (const declaration of unit.declarations) {
        const name = declarationName(declaration);
        const binding = createBinding(module.name, declaration);
        if (name === null || binding === null) continue;
        events.push({
          kind: "declaration",
          name: name.name,
          nameSpan: name.nameSpan,
          importSpan: null,
          binding,
          source,
        });
      }
      for (const imported of unit.imports) {
        const targetModule = reachable.get(imported.module);
        if (targetModule === undefined) continue;
        for (const item of imported.items) {
          const target = targetModule.bindings.get(item.name);
          if (target === undefined || !target.exported) {
            diagnostics.push(
              projectDiagnostic(
                "E10012",
                `'${item.name}' is not exported from module '${imported.module}'`,
                item.nameSpan,
              ),
            );
            continue;
          }
          events.push({
            kind: "import",
            name: item.alias ?? item.name,
            nameSpan: item.aliasSpan ?? item.nameSpan,
            importSpan: item.span,
            binding: target,
            source,
          });
        }
      }
    }
    events.sort((left, right) => compareSpans(left.nameSpan, right.nameSpan));
    const localNames = new Map<
      string,
      { readonly span: SourceSpan; readonly source: SourceRecord }
    >();
    const visible = new Map<string, Binding>();
    for (const event of events) {
      const first = localNames.get(event.name);
      if (first !== undefined) {
        diagnostics.push(
          projectDiagnostic(
            "E10003",
            `Duplicate declaration '${event.name}' in the same scope — also declared at ${rawByteLocation(first.source, first.span.start)}`,
            event.nameSpan,
            null,
            [Object.freeze({ span: first.span, message: "First declaration is here" })],
          ),
        );
        continue;
      }
      localNames.set(event.name, { span: event.nameSpan, source: event.source });
      visible.set(event.name, event.binding);
      if (event.kind === "import" && event.importSpan !== null) {
        resolvedImports.push(
          Object.freeze({
            sourceSpan: freezeSpan(event.importSpan),
            alias: event.name,
            binding: event.binding.id,
          }),
        );
      }
    }
    visibleBindings.set(module.name, visible);

    for (const reference of module.references) {
      const root = reference.name.split(".")[0] ?? "";
      if (reference.localRoot || module.valueRoots.has(root)) continue;
      const qualified = referencedModule(reference, moduleNames);
      if (qualified === null) continue;
      const target = reachable.get(qualified.module)?.bindings.get(qualified.declaration);
      if (reference.directCall && target?.name === "main") continue;
      if (target === undefined || !target.exported) {
        diagnostics.push(
          projectDiagnostic(
            "E10012",
            `'${qualified.declaration}' is not exported from module '${qualified.module}'`,
            reference.span,
          ),
        );
      }
    }
  }

  let entry: BindingId | null = null;
  const candidates = entryCandidates(reachable, sources);
  if (candidates.length === 0) {
    diagnostics.push(
      projectDiagnostic(
        "E10020",
        "No entry point found — define 'function main(): void' in any module",
      ),
    );
  } else if (candidates.length > 1) {
    const first = candidates[0]!;
    const second = candidates[1]!;
    diagnostics.push(
      projectDiagnostic(
        "E10021",
        `Multiple entry points found — 'main' is defined in modules '${first.module}' and '${second.module}'; only one is allowed`,
        declarationName(second.declaration)?.nameSpan ?? second.declaration.span,
        null,
        [
          Object.freeze({
            span: declarationName(first.declaration)?.nameSpan ?? first.declaration.span,
            message: "First entry point is here",
          }),
        ],
      ),
    );
  } else {
    const candidate = candidates[0]!;
    const nameSpan = declarationName(candidate.declaration)?.nameSpan ?? candidate.declaration.span;
    if (!hasEntrySignature(candidate)) {
      diagnostics.push(
        projectDiagnostic(
          "E10022",
          `Entry point 'main' must have signature 'function main(): void' — found '${entrySpelling(candidate)}'`,
          nameSpan,
        ),
      );
    } else {
      entry = candidate.binding.id;
    }
  }

  for (const module of reachable.values()) {
    for (const reference of module.references) {
      if (!reference.directCall) continue;
      const root = reference.name.split(".")[0] ?? "";
      const localMember = reference.name.includes(".") && module.valueRoots.has(root);
      const qualified = referencedModule(reference, moduleNames);
      const called = localMember
        ? undefined
        : qualified === null
          ? reference.name.includes(".")
            ? undefined
            : visibleBindings.get(module.name)?.get(reference.name)
          : reachable.get(qualified.module)?.bindings.get(qualified.declaration);
      if (called === undefined) continue;
      if (!candidates.some((candidate) => sameBinding(candidate.binding.id, called.id))) continue;
      diagnostics.push(
        projectDiagnostic(
          "E10023",
          "Cannot call 'main()' — it is the program entry point, not a callable function",
          reference.span,
        ),
      );
    }
  }

  const modules = [...reachable.values()]
    .sort((left, right) => compareText(left.name, right.name))
    .map(({ name, units }) => Object.freeze({ name, units }));
  const bindings = [...reachable.values()]
    .flatMap((module) => [...module.bindings.values()])
    .sort((left, right) => compareSpans(left.id.span, right.id.span));
  resolvedImports.sort((left, right) => compareSpans(left.sourceSpan, right.sourceSpan));
  const orderedDiagnostics = sortDiagnostics(diagnostics);
  const frozenObligations = Object.freeze(obligations);
  const graph: ModuleGraph = Object.freeze({
    modules: Object.freeze(modules),
    bindings: Object.freeze(bindings),
    imports: Object.freeze(resolvedImports),
    entry,
  });
  return Object.freeze({
    graph,
    diagnostics: orderedDiagnostics,
    complete:
      complete &&
      frozenObligations.length === 0 &&
      orderedDiagnostics.every(({ severity }) => severity !== "error"),
    obligations: frozenObligations,
  });
}
