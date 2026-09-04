/** Structural failure found before an unknown generator input is read. */
export interface GeneratorInputFailure {
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

const MAX_GENERATOR_VALUES = 262_144;

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function childPath(path: string, key: string): string {
  return `${path}/${escapePointerSegment(key)}`;
}

function isCanonicalArrayIndex(key: string, length: number): boolean {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

/**
 * Inspects generator data without invoking accessors or accepting exotic objects.
 *
 * @param value Root input value.
 * @param rootPath JSON-pointer path assigned to the root.
 * @param allowFunction Whether a callable capability is permitted at a path.
 * @returns The first unsafe structure, or `undefined` for a plain acyclic tree.
 *
 * @example
 * ```ts
 * inspectGeneratorInput({ kind: "module" }, "", () => false);
 * ```
 */
export function inspectGeneratorInput(
  value: unknown,
  rootPath: string,
  allowFunction: (path: string) => boolean,
): GeneratorInputFailure | undefined {
  const pending: PendingTraversal[] = [{ kind: "value", value, path: rootPath }];
  const ancestors = new WeakSet<object>();
  let visited = 0;
  let scheduled = 1;

  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    if (current.kind === "leave") {
      ancestors.delete(current.value);
      continue;
    }
    visited += 1;
    if (visited > MAX_GENERATOR_VALUES) {
      return {
        path: current.path,
        message: "Generator input exceeds the traversal value limit.",
      };
    }

    const rawValue = current.value;
    if (
      rawValue === null ||
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "bigint" ||
      typeof rawValue === "boolean"
    ) {
      continue;
    }
    if (typeof rawValue === "function") {
      if (allowFunction(current.path)) continue;
      return { path: current.path, message: "Functions are not permitted at this input path." };
    }
    if (typeof rawValue !== "object") {
      return { path: current.path, message: "Generator input contains a non-data value." };
    }

    const objectValue = rawValue;
    if (ancestors.has(objectValue)) {
      return { path: current.path, message: "Generator input must be an acyclic data tree." };
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
        return {
          path: current.path,
          message: "Generator records and arrays must use plain prototypes.",
        };
      }

      let arrayLength: number | undefined;
      if (isArray) {
        const lengthDescriptor = Reflect.getOwnPropertyDescriptor(objectValue, "length");
        if (
          lengthDescriptor === undefined ||
          !("value" in lengthDescriptor) ||
          typeof lengthDescriptor.value !== "number"
        ) {
          return {
            path: current.path,
            message: "Generator array length must be an own data property.",
          };
        }
        arrayLength = lengthDescriptor.value;
        if (arrayLength > MAX_GENERATOR_VALUES - scheduled) {
          return {
            path: current.path,
            message: "Generator input exceeds the traversal value limit.",
          };
        }
      }

      const keys = Reflect.ownKeys(objectValue);
      if (keys.some((key) => typeof key !== "string")) {
        return { path: current.path, message: "Generator input must not contain symbols." };
      }
      const stringKeys = keys.filter((key): key is string => typeof key === "string");
      const childKeys = stringKeys.filter((key) => !(isArray && key === "length"));
      if (childKeys.length > MAX_GENERATOR_VALUES - scheduled) {
        return {
          path: current.path,
          message: "Generator input exceeds the traversal value limit.",
        };
      }
      scheduled += childKeys.length;

      if (isArray) {
        const elementKeys = childKeys;
        if (
          arrayLength === undefined ||
          elementKeys.length !== arrayLength ||
          elementKeys.some((key) => !isCanonicalArrayIndex(key, arrayLength))
        ) {
          return {
            path: current.path,
            message: "Generator arrays must be dense and unadorned.",
          };
        }
      }

      for (const key of childKeys) {
        const descriptor = Reflect.getOwnPropertyDescriptor(objectValue, key);
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          return {
            path: childPath(current.path, key),
            message: "Generator properties must be enumerable own data properties.",
          };
        }
        pending.push({
          kind: "value",
          value: descriptor.value,
          path: childPath(current.path, key),
        });
      }
    } catch {
      return {
        path: current.path,
        message: "Generator input structure could not be inspected safely.",
      };
    }
  }

  return undefined;
}
