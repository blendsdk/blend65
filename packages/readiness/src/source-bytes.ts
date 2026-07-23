import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

/** Hashes normalized fragment content while preserving raw spans elsewhere. */
export function contentHash(
  bytes: Uint8Array,
  startsAtSourceByteZero: boolean,
): `sha256:${string}` {
  let normalized = Buffer.from(bytes);
  if (
    startsAtSourceByteZero &&
    normalized.length >= 3 &&
    normalized[0] === 0xef &&
    normalized[1] === 0xbb &&
    normalized[2] === 0xbf
  ) {
    normalized = normalized.subarray(3);
  }
  const text = new TextDecoder("utf-8", { fatal: true })
    .decode(normalized)
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .normalize("NFC");
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

/** Encodes bytes as lowercase unpadded RFC-4648 base32. */
export function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32[(value << (5 - bits)) & 31];
  }
  return output;
}

function u32(value: number): Buffer {
  const bytes = Buffer.allocUnsafe(4);
  bytes.writeUInt32BE(value);
  return bytes;
}

function framed(value: string | Uint8Array): Buffer {
  const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
  return Buffer.concat([u32(bytes.length), bytes]);
}

/** Creates a section identity from ancestry and its same-ancestry occurrence. */
export function sectionIdentity(ancestry: readonly string[], occurrence: number): string {
  const frame = Buffer.concat([
    Buffer.from("blend65.section-id", "ascii"),
    Buffer.from([1]),
    ...ancestry.map((value) => framed(value.normalize("NFC"))),
    u32(occurrence),
  ]);
  return base32(createHash("sha256").update(frame).digest().subarray(0, 20));
}

/** Creates one stable fragment identity from the contract's binary frame. */
export function fragmentIdentity(input: {
  readonly profileId: string;
  readonly profileVersion: number;
  readonly path: string;
  readonly sectionIdentity: string;
  readonly parentFragmentId?: string;
  readonly kind: string;
  readonly contentHash: string;
  readonly occurrence: number;
}): string {
  const digest = Buffer.from(input.contentHash.slice("sha256:".length), "hex");
  const parent = input.parentFragmentId === undefined ? [] : [framed(input.parentFragmentId)];
  const frame = Buffer.concat([
    Buffer.from("blend65.fragment-id", "ascii"),
    Buffer.from([1]),
    framed(input.profileId),
    framed(String(input.profileVersion)),
    framed(input.path),
    framed(input.sectionIdentity),
    ...parent,
    framed(input.kind),
    framed(digest),
    u32(input.occurrence),
  ]);
  const identity = base32(createHash("sha256").update(frame).digest().subarray(0, 20));
  return `frag.v1.${identity}`;
}
