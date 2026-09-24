import { bindingIdentityKey } from "./semantic-types.js";
import type {
  BindingId,
  Place,
  ScalarScope,
  ScalarValueState,
  TypedExpr,
} from "./semantic-types.js";

/** Keep one source identity for each local home contributing address bits. */
export function mergeAddressOrigins(
  ...groups: readonly (readonly BindingId[] | undefined)[]
): readonly BindingId[] {
  const unique = new Map<string, BindingId>();
  for (const group of groups) {
    for (const origin of group ?? []) unique.set(bindingIdentityKey(origin), origin);
  }
  return Object.freeze([...unique.values()]);
}

/** Keep every possible addressed place through control-flow joins and integer derivation. */
export function mergeAddressPlaces(
  ...groups: readonly (readonly Place[] | undefined)[]
): readonly Place[] {
  const unique: Place[] = [];
  for (const group of groups) {
    for (const place of group ?? []) {
      if (!unique.some((candidate) => classifyPlaceAlias(candidate, place) === "must")) {
        unique.push(place);
      }
    }
  }
  return Object.freeze(unique);
}

/** Compare exact root-relative byte intervals without assuming distinct parameters cannot alias. */
export function classifyPlaceAlias(left: Place, right: Place): "must" | "may" | "not" {
  if (bindingIdentityKey(left.binding) !== bindingIdentityKey(right.binding)) return "may";
  const first = left.byteRange;
  const second = right.byteRange;
  if (first == null || second == null) return "may";
  if (first.start === second.start && first.end === second.end) return "must";
  return first.end <= second.start || second.end <= first.start ? "not" : "may";
}

/** A place borrows its local or scalar-parameter home, including through fields and indexes. */
export function localAddressOrigins(place: Place, scope: ScalarScope): readonly BindingId[] {
  const key = bindingIdentityKey(place.binding);
  for (let current: ScalarScope | null = scope; current !== null; current = current.parent) {
    for (const state of current.values.values()) {
      if (bindingIdentityKey(state.binding.id) !== key) continue;
      return state.binding.storage === "local" || state.binding.storage === "parameter"
        ? Object.freeze([place.binding])
        : Object.freeze([]);
    }
  }
  return Object.freeze([]);
}

/** Detect a write into storage whose lexical life can exceed a borrowed local home. */
export function addressEscapesPlace(
  origins: readonly BindingId[] | undefined,
  target: ScalarValueState | null,
  scope: ScalarScope,
): boolean {
  if (origins === undefined || origins.length === 0) return false;
  if (target === null || target.binding.storage === "module") return true;
  if (target.binding.storage === "parameter" && target.binding.type?.kind !== "scalar") return true;
  const depth = (binding: BindingId): number | null => {
    const key = bindingIdentityKey(binding);
    let level = 0;
    for (let current: ScalarScope | null = scope; current !== null; current = current.parent) {
      if (
        [...current.values.values()].some((state) => bindingIdentityKey(state.binding.id) === key)
      ) {
        return level;
      }
      level += 1;
    }
    return null;
  };
  const targetDepth = depth(target.binding.id);
  if (targetDepth === null) return true;
  return origins.some((origin) => {
    const originDepth = depth(origin);
    return originDepth === null || originDepth < targetDepth;
  });
}

/** Preserve address dependency through value-producing integer operations only. */
export function withDerivedAddressOrigins(node: TypedExpr): TypedExpr {
  let origins: readonly BindingId[] = node.addressOrigins ?? [];
  let places: readonly Place[] = node.addressPlaces ?? [];
  if (node.kind === "binary") {
    origins = mergeAddressOrigins(node.left?.addressOrigins, node.right?.addressOrigins);
    places = mergeAddressPlaces(node.left?.addressPlaces, node.right?.addressPlaces);
  } else if (node.kind === "conditional") {
    origins = mergeAddressOrigins(node.whenTrue?.addressOrigins, node.whenFalse?.addressOrigins);
    places = mergeAddressPlaces(node.whenTrue?.addressPlaces, node.whenFalse?.addressPlaces);
  } else if (node.kind === "cast" || node.kind === "unary") {
    const operand =
      node.operand !== undefined && "addressOrigins" in node.operand ? node.operand : null;
    origins = mergeAddressOrigins(origins, operand?.addressOrigins);
    places = mergeAddressPlaces(places, operand?.addressPlaces);
  } else if (node.kind === "assignment") {
    const value = node.value !== undefined && typeof node.value === "object" ? node.value : null;
    origins = mergeAddressOrigins(value?.addressOrigins);
    places = mergeAddressPlaces(value?.addressPlaces);
  } else if (node.kind === "call" && (node.callee?.name === "lo" || node.callee?.name === "hi")) {
    origins = mergeAddressOrigins(
      ...(node.arguments ?? []).map((argument) => argument.addressOrigins),
    );
    places = mergeAddressPlaces(
      ...(node.arguments ?? []).map((argument) => argument.addressPlaces),
    );
  }
  return (origins.length === 0 && places.length === 0) ||
    (origins === node.addressOrigins && places === node.addressPlaces)
    ? node
    : Object.freeze({ ...node, addressOrigins: origins, addressPlaces: places });
}
