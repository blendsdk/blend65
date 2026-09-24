import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type {
  ModuleAnalysisResult,
  SemanticBinding,
  TypedBlock,
  TypedDeclaration,
  TypedExpr,
  TypedStatement,
} from "./semantic-types.js";

type Origins = ReadonlySet<string>;
type Aliases = Map<string, Origins>;

/** Collect parameter dependencies without turning addresses into runtime objects. */
function union(...sets: readonly Origins[]): Origins {
  return new Set(sets.flatMap((set) => [...set]));
}

/** Identify parameter bindings owned by one function, in source order. */
function parametersOf(
  owner: SemanticBinding,
  bindings: readonly SemanticBinding[],
): readonly SemanticBinding[] {
  return bindings
    .filter(
      (binding) =>
        binding.storage === "parameter" &&
        binding.id.sourceId === owner.id.sourceId &&
        binding.declaration.start >= owner.declaration.start &&
        binding.declaration.end <= owner.declaration.end,
    )
    .sort((left, right) => left.declaration.start - right.declaration.start);
}

/** Return the parameter sources of one expression and record any retaining use. */
function scanValue(
  expression: TypedExpr,
  aliases: Aliases,
  retained: Set<string>,
  summaries: ReadonlyMap<string, Origins>,
  knownFunctions: ReadonlySet<string>,
  parameters: ReadonlyMap<string, readonly SemanticBinding[]>,
  called: Set<string> | null,
): Origins {
  if (expression.kind === "name" && expression.binding !== null) {
    return aliases.get(bindingIdentityKey(expression.binding)) ?? new Set();
  }
  if (expression.kind === "unary" && expression.operator === "&") {
    return expression.operand !== undefined &&
      "place" in expression.operand &&
      expression.operand.place !== null
      ? (aliases.get(bindingIdentityKey(expression.operand.place.binding)) ?? new Set())
      : new Set();
  }
  if (expression.kind === "assignment") {
    const value =
      typeof expression.value === "object" && expression.value !== null
        ? scanValue(
            expression.value,
            aliases,
            retained,
            summaries,
            knownFunctions,
            parameters,
            called,
          )
        : new Set<string>();
    const target = expression.target?.place;
    if (target !== null && target !== undefined) {
      const key = bindingIdentityKey(target.binding);
      if (aliases.has(key) && target.path.length === 0) aliases.set(key, value);
      else for (const source of value) retained.add(source);
    }
    return value;
  }
  if (expression.kind === "call") {
    const arguments_ = (expression.arguments ?? []).map((argument) =>
      scanValue(argument, aliases, retained, summaries, knownFunctions, parameters, called),
    );
    const name = expression.callee?.name;
    if (name === "peek" || name === "peekw") return new Set();
    if (name === "poke" || name === "pokew") {
      for (const source of arguments_[1] ?? []) retained.add(source);
      return new Set();
    }
    if (name === "lo" || name === "hi") return union(...arguments_);
    const calleeKey = expression.callee?.binding
      ? bindingIdentityKey(expression.callee.binding)
      : null;
    if (calleeKey !== null && knownFunctions.has(calleeKey)) {
      called?.add(calleeKey);
      const retainedByCallee = summaries.get(calleeKey) ?? new Set();
      const calleeParameters = parameters.get(calleeKey) ?? [];
      arguments_.forEach((sources, index) => {
        const parameter = calleeParameters[index];
        if (parameter === undefined || !retainedByCallee.has(bindingIdentityKey(parameter.id)))
          return;
        for (const source of sources) retained.add(source);
      });
      return new Set();
    }
    for (const sources of arguments_) for (const source of sources) retained.add(source);
    return new Set();
  }
  if (expression.kind === "conditional") {
    const condition = expression.condition;
    if (condition !== undefined) {
      scanValue(condition, aliases, retained, summaries, knownFunctions, parameters, called);
    }
    return union(
      expression.whenTrue === undefined
        ? new Set()
        : scanValue(
            expression.whenTrue,
            aliases,
            retained,
            summaries,
            knownFunctions,
            parameters,
            called,
          ),
      expression.whenFalse === undefined
        ? new Set()
        : scanValue(
            expression.whenFalse,
            aliases,
            retained,
            summaries,
            knownFunctions,
            parameters,
            called,
          ),
    );
  }
  const children = [
    expression.operand !== undefined && "constant" in expression.operand
      ? expression.operand
      : null,
    expression.left,
    expression.right,
    expression.object,
    expression.index,
    ...(expression.elements ?? []),
    ...(expression.fields ?? []).map((field) => field.value),
    expression.fill ?? null,
  ];
  return union(
    ...children
      .filter((child): child is TypedExpr => child !== null && child !== undefined)
      .map((child) =>
        scanValue(child, aliases, retained, summaries, knownFunctions, parameters, called),
      ),
  );
}

