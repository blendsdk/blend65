import type { FailureClaimWitnessV1 } from "./failure-envelope-model.js";
import type { GenExpression, GenModule, GenStatement } from "./generator-ir.js";

type WitnessRoot = "module" | "baseline";

function scalarTypeForRule(ruleId: string): string | undefined {
  for (const type of ["boolean", "byte", "sbyte", "word", "sword"] as const) {
    if (ruleId.includes(`primitive-types.${type}.`)) return type;
  }
  return undefined;
}

function memoryShapeForRule(
  ruleId: string,
): Readonly<{ kind: "memory-read" | "memory-write"; width: 1 | 2 }> | undefined {
  if (ruleId.includes("memory-access.peekw-")) return { kind: "memory-read", width: 2 };
  if (ruleId.includes("memory-access.peek-")) return { kind: "memory-read", width: 1 };
  if (ruleId.includes("memory-access.pokew-")) return { kind: "memory-write", width: 2 };
  if (ruleId.includes("memory-access.poke-")) return { kind: "memory-write", width: 1 };
  return undefined;
}

/** Returns whether one validated IR node directly establishes the named modeled rule. */
export function failureWitnessEntailsRuleV1(ruleId: string, value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const scalarType = scalarTypeForRule(ruleId);
  if (scalarType !== undefined) {
    if (Reflect.get(value, "type") === scalarType) return true;
    const kind = Reflect.get(value, "kind");
    if (kind === "return") {
      return failureWitnessEntailsRuleV1(ruleId, Reflect.get(value, "value"));
    }
    if (kind === "assign") {
      return failureWitnessEntailsRuleV1(ruleId, Reflect.get(value, "value"));
    }
    if (kind === "local") {
      return (
        Reflect.get(value, "type") === scalarType ||
        failureWitnessEntailsRuleV1(ruleId, Reflect.get(value, "initializer"))
      );
    }
    return false;
  }
  const memory = memoryShapeForRule(ruleId);
  return (
    memory !== undefined &&
    Reflect.get(value, "kind") === memory.kind &&
    Reflect.get(value, "width") === memory.width
  );
}

function expressionLocations(
  expression: GenExpression,
  path: string,
): readonly [string, unknown][] {
  const locations: [string, unknown][] = [[path, expression]];
  if (expression.kind === "unary") {
    locations.push(...expressionLocations(expression.operand, `${path}/operand`));
  } else if (expression.kind === "binary") {
    locations.push(...expressionLocations(expression.left, `${path}/left`));
    locations.push(...expressionLocations(expression.right, `${path}/right`));
  } else if (expression.kind === "memory-read") {
    locations.push(...expressionLocations(expression.address, `${path}/address`));
  }
  return locations;
}

function statementLocations(statement: GenStatement, path: string): readonly [string, unknown][] {
  const locations: [string, unknown][] = [[path, statement]];
  if (statement.kind === "local") {
    locations.push(...expressionLocations(statement.initializer, `${path}/initializer`));
  } else if (statement.kind === "assign") {
    locations.push(...expressionLocations(statement.value, `${path}/value`));
  } else if (statement.kind === "memory-write") {
    locations.push(...expressionLocations(statement.address, `${path}/address`));
    locations.push(...expressionLocations(statement.value, `${path}/value`));
  } else if (statement.kind === "return" && statement.value !== undefined) {
    locations.push(...expressionLocations(statement.value, `${path}/value`));
  }
  return locations;
}

function moduleLocations(module: GenModule, root: WitnessRoot): readonly [string, unknown][] {
  const locations: [string, unknown][] = [];
  for (let index = 0; index < module.constants.length; index += 1) {
    const constant = module.constants[index];
    if (constant !== undefined) {
      locations.push(...expressionLocations(constant.value, `/${root}/constants/${index}/value`));
    }
  }
  for (let functionIndex = 0; functionIndex < module.functions.length; functionIndex += 1) {
    const fn = module.functions[functionIndex];
    if (fn === undefined) continue;
    for (let index = 0; index < fn.parameters.length; index += 1) {
      const parameter = fn.parameters[index];
      if (parameter !== undefined) {
        locations.push([`/${root}/functions/${functionIndex}/parameters/${index}`, parameter]);
      }
    }
    for (let index = 0; index < fn.body.length; index += 1) {
      const statement = fn.body[index];
      if (statement !== undefined) {
        locations.push(
          ...statementLocations(statement, `/${root}/functions/${functionIndex}/body/${index}`),
        );
      }
    }
  }
  return locations;
}

/** Derives one exact rule-bearing IR witness for each modeled claim. */
export function createFailureClaimWitnessesV1(
  module: GenModule,
  ruleIds: readonly string[],
  root: WitnessRoot,
): readonly FailureClaimWitnessV1[] | undefined {
  const locations = moduleLocations(module, root);
  const witnesses: FailureClaimWitnessV1[] = [];
  for (const ruleId of ruleIds) {
    const match = locations.find(([, value]) => failureWitnessEntailsRuleV1(ruleId, value));
    if (match === undefined) return undefined;
    witnesses.push(Object.freeze({ ruleId, path: match[0] }));
  }
  return Object.freeze(witnesses);
}

/** Validates that every retained witness still resolves to a rule-bearing IR construct. */
export function validateFailureClaimWitnessesV1(
  module: GenModule,
  witnesses: readonly FailureClaimWitnessV1[],
  root: WitnessRoot,
): boolean {
  const holder: Readonly<Record<string, unknown>> = Object.freeze({ [root]: module });
  return witnesses.every(({ ruleId, path }) => {
    if (!path.startsWith(`/${root}/`) || path.includes("~")) return false;
    let current: unknown = holder;
    for (const segment of path.slice(1).split("/")) {
      if (typeof current !== "object" || current === null) return false;
      if (Array.isArray(current)) {
        if (!/^(?:0|[1-9][0-9]*)$/u.test(segment)) return false;
        current = current[Number(segment)];
      } else {
        const descriptor = Reflect.getOwnPropertyDescriptor(current, segment);
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          return false;
        }
        current = descriptor.value;
      }
    }
    return failureWitnessEntailsRuleV1(ruleId, current);
  });
}
