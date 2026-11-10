/** Maximum directory-name and disk-label length in bytes. */
export const D64_NAME_BYTES = 16;

/** Encode one source scalar through the Specification 4 upper-graphics PETSCII policy. */
function encodeScalar(scalar: string): number | null {
  const code = scalar.codePointAt(0);
  if (code === undefined || Array.from(scalar).length !== 1) return null;
  if (code >= 0x20 && code <= 0x3f) return code;
  if (code === 0x40) return 0x40;
  if (code >= 0x41 && code <= 0x5a) return code;
  if (code >= 0x61 && code <= 0x7a) return code - 0x20;
  if (code === 0x5b) return 0x5b;
  if (code === 0x00a3) return 0x5c;
  if (code === 0x5d) return 0x5d;
  if (code === 0x2191) return 0x5e;
  if (code === 0x2190) return 0x5f;
  return null;
}

/** Encode one validated project or unit name to unpadded PETSCII bytes. */
export function encodeD64Name(text: string): readonly number[] {
  const bytes: number[] = [];
  for (const scalar of text) {
    const encoded = encodeScalar(scalar);
    if (encoded === null) {
      throw new Error(
        `D64_NAME: character U+${scalar.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")} is not representable`,
      );
    }
    bytes.push(encoded);
  }
  if (bytes.length === 0 || bytes.length > D64_NAME_BYTES) {
    throw new Error(`D64_NAME: name '${text}' must be 1-${D64_NAME_BYTES} bytes`);
  }
  return Object.freeze(bytes);
}

/** Pad one encoded name to the fixed 16-byte directory field. */
export function paddedD64Name(bytes: readonly number[]): readonly number[] {
  if (bytes.length === 0 || bytes.length > D64_NAME_BYTES) {
    throw new Error(`D64_NAME: encoded name length ${bytes.length} is invalid`);
  }
  return Object.freeze([
    ...bytes,
    ...Array.from({ length: D64_NAME_BYTES - bytes.length }, () => 0xa0),
  ]);
}

/** Derive one deterministic unit directory name from its stable identity hash. */
export function unitD64Name(identity: string): readonly number[] {
  return encodeD64Name(`L${identity.slice(0, 12).toUpperCase()}`);
}

/** Derive a two-character disk ID from the semantic-input hash. */
export function diskD64Id(semanticHash: string): readonly number[] {
  const id = semanticHash.slice(0, 2).toUpperCase();
  if (!/^[0-9A-F]{2}$/u.test(id)) {
    throw new Error("D64_NAME: semantic hash cannot supply a disk ID");
  }
  return Object.freeze([...Buffer.from(id, "ascii")]);
}