/** Merge aliases from alternative paths without treating a branch as a lifetime boundary. */
function mergeAliases(target: Aliases, alternatives: readonly Aliases[]): void {
  for (const key of target.keys()) {
    target.set(key, union(...alternatives.map((branch) => branch.get(key) ?? new Set<string>())));
  }
}

/** Compare the finite parameter-origin facts at a loop head. */
function sameAliases(left: Aliases, right: Aliases): boolean {
  return [...left].every(([key, origins]) => {
    const other = right.get(key);
    return (
      other !== undefined &&
      origins.size === other.size &&
      [...origins].every((id) => other.has(id))
    );
  });
}

/** Revisit a loop until an alias from one iteration cannot reveal a new retaining use. */
function scanLoop(aliases: Aliases, iteration: (current: Aliases) => void): void {
  const entry = new Map(aliases);
  let head = new Map(aliases);
  for (;;) {
    const output = new Map(head);
    iteration(output);
    const next = new Map(entry);
    mergeAliases(next, [entry, output]);
    if (sameAliases(head, next)) {
      mergeAliases(aliases, [entry, next]);
      return;
    }
    head = next;
  }
}

/** Scan a checked block for uses which can retain a parameter-origin address. */
function scanBlock(
  block: TypedBlock,
  aliases: Aliases,
  retained: Set<string>,
  summaries: ReadonlyMap<string, Origins>,
  knownFunctions: ReadonlySet<string>,
  parameters: ReadonlyMap<string, readonly SemanticBinding[]>,
  called: Set<string> | null,
): void {
  const value = (expression: TypedExpr): Origins =>
    scanValue(expression, aliases, retained, summaries, knownFunctions, parameters, called);
  for (const statement of block.statements) {
    if (statement.kind === "variable") {
      aliases.set(
        bindingIdentityKey(statement.binding),
        statement.initializer ? value(statement.initializer) : new Set(),
      );
    } else if (statement.kind === "expression-statement") {
      value(statement.expression);
    } else if (statement.kind === "return") {
      if (statement.value !== undefined && statement.value !== null) {
        for (const source of value(statement.value)) retained.add(source);
      }
    } else if (statement.kind === "block") {
      scanBlock(statement, aliases, retained, summaries, knownFunctions, parameters, called);
    } else if (statement.kind === "if") {
      value(statement.condition);
      const yes = new Map(aliases);
      const no = new Map(aliases);
      scanBlock(statement.then, yes, retained, summaries, knownFunctions, parameters, called);
      if (statement.otherwise !== null) {
        scanAlternative(
          statement.otherwise,
          no,
          retained,
          summaries,
          knownFunctions,
          parameters,
          called,
        );
      }
      mergeAliases(aliases, [yes, no]);
    } else if (statement.kind === "while" || statement.kind === "do-while") {
      scanLoop(aliases, (current) => {
        if (statement.kind === "while")
          scanValue(
            statement.condition,
            current,
            retained,
            summaries,
            knownFunctions,
            parameters,
            called,
          );
        scanBlock(statement.body, current, retained, summaries, knownFunctions, parameters, called);
        if (statement.kind === "do-while")
          scanValue(
            statement.condition,
            current,
            retained,
            summaries,
            knownFunctions,
            parameters,
            called,
          );
      });
    } else if (statement.kind === "for") {
      const initializer = statement.initializer;
      if (initializer !== null) {
        if ("kind" in initializer) {
          aliases.set(
            bindingIdentityKey(initializer.binding),
            initializer.initializer ? value(initializer.initializer) : new Set(),
          );
        } else initializer.forEach(value);
      }
      scanLoop(aliases, (current) => {
        if (statement.condition !== null)
          scanValue(
            statement.condition,
            current,
            retained,
            summaries,
            knownFunctions,
            parameters,
            called,
          );
        scanBlock(statement.body, current, retained, summaries, knownFunctions, parameters, called);
        for (const update of statement.update ?? [])
          scanValue(update, current, retained, summaries, knownFunctions, parameters, called);
      });
    } else if (statement.kind === "switch") {
      value(statement.value);
      const alternatives: Aliases[] = [new Map(aliases)];
      for (const clause of statement.clauses) {
        const branch = new Map(aliases);
        scanBlock(clause.body, branch, retained, summaries, knownFunctions, parameters, called);
        alternatives.push(branch);
      }
      mergeAliases(aliases, alternatives);
    }
  }
}

