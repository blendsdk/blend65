import { createDiagnostic, sortDiagnostics } from "./diagnostics.js";
import { equalStringTuples } from "./authority-order.js";
import type { InventoryDiagnostic, InventoryRule, InventoryV1, RuleGraphResult } from "./model.js";

const TARGETS = ["c64", "c64u", "cx16", "a800xl", "a7800"] as const;

function diagnostic(path: string, message: string): InventoryDiagnostic {
  return createDiagnostic({ phase: "graph", code: "graph.invalid", path, message });
}

function lexicalUnique(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1] < value);
}

function concreteTarget(rule: InventoryRule): string | undefined {
  const target = rule.universalProjection?.target ?? rule.applicabilityReason?.target;
  return target === "universal" ? undefined : target;
}

function projectionGroupKey(parentRuleId: string, target: string): string {
  return JSON.stringify([parentRuleId, target]);
}

class MinHeap {
  readonly #values: string[] = [];

  get size(): number {
    return this.#values.length;
  }

  push(value: string): void {
    let index = this.#values.length;
    this.#values.push(value);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const parentValue = this.#values[parent]!;
      if (parentValue <= value) break;
      this.#values[index] = parentValue;
      index = parent;
    }
    this.#values[index] = value;
  }

  pop(): string | undefined {
    const result = this.#values[0];
    const tail = this.#values.pop();
    if (result === undefined || tail === undefined || this.#values.length === 0) return result;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= this.#values.length) break;
      const right = left + 1;
      const child =
        right < this.#values.length && this.#values[right]! < this.#values[left]! ? right : left;
      const childValue = this.#values[child]!;
      if (childValue >= tail) break;
      this.#values[index] = childValue;
      index = child;
    }
    this.#values[index] = tail;
    return result;
  }
}

function findCycle(rules: readonly InventoryRule[]): readonly string[] | undefined {
  const edges = new Map(rules.map((rule) => [rule.ruleId, rule.prerequisiteRuleIds] as const));
  const reverse = new Map<string, string[]>();
  for (const [from, destinations] of edges) {
    for (const to of destinations) {
      const incoming = reverse.get(to) ?? [];
      incoming.push(from);
      reverse.set(to, incoming);
    }
  }

  // Iterative Kosaraju avoids exhausting the JavaScript stack at the schema's rule limit.
  const visited = new Set<string>();
  const finish: string[] = [];
  for (const start of [...edges.keys()].sort()) {
    if (visited.has(start)) continue;
    visited.add(start);
    const stack: { id: string; next: number }[] = [{ id: start, next: 0 }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const destinations = edges.get(frame.id)!;
      const next = destinations[frame.next];
      if (next !== undefined) {
        frame.next += 1;
        if (!visited.has(next)) {
          visited.add(next);
          stack.push({ id: next, next: 0 });
        }
      } else {
        finish.push(frame.id);
        stack.pop();
      }
    }
  }

  const assigned = new Set<string>();
  let selected: string[] | undefined;
  for (let index = finish.length - 1; index >= 0; index -= 1) {
    const start = finish[index];
    if (start === undefined || assigned.has(start)) continue;
    const component: string[] = [];
    const stack = [start];
    assigned.add(start);
    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(current);
      for (const next of reverse.get(current) ?? []) {
        if (!assigned.has(next)) {
          assigned.add(next);
          stack.push(next);
        }
      }
    }
    const first = component[0]!;
    const cyclic = component.length > 1 || edges.get(first)!.includes(first);
    if (cyclic) {
      component.sort();
      if (selected === undefined || component[0]! < selected[0]!) {
        selected = component;
      }
    }
  }
  const start = selected?.[0];
  if (start === undefined) return undefined;

  const members = new Set(selected);
  const distance = new Map<string, number>([[start, 0]]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    for (const predecessor of reverse.get(current) ?? []) {
      if (members.has(predecessor) && !distance.has(predecessor)) {
        distance.set(predecessor, distance.get(current)! + 1);
        queue.push(predecessor);
      }
    }
  }
  const path = [start];
  let current = start;
  do {
    const candidates = (edges.get(current) ?? [])
      .filter((next) => members.has(next) && distance.has(next))
      .sort();
    const expectedDistance = current === start ? undefined : distance.get(current)! - 1;
    const next =
      current === start
        ? candidates[0]
        : candidates.find((candidate) => distance.get(candidate) === expectedDistance);
    if (next === undefined) throw new Error("Internal graph cycle reconstruction failed.");
    path.push(next);
    current = next;
  } while (current !== start);
  return path;
}

function topologicalOrder(rules: readonly InventoryRule[]): readonly string[] | undefined {
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const rule of rules) {
    indegree.set(rule.ruleId, rule.prerequisiteRuleIds.length);
    for (const prerequisite of rule.prerequisiteRuleIds) {
      const values = dependents.get(prerequisite) ?? [];
      values.push(rule.ruleId);
      dependents.set(prerequisite, values);
    }
  }
  const ready = new MinHeap();
  for (const [id, value] of indegree) {
    if (value === 0) ready.push(id);
  }
  const order: string[] = [];
  while (ready.size > 0) {
    const id = ready.pop()!;
    order.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const next = indegree.get(dependent)! - 1;
      indegree.set(dependent, next);
      if (next === 0) ready.push(dependent);
    }
  }
  return order.length === rules.length ? order : undefined;
}

