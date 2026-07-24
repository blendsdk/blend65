/** Structural failure found before reading an unknown programmatic value. */
export interface ProgrammaticInputFailure {
  readonly path: string;
  readonly message: string;
}

interface PendingValue {
  readonly kind: "value";
  readonly value: unknown;
  readonly path: string;
}

interface PendingLeave {
  readonly kind: "leave";
  readonly value: object;
}

type PendingTraversal = PendingValue | PendingLeave;

const MAX_PROGRAMMATIC_VALUES = 262_144;

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function childPath(path: string, key: string): string {
  return `${path}/${escapePointerSegment(key)}`;
}

function failure(path: string, message: string): ProgrammaticInputFailure {
  return { path, message };
}

function isCanonicalArrayIndex(key: string, length: number): boolean {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

/**
 * Inspects an unknown programmatic value without invoking property accessors.
 *
 * @param value Root value to inspect.
 * @param rootPath JSON Pointer assigned to the root value.
 * @param allowFunction Whether a function is permitted at a specific path.
 * @returns The first unsafe structure, or `undefined` for a plain acyclic data tree.
 *
 * @example
 * ```ts
 * const problem = inspectPlainDataTree({ id: "fixture" }, "/input", () => false);
 * ```
 */
export function inspectPlainDataTree(
  value: unknown,
  rootPath: string,
  allowFunction: (path: string) => boolean,
): ProgrammaticInputFailure | undefined {
  const pending: PendingTraversal[] = [{ kind: "value", value, path: rootPath }];
  const ancestors = new WeakSet<object>();
  let visited = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    if (current.kind === "leave") {
      ancestors.delete(current.value);
      continue;
    }
    visited += 1;
    if (visited > MAX_PROGRAMMATIC_VALUES) {
      return failure(current.path, "Programmatic input exceeds the traversal value limit.");
    }

    const rawValue = current.value;
    if (
      rawValue === null ||
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean"
    ) {
      continue;
    }
    if (typeof rawValue === "function") {
      if (allowFunction(current.path)) continue;
      return failure(current.path, "Functions are not permitted at this input path.");
    }
    if (typeof rawValue !== "object") {
      return failure(current.path, "Programmatic input contains a non-data value.");
    }

    const objectValue = rawValue;
    if (ancestors.has(objectValue)) {
      return failure(current.path, "Programmatic input must be an acyclic data tree.");
    }
    ancestors.add(objectValue);
    pending.push({ kind: "leave", value: objectValue });

    try {
      const prototype = Object.getPrototypeOf(objectValue);
      const isArray = Array.isArray(objectValue);
      if (
        (isArray && prototype !== Array.prototype) ||
        (!isArray && prototype !== Object.prototype && prototype !== null)
      ) {
        return failure(current.path, "Programmatic input records and arrays must be plain.");
      }

      const keys = Reflect.ownKeys(objectValue);
      if (keys.some((key) => typeof key !== "string")) {
        return failure(current.path, "Programmatic input must not contain symbol properties.");
      }
      const stringKeys = keys.filter((key): key is string => typeof key === "string");
      const descriptors = Object.getOwnPropertyDescriptors(objectValue);

      if (isArray) {
        const lengthDescriptor = descriptors.length;
        if (
          lengthDescriptor === undefined ||
          !("value" in lengthDescriptor) ||
          typeof lengthDescriptor.value !== "number"
        ) {
          return failure(current.path, "Programmatic input array length is not a data property.");
        }
        const elementKeys = stringKeys.filter((key) => key !== "length");
        if (
          elementKeys.length !== lengthDescriptor.value ||
          elementKeys.some((key) => !isCanonicalArrayIndex(key, lengthDescriptor.value))
        ) {
          return failure(current.path, "Programmatic input arrays must be dense and unadorned.");
        }
      }

      for (const key of stringKeys) {
        if (key === "length" && isArray) continue;
        const descriptor = descriptors[key];
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          return failure(
            childPath(current.path, key),
            "Programmatic input properties must be enumerable data properties.",
          );
        }
        pending.push({
          kind: "value",
          value: descriptor.value,
          path: childPath(current.path, key),
        });
      }
    } catch {
      return failure(current.path, "Programmatic input structure could not be inspected safely.");
    }
  }

  return undefined;
}