/** Else-if is another conditional path; an else block is an ordinary block. */
function scanAlternative(
  statement: Extract<TypedStatement, { kind: "if" | "block" }>,
  aliases: Aliases,
  retained: Set<string>,
  summaries: ReadonlyMap<string, Origins>,
  knownFunctions: ReadonlySet<string>,
  parameters: ReadonlyMap<string, readonly SemanticBinding[]>,
  called: Set<string> | null,
): void {
  if (statement.kind === "block") {
    scanBlock(statement, aliases, retained, summaries, knownFunctions, parameters, called);
    return;
  }
  const block: TypedBlock = { kind: "block", span: statement.span, statements: [statement] };
  scanBlock(block, aliases, retained, summaries, knownFunctions, parameters, called);
}

/** Infer the exact argument positions which may preserve an incoming address. */
export function inferRetainingParameters(
  analysis: ModuleAnalysisResult,
): ReadonlyMap<string, Origins> {
  const functions = new Map(
    analysis.declarations
      .filter(
        (declaration): declaration is TypedDeclaration =>
          declaration.kind === "typed" && declaration.body !== null,
      )
      .map((declaration) => [bindingIdentityKey(declaration.binding), declaration]),
  );
  const bindings = new Map(
    analysis.bindings.map((binding) => [bindingIdentityKey(binding.id), binding]),
  );
  const parameters = new Map(
    [...functions.keys()].map((key) => [key, parametersOf(bindings.get(key)!, analysis.bindings)]),
  );
  const summaries = new Map<string, Origins>([...functions.keys()].map((key) => [key, new Set()]));
  const knownFunctions = new Set(functions.keys());
  const callers = new Map([...knownFunctions].map((key) => [key, new Set<string>()]));
  /** Rescan only a caller whose callee gained a new retained parameter. */
  const scanFunction = (key: string, called: Set<string> | null): boolean => {
    const declaration = functions.get(key)!;
    const aliases: Aliases = new Map(
      (parameters.get(key) ?? []).map((parameter) => {
        const parameterKey = bindingIdentityKey(parameter.id);
        return [parameterKey, new Set([parameterKey])];
      }),
    );
    const retained = new Set(summaries.get(key));
    scanBlock(declaration.body!, aliases, retained, summaries, knownFunctions, parameters, called);
    if (retained.size === summaries.get(key)?.size) return false;
    summaries.set(key, retained);
    return true;
  };
  const queue: string[] = [];
  const queued = new Set<string>();
  for (const key of knownFunctions) {
    const called = new Set<string>();
    if (scanFunction(key, called)) {
      queue.push(key);
      queued.add(key);
    }
    for (const callee of called) callers.get(callee)?.add(key);
  }
  for (let index = 0; index < queue.length; index += 1) {
    const changed = queue[index]!;
    queued.delete(changed);
    for (const caller of callers.get(changed) ?? []) {
      if (!scanFunction(caller, null) || queued.has(caller)) continue;
      queue.push(caller);
      queued.add(caller);
    }
  }
  return summaries;
}