function validateProjections(
  rules: readonly InventoryRule[],
  byId: ReadonlyMap<string, InventoryRule>,
): readonly InventoryDiagnostic[] {
  const diagnostics: InventoryDiagnostic[] = [];
  const children = new Map<string, InventoryRule>();
  for (const [index, rule] of rules.entries()) {
    if (rule.universalProjection !== undefined) {
      const key = projectionGroupKey(
        rule.universalProjection.parentRuleId,
        rule.universalProjection.target,
      );
      if (children.has(key)) {
        diagnostics.push(diagnostic(`$.rules[${index}]`, `Projection child ${key} is duplicated.`));
      }
      children.set(key, rule);
    }
  }
  const parentIds = new Set(
    rules.flatMap((rule) =>
      rule.universalProjection === undefined ? [] : [rule.universalProjection.parentRuleId],
    ),
  );
  for (const rule of rules) {
    if (rule.applicabilityReason?.code === "universal-parent") parentIds.add(rule.ruleId);
  }
  for (const parentId of parentIds) {
    const parent = byId.get(parentId);
    if (
      parent === undefined ||
      parent.universalProjection !== undefined ||
      parent.applicability !== "out-of-claim-target" ||
      parent.applicabilityReason?.code !== "universal-parent" ||
      parent.applicabilityReason.target !== "universal"
    ) {
      diagnostics.push(diagnostic("$.rules", `Projection parent ${parentId} is invalid.`));
      continue;
    }
    for (const target of TARGETS) {
      const child = children.get(projectionGroupKey(parentId, target));
      if (child === undefined) {
        diagnostics.push(
          diagnostic("$.rules", `Projection parent ${parentId} is missing target ${target}.`),
        );
        continue;
      }
      if (
        JSON.stringify(projectionInvariant(child)) !==
          JSON.stringify(projectionInvariant(parent)) ||
        child.applicability !== (target === "c64" ? "mandatory-c64" : "out-of-claim-target") ||
        (target === "c64"
          ? child.applicabilityReason !== undefined
          : child.applicabilityReason?.code !== "different-target" ||
            child.applicabilityReason.target !== target)
      ) {
        diagnostics.push(
          diagnostic(
            "$.rules",
            `Projection child ${child.ruleId} does not retain parent semantics.`,
          ),
        );
      }
      const expected = parent.prerequisiteRuleIds.map((prerequisiteId) =>
        children.has(projectionGroupKey(prerequisiteId, target))
          ? children.get(projectionGroupKey(prerequisiteId, target))!.ruleId
          : prerequisiteId,
      );
      if (!equalStringTuples(child.prerequisiteRuleIds, expected)) {
        diagnostics.push(
          diagnostic("$.rules", `Projection child ${child.ruleId} has incorrect prerequisites.`),
        );
      }
    }
  }
  return diagnostics;
}

function projectionInvariant(rule: InventoryRule): object {
  return {
    source: rule.source,
    requirement: rule.requirement,
    category: rule.category,
    polarity: rule.polarity,
    validDomains: rule.validDomains,
    invalidNeighbors: rule.invalidNeighbors,
    boundaryFamilies: rule.boundaryFamilies,
    generatorIds: rule.generatorIds,
    oracleIds: rule.oracleIds,
    transformIds: rule.transformIds,
    handlerAbsenceReason: rule.handlerAbsenceReason,
    evidenceObligations: rule.evidenceObligations,
  };
}

/**
 * Validates authored target projections and returns lexical Kahn ordering.
 *
 * @example
 * ```ts
 * const result = validateRuleGraph(inventory);
 * ```
 */
export function validateRuleGraph(inventory: InventoryV1): RuleGraphResult {
  const diagnostics: InventoryDiagnostic[] = [];
  const byId = new Map(inventory.rules.map((rule) => [rule.ruleId, rule] as const));
  inventory.rules.forEach((rule, index) => {
    if (!lexicalUnique(rule.prerequisiteRuleIds)) {
      diagnostics.push(
        diagnostic(
          `$.rules[${index}].prerequisiteRuleIds`,
          `Rule ${rule.ruleId} has duplicate or unordered prerequisites.`,
        ),
      );
    }
    for (const prerequisiteId of rule.prerequisiteRuleIds) {
      const prerequisite = byId.get(prerequisiteId);
      if (prerequisiteId === rule.ruleId || prerequisite === undefined) {
        diagnostics.push(
          diagnostic(
            `$.rules[${index}]`,
            `Rule ${rule.ruleId} has invalid prerequisite ${prerequisiteId}.`,
          ),
        );
      } else if (
        rule.applicability === "mandatory-c64" &&
        prerequisite.applicability === "not-applicable-c64"
      ) {
        diagnostics.push(
          diagnostic(
            `$.rules[${index}]`,
            `Mandatory rule ${rule.ruleId} depends on an inapplicable rule.`,
          ),
        );
      } else if (
        concreteTarget(rule) !== undefined &&
        concreteTarget(prerequisite) !== undefined &&
        concreteTarget(rule) !== concreteTarget(prerequisite)
      ) {
        diagnostics.push(
          diagnostic(
            `$.rules[${index}]`,
            `Target-specific rule ${rule.ruleId} depends on a different concrete target.`,
          ),
        );
      }
    }
  });
  diagnostics.push(...validateProjections(inventory.rules, byId));
  if (diagnostics.length === 0) {
    const cycle = findCycle(inventory.rules);
    if (cycle !== undefined) {
      diagnostics.push(diagnostic("$.rules", `Prerequisite cycle: ${cycle.join(" -> ")}`));
    }
  }
  const ordered = sortDiagnostics(diagnostics);
  const topologicalRuleIds = ordered.length === 0 ? topologicalOrder(inventory.rules) : undefined;
  return {
    ok: ordered.length === 0 && topologicalRuleIds !== undefined,
    diagnostics: ordered,
    ...(topologicalRuleIds === undefined ? {} : { topologicalRuleIds }),
  };
}
