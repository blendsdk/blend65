/** Creates a detached recursively frozen copy of JSON-like protocol evidence. */
export function cloneFrozenFailureExecutionValueV1<T>(value: T): T {
  const cloned = structuredClone(value);
  const freeze = (input: unknown): void => {
    if (typeof input !== "object" || input === null || input instanceof Uint8Array) return;
    for (const key of Reflect.ownKeys(input)) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor !== undefined && "value" in descriptor) freeze(descriptor.value);
    }
    Object.freeze(input);
  };
  freeze(cloned);
  return cloned;
}

/** Compares two bounded byte strings without treating their digests as equality proof. */
export function equalFailureExecutionBytesV1(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}