/** Diagnose an address passed to a callee position which may retain it. */
export function diagnoseBorrowedCalls(
  analysis: ModuleAnalysisResult,
): readonly ProjectDiagnostic[] {
  const retained = inferRetainingParameters(analysis);
  const bindings = new Map(
    analysis.bindings.map((binding) => [bindingIdentityKey(binding.id), binding]),
  );
  const parameters = new Map(
    [...retained.keys()].map((key) => [key, parametersOf(bindings.get(key)!, analysis.bindings)]),
  );
  const diagnostics: ProjectDiagnostic[] = [];
  const visit = (expression: TypedExpr): void => {
    if (expression.kind === "call") {
      const name = expression.callee?.name;
      const calleeKey = expression.callee?.binding
        ? bindingIdentityKey(expression.callee.binding)
        : null;
      (expression.arguments ?? []).forEach((argument, index) => {
        if ((argument.addressOrigins?.length ?? 0) === 0) return;
        const safeMemoryAddress =
          (name === "peek" || name === "peekw" || name === "poke" || name === "pokew") &&
          index === 0;
        const safeByteExtraction = (name === "lo" || name === "hi") && index === 0;
        const parameter = calleeKey === null ? undefined : parameters.get(calleeKey)?.[index];
        const safeFunction =
          parameter !== undefined &&
          !retained.get(calleeKey!)?.has(bindingIdentityKey(parameter.id));
        if (!safeMemoryAddress && !safeByteExtraction && !safeFunction) {
          diagnostics.push(
            projectDiagnostic(
              "E10260",
              "A local address or derived fragment reaches an operation that may retain it",
              argument.span,
              null,
              (argument.addressOrigins ?? []).map((origin) => ({
                span: origin.span,
                message: "Borrowed local address originates here",
              })),
            ),
          );
        }
      });
    }
    const children = [
      expression.operand !== undefined && "constant" in expression.operand
        ? expression.operand
        : null,
      expression.left,
      expression.right,
      expression.condition,
      expression.whenTrue,
      expression.whenFalse,
      expression.target,
      expression.callee,
      expression.object,
      expression.index,
      ...(expression.arguments ?? []),
      ...(expression.elements ?? []),
      ...(expression.fields ?? []).map((field) => field.value),
      expression.fill ?? null,
      typeof expression.value === "object" ? expression.value : null,
    ];
    for (const child of children) if (child !== null && child !== undefined) visit(child);
  };
  const visitBlock = (block: TypedBlock): void => {
    for (const statement of block.statements) {
      if (statement.kind === "variable" && statement.initializer !== null)
        visit(statement.initializer);
      else if (statement.kind === "expression-statement") visit(statement.expression);
      else if (
        statement.kind === "return" &&
        statement.value !== undefined &&
        statement.value !== null
      )
        visit(statement.value);
      else if (statement.kind === "block") visitBlock(statement);
      else if (statement.kind === "if") {
        visit(statement.condition);
        visitBlock(statement.then);
        if (statement.otherwise !== null)
          visitBlock(
            statement.otherwise.kind === "block"
              ? statement.otherwise
              : {
                  kind: "block",
                  span: statement.otherwise.span,
                  statements: [statement.otherwise],
                },
          );
      } else if (statement.kind === "while" || statement.kind === "do-while") {
        visit(statement.condition);
        visitBlock(statement.body);
      } else if (statement.kind === "for") {
        if (statement.initializer !== null) {
          if ("kind" in statement.initializer && statement.initializer.initializer !== null)
            visit(statement.initializer.initializer);
          else if (!("kind" in statement.initializer)) statement.initializer.forEach(visit);
        }
        if (statement.condition !== null) visit(statement.condition);
        visitBlock(statement.body);
        for (const update of statement.update ?? []) visit(update);
      } else if (statement.kind === "switch") {
        visit(statement.value);
        for (const clause of statement.clauses) visitBlock(clause.body);
      }
    }
  };
  for (const declaration of analysis.declarations) {
    if (declaration.kind === "typed" && declaration.body !== null) visitBlock(declaration.body);
  }
  return Object.freeze(diagnostics);
}
